/* ============================================================================
   probe-appflow.cjs —— 走 app.js 状态机的端到端（真实玩家路径）
   ----------------------------------------------------------------------------
   probe-endtoend.cjs 有个致命盲点：它直接调 cb.update()，绕过了 app.js。
   而真实玩家走的是 app.step() —— 波次推进、选卡、进门全在 app 的状态机里。
   作者报告「玩到第 12 波没见到奇点、打 boss 没见到东西」，所以必须按 app 的路径重跑。

   本脚本驱动 app.step()，并在 cardpick 时真的点按钮选卡。
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
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ES && window.__ES.app, null, { timeout: 10000 });

  const run = await page.evaluate(() => {
    const a = window.__ES.app;
    const In = window.__reg.input;
    const RD = window.__reg.render, UI = window.__reg.ui;
    const RG = window.__reg.regions;
    const FINALW = RG.REGION_LEN;      // 第一个区域收尾波 = 第一个开门波

    /* 关掉世界渲染 —— 每帧 drawWorld 太慢，跑不完 7 分钟游戏时间。
       只留 drawCardPick（选卡是真实路径，必须真的点）。 */
    const _dw = RD.drawWorld, _dh = UI.drawHUD;
    RD.drawWorld = function () { };
    UI.drawHUD = function () { };
    const restore = () => { RD.drawWorld = _dw; UI.drawHUD = _dh; };

    a.newRun();
    const cb = a.cb;

    const log = [];
    let frames = 0, bossSeen = false, bossKilled = false;
    let enteredSec = null;
    const DT = 1 / 60;
    const MAXF = 60 * 420;   // 最多 7 分钟游戏时间

    while (frames < MAXF) {
      cb.p.invuln = 999; cb.p.inv = 0;   // 只验流程

      /* 门开了就往里飞（模拟玩家看到提示后主动进去） */
      if (cb.sing.gate === 2) {
        const dx = cb.sing.x - cb.p.x, dy = cb.sing.y - cb.p.y;
        const d = Math.hypot(dx, dy) || 1;
        cb.p.x += (dx / d) * 3.2; cb.p.y += (dy / d) * 3.2;
      }

      /* cardpick 时真的点一下第一张卡（真实玩家路径） */
      if (a.state === 'cardpick') {
        In.taps.push({ x: 124, y: 408 });
      }

      a.step(DT);
      frames++;

      /* 记录第一个区域收尾波（巨像波）的生死 —— 从 REGION_LEN 派生，别写死 */
      if (cb.wave === FINALW) {
        let warden = null;
        for (let i = 0; i < cb.en.n; i++) {
          const e = cb.en.a[i];
          if (e.alive && e.kind === 'warden') { warden = e; break; }
        }
        if (warden) bossSeen = true;
        else if (bossSeen && !bossKilled) {
          bossKilled = true;
          log.push({ t: +(frames / 60).toFixed(1), ev: '第' + FINALW + '波 巨像已消失', gate: cb.sing.gate, st: cb.state });
        }
      }
      if (cb.sing.gate === 1 && !log.some(e => e.ev.indexOf('gate1') >= 0)) {
        log.push({ t: +(frames / 60).toFixed(1), ev: 'gate1 亚稳态', gate: 1, st: cb.state });
      }
      if (cb.sing.gate === 2 && !log.some(e => e.ev.indexOf('gate2') >= 0)) {
        log.push({ t: +(frames / 60).toFixed(1), ev: 'gate2 已开启', gate: 2, st: cb.state });
      }
      if (a.state === 'warp' || a.state === 'channel') {
        log.push({ t: +(frames / 60).toFixed(1), ev: '★ 进入 ' + a.state, gate: cb.sing.gate, st: cb.state });
        enteredSec = +(frames / 60).toFixed(1);
        break;
      }
      if (cb.wave > FINALW && !log.some(e => e.ev.indexOf('越过收尾波') >= 0)) {
        log.push({ t: +(frames / 60).toFixed(1), ev: '!! 越过收尾波却没开门（wave=' + cb.wave + '）', gate: cb.sing.gate, st: cb.state });
      }
      if (a.state === 'over') { log.push({ t: +(frames / 60).toFixed(1), ev: '!! 玩家死亡', gate: cb.sing.gate, st: cb.state }); break; }
    }
    restore();

    /* ─────────────────────────────────────────────────────────────
       通道可达性 —— 真实玩家从 warp 进入 channel 必须能玩通。
       作者问「通道做出来了吗」，本节负责证明：
       1) warp 过场 → channel 真的进入；
       2) 通道里能吃到星尘；
       3) 22 秒后 → chanend → 折算成 N 张强化。

       eval 在检测到关键事件时返回 node，由 node 拍图；之后
       再用第二次 eval 把通道走完。这样能保证截图拍到当下状态。
       ───────────────────────────────────────────────────────────── */
    const chanEvents = [];
    let f2 = 0;
    if (a.state === 'warp' || a.state === 'channel') {
      /* 阶段 A：驱动到 state === 'channel'，给 node 拍入口图 */
      while (a.state === 'warp' && f2 < 60 * 30) {
        a.step(DT); f2++;
      }
      if (a.state === 'channel') {
        chanEvents.push('reach');
        log.push({ t: +((frames + f2) / 60).toFixed(1), ev: '★ 进入 channel', gate: cb.sing.gate });
      }
    }

    return {
      sec: +(frames / 60).toFixed(1), wave: cb.wave, appState: a.state, cbState: cb.state,
      gate: cb.sing.gate, bossSeen: bossSeen, bossKilled: bossKilled, finalW: FINALW,
      singR: +cb.sing.metrics().R.toFixed(1),
      log: log,
      chanEvents: chanEvents,
      enteredSec: enteredSec,
      _chanFrames: frames + f2,    // 给阶段 B 接上帧计数
    };
  });

  /* 阶段 A 的截图：真的进入 channel 那一刻 */
  if (run.chanEvents.includes('reach')) {
    await page.screenshot({ path: path.join(SHOTS, '13-channel-enter.png') });
    console.log('    [shot] 13-channel-enter.png');
  }

  /* 阶段 B：在 node 端拍完入口图后，把通道走到 8 秒，拍 mid 截图 */
  let chanMid = await page.evaluate((startFrame) => {
    const a = window.__ES.app;
    const DT = 1 / 60;
    let frames = startFrame;
    if (a.state !== 'channel') return { frames: frames };
    let f = 0;
    while (f < 60 * 12 && a.state === 'channel') {
      if (a.chan) {
        const ch = a.chan;
        let best = null, bestD = 9999;
        for (const m of ch.motes) {
          const dx = m.x - ch.p.x, dy = m.y - ch.p.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = m; }
        }
        if (best) {
          const dx = best.x - ch.p.x, dy = best.y - ch.p.y;
          const d = Math.hypot(dx, dy) || 1;
          ch.p.vx = (dx / d) * 180; ch.p.vy = (dy / d) * 180;
        }
      }
      a.step(DT); f++; frames++;
    }
    return { frames: frames };
  }, run._chanFrames);

  /* 在 node 端检查 mid 截图时是否仍在 channel 状态（因为 chanMid 是异步的） */
  const midSt = await page.evaluate(() => window.__ES.app.state);
  if (midSt === 'channel') {
    await page.screenshot({ path: path.join(SHOTS, '14-channel-midflight.png') });
    console.log('    [shot] 14-channel-midflight.png');
  }

  /* 阶段 C：从 mid 走完到 chanend */
  const chanEnd = await page.evaluate((startFrame) => {
    const a = window.__ES.app;
    const DT = 1 / 60;
    let frames = startFrame;
    let f = 0;
    const events = [];
    while (f < 60 * 30 && (a.state === 'channel' || a.state === 'warp')) {
      if (a.state === 'channel' && a.chan) {
        const ch = a.chan;
        let best = null, bestD = 9999;
        for (const m of ch.motes) {
          const dx = m.x - ch.p.x, dy = m.y - ch.p.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = m; }
        }
        if (best) {
          const dx = best.x - ch.p.x, dy = best.y - ch.p.y;
          const d = Math.hypot(dx, dy) || 1;
          ch.p.vx = (dx / d) * 180; ch.p.vy = (dy / d) * 180;
        }
      }
      a.step(DT); f++; frames++;
      if (a.state === 'chanend') {
        const g = a.chan ? a.chan.got : 0;
        const c = a.chan ? a.chan.cards() : 0;
        events.push('end:' + g + ':' + c);
        break;
      }
    }
    return { events: events, got: a.chan ? a.chan.got : 0, cards: a.chan ? a.chan.cards() : 0, frames: frames };
  }, chanMid.frames);

  /* 中段通道截图（mid 触发时已在 node 端拍过；这里是兜底） */
  for (const ev of chanEnd.events) {
    if (ev.startsWith('end:')) { await page.screenshot({ path: path.join(SHOTS, '15-chanend-realplay.png') }); console.log('    [shot] 15-chanend-realplay.png'); }
  }

  /* 把阶段 B 的事件合到 chanEvents 上，断言用 */
  const finalChanEvents = run.chanEvents.concat(chanEnd.events);

  console.log('\n  ── app 状态机时间线 ──');
  for (const e of run.log) console.log('    [' + e.t + 's] ' + e.ev + '   (gate=' + e.gate + ' cb.state=' + e.st + ')');
  console.log('');
  console.log('  终局：第 ' + run.wave + ' 波 · app=' + run.appState + ' · cb=' + run.cbState +
    ' · gate=' + run.gate + ' · 奇点视界 R=' + run.singR);
  console.log('');

  const entered = run.enteredSec != null;
  ok('A1-boss-spawned', run.bossSeen, '第 ' + run.finalW + ' 波（区域收尾）出现巨像 warden');
  ok('A2-gate-opened', run.gate === 2 || entered, '奇点开门（gate=' + run.gate + '）');
  ok('A3-entered', entered, entered ? '玩家进入 warp/channel（用时 ' + run.enteredSec + 's）' : '没能进去（app=' + run.appState + '）');
  ok('A4-not-skipped', !(run.wave > run.finalW && run.gate === 0),
    run.wave > run.finalW && run.gate === 0 ? '★复现作者报告：越过收尾波却从没开门' : '未跳过开门');
  /* 节奏：第一个可进入的奇点必须在 2 分钟量级内出现，
     否则新玩家（单次会话 3–5 分钟）很可能玩不到就退出 */
  ok('A5-pacing', entered && run.enteredSec <= 150,
    '第一个可进入奇点出现在 ' + run.enteredSec + 's（目标 ≤150s，改前 233.6s）');

  /* 通道可达性 —— 作者问「雷霆战机式奖励关做出来了吗」 */
  const chanReach = finalChanEvents.includes('reach');
  const chanEndEv = finalChanEvents.find(e => e.startsWith('end:'));
  let chanGot = 0, chanCards = 0;
  if (chanEndEv) { const [, g, c] = chanEndEv.split(':'); chanGot = +g; chanCards = +c; }
  ok('A6-channel-reached', chanReach, chanReach ? 'warp → channel 真实进入' : '没能从 warp 进入 channel');
  ok('A7-channel-collected', chanGot > 0, '通道里收到 ' + chanGot + ' 颗星尘');
  ok('A8-chanend-reward', chanCards >= 1, '折算成 ' + chanCards + ' 张强化卡（最低 1 张）');

  if (errs.length) console.log('  异常：' + errs.slice(0, 3).join(' | '));
  const bad = results.filter(r => !r.pass).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' PASS\n');
  await browser.close();
  process.exit(bad);
})().catch(e => { console.error('探针自身异常：', e.message); process.exit(1); });
