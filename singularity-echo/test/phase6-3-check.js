/* Phase 6.3 自定义挑战（Modifier 组合）—— 断言脚本 */
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
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.rmod);
  // boot 分帧异步：必须等 #boot 真正收尾，否则依赖 boot 末段赋值（rmodLoad）的用例读到旧值
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  await p.waitForFunction(w=>NOVA.debug('G.mode')===w,want||'menu',{timeout:25000}).catch(()=>{});
  return p;
}
/* 起一局并冻结指定挑战组合，返回测量表达式 */
const RUN=(ids)=>`(()=>{NOVA.rmod.start(${JSON.stringify(ids||[])});return 1;})()`;

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 数据表：5 个 · 最多 3 个 · 解锁门槛 */
try{
  const p=await fresh(b);
  const L=await ev(p,`(()=>JSON.stringify(NOVA.rmod.list()))()`);
  const cap=await ev(p,`(()=>NOVA.rmod.max())()`);
  const g=id=>L.find(m=>m.id===id);
  ok('6-3-01-table',
     L.length===5 && cap===3 &&
     g('swarm').cnt>1 && g('swarm').hp<1 &&
     g('bulwark').hp>1 && g('bulwark').spd<1 &&
     g('gale').spd>1 && g('gale').dmg>1 &&
     g('barren').pk>1 &&
     g('brittle').php<1 &&
     g('brittle').sc>g('barren').sc && g('brittle').req===15 &&
     g('swarm').req===0 && g('bulwark').req===0,
     `5 个 · 上限 3 · 蜂群 数量×${g('swarm').cnt}/血×${g('swarm').hp} · 铁壁 血×${g('bulwark').hp}/速×${g('bulwark').spd} · 疾风 速×${g('gale').spd}/伤×${g('gale').dmg} · 荒芜 补给间隔×${g('barren').pk} · 脆命 船体×${g('brittle').php} 得分+${g('brittle').sc}`);
  await p.close();
}catch(e){err('6-3-01-table',e);}

/* 02 蜂群：数量↑ 单体血↓ */
try{
  const p=await fresh(b);
  const M=`(()=>{NOVA.rmod.start(arguments0);G.mode='play';setSeed(20260912);buildWave(8);
    var q=(NOVA.q().e||[]).length;
    setSeed(777);G.enemies.length=0;NOVA.spawnAt(EN_LIST[3],P.x+300,P.y);
    return JSON.stringify({n:q,hp:G.enemies[0].hp});})()`;
  const m=async ids=>ev(p,M.replace('arguments0',JSON.stringify(ids)));
  const a=await m([]),s=await m(['swarm']);
  const rn=s.n/a.n, rh=s.hp/a.hp;
  ok('6-3-02-swarm', s.n>a.n && rn>1.2 && rn<1.7 && Math.abs(rh-0.8)<0.02,
     `第 8 波队列 ${a.n} → ${s.n}（×${rn.toFixed(2)}）· 单体血 ${a.hp.toFixed(1)} → ${s.hp.toFixed(1)}（×${rh.toFixed(2)}）`);
  await p.close();
}catch(e){err('6-3-02-swarm',e);}

/* 03 铁壁：血↑↑ 速↓ */
try{
  const p=await fresh(b);
  const M=`(()=>{NOVA.rmod.start(arguments0);G.mode='play';setSeed(777);
    G.enemies.length=0;NOVA.spawnAt(EN_LIST[7],P.x+300,P.y);   /* EN_LIST[3] 没有 spd 字段 */
    var e=G.enemies[0];return JSON.stringify({hp:e.hp,spd:e.spd||0});})()`;
  const m=async ids=>ev(p,M.replace('arguments0',JSON.stringify(ids)));
  const a=await m([]),s=await m(['bulwark']);
  const rh=s.hp/a.hp, rs=s.spd/a.spd;
  ok('6-3-03-bulwark', Math.abs(rh-1.7)<0.09 && Math.abs(rs-0.85)<0.02,
     `血 ×${rh.toFixed(2)}（应 1.70）· 速 ×${rs.toFixed(2)}（应 0.85）`);
  await p.close();
}catch(e){err('6-3-03-bulwark',e);}

