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
        break;
      }
      if (cb.wave > FINALW && !log.some(e => e.ev.indexOf('越过收尾波') >= 0)) {
        log.push({ t: +(frames / 60).toFixed(1), ev: '!! 越过收尾波却没开门（wave=' + cb.wave + '）', gate: cb.sing.gate, st: cb.state });
      }
      if (a.state === 'over') { log.push({ t: +(frames / 60).toFixed(1), ev: '!! 玩家死亡', gate: cb.sing.gate, st: cb.state }); break; }
    }
    restore();

    return {
      sec: +(frames / 60).toFixed(1), wave: cb.wave, appState: a.state, cbState: cb.state,
      gate: cb.sing.gate, bossSeen: bossSeen, bossKilled: bossKilled, finalW: FINALW,
      singR: +cb.sing.metrics().R.toFixed(1),
      log: log,
    };
  });

  console.log('\n  ── app 状态机时间线 ──');
  for (const e of run.log) console.log('    [' + e.t + 's] ' + e.ev + '   (gate=' + e.gate + ' cb.state=' + e.st + ')');
  console.log('');
  console.log('  终局：第 ' + run.wave + ' 波 · app=' + run.appState + ' · cb=' + run.cbState +
    ' · gate=' + run.gate + ' · 奇点视界 R=' + run.singR);
  console.log('');

  const entered = run.appState === 'warp' || run.appState === 'channel';
  ok('A1-boss-spawned', run.bossSeen, '第 ' + run.finalW + ' 波（区域收尾）出现巨像 warden');
  ok('A2-gate-opened', run.gate === 2 || entered, '奇点开门（gate=' + run.gate + '）');
  ok('A3-entered', entered, entered ? '玩家进入 ' + run.appState : '没能进去（app=' + run.appState + '）');
  ok('A4-not-skipped', !(run.wave > run.finalW && run.gate === 0),
    run.wave > run.finalW && run.gate === 0 ? '★复现作者报告：越过收尾波却从没开门' : '未跳过开门');
  /* 节奏：第一个可进入的奇点必须在 2 分钟量级内出现，
     否则新玩家（单次会话 3–5 分钟）很可能玩不到就退出 */
  ok('A5-pacing', entered && run.sec <= 150,
    '第一个可进入奇点出现在 ' + run.sec + 's（目标 ≤150s，改前 233.6s）');

  if (errs.length) console.log('  异常：' + errs.slice(0, 3).join(' | '));
  const bad = results.filter(r => !r.pass).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' PASS\n');
  await browser.close();
  process.exit(bad);
})().catch(e => { console.error('探针自身异常：', e.message); process.exit(1); });
