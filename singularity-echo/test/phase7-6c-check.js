/* Phase 7 · 7.6c 协同卡片 z-index 修复 —— 断言脚本
   7.1~7.6 之外的后置补丁：暂停面板的 .synlist 曾是 z-index:0，
   跟 .btn(position:relative z=auto) 同处「positioned z-auto/0」一层，
   DOM 后出现的 .row-btns 把 synlist 及其 tooltip 整个盖住，看上去像「透明文字重叠」。
   修复：把 chips 与 synlist 都抬到 z>0 的层（chips=2 / synlist=1），保留 chips > synlist 相对顺序。

   注：.detail 有 pointer-events:none，elementFromPoint 会跳过它，
   所以视觉叠层只能用 z-index 数值断言 + 截图目测两路校验。
   探针 7.6c 跑过修复前后对比，确认 tooltip 文字不再被按钮盖住。*/
const {chromium}=require('playwright-core');
const CHROME=require('./_browser').exe();
const BASE=require('url').pathToFileURL(require('path').resolve(__dirname,'../index.html')).href;
let fail=0,pass=0;
const ok=(n,c,d='')=>{if(c)pass++;else fail++;console.log((c?'ok  PASS ':'FAIL     ')+n+(d?'  '+d:''));};
const err=(n,e)=>{fail++;console.log('ERR      '+n+'  '+e.message);};
const ev=async(p,code)=>JSON.parse(await p.evaluate(c=>NOVA.debug(c),code));

async function fresh(b,vp){
  const p=await (await b.newContext({viewport:vp||{width:900,height:1300}})).newPage();
  p.on('pageerror',e=>console.log('  PAGEERROR',e.message));
  await p.goto(BASE);
  await p.waitForFunction(()=>window.NOVA&&window.NOVA.ta,null,{timeout:25000});
  await p.waitForFunction(()=>{const el=document.getElementById('boot');return !!el&&el.hidden;},
                          null,{timeout:25000}).catch(()=>{});
  return p;
}

(async()=>{
const b=await chromium.launch({executablePath:CHROME});

/* 01 容器 z-index：chips > synlist > 0（必须抬出「z-auto/0」同层） */
try{
  const p=await fresh(b);
  const r=await ev(p,`JSON.stringify({
    chips:parseFloat(getComputedStyle(document.querySelector('.chips')).zIndex),
    synlist:parseFloat(getComputedStyle(document.querySelector('.synlist')).zIndex)
  })`);
  ok('7c-01-z', r.chips>0 && r.synlist>0 && r.chips>r.synlist,
     `chips z=${r.chips} · synlist z=${r.synlist}（chips > synlist > 0 都成立）`);
  await p.close();
}catch(e){err('7c-01-z',e);}

/* 02 .schip.open 与 .detail 的 z-index：弹层 z>容器（chip z=41, detail z=40） */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{ NOVA.launch(0); G.syn.swarm_arc=1; NOVA.pause(); return '1'; })()`);
  await p.waitForSelector('#pause:not([hidden])');
  await ev(p,`(()=>{ document.querySelector('#pauseSyn .schip').classList.add('open'); return '1'; })()`);
  await p.waitForTimeout(150);
  const r=await ev(p,`(()=>{
    var schip=document.querySelector('#pauseSyn .schip');
    var det=schip.querySelector('.detail');
    return JSON.stringify({
      chip:parseFloat(getComputedStyle(schip).zIndex),
      det:parseFloat(getComputedStyle(det).zIndex),
      syn:parseFloat(getComputedStyle(det.parentElement.parentElement).zIndex)
    });
  })()`);
  ok('7c-02-stack', r.chip>r.syn && r.chip>r.det && r.syn>0,
     `synlist z=${r.syn} · schip.open z=${r.chip} · detail z=${r.det}（chip > synlist > 0；detail 在 chip 内）`);
  await p.close();
}catch(e){err('7c-02-stack',e);}

/* 03 暂停面板打开 schip：getComputedStyle 不被元素覆写，背景仍是 --c-pop-bg 不透明 */
try{
  const p=await fresh(b);
  await ev(p,`(()=>{ NOVA.launch(0); G.syn.swarm_arc=1; NOVA.pause(); return '1'; })()`);
  await p.waitForSelector('#pause:not([hidden])');
  await ev(p,`(()=>{ document.querySelector('#pauseSyn .schip').classList.add('open'); return '1'; })()`);
  await p.waitForTimeout(150);
  const r=await ev(p,`(()=>{
    var det=document.querySelector('#pauseSyn .schip .detail');
    var s=getComputedStyle(det);
    /* --c-pop-bg=#131c29 = rgb(19,28,41)；不透明背景 + opacity 1 是 tooltip 应有的状态 */
    return JSON.stringify({
      bg:s.backgroundColor,
      opacity:s.opacity,
      pe:s.pointerEvents,
      detZ:s.zIndex
    });
  })()`);
  ok('7c-03-bg', /rgb\(19,\s*28,\s*41\)/.test(r.bg) && r.opacity==='1' && r.detZ==='40',
     `bg=${r.bg.slice(0,30)}… opacity=${r.opacity} pointer-events=${r.pe} det z=${r.detZ}`);
  await p.close();
}catch(e){err('7c-03-bg',e);}

/* 04 窄屏 480px：层叠不因断点重排而塌（synlist z 应仍为 1） */
try{
  const p=await fresh(b,{width:480,height:900});
  const r=await ev(p,`JSON.stringify({
    chips:parseFloat(getComputedStyle(document.querySelector('.chips')).zIndex),
    synlist:parseFloat(getComputedStyle(document.querySelector('.synlist')).zIndex)
  })`);
  ok('7c-04-narrow', r.chips>0 && r.synlist>0 && r.chips>r.synlist,
     `480px · chips z=${r.chips} · synlist z=${r.synlist}`);
  await p.close();
}catch(e){err('7c-04-narrow',e);}

console.log('\n7c 协同卡片 z-index：'+pass+' PASS / '+fail+' FAIL');
await b.close();
process.exit(fail?1:0);
})();