// 真提示：与玩家、求解器、渲染预览共用同一套合法性判定（rules.ts），
// 因此不可能再出现现版那种「提示指向一个不会合并的格子」（board.ts:782）。
import { GameState } from './state';
import { Action, actions, applyAction, evaluate, solve } from './solver';

export type HintReason = 'solved' | 'bestEffort' | 'none';

export interface Hint {
  action: Action | null;
  reason: HintReason;
}

interface Budget {
  nodeCap: number; // 搜索节点上限
  beam: number;
  depth: number;
}

const TIGHT: Budget = { nodeCap: 3000, beam: 48, depth: 60 };

// 一层前瞻里估值最高的动作（永不失败，作为搜索超预算时的退路）
function argmaxOnePly(st: GameState): Action | null {
  let best: Action | null = null;
  let bestVal = -Infinity;
  for (const a of actions(st)) {
    const probe = structuredClone(st);
    applyAction(probe, a);
    if (probe.status === 'lost') continue;
    const v = evaluate(probe) + (probe.status === 'won' ? 1e6 : 0);
    if (v > bestVal) {
      bestVal = v;
      best = a;
    }
  }
  return best;
}

export function findHint(st: GameState, budget: Budget = TIGHT): Hint {
  if (st.status !== 'playing') return { action: null, reason: 'none' };
  const path = solve(st, { beam: budget.beam, maxSteps: budget.depth, nodeCap: budget.nodeCap });
  if (path && path.length) return { action: path[0], reason: 'solved' };
  const one = argmaxOnePly(st);
  if (one) return { action: one, reason: 'bestEffort' };
  return { action: null, reason: 'none' }; // 确实无路可走：如实告知
}