/* 04 疾风：速↑ 伤↑ */
try{
  const p=await fresh(b);
  const M=`(()=>{NOVA.rmod.start(arguments0);G.mode='play';setSeed(777);
    G.enemies.length=0;NOVA.spawnAt(EN_LIST[7],P.x+300,P.y);   /* EN_LIST[3] 没有 spd 字段 */
    var e=G.enemies[0];
    P.invuln=0;P.ram=0;P.shield=0;P.shieldTmp=0;var h0=P.hp;hurtPlayer(20,P.x+10,P.y);
    return JSON.stringify({spd:e.spd||0,lost:h0-P.hp});})()`;
  const m=async ids=>ev(p,M.replace('arguments0',JSON.stringify(ids)));
  const a=await m([]),s=await m(['gale']);
  const rs=s.spd/a.spd, rd=s.lost/a.lost;
  ok('6-3-04-gale', Math.abs(rs-1.35)<0.03 && Math.abs(rd-1.15)<0.02,
     `速 ×${rs.toFixed(2)}（应 1.35）· 承伤 ×${rd.toFixed(2)}（应 1.15）`);
  await p.close();
}catch(e){err('6-3-04-gale',e);}

/* 05 荒芜：补给刷新间隔 ×2.2（取 30 次采样的最小值，避开 rand(7,12) 抖动） */
try{
  const p=await fresh(b);
  const M=`(()=>{NOVA.rmod.start(arguments0);G.mode='play';
    var mn=1e9;for(var i=0;i<30;i++){G.pickT=0;updatePickups(0.0001);if(G.pickT<mn)mn=G.pickT;}
    return JSON.stringify(mn);})()`;
  const m=async ids=>ev(p,M.replace('arguments0',JSON.stringify(ids)));
  const a=await m([]),s=await m(['barren']);
  ok('6-3-05-barren', a>=7 && a<12 && s>=15 && s<27,
     `补给间隔最小采样 ${a.toFixed(2)} → ${s.toFixed(2)}（×${(s/a).toFixed(2)}，应约 2.2）`);
  await p.close();
}catch(e){err('6-3-05-barren',e);}

/* 06 脆命：船体上限 ×0.5（必须在 hull.apply + 局外加成之后生效） */
try{
  const p=await fresh(b);
  const M=`(()=>{NOVA.rmod.start(arguments0);var r={max:P.maxHp,hp:P.hp};return JSON.stringify(r);})()`;
  const m=async ids=>ev(p,M.replace('arguments0',JSON.stringify(ids)));
  const a=await m([]),s=await m(['brittle']);
  ok('6-3-06-brittle', Math.abs(s.max-a.max*0.5)<=1 && s.hp===s.max,
     `船体上限 ${a.max} → ${s.max}（×${(s.max/a.max).toFixed(2)}，应 0.50）`);
  await p.close();
}catch(e){err('6-3-06-brittle',e);}

/* 07 组合相乘：蜂群+铁壁 = 数量×1.45 且 血量×1.36（不是取其一） */
try{
  const p=await fresh(b);
  const M=`(()=>{NOVA.rmod.start(arguments0);G.mode='play';setSeed(20260912);buildWave(8);
    var q=(NOVA.q().e||[]).length;
    setSeed(777);G.enemies.length=0;NOVA.spawnAt(EN_LIST[3],P.x+300,P.y);
    return JSON.stringify({n:q,hp:G.enemies[0].hp});})()`;
  const m=async ids=>ev(p,M.replace('arguments0',JSON.stringify(ids)));
  const a=await m([]),s=await m(['swarm','bulwark']);
  const rh=s.hp/a.hp;
  ok('6-3-07-stack', s.n>a.n && Math.abs(rh-0.8*1.7)<0.09,
     `蜂群+铁壁：队列 ${a.n} → ${s.n} · 血 ×${rh.toFixed(2)}（应 0.8×1.7=1.36，证明是相乘不是覆盖）`);
  await p.close();
}catch(e){err('6-3-07-stack',e);}

