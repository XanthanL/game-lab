// 逻辑状态：纯数据，不含任何屏幕坐标 / 渲染字段 / 平台调用。
// 渲染层用 CellId（cells 数组下标）作为键来挂动画，反向不感知逻辑。
import { hexMap } from '../core/hex';
import { Rand, rand, randInt, seedOf } from '../core/rng';

export type Color = number; // 0..5，索引 core/colors.ts 的 PIECES
export const NCOLORS = 6;
export const CAP = 10; // 叠满 10 消除（招牌数字）
export const TRAY_SLOTS = 3;

// 规则版本：改了 rules.ts 必须 +1，关卡表带版本，不匹配即重新生成/校验
export const RULES_VERSION = 2;

export interface LevelDef {
  id: number;
  rulesVersion: number;
  seed: number;
  radius: number; // 1=7格 2=19格 3=37格 4=61格
  colors: number; // 本关启用的色数（前 colors 种颜色）
  goal: number; // 需要「消除的子数」
  groupMin: number;
  groupMax: number; // 约束：< CAP，保证「满 10 必为纯栈」不变式
  queueSize: number; // 备补队列长度上限（refill=false 时即总供应量）
  refill: boolean; // 队列是否无限回补（段 5 之后关闭，制造真实失败感）
  spawnBias: number; // 刷出「盘面急需色」的概率 0..1（收尾演出关调高）
  lockedCells: number;
  decoyChance: number; // 混入未启用色（诱饵）的概率
  timeLimit: number; // 0 = 无限
  obstacles: number; // 移动障碍个数
  par: number; // 生成期求解器给出的参考解步数（星级依据）
  winRate: number; // 生成期噪声贪心胜率（难度标定）
  // 参考解（编码后的动作序列）。随关卡入库后，「这关可解」可以在毫秒级回放验证，
  // 不必重跑搜索 —— 规则一改就能立刻测出哪些关被打坏了。
  solution: string[];
  tutorial: string[];
}

export type Status = 'playing' | 'won' | 'lost';
export type LossKind = 'noaction' | 'supply' | 'timeout';

export interface Counters {
  hint: number;
  shuffle: number;
  hammer: number;
  undo: number;
}

/** 道具余量：没有 undo 这一项，不要复用 Counters */
export interface ItemStock {
  hint: number;
  shuffle: number;
  hammer: number;
}

export interface GameState extends Rand {
  level: LevelDef;
  cells: { q: number; r: number }[];
  nbrs: number[][]; // CellId → 邻格 CellId 列表
  stacks: Color[][]; // CellId → 栈（底→顶）
  locked: Uint8Array; // 1 = 锁格，不可放置
  obstacle: Uint8Array; // 1 = 当前被移动障碍占据
  obstPos: number[]; // 每个障碍所在 CellId
  obstTimer: number; // 距下次移动的秒数
  tray: (Color[] | null)[]; // 3 个槽位，null = 空
  supply: Color[][]; // 待入槽的组队列
  removed: number; // 已消除子数
  score: number; // 累计得分（连击加成在 scorer 里算）
  removedByColor: number[]; // 6 个色的消除量（将杀判定用）
  steps: number; // 玩家主动作数（PLACE/MOVE，不含自动结算）
  clock: number;
  status: Status;
  loss: LossKind | null;
  used: Counters;
  items: ItemStock; // 剩余道具次数（看广告可解锁）
  chain: number; // 当前连击级数（供渲染与计分）
}

// 平顶 axial 六向邻接（与 core/hex.ts 的 hexToPixel 同一套坐标）
const DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function key(q: number, r: number): string {
  return q + ',' + r;
}

export function buildNeighbors(cells: { q: number; r: number }[]): number[][] {
  const idx = new Map<string, number>();
  cells.forEach((c, i) => idx.set(key(c.q, c.r), i));
  return cells.map((c) => {
    const out: number[] = [];
    for (const [dq, dr] of DIRS) {
      const n = idx.get(key(c.q + dq, c.r + dr));
      if (n !== undefined) out.push(n);
    }
    return out;
  });
}

export function totalPieces(st: GameState): number {
  let n = 0;
  for (const s of st.stacks) n += s.length;
  for (const g of st.tray) if (g) n += g.length;
  for (const g of st.supply) n += g.length;
  return n;
}

export function usedItems(st: GameState): number {
  return st.used.hint + st.used.shuffle + st.used.hammer + st.used.undo;
}

