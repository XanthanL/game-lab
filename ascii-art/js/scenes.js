/* ============================================================
   scenes.js — 动画场景合集
   每个场景: { id, name, badge, init?, render(fb, time, frame, eng) }
   通过 eng.ramp 拿到当前字符集。
   ============================================================ */

(function (global) {
  "use strict";
  const { M } = global.ASCII;

  const scenes = [];

  /* ------------------------------------------------------------
     1) 甜甜圈 (Torus) — 经典 donut.c 的字符 3D 渲染
     ------------------------------------------------------------ */
  scenes.push({
    id: "donut",
    name: "旋转甜甜圈",
    badge: "3D",
    render(fb, t, frame, eng) {
      const ramp = " .,-~:;=!*#$@";
      const W = fb.cols, H = fb.rows;
      const A = t * 1.0, B = t * 0.5;
      const cosA = Math.cos(A), sinA = Math.sin(A);
      const cosB = Math.cos(B), sinB = Math.sin(B);
      const R1 = 1, R2 = 2, K2 = 5;
      const K1 = W * K2 * 3 / (8 * (R1 + R2));
      const aspect = 0.5; // 字符高宽比修正

      for (let theta = 0; theta < 6.283; theta += 0.10) {
        const ct = Math.cos(theta), st = Math.sin(theta);
        for (let phi = 0; phi < 6.283; phi += 0.03) {
          const cp = Math.cos(phi), sp = Math.sin(phi);
          const circleX = R2 + R1 * ct;
          const circleY = R1 * st;

          const x = circleX * (cosB * cp + sinA * sinB * sp) - circleY * cosA * sinB;
          const y = circleX * (sinB * cp - sinA * cosB * sp) + circleY * cosA * cosB;
          const z = K2 + cosA * circleX * sp + circleY * sinA;
          const ooz = 1 / z;

          const xp = (W / 2 + K1 * ooz * x) | 0;
          const yp = (H / 2 - K1 * ooz * y * aspect) | 0;

          // 光照
          const L = cp * ct * sinB - cosA * ct * sp - sinA * st +
                    cosB * (cosA * st - ct * sinA * sp);
          if (L > 0) {
            const lum = L * 0.7;
            const ch = M.rampChar(ramp, lum);
            fb.plot(xp, yp, ooz, ch, lum + 0.2);
          }
        }
      }
    },
  });

  /* ------------------------------------------------------------
     2) 3D 线框立方体 (Wireframe Cube) — Bresenham 连线
     ------------------------------------------------------------ */
  scenes.push({
    id: "cube",
    name: "线框立方体",
    badge: "3D",
    render(fb, t, frame, eng) {
      const W = fb.cols, H = fb.rows;
      const verts = [
        [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
        [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
      ];
      const edges = [
        [0,1],[1,2],[2,3],[3,0],
        [4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7],
      ];
      const ax = t * 0.7, ay = t * 0.9, az = t * 0.3;
      const cx = Math.cos(ax), sx = Math.sin(ax);
      const cy = Math.cos(ay), sy = Math.sin(ay);
      const cz = Math.cos(az), sz = Math.sin(az);
      const dist = 4, K1 = Math.min(W, H * 2) * 0.55;

      const proj = verts.map(([x, y, z]) => {
        // rotX
        let y1 = y * cx - z * sx, z1 = y * sx + z * cx;
        // rotY
        let x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
        // rotZ
        let x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz;
        const zc = z2 + dist;
        const ooz = 1 / zc;
        return {
          x: W / 2 + K1 * ooz * x3,
          y: H / 2 - K1 * 0.5 * ooz * y3,
          z: zc,
        };
      });

      const ramp = " .:-=+*#%@";
      for (const [a, b] of edges) {
        line(fb, proj[a], proj[b], ramp);
      }
      // 顶点高亮
      for (const p of proj) fb.plot(p.x, p.y, 1 / p.z + 1, "●", 1);
    },
  });

  function line(fb, p0, p1, ramp) {
    let x0 = Math.round(p0.x), y0 = Math.round(p0.y);
    const x1 = Math.round(p1.x), y1 = Math.round(p1.y);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let guard = 0;
    while (guard++ < 4000) {
      fb.plot(x0, y0, 2, "#", 0.9);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  /* ------------------------------------------------------------
     3) 矩阵数字雨 (Matrix Rain)
     ------------------------------------------------------------ */
  scenes.push({
    id: "matrix",
    name: "矩阵数字雨",
    badge: "FX",
    init(fb) {
      this.drops = [];
      for (let x = 0; x < fb.cols; x++) {
        this.drops[x] = {
          y: Math.random() * fb.rows,
          speed: 8 + Math.random() * 22,
          len: 6 + (Math.random() * 14 | 0),
        };
      }
      this._last = 0;
    },
    render(fb, t, frame, eng) {
      if (!this.drops || this.drops.length !== fb.cols) this.init(fb);
      const glyphs = "01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ日本ﾊﾋﾌﾍﾎ<>*/+=∴◇◆";
      const dt = t - this._last; this._last = t;
      for (let x = 0; x < fb.cols; x++) {
        const d = this.drops[x];
        d.y += d.speed * Math.min(dt, 0.05);
        if (d.y - d.len > fb.rows) {
          d.y = -Math.random() * 10;
          d.speed = 8 + Math.random() * 22;
          d.len = 6 + (Math.random() * 14 | 0);
        }
        const head = Math.floor(d.y);
        for (let k = 0; k < d.len; k++) {
          const yy = head - k;
          if (yy < 0 || yy >= fb.rows) continue;
          const g = glyphs[(x * 31 + yy * 17 + (frame >> 1)) % glyphs.length];
          const lum = k === 0 ? 1 : 1 - k / d.len;
          fb.plot(x, yy, lum, k === 0 ? g : g, lum);
        }
      }
    },
  });

  /* ------------------------------------------------------------
     4) 等离子体 (Plasma) — 多重正弦干涉
     ------------------------------------------------------------ */
  scenes.push({
    id: "plasma",
    name: "等离子场",
    badge: "FX",
    render(fb, t, frame, eng) {
      const ramp = eng.ramp || " .:-=+*#%@";
      const W = fb.cols, H = fb.rows;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v =
            Math.sin(x * 0.14 + t * 1.6) +
            Math.sin(y * 0.22 + t * 1.1) +
            Math.sin((x + y) * 0.10 + t) +
            Math.sin(Math.sqrt((x - W/2)**2 + (y - H/2)**2) * 0.18 - t * 2);
          const lum = (v + 4) / 8; // 0..1
          fb.set(x, y, M.rampChar(ramp, lum), lum);
        }
      }
    },
  });

  /* ------------------------------------------------------------
     5) 火焰 (Fire) — 经典 demoscene 火焰算法
     ------------------------------------------------------------ */
  scenes.push({
    id: "fire",
    name: "燃烧火焰",
    badge: "FX",
    init(fb) {
      this.buf = new Float32Array(fb.cols * fb.rows);
      this.W = fb.cols; this.H = fb.rows;
    },
    render(fb, t, frame, eng) {
      const W = fb.cols, H = fb.rows;
      if (!this.buf || this.W !== W || this.H !== H) this.init(fb);
      const buf = this.buf;
      // 底部随机点燃
      for (let x = 0; x < W; x++) {
        buf[(H - 1) * W + x] = Math.random() < 0.75 ? 1 : 0.2;
      }
      // 向上传播
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
          const below = (y + 1) * W + x;
          const l = (y + 1) * W + Math.max(0, x - 1);
          const r = (y + 1) * W + Math.min(W - 1, x + 1);
          const decay = 0.86 + Math.random() * 0.09;
          const v = (buf[below] + buf[l] + buf[r] + buf[Math.min(H-1,y+2)*W+x]) / 4 * decay;
          buf[y * W + x] = v;
        }
      }
      const ramp = " .:-=+*#%@";
      for (let i = 0; i < W * H; i++) {
        const v = buf[i];
        fb.chars[i] = M.rampChar(ramp, v);
        fb.lum[i] = v;
      }
    },
  });

  /* ------------------------------------------------------------
     6) 星空隧道 (Starfield Tunnel)
     ------------------------------------------------------------ */
  scenes.push({
    id: "tunnel",
    name: "超空间隧道",
    badge: "3D",
    init(fb) {
      this.stars = [];
      for (let i = 0; i < 400; i++) this.stars.push(this._spawn());
    },
    _spawn() {
      const a = Math.random() * Math.PI * 2;
      return { a, r: Math.random() * 0.5 + 0.05, z: Math.random() * 1 + 0.1 };
    },
    render(fb, t, frame, eng) {
      if (!this.stars) this.init(fb);
      const W = fb.cols, H = fb.rows;
      const chars = ".,:;+*oO0@";
      for (const s of this.stars) {
        s.z -= 0.012 * (eng.speed);
        s.a += 0.01;
        if (s.z <= 0.02) { Object.assign(s, this._spawn()); s.z = 1; }
        const k = 1 / s.z;
        const x = W / 2 + Math.cos(s.a) * s.r * k * W * 0.5;
        const y = H / 2 + Math.sin(s.a) * s.r * k * H * 0.5;
        const lum = M.clamp(1 - s.z, 0, 1);
        const ch = chars[Math.min(chars.length - 1, Math.floor(lum * chars.length))];
        fb.plot(x, y, k, ch, lum);
      }
    },
  });

  /* ------------------------------------------------------------
     7) 波纹 / 水面 (Ripple Field)
     ------------------------------------------------------------ */
  scenes.push({
    id: "ripple",
    name: "涟漪水面",
    badge: "FX",
    render(fb, t, frame, eng) {
      const ramp = eng.ramp || " .:-=+*#%@";
      const W = fb.cols, H = fb.rows;
      const sources = [
        [W * 0.3, H * 0.4, t * 2.0],
        [W * 0.7, H * 0.6, t * 1.5],
        [W * 0.5, H * 0.2, t * 2.4],
      ];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let v = 0;
          for (const [sx, sy, ph] of sources) {
            const d = Math.sqrt(((x - sx) * 0.5) ** 2 + (y - sy) ** 2);
            v += Math.sin(d * 0.5 - ph);
          }
          const lum = (v / sources.length + 1) / 2;
          fb.set(x, y, M.rampChar(ramp, lum), lum);
        }
      }
    },
  });

  /* ------------------------------------------------------------
     8) 生命游戏 (Conway's Game of Life)
     ------------------------------------------------------------ */
  scenes.push({
    id: "life",
    name: "生命游戏",
    badge: "SIM",
    init(fb) {
      this.W = fb.cols; this.H = fb.rows;
      this.grid = new Uint8Array(fb.cols * fb.rows);
      for (let i = 0; i < this.grid.length; i++) this.grid[i] = Math.random() < 0.22 ? 1 : 0;
      this.acc = 0;
    },
    render(fb, t, frame, eng) {
      const W = fb.cols, H = fb.rows;
      if (!this.grid || this.W !== W || this.H !== H) this.init(fb);
      this.acc = (this.acc || 0) + 1;
      // 控制演化速度：每若干帧演化一次
      if (this.acc >= Math.max(1, 6 - eng.speed * 2)) {
        this.acc = 0;
        const g = this.grid, ng = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let n = 0;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
                n += g[ny * W + nx];
              }
            const alive = g[y * W + x];
            ng[y * W + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          }
        }
        // 偶尔注入随机火花，避免趋于静止
        if (Math.random() < 0.05) {
          const rx = (Math.random() * W) | 0, ry = (Math.random() * H) | 0;
          for (let k = 0; k < 6; k++) ng[((ry + k) % H) * W + (rx + k) % W] = 1;
        }
        this.grid = ng;
      }
      const g = this.grid;
      for (let i = 0; i < W * H; i++) {
        if (g[i]) { fb.chars[i] = "█"; fb.lum[i] = 1; }
      }
    },
  });

  /* ------------------------------------------------------------
     9) 3D 旋转球体 (Sphere with lighting)
     ------------------------------------------------------------ */
  scenes.push({
    id: "sphere",
    name: "发光球体",
    badge: "3D",
    render(fb, t, frame, eng) {
      const ramp = " .:!*oe&#%@";
      const W = fb.cols, H = fb.rows;
      const R = Math.min(W / 2, H) * 0.72;
      const cx = W / 2, cy = H / 2;
      const lx = Math.cos(t), ly = Math.sin(t * 0.7), lz = 0.6;
      const ll = Math.hypot(lx, ly, lz);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = (x - cx) / R;
          const ny = (y - cy) / (R * 0.5); // 高宽比
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          // 光照点积
          let L = (nx * lx + ny * ly + nz * lz) / ll;
          L = M.clamp(L, 0, 1);
          const lum = L * L;
          fb.plot(x, y, nz, M.rampChar(ramp, lum), lum);
        }
      }
    },
  });

  /* ------------------------------------------------------------
     10) 曼德博集合 缩放巡游 (Mandelbrot Zoom)
     ------------------------------------------------------------ */
  scenes.push({
    id: "mandel",
    name: "曼德博集合",
    badge: "MATH",
    render(fb, t, frame, eng) {
      const ramp = " .:-=+*#%@";
      const W = fb.cols, H = fb.rows;
      const zoom = 2.6 / (1 + t * 0.15);
      const cx0 = -0.743643887, cy0 = 0.131825904; // 经典缩放点
      const maxIt = 60;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const a0 = cx0 + (x / W - 0.5) * zoom * 2;
          const b0 = cy0 + (y / H - 0.5) * zoom;
          let a = 0, b = 0, it = 0;
          while (a * a + b * b <= 4 && it < maxIt) {
            const a2 = a * a - b * b + a0;
            b = 2 * a * b + b0;
            a = a2; it++;
          }
          const lum = it >= maxIt ? 0 : it / maxIt;
          fb.set(x, y, M.rampChar(ramp, lum), lum);
        }
      }
    },
  });

  global.ASCII_SCENES = scenes;
})(window);
