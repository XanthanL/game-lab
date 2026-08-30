/* =====================================================================
 *  星与守夜人 · 像素舞台剧
 *  编剧 / 导演 / 舞美：TRAE × GLM-5.2
 *  全部由前端实现：Canvas 像素渲染 + 导演时间轴 + Web Audio 配乐
 * ===================================================================== */

'use strict';

/* ---------- 全局配置 ---------- */
const VW = 256, VH = 144;            // 像素舞台内部分辨率
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* ---------- 调色板 ---------- */
const C = {
  sky0:'#0a0a1f', sky1:'#15123a', sky2:'#241a4e', sky3:'#3a2566',
  hill0:'#0d0b1a', hill1:'#161228', hill2:'#221a3a',
  tow:'#0b0a18', towLit:'#1c1838',
  moon:'#f4e8b0', moonDim:'#b9a85e',
  star:'#fff4cc', starHot:'#ffd966', starGlow:'#ff9d3c',
  cloak:'#241a3a', cloakHi:'#3a2d5c', skin:'#e8b89a', hair:'#1a1330',
  lantern:'#5c4a1a', lanternHot:'#ffe690', flame:'#ff8a2a',
  snow:'#d8def0', green:'#2a3a2a', greenHi:'#3a5238',
  ground:'#0a0915',
  fade:'#000000',
};

/* ---------- 像素绘制工具 ---------- */
function px(x,y,color,w=1,h=1){ ctx.fillStyle=color; ctx.fillRect(x|0,y|0,w,h); }
function rect(x,y,w,h,color){ ctx.fillStyle=color; ctx.fillRect(x|0,y|0,w,h); }
// 以字符串矩阵绘制精灵，'.| ' 为透明
function sprite(map, ox, oy, pal, scale=1, flip=false){
  for(let y=0;y<map.length;y++){
    const row = map[y];
    for(let x=0;x<row.length;x++){
      const ch = row[x];
      if(ch==='.'||ch===' ') continue;
      const col = pal[ch];
      if(!col) continue;
      const dx = flip ? (map[y].length-1-x) : x;
      if(scale===1) px(ox+dx, oy+y, col);
      else rect(ox+dx*scale, oy+y*scale, scale, scale, col);
    }
  }
}

/* ====================================================================
 *  精灵资源（像素美术）
 * ==================================================================== */

// 守夜人 —— 披风、提灯。10 宽 × 18 高
const WATCHER_IDLE_A = [
  "....HHH...",
  "...HSSSH..",
  "...HSESH..",
  "....HHH...",
  "...CCCCCC.",
  "..CCCCCCC.",
  ".CCCLLCCCa",   // a=披风后摆
  "CCCLLLCCaa",
  "CCCLLLCCaa",
  ".CCCLLCCC.",
  ".CCCLLCCC.",
  "..CCLLC...",
  "..CCLLC...",
  "..C..C....",
  "..C..C....",
  "...LL.....",
  "..LYYL....",
  "..LYYL....",
];
const WATCHER_IDLE_B = [   // 微微呼吸的一帧
  "....HHH...",
  "...HSSSH..",
  "...HSESH..",
  "....HHH...",
  "...CCCCCC.",
  "..CCCCCCC.",
  ".CCCLLCCCa",
  "CCCLLLCCaa",
  "CCCLLLCCaa",
  ".CCCLLCCC.",
  ".CCCLLCCC.",
  "...CLLC...",
  "...CLLC...",
  "..C..C....",
  "..C..C....",
  "...LL.....",
  "..LYYL....",
  "..LYYL....",
];
const WATCHER_LOOK = [     // 仰头望星
  "....HHH...",
  "...HSSSH..",
  "...HSESH..",
  "....HHH...",
  "...CCCCCC.",
  "..CCCCCCC.",
  ".CCCLLCCCa",
  "CCCLLLCCaa",
  "CCCLLLCCaa",
  ".CCCLLCCC.",
  ".CCCLLCCC.",
  "..CCLLC...",
  "..CCLLC...",
  "..C..C....",
  "..C..C....",
  "...LL.....",
  "..LYYL....",
  "..LYYL....",
];
const WATCHER_KNEEL = [    // 跪下照料星
  "..........",
  "..........",
  "....HHH...",
  "...HSSSH..",
  "...HSESH..",
  "....HHH...",
  ".CCCCCCCC.",
  "CCLLLLLLCC",
  "CCLLLLLLCC",
  "CCCLLLCCC.",
  ".CCCLLCCC.",
  "..CCLLC...",
  "..CCLLCC..",
  "..C..CCC..",
  ".CC...C...",
  "CCLL......",
  ".LYYL.....",
  ".LYYL.....",
];
const WATCHER_REACH = [    // 伸手送星
  "....HHH...",
  "...HSSSH..",
  "...HSESH..",
  "....HHH...",
  "...CCCCCC.",
  "..CCCCCCC.",
  ".CCCLLCCC.",
  "C.CLLLCCCa",
  "CCCLLLCCaa",
  "C.CCLLCCC.",
  "...CLLC...",
  "..CCLLC...",
  "..CCLLC...",
  "..C..C....",
  "..C..C....",
  "...LL.....",
  "..LYYL....",
  "..LYYL....",
];
const WATCHER_SAD = [
  "....HHH...",
  "...HSSSH..",
  "...HSDSH..",   // D = 闭眼/低眉
  "....HHH...",
  "...CCCCCC.",
  "..CCCCCCC.",
  ".CCCLLCCCa",
  "CCCLLLCCaa",
  "CCCLLLCCaa",
  ".CCCLLCCC.",
  ".CCCLLCCC.",
  "..CCLLC...",
  "..CCLLC...",
  "..C..C....",
  "..C..C....",
  "...LL.....",
  "..LYYL....",
  "..LYYL....",
];
const PAL_W = { H:C.hair, S:C.skin, E:'#fff', C:C.cloak, L:C.lantern, Y:C.lanternHot, a:C.cloakHi, D:C.hair };

