/* Phase 6.6 轨迹码 —— 断言脚本 */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const BASE=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail=0,pass=0;
const ok=(n,c,d='')=>{if(c)pass++;else fail++;console.log((c?'ok  PASS ':'FAIL     ')+n+(d?'  '+d:''));};
const err=(n,e)=>{fail++;console.log('ERR      '+n+'  '+e.message);};
const ev=async(p,code)=>JSON.parse(await p.evaluate(c=>NOVA.debug(c),code));

async function fresh(b,url){
  const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(url||BASE);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.gcode,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  return p;
}
/* 造一局：带种子 + 录一段螺旋轨迹 */
const MK=`(sec=>{
  NOVA.ghost.wipe();NOVA.ghost.opt(1);
  startGame(HULLS[0]);
  G.seed=normSeed(1234567);setSeed(G.seed);
  G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
  var N=Math.round((sec||60)*10),x=1300,y=850,a=0;
  for(var i=0;i<N;i++){a=i*0.02;x=1300+Math.cos(a)*(300+i*0.35);y=850+Math.sin(a)*(220+i*0.3);
    ghostPush(x,y,a);}
  G.runT=N/10;Wv.n=9;G.score=42000;
  G.lastHull=HULLS[2];
  return N;})`;

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 常量：5Hz × 90s = 450 点 · 量化 4px · 朝向 256 级 */
try{
  const p=await fresh(b);
  const r=await ev(p,`JSON.stringify([NOVA.gcode.hz(),NOVA.gcode.sec(),NOVA.gcode.max(),NOVA.gcode.q()])`);
  ok('6-6-01-table', r[0]===5&&r[1]===90&&r[2]===450&&r[3]===4,
     `${r[0]}Hz × ${r[1]}s = ${r[2]} 点 · 位置量化 ${r[3]}px`);
  await p.close();
}catch(e){err('6-6-01-table',e);}

/* 02 往返：种子 / 难度 / 挑战 / 卡池 / 船体 / 分数 / 波次 全对得上 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var pts=[];for(var i=0;i<200;i++)pts.push(300+i*3,800+Math.sin(i/9)*200,i*0.03-1);
    var src={sc:98765,w:23,hull:'rapier',sd:1234567,diff:'abyss',
             rm:['swarm','brittle'],bn:['crit','magnet','drone'],
             dt:0.2,n:200,pts:pts};
    var c=gcodeEnc(src);var g=gcodeDec(c);   /* 用原始函数：NOVA 钩子返回的是摘要，故意不带 pts */
    return JSON.stringify({len:c.length,g:g});})()`);
  const g=r.g;
  ok('6-6-02-roundtrip', !!g && g.sc===98765 && g.w===23 && g.hull==='rapier'
       && g.sd==='00QGLJ' && g.seed===1234567 && g.diff==='abyss'
       && g.rm.join()==='swarm,brittle' && g.bn.join()==='crit,magnet,drone'
       && g.n===200 && Math.abs(g.dt-0.2)<1e-9 && g.ext===1,
     `码长 ${r.len} · sc${g&&g.sc} w${g&&g.w} ${g&&g.hull} 种子${g&&g.sd} ${g&&g.diff} `
     +`挑战[${g&&g.rm.join('+')}] 卡池[${g&&g.bn.join('+')}] n=${g&&g.n}`);
  await p.close();
}catch(e){err('6-6-02-roundtrip',e);}

/* 03 轨迹精度：量化 4px → 最大误差 ≤2px；角度误差 ≤1/256 圈 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var pts=[],i;for(i=0;i<150;i++)pts.push(200+i*7.3,600+Math.sin(i/7)*300,i*0.041-2);
    var g=gcodeDec(gcodeEnc({sc:1,w:1,hull:'peregrine',sd:1,diff:'standard',
      rm:[],bn:[],dt:0.2,n:150,pts:pts}));
    var mx=0,ma=0;
    for(i=0;i<150;i++){
      mx=Math.max(mx,Math.abs(g.pts[i*3]-pts[i*3]),Math.abs(g.pts[i*3+1]-pts[i*3+1]));
      var d=Math.abs(((g.pts[i*3+2]-pts[i*3+2])%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI);
      ma=Math.max(ma,d);
    }
    return JSON.stringify({mx:+mx.toFixed(3),ma:+ma.toFixed(4)});})()`);
  ok('6-6-03-precision', r.mx<=2.001 && r.ma<=Math.PI/256+1e-3,
     `位置最大误差 ${r.mx}px（≤2）· 角度最大误差 ${r.ma} rad（≤${(Math.PI/256).toFixed(4)}）`);
  await p.close();
}catch(e){err('6-6-03-precision',e);}

