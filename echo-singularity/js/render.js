;(function () {
'use strict';
/* ============================================================================
   render.js —— 世界绘制
   ----------------------------------------------------------------------------
   绘制顺序（层叠是刻意排的，别随手换）：
     清屏 → 星空(过透镜) → 测绘网格 → 回响 → 奇点底层
     → 敌机 → 敌弹 → 我方弹 → 玩家(+尾流) → 粒子
     → 奇点面层(吸积盘/视界/光子环) → 摇杆
   奇点面层盖在实体之上，是因为视界必须"挡住"后面的东西 —— 玩家被吞进去时
   要看到自己的船被黑暗吃掉，这是「奇点」最直观的一帧。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const E = require('./entities.js');
const RG = require('./regions.js');
const Input = require('./input.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ── 尾流 ─────────────────────────────────────────────────────────────── */
function drawTrail(c, trail, tint) {
  const n = trail.length / 2;
  if (n < 2) return;
  c.save();
  c.lineCap = 'round';
  for (let i = 1; i < n; i++) {
    const t = i / n;                       // 0=最老 1=最新
    const x0 = trail[(i - 1) * 2], y0 = trail[(i - 1) * 2 + 1];
    const x1 = trail[i * 2], y1 = trail[i * 2 + 1];
    /* 三段色阶：宽晕 → 中层 → 白热芯，随船体配色（见 tokens HULL_TINT） */
    const g = tint.glow;
    c.strokeStyle = 'rgba(' + g[0] + ',' + g[1] + ',' + g[2] + ',' + (0.05 + 0.30 * t * t) + ')';
    c.lineWidth = 1 + 5.5 * t * t;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (t > 0.62) {
      c.strokeStyle = T.rgba('inkHi', 0.10 + 0.34 * (t - 0.62) / 0.38);
      c.lineWidth = 0.8 + 1.6 * t;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  c.restore();
}

/* ── 玩家 ─────────────────────────────────────────────────────────────── */
function drawPlayer(c, p, sing) {
  const tint = T.HULL_TINT[p.hullId] || T.HULL_TINT.peregrine;
  /* 无敌帧闪烁：用 8Hz 方波，别用正弦（正弦太柔和，看不出"暂时打不到"） */
  if (p.inv > 0 && Math.floor(p.inv * 16) % 2 === 0) return;

  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.ang);

  /* 尾焰：朝船尾(-x)喷，长度随速度 */
  const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const fl = 8 + clamp(sp / 170, 0, 1) * 16 + Math.sin(U.TAU * 8 * p.inv) * 0;
  const g = tint.glow;
  const fg = c.createLinearGradient(-8, 0, -8 - fl, 0);
  fg.addColorStop(0, 'rgba(' + g[0] + ',' + g[1] + ',' + g[2] + ',0.55)');
  fg.addColorStop(1, 'rgba(' + g[0] + ',' + g[1] + ',' + g[2] + ',0)');
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(-8, -3.2); c.lineTo(-8 - fl, 0); c.lineTo(-8, 3.2);
  c.closePath(); c.fill();

  /* 机身 */
  E.hullPath(c, p.hullId);
  c.fillStyle = tint.fill;
  c.fill();
  c.strokeStyle = tint.line;
  c.lineWidth = 1.5;
  c.stroke();

  /* 座舱 */
  c.fillStyle = T.rgba('cyanHi', 0.6);
  c.beginPath(); c.arc(2.5, 0, 1.9, 0, TAU); c.fill();

  /* 受击闪白 */
  if (p.hitFlash > 0) {
    E.hullPath(c, p.hullId);
    c.fillStyle = T.rgba('inkHi', clamp(p.hitFlash / 0.16, 0, 1) * 0.7);
    c.fill();
  }
  c.restore();

  /* 护盾环 */
  if (p.shield > 0) {
    c.save();
    c.strokeStyle = T.rgba('shieldB', 0.22 + 0.3 * (p.shield / Math.max(1, p.shieldMax)));
    c.lineWidth = 1.4;
    c.beginPath(); c.arc(p.x, p.y, p.r + 6, 0, TAU); c.stroke();
    c.restore();
  }
}

/* ── 粒子 ─────────────────────────────────────────────────────────────── */
function drawFX(c, fx) {
  const a = fx.a;
  for (let i = 0; i < fx.n; i++) {
    const p = a[i];
    if (!p.alive) continue;
    const t = p.life / p.max;
    c.fillStyle = T.rgba(p.col, clamp(t, 0, 1) * 0.9);
    c.beginPath(); c.arc(p.x, p.y, p.r * (0.4 + 0.6 * t), 0, TAU); c.fill();
  }
}

/* ── 波次横幅 ─────────────────────────────────────────────────────────── */
function drawBanner(c, b) {
  if (!b) return;
  const t = 1 - b.t / b.max;
  /* 进 0.18 / 出 0.30 的淡入淡出 */
  let a = 1;
  if (t < 0.18) a = t / 0.18;
  else if (t > 0.70) a = (1 - t) / 0.30;
  a = clamp(a, 0, 1);
  c.save();
  c.globalAlpha = a;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const y = AH * 0.30;
  c.fillStyle = T.rgba('voidDeep', 0.5);
  const w = 264, h = 46;
  c.fillRect((AW - w) / 2, y - h / 2, w, h);
  c.strokeStyle = T.rgba('line', 0.55);
  c.lineWidth = 1;
  c.strokeRect((AW - w) / 2, y - h / 2, w, h);
  c.fillStyle = T.rgba('inkHi', 1);
  c.font = T.font('lead', 'bold');
  c.fillText(b.zh, AW / 2, y - 6);
  c.fillStyle = T.rgba('steel', 1);
  c.font = T.font('tiny', 'regular');
  c.fillText(b.en, AW / 2, y + 12);
  c.restore();
}

/* ══════════════════════════════════════════════════════════════════════
   总入口
   ════════════════════════════════════════════════════════════════════ */
function drawWorld(c, cb, stars) {
  const p = cb.p;
  const reg = RG.regionOf(cb.wave);

  ARENA.clear(c, reg);
  stars.draw(c, cb.sing);
  ARENA.drawGrid(c, reg);
  cb.echo.draw(c, 1);

  /* 奇点底层（引力晕 / 作用圈） */
  cb.sing.drawBack(c);

  cb.en.draw(c);
  cb.eb.draw(c);
  cb.pb.draw(c);

  if (p.alive) {
    drawTrail(c, cb.trail, T.HULL_TINT[p.hullId] || T.HULL_TINT.peregrine);
    drawPlayer(c, p, cb.sing);
  }

  drawFX(c, cb.fx);

  /* 奇点面层盖在实体之上 —— 视界要能吃掉玩家和敌机 */
  cb.sing.drawFront(c);

  drawBanner(c, cb.banner);
  Input.drawStick(c);
}

module.exports = { drawWorld: drawWorld, drawPlayer: drawPlayer, drawBanner: drawBanner };
})();
