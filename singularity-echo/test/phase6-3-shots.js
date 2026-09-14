/* Phase 6.3 自定义挑战 —— 留档截图 */
const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const DIR=path.join(__dirname,'phase6');
if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});

async function ready(p){
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.rmod);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
}
(async()=>{
const b=await chromium.launch({executablePath:CHROME});
const shot=async(name,p)=>{await p.screenshot({path:path.join(DIR,name+'.png')});console.log('ok  '+name+'.png');};

/* s1 机库 · 挑战条（深渊 + 蜂群/疾风/脆命 三选，条上显示 ×2.05） */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.rmod.setWave(20);NOVA.diff.pick('abyss');
    NOVA.rmod.pick(['swarm','gale','brittle']);return '1'})()`));
  await p.click('#btnLaunch');await p.waitForTimeout(400);
  await shot('6-3-s1-hulls',p);
  await p.close();
}
/* s2 蜂群：第 12 波，敌人明显更密 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.rmod.setWave(20);NOVA.rmod.start(['swarm']);
    G.mode='play';setSeed(20260912);buildWave(12);G.score=0;return '1'})()`));
  await p.waitForTimeout(2400);
  await shot('6-3-s2-swarm',p);
  await p.close();
}
/* s3 脆命：船体上限砍半，HUD 上直接读得出 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.rmod.setWave(20);NOVA.rmod.start(['brittle','bulwark']);
    G.mode='play';setSeed(20260912);buildWave(9);G.score=0;return '1'})()`));
  await p.waitForTimeout(2000);
  await shot('6-3-s3-brittle',p);
  await p.close();
}
/* s4 榜单带挑战标记 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.rmod.setWave(20);
    var sets=[['swarm','brittle'],['gale'],['bulwark','barren'],[],['brittle'],['swarm','gale','barren']];
    for(var i=0;i<6;i++){G_RMODS=sets[i];G_DIFF=(i%2)?'abyss':'standard';startGame(HULLS[0]);
      setSeed(1000+i);buildWave(10+i);G.score=21000-i*2600;G.kills=90-i*9;G.runT=320+i*20;
      boardAdd(boardRec(i===0));}
    G_RMODS=[];openBoard(1);return '1'})()`));
  await p.waitForTimeout(600);
  await shot('6-3-s4-board',p);
  await p.close();
}
/* s5 竖屏机库 · 挑战条不溢出 */
{
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.rmod.setWave(20);
    NOVA.rmod.pick(['swarm','gale','brittle']);return '1'})()`));
  await p.click('#btnLaunch');await p.waitForTimeout(400);
  await shot('6-3-s5-mobile',p);
  await p.close();
}
await b.close();
console.log('done');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)});
