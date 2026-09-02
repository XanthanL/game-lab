// 地图生成：真实海岸线（Natural Earth，见 coastdata.js）→ 陆地掩膜 → 抖动网格撒点
// → Voronoi 省份 → 栅格化（面积/邻接/拾取）
// 纯计算，不依赖 DOM；浏览器与 node 预览脚本共用这一份。

import { makeRng } from './rng.js';
import {
  BBOX, K, WORLD_W, WORLD_H, proj, Grid,
  voronoiCells, adjacencyFromGrid, polyCentroid, widthAt, clipHalf,
} from './geo.js';
import { COAST } from './coastdata.js';
import { SEAS, TERRAIN_BOXES, STRAITS } from './mapdata.js';

/* 全球图幅 9000×3500：spacing 决定省份粒度（世界像素/省），res 是栅格步长
   （只影响面积统计与鼠标拾取精度）。spacing=60 实测生成约 6k 陆省，
   与 EU4 的省份尺度更接近；再密会让 Path2D 构建、底图烘焙与月度结算线性变慢。 */
export const DEFAULTS = { spacing: 60, res: 4, seed: 'europa-1444' };

/** 掩膜的两遍 chamfer 距离变换：每个陆地栅格到最近海（mask=0）的像素距离。
    气候模型的「大陆度」用它衡量——离海越远降水越少。 */
function seaDistanceField(mask, w, h) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 1e9 : 0;
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const i = cy * w + cx;
      if (d[i] === 0) continue;
      let v = d[i];
      if (cx > 0) v = Math.min(v, d[i - 1] + 1);
      if (cy > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (cx > 0) v = Math.min(v, d[i - w - 1] + 1.41421);
        if (cx < w - 1) v = Math.min(v, d[i - w + 1] + 1.41421);
      }
      d[i] = v;
    }
  }
  for (let cy = h - 1; cy >= 0; cy--) {
    for (let cx = w - 1; cx >= 0; cx--) {
      const i = cy * w + cx;
      if (d[i] === 0) continue;
      let v = d[i];
      if (cx < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (cy < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (cx < w - 1) v = Math.min(v, d[i + w + 1] + 1.41421);
        if (cx > 0) v = Math.min(v, d[i + w - 1] + 1.41421);
      }
      d[i] = v;
    }
  }
  return d;
}

export function unproject(x, y) {
  const lat = BBOX.north - y / K;
  const s = (1 + Math.cos((lat * Math.PI) / 180)) / 2;
  return [(x - WORLD_W / 2) / (s * K), lat];
}

