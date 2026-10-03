// singularity-voyage 验证：7 只巨像（含 4 个新机制）+ 4 种关卡形态
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-boss-form-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8623;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const log = (...a) => console.log(...a);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(`http://127.0.0.1:${PORT}/index.html?god=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  await page.waitForTimeout(400);

  const R = await page.evaluate(() => new Promise(async resolve => {
    const out = { _watchdog: false };
    const wd = setTimeout(() => { out._watchdog = true; resolve(out); }, 90000);
    try {
      const d = window.__dbg, G = d.G;
      const frame = () => new Promise(r => requestAnimationFrame(r));
      const clear = () => {
        d.clearEnemies();
        G.fx.length = 0; G.fires.length = 0; G.pickups.length = 0;
        G.vx = 0; G.vy = 0;
      };

      // ---------- ① 巨像表 ----------
      // ⚠️ 必须走 d.bossTable()：BOSSES 是 `const`，不挂在 window 上（和 aimMode 同一个坑）
      const tbl = d.bossTable();
      const ids = d.bossIds();
      out.bossCount = ids.length;
      out.bossMeta = ids.map(id => {
        const b = tbl[id];
        return { id, pats: (b && b.pats) || null, hasTraitEn: !!(b && b.traitEn), spr: (b && b.spr) || null };
      });

      // ---------- ② 逐只巨像、逐个弹幕模式真的放得出来 ----------
      // ⚠️ 每一种都要有**可观测产物**：只跑一遍不报错是不够的 ——
      //    bossFire 里 if/else 链写错一个名字会静默什么都不做（正是 kind 那次事故的同类）。
      out.patResults = [];
      for (const id of ids) {
        const b = tbl[id];
        for (let k = 0; k < b.pats.length; k++) {
          const pat = b.pats[k];
          clear();
          d.setPos(G.px, G.py);
          d.spawnBoss(id);
          const bo = G.boss;
          bo.entering = false;
          bo.patI = k;      // 直接点名要测的那套
          bo.cd = 0;        // 下一帧就开火
          bo.spiralA = 0;
          const vBefore = Math.hypot(bo.vx, bo.vy);
          await frame(); await frame();
          const lasers = G.fx.filter(f => f.type === 'laser').length;
          out.patResults.push({
            boss: id, pat,
            ebullets: G.ebullets.length,
            enemies: G.enemies.length,          // 1 = 只有 Boss 自己；>1 说明 summon 产兵了
            fires: G.fires.length,
            lasers,
            rings: G.fx.filter(f => f.type === 'ring').length,
            bossMoved: +(Math.hypot(bo.vx, bo.vy) - vBefore).toFixed(2),
            pulled: +Math.hypot(G.vx, G.vy).toFixed(2),   // pull 会把玩家拽动
          });
        }
      }

      // ---------- ③ 槽位倍率 & 实际血量 ----------
      out.slotMul = { 4: d.bossSlotMul(4), 8: d.bossSlotMul(8), 12: d.bossSlotMul(12), 16: +d.bossSlotMul(16).toFixed(3) };
      out.hpAt = {};
      for (const [w, id] of [[4, 'motherrock'], [8, 'warden'], [12, 'gate']]) {
        clear();
        G.wave = w;
        d.spawnBoss(id);
        out.hpAt[id + '@' + w] = Math.round(G.boss.maxHp);
      }

      // ---------- ④ 主线巨像轮换：一轮 3 只不重复，多轮覆盖到全部 7 只 ----------
      const seen = {};
      let dupInRun = 0;
      for (let i = 0; i < 240; i++) {
        const r = d.rollMainBosses();
        const vals = [r[4], r[8], r[12]];
        if (new Set(vals).size !== 3) dupInRun++;
        for (const v of vals) seen[v] = (seen[v] || 0) + 1;
      }
      out.rotationCoversAll = Object.keys(seen).length;
      out.rotationDupRuns = dupInRun;
      out.rotationSample = d.rollMainBosses();

      // ---------- ⑤ 关卡形态：主线编排 + 四种都能真的完成 ----------
      out.formMap = {};
      for (let w = 1; w <= 12; w++) out.formMap[w] = d.formForWave(w);
      out.formMapEndless = [13, 14, 15, 16, 17].map(w => d.formForWave(w));

      // 每种形态：铺一段，把完成条件直接满足，看会不会 finishWave（waveState -> 'warp'）
      async function runForm(w, satisfy) {
        clear();
        d.resetStats();
        d.setPos(G.px, G.py);
        G.boss = null; G.bossRef = null; G.bossPending = null;
        d.startWave(w);
        const form = G.waveForm;
        await frame(); await frame();
        const before = { form, state: G.waveState, need: G.waveNeed, dustNeed: G.dustNeed, dur: +G.waveDur.toFixed(1) };
        satisfy(G);
        let state = G.waveState, tries = 0;
        for (let i = 0; i < 240 && state !== 'warp' && tries < 240; i++) { await frame(); state = G.waveState; tries++; }
        return Object.assign(before, { finished: state === 'warp', endState: state });
      }
      out.formPurge = await runForm(1, g => { g.spawnQueue.length = 0; g.enemies.length = 0; });
      out.formSurge = await runForm(6, g => { g.waveT = g.waveDur + 0.1; });
      out.formSalvage = await runForm(3, g => { g.dustGot = g.dustNeed; });
      out.formDuel = await runForm(7, g => { g.spawnQueue.length = 0; g.enemies.length = 0; });

      // 死斗必须真的出精锐
      // ⚠️ 死斗的出怪间隔约 0.4s（spawnT），4 只全刷出来要约 2 秒 ≈ 120 帧。
      //    只等 40 帧的话场上只有 1 只，「全精锐」这条就只验了 1 只，等于没验。
      clear(); d.startWave(7);
      await frame();
      for (let i = 0; i < 220 && G.enemies.length < G.waveNeed; i++) await frame();
      out.duelElite = G.enemies.length ? G.enemies.every(e => e.elite) : null;
      out.duelCount = G.enemies.length;

      // 回收必须真的在地上撒了星尘
      clear(); d.startWave(3);
      await frame();
      out.salvageDustOnField = G.pickups.filter(p => p.type === 'dust').length;
      out.salvageNeed = G.dustNeed;

      // HUD 目标文案逐形态非空
      out.hudTexts = {};
      for (const [w, key] of [[1, 'purge'], [6, 'surge'], [3, 'salvage'], [7, 'duel']]) {
        clear(); d.startWave(w); await frame();
        out.hudTexts[key] = d.objective();
      }

      out.spdMul = G.S.spd;
    } catch (e) { out.fatal = e.message + ' | ' + (e.stack || '').split('\n')[1]; }
    clearTimeout(wd);
    resolve(out);
  }));

  // ---------- ⑦ 新巨像外观截图（像素画是手写的，必须眼看一遍）----------
  // ⚠️ 放在 evaluate 外面：page.screenshot 是 Node 侧的，页内拿不到。
  for (const id of ['hive', 'tempest', 'forge', 'prism']) {
    await page.evaluate(async id => {
      const d = window.__dbg, G = d.G;
      const frame = () => new Promise(r => requestAnimationFrame(r));
      d.clearEnemies();
      G.fx.length = 0; G.fires.length = 0; G.ebullets.length = 0;
      G.boss = null; G.bossRef = null; G.bossPending = null;
      d.startWave(1);
      d.spawnBoss(id);
      G.boss.entering = false;          // 跳过入场，直接看停在场上的样子
      G.boss.y = G.py - 70;
      await frame(); await frame(); await frame();
    }, id);
    await page.screenshot({ path: path.join(ROOT, 'probes', 'boss-' + id + '.png') });
  }
  log('⑦ 新巨像截图        : boss-hive / boss-tempest / boss-forge / boss-prism .png');

  // ---------------- 判定 ----------------
  log('① 巨像数量        :', R.bossCount, '(期望 7)');
  log('② 各巨像弹幕模式   :');
  for (const p of R.patResults) {
    log('   ', p.boss.padEnd(11), p.pat.padEnd(8),
      '弹', String(p.ebullets).padStart(3),
      '敌', String(p.enemies).padStart(2),
      '火', String(p.fires).padStart(2),
      '激光', String(p.lasers).padStart(2),
      '环', String(p.rings).padStart(2),
      '拽', String(p.pulled).padStart(6));
  }
  log('③ 槽位倍率        :', JSON.stringify(R.slotMul));
  log('   实测血量        :', JSON.stringify(R.hpAt));
  log('④ 轮换覆盖        :', R.rotationCoversAll, '/ 7 只  一轮内重复次数:', R.rotationDupRuns, '(必须 0)');
  log('⑤ 主线形态编排     :', JSON.stringify(R.formMap));
  log('   无尽形态循环     :', JSON.stringify(R.formMapEndless));
  log('   清剿完成        :', R.formPurge.finished, JSON.stringify(R.formPurge));
  log('   潮涌完成        :', R.formSurge.finished, JSON.stringify(R.formSurge));
  log('   回收完成        :', R.formSalvage.finished, JSON.stringify(R.formSalvage));
  log('   死斗完成        :', R.formDuel.finished, JSON.stringify(R.formDuel));
  log('   死斗全精锐      :', R.duelElite, '共', R.duelCount, '只');
  log('   回收地上星尘     :', R.salvageDustOnField, '需', R.salvageNeed);
  log('   HUD 目标文案     :', JSON.stringify(R.hudTexts));
  // ---------- ⑥ 火场：站进去会掉血、会过期 ----------
  // ⚠️ 必须**另开一个不带 ?god=1 的页面**：hurtPlayer 第一行就是
  //    `if (G.inv > 0 || G.dead || GOD) return;`，god 模式下根本不会掉血 ——
  //    在主页面上测会得到一个「火场无害」的假阴性。
  const p2 = await browser.newPage({ viewport: { width: 900, height: 520 } });
  p2.on('pageerror', e => errs.push('[fire-page] ' + e.message));
  await p2.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', null, { timeout: 20000 });
  await p2.evaluate(() => { startGame(); });
  await p2.waitForFunction(() => window.__dbg.state === 'play', null, { timeout: 10000 });
  const F = await p2.evaluate(() => new Promise(async resolve => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const o = {};
    try {
      d.clearEnemies(); d.setPos(G.px, G.py);
      G.S.hp = 100; G.S.maxHp = 100; G.inv = 0;
      d.addFire(G.px, G.py, 30);
      const hp0 = G.S.hp; let hpMin = hp0;
      for (let i = 0; i < 90; i++) { await frame(); hpMin = Math.min(hpMin, G.S.hp); }
      o.damaged = hpMin < hp0;
      o.drop = +(hp0 - hpMin).toFixed(1);
      const n = G.fires.length;
      for (let i = 0; i < 420 && G.fires.length; i++) await frame();
      o.expired = n > 0 && G.fires.length === 0;
      // 站在火场**外面**不该掉血（不然就是全场 AOE 了）
      d.setPos(G.px + 300, G.py + 300);
      G.S.hp = 100; G.inv = 0;
      d.addFire(G.px - 300, G.py - 300, 30);
      let hp2 = G.S.hp;
      for (let i = 0; i < 90; i++) { await frame(); hp2 = Math.min(hp2, G.S.hp); }
      o.safeOutside = hp2 >= 100;
    } catch (e) { o.fatal = e.message; }
    resolve(o);
  }));
  log('⑥ 火场掉血        :', F.damaged, '掉了', F.drop, '  会过期:', F.expired, '  场外安全:', F.safeOutside);
  log('pageErrors     :', errs.length ? errs : 'none');
  log('FATAL          :', R.fatal || 'none');

  // 每个新模式必须有可观测产物
  const patOk = r => ({
    summon: r.enemies > 1, burn: r.fires > 0, beamFan: r.lasers >= 5,
    pull: r.pulled > 1 || r.rings > 0, charge: Math.abs(r.bossMoved) > 1,
    laser: r.lasers >= 1,
  }[r.pat] ?? r.ebullets > 0);
  const badPats = (R.patResults || []).filter(r => !patOk(r));

  const pass = R.bossCount === 7
    && (R.bossMeta || []).every(m => m.pats && m.pats.length && m.hasTraitEn && m.spr)
    && badPats.length === 0
    && R.slotMul[4] === 1 && R.slotMul[8] === 2.2 && R.slotMul[12] === 4
    && R.rotationCoversAll === 7 && R.rotationDupRuns === 0
    && R.formPurge.finished && R.formSurge.finished && R.formSalvage.finished && R.formDuel.finished
    && R.duelElite === true && R.salvageDustOnField >= R.salvageNeed
    && Object.values(R.hudTexts).every(t => typeof t === 'string' && t.length > 0 && t.indexOf('⟪') < 0)
    && F.damaged && F.expired && F.safeOutside && !F.fatal
    && !R.fatal && !R._watchdog && errs.length === 0;

  if (badPats.length) log('!! 没放出产物的模式:', JSON.stringify(badPats));
  log('\n' + (pass ? 'PASS ✅ 7 只巨像 + 4 种关卡形态' : 'FAIL ❌'));

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})();
