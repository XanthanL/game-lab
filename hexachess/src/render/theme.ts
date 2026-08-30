// 视觉与时间的单一基线：缓动曲线、动画时长、UI 尺寸、色板。
// 规则要求「禁止匀速 lerp」，所以时长与曲线都必须从这里取。
import { BG_COLOR, FONT_STACK, INK_COLOR, PANEL_COLOR, PIECES, SUB_COLOR, shade } from '../core/colors';

export type EaseFn = (t: number) => number;

export const EASE: Record<string, EaseFn> = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inQuad: (t) => t * t,
  outBack: (t) => {
    const s = 1.4;
    const p = t - 1;
    return 1 + p * p * ((s + 1) * p + s);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const p = 0.36;
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
  },
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0..1 进度 → 位移/缩放插值 */
export function tween(from: number, to: number, t: number, ease: EaseFn = EASE.outCubic): number {
  return lerp(from, to, ease(Math.max(0, Math.min(1, t))));
}

// 方案 §5 的时长表（毫秒）
export const DUR = {
  place: 180,
  mergePiece: 220,
  mergeStagger: 70,
  ghostFade: 160,
  clear: 260,
  lightShaft: 300,
  fail: 480,
  win: 600,
  starPop: 180,
  overlay: 240,
  hitStopCascade: 40,
  hitStopClear: 60,
  hitStopWin: 80,
  inputLockClear: 150,
} as const;

export const UI = {
  radius: 14,
  radiusSmall: 9,
  gap: 10,
  hud: 84,
  tray: 108,
  toolbar: 56,
  minFont: 13, // DPR1 下中文可读下限
  liftDrag: 42, // 拖拽抬升：绘制与命中共用同一个值（现版两处不同导致「看到≠命中」）
} as const;

export const COLOR = {
  bg: BG_COLOR,
  ink: INK_COLOR,
  sub: SUB_COLOR,
  panel: PANEL_COLOR,
  ok: '#3FB68B', // 整摞可落
  part: '#F7BE55', // 只能部分转移
  bad: 'rgba(120,110,100,0.55)', // 非法
  socket: '#EFE7DA', // 空格内壁
  socketEdge: '#E0D5C4',
  locked: '#CFC6B8',
  obstacle: '#9A8F80',
  shadow: 'rgba(70,55,40,0.16)',
};

export interface PieceSkin {
  color: string;
  deep: string;
  name: string;
  type: string;
  light: string; // 顶受光面
}

const SKINS: PieceSkin[] = PIECES.map((p) => ({
  color: p.color,
  deep: p.deep,
  name: p.name,
  type: p.type,
  light: shade(p.color, 22),
}));

export function skin(ci: number): PieceSkin {
  return SKINS[((ci % SKINS.length) + SKINS.length) % SKINS.length];
}

export function font(size: number, bold = false): string {
  const px = Math.max(UI.minFont, Math.round(size));
  return (bold ? '700 ' : '500 ') + px + 'px ' + FONT_STACK;
}

export { PIECES, shade };
