'use strict';
// 奇点旅途 · 像素精灵
// 沿用终焉防火墙的管线：调色板字符串 -> 离屏 canvas 烘焙。
// 新增 bakeRotation()：飞船/长条弹丸按 24 向预烘焙，避免逐帧旋转插值糊掉像素边缘。
const PAL = {
  k: '#1a1c2c', w: '#f4f4f4', W: '#c0cbdc', b: '#3b5dc9', n: '#29366f', c: '#41a6f6', C: '#73eff7',
  g: '#566c86', d: '#333c57', o: '#ef7d57', y: '#ffcd75', r: '#b13e53', R: '#e04060',
  p: '#5d275d', P: '#8a3cc0', q: '#c070f0', L: '#38b764', l: '#a7f070', G: '#257179',
  Y: '#ffe9a8', s: '#8b93a8', S: '#242a44',
};

function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function spriteFrom(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = newCanvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    if (ch !== '.' && PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); }
  }
  return c;
}
function tinted(src, color) {
  const c = newCanvas(src.width, src.height), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c;
}
function flipped(src) {
  const c = newCanvas(src.width, src.height), x = c.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c;
}
function scaled(src, s) {
  const c = newCanvas(Math.round(src.width * s), Math.round(src.height * s)), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height); return c;
}
function makeSet(frames, s = 1) {
  let fr = frames.map(spriteFrom);
  if (s !== 1) fr = fr.map(f => scaled(f, s));
  const set = { w: fr[0].width, h: fr[0].height, r: fr, l: fr.map(flipped) };
  // 受击闪白变体（也用于精英/Boss 强化态）
  set.wr = set.r.map(f => tinted(f, '#ffffff'));
  set.wl = set.l.map(f => tinted(f, '#ffffff'));
  return set;
}
// 24 向预烘焙。src 必须是「朝右(0 rad)」的精灵。
function bakeRotation(src, n = 24) {
  const R = Math.ceil(Math.hypot(src.width, src.height) / 2) + 1, size = R * 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = newCanvas(size, size), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.translate(R, R); x.rotate(i / n * Math.PI * 2);
    x.drawImage(src, -src.width / 2, -src.height / 2);
    out.push(c);
  }
  return { imgs: out, size, half: R, n };
}
const dirIndex = (ang, n = 24) => ((Math.round(ang / (Math.PI * 2) * n) % n) + n) % n;

/* ============ 船体（朝右，22x16） ============
   形状直接对齐《奇点回响》的 hullPath 矢量轮廓，由 .workbuddy/gen_hull.py
   把多边形栅格化后上色（阈值 0.30 保住剑尖/燕尾/W 翼尖这类薄结构；
   轻剑太细另做 1 格膨胀，否则整片只剩描边）。
   改轮廓的正确姿势：改脚本里的 POLY 再重跑，不要手改下面的字符画。 */
const HULL_SRC = {
  // ⚠️⚠️ 本块由 .workbuddy/gen_hull.py 从《奇点回响》的 hullPath 矢量轮廓**生成**，
  //    别手改字符画 —— 改轮廓请改脚本里的 POLY/SKIN 再 `python .workbuddy/apply_hulls.py`。
  //    预览：python .workbuddy/render_hulls.py（纯 PIL 出 PNG）。
  // ⚠️ 网格固定 22x16、原点格 (11,8) —— 29 张卡的舰体配件坐标全挂在这套本地格上，
  //    改尺寸 = 全部配件错位（见 ATTACH_ART）。
  // 打光：轮廓用**双色轮廓光**（回响招牌）—— 上缘/前缘迎光走亮色、下缘/后缘背光走暗色；
  //    内部再压一条上侧窄受光带 + 外缘/机尾背光带，机首整流罩高光、座舱玻璃 'w'、尾喷口 eng。
  // 游隼：流线隼形 + 燕尾（echo hullPath 18,0 → 9,5.5 → -3,8.5 → 燕尾叉）
  peregrine: [[
    '......................',
    '......................',
    '......................',
    '.....CCCCC............',
    '....CCCCCCCCC.........',
    '...CCCCCCCCCCCC.......',
    '..CCnnbbbbbbwwbCC.....',
    '...CnnbbbbbbwwbbbCC...',
    '...CnnbbbbbbwwbbbCC...',
    '..CCnnbbbbbbwwbCC.....',
    '...CnnbbbbbbbnC.......',
    '....nnbbbbnnn.........',
    '.....nnnnn............',
    '......................',
    '......................',
    '......................',
  ]],
  // 轻剑：纤细剑身 + 对称后掠双翼（剑尖 + 燕尾）
  rapier: [[
    '......................',
    '......................',
    '......................',
    '.y....................',
    '.yyy..................',
    '..yyy.................',
    '..yrryyyyyy...........',
    '.yyrrroooooyyyyyyyyyy.',
    '.yyrrrooooorrrryyyyyy.',
    '..yrrrrrrrr...........',
    '..yrr.................',
    '.rrr..................',
    '.r....................',
    '......................',
    '......................',
    '......................',
  ]],
  // 堡垒：宽厚六边装甲
  bulwark: [[
    '......................',
    '......llllllll........',
    '......lGGGGGGl........',
    '.....lLLLLLLLl........',
    '....llllllllll........',
    '..lllllllllllll.......',
    '..llGGLLLLwwLLLl......',
    '..llGGLLLLwwLLLll.....',
    '..llGGLLLLwwLLLll.....',
    '..llGGLLLLwwLLLl......',
    '..llGGLLLLLLLLl.......',
    '....GGLLLLLLLl........',
    '.....GLLLLLLLl........',
    '......GGGGGGGl........',
    '......GGGGGGll........',
    '......................',
  ]],
  // 玄鸦：W 形隐形战机
  raven: [[
    '.....qq...............',
    '...qqpq...............',
    '....qppq..............',
    '....qPPPq.............',
    '.....qqqqq............',
    '....qqqqqqqq..........',
    '..qqpPPPPPPwqqq.......',
    '.qqppPPPPPPwwwPqqq....',
    '.qqppPPPPPPwwwPqqq....',
    '..qppPPPPPPwpqq.......',
    '....pPPPPPpp..........',
    '.....pPPPp............',
    '....pPPPp.............',
    '....pppp..............',
    '...pppp...............',
    '.....pp...............',
  ]],
  // 蜂群：蜂形母舰（圆头 + 双侧蜂翅 + 尾部蜇针）
  swarm: [[
    '......................',
    '......................',
    '...YYY................',
    '....YyY...............',
    '....YYYYYY............',
    '.....YYYYYYYYY........',
    '..YYYyyyywwwyyYY......',
    'YYooyyyyywwwyyyyY.....',
    'YYooyyyyywwwyyyyY.....',
    '..oooyyyywwwyyYY......',
    '.....oyyyyooYY........',
    '....oyyooo............',
    '....oyo...............',
    '...ooo................',
    '......................',
    '......................',
  ]],
  // 回响：锐角镖形 + 内凹尾叉（echo 的隐藏终局船，铅白）
  nemesis: [[
    '......w...............',
    '.....wgw..............',
    '....wgggww............',
    '....wWWWWWw...........',
    '.....wwwwwww..........',
    '.....wwwwwwwwww.......',
    '....wWWWWWWwwwwwww....',
    '.wwwgWWWWWWwwwwWWWww..',
    '.wgggWWWWWWwwwwWWWww..',
    '....gWWWWWWwwwwwww....',
    '.....gWWWWWWggw.......',
    '.....gWWWWWg..........',
    '....gWWWWWg...........',
    '....gggggg............',
    '.....ggg..............',
    '......g...............',
  ]],
  // 熔炉：宽厚砧形机身 + 双侧散热鳍 + 方形炉尾喷口（熔铜）
  forge: [[
    '......................',
    '......................',
    '.......YYYY...........',
    '.......YooY...........',
    'YYYYYY.YYYY...........',
    'yyyYYYYYYYYYYYY.......',
    'yyyrroooooowwwoYY.....',
    'yyyrroooooowwwoooYYY..',
    'yyyrroooooowwwoooYYY..',
    'yyyrroooooowwwoYY.....',
    'yyyrroroooorrrY.......',
    'rrrrrr.roor...........',
    '.......roor...........',
    '.......rrrr...........',
    '......................',
    '......................',
  ]],
};


