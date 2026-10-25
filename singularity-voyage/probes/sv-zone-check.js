// singularity-voyage 验证：**五个星区主题**（2026-10-23）
//   一个主题 = 视觉 + 地形布局 + 专属机制，三件事绑死。本探针逐条守：
//   ① 五区名字 / 布局 / 机制**两两不同**（两个区共用同一条机制 = 白做一个）
//   ② 段 → 区的映射（主线 1-3/4-6/7-9/10-12，无尽 13 起 = 结晶）
//   ③ 视觉真的不一样：背景像素 hash + 地形贴图 hash + 皮肤元素数量，逐区比对
//   ④ 五条机制各有可观测产物，且**都带对照组**（防「弹没飞 / 块没动」的假绿）
//   ⑤ 巨像段与视界段不开机制      ⑥ i18n / 零错误
//
// ⚠️ **不开 ?god**：hurtPlayer 在 god 下首行 return，测不到火场 / 锁膛这类真值。
//    全程靠 clearSoft 清场保命，不靠无敌。
// 自包含：自己起静态服务，跑完收尾。
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const CHROME = require('./probe-lib').chrome;
const ROOT = path.resolve(__dirname, '..');
const PORT = 8641;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const log = (...a) => console.log(...a);
const ok = b => b ? 'OK  ' : 'FAIL';

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 520 });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));

  const R = await page.evaluate(() => new Promise(async (resolve, reject) => {
    try {
      const d = window.__dbg, G = d.G;
      const frame = () => new Promise(r => requestAnimationFrame(r));
      const R = {};
      /* ⚠️ 清场不能把 spawnQueue 清空：队列空 + 场上无敌人 → finishWave → 1.8s 后
         startWave 重建地形与机制，探针刚摆好的东西全被换掉（而且一行报错都没有）。 */
      const keepWave = () => { while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker'); };
      const clearSoft = keepBoss => {
        G.enemies.length = 0; G.pickups.length = 0; keepWave();
        if (!keepBoss) { G.boss = null; G.bossPending = null; }
      };
      const run = async (n, keepBoss) => { for (let i = 0; i < n; i++) { clearSoft(keepBoss); G.hitstop = 0; await frame(); } };
      /* ⚠️ 按**游戏时间**跑，不是按帧数：主循环把 dt clamp 在 0.05s，机器负载一高
         帧间隔就超过 50ms，固定帧数等于「推进了更少的游戏时间」—— run-all 跑到后
         半程时正是这样，drift 的位移掉到 4px 阈值以下假红（2026-10-25 抓到一次，
         单独重跑却是 19.2px）。凡是「跑一段时间再量位移」的用例都得用它。 */
      const runSecs = async (s, cap = 400) => {
        const t0 = G.t;
        for (let i = 0; i < cap && G.t - t0 < s; i++) { clearSoft(); G.hitstop = 0; await frame(); }
      };
      const park = (x, y) => { d.setPos(x, y); G.vx = 0; G.vy = 0; };
      // 逐像素 hash：同一张图必须同一个值，换配色必须换值
      const hashCanvas = cv => {
        const c = cv.getContext('2d');
        const w = Math.min(cv.width, 48), h = Math.min(cv.height, 48);
        const px = c.getImageData(0, 0, w, h).data;
        let h1 = 2166136261;
        for (let i = 0; i < px.length; i += 4) { h1 ^= px[i] + px[i + 1] * 3 + px[i + 2] * 7; h1 = (h1 * 16777619) >>> 0; }
        return h1;
      };

      // ---------- ① 五区：名字 / 布局 / 机制两两不同 ----------
      const ZS = d.zones();
      R.zoneN = ZS.length;
      R.names = ZS.map(z => z.name);
      R.terrains = ZS.map(z => z.terrain);
      R.hazs = ZS.map(z => z.haz);
      R.uniqueName = new Set(R.names).size === R.zoneN;
      R.uniqueTerr = new Set(R.terrains).size === R.zoneN;
      R.uniqueHaz = new Set(R.hazs).size === R.zoneN;
      R.hazNames = Object.keys(d.hazards()).length;

      // ---------- ② 段 → 区 ----------
      R.map = {};
      for (const w of [1, 3, 4, 6, 7, 9, 10, 12, 13, 14]) R.map[w] = d.zoneOf(w);
      R.mapOk = R.map[1] === 0 && R.map[3] === 0 && R.map[4] === 1 && R.map[6] === 1
        && R.map[7] === 2 && R.map[9] === 2 && R.map[10] === 3 && R.map[12] === 3
        && R.map[13] === 4;

      // ---------- ③ 视觉：背景 / 地形贴图 / 皮肤元素 ----------
      R.bgHash = {}; R.slabHash = {}; R.skinN = {};
      for (let z = 0; z < R.zoneN; z++) {
        d.setZone(z);
        await run(2);
        const cv = document.querySelector('canvas');
        const c2 = cv.getContext('2d');
        // 背景取样：左上角一块（HUD 在底部/两侧，左上基本是纯背景）
        const px = c2.getImageData(8, 8, 120, 80).data;
        let h1 = 2166136261;
        for (let i = 0; i < px.length; i += 4) { h1 ^= px[i] + px[i + 1] * 3 + px[i + 2] * 7; h1 = (h1 * 16777619) >>> 0; }
        R.bgHash[z] = h1;
        // 地形贴图：同一块 slab，换个区必须换张图
        d.terrClear(); park(400, 400); await run(2);
        d.terrPut('core', 700, 340, 48, 48);
        const cb = G.terr.filter(b => b.kind === 'core')[0];
        R.slabHash[z] = cb ? hashCanvas(cb.cv) : 0;
        R.skinN[z] = G.zskin ? G.zskin.length : -1;
      }
      const uniq = o => new Set(Object.values(o)).size;
      R.bgOk = uniq(R.bgHash) === R.zoneN;
      R.slabOk = uniq(R.slabHash) === R.zoneN;

      // ---------- ④ 机制逐条（每条带对照） ----------
      R.mech = {};

      // ① drift（碎屑带，第 3 段）
      d.gotoWave(3); await run(3);
      R.mech.driftZone = d.zoneOf(3);
      const mov = G.terr.filter(b => b.mov);
      R.mech.driftN = mov.length;
      const p0 = mov.length ? { x: mov[0].x, y: mov[0].y } : null;
      await runSecs(1.2);   // 见 runSecs 那条注释：按游戏时间跑，别写死帧数
      const mv2 = G.terr.filter(b => b.mov)[0];
      R.mech.driftMoved = p0 && mv2 ? +(Math.hypot(mv2.x - p0.x, mv2.y - p0.y)).toFixed(1) : 0;
      R.mech.driftPos = mv2 ? [Math.round(mv2.x), Math.round(mv2.y), mv2.w, mv2.h] : null;
      R.mech.world = d.world;
      // ⚠️ d.world 是 **[w, h]** 数组，不是 {w,h} —— 写 .w 会拿到 undefined，
      //    比较恒 false，于是「块一直在场内」永远是假红。
      R.mech.driftInWorld = !!mv2 && mv2.x > 0 && mv2.x + mv2.w < d.world[0] && mv2.y > 0 && mv2.y + mv2.h < d.world[1];
      R.mech.driftOk = R.mech.driftN >= 3 && R.mech.driftMoved > 4 && R.mech.driftInWorld;

      // ② emp（星云，第 5 段）：清弹 + 麻痹 + 自己锁膛
      d.gotoWave(5); await run(3);
      R.mech.empKind = G.hz ? G.hz.kind : null;
      park(400, 400);
      G.enemies.length = 0;
      spawnEnemy('seeker', 520, 400);
      G.ebullets.length = 0;
      for (let i = 0; i < 6; i++) d.ebullet(560, 300 + i * 12, Math.PI, 200, 4, '#ff3355');
      G.heat = 0;
      R.mech.preEB = G.ebullets.length;
      G.hz.next = 0.01;                 // 逼它立刻脉冲
      // ⚠️ 这几帧**不能清场**：clearSoft 会把敌人和敌弹一起清掉，
      //    结果「清弹 6→0」和「敌人被定住」全是清场的功劳，脉冲根本没被验证。
      for (let i = 0; i < 4; i++) { keepWave(); G.hitstop = 0; await frame(); }
      R.mech.postEB = G.ebullets.length;
      R.mech.root = G.enemies.length ? +(G.enemies[0].root || 0).toFixed(2) : -1;
      R.mech.heat = Math.round(G.heat);
      R.mech.empOk = R.mech.preEB === 6 && R.mech.postEB === 0 && R.mech.root > 0 && R.mech.heat >= 100;

      // ③ forge（熔炉，第 7 段）：喷口翻倍 + 喷完留火场
      d.gotoWave(7); await run(3);
      R.mech.forgeVent = d.ventCount();
      d.gotoWave(5); await run(3);
      R.mech.baseVent = d.ventCount();
      d.gotoWave(7); await run(3);
      R.mech.forgeKind = G.hz ? G.hz.kind : null;
      const f0 = G.fires.length;
      R.mech.ventFound = d.ventBlow();
      await run(2);
      R.mech.fireAdd = G.fires.length - f0;
      R.mech.forgeOk = R.mech.forgeKind === 'forge' && R.mech.forgeVent === R.mech.baseVent * 2 && R.mech.ventFound && R.mech.fireAdd >= 1;

      // ④ lens（奇点，第 10 段）：穿带偏折，带外不偏
      d.gotoWave(10); await run(3);
      R.mech.lensKind = G.hz ? G.hz.kind : null;
      R.mech.bandN = G.hz && G.hz.bands ? G.hz.bands.length : 0;
      const band = G.hz && G.hz.bands ? G.hz.bands[0] : null;
      let bandTurn = 0, ctrlTurn = 0;
      if (band) {
        // 在带中心、沿带方向发一发：穿过去角度必须变
        d.terrClear(); G.enemies.length = 0;
        park(band.x - Math.cos(band.a) * 40, band.y - Math.sin(band.a) * 40);
        await run(2);
        G.bullets.length = 0;
        pBullet(band.x - Math.cos(band.a) * 20, band.y - Math.sin(band.a) * 20, band.a, 300, 10, {});
        const a0 = Math.atan2(G.bullets[0].vy, G.bullets[0].vx);
        await run(8);
        if (G.bullets.length) bandTurn = +Math.abs(Math.atan2(G.bullets[0].vy, G.bullets[0].vx) - a0).toFixed(3);
        // 对照：把带撤掉，同一发必须一点不弯
        G.hz.bands = [];
        park(band.x - Math.cos(band.a) * 40, band.y - Math.sin(band.a) * 40);
        await run(2);
        G.bullets.length = 0;
        pBullet(band.x - Math.cos(band.a) * 20, band.y - Math.sin(band.a) * 20, band.a, 300, 10, {});
        const c0 = Math.atan2(G.bullets[0].vy, G.bullets[0].vx);
        await run(8);
        if (G.bullets.length) ctrlTurn = +Math.abs(Math.atan2(G.bullets[0].vy, G.bullets[0].vx) - c0).toFixed(3);
      }
      R.mech.bandTurn = bandTurn; R.mech.ctrlTurn = ctrlTurn;
      R.mech.lensOk = R.mech.bandN === 3 && bandTurn > 0.05 && ctrlTurn < 0.001;

      // ⑤ crystal（结晶，无尽 13 段）：晶壁反弹玩家弹
      d.gotoWave(13); await run(3);
      R.mech.cryZone = d.zoneOf(13);
      R.mech.cryKind = G.hz ? G.hz.kind : null;
      const cores = G.terr.filter(b => b.kind === 'core');
      R.mech.cryBounce = cores.length ? (cores[0].bounce || 0) : 0;
      // 手动摆一面墙，从左边打它
      d.terrClear(); park(500, 500); await run(2);
      d.terrPut('core', 700, 316, 48, 96);
      // ⚠️ bounce 标记是 startHazard 时给**已有**块打的，手动摆的墙没有 ——
      //    不打就是「同一面墙在没有 bounce 的区里」，对照组就失去意义了。
      for (const b of G.terr) if (b.kind === 'core') b.bounce = 1;
      R.mech.cryWall = d.terrAt(720, 360);
      park(640, 360); await run(2);
      G.bullets.length = 0;
      pBullet(660, 360, 0, 300, 12, {});
      R.mech.cryVx0 = Math.round(G.bullets[0].vx);
      // ⚠️ 帧数要够子弹真正飞到墙上：300px/s ≈ 5px/帧，40px 的路要走 8 帧。
      //    只跑 4 帧的话子弹还在半路 —— 量出「没反弹」，其实是「还没撞上」。
      await run(14);
      R.mech.cryAlive = G.bullets.length;
      R.mech.cryVx1 = G.bullets.length ? Math.round(G.bullets[0].vx) : 0;
      R.mech.cryBnc = G.bullets.length ? (G.bullets[0].bounceN || 0) : 0;
      // 对照：换到碎屑区（没有 bounce），同一发必须被吃掉
      d.setZone(0); d.terrClear(); park(500, 500); await run(2);
      d.terrPut('core', 700, 316, 48, 96);
      park(640, 360); await run(2);
      G.bullets.length = 0;
      pBullet(660, 360, 0, 300, 12, {});
      await run(14);
      R.mech.ctrlAlive = G.bullets.length;
      R.mech.cryOk = R.mech.cryKind === 'crystal' && R.mech.cryBounce === 1 && R.mech.cryWall === 'core'
        && R.mech.cryVx0 > 0 && R.mech.cryVx1 < 0 && R.mech.cryAlive === 1 && R.mech.cryBnc === 1
        && R.mech.ctrlAlive === 0;

      // ---------- ⑤ 巨像段 / 视界段不开机制 ----------
      d.gotoWave(4); await run(3); R.bossHz = G.hz;
      d.gotoWave(6); await run(3); R.horizonHz = G.hz;
      R.noHazOk = R.bossHz === null && R.horizonHz === null;

      // ---------- ⑥ i18n ----------
      R.miss = d.i18nMissing ? d.i18nMissing() : [];
      R.errs = 0;
      resolve(R);
    } catch (e) { reject(e); }
  }));

  log('\n== 星区数据 ==');
  log(' 区数 / 机制表               : ' + R.zoneN + ' / ' + R.hazNames + '  ' + ok(R.zoneN >= 4));
  log(' 名字                       : ' + JSON.stringify(R.names));
  log(' 地形 / 机制                : ' + JSON.stringify(R.terrains) + ' / ' + JSON.stringify(R.hazs));
  log(' 三项各自唯一               : ' + ok(R.uniqueName && R.uniqueTerr && R.uniqueHaz));
  log('\n== 段 → 区 ==');
  log(' 1/3/4/6/7/9/10/12/13/14    : ' + JSON.stringify(R.map) + '  ' + ok(R.mapOk));
  log('\n== 视觉差异 ==');
  log(' 背景像素 hash（5 个须不同） : ' + JSON.stringify(R.bgHash) + '  ' + ok(R.bgOk));
  log(' 地形贴图 hash（5 个须不同） : ' + JSON.stringify(R.slabHash) + '  ' + ok(R.slabOk));
  log(' 皮肤元素数                 : ' + JSON.stringify(R.skinN));
  log('\n== 机制 ==');
  log(' ① 漂移：可动块 ' + R.mech.driftN + ' / 位移 ' + R.mech.driftMoved + 'px / 块 ' + JSON.stringify(R.mech.driftPos) + ' 世界 ' + JSON.stringify(R.mech.world) + '  ' + ok(R.mech.driftOk));
  log(' ② EMP：清弹 ' + R.mech.preEB + '→' + R.mech.postEB + ' / 定身 ' + R.mech.root + ' / 热量 ' + R.mech.heat + '  ' + ok(R.mech.empOk));
  log(' ③ 熔炉：喷口 ' + R.mech.baseVent + '→' + R.mech.forgeVent + ' / 喷发留火场 +' + R.mech.fireAdd + '  ' + ok(R.mech.forgeOk));
  log(' ④ 折射：带 ' + R.mech.bandN + ' 条 / 带内偏折 ' + R.mech.bandTurn + ' / 带外对照 ' + R.mech.ctrlTurn + '  ' + ok(R.mech.lensOk));
  log(' ⑤ 晶壁：bounce=' + R.mech.cryBounce + ' / vx ' + R.mech.cryVx0 + '→' + R.mech.cryVx1 + ' / 存活 ' + R.mech.cryAlive + ' 弹次 ' + R.mech.cryBnc + ' / 对照存活 ' + R.mech.ctrlAlive + '  ' + ok(R.mech.cryOk));
  log('\n== 边界 / i18n / 错误 ==');
  log(' 巨像段 / 视界段不开机制     : ' + ok(R.noHazOk));
  log(' zh-en 缺键                 : ' + (R.miss.length ? JSON.stringify(R.miss) : '无') + '  ' + ok(!R.miss.length));
  log(' JS 错误                    : ' + (errs.length ? errs.join(' | ') : '无') + '  ' + ok(!errs.length));

  const fails = [];
  if (!R.uniqueName || !R.uniqueTerr || !R.uniqueHaz) fails.push('唯一性');
  if (!R.mapOk) fails.push('段→区');
  if (!R.bgOk) fails.push('背景差异');
  if (!R.slabOk) fails.push('贴图差异');
  if (!R.mech.driftOk) fails.push('drift');
  if (!R.mech.empOk) fails.push('emp');
  if (!R.mech.forgeOk) fails.push('forge');
  if (!R.mech.lensOk) fails.push('lens');
  if (!R.mech.cryOk) fails.push('crystal');
  if (!R.noHazOk) fails.push('boss/horizon 关机制');
  if (R.miss.length) fails.push('i18n');
  if (errs.length) fails.push('JS错误');

  await browser.close();
  server.close();
  log('\n' + (fails.length ? '失败：' + fails.join(' / ') : '全部通过'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