// 提灯火焰单独绘制（动态）
function drawFlame(x,y,t){
  const f = Math.sin(t*12)*0.5+0.5;
  px(x, y-1, C.flame);
  px(x, y-2+f, C.lanternHot);
  px(x-1, y, C.flame);
  px(x+1, y, C.flame);
}

// 星 —— 像素五角光团。绘制函数：脉动
function drawStar(cx, cy, t, size=1, bright=1){
  const pulse = (Math.sin(t*3)*0.5+0.5);
  const hot = bright;
  // 外晕
  const glow = `rgba(255,157,60,${0.10+0.10*pulse*hot})`;
  ctx.fillStyle=glow;
  ctx.fillRect(cx-6, cy-6, 13, 13);
  const glow2 = `rgba(255,217,102,${0.22+0.18*pulse*hot})`;
  ctx.fillStyle=glow2;
  ctx.fillRect(cx-4, cy-4, 9, 9);
  // 十字光芒
  const arm = 4 + (pulse|0);
  for(let i=-arm;i<=arm;i++){
    px(cx+i, cy, C.starHot);
    px(cx, cy+i, C.starHot);
  }
  // 中心核
  rect(cx-2,cy-2,5,5,C.star);
  rect(cx-1,cy-1,3,3,C.lanternHot);
  px(cx,cy,'#ffffff');
}

// 月亮（像素圆）
function drawMoon(cx,cy,r){
  for(let y=-r;y<=r;y++){
    for(let x=-r;x<=r;x++){
      const d = x*x+y*y;
      if(d<=r*r) px(cx+x,cy+y, C.moon);
      else if(d<=(r+1)*(r+1) && (x+y)%2===0) px(cx+x,cy+y, C.moonDim);
    }
  }
  // 月坑
  px(cx-2,cy-1,'#d8c878'); px(cx+1,cy+1,'#d8c878'); px(cx-1,cy+2,'#c8b868');
}

/* ====================================================================
 *  背景 / 舞台美术（程序化像素绘制）
 * ==================================================================== */

// 固定的星空种子，保证闪烁但位置稳定
const STARS = [];
for(let i=0;i<70;i++){
  STARS.push({x:Math.random()*VW|0, y:Math.random()*90|0, p:Math.random()*Math.PI*2, s:Math.random()<.2?2:1});
}
// 远山轮廓（阶梯像素）
const HILLS = [];
for(let x=0;x<VW;x++){
  HILLS.push(108 + Math.floor(Math.sin(x*0.05)*4) + ((x*7)%5<2?1:0));
}
// 塔参数
const TOWER = { x: 196, top: 56, base: 120, w: 16 };

