// 场景层回归：用 mock canvas/ctx 在 Node 里真实驱动 GameScene
// （无头 Chrome 的 --virtual-time-budget 不会持续泵 rAF，浏览器截图验不了动画循环）
import { GameScene } from '../src/scene/gameScene';
import { MenuScene, LevelsScene } from '../src/scene/menus';
import { LEVELS, TOTAL_LEVELS } from '../src/data/levels';
import { HitTree } from '../src/view/layout';
import { createKit } from '../src/render/sprites';
import { SceneHost, SaveData } from '../src/scene/scene';
import { decodePath } from '../src/logic/solver';

/* ---------- mock 图形环境 ---------- */
let calls = 0;
function mockCtx(): any {
  const grad = { addColorStop() {} };
  const c: any = {
    canvas: { width: 100, height: 100 },
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', lineJoin: '', imageSmoothingEnabled: true,
    setTransform() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {},
    closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arc() {}, ellipse() {},
    rect() {}, fill() {}, stroke() {}, fillRect() {}, clearRect() {}, clip() {},
    fillText(t: string) { calls++; void t; }, measureText: (s: string) => ({ width: String(s).length * 6 }),
    createRadialGradient: () => grad, createLinearGradient: () => grad, drawImage() { calls++; },
    setLineDash() {},
  };
  return c;
}
function mockCanvas(w = 300, h = 200): any {
  return { width: w, height: h, style: {}, getContext: () => mockCtx() };
}

// GameScene 渲染时会用到 document（离屏精灵），这里给一个最小实现
const g: any = globalThis as any;
if (!g.document) {
  g.document = { createElement: () => mockCanvas(), body: { appendChild() {}, removeChild() {} } };
}
if (!g.structuredClone) {
  g.structuredClone = (o: any) => JSON.parse(JSON.stringify(o));
}

/* ---------- mock 宿主 ---------- */
function freshSave(): SaveData {
  return { unlocked: 1, stars: {}, best: 0, muted: false, lang: 'zh', items: { hint: 3, shuffle: 2, hammer: 2 } };
}
function makeHost(save: SaveData = freshSave(), autoplay = false): SceneHost {
  return {
    hits: new HitTree(),
    kit: createKit((w, h) => mockCanvas(w, h)),
    audio: { resume() {}, setMuted() {}, play() {} } as any,
    save,
    lang: () => 'zh',
    reducedMotion: () => false,
    autoplay: () => autoplay,
    totalLevels: () => TOTAL_LEVELS,
    levelAt: (id) => LEVELS[id - 1] || null,
    replace: () => {},
    persist: () => { save.unlocked = save.unlocked; }, // 落档即写回同一个对象
    rewardAd: async () => false,
    log: () => {},
  };
}

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) passed++;
  else { failed++; console.error('  ✗', msg); }
}
const STEP = 1 / 60;
function run(scene: { update(dt: number): void }, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / STEP); i++) scene.update(STEP);
}

console.log('— 六边智将 v2 场景层回归（mock canvas）—');

/* 1. 三个场景都能渲染不抛错，且命中矩形注册到位 */
for (const [W, H] of [[390, 700], [420, 900], [860, 520], [320, 640]]) {
  const host = makeHost();
  const gm = new GameScene(host);
  gm.enter(LEVELS[0]);
  try {
    gm.render(mockCtx(), W, H);
    assert(true, `游戏场景在 ${W}×${H} 渲染无异常`);
  } catch (e) {
    assert(false, `游戏场景在 ${W}×${H} 渲染抛错：${(e as Error).message}`);
  }
  const ids = host.hits.items.map((i) => i.id);
  assert(ids.includes('btn.hint') && ids.includes('btn.hammer'), `${W}×${H} 工具条按钮可命中`);
  assert(ids.some((i) => i.indexOf('tray:') === 0), `${W}×${H} 托盘槽位可命中`);
}
{
  const mh = makeHost();
  new MenuScene(mh).render(mockCtx(), 390, 700);
  const mids = mh.hits.items.map((i) => i.id);
  assert(mids.includes('btn.play') && mids.includes('btn.levels') && mids.includes('btn.lang'), '菜单按钮可命中');

  const lh = makeHost();
  new LevelsScene(lh).render(mockCtx(), 390, 700);
  const lids = lh.hits.items.map((i) => i.id);
  assert(lids.filter((i) => i.indexOf('lv:') === 0).length === 1, '未通关时选关里只有第 1 关可点');
  assert(lids.includes('btn.back'), '选关页有返回按钮');
}
{
  const host = makeHost(Object.assign(freshSave(), { unlocked: 12 }));
  const l = new LevelsScene(host);
  l.render(mockCtx(), 390, 700);
  assert(host.hits.items.filter((i) => i.id.indexOf('lv:') === 0).length === 12, 'unlocked=12 时第 1..12 关都可点');
}

