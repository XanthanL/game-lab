import { hexPath } from '../core/hex';
import { INK_COLOR, HEX_STROKE, BG_COLOR, shade } from '../core/colors';

const PIE_H_RATIO = 0.36;   // 更扁的"饼"：用户要求棋子更扁平
export const STACK_STEP_RATIO = 0.34;
const PIXEL = (n: number) => Math.round(n);
const BAND_LIGHT = -6;
const BAND_MID = -18;
const BAND_DARK = -32;

export function drawBackground(ctx: any, W: number, H: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FCF9F3');
  g.addColorStop(1, BG_COLOR);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.4, W * 0.2, W / 2, H * 0.52, W * 0.95);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(1, 'rgba(58,53,48,0.05)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = 'rgba(58,53,48,0.05)';
  const step = 50;
  for (let y = 70; y < H - 120; y += step) {
    for (let x = ((Math.round(y / step)) % 2) * (step / 2); x < W; x += step) {
      ctx.fillRect(PIXEL(x), PIXEL(y), 2, 2);
    }
  }
  ctx.restore();
}

export function drawTrayShelf(ctx: any, W: number, H: number): void {
  // 像素风托盘：方角面板 + 顶部亮线 + 底部暗线（硬边）
  const top = H - 110;
  const h = H - 6 - top;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillRect(8, top, W - 16, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(8, top, W - 16, 2);
  ctx.fillStyle = 'rgba(231,223,211,0.9)';
  ctx.fillRect(8, top + h - 2, W - 16, 2);
  ctx.restore();
}

export function drawHexTile3D(
  ctx: any, x: number, y: number, r: number,
  color: string, h: number, alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(58,53,48,0.18)';
  ctx.beginPath();
  ctx.ellipse(PIXEL(x), PIXEL(y + h + r * 0.28), r * 0.96, r * 0.40, 0, 0, Math.PI * 2);
  ctx.fill();
  const n = 6;
  const topV: [number, number][] = [];
  const botV: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI / 180) * (60 * i);
    topV.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    botV.push([x + r * Math.cos(a), y + r * Math.sin(a) + h]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const midY = (topV[i][1] + topV[j][1]) / 2;
    if (midY > y) {
      ctx.moveTo(topV[i][0], topV[i][1]);
      ctx.lineTo(topV[j][0], topV[j][1]);
      ctx.lineTo(botV[j][0], botV[j][1]);
      ctx.lineTo(botV[i][0], botV[i][1]);
      ctx.closePath();
    }
  }
  ctx.fillStyle = shade(color, BAND_MID);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const bandH = Math.max(2, PIXEL(h * 0.14));
  ctx.fillStyle = shade(color, BAND_LIGHT);
  ctx.fillRect(PIXEL(x - r), PIXEL(y + 2), PIXEL(r * 2), bandH);
  ctx.fillStyle = shade(color, BAND_DARK);
  ctx.fillRect(PIXEL(x - r), PIXEL(y + h - bandH - 2), PIXEL(r * 2), bandH);
  ctx.restore();
  hexPath(ctx, x, y, r);
  ctx.fillStyle = shade(color, 6);
  ctx.fill();
  hexPath(ctx, x, y, r * 0.78);
  ctx.fillStyle = shade(color, 18);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = shade(color, -32);
  hexPath(ctx, x, y, r);
  ctx.stroke();
  ctx.restore();
}

export function drawEmptyCell(
  ctx: any,
  cell: { x: number; y: number; rad: number; highlight: number },
  valid = false,
): void {
  hexPath(ctx, cell.x, cell.y, cell.rad);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = valid ? '#3FB68B' : HEX_STROKE;
  hexPath(ctx, cell.x, cell.y, cell.rad * 0.94);
  ctx.stroke();
  ctx.restore();
  if (cell.highlight > 0) {
    ctx.save();
    ctx.globalAlpha = cell.highlight * 0.55;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFC93C';
    hexPath(ctx, cell.x, cell.y, cell.rad * 1.1);
    ctx.stroke();
    ctx.restore();
  }
}

