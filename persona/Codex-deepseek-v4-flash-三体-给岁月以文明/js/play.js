/* play.js — 演出系统：舞台调度、双屏渲染、特效、输入、剧本阅读器 */
'use strict';

(function () {
  const { W, H, TAU, C, clamp, rect, stars, dither, glowOrb, drawText, panel, scanlines } = PIX;

  const topC = document.getElementById('screen-top');
  const botC = document.getElementById('screen-bottom');
  const topG = topC.getContext('2d');
  const botG = botC.getContext('2d');
  topG.imageSmoothingEnabled = false;
  botG.imageSmoothingEnabled = false;

  const state = {
    mode: 'title',          // title | play | script
    prevMode: 'title',
    scene: 0,
    selScene: 0,
    cue: 0,
    auto: true,
    paused: false,
    hold: 0,
    holdText: false,
    pendingFade: false,
    text: null,
    actors: {},
    bg: 'title',
    fx: [],
    overlay: null,
    toast: null,
    scriptSel: 0,
    scriptTop: 0,
    time: 0,
    clock: 0
  };

  /* ---------------- 三体问题模拟（三颗太阳） ---------------- */
  const triBody = {
    b: [
      { x: 72,  y: 52,  vx: 0.20,  vy: -0.08, m: 1.25, c: '#ff4020', r: 15 },
      { x: 150, y: 76,  vx: -0.22, vy: 0.18,  m: 1.05, c: '#f0a028', r: 13 },
      { x: 116, y: 108, vx: 0.12,  vy: -0.12, m: 0.95, c: '#ffe080', r: 11 }
    ],
    flash: 0
  };

  function triStep(dt) {
    const b = triBody.b, G = 170;
    for (let i = 0; i < b.length; i++) {
      let ax = 0, ay = 0;
      for (let j = 0; j < b.length; j++) {
        if (i === j) continue;
        const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y;
        const r = Math.max(10, Math.hypot(dx, dy));
        const f = G * b[j].m / (r * r * r);
        ax += f * dx; ay += f * dy;
      }
      b[i].vx += ax * dt; b[i].vy += ay * dt;
    }
    let md = 1e9;
    for (const p of b) {
      p.vx *= (1 - dt * 0.03); p.vy *= (1 - dt * 0.03);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 22) { p.x = 22; p.vx = Math.abs(p.vx) * 0.8; }
      if (p.x > 234) { p.x = 234; p.vx = -Math.abs(p.vx) * 0.8; }
      if (p.y < 26) { p.y = 26; p.vy = Math.abs(p.vy) * 0.8; }
      if (p.y > 148) { p.y = 148; p.vy = -Math.abs(p.vy) * 0.8; }
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      md = Math.min(md, Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y));
    }
    if (md < 26) triBody.flash = 1;
    triBody.flash = Math.max(0, triBody.flash - dt * 0.8);
  }

  function triShape(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w / 2, y - h);
    g.lineTo(x + w, y);
    g.closePath();
    g.fill();
  }

  /* ---------------- 背景生成器 ---------------- */
  const BG = {};

  BG.title = (g, t) => {
    g.fillStyle = '#050510'; g.fillRect(0, 0, W, H);
    stars(g, t, 90);
    const suns = [['#ff4020', 34], ['#f0a028', 46], ['#ffe080', 60]];
    suns.forEach((s, i) => {
      const x = 128 + Math.sin(t * 0.42 + i * 2.1) * 96;
      const y = 96 + Math.cos(t * 0.34 + i * 1.7) * 58;
      glowOrb(g, x, y, s[1], s[0], 0.5);
      g.fillStyle = s[0];
      g.beginPath(); g.arc(x, y, s[1] * 0.55, 0, TAU); g.fill();
    });
  };

  BG.redcoast = (g, t) => {
    g.fillStyle = '#060a16'; g.fillRect(0, 0, W, H);
    stars(g, t, 70);
    // 山脊与森林剪影
    for (let x = 0; x < W; x += 8) {
      const h = 20 + ((x * 53) % 16);
      rect(g, x, 122 - h, 8, h + 8, '#0b1220');
    }
    for (let x = 0; x < W; x += 14) triShape(g, x, 140, 14, 26, '#0a101c');
    rect(g, 0, 132, W, 60, '#080d16');
    // 红岸天线
    g.strokeStyle = '#1f2a38';
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.arc(150, 104, 30 + i * 4, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    }
    g.fillStyle = '#2a3748'; g.fillRect(150, 92, 2, 14);
    if (Math.sin(t * 3.2) > -0.3) {
      g.fillStyle = '#ff4030'; g.fillRect(148, 88, 5, 5);
      glowOrb(g, 150, 90, 8, '#ff4030', 0.5);
    }
    // 控制室
    rect(g, 186, 126, 36, 26, '#10161f');
    rect(g, 192, 130, 8, 6, '#ffb050');
    rect(g, 204, 130, 8, 6, '#ffb050');
    rect(g, 192, 140, 22, 4, '#1a2330');
    if (Math.sin(t * 2.1) > 0) rect(g, 220, 133, 2, 4, '#ffb050');
  };

  BG.trisolaris = (g, t) => {
    triStep(0.5);
    g.fillStyle = '#160a12'; g.fillRect(0, 0, W, H);
    // 沙丘
    for (let y = 124; y < H; y++) {
      const shade = (y + Math.floor(Math.sin(y * 0.4 + t * 0.6) * 8)) % 2;
      g.fillStyle = shade ? '#3a2a18' : '#4a3820';
      g.fillRect(0, y, W, 1);
    }
    // 废墟
    rect(g, 18, 118, 14, 22, '#241811');
    rect(g, 24, 112, 10, 28, '#241811');
    rect(g, 222, 120, 16, 20, '#241811');
    rect(g, 228, 114, 10, 26, '#241811');
    // 脱水者
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 48, y = 136 + (i % 2) * 10;
      rect(g, x, y, 12, 3, '#8a6a3a');
      rect(g, x, y + 3, 12, 1, '#6a4a28');
      rect(g, x + 5, y - 5, 3, 5, '#7a5a30');
    }
    // 三颗太阳（实时三体运动）
    for (const p of triBody.b) {
      glowOrb(g, p.x, p.y, p.r * 2.1, p.c, 0.5);
      g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x, p.y, p.r * 0.62, 0, TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.22, 0, TAU); g.fill();
    }
    if (triBody.flash > 0) {
      g.globalAlpha = triBody.flash * 0.35;
      g.fillStyle = '#ff4020'; g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  };

  BG.sophon = (g, t) => {
    g.fillStyle = '#05070f'; g.fillRect(0, 0, W, H);
    stars(g, t, 80);
    const cx = 128, cy = 84;
    const R = 62 + 4 * Math.sin(t * 1.1);
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = 'rgba(70,220,210,' + (0.65 - i * 0.08) + ')';
      g.beginPath(); g.arc(cx, cy, R * (0.45 + i * 0.12), 0, TAU); g.stroke();
    }
    g.save(); g.translate(cx, cy); g.rotate(t * 0.22);
    g.strokeStyle = 'rgba(120,240,230,0.45)';
    for (let i = -4; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 12, -R * 0.9); g.lineTo(i * 12, R * 0.9); g.stroke();
      g.beginPath(); g.moveTo(-R * 0.9, i * 12); g.lineTo(R * 0.9, i * 12); g.stroke();
    }
    g.restore();
    glowOrb(g, cx, cy, 10, '#d0fff8', 0.7);
    g.fillStyle = '#eafff8'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill();
    // 折叠的智子细丝
    g.strokeStyle = 'rgba(200,255,245,0.5)';
    g.beginPath();
    g.moveTo(20, 162 + Math.sin(t * 3) * 4);
    g.quadraticCurveTo(70, 140 + Math.cos(t * 2) * 6, 120, 164 + Math.sin(t * 2.4) * 5);
    g.stroke();
  };

  BG.canal = (g, t) => {
    g.fillStyle = '#05070f'; g.fillRect(0, 0, W, H);
    stars(g, t, 60);
    for (let x = 0; x < W; x += 8) {
      const h = 14 + ((x * 53) % 12);
      rect(g, x, 124 - h, 8, h + 6, '#0a111e');
    }
    rect(g, 0, 128, W, 64, '#03050c');
    for (let i = 0; i < 26; i++) {
      const x = ((i * 37 + t * 18) % 260) - 2;
      const y = 134 + ((i * 11) % 54);
      g.fillStyle = 'rgba(120,160,220,' + (0.12 + 0.1 * Math.sin(t * 2 + i)) + ')';
      g.fillRect(x, y, 4 + (i % 3) * 3, 1);
    }
    // 吊桥
    rect(g, 120, 92, 5, 56, '#11161f');
    rect(g, 134, 92, 5, 56, '#11161f');
    rect(g, 112, 88, 36, 4, '#11161f');
    // 纳米丝
    g.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.4 * Math.sin(t * 4)) + ')';
    g.fillRect(0, 132, W, 1);
    // 审判日号
    const sx = ((t * 16) % 340) - 50;
    rect(g, sx, 116, 46, 16, '#0d111a');
    rect(g, sx + 34, 108, 8, 14, '#0d111a');
    rect(g, sx + 6, 112, 6, 20, '#0a0e16');
    rect(g, sx + 24, 112, 6, 22, '#0a0e16');
    g.fillStyle = '#ff4030'; g.fillRect(sx + 2, 118, 1, 1);
    g.fillStyle = '#40ff60'; g.fillRect(sx + 43, 118, 1, 1);
  };

  BG.deterrence = (g, t) => {
    g.fillStyle = '#080a10'; g.fillRect(0, 0, W, H);
    rect(g, 0, 0, W, 20, '#0d1018');
    rect(g, 0, 148, W, 44, '#0d1018');
    rect(g, 0, 146, W, 3, '#141926');
    panel(g, 46, 34, 164, 86, '#05070d', '#2a3140');
    rect(g, 52, 40, 152, 74, '#0a1220');
    drawText(g, 'DETERRENT SYSTEM', 128, 48, { size: 9, align: 'center', color: '#ff6040', shadow: false });
    drawText(g, 'GRAVITY WAVE: STANDBY', 128, 66, { size: 8, align: 'center', color: '#7ab8f0', shadow: false });
    drawText(g, '00:00:00', 128, 86, { size: 14, align: 'center', color: '#ff4030', shadow: false });
    if (Math.floor(t * 2) % 2 === 0) rect(g, 58, 106, 4, 4, '#ff4030');
    for (let i = 0; i < 6; i++) {
      const x = 34 + i * 34;
      panel(g, x, 132, 26, 12, '#0f131c', '#262c38');
      const on = ((i * 7 + Math.floor(t * 1.5)) % 3) !== 0;
      rect(g, x + 4, 136, 2, 2, on ? '#40ff80' : '#406040');
    }
  };

  BG.snow = (g, t) => {
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    stars(g, t, 50);
    triShape(g, 60, 150, 90, 70, '#dfe8f0');
    triShape(g, 160, 150, 130, 55, '#b8c8d8');
    triShape(g, 0, 150, 70, 40, '#c8d8e8');
    triShape(g, 220, 150, 70, 48, '#c0d0e0');
    rect(g, 0, 150, W, 42, '#e8eef4');
    for (let y = 152; y < 192; y += 3) {
      g.fillStyle = (y % 6 === 0) ? '#d8e2ec' : '#eef4f8';
      g.fillRect(0, y, W, 1);
    }
    for (let i = 0; i < 7; i++) {
      const x = 18 + i * 36;
      rect(g, x, 132, 1, 20, '#9aa0a8');
      rect(g, x + 1, 132, 6, 4, '#e0342e');
    }
    for (let i = 0; i < 24; i++) {
      const x = (i * 47 + t * (4 + i % 5)) % 256;
      const y = (i * 31 + t * 3) % 140;
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
  };

  BG.fleet = (g, t) => {
    g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
    stars(g, t, 90);
    for (let i = 0; i < 60; i++) {
      const x = (i * 71 + 10) % W, y = 30 + ((i * 37) % 90);
      g.fillStyle = 'rgba(80,90,180,' + (0.05 + 0.03 * Math.sin(t + i)) + ')';
      g.fillRect(x, y, 3, 1);
    }
    glowOrb(g, 210, 42, 9, '#ffd8a0', 0.5);
    g.fillStyle = '#fff0d8'; g.fillRect(209, 41, 3, 3);
    for (let i = 0; i < 70; i++) {
      const x = (i * 29 + 8) % 240 + 8;
      const y = 46 + ((i * 17) % 96);
      const blink = Math.sin(t * 3 + i * 1.7) > -0.2;
      g.fillStyle = blink ? '#9ab0c8' : '#5a6a80';
      g.fillRect(Math.floor(x), Math.floor(y), 3, 2);
      if (blink) { g.fillStyle = '#304060'; g.fillRect(Math.floor(x), Math.floor(y + 2), 2, 1); }
    }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      g.fillStyle = '#ff4030';
      g.fillRect(Math.floor(210 + Math.cos(a) * 13), Math.floor(42 + Math.sin(a) * 6), 1, 1);
    }
  };

  BG.earth = (g, t) => {
    g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
    stars(g, t, 70);
    const cx = 128, cy = 96, R = 46;
    glowOrb(g, cx, cy, R + 10, '#7ab8f0', 0.28);
    g.fillStyle = '#163a7a'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    for (let i = 0; i < 26; i++) {
      const a = i * 1.7, rr = R * (0.35 + ((i * 37) % 40) / 100);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.9;
      g.fillStyle = '#2f7a3a';
      g.fillRect(Math.floor(x), Math.floor(y), 3, 2);
      g.fillRect(Math.floor(x) + 1, Math.floor(y) - 1, 2, 1);
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8 + t * 0.05, rr = R * 0.55;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(Math.floor(x) - 2, Math.floor(y), 5, 2);
    }
    g.fillStyle = 'rgba(180,220,255,0.18)';
    g.beginPath(); g.arc(cx - 14, cy - 16, 22, 0, TAU); g.fill();
  };

  BG.solarflat = (g, t) => {
    g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
    stars(g, t, 60);
    const cx = 128, cy = 58, R = 30;
    glowOrb(g, cx, cy, R + 8, '#7ab8f0', 0.25);
    g.fillStyle = '#163a7a'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    for (let i = 0; i < 12; i++) {
      const a = i * 2.1, rr = R * (0.4 + ((i * 23) % 30) / 100);
      g.fillStyle = '#2f7a3a';
      g.fillRect(Math.floor(cx + Math.cos(a) * rr), Math.floor(cy + Math.sin(a) * rr * 0.9), 2, 2);
    }
    rect(g, 0, 96, W, 96, '#150b0e');
    g.strokeStyle = 'rgba(255,120,80,0.35)';
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.arc(128, 140 + i * 4, 26 + i * 16, 0, TAU); g.stroke();
    }
    g.fillStyle = '#ffe8b0'; g.fillRect(0, 94, W, 2);
  };

  BG.starship = (g, t) => {
    g.fillStyle = '#02030a'; g.fillRect(0, 0, W, H);
    stars(g, t, 70, { twinkle: false });
    for (let i = 0; i < 30; i++) {
      const x = ((i * 83 + 20) - t * (6 + (i % 5) * 3)) % 270 - 7;
      const y = (i * 29 + 40) % 160 + 10;
      g.fillStyle = 'rgba(200,220,255,' + (0.3 + 0.3 * Math.sin(i + t * 2)) + ')';
      g.fillRect(Math.floor(x), Math.floor(y), 2, 1);
    }
    glowOrb(g, 214, 58, 10, '#c0a080', 0.3);
    g.fillStyle = '#8a6a4a'; g.beginPath(); g.arc(214, 58, 6, 0, TAU); g.fill();
    const shx = 56, shy = 128;
    rect(g, shx, shy, 24, 5, '#c8d0d8');
    rect(g, shx + 4, shy - 4, 14, 4, '#c8d0d8');
    rect(g, shx - 3, shy + 3, 6, 2, '#8a94a0');
    rect(g, shx + 22, shy + 3, 6, 2, '#8a94a0');
    const fl = 3 + Math.floor(Math.sin(t * 14) * 2);
    rect(g, shx - 3 - fl, shy + 1, fl, 2, '#40b8ff');
    rect(g, shx - 8 - fl, shy, fl + 4, 4, 'rgba(120,220,255,0.35)');
  };

  BG.credits = (g, t) => {
    g.fillStyle = '#05060d'; g.fillRect(0, 0, W, H);
    stars(g, t, 80);
    drawText(g, '— 谢 幕 —', 128, 16, { size: 16, align: 'center', color: '#ffd25a' });
    drawText(g, '愿每一个文明，都被温柔以待', 128, 92, { size: 10, align: 'center', color: '#9aa8b8' });
    const cast = ['ye', 'monk', 'wang', 'shen', 'chang', 'luoji', 'po', 'cheng', 'tri', 'zero'];
    cast.forEach((id, i) => {
      const fig = figFor(id);
      const x = ((t * 24 + i * 40) % (W + 80)) - 40;
      const y = i % 2 ? 112 : 148;
      const fr = Math.floor(t * 2.6 + i) % 2;
      PIX.drawSprite(g, fr ? fig.f1 : fig.f0, x, y, true);
    });
  };

  /* ---------------- 特效 ---------------- */
  const FX = {
    wave(g, f) {
      const p = f.age / f.dur;
      const cx = f.cx || 128, cy = f.cy || 96;
      for (let i = 0; i < 5; i++) {
        const r = 26 + p * 150 + i * 28;
        if (r > 210) continue;
        g.strokeStyle = 'rgba(120,200,255,' + (0.55 * (1 - p)) + ')';
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      }
    },
    static(g, f) {
      dither(g, 0.3 * (1 - f.age / f.dur), 0.25, '#cfe0ff');
    },
    flicker(g) {
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.6) {
          const x = Math.random() * 180, y = 18 + Math.random() * 62;
          const w = 20 + Math.random() * 50, h = 10 + Math.random() * 28;
          g.fillStyle = 'rgba(190,220,255,' + (0.08 + Math.random() * 0.24) + ')';
          g.fillRect(x, y, w, h);
        }
      }
      if (Math.random() < 0.28) {
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(0, 18, W, 54);
      }
    },
    unfold(g, f) {
      const p = f.age / f.dur;
      const r = 10 + p * 120, cx = 128, cy = 84;
      g.strokeStyle = 'rgba(70,220,210,' + (1 - p) + ')';
      for (let i = 0; i < 5; i++) {
        g.beginPath(); g.arc(cx, cy, r * (0.5 + 0.12 * i), 0, TAU); g.stroke();
      }
      g.save(); g.translate(cx, cy); g.rotate(f.age * 0.5);
      g.strokeStyle = 'rgba(140,240,230,' + (1 - p) + ')';
      const n = Math.floor(6 * p) + 1;
      for (let i = 0; i <= n; i++) {
        const v = -r + (2 * r) * i / n;
        g.beginPath(); g.moveTo(v, -r); g.lineTo(v, r); g.stroke();
        g.beginPath(); g.moveTo(-r, v); g.lineTo(r, v); g.stroke();
      }
      g.restore();
      glowOrb(g, cx, cy, 12 * p + 2, '#d0fff8', 0.9);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 2 + 3 * p, 0, TAU); g.fill();
    },
    droplet(g, f) {
      const p = f.age / f.dur;
      const x = 300 - p * 580, y = 62 + Math.sin(f.age * 22) * 10;
      const grd = g.createLinearGradient(x - 70, 0, x, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(255,255,255,0.85)');
      g.fillStyle = grd; g.fillRect(x - 70, y - 2, 70, 5);
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, 6, 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#d0f8ff'; g.beginPath(); g.arc(x - 3, y - 1, 1.5, 0, TAU); g.fill();
      if (p > 0.62) {
        if (Math.floor(f.age * 30) % 3 === 0) {
          g.fillStyle = 'rgba(255,130,60,0.8)';
          g.fillRect(16 + Math.random() * 180, 38 + Math.random() * 74, 4 + Math.random() * 8, 2);
        }
        if (p > 0.82 && Math.floor(f.age * 8) % 2 === 0) {
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, W, H);
        }
      }
    },
    cut(g, f) {
      const p = f.age / f.dur;
      if (p < 0.5) {
        g.fillStyle = 'rgba(255,255,255,' + (0.75 + 0.25 * Math.sin(f.age * 18)) + ')';
        g.fillRect(0, 132, W, 1);
      } else {
        const off = (p - 0.5) * 26;
        rect(g, 36 - off, 110, 92, 22, '#0d111a');
        rect(g, 122 + off, 110, 92, 22, '#0d111a');
        rect(g, 124 + off, 104, 8, 12, '#0d111a');
        if (Math.floor(f.age * 24) % 2 === 0) {
          g.fillStyle = 'rgba(255,200,120,0.8)';
          g.fillRect(116 + off * 0.4, 128, 24, 1);
        }
        g.fillStyle = 'rgba(255,120,60,0.5)';
        g.fillRect(100, 126, 56, 2);
      }
    },
    broadcast(g, f) {
      const p = f.age / f.dur;
      for (let i = 0; i < 6; i++) {
        const rr = 12 + p * 160 + i * 24;
        if (rr > 220) continue;
        g.strokeStyle = 'rgba(120,220,255,' + (0.65 * (1 - p)) + ')';
        g.beginPath(); g.arc(128, 96, rr, 0, TAU); g.stroke();
      }
      if (p > 0.6) {
        g.fillStyle = 'rgba(200,240,255,' + (0.2 * Math.sin(f.age * 6)) + ')';
        g.fillRect(0, 0, W, H);
      }
    },
    countdown(g, f) {
      const s = Math.max(0, Math.floor(1100 - f.age * 260));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      drawText(g, mm + ':' + ss, 168, 56, { size: 26, color: '#ff4030', shadow: false });
      drawText(g, 'DETERRENT', 170, 92, { size: 9, color: '#ff8060', shadow: false });
      drawText(g, 'GRAVITY WAVE', 170, 104, { size: 9, color: '#ff8060', shadow: false });
      drawText(g, 'ARMED', 170, 116, { size: 9, color: '#ff8060', shadow: false });
    },
    flatten(g, f) {
      const p = f.age / f.dur;
      const y = p * H;
      rect(g, 0, y, W, H - y, '#160c10');
      g.strokeStyle = 'rgba(255,120,80,0.55)';
      for (let i = 0; i < 8; i++) {
        g.beginPath(); g.arc(128, y + 40 + i * 12, 30 + i * 10, 0, TAU); g.stroke();
      }
      for (let i = 0; i < 70; i++) {
        g.fillStyle = 'rgba(255,150,100,' + (Math.random() * 0.32) + ')';
        g.fillRect((i * 47 + 13) % W, y + ((i * 31) % (H - y || 1)), 1, 1);
      }
      g.fillStyle = '#ffe8b0'; g.fillRect(0, y - 2, W, 3);
      g.fillStyle = 'rgba(255,232,176,0.35)'; g.fillRect(0, y - 9, W, 8);
    },
    flash(g, f) {
      const a = Math.sin(Math.PI * clamp(f.age / f.dur, 0, 1));
      g.fillStyle = f.col || '#ff4020';
      g.globalAlpha = a * 0.85;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    },
    shake() { /* 抖动由绘制背景时的偏移实现 */ }
  };

  /* ---------------- 角色 ---------------- */
  function figFor(who) {
    const opts = {
      ye:    { coat: '#6a5a3a', coatLt: '#7d6b48', hair: '#241a10', scarf: true, pants: '#3a3226' },
      monk:  { coat: '#1e5a50', coatLt: '#2a7264', skin: '#a8e0cc', hair: '#1e5a50', alien: true, pants: '#18302a' },
      wang:  { coat: '#3a6aa8', coatLt: '#4a7ab8', hair: '#1c1c22', glasses: true },
      shen:  { coat: '#7a4a9a', coatLt: '#8a5aaa', hair: '#201428', pony: true },
      chang: { coat: '#4a5058', coatLt: '#5a626c', hair: '#8a8a90', mili: true },
      luoji: { coat: '#2f6a4a', coatLt: '#3f7a5a', hair: '#201a12' },
      po:    { coat: '#2a2a36', coatLt: '#383846', hair: '#15151d', hood: true },
      cheng: { coat: '#d8d0c0', coatLt: '#e8e0d0', hair: '#3a2a1a', pony: true, pants: '#5a5258' },
      tri:   { coat: '#6a3a2a', coatLt: '#7a4a36', skin: '#e0b890', alien: true },
      zero:  { coat: '#101020', coatLt: '#181830', void: true }
    }[who] || {};
    return PIX.figure(opts);
  }

  const portCache = {};
  function portraitFor(who, style) {
    const key = who + '|' + (style || '');
    if (portCache[key]) return portCache[key];
    const base = {
      ye:    { hairStyle: 'short', hair: '#3a2a18' },
      monk:  { hairStyle: 'alien', skin: '#a8e0cc' },
      wang:  { hairStyle: 'short', hair: '#1c1c22', glasses: true },
      shen:  { hairStyle: 'pony', hair: '#201428' },
      chang: { hairStyle: 'mili', hair: '#9a9aa0' },
      luoji: { hairStyle: 'flat', hair: '#201a12' },
      po:    { hairStyle: 'hood' },
      cheng: { hairStyle: 'pony', hair: '#3a2a1a' },
      tri:   { hairStyle: 'alien', skin: '#e0b890' },
      zero:  { hairStyle: 'void' }
    }[who] || {};
    if (style === 'scarf') base.hairStyle = 'scarf';
    if (style === 'long') { base.hairStyle = 'long'; base.wrinkles = true; base.hair = '#cfc8bc'; }
    if (style === 'flat') base.hairStyle = 'flat';
    const img = PIX.portrait(base);
    portCache[key] = img;
    return img;
  }

  /* ---------------- 剧本 → 演出 ---------------- */
  function setText(who, text, color, port) {
    state.text = { who, text, color, port, pos: 0, full: text.length, done: false };
  }

  function holdFor(text) {
    return Math.min(9000, 1300 + text.length * 90);
  }

  function runCue(c) {
    state.holdText = (c.k === 'nar' || c.k === 'dir' || c.k === 'line');
    switch (c.k) {
      case 'title':
        state.overlay = { k: 'title', text: c.text, sub: c.sub || '', t0: state.clock, dur: (c.dur || 2600) / 1000 };
        return c.dur || 2600;
      case 'nar':
        setText('nar', c.text, '#e8b84a', null);
        return holdFor(c.text);
      case 'dir':
        setText('dir', c.text, '#8a9098', null);
        return holdFor(c.text);
      case 'line': {
        const ch = PLAY.characters[c.who];
        setText(c.who, c.text, ch.color, c.port || null);
        return holdFor(c.text);
      }
      case 'enter': {
        const who = c.who;
        const dir = c.dir || (c.x < 128 ? 1 : -1);
        state.actors[who] = {
          who, x: dir === 1 ? -24 : W + 8, tx: c.x, y: 150, dir, fig: figFor(who)
        };
        return 650;
      }
      case 'exit':
        delete state.actors[c.who];
        return 400;
      case 'move': {
        const a = state.actors[c.who];
        if (a) { a.tx = c.x; a.dir = c.x < a.x ? -1 : 1; }
        return c.dur || 1000;
      }
      case 'bg':
        state.bg = c.id;
        return 200;
      case 'bgm':
        PIX.playBGM(c.id);
        return 120;
      case 'fx':
        state.fx.push({ id: c.id, t0: state.time, dur: (c.dur || 2000) / 1000, cx: c.cx, cy: c.cy, col: c.col });
        if (c.sfx) PIX.SFX[c.sfx]();
        return c.dur || 2000;
      case 'sfx':
        PIX.SFX[c.sfx]();
        return c.t || 700;
      case 'fade':
        state.overlay = { k: 'fade', out: !!c.out, t0: state.clock, dur: (c.t || 800) / 1000 };
        return c.t || 800;
      case 'wait':
        return c.t || 1000;
      case 'end':
        state.overlay = { k: 'end', t0: state.clock };
        PIX.stopBGM();
        return 0;
    }
    return 0;
  }

  function advance() {
    if (state.mode !== 'play') return;
    const sc = PLAY.scenes[state.scene];
    const c = sc.cues[state.cue];
    if (!c) {
      if (state.scene < PLAY.scenes.length - 1) {
        state.scene++;
        state.cue = 0;
        state.pendingFade = true;
        state.hold = 900;
        state.holdText = false;
        state.overlay = { k: 'fade', out: true, t0: state.clock, dur: 0.9 };
      }
      return;
    }
    state.cue++;
    const hold = runCue(c);
    state.hold = hold || 0;
  }

  function beginScene() {
    const sc = PLAY.scenes[state.scene];
    state.cue = 0;
    state.pendingFade = false;
    state.text = null;
    state.fx = [];
    state.overlay = null;
    state.hold = 0;
    state.holdText = false;
    state.actors = {};
    state.bg = sc.bg;
    PIX.playBGM(sc.bgm);
    if (sc.cues.length) {
      const first = sc.cues[0];
      state.cue = 1;
      const hold = runCue(first);
      state.hold = hold || 0;
    }
  }

  function jumpScene(d) {
    if (state.mode !== 'play') return;
    state.scene = clamp(state.scene + d, 0, PLAY.scenes.length - 1);
    beginScene();
    const sc = PLAY.scenes[state.scene];
    state.toast = { text: sc.act + ' · ' + sc.title, t0: state.time };
    PIX.SFX.blip();
  }

  /* ---------------- 剧本阅读器（剧本即演出，可跳转排练） ---------------- */
  function buildScript() {
    const lines = [], map = [];
    PLAY.scenes.forEach((sc, si) => {
      lines.push('【' + sc.act + ' · ' + sc.no + ' · ' + sc.title + '】');
      map.push({ scene: si, cue: -1 });
      sc.cues.forEach((c, ci) => {
        if (c.k === 'nar') { lines.push('旁白：' + c.text); map.push({ scene: si, cue: ci }); }
        else if (c.k === 'line') {
          const ch = PLAY.characters[c.who];
          lines.push(ch.name + '：' + c.text);
          map.push({ scene: si, cue: ci });
        } else if (c.k === 'dir') { lines.push('（' + c.text + '）'); map.push({ scene: si, cue: ci }); }
        else if (c.k === 'title') { lines.push('— ' + c.text + ' —'); map.push({ scene: si, cue: ci }); }
      });
      lines.push('');
      map.push({ scene: si, cue: -2 });
    });
    return { lines, map };
  }
  const SCRIPT = buildScript();

  function jumpFromScript() {
    const m = SCRIPT.map[state.scriptSel];
    if (!m || m.cue === -2) return;
    state.mode = 'play';
    state.scene = m.scene;
    beginScene();
    if (m.cue >= 0) {
      const sc = PLAY.scenes[m.scene];
      state.cue = m.cue;
      state.cue++;
      const hold = runCue(sc.cues[m.cue - 1]);
      state.hold = hold || 0;
    }
    PIX.SFX.select();
  }

  /* ---------------- 输入 ---------------- */
  function pressA() {
    if (state.mode === 'title') { startPlay(); return; }
    if (state.mode === 'script') { jumpFromScript(); return; }
    if (state.paused) return;
    if (state.overlay && state.overlay.k === 'title') { state.overlay = null; state.hold = 0; return; }
    if (state.overlay && state.overlay.k === 'end') return;
    if (state.text && !state.text.done) { state.text.pos = state.text.full; state.text.done = true; return; }
    if (state.hold > 0) { state.hold = 0; return; }
    advance();
  }

  function pressUp() {
    if (state.mode === 'title') {
      state.selScene = (state.selScene - 1 + PLAY.scenes.length) % PLAY.scenes.length;
      PIX.SFX.blip();
    } else if (state.mode === 'script') {
      if (state.scriptSel > 0) {
        state.scriptSel--;
        if (state.scriptSel < state.scriptTop) state.scriptTop = state.scriptSel;
        PIX.SFX.blip();
      }
    } else {
      jumpScene(-1);
    }
  }

  function pressDown() {
    if (state.mode === 'title') {
      state.selScene = (state.selScene + 1) % PLAY.scenes.length;
      PIX.SFX.blip();
    } else if (state.mode === 'script') {
      if (state.scriptSel < SCRIPT.lines.length - 1) {
        state.scriptSel++;
        if (state.scriptSel > state.scriptTop + 10) state.scriptTop = state.scriptSel - 10;
        PIX.SFX.blip();
      }
    } else {
      jumpScene(1);
    }
  }

  function toggleScript() {
    if (state.mode === 'title') {
      state.prevMode = 'title';
      state.scene = state.selScene;
      state.mode = 'script';
      state.scriptSel = 0; state.scriptTop = 0;
    } else if (state.mode === 'script') {
      state.mode = state.prevMode || 'play';
    } else {
      state.prevMode = 'play';
      state.mode = 'script';
      state.scriptSel = 0; state.scriptTop = 0;
    }
    PIX.SFX.select();
  }

  function togglePause() {
    if (state.mode !== 'play') return;
    state.paused = !state.paused;
    PIX.SFX.blip();
  }

  function toggleAuto() {
    if (state.mode !== 'play') return;
    state.auto = !state.auto;
    state.toast = { text: state.auto ? '自动演出：开' : '手动演出：开', t0: state.time };
    PIX.SFX.blip();
  }

  function toggleMute() {
    PIX.setMuted(!PIX.isMuted());
    if (state.mode === 'play') state.toast = { text: PIX.isMuted() ? '声音：关' : '声音：开', t0: state.time };
    PIX.SFX.blip();
  }

  function backToTitle() {
    state.mode = 'title';
    state.scene = 0;
    state.selScene = 0;
    state.text = null;
    state.hold = 0;
    state.fx = [];
    state.overlay = null;
    state.actors = {};
    state.paused = false;
    state.pendingFade = false;
    PIX.stopBGM();
    PIX.SFX.select();
  }

  function startPlay() {
    state.mode = 'play';
    state.scene = state.selScene;
    state.auto = true;
    state.paused = false;
    beginScene();
    PIX.SFX.select();
  }

  function press(k) {
    PIX.initAudio();
    switch (k) {
      case 'A': pressA(); break;
      case 'B': toggleAuto(); break;
      case 'X': toggleScript(); break;
      case 'Y': toggleMute(); break;
      case 'START': if (state.mode === 'title') startPlay(); else togglePause(); break;
      case 'SELECT': backToTitle(); break;
      case 'UP': pressUp(); break;
      case 'DOWN': pressDown(); break;
    }
  }

  const KEYMAP = {
    Space: 'A', Enter: 'A', KeyZ: 'A',
    KeyQ: 'X', KeyX: 'X',
    KeyB: 'B', Escape: 'B', Backspace: 'B',
    KeyM: 'Y',
    KeyP: 'START',
    KeyO: 'SELECT',
    ArrowUp: 'UP', KeyW: 'UP',
    ArrowDown: 'DOWN', KeyS: 'DOWN'
  };

  document.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if (k === 'A' || k === 'UP' || k === 'DOWN') e.preventDefault();
    press(k);
  });

  document.querySelectorAll('.dpad-btn, .ab, .start-select button').forEach((btn) => {
    btn.addEventListener('click', () => press(btn.dataset.key));
  });
  topC.addEventListener('click', () => press('A'));
  botC.addEventListener('click', () => press('A'));

  /* ---------------- 绘制：上屏（舞台） ---------------- */
  function drawTop(t) {
    const g = topG;
    g.imageSmoothingEnabled = false;
    const sh = state.fx.find(f => f.id === 'shake');
    let ox = 0, oy = 0;
    if (sh) { ox = (Math.random() - 0.5) * 6; oy = (Math.random() - 0.5) * 4; }
    g.save();
    g.translate(ox, oy);
    (BG[state.bg] || BG.title)(g, t, state);
    // 舞台角色
    const actors = Object.values(state.actors).sort((a, b) => a.y - b.y);
    for (const a of actors) {
      const fr = Math.floor(t * 2.2) % 2;
      PIX.drawSprite(g, fr ? a.fig.f1 : a.fig.f0, a.x, a.y, a.dir === -1);
    }
    g.restore();

    for (const f of state.fx) if (FX[f.id]) FX[f.id](g, f);

    if (state.mode === 'play' || state.mode === 'script') {
      const sc = PLAY.scenes[state.scene];
      drawText(g, state.mode === 'script' ? '【剧本模式】' : (sc.act + ' · ' + sc.no + ' ' + sc.title),
        4, H - 11, { size: 8, color: 'rgba(220,230,240,0.72)', shadow: false });
    }

    if (state.toast && state.mode === 'play') {
      panel(g, 44, 76, 168, 24, 'rgba(8,10,16,0.9)', '#3a4048');
      drawText(g, state.toast.text, 128, 83, { size: 11, align: 'center', color: '#ffd25a' });
    }

    if (state.overlay) drawOverlay(g, state.overlay, t);

    if (state.mode === 'title') {
      drawText(g, '三 体', 128, 42, { size: 44, align: 'center', color: '#ffd25a' });
      drawText(g, '给 岁 月 以 文 明', 128, 100, { size: 14, align: 'center', color: '#e8e8f0' });
      drawText(g, '— NDS 像素舞台剧 —', 128, 124, { size: 11, align: 'center', color: '#7ab8f0' });
      if (Math.sin(t * 2.4) > -0.25) {
        drawText(g, '▼ PRESS START ▼', 128, 158, { size: 11, align: 'center', color: '#e06868' });
      }
    }

    scanlines(g);
  }

  function drawOverlay(g, o, t) {
    if (o.k === 'title') {
      const a = clamp((t - o.t0) / 0.4, 0, 1);
      g.globalAlpha = a;
      rect(g, 0, 0, W, H, 'rgba(2,3,8,0.93)');
      panel(g, 24, 54, 208, 86, '#0a0d16', '#3a414e');
      drawText(g, o.text, 128, 68, { size: 20, align: 'center', color: '#ffd25a' });
      drawText(g, '──────', 128, 100, { size: 11, align: 'center', color: '#5a6068', shadow: false });
      if (o.sub) drawText(g, o.sub, 128, 112, { size: 10, align: 'center', color: '#9aa8b8' });
      g.globalAlpha = 1;
    } else if (o.k === 'fade') {
      const p = clamp((t - o.t0) / o.dur, 0, 1);
      const a = o.out ? p : 1 - p;
      if (a > 0) {
        g.globalAlpha = a;
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
    } else if (o.k === 'end') {
      rect(g, 0, 0, W, H, 'rgba(2,3,8,0.96)');
      drawText(g, '全 剧 终', 128, 58, { size: 30, align: 'center', color: '#ffd25a' });
      drawText(g, '《三体 · 给岁月以文明》', 128, 110, { size: 11, align: 'center', color: '#c8d0d8' });
      drawText(g, 'NDS 像素舞台剧 · 前端实现', 128, 128, { size: 9, align: 'center', color: '#7a828a' });
      if (Math.sin(t * 2.2) > -0.3) {
        drawText(g, 'SELECT 返回标题', 128, 156, { size: 10, align: 'center', color: '#e06868' });
      }
    }
  }

  /* ---------------- 绘制：下屏（对白 / 菜单 / 剧本） ---------------- */
  function drawTitlePanel(g, t) {
    rect(g, 0, 0, W, H, '#05070d');
    panel(g, 14, 12, 228, 170, '#0a0d16', '#3a414e');
    drawText(g, '《三体》', 128, 26, { size: 20, align: 'center', color: '#ffd25a' });
    drawText(g, '给岁月以文明', 128, 54, { size: 13, align: 'center', color: '#e8e8f0' });
    drawText(g, '— NDS 像素舞台剧 —', 128, 74, { size: 10, align: 'center', color: '#7ab8f0' });
    drawText(g, '剧本 · 演出 · 美术 · 音效', 128, 96, { size: 9, align: 'center', color: '#8a9098', shadow: false });
    drawText(g, '全部由浏览器即时演出', 128, 109, { size: 9, align: 'center', color: '#8a9098', shadow: false });
    drawText(g, 'A 开演 · X 读剧本 · ↑↓ 选幕', 128, 128, { size: 9, align: 'center', color: '#c8d0d8', shadow: false });
    drawText(g, '从「' + PLAY.scenes[state.selScene].act + ' · ' + PLAY.scenes[state.selScene].title + '」开演',
      128, 142, { size: 9, align: 'center', color: '#e8b84a', shadow: false });
    if (Math.floor(t * 1.6) % 2 === 0) {
      drawText(g, '▶ 按 A 或 START 开演 ◀', 128, 162, { size: 11, align: 'center', color: '#e06868' });
    }
  }

  function drawPlayBottom(g, t) {
    const sc = PLAY.scenes[state.scene];
    rect(g, 0, 0, W, 18, '#0b0f18');
    rect(g, 0, 17, W, 1, '#2a303c');
    drawText(g, sc.act + ' · ' + sc.no + ' ' + sc.title, 4, 3, { size: 9, color: '#c8d0d8', shadow: false });
    panel(g, 188, 3, 64, 12, '#141a24', '#39414e');
    const pw = (state.scene + 1) / PLAY.scenes.length;
    rect(g, 191, 6, Math.floor(58 * pw), 6, '#36a84a');

    const dt = state.text;
    panel(g, 6, 40, 244, 138, 'rgba(8,10,16,0.97)', '#3d434d');
    if (dt) {
      const name = dt.who === 'nar' ? '旁白' : dt.who === 'dir' ? '舞台提示' : PLAY.characters[dt.who].name;
      const nw = Math.min(132, g.measureText(name).width + 12);
      rect(g, 9, 33, nw, 14, dt.color);
      drawText(g, name, 15, 36, { size: 10, color: '#101018', shadow: false });
      let tx = 16;
      if (dt.port) {
        const pimg = portraitFor(dt.who, dt.port);
        rect(g, 14, 52, 26, 26, '#000');
        g.drawImage(pimg, 16, 54);
        rect(g, 14, 52, 26, 26, '#5a616c');
        tx = 48;
      }
      const shown = dt.text.slice(0, Math.floor(dt.pos));
      drawText(g, shown, tx, 58, { size: 11, color: dt.color, wrap: 200 });
      if (!dt.done) {
        if (Math.floor(t * 3) % 2 === 0) drawText(g, '…', 240, 166, { size: 11, color: '#7a828a', shadow: false });
      } else if (Math.floor(t * 2) % 2 === 0) {
        drawText(g, '▼', 238, 164, { size: 11, color: dt.color, shadow: false });
      }
    } else {
      drawText(g, '……', 128, 96, { size: 14, align: 'center', color: '#7a828a' });
    }

    rect(g, 0, 182, W, 10, '#0b0f18');
    drawText(g, 'A推进 B' + (state.auto ? '自动' : '手动') + ' X剧本 Y声音 START暂停 ↑↓选幕',
      4, 183, { size: 9, color: '#767e88', shadow: false });

    if (state.paused) {
      rect(g, 0, 0, W, H, 'rgba(0,0,0,0.55)');
      drawText(g, '■ 已暂停', 128, 84, { size: 14, align: 'center', color: '#ffd25a' });
      drawText(g, 'START 继续', 128, 110, { size: 10, align: 'center', color: '#c8d0d8' });
    }
  }

  function drawScriptPanel(g) {
    rect(g, 0, 0, W, H, '#05070d');
    drawText(g, '剧本《三体 · 给岁月以文明》', 6, 4, { size: 10, color: '#ffd25a', shadow: false });
    drawText(g, 'A跳转 · X/B返回 · ↑↓翻阅', 128, 4, { size: 8, align: 'center', color: '#7a828a', shadow: false });
    const lines = SCRIPT.lines;
    const top = Math.min(state.scriptTop, Math.max(0, lines.length - 11));
    const sel = state.scriptSel;
    for (let i = 0; i < 11; i++) {
      const li = top + i;
      if (li >= lines.length) break;
      const ln = lines[li];
      let col = '#9aa2ac';
      if (ln.startsWith('【')) col = '#e8b84a';
      else if (ln.startsWith('旁白')) col = '#b8a060';
      else if (ln.startsWith('（')) col = '#6f767f';
      if (li === sel) rect(g, 4, 20 + i * 15, 248, 14, 'rgba(255,210,90,0.12)');
      drawText(g, ln, 8, 22 + i * 15, { size: 9, color: li === sel ? '#ffffff' : col, shadow: false });
    }
    const scn = SCRIPT.map[sel] ? SCRIPT.map[sel].scene + 1 : 0;
    drawText(g, '第 ' + (sel + 1) + '/' + lines.length + ' 行 · 场次 ' + scn + '/' + PLAY.scenes.length,
      128, 186, { size: 8, align: 'center', color: '#5a626c', shadow: false });
  }

  function drawBottom(t) {
    const g = botG;
    g.imageSmoothingEnabled = false;
    if (state.mode === 'title') drawTitlePanel(g, t);
    else if (state.mode === 'script') drawScriptPanel(g);
    else drawPlayBottom(g, t);
    scanlines(g);
  }

  /* ---------------- 主循环 ---------------- */
  function update(dt) {
    state.time += dt;
    const t = state.time;
    for (const f of state.fx) f.age = t - f.t0;
    state.fx = state.fx.filter(f => f.age < f.dur);

    if (state.text && !state.text.done) {
      state.text.pos = Math.min(state.text.full, state.text.pos + dt * 46);
      if (state.text.pos >= state.text.full) {
        state.text.pos = state.text.full;
        state.text.done = true;
      }
    }

    for (const a of Object.values(state.actors)) {
      const d = a.tx - a.x;
      if (Math.abs(d) > 0.4) a.x += d * Math.min(1, dt * 4);
    }

    const pendingText = state.text && !state.text.done;
    if (state.hold > 0 && (state.auto || (!pendingText && !state.holdText))) {
      state.hold -= dt * 1000;
      if (state.hold <= 0) {
        state.hold = 0;
        if (state.pendingFade) { state.pendingFade = false; beginScene(); }
        else if (!pendingText) advance();
      }
    }

    if (state.overlay && state.overlay.k === 'title' && t - state.overlay.t0 > state.overlay.dur) {
      state.overlay = null;
    }
    if (state.toast && t - state.toast.t0 > 1.8) state.toast = null;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    state.clock += dt;
    if (state.mode === 'play' && !state.paused) update(dt);
    drawTop(state.clock);
    drawBottom(state.clock);
    requestAnimationFrame(frame);
  }

  // 支持 ?start=1&scene=N 直接开演（测试与演示用）
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.has('start')) {
      state.selScene = clamp(parseInt(qs.get('scene') || '0', 10) || 0, 0, PLAY.scenes.length - 1);
      startPlay();
      // ?cue=N 从指定线索开演（演示/预览用）
      const cueN = parseInt(qs.get('cue') || '0', 10);
      const sc = PLAY.scenes[state.scene];
      if (cueN > 0 && sc.cues[cueN]) {
        state.cue = cueN;
        state.text = null;
        state.hold = 0;
        const hold = runCue(sc.cues[cueN]);
        state.cue = cueN + 1;
        state.hold = hold || 0;
      }
    }
    if (qs.has('debug')) {
      const dbg = document.createElement('div');
      dbg.id = 'debug-state';
      dbg.style.cssText = 'position:absolute;left:0;top:0;z-index:999;color:#0f0;font-size:10px;';
      document.body.appendChild(dbg);
      setInterval(() => {
        dbg.textContent = 'mode=' + state.mode +
          ' scene=' + state.scene +
          ' cue=' + state.cue +
          ' clock=' + state.clock.toFixed(2) +
          ' text=' + (state.text ? state.text.who + '/' + state.text.done : '-') +
          ' hold=' + state.hold.toFixed(0);
      }, 60);
    }
  } catch (e) { /* 忽略 */ }

  requestAnimationFrame(frame);
})();
