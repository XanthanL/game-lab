/* ============================================================================
   probe-endtoend.cjs —— 端到端：真的能玩到「钻进奇点」吗？
   ----------------------------------------------------------------------------
   probe.cjs 里的门 / 穿越断言是**手动构造状态**测的（直接调 onGateKeeperDown、
   手动 setGate(2)）。那只能证明"函数被正确调用时行为正确"，不能证明
   「从第 1 波老老实实打到第 10 波，玩家真的会遇到一个能进去的奇点」。

   这个脚本是真的跑：newRun() → 逐帧 update → 看 gate 自己怎么变 → 玩家飞进去。

   玩家开无敌（p.invuln 常驻），因为我们验的是**流程能不能走通**，
   不是"手残玩家能不能活到第 10 波"。手感平衡另有其人。

   用法：
     NODE_PATH=<workspace>/node_modules node tools/h5/probe-endtoend.cjs
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

  /* ── 真跑：从第 1 波打到能进门 ────────────────────────────────── */
  const run = await page.evaluate(() => {
    const a = window.__ES.app;
    const RG = window.__reg.regions;
    a.newRun();
    const cb = a.cb;

    const log = [];              // 关键时刻
    const seen = { gate1: false, gate2: false, bossDead: false };
    let frames = 0, lastWave = 0, stuckAt = 0, lastSig = '';

    const DT = 1 / 60;
    /* 上限 6 分钟游戏时间 —— 走不通就别死循环 */
    const MAXF = 60 * 360;

    while (frames < MAXF) {
      cb.p.invuln = 999;                 // 只验流程，不验操作
      cb.p.inv = 0;

      /* 玩家往门的方向挪一点，模拟"玩家主动飞进去" */
      if (cb.sing.gate === 2 && cb.state === 'gate') {
        const dx = cb.sing.x - cb.p.x, dy = cb.sing.y - cb.p.y;
        const d = Math.hypot(dx, dy) || 1;
        cb.p.x += (dx / d) * 3.2; cb.p.y += (dy / d) * 3.2;
      }

      cb.update(DT, null);
      frames++;

      /* 波次打完会停在 state='wait'（pendingCard），真实游戏里由 app 切到选卡界面、
         玩家点一下、再 startWave(wave+1)。这里代替玩家立刻选第一张。
         ⚠️ 不这么做就会永远卡在 wait —— 这是 app 的职责，不是 combat 的。 */
      if (cb.pendingCard) {
        const cards = a._rollCards();
        cb.applyCard(cards[0]);
        cb.startWave(cb.wave + 1);
      }

      if (cb.wave !== lastWave) { lastWave = cb.wave; }
      if (cb.sing.gate === 1 && !seen.gate1) {
        seen.gate1 = true;
        log.push({ f: frames, t: +(frames / 60).toFixed(1), ev: 'gate1 亚稳态', wave: cb.wave });
      }
      if (cb.sing.gate === 2 && !seen.gate2) {
        seen.gate2 = true;
        log.push({ f: frames, t: +(frames / 60).toFixed(1), ev: 'gate2 已开启', wave: cb.wave });
      }
      if (cb.pendingWarp) {
        log.push({ f: frames, t: +(frames / 60).toFixed(1), ev: '★ 玩家进入奇点 → 请求穿越', wave: cb.wave });
        break;
      }
      /* 卡死检测：状态 + 波次 + 敌数 长时间不变 */
      const sig = cb.state + '|' + cb.wave + '|' + cb.en.count() + '|' + cb.sing.gate;
      if (sig === lastSig) { stuckAt++; } else { stuckAt = 0; lastSig = sig; }
      if (stuckAt > 60 * 90) {   /* 90 秒没变化 = 卡死 */
        log.push({ f: frames, t: +(frames / 60).toFixed(1), ev: '!! 卡死 ' + sig, wave: cb.wave });
        break;
      }
    }

    return {
      frames: frames, sec: +(frames / 60).toFixed(1),
      wave: cb.wave, state: cb.state, gate: cb.sing.gate,
      pendingWarp: cb.pendingWarp,
      kills: cb.kills, score: cb.score,
      isFinal: RG.isRegionFinal(cb.wave),
      log: log,
    };
  });

  console.log('\n  ── 真实流程时间线 ──');
  for (const e of run.log) console.log('    [' + e.t + 's 第' + e.wave + '波] ' + e.ev);
  console.log('');

  ok('E1-reached-final-wave', run.wave === 10 && run.isFinal,
    '打到第 ' + run.wave + ' 波（区域收尾=' + run.isFinal + '），游戏内耗时 ' + run.sec + 's');
  ok('E2-gate-metastable', run.log.some(e => e.ev.indexOf('gate1') >= 0),
    '巨像倒下 → 奇点变亚稳态');
  ok('E3-gate-opened', run.log.some(e => e.ev.indexOf('gate2') >= 0),
    '杂兵肃清 → 奇点开启');
  ok('E4-entered-singularity', run.pendingWarp === true,
    '玩家真的飞进去了 → pendingWarp=' + run.pendingWarp);
  ok('E5-no-stuck', !run.log.some(e => e.ev.indexOf('卡死') >= 0),
    '全程无卡死（击坠 ' + run.kills + '，得分 ' + run.score + '）');
  ok('E6-no-error', errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : '无未捕获异常');

  if (run.pendingWarp) {
    await page.evaluate(() => { window.__ES.app.step(1 / 60); });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, '11-enter-singularity.png') });
  }

  const bad = results.filter(r => !r.pass).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' PASS\n');
  await browser.close();
  process.exit(bad);
})().catch(e => { console.error('探针自身异常：', e.message); process.exit(1); });
