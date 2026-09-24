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

const SPR = {};
// 注意：不能叫 HULLS —— game.js 里的船体数据表叫这个名字，两个文件都是全局作用域会冲突
const SHIPSET = {};
let BULLET_SET = null;

function buildSprites() {
  for (const k in SPR_SRC) SPR[k] = makeSet(SPR_SRC[k]);
  for (const k in PICK_SRC) SPR[k] = makeSet(PICK_SRC[k]);
  for (const k in BOSS_SRC) SPR[k] = makeSet(BOSS_SRC[k], 2);
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
