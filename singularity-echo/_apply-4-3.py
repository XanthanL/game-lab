# -*- coding: utf-8 -*-
"""Phase 4.3 新船体「熔炉 FORGE」—— 单次原子替换，逐条断言命中数。"""
import io, sys, re

P = 'index.html'
src = io.open(P, encoding='utf-8').read()
orig = src
n = 0

def rep(old, new, tag):
    global src, n
    c = src.count(old)
    if c != 1:
        print('FAIL[%s] count=%d' % (tag, c)); sys.exit(1)
    src = src.replace(old, new, 1)
    n += 1
    print('  ok %-22s %d -> %d (+%d)' % (tag, len(old), len(new), len(new) - len(old)))

# ---- 1. CSS：过热槽 ----------------------------------------------------
rep(
"#shieldbar i{background:linear-gradient(90deg,var(--c-shield-a),var(--c-shield-b));display:block;height:100%;transition:width var(--dur-2) var(--ease-ui)}",
"""#shieldbar i{background:linear-gradient(90deg,var(--c-shield-a),var(--c-shield-b));display:block;height:100%;transition:width var(--dur-2) var(--ease-ui)}
/* 过热槽（Phase 4.3）：仅「熔炉」船体显示 —— 冷膛黄铜烧到满膛朱砂，锁膛时整行转警示色 */
#heatrow{width:min(220px,34vw);margin-top:3px;display:flex;align-items:center;gap:6px}
#heatrow .lab{font-family:'JetBrains Mono',monospace;font-size:var(--fs-1);line-height:1;
  letter-spacing:.06em;color:rgb(var(--c-steel-rgb) / .62);transform:skewX(-16deg);
  transition:color var(--dur-2) var(--ease-ui)}
.bar.heat{flex:1;width:auto;height:5px;margin-top:0;border-color:rgb(var(--c-amber-rgb) / .34)}
.bar.heat i{background:linear-gradient(90deg,var(--c-amber),var(--c-danger-hi))}
#heatrow.lock .lab{color:var(--c-danger-hi)}
#heatrow.lock .bar.heat{border-color:rgb(var(--c-danger-rgb) / .85)}""",
'css-heatrow')

# ---- 2. HTML：过热槽节点 ----------------------------------------------
rep(
'    <div id="abrow" hidden data-page-node-id="C5s330H6LRLaA9BSskERcs"></div>',
'''    <div id="heatrow" hidden data-page-node-id="4p3heatrowQ7xLmN2vB5">
      <span class="lab mono" data-page-node-id="4p3heatlabK2wR8tYzA6">HEAT</span>
      <div class="bar heat" data-page-node-id="4p3heatbarN5dF3sVpC9"><i id="heatbar" style="width:0%" data-page-node-id="4p3heatfillJ8hM1qWeD4"></i></div>
    </div>
    <div id="abrow" hidden data-page-node-id="C5s330H6LRLaA9BSskERcs"></div>''',
'html-heatrow')

# ---- 3. el 映射 --------------------------------------------------------
rep(
"  lv:$('lv'),xp:$('xpbar'),abrow:$('abrow'),strow:$('strow'),wave:$('wavelabel'),enleft:$('enleft'),",
"  lv:$('lv'),xp:$('xpbar'),abrow:$('abrow'),strow:$('strow'),heatrow:$('heatrow'),heatbar:$('heatbar'),\n  wave:$('wavelabel'),enleft:$('enleft'),",
'el-map')

# ---- 4/5. 机库英文文案 -------------------------------------------------
rep(
" nemesis:'Final wreck: a touch better everywhere, +12% fire rate, +30% pickup, +10% max hull',\n};",
" nemesis:'Final wreck: a touch better everywhere, +12% fire rate, +30% pickup, +10% max hull',\n"
" forge:'Overheat rifling: sustained fire builds heat — damage scales 0.85x cold to 1.45x full, and topping out jams the barrel for 1.7s. +10% fire rate, +12% bullet speed, -8% max hull',\n};",
'hull-en')

