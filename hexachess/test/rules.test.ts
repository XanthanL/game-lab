// 规则单测：只依赖 logic/，不碰渲染与平台。
// 重点是现版踩过的坑：9 摞补不满 10、级联不收敛、提示与真实合法性分叉、混色塔被乱吃。
import { CAP, GameState, LevelDef, createGame, usedItems } from '../src/logic/state';
import {
  advance, applyMove, applyPlace, hasAnyAction, loseReason, movePlan, placePlan, receivable,
  resolve, useHammer, useShuffle,
} from '../src/logic/rules';
import { isCheckmate, starsOf } from '../src/logic/scorer';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

const R = 0, G = 1, B = 2, K = 3; // 颜色索引

function lv(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 1, rulesVersion: 2, seed: 12345, radius: 1, colors: 3, goal: 20,
    groupMin: 2, groupMax: 5, queueSize: 9, refill: true, spawnBias: 0,
    lockedCells: 0, decoyChance: 0, timeLimit: 0, obstacles: 0,
    par: 10, winRate: 1, solution: [], tutorial: [], ...over,
  };
}

// 干净盘面：7 格（中心 0，外圈 1..6），栈与托盘由用例自己摆
function board(over: Partial<LevelDef> = {}): GameState {
  const s = createGame(lv(over));
  for (const st of s.stacks) st.length = 0;
  s.tray = [null, null, null];
  s.supply = [];
  s.removed = 0;
  s.steps = 0;
  return s;
}
const pure = (c: number, n: number) => new Array(n).fill(c);

console.log('— 六边智将 v2 规则单测 —');

// ── 1. 棋盘与邻接 ─────────────────────────────────────────
{
  const s = board();
  assert(s.cells.length === 7, 'radius=1 → 7 格');
  assert(s.nbrs[0].length === 6, '中心格有 6 个邻居');
  assert(s.nbrs[1].length === 3, '外圈格有 3 个邻居');
  assert(s.nbrs.every((n, i) => n.every((j) => s.nbrs[j].indexOf(i) >= 0)), '邻接关系对称');
}

// ── 2. PLACE 合法性 ───────────────────────────────────────
{
  const s = board();
  s.tray[0] = pure(R, 4);
  assert(!!placePlan(s, 0, 1), '托盘组可放入空格');
  applyPlace(s, 0, 1);
  assert(!placePlan(s, 0, 1) && s.stacks[1].length === 4, '已被自己占住的格不可再放');
  s.stacks[2] = pure(G, 1);
  assert(!placePlan(s, 0, 2), '拒绝放到已占格（现版死结的根源，必须由 MOVE 处理）');
  s.locked[3] = 1;
  assert(!placePlan(s, 0, 3), '拒绝锁格');
  s.obstacle[4] = 1;
  assert(!placePlan(s, 0, 4), '拒绝障碍格');
  s.tray[1] = pure(R, CAP);
  assert(!placePlan(s, 1, 5), '拒绝 |g| ≥ CAP 的组（守住「满 CAP 必为纯栈」不变式）');
  s.tray[2] = null; // applyPlace 会补满托盘，这里显式留一个空槽
  assert(!placePlan(s, 2, 6), '空槽位不可放');
}

// ── 3. MOVE：整摞合并与部分转移 ────────────────────────────
{
  // 9 + 1 = 10 —— 现版永远做不到的动作
  const s = board();
  s.stacks[0] = pure(R, 9);
  s.stacks[1] = pure(R, 1);
  const p = movePlan(s, 0, 1);
  assert(!!p && p.count === 9, '9 红并入 1 红：一次转移 9 子');
  const evs = applyMove(s, 0, 1);
  assert(s.removed === 10, '9+1 补满 10 → 消除 10 子');
  assert(s.stacks[0].length === 0 && s.stacks[1].length === 0, '消除后两格都空');
  assert(evs.some((e) => e.k === 'clear'), '产生 clear 事件');

  // 9 + 2 = 11 > CAP：只搬能装下的 8 个，源栈留 1
  const s2 = board();
  s2.stacks[0] = pure(R, 9);
  s2.stacks[1] = pure(R, 2);
  const p2 = movePlan(s2, 0, 1);
  assert(!!p2 && p2.count === 8, '9+2 溢出时只转移 8 个（不是整摞，也不是非法）');
  applyMove(s2, 0, 1);
  assert(s2.removed === 10 && s2.stacks[1].length === 0, '2+8=10 消除');
  assert(s2.stacks[0].length === 1, '源栈留下放不下的 1 子');
}

