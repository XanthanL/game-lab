// 开发脚本：把生成的地图/世界态势渲成 PNG 校验。
//   node tools/map-preview.js [--political] [--ascii] [--spacing=36]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_W, WORLD_H, proj, BBOX } from '../js/geo.js';
import { buildMap } from '../js/mapgen.js';
import { createWorld } from '../js/world.js';
import { encodePNG } from './png.js';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((s) => s.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SP = Number(get('spacing', 20));
const POLITICAL = args.includes('--political');

const t0 = Date.now();
const world = createWorld({ seed: 'europa-1444', spacing: SP });
const M = world.map;
console.log(`构建 ${Date.now() - t0}ms  站点 ${M.all.length}  陆地省 ${M.provinces.length}  海域 ${M.seas.length}`);

const S = 1;
const W = Math.round(WORLD_W * S), H = Math.round(WORLD_H * S);
const img = new Uint8Array(W * H * 3);
const put = (x, y, r, g, b) => { const i = (y * W + x) * 3; img[i] = r; img[i + 1] = g; img[i + 2] = b; };

const SEA = [170, 198, 208], SEA2 = [155, 185, 196];
const UNOWNED = [210, 200, 190];      // 未殖民区（可开拓）
const WASTE = [176, 168, 156];        // 气候荒地（不可通行）
const BORDER = [55, 45, 35], COAST = [35, 28, 22], GRAT = [120, 150, 160];

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
    } else if (POLITICAL && p) {
      const prov = world.provinces.get(o);
      const country = prov && prov.owner ? world.countries.get(prov.owner) : null;
      if (country) c = country.color;
      else if (prov && prov.wasteland) c = ((x + y) & 3) === 0 ? [158, 150, 138] : WASTE;
      else c = UNOWNED;
    } else {
      c = UNOWNED;
    }
    put(x, y, c[0], c[1], c[2]);
  }
}

// 省界 / 国界
const d = 0.9;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const wx = x / S, wy = y / S;
    if (!maskAt(wx, wy)) continue;
    const o = ownerAt(wx, wy);
    if (o < 0) continue;
    const l = ownerAt(wx - d, wy), r = ownerAt(wx + d, wy);
    const u = ownerAt(wx, wy - d), dn = ownerAt(wx, wy + d);
    const cross = (v) => v >= 0 && v !== o;
    if (cross(l) || cross(r) || cross(u) || cross(dn)) put(x, y, BORDER[0], BORDER[1], BORDER[2]);
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
// 经纬网
for (let lon = -10; lon <= 50; lon += 10) {
  for (let lat = BBOX.south; lat <= BBOX.north; lat += 0.25) { const [x, y] = proj(lon, lat); if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) put(Math.round(x), Math.round(y), GRAT[0], GRAT[1], GRAT[2]); }
}
for (let lat = 30; lat <= 70; lat += 10) {
  for (let lon = BBOX.west; lon <= BBOX.east; lon += 0.25) { const [x, y] = proj(lon, lat); if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) put(Math.round(x), Math.round(y), GRAT[0], GRAT[1], GRAT[2]); }
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), POLITICAL ? 'preview-political.png' : 'preview.png');
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