// 锁格：灰色实底 + 像素斜纹 + 小锁图标（不可放置）
export function drawLockedCell(
  ctx: any,
  cell: { x: number; y: number; rad: number },
): void {
  hexPath(ctx, cell.x, cell.y, cell.rad);
  ctx.fillStyle = '#CBC4B8';
  ctx.fill();
  ctx.save();
  hexPath(ctx, cell.x, cell.y, cell.rad * 0.97);
  ctx.clip();
  ctx.strokeStyle = 'rgba(58,53,48,0.10)';
  ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    const off = i * cell.rad * 0.45;
    ctx.beginPath();
    ctx.moveTo(PIXEL(cell.x - cell.rad + off), PIXEL(cell.y + cell.rad));
    ctx.lineTo(PIXEL(cell.x + cell.rad + off), PIXEL(cell.y - cell.rad));
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#A9A093';
  hexPath(ctx, cell.x, cell.y, cell.rad * 0.94);
  ctx.stroke();
  // 小锁：弧形锁梁 + 方锁体
  const s = cell.rad * 0.30;
  ctx.save();
  ctx.translate(PIXEL(cell.x), PIXEL(cell.y));
  ctx.strokeStyle = INK_COLOR;
  ctx.fillStyle = INK_COLOR;
  ctx.lineWidth = Math.max(2, s * 0.22);
  ctx.beginPath();
  ctx.arc(0, -s * 0.25, s * 0.55, Math.PI, 0);
  ctx.stroke();
  const bw = s * 1.1; const bh = s * 0.8; const by = -s * 0.2;
  ctx.fillRect(PIXEL(-bw / 2), PIXEL(by), PIXEL(bw), PIXEL(bh));
  ctx.restore();
}

// 移动障碍：暖灰棋子塔（车剪影），随 scale 缩放（出生/消失动画）
export function drawObstacle(ctx: any, x: number, y: number, r: number): void {
  if (r <= 0.5) return;
  const h = r * PIE_H_RATIO;
  drawHexTile3D(ctx, x, y, r, '#9A9186', h, 1);
  drawChessIcon(ctx, 'rook', r * 0.42, 'rgba(58,53,48,0.88)');
}

export function drawFlyingTile(
  ctx: any, x: number, y: number, r: number,
  color: string, type: string,
): void {
  const h = r * PIE_H_RATIO;
  drawHexTile3D(ctx, x, y, r, color, h, 1);
  drawChessIcon(ctx, type, r * 0.42);
}

// 渲染"一摞"棋子（托盘组 / 拖拽组用）：底→顶堆叠，顶层带棋子图标。
export function drawPieceStack(
  ctx: any, x: number, y: number, r: number,
  tiles: { color: string; type: string }[],
  scale?: number, alpha?: number,
): void {
  const s = scale === undefined ? 1 : scale;
  const a = alpha === undefined ? 1 : alpha;
  if (tiles.length === 0) return;
  const h = r * PIE_H_RATIO;
  const step = r * STACK_STEP_RATIO;
  const topJ = tiles.length - 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-x, -y);
  for (let j = 0; j < tiles.length; j++) {
    const t = tiles[j];
    const tileR = j === topJ ? r * 0.96 : r * 0.92;
    drawHexTile3D(ctx, x, y - j * step, tileR, t.color, h, 1);
  }
  const top = tiles[topJ];
  ctx.save();
  ctx.translate(x, y - topJ * step);
  drawChessIcon(ctx, top.type, r * 0.40);
  ctx.restore();
  ctx.restore();
}

export function drawCellStack(
  ctx: any,
  cell: {
    x: number; y: number; rad: number;
    stack: { color: string; type: string }[] | null;
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
    ctx.globalAlpha = cell.highlight * 0.55;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFC93C';
    hexPath(ctx, cell.x, cell.y, cell.rad * 1.12);
    ctx.stroke();
    ctx.restore();
  }
  if (!cell.stack || cell.stack.length === 0) {
    drawEmptyCell(ctx, cell, false);
    return;
  }
  const step = cell.rad * STACK_STEP_RATIO;
  const h = cell.rad * PIE_H_RATIO;
  const landT = cell.landT ?? 0;
  const landPop = landT > 0 ? 1 + 0.22 * Math.sin(Math.min(1, Math.max(0, landT / 0.16)) * Math.PI) : 1;
  const topJ = cell.stack.length - 1;
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.scale(landPop, landPop);
  ctx.translate(-cell.x, -cell.y);
  for (let j = 0; j < cell.stack.length; j++) {
    const t = cell.stack[j];
    const tileR = j === topJ ? cell.rad * 0.96 : cell.rad * 0.92;
    drawHexTile3D(ctx, cell.x, cell.y - j * step, tileR, t.color, h, 1);
  }
  ctx.restore();
  const top = cell.stack[topJ];
  ctx.save();
  ctx.translate(cell.x, cell.y - topJ * step);
  drawChessIcon(ctx, top.type, cell.rad * 0.40);
  ctx.restore();
  if (cell.stack.length > 1) {
    ctx.fillStyle = INK_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold ' + Math.round(cell.rad * 0.42) + 'px "Courier New", Consolas, monospace';
    ctx.fillText('x' + cell.stack.length, cell.x, cell.y + cell.rad * 0.86);
  }
}

