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
(async()=>{
await new Promise(r=>srv.listen(8733,'127.0.0.1',r));
const b=await chromium.launch({executablePath:EXE});
const c=await b.newContext({viewport:{width:1024,height:768},deviceScaleFactor:1});
const p=await c.newPage();
await p.route('**/*.mp3',async r=>{await r.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.alloc(8)});});
await p.goto('http://127.0.0.1:8733/index.html',{waitUntil:'load'});
await p.waitForTimeout(2500);
await p.evaluate(s=>NOVA.debug(s), [
  'startGame(HULLS[0]);',
  'G.mode="play";',
  'G.score=3500;',
  'G.best=5600000;',
  'localStorage.setItem("nova-best","5600000");',
  'showOver();'
].join('\n'));
await p.waitForTimeout(1200);
const r=await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('#over *').forEach(el=>{
    if(el.id==='over')return;
    const s=getComputedStyle(el);
    if(s.display==='none'||s.visibility==='hidden')return;
    const t=(el.textContent||'').trim();
    if(!t)return;
    const rect=el.getBoundingClientRect();
    out.push({tag:el.tagName,id:el.id||'',cls:(el.className||'').toString().slice(0,30),fs:s.fontSize,
      x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),
      text:t.length>50?t.slice(0,50)+'...':t});
  });
  return out;
});
console.log('=== over panel visible elements ===');
r.forEach(x=>console.log('y='+String(x.y).padStart(4)+' x='+String(x.x).padStart(4)+' w='+String(x.w).padStart(4)+' '+x.fs.padStart(6)+' '+x.tag+'#'+x.id+' .'+x.cls+'  ['+x.text+']'));
const all=await p.evaluate(()=>{
  const out=[];
  ['#over','#hud','#menu','#hulls','#pause','#victory','#board','#sharecard','#seedpanel','#settings','#logbook','#saves'].forEach(s=>{
    const el=document.querySelector(s);if(!el)return;
    const r=el.getBoundingClientRect();
    out.push({sel:s,hidden:el.hidden,display:getComputedStyle(el).display,
      x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});
  });
  return out;
});
console.log('=== overlays ===');all.forEach(x=>console.log(x));
await p.screenshot({path:path.join(__dirname,'phase7','_over-bug.png'),fullPage:false});
await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
