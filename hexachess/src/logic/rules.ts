// 规则唯一真源。生成器、求解器、提示、渲染、单测全部只调用这里，
// 因此「预览说能放」与「实际能不能放」不可能不一致（现版 board.ts:782 的假提示由此根除）。
//
// 规则口径（方案 §1，B1/B2 合并成一条更一般的转移规则）：
//   A) PLACE：组 g → 空且未锁未阻挡的格，|g| < CAP
//   B) MOVE(a → 邻格 b)：top(a)==top(b) ∧ pure(b) ∧ |b| < CAP
//        t = min(topRun(a), CAP-|b|)，把 a 顶的 t 个子移到 b（a 保留余子、保序）
//        —— pure(a) 且放得下时 t=|a|，退化为「整摞合并」
//   C) resolve：从被触碰的格子出发，同色纯塔自动融合；任何 |s| ≥ CAP 的栈消除 CAP 个
//   D) removed ≥ goal 胜；无可行动作 / 供应不足 / 超时 负
import {
  CAP, Color, GameState, LossKind, TRAY_SLOTS, isPure, refillTray, topColor, topRun,
} from './state';
import { rand, randInt } from '../core/rng';

export type Ev =
  | { k: 'place'; cell: number; color: Color; count: number }
  | { k: 'move'; from: number; to: number; color: Color; count: number; whole: boolean }
  | { k: 'fuse'; from: number; to: number; color: Color; count: number }
  | { k: 'clear'; cell: number; color: Color; count: number; chain: number }
  | { k: 'bounce'; cell: number; reason: string }
  | { k: 'obstacle'; from: number; to: number }
  | { k: 'refill' }
  | { k: 'win' }
  | { k: 'lose'; why: LossKind };

export type Plan =
  | { k: 'whole'; count: number } // 整摞合并
  | { k: 'part'; count: number } // 只能部分转移
  | null;

// ── 格子是否可接收放置 ───────────────────────────────────────
export function receivable(st: GameState, cell: number): boolean {
  if (cell < 0 || cell >= st.stacks.length) return false;
  return st.stacks[cell].length === 0 && !st.locked[cell] && !st.obstacle[cell];
}

// ── B) 棋盘到棋盘的转移计划；null = 非法 ──────────────────────
export function movePlan(st: GameState, from: number, to: number): Plan {
  if (from === to) return null;
  if (from < 0 || to < 0 || from >= st.stacks.length || to >= st.stacks.length) return null;
  const a = st.stacks[from];
  const b = st.stacks[to];
  if (!a.length || !b.length) return null;
  if (st.locked[to] || st.obstacle[to] || st.locked[from] || st.obstacle[from]) return null;
  if (st.nbrs[from].indexOf(to) < 0) return null;
  const c = topColor(a);
  if (c !== topColor(b)) return null;
  if (!isPure(b)) return null; // 目的地必须是纯塔，否则合并语义未定义
  const room = CAP - b.length;
  if (room <= 0) return null;
  const t = Math.min(topRun(a), room);
  if (t <= 0) return null;
  return { k: isPure(a) && t === a.length ? 'whole' : 'part', count: t };
}

// ── A) 托盘组能否放到该格 ────────────────────────────────────
export function placePlan(st: GameState, trayIdx: number, cell: number): Plan {
  const g = st.tray[trayIdx];
  if (!g || !g.length) return null;
  if (g.length >= CAP) return null; // 守住「满 CAP 必为纯栈」不变式
  if (!receivable(st, cell)) return null;
  return { k: 'whole', count: g.length };
}

function takeTop(src: Color[], n: number): Color[] {
  return src.splice(src.length - n, n);
}

