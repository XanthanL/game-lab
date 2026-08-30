// 棋盘视图：几何、格位、塔、拖拽幽灵、落点预览、提示脉冲。
// 逻辑态里没有屏幕坐标，这里全部以 CellId 为键现算，渲染与命中共用同一份 layout。
import { fitHexLayout } from '../core/hex';
import { GameState } from '../logic/state';
import { Rect, roundRectPath } from '../view/layout';
import { COLOR, skin } from './theme';
import { SpriteKit, drawLocked, drawObstacle, drawPreview, drawSocket, drawTower } from './sprites';

export interface BoardLayout {
  box: Rect;
  size: number;
  pos: { x: number; y: number }[];
  hitR: number;
  maxH: number; // 允许画出的最大塔高（像素）
}

export function computeLayout(box: Rect, cells: { q: number; r: number }[]): BoardLayout {
  const { size, ox, oy } = fitHexLayout(cells, box.x + box.w / 2, box.y + box.h / 2, box.w, box.h);
  const pos = cells.map((c) => ({
    x: size * 1.5 * c.q + ox,
    y: size * Math.sqrt(3) * (c.r + c.q / 2) + oy,
  }));
  return {
    box,
    size,
    pos,
    hitR: size * 0.98,
    maxH: Math.max(size * 3, box.h * 0.5),
  };
}

/** 命中：取最近格心，超出 hitR 视为没选中 */
export function cellAt(l: BoardLayout, x: number, y: number): number {
  let best = -1;
  let bd = l.hitR * l.hitR;
  for (let i = 0; i < l.pos.length; i++) {
    const dx = l.pos[i].x - x;
    const dy = l.pos[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

export interface CellVisual {
  glow?: number; // 0..1 融合/消除高亮
  land?: number; // 0..1 落地动画进度
  ghost?: { color: number; count: number; alpha: number }; // 源格淡出残留
  pulse?: number; // 障碍接近提示
}

export interface DragVisual {
  color: number;
  count: number;
  x: number;
  y: number;
  target: { cell: number; kind: 'whole' | 'part' | 'bad'; count: number } | null;
  chain: number[]; // 将被吸走的邻居链
}

export function drawBoard(
  ctx: any,
  kit: SpriteKit,
  l: BoardLayout,
  st: GameState,
  vis: Map<number, CellVisual>,
  drag: DragVisual | null,
  hintCell: number | null,
  time: number,
  layerH: number,
): void {
  const r = l.size * 0.86;

  // 1) 格位底板
  for (let i = 0; i < l.pos.length; i++) {
    const p = l.pos[i];
    if (st.locked[i]) drawLocked(ctx, p.x, p.y, r);
    else drawSocket(ctx, p.x, p.y, r);
  }

  // 2) 提示脉冲（画在塔下，避免遮挡棋子）
  if (hintCell != null && hintCell >= 0 && l.pos[hintCell]) {
    const p = l.pos[hintCell];
    const k = 0.5 + 0.5 * Math.sin(time * 5.2);
    ctx.save();
    ctx.strokeStyle = COLOR.ok;
    ctx.globalAlpha = 0.35 + 0.45 * k;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (1.02 + 0.08 * k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3) 拖拽目标链：虚线圈出将被吸走的邻居，避免级联「看不懂」
  if (drag && drag.chain.length) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(63,182,139,0.75)';
    ctx.lineWidth = 2;
    for (const c of drag.chain) {
      const p = l.pos[c];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4) 塔：按 y 排序画，靠下的后画（正视角下的自然遮挡关系）
  const order = l.pos.map((_, i) => i).sort((a, b) => l.pos[a].y - l.pos[b].y);
  for (const i of order) {
    const s = st.stacks[i];
    const v = vis.get(i);
    if (v && v.ghost && v.ghost.count > 0) {
      const p = l.pos[i];
      drawTower(ctx, kit, p.x, p.y, r, v.ghost.color, v.ghost.count, { alpha: v.ghost.alpha });
    }
    if (!s.length) continue;
    const p = l.pos[i];
    const anim = {
      glow: v?.glow,
      scale: v?.land != null ? 1 + 0.12 * Math.sin(Math.PI * Math.min(1, v.land)) : undefined,
    };
    drawTower(ctx, kit, p.x, p.y, r, s.length ? s[s.length - 1] : 0, s.length, anim);
    if (st.obstacle[i]) drawObstacle(ctx, p.x, p.y, r, v?.pulse);
  }

  // 5) 落点预览（拖拽中才有）
  if (drag && drag.target) {
    const p = l.pos[drag.target.cell];
    if (p) {
      drawPreview(
        ctx,
        p.x,
        p.y - Math.min(towerLift(st, l, drag.target.cell, layerH), l.maxH),
        r,
        drag.target.kind,
        drag.target.kind === 'part' ? drag.target.count : undefined,
      );
    }
  }

  // 6) 拖在手指上方的那摞：与命中使用同一坐标（现版画在 -30px 却用原始坐标命中）
  if (drag) {
    drawTower(ctx, kit, drag.x, drag.y, r * 1.02, drag.color, drag.count, { alpha: 0.96 });
  }
}

/** 某格塔顶的屏幕 y（预览与幽灵动画都要用） */
export function towerTopY(l: BoardLayout, st: GameState, cell: number, layerH: number): number {
  const h = st.stacks[cell]?.length || 0;
  return l.pos[cell].y - Math.min(towerLift(st, l, cell, layerH), l.maxH);
}

function towerLift(st: GameState, l: BoardLayout, cell: number, layerH: number): number {
  const h = st.stacks[cell]?.length || 0;
  return h > 1 ? Math.min((h - 1) * layerH, l.maxH) : 0;
}

/** 托盘槽位：三格圆角卡片 + 一摞棋子；空槽画虚线框 */
export function drawTray(
  ctx: any,
  kit: SpriteKit,
  slots: Rect[],
  st: GameState,
  dragFrom: number | null,
  selected: number | null,
  layerH: number,
): void {
  slots.forEach((r, i) => {
    const g = st.tray[i];
    ctx.save();
    if (!g || i === dragFrom) {
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(150,138,124,0.5)';
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = selected === i ? COLOR.ok : 'rgba(180,166,150,0.55)';
      ctx.lineWidth = selected === i ? 2.5 : 1.2;
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
    }
    ctx.restore();
    if (!g || i === dragFrom) return;
    const pr = Math.min(r.w * 0.34, r.h * 0.3);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h - pr * 1.15;
    const lift = Math.min((g.length - 1) * layerH, r.h - pr * 2.6);
    drawTower(ctx, kit, cx, cy - lift, pr, g[g.length - 1], g.length);
  });
}