function drawSky(t, pal){
  // 分段夜空（带极轻抖动模拟渐变）
  const bands = [C.sky0,C.sky0,C.sky1,C.sky1,C.sky2,C.sky2,C.sky3,C.sky2];
  for(let y=0;y<VH;y++){
    const b = bands[Math.min(bands.length-1, (y/18)|0)];
    ctx.fillStyle=b; ctx.fillRect(0,y,VW,1);
  }
}
function drawStarfield(t, dim=1){
  for(const s of STARS){
    const tw = (Math.sin(t*1.5 + s.p)*0.5+0.5);
    if(tw<0.35) continue;
    const a = tw*dim;
    if(s.s===2){
      ctx.fillStyle=`rgba(255,244,204,${a})`;
      ctx.fillRect(s.x, s.y, 1,1);
      ctx.fillStyle=`rgba(255,244,204,${a*0.5})`;
      ctx.fillRect(s.x-1,s.y,1,1); ctx.fillRect(s.x+1,s.y,1,1);
      ctx.fillRect(s.x,s.y-1,1,1); ctx.fillRect(s.x,s.y+1,1,1);
    } else {
      ctx.fillStyle=`rgba(232,226,208,${a})`;
      ctx.fillRect(s.x,s.y,1,1);
    }
  }
}
function drawHills(){
  // 远山两层
  for(let x=0;x<VW;x++){
    const h = HILLS[x];
    rect(x, h, 1, VH-h, C.hill2);
  }
  for(let x=0;x<VW;x++){
    const h = HILLS[x]+6 + Math.floor(Math.sin(x*0.13)*2);
    rect(x, h, 1, VH-h, C.hill1);
  }
  // 地面
  rect(0, 132, VW, VH-132, C.ground);
  // 草点
  for(let x=0;x<VW;x+=3){
    if((x*13)%7<3){ px(x,132,C.greenHi); px(x,131,C.green); }
  }
}
function drawTower(lit=false){
  const {x,top,base,w} = TOWER;
  // 塔身
  rect(x, top, w, base-top, C.tow);
  // 砖纹
  for(let y=top+4;y<base;y+=6){
    for(let i=0;i<w;i+=4){ px(x+i,y,C.towLit); }
  }
  // 塔顶（尖）
  for(let i=0;i<w+2;i++){
    const yy = top - 6 + Math.abs(i-(w+2)/2);
    rect(x-1+i, top-6+Math.abs(i-(w+2)/2) ,1, 1, C.tow);
  }
  // 旗杆 + 星旗
  px(x+w/2|0, top-12, C.towLit);
  rect(x+w/2|0, top-12, 1, 4, C.towLit);
  // 窗
  if(lit){
    rect(x+4, top+12, 4, 5, C.lanternHot);
    rect(x+8, top+22, 3, 4, C.flame);
    // 光晕
    ctx.fillStyle='rgba(255,217,102,.15)';
    ctx.fillRect(x-4, top+8, w+8, 30);
  } else {
    rect(x+4, top+12, 4, 5, '#000');
    rect(x+8, top+22, 3, 4, '#000');
  }
  // 顶窗（点灯处）
  rect(x+w/2-1|0, top+2, 3, 4, lit? C.lanternHot : '#000');
}

/* ====================================================================
 *  粒子系统
 * ==================================================================== */
const particles = [];
function spawnTrail(x,y,color,life=40){
  particles.push({x,y,vx:(Math.random()-.5)*0.3, vy:Math.random()*0.5+0.1, life, max:life, color, r:Math.random()<.5?1:1});
}
function spawnSpark(x,y,n=8){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=Math.random()*1.2+0.3;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.3,life:30+Math.random()*20,max:50,color:Math.random()<.5?C.starHot:C.star,r:1});
  }
}
function spawnSnow(){
  if(particles.filter(p=>p.kind==='snow').length<40)
    particles.push({x:Math.random()*VW,y:0,vx:-0.15,vy:0.4+Math.random()*0.3,life:9999,max:9999,color:C.snow,r:1,kind:'snow',sw:Math.random()*Math.PI*2});
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy;
    if(p.kind==='snow'){ p.sw+=0.1; p.x+=Math.sin(p.sw)*0.2; if(p.y>VH) particles.splice(i,1); continue; }
    p.life--;
    if(p.life<=0 || p.y>VH) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    const a = p.kind==='snow'?1:Math.max(0,p.life/p.max);
    ctx.fillStyle = p.color.startsWith('rgba')?p.color:hexA(p.color,a);
    ctx.fillRect(p.x|0,p.y|0,p.r,p.r);
  }
}
function hexA(hex,a){
  if(hex.startsWith('#')){
    const n=parseInt(hex.slice(1),16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }
  return hex;
}

/* ====================================================================
 *  Web Audio —— 极简氛围配乐（程序生成）
 * ==================================================================== */
const Audio = {
  ctx:null, master:null, muted:false, started:false,
  voices:[],
  init(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }catch(e){ this.ctx=null; }
  },
  // 播放一个持续和弦 pad
  pad(freqs, dur, type='sine', vol=0.5){
    if(!this.ctx || this.muted) return;
    const now=this.ctx.currentTime;
    freqs.forEach((f,i)=>{
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=type; o.frequency.value=f;
      o.detune.value=(i-1)*6;
      g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(vol*0.4, now+1.2);
      g.gain.linearRampToValueAtTime(vol*0.25, now+dur-1);
      g.gain.linearRampToValueAtTime(0, now+dur);
      o.connect(g); g.connect(this.master);
      o.start(now); o.stop(now+dur+0.1);
    });
  },
  // 音效：叮（星声）
  bell(freq=880, dur=0.6){
    if(!this.ctx||this.muted) return;
    const now=this.ctx.currentTime;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type='triangle'; o.frequency.value=freq;
    g.gain.setValueAtTime(0,now);
    g.gain.linearRampToValueAtTime(0.5,now+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,now+dur);
    o.connect(g); g.connect(this.master);
    o.start(now); o.stop(now+dur+0.05);
  },
  // 风声（噪声）
  wind(dur){
    if(!this.ctx||this.muted) return;
    const now=this.ctx.currentTime;
    const buf=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.5;
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const g=this.ctx.createGain(); const f=this.ctx.createBiquadFilter();
    f.type='lowpass'; f.frequency.value=420;
    g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.12,now+0.6);
    g.gain.linearRampToValueAtTime(0,now+dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(now); src.stop(now+dur);
  }
};

