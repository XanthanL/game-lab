// 地图绘制核心。
//
// 这一层存在的唯一理由：原来的渲染器每帧都要遍历 2000 多个省份、
// 逐个 beginPath/closePath/fill，再叠三次几万顶点的 clip，
// 鼠标一动就触发一次全量重绘。这里改成：
//   1) Path2D 只构建一次并缓存（省份多边形是静态的）
//   2) 按颜色分桶，同色省份合成一条路径，一次 fill（政治模式 1300 省 → ~85 次 fill）
//   3) 省界、海岸线各合成一条路径，各一次 stroke
// 主渲染器（离屏烘焙）与「选国」界面的小地图共用这一份代码。

import { WORLD_W, WORLD_H, proj } from './geo.js';
import { TERRAINS } from './countries.js';
import { TRADE_NODES } from './trade.js';

export const SEA_BG = '#79a8b0';
export const SEA_FILL = 'rgb(129, 170, 178)';

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

// 贸易节点配色：黄金角分布，相邻节点色相尽量拉开，整体鲜明像 EU4 贸易图
const NODE_COLORS = (() => {
  const m = new Map();
  TRADE_NODES.forEach((n, i) => {
    const hue = (i * 137.508) % 360;
    m.set(n.id, `hsl(${hue.toFixed(1)},56%,52%)`);
  });
  return m;
})();

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
    if (prov.wasteland) return 'rgb(168,158,146)';   // 撒哈拉 / 北极苔原
    if (!prov.owner) return 'rgb(216,206,190)';      // 未殖民
    const c = world.countries.get(prov.owner);
    if (!c) return 'rgb(190,190,190)';
    let [r, g, b] = c.color;
    // EU4 政治图倾向中等明度的鲜明色：自动提亮过暗/过浑浊的国家色
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 100) {
      const k = 1 + (100 - lum) / 180;
      r = Math.min(255, r * k); g = Math.min(255, g * k); b = Math.min(255, b * k);
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
  if (mode === 'religion') {
    if (prov.wasteland) return 'rgb(168,158,146)';
    if (!prov.owner) return 'rgb(205,196,183)';
    return RELIGION_COLORS[prov.religion] || '#999';
  }
  if (mode === 'culture') {
    if (prov.wasteland) return 'rgb(168,158,146)';
    if (!prov.owner) return 'rgb(205,196,183)';
    return cultureColor(prov.culture || 'x');
  }
  if (mode === 'trade') {
    if (prov.wasteland) return 'rgb(168,158,146)';
    if (!prov.owner) return 'rgb(205,196,183)';
    return TRADE_COLORS[prov.tradeGood] || '#aaa';
  }
  if (mode === 'tradenode') {
    if (prov.wasteland) return 'rgb(168,158,146)';
    if (!prov.tradeNode) return 'rgb(205,196,183)';   // 未划入任何节点
    return NODE_COLORS.get(prov.tradeNode) || '#aaa';
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
  for (const p of map.provinces) {
    const pp = new Path2D();
    addCell(pp, p.cell);
    provPaths.set(p.id, pp);
  }
  const seaCells = new Path2D();
  for (const p of map.seas) {
    const sp = new Path2D();
    addCell(sp, p.cell);
    provPaths.set(p.id, sp);
    seaCells.addPath(sp);
  }

  // 海岸线（陆地轮廓，含里海这类内水域的边界）：
  // 既用于裁掉溢出海岸的省份色块，也用于描海岸线
  const landPath = new Path2D();
  for (const c of map.coasts) for (const ring of c.rings) addCell(landPath, ring);

  // 海 clip：整幅矩形 + 陆地，evenodd → 只剩海
  const seaClip = new Path2D();
  seaClip.rect(0, 0, WORLD_W, WORLD_H);
  seaClip.addPath(landPath);

  return { provPaths, landPath, seaCells, seaClip };
}

/* 省界与国界要分开：欧陆风云的政治图里省界很淡、国界很重。
   边的对面是哪个省在建图时已采样好（map.edgesOf），归属一变就重建。 */
const OWNER_MODES = new Set(['political', 'religion', 'culture', 'trade', 'tradenode']);

function borderPaths(world, paths) {
  if (paths._b && paths._b.v === world.mapVersion) return paths._b;
  const M = world.map;
  const province = new Path2D(), nation = new Path2D();
  const ownerOf = (id) => { const p = world.provinces.get(id); return p && p.owner ? p.owner : ''; };
  for (const p of M.provinces) {
    const list = M.edgesOf.get(p.id);
    if (!list) continue;
    const me = ownerOf(p.id);
    for (const [x1, y1, x2, y2, q] of list) {
      if (q <= p.id) continue;                       // 每条边只在编号小的一侧画一次
      const other = M.provById.get(q);
      if (!other || other.sea) continue;             // 临海的那侧由海岸线负责
      province.moveTo(x1, y1); province.lineTo(x2, y2);
      if (me !== ownerOf(q)) { nation.moveTo(x1, y1); nation.lineTo(x2, y2); }
    }
  }
  paths._b = { v: world.mapVersion, province, nation };
  return paths._b;
}

/** 国家注记位置：按省份面积加权的质心 + 包围盒（判断文字放不放得下） */
function countryLabels(world, paths) {
  if (paths._l && paths._l.v === world.mapVersion) return paths._l.list;
  const list = [];
  for (const c of world.countries.values()) {
    let sx = 0, sy = 0, sw = 0, n = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const id of c.provinces) {
      const prov = world.provinces.get(id);
      const geo = world.map.provById.get(id);
      if (!prov || !geo || geo.sea || prov.owner !== c.tag) continue;
      const wgt = geo.raster || 1;
      sx += geo.cx * wgt; sy += geo.cy * wgt; sw += wgt; n++;
      if (geo.cx < x0) x0 = geo.cx; if (geo.cx > x1) x1 = geo.cx;
      if (geo.cy < y0) y0 = geo.cy; if (geo.cy > y1) y1 = geo.cy;
    }
    if (n > 1 && sw > 0) list.push({ name: c.name, x: sx / sw, y: sy / sw, w: x1 - x0, h: y1 - y0 });
  }
  list.sort((a, b) => b.w * b.h - a.w * a.h);        // 大国的名字优先
  paths._l = { v: world.mapVersion, list };
  return list;
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
 * 绘制静态底图：海（含近岸浅水）→ 海域省 → 陆地省（分色批量）→ 省界 → 国界
 * → 海岸线 → 注记。
 * view = { zoom, panX, panY }（CSS 像素坐标系），size = { w, h, dpr }。
 */
export function paintBase(ctx, world, paths, mode, view, size) {
  const { w, h, dpr } = size;
  const z = view.zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = SEA_BG;
  ctx.fillRect(0, 0, w * dpr, h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(view.panX, view.panY);
  ctx.scale(z, z);
  ctx.fillStyle = SEA_BG;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.lineJoin = 'round';

  // 海域省：全同色，合成一条路径一次 fill
  ctx.save();
  ctx.clip(paths.seaClip, 'evenodd');
  ctx.fillStyle = SEA_FILL;
  ctx.fill(paths.seaCells);
  // 近岸浅水：多层渐隐亮带，让海岸线有 EU4 式的浅水-深海过渡
  ctx.strokeStyle = 'rgba(235,245,240,0.22)';
  ctx.lineWidth = 54;
  ctx.stroke(paths.landPath);
  ctx.strokeStyle = 'rgba(225,240,235,0.16)';
  ctx.lineWidth = 26;
  ctx.stroke(paths.landPath);
  ctx.strokeStyle = 'rgba(215,235,230,0.10)';
  ctx.lineWidth = 10;
  ctx.stroke(paths.landPath);
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

  const borders = borderPaths(world, paths);
  ctx.save();
  ctx.clip(paths.landPath, 'evenodd');
  for (const [col, path] of buckets) {
    ctx.fillStyle = col;
    ctx.fill(path);
    // 同色描边填掉相邻同色省之间的抗锯齿缝，否则能看到细网格线
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.5 / z;
    ctx.stroke(path);
  }
  // 省界：只在放大到足够大时才画，低缩放的密集网格会压过国家色块
  if (z > 1.45) {
    ctx.strokeStyle = 'rgba(46,38,28,0.13)';
    ctx.lineWidth = 0.32 / z;
    ctx.stroke(borders.province);
  }
  if (OWNER_MODES.has(mode)) {
    ctx.strokeStyle = 'rgba(42,28,18,0.90)';
    ctx.lineWidth = 2.0 / z;
    ctx.stroke(borders.nation);          // 国界：重而清晰
  }
  ctx.restore();

  // 海岸线：陆地内侧暖高光 + 外侧深色轮廓，制造陆地"浮起"感
  ctx.save();
  ctx.clip(paths.landPath, 'evenodd');
  ctx.strokeStyle = 'rgba(255,250,230,0.11)';
  ctx.lineWidth = 5.5 / z;
  ctx.stroke(paths.landPath);
  ctx.restore();

  ctx.strokeStyle = 'rgba(38,26,18,0.92)';
  ctx.lineWidth = 1.7 / z;
  ctx.stroke(paths.landPath);

  // 贸易节点层：流向线 + 枢纽圆点（仅贸易节点图模式绘制）
  if (mode === 'tradenode') drawTradeNodes(ctx, world, paths, z);

  paintLabels(ctx, world, paths, mode, z);
}

/** 贸易节点层：上游 → 下游的流向线 + 各节点枢纽圆点。节点地理中心由投影算出后缓存。 */
function drawTradeNodes(ctx, world, paths, z) {
  if (!paths._tn) {
    const hubs = TRADE_NODES.map((n) => {
      const [x, y] = proj(n.c[0], n.c[1]);
      return { id: n.id, x, y, to: n.to };
    });
    paths._tn = hubs;
  }
  const hubs = paths._tn;
  const byId = new Map(hubs.map((h) => [h.id, h]));

  // 贸易流向（上游 → 下游）
  ctx.lineWidth = 1.1 / z;
  ctx.strokeStyle = 'rgba(40,30,22,0.32)';
  for (const h of hubs) {
    for (const t of h.to) {
      const o = byId.get(t);
      if (!o) continue;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
    }
  }
  // 枢纽圆点：节点色填充 + 白描边
  for (const h of hubs) {
    const col = NODE_COLORS.get(h.id) || '#888';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 6 / z, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 1.4 / z;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  }
}

/** 注记：字号按屏幕像素取（除以 zoom），放不下就不画——低缩放时只剩大国与大海域。 */
function paintLabels(ctx, world, paths, mode, z) {
  const px = (n) => n / z;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `italic ${px(11)}px Georgia, "Songti SC", serif`;
  ctx.fillStyle = 'rgba(230,245,245,0.78)';
  for (const s of world.map.seaLabels) {
    if (ctx.measureText(s.name).width > s.w * 0.85 || px(12) > s.h * 0.8) continue;
    ctx.fillText(s.name, s.x, s.y);
  }

  if (!OWNER_MODES.has(mode)) return;
  ctx.font = `600 ${px(12)}px "Microsoft YaHei", system-ui, sans-serif`;
  ctx.lineJoin = 'round';
  for (const l of countryLabels(world, paths)) {
    if (ctx.measureText(l.name).width > l.w * 0.9 || px(13) > l.h * 0.85) continue;
    ctx.strokeStyle = 'rgba(255,252,242,0.82)';
    ctx.lineWidth = px(3.2);
    ctx.strokeText(l.name, l.x, l.y);
    ctx.fillStyle = '#2b2118';
    ctx.fillText(l.name, l.x, l.y);
  }
}

/** 让世界完整落进画布并居中，返回 { zoom, panX, panY }。 */
export function fitView(worldW, worldH, w, h, margin = 0.97) {
  const zoom = Math.min(w / worldW, h / worldH) * margin;
  return { zoom, panX: (w - worldW * zoom) / 2, panY: (h - worldH * zoom) / 2 };
}
