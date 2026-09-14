/* Phase 5.3 留档截图 —— 设置面板补完
 *
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-3-shots.js
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
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(24), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);

/* 摆一屏有敌我弹丸的对局：色盲模式看的就是这个 */
const BATTLE = `(function(){
  startGame(HULLS[0]);G.mode='play';
  P.x=0;P.y=0;cam.x=0;cam.y=0;
  for(let i=0;i<8;i++){const a=i/8*6.2832;
    G.ebullets.push({x:P.x+Math.cos(a)*150,y:P.y+Math.sin(a)*150,
      vx:-Math.cos(a)*40,vy:-Math.sin(a)*40,r:4,dmg:10,life:6});
    G.bullets.push({x:P.x+Math.cos(a+0.4)*90,y:P.y+Math.sin(a+0.4)*90,
      vx:Math.cos(a+0.4)*300,vy:Math.sin(a+0.4)*300,r:3,dmg:10,life:6,
      crit:0,critMul:1,hit:new Set(),src:'p',sp:0,vis:1});}
  P.hp=P.maxHp*0.62;P.shield=P.shieldMax*0.8;
  return G.ebullets.length+'/'+G.bullets.length;})()`;

(async () => {

/* 桌面 · 设置面板（显示与性能 + 无障碍 两节） */
await shot('5-3-s1-settings', ...D, async p => {
  await ev(p, `(function(){toMenu();openSettings();NOVA.opts.ui();return 1;})()`);
  return await ev(p, `[...document.querySelectorAll('#settings .sec-head')].map(e=>e.textContent.trim()).join(' | ')`
    + `+' · 控件 '+document.querySelectorAll('#settings [data-opt]').length+' 个'`);
});

/* 桌面 · 对局 · 色盲「红绿」档 */
await shot('5-3-s2-cb-rg', ...D, async p => {
  await ev(p, BATTLE);
  await ev(p, `(function(){NOVA.opts.set('cb','rg');return 1;})()`);
  return await ev(p, `'敌弹 '+RGBA('foe',1)+' · 我弹 '+RGBA('cyan-hi',1)+' · 危险 '+RGBA('danger',1)+' · 奖励 '+RGBA('amber',1)`);
});

/* 桌面 · 对局 · 色盲「蓝黄」档 */
await shot('5-3-s3-cb-by', ...D, async p => {
  await ev(p, BATTLE);
  await ev(p, `(function(){NOVA.opts.set('cb','by');return 1;})()`);
  return await ev(p, `'敌弹 '+RGBA('foe',1)+' · 我弹 '+RGBA('cyan-hi',1)+' · 危险 '+RGBA('danger',1)+' · 奖励 '+RGBA('amber',1)`);
});

/* 竖屏 · 设置面板 */
await shot('5-3-s4-mobile', ...M, async p => {
  await ev(p, `(function(){toMenu();openSettings();NOVA.opts.ui();return 1;})()`);
  return await ev(p, `'文档宽 '+document.documentElement.scrollWidth`
    + `+' · 控件 '+document.querySelectorAll('#settings [data-opt]').length+' 个'`
    + `+' · 最小宽 '+Math.min(...[...document.querySelectorAll('#settings [data-opt]')].map(e=>Math.round(e.getBoundingClientRect().width)))`);
});

})();
