/* ============================================================
   三体 · 像素歌剧 — 第五至七幕
   ============================================================ */

ACTS.push(

/* ============================================================
   第五幕 · 黑暗森林（冰湖顿悟）
   ============================================================ */
{
  id: 'darkforest', num: '第 五 幕', title: '黑暗森林', sub: '冰湖 · 宇宙社会学', theme: 'darkforest',
  async play(S) {
    const stars = makeStars(150);
    const sky = { top: h2r('#02030a'), mid: h2r('#060b18'), hor: h2r('#0c1626') };
    const luo = { x: 60, y: 196, walk: 0 };
    let starA = 1, sinkK = 0, crackP = 0, deadStar = false, flare = 0;
    let reali1 = 0, reali2 = 0, markA = 0;
    const HOLE = { x: 240, y: 200 };
    const STAR = { x: 322, y: 56 };
    const bubbles = S.fx.emitter({ rate: 0, gen: () => ({ x: luo.x + Math.random() * 8 - 2, y: luo.y + 6, vy: -(10 + Math.random() * 14), sway: 4, size: 1, life: 2400, color: '#9ad0e8', d: 1 }) });

    S.stage.setLayers([
      layer(0, dynSky(sky)),
      layer(.08, (ctx, t) => {
        drawStars(ctx, stars, t, starA);
        if (!deadStar || flare > 0) {
          const a = deadStar ? flare : 1;
          ctx.globalAlpha = a;
          drawOrb(ctx, STAR.x, STAR.y, deadStar ? 3 : 2, '#fff4d8', '#ffe090');
          ctx.globalAlpha = 1;
        }
        if (markA > 0) { /* 咒目标记 */
          ctx.globalAlpha = markA;
          ctx.strokeStyle = '#ff5040';
          ctx.strokeRect(STAR.x - 7.5, STAR.y - 7.5, 15, 15);
          ctx.fillStyle = '#ff5040';
          ctx.fillRect(STAR.x - 12, STAR.y, 6, 1); ctx.fillRect(STAR.x + 7, STAR.y, 6, 1);
          ctx.fillRect(STAR.x, STAR.y - 12, 1, 6); ctx.fillRect(STAR.x, STAR.y + 7, 1, 6);
          ctx.globalAlpha = 1;
          drawText(ctx, '187J3X1', STAR.x, STAR.y - 16, { size: 6, color: '#ff8070', alpha: markA });
        }
      }),
      layer(.5, ctx => ridge(ctx, 148, 10, '#0a1220', 23)),
      layer(.9, (ctx, t) => {
        /* 冰面 */
        const g = ctx.createLinearGradient(0, 148, 0, 270);
        g.addColorStop(0, '#14283c'); g.addColorStop(1, '#081220');
        ctx.fillStyle = g; ctx.fillRect(-80, 148, 640, 130);
        /* 星光倒影 */
        ctx.globalAlpha = .16 * starA;
        for (let i = 0; i < stars.length; i += 3) {
          const s = stars[i];
          ctx.fillStyle = s.c;
          ctx.fillRect(Math.round(s.x), Math.round(150 + (150 - s.y) * .5), 1, 1);
        }
        ctx.globalAlpha = 1;
        /* 冰面光泽 */
        ctx.globalAlpha = .25;
        ctx.fillStyle = '#3a5a78';
        ctx.fillRect(40 + Math.sin(t / 900) * 8, 176, 90, 1);
        ctx.fillRect(300 - Math.sin(t / 1100) * 8, 224, 110, 1);
        ctx.globalAlpha = 1;
        /* 裂缝与冰洞 */
        if (crackP > 0) {
          ctx.fillStyle = '#040a12';
          const cr = 8 + crackP * 10;
          for (let dy = -cr; dy <= cr; dy++) {
            const w = Math.sqrt(Math.max(0, cr * cr - dy * dy));
            ctx.fillRect(Math.round(HOLE.x - w), Math.round(HOLE.y + dy * .4), Math.round(w * 2), 1);
          }
          ctx.strokeStyle = '#7a9ab8';
          ctx.beginPath();
          ctx.moveTo(HOLE.x - 30 * crackP, HOLE.y - 4); ctx.lineTo(HOLE.x - 6, HOLE.y);
          ctx.moveTo(HOLE.x + 26 * crackP, HOLE.y + 5); ctx.lineTo(HOLE.x + 5, HOLE.y + 1);
          ctx.moveTo(HOLE.x - 8, HOLE.y - 14 * crackP); ctx.lineTo(HOLE.x - 2, HOLE.y - 2);
          ctx.stroke();
        }
        /* 罗辑 */
        if (sinkK < .9) drawHuman(ctx, luo.x, luo.y - 11, { walk: luo.walk, coat: '#1c2434', still: luo.walk === 0 });
        /* 水下 */
        if (sinkK > 0) {
          ctx.globalAlpha = sinkK * .62;
          ctx.fillStyle = '#0a2c34';
          ctx.fillRect(-80, -40, 640, 360);
          ctx.globalAlpha = 1;
          if (sinkK > .5) drawText(ctx, '宇宙就是一座黑暗森林，', 240, 110, { size: 11, color: '#bfe8e0', glow: '#2a8a80', blur: 8, alpha: reali1 });
          if (sinkK > .5) drawText(ctx, '每个文明都是带枪的猎人。', 240, 132, { size: 11, color: '#bfe8e0', glow: '#2a8a80', blur: 8, alpha: reali2 });
        }
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.y = 6;

    await S.wait(800);
    S.sub('旁白', '面壁计划第五年。罗辑独自走上冰封的湖面。');
    await S.tween(3200, p => { luo.x = lerp(60, 232, p); luo.walk = p * 18; }, linear);
    await S.wait(1400);
    /* 远方的星熄灭 */
    flare = 1; S.audio.sfxChime(520);
    S.fx.burst(STAR.x, STAR.y, { n: 14, speed: 24, life: 900, size: 1, color: ['#fff4d8', '#ffd890'] });
    await S.tween(1400, p => { flare = 1 - p; });
    deadStar = true;
    S.sub('罗辑', '那颗星……熄灭了。像黑暗里的一声枪响。');
    await S.wait(3600);
    /* 冰面碎裂 */
    S.audio.sfxCrack();
    await S.tween(900, p => { crackP = p; }, easeOut);
    S.audio.sfxCrack();
    await S.wait(500);
    S.audio.sfxSplash();
    S.stage.addShake(3);
    S.fx.burst(HOLE.x, HOLE.y, { n: 22, speed: 34, up: 30, g: 60, life: 700, size: 1, color: ['#bfe0f0', '#7ab0d0'] });
    S.sub('旁白', '冰面碎裂。他坠入刺骨的黑暗——');
    await S.tween(1100, p => { luo.y = 196 + p * 46; sinkK = p; }, easeIn);
    bubbles.rate = 12;
    await S.wait(1600);
    /* 顿悟 */
    S.audio.sfxChime(784);
    await S.tween(1800, p => { reali1 = p; });
    await S.wait(1200);
    S.audio.sfxChime(1046);
    await S.tween(1800, p => { reali2 = p; });
    S.sub('罗辑', '……我明白了。');
    await S.wait(2800);
    /* 浮出 */
    bubbles.rate = 0;
    S.audio.sfxSplash();
    await S.tween(1300, p => { sinkK = 1 - p; luo.y = 242 - p * 40; reali1 = 1 - p; reali2 = 1 - p; }, easeOut);
    crackP = 1; luo.x = 252;
    S.sub('罗辑', '面壁者罗辑——现在知道该怎么做了。');
    await S.wait(3200);
    await S.tween(1600, p => { markA = p; });
    S.audio.sfxBeep(1180);
    S.sub('旁白', '他向星空发出了一道“咒语”。');
    await S.camTo(20, -40, 1.45, 3000);
    await S.wait(900);
  }
},

/* ============================================================
   第六幕 · 末日战役（水滴）
   ============================================================ */
{
  id: 'doomsday', num: '第 六 幕', title: '末日战役', sub: '水滴 · 两千响的鞭炮', theme: 'doomsday',
  async play(S) {
    const stars = makeStars(120);
    const fleet = [];
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 7; c++)
        fleet.push({ x: 150 + c * 46, y: 52 + r * 28, row: r, alive: true, ph: Math.random() * 6 });
    const drop = { x: 540, y: 80, on: false };
    let panicP = 0, endText = 0;

    S.stage.setLayers([
      layer(0, skyGrad([[0, '#010102'], [1, '#05050c']])),
      layer(.1, (ctx, t) => drawStars(ctx, stars, t, .9)),
      layer(.2, (ctx, t) => {
        drawOrb(ctx, -46, 150, 92, '#1c4468', '#3a7ab0');
        ctx.globalAlpha = .5;
        drawOrb(ctx, -52, 146, 84, '#2a5c88');
        ctx.globalAlpha = 1;
      }),
      layer(.85, (ctx, t) => {
        for (const s of fleet) {
          const jx = Math.sin(t / 130 + s.ph) * 3 * panicP;
          const jy = Math.cos(t / 150 + s.ph) * 2 * panicP;
          drawWarship(ctx, s.x + jx, s.y + jy, t, s.alive);
        }
        if (drop.on) drawDroplet(ctx, drop.x, drop.y, t);
        if (endText > 0) drawText(ctx, '毁灭你，与你有何相干？', 240, 132, { size: 13, color: '#f2ede0', glow: '#8a2a20', blur: 8, alpha: endText });
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.y = 0;

    await S.wait(900);
    S.sub('旁白', '危机纪元205年。人类舰队两千零一十五艘战舰，列阵迎接三体探测器。');
    await S.wait(4400);
    /* 水滴接近 */
    drop.on = true;
    S.audio.sfxPing();
    S.sub('旁白', '探测器形如一滴水银——它太美了，像一件艺术品。');
    await S.tween(3600, p => { drop.x = lerp(540, 470, p); drop.y = lerp(80, 66, p); }, easeOut);
    await S.wait(1800);
    S.sub('旁白', '它开始加速。');
    S.audio.sfxZap();
    await S.wait(900);
    /* 三次贯穿 */
    for (let pass = 0; pass < 3; pass++) {
      const rowShips = fleet.filter(s => s.row === pass && s.alive).sort((a, b) => b.x - a.x);
      const ry = rowShips.length ? rowShips[0].y + 1 : 60;
      S.bg(S.tween(1500, p => { drop.x = lerp(500, -30, p); drop.y = ry; }, easeIn));
      for (const s of rowShips) {
        explodeFX(S, s.x + 5, s.y + 1, .75);
        s.alive = false;
        await S.wait(150);
      }
      await S.wait(500);
      drop.x = 520;
    }
    S.sub('旁白', '像一串被点燃的鞭炮。');
    await S.wait(2400);
    /* 阵型溃散 */
    await S.tween(1800, p => { panicP = p; });
    S.sub('旁白', '舰队阵型，溃散了。');
    await S.wait(2200);
    /* 最终清扫 */
    S.audio.sfxRumble(3);
    const rest = fleet.filter(s => s.alive).sort((a, b) => b.x - a.x);
    for (const s of rest) {
      explodeFX(S, s.x + 5, s.y + 1, .6);
      s.alive = false;
      drop.x = s.x; drop.y = s.y;
      await S.wait(75);
    }
    drop.on = false;
    S.flash('#ffffff', .9);
    S.stage.addShake(8);
    S.audio.sfxBoom(1.4);
    S.audio.stopTheme();
    await S.wait(1400);
    /* 死寂 */
    S.sub('三体', '毁灭你，与你有何相干？');
    await S.tween(2200, p => { endText = p; });
    for (let i = 0; i < 8; i++)
      S.fx.burst(150 + Math.random() * 280, 50 + Math.random() * 150, { n: 4, speed: 6, life: 5000, size: 1, color: '#4a4f58' });
    await S.wait(4200);
    await S.wait(500);
  }
},

/* ============================================================
   第七幕 · 威慑纪元（我对三体世界说话）
   ============================================================ */
{
  id: 'deterrence', num: '第 七 幕', title: '威慑纪元', sub: '我对三体世界说话', theme: 'deterrence',
  async play(S) {
    const stars = makeStars(90);
    const sky = { top: h2r('#1a1030'), mid: h2r('#3a1c3c'), hor: h2r('#7a4030') };
    let starA = .8, dawnK = 0, gunUp = false, respN = 0, finalA = 0;
    const luo = { x: 232, y: 208 };
    const tri = [{ x: 178, y: 46 }, { x: 240, y: 34 }, { x: 302, y: 48 }];
    const RESP = ['住手！', '我们可以谈判。', '请先放下枪。'];

    S.stage.setLayers([
      layer(0, dynSky(sky)),
      layer(.08, (ctx, t) => {
        drawStars(ctx, stars, t, starA * (1 - dawnK));
        for (let i = 0; i < tri.length; i++) {
          const s = tri[i];
          ctx.globalAlpha = (1 - dawnK) * (.6 + .4 * Math.sin(t / 500 + i * 2));
          drawOrb(ctx, s.x, s.y, 2, '#bfe0ff', '#7ab0ff');
          ctx.globalAlpha = 1;
        }
        if (respN > 0) for (let i = 0; i < respN; i++)
          drawText(ctx, RESP[i], 240, 78 + i * 15, { size: 9, color: '#7dffa8', glow: '#20c060', blur: 6 });
      }),
      layer(.4, ctx => ridge(ctx, 182, 20, '#141020', 31)),
      layer(.65, ctx => {
        drawDish(ctx, 408, 158, 24, -.35, '#141824', '#232c3c');
      }),
      layer(.9, (ctx, t) => {
        /* 墓地 */
        const g = ctx.createLinearGradient(0, 196, 0, 270);
        g.addColorStop(0, '#1e1a26'); g.addColorStop(1, '#0e0c14');
        ctx.fillStyle = g; ctx.fillRect(-80, 196, 640, 90);
        drawGrave(ctx, 120, 214);
        drawGrave(ctx, 158, 220);
        drawText(ctx, '叶文洁之墓', 120, 200, { size: 5, color: '#6a7080' });
        /* 罗辑聚光 */
        for (let sy = 60; sy < 210; sy += 2) {
          const sw = 4 + (sy - 60) * .18;
          ctx.globalAlpha = .05;
          ctx.fillStyle = '#fff2d0';
          ctx.fillRect(Math.round(luo.x + 2 - sw / 2), sy, Math.round(sw), 2);
        }
        ctx.globalAlpha = 1;
        /* 罗辑举枪 */
        drawHuman(ctx, luo.x, luo.y - 11, { coat: '#3a4a66', still: true });
        if (gunUp) {
          ctx.fillStyle = '#0c0e12';
          ctx.fillRect(luo.x + 4, luo.y - 6, 3, 2);
        }
        if (dawnK > 0) {
          ctx.globalAlpha = dawnK * .35;
          ctx.fillStyle = '#ffd890';
          ctx.fillRect(-80, -40, 640, 360);
          ctx.globalAlpha = 1;
        }
        if (finalA > 0) drawText(ctx, '给岁月以文明，而不是给文明以岁月。', 240, 120, { size: 11, color: '#fff2d8', glow: '#c9a96e', blur: 8, alpha: finalA });
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.y = 8;

    await S.wait(900);
    S.sub('旁白', '十年后。叶文洁的墓前，罗辑独自面对星空。');
    await S.wait(3800);
    gunUp = true;
    S.audio.sfxBeep(440, .16);
    S.sub('罗辑', '我对三体世界说话。');
    await S.wait(3000);
    S.audio.sfxTick(); await S.wait(700);
    S.audio.sfxTick(); await S.wait(700);
    /* 三体回应 */
    S.audio.sfxBeep(1560); respN = 1;
    S.sub('三体世界', '住手！');
    await S.wait(1800);
    S.audio.sfxBeep(1560); respN = 2;
    S.sub('三体世界', '我们可以谈判。');
    await S.wait(2000);
    S.audio.sfxBeep(1560); respN = 3;
    S.sub('三体世界', '请先放下枪。');
    await S.wait(2400);
    S.sub('罗辑', '让三体舰队转向。永远不要再靠近太阳系。');
    await S.wait(3600);
    /* 黎明 */
    S.audio.sfxChime(880);
    S.audio.startTheme('finale');
    S.bg(tweenSky(S, sky, { top: h2r('#3a5a8a'), mid: h2r('#c88a5a'), hor: h2r('#f0c88a') }, 6000));
    await S.tween(6000, p => { dawnK = p; respN = p < .4 ? respN : 0; });
    S.sub('旁白', '两个世界之间，第一次出现了平衡。威慑纪元，开始了。');
    await S.wait(4200);
    await S.tween(2400, p => { finalA = p; });
    await S.wait(4600);
    await S.camTo(0, -16, 1.2, 3000);
    await S.wait(800);
  }
}

);