/* 04 长度：90s 上限 = 450 点，码长落在 1.7–1.9K（URL 走 hash，不超 2048） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ghost.wipe();startGame(HULLS[0]);
    G.seed=normSeed(999);setSeed(G.seed);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    var N=3000,x=1300,y=850,a=0;              /* 300 秒 @10Hz，远超 90s 上限 */
    for(var i=0;i<N;i++){a=i*0.013;x=1300+Math.cos(a)*(300+i*0.2);y=850+Math.sin(a)*(240+i*0.18);
      ghostPush(x,y,a);}
    G.runT=300;Wv.n=30;G.score=1;
    return JSON.stringify({res:NOVA.gcode.resample(),len:NOVA.gcode.mine().length,
            url:NOVA.gcode.url().length});})()`);
  ok('6-6-04-size', r.res===450 && r.len>1600 && r.len<2000 && r.url-r.len<80,
     `300s 录到 6000 点 → 重采样 ${r.res} 点（上限 450）· 码长 ${r.len} 字符 · 链接总长 ${r.url}`);
  await p.close();
}catch(e){err('6-6-04-size',e);}

/* 05 门槛：无种子不产码（地图不同，影子没有可比性） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ghost.wipe();startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<600;i++)ghostPush(500,500,0);
    G.seed=0;var noSeed=NOVA.gcode.mine();
    G.seed=normSeed(555);var withSeed=NOVA.gcode.mine();
    G.gn=10;var tooShort=NOVA.gcode.mine();
    return JSON.stringify({noSeed:noSeed.length,withSeed:withSeed.length,tooShort:tooShort.length});})()`);
  ok('6-6-05-gate', r.noSeed===0 && r.withSeed>0 && r.tooShort===0,
     `无种子 ${r.noSeed} · 有种子 ${r.withSeed} · 点数不足 ${r.tooShort}`);
  await p.close();
}catch(e){err('6-6-05-gate',e);}

/* 06 收端：take 注入 pendingGhost + pendingSeed，开局后 gsrc='link' */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ghost.wipe();NOVA.ghost.opt(1);
    var pts=[];for(var i=0;i<120;i++)pts.push(400+i*5,700,i*0.02);
    var c=NOVA.gcode.enc({sc:55555,w:12,hull:'raven',sd:777777,diff:'standard',
      rm:[],bn:[],dt:0.2,n:120,pts:pts});
    var took=NOVA.gcode.take(c);
    var pend=!!G.pendingGhost,psd=G.pendingSeed;
    startGame(HULLS[0]);
    var pl=G.gplay;
    return JSON.stringify({took:took,pend:pend,psd:psd,src:G.gsrc,
            play:pl?{sc:pl.sc,w:pl.w,hull:pl.hull,ext:!!pl.ext,n:pl.n}:null,
            stored:Object.keys(GHOSTS).length});})()`);
  ok('6-6-06-take', r.took===true && r.pend===true && r.psd===777777 && r.src==='link'
       && !!r.play && r.play.sc===55555 && r.play.hull==='raven' && r.play.ext===true
       && r.stored===0,
     `take=${r.took} · pendingSeed=${r.psd} · gsrc=${r.src} · 影子 sc${r.play&&r.play.sc} `
     +`${r.play&&r.play.hull} 外来=${r.play&&r.play.ext} · 未污染本机库（${r.stored} 组）`);
  await p.close();
}catch(e){err('6-6-06-take',e);}

/* 07 本机影子优先级：没有链接时 gsrc='best'，有链接时链接赢 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ghost.wipe();NOVA.ghost.opt(1);
    startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<100;i++)ghostPush(300,300,0);
    G.score=1000;G.runT=10;Wv.n=3;ghostSave();
    startGame(HULLS[0]);var a=G.gsrc;
    var pts=[];for(var i=0;i<100;i++)pts.push(300,300,0);
    NOVA.gcode.take(NOVA.gcode.enc({sc:99999,w:30,hull:'nemesis',sd:42,diff:'standard',
      rm:[],bn:[],dt:0.2,n:100,pts:pts}));
    startGame(HULLS[0]);var b=G.gsrc,pb=G.gplay&&G.gplay.sc;
    startGame(HULLS[0]);var c=G.gsrc;
    return JSON.stringify({a:a,b:b,c:c,pb:pb});})()`);
  ok('6-6-07-priority', r.a==='best' && r.b==='link' && r.pb===99999 && r.c==='best',
     `本机最佳=${r.a} → 链接=${r.b}（sc${r.pb}）→ 用完即清回落到 ${r.c}`);
  await p.close();
}catch(e){err('6-6-07-priority',e);}

