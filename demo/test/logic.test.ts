import { Board } from '../src/entities/board';
import { PIECES } from '../src/core/colors';
import { levels } from '../src/data/levels';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

function fresh(): Board {
  const b = new Board(390, 700);
  b.buildLevel(1);
  b.update(1);
  return b;
}

function setGroup(b: Board, idx: number, color: string): void {
  const type = PIECES.find((p) => p.color === color)!.type;
  b.groups[idx].tiles = [{ color, type }];
}

// 把"某个格"换算成屏幕坐标后松手（棋盘有俯角压缩+旋转，落点须经过视角变换）
function dropAt(b: Board, cell: any): void {
  const s = b.boardToScreen(cell.x, cell.y);
  b.pointerUp(s.x, s.y);
}

// 取某格的相邻格（用 hexDistance）
function hexDistance(a: any, b: any): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

console.log('— 六边智将 逻辑冒烟测试（M3-K：顶层同色合并+整摞迁移+像素管线+旋转视角）—');

// 1. 调色板
assert(PIECES.length === 6, '6 种棋子');
const colorSet = new Set(PIECES.map((p) => p.color));
assert(colorSet.size === 6, '6 种颜色互不相同');

// 2. 关卡配置：3 组堆叠 + boardRadius + 目标消除
assert(levels.length === 50, '生成 50 关');
assert(levels[0].boardRadius === 2, '第 1 关 boardRadius=2（19 格）');
assert(levels[0].tutorial.includes('dragToEmpty'), '第 1 关含新手引导 dragToEmpty');
assert(levels[0].traySlots === 3, '托盘固定 3 组堆叠');
assert(levels.every((l) => l.groupMin >= 3 && l.groupMax >= l.groupMin), '每组棋子数 groupMin..groupMax 合理');
assert(levels[5].boardRadius === 3, '第 6 关起 boardRadius=3（37 格）');
assert(levels[49].activeColors === 6, '第 50 关 6 色');
assert(levels.every((l) => l.eliminateAt === 10), '消除阈值恒为 10（招牌数字）');

// 3. 棋盘 = 空格子（无颜色预设）
const b = fresh();
assert(b.cells.length === 19, '第 1 关 19 个空格');
assert(b.cells.every((c) => c.stack.length === 0), '所有格子初始 stack=[]（无颜色预设）');
assert(b.groups.length === 3, '托盘初始 3 组');

// 4. 放置：拖入空格 → 格子 stack 变为 [tile]（整组落入）
const b2 = fresh();
const cell = b2.cells[0];
setGroup(b2, 0, PIECES[0].color);
const g0 = b2.groups[0];
b2.pointerDown(g0.x, g0.y);
dropAt(b2, cell);
assert(cell.stack.length === 1, '空格放入：stack=[tile]');
assert(cell.stack[0].color === PIECES[0].color, '放入颜色正确');

// 5. 拒绝：拖到已有棋子的格 → 不进入，回托盘
const b3 = fresh();
const c2 = b3.cells[0];
const c3 = b3.cells.find((c) => hexDistance(c, c2) === 1)!;
c2.stack = [{ color: PIECES[0].color, type: 'pawn' }];
setGroup(b3, 0, PIECES[0].color);
const gid = b3.groups[0].id;
b3.pointerDown(b3.groups[0].x, b3.groups[0].y);
dropAt(b3, c2);
assert(c2.stack.length === 1, '已有棋子的格拒绝叠加（stack 仍 1）');
assert(b3.groups.some((g) => g.id === gid), '拒绝后棋子回托盘');

// 6. 相邻同色 → 拖入空格触发连通合并（落点格为锚，邻居飞过来）
const b4 = fresh();
const a = b4.cells[0];
const nb = b4.cells.find((c) => hexDistance(c, a) === 1)!;
nb.stack = [{ color: PIECES[0].color, type: 'pawn' }];
setGroup(b4, 0, PIECES[0].color);
b4.pointerDown(b4.groups[0].x, b4.groups[0].y);
dropAt(b4, a);
assert(b4.mergeAnim !== null, '相邻同色触发合并动画');
assert(a.stack.length === 1, '落点格保留刚放入的 1 片');
assert(nb.stack.length === 0, '邻居格立即腾空（飞走中）');

