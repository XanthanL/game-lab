/* 星图改版留档截图：桌面 4 列 / 手机 2 列 / 放大到 1.8× 各一张 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

async function shot(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: vw < 700, isMobile: vw < 700 });
  const p = await c.newPage();
  await p.goto(GAME, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await ev(p, 'openLogbook();resetAchPan();document.getElementById("boot").hidden=true;"ok"');
  await p.waitForTimeout(400);
  await job(p);
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  console.log('shot', tag);
  await c.close(); await b.close();
}
const toTree = async (p, sel) => {
  await ev(p, `document.querySelector('${sel}').scrollIntoView({block:'center'});"ok"`);
  await p.waitForTimeout(350);
};

(async () => {
  await shot('4-3b-s1-ach-desktop', 1440, 900, async p => {
    await toTree(p, '[data-node-id="lbsec6"]');
  });
  await shot('4-3b-s2-ach-zoomed', 1440, 900, async p => {
    await toTree(p, '[data-node-id="lbsec6"]');
    await ev(p, "NOVA.logbook.zoom(1.8);NOVA.logbook.pan(-40,-40);'ok'");
    await p.waitForTimeout(250);
  });
  await shot('4-3b-s3-meta-desktop', 1440, 900, async p => {
    await toTree(p, '[data-node-id="lbsec7"]');
  });
  await shot('4-3b-s4-ach-mobile', 390, 844, async p => {
    await toTree(p, '[data-node-id="lbsec6"]');
  });
  await shot('4-3b-s5-meta-mobile', 390, 844, async p => {
    await toTree(p, '[data-node-id="lbsec7"]');
  });
})();
