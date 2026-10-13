// BOSS_SRC 行宽自检：每张图的**每一行必须等宽**，否则 spriteFrom 按最长行取宽、
// 短行右侧留空 → 图形偏心。曾经因为 grep 看不出空格差异踩过。
// 运行： node probes/_boss-sprite-check.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sprites.js'), 'utf8');

// 只取 BOSS_SRC 块
const i = src.indexOf('const BOSS_SRC = {');
if (i < 0) { console.error('FATAL: 找不到 BOSS_SRC'); process.exit(1); }
// 找到与之配对的闭合 "};\n"
const end = src.indexOf('\n};', i);
const block = src.slice(i, end);

const re = /^  ([a-zA-Z_][a-zA-Z0-9_]*):\s*\[\[\s*\n([\s\S]*?)\n\s*\]\],?$/gm;
let m, n = 0, bad = 0;
const rowsSeen = [];
while ((m = re.exec(block))) {
  const id = m[1];
  const lines = m[2].split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/,$/, '').replace(/^'/, '').replace(/'$/, ''));
  const widths = [...new Set(lines.map(l => l.length))];
  n++;
  rowsSeen.push({ id, w: widths.length ? widths[0] : 0, h: lines.length });
  if (widths.length !== 1) {
    bad++;
    console.log('宽度不一致 ' + id + ': 宽度集合 ' + JSON.stringify(widths));
    lines.forEach((l, j) => { if (l.length !== widths[0]) console.log('   行' + (j + 1) + ' len=' + l.length + ' ' + JSON.stringify(l)); });
  }
}
console.log('共 ' + n + ' 张 boss 图，其中不一致 ' + bad + ' 张');
console.log('尺寸表:');
for (const r of rowsSeen) console.log('  ' + r.id.padEnd(16) + ' ' + r.w + 'x' + r.h);
process.exit(bad ? 1 : 0);
