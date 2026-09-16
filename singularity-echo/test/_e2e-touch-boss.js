/* 端到端探针：触屏模式（hasTouch+isMobile+390×844）下走真实 TouchEvent，
   验证四个方向的位移 + 没有 JS 错误。
   不用 NOVA.touch.set（那个绕过 touchmove），跟 5-5-04/13/14 同一条事件路径。
   不入版本控制 —— 一旦纳入 phase* 测试套件再固化。 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    hasTouch: true, isMobile: true,
  });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('JS: ' + String(e).slice(0, 220)));
  // 只把真正的 JS 异常算错；BGM/CORS 这种 file:// 的 fetch 失败不算（生产用 https 不存在）
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('CORS') || t.includes('ERR_FAILED') || t.includes('Failed to load resource')) return;
    errs.push('LOG: ' + t.slice(0, 220));
  });
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.getElementById('boot') || document.getElementById('boot').classList.contains('out'), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1300);
  await p.evaluate(() => NOVA.debug(`startGame(HULLS[0]);G.mode='play';setTouch(true);P.maxHp=99999;P.hp=99999;P.invuln=9999;`));
  await p.waitForTimeout(200);

  // 真实触摸派发 —— 用 5-5 验证过的同款：window.dispatchEvent(new TouchEvent(...))
  // ⚠️ touches/targetTouches 在 touchstart / move 里有 [t]，touchend 里要 []，否则
  // PAL 兜底会按「空列表」算 Δ，错把它当触摸结束处理。
  const HELP = `
    const __T=(x,y)=>new Touch({identifier:7,target:document.body,clientX:x,clientY:y});
    const __fire=(type,x,y,end)=>{const t=__T(x,y);
      const tl=end?[]:[t];
      window.dispatchEvent(new TouchEvent(type,{
        changedTouches:[t],touches:tl,targetTouches:tl,bubbles:true,cancelable:false}));};
    const __ax=90, __ay=innerHeight-140;
    window.__push=(dx,dy,ms)=>{__fire('touchstart',__ax,__ay);
      const n=Math.max(2,Math.round((ms||600)/16));
      for(let i=1;i<=n;i++)__fire('touchmove',__ax+dx*i/n,__ay+dy*i/n);
      return new Promise(r=>setTimeout(r,ms||600));};
    window.__rel=()=>{__fire('touchend',__ax,__ay,true);
      return new Promise(r=>setTimeout(r,120));};
    1;`;
  await p.evaluate(c => NOVA.debug(c), HELP);
  await p.waitForTimeout(50);

  const moves = await p.evaluate(async () => {
    const out = {};
    for (const [name, dx, dy] of [['down', 0, 40], ['up', 0, -40], ['right', 40, 0], ['left', -40, 0]]) {
      // 复位 + 清场 + 真实触摸 600ms
      await NOVA.debug(`P.x=WORLD.w/2;P.y=WORLD.h/2;P.vx=0;P.vy=0;P.angle=0;G.asteroids.length=0;G.ebullets.length=0;G.enemies.length=0;`);
      await __push(dx, dy, 600);
      const r = await NOVA.debug(`({x:+P.x.toFixed(1),y:+P.y.toFixed(1),ang:+P.angle.toFixed(2),th:P.thrusting,fin:Number.isFinite(P.x)&&Number.isFinite(P.y)})`);
      out[name] = r;
      await __rel();
    }
    return out;
  });
  // 顺手验「按着不动 = 唯一刹车」
  const brake = await p.evaluate(async () => {
    await NOVA.debug(`P.x=WORLD.w/2;P.y=WORLD.h/2;P.vx=400;P.vy=0;P.angle=0;`);
    await __push(0, 0, 500);
    const held = await NOVA.debug(`+Math.hypot(P.vx,P.vy).toFixed(1)`);
    await __rel();
    await NOVA.debug(`P.vx=400;P.vy=0;`);
    await new Promise(r => setTimeout(r, 500));
    const free = await NOVA.debug(`+Math.hypot(P.vx,P.vy).toFixed(1)`);
    return { held, free };
  });

  console.log('REAL-TOUCH 4-DIR:', JSON.stringify(moves));
  console.log('BRAKE held=', brake.held, 'free=', brake.free);
  console.log('JS ERRORS:', errs.length ? errs.join(' | ') : 'NONE');
  await c.close(); await b.close();
})().catch(e => { console.error(e); process.exit(1); });