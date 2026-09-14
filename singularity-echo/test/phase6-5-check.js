/* Phase 6.5 幽灵回放 —— 断言脚本 */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail=0,pass=0;
const ok=(n,c,d='')=>{if(c)pass++;else fail++;console.log((c?'ok  PASS ':'FAIL     ')+n+(d?'  '+d:''));};
const err=(n,e)=>{fail++;console.log('ERR      '+n+'  '+e.message);};
const ev=async(p,code)=>JSON.parse(await p.evaluate(c=>NOVA.debug(c),code));

async function fresh(b,url,want,vp){
  const p=await (await b.newContext({viewport:vp||{width:1280,height:800}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(url||URL);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.ghost);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  await p.waitForFunction(w=>NOVA.debug('G.mode')===w,want||'menu',{timeout:25000}).catch(()=>{});
  return p;
}
/* 造一条影子并直接塞进 G.gplay（绕过 startGame 的指纹查表） */
const SETG=`(g=>{G.gplay=g;return JSON.stringify(!!G.gplay);})`;

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 常量表 */
try{
  const p=await fresh(b);
  const cap=await ev(p,`(()=>NOVA.ghost.cap())()`);
  const sl=await ev(p,`(()=>NOVA.ghost.slots())()`);
  const mn=await ev(p,`(()=>NOVA.ghost.min())()`);
  const dt=await ev(p,`(()=>GHOST_DT0)()`);
  ok('6-5-01-table', cap===3600&&sl===6&&mn===40&&Math.abs(dt-0.1)<1e-9,
     `CAP ${cap} · SLOTS ${sl} · MIN ${mn} · DT0 ${dt}`);
  await p.close();
}catch(e){err('6-5-01-table',e);}

/* 02 空档开局：没有影子时不炸，机库行只有标签没有清除键 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);startGame(HULLS[0]);
    return JSON.stringify(!!G.gplay);})()`);
  const has=await ev(p,`(()=>JSON.stringify(!!G.gplay))()`);
  await ev(p,`(()=>{openHulls();setCfg(true);return '1';})()`);
  const n=await ev(p,`(()=>NOVA.ghost.render())()`);
  ok('6-5-02-empty', has===false && n===1, `无影子时 gplay=${has} · 机库行 ${n} 个元素`);
  await p.close();
}catch(e){err('6-5-02-empty',e);}

/* 03 录制：按 runT 补点，采样密度恒定（runT=1.0 → 11 点） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    P.x=100;P.y=200;P.angle=1.234;
    G.runT=0;ghostRec();
    G.runT=0.5;ghostRec();
    G.runT=1.0;ghostRec();
    return JSON.stringify({gn:G.gn,len:G.gpts.length,
      p0:[G.gpts[0],G.gpts[1],G.gpts[2]]});})()`);
  ok('6-5-03-rec', r.gn===11 && r.len===33 && r.p0[0]===100 && r.p0[1]===200 && r.p0[2]===1.23,
     `runT 0→1.0 录 ${r.gn} 点 · 首点 ${JSON.stringify(r.p0)}`);
  await p.close();
}catch(e){err('6-5-03-rec',e);}

/* 04 抽稀：越过 CAP 就地 2:1，dt 翻倍 · 游标同步折半 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<3700;i++)ghostPush(500+(i%60),400,0.5);
    return JSON.stringify({gdt:G.gdt,gn:G.gn,len:G.gpts.length});})()`);
  ok('6-5-04-decimate', Math.abs(r.gdt-0.2)<1e-9 && r.gn>1700 && r.gn<2000 && r.len===r.gn*3,
     `3700 点后：dt=${r.gdt} · gn=${r.gn} · len=${r.len}（len 必须 = gn×3）`);
  await p.close();
}catch(e){err('6-5-04-decimate',e);}

/* 05 插值取位：中点取到两个采样正中间；越过末点返回 null */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();startGame(HULLS[0]);
    var g={sc:1,t:1,w:1,hull:'peregrine',sd:'',diff:'standard',rm:[],bn:[],v:0,
           dt:0.1,n:2,pts:[0,0,0,100,0,0],ts:Date.now()};
    G.gplay=g;
    var a=ghostAt(0),m=ghostAt(0.05),e2=ghostAt(0.1),z=ghostAt(9);
    return JSON.stringify({a:a&&[a.x,a.y],m:m&&[m.x,m.y],e2:e2,z:z});})()`);
  ok('6-5-05-lerp', r.a[0]===0 && Math.abs(r.m[0]-50)<1e-6 && r.e2===null && r.z===null,
     `t=0 → x ${r.a[0]} · t=0.05 → x ${r.m[0]} · t≥末点 → ${r.e2}`);
  await p.close();
}catch(e){err('6-5-05-lerp',e);}

/* 06 角度最短弧：-3.1 → 3.1 的中点必须落在 ±π 附近（不能穿过 0） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();startGame(HULLS[0]);
    G.gplay={sc:1,t:1,w:1,hull:'peregrine',sd:'',diff:'standard',rm:[],bn:[],v:0,
             dt:0.1,n:2,pts:[0,0,-3.1,0,0,3.1],ts:Date.now()};
    var m=ghostAt(0.05);
    return JSON.stringify(Math.abs(m.ang));})()`);
  ok('6-5-06-arc', r>3.0, `中点角 |ang|=${r.toFixed(3)}（应 ≈ π，走短弧不穿 0）`);
  await p.close();
}catch(e){err('6-5-06-arc',e);}