// ============ 敌机（2 帧） ============
const SPR_SRC = {
  seeker: [[
    '..kk..',
    '.kRRk.',
    'kRwwRk',
    'kRRRRk',
    '.kRRk.',
    '..kk..',
  ], [
    '..kk..',
    '.kRRk.',
    'kRRRRk',
    'kRwwRk',
    '.kRRk.',
    '..kk..',
  ]],
  tadpole: [[
    '.kk....',
    'kllk...',
    'klwlkk.',
    'klllklk',
    'klwlkk.',
    'kllk...',
    '.kk....',
  ], [
    '.kk....',
    'kllk...',
    '.kklwlk',
    'klllklk',
    '.kklwlk',
    'kllk...',
    '.kk....',
  ]],
  dart: [[
    'k.......',
    'kok.....',
    'koook...',
    'koooookk',
    'koook...',
    'kok.....',
    'k.......',
  ], [
    '........',
    '.kok....',
    '.koook..',
    'kooooyyk',
    '.koook..',
    '.kok....',
    '........',
  ]],
  gunner: [[
    '.kkkk.',
    'kPqqPk',
    'kPwwPk',
    'kPPPPk',
    '.kPPk.',
    'k.k.k.',
  ], [
    '.kkkk.',
    'kPqqPk',
    'kPwwPk',
    'kkPPkk',
    '.kqqk.',
    '.k.k..',
  ]],
  splitter: [[
    '.kkkk.',
    'klyylk',
    'kywwyk',
    'kyylyk',
    'klyylk',
    '.kkkk.',
  ], [
    '......',
    '.kkkk.',
    'kywwyk',
    'kyylyk',
    '.kkkk.',
    '......',
  ]],
  reaver: [[
    'kk.kk',
    'kRRRk',
    '.kRk.',
    'kRRRk',
    'kk.kk',
  ], [
    'k...k',
    '.kRk.',
    'kRRRk',
    '.kRk.',
    'k...k',
  ]],
  bastion: [[
    '..kkkkkk..',
    '.kgWWWWgk.',
    'kgWddddWgk',
    'kgdwoowdgk',
    'kgWddddWgk',
    '.kgWWWWgk.',
    '..k.kk.k..',
  ], [
    '..kkkkkk..',
    '.kgWWWWgk.',
    'kgWddddWgk',
    'kgdwoowdgk',
    'kgWddddWgk',
    '.kgWWWWgk.',
    '.k..kk..k.',
  ]],
  shifter: [[
    '..kk..',
    '.kqqk.',
    'kqwwqk',
    'kqqqqk',
    '.kqqk.',
    '..kk..',
  ], [
    '......',
    '..qq..',
    '.kwwk.',
    '..qq..',
    '......',
    '......',
  ]],
  stalker: [[
    '.k....k.',
    'kbb..bbk',
    '.kbbbbk.',
    'kbCwwCbk',
    '.kbbbbk.',
    'kbb..bbk',
    '.k....k.',
  ], [
    '.k....k.',
    'kbb..bbk',
    '.kbbbbk.',
    'kbCCwCbk',
    '.kbbbbk.',
    'kbb..bbk',
    '.k....k.',
  ]],
  mine: [[
    '..k..',
    'koRok',
    'kRRRk',
    'koRok',
    '..k..',
  ], [
    '..k..',
    'kyYok',
    'kYYYk',
    'kyYok',
    '..k..',
  ]],
  orbiter: [[
    '.kkkk.',
    'kbbbbk',
    'kbCCbk',
    'kbbbbk',
    '.kkkk.',
  ], [
    '.kbbk.',
    'kbCCbk',
    'kbbbbk',
    'kbCCbk',
    '.kbbk.',
  ]],
  leech: [[
    'k.k.k',
    '.kPk.',
    'kPRRPk',
    '.kPPk.',
    'k...k',
  ], [
    '.k.k.',
    'k.P.k',
    'kPRRPk',
    '.kPPk.',
    '..k..',
  ]],
  // ---- 第二批：各有独立的战术压力，不是数值换皮 ----
  // 织网者：中距游走，往场上撒减速蛛网（限制走位）
  weaver: [[
    'k......k',
    'kqk..kqk',
    '.kqqqqk.',
    'kqqwwqqk',
    '.kqqqqk.',
    'kqk..kqk',
    'k......k',
  ], [
    '.k....k.',
    'kqk..kqk',
    'kqqqqqqk',
    'kqqwwqqk',
    'kqqqqqqk',
    'kqk..kqk',
    '.k....k.',
  ]],
  // 牧者：远离玩家，给周围敌人加血加移速（强制先点掉）
  shepherd: [[
    '..kkkkk..',
    '.klllllk.',
    'klYlllYlk',
    'klYlwlYlk',
    'klYlllYlk',
    '.klllllk.',
    '..k...k..',
  ], [
    '..kkkkk..',
    '.klllllk.',
    'klYlwlYlk',
    'klYlYlYlk',
    'klYlwlYlk',
    '.klllllk.',
    '.k.....k.',
  ]],
  // 新星：死亡时炸出一圈弹幕（杀它的位置很重要）
  nova: [[
    '...k...',
    '..yYy..',
    '.yRRRy.',
    'kyRwRyk',
    '.yRRRy.',
    '..yYy..',
    '...k...',
  ], [
    'k..k..k',
    '.y.y.y.',
    '..YYY..',
    'kYwRwYk',
    '..YYY..',
    '.y.y.y.',
    'k..k..k',
  ]],
  // 铁壁：正面装甲吸收大部分伤害，必须绕到侧后方打
  bulwark: [[
    '...kkkk....',
    '..kggggk...',
    '.kggggggk..',
    'kggwwgggk..',
    'kgwwwwggWWk',
    'kggwwgggk..',
    '.kggggggk..',
    '..kggggk...',
    '...kkkk....',
  ], [
    '...kkkk....',
    '..kggggk...',
    '.kggggggk..',
    'kggwwgggk..',
    'kgwwwwggYWk',
    'kggwwgggk..',
    '.kggggggk..',
    '..kggggk...',
    '...kkkk....',
  ]],
};
// ============ Boss（单帧，放大 2x） ============
const BOSS_SRC = {
  // 星蚀：暗盘 + 日冕 + 一道横贯的蚀带。它的机制是「周期性熄灭战场」，
    //   所以本体必须看起来就是个**遮光的东西**，而不是又一个发光球。
  eclipse: [[
    '.......kkkkkk.......',
    '....kkyyyyyyyykk....',
    '...kyyYYYYYYYYyyk...',
    '..kyyYYooooooYYyyk..',
    '.kyyYYoooSSoooYYyyk.',
    '.kyYYooSSSSSSooYYyk.',
    '.yyYooSSSkkSSSooYyy.',
    '.SSSSSSSkkkkSSSSSSS.',
    '.SSSSSSSkkkkSSSSSSS.',
    '.SSSSSSSSkkSSSSSSSS.',
    '.kSSSSSSSSSSSSSSSSk.',
    '.kyyYYoooSSoooYYyyk.',
    '..kyyYYooooooYYyyk..',
    '...kyyYYYYYYYYyyk...',
    '....kkyyyyyyyykk....',
    '.......kkkkkk.......'
  ]],
  // 星蚀·全蚀：日面彻底黑掉，只剩一圈血红日冕（第三阶段它熄得更狠）。
  eclipse_x: [[
    '.......kkkkkk.......',
    '....kkooooooookk....',
    '...koooRRRRRRoook...',
    '..kooRkkkSSkkkRook..',
    '.kkoRkSSSSSSSSkRokk.',
    '.koRkSSSSSSSSSSkRok.',
    '.koRkSSSSSSSSSSkRok.',
    '.ooRkSSSSSSSSSSkRoo.',
    '.ooRkSSSSSSSSSSkRoo.',
    '.koRkSSSSSSSSSSkRok.',
    '.koRkSSSSSSSSSSkRok.',
    '.kkoRkSSSSSSSSkRokk.',
    '..kooRkkkSSkkkRook..',
    '...koooRRRRRRoook...',
    '....kkooooooookk....',
    '.......kkkkkk.......'
  ]],
  // 磁暴核心：同心环 + 中心的「眼」—— 玩家要能一眼看出**自己正被往哪儿拽**。
  tempest: [[
    '.......kbbbbk.......',
    '....kbbWWWWWWbbk....',
    '...kbWWccccccWWbk...',
    '..kWWccCCCCCCccWWk..',
    '.kbWcCCbbbbbbCCcWbk.',
    '.bWcCCbwwwwwwbCCcWb.',
    '.bWcCbwwCkkCwwbCcWb.',
    'kbWcCbwCCkkCCwbCcWbk',
    '.bWcCbwwCkkCwwbCcWb.',
    '.bWcCCbwwwwwwbCCcWb.',
    '.kbWcCCbbbbbbCCcWbk.',
    '..kWWccCCCCCCccWWk..',
    '...kbWWccccccWWbk...',
    '....kbbWWWWWWbbk....',
    '.......kbbbbk.......'
  ]],
  // 磁暴·反极：红黑双层反向环，极性来回翻（第三阶段拉/推会互换）。
  tempest_x: [[
    '.......kkkkkk.......',
    '....kkWWWccWWWkk....',
    '...kWWccCCCCccWWk...',
    '..kWccCCwwwwCCccWk..',
    '.kWccCwRRRRRRwCccWk.',
    '.kWcCwRkkkkkkRwCcWk.',
    '.WcCwRRkRkkRkRRwCcW.',
    '.WcCwRkRkwwkRkRwCcW.',
    '.WcCwRkRkwwkRkRwCcW.',
    '.WcCwRRkRkkRkRRwCcW.',
    '.kWcCwRkkkkkkRwCcWk.',
    '.kWccCwRRRRRRwCccWk.',
    '..kWccCCwwwwCCccWk..',
    '...kWWccCCCCccWWk...',
    '....kkWWWccWWWkk....',
    '.......kkkkkk.......'
  ]],
  // 母岩：不规则巨岩 + 两只橙红熔眼。
    //   ⚠️ 别用大片亮灰铺 —— 整块糊成一块白砖，看不出体积。
  motherrock: [[
    '.....kkkkkkkkkk.....',
    '...kkWWWWWWWWWWkk...',
    '..kWWWWggggggWWWWk..',
    '.kWWWggggggggggWWWk.',
    'kWggggggggggggggggWk',
    'kWgggdWWggggWWdgggWk',
    'kgggdRRRRggRRRRdgggk',
    'kgggWRRRRggRRRRWgggk',
    'kggggggggggggggggggk',
    'kWggggggggggggggggWk',
    '.kWggggggggggggggWk.',
    '..kkWWggggggggWWkk..',
    '...kkkWWWWWWWWkkk...'
  ]],
  // 母岩·熔核：外壳被敲开一道菱形裂口，白热熔核露出来 —— 它就是三阶段的**易伤口**，
    //   玩家一眼能看出「该往哪儿打」。
  motherrock_x: [[
    '.....kkkkkkkkkk.....',
    '...kkWWWWWWWWWWkk...',
    '..kWWWWggggggWWWWk..',
    '.kWWkkRRoYYoRRkkWWk.',
    'kWgkRoYYwwwwYYoRkgWk',
    'kWkRoYYwwWWwwYYoRkWk',
    'kWkRoYYwwWWwwYYoRkWk',
    'kWgkRoYYwwwwYYoRkgWk',
    '.kWWkkRRoYYoRRkkWWk.',
    '..kWWWWggggggWWWWk..',
    '..kkWWggggggggWWkk..',
    '...kkkWWWWWWWWkkk...',
    '.....kkkkkkkkkk.....'
  ]],
  // 环带狱卒：沉重的环带监狱舱。
  warden: [[
    '....kkkkkkkkkkkk....',
    '..kkddddddddddddkk..',
    '.kddWWWWWWWWWWWWddk.',
    'kdWWWWkkkkkkkkWWWWdk',
    'kdWWkbbbbbbbbbbkWWdk',
    'kdkkbbCwwwwwwCbbkkdk',
    'kdkbbCwwoooowwCbbkdk',
    'kdkbbCwwoooowwCbbkdk',
    'kdkbbCwwwwwwwwCbbkdk',
    'kdkkbbbbbbbbbbbbkkdk',
    'kdWWWWkkkkkkkkWWWWdk',
    '.kddWWWWWWWWWWWWddk.',
    '..kkddddddddddddkk..',
    '....kkkkkkkkkkkk....'
  ]],
  // 狱卒·展开：中央牢舱弹开露出红核，两侧炮臂就位 —— 第三阶段它真的会架炮台。
  warden_x: [[
    '....kkkkkkkkkkkk....',
    '..kkddddddddddddkk..',
    '.kddWWWWWWWWWWWWddk.',
    'kdWWWRkkkkkkkkRWWWdk',
    'kdWWkbbbbbbbbbbkWWdk',
    'kdkkbbCRRRRRRCbbkkdk',
    'kdkbbCRRRooRRRCbbkdk',
    'kdkbbCRRRooRRRCbbkdk',
    'kdkbbCRRRwwRRRCbbkdk',
    'kdkkbbbbbbbbbbbbkkdk',
    'kdWWWRkkkkkkkkRWWWdk',
    '.kddWWWWWWWWWWWWddk.',
    '..kkddddddddddddkk..',
    '....kkkkkkkkkkkk....'
  ]],
  // 奇点之门：闭合的门环。
  gate: [[
    '.....kkkkkkkkkk.....',
    '...kkppppppppppkk...',
    '..kppPPPPPPPPPPppk..',
    '.kpPPqqqqqqqqqqPPpk.',
    'kppPqqwwwwwwwwqqPppk',
    'kpPPqwwCCCCCCwwqPPpk',
    'kpPqqwCCwwwwCCwqqPpk',
    'kpPqqwCCwCCwCCwqqPpk',
    'kpPqqwCCwwwwCCwqqPpk',
    'kpPPqwwCCCCCCwwqPPpk',
    'kppPqqwwwwwwwwqqPppk',
    '.kpPPqqqqqqqqqqPPpk.',
    '..kppPPPPPPPPPPppk..',
    '...kkppppppppppkk...',
    '.....kkkkkkkkkk.....'
  ]],
  // 之门·洞开：门扇退到两侧，中间露出整片青色通道
    //   （第三阶段从这里放出两道交叉扫描激光）。
  gate_x: [[
    '.....kkkkkkkkkk.....',
    '...kkppppppppppkk...',
    '..kppPPPPPPPPPPppk..',
    '.kpPwwwwwwwwwwwwPpk.',
    'kppPwCCCCCCCCCCwPppk',
    'kpPPwCCwwwwwwCCwPPpk',
    'kpPwwCwwwwwwwwCwwPpk',
    'kpPwwCwwwwwwwwCwwPpk',
    'kpPwwCwwwwwwwwCwwPpk',
    'kpPPwCCwwwwwwCCwPPpk',
    'kppPwCCCCCCCCCCwPppk',
    '.kpPwwwwwwwwwwwwPpk.',
    '..kppPPPPPPPPPPppk..',
    '...kkppppppppppkk...',
    '.....kkkkkkkkkk.....'
  ]],
  // 蜂巢母体：六边形蜂窝单元 —— 要「看得出它是一坨能吐东西的巢」。
  hive: [[
    '.....kkkkkkkkkk.....',
    '...kkGGGGGGGGGGkk...',
    '..kGGLLLLLLLLLLGGk..',
    '.kGLLLllLLLLllLLLGk.',
    'kGLLlLLlLLLLlLLlLLGk',
    'kGLlLLLlLLLLlLLLlLGk',
    'kGLLlLLlLLLLlLLlLLGk',
    'kGLlLLLlLLLLlLLLlLGk',
    'kGLLlLLlLLLLlLLlLLGk',
    '.kGLLLllLLLLllLLLGk.',
    '..kGGLLLLLLLLLLGGk..',
    '...kkGGGGGGGGGGkk...',
    '.....kkkkkkkkkk.....'
  ]],
  // 母体·破裂：巢壁缺口 + 黄绿内腔外翻（它开始漏虫了）。
  hive_x: [[
    '.....kkkkkkkkkk.....',
    '...kkGGGGGGGGGGkk...',
    '..kGGLLyyLLyyLLGGk..',
    '.kGLkyyllllllyykLGk.',
    'kGLkyyllllllllyykLGk',
    'kGkyllllllllllllykGk',
    'kGLkyyllllllllyykLGk',
    '.kGLkyyllllllyykLGk.',
    '..kGGLLyyLLyyLLGGk..',
    '...kkGGGGGGGGGGkk...',
    '..kGGLLLLLLLLLLGGk..',
    '...kkGGGGGGGGGGkk...',
    '.....kkkkkkkkkk.....'
  ]],
  // 熔渣锻炉：方形工业炉体 + 两个白热出渣口。
  forge: [[
    '....kkkkkkkkkkkk....',
    '..kkddddddddddddkk..',
    '.kdrrRRRRRRRRRRrrdk.',
    'kdrrRooooooooooRrrdk',
    'kdRooooooooooooooRdk',
    'kdRooYYooooooYYooRdk',
    'kdRoYYYYooooYYYYoRdk',
    'kdRooYYooooooYYooRdk',
    'kdRooooooooooooooRdk',
    'kdrrRooooooooooRrrdk',
    '.kdrrRRRRRRRRRRrrdk.',
    '..kkddddddddddddkk..',
    '....kkkkkkkkkkkk....'
  ]],
  // 锻炉·过载：炉体通红，火舌从底部喷出（第三阶段不再留火，改成一路烧穿）。
  forge_x: [[
    '....kkkkkkkkkkkk....',
    '..kkddddddddddddkk..',
    '.kdrrRRRRRRRRRRrrdk.',
    'kdrrRooooooooooRrrdk',
    'kdRooooooooooooooRdk',
    'kdRoYYooooooooYYoRdk',
    'kdRoYYYYooooYYYYoRdk',
    'kdRoYYooooooooYYoRdk',
    'kdRooooooooooooooRdk',
    'kdrrRooooooooooRrrdk',
    '.kdrrRRRRRRRRRRrrdk.',
    '..kkddYkkkkkkYddkk..',
    '...kkYkkkkkkkkYkk...'
  ]],
  // 棱镜之眼：菱形棱晶 + 中央红瞳 —— 本体要「像在折射」它放出去的分光激光扇。
  prism: [[
    '.........kk.........',
    '........kCCk........',
    '.......kCwwCk.......',
    '......kCwWWwCk......',
    '.....kCwWqqWwCk.....',
    '....kCwWqPPqWwCk....',
    '...kCwWqPkkPqWwCk...',
    '..kCwWqPkRRkPqWwCk..',
    '...kCwWqPkkPqWwCk...',
    '....kCwWqPPqWwCk....',
    '.....kCwWqqWwCk.....',
    '......kCwWWwCk......',
    '.......kCwwCk.......',
    '........kCCk........',
    '.........kk.........'
  ]],
  // 棱镜·裂相：棱镜裂开，红瞳涨到最大（第三阶段它开始分裂幻影）。
  prism_x: [[
    '.........kk.........',
    '........kCCk........',
    '.......kCwwCk.......',
    '......kCwWWwCk......',
    '.....kCwWkkWwCk.....',
    '....kCwWkPPkWwCk....',
    '...kCwWkPkkPkWwCk...',
    '..kCwWkPkRRkPkWwCk..',
    '..kCwWkPkRRkPkWwCk..',
    '...kCwWkPkkPkWwCk...',
    '....kCwWkPPkWwCk....',
    '.....kCwWkkWwCk.....',
    '......kCwWWwCk......',
    '.......kCwwCk.......',
    '........kCCk........',
    '.........kk.........'
  ]],

};