rep(
" nemesis:'Clear wave 30 — shatter the Nemesis Echo to unlock',\n};",
" nemesis:'Clear wave 30 — shatter the Nemesis Echo to unlock',\n"
" forge:'Clear wave 40 — shatter the Collapse Core to unlock',\n};",
'hull-lock-en')

# ---- 6. newPlayer 字段 -------------------------------------------------
rep(
"  boostT:0,rateT:0,jamT:0,jamF:1,jamS:1, // jamF/jamS：干扰场的射速/极速倍率（由施加者写入，1=无干扰）",
"  boostT:0,rateT:0,jamT:0,jamF:1,jamS:1, // jamF/jamS：干扰场的射速/极速倍率（由施加者写入，1=无干扰）\n"
"  heat:0,heatMul:1,heatLock:0,heatOn:false, // 熔炉过热（4.3）：heatOn 仅「熔炉」为 true，其余船体 heat 恒 0、heatMul 恒 1",
'newplayer')

# ---- 7. 过热常量 + 8. HULLS 新增 --------------------------------------
rep(
"/* ============================== hulls ============================== */\nconst HULLS=[",
"""/* ============================== hulls ============================== */
/* ---- 熔炉过热（Phase 4.3）----
   持续开火累积热量：**累积速率恒定**，与射速解耦 —— 否则高射速构筑会在 1 秒内烧穿、
   过热从"节奏取舍"退化成"不许点射"，与「越堆射速越吃亏」的设计意图相悖。
   伤害在冷膛 HEAT_COLD 与满膛 HEAT_HOT 之间线性浮动，热量见顶锁死炮膛强制散热。
   ⚠️ HEAT_VENT 必须与 HEAT_MAX/HEAT_LOCK 对齐（锁膛结束时正好排空），
      否则会出现"解锁瞬间还残留热量、立刻二次过热"的抖动。 */
const HEAT_MAX=100;    // 热量上限
const HEAT_UP=30;      // 开火时每秒累积 —— 满膛 3.3s，与射速无关
const HEAT_COOL=34;    // 停火时每秒散热 —— 满膛排空约 2.9s
const HEAT_LOCK=1.7;   // 锁膛时长
const HEAT_VENT=HEAT_MAX/HEAT_LOCK; // 锁膛期间每秒强制散热（约 58.8 —— 刚好排空）
const HEAT_COLD=0.85;  // 冷膛伤害倍率
const HEAT_HOT=1.45;   // 满膛伤害倍率
const HULLS=[""",
'heat-const')

rep(
"    lockNote:'肃清第 30 波 · 击碎终焉回响后解锁'},\n];",
"    lockNote:'肃清第 30 波 · 击碎终焉回响后解锁'},\n"
"  {id:'forge',zh:'熔炉',en:'Forge',g:'❖',\n"
"    desc:'过热膛线：持续开火累积热量 —— 伤害在冷膛 0.85× 与满膛 1.45× 之间浮动，热量见顶锁死炮膛 1.7 秒；射速 +10%、弹速 +12%，最大船体 -8%',\n"
"    apply:()=>{P.heatOn=true;P.fireRate*=1.10;P.bspd*=1.12;\n"
"      P.maxHp=Math.round(P.maxHp*0.92);P.hp=P.maxHp;},\n"
"    lockNote:'肃清第 40 波 · 击碎坍缩之核后解锁'},\n];",
'hulls-forge')

# ---- 9. 解锁门禁 -------------------------------------------------------
rep(
"  if(id==='raven'||id==='nemesis')return loadHullArr().includes(id);",
"  if(id==='raven'||id==='nemesis'||id==='forge')return loadHullArr().includes(id);",
'hull-unlocked')

