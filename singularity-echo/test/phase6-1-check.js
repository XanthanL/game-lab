/* Phase 6.1 自定义种子 / 对局复现 —— 断言脚本
   断言「同种子 + 同推进 = 同结果，且与战斗过程无关」+ 玩家侧入口 / 展示 / 分享。
   游戏变量都在 IIFE 里 → 一律走 NOVA.debug(code)，code 必须能被 JSON.stringify 包住（写成立即执行函数）。 */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail=0,pass=0;
const ok=(n,c,d='')=>{if(c)pass++;else fail++;console.log((c?'ok  PASS ':'FAIL     ')+n+(d?'  '+d:''));};
const err=(n,e)=>{fail++;console.log('ERR      '+n+'  '+e.message);};

/* in-scope 求值：表达式写成立即执行函数，返回 JSON 字符串 */
const ev=async(p,code)=>JSON.parse(await p.evaluate(c=>NOVA.debug(c),code));

/* want：boot 完成后预期的 mode。boot 是分帧异步的，而且启动过程中 G.mode 本来就
   短暂等于 'menu' —— 若只等 'menu' 会在 boot 中途就返回，URL 直达那条永远测不到。 */
async function fresh(b,url,want){
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(url||URL);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.rng);
  await p.waitForFunction(w=>NOVA.debug('G.mode')===w,want||'menu',{timeout:25000}).catch(()=>{});
  return p;
}

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* ---------- 01 短码往返 ---------- */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var out=[];
    for(var i=0;i<400;i++){
      var n=irand(1,SEED_MAX);var c=seedCode(n);
      out.push({len:c.length,ok:codeSeed(c)===n,low:codeSeed(c.toLowerCase())===n,sp:codeSeed(' '+c+' ')===n});
    }
    return JSON.stringify({all6:out.every(o=>o.len===6),
      allOk:out.every(o=>o.ok),allLow:out.every(o=>o.low),allSp:out.every(o=>o.sp),
      max:SEED_MAX,edge:seedCode(SEED_MAX)+'|'+codeSeed('ZZZZZZ'),
      bad:codeSeed('!!!!')+'|'+codeSeed('')+'|'+codeSeed('   ')});
  })()`);
  ok('6-1-01-code', r.all6&&r.allOk&&r.allLow&&r.allSp&&r.bad==='0|0|0',
     `6位=${r.all6} 往返=${r.allOk} 小写容错=${r.allLow} 空格容错=${r.allSp} 非法码→${r.bad} 上界=${r.edge}`);
  await p.close();
}catch(e){err('6-1-01-code',e);}

/* ---------- 02 编队确定性（含战斗推流） ---------- */
try{
  const p=await fresh(b);
  const WV=`(()=>{var s=arguments0;NOVA.launch(0);G.mode='play';setSeed(s);
    var o=[];for(var w=1;w<=12;w++){NOVA.wave(w);
      o.push(w+':'+(NOVA.q().e||[]).join(',')+'|b='+(Wv.bossKind||'-')+'|c='+(Wv.champ||'-'));
      for(var i=0;i<500;i++)rand(1,9);}
    return JSON.stringify(o);})()`;
  const g=s=>ev(p,WV.replace('arguments0',String(s)));
  const a=await g(20260912),a2=await g(20260912),c=await g(777001);
  ok('6-1-02-wave', JSON.stringify(a)===JSON.stringify(a2)&&JSON.stringify(a)!==JSON.stringify(c),
     `12 波编队 同种子=${JSON.stringify(a)===JSON.stringify(a2)} 异种子不同=${JSON.stringify(a)!==JSON.stringify(c)}`);
  await p.close();
}catch(e){err('6-1-02-wave',e);}

/* ---------- 03 选卡确定性（干净流 / 脏流） ---------- */
try{
  const p=await fresh(b);
  const CLEAN=`(()=>{var s=arguments0;NOVA.launch(0);G.mode='play';setSeed(s);
    var o=[];for(var i=0;i<8;i++){var c=rollChoices();o.push(c.map(function(x){return x.id}).join('+'));
      if(c[0]&&c[0].id!=='repair')G.build[c[0].id]=(G.build[c[0].id]||0)+1;}
    return JSON.stringify(o);})()`;
  const DIRTY=`(()=>{var s=arguments0;NOVA.launch(0);G.mode='play';setSeed(s);
    for(var k=0;k<600;k++){G.enemies.length=0;NOVA.spawnAt(EN_LIST[0],P.x+300,P.y);
      var e=G.enemies[0];if(e)applyAffix(e);}
    for(var z=0;z<777;z++)rand(1,9);
    var o=[];for(var i=0;i<8;i++){var c=rollChoices();o.push(c.map(function(x){return x.id}).join('+'));
      if(c[0]&&c[0].id!=='repair')G.build[c[0].id]=(G.build[c[0].id]||0)+1;}
    return JSON.stringify(o);})()`;
  const g=(t,s)=>ev(p,t.replace('arguments0',String(s)));
  const c1=await g(CLEAN,4242),c2=await g(CLEAN,4242),c3=await g(CLEAN,99);
  const d1=await g(DIRTY,4242),d2=await g(DIRTY,4242);
  const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  ok('6-1-03-offer', same(c1,c2)&&same(d1,d2)&&!same(c1,c3),
     `干净流同种子=${same(c1,c2)} 脏流同种子=${same(d1,d2)} 异种子不同=${!same(c1,c3)} · 首个 offer=${c1[0]}`);
  await p.close();
}catch(e){err('6-1-03-offer',e);}

/* ---------- 04 精英 / 词缀 / 掉落 ---------- */
try{
  const p=await fresh(b);
  const EL=`(()=>{var s=arguments0;NOVA.launch(0);G.mode='play';setSeed(s);NOVA.wave(6);
    var n=0;for(var i=0;i<600;i++){G.asteroids.length=0;NOVA.astAt(P.x+400,P.y,2);
      if(G.asteroids[0]&&G.asteroids[0].elite)n++;}return JSON.stringify({elite:n});})()`;
  const AF=`(()=>{var s=arguments0;NOVA.launch(0);G.mode='play';setSeed(s);NOVA.wave(9);
    G.enemies.length=0;NOVA.spawnAt(EN_LIST[0],P.x+300,P.y);var e=G.enemies[0];var m={};
    if(e)for(var i=0;i<600;i++){e.affix=null;e.affixC=null;applyAffix(e);
      var k=e.affix||'none';m[k]=(m[k]||0)+1;}
    return JSON.stringify(m);})()`;
  const PK=`(()=>{var s=arguments0;NOVA.launch(0);G.mode='play';setSeed(s);NOVA.wave(9);
    var m={};for(var i=0;i<400;i++){G.pickups.length=0;spawnPickup(true);
      var t=G.pickups[0]&&G.pickups[0].type;m[t]=(m[t]||0)+1;}return JSON.stringify(m);})()`;
  const g=(t,s)=>ev(p,t.replace('arguments0',String(s)));
  const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  let good=true,det=[];
  for(const [nm,t] of [['精英',EL],['词缀',AF],['掉落',PK]]){
    const a=await g(t,31337),a2=await g(t,31337),c=await g(t,8);
    const s1=eq(a,a2),s2=!eq(a,c);
    if(!s1||!s2)good=false;
    det.push(nm+(s1?'✓':'✗')+(s2?'/异✓':'/异✗'));
  }
  ok('6-1-04-spawn',good,det.join(' · '));
  await p.close();
}catch(e){err('6-1-04-spawn',e);}

/* ---------- 05 UI 全流程 ---------- */
try{
  const p=await fresh(b);
  const has=await p.locator('#btnSeed').count();
  await p.click('#btnSeed');await p.waitForTimeout(120);
  const shown=await p.locator('#seedpanel').isVisible();
  await p.click('#sdRand');
  const rv=await p.inputValue('#sdInput');
  await p.fill('#sdInput','ABC123');
  await p.click('#sdGo');await p.waitForTimeout(200);
  const hulls=await p.locator('#hulls').isVisible();
  await p.locator('#hullrow .card').first().click();
  await p.waitForTimeout(400);
  const st=await ev(p,`(()=>{return JSON.stringify({mode:G.mode,code:G.seed?seedCode(G.seed):'',pend:G.pendingSeed||0})})()`);
  ok('6-1-05-flow', has===1&&shown&&/^[0-9A-Z]{6}$/.test(rv)&&hulls&&st.mode==='play'&&st.code==='ABC123'&&st.pend===0,
     `按钮✓ 面板✓ 随机码=${rv} 机库✓ 开局 code=${st.code} mode=${st.mode} pend=${st.pend}`);
  await p.close();
}catch(e){err('6-1-05-flow',e);}

/* ---------- 06 暂停 / 结算显示种子 ---------- */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{G.pendingSeed=codeSeed('QW7Z2K');startGame(HULLS[0]);return '1'})()`);
  await p.waitForTimeout(300);
  await ev(p,`(()=>{pauseGame();return '1'})()`);
  await p.waitForTimeout(200);
  const t1=(await p.locator('#pSeed').textContent())||'';
  const v1=await p.locator('#pSeed').isVisible();
  await ev(p,`(()=>{resumeGame();G.score=12000;showOver();return '1'})()`);
  await p.waitForTimeout(250);
  const t2=(await p.locator('#overSeed').textContent())||'';
  ok('6-1-06-show', v1&&t1==='SEED · QW7Z2K'&&t2==='SEED · QW7Z2K',
     `暂停「${t1}」 结算「${t2}」`);
  await p.close();
}catch(e){err('6-1-06-show',e);}

