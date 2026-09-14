/* Phase 6.2 难度档 —— 断言脚本 */
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const URL=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail=0,pass=0;
const ok=(n,c,d='')=>{if(c)pass++;else fail++;console.log((c?'ok  PASS ':'FAIL     ')+n+(d?'  '+d:''));};
const err=(n,e)=>{fail++;console.log('ERR      '+n+'  '+e.message);};
const ev=async(p,code)=>JSON.parse(await p.evaluate(c=>NOVA.debug(c),code));

async function fresh(b,url,want){
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(url||URL);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.diff);
  // boot 分帧异步，过程中 G.mode 本来就 = 'menu' —— 必须等 boot 真正收尾（#boot 隐藏），
  // 否则「刷新后读回难度」这类依赖 boot 末段赋值的用例会读到旧值（6.1 踩过同一个坑）。
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  await p.waitForFunction(w=>NOVA.debug('G.mode')===w,want||'menu',{timeout:25000}).catch(()=>{});
  return p;
}

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 数据表：三档 + 系数单调 */
try{
  const p=await fresh(b);
  const L=await ev(p,`(()=>{return JSON.stringify(NOVA.diff.list())})()`);
  const g=id=>L.find(d=>d.id===id);
  const mono=(k)=>g('cruise')[k]<g('standard')[k]&&g('standard')[k]<g('abyss')[k];
  ok('6-2-01-table', L.length===3&&mono('hp')&&mono('dmg')&&mono('cnt')&&mono('sc')&&
     g('standard').hp===1&&g('standard').sc===1&&g('abyss').req===15,
     `三档 hp ${g('cruise').hp}/${g('standard').hp}/${g('abyss').hp} · dmg ${g('cruise').dmg}/${g('standard').dmg}/${g('abyss').dmg} · 数量 ${g('cruise').cnt}/${g('standard').cnt}/${g('abyss').cnt} · 得分 ${g('cruise').sc}/${g('standard').sc}/${g('abyss').sc} · 标准档=1 深渊需 15 波`);
  await p.close();
}catch(e){err('6-2-01-table',e);}

/* 02 敌人三围随难度变化 */
try{
  const p=await fresh(b);
  const M=`(()=>{var id=arguments0;
    G_DIFF=id;startGame(HULLS[0]);G.mode='play';buildWave(10);
    G.enemies.length=0;NOVA.spawnAt(EN_LIST[3],P.x+300,P.y);
    var e=G.enemies[0];
    return JSON.stringify({hp:e.hp,dmg:e.dmg,spd:e.spd||0});})()`;
  const m=async id=>ev(p,M.replace('arguments0',JSON.stringify(id)));
  const c=await m('cruise'),s=await m('standard'),a=await m('abyss');
  ok('6-2-02-stats', c.hp<s.hp&&s.hp<a.hp&&c.dmg<s.dmg&&s.dmg<a.dmg,
     `hp ${c.hp.toFixed(1)} < ${s.hp.toFixed(1)} < ${a.hp.toFixed(1)} · dmg ${c.dmg.toFixed(2)} < ${s.dmg.toFixed(2)} < ${a.dmg.toFixed(2)}`);
  await p.close();
}catch(e){err('6-2-02-stats',e);}

/* 03 承伤随难度变化（走 hurtPlayer 唯一入口） */
try{
  const p=await fresh(b);
  const H=`(()=>{var id=arguments0;
    G_DIFF=id;startGame(HULLS[0]);G.mode='play';
    P.invuln=0;P.ram=0;P.shield=0;P.shieldTmp=0;
    var h0=P.hp;hurtPlayer(20,P.x+10,P.y);
    return JSON.stringify({lost:h0-P.hp});})()`;
  const h=async id=>ev(p,H.replace('arguments0',JSON.stringify(id)));
  const c=await h('cruise'),s=await h('standard'),a=await h('abyss');
  ok('6-2-03-taken', c.lost<s.lost&&s.lost<a.lost&&Math.abs(s.lost-20)<0.01,
     `同样 20 点伤害：巡航扣 ${c.lost.toFixed(1)} · 标准扣 ${s.lost.toFixed(1)} · 深渊扣 ${a.lost.toFixed(1)}`);
  await p.close();
}catch(e){err('6-2-03-taken',e);}

