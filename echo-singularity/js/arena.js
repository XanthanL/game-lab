;(function () {
'use strict';
/* ============================================================================
   arena.js —— 战场尺寸 / 视口变换 / 星空
   ----------------------------------------------------------------------------
   手机屏幕比例五花八门（19.5:9 / 20:9 / 4:3 平板都有）。为了不让难度随设备漂移，
   战场**宽度固定 360 逻辑单位**，高度按屏幕比例换算并夹在 [600, 800] 之间。
   这样：
     · 横向永远是 360，弹幕密度 / 敌机体积 / 奇点半径全部可复现
     · 纵向略有差异，但只影响可视纵深，不影响平衡
   视口变换把 360×H 的世界等比铺满屏幕宽度并垂直居中。
   ========================================================================== */

const PAL = require('./pal.js');
const U = require('./util.js');
const T = require('./tokens.js');
const clamp = U.clamp, TAU = U.TAU;

const ARENA_W = 360;
const ARENA_H = clamp(Math.round(PAL.H * ARENA_W / PAL.W), 600, 800);

const View = {
  scale: PAL.W / ARENA_W,
  ox: 0,
  oy: 0,
};
View.h = ARENA_H;
/* 世界在屏幕上垂直居中；若屏幕比世界高，上下留出安全带 */
View.oy = Math.max(0, (PAL.H - ARENA_H * View.scale) / 2);
/* 世界单位 → 画布物理像素的总倍率（透镜采样要按物理像素抠图，才能 1:1 无损） */
View.totalScale = PAL.DPR * View.scale;
/* 世界坐标 → 画布物理像素 */
function toPx(x, y, out) {
  out = out || {};
  out.x = (x * View.scale + View.ox) * PAL.DPR;
  out.y = (y * View.scale + View.oy) * PAL.DPR;
  return out;
}

/* 屏幕坐标 → 世界坐标（输入用） */
function toWorld(sx, sy, out) {
  out = out || {};
  out.x = (sx - View.ox) / View.scale;
  out.y = (sy - View.oy) / View.scale;
  return out;
}

/* 把 ctx 变换到世界坐标系；之后所有绘制都用世界单位 */
function applyTransform(c) {
  c.setTransform(PAL.DPR, 0, 0, PAL.DPR, 0, 0);
  c.translate(View.ox, View.oy);
  c.scale(View.scale, View.scale);
}

/* ══════════════════════════════════════════════════════════════════════
   星空 —— 三层视差，且被引力透镜折弯
   ════════════════════════════════════════════════════════════════════ */
const STAR_N = [46, 34, 22];        // 远 / 中 / 近
const STAR_PAR = [0.10, 0.22, 0.42]; // 视差系数（相对玩家位移）
const STAR_R = [0.7, 1.0, 1.5];

function Starfield(rng) {
  this.rng = rng || U.RNG('void');
  this.layers = [];
  this.t = 0;
  this.camX = 0; this.camY = 0;
  this._p = { x: 0, y: 0, k: 0 };
  this.col = 'steel';      // 区域色调（setRegion 改）
  this.density = 1;
  this._build();
}
/* 换区域时重建：星色与星密度都跟着区域走 */
Starfield.prototype.setRegion = function (reg) {
  if (!reg) return;
  this.col = reg.star;
  this.density = reg.starMul;
  this._build();
};
Starfield.prototype._build = function () {
  this.layers = [];
  const r = this.rng;
  for (let L = 0; L < STAR_N.length; L++) {
    const n = Math.round(STAR_N[L] * this.density);
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        x: r.range(0, ARENA_W),
        y: r.range(0, ARENA_H),
        a: r.range(0.18, 0.75),
        tw: r.range(0, TAU),
      });
    }
    this.layers.push(arr);
  }
};

Starfield.prototype.update = function (dt, camX, camY) {
  this.t += dt;
  this.camX = camX || 0;
  this.camY = camY || 0;
};

/* 绘制。sing 为奇点（可为 null）—— 有奇点时星的位置先过一遍透镜。 */
Starfield.prototype.draw = function (c, sing) {
  const p = this._p;
  for (let L = 0; L < this.layers.length; L++) {
    const arr = this.layers[L];
    const px = -this.camX * STAR_PAR[L];
    const py = -this.camY * STAR_PAR[L];
    const rad = STAR_R[L];
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      let x = s.x + px, y = s.y + py;
      /* 环绕（用取模把出界的星拉回来，避免星空被"抽走"） */
      x = ((x % ARENA_W) + ARENA_W) % ARENA_W;
      y = ((y % ARENA_H) + ARENA_H) % ARENA_H;

      let alpha = s.a;
      if (sing) {
        sing.lens(x, y, p);
        x = p.x; y = p.y;
        /* 被折得越厉害的星越亮 —— 这是玩家察觉奇点存在的第一线索 */
        alpha = clamp(s.a + p.k * 0.55, 0, 1);
      }
      /* 闪烁 */
      alpha *= 0.82 + 0.18 * Math.sin(this.t * 1.7 + s.tw);
      c.fillStyle = T.rgba(L === 2 ? 'ink' : this.col, alpha);
      c.beginPath();
      c.arc(x, y, rad, 0, TAU);
      c.fill();
    }
  }
};

/* ── 背景测绘网格（极淡；颜色 / 间距 / 浓度都随区域变） ─────────────────── */
function drawGrid(c, reg) {
  c.save();
  const col = (reg && reg.grid) || 'line';
  const step = (reg && reg.gridStep) || 45;
  const a = (reg && reg.gridA) || 0.055;
  c.strokeStyle = T.rgba(col, a);
  c.lineWidth = 1;
  for (let x = step; x < ARENA_W; x += step) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, ARENA_H); c.stroke();
  }
  for (let y = step; y < ARENA_H; y += step) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(ARENA_W, y); c.stroke();
  }
  c.restore();
}

/* ── 清屏 + 底部渐晕（底色随区域） ─────────────────────────────────────── */
function clear(c, reg) {
  const base = (reg && reg.voidT) || 'void';
  const deep = (reg && reg.voidDeep) || 'voidDeep';
  c.save();
  c.fillStyle = T.hex(base);
  c.fillRect(0, 0, ARENA_W, ARENA_H);
  const g = c.createRadialGradient(
    ARENA_W / 2, ARENA_H / 2, Math.min(ARENA_W, ARENA_H) * 0.32,
    ARENA_W / 2, ARENA_H / 2, Math.max(ARENA_W, ARENA_H) * 0.72
  );
  g.addColorStop(0, T.rgba(deep, 0));
  g.addColorStop(1, T.rgba(deep, 0.85));
  c.fillStyle = g;
  c.fillRect(0, 0, ARENA_W, ARENA_H);
  c.restore();
}

module.exports = {
  ARENA_W: ARENA_W, ARENA_H: ARENA_H,
  View: View, toWorld: toWorld, toPx: toPx, applyTransform: applyTransform,
  Starfield: Starfield, drawGrid: drawGrid, clear: clear,
};
})();