// ── 4. 混色栈：只搬顶色连续段，且余子保序 ─────────────────
{
  const s = board();
  s.stacks[0] = [B, G, R, R]; // topRun(R)=2
  s.stacks[1] = pure(R, 8);
  const p = movePlan(s, 0, 1);
  assert(!!p && p.count === 2 && p.k === 'part', '混色栈只转移顶色连续段（2 个红）');
  applyMove(s, 0, 1);
  assert(s.removed === 10, '8+2 补满消除');
  assert(s.stacks[0].length === 2 && s.stacks[0][0] === B && s.stacks[0][1] === G,
    '余子顺序保持 [蓝,绿]（埋藏色不被吞掉）');

  // 顶色不匹配 → 非法；埋藏同色不算数
  const s3 = board();
  s3.stacks[0] = [R, B];
  s3.stacks[1] = pure(R, 3);
  assert(!movePlan(s3, 0, 1), '顶色不同即非法，埋藏的红不参与');
}

// ── 5. 目的地必须是纯塔 ───────────────────────────────────
{
  const s = board();
  s.stacks[0] = pure(R, 3);
  s.stacks[1] = [G, R]; // 目的地是混塔，顶色虽同为红
  assert(!movePlan(s, 0, 1), '目的地为混塔即非法（纯塔也不能塞进去）');
  const s2 = board();
  s2.stacks[0] = [G, R];
  s2.stacks[1] = pure(R, 3);
  assert(!!movePlan(s2, 0, 1), '混色源 → 纯塔合法（部分转移）');
  const s3 = board();
  s3.stacks[0] = [G, R];
  s3.stacks[1] = [B, R]; // 目的地混色
  assert(!movePlan(s3, 0, 1), '目的地为混色塔时非法（合并语义未定义）');
}

// ── 6. 自动融合：只吃同色纯塔，且必须收敛 ─────────────────
{
  const s = board();
  s.stacks[0] = pure(R, 4);
  s.stacks[1] = pure(R, 3);
  s.stacks[2] = pure(R, 3); // 4+3=7 ≤10，先并 1；7+3=10 → 消除
  const evs = resolve(s, [0]);
  assert(s.stacks[0].length === 0 && s.removed === 10, '三座纯塔链式融合后满 10 消除');
  assert(evs.filter((e) => e.k === 'fuse').length >= 1, '产生 fuse 事件供渲染播放');

  const s2 = board();
  s2.stacks[0] = pure(R, 6);
  s2.stacks[1] = [G, R]; // 混色邻居不参与自动融合
  resolve(s2, [0]);
  assert(s2.stacks[1].length === 2 && s2.stacks[0].length === 6, '混色塔不会被自动吃掉');

  const s3 = board();
  for (let i = 0; i < 7; i++) s3.stacks[i] = pure(R, 1);
  resolve(s3, [0]);
  assert(s3.removed === 0 && s3.stacks[0].length === 7 && s3.stacks.every((x, i) => (i ? !x.length : true)),
    '7 座同色单子塔自动聚成一座 7 高塔；不足 10 故不消除');
}

// ── 7. 消除不变式：满 CAP 必为纯栈 ────────────────────────
{
  let ok = true;
  for (let seed = 1; seed <= 40; seed++) {
    const s = createGame(lv({ seed, radius: 2, goal: 999, timeLimit: 0 }));
    for (let step = 0; step < 400; step++) {
      // 走合法动作里任意一个
      const acts: any[] = [];
      for (let i = 0; i < 3; i++)
        for (let c = 0; c < s.cells.length; c++) if (placePlan(s, i, c)) acts.push(['p', i, c]);
      for (let a = 0; a < s.cells.length; a++)
        for (const b of s.nbrs[a]) if (movePlan(s, a, b)) acts.push(['m', a, b]);
      if (!acts.length) break;
      const pick = acts[(seed * 7919 + step * 104729) % acts.length];
      if (pick[0] === 'p') applyPlace(s, pick[1], pick[2]);
      else applyMove(s, pick[1], pick[2]);
      if (s.stacks.some((x) => x.length > CAP)) ok = false;
      // 任何达到 CAP 的瞬间都必须已被 resolve 消掉
      if (s.stacks.some((x) => x.length >= CAP)) ok = false;
      if (s.status !== 'playing') break;
    }
  }
  assert(ok, '40 个种子 × 随机合法走子：栈高从不越 CAP，且不存在残留的满 CAP 纯栈');
}

