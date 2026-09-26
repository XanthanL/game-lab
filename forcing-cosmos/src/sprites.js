'use strict';
// 像素精灵：全部用调色板字符串定义，运行时烘焙到离屏 canvas（零外部美术资源）。
// 与 last-firewall 同源：Sweetie 16 调色板 + palette-string sprite。
const PAL = {
  k: '#1a1c2c', w: '#f4f4f4', W: '#c0cbdc', b: '#3b5dc9', n: '#29366f', c: '#41a6f6', C: '#73eff7',
  g: '#566c86', d: '#333c57', o: '#ef7d57', y: '#ffcd75', r: '#b13e53', R: '#e04060',
  p: '#5d275d', P: '#8a3cc0', q: '#c070f0', L: '#38b764', l: '#a7f070', G: '#257179',
  m: '#8a2b2b', s: '#6b3b2a', t: '#e8a35a',
};

function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// 行长度不齐时自动居中，方便手写（last-firewall 版是左对齐）
function spriteFrom(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = newCanvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    const pad = (w - rows[j].length) >> 1;
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch !== '.' && PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i + pad, j, 1, 1); }
    }
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
  // 允许单帧简写：['row','row'] 等价于 [['row','row']]
  if (typeof frames[0] === 'string') frames = [frames];
  let fr = frames.map(spriteFrom);
  if (s !== 1) fr = fr.map(f => scaled(f, s));
  const set = { w: fr[0].width, h: fr[0].height, r: fr, l: fr.map(flipped) };
  set.wr = set.r.map(f => tinted(f, '#ffffff')); set.wl = set.l.map(f => tinted(f, '#ffffff'));
  set.gr = set.r.map(f => tinted(f, '#ffcd75')); set.gl = set.l.map(f => tinted(f, '#ffcd75'));
  return set;
}

/* ============================================================
 * 乘员（4 职业）· 20x22 基准，战场按 3 倍显示
 * ============================================================ */
const CREW_SRC = {
  astronaut: [[
    '.....kkkkkkkkkk.....',
    '...kkWWWWWWWWWWkk...',
    '..kWWWWWWWWWWWWWWk..',
    '..kWkkCCwwwwCCkkWk..',
    '..kWkkCCwwwwCCkkWk..',
    '..kWWWWWWWWWWWWWWk..',
    '...kWWwWWWWWWwWWk...',
    '....kbbbbbbbbbbk....',
    '..kkbbbbbbbbbbbbkk..',
    '.kbbbCCbbbbbbCCbbbk.',
    '.kbbbbbbbbbbbbbbbbk.',
    '.kbbbwwbbbbbbwwbbbk.',
    '.kbbbbbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbbbbbk.',
    '..kbbbbbbbbbbbbbbk..',
    '..kbbbk.kkkk.kbbbk..',
    '..kbbk...kk...kbbk..',
    '..kkk....kk....kkk..',
  ], [
    '.....kkkkkkkkkk.....',
    '...kkWWWWWWWWWWkk...',
    '..kWWWWWWWWWWWWWWk..',
    '..kWkkCCwwwwCCkkWk..',
    '..kWkkCCwwwwCCkkWk..',
    '..kWWWWWWWWWWWWWWk..',
    '...kWWwWWWWWWwWWk...',
    '....kbbbbbbbbbbk....',
    '..kkbbbbbbbbbbbbkk..',
    '.kbbbCCbbbbbbCCbbbk.',
    '.kbbbbbbbbbbbbbbbbk.',
    '.kbbbwwbbbbbbwwbbbk.',
    '.kbbbbbbbbbbbbbbbbk.',
    '..kbbbbbbbbbbbbbbk..',
    '..kbbbbbbbbbbbbbbk..',
    '..kbbbk.kkkk.kbbbk..',
    '..kkk..k.kk.k..kkk..',
    '.......k.kk.k.......',
  ]],
  engineer: [[
    '.....kkkkkkkkkk.....',
    '...kkkLLLLLLLLkkk...',
    '..kLLLLLLLLLLLLLLk..',
    '..kLkkyywwwwyykkLk..',
    '..kLLkkyyyykkkLLLk..',
    '..kLLLLLLLLLLLLLLk..',
    '...kLLwwLLLLwwLLk...',
    '....kLLLLLLLLLLk....',
    '..kkLLggggggggLLkk..',
    '.kLLLggyyyyyyggLLLk.',
    '.kLLLggyyyyyyggLLLk.',
    '.kLLLLggggggggLLLLk.',
    '.kLLLLLLLLLLLLLLLLk.',
    '.kLLLLLLLLLLLLLLLLk.',
    '..kLLLLLLLLLLLLLLk..',
    '..kLLLk.kkkk.kLLLk..',
    '..kLLk...kk...kLLk..',
    '..kkk....kk....kkk..',
  ], [
    '.....kkkkkkkkkk.....',
    '...kkkLLLLLLLLkkk...',
    '..kLLLLLLLLLLLLLLk..',
    '..kLkkyywwwwyykkLk..',
    '..kLLkkyyyykkkLLLk..',
    '..kLLLLLLLLLLLLLLk..',
    '...kLLwwLLLLwwLLk...',
    '....kLLLLLLLLLLk....',
    '..kkLLggggggggLLkk..',
    '.kLLLggyyyyyyggLLLk.',
    '.kLLLggyyyyyyggLLLk.',
    '.kLLLLggggggggLLLLk.',
    '.kLLLLLLLLLLLLLLLLk.',
    '.kLLLLLLLLLLLLLLLLk.',
    '..kLLLLLLLLLLLLLLk..',
    '..kLLLk.kkkk.kLLLk..',
    '..kLLk.k.kk.k.kLLk..',
    '.......k.kk.k.......',
  ]],
  mutant: [[
    '.......kkkkkk.......',
    '....kkPPPPPPPPkk....',
    '..kkPPPPPPPPPPPPkk..',
    '.kPPPqqPPPPPPqqPPPk.',
    '.kPPqqqPPPPPPqqqPPk.',
    '.kPPPPPPPwwPPPPPPPk.',
    '.kPPPPPPwwwwPPPPPPk.',
    '..kPPPPPPPPPPPPPPk..',
    '.kpPPPPPPPPPPPPPPpk.',
    'kpPPqPPPPPPPPPPqPPpk',
    'kPPPPqPPPPPPPPqPPPPk',
    'kPPPPPPPPPPPPPPPPPPk',
    '.kPPPPPPqqqqPPPPPPk.',
    '.kpPPPPqqqqqqPPPPpk.',
    '..kpPPPPPPPPPPPPpk..',
    '..kpPPk.kkkk.kPPpk..',
    '...kkk...kk...kkk...',
    '.........kk.........',
  ], [
    '.......kkkkkk.......',
    '....kkPPPPPPPPkk....',
    '..kkPPPPPPPPPPPPkk..',
    '.kPPPqqPPPPPPqqPPPk.',
    '.kPPqqqPPPPPPqqqPPk.',
    '.kPPPPPPPwwPPPPPPPk.',
    '.kPPPPPPwwwwPPPPPPk.',
    '..kPPPPPPPPPPPPPPk..',
    '.kpPPPPPPPPPPPPPPpk.',
    'kpPPqPPPPPPPPPPqPPpk',
    'kPPPPqPPPPPPPPqPPPPk',
    '.kPPPPPPPPPPPPPPPPk.',
    '.kpPPPPPPqqqqPPPPpk.',
    '..kpPPPPqqqqqqPPpk..',
    '..kpPPPPPPPPPPPPpk..',
    '..kpPPk.kkkk.kPPpk..',
    '...kkk.k.kk.k.kkk...',
    '.......k.kk.k.......',
  ]],
  assault: [[
    '......kkkkkkkk......',
    '....kkoRRRRRRookk...',
    '...koRRRRRRRRRRok...',
    '...kRkkRRRRRRkkRk...',
    '...kRkyyRRRRyykRk...',
    '...koRRRRRRRRRRok...',
    '....kooRRRRRRook....',
    '..kkmmmmmmmmmmmmkk..',
    '.kmmmmmmmmmmmmmmmmk.',
    '.kmmRRmmmmmmmmRRmmk.',
    '.kmmmmmmmmmmmmmmmmk.',
    '.kmmmmRRRRRRRRmmmmk.',
    '.kmmmmmmmmmmmmmmmmk.',
    '.kmmmmmmmmmmmmmmmmk.',
    '..kmmmmmmmmmmmmmmk..',
    '..kmmk..kkkk..kmmk..',
    '..kkk....kk....kkk..',
    '.........kk.........',
  ], [
    '......kkkkkkkk......',
    '....kkoRRRRRRookk...',
    '...koRRRRRRRRRRok...',
    '...kRkkRRRRRRkkRk...',
    '...kRkyyRRRRyykRk...',
    '...koRRRRRRRRRRok...',
    '....kooRRRRRRook....',
    '..kkmmmmmmmmmmmmkk..',
    '.kmmmmmmmmmmmmmmmmk.',
    '.kmmRRmmmmmmmmRRmmk.',
    '.kmmmmmmmmmmmmmmmmk.',
    '.kmmmmRRRRRRRRmmmmk.',
    '.kmmmmmmmmmmmmmmmmk.',
    '.kmmmmmmmmmmmmmmmmk.',
    '..kmmmmmmmmmmmmmmk..',
    '..kmmk..kkkk..kmmk..',
    '..kkk..k.kk.k..kkk..',
    '.......k.kk.k.......',
  ]],
};

