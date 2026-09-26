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
  // 游隼：流线隼形 + 燕尾（echo: 18,0 → 9,5.5 → -3,8.5 → 燕尾叉）
  peregrine: [[
    '......................',
    '......................',
    '......................',
    '.....kkkkk............',
    '.....knCCCkkk.........',
    '...kkCnCCCCCCkk.......',
    '...kCCnbbbbbbbbkk.....',
    '...kCCnbbbbbwwbbbkk...',
    '...kCCnbbbbbwwbbbkk...',
    '...kCCnbbbbbbbbkk.....',
    '...kkCnbbbbbbkk.......',
    '.....knbbbkkk.........',
    '.....kkkkk............',
    '......................',
    '......................',
    '......................',
  ]],
  // 轻剑：纤细剑身 + 对称后掠双翼（剑尖 + 燕尾）
  rapier: [[
    '......................',
    '......................',
    '.k....................',
    'krk...................',
    '.krkk.................',
    '.kyyykkkkk............',
    '.kyyyrroookkkkkkkkk...',
    '.kyyyrroooooowwwoook..',
    '.kyyyrroooooowwwoook..',
    '.kyyyrroookkkkkkkkk...',
    '.kyyykkkkk............',
    '.krkk.................',
    'krk...................',
    '.k....................',
    '......................',
    '......................',
  ]],
  // 堡垒：宽厚六边装甲
  bulwark: [[
    '......................',
    '......kkkkkkkk........',
    '......kGGGGGGk........',
    '.....kLLLLLLLk........',
    '....kGlllllllk........',
    '..kklGllllllllk.......',
    '..kllGLLLLLLLLLk......',
    '..kllGLLLLwwLLLlk.....',
    '..kllGLLLLwwLLLlk.....',
    '..kllGLLLLLLLLLk......',
    '..kklGLLLLLLLLk.......',
    '....kGLLLLLLLk........',
    '.....kLLLLLLLk........',
    '......kGGGGGGk........',
    '......kkkkkkkk........',
    '......................',
  ]],
  // 玄鸦：W 形隐形战机
  raven: [[
    '.....k................',
    '...kkpk...............',
    '....kppk..............',
    '....kpPPk.............',
    '.....kqqqk............',
    '....kpqqqqkk..........',
    '..kkqpPPPPPPkkk.......',
    '.kqqqpPPPPPwwwPkkk....',
    '.kqqqpPPPPPwwwPkkk....',
    '..kkqpPPPPPPkkk.......',
    '....kpPPPPkk..........',
    '.....kPPPk............',
    '....kpPPk.............',
    '....kppk..............',
    '...kkpk...............',
    '.....k................',
  ]],
  // 蜂群：圆头 + 双侧蜂翅 + 尾部蜇针
  swarm: [[
    '......................',
    '......................',
    '...kkk................',
    '....kyk...............',
    '....kYYkkk............',
    '.....kYYYYkkkk........',
    '..kkkyyyyyyyyykk......',
    'kkYooyyyyywwyyyYk.....',
    'kkYooyyyyywwyyyYk.....',
    '..kkkyyyyyyyyykk......',
    '.....kyyyykkkk........',
    '....kyykkk............',
    '....kyk...............',
    '...kkk................',
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
  motherrock: [[
    '.....kkkkkkkkkk.....',
    '...kkWWWWWWWWWWkk...',
    '..kWWWWggggWWWWWWk..',
    '.kWWWgggggggggWWWWk.',
    'kWgggggggggggggggWgk',
    'kWgggdWWggggdWWggggk',
    'kgggdRRRRgggdRRRRggk',
    'kgggWRRRRgggWRRRRggk',
    'kggggggggggggggggggk',
    'kWggggggggggggggggWk',
    '.kWggggggggggggggWk.',
    '..kkWWggggggggWWkk..',
    '...kkkWWWWWWWWkkk...',
  ]],
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
    '....kkkkkkkkkkkk....',
  ]],
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
    '.....kkkkkkkkkk.....',
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
let BULLET_SET = null;

function buildSprites() {
  for (const k in SPR_SRC) SPR[k] = makeSet(SPR_SRC[k], ENEMY_SPR_SCALE);
  // ⚠️ 拾取物**不放大**：星尘 / 治疗 / 能量本来就是按 1x 设计的，
  //    而且「敌人比星尘大」正是这次改动的目的，把星尘一起放大等于没改。
  for (const k in PICK_SRC) SPR[k] = makeSet(PICK_SRC[k]);
  for (const k in BOSS_SRC) SPR[k] = makeSet(BOSS_SRC[k], BOSS_SPR_SCALE);
  // 船体：2x 放大后烘焙 24 向
  for (const k in HULL_SRC) {
    const base = scaled(spriteFrom(HULL_SRC[k][0]), 2);
    SHIPSET[k] = bakeRotation(base, 24);
    SHIPSET[k].white = bakeRotation(tinted(base, '#ffffff'), 24);
  }
  // 玩家弹：细针（青白），朝右
  const nb = newCanvas(9, 3), nx = nb.getContext('2d');
  nx.fillStyle = '#0b2a3a'; nx.fillRect(0, 0, 9, 3);
  nx.fillStyle = '#73eff7'; nx.fillRect(1, 1, 7, 1);
  nx.fillStyle = '#f4f4f4'; nx.fillRect(3, 1, 5, 1);
  BULLET_SET = bakeRotation(nb, 24);
}
// 玩家弹的配色变体：尾炮（橙）/ 满级尾炮（金）需要在屏幕上一眼分得出来。
// 缓存 key 只有几个固定色字符串 —— 有界集合，符合精灵缓存纪律。
// 注意：不能直接 tinted()，那会把弹芯的白色一起吃掉，弹丸就糊成一坨色块了。
const _pvar = {};
function bulletSetFor(color) {
  if (!color) return BULLET_SET;
  if (_pvar[color]) return _pvar[color];
  const nb = newCanvas(9, 3), nx = nb.getContext('2d');
  nx.fillStyle = '#0b2a3a'; nx.fillRect(0, 0, 9, 3);
  nx.fillStyle = color;     nx.fillRect(1, 1, 7, 1);
  nx.fillStyle = '#f4f4f4'; nx.fillRect(3, 1, 5, 1);
  return (_pvar[color] = bakeRotation(nb, 24));
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
function drawBulletSet(ctx, ang, x, y, color) {
  const S = bulletSetFor(color);
  ctx.drawImage(S.imgs[dirIndex(ang, S.n)], Math.round(x - S.half), Math.round(y - S.half));
}

// ============ 星空背景 tile（每层视差一套，64x64 无缝） ============
function makeStarTiles() {
  const sets = [];
  // 三个星区 × 三层视差
  const ZONES = [
    { bg: '#070a18', dots: ['#39456e', '#5a6da8', '#c0cbdc'], neb: null },
    { bg: '#12082a', dots: ['#5d3a7a', '#9a5cc0', '#e0c8f0'], neb: '#3a1a5c' },
    { bg: '#04060f', dots: ['#2c3f6e', '#6a7ec0', '#dfe8ff'], neb: '#101a3c' },
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
  for (const col of ['#566c86', '#6a5580', '#3a4468']) {
    const s = spriteFrom(rows);
    out.push({ s: tinted(s, col), big: scaled(tinted(s, col), 2) });
  }
  return out;
}
