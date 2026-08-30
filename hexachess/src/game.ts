// 共享启动逻辑：真分辨率画布 → 存档 → 场景机 → 固定步长主循环。
// 浏览器入口 web.ts 与微信入口 main.ts 都调用它。
import { Platform } from './platform/types';
import { HitTree } from './view/layout';
import { createKit } from './render/sprites';
import { SaveData, SceneHost, SceneManager } from './scene/scene';
import { GameScene } from './scene/gameScene';
import { LevelsScene, MenuScene } from './scene/menus';
import { createInput } from './platform/input';
import { TOTAL_LEVELS, levelById } from './data/levels';
import { createNoopAudio } from './platform/audio';

const SAVE_KEY = 'hexachess2.save';
const STEP = 1 / 120; // 固定逻辑步长

function loadSave(p: Platform): SaveData {
  const base: SaveData = {
    unlocked: 1,
    stars: {},
    best: 0,
    muted: false,
    lang: 'zh',
    items: { hint: 3, shuffle: 2, hammer: 2 },
  };
  try {
    const raw = p.storageGet(SAVE_KEY);
    if (!raw) return base;
    const j = JSON.parse(raw);
    return {
      ...base,
      ...j,
      stars: j.stars || {},
      items: { ...base.items, ...(j.items || {}) },
    };
  } catch {
    return base;
  }
}

export function runGame(platform: Platform): void {
  const canvas = platform.getCanvas();
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(platform.getDpr() || 1, 3);
  let W = 0;
  let H = 0;

  const resize = (): void => {
    const s = platform.getScreenSize();
    W = Math.max(240, Math.round(s.width));
    H = Math.max(320, Math.round(s.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (canvas.style) {
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
  };
  resize();

  const save = loadSave(platform);
  const audio = platform.audio || createNoopAudio();
  audio.setMuted(save.muted);
  const reduced = platform.prefersReducedMotion ? platform.prefersReducedMotion() : false;
  const query = platform.launchQuery ? platform.launchQuery() : {};
  const autoplay = query.autoplay === '1';

  const hits = new HitTree();
  const kit = createKit((w, h) => platform.createCanvas(w, h));

  const host: SceneHost = {
    hits,
    kit,
    audio,
    save,
    lang: () => save.lang,
    reducedMotion: () => reduced,
    autoplay: () => autoplay,
    totalLevels: () => TOTAL_LEVELS,
    levelAt: (id) => levelById(id),
    replace: (name, arg) => mgr.replace(name, arg),
    persist: () => {
      try {
        platform.storageSet(SAVE_KEY, JSON.stringify(save));
      } catch {
        /* 存储不可用则本轮进度不落盘，不影响可玩性 */
      }
    },
    rewardAd: async () => (platform.ads ? platform.ads.showRewarded() : true),
    log: (...a) => platform.log(...a),
  };

  const mgr = new SceneManager();
  mgr.register(new MenuScene(host));
  mgr.register(new LevelsScene(host));
  mgr.register(new GameScene(host));

  // 分享深链：?level=7 直接进第 7 关
  const q = query;
  const startLevel = Number(q.level || 0);
  if (startLevel >= 1 && startLevel <= TOTAL_LEVELS) mgr.replace('game', levelById(startLevel));
  else mgr.replace('menu');

  const input = createInput(platform);
  input.on((e) => mgr.pointer(e));

  let last = Date.now();
  let acc = 0;
  const frame = (): void => {
    const now = Date.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // 切后台回来不要补跑一帧一小时
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 30) {
      mgr.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 30) acc = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mgr.render(ctx, W, H);
    platform.raf(frame);
  };
  // 开发钩子：?debug=1 时把运行时挂到 window，便于无头浏览器读状态定位问题
  if (query.debug === '1' && typeof window !== 'undefined') {
    (window as any).__hexa = { host, mgr, scene: () => mgr.current(), st: () => (mgr.current() as any)?.st };
  }
  platform.raf(frame);
  platform.log('六边智将 v2 已启动（正统叠消规则 · 求解器验证关卡 · 软扁平）');
}