/* ============================================================
 * 敌人 · 三幕
 * ============================================================ */
const FOE_SRC = {
  /* --- 第一幕 火星 --- */
  marsLeech: [[
    '..k......k..',
    '...k....k...',
    '..kkRRRRkk..',
    '.kRRRRRRRRk.',
    'kRRoRRRRoRRk',
    'kRRRRRRRRRRk',
    'kRRRRRRRRRRk',
    '.kkRRRRRRkk.',
    '..k.kk.kk.k.',
  ], [
    '....k..k....',
    '...k....k...',
    '..kkRRRRkk..',
    '.kRRRRRRRRk.',
    'kRRoRRRRoRRk',
    'kRRRRRRRRRRk',
    '.kRRRRRRRRk.',
    '..kkRRRRkk..',
    '..k.kk.kk.k.',
  ]],
  duneStalker: [[
    'k...........k',
    'kk.........kk',
    '.kk.......kk.',
    '..koooooook..',
    '.koooyyyooook',
    'kooyoooooyook',
    'koooooooooook',
    '.koooookooo k',
    '..k..k..k..k.',
    '.k..k....k..k',
  ], [
    '..k.......k..',
    '.kk.......kk.',
    '..kk.....kk..',
    '..koooooook..',
    '.koooyyyooook',
    'kooyoooooyook',
    'koooooooooook',
    '.koooookooo k',
    '.k..k...k..k.',
    'k..k.....k..k',
  ]],
  lavaSpider: [[
    'k..k.....k..k',
    '.kkk.....kkk.',
    '..kk.....kk..',
    '...kkRRRkk...',
    '..kRmRRRRmRk.',
    '.kRmRRRRRmRk.',
    '.kRRRmRmRRRk.',
    '.kRRoRRRoRRk.',
    '..kkRRRRRkk..',
    '...k.k.k.k...',
  ], [
    '..k..k.k..k..',
    '.kkk.....kkk.',
    '...kk...kk...',
    '...kkRRRkk...',
    '..kRmRRRRmRk.',
    '.kRmRRRRRmRk.',
    '.kRRRmRmRRRk.',
    '.kRRoRRRoRRk.',
    '..kkRRRRRkk..',
    '..k..k.k..k..',
  ]],

  /* --- 第二幕 小行星带 --- */
  rockCrab: [[
    '.kk.........kk.',
    'kgkg.......gkgk',
    '.kkg.......gkk.',
    '..kkgWWWWgkk...',
    '.kgkWWggWWgkgk.',
    'kgkWWggggWWkgk.',
    'kkgWWggggWWgkk.',
    '..kWWgggggWWk..',
    '..kgWWWWWWWgk..',
    '...kk.kkk.kk...',
    '..k...k.k...k..',
  ], [
    '..kk.......kk..',
    '.kgkg.....gkgk.',
    '..kkg.....gkk..',
    '...kkgWWWWgkk..',
    '..kgkWWggWWgkgk',
    '.kgkWWggggWWkgk',
    '.kkgWWggggWWgkk',
    '..kWWgggggWWk..',
    '..kgWWWWWWWgk..',
    '...kk.kkk.kk...',
    '..k...k.k...k..',
  ]],
  crystalParasite: [[
    '...kk....kk...',
    '..kCCk..kCCk..',
    '..kCqCkkCqCk..',
    '...kCqCCqCk...',
    '..kkCqqqqCkk..',
    '.kCqCqqqqCqCk.',
    'kCCqCqqqqCqCCk',
    '.kCCqCqqCqCCk.',
    '..kkCCqqCCkk..',
    '....kCCCCk....',
    '.....kkkk.....',
  ], [
    '....k....k....',
    '...kCk..kCk...',
    '..kCqCkkCqCk..',
    '..kkCqCCqCkk..',
    '.kCqCqqqqCqCk.',
    'kCCqCqqqqCqCCk',
    '.kCCqCqqCqCCk.',
    '..kkCCqqCCkk..',
    '...kCCqqCCk...',
    '....kCCCCk....',
    '.....kkkk.....',
  ]],
  gravityWarp: [[
    '....kkkkkk....',
    '..kkppppppkk..',
    '.kppPPPPPPppk.',
    'kpPPPPPPPPPPpk',
    'kpPPPkkkkPPPpk',
    'kpPPkqqqqkPPpk',
    'kpPPkqwwqkPPpk',
    'kpPPkqqqqkPPpk',
    'kpPPPkkkkPPPpk',
    'kpPPPPPPPPPPpk',
    '.kppPPPPPPppk.',
    '..kkppppppkk..',
  ], [
    '...kkkkkkkk...',
    '..kppppppppk..',
    '.kpPPPPPPPPpk.',
    'kpPPPkkkkPPPpk',
    'kpPPkqwwwwqPPk',
    'kpPPkqwCCwqPPk',
    'kpPPkqwCCwqPPk',
    'kpPPkqwwwwqPPk',
    'kpPPPkkkkPPPpk',
    'kpPPPPPPPPPPpk',
    '.kpPPPPPPPPpk.',
    '..kkppppppkk..',
  ]],
  voidLeech: [[
    '...k......k...',
    '..kk......kk..',
    '.kPPk....kPPk.',
    '.kPqPk..kPqPk.',
    'kkPqqPkkPqqPkk',
    'kPPqqqqqqqqPPk',
    '.kPPqqqqqqPPk.',
    '..kPPqqqqPPk..',
    '...kPPPPPPk...',
    '....kkkkkk....',
  ], [
    '..k........k..',
    '..kk......kk..',
    '.kPPk....kPPk.',
    'kkPqPk..kPqPkk',
    'kPPqqPkkPqqPPk',
    '.kPPqqqqqqPPk.',
    '..kPPqqqqPPk..',
    '...kPPqqPPk...',
    '....kPPPPk....',
    '.....kkkk.....',
  ]],
  magmaGolem: [[
    '..kkkkkkkkkk..',
    '.kmmmmmmmmmmk.',
    'kmmoRRRRRRommk',
    'kmoRRRRRRRROmk',
    'kmRRyyRRyyRRmk',
    'kmRRRRRRRRRRmk',
    'kmoRRRRRRRROmk',
    'kmmRRRRRRRRmmk',
    'kmmRRRRRRRRmmk',
    '.kmmRRRRRRmmk.',
    '.kmmk.kk.kmmk.',
    '..kk...kk..kk.',
  ], [
    '..kkkkkkkkkk..',
    '.kmmmmmmmmmmk.',
    'kmmoRRRRRRommk',
    'kmoRRRRRRRROmk',
    'kmRRyyRRyyRRmk',
    'kmRRRRRRRRRRmk',
    'kmoRRRRRRRROmk',
    'kmmRRRRRRRRmmk',
    '.kmmRRRRRRmmk.',
    '.kmmk.kk.kmmk.',
    '..kk..kk..kk..',
    '.....k..k.....',
  ]],
  quantumSpecter: [[
    '....kkkkkk....',
    '..kkCCCCCCkk..',
    '.kCCwwwwwwCCk.',
    'kCCwwkkkkwwCCk',
    'kCCwkCCCCkwdCk',
    'kCCwkCwwCkwdCk',
    'kCCwwkkkkwwCCk',
    'kCCwwwwwwwwCCk',
    '.kCCwwwwwwCCk.',
    '..kCCwwwwCCk..',
    '..k.kk..kk.k..',
    '.k..k....k..k.',
  ], [
    '...kkkkkkkk...',
    '..kCCCCCCCCk..',
    '.kCCwwwwwwCCk.',
    'kCCwwkkkkwwCCk',
    'kCCwkCCCCkwCCk',
    'kCCwkCwwCkwCCk',
    'kCCwwkkkkwwCCk',
    'kCCwwwwwwwwCCk',
    '.kCCwwwwwwCCk.',
    '..kCwwwwwwCk..',
    '...kk.kk.kk...',
    '....k.kk.k....',
  ]],

  /* --- 第三幕 深空 --- */
  voidLurker: [[
    '.kkkkkkkkkkkk.',
    'kppppppppppppk',
    'kpPPqPPPPPPqPk',
    'kpPqqPwwwwPqPk',
    'kpPqPwwCCwwPqk',
    'kpPPwwCwwCwwPk',
    'kpPqPwwCCwwPqk',
    'kpPqqPwwwwPqPk',
    'kpPPqPPPPPPqPk',
    'kppppppppppppk',
    '.kpk.pkpk.pkp.',
    '..k...k..k...k',
  ], [
    '.kkkkkkkkkkkk.',
    'kppppppppppppk',
    'kpPPqPPPPPPqPk',
    'kpPqqPwwwwPqPk',
    'kpPqPwwCCwwPqk',
    'kpPPwwCwwCwwPk',
    'kpPqPwwCCwwPqk',
    'kpPqqPwwwwPqPk',
    'kpPPqPPPPPPqPk',
    'kppppppppppppk',
    '.kk.pkpkpk.kk.',
    '..k..k..k...k.',
  ]],
  entropyMaw: [[
    'kk..........kk',
    'kwwk......kwwk',
    'kwWwk....kwwWk',
    '.kwWWk..kWWwk.',
    '..kwWWkkWWwk..',
    '.kkwwWWWWwwkk.',
    'kwwkkwWWwkwwkk',
    'kwWk..kwwk.kWk',
    'kwWk..kwwk.kWk',
    '.kkk..kwwk.kkk',
    '......kwwk....',
    '.......kk.....',
  ], [
    'kk..........kk',
    '.kwk......kwk.',
    '..kwk....kwk..',
    '...kwk..kwk...',
    '....kwkkwwk...',
    '..kkwwWWwwkk..',
    '.kwwkkwWWwkkwk',
    'kwWk..kwwk.kWk',
    'kwWk..kwwk.kWk',
    '.kkk..kwwk.kkk',
    '......kwwk....',
    '.......kk.....',
  ]],
  singularitySpawn: [[
    '.....kkkk.....',
    '...kkqqqqkk...',
    '..kqqPPPPqqk..',
    '.kqPPkkkkPPqk.',
    'kqPPkqwwqkPPqk',
    'kqPkqwCCwqkPqk',
    'kqPkqwCCwqkPqk',
    'kqPPkqwwqkPPqk',
    '.kqPPkkkkPPqk.',
    '..kqqPPPPqqk..',
    '...kkqqqqkk...',
    '.....kkkk.....',
  ], [
    '....kkkkkk....',
    '..kkqqqqqqkk..',
    '.kqqPPPPPPqqk.',
    'kqPPkkkkkkPPqk',
    'kqPkqwwwwqkPqk',
    'kqPkqwCCwqkPqk',
    'kqPkqwCCwqkPqk',
    'kqPkqwwwwqkPqk',
    'kqPPkkkkkkPPqk',
    '.kqqPPPPPPqqk.',
    '..kkqqqqqqkk..',
    '....kkkkkk....',
  ]],

  /* --- 精英 --- */
  ancientGuardian: [[
    'kkk.........kkk',
    'kgkg.......gkgk',
    '.kkgWWWWWWWgkk.',
    'kgkWWgggggWWkgk',
    'kgWWggyyyyggWWk',
    'kgWggyCwwCyggWk',
    'kgWggyCwwCyggWk',
    'kgWWggyyyyggWWk',
    'kgkWWgggggWWkgk',
    '.kkgWWWWWWWgkk.',
    '..kWWggggggWWk.',
    '..kWWk.kk.kWWk.',
    '..kkk..kk..kkk.',
  ], [
    'kkk.........kkk',
    '.kkg.......gkk.',
    '..kgWWWWWWWgk..',
    '.kgWWgggggWWgk.',
    'kgWWggyyyyggWWk',
    'kgWggyCwwCyggWk',
    'kgWggyCwwCyggWk',
    'kgWWggyyyyggWWk',
    '.kgWWgggggWWgk.',
    '..kgWWWWWWWgk..',
    '..kWWggggggWWk.',
    '..kWWk.kk.kWWk.',
    '..kkk..kk..kkk.',
  ]],
  plasmaHydra: [[
    '.k.k.....k.k.k.',
    'kqkqk...kqkqk..',
    '.kqkqk.kqkqk...',
    '..kqqkqkqqk....',
    '...kqqqqqk.....',
    '..kqPPPPPqk....',
    '.kqPPqqqPPqk...',
    'kqPPqwwwqPPqk..',
    'kPPqwwCCwwqPPk.',
    '.kPPqwwwqPPk...',
    '..kqPPPPPqk....',
    '...kqPPPqk.....',
  ], [
    '..k.k...k.k.k..',
    '.kqkqk.kqkqk.k.',
    'kqkqkqkqkqkqk..',
    '.kqqkqkqqkqk...',
    '..kqqqqqkqqk...',
    '.kqPPPPPqPPPqk.',
    'kqPPqqqPPqqqPqk',
    'kPPqwwCCwwqwPPk',
    '.kPPqwwwqwwwPk.',
    '..kqPPPPPqPPPk.',
    '...kqPPPqkPPk..',
    '....kqPPqk.....',
  ]],
  voidReaper: [[
    '...kk......kk..',
    '..kPPk....kPPk.',
    '.kPqqPk..kPqqPk',
    '.kPqqqPkkPqqqPk',
    'kkPqqqqPPqqqqPk',
    '.kPqqqqqqqqqqPk',
    '..kPqqqqqqqqPk.',
    '..kPqRRqqRRqPk.',
    '.kPqRRRqqRRRqPk',
    '.kPqqqqqqqqqqPk',
    '..kkPqqqqqqPkk.',
    '...kk.kkkk.kk..',
  ], [
    '..kk........kk.',
    '.kPPk......kPPk',
    'kPqqPk....kPqqP',
    'kPqqqPk..kPqqqP',
    'kPqqqqPkkPqqqqP',
    '.kPqqqqqqqqqqPk',
    '..kPqqqqqqqqPk.',
    '..kPqRRqqRRqPk.',
    '.kPqRRRqqRRRqPk',
    '.kPqqqqqqqqqqPk',
    '..kkPqqqqqqPkk.',
    '..k..k.kk.k..k.',
  ]],

  /* --- BOSS --- */
  sandTyrant: [[
    'kkk.kkkkkkkkk.kkk',
    'kooo.koooooook.oo',
    '.kooookooooookoo.',
    '..koooyyooooyyook',
    '.kooyyyyyyyyyyook',
    'kooyyRRyyyyRRyook',
    'koooRRRRRRRRRoook',
    'kooyRRRyyyyRRRoook',
    'koooRRRRRRRRRoook',
    '.kooyRRRoRRRyook.',
    '.kkooyyoooo yyokk',
    '..kkoooyyyyyookk.',
    '...kko.o.o.o.okk.',
    '..kk..k.k.k.k..kk',
    '.kk....k.k.k....k',
  ], [
    'kkk.kkkkkkkkk.kkk',
    '.koo.koooooook.oo',
    '..koookooooookoo.',
    '..koooyyooooyyook',
    '.kooyyyyyyyyyyook',
    'kooyyRRyyyyRRyook',
    'koooRRRRRRRRRoook',
    'kooyRRRyyyyRRRoook',
    'koooRRRRRRRRRoook',
    '.kooyRRRoRRRyook.',
    '..koooyyoooo yyok',
    '..kkoooyyyyyookk.',
    '..kko.o.o.o.okk..',
    '.kk..k.k.k.k..kk.',
    'k....k.k.k.k....k',
  ]],
  beltLeviathan: [[
    '...kkkkkkkkkkkk...',
    '..kWWWWWWWWWWWWk..',
    '.kWWggggggggggWWk.',
    'kWWggCCCCCCCCggWWk',
    'kWggCCqqqqqqCCggWk',
    'kWggCqqPPPPqqCggWk',
    'kWWgCqqPwwPqqCgWWk',
    'kWWgCqqPwwPqqCgWWk',
    'kWggCqqPPPPqqCggWk',
    'kWggCCqqqqqqCCggWk',
    'kWWggCCCCCCCCggWWk',
    '.kWWggggggggggWWk.',
    '..kWWgg.gg.ggWWk..',
    '..kkWk..kk..kWWk..',
    '.kk.............kk',
  ], [
    '....kkkkkkkkkk....',
    '..kWWWWWWWWWWWWk..',
    '.kWWggggggggggWWk.',
    'kWWggCCCCCCCCggWWk',
    'kWggCCqqqqqqCCggWk',
    'kWggCqqPPPPqqCggWk',
    'kWWgCqqPwwPqqCgWWk',
    'kWWgCqqPwwPqqCgWWk',
    'kWggCqqPPPPqqCggWk',
    'kWggCCqqqqqqCCggWk',
    'kWWggCCCCCCCCggWWk',
    '.kWWggggggggggWWk.',
    '..kWWg.gg.gg.gWWk.',
    '..kkWk.kk.kk.kWWk.',
    '.kk.............kk',
  ]],
  singularityDevourer: [[
    '.....kkkkkkkk.....',
    '...kkppppppppkk...',
    '..kppPPPPPPPPppk..',
    '.kpPPqqqqqqqqPPpk.',
    'kpPPqqwwwwwwqqPPpk',
    'kpPqqwwkkkkwwqqPpk',
    'kpPqwwkCCCCkwwqPpk',
    'kpPqwwkCwwCkwwqPpk',
    'kpPqwwkCwwCkwwqPpk',
    'kpPqwwkCCCCkwwqPpk',
    'kpPqqwwkkkkwwqqPpk',
    'kpPPqqwwwwwwqqPPpk',
    '.kpPPqqqqqqqqPPpk.',
    '..kppPPPPPPPPppk..',
    '...kkppppppppkk...',
    '.....kkkkkkkk.....',
  ], [
    '....kkkkkkkkkk....',
    '..kkppppppppppkk..',
    '.kpPPPPPPPPPPPPpk.',
    'kpPPqqwwwwwwqqPPpk',
    'kpPqqwwkkkkwwqqPpk',
    'kpPqwwkCCCCkwwqPpk',
    'kpPqwwkCwwCkwwqPpk',
    'kpPqwwkCwwCkwwqPpk',
    'kpPqwwkCCCCkwwqPpk',
    'kpPqqwwkkkkwwqqPpk',
    'kpPPqqwwwwwwqqPPpk',
    'kpPPqqqqqqqqqqPPpk',
    '.kpPPPPPPPPPPPPpk.',
    '..kkppppppppppkk..',
    '....kkkkkkkkkk....',
    '.....kkkkkkkk.....',
  ]],
};

