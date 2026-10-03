// singularity-voyage 改动验证：运动手感 / 吸附 / 爆炸不卡顿 / 转向
// 运行： node sv-move-check.js
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.SV_URL || 'http://127.0.0.1:8612/index.html?god=1';

const out = [];
const log = (...a) => { out.push(a.join(' ')); console.log(...a); };

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(400);

  // ---------- 页内测量 ----------
  const R = await page.evaluate(() => new Promise(async resolve => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const spd = () => Math.hypot(G.vx, G.vy);
    const res = {};

    d.clearEnemies();
    d.clearMods(); d.resetStats();
    d.setPos(G.px, G.py);
    G.ang = 0; G.aim = 0; G.hitstop = 0; G.shake = 0;

    // A. 加速：从静止按住 W，多久到 95% 满速
    d.hold('KeyW', true);
    let t0 = G.t, tFull = -1;
    for (let i = 0; i < 120 && tFull < 0; i++) {
      await frame();
      if (spd() >= 0.95 * 168 * G.S.spd) tFull = G.t - t0;
    }
    res.slowToFull = tFull;
    res.maxSpeed = spd();
    res.diag = {
      state: window.__dbg.state, dead: G.dead, keyW: !!window.__dbg.G && undefined,
      webSlow: G.webSlow, spdMul: G.S.spd, dashT: G.dashT, px: Math.round(G.px), py: Math.round(G.py),
      keys: JSON.stringify({ W: keys['KeyW'], aim: window.aimMode, mi: undefined }),
    };
    // 松手：多久彻底停住（vx、vy 都为 0），这段时间漂了多远
    const x0 = G.px, y0 = G.py, tStop0 = G.t;
    d.hold('KeyW', false);
    let tStop = -1, dist = 0;
    for (let i = 0; i < 120 && tStop < 0; i++) {
      await frame();
      if (G.vx === 0 && G.vy === 0) { tStop = G.t - tStop0; dist = Math.hypot(G.px - x0, G.py - y0); }
    }
    res.releaseStopTime = tStop;
    res.releaseGlide = dist;

    // B2. 冲刺（线性刹车之后有没有把冲刺腰斩）
    d.setPos(G.px, G.py); G.dashCd = 0; G.dashT = 0; G.ang = 0;
    const dx0 = G.px, dy0 = G.py, tD = G.t;
    tryDash();
    for (let i = 0; i < 180; i++) { await frame(); if (G.vx === 0 && G.vy === 0) break; }
    res.dashDist = Math.hypot(G.px - dx0, G.py - dy0);
    res.dashTime = G.t - tD;

    // B. 转向速率（键盘 A/D）
    d.hold('KeyW', false); d.setPos(G.px, G.py); G.ang = 0;
    const a0 = G.ang, tT0 = G.t;
    d.hold('KeyD', true);
    for (let i = 0; i < 30; i++) await frame();
    d.hold('KeyD', false);
    res.keyboardTurnRate = (G.ang - a0) / (G.t - tT0);

    // C. 吸附：基础半径 + 60px 外的星尘多久被吃掉
    res.magnetBase = G.S.magnet;
    d.setPos(G.px, G.py); G.pickups.length = 0;
    G.pickups.push({ type: 'dust', x: G.px + 60, y: G.py, vx: 0, vy: 0, v: 1, life: 22, t: 0 });
    const tp0 = G.t;
    let tPick = -1;
    for (let i = 0; i < 120 && tPick < 0; i++) {
      await frame();
      if (!G.pickups.length) tPick = G.t - tp0;
    }
    res.pickup60pxTime = tPick;

    // D. 爆炸不卡顿：同一 callsite 连打 15 次大爆炸
    G.pickups.length = 0; G.hitstop = 0; G.shake = 0;
    for (let i = 0; i < 15; i++) explode(G.px + 300 + i * 2, G.py + 120, 60, 5, false);
    res.hitstopAfter15Blasts = G.hitstop;
    await frame();
    res.shakeAfter15Blasts = G.shake;
    resolve(res);
  }));
  log('== 运动 / 吸附 / 爆炸 ==');
  log(' 加速到 95% 满速          : ' + R.slowToFull.toFixed(3) + ' s   (设计值 ≈0.3)');
  log(' 稳态速度                 : ' + R.maxSpeed.toFixed(1) + ' px/s (MAXV=168)');
  log(' 松手 → 完全停住          : ' + R.releaseStopTime.toFixed(3) + ' s   (设计值 ≈0.18)');
  log(' 松手后滑行距离           : ' + R.releaseGlide.toFixed(1) + ' px');
  log(' 冲刺位移 / 用时           : ' + R.dashDist.toFixed(1) + ' px / ' + R.dashTime.toFixed(2) + ' s');
  log(' 键盘转向速率             : ' + R.keyboardTurnRate.toFixed(2) + ' rad/s (设计值 ' + 3.2 + ')');
  log(' 基础吸附半径             : ' + R.magnetBase + ' px (设计值 78)');
  log(' 60px 外星尘被吃掉用时    : ' + R.pickup60pxTime.toFixed(3) + ' s');
  log(' 15 次大爆炸后的 hitstop  : ' + R.hitstopAfter15Blasts + ' (必须为 0)');
  log(' 15 次大爆炸后的屏抖      : ' + R.shakeAfter15Blasts.toFixed(2) + ' (上限 9)');

  // ---------- 实战压力：满级高爆组合连打，统计「被冻住的帧」占比 ----------
  await page.goto((process.env.SV_URL || 'http://127.0.0.1:8612/index.html') + '?god=1&kit=all', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(400);

  const S2 = await page.evaluate(() => new Promise(async resolve => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    d.clearEnemies();
    // 在玩家周围堆一圈敌人，制造「高爆一炸一大片」的场面
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2;
      d.spawn(i % 3 === 0 ? 'seeker' : 'tadpole', G.px + Math.cos(a) * 70, G.py + Math.sin(a) * 70);
    }
    G.hitstop = 0;
    let frozen = 0, frames = 0, worstShake = 0;
    const t0 = G.t;
    for (let i = 0; i < 90; i++) {
      await frame();
      frames++;
      if (G.hitstop > 0) frozen++;
      worstShake = Math.max(worstShake, G.shake);
      if (i % 12 === 0) for (let k = 0; k < 40; k++) {
        const a = k / 40 * Math.PI * 2;
        d.spawn('seeker', G.px + Math.cos(a) * 70, G.py + Math.sin(a) * 70);
      }
    }
    resolve({ frames, frozen, secs: G.t - t0, worstShake, mods: Object.keys(G.mods).length });
  }));
  log('== 满级高爆实战压力（kit=all）==');
  log(' 采样帧数 / 被冻住的帧    : ' + S2.frozen + ' / ' + S2.frames + '  (' + (S2.frozen / S2.frames * 100).toFixed(1) + '%)');
  log(' 游戏时长                 : ' + S2.secs.toFixed(2) + ' s');
  log(' 峰值屏抖                 : ' + S2.worstShake.toFixed(2) + ' (上限 9)');

  log('== JS 错误 ==');
  log(errs.length ? errs.slice(0, 8).join('\n') : ' 无');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