// ============ 拾取物 & 杂项 ============
const PICK_SRC = {
  dust: [[
    '..y..',
    '.yYy.',
    'yYYYo',
    '.yoo.',
    '..o..',
  ], [
    '.....',
    '..y..',
    '.yYo.',
    '..o..',
    '.....',
  ]],
  dustBig: [[
    '..yyy..',
    '.yYYYy.',
    'yYYYYYo',
    'yYYYYoo',
    '.yyooo.',
    '..ooo..',
  ], [
    '.......',
    '..yyy..',
    '.yYYYy.',
    '.yyooo.',
    '..ooo..',
    '.......',
  ]],
  heal: [[
    '.kkkkk.',
    'k.kRk.k',
    'kkRRRkk',
    'kRRRRRk',
    'kkRRRkk',
    'k.kRk.k',
    '.kkkkk.',
  ]],
  energy: [[
    '.kk.',
    'kCCk',
    'kCCk',
    '.kk.',
  ], [
    '....',
    '.CC.',
    '.CC.',
    '....',
  ]],
  shard: [[
    '.k.',
    'kCk',
    '.k.',
  ]],
};

/* ============ 敌人 / 巨像的显示放大倍数 ============
   起因：480×270 的画布上，最小的杂兵（掠夺者 5×5）和星尘（5×5）一样大，
   玩家分不清哪是敌人哪是掉落。同时玩家船是 2x 烘焙的（44×32 显示），
   杂兵却是 1x（1 个美术像素 = 1 个游戏像素）—— 像素格子都不一样大。

   ⚠️ 这两个数必须和 game.js 里的 ENEMY_SCALE / BOSS_SCALE **成对改**：
      那边乘的是**判定半径 e.r**，这边乘的是**像素画**。
      只改一边 = 「看着打中了却没伤害」或者「隔着老远就掉血」，
      两种都不抛异常，只能靠手感/逐像素探针发现。
   ⚠️ 2x 之后杂兵的美术像素正好和玩家船对齐（都是 2 游戏像素一格）；
      巨像 3x 是 3 游戏像素一格，比船粗一档 —— 这是有意的：它要显得更「重」。 */