/* ============================================================
 * 卡牌图标 20x20
 * ============================================================ */
const ICON_SRC = {
  damage: [
    '...............kk.',
    '.............kkRk.',
    '...........kkRRk..',
    '.........kkRRk....',
    'k......kkRRk......',
    '.kk..kkRRk........',
    '..kRRRRk..........',
    'kkRRRRk.k.........',
    '.kRRk.....k.......',
    '..kk.......kk.....',
  ],
  shield: [
    '....kkkkkkkk....',
    '..kkCCCCCCCCkk..',
    '.kCCwwwwwwwwCCk.',
    'kCCwwwwwwwwwwCCk',
    'kCwwwwwwwwwwwwCk',
    'kCwwwwwwwwwwwwCk',
    'kCwwwwwwwwwwwwCk',
    '.kCwwwwwwwwwwCk.',
    '.kCCwwwwwwwwCCk.',
    '..kCCwwwwwwCCk..',
    '...kCCwwwwCCk...',
    '....kCCwwCCk....',
    '.....kCCCCk.....',
    '......kkkk......',
  ],
  special: [
    '.....kkkkkk.....',
    '...kkqqqqqqkk...',
    '..kqqPPPPPPqqk..',
    '.kqPPkwwwwkPPqk.',
    'kqPPkwCCCCwPPqk.',
    'kqPkwkCwwCkwkPqk',
    'kqPkwkCwwCkwkPqk',
    'kqPPkwCCCCwPPqk.',
    '.kqPPkwwwwkPPqk.',
    '..kqqPPPPPPqqk..',
    '...kkqqqqqqkk...',
    '.....kkkkkk.....',
  ],
  curse: [
    '...kk......kk...',
    '..kPPk....kPPk..',
    '.kPqqPk..kPqqPk.',
    '.kPqqqPkkPqqqPk.',
    'kkPqqqqPPqqqqPkk',
    '.kPqqqqqqqqqqPk.',
    '..kPqRRqqRRqPk..',
    '..kPqRRRqqRRRqk.',
    '.kPqqqqqqqqqqPk.',
    '..kkPqqqqqqPkk..',
    '...kk.kkkk.kk...',
  ],
  burn: [
    '......kk....',
    '.....kRk....',
    '....kRRk....',
    '...kRyyRk...',
    '..kRyyyyRk..',
    '..kRywwyRk..',
    '.kRRywwyRRk.',
    '.kRRyyyyRRk.',
    '.koRRyyRRok.',
    '..kooRRook..',
    '...kkkkkk...',
  ],
  poison: [
    '....kkkk....',
    '..kkllllkk..',
    '.kllwwwwllk.',
    'klwwkwwkwwlk',
    'klwkLwwLkwlk',
    'klwkLLwwLkwk',
    'klwwkwwkwwlk',
    '.kllwwwwllk.',
    '..kkLLLLkk..',
    '....kkkk....',
  ],
  vulnerable: [
    '....kkkk....',
    '..kkyyyyy...',
    '.kyywwwwyyk.',
    'kywwkwwkwwyk',
    'kywk.ww.kwyk',
    'kywwkwwkwwyk',
    '.kyywwwwyyk.',
    '..kyyyywwk..',
    '...kkyyyk...',
    '.....kk.....',
  ],
  strength: [
    '...kkkkkk...',
    '..kqqqqqqk..',
    '.kqqwwwwqqk.',
    'kqqwkwwkwqqk',
    'kqwkkwkkkwqk',
    'kqwkwwwwkwqk',
    'kqqwkwwkwqqk',
    '.kqqwwwwqqk.',
    '..kqqqqqqk..',
    '...kkkkkk...',
  ],
  weak: [
    '...kkkkkk...',
    '..kggggggk..',
    '.kggwwwwggk.',
    'kggwkwwkggk.',
    'kgwk.ww.kggk',
    'kgwk.ww.kggk',
    'kggwkwwkggk.',
    '.kggwwwwggk.',
    '..kggggggk..',
    '...kkkkkk...',
  ],
  thorns: [
    'k..k..k..k',
    '.kkk.kkk.k',
    '..kLkLkLk.',
    '.kLkLkLkLk',
    'kLkLLLLLkL',
    '.kLLLLLLLk',
    'kLkLkLkLkL',
    '.kkkLkLkkk',
    '..kLkkkLk.',
    '...kkkkk..',
  ],
  draw: [
    '..kkkkkkkk..',
    '.kccwwwwcck.',
    'kcwwwwwwwwck',
    'kcwCCCCCCwck',
    'kcwCwwwwCwck',
    'kcwCwCCwCwck',
    'kcwCwwwwCwck',
    'kcwCCCCCCwck',
    'kcwwwwwwwwck',
    '.kccwwwwcck.',
    '..kkkkkkkk..',
  ],
  battery: [
    '...kkkkkk...',
    '...kyyyy k..',
    'kkkkkkkkkkkk',
    'kCCCCCCCCCCk',
    'kCwwwwwwwwCk',
    'kCwCCwCCwCk.',
    'kCwCCwCCwCk.',
    'kCwwwwwwwwCk',
    'kCCCCCCCCCCk',
    'kkkkkkkkkkkk',
  ],
  heal: [
    '..kk..kk..',
    '.kRk..kRk.',
    'kRRRkkRRRk',
    'kRRRRRRRRk',
    'kRRRRRRRRk',
    '.kRRRRRRk.',
    '..kRRRRk..',
    '...kRRk...',
    '....kk....',
  ],
  multi: [
    'k.....k.....k',
    '.k...kRk...k.',
    '..k.kRRRk.k..',
    '...kRRRRRk...',
    'k..kRRRRRk..k',
    '.k.kRRRRRk.k.',
    '..kkRRRRRkk..',
    '...kRRRRRk...',
    '...kRRRRRk...',
    '....kkkkk....',
  ],
  pierce: [
    '........k...',
    '.......kRk..',
    '......kRRk..',
    '.....kRRk...',
    'k...kRRk....',
    '.k.kRRk.....',
    '..kRRk......',
    'kkRRk.......',
    'kRRk........',
    '.kk.........',
  ],
  lifesteal: [
    '..kkkkkkkk..',
    '.kmmmmmmmmk.',
    'kmRmmmmmmRmk',
    'kmRRmmmmRRmk',
    'kmRRRmRRRRmk',
    'kmRRRRRRRRmk',
    '.kmRRRRRRmk.',
    '..kmRRRRmk..',
    '...kmRRmk...',
    '....kmmk....',
  ],
  purify: [
    '.....kk.....',
    '....kCCk....',
    '...kCwwCk...',
    '..kCwCCwCk..',
    '.kCwCCCCwCk.',
    'kCwCCwwCCwCk',
    'kCwCCwwCCwCk',
    '.kCwCCCCwCk.',
    '..kCwCCwCk..',
    '...kCwwCk...',
    '....kCCk....',
    '.....kk.....',
  ],
  gold: [
    '..yyyy..',
    '.ywwwwy.',
    'ywwyywwy',
    'ywwyywwy',
    'ywwwwwwy',
    '.ywwwwy.',
    '..yyyy..',
  ],
};

