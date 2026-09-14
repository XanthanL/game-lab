/* Phase 6.4 工坊式卡池 —— 留档截图 */
const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const DIR=path.join(__dirname,'phase6');
if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});

async function ready(p){
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.pool);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
}
(async()=>{
const b=await chromium.launch({executablePath:CHROME});
const shot=async(name,p)=>{await p.screenshot({path:path.join(DIR,name+'.png')});console.log('ok  '+name+'.png');};

/* s1 机库 · 工坊条（8 个禁用全开，深渊 + 蜂群/疾风/脆命挑战 + 工坊 8/29） */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.rmod.setWave(20);NOVA.diff.pick('abyss');
    NOVA.rmod.pick(['swarm','gale','brittle']);
    NOVA.pool.pick(['crit','magnet','pierce','drone','aegis','ram','leech','tesla']);
    return '1'})()`));
  await p.click('#btnLaunch');await p.waitForTimeout(400);
  await shot('6-4-s1-hulls',p);
  await p.close();
}
/* s2 局内 + 工坊禁用：第 9 波，看 offer 不出现禁用的 crit */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.pool.start(['crit','magnet','pierce','drone']);
    G.mode='play';setSeed(20260912);buildWave(9);G.score=0;return '1'})()`));
  await p.waitForTimeout(2200);
  await shot('6-4-s2-play',p);
  await p.close();
}
/* s3 offer 截图：触发升 1 级时拍 offer 对话框，看三张牌不含禁用 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.pool.start(['crit','magnet','leech','tesla']);
    G.mode='play';setSeed(20260912);buildWave(4);P.xp=P.xpNext;gainXp(1);
    setTimeout(()=>{},0);return 1;})()`));
  await p.waitForTimeout(1800);
  await shot('6-4-s3-offer',p);
  await p.close();
}
/* s4 榜单带工坊标记 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{
    var sets=[['crit','pierce'],['magnet'],['drone','aegis','ram','leech'],[],['crit','magnet','pierce'],['drone']];
    for(var i=0;i<6;i++){G_BAN=sets[i];G_DIFF=(i%2)?'abyss':'standard';startGame(HULLS[0]);
      setSeed(1000+i);buildWave(10+i);G.score=21000-i*2600;G.kills=90-i*9;G.runT=320+i*20;
      boardAdd(boardRec(i===0));}
    G_BAN=[];openBoard(1);return '1'})()`));
  await p.waitForTimeout(600);
  await shot('6-4-s4-board',p);
  await p.close();
}
/* s5 竖屏机库 · 工坊条不溢出 */
{
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{NOVA.pool.pick(['crit','magnet','pierce','drone']);return '1'})()`));
  await p.click('#btnLaunch');await p.waitForTimeout(400);
  await shot('6-4-s5-mobile',p);
  await p.close();
}
await b.close();
console.log('done');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)});