const ENEMY_SPR_SCALE = 2;   // 杂兵：5×5…11×9 → 10×10…22×18
const BOSS_SPR_SCALE = 3;    // 巨像：原来 2x（40×26…40×30，比玩家船还小）→ 3x（60×39…60×45）

const SPR = {};
// 注意：不能叫 HULLS —— game.js 里的船体数据表叫这个名字，两个文件都是全局作用域会冲突
const SHIPSET = {};
function buildSprites() {
  for (const k in SPR_SRC) SPR[k] = makeSet(SPR_SRC[k], ENEMY_SPR_SCALE);
  // ⚠️ 拾取物**不放大**：星尘 / 治疗 / 能量本来就是按 1x 设计的，
  //    而且「敌人比星尘大」正是这次改动的目的，把星尘一起放大等于没改。
  for (const k in PICK_SRC) SPR[k] = makeSet(PICK_SRC[k]);
  for (const k in BOSS_SRC) SPR[k] = makeSet(BOSS_SRC[k], BOSS_SPR_SCALE);
  // 船体：2x 放大后烘焙 24 向
  for (const k in HULL_SRC) {
    const base = scaled(spriteFrom(HULL_SRC[k][0]), 2);
    const set = bakeRotation(base, 24);
    set.white = bakeRotation(tinted(base, '#ffffff'), 24);
    // 量出「机首 / 机尾」沿 +x 方向伸出船体中心的像素距离 —— 弹丸出膛点、尾焰锚点都用它，
    // 这样子弹才真的是「从模型炮口打出去」、尾焰才真的是「从船尾喷出来」，而不是以船心为锚。
    // 全船 22×16 本地格、原点 (11,8)，scaled(2) 后画布中心正对 grid 中心，
    // 所以只要扫 base 的实像素 x 包络、以 base.width/2 为原点即可。
    const bd = base.getContext('2d').getImageData(0, 0, base.width, base.height).data;
    let minC = base.width, maxC = -1;
    for (let j = 0; j < base.height; j++)
      for (let i = 0; i < base.width; i++)
        if (bd[(j * base.width + i) * 4 + 3] > 0) { if (i < minC) minC = i; if (i > maxC) maxC = i; }
    const c0 = base.width / 2;
    set.nose = Math.max(0, (maxC + 0.5) - c0);   // 机首伸出量（px）
    set.tail = Math.max(0, c0 - (minC - 0.5));    // 机尾伸出量（px）
    SHIPSET[k] = set;
  }
}
// ============ 敌弹 & 辉光（缓存纪律：key 只放有界集合，绝不放逐帧变化的 alpha） ============
const _bcache = {}, _gcache = {};
function bulletSprite(color, r) {
  const key = color + r; if (_bcache[key]) return _bcache[key];
  const R = r + 1, s = R * 2 + 1, c = newCanvas(s, s), x = c.getContext('2d');
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const dx = i - R, dy = j - R, d = Math.sqrt(dx * dx + dy * dy);
    if (d > r + 1.3) continue;
    x.fillStyle = d > r + 0.3 ? '#12061a' : d <= Math.max(0.5, r - 1.5) ? '#ffffff' : color;
    x.fillRect(i, j, 1, 1);
  }
  return (_bcache[key] = c);
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function glowSprite(color, R, a = 1) {
  R = Math.max(2, Math.round(R));
  const key = color + '|' + R + '|' + a; if (_gcache[key]) return _gcache[key];
  const s = R * 2, c = newCanvas(s, s), x = c.getContext('2d');
  const [rr, gg, bb] = hexRgb(color);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const d = Math.hypot(i + 0.5 - R, j + 0.5 - R) / R;
    if (d >= 1) continue;
    const q = Math.ceil((1 - d) * 4) / 4;
    x.fillStyle = `rgba(${rr},${gg},${bb},${(q * q * a).toFixed(3)})`; x.fillRect(i, j, 1, 1);
  }
  return (_gcache[key] = c);
}
function drawGlow(ctx, color, R, a, x, y) {
  if (a <= 0.01) return;
  R = Math.max(2, Math.round(R));
  const pa = ctx.globalAlpha; ctx.globalAlpha = pa * Math.min(1, a);
  ctx.drawImage(glowSprite(color, R), x - R, y - R);
  ctx.globalAlpha = pa;
}
function drawShip(ctx, hull, ang, x, y, white) {
  const S = white ? SHIPSET[hull].white : SHIPSET[hull];
  if (!S) return;
  const img = S.imgs[dirIndex(ang, S.n)];
  ctx.drawImage(img, Math.round(x - S.half), Math.round(y - S.half));
}

