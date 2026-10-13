// singularity-voyage 验证：巨像**三形态系统**（2026-10-11）
//   ① 八只巨像各三形态，血线到了就切    ② 第三形态**换模型**（spr → spr_x）
//   ③ 切形态同时清屏敌弹 + 演出          ④ 形态专属改动（炮塔/幻影/易伤/反极/漏虫/熄灭）
//   ⑤ 新弹幕 blackout / crossLaser / homing
// 运行： python -m http.server 8612 之后 node probes/sv-boss3-check.js
// 自包含：自己起静态服务（不依赖外部 http server），跑完收尾
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 8624;
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
      // ⚠️ BOSSES 是脚本级 const，走 __dbg 的只读口更稳（和老探针同一条经验）
      const TBL = d.bossTable(), ids = d.bossIds();

      const bring = async (id) => {
        d.clearEnemies(); G.spawnQueue.length = 0; G.boss = null; G.bossPending = null;
        G.phantoms.length = 0; G.blackout = 0; G.ebullets.length = 0; G.fx.length = 0;
        d.setPos(600, 400); G.vx = 0; G.vy = 0;
        spawnBoss(id);
        const e = G.boss;
        // ⚠️ 入场要 2.55 秒（y 从 viewT()-40 走到 viewT()+62，40px/s）≈ 150 帧。
        //    只等 40 帧的话 e.entering 还是 true，updateBoss 第一行就 return
        //    → 后面所有形态断言全假失败（形态没推进，看起来像逻辑坏了）。
        //    每帧还要清 hitstop：演出里带的顿帧会把入场计时一起冻住。
        for (let i = 0; i < 260 && e && e.entering; i++) { G.hitstop = 0; await frame(); }
        return e;
      };
      // 直接改 hp 触发形态推进 —— 我们要测的是「推进」这件事本身，不是伤害计算
      const toPct = async (e, p) => { e.hp = e.maxHp * p; await frame(); await frame(); };
      // ⚠️ 切形态有 1.1s 过渡（cmpT），期间 updateBoss 直接 return、不施加 aura。
      //    要测形态的场地效果，必须先把这段演完，否则测到的是「还没生效」。
      const settle = async (e) => {
        for (let i = 0; i < 160 && e && (e.cmpT || 0) > 0; i++) { G.hitstop = 0; await frame(); }
      };

      // ---------- ① 形态表 ----------
      R.ids = ids.slice();
      R.forms = {};
      for (const id of ids) R.forms[id] = (TBL[id].forms || []).map(x => ({ p: x.p, n: x.pats.length, cd: x.cd, spd: x.spd, x: !!x.x }));
      R.allThree = ids.every(id => (TBL[id].forms || []).length === 3);
      R.allXonLast = ids.every(id => !!(TBL[id].forms[2] || {}).x);
      R.monotonic = {}; R.patsDiffer = {};
      for (const id of ids) {
        const a = TBL[id].forms;
        R.monotonic[id] = a[0].cd >= a[1].cd && a[1].cd >= a[2].cd && a[0].spd <= a[1].spd && a[1].spd <= a[2].spd;
        R.patsDiffer[id] = new Set(a.map(f => f.pats.join(','))).size >= 2;
      }

      // ---------- ② 逐只实测：切到第三形态 ----------
      R.shift = {};
      for (const id of ids) {
        const e = await bring(id);
        if (!e) { R.shift[id] = 'NO BOSS'; continue; }
        const spr0 = e.spr;
        for (let i = 0; i < 12; i++) d.ebullet(600 + i * 9, 300, 1.2, 40, 4);
        const eb0 = G.ebullets.length;
        await toPct(e, 0.20);
        R.shift[id] = {
          spr0, spr2: e.spr, form: e.form, isX: e.spr === spr0 + '_x',
          ebBefore: eb0, ebAfter: G.ebullets.length, vuln: +(e.vuln || 1).toFixed(2),
        };
      }

      // ---------- ③ 形态专属改动 ----------
      let e = await bring('warden'); await toPct(e, 0.20);
      R.turrets = G.enemies.filter(x => x.turret).length;
      R.turretKillable = R.turrets > 0 && (() => {
        const t = G.enemies.find(x => x.turret);
        const h0 = t.hp; d.hit(t, 30, 1, 0); return t.hp < h0;
      })();

      e = await bring('prism'); await toPct(e, 0.20);
      R.phantoms = G.phantoms.length;
      R.phantomNotEnemy = G.enemies.filter(x => x.boss === 'prism').length === 1 && G.phantoms.length === 2;
      R.phantomFires = await (async () => {
        const n0 = G.ebullets.length;
        for (let i = 0; i < 160 && G.ebullets.length === n0; i++) { G.hitstop = 0; await frame(); }
        return G.ebullets.length > n0;
      })();

      e = await bring('motherrock'); await toPct(e, 0.20);
      R.vuln = +(e.vuln || 1).toFixed(2);
      R.vulnApplied = (() => {
        e.hp = e.maxHp * 0.20; e.vuln = 1;
        const h0 = e.hp; d.hit(e, 100, 1, 0); const plain = h0 - e.hp;
        e.hp = e.maxHp * 0.20; e.vuln = 1.35;
        const h1 = e.hp; d.hit(e, 100, 1, 0); const vuln = h1 - e.hp;
        e.vuln = 1.35;
        return { plain: +plain.toFixed(1), vuln: +vuln.toFixed(1) };
      })();

      R.pushAway = await (async () => {
        const b = await bring('tempest');
        await toPct(b, 0.20); await settle(b);
        const x0 = G.px;
        for (let i = 0; i < 40; i++) { b.x = G.px + 200; b.y = G.py; G.hitstop = 0; await frame(); }
        return +(G.px - x0).toFixed(1);          // 负 = 被推离（远离 boss）
      })();

      e = await bring('hive'); await toPct(e, 0.20);
      const en0 = G.enemies.length;
      R.leaks = await (async () => {
        for (let i = 0; i < 260 && G.enemies.length <= en0; i++) { G.hitstop = 0; await frame(); }
        return G.enemies.length - en0;
      })();

      // ---------- ④ 星蚀：熄灭战场 ----------
      e = await bring('eclipse');
      R.eclipseSpr = e.spr;
      R.blackout = await (async () => {
        for (let i = 0; i < 500 && G.blackout <= 0; i++) { G.hitstop = 0; await frame(); }
        return +G.blackout.toFixed(2);
      })();
      R.blackoutPeak = +Math.max(G.blackout, 0).toFixed(2);
      R.blackoutEnds = await (async () => {
        for (let i = 0; i < 500 && G.blackout > 0; i++) { G.hitstop = 0; await frame(); }
        return G.blackout === 0;
      })();

      // ---------- ⑥ 新弹幕 ----------
      e = await bring('warden'); await toPct(e, 0.20);
      R.cross = await (async () => {
        G.fx.length = 0;
        for (let i = 0; i < 600 && !G.fx.some(f => f.type === 'laser'); i++) { G.hitstop = 0; await frame(); }
        const L = G.fx.filter(f => f.type === 'laser');
        const a0 = L.length ? L[0].ang : 0;
        for (let i = 0; i < 8; i++) { G.hitstop = 0; await frame(); }
        const a1 = L.length ? L[0].ang : 0;
        return { n: L.length, spin: !!(L[0] && L[0].spin), turned: Math.abs(a1 - a0) > 0.001,
                 dbg: { form: e.form, cmpT: +(e.cmpT || 0).toFixed(2), cd: +(e.cd || 0).toFixed(2),
                        alive: G.enemies.indexOf(e) >= 0, fxAll: G.fx.map(f => f.type).join('|').slice(0, 60) } };
      })();

      R.homing = await (async () => {
        G.ebullets.length = 0;
        d.ebullet(560, 300, Math.PI, 0, 4);
        const plain = G.ebullets[0];
        eShot(760, 300, Math.PI * 1.5, 90, 4, '#ffcd75', { homing: 0.9 });
        const h = G.ebullets[G.ebullets.length - 1];
        const a0 = Math.atan2(h.vy, h.vx);
        for (let i = 0; i < 50; i++) { G.hitstop = 0; await frame(); }
        const a1 = Math.atan2(h.vy, h.vx);
        return { marked: (h.homing || 0) > 0, turned: Math.abs(a1 - a0) > 0.01, plainHom: plain.homing || 0,
                 dbg: { t: +h.t.toFixed(2), a0: +a0.toFixed(3), a1: +a1.toFixed(3),
                        stillIn: G.ebullets.indexOf(h) >= 0, n: G.ebullets.length } };
      })();

      // ---------- ⑦ 本体死后的清理（**必须放最后**：打死巨像 = 过关，
      //    会立刻弹选卡界面、主循环停摆，之后所有 frame() 的 dt 都是 0 ——
      //    放在前面的话后面每一个用例都会静默假失败）----------
      e = await bring('warden'); await toPct(e, 0.20);
      const tBefore = G.enemies.filter(x => x.turret).length;
      G.blackout = 3;
      e.hp = 1; d.hit(e, 99999, 1, 0);
      for (let i = 0; i < 8; i++) await frame();
      R.cleanup = {
        turretsBefore: tBefore, turretsAfter: G.enemies.filter(x => x.turret).length,
        boss: !!G.boss, phantoms: G.phantoms.length, blackout: G.blackout,
      };

      // ---------- ⑧ 规模 / 精灵 / i18n ----------
      R.bossCount = ids.length;
      R.spritesAllExist = ids.every(id => !!SPR[id] && !!SPR[id + '_x']);
      R.sprSameW = ids.every(id => SPR[id].w === SPR[id + '_x'].w);
      R.sprSize = ids.map(id => SPR[id].w + 'x' + SPR[id].h + '/' + SPR[id + '_x'].w + 'x' + SPR[id + '_x'].h);
      try { R.i18nMissing = d.i18nMissing ? d.i18nMissing() : 'no api'; }
      catch (err) { R.i18nMissing = 'ERR ' + err.message; }
      resolve(R);
    } catch (err) { reject(String(err && err.stack || err)); }
  }));

  log('== 形态表（八只）==');
  log(' 全部三形态 / 第三形态换模型 : ' + ok(res.allThree) + ' / ' + ok(res.allXonLast));
  for (const id of res.ids) {
    const f = res.forms[id];
    if (!f || f.length < 3) { log(' ' + id.padEnd(11) + ' 形态表缺失'); continue; }
    log(' ' + id.padEnd(11) + ' cd ' + f.map(x => x.cd).join('→') + '   spd ' + f.map(x => x.spd).join('→')
        + '   pats数 ' + f.map(x => x.n).join('→') + '  ' + ok(res.monotonic[id]) + ok(res.patsDiffer[id]));
  }
  log('== 逐只实测：切到第三形态 ==');
  for (const id of res.ids) {
    const s = res.shift[id];
    if (typeof s === 'string') { log(' ' + id.padEnd(11) + s); continue; }
    log(' ' + id.padEnd(11) + (s.spr0 + ' → ' + s.spr2).padEnd(28)
        + '敌弹 ' + s.ebBefore + '→' + s.ebAfter + '  vuln=' + s.vuln
        + '  ' + ok(s.isX && s.ebAfter === 0));
  }
  log('== 形态专属改动 ==');
  log(' 狱卒·展开炮塔（可击破）    : ' + res.turrets + '  ' + ok(res.turrets === 2 && res.turretKillable));
  log(' 棱镜·裂相幻影（非敌人）    : ' + res.phantoms + '  ' + ok(res.phantomNotEnemy));
  log(' 幻影是否开火               : ' + ok(res.phantomFires));
  log(' 母岩·熔核易伤倍率         : ' + res.vuln + '  ' + ok(res.vuln === 1.35));
  log(' 易伤实测 100 → 普通/易伤   : ' + res.vulnApplied.plain + ' / ' + res.vulnApplied.vuln + '  ' + ok(res.vulnApplied.vuln > res.vulnApplied.plain));
  log(' 磁暴·反极位移（负=被推开） : ' + res.pushAway + '  ' + ok(res.pushAway < -5));
  log(' 蜂巢·破裂漏虫数           : ' + res.leaks + '  ' + ok(res.leaks > 0));
  log('== 星蚀 ==');
  log(' 熄灭战场触发 / 峰值        : ' + ok(res.blackout > 0) + ' / ' + res.blackoutPeak + 's');
  log(' 会自己走完并归零           : ' + ok(res.blackoutEnds));
  log('== 本体死后的清理 ==');
  log(' 炮塔 / 幻影 / 熄灭        : ' + res.cleanup.turretsBefore + '→' + res.cleanup.turretsAfter
      + ' / ' + res.cleanup.phantoms + ' / ' + res.cleanup.blackout
      + '  ' + ok(res.cleanup.turretsAfter === 0 && res.cleanup.phantoms === 0 && res.cleanup.blackout === 0 && !res.cleanup.boss));
  log('== 新弹幕 ==');
  log(' crossLaser 道数 / 会自转   : ' + res.cross.n + '  ' + ok(res.cross.n === 4 && res.cross.spin && res.cross.turned) + '  ' + JSON.stringify(res.cross.dbg));
  log(' homing 标记 / 真的拐了     : ' + ok(res.homing.marked) + ' / ' + ok(res.homing.turned) + ' ' + JSON.stringify(res.homing.dbg) + '（普通弹 homing=' + res.homing.plainHom + '）');
  log('== 规模 / 精灵 / i18n ==');
  log(' 巨像数                     : ' + res.bossCount);
  log(' 终形态精灵齐全 / 同宽      : ' + ok(res.spritesAllExist) + ' / ' + ok(res.sprSameW));
  log(' 本体/终形态尺寸            : ' + res.sprSize.join('  '));
  log(' zh-en 缺键                 : ' + (Array.isArray(res.i18nMissing) ? (res.i18nMissing.length ? res.i18nMissing.join(',') : '无') : res.i18nMissing));
  log('== JS 错误 ==');
  log(errs.length ? errs.slice(0, 10).join('\n') : ' 无');
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
