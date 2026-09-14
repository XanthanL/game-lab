/* Phase 6.2 留档截图 */
const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const DIR=path.join(__dirname,'phase6');
if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});

async function ready(p){
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.diff);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
}
(async()=>{
const b=await chromium.launch({executablePath:CHROME});
const shot=async(name,p)=>{await p.screenshot({path:path.join(DIR,name+'.png')});console.log('ok  '+name+'.png');};

/* s1 机库 · 难度选择（深渊已解锁并选中） */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.diff.setWave(20);NOVA.diff.pick('abyss');return '1'})()`));
  await p.click('#btnLaunch');await p.waitForTimeout(400);
  await shot('6-2-s1-hulls',p);
  await p.close();
}
/* s2 / s3 同种子同源，只换难度档 —— 用同一种子保证编队主题一致，才有可比性 */
for(const [tag,id] of [['s2-cruise','cruise'],['s3-abyss','abyss']]){
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(d=>NOVA.debug(`(()=>{NOVA.diff.setWave(20);G_DIFF=${JSON.stringify(d)};
    startGame(HULLS[0]);G.mode='play';setSeed(20260912);buildWave(12);
    G.score=0;return '1'})()`),id);
  await p.waitForTimeout(2200);   // 让队列真正吐出敌人
  await shot('6-2-'+tag,p);
  await p.close();
}
/* s4 榜单带难度标记 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.diff.setWave(20);
    for(var i=0;i<6;i++){G_DIFF=(i%2)?'abyss':'standard';startGame(HULLS[0]);
      setSeed(1000+i);buildWave(10+i);G.score=15000-i*2100;G.kills=80-i*9;G.runT=300+i*20;
      boardAdd(boardRec(i===0));}
    G_DIFF='standard';openBoard(1);return '1'})()`));
  await p.waitForTimeout(600);
  await shot('6-2-s4-board',p);
  await p.close();
}
/* s5 竖屏机库 */
{
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.diff.setWave(20);return '1'})()`));
  await p.click('#btnLaunch');await p.waitForTimeout(400);
  await shot('6-2-s5-mobile',p);
  await p.close();
}
await b.close();
console.log('done');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)});