export function buildMap(opts = {}) {
  const o = { ...DEFAULTS };
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) o[k] = v;
  const SP = o.spacing, RES = o.res;

  /* 1. 海岸线：Natural Earth 真实陆地，已是投影后的环组（外环 + 内海内环） */
  const coasts = COAST.map((rings, i) => ({ id: 'land' + i, rings }));

  /* 2. 陆地掩膜（扫描线）+ 离海距离场（气候模型的大陆度） */
  const { grid, mask } = Grid.landMask(COAST, RES);
  const seaDistPx = seaDistanceField(mask, grid.w, grid.h);

  /* 3. 撒点：栖息地加权 —— 有人住的地方省子更碎。
     均匀网格下整个意大利只有十来个省，名单光北意就要摆十三国，
     欧洲看起来像一片没人要的荒原；欧陆风云本身也是「开发度越高省越密」。
     农田/森林/海岸/丘陵的格子切成 2×2，海洋与草原、沙漠、冻土、山地维持粗颗粒，
     全球站点总数因此和从前同量级，渲染开销不变。 */
  const rng = makeRng(o.seed);
  const DENSE = new Set(['farmland', 'forest', 'coastal', 'hills']);
  function subdivide(px, py) {
    const [lon] = unproject(px, py);
    if (lon < BBOX.west || lon > BBOX.east) return 0;
    const cx = Math.min(grid.w - 1, Math.max(0, Math.round(px / RES)));
    const cy = Math.min(grid.h - 1, Math.max(0, Math.round(py / RES)));
    const i = cy * grid.w + cx;
    if (!mask[i]) return 1;                                  // 海省：保持大块
    const sd = (seaDistPx[i] * RES) / K;
    return DENSE.has(terrainAt(lon, BBOX.north - py / K, false, sd)) ? 2 : 1;
  }
  let sites = [];
  for (let gy = 0; gy * SP < WORLD_H + SP; gy++) {
    for (let gx = 0; gx * SP < WORLD_W + SP; gx++) {
      const k = subdivide(gx * SP + SP / 2, gy * SP + SP / 2);
      if (!k) continue;
      const sub = SP / k;
      for (let sy = 0; sy < k; sy++) {
        for (let sx = 0; sx < k; sx++) {
          const px = gx * SP + sub * (sx + 0.5) + rng.range(-0.40, 0.40) * sub;
          const py = gy * SP + sub * (sy + 0.5) + rng.range(-0.40, 0.40) * sub;
          if (px < 0 || py < 0 || px > WORLD_W || py > WORLD_H) continue;
          const [lon] = unproject(px, py);
          if (lon < BBOX.west || lon > BBOX.east) continue;
          sites.push([px, py]);
        }
      }
    }
  }

  /* 4. 归属 / 面积 / 海陆判定 —— 剪掉过小的陆地省，重跑直到稳定 */
  let owner, area, landPx, adj, contact;
  const measure = (list) => {
    const r = Grid.assign(list, RES, SP);
    const a = new Float64Array(list.length);
    const lp = new Float64Array(list.length);
    for (let i = 0; i < grid.n; i++) {
      const q = r.owner[i];
      if (q < 0) continue;
      a[q]++;
      if (mask[i]) lp[q]++;
    }
    const ad = adjacencyFromGrid(grid, r.owner, list.length, 3);
    return { owner: r.owner, area: a, landPx: lp, adj: ad.adj, contact: ad.contact };
  };

  for (let pass = 0; pass < 4; pass++) {
    const m = measure(sites);
    owner = m.owner; area = m.area; landPx = m.landPx; adj = m.adj; contact = m.contact;
    if (pass === 3) break;
    const landish = [];
    for (let i = 0; i < sites.length; i++) if (landPx[i] > area[i] * 0.45) landish.push(landPx[i]);
    if (!landish.length) break;
    landish.sort((a, b) => a - b);
    const mean = landish.reduce((s, v) => s + v, 0) / landish.length;
    const minPx = mean * 0.34;
    const keep = [];
    for (let i = 0; i < sites.length; i++) {
      if (landPx[i] <= area[i] * 0.45) { keep.push(i); continue; }   // 海域省一律保留
      if (landPx[i] >= minPx) { keep.push(i); continue; }
      // 太小：除非它是个孤岛（没有陆地邻居），否则删掉，领土被邻居吸收
      const nb = (adj.get(i) || []).filter((j) => landPx[j] > area[j] * 0.45);
      if (!nb.length && landPx[i] > mean * 0.12) keep.push(i);
    }
    if (keep.length === sites.length) break;
    sites = keep.map((i) => sites[i]);
  }

  /* 5. 组装省份对象 */
  const cells = voronoiCells(sites, {}, { nbr: 30 });
  /* 收边：高纬度处图幅变窄，矩形画幅的两侧角上没有经度定义（撒点时已剔除），
     但边界站点的 cell 会朝空白角凸出去。按各自纬度把左右两边都裁回透镜形图幅。 */
  for (let i = 0; i < sites.length; i++) {
    const cell = cells[i];
    if (!cell || cell.length < 3) continue;
    const w = widthAt(BBOX.north - sites[i][1] / K);
    if (w >= WORLD_W) continue;
    const right = (WORLD_W + w) / 2, left = (WORLD_W - w) / 2;
    cells[i] = clipHalf(clipHalf(cell, right, 0, right + 1, 0), left, 0, left - 1, 0);
  }
  const seaPts = SEAS.map((s) => ({ ...s, p: proj(s.c[0], s.c[1]) }));
  const provs = [];
  const meanArea = (() => {
    const l = []; for (let i = 0; i < sites.length; i++) if (landPx[i] > area[i] * 0.45) l.push(landPx[i]);
    return l.reduce((s, v) => s + v, 0) / (l.length || 1);
  })();

  for (let i = 0; i < sites.length; i++) {
    const cell = cells[i] || [[sites[i][0], sites[i][1]]];
    const c = polyCentroid(cell);
    const [lon, lat] = unproject(c[0], c[1]);
    const sea = !(landPx[i] > area[i] * 0.45);
    const gxc = Math.min(grid.w - 1, Math.max(0, Math.round(c[0] / RES)));
    const gyc = Math.min(grid.h - 1, Math.max(0, Math.round(c[1] / RES)));
    const seaDistDeg = (seaDistPx[gyc * grid.w + gxc] * RES) / K;
    let seaName = null;
    if (sea) {
      let bd = Infinity;
      for (const s of seaPts) {
        const d = (c[0] - s.p[0]) ** 2 + (c[1] - s.p[1]) ** 2;
        if (d < bd) { bd = d; seaName = s.name; }
      }
    }
    provs.push({
      id: i, site: sites[i], cell, cx: c[0], cy: c[1], lon, lat,
      sea, area: landPx[i] / meanArea, raster: area[i],
      terrain: terrainAt(lon, lat, sea, seaDistDeg), seaName, seaDist: seaDistDeg,
      adj: (adj.get(i) || []).slice(),
    });
  }

  /* 6. 邻接补全：海峡 + 沿海标记 */
  const byId = new Map(provs.map((p) => [p.id, p]));
  const nearestLand = (lon, lat) => {
    const p = proj(lon, lat);
    let best = null, bd = Infinity;
    for (const q of provs) {
      if (q.sea) continue;
      const d = (q.cx - p[0]) ** 2 + (q.cy - p[1]) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  };
  const straitPairs = [];
  for (const s of STRAITS) {
    const a = nearestLand(s.a[0], s.a[1]);
    const b = nearestLand(s.b[0], s.b[1]);
    if (a && b && a !== b && !a.adj.includes(b.id)) { a.adj.push(b.id); b.adj.push(a.id); }
    if (a && b && a !== b) straitPairs.push([a.id, b.id, s.name]);
  }
  for (const p of provs) {
    p.coastal = !p.sea && p.adj.some((j) => byId.get(j)?.sea);
    p.strait = straitPairs.filter(([a, b]) => a === p.id || b === p.id)
      .map(([a, b, n]) => ({ to: a === p.id ? b : a, name: n }));
  }

  /* 7. 渲染用几何：省界分段（带邻省）+ 海域注记 */
  const provAt = (x, y) => {
    const cx = Math.floor(x / RES), cy = Math.floor(y / RES);
    if (cx < 0 || cy < 0 || cx >= grid.w || cy >= grid.h) return -1;
    return owner[cy * grid.w + cx];
  };
  /* 每条边沿外法线外移一小段查归属，得到这条边对面的省。
     偏移取间距的 1/4：既越过公共边，又不会穿进邻省的邻省。 */
  const out = SP * 0.25;
  const edgesOf = new Map();
  for (const p of provs) {
    if (p.sea || !p.cell || p.cell.length < 3) continue;
    const cell = p.cell, list = [];
    for (let k = 0; k < cell.length; k++) {
      const a = cell[k], b = cell[(k + 1) % cell.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      let dx = mx - p.cx, dy = my - p.cy;
      const L = Math.hypot(dx, dy) || 1;
      list.push([a[0], a[1], b[0], b[1], provAt(mx + (dx / L) * out, my + (dy / L) * out)]);
    }
    edgesOf.set(p.id, list);
  }

  const seaBox = new Map();
  for (const p of provs) {
    if (!p.sea || !p.seaName) continue;
    let b = seaBox.get(p.seaName);
    if (!b) seaBox.set(p.seaName, (b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, sx: 0, sy: 0, n: 0 }));
    if (p.cx < b.x0) b.x0 = p.cx; if (p.cx > b.x1) b.x1 = p.cx;
    if (p.cy < b.y0) b.y0 = p.cy; if (p.cy > b.y1) b.y1 = p.cy;
    b.sx += p.cx; b.sy += p.cy; b.n++;
  }
  const seaLabels = [];
  for (const s of seaPts) {
    const b = seaBox.get(s.name);
    if (!b) continue;
    let x = s.p[0], y = s.p[1];
    const anchor = byId.get(provAt(x, y));
    if (!anchor || !anchor.sea) { x = b.sx / b.n; y = b.sy / b.n; }   // 锚点被陆地占：退回海域质心
    seaLabels.push({ name: s.name, x, y, w: b.x1 - b.x0, h: b.y1 - b.y0 });
  }

  return {
    res: RES, grid, landMask: mask, owner, coasts, sites,
    provinces: provs.filter((p) => !p.sea),
    seas: provs.filter((p) => p.sea),
    all: provs, provById: byId, straitPairs, spacing: SP,
    edgesOf, seaLabels,
    world: { w: WORLD_W, h: WORLD_H },
  };
}

