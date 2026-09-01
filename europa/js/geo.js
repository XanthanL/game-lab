// 投影 / 多边形 / 栅格 / Voronoi —— 纯几何层，不碰 DOM，node 里也能跑

import { makeRng, clamp } from './rng.js';

/* ────────────── 投影 ──────────────
   伪圆柱「折中」投影：x 随纬度收缩 (1+cos φ)/2。
   比等距圆柱好看（斯堪的纳维亚不至于横向炸开），
   又不像墨卡托那样把高纬度拉成竖条。
   
   全局版本：经度 -180°~180°，纬度 -70°~70° */
export const BBOX = { west: -180, east: 180, south: -70, north: 70 };
export const K = 25;                                  /* 每纬度单位 25 像素 */
export const WORLD_H = (BBOX.north - BBOX.south) * K; /* = 3500 */
const scaleAt = (lat) => (1 + Math.cos((lat * Math.PI) / 180)) / 2;
/** 某纬度处的图幅宽度：赤道最宽，向两极收窄成透镜形 */
export const widthAt = (lat) => (BBOX.east - BBOX.west) * scaleAt(lat) * K;
/* 画幅必须按最宽处（赤道）取，否则高纬之外的陆地会被画到画布外 */
export const WORLD_W = widthAt(0);                     /* = 9000 */

export function proj(lon, lat) {
  const s = scaleAt(lat);
  return [(lon - BBOX.west) * s * K, (BBOX.north - lat) * K];
}
export function projPoly(pts) { return pts.map((p) => proj(p[0], p[1])); }

/* ────────────── 多边形基础 ────────────── */
export function polyArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
export function polyCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-9) {                        // 退化：取顶点平均
    let sx = 0, sy = 0;
    for (const p of poly) { sx += p[0]; sy += p[1]; }
    return [sx / poly.length, sy / poly.length];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

/** 海岸线加碎形扰动：手绘折线 → 看起来像真海岸 */
export function roughen(poly, amp, iters, seed) {
  const rng = makeRng(seed);
  let pts = poly.slice();
  for (let it = 0; it < iters; it++) {
    const out = [];
    const a = amp / Math.pow(1.9, it);
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      out.push([x1, y1]);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      // 沿法线方向外推，幅度随段长收敛，避免自交
      const d = rng.gauss(0, 1) * Math.min(a, len * 0.28);
      out.push([mx + (-dy / len) * d, my + (dx / len) * d]);
    }
    pts = out;
  }
  return pts;
}

/** Sutherland–Hodgman：用半平面（a 一侧）裁剪凸多边形 */
export function clipHalf(poly, ax, ay, bx, by) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const nx = bx - ax, ny = by - ay;                  // 法线指向 b
  const side = (px, py) => (px - mx) * nx + (py - my) * ny <= 0; // 保留靠近 a 的一侧
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], nxt = poly[(i + 1) % poly.length];
    const sc = side(cur[0], cur[1]), sn = side(nxt[0], nxt[1]);
    if (sc) out.push(cur);
    if (sc !== sn) {
      const [x1, y1] = cur, [x2, y2] = nxt;
      const d1 = (x1 - mx) * nx + (y1 - my) * ny;
      const d2 = (x2 - mx) * nx + (y2 - my) * ny;
      const t = d1 / (d1 - d2 || 1e-9);
      out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
  }
  return out;
}