/* 07 归档：首次存 · 低分不覆盖 · 高分覆盖 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<200;i++)ghostPush(300,300,0);
    G.runT=20;Wv.n=5;
    G.score=1000;var a=ghostSave();
    G.score=500; var b=ghostSave();
    G.score=5000;var c=ghostSave();
    var g=GHOSTS[ghostFp()];
    return JSON.stringify({a:a,b:b,c:c,sc:g?g.sc:0,n:g?g.n:0,t:g?g.t:0});})()`);
  ok('6-5-07-save', r.a===true && r.b===false && r.c===true && r.sc===5000 && r.n===200 && r.t===20,
     `首存 ${r.a} · 低分 ${r.b} · 高分 ${r.c} · 落库 sc=${r.sc} n=${r.n} t=${r.t}`);
  await p.close();
}catch(e){err('6-5-07-save',e);}

/* 08 分组指纹：不同配置各存各的，互不覆盖 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();
    function rec(sc){
      startGame(HULLS[0]);
      G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
      for(var i=0;i<100;i++)ghostPush(300,300,0);
      G.score=sc;G.runT=10;Wv.n=3;ghostSave();
      return ghostFp();
    }
    NOVA.ghost.opt(1);
    var f1=rec(111);
    NOVA.rmod.pick(['swarm']);
    var f2=rec(222);
    var g1=GHOSTS[f1],g2=GHOSTS[f2];
    return JSON.stringify({n:Object.keys(GHOSTS).length,f1:f1,f2:f2,
      s1:g1?g1.sc:0,s2:g2?g2.sc:0});})()`);
  ok('6-5-08-fp', r.n===2 && r.f1!==r.f2 && r.s1===111 && r.s2===222,
     `2 组 · fp 不同 · sc ${r.s1} / ${r.s2}（${r.f1} | ${r.f2}）`);
  await p.close();
}catch(e){err('6-5-08-fp',e);}

/* 09 槽位上限：写满后按最久未刷新淘汰，恒定 ≤ 6 组 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();
    for(var i=0;i<6;i++)
      NOVA.ghost.set('fp'+i,{sc:i,t:1,w:1,hull:'peregrine',sd:'',diff:'standard',
        rm:[],bn:[],v:0,dt:0.1,n:2,pts:[0,0,0,1,0,0],ts:1000+i});
    startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<100;i++)ghostPush(300,300,0);
    G.score=99999;G.runT=10;Wv.n=3;ghostSave();
    var ks=Object.keys(GHOSTS);
    return JSON.stringify({n:ks.length,hasOldest:ks.indexOf('fp0')>=0,
      hasNewest:ks.indexOf('fp5')>=0});})()`);
  ok('6-5-09-slots', r.n===6 && r.hasOldest===false && r.hasNewest===true,
     `写入第 7 组后仍 ${r.n} 组 · 最旧的 fp0 已淘汰=${!r.hasOldest} · fp5 保留=${r.hasNewest}`);
  await p.close();
}catch(e){err('6-5-09-slots',e);}

/* 10 开局冻结 + 开关：关掉 OPTS.ghost 开局即无影子 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<100;i++)ghostPush(300,300,0);
    G.score=3000;G.runT=10;Wv.n=3;ghostSave();
    startGame(HULLS[0]);var on=!!G.gplay;
    NOVA.ghost.opt(0);startGame(HULLS[0]);var off=!!G.gplay;
    NOVA.ghost.opt(1);startGame(HULLS[0]);var back=!!G.gplay;
    return JSON.stringify({on:on,off:off,back:back});})()`);
  ok('6-5-10-toggle', r.on===true && r.off===false && r.back===true,
     `开=${r.on} · 关=${r.off} · 再开=${r.back}`);
  await p.close();
}catch(e){err('6-5-10-toggle',e);}

/* 11 老存档不误关：键缺失时保持默认开启（loadOpts 的 k in s 判据） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var raw=JSON.parse(localStorage.getItem('nova-opts')||'{}');
    delete raw.ghost;localStorage.setItem('nova-opts',JSON.stringify(raw));
    var r1=loadOpts();
    return JSON.stringify({loaded:r1,ghost:OPTS.ghost});})()`);
  ok('6-5-11-legacy', r.ghost===1, `老存档无 ghost 键 → 读档后 OPTS.ghost=${r.ghost}（必须 1）`);
  await p.close();
}catch(e){err('6-5-11-legacy',e);}

/* 12 持久化：刷新页面后影子仍在 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();
    NOVA.ghost.set('persist-x',{sc:7777,t:65,w:12,hull:'rapier',sd:'ABC123',
      diff:'standard',rm:[],bn:[],v:1,dt:0.1,n:2,pts:[0,0,0,10,0,0],ts:Date.now()});
    return '1';})()`);
  await p.reload();
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.ghost,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  const r=await ev(p,`(()=>{var g=GHOSTS['persist-x'];
    return JSON.stringify(g?{sc:g.sc,w:g.w,hull:g.hull,sd:g.sd}:null);})()`);
  ok('6-5-12-persist', !!r && r.sc===7777 && r.w===12 && r.hull==='rapier' && r.sd==='ABC123',
     `刷新后仍读到 sc=${r&&r.sc} · 第 ${r&&r.w} 波 · ${r&&r.hull} · 种子 ${r&&r.sd}`);
  await p.close();
}catch(e){err('6-5-12-persist',e);}

/* 13 机库 UI：有影子时是「标签 + 清除」，点清除后回到只有标签 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    NOVA.ghost.set(ghostFpMenu(),{sc:4200,t:88,w:9,hull:'peregrine',sd:'',
      diff:NOVA.diff?NOVA.diff.sel():'standard',rm:[],bn:[],v:0,dt:0.1,n:2,
      pts:[0,0,0,10,0,0],ts:Date.now()});
    openHulls();setCfg(true);return '1';})()`);
  const n1=await ev(p,`(()=>NOVA.ghost.render())()`);
  const txt=await p.evaluate(()=>document.getElementById('ghostRow').textContent);
  const hasBtn=await p.evaluate(()=>!!document.querySelector('#ghostRow .gclr'));
  await p.click('#ghostRow .gclr');
  const n2=await ev(p,`(()=>NOVA.ghost.render())()`);
  const left=await ev(p,`(()=>Object.keys(GHOSTS).length)()`);
  ok('6-5-13-ui', n1===2 && hasBtn && n2===1 && left===0 && /4,200/.test(txt),
     `有影子 ${n1} 元素（含清除键=${hasBtn}）→ 点击后 ${n2} 元素 · 余 ${left} 组 · 文案「${txt.trim().slice(0,28)}」`);
  await p.close();
}catch(e){err('6-5-13-ui',e);}

/* 14 i18n：英文下机库行显示 GHOST / NONE */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();
    LANG='en';openHulls();setCfg(true);var a=document.getElementById('ghostRow').textContent;
    NOVA.ghost.set(ghostFpMenu(),{sc:99,t:5,w:2,hull:'peregrine',sd:'',
      diff:'standard',rm:[],bn:[],v:0,dt:0.1,n:2,pts:[0,0,0,1,0,0],ts:Date.now()});
    renderGhostRow();var b=document.getElementById('ghostRow').textContent;
    LANG='zh';return JSON.stringify({a:a,b:b});})()`);
  ok('6-5-14-i18n', /GHOST/.test(r.a)&&/NONE/.test(r.a)&&/GHOST/.test(r.b)&&/CLEAR/.test(r.b),
     `空态「${r.a.trim()}」 / 有影子「${r.b.trim().slice(0,40)}」`);
  await p.close();
}catch(e){err('6-5-14-i18n',e);}

/* 15 渲染不抛异常：带影子跑一段，含「影子已跑完」之后的终点标记分支 */
try{
  const p=await fresh(b);
  let pe=0;p.on('pageerror',()=>pe++);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    startGame(HULLS[0]);
    G.gdt=GHOST_DT0;G.gpts=[];G.gn=0;
    for(var i=0;i<80;i++)ghostPush(200+i*4,300,0.3);
    G.score=1000;G.runT=8;Wv.n=2;ghostSave();
    startGame(HULLS[0]);
    return JSON.stringify(!!G.gplay);})()`);
  await p.waitForTimeout(900);                       // 跑几十帧，影子在动
  const mid=await ev(p,`(()=>{var s=ghostAt(G.runT);return JSON.stringify(s?1:0);})()`);
  await ev(p,`(()=>{G.runT=1000;return '1';})()`);   // 越过影子终点 → 终点标记分支
  await p.waitForTimeout(300);
  await ev(p,`(()=>{G.runT=5000;return '1';})()`);   // 远超 → 标记淡出完毕
  await p.waitForTimeout(200);
  const mode=await ev(p,`(()=>JSON.stringify(G.mode))()`);
  ok('6-5-15-render', r===true && pe===0 && (mode==='play'||mode==='inter'||mode==='dying'||mode==='over'),
     `影子在跑=${mid} · 页面异常 ${pe} 次 · 末态 ${mode}`);
  await p.close();
}catch(e){err('6-5-15-render',e);}

