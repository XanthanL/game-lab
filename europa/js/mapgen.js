// 地图生成：手绘海岸线 → 碎形化 → 抖动网格撒点 → Voronoi 省份 → 栅格化（面积/邻接/拾取）
// 纯计算，不依赖 DOM；浏览器与 node 预览脚本共用这一份。

import { makeRng } from './rng.js';
import {
  BBOX, K, WORLD_W, WORLD_H, proj, projPoly, roughen, Grid,
  voronoiCells, adjacencyFromGrid, polyArea, polyCentroid,
} from './geo.js';
import { LAND, SEAS, TERRAIN_BOXES, STRAITS } from './mapdata.js';

export const DEFAULTS = { spacing: 20, res: 2, seed: 'europa-1444', rough: 5.0 };

export function unproject(x, y) {
  const lat = BBOX.north - y / K;
  const s = (1 + Math.cos((lat * Math.PI) / 180)) / 2;
  return [x / (s * K) + BBOX.west, lat];
}

export function buildMap(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const SP = o.spacing, RES = o.res;

  /* 1. 海岸线：投影 + 两级碎形扰动 */
  const coasts = Object.entries(LAND).map(([id, pts]) => ({
    id, poly: roughen(projPoly(pts), o.rough, 2, o.seed + '/coast/' + id),
  }));
  const polys = coasts.map((c) => c.poly);

  /* 2. 陆地掩膜（扫描线） */
  const { grid, mask } = Grid.landMask(polys, RES);

  /* 3. 抖动网格全域撒点：陆地与海洋都撒，之后按「陆地像素占比」分家 */
  const rng = makeRng(o.seed);
  let sites = [];
  for (let gy = 0; gy * SP < WORLD_H + SP; gy++) {
    for (let gx = 0; gx * SP < WORLD_W + SP; gx++) {
      const px = gx * SP + SP / 2 + rng.range(-0.40, 0.40) * SP;
      const py = gy * SP + SP / 2 + rng.range(-0.40, 0.40) * SP;
      if (px < 0 || py < 0 || px > WORLD_W || py > WORLD_H) continue;
      // 伪圆柱投影下图幅是个梯形（越高纬越窄），梯形外的点不属于任何经纬度
      const [lon] = unproject(px, py);
      if (lon < BBOX.west || lon > BBOX.east) continue;
      sites.push([px, py]);
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
      terrain: terrainAt(lon, lat, sea), seaName,
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

  return {
    res: RES, grid, landMask: mask, owner, coasts, sites,
    provinces: provs.filter((p) => !p.sea),
    seas: provs.filter((p) => p.sea),
    all: provs, provById: byId, straitPairs, spacing: SP,
    world: { w: WORLD_W, h: WORLD_H },
  };
}

/** 地形：先命中者胜；海 = 海洋；未命中按纬度/纬度带兜底 */
export function terrainAt(lon, lat, sea) {
  if (sea) return 'ocean';
  for (const [t, w, s, e, n] of TERRAIN_BOXES) {
    if (lon >= w && lon <= e && lat >= s && lat <= n) return t;
  }
  if (lat > 62) return lat > 68 ? 'tundra' : 'forest';
  if (lat < 33) return 'desert';
  return 'farmland';
}

export { WORLD_W, WORLD_H };
