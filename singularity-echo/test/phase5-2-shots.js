/* Phase 5.2 留档截图 —— 手柄支持（PAD）
 *
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-2-shots.js
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
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(24), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

(async () => {

/* 桌面 · 主菜单 + 首次连接提示横幅 */
await shot('5-2-s1-connect', ...D, async p => {
  await ev(p, `(function(){toMenu();NOVA.pad.hold(0,0,0);return 1;})()`);
  return await ev(p, `el.bMain.textContent+' | '+el.bSub.textContent`);
});

/* 桌面 · 三选一卡牌上的手柄选中框（第 2 张高亮） */
await shot('5-2-s2-cards', ...D, async p => {
  await ev(p, `(function(){
    NOVA.pad.hold(0,0,0);startGame(HULLS[0]);
    G.mode='levelup';G.rerolled=false;cardPicking=false;
    G.choices=rollChoices();renderCards();el.cards.hidden=false;
    NOVA.pad.ui(1/60,1<<15);return 1;})()`);
  return await ev(p, `JSON.stringify(NOVA.pad.sel())+' 选中 '+NOVA.pad.state().sel`
    + `+ ' · 卡名 '+(el.cardrow.children[NOVA.pad.state().sel].querySelector('h3,.mname,strong')||{textContent:''}).textContent.slice(0,12)`);
});

/* 桌面 · 机库船体选择（第 2 艘高亮） */
await shot('5-2-s3-hulls', ...D, async p => {
  await ev(p, `(function(){
    NOVA.pad.hold(0,0,0);toMenu();openHulls();
    NOVA.pad.ui(1/60,1<<15);return 1;})()`);
  return await ev(p, `JSON.stringify(NOVA.pad.sel().slice(0,3))+' 选中 '+NOVA.pad.state().sel`
    + `+ ' · '+(HULLS[NOVA.pad.state().sel]?(HULLS[NOVA.pad.state().sel].zh||HULLS[NOVA.pad.state().sel].id):'?')`);
});

/* 竖屏 · 主菜单焦点导航（.padsel 不依赖鼠标） */
await shot('5-2-s4-mobile', ...M, async p => {
  await ev(p, `(function(){
    NOVA.pad.hold(0,0,0);toMenu();
    NOVA.pad.ui(1/60,1<<13);return 1;})()`);
  return await ev(p, `(document.activeElement?document.activeElement.id||document.activeElement.tagName:'?')`
    + `+' · 文档宽 '+document.documentElement.scrollWidth`);
});

})();