# ---- 10. 机库数字键 1-6 -> 1-7 ----------------------------------------
rep(
"  if(G.mode==='hulls'&&/^Digit[1-6]$/.test(e.code)){pickHull(+e.code.slice(5)-1);return;}",
"  if(G.mode==='hulls'&&/^Digit[1-7]$/.test(e.code)){pickHull(+e.code.slice(5)-1);return;}",
'hull-digit')

# ---- 11. W40 坍缩之核击碎 -> 解锁熔炉 ---------------------------------
rep(
"    else if(k==='collapse')banner('SINGULARITY CLOSED',T('坍缩之核已闭合 —— 奇点回响归于沉寂','The Collapse Core has closed — the singularity echo falls silent'));",
"""    else if(k==='collapse'){
      banner('SINGULARITY CLOSED',T('坍缩之核已闭合 —— 奇点回响归于沉寂','The Collapse Core has closed — the singularity echo falls silent'));
      if(unlockHull('forge'))banner('HULL UNLOCKED',T('新船体「熔炉」已解锁 —— 机库中查看','New hull FORGE unlocked — check the hangar'));
    }""",
'unlock-w40')

# ---- 12. 弹丸伤害吃过热倍率 -------------------------------------------
rep(
"      r:3,dmg:P.dmg,life:P.rangeLife,pierce:P.pierce,ric:P.ricochet,homing:P.homing,",
"      r:3,dmg:P.dmg*P.heatMul,life:P.rangeLife,pierce:P.pierce,ric:P.ricochet,homing:P.homing,",
'heat-dmg-main')

rep(
"      r:2.6,dmg:P.dmg*P.backPow,life:P.rangeLife,pierce:P.pierce,ric:P.ricochet,homing:P.homing,",
"      r:2.6,dmg:P.dmg*P.backPow*P.heatMul,life:P.rangeLife,pierce:P.pierce,ric:P.ricochet,homing:P.homing,",
'heat-dmg-back')

# ---- 13. updatePlayer：过热推进 + 锁膛禁火 ----------------------------
rep(
"""  const wantFire=mouse.down||keys.Space||fireOn;
  if(wantFire&&P.fireCd<=0){""",
"""  const wantFire=mouse.down||keys.Space||fireOn;
  /* 熔炉过热（Phase 4.3）：开火蓄热 / 停火散热 / 见顶锁膛 —— heatMul 每帧刷新，
     供 fireGun 直接乘进弹丸伤害（非熔炉船体 heatOn=false，heatMul 恒为 1） */
  let canFire=wantFire;
  if(P.heatOn){
    if(P.heatLock>0){
      canFire=false;
      P.heatLock=Math.max(0,P.heatLock-dt);
      P.heat=Math.max(0,P.heat-HEAT_VENT*dt);
      if(P.heatLock<=0){P.heat=0;ring(P.x,P.y,26,'236,208,138');AU.noise({t:0.2,g:0.075,fc:2400,fc1:420});}
    }else if(wantFire){
      P.heat=Math.min(HEAT_MAX,P.heat+HEAT_UP*dt);
      if(P.heat>=HEAT_MAX){P.heatLock=HEAT_LOCK;ring(P.x,P.y,32,'255,190,90');
        burst(P.x,P.y,10,150,0.4,'255,190,90',1.8);AU.noise({t:0.26,g:0.1,fc:900,fc1:180});}
    }else P.heat=Math.max(0,P.heat-HEAT_COOL*dt);
    P.heatMul=HEAT_COLD+(HEAT_HOT-HEAT_COLD)*(P.heat/HEAT_MAX);
  }
  if(canFire&&P.fireCd<=0){""",
'heat-update')

# ---- 14. HULL_TINT ----------------------------------------------------
rep(
"  nemesis:{fill:'#16151a',line:'#eff4fa',glow:'228,233,240'},     /* 铅白 —— 回响 */\n};",
"  nemesis:{fill:'#16151a',line:'#eff4fa',glow:'228,233,240'},     /* 铅白 —— 回响 */\n"
"  forge:{fill:'#1a0e07',line:'#f0a468',glow:'236,132,58'},        /* 熔铜 —— 熔炉 */\n};",
'hull-tint')

