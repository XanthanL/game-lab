// Soft 3D 渲染图元：柔和立体六棱柱棋子 + 圆角 UI。
// 美术铁律（用户强调）：不要像素风——
//  - 立体感来自：侧壁线性渐变（亮→深）+ 顶面径向高光 + 柔和投影（无硬边色带）；
//  - UI 一律圆角 + 半透明面板；字体圆润无衬线；
//  - 全程不做 Math.round 像素对齐、不用离散色带、不用最近邻放大。
import { hexPath } from '../core/hex';
import { PIECES, BG_COLOR, SUB_COLOR, shade } from '../core/colors';

const PIE_H_RATIO = 0.42;          // 六棱柱高/半径比（立体但保持"扁平棋子"感）
export const STACK_STEP_RATIO = 0.30;

export function pieceDeep(color: string): string {
  return PIECES.find((p) => p.color === color)?.deep || shade(color, -25);
}

export function drawBackground(ctx: any, W: number, H: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FEFCF8');
  g.addColorStop(1, BG_COLOR);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawTrayShelf(ctx: any, W: number, H: number): void {
  // 圆角半透明托盘面板 + 上沿细高光（柔和，非像素斜面）
  const pad = 10;
  const top = H - 108;
  const h = H - pad - top;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  roundRect(ctx, 8, top, W - 16, h, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── 核心：柔和立体六棱柱 ────────────────────────────────────
// 落地软阴影 → 侧壁垂直渐变（顶亮·底深）→ 底缘深色包边 → 平顶面 + 径向高光。
function hexPrism(
  ctx: any, x: number, y: number, r: number,
  color: string, deep: string, h: number,
): void {
  // 软阴影：椭圆模糊感（多层低透明叠加，柔和过渡）
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.05 * i * (h / (r * PIE_H_RATIO));
    ctx.fillStyle = '#8A7A66';
    ctx.beginPath();
    ctx.ellipse(x, y + h + r * 0.22, r * (0.78 + 0.08 * (3 - i)), r * (0.3 + 0.04 * (3 - i)), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 侧壁：先整体填充深色底，再叠垂直渐变亮带（平滑立体）
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a) + h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  for (let i = 5; i >= 0; i--) {
    const a = (Math.PI / 180) * (60 * i);
    ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = deep;
  ctx.fill();

  // 正面侧壁渐变（下半可见区）：上浅下深，柔和立体主来源
  ctx.save();
  ctx.clip();
  const side = ctx.createLinearGradient(0, y, 0, y + h + r * 0.5);
  side.addColorStop(0, shade(color, 4));
  side.addColorStop(0.45, color);
  side.addColorStop(1, deep);
  ctx.fillStyle = side;
  ctx.fillRect(x - r, y, r * 2, h + r);
  ctx.restore();

  // 顶面：径向渐变（左上受光），中心微凸的"软 3D"观感
  hexPath(ctx, x, y, r);
  const topG = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.15, x, y, r * 1.25);
  topG.addColorStop(0, shade(color, 16));
  topG.addColorStop(0.55, color);
  topG.addColorStop(1, shade(color, -6));
  ctx.fillStyle = topG;
  ctx.fill();
  // 顶面边缘极细描边（同色系加深，柔和不抢眼）
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.strokeStyle = shade(deep, 12);
  ctx.stroke();
}

// 顶面棋子剪影（白色，带轻微落影增强浮凸感）
export function drawChessIcon(ctx: any, type: string, s: number): void {
  ctx.save();
  ctx.translate(0, s * 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  stamp(ctx, type, s);
  ctx.translate(0, -s * 0.06);
  ctx.fillStyle = '#FFFFFF';
  stamp(ctx, type, s);
  ctx.restore();
}

function stamp(ctx: any, type: string, s: number): void {
  ctx.beginPath();
  const u = s;
  switch (type) {
    case 'pawn':
      ctx.arc(0, -u * 0.38, u * 0.3, 0, Math.PI * 2);
      ctx.moveTo(-u * 0.26, u * 0.55);
      ctx.lineTo(-u * 0.15, -u * 0.06);
      ctx.lineTo(u * 0.15, -u * 0.06);
      ctx.lineTo(u * 0.26, u * 0.55);
      ctx.closePath();
      break;
    case 'knight':
      ctx.moveTo(-u * 0.34, u * 0.5);
      ctx.lineTo(-u * 0.14, u * 0.08);
      ctx.lineTo(-u * 0.3, -u * 0.2);
      ctx.lineTo(0, -u * 0.5);
      ctx.quadraticCurveTo(u * 0.36, -u * 0.45, u * 0.2, u * 0.05);
      ctx.lineTo(u * 0.34, u * 0.5);
      ctx.closePath();
      break;
    case 'bishop':
      ctx.moveTo(-u * 0.28, u * 0.5);
      ctx.lineTo(-u * 0.12, -u * 0.08);
      ctx.quadraticCurveTo(0, -u * 0.52, u * 0.12, -u * 0.08);
      ctx.lineTo(u * 0.28, u * 0.5);
      ctx.closePath();
      ctx.moveTo(u * 0.13, -u * 0.48);
      ctx.arc(0, -u * 0.48, u * 0.13, 0, Math.PI * 2);
      break;
    case 'rook':
      ctx.moveTo(-u * 0.3, u * 0.5);
      ctx.lineTo(-u * 0.3, -u * 0.12);
      ctx.lineTo(-u * 0.16, -u * 0.12);
      ctx.lineTo(-u * 0.16, -u * 0.4);
      ctx.lineTo(-u * 0.05, -u * 0.4);
      ctx.lineTo(-u * 0.05, -u * 0.16);
      ctx.lineTo(u * 0.05, -u * 0.16);
      ctx.lineTo(u * 0.05, -u * 0.4);
      ctx.lineTo(u * 0.16, -u * 0.4);
      ctx.lineTo(u * 0.16, -u * 0.12);
      ctx.lineTo(u * 0.3, -u * 0.12);
      ctx.lineTo(u * 0.3, u * 0.5);
      ctx.closePath();
      break;
    case 'queen':
      ctx.moveTo(-u * 0.34, u * 0.45);
      ctx.lineTo(-u * 0.34, -u * 0.1);
      ctx.lineTo(-u * 0.17, u * 0.12);
      ctx.lineTo(0, -u * 0.2);
      ctx.lineTo(u * 0.17, u * 0.12);
      ctx.lineTo(u * 0.34, -u * 0.1);
      ctx.lineTo(u * 0.34, u * 0.45);
      ctx.closePath();
      ctx.moveTo(u * 0.11, -u * 0.28);
      ctx.arc(0, -u * 0.28, u * 0.11, 0, Math.PI * 2);
      break;
    case 'king':
      ctx.moveTo(-u * 0.34, u * 0.45);
      ctx.lineTo(-u * 0.34, -u * 0.1);
      ctx.lineTo(-u * 0.17, u * 0.12);
      ctx.lineTo(0, -u * 0.18);
      ctx.lineTo(u * 0.17, u * 0.12);
      ctx.lineTo(u * 0.34, -u * 0.1);
      ctx.lineTo(u * 0.34, u * 0.45);
      ctx.closePath();
      ctx.moveTo(u * 0.12, -u * 0.32);
      ctx.arc(0, -u * 0.32, u * 0.12, 0, Math.PI * 2);
      break;
    default:
      ctx.arc(0, 0, u * 0.4, 0, Math.PI * 2);
  }
  ctx.fill();
}

// 空棋盘格：内凹软窝（径向渐变 + 内阴影感），提示可放置
export function drawEmptyCell(
  ctx: any,
  cell: { x: number; y: number; rad: number; highlight: number },
): void {
  hexPath(ctx, cell.x, cell.y, cell.rad);
  const g = ctx.createRadialGradient(cell.x, cell.y - cell.rad * 0.2, cell.rad * 0.2, cell.x, cell.y, cell.rad);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(214,203,186,0.55)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(167,155,140,0.35)';
  ctx.stroke();
  if (cell.highlight > 0) {
    ctx.save();
    ctx.globalAlpha = cell.highlight * 0.65;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFC93C';
    hexPath(ctx, cell.x, cell.y, cell.rad * 1.08);
    ctx.stroke();
    ctx.restore();
  }
}

// 锁格：哑光灰圆角六边形 + 小锁
export function drawLockedCell(ctx: any, cell: { x: number; y: number; rad: number }): void {
  hexPath(ctx, cell.x, cell.y, cell.rad);
  const g = ctx.createLinearGradient(cell.x, cell.y - cell.rad, cell.x, cell.y + cell.rad);
  g.addColorStop(0, '#D8D2C8');
  g.addColorStop(1, '#C2BBB0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ABA396';
  ctx.stroke();
  const s = cell.rad * 0.3;
  ctx.save();
  ctx.translate(cell.x, cell.y + s * 0.1);
  ctx.strokeStyle = 'rgba(67,57,47,0.75)';
  ctx.fillStyle = 'rgba(67,57,47,0.75)';
  ctx.lineWidth = Math.max(2, s * 0.22);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -s * 0.25, s * 0.52, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, -s * 0.58, -s * 0.22, s * 1.16, s * 0.85, s * 0.18);
  ctx.fill();
  ctx.restore();
}

// 移动障碍：暖灰立体棱柱塔（车剪影）
export function drawObstacle(ctx: any, x: number, y: number, r: number): void {
  if (r <= 0.5) return;
  const h = r * PIE_H_RATIO;
  hexPrism(ctx, x, y, r, '#A79E92', '#7E766B', h);
  ctx.save();
  ctx.translate(x, y);
  drawChessIcon(ctx, 'rook', r * 0.4);
  ctx.restore();
}

// 托盘组/拖拽组的一摞棋子
export function drawPieceStack(
  ctx: any, x: number, y: number, r: number,
  tiles: { color: string }[],
  scale = 1, alpha = 1,
): void {
  if (tiles.length === 0) return;
  const h = r * PIE_H_RATIO;
  const step = r * STACK_STEP_RATIO;
  const topJ = tiles.length - 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  for (let j = 0; j < tiles.length; j++) {
    const t = tiles[j];
    hexPrism(ctx, x, y - j * step, j === topJ ? r : r * 0.97, t.color, pieceDeep(t.color), h);
  }
  ctx.save();
  ctx.translate(x, y - topJ * step);
  drawChessIcon(ctx, typeOf(tiles[topJ].color), r * 0.42);
  ctx.restore();
  ctx.restore();
}

import { PIECES as P } from '../core/colors';
function typeOf(color: string): string {
  return P.find((p) => p.color === color)?.type || 'pawn';
}

// 棋盘格堆叠渲染（含落地回弹）
export function drawCellStack(
  ctx: any,
  cell: {
    x: number; y: number; rad: number;
    stack: { color: string }[] | null;
    highlight: number; landT?: number;
    locked?: boolean;
  },
): void {
  if (cell.locked) {
    drawLockedCell(ctx, cell);
    return;
  }
  if (cell.highlight > 0) {
    ctx.save();
    ctx.globalAlpha = cell.highlight * 0.65;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFC93C';
    hexPath(ctx, cell.x, cell.y, cell.rad * 1.1);
    ctx.stroke();
    ctx.restore();
  }
  if (!cell.stack || cell.stack.length === 0) {
    drawEmptyCell(ctx, cell);
    return;
  }
  const step = cell.rad * STACK_STEP_RATIO;
  const h = cell.rad * PIE_H_RATIO;
  const landT = cell.landT ?? 0;
  const pop = landT > 0 ? 1 + 0.18 * Math.sin((landT / 0.18) * Math.PI) : 1;
  const topJ = cell.stack.length - 1;
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.scale(pop, pop);
  ctx.translate(-cell.x, -cell.y);
  for (let j = 0; j < cell.stack.length; j++) {
    const t = cell.stack[j];
    hexPrism(ctx, cell.x, cell.y - j * step, j === topJ ? cell.rad : cell.rad * 0.97, t.color, pieceDeep(t.color), h);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(cell.x, cell.y - topJ * step);
  drawChessIcon(ctx, typeOf(cell.stack[topJ].color), cell.rad * 0.4);
  ctx.restore();
  if (cell.stack.length > 1) {
    // 层数徽章：白色胶囊 + 深字（柔和，非裸文字）
    const label = 'x' + cell.stack.length;
    ctx.font = `600 ${Math.round(cell.rad * 0.4)}px sans-serif`;
    const tw = ctx.measureText(label).width;
    const bw = tw + cell.rad * 0.42;
    const bh2 = cell.rad * 0.56;
    const bx = cell.x - bw / 2;
    const by = cell.y + cell.rad * 0.52;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, bx, by, bw, bh2, bh2 / 2);
    ctx.fill();
    ctx.fillStyle = '#43392F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cell.x, by + bh2 / 2 + 1);
  }
}

// 合并飞行中的棋子
export function drawFlyingTile(
  ctx: any, x: number, y: number, r: number,
  color: string, type: string,
): void {
  hexPrism(ctx, x, y, r, color, pieceDeep(color), r * PIE_H_RATIO);
  ctx.save();
  ctx.translate(x, y);
  drawChessIcon(ctx, type, r * 0.4);
  ctx.restore();
}

export { SUB_COLOR };
