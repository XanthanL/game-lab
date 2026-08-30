// 关卡回归：回放每关入库的参考解。
// 这条测试的意义是「规则一旦改动，立刻知道哪些关被打坏」，且只需毫秒级。
import { LEVELS, TOTAL_LEVELS, isUnlocked, segmentOf } from '../src/data/levels';
import { CAP, RULES_VERSION, createGame } from '../src/logic/state';
import { decodePath, replay } from '../src/logic/solver';
import { starsOf } from '../src/logic/scorer';
import { findHint } from '../src/logic/hint';
import { actions, applyAction, evaluate } from '../src/logic/solver';
import { hasAnyAction } from '../src/logic/rules';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) passed++;
  else {
    failed++;
    console.error('  ✗', msg);
  }
}

const t0 = Date.now();
console.log('— 六边智将 v2 关卡表回归（回放参考解）—');

assert(TOTAL_LEVELS === 54, '共 54 关');
assert(new Set(LEVELS.map((l) => l.id)).size === TOTAL_LEVELS, '关卡 id 唯一');
assert(LEVELS.every((l) => l.rulesVersion === RULES_VERSION), '全部关卡的 rulesVersion 与当前规则一致');
assert(LEVELS.every((l) => l.goal % CAP === 0), 'goal 全为 10 的倍数（消除以 10 子为单位）');
assert(LEVELS.every((l) => l.groupMax < CAP), 'groupMax < CAP ⇒ 「满 10 必为纯塔」不变式成立');
assert(LEVELS.every((l) => l.colors >= 3 && l.colors <= 6), '色数在 3..6');
assert(LEVELS.every((l) => l.radius >= 1 && l.radius <= 4), '棋盘半径在 1..4');
assert(LEVELS.every((l) => l.par > 0 && l.solution.length === l.par), 'par 与参考解长度一致');
assert(LEVELS.every((l) => new Set(LEVELS.map((x) => x.seed)).size === TOTAL_LEVELS), '每关种子唯一（同 seed 同题）');

// 单调性：段内允许回弹（锯齿），但每段的平均目标量必须单调不降
const goals = LEVELS.map((l) => l.goal);
assert(goals[53] > goals[0], '末关目标高于首关');
const segAvg = [0, 1, 2, 3, 4, 5, 6].map((si) => {
  const ids = LEVELS.filter((l) => segmentOf(l.id).index === si);
  return ids.reduce((s, l) => s + l.goal, 0) / Math.max(1, ids.length);
});
assert(
  segAvg.every((v, i) => i === 0 || v >= segAvg[i - 1] - 1e-6),
  '段平均目标量单调不降：' + segAvg.map((v) => Math.round(v)).join(' → '),
);

// 逐关回放参考解
let worst = 0;
for (const lv of LEVELS) {
  const path = decodePath(lv.solution);
  const r = replay(lv, path);
  assert(r.won, `第 ${lv.id} 关参考解可通关（goal=${lv.goal}）`);
  assert(r.removed >= lv.goal, `第 ${lv.id} 关消除量达标 ${r.removed}/${lv.goal}`);
  assert(r.steps === lv.par, `第 ${lv.id} 关步数与 par 一致`);
  worst = Math.max(worst, r.removed - lv.goal);
}

// 参考解走完后按「0 道具」应得满星（par 就是解法长度）
{
  const lv = LEVELS[10];
  const st = createGame(lv);
  for (const a of decodePath(lv.solution)) {
    if (st.status !== 'playing') break;
    applyAction(st, a);
  }
  assert(starsOf(st) === 3, '按参考解 0 道具通关 ⇒ 3★');
}

// 提示永不给出非法动作；无路可走时如实返回 none
{
  let bad = 0;
  let noneMismatch = 0;
  for (const lv of LEVELS.slice(0, 12)) {
    const st = createGame(lv);
    for (let i = 0; i < 12 && st.status === 'playing'; i++) {
      const h = findHint(st, { nodeCap: 400, beam: 12, depth: 12 });
      if (h.action) {
        const legal = actions(st).some(
          (a) => JSON.stringify(a) === JSON.stringify(h.action),
        );
        if (!legal) bad++;
      } else if (hasAnyAction(st)) noneMismatch++;
      applyAction(st, h.action || actions(st)[0]);
    }
  }
  assert(bad === 0, '提示动作全部合法（修掉现版假提示）');
  assert(noneMismatch === 0, '提示说"无路"时确实无路');
}

// 进度门禁
assert(isUnlocked(1, 1) && isUnlocked(1, 2) === false, '未通关时第 2 关锁住');
assert(isUnlocked(5, 5) && isUnlocked(5, 6) === false, '解锁到第 5 关时第 6 关仍锁');
assert(segmentOf(1).index === 0 && segmentOf(54).index === 6, '分段归属正确');

const ms = Date.now() - t0;
console.log(`\n结果: ${passed} 通过, ${failed} 失败 | 用时 ${(ms / 1000).toFixed(2)}s | 最大超额消除 ${worst}`);
assert(ms < 10000, '关卡回归在 10s 预算内');
if (failed) process.exitCode = 1;
