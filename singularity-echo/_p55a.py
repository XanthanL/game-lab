# -*- coding: utf-8 -*-
"""Phase 5.5 移动端专项
   A 虚拟摇杆：模拟量转向 / 死区 / 下拉刹车 / 手指跑远重锚
   B 安全区：env(safe-area-inset-*) 收敛成四个 --safe-* 变量
   C 横竖屏：竖屏轻提示（点击永久忽略）+ 方向变化重算
   D 混用设备：真鼠标按下时从触屏切回键鼠
"""
import io, sys
P = 'index.html'
s = io.open(P, encoding='utf-8').read()
o = s
def rep(a, b, n=1):
    global s
    c = s.count(a)
    if c != n:
        print('MISS(%d/%d): %r' % (c, n, a[:90])); sys.exit(1)
    s = s.replace(a, b, n)

# ── B1 :root 安全区变量 ──────────────────────────────────────────────────
rep("  --z-float:20; --z-banner:20; --z-touch:21;     /* 横幅 / 飘字 / 触屏控件 */",
"""  --z-float:20; --z-banner:20; --z-touch:21;     /* 横幅 / 飘字 / 触屏控件 */
  /* 5.5 安全区：`viewport-fit=cover` 下刘海 / Home 条会压住贴边 UI。
     ⚠️ env() 只在 :root 里读一次，其余一律 calc(原值 + var(--safe-*)) ——
        每个用点各写一遍 env() 的结果必然是「改一处漏三处」。 */
  --safe-t:env(safe-area-inset-top,0px);
  --safe-r:env(safe-area-inset-right,0px);
  --safe-b:env(safe-area-inset-bottom,0px);
  --safe-l:env(safe-area-inset-left,0px);""")

# ── B2 HUD 三块与 FIRE 按钮避让 ─────────────────────────────────────────
rep(".hud-tl{position:absolute;top:16px;left:18px}",
    ".hud-tl{position:absolute;top:calc(16px + var(--safe-t));left:calc(18px + var(--safe-l))}")
rep(".hud-tc{position:absolute;top:12px;left:50%;transform:translateX(-50%);text-align:center}",
    ".hud-tc{position:absolute;top:calc(12px + var(--safe-t));left:50%;transform:translateX(-50%);text-align:center}")
rep(".hud-tr{position:absolute;top:12px;right:64px;text-align:right;",
    ".hud-tr{position:absolute;top:calc(12px + var(--safe-t));right:calc(64px + var(--safe-r));text-align:right;")
rep("  .hud-tr{right:58px;gap:2px}", "  .hud-tr{right:calc(58px + var(--safe-r));gap:2px}")
rep("  .hud-tc{top:104px}", "  .hud-tc{top:calc(104px + var(--safe-t))}")
rep("#firebtn{position:fixed;right:28px;bottom:34px;width:96px;height:96px;border-radius:50%;",
    "#firebtn{position:fixed;right:calc(28px + var(--safe-r));bottom:calc(34px + var(--safe-b));width:96px;height:96px;border-radius:50%;")
rep("#firebtn.hot{background:rgb(var(--c-cyan-rgb) / .2)}",
"""#firebtn.hot{background:rgb(var(--c-cyan-rgb) / .2)}
/* 5.5 竖屏提示：只在 触屏 + 竖屏 + 对局中 露一次，点一下永久忽略（存 nova-orient）。
   故意不做「几秒后自动消失」—— 那要引入一个说不清的时长常量，
   而「玩家自己点掉」既没有时长问题，也保证他真的看见了。 */
#orhint{position:fixed;left:50%;bottom:calc(150px + var(--safe-b));transform:translateX(-50%);
  z-index:var(--z-banner);display:flex;align-items:center;gap:9px;cursor:pointer;
  padding:9px 15px;border:1px solid rgb(var(--c-cyan-rgb) / .32);
  background:rgb(var(--c-void-rgb) / .8);color:rgb(var(--c-ink-rgb) / .8);
  font-size:var(--fs-3);letter-spacing:.1em;white-space:nowrap;
  opacity:0;transition:opacity var(--dur-2) var(--ease-ui)}
#orhint.on{opacity:1}
#orhint .dot{width:5px;height:5px;border-radius:50%;background:var(--c-amber);flex:0 0 auto}""")

