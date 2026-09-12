/* ============================================================================
   奇点回响 · token 自查  ——  Phase 0.8 CI 式检查
   用法：node audit-tokens.js          退出码 0 = 通过，1 = 有违规

   规则
   R1  CSS 段（:root 之外）不得出现字面色值 —— 风格漂移的头号来源
   R2  CSS 引用的 --c-* / --z-* 必须已在 :root 定义（JS 运行时写入的除外）
   R3  PAL 的 NAMES 里每个键都必须有 --c-<键>-rgb 伴生定义
   R4  JS 段不得新增「语义色」字面量
       —— 实体色板（船体/ Boss / 敌人机体）、VFX 色阶、无彩色在白名单内，
          它们是内容数据，阶段 B 会整表替换，不逐个进 token。
   ========================================================================== */
const fs = require('fs');
const F = __dirname + '/index.html';
const src = fs.readFileSync(F, 'utf8');

const sStart = src.indexOf('<style>') + 7, sEnd = src.indexOf('</style>');
let css = src.slice(sStart, sEnd);
const rS = css.indexOf(':root{'), rE = css.indexOf('}', rS);
const cssRoot = css.slice(rS, rE + 1);
const cssRest = css.slice(0, rS) + css.slice(rE + 1);

const jsLines = [];
{ let on = false;
  src.split('\n').forEach(l => {
    if (/^<script(?![^>]*src=)/.test(l.trim())) { on = true; return; }
    if (l.trim() === '</script>') { on = false; return; }
    if (on) jsLines.push(l);
  });
}
const js = jsLines.join('\n');

let fail = 0;
const bad = m => { console.log('  ✗ ' + m); fail++; };
const ok = m => console.log('  ✓ ' + m);

/* ── R1 ─────────────────────────────────────────────────────────── */
console.log('\nR1  CSS 段字面色值');
const cHex = [...cssRest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]);
const cRgb = [...cssRest.matchAll(/rgba?\([^)]*\)/g)].map(m => m[0])
  .filter(s => /\d\s*,\s*\d\s*,\s*\d/.test(s));
cHex.length || cRgb.length
  ? bad(`残留 ${cHex.length} 个 hex / ${cRgb.length} 个 rgba：${[...cHex, ...cRgb].slice(0, 6).join(' ')}`)
  : ok('0 个字面色值（全部走 token）');

