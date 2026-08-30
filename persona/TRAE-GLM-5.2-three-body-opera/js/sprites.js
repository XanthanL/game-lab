/* ============================================================
   三体 · 像素歌剧 — 像素精灵与场景绘制
   ============================================================ */

/* ---------- 颜色混合 ---------- */
function mix(c1, c2, p) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, p));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, p));
  const bl = Math.round(lerp(a & 255, b & 255, p));
  return `rgb(${r},${g},${bl})`;
}

/* ---------- 像素线段 ---------- */
function pxLine(ctx, x1, y1, x2, y2) {
  x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    ctx.fillRect(x1, y1, 1, 1);
    if (x1 === x2 && y1 === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x1 += sx; }
    if (e2 < dx) { err += dx; y1 += sy; }
  }
}

/* ---------- 字符画精灵 ---------- */
function drawMap(ctx, map, pal, x, y, o = {}) {
  const s = o.scale || 1;
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      const cc = o.flip ? row.length - 1 - c : c;
      ctx.fillRect(Math.round(x + cc * s), Math.round(y + r * s), s, s);
    }
  }
}

/* ---------- 人物（两帧行走） ---------- */
const HUMAN_A = [
  "  H  ",
  " HHH ",
  "  S  ",
  " CCC ",
  "CCCCC",
  " CCC ",
  " CCC ",
  " C C ",
  " L L ",
  " L L ",
  "L   L",
];
const HUMAN_B = [
  "  H  ",
  " HHH ",
  "  S  ",
  " CCC ",
  "CCCCC",
  " CCC ",
  " CCC ",
  " C C ",
  "  L  ",
  " L L ",
  "L   L",
];
function drawHuman(ctx, x, y, o = {}) {
  const frame = o.still ? HUMAN_B : (Math.floor((o.walk || 0)) % 2 === 0 ? HUMAN_A : HUMAN_B);
  const bob = o.still ? 0 : Math.abs(Math.sin((o.walk || 0) * Math.PI));
  drawMap(ctx, frame, {
    H: o.hair || '#1a1410',
    S: o.skin || '#e0b090',
    C: o.coat || '#7a3b2e',
    L: o.legs || '#20242e'
  }, x, y - Math.round(bob), o);
}

/* ---------- 抛物面天线（红岸基地） ----------
   tilt=0 时碟口朝上；局部坐标绘制后整体旋转 */
function drawDish(ctx, x, y, r, tilt, col = '#22303f', edge = '#4a6a8a') {
  const depth = r * .55;
  const dark = mix(col, '#000000', .3);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  /* 碟面：加厚抛物线曲面，上沿亮、下沿暗、碟口两端高光 */
  for (let u = -r; u <= r; u++) {
    const v = Math.round((u * u) / (r * r) * depth);
    const rim = Math.abs(u) > r - 2;
    ctx.fillStyle = rim ? edge : col;
    ctx.fillRect(u, v, 1, 2);
    ctx.fillStyle = rim ? mix(edge, '#000000', .3) : dark;
    ctx.fillRect(u, v + 2, 1, 2);
  }
  /* 馈源支杆：两条斜杆 + 中央杆 */
  const f = Math.round(depth * .95);
  ctx.fillStyle = edge;
  pxLine(ctx, Math.round(-r * .8), Math.round(depth * .64), 0, -f);
  pxLine(ctx, Math.round(r * .8), Math.round(depth * .64), 0, -f);
  ctx.fillStyle = col;
  pxLine(ctx, 0, 0, 0, -f);
  /* 馈源舱 */
  ctx.fillStyle = edge;
  ctx.fillRect(-1, -f - 1, 3, 3);
  ctx.restore();
  /* 塔身（不随碟面旋转） */
  ctx.fillStyle = '#18222e';
  ctx.fillRect(Math.round(x) - 3, Math.round(y), 6, 90);
  ctx.fillRect(Math.round(x) - 8, Math.round(y) + 18, 16, 2);
}

/* ---------- “审判日”号（可切片） ---------- */
const SHIP_MAP = [
  "                                            T       ",
  "                                         TTTTT      ",
  "                            DDDDDDDDDDDDTTTTTTT     ",
  "         DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD      ",
  "    DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD      ",
  "  HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH  ",
  " HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH ",
  " HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
  "  HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH ",
];
const SHIP_PAL = { H: '#3a4c60', D: '#c2cdd8', T: '#8496a6' };
/* offsets: 每两条图带一组的横向滑移（古筝切片效果）；2 倍像素放大 */
function drawShip(ctx, x, y, offsets) {
  const s = 2;
  for (let band = 0; band < SHIP_MAP.length; band += 2) {
    const off = offsets ? (offsets[band / 2] || 0) : 0;
    const rows = SHIP_MAP.slice(band, band + 2);
    drawMap(ctx, rows, SHIP_PAL, x + Math.round(off), y + band * s, { scale: s });
  }
}

/* ---------- 恒星级战舰 ---------- */
const WARSHIP_MAP = [
  "     S    ",
  "  SSSSSSSS",
  "SSSSSSSSSS",
];
function drawWarship(ctx, x, y, t, alive = true) {
  drawMap(ctx, WARSHIP_MAP, { S: alive ? '#7f8fa3' : '#2c3038' }, x, y, {});
  if (alive) { /* 引擎光 */
    const fl = 1 + Math.round(Math.sin(t / 90 + x) * 1);
    ctx.fillStyle = '#8fd4ff';
    ctx.fillRect(Math.round(x) - 2, Math.round(y) + 2, fl, 1);
    ctx.fillStyle = '#d8f0ff';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) + 2, 1, 1);
  }
}

