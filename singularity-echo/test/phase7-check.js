/* Phase 7 · 7.1 冲刺赛 —— 断言脚本 */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const BASE=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail=0,pass=0;
const ok=(n,c,d='')=>{if(c)pass++;else fail++;console.log((c?'ok  PASS ':'FAIL     ')+n+(d?'  '+d:''));};
const err=(n,e)=>{fail++;console.log('ERR      '+n+'  '+e.message);};
const ev=async(p,code)=>JSON.parse(await p.evaluate(c=>NOVA.debug(c),code));

async function fresh(b,url,vp){
  const p=await (await b.newContext({viewport:vp||{width:1280,height:900}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(url||BASE);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.ta,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  return p;
}

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 常量：TA_SEC=180 / TA_MAX=10 */
try{
  const p=await fresh(b);
  const r=await ev(p,`JSON.stringify([NOVA.ta.sec(),NOVA.ta.max()])`);
  ok('7-01-table', r[0]===180 && r[1]===10, `TA ${r[0]}s · Top ${r[1]}`);
  await p.close();
}catch(e){err('7-01-table',e);}

/* 02 模式：菜单点 TIME → taMode=true → 进 hulls；开局冻结 3 项配置 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    G_DIFF='abyss';G_RMODS=['swarm','brittle'];G_BAN=['crit','magnet'];
    var before={diff:G_DIFF,rm:G_RMODS.slice(),bn:G_BAN.slice()};
    NOVA.ta.start();
    return JSON.stringify({before:before,after:{diff:G.diff,rm:G.rmods,bn:G.ban,taT:Math.round(G.taT*100)/100},
      taMode:G.taMode,taT:Math.round(G.taT)});})()`);
  ok('7-02-freeze', r.taMode===true && Math.abs(r.after.taT-180)<0.01
       && r.after.diff==='standard' && r.after.rm.length===0 && r.after.bn.length===0,
     `固定 standard · 挑战[${r.before.rm.join('+')}]→[] · 卡池[${r.before.bn.join('+')}]→[] · 倒计时 ${r.after.taT}s`);
  await p.close();
}catch(e){err('7-02-freeze',e);}

/* 03 倒计时：play 时减 / levelup 时不动 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.start();
    var t0=G.taT;
    G.mode='play';updateWorld(1.0);var playT=G.taT;
    G.mode='levelup';updateWorld(1.0);var lvT=G.taT;
    G.mode='dying';updateWorld(1.0);var dyT=G.taT;
    return JSON.stringify({t0:+t0.toFixed(3),play:+playT.toFixed(3),lv:+lvT.toFixed(3),dy:+dyT.toFixed(3)});})()`);
  ok('7-03-tick', Math.abs(r.t0-r.play-1)<0.01 && r.lv===r.play && r.dy===r.play,
     `t0 ${r.t0} → play ${r.play}（-1s）· levelup ${r.lv}（不变）· dying ${r.dy}（不变）`);
  await p.close();
}catch(e){err('7-03-tick',e);}

/* 04 时间到自动 die：play 状态 taT=0 → tick 触发 die → dying */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.start();G.mode='play';G.taT=0.001;
    updateWorld(0.05);
    return JSON.stringify({mode:G.mode,taT:+G.taT.toFixed(3),dead:G.deathT>0});})()`);
  ok('7-04-timeout', (r.mode==='dying'||r.mode==='over') && r.dead===true,
     `taT=0.001 + 0.05s → mode=${r.mode} · deathT 已起=${r.dead}`);
  await p.close();
}catch(e){err('7-04-timeout',e);}

/* 05 不写 nova-best：showOver 后 G.best 不变（哪怕本局 score 99999） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.start();
    var beforeBest=G.best;
    G.score=99999;G.runT=42;Wv.n=8;G.kills=99;
    P.hp=0;die();NOVA.death.finish();
    return JSON.stringify({mode:G.mode,best:G.best,before:beforeBest,
      dust:el.overDust?el.overDust.hidden:true,
      seed:el.overSeed?el.overSeed.textContent:'',
      score:el.overScore.textContent});})()`);
  ok('7-05-novabest', r.best===r.before && r.dust===true && /^SEED · [0-9A-Z]{6}$/.test(r.seed) && /WAVE 8/.test(r.score),
     `best ${r.before}→${r.best}（未变）· dust 行 hidden=${r.dust} · seed 行「${r.seed}」· 主标「${r.score}」`);
  await p.close();
}catch(e){err('7-05-novabest',e);}