// ── 8. 判负三种情形 ───────────────────────────────────────
{
  // noaction：全盘无空格 + 每格都是混色塔（MOVE 要求目的地为纯塔 ⇒ 无合并可做）
  const s = board();
  s.level.goal = 999;
  for (let i = 0; i < 7; i++) s.stacks[i] = [i % 3, (i + 1) % 3];
  s.tray[0] = pure(R, 3);
  assert(!receivable(s, 0) && !hasAnyAction(s), '满盘且全是混色塔 → 无合法动作');
  assert(loseReason(s) === 'noaction', '判负原因 = noaction');

  // supply：有限供应且总量凑不满目标
  const s2 = board({ refill: false, goal: 999 });
  s2.stacks[0] = pure(R, 2);
  s2.tray[0] = pure(R, 2);
  assert(loseReason(s2) === 'supply', '供应不足 → 判负原因 = supply');

  // timeout
  const s3 = board({ timeLimit: 10 });
  s3.stacks[0] = pure(R, 1);
  const evs = advance(s3, 10.5);
  assert(s3.status === 'lost' && s3.loss === 'timeout', '超时 → 判负原因 = timeout');
  assert(evs.some((e) => e.k === 'lose' && e.why === 'timeout'), '产生 lose(timeout) 事件');
}

// ── 9. 移动障碍绝不压住棋子 ───────────────────────────────
{
  const s = board({ obstacles: 1 });
  s.stacks[2] = pure(R, 3);
  for (let i = 0; i < 200; i++) advance(s, 0.1);
  assert(s.obstPos.every((c) => s.stacks[c].length === 0 && !s.locked[c]),
    '200 次移动后障碍仍只占据空且未锁的格子');
}

// ── 10. 道具 ─────────────────────────────────────────────
{
  const s = board();
  s.stacks[0] = [G, R];
  useHammer(s, 0);
  assert(s.stacks[0].length === 1 && s.stacks[0][0] === G, '锤子敲掉栈顶 1 子，保序');
  assert(s.removed === 1 && s.used.hammer === 1 && s.items.hammer === 1, '锤子计数正确');
  const s2 = board();
  s2.stacks[0] = [R, G];
  s2.stacks[1] = [G, R];
  const before = JSON.stringify(s2.stacks.map((x) => x.slice()).sort());
  useShuffle(s2);
  const after = JSON.stringify(s2.stacks.map((x) => x.slice()).sort());
  assert(before === after, '洗牌保持每格栈高分布不变（只换颜色）');
}

// ── 11. 确定性与 undo ────────────────────────────────────
{
  const a = createGame(lv({ seed: 777 }));
  const b = createGame(lv({ seed: 777 }));
  assert(JSON.stringify(a) === JSON.stringify(b), '同 seed → 完全同一题（重开不换题）');
  const c = createGame(lv({ seed: 778 }));
  assert(JSON.stringify(a) !== JSON.stringify(c), '不同 seed → 题目不同');

  const snap = JSON.stringify(a);
  applyPlace(a, 0, 0);
  const restored: GameState = JSON.parse(snap);
  assert(restored.stacks[0].length === 0 && a.stacks[0].length > 0,
    '快照可回滚（undo 用 structuredClone/JSON 精确还原逻辑态）');
}

// ── 12. 星级与将杀 ───────────────────────────────────────
{
  const s = board({ goal: 10, par: 5 });
  s.status = 'won';
  s.steps = 5;
  assert(starsOf(s) === 3, 'steps ≤ ⌈1.2par⌉ 且 0 道具 → 3★');
  s.used.hint = 1;
  assert(starsOf(s) === 2, '用 1 次道具即封顶 2★（道具只按总数设限，语义明确）');
  s.used.hint = 0;
  s.steps = 9;
  assert(starsOf(s) === 2, 'steps ≤ ⌈1.8par⌉ → 2★');
  s.steps = 10;
  assert(starsOf(s) === 1, '超阈值 → 1★');

  const c6 = board({ colors: 6, goal: 60 });
  for (let i = 0; i < 6; i++) c6.removedByColor[i] = CAP;
  assert(isCheckmate(c6), '6 色各消满一组 → 将杀');
  const c5 = board({ colors: 5, goal: 60 });
  for (let i = 0; i < 6; i++) c5.removedByColor[i] = CAP;
  assert(!isCheckmate(c5), '本关未启用 6 色时不可能将杀（修掉「前 40 关永不触发」）');
  assert(usedItems(c6) === 0, '未用道具计数初始为 0');
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
if (failed) process.exitCode = 1;
