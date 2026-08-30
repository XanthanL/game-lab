/* ============================================================
   三体 · 像素歌剧 — 第一至四幕
   剧本约定：S = { stage, fx, audio, cam, sig,
                 wait, tween, camTo, sub, clearSub, flash, bg }
   ============================================================ */

/* 颜色状态辅助（可连续 tween） */
const h2r = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const c2s = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const lc = (a, b, p) => [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)];
function tweenSky(S, sky, target, ms) {
  const f = { top: sky.top.slice(), mid: sky.mid.slice(), hor: sky.hor.slice() };
  return S.tween(ms, p => {
    sky.top = lc(f.top, target.top, p);
    sky.mid = lc(f.mid, target.mid, p);
    sky.hor = lc(f.hor, target.hor, p);
  }, easeInOut);
}
function dynSky(sky) {
  return (ctx, t, st) => {
    const g = ctx.createLinearGradient(0, -20, 0, 300);
    g.addColorStop(0, c2s(sky.top));
    g.addColorStop(.68, c2s(sky.mid));
    g.addColorStop(1, c2s(sky.hor));
    ctx.fillStyle = g;
    ctx.fillRect(-80, -40, 640, 360);
  };
}

const ACTS = [

/* ============================================================
   第一幕 · 红岸基地（1971）
   ============================================================ */
{
  id: 'redcoast', num: '第 一 幕', title: '红岸基地', sub: '公元1971年 · 雷达峰', theme: 'redcoast',
  async play(S) {
    const stars = makeStars(130);
    const ye = { x: -30, y: 186, walk: 0, flip: false };
    const sky = { top: h2r('#020409'), mid: h2r('#071022'), hor: h2r('#0d1c33') };
    let warn = '', beam = 0, beamW = 4, starBoost = 1, consoleOn = false;

    S.fx.emitter({ rate: 16, gen: () => ({ x: Math.random() * 500 - 10, y: -4, vy: 14 + Math.random() * 14, sway: 8, size: 1, life: 16000, color: '#8fa4c2', d: .55 }) });
    S.fx.emitter({ rate: 26, gen: () => ({ x: Math.random() * 500 - 10, y: -4, vy: 24 + Math.random() * 18, sway: 12, size: 1, life: 12000, color: '#dfe8f5', d: 1 }) });

    S.stage.setLayers([
      layer(0, dynSky(sky)),
      layer(.1, (ctx, t) => drawStars(ctx, stars, t, starBoost)),
      layer(.32, ctx => { ridge(ctx, 186, 46, '#0a1424', 3); ridge(ctx, 196, 30, '#0d1a2e', 41); }),
      layer(.6, (ctx, t) => {
        /* 雷达峰与天线 */
        ctx.fillStyle = '#101f31';
        ctx.beginPath(); ctx.moveTo(240, 200); ctx.lineTo(352, 108); ctx.lineTo(430, 200); ctx.closePath(); ctx.fill();
        drawDish(ctx, 352, 116, 40, -.28 + Math.sin(t / 3400) * .16);
        /* 基地营房 */
        ctx.fillStyle = '#16222f';
        ctx.fillRect(176, 178, 46, 14);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = (t / 900 + i) % 2 < 1 ? '#d8b25e' : '#3a2f18';
          ctx.fillRect(181 + i * 10, 182, 4, 4);
        }
      }),
      layer(.9, (ctx, t) => {
        /* 雪原（夜色） */
        const g = ctx.createLinearGradient(0, 190, 0, 270);
        g.addColorStop(0, '#4d5c74'); g.addColorStop(1, '#232d3e');
        ctx.fillStyle = g; ctx.fillRect(-80, 192, 640, 90);
        ctx.fillStyle = '#7d90ac';
        ctx.fillRect(-80, 192, 640, 2);
        /* 控制台 */
        ctx.fillStyle = '#232a36'; ctx.fillRect(208, 180, 32, 12);
        ctx.fillStyle = consoleOn ? '#061206' : '#0a0d10';
        ctx.fillRect(210, 164, 30, 16);
        ctx.strokeStyle = '#39414f'; ctx.strokeRect(210.5, 164.5, 29, 15);
        if (consoleOn) {
          ctx.fillStyle = Math.floor(t / 400) % 2 ? '#5aff7a' : '#1d5c2e';
          ctx.fillRect(213, 170, 3, 2); ctx.fillRect(218, 170, 3, 2);
        }
        if (warn) drawText(ctx, warn, 225, 152, { size: 6, color: '#ff6a5a', glow: '#ff2020', blur: 4 });
        /* 发射按钮台 */
        ctx.fillStyle = '#3a3f4a'; ctx.fillRect(298, 184, 8, 8);
        ctx.fillStyle = Math.floor(t / 500) % 2 ? '#ff4030' : '#7a140c';
        ctx.fillRect(300, 182, 4, 2);
        /* 叶文洁 */
        drawHuman(ctx, ye.x, ye.y, { walk: ye.walk, flip: ye.flip, coat: '#7a3b2e' });
        /* 发射光束 */
        if (beam > 0) {
          ctx.globalAlpha = beam * .3;
          ctx.fillStyle = '#ffdcb0';
          ctx.fillRect(Math.round(348 - beamW / 2), -40, Math.round(beamW), 160);
          ctx.globalAlpha = beam * .8;
          ctx.fillStyle = '#fff4dc';
          ctx.fillRect(Math.round(348 - beamW / 6), -40, Math.max(1, Math.round(beamW / 3)), 160);
          ctx.globalAlpha = 1;
        }
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.x = 0; S.cam.y = 6; S.cam.zoom = 1;

    await S.wait(900);
    S.sub('旁白', '公元1971年，冬。内蒙古大兴安岭——雷达峰。');
    await S.wait(3600);
    S.sub('旁白', '红岸基地的深夜里，叶文洁独自值守监听室。');
    await S.tween(2800, p => { ye.x = lerp(-30, 196, p); ye.walk = p * 15; }, linear);
    await S.wait(800);
    consoleOn = true; S.audio.sfxBeep(660);
    S.sub('系统', '监测到来自半人马座方向的异常信号——');
    await S.wait(2600);
    S.audio.sfxBeep(880); S.audio.sfxAlarm();
    warn = '不要回答！'; await S.wait(1300);
    warn = '不要回答！！'; S.audio.sfxTick(); await S.wait(1100);
    warn = '不要回答！！！'; S.audio.sfxAlarm(); await S.wait(1500);
    S.sub('三体监听员', '这个世界收到了你们的信息。我是这个世界的一个和平主义者。');
    await S.wait(3800);
    S.sub('三体监听员', '如果你们回答，发射源将被定位，你们的行星将遭到入侵。');
    await S.wait(3800);
    S.sub('三体监听员', '不要回答！不要回答！！不要回答！！！');
    await S.wait(2800);
    S.sub('叶文洁', '到这里来吧。');
    await S.tween(1700, p => { ye.x = lerp(196, 288, p); ye.walk = p * 9; }, linear);
    await S.wait(1100);
    S.sub('叶文洁', '我将帮助你们获得这个世界。');
    await S.wait(2200);
    /* 按下按钮 */
    S.audio.sfxPress();
    S.flash('#ff2828', .8);
    S.stage.addShake(6);
    S.audio.sfxBoom(1.2);
    warn = '';
    S.sub('旁白', '她以太阳为天线，将地球的坐标，射向了四光年之外。');
    await S.tween(2800, p => { beam = p; beamW = 4 + p * 26; starBoost = 1 + p * .8; }, easeOut);
    await S.wait(2600);
    S.sub('旁白', '人类文明，再无回头之路。');
    await S.camTo(30, -70, 1.5, 3200);
    await S.wait(900);
  }
},

/* ============================================================
   第二幕 · 三体游戏（乱纪元 / 三日凌空）
   ============================================================ */
{
  id: 'game', num: '第 二 幕', title: '三体游戏', sub: '乱纪元 · 三日凌空', theme: 'trisolaris',
  async play(S) {
    const stars = makeStars(110);
    const sky = { top: h2r('#04060e'), mid: h2r('#0a0f1e'), hor: h2r('#131b2e') };
    const sun = { x: 240, y: 210, r: 16, on: false };
    const suns3 = [{ x: 130, y: 220 }, { x: 250, y: 230 }, { x: 370, y: 220 }];
    let starA = 1, coldK = 0, burnK = 0, floatP = 0, panicK = 0, titleA = 0, threeOn = false;
    const wang = { x: 238, y: 196, walk: 0 };
    const folks = [];
    for (let i = 0; i < 6; i++) folks.push({ x: 60 + i * 70 + Math.random() * 20, y: 198, coat: ['#5a4a6a', '#6a5a3a', '#3a5a6a'][i % 3], ph: Math.random() * 6 });
    const rocks = [];
    for (let i = 0; i < 9; i++) rocks.push({ x: 30 + Math.random() * 430, y: 200 + Math.random() * 30, s: 1 + (Math.random() * 2 | 0), ph: Math.random() * 6 });

    const embers = S.fx.emitter({ rate: 0, gen: () => ({ x: Math.random() * 500 - 10, y: 260 + Math.random() * 20, vy: -(26 + Math.random() * 30), sway: 10, size: 1, life: 2600, color: ['#ffb050', '#ff7030', '#ffd890'][(Math.random() * 3) | 0], d: .95 }) });
    const snowEm = S.fx.emitter({ rate: 0, gen: () => ({ x: Math.random() * 500 - 10, y: -4, vy: 20 + Math.random() * 16, sway: 10, size: 1, life: 12000, color: '#cfe0f0', d: 1 }) });

    S.stage.setLayers([
      layer(0, dynSky(sky)),
      layer(.08, (ctx, t) => drawStars(ctx, stars, t, starA)),
      layer(.15, (ctx, t) => {
        if (sun.on) drawOrb(ctx, sun.x, sun.y, sun.r, '#ffd890', '#ff9030');
        if (threeOn) for (const s3 of suns3) drawOrb(ctx, s3.x, s3.y, 12, '#fff0c8', '#ff7020');
      }),
      layer(.4, ctx => ridge(ctx, 182, 26, '#241a20', 17)),
      layer(.62, ctx => {
        drawPyramid(ctx, 130, 196, 92, 62, '#2e2430');
        drawPyramid(ctx, 372, 198, 64, 42, '#2a2029');
      }),
      layer(.9, (ctx, t) => {
        /* 荒原 */
        const g = ctx.createLinearGradient(0, 190, 0, 270);
        g.addColorStop(0, '#5c4030'); g.addColorStop(1, '#2a1c12');
        ctx.fillStyle = g; ctx.fillRect(-80, 194, 640, 90);
        if (coldK > 0) { ctx.globalAlpha = coldK * .55; ctx.fillStyle = '#6a8aa8'; ctx.fillRect(-80, 194, 640, 90); ctx.globalAlpha = 1; }
        /* 岩石 */
        for (const r of rocks) {
          const fy = r.y - floatP * (18 + r.ph * 6) + Math.sin(t / 300 + r.ph) * 3 * floatP;
          ctx.fillStyle = '#3a2c22';
          ctx.fillRect(Math.round(r.x), Math.round(fy), r.s + 2, r.s + 1);
        }
        /* 众人 */
        for (let i = 0; i < folks.length; i++) {
          const f = folks[i];
          const px = f.x + Math.sin(t / 90 + f.ph) * 14 * panicK;
          const fy = f.y - floatP * (20 + i * 5) + Math.sin(t / 260 + f.ph) * 3 * floatP;
          drawHuman(ctx, px, fy - 11, { walk: panicK > .3 ? t / 120 : 0, coat: f.coat, still: panicK <= .3 });
        }
        /* 汪淼 */
        const wy = wang.y - floatP * 34 + Math.sin(t / 320) * 3 * floatP;
        drawHuman(ctx, wang.x, wy - 11, { walk: wang.walk, coat: '#2e4a6a', still: true });
        if (burnK > 0) { ctx.globalAlpha = burnK * .3; ctx.fillStyle = '#ff5010'; ctx.fillRect(-80, -40, 640, 360); ctx.globalAlpha = 1; }
        if (titleA > 0) drawText(ctx, '三 日 凌 空', 240, 64, { size: 22, color: '#fff2d0', glow: '#ff8030', blur: 12, alpha: titleA * (.8 + .2 * Math.sin(t / 300)) });
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.y = 4;

    await S.wait(800);
    S.sub('旁白', '汪淼戴上V装具，进入《三体》游戏。');
    await S.wait(3200);
    /* 日出：乱纪元 */
    sun.on = true;
    S.audio.sfxWhoosh();
    S.bg(tweenSky(S, sky, { top: h2r('#3a1c28'), mid: h2r('#7a3524'), hor: h2r('#c8723a') }, 4200));
    await S.tween(4200, p => { sun.y = lerp(210, 74, p); }, easeOut);
    S.sub('旁白', '乱纪元。太阳的运行——毫无规律。');
    await S.wait(2800);
    /* 太阳乱跳 */
    panicK = 1;
    for (let i = 0; i < 3; i++) {
      S.audio.sfxZap();
      sun.x = 80 + Math.random() * 320;
      sun.y = 40 + Math.random() * 90;
      S.stage.addShake(2.5);
      await S.wait(750);
    }
    S.sub('旁白', '日出日落随心所欲，文明在酷热与严寒间喘息。');
    await S.wait(2800);
    /* 长夜严寒 */
    panicK = 0;
    sun.on = false;
    S.audio.sfxWhoosh();
    S.bg(tweenSky(S, sky, { top: h2r('#03060f'), mid: h2r('#081226'), hor: h2r('#12203c') }, 2600));
    await S.tween(2600, p => { coldK = p; starA = p; });
    snowEm.rate = 30;
    S.sub('旁白', '长夜骤至，万物冻结。');
    await S.wait(3400);
    snowEm.rate = 0;
    /* 三日凌空 */
    threeOn = true;
    S.audio.sfxZap(); S.audio.sfxRumble(5);
    S.bg(tweenSky(S, sky, { top: h2r('#5c1808'), mid: h2r('#a83a10'), hor: h2r('#e8a050') }, 3600));
    await S.tween(3600, p => {
      coldK = 1 - p; starA = 1 - p; burnK = p * .9;
      for (const s3 of suns3) s3.y = lerp(225, 66, p);
    }, easeOut);
    embers.rate = 36;
    await S.tween(2200, p => { titleA = p; }, easeOut);
    S.sub('旁白', '三日凌空。引力失衡，大地在烈焰中漂浮。');
    S.stage.addShake(3);
    await S.tween(3400, p => { floatP = p; }, easeInOut);
    S.sub('旁白', '第192号文明，在三个太阳的烈焰中毁灭了。');
    await S.wait(3600);
    /* 坠落 */
    embers.rate = 0;
    S.audio.sfxBoom(.8);
    await S.tween(1200, p => { floatP = 1 - p; burnK = .9 * (1 - p); titleA = 1 - p; }, easeIn);
    S.sub('旁白', '但三体文明，仍在烈焰与长夜之间，寻找着家园。');
    await S.wait(3400);
    await S.camTo(0, -10, 1.25, 2600);
    await S.wait(700);
  }
},

/* ============================================================
   第三幕 · 古筝行动（巴拿马运河）
   ============================================================ */
{
  id: 'guzheng', num: '第 三 幕', title: '古筝行动', sub: '巴拿马运河 · “琴”', theme: 'guzheng',
  async play(S) {
    const sky = { top: h2r('#8a97a8'), mid: h2r('#a8b4bc'), hor: h2r('#c8cdd0') };
    const ship = { x: 560, y: 150 };
    let redK = 0, sliced = false;
    const offsets = [0, 0, 0, 0, 0];
    const WIRE_X = 240;

    const sparks = S.fx.emitter({
      rate: 0, gen: () => ({
        x: WIRE_X + Math.random() * 8 - 4, y: 140 + Math.random() * 50,
        vx: (Math.random() - .5) * 40, vy: -Math.random() * 30, g: 60,
        size: 1, life: 500, color: ['#fff0b0', '#ffd050', '#ffffff'][(Math.random() * 3) | 0], d: 1
      })
    });

    S.stage.setLayers([
      layer(0, dynSky(sky)),
      layer(.3, ctx => ridge(ctx, 146, 18, '#3c5238', 7)),
      layer(.55, (ctx, t) => {
        /* 两岸 */
        ctx.fillStyle = '#4a5c40';
        ctx.fillRect(-80, 146, 150, 140);
        ctx.fillRect(410, 146, 150, 140);
        ctx.fillStyle = '#33402c';
        ctx.fillRect(-80, 146, 150, 4);
        ctx.fillRect(410, 146, 150, 4);
        /* 立柱 */
        ctx.fillStyle = '#2c313c';
        ctx.fillRect(WIRE_X - 14, 122, 4, 74);
        ctx.fillRect(WIRE_X + 10, 122, 4, 74);
        ctx.fillRect(WIRE_X - 18, 120, 36, 3);
      }),
      layer(.8, (ctx, t) => {
        /* 河水 */
        drawWater(ctx, 164, t, mix('#0e2a3c', '#5c1a14', redK), mix('#1a4a66', '#7a2a1a', redK));
        /* 飞刃丝 */
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = .25 + .2 * Math.sin(t / 200 + i * 2);
          ctx.fillStyle = '#e8f4ff';
          ctx.fillRect(WIRE_X - 6 + i * 5, 138, 1, 56);
        }
        ctx.globalAlpha = 1;
        /* 审判日号 */
        drawShip(ctx, ship.x, ship.y, sliced ? offsets : null);
        /* 吃水线 */
        ctx.globalAlpha = .45;
        ctx.fillStyle = mix('#0e2a3c', '#5c1a14', redK);
        ctx.fillRect(Math.round(ship.x) - 3, Math.round(ship.y) + 12, 116, 8);
        ctx.globalAlpha = 1;
        if (!sliced) { /* 舰桥窗灯 */
          ctx.fillStyle = Math.floor(t / 600) % 2 ? '#ffd890' : '#6a5a30';
          ctx.fillRect(Math.round(ship.x) + 68, Math.round(ship.y) + 6, 3, 2);
        }
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.y = 8;

    await S.wait(800);
    S.sub('旁白', '危机纪元初年，巴拿马运河。两岸之间，竖起了一张看不见的“琴”。');
    await S.wait(4200);
    S.sub('旁白', '“审判日”号正在通过——船上，是地球三体组织的全部资料。');
    S.audio.sfxRumble(9);
    await S.tween(8000, p => { ship.x = lerp(560, 268, p); }, linear);
    S.audio.sfxHeartbeat();
    S.sub('旁白', '纳米飞刃，细如发丝，坚不可摧。');
    await S.wait(2200);
    /* 通过飞刃 */
    sliced = true;
    S.audio.sfxSlice();
    sparks.rate = 40;
    S.sub('旁白', '没有声音。');
    await S.tween(3600, p => {
      ship.x = lerp(268, 246, p);
      for (let i = 0; i < offsets.length; i++)
        offsets[i] = clamp(p * 1.7 - i * .14, 0, 1) * (i - 2) * 5;
    }, easeInOut);
    sparks.rate = 0;
    S.sub('旁白', '巨轮像一叠被缓缓推开的扑克牌。');
    await S.wait(3000);
    S.audio.sfxRumble(4);
    await S.tween(3000, p => { redK = p * .8; ship.y = 150 + p * 5; }, easeInOut);
    S.audio.sfxAlarm();
    S.sub('旁白', '“审判日”号被切成四十余片。三体文明最后的内应，就此斩断。');
    await S.wait(4200);
    await S.camTo(-10, 0, 1.22, 2600);
    await S.wait(700);
  }
},

/* ============================================================
   第四幕 · 智子封锁 / 面壁者
   ============================================================ */
{
  id: 'sophon', num: '第 四 幕', title: '智子封锁', sub: '你们是虫子 · 面壁者', theme: 'sophon',
  async play(S) {
    const stars = makeStars(140);
    const sky = { top: h2r('#030308'), mid: h2r('#07070f'), hor: h2r('#0c0c16') };
    let dotR = 0, eyeOpen = 0, bugA = 0, scene2 = false, spotK = 0;
    const mirror = { x: 240, y: 96 };
    /* 城市剪影预生成 */
    const blds = [];
    for (let i = 0; i < 14; i++) blds.push({ x: i * 36 + Math.random() * 8, w: 22 + Math.random() * 14, h: 26 + Math.random() * 56, win: Math.random() });
    const watchers = [{ x: 105 }, { x: 250 }, { x: 388 }];

    S.stage.setLayers([
      layer(0, dynSky(sky)),
      layer(.08, (ctx, t) => { if (!scene2) drawStars(ctx, stars, t, 1); }),
      layer(.4, (ctx, t) => {
        if (scene2) return;
        /* 展开镜面 */
        if (dotR > 0) {
          drawOrb(ctx, mirror.x, mirror.y, dotR, '#cfd6e4', '#ffffff');
          ctx.globalAlpha = .5;
          ctx.strokeStyle = '#ffffff';
          for (let i = 1; i <= 2; i++) {
            ctx.globalAlpha = .22 / i;
            ctx.beginPath(); ctx.arc(mirror.x, mirror.y, dotR + i * 8 + Math.sin(t / 500) * 3, 0, 6.29); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }),
      layer(.65, (ctx, t) => {
        if (scene2) return;
        /* 城市 */
        for (const b of blds) {
          ctx.fillStyle = '#101018';
          ctx.fillRect(Math.round(b.x), Math.round(230 - b.h), Math.round(b.w), b.h + 40);
          ctx.fillStyle = '#d8c27a';
          for (let wy = 0; wy < b.h - 6; wy += 7)
            for (let wx = 3; wx < b.w - 4; wx += 6)
              if (Math.sin(b.x * 7 + wy * 3 + wx) > .45) ctx.fillRect(Math.round(b.x) + wx, Math.round(230 - b.h) + 3 + wy, 2, 2);
        }
      }),
      layer(.9, (ctx, t) => {
        if (scene2) {
          /* 场景二：面壁者 */
          ctx.fillStyle = '#020204'; ctx.fillRect(-80, -40, 640, 360);
          drawStars(ctx, stars, t, .7);
          if (spotK > 0) {
            for (let y = 30; y < 232; y += 2) {
              const w = 5 + (y - 30) * .24;
              ctx.globalAlpha = .055 * spotK;
              ctx.fillStyle = '#fff2d0';
              ctx.fillRect(Math.round(240 - w / 2), y, Math.round(w), 2);
            }
            ctx.globalAlpha = 1;
          }
          drawHuman(ctx, 237, 218, { coat: '#1c2434', still: true });
          if (spotK > .5) drawText(ctx, '面壁者 · 罗辑', 240, 246, { size: 7, color: '#c9a96e', alpha: spotK });
          return;
        }
        /* 天台观望者 */
        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(-80, 230, 640, 50);
        for (const w of watchers) drawHuman(ctx, w.x, 219, { coat: '#20242e', still: true });
        /* 巨眼 */
        if (eyeOpen > 0) drawEye(ctx, mirror.x, mirror.y, Math.min(120, dotR * .8), 46, eyeOpen, t);
        if (bugA > 0) drawText(ctx, '你 们 是 虫 子', 240, 204, { size: 15, color: '#ff4a28', glow: '#ffb0a0', blur: 8, alpha: bugA * (Math.floor(t / 300) % 3 === 0 ? .45 : 1) });
      }),
      layer(1, ctx => S.fx.draw(ctx, S.cam), 2)
    ]);
    S.cam.y = 0;

    await S.wait(800);
    S.sub('旁白', '三体舰队已经启航。而在此之前，两颗质子，先一步抵达了地球。');
    await S.wait(4200);
    /* 智子展开 */
    S.audio.sfxPing();
    S.sub('旁白', '智子二维展开，包裹了整片天空。');
    await S.tween(4200, p => { dotR = p * 150; }, easeOut);
    S.audio.sfxWhoosh();
    S.sub('旁白', '它锁死加速器，蚀刻视网膜——人类的科学，被判了死刑。');
    await S.wait(4000);
    /* 巨眼睁开 */
    S.audio.sfxHeartbeat();
    await S.tween(3000, p => { eyeOpen = p; }, easeInOut);
    S.sub('旁白', '它在看着每一个人。');
    await S.wait(2400);
    S.audio.sfxZap();
    await S.tween(800, p => { bugA = p; });
    S.sub('智子', '你们是虫子。');
    await S.wait(3600);
    /* 场景二：面壁者 */
    S.audio.sfxChime(660);
    scene2 = true;
    S.sub('旁白', '同年，联合国。罗辑，被选为四位“面壁者”之一。');
    await S.tween(2400, p => { spotK = p; });
    await S.wait(2200);
    S.sub('罗辑', '我需要一处绝对安全的地方——思考。');
    await S.wait(3200);
    await S.camTo(0, -20, 1.3, 2800);
    await S.wait(700);
  }
},

];

window.ACTS = ACTS;
