// Boss 字符画工具：对称生成 + 行宽/对称/尺寸校验 + ASCII 预览
//
// 用法：
//   node probes/_boss-art.js check          # 校验 src/sprites.js 里 BOSS_SRC 全部图
//   node probes/_boss-art.js preview <id>   # 预览某张（带刻度尺）
//
// ⚠️ 为什么要有这个东西：boss 第三形态是**换模型**（e.spr 从 'hive' 变成 'hive_x'），
//    drawSpriteFrame 按 **set.w / set.h 居中**绘制 —— 两张图宽度不一样的话，
//    换形态那一瞬间模型会「横向跳一下」；行数差太多则是「突然变大/变小」。
//    同款形的两张图必须 **等宽**、行数相差 ≤ 2。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'src', 'sprites.js');
const STD_W = 20;          // 巨像标准宽度（与第一批七只一致）

function readBlock() {
  const src = fs.readFileSync(FILE, 'utf8');
  const i = src.indexOf('const BOSS_SRC = {');
  if (i < 0) throw new Error('找不到 BOSS_SRC');
  const end = src.indexOf('\n};', i);
  return src.slice(i, end);
}
function parseAll(block) {
  const re = /^  ([a-zA-Z_][a-zA-Z0-9_]*):\s*\[\[\s*\n([\s\S]*?)\n\s*\]\],?$/gm;
  const out = new Map();
  let m;
  while ((m = re.exec(block))) {
    const id = m[1];
    const rows = m[2].split('\n').map(s => s.trim()).filter(Boolean)
      .map(s => s.replace(/,$/, '').replace(/^'/, '').replace(/'$/, ''));
    out.set(id, rows);
  }
  return out;
}
function analyze(id, rows) {
  const ws = [...new Set(rows.map(r => r.length))];
  const errs = [];
  if (ws.length !== 1) errs.push('行宽不一致: ' + JSON.stringify(ws));
  const w = rows[0].length;
  if (w !== STD_W) errs.push('宽度 ' + w + ' ≠ 标准 ' + STD_W);
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < (w >> 1); i++) {
      if (r[i] !== r[w - 1 - i]) { errs.push('第' + (j + 1) + '行左右不对称 @' + i + ' (' + r[i] + ' vs ' + r[w - 1 - i] + ')'); break; }
    }
  }
  return { id, w, h: rows.length, errs };
}

const cmd = process.argv[2] || 'check';
const map = parseAll(readBlock());

if (cmd === 'check') {
  let bad = 0;
  const sizes = [];
  for (const [id, rows] of map) {
    const a = analyze(id, rows);
    sizes.push(a);
    if (a.errs.length) { bad++; console.log('✗ ' + id.padEnd(15) + ' ' + a.w + 'x' + a.h + '\n    ' + a.errs.join('\n    ')); }
  }
  // 同款形（_x）与本体的一致性
  console.log('\n== 形态配对 ==');
  for (const [id] of map) {
    if (!/_x$/.test(id)) continue;
    const base = id.slice(0, -2);
    const A = map.get(base); if (!A) continue;
    const B = map.get(id);
    const dw = B[0].length - A[0].length, dh = B.length - A.length;
    const ok = dw === 0 && Math.abs(dh) <= 2;
    if (!ok) bad++;
    console.log((ok ? '✓ ' : '✗ ') + (base + ' → ' + id).padEnd(30) + A[0].length + 'x' + A.length + '  vs  ' + B[0].length + 'x' + B.length + (ok ? '' : '   ← 差 ' + dw + ' 宽 / ' + dh + ' 高'));
  }
  console.log('\n' + (bad ? '✗ 有 ' + bad + ' 项不合格' : '✓ 全部合格'));
  console.log('== 尺寸总表 ==');
  for (const a of sizes) console.log('  ' + a.id.padEnd(15) + a.w + 'x' + a.h);
  process.exit(bad ? 1 : 0);
}

if (cmd === 'preview') {
  const id = process.argv[3];
  const rows = map.get(id);
  if (!rows) { console.error('没有这张图: ' + id); process.exit(1); }
  const a = analyze(id, rows);
  console.log(id + '  ' + a.w + 'x' + a.h);
  console.log('    ' + '0123456789'.repeat(Math.ceil(a.w / 10)).slice(0, a.w));
  rows.forEach((r, j) => console.log(String(j).padStart(3) + ' ' + r));
  if (a.errs.length) { console.log('问题:'); for (const e of a.errs) console.log('  ' + e); }
}
