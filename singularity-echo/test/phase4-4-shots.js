/* Phase 4.4 留档截图 —— 三张新武器卡 / 散射实机 / 裂变实机
 *
 * 用法：
 *   cd E:/Code/game-lab/singularity-echo
 *   NODE_PATH=<装了 playwright-core 的 node_modules> \
 *     "node" \
 *     ../.workbuddy/shots/phase4-4-shots.js
 * 产出：../.workbuddy/shots/phase4/4-4-s1…s4-*.png
 */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');

const EXE = require('./_browser').exe();
const GAME = require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const OUT = path.join(__dirname, 'phase4');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}

async function shot(tag, vw, vh, job) {
  const b = await chromium.launch({ executablePath: EXE });
  const c = await b.newContext({
    viewport: { width: vw, height: vh }, deviceScaleFactor: 2,
    hasTouch: vw < 700, isMobile: vw < 700,
  });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  PAGEERROR', String(e).slice(0, 200)));
  await p.goto(GAME, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  /* headless 里 #boot 常常不淡出，会盖住整个画面（4.3b 踩过） */
  await p.evaluate(() => { const b = document.getElementById('boot'); if (b) b.hidden = true; });
  await job(p);
  await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: false });
  await c.close(); await b.close();
  console.log('  ✓', tag);
}

/* 起一局 + 装配指定构筑（与续档重放同一条路径） */
const setup = (p, bld) => p.evaluate(b => NOVA.debug(`(function(){
  startGame(HULLS[0]);
  G.build=${JSON.stringify(b)};
  for(const[id,n]of Object.entries(G.build)){const m=MOD_BY_ID[id];if(!m||m.max===Infinity)continue;
    for(let k=1;k<=Math.min(n,m.max);k++)m.apply(k);}
  recountMax();G.syn={};G.synQ=[];checkSynergies();G.synQ=[];
  return 'ok';})()`), bld);

(async () => {
  console.log('Phase 4.4 留档截图');

  // s1 三张新卡卡面（临时劫持 rollChoices 让它们必然出现）
  await shot('4-4-s1-new-cards', 1440, 900, async p => {
    await p.evaluate(() => NOVA.debug(`(function(){
      startGame(HULLS[0]);
      rollChoices=function(){return [MOD_BY_ID.spray,MOD_BY_ID.split,MOD_BY_ID.caliber];};
      openLevelUp();
      return 'ok';})()`));
    await p.waitForTimeout(700);
  });

  // s2 散射实机：满级散射 + 四枪管的扇面弹幕
  await shot('4-4-s2-spray-live', 1440, 900, async p => {
    await setup(p, { spray: 6, twin: 6, caliber: 2 });
    await p.evaluate(() => NOVA.debug(`(function(){
      G.enemies.length=0;
      for(let i=0;i<10;i++)NOVA.enemy.spawn('drifter');
      for(const e of G.enemies){e.hp=1e9;e.maxHp=1e9;e.x=P.x+260+Math.random()*160;e.y=P.y-220+Math.random()*440;}
      P.angle=0;
      for(let k=0;k<6;k++)fireGun();
      for(let k=0;k<10;k++)updateBullets(1/120);
      return 'ok';})()`));
    await p.waitForTimeout(400);
  });

  // s3 裂变实机：一发命中后炸出的弹片环
  await shot('4-4-s3-split-live', 1440, 900, async p => {
    await setup(p, { split: 6, caliber: 2 });
    await p.evaluate(() => NOVA.debug(`(function(){
      G.enemies.length=0;
      for(let i=0;i<8;i++)NOVA.enemy.spawn('drifter');
      for(const e of G.enemies){e.hp=1e9;e.maxHp=1e9;e.x=P.x+150+Math.random()*120;e.y=P.y-180+Math.random()*360;}
      P.angle=0;NOVA.weapon.clear();fireGun();
      for(let k=0;k<24;k++)updateBullets(1/120);
      return 'ok';})()`));
    await p.waitForTimeout(400);
  });

  // s4 竖屏：升级面板里的三张新卡（手机端手牌布局）
  await shot('4-4-s4-cards-mobile', 390, 844, async p => {
    await p.evaluate(() => NOVA.debug(`(function(){
      startGame(HULLS[0]);
      rollChoices=function(){return [MOD_BY_ID.spray,MOD_BY_ID.split,MOD_BY_ID.caliber];};
      openLevelUp();
      return 'ok';})()`));
    await p.waitForTimeout(700);
  });

  console.log('完成');
})();