/* ────────────── 气候模型 ──────────────
   温度带由纬度定；降水 = 纬度基线（赤道湿 / 副热带干 / 中纬西风带）
   × 大陆度衰减 × 季风加成 ± 确定性噪声。地形由温度 + 降水分类，
   TERRAIN_BOXES 的手工区域优先于模型。所有函数对同一经纬度恒定，
   不依赖随机状态——浏览器和 node 预览画出来的地图逐省一致。 */

/* 各纬度带的年降水基线（mm），南北半球对称 */
const PRECIP_ANCHORS = [
  [0, 2400], [5, 2100], [10, 1600], [15, 800], [22, 450],
  [30, 620], [40, 800], [50, 700], [60, 480], [70, 250],
];
function precipBase(a) {
  for (let i = 0; i < PRECIP_ANCHORS.length - 1; i++) {
    const [la, pa] = PRECIP_ANCHORS[i], [lb, pb] = PRECIP_ANCHORS[i + 1];
    if (a <= lb) return pa + (pb - pa) * ((a - la) / (lb - la));
  }
  return 250;
}

/** 方形区域的平滑隶属度：盒内 1，盒外按边距 m 线性衰减到 0 */
function boxFalloff(lon, lat, w, s, e, n, m = 3) {
  const d = Math.max(w - lon, lon - e, s - lat, lat - n, 0);
  return d <= 0 ? 1 : Math.max(0, 1 - d / m);
}

