// 地图绘制核心。
//
// 这一层存在的唯一理由：原来的渲染器每帧都要遍历 2000 多个省份、
// 逐个 beginPath/closePath/fill，再叠三次几万顶点的 clip，
// 鼠标一动就触发一次全量重绘。这里改成：
//   1) Path2D 只构建一次并缓存（省份多边形是静态的）
//   2) 按颜色分桶，同色省份合成一条路径，一次 fill（政治模式 1300 省 → ~85 次 fill）
//   3) 省界、海岸线各合成一条路径，各一次 stroke
// 主渲染器（离屏烘焙）与「选国」界面的小地图共用这一份代码。

import { WORLD_W, WORLD_H } from './geo.js';
import { TERRAINS } from './countries.js';

export const SEA_BG = '#a9c3cd';
export const SEA_FILL = 'rgb(150,185,195)';

const RELIGION_COLORS = {
  catholic: '#4a6fa5', orthodox: '#8a5a3a', sunni: '#3a8a5a',
  hussite: '#7a4a8a', shia: '#5a8a6a', protestant: '#6a5a9a', coptic: '#9a7a3a',
};

const TRADE_COLORS = {
  grain: '#d9c96f', wine: '#a05070', wool: '#93a45c', cloth: '#5f74a8',
  fish: '#5e9fc4', salt: '#c8c8c8', iron: '#6f6f6f', gold: '#dcb52a',
  copper: '#b4703c', lumber: '#4f7f3c', fur: '#7f4f2c', horses: '#a08050',
  cotton: '#d4d4e2', spices: '#a03080', silk: '#d0a0d0',
};

const CULTURE_CACHE = new Map();
function cultureColor(name) {
  let c = CULTURE_CACHE.get(name);
  if (c) return c;
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  c = `hsl(${Math.abs(h) % 360},52%,56%)`;
  CULTURE_CACHE.set(name, c);
  return c;
}

export function provinceColor(prov, world, mode) {
  if (mode === 'terrain') {
    const t = TERRAINS[prov.terrain] || TERRAINS.farmland;
    return `rgb(${t.color[0]},${t.color[1]},${t.color[2]})`;
  }
  if (mode === 'political') {
    if (prov.wasteland) return 'rgb(146,140,130)';   // 撒哈拉 / 北极苔原
    if (!prov.owner) return 'rgb(205,196,183)';      // 未殖民
    const c = world.countries.get(prov.owner);
    return c ? `rgb(${c.color[0]},${c.color[1]},${c.color[2]})` : 'rgb(190,190,190)';
  }
  if (mode === 'religion') {
    if (prov.wasteland) return 'rgb(146,140,130)';
    if (!prov.owner) return 'rgb(205,196,183)';
    return RELIGION_COLORS[prov.religion] || '#999';
  }
  if (mode === 'culture') {
    if (prov.wasteland) return 'rgb(146,140,130)';
    if (!prov.owner) return 'rgb(205,196,183)';
    return cultureColor(prov.culture || 'x');
  }
  if (mode === 'trade') {
    if (prov.wasteland) return 'rgb(146,140,130)';
    if (!prov.owner) return 'rgb(205,196,183)';
    return TRADE_COLORS[prov.tradeGood] || '#aaa';
  }
  if (mode === 'unrest') {
    const u = Math.min(1, Math.max(0, (prov.unrest || 0) / 10));
    return `rgb(${Math.round(120 + u * 135)},${Math.round(180 - u * 120)},${Math.round(160 - u * 100)})`;
  }
  return '#ccc';
}

function addCell(path, cell) {
  if (!cell || cell.length < 3) return;
  path.moveTo(cell[0][0], cell[0][1]);
  for (let i = 1; i < cell.length; i++) path.lineTo(cell[i][0], cell[i][1]);
  path.closePath();
}

/** 省份多边形是静态的，Path2D 一次性建好，之后所有帧复用。 */
export function buildPaths(map) {
  const provPaths = new Map();
  const landCells = new Path2D();
  for (const p of map.provinces) {
    const pp = new Path2D();
    addCell(pp, p.cell);
    provPaths.set(p.id, pp);
    landCells.addPath(pp);
  }
  const seaCells = new Path2D();
  for (const p of map.seas) {
    const sp = new Path2D();
    addCell(sp, p.cell);
    provPaths.set(p.id, sp);
    seaCells.addPath(sp);
  }

  // 海岸线（陆地轮廓）：既用于裁掉溢出海岸的省份色块，也用于描海岸线
  const landPath = new Path2D();
  for (const c of map.coasts) addCell(landPath, c.poly);

  // 海 clip：整幅矩形 + 陆地，evenodd → 只剩海
  const seaClip = new Path2D();
  seaClip.rect(0, 0, WORLD_W, WORLD_H);
  seaClip.addPath(landPath);

  return { provPaths, landPath, landCells, seaCells, seaClip };
}

/** 某个国家/一组省份的边界路径，用于高亮描边。 */
export function pathOfIds(paths, ids) {
  const p = new Path2D();
  for (const id of ids) {
    const pp = paths.provPaths.get(id);
    if (pp) p.addPath(pp);
  }
  return p;
}

/**
 * 绘制静态底图：海 → 海域省 → 陆地省（分色批量）→ 省界 → 海岸线。
 * view = { zoom, panX, panY }（CSS 像素坐标系），size = { w, h, dpr }。
 */
export function paintBase(ctx, world, paths, mode, view, size) {
  const { w, h, dpr } = size;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = SEA_BG;
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);
  ctx.fillStyle = SEA_BG;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // 海域省：全同色，合成一条路径一次 fill
  ctx.save();
  ctx.clip(paths.seaClip, 'evenodd');
  ctx.fillStyle = SEA_FILL;
  ctx.fill(paths.seaCells);
  ctx.restore();

  // 陆地省：按颜色分桶。省界与色块共用同一次 clip。
  const buckets = new Map();
  for (const p of world.map.provinces) {
    const prov = world.provinces.get(p.id);
    if (!prov) continue;
    const col = provinceColor(prov, world, mode);
    let b = buckets.get(col);
    if (!b) buckets.set(col, (b = new Path2D()));
    b.addPath(paths.provPaths.get(p.id));
  }

  ctx.save();
  ctx.clip(paths.landPath);
  ctx.lineJoin = 'round';
  const seam = 0.5 / view.zoom;
  for (const [col, path] of buckets) {
    ctx.fillStyle = col;
    ctx.fill(path);
    // 同色描边填掉相邻同色省之间的抗锯齿缝，否则能看到细网格线
    ctx.strokeStyle = col;
    ctx.lineWidth = seam;
    ctx.stroke(path);
  }
  ctx.strokeStyle = 'rgba(40,30,22,0.40)';
  ctx.lineWidth = 0.6 / view.zoom;
  ctx.stroke(paths.landCells);   // 省界
  ctx.restore();

  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 1.1 / view.zoom;
  ctx.stroke(paths.landPath);    // 海岸线
}

/** 让世界完整落进画布并居中，返回 { zoom, panX, panY }。 */
export function fitView(worldW, worldH, w, h, margin = 0.97) {
  const zoom = Math.min(w / worldW, h / worldH) * margin;
  return { zoom, panX: (w - worldW * zoom) / 2, panY: (h - worldH * zoom) / 2 };
}
