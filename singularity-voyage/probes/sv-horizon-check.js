// singularity-voyage 验证：「视界 / EVENT HORIZON」形态（2026-10-20，第 6 段专属）
//   ① 第 6 段 = horizon，奇点生成      ② 玩家 / 敌人 / 掉落都被吸
//   ③ **子弹被引力弯曲**（含「没奇点就不弯」的对照）  ④ 吞噬 = 不掉落 + 喂大视界
//   ⑤ 视界灼烧   ⑥ 加压三档   ⑦ 完成条件   ⑧ 非视界段不残留   ⑨ i18n / 零错误
// 自包含：自己起静态服务，跑完收尾
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 8633;
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

  await page.goto(BASE + '?god=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state !== 'loading', { timeout: 20000 });
  await page.evaluate(() => { startGame(); });
  await page.waitForFunction(() => window.__dbg.state === 'play', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));

  const res = await page.evaluate(() => new Promise(async (resolve, reject) => {
    try {
      const d = window.__dbg, G = d.G;
      const frame = () => new Promise(r => requestAnimationFrame(r));
      const R = {};

      // 进第 6 段
      const enter6 = async () => {
        d.clearEnemies(); G.spawnQueue.length = 0; G.boss = null; G.bossPending = null;
        G.pickups.length = 0; G.ebullets.length = 0; G.bullets.length = 0; G.parts.length = 0;
        d.setPos(900, 900); G.vx = 0; G.vy = 0;
        startWave(6);
        for (let i = 0; i < 12; i++) { G.hitstop = 0; await frame(); }
        return G.sing;
      };

      // ---------- ① 编排 ----------
      R.form6 = (typeof formForWave === 'function') ? formForWave(6) : 'no api';
      let s = await enter6();
      R.waveForm = G.waveForm;
      R.singExists = !!s;
      R.singR = s ? +s.r.toFixed(1) : -1;
      R.waveDur = +G.waveDur.toFixed(1);
      R.queued = G.spawnQueue.length;
      // 其它段不能是 horizon（第 6 段要独一份）
      R.otherForms = [1, 2, 3, 5, 7, 9, 10, 11].map(w => formForWave(w)).join(',');
      R.onlySix = ![1, 2, 3, 5, 7, 9, 10, 11].some(w => formForWave(w) === 'horizon');

      // ---------- ② 子弹弯曲（核心）----------
      // 弹从奇点上方 120px 处水平飞过：不受力时 y 完全不变，受力则被往下拽（朝奇点）。
      // ⚠️ 三个干扰必须全部排除，否则测出来的是「子弹没了」而不是「子弹没弯」：
      //   ① spawnQueue 一直在出怪，弹会被敌人吃掉 → 每帧前清场
      //   ② 奇点在公转（绕玩家），不冻结的话起终点都对不上 → 每帧钉死坐标
      //   ③ 玩家自己会被吸向奇点，站错位置会被自己的测试弹 / 敌弹命中 → 放到弹道外
      // ⚠️ 坐标必须让「奇点 + 整条弹道 + 玩家」都落在**视口内**：
      //    敌弹是按视口外扩 80 回收的，弹道一出画就被静默删掉，
      //    量出来就是 dx=0 dy=0（看着像「引力没生效」，其实是弹没了）。
      //    布局：玩家 (900,900) → 视口 y 640..1160；奇点钉在玩家正上方 190（= ORBIT）
      //    → 弹道取奇点下方 60px（y=770），水平飞，离玩家 130px 不会被自己命中。
      const PX = 900, PY = 900, FX = PX, FY = PY - 190, LANE = FY + 60;
      // ⚠️ 不能用 d.clearEnemies()：它内部**连 G.ebullets 一起清**，
      //    在测敌弹弯曲的循环里每帧调一次 = 自己把待测的弹擦掉（量出来 dx=0 dy=0）。
      // ⚠️ 必须支持 keeper：吞噬用例要「清掉干扰怪，但留下待测的那一只」。
      //    早期版本无差别清场，结果待测敌人被自己清掉 ——
      //    `G.enemies.indexOf(e) < 0` 成立但 hp 满血，测出「吞噬成功、击杀不计数、视界没长大」
      //    三个假结果，而真相是 devourEnemy 根本没被调用过。
      // ⚠️ `keepDrops` 同理：吞噬用例要断言「被吞的不掉星尘」，
      //    每帧把 pickups 清空的话这个断言恒真，等于没测。
      // ⚠️ 必须**原地剔除**而不是 `length = 0` 再 push 回来：
      //    重建数组后，帧内拿到的实体虽然还是同一个对象引用，
      //    但敌人更新走的是带索引的遍历，重建过的数组会让本帧的写入落到别处，
      //    表现为「e.y 帧前帧后一模一样」—— 拖拽和吞噬都像没生效，且随机成败。
      const clearField = (keeper, keepDrops) => {
        for (let i = G.enemies.length - 1; i >= 0; i--) {
          if (G.enemies[i] !== keeper) G.enemies.splice(i, 1);
        }
        G.spawnQueue.length = 0;
        if (!keepDrops) G.pickups.length = 0;
      };
      const pinSing = () => { if (G.sing) { G.sing.x = FX; G.sing.y = FY; } };
      const parkPlayer = () => { d.setPos(PX, PY); G.vx = 0; G.vy = 0; };

      const shot = async (useSing) => {
        clearField(); G.bullets.length = 0;
        parkPlayer(); pinSing();
        pBullet(FX - 300, LANE, 0, 320, 10, {});
        const b = G.bullets[0];
        if (!b) return null;
        const y0 = b.y, x0 = b.x, sp0 = Math.hypot(b.vx, b.vy);
        const keep = G.sing;
        if (!useSing) G.sing = null;                 // 对照组：临时摘掉奇点
        for (let i = 0; i < 26; i++) {
          clearField(); pinSing(); G.hitstop = 0; await frame();
          if (G.bullets.indexOf(b) < 0) break;
        }
        if (!useSing) G.sing = keep;
        return { dy: +(b.y - y0).toFixed(1), dx: +(b.x - x0).toFixed(1),
                 alive: G.bullets.indexOf(b) >= 0,
                 spDrift: +Math.abs(Math.hypot(b.vx, b.vy) - sp0).toFixed(1) };
      };
      R.bend = await shot(true);
      R.bendOff = await shot(false);                 // 对照：没有奇点必须不弯

      // 敌弹也弯（系数小一半，所以阈值小一些）
      clearField(); G.ebullets.length = 0;
      parkPlayer(); pinSing();
      eShot(FX - 280, LANE, 0, 118, 3, '#ff3355');
      const eb = G.ebullets[0];
      const ey0 = eb.y, ex0 = eb.x;
      for (let i = 0; i < 22; i++) {
        clearField(); pinSing(); G.hitstop = 0; await frame();
        if (G.ebullets.indexOf(eb) < 0) break;
      }
      R.ebend = +(eb.y - ey0).toFixed(1);
      R.ebdx = +(eb.x - ex0).toFixed(1);

      // ---------- ③ 玩家被吸（位移式：站着不动也会被拖走）----------
      d.setPos(G.sing.x + 230, G.sing.y);
      G.vx = 0; G.vy = 0;
      const px0 = G.px;
      for (let i = 0; i < 40; i++) { G.hitstop = 0; await frame(); }
      R.playerPull = +(G.px - px0).toFixed(1);        // 负 = 被拉向奇点（奇点在左）

      // ---------- ④ 吞噬：不掉落 + 喂大视界 ----------
      // ⚠️ 测试目标必须用 **bastion**（站着不动的炮台）：tadpole 一出生就朝玩家跑，
      //    0.5 秒能跑出 100px，用它测的是「它跑得快不快」，不是「它会不会被吞」。
      s = await enter6();
      clearField();
      const e = d.spawn('bastion', G.sing.x + 2, G.sing.y + 2);
      const r0 = G.sing.r, dust0 = G.pickups.filter(p => p.type === 'dust').length;
      const kills0 = G.kills;
      // ⚠️ 每帧把测试目标钉回奇点旁 10px：bastion 确实站着不动，但**奇点自己在公转**
      //    （绕玩家 42px/s + 跟随），30 帧能飘出 220px。不钉住的话测的是「谁跑得快」。
      //    钉在 r 内（10 < 30）是合法的「落入视界」，判定的就是这条路径。
      for (let i = 0; i < 30 && G.enemies.indexOf(e) >= 0; i++) {
        e.x = G.sing.x + 10; e.y = G.sing.y + 10;
        clearField(e, true); G.hitstop = 0; await frame();
      }
      R.devoured = G.enemies.indexOf(e) < 0;
      R.devourDbg = { singExists: !!G.sing, ex: Math.round(e.x), ey: Math.round(e.y),
                      sx: Math.round(G.sing.x), sy: Math.round(G.sing.y), sr: +G.sing.r.toFixed(1),
                      d: +Math.hypot(e.x - G.sing.x, e.y - G.sing.y).toFixed(1),
                      ehp: Math.round(e.hp), alive: G.enemies.indexOf(e) >= 0 };
      R.devourKills = G.kills - kills0;
      R.devourNoDrop = G.pickups.filter(p => p.type === 'dust').length === dust0;
      R.fedGrew = +(G.sing.r - r0).toFixed(2);
      R.fedCap = +G.sing.r.toFixed(1);

      // 喂到上限后不再长（RMAX 必须存在，否则能喂成铺满屏幕）
      s = await enter6(); clearField();
      for (let k = 0; k < 40; k++) {
        const z = d.spawn('bastion', G.sing.x + 2, G.sing.y + 2);
        for (let i = 0; i < 14 && G.enemies.indexOf(z) >= 0; i++) {
          z.x = G.sing.x + 10; z.y = G.sing.y + 10;
          clearField(z); G.hitstop = 0; await frame();
        }
      }
      R.rMax = +G.sing.r.toFixed(1);

      // ---------- ⑤ 视界灼烧 ----------
      // ⚠️ 每帧必须 clearField()：spawnQueue 一直在出怪，不清的话掉血是**敌人打的**，
      //    测出来「视界外也掉血」，结论整个反了。
      s = await enter6(); clearField();
      G.S.hp = G.S.maxHp;
      const hp0 = G.S.hp;
      for (let i = 0; i < 70; i++) {
        clearField(); G.px = G.sing.x; G.py = G.sing.y; G.hitstop = 0; await frame();
        if (G.dead) break;
      }
      R.burn = +(hp0 - G.S.hp).toFixed(1);
      R.burnAlive = !G.dead;
      // 站在视界外不掉血
      s = await enter6(); clearField();
      G.S.hp = G.S.maxHp;
      const hp1 = G.S.hp;
      for (let i = 0; i < 70; i++) {
        clearField(); G.px = G.sing.x + 300; G.py = G.sing.y + 300; G.hitstop = 0; await frame();
      }
      R.safeOutside = Math.abs(G.S.hp - hp1) < 0.01;

      // ---------- ⑥ 加压三档 ----------
      s = await enter6();
      R.tiers = [];
      for (const frac of [0.05, 0.45, 0.9]) {
        G.waveT = G.waveDur * frac;
        for (let i = 0; i < 3; i++) { G.hitstop = 0; await frame(); }
        R.tiers.push({ tier: G.sing.tier, mul: +G.sing.mul.toFixed(2) });
      }
      R.tierUp = R.tiers[0].tier === 0 && R.tiers[1].tier === 1 && R.tiers[2].tier === 2
              && R.tiers[0].mul < R.tiers[1].mul && R.tiers[1].mul < R.tiers[2].mul;

      // ---------- ⑦ 完成条件 ----------
      s = await enter6();
      G.waveT = G.waveDur + 1;
      for (let i = 0; i < 6; i++) { G.hitstop = 0; await frame(); }
      R.finished = G.waveState === 'warp';

      // ---------- ⑧ 非视界段不残留 ----------
      startWave(5);
      for (let i = 0; i < 8; i++) { G.hitstop = 0; await frame(); }
      R.cleanAfter5 = G.sing === null && G.waveForm === 'purge';
      startWave(4);                                     // Boss 段也不能留着奇点
      for (let i = 0; i < 8; i++) { G.hitstop = 0; await frame(); }
      R.cleanAfterBoss = G.sing === null;

      // ---------- ⑨ 掉落被吸 ----------
      // ⚠️ 必须先关掉玩家的磁力线圈：不关的话磁力把星尘往**玩家**那边拉，
      //    而玩家又站在奇点外侧 → 量出来「星尘离奇点越来越远」，结论整个反了。
      s = await enter6(); clearField();
      G.S.magnet = 0; G.S.autoPull = false;
      parkPlayer();
      pinSing();
      dropPickup('dust', FX + 150, FY + 40, 1);
      const p1 = G.pickups[G.pickups.length - 1];
      const pd0 = Math.hypot(p1.x - G.sing.x, p1.y - G.sing.y);
      let swallowed = false;
      for (let i = 0; i < 40 && G.pickups.indexOf(p1) >= 0; i++) {
        clearField(); pinSing(); G.hitstop = 0; await frame();
      }
      swallowed = G.pickups.indexOf(p1) < 0;
      R.dustDrift = swallowed
        ? '被吞'
        : +((pd0 - Math.hypot(p1.x - G.sing.x, p1.y - G.sing.y))).toFixed(1);

      // ---------- ⑩ i18n ----------
      R.hud = T('hud.horizon', 12);
      R.hudEn = (() => { const was = isEn(); return T('hud.horizon', 12); })();
      try { R.i18nMissing = d.i18nMissing ? d.i18nMissing() : 'no api'; }
      catch (err) { R.i18nMissing = 'ERR ' + err.message; }
      R.formName = L(FORMS.horizon, 'name');

      resolve(R);
    } catch (err) { reject(String(err && err.stack || err)); }
  }));

  log('== 编排 ==');
  log(' 第 6 段形态 / 奇点生成    : ' + res.waveForm + ' / ' + ok(res.singExists));
  log(' 仅第 6 段 / 其它段        : ' + ok(res.onlySix) + '  ' + res.otherForms);
  log(' 视界初始 r / 时长 / 队列  : ' + res.singR + ' / ' + res.waveDur + 's / ' + res.queued);
  log(' 形态名                    : ' + res.formName + '   HUD: ' + res.hud);
  log('== 子弹弯曲（核心）==');
  log(' 玩家弹偏移 dy / dx        : ' + res.bend.dy + ' / ' + res.bend.dx + '  ' + ok(Math.abs(res.bend.dy) > 12 && res.bend.dx > 100));
  log(' 速率不变（纯转向）        : ' + res.bend.spDrift + '  ' + ok(res.bend.spDrift < 1));
  log(' 对照：无奇点 dy           : ' + res.bendOff.dy + '  ' + ok(Math.abs(res.bendOff.dy) < 1));
  log(' 敌弹偏移 dy / dx（约一半）: ' + res.ebend + ' / ' + res.ebdx + '  ' + ok(Math.abs(res.ebend) > 2 && res.ebdx > 30));
  log('== 吸引 / 吞噬 ==');
  log(' 玩家被吸位移（负=拉向）   : ' + res.playerPull + '  ' + ok(res.playerPull < -8));
  log(' 吞噬 / 计入击杀 / 不掉落  : ' + ok(res.devoured) + ' / ' + ok(res.devourKills === 1) + ' / ' + ok(res.devourNoDrop) + '  ' + JSON.stringify(res.devourDbg));
  log(' 喂大视界 Δr / 喂满上限    : ' + res.fedGrew + ' / ' + res.rMax + '  ' + ok(res.fedGrew > 1 && res.rMax <= 53));
  log(' 星尘被吸（负=靠近;吞=被吞）: ' + res.dustDrift + '  ' + ok(res.dustDrift === '被吞' || res.dustDrift > 8));
  log('== 危险 / 节奏 ==');
  log(' 视界内灼烧 / 没被秒       : ' + res.burn + '  ' + ok(res.burn > 0 && res.burnAlive));
  log(' 视界外安全                : ' + ok(res.safeOutside));
  log(' 加压三档                  : ' + JSON.stringify(res.tiers) + '  ' + ok(res.tierUp));
  log(' 到时过段                  : ' + ok(res.finished));
  log(' 第5段/Boss段不残留奇点    : ' + ok(res.cleanAfter5) + ' / ' + ok(res.cleanAfterBoss));
  log('== i18n / 错误 ==');
  log(' zh-en 缺键                : ' + res.i18nMissing);
  log(' JS 错误                   : ' + (errs.length ? '❌\n' + errs.join('\n') : '无'));

  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