/** 整数点哈希 → [0,1)，跨平台确定 */
function hash2(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 双线性平滑的值噪声，输出 [-1, 1]；scale 是特征波长（经纬度） */
function noise2(lon, lat, scale = 5) {
  const fx = lon / scale, fy = lat / scale;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const lerp = (a, b, t) => a + (b - a) * t;
  const v = lerp(
    lerp(hash2(ix, iy), hash2(ix + 1, iy), sx),
    lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), sx), sy);
  return v * 2 - 1;
}

/** 年降水估计（mm）。seaDistDeg = 距最近海域的角距（1° ≈ 111 km） */
export function precipAt(lon, lat, seaDistDeg = 0) {
  const a = Math.abs(lat);
  let p = precipBase(a);
  /* 离海越远越干；副热带高压带（回归线附近）的大陆腹地额外干 */
  const dryLen = a >= 15 && a <= 32 ? 0.09 : 0.055;
  p /= 1 + seaDistDeg * dryLen;
  /* 季风区：南亚 / 东南亚 / 西非沿岸 */
  p += 600 * boxFalloff(lon, lat, 65, 5, 100, 30);
  p += 350 * boxFalloff(lon, lat, 95, -10, 150, 22);
  p += 450 * boxFalloff(lon, lat, -18, 3, 15, 12);
  p *= 1 + 0.15 * noise2(lon, lat);
  return Math.max(0, p);
}

/** 地形：海 → ocean；TERRAIN_BOXES 手工区域先命中者胜；
    其余按纬度温度带 × 降水干湿分类 */
export function terrainAt(lon, lat, sea, seaDistDeg = 0) {
  if (sea) return 'ocean';
  for (const [t, w, s, e, n] of TERRAIN_BOXES) {
    if (lon >= w && lon <= e && lat >= s && lat <= n) return t;
  }
  const a = Math.abs(lat);
  if (a > 68) return 'tundra';
  const p = precipAt(lon, lat, seaDistDeg);
  if (a > 62) return p < 260 ? 'tundra' : 'forest';   // 北方针叶林 / 冻土
  if (a > 50) return p < 200 ? 'steppe' : 'forest';
  if (p < 230) return 'desert';
  if (p < 450) return 'steppe';
  if (p > 1300) return 'forest';                       // 热带雨林
  return 'farmland';
}

export { WORLD_W, WORLD_H };
