'use strict';
/* ═══════════════════════════════════════════════
   《最后一盏灯》像素素材库
   字符画精灵 + 程序化像素图形
   所有图形均按 1px 整数坐标绘制，保持像素锐利
   ═══════════════════════════════════════════════ */

/* 调色板：暖色夜景主题 */
const PAL = {
  '.': null,
  'K': '#0c0a12',   /* 近黑（夜） */
  'W': '#f6efd8',   /* 暖白（灯焰高光） */
  'G': '#5a6b7a',   /* 冷灰蓝 */
  'S': '#aab6c0',   /* 亮灰 */
  'R': '#c75b3f',   /* 赤陶 */
  'O': '#e0a14a',   /* 琥珀 */
  'Y': '#ffe9a8',   /* 暖黄（灯焰） */
  'N': '#7a5230',   /* 棕 */
  'B': '#2b3a52',   /* 深蓝（夜空） */
  'E': '#e8b98a',   /* 肤色 */
  'L': '#3a5a3a',   /* 深绿 */
  'T': '#3a4250',   /* 铁灰 */
  'C': '#6b7682',   /* 中灰 */
  'M': '#4a3322',   /* 深棕 */
  'P': '#161d2b',   /* 深影 */
  'D': '#2d1f14',   /* 暗木 */
  'F': '#ffcaa0',   /* 火/灯芯 */
  'H': '#3a2a3f',   /* 紫影（夜窗） */
  'A': '#b9c2cc',   /* 窗月光 */
};

/* ── 字符画精灵 ── */
const SPR = {
  /* 点灯人（老人，持长杆）12x16 */
  keeper: [
    '....KK......',
    '...KWWK.....',
    '...KEEK.....',
    '...KKK......',
    '....K.......',
    '...KKK..KK..',
    '..K.K.K.KK..',
    '..KKKKKKKK..',
    '...KKKKK.KK.',
    '...K.K.K.KK.',
    '...K.K.K....',
    '..K...K.K...',
    '..K...K.....',
    '.KK...KK....',
    'KKK...KKK...',
    'K.K...K.K...',
  ],
  /* 孩子 9x11 */
  child: [
    '..KK....',
    '.KWWK...',
    '.KEK....',
    '.KKK....',
    'KKKKK...',
    '.KKK.KK.',
    '.K.K.KK.',
    '.K.K....',
    'K.K.....',
    'K.K.....',
    'K.K.....',
  ],
  /* 猫 9x6 */
  cat: [
    'K.K....K.K',
    'KWK....KWK',
    'KWWKKKKWWK',
    'WWWWWWWWWK',
    '.WWWWWWWK.',
    '..K...K...',
  ],
  /* 松树 9x11 */
  tree: [
    '....K....',
    '...KSK...',
    '...KSK...',
    '..KSSSK..',
    '..KSSSK..',
    '.KSSSSSK.',
    '.KSSSSSK.',
    'KSSSSSSSK',
    'KSSSSSSSK',
    '....N....',
    '....N....',
  ],
  /* 鸟 7x4 */
  bird: [
    '..K..K.',
    '.KY.KYK',
    '.KKKKK.',
    '..K.K..',
  ],
  /* 小提灯（终幕孩子手持）9x11 */
  lantern: [
    '...KKK...',
    '..KWWWK..',
    '..KWFWK..',
    '..KWFWK..',
    '..KWWWK..',
    '...KCK...',
    '...KCK...',
    '...KCK...',
    '...KCK...',
    '..KKCKK..',
    '...KKK...',
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
      else g.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), Math.ceil(scale), Math.ceil(scale));
    }
  }
}

/* ── 程序化像素图形原语 ── */

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
    const w = Math.floor(Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))) * rx);
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

/* 远山剪影 */
function mountain(g, cx, baseY, h, c) {
  g.fillStyle = c;
  for (let y = 0; y < h; y++) {
    const half = (h - y) * 0.55;
    g.fillRect(Math.round(cx - half), baseY - h + y, Math.round(half * 2), 1);
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
    a.push({ x: r() * w | 0, y: r() * h * 0.7 | 0, s: r() * 0.8 + 0.2, p: r() * 6.28, sp: 0.4 + r() * 2.4 });
  }
  return a;
}

