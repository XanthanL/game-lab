// 求解器：束搜索（beam search）。找到解 ⇒ 该关**确实可解**（解法本身即 witness），
// 因此生成期用它做可解性证明与 par（参考步数），运行期复用同一套枚举做「真提示」。
//
// 与方案 §2 的一处实现变更：不再单独实现 reverse-play 生成器。
// 理由：有了真实求解器之后，「正向搜索找到解」与「倒推生成」提供的是**同等强度**的
// 可解性保证（都是 witness），但少一整套逆操作与逆元正确性负担；生成期只需在
// 拒绝率高时调节 deal 参数（spawnBias / colors / goal）而非构造逆操作。
import { CAP, GameState, LevelDef, createGame, isPure, topColor } from './state';
import { applyMove, applyPlace, movePlan, placePlan, receivable } from './rules';

export type Action =
  | { k: 'place'; tray: number; cell: number }
  | { k: 'move'; from: number; to: number };

export interface SolveOpts {
  beam?: number; // 每层保留的状态数
  maxSteps?: number; // 最大步数
  nodeCap?: number; // 展开节点上限
}

// ── 枚举合法动作（对 PLACE 做剪枝）──────────────────────────
// 剪枝口径：只考虑「与已占格相邻」的空格 —— 合并与消除都需要相邻，孤立放置
// 除了开局播种之外没有意义。注意这让枚举**不完备**，但方向是安全的：
// 搜到解 ⇒ 一定可解；搜不到只说明"本求解器没找到"，会被当成不可解而重发牌。
export function actions(st: GameState): Action[] {
  const out: Action[] = [];
  const occupied = st.stacks.map((s) => s.length > 0);
  let anyOccupied = occupied.some(Boolean);

  // 托盘组：内容相同的槽位只枚举一次
  const seen = new Set<string>();
  for (let i = 0; i < st.tray.length; i++) {
    const g = st.tray[i];
    if (!g || !g.length) continue;
    const sig = g.join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    let hot = 0;
    for (let c = 0; c < st.cells.length; c++) {
      if (!receivable(st, c)) continue;
      if (anyOccupied && !st.nbrs[c].some((n) => occupied[n])) continue;
      out.push({ k: 'place', tray: i, cell: c });
      hot++;
    }
    if (!anyOccupied && hot === 0) {
      // 空盘开局：取中心格播种
      out.push({ k: 'place', tray: i, cell: 0 });
    }
  }
  for (let a = 0; a < st.cells.length; a++) {
    if (!st.stacks[a].length) continue;
    for (const b of st.nbrs[a]) if (movePlan(st, a, b)) out.push({ k: 'move', from: a, to: b });
  }
  return out;
}

export function applyAction(st: GameState, a: Action): void {
  if (a.k === 'place') applyPlace(st, a.tray, a.cell);
  else applyMove(st, a.from, a.to);
}

// ── 估值：越大越好。核心是「把同色纯塔推向 10」，占用格只计很轻的成本 ──
// 旧式给占用格 -2.2/格，导致策略宁可空着也不建塔（建塔必然占格），连教学关都走不通。
export function evaluate(st: GameState): number {
  let v = st.removed * 100;
  let occ = 0;
  for (const s of st.stacks) {
    if (!s.length) continue;
    occ++;
    if (isPure(s)) {
      const h = s.length;
      v += h * 14; // 建塔本身就是收益
      if (h >= 7) v += (h - 6) * 40; // 冲刺段：越接近 10 越值得
      if (h === CAP) v += 500;
    } else {
      v -= topColor(s) >= 0 ? s.length * 3 : 0; // 混塔是死重，但顶色仍可外运，罚得轻
    }
  }
  v -= occ * 1.2;
  // 注意：不要惩罚「剩余供应量」——那会诱导策略把组乱丢，在有限供应关直接做死自己
  v -= st.tray.filter(Boolean).length * 0.4;
  v -= st.steps * 0.05;
  return v;
}

