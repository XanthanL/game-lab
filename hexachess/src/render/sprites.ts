// 软扁平 + 体积光的棋子与格位绘制。正视角固定（去掉伪 3D 旋转），
// 塔高用三处冗余编码：侧壁厚度、顶面 0.94^layer 收缩、右上角层数徽章。
// 顶面按「颜色」缓存离屏精灵（6 张），侧壁走程序化渐变，避免每帧重建渐变对象。
import { COLOR, PieceSkin, skin } from './theme';
import { roundRectPath } from '../view/layout';

export interface SpriteKit {
  make(w: number, h: number): any;
  faces: Map<string, any>;
}

export function createKit(make: (w: number, h: number) => any): SpriteKit {
  return { make, faces: new Map<string, any>() };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 顶面精灵：径向渐变（左上受光）+ 内描边 + 高光弧 */
function faceSprite(kit: SpriteKit, s: PieceSkin, d: number): any {
  const key = s.type + '@' + d;
  const cached = kit.faces.get(key);
  if (cached) return cached;
  const c = kit.make(d, d);
  const g = c.getContext('2d');
  const r = d / 2;
  const grd = g.createRadialGradient(r * 0.66, r * 0.6, r * 0.1, r, r, r);
  grd.addColorStop(0, s.light);
  grd.addColorStop(0.55, s.color);
  grd.addColorStop(1, s.deep);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(r, r, r - 1, 0, Math.PI * 2);
  g.fill();
  // 受光高光弧（体积感的关键一层，别省）
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = Math.max(1, r * 0.09);
  g.beginPath();
  g.arc(r, r, r * 0.78, Math.PI * 1.06, Math.PI * 1.62);
  g.stroke();
  // 内描边压住边缘，避免大片纯色发飘
  g.strokeStyle = 'rgba(0,0,0,0.14)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(r, r, r - 1, 0, Math.PI * 2);
  g.stroke();
  kit.faces.set(key, c);
  return c;
}

export interface TowerAnim {
  alpha?: number; // 幽灵淡出用
  scale?: number; // 落地弹跳
  glow?: number; // 融合/消除瞬间的高亮 0..1
}

/**
 * 画一座棋子塔。
 * @param r 单颗棋子的半径（顶面）
 * @param h 层数
 * @param layerH 每层的视觉厚度
 */
export function drawTower(
  ctx: any,
  kit: SpriteKit,
  x: number,
  y: number,
  r: number,
  ci: number,
  h: number,
  anim: TowerAnim = {},
): void {
  if (h <= 0) return;
  const s = skin(ci);
  const alpha = anim.alpha == null ? 1 : anim.alpha;
  const scale = anim.scale == null ? 1 : anim.scale;
  const layerH = Math.max(3, r * 0.3);
  const topR = r * Math.pow(0.94, Math.min(h, 10) - 1) * scale;
  const bodyH = (h - 1) * layerH;

  ctx.save();
  ctx.globalAlpha = alpha;

  // 接触阴影（一次椭圆填充，落地感全靠它）
  ctx.fillStyle = COLOR.shadow;
  ctx.beginPath();
  ctx.ellipse(r2(x), r2(y + r * 0.36), r2(topR * 1.06), r2(topR * 0.34), 0, 0, Math.PI * 2);
  ctx.fill();

  // 侧壁：整体圆角矩形 + 竖向渐变，上暗下亮模拟环境反射
  if (bodyH > 0) {
    const wallTop = y - bodyH;
    const grd = ctx.createLinearGradient(0, r2(wallTop), 0, r2(y));
    grd.addColorStop(0, s.deep);
    grd.addColorStop(0.55, s.color);
    grd.addColorStop(1, s.light);
    ctx.fillStyle = grd;
    ctx.beginPath();
    const w = topR * 2;
    const hh = bodyH + topR;
    const rr = Math.min(topR * 0.5, layerH);
    roundRectPath(ctx, r2(x - topR), r2(wallTop), r2(w), r2(hh), rr);
    ctx.fill();
    // 左侧暗边 + 右侧亮边：体积光方向一致
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(r2(x - topR * 0.96), r2(wallTop + topR * 0.4));
    ctx.lineTo(r2(x - topR * 0.96), r2(y + topR * 0.2));
    ctx.stroke();
  }

  // 顶面精灵
  const d = Math.max(4, Math.round(topR * 2));
  const face = faceSprite(kit, s, d);
  ctx.drawImage(face, r2(x - topR), r2(y - bodyH - topR), d, d);

  // 融合/消除高亮
  if (anim.glow) {
    ctx.globalAlpha = alpha * Math.min(1, anim.glow);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(r2(x), r2(y - bodyH), r2(topR * 0.92), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  // 层数徽章：右上角白胶囊 + 深色数字（正视角下高度必须有显式读数）
  const bw = Math.max(16, topR * 0.92);
  const bh = bw * 0.72;
  const bx = x + topR * 0.52;
  const by = y - bodyH - topR * 1.02;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  roundRectPath(ctx, r2(bx - bw / 2), r2(by - bh / 2), r2(bw), r2(bh), bh / 2);
  ctx.fill();
  ctx.strokeStyle = s.deep;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLOR.ink;
  ctx.font = Math.round(bh * 0.66) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(h), r2(bx), r2(by + 0.5));

  ctx.restore();
}

/** 空格外凹：底部径向渐变 + 上缘投影 */
export function drawSocket(ctx: any, x: number, y: number, r: number): void {
  const grd = ctx.createRadialGradient(x, y + r * 0.22, r * 0.15, x, y, r);
  grd.addColorStop(0, COLOR.socket);
  grd.addColorStop(1, '#F7F1E7');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOR.socketEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,70,50,0.10)';
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r * 0.92), Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
}