/* ---------- 07 随机局不显示种子 ---------- */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{startGame(HULLS[0]);return '1'})()`);
  await p.waitForTimeout(300);
  await ev(p,`(()=>{pauseGame();return '1'})()`);
  await p.waitForTimeout(200);
  const hidden=await p.locator('#pSeed').isHidden();
  const seed0=await ev(p,`(()=>{return JSON.stringify({s:G.seed,on:RND.on})})()`);
  ok('6-1-07-random', hidden&&seed0.s===0&&seed0.on===false, `隐藏=${hidden} G.seed=${seed0.s} RND.on=${seed0.on}`);
  await p.close();
}catch(e){err('6-1-07-random',e);}

/* ---------- 08 每日挑战显示 DAILY 码 ---------- */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{startDaily(HULLS[0]);return '1'})()`);
  await p.waitForTimeout(350);
  await ev(p,`(()=>{pauseGame();return '1'})()`);
  await p.waitForTimeout(200);
  const t=(await p.locator('#pSeed').textContent())||'';
  const ds=await ev(p,`(()=>{return JSON.stringify({daily:G.daily?G.daily.seed:0})})()`);
  ok('6-1-08-daily', /^DAILY · \d{2}\/\d{2}$/.test(t)&&ds.daily>0, `「${t}」 daily.seed=${ds.daily}`);
  await p.close();
}catch(e){err('6-1-08-daily',e);}

