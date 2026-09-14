/* Phase 5.6 留档截图 —— 分享卡片 / 本地排行榜 / 局内截图
 *
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase5-6-shots.js
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
  console.log(tag.padEnd(26), errs.length ? 'ERR ' + errs.join(' | ') : 'ok  ' + note);
}
const ev = (p, code) => p.evaluate(c => NOVA.debug(c), code);
const evj = async (p, code) => JSON.parse(await ev(p, 'JSON.stringify(' + code + ')'));

/* 造 6 条不同船体 / 模式的榜，让截图能看出排序与信息密度 */
const SEED = `(function(){
  NOVA.board.clear();
  const H=['peregrine','rapier','bulwark','raven','swarm','nemesis'];
  const S=[24800,19350,15120,12400,9760,7310];
  for(let i=0;i<6;i++)NOVA.board.add({s:S[i],w:18+i*3,k:120+i*40,l:5+(i%3),t:300+i*90,
    h:H[i],d:(i+1)+'/1'+(i%9),m:i===5?1:(i===4?2:0),v:i===0?1:0,at:i});
  return NOVA.board.list().length;})()`;

(async () => {

/* 桌面 · 排行榜（本局高亮第 3 行） */
await shot('5-6-s1-board', ...D, async p => {
  const n = await ev(p, SEED);
  await ev(p, `NOVA.board.open(3)`);
  await p.waitForTimeout(300);
  return `${n} 条 · 高亮 #3 · 手柄可聚焦 ${await evj(p, `padTargets().length`)} 个按钮`;
});

/* 桌面 · 分享卡片预览（坠毁局） */
await shot('5-6-s2-card', ...D, async p => {
  await ev(p, `(function(){
    startGame(HULLS[0]);G.mode='play';Wv.n=22;G.kills=214;G.runT=487;G.score=31400;
    G.build={loader:3,thruster:2};showOver();return 1;})()`);
  await ev(p, `NOVA.share.open()`);
  await p.waitForTimeout(400);
  const nat = await p.evaluate(() => new Promise(r => {
    const i = document.getElementById('shareImg');
    if (i.complete) r(i.naturalWidth + '×' + i.naturalHeight);
    else i.onload = () => r(i.naturalWidth + '×' + i.naturalHeight);
  }));
  return `卡片 ${nat} · 本局「${await p.textContent('#overRank')}」`;
});

/* 桌面 · 坠毁结算（排名行 + 分享按钮） */
await shot('5-6-s3-over', ...D, async p => {
  await ev(p, `(function(){
    NOVA.board.clear();
    startGame(HULLS[0]);G.mode='play';Wv.n=17;G.kills=163;G.runT=352;G.score=18600;
    showOver();return 1;})()`);
  await p.waitForTimeout(300);
  return `排名「${await p.textContent('#overRank')}」· 榜 ${await evj(p, `NOVA.board.list().length`)} 条`;
});

/* 桌面 · 通关结算（+8000 奖励，标「肃清」） */
await shot('5-6-s4-victory', ...D, async p => {
  await ev(p, `(function(){
    NOVA.board.clear();
    startGame(HULLS[0]);G.mode='play';Wv.n=30;G.kills=260;G.runT=610;G.score=22000;
    showVictory();return 1;})()`);
  await p.waitForTimeout(300);
  return `排名「${await p.textContent('#vicRank')}」· 入榜分 ${(await evj(p, `NOVA.board.list()`))[0].s}`;
});

/* 竖屏 · 排行榜 */
await shot('5-6-s5-mobile-board', ...M, async p => {
  await ev(p, SEED);
  await ev(p, `NOVA.board.open(0)`);
  await p.waitForTimeout(300);
  return `${await evj(p, `NOVA.board.rows()`)} 行 · 文档宽 ${await ev(p, `document.documentElement.scrollWidth`)}`;
});

})();