/** 锁格：斜纹 + 小锁 */
export function drawLocked(ctx: any, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r), 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = COLOR.locked;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = -2; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r + i * (r * 0.5), y - r);
    ctx.lineTo(x - r + i * (r * 0.5) + r, y + r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(70,60,50,0.55)';
  const w = r * 0.5;
  roundRectPath(ctx, r2(x - w / 2), r2(y - w * 0.1), r2(w), r2(w * 0.8), w * 0.18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,60,50,0.55)';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(r2(x), r2(y - w * 0.1), r2(w * 0.3), Math.PI, Math.PI * 2);
  ctx.stroke();
}

/** 移动障碍：暖灰圆柱 + 顶部暗环 */
export function drawObstacle(ctx: any, x: number, y: number, r: number, pulse = 0): void {
  ctx.fillStyle = COLOR.shadow;
  ctx.beginPath();
  ctx.ellipse(r2(x), r2(y + r * 0.3), r2(r * 0.98), r2(r * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  const grd = ctx.createLinearGradient(x - r, y, x + r, y);
  grd.addColorStop(0, '#7E7466');
  grd.addColorStop(0.5, COLOR.obstacle);
  grd.addColorStop(1, '#847A6C');
  ctx.fillStyle = grd;
  roundRectPath(ctx, r2(x - r * 0.86), r2(y - r * 1.1), r2(r * 1.72), r2(r * 1.5), r * 0.3);
  ctx.fill();
  ctx.fillStyle = '#B3A897';
  ctx.beginPath();
  ctx.ellipse(r2(x), r2(y - r * 1.02), r2(r * 0.86), r2(r * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  if (pulse > 0) {
    ctx.strokeStyle = 'rgba(255,120,80,' + r2(0.5 * pulse) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r2(x), r2(y - r * 0.3), r2(r * 1.15), 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * 落点预览环：绿 = 整摞可落；黄 = 只能部分转移（带 +n）；灰红 = 非法。
 * 这是现版完全缺失、导致「看不懂能做什么」的主因。
 */
export function drawPreview(
  ctx: any,
  x: number,
  y: number,
  r: number,
  kind: 'whole' | 'part' | 'bad',
  count?: number,
): void {
  const col = kind === 'whole' ? COLOR.ok : kind === 'part' ? COLOR.part : COLOR.bad;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, r * 0.13);
  ctx.setLineDash(kind === 'bad' ? [4, 5] : [Math.max(3, r * 0.28), Math.max(3, r * 0.2)]);
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r * 1.06), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (kind !== 'bad' && count) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(r2(x + r * 0.86), r2(y - r * 0.86), r2(r * 0.38), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = Math.round(r * 0.42) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+' + count, r2(x + r * 0.86), r2(y - r * 0.84));
  }
  ctx.restore();
}

// roundRectPath 见 view/layout.ts：几何助手只留一份，画与命中同源
