/* 量化透镜开销：同场景下 lens off vs on 各量 60 帧的均时 + 各 Canvas2D op 计数。
   ⚠️ headless 是软件渲染，墙钟会比真机大十几倍且 ±20% 抖，但**delta** 是确定的。
   意义：「有透镜 vs 没透镜」的差距是这份代码真的要多干的活，与机器无关。 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

async function measure(viewport, deviceScaleFactor, name) {
  const EXE = require('./_browser').exe();
  const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({ viewport, deviceScaleFactor, hasTouch: true, isMobile: true });
  const p = await c.newPage();
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.getElementById('boot') || document.getElementById('boot').classList.contains('out'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1000);

  // 起一局 → 跳到 wave 5 → 等 boss 出场 → 杀掉 → 清场 → 门激发、屏幕正中、零抖动
  await p.evaluate(() => NOVA.debug(`NOVA.launch(0);BENCH_HOLD=true;NOVA.wave(5);
    P.maxHp=99999;P.hp=99999;P.invuln=9999;
    for(let i=0;i<2400;i++){if(G.mode!=='play')break;updateWorld(1/60);if(G.asteroids.some(a=>a.boss))break;}
    NOVA.gate.killBoss();NOVA.gate.killAll();NOVA.gate.clearTick();
    G.gate.x=cam.x;G.gate.y=cam.y;G.gate.state=2;G.gate.spin=0.6;
    cam.x=G.gate.x;cam.y=G.gate.y;cam.ox=0;cam.oy=0;cam.zoom=1;G.shake=0;
    G.slowT=0;AU.setMuffle(0);`));

  /* ⚠️ 三条纪律，少一条数据就是假的：
     ① 每次测量**前**都要重新 fill —— draw() 会老化粒子，不补的话第二次测的
        是「衰减后的场景」，会比第一次快，于是算出负的 delta（实测 -47% 就是这么来的）；
     ② 墙钟在 headless 软件渲染下抖 ±20%，取 min 而不是 mean（mean 会被 GC 尖峰带跑）；
     ③ 主判据是**确定性的 op 计数**，墙钟只作参考 —— 项目原本就是这么设计的。 */
  const ROUND = (flag) => `BENCH_HOLD=true;
    NOVA.bench.fill({parts:420,debris:90,ghosts:16,bolts:18,texts:26});
    for(let i=0;i<120;i++)draw();
    GATE_LENS_ON=${flag};
    ({ms:NOVA.bench.drawMs(40),ops:NOVA.bench.ops(30),cw:cv.width,ch:cv.height,
      scene:NOVA.bench.counts()})`;
  /* 5 轮、**丢弃首轮**（JIT / 首帧纹理上传都落在第一轮上，实测它比后面快 5 倍）、
     取中位数。min 会被第一轮的系统性偏快带跑，mean 会被 GC 尖峰带跑。 */
  const rounds = { off: [], on: [] };
  for (let r = 0; r < 5; r++) {
    rounds.off.push(await p.evaluate(c => NOVA.debug(c), ROUND('false')));
    rounds.on.push(await p.evaluate(c => NOVA.debug(c), ROUND('true')));
  }
  rounds.off.shift(); rounds.on.shift();
  const median = (arr) => {
    const v = arr.map(r => r.ms).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const pick = (arr) => {
    const m = median(arr);
    return arr.find(r => r.ms === m) || arr[0];
  };
  const off = pick(rounds.off), on = pick(rounds.on);
  const medOff = median(rounds.off), medOn = median(rounds.on);

  await c.close(); await b.close();

  const delta = on.ms - off.ms;
  const drawImgDelta = (on.ops.by.drawImage||0) - (off.ops.by.drawImage||0);
  const clipDelta = (on.ops.by.clip||0) - (off.ops.by.clip||0);
  const pct = off.ms > 0 ? ((delta/off.ms)*100).toFixed(1) : '?';
  const offRounds = rounds.off.map(r => r.ms.toFixed(2)).join('/');
  const onRounds = rounds.on.map(r => r.ms.toFixed(2)).join('/');
  console.log(`[${name} ${viewport.w}x${viewport.h}@${deviceScaleFactor}x cw=${off.cw}x${off.ch}]`);
  console.log(`  场景 parts=${off.scene.parts} debris=${off.scene.debris} ghosts=${off.scene.ghosts} bolts=${off.scene.bolts} texts=${off.scene.texts}`);
  console.log(`  lens off 中位数: ${medOff.toFixed(2)} ms（4 轮：${offRounds}）· drawImage=${off.ops.by.drawImage} clip=${off.ops.by.clip}`);
  console.log(`  lens on  中位数: ${medOn.toFixed(2)} ms（4 轮：${onRounds}）· drawImage=${on.ops.by.drawImage} clip=${on.ops.by.clip}`);
  console.log(`  Δ ms: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} ms/frame（${pct}%，headless 软件渲染下 ±20% 抖，参考值）`);
  console.log(`  Δ op : drawImage +${drawImgDelta}（1 抓源 + 6 环）· clip +${clipDelta}（1 外 + 6 环）—— 这才是确定的`);
  return { off, on, medOff, medOn, delta, drawImgDelta, clipDelta };
}

(async () => {
  console.log('=== 手机 390x844 @3x ===');
  await measure({ width: 390, height: 844 }, 3, 'mobile');
  console.log('');
  console.log('=== 桌面 1024x768 @2x ===');
  await measure({ width: 1024, height: 768 }, 2, 'desktop');
})().catch(e => { console.error(e); process.exit(1); });