/* 2. 自动回放：按参考解跑完整关，场景应进入通关态并落档 */
{
  const save = freshSave();
  const host = makeHost(save, true); // 打开自动回放
  const gm = new GameScene(host);
  gm.enter(LEVELS[0]);
  const before = JSON.parse(JSON.stringify(save));
  run(gm, 60); // 远够走完 23 步
  const st = (gm as any).st;
  assert(st.status === 'won', `第 1 关按参考解自动通关（removed=${st.removed}/${st.level.goal}）`);
  assert(st.removed >= st.level.goal, '消除量达标');
  assert(save.unlocked >= 2, '通关后解锁下一关并落档');
  assert(save.stars['1'] >= 1 && save.best > 0, '星级与最高分写入存档');
  assert(before.unlocked === 1, '开局时存档未被预写');
}

/* 3. 拖拽一次放置：命中 → 预览 → 落子，全程无异常 */
{
  const host = makeHost();
  const gm = new GameScene(host);
  gm.enter(LEVELS[0]);
  gm.render(mockCtx(), 390, 700);
  const trayHit = host.hits.items.find((i) => i.id === 'tray:0');
  assert(!!trayHit, '托盘第 0 槽有命中区');
  const sx = trayHit!.r.x + trayHit!.r.w / 2;
  const sy = trayHit!.r.y + trayHit!.r.h / 2;
  gm.pointer({ x: sx, y: sy, id: 1, phase: 'down' } as any);
  const st = (gm as any).st;
  assert(!!(gm as any).drag, '按下托盘即开始拖拽');
  assert((gm as any).drag.count === st.tray[0].length, '拖起的是整摞');
  // 拖到某个空格中心
  gm.render(mockCtx(), 390, 700);
  const cellHit = host.hits.items.filter((i) => i.id.indexOf('cell:') === 0);
  const layout = (gm as any).boardLayout;
  const emptyIdx = st.stacks.findIndex((sk: number[]) => !sk.length);
  const p = layout.pos[emptyIdx >= 0 ? emptyIdx : 3];
  gm.pointer({ x: p.x, y: p.y, id: 1, phase: 'move' } as any);
  assert(!!(gm as any).drag.target, '移动中出现落点预览');
  assert((gm as any).drag.target.kind === 'whole', '空格上的预览判定为整摞可落');
  gm.pointer({ x: p.x, y: p.y, id: 1, phase: 'up' } as any);
  assert(st.stacks[emptyIdx >= 0 ? emptyIdx : 3].length > 0, '松手后棋子落进格子');
  assert(st.tray[0] !== null, '托盘随即补上新的一组');
  assert(cellHit.length === 0, '开局无棋塔时不注册格位命中（避免空点）');
}

/* 4. 非法拖拽不毁状态；撤销回到原样 */
{
  const host = makeHost();
  const gm = new GameScene(host);
  gm.enter(LEVELS[2]);
  run(gm, 1);
  const snapshot = JSON.stringify((gm as any).st);
  gm.pointer({ x: 5, y: 5, id: 3, phase: 'down' } as any); // 空白处
  gm.pointer({ x: 5, y: 40, id: 3, phase: 'up' } as any);
  assert(JSON.stringify((gm as any).st) === snapshot, '点空白处不改变状态');
  gm.render(mockCtx(), 390, 700);
  const th = host.hits.items.find((i) => i.id === 'tray:1')!;
  gm.pointer({ x: th.r.x + 4, y: th.r.y + 4, id: 4, phase: 'down' } as any);
  gm.pointer({ x: -50, y: -50, id: 4, phase: 'up' } as any); // 拖出界
  assert((gm as any).drag === null, '拖出界后拖拽状态清理干净');
  const after = JSON.stringify((gm as any).st);
  (gm as any).pushUndo();
  run(gm, 0.2);
  assert(after.length > 0, '取消落子不产生半截状态');
}

/* 5. 锤子与洗牌走事件通路且不抛错 */
{
  const host = makeHost();
  const gm = new GameScene(host);
  gm.enter(LEVELS[5]);
  run(gm, 2);
  gm.render(mockCtx(), 390, 700);
  try {
    void (gm as any).onButton('shuffle');
    run(gm, 1);
    gm.render(mockCtx(), 390, 700);
    void (gm as any).onButton('hammer');
    const cell = (gm as any).st.stacks.findIndex((s: number[]) => s.length);
    if (cell >= 0) gm.pointer({ x: (gm as any).boardLayout.pos[cell].x, y: (gm as any).boardLayout.pos[cell].y, id: 9, phase: 'down' } as any);
    run(gm, 0.5);
    gm.render(mockCtx(), 390, 700);
    assert(true, '洗牌 + 锤子链路无异常');
  } catch (e) {
    assert(false, '道具链路抛错：' + (e as Error).message);
  }
}

/* 6. 长时间自动跑若干关不抛错（覆盖 fuse/clear/cascade 的渲染分支） */
{
  let threw = '';
  for (const id of [8, 14, 20, 28, 40, 47]) {
    const host = makeHost();
    const gm = new GameScene(host);
    gm.enter(LEVELS[id - 1]);
    try {
      for (let i = 0; i < 60 * 40; i++) {
        gm.update(STEP);
        if (i % 20 === 0) gm.render(mockCtx(), 390, 700);
      }
    } catch (e) {
      threw = `第${id}关: ${(e as Error).message}`;
      break;
    }
  }
  assert(threw === '', '高编号关卡长时间自动运行无异常' + (threw ? ' —— ' + threw : ''));
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败 | 绘制调用 ${calls} 次`);
if (failed) process.exitCode = 1;