/* 06 不 commitDaily：daily 标志位上 TA 也应该不会污染 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.start();G.daily=null;
    var before=loadDaily();
    G.score=99999;Wv.n=12;die();NOVA.death.finish();
    var after=loadDaily();
    return JSON.stringify({mode:G.mode,eq:JSON.stringify(before)===JSON.stringify(after)});})()`);
  ok('7-06-commitDaily', r.mode==='over' && r.eq===true, `TA 结算后 daily 缓存不变（${r.eq}）`);
  await p.close();
}catch(e){err('7-06-commitDaily',e);}

/* 07 独立榜单：按 wave 降序、平局按 rt 升序 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.clear();
    function rec(w,rt,s){return {s:s||0,w:w,k:0,l:1,t:60,h:'peregrine',d:'1/1',
      m:3,v:0,at:Date.now(),sd:'',df:'standard',rm:[],bn:[],rt:rt};}
    NOVA.ta.add(rec(5,30));
    NOVA.ta.add(rec(5,80));
    NOVA.ta.add(rec(8,5));
    NOVA.ta.add(rec(3,90));
    var b=NOVA.ta.board();
    return JSON.stringify({n:b.length,
      ord:b.map(function(x){return x.w+':'+x.rt;}).slice(0,4)});})()`);
  ok('7-07-board', r.n===4 && r.ord[0]==='8:5' && r.ord[1]==='5:30' && r.ord[2]==='5:80' && r.ord[3]==='3:90',
     `${r.n} 条 · 排序 ${r.ord.join(' < ')}`);
  await p.close();
}catch(e){err('7-07-board',e);}

/* 08 HUD 倒计时：taHudPaint 后非 TA 隐藏、TA 显示 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.mode(false);taHudPaint();var offHidden=el.tatime.hidden;
    NOVA.ta.start();taHudPaint();
    var onShown=!el.tatime.hidden,txt=el.tatime.textContent;
    G.taT=5;taHudPaint();var warn=el.tatime.classList.contains('warn');
    return JSON.stringify({off:offHidden,on:onShown,txt:txt,warn:warn});})()`);
  ok('7-08-hud', r.off===true && r.on===true && /^TIME 3:00$/.test(r.txt) && r.warn===true,
     `非 TA hidden=${r.off} · TA 显示「${r.txt}」· 5s 时变红=${r.warn}`);
  await p.close();
}catch(e){err('7-08-hud',e);}

/* 09 结算面板 TA 分支：m=3 / rt 字段 / newBest 隐藏 / 标题面板数据 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.start();G.score=12345;Wv.n=7;G.runT=42;G.taT=37;die();NOVA.death.finish();
    return JSON.stringify({
      mode:G.mode,newBestHidden:el.newBest.hidden,
      rank:el.overRank.textContent,cause:el.overCauseBody.innerHTML.slice(0,80),
      dust:el.overDust.hidden,seed:el.overSeed.textContent,btnG:el.btnGhostO.hidden
    });})()`);
  ok('7-09-over', r.mode==='over' && r.newBestHidden===true && /TIME ATTACK/.test(r.rank)
       && /WAVE 7/.test(r.cause) && r.dust===true && /^SEED · /.test(r.seed),
     `mode=${r.mode} · newBest 隐=${r.newBestHidden} · 排名「${r.rank}」 · dust 隐 + seed 显示 · cause 含 WAVE 7`);
  await p.close();
}catch(e){err('7-09-over',e);}

/* 10 NOVA.hook + bdMode TIME 标记 + 榜单 m=3 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.start();G.score=100;Wv.n=5;die();NOVA.death.finish();
    var rec=boardRec(false);
    return JSON.stringify({mode:G.mode,m:rec.m,bd:bdMode(rec)});})()`);
  ok('7-10-rec', r.m===3 && (r.bd==='TIME'||r.bd==='限时'), `boardRec.m=${r.m} · bdMode「${r.bd}」`);
  await p.close();
}catch(e){err('7-10-rec',e);}

/* 11 i18n：HUD 文案 / 结算文案 / bdMode 三个都在中英 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ta.mode(true);G.taT=125;LANG='zh';taHudPaint();var zhHud=el.tatime.textContent;
    LANG='en';taHudPaint();var enHud=el.tatime.textContent;
    var enBd=bdMode({m:3,v:0});
    LANG='zh';var zhBd=bdMode({m:3,v:0});
    return JSON.stringify({zhHud:zhHud,enHud:enHud,zhBd:zhBd,enBd:enBd});})()`);
  ok('7-11-i18n', /TIME/.test(r.zhHud) && /TIME/.test(r.enHud) && r.zhBd==='限时' && r.enBd==='TIME',
     `HUD「${r.zhHud}」/「${r.enHud}」· bdMode「${r.zhBd}」/「${r.enBd}」`);
  await p.close();
}catch(e){err('7-11-i18n',e);}

/* 12 回归：6.x / 5.x 钩子不破 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var sd=NOVA.seed.code(12345);
    var gp=NOVA.ghost.push(1,2,3).gn;
    var pl=NOVA.pool.max();
    var rm=NOVA.rmod.scoreMul();
    var df=NOVA.diff?NOVA.diff.now():'standard';
    return JSON.stringify({sd:sd,gp:gp,pl:pl,rm:rm,df:df});})()`);
  ok('7-12-regress', r.sd.length===6 && r.gp>=1 && r.pl===8 && r.rm>=1 && r.df==='standard',
     `种子码 ${r.sd} · 幽灵钩子可写 ${r.gp} · 卡池上限 ${r.pl} · 难度 ${r.df}`);
  await p.close();
}catch(e){err('7-12-regress',e);}

/* 13 竖屏 390px：HUD 倒计时 + 结算面板不撑破 */
try{
  const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(BASE);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.ta,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  const r=await ev(p,`(()=>{
    NOVA.ta.start();taHudPaint();
    G.score=100;Wv.n=4;die();NOVA.death.finish();
    return JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
      hudShown:!el.tatime.hidden,overShown:!el.over.hidden,boardLen:NOVA.ta.board().length});})()`);
  ok('7-13-mobile', r.sw<=r.cw+1 && r.hudShown===true && r.overShown===true,
     `390px：scrollW ${r.sw} ≤ clientW ${r.cw} · HUD 倒计时显示=${r.hudShown} · over 面板=${r.overShown} · TA 榜 ${r.boardLen} 条`);
  await p.close();
}catch(e){err('7-13-mobile',e);}

console.log('\n7 冲刺赛：'+pass+' PASS / '+fail+' FAIL');
await b.close();
process.exit(fail?1:0);
})();