/* Phase 5.5 留档截图 —— 移动端专项
 *
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-5-shots.js
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase5');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

const P = [390, 844], L = [844, 390];

async function shot(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 3,
    hasTouch: true, isMobile: true,
  });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('out'); },
    null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1200);
  let note = '';
  try { note = (await job(p)) || ''; } catch (e) { errs.push('JOB:' + e.message.slice(0, 160)); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, tag + '.png') });
  await c.close(); await b.close();
  console.log(tag.padEnd(26), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
const evj = async (p, code) => JSON.parse(await ev(p, 'JSON.stringify(' + code + ')'));

/* 摆一局：触屏模式 + 敌人围一圈 + 真 touch 事件把摇杆顶起来 */
const SETUP = `(function(){
  startGame(HULLS[0]);G.mode='play';setTouch(true);
  P.hp=P.maxHp*0.66;P.shield=P.shieldMax*0.5;
  const R=230;
  for(let k=0;k<10;k++)spawnEnemy(EN_LIST[k%4],P.x+Math.cos(k/10*6.2832)*R,P.y+Math.sin(k/10*6.2832)*R);
  for(let i=0;i<12;i++){updateAim();updateWorld(1/60);}
  return G.enemies.length;})()`;
/* ⚠️ 用合成 TouchEvent 而不是 NOVA.touch.set()：后者绕过了 touchmove，
   底盘不会挪、#joybase 也不会显示出来，截图上什么都没有。 */
const STICK = (x0, y0, dx, dy) => `(function(){
  const T=(x,y)=>new Touch({identifier:11,target:document.body,clientX:x,clientY:y});
  const go=(t,x,y)=>{const tt=T(x,y);
    window.dispatchEvent(new TouchEvent(t,{changedTouches:[tt],touches:[tt],bubbles:true}));};
  go('touchstart',${x0},${y0});go('touchmove',${x0 + dx},${y0 + dy});
  return JSON.stringify({mag:+joy.mag.toFixed(2),left:joybase.style.left});})()`;

(async () => {

/* 竖屏 · 对局 · 摇杆推杆中 + 竖屏提示 */
await shot('5-5-s1-portrait', ...P, async p => {
  const n = await ev(p, SETUP);
  await ev(p, STICK(120, 620, 30, -34));
  await p.waitForTimeout(300);
  const s = await evj(p, `NOVA.touch.state()`);
  const h = await evj(p, `NOVA.touch.orient()`);
  return `敌${n} · 杆 mag=${s.mag} nx=${s.nx} ny=${s.ny} · 提示 ${h.hidden ? '未出现' : '已出现'}`;
});

/* 竖屏 · 只截提示那一条（放大可见性） */
await shot('5-5-s2-hint', ...P, async p => {
  await ev(p, SETUP);
  await ev(p, `NOVA.touch.sync()`);
  await p.waitForTimeout(300);
  const h = await evj(p, `NOVA.touch.orient()`);
  const r = await evj(p, `(()=>{const b=document.getElementById('orhint').getBoundingClientRect();
    return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)};})()`);
  return `hidden=${h.hidden} on=${h.on} · ${r.w}×${r.h} @(${r.x},${r.y})`;
});

/* 横屏 · 对局 · 摇杆拉到满舵 */
await shot('5-5-s3-landscape', ...L, async p => {
  const n = await ev(p, SETUP);
  await ev(p, STICK(160, 260, 0, -46));
  await p.waitForTimeout(300);
  const s = await evj(p, `NOVA.touch.state()`);
  const h = await evj(p, `NOVA.touch.orient()`);
  return `敌${n} · 杆 mag=${s.mag}(满舵) · 横屏提示 hidden=${h.hidden}`;
});

/* 横屏 · FIRE 按下（hot 态） */
await shot('5-5-s4-fire', ...L, async p => {
  await ev(p, SETUP);
  await ev(p, `(function(){fireOn=true;el.firebtn.classList.add('hot');return 1;})()`);
  await p.waitForTimeout(300);
  return await ev(p, `'FIRE hot='+el.firebtn.classList.contains('hot')`);
});

/* 竖屏 · 菜单（触屏态，不显示 FIRE，也不该有提示） */
await shot('5-5-s5-menu', ...P, async p => {
  await ev(p, `(function(){toMenu();setTouch(true);NOVA.touch.sync();return 1;})()`);
  await p.waitForTimeout(300);
  return await ev(p, `'FIRE hidden='+el.firebtn.hidden+' · 提示 hidden='+el.orhint.hidden`);
});

})();