// ── 从一次触碰出发的自动结算：融合 + 消除，直到不动点 ─────────
// 收敛性：每步要么消掉 CAP 个子（总子数严格下降），要么把一个非空纯塔并入邻塔
// （非空格数严格下降），两者都不可逆，故循环必然在有限步内停止。
export function resolve(st: GameState, seeds: number[], out: Ev[] = []): Ev[] {
  const work = new Set<number>(seeds);
  let guard = st.cells.length * st.cells.length + 16; // 宽松上界，仅作保险

  while (work.size || hasOverflow(st)) {
    if (guard-- <= 0) break;
    if (!work.size) {
      for (let i = 0; i < st.cells.length; i++) if (st.stacks[i].length >= CAP) work.add(i);
    }
    const cell = Math.min(...work);
    work.delete(cell);
    const s = st.stacks[cell];

    // 1) 满 CAP → 消除（不变式保证此时该栈必为纯栈）
    if (s.length >= CAP) {
      const c = topColor(s);
      const n = Math.min(s.length, CAP);
      s.splice(s.length - n, n);
      st.removed += n;
      st.removedByColor[c] += n;
      st.chain += 1;
      out.push({ k: 'clear', cell, color: c, count: n, chain: st.chain });
      work.add(cell);
      for (const nb of st.nbrs[cell]) work.add(nb);
      continue;
    }

    // 2) 同色纯塔自动融合（只融合纯塔，混色塔不动，玩家才有可读的连锁）
    if (s.length && isPure(s)) {
      const c = topColor(s);
      for (const nb of st.nbrs[cell]) {
        const o = st.stacks[nb];
        if (!o.length || !isPure(o) || topColor(o) !== c) continue;
        if (o.length + s.length > CAP) continue;
        const moved = o.slice();
        st.stacks[nb] = [];
        for (const m of moved) s.push(m);
        out.push({ k: 'fuse', from: nb, to: cell, color: c, count: moved.length });
        work.add(nb);
        work.add(cell);
        for (const n2 of st.nbrs[nb]) work.add(n2);
        break;
      }
    }

    // 3) 本格稳定后，邻居里可能有新的满 CAP 或可融合对象
    for (const nb of st.nbrs[cell]) if (st.stacks[nb].length >= CAP) work.add(nb);
  }
  return out;
}

function hasOverflow(st: GameState): boolean {
  for (const s of st.stacks) if (s.length >= CAP) return true;
  return false;
}

// ── 玩家动作：PLACE ─────────────────────────────────────────
export function applyPlace(st: GameState, trayIdx: number, cell: number): Ev[] {
  const out: Ev[] = [];
  if (!placePlan(st, trayIdx, cell)) {
    out.push({ k: 'bounce', cell, reason: 'place' });
    return out;
  }
  const g = st.tray[trayIdx]!;
  st.stacks[cell] = g.slice();
  st.tray[trayIdx] = null;
  st.steps += 1;
  st.chain = 0;
  out.push({ k: 'place', cell, color: topColor(g), count: g.length });
  refillTray(st);
  out.push({ k: 'refill' });
  resolve(st, [cell], out);
  settle(st, out);
  return out;
}

// ── 玩家动作：MOVE ──────────────────────────────────────────
export function applyMove(st: GameState, from: number, to: number): Ev[] {
  const out: Ev[] = [];
  const plan = movePlan(st, from, to);
  if (!plan) {
    out.push({ k: 'bounce', cell: to, reason: 'move' });
    return out;
  }
  const moved = takeTop(st.stacks[from], plan.count);
  st.stacks[to].push(...moved);
  st.steps += 1;
  st.chain = 0;
  out.push({
    k: 'move', from, to, color: moved[0], count: moved.length, whole: plan.k === 'whole',
  });
  resolve(st, [to, from], out);
  settle(st, out);
  return out;
}

// ── 胜负结算（resolve 之后调用）─────────────────────────────
function settle(st: GameState, out: Ev[]): void {
  if (st.status !== 'playing') return;
  if (st.removed >= st.level.goal) {
    st.status = 'won';
    out.push({ k: 'win' });
    return;
  }
  const why = loseReason(st);
  if (why) {
    st.status = 'lost';
    st.loss = why;
    out.push({ k: 'lose', why });
  }
}

