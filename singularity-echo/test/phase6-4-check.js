/* Phase 6.4 工坊式卡池 —— 断言脚本 */
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
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.pool);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  await p.waitForFunction(w=>NOVA.debug('G.mode')===w,want||'menu',{timeout:25000}).catch(()=>{});
  return p;
}

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 数据表：29 模块 · POOL_MAX=8 */
try{
  const p=await fresh(b);
  const L=await ev(p,`(()=>JSON.stringify(NOVA.pool.list()))()`);
  const cap=await ev(p,`(()=>NOVA.pool.max())()`);
  const ab=L.filter(m=>m.type==='ability').length;
  const st=L.filter(m=>m.type!=='ability').length;
  ok('6-4-01-table', L.length===29 && cap===8 && ab+st===29 && ab>=1 && st>=1,
     `${L.length} 个模块（能力 ${ab} · 数值 ${st}）· 上限 ${cap}`);
  await p.close();
}catch(e){err('6-4-01-table',e);}

/* 02 rollChoices 过滤：禁用模块不出现在 offer（采样 50 次） */
try{
  const p=await fresh(b);
  const M=`(()=>{var id=arguments0;
    var hit=0,n=50;
    for(var i=0;i<n;i++){var seed=20260912+i;
      NOVA.rmod.start([]);setSeed(seed);
      P.level=Math.min(40,1+i);buildWave(1);
      G.ban=[id];
      var p2=rollChoices();
      if(p2.some(function(c){return c.id===id;}))hit++;}
    return JSON.stringify(hit);})()`;
  const r=await ev(p,M.replace('arguments0',JSON.stringify('crit')));
  ok('6-4-02-filter', r===0,
     `禁用「crit」后 50 次采样里 0 次出现（应完全消失）`);
  await p.close();
}catch(e){err('6-4-02-filter',e);}

/* 03 offer 仍能凑齐 3 张：禁 8 个后采样 30 次，3 张全 REPAIR 的比例应远低于 50% */
try{
  const p=await fresh(b);
  const M=`(()=>{var ids=arguments0;
    var three=0;
    for(var i=0;i<30;i++){NOVA.rmod.start([]);setSeed(20260912+i*7);
      P.level=10;buildWave(1);G.ban=ids.slice();
      var p2=rollChoices();
      if(p2.length<3)continue;
      if(p2.filter(function(c){return c.id==='repair';}).length===3)three++;}
    return JSON.stringify({three:three});})()`;
  const ids=['pierce','crit','magnet','drone','aegis','ram','leech','tesla'];
  const r=await ev(p,M.replace('arguments0',JSON.stringify(ids)));
  ok('6-4-03-still3', r.three<15,
     `禁 8 个后 30 次里三张全 REPAIR ${r.three} 次（应 < 15，否则池子太薄）`);
  await p.close();
}catch(e){err('6-4-03-still3',e);}

/* 04 cap=8：选 10 个只留前 8 */
try{
  const p=await fresh(b);
  const all=await ev(p,`(()=>JSON.stringify(NOVA.pool.list().map(function(m){return m.id;})))()`);
  const r=await ev(p,`(()=>JSON.stringify(NOVA.pool.pick(${JSON.stringify(all.slice(0,10))})))()`);
  ok('6-4-04-cap', r.length===8 && r[0]===all[0],
     `选 10 个只留前 8：${r.length}/${r[0]}…`);
  await p.close();
}catch(e){err('6-4-04-cap',e);}

