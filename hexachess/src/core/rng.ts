// 确定性随机：状态即种子游标，可随 GameState 一起快照，
// 因此 undo 与「同 seed 重开同一题」都是精确成立的。

export interface Rand {
  rng: number;
}

export function seedOf(n: number): number {
  // 把关卡 id 混成离散度更好的起点，避免相邻种子首值相关
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32：一步即推进 st.rng，返回 [0,1)
export function rand(st: Rand): number {
  st.rng = (st.rng + 0x6d2b79f5) | 0;
  let t = st.rng;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(st: Rand, n: number): number {
  return Math.floor(rand(st) * n);
}

export function pick<T>(st: Rand, arr: T[]): T {
  return arr[randInt(st, arr.length)];
}