/* ============================================================
 * 遗物 / 药水 / 状态 图标 12x12
 * ============================================================ */
const RELIC_SRC = {
  core:      ['...kkkk...', '..koooo k.', '.koyyyyook', 'koyywwyyok', 'koyywwyyok', 'koyywwyyok', '.koyyyyook', '..koooo k.', '...kkkk...'],
  battery:   ['kkkkkk', 'kCCCCk', 'kCwwCk', 'kCwwCk', 'kCwwCk', 'kCwwCk', 'kCCCCk', 'kkkkkk'],
  amulet:    ['..kkkk..', '.kmmmmk.', 'kmRRRRmk', 'kmRRRRmk', '.kmmmmk.', '..kmmk..', '...kk...'],
  stabilizer:['...kk...', '..kqqk..', '.kqwwqk.', 'kqwCCwqk', 'kqwCCwqk', '.kqwwqk.', '..kqqk..', '...kk...'],
  monocle:   ['kkkkkkkk', 'kCCkkCCk', 'kCkwwkCk', 'kCkwwkCk', 'kCCkkCCk', 'kkkkkkkk'],
  swarm:     ['.k.k.k.', 'kLkLkLk', '.kLkLk.', 'kLkLkLk', '.k.k.k.'],
  antimatter:['..kkkk..', '.kqqqqk.', 'kqqwwqqk', 'kqwCCwqk', 'kqwCCwqk', 'kqqwwqqk', '.kqqqqk.', '..kkkk..'],
  rune:      ['..kkkk..', '.kyyyyk.', 'kywwwwyk', 'kywCCwyk', 'kywCCwyk', 'kywwwwyk', '.kyyyyk.', '..kkkk..'],
  /* --- 扩容 16 件（P1 #7）---
     ⚠️ 新图标一律 8x8。HUD 里遗物是按 13px 间距平铺的，尺寸不齐会一行高低错落；
        旧 8 件里有 10x9 / 6x8 是历史遗留，新加的不要再扩散这种不齐。 */
  aegis:     ['..kkkk..', '.kbbbbk.', 'kbCwwCbk', 'kbCwwCbk', 'kbCCCCbk', '.kbCCbk.', '..kbbk..', '...kk...'],
  banner:    ['.kkkkk..', '.kRRRk..', '.kRwRk..', '.kRRRk..', '.kkkk...', '.kk.....', '.kk.....', '.kk.....'],
  beacon:    ['...kk...', '..kyyk..', '.kkCCkk.', '..kwwk..', '..kwwk..', '.kwwwwk.', 'kwwwwwwk', 'kkkkkkkk'],
  crown:     ['k.k..k.k', 'kkkkkkkk', 'kRkRRkRk', 'kRRRRRRk', 'kRyyyyRk', 'kRRRRRRk', 'kkkkkkkk', '.kkkkkk.'],
  bolt:      ['...kk...', '..kyyk..', '.kyyk...', 'kyyykk..', 'kkkyyk..', '..kyk...', '.kyk....', '.kk.....'],
  rig:       ['..kkkk..', '..kWWk..', '..kWWk..', '..kkkk..', '....k...', '....k...', '..kkk...', '..kWk...'],
  recycler:  ['...kk...', '..kLLk..', '.kLkkLk.', 'kLk..kLk', 'kL....Lk', 'kLL..LLk', '.kLLLLk.', '..kkkk..'],
  plate:     ['kkkkkkkk', 'kWWWWWWk', 'kWkWWkWk', 'kWWWWWWk', 'kWWWWWWk', 'kWkWWkWk', 'kWWWWWWk', 'kkkkkkkk'],
  coil:      ['..kkkk..', '.kqqqqk.', 'kqk..kqk', 'kq.kk.qk', 'kq.kk.qk', 'kqk..kqk', '.kqqqqk.', '..kkkk..'],
  chip:      ['k.k..k.k', 'kkkkkkkk', 'kCCCCCCk', 'kCwwwwCk', 'kCwwwwCk', 'kCCCCCCk', 'kkkkkkkk', 'k.k..k.k'],
  fist:      ['..kkkk..', '.kRRRRk.', 'kkRRRRkk', 'kRwwwwRk', 'kRRRRRRk', 'kRkkkkRk', '.kRRRRk.', '..kkkk..'],
  nail:      ['..kkkk..', '.kPPPPk.', 'kPwwwwPk', 'kPPPPPPk', '.kPPPPk.', '..kPPk..', '..kPPk..', '...kk...'],
  guardian:  ['...kk...', '..kcck..', '.kcwwck.', 'kcwCCwck', 'kcwCCwck', '.kcwwck.', '..kcck..', '...kk...'],
  urn:       ['..kkkk..', '.kkkkkk.', 'kWWWWWWk', 'kWyyyyWk', 'kWyyyyWk', 'kWWWWWWk', '.kWWWWk.', '..kkkk..'],
  credit:    ['kkkkkkkk', 'kyyyyyyk', 'kykkkkyk', 'kyywwyyk', 'kyywwyyk', 'kykkkkyk', 'kyyyyyyk', 'kkkkkkkk'],
  ration:    ['.kkkkkk.', 'kggggggk', 'kgwwwwgk', 'kgwLLwgk', 'kgwLLwgk', 'kgwwwwgk', 'kggggggk', '.kkkkkk.'],
};
const POTION_SRC = {
  heal:   ['..kk..', '.kRk..', 'kRRRk.', 'kRRRRk', 'kRRRRk', '.kkkk.'],
  energy: ['..kk..', '.kCk..', 'kCCCk.', 'kCCwCk', 'kCCCCk', '.kkkk.'],
  shield: ['..kk..', '.kCk..', 'kCCCk.', 'kCwwCk', 'kCCCCk', '.kkkk.'],
  fire:   ['..kk..', '.kok..', 'kooRk.', 'koRRRk', 'kooook', '.kkkk.'],
  poison: ['..kk..', '.klk..', 'klll k', 'klLllk', 'kllllk', '.kkkk.'],
  purify: ['..kk..', '.kwk..', 'kwCwCk', 'kwwwwk', 'kwwwwk', '.kkkk.'],
};
const STATUS_SRC = {
  burn:       ['..kk..', '.kRyk.', 'kRyyRk', 'kywwyk', 'kooRok', '.kkkk.'],
  poison:     ['..kk..', '.klk..', 'klllLk', 'klwLlk', 'kLLLLk', '.kkkk.'],
  vulnerable: ['..kk..', '.kyk..', 'kywwyk', 'kwyywk', 'kyyyyk', '.kkkk.'],
  strength:   ['.kkkk.', 'kqqqqk', 'kqwwqk', 'kqqqqk', '.kkkk.'],
  weak:       ['.kkkk.', 'kggggk', 'kgwwgk', 'kggggk', '.kkkk.'],
  thorns:     ['k.k.k.', '.kLkLk', 'kLkLkL', '.kLkLk', 'k.k.k.'],
};