/* 和弦进行（每个场景一个调式） */
const CHORDS = {
  prologue: [196,233.08,293.66],   // Gm
  act1:     [174.61,220,261.63],   // F
  act2:     [220,261.63,329.63],   // Am
  act3:     [261.63,329.63,392],   // C
  act4:     [293.66,349.23,440],   // D
  epilogue: [196,246.94,392],      // G
};

/* ====================================================================
 *  导演系统：场景 + 时间轴 + Cues
 * ==================================================================== */

const Stage = {
  sceneIdx: 0,
  sceneTime: 0,
  running: false,
  paused: false,
  lastTs: 0,
  // 演员状态
  actors: {
    watcher: { x:128, y:114, pose:'idle', face:1, lit:false, bob:0 },
    star:    { x:128, y:60, visible:false, bright:1, size:1, fallen:false },
  },
  // 当前对话
  line: null,         // {who, text, full, shown, t}
  // 场景环境状态
  env: { towerLit:false, snow:false, fade:1, fadeDir:0, targetFade:0 },
  // 已触发 cue 索引
  cuePtr: 0,
  // 转场
  transition: 0,

  reset(){
    this.sceneIdx=0; this.sceneTime=0; this.cuePtr=0;
    this.actors.watcher={x:60,y:114,pose:'idle',face:1,lit:false,bob:0};
    this.actors.star={x:200,y:40,visible:true,bright:0.6,size:1,fallen:false};
    this.env={towerLit:false,snow:false,fade:1,fadeDir:0,targetFade:0};
    this.line=null; particles.length=0;
    hideDialogue();
  },

  start(){
    Audio.init();
    if(Audio.ctx && Audio.ctx.state==='suspended') Audio.ctx.resume();
    this.reset();
    this.running=true; this.paused=false; this.lastTs=performance.now();
    this.gotoScene(0);
    loop(this.lastTs);
  },

  gotoScene(i){
    this.sceneIdx=Math.max(0,Math.min(PLAY.scenes.length-1,i));
    this.sceneTime=0; this.cuePtr=0;
    this.env.fade=1; this.env.fadeDir=-1; this.env.targetFade=0;
    // 重置该幕演员初始位置
    const sc=PLAY.scenes[this.sceneIdx];
    if(sc.setup) sc.setup(this.actors, this.env);
    this.line=null; hideDialogue();
    showActCard(sc.name, sc.sub);
    updateProgress();
    // 切场景音
    if(sc.chord) Audio.pad(CHORDS[sc.chord]||CHORDS.prologue, Math.min(sc.duration,12),'sine',0.5);
  },

  tick(dt){
    if(!this.running||this.paused) return;
    this.sceneTime+=dt;
    const sc=PLAY.scenes[this.sceneIdx];

    // 处理 cues
    while(this.cuePtr<sc.cues.length && sc.cues[this.cuePtr].t<=this.sceneTime){
      this.fireCue(sc.cues[this.cuePtr]);
      this.cuePtr++;
    }
    // 演员更新
    this.updateActors(dt);
    // 对话打字机
    this.updateLine(dt);
    // 粒子
    updateParticles(dt);
    // 环境雪
    if(this.env.snow && Math.random()<0.4) spawnSnow();
    // 转场淡入淡出
    if(this.env.fadeDir!==0){
      this.env.fade += this.env.fadeDir*dt*1.6;
      if(this.env.fadeDir<0 && this.env.fade<=this.env.targetFade){ this.env.fade=this.env.targetFade; this.env.fadeDir=0; }
      if(this.env.fadeDir>0 && this.env.fade>=this.env.targetFade){ this.env.fade=this.env.targetFade; this.env.fadeDir=0; }
    }

    // 场景结束
    if(this.sceneTime>=sc.duration){
      if(this.sceneIdx<PLAY.scenes.length-1){
        this.env.fadeDir=1; this.env.targetFade=1;
        // 等淡出再切
        setTimeout(()=>{ this.gotoScene(this.sceneIdx+1); }, 600);
        this.sceneTime = -999; // 避免重复触发
      } else {
        this.running=false;
        document.getElementById('end-screen').classList.add('show');
      }
    }
  },

  fireCue(c){
    switch(c.type){
      case 'say': this.line={who:c.who,text:c.text,full:c.text,shown:0,t:0,speed:c.speed||14}; showDialogue(c.who); break;
      case 'move':{
        const a=this.actors[c.who]; if(!a) break;
        a._move={fromX:a.x,fromY:a.y,toX:c.to.x??a.x,toY:c.to.y??a.y,dur:c.dur||1,el:0,face:c.to.face??a.face};
        if(c.to.face!==undefined) a.face=c.to.face;
        break;
      }
      case 'pose':{ const a=this.actors[c.who]; if(a) a.pose=c.pose; break; }
      case 'act': if(c.fn) c.fn(this.actors,this.env); break;
      case 'sfx': if(c.s==='bell') Audio.bell(c.f||880,c.d||0.6); if(c.s==='wind') Audio.wind(c.d||3); break;
      case 'chord': Audio.pad(CHORDS[c.key]||CHORDS.prologue, c.d||8,'sine',0.5); break;
    }
  },

  updateActors(dt){
    const w=this.actors.watcher, s=this.actors.star;
    w.bob += dt;
    // 移动补间
    if(w._move){
      w._move.el+=dt;
      const k=Math.min(1,w._move.el/w._move.dur);
      const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      w.x = w._move.fromX + (w._move.toX-w._move.fromX)*e;
      w.y = w._move.fromY + (w._move.toY-w._move.fromY)*e;
      if(k>=1) w._move=null;
    }
    if(s._move){
      s._move.el+=dt;
      const k=Math.min(1,s._move.el/s._move.dur);
      const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      s.x = s._move.fromX + (s._move.toX-s._move.fromX)*e;
      s.y = s._move.fromY + (s._move.toY-s._move.fromY)*e;
      if(k>=1) s._move=null;
    }
    // 星脉动时的余烬
    if(s.visible && s.bright>0.5 && Math.random()<0.25){
      spawnTrail(s.x, s.y, C.starHot, 24);
    }
  },

  updateLine(dt){
    if(!this.line) return;
    this.line.t+=dt;
    if(this.line.shown<this.line.full.length){
      this.line.shown = Math.min(this.line.full.length, this.line.shown + this.line.speed*dt);
      renderDialogueText(this.line.full.slice(0,Math.floor(this.line.shown)), this.line.shown<this.line.full.length);
    }
  },

  // 跳过当前对话整句
  skipLine(){
    if(this.line && this.line.shown<this.line.full.length){
      this.line.shown=this.line.full.length;
      renderDialogueText(this.line.full,false);
    }
  }
};

