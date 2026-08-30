/* ============================================================
 * 《妖怪夜市》engine.js —— 像素演出引擎
 * 负责：背景绘制、演员调度、粒子特效、转场淡入淡出
 * 内部渲染分辨率 480 x 270
 * ============================================================ */

window.Engine = (function () {
  "use strict";

  const W = 480, H = 270;
  const GROUND = 218; // 演员脚底基准线

  let ctx = null;
  let t = 0;               // 全局时间（秒）
  let bgScene = "hill";
  let fadeAlpha = 1;       // 黑幕透明度
  let fadeTarget = 1;
  let fadeSpeed = 1;
  const actors = new Map();
  const particles = [];
  const rings = [];
  const stars = [];

  for (let i = 0; i < 70; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * 140,
                 s: Math.random() < .25 ? 2 : 1, p: Math.random() * 6.28 });
  }

  /* ---------------- 演员 ---------------- */
  function addActor(name, spriteName, opts = {}) {
    const size = SPRITES.size(spriteName);
    actors.set(name, {
      sprite: spriteName,
      x: opts.x ?? -40,
      y: opts.y ?? GROUND,
      scale: opts.scale ?? 2,
      facing: opts.facing ?? 1,      // 1 朝右 / -1 朝左
      visible: opts.visible ?? true,
      walking: false,
      targetX: null,
      speed: opts.speed ?? 40,
      frameTimer: 0,
      frame: 0,
      emote: null,
      emoteTimer: 0,
      w: size.w, h: size.h,
    });
  }

  function removeActor(name) { actors.delete(name); }

  function moveActor(name, x, speed) {
    return new Promise((resolve) => {
      const a = actors.get(name);
      if (!a) return resolve();
      a.targetX = x;
      a.speed = speed || a.speed;
      a._resolve = resolve;
    });
  }

  function enterActor(name, from, toX, speed) {
    const a = actors.get(name);
    if (!a) return Promise.resolve();
    a.x = from === "left" ? -40 : W + 40;
    a.visible = true;
    return moveActor(name, toX, speed);
  }

  function exitActor(name, to, speed) {
    const a = actors.get(name);
    if (!a) return Promise.resolve();
    const target = to === "left" ? -50 : W + 50;
    return moveActor(name, target, speed).then(() => { a.visible = false; });
  }

  function emote(name, glyph, dur = 1.2) {
    const a = actors.get(name);
    if (!a) return;
    a.emote = glyph;
    a.emoteTimer = dur;
  }

  /* ---------------- 特效 ---------------- */
  function spawnFireflies(n = 14) {
    particles.length = 0;
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "fly",
        x: Math.random() * W, y: 120 + Math.random() * 80,
        vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 3,
        p: Math.random() * 6.28,
      });
    }
  }

  function spawnEmbers() {
    particles.length = 0;
    for (let i = 0; i < 20; i++) {
      particles.push({
        kind: "ember",
        x: Math.random() * W, y: 240 + Math.random() * 40,
        vy: -(6 + Math.random() * 12), vx: (Math.random() - .5) * 4,
        p: Math.random() * 6.28,
      });
    }
  }

  function bellRing(x, y) {
    rings.push({ x, y, r: 4, a: 1 });
    rings.push({ x, y, r: 1, a: 1 });
  }

  function fadeTo(target, dur = 0.8) {
    fadeTarget = target;
    fadeSpeed = Math.abs(fadeTarget - fadeAlpha) / Math.max(dur, 0.05);
  }

  function setBg(scene) { bgScene = scene; }

  /* ---------------- 背景绘制 ---------------- */
  function sky(colors) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(alpha = 1) {
    for (const s of stars) {
      const tw = .5 + .5 * Math.sin(t * 2 + s.p);
      ctx.globalAlpha = alpha * (.3 + .7 * tw);
      ctx.fillStyle = "#fff2c8";
      ctx.fillRect(s.x | 0, s.y | 0, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon(x, y, r, color = "#fff0c0") {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    ctx.globalAlpha = .18;
    ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawGround(color, topLine) {
    ctx.fillStyle = color;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = topLine;
    ctx.fillRect(0, GROUND, W, 2);
  }

  function drawLantern(x, y, glow = true) {
    if (glow) {
      const flick = .32 + .08 * Math.sin(t * 6 + x);
      ctx.globalAlpha = flick;
      ctx.fillStyle = "#ff9c3f";
      ctx.beginPath(); ctx.arc(x + 3, y + 4, 10, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const img = SPRITES.get("paperLantern", 0, false);
    ctx.drawImage(img, x | 0, y | 0);
  }

  function drawStall(x, cloth) {
    // 屋顶
    ctx.fillStyle = "#2a1626";
    ctx.fillRect(x - 4, 148, 66, 6);
    ctx.fillStyle = cloth;
    for (let i = 0; i < 7; i++) ctx.fillRect(x - 2 + i * 9, 154, 7, 10);
    // 柱与柜台
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x, 154, 4, 64);
    ctx.fillRect(x + 54, 154, 4, 64);
    ctx.fillStyle = "#54371f";
    ctx.fillRect(x - 2, 186, 62, 12);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x - 2, 198, 62, 4);
    // 挂灯
    drawLantern(x + 24, 166);
  }

  function drawTorii(x, scale = 1, color = "#c8373d") {
    ctx.save();
    ctx.translate(x, GROUND);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fillRect(-46, -96, 92, 8);      // 笠木
    ctx.fillRect(-40, -84, 80, 5);      // 岛木
    ctx.fillRect(-34, -79, 7, 79);      // 左柱
    ctx.fillRect(27, -79, 7, 79);       // 右柱
    ctx.fillRect(-20, -60, 40, 5);      // 贯
    ctx.fillStyle = "#1a1026";
    ctx.fillRect(-46, -88, 92, 2);
    ctx.restore();
  }

  function drawCrowdYokai() {
    // 街景里游动的妖怪剪影
    const kinds = [
      (x, y) => { ctx.fillRect(x, y - 10, 8, 10); ctx.fillRect(x + 2, y - 13, 4, 3); },
      (x, y) => { ctx.beginPath(); ctx.arc(x + 5, y - 6, 6, 3.14, 0); ctx.fill(); ctx.fillRect(x - 1, y - 6, 12, 6); },
      (x, y) => { ctx.fillRect(x, y - 14, 6, 14); ctx.fillRect(x + 1, y - 17, 4, 3); },
    ];
    ctx.fillStyle = "#241238";
    for (let i = 0; i < 6; i++) {
      const spd = 4 + (i % 3) * 3;
      const dir = i % 2 ? 1 : -1;
      let x = ((i * 97 + t * spd * dir) % (W + 40));
      if (x < 0) x += W + 40;
      x -= 20;
      kinds[i % 3](x | 0, 214 - (i % 3) * 2);
    }
  }

  const BGS = {
    hill() {
      sky(["#0d0722", "#221140", "#3c1e4a"]);
      drawStars();
      drawMoon(392, 52, 20);
      // 远山
      ctx.fillStyle = "#160b30";
      ctx.beginPath();
      ctx.moveTo(0, 200);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, 172 + Math.sin(x * .02 + 2) * 16 + Math.sin(x * .05) * 6);
      }
      ctx.lineTo(W, 200); ctx.closePath(); ctx.fill();
      drawTorii(240, 1.35);
      drawGround("#1d1133", "#322052");
      // 石阶暗示
      ctx.fillStyle = "#2a1a44";
      for (let i = 0; i < 5; i++) ctx.fillRect(206 + i * 2, GROUND + 6 + i * 8, 68 - i * 4, 4);
    },

    gate() {
      sky(["#120a2c", "#2c164a", "#4a2454"]);
      drawStars(.8);
      drawMoon(84, 44, 16);
      drawTorii(240, 1.8);
      drawLantern(178, 128);
      drawLantern(292, 128);
      drawGround("#1d1133", "#322052");
    },

    street() {
      sky(["#160a30", "#34184e", "#5a2a58"]);
      drawStars(.5);
      drawMoon(60, 36, 14);
      // 灯笼串
      for (let i = 0; i < 8; i++) drawLantern(20 + i * 62, 96 + Math.sin(i * 1.7) * 6, true);
      drawStall(46, "#c8373d");
      drawStall(206, "#7a5ab0");
      drawStall(366, "#2e7a8a");
      drawCrowdYokai();
      drawGround("#241338", "#3c2256");
    },

    dawn() {
      sky(["#3a2a5c", "#8a4a6c", "#e8945c"]);
      drawStars(.15);
      drawMoon(392, 50, 16, "#fff8e0");
      // 日出光带
      ctx.globalAlpha = .25;
      ctx.fillStyle = "#ffd27a";
      ctx.fillRect(0, 150, W, 120);
      ctx.globalAlpha = 1;
      drawTorii(240, 1.35, "#8a2a30");
      drawGround("#3a2440", "#5c3a58");
    },
  };

  /* ---------------- 主循环 ---------------- */
  function update(dt) {
    t += dt;
    // 淡入淡出
    if (fadeAlpha !== fadeTarget) {
      const d = fadeSpeed * dt;
      if (fadeAlpha < fadeTarget) fadeAlpha = Math.min(fadeTarget, fadeAlpha + d);
      else fadeAlpha = Math.max(fadeTarget, fadeAlpha - d);
    }
    // 演员移动
    for (const a of actors.values()) {
      if (a.targetX != null) {
        const dx = a.targetX - a.x;
        const step = a.speed * dt;
        a.walking = true;
        a.facing = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) <= step) {
          a.x = a.targetX;
          a.targetX = null;
          a.walking = false;
          const r = a._resolve; a._resolve = null;
          if (r) r();
        } else a.x += Math.sign(dx) * step;
      }
      if (a.walking) {
        a.frameTimer += dt;
        if (a.frameTimer > .22) { a.frameTimer = 0; a.frame ^= 1; }
      } else a.frame = 0;
      if (a.emoteTimer > 0) {
        a.emoteTimer -= dt;
        if (a.emoteTimer <= 0) a.emote = null;
      }
    }
    // 粒子
    for (const p of particles) {
      p.p += dt * 2;
      if (p.kind === "fly") {
        p.x += p.vx * dt + Math.sin(p.p) * .3;
        p.y += p.vy * dt + Math.cos(p.p * .7) * .2;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      } else if (p.kind === "ember") {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.p) * .4;
        if (p.y < 90) { p.y = 250; p.x = Math.random() * W; }
      }
    }
    // 钟声波纹
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += 46 * dt;
      r.a -= .7 * dt;
      if (r.a <= 0) rings.splice(i, 1);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    (BGS[bgScene] || BGS.hill)();

    // 粒子
    for (const p of particles) {
      if (p.kind === "fly") {
        ctx.globalAlpha = .4 + .4 * Math.sin(p.p * 2);
        ctx.fillStyle = "#ffe98a";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      } else {
        ctx.globalAlpha = .5 + .3 * Math.sin(p.p * 3);
        ctx.fillStyle = "#ff9c5a";
        ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
      }
    }
    ctx.globalAlpha = 1;

    // 演员
    for (const a of actors.values()) {
      if (!a.visible) continue;
      const img = SPRITES.get(a.sprite, a.frame, a.facing < 0);
      const bob = (!a.walking && bgScene !== "dawn") ? Math.round(Math.sin(t * 3 + a.x * .1)) : 0;
      const dw = a.w * a.scale, dh = a.h * a.scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.round(a.x - dw / 2), Math.round(a.y - dh + bob), dw, dh);
      if (a.emote) {
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe98a";
        const floatY = Math.round(Math.sin(t * 6) * 1.5);
        ctx.fillText(a.emote, Math.round(a.x), Math.round(a.y - dh - 6 + floatY));
      }
    }

    // 钟声波纹
    for (const r of rings) {
      ctx.globalAlpha = Math.max(0, r.a);
      ctx.strokeStyle = "#ffe98a";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.28); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 黑幕
    if (fadeAlpha > 0.005) {
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle = "#05030c";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function init(canvas) {
    if (ctx) return; // 已初始化则跳过（重演时复用主循环）
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    requestAnimationFrame(loop);
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  return {
    init, addActor, removeActor, moveActor, enterActor, exitActor,
    emote, setBg, fadeTo, spawnFireflies, spawnEmbers, bellRing, wait,
    GROUND, W, H,
  };
})();
