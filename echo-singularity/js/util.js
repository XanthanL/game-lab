;(function () {
'use strict';
/* ============================================================================
   util.js —— 数学 / 随机 / 缓动
   ----------------------------------------------------------------------------
   随机源必须**全部**走 RNG 实例（种子化），禁止直接用 Math.random，
   否则种子回放 / 幽灵回响 / 分享码会失真。
   ========================================================================== */

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
/* 指数趋近：帧率无关的平滑（比 lerp(a,b,0.1) 稳） */
function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

function fmt(n) {
  n = Math.round(n);
  if (n < 10000) return String(n);
  if (n < 100000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n / 1000) + 'k';
}
/* 秒 → mm:ss */
function mmss(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/* ── 种子化随机（mulberry32） ─────────────────────────────────────────── */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function RNG(seed) {
  if (!(this instanceof RNG)) return new RNG(seed);
  this.seed0 = (typeof seed === 'number') ? (seed >>> 0) : hashStr(seed);
  this.s = this.seed0 || 1;
}
RNG.prototype.next = function () {
  this.s = (this.s + 0x6D2B79F5) >>> 0;
  let t = this.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
RNG.prototype.chance = function (p) { return this.next() < p; };
RNG.prototype.reset = function (seed) {
  this.seed0 = (typeof seed === 'number') ? (seed >>> 0) : hashStr(seed);
  this.s = this.seed0 || 1;
};
/* 洗牌（Fisher–Yates，原地） */
RNG.prototype.shuffle = function (arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(this.next() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

/* 随机种子串（用于「随机开局」生成可分享的种子） */
function randomSeedStr() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 去掉易混的 I/O/0/1
  let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

module.exports = {
  TAU: TAU,
  clamp: clamp, lerp: lerp, damp: damp,
  dist: dist, dist2: dist2, angleLerp: angleLerp,
  fmt: fmt, mmss: mmss,
  hashStr: hashStr, RNG: RNG, randomSeedStr: randomSeedStr,
};
})();
