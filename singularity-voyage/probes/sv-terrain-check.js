// singularity-voyage 验证：**可躲闪的静态地形**（2026-10-21）
//   ① 每段按编排铺地形（1/2 空域 · 巨像段空域 · 无尽轮换）
//   ② **无封闭区域**（flood fill）—— 这条破了就是「清剿段永远打不完」
//   ③ 玩家被挡（贴着墙停住，不是穿过去）   ④ 敌弹被掩体吃掉（对照：没墙会掉血）
//   ⑤ 可破坏岩掉血 / 打碎后真的不挡了      ⑥ 骨架墙打不碎
//   ⑦ 喷口周期喷发并伤害玩家               ⑧ 巨像碾碎可破坏岩
//   ⑨ 掉落在墙里会被推出                   ⑩ i18n / 零错误
//
// ⚠️ **不开 ?god**：hurtPlayer 在 god 模式下首行 return，
//    开了就测不到「敌弹被挡住所以没掉血」和「喷口会掉血」这两个真值。
//    全程靠 clearField 清场保命，不靠无敌。
// 自包含：自己起静态服务，跑完收尾。
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const CHROME = require('./probe-lib').chrome;
const ROOT = path.resolve(__dirname, '..');
const PORT = 8636;
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
      /* ⚠️⚠️ 最容易踩的一坑：清场不能把 spawnQueue 清空。
         清剿形态的完成条件是「队列空 + 场上无敌人」→ 这两条一满足就 finishWave
         → 1.8 秒后 startWave → **buildTerrain 把探针刚铺好的地形整表换掉**。
         表现是「前面几条用例好好的，到后面地形突然没了」，而且一行报错都没有。
         所以清场时**往回补队列**，让这一段永远刷不完。 */
      const keepWave = () => {
        while (G.spawnQueue.length < 3) G.spawnQueue.push('seeker');
      };
      // 每帧清场：不开 god，只能靠「场上没有能打我的东西」保命
      const clearField = () => {
        G.enemies.length = 0; G.ebullets.length = 0; G.pickups.length = 0;
        G.boss = null; G.bossPending = null; keepWave();
      };
      // ⚠️ 测弹道的用例**不能**用 clearField：它每帧把 G.ebullets 清空，
      //    结果就是「弹一出生就被自己擦掉」→ 量出「没掉血 + 剩 0 发」，看着像掩体生效了，
      //    其实是弹根本没飞（对照用例因此恒 0，整组断言全部假绿）。
      const clearSoft = keepBoss => {
        G.enemies.length = 0; G.pickups.length = 0; keepWave();
        if (!keepBoss) { G.boss = null; G.bossPending = null; }
      };
      const park = (x, y) => { d.setPos(x, y); G.vx = 0; G.vy = 0; };
      const run = async n => { for (let i = 0; i < n; i++) { clearField(); G.hitstop = 0; await frame(); } };
      const runSoft = async (n, keepBoss) => { for (let i = 0; i < n; i++) { clearSoft(keepBoss); G.hitstop = 0; await frame(); } };
      // ⚠️ 巨像是**待在 G.enemies 里**被 updateBoss 驱动的（和杂兵同一条循环）。
      //    所以测碾碎时**连敌人都不能清** —— 清了就没有人跑 updateBoss，
      //    表现为「G.boss 还在、但石头纹丝不动」（早期版本这样测出恒 false）。
      const runBoss = async n => { for (let i = 0; i < n; i++) { G.pickups.length = 0; keepWave(); G.hitstop = 0; await frame(); } };

      // ---------- ① 编排 ----------
      R.plan = {};
      for (const w of [1, 2, 3, 5, 6, 7, 9, 10, 11]) {
        d.gotoWave(w);
        await run(3);
        R.plan[w] = G.layout;
      }
      R.bossOpen = [];
      for (const w of [4, 8, 12]) {
        d.gotoWave(w);
        await run(3);
        R.bossOpen.push(G.layout);
      }
      // ⚠️ 无尽里每 4 段来一只巨像（16 段就是），巨像段一样走空域 ——
      //    所以取样的段号要**避开**那些，否则会随机采到一个 'open' 然后误判成编排错了。
      R.endless = [];
      for (const w of [13, 14, 15, 17, 18]) {
        d.gotoWave(w);
        await run(3);
        R.endless.push(G.layout);
      }
      d.gotoWave(16); await run(3);
      R.endlessBoss = G.layout;
      /* ⚠️⚠️ 后面所有用例都是「手工摆一块，然后打它」—— 必须先把航程钉在
         一个**永远完不成**的段上（第 1 段清剿 + 队列常驻）。
         否则 waveState 一旦落进 'boss' 或 'warp'，两秒一次的 startWave 会把
         buildTerrain 跑一遍、整表换掉探针刚摆的地形：症状是 G.terr.length
         突然变成 30+，断言随机失败，而控制台一行报错都没有。 */
      d.gotoWave(1); await run(2);
      R.planOk = R.plan[1] === 'open' && R.plan[2] === 'open' && R.plan[3] === 'pillars'
        && R.plan[5] === 'maze' && R.plan[7] === 'cells' && R.plan[9] === 'cross'
        && R.plan[10] === 'ring' && R.plan[11] === 'maze';
      R.bossOpenOk = R.bossOpen.every(v => v === 'open');
      R.endlessOk = new Set(R.endless).size >= 3 && R.endless.every(v => v !== 'open')
        && R.endlessBoss === 'open';

      // ---------- ② 块数 + 玩家脚边留空 + 无封闭区域 ----------
      // ⚠️ 这条是整套地形里**最重要**的断言：清剿 / 死斗是「杀光才过段」，
      //    只要有一块地把某只怪关起来，玩家既看不见也打不到 → 整段永远结束不了。
      const flood = () => {
        const [WW, HH] = d.world;
        const s = 12, cols = Math.floor(WW / s), rows = Math.floor(HH / s);
        const blocked = new Uint8Array(cols * rows);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          if (d.terrAt(i * s + s / 2, j * s + s / 2)) blocked[j * cols + i] = 1;
        }
        let si = Math.floor(G.px / s), sj = Math.floor(G.py / s);
        si = Math.max(0, Math.min(cols - 1, si)); sj = Math.max(0, Math.min(rows - 1, sj));
        if (blocked[sj * cols + si]) {           // 玩家恰好压在块上（不该发生，兜底找个空格）
          let found = -1;
          for (let k = 0; k < cols * rows && found < 0; k++) if (!blocked[k]) found = k;
          if (found < 0) return { open: 0, reach: 0 };
          si = found % cols; sj = (found / cols) | 0;
        }
        const seen = new Uint8Array(cols * rows);
        const q = [sj * cols + si]; seen[sj * cols + si] = 1;
        let reach = 0;
        while (q.length) {
          const c = q.pop(); reach++;
          const ci = c % cols, cj = (c / cols) | 0;
          const nb = [[ci - 1, cj], [ci + 1, cj], [ci, cj - 1], [ci, cj + 1]];
          for (const [ni, nj] of nb) {
            if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
            const k = nj * cols + ni;
            if (seen[k] || blocked[k]) continue;
            seen[k] = 1; q.push(k);
          }
        }
        let open = 0;
        for (let k = 0; k < blocked.length; k++) if (!blocked[k]) open++;
        return { open, reach };
      };

      R.connect = {};
      R.counts = {};
      R.safeDist = {};
      R.onScreen = {};
      // ⚠️ 先挪到世界一角再铺：玩家站在正中央时，cross / ring 的中央块会被
      //    「脚边 92px 留空」那条规则整块拒绝 —— 那时量到的块数是布局的残缺版。
      for (const id of ['pillars', 'maze', 'cells', 'cross', 'ring']) {
        park(160, 700); await run(1);
        d.setTerrainLayout(id);
        await run(2);
        const solid = d.terr().filter(b => b.kind !== 'vent');
        R.counts[id] = solid.length;
        // 密度 = 「玩家一屏里能看见几块」。世界是视口的 9 倍，
        //   总块数除 9 才是玩家真正感受到的数 —— 直接断言总数会自欺欺人。
        let seen = 0;
        for (const [sx, sy] of [[720, 405], [420, 250], [1050, 560]]) {
          park(sx, sy); await run(1);
          const [l, t, r, b] = d.viewRect;
          seen += solid.filter(o => o.x < r && o.x + o.w > l && o.y < b && o.y + o.h > t).length;
        }
        R.onScreen[id] = +(seen / 3).toFixed(1);
        park(160, 700); await run(1);
        // 玩家脚边最近的一块有多远（必须 ≥ 92）
        let best = 1e9;
        for (const b of solid) {
          const nx = Math.max(b.x, Math.min(G.px, b.x + b.w));
          const ny = Math.max(b.y, Math.min(G.py, b.y + b.h));
          best = Math.min(best, Math.hypot(G.px - nx, G.py - ny));
        }
        R.safeDist[id] = Math.round(best);
        const f = flood();
        R.connect[id] = f.open === f.reach;
        R[id + 'Open'] = f.open;
      }
      R.connectOk = Object.keys(R.connect).every(k => R.connect[k]);
      R.countOk = Object.keys(R.counts).every(k => R.counts[k] >= 20 && R.counts[k] <= 64);
      R.densityOk = Object.keys(R.onScreen).every(k => R.onScreen[k] >= 2);
      R.safeOk = Object.keys(R.safeDist).every(k => R.safeDist[k] >= 92);

      // ---------- ③ 玩家被挡 ----------
      // ⚠️ terrAdd 会拒绝「离玩家 92px 内」的块，所以先把玩家挪远、摆块、再挪回来。
      d.terrClear(); park(200, 200); await run(2);
      d.terrPut('core', 700, 340, 48, 96);
      const wall = d.terr().filter(b => b.kind === 'core')[0];
      R.wallPos = wall ? [wall.x, wall.y, wall.w, wall.h] : null;
      const bx = wall.x, bh = wall.h, cy0 = wall.y + bh / 2;
      park(bx - 44, cy0); await run(2);
      for (let i = 0; i < 40; i++) { clearField(); G.hitstop = 0; G.vx = 320; G.vy = 0; await frame(); }
      R.stopX = Math.round(G.px);
      // 停在墙左侧 12px（判定半径）处：没被挡的话会一路冲到 bx + 200 开外
      R.blocked = G.px <= bx - 11 && G.px >= bx - 15;
      // 沿墙滑行：给一个纯纵向速度时 y 应该照常移动（撞墙 ≠ 撞停）
      const yBefore = G.py;
      for (let i = 0; i < 20; i++) { clearField(); G.hitstop = 0; G.vx = 320; G.vy = 200; await frame(); }
      R.slid = G.py - yBefore > 8;

      // ---------- ④ 敌弹被掩体吃掉 ----------
      // 弹从墙右侧 150px 处以 240px/s 往左飞：0.63s 撞墙、0.81s 才够到玩家。
      //   所以观察窗口必须 ≥ 50 帧 —— 开小了会出现「两边都没掉血」的假绿。
      const hp0 = G.S.hp;
      park(bx - 44, cy0); await runSoft(2);
      G.ebullets.length = 0;
      d.ebullet(bx + 150, cy0, Math.PI, 240, 4, '#ff3355');
      await runSoft(60);
      R.coverHp = +(hp0 - G.S.hp).toFixed(2);
      R.coverEbullets = G.ebullets.length;
      R.coverWorks = R.coverHp === 0 && R.coverEbullets === 0;
      // 对照：把墙撤掉，同一发弹必须打中（否则上面的「挡住了」可能是弹根本没飞）
      d.terrClear();
      const hp1 = G.S.hp;
      park(bx - 44, cy0); await runSoft(2);
      G.ebullets.length = 0;
      d.ebullet(bx + 150, cy0, Math.PI, 240, 4, '#ff3355');
      await runSoft(60);
      R.noCoverHp = +(hp1 - G.S.hp).toFixed(2);
      R.controlOk = R.noCoverHp > 0;

      // ---------- ⑤ / ⑥ 可破坏岩 vs 骨架墙 ----------
      d.terrClear(); park(200, 200); await run(2);
      d.terrPut('rock', 700, 340, 48, 48);
      const rk = d.terr().filter(b => b.kind === 'rock')[0];
      R.rockHp0 = rk.hp;
      park(rk.x - 40, rk.y + rk.h / 2); await run(2);
      G.bullets.length = 0;
      pBullet(rk.x - 26, rk.y + rk.h / 2, 0, 300, 18, {});
      await run(10);
      const rk2 = d.terr().filter(b => b.kind === 'rock')[0];
      R.rockHp1 = rk2 ? rk2.hp : 0;
      R.rockDbg = { wave: G.wave, form: G.waveForm, state: d.state, dead: G.dead,
        terrLen: G.terr.length, rk: [rk.x, rk.y, rk.w, rk.h],
        px: Math.round(G.px), py: Math.round(G.py), bullets: G.bullets.length,
        sing: !!G.sing, spd: G.S.bspd, rangeMul: G.S.rangeMul };
      R.rockHurt = !!rk2 && rk2.hp < R.rockHp0 && rk2.hp > 0;
      // 打碎：连续补弹直到消失（最多 8 发）
      let shots = 0;
      while (d.terr().some(b => b.kind === 'rock') && shots < 8) {
        G.bullets.length = 0;
        pBullet(rk.x - 26, rk.y + rk.h / 2, 0, 300, 40, {});
        await run(8); shots++;
      }
      R.rockShots = shots;
      R.rockGone = !d.terrAt(rk.x + rk.w / 2, rk.y + rk.h / 2);
      // 碎了之后真的不挡：从原位置穿过去
      park(rk.x - 40, rk.y + rk.h / 2); await run(2);
      for (let i = 0; i < 24; i++) { clearField(); G.hitstop = 0; G.vx = 320; G.vy = 0; await frame(); }
      R.passAfterBreak = G.px > rk.x + rk.w;

      d.terrClear(); park(200, 200); await run(2);
      d.terrPut('core', 700, 340, 48, 48);
      const cr = d.terr().filter(b => b.kind === 'core')[0];
      park(cr.x - 40, cr.y + cr.h / 2); await run(2);
      G.bullets.length = 0;
      for (let i = 0; i < 6; i++) { pBullet(cr.x - 26, cr.y + cr.h / 2, 0, 300, 40, {}); await run(6); }
      const cr2 = d.terr().filter(b => b.kind === 'core')[0];
      R.coreSolid = !!cr2 && !!d.terrAt(cr.x + cr.w / 2, cr.y + cr.h / 2);

      // ---------- ⑦ 喷口 ----------
      d.terrClear(); d.setTerrainLayout('pillars'); await run(2);
      const vents = G.terr.filter(b => b.kind === 'vent');
      R.ventN = vents.length;
      if (vents.length) {
        const v = vents[0];
        const hp2 = G.S.hp;
        // 直接把相位推到预警末尾：CYCLE 3.4s + WARN 1.0s 全靠跑真帧要等 4 秒多，
        //   这在探针里是白等 —— 状态机本身由 updateTerrain 推进，这里只跳过等待。
        v.ph = 1; v.t = 0.9;
        park(v.x, v.y); await run(40);
        R.ventPh = v.ph;
        R.ventDmg = +(hp2 - G.S.hp).toFixed(2);
        // 远离喷口不该掉血
        const hp3 = G.S.hp;
        park(v.x + 220, v.y); await run(40);
        R.ventSafe = +(hp3 - G.S.hp).toFixed(2);
        R.ventOk = R.ventDmg > 0 && R.ventSafe === 0;
      } else { R.ventOk = false; R.ventDmg = -1; R.ventSafe = -1; }

      // ---------- ⑧ 巨像碾碎可破坏岩 ----------
      // ⚠️ 全程用 runSoft(., true)：clearField 会把 G.boss 置空，
      //    那之后 updateBoss 根本不跑，碾碎也就无从发生（早期版本这样测出恒 false）。
      d.terrClear(); park(400, 400); await run(2);
      spawnBoss('motherrock');
      await runBoss(6);
      R.hasBoss = !!G.boss;
      if (G.boss) {
        G.boss.entering = false;      // 入场演出期间 updateBoss 早退，不结算碾碎
        const B = G.boss;
        B.x = 700; B.y = 340;
        d.terrPut('rock', 676, 316, 48, 48);
        const before = d.terr().filter(b => b.kind === 'rock').length;
        await runBoss(6);
        const after = d.terr().filter(b => b.kind === 'rock').length;
        R.crush = before === 1 && after === 0;
      } else { R.crush = false; }
      d.terrClear(); G.boss = null; G.enemies.length = 0;

      // ---------- ⑨ 掉落在墙里会被推出 ----------
      d.terrClear(); park(200, 200); await run(2);
      d.terrPut('core', 700, 340, 96, 96);
      const cb = d.terr().filter(b => b.kind === 'core')[0];
      G.pickups.length = 0;
      dropPickup('dust', cb.x + cb.w / 2, cb.y + cb.h / 2, 1);
      const pk = G.pickups[0];
      R.dropInside = !!d.terrAt(pk.x, pk.y);

      // ---------- ⑩ i18n / 性能 ----------
      R.terrKey = T('bn.terr');
      try { R.i18nMissing = d.i18nMissing ? d.i18nMissing() : 'no api'; }
      catch (err) { R.i18nMissing = 'ERR ' + err.message; }
      d.terrClear(); park(700, 400); await run(10);
      let t0 = performance.now(); await run(90);
      R.msEmpty = +((performance.now() - t0) / 90).toFixed(2);
      d.setTerrainLayout('cells'); park(700, 400); await run(10);
      t0 = performance.now(); await run(90);
      R.msTerr = +((performance.now() - t0) / 90).toFixed(2);

      resolve(R);
    } catch (err) { reject(String(err && err.stack || err)); }
  }));

  log('== 编排 ==');
  log(' 主线 1/2/3/5/6/7/9/10/11 : ' + JSON.stringify(R.plan) + '  ' + ok(R.planOk));
  log(' 巨像段 4/8/12            : ' + JSON.stringify(R.bossOpen) + '  ' + ok(R.bossOpenOk));
  log(' 无尽 13/14/15/17/18       : ' + JSON.stringify(R.endless) + '  ' + ok(R.endlessOk));
  log(' 无尽巨像段 16（应 open）  : ' + R.endlessBoss);
  log('== 生成约束 ==');
  log(' 块数（世界总 / 20~64）    : ' + JSON.stringify(R.counts) + '  ' + ok(R.countOk));
  log(' 一屏可见块数（≥2）        : ' + JSON.stringify(R.onScreen) + '  ' + ok(R.densityOk));
  log(' 玩家脚边最近块距离 (≥92)  : ' + JSON.stringify(R.safeDist) + '  ' + ok(R.safeOk));
  log(' 无封闭区域（flood fill）  : ' + JSON.stringify(R.connect) + '  ' + ok(R.connectOk));
  log('== 阻挡 ==');
  log(' 墙位置 / 玩家停在 x        : ' + JSON.stringify(R.wallPos) + ' / ' + R.stopX + '  ' + ok(R.blocked));
  log(' 撞墙不停（沿墙滑行）      : ' + ok(R.slid));
  log(' 敌弹被掩体吃掉 / 剩弹     : ' + R.coverHp + ' / ' + R.coverEbullets + '  ' + ok(R.coverWorks));
  log(' 对照：撤掉墙会掉血        : ' + R.noCoverHp + '  ' + ok(R.controlOk));
  log('== 破坏 ==');
  log(' 岩块 hp ' + R.rockHp0 + ' → ' + R.rockHp1 + ' / 用了 ' + R.rockShots + ' 发  ' + ok(R.rockHurt));
  if (!R.rockHurt) log('    ↳ dbg ' + JSON.stringify(R.rockDbg));
  log(' 打碎后不挡 / 能穿过去     : ' + ok(R.rockGone) + ' / ' + ok(R.passAfterBreak));
  log(' 骨架墙打不碎              : ' + ok(R.coreSolid));
  log('== 喷口 / 巨像 ==');
  log(' 喷口数量 / 相位            : ' + R.ventN + ' / ' + R.ventPh);
  log(' 喷口内掉血 / 喷口外不掉   : ' + R.ventDmg + ' / ' + R.ventSafe + '  ' + ok(R.ventOk));
  log(' 巨像在场 / 碾碎可破坏岩   : ' + ok(R.hasBoss) + ' / ' + ok(R.crush));
  log(' 掉落落在墙里（应为 false）: ' + R.dropInside + '  ' + ok(R.dropInside === false));
  log('== 开销 / i18n / 错误 ==');
  log(' 每帧 ms 无地形 / 有地形   : ' + R.msEmpty + ' / ' + R.msTerr + '  ' + ok(R.msTerr < R.msEmpty + 3));
  log(' 键 bn.terr                : ' + R.terrKey);
  log(' zh-en 缺键                : ' + R.i18nMissing);
  log(' JS 错误                   : ' + (errs.length ? '❌\n' + errs.join('\n') : '无'));

  const fails = [];
  if (!R.planOk) fails.push('plan');
  if (!R.bossOpenOk) fails.push('bossOpen');
  if (!R.endlessOk) fails.push('endless');
  if (!R.countOk) fails.push('counts');
  if (!R.densityOk) fails.push('density');
  if (!R.safeOk) fails.push('safeDist');
  if (!R.connectOk) fails.push('connectivity');
  if (!R.blocked) fails.push('blocked');
  if (!R.slid) fails.push('slide');
  if (!R.coverWorks) fails.push('cover');
  if (!R.controlOk) fails.push('coverControl');
  if (!R.rockHurt) fails.push('rockHurt');
  if (!R.rockGone) fails.push('rockGone');
  if (!R.passAfterBreak) fails.push('passAfterBreak');
  if (!R.coreSolid) fails.push('coreSolid');
  if (!R.ventOk) fails.push('vent');
  if (!R.crush) fails.push('crush');
  if (R.dropInside !== false) fails.push('dropInside');
  if (R.msTerr >= R.msEmpty + 3) fails.push('perf');
  if (errs.length) fails.push('jsErrors');
  if (R.i18nMissing !== 'no api' && R.i18nMissing && R.i18nMissing !== '无' && !/^\[\]$/.test(String(R.i18nMissing))) {
    // i18nMissing 返回缺键数组，空数组 = 通过
    if (Array.isArray(R.i18nMissing) && R.i18nMissing.length) fails.push('i18n');
  }

  await browser.close(); server.close();
  if (fails.length) { console.log('\n❌ 失败项：' + fails.join(', ')); process.exit(1); }
  console.log('\n全部通过');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
