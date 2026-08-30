// 关卡生成：一次 rollout 获胜本身就是「可解性证明」（它给出真实动作序列），
// 而同批 rollout 的获胜率正好是难度指标 —— 一个机制同时交付 witness 与标定，
// 因此不需要 beam search，也不需要 reverse-play 逆操作。
import { LevelDef, createGame } from './state';
import { Action, actions, applyAction, encodePath, evaluate, replay } from './solver';
import { randInt, seedOf } from '../core/rng';

export type LevelParams = Omit<LevelDef, 'par' | 'winRate' | 'solution'>;

export interface Generated {
  level: LevelDef;
  ok: boolean;
  why?: string;
}

export interface Rollout {
  won: boolean;
  steps: number;
  path: Action[];
}

function rngOf(seed: number): () => number {
  const box = { rng: seedOf(seed) };
  return () => randInt(box, 1e9) / 1e9;
}

// 噪声贪心：每步随机抽 k 个合法动作、克隆试探后取估值最高者执行
export function rollout(level: LevelDef, noiseSeed: number, k = 3, maxSteps = 400): Rollout {
  const st = createGame({ ...level, seed: (level.seed ^ noiseSeed) >>> 0 });
  const rng = rngOf(level.seed + noiseSeed * 2654435761);
  const path: Action[] = [];
  for (let step = 0; step < maxSteps && st.status === 'playing'; step++) {
    const all = actions(st);
    if (!all.length) break;
    let best: Action | null = null;
    let bestVal = -Infinity;
    for (let c = 0; c < k; c++) {
      const a = all[Math.floor(rng() * all.length) % all.length];
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
    path.push(best);
  }
  return { won: st.status === 'won', steps: st.steps, path };
}

export function rollouts(level: LevelDef, trials: number, k = 3, maxSteps = 400): Rollout[] {
  const out: Rollout[] = [];
  for (let t = 0; t < trials; t++) out.push(rollout(level, t * 0x9e3779b9, k, maxSteps));
  return out;
}

// 难度带是**软偏好**，可解性才是硬门槛：先保证能拿出可回放的获胜解法，
// 再在有限次尝试里挑最贴近带宽中点的种子。否则生成器会为凑带值扫遍所有种子（实测单关十几秒）。
export function findDeal(
  params: LevelParams,
  band: [number, number],
  opts: { seeds?: number[]; trials?: number; k?: number } = {},
): Generated {
  const trials = opts.trials ?? 6;
  const LOOKAHEAD = 4; // 找到可解种子后，最多再看几个种子去撞带值
  const trySeeds = opts.seeds || Array.from({ length: 14 }, (_, i) => params.id * 1000 + i);
  const mid = (band[0] + band[1]) / 2;
  let fallback: Generated | null = null;
  let sinceFallback = 0;

  for (const seed of trySeeds) {
    const level: LevelDef = { ...params, seed, par: 0, winRate: 0, solution: [] };
    const rs = rollouts(level, trials, opts.k ?? 3, stepsFor(params.goal));
    const wins = rs.filter((r) => r.won);
    if (!wins.length) continue;
    const wr = wins.length / rs.length;
    const best = wins.reduce((a, b) => (b.steps < a.steps ? b : a));
    const chk = replay(level, best.path); // 二次确认：解法可回放且真通关
    if (!chk.won) continue;
    const cand: Generated = {
      level: { ...level, par: chk.steps, winRate: wr, solution: encodePath(best.path) },
      ok: true,
    };
    if (wr >= band[0] && wr <= band[1]) return cand;
    if (!fallback || Math.abs(wr - mid) < Math.abs(fallback.level.winRate - mid)) {
      fallback = cand;
      sinceFallback = 0;
    } else if (++sinceFallback > LOOKAHEAD) {
      break;
    }
  }
  if (fallback) return fallback;
  return {
    level: { ...params, seed: trySeeds[0], par: 0, winRate: 0, solution: [] } as LevelDef,
    ok: false,
    why: 'no-seed',
  };
}

// rollout 步数上限按目标量收紧：失败通常很早就看得出来，不必跑满 400 步
function stepsFor(goal: number): number {
  return Math.min(360, 60 + Math.round(goal * 1.6));
}

// goal 必须保持 CAP 的倍数：消除以 10 子为单位
function roundGoal(g: number): number {
  return Math.max(10, Math.round(g / 10) * 10);
}

// 放宽阶梯：先提 spawnBias，再降 goal，最后减锁格与诱饵
export function findDealAdaptive(params: LevelParams, band: [number, number]): Generated {
  const base = { ...params, par: 0, winRate: 0, solution: [] } as LevelDef;
  const tweaks: Array<(p: LevelDef) => LevelDef> = [
    (p) => p,
    (p) => ({ ...p, spawnBias: Math.min(0.92, p.spawnBias + 0.25) }),
    (p) => ({ ...p, spawnBias: 0.9, goal: roundGoal(p.goal * 0.8) }),
    (p) => ({
      ...p,
      spawnBias: 0.92,
      goal: roundGoal(p.goal * 0.65),
      lockedCells: Math.max(0, p.lockedCells - 2),
      decoyChance: 0,
      timeLimit: 0,
    }),
  ];
  let last: Generated | null = null;
  for (const t of tweaks) {
    last = findDeal(t(base) as LevelParams, band);
    if (last.ok) return last;
  }
  return last || { level: base, ok: false, why: 'ladder-exhausted' };
}
