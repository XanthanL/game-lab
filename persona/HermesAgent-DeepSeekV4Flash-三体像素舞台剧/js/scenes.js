'use strict';
/* ═══════════════════════════════════════════════
   各幕演出 —— 上屏 256x192 像素动画
   每个场景 draw(g, t)：t 为该幕已播放秒数
   ═══════════════════════════════════════════════ */
const Scene = (() => {
  const W = 256, H = 192;
  const starsA = makeStars(85, 11);   /* 一般星空 */
  const starsB = makeStars(55, 23);   /* 墓地暗星 */

  /* ─────────── 标题 / 节目单背景 ─────────── */
  function title(g, t) {
    bandedSky(g, ['#020409', '#030711', '#040a18', '#060e20', '#081430']);
    drawStars(g, starsA, t, 0.9);
    /* 三颗小太阳缓缓公转 */
    for (let i = 0; i < 3; i++) {
      const a = t * (0.22 + i * 0.07) + i * 2.1;
      const x = 128 + Math.cos(a) * 86, y = 96 + Math.sin(a) * 34;
      pRing(g, x, y, 12 + i * 2, 'rgba(240,163,58,0.35)');
      pDisc(g, x, y, 6 + i, i === 1 ? '#f0a33a' : '#d84b2a');
      pDisc(g, x, y, 2, '#ffe9a8');
    }
    ptext(g, '三体', 128, 44, 46, '#e8eef4', 'center');
    ptext(g, PLAY.subtitle, 128, 96, 13, '#f0a33a', 'center');
    ptext(g, PLAY.credit, 128, 160, 8, '#7f9cc0', 'center');
    if ((t | 0) % 2 === 0) ptext(g, '▲ 点击下屏 开始演出', 128, 176, 9, '#cfe3ff', 'center');
  }

  /* ─────────── 序幕 · 宇宙为你闪烁 ─────────── */
  function prologue(g, t) {
    bandedSky(g, ['#010308', '#020610', '#030a18', '#040d1e']);
    /* 宇宙闪烁：星光明灭加剧 */
    const flick = 1 + Math.sin(t * 2.1) * 0.75;
    drawStars(g, starsA, t, Math.max(0.15, flick));
    /* 扩张的闪烁波纹 */
    const rw = (t - 5) * 36;
    if (t > 5 && rw < 300) {
      g.globalAlpha = 0.3;
      pRing(g, 128, 96, rw, '#9fb8d8');
      g.globalAlpha = 1;
    }
    /* 天文台剪影 */
    mountain(g, 208, 192, 66, '#04060c');
    g.fillStyle = '#05070d';
    g.fillRect(196, 118, 26, 14);            /* 台基 */
    g.beginPath();
    g.arc(209, 118, 12, Math.PI, 0);         /* 圆顶 */
    g.fill();
    g.fillStyle = '#0a0e18';
    g.fillRect(205, 112, 8, 6);              /* 观测缝 */
    drawSprite(g, 'person', 176, 146, 1, PAL);
    /* 红色倒计时 */
    const secs = Math.max(0, 72000 - t * 3600);
    const hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60, ss = Math.floor(secs) % 60;
    const pad = n => (n < 10 ? '0' : '') + n;
    const str = pad(hh) + ':' + pad(mm) + ':' + pad(ss);
    if (((t * 8) | 0) % 9 !== 0) ptextMono(g, str, 128, 34, 24, '#ff4030', 'center');
    /* 结尾红光 */
    const red = Math.max(0, (t - 18) / 3);
    if (red > 0) { g.fillStyle = 'rgba(200,20,10,' + (red * 0.3) + ')'; g.fillRect(0, 0, W, H); }
  }

  /* ─────────── 第一幕 · 红岸基地 ─────────── */
  function redcoast(g, t) {
    bandedSky(g, ['#020408', '#030711', '#040a16', '#050d1d']);
    drawStars(g, starsA, t, 0.7);
    mountain(g, 70, 192, 70, '#04060c');
    mountain(g, 200, 192, 96, '#03050a');
    forest(g, 5, 152, 16);
    /* 红岸天线（抛物面） */
    const dx = 58, dy = 98, dr = 26;
    pLine(g, dx, dy + 8, dx, 152, '#0d0f14');          /* 桅杆 */
    pRing(g, dx, dy, dr, '#8fa3b5');
    pLine(g, dx - dr, dy, dx + dr, dy, '#8fa3b5');
    pLine(g, dx, dy - dr, dx, dy + dr, '#8fa3b5');
    pLine(g, dx - 18, dy - 18, dx + 18, dy + 18, '#6b7a8a');
    pLine(g, dx + 18, dy - 18, dx - 18, dy + 18, '#6b7a8a');
    g.fillStyle = '#6b7a8a';
    g.fillRect(dx - 2, dy - 2, 4, 4);
    if (((t * 2) | 0) % 2 === 0) { g.fillStyle = '#ff4030'; g.fillRect(dx - 1, 142, 3, 3); }
    /* 控制室 */
    g.fillStyle = '#10141c';
    g.fillRect(96, 128, 52, 24);
    g.fillStyle = '#1c2230';
    g.fillRect(98, 130, 48, 14);
    g.fillStyle = '#3a4a5c';
    g.fillRect(100, 131, 16, 5);                       /* 屏幕 */
    g.fillStyle = '#ffe27a';
    g.fillRect(124, 142, 16, 8);                       /* 红色按钮 */
    ptext(g, '红岸基地', 98, 118, 9, '#cfe3ff');
    /* 叶文洁 */
    drawSprite(g, 'person', 108, 144, 1, PAL);
    /* 太阳（放大器） */
    pDisc(g, 214, 26, 9, '#f0a33a');
    pDisc(g, 214, 26, 4, '#ffe9a8');
    /* 发射！电波射向太阳 */
    if (t > 7) {
      g.globalAlpha = 0.22 + 0.2 * Math.sin(t * 9);
      pLine(g, dx, dy, dx, 0, '#7ec8ff');
      g.globalAlpha = 0.1 + 0.08 * Math.sin(t * 9 + 1);
      pLine(g, dx + 2, dy, 212, 30, '#7ec8ff');
      pLine(g, dx - 2, dy, 216, 24, '#7ec8ff');
      g.globalAlpha = 1;
    }
    /* 不要回答 */
    if (t > 12 && ((t * 3) | 0) % 2 === 0) ptext(g, '不要回答！！', 128, 8, 15, '#ff4030', 'center');
    /* 切至太空：信号抵达三体世界 */
    if (t > 19) {
      const f = Math.min(1, (t - 19) / 2);
      g.fillStyle = 'rgba(1,2,6,' + (f * 0.92) + ')';
      g.fillRect(0, 0, W, H);
      if (f > 0.5) drawStars(g, starsA, t, 0.9);
      const rr = (t - 21) * 34;
      if (t > 21 && rr < 320) {
        g.globalAlpha = 0.35;
        pRing(g, 56, 96, rr, '#7ec8ff');
        g.globalAlpha = 1;
      }
      if (t > 23) {
        pDisc(g, 214, 70, 4, '#d84b2a');
        pDisc(g, 224, 78, 5, '#f0a33a');
        pDisc(g, 204, 80, 3, '#f0a33a');
        ptext(g, '三体世界 · 收到', 214, 86, 8, '#7f9cc0', 'center');
      }
    }
  }

  /* ─────────── 第二幕 · 三体游戏 ─────────── */
  function threebody(g, t) {
    /* 沙漠地面 */
    g.fillStyle = '#8a6230';
    g.fillRect(0, 140, W, 10);
    g.fillStyle = '#b98a4a';
    g.fillRect(0, 150, W, 42);
    for (let i = 0; i < 26; i++) {
      const r = mulberry32(31 + i);
      g.fillStyle = '#a06a24';
      g.fillRect((r() * W) | 0, 152 + ((r() * 36) | 0), 2, 1);
    }
    /* 烈焰天空 */
    bandedSky(g, ['#1a0e08', '#2a1408', '#3d1c0a', '#55260c', '#6e2f10']);
    /* 三颗太阳 */
    const suns = [
      { r: 58, sp: 0.5, ph: 0 },
      { r: 80, sp: 0.36, ph: 2.1 },
      { r: 100, sp: 0.26, ph: 4.2 },
    ];
    const pos = [];
    for (let i = 0; i < 3; i++) {
      const s = suns[i];
      pos.push({
        x: 128 + Math.cos(t * s.sp + s.ph) * s.r,
        y: 74 + Math.sin(t * s.sp + s.ph) * s.r * 0.5,
      });
    }
    /* 飞星相遇 → 乱纪元 */
    let danger = false;
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) {
        const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
        if (d < 52) danger = true;
      }
    const grow = danger ? 1.18 : 1;
    for (let i = 0; i < 3; i++) {
      const p = pos[i], R = (12 - i) * grow;
      pRing(g, p.x, p.y, R + 4, 'rgba(240,163,58,0.3)');
      pDisc(g, p.x, p.y, R, '#c04a1a');
      pDisc(g, p.x, p.y, R * 0.72, '#f0a33a');
      pDisc(g, p.x, p.y, R * 0.4, '#ffe9a8');
    }
    if (danger) { g.fillStyle = 'rgba(255,240,220,' + (0.16 + 0.1 * Math.sin(t * 22)) + ')'; g.fillRect(0, 0, W, H); }
    /* 人群：乱纪元脱水 / 恒纪元站立 */
    for (let i = 0; i < 6; i++) {
      const x = 26 + i * 40;
      if (danger) drawSprite(g, 'dehy', x - 2, 154, 1, PAL);
      else {
        const bob = (Math.sin(t * 9 + i * 1.7) * 1.2) | 0;
        drawSprite(g, 'person', x, 144 + bob, 1, PAL);
      }
    }
    /* 旗帜文字 */
    if (danger && ((t * 6) | 0) % 2 === 0) ptext(g, '乱纪元 · 脱水！', 128, 8, 14, '#ff7a30', 'center');
    else if (!danger) ptext(g, '恒 纪 元', 128, 8, 14, '#7ee87e', 'center');
  }

  /* ─────────── 第三幕 · 智子 ─────────── */
  function sophon(g, t) {
    bandedSky(g, ['#02060f', '#04101f', '#061a30', '#082442']);
    /* 质子种子 */
    if (t < 2) {
      pRing(g, 128, 96, 10 + t * 3, '#7ec8ff');
      pDisc(g, 128, 96, 8, '#3a6ea8');
      pDisc(g, 128, 96, 3, '#cfe8ff');
      return;
    }
    /* 二维展开：方框扩张 + 网格铺满天空 */
    const cov = Math.min(1, (t - 2) / 7);
    const s = 8 + cov * 220;
    g.globalAlpha = 0.25 + cov * 0.55;
    pLine(g, 128 - s, 96 - s, 128 + s, 96 - s, '#7ec8ff');
    pLine(g, 128 + s, 96 - s, 128 + s, 96 + s, '#7ec8ff');
    pLine(g, 128 + s, 96 + s, 128 - s, 96 + s, '#7ec8ff');
    pLine(g, 128 - s, 96 + s, 128 - s, 96 - s, '#7ec8ff');
    g.globalAlpha = 1;
    if (cov > 0.35) {
      const ga = (cov - 0.35) / 0.65 * 0.35;
      g.globalAlpha = ga;
      g.fillStyle = '#3a6ea8';
      for (let x = 0; x <= 256; x += 16) g.fillRect(x, 0, 1, H);
      for (let y = 0; y <= 192; y += 16) g.fillRect(0, y, W, 1);
      g.globalAlpha = 1;
    }
    /* 智子睁开眼 */
    const open = Math.min(1, (t - 9) / 1.4);
    if (open > 0) {
      const blinkP = (t + 2.5) % 5;
      const blink = blinkP < 0.35 ? 1 - blinkP / 0.35 : 0;
      const gap = 78 * open * (1 - blink * 0.92);      /* 眼缝高度 */
      const cy = 96, cx = 128;
      const ix = Math.sin(t * 0.7) * 6, iy = Math.cos(t * 0.5) * 4;
      /* 巩膜 */
      pEllipse(g, cx, cy, 104, 68, '#dce6ee');
      /* 虹膜 + 瞳孔 + 高光 */
      pDisc(g, cx + ix, cy + iy, 34, '#2e5f96');
      pDisc(g, cx + ix, cy + iy, 26, '#3a6ea8');
      pDisc(g, cx + ix, cy + iy, 13, '#0a0d12');
      pDisc(g, cx + ix - 9, cy + iy - 8, 4, '#e8f4ff');
      /* 眼帘（用天空色遮挡，模拟眨眼） */
      const lidH = 96 - gap / 2;
      g.fillStyle = '#061a30';
      g.fillRect(0, 0, W, lidH);
      g.fillRect(0, H - lidH, W, lidH);
      /* 扫描线 */
      if (open > 0.8) {
        g.globalAlpha = 0.35;
        pLine(g, 0, Math.round(cy + Math.sin(t * 2.2) * 62), W, Math.round(cy + Math.sin(t * 2.2) * 62), '#7ec8ff');
        g.globalAlpha = 1;
      }
    }
  }

  /* ─────────── 第四幕 · 水滴 ─────────── */
  function droplet(g, t) {
    g.fillStyle = '#010204';
    g.fillRect(0, 0, W, H);
    drawStars(g, starsA, t, 0.85);
    /* 舰队（14 艘，斜向列阵） */
    const ships = [];
    for (let i = 0; i < 14; i++) ships.push({ x: 140 + i * 8.5, y: 58 + i * 6.5 });
    const hitT = (sx) => 8 + (sx - 72) / 110;
    for (let i = 0; i < ships.length; i++) {
      const sh = ships[i];
      if (t < hitT(sh.x)) {
        drawSprite(g, 'ship', Math.round(sh.x - 9), Math.round(sh.y - 4), 1, PAL);
        g.fillStyle = '#ffe27a';
        g.fillRect(Math.round(sh.x), Math.round(sh.y + 5), 1, 1);
      } else {
        /* 爆炸 */
        const ex = t - hitT(sh.x);
        if (ex < 1.5) {
          g.globalAlpha = Math.max(0, (1 - ex / 1.5) * 0.75);
          pRing(g, sh.x, sh.y, ex * 15, '#f0a33a');
          g.globalAlpha = Math.max(0, (1 - ex / 1.2) * 0.85);
          pDisc(g, sh.x, sh.y, Math.max(1, ex * 7), '#ffd24a');
          g.globalAlpha = 1;
          for (let k = 0; k < 8; k++) {
            const a = k / 8 * Math.PI * 2 + ex * 6;
            g.globalAlpha = Math.max(0, 1 - ex / 1.2);
            pLine(g, sh.x, sh.y, sh.x + Math.cos(a) * ex * 26, sh.y + Math.sin(a) * ex * 26, k % 2 ? '#ffffff' : '#ff7a30');
          }
          g.globalAlpha = 1;
          if (ex < 0.12) { g.fillStyle = 'rgba(255,255,255,' + (1 - ex / 0.12) + ')'; pDisc(g, sh.x, sh.y, 8, '#fff'); }
        }
      }
    }
    /* 水滴：完美镜面球体 */
    const p = dropPos(t);
    for (let k = 5; k >= 1; k--) {                    /* 残影 */
      const q = dropPos(t - k * 0.045);
      g.globalAlpha = (1 - k / 6) * 0.3;
      pRing(g, q.x, q.y, 9, '#4a5c70');
    }
    g.globalAlpha = 1;
    pDisc(g, p.x, p.y, 9, '#4a5c70');
    pDisc(g, p.x - 1, p.y - 1, 7, '#9fb4c8');
    pDisc(g, p.x - 2, p.y - 2, 4, '#dfeaf4');
    pDisc(g, p.x - 3, p.y - 3, 2, '#ffffff');
  }
  function dropPos(tt) {
    if (tt < 4) return { x: -12 + (tt / 4) * 84, y: 90 };
    if (tt < 8) return { x: 72, y: 90 + Math.sin(tt * 3) * 1.5 };
    return { x: 72 + (tt - 8) * 110, y: 90 + Math.sin((tt - 8) * 8) * 26 };
  }

  /* ─────────── 第五幕 · 黑暗森林 ─────────── */
  function darkforest(g, t) {
    bandedSky(g, ['#010204', '#030509', '#04070d', '#060a12']);
    drawStars(g, starsB, t, 0.45);
    /* 目标恒星 187J3X1 */
    const tx = 182, ty = 56;
    const dim = Math.max(0, 1 - Math.max(0, (t - 11) / 4));
    if (dim > 0) {
      g.globalAlpha = dim;
      pDisc(g, tx, ty, 3, '#ffffff');
      pRing(g, tx, ty, 6, '#cfe3ff');
      g.globalAlpha = 1;
      ptextMono(g, '187J3X1', tx, ty + 9, 8, 'rgba(207,227,255,' + (dim * 0.8) + ')', 'center');
    } else if (t > 15) {
      g.globalAlpha = Math.max(0, 0.5 - (t - 15) * 0.1);
      pRing(g, tx, ty, (t - 15) * 12, '#ffd24a');
      g.globalAlpha = 1;
    }
    if (t > 15) ptextMono(g, '187J3X1 · 毁灭', tx, 74, 8, '#ff4030', 'center');
    /* 墓园 */
    mountain(g, 90, 192, 44, '#020308');
    drawSprite(g, 'grave', 74, 148, 1, PAL);
    drawSprite(g, 'grave', 96, 152, 1, PAL);
    /* 猎手剪影（远处山坡） */
    drawSprite(g, 'person', 206, 136, 1, { '.': null, 'K': '#000', 'W': '#000' });
    /* 罗辑 */
    drawSprite(g, 'personCoat', 42, 144, 1, PAL);
    pLine(g, 56, 138, 74, 133, '#0d0f14');             /* 枪 */
    /* 咒语发射 */
    if (t > 7 && t < 12) {
      g.globalAlpha = 0.3 + 0.2 * Math.sin(t * 10);
      pLine(g, 74, 133, tx, ty + 2, '#7ec8ff');
      g.globalAlpha = 1;
      if (((t * 12) | 0) % 2 === 0) { g.fillStyle = '#fff'; g.fillRect(73, 132, 3, 3); }
    }
    if (t > 16) {                                       /* 主题字浮出 */
      const a = Math.min(0.35, (t - 16) / 3 * 0.35);
      ptext(g, '黑暗森林', 128, 30, 26, 'rgba(255,210,74,' + a + ')', 'center');
    }
  }

  /* ─────────── 终幕 · 给岁月以文明 ─────────── */
  function epilogue(g, t) {
    bandedSky(g, ['#0a0e1c', '#141c34', '#2a2440', '#4a2e3a', '#7a4434', '#b0632e', '#e0a04a']);
    /* 海面 */
    g.fillStyle = '#1a2438';
    g.fillRect(0, 126, W, H - 126);
    const r = mulberry32(9);
    g.globalAlpha = 0.25;
    for (let k = 0; k < 7; k++) {
      const y = 134 + k * 8;
      const x1 = (r() * 160) | 0;
      pLine(g, x1, y, x1 + 26, y, '#7ea8d8');
    }
    g.globalAlpha = 1;
    /* 日出 */
    const sy = Math.max(110, 150 - Math.max(0, t - 2) * 7);
    pRing(g, 128, sy, 22, 'rgba(240,163,58,0.3)');
    pDisc(g, 128, sy, 17, '#ffe9a8');
    pDisc(g, 128, sy, 12, '#fff6d8');
    pLine(g, 128, 126, 128, 168, 'rgba(224,160,74,0.35)');
    /* 飞鸟 */
    for (let i = 0; i < 2; i++) {
      const bx = ((t * 14 + i * 95) % 300) - 20;
      const by = 58 + Math.sin(t * 3 + i * 2) * 7;
      drawSprite(g, 'bird', bx, by, 1, PAL);
    }
    /* 主题字 */
    if (t > 10) {
      const a = Math.min(1, (t - 10) / 2);
      ptext(g, '给岁月以文明', 128, 62, 20, 'rgba(255,233,168,' + a + ')', 'center');
      ptext(g, '而不是给文明以岁月', 128, 88, 12, 'rgba(207,216,224,' + (a * 0.9) + ')', 'center');
    }
    if (t > 20 && ((t | 0) % 2 === 0)) ptext(g, '全剧终 · 感谢观看', 128, 176, 10, '#e8eef4', 'center');
  }

  return { title, prologue, redcoast, threebody, sophon, droplet, darkforest, epilogue };
})();