// ============ 星空背景 tile（每层视差一套，64x64 无缝） ============
function makeStarTiles() {
  const sets = [];
  // 五个星区 × 三层视差（2026-10-23）
  // ⚠️ 顺序必须和 game.js 的 ZONES 一致：碎屑 / 星云 / 熔炉 / 奇点 / 结晶。
  //    这里的**底色差异要拉到一眼能认出来** —— 主题不是换一层滤镜，
  //    玩家在跃迁动画那一秒里就该知道「换了个地方」。
  const ZONES = [
    { bg: '#070a18', dots: ['#39456e', '#5a6da8', '#c0cbdc'], neb: null },      // 碎屑带：冷灰蓝
    { bg: '#12082a', dots: ['#5d3a7a', '#9a5cc0', '#e0c8f0'], neb: '#3a1a5c' }, // 星云：品红紫
    { bg: '#170806', dots: ['#6e3a2c', '#c06a3a', '#ffd0a0'], neb: '#4a1408' }, // 熔炉：暗红褐
    { bg: '#04060f', dots: ['#2c3f6e', '#6a7ec0', '#dfe8ff'], neb: '#101a3c' }, // 奇点：近黑靛蓝
    { bg: '#061620', dots: ['#2c6e8a', '#7fd0e8', '#e8fbff'], neb: '#0a2a3a' }, // 结晶：青白冷
  ];
  for (const z of ZONES) {
    const layers = [];
    for (let L = 0; L < 3; L++) {
      const c = newCanvas(64, 64), x = c.getContext('2d');
      if (z.neb && L === 0) {
        x.fillStyle = z.bg; x.fillRect(0, 0, 64, 64);
        // 星云：几团柔和的横椭圆，用像素抖动近似
        let seed = 1337;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let blob = 0; blob < 3; blob++) {
          const bx = rnd() * 64, by = rnd() * 64, br = 12 + rnd() * 18;
          for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
            const dd = Math.hypot((i - bx) * 1.7, j - by) / br;
            if (dd < 1 && rnd() < (1 - dd) * 0.5) {
              x.fillStyle = dd < 0.4 ? z.neb : z.dots[0];
              x.fillRect(i, j, 1, 1);
            }
          }
        }
      } else {
        x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 64, 64);
      }
      let seed = (L + 1) * 7919 + (z.bg.length * 31);
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      const count = [26, 16, 8][L];
      for (let i = 0; i < count; i++) {
        const px = (rnd() * 64) | 0, py = (rnd() * 64) | 0;
        const big = L === 2 && rnd() < 0.3;
        x.fillStyle = z.dots[L === 2 ? (big ? 2 : 1) : L];
        x.fillRect(px, py, 1, 1);
        if (big) { x.fillRect(px + 1, py, 1, 1); x.fillRect(px, py + 1, 1, 1); x.fillRect(px + 1, py + 1, 1, 1); }
      }
      layers.push(c);
    }
    sets.push({ bg: z.bg, layers });
  }
  return sets;
}

/* ============ 舰体配件（可 DIY 的挂载件） ============
   一套美术、两处呈现：
     · 战斗里按 24 向烘焙贴到飞船模型上（drawShipKit）
     · 升级卡 / 图鉴里当图标（attachIcon，转成「机首朝上」再放大）
   所以玩家在卡面上看到的那块东西，就是他马上要装到船上的那块东西 —— 不是两套画。

   坐标 = HULL_SRC 的同一套格子（22x16，机首朝右），原点取船体中心（格 11,8）。
   +x = 机首方向，+y = 右舷（机首朝右时屏幕下方）。船体全长 22 格 = 44 游戏像素。
   每个模块给一个 (lv) => [{x, y, rows}]，rows 是字符画（PAL 键）。
   ⚠️ 等级越高必须「零件更多 / 更长」—— 这条是硬约束，探针会逐模块逐级断言像素数不下降。
      满级要不要镀金（'y'）由各模块自己定：撞角/尾炮/磁暴雷这些镀金，相位外壳/电弧走本色，
      一律刷金反而会让本来就金的东西糊成一片。 */
