/* Phase 6.5 幽灵回放 —— 存档截图（4 张） */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const ev=async(p,c)=>JSON.parse(await p.evaluate(x=>NOVA.debug(x),c));
async function fresh(b,vp){
  const p=await (await b.newContext({viewport:vp||{width:1280,height:900}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(URL);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.ghost,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  return p;
}
(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* s1 机库：影子状态行（有影子 + 清除键） */
{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    var fp=ghostFpMenu(),pts=[];
    for(var i=0;i<420;i++)pts.push(700+Math.sin(i/26)*520,850+Math.cos(i/19)*360,i/40);
    NOVA.ghost.set(fp,{sc:48210,t:214,w:22,hull:'rapier',sd:'7KQ2ZP',diff:'standard',
      rm:['swarm'],bn:[],v:0,dt:0.1,n:420,pts:pts,ts:Date.now()});
    openHulls();return '1';})()`);
  await p.waitForTimeout(400);
  await p.screenshot({path:'6-5-s1-hulls.png'});
  await p.close();
}
/* s2 局内：影子船 + 已飞航迹（跑一段后截） */
{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    var pts=[];
    for(var i=0;i<900;i++)pts.push(1300+Math.sin(i/34)*560,850+Math.cos(i/23)*420,i/50);
    NOVA.ghost.set(ghostFpMenu(),{sc:48210,t:90,w:14,hull:'rapier',sd:'7KQ2ZP',
      diff:'standard',rm:[],bn:[],v:0,dt:0.1,n:900,pts:pts,ts:Date.now()});
    startGame(HULLS[0]);return '1';})()`);
  await p.waitForTimeout(1400);
  await ev(p,`(()=>{G.runT=12;updateWorld(0.016);return '1';})()`);
  await p.waitForTimeout(700);
  await p.screenshot({path:'6-5-s2-play.png'});
  await p.close();
}
/* s3 局内：间距读数（把玩家挪远，逼出 Δ 数字） */
{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    var pts=[];
    for(var i=0;i<900;i++)pts.push(1300+Math.sin(i/34)*560,850+Math.cos(i/23)*420,i/50);
    NOVA.ghost.set(ghostFpMenu(),{sc:48210,t:90,w:14,hull:'rapier',sd:'7KQ2ZP',
      diff:'standard',rm:[],bn:[],v:0,dt:0.1,n:900,pts:pts,ts:Date.now()});
    startGame(HULLS[0]);return '1';})()`);
  await p.waitForTimeout(1200);
  await ev(p,`(()=>{G.runT=20;P.x=1420;P.y=1180;updateWorld(0.016);return '1';})()`);
  await p.waitForTimeout(500);
  await p.screenshot({path:'6-5-s3-delta.png'});
  await p.close();
}
/* s4 竖屏 390px：机库影子行不溢出 */
{
  const p=await fresh(b,{width:390,height:844});
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    NOVA.ghost.set(ghostFpMenu(),{sc:135790,t:512,w:30,hull:'nemesis',sd:'ZZZ999',
      diff:'abyss',rm:['swarm','brittle'],bn:['crit'],v:1,dt:0.1,n:420,
      pts:[0,0,0,10,0,0,20,0,0],ts:Date.now()});
    openHulls();return '1';})()`);
  await p.waitForTimeout(500);
  await p.screenshot({path:'6-5-s4-mobile.png'});
  await p.close();
}
console.log('6.5 shots done');
await b.close();
})();
