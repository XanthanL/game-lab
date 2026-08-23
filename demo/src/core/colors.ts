// 调色板与棋子定义（与 GDD §4.2 / §4.6 一致）
export interface PieceDef {
  type: string;
  name: string;
  color: string;
}

export const PIECES: PieceDef[] = [
  { type: 'pawn', name: '兵', color: '#E8635A' },
  { type: 'knight', name: '马', color: '#4C8BF5' },
  { type: 'bishop', name: '象', color: '#3FB68B' },
  { type: 'rook', name: '车', color: '#F2B84B' },
  { type: 'queen', name: '后', color: '#9B6BD6' },
  { type: 'king', name: '王', color: '#5AC3D9' },
];

export const BG_COLOR = '#FAF6EF'; // 奶油白
export const INK_COLOR = '#3A3530'; // 暖灰棕
export const HEX_STROKE = '#E7DFD3'; // 六边形默认描边

// 颜色调亮/调暗：percent>0 提亮，<0 压暗（0..100）。用于渐变底盘与投影。
export function shade(hex: string, percent: number): string {
  const c = hex.replace('#', '');
  const n = parseInt(
    c.length === 3
      ? c.split('').map((ch) => ch + ch).join('')
      : c,
    16,
  );
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