// 7. 推进动画帧 → 邻居片飞入落点，叠成 2
const b5 = fresh();
const A = b5.cells[0];
const B = b5.cells.find((c) => hexDistance(c, A) === 1)!;
B.stack = [{ color: PIECES[0].color, type: 'pawn' }];
setGroup(b5, 0, PIECES[0].color);
b5.pointerDown(b5.groups[0].x, b5.groups[0].y);
dropAt(b5, A);
for (let i = 0; i < 40; i++) b5.update(0.05); // 2s
assert(b5.mergeAnim === null, '2s 后合并动画完成');
assert(A.stack.length === 2, '落点格叠成 2 片');
assert(B.stack.length === 0, '来源格已清空');

// 8. 累满 10 → 消除（连通分量：9+1）
const b6 = fresh();
const A2 = b6.cells[0];
const B2 = b6.cells.find((c) => hexDistance(c, A2) === 1)!;
for (let i = 0; i < 9; i++) A2.stack.push({ color: PIECES[0].color, type: 'pawn' });
B2.stack = [{ color: PIECES[0].color, type: 'pawn' }];
const A2idx = b6.cells.indexOf(A2);
b6.tryMergeFrom(A2idx);
const beforeCleared = b6.clearedTotal;
for (let i = 0; i < 60; i++) b6.update(0.05);
assert(b6.clearedTotal === beforeCleared + 1, '叠满 10 触发一次消除');

// 9. 满格 = 失败
const b7 = fresh();
b7.cells.forEach((c, i) => {
  c.stack = [{ color: PIECES[i % 3].color, type: PIECES[i % 3].type }];
});
(b7 as any).checkFail();
assert(b7.over === 'fail', '满格触发失败态');
assert((b7 as any).failButtons.length === 1, '失败遮罩有重开按钮');

// 10. 撤销
const b8 = fresh();
const C0 = b8.cells[0];
setGroup(b8, 0, PIECES[0].color);
b8.pointerDown(b8.groups[0].x, b8.groups[0].y);
b8.pointerUp(C0.x, C0.y);
assert(C0.stack.length === 1, '撤销前已放入');
(b8 as any).doUndo();
assert(C0.stack.length === 0, '撤销后格子为空');

// 11. 提示：高亮一个能触发合并的空格
const b9 = fresh();
const X = b9.cells[0];
const Y = b9.cells.find((c) => hexDistance(c, X) === 1)!;
X.stack = [{ color: PIECES[0].color, type: 'pawn' }];
setGroup(b9, 0, PIECES[0].color);
(b9 as any).doHint();
assert(b9.hint !== null, '提示高亮一个空格');

// 12. 洗牌 → 重排托盘颜色（保证不破坏已放子）
const bA = fresh();
const before = bA.groups.map((g) => g.tiles.map((t) => t.color).join(',')).join('|');
(bA as any).doShuffle();
assert(bA.rescuesUsed === 1, '洗牌计入救援');
assert(bA.groups.every((g) => g.tiles.every((t) => t.color)), '洗牌后所有托盘子仍有颜色');

// 13. 棋盘接受任意颜色（无颜色预设）：拖红色放入"绿色格"旁空格
const bB = fresh();
const Z = bB.cells[0];
setGroup(bB, 0, PIECES[0].color); // 红
bB.pointerDown(bB.groups[0].x, bB.groups[0].y);
dropAt(bB, Z);
assert(Z.stack[0].color === PIECES[0].color, '任意颜色都能放入空格（无颜色预设）');

// 14. 满格时既无空可放 → hasValidMove=false
const bC = fresh();
bC.cells.forEach((c) => { c.stack = [{ color: PIECES[0].color, type: 'pawn' }]; });
assert(!(bC as any).hasValidMove(), '满格时无可行步');

// 15. 三连同色（中间格 bridging 两侧）→ 全部连通合并成 1 摞
const bD = fresh();
const mid = bD.cells[0];
const nbs = bD.cells.filter((c) => hexDistance(c, mid) === 1);
const L = nbs[0]; const R = nbs[1];
L.stack = [{ color: PIECES[0].color, type: 'pawn' }];
R.stack = [{ color: PIECES[0].color, type: 'pawn' }];
setGroup(bD, 0, PIECES[0].color);
bD.pointerDown(bD.groups[0].x, bD.groups[0].y);
dropAt(bD, mid);
for (let i = 0; i < 40; i++) bD.update(0.05);
assert(mid.stack.length === 3, '三连同色合并成 1 摞（共 3 片）');
assert(L.stack.length === 0 && R.stack.length === 0, '两侧来源格均清空');