const ATTACH_ART = (function () {
  const A = (x, y, rows) => ({ x: x, y: y, rows: rows });
  // 垂直居中（机首件、尾件用）
  const C = (x, rows) => ({ x: x, y: -Math.floor(rows.length / 2), rows: rows });
  // 沿 x 轴镜像：行序倒过来，贴到另一舷（两舷对称件用）
  const MV = p => ({ x: p.x, y: -p.y - p.rows.length, rows: p.rows.slice().reverse() });
  const BOTH = p => [p, MV(p)];
  // 外环件：舱体在外、挂架柱固定落在 y=-5（船体边缘上）。
  // ⚠️ 等级越高舱体往上长，**柱脚不动** —— 否则升级会把整块件越顶越远，变成飘在船外。
  const OUT = (x, body, col) => {
    let w = 0;
    for (const r of body) if (r.length > w) w = r.length;
    const mid = w >> 1;
    const prow = '.'.repeat(mid) + col + '.'.repeat(w - mid - 1);
    return A(x, -5 - body.length, body.concat([prow]));
  };
  // ⚠️ 只有「不跨中线」的件才能用 BOTH —— 居中件镜像后落回原地，会画两遍。
  return {
    // ===== 挂载布局 =====
    // 船体（游隼）在本地格里大致占 x∈[-8,8]、y∈[-5,4]，机首尖在 (8,0)。
    // 两舷件分两环，避免 29 件全装时挤成一坨：
    //   内环 y=-6（2~4 行高 → 压住船体边缘，看着就是「贴在舷侧」）
    //   外环（OUT）：舱体在外、挂架柱落在 y=-5，正好踩在船体边缘上 —— 不悬空
    // 机首件沿中线前后排开（x=8 是机首尖），背部件落在船体表面。
    // ---------- 数值型 ----------
    // 装甲板：内环，两舷外挂的灰色装甲片，越升级越长、加铆钉，满级镀金边
    // ⚠️ 别用大片亮色（'W'）铺满：装甲板是 4 行高的整块板，全用亮灰会把船体整个盖住，
    //    远看就是「一块白砖」。深灰打底 + 亮灰高光，宽度也压到 6 格以内。
    armor: lv => BOTH(A(-2, -7, [
      null,
      ['kggk', 'kWWk'],
      ['kggggk', 'kWWWWk'],
      ['kggggk', 'kWWWWk', 'kkkkkk'],
      ['kggggk', 'kyWyWk', 'kyyyyyk'],
    ][lv])),
    // 推进器：内环尾部两具喷口，等级越高喷焰越长（满级转金焰）
    thruster: lv => BOTH(A(-13, -6, [
      null,
      ['kkk', 'kck'],
      ['kkk', 'kck', 'kyk'],
      ['kkkk', 'kcck', 'kyyk'],
      ['kkkk', 'kyyyk', 'kyyyk'],
    ][lv])),
    // 自动装填：船体左舷表面的弹鼓（圆筒 + 待发弹），满级转金
    autoloader: lv => [A(-2, -5, [
      null,
      ['kkkk', 'kWWk'],
      ['kkkk', 'kWsWk', 'kkkk'],
      ['kkkkk', 'kWsWsk', 'kWyyWk', 'kkkkk'],
      ['kkkkk', 'kyWyWk', 'kWyyWk', 'kkkkk'],
    ][lv])],
    // 重型弹头：机首中线加粗的红头弹罩
    warhead: lv => [C(12, [
      null,
      ['kRk', 'kRk'],
      ['kRRk', 'kRRk'],
      ['kRRRk', 'kRRRk', 'kkkkk'],
      ['kRRRk', 'kRRRk', 'kyyyk'],
    ][lv])],
    // 暴击电容：尾部背面的电容罐，满级转金
    critcap: lv => [A(-9, -4, [
      null,
      ['kkk', 'kck'],
      ['kkk', 'kck', 'kkk'],
      ['kkk', 'kck', 'kyk'],
      ['kkk', 'kyk', 'kyk'],
    ][lv])],
    // 磁力线圈：内环两舷的 C 形线圈（开口朝外）
    magnet: lv => BOTH(A(4, -6, [
      null,
      ['kkk', 'kck', 'kkk'],
      ['kkkk', 'kcCk', 'kkkk'],
      ['kkkk', 'kcCk', 'kkkk', 'kkkk'],
      ['kkkk', 'kyYk', 'kkkk', 'kkkk'],
    ][lv])),
    // 纳米修复：背部修复舱 + 绿色十字
    nanorepair: lv => [A(-6, -3, [
      null,
      ['kkkkk', 'klLlk'],
      ['kkkkk', 'klllk', 'klLlk'],
      ['kkkkk', 'klylk', 'klLlk', 'kkkkk'],
    ][lv])],
    // 相位外壳：内环两舷相位护板（暗蓝底 + 亮青描边）
    phasehull: lv => BOTH(A(-9, -6, [
      null,
      ['kkkk', 'kCnk'],
      ['kkkkk', 'kCnnk', 'kkkkk'],
      ['kkkkk', 'kCnnk', 'kCnnk', 'kkkkk'],
      ['kkkkk', 'kCCnk', 'kCCnk', 'kkkkk'],
    ][lv])),
    // 口径校准：机首中线加粗炮管
    caliber: lv => [C(7, [
      null,
      ['kkkk', 'kWWk'],
      ['kkkkk', 'kWWWk', 'kWWWk'],
      ['kkkkkk', 'kWWWWk', 'kWWWWk'],
    ][lv])],
    // 过载超频：右舷背部散热鳍（越升级鳍越多，满级烧红）
    overclock: lv => [A(0, 1, [
      null,
      ['koko', 'koko'],
      ['koko', 'koko', 'koko'],
      ['kRkRk', 'kRkRk', 'kRkRk'],
    ][lv])],

    // ---------- 弹体型 ----------
    // 多联机炮：内环机首段两舷各追加一根枪管
    multigun: lv => BOTH(A(5, -4, [
      null,
      ['kkk', 'kck'],
      ['kkk', 'kck', 'kkk'],
      ['kkkk', 'kcck', 'kkkk'],
    ][lv])),
    // 穿甲弹：机首上方一根细长尖头炮管
    piercer: lv => [A(6, -5, [
      null,
      ['kkkkkk', 'kWWWWk'],
      ['kkkkkkk', 'kWWWWWk'],
      ['kkkkkkkk', 'kWWWWWWk'],
    ][lv])],
    // 高爆弹：机首下方粗短炮管 + 橙色弹头
    hesh: lv => [A(6, 2, [
      null,
      ['kkkk', 'kook'],
      ['kkkkk', 'kooyk'],
      ['kkkkk', 'kooyk', 'kkkkk'],
    ][lv])],
    // 跳弹：外环前段两舷的反射斜板
    ricochet: lv => BOTH(OUT(8, [
      null,
      ['kkkk', 'kWWk'],
      ['kkkkk', 'kWWWk'],
      ['kkkkkk', 'kWWWWk'],
    ][lv], 'W')),
    // 制导弹药：机首上方雷达罩 + 天线
    guided: lv => [A(10, -3, [
      null,
      ['kkk', 'kWk'],
      ['kkk', 'kWk', 'kkk'],
      ['kkk', 'kCk', 'kkk', 'kkk'],
    ][lv])],
    // 散射喷嘴：内环前段两舷的喷嘴组
    spray: lv => BOTH(A(8, -6, [
      null,
      ['kkk', 'kok'],
      ['kkk', 'kok', 'kkk'],
      ['kkkk', 'kook', 'kkkk'],
    ][lv])),
    // 裂变弹芯：机首下方分段弹芯（环环相扣）
    fission: lv => [A(10, 1, [
      null,
      ['kck', 'kck'],
      ['kckk', 'kckc'],
      ['kckck', 'kckck'],
    ][lv])],

    // ---------- 装置型 ----------
    // 战斗无人机：外环两舷的无人机挂架（舱 + 小机体）
    drone: lv => BOTH(OUT(-4, [
      null,
      ['kkk', 'kck'],
      ['kkk', 'kcCk', 'kkk'],
      ['kkkk', 'kcCk', 'kcyk'],
    ][lv], 'c')),
    // 能量护盾：外环两舷护盾发生器（青色圆盘）
    shield: lv => BOTH(OUT(3, [
      null,
      ['kkk', 'kCk'],
      ['kkkk', 'kCCk', 'kkkk'],
      ['kkkkk', 'kCCCk', 'kCCCk', 'kkkkk'],
    ][lv], 'C')),
    // 电弧线圈：背部特斯拉线圈（满级尖端放白）
    arc: lv => [A(3, -4, [
      null,
      ['kkk', 'kCk'],
      ['kkkk', 'kCCk', 'kkk'],
      ['kkkk', 'kwCk', 'kkk'],
    ][lv])],
    // 脉冲核心：右舷背部核心球（青白）
    nova: lv => [A(-3, 2, [
      null,
      ['kCk', 'kCk'],
      ['kCCk', 'kCCk'],
      ['kCwCk', 'kCwCk', 'kkkkk'],
    ][lv])],
    // 静止场：外环两舷紫色场发生器
    stasis: lv => BOTH(OUT(-8, [
      null,
      ['kkk', 'kqk'],
      ['kkkk', 'kqqk', 'kkkk'],
      ['kkkk', 'kqPk', 'kkkk', 'kkkk'],
    ][lv], 'q')),
    // 尾炮：内环船尾向后伸出的炮管
    backshot: lv => BOTH(A(-17, -6, [
      null,
      ['kkk', 'kck'],
      ['kkk', 'kck', 'kkk'],
      ['kkkk', 'kcck', 'kkkk'],
    ][lv])),
    // 冲角装甲：机首最前端的撞角（越升级越长，满级镀金）
    ram: lv => [C(15, [
      null,
      ['kkk', 'kWk'],
      ['kkk', 'kWk', 'kkk'],
      ['kkk', 'kyk', 'kkk', 'kkk'],
    ][lv])],
    // 死亡尾流：外环船尾的灼热排气口
    deathtrail: lv => BOTH(OUT(-16, [
      null,
      ['kkk'],
      ['kkk', 'kok'],
      ['kkk', 'kok', 'kkk'],
    ][lv], 'o')),
    // 噬能回收：外环中段两舷的吸取管（绿色）
    leech: lv => BOTH(OUT(0, [
      null,
      ['kkk', 'kLk'],
      ['kkkk', 'kLlk', 'kkkk'],
      ['kkkk', 'kLlk', 'kLlk'],
    ][lv], 'L')),
    // 轨道长枪：背脊一条从船尾贯穿到机首的长轨道
    lance: lv => [A(-8, -3, [
      null,
      ['kkkkkkkkkkkkkk', 'kWWWWWWWWWWWWk', 'kggggggggggggk'],
      ['kkkkkkkkkkkkkkkk', 'kWWWWWWWWWWWWWWk', 'kggggggggggggggk'],
      ['kkkkkkkkkkkkkkkkkk', 'kWWWWWWWWWWWWWWWWk', 'kggggggggggggggggk'],
    ][lv])],
    // 相位折跃：内环两舷相位鳍（满级亮青）
    blink: lv => BOTH(A(-5, -6, [
      null,
      ['kkk', 'kck'],
      ['kkkk', 'kcck'],
      ['kkkk', 'kCCk', 'kkkk'],
    ][lv])),
    // 磁暴雷：外环船尾的布雷架（挂两枚雷）
    mine: lv => BOTH(OUT(-12, [
      null,
      ['kkk', 'kok'],
      ['kkkk', 'koyk', 'kkkk'],
      ['kkkk', 'koyk', 'koyk'],
    ][lv], 'o')),

    // ---------- 第四批（2026-10-03）----------
    // 孤立协议：机首上方的**测距舷窗**——等级越高玻璃越长并开始泛红。
    //   「先看清哪只是落单的」这件事没有动作，所以配件必须是**观察**类的零件，不能又是炮管。
    isolate: lv => [A(4, -6, [
      null,
      ['kkk', 'kwk'],
      ['kkkk', 'kwCk', 'kkkk'],
      ['kkkkk', 'kwRk', 'kwRk', 'kkkkk'],
    ][lv])],
    // 湮灭指令：机首下方的**断头台刃口**——一级一道白刃，满级连成一排并镀金。
    //   用刀片而不是更多的炮：它加的是「同一发的收尾」，不是「新的一发」。
    execute: lv => [A(9, 2, [
      null,
      ['kw', 'kw'],
      ['kww', 'kww', 'kkk'],
      ['kyy', 'kyy', 'kyy', 'kkk'],
    ][lv])],
    // 拘束立场：外环中段两舷的**紫色钳制器**（张开的两爪对准外侧）。
    //   满级两爪加到三爪 —— 「钉住」这个动作要能从外形读出来。
    bind: lv => BOTH(OUT(-6, [
      null,
      ['kq.kq'],
      ['kqqkqqk'],
      ['kqqkqqkqq'],
    ][lv], 'q')),
    // 时滞回溯：背部的**沙漏型时间锚**——两舱中间收腰，等级越高舱体越长，满级镀金。
    rewind: lv => [A(-4, -4, [
      null,
      ['kkk', 'kCk', 'kkk'],
      ['kkkkk', 'kCCCk', 'kCCCk', 'kkkkk'],
      ['kkkkk', 'kyyyk', 'kCyCk', 'kyyyk', 'kkkkk'],
    ][lv])],
    // ---------- 第五批（2026-10-04，英雄联盟技能主题）----------
    // 风之障壁：机首前方的青色风幕发射条——等级越高风幕越宽、镶白边。
    windwall: lv => [C(11, [
      null,
      ['kCk'],
      ['kCCk', 'kCwk'],
      ['kCCCk', 'kCwwCk', 'kCCCk'],
    ][lv])],
    // 影奥义：船尾的紫色镜像核心——等级越高棱面越多、泛品红。
    shadow: lv => [A(-11, -2, [
      null,
      ['kpk'],
      ['kpqk', 'kpk'],
      ['kppk', 'kqPk', 'kpk'],
    ][lv])],
    // 审判：两舷的旋斩刃盘——等级越高刃环越亮、镶白芯。
    spin: lv => BOTH(A(2, -5, [
      null,
      ['kcCk'],
      ['kcCCk', 'kCwCk'],
      ['kcCCk', 'kCwwCk', 'kcCCk'],
    ][lv])),
    // 死亡莲华：机首下方的橙色刃雨喷口——等级越高花瓣瓣数越多。
    lotus: lv => [A(7, 3, [
      null,
      ['kok'],
      ['kok', 'kook'],
      ['koook', 'koyok', 'kok'],
    ][lv])],
    // 杀戮狂热：背脊的赤红狂热核心——等级越高红芯越烧越亮。
    rampage: lv => [A(-4, -3, [
      null,
      ['kRk'],
      ['kRRk', 'kRrRk'],
      ['kRRRk', 'kRrrRk', 'kRRRk'],
    ][lv])],
    // 圣银弩箭：机首前端的银色弩臂——等级越高镀金弦。
    silver: lv => [C(13, [
      null,
      ['ksk'],
      ['ksssk', 'ksksk'],
      ['kssssk', 'ksyssk', 'ksksk'],
    ][lv])],

    // ===== 第六批（2026-10-09）：冰封长箭 / 瓦解射线 / 爆头协议 / 无尽怒火 / 死亡印记 / 荆棘甲壳 =====
    // 冰封长箭：机首上方的冰晶箭簇——等级越高晶棱越多、泛白芯。
    crystal: lv => [C(6, [
      null,
      ['kwk'],
      ['kCwk', 'kwCk'],
      ['kCCwk', 'kwCCk', 'kCwCk'],
    ][lv])],
    // 瓦解射线：背部的紫色透镜阵列——等级越高镜片越大、泛品红芯。
    beam: lv => [A(-7, -7, [
      null,
      ['kqk'],
      ['kPqk', 'kqwqk'],
      ['kPqqk', 'kqwwqk', 'kPqqk'],
    ][lv])],
    // 爆头协议：两舷的金色瞄准环——等级越高环越亮、镶白芯。
    headshot: lv => BOTH(A(6, -4, [
      null,
      ['kyk'],
      ['kyyk', 'kyWk'],
      ['kyyyk', 'kyWWyk', 'kyyyk'],
    ][lv])),
    // 无尽怒火：船尾的赤红怒焰喷口——等级越高烧得越旺。
    undying: lv => [A(-14, -1, [
      null,
      ['kRk'],
      ['kRoRk', 'kRrk'],
      ['kRRoRk', 'kRrrRk', 'kRoRk'],
    ][lv])],
    // 死亡印记：背顶的紫色符文钉——等级越高符文越多。
    mark: lv => [A(-1, -8, [
      null,
      ['kqk'],
      ['kqpqk', 'kqpk'],
      ['kqppqk', 'kqPpqk', 'kqpqk'],
    ][lv])],
    // 荆棘甲壳：两舷的橙红尖刺排——等级越高刺越长、镶金尖。
    thorns: lv => BOTH(A(3, 3, [
      null,
      ['kok'],
      ['krok', 'koyk'],
      ['krror', 'koyyk', 'krok'],
    ][lv])),
  };
})();