/* 16 回归：6.1 种子 / 6.2 难度 / 6.3 挑战 / 6.4 卡池 钩子仍完好 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var sd=NOVA.seed.code(12345);
    var df=NOVA.diff?NOVA.diff.now():'standard';
    var rm=NOVA.rmod.scoreMul();
    var pl=NOVA.pool.max();
    return JSON.stringify({sd:sd,df:df,rm:rm,pl:pl,pt:NOVA.ghost.push(1,2,3).gn});})()`);
  ok('6-5-16-regress', r.sd.length===6 && !!r.df && r.rm>=1 && r.pl===8 && r.pt>=1,
     `种子码 ${r.sd} · 难度 ${r.df} · 挑战倍率 ${r.rm} · 卡池上限 ${r.pl} · 钩子可写 ${r.pt}`);
  await p.close();
}catch(e){err('6-5-16-regress',e);}

/* 17 竖屏 390px：机库行不横向溢出 */
try{
  const p=await fresh(b,null,'menu',{width:390,height:844});
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    NOVA.ghost.set(ghostFpMenu(),{sc:13579,t:300,w:24,hull:'nemesis',sd:'ZZZ999',
      diff:'abyss',rm:['swarm','brittle'],bn:['crit'],v:0,dt:0.1,n:2,
      pts:[0,0,0,10,0,0],ts:Date.now()});
    openHulls();setCfg(true);
    var row=document.getElementById('ghostRow');
    return JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
      rh:row.getBoundingClientRect().height,n:row.children.length});})()`);
  ok('6-5-17-mobile', r.sw<=r.cw+1 && r.n===2 && r.rh>0,
     `390px：scrollW ${r.sw} ≤ clientW ${r.cw} · 机库行高 ${Math.round(r.rh)}px · ${r.n} 元素`);
  await p.close();
}catch(e){err('6-5-17-mobile',e);}

/* 18 续档：难度 / 挑战 / 卡池跟着存档回来，影子照播但不录（避免半截轨迹顶掉完整那条） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.ghost.wipe();NOVA.ghost.opt(1);
    NOVA.rmod.pick(['swarm']);NOVA.pool.pick(['crit','magnet']);
    G_DIFF='abyss';startGame(HULLS[0]);
    /* 给这组配置预置一条影子，验证续档后确实按指纹取回的是「同一条」 */
    var fp='abyss|swarm|crit+magnet';
    NOVA.ghost.set(fp,{sc:5555,t:120,w:9,hull:'peregrine',sd:'',diff:'abyss',
      rm:['swarm'],bn:['crit','magnet'],v:0,dt:0.1,n:2,pts:[0,0,0,10,0,0],ts:Date.now()});
    var before={df:G.diff,rm:G.rmods.slice(),bn:G.ban.slice()};
    G.score=1234;G.kills=7;G.runT=45;Wv.n=6;saveRun();
    /* 模拟"刷新后从菜单续档"：把内存态清成初值，只靠存档还原 */
    G.diff='standard';G.rmods=[];G.ban=[];G.gpts=[];G.gn=0;G.gplay=null;G.runT=0;
    resumeRun();
    return JSON.stringify({before:before,df:G.diff,rm:G.rmods,bn:G.ban,
      runT:Math.round(G.runT),gpts:G.gpts,fp:ghostFp(),
      play:G.gplay?{sc:G.gplay.sc,w:G.gplay.w}:null});})()`);
  ok('6-5-18-resume', r.df==='abyss' && r.rm.join()==='swarm' && r.bn.join()==='crit,magnet'
       && r.runT===45 && r.gpts===null && r.fp==='abyss|swarm|crit+magnet'
       && !!r.play && r.play.sc===5555 && r.play.w===9,
     `续档还原 难度=${r.df} 挑战=${r.rm.join('+')} 卡池=${r.bn.join('+')} · runT=${r.runT}`
     +` · 指纹=${r.fp} · 不录=${r.gpts===null} · 影子=${r.play?('sc'+r.play.sc+' w'+r.play.w):'无'}`);
  await p.close();
}catch(e){err('6-5-18-resume',e);}

console.log('\n6.5 幽灵回放：'+pass+' PASS / '+fail+' FAIL');
await b.close();
process.exit(fail?1:0);
})();