export function loseReason(st: GameState): LossKind | null {
  if (st.level.timeLimit > 0 && st.clock >= st.level.timeLimit) return 'timeout';
  // 供应不足：把盘面、托盘、队列里所有子加进来也凑不满目标
  let pool = 0;
  for (const s of st.stacks) pool += s.length;
  for (const g of st.tray) if (g) pool += g.length;
  for (const g of st.supply) pool += g.length;
  const need = st.level.goal - st.removed;
  if (!st.level.refill && pool < need) return 'supply';
  if (!hasAnyAction(st)) return 'noaction';
  return null;
}

// 是否存在任何合法动作（精确判定，供失败检测与提示复用）
export function hasAnyAction(st: GameState): boolean {
  for (let i = 0; i < TRAY_SLOTS; i++) {
    if (!st.tray[i]) continue;
    for (let c = 0; c < st.cells.length; c++) if (receivable(st, c)) return true;
  }
  for (let a = 0; a < st.cells.length; a++) {
    if (!st.stacks[a].length) continue;
    for (const b of st.nbrs[a]) if (movePlan(st, a, b)) return true;
  }
  return false;
}

// ── 道具 ───────────────────────────────────────────────────
export function useHammer(st: GameState, cell: number): Ev[] {
  const out: Ev[] = [];
  const s = st.stacks[cell];
  if (!s.length || st.items.hammer <= 0) {
    out.push({ k: 'bounce', cell, reason: 'hammer' });
    return out;
  }
  st.items.hammer -= 1;
  st.used.hammer += 1;
  const c = s.pop()!;
  st.removed += 1;
  st.removedByColor[c] += 1;
  out.push({ k: 'clear', cell, color: c, count: 1, chain: 0 });
  resolve(st, [cell], out);
  settle(st, out);
  return out;
}

// 重排：把盘面上所有子打散，重新填回同样的栈高分布（同 rng ⇒ 可 undo）
export function useShuffle(st: GameState): Ev[] {
  const out: Ev[] = [];
  if (st.items.shuffle <= 0) return out;
  st.items.shuffle -= 1;
  st.used.shuffle += 1;
  const cellsWith: number[] = [];
  const bag: Color[] = [];
  st.stacks.forEach((s, i) => {
    if (s.length) {
      cellsWith.push(i);
      bag.push(...s);
    }
  });
  for (let i = bag.length - 1; i > 0; i--) {
    const j = randInt(st, i + 1);
    const t = bag[i];
    bag[i] = bag[j];
    bag[j] = t;
  }
  let p = 0;
  for (const c of cellsWith) {
    const h = st.stacks[c].length;
    st.stacks[c] = bag.slice(p, p + h);
    p += h;
  }
  refillTray(st);
  out.push({ k: 'refill' });
  resolve(st, cellsWith, out);
  settle(st, out);
  return out;
}

// 补一次托盘（场景在托盘全空时调用）
export function drawTray(st: GameState): Ev[] {
  const before = st.tray.filter(Boolean).length;
  refillTray(st);
  return st.tray.filter(Boolean).length > before ? [{ k: 'refill' }] : [];
}

// ── 每帧推进：倒计时与移动障碍 ───────────────────────────────
export function advance(st: GameState, dt: number): Ev[] {
  const out: Ev[] = [];
  if (st.status !== 'playing') return out;
  st.clock += dt;
  const lv = st.level;
  if (lv.timeLimit > 0 && st.clock >= lv.timeLimit) {
    settle(st, out);
    return out;
  }
  if (lv.obstacles > 0) {
    st.obstTimer -= dt;
    if (st.obstTimer <= 0) {
      st.obstTimer = 8;
      for (let i = 0; i < st.obstPos.length; i++) {
        const from = st.obstPos[i];
        const cand = st.nbrs[from].filter(
          (n) => !st.obstacle[n] && !st.locked[n] && st.stacks[n].length === 0,
        );
        if (!cand.length) continue; // 无路可走就留在原地，绝不压住棋子
        const to = cand[randInt(st, cand.length)];
        st.obstacle[from] = 0;
        st.obstacle[to] = 1;
        st.obstPos[i] = to;
        out.push({ k: 'obstacle', from, to });
      }
      // 障碍可能封住唯一出路 → 重新判定失败
      settle(st, out);
    }
  }
  return out;
}

export { isPure, topColor, topRun, CAP };