const SPR = {};
function buildSprites() {
  for (const k in CREW_SRC) SPR[k] = makeSet(CREW_SRC[k], 3);
  // 敌人按包围盒归一到统一视觉体量，且只用整数缩放（保持像素锐利）
  for (const k in FOE_SRC) {
    const boss = k === 'sandTyrant' || k === 'beltLeviathan' || k === 'singularityDevourer';
    const probe = spriteFrom(FOE_SRC[k][0]);
    const target = boss ? 102 : 68;
    const s = Math.max(2, Math.round(target / Math.max(probe.width, probe.height)));
    SPR[k] = makeSet(FOE_SRC[k], s);
  }
  for (const k in ICON_SRC) SPR['i_' + k] = makeSet(ICON_SRC[k], 2);
  for (const k in RELIC_SRC) SPR['r_' + k] = makeSet(RELIC_SRC[k], 1);
  for (const k in POTION_SRC) SPR['p_' + k] = makeSet(POTION_SRC[k], 2);
  for (const k in STATUS_SRC) SPR['s_' + k] = makeSet(STATUS_SRC[k], 1);
}

/* ============================================================
 * 背景：三幕星空（视差星点 + 幕色雾霭），缓存为 3 张 640x360
 * ============================================================ */
const ACT_SKY = [
  { top: '#2a0f12', bot: '#0d0a14', star: '#ffcd75', neb: '#5d2020', dust: '#ef7d57' }, // 火星
  { top: '#0d1230', bot: '#05060d', star: '#f4f4f4', neb: '#29366f', dust: '#41a6f6' }, // 小行星带
  { top: '#1a0a2c', bot: '#04030a', star: '#c070f0', neb: '#5d275d', dust: '#8a3cc0' }, // 深空奇点
];
const _skyCache = {};
function skyCanvas(act) {
  if (_skyCache[act]) return _skyCache[act];
  const W = 640, H = 360, s = ACT_SKY[Math.min(act, 2)];
  const c = newCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, s.top); g.addColorStop(1, s.bot);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  let seed = act * 7717 + 13;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // 星云斑块
  for (let i = 0; i < 16; i++) {
    const px = rnd() * W, py = rnd() * (H - 90) + 20, R = 24 + rnd() * 60;
    const [rr, gg, bb] = hexRgb(s.neb);
    const rg = x.createRadialGradient(px, py, 0, px, py, R);
    rg.addColorStop(0, `rgba(${rr},${gg},${bb},0.34)`); rg.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    x.fillStyle = rg; x.fillRect(px - R, py - R, R * 2, R * 2);
  }
  // 星点
  for (let i = 0; i < 220; i++) {
    const px = (rnd() * W) | 0, py = (rnd() * (H - 80)) | 0, b = rnd();
    x.fillStyle = b > 0.82 ? s.star : b > 0.4 ? '#c0cbdc' : '#566c86';
    x.globalAlpha = 0.35 + rnd() * 0.65;
    x.fillRect(px, py, 1, 1);
    if (b > 0.94) { x.fillRect(px - 1, py, 3, 1); x.fillRect(px, py - 1, 1, 3); }
  }
  x.globalAlpha = 1;
  // 地平线 / 场景剪影
  x.fillStyle = '#05060d';
  if (act === 0) { // 火星沙丘
    x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 16) x.lineTo(px, 292 + Math.sin(px * 0.013) * 12 + Math.sin(px * 0.041) * 6);
    x.lineTo(W, H); x.closePath(); x.fill();
    x.fillStyle = '#140a0a';
    for (let i = 0; i < 40; i++) x.fillRect((rnd() * W) | 0, 296 + rnd() * 50, 2, 2);
  } else if (act === 1) { // 小行星带：漂浮岩块
    for (let i = 0; i < 22; i++) {
      const px = rnd() * W, py = 40 + rnd() * 240, r = 3 + rnd() * 11;
      x.fillStyle = '#333c57';
      for (let j = 0; j < 8; j++) {
        const a = j / 8 * Math.PI * 2, rr = r * (0.7 + rnd() * 0.4);
        x.fillRect(Math.round(px + Math.cos(a) * rr), Math.round(py + Math.sin(a) * rr * 0.7), 2, 2);
      }
      x.fillStyle = '#566c86';
      x.fillRect(Math.round(px - r * 0.3), Math.round(py - r * 0.3), Math.max(1, r | 0), Math.max(1, (r * 0.7) | 0));
    }
  } else { // 深空：奇点裂隙
    for (let i = 0; i < 5; i++) {
      const px = rnd() * W, py = rnd() * H;
      x.strokeStyle = i % 2 ? '#5d275d' : '#8a3cc0'; x.globalAlpha = 0.5; x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py);
      for (let s2 = 0; s2 < 26; s2++) x.lineTo(px + (rnd() - 0.5) * 90, py + (rnd() - 0.5) * 90);
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  return (_skyCache[act] = c);
}

/* ============================================================
 * 通用：辉光 / 弹丸（沿用 last-firewall 的缓存纪律）
 * ============================================================ */
const _gcache = {};
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function glowSprite(color, R) {
  R = Math.max(2, Math.round(R));
  const key = color + '|' + R; if (_gcache[key]) return _gcache[key];
  const s = R * 2, c = newCanvas(s, s), x = c.getContext('2d');
  const [rr, gg, bb] = hexRgb(color);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const d = Math.hypot(i + 0.5 - R, j + 0.5 - R) / R;
    if (d >= 1) continue;
    const q = Math.ceil((1 - d) * 4) / 4;
    x.fillStyle = `rgba(${rr},${gg},${bb},${(q * q).toFixed(3)})`; x.fillRect(i, j, 1, 1);
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
// 轨道弹丸：深色描边 + 亮色本体 + 白核
const _bcache = {};
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
