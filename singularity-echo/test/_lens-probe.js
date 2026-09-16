/* 在透镜前画一张参考网格，截屏后肉眼能直接看出「向心扭曲」。
   不入版本控制（产出在 test/phase7/）。
   不走完整 draw() —— 手动铺一层星空背景 + 参考辐条，再调 drawGateLens + drawGate。 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const OUT = path.join(__dirname, 'phase7');

const refDraw = `(() => {
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const cx = G.gate.x, cy = G.gate.y;
    const camX = cam.x, camY = cam.y, ox = cam.ox || 0, oy = cam.oy || 0;
    ctx.fillStyle = 'rgba(8,13,22,1)';
    ctx.fillRect(0, 0, VW, VH);
    // 画相机下的世界：用 setTransform 把世界坐标映到屏幕
    ctx.translate(VW/2, VH/2);
    if (cam.zoom !== 1) ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-camX + ox, -camY + oy);
    // 一些星点
    for (let i = 0; i < 80; i++) {
      const x = camX + (Math.sin(i*7.13)*0.5+0.5)*VW;
      const y = camY + (Math.sin(i*3.7)*0.5+0.5)*VH;
      ctx.fillStyle = 'rgba(180,210,240,'+(0.3+0.4*Math.sin(i)).toFixed(3)+')';
      ctx.fillRect(x-1, y-1, 2, 2);
    }
    ctx.lineWidth = 1.5;
    // 24 根径向辐条（穿过透镜影响域）
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const r1 = 30, r2 = 560;
      const c = i % 2 === 0 ? 'rgba(150,200,235,0.65)' : 'rgba(220,245,255,0.45)';
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // 6 个半径的方块带（指向门心）
    for (let R = 90; R <= 540; R += 75) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.fillStyle = 'rgba(236,208,138,0.9)';
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.strokeStyle = 'rgba(150,225,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
        ctx.stroke();
      }
    }
  })()`;

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.getElementById('boot') || document.getElementById('boot').classList.contains('out'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.evaluate(() => NOVA.debug('NOVA.launch(0)'));
  await p.waitForTimeout(200);
  await p.evaluate(() => NOVA.debug('BENCH_HOLD=true'));
  await p.evaluate(() => NOVA.debug('NOVA.wave(5)'));
  await p.evaluate(() => NOVA.debug('P.maxHp=99999;P.hp=99999;P.invuln=9999;'));
  await p.evaluate(() => NOVA.debug('for(let i=0;i<2400;i++){if(G.mode!=="play")break;updateWorld(1/60);if(G.asteroids.some(a=>a.boss))break;}'));
  await p.evaluate(() => NOVA.debug('NOVA.gate.killBoss();NOVA.gate.killAll();NOVA.gate.clearTick();'));
  // 让相机对准门心、稳定无抖动
  await p.evaluate(() => NOVA.debug(`
    G.gate.x = cam.x; G.gate.y = cam.y; G.gate.state = 2;
    cam.x=G.gate.x;cam.y=G.gate.y;cam.ox=0;cam.oy=0;G.shake=0;
    G.gate.spin = 0.5;
  `));

  // 关透镜 + 参考 → 直的基准
  const codeOff = `${refDraw}; GATE_LENS_ON = false; drawGate(G.gate);`;
  await p.evaluate(c => NOVA.debug(c), codeOff);
  await p.screenshot({ path: path.join(OUT, 'lens-off.png'), fullPage: false });

  // 开透镜 + 参考 → 透镜后的扭曲
  const codeOn = `${refDraw}; GATE_LENS_ON = true; drawGate(G.gate);`;
  await p.evaluate(c => NOVA.debug(c), codeOn);
  await p.screenshot({ path: path.join(OUT, 'lens-with-gate.png'), fullPage: false });

  await c.close(); await b.close();
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });