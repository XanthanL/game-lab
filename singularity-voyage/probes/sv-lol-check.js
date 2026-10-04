// singularity-voyage 验证：第五批（英雄联盟主题）6 个新能力 + 6 能力型/6 数值型 选择上限
// 自包含：自己起静态服务 + 拉起本地 Chrome，跑完收尾。
// 运行： NODE_PATH=<node-workspace>/node_modules CHROME_EXE=<chrome> node probes/sv-lol-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8631;
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.mp3': 'audio/mpeg' };

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

const URL = process.env.SV_URL || `http://127.0.0.1:${PORT}/index.html?god=1`;
const log = (...a) => console.log(...a);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  log('[cp] server up on ' + PORT);
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
  await page.waitForTimeout(300);

  const R = await page.evaluate(() => new Promise(async resolve => {
    const out = { _watchdog: false };
    const wd = setTimeout(() => { out._watchdog = true; resolve(out); }, 60000);
    try {
      const d = window.__dbg;
      const frame = () => new Promise(r => requestAnimationFrame(r));

      // ---- 1) 6 个新能力都在 MODULES，且 attachIcon 不缺图 ----
      const NEW_IDS = ['windwall', 'shadow', 'spin', 'lotus', 'rampage', 'silver'];
      const modIds = MODULES.map(m => m.id);
      out.missing = NEW_IDS.filter(id => !modIds.includes(id));
      out.iconNull = [];
      for (const id of NEW_IDS) {
        for (let lv = 1; lv <= 3; lv++) {
          if (!attachIcon(id, lv, 44)) out.iconNull.push(id + '@' + lv);
        }
      }

      // ---- 2) 6 能力型 / 6 数值型 上限 ----
      const cap = d.TYPE_CAP();
      // 对照：空 mods 时两类新卡都应出现（证明过滤不是「全禁」）
      d.setMods({});
      let ctl = d.rollPool();
      out.ctlNewAbil = ctl.filter(c => c.lv === 0 && c.type !== 'stat').length;
      out.ctlNewStat = ctl.filter(c => c.lv === 0 && c.type === 'stat').length;
      // 选 6 个能力型（ability/weapon 混合）+ 6 个数值型（stat）卡，全部 lv1
      const abilPool = MODULES.filter(m => m.type !== 'stat');
      const statPool = MODULES.filter(m => m.type === 'stat');
      const sixAbil = {}, sixStat = {};
      for (let i = 0; i < 6; i++) { sixAbil[abilPool[i].id] = 1; sixStat[statPool[i].id] = 1; }
      d.setMods(sixAbil);
      out.abilCount = d.countType('ability');
      out.abilCap = cap.ability;
      // 在新填了 6 能力型的前提下，卡池里**不该出现任何「新的」能力型卡**（lv===0 即新卡）
      let pool = d.rollPool();
      out.newAbilOffered = pool.filter(c => c.lv === 0 && c.type !== 'stat').length;

      d.setMods(sixStat);
      out.statCount = d.countType('stat');
      out.statCap = cap.stat;
      pool = d.rollPool();
      out.newStatOffered = pool.filter(c => c.lv === 0 && c.type === 'stat').length;

      // 上限双满：12 种全占，卡池只应剩已持有模块的升级（新卡一律 0）
      d.setMods(Object.assign({}, sixAbil, sixStat));
      pool = d.rollPool();
      out.newAnyOffered = pool.filter(c => c.lv === 0).length;

      // ---- 3) 功能验证：圣银弩箭叠层 + 真伤 ----
      d.clearMods(); d.grant('silver');           // lv1: silverDmg=18
      const en = d.spawn('tadpole');
      const e = d.nearest();
      e.hp = 9999; e.maxHp = 9999; e.silver = 0; e.silverT = 0;
      d.hit(e, 1, 0, -1); const s1 = e.silver;
      d.hit(e, 1, 0, -1); const s2 = e.silver;
      d.hit(e, 1, 0, -1); const s3 = e.silver;     // 第 3 层结算后归零
      out.silver = { s1, s2, s3, hpAfter: e.hp };  // 期望 1,2,0, 9999-3-18=9978

      // ---- 4) 功能验证：风之障壁周期性生成拦截线 ----
      d.clearMods(); d.grant('windwall');
      d.G.S.wwT = 0.001;                            // 强制下一帧触发
      for (let i = 0; i < 5; i++) await frame();
      out.windwallWalls = d.G.walls.length;         // 期望 > 0

      // ---- 5) 功能验证：杀戮狂热击杀后刷 rampageT ----
      d.clearMods(); d.grant('rampage');
      const e2 = d.spawn('tadpole'); const t2 = d.nearest();
      t2.hp = 1; d.hit(t2, 50, 0, -1);              // 一击致死 → killEnemy → rampageT=3
      out.rampageT = d.G.rampageT;                  // 期望 > 0

      resolve(out);
    } catch (ex) {
      out.error = ex.message + '\n' + (ex.stack || '');
      resolve(out);
    } finally {
      clearTimeout(wd);
    }
  }));

  await browser.close();
  server.close();

  log('=== RESULT ===');
  log(JSON.stringify(R, null, 2));
  log('=== pageErrors (' + errs.length + ') ===');
  errs.slice(0, 10).forEach(e => log(e));

  const pass =
    !R._watchdog && !R.error &&
    R.missing.length === 0 && R.iconNull.length === 0 &&
    R.abilCount === 6 && R.newAbilOffered === 0 &&
    R.statCount === 6 && R.newStatOffered === 0 &&
    R.newAnyOffered === 0 &&
    R.ctlNewAbil > 0 && R.ctlNewStat > 0 &&
    R.silver && R.silver.s1 === 1 && R.silver.s2 === 2 && R.silver.s3 === 0 && R.silver.hpAfter === 9978 &&
    R.windwallWalls > 0 && R.rampageT > 0 &&
    errs.length === 0;
  log(pass ? 'PASS ✅ 第五批能力 + 6/6 上限 全部通过' : 'FAIL ❌ 见上方明细');
  process.exit(pass ? 0 : 1);
})();