export function drawChessIcon(ctx: any, type: string, s: number, fill = '#FFFFFF'): void {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = 'rgba(58,53,48,0.12)';
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const u = s;
  const fl = (p: () => void) => { ctx.beginPath(); p(); ctx.fill(); ctx.stroke(); };
  switch (type) {
    case 'pawn':
      fl(() => { ctx.arc(0, -u * 0.4, u * 0.3, 0, Math.PI * 2); });
      fl(() => { ctx.moveTo(-u * 0.26, u * 0.55); ctx.lineTo(-u * 0.16, -u * 0.08); ctx.lineTo(u * 0.16, -u * 0.08); ctx.lineTo(u * 0.26, u * 0.55); ctx.closePath(); });
      break;
    case 'knight':
      fl(() => { ctx.moveTo(-u * 0.34, u * 0.5); ctx.lineTo(-u * 0.14, u * 0.08); ctx.lineTo(-u * 0.3, -u * 0.2); ctx.lineTo(0, -u * 0.5); ctx.quadraticCurveTo(u * 0.36, -u * 0.45, u * 0.2, u * 0.05); ctx.lineTo(u * 0.34, u * 0.5); ctx.closePath(); });
      break;
    case 'bishop':
      fl(() => { ctx.moveTo(-u * 0.28, u * 0.5); ctx.lineTo(-u * 0.12, -u * 0.08); ctx.quadraticCurveTo(0, -u * 0.52, u * 0.12, -u * 0.08); ctx.lineTo(u * 0.28, u * 0.5); ctx.closePath(); });
      fl(() => { ctx.arc(0, -u * 0.48, u * 0.15, 0, Math.PI * 2); });
      break;
    case 'rook':
      fl(() => { ctx.moveTo(-u * 0.3, u * 0.5); ctx.lineTo(-u * 0.3, -u * 0.12); ctx.lineTo(-u * 0.16, -u * 0.12); ctx.lineTo(-u * 0.16, -u * 0.4); ctx.lineTo(-u * 0.05, -u * 0.4); ctx.lineTo(-u * 0.05, -u * 0.16); ctx.lineTo(u * 0.05, -u * 0.16); ctx.lineTo(u * 0.05, -u * 0.4); ctx.lineTo(u * 0.16, -u * 0.4); ctx.lineTo(u * 0.16, -u * 0.12); ctx.lineTo(u * 0.3, -u * 0.12); ctx.lineTo(u * 0.3, u * 0.5); ctx.closePath(); });
      break;
    case 'queen':
      fl(() => { ctx.moveTo(-u * 0.34, u * 0.45); ctx.lineTo(-u * 0.34, -u * 0.1); ctx.lineTo(-u * 0.17, u * 0.12); ctx.lineTo(0, -u * 0.2); ctx.lineTo(u * 0.17, u * 0.12); ctx.lineTo(u * 0.34, -u * 0.1); ctx.lineTo(u * 0.34, u * 0.45); ctx.closePath(); });
      fl(() => { ctx.arc(0, -u * 0.28, u * 0.1, 0, Math.PI * 2); });
      break;
    case 'king':
      fl(() => { ctx.moveTo(-u * 0.34, u * 0.45); ctx.lineTo(-u * 0.34, -u * 0.1); ctx.lineTo(-u * 0.17, u * 0.12); ctx.lineTo(0, -u * 0.18); ctx.lineTo(u * 0.17, u * 0.12); ctx.lineTo(u * 0.34, -u * 0.1); ctx.lineTo(u * 0.34, u * 0.45); ctx.closePath(); });
      fl(() => { ctx.arc(0, -u * 0.32, u * 0.12, 0, Math.PI * 2); });
      break;
    default:
      fl(() => { ctx.arc(0, 0, u * 0.4, 0, Math.PI * 2); });
  }
  ctx.restore();
}
