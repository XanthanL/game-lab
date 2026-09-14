/* Phase 6.1 留档截图 */
const {chromium}=require('playwright-core');
const fs=require('fs'),path=require('path');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const DIR=path.join(__dirname,'phase6');
if(!fs.existsSync(DIR))fs.mkdirSync(DIR,{recursive:true});

async function ready(p,want){
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.rng);
  await p.waitForFunction(w=>NOVA.debug('G.mode')===w,want||'menu',{timeout:25000}).catch(()=>{});
}
(async()=>{
const b=await chromium.launch({executablePath:CHROME});
const shot=async(name,p,clip)=>{
  await p.screenshot({path:path.join(DIR,name+'.png'),...(clip?clip:{})});
  console.log('ok  '+name+'.png');
};

/* s1 种子面板 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.click('#btnSeed');await p.waitForTimeout(250);
  await shot('6-1-s1-panel',p);
  await p.close();
}
/* s2 对局中暂停 · 显示种子 */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{G.pendingSeed=codeSeed('ABC123');startGame(HULLS[0]);
    G.score=4200;G.kills=27;Wv.n=6;return '1'})()`));
  await p.waitForTimeout(600);
  await p.evaluate(()=>NOVA.debug('pauseGame()'));
  await p.waitForTimeout(300);
  await shot('6-1-s2-pause',p);
  await p.close();
}
/* s3 成绩卡（带种子） */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{G.pendingSeed=codeSeed('ABC123');startGame(HULLS[0]);
    G.score=18600;G.kills=142;Wv.n=23;G.runT=412;
    var rec=boardRec(false);var rk=boardAdd(rec);SH_REC=rec;SH_RANK=rk;openShare();return '1'})()`));
  await p.waitForTimeout(700);
  await shot('6-1-s3-card',p);
  await p.close();
}
/* s4 榜单（每行带种子码） */
{
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  await p.goto(URL);await ready(p);
  await p.evaluate(()=>NOVA.debug(`(()=>{
    for(var i=0;i<6;i++){G.pendingSeed=codeSeed('ABC12'+i);startGame(HULLS[0]);
      G.score=9000-i*1300;G.kills=60-i*7;Wv.n=14-i;boardAdd(boardRec(i===0));}
    openBoard(1);return '1'})()`));
  await p.waitForTimeout(500);
  await shot('6-1-s4-board',p);
  await p.close();
}
/* s5 竖屏种子面板 */
{
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
  await p.goto(URL);await ready(p);
  await p.click('#btnSeed');await p.waitForTimeout(300);
  await shot('6-1-s5-mobile',p);
  await p.close();
}
await b.close();
console.log('done');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)});