// ── 造子：spawnBias 概率刷出「盘面急需色」，其余均匀随机 ─────────
export function makeGroup(st: GameState, bias: number): Color[] {
  const lv = st.level;
  const size = lv.groupMin + randInt(st, Math.max(1, lv.groupMax - lv.groupMin + 1));
  const hot = neededColor(st);
  const out: Color[] = [];
  for (let i = 0; i < size; i++) {
    let c: Color;
    if (hot >= 0 && rand(st) < bias) c = hot;
    else c = randInt(st, lv.colors);
    // 诱饵：小概率混入本关未启用的色，制造整理成本
    if (lv.decoyChance > 0 && rand(st) < lv.decoyChance) {
      c = lv.colors + randInt(st, Math.max(1, NCOLORS - lv.colors));
      if (c >= NCOLORS) c = NCOLORS - 1;
    }
    out.push(c);
  }
  return out;
}

// 盘面上「最接近满 10 的纯栈」颜色；没有则 -1
export function neededColor(st: GameState): number {
  let best = -1;
  let bestScore = -1;
  for (const s of st.stacks) {
    if (!s.length || !isPure(s)) continue;
    const sc = s.length;
    if (sc > bestScore && CAP - sc >= 1) {
      bestScore = sc;
      best = s[s.length - 1];
    }
  }
  return best;
}

export function isPure(s: Color[]): boolean {
  if (s.length <= 1) return true;
  const c = s[0];
  for (let i = 1; i < s.length; i++) if (s[i] !== c) return false;
  return true;
}

export function topColor(s: Color[]): number {
  return s.length ? s[s.length - 1] : -1;
}

// 顶色连续段长度（部分转移只能搬走这一段）
export function topRun(s: Color[]): number {
  if (!s.length) return 0;
  const c = s[s.length - 1];
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === c; i--) n++;
  return n;
}

function refillTray(st: GameState): void {
  for (let i = 0; i < TRAY_SLOTS; i++) {
    if (st.tray[i]) continue;
    if (st.supply.length) st.tray[i] = st.supply.shift()!;
    else if (st.level.refill) st.tray[i] = makeGroup(st, st.level.spawnBias);
    else break;
  }
}

// 由关卡定义构造一局可玩状态。同 seed 必然同题。
export function createGame(level: LevelDef): GameState {
  const cells = hexMap(level.radius);
  const st: GameState = {
    rng: seedOf(level.seed),
    level,
    cells,
    nbrs: buildNeighbors(cells),
    stacks: cells.map(() => []),
    locked: new Uint8Array(cells.length),
    obstacle: new Uint8Array(cells.length),
    obstPos: [],
    obstTimer: 8,
    tray: [null, null, null],
    supply: [],
    removed: 0,
    score: 0,
    removedByColor: new Array(NCOLORS).fill(0),
    steps: 0,
    clock: 0,
    status: 'playing',
    loss: null,
    used: { hint: 0, shuffle: 0, hammer: 0, undo: 0 },
    items: { hint: 3, shuffle: 2, hammer: 2 },
    chain: 0,
  };

  // 锁格：从靠外的格子挑（中心留给玩家）
  const order = cells.map((_, i) => i).filter((i) => i > Math.min(4, cells.length >> 2));
  for (let k = 0; k < level.lockedCells && order.length; k++) {
    const j = randInt(st, order.length);
    st.locked[order[j]] = 1;
    order.splice(j, 1);
  }
  // 移动障碍：先落在锁格之外的格子
  const free = cells.map((_, i) => i).filter((i) => !st.locked[i]);
  for (let k = 0; k < level.obstacles && free.length; k++) {
    const j = randInt(st, free.length);
    const c = free.splice(j, 1)[0];
    st.obstPos.push(c);
    st.obstacle[c] = 1;
  }
  // 供应队列
  for (let i = 0; i < level.queueSize; i++) st.supply.push(makeGroup(st, level.spawnBias));
  for (let i = 0; i < TRAY_SLOTS; i++) st.tray[i] = makeGroup(st, level.spawnBias);
  if (!level.refill) {
    // 有限供应：队列长度即总量，扣掉已在托盘里的
    st.supply.length = Math.max(0, level.queueSize - TRAY_SLOTS);
  }
  return st;
}

export { refillTray };

// 深拷贝（供 undo 快照）：structuredClone 覆盖 TypedArray，语义精确
export function clone(st: GameState): GameState {
  return structuredClone(st);
}

export function supplyLeft(st: GameState): number {
  return st.supply.length + (st.level.refill ? Infinity : 0);
}
