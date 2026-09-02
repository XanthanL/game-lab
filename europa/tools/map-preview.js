// 开发脚本：把生成的地图/世界态势渲成 PNG 校验。
//   node tools/map-preview.js [--terrain] [--political] [--ascii] [--spacing=40]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_W, WORLD_H, proj, BBOX } from '../js/geo.js';
import { createWorld } from '../js/world.js';
import { DEFAULTS } from '../js/mapgen.js';
import { TERRAINS } from '../js/countries.js';
import { TRADE_NODES, assignTradeNodes } from '../js/trade.js';
import { encodePNG } from './png.js';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SP = Number(get('spacing', DEFAULTS.spacing));
const POLITICAL = args.includes('--political');
const TERRAIN = args.includes('--terrain');
const TRADENODE = args.includes('--tradenode');

const t0 = Date.now();
const world = createWorld({ seed: 'europa-1444', spacing: SP });
const M = world.map;
if (TRADENODE) assignTradeNodes(world);   // 贸易节点图需要先给省份划分节点
console.log(`构建 ${Date.now() - t0}ms  站点 ${M.all.length}  陆地省 ${M.provinces.length}  海域 ${M.seas.length}`);

const S = 1;
const W = Math.round(WORLD_W * S), H = Math.round(WORLD_H * S);
const img = new Uint8Array(W * H * 3);
const put = (x, y, r, g, b) => { const i = (y * W + x) * 3; img[i] = r; img[i + 1] = g; img[i + 2] = b; };

const SEA = [121, 168, 176], SEA2 = [108, 158, 166];
const UNOWNED = [216, 206, 190];      // 未殖民区（可开拓）
const WASTE = [168, 158, 146];        // 气候荒地（不可通行）
const BORDER = [58, 50, 42], COAST = [38, 26, 18], GRAT = [120, 150, 160];

// 贸易节点配色（与 paint.js 同一套黄金角分布）
function hslRgb(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
const NODE_PREVIEW = new Map(TRADE_NODES.map((n, i) => [n.id, hslRgb((i * 137.508) % 360, 0.56, 0.52)]));

const ownerAt = (wx, wy) => {
  const cx = Math.floor(wx / M.res), cy = Math.floor(wy / M.res);
  if (cx < 0 || cy < 0 || cx >= M.grid.w || cy >= M.grid.h) return -1;
  return M.owner[cy * M.grid.w + cx];
};
const maskAt = (wx, wy) => {
  const cx = Math.floor(wx / M.res), cy = Math.floor(wy / M.res);
  if (cx < 0 || cy < 0 || cx >= M.grid.w || cy >= M.grid.h) return 0;
  return M.landMask[cy * M.grid.w + cx];
};

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const wx = x / S, wy = y / S;
    const land = maskAt(wx, wy);
    const o = ownerAt(wx, wy);
    const p = o >= 0 ? M.provById.get(o) : null;
    let c;
    if (!land) {
      c = p && p.sea ? SEA2 : SEA;
    } else if (TERRAIN && p) {
      const t = TERRAINS[p.terrain];
      c = t ? t.color : UNOWNED;
    } else if (POLITICAL && p) {
      const prov = world.provinces.get(o);
      const country = prov && prov.owner ? world.countries.get(prov.owner) : null;
      if (country) {
        let [r, g, b] = country.color;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum < 100) {
          const k = 1 + (100 - lum) / 180;
          r = Math.min(255, r * k); g = Math.min(255, g * k); b = Math.min(255, b * k);
        }
        c = [Math.round(r), Math.round(g), Math.round(b)];
      } else if (prov && prov.wasteland) c = ((x + y) & 3) === 0 ? [158, 150, 138] : WASTE;
      else c = UNOWNED;
    } else if (TRADENODE && p) {
      const prov = world.provinces.get(o);
      c = prov && prov.tradeNode ? (NODE_PREVIEW.get(prov.tradeNode) || UNOWNED) : UNOWNED;
    } else {
      c = UNOWNED;
    }
    put(x, y, c[0], c[1], c[2]);
  }
}

