// singularity-voyage 验证：手机端右瞄准杆（相对位移式）
// 取代旧的 sv-aim-mark-check.js（那个测的是已删掉的「悬浮瞄准标」+ 绝对指向）。
//
// 为什么必须有这个探针：旧的「右半屏绝对指向」在手机上是死路 —— 相机夹取让船恒在屏幕正中，
// 右半屏触点 dx 恒为正 → 炮口只能落在右半平面，实测可达区间恰好 [-90°, +90°]。
// 下面 ② 那条断言就是那个 bug 的回归闸门，删了它就会静默退化回去。
//
// 运行： node probes/sv-touch-aim-check.js
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
  // iPhone 14 横屏 + 真触屏：让 (pointer: coarse) 与横屏判定都按真实手机走
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
    const nrm = a => Math.atan2(Math.sin(a), Math.cos(a));
    d.freezeLevel(); d.clearEnemies(); d.clearMods(); d.resetStats();
    // ⚠️ 杆的几何**必须从游戏里读**，不能写死在断言里：半径调过一次（40→52），
    //    写死的 41 当场假红。见 game.js 里 __dbg.stickGeom 那条注释。
    out.geom = d.stickGeom;
    // 摆到世界正中 → 相机不夹取 → 船在屏幕正中（对这个 bug 来说是最严格的位置）
    G.px = 720; G.py = 405; updateCam();
    G.vx = 0; G.vy = 0;
    for (let i = 0; i < 3; i++) await frame();
    // 开局默认值（要在任何用例去翻开关之前读）
    out.autoFireDefault = d.autoFire;
    out.gameAutoFire = d.gameAutoFire;

    // ---- ① 右杆 8 向：位移方向 → 炮口方向 ----
    // 落点固定在右半屏，往 8 个方向各拖 30px（> 死区 8px，< 满舵 40px）
    out.dirs = [];
    for (let k = 0; k < 8; k++) {
      const want = -Math.PI + k * (Math.PI / 4);          // -180..135，含**向左**
      d.releaseAimStick();
      d.setAimStick(360, 135, 360 + Math.cos(want) * 30, 135 + Math.sin(want) * 30);
      await frame(); await frame();
      out.dirs.push({ want: +nrm(want).toFixed(3), got: +nrm(G.aim).toFixed(3), mag: +d.aimStick.mag.toFixed(3) });
    }
    d.releaseAimStick();

    // ---- ② 满舵：推到 60px（超过 AIM_R=40）应该钳住，mag 停在 1 ----
    d.setAimStick(360, 135, 360 + 60, 135);
    await frame();
    out.fullMag = d.aimStick.mag;
    out.fullKnob = [Math.round(d.aimStick.x), Math.round(d.aimStick.y)];
    d.releaseAimStick();

    // ---- ③ 死区：手指在落点附近抖 4.5px，方向不许变 ----
    d.setAimStick(300, 150, 360, 150);                    // 先瞄正右 (0)
    await frame(); await frame();
    const before = G.aim;
    d.setAimStick(300, 150, 304, 152);                    // 抖 4.5px，落在死区内
    await frame(); await frame();
    out.dzBefore = +nrm(before).toFixed(3);
    out.dzAfter = +nrm(G.aim).toFixed(3);
    out.dzMag = d.aimStick.mag;
    d.releaseAimStick();

    // ---- ④ 松手保留方向 ----
    d.setAimStick(360, 135, 310, 135);                    // 向左 → π
    await frame(); await frame();
    const held = G.aim;
    d.releaseAimStick();
    for (let i = 0; i < 20; i++) await frame();
    out.heldAim = +nrm(held).toFixed(3);
    out.afterRelease = +nrm(G.aim).toFixed(3);

    // ---- ⑤ 左杆转向时炮口不动（解耦仍在）----
    d.setAim(Math.PI); G.ang = 0; G.aim = Math.PI; G.vx = 0; G.vy = 0;
    await frame();
    d.setJoy(1, 0, true);
    for (let i = 0; i < 40; i++) await frame();
    out.hullAng = +nrm(G.ang).toFixed(3);
    out.gunAim = +nrm(G.aim).toFixed(3);
    // ---- ⑥ 松手不回摆（旧版会自己转回炮口方向）----
    d.setJoy(0, 0, false);
    const angAtRelease = G.ang;
    for (let i = 0; i < 60; i++) await frame();
    out.angAtRelease = +nrm(angAtRelease).toFixed(3);
    out.angAfterIdle = +nrm(G.ang).toFixed(3);

    // ---- ⑦ 只拖右杆不开火（旧版「拖动即开火」已废）----
    d.setAutoFire(false);
    G.bullets.length = 0; G.fireT = 0;
    d.setAimStick(360, 135, 360, 95);
    for (let i = 0; i < 30; i++) await frame();
    out.bulletsWhileDragging = G.bullets.length;
    d.releaseAimStick();

    // ---- ⑧ 开火沿炮口方向 ----
    d.setAim(0);                                          // 炮口朝正右
    d.setAutoFire(true);
    G.bullets.length = 0; G.fireT = 0;
    for (let i = 0; i < 20; i++) await frame();
    const b = G.bullets[G.bullets.length - 1];
    out.bulletAng = b ? +nrm(b.ang).toFixed(3) : null;
    out.bulletCount = G.bullets.length;
    d.setAutoFire(false);

    // ---- ⑨ 真实 touch 事件路径也能打通（不只走 __dbg 直写口）----
    const cv = document.getElementById('game'), wrapEl = document.getElementById('wrap');
    const rect = cv.getBoundingClientRect();
    const sc = d.scale;
    const mk = (type, id, gx, gy) => {
      const t = new Touch({ identifier: id, target: wrapEl, clientX: rect.x + gx * sc, clientY: rect.y + gy * sc });
      wrapEl.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t], changedTouches: [t],
        targetTouches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true,
      }));
    };
    d.setAim(0);
    mk('touchstart', 31, 400, 135);
    for (let i = 0; i < 3; i++) await frame();
    out.realBefore = +nrm(G.aim).toFixed(3);              // 还没拖 → 应该还是 0
    mk('touchmove', 31, 400, 105);                        // 往上拖 30px → -90°
    for (let i = 0; i < 3; i++) await frame();
    out.realAfter = +nrm(G.aim).toFixed(3);
    out.realStickId = d.aimStick.id;
    mk('touchend', 31, 400, 105);
    for (let i = 0; i < 3; i++) await frame();
    out.realStickIdAfter = d.aimStick.id;

    return out;
  });

  console.log('============ 手机端右瞄准杆 ============');
  console.log('① 8 向位移 → 炮口方向（落点 360,135，各拖 30px）');
  let worst = 0;
  for (const r of R.dirs) {
    const err = Math.abs(norm(r.got - r.want));
    worst = Math.max(worst, err);
    console.log('     推 ' + String(deg(r.want)).padStart(4) + '°  →  炮口 ' + String(deg(r.got)).padStart(4) +
      '°   偏差 ' + deg(err) + '°');
  }
  chk(worst < 0.05, '① 8 个方向全部吻合（最大偏差 < 3°）', 'max=' + deg(worst) + '°');

  // 这条是核心回归闸门：旧实现永远拿不到 cos < 0 的方向
  // ⚠️ 阈值必须取 -0.9：8 个方向里有 -3π/4 和 3π/4 的 cos 都是 -0.707，
  //    取 -0.7 会筛出 3 条，断言里的 length===1 当场假红。
  const lefts = R.dirs.filter(r => Math.cos(r.want) < -0.9);
  chk(lefts.length === 1 && Math.abs(norm(lefts[0].got - Math.PI)) < 0.05,
    '② 向左推能得到 π（旧版绝对指向永远够不到）', 'got=' + deg(lefts[0].got) + '°');

  chk(R.fullMag === 1 && Math.abs(R.fullKnob[0]) <= R.geom.aimR + 1 && Math.abs(R.fullKnob[1]) <= R.geom.aimR + 1,
    '③ 推过头钳在满舵（推杆不会飞出环外）', 'mag=' + R.fullMag + ' knob=' + JSON.stringify(R.fullKnob)
    + ' aimR=' + R.geom.aimR);

  chk(R.dzMag === 0 && Math.abs(norm(R.dzAfter - R.dzBefore)) < 0.01,
    '④ 死区内抖动不改方向（4.5px）', '前 ' + deg(R.dzBefore) + '° → 后 ' + deg(R.dzAfter) + '°, mag=' + R.dzMag);

  chk(Math.abs(norm(R.afterRelease - R.heldAim)) < 0.01 && Math.abs(norm(R.heldAim - Math.PI)) < 0.05,
    '⑤ 松手保留炮口方向（不归零）', deg(R.heldAim) + '° → ' + deg(R.afterRelease) + '°');

  chk(Math.abs(R.hullAng) < 0.2 && Math.abs(norm(R.gunAim - Math.PI)) < 0.05,
    '⑥ 左杆转向时炮口不动（船体/炮口解耦保留）',
    '船体 ' + deg(R.hullAng) + '° / 炮口 ' + deg(R.gunAim) + '°');

  chk(Math.abs(norm(R.angAfterIdle - R.angAtRelease)) < 0.02,
    '⑦ 松手后船体不回摆（旧版会自己转回炮口方向）',
    deg(R.angAtRelease) + '° → ' + deg(R.angAfterIdle) + '°');

  chk(R.bulletsWhileDragging === 0,
    '⑧ 只拖右杆不开火（旧版「拖动即开火」已废除）', 'bullets=' + R.bulletsWhileDragging);

  chk(R.bulletCount > 0 && R.bulletAng !== null && Math.abs(R.bulletAng) < 0.06,
    '⑨ 开火沿炮口方向', 'n=' + R.bulletCount + ' ang=' + deg(R.bulletAng) + '°');

  chk(R.realStickId === 31 && Math.abs(norm(R.realAfter + Math.PI / 2)) < 0.05,
    '⑩ 真实 touch 事件路径有效（向上拖 → -90°）',
    'id=' + R.realStickId + ' ' + deg(R.realBefore) + '° → ' + deg(R.realAfter) + '°');
  chk(R.realStickIdAfter === null, '⑩b 抬指后右杆释放', 'id=' + R.realStickIdAfter);

  // ⚠️ 这条最容易静默失效：触屏路径上 mouse.down 永远置不上 true
  //    （mousedown 监听挡掉了 firesTouchEvents 的合成事件），
  //    所以 wantFire 只剩 G.autoFire 一条支路 —— 默认关 = 手机上一发子弹都打不出去。
  chk(R.autoFireDefault === true && R.gameAutoFire === true,
    '⑪ 触屏自动开火默认开（否则手机上打不出子弹）',
    'autoFire=' + R.autoFireDefault + ' gameAutoFire=' + R.gameAutoFire);

  chk(errs.length === 0, '⑫ 无 JS 错误', errs.length ? errs.slice(0, 3).join(' | ') : '');

  console.log('\n' + (FAIL.length ? '==> FAILED ' + FAIL.length + ' / ' + (PASS.length + FAIL.length)
    : '==> ALL PASS ' + PASS.length + '/' + (PASS.length + FAIL.length)));
  await browser.close(); served.server.close();
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
