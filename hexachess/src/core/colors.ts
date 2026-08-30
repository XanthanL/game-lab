// 调色板与棋子定义（Soft 3D 美术方向：柔和立体、无像素）
// 铁律（用户强调）：不要像素风。所有绘制走平滑渐变/圆角/软阴影，禁用 Math.round 硬边与最近邻放大。
export interface PieceDef {
  type: string;
  name: string;
  color: string;      // 主色（棋子顶面）
  deep: string;       // 深色（侧壁下沿/描边，同色系加深）
}

export const PIECES: PieceDef[] = [
  { type: 'pawn',   name: '兵', color: '#F2766C', deep: '#C94F46' },
  { type: 'knight', name: '马', color: '#5E97F8', deep: '#3B6FD0' },
  { type: 'bishop', name: '象', color: '#43C08E', deep: '#2A9669' },
  { type: 'rook',   name: '车', color: '#F7BE55', deep: '#D19432' },
  { type: 'queen',  name: '后', color: '#A87DE0', deep: '#7E54B8' },
  { type: 'king',   name: '王', color: '#54CBDD', deep: '#2FA1B4' },
];

export const BG_COLOR = '#FBF7F0';    // 奶油白
export const INK_COLOR = '#43392F';   // 暖深棕（文字）
export const SUB_COLOR = '#A79B8C';   // 次要文字
export const PANEL_COLOR = '#FFFFFF'; // 面板

// UI 字体：圆润无衬线栈（微信端回退系统字体；绝不使用等宽/像素字）
export const FONT_STACK =
  '-apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif';

export function font(size: number, bold = true): string {
  return (bold ? '600 ' : '400 ') + size + 'px ' + FONT_STACK;
}

// 颜色调亮/调暗：percent>0 提亮，<0 压暗（0..100）。用于立体侧壁渐变与阴影。
export function shade(hex: string, percent: number): string {
  const c = hex.replace('#', '');
  const n = parseInt(
    c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c,
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
