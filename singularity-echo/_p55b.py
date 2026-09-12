# -*- coding: utf-8 -*-
"""5.5 测试钩子：NOVA.touch"""
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

rep("  stats:()=>({score:G.score,",
"""  /* ---- 5.5 触屏钩子 ----
     set(dx,dy) 直接喂杆量：断言要能「推 3px 和推 46px 转得不一样快」，
     靠派发真实 touch 事件做不到稳定复现（还受 passive / 合成事件影响）。 */
  touch:{
    const:()=>({R:JOY_R,DZ:JOY_DZ,TURN_MIN:JOY_TURN_MIN,TURN_MAX:JOY_TURN_MAX,
                BRK:JOY_BRK,THR:JOY_THR,FOLLOW:JOY_FOLLOW}),
    state:()=>({on:joy.on,dx:+joy.dx.toFixed(2),dy:+joy.dy.toFixed(2),
                mag:+joy.mag.toFixed(4),nx:+joy.nx.toFixed(4),ny:+joy.ny.toFixed(4)}),
    set:(dx,dy)=>{joy.on=true;joy.dx=dx;joy.dy=dy;joyRead();
      return {mag:+joy.mag.toFixed(4),nx:+joy.nx.toFixed(4),ny:+joy.ny.toFixed(4)};},
    clear:()=>{joy.id=null;joy.on=false;joy.dx=0;joy.dy=0;joyRead();},
    read:()=>{joyRead();return {mag:+joy.mag.toFixed(4),nx:+joy.nx.toFixed(4),ny:+joy.ny.toFixed(4)};},
    isTouch:()=>isTouch,
    setTouch:v=>{setTouch(!!v);return isTouch;},
    fire:()=>fireOn,
    /* 竖屏提示：hidden/on/ignored + 当前是否横屏 */
    orient:()=>({hidden:el.orhint.hidden,on:el.orhint.classList.contains('on'),
                 ignored:orHidden,land:innerWidth>innerHeight,touch:isTouch,run:inRun()}),
    sync:()=>{orientHint();return 1;},
    resetHint:()=>{orHidden=false;try{localStorage.removeItem(OR_KEY);}catch(e){}orientHint();},
    /* 安全区：读浏览器实际解析出的 env() 值（headless 下全为 0，只能验变量链路通不通） */
    safe:()=>{const cs=getComputedStyle(document.documentElement);
      return {t:cs.getPropertyValue('--safe-t').trim(),r:cs.getPropertyValue('--safe-r').trim(),
              b:cs.getPropertyValue('--safe-b').trim(),l:cs.getPropertyValue('--safe-l').trim()};},
    btnRect:()=>{const r=el.firebtn.getBoundingClientRect();
      return {right:Math.round(innerWidth-r.right),bottom:Math.round(innerHeight-r.bottom),
              w:Math.round(r.width),h:Math.round(r.height)};},
  },
  stats:()=>({score:G.score,""")

if s != o:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('OK lines=%d' % (s.count('\n') + 1))
