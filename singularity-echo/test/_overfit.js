/* 临时探针：验证 7.9 —— 结算大数永不折行、永不越界（fitNum 之后） */
const http=require('http'),fsp=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const EXE=require('./_browser').exe();
const ROOT=path.resolve(__dirname,'..');
const MIME={'.html':'text/html','.js':'application/javascript','.mp3':'audio/mpeg','.css':'text/css'};
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fsp.existsSync(f)||!fsp.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fsp.createReadStream(f).pipe(res);
});
const VPS=[[390,844],[360,640],[844,390],[1024,768]];
const SCORES=[0,3500,56000,560000,5600000,56000000,560000000,1234567890,99999999999];
const M=`
(()=>{
  const n=document.getElementById('overScore');
  const pn=n.closest('.panel'),cs=getComputedStyle(pn);
  const content=pn.getBoundingClientRect().width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const fs=parseFloat(getComputedStyle(n).fontSize);
  const lh=parseFloat(getComputedStyle(n).lineHeight)||fs*1.2;
  return {txt:n.textContent,fs:Math.round(fs*10)/10,
    content:Math.round(content),tw:Math.round(n.getBoundingClientRect().width),
    scroll:Math.round(n.scrollWidth),client:Math.round(n.clientWidth),
    lines:Math.round(n.getBoundingClientRect().height/lh*10)/10,
    panelR:Math.round(pn.getBoundingClientRect().right),nR:Math.round(n.getBoundingClientRect().right)};
})()`;
let fail=0;
(async()=>{
await new Promise(r=>srv.listen(8734,'127.0.0.1',r));
const b=await chromium.launch({executablePath:EXE});
for(const [w,h] of VPS){
  const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await c.newPage();
  await p.route('**/*.mp3',async r=>{await r.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.alloc(8)});});
  await p.goto('http://127.0.0.1:8734/index.html',{waitUntil:'load'});
  await p.waitForTimeout(2000);
  console.log('=== '+w+'x'+h);
  for(const sc of SCORES){
    await p.evaluate(s=>NOVA.debug(s), [
      'G.mode="menu";G.taMode=false;',
      'startGame(HULLS[0]);',
      'G.mode="play";',
      'G.score='+sc+';G.best=0;',
      'showOver();'
    ].join('\n'));
    await p.waitForTimeout(160);
    const m=await p.evaluate(M);
    const over=m.scroll-m.client;
    const ok=over<=1&&m.lines<=1.35;
    if(!ok)fail++;
    console.log('  '+String(sc).padStart(12),m.txt.padStart(17),
      ('fs='+m.fs).padStart(9),('content='+m.content).padStart(12),
      ('scroll='+m.scroll).padStart(10),('lines='+m.lines).padStart(9),
      ok?'  ok':'  FAIL (+'+over+'px)');
  }
  await c.close();
}
await b.close();srv.close();
console.log(fail?('\n=== FAIL '+fail):'\n=== ALL PASS');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