/* 08 得分：挑战加成累加 · 与难度档相乘 */
try{
  const p=await fresh(b);
  const S=`(()=>{var A=arguments0;NOVA.diff.pick(A.d);NOVA.rmod.start(A.m);
    G.score=0;addScore(1000);return JSON.stringify(Math.round(G.score));})()`;
  const s=async(d,m)=>ev(p,S.replace('arguments0',JSON.stringify({d:d,m:m})));
  const b0=await s('standard',[]);
  const s1=await s('standard',['swarm']);
  const s2=await s('standard',['swarm','bulwark']);
  const s3=await s('standard',['swarm','bulwark','gale']);
  const ab=await s('abyss',['swarm']);
  ok('6-3-08-score', b0===1000&&s1===1300&&s2===1650&&s3===2000&&ab===1820,
     `加 1000 → 无 ${b0} · 蜂群 ${s1} · +铁壁 ${s2} · +疾风 ${s3}（累加不连乘）· 深渊+蜂群 ${ab}=1000×1.4×1.30`);
  await p.close();
}catch(e){err('6-3-08-score',e);}

/* 09 最多 3 个 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>JSON.stringify(NOVA.rmod.pick(['swarm','bulwark','gale','barren'])))()`);
  ok('6-3-09-cap', r.length===3 && r[0]==='swarm' && r[2]==='gale',
     `选 4 个只留 3 个：${r.join('+')}`);
  await p.close();
}catch(e){err('6-3-09-cap',e);}

/* 10 局内冻结：开局后改菜单选择不影响本局 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{G_RMODS=['swarm','gale'];startGame(HULLS[0]);
    var a=(G.rmods||[]).slice(),m1=rmodMul('cnt'),s1=rmodSc();
    G_RMODS=['bulwark','brittle','barren'];   // 局内手贱改选择
    var b2=(G.rmods||[]).slice(),m2=rmodMul('cnt'),s2=rmodSc();
    return JSON.stringify({a:a,b:b2,m1:m1,m2:m2,s1:s1,s2:s2});})()`);
  ok('6-3-10-freeze',
     JSON.stringify(r.a)===JSON.stringify(['swarm','gale']) &&
     JSON.stringify(r.b)===JSON.stringify(['swarm','gale']) &&
     r.m1===r.m2 && r.s1===r.s2 && Math.abs(r.m1-1.45)<1e-9,
     `本局锁定 ${r.a.join('+')} · 数量×${r.m1} · 得分×${r.s1.toFixed(2)}，改选择后三者均不变`);
  await p.close();
}catch(e){err('6-3-10-freeze',e);}

/* 11 解锁门槛：脆命需 15 波 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.rmod.setWave(0);return 1;})()`);
  const l0=['gale','barren','brittle'].map(id=>null);
  const a=await ev(p,`(()=>JSON.stringify({g:NOVA.rmod.unlocked('gale'),b:NOVA.rmod.unlocked('barren'),x:NOVA.rmod.unlocked('brittle'),s:NOVA.rmod.unlocked('swarm')}))()`);
  await ev(p,`(()=>{NOVA.rmod.setWave(15);return 1;})()`);
  const c=await ev(p,`(()=>JSON.stringify({g:NOVA.rmod.unlocked('gale'),b:NOVA.rmod.unlocked('barren'),x:NOVA.rmod.unlocked('brittle')}))()`);
  ok('6-3-11-unlock', a.s===true && a.g===false && a.x===false && c.g===true && c.b===true && c.x===true,
     `0 波时 蜂群✓ 疾风✗ 脆命✗；15 波后 疾风✓ 荒芜✓ 脆命✓`);
  await p.close();
}catch(e){err('6-3-11-unlock',e);}

/* 12 持久化：选完刷新还在 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.rmod.setWave(15);NOVA.rmod.pick(['gale','brittle']);return 1;})()`);
  const store=await ev(p,`(()=>NOVA.rmod.store())()`);
  await p.reload();
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.rmod);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},null,{timeout:25000}).catch(()=>{});
  const back=await ev(p,`(()=>JSON.stringify(NOVA.rmod.sel()))()`);
  ok('6-3-12-persist', JSON.stringify(back)===JSON.stringify(['gale','brittle']),
     `localStorage=${store} · 刷新后读回 ${back.join('+')}`);
  await p.close();
}catch(e){err('6-3-12-persist',e);}

/* 13 每日挑战一律不带 Modifier（保证同日可比） */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.rmod.setWave(15);NOVA.rmod.pick(['swarm','brittle']);
    startDaily(HULLS[0]);
    return JSON.stringify({run:G.rmods||[],sc:rmodSc(),df:G.diff});})()`);
  ok('6-3-13-daily', r.run.length===0 && r.sc===1 && r.df==='standard',
     `每日局：挑战 ${r.run.length?r.run.join('+'):'无'} · 得分系数 ×${r.sc} · 难度 ${r.df}`);
  await p.close();
}catch(e){err('6-3-13-daily',e);}

/* 14 记录 / 榜单 / 卡片携带挑战标记 */
try{
  const p=await fresh(b);
  const rec=await ev(p,`(()=>{NOVA.rmod.start(['swarm','brittle']);
    var r=boardRec(false);return JSON.stringify(r);})()`);
  const has=rec.rm&&rec.rm.length===2&&rec.rm[0]==='swarm';
  const html=await ev(p,`(()=>{BOARD.length=0;
    BOARD.push({s:12345,w:9,k:20,l:5,t:100,h:'peregrine',d:'9/11',m:0,v:0,at:Date.now(),sd:'ABC123',df:'abyss',rm:['swarm','brittle']});
    renderBoard(0);
    return JSON.stringify(document.getElementById('bdList').innerHTML);})()`);
  ok('6-3-14-record', has && html.indexOf('蜂群')>=0 && html.indexOf('脆命')>=0 && html.indexOf('深渊')>=0,
     `记录带 ${JSON.stringify(rec.rm)} · 榜单行「…深渊 · 蜂群+脆命」`);
  await p.close();
}catch(e){err('6-3-14-record',e);}

/* 15 卡片像素差：带挑战标记与不带必须画得不一样 */
try{
  const p=await fresh(b);
  const d=await ev(p,`(()=>{
    var base={s:12345,w:9,k:20,l:5,t:100,h:'peregrine',d:'9/11',m:0,v:1,at:1,sd:'',df:'abyss'};
    var a=shareCard(Object.assign({},base,{rm:[]}),1);
    var c=shareCard(Object.assign({},base,{rm:['swarm','brittle']}),1);
    var A=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
    var B=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    var n=0;for(var i=0;i<A.length;i+=4){if(A[i]!==B[i]||A[i+1]!==B[i+1]||A[i+2]!==B[i+2])n++;}
    return JSON.stringify(n);})()`);
  ok('6-3-15-card', d>200, `卡片差异像素 ${d}（>200 即证明标记真的画上去了）`);
  await p.close();
}catch(e){err('6-3-15-card',e);}

/* 16 机库 UI：5 个按钮 · 点选高亮 · 倍率文案实时更新 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.rmod.setWave(15);NOVA.rmod.pick([]);openHulls();setCfg(true);return 1;})()`);
  await p.waitForSelector('#rmodRow button[data-rmod]');
  const n=await p.$$eval('#rmodRow button[data-rmod]',es=>es.length);
  const t0=await p.$eval('#rmodRow .rmodbump',e=>e.textContent);
  await p.click('#rmodRow button[data-rmod=gale]');
  await p.click('#rmodRow button[data-rmod=brittle]');
  const on=await p.$$eval('#rmodRow button.on',es=>es.map(e=>e.dataset.rmod));
  const t1=await p.$eval('#rmodRow .rmodbump',e=>e.textContent);
  await p.click('#rmodRow button[data-rmod=gale]');
  const on2=await p.$$eval('#rmodRow button.on',es=>es.map(e=>e.dataset.rmod));
  ok('6-3-16-ui', n===5 && JSON.stringify(on)===JSON.stringify(['gale','brittle']) &&
     t0.indexOf('未启用')>=0 && t1.indexOf('1.95')>=0 && JSON.stringify(on2)===JSON.stringify(['brittle']),
     `${n} 个按钮 · 选中 ${on.join('+')} 时条上「${t1}」· 再点疾风取消 → ${on2.join('+')||'无'}`);
  await p.close();
}catch(e){err('6-3-16-ui',e);}

