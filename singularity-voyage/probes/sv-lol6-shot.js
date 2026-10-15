// 第六批渲染验证：把冰箭 / 射线 / 怒火 / 印记 / 荆棘 同时弄到画面上，截一张图
// 运行： node sv-lol6-shot.js
const puppeteer = require('puppeteer-core');
const CHROME = require('./probe-lib').chrome;
let BASE = process.env.SV_URL || 'http://127.0.0.1:8612/index.html';

(async () => {
  BASE = await require('./probe-lib').ensureUrl(BASE);
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

  const info = await page.evaluate(() => new Promise(async (resolve) => {
    const d = window.__dbg, G = d.G;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    d.clearMods(); d.resetStats();
    for (const id of ['crystal', 'beam', 'headshot', 'undying', 'mark', 'thorns']) d.grant(id, 3);
    d.setPos(600, 400);
    G.aim = -0.35; G.ang = -0.35;
    // 一排敌人：让冰箭 / 射线 / 印记都有目标
    for (let i = 0; i < 5; i++) {
      const e = d.spawn('tadpole', 600 + 90 + i * 46, 400 - 40 + i * 20);
      e.hp = e.maxHp = 4000;
      d.hit(e, 260, 1, 0);        // 挂上死亡印记
    }
    // 冰箭
    G.S.crystalT = 999; fireArrow();
    // 射线：强制进入发射状态（站桩蓄力要 0.55s，截图就等它自己蓄满）
    G.vx = 0; G.vy = 0; G.beamCh = 0; G.beamFire = 0; G.beamT = 0;
    // 怒火
    G.inv = 0; G.S.hp = 4; G.S.maxHp = 100;
    tryUndying();
    G.hitstop = 0;
    // 荆棘的反击环
    G.thornCd = 0; thornBurst(30);
    // 等射线自己蓄满并射出
    for (let i = 0; i < 90 && G.beamFire <= 0; i++) { G.hitstop = 0; await frame(); }
    for (let i = 0; i < 6; i++) { G.hitstop = 0; await frame(); }
    // 第二张干净的：清掉 banner，把敌人挪回船头正前方
    G.banners.length = 0;
    G.enemies.length = 0; G.arrows.length = 0;
    for (let i = 0; i < 4; i++) {
      const e = d.spawn('tadpole', 600 + 120 + i * 40, 400 - 30 + i * 22);
      e.hp = e.maxHp = 4000;
      d.hit(e, 200, 1, 0);
    }
    G.S.crystalT = 999; fireArrow();
    G.hitstop = 0;
    for (let i = 0; i < 8; i++) { G.hitstop = 0; await frame(); }
    resolve({
      firing: G.beamFire > 0, arrows: G.arrows.length,
      undying: +G.undyingT.toFixed(1), marked: G.enemies.filter(e => e.markT > 0).length,
    });
  }));
  console.log('状态:', JSON.stringify(info));
  await page.screenshot({ path: 'probes/lol6-battle2.png' });
  console.log('JS 错误:', errs.length ? errs.slice(0, 6).join('\n') : '无');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
