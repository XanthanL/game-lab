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

  /* ── 3.6 拾取物：刷新 / 磁吸 / 吃到 ───────────────────────────── */
  const pk = await page.evaluate(() => {
    const cb = window.__ES.app.cb;
    const out = {};
    const noop = function () { };

    cb.pk.reset();
    cb.pk.t = 0.001;
    cb.pk.update(0.02, cb.p, cb.sing, cb.rng, cb.fx, noop);
    out.spawned = cb.pk.a.length;
    if (!out.spawned) return out;

    /* 磁吸：放进磁吸圈内、拾取圈外（磁吸 ≈37、拾取 26） */
    const u = cb.pk.a[0];
    u.x = cb.p.x + 30; u.y = cb.p.y;
    const d0 = Math.hypot(u.x - cb.p.x, u.y - cb.p.y);
    cb.pk.update(0.016, cb.p, cb.sing, cb.rng, cb.fx, noop);
    const d1 = Math.hypot(u.x - cb.p.x, u.y - cb.p.y);
    out.magnet = { d0: d0, d1: d1, ok: d1 < d0 - 0.5 };

    /* 吃到：贴到玩家身上 */
    u.x = cb.p.x; u.y = cb.p.y;
    const got = [];
    cb.pk.update(0.016, cb.p, cb.sing, cb.rng, cb.fx, function (t) { got.push(t); });
    out.grabbed = got.length;
    out.left = cb.pk.a.length;
    return out;
  });
  ok('40-pickup-spawn', pk.spawned >= 1, '刷新出 ' + pk.spawned + ' 个');
  ok('41-pickup-magnet', !!(pk.magnet && pk.magnet.ok),
    pk.magnet ? ('磁吸 ' + pk.magnet.d0.toFixed(1) + ' → ' + pk.magnet.d1.toFixed(1)) : '未测到');
  ok('42-pickup-grab', pk.grabbed >= 1 && pk.left === 0, '吃到 ' + pk.grabbed + ' 个，场上剩 ' + pk.left);

  /* ── 3.7 buff 数值（与网页版对齐）─────────────────────────────── */
  const bf = await page.evaluate(() => {
    const cb = window.__ES.app.cb, p = cb.p;
    const AHv = window.__reg.arena.ARENA_H;
    const out = {};

    cb.applyPickup('boost', 100, 100); out.boostT = p.boostT;
    cb.applyPickup('rate', 100, 100); out.rateT = p.rateT;
    cb.applyPickup('invuln', 100, 100); out.invuln = p.invuln;
    cb.applyPickup('shield', 100, 100); out.shieldAmt = p.shieldTmp;

    /* 回血 +30% 上限 */
    p.hp = 40; p.maxHp = 100;
    cb.applyPickup('heal', 100, 100);
    out.heal = p.hp;

    /* 极速实测：远离奇点，避免引力干扰 */
    const stick = { active: true, dx: 1, dy: 0 };
    function run(n, dt) { for (let i = 0; i < n; i++) cb.updatePlayer(dt, { stick: stick }); }
    function reset() { p.x = 40; p.y = AHv - 60; p.vx = 0; p.vy = 0; }
    p.boostT = 0; reset(); run(60, 1 / 60);
    out.spd0 = Math.hypot(p.vx, p.vy);
    p.boostT = 7; reset(); run(60, 1 / 60);
    out.spd1 = Math.hypot(p.vx, p.vy);

    /* 射速实测：数 1 秒里打出多少发 */
    p.boostT = 0;
    p.rateT = 0; p.cd = 0; cb.pb.clear(); run(60, 1 / 60);
    out.n0 = cb.pb.count();
    p.rateT = 7; p.cd = 0; cb.pb.clear(); run(60, 1 / 60);
    out.n1 = cb.pb.count();

    /* 无敌力场：受击应完全无效 */
    p.rateT = 0; p.hp = 100; p.inv = 0; p.shield = 0; p.shieldTmp = 0; p.invuln = 4;
    cb.hurtPlayer(50);
    out.invulnHp = p.hp;

    /* 相位屏障先扛，船体不掉 */
    p.invuln = 0; p.hp = 100; p.inv = 0; p.shield = 0;
    cb.applyPickup('shield', 100, 100);
    const s0 = p.shieldTmp;
    cb.hurtPlayer(20);
    out.shield0 = s0; out.shieldLeft = p.shieldTmp; out.shieldHp = p.hp;

    /* 「数据注入」连开 24 次，协同不能被白送 */
    const syn0 = cb.synergy;
    for (let i = 0; i < 24; i++) cb.applyPickup('level', 100, 100);
    out.synDelta = cb.synergy - syn0;

    /* 收尾清干净，别污染后续用例 */
    p.boostT = 0; p.rateT = 0; p.invuln = 0; p.shieldTmp = 0; p.shieldTmpMax = 0;
    p.hp = p.maxHp; cb.toasts.length = 0; cb.pk.reset();
    return out;
  });
  ok('43-buff-values', bf.boostT === 7 && bf.rateT === 7 && bf.invuln === 4 && bf.shieldAmt === 40,
    'boost 7s / rate 7s / invuln 4s / 屏障 40');
  ok('44-buff-heal', Math.abs(bf.heal - 70) < 0.6, '回血 40 → ' + bf.heal.toFixed(0) + '（+30% 上限）');
  ok('45-buff-speed', bf.spd1 > bf.spd0 * 1.25, '极速 ' + bf.spd0.toFixed(0) + ' → ' + bf.spd1.toFixed(0));
  ok('46-buff-rate', bf.n1 > bf.n0 * 1.3, '1 秒弹量 ' + bf.n0 + ' → ' + bf.n1);
  ok('47-buff-invuln', bf.invulnHp === 100, '无敌力场下受击 50，船体仍是 ' + bf.invulnHp);
  ok('48-buff-shield', bf.shieldHp === 100 && Math.abs(bf.shieldLeft - (bf.shield0 - 20)) < 0.01,
    '屏障先扛：' + bf.shield0 + ' → ' + bf.shieldLeft + '，船体未掉血');
  ok('49-level-no-syn', bf.synDelta === 0, '连开 24 次数据注入，协同未被白送（+' + bf.synDelta + '）');

  /* ── 3.8 屏幕边缘状态层 ────────────────────────────────────────
     判据不是"画面变了"，而是"哪个通道涨得最多" —— 这样颜色错了也能抓到：
       朱砂 danger  R 主导且 G/R≈0.33 · 石绿 puBoost G 主导
       黄铜 amberHi R 主导但 G/R≈0.88（靠这个比值跟朱砂区分开）· 冰蓝 cyanHi B 最亮 */
  const au = await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb, p = cb.p;
    const AR = window.__reg.arena, RD = window.__reg.render, AU = window.__reg.aura;
    const cv = window.__ES.PAL.canvas, c = cv.getContext('2d');

    cb.pk.reset(); cb.pk.t = 1e9;    // 别让拾取物刷在采样点附近污染读数

    /* 采样点：屏幕顶部边缘内侧 y=6（世界单位）—— 最外那条带就落在这儿 */
    const pt = AR.toPx(AR.ARENA_W / 2, 6);
    const sx = Math.max(0, Math.min(cv.width - 12, Math.round(pt.x) - 6));
    const sy = Math.max(0, Math.min(cv.height - 12, Math.round(pt.y) - 6));
    function samp() {
      const d = c.getImageData(sx, sy, 12, 12).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return { r: r / n, g: g / n, b: b / n };
    }
    function frame() { RD.drawWorld(c, cb, a.stars); AU.draw(c, cb); }
    /* 扫 16 帧取峰值：低血带是脉动的，单帧可能正好落在波谷 */
    function peak(setup) {
      setup();
      let best = { r: 0, g: 0, b: 0 }, bestSum = -1;
      for (let k = 0; k < 16; k++) {
        cb.time = k * 0.05;
        frame();
        const s = samp(), sum = s.r + s.g + s.b;
        if (sum > bestSum) { bestSum = sum; best = s; }
      }
      return best;
    }
    function clean() {
      p.hp = p.maxHp; p.boostT = 0; p.rateT = 0; p.invuln = 0;
      p.shieldTmp = 0; p.shieldTmpMax = 0; p.alive = true;
    }

    const base = peak(clean);
    const low = peak(function () { clean(); p.hp = p.maxHp * 0.12; });
    const boost = peak(function () { clean(); p.boostT = 7; });
    const inv = peak(function () { clean(); p.invuln = 4; });
    const rate = peak(function () { clean(); p.rateT = 7; });

    /* 数据源一致性：边缘光带与 HUD 徽章必须读同一份 list，顺序也固定 */
    clean(); p.invuln = 4; p.boostT = 7;
    const list = AU.buffList(cb).map(function (x) { return x.id; });
    clean(); frame();
    return { base: base, low: low, boost: boost, inv: inv, rate: rate, list: list };
  });
  const dLow = { r: au.low.r - au.base.r, g: au.low.g - au.base.g, b: au.low.b - au.base.b };
  const dBst = { r: au.boost.r - au.base.r, g: au.boost.g - au.base.g, b: au.boost.b - au.base.b };
  const dInv = { r: au.inv.r - au.base.r, g: au.inv.g - au.base.g, b: au.inv.b - au.base.b };
  const dRte = { r: au.rate.r - au.base.r, g: au.rate.g - au.base.g, b: au.rate.b - au.base.b };
  ok('50-aura-low', dLow.r > 3 && dLow.r > dLow.g && dLow.r > dLow.b,
    '低血边缘转朱砂 ΔRGB(' + dLow.r.toFixed(1) + ',' + dLow.g.toFixed(1) + ',' + dLow.b.toFixed(1) + ')');
  ok('51-aura-boost', dBst.g > 3 && dBst.g > dBst.r,
    '推进超频边缘转石绿 ΔRGB(' + dBst.r.toFixed(1) + ',' + dBst.g.toFixed(1) + ',' + dBst.b.toFixed(1) + ')');
  ok('52-aura-invuln', dInv.r > 3 && (dInv.g / Math.max(0.01, dInv.r)) > 0.5,
    '无敌力场边缘转黄铜 ΔRGB(' + dInv.r.toFixed(1) + ',' + dInv.g.toFixed(1) + ',' + dInv.b.toFixed(1) +
    ') G/R=' + (dInv.g / Math.max(0.01, dInv.r)).toFixed(2) + '（朱砂仅 ≈0.33）');
  ok('53-aura-rate', dRte.b > 3 && dRte.b >= dRte.r,
    '火力超频边缘转冰蓝 ΔRGB(' + dRte.r.toFixed(1) + ',' + dRte.g.toFixed(1) + ',' + dRte.b.toFixed(1) + ')');
  ok('54-aura-order', au.list.length === 2 && au.list[0] === 'invuln' && au.list[1] === 'boost',
    '徽章与光带同源，顺序固定 [' + au.list.join(',') + ']');

  /* ── 3.10 区域划分与奇点阶段必须同步 ────────────────────────────
     两处硬编码同一套波次划分（REGIONS[].from / STAGES[].from）。
     改一处忘另一处 → 「区域横幅说视界、奇点读数还是外环」的割裂。 */
  const sync = await page.evaluate(() => {
    const RG = window.__reg.regions, SG = window.__reg.singularity;
    const rf = RG.REGIONS.map(r => r.from);
    const sf = SG.STAGES.map(s => s.from);
    return {
      rf: rf, sf: sf, len: RG.REGION_LEN,
      same: rf.length === sf.length && rf.every((v, i) => v === sf[i]),
      /* 波次 1..15 逐波核对：区域下标必须等于阶段下标 */
      perWave: (function () {
        const bad = [];
        for (let w = 1; w <= RG.REGION_LEN * 3; w++) {
          if (RG.regionIndex(w) !== SG.STAGES.findIndex(s => s.from > w) - 1 + 1 &&
            RG.regionIndex(w) !== (function () {
              let k = 0; for (let i = 0; i < SG.STAGES.length; i++) if (w >= SG.STAGES[i].from) k = i; return k;
            })()) bad.push(w);
        }
        return bad;
      })(),
    };
  });
  ok('55-stage-region-sync', sync.same && sync.perWave.length === 0,
    '区域 from[' + sync.rf.join(',') + '] ≡ 阶段 from[' + sync.sf.join(',') +
    ']，逐波核对 1–' + (sync.len * 3) + ' 无错位');

  /* ── 3.11 奇点必须看得见（作者实测到第12波都没发现它） ─────────── */
  const vis = await page.evaluate(() => {
    const cb = window.__ES.app.cb;
    const out = {};
    const r0 = (function () { cb.sing.stage = 0; cb.sing.pendingStage = 0; cb.sing.stageT = 1; cb.sing.setSynergy(0); return cb.sing.metrics().R; })();
    const r0c = (function () { cb.sing.setSynergy(6); cb.sing.setWarp(3); return cb.sing.metrics().R; })();
    const r1 = (function () { cb.sing.setSynergy(0); cb.sing.setWarp(0); cb.sing.stage = 1; cb.sing.pendingStage = 1; return cb.sing.metrics().R; })();
    const r2 = (function () { cb.sing.stage = 2; cb.sing.pendingStage = 2; return cb.sing.metrics().R; })();
    cb.sing.stage = 0; cb.sing.pendingStage = 0; cb.sing.setSynergy(0); cb.sing.setWarp(0);
    return { r0: r0, r0c: r0c, r1: r1, r2: r2 };
  });
  ok('56-sing-visible', vis.r0 >= 9 && vis.r0c >= 9,
    '外环阶段 R=' + vis.r0.toFixed(1) + '（满压缩保底 ' + vis.r0c.toFixed(1) +
    '）· 视界 ' + vis.r1.toFixed(1) + ' · 核心 ' + vis.r2.toFixed(1) +
    ' —— 拾取物直径约 24，外环直径 ' + (vis.r0 * 2).toFixed(0));

  /* ── 3.8b 存档：第 1 波的奇点长什么样（作者说"全程没看见它"） ─── */
  await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb;
    a.state = 'playing';
    cb.wave = 1; cb.sing.stage = 0; cb.sing.pendingStage = 0; cb.sing.stageT = 1;
    cb.sing.setSynergy(0); cb.sing.setWarp(0);
    cb.sing.x = 180; cb.sing.y = window.__reg.arena.ARENA_H * 0.40;
    cb.pk.reset(); cb.pk.t = 1e9;
    cb.p.hp = cb.p.maxHp; cb.p.invuln = 0; cb.p.boostT = 0; cb.p.rateT = 0;
    cb.p.shieldTmp = 0; cb.p.shieldTmpMax = 0; cb.toasts.length = 0;
    cb.time = 0.4;
    a.step(1 / 60);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, '12-singularity-wave1.png') });

  /* ── 3.9 存档：多条光带同屏 + 拾取物字形 ─────────────────────── */
  await page.evaluate(() => {
    const a = window.__ES.app, cb = a.cb, p = cb.p;
    cb.pk.reset(); cb.pk.t = 1e9;      // 关掉自动刷新，摆固定的一组
    a.state = 'playing';
    /* 低血 + 四个 buff = 五条带（低血在最外，最厚） */
    p.hp = p.maxHp * 0.22;
    p.invuln = 4; p.boostT = 7; p.rateT = 7;
    cb.applyPickup('shield', 100, 100);
    /* 六种拾取物各摆一个 —— 主要用来检查几何字形缩到 10px 还认不认得出 */
    const mk = (t, x, y) => ({ type: t, x: x, y: y, t: 0.6, life: 12, tr: 0, pulled: false });
    cb.pk.a.push(mk('boost', 90, 250), mk('heal', 180, 250), mk('rate', 270, 250));
    cb.pk.a.push(mk('shield', 135, 340), mk('invuln', 225, 340), mk('level', 180, 420));
    cb.time = 0.2;
    a.step(1 / 60);
  });
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(SHOTS, '10-buffs.png') });
  await page.evaluate(() => {
    const cb = window.__ES.app.cb, p = cb.p;
    p.hp = p.maxHp; p.invuln = 0; p.boostT = 0; p.rateT = 0;
    p.shieldTmp = 0; p.shieldTmpMax = 0; cb.toasts.length = 0; cb.pk.reset();
  });

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
    /* ⚠️ 别硬编码波次 —— 区域长度会调（10 → 5），写死就得跟着改，
       忘了就会误报 FAIL。全部从 REGION_LEN 派生。 */
    out.len = RG.REGION_LEN;
    out.regions = [RG.regionOf(1).id, RG.regionOf(1 + RG.REGION_LEN).id, RG.regionOf(1 + RG.REGION_LEN * 2).id];
    out.final = [RG.isRegionFinal(1), RG.isRegionFinal(RG.REGION_LEN), RG.isRegionFinal(RG.REGION_LEN * 2)];
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
  ok('22-region-final', flow.final[0] === false && flow.final[1] === true && flow.final[2] === true,
    '第 ' + flow.len + '/' + (flow.len * 2) + ' 波是收尾波，第 1 波不是（区域长度 ' + flow.len + '）');
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
