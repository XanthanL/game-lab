;(function () {
'use strict';
/* ============================================================================
   warp.js —— 穿越过场（扭曲特效）
   ----------------------------------------------------------------------------
   Canvas 2D 没有 shader，做不了真正的屏幕空间扭曲。这里用三件套堆出等价的
   观感，代价很低（每帧几十条线）：
     1) 隧道环：同心圆从中心向外冲 —— 这是「在管道里高速穿行」的主体
     2) 径向速度线：从中心发散的短线，越长越快
     3) 白闪 + 整体旋转与缩放 —— 掩盖换场，也给「被拉伸」的错觉
   曲线：0→0.42 吸入（世界淡出）· 0.42→0.58 白闪 · 0.58→1 吐出（世界淡入）
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

const DUR = 2.0;

function Warp(fromRegion, toRegion) {
  this.t = 0;
  this.dur = DUR;
  this.done = false;
  this.from = fromRegion || null;
  this.to = toRegion || null;
  this.rng = U.RNG('warp' + Math.floor(Math.random() * 1e9));
  this._lines = [];
  for (let i = 0; i < 44; i++) {
    this._lines.push({ a: (i / 44) * TAU, r0: 16 + this.rng.range(0, 70), len: this.rng.range(30, 90) });
  }
}
Warp.prototype.p = function () { return clamp(this.t / this.dur, 0, 1); };

Warp.prototype.update = function (dt) {
  this.t += dt;
  if (this.t >= this.dur) this.done = true;
  return this.done;
};

/* 世界的不透明度：中段全黑（换场就发生在这一瞬） */
Warp.prototype.worldAlpha = function () {
  const p = this.p();
  if (p < 0.42) return 1 - Math.pow(p / 0.42, 1.6);
  if (p < 0.58) return 0;
  return Math.pow((p - 0.58) / 0.42, 1.4);
};
/* 覆盖在世界上方的黑幕 */
Warp.prototype.veilAlpha = function () {
  const p = this.p();
  if (p < 0.42) return Math.pow(p / 0.42, 1.3) * 0.92;
  if (p < 0.58) return 0.92;
  return (1 - (p - 0.58) / 0.42) * 0.92;
};

Warp.prototype.draw = function (c) {
  const p = this.p();
  const cx = AW / 2, cy = AH / 2;
  const fade = (p < 0.42) ? p / 0.42 : (p < 0.58 ? 1 : 1 - (p - 0.58) / 0.42);
  const spin = (p - 0.5) * 1.1;
  const zoom = 1 + Math.sin(p * Math.PI) * 0.22;

  c.save();
  c.translate(cx, cy);
  c.rotate(spin);
  c.scale(zoom, zoom);
  c.translate(-cx, -cy);

  /* 1) 隧道环 */
  const N = 26;
  for (let i = 0; i < N; i++) {
    const ph = ((i / N) + this.t * 0.85) % 1;
    const r = 5 + ph * ph * AH * 0.95;
    const a = (1 - ph) * 0.6 * fade;
    c.strokeStyle = T.rgba('singCore', Math.max(0, a));
    c.lineWidth = 0.8 + (1 - ph) * 2.6;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  }
  /* 隧道环的暖色内衬（吸积盘的颜色被拖进来了） */
  for (let i = 0; i < 12; i++) {
    const ph = ((i / 12) + this.t * 1.35) % 1;
    const r = 5 + ph * ph * AH * 0.7;
    c.strokeStyle = T.rgba('singDisk', Math.max(0, (1 - ph) * 0.32 * fade));
    c.lineWidth = 1 + (1 - ph) * 3.2;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
  }

  /* 2) 径向速度线 */
  const spd = 1 + p * 4;
  for (let i = 0; i < this._lines.length; i++) {
    const L = this._lines[i];
    const r0 = L.r0 + ((this.t * 420 * spd) % (AH * 0.8));
    const r1 = r0 + L.len * spd * 0.5;
    const a = clamp(1 - r0 / (AH * 0.85), 0, 1) * 0.5 * fade;
    c.strokeStyle = T.rgba('inkHi', Math.max(0, a));
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(cx + Math.cos(L.a) * r0, cy + Math.sin(L.a) * r0);
    c.lineTo(cx + Math.cos(L.a) * r1, cy + Math.sin(L.a) * r1);
    c.stroke();
  }
  c.restore();

  /* 3) 白闪（换场就藏在这一帧） */
  let fl = 0;
  if (p >= 0.40 && p <= 0.60) fl = 1 - Math.abs(p - 0.5) / 0.10;
  if (fl > 0) {
    c.save();
    c.fillStyle = T.rgba('inkHi', clamp(fl, 0, 1) * 0.95);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  }

  /* 4) 换场提示（趁全黑时打出来） */
  if (this.to && p > 0.44 && p < 0.78) {
    const a = 1 - Math.abs(p - 0.61) / 0.17;
    c.save();
    c.globalAlpha = clamp(a, 0, 1);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = T.rgba('inkHi', 1);
    c.font = T.font('title', 'bold');
    c.fillText(this.to.zh, AW / 2, AH / 2 - 10);
    c.fillStyle = T.rgba('steel', 1);
    c.font = T.font('tiny', 'regular');
    c.fillText(this.to.en, AW / 2, AH / 2 + 12);
    c.restore();
  }
};

module.exports = { Warp: Warp, DUR: DUR };
})();
