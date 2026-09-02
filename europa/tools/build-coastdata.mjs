// 开发脚本：Natural Earth 陆地 GeoJSON → js/coastdata.js（真实海岸线）。
//   node tools/build-coastdata.mjs [--tol=0.1] [--min-area=90] [--hole-area=140] [--in=...] [--out=...]
//
// 处理链：丢掉南极洲与图幅外的环 → 经纬度上做 Douglas-Peucker 简化 →
// 投影成世界像素 → 按面积过滤碎岛/小湖 → 外环与它自己的内环配成一组。
// 内海（里海、五大湖）必须作为内环保留下来，否则掩膜会把它们填成陆地。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proj } from '../js/geo.js';
import { BBOX } from '../js/geo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const TOL = Number(get('tol', 0.1));                 // 简化容差（度）
const MIN_AREA = Number(get('min-area', 90));         // 陆环最小投影面积（px²）
const HOLE_AREA = Number(get('hole-area', 140));      // 内环最小面积：小于它的湖直接填成陆地
const IN = get('in', path.join(here, 'data/ne_50m_land.geojson'));
const OUT = get('out', path.join(here, '..', 'js/coastdata.js'));

/* ────────── Douglas-Peucker ────────── */
// 距离按 cos(lat) 修正经度方向，让容差在球面上大致各向同性
const cosAt = (lat) => Math.cos((lat * Math.PI) / 180);
function segDist(p, a, b) {
  const lat = (a[1] + b[1]) / 2, k = cosAt(lat);
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return Math.hypot(qx, qy);
}
function dpOpen(pts, tol) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i], pts[a], pts[b]);
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol && bi > a) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}
function simplifyClosed(ring, tol) {
  const n = ring.length;
  if (n < 6) return ring.slice();
  let k = 1, bd = -1;
  for (let i = 1; i < n; i++) {
    const dx = ring[i][0] - ring[0][0], dy = ring[i][1] - ring[0][1];
    const d = dx * dx + dy * dy;
    if (d > bd) { bd = d; k = i; }
  }
  const a = dpOpen(ring.slice(0, k + 1), tol);
  const b = dpOpen(ring.slice(k).concat([ring[0]]), tol);
  return a.concat(b.slice(1, b.length - 1));
}

/* ────────── 投影 + 面积 ────────── */
function project(ring) {
  const out = [];
  for (const [lon, lat] of ring) {
    const [x, y] = proj(lon, Math.max(BBOX.south - 3, Math.min(BBOX.north + 3, lat)));
    out.push([Math.round(x), Math.round(y)]);
  }
  // 去掉相邻重复点（取整后会产生）
  const ded = [];
  for (const p of out) {
    const q = ded[ded.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) ded.push(p);
  }
  if (ded.length > 2) {
    const a = ded[0], z = ded[ded.length - 1];
    if (a[0] === z[0] && a[1] === z[1]) ded.pop();
  }
  return ded;
}
function ringArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/* ────────── 主流程 ────────── */
const geo = JSON.parse(fs.readFileSync(IN, 'utf8'));
const groups = [];
let dropped南极 = 0, droppedSmall = 0, droppedHoles = 0, rawVerts = 0;

for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  for (const poly of polys) {
    const outer = poly[0].slice(0, -1);            // GeoJSON 环是闭合的，去掉重复末点
    for (const r of poly) for (const p of r) rawVerts++;
    let latMin = 90, latMax = -90;
    for (const [, lat] of outer) { if (lat < latMin) latMin = lat; if (lat > latMax) latMax = lat; }
    // 南极洲及南极带：图幅南边只到 -70°，整块丢掉
    if (latMin < -60) { dropped南极++; continue; }
    if (latMax < BBOX.south) { dropped南极++; continue; }
    const outerP = project(simplifyClosed(outer, TOL));
    if (outerP.length < 3 || ringArea(outerP) < MIN_AREA) { droppedSmall++; continue; }
    const group = [outerP];
    for (let i = 1; i < poly.length; i++) {
      const hole = project(simplifyClosed(poly[i].slice(0, -1), TOL));
      if (hole.length < 3 || ringArea(hole) < HOLE_AREA) { droppedHoles++; continue; }
      group.push(hole);
    }
    groups.push(group);
  }
}

groups.sort((a, b) => ringArea(b[0]) - ringArea(a[0]));

const verts = groups.reduce((s, g) => s + g.reduce((t, r) => t + r.length, 0), 0);
const holes = groups.reduce((s, g) => s + g.length - 1, 0);

const body = groups.map((g) =>
  '[' + g.map((r) => '[' + r.map((p) => `${p[0]},${p[1]}`).join(',') + ']').join(',') + ']'
).join(',\n');

const src = `// 真实海岸线数据 —— 由 tools/build-coastdata.mjs 从 Natural Earth 50m 陆地生成，请勿手改。
// 换投影 / 换数据后重跑：node tools/build-coastdata.mjs
// 结构：每组 = [外环, 内环...]，环是 [x, y] 世界像素对（geo.js 的 proj 产物）。
// 内环是内海与大湖（里海、五大湖、维多利亚湖…），掩膜必须按 even-odd 把它们留成水域。
/* 数据量：${groups.length} 组 / ${holes} 个内环 / ${verts} 个顶点（原始 ${rawVerts}） */
const RINGS = [
${body}
];

/** 扁平 [x,y,x,y,…] → [[x,y],…]，只在建图时展开一次 */
export const COAST = RINGS.map((group) => group.map((flat) => {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  return pts;
}));
`;
fs.writeFileSync(OUT, src);
console.log(`分组 ${groups.length}（内环 ${holes}） 顶点 ${verts} / 原始 ${rawVerts}  丢弃：南极带 ${dropped南极} 碎岛 ${droppedSmall} 小湖 ${droppedHoles}`);
console.log(`→ ${OUT}  (${(src.length / 1024).toFixed(0)} KB)`);
const top = groups.slice(0, 12).map((g) => `${(ringArea(g[0]) / 1e6).toFixed(2)}M${g.length - 1 ? '+' + (g.length - 1) : ''}`);
console.log('最大陆地环(px²)：', top.join(' '));
