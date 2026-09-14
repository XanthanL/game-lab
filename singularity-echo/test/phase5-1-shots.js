/* Phase 5.1 留档截图 —— 设置面板的键位表
 *
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-1-shots.js
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
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
  try {
    note = (await job(p)) || '';
  } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(24), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

(async () => {

/* 桌面 · 默认键位 */
await shot('5-1-s1-default', ...D, async p => {
  await ev(p, `(function(){NOVA.keys.reset();NOVA.keys.ui();return 1;})()`);
  return await ev(p, `el.keyList.querySelectorAll('.keyrow').length+' 行'`);
});

/* 桌面 · 等待按键（朱砂描边的槽位） */
await shot('5-1-s2-waiting', ...D, async p => {
  await ev(p, `(function(){NOVA.keys.ui();NOVA.keys.click('thrust',0);return 1;})()`);
  return await ev(p, `JSON.stringify(NOVA.keys.wait())`);
});

/* 英文 · 动作名与分节标题 */
await shot('5-1-s3-en', ...D, async p => {
  await ev(p, `(function(){NOVA.death.lang('en');NOVA.keys.reset();NOVA.keys.ui();return 1;})()`);
  return await ev(p, `document.querySelector('#settings .sec-head').textContent.trim()`);
});

/* 竖屏 · 12 行不出界 */
await shot('5-1-s4-mobile', ...M, async p => {
  await ev(p, `(function(){NOVA.keys.reset();NOVA.keys.ui();return 1;})()`);
  return await ev(p, `el.keyList.querySelectorAll('.keyrow').length+' 行 / 文档宽 '+document.documentElement.scrollWidth`);
});

})();