/* ====================================================================
 *  渲染主循环
 * ==================================================================== */
function render(t){
  ctx.clearRect(0,0,VW,VH);
  const sc=PLAY.scenes[Stage.sceneIdx];
  // 背景
  drawSky(t);
  drawStarfield(t, sc.dark?0.5:1);
  if(sc.moon) drawMoon(sc.moonX||210, sc.moonY||28, 7);
  drawHills();
  drawTower(Stage.env.towerLit);

  // 演员顺序：星在后，守夜人在前（依场景）
  const s=Stage.actors.star, w=Stage.actors.watcher;
  if(s.visible){
    drawStar(s.x|0, s.y|0, t, s.size, s.bright);
  }
  drawParticles();
  drawWatcher(w, t);

  // 场景自定义前景
  if(sc.fore) sc.fore(ctx, t, Stage.actors, Stage.env);

  // 转场遮罩
  if(Stage.env.fade>0){
    ctx.fillStyle=`rgba(0,0,0,${Stage.env.fade})`;
    ctx.fillRect(0,0,VW,VH);
  }
}

function drawWatcher(w, t){
  let map;
  switch(w.pose){
    case 'look': map=WATCHER_LOOK; break;
    case 'kneel': map=WATCHER_KNEEL; break;
    case 'reach': map=WATCHER_REACH; break;
    case 'sad': map=WATCHER_SAD; break;
    default: map = (Math.sin(t*2)>0)?WATCHER_IDLE_A:WATCHER_IDLE_B;
  }
  const bob = w.pose==='idle'? (Math.sin(w.bob*2)*0.5|0) : 0;
  sprite(map, w.x|0, (w.y+bob)|0, PAL_W, 1, w.face<0);
  // 提灯火焰（在灯位置 x+3..5, y+16）
  if(w.lit){
    drawFlame((w.x|0)+3, (w.y+bob|0)+16, t);
    // 灯光晕
    const g=ctx.createRadialGradient((w.x|0)+4,(w.y+bob|0)+16,0,(w.x|0)+4,(w.y+bob|0)+16,22);
    g.addColorStop(0,'rgba(255,217,102,.35)');
    g.addColorStop(1,'rgba(255,217,102,0)');
    ctx.fillStyle=g; ctx.fillRect((w.x|0)-18,(w.y+bob|0)-6,48,48);
  }
}

