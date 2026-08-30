/* ============================================================
   engine.js — ASCII 渲染引擎
   提供:  字符帧缓冲(Framebuffer)、深度缓冲、彩色输出、
          渲染循环(RAF)、FPS 统计、场景注册与调度
   无任何外部依赖。
   ============================================================ */

(function (global) {
  "use strict";

  /* ---------- 字符帧缓冲 ---------- */
  class Framebuffer {
    constructor(cols, rows) {
      this.resize(cols, rows);
    }
    resize(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      this.n = cols * rows;
      this.chars = new Array(this.n);
      this.depth = new Float32Array(this.n);
      // 每格 0..1 的强度值，供彩虹/热力上色使用
      this.lum = new Float32Array(this.n);
      this.clear();
    }
    clear(ch) {
      ch = ch || " ";
      this.chars.fill(ch);
      this.depth.fill(-Infinity);
      this.lum.fill(0);
    }
    // 直接写入字符（带边界检查）
    set(x, y, ch, lum) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const i = y * this.cols + x;
      this.chars[i] = ch;
      if (lum !== undefined) this.lum[i] = lum;
    }
    // 带深度测试的写入（z 越大越靠前）
    plot(x, y, z, ch, lum) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const i = y * this.cols + x;
      if (z > this.depth[i]) {
        this.depth[i] = z;
        this.chars[i] = ch;
        this.lum[i] = lum === undefined ? 1 : lum;
      }
    }
    // 在指定行列写入一段字符串
    text(x, y, str, lum) {
      for (let k = 0; k < str.length; k++) this.set(x + k, y, str[k], lum);
    }
    toString() {
      const { chars, cols, rows } = this;
      let out = "";
      for (let y = 0; y < rows; y++) {
        out += chars.slice(y * cols, y * cols + cols).join("") + "\n";
      }
      return out;
    }
  }

  /* ---------- 彩色渲染: 将帧缓冲转为带 <span> 的 HTML ---------- */
  // 仅在彩虹主题下使用（其它主题走纯文本, 性能更好）
  function toColorHTML(fb, frame) {
    const { chars, lum, cols, rows } = fb;
    let out = "";
    for (let y = 0; y < rows; y++) {
      let line = "";
      let run = "";
      let curHue = -999;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let ch = chars[i];
        if (ch === " ") {
          if (run) { line += wrap(run, curHue); run = ""; curHue = -999; }
          line += " ";
          continue;
        }
        // 色相随位置与时间流动
        const hue = Math.round((x * 3 + y * 6 + frame * 2 + lum[i] * 120) % 360 / 12) * 12;
        if (hue !== curHue) {
          if (run) line += wrap(run, curHue);
          run = ""; curHue = hue;
        }
        run += escapeHTML(ch);
      }
      if (run) line += wrap(run, curHue);
      out += line + "\n";
    }
    return out;

    function wrap(s, hue) {
      return '<span style="color:hsl(' + hue + ',100%,65%)">' + s + "</span>";
    }
  }

  function escapeHTML(ch) {
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === "&") return "&amp;";
    return ch;
  }

  /* ---------- 引擎主体 ---------- */
  class Engine {
    constructor(screenEl) {
      this.screen = screenEl;
      this.fb = new Framebuffer(80, 40);
      this.scenes = {};
      this.order = [];
      this.current = null;
      this.playing = true;
      this.speed = 1;
      this.scale = 1;
      this.rainbow = false;
      this.frame = 0;
      this.time = 0;           // 累计秒（受 speed 影响）
      this.lastTs = 0;
      this.fps = 0;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
      this._raf = null;
      this.onStats = null;      // 回调: 更新 HUD
      this._loop = this._loop.bind(this);
      this._measure();
    }

    /* 根据屏幕像素与字体估算列/行数 */
    _measure() {
      const cs = getComputedStyle(this.screen);
      const fontSize = parseFloat(cs.fontSize) || 11;
      // monospace 宽高比大约 0.6，行高 1.0
      const charW = fontSize * 0.6;
      const charH = fontSize * 1.0;
      const pad = 14 * 2;
      const w = this.screen.clientWidth - pad;
      const h = Math.max(this.screen.clientHeight - pad, 400);
      let cols = Math.max(20, Math.floor((w / charW) * this.scale));
      let rows = Math.max(12, Math.floor((h / charH) * this.scale));
      cols = Math.min(cols, 240);
      rows = Math.min(rows, 120);
      if (cols !== this.fb.cols || rows !== this.fb.rows) {
        this.fb.resize(cols, rows);
      }
    }

    register(scene) {
      this.scenes[scene.id] = scene;
      this.order.push(scene.id);
      return this;
    }

    select(id) {
      if (!this.scenes[id]) return;
      this.current = this.scenes[id];
      this.frame = 0;
      this.time = 0;
      if (typeof this.current.init === "function") {
        this.current.init(this.fb, this);
      }
      if (this.onSceneChange) this.onSceneChange(this.current);
    }

    next(dir) {
      const idx = this.order.indexOf(this.current ? this.current.id : this.order[0]);
      const ni = (idx + dir + this.order.length) % this.order.length;
      this.select(this.order[ni]);
    }

    setScale(pct) {
      this.scale = pct / 100;
      this._measure();
      if (this.current && this.current.init) this.current.init(this.fb, this);
    }

    play() { this.playing = true; }
    pause() { this.playing = false; }
    toggle() { this.playing = !this.playing; return this.playing; }

    start() {
      this.lastTs = performance.now();
      this._raf = requestAnimationFrame(this._loop);
    }

    step() {
      // 单帧步进（暂停时使用）
      this._render(1 / 60);
    }

    _loop(ts) {
      const dt = Math.min((ts - this.lastTs) / 1000, 0.1);
      this.lastTs = ts;

      // FPS 统计
      this._fpsAcc += dt;
      this._fpsFrames++;
      if (this._fpsAcc >= 0.5) {
        this.fps = Math.round(this._fpsFrames / this._fpsAcc);
        this._fpsAcc = 0; this._fpsFrames = 0;
      }

      if (this.playing) this._render(dt);
      this._raf = requestAnimationFrame(this._loop);
    }

    _render(dt) {
      if (!this.current) return;
      this.time += dt * this.speed;
      this.frame++;
      const fb = this.fb;
      fb.clear();
      this.current.render(fb, this.time, this.frame, this);
      this._paint();
      if (this.onStats) {
        this.onStats({
          fps: this.fps,
          cols: fb.cols, rows: fb.rows,
          frame: this.frame,
          scene: this.current.name,
        });
      }
    }

    _paint() {
      if (this.rainbow) {
        this.screen.innerHTML = toColorHTML(this.fb, this.frame);
      } else {
        this.screen.textContent = this.fb.toString();
      }
    }

    getFrameText() {
      return this.fb.toString();
    }
  }

  /* ---------- 数学小工具 ---------- */
  const M = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    // 将亮度映射到字符集
    rampChar(ramp, t) {
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const i = Math.min(ramp.length - 1, Math.floor(t * (ramp.length - 1) + 0.0001));
      return ramp[i];
    },
    // 便宜的值噪声
    hash(x, y) {
      let h = x * 374761393 + y * 668265263;
      h = (h ^ (h >> 13)) * 1274126177;
      return ((h ^ (h >> 16)) >>> 0) / 4294967295;
    },
  };

  global.ASCII = { Framebuffer, Engine, M, toColorHTML };
})(window);
