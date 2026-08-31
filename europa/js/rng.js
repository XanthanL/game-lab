// 确定性随机数：同一个 seed 必然生成同一张地图

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 —— 快、够随机、可复现 */
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
  const fn = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (lo, hi) => lo + fn() * (hi - lo);
  fn.int = (lo, hi) => Math.floor(lo + fn() * (hi - lo + 1));
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length)];
  fn.chance = (p) => fn() < p;
  fn.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(fn() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  /** 近似正态分布，clamp 到 [lo,hi] */
  fn.gauss = (mean = 0, sd = 1) => {
    let s = 0;
    for (let i = 0; i < 4; i++) s += fn();
    return mean + ((s / 4) - 0.5) * 3.4 * sd;
  };
  return fn;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