/* 04 每波敌人数量随难度变化 */
try{
  const p=await fresh(b);
  const N=`(()=>{var id=arguments0;
    /* 必须固定种子：编队主题 sq 是随机的，sq.s 一变总数就变，
       不固定会量出「巡航比标准还多」这种假象 */
    G_DIFF=id;startGame(HULLS[0]);G.mode='play';setSeed(20260912);buildWave(14);
    return JSON.stringify({n:(NOVA.q().e||[]).length});})()`;
  const n=async id=>ev(p,N.replace('arguments0',JSON.stringify(id)));
  const c=await n('cruise'),s=await n('standard'),a=await n('abyss');
  ok('6-2-04-count', c.n<s.n&&s.n<a.n, `第 14 波队列：巡航 ${c.n} < 标准 ${s.n} < 深渊 ${a.n}`);
  await p.close();
}catch(e){err('6-2-04-count',e);}

/* 05 得分系数 */
try{
  const p=await fresh(b);
  const S=`(()=>{var id=arguments0;G_DIFF=id;startGame(HULLS[0]);G.mode='play';
    G.score=0;addScore(1000);return JSON.stringify(G.score);})()`;
  const s=async id=>ev(p,S.replace('arguments0',JSON.stringify(id)));
  const c=await s('cruise'),st=await s('standard'),a=await s('abyss');
  ok('6-2-05-score', c===800&&st===1000&&a===1400, `同样加 1000 → 巡航 ${c} / 标准 ${st} / 深渊 ${a}`);
  await p.close();
}catch(e){err('6-2-05-score',e);}

/* 06 开局后锁定本局难度 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{G_DIFF='abyss';startGame(HULLS[0]);G.mode='play';
    var before=diffNow().id;G_DIFF='cruise';var after=diffNow().id;
    return JSON.stringify({run:G.diff,before:before,after:after});})()`);
  ok('6-2-06-lock', r.run==='abyss'&&r.before==='abyss'&&r.after==='abyss',
     `开局后改 G_DIFF → 本局仍是 ${r.after}（数值不许中途变）`);
  await p.close();
}catch(e){err('6-2-06-lock',e);}

/* 07 解锁门槛 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.diff.setWave(3);
    var low=NOVA.diff.unlocked('abyss'),lowC=NOVA.diff.unlocked('cruise');
    NOVA.diff.setWave(20);
    var high=NOVA.diff.unlocked('abyss');
    return JSON.stringify({low:low,lowC:lowC,high:high});})()`);
  ok('6-2-07-unlock', r.low===false&&r.high===true&&r.lowC===true,
     `最佳波次 3 → 深渊锁=${!r.low}（巡航仍可选=${r.lowC}）；最佳波次 20 → 深渊开=${r.high}`);
  await p.close();
}catch(e){err('6-2-07-unlock',e);}

/* 08 选择持久化 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.diff.setWave(20);NOVA.diff.pick('abyss');return '1'})()`);
  const st=await ev(p,`(()=>{return JSON.stringify(localStorage.getItem('nova-diff'))})()`);
  await p.reload();
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.diff);
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  await p.waitForFunction(()=>NOVA.debug('G.mode')==='menu',null,{timeout:25000}).catch(()=>{});
  const after=await ev(p,`(()=>{return JSON.stringify({sel:NOVA.diff.sel(),store:localStorage.getItem('nova-diff')})})()`);
  ok('6-2-08-persist', st==='abyss'&&after.sel==='abyss'&&after.store==='abyss',
     `写入「${st}」→ 刷新后读回「${after.sel}」`);
  await p.close();
}catch(e){err('6-2-08-persist',e);}

/* 09 UI：机库里三档可选、当前高亮 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.diff.setWave(20);return '1'})()`);
  await p.click('#btnLaunch');await p.waitForTimeout(250);
  const n=await p.locator('#diffRow .dif').count();
  const on=(await p.locator('#diffRow .dif.on').textContent())||'';
  await p.locator('#diffRow .dif').nth(2).click();
  await p.waitForTimeout(150);
  const on2=(await p.locator('#diffRow .dif.on').textContent())||'';
  const sel=await ev(p,`(()=>{return JSON.stringify(NOVA.diff.sel())})()`);
  ok('6-2-09-ui', n===3&&on.includes('标准')&&on2.includes('深渊')&&sel==='abyss',
     `按钮 ${n} 个 · 默认高亮「${on.trim()}」→ 点第三个后「${on2.trim()}」· G_DIFF=${sel}`);
  await p.close();
}catch(e){err('6-2-09-ui',e);}

/* 10 每日挑战固定标准 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{NOVA.diff.setWave(20);G_DIFF='abyss';startDaily(HULLS[0]);
    return JSON.stringify({run:G.diff,now:diffNow().id,daily:!!G.daily});})()`);
  ok('6-2-10-daily', r.daily===true&&r.run==='standard'&&r.now==='standard',
     `每日挑战里 G.diff=${r.run}（同日可比，不随玩家选择浮动）`);
  await p.close();
}catch(e){err('6-2-10-daily',e);}

/* 11 记录 / 卡片 / 榜单带难度 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.diff.setWave(20);G_DIFF='abyss';startGame(HULLS[0]);G.score=10000;G.kills=50;G.runT=200;
    var rec=boardRec(false);boardAdd(rec);renderBoard(1);
    var row=document.querySelector('#bdList .bdrow:not(.head)');
    var card=shareCard(rec,1);
    var plain=shareCard(Object.assign({},rec,{df:'standard'}),1);
    return JSON.stringify({df:rec.df,row:row?row.textContent:'',
      stored:JSON.parse(localStorage.getItem('nova-board'))[0].df,
      differs:card.toDataURL('image/png')!==plain.toDataURL('image/png')});})()`);
  ok('6-2-11-record', r.df==='abyss'&&r.stored==='abyss'&&r.row.includes('深渊')&&r.differs,
     `记录 df=${r.df} 落盘=${r.stored} · 榜单行含「深渊」=${r.row.includes('深渊')} · 卡片换档后像素不同=${r.differs}`);
  await p.close();
}catch(e){err('6-2-11-record',e);}

/* 12 i18n 中英 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{NOVA.diff.setWave(20);return '1'})()`);
  await p.click('#btnLaunch');await p.waitForTimeout(250);
  const zh=await p.locator('#diffRow .dif').allTextContents();
  const zhLab=(await p.locator('#diffRow .diflab').textContent())||'';
  /* 机库面板没有返回键，用与 padBack 相同的复位回菜单再切语言
     （#btnLang 在菜单里，被机库盖住时点不到） */
  await ev(p,`(()=>{el.hulls.hidden=true;G.mode='menu';el.menu.hidden=false;return '1'})()`);
  await p.click('#btnLang');await p.waitForTimeout(250);
  await p.click('#btnLaunch');await p.waitForTimeout(250);
  const en=await p.locator('#diffRow .dif').allTextContents();
  const enLab=(await p.locator('#diffRow .diflab').textContent())||'';
  ok('6-2-12-i18n', zh.join('/').includes('深渊')&&en.join('/').includes('ABYSS')&&
     zhLab.includes('难度')&&enLab.includes('DIFFICULTY'),
     `中「${zh.join('/')}」/ 英「${en.join('/')}」· 标签「${zhLab.trim()}」→「${enLab.trim()}」`);
  await p.close();
}catch(e){err('6-2-12-i18n',e);}

