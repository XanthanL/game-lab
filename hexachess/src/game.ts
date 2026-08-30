import { Platform } from './platform/types';
import { Board } from './entities/board';
import { createNoopAudio } from './platform/audio';

// 共享启动逻辑：设置画布 → 建棋盘 → 绑定输入 → 跑主循环。
// 微信小游戏入口(main.ts)与浏览器入口(web.ts)都调用它。
export function runGame(platform: Platform): void {
  const canvas = platform.getCanvas();
  const ctx = canvas.getContext('2d');
  const screen = platform.getScreenSize();

  // ── 像素管线 ──────────────────────────────────────────────
  // 所有绘制先以 1/PIXEL 缩放落到低分辨率离屏缓冲（逻辑坐标不变），
  // 再以最近邻(NN)放大铺回屏幕——矢量/渐变/文字统一呈现硬边像素块，
  // 字体配等宽栈即得像素字。PIXEL=2 兼顾像素感与中文可读性。
  const PIXEL = 2;
  const W = Math.round(screen.width);
  const H = Math.round(screen.height);
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const bw = Math.ceil(W / PIXEL);
  const bh = Math.ceil(H / PIXEL);
  const buffer = platform.createCanvas(bw, bh);
  const bctx = buffer.getContext('2d');

  const board = new Board(W, H);
  board.attachStorage(
    (k) => platform.storageGet(k),
    (k, v) => platform.storageSet(k, v),
  );
  board.loadSave();
  board.attachAudio(platform.audio ?? createNoopAudio());

  // 变现与留存装配（缺失则自动跳过，不影响玩法）
  const SHOW_BANNER = false; // 横幅需预留底部空间且流量主开通后填 AD_UNIT.banner 再开
  const INTERSTITIAL_EVERY = 3; // 每 3 关展示一次插屏（避免过频）

  if (platform.share) {
    platform.share.enableShare({ title: '六边智将 · 益智解谜，来挑战你的脑力！', query: 'from=share' });
    board.onShare = () => platform.share?.share({ title: '六边智将 · 益智解谜，来挑战你的脑力！' });
  }
  if (platform.ads && SHOW_BANNER) platform.ads.showBanner();
  board.onLevelComplete = (lvl, _stars, score) => {
    platform.cloud?.submitScore(score, lvl);
    if (platform.ads && lvl % INTERSTITIAL_EVERY === 0) platform.ads.showInterstitial();
  };

  // 分享深链：从好友分享的 ?level=N 进入时直接定位关卡
  const lq = platform.launchQuery?.();
  if (lq && lq.level) board.gotoLevel(Number(lq.level));

  // 输入全部转发给棋盘：拖子 / 旋转棋盘 / 按钮由 Board 内部按落点分流
  platform.onPointerDown((p) => {
    platform.audio?.resume(); // 首次用户手势解锁音频上下文（移动端自动播放策略）
    board.pointerDown(p.x, p.y);
  });
  platform.onPointerMove((p) => board.pointerMove(p.x, p.y));
  platform.onPointerUp((p) => board.pointerUp(p.x, p.y));

  let last = Date.now();
  function frame(): void {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    board.update(dt);
    // 逻辑坐标 → 1/PIXEL 缓冲 → NN 放大上屏
    bctx.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    board.render(bctx);
    ctx.drawImage(buffer, 0, 0, bw, bh, 0, 0, bw * PIXEL, bh * PIXEL);
    platform.raf(frame);
  }
  platform.raf(frame);
  platform.log('六边智将 M3-K 已启动（像素管线 + 可旋转立体棋盘）');
}
