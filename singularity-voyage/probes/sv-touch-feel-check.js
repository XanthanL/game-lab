// singularity-voyage 验证：手机端操控的 2026-10-25 这批改动的回归闸门
//   ① 瞄准吸附：锥内跟、锥外不动、松手打折、无目标不漂、桌面端不吃
//   ② 左杆双区：只转向带（0.12 < mag < THRUST_DZ）能转向但不推进
//   ③ 冲刺冷却态：按钮 .cooling 跟着 G.dashCd 翻转
//
// 为什么必须有它：这几条全是「只在触屏生效」的分支，而**无头桌面 Chrome 永远走不到
// 它们** —— 不写探针就等于没测。吸附尤其危险：它改的是炮口角，一旦越过「锥内」这条
// 边界就变成自动瞄准，玩家的甩枪意图会被吃掉，而画面上完全看不出区别。
//
// 运行： node probes/sv-touch-feel-check.js
const path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..');
const lib = require('./probe-lib');
const CHROME = lib.chrome;

const PASS = [], FAIL = [];
const chk = (ok, name, extra) => {
  (ok ? PASS : FAIL).push(name + (extra ? '  ' + extra : ''));
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '   ' + extra : ''));
};
const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
const deg = a => Math.round(a * 180 / Math.PI);

(async () => {
  const served = await lib.serve(0, ROOT);
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(served.base + '?god=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 30000 });
  await page.evaluate(() => startGame());
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 15000 });
  await page.waitForTimeout(300);

  const R = await page.evaluate(async () => {
    const out = {};
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    // ⚠️ 页面里没有外层的 norm/deg，这两个必须在 evaluate 内部各定义一次
    const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
    const deg = a => Math.round(a * 180 / Math.PI);
    const cst = d.assistConst, geom = d.stickGeom;
    out.cst = cst; out.geom = geom;

    d.freezeLevel(); d.clearMods(); d.resetStats();
    d.setTouchMode(true);
    d.setAutoFire(false);
    G.S.hp = 9999;

    // 把玩家摆到世界正中并清场：吸附测的是角度，不要被撞飞 / 被推偏污染
    const home = () => { d.clearEnemies(); d.setPos(720, 405); G.ang = 0; G.vx = 0; G.vy = 0; };
    /* ⚠️ 关掉刷怪：波次还在跑，spawnT 一到就会自己往 G.enemies 里塞新怪 ——
       新怪可能比钉住的目标更近，吸附就会去跟它，量出来的角度全是别人的。
       第一版没关，⑤「无目标不漂移」直接假红（场上凭空冒出一只，炮口被拽走 8°）。
       只清 spawnQueue 就够：spawn 的判定是 `spawnQueue.length && spawnT <= 0`。 */
    const hush = () => { G.spawnQueue.length = 0; G.spawnT = 999; };
    home(); hush();
    await frame();

    /* 钉一个目标在玩家的 off 方向上：每帧把它按回去（敌人自己是会跑的，
       不钉住的话量到的是「目标跑了」而不是「吸附有没有跟」）。 */
    let tgt = null;
    const place = (off, dist) => {
      d.clearEnemies();
      d.spawn('tadpole', G.px + Math.cos(off) * dist, G.py + Math.sin(off) * dist);
      tgt = G.enemies[G.enemies.length - 1];
      tgt.hp = 99999;
      pin(off, dist);
    };
    const pin = (off, dist) => {
      if (!tgt) return;
      tgt.x = G.px + Math.cos(off) * dist; tgt.y = G.py + Math.sin(off) * dist;
      tgt.vx = 0; tgt.vy = 0; tgt.hp = 99999;
    };
    // 走 n 帧，每帧都保持「刷怪关掉 + 目标钉住」
    const run = async (n, off, dist) => {
      for (let i = 0; i < n; i++) { await frame(); hush(); if (off !== undefined) pin(off, dist); }
    };
    const DIST = 220;

    // 按住/松开右杆：setAimStick 落点=当前点 → mag 0、不改 touchAim，但 id 不为 null（= 手指在杆上）
    const hold = () => d.setAimStick(360, 135, 360, 135);
    const release = () => d.releaseAimStick();

    // ---- ① 锥内吸附（手指在右杆上）----
    const OFF_IN = 0.14;                     // 8°，在 cone(0.20) 内
    d.setAssist(true);
    home(); d.setAim(0); place(OFF_IN, DIST); hold();
    await run(60, OFF_IN, DIST);
    out.assistAim = +norm(G.aim).toFixed(4);
    out.assistErrDeg = +deg(norm(G.aim - OFF_IN));
    release();

    // ---- ② 关掉吸附的基线：同一个场景，炮口必须一动不动 ----
    d.setAssist(false);
    home(); d.setAim(0); place(OFF_IN, DIST); hold();
    await run(60, OFF_IN, DIST);
    out.noAssistAim = +norm(G.aim).toFixed(4);
    release();
    d.setAssist(true);

    // ---- ③ 锥外不动：偏差 30° 远超 cone，吸附必须完全不介入 ----
    const OFF_OUT = 0.52;
    home(); d.setAim(0); place(OFF_OUT, DIST); hold();
    await run(60, OFF_OUT, DIST);
    out.outConeAim = +norm(G.aim).toFixed(4);
    release();

    /* ---- ④ 松手后打折：同一段时间内，松手的修正量应明显小于按住 ----
       ⚠️ 偏差和帧数必须**同时**卡好：两者任一给大了，按住的那一路会在几帧里就
          收敛到底（吸附有角速度上限但偏差很小），松手的那一路也追上来，
          测出来是 1.00 而不是 0.45 —— 第一版用 3°/18 帧就是这么假红的。
          0.16 rad（cone 的 80%）+ 5 帧：按住≈0.048、松手≈0.022，都还在爬坡段。 */
    const OFF_S = 0.16;
    const measure = async (held) => {
      home(); d.setAim(0); place(OFF_S, DIST);
      if (held) hold(); else release();
      await run(5, OFF_S, DIST);
      const fix = Math.abs(norm(G.aim));
      release();
      return fix;
    };
    out.fixHeld = +(await measure(true)).toFixed(5);
    out.fixIdle = +(await measure(false)).toFixed(5);

    // ---- ⑤ 无目标不漂移 ----
    home(); tgt = null; d.setAim(0.7); release();
    for (let i = 0; i < 30; i++) { await frame(); hush(); d.clearEnemies(); }
    out.noTargetAim = +norm(G.aim).toFixed(4);

    // ---- ⑥ 桌面端不吃吸附 ----
    d.setTouchMode(false);
    home(); place(OFF_IN, DIST);
    d.setAim(0); G.ang = 0; window.aimMode = 'key';
    d.setJoy(0, 0, false);
    await run(30, OFF_IN, DIST);
    out.desktopAim = +norm(G.aim).toFixed(4);
    out.desktopAng = +norm(G.ang).toFixed(4);
    d.setTouchMode(true);
    d.clearEnemies(); tgt = null;

    // ---- ⑦ 左杆双区 ----
    const joyCase = async (mag) => {
      home();
      d.setAim(0);
      d.clearEnemies(); tgt = null;
      d.setJoy(0, mag, true);                 // 推向正下方（+π/2）
      await run(45);
      const res = { angErrDeg: +deg(norm(G.ang - Math.PI / 2)), spd: +Math.hypot(G.vx, G.vy).toFixed(1) };
      d.setJoy(0, 0, false);
      await run(20);
      return res;
    };
    out.joyTurnOnly = await joyCase(0.22);    // 只转向带：THRUST_DZ 之下
    out.joyThrust = await joyCase(0.55);      // 推进带：THRUST_DZ 之上
    out.joyDead = await joyCase(0.08);        // 死区内

    // ---- ⑧ 冲刺按钮的冷却态跟着 G.dashCd 翻转 ----
    d.setTouchMode(true);
    const dashBtn = document.querySelector('.tb-dash');
    G.dashCd = 0; G.dashT = 0;
    await frame(); await frame();
    out.coolReady = dashBtn ? dashBtn.classList.contains('cooling') : null;
    d.G.dashCd = 0.9;
    await frame(); await frame();
    out.coolDuring = dashBtn ? dashBtn.classList.contains('cooling') : null;
    d.G.dashCd = 0;
    await frame(); await frame();
    out.coolAfter = dashBtn ? dashBtn.classList.contains('cooling') : null;

    // ---- ⑨ 冲刺键与开火 / 超载按钮仍然不重叠（挪过位置，这条必须复验）----
    const rects = {};
    for (const [k, sel] of [['fire', '.tb-fire'], ['dash', '.tb-dash'], ['od', '.tb-od']]) {
      const el = document.querySelector(sel);
      if (!el) { rects[k] = null; continue; }
      const r = el.getBoundingClientRect();
      rects[k] = [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)];
    }
    out.rects = rects;
    return out;
  });

  console.log('============ 手机端操控（2026-10-25 批次）============');
  console.log('吸附常量 cone/rate/range/idle = ' + deg(R.cst.cone) + '° / ' + R.cst.rate
    + ' rad/s / ' + R.cst.range + 'px / ' + R.cst.idle);
  console.log('杆几何 = ' + JSON.stringify(R.geom));

  chk(Math.abs(norm(R.assistAim - 0.14)) < 0.035,
    '① 锥内吸附跟得上（目标偏 8°，1s 内收敛到 2° 内）', '炮口 ' + deg(R.assistAim) + '°，残差 ' + R.assistErrDeg + '°');

  chk(Math.abs(R.noAssistAim) < 0.01,
    '② 关掉吸附时炮口一动不动（基线）', '炮口 ' + deg(R.noAssistAim) + '°');

  chk(Math.abs(R.outConeAim) < 0.01,
    '③ 锥外不介入（目标偏 30° > cone，炮口保持玩家给的方向）', '炮口 ' + deg(R.outConeAim) + '°');

  // ⚠️ 必须带下界：写成 `fixIdle < fixHeld` 的话「吸附整个失效」也会 PASS
  chk(R.fixHeld > 0.008 && R.fixIdle > 0 && R.fixIdle < R.fixHeld * 0.75 && R.fixIdle > R.fixHeld * 0.15,
    '④ 松手后吸附打折（还在跟，但慢到不会被察觉成炮口自己动）',
    '按住修正 ' + deg(R.fixHeld) + '° / 松手 ' + deg(R.fixIdle) + '°  比值 '
    + (R.fixHeld ? (R.fixIdle / R.fixHeld).toFixed(2) : 'n/a') + '（设计 ' + R.cst.idle + '）');

  chk(Math.abs(norm(R.noTargetAim - 0.7)) < 0.01,
    '⑤ 没有目标时炮口不漂移', '炮口 ' + deg(R.noTargetAim) + '°');

  chk(Math.abs(R.desktopAim) < 0.01 && Math.abs(R.desktopAng) < 0.01,
    '⑥ 桌面端（touchMode=false）完全不吃吸附',
    'aim ' + deg(R.desktopAim) + '° / ang ' + deg(R.desktopAng) + '°');

  chk(Math.abs(R.joyTurnOnly.angErrDeg) <= 3 && R.joyTurnOnly.spd < 1,
    '⑦ 只转向带：船头转到手指方向但**不推进**',
    '朝向误差 ' + R.joyTurnOnly.angErrDeg + '°，速度 ' + R.joyTurnOnly.spd + ' px/s');

  chk(Math.abs(R.joyThrust.angErrDeg) <= 3 && R.joyThrust.spd > 100,
    '⑧ 推进带：转向 + 推进都正常',
    '朝向误差 ' + R.joyThrust.angErrDeg + '°，速度 ' + R.joyThrust.spd + ' px/s');

  chk(R.joyDead.spd < 1 && Math.abs(R.joyDead.angErrDeg) > 80,
    '⑨ 死区内（0.08）既不转向也不推进',
    '朝向误差 ' + R.joyDead.angErrDeg + '°，速度 ' + R.joyDead.spd + ' px/s');

  chk(R.coolReady === false && R.coolDuring === true && R.coolAfter === false,
    '⑩ 冲刺键冷却态跟着 G.dashCd 翻转',
    '就绪 ' + R.coolReady + ' / 冷却中 ' + R.coolDuring + ' / 恢复 ' + R.coolAfter);

  const ov = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]);
  const rs = R.rects;
  chk(rs.fire && rs.dash && rs.od && !ov(rs.fire, rs.dash) && !ov(rs.fire, rs.od) && !ov(rs.dash, rs.od),
    '⑪ 开火 / 冲刺 / 超载三键互相不重叠（挪过冲刺的位置）', JSON.stringify(rs));

  chk(errs.length === 0, '⑫ 无 JS 错误', errs.length ? errs.slice(0, 3).join(' | ') : '');

  console.log('\n' + (FAIL.length ? '==> FAILED ' + FAIL.length + ' / ' + (PASS.length + FAIL.length)
    : '==> ALL PASS ' + PASS.length + '/' + (PASS.length + FAIL.length)));
  await browser.close(); served.server.close();
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