/* 13 旧能力回归 */
try{
  const p=await fresh(b);
  const r=await ev(p,`(()=>{
    NOVA.launch(0);G.mode='play';
    return JSON.stringify({q:document.querySelectorAll('#optQuality .segb').length,
      keys:KEY_DEFS.length,board:BOARD_MAX,mods:MODULES.length,hulls:HULLS.length,
      seed:typeof seedAt,code:seedCode(codeSeed('ABC123')),joy:typeof joyRead});})()`);
  ok('6-2-13-keep', r.q===4&&r.keys===12&&r.board===10&&r.mods===29&&r.hulls===7&&
     r.seed==='function'&&r.code==='ABC123'&&r.joy==='function',
     `画质${r.q}档 键位${r.keys} 榜Top${r.board} 模块${r.mods} 船体${r.hulls} · 6.1 种子链路在（短码 ${r.code}）`);
  await p.close();
}catch(e){err('6-2-13-keep',e);}

/* 14 竖屏不出界 */
try{
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(URL);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.diff);
  await p.waitForFunction(()=>NOVA.debug('G.mode')==='menu',null,{timeout:25000}).catch(()=>{});
  await p.click('#btnLaunch');await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{
    const row=document.getElementById('diffRow').getBoundingClientRect();
    const btns=[...document.querySelectorAll('#diffRow .dif')].map(b=>b.getBoundingClientRect());
    return {over:Math.max(0,row.right-innerWidth)+Math.max(0,-row.left),
            n:btns.length,tall:btns.every(x=>x.height>18)};
  });
  ok('6-2-14-mobile', r.over===0&&r.n===3&&r.tall, `竖屏 390 溢出=${r.over}px 按钮 ${r.n} 个可点`);
  await p.close();
}catch(e){err('6-2-14-mobile',e);}

await b.close();
console.log(`\n—— 6.2 断言：${pass} 通过 / ${fail} 失败 ——`);
process.exit(fail?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)});
