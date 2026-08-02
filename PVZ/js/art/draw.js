// 程序化矢量绘制：所有角色/特效均由代码绘制，无图片资源
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

  function drawPeashooter(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);

    ctx.fillStyle = '#3e8f3e';
    ellipse(ctx, -10, -30, 16, 6, -0.5);
    ellipse(ctx, 8, -34, 16, 6, 0.5);

    ctx.fillStyle = '#4caf50';
    A.roundRect(ctx, -4, -46, 8, 42, 4);
    ctx.fill();

    ctx.fillStyle = '#66bb6a';
    circle(ctx, 2, -62, 25);
    ctx.fillStyle = '#4caf50';
    circle(ctx, 7, -58, 22);

    ctx.fillStyle = '#43a047';
    A.roundRect(ctx, 14, -70, 20, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#1b5e20';
    circle(ctx, 34, -63, 6);

    ctx.fillStyle = '#1b5e20';
    circle(ctx, -6, -70, 4.5);
    ctx.fillStyle = '#ffffff';
    circle(ctx, -7, -71, 1.6);
  }

  function drawSunflower(ctx, t) {
    ctx.translate(0, Math.sin(t * 1.8) * 2.5);

    ctx.fillStyle = '#4caf50';
    A.roundRect(ctx, -4, -54, 8, 50, 4);
    ctx.fill();
    ctx.fillStyle = '#3e8f3e';
    ellipse(ctx, -14, -34, 15, 6, 0.7);
    ellipse(ctx, 12, -40, 15, 6, -0.5);

    const cx = 0, cy = -76, pr = 20;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? '#ffd54f' : '#ffca28';
      ellipse(ctx, cx + Math.cos(a) * (pr + 7), cy + Math.sin(a) * (pr + 7), 8, 5, a);
    }

    ctx.fillStyle = '#8d5524';
    circle(ctx, cx, cy, pr);
    ctx.fillStyle = '#6d3f16';
    circle(ctx, cx + 5, cy + 5, pr - 6);

    ctx.fillStyle = '#4a2a0e';
    circle(ctx, cx - 7, cy - 4, 3.5);
    circle(ctx, cx + 7, cy - 4, 3.5);
    ctx.strokeStyle = '#4a2a0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy + 3, 9, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  function drawWallnut(ctx, t, hpRatio) {
    ctx.translate(0, Math.sin(t * 1.4) * 1.5);

    ctx.fillStyle = '#b0793f';
    ellipse(ctx, 0, -30, 25, 27, 0);
    ctx.fillStyle = '#8d5f2e';
    ellipse(ctx, 0, -8, 25, 13, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ellipse(ctx, -8, -44, 10, 10, -0.4);

    ctx.fillStyle = '#5d3a1a';
    circle(ctx, -9, -34, 4);
    circle(ctx, 9, -34, 4);
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -22, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();

    if (hpRatio < 0.7) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(-8, -12);
      ctx.lineTo(-12, -6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -52);
      ctx.lineTo(15, -46);
      ctx.stroke();
    }
    if (hpRatio < 0.35) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.beginPath();
      ctx.moveTo(-18, -40);
      ctx.lineTo(-14, -32);
      ctx.lineTo(-18, -26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -26);
      ctx.lineTo(12, -18);
      ctx.lineTo(16, -12);
      ctx.stroke();
      ctx.strokeStyle = '#5d3a1a';
      ctx.beginPath();
      ctx.arc(0, -14, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  function drawSnowpea(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);

    ctx.fillStyle = '#3e8f3e';
    ellipse(ctx, -10, -30, 16, 6, -0.5);
    ellipse(ctx, 8, -34, 16, 6, 0.5);

    ctx.fillStyle = '#4caf50';
    A.roundRect(ctx, -4, -46, 8, 42, 4);
    ctx.fill();

    ctx.fillStyle = '#a5e3f7';
    circle(ctx, 2, -62, 25);
    ctx.fillStyle = '#81d4fa';
    circle(ctx, 7, -58, 22);

    ctx.fillStyle = '#4fc3f7';
    A.roundRect(ctx, 14, -70, 20, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#0d47a1';
    circle(ctx, 34, -63, 6);

    ctx.fillStyle = '#0d47a1';
    circle(ctx, -6, -70, 4.5);
    ctx.fillStyle = '#ffffff';
    circle(ctx, -7, -71, 1.6);

    ctx.fillStyle = '#e1f5fe';
    ctx.beginPath();
    ctx.moveTo(-2, -92);
    ctx.lineTo(-10, -82);
    ctx.lineTo(6, -82);
    ctx.closePath();
    ctx.fill();
  }

  function drawRepeater(ctx, t) {
    const bob = Math.sin(t * 2.2) * 2;
    ctx.translate(0, bob);

    ctx.fillStyle = '#3e8f3e';
    ellipse(ctx, -10, -30, 16, 6, -0.5);
    ellipse(ctx, 8, -34, 16, 6, 0.5);

    ctx.fillStyle = '#4caf50';
    A.roundRect(ctx, -4, -46, 8, 42, 4);
    ctx.fill();

    ctx.fillStyle = '#66bb6a';
    circle(ctx, 2, -62, 25);
    ctx.fillStyle = '#4caf50';
    circle(ctx, 7, -58, 22);

    ctx.fillStyle = '#43a047';
    A.roundRect(ctx, 14, -74, 20, 12, 6);
    ctx.fill();
    A.roundRect(ctx, 14, -58, 20, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#1b5e20';
    circle(ctx, 34, -68, 5);
    circle(ctx, 34, -52, 5);

    ctx.fillStyle = '#1b5e20';
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
    ctx.moveTo(0, 0);
    ctx.lineTo(-2, -22);
    ctx.moveTo(-2, -22);
    ctx.lineTo(-16, -28);
    ctx.moveTo(-2, -22);
    ctx.lineTo(12, -26);
    ctx.stroke();
    ctx.fillStyle = '#2e7d32';
    ellipse(ctx, -18, -40, 8, 4, 0.6);
    ellipse(ctx, 12, -40, 8, 4, -0.6);

    ctx.fillStyle = '#d32f2f';
    circle(ctx, -16, -32, 14);
    circle(ctx, 12, -30, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    circle(ctx, -20, -38, 5);
    circle(ctx, 8, -36, 5);

    ctx.fillStyle = '#ffffff';
    circle(ctx, -20, -34, 3);
    circle(ctx, -12, -34, 3);
    circle(ctx, 8, -32, 3);
    circle(ctx, 16, -32, 3);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -20, -33, 1.4);
    circle(ctx, -12, -33, 1.4);
    circle(ctx, 8, -31, 1.4);
    circle(ctx, 16, -31, 1.4);

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

    ctx.fillStyle = '#b0793f';
    ellipse(ctx, 0, -42, 24, 34, 0);
    ctx.fillStyle = '#8d5f2e';
    ellipse(ctx, 0, -14, 24, 16, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ellipse(ctx, -8, -58, 10, 10, -0.4);

    ctx.fillStyle = '#5d3a1a';
    circle(ctx, -9, -46, 4);
    circle(ctx, 9, -46, 4);
    ctx.strokeStyle = '#5d3a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -34, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();

    if (hpRatio < 0.7) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, -28);
      ctx.lineTo(-10, -22);
      ctx.lineTo(-14, -16);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, -64);
      ctx.lineTo(17, -58);
      ctx.stroke();
    }
    if (hpRatio < 0.35) {
      ctx.strokeStyle = '#7a4a1f';
      ctx.beginPath();
      ctx.moveTo(-20, -52);
      ctx.lineTo(-16, -44);
      ctx.lineTo(-20, -38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -40);
      ctx.lineTo(14, -32);
      ctx.lineTo(18, -26);
      ctx.stroke();
      ctx.strokeStyle = '#5d3a1a';
      ctx.beginPath();
      ctx.arc(0, -26, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  function drawPotatoMine(ctx, t, armed) {
    ctx.translate(0, Math.sin(t * 2) * 1.5);

    if (armed) {
      ctx.fillStyle = '#a1887f';
      ellipse(ctx, 0, -20, 20, 18, 0);
      ctx.fillStyle = '#8d6e63';
      ellipse(ctx, 0, -8, 20, 10, 0);
      ctx.fillStyle = '#6d4c41';
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
      ctx.moveTo(-6, -16);
      ctx.lineTo(-3, -19);
      ctx.moveTo(-3, -19);
      ctx.lineTo(0, -16);
      ctx.moveTo(0, -16);
      ctx.lineTo(3, -19);
      ctx.moveTo(3, -19);
      ctx.lineTo(6, -16);
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
      ctx.moveTo(-9, -16);
      ctx.lineTo(-3, -16);
      ctx.moveTo(4, -16);
      ctx.lineTo(10, -16);
      ctx.stroke();
    }
  }

  function drawSquash(ctx, t, phase) {
    // phase: -1 = 蹲守贴地；0→1 = 快速起跳升空后砸落
    let lift = 0;
    let tilt = 0;
    if (phase >= 0) {
      const f = Math.min(1, phase);
      const riseK = Math.min(1, f / 0.15);          // 前 15% 快速起跳
      const fallK = Math.max(0, (f - 0.15) / 0.85); // 之后砸落回地面
      lift = 120 * riseK * (1 - fallK);
      tilt = 0.5 * riseK * (1 - fallK);
    }
    ctx.translate(0, -lift);
    ctx.rotate(tilt);
    ctx.translate(0, Math.sin(t * 2) * 2);

    ctx.fillStyle = '#66bb6a';
    ellipse(ctx, 0, -33, 26, 31, 0);
    ctx.fillStyle = '#4caf50';
    ellipse(ctx, 0, -14, 26, 14, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ellipse(ctx, -10, -47, 10, 10, -0.4);

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

  A.drawPlant = function (ctx, type, x, y, t, hpRatio, scale, extra) {
    ctx.save();
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    extra = extra || {};
    if (type === 'peashooter') drawPeashooter(ctx, t);
    else if (type === 'snowpea') drawSnowpea(ctx, t);
    else if (type === 'repeater') drawRepeater(ctx, t);
    else if (type === 'sunflower') drawSunflower(ctx, t);
    else if (type === 'wallnut') drawWallnut(ctx, t, hpRatio === undefined ? 1 : hpRatio);
    else if (type === 'tallnut') drawTallnut(ctx, t, hpRatio === undefined ? 1 : hpRatio);
    else if (type === 'cherrybomb') drawCherryBomb(ctx, t);
    else if (type === 'potatomine') drawPotatoMine(ctx, t, !!extra.armed);
    else if (type === 'squash') drawSquash(ctx, t, extra.phase === undefined ? -1 : extra.phase);
    ctx.restore();
  };

  // ===== 僵尸 =====
  // 原点 (0,0) = 底部中心，朝向左侧
  // opts: { slow: 冰冻色调, headgear: null|'cone'|'bucket', noHead, pole }

  const ZOMBIE_PAL = {
    normal: {
      head: '#a6b078', torso: '#7c8a5e', suitLine: '#66734a',
      arm: '#9aa05e', arm2: '#8a9152', leg: '#4a4a4a', shoe: '#3a3a3a'
    },
    frozen: {
      head: '#9fc4d8', torso: '#7fa3b8', suitLine: '#6a8794',
      arm: '#8fb4c8', arm2: '#7fa3b8', leg: '#56707f', shoe: '#466070'
    }
  };

  A.drawZombieHead = function (ctx, opts) {
    opts = opts || {};
    const pal = opts.slow ? ZOMBIE_PAL.frozen : ZOMBIE_PAL.normal;

    ctx.fillStyle = pal.head;
    circle(ctx, -2, -68, 16);

    ctx.fillStyle = '#f0f0f0';
    circle(ctx, -8, -70, 5);
    circle(ctx, 4, -70, 5);
    ctx.fillStyle = '#1a1a1a';
    circle(ctx, -9, -70, 2.4);
    circle(ctx, 3, -70, 2.4);

    ctx.fillStyle = '#2e2e2e';
    ctx.beginPath();
    ctx.arc(-2, -57, 5, 0.15, Math.PI - 0.15);
    ctx.fill();

    if (opts.headgear === 'cone') {
      ctx.fillStyle = '#ff8f00';
      ctx.beginPath();
      ctx.moveTo(-2, -96);
      ctx.lineTo(-16, -64);
      ctx.lineTo(12, -64);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e65100';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, -88);
      ctx.lineTo(-7, -76);
      ctx.moveTo(4, -90);
      ctx.lineTo(2, -78);
      ctx.stroke();
    } else if (opts.headgear === 'bucket') {
      ctx.fillStyle = '#9e9e9e';
      ctx.beginPath();
      ctx.arc(-2, -82, 17, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#bdbdbd';
      ctx.fillRect(-16, -84, 30, 5);
      ctx.strokeStyle = '#757575';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, -82, 17, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-10, -92, 6, 10);
    }
  };

  A.drawZombieBody = function (ctx, x, y, t, state, opts) {
    ctx.save();
    ctx.translate(x, y);
    opts = opts || {};
    const pal = opts.slow ? ZOMBIE_PAL.frozen : ZOMBIE_PAL.normal;

    const walk = Math.sin(t * 6);
    const eat = state === 'eat';
    const jump = state === 'jump';
    const amp = jump ? 2 : 1;

    ctx.strokeStyle = pal.leg;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -22);
    ctx.lineTo(-8 + walk * 5 * amp, -4);
    ctx.moveTo(4, -22);
    ctx.lineTo(8 - walk * 5 * amp, -4);
    ctx.stroke();

    ctx.fillStyle = pal.shoe;
    circle(ctx, -8 + walk * 5 * amp, -2, 5);
    circle(ctx, 8 - walk * 5 * amp, -2, 5);

    ctx.fillStyle = pal.torso;
    A.roundRect(ctx, -14, -54, 28, 34, 6);
    ctx.fill();
    ctx.fillStyle = pal.suitLine;
    ctx.fillRect(-14, -42, 28, 3);

    ctx.strokeStyle = pal.arm;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (eat) {
      const bite = Math.sin(t * 8);
      ctx.moveTo(-10, -44);
      ctx.lineTo(-30 + bite * 3, -36);
    } else {
      ctx.moveTo(-10, -44);
      ctx.lineTo(-20 - walk * 8 * amp, -30);
    }
    ctx.stroke();

    ctx.strokeStyle = pal.arm2;
    ctx.beginPath();
    if (eat) {
      const bite = Math.sin(t * 8);
      ctx.moveTo(8, -44);
      ctx.lineTo(20 + bite * 3, -30);
    } else {
      ctx.moveTo(8, -44);
      ctx.lineTo(16 + walk * 8 * amp, -30);
    }
    ctx.stroke();

    if (opts.pole) {
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-28, -40);
      ctx.lineTo(24, -40);
      ctx.stroke();
    }

    if (!opts.noHead) A.drawZombieHead(ctx, opts);

    ctx.restore();
  };

  // ===== 子弹 =====

  A.drawPea = function (ctx, x, y, ice) {
    if (ice) {
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
    ctx.fillStyle = 'rgba(255,214,79,0.55)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ellipse(ctx, Math.cos(a) * (r + 11), Math.sin(a) * (r + 11), 9, 4, a);
    }
    circle(ctx, 0, 0, r, '#ffd54f');
    circle(ctx, -r * 0.22, -r * 0.22, r * 0.55, '#ffecb3');
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
  // f: 0 → 1 生命周期进度

  A.drawExplosion = function (ctx, x, y, f) {
    const r = 12 + f * 75;
    ctx.save();
    ctx.globalAlpha = 1 - f;

    circle(ctx, x, y, r, '#ff9800');
    circle(ctx, x, y, r * 0.72, '#ffd54f');
    circle(ctx, x, y, r * 0.4, '#fff3e0');

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
    ctx.restore();
  };
})();