/* ---------- 09 URL 直达 ---------- */
try{
  const p=await fresh(b,URL+'?seed=ZZZ999','play');
  const st=await ev(p,`(()=>{return JSON.stringify({mode:G.mode,code:G.seed?seedCode(G.seed):'',menu:document.getElementById('menu').hidden})})()`);
  ok('6-1-09-url', st.mode==='play'&&st.code==='ZZZ999'&&st.menu===true,
     `mode=${st.mode} code=${st.code} 菜单已隐藏=${st.menu}`);
  await p.close();
}catch(e){err('6-1-09-url',e);}

/* ---------- 10 成绩卡带种子（像素级证明） ---------- */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    G.pendingSeed=codeSeed('ABC123');startGame(HULLS[0]);
    G.score=5200;G.kills=33;
    var rec=boardRec(false);
    var withSeed=shareCard(rec,1).toDataURL('image/png');
    var noSeed=shareCard(Object.assign({},rec,{sd:''}),1).toDataURL('image/png');
    return JSON.stringify({sd:rec.sd,code:seedCode(G.seed),
      w:shareCard(rec,1).width,h:shareCard(rec,1).height,
      differs:withSeed!==noSeed,len:withSeed.length});})()`);
  ok('6-1-10-card', r.sd==='ABC123'&&r.sd===r.code&&r.w===1200&&r.h===630&&r.differs,
     `rec.sd=${r.sd} 卡片 ${r.w}×${r.h} 有无种子两张图不同=${r.differs}（证明真的画上去了）`);
  await p.close();
}catch(e){err('6-1-10-card',e);}

/* ---------- 11 榜单记录与渲染带种子 ---------- */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    G.pendingSeed=codeSeed('H7X2M9');startGame(HULLS[0]);G.score=8800;G.kills=41;
    var rec=boardRec(false);boardAdd(rec);renderBoard(1);
    var row=document.querySelector('#bdList .bdrow:not(.head)');
    return JSON.stringify({sd:rec.sd,bytes:JSON.stringify(rec).length,
      rowTxt:row?row.textContent:'',stored:JSON.parse(localStorage.getItem('nova-board'))[0].sd});})()`);
  ok('6-1-11-board', r.sd==='H7X2M9'&&r.stored==='H7X2M9'&&r.rowTxt.includes('H7X2M9'),
     `记录 ${r.bytes}B · sd=${r.sd} · 落盘=${r.stored} · 行文本含码=${r.rowTxt.includes('H7X2M9')}`);
  await p.close();
}catch(e){err('6-1-11-board',e);}

