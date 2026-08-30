// 计分与星级：全部是状态的纯函数（除 applyScore 累加 st.score）。
import { CAP, GameState, NCOLORS, usedItems } from './state';
import { Ev } from './rules';

export const CLEAR_BASE = 100; // 一次满 10 消除的基准分
export const HAMMER_PENALTY = 20;

// 连击级数来自 resolve() 里递增的 chain（同一次动作内连续消除）
export function chainMultiplier(chain: number): number {
  return 1 + 0.5 * Math.max(0, chain - 1);
}

export function applyScore(st: GameState, evs: Ev[]): number {
  let gained = 0;
  for (const e of evs) {
    if (e.k === 'clear') {
      gained += Math.round(CLEAR_BASE * (e.count / CAP) * chainMultiplier(e.chain));
    } else if (e.k === 'fuse') {
      gained += 5 * e.count; // 融合本身给小甜头，鼓励做长链
    }
  }
  st.score += gained;
  return gained;
}

// 星级：以生成期求解器给出的 par 为基准，道具总用量单独设限
export function starsOf(st: GameState): 0 | 1 | 2 | 3 {
  if (st.status !== 'won') return 0;
  const par = Math.max(1, st.level.par);
  const items = usedItems(st);
  if (st.steps <= Math.ceil(par * 1.2) && items === 0) return 3;
  if (st.steps <= Math.ceil(par * 1.8) && items <= 1) return 2;
  return 1;
}

// 将杀：六色各消满一组。仅在本关启用 6 色时才可能达成（现版前 40 关永不触发的修正）
export function isCheckmate(st: GameState): boolean {
  if (st.level.colors < NCOLORS) return false;
  for (let c = 0; c < NCOLORS; c++) if (st.removedByColor[c] < CAP) return false;
  return true;
}
