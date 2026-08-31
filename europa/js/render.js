// 地图渲染：Canvas 2D，支持缩放/平移、多种地图模式、军队/标签
import { WORLD_W, WORLD_H, projPoly } from './geo.js';
import { TERRAINS } from './countries.js';

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.map = world.map;
    this.mode = 'political'; // political/terrain/religion/culture/trade/unrest
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.hoverId = -1;
    this.selectedId = -1;
    this.dirty = true;
    this.landPath = this.buildLandPath();
    this.seaClipPath = this.buildSeaClipPath();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.fit();
    this.dirty = true;
  }

  fit() {
    const sx = this.canvas.width / WORLD_W;
    const sy = this.canvas.height / WORLD_H;
    this.zoom = Math.min(sx, sy) * 0.92;
    this.pan.x = (this.canvas.width - WORLD_W * this.zoom) / 2;
    this.pan.y = (this.canvas.height - WORLD_H * this.zoom) / 2;
  }

  buildLandPath() {
    const path = new Path2D();
    for (const c of this.map.coasts) {
      const pts = c.poly;
      if (!pts.length) continue;
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
      path.closePath();
    }
    return path;
  }

  buildSeaClipPath() {
    // 海 clip = 外框矩形 + 所有陆地（evenodd → 海区域）
    const path = new Path2D();
    path.rect(0, 0, WORLD_W, WORLD_H);
    path.addPath(this.landPath);
    return path;
  }

  worldToScreen(x, y) {
    return [x * this.zoom + this.pan.x, y * this.zoom + this.pan.y];
  }
  screenToWorld(sx, sy) {
    return [(sx - this.pan.x) / this.zoom, (sy - this.pan.y) / this.zoom];
  }

  setMode(mode) { this.mode = mode; this.dirty = true; }
  setHover(id) { if (this.hoverId !== id) { this.hoverId = id; this.dirty = true; } }
  setSelected(id) { if (this.selectedId !== id) { this.selectedId = id; this.dirty = true; } }

  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.zoom, this.zoom);

    // 海背景
    ctx.fillStyle = '#aac4ce';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // 海域省
    ctx.save();
    ctx.clip(this.seaClipPath, 'evenodd');
    for (const p of this.map.seas) this.drawCell(ctx, p, [150, 185, 195]);
    ctx.restore();

    // 陆地省
    ctx.save();
    ctx.clip(this.landPath);
    for (const p of this.map.provinces) {
      const prov = this.world.provinces.get(p.id);
      ctx.fillStyle = this.provinceColor(prov);
      this.fillCell(ctx, p.cell);
    }
    // 高亮悬停/选中
    if (this.hoverId >= 0) {
      const hp = this.map.provById.get(this.hoverId);
      if (hp && !hp.sea) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; this.fillCell(ctx, hp.cell); }
    }
    if (this.selectedId >= 0 && this.selectedId !== this.hoverId) {
      const sp = this.map.provById.get(this.selectedId);
      if (sp && !sp.sea) { ctx.fillStyle = 'rgba(255,255,200,0.35)'; this.fillCell(ctx, sp.cell); }
    }
    ctx.restore();

    // 省界
    ctx.save();
    ctx.clip(this.landPath);
    ctx.strokeStyle = 'rgba(40,30,22,0.45)';
    ctx.lineWidth = 0.6 / this.zoom;
    for (const p of this.map.provinces) {
      ctx.beginPath();
      const cell = p.cell;
      if (!cell.length) continue;
      ctx.moveTo(cell[0][0], cell[0][1]);
      for (let i = 1; i < cell.length; i++) ctx.lineTo(cell[i][0], cell[i][1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // 海岸线
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 1.2 / this.zoom;
    ctx.stroke(this.landPath);

    // 首都 / 堡垒
    for (const c of this.world.countries.values()) {
      if (!c.capital) continue;
      const p = this.world.provinces.get(c.capital);
      const [x, y] = [p.cx, p.cy];
      ctx.fillStyle = '#f0d850';
      ctx.beginPath(); ctx.arc(x, y, 2 / this.zoom, 0, Math.PI * 2); ctx.fill();
      if (p.fort) {
        ctx.strokeStyle = '#5a4a30';
        ctx.lineWidth = 0.8 / this.zoom;
        ctx.beginPath(); ctx.arc(x, y, 4 / this.zoom, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // 军队
    for (const c of this.world.countries.values()) {
      for (const a of c.armies) {
        const p = this.world.provinces.get(a.prov);
        const [x, y] = [p.cx, p.cy];
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = `rgb(${c.color.join(',')})`;
        ctx.lineWidth = 1 / this.zoom;
        const r = Math.max(3, Math.min(8, a.size / 2000)) / this.zoom;
        ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
      }
    }
  }

  fillCell(ctx, cell) {
    if (!cell || cell.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(cell[0][0], cell[0][1]);
    for (let i = 1; i < cell.length; i++) ctx.lineTo(cell[i][0], cell[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  drawCell(ctx, p, color) {
    if (!p.cell || p.cell.length < 3) return;
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(p.cell[0][0], p.cell[0][1]);
    for (let i = 1; i < p.cell.length; i++) ctx.lineTo(p.cell[i][0], p.cell[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  provinceColor(prov) {
    if (this.mode === 'terrain') {
      const t = TERRAINS[prov.terrain] || TERRAINS.farmland;
      return `rgb(${t.color.join(',')})`;
    }
    if (this.mode === 'political') {
      if (!prov.owner) return 'rgb(200,190,180)';
      const c = this.world.countries.get(prov.owner);
      return `rgb(${c.color.join(',')})`;
    }
    if (this.mode === 'religion') {
      const pal = { catholic: '#4a6fa5', orthodox: '#8a5a3a', sunni: '#3a8a5a', hussite: '#7a4a8a', shia: '#5a8a6a', protestant: '#6a5a9a' };
      return pal[prov.religion] || '#999';
    }
    if (this.mode === 'culture') {
      const rng = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return `hsl(${Math.abs(h) % 360},55%,55%)`; };
      return rng(prov.culture || 'x');
    }
    if (this.mode === 'trade') {
      const v = { grain: '#d4c47a', wine: '#a05070', wool: '#90a060', cloth: '#6070a0', fish: '#60a0c0', salt: '#c0c0c0', iron: '#707070', gold: '#d4b030', copper: '#b07040', lumber: '#508040', fur: '#805030', horses: '#a08050', cotton: '#d0d0e0', spices: '#a03080', silk: '#d0a0d0' };
      return v[prov.tradeGood] || '#aaa';
    }
    if (this.mode === 'unrest') {
      const u = Math.min(1, Math.max(0, prov.unrest / 10));
      return `rgb(${120 + u * 135}, ${180 - u * 120}, ${160 - u * 100})`;
    }
    return '#ccc';
  }

  pickProv(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const cx = Math.floor(wx / this.map.res);
    const cy = Math.floor(wy / this.map.res);
    if (cx < 0 || cy < 0 || cx >= this.map.grid.w || cy >= this.map.grid.h) return -1;
    return this.map.owner[cy * this.map.grid.w + cx];
  }
}