// 16. 混色组：整组（含异色）落入空格，渲染/逻辑不抛错
const bE = fresh();
const Z2 = bE.cells[0];
bE.groups[0].tiles = [
  { color: PIECES[0].color, type: 'pawn' },
  { color: PIECES[1].color, type: 'knight' },
  { color: PIECES[2].color, type: 'bishop' },
];
bE.pointerDown(bE.groups[0].x, bE.groups[0].y);
dropAt(bE, Z2);
assert(Z2.stack.length === 3, '混色组（3 异色）整组落入空格');
assert(Z2.stack[0].color === PIECES[0].color && Z2.stack[2].color === PIECES[2].color, '混色组颜色顺序保持');

// 17. render 全流程不抛错（mock ctx；含进阶机制关卡）
const mockCtx = makeMockCtx();
for (const lv of [1, 6, 8, 14, 21, 30, 31, 50]) {
  bB.buildLevel(lv); bB.update(0.5); bB.render(mockCtx);
}

// 18. 进阶机制解锁曲线（levels 数据）
assert(!levels[6].mechanics.includes('lockedCell'), '第 7 关无锁格');
assert(levels[7].mechanics.includes('lockedCell') && levels[7].lockedCells >= 2, '第 8 关起锁格');
assert(levels[13].mechanics.includes('decoy') && levels[13].decoyChance > 0, '第 14 关起诱饵子');
assert(levels[20].mechanics.includes('timed') && levels[20].timeLimit > 0, '第 21 关起限时');
assert(levels[30].mechanics.includes('movingObstacle') && levels[30].obstacles >= 1, '第 31 关起移动障碍');
assert(levels[49].obstacles === 2, '第 50 关 2 个移动障碍');
assert(levels[40].decoyChance === 0, '第 41 关起 6 色全开，诱饵自动关闭');

// 19. 轴向坐标修复：中心格恰有 6 个真邻居；像素坐标/半径有限
const bF = fresh();
const ns = bF.getNeighbors(0); // hexMap 按距离升序，cells[0] 即中心
assert(ns.length === 6, '中心格恰有 6 个几何邻居（轴向坐标已修复）');
assert(ns.every((n) => hexDistance(n.cell, bF.cells[0]) === 1), '邻居距离均为 1');
assert(bF.cells.every((c) => Number.isFinite(c.x) && Number.isFinite(c.rad)), '格子像素坐标/半径有限（rad 已修复）');

// 20. 锁格：数量正确、拒绝放置、不算可放格
const bL = new Board(390, 700);
bL.buildLevel(8);
assert(bL.cells.filter((c) => c.locked).length === bL.cfg.lockedCells, '锁格数量与配置一致');
const lockCell = bL.cells.find((c) => c.locked)!;
const gidL = bL.groups[0].id;
bL.pointerDown(bL.groups[0].x, bL.groups[0].y);
dropAt(bL, lockCell);
assert(lockCell.stack.length === 0, '锁格拒绝放置');
assert(bL.groups.some((g) => g.id === gidL), '锁格拒绝后棋子回托盘');
const bL2 = new Board(390, 700);
bL2.buildLevel(8);
bL2.cells.forEach((c) => { if (!c.locked) c.stack = [{ color: PIECES[0].color, type: 'pawn' }]; });
(bL2 as any).checkFail();
assert(bL2.over === 'fail', '非锁格全满即失败（锁格不算可放格）');

// 21. 诱饵子：托盘能刷出场外色
const bD2 = new Board(390, 700);
bD2.buildLevel(14);
const activeCols = PIECES.slice(0, bD2.cfg.activeColors).map((p) => p.color);
const seen = new Set<string>();
for (let k = 0; k < 300; k++) {
  bD2.groups = [];
  (bD2 as any).refillGroups();
  for (const g of bD2.groups) for (const t of g.tiles) seen.add(t.color);
}
assert(Array.from(seen).some((c) => !activeCols.includes(c)), '托盘能刷出场外诱饵色');