/* 17 中英 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.rmod.setWave(15);NOVA.rmod.pick(['swarm']);openHulls();setCfg(true);return 1;})()`);
  await p.waitForSelector('#rmodRow button[data-rmod]');
  const zh=await p.$eval('#rmodRow button[data-rmod=brittle]',e=>e.textContent);
  const zhl=await p.$eval('#rmodRow .rmodbump',e=>e.textContent);
  const en=await ev(p,`(()=>{LANG='en';renderRmods();
    var b=document.querySelector('#rmodRow button[data-rmod=brittle]');
    return JSON.stringify({n:b.textContent,l:document.querySelector('#rmodRow .rmodbump').textContent});})()`);
  ok('6-3-17-i18n', zh.indexOf('脆命')>=0 && en.n.indexOf('BRITTLE')>=0 &&
     zhl.indexOf('自定义挑战')>=0 && en.l.indexOf('CHALLENGE')>=0,
     `中「${zh} / ${zhl}」· 英「${en.n} / ${en.l}」`);
  await p.close();
}catch(e){err('6-3-17-i18n',e);}

/* 18 回归：6.1 种子 + 6.2 难度仍然正确，且无挑战时行为与 6.2 完全一致 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var a=seedCode(codeSeed('ABC123'));
    var d=NOVA.diff.list();var g=i=>d.find(x=>x.id===i);
    var st=(function(){G_DIFF='standard';NOVA.rmod.pick([]);startGame(HULLS[0]);G.score=0;addScore(1000);var v=G.score;
      var h0=P.maxHp;NOVA.rmod.pick(['brittle']);startGame(HULLS[0]);var h1=P.maxHp;
      return {v:v,h0:h0,h1:h1};})();
    return JSON.stringify({code:a,
      mono:g('cruise').hp<g('standard').hp&&g('standard').hp<g('abyss').hp&&g('standard').sc===1,
      sc:st.v,h0:st.h0,h1:st.h1});})()`);
  ok('6-3-18-regress', r.code==='ABC123' && r.mono===true && r.sc===1000 && Math.abs(r.h1-r.h0*0.5)<=1,
     `种子码往返 ${r.code} · 难度表单调且标准=1 · 无挑战时加 1000 得 ${r.sc}（与 6.2 一致）· 脆命船体 ${r.h0}→${r.h1}`);
  await p.close();
}catch(e){err('6-3-18-regress',e);}

/* 19 竖屏：挑战条不溢出 */
try{
  const p=await fresh(b,null,'menu',{width:390,height:844});
  await ev(p,`(()=>{NOVA.rmod.setWave(15);NOVA.rmod.pick(['swarm','gale','brittle']);openHulls();setCfg(true);return 1;})()`);
  await p.waitForSelector('#rmodRow button[data-rmod]');
  const r=await ev(p,`(()=>{var row=document.getElementById('rmodRow');
    var b=row.getBoundingClientRect();var w=document.documentElement.clientWidth;
    var btns=[].slice.call(row.querySelectorAll('button'));
    var over=btns.some(x=>{var r2=x.getBoundingClientRect();return r2.left<0||r2.right>w;});
    return JSON.stringify({w:b.width,vw:w,n:btns.length,over:over});})()`);
  ok('6-3-19-mobile', r.n===5 && r.over===false && r.w<=r.vw,
     `390px 竖屏：${r.n} 个按钮全部在视口内（条宽 ${Math.round(r.w)} ≤ ${r.vw}）`);
  await p.close();
}catch(e){err('6-3-19-mobile',e);}

console.log(`\n=== 6.3 断言：${pass} 通过 / ${fail} 失败 ===`);
await b.close();
process.exit(fail?1:0);
})();