// 省界 / 国界：政治图预览只画国界，避免全图蜂窝；地形图预览画淡省界
const ownerOf = (id) => {
  const p = id >= 0 ? world.provinces.get(id) : null;
  return p && p.owner ? p.owner : null;
};
const d = 0.9;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const wx = x / S, wy = y / S;
    if (!maskAt(wx, wy)) continue;
    const o = ownerAt(wx, wy);
    if (o < 0) continue;
    const l = ownerAt(wx - d, wy), r = ownerAt(wx + d, wy);
    const u = ownerAt(wx, wy - d), dn = ownerAt(wx, wy + d);
    const crossNation = (v) => v >= 0 && ownerOf(v) !== ownerOf(o);
    if (!POLITICAL) continue;           // 地形图预览不画省界，避免全图网格
    if (crossNation(l) || crossNation(r) || crossNation(u) || crossNation(dn)) put(x, y, BORDER[0], BORDER[1], BORDER[2]);
  }
}
// 海岸线
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const wx = x / S, wy = y / S;
    const m = maskAt(wx, wy);
    if (m !== maskAt(wx - 1.2, wy) || m !== maskAt(wx + 1.2, wy) || m !== maskAt(wx, wy - 1.2) || m !== maskAt(wx, wy + 1.2)) put(x, y, COAST[0], COAST[1], COAST[2]);
  }
}
// 首都黄点
for (const c of world.countries.values()) {
  if (!c.capital) continue;
  const p = world.provinces.get(c.capital);
  const cx = Math.round(p.cx * S), cy = Math.round(p.cy * S);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > 2) continue;
    const xx = cx + dx, yy = cy + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    put(xx, yy, 240, 220, 80);
  }
}
// 贸易节点枢纽圆点（仅贸易节点图）
if (TRADENODE) {
  for (const n of TRADE_NODES) {
    const [x, y] = proj(n.c[0], n.c[1]);
    const cx = Math.round(x * S), cy = Math.round(y * S);
    const col = NODE_PREVIEW.get(n.id) || [136, 136, 136];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      const xx = cx + dx, yy = cy + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      put(xx, yy, col[0], col[1], col[2]);
    }
  }
}
// 经纬网（全球，每 20°）
for (let lon = -180; lon <= 180; lon += 20) {
  for (let lat = BBOX.south; lat <= BBOX.north; lat += 0.25) { const [x, y] = proj(lon, lat); if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) put(Math.round(x), Math.round(y), GRAT[0], GRAT[1], GRAT[2]); }
}
for (let lat = -60; lat <= 60; lat += 20) {
  for (let lon = BBOX.west; lon <= BBOX.east; lon += 0.25) { const [x, y] = proj(lon, lat); if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) put(Math.round(x), Math.round(y), GRAT[0], GRAT[1], GRAT[2]); }
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)),
  POLITICAL ? 'preview-political.png'
    : TERRAIN ? 'preview-terrain.png'
    : TRADENODE ? 'preview-tradenode.png'
    : 'preview.png');
fs.writeFileSync(out, encodePNG(W, H, img));
console.log('→ ' + out + `  (${W}x${H})`);

// 国家规模统计
const sizes = [];
for (const c of world.countries.values()) sizes.push({ tag: c.tag, name: c.name, n: c.provinces.size, dev: c.development });
sizes.sort((a, b) => b.n - a.n);
console.log('前 15 大国：', sizes.slice(0, 15).map((x) => `${x.name} ${x.n}省/${x.dev}dev`).join('  '));

if (args.includes('--ascii')) {
  const Q = '1234567890ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const COLS = 150, ROWS = 64;
  for (let r = 0; r < ROWS; r++) {
    let s = '|';
    for (let c = 0; c < COLS; c++) {
      const wx = ((c + 0.5) / COLS) * WORLD_W, wy = ((r + 0.5) / ROWS) * WORLD_H;
      if (!maskAt(wx, wy)) { s += '.'; continue; }
      const o = ownerAt(wx, wy);
      const p = o >= 0 ? M.provById.get(o) : null;
      s += !p ? ',' : p.sea ? '~' : Q[p.id % Q.length];
    }
    console.log(s + '|');
  }
}