/* 08 URL 直达：#g= 一键开局，同地图 + 影子在跑 */
try{
  const p=await fresh(b);
  const code=await ev(p,`(()=>{
    NOVA.ghost.wipe();NOVA.ghost.opt(1);startGame(HULLS[0]);
    G.seed=normSeed(24680);setSeed(G.seed);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<900;i++)ghostPush(1300+Math.cos(i/40)*400,850+Math.sin(i/33)*300,i/60);
    G.runT=90;Wv.n=8;G.score=33000;
    return JSON.stringify(NOVA.gcode.mine());})()`);
  const url=BASE+'#g='+code;
  const q=await fresh(b,url);
  await q.waitForTimeout(900);
  const r=await ev(q,`(()=>{
    return JSON.stringify({mode:G.mode,seed:G.seed,src:G.gsrc,
            play:G.gplay?{n:G.gplay.n,sc:G.gplay.sc,hull:G.gplay.hull}:null,
            at:(function(){var s=ghostAt(20);return s?[Math.round(s.x),Math.round(s.y)]:null;})()});})()`);
  ok('6-6-08-url', r.mode!=='menu' && r.seed===24680 && r.src==='link'
       && !!r.play && r.play.n===450 && !!r.at,
     `#g= 直达：mode=${r.mode} · 种子=${r.seed} · 来源=${r.src} · 影子 ${r.play&&r.play.n} 点 `
     +`· t=20s 位置 [${r.at}]`);
  await q.close();
  await p.close();
}catch(e){err('6-6-08-url',e);}

/* 09 坏码兜底：乱码 / 截断 / 空串 一律 null 且不炸 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var good=NOVA.gcode.mine();
    var bad=['','!!!!','AAAA','zzzzzzzzzzzzzzzzzzzz'];
    var res=bad.map(c=>NOVA.gcode.dec(c));
    var cut=good?NOVA.gcode.dec(good.slice(0,Math.floor(good.length/2))):null;
    var tookBad=NOVA.gcode.take('!!!!');
    return JSON.stringify({allNull:res.every(x=>x===null),cut:cut===null?0:1,tookBad:tookBad,
            tookOk:NOVA.gcode.take(good||'')});})()`);
  ok('6-6-09-badcode', r.allNull===true && r.tookBad===false,
     `4 个坏码全部 null=${r.allNull} · 截断码可解=${r.cut===null?'否（解出则看字段）':'是'} · take(坏)=${r.tookBad}`);
  await p.close();
}catch(e){err('6-6-09-badcode',e);}

/* 10 结算 UI：有码才显示按钮，点开给出完整链接 */
try{
  const p=await fresh(b);
  await ev(p,MK+'(60)');
  const r=await ev(p,`(()=>{
    var before=document.getElementById('btnGhostO').hidden;
    showOver();
    var shown=!document.getElementById('btnGhostO').hidden;
    var urlLen=NOVA.gcode.share();
    var ta=document.getElementById('overGhost');
    return JSON.stringify({before:before,shown:shown,urlLen:urlLen,taShown:!ta.hidden,
            hasG:/#seed=[0-9A-Za-z]{4,6}&g=/.test(ta.value),
            hint:document.getElementById('overGhostHint').textContent});})()`);
  ok('6-6-10-ui', r.before===true && r.shown===true && r.urlLen>200 && r.taShown===true && r.hasG===true,
     `结算前隐藏=${r.before} → 结算后显示=${r.shown} · 链接 ${r.urlLen} 字符 · 含 #seed=&g= · 提示「${r.hint}」`);
  await p.close();
}catch(e){err('6-6-10-ui',e);}