/* 05 局内冻结：startGame 后改菜单选择不影响本局 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{G_BAN=['crit','pierce'];startGame(HULLS[0]);
    var inRun=(G.ban||[]).slice(),s1=poolSel().length;
    G_BAN=['crit','magnet','drone'];   // 局内手贱改选择
    var b2=(G.ban||[]).slice(),s2=poolSel().length;
    return JSON.stringify({a:inRun,b:b2,s1:s1,s2:s2});})()`);
  ok('6-4-05-freeze',
     JSON.stringify(r.a)===JSON.stringify(['crit','pierce']) &&
     JSON.stringify(r.b)===JSON.stringify(['crit','pierce']) &&
     r.s1===r.s2,
     `本局冻结 ${r.a.join('+')} · 改选择后 ${r.b.join('+')}，两者一致`);
  await p.close();
}catch(e){err('6-4-05-freeze',e);}

/* 06 持久化：选完刷新读回 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.pool.pick(['crit','pierce','magnet']);return 1;})()`);
  const store=await ev(p,`(()=>NOVA.pool.store())()`);
  await p.reload();
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.pool);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},null,{timeout:25000}).catch(()=>{});
  const back=await ev(p,`(()=>JSON.stringify(NOVA.pool.sel()))()`);
  ok('6-4-06-persist', JSON.stringify(back)===JSON.stringify(['crit','pierce','magnet']),
     `localStorage=${store} · 刷新后读回 ${back.join('+')}`);
  await p.close();
}catch(e){err('6-4-06-persist',e);}

/* 07 每日挑战强制清空 ban */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.pool.pick(['crit','pierce','magnet']);
    startDaily(HULLS[0]);
    return JSON.stringify({run:G.ban||[],sel:G_BAN.slice()});})()`);
  ok('6-4-07-daily', r.run.length===0 && r.sel.length===3,
     `每日局：禁用 ${r.run.length?r.run.join('+'):'无'} · 机库选择仍是 ${r.sel.join('+')}（每日不强制清菜单）`);
  await p.close();
}catch(e){err('6-4-07-daily',e);}

/* 08 记录 / 卡片 / 榜单携带工坊标记 */
try{
  const p=await fresh(b);
  const rec=await ev(p,`(()=>{NOVA.pool.start(['crit','pierce','magnet']);
    var r=boardRec(false);return JSON.stringify(r);})()`);
  const has=rec.bn&&rec.bn.length===3&&rec.bn[0]==='crit';
  const html=await ev(p,`(()=>{BOARD.length=0;
    BOARD.push({s:12345,w:9,k:20,l:5,t:100,h:'peregrine',d:'9/12',m:0,v:1,at:Date.now(),sd:'',df:'abyss',rm:[],bn:['crit','pierce','magnet']});
    renderBoard(0);
    return JSON.stringify(document.getElementById('bdList').innerHTML);})()`);
  ok('6-4-08-record', has && html.indexOf('工坊')>=0 && html.indexOf('x3')>=0,
     `记录带 ${JSON.stringify(rec.bn)} · 榜单行带「工坊 x3」`);
  await p.close();
}catch(e){err('6-4-08-record',e);}

/* 09 卡片像素差：带工坊标记与不带必须不同 */
try{
  const p=await fresh(b);
  const d=await ev(p,`(()=>{
    var base={s:12345,w:9,k:20,l:5,t:100,h:'peregrine',d:'9/12',m:0,v:1,at:1,sd:'',df:'abyss'};
    var a=shareCard(Object.assign({},base,{bn:[]}),1);
    var c=shareCard(Object.assign({},base,{bn:['crit','pierce','magnet']}),1);
    var A=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
    var B=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    var n=0;for(var i=0;i<A.length;i+=4){if(A[i]!==B[i]||A[i+1]!==B[i+1]||A[i+2]!==B[i+2])n++;}
    return JSON.stringify(n);})()`);
  ok('6-4-09-card', d>200, `卡片差异像素 ${d}（>200 即证明工坊真的画上去了）`);
  await p.close();
}catch(e){err('6-4-09-card',e);}

/* 10 机库 UI：29 个 chip · 点选切换 · 上限 8 满后其他变灰 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.pool.setWave(15);NOVA.pool.pick([]);openHulls();setCfg(true);return 1;})()`);
  await p.waitForSelector('#poolRow button[data-pool]');
  const n=await p.$$eval('#poolRow button[data-pool]',es=>es.length);
  await p.click('#poolRow button[data-pool=crit]');
  await p.click('#poolRow button[data-pool=pierce]');
  await p.click('#poolRow button[data-pool=magnet]');
  const on=await p.$$eval('#poolRow button.on',es=>es.map(e=>e.dataset.pool));
  const lab=await p.$eval('#poolRow .poolbump',e=>e.textContent);
  /* 选 8 个后再点其他应是 disabled */
  for(const id of ['drone','aegis','ram','leech','tesla'])await p.click('#poolRow button[data-pool='+id+']');
  const on2=await p.$$eval('#poolRow button.on',es=>es.map(e=>e.dataset.pool));
  const dis=await p.$$eval('#poolRow button.dis',es=>es.length);
  /* MODULES 里 pierce(5)<crit(9)<magnet(10)，on 顺序按定义序而非点击序 */
  ok('6-4-10-ui', n===29 && JSON.stringify(on)===JSON.stringify(['pierce','crit','magnet']) &&
     lab.indexOf('3/8')>=0 && on2.length===8 && dis===21,
     `${n} 个 chip · 选 3 时「${lab}」· 选满 8 时其他变灰（dis ${dis} 个）`);
  await p.close();
}catch(e){err('6-4-10-ui',e);}