# ── C1 markup ───────────────────────────────────────────────────────────
rep("""<div id="firebtn" hidden data-page-node-id="kOVApTHQylI6VRfwthzr0C">FIRE</div>""",
"""<div id="firebtn" hidden data-page-node-id="kOVApTHQylI6VRfwthzr0C">FIRE</div>
<div id="orhint" hidden><span class="dot"></span><span data-i18n="or_hint">横屏体验更佳 · 点击忽略</span></div>""")

# ── i18n 英文表 ─────────────────────────────────────────────────────────
rep(" hud_mute:'Sound — M',hud_pause:'Pause — P',",
    " or_hint:'Landscape plays better — tap to dismiss',\n hud_mute:'Sound — M',hud_pause:'Pause — P',")

# ── el 缓存 ─────────────────────────────────────────────────────────────
rep("  joybase:$('joybase'),joyknob:$('joyknob'),firebtn:$('firebtn'),",
    "  joybase:$('joybase'),joyknob:$('joyknob'),firebtn:$('firebtn'),orhint:$('orhint'),")

# ── A1 摇杆常量 + joy 字段 ──────────────────────────────────────────────
rep("const joy={id:null,ox:0,oy:0,dx:0,dy:0,on:false};",
"""/* ---- 5.5 虚拟摇杆参数 ----
   ⚠️ 改前是 P.angle += clamp(angDiff, ±10*dt)：一条**恒定**的斜率，
      实测推 3px 和推 46px 在 0.5s 内都转满 90°，且 1px 就开始转 ——
      也就是杆只是个「方向开关」。5.2 明确要求手柄「模拟量不退化成开关」，
      移动端却漏了同一条，这里补齐。 */
const JOY_R=46,             // 杆最大位移 px（与 #joyknob 直径对齐，别只改一边）
      JOY_DZ=0.18,          // 死区（占 JOY_R）：手指静止时的抖动不该让船自转
      JOY_TURN_MIN=0.45,    // 死区边缘的转向倍率（相对 P.turn）—— 微调要慢
      JOY_TURN_MAX=2.2,     // 满舵倍率：4.4 rad/s × 2.2 ≈ 旧的 10 rad/s，手感不变
      JOY_BRK=0.62,         // 下拉超过此比例算刹车（对齐 5.2 手柄 ay>0.5）
      JOY_THR=0.12,         // 推进阈值：刚出死区就点火太敏感
      JOY_FOLLOW=2.2;       // 手指超出 2.2R 才重锚底盘（见 touchmove）
const joy={id:null,ox:0,oy:0,dx:0,dy:0,on:false,mag:0,nx:0,ny:0};
/* 死区 → 重映射 → 归一化，与 5.2 padScan 同一套做法：
   两种模拟量输入（手柄 / 触屏）的语义必须一致，否则玩家换个设备手要重新学。 */
function joyRead(){
  if(!joy.on){joy.mag=0;joy.nx=0;joy.ny=0;return;}
  const m=Math.hypot(joy.dx,joy.dy);
  if(m<=0){joy.mag=0;joy.nx=0;joy.ny=0;return;}
  const n=Math.min(m,JOY_R)/JOY_R;
  if(n<JOY_DZ){joy.mag=0;joy.nx=0;joy.ny=0;return;}
  joy.mag=Math.min(1,(n-JOY_DZ)/(1-JOY_DZ));
  joy.nx=joy.dx/m*joy.mag;joy.ny=joy.dy/m*joy.mag;
}""")

