// 约束布局 + 命中树。渲染时注册矩形，命中测试读同一棵树，
// 从根上消灭现版「画在一处、按钮命中判另一处硬编码像素」的问题。
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Spec {
  id: string;
  h?: number; // 固定高度
  flex?: number; // 分配剩余高度的权重
  pad?: number; // 该节点内部留白（不影响兄弟）
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: Math.max(0, r.w - 2 * d), h: Math.max(0, r.h - 2 * d) };
}

export function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 纵向切分：固定高度先占位，flex 项按比例分剩余
export function vstack(box: Rect, specs: Spec[], gap = 0): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  let fixed = 0;
  let flexSum = 0;
  for (const s of specs) {
    if (s.h != null) fixed += s.h;
    else flexSum += s.flex || 1;
  }
  const gaps = Math.max(0, specs.length - 1) * gap;
  const rest = Math.max(0, box.h - fixed - gaps);
  let y = box.y;
  let usedFlex = 0;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const h = s.h != null ? s.h : flexSum ? (rest * (s.flex || 1)) / flexSum : 0;
    const inner = s.pad ? inset(rect(box.x, y, box.w, h), s.pad) : rect(box.x, y, box.w, h);
    out[s.id] = inner;
    usedFlex += h;
    y += h + gap;
  }
  // 浮点误差归到最后一个 flex 项，避免底部出现 1px 缝
  if (flexSum > 0 && specs.length) {
    const last = specs[specs.length - 1];
    if (last.flex != null || last.h == null) {
      const r = out[last.id];
      r.h = Math.max(0, r.h + (box.y + box.h - (r.y + r.h)));
    }
  }
  void usedFlex;
  return out;
}

// 横向等分 n 份（工具栏按钮、托盘槽位）
export function hslice(box: Rect, n: number, gap = 0): Rect[] {
  const out: Rect[] = [];
  const total = Math.max(1, n);
  const w = Math.max(0, (box.w - gap * (total - 1)) / total);
  for (let i = 0; i < total; i++)
    out.push(rect(box.x + i * (w + gap), box.y, w, box.h));
  return out;
}

export interface HitItem {
  id: string;
  r: Rect;
  z: number;
}

// 每帧渲染前 clear，绘制按钮/面板/格子时 add；场景在 pointerdown 里 pick。
// z 大的优先（遮罩 > 按钮 > 棋盘）。
export class HitTree {
  items: HitItem[] = [];

  clear(): void {
    this.items.length = 0;
  }

  add(id: string, r: Rect, z = 0): void {
    this.items.push({ id, r, z });
  }

  pick(x: number, y: number): string | null {
    let best: HitItem | null = null;
    for (const it of this.items) {
      if (!contains(it.r, x, y)) continue;
      if (!best || it.z >= best.z) best = it;
    }
    return best ? best.id : null;
  }
}

/** 圆角矩形路径（全平台可用的最小实现；几何助手，画与命中同源都用它） */
export function roundRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}