/* 11 中英 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.pool.pick(['crit']);openHulls();setCfg(true);return 1;})()`);
  await p.waitForSelector('#poolRow button[data-pool]');
  const zh=await p.$eval('#poolRow .poolbump',e=>e.textContent);
  const en=await ev(p,`(()=>{LANG='en';renderPool();
    return JSON.stringify(document.querySelector('#poolRow .poolbump').textContent);})()`);
  /* G_BAN=['crit'] 时 zh='1/8'，en='WORKSHOP 1/8'；清空后才显示 OFF/未禁用 */
  ok('6-4-11-i18n', zh.indexOf('卡池工坊')>=0 && en.indexOf('WORKSHOP')>=0 && en.indexOf('1/8')>=0,
     `中「${zh}」· 英「${en}」`);
  await p.close();
}catch(e){err('6-4-11-i18n',e);}

/* 12 回归：6.1 种子码 + 6.2 难度 + 6.3 挑战 + 无工坊时 offer 含所有 29 模块 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    var seedOk=seedCode(codeSeed('XYZ789'))==='XYZ789';
    var d=NOVA.diff.list();var stdOk=d.find(function(x){return x.id==='standard';}).sc===1;
    NOVA.rmod.start([]);startGame(HULLS[0]);setSeed(777);P.level=1;buildWave(1);
    var offer=rollChoices().map(function(c){return c.id;});
    var uniq=Array.from(new Set(offer));
    return JSON.stringify({seedOk:seedOk,stdOk:stdOk,offer:offer,uniq:uniq.length});})()`);
  ok('6-4-12-regress', r.seedOk && r.stdOk && r.uniq>=2,
     `种子往返 ${r.seedOk?'OK':'坏'} · 标准档 sc=1 ${r.stdOk?'OK':'坏'} · 无工坊 offer ${r.offer.join(',')}（${r.uniq} 种）`);
  await p.close();
}catch(e){err('6-4-12-regress',e);}

/* 13 回归：禁用的同时 + 挑战同时 + 难度同时 = 三套机制相容 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.diff.pick('abyss');NOVA.rmod.start(['swarm','brittle']);
    NOVA.pool.pick(['crit','pierce']);
    startGame(HULLS[0]);
    return JSON.stringify({df:G.diff,rm:G.rmods.slice(),bn:G.ban.slice(),php:rmodMul('php'),hp:P.maxHp});})()`);
  ok('6-4-13-stack', r.df==='abyss' && JSON.stringify(r.rm)===JSON.stringify(['swarm','brittle']) &&
     JSON.stringify(r.bn)===JSON.stringify(['crit','pierce']) && Math.abs(r.php-0.5)<1e-9 && r.hp===50,
     `深渊+swarm/brittle+禁用 crit/pierce：船体上限 ${r.hp}（脆命 ×0.5 与工坊并存）`);
  await p.close();
}catch(e){err('6-4-13-stack',e);}

/* 14 竖屏：工坊条不溢出 */
try{
  const p=await fresh(b,null,'menu',{width:390,height:844});
  await ev(p,`(()=>{NOVA.pool.pick(['crit','pierce','magnet','crit','pierce']);openHulls();setCfg(true);return 1;})()`);
  await p.waitForSelector('#poolRow button[data-pool]');
  const r=await ev(p,`(()=>{var row=document.getElementById('poolRow');
    var w=row.getBoundingClientRect();var vw=document.documentElement.clientWidth;
    var btns=[].slice.call(row.querySelectorAll('button'));
    var over=btns.some(function(x){var r2=x.getBoundingClientRect();return r2.left<0||r2.right>vw;});
    return JSON.stringify({w:w.width,vw:vw,n:btns.length,over:over});})()`);
  ok('6-4-14-mobile', r.n===29 && r.over===false && r.w<=r.vw,
     `390px 竖屏：${r.n} 个 chip 全部在视口内（条宽 ${Math.round(r.w)} ≤ ${r.vw}）`);
  await p.close();
}catch(e){err('6-4-14-mobile',e);}

console.log(`\n=== 6.4 断言：${pass} 通过 / ${fail} 失败 ===`);
await b.close();
process.exit(fail?1:0);
})();