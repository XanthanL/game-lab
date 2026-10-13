// Boss 字符画生成器：left 半边（10 字符）→ 镜像拼成 20 宽、天然对称的行。
//
// ⚠️ 为什么只写左半边：巨像第三形态是**换模型**（spr → spr_x），drawSpriteFrame 按
//    set.w/set.h 居中绘制；两张图宽度不等的话换形态那一瞬会横向跳。
//    left+reverse(left) 保证宽度恒为 20 且严格左右对称，手画永远做不到这么稳。
//
// 用法： node probes/_gen-boss-art.js   → 输出到 stdout（贴回 src/sprites.js）
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'src', 'sprites.js');

const mirror = left =>
  left.split('').concat(left.split('').reverse()).join('');   // 10 → 20

// —— 同心圆/椭圆体（太阳 / 日冕 / 核心这类「本来就该是圆的」）——
// ⚠️ 画布是 20 宽 × rows 高的**矩形**，直接 hypot 会把圆压成横向椭圆。
//    这里先把 (dx,dy) 按 rx/ry 归一化到单位圆，再乘回 min(rx,ry) —— 画出来才真的是圆。
//    palette 按 r 升序：取第一个满足 r >= d 的层（= 最靠内的那层壳）。
function disc(rows, cols, palette) {
  const rx = cols - 0.5, ry = rows / 2, unit = Math.min(rx, ry);
  const cx = rx, cy = (rows - 1) / 2;
  const out = [];
  for (let j = 0; j < rows; j++) {
    let line = '';
    for (let i = 0; i < cols; i++) {
      const d = Math.hypot((cx - i) / rx, (cy - j) / ry) * unit;
      let ch = '.';
      for (const p of palette) if (d <= p.r) { ch = p.c; break; }
      line += ch;
    }
    out.push(line);
  }
  return out;
}