/* ---------- 12 i18n 中英 ---------- */
try{
  const p=await fresh(b);
  const zhBtn=(await p.locator('#btnSeed').textContent())||'';
  const zhSub=(await p.locator('#seedpanel h2 span').textContent())||'';
  await p.click('#btnLang');await p.waitForTimeout(200);
  const enBtn=(await p.locator('#btnSeed').textContent())||'';
  const enSub=(await p.locator('#seedpanel h2 span').textContent())||'';
  const enHint=(await p.locator('#seedpanel .sdhint').textContent())||'';
  /* 7.7：菜单工具排把按钮压成短芯片（「自定义种子」→「种子」），
     完整的说法仍在种子面板的副标题里 —— 所以这里芯片只比对简称。 */
  ok('6-1-12-i18n', zhBtn.includes('种子')&&enBtn.includes('SEED')&&
     zhSub.includes('同一个种子')&&enSub.includes('Same seed')&&enHint.length>20,
     `中「${zhBtn.trim()}」/ 英「${enBtn.trim()}」· 副标题「${enSub.trim()}」`);
  await p.close();
}catch(e){err('6-1-12-i18n',e);}

/* ---------- 13 旧能力回归 ---------- */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.launch(0);G.mode='play';
    return JSON.stringify({q:document.querySelectorAll('#optQuality .segb').length,
      keys:KEY_DEFS.length,slots:KEY_DEFS[0].def.length,
      board:BOARD_MAX,mods:MODULES.length,hulls:HULLS.length,
      joy:typeof joyRead,bench:typeof NOVA.bench.ops});})()`);
  ok('6-1-13-keep', r.q===4&&r.keys===12&&r.slots===2&&r.board===10&&r.mods===29&&r.hulls===7&&r.joy==='function'&&r.bench==='function',
     `画质${r.q}档 键位${r.keys}×${r.slots} 榜Top${r.board} 模块${r.mods} 船体${r.hulls} 摇杆/性能探针在`);
  await p.close();
}catch(e){err('6-1-13-keep',e);}

/* ---------- 14 竖屏适配 ---------- */
try{
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(URL);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.rng);
  await p.waitForFunction(()=>NOVA.debug('G.mode')==='menu',null,{timeout:20000}).catch(()=>{});
  await p.click('#btnSeed');await p.waitForTimeout(200);
  const r=await p.evaluate(()=>{
    const panel=document.querySelector('#seedpanel .panel').getBoundingClientRect();
    const inp=document.getElementById('sdInput').getBoundingClientRect();
    return {over:Math.max(0,panel.right-innerWidth)+Math.max(0,-panel.left),iw:Math.round(inp.width),pw:Math.round(panel.width)};
  });
  ok('6-1-14-mobile', r.over===0&&r.iw>40, `竖屏 390 溢出=${r.over}px 输入框宽=${r.iw}px 面板宽=${r.pw}px`);
  await p.close();
}catch(e){err('6-1-14-mobile',e);}

await b.close();
console.log(`\n—— 6.1 断言：${pass} 通过 / ${fail} 失败 ——`);
process.exit(fail?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)});