/* ---------- 水滴 ---------- */
const DROP_MAP = [
  "   W ",
  "  WWW",
  " WWW ",
  "WWWW ",
  " WWW ",
  "  WWW",
  "   W ",
];
function drawDroplet(ctx, x, y, t) {
  ctx.save();
  ctx.shadowColor = '#bfe0ff';
  ctx.shadowBlur = 9;
  drawMap(ctx, DROP_MAP, { W: '#e8f2ff' }, x, y, {});
  ctx.restore();
  ctx.fillStyle = 'rgba(160,200,255,.5)';
  ctx.fillRect(Math.round(x) + 4, Math.round(y) + 3, 6 + Math.round(Math.sin(t / 120) * 2), 1);
}

/* ---------- 金字塔 ---------- */
function drawPyramid(ctx, x, baseY, w, h, col, lit) {
  for (let r = 0; r < h; r++) {
    const ww = w * (1 - r / h);
    ctx.fillStyle = r % 2 ? col : mix(col, '#000000', .12);
    ctx.fillRect(Math.round(x - ww / 2), baseY - r, Math.max(1, Math.round(ww)), 1);
  }
  ctx.fillStyle = lit || '#c9a96e';
  pxLine(ctx, x - w / 2, baseY, x, baseY - h);
}

/* ---------- 星空 ---------- */
function makeStars(n, w = 520, h = 240) {
  const cols = ['#ffffff', '#cfe0ff', '#ffe9c9', '#aebbff'];
  const arr = [];
  for (let i = 0; i < n; i++)
    arr.push({
      x: Math.random() * w - 20, y: Math.random() * h,
      s: Math.random() < .85 ? 1 : 2,
      ph: Math.random() * 6.28,
      a: .5 + Math.random() * .5,
      c: cols[(Math.random() * cols.length) | 0]
    });
  return arr;
}
function drawStars(ctx, stars, t, alpha = 1) {
  for (const s of stars) {
    ctx.globalAlpha = alpha * s.a * (.6 + .4 * Math.sin(t / 420 + s.ph));
    ctx.fillStyle = s.c;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
  }
  ctx.globalAlpha = 1;
}

/* ---------- 渐变天空 ---------- */
function skyGrad(stops, w = 560, h = 280) {
  return (ctx, t, stage) => {
    const W = stage ? stage.W + 80 : w, H = stage ? stage.H : h;
    const g = ctx.createLinearGradient(0, -10, 0, H);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -30, W, H + 60);
  };
}

/* ---------- 山脊剪影 ---------- */
function ridge(ctx, baseY, amp, color, seed = 0, step = 4, w = 560) {
  ctx.fillStyle = color;
  for (let x = -40; x <= w; x += step) {
    const y = baseY - Math.abs(Math.sin((x + seed) * .021) * amp + Math.sin((x + seed) * .053) * amp * .45);
    ctx.fillRect(x, Math.round(y), step, 400);
  }
}

/* ---------- 发光天体 ---------- */
function drawOrb(ctx, x, y, r, color, glow) {
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = r * 2.2; }
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1);
  }
  ctx.restore();
}

/* ---------- 墓碑 ---------- */
function drawGrave(ctx, x, y) {
  ctx.fillStyle = '#454b58';
  ctx.fillRect(x - 4, y - 12, 8, 12);
  ctx.fillRect(x - 3, y - 13, 6, 1);
  ctx.fillRect(x - 6, y - 2, 12, 2);
  ctx.fillStyle = '#2c313c';
  ctx.fillRect(x - 3, y - 10, 6, 1);
  ctx.fillRect(x - 2, y - 8, 4, 1);
}

/* ---------- 智子巨眼 ---------- */
function drawEye(ctx, x, y, rx, ry, open, t) {
  const oy = ry * clamp(open, 0, 1);
  if (oy < 1) return;
  ctx.save();
  ctx.shadowColor = '#fff2d8'; ctx.shadowBlur = 14;
  for (let dy = -oy; dy <= oy; dy++) {
    const w = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (oy * oy)));
    ctx.fillStyle = '#efe8d2';
    ctx.fillRect(Math.round(x - w), Math.round(y + dy), Math.round(w * 2), 1);
  }
  ctx.shadowBlur = 0;
  /* 虹膜 */
  const ir = oy * .62;
  for (let dy = -ir; dy <= ir; dy++) {
    const w = ir * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ir * ir)));
    ctx.fillStyle = mix('#8a2a20', '#3a0f0a', Math.abs(dy) / ir);
    ctx.fillRect(Math.round(x - w), Math.round(y + dy), Math.round(w * 2), 1);
  }
  /* 竖瞳 */
  ctx.fillStyle = '#050505';
  const pw = 1 + Math.sin(t / 700) * .5;
  ctx.fillRect(Math.round(x - pw), Math.round(y - ir * .8), Math.round(pw * 2) + 1, Math.round(ir * 1.6));
  ctx.restore();
}

/* ---------- 水面 ---------- */
function drawWater(ctx, y0, t, c1 = '#0c2436', c2 = '#16405c', w = 560, h = 300) {
  ctx.fillStyle = c1;
  ctx.fillRect(-60, y0, w, h);
  for (let y = y0 + 2; y < y0 + 120; y += 3) {
    const k = (y - y0) / 120;
    const off = Math.sin(t / 600 + y * .35) * (3 + k * 6);
    ctx.fillStyle = c2;
    ctx.globalAlpha = .5 - k * .3;
    ctx.fillRect(Math.round(20 + off * 3 + (y * 37) % 140), y, 30 + (y * 13) % 50, 1);
    ctx.fillRect(Math.round(260 - off * 2 + (y * 53) % 120), y, 24 + (y * 29) % 60, 1);
  }
  ctx.globalAlpha = 1;
}
