// 手机端验证：虚拟摇杆转向 / 松开即停 / 触屏按钮尺寸 /   smoke
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.SV_URL || 'http://127.0.0.1:8612/index.html?god=1';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  // iPhone 14 横屏尺寸 + 触屏 —— 让 (pointer: coarse) 与竖屏判定都按真实手机走
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 160)); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });

  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  console.log('触屏设备判定 (pointer:coarse) : ' + coarse);
  console.log('触屏模式自动开启 touchMode  : ' + await page.evaluate(() => window.__dbg.touchMode));

  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(300);

  const R = await page.evaluate(() => new Promise(async resolve => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const cv = document.getElementById('game'), wrapEl = document.getElementById('wrap');
    const rect = cv.getBoundingClientRect();
    const mk = (type, x, y) => {
      const t = new Touch({ identifier: 7, target: wrapEl, clientX: x, clientY: y });
      wrapEl.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], targetTouches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true }));
    };
    d.clearEnemies(); d.setPos(G.px, G.py);
    G.ang = 0; G.aim = 0;
    const sc = d.scale;
    const ox = rect.x + rect.width * 0.22, oy = rect.y + rect.height * 0.62;
    const res = { scale: sc };
    // 左半屏按下 → 推杆往下打满（目标 π/2）
    mk('touchstart', ox, oy);
    res.joyActive = d.joyActive;
    for (let i = 0; i < 8; i++) await frame();
    mk('touchmove', ox, oy + 40 * sc * 1.2);
    for (let i = 0; i < 4; i++) await frame();
    res.joyVec = d.joyVec;
    const a0 = G.ang, t0 = G.t;
    let turned = false;
    for (let i = 0; i < 90 && !turned; i++) { await frame(); if (Math.abs(G.ang - Math.PI / 2) < 0.02) turned = true; }
    res.joyTurnRate = Math.abs(G.ang - a0) / (G.t - t0);
    res.joyTurned90 = turned;
    // 满推杆时应该在推进 → 有速度
    res.joySpeed = Math.hypot(G.vx, G.vy);
    // 抬指 → 多久停住
    const tS = G.t; let stop = -1;
    mk('touchend', ox, oy + 40 * sc * 1.2);
    for (let i = 0; i < 60 && stop < 0; i++) { await frame(); if (G.vx === 0 && G.vy === 0) stop = G.t - tS; }
    res.joyReleaseStop = stop;
    res.joyActiveAfter = d.joyActive;
    resolve(res);
  }));

  console.log('缩放 scale                   : ' + R.scale.toFixed(3));
  console.log('按下后摇杆激活               : ' + R.joyActive + ' / 抬指后 ' + R.joyActiveAfter);
  console.log('满推杆 joyVec                : ' + JSON.stringify(R.joyVec));
  console.log('摇杆推动下的推进速度         : ' + R.joySpeed.toFixed(1) + ' px/s');
  // ⚠️ 这是**一段时间内的平均**角速度，不是瞬时峰值：摇杆刚推上去时 `jm` 还在爬，
  //    所以实测值会明显低于 TURN_TOUCH(20) 的满舵值。判「跟不跟手」请看
  //    probes/sv-touch-turn-check.js（那里按 2° 收敛阈值量实际耗时）。
  console.log('摇杆转向速率(均值)            : ' + R.joyTurnRate.toFixed(2) + ' rad/s (满舵峰值 20)');
  console.log('90° 掉头是否成功             : ' + R.joyTurned90);
  console.log('抬指 → 完全停住              : ' + (R.joyReleaseStop < 0 ? '未停（>1s）' : R.joyReleaseStop.toFixed(3) + ' s'));

  // 触屏按钮的**物理**尺寸（CSS px）—— 安卓/iOS 的最小可点尺寸是 44
  const btns = await page.evaluate(() => {
    const out = {};
    for (const [k, sel] of [['pause', '.tb-pause'], ['full', '.tb-full'], ['fire', '.tb-fire'], ['dash', '.tb-dash'], ['od', '.tb-od']]) {
      const el = document.querySelector(sel);
      if (!el) { out[k] = null; continue; }
      const r = el.getBoundingClientRect();
      out[k] = [Math.round(r.width), Math.round(r.height)];
    }
    // 相邻按钮间距
    const p = document.querySelector('.tb-pause').getBoundingClientRect();
    const f = document.querySelector('.tb-full').getBoundingClientRect();
    out.gapPauseFull = Math.round(f.x - (p.x + p.width));
    return out;
  });
  console.log('按钮物理尺寸 (CSS px)        : ' + JSON.stringify(btns));
  await page.screenshot({ path: 'C:\\Users\\www27\\.workbuddy\\binaries\\node\\workspace\\sv-phone.png' });
  console.log('JS 错误 : ' + (errs.length ? errs.slice(0, 5).join(' | ') : '无'));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