let rafId=0;
function loop(ts){
  const dt = Math.min(0.05, (ts-Stage.lastTs)/1000 || 0);
  Stage.lastTs=ts;
  Stage.tick(dt);
  render(ts/1000);
  if(Stage.running||Stage.paused) rafId=requestAnimationFrame(loop);
}

/* ====================================================================
 *  对话 / UI
 * ==================================================================== */
const dlgEl=document.getElementById('dialogue');
const dlgWho=dlgEl.querySelector('.who');
const dlgText=dlgEl.querySelector('.text');
const actCard=document.getElementById('act-card');

function showDialogue(who){
  dlgEl.classList.add('show');
  if(who==='旁白'){
    dlgWho.textContent='旁 白'; dlgWho.className='who narrator';
  }else{
    dlgWho.textContent=who; dlgWho.className='who';
  }
}
function renderDialogueText(txt, typing){
  dlgText.innerHTML = txt + (typing? '<span class="cursor">　</span>':'');
}
function hideDialogue(){ dlgEl.classList.remove('show'); }
function showActCard(name, sub){
  actCard.innerHTML = name + (sub?`<span class="sub">${sub}</span>`:'');
  actCard.style.opacity=1;
  setTimeout(()=>{ actCard.style.opacity=0; }, 3200);
}
function updateProgress(){
  const p=document.getElementById('progress');
  p.innerHTML='';
  PLAY.scenes.forEach((s,i)=>{
    const e=document.createElement('i');
    if(i<Stage.sceneIdx) e.className='done';
    else if(i===Stage.sceneIdx) e.className='cur';
    p.appendChild(e);
  });
}

/* ====================================================================
 *  剧本 —— 星与守夜人
 *  五幕：序幕·长夜 / 壹·坠星 / 贰·相守 / 叁·告别 / 肆·长明
 * ==================================================================== */
