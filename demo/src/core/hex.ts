// 平顶（flat-top）六边形数学与布局工具（与 GDD §3.1 / B 目标态一致）

// 平顶六边形路径（渲染 + 命中检测共用）
export function hexPath(ctx: any, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const SQRT3 = Math.sqrt(3);

// axial(q,r) → 像素（平顶六边形）
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2),
  };
}

// 六边形「格距离」
export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

// 生成半径 R 的六边形地图全部 axial 坐标，按到中心距离升序（同距稳定排序）
export function hexMap(radius: number): { q: number; r: number }[] {
  const cells: { q: number; r: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (hexDistance({ q: 0, r: 0 }, { q, r }) <= radius) cells.push({ q, r });
    }
  }
  cells.sort(
    (a, b) =>
      hexDistance({ q: 0, r: 0 }, a) - hexDistance({ q: 0, r: 0 }, b) ||
      a.q - b.q ||
      a.r - b.r,
  );
  return cells;
}

// 将一组 axial 坐标拟合进给定矩形（中心对齐 + 留边），返回变换参数
export function fitHexLayout(
  coords: { q: number; r: number }[],
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
): { size: number; ox: number; oy: number } {
  const raw = coords.map((c) => hexToPixel(c.q, c.r, 1));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of raw) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const size = Math.min(maxW / spanX, maxH / spanY) * 0.92;

  const raw2 = coords.map((c) => hexToPixel(c.q, c.r, size));
  let minX2 = Infinity;
  let maxX2 = -Infinity;
  let minY2 = Infinity;
  let maxY2 = -Infinity;
  for (const p of raw2) {
    minX2 = Math.min(minX2, p.x);
    maxX2 = Math.max(maxX2, p.x);
    minY2 = Math.min(minY2, p.y);
    maxY2 = Math.max(maxY2, p.y);
  }
  const ox = cx - (minX2 + maxX2) / 2;
  const oy = cy - (minY2 + maxY2) / 2;
  return { size, ox, oy };
}