// 22. 限时：倒计时归零 → 超时失败；合并动画期间暂停
const bT = new Board(390, 700);
bT.buildLevel(21);
assert(bT.timeLeft === bT.cfg.timeLimit && bT.cfg.timeLimit > 0, '限时关初始化倒计时');
for (let i = 0; i < 4000 && bT.over === 'none'; i++) bT.update(0.05);
assert(bT.over === 'fail' && bT.failReason === 'timeout', '倒计时归零 → 超时失败');
const bT2 = new Board(390, 700);
bT2.buildLevel(21);
bT2.update(1); // 让 3 组滑到各自托盘位（否则叠在出生点，pointerDown 会命中 groups[2]）
const A3 = bT2.cells[0];
const B3 = bT2.cells.find((c) => hexDistance(c, A3) === 1 && !c.locked)!;
B3.stack = [{ color: PIECES[0].color, type: 'pawn' }];
bT2.groups[0].tiles = [{ color: PIECES[0].color, type: 'pawn' }];
bT2.pointerDown(bT2.groups[0].x, bT2.groups[0].y);
dropAt(bT2, A3);
assert(bT2.mergeAnim !== null, '限时关也能正常触发合并');
const tBefore = bT2.timeLeft;
let guard = 0;
while (bT2.mergeAnim && guard++ < 100) bT2.update(0.05);
assert(bT2.timeLeft === tBefore, '合并动画期间倒计时暂停');

// 23. 移动障碍：出生驻留 → 遮挡格拒绝放置 → 周期换位
const bO = new Board(390, 700);
bO.buildLevel(31);
assert(bO.obstacles.length === bO.cfg.obstacles, '障碍数量与配置一致');
const ob0 = bO.obstacles[0];
for (let i = 0; i < 20; i++) bO.update(0.05); // 1s：in 完成，进入 stay
assert(ob0.phase === 'stay' && ob0.scale === 1, '障碍出生后进入驻留态');
const obCell = bO.cells[ob0.idx];
assert(bO.isBlocked(ob0.idx), '障碍所在格被遮挡');
const gidO = bO.groups[0].id;
bO.pointerDown(bO.groups[0].x, bO.groups[0].y);
dropAt(bO, obCell);
assert(obCell.stack.length === 0, '障碍格拒绝放置');
assert(bO.groups.some((g) => g.id === gidO), '障碍格拒绝后棋子回托盘');
const idxBefore = ob0.idx;
for (let i = 0; i < 160; i++) bO.update(0.05); // 8s > stay(4s)+out(0.35s)
assert(ob0.idx !== idxBefore, '障碍周期性换位');

// 24. 机制首次出现提示：弹一次 toast，之后进关不再弹
const bP = new Board(390, 700);
bP.buildLevel(8);
assert(bP.toast !== null && bP.toast.text.includes('锁格'), '锁格首次出现弹提示');
bP.buildLevel(9);
assert(bP.toast === null, '同一机制第二次进关不再提示');

// 25. M3-K 顶层规则：仅"最上层同色相邻"才合并（埋藏同色不算）
const bQ = fresh();
const A4 = bQ.cells[0];
const B4 = bQ.cells.find((c) => hexDistance(c, A4) === 1)!;
A4.stack = [{ color: PIECES[0].color, type: 'pawn' }];                 // 顶=红
B4.stack = [                                                            // 底红顶蓝
  { color: PIECES[0].color, type: 'pawn' },
  { color: PIECES[1].color, type: 'knight' },
];
bQ.tryMergeFrom(bQ.cells.indexOf(A4));
assert(bQ.mergeAnim === null, '顶层异色不合并（埋藏的红不算）');
assert(A4.stack.length === 1 && B4.stack.length === 2, '双方堆叠原样保持');

// 26. M3-K 整摞迁移：触发合并时来源格整摞（含埋藏色）飞叠到锚格，顺序保持
const bR = fresh();
const A5 = bR.cells[0];
const B5 = bR.cells.find((c) => hexDistance(c, A5) === 1)!;
A5.stack = [
  { color: PIECES[0].color, type: 'pawn' },
  { color: PIECES[0].color, type: 'pawn' },
];
B5.stack = [                                                            // 底蓝顶红
  { color: PIECES[1].color, type: 'knight' },
  { color: PIECES[0].color, type: 'pawn' },
];
bR.tryMergeFrom(bR.cells.indexOf(A5));
assert(bR.mergeAnim !== null, '顶层同色（红）触发合并');
assert(B5.stack.length === 0, '来源格整摞立即腾空（含埋藏色）');
for (let i = 0; i < 60; i++) bR.update(0.05);
assert(A5.stack.length === 4, '整摞一起飞叠：锚格 4 片');
assert(A5.stack[2].color === PIECES[1].color && A5.stack[3].color === PIECES[0].color, '埋藏色随行且顺序保持（…蓝红）');