const PLAY = {
  title:'星与守夜人',
  scenes:[
    /* ---------- 序幕 · 长夜 ---------- */
    {
      name:'序  幕  ·  长  夜', sub:'PROLOGUE — THE LONG NIGHT',
      chord:'prologue', moon:true, moonX:218, moonY:26, dark:true, duration:14,
      setup(a,e){
        a.watcher.x=58; a.watcher.y=114; a.watcher.pose='idle'; a.watcher.lit=false; a.watcher.face=1;
        a.star.x=200; a.star.y=40; a.star.visible=true; a.star.bright=0.55; a.star.fallen=false;
        e.towerLit=false; e.snow=false;
      },
      cues:[
        {t:0.4, type:'say', who:'旁白', text:'夜，深得像一口井。'},
        {t:3.2, type:'say', who:'旁白', text:'守夜人攀上最高的塔，把第一盏灯点亮。'},
        {t:6.0, type:'act', fn:(a,e)=>{ a.watcher.lit=true; e.towerLit=true; }},
        {t:6.2, type:'sfx', s:'bell', f:587, d:0.8},
        {t:7.0, type:'say', who:'守夜人', text:'只要灯还亮着，夜就不算赢。'},
        {t:10.5, type:'say', who:'旁白', text:'可这一夜，天上有一颗星，病了。'},
      ],
      fore:(c,t,a,e)=>{ /* 微风粒子 */ if(Math.random()<0.1) spawnTrail(40,80+Math.random()*30,C.sky3,60); }
    },

    /* ---------- 第一幕 · 坠星 ---------- */
    {
      name:'第 一 幕 · 坠 星', sub:'ACT I — THE FALLING STAR',
      chord:'act1', moon:true, moonX:60, moonY:22, dark:false, duration:16,
      setup(a,e){
        a.watcher.x=58; a.watcher.y=114; a.watcher.pose='idle'; a.watcher.lit=true; a.watcher.face=1;
        a.star.x=210; a.star.y=20; a.star.visible=true; a.star.bright=0.8; a.star.fallen=false;
        e.towerLit=true; e.snow=false;
      },
      cues:[
        {t:0.3, type:'say', who:'旁白', text:'那颗星从天上滑落，像一滴不肯落下的泪。'},
        {t:3.0, type:'act', fn:(a,e)=>{
          a.star._move={fromX:210,fromY:20,toX:150,toY:120,dur:3.5,el:0};
          a.star.fallen=true;
        }},
        {t:3.0, type:'sfx', s:'wind', d:3.5},
        {t:4.5, type:'pose', who:'watcher', pose:'look'},
        {t:6.6, type:'act', fn:(a,e)=>{ spawnSpark(150,118,24); Audio.bell(330,1.2); }},
        {t:7.0, type:'say', who:'旁白', text:'它摔在山坡上，光芒碎了一地。'},
        {t:10.0, type:'move', who:'watcher', to:{x:120,face:1}, dur:2.5},
        {t:11.0, type:'pose', who:'watcher', pose:'idle'},
        {t:12.8, type:'say', who:'守夜人', text:'……你疼吗？'},
      ],
      fore:(c,t,a,e)=>{
        if(a.star._move){ spawnTrail(a.star.x,a.star.y,C.starHot,30); spawnTrail(a.star.x,a.star.y,C.starGlow,40); }
      }
    },

    /* ---------- 第二幕 · 相守 ---------- */
    {
      name:'第 二 幕 · 相 守', sub:'ACT II — TOGETHER',
      chord:'act2', moon:false, dark:false, duration:18,
      setup(a,e){
        a.watcher.x=120; a.watcher.y=114; a.watcher.pose='kneel'; a.watcher.lit=true; a.watcher.face=1;
        a.star.x=150; a.star.y=120; a.star.visible=true; a.star.bright=0.35; a.star.fallen=true;
        e.towerLit=true; e.snow=true;
      },
      cues:[
        {t:0.3, type:'say', who:'旁白', text:'守夜人把星捧进提灯，用自己的光暖它。'},
        {t:3.5, type:'act', fn:(a,e)=>{ a.star.bright=0.5; }},
        {t:4.0, type:'say', who:'星', text:'……我是不是，再也不能回去了？'},
        {t:8.0, type:'say', who:'守夜人', text:'回不去也没关系。你先亮着。'},
        {t:12.0, type:'act', fn:(a,e)=>{ a.star.bright=0.75; spawnSpark(a.star.x,a.star.y-2,12); Audio.bell(523,0.8); }},
        {t:12.5, type:'say', who:'星', text:'你的灯……好暖。'},
        {t:15.5, type:'say', who:'旁白', text:'那一夜，山上的雪很冷，灯里却很热。'},
      ],
      fore:(c,t,a,e)=>{ /* 雪已在 env.snow 持续生成 */ }
    },

    /* ---------- 第三幕 · 告别 ---------- */
    {
      name:'第 三 幕 · 告 别', sub:'ACT III — FAREWELL',
      chord:'act3', moon:true, moonX:200, moonY:24, dark:false, duration:18,
      setup(a,e){
        a.watcher.x=128; a.watcher.y=114; a.watcher.pose='kneel'; a.watcher.lit=true; a.watcher.face=1;
        a.star.x=132; a.star.y=116; a.star.visible=true; a.star.bright=1; a.star.fallen=true;
        e.towerLit=true; e.snow=false;
      },
      cues:[
        {t:0.3, type:'say', who:'星', text:'我好像……又能亮一点了。'},
        {t:3.8, type:'act', fn:(a,e)=>{ a.star.bright=1.2; spawnSpark(a.star.x,a.star.y,16); Audio.bell(659,1); }},
        {t:4.5, type:'say', who:'星', text:'天在叫我。我该走了。'},
        {t:8.0, type:'pose', who:'watcher', pose:'reach'},
        {t:8.5, type:'say', who:'守夜人', text:'……再待一会儿。'},
        {t:11.0, type:'say', who:'星', text:'如果我走，你会不会又一个人？'},
        {t:14.5, type:'pose', who:'watcher', pose:'sad'},
        {t:15.0, type:'say', who:'守夜人', text:'我一直是一个人。但今晚不是。'},
      ],
      fore:(c,t,a,e)=>{}
    },

    /* ---------- 第四幕 · 长明 ---------- */
    {
      name:'第 四 幕 · 长 明', sub:'ACT IV — THE LIGHT THAT STAYS',
      chord:'act4', moon:false, dark:false, duration:17,
      setup(a,e){
        a.watcher.x=128; a.watcher.y=114; a.watcher.pose='reach'; a.watcher.lit=true; a.watcher.face=1;
        a.star.x=132; a.star.y=110; a.star.visible=true; a.star.bright=1.3; a.star.fallen=false;
        e.towerLit=true; e.snow=false;
      },
      cues:[
        {t:0.3, type:'say', who:'旁白', text:'守夜人把灯举过头顶，松开手。'},
        {t:3.0, type:'act', fn:(a,e)=>{ a.star._move={fromX:132,fromY:110,toX:128,toY:24,dur:5,el:0}; a.watcher.pose='look'; }},
        {t:3.2, type:'sfx', s:'bell', f:784, d:1.2},
        {t:4.0, type:'say', who:'星', text:'——我会变成最亮的那一颗。'},
        {t:8.0, type:'say', who:'守夜人', text:'我知道。我抬头就找得到。'},
        {t:11.5, type:'act', fn:(a,e)=>{ a.star.bright=1.6; spawnSpark(a.star.x,a.star.y,30); Audio.bell(1046,1.5); }},
        {t:12.0, type:'say', who:'旁白', text:'星回到天上。夜，安静得像一首歌的尾音。'},
        {t:15.5, type:'pose', who:'watcher', pose:'idle'},
      ],
      fore:(c,t,a,e)=>{
        if(a.star._move){ spawnTrail(a.star.x,a.star.y,C.starHot,28); }
      }
    },

    /* ---------- 尾声 ---------- */
    {
      name:'尾  声  ·  你 抬 头', sub:'EPILOGUE — LOOK UP',
      chord:'epilogue', moon:true, moonX:30, moonY:20, dark:true, duration:14,
      setup(a,e){
        a.watcher.x=196; a.watcher.y=114; a.watcher.lit=true; a.watcher.face=-1;
        a.watcher.pose='look';
        a.star.x=128; a.star.y=30; a.star.visible=true; a.star.bright=1.8; a.star.fallen=false;
        e.towerLit=true; e.snow=false;
      },
      cues:[
        {t:0.5, type:'say', who:'旁白', text:'从那以后，守夜人的塔上，多了一颗最亮的星。'},
        {t:4.5, type:'say', who:'旁白', text:'它不为别人亮，只为那个替它挡过风的人亮。'},
        {t:8.5, type:'act', fn:(a,e)=>{ spawnSpark(a.star.x,a.star.y,20); Audio.bell(1175,1.2); }},
        {t:9.0, type:'say', who:'守夜人', text:'（轻声）晚安，老朋友。'},
        {t:12.5, type:'say', who:'旁白', text:'——灯亮着，星也亮着。'},
      ],
      fore:(c,t,a,e)=>{}
    },
  ]
};