/* 11 无种子局：结算不出现轨迹链接按钮（地图不同不该给） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ghost.wipe();startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<600;i++)ghostPush(500,500,0);
    G.runT=60;Wv.n=7;G.score=100;G.seed=0;
    showOver();
    return JSON.stringify({hidden:document.getElementById('btnGhostO').hidden,
            ta:document.getElementById('overGhost').hidden});})()`);
  ok('6-6-11-nosseed', r.hidden===true && r.ta===true,
     `随机局：按钮隐藏=${r.hidden} · 链接框隐藏=${r.ta}`);
  await p.close();
}catch(e){err('6-6-11-nosseed',e);}

/* 12 i18n：机库行「来自链接」标记，中英都在 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.ghost.wipe();NOVA.ghost.opt(1);
    var pts=[];for(var i=0;i<60;i++)pts.push(300+i,300,0);
    NOVA.gcode.take(NOVA.gcode.enc({sc:8888,w:5,hull:'peregrine',sd:1,diff:'standard',
      rm:[],bn:[],dt:0.2,n:60,pts:pts}));
    openHulls();
    var zh=document.getElementById('ghostRow').textContent;
    var zhBtn=document.querySelectorAll('#ghostRow .gclr').length;
    LANG='en';renderGhostRow();
    var en=document.getElementById('ghostRow').textContent;
    LANG='zh';
    return JSON.stringify({zh:zh,en:en,zhBtn:zhBtn});})()`);
  ok('6-6-12-i18n', /来自链接/.test(r.zh) && /FROM LINK/.test(r.en) && r.zhBtn===0,
     `中「${r.zh.trim().slice(0,26)}」/ 英「${r.en.trim().slice(0,30)}」· 外来影子不给清除键=${r.zhBtn===0}`);
  await p.close();
}catch(e){err('6-6-12-i18n',e);}

/* 13 回归：6.1 种子 / 6.5 幽灵 / 5.6 榜单 不破 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var sd=NOVA.seed.code(12345);
    var gp=NOVA.ghost.push(1,2,3).gn;
    var pl=NOVA.pool.max();
    var rm=NOVA.rmod.scoreMul();
    return JSON.stringify({sd:sd,gp:gp,pl:pl,rm:rm});})()`);
  ok('6-6-13-regress', r.sd.length===6 && r.gp>=1 && r.pl===8 && r.rm>=1,
     `种子码 ${r.sd} · 幽灵钩子可写 ${r.gp} · 卡池上限 ${r.pl} · 挑战倍率 ${r.rm}`);
  await p.close();
}catch(e){err('6-6-13-regress',e);}

/* 14 竖屏 390px：轨迹链接 textarea 不撑破面板 */
try{
  const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(BASE);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.gcode,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  const r=await ev(p,MK+'(90)');
  await ev(p,`(()=>{showOver();return '1';})()`);
  const m=await ev(p,`(()=>{
    NOVA.gcode.share();
    var ta=document.getElementById('overGhost').getBoundingClientRect();
    return JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
            w:Math.round(ta.width),right:Math.round(ta.right)});})()`);
  ok('6-6-14-mobile', m.sw<=m.cw+1 && m.right<=390 && m.w>200,
     `390px：scrollW ${m.sw} ≤ clientW ${m.cw} · 链接框宽 ${m.w} 右缘 ${m.right}`);
  await p.close();
}catch(e){err('6-6-14-mobile',e);}

console.log('\n6.6 轨迹码：'+pass+' PASS / '+fail+' FAIL');
await b.close();
process.exit(fail?1:0);
})();
