'use strict';
/* ═══════════════════════════════════════════════
   像素素材库：字符画精灵 + 程序化像素图形
   所有图形均为 1px 整数坐标绘制，保持像素锐利
   ═══════════════════════════════════════════════ */

/* 调色板 */
const PAL = {
  '.': null,
  'K': '#0d0f14',   /* 近黑 */
  'W': '#f4f6f8',   /* 白 */
  'G': '#8fa3b5',   /* 灰蓝 */
  'S': '#cfd8e0',   /* 亮灰 */
  'R': '#d84b2a',   /* 红 */
  'O': '#f0a33a',   /* 橙 */
  'Y': '#ffe27a',   /* 黄 */
  'N': '#a06a24',   /* 棕 */
  'B': '#2b4a6f',   /* 深蓝 */
  'E': '#e8b98a',   /* 肤色/米黄 */
  'L': '#4a5f2f',   /* 深绿 */
  'T': '#3a4a5c',   /* 铁灰 */
  'P': '#d9c9a8',   /* 纸黄（脱水皮囊） */
  'C': '#6b7a8a',   /* 中灰 */
  'M': '#5a3a2a',   /* 深棕 */
};

/* 字符画精灵 */
const SPR = {
  /* 普通人类 8x12 */
  person: [
    '...KK...',
    '..KWK...',
    '..KKK...',
    '...K....',
    '..KKK...',
    '.K.K.K..',
    '.KKKKK..',
    '..KKK...',
    '..K.K...',
    '..K.K...',
    '.K...K..',
    '.K...K..',
  ],
  /* 大衣人（罗辑）8x12 */
  personCoat: [
    '...KK...',
    '..KWK...',
    '..KKK...',
    '...K....',
    '..KKK...',
    '.KKKKK..',
    'KKKKKKK.',
    '.KKKKK..',
    '..K.K...',
    '..K.K...',
    '.K...K..',
    '.K...K..',
  ],
  /* 脱水者 8x4 */
  dehy: [
    '.KKKK...',
    'KPPPK...',
    'KKKKKK..',
    '.KKKK...',
  ],
  /* 松树 7x9 */
  tree: [
    '...K...',
    '..KKK..',
    '..KKK..',
    '.KKKKK.',
    '.KKKKK.',
    'KKKKKKK',
    'KKKKKKK',
    '...K...',
    '...K...',
  ],
  /* 战舰 18x8 */
  ship: [
    '.......KKKKKKKK.......',
    '......KWWWWWWWWK......',
    '.....KWWWWWWWWWWK.....',
    '....KWWWWWWWWWWWWK....',
    '...KWWWWWWWWWWWWWWK...',
    'KKKKKKKKKKKKKKKKKKKKKK',
    '....K.............K...',
    '....K.............K...',
  ],
  /* 墓碑 7x9 */
  grave: [
    '.KKKKK.',
    '.KWWWK.',
    '.KWWWK.',
    '.KWWWK.',
    '.KWWWK.',
    '.KWWWK.',
    '.KKKKK.',
    '...K...',
    '...K...',
  ],
  /* 小鸟 7x4 */
  bird: [
    '..K..K.',
    '.KW.KWK',
    '.KKKKK.',
    '..K.K..',
  ],
};

function drawSprite(g, name, x, y, scale = 1, pal = PAL) {
  const s = SPR[name];
  if (!s) return;
  const w = s[0].length, h = s.length;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = pal[s[j][i]];
      if (!c) continue;
      g.fillStyle = c;
      if (scale === 1) g.fillRect(Math.round(x + i), Math.round(y + j), 1, 1);
      else g.fillRect(x + i * scale, y + j * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }
}

/* ── 程序化像素图形 ── */

/* 实心圆盘 */
function pDisc(g, x, y, r, c) {
  g.fillStyle = c;
  for (let j = -r; j <= r; j++) {
    const w = Math.floor(Math.sqrt(r * r - j * j));
    g.fillRect(Math.round(x - w), Math.round(y + j), w * 2 + 1, 1);
  }
}

/* 像素椭圆（拉伸圆盘） */
function pEllipse(g, x, y, rx, ry, c) {
  g.fillStyle = c;
  for (let j = -ry; j <= ry; j++) {
    const w = Math.floor(Math.sqrt(1 - (j * j) / (ry * ry)) * rx);
    g.fillRect(Math.round(x - w), Math.round(y + j), w * 2 + 1, 1);
  }
}

/* 空心圆环 */
function pRing(g, x, y, r, c) {
  g.fillStyle = c;
  for (let a = 0; a < 72; a++) {
    const th = a / 72 * Math.PI * 2;
    g.fillRect(Math.round(x + Math.cos(th) * r), Math.round(y + Math.sin(th) * r), 1, 1);
  }
}

/* Bresenham 直线 */
function pLine(g, x0, y0, x1, y1, c) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = c;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/* 条带天空 */
function bandedSky(g, colors) {
  const n = colors.length, h = Math.ceil(192 / n);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i];
    g.fillRect(0, i * h, 256, h);
  }
}

/* 山峰剪影（逐行填充） */
function mountain(g, cx, baseY, h, c) {
  g.fillStyle = c;
  for (let y = 0; y < h; y++) {
    const half = (h - y) * 0.55;
    g.fillRect(Math.round(cx - half), baseY - h + y, Math.round(half * 2), 1);
  }
}

/* 森林剪影 */
function forest(g, seed, baseY, n) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * 250 | 0, s = r() * 0.7 + 0.8;
    drawSprite(g, 'tree', x, baseY - 9 * s, s);
  }
}

/* 确定性随机 */
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* 星空 */
function makeStars(n, seed, w = 256, h = 192) {
  const r = mulberry32(seed), a = [];
  for (let i = 0; i < n; i++) {
    a.push({ x: r() * w | 0, y: r() * h | 0, s: r() * 0.8 + 0.2, p: r() * 6.28, sp: 0.4 + r() * 2.4 });
  }
  return a;
}

function drawStars(g, stars, t, bright = 1) {
  for (const s of stars) {
    const tw = 0.35 + 0.65 * Math.sin(t * s.sp + s.p);
    g.globalAlpha = Math.max(0.05, Math.min(1, tw * bright));
    g.fillStyle = s.s > 0.6 ? '#ffffff' : '#9fb8d8';
    g.fillRect(s.x, s.y, 1, 1);
  }
  g.globalAlpha = 1;
}

/* 像素文字（中文用系统宋体，保持小字号整数坐标） */
function ptext(g, str, x, y, size, color, align = 'left') {
  g.font = size + "px 'SimSun','Songti SC','Noto Serif SC',serif";
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'top';
  g.fillText(str, Math.round(x), Math.round(y));
}

function ptextMono(g, str, x, y, size, color, align = 'left') {
  g.font = 'bold ' + size + "px 'Courier New',monospace";
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'top';
  g.fillText(str, Math.round(x), Math.round(y));
}