# ---- 15. HULL_TAIL ----------------------------------------------------
rep(
"const HULL_TAIL={peregrine:12,rapier:15,bulwark:12,raven:14,swarm:16,nemesis:16};",
"const HULL_TAIL={peregrine:12,rapier:15,bulwark:12,raven:14,swarm:16,nemesis:16,forge:15};",
'hull-tail')

# ---- 16. TRAIL_RAMP ---------------------------------------------------
rep(
"  nemesis:['152,146,136','216,210,196','252,250,244'],\n};",
"  nemesis:['152,146,136','216,210,196','252,250,244'],\n"
"  forge:['198,96,38','244,164,98','255,246,232'],\n};",
'trail-ramp')

# ---- 17. HULL_GEO -----------------------------------------------------
rep(
"  nemesis:  {n:20,t:-16,cy:9, gx:-13.8,ribs:[[15,3.4],[8,5.4],[1,7.6],[-4,10.6],[-9,7.0]]},\n};",
"  nemesis:  {n:20,t:-16,cy:9, gx:-13.8,ribs:[[15,3.4],[8,5.4],[1,7.6],[-4,10.6],[-9,7.0]]},\n"
"  forge:    {n:19,t:-15,cy:8, gx:-12.8,ribs:[[14,3.0],[7,5.2],[0,7.0],[-5,9.0],[-10,6.2]]},\n};",
'hull-geo')

# ---- 18. hullPath 形状 -------------------------------------------------
rep(
"  }else{ // peregrine 流线隼形",
"""  }else if(id==='forge'){ // 熔炉：宽厚砧形机身 + 双侧散热鳍 + 方形炉尾喷口
    c.moveTo(19,0);c.lineTo(9,4.5);c.lineTo(2,5.2);c.lineTo(2,10.5);c.lineTo(-3,10.5);
    c.lineTo(-3,5.0);c.lineTo(-9,6.5);c.lineTo(-15,7);c.lineTo(-15,0);
    c.lineTo(-15,-7);c.lineTo(-9,-6.5);c.lineTo(-3,-5.0);c.lineTo(-3,-10.5);c.lineTo(2,-10.5);
    c.lineTo(2,-5.2);c.lineTo(9,-4.5);c.closePath();
  }else{ // peregrine 流线隼形""",
'hull-path')

# ---- 19. HUD 过热槽 ----------------------------------------------------
rep(
"""  w=hudW('xp',clamp(P.xp/P.xpNext*100,0,100));
  if(w)el.xp.style.width=HUDC.xp;""",
"""  w=hudW('xp',clamp(P.xp/P.xpNext*100,0,100));
  if(w)el.xp.style.width=HUDC.xp;
  // 过热槽：仅「熔炉」显示；换船体重开时 HUDC 不会自清，故切状态即作废宽度缓存强制重写一次
  const htOn=!!P.heatOn;
  if(HUDC.ht!==htOn){HUDC.ht=htOn;el.heatrow.hidden=!htOn;HUDC.heat=null;HUDC.hlk=null;}
  if(htOn){
    w=hudW('heat',clamp(P.heat/HEAT_MAX*100,0,100));
    if(w)el.heatbar.style.width=HUDC.heat;
    const lk=P.heatLock>0;
    if(HUDC.hlk!==lk){HUDC.hlk=lk;el.heatrow.classList.toggle('lock',lk);}
  }""",
'hud-heat')

# ---- 20. 成就「全舰制霸」6 -> 7 --------------------------------------
rep(
"""   d:'用全部 6 种船体各完成一次出击', de:'Fly all 6 hulls', goal:()=>6,""",
"""   d:'用全部 7 种船体各完成一次出击', de:'Fly all 7 hulls', goal:()=>7,""",
'ach-hull6')

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('\n%d patches applied, %d -> %d bytes (+%d)' % (n, len(orig), len(src), len(src) - len(orig)))