function drawStars(g, stars, t, bright = 1) {
  for (const s of stars) {
    const tw = 0.35 + 0.65 * Math.sin(t * s.sp + s.p);
    g.globalAlpha = Math.max(0.05, Math.min(1, tw * bright));
    g.fillStyle = s.s > 0.6 ? '#fff6d8' : '#cdd8ea';
    g.fillRect(s.x, s.y, 1, 1);
  }
  g.globalAlpha = 1;
}

/* 像素文字（中文用宋体，保持小字号整数坐标） */
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

/* ── 路灯杆（程序化，便于在灯亮时叠加光晕）── */
/* 画一根未点亮/已点亮的路灯：x 为杆底中心，topY 为灯头高度 */
function lampPost(g, x, baseY, topY, lit, t) {
  const h = baseY - topY;
  /* 杆 */
  g.fillStyle = T_COL;
  g.fillRect(x - 1, topY, 3, h);
  g.fillStyle = '#0a0c12';
  g.fillRect(x - 1, topY, 1, h);
  /* 底座 */
  g.fillStyle = T_COL;
  g.fillRect(x - 3, baseY - 2, 7, 3);
  /* 灯臂 */
  g.fillRect(x - 1, topY - 3, 3, 3);
  /* 灯头 */
  if (lit) {
    /* 暖色光晕（地面光池 + 灯头辉光） */
    const flick = 0.85 + 0.15 * Math.sin(t * 7 + x);
    g.globalAlpha = 0.16 * flick;
    pEllipse(g, x, baseY - 6, 54, 30, '#ffd98a');
    g.globalAlpha = 0.10 * flick;
    pEllipse(g, x, baseY - 6, 90, 46, '#ffcf7a');
    g.globalAlpha = 1;
    /* 灯罩玻璃 */
    g.fillStyle = '#3a2a1a';
    g.fillRect(x - 5, topY - 9, 11, 9);
    g.fillStyle = '#ffe9a8';
    g.fillRect(x - 3, topY - 8, 7, 7);
    g.fillStyle = '#fff6d8';
    g.fillRect(x - 1, topY - 7, 3, 5);
    /* 焰心闪烁 */
    g.globalAlpha = flick;
    g.fillStyle = '#ffcaa0';
    g.fillRect(x, topY - 6, 1, 2);
    g.globalAlpha = 1;
    /* 顶辉光 */
    g.globalAlpha = 0.5 * flick;
    pDisc(g, x, topY - 4, 7, '#ffd98a');
    g.globalAlpha = 1;
  } else {
    /* 熄灭的灯 */
    g.fillStyle = '#241a12';
    g.fillRect(x - 5, topY - 9, 11, 9);
    g.fillStyle = '#0e0a07';
    g.fillRect(x - 3, topY - 8, 7, 7);
  }
}
const T_COL = '#2d2630';   /* 铁艺灯杆色 */

/* ── 一栋房屋剪影（带可点亮窗户）── */
/* x 左下角，w 宽，h 高，winLit：窗户亮灯比例 0~1（确定性随机） */
function house(g, x, baseY, w, h, seed, winLit) {
  const r = mulberry32(seed);
  /* 墙体 */
  g.fillStyle = '#10141f';
  g.fillRect(x, baseY - h, w, h);
  /* 屋顶 */
  g.fillStyle = '#0a0d15';
  for (let i = 0; i < Math.floor(w * 0.5) + 2; i++) {
    const yy = baseY - h - i;
    const half = Math.floor(w * 0.5) - i;
    if (half <= 0) break;
    g.fillRect(x + Math.floor(w * 0.5) - half, yy, half * 2, 1);
  }
  /* 窗户 */
  const cols = Math.max(1, Math.floor(w / 12));
  const rows = Math.max(1, Math.floor(h / 16));
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const wx = x + 4 + cx * 12;
      const wy = baseY - h + 6 + cy * 14;
      if (wx + 6 > x + w - 2) continue;
      if (winLit > 0 && r() < winLit) {
        g.fillStyle = '#ffd98a';
        g.fillRect(wx, wy, 5, 6);
        g.fillStyle = '#fff6d8';
        g.fillRect(wx + 1, wy + 1, 2, 2);
      } else {
        g.fillStyle = '#05070c';
        g.fillRect(wx, wy, 5, 6);
        g.fillStyle = '#1b2433';
        g.fillRect(wx + 1, wy + 1, 1, 4);
        g.fillRect(wx + 3, wy + 1, 1, 4);
      }
    }
  }
}