const ART = {
  // ===== 圆形体：由 disc() 生成 =====
  // 星蚀：暗盘 + 金色日冕 + 一道横贯的蚀带（它的机制是「周期性熄灭战场」，
  //   本体必须看起来就是个**遮光的东西**，而不是又一个发光球）
  eclipse: (() => {
    const unit = 8;                                  // rows=16 → min(rx,ry)=8
    const rows = disc(16, 10, [
      { r: 1.8 * unit / 8, c: 'k' }, { r: 3.6 * unit / 8, c: 'S' }, { r: 5.0 * unit / 8, c: 'o' },
      { r: 6.4 * unit / 8, c: 'Y' }, { r: 7.4 * unit / 8, c: 'y' }, { r: unit, c: 'k' },
    ]);
    // 横贯蚀带：中间四行整行压暗 → 「日面被吃掉一条」
    for (const j of [7, 8, 9, 10]) rows[j] = rows[j].replace(/[oSYy]/g, 'S');
    return rows;
  })(),
  // 星蚀·全蚀：日面彻底黑掉，只剩一圈血红的日冕边
  eclipse_x: (() => {
    const unit = 8;
    return disc(16, 10, [
      { r: 4.6 * unit / 8, c: 'S' }, { r: 5.4 * unit / 8, c: 'k' }, { r: 6.2 * unit / 8, c: 'R' },
      { r: 7.2 * unit / 8, c: 'o' }, { r: unit, c: 'k' },
    ]);
  })(),
  // 磁暴核心：同心环 + 中心的「眼」（要让玩家看出被往哪拽）
  tempest: disc(15, 10, [
    { r: 1.1, c: 'k' }, { r: 2.0, c: 'C' }, { r: 3.0, c: 'w' }, { r: 3.9, c: 'b' },
    { r: 4.8, c: 'C' }, { r: 5.7, c: 'c' }, { r: 6.6, c: 'W' }, { r: 7.1, c: 'b' },
    { r: 7.5, c: 'k' },
  ]),
  // 磁暴·反极：极性来回翻，红黑双层反向环看得出来「正负在打架」
  tempest_x: disc(16, 10, [
    { r: 1.0, c: 'w' }, { r: 1.7, c: 'k' }, { r: 2.5, c: 'R' }, { r: 3.3, c: 'k' },
    { r: 4.1, c: 'R' }, { r: 4.9, c: 'w' }, { r: 5.7, c: 'C' }, { r: 6.6, c: 'c' },
    { r: 7.4, c: 'W' }, { r: 8.0, c: 'k' },
  ]),

  // ===== 结构体：手写左半边 =====
  // 母岩：不规则巨岩 + 两只橙红熔眼（别用大片亮灰，会糊成一块白砖）
  motherrock: [
    '.....kkkkk', '...kkWWWWW', '..kWWWWggg', '.kWWWggggg',
    'kWgggggggg', 'kWgggdWWgg', 'kgggdRRRRg', 'kgggWRRRRg',
    'kggggggggg', 'kWgggggggg', '.kWggggggg', '..kkWWgggg', '...kkkWWWW',
  ],
  // 母岩·熔核：外壳被敲开一道菱形裂口，白热熔核露出来（它三阶段的易伤就是这个口）
  motherrock_x: [
    '.....kkkkk', '...kkWWWWW', '..kWWWWggg', '.kWWkkRRoY',
    'kWgkRoYYww', 'kWkRoYYwwW', 'kWkRoYYwwW', 'kWgkRoYYww',
    '.kWWkkRRoY', '..kWWWWggg', '..kkWWgggg', '...kkkWWWW', '.....kkkkk',
  ],
  // 环带狱卒：沉重的环带监狱舱
  warden: [
    '....kkkkkk', '..kkdddddd', '.kddWWWWWW', 'kdWWWWkkkk',
    'kdWWkbbbbb', 'kdkkbbCwww', 'kdkbbCwwoo', 'kdkbbCwwoo',
    'kdkbbCwwww', 'kdkkbbbbbb', 'kdWWWWkkkk', '.kddWWWWWW',
    '..kkdddddd', '....kkkkkk',
  ],
  // 狱卒·展开：中央牢舱弹开露出红核，两侧炮臂就位
  warden_x: [
    '....kkkkkk', '..kkdddddd', '.kddWWWWWW', 'kdWWWRkkkk',
    'kdWWkbbbbb', 'kdkkbbCRRR', 'kdkbbCRRRo', 'kdkbbCRRRo',
    'kdkbbCRRRw', 'kdkkbbbbbb', 'kdWWWRkkkk', '.kddWWWWWW',
    '..kkdddddd', '....kkkkkk',
  ],
  // 奇点之门：闭合的门环
  gate: [
    '.....kkkkk', '...kkppppp', '..kppPPPPP', '.kpPPqqqqq',
    'kppPqqwwww', 'kpPPqwwCCC', 'kpPqqwCCww', 'kpPqqwCCwC',
    'kpPqqwCCww', 'kpPPqwwCCC', 'kppPqqwwww', '.kpPPqqqqq',
    '..kppPPPPP', '...kkppppp', '.....kkkkk',
  ],
  // 之门·洞开：门扇退到两侧，中间露出整片青色通道（三阶段会放两道交叉激光）
  gate_x: [
    '.....kkkkk', '...kkppppp', '..kppPPPPP', '.kpPwwwwww',
    'kppPwCCCCC', 'kpPPwCCwww', 'kpPwwCwwww', 'kpPwwCwwww',
    'kpPwwCwwww', 'kpPPwCCwww', 'kppPwCCCCC', '.kpPwwwwww',
    '..kppPPPPP', '...kkppppp', '.....kkkkk',
  ],
  // 蜂巢母体：六边形蜂窝单元
  hive: [
    '.....kkkkk', '...kkGGGGG', '..kGGLLLLL', '.kGLLLllLL',
    'kGLLlLLlLL', 'kGLlLLLlLL', 'kGLLlLLlLL', 'kGLlLLLlLL',
    'kGLLlLLlLL', '.kGLLLllLL', '..kGGLLLLL', '...kkGGGGG', '.....kkkkk',
  ],
  // 母体·破裂：巢壁缺口 + 黄绿内腔外翻（它开始漏虫）
  hive_x: [
    '.....kkkkk', '...kkGGGGG', '..kGGLLyyL', '.kGLkyylll',
    'kGLkyyllll', 'kGkyllllll', 'kGLkyyllll', '.kGLkyylll',
    '..kGGLLyyL', '...kkGGGGG', '..kGGLLLLL', '...kkGGGGG', '.....kkkkk',
  ],
  // 熔渣锻炉：方形工业炉体 + 两个白热出渣口
  forge: [
    '....kkkkkk', '..kkdddddd', '.kdrrRRRRR', 'kdrrRooooo',
    'kdRooooooo', 'kdRooYYooo', 'kdRoYYYYoo', 'kdRooYYooo',
    'kdRooooooo', 'kdrrRooooo', '.kdrrRRRRR', '..kkdddddd', '....kkkkkk',
  ],
  // 锻炉·过载：炉体通红，两道火舌从底部喷出
  forge_x: [
    '....kkkkkk', '..kkdddddd', '.kdrrRRRRR', 'kdrrRooooo',
    'kdRooooooo', 'kdRoYYoooo', 'kdRoYYYYoo', 'kdRoYYoooo',
    'kdRooooooo', 'kdrrRooooo', '.kdrrRRRRR', '..kkddYkkk', '...kkYkkkk',
  ],
  // 棱镜之眼：菱形棱晶 + 中央红瞳
  prism: [
    '.........k', '........kC', '.......kCw', '......kCwW',
    '.....kCwWq', '....kCwWqP', '...kCwWqPk', '..kCwWqPkR',
    '...kCwWqPk', '....kCwWqP', '.....kCwWq', '......kCwW',
    '.......kCw', '........kC', '.........k',
  ],
  // 裂相：棱镜裂成三片，红瞳涨到最大（它开始分裂幻影）
  prism_x: [
    '.........k', '........kC', '.......kCw', '......kCwW',
    '.....kCwWk', '....kCwWkP', '...kCwWkPk', '..kCwWkPkR',
    '..kCwWkPkR', '...kCwWkPk', '....kCwWkP', '.....kCwWk',
    '......kCwW', '.......kCw', '........kC', '.........k',
  ],
};