/** Voronoi：半平面裁剪 + 近邻裁剪（空间哈希取候选，只裁局部几十个邻居） */
export function voronoiCells(sites, bbox, opts = {}) {
  const { x0 = 0, y0 = 0, x1 = WORLD_W, y1 = WORLD_H, nbr = 26 } = opts;
  const n = sites.length;
  const cells = new Array(n);
  if (!n) return cells;
  const rect = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  /* 站点是抖动网格，近似均匀分布：桶边长按平均间距的 2 倍取，
     要凑够 nbr 个最近邻只需向外扩两三圈，候选量与 n 无关。 */
  const bucket = Math.max(4, 2 * Math.sqrt(((x1 - x0) * (y1 - y0)) / n));
  const bw = Math.max(1, Math.ceil((x1 - x0) / bucket));
  const bh = Math.max(1, Math.ceil((y1 - y0) / bucket));
  const head = new Int32Array(bw * bh).fill(-1);
  const nextOf = new Int32Array(n);
  const bxOf = new Int32Array(n);
  const byOf = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const bx = Math.min(bw - 1, Math.max(0, Math.floor((sites[i][0] - x0) / bucket)));
    const by = Math.min(bh - 1, Math.max(0, Math.floor((sites[i][1] - y0) / bucket)));
    bxOf[i] = bx; byOf[i] = by;
    const k = by * bw + bx;
    nextOf[i] = head[k]; head[k] = i;
  }

  const limit = Math.max(24, nbr * 3);   // 候选留足余量，保证 nbr 个最近邻都在内
  const cand = [];
  const byDist = (a, b) => a.d - b.d;

  for (let i = 0; i < n; i++) {
    const [sx, sy] = sites[i];
    const bx = bxOf[i], by = byOf[i];
    cand.length = 0;

    /* 扫到第 r 圈时，未扫描的站点必然在 r*bucket 之外（站点必在自己桶内，
       而扫描框两侧各多出了 r 个桶）。所以第 nbr 近的候选一旦落进 r*bucket，
       nbr 个最近邻就已收齐，继续扩圈只是浪费。 */
    for (let r = 1; r <= 8; r++) {
      const jy0 = Math.max(0, by - r), jy1 = Math.min(bh - 1, by + r);
      const jx0 = Math.max(0, bx - r), jx1 = Math.min(bw - 1, bx + r);
      for (let jy = jy0; jy <= jy1; jy++) {
        for (let jx = jx0; jx <= jx1; jx++) {
          if (r > 1 && jx > bx - r && jx < bx + r && jy > by - r && jy < by + r) continue; // 只扫新环
          for (let j = head[jy * bw + jx]; j >= 0; j = nextOf[j]) {
            if (j === i) continue;
            const dx = sites[j][0] - sx, dy = sites[j][1] - sy;
            cand.push({ d: dx * dx + dy * dy, j });
          }
        }
      }
      cand.sort(byDist);
      if (cand.length >= limit && cand[nbr - 1].d < r * bucket * (r * bucket)) break;
    }

    let cell = rect;
    // rect 必须是凸的且顶点顺序一致，clip 才成立
    for (let k = 0; k < cand.length && cell.length; k++) {
      const j = cand[k].j;
      const far = Math.sqrt(cand[k].d) * 0.5;
      // 当前 cell 外接半径：超过就不再可能被裁
      let r = 0;
      for (const p of cell) r = Math.max(r, dist(p[0], p[1], sx, sy));
      if (far > r) break;
      cell = clipHalf(cell, sx, sy, sites[j][0], sites[j][1]);
      if (k > nbr) break;
    }
    cells[i] = cell.length >= 3 ? cell : null;
  }
  return cells;
}

/* ────────────── 栅格 ──────────────
   所有逻辑（陆地判定 / 面积 / 邻接 / 鼠标拾取）都走栅格，
   矢量只负责画。两者来自同一批 site，因此天然一致。        */