// 27. M3-K 单格消除：某格内同色累计 ≥10 即消除（无需邻接）
const bS = fresh();
const A6 = bS.cells[3];
for (let i = 0; i < 10; i++) A6.stack.push({ color: PIECES[0].color, type: 'pawn' });
const beforeS = bS.clearedTotal;
bS.tryMergeFrom(3);
assert(bS.clearedTotal === beforeS + 1, '单格同色满 10 直接消除');
assert(A6.stack.length === 0, '消除后该格清空');

// 27b. 消除暴露埋藏色 → 触发连锁合并（顶层变化再结算）
const bS2 = fresh();
const A7 = bS2.cells[0];
const B7 = bS2.cells.find((c) => hexDistance(c, A7) === 1)!;
A7.stack = [];
for (let i = 0; i < 10; i++) A7.stack.push({ color: PIECES[0].color, type: 'pawn' }); // 10 红
A7.stack.push({ color: PIECES[1].color, type: 'knight' });                            // 顶蓝盖住 10 红
B7.stack = [{ color: PIECES[1].color, type: 'knight' }];                              // 顶蓝
bS2.tryMergeFrom(bS2.cells.indexOf(A7));
// 先整摞合并（顶蓝相邻）→ A7=10红+2蓝 → 红满 10 消除
for (let i = 0; i < 80; i++) bS2.update(0.05);
assert(bS2.clearedTotal === 1, '合并收拢后埋藏的红满 10 一并消除');
assert(A7.stack.every((t) => t.color !== PIECES[0].color), '红全部清掉');
assert(A7.stack.length === 2, '留下 2 片蓝');

// 28. M3-K 旋转视角：空白处拖动旋转；正逆变换互逆
const bV = fresh();
const angle0 = bV.viewAngle;
bV.pointerDown(195, 300);        // 空白处（非按钮、非托盘组）
bV.pointerMove(295, 300);        // +100px
assert(Math.abs(bV.viewAngle - angle0) > 0.05, '空白处横向拖动 → 棋盘旋转');
bV.pointerUp(295, 300);
const px = 123; const py = 234;
const bp = bV.screenToBoard(px, py);
const sp = bV.boardToScreen(bp.x, bp.y);
assert(Math.abs(sp.x - px) < 1e-6 && Math.abs(sp.y - py) < 1e-6, 'screenToBoard/boardToScreen 严格互逆');

// 29. M3-K 旋转后仍能准确放置（逆变换命中）
const bW = fresh();
bW.viewAngle = Math.PI / 2;      // 转 90°
let far = bW.cells[0]; let farD = -1;
for (const c of bW.cells) {
  const d = hexDistance(c, { q: 0, r: 0 });
  if (d > farD) { farD = d; far = c; }
}
setGroup(bW, 0, PIECES[0].color);
bW.pointerDown(bW.groups[0].x, bW.groups[0].y);
dropAt(bW, far);
assert(far.stack.length === 1 && far.stack[0].color === PIECES[0].color, '旋转 90° 后仍准确放入最远目标格');

// 29b. 拖动棋子时移动不旋转棋盘（互斥手势）
const bX = fresh();
const ax0 = bX.viewAngle;
setGroup(bX, 0, PIECES[0].color);
bX.pointerDown(bX.groups[0].x, bX.groups[0].y);
bX.pointerMove(bX.groups[0].x + 120, bX.groups[0].y);
assert(bX.viewAngle === ax0, '拖棋子时移动不旋转棋盘');
bX.pointerUp(50, 50);
assert(bX.groups.length === 3, '无效落点后棋子回托盘');

function makeMockCtx(): any {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'measureText') return () => ({ width: 10 });
      return (..._a: any[]) => {};
    },
    set() { return true; },
  });
}

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
if (failed > 0) process.exit(1);