export function snapshot(st: GameState): string {
  const s: string[] = [];
  for (let i = 0; i < st.stacks.length; i++) {
    const t = st.stacks[i];
    s.push(t.length ? String.fromCharCode(48 + t.length) + String.fromCharCode(65 + topColor(t)) : '.');
  }
  // 只记「顶色 + 高度」做近似去重；同签名不同内部结构的局面视为等价（可接受的近似）
  const tray = st.tray.map((g) => (g ? g.length + ':' + topColor(g) : '-')).join('|');
  return s.join('') + '#' + tray + '#' + st.removed;
}

interface Node {
  st: GameState;
  path: Action[];
}

// ── 束搜索：返回一条把 removed 推到 goal 的动作序列，或 null ────
export function solve(st0: GameState, opts: SolveOpts = {}): Action[] | null {
  const beam = opts.beam ?? 240;
  const maxSteps = opts.maxSteps ?? 400;
  const nodeCap = opts.nodeCap ?? 60000;
  let expanded = 0;
  let frontier: Node[] = [{ st: st0, path: [] }];
  const seen = new Set<string>([snapshot(st0)]);

  for (let depth = 0; depth < maxSteps; depth++) {
    const next: Node[] = [];
    for (const n of frontier) {
      if (n.st.status === 'won') return n.path;
      for (const a of actions(n.st)) {
        if (++expanded > nodeCap) return null;
        const st = structuredClone(n.st);
        applyAction(st, a);
        if (st.status === 'lost') continue;
        const sig = snapshot(st);
        if (seen.has(sig)) continue;
        seen.add(sig);
        next.push({ st, path: n.path.concat([a]) });
      }
    }
    if (!next.length) return null;
    next.sort((x, y) => evaluate(y.st) - evaluate(x.st));
    frontier = next.slice(0, beam);
    if (seen.size > nodeCap * 3) seen.clear(); // 近似去重表防爆
  }
  return frontier.find((n) => n.st.status === 'won')?.path ?? null;
}

// 从关卡定义直接求解（生成期与单测用）
export function solveLevel(level: LevelDef, opts?: SolveOpts): Action[] | null {
  return solve(createGame(level), opts);
}

// 贪心走子：每步取估值最高的动作（比完整求解便宜得多，用于 winRate 标定）
export function playGreedy(st: GameState, maxSteps = 500): GameState {
  for (let i = 0; i < maxSteps && st.status === 'playing'; i++) {
    const acts = actions(st);
    if (!acts.length) break;
    let best: Action | null = null;
    let bestVal = -Infinity;
    for (const a of acts) {
      const probe = structuredClone(st);
      applyAction(probe, a);
      const v = evaluate(probe) + (probe.status === 'won' ? 1e6 : 0);
      if (v > bestVal) {
        bestVal = v;
        best = a;
      }
    }
    if (!best) break;
    applyAction(st, best);
  }
  return st;
}

// 随机走子（带种子，可复现）
export function playRandom(st: GameState, rng: () => number, maxSteps = 500): GameState {
  for (let i = 0; i < maxSteps && st.status === 'playing'; i++) {
    const acts = actions(st);
    if (!acts.length) break;
    applyAction(st, acts[Math.floor(rng() * acts.length) % acts.length]);
  }
  return st;
}

// 动作编码：'p<tray>:<cell>' 放置 / 'm<from>><to>' 棋盘内转移。
// 参考解以字符串数组形式随关卡入库，测试可直接回放验证可解性。
export function encodeAction(a: Action): string {
  return a.k === 'place' ? 'p' + a.tray + ':' + a.cell : 'm' + a.from + '>' + a.to;
}

export function decodeAction(s: string): Action {
  if (s[0] === 'p') {
    const [t, c] = s.slice(1).split(':');
    return { k: 'place', tray: Number(t), cell: Number(c) };
  }
  const [f, to] = s.slice(1).split('>');
  return { k: 'move', from: Number(f), to: Number(to) };
}

export const encodePath = (path: Action[]): string[] => path.map(encodeAction);
export const decodePath = (s: string[]): Action[] => s.map(decodeAction);

// 回放一条解法，用于证明「这关按此走法确实通关」
export interface Replay {
  won: boolean;
  removed: number;
  steps: number;
}

export function replay(level: LevelDef, path: Action[]): Replay {
  const st = createGame(level);
  for (const a of path) {
    if (st.status !== 'playing') break;
    applyAction(st, a);
  }
  return { won: st.status === 'won', removed: st.removed, steps: st.steps };
}
