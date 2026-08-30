/* ============================================================
   三体 · 像素歌剧 — 像素伪3D引擎
   480x270 低分辨率缓冲 + CSS 放大 = 像素风
   多层视差(depth) + 摄像机缩放/震动 = 伪3D
   ============================================================ */

/* ---------- 数学工具 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, p) => a + (b - a) * p;
const easeInOut = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const easeOut   = p => 1 - Math.pow(1 - p, 3);
const easeIn    = p => p * p * p;
const linear    = p => p;

/* ---------- 幕切换中断 ---------- */
class ActAbort extends Error { constructor(){ super('act-abort'); this.name = 'ActAbort'; } }

/* ---------- 剧本时钟：wait / tween，支持暂停与跳幕中止 ----------
   基于 wall-clock 截止时间，低帧率下剧情节奏依然准确 */
const Clock = {
  paused: false,
  timers: new Set(),
  _pauseStart: 0,
  setPaused(p) {
    if (p === this.paused) return;
    if (p) { this.paused = true; this._pauseStart = performance.now(); }
    else {
      const shift = performance.now() - this._pauseStart;
      this.paused = false;
      for (const t of this.timers) t.deadline += shift;
    }
  },
  wait(ms, sig) {
    return new Promise((res, rej) => { this.timers.add({ deadline: performance.now() + ms, res, rej, sig }); });
  },
  tween(ms, fn, ease, sig) {
    return new Promise((res, rej) => {
      const t = { deadline: performance.now() + ms, total: ms, fn, ease: ease || easeInOut, res, rej, sig, isTween: true };
      try { fn(0); } catch (e) {}
      this.timers.add(t);
    });
  },
  tick() {
    if (this.paused) return;
    const now = performance.now();
    for (const t of [...this.timers]) {
      if (t.sig && t.sig.aborted) { this.timers.delete(t); t.rej(new ActAbort()); continue; }
      const remaining = t.deadline - now;
      if (t.isTween) {
        const p = clamp(1 - remaining / t.total, 0, 1);
        try { t.fn(t.ease(p)); } catch (e) {}
      }
      if (remaining <= 0) { this.timers.delete(t); t.res(); }
    }
  }
};

/* 每帧回调（粒子更新等） */
const TICKERS = [];

/* ---------- 舞台 ---------- */
class Stage {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.ctx.imageSmoothingEnabled = false;
    this.layers = [];
    this.cam = { x: 0, y: 0, zoom: 1, shake: 0 };
    this.time = 0;
    this._last = 0;
    this._shX = 0; this._shY = 0;
    const loop = ts => {
      const dt = Math.min(50, ts - (this._last || ts)); /* 动画时钟封顶，防跳帧 */
      this._last = ts;
      Clock.tick();
      if (!Clock.paused) {
        this.time += dt;
        for (const t of TICKERS) { try { t(dt); } catch (e) {} }
      }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  setLayers(arr) { this.layers = arr; }
  reset() {
    this.layers = [];
    this.cam.x = 0; this.cam.y = 0; this.cam.zoom = 1; this.cam.shake = 0;
  }
  addShake(v) { this.cam.shake = Math.max(this.cam.shake, v); }
  render() {
    const { ctx, W, H, cam } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (cam.shake > .05) {
      this._shX = (Math.random() * 2 - 1) * cam.shake;
      this._shY = (Math.random() * 2 - 1) * cam.shake;
      cam.shake *= .9;
    } else { this._shX = this._shY = 0; }
    const sorted = [...this.layers].sort((a, b) => a.z - b.z);
    for (const L of sorted) {
      ctx.save();
      /* 摄像机：中心缩放 + 按深度的视差平移 */
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-W / 2, -H / 2);
      ctx.translate(-cam.x * L.depth + this._shX, -cam.y * L.depth + this._shY);
      L.fn(ctx, this.time, this);
      ctx.restore();
    }
  }
}
/* depth: 0=无限远(不动)  1=焦平面  >1=前景(反向视差由粒子层处理) */
function layer(depth, fn, z) { return { depth, fn, z: z !== undefined ? z : depth }; }

/* 摄像机缓动 */
function camTo(cam, x, y, zoom, ms, sig) {
  const sx = cam.x, sy = cam.y, sz = cam.zoom;
  return Clock.tween(ms, p => {
    cam.x = lerp(sx, x, p);
    cam.y = lerp(sy, y, p);
    cam.zoom = lerp(sz, zoom, p);
  }, easeInOut, sig);
}

/* ---------- 粒子系统（每颗粒子带 depth 视差） ---------- */
class FX {
  constructor() {
    this.ps = [];
    this.emitters = [];
    TICKERS.push(dt => this.update(dt));
  }
  reset() { this.ps.length = 0; this.emitters.length = 0; }
  add(p) {
    p.age = 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.g = p.g || 0;
    p.d = p.d !== undefined ? p.d : 1;
    p.size = p.size || 1; p.life = p.life || 1000;
    p.color = p.color || '#fff'; p.sway = p.sway || 0;
    this.ps.push(p); return p;
  }
  emitter(e) { e.acc = 0; this.emitters.push(e); return e; }
  burst(x, y, o = {}) {
    const n = o.n || 20;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed || 40) * (.3 + Math.random() * .7);
      this.add({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.up || 0),
        g: o.g || 0,
        life: (o.life || 800) * (.5 + Math.random() * .5),
        color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color,
        size: o.size || 1,
        d: o.d !== undefined ? o.d : 1,
        sway: o.sway || 0
      });
    }
  }
  update(dt) {
    const s = dt / 1000;
    for (const e of this.emitters) {
      e.acc += e.rate * s;
      while (e.acc >= 1) { e.acc--; this.add(e.gen()); }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.age += dt;
      if (p.age >= p.life) { this.ps.splice(i, 1); continue; }
      p.vy += p.g * s;
      p.x += p.vx * s + (p.sway ? Math.sin(p.age / 280 + p.y * .05) * p.sway * s : 0);
      p.y += p.vy * s;
    }
  }
  draw(ctx, cam) {
    for (const p of this.ps) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = p.fade === false ? 1 : k;
      ctx.fillStyle = p.color;
      const ox = cam.x * (1 - p.d), oy = cam.y * (1 - p.d);
      ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- 画布文字（低分辨率绘制，放大后自然像素化） ---------- */
function drawText(ctx, txt, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.weight || 'bold'} ${o.size || 8}px ${o.font || '"Courier New","SimSun",monospace'}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = 'middle';
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 6; }
  ctx.globalAlpha = o.alpha !== undefined ? o.alpha : 1;
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(txt, x, y);
  ctx.restore();
}

/* ---------- 组合特效 ---------- */
function explodeFX(S, x, y, power = 1, colors) {
  S.fx.burst(x, y, {
    n: Math.round(26 * power), speed: 70 * power, g: 25,
    life: 900, size: 1,
    color: colors || ['#ffd27a', '#ff9040', '#ff5030', '#fff3d0']
  });
  S.fx.burst(x, y, { n: Math.round(10 * power), speed: 18, life: 1600, size: 1, color: '#5a5a66' });
  S.stage.addShake(2.5 * power);
  S.audio.sfxBoom(Math.min(1.4, .5 * power));
}
