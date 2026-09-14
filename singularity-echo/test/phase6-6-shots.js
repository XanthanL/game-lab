/* Phase 6.6 轨迹码 —— 存档截图（4 张） */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const BASE=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
const ev=async(p,c)=>JSON.parse(await p.evaluate(x=>NOVA.debug(x),c));
async function fresh(b,url,vp){
  const p=await (await b.newContext({viewport:vp||{width:1280,height:900}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(url||BASE);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.gcode,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  return p;
}
(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* s1 坠毁结算：轨迹链接按钮 + 链接框 */
{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);startGame(HULLS[0]);
    G.seed=normSeed(777001);setSeed(G.seed);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    var x=1300,y=850,a=0;
    for(var i=0;i<900;i++){a=i*0.014;x=1300+Math.cos(a)*(320+i*0.28);y=850+Math.sin(a)*(250+i*0.24);
      ghostPush(x,y,a);}
    G.runT=90;Wv.n=11;G.score=51230;G.kills=214;
    showOver();NOVA.gcode.share();return '1';})()`);
  await p.waitForTimeout(500);
  await p.screenshot({path:'6-6-s1-over.png'});
  await p.close();
}
/* s2 链接直达：同一张地图 + 影子在跑 */
{
  const p=await fresh(b);
  const code=await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);startGame(HULLS[0]);
    G.seed=normSeed(246802);setSeed(G.seed);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    var x=1300,y=850,a=0;
    for(var i=0;i<900;i++){a=i*0.014;x=1300+Math.cos(a)*(320+i*0.28);y=850+Math.sin(a)*(250+i*0.24);
      ghostPush(x,y,a);}
    G.runT=90;Wv.n=14;G.score=60800;
    return JSON.stringify(NOVA.gcode.mine());})()`);
  await p.close();
  const q=await fresh(b, BASE+'#g='+code);
  await q.waitForTimeout(1200);
  await ev(q,`(()=>{G.runT=18;updateWorld(0.016);return '1';})()`);
  await q.waitForTimeout(600);
  await q.screenshot({path:'6-6-s2-link.png'});
  await q.close();
}
/* s3 机库：影子标注「来自链接」且没有清除键 */
{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    var pts=[],x=1300,y=850,a=0;
    for(var i=0;i<450;i++){a=i*0.02;x=1300+Math.cos(a)*(300+i*0.4);y=850+Math.sin(a)*(220+i*0.3);
      pts.push(x,y,a);}
    NOVA.gcode.take(gcodeEnc({sc:73400,w:17,hull:'rapier',sd:246802,diff:'standard',
      rm:[],bn:[],dt:0.2,n:450,pts:pts}));
    openHulls();return '1';})()`);
  await p.waitForTimeout(500);
  await p.screenshot({path:'6-6-s3-hulls.png'});
  await p.close();
}
/* s4 竖屏 390px：链接框不撑破面板 */
{
  const p=await fresh(b,null,{width:390,height:844});
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);startGame(HULLS[0]);
    G.seed=normSeed(135791);setSeed(G.seed);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<900;i++)ghostPush(1300+Math.cos(i/40)*380,850+Math.sin(i/33)*300,i/60);
    G.runT=90;Wv.n=9;G.score=45600;
    showOver();NOVA.gcode.share();return '1';})()`);
  await p.waitForTimeout(500);
  await p.screenshot({path:'6-6-s4-mobile.png'});
  await p.close();
}
console.log('6.6 shots done');
await b.close();
})();
