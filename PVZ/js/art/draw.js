// 程序化矢量绘制：所有角色/特效均由代码绘制，无图片资源（原创美术风格，避免版权问题）
(function () {
  'use strict';

  const A = {};
  PVZ.art = A;

  function circle(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 径向渐变填充（用于球体/头部更立体的高光）
  // 带 LRU 缓存：渐变按 (x,y,r,颜色) 缓存，植物在固定格内坐标恒定 → 高命中率，
  // 避免每帧重建数百个 CanvasGradient，稳定帧率、降低 GC 压力。
  A._gc = new Map();
  A._gcCap = 384;
  function cacheGrad(key, make) {
    let g = A._gc.get(key);
    if (g) { A._gc.delete(key); A._gc.set(key, g); return g; } // 刷新 LRU 顺序
    g = make();
    A._gc.set(key, g);
    if (A._gc.size > A._gcCap) {
      const first = A._gc.keys().next().value;
      A._gc.delete(first);
    }
    return g;
  }
  function rgrad(ctx, x, y, r, inner, outer) {
    const rx = Math.round(x), ry = Math.round(y), rr = Math.round(r);
    const key = 'r' + rx + '_' + ry + '_' + rr + '_' + inner + '_' + outer;
    return cacheGrad(key, () => {
      const g = ctx.createRadialGradient(rx - rr * 0.3, ry - rr * 0.3, rr * 0.2, rx, ry, rr);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      return g;
    });
  }

  // 软投影：单色半透明椭圆，一次填充。为角色/物体增加落地层次感，开销极低。
  A.softShadow = function (ctx, x, y, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.16 : alpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  A.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ===== 植物 =====
  // 坐标系：原点 (0,0) = 底部中心（可传 scale 用于卡片小图标）

  function leaf(ctx, x, y, rx, ry, rot, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = fill;
    ellipse(ctx, 0, 0, rx, ry, 0);
    ctx.restore();
  }

  function drawPeashooter(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);

    leaf(ctx, -10, -30, 16, 6, -0.5, '#3e8f3e');
    leaf(ctx, 8, -34, 16, 6, 0.5, '#3e8f3e');

    ctx.fillStyle = '#3f9d3f';
    A.roundRect(ctx, -5, -46, 10, 44, 5);
    ctx.fill();

    ctx.fillStyle = rgrad(ctx, 2, -62, 25, '#7ed957', '#3f9d3f');
    circle(ctx, 2, -62, 25);
    ctx.fillStyle = '#2f7d2f';
    A.roundRect(ctx, 14, -70, 22, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#15471a';
    circle(ctx, 34, -62, 6.5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    circle(ctx, 31, -65, 2.2);

    ctx.fillStyle = '#15471a';
    circle(ctx, -6, -70, 4.5);
    ctx.fillStyle = '#ffffff';
    circle(ctx, -7, -71, 1.6);
  }

  function drawSunflower(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.8) * 2.5);

    ctx.fillStyle = '#3f9d3f';
    A.roundRect(ctx, -5, -54, 10, 52, 5);
    ctx.fill();
    leaf(ctx, -14, -34, 15, 6, 0.7, '#3e8f3e');
    leaf(ctx, 12, -40, 15, 6, -0.5, '#3e8f3e');

    const cx = 0, cy = -78, pr = 21;
    // 花瓣（两层交错的暖黄色）
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? '#ffd54f' : '#ffc107';
      leaf(ctx, cx + Math.cos(a) * (pr + 8), cy + Math.sin(a) * (pr + 8), 10, 6, a, ctx.fillStyle);
    }
    // 花盘（径向渐变 + 网格纹理）
    ctx.fillStyle = rgrad(ctx, cx, cy, pr, '#a9712f', '#6d3f16');
    circle(ctx, cx, cy, pr);
    ctx.strokeStyle = 'rgba(60,35,12,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr);
      ctx.stroke();
    }
    // 表情
    ctx.fillStyle = '#3a230c';
    circle(ctx, cx - 7, cy - 3, 3.5);
    circle(ctx, cx + 7, cy - 3, 3.5);
    ctx.strokeStyle = '#3a230c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  function drawSunshroom(ctx, t) {
    ctx.translate(0, Math.sin(t * 2) * 1.5);
    // 茎
    ctx.fillStyle = '#e8e0c8';
    A.roundRect(ctx, -6, -40, 12, 40, 6);
    ctx.fill();
    // 菌盖（发光暖黄）
    ctx.fillStyle = rgrad(ctx, 0, -46, 22, '#ffe082', '#ffb300');
    ellipse(ctx, 0, -46, 22, 15, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    circle(ctx, -7, -50, 4);
    // 眼
    ctx.fillStyle = '#5a4a2a';
    circle(ctx, -6, -34, 2.6);
    circle(ctx, 6, -34, 2.6);
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -28, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  function drawWallnut(ctx, t, hpRatio) {
    ctx.translate(0, Math.sin(t * 1.4) * 1.5);
    ctx.fillStyle = rgrad(ctx, 0, -34, 28, '#c98a4e', '#9c6531');
    ellipse(ctx, 0, -32, 26, 28, 0);
    ctx.fillStyle = '#8d5f2e';
    ellipse(ctx, 0, -10, 26, 14, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ellipse(ctx, -8, -46, 9, 9, -0.4);

    ctx.fillStyle = '#5d3a1a';
    circle(ctx, -9, -36, 4);
    circle(ctx, 9, -36, 4);
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -24, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();

    if (hpRatio < 0.7) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, -18); ctx.lineTo(-8, -12); ctx.lineTo(-12, -6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -54); ctx.lineTo(15, -48);
      ctx.stroke();
    }
    if (hpRatio < 0.35) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.beginPath();
      ctx.moveTo(-18, -42); ctx.lineTo(-14, -34); ctx.lineTo(-18, -28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -28); ctx.lineTo(12, -20); ctx.lineTo(16, -14);
      ctx.stroke();
      ctx.strokeStyle = '#5d3a1a';
      ctx.beginPath();
      ctx.arc(0, -16, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  function drawSnowpea(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);
    leaf(ctx, -10, -30, 16, 6, -0.5, '#3e8f3e');
    leaf(ctx, 8, -34, 16, 6, 0.5, '#3e8f3e');
    ctx.fillStyle = '#3f9d3f';
    A.roundRect(ctx, -5, -46, 10, 44, 5);
    ctx.fill();
    ctx.fillStyle = rgrad(ctx, 2, -62, 25, '#b3e5fc', '#4fc3f7');
    circle(ctx, 2, -62, 25);
    ctx.fillStyle = '#29b6f6';
    A.roundRect(ctx, 14, -70, 22, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#0d47a1';
    circle(ctx, 34, -62, 6.5);
    ctx.fillStyle = '#e1f5fe';
    ctx.beginPath();
    ctx.moveTo(-2, -94); ctx.lineTo(-10, -84); ctx.lineTo(6, -84);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0d47a1';
    circle(ctx, -6, -70, 4.5);
    ctx.fillStyle = '#ffffff';
    circle(ctx, -7, -71, 1.6);
  }

  function drawRepeater(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);
    leaf(ctx, -10, -30, 16, 6, -0.5, '#3e8f3e');
    leaf(ctx, 8, -34, 16, 6, 0.5, '#3e8f3e');
    ctx.fillStyle = '#3f9d3f';
    A.roundRect(ctx, -5, -46, 10, 44, 5);
    ctx.fill();
    ctx.fillStyle = rgrad(ctx, 2, -62, 25, '#7ed957', '#3f9d3f');
    circle(ctx, 2, -62, 25);
    ctx.fillStyle = '#2f7d2f';
    A.roundRect(ctx, 14, -74, 22, 13, 6);
    ctx.fill();
    A.roundRect(ctx, 14, -57, 22, 13, 6);
    ctx.fill();
    ctx.fillStyle = '#15471a';
    circle(ctx, 34, -68, 5.5);
    circle(ctx, 34, -51, 5.5);
    ctx.fillStyle = '#15471a';
    circle(ctx, -6, -70, 4.5);
    ctx.fillStyle = '#ffffff';
    circle(ctx, -7, -71, 1.6);
  }

  function drawCherryBomb(ctx, t) {
    ctx.translate(0, Math.sin(t * 3) * 2);
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-2, -22);
    ctx.moveTo(-2, -22); ctx.lineTo(-16, -28);
    ctx.moveTo(-2, -22); ctx.lineTo(12, -26);
    ctx.stroke();
    ctx.fillStyle = '#2e7d32';
    ellipse(ctx, -18, -40, 8, 4, 0.6);
    ellipse(ctx, 12, -40, 8, 4, -0.6);

    ctx.fillStyle = rgrad(ctx, -16, -32, 15, '#ff5b5b', '#c62828');
    circle(ctx, -16, -32, 14);
    ctx.fillStyle = rgrad(ctx, 12, -30, 15, '#ff5b5b', '#c62828');
    circle(ctx, 12, -30, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    circle(ctx, -20, -38, 4);
    circle(ctx, 8, -36, 4);

    ctx.fillStyle = '#ffffff';
    circle(ctx, -20, -34, 3); circle(ctx, -12, -34, 3);
    circle(ctx, 8, -32, 3); circle(ctx, 16, -32, 3);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -20, -33, 1.4); circle(ctx, -12, -33, 1.4);
    circle(ctx, 8, -31, 1.4); circle(ctx, 16, -31, 1.4);

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-16, -27, 4, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, -25, 4, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  function drawTallnut(ctx, t, hpRatio) {
    ctx.translate(0, Math.sin(t * 1.4) * 1.5);
    ctx.fillStyle = rgrad(ctx, 0, -44, 26, '#c98a4e', '#9c6531');
    ellipse(ctx, 0, -44, 25, 35, 0);
    ctx.fillStyle = '#8d5f2e';
    ellipse(ctx, 0, -16, 25, 17, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ellipse(ctx, -8, -60, 9, 9, -0.4);
    ctx.fillStyle = '#5d3a1a';
    circle(ctx, -9, -48, 4);
    circle(ctx, 9, -48, 4);
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -36, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();
    if (hpRatio < 0.7) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, -30); ctx.lineTo(-10, -24); ctx.lineTo(-14, -18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, -66); ctx.lineTo(17, -60);
      ctx.stroke();
    }
    if (hpRatio < 0.35) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.beginPath();
      ctx.moveTo(-20, -54); ctx.lineTo(-16, -46); ctx.lineTo(-20, -40);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -42); ctx.lineTo(14, -34); ctx.lineTo(18, -28);
      ctx.stroke();
      ctx.strokeStyle = '#5d3a1a';
      ctx.beginPath();
      ctx.arc(0, -28, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  function drawPotatoMine(ctx, t, armed) {
    ctx.translate(0, Math.sin(t * 2) * 1.5);
    if (armed) {
      ctx.fillStyle = rgrad(ctx, 0, -20, 21, '#bca093', '#8d6e63');
      ellipse(ctx, 0, -20, 20, 18, 0);
      ctx.fillStyle = '#8d6e63';
      ellipse(ctx, 0, -8, 20, 10, 0);
      ctx.fillStyle = '#5d4037';
      circle(ctx, -10, -28, 3);
      circle(ctx, 8, -30, 2.5);
      ctx.fillStyle = '#4caf50';
      ellipse(ctx, 4, -40, 9, 4, 0.5);
      ctx.fillStyle = '#ffffff';
      circle(ctx, -8, -26, 4);
      circle(ctx, 8, -26, 4);
      ctx.fillStyle = '#1a1a1a';
      circle(ctx, -8, -25, 2);
      circle(ctx, 8, -25, 2);
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -18, 6, 0.15, Math.PI - 0.15);
      ctx.stroke();
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -16); ctx.lineTo(-3, -19); ctx.moveTo(-3, -19); ctx.lineTo(0, -16);
      ctx.moveTo(0, -16); ctx.lineTo(3, -19); ctx.moveTo(3, -19); ctx.lineTo(6, -16);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#8d6e63';
      ellipse(ctx, 0, -12, 15, 13, 0);
      ctx.fillStyle = '#6d4c41';
      ellipse(ctx, 0, -4, 15, 8, 0);
      ctx.fillStyle = '#4caf50';
      ellipse(ctx, 2, -26, 7, 3.5, 0.5);
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-9, -16); ctx.lineTo(-3, -16); ctx.moveTo(4, -16); ctx.lineTo(10, -16);
      ctx.stroke();
    }
  }

  function drawSquash(ctx, t, phase) {
    let lift = 0, tilt = 0;
    if (phase >= 0) {
      const f = Math.min(1, phase);
      const riseK = Math.min(1, f / 0.15);
      const fallK = Math.max(0, (f - 0.15) / 0.85);
      lift = 120 * riseK * (1 - fallK);
      tilt = 0.5 * riseK * (1 - fallK);
    }
    ctx.translate(0, -lift);
    ctx.rotate(tilt);
    ctx.translate(0, Math.sin(t * 2) * 2);

    ctx.fillStyle = rgrad(ctx, 0, -33, 27, '#81c784', '#43a047');
    ellipse(ctx, 0, -33, 26, 31, 0);
    ctx.fillStyle = '#43a047';
    ellipse(ctx, 0, -14, 26, 14, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ellipse(ctx, -10, -47, 9, 9, -0.4);
    ctx.fillStyle = '#2e7d32';
    ellipse(ctx, 16, -57, 12, 5, -0.4);
    ctx.fillStyle = '#ffffff';
    circle(ctx, -12, -39, 6);
    circle(ctx, 12, -39, 6);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -13, -39, 3);
    circle(ctx, 11, -39, 3);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -29, 8, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  function drawJalapeno(ctx, t) {
    ctx.translate(0, Math.sin(t * 2.4) * 1.5);
    // 茎
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -44); ctx.lineTo(2, -58); ctx.lineTo(10, -62);
    ctx.stroke();
    // 椒身（弯曲红椒）
    ctx.fillStyle = rgrad(ctx, 0, -20, 18, '#ff6b4a', '#c62828');
    ctx.beginPath();
    ctx.moveTo(-4, -52);
    ctx.quadraticCurveTo(-22, -36, -10, -6);
    ctx.quadraticCurveTo(0, 6, 12, -4);
    ctx.quadraticCurveTo(22, -34, 4, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-6, -34, 3, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 表情
    ctx.fillStyle = '#fff';
    circle(ctx, -4, -24, 3);
    circle(ctx, 8, -24, 3);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -4, -24, 1.5);
    circle(ctx, 8, -24, 1.5);
  }

  function drawSpikeweed(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.6) * 1);
    // 地刺：地面上的尖刺星（金属灰）
    ctx.save();
    ctx.translate(0, -10);
    ctx.rotate(t * 0.4);
    ctx.fillStyle = '#9e9e9e';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-5, -16);
      ctx.lineTo(5, -16);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#bdbdbd' : '#9e9e9e';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#616161';
    circle(ctx, 0, -10, 7);
    ctx.fillStyle = '#9e9e9e';
    circle(ctx, 0, -10, 4);
  }

  function drawTorchwood(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.4) * 1);
    // 树桩
    ctx.fillStyle = rgrad(ctx, 0, -28, 20, '#a9763f', '#6d4c2b');
    ellipse(ctx, 0, -28, 20, 22, 0);
    ctx.fillStyle = '#7a5230';
    ellipse(ctx, 0, -12, 20, 11, 0);
    // 年轮
    ctx.strokeStyle = 'rgba(60,40,20,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -28, 11, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -28, 5, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 火焰（顶部跳动）
    const f = (Math.sin(t * 8) + 1) * 0.5;
    ctx.fillStyle = rgrad(ctx, 0, -52, 14, '#fff59d', '#ff7043');
    ellipse(ctx, 0, -52 - f * 3, 9 + f * 2, 14 + f * 3, 0);
    ctx.fillStyle = '#ffca28';
    ellipse(ctx, 0, -50 - f * 3, 4, 8, 0);
  }

  function drawChomper(ctx, t, chomping) {
    const bite = chomping > 0 ? Math.abs(Math.sin(chomping * 18)) : (Math.sin(t * 2) * 0.5 + 0.5);
    ctx.translate(0, Math.sin(t * 1.6) * 1.5);
    // 茎
    ctx.fillStyle = '#3f9d3f';
    A.roundRect(ctx, -6, -34, 12, 36, 5);
    ctx.fill();
    // 张开的血盆大口
    const open = 6 + bite * 26;
    ctx.fillStyle = rgrad(ctx, 0, -52, 24, '#7ed957', '#388e3c');
    ellipse(ctx, 0, -52, 24, 22, 0);
    // 口腔
    ctx.fillStyle = '#7a1f1f';
    ellipse(ctx, 0, -48 + open * 0.3, 17, open, 0);
    // 牙齿
    ctx.fillStyle = '#fff';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7 - 3, -48 - open * 0.5);
      ctx.lineTo(i * 7, -48 - open * 0.5 + 6);
      ctx.lineTo(i * 7 + 3, -48 - open * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(i * 7 - 3, -48 + open * 0.5);
      ctx.lineTo(i * 7, -48 + open * 0.5 - 6);
      ctx.lineTo(i * 7 + 3, -48 + open * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    // 眼
    ctx.fillStyle = '#fff';
    circle(ctx, -10, -64, 5);
    circle(ctx, 10, -64, 5);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -10, -64, 2.4);
    circle(ctx, 10, -64, 2.4);
  }

  // ===== 新增植物绘制 =====

  function drawPuffshroom(ctx, t) {
    ctx.translate(0, Math.sin(t * 2) * 1.5);
    ctx.fillStyle = '#e8e0c8';
    A.roundRect(ctx, -5, -28, 10, 28, 4);
    ctx.fill();
    ctx.fillStyle = rgrad(ctx, 0, -34, 17, '#d7ccc8', '#a1887f');
    ellipse(ctx, 0, -34, 16, 13, 0);
    ctx.fillStyle = '#5d4037';
    circle(ctx, -5, -36, 2.5);
    circle(ctx, 5, -36, 2.5);
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -30, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // 孢子云
    ctx.fillStyle = 'rgba(200,180,160,0.35)';
    circle(ctx, 12, -42, 5);
    circle(ctx, -10, -46, 4);
  }

  function drawFumeshroom(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.8) * 1.5);
    ctx.fillStyle = '#9c8c78';
    A.roundRect(ctx, -6, -34, 12, 34, 5);
    ctx.fill();
    ctx.fillStyle = rgrad(ctx, 0, -42, 20, '#a1887f', '#6d4c41');
    ellipse(ctx, 0, -42, 19, 16, 0);
    // 烟雾
    ctx.fillStyle = 'rgba(180,170,160,0.4)';
    ellipse(ctx, 14, -50, 10, 7, 0.4);
    ellipse(ctx, -12, -54, 8, 5, -0.3);
    ctx.fillStyle = '#3e2723';
    circle(ctx, -6, -44, 2.8);
    circle(ctx, 6, -44, 2.8);
  }

  function drawDormium(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.6) * 1.5);
    ctx.fillStyle = '#7b1fa2';
    A.roundRect(ctx, -5, -32, 10, 32, 5);
    ctx.fill();
    ctx.fillStyle = rgrad(ctx, 0, -40, 18, '#ce93d8', '#7b1fa2');
    ellipse(ctx, 0, -40, 17, 15, 0);
    // 催眠螺旋
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -40, 8, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2, -38, 4, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    ctx.fillStyle = '#ffe082';
    circle(ctx, -5, -44, 3);
    circle(ctx, 5, -44, 3);
  }

  function drawThreepeater(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);
    leaf(ctx, -10, -30, 16, 6, -0.5, '#3e8f3e');
    leaf(ctx, 8, -34, 16, 6, 0.5, '#3e8f3e');
    ctx.fillStyle = '#3f9d3f';
    A.roundRect(ctx, -5, -46, 10, 44, 5);
    ctx.fill();
    // 三个头：上/中/下
    const heads = [[-62, -4], [-62, 0], [-62, 4]];
    heads.forEach(([dy], i) => {
      ctx.fillStyle = rgrad(ctx, 2 + (i - 1) * 8, dy, 18, '#7ed957', '#3f9d3f');
      circle(ctx, 2 + (i - 1) * 8, dy, 18);
      ctx.fillStyle = '#2f7d2f';
      A.roundRect(ctx, 11 + (i - 1) * 8, dy - 8, 16, 11, 5);
      ctx.fill();
      ctx.fillStyle = '#15471a';
      circle(ctx, 26 + (i - 1) * 8, dy, 5);
    });
    ctx.fillStyle = '#15471a';
    circle(ctx, -6, -70, 4);
    ctx.fillStyle = '#fff';
    circle(ctx, -7, -71, 1.5);
  }

  function drawSpikeRock(ctx, t, hpRatio) {
    ctx.translate(0, Math.sin(t * 1.4) * 1);
    // 地刺王：更大的金属尖刺球
    ctx.save();
    ctx.translate(0, -12);
    ctx.rotate(t * 0.3);
    ctx.fillStyle = '#78909c';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-6, -22);
      ctx.lineTo(6, -22);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#90a4ae' : '#78909c';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#546e7a';
    circle(ctx, 0, -12, 11);
    ctx.fillStyle = '#90a4ae';
    circle(ctx, 0, -12, 6);
    // 裂痕
    if (hpRatio < 0.6) {
      ctx.strokeStyle = '#455a64';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -18); ctx.lineTo(-2, -12); ctx.lineTo(-5, -6);
      ctx.stroke();
    }
  }

  function drawPlantern(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.8) * 1.5);
    ctx.fillStyle = '#81c784';
    A.roundRect(ctx, -5, -36, 10, 36, 5);
    ctx.fill();
    // 灯笼罩
    ctx.fillStyle = 'rgba(255,245,157,0.7)';
    ellipse(ctx, 0, -48, 18, 22, 0);
    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -48, 18, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 发光核心
    ctx.fillStyle = rgrad(ctx, 0, -48, 10, '#fff9c4', '#ffeb3b');
    circle(ctx, 0, -48, 10);
    // 光线
    ctx.strokeStyle = 'rgba(255,235,59,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, -48 + Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * 24, -48 + Math.sin(a) * 24);
      ctx.stroke();
    }
    ctx.fillStyle = '#33691e';
    circle(ctx, -5, -52, 2.5);
    circle(ctx, 5, -52, 2.5);
  }

  function drawMagnetshroom(ctx, t) {
    ctx.translate(0, Math.sin(t * 2) * 1.5);
    ctx.fillStyle = '#b39ddb';
    A.roundRect(ctx, -5, -32, 10, 32, 5);
    ctx.fill();
    ctx.fillStyle = rgrad(ctx, 0, -40, 17, '#d1c4e9', '#7e57c2');
    ellipse(ctx, 0, -40, 16, 13, 0);
    // 磁铁
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(-10, -56, 20, 6);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-10, -56, 9, 6);
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(1, -56, 9, 6);
    // 磁力线
    ctx.strokeStyle = 'rgba(100,100,220,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, -53); ctx.quadraticCurveTo(-24, -40, -14, -28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, -53); ctx.quadraticCurveTo(24, -40, 14, -28);
    ctx.stroke();
    ctx.fillStyle = '#311b92';
    circle(ctx, -5, -43, 2.5);
    circle(ctx, 5, -43, 2.5);
  }

  function drawPumpkin(ctx, t, hpRatio) {
    ctx.translate(0, Math.sin(t * 1.4) * 1.5);
    ctx.fillStyle = rgrad(ctx, 0, -30, 26, '#ff9800', '#e65100');
    ellipse(ctx, 0, -30, 25, 23, 0);
    // 南瓜纹
    ctx.strokeStyle = 'rgba(230,101,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -30, 9, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -51); ctx.lineTo(0, -10);
    ctx.stroke();
    // 瓜蒂
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(-3, -54, 6, 6);
    // 表情
    ctx.fillStyle = '#3e2723';
    triangle(ctx, -9, -34, -5, -28, -13, -28);
    triangle(ctx, 9, -34, 13, -28, 5, -28);
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -24, 7, 0.25, Math.PI - 0.25);
    ctx.stroke();
    if (hpRatio < 0.5) {
      ctx.strokeStyle = '#bf360c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, -20); ctx.lineTo(-10, -14); ctx.lineTo(-14, -8);
      ctx.stroke();
    }
  }

  function triangle(ctx, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
    ctx.closePath(); ctx.fill();
  }

  function drawMelonpult(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.8) * 1.5);
    ctx.fillStyle = '#558b2f';
    A.roundRect(ctx, -6, -42, 12, 42, 5);
    ctx.fill();
    // 投掷头部（西瓜状）
    ctx.fillStyle = rgrad(ctx, 4, -58, 20, '#81c784', '#388e3c');
    ellipse(ctx, 4, -58, 19, 17, 0);
    ctx.fillStyle = '#2e7d32';
    ellipse(ctx, 4, -52, 19, 8, 0);
    // 条纹
    ctx.strokeStyle = 'rgba(46,125,50,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(4, -58, 6, 15, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1b5e20';
    circle(ctx, -2, -62, 3.5);
    ctx.fillStyle = '#fff';
    circle(ctx, -3, -63, 1.3);
  }

  function drawCobaltion(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.6) * 1);
    ctx.fillStyle = '#546e7a';
    A.roundRect(ctx, -8, -40, 16, 40, 6);
    ctx.fill();
    // 炮管
    ctx.fillStyle = '#37474f';
    ctx.fillRect(6, -68, 22, 14);
    ctx.fillStyle = '#263238';
    ellipse(ctx, 28, -61, 8, 10, 0);
    // 炮塔基座
    ctx.fillStyle = '#78909c';
    ellipse(ctx, 0, -44, 16, 12, 0);
    // 瞄准指示器
    ctx.fillStyle = '#ff5252';
    circle(ctx, 0, -52, 4);
    ctx.fillStyle = '#ffcdd2';
    circle(ctx, 0, -52, 1.5);
  }

  function drawKernelpult(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.8) * 1.5);
    ctx.fillStyle = '#fdd835';
    A.roundRect(ctx, -6, -40, 12, 40, 5);
    ctx.fill();
    // 玉米头部
    ctx.fillStyle = rgrad(ctx, 4, -54, 18, '#ffee58', '#f9a825');
    ellipse(ctx, 4, -54, 17, 15, 0);
    // 玉米粒纹理
    ctx.fillStyle = '#f57f17';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      circle(ctx, 4 + Math.cos(a) * 9, -54 + Math.sin(a) * 8, 2.5);
    }
    ctx.fillStyle = '#e65100';
    circle(ctx, -2, -58, 3);
    ctx.fillStyle = '#fff';
    circle(ctx, -3, -59, 1.2);
  }

  function drawCoffeebean(ctx, t) {
    ctx.translate(0, Math.sin(t * 2.5) * 1);
    // 咖啡豆形状
    ctx.fillStyle = rgrad(ctx, 0, -18, 16, '#8d6e63', '#4e342e');
    ctx.beginPath();
    ctx.ellipse(0, -18, 14, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // 中线裂缝
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -18);
    ctx.quadraticCurveTo(0, -12, 10, -18);
    ctx.stroke();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-4, -22, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 蒸汽
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    ellipse(ctx, -4, -32, 4, 6, -0.2);
    ellipse(ctx, 5, -36, 3, 5, 0.2);
  }

  A.drawPlant = function (ctx, type, x, y, t, hpRatio, scale, extra) {
    ctx.save();
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    extra = extra || {};
    // 可选：真实精灵图集优先（CC0）。未加载时回退程序化绘制。
    if (PVZ.sprites.draw(ctx, 'plant:' + type, 0, 0, 1, true)) { ctx.restore(); return; }
    // 落地软投影，增加层次感
    A.softShadow(ctx, 0, 2, 22, 7, 0.15);
    if (type === 'peashooter') drawPeashooter(ctx, t);
    else if (type === 'snowpea') drawSnowpea(ctx, t);
    else if (type === 'repeater') drawRepeater(ctx, t);
    else if (type === 'sunflower') drawSunflower(ctx, t);
    else if (type === 'sunshroom') drawSunshroom(ctx, t);
    else if (type === 'wallnut') drawWallnut(ctx, t, hpRatio === undefined ? 1 : hpRatio);
    else if (type === 'tallnut') drawTallnut(ctx, t, hpRatio === undefined ? 1 : hpRatio);
    else if (type === 'cherrybomb') drawCherryBomb(ctx, t);
    else if (type === 'potatomine') drawPotatoMine(ctx, t, !!extra.armed);
    else if (type === 'squash') drawSquash(ctx, t, extra.phase === undefined ? -1 : extra.phase);
    else if (type === 'jalapeno') drawJalapeno(ctx, t);
    else if (type === 'spikeweed') drawSpikeweed(ctx, t);
    else if (type === 'spikeRock') drawSpikeRock(ctx, t, hpRatio === undefined ? 1 : hpRatio);
    else if (type === 'torchwood') drawTorchwood(ctx, t);
    else if (type === 'chomper') drawChomper(ctx, t, extra.chomping || 0);
    else if (type === 'puffshroom') drawPuffshroom(ctx, t);
    else if (type === 'fumeshroom') drawFumeshroom(ctx, t);
    else if (type === 'dormium') drawDormium(ctx, t);
    else if (type === 'threepeater') drawThreepeater(ctx, t);
    else if (type === 'plantern') drawPlantern(ctx, t);
    else if (type === 'magnetshroom') drawMagnetshroom(ctx, t);
    else if (type === 'pumpkin') drawPumpkin(ctx, t, hpRatio === undefined ? 1 : hpRatio);
    else if (type === 'melonpult') drawMelonpult(ctx, t);
    else if (type === 'cobaltion') drawCobaltion(ctx, t);
    else if (type === 'kernelpult') drawKernelpult(ctx, t);
    else if (type === 'coffeebean') drawCoffeebean(ctx, t);
    else { // fallback: 画个绿色圆圈 + 名字
      ctx.fillStyle = '#4caf50';
      circle(ctx, 0, -30, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(type, 0, -28);
    }
    ctx.restore();
  };

  // ===== 僵尸 =====
  // 原点 (0,0) = 底部中心，朝向左侧
  // opts: { slow, headgear:'cone'|'bucket', armor:'screen'|'football'|'bucket',
  //         raged, boss:'gargantuar'|'zombot', noHead, pole }

  const ZOMBIE_PAL = {
    normal: { head: '#a6b078', torso: '#7c8a5e', suitLine: '#66734a', arm: '#9aa05e', arm2: '#8a9152', leg: '#4a4a4a', shoe: '#3a3a3a' },
    frozen: { head: '#9fc4d8', torso: '#7fa3b8', suitLine: '#6a8794', arm: '#8fb4c8', arm2: '#7fa3b8', leg: '#56707f', shoe: '#466070' },
    raged: { head: '#c98a8a', torso: '#9a5e5e', suitLine: '#7a4a4a', arm: '#b07a7a', arm2: '#9a6a6a', leg: '#4a4a4a', shoe: '#3a3a3a' }
  };

  function drawConeHat(ctx) {
    ctx.fillStyle = '#ff8f00';
    ctx.beginPath();
    ctx.moveTo(-2, -96); ctx.lineTo(-16, -64); ctx.lineTo(12, -64);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, -88); ctx.lineTo(-7, -76);
    ctx.moveTo(4, -90); ctx.lineTo(2, -78);
    ctx.stroke();
  }

  function drawBucketHat(ctx) {
    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath();
    ctx.arc(-2, -82, 17, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#bdbdbd';
    ctx.fillRect(-16, -84, 30, 5);
    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -82, 17, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-10, -92, 6, 10);
  }

  function drawScreenDoor(ctx) {
    // 身前的铁丝门板（护甲）
    ctx.save();
    ctx.translate(-30, -38);
    ctx.fillStyle = 'rgba(180,180,190,0.85)';
    ctx.fillRect(-14, -26, 28, 56);
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 3;
    ctx.strokeRect(-14, -26, 28, 56);
    ctx.lineWidth = 1.5;
    for (let i = -12; i <= 12; i += 6) {
      ctx.beginPath(); ctx.moveTo(i, -26); ctx.lineTo(i, 30); ctx.stroke();
    }
    for (let j = -24; j <= 28; j += 7) {
      ctx.beginPath(); ctx.moveTo(-14, j); ctx.lineTo(14, j); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFootballGear(ctx) {
    // 肩甲 + 头盔
    ctx.fillStyle = '#c62828';
    ellipse(ctx, -2, -54, 20, 12, 0); // 肩甲
    ctx.fillStyle = '#e53935';
    ellipse(ctx, -2, -54, 14, 8, 0);
    ctx.fillStyle = '#bdbdbd';
    ctx.beginPath();
    ctx.arc(-2, -70, 13, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -70, 13, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-3, -74, 3, 8); // 头盔条纹
  }

  A.drawZombieHead = function (ctx, opts) {
    opts = opts || {};
    const pal = opts.raged ? ZOMBIE_PAL.raged : opts.slow ? ZOMBIE_PAL.frozen : ZOMBIE_PAL.normal;

    ctx.fillStyle = pal.head;
    circle(ctx, -2, -68, 16);

    ctx.fillStyle = '#f0f0f0';
    circle(ctx, -8, -70, 5);
    circle(ctx, 4, -70, 5);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -9, -70, 2.4);
    circle(ctx, 3, -70, 2.4);

    // 嘴
    ctx.fillStyle = '#2e2e2e';
    ctx.beginPath();
    ctx.arc(-2, -57, 5, 0.15, Math.PI - 0.15);
    ctx.fill();

    if (opts.raged) {
      // 怒眉
      ctx.strokeStyle = '#7a1f1f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -76); ctx.lineTo(-4, -72);
      ctx.moveTo(9, -76); ctx.lineTo(0, -72);
      ctx.stroke();
    }

    if (opts.headgear === 'cone') drawConeHat(ctx);
    else if (opts.headgear === 'bucket') drawBucketHat(ctx);
    else if (opts.armor === 'bucket') drawBucketHat(ctx);
  };

  A.drawZombieBody = function (ctx, x, y, t, state, opts) {
    ctx.save();
    ctx.translate(x, y);
    opts = opts || {};
    if (opts.boss) ctx.scale(1.7, 1.7); // Boss 体型放大
    if (opts.scale) ctx.scale(opts.scale, opts.scale); // 按布局格宽统一缩放
    // 可选：真实精灵图集优先。未加载时回退程序化绘制。
    if (PVZ.sprites.draw(ctx, 'zombie:' + (opts.type || 'normal'), 0, 0, 1, true)) { ctx.restore(); return; }
    // 落地软投影
    A.softShadow(ctx, 0, -2, 20, 6, 0.2);

    const pal = opts.raged ? ZOMBIE_PAL.raged : opts.slow ? ZOMBIE_PAL.frozen : ZOMBIE_PAL.normal;

    const walk = Math.sin(t * 6);
    const eat = state === 'eat';
    const jump = state === 'jump';
    const amp = jump ? 2 : 1;

    // 腿
    ctx.strokeStyle = pal.leg;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -22); ctx.lineTo(-8 + walk * 5 * amp, -4);
    ctx.moveTo(4, -22); ctx.lineTo(8 - walk * 5 * amp, -4);
    ctx.stroke();
    ctx.fillStyle = pal.shoe;
    circle(ctx, -8 + walk * 5 * amp, -2, 5);
    circle(ctx, 8 - walk * 5 * amp, -2, 5);

    // 躯干（带高光）
    ctx.fillStyle = pal.torso;
    A.roundRect(ctx, -14, -54, 28, 34, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    A.roundRect(ctx, -12, -52, 8, 30, 4);
    ctx.fill();
    ctx.fillStyle = pal.suitLine;
    ctx.fillRect(-14, -42, 28, 3);

    // 手臂
    ctx.strokeStyle = pal.arm;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (eat) {
      const bite = Math.sin(t * 8);
      ctx.moveTo(-10, -44); ctx.lineTo(-30 + bite * 3, -36);
    } else {
      ctx.moveTo(-10, -44); ctx.lineTo(-20 - walk * 8 * amp, -30);
    }
    ctx.stroke();
    ctx.strokeStyle = pal.arm2;
    ctx.beginPath();
    if (eat) {
      const bite = Math.sin(t * 8);
      ctx.moveTo(8, -44); ctx.lineTo(20 + bite * 3, -30);
    } else {
      ctx.moveTo(8, -44); ctx.lineTo(16 + walk * 8 * amp, -30);
    }
    ctx.stroke();

    // 撑杆
    if (opts.pole) {
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-28, -40); ctx.lineTo(24, -40);
      ctx.stroke();
    }

    // Boss 专属配件
    if (opts.boss === 'gargantuar') {
      // 巨型木棍
      ctx.strokeStyle = '#6d4c2b';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(18, -40); ctx.lineTo(40, -96);
      ctx.stroke();
      ctx.fillStyle = '#8d6e63';
      circle(ctx, 40, -98, 12);
    } else if (opts.boss === 'zombot') {
      // 机械履带
      ctx.fillStyle = '#37474f';
      A.roundRect(ctx, -18, -16, 36, 14, 6);
      ctx.fill();
      ctx.fillStyle = '#90a4ae';
      circle(ctx, -10, -9, 4);
      circle(ctx, 0, -9, 4);
      circle(ctx, 10, -9, 4);
      // 单眼发光
      ctx.fillStyle = '#ff5252';
      circle(ctx, -2, -64, 6);
    }

    if (!opts.noHead) {
      const headOpts = Object.assign({}, opts);
      A.drawZombieHead(ctx, headOpts);
    }

    // 身体护甲（在头/身之后绘制，覆盖在身前）
    if (opts.armor === 'screen') drawScreenDoor(ctx);
    else if (opts.armor === 'football') drawFootballGear(ctx);

    // ===== 新增僵尸配件 =====

    // 气球
    if (opts.balloon) {
      ctx.fillStyle = '#ef5350';
      circle(ctx, 4, -110, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      circle(ctx, 0, -114, 5);
      // 绳子
      ctx.strokeStyle = '#bdbdbd';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, -96); ctx.lineTo(-2, -82);
      ctx.stroke();
    }

    // 潜水（呼吸管）
    if (opts.snorkel) {
      ctx.strokeStyle = '#ffab00';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, -78); ctx.lineTo(16, -100);
      ctx.stroke();
      ctx.fillStyle = '#ffca28';
      circle(ctx, 17, -102, 4);
    }

    // 小丑（彩衣）
    if (opts.jackbox) {
      ctx.fillStyle = '#e91e63';
      A.roundRect(ctx, -16, -50, 32, 28, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      circle(ctx, -8, -72, 4);
      circle(ctx, 8, -72, 4);
      ctx.fillStyle = '#f44336';
      circle(ctx, -8, -72, 2);
      circle(ctx, 8, -72, 2);
      // 红鼻子
      ctx.fillStyle = '#ff5722';
      circle(ctx, -2, -62, 4);
    }

    // 投石车（机械臂）
    if (opts.catapult) {
      ctx.fillStyle = '#607d8b';
      A.roundRect(ctx, -12, -64, 24, 18, 4);
      ctx.fill();
      // 投臂
      ctx.strokeStyle = '#455a64';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const armAngle = Math.sin(t * 1.5) * 0.25;
      ctx.save();
      ctx.translate(10, -56);
      ctx.rotate(-0.6 + armAngle);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, -8); ctx.stroke();
      // 篮筐
      ctx.fillStyle = '#78909c';
      ctx.beginPath();
      ctx.arc(24, -9, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 蹦极（钩子+绳）
    if (opts.bungee) {
      ctx.strokeStyle = '#9e9e9e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2, -84); ctx.lineTo(-2, -130);
      ctx.stroke();
      ctx.fillStyle = '#ff6f00';
      // 钩子
      ctx.beginPath();
      ctx.moveTo(-6, -130); ctx.lineTo(2, -122); ctx.lineTo(2, -130);
      ctx.closePath();
      ctx.fill();
    }

    // 矿工（安全帽+矿灯）
    if (opts.digger) {
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(-2, -86, 13, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, -86, 13, Math.PI, 0);
      ctx.stroke();
      // 矿灯
      ctx.fillStyle = 'rgba(255,235,59,0.7)';
      circle(ctx, -2, -98, 5);
      // 镐子（右手）
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(16, -40); ctx.lineTo(34, -58);
      ctx.stroke();
      ctx.fillStyle = '#6d4c41';
      ellipse(ctx, 36, -60, 6, 3, 0.4);
    }

    // 雪人（白色毛发）
    if (opts.yeti) {
      // 覆盖头部为白色
      ctx.fillStyle = '#eceff1';
      circle(ctx, -2, -68, 17);
      ctx.fillStyle = '#cfd8dc';
      A.roundRect(ctx, -15, -52, 30, 34, 8);
      ctx.fill();
      // 眼
      ctx.fillStyle = '#1565c0';
      circle(ctx, -8, -70, 4.5);
      circle(ctx, 4, -70, 4.5);
      ctx.fillStyle = '#fff';
      circle(ctx, -8, -71, 1.5);
      circle(ctx, 4, -71, 1.5);
      // 嘴
      ctx.strokeStyle = '#90a4ae';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, -60, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // 舞王（迪斯科风格）
    if (opts.dancing) {
      ctx.fillStyle = '#fff176';
      A.roundRect(ctx, -15, -54, 30, 34, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      A.roundRect(ctx, -13, -52, 10, 30, 4);
      ctx.fill();
      // 假发/墨镜
      ctx.fillStyle = '#212121';
      ellipse(ctx, -2, -76, 18, 7, 0);
      // 迪斯科领结
      ctx.fillStyle = '#e91e63';
      ellipse(ctx, -2, -46, 6, 4, 0);
      // 跳舞姿势手臂
      ctx.strokeStyle = '#fff176';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-15, -48); ctx.lineTo(-30 + Math.sin(t * 10) * 6, -60);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(15, -48); ctx.lineTo(30 - Math.sin(t * 10) * 6, -60);
      ctx.stroke();
      // 头复绘（覆盖在假发上）
      ctx.fillStyle = '#a6b078';
      circle(ctx, -2, -68, 16);
      ctx.fillStyle = '#f0f0f0';
      circle(ctx, -8, -70, 5);
      circle(ctx, 4, -70, 5);
    }

    ctx.restore();
  };

  // ===== 子弹 =====

  A.drawPea = function (ctx, x, y, ice, fire) {
    // 拖尾光晕（廉价半透明圆，制造运动模糊感）
    ctx.save();
    ctx.globalAlpha = 0.22;
    if (fire) circle(ctx, x - 6, y, 9, '#ff7043');
    else if (ice) circle(ctx, x - 4, y, 8, '#81d4fa');
    else circle(ctx, x - 4, y, 8, '#8bc34a');
    ctx.restore();
    if (fire) {
      ctx.fillStyle = rgrad(ctx, x, y, 9, '#fff176', '#ff7043');
      circle(ctx, x, y, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      circle(ctx, x - 3, y - 3, 3);
    } else if (ice) {
      circle(ctx, x, y, 8, '#81d4fa');
      circle(ctx, x - 2.5, y - 2.5, 3, 'rgba(255,255,255,0.75)');
    } else {
      circle(ctx, x, y, 8, '#8bc34a');
      circle(ctx, x - 2.5, y - 2.5, 3, 'rgba(255,255,255,0.55)');
    }
  };

  // ===== 阳光 =====

  A.drawSun = function (ctx, x, y, t, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.7);
    // 外发光晕（两层柔光，廉价且有体积感）
    const pulse = 1 + Math.sin(t * 3) * 0.05;
    ctx.fillStyle = 'rgba(255,214,79,0.14)';
    circle(ctx, 0, 0, (r + 15) * pulse);
    ctx.fillStyle = 'rgba(255,214,79,0.18)';
    circle(ctx, 0, 0, (r + 9) * pulse);
    ctx.fillStyle = 'rgba(255,214,79,0.55)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ellipse(ctx, Math.cos(a) * (r + 11), Math.sin(a) * (r + 11), 9, 4, a);
    }
    ctx.fillStyle = rgrad(ctx, 0, 0, r, '#fff59d', '#ffb300');
    circle(ctx, 0, 0, r);
    ctx.restore();
  };

  // ===== 铲子图标（HUD） =====

  A.drawShovel = function (ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#c8a06a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -8); ctx.lineTo(2, 4);
    ctx.stroke();
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.lineTo(7, 4);
    ctx.lineTo(4, 12);
    ctx.lineTo(-4, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // ===== 飘字 =====

  A.drawFloatingText = function (ctx, x, y, text, color, alpha) {
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  };

  // ===== 爆炸特效 =====

  A.drawExplosion = function (ctx, x, y, f) {
    const r = 12 + f * 75;
    ctx.save();
    ctx.globalAlpha = 1 - f;
    circle(ctx, x, y, r, '#ff9800');
    circle(ctx, x, y, r * 0.72, '#ffd54f');
    circle(ctx, x, y, r * 0.4, '#fff3e0');
    // 冲击波环
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - f)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    // 放射火花
    ctx.strokeStyle = '#ff6d00';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + f * 2;
      const len = r * (0.9 + Math.sin(i * 3.7 + f * 10) * 0.25);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // 飞溅亮点
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - f * 3;
      const rr = r * (0.5 + f * 0.6);
      ctx.fillStyle = '#fff3e0';
      circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 3 * (1 - f));
    }
    ctx.restore();
  };
})();