/* ── R2 ─────────────────────────────────────────────────────────── */
console.log('\nR2  CSS 变量引用完整性');
const defined = new Set([...cssRoot.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const used = new Set([...cssRest.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
const RUNTIME = new Set(['--cdp', '--mx', '--my']);       // 由 JS 逐帧写入
const undef = [...used].filter(x => !defined.has(x) && !RUNTIME.has(x));
undef.length ? bad('未定义：' + undef.join(' '))
  : ok(`${defined.size} 个 token 定义 · ${used.size} 个被引用 · 0 个悬空`);
const idle = [...defined].filter(x => !used.has(x));
if (idle.length) console.log('    (定义但 CSS 未引用，留给 JS/PAL 或阶段 B：' + idle.join(' ') + ')');

/* ── R3 ─────────────────────────────────────────────────────────── */
console.log('\nR3  PAL 键 ↔ token 伴生变量');
const mNames = js.match(/const NAMES=\[([\s\S]*?)\];/);
if (!mNames) bad('找不到 PAL 的 NAMES 列表');
else {
  const NAMES = [...mNames[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  const miss = NAMES.filter(k => !new RegExp('--c-' + k + '-rgb\\s*:').test(cssRoot));
  miss.length ? bad('缺 -rgb 伴生定义：' + miss.join(' '))
    : ok(`${NAMES.length} 个 PAL 键全部有 --c-*-rgb 分辨率`);
}

/* ── R4 ─────────────────────────────────────────────────────────── */
console.log('\nR4  JS 段语义色字面量');
const ALLOW_HEX = new Set(['#041a1a', '#08131f', '#0a111d', '#0a1216', '#0a1a10', '#0a2013',
  '#0c0a06', '#0c1626', '#0c1f26', '#0e1a28', '#101807', '#130920', '#150b22', '#150c22',
  '#16240a', '#1a0712', '#1a0b14', '#1a0b2a', '#1a1028', '#1c0508', '#1d0d08', '#1d1208',
  '#1e0508', '#200a1c', '#221008', '#241205', '#241d05', '#241f05', '#2a0d05', '#2a1808',
  '#2a6c8d', '#a8d8f0', '#a9e6ff', '#bcd4ff', '#c2f0ff', '#c8efdc', '#cfe0f0', '#d4e8ff',
  '#e4d4ff', '#eaf4ff', '#eaffd0', '#f6ffff', '#ff5a5a', '#ffb08a', '#ffd0ec', '#ffd2c4',
  '#ffd9d9', '#ffe9d0', '#ffffff']);
const ALLOW_RGB = new Set(['0,0,0', '10,17,26', '120,140,160', '120,160,210', '120,255,214',
  '150,255,190', '160,236,255', '190,120,255', '190,215,255', '20,4,8', '200,255,140',
  '225,238,255', '225,255,235', '225,255,250', '245,255,255', '255,110,70', '255,120,40',
  '255,120,70', '255,170,110', '255,170,60', '255,190,90', '255,205,130', '255,220,150',
  '255,224,130', '255,240,190', '255,255,255', '255,60,40', '255,90,220', '255,90,60', '4,10,18',
  '236,208,138']);   // = --c-amber-hi 分量：VFX 金阶（暴击 / 精英 / 满级飘字）
/* 实体色板动态放行：船体 / 尾流 / Boss 三张表是「内容数据」，
   它们的值本来就会被整体替换（阶段 B 已换过一版），不该每次改都来动本脚本。
   直接从代码里解析这三张表，把其中出现的 hex / rgb 三元组自动加入白名单。 */
const DYN_HEX = new Set(), DYN_RGB = new Set();
for (const name of ['HULL_TINT', 'TRAIL_RAMP', 'BOSS_STYLE', 'HULL_GEO', 'ENEMY_DEFS', 'CB_PAL']) {
  const m = js.match(new RegExp('const ' + name + '=\\{[\\s\\S]*?\\n\\};'));
  if (!m) { console.log('    (提示：未找到 ' + name + ' 表，动态放行跳过)'); continue; }
  for (const h of m[0].matchAll(/#[0-9a-fA-F]{3,8}\b/g)) DYN_HEX.add(h[0].toLowerCase());
  for (const r of m[0].matchAll(/(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) DYN_RGB.add(`${r[1]},${r[2]},${r[3]}`);
}

const jHex = [...new Set([...js.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase()))];
const jRgb = [...new Set([...js.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
  .map(m => `${m[1]},${m[2]},${m[3]}`))];
const newHex = jHex.filter(x => !ALLOW_HEX.has(x) && !DYN_HEX.has(x));
const newRgb = jRgb.filter(x => !ALLOW_RGB.has(x) && !DYN_RGB.has(x));
if (newHex.length || newRgb.length) {
  bad('出现白名单外的字面量（新增语义色请先加进 :root 再用 PAL）：');
  if (newHex.length) console.log('     hex: ' + newHex.join(' '));
  if (newRgb.length) console.log('     rgb: ' + newRgb.join(' '));
} else {
  ok(`JS 里 ${jHex.length} hex + ${jRgb.length} rgb 全部落在实体色板/VFX 白名单内`);
}
ok(`RGBA() token 调用 ${(js.match(/RGBA\(/g) || []).length} 处`);

/* ── R5 ─────────────────────────────────────────────────────────── */
console.log('\nR5  字号 / 动效字面量（应全部走 --fs-* / --dur-* / --ease-*）');
const fsLit = [...new Set([...cssRest.matchAll(/font-size:\s*([^;}]+)/g)]
  .map(m => m[1].trim()).filter(v => !v.startsWith('var(')))];
const durLit = [...new Set([...cssRest.matchAll(/(?<![\d.])(\d*\.?\d+m?s)\b/g)].map(m => m[1]))];
const easeLit = [...new Set([...cssRest.matchAll(/cubic-bezier\([^)]+\)/g)].map(m => m[0]))];
const inlineFs = [...new Set([...src.matchAll(/style="[^"]*font-size:\s*([^;"]+)/g)]
  .map(m => m[1].trim()).filter(v => !v.startsWith('var(')))];
const inlineCol = [...new Set([...src.matchAll(/style="[^"]*:([^;"]*#[0-9a-fA-F]{3,8})/g)].map(m => m[1].trim()))];
const r5 = [];
if (fsLit.length) r5.push('font-size 字面量：' + fsLit.join(' '));
if (durLit.length) r5.push('时长字面量：' + durLit.join(' '));
if (easeLit.length) r5.push('自造曲线：' + easeLit.join(' '));
if (inlineFs.length) r5.push('内联 font-size：' + inlineFs.join(' '));
if (inlineCol.length) r5.push('内联色值：' + inlineCol.join(' '));
r5.length ? r5.forEach(x => bad(x))
  : ok('0 个字号 / 时长 / 曲线 / 内联色值字面量');

/* ── 汇总 ───────────────────────────────────────────────────────── */
console.log('\n' + (fail ? `✗ 自查未通过（${fail} 项）` : '✓ token 自查全部通过'));
process.exit(fail ? 1 : 0);
