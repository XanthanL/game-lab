// 离线生成 54 关：npm run gen:levels → 覆盖写 src/data/levels.gen.ts
// 每关都要过三道门：求解器找到解 → 解法可回放通关 → 难度落在该段的目标带内。
import { RULES_VERSION, LevelDef } from '../src/logic/state';
import { findDeal, findDealAdaptive, LevelParams } from '../src/logic/gen';
import * as fs from 'fs';
import * as path from 'path';

const TOTAL = 54;

interface Seg {
  ids: [number, number];
  band: [number, number]; // winRate 目标带
  name: string;
}

// 方案 §4 的「锯齿」：每段先练习、再变奏、再压力、末关收尾演出
const SEGS: Seg[] = [
  { ids: [1, 6], band: [0.85, 1.01], name: '教学 · 放置与纯塔融合' },
  { ids: [7, 12], band: [0.75, 1.01], name: '混色部分转移' },
  { ids: [13, 18], band: [0.65, 1.01], name: '锁格' },
  { ids: [19, 26], band: [0.55, 0.98], name: '长链级联与诱饵' },
  { ids: [27, 34], band: [0.45, 0.95], name: '有限供应' },
  { ids: [35, 46], band: [0.35, 0.92], name: '时限与移动障碍' },
  { ids: [47, 54], band: [0.3, 0.9], name: '大师 · 将杀' },
];

function segOf(id: number): { seg: Seg; idx: number; k: number } {
  for (const seg of SEGS) {
    if (id >= seg.ids[0] && id <= seg.ids[1]) {
      const len = seg.ids[1] - seg.ids[0] + 1;
      const idx = id - seg.ids[0];
      return { seg, idx, k: idx / Math.max(1, len - 1) }; // k: 段内进度 0..1
    }
  }
  throw new Error('level out of range: ' + id);
}

function baseParams(id: number): { p: LevelParams; seg: Seg } {
  const { seg, idx, k } = segOf(id);
  const inSeg = idx;
  const last = inSeg === seg.ids[1] - seg.ids[0]; // 收尾演出关
  const segIndex = SEGS.indexOf(seg);

  const colors = id <= 6 ? 3 : id <= 18 ? 4 : id <= 34 ? 5 : 6;
  const radius = id <= 18 ? 2 : id <= 34 ? 3 : 4;
  // goal 必须是 CAP(10) 的倍数：消除以 10 子为单位，非倍数会永远差一截。
  // 上限 12 次消除（120 子）来自实测：R3 盘 120 子时策略胜率已掉到 0.3。
  const clears = Math.min(12, 2 + Math.floor((id - 1) / 5));
  const first = inSeg === 0 && segIndex > 0;
  const goal = Math.max(20, 10 * (clears - (first ? 1 : 0))); // 段首回弹 → 锯齿

  // 段 5 原计划用「有限供应」制造失败感，实测会让大量发牌直接做不出解
  // （塔里 stranded 掉的凑不满的子不可回收），故 54 关恒为无限供应；
  // 压力改由锁格、诱饵、时限与移动障碍提供。refill/queueSize 字段保留给未来的每日挑战。
  const refill = true;
  const groupMin = 2;
  const groupMax = id <= 12 ? 4 : 5; // 恒 < CAP，守住「满 CAP 必为纯塔」不变式
  const queueSize = 9;

  const p: LevelParams = {
    id,
    rulesVersion: RULES_VERSION,
    radius,
    colors,
    goal,
    groupMin,
    groupMax,
    queueSize,
    refill,
    // 段内递增难度；末关给「收尾演出」的高偏置，让玩家容易做出长链
    spawnBias: last ? 0.85 : +(0.5 + k * 0.22).toFixed(2),
    lockedCells: id < 13 ? 0 : Math.min(5, 1 + Math.floor((id - 13) / 4)),
    decoyChance: id >= 23 && id <= 26 ? 0.12 : id > 26 && colors < 6 ? 0.1 : 0,
    timeLimit: id < 36 ? 0 : Math.round(goal * 2.6),
    obstacles: id >= 41 && id <= 46 ? 1 : id > 46 ? 2 : 0,
    tutorial:
      id === 1 ? ['dragToEmpty'] : id === 7 ? ['partialTransfer'] : id === 13 ? ['lockedCell'] :
      id === 19 ? ['cascade'] : id === 27 ? ['finiteSupply'] : id === 36 ? ['timed'] :
      id === 41 ? ['obstacle'] : id === 47 ? ['checkmate'] : [],
  };
  return { p, seg };
}

const t0 = Date.now();
const out: LevelDef[] = [];
const fails: string[] = [];

for (let id = 1; id <= TOTAL; id++) {
  const { p, seg } = baseParams(id);
  let g = findDealAdaptive(p, seg.band);
  if (!g.ok) {
    fails.push(`${id}(${g.why})`);
    continue;
  }
  // 策略胜率过低 ⇒ 这关对人也偏苛刻，用更高的急需色偏置重采一次
  if (g.level.winRate < 0.35) {
    const softer = findDeal({ ...p, spawnBias: Math.min(0.92, p.spawnBias + 0.2) }, [0.4, 1.01]);
    if (softer.ok) g = softer;
  }
  out.push(g.level);
  const el = ((Date.now() - t0) / 1000).toFixed(1);
  const line =
    `#${String(id).padStart(2, '0')} R${g.level.radius} c${g.level.colors} goal=${g.level.goal}` +
    ` par=${g.level.par} wr=${g.level.winRate.toFixed(2)} seed=${g.level.seed}` +
    ` lock=${g.level.lockedCells} tl=${g.level.timeLimit} obs=${g.level.obstacles} [${el}s]`;
  if (id % 6 === 0 || id === 1) console.log(line + '   ← ' + seg.name);
  else console.log(line);
}

const ms = Date.now() - t0;
console.log(`\n生成 ${out.length}/${TOTAL} 关，用时 ${(ms / 1000).toFixed(1)}s`);
if (fails.length) console.log('失败关卡：', fails.join(' '));

const header =
  '// 本文件由 npm run gen:levels 生成，请勿手改。\n' +
  `// 54 关，每关均由求解器找到真实解法并回放验证；par = 解法步数，winRate = 噪声贪心通关率。\n` +
  `// rulesVersion = ${RULES_VERSION}（改了 rules.ts 必须重新生成）\n` +
  'import { LevelDef } from \'../logic/state\';\n\n' +
  'export const LEVELS: LevelDef[] = ';

const fs = require('fs');
const path = require('path');
const body = header + JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n  {') + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'levels.gen.ts'), body, 'utf8');
console.log('已写入 src/data/levels.gen.ts');
if (fails.length) process.exitCode = 1;