// 配件缓存：key 只放有界集合（id|等级|白闪），绝不放逐帧变化的量
const _acache = {};
const _rowsAny = rows => {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) if (r[i] !== '.' && PAL[r[i]]) return true;
  }
  return false;
};
// 取某模块某等级的零件表；没有美术 / 空零件一律返回 null（调用方直接跳过）
function attachParts(id, lv) {
  const f = ATTACH_ART[id];
  if (!f || !(lv >= 1)) return null;
  let ps; try { ps = f(lv | 0); } catch (e) { return null; }
  if (!ps || !ps.length) return null;
  const out = [];
  for (const p of ps) {
    if (!p || !p.rows || !p.rows.length) continue;
    if (_rowsAny(p.rows)) out.push(p);
  }
  return out.length ? out : null;
}
// 把零件合成到一张「1 像素 = 1 格」的画布上，并给出中心（格坐标，相对船体中心）
// solo = true 时只取主件（图标用，见 _iconParts）
function attachFlat(id, lv, solo) {
  const key = 'f|' + id + '|' + lv + (solo ? '|s' : '');
  if (key in _acache) return _acache[key];
  let ps = attachParts(id, lv);
  if (!ps) return (_acache[key] = null);
  if (solo) ps = _iconParts(ps);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of ps) {
    let w = 0; for (const r of p.rows) if (r.length > w) w = r.length;
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + w); y1 = Math.max(y1, p.y + p.rows.length);
  }
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return (_acache[key] = null);
  const c = newCanvas(w, h), x = c.getContext('2d');
  for (const p of ps) x.drawImage(spriteFrom(p.rows), p.x - x0, p.y - y0);
  return (_acache[key] = { cv: c, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: w, h: h });
}
// 上舰：1 格 = 2 游戏像素，再按 24 向烘焙（和船体同一套 dirIndex，朝向才不会打架）
function attachSprite(id, lv, white) {
  const key = 's|' + id + '|' + lv + '|' + (white ? 1 : 0);
  if (key in _acache) return _acache[key];
  const fl = attachFlat(id, lv);
  if (!fl) return (_acache[key] = null);
  const big = scaled(fl.cv, 2);
  const set = bakeRotation(white ? tinted(big, '#ffffff') : big, 24);
  // ox/oy = 挂载点相对船体中心的偏移（游戏像素）。烘焙绕自身包围盒中心转，
  // 所以把这个中心旋转后平移到世界坐标即可 —— 和船体是同一个刚体旋转。
  return (_acache[key] = { set: set, ox: fl.cx * 2, oy: fl.cy * 2 });
}
// 图标只取「一块」：两舷成对的件（BOTH）在图标里会变成相隔很远的两个小点，
// 中间全是空的 —— 缩放被撑到最小，什么都看不清。判据是「两块互为上下镜像」，也就是 MV 出来的。
function _iconParts(ps) {
  if (ps.length === 2) {
    const a = ps[0], b = ps[1];
    if (a.x === b.x && b.y === -a.y - a.rows.length && a.rows.length === b.rows.length) {
      const rev = b.rows.slice().reverse();
      let same = true;
      for (let i = 0; i < rev.length; i++) if (rev[i] !== a.rows[i]) { same = false; break; }
      if (same) return [a];
    }
  }
  return ps;
}
// 图标：转成「机首朝上」再整数放大填进 size×size 的方框（卡面 44 / 图鉴 40）
function attachIcon(id, lv, size) {
  size = size || 44;
  const key = 'i|' + id + '|' + lv + '|' + size;
  if (key in _acache) return _acache[key];
  const fl = attachFlat(id, lv, true);
  if (!fl) return (_acache[key] = null);
  // -90°：机首(+x) 转到屏幕上方。90 的整数倍是精确像素搬运，不会糊边。
  // ⚠️ translate 的量是**源宽**（fl.w），不是源高 —— 输出画布是 (高, 宽)，
  //    像素 (i,j) 映射到 (j, W-i)，不补 W 的话整块会掉到画布下面（实测 13/29 张图标全空）。
  const rot = newCanvas(fl.h, fl.w), rx = rot.getContext('2d');
  rx.imageSmoothingEnabled = false;
  rx.translate(0, fl.w); rx.rotate(-Math.PI / 2);
  rx.drawImage(fl.cv, 0, 0);
  // 让图形尽量填满卡面：最大边取 ≈ 0.82·size 的**整数**倍率（像素风只能整数放大，否则边缘糊掉）。
  // ⚠️ 倍率上限别卡太小：一级配件常常只有 3×2 格，卡在 8 倍就只剩 16×24 px，
  //    在 40px 的卡面上糊成一个小蓝点，玩家根本认不出这是哪张卡（实测 尾炮/多联机炮 长一个样）。
  let k = Math.floor((size * 0.82) / Math.max(rot.width, rot.height));
  k = Math.max(1, Math.min(16, k));
  const w = rot.width * k, h = rot.height * k;
  const out = newCanvas(size, size), ox = out.getContext('2d');
  ox.imageSmoothingEnabled = false;
  ox.drawImage(rot, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
  return (_acache[key] = out);
}

/* ============ 地形贴图（2026-10-21）============
   「可躲闪的地形」的像素素材。和 makeRocks 的区别必须记牢：
     · makeRocks  = **背景装饰**（有视差、半透明、永远不参与判定）
     · 这一套      = **场地**（世界坐标、挡人挡弹、可被打碎）
   两者共用 PAL，但绝不能互相取图 —— 拿装饰岩去当掩体的结果是「看着能躲、实际会穿」。

   两种地块，靠**纹理**区分而不是靠颜色浓淡（弹幕糊脸时没人分得清两档灰）：
     core 骨架墙  —— 有青色能量导管，打不碎
     rock 可破坏岩 —— 有黑色裂纹，打碎了掉星尘

   ⚠️ tile 里**不能画边框** —— 边框是整块 slab 铺完 tile 之后补的。
      画在 tile 里会在每个 24px 接缝上留下一条线，整块看起来像方格纸。
   ⚠️ tile 必须**无缝**：所有斑点都落在 [1,22] 内、绝不碰边缘，这样任意平铺都不露接缝。 */
function makeTerrainTiles() {
  // 确定性伪随机：同一个 seed 永远得到同一张图（截图回归探针靠这个）
  const prng = seed => {
    let x = (seed >>> 0) || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  };
  function one(p, isRock, seed) {
    const base = isRock ? p.rb : p.base, hi = isRock ? p.rh : p.hi, lo = isRock ? p.rl : p.lo;
    const crack = isRock ? p.crack : null, accent = isRock ? null : p.accent;
    const c = newCanvas(24, 24), x = c.getContext('2d');
    const r = prng(seed);
    x.fillStyle = base; x.fillRect(0, 0, 24, 24);
    for (let i = 0; i < 26; i++) {
      const px = 1 + ((r() * 22) | 0), py = 1 + ((r() * 22) | 0);
      x.fillStyle = r() < 0.5 ? hi : lo;
      const s = r() < 0.3 ? 2 : 1;
      x.fillRect(px, py, s, s);
    }
    // 裂纹：可破坏岩的身份标识（骨架没有 —— 它就是「打不碎」的意思）
    if (crack) {
      x.fillStyle = crack;
      let cx = 4 + ((r() * 13) | 0);
      for (let i = 0; i < 9; i++) {
        x.fillRect(cx, 3 + i, 1, 1);
        if (r() < 0.55) cx += r() < 0.5 ? 1 : -1;
        cx = cx < 3 ? 3 : cx > 20 ? 20 : cx;
      }
    }
    // 能量导管：骨架的身份标识（横向两段 + 纵向两段，断口错开 = 看着像走线）
    if (accent) {
      x.fillStyle = accent;
      x.fillRect(4, 10, 7, 1); x.fillRect(14, 13, 6, 1);
      x.fillRect(11, 4, 1, 5); x.fillRect(12, 16, 1, 4);
    }
    return c;
  }
  /* 五个星区各一套（顺序同 ZONES）。⚠️ 换的**不只是色相** ——
     每区的 hero 元素也不同：导管 / 晶簇 / 熔缝 / 引力纹 / 棱线，
     这样在弹幕糊脸、只看见一小块的时候也能认出自己在哪。 */
  const TERR_PAL = [
    // 碎屑带：冷灰蓝岩 + 青色能量导管
    { base: '#333c57', hi: '#566c86', lo: '#242a44', rb: '#3a4468', rh: '#6a5580', rl: '#242a44', accent: '#41a6f6', crack: '#1a1c2c' },
    // 星云：紫晶 + 品红导管
    { base: '#3a2a52', hi: '#6a5580', lo: '#241a38', rb: '#46305e', rh: '#8a5ca0', rl: '#2a1c3c', accent: '#e05cd0', crack: '#140c1e' },
    // 熔炉：焦褐玄武岩 + 橙红熔缝（accent 画的不是导管，是岩缝里透出来的岩浆）
    { base: '#4a3028', hi: '#7a4a34', lo: '#2a1810', rb: '#54362a', rh: '#8a5238', rl: '#2e1a12', accent: '#ef7d57', crack: '#16080a' },
    // 奇点：深靛 + 蓝白引力纹
    { base: '#2a3350', hi: '#465c8a', lo: '#161c30', rb: '#303c5c', rh: '#4e689a', rl: '#1a2038', accent: '#8ad0ff', crack: '#0a0e1a' },
    // 结晶：冰青棱面 + 亮蓝棱线
    { base: '#28444e', hi: '#4a7a86', lo: '#16262e', rb: '#2e4e5a', rh: '#5a8e9c', rl: '#1a2c34', accent: '#a8f0ff', crack: '#0c1a20' },
  ];
  const out = [];
  for (let z = 0; z < TERR_PAL.length; z++) {
    const p = TERR_PAL[z], core = [], rock = [];
    for (let i = 0; i < 4; i++) {
      core.push(one(p, false, 1013 + i * 977 + z * 7919));
      rock.push(one(p, true, 5507 + i * 613 + z * 6113));
    }
    out.push({ core, rock });
  }
  return out;
}
let _ttile = null;
const terrainTiles = z => (_ttile || (_ttile = makeTerrainTiles()))[z] || _ttile[0];
/* 整块 slab：tile 平铺 + 边框。
   ⚠️ 只在**生成地形时**调用（一局也就几十次），结果按 kind|w|h|seed 缓存；
      每帧的 drawTerrain 只做一次 drawImage。 */
const _slabCache = new Map();
function bakeSlab(kind, w, h, seed, zone) {
  const key = kind + '|' + w + '|' + h + '|' + seed + '|' + (zone || 0);
  const hit = _slabCache.get(key);
  if (hit) return hit;
  const T = terrainTiles(zone || 0);
  const tiles = T[kind] || T.rock;
  const c = newCanvas(w, h), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  let n = 0;
  for (let ty = 0; ty < h; ty += 24)
    for (let tx = 0; tx < w; tx += 24) {
      const v = tiles[(((tx / 24) + (ty / 24) * 3 + seed + (n++)) % 4 + 4) % 4];
      x.drawImage(v, tx, ty);
    }
  // 边框：外 1px 压黑（从星野背景里立住）+ 顶/左受光 + 底/右背光
  x.fillStyle = '#1a1c2c';
  x.fillRect(0, 0, w, 1); x.fillRect(0, h - 1, w, 1);
  x.fillRect(0, 0, 1, h); x.fillRect(w - 1, 0, 1, h);
  x.fillStyle = '#8b93a8';
  x.fillRect(1, 1, w - 2, 1); x.fillRect(1, 1, 1, h - 2);
  x.fillStyle = '#242a44';
  x.fillRect(1, h - 2, w - 2, 1); x.fillRect(w - 2, 1, 1, h - 2);
  if (_slabCache.size > 240) _slabCache.clear();
  _slabCache.set(key, c);
  return c;
}

// 小行星（背景装饰，按区着色）
function makeRocks() {
  const out = [];
  const rows = [
    '..kkkk..',
    '.kggggk.',
    'kgWWggWk',
    'kgWggggk',
    'kgggWggk',
    '.kggggk.',
    '..kkkk..',
  ];
  // 五个星区各一色（顺序同 ZONES）：灰蓝碎屑 / 紫晶星云 / 焦褐熔炉 / 深靛奇点 / 冰青结晶
  for (const col of ['#566c86', '#6a5580', '#8a5340', '#3a4468', '#4a8a9a']) {
    const s = spriteFrom(rows);
    const t = tinted(s, col), tb = scaled(tinted(s, col), 2);
    // 旋转**预烘焙**（和船体同一套做法），不要每帧 rotate()：
    //   ① 背景装饰岩有 12 块，每帧 12 次 save/translate/rotate/drawImage/restore；
    //   ② 主画布关掉图像平滑之后（见 game.js 的 ctx.imageSmoothingEnabled），
    //      逐帧任意角度的最近邻旋转会转成抖动的锯齿边 —— 预烘焙是固定 24 向，不抖。
    out.push({ s: t, big: tb, rot: bakeRotation(t, 24), rotBig: bakeRotation(tb, 24) });
  }
  return out;
}
