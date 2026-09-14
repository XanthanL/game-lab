/* ============================================================================
   probe.cjs —— H5 预览无头断言
   ----------------------------------------------------------------------------
   不开微信开发者工具，用 headless Chrome 真跑一遍：真渲染、真触摸事件、真截图。
   退出码 = 失败数。
   用法：
     NODE_PATH=<workspace>/node_modules node tools/h5/probe.cjs
   ========================================================================== */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
const SHOTS = path.join(__dirname, '_shots');
const URL = require('url').pathToFileURL(path.join(__dirname, 'index.html')).href;

const results = [];
function ok(id, cond, extra) {
  results.push({ id: id, pass: !!cond, extra: extra == null ? '' : String(extra) });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + id + (extra != null ? '   ' + extra : ''));
}

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--allow-file-access-from-files', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  /* file:// 下 localStorage 跨 context 共享 —— 每次跑都清一遍，避免互相污染 */
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });

  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ES && window.__ES.app, null, { timeout: 10000 });

  /* ── 1. 模块与启动 ─────────────────────────────────────────────── */
  const boot = await page.evaluate(() => ({
    state: window.__ES.app.state,
    mods: Object.keys(window.__reg || {}),
    W: window.__ES.PAL.W, H: window.__ES.PAL.H, DPR: window.__ES.PAL.DPR,
    arena: [window.__reg.arena.ARENA_W, window.__reg.arena.ARENA_H],
  }));
  ok('01-boot', boot.mods.length >= 11, '模块 ' + boot.mods.length);
  ok('02-arena', boot.arena[0] === 360, 'arena ' + boot.arena.join('x'));
  ok('03-dpr', boot.DPR >= 1 && boot.DPR <= 3, 'DPR=' + boot.DPR + ' 视口 ' + boot.W + 'x' + boot.H);

  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

  /* 画布真的画了东西吗（不是纯黑） */
  const painted = await page.evaluate(() => {
    const cv = document.querySelector('canvas');
    const c = cv.getContext('2d');
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    let nonBg = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (d[i] > 40 || d[i + 1] > 46 || d[i + 2] > 58) nonBg++;
    }
    return { n: nonBg, total: Math.floor(d.length / (4 * 97)), w: cv.width, h: cv.height };
  });
  ok('04-paint', painted.n > 20, '非底色采样 ' + painted.n + '/' + painted.total + ' 画布 ' + painted.w + 'x' + painted.h);

  /* ── 2. 进入战斗 ───────────────────────────────────────────────── */
  await page.evaluate(() => { window.__ES.app.newRun(); });
  await page.waitForTimeout(1800);
  const run = await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb;
    return {
      state: a.state, wave: cb.wave, hp: Math.round(cb.p.hp),
      enemies: cb.en.count(), pbullets: cb.pb.count(),
      stage: cb.sing.stage, fps: a.fps,
    };
  });
  ok('05-run', run.state === 'playing' && run.wave >= 1, 'state=' + run.state + ' wave=' + run.wave);
  ok('06-spawn', run.enemies > 0, '敌机 ' + run.enemies);
  ok('07-fire', run.pbullets > 0, '我方弹 ' + run.pbullets);
  ok('08-fps', run.fps >= 30, 'fps≈' + run.fps);
  await page.screenshot({ path: path.join(SHOTS, '02-playing.png') });

  /* ── 3. 三阶段奇点 ─────────────────────────────────────────────── */
  for (const st of [0, 1, 2]) {
    await page.evaluate((s) => {
      const cb = window.__ES.app.cb;
      cb.sing.stage = s; cb.sing.pendingStage = s; cb.sing.stageT = 1;
      cb.sing.setSynergy(s * 3);
    }, st);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, '03-sing-stage' + st + '.png') });
  }
  /* 压缩有两个来源：协同 0.65 + 穿越 0.35，分别量再合起来量 */
  const sing = await page.evaluate(() => {
    const s = window.__ES.app.cb.sing;
    const m0 = (s.setSynergy(0), s.setWarp(0), s.metrics());      // 0
    const ms = (s.setSynergy(6), s.setWarp(0), s.metrics());      // 只有协同 → 0.65
    const mw = (s.setSynergy(0), s.setWarp(3), s.metrics());      // 只有穿越 → 0.35
    const mf = (s.setSynergy(6), s.setWarp(3), s.metrics());      // 两者满 → 1.00
    s.setSynergy(0); s.setWarp(0);
    return {
      r0: m0.R, rs: ms.R, rw: mw.R, rf: mf.R,
      a0: m0.pullA, af: mf.pullA,
      c0: s.compression,
    };
  });
  ok('09-compress-r', sing.rf < sing.r0 * 0.7,
     '半径 ' + sing.r0.toFixed(1) + ' → ' + sing.rf.toFixed(1) + '（满压缩 −45%）');
  ok('10-compress-a', sing.af > sing.a0 * 2,
     '引力 ' + sing.a0.toFixed(0) + ' → ' + sing.af.toFixed(0));
  ok('10b-two-sources', sing.rs < sing.r0 && sing.rw < sing.r0 && sing.rf < sing.rs,
     '协同 ' + sing.rs.toFixed(1) + ' / 穿越 ' + sing.rw.toFixed(1) + ' 各自都压缩');

  /* ── 3.5 黑洞透镜：开与不开，画面必须不同 ──────────────────────── */
  const lens = await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb;
    const cv = window.__ES.PAL.canvas;
    const c = cv.getContext('2d');
    const AR = window.__reg.arena, RD = window.__reg.render;
    cb.sing.stage = 2; cb.sing.pendingStage = 2; cb.sing.stageT = 1;
    cb.sing.setSynergy(4);
    const R = cb.sing.metrics().R;
    const reach = R * 4.0;
    const p = AR.toPx(cb.sing.x, cb.sing.y);
    const half = Math.max(8, Math.floor(reach * AR.View.totalScale * 0.55));
    const x0 = Math.max(0, Math.min(cv.width - half * 2, Math.round(p.x - half)));
    const y0 = Math.max(0, Math.min(cv.height - half * 2, Math.round(p.y - half)));
    const grab = () => {
      const d = c.getImageData(x0, y0, half * 2, half * 2).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4 * 11) s += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 2;
      return s;
    };
    cb.sing.lensOn = true;  RD.drawWorld(c, cb, a.stars); const on = grab();
    cb.sing.lensOn = false; RD.drawWorld(c, cb, a.stars); const off = grab();
    cb.sing.lensOn = true;  RD.drawWorld(c, cb, a.stars);
    return { on: on, off: off, R: R, reach: reach, px: half * 2 };
  });
  ok('38-lens-differs', lens.on !== lens.off,
     '透镜开/关画面不同（视界 R=' + lens.R.toFixed(1) + ' 影响 ' + lens.reach.toFixed(0) + 'px，采样 ' + lens.px + '²）');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '03b-lens.png') });

  /* ── 4. 左下角固定摇杆 + touchcancel 延迟拆除 ──────────────────── */
  const tc = await page.evaluate(async () => {
    const In = window.__reg.input;
    const AR = window.__reg.arena;
    const el = document;
    const T = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    const fire = (type, id, x, y) => {
      const t = T(id, x, y);
      el.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    /* 世界 → 屏幕（探针用的是浏览器坐标） */
    const sx = wx => wx * AR.View.scale + AR.View.ox;
    const sy = wy => wy * AR.View.scale + AR.View.oy;
    const base = { x: sx(In.STICK_CX), y: sy(In.STICK_CY) };

    const out = { base: base, hit: In.HIT, scale: AR.View.scale };

    /* 4a. 判定区外（右上角）不应接管摇杆 */
    In.killStick();
    fire('touchstart', 1, sx(300), sy(120));
    out.outsideActive = In.stick.active;
    fire('touchend', 1, sx(300), sy(120));
    await sleep(20);

    /* 4b. 基座固定：手指落在半径内时，摇杆帽应当**就在手指处**，
           而不是「落在哪儿哪儿就是零点」。取两个不同落点各测一次。 */
    In.killStick();
    fire('touchstart', 2, sx(100), sy(680));      // 世界 (100,680)，距基座约 36 < 52
    fire('touchmove', 2, sx(100), sy(680));
    out.p1 = { x: In.stick.x, y: In.stick.y, dx: In.stick.dx, dy: In.stick.dy };
    fire('touchend', 2, sx(100), sy(680));
    await sleep(20);

    In.killStick();
    fire('touchstart', 3, sx(50), sy(730));       // 世界 (50,730)，距基座约 34 < 52
    fire('touchmove', 3, sx(50), sy(730));
    out.p2 = { x: In.stick.x, y: In.stick.y, dx: In.stick.dx, dy: In.stick.dy };
    /* 摇杆帽贴合手指（说明基座没跟着落点跑），且两个落点给出**相反**的方向
       —— 浮动基座会给两次都是 0，固定基座才会一正一负。 */
    out.knobFollows = Math.abs(out.p1.x - 100) < 1.5 && Math.abs(out.p1.y - 680) < 1.5
                   && Math.abs(out.p2.x - 50) < 1.5 && Math.abs(out.p2.y - 730) < 1.5;
    out.opposite = (out.p1.dx > 0.2 && out.p2.dx < -0.2) || (out.p1.dx < -0.2 && out.p2.dx > 0.2);

    fire('touchmove', 3, sx(174), sy(640));       // 推到右上（超出半径 → 会被夹住）
    out.afterStart = In.stick.active;
    out.dxBefore = In.stick.dx; out.dyBefore = In.stick.dy;

    /* 4c. cancel → 延迟拆除 → move 续上 */
    fire('touchcancel', 3, sx(174), sy(640));
    out.pending = In.stick.pendingCancel;
    fire('touchmove', 3, sx(180), sy(632));
    await sleep(220);                             // 超过 120ms 的拆除窗口
    out.survived = In.stick.active;
    out.dxAfter = In.stick.dx;

    /* 4d. 真抬手 → 立刻释放（这条就是之前挂掉的那个 bug） */
    fire('touchend', 3, sx(180), sy(632));
    await sleep(40);
    out.released = !In.stick.active;
    out.dxReleased = In.stick.dx;

    /* 4e. cancel 后不再有 move → 应当自己拆掉 */
    In.killStick();
    fire('touchstart', 4, sx(90), sy(700));
    fire('touchcancel', 4, sx(90), sy(700));
    await sleep(220);
    out.cancelAlone = !In.stick.active;

    return out;
  });
  ok('11-hit-outside', tc.outsideActive === false, '判定区外不接管摇杆');
  ok('12-base-fixed', tc.knobFollows && tc.opposite,
     '基座固定：帽贴手指 p1=(' + tc.p1.x.toFixed(0) + ',' + tc.p1.y.toFixed(0) + ') p2=(' + tc.p2.x.toFixed(0) + ',' + tc.p2.y.toFixed(0) + ') 反向=' + tc.opposite);
  ok('13-touch-start', tc.afterStart, '摇杆已激活 dx=' + (tc.dxBefore || 0).toFixed(2) + ' dy=' + (tc.dyBefore || 0).toFixed(2));
  ok('14-cancel-pending', tc.pending, 'cancel 后进入延迟拆除');
  ok('15-cancel-resume', tc.survived, '220ms 后摇杆仍存活（move 撤销了拆除）');
  ok('16-touch-end', tc.released && tc.dxReleased === 0, 'touchend 后摇杆释放且归零');
  ok('17-cancel-alone', tc.cancelAlone, 'cancel 后无 move → 自行拆除');

  /* ── 4.5 区域 / 亚稳态门 / 通道 ────────────────────────────────── */
  const flow = await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb;
    const RG = window.__reg.regions, CH = window.__reg.channel;
    const out = {};
    out.regions = [RG.regionOf(1).id, RG.regionOf(11).id, RG.regionOf(21).id];
    out.final = [RG.isRegionFinal(5), RG.isRegionFinal(10), RG.isRegionFinal(20)];
    out.cards = [CH.cardsFor(0), CH.cardsFor(20), CH.cardsFor(40)];

    /* 强制推到区域收尾 Boss 波，然后让巨像倒下。
       把协同归零，让压缩只受「穿越」影响 —— 这样前后可比。 */
    cb.startWave(10);
    cb.synergy = 0; cb.sing.setSynergy(0); cb.sing.setWarp(0);
    cb.onGateKeeperDown(180, 260);
    out.gate1 = cb.sing.gate;
    const m1 = cb.sing.metrics();
    out.dormant = { pullA: Math.round(m1.pullA), burn: Math.round(m1.burn) };
    out.gateAt = { x: Math.round(cb.sing._gx), y: Math.round(cb.sing._gy) };

    /* 奇点滑到位（跳过 0.85s 过渡），然后把玩家塞进门 → 先测"亚稳态进不去" */
    cb.sing._moveT = 1; cb.sing.x = cb.sing._gx; cb.sing.y = cb.sing._gy;
    cb.p.x = cb.sing.x; cb.p.y = cb.sing.y;
    cb.state = 'run';
    cb.update(0.016, null);
    out.dormantBlocks = !cb.pendingWarp;

    /* 清场 → 激活 */
    cb.en.clear(); cb.spawnLeft = 0;
    cb.state = 'clear'; cb.gapT = 0;
    cb.update(0.016, null);
    out.gate2 = cb.sing.gate;
    const m2 = cb.sing.metrics();
    out.open = { pullA: Math.round(m2.pullA), burn: Math.round(m2.burn) };
    out.warpReq = !!cb.pendingWarp;
    out.compressBefore = cb.sing.compression;
    return out;
  });
  ok('21-regions', flow.regions.join(',') === 'debris,veil,sing', flow.regions.join(' / '));
  ok('22-region-final', flow.final[0] === false && flow.final[1] === true && flow.final[2] === true, '10/20/30 是收尾波，5 不是');
  ok('23-cards-tier', flow.cards.join(',') === '1,2,3', '收集 0/20/40 → ' + flow.cards.join('/') + ' 张');
  ok('24-dormant', flow.gate1 === 1 && flow.dormant.pullA === 0 && flow.dormant.burn === 0,
     '亚稳态：无引力(' + flow.dormant.pullA + ') 不灼烧(' + flow.dormant.burn + ')');
  ok('25-dormant-blocks', flow.dormantBlocks, '亚稳态时飞进去无效（不可通过）');
  ok('26-gate-at-boss', flow.gateAt.x === 180 && flow.gateAt.y === 260, '门落在巨像死亡点 ' + flow.gateAt.x + ',' + flow.gateAt.y);
  ok('27-open', flow.gate2 === 2 && flow.open.pullA > 200 && flow.open.burn === 0,
     '开启态：强吸引(' + flow.open.pullA + ') 不灼烧(' + flow.open.burn + ')');
  ok('28-warp-req', flow.warpReq, '飞进门 → 请求穿越');

  /* 穿越 → 通道 → 结算 → 发卡 → 下一区域 */
  await page.waitForTimeout(320);
  const stWarp = await page.evaluate(() => window.__ES.app.state);
  ok('29-state-warp', stWarp === 'warp', 'state=' + stWarp);
  await page.screenshot({ path: path.join(SHOTS, '06-warp.png') });

  await page.waitForTimeout(2300);
  const stChan = await page.evaluate(() => {
    const a = window.__ES.app;
    return { s: a.state, hasChan: !!a.chan, motes: a.chan ? a.chan.motes.length : 0, rocks: a.chan ? a.chan.rocks.length : 0 };
  });
  ok('30-state-channel', stChan.s === 'channel' && stChan.hasChan,
     '通道已开：星尘 ' + stChan.motes + ' / 障碍 ' + stChan.rocks);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, '07-channel.png') });

  /* 通道里真的能吃到、真的会被撞 */
  const chanTest = await page.evaluate(() => {
    const ch = window.__ES.app.chan;
    const before = ch.got;
    /* 把所有星尘挪到玩家身上 —— 等价于"吃到了" */
    for (let i = 0; i < ch.motes.length && ch.got - before < 3; i++) {
      const m = ch.motes[i];
      if (!m.alive) continue;
      m.x = ch.p.x; m.y = -ch.camY + ch.p.y;
    }
    ch.update(0.016, null);
    const gotAfter = ch.got;
    /* 撞一次障碍 */
    const r = ch.rocks.filter(x => x.alive)[0];
    let hitOk = false;
    if (r) {
      ch.p.inv = 0;
      r.x = ch.p.x; r.y = -ch.camY + ch.p.y;
      ch.update(0.016, null);
      hitOk = ch.hits > 0 && ch.slowT > 0;
    }
    return { before: before, after: gotAfter, hit: hitOk };
  });
  ok('31-channel-collect', chanTest.after > chanTest.before, '收集 ' + chanTest.before + ' → ' + chanTest.after);
  ok('32-channel-hit', chanTest.hit, '撞障碍 → 减速 + 计次（不是死亡）');

  /* 快进到通道结束 */
  await page.evaluate(() => {
    const ch = window.__ES.app.chan;
    ch.got = 40;
    ch.t = window.__reg.channel.DUR;
  });
  await page.waitForTimeout(320);
  const stEnd = await page.evaluate(() => window.__ES.app.state);
  ok('33-chanend', stEnd === 'chanend', 'state=' + stEnd);
  await page.screenshot({ path: path.join(SHOTS, '08-chanend.png') });

  /* 点「继续」→ 发卡 → 一路选完 → 回到下一区域 */
  await page.evaluate(() => { window.__reg.input.taps.push({ x: 180, y: 455 }); });
  await page.waitForTimeout(260);
  const stCard = await page.evaluate(() => window.__ES.app.state);
  ok('34-chanend-to-cards', stCard === 'cardpick', 'state=' + stCard);

  for (let i = 0; i < 4; i++) {
    const s = await page.evaluate(() => window.__ES.app.state);
    if (s !== 'cardpick') break;
    await page.evaluate(() => { window.__reg.input.taps.push({ x: 124, y: 408 }); });
    await page.waitForTimeout(220);
  }
  const after = await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb;
    return {
      s: a.state, wave: cb.wave, gate: cb.sing.gate, warps: cb.warps,
      comp: cb.sing.compression, reg: window.__reg.regions.regionOf(cb.wave).id,
    };
  });
  ok('35-after-warp', after.s === 'playing' && after.wave === 11,
     'state=' + after.s + ' wave=' + after.wave + ' 区域=' + after.reg);
  ok('36-gate-closed', after.gate === 0, '门已关闭，回到普通天体');
  ok('37-warp-compress', after.warps === 1 && after.comp > flow.compressBefore,
     '穿越 ' + after.warps + ' 次，压缩 ' + (flow.compressBefore * 100).toFixed(0) + '% → ' + (after.comp * 100).toFixed(0) + '%');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, '09-region2.png') });

  /* ── 5. 暂停 / 结算 ────────────────────────────────────────────── */
  await page.evaluate(() => { window.__ES.app.state = 'paused'; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '04-pause.png') });

  await page.evaluate(() => {
    const a = window.__ES.app;
    a.state = 'playing';
    a.cb.p.hp = 1;
    a.cb.p.inv = 0;          // 穿越出来有 1.2s 无敌帧，不清掉会挡住这一击
    a.cb.hurtPlayer(999);
    a.cb.deadT = 2;
    a.toOver();
  });
  await page.waitForTimeout(400);
  const over = await page.evaluate(() => ({
    state: window.__ES.app.state,
    echo: JSON.parse(localStorage.getItem('wx_es-echo') || 'null'),
    best: JSON.parse(localStorage.getItem('wx_es-best') || '0'),
  }));
  ok('18-over', over.state === 'over', 'state=' + over.state);
  ok('19-echo-saved', over.echo && over.echo.p && over.echo.p.length >= 4, '回响点数 ' + (over.echo ? over.echo.p.length : 0));
  await page.screenshot({ path: path.join(SHOTS, '05-over.png') });

  /* ── 6. 无未捕获异常 ───────────────────────────────────────────── */
  ok('20-no-error', errs.length === 0, errs.slice(0, 3).join(' | '));

  await browser.close();

  const fail = results.filter(r => !r.pass);
  console.log('\n' + (results.length - fail.length) + '/' + results.length + ' PASS');
  if (errs.length) console.log('错误：\n' + errs.slice(0, 8).join('\n'));
  process.exit(fail.length);
})().catch(e => { console.error('探针自身异常：', e); process.exit(99); });