# ── C2 竖屏提示逻辑（放在 setTouch 之后，此时 G 已就绪） ─────────────────
rep("""function inRun(){return G.mode==='play'||G.mode==='inter'||G.mode==='levelup'||G.mode==='dying';}""",
"""function inRun(){return G.mode==='play'||G.mode==='inter'||G.mode==='levelup'||G.mode==='dying';}
/* ---- 5.5 竖屏提示 ----
   ⚠️ 不能从 resize() 里调：resize() 在脚本求值时就跑了一次，那时 G 还在 TDZ，
      连 typeof G 都会抛。所以单独挂 resize / orientationchange 监听。 */
const OR_KEY='nova-orient';
let orHidden=false;try{orHidden=localStorage.getItem(OR_KEY)==='1';}catch(e){}
function orientHint(){
  const h=el&&el.orhint;if(!h)return;
  const show=isTouch&&innerWidth<=innerHeight&&!orHidden&&inRun();
  if(show&&h.hidden){h.hidden=false;requestAnimationFrame(()=>h.classList.add('on'));}
  else if(!show&&!h.hidden){h.classList.remove('on');h.hidden=true;}
}
el.orhint.addEventListener('click',()=>{
  orHidden=true;try{localStorage.setItem(OR_KEY,'1');}catch(e){}orientHint();
});
window.addEventListener('resize',orientHint);
window.addEventListener('orientationchange',()=>{resize();orientHint();});""")

# ── A2 touchstart：起杆后立刻算一次归一化量 ─────────────────────────────
rep("""      joy.id=t.identifier;joy.ox=t.clientX;joy.oy=t.clientY;joy.dx=0;joy.dy=0;joy.on=true;
      el.joybase.hidden=false;el.joybase.style.left=joy.ox+'px';el.joybase.style.top=joy.oy+'px';""",
"""      joy.id=t.identifier;joy.ox=t.clientX;joy.oy=t.clientY;joy.dx=0;joy.dy=0;joy.on=true;
      joyRead();
      el.joybase.hidden=false;el.joybase.style.left=joy.ox+'px';el.joybase.style.top=joy.oy+'px';""")

# ── A3 touchmove：径向钳制 + 手指跑远重锚 ───────────────────────────────
rep("""    if(t.identifier===joy.id){
      let dx=t.clientX-joy.ox,dy=t.clientY-joy.oy;
      const m=Math.hypot(dx,dy);
      if(m>46){dx*=46/m;dy*=46/m;}
      joy.dx=dx;joy.dy=dy;
      el.joyknob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    }""",
"""    if(t.identifier===joy.id){
      let dx=t.clientX-joy.ox,dy=t.clientY-joy.oy;
      let m=Math.hypot(dx,dy);
      /* 手指拖出 2.2R：把底盘挪到「手指 − R」处再钳一次。
         这样杆仍停在满舵边缘、朝向**连续**，不会像「底盘瞬移到手指下」那样
         让 dx/dy 归零、船突然停转。小幅操作时不重锚，杆正常贴边。 */
      if(m>JOY_R*JOY_FOLLOW){
        joy.ox=t.clientX-dx/m*JOY_R;joy.oy=t.clientY-dy/m*JOY_R;
        el.joybase.style.left=joy.ox+'px';el.joybase.style.top=joy.oy+'px';
        dx=t.clientX-joy.ox;dy=t.clientY-joy.oy;m=Math.hypot(dx,dy);
      }
      if(m>JOY_R){dx*=JOY_R/m;dy*=JOY_R/m;}
      joy.dx=dx;joy.dy=dy;
      el.joyknob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
      joyRead();
    }""")

rep("""    if(t.identifier===joy.id){joy.id=null;joy.on=false;joy.dx=0;joy.dy=0;el.joybase.hidden=true;}""",
"""    if(t.identifier===joy.id){joy.id=null;joy.on=false;joy.dx=0;joy.dy=0;joyRead();el.joybase.hidden=true;}""")