export class Grid {
  constructor(res, w = WORLD_W, h = WORLD_H) {
    this.res = res;
    this.w = Math.ceil(w / res);
    this.h = Math.ceil(h / res);
    this.n = this.w * this.h;
  }
  idx(cx, cy) { return cy * this.w + cx; }
  /** 扫描线填充陆地多边形集合 → Uint8Array 掩膜。
      每个多边形独立做奇偶配对再并入掩膜——交点若跨多边形混排，
      两块重叠大陆的交点会互相配对，把大陆内部填成海。 */
  static landMask(polys, res) {
    const g = new Grid(res);
    const mask = new Uint8Array(g.n);
    const xs = [];
    for (let cy = 0; cy < g.h; cy++) {
      const y = cy * res + res / 2;
      for (const poly of polys) {
        xs.length = 0;
        for (let i = 0, n = poly.length; i < n; i++) {
          const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
          if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
        if (xs.length < 2) continue;
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const a = Math.max(0, Math.round(xs[i] / res));
          const b = Math.min(g.w - 1, Math.round(xs[i + 1] / res));
          for (let cx = a; cx <= b; cx++) mask[cy * g.w + cx] = 1;
        }
      }
    }
    return { grid: g, mask };
  }
  /** 最近 site 归属（CSR 桶加速） */
  static assign(sites, res, bucket) {
    const g = new Grid(res);
    const owner = new Int32Array(g.n).fill(-1);
    const n = sites.length;
    if (!n) return { grid: g, owner };
    const bw = Math.ceil(WORLD_W / bucket) + 2, bh = Math.ceil(WORLD_H / bucket) + 2;
    const nbw = bw * bh;

    // 计数前缀和 → 扁平桶表，扫描时只碰内存连续的站点下标
    const start = new Int32Array(nbw + 1);
    for (let i = 0; i < n; i++) {
      const bx = Math.min(bw - 1, Math.max(0, Math.floor(sites[i][0] / bucket) + 1));
      const by = Math.min(bh - 1, Math.max(0, Math.floor(sites[i][1] / bucket) + 1));
      start[by * bw + bx + 1]++;
    }
    for (let k = 0; k < nbw; k++) start[k + 1] += start[k];
    const cursor = start.slice(0, nbw);
    const items = new Int32Array(n);
    const bxc = new Float64Array(n), byc = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const bx = Math.min(bw - 1, Math.max(0, Math.floor(sites[i][0] / bucket) + 1));
      const by = Math.min(bh - 1, Math.max(0, Math.floor(sites[i][1] / bucket) + 1));
      items[cursor[by * bw + bx]++] = i;
      bxc[i] = sites[i][0]; byc[i] = sites[i][1];
    }

    for (let cy = 0; cy < g.h; cy++) {
      const y = cy * res + res / 2;
      for (let cx = 0; cx < g.w; cx++) {
        const x = cx * res + res / 2;
        const bx = Math.floor(x / bucket) + 1, by = Math.floor(y / bucket) + 1;
        let best = -1, bd = Infinity;
        for (let r = 1; r <= 6; r++) {
          const jy0 = Math.max(0, by - r), jy1 = Math.min(bh - 1, by + r);
          const jx0 = Math.max(0, bx - r), jx1 = Math.min(bw - 1, bx + r);
          for (let jy = jy0; jy <= jy1; jy++) {
            const row = jy * bw;
            for (let jx = jx0; jx <= jx1; jx++) {
              if (r > 1 && jx > bx - r && jx < bx + r && jy > by - r && jy < by + r) continue; // 只扫环
              const k = row + jx;
              for (let t = start[k], end = start[k + 1]; t < end; t++) {
                const si = items[t];
                const dx = bxc[si] - x, dy = byc[si] - y;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = si; }
              }
            }
          }
          if (best >= 0 && bd < (r - 0.5) * (r - 0.5) * bucket * bucket) break;
        }
        owner[cy * g.w + cx] = best;
      }
    }
    return { grid: g, owner };
  }
}

/** 由栅格归属反推邻接：统计接触像素对，太少视为「只碰了个角」 */
export function adjacencyFromGrid(grid, owner, count, minContact = 3) {
  const pairs = new Map();
  const contact = new Map();
  const bump = (a, b) => {
    if (a === b || a < 0 || b < 0) return;
    const key = a < b ? a * count + b : b * count + a;
    contact.set(key, (contact.get(key) || 0) + 1);
  };
  for (let cy = 0; cy < grid.h; cy++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const i = cy * grid.w + cx;
      const v = owner[i];
      if (v < 0) continue;
      if (cx + 1 < grid.w) bump(v, owner[i + 1]);
      if (cy + 1 < grid.h) bump(v, owner[i + grid.w]);
    }
  }
  for (const [key, c] of contact) {
    if (c < minContact) continue;
    const a = Math.floor(key / count), b = key % count;
    if (!pairs.has(a)) pairs.set(a, []);
    if (!pairs.has(b)) pairs.set(b, []);
    pairs.get(a).push(b);
    pairs.get(b).push(a);
  }
  return { adj: pairs, contact };
}

export { clamp };