/* ====================================================================
 *  交互绑定
 * ==================================================================== */
document.getElementById('btn-start').addEventListener('click', ()=>{
  document.getElementById('title-screen').classList.add('hidden');
  Stage.start();
});
document.getElementById('btn-again').addEventListener('click', ()=>{
  document.getElementById('end-screen').classList.remove('show');
  Stage.start();
});
document.getElementById('btn-pause').addEventListener('click', (e)=>{
  if(!Stage.running) return;
  Stage.paused=!Stage.paused;
  e.target.textContent = Stage.paused? '▶':'‖';
  if(!Stage.paused){ Stage.lastTs=performance.now(); } // 恢复时重置时间，避免 dt 跳变
});
document.getElementById('btn-restart').addEventListener('click', ()=>{
  document.getElementById('end-screen').classList.remove('show');
  Stage.start();
});
document.getElementById('btn-mute').addEventListener('click', (e)=>{
  Audio.muted=!Audio.muted;
  if(Audio.master) Audio.master.gain.value = Audio.muted?0:0.18;
  e.target.textContent = Audio.muted? '✕':'♪';
  e.target.style.color = Audio.muted? '#c94545':'';
});
// 点击舞台：跳过当前对话 / 空格暂停
document.getElementById('stage-wrap').addEventListener('click', ()=>{
  Stage.skipLine();
});
window.addEventListener('keydown', (e)=>{
  if(e.code==='Space'){ e.preventDefault(); document.getElementById('btn-pause').click(); }
  if(e.code==='Enter'){ Stage.skipLine(); }
});

/* 初始：在标题屏也跑一个静态背景动画，让画面不死 */
Stage.actors.watcher={x:58,y:114,pose:'idle',face:1,lit:false,bob:0};
Stage.actors.star={x:200,y:40,visible:true,bright:0.6,size:1,fallen:false};
Stage.env={towerLit:false,snow:false,fade:0,fadeDir:0,targetFade:0};
function titleBgLoop(ts){
  if(Stage.running) return; // 交由主循环
  const dt=0.016;
  updateParticles(dt);
  render(ts/1000);
  requestAnimationFrame(titleBgLoop);
}
requestAnimationFrame(titleBgLoop);
