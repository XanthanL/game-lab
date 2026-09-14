/* Phase 4.5 留档截图 —— 无尽强化层的 HUD / 横幅读数
 *
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-5-shots.js
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const D = [1440, 900], M = [390, 844];

async function shot(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.waitForTimeout(420);          // 等横幅淡入到位
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(26), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

(async () => {

/* 普通波：HUD 波次读数带强化层后缀 */
await shot('4-5-s1-hud-amp', ...D, async p => {
  await ev(p, `(function(){
    NOVA.death.lang('zh');startGame(HULLS[0]);
    NOVA.endless.resetBags();NOVA.endless.build(46);updateHUD();return 1;})()`);
  return await ev(p, `el.wave.textContent`);
});

/* 巨像波：横幅副标题尾部挂强化层 */
await shot('4-5-s2-boss-amp', ...D, async p => {
  await ev(p, `(function(){
    NOVA.death.lang('zh');startGame(HULLS[0]);
    NOVA.endless.resetBags();NOVA.endless.build(70);updateHUD();return 1;})()`);
  await p.waitForTimeout(300);
  return await ev(p, `el.bMain.textContent+' / '+el.bSub.textContent.slice(-10)`);
});

/* 英文：AMP 而非「强化层」 */
await shot('4-5-s3-hud-en', ...D, async p => {
  await ev(p, `(function(){
    NOVA.death.lang('en');startGame(HULLS[0]);
    NOVA.endless.resetBags();NOVA.endless.build(96);updateHUD();return 1;})()`);
  return await ev(p, `el.wave.textContent`);
});

/* 手机端同款读数 */
await shot('4-5-s4-mobile-amp', ...M, async p => {
  await ev(p, `(function(){
    NOVA.death.lang('zh');startGame(HULLS[0]);
    NOVA.endless.resetBags();NOVA.endless.build(51);updateHUD();return 1;})()`);
  return await ev(p, `el.wave.textContent`);
});

})();