// ---- 校验 ----
let bad = 0;
for (const [id, leftRows] of Object.entries(ART)) {
  leftRows.forEach((l, j) => {
    if (l.length !== 10) { bad++; console.error('✗ ' + id + ' 第' + j + '行左半边长度 ' + l.length + ' ≠ 10: ' + JSON.stringify(l)); }
  });
}
if (bad) process.exit(1);

// ---- 图注（写进 sprites.js，说明「这张图为什么长这样」）----
const NOTE = {
  eclipse: '星蚀：暗盘 + 日冕 + 一道横贯的蚀带。它的机制是「周期性熄灭战场」，\n    //   所以本体必须看起来就是个**遮光的东西**，而不是又一个发光球。',
  eclipse_x: '星蚀·全蚀：日面彻底黑掉，只剩一圈血红日冕（第三阶段它熄得更狠）。',
  tempest: '磁暴核心：同心环 + 中心的「眼」—— 玩家要能一眼看出**自己正被往哪儿拽**。',
  tempest_x: '磁暴·反极：红黑双层反向环，极性来回翻（第三阶段拉/推会互换）。',
  motherrock: '母岩：不规则巨岩 + 两只橙红熔眼。\n    //   ⚠️ 别用大片亮灰铺 —— 整块糊成一块白砖，看不出体积。',
  motherrock_x: '母岩·熔核：外壳被敲开一道菱形裂口，白热熔核露出来 —— 它就是三阶段的**易伤口**，\n    //   玩家一眼能看出「该往哪儿打」。',
  warden: '环带狱卒：沉重的环带监狱舱。',
  warden_x: '狱卒·展开：中央牢舱弹开露出红核，两侧炮臂就位 —— 第三阶段它真的会架炮台。',
  gate: '奇点之门：闭合的门环。',
  gate_x: '之门·洞开：门扇退到两侧，中间露出整片青色通道\n    //   （第三阶段从这里放出两道交叉扫描激光）。',
  hive: '蜂巢母体：六边形蜂窝单元 —— 要「看得出它是一坨能吐东西的巢」。',
  hive_x: '母体·破裂：巢壁缺口 + 黄绿内腔外翻（它开始漏虫了）。',
  forge: '熔渣锻炉：方形工业炉体 + 两个白热出渣口。',
  forge_x: '锻炉·过载：炉体通红，火舌从底部喷出（第三阶段不再留火，改成一路烧穿）。',
  prism: '棱镜之眼：菱形棱晶 + 中央红瞳 —— 本体要「像在折射」它放出去的分光激光扇。',
  prism_x: '棱镜·裂相：棱镜裂开，红瞳涨到最大（第三阶段它开始分裂幻影）。',
};

// ---- 输出 ----
const out = [];
for (const [id, leftRows] of Object.entries(ART)) {
  const full = leftRows.map(mirror);
  if (NOTE[id]) out.push('  // ' + NOTE[id]);
  out.push('  ' + id + ': [[');
  full.forEach((r, j) => out.push("    '" + r + "'" + (j === full.length - 1 ? '' : ',')));
  out.push('  ]],');
}
const text = out.join('\n');
console.log('// ' + Object.keys(ART).length + ' 张已生成，全部 20 宽且严格左右对称');
console.log(text);

if (process.argv[2] === '--write') {
  const src = fs.readFileSync(FILE, 'utf8');
  const i = src.indexOf('const BOSS_SRC = {');
  const end = src.indexOf('\n};', i);
  // 保留块头注释，替换整个对象体
  const headEnd = src.indexOf('{', i) + 1;
  const body = '\n' + text + '\n';
  const next = src.slice(0, headEnd) + body + src.slice(end);
  fs.writeFileSync(FILE, next);
  console.log('\n已写入 ' + FILE);
}
