// 地图渲染器。
//
// 性能策略（这是本次优化的重点）：
//   · 静态底图（海 + 省份色块 + 省界 + 海岸线）烘焙到一张离屏 canvas，
//     平时 draw() 只做一次 drawImage。
//   · 缩放/平移时不重新烘焙，而是用仿射变换把已烘焙的位图 blit 上去，
//     停手 ~150ms 后再烘焙一次把画面锐化回来。拖动因此始终是零重绘成本。
//   · 动态层（悬停高亮、首都、军队）单独画在最上层，只在真正变化时重绘。
//   · 省份易主由 world.mapVersion 触发重烘焙，并做节流，避免围城期间每帧重画。

import { WORLD_W, WORLD_H } from './geo.js';
import { buildPaths, paintBase, fitView, pathOfIds } from './paint.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Renderer {
  constructor(canvas, world, paths) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = world;
    this.map = world.map;
    // Path2D 构建不便宜，选国界面和主渲染器共用同一份
    this.paths = paths || buildPaths(this.map);

    this.mode = 'political';
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.baseView = { zoom: 1, panX: 0, panY: 0 };

    this.cssW = 1; this.cssH = 1; this.dpr = 1;
    this.base = document.createElement('canvas');
    this.bctx = this.base.getContext('2d', { alpha: false });

    this.hoverId = -1;
    this.selectedId = -1;

    this.baseDirty = true;
    this.overlayDirty = true;
    this.bakeAt = 0;
    this.interacting = false;
    this.interactUntil = 0;
    this.bakedVersion = -1;

    this.minZoom = 0.1;
    this.maxZoom = 12;
    this.playerBorder = { tag: null, version: -1, path: null };

    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      let t = 0;
      this.ro = new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(() => this.resize(), 80);   // 拖窗口时别跟着重烘焙
      });
      this.ro.observe(this.canvas.parentElement || this.canvas);
    }
    window.addEventListener('resize', () => this.resize());
  }

  /* ---------- 尺寸与视图 ---------- */

  resize() {
    const host = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, Math.round(host.clientWidth));
    const h = Math.max(1, Math.round(host.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;
    this.cssW = w; this.cssH = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    this.fitZoom = Math.min(w / WORLD_W, h / WORLD_H) * 0.97;
    this.minZoom = this.fitZoom * 0.85;
    this.maxZoom = this.fitZoom * 14;
    this.fit();
    this.baseDirty = true;
    this.overlayDirty = true;
    this.bakeAt = 0;
  }

  fit() {
    const v = fitView(WORLD_W, WORLD_H, this.cssW, this.cssH, 0.97);
    Object.assign(this.view, v);
    this.clampPan();
    this.baseDirty = true;
    this.bakeAt = 0;
    this.overlayDirty = true;
  }

  worldToScreen(x, y) {
    return [x * this.view.zoom + this.view.panX, y * this.view.zoom + this.view.panY];
  }
  screenToWorld(sx, sy) {
    return [(sx - this.view.panX) / this.view.zoom, (sy - this.view.panY) / this.view.zoom];
  }

  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.view.zoom = clamp(this.view.zoom * factor, this.minZoom, this.maxZoom);
    this.view.panX = sx - wx * this.view.zoom;
    this.view.panY = sy - wy * this.view.zoom;
    this.clampPan();
    this.touch();
    this.overlayDirty = true;
  }

  panBy(dx, dy) {
    this.view.panX += dx;
    this.view.panY += dy;
    this.clampPan();
    this.touch();
    this.overlayDirty = true;
  }

  /** 保证地图不会整个滑出视野 */
  clampPan() {
    const vw = WORLD_W * this.view.zoom, vh = WORLD_H * this.view.zoom;
    const slackX = Math.max(60, this.cssW * 0.4), slackY = Math.max(60, this.cssH * 0.4);
    if (vw <= this.cssW) this.view.panX = (this.cssW - vw) / 2;
    else this.view.panX = clamp(this.view.panX, this.cssW - vw - slackX, slackX);
    if (vh <= this.cssH) this.view.panY = (this.cssH - vh) / 2;
    else this.view.panY = clamp(this.view.panY, this.cssH - vh - slackY, slackY);
  }

  /** 交互中：延后重烘焙，让位图变换先顶上 */
  touch() {
    this.interacting = true;
    this.interactUntil = performance.now() + 160;
    if (!this.baseDirty) { this.baseDirty = true; this.bakeAt = this.interactUntil; }
  }

  /* ---------- 状态变更 ---------- */

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.baseDirty = true;
    this.bakeAt = 0;
    this.overlayDirty = true;
  }
  setHover(id) { if (this.hoverId !== id) { this.hoverId = id; this.overlayDirty = true; } }
  setSelected(id) { if (this.selectedId !== id) { this.selectedId = id; this.overlayDirty = true; } }
  invalidate() { this.overlayDirty = true; }

  /* ---------- 绘制 ---------- */

  draw() {
    const now = performance.now();
    if (this.interacting && now > this.interactUntil) this.interacting = false;

    if (!this.baseDirty && this.world.mapVersion !== this.bakedVersion) {
      this.baseDirty = true;
      // 动荡模式变化频繁，给个更长的节流窗口
      this.bakeAt = now + (this.mode === 'unrest' ? 900 : 320);
    }
    if (this.baseDirty && now >= this.bakeAt) this.bake();

    if (this.overlayDirty) { this.paint(); this.overlayDirty = false; }
  }

  bake() {
    this.baseView.zoom = this.view.zoom;
    this.baseView.panX = this.view.panX;
    this.baseView.panY = this.view.panY;
    paintBase(this.bctx, this.world, this.paths, this.mode, this.baseView,
      { w: this.cssW, h: this.cssH, dpr: this.dpr });
    this.bakePlayerBorder(this.bctx, this.baseView);
    this.baseDirty = false;
    this.bakedVersion = this.world.mapVersion;
    this.overlayDirty = true;
  }

  // 玩家国界跟着 mapVersion 走，所以可以安全地烘进底图，不必每帧描边
  bakePlayerBorder(ctx, view) {
    const world = this.world;
    const tag = world.playerTag;
    if (!tag) return;
    const c = world.countries.get(tag);
    if (!c || !c.provinces.size) return;
    if (this.playerBorder.tag !== tag || this.playerBorder.version !== world.mapVersion) {
      const ids = [];
      for (const pid of c.provinces) if (world.provinces.get(pid)?.owner === tag) ids.push(pid);
      this.playerBorder = { tag, version: world.mapVersion, path: pathOfIds(this.paths, ids) };
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(view.panX, view.panY);
    ctx.scale(view.zoom, view.zoom);
    ctx.strokeStyle = 'rgba(20,16,12,0.8)';
    ctx.lineWidth = 1.6 / view.zoom;
    ctx.stroke(this.playerBorder.path);
  }

  paint() {
    const ctx = this.ctx;
    const D = this.dpr;
    const s = this.view.zoom / this.baseView.zoom;
    const tx = D * (this.view.panX - this.baseView.panX * s);
    const ty = D * (this.view.panY - this.baseView.panY * s);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#a9c3cd';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, tx, ty);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0);

    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.translate(this.view.panX, this.view.panY);
    ctx.scale(this.view.zoom, this.view.zoom);
    this.paintOverlay(ctx);
  }

  paintOverlay(ctx) {
    const world = this.world;
    const z = this.view.zoom;

    // 悬停 / 选中高亮（后者后画，覆盖前者）
    const hl = [[this.hoverId, 'rgba(255,255,255,0.24)'], [this.selectedId, 'rgba(255,236,150,0.42)']];
    for (const [id, style] of hl) {
      if (id == null || id < 0) continue;
      const p = this.map.provById.get(id);
      if (!p || p.sea) continue;
      const path = this.paths.provPaths.get(id);
      if (!path) continue;
      ctx.fillStyle = style;
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(30,24,18,0.55)';
      ctx.lineWidth = 1.1 / z;
      ctx.stroke(path);
    }

    // 首都 / 堡垒
    ctx.lineWidth = 0.9 / z;
    for (const c of world.countries.values()) {
      if (c.capital == null) continue;
      const p = world.provinces.get(c.capital);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 2.2 / z, 0, Math.PI * 2);
      ctx.fillStyle = '#f0d850';
      ctx.fill();
      ctx.strokeStyle = '#3a2f22';
      ctx.stroke();
      if (p.fort) {
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, 4.6 / z, 0, Math.PI * 2);
        ctx.strokeStyle = '#5a4a30';
        ctx.stroke();
      }
    }

    // 军队：同省多支堆叠时错开，避免完全重叠
    const stack = new Map();
    for (const c of world.countries.values()) {
      for (const a of c.armies) {
        const key = a.prov;
        const n = stack.get(key) || 0;
        stack.set(key, n + 1);
        const p = world.provinces.get(a.prov);
        if (!p) continue;
        const off = n * 5.5 / z;
        const r = clamp(2.4 + Math.sqrt(a.size) * 0.22, 2.6, 8) / z;
        ctx.beginPath();
        ctx.rect(p.cx - r + off, p.cy - r - off, r * 2, r * 2);
        ctx.fillStyle = `rgb(${c.color[0]},${c.color[1]},${c.color[2]})`;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 / z;
        ctx.stroke();
      }
    }

    // 围城标记
    ctx.lineWidth = 1.2 / z;
    for (const p of world.provinces.values()) {
      if (!p.siege || p.sea) continue;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 7 / z, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.siege.progress / (30 + p.fort * 18)));
      ctx.strokeStyle = '#c0392b';
      ctx.stroke();
    }
  }

  pickProv(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const cx = Math.floor(wx / this.map.res);
    const cy = Math.floor(wy / this.map.res);
    if (cx < 0 || cy < 0 || cx >= this.map.grid.w || cy >= this.map.grid.h) return -1;
    return this.map.owner[cy * this.map.grid.w + cx];
  }
}