# ── D 混用设备：真鼠标按下时切回键鼠 ────────────────────────────────────
rep("""window.addEventListener('pointerdown',()=>AU.ensure(),{once:false});""",
"""/* ⚠️ 必须用 pointerType==='mouse' 判断：触屏会产生合成的 mouse 事件，
   只靠 mousedown 会让触屏笔记本在两种模式间反复横跳。 */
window.addEventListener('pointerdown',e=>{AU.ensure();if(e.pointerType==='mouse')setTouch(false);},{passive:true});""")

# ── A4 消费点：模拟量转向 ───────────────────────────────────────────────
rep("""  if(joy.on&&(joy.dx||joy.dy)){
    const want=Math.atan2(joy.dy,joy.dx);
    P.angle+=clamp(angDiff(P.angle,want),-10*dt,10*dt);
  }else if(aimMode==='key'){""",
"""  joyRead();
  if(joy.mag>0){
    /* 杆指向哪就朝哪转，但**转多快取决于推多远**：满舵 ≈ 旧手感，
       轻推只有 0.45 倍 → 微调精细。这就是「模拟量」与「开关」的区别。 */
    const want=Math.atan2(joy.dy,joy.dx);
    const rate=P.turn*(JOY_TURN_MIN+(JOY_TURN_MAX-JOY_TURN_MIN)*joy.mag);
    P.angle+=clamp(angDiff(P.angle,want),-rate*dt,rate*dt);
  }else if(aimMode==='key'){""")

# ── A5 消费点：推进 / 刹车 ──────────────────────────────────────────────
rep("""  let thrust=0;
  if(keyDown('thrust')||PAD.ay<-0.35)thrust=1;   // 5.1 KEYMAP / 5.2 摇杆上推 = 推进
  if(joy.on&&Math.hypot(joy.dx,joy.dy)>10)thrust=1;
  P.thrusting=thrust>0;""",
"""  let thrust=0;
  if(keyDown('thrust')||PAD.ay<-0.35)thrust=1;   // 5.1 KEYMAP / 5.2 摇杆上推 = 推进
  /* 5.5 触屏：下拉到 JOY_BRK 以下是**刹车**而不是「也在推进」——
     改前 up 和 down 都 thrust=1，手机上根本没有减速手段。 */
  if(joy.mag>0){ if(joy.ny>JOY_BRK)joyBrake=1; else if(joy.mag>JOY_THR)thrust=1; }
  P.thrusting=thrust>0;""")

rep("""  if(keyDown('brake')||PAD.brake||PAD.ay>0.5){   // 5.1 KEYMAP / 5.2 LT·LB 或摇杆下拉
    const k=Math.exp(-2.6*dt);P.vx*=k;P.vy*=k;
  }""",
"""  if(keyDown('brake')||PAD.brake||PAD.ay>0.5||joyBrake){   // 5.1 / 5.2 / 5.5 触屏下拉
    const k=Math.exp(-2.6*dt);P.vx*=k;P.vy*=k;
  }
  joyBrake=0;""")

# joyBrake 是每帧的局部开关，声明在 updatePlayer 里
rep("""  const hullId=(G.lastHull&&G.lastHull.id)||'peregrine';
  const tl=hullTail(hullId); // 船尾到中点的距离：尾流/喷焰从此处起喷""",
"""  const hullId=(G.lastHull&&G.lastHull.id)||'peregrine';
  const tl=hullTail(hullId); // 船尾到中点的距离：尾流/喷焰从此处起喷
  let joyBrake=0;            // 5.5 触屏下拉刹车：本帧有效，帧末清零""")

# ── C3 提示的显隐时机（跟着 FIRE 按钮的对局进出走） ─────────────────────
rep("  el.hud.hidden=false;el.firebtn.hidden=!isTouch;",
    "  el.hud.hidden=false;el.firebtn.hidden=!isTouch;orientHint();")
rep("  el.firebtn.hidden=!isTouch;\n", "  el.firebtn.hidden=!isTouch;orientHint();\n")

if s != o:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('OK lines=%d' % (s.count('\n') + 1))
