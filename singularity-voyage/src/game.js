'use strict';
// 奇点旅途 · 主逻辑
// 结构沿用终焉防火墙：单文件、无依赖。差异：
//  - 移动改为推进器惯性（WASD），瞄准为鼠标方向（不再自动锁敌）
//  - 关卡制（12 段航程 / 3 星区）而非无限生存
//  - 经验升级三选一模块，取代金币阈值
const W = 480, H = 270, DT = 1 / 60, TAU = Math.PI * 2;
/* ============ 世界 & 相机（2026-09-25：地图不再只有一屏） ============
   `W/H` 是**视口** —— 480×270 的画布，也是玩家实际看得见的范围，一直没变。
   `WORLD` 是**可活动空间**，比视口大：相机锁在飞船上（和《奇点回响》一样，
   回响那边是 2600×1700 的世界 + 相机跟随），所以**飞船的比例一个像素都没动**，
   变的只是「能飞多远」。3 倍 = 9 倍面积。
   ⚠️ 新增任何 clamp / cull 之前先问一句：它约束的是**世界**还是**视口**？
      - 世界边界（飞船 / 敌人 / 拾取物能到哪儿）：`WORLD.w/h`
      - 「玩家看得见的范围」（生成入场点、屏外裁剪、跳弹反弹）：`viewL()/viewT()/viewR()/viewB()`
      混用这两套的后果不是报错，而是「敌人站在世界角落、子弹够不着」→ 这一波永远清不完。 */
const WORLD_SCALE = 3;
const WORLD = { w: W * WORLD_SCALE, h: H * WORLD_SCALE };
// 相机中心（世界坐标）。视口 = [cam.x ± W/2] × [cam.y ± H/2]
const cam = { x: WORLD.w / 2, y: WORLD.h / 2 };
const viewL = () => cam.x - W / 2, viewT = () => cam.y - H / 2;
const viewR = () => cam.x + W / 2, viewB = () => cam.y + H / 2;
// 锁在玩家身上，再把视口夹进世界（世界比视口大，所以永远夹得动）。
// ⚠️ 必须夹 —— 不夹的话玩家一走到世界边缘，视口就会露到世界外面（黑边）。
function updateCam() {
  if (!G) return;
  cam.x = clamp(G.px, W / 2, WORLD.w - W / 2);
  cam.y = clamp(G.py, H / 2, WORLD.h - H / 2);
}
const $ = id => document.getElementById(id);
// ⚠️ 主画布必须关掉图像平滑 —— 这是像素游戏，**而且它原来根本没关**
//    （旁边的机库预览 / 图鉴图标都关了，就主画布漏了）。
//    ① 画质：任何非整数落点或缩放的 drawImage 都会被插值糊掉，和 CSS 的
//       image-rendering:pixelated 无关（那个只管画布**放大到屏幕**的那一层）。
//    ② 性能：双线性插值的采样成本高于最近邻，profile 里 drawImage 是最大头（~28%）。
//    已确认主画布上没有依赖插值的缩放绘制（全整数落点、原尺寸贴图），且画布尺寸全程不变
//    （改 canvas.width 会把上下文状态整个重置，那时才需要重新设）。
const cv = $('game'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const wrap = $('wrap');
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const QS = new URLSearchParams(location.search);
const BOT = QS.has('bot'), GOD = QS.has('god'), FAST = +QS.get('fast') || 1;
// ?kit=N 开局装满 N 级模块 / ?kit=all 装满满级 —— 只为了一眼看满装配的飞船长什么样。
// ⚠️ 必须带值（QS.get 不带值时返回空串，falsy，整个入口会被静默跳过）。
const KIT = QS.get('kit') || '';
const fmtTime = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

let state = 'loading', G = null, scale = 1, offX = 0, offY = 0, rot = 0;
// 主题化加载动画最短展示时长（ms）。必须和 style.css 里 .ld-bar i 的 ldfill 时长一致，
// 否则进度条还没满就切到标题页，看着像「卡了一下」。本地资源是同步加载、boot 一瞬间
// 跑完，不延时动画根本看不到。
const LOADING_MIN = 2200;
let STARSETS = null, ROCKS = null;
let touchMode = false, hangarSel = 0;
// 触屏开火开关（右下角那颗大按钮）。作者口径：**默认关** —— 想开火自己点一下。
// ⚠️ 它只喂 updatePlayer 里的 G.autoFire，和 mouse.down / Space 是「或」关系；
//    桌面端 touchMode 恒 false、按钮也不显示，所以「按住才开火」的手感一点没变
//    （平衡性探针的基线因此也不会被带跑）。
let autoFire = false;
// 混合设备（触屏笔记本）上鼠标和手指会交替用。这个只用来决定准星画哪种样式，
// 判定走 pointer 事件的 pointerType —— 触屏点按之后浏览器会补一发兼容性 mousemove，
// 拿 mousemove 判会把状态误判回鼠标，准星会一闪一闪。
let pointerKind = 'mouse';
const keys = {}, mouse = { x: W / 2, y: H / 2, down: false, inside: false };
// 触屏双杆的几何（单位：游戏坐标 px，画布就是 480×270，游戏坐标 == 画布坐标）
const MOVE_R = 40, MOVE_DZ = 0.12;   // 左杆：满舵半径 / 死区（沿用原值，别动，推力与刹车的阈值就挂在它上面）
const AIM_R = 40, AIM_DZ = 8;        // 右杆：满舵半径 / 死区（死区是**像素**不是比例，理由见 touchmove）
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
// 跟奇点回响对齐的「最近一次输入决定朝向控制方式」：
// 'key' = A/D 转向；'mouse' = 朝鼠标方向缓慢转向。光标动了切到 mouse；A/D 一按切回 key。
// ⚠️ 必须用 var 而不是 let —— 探针通过 window.aimMode 读这个状态，
//    plain <script> 下 let 是 script-scope，不会挂到 window。
var aimMode = 'key';
// 手机版炮口朝向 G.aim 与船体朝向 G.ang **解耦**：
// 船体跟着左杆（推向哪就朝哪、并沿船头推进）；炮口由右杆独立设定。
// ⚠️ 右杆是**相对位移**杆（手指从落点往哪拖 = 炮口朝哪），不是「指哪打哪」的绝对指向。
//    绝对指向在手机上是死路：相机夹取让船恒在屏幕正中，而右半屏的触点 dx 恒为正
//    → 炮口只能落在右半平面，左边整 180° 根本够不到（实测可达区间恰好 [-90°, +90°]）。
let touchAim = -Math.PI / 2;
const aimDrag = { id: null, ox: 0, oy: 0, x: 0, y: 0, mag: 0 };

// ============ 像素文字（缓存 canvas） ============
const tcache = new Map();
function textSpr(str, color, size, outline) {
  const key = str + '|' + color + '|' + size + '|' + (outline || '');
  let c = tcache.get(key); if (c) return c;
  // 测量复用同一个 context —— 见下面 measure() 那条注释
  const m = _measureCtx();
  m.font = size + 'px FP, monospace';
  const w = Math.ceil(m.measureText(str).width) + 4;
  c = document.createElement('canvas'); c.width = w; c.height = size + 6;
  const x = c.getContext('2d');
  x.font = size + 'px FP, monospace'; x.textBaseline = 'top';
  if (outline) {
    x.fillStyle = outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]])
      x.fillText(str, 2 + dx, 2 + dy);
  }
  x.fillStyle = color; x.fillText(str, 2, 2);
  // ⚠️ 满了要**淘汰最旧的**，不能整表 clear。
  //    HUD 上每帧都在变的东西（分数 / 血量 / 波次计时）会不断产生新 key，
  //    整表清空 = 「刚缓存好就全扔掉、下一帧全部重建」，profile 里 measureText+fillText
  //    那 ~5% 的抖动主要来自这里。Map 保持插入顺序，从头部删就是 FIFO。
  if (tcache.size > 900) {
    let n = 300;
    for (const k of tcache.keys()) { if (n-- <= 0) break; tcache.delete(k); }
  }
  tcache.set(key, c); return c;
}
function text(str, x, y, color = '#f4f4f4', align = 'l', size = 12, outline = '#1a1c2c') {
  const c = textSpr(str, color, size, outline);
  let px = x;
  if (align === 'c') px = x - c.width / 2;
  else if (align === 'r') px = x - c.width;
  ctx.drawImage(c, Math.round(px), Math.round(y));
  return c.width;
}
// ⚠️ 测量用的 2d context **只建一次**。旧版每次调用都 createElement('canvas') + getContext，
//    HUD 一帧要量几十次 = 每帧几十个 canvas 元素白建白扔（profile 里 getContext 单独占一份）。
//    文字缓存（textSpr）也复用它。
let _mctx = null;
const _measureCtx = () => (_mctx || (_mctx = document.createElement('canvas').getContext('2d')));
const measure = (str, size = 12) => {
  const m = _measureCtx();
  m.font = size + 'px FP, monospace';
  return Math.ceil(m.measureText(str).width);
};

/* ============ 中英显示小工具（文案表在 i18n.js，这里只做取词） ============
   ⚠️ 船体 / 巨像 / 星区这三张表本来就是「中文名 + 英文副标题」的双语结构
      （HULLS.en / BOSSES.en / ZONES.en 是给**中文界面**当下标的，比如机库卡面上
       「游隼」下面那行 PEREGRINE），所以它们**不走 L()** —— L() 找的是 `nameEn`。
      中文模式下要保留副标题，英文模式下只留英文名（`en` 当主名）。 */
const name1 = o => (isEn() && o.en) ? o.en : o.name;   // 主名
const sub1 = o => isEn() ? '' : (o.en || '');           // 英文副标题（只有中文模式显示）
// 巨像显示名：语言是运行时可切的，所以**按当前语言现算**，不能用生成时定死的 e.name
// （否则一局打到一半切语言，巨像名字还是旧语言）。
const bossName = e => { const b = BOSSES[e.boss]; return b ? name1(b) : (e.name || ''); };

// ============ 像素图元 ============
function disc(cx, cy, r) {
  ctx.beginPath(); ctx.arc(Math.round(cx) + .5, Math.round(cy) + .5, r, 0, TAU); ctx.fill();
}
function ringPx(cx, cy, r, th = 1) {
  ctx.beginPath(); ctx.arc(Math.round(cx) + .5, Math.round(cy) + .5, r, 0, TAU);
  ctx.lineWidth = th; ctx.stroke();
}
function pline(x0, y0, x1, y1, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
// 1px 的像素方框：全用 fillRect，没有抗锯齿。准星和摇杆底座都靠它保持硬边。
function framePx(x, y, w, h) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}

// ============ 船体 ============
/* ⚠️ 船体卡是**固定高度**的（.hull 168px，.hdesc 是 flex:1），英文描述写长了会溢出到
   底下的统计条上（中文 5 行 = 65px 已经是上限）。所以 descEn 一律控制在 ~40 字符内。 */
const HULLS = [
  {
    id: 'peregrine', name: '游隼', en: 'PEREGRINE', tag: '均衡', tagEn: 'BALANCED', color: '#73eff7',
    desc: '没有短板的侦查机。\n适合第一次启程。',
    descEn: 'A scout with no weak\nspot. Great first ship.',
    trait: '三项都是 100% —— 没有短板，也没有长板',
    traitEn: 'All three stats at 100% — no weakness, no strength',
    hp: 100, spd: 1.00, dmg: 1.00, rate: 1.00, turn: 1.00,
  },
  {
    id: 'rapier', name: '轻剑', en: 'RAPIER', tag: '玻璃炮', tagEn: 'GLASS CANNON', color: '#ef7d57',
    desc: '推重比拉满，装甲削到最低。\n快，但挨不了几下。',
    descEn: 'Max thrust, minimum\narmour. Fast but fragile.',
    trait: '速度 120% / 火力 114%，代价是船体只有 78',
    traitEn: 'Speed 120% / power 114%, but only 78 hull',
    hp: 78, spd: 1.20, dmg: 1.14, rate: 1.16, turn: 1.15,
  },
  {
    id: 'bulwark', name: '堡垒', en: 'BULWARK', tag: '重装', tagEn: 'HEAVY', color: '#a7f070',
    desc: '厚壳、慢、稳。\n用血量换容错。',
    descEn: 'Thick, slow, steady.\nTrades speed for margin.',
    trait: '船体 150 全场最高，代价是转得慢、火力 90%',
    traitEn: '150 hull — the highest — but slow turning and 90% power',
    hp: 150, spd: 0.86, dmg: 0.90, rate: 0.86, turn: 0.82,
  },
  {
    id: 'raven', name: '玄鸦', en: 'RAVEN', tag: '刺客', tagEn: 'ASSASSIN', color: '#c070f0',
    desc: '装甲薄到能看穿。\n换来的是一击必杀的暴击率。',
    descEn: 'Paper-thin armour, in\nexchange for lethal crits.',
    trait: '10% 暴击、暴击 3 倍，但船体只有 62',
    traitEn: '10% crit at 3x, but only 62 hull',
    hp: 62, spd: 1.28, dmg: 1.10, rate: 1.20, turn: 1.30,
    crit: 0.10, critMul: 3.0,
    unlock: { kills: 300, text: '累计击坠 300', textEn: '300 total kills' },
  },
  {
    id: 'swarm', name: '蜂群', en: 'SWARM', tag: '编队', tagEn: 'SQUADRON', color: '#ffcd75',
    desc: '出击就带两架僚机。\n自己不开火也能打。',
    descEn: 'Launches with two\nwingmen that fire for you.',
    trait: '开局自带 2 架僚机，拾取范围 +30%',
    traitEn: 'Starts with 2 wingmen and +30% pickup range',
    hp: 92, spd: 1.06, dmg: 0.86, rate: 0.94, turn: 1.05,
    drones: 2, magnetMul: 1.3,
    unlock: { wave: 10, text: '航程抵达第 10 段', textEn: 'Reach wave 10' },
  },
  // 下面两台是从《奇点回响》搬过来的（2026-09-26）：回响 = 终局全能船，熔炉 = 过热膛线。
  // 数值口径照 echo 的 apply() 换算成 voyage 的「相对 1.0 倍率」写法。
  {
    id: 'nemesis', name: '回响', en: 'NEMESIS', tag: '终焉', tagEn: 'ENDGAME', color: '#e8e2d4',
    desc: '终焉的残骸。\n每一项都比别人高一截。',
    descEn: 'The wreck at the end.\nBetter at everything.',
    trait: '全属性小幅提升：船体 110 / 火力 108% / 射速 112% / 暴击 +4% / 拾取 +30%',
    traitEn: 'Small buff to all: 110 hull, 108% power, 112% rate, +4% crit, +30% pickup',
    hp: 110, spd: 1.04, dmg: 1.08, rate: 1.12, turn: 1.00,
    crit: 0.04, magnetMul: 1.3,
    unlock: { wave: 12, text: '航程抵达第 12 段', textEn: 'Reach wave 12' },
  },
  {
    id: 'forge', name: '熔炉', en: 'FORGE', tag: '过热', tagEn: 'OVERHEAT', color: '#f0a468',
    desc: '持续开火会积热。\n越烫打得越狠，见顶炸膛。',
    descEn: 'Holding fire builds heat.\nHotter hits harder.',
    trait: '过热膛线：伤害随热量在 85%↔145% 浮动，见顶锁膛 1.7 秒；射速 110% / 弹速 112%，船体 92',
    traitEn: 'Overheat rifling: 85%-145% damage by heat, 1.7s jam at max; 110% rate, 112% bullet speed, 92 hull',
    hp: 92, spd: 1.00, dmg: 1.00, rate: 1.10, turn: 1.00,
    heat: true, bspdMul: 1.12,
    unlock: { kills: 1500, text: '累计击坠 1500', textEn: '1500 total kills' },
  },
];

// ============ 敌型（12） ============
const ETYPES = {
  // trait = 图鉴里那一行「怎么对付它」。图鉴是纯数据驱动的、不另建文案表，
  //   所以新敌型只要带上 trait 就会自动进图鉴（和 EN_LIST 一样是派生出来的）。
  seeker:   { name: '追猎者', nameEn: 'SEEKER', spr: 'seeker',   hp: 14, spd: 54, r: 5, dmg: 8,  xp: 1, ai: 'chase',   trait: '直冲你当前的位置，转向偏慢 —— 侧滑一下就能甩开', traitEn: 'Charges straight in and turns slowly — sidestep it' },
  tadpole:  { name: '蝌蚪',   nameEn: 'TADPOLE', spr: 'tadpole',  hp: 18, spd: 46, r: 6, dmg: 8,  xp: 1, ai: 'wander',  trait: '不追人，四处游走；比杂兵厚一点，别让它堆着', traitEn: 'Wanders instead of chasing; tougher than it looks' },
  dart:     { name: '飞镖',   nameEn: 'DART', spr: 'dart',     hp: 16, spd: 62, r: 5, dmg: 12, xp: 1, ai: 'dash',    trait: '蓄力后高速突进，突进前有明显停顿 —— 那一下要躲', traitEn: 'Winds up, then lunges fast. Dodge the lunge' },
  gunner:   { name: '炮手',   nameEn: 'GUNNER', spr: 'gunner',   hp: 24, spd: 30, r: 6, dmg: 10, xp: 2, ai: 'shoot', range: 160, cd: 1.5, trait: '保持距离持续开火，贴上去能压住它的输出', traitEn: 'Keeps its distance and fires; close in to silence it' },
  splitter: { name: '分裂体', nameEn: 'SPLITTER', spr: 'splitter', hp: 28, spd: 38, r: 7, dmg: 10, xp: 2, ai: 'chase', split: 3, trait: '死亡裂成三只小的 —— 别在弹幕缝里杀它', traitEn: 'Splits into three on death — pick where you kill it' },
  reaver:   { name: '掠夺者', nameEn: 'REAVER', spr: 'reaver',   hp: 10, spd: 80, r: 4, dmg: 7,  xp: 1, ai: 'swarm',   trait: '成群高速掠过，数量多但极脆，扫射清场最快', traitEn: 'Fast swarms, very fragile — spray them down' },
  bastion:  { name: '重甲炮台', nameEn: 'BASTION', spr: 'bastion', hp: 78, spd: 22, r: 9, dmg: 14, xp: 4, ai: 'turret', range: 180, cd: 2.2, trait: '几乎不动、火力极密，绕到它背后再打', traitEn: 'Barely moves, fires densely — flank behind it' },
  shifter:  { name: '相位闪现者', nameEn: 'SHIFTER', spr: 'shifter', hp: 22, spd: 42, r: 6, dmg: 12, xp: 2, ai: 'blink', trait: '短距瞬移贴近，很难预瞄 —— 靠声音判断它去哪了', traitEn: 'Blinks in close; hard to pre-aim — listen for it' },
  stalker:  { name: '潜行者', nameEn: 'STALKER', spr: 'stalker',  hp: 32, spd: 48, r: 7, dmg: 16, xp: 3, ai: 'stalk',   trait: '潜行接近再爆发，保持距离别让它贴上', traitEn: 'Cloaks in, then bursts — keep your distance' },
  mine:     { name: '浮游雷', nameEn: 'DRIFT MINE', spr: 'mine',     hp: 12, spd: 0,  r: 6, dmg: 18, xp: 1, ai: 'mine',    trait: '完全静止，靠太近才自爆 —— 绕开就行', traitEn: 'Perfectly still, detonates up close — go around' },
  orbiter:  { name: '环轨炮', nameEn: 'ORBITER', spr: 'orbiter',  hp: 28, spd: 54, r: 6, dmg: 10, xp: 3, ai: 'orbit', range: 150, cd: 1.8, trait: '绕着你做圆周并射击，专门打乱你的走位节奏', traitEn: 'Circles you while firing, breaking your rhythm' },
  leech:    { name: '吸附虫', nameEn: 'LEECH', spr: 'leech',    hp: 24, spd: 64, r: 5, dmg: 6,  xp: 2, ai: 'leech',   trait: '贴上就持续放血，得靠冲刺或制动甩掉', traitEn: 'Latches on and drains HP — dash or brake it off' },
  // ---- 第二批：每个都改变你的决策，而不是只改血量 ----
  // 织网者：在场上撒减速网，压缩你的活动空间
  weaver:   { name: '织网者', nameEn: 'WEAVER', spr: 'weaver',   hp: 34, spd: 44, r: 6, dmg: 9,  xp: 3, ai: 'weave', range: 118, cd: 3.2, trait: '往你前方撒减速蛛网 —— 走位要读图，不能直线冲', traitEn: 'Drops slowing webs ahead of you — read the field' },
  // 牧者：给周围敌人持续回血 + 加速，必须优先点掉
  shepherd: { name: '牧者',   nameEn: 'SHEPHERD', spr: 'shepherd', hp: 46, spd: 40, r: 6, dmg: 8,  xp: 4, ai: 'shepherd', range: 148, aura: 84, cd: 2.0, trait: '给周围敌人回血 + 加速，不优先点掉这一波清不完', traitEn: 'Heals and hastens nearby foes — kill it first' },
  // 新星：死亡时炸出一圈弹幕，别在弹幕缝里杀它
  nova:     { name: '新星',   nameEn: 'NOVA', spr: 'nova',     hp: 26, spd: 50, r: 6, dmg: 12, xp: 3, ai: 'chase', deathRing: 12, trait: '死亡炸出一圈弹幕（留一条缝）—— 杀它的位置很重要', traitEn: 'Bursts into a bullet ring on death (one gap)' },
  // 铁壁：正面装甲吸收大部分伤害，机头转得慢 —— 所以侧后方真的绕得过去
  bulwark:  { name: '铁壁',   nameEn: 'BULWARK', spr: 'bulwark',  hp: 78, spd: 28, r: 8, dmg: 16, xp: 5, ai: 'guard', guard: 0.30, turn: 1.5, range: 190, cd: 3.2, trait: '正面装甲吃掉大部分伤害，机头转得慢 —— 绕到侧后方打', traitEn: 'Front armour soaks damage; it turns slowly — flank it' },
};
// 编队主题：决定每段的敌型配比
const SQUADS = {
  swarm:  { name: '虫潮', nameEn: 'SWARM',   mix: ['reaver', 'seeker', 'tadpole'], cnt: 1.35 },
  guns:   { name: '炮列', nameEn: 'BATTERY', mix: ['gunner', 'orbiter', 'bastion'], cnt: 0.75 },
  rush:   { name: '突袭', nameEn: 'RUSH',    mix: ['dart', 'seeker', 'leech'], cnt: 1.1 },
  fort:   { name: '要塞', nameEn: 'FORTRESS', mix: ['bastion', 'bulwark', 'gunner'], cnt: 0.8 },
  trick:  { name: '诡术', nameEn: 'TRICKERY', mix: ['shifter', 'stalker', 'mine'], cnt: 1.0 },
  weave:  { name: '罗网', nameEn: 'NETS',    mix: ['weaver', 'seeker', 'dart', 'tadpole'], cnt: 0.95 },
  flock:  { name: '牧群', nameEn: 'FLOCK',   mix: ['shepherd', 'nova', 'reaver', 'tadpole', 'reaver', 'tadpole'], cnt: 1.0 },
  mixed:  { name: '混编', nameEn: 'MIXED',   mix: ['seeker', 'dart', 'gunner', 'splitter', 'orbiter', 'leech'], cnt: 1.0 },
};

// ============ 星区 & 航程 ============
/* ============ 星区主题（2026-10-23 重写）============
   以前三个星区只差**背景配色和编队名字** —— 玩家说得出「颜色变了」，说不出「玩法变了」。
   现在一个主题 = 三件事绑死：
     skin  视觉（星野配色 / 装饰岩 / 地形贴图，sprites.js 里同一序号的三张表）
     terrain 地形布局（同一个主题永远同一套骨架，看到布局就知道自己在哪）
     haz   场地机制（**这一条是主题的全部价值**：每段都在逼玩家做一件不同的事）
   ⚠️ 三张表必须**同序号对齐**：ZONES[i] ↔ STARSETS[i] ↔ ROCKS[i] ↔ TERR_PAL[i]。
      插一个新主题 = 四处同时加，少一处就是「进了熔炉却铺着冰晶」。 */
const ZONES = [
  // ① 碎屑带：巨块在漂 —— 掩体是**活的**，射击线随时被切断，不能站桩
  { name: '外环碎屑带', en: 'DEBRIS BELT', from: 1,  to: 3,
    squads: ['swarm', 'rush', 'guns', 'mixed'], terrain: 'pillars', haz: 'drift' },
  // ② 中子星云：定时 EMP —— 全场敌弹清空 + 敌人麻痹，代价是你自己锁膛。是**救命键不是白给**
  { name: '中子星云',   en: 'NEUTRON NEBULA', from: 4,  to: 6,
    squads: ['trick', 'weave', 'flock', 'mixed'], terrain: 'cells', haz: 'emp' },
  // ③ 恒星熔炉：喷口喷完**留火场** —— 地面是真的会烧，站过的地方不能再站
  { name: '恒星熔炉',   en: 'FORGE RING', from: 7,  to: 9,
    squads: ['rush', 'guns', 'fort', 'mixed'], terrain: 'cross', haz: 'forge' },
  // ④ 深空奇点：折射带 —— 子弹穿带持续偏折，敌我同规则；会用的人能绕过掩体打人
  { name: '深空奇点',   en: 'DEEP SINGULARITY', from: 10, to: 12,
    squads: ['weave', 'flock', 'fort', 'trick'], terrain: 'ring', haz: 'lens' },
  // ⑤ 结晶回廊（无尽限定）：晶壁**反弹**你的弹 —— 打角度能打到拐角后面
  { name: '结晶回廊',   en: 'CRYSTAL SPIRE', from: 13, to: 15,
    squads: ['guns', 'fort', 'weave', 'swarm'], terrain: 'maze', haz: 'crystal' },
];
/* 每个主题的场地机制。⚠️ 五条**维度必须互不相同** ——
   两个主题都只是「把你往某处推」的话，玩家只会觉得「又一个推的」。
     drift   地形在动（改变的是**空间**）
     emp     定时清屏 + 锁你自己的枪（改变的是**节奏**）
     forge   喷发留火场（改变的是**地面**）
     lens    弹道穿过就弯（改变的是**子弹**）
     crystal 墙反弹你的弹（改变的是**打法**） */
const HAZARDS = {
  drift:   { name: '漂移碎块', nameEn: 'DRIFTING MASS' },
  emp:     { name: 'EMP 脉冲', nameEn: 'EMP PULSE' },
  forge:   { name: '熔火喷发', nameEn: 'FORGE BLOWOUT' },
  lens:    { name: '引力折射', nameEn: 'LENSING BAND' },
  crystal: { name: '晶壁反射', nameEn: 'CRYSTAL BOUNCE' },
};
const zoneOf = w => ZONES.find(z => w >= z.from && w <= z.to) || ZONES[2];
const WAVES = 12;                 // 主线航段数：打完这 12 段 = 通关，但**不停机**，转入无尽
// ⚠️ BOSS_WAVES 现在只是**兜底 / 图鉴预览**用的默认编排（G 还没建立时 peekBoss 会读它）。
//    真跑一局时主线 4/8/12 段出哪只由 `G.mainBosses` 决定（每局开局洗牌抽 3 只，见 rollMainBosses）。
const BOSS_WAVES = { 4: 'motherrock', 8: 'warden', 12: 'gate' };

/* 巨像血量 = b.hp（基准）× 槽位倍率 × 深渊档位倍率。
   ⚠️ b.hp 是「**放到第 4 段时**的血量」，**不是**最终血量 —— 槽位自己会把它放大。
      以前三只巨像的 hp 直接写死 900/2000/3600，等于把「它只会出现在第 4/8/12 段」
      焊进了数值里；要让 7 只巨像轮换进主线，就必须把「槽位」和「巨像」解耦。
      基准 900 × {4:1, 8:2.2, 12:4} 正好复现原来的 900 / 1980 / 3600，老平衡没被打破。 */
const BOSS_SLOT_MUL = { 4: 1, 8: 2.2, 12: 4 };
// 无尽里没有 4/8/12 槽位，统一按「最深的槽」算，再随段数线性加一点（指数部分交给 eTierHp）
const bossSlotMul = w => w <= WAVES ? (w <= 4 ? BOSS_SLOT_MUL[4] : w <= 8 ? BOSS_SLOT_MUL[8] : BOSS_SLOT_MUL[12])
                                    : BOSS_SLOT_MUL[12] * (1 + (w - WAVES) * 0.06);

/* ============ 关卡形态（2026-10-03）============
   以前**所有**非 Boss 段都是同一个形态：排队刷 N 只、杀光 → 跃迁。
   12 段里有 9 段是它，所以中段打起来就是「换了个编队名字的同一件事」。
   现在把那 9 段分成四种**目标**，每种逼玩家做不同的取舍：

     清剿 purge   杀光队列里的 N 只（原本的默认）  —— 比输出，站桩输出也行
     潮涌 surge   存活 N 秒，敌人一直涌             —— 比走位，**杀不完也不用杀完**
     回收 salvage 在骚扰下捡够 N 份星尘             —— 逼你离开安全路线去够掉落
     死斗 duel    3~4 只精锐重甲，杀光              —— 少量高血，考验穿透 / 爆发

   ⚠️ 判完成的条件**逐形态不同**，统一挂在 updateWave 里按 G.waveForm 分支。
      漏一个分支 = 那一段永远打不完 = 整局卡死，而且不报错，所以四种都要有探针。 */
const FORMS = {
  purge:   { name: '清剿', nameEn: 'PURGE' },
  surge:   { name: '潮涌', nameEn: 'SURGE' },
  salvage: { name: '回收', nameEn: 'SALVAGE' },
  duel:    { name: '死斗', nameEn: 'DUEL' },
  // 视界（2026-10-20）：第 6 段专属。**不是第五种刷怪方式** —— 它把奇点本身搬进战场，
  //   弯曲所有子弹、吞噬一切，玩家的核心动词从「瞄准射击」变成「算弹道 + 别被喂进去」。
  horizon: { name: '视界', nameEn: 'EVENT HORIZON' },
};
// 主线 12 段的形态编排：每段都要和**相邻段**不一样，别连着两段都是杀光。
// 4/8/12 是 Boss 段，不在这张表里（startWave 里 bossId 优先）。
const MAIN_FORMS = {
  1: 'purge', 2: 'purge', 3: 'salvage',
  // 第 6 段 = 视界：夹在第 4 段巨像之后、第 8 段巨像之前的**正中间**，
  //   是玩家已经学会基本操作、但还没被后期数值淹没的位置 —— 最适合塞一段规则完全不同的。
  5: 'purge', 6: 'horizon', 7: 'duel',
  9: 'purge', 10: 'salvage', 11: 'surge',
};
// 无尽里四种形态轮着来（Boss 段除外），否则打 30 段全在「杀光」
const ENDLESS_FORM_CYCLE = ['purge', 'surge', 'salvage', 'duel'];
const formForWave = w => w <= WAVES
  ? (MAIN_FORMS[w] || 'purge')
  : ENDLESS_FORM_CYCLE[(w - ENDLESS_FROM) % ENDLESS_FORM_CYCLE.length];

/* ============ 三形态系统（2026-10-11）============
   老版本只有一条「45% 血 → enraged」的判定，八只巨像**共用同一份变强脚本**：
   血掉一半之后只是冷却快了、走得快了、撒一波相同的小怪 —— 玩家说出来叫「它红了」，
   说不出任何一个巨像「变了什么」。这一版把「阶段」从**开关**改成**表**：

     forms: [{ p, pats, cd, spd, ... }, ...]     // p = 剩余血量比例，低于它就切到这一档

   每只巨像的三个形态各自决定：用哪几套弹幕（pats）、开火间隔（cd）、机动（spd）、
   以及一个**专属的场地 / 行为改动**（mods）。第三条最重要 ——
   换弹幕顺序只是「变难」，换行为才是「变了」：

     x: 1         第三阶段**换模型**（spr 从 'hive' 变 'hive_x'）
     vuln: 1.35   这一形态的易伤倍率（露出弱点了，就该打得动）
     aura         'pull' 引力井 / 'push' 反极推开 / 'fire' 拖火 /
                  'web' 织网 —— 把「它在改造场地」这件事显式化
     turrets: 2   进形态时架两座可击破的炮塔（它真的长出炮台了）
     phantoms: 2  分裂出两个会一起开火的幻影
     leaks: 1     每个开火 tick 额外漏一只虫（巢破了）
   
   ⚠️ `pats` 要按「这一形态的节奏」重排，不是在原数组尾部追加 ——
      阶段二/三应该是**新的循环**，最凶的那套前置，而不是把它塞在轮转的最后。
   ⚠️ `cd` 越低越难，但要留给玩家喘息：阶段三一律不低于 1.0s。 */
const BOSSES = {
  motherrock: { name: '母岩', en: 'MOTHER ROCK', spr: 'motherrock', hp: 860, r: 21, color: '#c070f0',
                trait: '冲撞 + 扇形弹幕，冲撞前有蓄力 —— 绕侧后方输出',
                traitEn: 'Rams and fires spreads; it winds up before ramming — flank it',
                forms: [
                  { p: 1.00, pats: ['charge', 'spread'], cd: 1.9, spd: 1.0 },
                  { p: 0.60, pats: ['charge', 'spread', 'ring'], cd: 1.5, spd: 1.2, label: '裂壳', labelEn: 'CRACKED' },
                  // 熔核暴露 = 它不再有壳：**打得动得多**（vuln），但也撞得更凶
                  { p: 0.25, pats: ['charge', 'ring', 'charge', 'spread'], cd: 1.05, spd: 1.45, x: 1, vuln: 1.35, label: '熔核', labelEn: 'MOLTEN CORE' },
                ] },
  warden:     { name: '环带狱卒', en: 'ORBITAL WARDEN', spr: 'warden', hp: 900, r: 22, color: '#ff5577',
                trait: '环形 / 螺旋 / 扇形三套弹幕轮转，找缝穿过去',
                traitEn: 'Rotates ring, spiral and fan patterns — thread the gaps',
                forms: [
                  { p: 1.00, pats: ['ring', 'spiral', 'fan'], cd: 1.9, spd: 1.0 },
                  { p: 0.60, pats: ['ring', 'fan', 'spiral', 'ring'], cd: 1.45, spd: 1.2, label: '加压', labelEn: 'PRESSURISED' },
                  // 炮臂展开：真的会架上两座能打掉的炮塔，和它自己对射
                  { p: 0.25, pats: ['crossLaser', 'ring', 'fan'], cd: 1.1, spd: 1.3, x: 1, turrets: 2, label: '展开', labelEn: 'UNFOLDED' },
                ] },
  gate:       { name: '奇点之门', en: 'THE GATE', spr: 'gate', hp: 940, r: 23, color: '#73eff7',
                trait: '四套弹幕含一道激光，血最厚 —— 拼的是续航',
                traitEn: 'Four patterns including a laser, and the most HP — an endurance test',
                forms: [
                  { p: 1.00, pats: ['spiral', 'fan', 'ring', 'laser'], cd: 1.9, spd: 1.0 },
                  { p: 0.60, pats: ['laser', 'fan', 'spiral', 'ring'], cd: 1.5, spd: 1.2, label: '半开', labelEn: 'AJAR' },
                  { p: 0.25, pats: ['crossLaser', 'ring', 'laser'], cd: 1.15, spd: 1.4, x: 1, label: '洞开', labelEn: 'OPENED' },
                ] },
  // ---- 第二批（2026-10-03）：四只新机制 ----
  hive:       { name: '蜂巢母体', en: 'HIVE MATRIARCH', spr: 'hive', hp: 880, r: 22, color: '#a7f070',
                trait: '持续产出虫群 —— 不管它的话小怪会淹没你，优先拆巢',
                traitEn: 'Keeps birthing swarms — ignore it and you drown; kill the hive first',
                forms: [
                  { p: 1.00, pats: ['summon', 'spread', 'ring'], cd: 2.0, spd: 1.0 },
                  { p: 0.60, pats: ['summon', 'summon', 'ring', 'spread'], cd: 1.6, spd: 1.2, label: '孵化', labelEn: 'BROODING' },
                  // 巢破了：不再主动产兵，改成**每个 tick 都在漏** —— 看起来是破口在淌
                  { p: 0.25, pats: ['summon', 'ring', 'fan'], cd: 1.2, spd: 1.35, x: 1, leaks: 1, label: '破裂', labelEn: 'RUPTURED' },
                ] },
  tempest:    { name: '磁暴核心', en: 'TEMPEST CORE', spr: 'tempest', hp: 900, r: 21, color: '#41a6f6',
                trait: '引力井一直把你往核心拽 —— 靠冲刺和制动顶住，别被拖进弹幕里',
                traitEn: 'Its gravity well drags you in — dash or brake out, do not get pulled into the fire',
                forms: [
                  { p: 1.00, pats: ['pull', 'ring', 'spiral'], cd: 1.9, spd: 1.0, aura: 'pull' },
                  { p: 0.60, pats: ['pull', 'ring', 'pull', 'spiral'], cd: 1.5, spd: 1.2, aura: 'pull', label: '过载', labelEn: 'OVERCHARGED' },
                  // 反极：**引力翻转**。前 80% 局练出来的「往侧后方挣」在这里是错的，
                  //        现在它把你往外推 —— 一直在它脸上的打法要整个换掉。
                  { p: 0.25, pats: ['pull', 'ring', 'homing'], cd: 1.1, spd: 1.35, x: 1, aura: 'push', label: '反极', labelEn: 'REVERSED' },
                ] },
  forge:      { name: '熔渣锻炉', en: 'SLAG FORGE', spr: 'forge', hp: 920, r: 22, color: '#ef7d57',
                trait: '飞过的地方留下火场 —— 场地会被它一点点切碎，别往它去过的地方飞',
                traitEn: 'Leaves burning ground behind it — the arena gets carved up; never fly where it has been',
                forms: [
                  { p: 1.00, pats: ['burn', 'fan', 'charge'], cd: 2.0, spd: 1.0, aura: 'fire' },
                  { p: 0.60, pats: ['burn', 'charge', 'fan', 'burn'], cd: 1.55, spd: 1.2, aura: 'fire', label: '升温', labelEn: 'HEATING' },
                  // 不再是「路过留火」，改成**一路烧成火海**：回头的路被真正封死了
                  { p: 0.25, pats: ['burn', 'charge', 'ring', 'burn'], cd: 1.15, spd: 1.4, x: 1, aura: 'firestorm', label: '过载', labelEn: 'OVERLOAD' },
                ] },
  prism:      { name: '棱镜之眼', en: 'PRISM EYE', spr: 'prism', hp: 900, r: 20, color: '#ffe9a8',
                trait: '放出分光的激光扇，光束之间留着缝 —— 贴着缝站，别乱窜',
                traitEn: 'Fires a fan of split beams with gaps between them — stand in a gap, do not scramble',
                forms: [
                  { p: 1.00, pats: ['beamFan', 'fan', 'ring'], cd: 2.0, spd: 1.0 },
                  { p: 0.60, pats: ['beamFan', 'ring', 'beamFan'], cd: 1.55, spd: 1.2, label: '聚光', labelEn: 'FOCUSED' },
                  // 裂相：分出两个幻影一起射。**先打真的那个** —— 幻影打不死本体，
                  //       但站错位置会被三面夹住。
                  { p: 0.25, pats: ['beamFan', 'homing', 'ring'], cd: 1.15, spd: 1.3, x: 1, phantoms: 2, label: '裂相', labelEn: 'SPLIT' },
                ] },
  // ---- 第三批（2026-10-11）：第八只 ----
  eclipse:    { name: '星蚀', en: 'ECLIPSE', spr: 'eclipse', hp: 960, r: 22, color: '#ffcd75',
                trait: '周期性熄灭战场 —— 天黑下来的时候只有它身边看得见，先记住自己在哪',
                traitEn: 'Blanks the field periodically — when it goes dark only its vicinity stays lit; learn your bearings first',
                forms: [
                  { p: 1.00, pats: ['blackout', 'ring', 'fan'], cd: 2.1, spd: 1.0 },
                  { p: 0.60, pats: ['blackout', 'ring', 'blackout', 'spiral'], cd: 1.6, spd: 1.2, label: '半影', labelEn: 'PENUMBRA' },
                  // 全蚀：熄得更久更深 —— 这时候你已经没有「看」这个选项了
                  { p: 0.25, pats: ['blackout', 'crossLaser', 'ring'], cd: 1.2, spd: 1.4, x: 1, esoMul: 1.6, label: '全蚀', labelEn: 'TOTALITY' },
                ] },
};

/* ============ 无尽航程 & 深渊强度（搬运自《奇点回响》的 ETIER_* 档位） ============
   echo 的做法是：主线跑完之后不结束，而是每 5 段抬一档全局强度，
   血量**指数**上涨（1.14^n），伤害 / 速度小幅跟涨且**各自封顶**。
   这里照搬同一套曲线，只把起点从 echo 的第 41 段挪到第 13 段。

   ⚠️ 三处必须一起改，漏一处就会出现「只有血变厚、弹幕还是挠痒」的半吊子难度：
       ① hpScale()      —— 杂兵血量
       ② spawnEnemy()   —— e.dmg / e.spdMul（接触伤害 / 移动速度）
       ③ eShot()        —— 敌弹自带 dmg，updateEBullets 直接读它
   ⚠️ 线性成长在主线末段封顶（min(w, WAVES)），否则线性和指数会**叠乘**：
      wave 50 会变成 6.4 × 2.85 ≈ 18 倍血，曲线直接失控。 */
const ENDLESS_FROM = WAVES + 1;       // 13 段起 = 无尽航程
const ENDLESS_EVERY = 5;              // 每 5 段抬一档
const TIER_HP = 1.14;                 // 每档血量 ×1.14（指数，不封顶）
const TIER_DMG = 1.08;                // 每档伤害 ×1.08
const TIER_SPD = 1.03, TIER_SPD_CAP = 1.5;      // 每档速度 ×1.03，封顶 1.5
const TIER_EXTRA = 1, TIER_EXTRA_CAP = 10;      // 每档多 1 只杂兵，封顶 +10
const ENDLESS_BOSS_EVERY = 4;         // 无尽里每 4 段来一只巨像（主线是固定的 4/8/12）

// 档位序号：主线恒为 0 档；13 段 = 1 档，18 段 = 2 档 ……
function eTier(w) {
  if (w < ENDLESS_FROM) return 0;
  return Math.floor((w - ENDLESS_FROM) / ENDLESS_EVERY) + 1;
}
const eTierHp    = w => Math.pow(TIER_HP, eTier(w));
const eTierDmg   = w => Math.pow(TIER_DMG, eTier(w));
const eTierSpd   = w => Math.min(TIER_SPD_CAP, Math.pow(TIER_SPD, eTier(w)));
const eTierExtra = w => Math.min(TIER_EXTRA_CAP, eTier(w) * TIER_EXTRA);

// 巨像轮换袋（搬运 echo 的 bagPick）：一轮里三只巨像各来一次才重洗，
// 避免「连出两只奇点之门」这种既单调又劝退的排列。
const BOSS_BAG = [];
function bagPickBoss() {
  if (!BOSS_BAG.length) {
    BOSS_BAG.push.apply(BOSS_BAG, Object.keys(BOSSES));
    for (let i = BOSS_BAG.length - 1; i > 0; i--) {
      // ⚠️ irand 是 (a, b) 两参数签名，不是 (n)！写成 irand(i + 1) 会得到 NaN，
      //    `BOSS_BAG[NaN]` 是 undefined → 洗牌把 undefined 塞进袋里 → pop() 返回 undefined
      //    → bossForWave 判成「本段不是巨像段」→ 巨像段**静默退化成普通编队**。
      //    不抛异常、没有 JS 错误、banner 也不报错，只有真的去数「第 20 段怎么没巨像」才抓得到。
      const j = irand(0, i); const t = BOSS_BAG[i]; BOSS_BAG[i] = BOSS_BAG[j]; BOSS_BAG[j] = t;
    }
  }
  return BOSS_BAG.pop();
}
/* 主线巨像轮换（2026-10-03）：每局开局从 7 只里洗牌抽 3 只，填进 4 / 8 / 12 段。
   巨像多了以后，主线要是还钉死「4 母岩 · 8 狱卒 · 12 之门」，玩家连跑三局看到的
   一模一样 —— 新做的四只只有进无尽才见得到，等于白做一半。所以主线也走轮换袋。
   ⚠️ 一轮里不会重复：i 直接取洗牌后的前 3 个，所以不会出现「第 4 段和第 8 段都是母岩」。
   ⚠️ 7 ≥ 3 才成立。要是哪天巨像被砍到少于 3 只，`k % pool.length` 会开始重复填同一只，
      那时得改成允许跨轮重洗。 */
const MAIN_BOSS_SLOTS = [4, 8, 12];
function rollMainBosses() {
  const pool = Object.keys(BOSSES);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = irand(0, i); const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  const out = {};
  MAIN_BOSS_SLOTS.forEach((w, k) => { out[w] = pool[k % pool.length]; });
  return out;
}
// 本段该不该出巨像。⚠️ 只在 startWave 里调用一次 —— bagPickBoss 有副作用（抽走一张牌），
//    任何「预判式」的重复调用都会白白吃掉一轮轮换。
function bossForWave(w) {
  // 主线：本局开局抽好的那 3 只。G 还没建立时（图鉴 / peekBoss）退回 BOSS_WAVES。
  if (w <= WAVES) return (G && G.mainBosses && G.mainBosses[w]) || BOSS_WAVES[w] || null;
  if ((w - WAVES) % ENDLESS_BOSS_EVERY === 0) return bagPickBoss();
  return null;
}
// 段数标签（HUD 用，带单位）：主线「第 N/12 段」，无尽「第 N 段 · 深渊 K 档」。
// ⚠️ 返回值已经含「段」字，调用方不要再拼一次 —— 否则无尽里会印成
//    「第 17 · 深渊 1 档 段」这种断句。
function waveLabel(w) {
  return w <= WAVES ? T('hud.waveMain', w, WAVES) : T('hud.waveEndless', w, eTier(w));
}
// 本段目标的 HUD 文案（见 FORMS 注释）。Boss 段不走这里 —— 它已经有血条了。
function waveObjective() {
  const f = G.waveForm;
  // Boss 段返回空串：它已经有血条了，再挂一个「剩余 N」只会让人以为
  // 还得把小怪清完才算过段（实际上巨像一死就跃迁）。
  if (f === 'boss' || G.boss) return '';
  if (f === 'surge') return T('hud.survive', Math.max(0, Math.ceil(G.waveDur - G.waveT)));
  // 视界：倒计时用「逃逸」而不是「存活」—— 这段的动作是把船从引力井里开出来，不是硬扛
  if (f === 'horizon') return T('hud.horizon', Math.max(0, Math.ceil(G.waveDur - G.waveT)));
  if (f === 'salvage') return T('hud.salvage', Math.min(G.dustGot, G.dustNeed), G.dustNeed);
  if (f === 'duel') return T('hud.duel', G.spawnQueue.length + G.enemies.length);
  return T('hud.left', G.spawnQueue.length + G.enemies.length);
}

// ============ 模块卡（16） ============
// type: stat(数值) / weapon(弹体) / ability(装置)
// apply(S) 每升一级执行一次；bloom(S) 只在升到满级那一刻额外执行一次（质变）。
// glyph 用汉字：像素字体对 ▣➤↻◆ 这类符号覆盖不全，会渲染成缺字方块。
const MODULES = [
  // ---- 数值型 ----
  { id: 'armor', name: '装甲板', nameEn: 'ARMOR PLATE', type: 'stat', glyph: '甲', max: 4,
    desc: '最大船体 +22\n并立即修复',
    descEn: 'Max hull +22\nand repairs at once',
    apply: S => { S.maxHp += 22; S.hp += 22; },
    bloom: S => { S.maxHp += 50; S.hp = S.maxHp; } },
  { id: 'thruster', name: '推进器', nameEn: 'THRUSTER', type: 'stat', glyph: '推', max: 4,
    desc: '推进与极速 +8%',
    descEn: 'Thrust and top\nspeed +8%',
    apply: S => { S.spd *= 1.08; },
    bloom: S => { S.spd *= 1.18; S.goldTrail = 1; } },
  { id: 'autoloader', name: '自动装填', nameEn: 'AUTOLOADER', type: 'stat', glyph: '装', max: 4,
    desc: '射击间隔 -10%',
    descEn: 'Fire interval -10%',
    apply: S => { S.rate *= 1.10; },
    bloom: S => { S.rate *= 1.25; S.goldMuzzle = 1; } },
  { id: 'warhead', name: '重型弹头', nameEn: 'WARHEAD', type: 'stat', glyph: '弹', max: 4,
    desc: '所有伤害 +11%',
    descEn: 'All damage +11%',
    // 2026-10-03 平衡：13% → 11%，bloom 1.35 → 1.28。
    //    它是**唯一乘法作用于所有来源**的卡（主炮 / 尾炮 / 扇形 / 光矛 / 电链 / 冲击波 / 磁雷全吃），
    //    满级约 2.22 倍全盘伤害；没有任何一张其它数值卡能有这个覆盖面，
    //    于是它变成了「必拿」，而不是「一张选择」。
    apply: S => { S.dmg *= 1.11; },
    bloom: S => { S.dmg *= 1.28; } },
  { id: 'critcap', name: '暴击电容', nameEn: 'CRIT CAP', type: 'stat', glyph: '暴', max: 4,
    desc: '暴击率 +7%\n暴击造成 2.4 倍',
    descEn: 'Crit +7%\nCrits deal 2.4x',
    // 2026-10-03 平衡：暴击率 8% → 7%/级，bloom critMul 3.4 → 3.2。
    //    配合 warhead 的乘法，满装配基础暴击率能到 ~45% —— 每十发里有近一半是 3.4 倍伤害，
    //    再叠 pierceCrit 协同就变成「常态输出」而不是「偶尔的惊喜」。
    //    削的是**率**而不是倍率：暴击要少见才更像运气好，倍数留着才是「那一枪很重」。
    apply: S => { S.crit += 0.07; },
    bloom: S => { S.crit += 0.09; S.critMul = 3.2; } },
  { id: 'magnet', name: '磁力线圈', nameEn: 'MAGNET COIL', type: 'stat', glyph: '磁', max: 3,
    desc: '拾取范围 +30%',
    descEn: 'Pickup range +30%',
    // 2026-10-03 平衡：25% → 30%/级（bloom 不变）。
    //    基础吸附已经从 46 抬到 78 —— 那时的 +25% 是给「屏幕里捡不到」解闷的，
    //    78 起步之后它的存在感反而变淡了。抬一档，配得上那张卡面。
    apply: S => { S.magnet *= 1.30; },
    bloom: S => { S.magnet *= 1.6; S.autoPull = 1; } },
  { id: 'nanorepair', name: '纳米修复', nameEn: 'NANO REPAIR', type: 'stat', glyph: '修', max: 3,
    desc: '每秒回复 1.3 船体',
    descEn: 'Heals 1.3 hull\nper second',
    // 2026-10-03 平衡：0.8 → 1.3/秒（bloom 的 dustHeal 0.6 → 1.0）。
    //    旧值满级 2.4/秒，在 100+ 船体和动辄几十点一发的敌伤面前等于没有 ——
    //    它是**唯一开局就完全没手感**的生存卡。抬到 1.3 之后满级约 3.9/秒，
    //    定位变成「持续的血压下来」，依旧追不上「装甲板」的爆发，但不再是废纸。
    apply: S => { S.regen += 1.3; },
    bloom: S => { S.regen *= 2; S.dustHeal += 1.0; } },
  { id: 'phasehull', name: '相位外壳', nameEn: 'PHASE HULL', type: 'stat', glyph: '相', max: 3,
    desc: '受击无敌 +0.22 秒',
    descEn: 'Invuln on hit\n+0.22s',
    // 2026-10-03 平衡：+0.15 → +0.22/级，bloom +0.5 → +0.65。
    //    0.15 秒在 60fps 下只有 9 帧，肉眼几乎看不出来，
    //    但它给的是**容错窗口**而不是伤害减免，和「能量护盾」是直接竞争关系 ——
    //    抬到 0.22 才配得上一张卡面，又不至于像满级 shield 那样把容错做成「完全免疫追猎」。
    apply: S => { S.invBonus += 0.22; },
    bloom: S => { S.invBonus += 0.65; S.goldHurt = 1; } },

  // ---- 弹体型 ----
  { id: 'multigun', name: '多联机炮', nameEn: 'MULTI-GUN', type: 'weapon', glyph: '炮', max: 3,
    desc: '追加一根枪管\n齐射更宽',
    descEn: 'Extra barrel\nWider volley',
    apply: S => { S.barrels += 1; },
    bloom: S => { S.barrels += 1; } },
  { id: 'piercer', name: '穿甲弹', nameEn: 'PIERCER', type: 'weapon', glyph: '穿', max: 3,
    desc: '炮弹多穿透 1 个目标',
    descEn: 'Shots pierce\n1 more target',
    apply: S => { S.pierce += 1; },
    bloom: S => { S.pierce += 2; } },
  { id: 'hesh', name: '高爆弹', nameEn: 'HE SHOT', type: 'weapon', glyph: '爆', max: 3,
    desc: '命中炸开\n范围伤害',
    descEn: 'Shots explode\non impact',
    apply: S => { S.blast += 1; },
    bloom: S => { S.blast += 2; S.blastMul *= 1.5; } },

  // ---- 装置型 ----
  { id: 'drone', name: '战斗无人机', nameEn: 'COMBAT DRONE', type: 'ability', glyph: '机', max: 3,
    desc: '环绕自动开火\n每级 +1 架',
    descEn: 'Orbiting drone\nfires by itself\n+1 per level',
    // 2026-10-03 平衡：单发伤害 7 → 8（`DRONE_DMG`）。
    //    它的 DPS 完全不看玩家的走位，量少一点是应该的；但满装满协同只有约 37 DPS，
    //    推不动任何一条后期的血条。抬 1 点：不多不少，刚好让它从「摆设」变成「辅助火力」。
    apply: S => { S.drones += 1; },
    bloom: S => { S.drones += 2; S.droneGold = 1; } },
  { id: 'shield', name: '能量护盾', nameEn: 'ENERGY SHIELD', type: 'ability', glyph: '盾', max: 3,
    desc: '护盾 +32\n脱战自动回复',
    descEn: 'Shield +32\nRegens out of\ncombat',
    // 2026-10-03 平衡：28 → 32/级，bloom +70 → +80。
    //    敌伤随段数线性涨（无尽里还要乘档位），28 点一级的盾在第 6 段往后基本是「一次性纸」，
    //    而它没法像「装甲板」那样被 healing 卡放大 —— 只能加基础值，让它撑到后期还有意义。
    apply: S => { S.shieldMax += 32; S.shield = S.shieldMax; },
    bloom: S => { S.shieldMax += 80; S.shield = S.shieldMax; S.shieldRegenMul *= 2; } },
  { id: 'arc', name: '电弧线圈', nameEn: 'ARC COIL', type: 'ability', glyph: '电', max: 3,
    desc: '每 2.2 秒链击\n2 个目标',
    descEn: 'Every 2.2s\nchains 2 targets',
    // 2026-10-03 平衡：单跳基础伤害 9 → 12（在 updateAbilities 里读作 `ARC_DMG`），
    //    并把每跳的递减改成递增 grade 0.35 → 0.45。
    //    旧值 2.2 秒链三个只有约 75 点面板伤害，比同期的主动/弹体卡都低一截 ——
    //    它是第一张「装置型」卡，却一直是五张装置里最不被选的那个。抬到能看见的那一档就好。
    apply: S => { S.arc += 1; },
    bloom: S => { S.arc += 1; S.arcCdMul *= 0.55; } },
  { id: 'nova', name: '脉冲核心', nameEn: 'PULSE CORE', type: 'ability', glyph: '冲', max: 3,
    desc: '每 7 秒冲击波\n击伤并震退周身敌人',
    descEn: 'Shockwave every 7s\ndamages and knocks\nback nearby foes',
    apply: S => { S.nova += 1; S.novaR += 26; },
    bloom: S => { S.novaR += 70; S.novaCd *= 0.7; S.novaVoid = 1; } },
  { id: 'stasis', name: '静止场', nameEn: 'STASIS FIELD', type: 'ability', glyph: '滞', max: 3,
    desc: '范围内敌人减速',
    descEn: 'Slows enemies\nin range',
    apply: S => { S.stasis += 1; S.stasisR += 34; },
    bloom: S => { S.stasisR += 90; S.stasisSlow += 0.2; } },

  // ---- 从《奇点回响》搬运的机制（搬运机制，不照抄模型：数值 / 上限 / 视觉全部重定） ----
  // ⚠️ 上限一律用本作的 3，不是 echo 的 6 —— 本作一局只升到 8 级左右，6 级卡等于永远拿不满。
  { id: 'backshot', name: '尾炮', nameEn: 'REAR GUN', type: 'ability', glyph: '尾', max: 3,
    desc: '齐射时向船尾开火\n每级 +1 门',
    descEn: 'Fires backward\n+1 gun per level',
    apply: S => { S.backshot += 1; },
    bloom: S => { S.backshot += 2; S.backGold = 1; } },
  { id: 'ricochet', name: '跳弹', nameEn: 'RICOCHET', type: 'weapon', glyph: '跳', max: 3,
    desc: '炮弹撞到屏边\n反弹一次继续飞\n每弹一次伤害 +10%',
    descEn: 'Shots bounce off\nthe screen edge\n+10% per bounce',
    // 2026-10-03 平衡：新增 `bounceBoost`（每弹一次伤害 +10%，在 updateBullets 里结算）。
    //    旧版只有「次数」，没有回报 —— 世界放大之后屏幕外的墙变远了，反弹越来越像惩罚
    //    （弹在墙之间来回飞、既不 AOE 也不回本）。给它一个正反馈，
    //    它才重新变成「贴着边打、让弹飞回来补刀」的战术工具，而不是纯装饰。
    apply: (S, n) => { S.bounce += 1; S.bounceBoost = 0.10 * n; },
    bloom: S => { S.bounce += 2; S.bounceBoost = 0.16; } },
  { id: 'guided', name: '制导弹药', nameEn: 'GUIDED ROUNDS', type: 'weapon', glyph: '导', max: 3,
    desc: '炮弹缓缓咬住\n最近的敌人\n飞出射程便失坠',
    descEn: 'Shots drift toward\nthe nearest foe,\nthen fall short',
    // ⚠️ 2026-10-03 削弱（作者口径「追踪别做那么好，可以全图追踪了」）——三处一起动：
    //   ① 转弯速率 1.1 → 0.62 rad/s：改成「缓缓咬住」，横向拉开是有可能甩掉的，
    //      不再是「不管从哪个角度打出去都必然命中」。
    //   ② 锁定半径不再一路开到 260（近全屏）→ 满级 204 封顶，超过就找不到目标、退化成普通弹。
    //   ③ 新增**飞行里程上限** `homeTrav`（pBullet 里给每发记账）：飞够 300~380px 就主动失坠，
    //      不准它绕着场子一圈一圈地找人 —— 这才是「全图追踪」的罪魁祸首。
    //      回避的能力来自 `updateBullets` 里的两件事：按弹缓存目标（0.12s 搜一次）。
    // ⚠️ isoMul / execMul 之类的伤害倍率是另一回事，别混进来 ——
    //    制导是「打得中」，不是「打得疼」。
    apply: (S, n) => { S.homing += 0.62; S.homeR = 138 + n * 22; S.homeTrav = 300 + (n - 1) * 40; },
    bloom: S => { S.homing += 0.75; S.homeR = 204; S.homeTrav = 430; } },
  { id: 'ram', name: '冲角装甲', nameEn: 'RAM PLATE', type: 'ability', glyph: '角', max: 3,
    desc: '撞上去就能杀伤\n撞击自伤 -40%\n射速 -30%（仅首级）',
    descEn: 'Ramming hurts\nSelf-dmg -40%\nRate -30% (lv1)',
    apply: (S, n) => { S.ram += 1; if (n === 1) S.rate *= 0.7; },
    bloom: S => { S.ram += 1; S.ramGold = 1; } },
  { id: 'deathtrail', name: '死亡尾流', nameEn: 'DEATH WAKE', type: 'ability', glyph: '流', max: 3,
    desc: '高速拖出灼热尾流\n消解触及的敌弹',
    descEn: 'Hot wake at speed\nMelts enemy shots',
    // 2026-10-03 平衡：速度 1.06 → 1.09，射速惩罚从 -7% 收到 -4%。
    //    它原来是「惩罚比收益清楚」的典型：为了那点尾火先付掉 7% 输出，
    //    而尾流本身还得先跑起来才有 —— 两头都不讨好。惩罚收一半，
    //    让它至少能对得上「速度流」这条线的定位。
    apply: S => { S.death += 1; S.spd *= 1.09; S.rate *= 0.96; },
    bloom: S => { S.death += 1; S.spd *= 1.10; S.deathGold = 1; } },

  // ---- 第二批搬运：《奇点回响》的「弹丸改造」与生存系 ----
  // 这一批的共同点是**改动弹丸本身**或**改动击杀的回报**，而不是再堆一层数值。
  { id: 'caliber', name: '口径校准', nameEn: 'CALIBER', type: 'stat', glyph: '径', max: 3,
    desc: '弹丸更粗、飞得更远\n弹速 +8%',
    descEn: 'Fatter, longer\nshots, +8% speed',
    // 本作唯一同时动「半径 / 弹速 / 射程」三个维度的卡。三者都在 pBullet 里读，
    // 所以扇形弹、尾炮、弹片会一起变粗 —— 它是乘法放大器，不是加法。
    // 2026-10-03 平衡：三维各自退半档（1.08/1.10/1.0 → 1.06/1.08/0.8，bloom 也退），
    //    bulletR 保持 1.0 不变 —— 「看得见的变粗」是这张卡的性格，削减的是背后那两个乘数。
    apply: S => { S.bulletR += 1.0; S.bspd *= 1.06; S.rangeMul *= 1.08; },
    bloom: S => { S.bulletR += 2.5; S.bspd *= 1.20; S.rangeMul *= 1.28; S.caliberGold = 1; } },
  { id: 'spray', name: '散射喷嘴', nameEn: 'SPRAY NOZZLE', type: 'weapon', glyph: '扇', max: 3,
    desc: '齐射额外喷出扇形弹\n单发伤害较低',
    descEn: 'Wider volley\nWeaker per shot',
    // ⚠️ 用 n 而不是累乘写等级表：sprayMul 是「覆盖式赋值」，续档逐级重放时
    //    累乘写法（*0.7 之类）会把同一个惩罚叠三次。这一点和 ram 的首级惩罚是同一个坑。
    apply: (S, n) => { S.spray += 2; S.sprayMul = 0.62 + (n - 1) * 0.07; },
    bloom: S => { S.spray += 3; S.sprayMul = 1.0; S.sprayArc = 0.30; S.sprayGold = 1; } },
  { id: 'fission', name: '裂变弹芯', nameEn: 'FISSION CORE', type: 'weapon', glyph: '裂', max: 3,
    desc: '炮弹首次命中时\n炸成一圈弹片',
    descEn: 'First hit bursts\ninto shrapnel',
    // 2026-10-03 平衡：弹片倍率 0.45/0.58/0.71 → 0.42/0.52/0.62，bloom 0.85 → 0.75。
    //    它是唯一「自己繁殖」的卡：一发变六片，每片还会继承别的弹体卡效果；
    //    和 hesh 咬在一起就是连锁的指数底数。削倍率是削底数，比削片数温和 ——
    //    片数一少，视觉上那「一朵散开」的味道就没了。
    apply: (S, n) => { S.fission += 1; S.fissionMul = 0.42 + (n - 1) * 0.10; },
    bloom: S => { S.fission += 2; S.fissionMul = 0.75; S.fissionGold = 1; } },
  { id: 'overclock', name: '过载超频', nameEn: 'OVERCLOCK', type: 'stat', glyph: '频', max: 3,
    desc: '射速 +9%、伤害 +7%\n最大船体 -12',
    descEn: 'Rate +9%, dmg +7%\nMax hull -12',
    // 高风险高回报：拿血换输出。⚠️ 必须同时夹住 hp（见 apply 末句），
    //    否则拿卡瞬间 S.hp 会大于新的 S.maxHp，血条直接画出界。
    // 2026-10-03 平衡：扣血 -9 → -12（bloom -20 → -24）。
    //    账面 +9% 射速 +7% 伤害是**两个乘数同时给**，这在 abyss 里最值钱；
    //    而 9 点血在「装甲板」和「纳米修复」面前几乎不算代价 —— 代价不成立，取舍就消失了。
    apply: S => { S.rate *= 1.09; S.dmg *= 1.07; S.maxHp = Math.max(30, S.maxHp - 12); S.hp = Math.min(S.hp, S.maxHp); },
    bloom: S => { S.rate *= 1.22; S.dmg *= 1.18; S.maxHp = Math.max(30, S.maxHp - 24); S.hp = Math.min(S.hp, S.maxHp); S.ovGold = 1; } },
  { id: 'leech', name: '噬能回收', nameEn: 'ENERGY LEECH', type: 'ability', glyph: '噬', max: 3,
    desc: '每次击坠回复\n最大船体的 1.1%',
    descEn: 'Each kill heals\n1.1% of max hull',
    // 按**最大**船体的百分比回血 → 与「装甲板」是乘法关系，堆血同时买生存和续航。
    apply: S => { S.leech += 1.1; },
    bloom: S => { S.leech += 3.4; S.leechGold = 1; } },

  // ---- 第三批搬运：《奇点回响》的三张「主动/被动触发」能力 ----
  // 这三张和前面两批的区别是：它们都不是「加一个持续输出源」，而是**改变一次事件的结果**。
  //   lance 把「一次射击」变成贯穿全场的一击
  //   blink 把「一次受击」变成一次脱险
  //   mine  把「一段走位」变成一片雷区
  { id: 'lance', name: '轨道长枪', nameEn: 'RAIL LANCE', type: 'ability', glyph: '枪', max: 3,
    desc: '冷却就绪时\n下一发变成贯穿光矛',
    descEn: 'When ready, the\nnext shot is a\npiercing lance',
    // 冷却用 S.lanceCd 秒；装弹期间照常开火，所以这张卡不会「禁用主炮」。
    // 2026-10-03 平衡：冷却 7.2/5.6/4.0 → 8.6/7.0/5.4，bloom 3.2 → 4.4。
    //    伤害没动 —— 削的是**频率**。光矛是「白送的一整条直线 AOE」，
    //    光矛不用瞄、不计走位成本，4 秒一根等于平白多了一门随身的直线炮。
    apply: (S, n) => { S.lance = n; S.lanceCd = 8.6 - (n - 1) * 1.6; },
    bloom: S => { S.lance = 3; S.lanceCd = 4.4; S.lanceGold = 1; } },
  { id: 'blink', name: '相位折跃', nameEn: 'PHASE BLINK', type: 'ability', glyph: '跃', max: 3,
    desc: '重击袭来时自动折跃\n该次伤害作废',
    descEn: 'Auto-blinks from\nheavy hits,\nnegating them',
    // ⚠️ 只对「足以破盾的重击」触发（阈值 22）—— 对每一发流弹都触发等于全程无敌。
    // 2026-10-03 平衡：冷却整体拉长（15/11.5/8 → 17/13.5/10，bloom 6.5 → 8.5）。
    //    这张卡是**完全被动**的 —— 玩家什么都不用做就能白嫖一次大伤害免疫，
    //    冷却太短时它对 Boss 的价值等于多了一条命。拉长冷却不改变它「救急」的定位，
    //    只是让它不再能把整场战斗的失误都擦掉。阈值 BLINK_MIN 不动 ——
    //    那一刀（只对重击生效）才是这张卡不破坏游戏的根本，冷却只是剂量。
    apply: (S, n) => { S.blink = n; S.blinkCd = 17 - (n - 1) * 3.5; },
    bloom: S => { S.blink = 3; S.blinkCd = 8.5; S.blinkMax = 1; } },
  { id: 'mine', name: '磁暴雷', nameEn: 'MAG MINE', type: 'ability', glyph: '雷', max: 3,
    desc: '定时在船尾布设磁雷\n触爆后炸伤一片',
    descEn: 'Drops mines behind\nyou that blast\na group',
    apply: (S, n) => { S.mine = n; S.mineCd = 6.4 - (n - 1) * 1.4; S.mineMax = 1 + n; },
    bloom: S => { S.mine = 3; S.mineCd = 2.6; S.mineMax = 5; S.mineGold = 1; } },

  // ---- 第四批（2026-10-03）：四张「先看清楚，再下手」的条件式能力 ----
  // 前三批给的是「更多的输出源」或「更大的数字」，这一批给的是**判断**：
  //   isolate 问的是「这一只旁边有没有同伙」
  //   execute 问的是「它是不是快死了」
  //   bind    给的是「这一枪能不能把它按在原地」
  //   rewind  问的是「这一次失误值不值得倒回去」
  // 参考对象是《英雄联盟》的四个技能：卡兹克孤立无援 / 诺手断头台 / 莫甘娜暗之禁锢 / 艾克时空断裂。
  // ⚠️⚠️ desc / descEn 都有硬宽度：`.card .desc` 116px 宽、12px 字 ——
  //    中文每行 ≤ 9 个汉字，**英文每行 ≤ 19 个半角字符**，都只能写 3 行。
  //    （详见 AGENTS.md「中英切换」那节。）
  { id: 'isolate', name: '孤立协议', nameEn: 'ISOLATION', type: 'stat', glyph: '孤', max: 3,
    desc: '落单的敌人\n受到更高伤害',
    descEn: 'Isolated targets\ntake more damage',
    // 借卡兹克的「孤立无援」：判定的不是「打得多疼」，而是「它的同伴在不在」——
    //    周围 isoR（54~82px）内没有其它敌人时才加成。
    //    它给玩家换来的新决策是一个动词：**切**。先清边上的那一只，而不是对着人堆泼最强的火。
    //    ⚠️ Boss 免疫（damageEnemy 里判 e.boss）—— 巨像身边永远跟着杂兵，
    //       加了它只会把 Boss 战变成「先把小兵清空然后白嫖一半增伤」的固定流程。
    //    ⚠️ isoMul / isoR 必须是**覆盖式赋值**（不能累乘）：续档要按等级逐级重放 apply，
    //       累乘写法会把同一个加成叠三次（和 sprayMul / fissionMul 是同一个坑）。
    apply: (S, n) => { S.isolate += 1; S.isoR = 46 + n * 8; S.isoMul = 0.30 + n * 0.12; },
    bloom: S => { S.isoMul = 0.90; S.isoR = 82; S.isoGold = 1; } },
  { id: 'execute', name: '湮灭指令', nameEn: 'EXECUTE ORDER', type: 'stat', glyph: '斩', max: 3,
    desc: '残血目标\n受到重创\n斩杀后短暂狂热',
    descEn: 'Low-hp foes take\nheavy damage;\nkills grant fury',
    // 借诺手的「诺克萨斯断头台」：伤害是**分段**的 ——
    //   ① 目标血量低于 execHp（24%~32%）时伤害乘以 execMul（1.8~2.8）；
    //   ② 每次斩杀给 3 秒「狂热」（G.furyT），期间所有伤害 +8%/级。
    //      第二条是这张卡的节奏：它奖励**连着收割**，而不是单点爆发。
    //    ⚠️ 巨像的斩杀线减半（damageEnemy 里判 e.boss）—— Boss 血条长，
    //       32% 线等于后半场永久增伤，Boss 战的时间会被压缩掉一截。减半之后它依然是主力。
    apply: (S, n) => { S.exec += 1; S.execHp = 0.20 + n * 0.04; S.execMul = 1.8 + (n - 1) * 0.5; },
    bloom: S => { S.execHp = 0.42; S.execMul = 3.6; S.execGold = 1; } },
  { id: 'bind', name: '拘束立场', nameEn: 'BINDING FIELD', type: 'ability', glyph: '缚', max: 3,
    desc: '命中有几率\n将敌人定住',
    descEn: 'Hits can root\nfoes in place',
    // 借莫甘娜的「暗之禁锢」：首次引进**硬控**（e.stun）—— 敌人不能动、不能投射、
    //    铺网 / 放牧之类的循环计时也一起冻结（updateEnemies 里回滚 cd / st 增长）。
    //    ⚠️ Boss 完全免疫 —— 巨像站桩 1 秒且不开火的话，机制会直接坏掉。
    //    ⚠️ 概率判定挂在 damageEnemy 的 **quiet 之外**：爆炸 / 电链这类本来就不跳数字的范围伤害
    //       不该顺带定人 —— 否则一发高爆把整场按死，玩家还看不懂发生了什么。
    apply: (S, n) => { S.bind += 1; S.bindP = 0.10 + n * 0.05; S.bindT = 0.45 + n * 0.15; },
    bloom: S => { S.bindP = 0.36; S.bindT = 1.4; S.bindGold = 1; } },
  { id: 'rewind', name: '时滞回溯', nameEn: 'CHRONO REWIND', type: 'ability', glyph: '溯', max: 3,
    desc: '致命伤自动回溯\n回到数秒之前',
    descEn: 'Lethal damage\nrewinds time\n(long cooldown)',
    // 借艾克的「时空断裂」：致命伤到来时，把位置与船体一起拨回几秒前，
    //    并在**落点**（不是当前位置）炸开一记回响 —— 所以它是保命，也是一次翻盘。
    //    ⚠️ 冷却必须长（26~12 秒）：它是「再来一次」的卡，短了就是无限容错，
    //       玩家会失去对血条的敬畏，整个后半场的紧张感会被它一个人买走。
    //    ⚠️ 快照每 0.5 秒记一格（位置 + 船体），`G.snaps` 只留最近 5 秒 ——
    //       再往上留，回溯会把玩家丢到一个他早就不认识的位置上。
    apply: (S, n) => { S.rewind = n; S.rewindCd = 26 - (n - 1) * 4; S.rewindBack = 3; },
    bloom: S => { S.rewind = 3; S.rewindCd = 12; S.rewindBack = 3; S.rewindGold = 1; } },

  // ---- 第五批（2026-10-04）：英雄联盟主题装置能力 ----
  // 第四批借了卡兹克 / 诺手 / 莫甘娜 / 艾克四个技能；这一批再补六张，覆盖亚索 / 劫 / 盖伦 /
  // 卡特琳娜 / 金克丝 / 薇恩，让「英雄技能」这条线真正成体系。
  // 全部 type:'ability'、max:3，与既有装置卡一致；数值不照抄英雄数值，按本作弹幕节奏重定。
  // ⚠️ desc / descEn 硬宽度同上：中文每行 ≤ 9 字、英文每行 ≤ 19 半角，只能 3 行。
  { id: 'windwall', name: '风之障壁', nameEn: 'WIND WALL', type: 'ability', glyph: '风', max: 3,
    desc: '机首前方周期\n竖起风墙\n拦截敌弹',
    descEn: 'Periodic wall\nahead of you\nblocks shots',
    // 借亚索「风之障壁」：挡的是**弹**，不是人。竖在机首前 22px、横跨 84px，
    //    持续 wwDur 秒 —— 正面弹幕被切成两段，等于白送一段喘息。
    //    ⚠️ 只吃 ebullets（敌弹），不吃 enemies：撞墙的怪还是照撞，别让风墙变成无敌盾。
    apply: (S, n) => { S.ww = n; S.wwCd = 9 - (n - 1) * 1.4; S.wwDur = 1.0 + n * 0.25; },
    bloom: S => { S.ww = 3; S.wwCd = 5.2; S.wwDur = 2.0; S.wwGold = 1; } },
  { id: 'shadow', name: '影奥义', nameEn: 'SHADOW SLASH', type: 'ability', glyph: '影', max: 3,
    desc: '冷却就绪召出\n影分身\n镜像开火',
    descEn: 'On cooldown, a\nshadow clone\nfires with you',
    // 借劫「影奥义」：分身落在船体斜后方，存活 shDur 秒、每 0.5s 朝最近敌人射一发
    //    半伤弹 —— 它补的是「多一个点输出」，不是「替你挡枪」。
    apply: (S, n) => { S.sh = n; S.shCd = 11 - (n - 1) * 1.8; S.shDur = 3 + n; },
    bloom: S => { S.sh = 3; S.shCd = 6.4; S.shDur = 6; S.shGold = 1; } },
  { id: 'spin', name: '审判', nameEn: 'JUDGEMENT', type: 'ability', glyph: '判', max: 3,
    desc: '移动时旋斩\n光环持续\n削伤近身敌人',
    descEn: 'Spin-blade aura\nwhile moving\nscrapes nearby foes',
    // 借盖伦「审判」：只有**在动**才转（靠 updatePlayer 里的 G.moving 判），站着不动不结算 ——
    //    逼玩家保持走位，而不是站桩当 AOE 塔。每 0.22s 对 spinR 内敌人造成 spinDmg。
    apply: (S, n) => { S.spin = n; S.spinR = 30 + n * 8; S.spinDmg = 6 + n * 3; },
    bloom: S => { S.spin = 3; S.spinR = 60; S.spinDmg = 22; S.spinGold = 1; } },
  { id: 'lotus', name: '死亡莲华', nameEn: 'DEATH LOTUS', type: 'ability', glyph: '莲', max: 3,
    desc: '冷却就绪向\n四周绽放一圈\n刃雨',
    descEn: 'On cooldown, burst\nblades in all\ndirections',
    // 借卡特琳娜「死亡莲华」：触发即朝四面射出一圈 pBullet（走主炮同套派生，自动继承
    //    穿甲 / 跳弹 / 制导 / 裂变），所以它是「一次性的全向齐射」，不是新弹种。
    apply: (S, n) => { S.lotus = n; S.lotusCd = 8 - (n - 1) * 1.3; },
    bloom: S => { S.lotus = 3; S.lotusCd = 4.2; S.lotusGold = 1; } },
  { id: 'rampage', name: '杀戮狂热', nameEn: 'KILL RAMPAGE', type: 'ability', glyph: '狂', max: 3,
    desc: '每次击杀获得\n短暂狂热\n射速移速飙升',
    descEn: 'Each kill grants\na rampage:\nrate & speed surge',
    // 借金克丝「罪恶快感」：击杀刷 G.rampageT（3s），期间射速与移速 ×rampageMul。
    //    ⚠️ 倍率只作用在 updatePlayer 的两处消费点（fireT 间隔、ACC/MAXV），不进 S.rate/S.spd ——
    //       进的话续档重放会把它叠进基础值，越打越快且不可逆。
    apply: (S, n) => { S.rampage = n; },
    bloom: S => { S.rampage = 3; S.rampageGold = 1; } },
  { id: 'silver', name: '圣银弩箭', nameEn: 'SILVER BOLTS', type: 'ability', glyph: '银', max: 3,
    desc: '连续命中叠加\n圣银印记\n三层触发真伤',
    descEn: 'Consecutive hits\nstack Silver;\n3 stacks = true dmg',
    // 借薇恩「圣银弩箭」：对同一目标每发直接命中 +1 层（e.silver，3s 不中清零），满 3 层
    //    结算一次**真实伤害**（绕过护甲 / condMul，直接扣 e.hp），然后归零。
    //    ⚠️ 只对「非 quiet 的直接命中」累加 —— 爆炸 / 电链这类范围伤害不该偷偷叠层。
    //    ⚠️ Boss 也吃真伤，但层数判定里把银伤上限夹住（见 damageEnemy），别让它变成秒巨像。
    apply: (S, n) => { S.silver = n; S.silverDmg = 10 + n * 8; },
    bloom: S => { S.silver = 3; S.silverDmg = 40; S.silverGold = 1; } },

  // ---- 第六批（2026-10-09）：海克斯强化 / 英雄技能 ----
  // 前五批给的是「输出源」「更大的数字」「判断」「装置」。这一批给的是**姿态与时机**：
  //   crystal 给一条要瞄的线（冰箭），beam 给一个要停下来的窗口（站桩激光，与「审判」一动一静），
  //   headshot 给一个可预期的节奏（每第 N 发），undying 给一次「不死的几秒」，
  //   mark 给一段延迟结算的账（集火窗口），thorns 给一套「挨打也算输出」的反击。
  // 参考对象是《英雄联盟》的招牌技能 / 海克斯大乱斗的强化思路：**改写玩法，不只是加数值**。
  // ⚠️ desc / descEn 硬宽度同上：中文每行 ≤ 9 字、英文每行 ≤ 19 半角，只能 3 行。
  { id: 'crystal', name: '冰封长箭', nameEn: 'CRYSTAL ARROW', type: 'ability', glyph: '冰', max: 3,
    desc: '冷却就绪射出\n贯穿冰封长箭\n飞得越远越痛',
    descEn: 'Piercing ice arrow\nfreezes its path;\nhurts more far out',
    // 借艾希「魔法水晶箭」：一支**独立飞行体**（G.arrows），慢速、贯穿所有目标、
    //    沿途冻结（复用 e.root，与「拘束立场」同一套硬控），伤害按**已飞里程**递增。
    //    与「轨道长枪」的分工：长枪是「把你的一发主炮换成一瞬的直线」，
    //    冰箭是「场上多一件会自己飞的东西」—— 它要瞄、会飞偏、也可能空掉。
    //    ⚠️ 冻结对 Boss **不生效**（和 bind 一致）：巨像站定一秒不开火，机制会直接坏掉。
    apply: (S, n) => { S.crystal = n; S.crystalCd = 10 - (n - 1) * 1.6; },
    bloom: S => { S.crystal = 3; S.crystalCd = 4.8; S.crystalGold = 1; } },
  { id: 'beam', name: '瓦解射线', nameEn: 'VOID RAY', type: 'ability', glyph: '析', max: 3,
    desc: '站定蓄力射出\n瓦解射线\n一动就中断',
    descEn: 'Stand still to\ncharge a beam;\nmoving cancels',
    // 借维克兹「生命形态瓦解射线」：**站着不动**才蓄力，蓄满射出一条持续激光（每 0.12s 一跳）。
    //    和第五批的「审判」正好是一对反义：审判要你动，射线要你停 ——
    //    协同 `motionTwin` 把这两张卡咬成一套「动 / 静」节奏。
    //    ⚠️ 中断条件是 `G.moving`（速度 > 14），不是「按了 W」—— 被撞飞也会断，这是故意的。
    //    ⚠️ 质变（beamGold）才给「蒸发经过的敌弹」：站桩的回报必须够重，否则没人愿意停。
    apply: (S, n) => {
      S.beam = n; S.beamCd = 8 - (n - 1) * 1.4;
      S.beamLen = 260 + n * 40; S.beamDmg = 7 + n * 4; S.beamDur = 1.1 + n * 0.25;
    },
    bloom: S => { S.beam = 3; S.beamCd = 3.6; S.beamLen = 460; S.beamDmg = 26; S.beamDur = 2.6; S.beamGold = 1; } },
  { id: 'headshot', name: '爆头协议', nameEn: 'HEADSHOT', type: 'weapon', glyph: '头', max: 3,
    desc: '每数发主炮\n必出一记爆头\n必暴且穿透',
    descEn: 'Every few shots\none is a headshot:\ncrit and pierce',
    // 借凯特琳「爆头」：**按发数**而不是按冷却 —— 每第 hsEvery 发主炮变成一发必暴、
    //    多穿透一层的金色重弹。它给的是**可预期的节奏**（玩家能数出来），
    //    和「轨道长枪」（按时间冷却）是两种不同的「什么时候该压上去」。
    //    ⚠️ hsEvery / hsMul 一律覆盖式赋值：续档逐级重放 apply，累乘会把一级加成叠三次。
    //    ⚠️ 只有**第一根枪管**变爆头弹 —— 多联机炮不该一次齐射喷出三发重弹。
    apply: (S, n) => { S.headshot = n; S.hsEvery = 7 - n; S.hsMul = 2.2 + (n - 1) * 0.5; },
    bloom: S => { S.headshot = 3; S.hsEvery = 3; S.hsMul = 4.6; S.hsGold = 1; } },
  { id: 'undying', name: '无尽怒火', nameEn: 'UNDYING RAGE', type: 'ability', glyph: '怒', max: 3,
    desc: '致命伤不致死\n进入数秒怒火\n射速移速飙升',
    descEn: 'Lethal damage\nwon\'t kill you:\nbrief rampage',
    // 借泰达米尔「无尽怒火」：这一击本该致死 → 血锁 1，进入数秒怒火（免死 + 射速 / 移速飙升），
    //    怒火结束才重新变得会死。与「相位折跃 / 时滞回溯」的分工是**态度**：
    //    那两张是把失误**抹掉**（脱险 / 倒带），这一张是要你**站在原地扛完这一波**。
    //    ⚠️ 倍率只落在 updatePlayer 的两处消费点，绝不写进 S.rate / S.spd ——
    //       写进去会被续档重放叠进基础值（和杀戮狂热是同一个坑）。
    //    ⚠️ 冷却必须非常长（40~28 秒）：它是「整局只有几次」的按钮，不是常规生存卡。
    apply: (S, n) => { S.undying = n; S.undyingCd = 40 - (n - 1) * 6; S.undyingDur = 4 + n; },
    bloom: S => { S.undying = 3; S.undyingCd = 18; S.undyingDur = 9; S.undyingGold = 1; } },
  { id: 'mark', name: '死亡印记', nameEn: 'DEATH MARK', type: 'ability', glyph: '印', max: 3,
    desc: '命中留下印记\n两秒后引爆\n结算期间伤害',
    descEn: 'Marked foes take\nthe damage back\n2 seconds later',
    // 借劫「死亡印记」：直接命中给目标挂账（e.markAcc 累加期间承受的伤害），
    //    计时到期引爆一次真伤 —— **打得多爆得狠**，所以它奖励的是集火与爆发窗口，
    //    而不是「多打一枪」。与「圣银弩箭」的分工：圣银是「满 3 层固定真伤」（看层数），
    //    印记是「一段窗口内的总账按比例返还」（看总额）。
    //    ⚠️ 只有**非 quiet 的直接命中**记账 —— 爆炸 / 电链这类范围伤害不该偷记。
    //    ⚠️ 引爆伤害夹 `e.maxHp * 0.5`：否则叠满一套爆发能把巨像一击带走。
    apply: (S, n) => { S.mark = n; S.markT = 2; S.markPct = 0.30 + (n - 1) * 0.12; },
    bloom: S => { S.mark = 3; S.markT = 2; S.markPct = 0.75; S.markGold = 1; } },
  { id: 'thorns', name: '荆棘甲壳', nameEn: 'THORN PLATE', type: 'ability', glyph: '棘', max: 3,
    desc: '受击向周身\n弹回部分伤害\n满级附带减速',
    descEn: 'Taking damage\nspits it back at\nnearby foes',
    // 借拉莫斯「尖刺防御」/「荆棘之甲」：把**挨打**变成输出 —— 受击时按 thornPct
    //    把这部分伤害弹给周身的敌人（至多 4 个）。它和「冲角装甲」是一对：
    //    冲角要你**贴上去**，荆棘是**被贴上来**时的回敬。
    //    ⚠️ 反的是**实际扣掉的血**（护盾结算之后），不是原始伤害 —— 有盾时荆棘就该变弱，
    //       否则「护盾 + 荆棘」会变成同一份伤害吃两遍收益。
    //    ⚠️ 必须有节流（G.thornCd 0.2s）：受击自带无敌帧，但范围伤害同帧来多次会炸成刷屏。
    //    ⚠️ 质变给「附带减速」而不是「转成护盾」—— 后者依赖 shieldMax，
    //       没装护盾卡的局里这一条会静默失效。
    apply: (S, n) => { S.thorns = n; S.thornPct = 0.35 + (n - 1) * 0.2; S.thornR = 96 + n * 18; },
    bloom: S => { S.thorns = 3; S.thornPct = 1.1; S.thornR = 200; S.thornGold = 1; } },
];
// 卡牌类型名（数值 / 弹体 / 装置）现在走 i18n 的 'up.type.*'（up.typeName() 是唯一入口）
const typeName = t => T('up.type.' + t);
// id -> 模块定义。配件绘制（drawShipKit）每帧都要按 id 取 max 判满级，别再线性 find。
const MOD_BY_ID = {};
for (const m of MODULES) MOD_BY_ID[m.id] = m;

// ============ 模块协同（成对装配即生效） ============
// 只记 flag，数值在运行时读 —— 这样任何时候重算都不会重复叠加。
// ⚠️ 协同的英文写在条目自己身上（nameEn / descEn），走 L() 取。
//    desc 是**横幅副标题**（banner sub），画布上只有一行 12px、居中，
//    480px 宽下最多约 78 个半角字符 —— 超了就会被挤到画面外，写短。
const SYNERGIES = [
  { id: 'staticArc',  name: '静滞雷场', nameEn: 'STATIC MINE FIELD', a: 'arc',       b: 'stasis',     desc: '电弧冷却 -35%', descEn: 'Arc cooldown -35%' },
  { id: 'resonance',  name: '共振脉冲', nameEn: 'RESONANT PULSE', a: 'nova',      b: 'stasis',     desc: '冲击波对减速中的敌人伤害 ×1.7', descEn: 'Shockwave deals 1.7x to slowed foes' },
  { id: 'droneSwarm', name: '脉冲机群', nameEn: 'PULSE SWARM', a: 'nova',      b: 'drone',      desc: '每次冲击波为所有无人机瞬间装填', descEn: 'Each shockwave reloads every drone' },
  { id: 'phaseWall',  name: '相位护壁', nameEn: 'PHASE WALL', a: 'shield',    b: 'phasehull',  desc: '护盾回复速度 ×2', descEn: 'Shield regen x2' },
  { id: 'volley',     name: '齐射穿甲', nameEn: 'VOLLEY PIERCE', a: 'multigun',  b: 'piercer',    desc: '每根枪管额外 +1 穿透', descEn: '+1 pierce per barrel' },
  { id: 'cluster',    name: '霰爆',     nameEn: 'CLUSTER BLAST', a: 'hesh',      b: 'multigun',   desc: '爆炸范围 +30%', descEn: 'Blast radius +30%' },
  { id: 'pierceCrit', name: '穿甲暴击', nameEn: 'PIERCING CRIT', a: 'critcap',   b: 'warhead',    desc: '暴击倍率提到 3.3 倍', descEn: 'Crit multiplier raised to 3.3x' },
  { id: 'recycle',    name: '回收循环', nameEn: 'RECYCLE LOOP', a: 'magnet',    b: 'nanorepair', desc: '拾取星尘额外回血', descEn: 'Dust pickups also heal' },

  // ---- 新机制的配对协同（效果一律在运行时读 synOn()，不在装配那一刻改数值） ----
  { id: 'rearPierce',   name: '贯穿尾炮', nameEn: 'PIERCING REAR', a: 'backshot',   b: 'piercer',   desc: '尾炮火力 +45%，并且能穿透', descEn: 'Rear gun +45% and pierces' },
  { id: 'rearVolley',   name: '回马枪',   nameEn: 'REAR VOLLEY', a: 'backshot',   b: 'multigun',  desc: '齐射时尾炮再多 1 门', descEn: '+1 rear gun when volleying' },
  { id: 'bouncePierce', name: '穿甲跳弹', nameEn: 'PIERCING BOUNCE', a: 'piercer',    b: 'ricochet',  desc: '反弹次数 +1', descEn: '+1 bounce' },
  { id: 'moltenRam',    name: '熔火撞角', nameEn: 'MOLTEN RAM', a: 'deathtrail', b: 'ram',       desc: '冲角杀伤 +50%', descEn: 'Ram damage +50%' },
  { id: 'guidedPierce', name: '制导穿甲', nameEn: 'GUIDED PIERCE', a: 'guided',     b: 'piercer',   desc: '制导转向更急、锁定更远', descEn: 'Sharper homing, longer lock range' },
  { id: 'bounceBlast',  name: '跳雷',     nameEn: 'BOUNCE BOMB', a: 'ricochet',   b: 'hesh',      desc: '反弹过的炮弹爆炸范围 +35%', descEn: 'Bounced shots blast +35% wider' },

  // ---- 第二批机制的配对协同 ----
  // 这一批刻意让新卡去「咬」旧卡：口径咬穿甲、散射咬多联、裂变咬跳弹与高爆、噬能咬冲角与纳米。
  { id: 'heavyBore',    name: '重弹穿甲', nameEn: 'HEAVY BORE', a: 'caliber',   b: 'piercer',    desc: '弹丸半径再 +1.5，穿透 +1', descEn: 'Bullet radius +1.5, pierce +1' },
  { id: 'bulletWall',   name: '弹幕墙',   nameEn: 'BULLET WALL', a: 'spray',     b: 'multigun',   desc: '扇形弹 +3 发、扇形更宽', descEn: '+3 spray shots, wider arc' },
  { id: 'fissionBoom',  name: '裂变爆破', nameEn: 'FISSION BLAST', a: 'fission',   b: 'hesh',       desc: '弹片命中也会炸开', descEn: 'Shrapnel also explodes' },
  { id: 'bounceFission',name: '跳弹裂变', nameEn: 'BOUNCING FISSION', a: 'fission',   b: 'ricochet',   desc: '弹片继承 1 次反弹', descEn: 'Shrapnel inherits 1 bounce' },
  { id: 'ramLeech',     name: '撞击汲取', nameEn: 'RAM LEECH', a: 'leech',     b: 'ram',        desc: '冲角每次命中额外回血', descEn: 'Each ram hit heals extra' },
  { id: 'fieldMedic',   name: '战地回收', nameEn: 'FIELD MEDIC', a: 'leech',     b: 'nanorepair', desc: '所有回血 ×1.5', descEn: 'All healing x1.5' },

  // ---- 第三批机制的配对协同 ----
  { id: 'lanceCaliber', name: '重矛',     nameEn: 'HEAVY LANCE', a: 'lance',  b: 'caliber',  desc: '光矛更宽，贯穿伤害 +40%', descEn: 'Wider lance, pierce damage +40%' },
  { id: 'lancePierce',  name: '透体圣光', nameEn: 'PIERCING LIGHT', a: 'lance',  b: 'piercer',  desc: '光矛命中后留下一道灼烧带', descEn: 'Lance leaves a burning trail' },
  { id: 'blinkNova',    name: '折跃冲击', nameEn: 'BLINK SHOCK', a: 'blink',  b: 'nova',     desc: '折跃起点炸开一发冲击波', descEn: 'Blink bursts a shockwave behind' },
  { id: 'blinkPhase',   name: '相位残响', nameEn: 'PHASE ECHO', a: 'blink',  b: 'phasehull',desc: '折跃后的无敌时间 ×2', descEn: 'Post-blink invuln x2' },
  { id: 'mineHesh',     name: '磁暴高爆', nameEn: 'MAG BLAST', a: 'mine',   b: 'hesh',     desc: '磁雷爆炸范围 +45%', descEn: 'Mine blast radius +45%' },
  { id: 'mineStasis',   name: '迟滞雷场', nameEn: 'LINGER FIELD', a: 'mine',   b: 'stasis',   desc: '磁雷爆炸后留下一片减速场', descEn: 'Mines leave a slowing field' },

  // ---- 第四批的配对协同（2026-10-03）----
  // 规则同前三批：desc 是**横幅副标题**，画布上只有一行 12px、居中 → 英文 ≤78 半角字符。
  // 这一批刻意让每张新卡去咬一张叙事上说得通的旧卡：
  //   孤立咬暴击（看清了才打得出致命）、湮灭咬噬能（收割换续航）、
  //   拘束咬脉冲（先按住再推一波）、回溯咬相位（回去之后多喘一口气）。
  { id: 'loneMark',     name: '猎手直觉', nameEn: 'HUNTER INSTINCT', a: 'isolate', b: 'critcap', desc: '孤立目标必定暴击', descEn: 'Isolated foes always take crits' },
  { id: 'harvest',      name: '收割放牧', nameEn: 'HARVEST', a: 'execute', b: 'leech',    desc: '每一次斩杀额外回复 3% 船体', descEn: 'Each execute also heals 3% hull' },
  { id: 'staticBind',   name: '静滞钳制', nameEn: 'STATIC GRIP', a: 'bind',    b: 'nova',     desc: '冲击波必定把范围内的敌人定住', descEn: 'Shockwave always roots its victims' },
  { id: 'echoPhase',    name: '回溯残响', nameEn: 'ECHO PHASE', a: 'rewind',  b: 'phasehull',desc: '回溯后的无敌时间翻倍', descEn: 'Post-rewind invuln doubled' },

  // ---- 第六批的配对协同（2026-10-09）----
  // 规则同前五批：desc 是**横幅副标题**，画布上只有一行 12px、居中 → 英文 ≤78 半角字符。
  // 这一批里 `motionTwin` 是刻意设计的**反义配对**（一动一静），其余五条是「新卡咬旧卡」：
  //   冰箭咬拘束（都是硬控）、爆头咬暴击（都是致命一击）、怒火咬湮灭（都是残血）、
  //   印记咬高爆（都是延迟的炸）、荆棘咬装甲（都是挨打这件事）。
  { id: 'iceBind',      name: '冰封钳制', nameEn: 'ICE GRIP', a: 'crystal', b: 'bind',     desc: '冰箭的冻结时间 ×1.6', descEn: 'Ice arrow freezes 1.6x longer' },
  { id: 'motionTwin',   name: '一动一静', nameEn: 'STILL & STORM', a: 'beam', b: 'spin',   desc: '站定时射线 ×1.5，移动时旋斩更广', descEn: 'Still: ray x1.5. Moving: wider spin' },
  { id: 'headshotCrit', name: '致命一击', nameEn: 'LETHAL SHOT', a: 'headshot', b: 'critcap', desc: '爆头弹的暴击倍率 ×1.5', descEn: 'Headshot crit multiplier x1.5' },
  { id: 'lastStand',    name: '背水一战', nameEn: 'LAST STAND', a: 'undying', b: 'execute', desc: '怒火期间斩杀线翻倍', descEn: 'Execute threshold doubled while raging' },
  { id: 'markBurst',    name: '印记爆破', nameEn: 'MARK BLAST', a: 'mark',  b: 'hesh',     desc: '印记引爆时炸开一圈', descEn: 'Mark detonation also blasts' },
  { id: 'thornPlate',   name: '重装荆棘', nameEn: 'PLATED THORNS', a: 'thorns', b: 'armor', desc: '荆棘反伤 +60%', descEn: 'Thorn reflect +60%' },
];
const synOn = id => !!G.syn[id];
function recalcSynergies() {
  for (const sy of SYNERGIES) {
    if (G.syn[sy.id]) continue;
    if ((G.mods[sy.a] || 0) > 0 && (G.mods[sy.b] || 0) > 0) {
      G.syn[sy.id] = true;
      Sound.sfx.synergy();
      banner(T('bn.syn', L(sy, 'name')), L(sy, 'desc'), '#c070f0', 2.4);
    }
  }
}

// ============ 存档（跨局持久） ============
// 存：最佳成绩 / 累计击坠 / 最远航段 / 通关次数 / 已解锁船体 / 航行日志 / 音量。
// key 保持 sv_save_v1 不要换；新增字段一律给默认值，老档 Object.assign 上去就能用。
const SAVE_KEY = 'sv_save_v1';
const LOG_MAX = 6;   // 结算页一行 13px，再多了 270px 高的画布放不下
const SAVE_DEF = {
  best: 0, kills: 0, maxWave: 0, won: 0, runs: 0,
  hulls: ['peregrine', 'rapier', 'bulwark'],
  log: [],            // 最近 LOG_MAX 局：{hull, wave, kills, score, t, won, at}
  bgm: 0.8, sfx: 1,   // 0..1
  // 图鉴收录：id -> 遭遇次数。只增不减、跨局累计。
  seen: {},
  // 续档快照（标题页「继续航程」用）。**只留一份**：
  //   roguelike 一局本来就是一次性的，而 #wrap 只有 480x270 ——
  //   多个槽位会把面板顶出框外（见 style.css 里 .ov 那条注释，满装配面板已经踩过一次）。
  run: null,          // {hull,wave,score,level,xp,xpNext,dust,kills,mods:{},hp,won,t,at}
};
let SAVE = loadSave();
function loadSave() {
  let o = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) o = JSON.parse(raw);
  } catch (e) { o = null; }        // 存档损坏就重开，不要让整个游戏起不来
  if (!o || typeof o !== 'object') o = {};
  const s = Object.assign({}, SAVE_DEF, o);
  s.hulls = Array.isArray(o.hulls) ? o.hulls.slice() : SAVE_DEF.hulls.slice();
  s.log = Array.isArray(o.log) ? o.log.slice(-LOG_MAX) : [];
  // 老档没有这两个键 → 给默认值。⚠️ seen 必须保证是**对象**（不是数组 / null），
  //   run 必须保证是「对象且带 hull + wave」，否则宁可当没有存档 —— 一个残缺的
  //   快照会让「继续航程」在恢复时炸掉，而玩家根本看不懂发生了什么。
  s.seen = (o.seen && typeof o.seen === 'object' && !Array.isArray(o.seen))
    ? Object.assign({}, o.seen) : {};
  s.run = (o.run && typeof o.run === 'object' && o.run.hull && o.run.wave) ? o.run : null;
  // 老版本只写了 sv_best，顺手迁过来
  try {
    const legacy = +(localStorage.getItem('sv_best') || 0);
    if (legacy > s.best) s.best = legacy;
  } catch (e) {}
  return s;
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }

// ============ 图鉴收录 ============
// ⚠️ 只在「第一次见到」时才写盘：spawnEnemy 每生成一个敌人就会被调用，
//    一局下来几千次，次次 JSON.stringify + localStorage.setItem 是纯浪费。
//    首次发现才写 —— 整局最多 ~53 次（16 敌型 + 3 巨像 + 5 船体 + 29 模块）。
//    所以这里存的是「见过没有」而不是「见过几次」（次数不写盘，重开就归零，没必要）。
function markSeen(id) {
  if (!id || SAVE.seen[id]) return;
  SAVE.seen[id] = 1;
  writeSave();
}
// 解锁条件：kills = 累计击坠阈值，wave = 最远航段阈值；两个条件都写就是「或」
function hullUnlocked(h) { return !h.unlock || SAVE.hulls.indexOf(h.id) >= 0; }
function checkUnlocks(quiet) {
  const fresh = [];
  for (const h of HULLS) {
    if (!h.unlock || SAVE.hulls.indexOf(h.id) >= 0) continue;
    const u = h.unlock;
    if ((u.kills && SAVE.kills >= u.kills) || (u.wave && SAVE.maxWave >= u.wave)) {
      SAVE.hulls.push(h.id); fresh.push(h);
    }
  }
  if (fresh.length) {
    writeSave();
    if (!quiet) for (const h of fresh) { banner(T('bn.unlock', name1(h)), sub1(h), h.color, 3.2); Sound.sfx.ready(); }
  }
  return fresh;
}
// 距离解锁还差多少（给机库显示用）
function unlockProgress(h) {
  const u = h.unlock; if (!u) return null;
  const parts = [];
  if (u.kills) parts.push(T('hangar.kills', Math.min(SAVE.kills, u.kills), u.kills));
  if (u.wave) parts.push(T('hangar.waveProg', Math.min(SAVE.maxWave, u.wave), u.wave));
  return parts.join(' · ');
}

// ============ 蛛网（织网者铺下的减速场） ============
// 纯空间压力：不造成伤害，只是把你不想去的地方变慢。所以玩家是在「读地图」而不是在挨打。
const WEB_LIFE = 8, WEB_R = 30, WEB_SLOW = 0.45, WEB_MAX = 14;
function addWeb(x, y) {
  if (G.webs.length > WEB_MAX) G.webs.shift();
  G.webs.push({ x: clamp(x, 16, WORLD.w - 16), y: clamp(y, 16, WORLD.h - 16), r: WEB_R, life: WEB_LIFE, t: rand(TAU), grow: 0 });
  Sound.sfx.dust();
}
function webSlowAt(x, y) {
  let s = 0;
  for (const w of G.webs) {
    if (w.grow < 0.5) continue;
    const d = Math.hypot(x - w.x, y - w.y);
    if (d < w.r * w.grow) s = Math.max(s, WEB_SLOW);
  }
  return s;
}
function updateWebs(dt) {
  for (let i = G.webs.length - 1; i >= 0; i--) {
    const w = G.webs[i];
    w.t += dt; w.life -= dt;
    w.grow = Math.min(1, w.grow + dt * 2.4);
    if (w.life <= 0) G.webs.splice(i, 1);
  }
}
function drawWebs() {
  for (const w of G.webs) {
    if (!onScreen(w.x, w.y, w.r + 8)) continue;
    const R = w.r * w.grow;
    const fade = w.life < 2 ? w.life / 2 : 1;
    const pulse = 0.5 + Math.sin(w.t * 2.4) * 0.5;
    ctx.globalAlpha = 0.30 * fade + 0.10 * pulse * fade;
    ctx.fillStyle = '#5d275d'; disc(w.x, w.y, R);
    ctx.globalAlpha = 0.75 * fade;
    ctx.strokeStyle = '#c070f0'; ringPx(w.x, w.y, R, 1);
    // 放射状蛛丝 + 两层同心环
    for (let k = 0; k < 8; k++) {
      const a = w.t * 0.25 + k / 8 * TAU;
      pline(w.x, w.y, w.x + Math.cos(a) * R, w.y + Math.sin(a) * R, 1);
    }
    ringPx(w.x, w.y, R * 0.55, 1);
    ringPx(w.x, w.y, R * 0.28, 1);
    ctx.globalAlpha = 1;
  }
}

/* ============ 火场（熔渣锻炉留下的灼烧区）============
   和蛛网是**同一族机制**（都是「空间压力」），但落点不同：
     蛛网 = 不痛，只是把你不想去的地方变慢 → 玩家在读地图
     火场 = 真的掉血 → 玩家在被**切割场地**
   所以它才有资格撑起一只巨像：锻炉飞过哪里，哪里就不能再去，可用空间一点点被吃掉。

   ⚠️ 持续伤害靠 f.tick 做间隔，不是每帧扣 —— 每帧扣的话 60fps 下 7 点伤害
      一秒就是 420 点，玩家会在 0.1 秒内蒸发（而且完全看不出是被什么打死的）。 */
const FIRE_LIFE = 5.5, FIRE_R = 26, FIRE_DMG = 7, FIRE_TICK = 0.5, FIRE_MAX = 18;

/* ============ 「视界」形态的奇点常量（2026-10-20）============
   这一段不让玩家做别的事，只做一件：**和一颗奇点共处**。
   三件事必须同时成立，缺一个它就退化成「血更厚的潮涌」：

     ① 子弹被引力弯曲      → 「瞄准」这个动词被改写（往外侧打，让引力掰回来）
     ② 视界吞噬一切        → 敌人 / 星尘掉进去就没了，省弹药但没掉落
     ③ 喂饱它就长大        → 吞得越多视界越大、吸力越强 —— 白嫖击杀是有代价的

   ⚠️ 对玩家用**位移式**吸引，和 fieldDrift 同理：本作松手减速 940 px/s²，
      加速度形式的力会被刹车整帧吃掉（磁暴引力井踩过这个坑，见 AGENTS.md）。
   ⚠️ 对**子弹**可以用加速度（子弹没有刹车），但要写成**纯转向**（只改方向不改速率）——
      速率不变玩家才学得会：「子弹飞得一样快，只是路弯了」。真按引力加速的话，
      越靠近越快、弹道不可预测，那就不是技巧是抽奖。 */
const SING = {
  R0: 30,            // 事件视界初始半径
  RMAX: 52,          // 喂饱后的上限（+22，再多就不是「长大」是「铺满屏幕」）
  PULL_R: 540,       // 引力影响半径
  DRIFT: 92,         // 对玩家的位移式吸力（px/s）—— 玩家满速 168，顶得住但站不住
  EH_DMG: 11,        // 视界内每 0.5s 灼烧
  EH_TICK: 0.5,
  // ⚠️ 弯曲写成**角速度**（rad/s）而不是「加速度 / 速率」的物理解。
  //    物理解是对的，但可读性很差：引力几乎平行于弹道时（擦着飞过去）几乎不弯，
  //    实测 138px 行程只偏 7.7px —— 玩家根本看不出来，更别提学会打提前量。
  //    直接给角速度，弯曲量才和「离奇点多近」稳定挂钩。
  // ⚠️ 转向**最多转到正对奇点**（clamp 到朝向角），不会绕着它转圈 ——
  //    转圈的话近距离开火会变成抽奖。上限带来一个可读的规则：擦得越近，拐得越狠。
  BULLET_TURN: 1.5,  // 玩家子弹
  EBULLET_TURN: 0.8, // 敌弹（约一半）：要看得见，但不能让弹幕变得不可读
  FEED_ENEMY: 1.5,   // 吞一个敌人 → 视界 +1.5
  FEED_DUST: 0.3,    // 吞一份星尘 → +0.3
  TIER_MUL: [1, 1.26, 1.58],   // 三个加压档（每 1/3 时长涨一档）
  ORBIT: 190,        // 奇点绕玩家公转的半径：永远在屏幕内，又不会一直贴脸
  ORBIT_W: 0.22,     // 公转角速度 rad/s（约 28 秒一圈）
  FOLLOW: 1.6,       // 跟随时间常数的倒数：故意留滞后，玩家能「拖」着它走
};

/* 生成奇点。⚠️ 它**绕着玩家公转**而不是钉死在世界某点 ——
   钉死的话玩家一飞走它就出画了，而这一段的一切（弹道、走位、吞噬）都得看着它才成立。
   公转还白送一层战术：它有滞后，玩家可以主动把它「拖」到敌人堆里，让引力替自己清场。 */
function spawnSingularity() {
  const a = rand(TAU);
  G.sing = {
    x: G.px + Math.cos(a) * SING.ORBIT, y: G.py + Math.sin(a) * SING.ORBIT,
    r: SING.R0, r0: SING.R0, t: 0, orbitA: a, tier: 0, mul: SING.TIER_MUL[0], fed: 0,
  };
  G.ehTick = 0;
  ring(G.sing.x, G.sing.y, 84, '#c070f0', .7, 3);
  ring(G.sing.x, G.sing.y, 210, '#73eff7', .6, 2);
  Sound.sfx.warp(); addShake(6);
}

function addFire(x, y, r) {
  if (G.fires.length >= FIRE_MAX) G.fires.shift();
  G.fires.push({
    x: clamp(x, 16, WORLD.w - 16), y: clamp(y, 16, WORLD.h - 16),
    r: r || FIRE_R, life: FIRE_LIFE, t: rand(TAU), grow: 0, tick: 0,
  });
}
function updateFires(dt) {
  for (let i = G.fires.length - 1; i >= 0; i--) {
    const f = G.fires[i];
    f.t += dt; f.life -= dt;
    f.grow = Math.min(1, f.grow + dt * 3.2);   // 铺开比蛛网快，它是「喷出来」的
    f.tick -= dt;
    if (f.life <= 0) { G.fires.splice(i, 1); continue; }
    if (G.dead || G.inv > 0 || f.tick > 0 || f.grow < 0.4) continue;
    if (Math.hypot(G.px - f.x, G.py - f.y) < f.r * f.grow) {
      f.tick = FIRE_TICK;
      hurtPlayer(FIRE_DMG);
      // 站在火里持续冒橙烟 —— 不给反馈的话玩家只会觉得「血莫名其妙在掉」
      for (let k = 0; k < 3; k++) part({ x: G.px + rand(-6, 6), y: G.py + rand(-6, 6), vx: rand(-14, 14), vy: rand(-30, -12), life: .35, max: .35, col: '#ef7d57', size: 1, drag: 2 });
    }
  }
}
function drawFires() {
  for (const f of G.fires) {
    if (!onScreen(f.x, f.y, f.r + 8)) continue;
    const R = f.r * f.grow;
    const fade = f.life < 1.5 ? f.life / 1.5 : 1;
    const flick = 0.72 + Math.sin(f.t * 9) * 0.28;
    ctx.globalAlpha = 0.26 * fade * flick;
    ctx.fillStyle = '#ef7d57'; disc(f.x, f.y, R);
    ctx.globalAlpha = 0.34 * fade * flick;
    ctx.fillStyle = '#ffcd75'; disc(f.x, f.y, R * 0.62);
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = '#ef7d57'; ringPx(f.x, f.y, R, 1);
    // 三层跳动的火舌边：纯装饰，但让它和「静态的蛛网」一眼分得开
    for (let k = 0; k < 6; k++) {
      const a = f.t * 0.9 + k / 6 * TAU;
      const rr = R * (0.82 + Math.sin(f.t * 7 + k) * 0.16);
      pline(f.x + Math.cos(a) * R * 0.5, f.y + Math.sin(a) * R * 0.5, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// 死亡尾流：一条会自己淡掉的灼热带。
// 只用 fillRect / disc 画方块（不做圆形抗锯齿），观感和其余像素素材一致；
// 颜色随「还剩多少寿命」从亮白 → 橙 → 暗红，玩家能直接读出这条带子快没了。
// ⚠️ 单块 alpha 压得比较低（0.10—0.38）是有意的：带子每 0.055 秒落一块，
//    五六块必然重叠，alpha 给高了叠出来是一坨发浑的土黄，反而看不出是「尾流」。
function drawWakes() {
  if (!G.wakes.length) return;
  for (const w of G.wakes) {
    if (!onScreen(w.x, w.y, w.r + 8)) continue;
    // 长枪留下的灼烧带（透体圣光协同）走自己的配色，别跟死亡尾流混成一片橙
    const gold = w.lanceGold ? 1 : G.S.deathGold;
    const f = 1 - w.t / w.life;                 // 1 → 0
    const R = w.r * (0.45 + f * 0.5);
    ctx.globalAlpha = 0.10 + f * 0.28;
    ctx.fillStyle = w.lanceGold
      ? (f > 0.6 ? '#ffffff' : '#73eff7')
      : (gold ? (f > 0.6 ? '#ffe9a8' : '#ffcd75') : (f > 0.6 ? '#ffcd75' : '#ef7d57'));
    disc(w.x, w.y, R);
    ctx.globalAlpha = 0.35 + f * 0.5;
    ctx.fillStyle = f > 0.5 ? '#f4f4f4'
      : (w.lanceGold ? '#73eff7' : (gold ? '#ffcd75' : '#ef7d57'));
    ctx.fillRect(Math.round(w.x) - 1, Math.round(w.y) - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
}

// ============ 轨道长枪 / 磁暴雷 的绘制 ============
// 长枪是一道**瞬时**光束：伤害在 fireLance 里已经结算完，这里只做 0.26 秒的视觉残留。
// 三层叠加（外辉光 / 中层 / 白芯）+ 炮口闪，用 lighter 混合叠出「过曝」的金属感。
function drawLances() {
  if (!G.lances.length) return;
  for (const L of G.lances) {
    const f = 1 - L.t / L.life;
    if (f <= 0) continue;
    const col = L.gold ? '#ffcd75' : '#73eff7';
    const w = L.w;
    ctx.save();
    ctx.translate(Math.round(L.x), Math.round(L.y)); ctx.rotate(L.a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.18 * f; ctx.fillRect(0, -w * 2.1, L.len, w * 4.2);
    ctx.globalAlpha = 0.50 * f; ctx.fillRect(0, -w * 0.95, L.len, w * 1.9);
    ctx.fillStyle = '#f4f4f4';
    ctx.globalAlpha = 0.92 * f; ctx.fillRect(0, -w * 0.30, L.len, w * 0.6);
    ctx.globalAlpha = f; ctx.fillStyle = '#ffffff';
    disc(0, 0, w * (0.9 + f * 0.8));
    ctx.restore();
  }
}

/* ===== 第六批（2026-10-09）的绘制 ===== */

/* 冰封长箭：一支**看得见的箭**，不是一条拖影。
   ⚠️ 越飞越疼是它的机制（伤害按里程递增），所以箭体本身要随里程变亮 ——
      玩家得能从画面上读出「这支箭现在很疼」，否则那条递增曲线等于不存在。 */
function drawArrows() {
  if (!G.arrows.length) return;
  for (const a of G.arrows) {
    if (!onScreen(a.x, a.y, 30)) continue;
    const heat = Math.min(1, a.trav / 320);   // 与 updateArrows 的伤害递增同一条曲线
    const col = a.gold ? '#ffcd75' : '#cfe8ff';
    ctx.save();
    ctx.translate(Math.round(a.x), Math.round(a.y)); ctx.rotate(a.a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.14 + heat * 0.26; ctx.fillRect(-16, -3.2, 20, 6.4);   // 外辉光
    ctx.globalAlpha = 0.85;                 ctx.fillRect(-15, -1.1, 18, 2.2); // 箭杆
    ctx.fillStyle = '#f4f4f4';
    ctx.globalAlpha = 0.9;                  ctx.fillRect(1, -2.6, 5, 5.2);    // 箭镞
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.5;                                                    // 冰晶尾羽
    ctx.fillRect(-16, -5, 3, 3); ctx.fillRect(-16, 2, 3, 3);
    ctx.restore();
  }
}
/* 瓦解射线：蓄力 = 玩家脚下一圈**收拢**的紫环；发射 = 三层叠加的光柱 + 过曝枪口。
   ⚠️ 蓄力提示画在**船身上**而不是 HUD 角落：站桩这件事发生在战场上，
      玩家的眼睛在船上，把它挪到角落等于没有提示。 */
function drawBeam() {
  const S = G.S;
  if (S.beam <= 0 || G.dead) return;
  const col = S.beamGold ? '#ffcd75' : '#c070f0';
  if (G.beamFire > 0) {
    // 光柱被地形截断：撞上掩体就到那儿为止（判定同在 beamTick 里截）
    const len = Math.min(S.beamLen, G.beamClip || S.beamLen);
    const puls = 0.82 + Math.sin(G.t * 40) * 0.18;
    ctx.save();
    ctx.translate(Math.round(G.px), Math.round(G.py)); ctx.rotate(G.beamAng);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.16 * puls; ctx.fillRect(0, -BEAM_HALF * 2.2, len, BEAM_HALF * 4.4);
    ctx.globalAlpha = 0.46 * puls; ctx.fillRect(0, -BEAM_HALF, len, BEAM_HALF * 2);
    ctx.fillStyle = '#f4f4f4';
    ctx.globalAlpha = 0.9 * puls;  ctx.fillRect(0, -2.2, len, 4.4);
    ctx.restore();
    // 枪口过曝核心（画在世界坐标，不跟着旋转）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = S.beamGold ? '#ffe9a8' : '#e6c8ff';
    ctx.globalAlpha = 0.85 * puls;
    disc(G.px, G.py, 6 + puls * 3);
    ctx.restore();
    return;
  }
  if (G.beamCh > 0) {
    const k = Math.min(1, G.beamCh / BEAM_CHARGE);
    const R = 34 - k * 22;                  // 收满即发射：环越小 = 越接近发射
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1 + k;
    ctx.globalAlpha = 0.25 + k * 0.5; ringPx(G.px, G.py, R, 1 + k);
    ctx.globalAlpha = 0.12 + k * 0.2; ringPx(G.px, G.py, R + 6, 1);
    ctx.restore();
  }
}
/* 无尽怒火：整船裹一层暗红怒焰 + 两圈高频脉动的裂环。
   ⚠️ 必须和「低血量红色暗角」区分开：暗角是**警告**（慢呼吸），怒火是**我很强**（快脉动）。
      两者撞色会让人在真的快死时误以为自己开了大。 */
function drawUndying() {
  if (G.undyingT <= 0 || G.dead) return;
  const S = G.S;
  const puls = 0.72 + Math.sin(G.t * 22) * 0.28;
  drawGlow(ctx, '#e04060', 26 * (S.undyingGold ? 1.25 : 1), 0.34 * puls, G.px, G.py);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = S.undyingGold ? '#ffcd75' : '#ef7d57';
  ctx.globalAlpha = 0.5 * puls;  ringPx(G.px, G.py, 20, 2);
  ctx.globalAlpha = 0.28 * puls; ringPx(G.px, G.py, 27, 1);
  ctx.restore();
}

/* 棱镜·裂相的幻影。
   ⚠️ 用**同一个精灵**（SPR[p.spr]）而不是另画一张：玩家第一眼要把它认成「第二个它」，
      而不是「出来个新的东西」。区别只在这个半透明 + 单色描边的处理。
   ⚠️ 必须闪：不闪的话和本体一样实，玩家会去打它。 */
function drawPhantoms() {
  if (!G.phantoms.length) return;
  const b = G.boss;
  for (const p of G.phantoms) {
    const set = SPR[p.spr];
    if (!set || !onScreen(p.x, p.y, 40)) continue;
    ctx.save();
    ctx.globalAlpha = 0.42 + Math.sin(G.t * 7 + p.i * 2.1) * 0.10;
    ctx.drawImage(set.r[0], Math.round(p.x - set.w / 2), Math.round(p.y - set.h / 2));
    ctx.restore();
    // 一圈标明它是假的相位环：不画的话玩家只会觉得本体在闪
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#f4f4f4';
    ringPx(p.x, p.y, set.w / 2 + 3, 1);
    ctx.restore();
    if (b) {   // 和本体之间的能量索：说明**它从哪来**
      ctx.save();
      ctx.globalAlpha = 0.18; ctx.strokeStyle = b.color;
      pline(p.x, p.y, b.x, b.y, 2);
      ctx.restore();
    }
  }
}
/* 「视界」形态的奇点（2026-10-20）
   画的顺序就是它的读法，四层从外到内：
     ① 受力边界（很淡）   —— 让玩家知道「进了这个圈就被拽」
     ② 引力透镜（向内收） —— 一圈圈被吸进去，方向感
     ③ 吸积盘（绕转的弧） —— 被拉长的物质，说明它在吃东西
     ④ 视界（纯黑 + 光子环）—— ⚠️ 光子环是必需的：黑圆画在深色宇宙上等于看不见
   ⚠️ 克制：不加射线、不加噪点、不加第二层辉光。这四层已经把「这是个洞」说清楚了，
      再堆就变成另一只巨像的出场特效，而它恰恰**不是**敌人。 */
function drawSingularity() {
  const s = G.sing;
  if (!s || !onScreen(s.x, s.y, SING.PULL_R)) return;
  const puls = 0.78 + Math.sin(G.t * 3.1) * 0.22;

  // ① 受力边界：只画「明显受力」的那一段，画满 PULL_R 会把整个屏幕糊住
  ctx.save();
  ctx.globalAlpha = 0.09; ctx.strokeStyle = '#c070f0'; ctx.lineWidth = 1;
  ringPx(s.x, s.y, SING.PULL_R * 0.4, 1);
  ctx.restore();

  // ② 引力透镜：五道向内收缩的环（相位错开 → 看起来是连续的吸入）
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const ph = (s.t * 0.5 + i / 5) % 1;          // 0 → 1 表示由外向内
    ctx.globalAlpha = 0.20 * ph;
    ctx.strokeStyle = i % 2 ? '#73eff7' : '#c070f0';
    ringPx(s.x, s.y, s.r + 8 + (1 - ph) * 92, 1 + ph * 1.5);
  }
  ctx.restore();

  // ③ 吸积盘：三段绕转的扁弧（离心压扁 = 被引力拉长的物质）
  ctx.save();
  ctx.translate(Math.round(s.x), Math.round(s.y));
  ctx.rotate(s.t * 1.15);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    ctx.globalAlpha = 0.30 * puls;
    ctx.strokeStyle = i === 1 ? '#ffcd75' : '#ef7d57';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r + 13 + i * 3, (s.r + 13 + i * 3) * 0.34, 0, 0, Math.PI * 0.72);
    ctx.stroke();
  }
  ctx.restore();

  // ④ 视界本体
  ctx.save();
  ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.96;
  disc(s.x, s.y, s.r);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
  ringPx(s.x, s.y, s.r + 1.5, 2);
  ctx.globalAlpha = 0.32 * puls; ctx.strokeStyle = '#ffcd75'; ctx.lineWidth = 1;
  ringPx(s.x, s.y, s.r + 5.5, 1);
  ctx.restore();

  // 刚吃了一口的反馈：一圈快速收掉的亮环 —— 没有它，玩家看不出「喂它」是有代价的
  if (s.fedPulse > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, s.fedPulse / 0.35) * 0.85;
    ctx.strokeStyle = '#ffcd75'; ctx.lineWidth = 3;
    ringPx(s.x, s.y, s.r + 3, 3);
    ctx.restore();
  }
}
/* 星蚀的熄灭战场（2026-10-11）
   ⚠️ 做成一个**离屏遮罩**再贴回主画布，而不是直接在主画布上叠 radial gradient：
      直叠做不到「挖两个洞」（本体周围一圈 + 你自己脚下那一小圈），只能整体变暗；
      而只留本体一个圈的话，玩家在远处连自己的船都看不见 —— 那不是难度，那是瞎。
   ⚠️ 遮罩 canvas 复用一张（每帧只清 + 重画），不每帧新建 —— 新建 canvas 会稳定吃掉几毫秒。 */
let MSK = null;
function drawBlackout() {
  if (G.blackout <= 0) return;
  const L = viewL(), T = viewT();
  if (!MSK || MSK.width !== W || MSK.height !== H) {
    MSK = document.createElement('canvas'); MSK.width = W; MSK.height = H;
  }
  const m = MSK.getContext('2d');
  // 淡入淡出：首尾各 0.45s 渐变，中间保持满黑
  const k = Math.min(1, G.blackout / 0.45, (G.blackoutMax - G.blackout) / 0.45 + 0.15);
  const peak = 0.93 * Math.max(0, Math.min(1, k));
  if (peak <= 0.01) return;
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.clearRect(0, 0, W, H);
  m.fillStyle = '#05060d';
  m.globalAlpha = peak;
  m.fillRect(0, 0, W, H);
  // 挖洞：这一层已经铺满了黑，用 destination-out 按径向渐变把「亮度」减掉。
  m.globalCompositeOperation = 'destination-out';
  m.globalAlpha = 1;
  const hole = (wx, wy, R, soft) => {
    const sx = wx - L, sy = wy - T;
    const g = m.createRadialGradient(sx, sy, 0, sx, sy, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(Math.max(0.01, soft), 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g;
    m.beginPath(); m.arc(sx, sy, R, 0, TAU); m.fill();
  };
  // ① 巨像周围一圈（它的日冕就是唯一光源）
  const b = G.boss;
  if (b) hole(b.x, b.y, 210, 0.55);
  // ② 你自己脚下那一小圈 —— 必须给，否则玩家连自己在哪都不知道
  if (!G.dead) hole(G.px, G.py, 96, 0.4);
  m.globalCompositeOperation = 'source-over';
  ctx.drawImage(MSK, L, T);
}

function drawMines() {
  if (!G.mines.length) return;
  for (const m of G.mines) {
    if (!onScreen(m.x, m.y, m.pull + 10)) continue;
    const col = m.gold ? '#ffcd75' : '#c070f0';
    const pulse = 0.5 + Math.sin(m.t * 5.2) * 0.5;
    // 磁引范围：一圈极淡的虚环，给玩家「这里会被吸」的预告
    if (m.t >= m.arm) {
      ctx.globalAlpha = 0.09 + 0.07 * pulse;
      ctx.strokeStyle = col; ringPx(m.x, m.y, m.pull, 1);
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#1a1c2c'; disc(m.x, m.y, m.r + 1.5);
    ctx.fillStyle = col;       disc(m.x, m.y, m.r * (0.55 + pulse * 0.45));
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 2, 2);
    // 待机期（arm）外圈闪一圈：刚布下还不能引爆
    if (m.t < m.arm) { ctx.globalAlpha = 0.55; ctx.strokeStyle = '#f4f4f4'; ringPx(m.x, m.y, m.r + 4, 1); }
    ctx.globalAlpha = 1;
  }
}

// ============ 开局 ============
function newGame(hullId) {
  const hull = HULLS.find(h => h.id === hullId) || HULLS[0];
  const S = {
    hull: hull.id, hullName: hull.name, hullColor: hull.color,
    maxHp: hull.hp, hp: hull.hp,
    spd: hull.spd, dmg: hull.dmg, rate: hull.rate, turn: hull.turn,
    crit: 0.05, critMul: 2.4, pierce: 0, blast: 0, blastMul: 1,
    barrels: 1, drones: 0,
    // 搬运过来的机制：尾炮 / 跳弹 / 制导 / 冲角 / 尾流
    backshot: 0, backGold: 0,
    bounce: 0,
    homing: 0, homeR: 140, homeTrav: 0,   // 制导三件套：转弯角速度 / 锁定半径 / 单发最大里程（0 = 不启用）
    bounceBoost: 0,                       // 跳弹：每次反弹后的伤害加成（2026-10-03 加强）
    ram: 0, ramGold: 0,
    death: 0, deathGold: 0,
    // 第二批搬运：口径 / 散射 / 裂变 / 过载 / 噬能
    // bulletR / bspd / rangeMul 是**弹丸的物理参数**，pBullet 里读，所以所有友方弹丸共用。
    bulletR: 3, bspd: 1, rangeMul: 1,
    spray: 0, sprayMul: 0.62, sprayArc: 0.34,
    fission: 0, fissionMul: 0.45,
    leech: 0,
    caliberGold: 0, sprayGold: 0, fissionGold: 0, ovGold: 0, leechGold: 0,
    // 第三批搬运：轨道长枪 / 相位折跃 / 磁暴雷
    lance: 0, lanceCd: 0, lanceGold: 0, lanceT: 0,
    blink: 0, blinkCd: 0, blinkMax: 0, blinkT: 0,
    mine: 0, mineCd: 0, mineMax: 0, mineGold: 0, mineT: 0,
    // 第四批（2026-10-03）：孤立协议 / 湮灭指令 / 拘束立场 / 时滞回溯
    // ⚠️ isoMul / isoR / execHp / execMul / bindP / bindT / rewindCd 一律**覆盖式赋值** ——
    //    续档是逐级重放 apply 的，写成累乘会把同一级的加成叠三次。
    isolate: 0, isoMul: 0, isoR: 0, isoGold: 0,
    exec: 0, execHp: 0, execMul: 1, execGold: 0,
    bind: 0, bindP: 0, bindT: 0, bindGold: 0,
    rewind: 0, rewindCd: 0, rewindBack: 3, rewindGold: 0,
    // 吸附半径基准 78px（含义见 updatePickups 上方注释；旧值 46）
    shield: 0, shieldMax: 0, shieldRegenMul: 1, magnet: 78,
    regen: 0, invBonus: 0, dustHeal: 0,
    // 装置型能力状态
    arc: 0, arcT: 0, arcCdMul: 1,
    nova: 0, novaT: 3, novaR: 0, novaCd: 7,
    stasis: 0, stasisR: 0, stasisSlow: 0.5,
    // 质变视觉标记（满级后点亮）
    goldTrail: 0, goldMuzzle: 0, goldHurt: 0, droneGold: 0, autoPull: 0, novaVoid: 0,
    // 第五批（2026-10-04）：英雄联盟主题装置能力状态
    // ⚠️ wwT/shT/spin(在 G 上)/lotusT 这类「冷却计时」一律在 newGame 归零，
    //    续档是逐级重放 apply 的，漏了默认零值会在第一次触发前卡在「已就绪」之外的怪状态。
    ww: 0, wwT: 0, wwCd: 0, wwDur: 0, wwGold: 0,        // 风之障壁
    sh: 0, shT: 0, shCd: 0, shDur: 0, shGold: 0,        // 影分身
    spin: 0, spinR: 0, spinDmg: 0, spinGold: 0,          // 审判（触发计时在 G.spinT）
    lotus: 0, lotusT: 0, lotusCd: 0, lotusGold: 0,       // 死亡莲华
    rampage: 0, rampageGold: 0,                          // 杀戮狂热（剩余时间在 G.rampageT / 倍率在 G.rampageMul）
    silver: 0, silverDmg: 0, silverGold: 0,              // 圣银弩箭（层数在 e.silver / 衰减在 e.silverT）
    // 第六批（2026-10-09）：冰封长箭 / 瓦解射线 / 爆头协议 / 无尽怒火 / 死亡印记 / 荆棘甲壳
    // ⚠️ 计时类字段（crystalT / beamT / hsEvery 派生）一律在 newGame 归零 —— 续档是逐级重放
    //    apply 的，漏了默认零值会在第一次触发前卡在「已就绪」之外的怪状态。
    crystal: 0, crystalT: 0, crystalCd: 0, crystalGold: 0,
    beam: 0, beamT: 0, beamCd: 0, beamLen: 0, beamDmg: 0, beamDur: 0, beamGold: 0,
    headshot: 0, hsEvery: 0, hsMul: 1, hsGold: 0,
    undying: 0, undyingCd: 0, undyingDur: 0, undyingGold: 0,
    mark: 0, markT: 0, markPct: 0, markGold: 0,
    thorns: 0, thornPct: 0, thornR: 0, thornGold: 0,
  };
  // 船体自带的开局加成（蜂群带无人机之类）
  if (hull.drones) S.drones = hull.drones;
  if (hull.droneGold) S.droneGold = hull.droneGold;
  if (hull.critMul) S.critMul = hull.critMul;
  if (hull.crit) S.crit += hull.crit;
  if (hull.magnetMul) S.magnet *= hull.magnetMul;
  if (hull.bspdMul) S.bspd *= hull.bspdMul;
  return {
    S, hull,
    t: 0, wave: 1, waveState: 'spawn', waveT: 0, zone: 0,
    // 出生在世界正中心 —— 四个方向都留着等长的退路（世界是视口的 3 倍）
    px: WORLD.w / 2, py: WORLD.h / 2, vx: 0, vy: 0, ang: 0, aim: 0,
    fireT: 0, inv: 0, dashT: 0, dashCd: 0, hurtFlash: 0,
    moving: false,   // 「真的在动」（速度 > 14px/s）：审判光环与瓦解射线的中断判据都读它
    energy: 0, odT: 0, grazeT: 0,
    // 过热膛线（熔炉专属，2026-09-26 从《奇点回响》搬过来）。
    // ⚠️ 非熔炉船体 heatOn=false、heatMul 恒 1 —— 逐船断言「零溢出」靠的就是这两个默认值。
    heat: 0, heatMul: 1, heatLock: 0, heatOn: !!hull.heat,
    xp: 0, xpNext: 8, level: 1, kills: 0, score: 0, combo: 1, comboT: 0,
    dust: 0,
    enemies: [], ebullets: [], bullets: [], pickups: [], parts: [], fx: [], drones: [],
    webs: [],   // 织网者铺下的减速场
    wakes: [], wakeT: 0,   // 死亡尾流留下的灼热带（updateWakes 消费）
    lances: [],   // 轨道长枪的瞬时贯穿光矛（纯视觉，伤害在 fireLance 里一次结算完）
    mines: [],    // 磁暴雷（场上至多 S.mineMax 枚）
    walls: [],    // 风之障壁：机首前方的临时弹幕拦截线（G.walls，靠 t/life 自然消散）
    clones: [],   // 影分身：镜像开火的短暂分身（G.clones，靠 t/life 自然消散）
    phantoms: [], // 棱镜·裂相的幻影（绕本体转的**武器**，不是敌人 —— 打不死也不掉东西）
    // 地形（2026-10-21）：本段的静态场地（core 骨架 / rock 可破坏岩 / vent 喷口）。
    // ⚠️ 必须在这里建字段：updateTerrain / drawTerrain / 各解算每帧读它，
    //    靠 `G.xxx` 自动存在是这个项目踩过的坑（spawnEnemy 漏 xp 那回）。
    terr: [], layout: 'open',
    // 星区场地机制（2026-10-23）：本段跑哪一条（null = 巨像段 / 视界段不开）
    hz: null,
    zskin: null, zskinZone: -1,   // 星区皮肤的装饰元素（按 zone 缓存，换区才重建）
    beamClip: 0,      // 瓦解射线被地形截断后的实际长度（每跳重算，0 = 尚无）
    blackout: 0, blackoutMax: 0,   // 星蚀的熄灭战场：剩余秒 / 本次总时长（渲染算淡入淡出用）
    // 「视界」形态（2026-10-20）：一颗活的微型奇点。打不死，也不算敌人 ——
    //   它是**场地规则本身**。sing = { x, y, r, r0, t, tier, fed }
    sing: null,
    ehTick: 0,        // 事件视界的灼烧结算计时（每 0.5s 一跳，和受击无敌帧解耦）
    spinT: 0,     // 审判：旋斩光环的脉冲计时（每 0.22s 结算一次近身伤害）
    rampageT: 0, rampageMul: 1,   // 杀戮狂热：击杀后短暂抬升射速与移速
    // 第六批的新状态（2026-10-09）
    arrows: [],   // 冰封长箭：场上独立飞行的冰箭（靠 t/life 与里程上限自然消散）
    beamCh: 0, beamFire: 0, beamAng: 0, beamTick: 0,   // 瓦解射线：蓄力秒数 / 剩余发射 / 锁定方向 / 伤害跳计时
    shotN: 0,     // 爆头协议：主炮齐射计数（每第 hsEvery 次齐射出一发爆头弹）
    undyingT: 0, undyingCdT: 0,   // 无尽怒火：怒火剩余秒数 / 冷却剩余秒数
    thornCd: 0,   // 荆棘甲壳：反伤节流（秒）
    boss: null, bossRef: null, bossWarn: 0, bossPending: null, bossT: 0,
    shake: 0, banners: [], toasts: [], hitFlashN: 0,
    hitstop: 0, heartT: 0, vign: 0,     // 打击感：命中凝滞 / 心跳计时 / 受击暗角
    // 第四批的新状态（2026-10-03）
    furyT: 0,        // 湮灭指令的「狂热」剩余秒数：斩杀后短暂抬伤害
    rewindT: 0,      // 时滞回溯的剩余冷却
    snaps: [],       // 时间快照 [{x, y, hp, t}]，pushSnap 每 0.5s 记一格、只留最近 5 秒
    snapT: 0,
    mods: {}, // id -> level
    syn: {},  // 协同 id -> true
    spawnQueue: [], spawnT: 0, waveKills: 0, waveNeed: 0,
    // ---- 关卡形态（2026-10-03）：本段是「清剿 / 潮涌 / 回收 / 死斗」里的哪一种 ----
    // ⚠️ 四个字段必须在这里建好：updateWave 每帧读 G.waveForm 决定怎么判完成，
    //    靠 `G.xxx` 自动存在是这个项目踩过的坑，漏了就是 undefined = 永不完成 = 整局卡死。
    waveForm: 'purge',
    waveDur: 0,        // 潮涌：要存活的秒数
    dustNeed: 0, dustGot: 0, salvageT: 0,   // 回收：要捡够的星尘 / 补撒计时
    // 本局主线 4/8/12 段各出哪只巨像（开局洗牌抽 3 只，见 rollMainBosses）
    mainBosses: rollMainBosses(),
    fires: [],         // 熔渣锻炉留下的火场（updateFires 消费）
    dead: false, won: false,
    // 开火开关的当前值（触屏右下角那颗大按钮改的就是它）。
    // ⚠️ 必须在**这里**建字段：updatePlayer 每帧读 G.autoFire，靠 `G.xxx` 自动存在
    //    是这个项目踩过的坑（spawnEnemy 漏 xp 那回），漏了就是 undefined = 恒关。
    autoFire: autoFire,
  };
}

// ============ 打击感 ============
// 命中瞬间冻结画面几十毫秒。这是像素弹幕游戏最重要的手感来源：
// 没有它，击杀只是"敌人消失"；有了它，每一次命中都有重量。
// 上限 0.18s：连杀时不该把游戏冻成幻灯片
//
// ⚠️ `freezeQ` 是「连锁反应的熔断闸」（作者 2026-10-03：高爆弹的组合子弹多了会卡顿）。
//    单次凝滞只有几十毫秒，但**高爆 / 集束 / 裂变**叠满时，一帧里能触发十几次
//    「爆炸 → 打死一群 → 各自再炸」，每炸一次就把 hitstop 灌一轮，画面变成连续顿挫。
//    所以 `noFreeze()` 包起来的那段（explode 的范围伤害与它连带打死的一切）只留画面震动、
//    不留凝滞 —— 爆炸给的是「一片」的反馈，不是「一发入魂」的反馈。
//    单发命中的顿挫感（暴击 / 直接打死）照旧，那才是凝滞该出场的地方。
let freezeQ = 0;
// 凝滞节流。把 explode 里的 freeze 拿干净之后还有一半问题：
// 剩下的**逐杀 freeze(0.045)** 照样能把画面锁住 —— 一秒里连杀二十次，
// 每次都把 hitstop 灌到一个值，画面就是连续顿挫，和爆炸那边的观感是同一件事。
// 所以给「小事件」加一个最短间隔：冻 45ms + 冷却 160ms →
//    连杀退化成「有节奏的脉冲」，单次击杀的顿挫感原样保留。
// ⚠️ 只对 t < 0.06 的事件生效 —— 受击(0.07)、精英击杀(0.08)、巨像陨落(0.16)必须**每次都给**，
//    那几件是玩家要读到的信息，不是装饰。
const HITSTOP_GAP = 0.16;
let hitstopCd = 0;
function freeze(t) {
  if (!G || freezeQ > 0) return;
  if (hitstopCd > 0 && t < 0.06) return;
  G.hitstop = Math.min(0.18, Math.max(G.hitstop, t));
  hitstopCd = HITSTOP_GAP;
}
function noFreeze(fn) {
  freezeQ++;
  try { return fn(); } finally { freezeQ--; }
}
// 按事件分级的震动，避免所有东西都震得一样
// ⚠️ blastSmall 是新增的：以前小爆炸（R<40，弹片 / 连锁的主力）**完全不震**，
//    连锁起来画面毫无反馈，只剩 hitstop 在冻。现在给一点点，和真·高爆那发区分开。
const SHAKE = { hit: 1.2, crit: 2.4, kill: 3.2, bigKill: 9, hurt: 5.5, blast: 3.0, blastSmall: 1.1, od: 6 };
const SHAKE_CAP = 9;
// 震动也不再简单相加 —— 一帧十几次 addShake 会一路顶到上限、屏幕糊成一片。
// 改成「先记账，帧末结算」：**最大的那次全额发出**（巨像爆炸这种单次大事件不能被稀释），
// 其余按平方根压缩后叠加（10 次小连锁 ≈ 一次中等爆炸的量级，而不是 10 倍）。
let shakeQ = 0, shakeMax = 0;
function addShake(v) { if (v > shakeMax) shakeMax = v; shakeQ += v; }
function flushShake() {
  const q = shakeQ, mx = shakeMax;
  shakeQ = 0; shakeMax = 0;
  if (!G || q <= 0) return;
  const rest = Math.sqrt(Math.max(0, q - mx));
  G.shake = Math.min(SHAKE_CAP, G.shake + mx + rest * 0.6);
}

// ============ 空间网格 ============
const CELL = 24; const grid = new Map();
const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
function buildGrid() {
  grid.clear();
  for (const e of G.enemies) {
    const k = gkey((e.x / CELL) | 0, (e.y / CELL) | 0);
    let a = grid.get(k); if (!a) grid.set(k, a = []);
    a.push(e);
  }
}
function forNear(x, y, r, fn) {
  const c0 = ((x - r) / CELL) | 0, c1 = ((x + r) / CELL) | 0;
  const r0 = ((y - r) / CELL) | 0, r1 = ((y + r) / CELL) | 0;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const a = grid.get(gkey(cx, cy)); if (!a) continue;
    for (const e of a) if (e.hp > 0) fn(e);
  }
}
// 命中判定专用：和 forNear 同样的格子遍历，但**不收闭包、不分配**。
// ⚠️ 这是每帧最热的一处（220 发弹 × 60fps ≈ 1.3 万个箭头函数/秒），
//    那个分配量会直接变成 GC 压力。只在 updateBullets 里用。
function firstHit(x, y, gridR, pr) {
  const c0 = ((x - gridR) / CELL) | 0, c1 = ((x + gridR) / CELL) | 0;
  const r0 = ((y - gridR) / CELL) | 0, r1 = ((y + gridR) / CELL) | 0;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const a = grid.get(gkey(cx, cy)); if (!a) continue;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.dead || e.hp <= 0) continue;
      const rr = e.r + pr;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= rr * rr) return e;
    }
  }
  return null;
}
// 同 firstHit：把格子遍历内联进来，不接闭包、不分配。
// ⚠️ nearest 是仅次于命中判定的第二热路径 —— 制导弹每 0.12s 重找一次目标、
//    各种追踪/协同/无人机也调它，弹幕一密就是每秒几千次闭包分配。
function nearest(x, y, R, excl) {
  let best = null, bd = R * R;
  const c0 = ((x - R) / CELL) | 0, c1 = ((x + R) / CELL) | 0;
  const r0 = ((y - R) / CELL) | 0, r1 = ((y + R) / CELL) | 0;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const a = grid.get(gkey(cx, cy)); if (!a) continue;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e === excl || e.dead || e.hp <= 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
  }
  return best;
}

// ============ 特效 ============
const MAXP = 1500;
function part(o) { if (G.parts.length < MAXP) G.parts.push(o); }
function burst(x, y, n, cols, spd = 80, life = 0.5, size = 2, spark = false) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), s = rand(spd * 0.35, spd);
    part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * .6, life), max: life, col: pick(cols), size, drag: 3, spark });
  }
}
function addNum(x, y, v, crit) {
  part({ x, y, vx: rand(-14, 14), vy: -34, life: .55, max: .55, num: crit ? Math.round(v) + '!' : '' + Math.round(v), color: crit ? '#ffcd75' : '#f4f4f4', drag: 1.6, size: 0, keep: true });
}
function floatText(x, y, str, color, life = 1) {
  part({ x, y, vx: 0, vy: -22, life, max: life, num: str, color, drag: 2, size: 0, keep: true });
}
// ⚠️ addShake **不在这里** —— 它和 freeze / SHAKE / flushShake 一起定义在「打击感」那一节
//    （本文件靠上一点）。这里原本有一份旧的 `Math.min(11, ...)` 实现，删掉之前它一直在
//    **覆盖**新实现（同名函数声明，后者胜出），所谓「帧末合并」根本没生效。
// ⚠️ banner/toast 都是往 G 上挂的，但机库里 G === null（toTitle 会把它清掉）。
//    机库点未解锁船体会走 toast，没这层保护就是一句 TypeError 直接抛出去。
function banner(title, sub, color = '#ffcd75', life = 2.6) { if (!G) return; G.banners.push({ title, sub, color, t: 0, life }); }
function toast(title, sub, color = '#ffcd75', life = 1.8) { if (!G) return; G.toasts.push({ title, sub, color, t: 0, life }); if (G.toasts.length > 2) G.toasts.shift(); }
function ring(x, y, R, color, life = 0.35, th = 2) { G.fx.push({ type: 'ring', x, y, R, color, t: 0, life, th }); }

// ============ 射击 ============
function pBullet(x, y, ang, spd, dmg, o = {}) {
  if (G.bullets.length > 420) return;
  // 制导弹药要拐弯，射程得给够，否则弹丸在半路就寿终、看起来像「制导没生效」
  const homing = o.homing ?? G.S.homing;
  // 口径校准：半径与射程都从这里读，所以扇形弹 / 尾炮 / 弹片会一起变粗变远。
  // 重弹穿甲协同再给一层半径 —— 叠在口径之上，而不是替换它。
  const extraR = synOn('heavyBore') ? 1.5 : 0;
  const life0 = o.life || (homing ? 1.45 : 1.1) * G.S.rangeMul;
  // 外观族标记先取出来（纯视觉，判定不看它）。⚠️ 必须在这里声明成局部常量：
  //   下面的 decel 默认值要拿它和 'main' 比，而 `o.decel ?? …` 在**调用方没传 decel 时**
  //   一定会去求值那一侧 —— 之前直接写 `kind === 'main'` 而函数里没有 kind，
  //   于是无人机弹（2239）和裂变弹片（2593）这两条不传 decel 的路径一开火就抛
  //   ReferenceError（`kind is not defined`），整帧更新被中断。
  const kind = o.kind || 'main';
  G.bullets.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, dmg,
    r: o.r || (G.S.bulletR + extraR),
    life: life0, life0,
    // 爆头协议：这一发**必定**暴击（o.crit 显式给定）。默认 undefined，走命中时的随机判定。
    // ⚠️ 用 `?? null` 而不是 `|| false` 无所谓，关键是别让它变成 0 之后又被 `b.crit ||` 吞掉。
    crit: o.crit,
    // 初速（decel 分支按剩余寿命把它往 BDECEL_S 收，营造「出膛快、临终慢」的手感）
    sp0: spd,
    // 普通子弹（主炮 / 散射 / 尾炮）的基础特性：临近消失时减速。制导 / 弹片 / 无人机不减速。
    decel: o.decel ?? (kind === 'main'),
    // 齐射穿甲：每根枪管额外 +1 穿透，所以要在发射时算（枪管数会变）
    pierce: o.pierce ?? (G.S.pierce + (synOn('volley') ? G.S.barrels : 0)
                          + (synOn('heavyBore') ? 1 : 0)),
    // 跳弹：反弹次数同样发射时定格；穿甲跳弹协同额外 +1
    bounce: o.bounce ?? (G.S.bounce + (synOn('bouncePierce') ? 1 : 0)),
    blast: o.blast ?? G.S.blast, homing, hit: null,
    // 外观来源标记（**纯视觉**）：main 主炮 / rear 尾炮 / spray 散射 / shard 裂变弹片 / drone 无人机。
    // 判定一律不看它 —— 它只用来在 drawPBullets 里查「这一族该画成什么样」。
    kind: kind,
    tgt: null, retarget: 0, bounced: false,
    // 裂变弹芯：随弹丸走，命中那一刻才决定炸几片 —— 这样它也能被尾炮 / 弹片继承。
    fission: o.fission ?? G.S.fission, fissionMul: o.fissionMul ?? G.S.fissionMul,
    fissioned: false,
    // 制导弹才用得上：已飞里程（updateBullets 里累计，超 S.homeTrav 就失坠）
    trav: 0,
    // 跳弹：已反弹次数（只用于算 bounceBoost 的伤害加成，和 bounce「剩余次数」是两回事）
    bounceN: 0,
  });
}
/* 制导弹失坠：飞够里程就自己熄灭（作者 2026-10-03：「飘到一定距离就自己消失」）。
   ⚠️ 必须给一个**看得见的反馈** —— 静默 splice 的话，玩家只会感觉「制导有时候不生效」，
      永远意识不到这发是走完射程了。一小撮灰烟 + 一声很轻的音效，语义就清楚了：
      「不是没制导，是它飞到头了」。 */
function expireBullet(b, i) {
  burst(b.x, b.y, 4, ['#7a86a8', '#566c86'], 46, 0.26, 1, true);
  Sound.sfx.fizzle();
  G.bullets.splice(i, 1);
}
// 敌弹自带 dmg（默认 9）。⚠️ 不要在 updateEBullets 里写死 9 ——
// 无尽档位要靠这里把 TIER_DMG 传播到每一发弹丸上，写死就等于弹幕永远挠痒。
function eShot(x, y, ang, spd, r, color, o = {}) {
  if (G.ebullets.length > 900) return;
  G.ebullets.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, color,
    dmg: (o.dmg || 9) * eTierDmg(G.wave), life: o.life || 6, t: 0,
    // 追命弹（2026-10-11，星蚀/棱镜/磁暴用）：缓慢转向玩家。
    //   ⚠️ rad/s 单位，敌我一致 —— 玩家的制导弹是 0.62/级，这里给 0.9 看着高，
    //   但它的初速只有 0.55 倍、且转向有 0.6s 的启动延迟（见 updateEBullets），
    //   实际手感比玩家自己的制导迟钝得多。
    homing: o.homing || 0,
  });
}
const HOSTILE = { red: '#ff3355', pink: '#ff66cc', purple: '#c070f0', amber: '#ffcd75' };

/* 当前船体「机首 / 机尾」伸出船体中心的像素距离（sprites.js 在 buildSprites 里量好塞进 SHIPSET）。
   子弹出膛点 = 机首，尾焰锚点 = 机尾 —— 这样弹丸是从模型炮口打出去、尾焰从船尾喷出来的。 */
function hullNose() { const s = SHIPSET[G.S.hull]; return s ? s.nose : 13; }
function hullTail() { const s = SHIPSET[G.S.hull]; return s ? s.tail : 11; }

/* 普通子弹的基础手感：开火初速快，临近消失时减速（见 updateBullets 里的 decel 分支）。
   BDECEL_T = 进入减速的剩余寿命比例阈值（最后 40% 才开始掉速），BDECEL_S = 临终速度下限（初始速度的 45%）。 */
const BDECEL_T = 0.4, BDECEL_S = 0.45;

/* 轨道长枪（搬运自 echo 的 lance）
   冷却就绪时，**这一发主动射击**被换成贯穿光矛：不做成「另一门炮自动开火」，
   而是把玩家自己扣的那一次扳机放大 —— 这样它才有「攒一发」的节奏感。
   ⚠️ 判定用「点到线段距离」一次扫全部敌人（O(n)），不要沿矛身逐格 buildGrid+forNear：
      矛长 540px、每 8px 一次查询就是 68 次网格检索，纯浪费。 */
function fireLance(ang) {
  const S = G.S;
  const wide = synOn('lanceCaliber') ? 1.4 : 1;
  const w = (4.5 + S.lance * 1.7) * wide;                     // 半宽
  // 矛长按**视口**宽度算：玩家永远在视口中心附近，560 足够横穿整个画面。
  // （不用 WORLD.w —— 那是 3 倍视口，会让矛在屏幕外白烧一大截，还把「点到线段距离」
  //   的 O(n) 判定白白拉长。）
  const len = W + 80;
  // 地形截断：光矛是贯穿武器，不截的话它会烧到墙后面的敌人 ——
  //   而那面墙正是玩家拿来挡弹的东西，「我的掩体对我自己的武器无效」是很难读的。
  const len2 = G.terr.length ? terrRay(G.px, G.py, ang, len) : len;
  const dmg = (44 + S.lance * 26) * S.dmg * (synOn('lanceCaliber') ? 1.4 : 1);
  const mz = hullNose();
  const ox = G.px + Math.cos(ang) * mz, oy = G.py + Math.sin(ang) * mz;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let hitN = 0;
  for (const e of G.enemies) {
    if (e.dead || e.hp <= 0) continue;
    const dx = e.x - ox, dy = e.y - oy;
    const along = dx * ca + dy * sa;
    if (along < -e.r || along > len2) continue;
    const perp = Math.abs(-dx * sa + dy * ca);
    if (perp > w + e.r) continue;
    damageEnemy(e, dmg, ca, sa, false, 2.4);
    hitN++;
  }
  G.lances.push({ x: ox, y: oy, a: ang, len: len2, w, t: 0, life: 0.26, gold: S.lanceGold ? 1 : 0 });
  // 透体圣光协同：矛身沿途留下一条灼烧带（复用死亡尾流那套 wake 结算）
  if (synOn('lancePierce')) {
    const gold = S.lanceGold ? 1 : 0;
    for (let d = 30; d < len2; d += 26) {
      const x = ox + ca * d, y = oy + sa * d;
      if (x < -30 || x > WORLD.w + 30 || y < -30 || y > WORLD.h + 30) break;
      G.wakes.push({ x, y, t: 0, life: 0.7, r: w + 3, hitT: -1, lanceGold: gold });
      if (G.wakes.length > 96) G.wakes.shift();
    }
  }
  S.lanceT = S.lanceCd;
  G.muzzle = 0.1;
  addShake(S.lanceGold ? 7 : 5);
  Sound.sfx.lance();
  if (hitN) freeze(0.09);
}

/* ============ 过热膛线（熔炉专属，2026-09-26 从《奇点回响》完整搬） ============
   口径（与 echo 一字不差）：开火时按**速率**蓄热（与射速解耦 —— 若按「每发累加」，
   高射速构筑 1 秒就烧穿，「节奏取舍」会退化成「不许点射」）；停火散热；
   见顶锁死炮膛 HEAT_LOCK 秒并强制排空。伤害在冷膛 HEAT_COLD 与满膛 HEAT_HOT 之间**线性**浮动。
   ⚠️ HEAT_VENT 必须与 HEAT_MAX/HEAT_LOCK 对齐（锁膛结束时正好排空）——
      改任一个都要重算，不对齐会出现「锁膛结束了热量还留着一截」。
   ⚠️ 非熔炉船体 heatOn=false：不蓄热、heatMul 恒 1，所以主炮伤害与改动前**完全一致**
      （平衡探针的基线因此不会被带跑）。 */
const HEAT_MAX = 100;                   // 热量上限
const HEAT_UP = 30;                     // 开火时每秒累积 —— 满膛 3.3s，与射速无关
const HEAT_COOL = 34;                   // 停火时每秒散热 —— 满膛排空约 2.9s
const HEAT_LOCK = 1.7;                  // 锁膛时长
const HEAT_VENT = HEAT_MAX / HEAT_LOCK; // 锁膛期间每秒强制散热（≈58.8，刚好排空）
const HEAT_COLD = 0.85;                 // 冷膛伤害倍率
const HEAT_HOT = 1.45;                  // 满膛伤害倍率

function fireMain(ang, dmgMul = 1) {
  const S = G.S, n = S.barrels;
  // 长枪就绪 → 这一发整个换成光矛（不叠主炮，避免「既开炮又开矛」变成双倍 DPS）
  if (S.lance > 0 && S.lanceT <= 0) { fireLance(ang); return; }
  // 过热膛线：heatMul 直接乘进 base —— 尾炮 / 扇形弹 / 跳弹全从 base 派生，自动继承。
  // 非熔炉船体 heatMul 恒 1，这一项等于没乘。
  const base = 10 * S.dmg * dmgMul * G.heatMul;
  // 出膛点 = 机首（炮口），不是船心。sprites.js 在 buildSprites 里量好的 nose/tail。
  // 多管在主炮口沿「舷向」略微错开，看起来像一排炮管齐射，而不是全挤在一个点。
  const mz = hullNose(), tl = hullTail();
  const spd = 320 * S.bspd;      // 口径校准：弹速是全局弹丸参数，尾炮 / 扇形弹一起吃
  // 爆头协议：计数在**齐射**这一层（不是每根枪管一次），并且只让**第一根枪管**变重弹 ——
  //    多联机炮一次齐射喷出三发必暴重弹就变成纯数值膨胀了。
  G.shotN++;
  const hsOn = S.headshot > 0 && S.hsEvery > 0 && G.shotN % S.hsEvery === 0;
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
    const a = ang + spread;
    const perp = (i - (n - 1) / 2) * 3;   // 舷向错开
    const ox = G.px + Math.cos(a) * mz - Math.sin(a) * perp;
    const oy = G.py + Math.sin(a) * mz + Math.cos(a) * perp;
    if (hsOn && i === 0) {
      // ⚠️ pierce / r 要在这里**显式**算出来再传：pBullet 里是 `o.pierce ?? S.pierce + …`，
      //    传了就走传入值，所以协同的加成必须自己带上，不能指望它再补一次。
      const extraR = synOn('heavyBore') ? 1.5 : 0;
      pBullet(ox, oy, a, spd * 1.15, base * S.hsMul, {
        decel: true, kind: 'headshot', crit: true,
        pierce: S.pierce + 1 + (synOn('volley') ? S.barrels : 0) + (synOn('heavyBore') ? 1 : 0),
        r: S.bulletR + 2.5 + extraR,
      });
      Sound.sfx.lock();
    } else {
      pBullet(ox, oy, a, spd, base, { decel: true });
    }
  }
  // 散射喷嘴：用「弹丸数量」换「单发威力」，把「命中」变成「覆盖」。
  // ⚠️ 扇形弹走同一套 pBullet，所以穿甲 / 跳弹 / 制导 / 裂变会**全部自动继承**。
  //    这是有意的：它是一张「放大其它弹体卡」的卡，不是一门独立的小炮。
  //    也正因为如此，它的单发伤害必须明显低于主炮（0.62→0.76），否则直接变成纯加强。
  if (S.spray > 0) {
    const sn = S.spray + (synOn('bulletWall') ? 3 : 0);
    const arc = S.sprayArc * (synOn('bulletWall') ? 1.25 : 1);
    for (let i = 0; i < sn; i++) {
      const t = sn === 1 ? 0 : (i / (sn - 1) - 0.5) * 2;   // -1 → +1
      const a = ang + t * arc;
      pBullet(G.px + Math.cos(a) * mz * 0.92, G.py + Math.sin(a) * mz * 0.92, a, spd * 0.92,
        base * S.sprayMul, { kind: 'spray', decel: true });
    }
  }
  // 尾炮：每次齐射同时向船尾开火。伤害只有正面的 55%，所以它不是「DPS 翻倍」，
  // 而是把「背后永远安全」这条默认规则取消掉 —— 被追着跑的时候才有意义。
  // 出膛点 = 机尾（与正面炮口对称），所以尾焰和尾炮都真的从船尾出来。
  if (S.backshot > 0) {
    const bn = S.backshot + (synOn('rearVolley') ? 1 : 0);
    const back = ang + Math.PI;
    const bMul = 0.55 * (synOn('rearPierce') ? 1.45 : 1);
    const bpierce = S.pierce + (synOn('volley') ? S.barrels : 0) + (synOn('rearPierce') ? 1 : 0);
    for (let i = 0; i < bn; i++) {
      const spread = bn === 1 ? 0 : (i - (bn - 1) / 2) * 0.17;
      const a = back + spread;
      const perp = (i - (bn - 1) / 2) * 3;
      const ox = G.px + Math.cos(a) * tl - Math.sin(a) * perp;
      const oy = G.py + Math.sin(a) * tl + Math.cos(a) * perp;
      pBullet(ox, oy, a, spd * 0.94, base * bMul,
        { kind: 'rear', pierce: bpierce, decel: true });
    }
  }
  Sound.sfx.shoot();
  G.muzzle = 0.06;
}

function activateOverdrive() {
  if (G.energy < 100 || G.odT > 0) return;
  G.energy = 0; G.odT = 5;
  Sound.sfx.overdrive();
  banner(T('bn.od'), T('bn.odSub'), '#73eff7', 1.8);
  ring(G.px, G.py, 200, '#73eff7', 0.6, 3);
  burst(G.px, G.py, 40, ['#73eff7', '#f4f4f4', '#41a6f6'], 220, 0.7, 2, true);
  addShake(6);
  // 清屏冲击波：湮灭附近敌弹并重创周身敌人
  G.ebullets.length = 0;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - G.px, e.y - G.py);
    if (d < 150) damageEnemy(e, 60 * G.S.dmg, (e.x - G.px) / (d || 1), (e.y - G.py) / (d || 1), false, 2);
  }
}

function tryDash() {
  if (G.dashCd > 0) return;
  const S = G.S;
  // ⚠️ 冲刺方向**只认机头** `G.ang`：不读 WASD（按键是给转向用的），也不用鼠标的 `G.aim`
  //    （那是准星，`aimMode==='key'` 时它跟机头根本不是一个角）。
  const dx = Math.cos(G.ang), dy = Math.sin(G.ang);
  // 把旧速度投影到机头轴上、只留正向分量：横向分量会让这一下偏出机头方向，
  //    反向漂移（刚被打退 / 正在倒退）甚至能把冲刺拽成倒着飞。
  const keep = Math.max(0, G.vx * dx + G.vy * dy);
  const nv = keep + 300 * S.spd;
  G.vx = dx * nv; G.vy = dy * nv;
  // 超出 MAXV_CAP 的部分交给 `updatePlayer` 统一夹（那里才拿到 webSlow 的 slowMul）。
  G.dashT = 0.22; G.dashCd = 1.25; G.inv = Math.max(G.inv, 0.3);
  Sound.sfx.dash();
  for (let i = 0; i < 10; i++) {
    part({ x: G.px - dx * i * 2, y: G.py - dy * i * 2, vx: -dx * 40, vy: -dy * 40, life: .3, max: .3, col: '#73eff7', size: 2, drag: 4 });
  }
}

/* 伤害的条件倍率：第四批四张卡里三张在这里结算（2026-10-03）。
   抽成一个函数而不是散着写进 damageEnemy，是因为**顺序有讲究**：
   ① 孤立的判定要看「当前还有多少敌人」，必须在**任何打击把同伴打死之前**算完；
   ② 湮灭的斩杀线看的是「扣血之前」的血量比例，e.hp 一旦被扣就不是同一件事了；
   ③ 狂热（furyT）是全局时限 buff，跟目标无关。
   三条都一次性乘进去，返回单个系数 —— 伤害乘得越少的地方越好 debug。
   ⚠️ `quiet` 的范围伤害（爆炸 / 电链）只吃 fury，不吃 bind —— 见 bind 卡那段注释。 */
function enemyIsolated(e, R) {
  const R2 = R * R;
  for (const o of G.enemies) {
    if (o === e || o.hp <= 0) continue;
    const dx = o.x - e.x, dy = o.y - e.y;
    if (dx * dx + dy * dy < R2) return false;
  }
  return true;
}
function condMul(e, quiet) {
  const S = G.S;
  let m = 1;
  // 「猎手直觉」协同：孤立 × 暴击电容 → 落单的目标必定吃到暴击（见 isolate 卡）
  const alone = S.isolate > 0 && !e.boss && enemyIsolated(e, S.isoR);
  if (alone) m *= 1 + S.isoMul;
  if (alone && synOn('loneMark')) e.forceCrit = 1;
  if (S.exec > 0) {
    const line = e.boss ? S.execHp * 0.5 : S.execHp;
    if (e.hp <= e.maxHp * line) m *= S.execMul;
  }
  // 狂热：斩杀后的短时全局加成（见 killEnemy 里的挂载点）
  if (G.furyT > 0 && S.exec > 0) m *= 1 + 0.08 * S.exec;
  // 巨像的形态易伤（2026-10-11）：壳掉了就该打得动。
  //   ⚠️ 只在条件倍率里乘一次，**不写回任何字段** —— 它是在 damageEnemy 内部消费的临时量，
  //      落回实体会让续档重放把同一个易伤叠好几遍。
  if (e.vuln && e.vuln !== 1) m *= e.vuln;
  // 拘束立场：只有「非 quiet」的直接命中才有机会定住目标
  // ⚠️ 敌人身上的字段叫 **e.root**（剩余定身秒数），别和 `S.bind`（卡等级）混 —— updateEnemies 里
  //    读的是 e.root，写错成 e.bind 的话敌人永远不会被解冻，场上会出现一排活的雕像。
  if (S.bind > 0 && !quiet && !e.boss && Math.random() < S.bindP) {
    e.root = Math.max(e.root || 0, S.bindT);
    ring(e.x, e.y, e.r + 7, '#a06cf0', .28, 2);
  }
  return m;
}

// ============ 伤害 & 击杀 ============
function damageEnemy(e, dmg, dx, dy, crit, kb = 1, quiet = false) {
  if (e.hp <= 0) return;
  const c = e.cfg || {};
  // 铁壁的正面装甲：炮弹朝它机头方向飞来（dx·facing < 0）时被吃掉大部分伤害。
  // 爆炸的 dx/dy 是「从爆心指向目标」，所以绕后引爆同样能穿。
  let guarded = false;
  if (c.guard && !e.boss) {
    const dot = dx * Math.cos(e.ang) + dy * Math.sin(e.ang);
    if (dot < -0.35) { dmg *= c.guard; guarded = true; }
  }
  dmg *= condMul(e, quiet);
  // 「猎手直觉」协同（孤立 × 暴击电容）：这一刀被标记为必暴，
  // 用**一次性开关**（每次都清零）而不是一个持续 flag —— 否则目标被打上一次就永远暴击了。
  if (e.forceCrit) { crit = true; e.forceCrit = 0; }
  // 这一刀是不是落在斩杀线以下（协同「收割放牧」用）。
  // ⚠️ 必须用**扣血前**的 e.hp —— 进了 killEnemy 之后 hp 已经是 0，判不出来了。
  if (G.S.exec > 0 && e.hp <= e.maxHp * (e.boss ? G.S.execHp * 0.5 : G.S.execHp)) e.executed = 1;
  e.hp -= dmg;
  e.flash = 0.09;
  if (guarded) {
    if (!quiet && (e.guardT || 0) <= 0) {
      e.guardT = 0.35;
      const gx = e.x + Math.cos(e.ang) * e.r, gy = e.y + Math.sin(e.ang) * e.r;
      floatText(gx, gy - 6, T('float.block'), '#c0cbdc', .55);
      ring(gx, gy, 10, '#c0cbdc', .2, 1);
      Sound.sfx.shield();
    }
  } else if (!quiet && G.hitFlashN < 90) { addNum(e.x + rand(-4, 4), e.y - e.r - 2, dmg, crit); G.hitFlashN++; }
  if (kb) { e.x += dx * kb * 1.5; e.y += dy * kb * 1.5; }
  // 圣银弩箭（借薇恩「圣银弩箭」）：直接命中（非 quiet）对同一目标叠层，满 3 层结算一次
  // **真实伤害**（绕过护甲 / condMul，直接扣血），然后归零。Boss 也吃，但真伤上限夹到 25% 血，
  // 免得它变成秒巨像。quiet 的范围伤害（爆炸 / 电链）不叠层 —— 见 silver 卡那段注释。
  if (G.S.silver > 0 && !quiet && !e.boss) {
    e.silverT = 3; e.silver = (e.silver || 0) + 1;
    if (e.silver >= 3) {
      const td = Math.min(G.S.silverDmg * G.S.dmg, e.maxHp * 0.25);
      e.hp -= td; e.silver = 0;
      if (G.hitFlashN < 90) { addNum(e.x, e.y - e.r - 10, td, true); G.hitFlashN++; }
      floatText(e.x, e.y - e.r - 4, T('float.silver'), G.S.silverGold ? '#ffcd75' : '#cfe8ff', .55);
    }
  }
  // 死亡印记（借劫「死亡印记」）：直接命中给目标**记账**，计时到期引爆（见 detonateMark）。
  //    ⚠️ 只记**非 quiet 的直接命中** —— 爆炸 / 电链这类范围伤害不该偷记，
  //       否则一发高爆就能把整场都挂上账，玩家根本看不懂钱是哪来的。
  //    ⚠️ 记的是**扣完血之后的实际伤害**（已被铁壁 / condMul 处理过），
  //       所以「打在装甲上」的那部分不会算进账里 —— 这才叫「打得多爆得狠」。
  if (G.S.mark > 0 && !quiet) {
    e.markT = G.S.markT;
    e.markAcc = (e.markAcc || 0) + dmg;
  }
  // 普通命中不加凝滞（每发都冻会变幻灯片），只在暴击时给一记顿挫
  if (crit && e.hp > 0) { freeze(0.028); addShake(SHAKE.crit); }
  if (e.hp <= 0) killEnemy(e);
  else if (!quiet) Sound.sfx.hit();
}

/* 死亡印记的引爆（2026-10-09）
   把「这段时间里它挨了多少」按 markPct 结算成一次**真实伤害**（直接扣血，不吃 condMul）。
   ⚠️ 上限夹 `e.maxHp * 0.5`：不夹的话，一套爆发叠满能把巨像一击带走，
      这张卡会从「集火窗口」变成「核按钮」。
   ⚠️ 引爆**不再**走 damageEnemy —— 那会让它再次触发记账 / 圣银叠层 / 暴击判定，
      形成「引爆 → 记账 → 再引爆」的循环（见 mark 卡那段注释）。 */
function detonateMark(e) {
  const S = G.S;
  const acc = e.markAcc || 0;
  e.markAcc = 0; e.markT = 0;
  if (acc <= 0 || e.hp <= 0) return;
  const dmg = Math.min(acc * S.markPct, e.maxHp * 0.5);
  const x = e.x, y = e.y;
  ring(x, y, 24, S.markGold ? '#ffcd75' : '#c070f0', .32, 2);
  burst(x, y, 14, S.markGold ? ['#ffcd75', '#f4f4f4'] : ['#c070f0', '#f4f4f4'], 140, .45, 2, true);
  Sound.sfx.boom();
  if (G.hitFlashN < 90) { addNum(x, y - e.r - 10, dmg, true); G.hitFlashN++; }
  floatText(x, y - e.r - 4, T('float.mark'), S.markGold ? '#ffcd75' : '#c070f0', .6);
  e.hp -= dmg;
  // 「印记爆破」协同（印记 × 高爆）：引爆同时炸开一圈
  if (synOn('markBurst')) explode(x, y, 46, dmg * 0.5, true);
  if (e.hp <= 0) killEnemy(e);
}

function dropPickup(type, x, y, v = 1) {
  if (G.pickups.length > 260) return;
  // ⚠️ 掉落落在墙里 = 玩家永远够不着。回收形态是「捡够 N 份」才过段的，
  //    几份星尘卡在石头里就会把整段顶死（补撒安全阀也救不回来，因为它也往随机位置撒）。
  if (G.terr.length) {
    const p = terrPush(x, y, 6);
    if (p) { x += p.nx * p.pen; y += p.ny * p.pen; }
  }
  G.pickups.push({ type, x, y, vx: rand(-26, 26), vy: rand(-26, 26), v, life: 22, t: rand(TAU) });
}

function killEnemy(e) {
  if (e.dead) return; e.dead = true; e.hp = 0;
  G.kills++; G.waveKills++;
  G.combo = Math.min(9, G.combo + 1); G.comboT = 2.4;
  G.score += Math.round((e.xp * 10 + 5) * G.combo);
  const big = e.boss;
  burst(e.x, e.y, big ? 46 : 12, big ? ['#ffcd75', '#ef7d57', '#f4f4f4', '#c070f0'] : ['#ffcd75', '#ef7d57', '#f4f4f4'], big ? 200 : 90, big ? .9 : .45, big ? 3 : 2, true);
  ring(e.x, e.y, big ? 60 : e.r + 6, big ? '#ffcd75' : '#ef7d57', big ? .6 : .28, big ? 3 : 1);
  if (big) { Sound.sfx.bigKill(); addShake(SHAKE.bigKill); freeze(0.16); }
  else { Sound.sfx.kill(); addShake(SHAKE.kill); freeze(e.elite ? 0.08 : 0.045); }
  // 掉落星尘
  const n = big ? 12 : (e.xp >= 3 ? 3 : e.xp >= 2 ? 2 : 1);
  for (let i = 0; i < n; i++) dropPickup('dust', e.x + rand(-8, 8), e.y + rand(-8, 8), e.xp);
  if (!big && Math.random() < 0.06) dropPickup('heal', e.x, e.y);
  // 分裂
  if (e.split) {
    for (let i = 0; i < e.split; i++) {
      const a = rand(TAU);
      spawnEnemy('seeker', e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10);
    }
  }
  // 新星：死亡时炸出一圈弹幕。弹幕从 r+6 处生成，贴着打也留了一条缝。
  if (!big && e.cfg && e.cfg.deathRing) {
    const n = e.cfg.deathRing, off = rand(TAU);
    for (let i = 0; i < n; i++) {
      const a = off + i / n * TAU;
      eShot(e.x + Math.cos(a) * (e.r + 6), e.y + Math.sin(a) * (e.r + 6), a, 104, 3, HOSTILE.amber);
    }
    ring(e.x, e.y, e.r + 10, '#ffcd75', .3, 2);
    Sound.sfx.eshot();
  }
  if (e.boss) bossDeath(e);
  G.energy = Math.min(100, G.energy + (big ? 40 : 1.4));
  // 湮灭指令的「狂热」：每次斩杀刷新 3 秒。挂在最后，等同一帧的伤害结算完再给，
  // 免得「这一发把对方打死」的任务同时享受到它自己的奖励。
  if (G.S.exec > 0) {
    G.furyT = 3;
    // 「收割放牧」协同（湮灭 × 噬能）：只有**确实是斩杀线以下打死**的才额外回血 ——
    //    随手点掉一只满血杂兵不该拿这份奖励。判定标记在 damageEnemy 里、扣血之前打。
    if (synOn('harvest') && e.executed) healPlayer(G.S.maxHp * 0.03);
  }
  // 噬能回收：以战养战。按**最大**船体的百分比回血，所以它和「装甲板」是乘法关系 ——
  // 堆血同时买生存和续航。放在最后，让同一帧的击杀结算完再回。
  if (G.S.leech > 0) healPlayer(G.S.leech / 100 * G.S.maxHp * (synOn('fieldMedic') ? 1.5 : 1));
  // 杀戮狂热（借金克丝「罪恶快感」）：每次击杀刷新 3 秒狂热，期间射速与移速飙升。
  // 挂在最后，等同一帧的伤害结算完再给，免得「这一发击杀」同时享受它自己的加成。
  if (G.S.rampage > 0) G.rampageT = 3;
}

// 统一回血入口。噬能回收 / 撞击汲取 / 战地回收都走这里 —— 免得三处各写一遍浮字、封顶
// 和金色判定。返回实际回了多少，方便调用方判断要不要给音效。
// ⚠️ 不在这里判 G.dead：击杀回血发生在同帧的 killEnemy 里，玩家可能已经死了。
function healPlayer(v, silent = true) {
  const S = G.S;
  if (!(v > 0) || S.hp >= S.maxHp) return 0;
  const h = Math.min(v, S.maxHp - S.hp);
  S.hp += h;
  if (h >= 1) floatText(G.px, G.py - 14, '+' + Math.round(h), S.leechGold ? '#ffcd75' : '#a7f070', .7);
  if (!silent) Sound.sfx.heal();
  return h;
}

/* 相位折跃（搬运自 echo 的 blink）
   在「这次伤害会真正落到船体上」之前拦截一次。判定放在护盾之前 —— echo 的文案是
   「足以破盾的重击」，也就是连盾带血一起打穿的那种，所以阈值要跟**总伤害**比。
   ⚠️ 阈值以下的攻击一律不触发，否则「每发流弹都折跃」= 全程无敌，卡就废了。 */
const BLINK_MIN = 22;
function tryBlink(dmg) {
  const S = G.S;
  if (!S.blink || S.blinkT > 0 || dmg < BLINK_MIN) return false;
  S.blinkT = S.blinkCd;
  const fromX = G.px, fromY = G.py;
  // 折跃方向：沿当前朝向「向后上方」拉开，再夹回场内 —— 永远落在能继续打的位置
  const a = G.ang + Math.PI + rand(-0.6, 0.6);
  const dist = 74 + S.blink * 16;
  G.px = clamp(G.px + Math.cos(a) * dist, 16, WORLD.w - 16);
  G.py = clamp(G.py + Math.sin(a) * dist, 16, WORLD.h - 16);
  G.vx *= 0.25; G.vy *= 0.25;
  // 折跃落点在墙里 → 贴到墙这一侧的面上（直接取消太亏，穿进去更离谱）
  if (G.terr.length) terrResolvePlayer();
  G.inv = (0.8 + S.invBonus) * (synOn('blinkPhase') ? 2 : 1);
  ring(fromX, fromY, 22, S.blinkMax ? '#ffcd75' : '#c070f0', .3, 2);
  ring(G.px, G.py, 26, S.blinkMax ? '#ffcd75' : '#c070f0', .34, 2);
  burst(fromX, fromY, 16, ['#c070f0', '#f4f4f4'], 140, .45, 2, true);
  burst(G.px, G.py, 12, ['#c070f0', '#73eff7'], 110, .4, 2, true);
  Sound.sfx.blink();
  // 折跃冲击协同：起点炸开一发冲击波（借 nova 的范围与伤害公式）
  if (synOn('blinkNova')) {
    const R = 78 + (S.novaR || 0) * 0.5;
    ring(fromX, fromY, R, S.novaVoid ? '#ffcd75' : '#c070f0', .4, 3);
    for (const e of G.enemies) {
      if (e.dead || e.hp <= 0) continue;
      const d = Math.hypot(e.x - fromX, e.y - fromY);
      if (d > R + e.r) continue;
      damageEnemy(e, 24 * S.dmg, (e.x - fromX) / (d || 1), (e.y - fromY) / (d || 1), false, 3);
    }
    addShake(4);
  }
  return true;
}

/* 时间快照（时滞回溯用）：每 0.5 秒记一格位置 + 船体，只留最近 SNAP_KEEP 秒。
   ⚠️ **不要每一帧都记** —— 回溯的意义是「回到一个我记得的、几秒前的位置」，
      逐帧记录会让回溯退化成「回到上一帧」＝原地复活，机制直接废掉。
   ⚠️ 存的是**船体 S.hp**，也就是**当时的血量**；回溯时再和 25% 上限取 max（见 tryRewind）。 */
const SNAP_EVERY = 0.5, SNAP_KEEP = 5.5;
function pushSnap(dt) {
  G.snapT -= dt;
  if (G.snapT > 0) return;
  G.snapT = SNAP_EVERY;
  G.snaps.unshift({ x: G.px, y: G.py, hp: G.S.hp, t: G.t });
  while (G.snaps.length > 1 && G.snaps[0].t - G.snaps[G.snaps.length - 1].t > SNAP_KEEP) G.snaps.pop();
}
/* 时滞回溯（2026-10-03，借艾克「时空断裂」）
   致命伤到来时不结算这次伤害，把位置与船体拨回几秒前，并在落点炸一记回响。
   ⚠️ 必须在 `hurtPlayer` 把 hp 扣掉之前调用 —— 判定依赖「这一击会不会致死」，
      扣完之后就没有「原本的血」可以回了。
   ⚠️ 回到的血量是**当时血量的七成**，再夹在最大船体的 25%~60%（见下面的 clamp）——
      直接回到当时那个值（通常是满血）就变成免费回满了，这张卡会从「把这一次失误作废」
      升级成「多一条命」；反过来完全不回，玩家会在同一个位置被同一群人再打死一次。 */
function tryRewind(dmg) {
  const S = G.S;
  if (!S.rewind || G.rewindT > 0) return false;
  const want = G.t - S.rewindBack;
  let snap = null;
  for (const s of G.snaps) { if (s.t <= want) { snap = s; break; } }
  if (!snap) return false;
  G.rewindT = S.rewindCd;
  // 船体拨回去，但**不打满**：0.7 倍的当时血量，夹在最大船体的 25%~60% 之间。
  //   直接给当时的血量（常见是满血）等于免费回满 —— 这张卡会变成一条额外的命，
  //   而不是一次「把刚才那一下作废」。留一道疤，落点还是危险的地方。
  S.hp = clamp(snap.hp * 0.7, S.maxHp * 0.25, S.maxHp * 0.6);
  G.px = clamp(snap.x, 16, WORLD.w - 16); G.py = clamp(snap.y, 16, WORLD.h - 16);
  G.vx = 0; G.vy = 0;
  // ⚠️ 快照是**几秒前**的位置，而地形是每段重建的 —— 那块地方现在可能有块石头。
  //    不推出去的话玩家会被永久卡在墙里（推进往哪个方向都被推回来）。
  if (G.terr.length) terrResolvePlayer();
  // 「回溯残响」协同（时滞 × 相位外壳）：回去之后多喘一口气
  G.inv = (1.6 + S.invBonus) * (synOn('echoPhase') ? 2 : 1);
  if (G.snaps.length) G.snaps = [Object.assign({}, snap)];
  const fromX = G.px, fromY = G.py;
  ring(fromX, fromY, 46, S.rewindGold ? '#ffcd75' : '#73eff7', .5, 3);
  burst(fromX, fromY, 26, ['#73eff7', '#f4f4f4', '#a06cf0'], 190, .6, 2, true);
  Sound.sfx.warp(); addShake(5);
  banner(T('bn.rewind'), T('bn.rewindSub'), '#73eff7', 2.2);
  // 回响：落点一记范围伤害 + 清掉身边的敌弹 —— 保命的同时也把刚才那群人推开，
  //    否则它就是纯粹的「多活三秒」。
  buildGrid();
  noFreeze(() => {
    forNear(fromX, fromY, 96, e => {
      const d = Math.hypot(e.x - fromX, e.y - fromY);
      if (d > 96 + e.r) return;
      damageEnemy(e, 42 * S.dmg, (e.x - fromX) / (d || 1), (e.y - fromY) / (d || 1), false, 3);
    });
  });
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    if (Math.hypot(b.x - fromX, b.y - fromY) < 110) G.ebullets.splice(i, 1);
  }
  return true;
}
function hurtPlayer(dmg) {
  if (G.inv > 0 || G.dead || GOD) return;
  const S = G.S;
  // 相位折跃：够重的一击直接作废
  if (tryBlink(dmg)) return;
  if (S.shield > 0) {
    const a = Math.min(S.shield, dmg);
    S.shield -= a; dmg -= a;
    Sound.sfx.shield(); ring(G.px, G.py, 18, '#73eff7', .3, 2);
    if (dmg <= 0) { G.inv = 0.25; return; }
  }
  // 时滞回溯：这一击会致死 → 倒回去，这次伤害整个作废
  if (tryRewind(dmg)) return;
  S.hp -= dmg;
  G.hurtFlash = 0.35; G.inv = 0.55 + S.invBonus; G.combo = 1; G.comboT = 0;
  addShake(SHAKE.hurt); Sound.sfx.hurt(); freeze(0.07);
  buzz(22);   // 手机上受击给一下短震（桌面上恒为空操作）
  G.vign = 1;   // 受击暗角，随时间衰减
  burst(G.px, G.py, 14, ['#e04060', '#ffcd75'], 110, .5, 2, true);
  // 荆棘甲壳：把这一下**实际扣掉的血**按比例弹回周身（护盾挡掉的那部分不算 ——
  //    有盾时荆棘就该弱，否则同一份伤害吃两遍收益）。
  if (S.thorns > 0 && G.thornCd <= 0) { G.thornCd = 0.2; thornBurst(dmg); }
  if (S.hp <= 0) {
    // 无尽怒火：这一击本该致死 → 血锁 1 并进入数秒怒火（免死 + 射速 / 移速飙升）
    if (tryUndying()) return;
    // ⚠️ 怒火**仍在持续**时也必须锁 1，不能走到 die()。
    //    少了这一句，怒火期间的第二次致死伤会直接把人打死 —— 那这张卡就只剩
    //    「挡一下」而不是「这几秒你不会死」，和卡面写的不一样。
    if (G.undyingT > 0) { S.hp = 1; return; }
    S.hp = 0; die();
  }
}
/* 荆棘甲壳（借拉莫斯「尖刺防御」/「荆棘之甲」，2026-10-09）
   ⚠️ 至多弹 4 个目标：不设上限的话，一波十只杂兵贴上来时一次受击就是全场 AOE，
      它从「反击」变成「清屏」，和「脉冲核心」的定位撞车。
   ⚠️ 质变给的是**附带减速**而不是「转成护盾」—— 后者依赖 S.shieldMax，
      没装护盾卡的局里这一条会静默失效（看着像质变没生效）。 */
function thornBurst(dmg) {
  const S = G.S;
  const R = S.thornR;
  const back = dmg * S.thornPct * (synOn('thornPlate') ? 1.6 : 1);
  if (back <= 0) return;
  ring(G.px, G.py, R, S.thornGold ? '#ffcd75' : '#ef7d57', .3, 2);
  burst(G.px, G.py, 10, S.thornGold ? ['#ffcd75', '#f4f4f4'] : ['#ef7d57', '#ffcd75'], 130, .35, 2, true);
  Sound.sfx.zap();
  buildGrid();
  let n = 0;
  forNear(G.px, G.py, R, e => {
    if (e.dead || e.hp <= 0 || n >= 4) return;
    const d = Math.hypot(e.x - G.px, e.y - G.py);
    if (d > R + e.r) return;
    n++;
    damageEnemy(e, back, (e.x - G.px) / (d || 1), (e.y - G.py) / (d || 1), false, 1.5, true);
    if (S.thornGold) e.slow = Math.max(e.slow || 0, 0.35);
  });
}
/* 无尽怒火（借泰达米尔「无尽怒火」，2026-10-09）
   ⚠️ 判定必须在 `S.hp` 已经扣成负数/零**之后**、`die()` 之前 —— 它要的就是「这一击会致死」。
   ⚠️ 怒火期间血**锁 1**（updatePlayer 里每帧兜底），不是无敌：该吃的伤害照吃，
      只是不会死 —— 怒火一结束如果还站在弹幕里，那是真的会死。
   ⚠️ 冷却极长（40~28 秒，质变 18）：它是「整局只有几次」的按钮，不是常规生存卡。 */
function tryUndying() {
  const S = G.S;
  if (!S.undying || G.undyingT > 0 || G.undyingCdT > 0) return false;
  S.hp = 1;
  G.undyingT = S.undyingDur;
  G.undyingCdT = S.undyingCd;
  G.inv = 0.6;
  G.vx *= 0.3; G.vy *= 0.3;
  ring(G.px, G.py, 40, '#e04060', .45, 3);
  ring(G.px, G.py, 78, S.undyingGold ? '#ffcd75' : '#ef7d57', .6, 2);
  burst(G.px, G.py, 26, ['#e04060', '#ffcd75', '#f4f4f4'], 180, .6, 2, true);
  Sound.sfx.rage(); addShake(6); freeze(0.1);
  banner(T('bn.undying'), T('bn.undyingSub'), '#e04060', 2.4);
  return true;
}

function die() {
  G.dead = true;
  Sound.sfx.bigKill(); addShake(10);
  burst(G.px, G.py, 60, ['#ef7d57', '#ffcd75', '#f4f4f4', '#e04060'], 220, 1.1, 3, true);
  ring(G.px, G.py, 120, '#ef7d57', .8, 3);
  setTimeout(gameOver, 900);
}

function explode(x, y, R, dmg, small) {
  ring(x, y, R, '#ffcd75', small ? .22 : .38, small ? 1 : 2);
  burst(x, y, small ? 6 : 14, ['#ffcd75', '#ef7d57'], small ? 70 : 130, .4, 2, true);
  // ⚠️ 只有画面震动，**没有 freeze()**（老版本这里 freeze(0.05)）。
  //    连锁爆炸一帧能来十几次，每次都灌一次凝滞，画面就是连续的顿挫 —— 作者要的是「简单震动」。
  if (!small) Sound.sfx.boom();
  addShake(small ? SHAKE.blastSmall : SHAKE.blast);
  buildGrid();
  // 范围伤害连带的一切连击 / 连锁都不再冻画面（详见 freeze 上方那段注释）
  noFreeze(() => {
    forNear(x, y, R, e => {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > R + e.r) return;
      damageEnemy(e, dmg * (1 - d / (R + e.r) * .5), (e.x - x) / (d || 1), (e.y - y) / (d || 1), false, 1.5, small);
    });
  });
}

// ============ 敌人 ============
// ⚠️ 敌人能被推到的最远处必须**小于**子弹的回收边界（updateBullets 里的世界 ±60），
// 否则会出现「站在世界角落、子弹够不着」的不死敌人 → updateWave 的「场上清空」永远不成立。
// 踩过两次：浮游雷生成在屏外不移动；牧者一路后退被夹在 ±40 停住。
// 现在敌人硬夹在 `WORLD ± EDGE(20)`，子弹回收到 `WORLD ± 60`，中间留了 40px 余量。
const EDGE = 20;
/* ============ 敌人 / 巨像的判定倍数（视觉 = 判定） ============
   ⚠️ 必须和 sprites.js 里的 ENEMY_SPR_SCALE / BOSS_SPR_SCALE **成对改**。
      这边乘 `e.r`（判定半径），那边乘像素画。只改一边就是
      「看着打中了却没伤害」/「隔着老远就掉血」，两种都不报错。
   ⚠️ 巨像精灵按 sprites.js 的 BOSS_SPR_SCALE=3 烘焙（半宽 30）；这里的 BOSS_SCALE=1.5
      只放大**判定半径**：21/22/23 → 31.5/33/34.5，和精灵半宽 30 对得上。
      （注意 BOSS_SCALE 不参与绘制 —— 显示大小只由 BOSS_SPR_SCALE 决定，别把两者搞混。）
   ⚠️ 半径变大 = 接触伤害的判定圈也变大，难度会上去一点。
      这是用户明确要的「视觉=判定」；如果以后觉得太挤，先调这里的数，
      不要单独改 e.r 而漏掉精灵 —— 那会退化成「看得到打不到」。 */
const ENEMY_SCALE = 2, BOSS_SCALE = 1.5;
// ⚠️⚠️ 这里原来写的是 `irand(4)` —— 但 irand 是 (a, b) 两参数签名，
//   `irand(4)` 的第二参是 undefined → `rand(4, undefined + 1)` = `rand(4, NaN)` = NaN。
//   s 恒为 NaN，四个 `if (s === n)` 全部落空，**永远走最后一条 return** ——
//   也就是说整局游戏的杂兵**只从右侧一条边进场**（四个方向的设计完全没生效）。
//   不抛异常、不掉帧、没有任何报错，只是玩法悄悄少掉 3/4 的进场方向。
//   同款错误在 bagPickBoss 的洗牌里也有一份（见那里注释）。
//   以后新增 irand 调用一律写 irand(lo, hi)。
//
// 入场点按**视口**四条边算，不是世界四条边 —— 世界大了 3 倍之后，
// 从世界边缘生成意味着敌人在一两千像素外，玩家要等它飞很久、而且它一开始完全看不见。
// 「从屏幕外走进来」才是这套弹幕该有的读图节奏。
function spawnPos() {
  const s = irand(0, 3), m = EDGE;
  const L = viewL(), T = viewT();
  if (s === 0) return [L + rand(W), T - m];
  if (s === 1) return [L + rand(W), T + H + m];
  if (s === 2) return [L - m, T + rand(H)];
  return [L + W + m, T + rand(H)];
}
function hpScale() {
  // 随航程线性变硬：第 1 段 1.0，第 12 段约 2.2。
  // ⚠️ 线性部分在 WAVES 封顶 —— 无尽里的成长交给 eTierHp 的指数曲线，
  //    两条曲线叠乘会让中后期血量彻底失控（见文件上方 ENDLESS_* 注释）。
  const w = Math.min(G.wave, WAVES);
  return (1 + (w - 1) * 0.11) * eTierHp(G.wave);
}
function spawnEnemy(type, x, y, opt = {}) {
  const c = ETYPES[type];
  if (!c) return null;
  if (x === undefined) { const p = spawnPos(); x = p[0]; y = p[1]; }
  // ⚠️ 浮游雷自己不动，所以绝对不能生成在屏外：
  // spawnPos() 一律给屏外 20px，而玩家被夹在视口内 → 最近也有 36px，
  // 触发不了 d<34 的自爆；子弹又在世界 ±60 才回收 → 这颗雷谁也打不到，
  // updateWave 的「场上清空」永远不成立 → **整段航程卡死**（实测卡了 700 秒）。
  // 所以夹进**视口**（不是世界）—— 世界大了之后，「夹进世界」等于没夹。
  if (c.ai === 'mine') {
    x = clamp(x, viewL() + 14, viewR() - 14);
    y = clamp(y, viewT() + 14, viewB() - 14);
  }
  const hp = c.hp * hpScale() * (opt.hpMul || 1);
  const e = {
    type, cfg: c, x, y, vx: 0, vy: 0, hp, maxHp: hp, r: c.r * ENEMY_SCALE,
    // ⚠️ xp 必须在这里落到敌人身上。killEnemy 里有三处读 e.xp：
    //   加分（`(e.xp * 10 + 5) * combo`）、掉落颗数分档（`>= 3 / >= 2`）、以及每颗星尘的面值。
    //   漏了这一个字段，三处全部吃到 undefined —— 症状是 HUD 右上角「分数 NaN」常驻，
    //   而且硬敌和杂兵掉的星尘一样多（永远走 `n = 1` 那一档），整局经验收入被砍掉一半。
    //   ⚠️ 它不会抛异常、不会白屏，只是数字悄悄变成 NaN —— 靠肉眼看画面才抓得到。
    xp: c.xp,
    // ⚠️ 接触伤害 / 移动速度都**落到敌人自己身上**，不要在 updateEnemy 里现算：
    //    那儿只有 `e.cfg`（静态表），拿不到「这只怪是哪一段生成的」这个信息。
    //    无尽档位一开，同一张 cfg 在不同段数下必须是不同数值。
    dmg: c.dmg * eTierDmg(G.wave),
    spdMul: eTierSpd(G.wave),
    t: rand(TAU), flash: 0, cd: rand(0.4, c.cd || 1.5), touchCd: 0,
    split: opt.split !== undefined ? opt.split : c.split,
    alpha: 1, st: 0, ang: 0, elite: !!opt.elite,
  };
  // 精英：更硬 + 判定圈再大一圈（+1 是 1x 时代的写法，跟着 ENEMY_SCALE 一起放大）
  if (e.elite) { e.hp *= 1.8; e.maxHp *= 1.8; e.r += ENEMY_SCALE; }
  G.enemies.push(e);
  markSeen(type);        // 图鉴：这只算「遭遇过」
  return e;
}
function spawnBoss(id) {
  const b = BOSSES[id]; if (!b) return;
  markSeen(id);          // 图鉴：巨像名录
  // 巨像血量 = 基准血 × **槽位倍率** × 深渊档位倍率。
  // ⚠️ 槽位倍率替代了原来那个「(1 + (wave-4)*0.05)」的线性项 —— 巨像现在会轮换进
  //    4/8/12 三个槽位，血厚必须跟着**槽位**走，而不是跟着「这只巨像原本排第几」。
  //    （基准 900 × {4:1, 8:2.2, 12:4} 正好复现老数值，见 BOSS_SLOT_MUL 的注释。）
  // 无尽里巨像会重复出场（轮换袋），所以它必须真的跟着档位变硬，否则第 3 轮就是纸糊的。
  const hp = b.hp * bossSlotMul(G.wave) * eTierHp(G.wave);
  const e = {
    type: 'boss', boss: id, name: b.name, en: b.en, spr: b.spr, spr0: b.spr, color: b.color,
    // 巨像从**视口正上方**入场、悬停在视口上半区（相机锁在玩家身上，所以它永远在玩家眼前）。
    // 世界大了 3 倍之后如果还按世界中心算，玩家在世界边缘打的时候巨像会在屏幕外。
    x: cam.x, y: viewT() - 40, vx: 0, vy: 0, hp, maxHp: hp, r: b.r * BOSS_SCALE,
    // 巨像固定掉 12 颗星尘（killEnemy 的 big 分支），每颗 6 点 → 一只巨像约一级。
    // 同样必须显式给，否则又是 undefined → NaN。
    xp: 6,
    t: 0, flash: 0, cd: 1.6, touchCd: 0, alpha: 1, st: 0, ang: Math.PI / 2,
    // form = 当前形态下标（0/1/2）。pats / cd / spd 全部**从 form 里读**，
    //   不在实体上另存副本 —— 存在副本的话，切形态那一刻忘了同步副本就是「变了但又没变」。
    forms: b.forms, form: 0, patI: 0,
    // enraged 保留给 HUD 血条 / 旧逻辑当布尔用（= form > 0）
    phase: 1, enraged: false, entering: true,
    vuln: 1, cmp: 0,   // vuln：本体易伤倍率（形态给）；cmp：形态过渡期的镜头/演出计时
  };
  G.enemies.push(e);
  G.boss = e; G.bossRef = b;
  banner(name1(b), sub1(b), b.color, 3);
  Sound.sfx.warn();
  Sound.setMode('boss');
}

// 当前形态配置。实体上**不存副本**（pats/cd/spd 全在这里读），避免「切了形态忘了同步」。
function bossForm(e) { return e.forms[e.form] || e.forms[0]; }

function bossFire(e, dx, dy) {
  const R = Math.hypot(dx, dy) || 1; dx /= R; dy /= R;
  const F = bossForm(e);
  const pat = F.pats[e.patI % F.pats.length];
  // 主线 +3/段，到 WAVES 封顶；无尽里交给档位速度倍率（它自己也有 1.5 的上限）
  const spd = (92 + Math.min(G.wave, WAVES) * 3) * eTierSpd(G.wave);
  const fast = F.spd || 1;   // 形态的机动倍率同时抬弹速：三形态不只是「更密」，是「更快」
  if (pat === 'charge') {
    e.vx += dx * 260; e.vy += dy * 260;
    Sound.sfx.dash();
  } else if (pat === 'spread') {
    const base = Math.atan2(dy, dx);
    for (let i = -3; i <= 3; i++) eShot(e.x, e.y, base + i * 0.19, spd * fast, 3, HOSTILE.purple);
    Sound.sfx.eshot();
  } else if (pat === 'ring') {
    const n = 18, off = rand(TAU);
    for (let i = 0; i < n; i++) eShot(e.x, e.y, off + i / n * TAU, spd * 0.85 * fast, 3, HOSTILE.pink);
    Sound.sfx.eshot();
  } else if (pat === 'spiral') {
    e.spiralA = (e.spiralA || 0) + 0.42;
    for (let i = 0; i < 3; i++) eShot(e.x, e.y, e.spiralA + i / 3 * TAU, spd * 0.9 * fast, 3, HOSTILE.red);
  } else if (pat === 'fan') {
    const base = Math.atan2(dy, dx);
    for (let i = -5; i <= 5; i++) eShot(e.x, e.y, base + i * 0.13, spd * 1.1 * fast, 3, HOSTILE.red);
    Sound.sfx.eshot();
  } else if (pat === 'laser') {
    const base = Math.atan2(dy, dx);
    G.fx.push({ type: 'laser', x: e.x, y: e.y, ang: base, t: 0, life: 1.4, len: 460, w: 7, color: e.color });
    Sound.sfx.laser(); addShake(4);
  // ---- 第二批巨像的四个新机制（2026-10-03）----
  } else if (pat === 'summon') {
    // 蜂巢：产兵。⚠️ 必须有数量上限 —— 它每 1.9 秒就来一次，不封顶的话
    //   玩家一旦决定先躲不先打，场上会在十几秒内堆到上百只，直接卡死。
    const n = e.form >= 1 ? 4 : 2;
    for (let i = 0; i < n && G.enemies.length < 34; i++) {
      spawnEnemy('reaver', e.x + rand(-26, 26), e.y + rand(-18, 18));
    }
    ring(e.x, e.y, 44, '#a7f070', 0.45, 2);
    Sound.sfx.dust();
  } else if (pat === 'pull') {
    // 磁暴：一次强引力脉冲（持续的那部分在 updateBoss 里，这里是「突然一顿拽」）。
    // ⚠️ 方向是**从玩家指向核心**（dx,dy 已经是 player - boss，所以取负）。
    const PULSE = 210;
    G.vx -= dx * PULSE; G.vy -= dy * PULSE;
    ring(e.x, e.y, 150, '#41a6f6', 0.5, 2);
    Sound.sfx.zap(); addShake(3);
  } else if (pat === 'burn') {
    // 锻炉：在自己脚下 + 身后喷火（身后那一片才是「别往它去过的地方飞」的由来）
    addFire(e.x, e.y, 30);
    addFire(e.x - Math.cos(e.ang) * 22, e.y - Math.sin(e.ang) * 22, 26);
    ring(e.x, e.y, 34, '#ef7d57', 0.35, 2);
    Sound.sfx.dust();
  } else if (pat === 'beamFan') {
    // 棱镜：分光激光扇。⚠️ 6 道**、间隔 0.3rad** 是刻意的 ——
    //   在 150px 处两道之间约 45px，玩家船（约 30px 宽）钻得过去但很挤，
    //   这就是「贴着缝站」的手感来源。间距再小就变成必挨一发，就不是弹幕是处刑了。
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < 6; i++) {
      G.fx.push({ type: 'laser', x: e.x, y: e.y, ang: base + (i - 2.5) * 0.3, t: 0, life: 1.4, len: 460, w: 6, color: e.color });
    }
    Sound.sfx.laser(); addShake(4);
  // ---- 第三批（2026-10-11）：三形态系统带来的四套新弹幕 ----
  } else if (pat === 'blackout') {
    // 星蚀：熄灭战场。⚠️ 这是全场**唯一一个改变「你能看见多少」的技能**，
    //   所以它必须有明确的预警（收缩的日冕环）+ 明确的出口（esp Towards boss 那圈始终亮着）。
    //   持续时长随形态走（esoMul），全蚀时几乎占了整个开火循环的一半。
    const dur = 2.2 * (F.esoMul || 1);
    G.blackout = dur; G.blackoutMax = dur;
    ring(e.x, e.y, 60, '#ffcd75', .5, 2);
    ring(e.x, e.y, 200, '#b13e53', .7, 2);
    Sound.sfx.warp(); addShake(3);
  } else if (pat === 'crossLaser') {
    // 狱卒/之门/星蚀：四道成十字的**缓慢自转**激光。
    //   ⚠️ 转是刻意的：静态十字只要站在一个象限就永远安全，转起来才有人味。
    //   ⚠️ 预警段 (0.5s) 里也要跟着转，否则玩家按预警线的方向站位、开火时却已经转开了。
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < 4; i++) {
      G.fx.push({ type: 'laser', x: e.x, y: e.y, ang: base + i * Math.PI / 2,
                  t: 0, life: 1.6, len: 460, w: 6, color: e.color, spin: 0.55, host: true });
    }
    Sound.sfx.laser(); addShake(4);
  } else if (pat === 'webbing') {
    // 网缚：在你**可能要去的地方**（你和 boss 之间）撒减速网，压缩走位而不是直接扣血。
    //   ⚠️ 撒在自己脚下没意义 —— 目的从来是「让你换路的时候付出代价」。
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      addWeb(e.x - dx * R * t + rand(-26, 26), e.y - dy * R * t + rand(-26, 26));
    }
    ring(e.x, e.y, 40, '#c070f0', .4, 2);
    Sound.sfx.dust();
  } else if (pat === 'homing') {
    // 追命弹：慢但会拐的重弹。转向率刻意压低 —— 它是「必须主动绕开」而不是
    //   「永远躲不掉」：直线拉开一段就能把它甩掉，被它咬住是因为你一直在绕圈。
    const off = rand(TAU);
    for (let i = 0; i < 3; i++) {
      eShot(e.x, e.y, off + i / 3 * TAU, spd * 0.55, 4, HOSTILE.amber, { homing: 0.9 });
    }
    Sound.sfx.eshot();
  }
}

function updateBoss(e, dt, dx, dy, d) {
  e.t += dt;
  if (e.entering) {
    e.y += 40 * dt;
    if (e.y > viewT() + 62) { e.entering = false; e.vy = 0; }
    return;
  }
  // --- 形态推进：找最高一档「血量已经跌破它的阈值」的形态 ---
  //    从后往前扫，命中就停 —— 玩家一发大伤害跨过两档时应该直接落到最后一档，
  //    而不是「先演一遍阶段二、再演阶段三」（那会把一次精彩的爆发切成两段过场）。
  let want = e.form;
  for (let i = e.forms.length - 1; i > e.form; i--) {
    if (e.hp < e.maxHp * e.forms[i].p) { want = i; break; }
  }
  if (want > e.form) bossShiftForm(e, want);
  const F = bossForm(e);

  // 形态过渡演出期间不开火、不结算接触伤害：这段时间玩家要做的是「看清它变成什么样了」，
  // 不是被一套连招秒掉。1.1 秒是刻意压到「刚好看清换皮」的长度。
  if (e.cmpT > 0) { e.cmpT -= dt; updatePhantoms(dt); return; }

  // 悬停机动：绕**视口**中心做 8 字（不是世界中心 —— 那样玩家跑到世界另一头就打不着它了），
  // 形态越后越逼近。
  const mv = F.spd || 1;
  const tx = cam.x + Math.cos(e.t * 0.55) * 128;
  const ty = viewT() + 78 + Math.sin(e.t * 1.1) * 34 - (e.form >= 1 ? 20 : 0);
  e.vx += (tx - e.x) * 1.4 * dt * mv;
  e.vy += (ty - e.y) * 1.4 * dt * mv;
  e.vx *= 0.97; e.vy *= 0.97;
  e.x = clamp(e.x + e.vx * dt, e.r, WORLD.w - e.r);
  e.y = clamp(e.y + e.vy * dt, e.r, WORLD.h - e.r);
  e.ang = Math.atan2(dy, dx);
  // 巨像**不受地形阻挡**（它的机动是绕视口中心的 8 字，被墙改道就变成抽搐），
  // 但碾过去时会把挡路的可破坏岩撞碎 —— 骨架墙它直接穿过。
  if (G.terr.length) terrCrush(e);

  // --- 形态的场地效果（aura）---
  //    ⚠️ aura 有两种，别混：
  //       'pull' / 'push' 是**施加在玩家身上的**，在 fieldDrift() 里以位移形式结算
  //         —— 放在这里改成加速度会被 updatePlayer 的线性刹车整帧吃掉（见 fieldDrift 注释）。
  //       'fire' / 'firestorm' 是**巨像自己的行为**（路过留火），属于这一侧。
  if (F.aura === 'fire' || F.aura === 'firestorm') {
    // 锻炉：路过留火。firestorm 是「一路烧过去」—— 间隔更短、灼面更大，
    //       它走过的走廊会真的封死，而不是「踩一下会疼」。
    e.fireT = (e.fireT || 0) - dt;
    const iv = F.aura === 'firestorm' ? 0.22 : 0.55;
    if (e.fireT <= 0 && Math.hypot(e.vx, e.vy) > 30) {
      e.fireT = iv;
      addFire(e.x - Math.cos(e.ang) * 18, e.y - Math.sin(e.ang) * 18,
              F.aura === 'firestorm' ? 30 : 22);
    }
  }
  updatePhantoms(dt);

  e.cd -= dt;
  if (e.cd <= 0) {
    bossFire(e, dx, dy);
    e.patI++;
    e.cd = F.cd + rand(0.3);
    // 蜂巢·破裂：巢破了就不再「主动产兵」，改成每个 tick 都在从破口漏。
    //   ⚠️ 和 summon 的区别是它在**每一发之外**额外漏，所以看着像淌而不是吐。
    if (F.leaks && G.enemies.length < 30) spawnEnemy('reaver', e.x + rand(-22, 22), e.y + rand(-14, 14));
  }
  // 首次进入第二形态时撒一波小怪（保留老行为，玩家已经习惯这个节奏）
  if (e.form >= 1 && !e.spawnedAdds) {
    e.spawnedAdds = true;
    for (let i = 0; i < 4; i++) spawnEnemy('reaver', e.x + rand(-30, 30), e.y + rand(-20, 20));
  }
}

/* 切换形态（2026-10-11）
   ⚠️ 三个动作必须**同时**发生，缺任何一个玩家都读不出「它变了」：
      ① 换模型（spr → spr_x）   ② 清屏敌弹（给出喘息，也划开两个回合）
      ③ banner + 一圈碎裂演出
   只做 ① 的话，玩家在专心躲弹幕的时候根本不会注意到模型换了。 */
function bossShiftForm(e, fi) {
  const F = e.forms[fi];
  e.form = fi; e.phase = fi + 1; e.enraged = true;
  e.patI = 0; e.cd = 1.0; e.cmpT = 1.1;
  e.vuln = F.vuln || 1;
  if (F.x) e.spr = (e.spr0 || e.spr) + '_x';
  // 清本金場的敌弹：每一发都化成一小撮灰 —— 直接 splice 会显得「弹幕被偷走了」
  for (const b of G.ebullets) burst(b.x, b.y, 3, ['#f4f4f4', e.color], 60, .3, 1);
  G.ebullets.length = 0;
  ring(e.x, e.y, 56, e.color, .6, 3);
  ring(e.x, e.y, 116, '#f4f4f4', .5, 2);
  burst(e.x, e.y, 30, ['#f4f4f4', e.color, '#ffcd75'], 190, .7, 3, true);
  addShake(8); Sound.sfx.warn(); Sound.sfx.bigKill(); freeze(0.06);
  // 形态名随界面语言走（和 name1 同一条规则：英文模式显示英文，否则显示中文）
  banner(T('bn.bossForm'), T('bn.bossFormSub', bossName(e), (isEn() && F.labelEn) ? F.labelEn : (F.label || '')), e.color, 2.4);
  if (F.turrets) for (let i = 0; i < F.turrets; i++) spawnBossTurret(e, i, F.turrets);
  if (F.phantoms) spawnBossPhantoms(e, F.phantoms);
}

/* 狱卒·展开架的炮塔：**可击破**，打掉就少一路火力 —— 这是给玩家的新决策：
   顶着九路输出强拆本体，还是先花几秒拆掉两座塔换一个舒服的输出环境。
   ⚠️ 用已有的敌型 'bastion'（几乎不动、火力极密）当壳子，不新增敌型：
      它的 AI 已经是「站着的那应该是炮台」，改最少的代码拿到「能被打的东西」。
   ⚠️ 必须打 turret 标记：它是**巨像的一部分**，本体死后要跟着走，不能留在场上刷经验。 */
function spawnBossTurret(e, i, n) {
  const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.9;
  const t = spawnEnemy('bastion', e.x + Math.cos(a) * 62, e.y + Math.sin(a) * 62);
  if (!t) return null;
  t.turret = 1; t.maxHp = t.hp = 130 * hpScale();
  ring(t.x, t.y, 20, e.color, .4, 2);
  return t;
}
/* 棱镜·裂相的幻影：**不是敌人**（不进 G.enemies，打不死也不掉东西）——
   它只是绕着本体转的一件武器。做成敌人的话，玩家会去打它、发现打不动、
   以为是 bug —— 那种挫败感没换来任何有趣的决策。 */
function spawnBossPhantoms(e, n) {
  for (let i = 0; i < n; i++) {
    G.phantoms.push({ i, a: i / n * TAU, dist: 74, cd: 1.2 + i * 0.4, x: e.x, y: e.y, spr: e.spr0 || e.spr });
  }
  Sound.sfx.warp();
}
function updatePhantoms(dt) {
  if (!G.phantoms.length) return;
  const boss = G.boss;
  for (const p of G.phantoms) {
    p.a += dt * 0.85;
    if (boss) {
      p.x = boss.x + Math.cos(p.a) * p.dist;
      p.y = boss.y + Math.sin(p.a) * p.dist;
    }
    p.cd -= dt;
    if (p.cd <= 0 && boss && !G.dead) {
      p.cd = 1.5;
      const a = Math.atan2(G.py - p.y, G.px - p.x);
      eShot(p.x, p.y, a, 150, 4, boss.color);
      Sound.sfx.eshot();
    }
  }
}

function bossDeath(e) {
  G.boss = null; G.bossRef = null;
  // 本体没了，它带出来的一切都要跟着走：幻影、熄灭、**还有它架的炮塔**。
  //   炮塔是可击破的独立敌人，不清的话本段会卡在「还有活着的敌人」永远不结束 ——
  //   那种 bug 看起来像游戏卡住，但控制台一行错都没有。
  //   ⚠️ 这里**不**走 killEnemy：那条路会计 kill / 连击 / 掉落，玩家白拿一轮奖励，
  //      而且会长出一堆本该属于boss的星尘。塔就是关掉了，不是被打掉的。
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const t = G.enemies[i];
    if (!t.turret) continue;
    burst(t.x, t.y, 12, ['#ff5577', '#f4f4f4'], 100, .4, 2);
    ring(t.x, t.y, 22, t.color, .3, 2);
    G.enemies.splice(i, 1);
  }
  G.phantoms.length = 0; G.blackout = 0;
  Sound.setMode('cruise');
  addShake(11);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      if (!G || G.dead) return;
      explode(e.x + rand(-30, 30), e.y + rand(-20, 20), 34, 30, true);
    }, i * 140);
  }
  for (let i = 0; i < 10; i++) dropPickup('dust', e.x + rand(-24, 24), e.y + rand(-18, 18), 3);
  dropPickup('heal', e.x, e.y);
  banner(T('bn.bossDead'), bossName(e), '#ffcd75', 2.4);
}

// ============ 敌人 AI ============
function updateEnemies(dt) {
  buildGrid();
  const px = G.px, py = G.py;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.touchCd > 0) e.touchCd -= dt;
    if (e.guardT > 0) e.guardT -= dt;
    if (e.buffT > 0) e.buffT -= dt;
    if (e.pulse > 0) e.pulse -= dt;
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const c = e.cfg || {};
    if (e.boss) { updateBoss(e, dt, dx, dy, d); continue; }
    // 拘束立场（2026-10-03）：被定住的敌人整个 AI 时钟都停 ——
    //   位置几乎不动，攻击计时（cd）与循环计时（st，用来算铺网 / 放牧脉冲的间隔）一起冻结。
    //   ⚠️ 冻结用「先前进再回滚」而不是跳过整段：`e.cd -= dt` 写在 case 内部，
    //      分支很多，改成逐个判 ```stunned``` 会把这个文件改坏。
    const stunned = e.root > 0 && !e.boss;
    if (stunned) { e.root -= dt; e.vx *= 0.82; e.vy *= 0.82; }
    // 圣银弩箭：印记 3 秒不补刀就清空（连续命中才有意义，否则平 A 也能触发）
    if (e.silverT > 0) { e.silverT -= dt; if (e.silverT <= 0) e.silver = 0; }
    // 死亡印记：倒计时在这里走（**在 boss 的 continue 之前**，巨像也吃这一套）
    if (e.markT > 0) { e.markT -= dt; if (e.markT <= 0) detonateMark(e); }
    // 静止场的减速由 updateAbilities 每帧挂上，这里用完就衰减，出圈立刻恢复
    // spdMul 是生成时按深渊档位定死的（见 spawnEnemy），这里只乘上去
    const spd = stunned ? 0
      : c.spd * (e.spdMul || 1) * (e.elite ? 1.15 : 1) * (1 - (e.slow || 0)) * (e.buffT > 0 ? 1.22 : 1);
    if (e.slow) e.slow = Math.max(0, e.slow - dt * 2.2);

    switch (c.ai) {
      case 'chase':
        e.vx += ux * spd * 4 * dt; e.vy += uy * spd * 4 * dt;
        e.ang = Math.atan2(dy, dx);
        break;
      case 'wander': {
        // 摆尾游动，越游越快
        e.st += dt;
        const wob = Math.sin(e.t * 9) * 0.9;
        const a = Math.atan2(dy, dx) + wob;
        const acc = spd * (1 + Math.min(1.4, e.st * 0.3)) * 3 * dt;
        e.vx += Math.cos(a) * acc; e.vy += Math.sin(a) * acc;
        e.ang = Math.atan2(e.vy, e.vx);
        break;
      }
      case 'dash': {
        // 蓄力 -> 高速冲刺 -> 减速
        e.st += dt;
        if (e.st < 0.9) {
          e.vx *= 0.94; e.vy *= 0.94;
          e.ang = Math.atan2(dy, dx);
          e.charging = true;
        } else if (e.st < 1.5) {
          if (e.charging) { e.charging = false; e.vx = ux * spd * 3.1; e.vy = uy * spd * 3.1; Sound.sfx.dash(); }
        } else { e.st = 0; e.vx *= 0.5; e.vy *= 0.5; }
        break;
      }
      case 'swarm': {
        // 蜂群：追 + 互相分离
        let sx = 0, sy = 0;
        forNear(e.x, e.y, 26, o => {
          if (o === e) return;
          const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy) || 1;
          if (od < 24) { sx += ox / od; sy += oy / od; }
        });
        e.vx += (ux * spd * 3.4 + sx * 40) * dt; e.vy += (uy * spd * 3.4 + sy * 40) * dt;
        e.ang = Math.atan2(dy, dx);
        break;
      }
      case 'shoot': {
        // 保持中距，点射
        const want = c.range * 0.62;
        const dir = d > want ? 1 : -1;
        e.vx += ux * spd * 2.4 * dt * dir; e.vy += uy * spd * 2.4 * dt * dir;
        e.ang = Math.atan2(dy, dx);
        e.cd -= dt;
        if (e.cd <= 0 && d < c.range) {
          e.cd = c.cd + rand(0.6);
          eShot(e.x, e.y, Math.atan2(dy, dx), 150, 3, HOSTILE.purple);
          Sound.sfx.eshot();
        }
        break;
      }
      case 'turret': {
        e.vx += ux * spd * 2 * dt; e.vy += uy * spd * 2 * dt;
        e.ang = Math.atan2(dy, dx);
        e.cd -= dt;
        if (e.cd <= 0 && d < c.range) {
          e.cd = c.cd + rand(0.8);
          const base = Math.atan2(dy, dx);
          for (let i = -2; i <= 2; i++) eShot(e.x, e.y, base + i * 0.16, 118, 3, HOSTILE.red);
          Sound.sfx.eshot();
        }
        break;
      }
      case 'orbit': {
        // 绕玩家圆周机动 + 点射
        e.orbA = (e.orbA === undefined ? Math.atan2(-dy, -dx) : e.orbA) + dt * 1.15;
        const want = 92;
        const tx = px + Math.cos(e.orbA) * want, ty = py + Math.sin(e.orbA) * want;
        e.vx += (tx - e.x) * 4 * dt; e.vy += (ty - e.y) * 4 * dt;
        e.ang = Math.atan2(dy, dx);
        e.cd -= dt;
        if (e.cd <= 0 && d < c.range) {
          e.cd = c.cd + rand(0.5);
          eShot(e.x, e.y, Math.atan2(dy, dx), 165, 3, HOSTILE.pink);
          Sound.sfx.eshot();
        }
        break;
      }
      case 'blink': {
        e.vx += ux * spd * 2.6 * dt; e.vy += uy * spd * 2.6 * dt;
        e.ang = Math.atan2(dy, dx);
        e.st += dt;
        if (e.st > 2.6) {
          e.st = 0;
          const a = rand(TAU), r = rand(46, 74);
          burst(e.x, e.y, 8, ['#c070f0'], 70, .3, 2);
          e.x = clamp(px + Math.cos(a) * r, 10, WORLD.w - 10);
          e.y = clamp(py + Math.sin(a) * r, 10, WORLD.h - 10);
          burst(e.x, e.y, 8, ['#c070f0'], 70, .3, 2);
          Sound.sfx.zap();
        }
        break;
      }
      case 'stalk': {
        // 光学迷彩潜近，显形后突刺
        e.st += dt;
        if (e.st < 2.2) {
          e.alpha = 0.22 + Math.sin(e.t * 3) * 0.05;
          e.vx += ux * spd * 2.2 * dt; e.vy += uy * spd * 2.2 * dt;
        } else if (e.st < 2.6) {
          e.alpha = 1;
          if (!e.lunged) { e.lunged = true; e.vx = ux * spd * 3.4; e.vy = uy * spd * 3.4; Sound.sfx.dash(); }
        } else { e.st = 0; e.lunged = false; e.alpha = 0.22; }
        e.ang = Math.atan2(dy, dx);
        break;
      }
      case 'mine': {
        // 缓慢往**视口**里漂：万一被推到屏幕外也能自己回来（见 spawnEnemy 里的说明）。
        // ⚠️ 这里锚的是视口不是世界 —— 世界大了 3 倍之后，「夹进世界」等于没夹，
        //    雷会留在玩家看不见的地方，这一波就永远清不完。
        //    注意它只在**已经出画面**的时候才被推（clamp 到视口内缩 26），
        //    画面里的雷一动不动 —— 所以「完全静止」这个设定没被破坏。
        const inx = clamp(e.x, viewL() + 26, viewR() - 26), iny = clamp(e.y, viewT() + 26, viewB() - 26);
        e.vx += (inx - e.x) * 1.6 * dt; e.vy += (iny - e.y) * 1.6 * dt;
        e.vx *= 0.9; e.vy *= 0.9;
        e.ang = e.t * 0.6;
        if (d < 34) {
          explode(e.x, e.y, 40, 26, false);
          e.hp = 0; killEnemy(e);
        }
        break;
      }
      case 'leech': {
        e.vx += ux * spd * 3.6 * dt; e.vy += uy * spd * 3.6 * dt;
        e.ang = Math.atan2(dy, dx);
        e.st -= dt;
        if (d < e.r + 12 && e.st <= 0) {
          e.st = 0.85;
          hurtPlayer(e.dmg);
          floatText(G.px, G.py - 16, '-' + Math.round(e.dmg), '#ff5577', .7);
          // 吸血：回自己血
          e.hp = Math.min(e.maxHp, e.hp + 6);
        }
        break;
      }
      case 'weave': {
        // 中距绕圈 + 往你前进方向的前方铺网，逼你改道
        const dir = d > c.range ? 1 : -1;
        e.vx += (ux * spd * 2.2 * dir - uy * spd * 1.7) * dt;
        e.vy += (uy * spd * 2.2 * dir + ux * spd * 1.7) * dt;
        e.ang = Math.atan2(dy, dx);
        e.cd -= dt;
        if (e.cd <= 0 && d < c.range * 2.6) {
          e.cd = c.cd + rand(0.9);
          addWeb(G.px + Math.cos(G.aim) * 34 + rand(-18, 18),
                 G.py + Math.sin(G.aim) * 34 + rand(-18, 18));
          burst(e.x, e.y, 5, ['#c070f0'], 60, .3, 1);
        }
        break;
      }
      case 'shepherd': {
        // 躲远 + 侧向漂移，定期给周围敌人灌血。不打死它，这一波就永远清不完。
        const dir = d > c.range ? 1 : -1;
        e.vx += (ux * spd * 2.0 * dir - uy * spd * 1.0) * dt;
        e.vy += (uy * spd * 2.0 * dir + ux * spd * 1.0) * dt;
        e.ang = Math.atan2(dy, dx);
        e.st += dt;
        if (e.st > c.cd) {
          e.st = 0; e.pulse = 0.55;
          let fed = 0;
          forNear(e.x, e.y, c.aura, o => {
            if (o === e || o.hp <= 0 || o.hp >= o.maxHp) return;
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.09);
            o.buffT = 1.3; fed++;
          });
          if (fed) { ring(e.x, e.y, c.aura, '#a7f070', .45, 1); Sound.sfx.heal(); }
        }
        break;
      }
      case 'guard': {
        // 慢速推进，机头**缓慢**转向你 —— 所以侧后方是真的绕得过去，不是纸面机制
        const want = Math.atan2(dy, dx);
        let gd = ((want - e.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
        e.ang += clamp(gd, -(c.turn || 1.5) * dt, (c.turn || 1.5) * dt);
        e.vx += ux * spd * 3 * dt; e.vy += uy * spd * 3 * dt;
        e.cd -= dt;
        if (e.cd <= 0 && d < c.range) {
          e.cd = c.cd + rand(1.2);
          const base = Math.atan2(dy, dx);
          for (let i = -1; i <= 1; i++) eShot(e.x, e.y, base + i * 0.22, 96, 4, HOSTILE.red);
          Sound.sfx.eshot();
        }
        break;
      }
    }
    // 远程单位（靠 c.range 保持距离的：炮手 / 重甲炮台 / 环轨炮 / 织网者 / 牧者）
    // 统一加一层软性收容：贴边就往回走。
    // 只靠硬夹边不够 —— 它们会一路后退停在边上，玩家够不着，这一波就清不完。
    // ⚠️ 收容的是**视口**边，不是世界边：世界大了 3 倍之后按世界边收容等于没收，
    //    它们会退到屏幕外一路放冷枪，玩家既看不见也打不着。
    //    这是一记**软**推力（加速度），所以相机移动不会把敌人硬拖走，只是轻轻把它们拢回画面里。
    if (c.range && !e.boss) {
      const IN = 44, k = spd * 3.2 * dt;
      if (e.x < viewL() + IN) e.vx += k;
      if (e.x > viewR() - IN) e.vx -= k;
      if (e.y < viewT() + IN) e.vy += k;
      if (e.y > viewB() - IN) e.vy -= k;
    }
    // 阻尼 & 限速（冲锋态允许超速）
    // ⚠️ 拘束时要把刚才各 case 里扣掉的攻击计时还回去，否则它看起来是「停住」，
    //    实际冷却还在走 —— 解禁瞬间立刻打出一颗蓄了很久的子弹。
    //    ⚠️ st 的回滚要夹到 0：不是每种 AI 都用了 e.st（chase / swarm 就没有），
    //       减成负数会让 dash 那个 AI 解禁后卡在「一直在蓄力」的分支里。
    if (stunned) { e.cd += dt; e.st = Math.max(0, e.st - dt); }
    const damp = c.ai === 'dash' && e.st >= 0.9 && e.st < 1.5 ? 0.995 : 0.94;
    e.vx *= damp; e.vy *= damp;
    const maxV = spd * (c.ai === 'dash' ? 3.4 : 1.5);
    const vm = Math.hypot(e.vx, e.vy);
    if (vm > maxV) { e.vx = e.vx / vm * maxV; e.vy = e.vy / vm * maxV; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    // 边界：允许贴在世界边外一点点，但绝不允许超出子弹够得着的范围（见 EDGE 的说明）
    if (e.x < -EDGE) e.x = -EDGE; if (e.x > WORLD.w + EDGE) e.x = WORLD.w + EDGE;
    if (e.y < -EDGE) e.y = -EDGE; if (e.y > WORLD.h + EDGE) e.y = WORLD.h + EDGE;
    // 地形：夹进世界之后推出（同玩家），并给一点绕墙的切向推力
    if (G.terr.length) terrResolveEnemy(e, spd, ux, uy, dt);
    // 接触伤害
    if (d < e.r + 9 && e.touchCd <= 0) {
      e.touchCd = 0.55;
      // 冲角装甲：撞上去是战术而不是失误，所以撞击自伤按等级递减（lv1 -40% → lv3 -75%）
      const ramMul = G.S.ram > 0 ? Math.max(0.25, 1 - (0.4 + (G.S.ram - 1) * 0.18)) : 1;
      hurtPlayer((e.dmg || c.dmg) * ramMul);
      // 撞击互推
      const push = c.ai === 'chase' || c.ai === 'swarm' ? 60 : 120;
      e.vx -= ux * push; e.vy -= uy * push;
      G.vx += ux * 40; G.vy += uy * 40;
    }
  }
  // 清理：保序压缩，一趟 O(n)。
  // ⚠️ 旧版是倒序逐个 splice，团灭（一波几十只同时死）时会退化成 O(n²) 的数组搬移。
  let w = 0;
  for (let i = 0; i < G.enemies.length; i++) { const e = G.enemies[i]; if (e.hp > 0) G.enemies[w++] = e; }
  G.enemies.length = w;
}

// ============ 玩家 ============
// 操控向《奇点回响》看齐：
//   转向：A / D（或方向键左/右） —— aimMode=='key' 时按角速度 S.turn 旋转
//         鼠标（aimMode=='mouse'） —— 朝光标方向缓慢转向（最大 12 rad/s）
//         摇杆（joy.active） —— 推满 = 满舵；微推 = 慢转
//   推进：W（或方向键上） —— 沿当前 G.ang 方向施加加速度
//   制动：S（或方向键下） —— 用更强的减速度立刻收住
//   松手：常量减速度（线性刹车），不是「慢慢漂停」
// 开火 / 冲刺 / 超载 / 子弹 / 冲角 / 死亡尾流 / 网黏粒子照旧。
//
// ============ 运动模型（作者 2026-10-03：「惯性再降，松开立刻停」）============
// 老版本是**指数阻尼** `exp(-k·dt)`，k=0.53 → τ=1.9s：松手后要漂将近两秒才停，
// 而且数学上**永远逼近不到零** —— 手感就是「松了手还在滑」。
// 现在换成「推进加速度 + **常量（线性）减速度**」，刹车有确定的时间和距离：
//      T_stop = MAXV / DECEL = 168 / 940 ≈ 0.18s
//      S_stop = MAXV² / (2·DECEL) ≈ 15px
// 这就是「松开立刻停」——线性刹车能真正到达零，不会拖一条无穷小的尾。
//
// ⚠️ 三个数是一组，一起改：
//    · **DECEL 必须远小于 ACC**。线性摩擦是「只要还在动就一直扣」，推进时的
//      净加速度 = ACC - DECEL；DECEL ≥ ACC 的话船根本开不出去。
//      正因为要配得上这么强的刹车，ACC 才从 620 抬到 1500。
//    · 净加速度 = 560 px/s² → 从静止到满速 0.3 秒，比老版本还快一点；
//      转向时旧方向的余速按 940 线性吃掉，「扭頭就走」不会有甩尾感。
//    · 三种减速度都乘 S.spd，所以快慢不同的船体**停止时间一致**，
//      只是绝对速度和刹车距离不同；乘 slowMul 是因为蛛网里连刹车也该变软。
const MAXV_BASE   = 168;    // 满速 px/s（沿用旧 MAXV，别改：它也决定了尾流的触发线）
const ACC_BASE    = 1500;   // 推进加速度 px/s²（旧 620）
const DECEL_COAST = 940;    // 松手减速度 px/s² → 满速到停 ≈ 0.18s
const DECEL_BRAKE = 2400;   // S 键 / 摇杆按在死区里 → ≈ 0.07s
const DECEL_DASH  = 180;    // 冲刺那 0.22 秒保留一段滑行，否则冲刺只剩位移、没有速度感
const STOP_EPS    = 6;      // 残速低于这个值直接归零（见 updatePlayer 里为什么必须判 thrusting）
// 冲刺的**速度硬上限**倍率。tryDash 给的是 300px/s 的冲量，而正常满速只有 168 ——
// 有了线性刹车之后，多出来的那部分会在一帧里被 `clamp(MAXV)` 砍掉，冲刺距离直接腰斩。
// 所以推进只负责把速度推到正常满速（见 updatePlayer 里 `thrusting && vm < MAXV`），
// 硬上限放宽到 1.9 倍留给冲刺 / 撞击推开，**让线性刹车自己把它收回来** ——
// 既保住了「冲出去一段」的距离感，又不会在冲刺结束那一帧突然掉速。
const DASH_TOP = 1.9;
// 转向基准角速度 rad/s。S.turn 是各船体的**倍率**（堡垒 0.82 / 玄鸦 1.30），
// 所以这里改的是「1.0 倍率 = 多少 rad/s」——原来就等于 S.turn 本身（≈1 rad/s，
// 掉个头要 3 秒），键盘和摇杆都转不动。3.2 rad/s = 半圈 1 秒，跟手且不飘。
// ⚠️ 鼠标那条支线是**独立的** 12 rad/s（见下），不受这个数影响。
const TURN_BASE = 3.2;
// 触屏摇杆专用的角速度上限 rad/s。作者 2026-10-03：「手机上摇杆推到哪，
// 船就立刻转到哪」—— 手机是**唯一只能靠朝向瞄准**的输入方式，
// 所以这里必须比键盘快一个量级：满舵掉头 180° 约 0.14s，手感是「跟手」。
// 旧值走 TURN_BASE（满舵 3.2 rad/s）→ 掉头要 1 秒，推了像没反应。
// ⚠️ 仍然保留角速度上限，**不直接写 G.ang = want**：一帧瞬移到目标角，
//    看眼里是「闪转 / 不听指挥」，反而更不像操控。留 0.14s 转过去才有手感。
//    （20 rad/s = 每帧 19°，正好对齐 24 向烘焙船体的 15°/帧，不会看出跳帧。）
const TURN_TOUCH = 20;
/* 场地力（引力井 / 反极）—— 以**位移**而不是加速度的形式施加（2026-10-14 修）
   ⚠️ 曾经的写法是 `G.vx -= ux * pull * dt`（每帧约 1.4 px/s）。这个游戏的运动模型是
      **线性刹车**：松手时按 940 px/s² 的**固定速率**扣速度（见 DECEL_COAST），
      每帧扣掉约 15.7 px/s。比它小的力在刹车段被整帧吃掉，净效果是零 ——
      磁暴核心的引力井从上线起就没有真的拽动过玩家一次（探针量出位移恒为 0）。
   ⚠️ 而且在固定速率刹车下「加速度」根本没有稳态：力小于刹车就归零、大于刹车就无限加速。
      所以这里改成**水流**：直接位移，推进可以顶着走但站不住 —— 这才是引力井的手感。
   ⚠️ 近距离衰减（d/380）：贴到核心时反而松，否则被拽进去一次就再也出不来（必死循环）。 */
function fieldDrift() {
  const e = G.boss;
  if (!e || e.hp <= 0 || e.entering || (e.cmpT || 0) > 0) return null;
  const a = bossForm(e).aura;
  if (a !== 'pull' && a !== 'push') return null;
  const dx = e.x - G.px, dy = e.y - G.py;
  const d = Math.hypot(dx, dy) || 1;
  // 引力井：越靠近越松（下限 0.2）—— 被拽到核心边上还能挣出来。
  // 反极：越靠近越猛，但**上限锁 1.0**（120 px/s < 玩家满速 168）：
  //   ⚠️ 上限一旦超过 168，本体的「推开」就强过玩家的全部推力 —— 那不是难，是根本贴不上去。
  //      正确难度是「贴脸要付出代价」，不是「贴不上去」。
  const k = a === 'pull' ? clamp(d / 380, 0.2, 1) : clamp(1.2 - d / 500, 0.35, 1);
  const base = a === 'pull' ? (e.form >= 1 ? 108 : 78) : 120;
  const s = base * k * (G.dashT > 0 ? 0.35 : 1);   // 冲刺期间能挣脱大部分（冲刺是解场手段）
  return { x: dx / d * s * (a === 'push' ? -1 : 1), y: dy / d * s * (a === 'push' ? -1 : 1) };
}

/* 奇点对玩家的吸力（视界形态）。同样是**位移式**，理由见 fieldDrift 那条注释。
   ⚠️ 冲刺期间衰减到 35% —— 冲刺是这一段的解场手段，「被吸住了挣不开」会直接毁掉它。 */
function singDrift() {
  const s = G.sing;
  if (!s) return null;
  const dx = s.x - G.px, dy = s.y - G.py;
  const d = Math.hypot(dx, dy) || 1;
  if (d > SING.PULL_R) return null;
  const k = clamp(1 - d / SING.PULL_R, 0.12, 1);
  const sp = SING.DRIFT * s.mul * k * (G.dashT > 0 ? 0.35 : 1);
  return { x: dx / d * sp, y: dy / d * sp };
}

/* 引力弯曲一个飞行物（视界形态）。**纯转向：只改方向，不改速率** ——
   速率不变玩家才学得会「子弹飞得一样快，只是路弯了」，进而学会利用它做制导。
   ⚠️ 有 `ang` 字段的（玩家子弹）必须**连 ang 一起改**：updateBullets 的 decel 分支
      会按 ang 重写 vx/vy，只改速度的话下一帧就被覆盖，弯曲等于没做。
      （速率是 decel 分支按 sp0 给的，所以这里改速率也没用 —— 正好，纯转向是我们要的。） */
function singBend(o, TURN, dt) {
  const s = G.sing;
  if (!s) return;
  const dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy) || 1;
  if (d > SING.PULL_R || d < 0.5) return;
  const cur = Math.atan2(o.vy, o.vx);
  const want = Math.atan2(dy, dx);
  let da = ((want - cur + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const turn = TURN * s.mul * clamp(1 - d / SING.PULL_R, 0.25, 1) * dt;
  const step = clamp(da, -turn, turn);        // 最多转到正对奇点，不绕圈
  const cs = Math.cos(step), sn = Math.sin(step);
  const nx = o.vx * cs - o.vy * sn;
  o.vy = o.vx * sn + o.vy * cs; o.vx = nx;
  if (o.ang !== undefined) o.ang = cur + step;
}

/* 给奇点「喂」东西 → 视界长大。这是整段的核心取舍：
   把敌人推进去 = 省弹药的白嫖击杀，但奇点每吃一口就大一点、吸得更狠。
   ⚠️ 上限 RMAX 必须存在：不封顶的话一个贪心的玩家能把视界喂到铺满屏幕。 */
function feedSing(n) {
  const s = G.sing; if (!s) return;
  const before = s.r;
  s.r = Math.min(SING.RMAX, s.r + n);
  s.fed += n;
  s.fedPulse = 0.35;   // 渲染层拿它画「刚吃了一口」的收环，见 drawSingularity
  if (s.r > before + 0.01) ring(s.x, s.y, s.r, '#ffcd75', .3, 2);
}

/* 吞噬一个敌人。⚠️ **不掉落**：掉的东西跟着一起进视界了 ——
   这就是「白嫖击杀」的定价。玩家得自己决定这一只是打掉（保星尘）还是推进去（省弹药）。 */
function devourEnemy(e, i) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  G.kills++; G.waveKills++;
  G.combo = Math.min(9, G.combo + 1); G.comboT = 2.4;
  G.score += Math.round((e.xp * 10 + 5) * G.combo);
  // 被拉长着吸进去的那一撮 —— 让玩家看清「它是被吞的，不是被打死的」
  for (let k = 0; k < 6; k++) {
    const a = Math.atan2(G.sing.y - e.y, G.sing.x - e.x) + rand(-0.5, 0.5);
    part({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
           life: .3, max: .3, col: k % 2 ? '#c070f0' : '#73eff7', size: 2, drag: 0.4 });
  }
  Sound.sfx.devour();
  addShake(1.5);
  G.enemies.splice(i, 1);
  feedSing(SING.FEED_ENEMY);
}

function updateSingularity(dt) {
  const s = G.sing;
  if (!s) return;
  s.t += dt;
  if (s.fedPulse > 0) s.fedPulse = Math.max(0, s.fedPulse - dt);
  // --- 绕玩家公转（有滞后 → 玩家可以把它拖到敌人堆里）---
  // ⚠️ 轨道目标必须夹在世界内：玩家贴着世界边缘时，公转半径会把奇点甩到界外，
  //    而玩家坐标本身是被 clamp 的 —— 于是「玩家在场内、奇点在场外」，
  //    视界永远够不着，整段的核心玩法（绕着它打 / 把敌人推给它）当场失效。
  s.orbitA += SING.ORBIT_W * dt;
  const m = s.r + 10;
  const tx = clamp(G.px + Math.cos(s.orbitA) * SING.ORBIT, m, WORLD.w - m);
  const ty = clamp(G.py + Math.sin(s.orbitA) * SING.ORBIT, m, WORLD.h - m);
  s.x += (tx - s.x) * Math.min(1, SING.FOLLOW * dt);
  s.y += (ty - s.y) * Math.min(1, SING.FOLLOW * dt);
  // --- 加压：每 1/3 时长涨一档（这段要「越来越紧」，不能从头平到尾）---
  const tier = Math.min(2, Math.floor(G.waveT / Math.max(1, G.waveDur / 3)));
  if (tier > s.tier) {
    s.tier = tier;
    s.mul = SING.TIER_MUL[tier];
    ring(s.x, s.y, s.r + 44, '#c070f0', .5, 2);
    ring(s.x, s.y, s.r + 104, '#ffcd75', .45, 2);
    Sound.sfx.warn(); addShake(5);
    banner(T('bn.horizonGrow'), T('bn.horizonGrowSub'), '#c070f0', 1.8);
  }
  // 视界自己也在缓慢长 —— 保证这一段有推进感，不是纯粹的熬时间
  s.r = Math.min(SING.RMAX, s.r + 0.5 * dt);

  // --- 敌人：被拽向奇点，进视界就被吞 ---
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.hp <= 0 || e.boss) continue;      // 巨像太重，拽不动（也不该被白嫖）
    const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > SING.PULL_R) continue;
    // ⚠️ 同样是位移式：敌人 AI 各自往不同方向写位置，加速度会和它们的寻路互相打架
    const sp = SING.DRIFT * 1.3 * s.mul * clamp(1 - d / SING.PULL_R, 0.1, 1);
    e.x = clamp(e.x + dx / d * sp * dt, e.r, WORLD.w - e.r);
    e.y = clamp(e.y + dy / d * sp * dt, e.r, WORLD.h - e.r);
    if (d < SING.PULL_R * 0.34 && Math.random() < 0.14) {
      part({ x: e.x, y: e.y, vx: dx / d * 90, vy: dy / d * 90, life: .28, max: .28, col: '#c070f0', size: 1, drag: 0.5 });
    }
    if (d < s.r + e.r * 0.4) devourEnemy(e, i);
  }

  // --- 玩家在视界里：持续灼烧 ---
  //   ⚠️ 不走 hurtPlayer：那会吃受击无敌帧（刚被打过就免伤），也会清连击、震屏、
  //      让「站在视界里」变得时灵时不灵。自己按 tick 结算，行为可预测。
  const pd = Math.hypot(s.x - G.px, s.y - G.py);
  if (pd < s.r && !G.dead) {
    G.ehTick -= dt;
    if (G.ehTick <= 0) {
      G.ehTick = SING.EH_TICK;
      G.S.hp -= SING.EH_DMG;
      G.vign = Math.max(G.vign, 0.8);
      addShake(2.2);
      Sound.sfx.hurt();
      burst(G.px, G.py, 7, ['#c070f0', '#ff3355'], 90, .3, 2);
      if (G.S.hp <= 0) { G.S.hp = 0; die(); }
    }
  } else {
    G.ehTick = 0;   // 离开视界立刻重置：回去就要重新等一跳，不给「蹭一下就跑」留空子
  }
}

function updatePlayer(dt) {
  const S = G.S;
  // ---- 转向 ----
  // 手机版：炮口(G.aim)与船体(G.ang)解耦 —— 船体跟着左杆，炮口由右杆独立设定。
  const touchAimMode = touchMode && !BOT;
  if (touchAimMode) {
    if (joy.active) {
      // 左杆：推到哪船头立刻朝哪（见 TURN_TOUCH）。炮口保持右杆方向，不跟随船体。
      const jm = Math.hypot(joy.x, joy.y);
      if (jm > MOVE_DZ) {
        const want = Math.atan2(joy.y, joy.x);
        const rate = TURN_TOUCH * S.turn * (0.6 + 0.4 * Math.min(1, jm / 0.35));
        let d = ((want - G.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const step = rate * dt;
        if (d > step) d = step; else if (d < -step) d = -step;
        // 差值 <0.02rad（1.1°）直接吸附，避免每帧在目标附近「蹭」（看着像角度抖动）。
        if (Math.abs(d) < 0.02) G.ang = want; else G.ang += d;
      }
    }
    // ⚠️ 松手**不回摆**。旧实现会自己把船头转回瞄准标方向 —— 玩家明明没在操作，
    //    船却在自己转，朝向的控制权就不在玩家手上了。现在松手 = 停在哪朝哪。
    G.aim = touchAim;
  } else if (joy.active) {
    // 摇杆（桌面/非触屏路径，逻辑同旧版）：方向即朝向，推到哪船头立刻朝哪。
    // 触屏是唯一只能靠「朝向」瞄准的输入方式，老路径走 TURN_BASE（满舵 3.2 rad/s）
    // 要 1 秒才掉过头，手机上这个延迟直接毁掉操作感。
    // ⚠️ 死区 0.12 是**必需**的，不是手感微调：mag 很小时 atan2 的方向只是
    //    手指抖出来的噪声，不过滤的话船会在死区里自己小幅抽搐。死区内保持原朝向。
    // ⚠️ 幅度仍留一点权重，让「刚出死区」的微调柔一点、推满给满舵；
    //    但下限 0.6 保证最差也有 12 rad/s（180°/0.26s），依旧是「立刻」。
    const jm = Math.hypot(joy.x, joy.y);
    if (jm > 0.12) {
      const want = Math.atan2(joy.y, joy.x);
      const rate = TURN_TOUCH * S.turn * (0.6 + 0.4 * Math.min(1, jm / 0.35));
      let d = ((want - G.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const step = rate * dt;
      // 上限之外再留一个**收敛吸附**：差得很少时直接咬住目标角。
      // 不这么做的话会以每帧不到一度的步长在目标附近「蹭」过去，看着像角度抖动。
      if (d > step) d = step;
      else if (d < -step) d = -step;
      // 已经很接近目标角：**直接吸附到 want**。不这么做的话会以每帧不到一度的
      // 步长在目标附近「蹭」过去，看着像角度抖动。差值 <0.02rad（1.1°）时一帧跳过去
      // 在画面上完全看不出来，但枪口因此是严格对准摇杆方向的（弹道不偏）。
      if (Math.abs(d) < 0.02) { G.ang = want; }
      else { G.ang += d; }
    }
    G.aim = G.ang;
  } else if (aimMode === 'mouse' && mouse.inside) {
    // ⚠️ mouse 存的是**视口坐标**（准星要按屏幕画，见 drawCrosshair），
    //    而瞄准要在世界坐标里算 —— 少了这一步相机偏移，准星指哪儿打哪儿就全错了，
    //    而且错得很隐蔽：飞船正对屏幕中心时看起来完全正常，一偏就歪。
    const [mw, mh] = mouseWorld();
    const want = Math.atan2(mh - G.py, mw - G.px);
    const d = ((want - G.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const max = 12 * dt;
    G.ang += clamp(d, -max, max);
    G.aim = G.ang;
  } else {
    // 键盘 A/D：未按键不漂移
    const kd = ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0)
             - ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0);
    if (kd) G.ang += kd * TURN_BASE * S.turn * dt;
    G.aim = G.ang;
  }

  // ---- 推进 / 制动 / 线性刹车 ----
  const wHeld = keys['KeyW'] || keys['ArrowUp'];
  const sHeld = keys['KeyS'] || keys['ArrowDown'];
  // 摇杆：mag > 死区 = 推进；按着不动（在死区里）= 制动
  const joyMag = joy.active ? Math.hypot(joy.x, joy.y) : 0;
  const joyThrust = joy.active && joyMag > 0.25;
  const joyBrake = joy.active && joyMag <= 0.05;
  const thrusting = wHeld || joyThrust;
  const braking = sHeld || joyBrake;
  G.thrust = thrusting;
  // 蛛网减速
  const slow = webSlowAt(G.px, G.py);
  G.webSlow = slow;
  const slowMul = 1 - slow;
  // 杀戮狂热：击杀后短暂抬升推进与极速。倍率只作用在**消费点**，不进 S.spd（避免被续档重放叠死）。
  if (G.rampageT > 0) G.rampageT -= dt;
  // 无尽怒火：怒火期间血锁 1（不是无敌，该吃的伤害照吃），射速与机动飙升。
  //    ⚠️ 同样只作用在消费点 —— 写进 S.rate / S.spd 会被续档重放叠死。
  let um = 1;
  if (G.undyingT > 0) {
    G.undyingT -= dt;
    um = 1.5 + S.undying * 0.15;                    // 1.65 / 1.80 / 1.95
    if (S.hp < 1) S.hp = 1;
    if (G.undyingT <= 0) {
      G.undyingT = 0;
      ring(G.px, G.py, 54, '#e04060', .45, 2);      // 怒火退去：收一圈，提醒「现在会死了」
      Sound.sfx.fizzle();
    }
  }
  const rm = (G.rampageT > 0 ? (1.18 + S.rampage * 0.07) : 1) * um;   // 狂热 1.25/1.32/1.39 × 怒火
  G.rampageMul = rm;
  const ACC = ACC_BASE * S.spd * slowMul * rm;
  const MAXV = MAXV_BASE * S.spd * slowMul * rm;          // 推进能到的满速
  const MAXV_CAP = MAXV * DASH_TOP;                  // 速度硬上限（留给冲刺 / 被撞开）
  // ⚠️ 到了满速就不再加推力 —— 高于满速的部分（冲刺余速）必须交给线性刹车去收，
  //    否则 300px/s 的冲刺冲量会在下一帧被硬夹回 168，冲刺等于白按。
  const vmPre = Math.hypot(G.vx, G.vy);
  G.moving = vmPre > 14;   // 审判光环只在「真的在动」时结算（站着不动不转）
  if (thrusting && vmPre < MAXV) {
    G.vx += Math.cos(G.ang) * ACC * dt;
    G.vy += Math.sin(G.ang) * ACC * dt;
  }
  // ⚠️ 刹车段必须用「推进之后」的速度 —— 用 vmPre 会把本帧刚加上的推力当成超出去的部分扣掉，
  //    结果是按住 W 也纹丝不动（踩过一次：探针量出稳态速度 0.0 px/s）。
  let vm = Math.hypot(G.vx, G.vy);
  // 线性刹车：沿速度反方向按固定速率扣速度（见上方「运动模型」那一段）。
  // ⚠️ `nv < STOP_EPS` 的归零必须挂在「**没有**推进」这个前提下 ——
  //    蛛网里 ACC 和 DECEL 一起被 slowMul 缩小，单帧的净速度本来就可能低于 STOP_EPS，
  //    不判 thrusting 会把「按住 W 在网里挪」判成静止，变成网里完全开不动。
  const dec = (G.dashT > 0 ? DECEL_DASH : (braking ? DECEL_BRAKE : DECEL_COAST)) * S.spd * slowMul;
  if (vm > 0) {
    const nv = vm - dec * dt;
    if (nv <= 0 || (!thrusting && nv < STOP_EPS)) { G.vx = 0; G.vy = 0; vm = 0; }
    else { const f = nv / vm; G.vx *= f; G.vy *= f; vm = nv; }
  }
  if (vm > MAXV_CAP) { G.vx = G.vx / vm * MAXV_CAP; G.vy = G.vy / vm * MAXV_CAP; }
  // 场地力（引力井 / 反极 / 奇点）：**在夹取之前**叠加，否则贴着世界边缘时被吃掉
  const fd = fieldDrift(), sd = singDrift();
  G.px = clamp(G.px + G.vx * dt + (fd ? fd.x * dt : 0) + (sd ? sd.x * dt : 0), 10, WORLD.w - 10);
  G.py = clamp(G.py + G.vy * dt + (fd ? fd.y * dt : 0) + (sd ? sd.y * dt : 0), 10, WORLD.h - 10);
  if (G.px <= 10 || G.px >= WORLD.w - 10) G.vx *= 0.4;
  if (G.py <= 10 || G.py >= WORLD.h - 10) G.vy *= 0.4;
  // 地形：夹进世界**之后**再做推出 —— 顺序反了会把船推到世界外面去
  if (G.terr.length) terrResolvePlayer();
  // 冲角装甲
  if (S.ram > 0) ramCheck();
  // 死亡尾流
  if (S.death > 0) {
    G.wakeT -= dt;
    if (G.wakeT <= 0 && Math.hypot(G.vx, G.vy) > 55) {
      G.wakeT = 0.055;
      G.wakes.push({ x: G.px, y: G.py, t: 0, life: 0.5 + S.death * 0.13, r: 6 + S.death * 1.7, hitT: -1 });
      if (G.wakes.length > 64) G.wakes.shift();
    }
  }
  // 网里掉紫屑
  if (slow > 0 && Math.random() < 0.25) {
    part({ x: G.px + rand(-8, 8), y: G.py + rand(-8, 8), vx: rand(-12, 12), vy: rand(-12, 12), life: .4, max: .4, col: '#c070f0', size: 1, drag: 2 });
  }

  // ---- 开火 ----
  G.fireT -= dt;
  // ⚠️ 触屏不再「拖动即开火」。旧实现里右半屏一拖就开火，和右下角那颗开火开关是
  //    两条互相打架的路径（玩家想只转向、结果一直在打；松手又立刻停火）。
  //    现在开火只有三种来源：鼠标 / Space / 开火开关（G.autoFire），右杆只管指向。
  const wantFire = (mouse.down || keys['Space'] || G.autoFire) && !G.dead;
  // ---- 过热膛线（熔炉专属）：开火蓄热 / 停火散热 / 见顶锁膛 ----
  // ⚠️ 蓄热只看 wantFire（按速率），**不看这一帧是否真的打出一发** —— 与射速解耦是 echo 的原设计。
  // ⚠️ 锁膛期间 canFire=false，但 fireT 照常走，所以解锁后立刻就能开火，不会多等一个间隔。
  let canFire = wantFire;
  if (G.heatOn) {
    if (G.heatLock > 0) {
      canFire = false;
      G.heatLock = Math.max(0, G.heatLock - dt);
      G.heat = Math.max(0, G.heat - HEAT_VENT * dt);
      if (G.heatLock <= 0) {
        G.heat = 0;
        ring(G.px, G.py, 26, '#ecd08a', 0.4, 2);
        Sound.sfx.ready();
      }
    } else if (wantFire) {
      G.heat = Math.min(HEAT_MAX, G.heat + HEAT_UP * dt);
      if (G.heat >= HEAT_MAX) {
        G.heatLock = HEAT_LOCK;
        ring(G.px, G.py, 32, '#ffbe5a', 0.5, 3);
        burst(G.px, G.py, 10, ['#ffbe5a', '#f4f4f4', '#ef7d57'], 150, 0.4, 1.8);
        addShake(3);
        Sound.sfx.zap();
      }
    } else {
      G.heat = Math.max(0, G.heat - HEAT_COOL * dt);
    }
    G.heatMul = HEAT_COLD + (HEAT_HOT - HEAT_COLD) * (G.heat / HEAT_MAX);
  }
  if (canFire && G.fireT <= 0) {
    const iv = 0.17 / (S.rate * rm) / (G.odT > 0 ? 2 : 1);
    G.fireT = iv;
    fireMain(G.aim, G.odT > 0 ? 1.35 : 1);
  }
  if (G.muzzle > 0) G.muzzle -= dt;
  if (G.dashT > 0) G.dashT -= dt;
  if (G.dashCd > 0) G.dashCd -= dt;
  if (G.inv > 0) G.inv -= dt;
  if (G.hurtFlash > 0) G.hurtFlash -= dt;
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 1; }
  if (G.odT > 0) {
    G.odT -= dt;
    if (Math.random() < 0.4) part({ x: G.px + rand(-8, 8), y: G.py + rand(-8, 8), vx: rand(-20, 20), vy: rand(-30, -10), life: .3, max: .3, col: '#73eff7', size: 2, drag: 2 });
  }
  // 护盾脱战回复
  if (S.shieldMax > 0) {
    G.noHitT = (G.noHitT || 0) + dt;
    if (G.noHitT > 3.5 && S.shield < S.shieldMax) {
      const mul = S.shieldRegenMul * (synOn('phaseWall') ? 2 : 1);
      S.shield = Math.min(S.shieldMax, S.shield + S.shieldMax * 0.22 * mul * dt);
    }
  }
  // 尾焰粒子（推进器质变后转金）
  if (G.thrust && Math.random() < 0.7) {
    const bx = G.px - Math.cos(G.ang) * 10, by = G.py - Math.sin(G.ang) * 10;
    const col = S.goldTrail ? pick(['#ffcd75', '#ffe9a8', '#f4f4f4']) : pick(['#ffcd75', '#ef7d57', '#73eff7']);
    part({ x: bx + rand(-2, 2), y: by + rand(-2, 2), vx: -Math.cos(G.ang) * 90 + rand(-18, 18), vy: -Math.sin(G.ang) * 90 + rand(-18, 18), life: .22, max: .22, col, size: 2, drag: 3 });
  }
}

// ============ 无人机 ============
function updateDrones(dt) {
  const S = G.S;
  while (G.drones.length < S.drones) G.drones.push({ a: rand(TAU), cd: rand(0.4, 1.2) });
  while (G.drones.length > S.drones) G.drones.pop();
  for (const d of G.drones) {
    d.a += dt * 2.1;
    d.x = G.px + Math.cos(d.a) * 26;
    d.y = G.py + Math.sin(d.a) * 26;
    d.cd -= dt;
    if (d.cd <= 0) {
      const t = nearest(d.x, d.y, 190);
      if (t) {
        const a = Math.atan2(t.y - d.y, t.x - d.x);
        pBullet(d.x, d.y, a, 300, DRONE_DMG * S.dmg, { kind: 'drone', r: 2 });
        Sound.sfx.drone();
        d.cd = 0.62 / S.rate;
      } else d.cd = 0.2;
    }
  }
}

// ============ 装置型能力 ============
function nearestN(x, y, R, n) {
  const out = [];
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < R * R) out.push([d, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, n).map(p => p[1]);
}

// 电弧单跳的基础伤害（2026-10-03 平衡：9 → 12，见 arc 卡那段注释）
const ARC_DMG = 12;
// 无人机单发伤害（2026-10-03 平衡：7 → 8，见 drone 卡那段注释）
const DRONE_DMG = 8;
function updateAbilities(dt) {
  const S = G.S;
  // --- 电弧线圈：定时链击最近 N 个目标 ---
  if (S.arc > 0) {
    S.arcT -= dt;
    if (S.arcT <= 0) {
      const cd = 2.2 * S.arcCdMul * (synOn('staticArc') ? 0.65 : 1);
      const targets = nearestN(G.px, G.py, 235, 1 + S.arc);
      if (targets.length) {
        S.arcT = cd;
        let ax = G.px, ay = G.py;
        for (const t of targets) {
          G.fx.push({ type: 'arc', x0: ax, y0: ay, x1: t.x, y1: t.y, t: 0, life: 0.18, gold: S.arc >= 4 });
          damageEnemy(t, ARC_DMG * S.dmg * (1 + S.arc * 0.45), 0, 0, false, 0.4, true);
          ax = t.x; ay = t.y;
        }
        Sound.sfx.zap();
      } else S.arcT = 0.2;
    }
  }
  // --- 脉冲核心：定时冲击波 ---
  if (S.nova > 0) {
    S.novaT -= dt;
    if (S.novaT <= 0) {
      S.novaT = S.novaCd;
      const R = S.novaR;
      ring(G.px, G.py, R, S.novaVoid ? '#ffcd75' : '#c070f0', .5, 3);
      burst(G.px, G.py, 22, S.novaVoid ? ['#ffcd75', '#f4f4f4'] : ['#c070f0', '#f4f4f4'], 170, .5, 2, true);
      Sound.sfx.nova(); addShake(3);
      buildGrid();
      forNear(G.px, G.py, R, e => {
        const d = Math.hypot(e.x - G.px, e.y - G.py);
        if (d > R + e.r) return;
      const mul = (e.slow > 0 && synOn('resonance')) ? 1.7 : 1;
      damageEnemy(e, 26 * S.dmg * (1 + S.nova * 0.3) * mul, (e.x - G.px) / (d || 1), (e.y - G.py) / (d || 1), false, 3.5);
      // 「静滞钳制」协同（拘束 × 脉冲）：冲击波必定把波及的人钉住一瞬。
      //    平时「钉住」要看概率，这一路不看 —— 解控和免费的安全窗口是这张卡的价值。
      if (synOn('staticBind') && !e.boss) e.root = Math.max(e.root || 0, 0.9 + S.bindT * 0.5);
      });
      // 质变：湮灭波及的敌弹
      if (S.novaVoid) {
        for (let i = G.ebullets.length - 1; i >= 0; i--) {
          const b = G.ebullets[i];
          if (Math.hypot(b.x - G.px, b.y - G.py) < R) G.ebullets.splice(i, 1);
        }
      }
      if (synOn('droneSwarm')) for (const d of G.drones) d.cd = 0;
    }
  }
  // --- 静止场：持续给范围内敌人挂减速 ---
  if (S.stasis > 0) {
    for (const e of G.enemies) {
      if (Math.hypot(e.x - G.px, e.y - G.py) < S.stasisR) e.slow = S.stasisSlow;
    }
  }
  // --- 纳米修复：持续回血 ---
  if (S.regen > 0 && S.hp < S.maxHp && !G.dead) {
    S.hp = Math.min(S.maxHp, S.hp + S.regen * dt);
  }
  // --- 冷却计时：长枪 / 折跃 / 磁雷 ---
  if (S.lanceT > 0) S.lanceT -= dt;
  if (S.blinkT > 0) S.blinkT -= dt;
  // --- 磁暴雷：定时在船尾布设 ---
  if (S.mine > 0) {
    S.mineT -= dt;
    if (S.mineT <= 0 && G.mines.length < S.mineMax) {
      S.mineT = S.mineCd;
      // 布在船尾稍后一点：贴着机尾会立刻被自己的碰撞体触发
      const bx = clamp(G.px - Math.cos(G.ang) * 14, 8, WORLD.w - 8);
      const by = clamp(G.py - Math.sin(G.ang) * 14, 8, WORLD.h - 8);
      G.mines.push({
        x: bx, y: by, t: 0, life: 11, arm: 0.35,   // arm：布设后短暂待机，免得刚落就被贴脸怪点掉
        r: 7 + S.mine * 1.4, blast: 34 + S.mine * 14, dmg: (30 + S.mine * 22) * S.dmg,
        gold: S.mineGold ? 1 : 0, pull: 34 + S.mine * 12,
      });
      ring(bx, by, 10, S.mineGold ? '#ffcd75' : '#c070f0', .22, 1);
      Sound.sfx.mine();
    }
  }
  // --- 风之障壁：周期性在机首前方竖起拦截线 ---
  if (S.ww > 0) {
    S.wwT -= dt;
    if (S.wwT <= 0) {
      S.wwT = S.wwCd;
      const fx = G.px + Math.cos(G.ang) * 22, fy = G.py + Math.sin(G.ang) * 22;
      G.walls.push({ x: fx, y: fy, a: G.ang, half: 44, t: 0, life: S.wwDur, gold: S.wwGold ? 1 : 0 });
      ring(fx, fy, 14, S.wwGold ? '#ffcd75' : '#73eff7', .25, 2);
      Sound.sfx.ready();
    }
  }
  // --- 影分身：冷却就绪召出镜像分身 ---
  if (S.sh > 0) {
    S.shT -= dt;
    if (S.shT <= 0) {
      S.shT = S.shCd;
      const ox = G.px - Math.cos(G.ang) * 20, oy = G.py - Math.sin(G.ang) * 20;
      G.clones.push({ x: ox, y: oy, a: G.ang, t: 0, life: S.shDur, fireT: 0, gold: S.shGold ? 1 : 0 });
      ring(ox, oy, 12, S.shGold ? '#ffcd75' : '#a06cf0', .25, 2);
      Sound.sfx.ready();
    }
  }
  // --- 审判：移动时旋斩光环（脉冲计时在 G.spinT，避免每帧重复结算）---
  if (S.spin > 0 && G.moving) {
    G.spinT -= dt;
    if (G.spinT <= 0) {
      G.spinT = 0.22;
      buildGrid();
      let hit = false;
      forNear(G.px, G.py, S.spinR + 6, e => {
        if (e.dead || e.hp <= 0 || e.boss) return;
        const d = Math.hypot(e.x - G.px, e.y - G.py);
        if (d > S.spinR + e.r) return;
        damageEnemy(e, S.spinDmg * S.dmg, (e.x - G.px) / (d || 1), (e.y - G.py) / (d || 1), false, 2, true);
        hit = true;
      });
      if (hit) { part({ x: G.px + rand(-S.spinR, S.spinR), y: G.py + rand(-S.spinR, S.spinR), vx: 0, vy: 0, life: .18, max: .18, col: S.spinGold ? '#ffcd75' : '#73eff7', size: 2, drag: 2 }); }
    }
  } else G.spinT = 0;
  // --- 死亡莲华：冷却就绪向四周绽放刃雨 ---
  if (S.lotus > 0) {
    S.lotusT -= dt;
    if (S.lotusT <= 0) {
      S.lotusT = S.lotusCd;
      const n = 10 + S.lotus * 4, off = rand(TAU);
      const mz = hullNose();
      for (let i = 0; i < n; i++) {
        const a = off + i / n * TAU;
        pBullet(G.px + Math.cos(a) * mz, G.py + Math.sin(a) * mz, a, 300 * S.bspd, (16 + S.lotus * 10) * S.dmg, { kind: 'lotus', decel: true });
      }
      ring(G.px, G.py, 26, S.lotusGold ? '#ffcd75' : '#ef7d57', .4, 3);
      Sound.sfx.shoot(); addShake(2);
    }
  }
  // --- 冰封长箭：冷却就绪朝最近敌人射出一支贯穿冰箭 ---
  if (S.crystal > 0) {
    S.crystalT -= dt;
    if (S.crystalT <= 0) { S.crystalT = S.crystalCd; fireArrow(); }
  }
  // --- 瓦解射线：站定蓄力，蓄满射出一条持续激光；一动就断 ---
  updateBeam(dt);
  // --- 荆棘甲壳 / 无尽怒火：冷却计时 ---
  if (G.thornCd > 0) G.thornCd -= dt;
  if (G.undyingCdT > 0) G.undyingCdT -= dt;
}

// ============ 第六批（2026-10-09）：海克斯强化 / 英雄技能 ============
const ARROW_SPD = 190, ARROW_TRAV = 560, ARROW_LIFE = 3.2;
const BEAM_CHARGE = 0.55, BEAM_TICK = 0.12, BEAM_HALF = 9;
/* 冰封长箭（借艾希「魔法水晶箭」）
   一支**独立飞行体**：慢速、贯穿所有目标、沿途冻结，伤害按**已飞里程**递增。
   ⚠️ 用「已命中列表」而不是「命中即消失」—— 它是贯穿弹，同一个目标不该每帧被结算一次
      （箭速只有 190px/s，一个目标会被覆盖好几帧）。
   ⚠️ 冻结对 Boss 不生效（和拘束立场一致）：巨像站定一秒不开火，机制会直接坏掉。 */
function fireArrow() {
  const S = G.S;
  const tgt = nearestN(G.px, G.py, 460, 1)[0];
  const a = tgt ? Math.atan2(tgt.y - G.py, tgt.x - G.px) : G.aim;
  const mz = hullNose();
  G.arrows.push({
    x: G.px + Math.cos(a) * mz, y: G.py + Math.sin(a) * mz,
    a, spd: ARROW_SPD, trav: 0, t: 0, life: ARROW_LIFE,
    dmg: (20 + S.crystal * 14) * S.dmg,
    freeze: 0.5 + S.crystal * 0.25,
    gold: S.crystalGold ? 1 : 0, hit: [],
  });
  Sound.sfx.lance();
  ring(G.px, G.py, 16, S.crystalGold ? '#ffcd75' : '#73eff7', .24, 2);
}
function updateArrows(dt) {
  if (!G.arrows.length) return;
  const S = G.S;
  for (let i = G.arrows.length - 1; i >= 0; i--) {
    const a = G.arrows[i];
    a.t += dt;
    const step = a.spd * dt;
    a.x += Math.cos(a.a) * step; a.y += Math.sin(a.a) * step;
    a.trav += step;
    if (a.t >= a.life || a.trav > ARROW_TRAV) { G.arrows.splice(i, 1); continue; }
    // 冰屑拖尾（每 ~10px 撒一粒，密了会糊成一条白线）
    if ((a.trav | 0) % 10 === 0) {
      part({ x: a.x, y: a.y, vx: rand(-8, 8), vy: rand(-8, 8), life: .26, max: .26,
             col: a.gold ? '#ffcd75' : '#cfe8ff', size: 1, drag: 3 });
    }
    buildGrid();
    forNear(a.x, a.y, 26, e => {
      if (e.dead || e.hp <= 0) return;
      if (a.hit.indexOf(e) >= 0) return;
      if ((e.x - a.x) ** 2 + (e.y - a.y) ** 2 > (e.r + 6) ** 2) return;
      a.hit.push(e);
      // 越飞越疼：飞满 320px 时 2.2 倍（上限夹 1.2 的加成，别让它变成无限增长）
      const mul = 1 + Math.min(1.2, a.trav / 320);
      damageEnemy(e, a.dmg * mul, Math.cos(a.a), Math.sin(a.a), false, 0.8);
      if (!e.boss) e.root = Math.max(e.root || 0, a.freeze * (synOn('iceBind') ? 1.6 : 1));
      ring(e.x, e.y, e.r + 6, a.gold ? '#ffcd75' : '#73eff7', .22, 1);
      part({ x: e.x, y: e.y, vx: 0, vy: 0, life: .2, max: .2, col: '#cfe8ff', size: 2, drag: 4 });
    });
  }
}
/* 瓦解射线（借维克兹「生命形态瓦解射线」）
   三段状态机：待机 →（`!G.moving` 时）蓄力 → 发射 → 冷却。
   ⚠️ 中断判据是 `G.moving`（速度 > 14px/s），不是「玩家按了 W」—— 被撞飞也会断，
      这是故意的：站桩就是站桩，被打退了就得重新来。
   ⚠️ 倍率（motionTwin 的静止加成）只在**发射那一刻**读方向、在**每跳结算**读倍率，
      不写进 S.dmg —— 写进去会被续档重放叠死。 */
function updateBeam(dt) {
  const S = G.S;
  if (S.beam <= 0) return;
  if (G.beamFire > 0) {
    G.beamFire -= dt;
    if (G.moving || G.dead) {                       // 一动就断，蓄力清零、冷却减半
      G.beamFire = 0; G.beamCh = 0; G.beamT = S.beamCd * 0.5;
      Sound.sfx.fizzle();
      return;
    }
    G.beamTick -= dt;
    if (G.beamTick <= 0) { G.beamTick = BEAM_TICK; beamTick(); }
    if (G.beamFire <= 0) G.beamT = S.beamCd;
    return;
  }
  if (G.beamT > 0) { G.beamT -= dt; G.beamCh = 0; return; }
  if (G.moving || G.dead) { G.beamCh = Math.max(0, G.beamCh - dt * 2); return; }
  G.beamCh += dt;
  if (G.beamCh >= BEAM_CHARGE) {
    G.beamCh = 0; G.beamFire = S.beamDur; G.beamAng = G.aim; G.beamTick = 0;
    // 地形截断：发射那一刻先量一次（下面的 beamTick 每跳还会再量 —— 掩体可能被打碎）
    G.beamClip = terrRay(G.px, G.py, G.beamAng, S.beamLen);
    Sound.sfx.laser(); addShake(2.4);
  }
}
function beamTick() {
  const S = G.S;
  const ca = Math.cos(G.beamAng), sa = Math.sin(G.beamAng);
  G.beamClip = terrRay(G.px, G.py, G.beamAng, S.beamLen);
  const len = Math.min(S.beamLen, G.beamClip || S.beamLen);
  const mul = synOn('motionTwin') ? 1.5 : 1;
  const dmg = S.beamDmg * S.dmg * mul;
  for (const e of G.enemies) {
    if (e.dead || e.hp <= 0) continue;
    const dx = e.x - G.px, dy = e.y - G.py;
    const along = dx * ca + dy * sa;
    if (along < 0 || along > len) continue;
    const off = Math.abs(-dx * sa + dy * ca);
    if (off > BEAM_HALF + e.r) continue;
    damageEnemy(e, dmg, ca, sa, false, 0.3, true);
  }
  // 质变：站桩的回报 —— 射线经过的敌弹被蒸发。不给这个，没人愿意为它停下来。
  if (S.beamGold) {
    for (let i = G.ebullets.length - 1; i >= 0; i--) {
      const b = G.ebullets[i];
      const dx = b.x - G.px, dy = b.y - G.py;
      const along = dx * ca + dy * sa;
      if (along < 0 || along > len) continue;
      if (Math.abs(-dx * sa + dy * ca) > BEAM_HALF + 4) continue;
      burst(b.x, b.y, 3, ['#c070f0', '#f4f4f4'], 60, .2, 1);
      G.ebullets.splice(i, 1);
    }
  }
  // 每跳一小撮等离子屑，激光才像在「烧」
  const gx = G.px + ca * (40 + rand(0, len - 40)), gy = G.py + sa * (40 + rand(0, len - 40));
  part({ x: gx, y: gy, vx: rand(-20, 20), vy: rand(-20, 20), life: .22, max: .22,
         col: S.beamGold ? '#ffcd75' : '#c070f0', size: 1, drag: 3 });
}

/* 风之障壁：把 G.walls 里还活着的拦截线逐帧推进，并吞掉穿过它的敌弹。
   ⚠️ 用「点到线段距离」判定，不是「上一帧在左、这一帧在右」的穿越检测 ——
      后者在子弹很快（>10px/帧）时会漏判；点到线段距离对单帧位移鲁棒。
   线段以 (w.x,w.y) 为中点、沿 w.a 方向半长 w.half；垂直距离 < 8px 且投影落在半长内即算撞墙。 */
function updateWalls(dt) {
  if (!G.walls.length) return;
  for (let i = G.walls.length - 1; i >= 0; i--) {
    const w = G.walls[i];
    w.t += dt;
    if (w.t >= w.life) { G.walls.splice(i, 1); continue; }
  }
  for (const w of G.walls) {
    const ca = Math.cos(w.a), sa = Math.sin(w.a);
    const px = -sa, py = ca;   // 墙方向（垂直朝向）
    for (let j = G.ebullets.length - 1; j >= 0; j--) {
      const b = G.ebullets[j];
      const dx = b.x - w.x, dy = b.y - w.y;
      const along = dx * ca + dy * sa;          // 沿墙轴投影
      const off = Math.abs(dx * px + dy * py);  // 垂直墙距离
      if (off < 8 && along > -w.half - 6 && along < w.half + 6) {
        if (Math.random() < 0.5) part({ x: b.x, y: b.y, vx: -b.vx * 0.2, vy: -b.vy * 0.2, life: .2, max: .2, col: w.gold ? '#ffcd75' : '#73eff7', size: 2, drag: 4 });
        G.ebullets.splice(j, 1);
      }
    }
  }
}
/* 影分身：把 G.clones 里还活着的影分身推进，并让它朝最近敌人周期射出半伤弹。
   ⚠️ 分身只补输出、不替玩家挡枪 —— 它打出的弹走 pBullet 同一套派生，所以穿甲 / 制导 / 裂变
      会自动继承（和玩家主炮同源），但单发伤害只有 55%（shMul）。 */
function updateClones(dt) {
  if (!G.clones.length) return;
  const S = G.S, mz = hullNose(), shMul = 0.55;
  for (let i = G.clones.length - 1; i >= 0; i--) {
    const c = G.clones[i];
    c.t += dt;
    if (c.t >= c.life) { G.clones.splice(i, 1); continue; }
    // 分身贴着船体斜后方漂，保持「伴飞」观感而不是飘走
    const tx = G.px - Math.cos(G.ang) * 18, ty = G.py - Math.sin(G.ang) * 18;
    c.x += (tx - c.x) * Math.min(1, dt * 6);
    c.y += (ty - c.y) * Math.min(1, dt * 6);
    c.fireT -= dt;
    if (c.fireT <= 0) {
      c.fireT = 0.5;
      const tgt = nearestN(c.x, c.y, 260, 1)[0];
      const a = tgt ? Math.atan2(tgt.y - c.y, tgt.x - c.x) : G.ang + Math.PI;
      pBullet(c.x + Math.cos(a) * mz, c.y + Math.sin(a) * mz, a, 300 * S.bspd,
        (10 * S.dmg) * shMul, { kind: 'clone', decel: true });
    }
  }
}

/* 磁暴雷的场上结算（搬运自 echo 的 mine）
   两段行为：① 磁引 —— 范围内敌人被缓慢拽过来；② 触爆 —— 敌人贴上或寿命到期时炸开。
   ⚠️ 磁引必须**限速**（每分钟最多拉多远），直接把敌人坐标插值到雷上会变成「吸尘器」，
      敌人瞬移过来就失去「走位引导」的意味了。 */
function updateMines(dt) {
  const S = G.S;
  if (!G.mines.length) return;
  for (let i = G.mines.length - 1; i >= 0; i--) {
    const m = G.mines[i];
    m.t += dt;
    if (m.t < m.arm) continue;
    let boom = m.t >= m.life;
    buildGrid();
    // 磁引 + 触爆
    forNear(m.x, m.y, m.pull + 20, e => {
      if (e.dead || e.hp <= 0) return;
      const dx = e.x - m.x, dy = e.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < m.r + e.r) { boom = true; return; }
      if (d < m.pull) {
        const k = 62 * (1 - d / m.pull) * dt;      // 越近拉得越快，但有上限
        e.x -= dx / d * k; e.y -= dy / d * k;
      }
    });
    if (!boom) continue;
    explodeMine(m);
    G.mines.splice(i, 1);
  }
  // 场上超出上限（降级不可能，但被 grant 之外的路径改过就有）→ 掐掉最老的
  while (G.mines.length > S.mineMax) G.mines.shift();
}

function explodeMine(m) {
  const S = G.S;
  const R = m.blast * (synOn('mineHesh') ? 1.45 : 1);
  const dmg = m.dmg * (synOn('mineHesh') ? 1.2 : 1);
  ring(m.x, m.y, R, m.gold ? '#ffcd75' : '#c070f0', .42, 3);
  burst(m.x, m.y, 20, m.gold ? ['#ffcd75', '#f4f4f4'] : ['#c070f0', '#ef7d57'], 180, .5, 2, true);
  Sound.sfx.boom(); addShake(3.4);
  buildGrid();
  // 同 explode()：范围伤害连带的一切都不冻画面
  noFreeze(() => {
    forNear(m.x, m.y, R, e => {
      if (e.dead || e.hp <= 0) return;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d > R + e.r) return;
      damageEnemy(e, dmg, (e.x - m.x) / (d || 1), (e.y - m.y) / (d || 1), false, 3);
    });
  });
  // 质变：磁暴湮灭波及的敌弹
  if (m.gold) {
    for (let j = G.ebullets.length - 1; j >= 0; j--) {
      const b = G.ebullets[j];
      if (Math.hypot(b.x - m.x, b.y - m.y) < R) G.ebullets.splice(j, 1);
    }
  }
  // 迟滞雷场协同：炸完留下一片减速场（复用织网者的 webs 机制，1.6 秒后自然消散）
  // ⚠️ webs 的元素必须带 grow（webSlowAt 用 w.r * w.grow 算半径），漏了会算出 NaN 半径
  if (synOn('mineStasis')) {
    G.webs.push({ x: m.x, y: m.y, r: R * 0.8, t: 0, life: 1.8, grow: 0 });
    if (G.webs.length > 40) G.webs.shift();
  }
}

// ============ 冲角装甲（搬运自 echo 的 ram，数值与判定全部重写） ============
// echo 是「撞击即可杀伤」，本作原本只有敌人撞你会掉血。这里补上反过来的那半边：
// 船身贴上敌人就持续造成伤害，代价是首级一次性砍掉 30% 射速、以及撞得越狠自己越疼。
// ⚠️ 每帧都判会变成「贴上去一帧几十跳伤害」，所以按敌人各记一个 0.35 秒的重击间隔，
//    用 G.t 时间戳比较而不是给每个敌人挂计时器 —— 敌人随时会被回收，计时器得跟着清。
const RAM_CD = 0.35;
function ramCheck() {
  const S = G.S;
  const gold = S.ramGold ? 1.6 : 1;
  const syn = synOn('moltenRam') ? 1.5 : 1;
  const dmg = (10 + S.ram * 6) * S.dmg * gold * syn;
  buildGrid();
  let hitAny = false;
  forNear(G.px, G.py, 22, e => {
    if (e.dead || e.hp <= 0) return;
    const d = Math.hypot(e.x - G.px, e.y - G.py);
    if (d > e.r + 9) return;
    if (e.ramT !== undefined && G.t - e.ramT < RAM_CD) return;
    e.ramT = G.t;
    const dx = (e.x - G.px) / (d || 1), dy = (e.y - G.py) / (d || 1);
    damageEnemy(e, dmg, dx, dy, false, 2.6);
    hitAny = true;
  });
  if (!hitAny) return;
  // 撞上去的手感：一小记震动 + 冲击环，但不能给无敌帧（无敌帧会把冲角变成免伤流）
  addShake(2.2);
  ring(G.px + Math.cos(G.aim) * 8, G.py + Math.sin(G.aim) * 8, 11, S.ramGold ? '#ffcd75' : '#ef7d57', .2, 1);
  Sound.sfx.hit();
  // 撞击汲取协同：撞上去也回血，但只给击坠回血的一半 ——
  // 冲角是每 0.35 秒一次的持续接触，给满额会变成「贴着敌人无限回血」。
  if (synOn('ramLeech') && S.leech > 0) healPlayer(S.leech / 100 * S.maxHp * 0.5);
}

// ============ 死亡尾流（搬运自 echo 的 deathtrail） ============
// 两条效果：① 带子灼伤踩进去的敌人；② 带子消解碰到的敌弹。
// 第二条才是这个模块真正的价值 —— 它是本作第一个「用走位清弹幕」的模块，
// 别的模块都在加强输出，只有它在改变你怎么跑位。
function updateWakes(dt) {
  const S = G.S;
  if (!G.wakes.length) return;
  const gold = S.deathGold ? 1.5 : 1;
  const dmg = (9 + S.death * 6) * S.dmg * gold;
  buildGrid();
  for (let i = G.wakes.length - 1; i >= 0; i--) {
    const w = G.wakes[i];
    w.t += dt;
    if (w.t >= w.life) {
      // 质变：熄灭那一刻横向炸裂，把整条尾流的伤害补成一发
      if (S.deathGold) explode(w.x, w.y, 30, dmg * 0.9, true);
      G.wakes.splice(i, 1);
      continue;
    }
    // 灼伤（同样按时间戳节流，不然一条带子一帧打几十次）
    if (G.t - (w.hitT || 0) > 0.16) {
      let hit = false;
      forNear(w.x, w.y, w.r + 12, e => {
        if (e.dead || e.hp <= 0) return;
        const d = Math.hypot(e.x - w.x, e.y - w.y);
        if (d < w.r + e.r) {
          damageEnemy(e, dmg * 0.55, (e.x - w.x) / (d || 1), (e.y - w.y) / (d || 1), false, 0.3, true);
          hit = true;
        }
      });
      if (hit) w.hitT = G.t;
    }
    // 消解敌弹
    for (let j = G.ebullets.length - 1; j >= 0; j--) {
      const b = G.ebullets[j];
      if (Math.hypot(b.x - w.x, b.y - w.y) < w.r + b.r) {
        burst(b.x, b.y, 3, [gold > 1 ? '#ffcd75' : '#73eff7'], 40, .16, 1);
        G.ebullets.splice(j, 1);
      }
    }
  }
}

// 轨道长枪的视觉残留：伤害在 fireLance 里一次结算完，这里只负责淡出
function updateLances(dt) {
  for (let i = G.lances.length - 1; i >= 0; i--) {
    const L = G.lances[i];
    L.t += dt;
    if (L.t >= L.life) G.lances.splice(i, 1);
  }
}

// ============ 子弹 ============
function updateBullets(dt) {
  buildGrid();
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    // --- 普通子弹基础手感：出膛快、临终慢 ---
    // 只在 decel 弹上生效（主炮 / 散射 / 尾炮）；制导 / 弹片 / 无人机走各自逻辑不动。
    // 前 BDECEL_T 的寿命保持初速，之后线性收到 BDECEL_S（临终只剩 45% 初速），
    // 视觉上就是「飞出去猛，快没劲儿了慢慢飘」，不影响判定半径 / 伤害。
    if (b.decel) {
      const lf = b.life0 > 0 ? b.life / b.life0 : 0;   // 剩余寿命比例：1 → 0
      const f = lf >= BDECEL_T ? 1 : BDECEL_S + (1 - BDECEL_S) * (lf / BDECEL_T);
      const sp = b.sp0 * f;
      b.vx = Math.cos(b.ang) * sp; b.vy = Math.sin(b.ang) * sp;
    }
    // --- 制导：每隔 0.12 秒才重新找一次目标 ---
    // ⚠️ 每帧都 nearest(homeR 满级 204) 的话是 (204/24)²≈72 个格子 × 场上每发弹，
    //    装上制导就等于给整个弹幕系统加了一层固定开销。按弹缓存目标后开销降到 1/7。
    //    ⚠️ homeR 曾经开到 260 并且配上 4.7 rad/s 的转弯速率 —— 那是「全图追踪」：
    //       弹从屏幕这一头飞出去，能绕回来追三个人。2026-10-03 三处一起收，见 guided 卡注释。
    if (b.homing) {
      b.retarget -= dt;
      if (b.retarget <= 0 || !b.tgt || b.tgt.dead || b.tgt.hp <= 0) {
        b.retarget = 0.12;
        b.tgt = nearest(b.x, b.y, G.S.homeR, null);
      }
      const t = b.tgt;
      if (t) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        let da = ((want - b.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const turn = b.homing * (synOn('guidedPierce') ? 1.3 : 1);
        b.ang += clamp(da, -turn * dt, turn * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(b.ang) * sp; b.vy = Math.sin(b.ang) * sp;
      }
    }
    singBend(b, SING.BULLET_TURN, dt);   // 视界：引力弯曲弹道
    lensBend(b, dt, 1);                  // 奇点区：折射带（穿带就持续偏折）
    const mvx = b.vx * dt, mvy = b.vy * dt;
    b.x += mvx; b.y += mvy;
    // 地形：撞上就结算（可破坏岩掉血 / 骨架墙火花）并吃掉这一发；
    //   结晶回廊里骨架墙是**弹开**而不是吃掉（own=true 才享受这条）。
    // ⚠️ 必须在出界回收**之前** —— 否则贴着世界边缘的块永远打不到。
    if (G.terr.length && terrBullet(b, b.x, b.y, true)) { G.bullets.splice(i, 1); continue; }
    // --- 制导弹的「失坠」：飞够里程就自己熄灭 ---
    // ⚠️ 只在 G.S.homeTrav > 0 时启用 —— 没装制导弹药的普通弹不该被限。
    if (b.homing && G.S.homeTrav > 0) {
      b.trav += Math.hypot(mvx, mvy);
      // ⚠️ 乘 rangeMul：口径校准是「弹丸飞得更远」的卡，它该让制导弹也受益，
      //    否则装了口径反而出现「射程卡把制导玩短」的倒错。
      const limit = G.S.homeTrav * G.S.rangeMul;
      if (b.trav > limit) { expireBullet(b, i); continue; }
    }
    if (b.life <= 0) { G.bullets.splice(i, 1); continue; }
    // --- 出界：跳弹先在**视口**边缘反弹，没次数了才在**世界**边界回收 ---
    // ⚠️⚠️ 这两件事必须分开算，而且回收边界（WORLD ± 60）必须比敌人的硬夹取
    //    （WORLD ± EDGE=20）更靠外 —— 否则又会出现「敌人站在世界角落、子弹够不着」
    //    的不死敌人，updateWave 的「场上清空」永远不成立 → 整段卡死。
    //    实测过：边界写成同一组数字时，敌人贴边就变成无敌。
    // 反弹点用视口：玩家看到的还是「子弹撞到屏幕边弹回来」，和世界放大之前一模一样。
    const outV = b.x < viewL() - 20 || b.x > viewR() + 20 || b.y < viewT() - 20 || b.y > viewB() + 20;
    if (outV && b.bounce > 0) {
      b.bounce--;
      if (b.x < viewL() - 20 || b.x > viewR() + 20) { b.vx = -b.vx; b.x = clamp(b.x, viewL() - 19, viewR() + 19); }
      if (b.y < viewT() - 20 || b.y > viewB() + 20) { b.vy = -b.vy; b.y = clamp(b.y, viewT() - 19, viewB() + 19); }
      b.ang = Math.atan2(b.vy, b.vx);
      b.tgt = null; b.retarget = 0;
      b.bounced = true;
      b.bounceN = (b.bounceN || 0) + 1;     // 跳弹Boost 用（见命中那段）
      b.life = Math.max(b.life, 0.55);   // 别刚弹回来就寿终，那玩家根本看不见这一跳
      burst(b.x, b.y, 3, ['#73eff7', '#f4f4f4'], 46, .18, 1);
    } else if (b.x < -60 || b.x > WORLD.w + 60 || b.y < -60 || b.y > WORLD.h + 60) {
      G.bullets.splice(i, 1); continue;
    }
    // 命中（gridR 仍按 14 取格子，实际判定半径是 e.r + b.r —— 两件事分开，别合并）
    const hit = firstHit(b.x, b.y, 14, b.r);
    if (!hit) continue;
    const S = G.S;
    // 爆头协议：b.crit 为 true 时**必定**暴击，绕开随机判定（见 pBullet 的 o.crit）
    const crit = b.crit === true ? true : Math.random() < S.crit;
    // 跳弹的回报（2026-10-03 加强）：弹过一次 +bounceBoost，按**已弹次数**累加。
    // ⚠️ 用独立的 bounceN 计数，不要拿 b.bounce 反推 —— 那是「还剩几次」，
    //    而且中途拿卡会让剩余次数变化，反推出来的伤害会莫名其妙地涨。
    const dmg = b.dmg * (1 + (S.bounceBoost || 0) * (b.bounceN || 0))
      * (crit ? (synOn('pierceCrit') ? 3.3 : S.critMul) : 1);
    const a = Math.atan2(b.vy, b.vx);
    damageEnemy(hit, dmg, Math.cos(a), Math.sin(a), crit, 0.6);
    if (b.blast) {
      const R = (26 + b.blast * 12) * S.blastMul * (synOn('cluster') ? 1.3 : 1)
        * (b.bounced && synOn('bounceBlast') ? 1.35 : 1);
      explode(b.x, b.y, R, b.dmg * (0.5 + b.blast * 0.22), R < 40);
    }
    burst(b.x, b.y, crit ? 7 : 3, crit ? ['#ffcd75', '#f4f4f4'] : ['#73eff7', '#f4f4f4'], 70, .25, 1);
    // 裂变弹芯：只在**首次**命中时炸成弹片（b.fissioned 保证只发生一次 ——
    // 不设这个闸，一颗带穿透的裂变弹会在每个目标上各炸一轮，直接变成无限弹幕）。
    // 弹片用极短的 life 而不是让它继续飞：它是「命中点周围一圈」的二次杀伤，不是第二发炮弹。
    // 弹片**不继承穿透**（否则一颗弹滚出去几十个目标），但按协同继承 1 次反弹与爆炸。
    if (b.fission > 0 && !b.fissioned) {
      b.fissioned = true;
      const sn = b.fission, off = rand(TAU);
      for (let k = 0; k < sn; k++) {
        const sa = off + k / sn * TAU;
        pBullet(b.x, b.y, sa, 195, b.dmg * b.fissionMul, {
          r: 2, life: 0.34, homing: 0, pierce: 0,
          // ⚠️ fission 必须显式置 0。pBullet 里是 `o.fission ?? G.S.fission`，
          //    不传的话弹片会继承当前等级，于是「弹片命中再裂变」→ 指数级弹幕爆炸。
          fission: 0,
          bounce: synOn('bounceFission') ? 1 : 0,
          blast: synOn('fissionBoom') ? 1 : 0,
          kind: 'shard',
        });
      }
      ring(b.x, b.y, 9, G.S.fissionGold ? '#ffcd75' : '#ef7d57', .16, 1);
    }
    if (b.pierce > 0) { b.pierce--; }
    else G.bullets.splice(i, 1);
  }
}

function updateEBullets(dt) {
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    b.t += dt; b.life -= dt;
    // 追命弹：出生 0.6s 内直线飞行（**必须先给它一段「看得出它在追谁」的窗口**），
    //   之后才开始拐。一开始就在拐的话，玩家只觉得自己被锁定了却不知道该往哪跑。
    if (b.homing && b.t > 0.6) {
      const want = Math.atan2(G.py - b.y, G.px - b.x);
      let da = want - Math.atan2(b.vy, b.vx);
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      const step = clamp(da, -b.homing * dt, b.homing * dt);
      const cs = Math.cos(step), sn = Math.sin(step);
      const nvx = b.vx * cs - b.vy * sn, nvy = b.vx * sn + b.vy * cs;
      b.vx = nvx; b.vy = nvy;
      // 转向时掉一点速度：拐弯总要付出代价，也让它不至于越改越快
      b.vx *= 1 - 0.35 * dt; b.vy *= 1 - 0.35 * dt;
    }
    singBend(b, SING.EBULLET_TURN, dt);  // 视界：敌弹也弯（系数减半，保住弹幕可读性）
    lensBend(b, dt, HZ.LENS_EB);         // 奇点区：敌弹也过折射带，但只有六成 —— 弹幕必须读得懂
    b.x += b.vx * dt; b.y += b.vy * dt;
    // 地形：敌弹被掩体吃掉 —— 「躲到石头后面是真的安全」就靠这一行
    if (G.terr.length && terrAt(b.x, b.y)) {
      burst(b.x, b.y, 4, ['#8b93a8', '#c0cbdc'], 60, .22, 1);
      G.ebullets.splice(i, 1); continue;
    }
    // 敌弹按**视口**回收（外扩 80）：玩家永远在视口里，敌弹也都是从视口内打出来的，
    // 出画之后再飞没有任何意义，反而白占 900 发的上限。
    // ⚠️ 和玩家子弹不一样 —— 玩家子弹必须够得到世界里的任何敌人，所以那条挂在 WORLD 上。
    if (b.life <= 0 || b.x < viewL() - 80 || b.x > viewR() + 80 || b.y < viewT() - 80 || b.y > viewB() + 80) { G.ebullets.splice(i, 1); continue; }
    const dx = b.x - G.px, dy = b.y - G.py, rr = b.r + 7;
    const dd = dx * dx + dy * dy;
    if (dd < rr * rr) {
      hurtPlayer(b.dmg || 9);
      burst(b.x, b.y, 8, ['#ff3355'], 90, .3, 2);
      G.ebullets.splice(i, 1); continue;
    }
    // 擦弹：贴着过去给能量
    const gr = rr + 9;
    if (dd < gr * gr) {
      G.grazeT -= dt;
      if (G.grazeT <= 0) {
        G.grazeT = 0.12;
        G.energy = Math.min(100, G.energy + 1.1);
        Sound.sfx.graze();
        part({ x: b.x, y: b.y, vx: 0, vy: 0, life: .18, max: .18, col: '#73eff7', size: 1, drag: 1 });
      }
    }
  }
}

// ============ 拾取物 ============
function addXp(v) {
  G.xp += v; G.dust += v;
  G.score += v * 2;
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = Math.round(8 + G.level * 4.5 + G.level * G.level * 0.35);
    Sound.sfx.levelup();
    openUpgrade();
  }
}
/* 星尘吸附（作者 2026-10-03：「基础吸附范围至少要比战机体型大一圈」）。
   基准 78px：船体像素精灵是 44×32（半宽 22），78 ≈ 三倍半宽，确实是「大出一圈」
   （旧基准 46，刚够包住机身，动起来基本兜不住）。
   ⚠️ 光把半径调大是**没用**的 —— 旧的写法是「每帧给加速度 + `p.vx *= 0.9` 的固定沉减」，
      稳态速度被压到 `9 × pull × dt ≈ 0.15 × pull`：边缘 13px/s、贴脸也只有 58px/s，
      而船的满速 168px/s —— 星尘根本**追不上在移动的船**，看上去就是「吸不到」。
      现在场内直接给位移，速度 220..430px/s：一定追得上，也保留「越近越快」的手感。 */
const MAG_SPD_MIN = 220, MAG_SPD_MAX = 430;
const PICK_R = 11;      // 拾取判定半径（沿用旧值：它是「贴到船身」的距离，不是吸附半径）
function updatePickups(dt) {
  // 磁力线圈质变后全屏吸附
  const S = G.S, R = S.autoPull ? 420 : S.magnet;
  const drift = Math.pow(0.9, dt * 60);   // 旧 `*= 0.9` 是「每帧」，改成与帧率无关
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i];
    p.t += dt; p.life -= dt;
    if (p.life <= 0) { G.pickups.splice(i, 1); continue; }
    const dx = G.px - p.x, dy = G.py - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < R) {
      // 场内：位移由磁场直接给定，不走 vx/vy 的沉减 —— 否则会被拖成追不上的慢动作
      const sp = MAG_SPD_MIN + (MAG_SPD_MAX - MAG_SPD_MIN) * (1 - d / R);
      p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
    } else {
      p.vx *= drift; p.vy *= drift;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // 视界：星尘也在往奇点里掉。⚠️ 吸得比玩家更快（×1.25）——
    //   这一段抢星尘的拉锯必须**奇点占优**，否则「冒着被吞的风险去够一份」就不成立了。
    if (G.sing) {
      const sx = G.sing.x - p.x, sy = G.sing.y - p.y, sd = Math.hypot(sx, sy) || 1;
      if (sd < SING.PULL_R) {
        const sp = SING.DRIFT * 1.25 * G.sing.mul * clamp(1 - sd / SING.PULL_R, 0.1, 1);
        p.x += sx / sd * sp * dt; p.y += sy / sd * sp * dt;
        if (sd < G.sing.r) {
          G.pickups.splice(i, 1);
          feedSing(p.type === 'dust' ? SING.FEED_DUST : SING.FEED_DUST * 2);
          Sound.sfx.dust();
          continue;
        }
      }
    }
    p.x = clamp(p.x, 4, WORLD.w - 4); p.y = clamp(p.y, 4, WORLD.h - 4);
    if (d < PICK_R) {
      G.pickups.splice(i, 1);
      if (p.type === 'dust') {
        addXp(p.v); Sound.sfx.dust();
        // 回收形态的进度（见 FORMS 注释）：捡到几份才算数，按「份」不按经验值 ——
        //   星尘有大小两种（v=1 / v=3），按 v 算的话一份大的顶三份，需求量就没意义了。
        if (G.waveForm === 'salvage') G.dustGot++;
        // 纳米修复质变 / 回收循环协同：拾取顺带回血
        const heal = S.dustHeal + (synOn('recycle') ? 1.2 : 0);
        if (heal > 0 && S.hp < S.maxHp) S.hp = Math.min(S.maxHp, S.hp + heal);
      }
      else if (p.type === 'heal') {
        const h = Math.min(S.maxHp - S.hp, S.maxHp * 0.25);
        if (h > 0.5) { S.hp += h; floatText(G.px, G.py - 14, '+' + Math.round(h), '#a7f070', .8); }
        Sound.sfx.heal();
      }
      burst(p.x, p.y, 4, ['#ffcd75'], 60, .25, 1);
    }
  }
}

// ============ 粒子 / 特效 ============
function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt;
    // ⚠️ 粒子顺序无关 → 用「交换弹出」代替 splice。
    //    splice 在接近上限（MAXP=1500）的数组上是 O(n) 整段搬移，一帧死掉上百个就是 O(n²)，
    //    profile 里 updateParts 自身占到 11% 主要就是这个，不是那几行算术。
    if (p.life <= 0) { const last = G.parts.pop(); if (i < G.parts.length) G.parts[i] = last; continue; }
    if (p.num !== undefined) { p.vy += 26 * dt; }
    p.vx *= 1 - Math.min(0.9, (p.drag || 3) * dt);
    p.vy *= 1 - Math.min(0.9, (p.drag || 3) * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    f.t += dt;
    if (f.type === 'laser') {
      // 蓄力 0.5s 后开火 0.35s，沿线判定
      const fireAt = 0.5;
      // 旋转激光（巨像的「十字扫射」）：预警段也要跟着转 ——
      //   玩家是按预警线的方向站位的，只让开火后旋转等于骗了他。
      if (f.spin) f.ang += f.spin * dt;
      if (!f.fired && f.t >= fireAt) {
        f.fired = true;
        const dx = Math.cos(f.ang), dy = Math.sin(f.ang);
        const dd = Math.abs((G.px - f.x) * -dy + (G.py - f.y) * dx); // 点到直线距离
        if (dd < f.w + 7) hurtPlayer(16);
        addShake(5);
      }
    }
    // 同上：特效之间也没有顺序依赖，交换弹出省掉 splice 的 O(n) 搬移
    if (f.t >= f.life) { const last = G.fx.pop(); if (i < G.fx.length) G.fx[i] = last; }
  }
  for (let i = G.banners.length - 1; i >= 0; i--) { G.banners[i].t += dt; if (G.banners[i].t > G.banners[i].life) G.banners.splice(i, 1); }
  for (let i = G.toasts.length - 1; i >= 0; i--) { G.toasts[i].t += dt; if (G.toasts[i].t > G.toasts[i].life) G.toasts.splice(i, 1); }
}

/* ============ 地形（2026-10-21）：可躲闪的静态场地 ============
   之前整个战场是一块**空矩形** —— 走位的全部意义只有「拉开距离」，躲弹永远靠速度。
   现在每段航程铺一套静态地形，把「绕到掩体后面」变成一种真能做的动作：

     core  骨架墙    挡人挡弹，**打不碎**（构成本段的骨架，通道不会消失）
     rock  可破坏岩   挡人挡弹，能打碎（碎了掉星尘 —— 也能自己轰出一条近路）
     vent  能量喷口   **不挡**任何东西，但会周期性喷发，谁站在上面谁掉血

   ⚠️ 三条硬约束，破了任意一条都是「整局卡死」，而且一行报错都没有：
     ① **不许出现封闭区域**。清剿 / 死斗是「杀光才过段」，一只敌人被关在墙里 =
        子弹打不到、玩家进不去（看不到它）→ 这一段永远结束不了。
        所以布局一律用「贯通式」：墙不到世界边，缺口**恒在中央附近**。
     ② **通道宽度 ≥ 44px**。船体半宽 22，通道比它窄就等于把路堵死。
        现在最窄的缺口也有 144px，柱子之间 120px。
     ③ **开段时玩家脚边 92px 内不许有块**。开段那一刻玩家在哪是不确定的
        （上一段打完他可能贴在世界角落），凭空扣在他身上会直接卡住。

   ⚠️ 和 `G.walls`（风之障壁）是**两套东西**，别混：
       G.walls 是模块卡生成的**临时**拦截线（有 life、只吞敌弹）；
       G.terr  是**关卡地形**（整段存在、挡人也挡弹）。 */
const TB = 24;          // 地块最小粒度（= tile 尺寸）；所有块对齐到它
const TCELL = 24;       // 地形索引格（与 TB 同值：一格 = 一张 tile）
const TMAP = new Map(); // 格 -> 覆盖它的块列表（静态，只在地形增删时重建）
const tkey = (cx, cy) => (cx + 4096) * 8192 + (cy + 4096);
// 能量喷口：不挡路不挡弹，周期性喷一圈火 —— 这是「可交互的背景」那一层，
// 玩家的用法是**把敌人引上去**，或者在它预警时别站那儿。
const VENT = { R: 30, DMG: 8, EDMG: 14, CYCLE: 3.4, WARN: 1.0, BLOW: 0.9, TICK: 0.34 };

const LAYOUTS = {
  open:    { name: '空域',   nameEn: 'OPEN',       build: null },
  pillars: { name: '柱林',   nameEn: 'PILLARS',    build: terrPillars },
  maze:    { name: '回廊',   nameEn: 'CORRIDORS',  build: terrMaze },
  cells:   { name: '蜂室',   nameEn: 'CELLS',      build: terrCells },
  cross:   { name: '四象限', nameEn: 'QUADRANTS',  build: terrCross },
  ring:    { name: '环带',   nameEn: 'RING',       build: terrRing },
};
// 主线 12 段的地形编排。三条规定：
//   · 1、2 段**空域** —— 前两段还在教基本操作，先别塞走位题。
//   · 4/8/12 巨像段走空域（bossId 那条分支兜住）：巨像体积大、要绕侧后方输出，
//     场地一挤它就变成「卡在两块石头中间抽搐」。
//   · 相邻两段不重复 —— 连续两段同样的柱林会把「换段了」这件事抹掉。
// ⚠️ 这张表现在**只剩例外**：第 1 段空域（第一枪还在教基本操作，别塞走位题）。
//    其余全走主题的 `terrain` —— 一个星区一套骨架，玩家认得出「我又进了熔炉」。
const MAIN_LAYOUTS = { 1: 'open' };
/* 星区序号。**必须和 startWave 里算 G.zone 的是同一个函数** —— 分头算就会
   「背景是熔炉、地形铺着结晶」（布局现在由主题决定，两者只要错开一次就穿帮）。 */
const zoneIndexFor = w => {
  const i = ZONES.findIndex(zz => w >= zz.from && w <= zz.to);
  // 无尽：13 段起进**结晶回廊**（新主题当无尽的第一份见面礼），之后五区循环
  return i >= 0 ? i : (w - ENDLESS_FROM + 4) % ZONES.length;
};
function layoutForWave(w, bossId) {
  if (bossId) return 'open';                                  // 巨像段：场地一挤它就卡在石头中间抽搐
  if (w <= WAVES && formForWave(w) === 'horizon') return 'open'; // 视界段：奇点自己就是场地
  // 其余一律按**主题**来 —— 看到这套骨架就知道自己在哪个区
  return MAIN_LAYOUTS[w] || ZONES[zoneIndexFor(w)].terrain;
}

/* 加一块地形。所有布局都只调这一个入口 —— 三条硬约束集中在里面，
   改布局的人不可能绕过它们。 */
function terrAdd(x, y, w, h, kind) {
  x = Math.round(x / TB) * TB; y = Math.round(y / TB) * TB;
  w = Math.max(TB, Math.round(w / TB) * TB); h = Math.max(TB, Math.round(h / TB) * TB);
  const M = 48;
  if (w > WORLD.w - M * 2 || h > WORLD.h - M * 2) return null;
  x = clamp(x, M, WORLD.w - M - w); y = clamp(y, M, WORLD.h - M - h);
  // ③ 玩家脚边留空：块矩形到玩家的最近距离
  const nx = clamp(G.px, x, x + w), ny = clamp(G.py, y, y + h);
  if (Math.hypot(G.px - nx, G.py - ny) < 92) return null;
  const hp = kind === 'rock' ? Math.round(52 * (1 + Math.min(G.wave, WAVES) * 0.15)) : 0;
  const b = { kind, x, y, w, h, hp, maxHp: hp, seed: irand(0, 3), flash: 0 };
  // ⚠️ 贴图要带 zone：熔炉铺冰晶这种错一旦发生，整个主题就白做了
  if (kind !== 'vent') b.cv = bakeSlab(kind, w, h, b.seed, G.zone);
  G.terr.push(b);
  return b;
}

// ---- 五种布局 ----
// ⚠️ 全部按「世界中心的偏移」写，不写死坐标 —— 世界尺寸改了这些布局照样成立。
/* ⚠️ 密度的单位是「**每个视口**有多少块」，不是「整个世界有多少块」。
   世界是视口的 9 倍（3×3），玩家一屏只看见 1/9 —— 20 块铺满世界 = 一屏两块，
   那根本读不出「这里有地形」。所以每套布局都按 **30 块上下** 铺，
   一屏稳定有 3~5 块可躲的东西。探针里有「采样三个位置数视口内块数」的硬断言守着。 */
function terrPillars() {
  const cx = WORLD.w / 2, cy = WORLD.h / 2, gx = 132, gy = 150;
  for (let i = -5; i <= 5; i++) for (let j = -2; j <= 2; j++) {
    if (Math.random() < 0.36) continue;
    // 柱子最长 60：间距 132 − 60 = 72 的通道，船（判定直径 24）钻得过去还有富余
    const vert = Math.random() < 0.5;
    const long = Math.random() < 0.5 ? 60 : 36;
    terrAdd(cx + i * gx - (vert ? 12 : long / 2), cy + j * gy - (vert ? long / 2 : 12),
      vert ? 24 : long, vert ? long : 24, Math.random() < 0.42 ? 'core' : 'rock');
  }
}
function terrMaze() {
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  // 横墙铺满中段、竖墙只在外侧 —— 两者**永不相交**，就不可能围出封闭房间。
  // 缺口恒在中间附近（±1 段）：中央永远是通的，敌人不会被关在里面。
  const seg = 72, gap = 2;
  const run = (horiz, fixed, from, to) => {
    const n = Math.floor((to - from) / seg);
    if (n < gap + 2) return;
    const skip = clamp(Math.floor(n / 2) - 1 + irand(-1, 1), 0, n - gap);
    for (let i = 0; i < n; i++) {
      if (i >= skip && i < skip + gap) continue;
      const p = from + i * seg;
      if (horiz) terrAdd(p, fixed, seg, 24, Math.random() < 0.7 ? 'core' : 'rock');
      else terrAdd(fixed, p, 24, seg, Math.random() < 0.7 ? 'core' : 'rock');
    }
  };
  run(true, cy - 234, cx - 432, cx + 432);
  run(true, cy, cx - 432, cx + 432);
  run(true, cy + 234, cx - 432, cx + 432);
  run(false, cx - 504, cy - 288, cy + 288);
  run(false, cx + 504, cy - 288, cy + 288);
}
function terrCells() {
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  // 两横两竖围出六个隔间，缺口恒在中央。四角会碰头，但**中央永远有口**。
  const seg = 72, gap = 2;
  const run = (horiz, fixed, from, to) => {
    const n = Math.floor((to - from) / seg);
    if (n < gap + 2) return;
    const skip = clamp(Math.floor(n / 2) - 1 + irand(-1, 1), 0, n - gap);
    for (let i = 0; i < n; i++) {
      if (i >= skip && i < skip + gap) continue;
      const p = from + i * seg;
      if (horiz) terrAdd(p, fixed, seg, 24, Math.random() < 0.34 ? 'core' : 'rock');
      else terrAdd(fixed, p, 24, seg, Math.random() < 0.34 ? 'core' : 'rock');
    }
  };
  run(true, cy - 162, cx - 396, cx + 396);
  run(true, cy + 162, cx - 396, cx + 396);
  run(false, cx - 396, cy - 288, cy + 288);
  run(false, cx + 396, cy - 288, cy + 288);
  // 每个隔间里再摆一段短隔断：只有四条长墙的话，「蜂室」读起来就是四道栅栏
  for (const sx of [-1, 1]) for (const sy of [-1, 0, 1]) {
    terrAdd(cx + sx * 216 - 48, cy + sy * 216 - 108, 96, 24, 'rock');
  }
}
function terrCross() {
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  // 中心十字把场地切成四个象限 —— 四角都通向世界边缘，没有死路。
  terrAdd(cx - 288, cy - 12, 576, 24, 'core');
  terrAdd(cx - 12, cy - 216, 24, 432, 'core');
  // 每个象限里再放一道横的 + 一道竖的短墙：离开中心也不能立刻变成空地
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    terrAdd(cx + sx * 216 - 108, cy + sy * 168 - 12, 216, 24, 'rock');
    terrAdd(cx + sx * 216 - 12, cy + sy * 168 - 54, 24, 108, 'rock');
  }
  // 四角的大块掩体（骨架 / 可破坏各半）
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    terrAdd(cx + sx * 384 - 48, cy + sy * 240 - 24, 96, 48, Math.random() < 0.5 ? 'core' : 'rock');
  }
  // 象限外缘再补一圈：只有中心那两道的话，跑到世界边上就是纯空地
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    terrAdd(cx + sx * 336 - 84, cy + sy * 288 - 12, 168, 24, 'rock');
    terrAdd(cx + sx * 336 - 12, cy + sy * 288 - 60, 24, 120, 'core');
  }
}
function terrRing() {
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  terrAdd(cx - 96, cy - 96, 192, 192, 'core');            // 中央方核
  terrAdd(cx - 12, cy - 240, 24, 144, 'core');            // 四条辐条
  terrAdd(cx - 12, cy + 96, 24, 144, 'core');
  terrAdd(cx - 240, cy - 12, 144, 24, 'core');
  terrAdd(cx + 96, cy - 12, 144, 24, 'core');
  // 内环四块（可破坏）：核与外圈之间那一圈，绕着核心跑的时候能顺手轰掉
  for (const o of [[-216, -216], [120, -216], [-216, 120], [120, 120]]) {
    terrAdd(cx + o[0], cy + o[1], 96, 96, 'rock');
  }
  // 外环四段弧
  for (const o of [[-432, -264], [336, -264], [-432, 168], [336, 168]]) {
    terrAdd(cx + o[0], cy + o[1], 168, 24, 'rock');
  }
  // 远角四块：走到世界边上也不会是无掩体的空地
  for (const o of [[-528, -120], [456, -120], [-528, 0], [456, 0]]) {
    terrAdd(cx + o[0], cy + o[1], 72, 120, Math.random() < 0.5 ? 'core' : 'rock');
  }
  // 对角四块：把「环」补成环，而不是十字加四个角
  for (const o of [[-300, -300], [228, -300], [-300, 228], [228, 228]]) {
    terrAdd(cx + o[0], cy + o[1], 72, 72, 'rock');
  }
}
// 喷口：找一个离所有块 ≥ R+24、离玩家 ≥150 的位置。找不到就少放一个（不硬塞）。
function terrVents(n) {
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 24; tries++) {
      const x = rand(120, WORLD.w - 120), y = rand(120, WORLD.h - 120);
      if (Math.hypot(x - G.px, y - G.py) < 150) continue;
      let bad = false;
      for (const b of G.terr) {
        if (b.kind === 'vent') continue;
        const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
        if (Math.hypot(x - nx, y - ny) < VENT.R + 24) { bad = true; break; }
      }
      if (bad) continue;
      G.terr.push({ kind: 'vent', x: Math.round(x), y: Math.round(y), r: VENT.R, ph: 0, t: rand(0, VENT.CYCLE), tick: 0 });
      break;
    }
  }
}

function buildTerrain(w, bossId) {
  G.terr.length = 0;
  const id = layoutForWave(w, bossId);
  G.layout = id;
  const ly = LAYOUTS[id];
  if (ly && ly.build) {
    ly.build();
    // 熔炉区喷口翻倍 ——「地面会烧」这件事要铺够密度才成立，两口喷发玩家根本不会绕
    const nz = (w >= 5 ? 3 : 2) * (ZONES[zoneIndexFor(w)].haz === 'forge' ? HZ.FORGE_VENT : 1);
    terrVents(nz);
  }
  terrIndex();
  // 报地形（空域不报：场上没东西就不必占一行提示）
  if (id !== 'open' && ly) toast(T('bn.terr'), L(ly, 'name'), '#c0cbdc', 2.4);
  // 报机制：只报名字 + 一句「要你做什么」，不写数值（数值玩家打两秒就懂）
  const hz = ZONES[zoneIndexFor(w)].haz;
  if (hz && id !== 'open' && !(bossId || formForWave(w) === 'horizon')) {
    const H = HAZARDS[hz];
    toast(L(H, 'name'), T('hz.' + hz), '#ffcd75', 3.2);
  }
}

// ---- 索引 / 查询 ----
// ⚠️ 地形是**静态**的，所以可以建一次索引一直用；只有打碎一块时才需要重建。
//    每帧对每个实体去遍历几十个块做 AABB 是纯浪费 —— 弹幕一多就是几千次。
function terrIndex() {
  TMAP.clear();
  for (const b of G.terr) {
    if (b.kind === 'vent') continue;
    const x0 = Math.floor(b.x / TCELL), x1 = Math.ceil((b.x + b.w) / TCELL) - 1;
    const y0 = Math.floor(b.y / TCELL), y1 = Math.ceil((b.y + b.h) / TCELL) - 1;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const k = tkey(cx, cy);
      let a = TMAP.get(k);
      if (!a) TMAP.set(k, a = []);
      a.push(b);
    }
  }
}
function terrAt(x, y) {
  const a = TMAP.get(tkey(Math.floor(x / TCELL), Math.floor(y / TCELL)));
  if (!a) return null;
  for (const b of a) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  return null;
}
/* 圆 vs 实心块：返回**穿透最深**的那一块和推出法线。
   ⚠️ 圆心落在块内的情况必须单独处理（dx=dy=0，没有法线可言）——
      那是「高速冲刺直接穿进去了一半」，此时沿最短的那条轴推出去。 */
function terrPush(x, y, r) {
  const cx = Math.floor(x / TCELL), cy = Math.floor(y / TCELL);
  let out = null;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const a = TMAP.get(tkey(cx + i, cy + j));
    if (!a) continue;
    for (const b of a) {
      const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
      let dx = x - nx, dy = y - ny;
      let d = Math.hypot(dx, dy);
      let ux, uy;
      if (d > 0.001) { ux = dx / d; uy = dy / d; }
      else {
        const dl = x - b.x, dr = b.x + b.w - x, dt = y - b.y, db = b.y + b.h - y;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) { ux = -1; uy = 0; d = -dl; }
        else if (m === dr) { ux = 1; uy = 0; d = -dr; }
        else if (m === dt) { ux = 0; uy = -1; d = -dt; }
        else { ux = 0; uy = 1; d = -db; }
      }
      const pen = r - d;
      if (pen <= 0) continue;
      if (!out || pen > out.pen) out = { b, nx: ux, ny: uy, pen };
    }
  }
  return out;
}
// 射线：沿 ang 步进，返回撞上地形之前的长度（没撞到就返回 maxLen）。
// 光矛 / 瓦解射线靠它截断 —— 不截的话「隔着一道墙把墙后面的敌人烧了」，
// 而那面墙明明是玩家拿来挡弹的东西。
function terrRay(x, y, ang, maxLen) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let d = 8; d <= maxLen; d += 8) {
    if (terrAt(x + ca * d, y + sa * d)) return Math.max(0, d - 8);
  }
  return maxLen;
}

// ---- 解算 ----
function terrResolvePlayer() {
  // 判定半径 12：船体精灵 44×32（半宽 22），用圆去贴方块必然有一点点翼尖入墙，
  //   取 12 是「看着贴住了、又不会陷进去」的位置。别改大 —— 掩体通道是按这个数留的。
  const p = terrPush(G.px, G.py, 12);
  if (!p) return;
  G.px += p.nx * p.pen; G.py += p.ny * p.pen;
  // 法向速度吃掉、切向保留 = 贴着墙滑行（撞墙不是「撞停」）
  const dot = G.vx * p.nx + G.vy * p.ny;
  if (dot < 0) {
    G.vx -= p.nx * dot; G.vy -= p.ny * dot;
    if (-dot > 120) {
      addShake(1.1);
      burst(G.px, G.py, 3, ['#8b93a8', '#c0cbdc'], 60, .2, 1);
    }
  }
}
function terrResolveEnemy(e, spd, ux, uy, dt) {
  const p = terrPush(e.x, e.y, e.r * 0.75);
  if (!p) return;
  e.x += p.nx * p.pen; e.y += p.ny * p.pen;
  const dot = e.vx * p.nx + e.vy * p.ny;
  if (dot < 0) { e.vx -= p.nx * dot; e.vy -= p.ny * dot; }
  // 绕行：正对着墙的敌人切向速度是 0，只做上面的话它会**原地顶墙到天荒地老**，
  //   玩家隔着墙打不到它 → 清剿段永远结束不了。沿墙补一点切向推力，
  //   方向选「离玩家更近的那一侧」，看起来就是它自己在找路绕过来。
  const tx = -p.ny, ty = p.nx, s = (tx * ux + ty * uy) >= 0 ? 1 : -1;
  e.vx += tx * s * spd * 2.4 * dt; e.vy += ty * s * spd * 2.4 * dt;
}
// 巨像碾碎可破坏岩：它那么大一只，卡在两块石头中间抽搐比「碾过去」难看一百倍。
//   ⚠️ 骨架墙**不碾**（那是本段的骨架，boss 一撞就塌等于地形白做）—— 巨像直接穿过去。
function terrCrush(e) {
  for (let i = G.terr.length - 1; i >= 0; i--) {
    const b = G.terr[i];
    if (b.kind !== 'rock') continue;
    const nx = clamp(e.x, b.x, b.x + b.w), ny = clamp(e.y, b.y, b.y + b.h);
    if (Math.hypot(e.x - nx, e.y - ny) < e.r) terrBreak(b, i, true);
  }
}
function terrBreak(b, idx, byBoss) {
  const i = idx === undefined ? G.terr.indexOf(b) : idx;
  if (i < 0) return;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  burst(cx, cy, 18, ['#8b93a8', '#566c86', '#c0cbdc'], 140, .55, 2);
  for (let k = 0; k < 5; k++) {
    part({ x: cx + rand(-b.w / 2, b.w / 2), y: cy + rand(-b.h / 2, b.h / 2), vx: rand(-80, 80), vy: rand(-80, 80), life: .7, max: .7, col: '#566c86', size: 2, drag: 2.4 });
  }
  ring(cx, cy, Math.max(b.w, b.h) * 0.55, '#8b93a8', .3, 2);
  G.terr.splice(i, 1);
  terrIndex();   // ⚠️ 索引是静态的，拆掉一块必须整表重建，否则那块会继续挡住一切
  addShake(byBoss ? 3.2 : 2.2);
  Sound.sfx.crumble();
  if (!byBoss && Math.random() < 0.6) dropPickup('dust', cx, cy, 1);
}
/* 子弹撞地形。返回 true = 这一发被吃掉了。
   ⚠️ **敌弹也被挡** —— 这才是「可躲闪的地形」的全部价值：
      躲到掩体后面是真的安全，不是「看起来安全」。 */
function terrBullet(b, x, y, own) {
  const t = terrAt(x, y);
  if (!t) return false;
  /* ⑤ 结晶回廊：晶壁把**玩家的弹**弹回去，而不是吃掉。
     ⚠️ 只弹玩家弹 —— 敌弹也弹的话，你刚躲过的那一发会从背后追上来，那是耍赖不是机制。
     ⚠️ 有次数上限：两堵平行的墙之间不设闸会一直弹到子弹寿终（看得见但没意义）。
     ⚠️ 反弹后必须**把弹推到墙外**：留在块内的话下一帧又判一次，方向来回翻，弹原地抽搐。 */
  if (own && t.bounce && (b.bounceN || 0) < HZ.CRYSTAL_MAX) {
    const dl = x - t.x, dr = t.x + t.w - x, du = y - t.y, dd = t.y + t.h - y;
    const m = Math.min(dl, dr, du, dd);
    if (m === dl) { b.vx = -Math.abs(b.vx); b.x = t.x - 2; }
    else if (m === dr) { b.vx = Math.abs(b.vx); b.x = t.x + t.w + 2; }
    else if (m === du) { b.vy = -Math.abs(b.vy); b.y = t.y - 2; }
    else { b.vy = Math.abs(b.vy); b.y = t.y + t.h + 2; }
    b.ang = Math.atan2(b.vy, b.vx);      // decel 弹每帧由 ang 反推速度，不写这行反弹会被立刻抹掉
    b.bounced = true; b.bounceN = (b.bounceN || 0) + 1;   // 复用跳弹计数 —— bounceBoost 协同顺理成章地吃到
    b.life = Math.max(b.life, 0.5);
    burst(x, y, 5, ['#a8f0ff', '#f4f4f4'], 90, .24, 1);
    Sound.sfx.shield();
    return false;
  }
  if (t.kind === 'rock') {
    t.hp -= b.dmg; t.flash = 0.1;
    if (t.hp <= 0) terrBreak(t);
    else { burst(x, y, 3, ['#8b93a8', '#566c86'], 70, .22, 1); Sound.sfx.hit(); }
  } else {
    burst(x, y, 3, [ZONE_ACCENT[G.zone] || '#41a6f6', '#c0cbdc'], 70, .22, 1);
    Sound.sfx.shield();
  }
  return true;
}

// ---- 每帧 ----
function updateTerrain(dt) {
  if (!G.terr.length) return;
  for (let i = G.terr.length - 1; i >= 0; i--) {
    const b = G.terr[i];
    if (b.flash > 0) b.flash -= dt;
    if (b.kind !== 'vent') continue;
    b.t += dt;
    if (b.ph === 2) {
      b.tick -= dt;
      if (b.tick <= 0) { b.tick = VENT.TICK; ventBlow(b); }
      if (b.t >= VENT.BLOW) { b.ph = 0; b.t = 0; }
    } else if (b.ph === 1) {
      if (b.t >= VENT.WARN) {
        b.ph = 2; b.t = 0; b.tick = 0;
        Sound.sfx.vent(); addShake(1.6);
        burst(b.x, b.y, 14, ['#ffcd75', '#ef7d57', '#f4f4f4'], 150, .5, 2);
      }
    } else if (b.t >= VENT.CYCLE) { b.ph = 1; b.t = 0; }
  }
}
function ventBlow(v) {
  // ③ 恒星熔炉：喷完**留下一片火场** —— 喷口是「点」，火场是「面」。
  //    只有点的话玩家被喷一次就忘了；留下火场才逼他改走位路线。
  if (G.hz && G.hz.kind === 'forge') addFire(v.x, v.y, VENT.R + 10);
  for (let k = 0; k < 5; k++) {
    const a = rand(TAU), r = rand(4, VENT.R);
    part({
      x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r,
      vx: Math.cos(a) * 95, vy: Math.sin(a) * 95,
      life: .4, max: .4, col: pick(['#ffcd75', '#ef7d57', '#f4f4f4']), size: 2, drag: 2.6,
    });
  }
  const dx = G.px - v.x, dy = G.py - v.y;
  if (dx * dx + dy * dy < (VENT.R + 7) * (VENT.R + 7)) hurtPlayer(VENT.DMG);
  // 敌人也吃喷发 —— 把敌人引到喷口上是这套地形给玩家的第二件玩具
  for (const e of G.enemies) {
    if (e.dead || e.hp <= 0 || e.boss) continue;
    const ex = e.x - v.x, ey = e.y - v.y, d = Math.hypot(ex, ey) || 1;
    if (d > VENT.R + e.r) continue;
    damageEnemy(e, VENT.EDMG, ex / d, ey / d, false, 0.4, true);
  }
}

// ---- 绘制 ----
function drawTerrain() {
  if (!G.terr.length) return;
  const L = viewL() - 12, T = viewT() - 12, Rr = viewR() + 12, B = viewB() + 12;
  for (const b of G.terr) {
    if (b.x > Rr || b.x + b.w < L || b.y > B || b.y + b.h < T) continue;
    if (b.kind === 'vent') { drawVent(b); continue; }
    ctx.drawImage(b.cv, Math.round(b.x), Math.round(b.y));
    // 裂纹随伤害加深：不看血条也能判断「这块快碎了」
    if (b.kind === 'rock' && b.hp < b.maxHp) {
      const k = 1 - b.hp / b.maxHp;
      const n = k > 0.66 ? 3 : k > 0.33 ? 2 : 1;
      ctx.fillStyle = '#1a1c2c';
      for (let i = 0; i < n; i++) {
        const sx = b.x + 3 + ((b.seed * 7 + i * 11) % Math.max(1, b.w - 6));
        const sy = b.y + 2 + ((b.seed * 5 + i * 17) % Math.max(1, b.h - 5));
        const len = 4 + i * 3 + Math.round(k * 6);
        for (let s = 0; s < len; s++) ctx.fillRect(Math.round(sx + s * 0.7), Math.round(sy + s), 1, 1);
      }
    }
    if (b.flash > 0) {
      ctx.globalAlpha = Math.min(0.55, b.flash * 5);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(Math.round(b.x + 1), Math.round(b.y + 1), b.w - 2, b.h - 2);
      ctx.globalAlpha = 1;
    }
  }
}
function drawVent(v) {
  const t = 0.5 + Math.sin(G.t * 6) * 0.5;
  // 底座：暗环 + 内芯（常驻，随时看得见「这里有个东西」）
  // ⚠️ ringPx / disc 用的是**当前** strokeStyle / fillStyle，不是传参 —— 见「像素图元」那节。
  ctx.strokeStyle = '#3a4468'; ringPx(v.x, v.y, 13, 1);
  ctx.fillStyle = '#242a44'; disc(v.x, v.y, 6);
  ctx.fillStyle = v.ph === 0 ? '#ef7d57' : '#ffcd75';
  ctx.fillRect(Math.round(v.x) - 1, Math.round(v.y) - 1, 2, 2);
  if (v.ph === 1) {
    // 预警：环从内向外涨 + 闪烁。玩家要的是「还有多久炸」，所以让它**变大**而不是只变色。
    const k = v.t / VENT.WARN;
    ctx.strokeStyle = '#ffcd75';
    ctx.globalAlpha = 0.35 + t * 0.45;
    ringPx(v.x, v.y, Math.round(8 + k * (VENT.R - 8)), 1);
    ctx.strokeStyle = '#ef7d57';
    ctx.globalAlpha = 0.15 + t * 0.2;
    ringPx(v.x, v.y, Math.round(4 + k * 8), 2);
    ctx.globalAlpha = 1;
  } else if (v.ph === 2) {
    const k = v.t / VENT.BLOW;
    const r = 6 + k * VENT.R;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = '#ef7d57'; disc(v.x, v.y, r);
    ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = '#ffcd75'; disc(v.x, v.y, r * 0.6);
    ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = '#f4f4f4'; disc(v.x, v.y, r * 0.32);
    ctx.restore();
  }
}

/* ============ 星区场地机制（2026-10-23）============
   五条机制各改**一个不同的维度** —— 两条都只是「把你往某处推」的话，
   玩家只会说「又一个推的」，不会说「这个星区不一样」。
     drift   改空间（墙在动）      emp     改节奏（定时清屏 + 锁你自己的枪）
     forge   改地面（喷完留火场）  lens    改子弹（穿带就弯）
     crystal 改打法（你的弹会弹墙）
   ⚠️ 三条纪律：
     ① **巨像段 / 视界段不开任何机制**（bossId 与 horizon 分支里 startHazard(null)）——
        它们自己就是一段完整机制，再叠一层就是互相盖住，玩家谁也没看懂。
     ② 每条机制都**有代价**（EMP 救命但锁膛、折射敌我也弯、火场敌我也烧）——
        没有代价的场地效果不是玩法，是白给的增益。
     ③ 机制必须**可预期**：漂移是慢摆不是乱窜，EMP 有 1.4s 预警，火场有预警环。
        玩家躲不掉的东西不叫机制，叫意外。 */
const HZ = {
  DRIFT_AMP: 64, DRIFT_W: [0.42, 0.78],  // 慢摆：周期 8~15s，肉眼跟得上
  EMP_FIRST: 6.0, EMP_CYCLE: 9.5, EMP_WARN: 1.4, EMP_ROOT: 1.0,
  FORGE_VENT: 2,                          // 熔炉区喷口数量倍率
  LENS_N: 3, LENS_TURN: 2.4, LENS_EB: 0.6, // 折射：敌弹也弯，但只有六成，保住弹幕可读性
  CRYSTAL_MAX: 2,                         // 晶壁最多弹两次（不然两堵墙之间弹到寿终）
};
// 各主题的**强调色**：和 sprites.js 的 TERR_PAL.accent 一一对应（火花 / 描边 / 高光用它）
const ZONE_ACCENT = ['#41a6f6', '#e05cd0', '#ef7d57', '#8ad0ff', '#a8f0ff'];
function startHazard(kind) {
  G.hz = kind ? { kind: kind, t: 0, next: kind === 'emp' ? HZ.EMP_FIRST : 0, fx: 0, fired: 0, bands: null } : null;
  if (!kind) return;
  if (kind === 'drift') hzDriftInit();
  if (kind === 'crystal') hzCrystalInit();
  if (kind === 'lens') hzLensInit();
}
function updateHazard(dt) {
  const h = G.hz;
  if (!h) return;
  h.t += dt;
  if (h.fx > 0) h.fx -= dt;
  if (h.kind === 'drift') hzDrift(dt);
  else if (h.kind === 'emp') hzEmp(dt);
}
/* ① 漂移碎块：整块沿一个轴慢摆。
   ⚠️ **只让一半的块动** —— 全场都在动就没法瞄了，掩体和障碍只剩后者。
   ⚠️ 摆幅必须塞得进世界，塞不进就缩：把块甩出边界 = 一堵看不见的墙。 */
function hzDriftInit() {
  let i = 0;
  for (const b of G.terr) {
    if (b.kind === 'vent') continue;
    if ((i++ % 2) !== 0) continue;
    const horiz = Math.random() < 0.5, M = 48;
    const room = horiz ? Math.min(b.x - M, WORLD.w - M - (b.x + b.w)) : Math.min(b.y - M, WORLD.h - M - (b.y + b.h));
    const amp = Math.min(rand(HZ.DRIFT_AMP * 0.6, HZ.DRIFT_AMP), room);
    if (amp < 12) continue;
    b.mov = 1; b.ax = horiz ? 1 : 0; b.amp = amp; b.hx = b.x; b.hy = b.y;
    b.ph = rand(TAU); b.w0 = rand(HZ.DRIFT_W[0], HZ.DRIFT_W[1]);
  }
}
function hzDrift(dt) {
  let any = false;
  for (const b of G.terr) {
    if (!b.mov) continue;
    b.ph += dt * b.w0;
    const o = Math.sin(b.ph) * b.amp;
    if (b.ax) b.x = b.hx + o; else b.y = b.hy + o;
    any = true;
  }
  // ⚠️ 索引是静态的：块动了必须重建，否则它「在 A 处挡弹、在 B 处画着」。
  //    玩家解算也要跟一帧，不然块扫过玩家时会有一帧穿模。
  if (any) { terrIndex(); terrResolvePlayer(); }
}
/* ② EMP：定时清空全场敌弹 + 麻痹杂兵，代价是**你自己锁膛**。
   它是救命键，但按下它的不是你 —— 所以必须提前 1.4s 告诉你，让你决定
   「要不要趁着这一秒把敌人引到开阔地、或者干脆停火等它」。 */
function hzEmp(dt) {
  const h = G.hz;
  h.next -= dt;
  if (h.next > 0) return;
  const cleared = G.ebullets.length;
  G.ebullets.length = 0;
  let rooted = 0;
  for (const e of G.enemies) {
    // ⚠️ 巨像免疫（同「拘束立场」的那条）：站桩 1 秒且不开火的巨像会让整段变成站桩输出
    if (e.dead || e.hp <= 0 || e.boss) continue;
    e.root = Math.max(e.root || 0, HZ.EMP_ROOT);
    e.vx *= 0.15; e.vy *= 0.15; rooted++;
    burst(e.x, e.y, 4, ['#73eff7', '#f4f4f4'], 70, .3, 1);
  }
  G.heat = HEAT_MAX;                 // 代价：锁膛（HEAT_LOCK 秒，自动排空）
  h.fx = 0.45; h.fired++; h.next = HZ.EMP_CYCLE;
  ring(G.px, G.py, 44, '#73eff7', .5, 3);
  ring(G.px, G.py, 160, '#f4f4f4', .45, 2);
  addShake(3.2); Sound.sfx.shield();
  toast(T('hz.emp'), cleared > 0 ? T('hz.empHit', cleared) : T('hz.empLock'), '#73eff7', 1.8);
}
/* ④ 折射带：几条固定的带，子弹进去就持续偏折。
   敌我同一套规则 —— 这是它当机制而不是当增益的原因：你的弹会绕，敌弹也会绕。 */
function hzLensInit() {
  const bands = [];
  for (let i = 0; i < HZ.LENS_N; i++) {
    bands.push({
      x: rand(200, WORLD.w - 200), y: rand(200, WORLD.h - 200),
      a: rand(TAU), len: rand(240, 420), w: rand(44, 70),
      dir: Math.random() < 0.5 ? 1 : -1, ph: rand(TAU),
    });
  }
  G.hz.bands = bands;
}
function lensAt(x, y) {
  const bs = G.hz && G.hz.bands;
  if (!bs) return null;
  for (const b of bs) {
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    const t = clamp((x - b.x) * ca + (y - b.y) * sa, -b.len / 2, b.len / 2);
    const dx = x - (b.x + ca * t), dy = y - (b.y + sa * t);
    if (dx * dx + dy * dy < (b.w / 2) * (b.w / 2)) return b;
  }
  return null;
}
// mul：玩家弹 1、敌弹 HZ.LENS_EB（弯得慢一半，弹幕才读得懂）
function lensBend(o, dt, mul) {
  if (!G.hz || G.hz.kind !== 'lens') return;
  const b = lensAt(o.x, o.y);
  if (!b) return;
  const step = HZ.LENS_TURN * b.dir * (mul === undefined ? 1 : mul) * dt;
  const cs = Math.cos(step), sn = Math.sin(step);
  const nx = o.vx * cs - o.vy * sn;
  o.vy = o.vx * sn + o.vy * cs; o.vx = nx;
  o.ang = Math.atan2(o.vy, o.vx);   // ⚠️ decel 弹每帧从 ang 重算速度，不更新 ang 反弹会被立刻抹掉
}
/* ⑤ 晶壁反射：core 墙把玩家的弹**弹回去**，而不是吃掉。
   回廊布局（墙最多）配这条最值钱 —— 打角度能打到拐角后面的人。 */
function hzCrystalInit() { for (const b of G.terr) if (b.kind === 'core') b.bounce = 1; }

/* ---- 绘制 ----
   底色只占「认得出」的一半 —— 每个区还得有一件**会动的东西**，
   而且五件东西必须是五种东西（不是同一套粒子换个颜色）：
     碎屑 = 横漂的岩（装饰岩加密）  星云 = 缓慢的雾团
     熔炉 = 上升的余烬              奇点 = 脉动的引力环
     结晶 = 漂浮的冰晶棱片
   ⚠️ 位置一律按 G.t **解析**算，不每帧 mutate 状态：这样慢放 / 暂停 / 截图探针
      拿到的都是同一套确定性画面（探针要逐像素比对才认得出「换了区」）。 */
function drawZoneSkin() {
  const z = G.zone, L = viewL(), T = viewT();
  if (G.zskinZone !== z) {
    G.zskinZone = z; G.zskin = [];
    const n = z === 2 ? 26 : z === 4 ? 18 : 4;
    for (let i = 0; i < n; i++) G.zskin.push({
      x: rand(W + 80), y: rand(H + 80), p: rand(0.08, 0.3),
      v: z === 2 ? rand(16, 44) : rand(-8, 8),
      a: rand(TAU), va: rand(-0.35, 0.35), sz: irand(3, 6), r: rand(64, 128),
    });
  }
  const wx = (v, p) => ((v - cam.x * p) % (W + 80) + (W + 80)) % (W + 80) + L - 40;
  const wy = (v, p, d) => ((v - cam.y * p + (d || 0)) % (H + 80) + (H + 80)) % (H + 80) + T - 40;
  if (z === 1) {                       // 星云：雾团
    for (const s of G.zskin) drawGlow(ctx, '#7a3ab0', s.r, 0.13, wx(s.x + G.t * s.v, s.p), wy(s.y + G.t * s.v * 0.4, s.p));
  } else if (z === 2) {                // 熔炉：余烬上升
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of G.zskin) {
      const x = Math.round(wx(s.x, s.p)), y = Math.round(wy(s.y, s.p, -G.t * s.v));
      const fl = 0.35 + Math.sin(G.t * 4 + s.a) * 0.25;
      ctx.globalAlpha = fl * 0.7; ctx.fillStyle = '#ef7d57'; ctx.fillRect(x, y, 1, 2);
      ctx.globalAlpha = fl * 0.3; ctx.fillStyle = '#ffcd75'; ctx.fillRect(x, y + 2, 1, 1);
    }
    ctx.restore();
  } else if (z === 3) {                // 奇点：脉动的引力环（锚在视口中心 —— 它说的是「这里的空间在弯」）
    ctx.save();
    ctx.globalAlpha = 0.16; ctx.strokeStyle = '#8ad0ff';
    for (let i = 0; i < 3; i++) ringPx(L + W / 2, T + H / 2, 60 + i * 46 + Math.sin(G.t * 0.6 + i) * 8, 1);
    ctx.restore();
  } else if (z === 4) {                // 结晶：漂浮的冰晶棱片（菱形四点 + 亮心）
    ctx.save();
    for (const s of G.zskin) {
      const x = Math.round(wx(s.x, s.p)), y = Math.round(wy(s.y, s.p, -G.t * 7));
      const a = s.a + G.t * s.va, rx = Math.cos(a) * s.sz, ry = Math.sin(a) * s.sz;
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#a8f0ff';
      ctx.fillRect(x + Math.round(rx), y + Math.round(ry), 1, 1);
      ctx.fillRect(x - Math.round(rx), y - Math.round(ry), 1, 1);
      ctx.fillRect(x - Math.round(ry), y + Math.round(rx), 1, 1);
      ctx.fillRect(x + Math.round(ry), y - Math.round(rx), 1, 1);
      ctx.globalAlpha = 0.9; ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
/* ④ 折射带：垫在地形**下面**（它是空间的一部分，不是盖在场地上的贴纸）。
   带里画流动的短线 —— 得让人一眼看出「往哪边弯」，否则玩家只会觉得「子弹今天不准」。 */
function drawZoneBands() {
  const h = G.hz;
  if (!h || h.kind !== 'lens' || !h.bands) return;
  for (const b of h.bands) {
    if (!onScreen(b.x, b.y, b.len)) continue;
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(b.a);
    ctx.globalAlpha = 0.09; ctx.fillStyle = '#73eff7';
    ctx.fillRect(-b.len / 2, -b.w / 2, b.len, b.w);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#8ad0ff';
    ctx.fillRect(-b.len / 2, -b.w / 2, b.len, 1); ctx.fillRect(-b.len / 2, b.w / 2 - 1, b.len, 1);
    ctx.fillStyle = '#dffbff';
    const step = 26, off = ((G.t * 46 * b.dir) % step + step) % step;
    for (let i = 0; i * step < b.len; i++) {
      const px = -b.len / 2 + ((i * step + off) % b.len);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(Math.round(px), Math.round(-b.w / 2 + 3 + ((i * 5) % Math.max(1, b.w - 6))), 9, 1);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
/* ② EMP 的两层视觉：预警（方框往里收，收到底就是脉冲）+ 冲击（一圈扩散）。
   ⚠️ 预警必须存在：脉冲不是玩家按的，没有预警的清屏只是「偶尔白送一秒」。 */
function drawHazardTop() {
  const h = G.hz;
  if (!h || h.kind !== 'emp') return;
  if (h.next < HZ.EMP_WARN) {
    const k = clamp(1 - h.next / HZ.EMP_WARN, 0, 1);
    const ww = W * (1 - k * 0.55), hh = H * (1 - k * 0.55);
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.45 * Math.abs(Math.sin(G.t * 12));
    ctx.strokeStyle = '#73eff7'; ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(G.px - ww / 2), Math.round(G.py - hh / 2), Math.round(ww), Math.round(hh));
    ctx.restore();
  }
  if (h.fx > 0) {
    const k = 1 - h.fx / 0.45;
    ctx.save();
    ctx.strokeStyle = '#73eff7';
    ctx.globalAlpha = (1 - k) * 0.55; ringPx(G.px, G.py, Math.round(40 + k * 300), 2);
    ctx.globalAlpha = (1 - k) * 0.25; ringPx(G.px, G.py, Math.round(20 + k * 180), 1);
    ctx.restore();
  }
}

// ============ 航程导演 ============
function startWave(w) {
  G.wave = w;
  // 星区：主线按 ZONES 的区间走；无尽里五区循环（13 段起 = 结晶回廊）。
  // ⚠️ 必须走 zoneIndexFor —— 地形布局也用它，分头算就会「背景熔炉、地形结晶」。
  G.zone = zoneIndexFor(w);
  const zone = ZONES[G.zone];
  G.waveKills = 0;
  G.spawnQueue = [];
  G.spawnT = 0.6;
  G.waveT = 0;
  Sound.sfx.warp();
  const tier = eTier(w);
  const bossId = bossForWave(w);
  // ⚠️ 地形必须在**这里**重建，且要在 `G.px/py` 还是上一段结束的位置时做 ——
  //    terrAdd 拿它来给玩家脚边留空。放到后面（敌人已经生成）就晚了。
  buildTerrain(w, bossId);
  // 场地机制跟着星区走。⚠️ 巨像段与视界段**不开** —— 它们自带完整机制，再叠一层互相盖住。
  startHazard((bossId || formForWave(w) === 'horizon') ? null : zone.haz);
  if (bossId) {
    G.waveState = 'boss';
    // ⚠️ 形态也要跟着切成 'boss'：否则它会**留着上一段的值**（比如第 3 段是回收，
    //    第 4 段打巨像时 HUD 还显示「星尘 3/17」）—— 巨像段根本没有星尘目标，
    //    玩家会以为要边打 Boss 边捡东西。
    G.waveForm = 'boss';
    // ⚠️ 不要用 setTimeout 排 boss 入场：那是**真实时间**，而 waveT 是**游戏时间**。
    // fast>1 时 waveT 先跑到 2 秒 → updateWave 判「场上没 boss 也没敌人」→ 直接 finishWave，
    // 巨像整段被跳过（实测 fast=4 时第 4/8 段只用 3.7s 就过了）。
    G.bossPending = bossId;
    G.bossT = 1.2;
    const b = BOSSES[bossId];
    // 无尽里巨像会重复出场，所以要把档位报出来 —— 不然玩家会以为游戏没在变难
    banner(T('bn.wave', w, name1(zone)),
      tier > 0 ? T('bn.bossTier', name1(b), tier) : T('bn.bossSoon'), '#ff5577', 2.4);
    G.waveNeed = 1;
  } else {
    G.waveState = 'spawn';
    G.bossPending = null;
    const sq = SQUADS[zone.squads[(w - 1) % 4]] || SQUADS.mixed;
    // ⚠️ G.squadName 保持**中文原名**（探针拿它当 CNT 表的键），显示走 L(sq,'name')
    G.squadName = sq.name;
    G.squadNameEn = sq.nameEn;
    // 无尽里每档额外加量（封顶 +10）—— 这是「越打越挤」的主要来源，比单纯加血更有压迫感
    const base = 7 + Math.min(w, WAVES) * 2.2;
    const extra = eTierExtra(w);
    const form = formForWave(w);
    G.waveForm = form;
    // ⚠️ 非视界段必须**显式清空** G.sing：不清的话它会跟着玩家走进下一段，
    //    子弹继续弯、掉落继续被吞，而 HUD 上完全没有提示（看起来像弹道 bug）。
    G.sing = null;

    // 各形态共用的「挑一只敌型」：星区越深混入越硬的；无尽固定按最深星区配
    const rollType = () => {
      let t = pick(sq.mix);
      if (G.zone === 2 || tier > 0) {
        if (Math.random() < 0.26) t = pick(['bastion', 'stalker', 'bulwark', 'shepherd', 'weaver']);
      } else if (G.zone === 1 && Math.random() < 0.2) t = pick(['shifter', 'mine', 'leech', 'weaver', 'nova']);
      return t;
    };

    if (form === 'purge') {
      // 清剿：原来的默认形态，杀光队列
      const n = Math.round(base * sq.cnt) + extra;
      G.waveNeed = n;
      for (let i = 0; i < n; i++) G.spawnQueue.push(rollType());
    } else if (form === 'surge') {
      // 潮涌：不要求杀光，只要求**活到时间到**。
      // ⚠️ 队列故意给得很长（远超能刷完的量）—— 玩家要是抱着「杀完就过段」的心态打，
      //    会发现永远杀不完，这正是这段要教的事。真正的终点是 G.waveDur。
      // ⚠️ 时长按「和一段清剿差不多长」来定（清剿 w=6 约 20 只、含击杀大约 15~25 秒）。
      //    一开始给到 30+w*1.1（w=11 时 42 秒），实测读起来就是「这一段怎么还没完」——
      //    存活段的压力来自**密度不停**，不是来自让你熬满一分钟。
      G.waveDur = 22 + Math.min(w, WAVES) * 0.9;
      G.waveNeed = 0;
      for (let i = 0; i < 260; i++) G.spawnQueue.push(rollType());
    } else if (form === 'horizon') {
      // 视界：生成奇点，之后只要求**活到时间到**。
      //   ⚠️ 队列给得比能刷完的多（同 surge）：玩家的终点是逃脱，不是清场。
      //   ⚠️ 时长比 surge 短（22+0.9w ≈ 27s → 这里 24s）：这段的密度来自「一直被拽」，
      //      熬到 30 秒会变成受罪。奇点自己也在长，紧迫感不需要靠堆时间。
      spawnSingularity();
      G.waveDur = 24;
      G.waveNeed = 0;
      for (let i = 0; i < 200; i++) G.spawnQueue.push(rollType());
    } else if (form === 'salvage') {
      // 回收：先在地上撒够星尘（比需求多 6 份，留出「漏掉几份」的余量），再放敌人骚扰。
      // ⚠️ 星尘必须**预撒**而不能指望击杀掉落：击杀掉几份全看运气，
      //    脸黑的时候场上根本没有够数的星尘，这一段就永远完成不了。
      G.dustNeed = 12 + Math.round(Math.min(w, WAVES) * 1.5);
      G.dustGot = 0;
      G.salvageT = 3;
      G.waveNeed = 0;
      for (let i = 0; i < G.dustNeed + 6; i++) {
        dropPickup('dust', G.px + rand(-190, 190), G.py + rand(-130, 130), 1);
      }
      for (let i = 0; i < 200; i++) G.spawnQueue.push(rollType());
    } else { // duel
      // 死斗：少量精锐重甲。精锐自带血量倍率，所以数量必须少 ——
      //   一段里塞 20 只精锐重甲会把帧率和心态一起打穿。
      const HEAVY = ['bastion', 'bulwark', 'shepherd', 'stalker', 'weaver'];
      const n = 3 + Math.floor(Math.min(w, WAVES) / 6) + (tier > 0 ? 1 : 0);
      G.waveNeed = n;
      for (let i = 0; i < n; i++) G.spawnQueue.push(pick(HEAVY));
      // ⚠️ 精锐标记**不在**这里给：spawnQueue 只存敌型字符串，
      //    updateWave 出怪时按 `G.waveForm === 'duel'` 直接判定（少一份要同步的状态）。
    }
    // banner 副标题：形态 + 编队（形态是这一段真正要玩家做的事，得排在编队前面）
    const formName = L(FORMS[form], 'name');
    banner(T('bn.wave', w, name1(zone)),
      tier > 0 ? T('bn.formTier', formName, tier, L(sq, 'name')) : T('bn.form', formName, L(sq, 'name')), '#73eff7', 2.2);
  }
  // 每段开场落一次续档快照（这时状态是干净的 —— 理由见 snapshotRun 的注释）
  snapshotRun();
}

const WARP_TIME = 1.8;
function updateWave(dt) {
  const w = G.wave;
  const alive = G.enemies.length;
  G.waveT += dt; // 本段已进行时间（rosters：跃迁过场也用它计时）
  if (G.waveState === 'spawn') {
    const form = G.waveForm;
    G.spawnT -= dt;
    // ⚠️ 场上上限**逐形态不同**：清剿可以堆到 58（它靠「杀光」推进，堆着是设计的一部分），
    //    潮涌 / 回收是按时长推进的，堆到 58 只会把帧率和可读性一起打穿；死斗本来就该是
    //    「一小撮硬目标」，超过 12 只就不是死斗了。
    const aliveCap = form === 'purge' ? 58 : form === 'duel' ? 12 : 26;
    if (G.spawnQueue.length && G.spawnT <= 0 && alive < aliveCap) {
      G.spawnT = Math.max(0.12, 0.55 - w * 0.02) * (form === 'surge' ? 0.75 : 1);
      const t = G.spawnQueue.shift();
      // 死斗：整段都是精锐（「少量高血」就是它的定义）；其余形态维持原来的随机精锐率
      const elite = form === 'duel' ? true : Math.random() < Math.min(0.18, 0.03 + w * 0.012);
      spawnEnemy(t, undefined, undefined, { elite });
    }

    if (form === 'surge' || form === 'horizon') {
      // 潮涌 / 视界：活到时间到就过段 —— **剩下的敌人不管**（跃迁会把它们带走）。
      if (G.waveT >= G.waveDur) finishWave();
    } else if (form === 'salvage') {
      if (G.dustGot >= G.dustNeed) finishWave();
      // 星尘会过期（life 22s）。场上不够数就补撒，否则玩家永远捡不满 → 整局卡死。
      // ⚠️ 这个补撒是**安全阀**不是玩法：正常玩的话开场撒的那批就够。
      G.salvageT -= dt;
      if (G.salvageT <= 0) {
        G.salvageT = 3;
        let onField = 0;
        for (const p of G.pickups) if (p.type === 'dust') onField++;
        const short = (G.dustNeed - G.dustGot) - onField;
        for (let i = 0; i < Math.min(6, short); i++) {
          dropPickup('dust', G.px + rand(-190, 190), G.py + rand(-130, 130), 1);
        }
      }
    } else {
      // 清剿 / 死斗：杀光（死斗的队列本来就很短）
      if (!G.spawnQueue.length && alive === 0) finishWave();
      // 兜底：真有敌人卡在打不到的位置（浮游雷踩过一次），别让整局挂死
      else if (!G.spawnQueue.length && alive <= 3 && G.waveT > 180) {
        for (const e of G.enemies.slice()) if (e.hp > 0) killEnemy(e);
      }
    }
    // 潮涌 / 回收的总兜底：万一计时或计数出岔子，200 秒后一律放行。
    // 宁可让玩家「莫名过段」，也不能把整局永久挂死。
    if (form !== 'purge' && form !== 'duel' && G.waveT > 200) finishWave();
  } else if (G.waveState === 'boss') {
    // 巨像入场也走游戏时间，跟 fast 倍速保持一致
    if (G.bossPending) {
      G.bossT -= dt;
      if (G.bossT <= 0) { const id = G.bossPending; G.bossPending = null; spawnBoss(id); }
    } else if (!G.boss && !G.enemies.length && G.waveT > 2) finishWave();
  } else if (G.waveState === 'warp') {
    if (G.waveT >= WARP_TIME) startWave(w + 1);
  }
}

function finishWave() {
  if (G.wave === WAVES) {
    // 主线 12 段打通：记为「通关」，但**不结束这一局** —— 直接滚进无尽航程。
    // ⚠️ 这里以前是 G.dead = true + gameOver()，等于把无尽模式的入口堵死了。
    //    现在只有「船毁」才结束一局（见 die），通关只是把 G.won 记上，
    //    结算页照样按 G.won 给 SAVE.won +1 —— 所以「通关率」统计没被破坏。
    G.won = true;
    G.score += 1500;
    G.S.hp = G.S.maxHp;                 // 通关奖励：满血，别让无尽开局带着残血
    banner(T('over.win'), T('bn.winSub'), '#ffcd75', 3.4);
    Sound.sfx.ready();
    addShake(8);
    G.waveState = 'warp'; G.waveT = 0;
    return;
  }
  G.waveState = 'warp'; G.waveT = 0;
  banner(T('bn.clear'), T('bn.warp', G.wave + 1), '#a7f070', 1.8);
  Sound.sfx.ready();
  Sound.setMode('cruise');
}

// ============ 主步进 ============
function step(dt) {
  G.t += dt;
  G.hitFlashN = 0;
  // 这一帧攒下的震动在这里结算（见 addShake 上方那条注释）
  flushShake();
  // ⚠️ 冷却必须在「凝滞早退」**之前**减 —— 否则被冻住的那些帧不走这一步，
  //    冷却永远到不了 0，连杀之后就再也冻不起来了。
  if (hitstopCd > 0) hitstopCd = Math.max(0, hitstopCd - dt);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
  if (G.vign > 0) G.vign = Math.max(0, G.vign - dt * 2.4);
  // 第四批的时间类状态（2026-10-03）：狂热 buff / 回溯冷却 / 时间快照。
  // ⚠️ 和 shake / vign 放在同一层、都在「凝滞早退」之上 —— 它们挂在主流程的上游，
  //    被冻住的那些帧也不该让 buff 偷偷偷跑。
  if (G.furyT > 0) G.furyT = Math.max(0, G.furyT - dt);
  if (G.rewindT > 0) G.rewindT = Math.max(0, G.rewindT - dt);
  // 星蚀的熄灭战场：全局遮暗。**连 hitstop 期间也要走** ——
  //   否则一次命中凝滞会把天黑的时间白白拉长，玩家会觉得它「赖着不走」。
  if (G.blackout > 0) G.blackout = Math.max(0, G.blackout - dt);
  // ⚠️ 清尽同源：本体一死，它的幻影 / 熄灭必须立刻跟着消失。
  //    少了这句会出现「boss 已经炸完了，屏幕上还挂着两个假身在开火」的鬼畜。
  if (!G.boss && G.phantoms.length) G.phantoms.length = 0;
  if (!G.boss && G.blackout > 0) G.blackout = 0;
  if (G.S.rewind > 0) pushSnap(dt);
  // 命中凝滞：实体全冻，只让粒子慢放 —— 顿挫感就来自这里
  if (G.hitstop > 0) {
    G.hitstop -= dt;
    updateParts(dt * 0.3);
    return;
  }
  // 低血量心跳：声音比红色边框更能让人紧张
  if (!G.dead && G.S.hp / G.S.maxHp < 0.28) {
    G.heartT -= dt;
    if (G.heartT <= 0) { G.heartT = 0.72; Sound.sfx.heart(); }
  }
  // BGM 模式：无巨像且敌人多 → battle
  if (state === 'play' && !G.boss) {
    Sound.setMode(G.enemies.length > 8 ? 'battle' : 'cruise');
  }
  if (!G.dead) {
    updatePlayer(dt);
    updateAbilities(dt);
    updateDrones(dt);
  }
  updateEnemies(dt);
  updateSingularity(dt);   // 视界：奇点吸人吞物（在敌人移动之后，才能吃掉它们本帧的新位置）
  updateBullets(dt);
  // ⚠️ 尾流必须在 updateEBullets 之前：它的职责之一是把敌弹吃掉，
  //    排到后面就变成「先被弹打到、再把弹清掉」，玩家会觉得这模块根本没生效。
  updateWakes(dt);
  updateMines(dt);
  updateWalls(dt);
  updateClones(dt);
  updateArrows(dt);
  updateEBullets(dt);
  updatePickups(dt);
  updateParts(dt);
  updateFx(dt);
  updateLances(dt);
  updateWebs(dt);
  updateFires(dt);
  updateTerrain(dt);
  updateHazard(dt);
  updateWave(dt);
}

// ============ 渲染 ============
// 「在不在视野里」—— 注意是**视口**不是世界。世界大了以后，绝大部分世界内容都在视口外。
function onScreen(x, y, m = 40) {
  return x > viewL() - m && x < viewR() + m && y > viewT() - m && y < viewB() + m;
}

function drawBackground() {
  const set = STARSETS[G.zone] || STARSETS[0];
  const L = viewL(), T = viewT();
  ctx.fillStyle = set.bg; ctx.fillRect(L, T, W, H);
  // 三层视差星野
  const pf = [0.06, 0.14, 0.26];
  for (let i = 0; i < 3; i++) {
    const tile = set.layers[i];
    // ⚠️ 视差的锚点是**相机**，不是玩家。相机锁在玩家身上时两者相同，
    //    但相机被世界边界夹住之后就会分叉 —— 那时只有用相机，背景才不会「跟着玩家漂」。
    //    `+64 %64` 是取正模：相机坐标恒为正，但这样写不依赖这个前提。
    const ox = L - ((cam.x * pf[i]) % 64 + 64) % 64, oy = T - ((cam.y * pf[i]) % 64 + 64) % 64;
    // ⚠️ 用 pattern 铺，不要逐块 drawImage：视口 480×270、tile 64px、三层，
    //    旧写法是每帧 ~210 次 drawImage，而它们画的是同一张图的重复。
    //    pattern + translate 之后一趟 fillRect 就够，profile 里 drawImage（最大头，~28%）
    //    有约五分之一是这块白花的。
    //    pattern 挂回 tile 上缓存 —— 每帧新建 pattern 只是把开销换个地方。
    const pat = tile._pat || (tile._pat = ctx.createPattern(tile, 'repeat'));
    ctx.save();
    // ⚠️ translate 必须取整：旧写法是逐块 `drawImage(tile, Math.round(x), Math.round(y))`，
    //    因为 ox 的小数部分对所有块是同一个值，round(ox + k*64) === round(ox) + k*64，
    //    所以「取整后的原点 + 整数倍步长」和逐块取整**完全等价**。
    //    不取整的话整片星野会相对原来偏 1px（实测 zone0 有 1.3% 像素不同，全是星星在挪位）。
    ctx.translate(Math.round(ox), Math.round(oy));
    ctx.fillStyle = pat;
    ctx.fillRect(-64, -64, (L + W + 64) - (ox - 64), (T + H + 64) - (oy - 64));
    ctx.restore();
  }
  // 漂浮岩石（同样锚在相机上，铺满视口）
  if (!G.decor) {
    G.decor = [];
    for (let i = 0; i < 12; i++) G.decor.push({ x: rand(W + 80), y: rand(H + 80), s: irand(0, 1), big: Math.random() < 0.3, a: rand(TAU), va: rand(-0.25, 0.25), p: rand(0.1, 0.3) });
  }
  ctx.globalAlpha = 0.55;
  for (const d of G.decor) {
    d.a += d.va * DT;
    const rk = ROCKS[G.zone] || ROCKS[0];
    const flat = d.big ? rk.big : rk.s;          // 未旋转的那张，只用来取尺寸
    const R = d.big ? rk.rotBig : rk.rot;        // 预烘焙的 24 向
    const px = ((d.x - cam.x * d.p) % (W + 80) + (W + 80)) % (W + 80) + L - 40;
    const py = ((d.y - cam.y * d.p) % (H + 80) + (H + 80)) % (H + 80) + T - 40;
    const cx = px + flat.width / 2, cy = py + flat.height / 2;
    ctx.drawImage(R.imgs[dirIndex(d.a, R.n)], Math.round(cx - R.half), Math.round(cy - R.half));
  }
  ctx.globalAlpha = 1;
}

function drawSpriteFrame(set, x, y, frame, flash, alpha = 1, flip = false) {
  const arr = flip ? set.l : set.r;
  const img = arr[frame % arr.length];
  ctx.globalAlpha = alpha;
  if (flash > 0) {
    const w = set.wr ? (flip ? set.wl : set.wr) : null;
    ctx.drawImage((w && w[frame % w.length]) || img, Math.round(x - set.w / 2), Math.round(y - set.h / 2));
  } else {
    ctx.drawImage(img, Math.round(x - set.w / 2), Math.round(y - set.h / 2));
  }
  ctx.globalAlpha = 1;
}
const FACE_SPR = { dart: 1, tadpole: 1, stalker: 1 };

function drawEnemies() {
  for (const e of G.enemies) {
    if (!onScreen(e.x, e.y)) continue;
    const set = SPR[e.spr || e.cfg.spr];
    if (!set) continue;
    const frame = (e.t * 6) | 0;
    const flip = FACE_SPR[e.cfg && e.cfg.spr] ? e.vx < 0 : false;
    if (e.elite) drawGlow(ctx, '#ffcd75', e.r + 6, 0.25 + Math.sin(e.t * 5) * 0.08, e.x, e.y);
    if (e.boss) {
      // Boss：血越低越红
      const hpf = e.hp / e.maxHp;
      if (hpf < 0.45) drawGlow(ctx, '#ff3355', e.r + 10, 0.3, e.x, e.y);
      drawSpriteFrame(set, e.x, e.y, 0, e.flash);
    } else {
      // 牧者：脚下常驻的治疗光环（脉冲时亮一档）—— 一眼看出「先打它」
      if (e.cfg.ai === 'shepherd') {
        const a = 0.10 + (e.pulse > 0 ? 0.30 * (e.pulse / 0.55) : 0) + Math.sin(e.t * 2.6) * 0.03;
        drawGlow(ctx, '#a7f070', e.cfg.aura, Math.max(0, a), e.x, e.y);
        ctx.globalAlpha = 0.22 + (e.pulse > 0 ? 0.3 : 0);
        ctx.strokeStyle = '#a7f070'; ringPx(e.x, e.y, e.cfg.aura, 1);
        ctx.globalAlpha = 1;
      }
      // 被牧者奶过的敌人：绿色呼吸光
      if (e.buffT > 0) drawGlow(ctx, '#a7f070', e.r + 5, 0.18 + Math.sin(e.t * 9) * 0.06, e.x, e.y);
      // 铁壁：机头方向的弧形装甲板，提示「这面打不动」
      if (e.cfg.guard) {
        ctx.strokeStyle = '#c0cbdc'; ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.round(e.x) + .5, Math.round(e.y) + .5, e.r + 3, e.ang - 0.85, e.ang + 0.85);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawSpriteFrame(set, e.x, e.y, frame, e.flash, e.alpha, flip);
      // 精英：金色外框
      if (e.elite) { ctx.strokeStyle = '#ffcd75'; ringPx(e.x, e.y, e.r + 2, 1); }
      // 拘束立场：被定住的敌人踩一圈紫色静电 ——— 必须看得见，否则玩家不知道
      // 「它为什么不动」，只会在心里记成一次随机卡顿。
      if (e.root > 0) {
        const k = 0.5 + Math.sin(e.t * 26) * 0.25;
        ctx.globalAlpha = 0.75 * Math.min(1, e.root * 2);
        ctx.strokeStyle = '#a06cf0'; ringPx(e.x, e.y, e.r + 4, 1);
        ctx.globalAlpha = 0.55 * k;
        ctx.strokeStyle = '#f4f4f4'; ringPx(e.x, e.y, e.r + 5, 1);
        ctx.globalAlpha = 1;
      }
    }
    // 死亡印记：头顶一枚符文 + 一条倒计时条。
    //    ⚠️ 必须画出来 —— 印记是**延迟结算**的账，看不见倒计时的话玩家只会觉得
    //       「它怎么突然掉了一大截血」，而不是「我刚才那一轮打得多狠」。
    //    ⚠️ 放在 if/else **之外**：Boss 也会被挂账（且夹在 maxHp×0.5，更需要看见）。
    if (e.markT > 0 && e.markAcc > 0) {
      const k = Math.max(0, Math.min(1, e.markT / (G.S.markT || 1)));
      const col = G.S.markGold ? '#ffcd75' : '#c070f0';
      const y0 = Math.round(e.y - e.r - 9);
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(e.t * 16) * 0.2;
      ctx.fillStyle = col;
      ctx.beginPath();                                   // 菱形符文
      ctx.moveTo(e.x, y0 - 4); ctx.lineTo(e.x + 3.5, y0);
      ctx.lineTo(e.x, y0 + 4); ctx.lineTo(e.x - 3.5, y0);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.8;                             // 已走完的部分（越短 = 越快爆）
      ctx.fillRect(Math.round(e.x - 8), y0 + 7, Math.round(16 * k), 2);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(Math.round(e.x - 8 + 16 * k), y0 + 7, Math.max(0, Math.round(16 * (1 - k))), 2);
      ctx.restore();
    }
  }
}

// 数一张 canvas 上有多少个非透明像素（探针用：验「真的画出来了」而不是「字段有值」）
function _opaque(x, w, h) {
  const d = x.getImageData(0, 0, w, h).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
}
// 探针用的离屏画布 / 绘制包装：把「当前船体 + 指定配件」画成一张图，供逐像素对比
function _scratchKit() {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 100;
  return c;
}
function _drawKit(cv, mods, white) {
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, cv.width, cv.height);
  drawShipKit(x, G.S.hull, cv.width / 2, cv.height / 2, 0, mods, white, 1);
}

/* 「船体 + 全部配件」的唯一绘制入口 —— 战斗画面、暂停页预览、探针都用它。
   配件是随等级长出来的实体件（ATTACH_ART），不是数值特效：
   选了装甲板就真在舷侧长出装甲片，选了尾炮船尾就真伸出炮管。
   k = 放大倍数（预览页用 2，战斗里用 1）。整数倍 + imageSmoothing 关掉 = 像素不糊。 */
function drawShipKit(c, hull, x, y, ang, mods, white, k) {
  k = k || 1;
  const S = SHIPSET[hull];
  if (!S) return;
  const src = white ? S.white : S;
  const img = src.imgs[dirIndex(ang, src.n)];
  if (k === 1) c.drawImage(img, Math.round(x - S.half), Math.round(y - S.half));
  else c.drawImage(img, Math.round(x - S.half * k), Math.round(y - S.half * k), img.width * k, img.height * k);
  const cos = Math.cos(ang), sin = Math.sin(ang);
  for (const id in mods) {
    const a = attachSprite(id, mods[id], white);
    if (!a) continue;                       // 没有美术的 id 直接跳过，不能拖垮整帧
    const wx = x + (cos * a.ox - sin * a.oy) * k;
    const wy = y + (sin * a.ox + cos * a.oy) * k;
    const ai = a.set.imgs[dirIndex(ang, a.set.n)];
    if (k === 1) c.drawImage(ai, Math.round(wx - a.set.half), Math.round(wy - a.set.half));
    else c.drawImage(ai, Math.round(wx - a.set.half * k), Math.round(wy - a.set.half * k), ai.width * k, ai.height * k);
  }
}

// 暂停页的「当前舰体」预览：把这一局的装配结果整船画出来 —— 玩家能回头看自己 DIY 成了什么。
// 固定机首朝右（ang = 0），2 倍整数放大。
function drawShipView() {
  const cv = $('shipview');
  if (!cv || !G) return;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, cv.width, cv.height);
  drawShipKit(x, G.S.hull, cv.width / 2, cv.height / 2, 0, G.mods, false, 2);
  // 配件是画在船体**上面**的，满装配（29 件）时整条船会被盖住，看着像一团杂物。
  // 再淡淡叠一层船体，让「这是哪条船」一眼还能认出来 —— 只影响预览，不影响战斗画面。
  const hs = SHIPSET[G.S.hull];
  if (hs) {
    const himg = hs.imgs[0];
    x.globalAlpha = 0.34;
    x.drawImage(himg, Math.round(cv.width / 2 - hs.half * 2), Math.round(cv.height / 2 - hs.half * 2),
                himg.width * 2, himg.height * 2);
    x.globalAlpha = 1;
  }
  const cap = $('shipview-cap');
  if (cap) {
    const n = Object.keys(G.mods).length;
    cap.textContent = n ? T('pause.cap', n) : T('pause.capNone');
  }
}

function drawPlayer() {
  const S = G.S;
  // 机首 / 机尾伸出量（出膛点 / 尾焰锚点用）
  const mz = hullNose(), tl = hullTail();
  // 冲刺残影
  if (G.dashT > 0) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.18 * (4 - i);
      drawShipKit(ctx, S.hull, G.px - Math.cos(G.ang) * i * 7, G.py - Math.sin(G.ang) * i * 7, G.ang, G.mods, true, 1);
      ctx.globalAlpha = 1;
    }
  }
  if (G.dead) return;
  const blink = G.inv > 0 && ((G.t * 20) | 0) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.45;
  if (G.odT > 0) drawGlow(ctx, '#73eff7', 22, 0.4, G.px, G.py);
  // 湮灭指令的「狂热」：斩杀之后的一圈暗红光。必须看得见 —— 它只有 3 秒，
  //    看不见就等于玩家永远不知道自己是「现在该压上去」还是「刚才那只是个意外」。
  if (G.furyT > 0) drawGlow(ctx, '#ef7d57', 19, 0.22 + Math.sin(G.t * 14) * 0.08, G.px, G.py);
  drawShipKit(ctx, S.hull, G.px, G.py, G.ang, G.mods, G.hurtFlash > 0, 1);
  ctx.globalAlpha = 1;
  // 引擎焰：锚在**机尾**而不是船心 —— 火焰是从船尾喷口往后喷出来的。
  if (G.thrust) {
    const bx = G.px - Math.cos(G.ang) * tl, by = G.py - Math.sin(G.ang) * tl;
    const len = 3 + ((G.t * 30) | 0) % 3;
    ctx.fillStyle = '#ffcd75';
    for (let i = 0; i < len; i++) {
      const d = 3 + i * 2;
      ctx.fillRect(Math.round(bx - Math.cos(G.ang) * d) - 1, Math.round(by - Math.sin(G.ang) * d) - 1, 2, 2);
    }
  }
  // 枪口闪光（自动装填质变后喷金焰）：锚在**机首炮口**而不是船心。
  if (G.muzzle > 0) {
    const mx = G.px + Math.cos(G.ang) * mz, my = G.py + Math.sin(G.ang) * mz;
    const g = S.goldMuzzle;
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4);
    ctx.fillStyle = g ? '#ffcd75' : '#73eff7';
    ctx.fillRect(Math.round(mx) - (g ? 4 : 3), Math.round(my) - 1, g ? 8 : 6, 2);
    if (g) { ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 3, 4, 6); }
  }
  // 护盾环
  if (S.shield > 0) {
    ctx.strokeStyle = '#73eff7'; ctx.globalAlpha = 0.55;
    ringPx(G.px, G.py, 15, 2);
    ctx.globalAlpha = 1;
  }
  // 静止场：呼吸的紫色边界
  if (S.stasis > 0) {
    ctx.globalAlpha = 0.16 + Math.sin(G.t * 2.2) * 0.05;
    ctx.strokeStyle = '#c070f0';
    ringPx(G.px, G.py, S.stasisR, 1);
    ctx.globalAlpha = 1;
  }
  // 冲角装甲：船首亮出的破风尖锥，随等级变长，质变后镀金 ——
  // 一眼就能看出这条船是拿来撞的，不然玩家根本不会想到要主动贴上去。
  if (S.ram > 0) {
    const cx = Math.cos(G.ang), cy = Math.sin(G.ang);
    const tip = 14 + S.ram * 2;
    ctx.strokeStyle = S.ramGold ? '#ffcd75' : '#c0cbdc';
    pline(G.px + cx * 8, G.py + cy * 8, G.px + cx * tip, G.py + cy * tip, S.ramGold ? 3 : 2);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(Math.round(G.px + cx * tip) - 1, Math.round(G.py + cy * tip) - 1, 2, 2);
  }
}

function drawDrones() {
  const gold = G.S.droneGold;
  for (const d of G.drones) {
    if (d.x === undefined) continue;
    drawGlow(ctx, gold ? '#ffcd75' : '#73eff7', 7, gold ? 0.42 : 0.28, d.x, d.y);
    ctx.fillStyle = gold ? '#ffcd75' : '#73eff7';
    ctx.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 1, 4, 2);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) - 1, 2, 2);
  }
}

function drawPickups() {
  for (const p of G.pickups) {
    if (!onScreen(p.x, p.y, 12)) continue;
    const spr = p.type === 'dust' ? (p.v >= 3 ? 'dustBig' : 'dust') : p.type;
    const set = SPR[spr]; if (!set) continue;
    const bob = Math.sin(p.t * 5) * 1.2;
    const fade = p.life < 3 && ((p.t * 8) | 0) % 2 === 0 ? 0.35 : 1;
    drawGlow(ctx, p.type === 'heal' ? '#e04060' : '#ffcd75', 7, 0.35, p.x, p.y + bob);
    drawSpriteFrame(set, p.x, p.y + bob, (p.t * 7) | 0, 0, fade);
  }
}

/* ================== 子弹外观规则表（纯视觉：不参与任何数值 / 判定） ==================
   这张表和下面的解析器是**本次唯一改变画面、不动玩法**的地方。三条轴按固定顺序裁决：

       ① 家族 family ← 装配里「哪几张弹体卡同时在场」（组合优先于单卡）
       ② 尺寸 size   ← 口径校准的等级（和它的判定半径同源）
       ③ 配色 tint   ← 来源色 → 卡 → 质变金 → 协同（后者覆盖前者）
       ④ 装饰 deco   ← 已弹过的临时状态 → 协同 → 单卡高阶

   ⚠️⚠️ 铁律：**这里出现的任何数字都不许被别的函数读到**。
       pBullet / damageEnemy / updateBullets / updateEnemies 一行都不许引用本节的常量，
       否则「外观调整」就会悄悄变成「数值调整」 —— 这次明确要求两者解耦。
   ================================================================================= */

// ① 家族：从上往下第一条命中的生效，所以**组合家族必须排在单卡前面**
//    （不然「穿甲 + 高爆」会先被『穿甲』截胡，永远看不到脱壳弹）。
const BSPEC_FAMILY = [
  { id: 'hammer', req: { piercer: 1, caliber: 1 }, note: '穿甲 × 口径 → 重型矛' },
  { id: 'sabot', req: { piercer: 1, hesh: 1 }, note: '穿甲 × 高爆 → 脱壳榴弹' },
  { id: 'dive', req: { piercer: 1, guided: 1 }, note: '穿甲 × 制导 → 带鳍矛' },
  { id: 'pod', req: { fission: 1, hesh: 1 }, note: '裂变 × 高爆 → 空心荚舱' },
  { id: 'bound', req: { ricochet: 1, hesh: 1 }, note: '跳弹 × 高爆 → 连环跳雷' },
  { id: 'spear', req: { piercer: 1 }, note: '穿甲弹' },
  { id: 'bomb', req: { hesh: 1 }, note: '高爆弹' },
  { id: 'core', req: { fission: 1 }, note: '裂变弹芯' },
  { id: 'seeker', req: { guided: 1 }, note: '制导弹药' },
];
// 家族 internally 的等级取法：单卡 = 那张卡的等级；双卡组合 = 两张等级的平均向上取整。
// 后者是刻意的 —— 「一张 lv3 一张 lv1」应该比「两张 lv1」更像回事，但到不了双 lv3。
function bFamilyIndex(m, req) {
  const keys = Object.keys(req);
  if (keys.length === 1) return Math.min(3, m[keys[0]] | 0);
  let sum = 0;
  for (const k of keys) sum += Math.min(3, m[k] | 0);
  return Math.min(3, Math.max(1, Math.ceil(sum / keys.length)));
}
// 每种来源的基础表：默认家族 / 是否吃尺寸档 / 基础配色
const BKIND = {
  main: { fam: true, size: true, tint: S => S.caliberGold ? 'gold' : 'cyan' },
  rear: { fam: true, size: true, tint: S => S.backGold ? 'gold' : 'amber' },
  // 散射弹刻意整族小一档：它是「用数量换单发威力」，一眼就该比主炮弱
  spray: { fam: true, size: true, sizeAdj: -1, tint: S => S.sprayGold ? 'gold' : 'ice' },
  // 弹片 / 无人机有自己的家族，不跟着主炮的装配长 —— 它们是「别的东西」，不是主炮的缩小版
  shard: { fam: 'frag', by: 'fission', tint: S => S.fissionGold ? 'gold' : 'amber' },
  drone: { fam: 'nub', by: 'drone', tint: () => 'gold' },
  // 爆头弹：跟着主炮的家族长（fam: true），但整发大一号、**恒金**。
  //    它出现的频率是「每第 N 发」，在没有别的提示的情况下，金色是「这一发很重」唯一可读的信号。
  headshot: { fam: true, size: true, sizeAdj: 1, tint: () => 'gold' },
};
// ③ 卡带来的配色覆盖（低优先级：质变金 > 卡 > 来源默认）
//    只放「叙事上真的改写了弹药」的卡，别每张卡都给一份颜色，那样颜色就贬值了。
const BTINT_BY_MOD = {
  rewind: 'mint',     // 时滞回溯：时空系的冷绿
};
// ④ 单卡高阶的装饰（比协同装饰低一级）
const BDECO_BY_MOD = [
  { id: 'bind', lv: 2, deco: 'bindRing' },
  { id: 'isolate', lv: 2, deco: 'loneDot' },
  { id: 'execute', lv: 2, deco: 'harvestMark' },
];
/* 协同的额外变化。这里刻意**没有**给全部 30 组协同都配一条 ——
   像「相位护壁」「撞击汲取」「磁暴高爆」这种改的是护盾 / 冲角 / 磁雷的协同，
   和弹药没关系，硬给子弹加装饰只会让人读不懂「为什么突然变了」。
   进这张表的标准是：这条协同的 desc 里提到了「弹 / 炮 / 穿透 / 爆炸」。 */
const BDECO_BY_SYN = {
  heavyBore: { deco: 'goldRing', aura: ['#ffcd75', 9, 0.30] },
  volley: { deco: 'crossBar' },
  rearVolley: { deco: 'arrowBack' },
  rearPierce: { deco: 'arrowBack', aura: ['#ffe9a8', 8, 0.22] },
  bulletWall: { deco: 'wallSweep' },
  pierceCrit: { deco: 'critGlint', aura: ['#fff4d0', 8, 0.26] },
  guidedPierce: { deco: 'haloWave', aura: ['#73eff7', 10, 0.26] },
  bouncePierce: { deco: 'sparkTail' },
  bounceBlast: { deco: 'sparkTail' },
  bounceFission: { deco: 'sparkTail' },
  cluster: { deco: 'clusterDot', aura: ['#ffcd75', 9, 0.22] },
  fissionBoom: { deco: 'clusterDot' },
  lanceCaliber: { deco: 'lanceEdge' },
  lancePierce: { deco: 'burnEdge' },
  staticArc: { deco: 'voidCore' },
  resonance: { deco: 'voidCore', tint: 'violet' },
  staticBind: { deco: 'bindRing', tint: 'violet' },
  harvest: { deco: 'harvestMark', tint: 'rose' },
  loneMark: { deco: 'loneDot', aura: ['#c070f0', 8, 0.20] },
  droneSwarm: { deco: 'swarmPing' },
};
// 已经弹过至少一次 → 更烫（临时状态，优先级最高：它要告诉玩家「这一发现在打得更疼」）
const BDECO_BOUNCED = 'hotSparks';

/* 解析一个来源当前的 spec。**每种来源每帧只调一次**（drawPBullets 里一次性取齐），
   别在子弹循环里逐发拼 —— 那样每帧要拼几百个字符串。 */
function bulletLookSpec(kind, extraDeco) {
  const S = G.S, m = G.mods;
  const kd = BKIND[kind] || BKIND.main;
  const out = { family: 'plain', tier: 1, size: 0, tint: kd.tint(S), deco: null, aura: null };
  // ① 家族
  if (kd.fam === true) {
    for (const r of BSPEC_FAMILY) {
      let ok = true;
      for (const q in r.req) if ((m[q] | 0) < r.req[q]) { ok = false; break; }
      if (ok) { out.family = r.id; out.tier = bFamilyIndex(m, r.req); break; }
    }
  } else {
    out.family = kd.fam;
    out.tier = Math.min(3, Math.max(1, m[kd.by] | 0));
  }
  // ② 尺寸（只有跟着主炮装配的那几族才吃口径加成）
  if (kd.size) out.size = Math.min(3, Math.max(0, (m.caliber | 0) + (kd.sizeAdj || 0)));
  // ③ 配色优先级：协同 > 质变金 > 卡 > 来源默认。
  //    「质变金」由 kd.tint(S) 自己返回，所以只要知道来源默认色是不是金色就够了。
  const gold = out.tint === 'gold';
  let ov = null;
  for (const id in BDECO_BY_SYN) if (G.syn[id] && BDECO_BY_SYN[id].tint) ov = BDECO_BY_SYN[id].tint;
  if (!ov && !gold) {
    for (const id in BTINT_BY_MOD) if ((m[id] | 0) > 0) ov = BTINT_BY_MOD[id];
  }
  if (ov) out.tint = ov;
  // ④ 装饰：已弹过的临时状态 > 协同 > 单卡高阶
  if (extraDeco) out.deco = extraDeco;
  if (!out.deco) {
    for (const id in BDECO_BY_SYN) if (G.syn[id] && BDECO_BY_SYN[id].deco) {
      out.deco = BDECO_BY_SYN[id].deco;
      break;
    }
  }
  if (!out.deco) for (const b of BDECO_BY_MOD) if ((m[b.id] | 0) >= b.lv) { out.deco = b.deco; break; }
  // 辉光只跟随协同（这是「这一枪不一样」的最强信号），但也最贵 —— 由 drawPBullets 按弹数开关
  if (!extraDeco) {
    for (const id in BDECO_BY_SYN) if (G.syn[id] && BDECO_BY_SYN[id].aura) {
      out.aura = BDECO_BY_SYN[id].aura;
      break;
    }
  }
  return out;
}

function drawPBullets() {
  // 每帧只解析一次：同帧所有同种弹药共用同一份外观对象。
  const Lmain = BulletSkin.make(bulletLookSpec('main'));
  const Lrear = BulletSkin.make(bulletLookSpec('rear'));
  const Lspray = BulletSkin.make(bulletLookSpec('spray'));
  const Lshard = BulletSkin.make(bulletLookSpec('shard'));
  const Ldrone = BulletSkin.make(bulletLookSpec('drone'));
  const Lhead = G.S.headshot > 0 ? BulletSkin.make(bulletLookSpec('headshot')) : null;
  // 已经弹过的那几发：可能同时存在，所以 multi-hotmirror 也只解析一次
  let Lhot = null, LhotB = null;
  if (G.S.bounce > 0) {
    Lhot = BulletSkin.make(bulletLookSpec('main', BDECO_BOUNCED));
    LhotB = BulletSkin.make(bulletLookSpec('rear', BDECO_BOUNCED));
  }
  // 辉光是一发一次 drawImage：弹云密布时关掉，画面识别度靠轮廓和配色撑着
  const aura = G.bullets.length < 110;
  for (const b of G.bullets) {
    let look = Lmain;
    switch (b.kind) {
      case 'rear': look = Lrear; break;
      case 'spray': look = Lspray; break;
      case 'shard': look = Lshard; break;
      case 'drone': look = Ldrone; break;
      case 'headshot': if (Lhead) look = Lhead; break;
    }
    if (Lhot && (b.bounceN | 0) > 0 && (b.kind === 'main' || b.kind === 'rear')) {
      look = b.kind === 'rear' ? LhotB : Lhot;
    }
    BulletSkin.draw(ctx, look, b.ang, b.x, b.y, aura);
  }
}
function drawEBullets() {
  // 敌方：描边圆弹，画在最上层保证可读
  for (const b of G.ebullets) {
    const img = bulletSprite(b.color, b.r);
    ctx.drawImage(img, Math.round(b.x - img.width / 2), Math.round(b.y - img.height / 2));
  }
}

function drawParts() {
  // ⚠️ 只在透明度**真的变了**时才写 globalAlpha。粒子上限 1500，
  //    旧版每颗都写两遍（设进去 + 立刻还原），一帧 3000 次 canvas 状态变更，
  //    而其中大部分粒子的 f 还在 1.0（刚生成、还没开始淡）。
  let ga = 1;
  for (const p of G.parts) {
    const f = p.life / p.max;
    const a = Math.min(1, p.num !== undefined ? f * 1.6 : f * 1.4);
    if (a !== ga) { ctx.globalAlpha = a; ga = a; }
    if (p.num !== undefined) {
      text(p.num, p.x, p.y, p.color, 'c', p.size === 0 ? 12 : p.size);
      continue;
    }
    const s = Math.max(1, Math.round(p.size * (0.5 + f)));
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  if (ga !== 1) ctx.globalAlpha = 1;
}

function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.type === 'ring') {
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = f.color;
      ringPx(f.x, f.y, f.R * (0.25 + k * 0.9), f.th);
      ctx.globalAlpha = 1;
    } else if (f.type === 'laser') {
      const cx = Math.cos(f.ang), cy = Math.sin(f.ang);
      const ex = f.x + cx * f.len, ey = f.y + cy * f.len;
      if (f.t < 0.5) {
        // 预警细线
        ctx.globalAlpha = 0.4 + Math.sin(f.t * 30) * 0.25;
        ctx.strokeStyle = '#ff5577';
        pline(f.x, f.y, ex, ey, 1);
        ctx.globalAlpha = 1;
      } else if (f.t < 0.9) {
        const a = 1 - (f.t - 0.5) / 0.4;
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#f4f4f4'; pline(f.x, f.y, ex, ey, f.w + 3);
        ctx.strokeStyle = f.color; pline(f.x, f.y, ex, ey, f.w);
        ctx.globalAlpha = 1;
      }
    } else if (f.type === 'arc') {
      // 电弧：每帧重新抖动折线，闪起来才像电
      const a = Math.max(0, 1 - k);
      const seg = 5;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(Math.round(f.x0), Math.round(f.y0));
      for (let i = 1; i < seg; i++) {
        const q = i / seg;
        ctx.lineTo(Math.round(f.x0 + (f.x1 - f.x0) * q + rand(-6, 6)),
                   Math.round(f.y0 + (f.y1 - f.y0) * q + rand(-6, 6)));
      }
      ctx.lineTo(Math.round(f.x1), Math.round(f.y1));
      ctx.strokeStyle = f.gold ? '#ffcd75' : '#73eff7'; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ============ HUD ============
function bar(x, y, w, h, frac, col, bg = '#1a1c2c', hi) {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.min(w, Math.round(w * frac))), h);
  if (hi) { ctx.fillStyle = hi; ctx.fillRect(x, y, Math.max(0, Math.min(w, Math.round(w * frac))), 1); }
  ctx.strokeStyle = '#1a1c2c'; ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}

// ============ HUD 排版：舰桥仪表（2026-10-03 重排）============
// 统一视觉语言：左上「舰况」/ 右上「航程」/ 顶部「巨像」/ 底部「推进控制台」四簇
// 共用一块仪表背板 —— 深色底 + 1px 描边 + 角上 10x2 的亮色角标（accent 取各簇主色，
// 全部来自现有调色板，不引入新颜色）。
// ⚠️ 只动「框」和「行距」，各元素的**锚点避让计算不变**（触屏工具键 y=36 那条空档、
//    摇杆 / 开火键的圆形区域，见 index.html #touch 注释）。
const HUD_BG = 'rgba(10,12,26,0.78)', HUD_LINE = '#29366f';
function hudPanel(x, y, w, h, accent, corners) {
  ctx.fillStyle = HUD_BG; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = HUD_LINE; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = accent;
  for (const c of corners) {
    if (c === 'tl') ctx.fillRect(x + 1, y + 1, 10, 2);
    else if (c === 'tr') ctx.fillRect(x + w - 11, y + 1, 10, 2);
    else if (c === 'bl') ctx.fillRect(x + 1, y + h - 3, 10, 2);
    else if (c === 'br') ctx.fillRect(x + w - 11, y + h - 3, 10, 2);
  }
}

function drawHUD() {
  const S = G.S;
  // ---------- 左上「舰况」簇 ----------
  // 行距制：每行 = 条(barH) + 2px 隙 + 标签行，行推进 = barH + 15。
  //   旧版过热条写死在 yxp+10：4px 经验条 + 12px「LV 3」标签 > 10px 行距，
  //   熔炉船体上膛温条会压住 LV 行的文字 —— 现在按真实行高推进，永不叠字。
  const stats = [{
    barH: 7, frac: S.hp / S.maxHp, col: S.hp / S.maxHp > 0.35 ? '#e04060' : '#ff3355', hi: '#ff8aa0',
    label: T('hud.hull'), lc: '#7a86a8', val: Math.ceil(S.hp) + '/' + Math.round(S.maxHp), vc: '#f4f4f4',
  }];
  if (S.shieldMax > 0) stats.push({
    barH: 4, frac: S.shield / S.shieldMax, col: '#73eff7', hi: null,
    label: T('hud.shield'), lc: '#7a86a8', val: Math.ceil(S.shield) + '/' + Math.round(S.shieldMax), vc: '#c0cbdc',
  });
  stats.push({
    barH: 4, frac: G.xp / G.xpNext, col: '#ffcd75', hi: null,
    label: 'LV ' + G.level, lc: '#ffcd75', val: G.xp + '/' + G.xpNext, vc: '#7a86a8',
  });
  if (G.heatOn) {
    const hf = clamp(G.heat / HEAT_MAX, 0, 1), lock = G.heatLock > 0;
    stats.push({
      barH: 5, frac: hf, col: lock ? '#ff3355' : hf > 0.85 ? '#ff8a3d' : '#ffcd75', hi: lock ? null : '#ffe9a8',
      label: T('hud.heat'), lc: lock ? '#ff3355' : '#7a86a8',
      val: lock ? T('hud.heatLock') : Math.round(hf * 100) + '%', vc: lock ? '#ff3355' : '#7a86a8',
    });
  }

  // 模块芯片：一行 5 枚、最多 3 行。满装配 29 枚时旧版会向下铺到 y≈160，
  //   把整块战场左缘压成芯片墙；溢出折成一枚「+N」—— 完整清单永远在暂停页（#build），
  //   战斗中没有人逐枚读芯片，一眼「装了多少格」才是芯片的本职。
  //   ⚠️ 芯片 19px 宽是量出来的：12px 像素字的汉字墨宽 ~10px + 等级数字 ~6px，
  //   旧版 15px 格里两个字左右排必撞（首字母和金色等级数字叠成一团）。
  const ids = Object.keys(G.mods);
  const CHIP_CAP = 15, shown = ids.slice(0, CHIP_CAP), extra = ids.length - shown.length;

  // 主动能力冷却（装了才显示）：长枪 / 折跃 / 磁雷。
  // 这三张卡的强度全在「就绪」那一刻，玩家必须一眼看到还剩多久 —— 藏在暂停页里等于没有。
  const pips = [];
  if (S.lance > 0) pips.push({ g: T('hud.cd.lance'), ready: S.lanceT <= 0, ratio: 1 - S.lanceT / S.lanceCd, col: S.lanceGold ? '#ffcd75' : '#73eff7' });
  if (S.blink > 0) pips.push({ g: T('hud.cd.blink'), ready: S.blinkT <= 0, ratio: 1 - S.blinkT / S.blinkCd, col: S.blinkMax ? '#ffcd75' : '#c070f0' });
  if (S.mine > 0) pips.push({ g: T('hud.cd.mine'), ready: G.mines.length < S.mineMax, ratio: 1 - S.mineT / S.mineCd, col: S.mineGold ? '#ffcd75' : '#c070f0' });

  // 先量后画：背板高度 = 统计行 + 芯片行 + 技能行 + 内边距
  let cy = 10;
  for (const r of stats) cy += r.barH + 15;
  const chipTop = cy;
  let rows = Math.ceil(shown.length / 5);
  if (extra > 0 && shown.length % 5 === 0) rows++;      // +N 正好折进新行
  if (rows) cy = chipTop + rows * 16;
  if (pips.length) cy = (rows ? cy : chipTop) + 3 + 17;
  hudPanel(4, 4, 124, cy - 10 + 6, '#73eff7', ['tl']);

  cy = 10;
  for (const r of stats) {
    bar(8, cy, 116, r.barH, r.frac, r.col, '#1a1c2c', r.hi);
    text(r.label, 8, cy + r.barH + 2, r.lc);
    text(r.val, 124, cy + r.barH + 2, r.vc, 'r');
    cy += r.barH + 15;
  }
  if (rows) {
    let mx = 8, my = chipTop;
    for (const id of shown) {
      const m = MODULES.find(v => v.id === id);
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, 19, 13);
      ctx.strokeStyle = m.type === 'stat' ? '#41a6f6' : m.type === 'weapon' ? '#ef7d57' : '#c070f0';
      ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, 20, 14);
      // 19px 的小格放不下英文单词，取**当前语言名字的首字母**（中文就是汉字本身）；
      // 等级数字右对齐收在格尾 —— 两个字一左一右，19px 正好容下不叠。
      text(L(m, 'name')[0], mx, my + 1, '#f4f4f4');
      text('' + G.mods[id], mx + 18, my + 1, '#ffcd75', 'r', 12, null);
      mx += 21;
      if (mx > 100) { mx = 8; my += 16; }
    }
    if (extra > 0) {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, 19, 13);
      ctx.strokeStyle = '#333c57'; ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, 20, 14);
      text('+' + extra, mx, my + 1, '#7a86a8');
    }
  }
  if (pips.length) {
    let ax = 8;
    const ay = (rows ? chipTop + rows * 16 : chipTop) + 3;
    for (const p of pips) {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(ax, ay, 15, 14);
      // 就绪时外框亮起，未就绪时只画底部进度条
      ctx.strokeStyle = p.ready ? p.col : '#333c57';
      ctx.lineWidth = 1; ctx.strokeRect(ax - 0.5, ay - 0.5, 16, 15);
      text(p.g, ax + 3, ay + 1, p.ready ? p.col : '#566c86');
      ctx.fillStyle = p.ready ? p.col : '#41a6f6';
      ctx.fillRect(ax, ay + 12, Math.round(15 * clamp(p.ratio, 0, 1)), 2);
      ax += 18;
    }
  }

  // ---------- 右上「航程」簇：label/value 同行对齐，宽度按最宽行动态 ----------
  //   旧版是「标签一行、数值一行」的浮动文字堆，分数大时和航段行挤在一起；
  //   收进背板后每行 15px，右缘全部对齐到同一条线。
  const z = ZONES[G.zone];
  const rrows = [
    { l: T('hud.score'), v: '' + G.score, lc: '#7a86a8', vc: '#f4f4f4' },
    { l: '', v: waveLabel(G.wave), vc: G.wave > WAVES ? '#ffcd75' : '#73eff7' },
    { l: '', v: name1(z), vc: '#7a86a8' },
    { l: '', v: fmtTime(G.t), vc: '#7a86a8' },
  ];
  if (G.combo > 1) rrows.push({ l: '', v: 'x' + G.combo, vc: '#ffcd75' });
  let rw = 0;
  for (const r of rrows) rw = Math.max(rw, measure(r.l) + 8 + measure(r.v));
  rw = Math.max(96, rw + 16);
  const rx = W - 6 - rw;
  hudPanel(rx, 4, rw, rrows.length * 15 + 8, '#ffcd75', ['tr']);
  let ry = 10;
  for (const r of rrows) {
    if (r.l) text(r.l, rx + 8, ry, r.lc);
    text(r.v, W - 12, ry, r.vc, 'r');
    ry += 15;
  }

  // ---------- 底部「推进控制台」：冲刺 | 能量 | 本段目标 ----------
  //   旧版目标文字画在 ey+1，字模底缘正好贴到 270px 画布底边；连同能量/冲刺一起
  //   收进一条背板，目标行上移 3px，四个元素共享同一条基线区。
  const ew = 120, ex = (W - ew) / 2, ey = H - 16;
  hudPanel(92, H - 27, 320, 23, '#41a6f6', ['bl', 'br']);
  bar(ex, ey, ew, 6, G.energy / 100, G.energy >= 100 ? '#ffcd75' : '#41a6f6');
  text(G.energy >= 100 ? T('hud.odReady') : T('hud.energy'), W / 2, ey - 11, G.energy >= 100 ? '#ffcd75' : '#7a86a8', 'c');
  // 冲刺冷却
  const dw = 60, dx2 = W / 2 - dw - 74;
  bar(dx2, ey, dw, 6, G.dashCd > 0 ? 1 - G.dashCd / 1.25 : 1, G.dashCd > 0 ? '#566c86' : '#73eff7');
  text(T('hud.dash'), dx2 + dw / 2, ey - 11, '#7a86a8', 'c');
  // 本段目标：逐形态不同（见 FORMS）。「剩余 N 只」只对清剿/死斗成立 ——
  //   潮涌要看倒计时、回收要看星尘进度，沿用「剩余」会让玩家以为杀完就过段。
  text(waveObjective(), W / 2 + 74 + 14, ey - 2,
    G.waveForm === 'purge' ? '#c0cbdc' : '#ffcd75', 'l');

  // ---------- 巨像血条 ----------
  //   旧版血条 (x=120..360) 和左上船体条 (x=8..124) 同在 y=8、同为红色系，
  //   视觉上连成一条 350px 的长条 —— 收进居中背板并左右让开两侧簇的领地。
  if (G.boss) {
    const b = G.boss, bw = 216, bx = (W - bw) / 2;
    hudPanel(bx, 4, bw, 34, '#e04060', ['tl', 'tr']);
    bar(bx + 6, 10, bw - 12, 8, b.hp / b.maxHp, b.enraged ? '#ff3355' : '#e04060', '#1a1c2c', '#ff8aa0');
    text(bossName(b) + (sub1(b) ? ' · ' + sub1(b) : ''), W / 2, 22, '#ffcd75', 'c');
  }
}

function drawBanners() {
  // 多条横幅同时在场（开段：航段 + 巨像 + 协同×N）时压缩行距 —— 否则第 4 条的
  //   副标题正好压进底部控制台（y≥243）。可用高度按「最后一条的副标题 ≤ 205」反推。
  const n = G.banners.length;
  const step = n > 1 ? Math.min(48, Math.floor(131 / (n - 1))) : 48;
  let y = 74;
  for (const b of G.banners) {
    const k = b.t / b.life;
    const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    text(b.title, W / 2, y, b.color, 'c', 24);
    if (b.sub) text(b.sub, W / 2, y + 26, '#c0cbdc', 'c');
    ctx.globalAlpha = 1;
    y += step;
  }
}
function drawToasts() {
  let y = H - 62;
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    const t = G.toasts[i], k = t.t / t.life;
    ctx.globalAlpha = Math.max(0, 1 - k);
    text(t.title, W / 2, y, t.color, 'c');
    if (t.sub) text(t.sub, W / 2, y + 12, '#7a86a8', 'c');
    ctx.globalAlpha = 1;
    y -= 26;
  }
}

// ============ 准星 ============
// 桌面：机头跟着鼠标，但屏幕上没有任何东西告诉玩家"鼠标在哪"，全靠感觉。
// 这里画一个跟着鼠标走的像素十字 —— 全用 fillRect 画 1px 方块，不做抗锯齿，
// 保持和其余像素素材同一个观感；也不要进任何精灵缓存（坐标每帧都变）。
// 触屏：手指会盖住瞄准点，所以换成一个更大的环 + 点，顺带把虚拟摇杆也画出来。
// ============ 触屏操作反馈 ============
// 位置铁律：**反馈画在指尖，不画在船上**。
// 手指会盖住屏幕，玩家真正看得见的只有指尖周围那一圈。旧的「悬浮瞄准标」把准星画在
// 船周围 46px 处，等于让玩家同时盯两件事（指尖在指方向、标记在另一处也在表示方向），
// 再加上手指和标记的距离随手指位置变化，整个读数是割裂的。
// 这也是 Feral 把《Guardian of Light》搬上手机时定下的位置：三段式右杆的视觉全在杆上。

// 触屏杆：环 + 内圈 + 推杆，画在手指落点（ox,oy）上。
function drawStick(ox, oy, kx, ky, mag, col) {
  const R = 40;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.20; ringPx(ox, oy, R, 1);        // 外环：常态极淡，不喧宾夺主
  ctx.globalAlpha = 0.16; ringPx(ox, oy, R * 0.6, 1);  // 内圈：满舵参考
  if (mag > 0.04) {
    // 落点 → 推杆 的方向短线：指尖就能读出「我往哪推了」
    ctx.globalAlpha = 0.55; pline(ox, oy, ox + kx, oy + ky, 1);
  }
  ctx.globalAlpha = 0.9; ctx.fillStyle = col;
  disc(ox + kx, oy + ky, 5);                            // 推杆
  ctx.globalAlpha = 1;
  ctx.restore();
}
function drawSticks() {
  if (joy.active) {
    const [jx, jy] = toGame(joy.ox, joy.oy);
    drawStick(jx, jy, joy.x * MOVE_R, joy.y * MOVE_R, Math.hypot(joy.x, joy.y), '#73eff7');
  }
  if (aimDrag.id !== null) {
    drawStick(aimDrag.ox, aimDrag.oy, aimDrag.x, aimDrag.y, aimDrag.mag, '#9df3fa');
  }
}

// 炮口射线：从炮口沿 G.aim 射出的一小段。
// 删掉悬浮标之后必须有个东西替它告诉玩家「枪现在朝哪」，但它是**从炮口射出去**的，
// 不是悬在船周围的独立方块 —— 这样它和船是一体的，读起来是「枪指的方向」。
// 手指按在右杆上时加长加亮（正在瞄准），松开时留一小截淡的（枪口常驻朝向）。
function drawAimRay() {
  const a = G.aim;
  const held = aimDrag.id !== null;
  const LEN = held ? 30 + 34 * aimDrag.mag : 13;
  const SEG = held ? 4 : 2;
  const cs = Math.cos(a), sn = Math.sin(a);
  const x0 = G.px + cs * 8, y0 = G.py + sn * 8;
  ctx.save();
  ctx.strokeStyle = G.muzzle > 0 ? '#f4f4f4' : '#73eff7';
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG, t1 = (i + 1) / SEG;
    // 像素游戏不做连续渐变：用几段递降的 alpha 台阶代替
    ctx.globalAlpha = (held ? 0.6 : 0.34) * (1 - i / SEG) + 0.06;
    pline(x0 + cs * LEN * t0, y0 + sn * LEN * t0, x0 + cs * LEN * t1, y0 + sn * LEN * t1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCrosshair() {
  const S = G.S;
  const firing = G.muzzle > 0;
  const col = G.odT > 0 ? '#ffcd75' : (firing ? '#f4f4f4' : (S.hullColor || '#73eff7'));

  // ⚠️ 触屏不画准星。旧版在触屏上还画一个跟着手指的十字，和右杆的环是两套东西，
  //    看着是重复的。触屏的反馈统一交给 drawSticks（指尖） + drawAimRay（炮口）。
  if (pointerKind === 'touch') return;

  if (!mouse.inside) return;
  const x = Math.round(mouse.x), y = Math.round(mouse.y);
  if (x < -10 || y < -10 || x > W + 10 || y > H + 10) return;

  const GAP = 3, LEN = firing ? 7 : 6;
  const arms = [
    [x - GAP - LEN, y, LEN, 1],   // 左
    [x + GAP + 1, y, LEN, 1],     // 右
    [x, y - GAP - LEN, 1, LEN],   // 上
    [x, y + GAP + 1, 1, LEN],     // 下
  ];
  // 先铺一层深色底，保证在亮星云 / 爆炸 / 白色弹幕上依然读得出来
  ctx.fillStyle = '#0a0c18';
  for (const [ax, ay, aw, ah] of arms) ctx.fillRect(ax - 1, ay - 1, aw + 2, ah + 2);
  ctx.fillStyle = col;
  for (const [ax, ay, aw, ah] of arms) ctx.fillRect(ax, ay, aw, ah);
  // 中心 1px 点
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(x, y, 1, 1);
  // 四角刻度：开火时往外弹一格，"枪在响"这件事要有画面反馈
  const R = firing ? 13 : 11;
  ctx.fillStyle = col;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.fillRect(x + sx * R - (sx > 0 ? 0 : 2), y + sy * R - (sy > 0 ? 0 : 2), 2, 2);
  }
}

// ============ 屏外敌人指示器 ============
// 世界放大到 3 倍之后，敌人经常停在视口外面 —— 这时「剩余 6」却一个都看不见，
// 玩家会以为卡了；极端情况（敌人被推到远角、玩家又找不到）会拖成整段打不完。
// 所以在视口四边画指向标。
//
// ⚠️ 画在**屏幕坐标**（在 render() 的 ctx.restore() 之后），所以不吃相机偏移、
//    也不吃震动 —— 否则屏幕一抖标记就跟着跳，反而更难读。
// ⚠️ 方向是从**玩家在屏幕上的位置**射出去的，不是屏幕中心：相机贴到世界边界时
//    玩家会偏离中心，用中心算出来的角度会偏。
// 标记可以出现的那一圈「安全框」。四条边内缩量不一样，因为四条边上的 HUD 高度不一样：
//   上：y=8 起是玩家血条；巨像血条（x120..360, y8..16）+ 名字（y20..34）也在这一带
//       → 有巨像时上边要让到 48，否则巨像自己的指示标会正好压在巨像名字上
//   下：y=243 起是「冲刺 / 能量」标签，y=254 起是两条槽 → 收到 H-34
//   （曾经下边只内缩 21，标记正好压在能量条上；截图里一眼就看出来「糊在 HUD 上」）
function markBox() {
  return { x0: 13, y0: G && G.boss ? 48 : 34, x1: W - 13, y1: H - 34 };
}
function offscreenTargets() {
  const { x0, y0, x1, y1 } = markBox();
  const [psx, psy] = worldToView(G.px, G.py);

  // 1) 挑出屏外的活目标，算出它相对玩家的方向
  const cells = [];
  for (const e of G.enemies) {
    if (e.dead || e.hp <= 0) continue;
    if (e.x > viewL() && e.x < viewR() && e.y > viewT() && e.y < viewB()) continue;
    const [vx, vy] = worldToView(e.x, e.y);
    // 方向：从**玩家**（不是屏幕中心）指向敌人。相机贴到世界边界时玩家会偏离中心，
    // 用中心算出来的角度会歪十几度。
    let dx = vx - psx, dy = vy - psy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    // 位置：把敌人的屏幕坐标**夹进安全框**。
    // ⚠️ 这里原本是「从玩家位置沿方向做射线、与安全框求交」，更精细（同一角落的两个方向
    //    会落在边上不同位置），但有一个退化情况：玩家自己就在安全框外时（贴着世界边界），
    //    射线起点被夹到框线上，方向又朝外 → t≈0 → 标记直接落在玩家身上（实测 y=236 而不是 240）。
    //    夹取法没有这个问题，代价只是「同角落不同方向的敌人会并成一个」—— 那本来就是合并的语义。
    const mx = clamp(vx, x0, x1), my = clamp(vy, y0, y1);
    const rank = e.boss ? 3 : e.elite ? 2 : 1;
    // 2) 靠得太近的合并成一个标记 + 计数（一整队从同一方向来，不合并就糊成一条线）。
    // ⚠️ 用**距离**合并，不用网格。网格有硬边界：两只相隔 1px、恰好骑在格线上的敌人
    //    会被算成两格（实测 3 只排成一列 → 2 格），而且格线在屏幕上还是固定的，
    //    看起来像随机的闪烁。距离合并没有这个问题。
    const MERGE = 26;
    let hit = null;
    for (const c of cells) {
      if (Math.hypot(c.x - mx, c.y - my) <= MERGE) { hit = c; break; }
    }
    if (hit) {
      hit.n++;
      if (rank > hit.rank) { hit.rank = rank; hit.x = mx; hit.y = my; hit.dx = dx; hit.dy = dy; }
    } else {
      cells.push({ x: mx, y: my, dx, dy, n: 1, rank });
    }
  }
  return cells;
}

function drawOffscreenMarkers() {
  if (state !== 'play' || G.dead || !G.enemies.length) return;
  const cells = offscreenTargets();
  if (!cells.length) return;

  // 3) 画：Boss 最大最红，精英金色，杂兵橙色。深色底保证压在星云/爆炸上也读得出
  for (const c of cells) {
    const boss = c.rank === 3, elite = c.rank === 2;
    const col = boss ? '#ff3355' : elite ? '#ffcd75' : '#ef7d57';
    const s = boss ? 1.75 : elite ? 1.35 : 1.15;
    const pulse = boss ? 1 + Math.sin(G.t * 7) * 0.12 : 1;
    const L = 7 * s * pulse, Wd = 4.6 * s * pulse;
    const px = -c.dy, py = c.dx;
    const tipX = c.x + c.dx * L, tipY = c.y + c.dy * L;
    const b1X = c.x - c.dx * L * 0.55 + px * Wd, b1Y = c.y - c.dy * L * 0.55 + py * Wd;
    const b2X = c.x - c.dx * L * 0.55 - px * Wd, b2Y = c.y - c.dy * L * 0.55 - py * Wd;
    // 深色外扩一圈（从三角形重心往外推 2px）
    // ⚠️ 标记**不透明**画。之前给杂兵压了 globalAlpha=0.9，颜色被背景混掉 ——
    //    视觉上只是「稍微暗一点」，但探针按像素比对时永远匹配不上（同类问题：
    //    精灵图里用 alpha 当亮度、结果像素校验全绿或全红）。要压暗就用尺寸，别用 alpha。
    const cx = (tipX + b1X + b2X) / 3, cy = (tipY + b1Y + b2Y) / 3;
    const push = (vx2, vy2) => { const dl = Math.hypot(vx2 - cx, vy2 - cy) || 1; return [cx + (vx2 - cx) / dl * (dl + 2.5), cy + (vy2 - cy) / dl * (dl + 2.5)]; };
    const [t2x, t2y] = push(tipX, tipY), [a2x, a2y] = push(b1X, b1Y), [b2x, b2y] = push(b2X, b2Y);
    ctx.fillStyle = '#0a0c18';
    ctx.beginPath(); ctx.moveTo(t2x, t2y); ctx.lineTo(a2x, a2y); ctx.lineTo(b2x, b2y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(b1X, b1Y); ctx.lineTo(b2X, b2Y); ctx.closePath(); ctx.fill();
    // 同格 >1 只：角标计数（Boss 单独来的时候不写，血条已经够显眼）
    if (c.n > 1) text('' + c.n, Math.round(c.x - c.dx * 9), Math.round(c.y - c.dy * 9), '#f4f4f4', 'c', 12, null);
  }
}

function render() {
  updateCam();
  ctx.save();
  // 相机：把世界坐标搬进视口。
  // ⚠️ 必须留在**这一对** save/restore 里面 —— 下面的 HUD / banner / toast / 准星 / 暗角
  //    都在 restore() 之后画，那一段继续走屏幕坐标，不会被相机带走。
  // ⚠️ translate 必须取整：非整数偏移会让整屏像素都落在半格上、糊掉
  //    （和「字号必须是 12 的整数倍」是同一类问题，不报错、只有盯图才看得出）。
  ctx.translate(Math.round(W / 2 - cam.x), Math.round(H / 2 - cam.y));
  if (G.shake > 0.1) {
    ctx.translate(Math.round(rand(-G.shake, G.shake)), Math.round(rand(-G.shake, G.shake)));
  }
  drawBackground();
  drawZoneSkin();      // 星区皮肤（雾 / 余烬 / 引力环 / 冰晶）：背景之上的第一层
  drawZoneBands();     // 折射带：垫在地形下面，它是空间的一部分
  // 地形压在背景之上、奇点之下：它是**场地**（世界的一部分），
  //   玩家和敌人都画在它上面（否则贴着掩体时会被自己的掩体盖住）。
  drawTerrain();
  drawHazardTop();     // EMP 预警框 / 冲击环：画在地形之上，它是「此刻正在发生」
  drawSingularity();   // 视界：奇点是**场地**不是敌人，所以压在最底层（背景之上、蛛网之下）
  drawWebs();
  // 火场画在蛛网**之上**：锻炉和织网者同场时，玩家得先看见「哪里会烧到我」
  drawFires();
  drawWakes();
  drawMines();
  drawPickups();
  drawPBullets();
  drawArrows();     // 冰封长箭与弹丸同层（它是慢速飞行体，不该盖住敌机）
  drawEnemies();
  drawDrones();
  drawPhantoms();   // 棱镜的幻影跟本体同层 —— 它「看起来就是第二个它」才成立
  drawPlayer();
  drawUndying();    // 怒火裹在船身之上：这几秒「打不死」必须是画面上最响的信息
  drawBeam();       // 射线压在船身之上：它是从炮口喷出去的，必须盖住被烧的敌机
  // 炮口射线画在世界层（它是船的一部分，跟着船走）
  if (touchMode && !BOT && state === 'play' && G && !G.dead) drawAimRay();
  drawLances();     // 光矛压在船身之上：它是「刚打出去」的一击，必须盖住一切
  drawEBullets();
  drawParts();
  drawFx();
  ctx.restore();
  // 升级 / 结算这两屏遮罩近乎全黑、和战局无关 —— HUD 在 .96 遮罩下仍会透出灰字，
  //   干脆不画；暂停页保留（遮罩只有 .55，「战场还在」的氛围是故意的）。
  if (state !== 'upgrade' && state !== 'over') {
    drawHUD();
    drawBanners();
    drawToasts();
  }
  if (state === 'play' && !G.dead) { drawCrosshair(); drawOffscreenMarkers(); }
  // 杆环是**屏幕空间**的 UI，压在所有东西之上（弹幕、爆炸、HUD 都别想盖住它）
  if (touchMode && !BOT && state === 'play' && G && !G.dead) drawSticks();
  drawBlackout();   // 星蚀的熄灭战场：压在世界层之上、HUD **之下**
  // 红色暗角：低血量常驻脉动 + 受击时的一记重闪（取两者较强的一个）
  const S = G.S;
  const lowA = (S.hp / S.maxHp < 0.3 && !G.dead) ? 0.18 + Math.sin(G.t * 6) * 0.06 : 0;
  const a = Math.max(lowA, G.vign * 0.45);
  if (a > 0.01) {
    ctx.globalAlpha = a; ctx.fillStyle = '#e04060';
    ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, H - 3, W, 3);
    ctx.fillRect(0, 0, 3, H); ctx.fillRect(W - 3, 0, 3, H);
    ctx.globalAlpha = 1;
  }
  // 触屏超载容器的水位。它是 DOM 元素、和画布无关，但必须跟着能量走 ——
  // 放在 render 末尾是因为「这一帧的能量」到这儿才是最新的。
  if (touchMode) syncOdBtn();
}

// 标题页背景：缓慢漂移的星野
function renderTitleBg() {
  const set = STARSETS[0];
  ctx.fillStyle = set.bg; ctx.fillRect(0, 0, W, H);
  const t = performance.now() / 1000;
  for (let L = 0; L < 3; L++) {
    const tile = set.layers[L];
    const sp = [6, 14, 26][L];
    const ox = -((t * sp) % 64), oy = -((t * sp * 0.3) % 64);
    for (let y = oy - 64; y < H + 64; y += 64)
      for (let x = ox - 64; x < W + 64; x += 64)
        ctx.drawImage(tile, Math.round(x), Math.round(y));
  }
}

// ============ UI / 状态机 ============
function showOverlay(id) {
  for (const o of document.querySelectorAll('.ov')) o.classList.toggle('hidden', o.id !== id);
  wrap.classList.toggle('playing', !id);
  // 中英切换按钮只在标题页出现。⚠️ 用 #wrap 上的 class 控制，不用内联 style ——
  //    .langbtn 有自己的 z-index/定位，内联 display 会把它和 CSS 里的规则搅在一起。
  wrap.classList.toggle('showlang', id === 'title');
}
function toTitle() {
  state = 'title'; G = null;
  Sound.setMode('title'); Sound.music(true);
  showOverlay('title');
  renderTitle();
}
// 标题页的**动态**内容（静态文案走 data-i18n）。抽出来是为了切语言时能原地重刷。
function renderTitle() {
  checkUnlocks(true);
  renderVolume();
  syncMuteBtn();
  const locked = HULLS.filter(h => !hullUnlocked(h));
  const bits = [];
  if (SAVE.best) bits.push(T('title.best', SAVE.best));
  // 无尽打通之后 maxWave 会超过 WAVES，再写 "N/12" 就自相矛盾了
  if (SAVE.maxWave) bits.push(SAVE.maxWave > WAVES
    ? T('title.maxtier', SAVE.maxWave, eTier(SAVE.maxWave))
    : T('title.maxwave', SAVE.maxWave));
  if (SAVE.kills) bits.push(T('title.kills', SAVE.kills));
  if (locked.length) bits.push(T('title.locked', locked.length));
  $('best').textContent = bits.join(' · ');
  // 「继续航程」只在真的有续档快照时出现。有存档时把「开始航行」降级成普通按钮，
  // 免得屏幕上并排两个高亮主按钮，让人不敢点。
  const cb = $('btn-continue'), sb = $('btn-start'), xb = $('btn-clrrun');
  if (SAVE.run) {
    const hh = HULLS.find(h => h.id === SAVE.run.hull);
    cb.textContent = T('title.continueW', SAVE.run.wave, hh ? name1(hh) : T('title.unknown'));
    cb.classList.remove('hidden');
    sb.classList.remove('primary');
    xb.classList.remove('hidden');
  } else {
    cb.classList.add('hidden');
    sb.classList.add('primary');
    xb.classList.add('hidden');
  }
}
function openHangar() {
  state = 'hangar';
  showOverlay('hangar');
  renderHangar();
  hullScrollTo(hullSelOff(), true);   // 开面板时直接把选中那台摆到眼前，别播滑动动画
}
// 操作说明的「从哪来回哪去」。之前 返回 写死回标题页 ——
// 从暂停面板翻说明书再返回，会直接把你踢出这一局。
let helpFrom = 'title';
function openHelp() {
  helpFrom = (state === 'pause' || state === 'hangar' || state === 'title') ? state : 'title';
  state = 'help';
  showOverlay('help');
}
function closeHelp() {
  if (helpFrom === 'pause') { state = 'play'; togglePause(); }
  else if (helpFrom === 'hangar') openHangar();
  else toTitle();
}

// ============ 图鉴（搬《奇点回响》logbook 的上半部分） ============
// 回响那边是「航行日志」里塞图鉴（20 敌型 / 6 巨像 / 3 词缀 / 7 船体）+ 成就星图。
// 本作先把图鉴做出来：**四个分类全部从现有数据表派生**（ETYPES / BOSSES / HULLS / MODULES），
// 新增敌型只要带上 trait 就自动进图鉴 —— 不另建一张文案表，也就永远不会和主数据脱节。
const CODEX_TABS = [
  { id: 'enemy', key: 'codex.tab.enemy' },
  { id: 'boss',  key: 'codex.tab.boss' },
  { id: 'hull',  key: 'codex.tab.hull' },
  { id: 'mod',   key: 'codex.tab.mod' },
];
let codexTab = 'enemy';
let codexFrom = 'title';     // 从哪打开的，返回就回哪（和 helpFrom 一个套路）

function codexEntries(kind) {
  if (kind === 'boss') return Object.keys(BOSSES).map(k => {
    const b = BOSSES[k];
    return { id: k, name: name1(b), trait: L(b, 'trait'), seen: !!SAVE.seen[k], spr: b.spr };
  });
  if (kind === 'hull') return HULLS.map(h => ({
    id: h.id, name: name1(h), trait: L(h, 'trait'), seen: !!SAVE.seen[h.id], hull: h.id,
  }));
  if (kind === 'mod') return MODULES.map(m => ({
    id: m.id, name: L(m, 'name'), trait: L(m, 'desc'), seen: !!SAVE.seen[m.id],
    mod: m.id, modLv: m.max, type: m.type,
  }));
  return Object.keys(ETYPES).map(k => {
    const c = ETYPES[k];
    return { id: k, name: L(c, 'name'), trait: L(c, 'trait'), seen: !!SAVE.seen[k], spr: c.spr };
  });
}
function openCodex() {
  codexFrom = (state === 'pause' || state === 'hangar' || state === 'over' || state === 'title') ? state : 'title';
  state = 'codex';
  showOverlay('codex');
  drawCodex();
}
function closeCodex() {
  if (codexFrom === 'pause') { state = 'play'; togglePause(); }
  else if (codexFrom === 'hangar') openHangar();
  else if (codexFrom === 'over') { state = 'over'; showOverlay('over'); }
  else toTitle();
}
// 图鉴小图：敌型 / 巨像走 SPR[spr].r[0]，船体走 SHIPSET[id].imgs[0]，
// 模块走 attachIcon（配件美术，满级形态）。
// ⚠️ 放大要取整（保住像素锐利），缩小才按比例 —— 巨像精灵是 2x 烘焙的，比 40px 画布大。
function drawCodexArt(x, e) {
  const cv = x.canvas;
  let img = null;
  if (e.mod) img = attachIcon(e.mod, e.modLv || 1, cv.width);
  else if (e.hull) { const s = SHIPSET[e.hull]; if (s && s.imgs) img = s.imgs[0]; }
  else if (e.spr) { const st = SPR[e.spr]; if (st && st.r && st.r.length) img = st.r[0]; }
  if (!img || !img.width) return;
  if (e.mod) {                             // 图标已经是目标尺寸，直接 1:1 贴
    if (!e.seen) x.globalAlpha = 0.22;
    x.drawImage(img, 0, 0);
    x.globalAlpha = 1;
    return;
  }
  let k = Math.min(cv.width / img.width, cv.height / img.height);
  if (k >= 1) k = Math.floor(k);
  const w = img.width * k, h = img.height * k;
  if (!e.seen) x.globalAlpha = 0.22;      // 没遭遇过：只留个剪影
  x.drawImage(img, Math.round((cv.width - w) / 2), Math.round((cv.height - h) / 2), w, h);
  x.globalAlpha = 1;
}
function drawCodex() {
  const list = codexEntries(codexTab);
  const got = list.filter(e => e.seen).length;
  $('codex-count').textContent = T('codex.count', got, list.length);
  $('codex-tabs').innerHTML = CODEX_TABS.map(t =>
    '<button class="btn small' + (t.id === codexTab ? ' primary' : '') +
    '" data-act="cdx-' + t.id + '">' + T(t.key) + '</button>').join('');
  const box = $('codex-grid');
  box.innerHTML = '';
  for (const e of list) {
    const el = document.createElement('div');
    el.className = 'cde' + (e.seen ? ' seen' : '');
    // ⚠️ 画布从 40 提到 48：敌人精灵放大到 2x 之后，40px 的格子只能整数放大 1 倍
    //    （`k = Math.floor(min(40/w, 40/h))`，22px 宽 → k=1），图鉴里反而**变小**了。
    //    48 让 2x 的杂兵能再整 2 倍（22×18 → 44×36），比改动前还大一圈。
    el.innerHTML = '<canvas width="48" height="48"></canvas>'
      + '<div class="cdn">' + (e.seen ? e.name : T('codex.unknown')) + '</div>'
      + '<div class="cdt">' + (e.seen ? e.trait : T('codex.unseen')) + '</div>';
    box.appendChild(el);
    const cv = el.querySelector('canvas');
    if (cv) {
      const x = cv.getContext('2d');
      x.imageSmoothingEnabled = false;
      drawCodexArt(x, e);
    }
  }
  box.scrollTop = 0;
}
// ---- 机库滑轨（7 台船体 · 单行 650px 装不进 480px）----
// #hull-view 是裁切视口，#hulls 靠 transform 位移（CSS 见 style.css）。
// ⚠️ 翻页是两个独立 act（hpage-prev / hpage-next），**不是**读 data-dir：
//    委托里的 handleAct 只拿到 act 字符串，拿不到触发元素 —— 和图鉴四个页签同一条理由。
const HULL_CARD_W = 86, HULL_GAP = 8, HULL_PAD = 9;
let hullOff = 0;
function hullRowW() { return HULL_PAD * 2 + HULLS.length * HULL_CARD_W + Math.max(0, HULLS.length - 1) * HULL_GAP; }
function hullMaxOff() { return Math.max(0, hullRowW() - W); }
function hullPerPage() { return Math.max(1, Math.floor((W - HULL_PAD * 2 + HULL_GAP) / (HULL_CARD_W + HULL_GAP))); }
function hullScrollTo(off, instant) {
  hullOff = Math.max(0, Math.min(hullMaxOff(), Math.round(off)));
  const row = $('hulls');
  if (row) {
    row.style.transition = instant ? 'none' : '';
    row.style.transform = 'translateX(' + (-hullOff) + 'px)';
  }
  // 到头了就把箭头按灰：按下去没反应、又没有任何提示，玩家会以为按钮坏了
  const p = document.querySelector('.hpage[data-dir="-1"]'), n = document.querySelector('.hpage[data-dir="1"]');
  if (p) p.disabled = hullOff <= 0;
  if (n) n.disabled = hullOff >= hullMaxOff();
}
// 让选中那张整张露出来：已经在窗口里就不动，否则贴左/贴右对齐（留 HULL_PAD 呼吸位）
function hullSelOff() {
  const left = HULL_PAD + hangarSel * (HULL_CARD_W + HULL_GAP);
  const right = left + HULL_CARD_W;
  if (left < hullOff + HULL_PAD) return left - HULL_PAD;
  if (right > hullOff + W - HULL_PAD) return right - W + HULL_PAD;
  return hullOff;
}
function hullPage(dir) {
  hullScrollTo(hullOff + dir * hullPerPage() * (HULL_CARD_W + HULL_GAP));
  Sound.sfx.select();
}

function renderHangar() {
  // 每次进机库都重算一次解锁：上一局可能刚好达标
  checkUnlocks(true);
  // 选中的那台要是锁着（比如刚解锁后重排），退到第一台可用的
  if (HULLS[hangarSel] && !hullUnlocked(HULLS[hangarSel])) {
    hangarSel = Math.max(0, HULLS.findIndex(hullUnlocked));
  }
  const box = $('hulls'); box.innerHTML = '';
  HULLS.forEach((h, i) => {
    const locked = !hullUnlocked(h);
    const el = document.createElement('div');
    el.className = 'hull' + (i === hangarSel ? ' sel' : '') + (locked ? ' lock' : '');
    el.style.setProperty('--c', h.color);
    // ⚠️ 英文模式下**不渲染** .hen 那一行：它是给中文界面当英文副标题的，
    //    英文模式下 hname 本身就是英文，再来一行就重复了 —— 而且白白占掉 15px
    //    （.hull 是固定 168px 高，英文描述比中文长，正缺这点高度）。
    el.innerHTML = `<div class="tag">${locked ? T('hangar.locked') : L(h, 'tag')}</div>
      <canvas width="64" height="64"></canvas>
      <div class="hname">${name1(h)}</div>
      ${isEn() ? '' : `<div class="hen">${h.en}</div>`}
      <div class="hdesc">${locked ? T('hangar.unlockCond', L(h.unlock, 'text'))
                                  : L(h, 'desc').replace(/\n/g, '<br>')}</div>`;
    const c = el.querySelector('canvas'), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const S = SHIPSET[h.id] && SHIPSET[h.id].imgs ? SHIPSET[h.id] : null;
    if (S) {
      const img = S.imgs[0];
      if (locked) x.globalAlpha = 0.22;
      x.drawImage(img, 32 - S.half, 32 - S.half);
      x.globalAlpha = 1;
    }
    // ⚠️ 这里不再挂 el.onclick：选船统一走 document 上的指针委托。
    //    两条路径并存时，委托里的 renderHangar() 会先把这个节点换掉，
    //    随后冒泡上来的 onclick 作用在一个已经脱离文档的节点上 —— 白跑一趟还容易出错。
    el.dataset.hull = h.id;
    box.appendChild(el);
  });
  const h = HULLS[hangarSel];
  const locked = !hullUnlocked(h);
  $('hull-detail').innerHTML = locked
    ? `<div class="hstat">${T('hangar.status')} <u>${T('hangar.lockedV')}</u></div>
       <div class="hstat">${T('hangar.cond')} <u>${L(h.unlock, 'text')}</u></div>
       <div class="hstat">${T('hangar.prog')} <u>${unlockProgress(h)}</u></div>`
    : `<div class="hstat">${T('hangar.hp')} <u>${h.hp}</u></div>
       <div class="hstat">${T('hangar.spd')} <u>${Math.round(h.spd * 100)}%</u></div>
       <div class="hstat">${T('hangar.dmg')} <u>${Math.round(h.dmg * 100)}%</u></div>
       <div class="hstat">${T('hangar.rate')} <u>${Math.round(h.rate * 100)}%</u></div>`;
  // 选中那台可能是第 6、7 台（默认在窗口外）→ 滑轨跟上
  hullScrollTo(hullSelOff(), false);
}

function moveHangar(dir) {
  // 跳过未解锁的船体，别让方向键卡在锁上
  for (let i = 1; i <= HULLS.length; i++) {
    const n = (hangarSel + dir * i + HULLS.length * 4) % HULLS.length;
    if (hullUnlocked(HULLS[n])) {
      if (n === hangarSel) return;
      hangarSel = n; Sound.sfx.lock(); renderHangar(); return;
    }
  }
}
// 点未解锁的船体：锁音 + 详情栏抖一下。只有音效没有画面反馈，玩家会以为按钮坏了。
function denyDetail() {
  const el = $('hull-detail');
  el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
}
function pickHull(i) {
  if (i < 0 || i >= HULLS.length || i === hangarSel) return;
  const h = HULLS[i];
  if (!hullUnlocked(h)) { Sound.sfx.lock(); denyDetail(); return; }
  hangarSel = i; Sound.sfx.select(); renderHangar();
}

// ============ 续档：标题页「继续航程」 ============
// 《奇点回响》是 5 个存档槽位 + 30 秒自动保存。本作只留**一份**快照，两个理由：
//   ① roguelike 一局本来就是一次性的，玩家真正想要的是「别把我打到第 9 段的局弄丢」；
//   ② #wrap 只有 480x270 —— 槽位网格会把面板顶出框外（满装配的暂停面板已经踩过一次，
//      见 style.css 里 .ov 那条注释）。真要做槽位，得先腾出一整块面板出来。
// 落快照的时机是**每段开场**：这时整局状态是干净的（没有残敌、没有待生成的队列），
// 恢复时直接 startWave(w) 重开这一段就行 —— 比中途快照（要还原敌人坐标 / 血量 / 场上弹幕）
// 稳得多。代价是「从本段开头继续」而不是「从你退出的那一秒继续」，可以接受。
function snapshotRun() {
  if (!G || G.dead) return;
  SAVE.run = {
    hull: G.S.hull, wave: G.wave, score: G.score, level: G.level,
    xp: G.xp, xpNext: G.xpNext, dust: G.dust, kills: G.kills,
    mods: Object.assign({}, G.mods), hp: Math.round(G.S.hp),
    won: G.won ? 1 : 0, t: Math.round(G.t * 10) / 10, at: Date.now(),
  };
  writeSave();
}
function clearRun() { if (SAVE.run) { SAVE.run = null; writeSave(); } }
// ⚠️ 模块必须**按等级一级一级重放**：apply() 是就地改数值的，而且有些卡的逻辑挂在等级上
//   （「冲角装甲」的首级射速惩罚只在 n === 1 时结算一次）。把最终属性直接写回去会丢掉这些，
//   续档重放还会把惩罚叠好几遍 —— 和 choose() 里那条注释是同一件事。
function replayMods(mods) {
  for (const id in mods) {
    const m = MODULES.find(v => v.id === id);
    if (!m) continue;                     // 存档里有已被删掉的卡：跳过，别炸掉整个恢复流程
    const n = Math.min(mods[id] | 0, m.max);
    for (let lv = 1; lv <= n; lv++) {
      m.apply(G.S, lv);
      if (lv >= m.max && m.bloom) m.bloom(G.S);
    }
    G.mods[id] = n;
  }
  G.S.hp = Math.min(G.S.hp, G.S.maxHp);
  recalcSynergies();
}
function resumeRun() {
  const r = SAVE.run;
  if (!r) return false;
  const hull = HULLS.find(h => h.id === r.hull);
  if (!hull || !hullUnlocked(hull)) { clearRun(); return false; }
  hangarSel = HULLS.indexOf(hull);
  G = newGame(hull.id);
  touchAim = G.ang;      // 悬浮瞄准标初始与船体同向，避免续档开局无故甩头
  G.wave = r.wave | 0 || 1;
  G.score = r.score | 0;
  G.level = r.level | 0 || 1;
  G.xp = r.xp | 0; G.xpNext = r.xpNext | 0 || 8;
  G.dust = r.dust | 0; G.kills = r.kills | 0;
  G.won = !!r.won; G.t = r.t || 0;
  replayMods(r.mods || {});
  G.S.hp = Math.min(Math.max(1, r.hp || G.S.maxHp), G.S.maxHp);
  state = 'play';
  Sound.init(); Sound.music(true); Sound.setMode('cruise');
  showOverlay(null);
  startWave(G.wave);
  return true;
}
// 暂停里「保存并退出」：先落快照再回标题，那一局就还在（标题页会出现「继续航程」）。
function saveAndQuit() {
  if (!G) return;
  snapshotRun();
  G = null;
  toTitle();
}
function startGame() {
  const h = HULLS[hangarSel];
  if (!hullUnlocked(h)) { Sound.sfx.lock(); denyDetail(); return; }
  G = newGame(h.id);
  touchAim = G.ang;      // 悬浮瞄准标初始与船体同向，避免开局无故甩头
  markSeen(h.id);        // 图鉴：船体名录
  // 调试用：?kit=3 开局直接装满 3 级，?kit=all 装满每张卡的满级。
  // 用途只有一个 —— 一眼看满装配的飞船长什么样（配件全挂满的样子），不用打一局。
  if (KIT) {
    const m = {};
    for (const md of MODULES) m[md.id] = KIT === 'all' ? md.max : Math.min(KIT, md.max);
    replayMods(m);
  }
  state = 'play';
  // 手机上开局顺手进全屏：横屏游戏被地址栏吃掉 60~80px 高度差别很大。
  // 不再卡「必须是横屏」—— 触屏下 fit() 会把竖屏视口直接转成横屏呈现。
  if (isTouchDevice() && !document.fullscreenElement && !document.webkitFullscreenElement) {
    toggleFullscreen();
  }
  Sound.init(); Sound.music(true); Sound.setMode('cruise');
  showOverlay(null);
  startWave(1);
}
function togglePause() {
  if (state === 'play') {
    state = 'pause';
    renderPause();
    showOverlay('pause');
  } else if (state === 'pause') {
    state = 'play'; showOverlay(null);
  }
}
// 暂停面板的**动态**内容。⚠️ 必须和 togglePause 分开：切语言时要原地重刷，
// 而 togglePause 在 state==='pause' 时是「关掉暂停」，直接调它会把面板关掉。
function renderPause() {
  if (!G) return;
  $('pause-stats').textContent = T('pause.stats', G.wave, G.kills, G.score, fmtTime(G.t));
  const modChips = Object.keys(G.mods).map(id => {
    const m = MODULES.find(v => v.id === id);
    const maxed = G.mods[id] >= m.max;
    return `<span class="chip t-${m.type}${maxed ? ' maxed' : ''}">${L(m, 'name')} ${G.mods[id]}</span>`;
  }).join('');
  const synChips = Object.keys(G.syn).map(id => {
    const sy = SYNERGIES.find(s => s.id === id);
    return sy ? `<span class="chip t-syn">${T('pause.synChip', L(sy, 'name'))}</span>` : '';
  }).join('');
  $('build').innerHTML = modChips
    ? modChips + synChips
    : `<span class="dim">${T('pause.noMods')}</span>`;
  drawShipView();
  renderVolume();
  syncMuteBtn();
}
// 静音按钮的文案：中文模式下 handleAct('mute') 原本把它改成「声音 关/开」，
// 切语言后要跟着刷新，所以抽成一个函数。
function syncMuteBtn() {
  const b = $('btn-mute'); if (!b) return;
  b.textContent = Sound.muted ? T('pause.muteOff') : T('pause.muteOn');
}
// 重抽按钮的文案（空卡池时它是唯一的出口卡，必须跟着语言/次数一起刷）
function syncRerollBtn() {
  const b = $('btn-reroll'); if (!b) return;
  if (!choices.length) { b.disabled = true; b.textContent = T('up.rerollNone'); return; }
  b.disabled = rerollLeft <= 0;
  b.textContent = rerollLeft > 0 ? T('up.reroll', rerollLeft) : T('up.rerollUsed');
}

let overFresh = [], overBest = false;   // 结算页的两个「只算一次」的结果（切语言时重刷要复用）
function gameOver() {
  state = 'over';
  const S = G.S;
  const isBest = G.score > SAVE.best;
  if (isBest) SAVE.best = G.score;
  // 累计统计：解锁条件就是读这几个数
  SAVE.kills += G.kills;
  SAVE.runs += 1;
  if (G.wave > SAVE.maxWave) SAVE.maxWave = G.wave;
  if (G.won) SAVE.won += 1;
  // 航行日志：只留最近 LOG_MAX 局
  SAVE.log.push({
    hull: G.S.hull, hullName: G.S.hullName, wave: G.wave, kills: G.kills,
    score: G.score, t: Math.round(G.t * 10) / 10, won: G.won ? 1 : 0, at: Date.now(),
  });
  if (SAVE.log.length > LOG_MAX) SAVE.log = SAVE.log.slice(-LOG_MAX);
  writeSave();
  // 这一局已经结束了 —— 续档快照作废，标题页不该再挂着「继续航程」
  clearRun();
  // ⚠️ 这两个结果**只算一次**（gameOver 会写盘 / 加累计），所以缓存在外面给 renderOver 复用
  overFresh = checkUnlocks();
  overBest = isBest;
  renderOver();
  showOverlay('over');
}

// 结算页的**动态**内容。⚠️ 不能把上面那段塞进这里 —— 上面会改 SAVE（击坠 / 局数 / 最佳），
// 切一次语言就多记一局。
function renderOver() {
  if (!G) return;
  $('over-title').textContent = G.won ? T('over.win') : T('over.lose');
  $('over-title').className = 'over-title' + (G.won ? ' win' : '');
  $('over-sub').textContent = G.won
    ? (G.wave > WAVES
      ? T('over.subWinEndless', G.wave, eTier(G.wave))
      : T('over.subWin'))
    : T('over.subLose', G.wave);
  $('over-stats').innerHTML = `
    <div><span>${T('over.score')}</span><b>${G.score}</b></div>
    <div><span>${T('over.kills')}</span><b>${G.kills}</b></div>
    <div><span>${T('over.wave')}</span><b>${G.wave > WAVES ? T('over.waveN', G.wave) : T('over.waveOf', G.wave, WAVES)}</b></div>
    <div><span>${T('over.level')}</span><b>${G.level}</b></div>
    <div><span>${T('over.dust')}</span><b>${G.dust}</b></div>
    <div><span>${T('over.time')}</span><b>${fmtTime(G.t)}</b></div>`;
  const unlocked = overFresh.map(h => T('over.unlock', name1(h))).join(' · ');
  $('over-rank').innerHTML = (overBest ? `<b>${T('over.newBest')}</b>` : T('over.best', SAVE.best))
    + (unlocked ? ' · <b>' + unlocked + '</b>' : '');
  renderLog();
}

// 最近几局的航行日志（结算页表格）
function renderLog() {
  const box = $('over-log');
  if (!box) return;
  const rows = SAVE.log.slice().reverse();
  if (!rows.length) { box.innerHTML = `<div class="dim">${T('log.empty')}</div>`; return; }
  box.innerHTML = `<div class="logrow head"><span>${T('log.ship')}</span><span>${T('log.wave')}</span>`
    + `<span>${T('log.kills')}</span><span>${T('log.score')}</span></div>`
    + rows.map((r, i) => {
      const hull = HULLS.find(h => h.id === r.hull);
      const nm = (hull ? name1(hull) : (r.hullName || '—'));
      const cls = i === 0 ? 'logrow now' : 'logrow';
      return `<div class="${cls}"><span>${nm}${r.won ? T('log.win') : ''}</span>`
        + `<span>${r.wave > WAVES ? T('over.waveN', r.wave) : T('over.waveOf', r.wave, WAVES)}</span>`
        + `<span>${r.kills}</span><span>${r.score}</span></div>`;
    }).join('');
}

// 音量滑杆：页面上所有 .volbox 都会渲染一份
function renderVolume() {
  for (const el of document.querySelectorAll('.volbox')) {
    el.innerHTML = `<label class="vol"><span>${T('vol.music')}</span>`
      + `<input type="range" min="0" max="10" step="1" value="${Math.round(SAVE.bgm * 10)}" data-vol="bgm">`
      + `</label><label class="vol"><span>${T('vol.sfx')}</span>`
      + `<input type="range" min="0" max="10" step="1" value="${Math.round(SAVE.sfx * 10)}" data-vol="sfx">`
      + '</label>';
    for (const inp of el.querySelectorAll('input')) {
      inp.addEventListener('input', () => {
        SAVE[inp.dataset.vol] = +inp.value / 10;
        writeSave(); Sound.setVolumes(SAVE);
        if (inp.dataset.vol === 'sfx' && +inp.value > 0) Sound.sfx.select();
      });
      // 拖滑杆时不要被全局按键/鼠标逻辑抢走
      inp.addEventListener('pointerdown', e => e.stopPropagation());
    }
  }
}

// ============ 升级选卡 ============
let choices = [], rerollLeft = 1;
const UP_ARM = 700;
function openUpgrade() {
  rerollLeft = 1;
  rollChoices();
  state = 'upgrade';
  G.upOpen = performance.now();
  showOverlay('upgrade');
  syncRerollBtn();
}
// 能力选择上限（借鉴 singularity-echo 的「只能选 6 个能力型 / 6 个数值型」）。
// ⚠️ 按「**不同模块种类**」计数，不是按总等级 —— 一个模块升到 3 级只占 1 个坑位。
//    weapon 也并入「能力型」（与 ability 共用 6 个坑），stat 单列「数值型」6 个坑。
const TYPE_CAP = { ability: 6, stat: 6 };
function superType(t) { return t === 'stat' ? 'stat' : 'ability'; }
function countType(t) {
  const st = superType(t);
  let n = 0;
  for (const m of MODULES) if (G.mods[m.id] && superType(m.type) === st) n++;
  return n;
}
function rollChoices() {
  const pool = MODULES.filter(m => {
    const lv = G.mods[m.id] || 0;
    if (lv >= m.max) return false;            // 已满级，不再出现
    if (lv > 0) return true;                  // 已持有 → 允许继续升级（不受坑位上限约束）
    return countType(m.type) < (TYPE_CAP[superType(m.type)] || 99);  // 新模块受坑位上限约束
  });
  // 洗牌取三
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = irand(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  choices = a.slice(0, 3);
  renderCards();
}
// 卡池抽空时的唯一出口。
// ⚠️ 不加这个，玩家会永久卡在升级面板上：卡池空 → 一张卡都不渲染，
//    面板上只剩「重抽」（重抽也抽不出东西，次数用完还会禁用），
//    Escape/Enter/Space/1 全部无效 —— 是真死路，不是理论问题。
function closeUpgrade() {
  if (state !== 'upgrade') return;
  G.score += 200 + G.wave * 40;   // 白升一级总得给点什么
  G.S.hp = G.S.maxHp;
  toast(T('toast.allMax'), T('toast.allMaxSub'), '#ffcd75', 2.2);
  state = 'play';
  showOverlay(null);
}
// 这张卡选下去会触发哪些协同（用于卡面预告）
function synergyPreview(m) {
  const will = { ...G.mods };
  will[m.id] = (will[m.id] || 0) + 1;
  return SYNERGIES.filter(sy => !G.syn[sy.id] && will[sy.a] > 0 && will[sy.b] > 0);
}
function renderCards() {
  const box = $('cards');
  box.classList.remove('locked');
  // 卡池抽空：给一张明确的出口卡，别留一个只有「重抽」的死面板
  if (!choices.length) {
    box.innerHTML = `<div class="card t-stat" data-act="skipup" tabindex="0">
      <div class="tag">${T('up.maxTag')}</div>
      <div class="glyph">${isEn() ? 'M' : '满'}</div>
      <div class="name">${T('up.maxName')}</div>
      <div class="desc">${T('up.maxDesc')}</div>
      <div class="syn">&nbsp;</div>
      <div class="key">${T('up.maxKey')}</div>
    </div>`;
    $('up-sub').textContent = T('up.subMaxed', G.level);
    syncRerollBtn();
    return;
  }
  box.innerHTML = choices.map((m, i) => {
    const lv = G.mods[m.id] || 0;
    const nextLv = lv + 1;
    const isMax = nextLv >= m.max;
    let pips = '';
    for (let k = 0; k < m.max; k++) pips += `<i class="${k < lv ? 'on' : k === lv ? 'nx' : ''}"></i>`;
    const syn = synergyPreview(m);
    const synHtml = syn.length
      ? `<div class="syn">${T('up.syn', syn.map(s => L(s, 'name')).join(' · '))}</div>`
      : (lv > 0 ? '' : '<div class="syn dim2">&nbsp;</div>');
    return `<div class="card t-${m.type}${isMax ? ' max' : ''}" data-i="${i}">
      <div class="tag">${typeName(m.type)}</div>
      ${lv === 0 ? '<div class="new">NEW</div>' : ''}
      ${isMax ? '<div class="mx">MAX</div>' : ''}
      <div class="glyph"><canvas width="40" height="40" data-gic="${i}"></canvas></div>
      <div class="name">${L(m, 'name')}</div>
      <div class="pips">${pips}</div>
      <div class="desc">${L(m, 'desc').replace(/\n/g, '<br>')}</div>
      ${synHtml}
      <div class="key">[${i + 1}]</div>
    </div>`;
  }).join('');
  // 卡面图标 = 这一级装上船之后**会长出来的那块配件**（同一套美术，转成机首朝上）。
  // 所以卡面看到的就是舰体上要长出来的东西，不是另画一套图标。
  for (const cv of box.querySelectorAll('canvas[data-gic]')) {
    const m = choices[+cv.dataset.gic];
    if (!m) continue;
    const nextLv = Math.min((G.mods[m.id] || 0) + 1, m.max);
    const ic = attachIcon(m.id, nextLv, 40);
    if (ic) cv.getContext('2d').drawImage(ic, 0, 0);
  }
  const synCount = Object.keys(G.syn).length;
  const abilN = countType('ability'), statN = countType('stat');
  $('up-sub').textContent = T('up.sub', G.level, Object.keys(G.mods).length)
    + (synCount ? T('up.subSyn', synCount) : '')
    + T('up.capAbil', abilN, TYPE_CAP.ability) + T('up.capStat', statN, TYPE_CAP.stat);
  syncRerollBtn();
}
function choose(i, viaPointer) {
  if (state !== 'upgrade') return;
  if (viaPointer && performance.now() - G.upOpen < UP_ARM) return;
  const m = choices[i]; if (!m) return;
  const lv = G.mods[m.id] || 0;
  // 防御：新模块不能超出 能力型/数值型 坑位上限（rollChoices 已挡，这里双保险）
  if (lv === 0 && countType(m.type) >= (TYPE_CAP[superType(m.type)] || 99)) return;
  G.mods[m.id] = lv + 1;
  markSeen(m.id);        // 图鉴：模块名录
  // ⚠️ 第二个参数是本卡当前等级。绝大多数卡用不到，但「冲角装甲」的首级惩罚
  //    （射速 -30%）必须只在 n === 1 时结算一次 —— 少了它续档重放会把惩罚叠三次。
  m.apply(G.S, lv);
  if (lv >= m.max && m.bloom) {
    // 质变：满级那一刻额外执行一次，给音效 + 横幅（不是静默加数值）
    m.bloom(G.S);
    Sound.sfx.bloom();
    banner(T('bn.bloom', L(m, 'name')), T('bn.bloomSub'), '#ffcd75', 2.4);
    freeze(0.12); addShake(3);
  } else {
    Sound.sfx.select();
    toast(L(m, 'name'), T('toast.fitLv', lv), '#ffcd75');
  }
  G.S.hp = Math.min(G.S.hp, G.S.maxHp);
  recalcSynergies();
  state = 'play';
  showOverlay(null);
}
function reroll(viaPointer) {
  if (state !== 'upgrade' || rerollLeft <= 0) return;
  if (viaPointer && performance.now() - G.upOpen < UP_ARM) return;
  rerollLeft--;
  rollChoices();
  G.upOpen = performance.now();
  Sound.sfx.ready();
  syncRerollBtn();
}

// ============ 输入 ============
function onKey(code, down) {
  if (down) keys[code] = true; else delete keys[code];
  if (!down) return;
  Sound.init();
  if (code === 'KeyM') { const m = Sound.toggleMute(); toast(m ? T('toast.mute') : T('toast.unmute'), '', '#73eff7', 1); syncMuteBtn(); return; }
  if (state === 'title') {
    if (code === 'Enter' || code === 'Space') openHangar();
    return;
  }
  if (state === 'hangar') {
    if (code === 'ArrowLeft' || code === 'KeyA') { moveHangar(-1); }
    if (code === 'ArrowRight' || code === 'KeyD') { moveHangar(1); }
    if (code === 'Enter' || code === 'Space') { Sound.sfx.select(); startGame(); }
    if (code === 'Escape') toTitle();
    return;
  }
  if (state === 'play') {
    if (code === 'Escape' || code === 'KeyP') togglePause();
    if (code === 'KeyE') activateOverdrive();
    if (code === 'ShiftLeft' || code === 'ShiftRight') tryDash();
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') { /* 预留 */ }
    return;
  }
  if (state === 'upgrade') {
    if (code === 'Digit1') choose(0);
    if (code === 'Digit2') choose(1);
    if (code === 'Digit3') choose(2);
    if (code === 'KeyR') reroll();
    // 卡池抽空时唯一的出路：不然玩家会永久卡在这一屏
    if ((code === 'Enter' || code === 'Space' || code === 'Escape') && !choices.length) closeUpgrade();
    return;
  }
  if (state === 'pause') {
    if (code === 'Escape' || code === 'KeyP') togglePause();
    if (code === 'KeyR') handleAct('restart');
    if (code === 'KeyH') handleAct('title');
    return;
  }
  if (state === 'over') {
    if (code === 'Enter' || code === 'Space') { G = null; startGame(); }
    if (code === 'Escape') openHangar();
    return;
  }
  if (state === 'help' && (code === 'Escape' || code === 'Enter')) closeHelp();
}

// 屏幕坐标 → 游戏坐标。触屏竖屏视口下 #wrap 被顺时针转了 90°（见 fit()），
// 这里做对应的逆变换，否则手指点和飞船朝向会差一个 90°。
function toGame(cx, cy) {
  if (rot === 90) return [(cy - offY) / scale, (offX - cx) / scale];
  return [(cx - offX) / scale, (cy - offY) / scale];
}
// 视口坐标 → 世界坐标。`toGame` 给的是**画布/视口**坐标（准星、摇杆底座、左右半屏判定都靠它，
// 那几处必须留在屏幕空间），而瞄准、生成、碰撞全在世界空间 —— 中间就差这一个相机偏移。
function mouseWorld() { return [mouse.x + cam.x - W / 2, mouse.y + cam.y - H / 2]; }
function worldToView(x, y) { return [x - cam.x + W / 2, y - cam.y + H / 2]; }
function toWorld(cx, cy) { const g = toGame(cx, cy); return [g[0] + cam.x - W / 2, g[1] + cam.y - H / 2]; }

function setTouchMode(on) { touchMode = on; wrap.classList.toggle('touch', on); }

/* ============ 触屏按钮：开火开关 + 超载容器 ============
   右下角改成「一大一小两颗按钮 + 一个容器」：
     开火（最大，贴着右下角，拇指支点）/ 冲刺（稍小，在它左边）/
     超载（容器式：能量灌满才按得动，水位由 syncOdBtn 每帧刷）。
   ⚠️ 三者的 rect 互不重叠，间距各留 8px 以上 —— 触屏按钮挨在一起必然误触。 */

// 开火开关。
// ⚠️ 状态文字是**动态**的，所以它不走 data-i18n（applyDom 会把它按静态键写死），
//    改由 syncFireBtn() 在 boot 与 langRefresh 里各刷一次，否则切完语言
//    「开/关」两个字会留在旧语言里。
function toggleFire() {
  autoFire = !autoFire;
  if (G) G.autoFire = autoFire;
  syncFireBtn();
  if (autoFire) Sound.sfx.select(); else Sound.sfx.lock();
}
// 只置位不播音：给 boot() 定默认值用。启动时放音效会被自动播放策略拦下，
// 白记一次「用户手势」却什么也没响。
function setAutoFireSilent(v) {
  autoFire = !!v;
  if (G) G.autoFire = autoFire;
  syncFireBtn();
}
function syncFireBtn() {
  const on = G ? !!G.autoFire : autoFire;
  wrap.classList.toggle('fire-on', on);
  const b = $('btn-fire'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  const st = $('fire-state'); if (st) st.textContent = T(on ? 'touch.on' : 'touch.off');
}
// 超载容器：装满（energy >= 100）才按得动。没满就抖一下 ——
// 一颗「按下去毫无反应」的按钮，玩家只会以为它坏了。
function tryOverdrive() {
  if (G && G.energy >= 100 && G.odT <= 0) { activateOverdrive(); return; }
  const b = $('btn-od');
  if (b) { b.classList.remove('deny'); void b.offsetWidth; b.classList.add('deny'); }
}
// 把能量水位写进容器。
// ⚠️ 写的是 **width**（横向电池从左往右灌满），不是 height —— 老版本是圆形竖灌容器。
// ⚠️ 只在**值真的变了**才写 DOM：每帧无条件写 style.width 会让浏览器每帧重排一次，
//    触屏上就是白掉几帧。1% 以下的抖动直接忽略。
let odShown = -1, odReadyShown = null;
function syncOdBtn() {
  const b = $('btn-od'); if (!b) return;
  const e = G ? clamp(G.energy, 0, 100) : 0;
  const ready = e >= 100;
  if (Math.abs(e - odShown) < 1 && ready === odReadyShown) return;
  odShown = e; odReadyShown = ready;
  const f = b.querySelector('.odfill');
  if (f) f.style.width = e.toFixed(1) + '%';
  b.classList.toggle('ready', ready);
}

function handleAct(a) {
  Sound.init();
  if (a === 'hangar') openHangar();
  else if (a === 'launch') startGame();
  else if (a === 'title') toTitle();
  else if (a === 'help') openHelp();
  else if (a === 'helpback') closeHelp();
  else if (a === 'codex') openCodex();
  else if (a === 'codexback') closeCodex();
  // 图鉴页签。分成四个 act 而不是读 data-tab：委托里 handleAct 只拿到 act 字符串
  else if (a === 'cdx-enemy') { codexTab = 'enemy'; drawCodex(); }
  else if (a === 'cdx-boss') { codexTab = 'boss'; drawCodex(); }
  else if (a === 'cdx-hull') { codexTab = 'hull'; drawCodex(); }
  else if (a === 'cdx-mod') { codexTab = 'mod'; drawCodex(); }
  // ⚠️ 叫 continue 不叫 resume：暂停面板的「继续」已经把 resume 占了（= togglePause）
  else if (a === 'continue') resumeRun();
  else if (a === 'savequit') saveAndQuit();
  else if (a === 'clrrun') { clearRun(); toTitle(); }
  else if (a === 'start') openHangar();
  else if (a === 'resume') togglePause();
  else if (a === 'restart') { G = null; startGame(); }
  else if (a === 'mute') { Sound.toggleMute(); syncMuteBtn(); }
  else if (a === 'lang') toggleLang();
  else if (a === 'reroll') reroll(true);
  else if (a === 'hpage-prev') hullPage(-1);
  else if (a === 'hpage-next') hullPage(1);
  else if (a === 'skipup') closeUpgrade();
  else if (a === 'pause') togglePause();
  else if (a === 'dash') tryDash();
  // ⚠️ 走 tryOverdrive 而不是 activateOverdrive：容器没装满时要抖一下给反馈。
  else if (a === 'od') tryOverdrive();
  else if (a === 'fire') toggleFire();
  else if (a === 'full') toggleFullscreen();
}

// 安全区（刘海 / 圆角 / 手势条）。CSS 里把 env() 读进 --sa*，这里再取出来。
// 不支持 env() 的浏览器读到空串，parseFloat -> NaN，兜 0。
function safeArea() {
  const cs = getComputedStyle(document.documentElement);
  const num = k => { const v = parseFloat(cs.getPropertyValue(k)); return isNaN(v) ? 0 : v; };
  return { t: num('--sat'), b: num('--sab'), l: num('--sal'), r: num('--sar') };
}

function fit() {
  // visualViewport 在移动端比 innerHeight 准：键盘弹出 / 地址栏收放时它会跟着变
  const vv = window.visualViewport;
  const vw0 = vv ? vv.width : window.innerWidth;
  const vh0 = vv ? vv.height : window.innerHeight;
  updateLayoutMode();
  const sa = safeArea();
  const vw = Math.max(1, vw0 - sa.l - sa.r);
  const vh = Math.max(1, vh0 - sa.t - sa.b);
  // 触屏 + 竖屏视口：把 480×270 舞台顺时针转 90° 直接以横屏呈现，
  // 不再读手机物理朝向、不弹「请横屏」、不调 screen.orientation.lock。
  // 横屏视口 / 桌面端一律不转，沿用旧信箱式铺满。
  rot = (touchMode && vh > vw) ? 90 : 0;
  if (rot === 90) {
    scale = Math.min(vw / H, vh / W);
    // 旋转后舞台包围盒为 H·scale × W·scale，中心对到可用区中心
    offX = sa.l + vw / 2 + H * scale / 2;
    offY = sa.t + vh / 2 - W * scale / 2;
    wrap.style.transform = `translate(${offX}px, ${offY}px) scale(${scale}) rotate(90deg)`;
  } else {
    scale = Math.min(vw / W, vh / H);
    offX = sa.l + (vw - W * scale) / 2;
    offY = sa.t + (vh - H * scale) / 2;
    wrap.style.transform = `translate(${offX}px, ${offY}px) scale(${scale})`;
  }
}

// 触屏全屏：手机浏览器地址栏很吃高度，横屏游戏尤其需要
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  const on = d.fullscreenElement || d.webkitFullscreenElement;
  try {
    if (on) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
    else { (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' }); }
  } catch (e) { /* 桌面端不允许也无所谓 */ }
  // 全屏切换会改视口尺寸，等一帧再量
  setTimeout(fit, 60);
}
function isTouchDevice() {
  // 只认「主指针是粗的」：'ontouchstart' in window 在带触摸屏的 Windows 上也为真，
  // 那会把桌面端也误判成手机，进而在开局时弹全屏。
  return matchMedia('(pointer: coarse)').matches;
}

/* 手机端的触感反馈（作者 2026-10-03 补）。
   手机上受击只有「画面红一下 + 一声」很轻，指尖没有任何东西 —— 加一记短震最直接。
   ⚠️ iOS Safari 没有 navigator.vibrate（桌面 Chrome 反而有），所以这里：
      ① 只在触屏设备回调（不为桌面鼠标玩家加没来由的震动）；
      ② navigator.vibrate 不存在就直接返回，绝不抛异常。 */
function buzz(ms) {
  if (!isTouchDevice()) return;
  if (typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(ms); } catch (e) { /* 某些浏览器只在用户手势里允许 */ }
}

// 触屏下不再用「竖屏/横屏」分流任何 UI（游戏永远以横屏呈现，见 fit()）。
// 这里只留 coarse 判断，给 .touch-only 等类用。
function updateLayoutMode() {
  document.documentElement.classList.toggle('coarse', isTouchDevice());
}

// ============ bot（?bot=1 自动游玩，用于平衡性验证） ============
// 操控改成「A/D 转向 + W 推进」之后，bot 不再走 keys['KeyW/S/A/D']
// 那一套八向推进（那套早就和现在不是一回事了）。直接吃 G.ang + KeyW
// 两个自由度，开火仍走 mouse.down，仿真度和真人一致。
let botA = 0;
function botStep(dt) {
  if (!G) return;
  // 自动游玩必须自己把选卡面板点掉，否则会永远卡在升级界面
  if (state === 'upgrade') { choose(irand(0, 2)); return; }
  // 线性扫描，不要用网格版 nearest(999)：格子数是 (999/24)^2 ≈ 6900 个/帧，
  // 4 倍速下每帧 2.7 万次 Map 查询，纯浪费（AGENTS.md 硬纪律里那条）
  let t = null, bd = Infinity;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = (e.x - G.px) ** 2 + (e.y - G.py) ** 2;
    if (d < bd) { bd = d; t = e; }
  }
  const td = t ? Math.sqrt(bd) : 1e9;
  const nearDust = () => {
    let bp = null, bd = 150 * 150;
    for (const p of G.pickups) {
      const d = (p.x - G.px) ** 2 + (p.y - G.py) ** 2;
      if (d < bd) { bd = d; bp = p; }
    }
    return bp;
  };
  /* ⚠️ 单摇杆模型下的关键取舍：机首 = 航向 = 炮口，**掉头逃跑就是停火**。
     第一版照搬了旧的双摇杆思路（近敌时 `G.ang = targetA + PI` 背身脱离 + 一直推进），
     结果是「贴上去 → 掉头跑 → 打空 → 再贴上去」的循环，第 10 段从 ~30s 拖到 508s
     （整局 565s → 1425s）。改成：**机首永远咬住最近的敌人**，靠推进/刹车控距。 */
  let thrust = 0, brake = 0;
  if (t && td <= 190) {
    const ta = Math.atan2(t.y - G.py, t.x - G.px);
    G.ang = ta; G.aim = ta;
    // ⚠️ mouse 是视口坐标，这里给的是世界坐标 —— 必须过一次 worldToView，
    //    否则 bot 的准星（和 updatePlayer 里的瞄准）会按「相机偏移」整体歪掉。
    const mv = worldToView(G.px + Math.cos(ta) * 60, G.py + Math.sin(ta) * 60);
    mouse.x = mv[0]; mouse.y = mv[1];
    mouse.inside = true;
    if (td > 140) thrust = 1;          // 远：贴上去
    else if (td < 70) brake = 1;       // 太近：刹住，让它自己撞进火线（顺便少吃撞击）
    // 70..140 之间滑行 —— 保持全 DPS，这才是「单摇杆」的正确打法
    // 贴边时给一点向内的偏置，别把自己顶在墙角（世界大了，边界也是世界的边界）
    if (G.px < 34 || G.px > WORLD.w - 34 || G.py < 34 || G.py > WORLD.h - 34) {
      const ca = Math.atan2(WORLD.h / 2 - G.py, WORLD.w / 2 - G.px);
      G.ang = ta + Math.sin(ca - ta) * 0.5;
      thrust = 1;
    }
  } else {
    // 附近没敌人：去捡星尘（这时炮口无所谓），没星尘就绕着飘
    const bp = nearDust();
    if (bp) {
      const ba = Math.atan2(bp.y - G.py, bp.x - G.px);
      G.ang = ba; G.aim = ba; thrust = 1;
    } else {
      botA += dt * 0.5;
      G.ang = botA; G.aim = botA; thrust = 1;
    }
    mouse.inside = false;
  }
  keys['KeyW'] = thrust > 0;
  keys['KeyS'] = brake > 0;
  keys['KeyA'] = false;
  keys['KeyD'] = false;
  mouse.down = true;
  if (G.energy >= 100) activateOverdrive();
}

// ============ 主循环 ============
let acc = 0, lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  // bot 在 play 之外也要跑：升级选卡面板得靠它自己点掉
  if (BOT && G) botStep(dt);
  if (state === 'play' && G && !G.dead) {
    acc += dt * FAST;
    let guard = 0;
    while (acc >= DT && guard++ < 8) { step(DT); acc -= DT; }
    render();
  } else if (state === 'upgrade' || state === 'pause' || state === 'over') {
    if (G) render();
    else renderTitleBg();
  } else {
    renderTitleBg();
  }
}

// ============ 启动 ============
function boot() {
  // ⚠️ 必须在 fit() 之前置位 touchMode！否则首帧 fit() 还看不到触屏、不会把竖屏视口转成
  // 横屏，要等一次 resize 才转 —— 表现就是「进游戏才横屏」的突兀跳变。
  // （index.html 里的内联脚本更早就把 #wrap 转了，这里只是让 game.js 自己的 fit() 也对齐，
  //   好让后续 resize/全屏重算时保持一致。）
  if (isTouchDevice()) {
    setTouchMode(true);
    // ⚠️ 触屏必须**默认自动开火**。触屏路径上 mouse.down 永远置不上 true
    //    （mousedown 监听里把 firesTouchEvents 的合成事件全挡掉了），
    //    所以 wantFire 只剩 G.autoFire 一条支路 —— 默认关就等于「手机上半发子弹都打不出去」。
    //    桌面端不受影响（touchMode 恒 false，仍然是「按住才开火」）。
    setAutoFireSilent(true);
  }
  // 启动阶段抛异常的话，页面会永远停在 LOADING —— 把错误直接写到那一屏上，
  // 否则「白屏 / 卡 loading」只能靠猜。
  window.addEventListener('error', e => {
    if (state !== 'loading') return;
    const el = $('loading'); if (!el) return;
    el.innerHTML = '<div style="color:#ff5577">启动失败</div>'
      + '<div class="dim" style="max-width:420px;text-align:center;line-height:14px">'
      + String((e && (e.message || e.error)) || 'unknown error').slice(0, 200) + '</div>';
  });
  buildSprites();
  STARSETS = makeStarTiles();
  ROCKS = makeRocks();
  fit();
  Sound.setVolumes(SAVE);   // 音量在 AudioContext 建起来之前就能先存着
  window.addEventListener('resize', fit);
  // 手机：地址栏收放 / 转屏 / 进全屏都会改视口，只监听 window.resize 会漏事件
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fit);
    window.visualViewport.addEventListener('scroll', fit);
  }
  window.addEventListener('keydown', e => {
    const inCtl = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    // 滑杆要用方向键调音量，别把方向键吞掉（Esc 仍然交给游戏）
    if (inCtl) { if (e.code !== 'Escape') return; }
    else if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    // A/D 一按立刻切回「键盘朝向」模式 —— 否则鼠标控制下按了 A 机身却不转，会很怪
    if (state === 'play' && (e.code === 'KeyA' || e.code === 'KeyD' ||
        e.code === 'ArrowLeft' || e.code === 'ArrowRight')) aimMode = 'key';
    onKey(e.code, true);
  });
  window.addEventListener('keyup', e => onKey(e.code, false));
  window.addEventListener('blur', () => { for (const k in keys) delete keys[k]; mouse.down = false; });

  // 鼠标：动了就接管朝向（切到 'mouse' 模式）
  const upd = e => {
    // ⚠️ 挡掉触屏抬指后浏览器补发的「兼容性 mousemove」：它的坐标就是最后那个触点，
    //    照单全收会把 mouse.inside 又翻回 true，endTouch 里那条修法当场失效。
    //    sourceCapabilities.firesTouchEvents 是 Chrome 标记这类合成事件的官方位；
    //    拿不到该属性的浏览器（Safari）退化成「照旧处理」，与改动前一致。
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    const [x, y] = toGame(e.clientX, e.clientY); mouse.x = x; mouse.y = y; mouse.inside = true;
    if (state === 'play') aimMode = 'mouse';
  };
  window.addEventListener('mousemove', upd);
  window.addEventListener('mousedown', e => {
    Sound.init();
    if (e.button === 2) { if (state === 'play') tryDash(); return; }
    // 同上：合成 mousedown 也是触屏抬指后的补发事件，不能让它点亮准星
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (state === 'play') { upd(e); mouse.down = true; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('contextmenu', e => e.preventDefault());
  // 准星只在鼠标真的在窗口里时画：切出去 / 移到浏览器地址栏就收掉
  document.addEventListener('mouseleave', () => { mouse.inside = false; mouse.down = false; });

  // 触屏：左半屏拖动推进，右半屏拖动瞄准并自动开火
  const wrapEl = wrap;
  wrapEl.addEventListener('touchstart', e => {
    Sound.init(); setTouchMode(true);
    for (const t of e.changedTouches) {
      // 落在 UI 按钮上的触摸交给 document 上的 pointerdown 委托，这里不要抢
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && el.closest && el.closest('[data-act]')) continue;
      // 按「游戏坐标」分左右半屏：直接拿 clientX 跟 innerWidth/2 比，
      // 在居中的信箱式布局里会错位（左边被裁掉的那块也会被算成左半屏）。
      const [gx] = toGame(t.clientX, t.clientY);
      if (gx < W / 2 && joy.id === null) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.active = true;
      } else if (gx >= W / 2 && aimDrag.id === null) {
        // 右半屏 = 瞄准杆。原点是**落点**（游戏坐标），之后往哪拖炮口就朝哪。
        // ⚠️ 不在落点时就计算方向 —— 那时位移是 0，方向是噪声；出死区后才开始生效。
        const [ax, ay] = toGame(t.clientX, t.clientY);
        aimDrag.id = t.identifier;
        aimDrag.ox = ax; aimDrag.oy = ay;
        aimDrag.x = 0; aimDrag.y = 0; aimDrag.mag = 0;
      }
    }
  }, { passive: true });
  // ⚠️ 这里**不能** preventDefault。手指按下去只要挪一点就会触发 touchmove，
  //    一旦 preventDefault，浏览器就取消随后合成的 click —— 「点出击没反应」的根因。
  //    滚动/缩放本来就被 html,body,#wrap 上的 touch-action:none 和 overscroll-behavior 挡住了。
  wrapEl.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = (t.clientX - joy.ox) / scale, dy = (t.clientY - joy.oy) / scale;
        // 竖屏视口下舞台转了 90°，屏幕拖拽向量要先逆旋回游戏空间
        if (rot === 90) { const tx = dx; dx = dy; dy = -tx; }
        const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 40);
        joy.x = dx / m * k; joy.y = dy / m * k;
      } else if (t.identifier === aimDrag.id) {
        // 右杆：位移向量（相对落点）→ 炮口方向。
        // ⚠️ 落点与当前点都过 toGame，rot=90 的逆旋 toGame 内部已经做了，
        //    这里拿到的 dx/dy 直接就是游戏空间（= 世界方向）的位移，不需要再逆旋一遍。
        const [gx2, gy2] = toGame(t.clientX, t.clientY);
        const dx = gx2 - aimDrag.ox, dy = gy2 - aimDrag.oy;
        const m = Math.hypot(dx, dy);
        const c = m > 0 ? Math.min(1, AIM_R / m) : 0;
        aimDrag.x = dx * c; aimDrag.y = dy * c;              // 推杆：钳在环内
        aimDrag.mag = clamp((m - AIM_DZ) / (AIM_R - AIM_DZ), 0, 1);
        // ⚠️ 死区用的是**像素**不是归一化比例：手指在落点附近抖 2px 时角度能差 20° 以上，
        //    按方向更新会把炮口抖成筛子。出死区才认方向，死区内保持上一次的方向。
        if (m > AIM_DZ) touchAim = Math.atan2(dy, dx);
      } else {
        const [x, y] = toGame(t.clientX, t.clientY); mouse.x = x; mouse.y = y;
      }
    }
  }, { passive: true });
  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.active = false; joy.x = joy.y = 0; }
      else if (t.identifier === aimDrag.id) {
        // ⚠️ 松手**保留** touchAim：炮口停在最后指的方向，玩家可以「甩一下炮口」就撒手，
        //    不用一直按着。这样右手才腾得出来去点冲刺 / 超载。
        aimDrag.id = null;
        aimDrag.x = 0; aimDrag.y = 0; aimDrag.mag = 0;
      } else {
        mouse.down = false;
        // ⚠️ 抬指必须把准星一起收掉。否则 mouse 会残留在最后那个触点上，
        //    摇杆一松手，updatePlayer 里 aimMode==='mouse' 那条分支就继续生效 ——
        //    飞船一直朝那个残影慢慢转，玩家明明没在操作。桌面端不走这条路径。
        mouse.inside = false;
      }
    }
  };
  wrapEl.addEventListener('touchend', endTouch);
  wrapEl.addEventListener('touchcancel', endTouch);

  // 按钮委托
  // ⚠️ 不要用 click 委托。触屏上手指按下后只要挪动一点点，touchmove 里的
  //    preventDefault() 就会把浏览器随后合成的 click 掐掉 —— 表现是
  //    「点『出击』完全没反应」（实测复现）。pointerdown 在任何手势判定之前触发，
  //    鼠标 / 触屏 / 触控笔一套通吃，也不会被后续的 preventDefault 影响。
  function uiAct(el) {
    if (!el || !el.closest) return false;
    const b = el.closest('[data-act]');
    if (b) { handleAct(b.dataset.act); return true; }
    const c = el.closest('.card');
    if (c && state === 'upgrade') { choose(+c.dataset.i, true); return true; }
    const h = el.closest('.hull');
    if (h && state === 'hangar') { pickHull([...$('hulls').children].indexOf(h)); return true; }
    return false;
  }
  function uiHit(x, y) { return uiAct(document.elementFromPoint(x, y)); }
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', e => {
      pointerKind = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      if (e.pointerType === 'mouse' && e.button !== 0) return;   // 右键留给冲刺
      uiHit(e.clientX, e.clientY);
    });
    document.addEventListener('pointermove', e => {
      if (e.pointerType) pointerKind = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    });
  }
  // 键盘激活补丁：Tab 聚焦到 <button> 上按 Enter/Space，浏览器原生触发的是 click
  // （且 detail === 0、没有前置 pointerdown）—— 只监听 pointerdown 会把这条路整段丢掉。
  // 用 detail === 0 当判别式，触屏/鼠标点击一律放行给 pointerdown，不会重复触发。
  document.addEventListener('click', e => {
    if (e.detail !== 0) return;
    const el = e.target && e.target.closest && e.target.closest('[data-act],.card,.hull');
    if (el) uiAct(el);
  });

  // 调试接口
  window.__dbg = {
    get G() { return G; }, get state() { return state; },
    spawnBoss: id => spawnBoss(id || 'motherrock'),
    od: activateOverdrive, startWave, giveXp: n => addXp(n),
    aim: (x, y) => { mouse.x = x; mouse.y = y; mouse.inside = true; },   // 给自动化探针用
    // ⚠️ 上面那个 aim 收的是**视口**坐标（mouse 一直是视口坐标，准星按屏幕画）。
    //    探针想「朝世界里的某一点瞄准」就用这个，别自己减相机 —— 少减一次不会报错，
    //    只会让船慢慢转向一个奇怪的方向。
    aimWorld: (x, y) => { const v = worldToView(x, y); mouse.x = v[0]; mouse.y = v[1]; mouse.inside = true; },
    aimOff: () => { mouse.inside = false; },
    // 线性扫描：不要传大半径给网格版 nearest()，格子数是 (R/24)^2 会炸
    nearest: () => {
      let best = null, bd = Infinity;
      for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        const d = (e.x - G.px) ** 2 + (e.y - G.py) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },
    nextWave: () => { G.enemies.length = 0; G.spawnQueue.length = 0; G.boss = null; G.bossPending = null; finishWave(); },
    // ---- 探针专用：验证第二批敌型 / 打击感 / 协同 / 存档 ----
    spawn: (type, x, y) => spawnEnemy(type, x === undefined ? G.px + 40 : x, y === undefined ? G.py : y),
    clearEnemies: () => { G.enemies.length = 0; G.ebullets.length = 0; G.webs.length = 0; },
    killAll: () => { for (const e of G.enemies.slice()) if (e.hp > 0) killEnemy(e); },
    hit: (e, dmg, dx, dy) => damageEnemy(e, dmg, dx, dy, false, 0),
    setMods: m => { G.mods = Object.assign({}, m); recalcSynergies(); },
    clearMods: () => { G.mods = {}; G.syn = {}; },
    // 探针专用：能力选择上限验证（借鉴 echo 的 6 能力型 / 6 数值型）
    countType: t => countType(t),
    TYPE_CAP: () => ({ ...TYPE_CAP }),
    // 直接重算卡池并回传（不碰状态机，纯测过滤逻辑）
    rollPool: () => { rollChoices(); return choices.map(m => ({ id: m.id, type: m.type, lv: G.mods[m.id] || 0 })); },
    // 探针专用：把属性表恢复成「刚开局」的样子。
    // ⚠️ apply() 是就地改数值的，clearMods() 只清 mods 表 —— 不同时重置属性的话，
    //    前一组用例给射速打的 0.7 会一直留在后面的用例里，测出来的数全是错的。
    resetStats: () => { G.S = newGame(G.S.hull).S; },
    // 探针专用：按等级逐级「真实装配」一张卡（走 apply / bloom 的正常路径）。
    // ⚠️ 不能用 setMods 代替 —— setMods 只改 G.mods 这张表，一次 apply() 都不执行，
    //    属性（射速 / 伤害 / 反弹次数…）一点没变，测出来的全是假的。
    grant: (id, n = 1) => {
      const m = MODULES.find(v => v.id === id); if (!m) return null;
      for (let k = 0; k < n; k++) {
        const lv = (G.mods[id] || 0) + 1;
        if (lv > m.max) break;
        G.mods[id] = lv;
        m.apply(G.S, lv);
        if (lv >= m.max && m.bloom) m.bloom(G.S);
      }
      recalcSynergies();
      return { mods: Object.assign({}, G.mods), syn: Object.keys(G.syn) };
    },
    setPos: (x, y) => { G.px = x; G.py = y; G.vx = 0; G.vy = 0; updateCam(); },
    // 探针专用：冻结升级，并且顺手把已经弹出的三选一面板关掉。
    // 为什么需要它：任何「跑几百帧再量一个数」的探针（冲刺方向 / 移动手感 / 后坐…）
    //    都会在这几秒里靠拾取的星尘升上 1~2 级 —— 一旦 `openUpgrade()` 把 state 推到
    //    'upgrade'，主循环整体停摆，玩家再也动不了，量出来的位移是 0，探针就假红。
    //    踩到过：sv-dash-dir 12 个用例里后 4 个全是 0px，报「方向偏 90°」，其实是升级面板。
    // 冻结的是「门槛」不是「经验」：xp 照常攒，只是永远够不着 xpNext。
    freezeLevel: () => {
      G.xp = 0; G.xpNext = Infinity;
      // 已经弹出的那个直接收掉（showOverlay(null) = 全部 .ov 隐藏 + wrap 回到 playing）。
      // ⚠️ 不要走 choose() —— 那会真发一张卡、改到 G.S，探针的基线就被污染了。
      if (state === 'upgrade') { showOverlay(null); state = 'play'; }
    },
    // 探针专用：直接开一枪 / 按住某个键 / 塞一发敌弹。
    // 这三种都是「不给探针开口就只能靠合成事件碰运气」的路径，直接暴露函数最稳。
    fire: (ang) => fireMain(ang === undefined ? G.aim : ang, 1),
    // 直接吃一次伤害：相位折跃的判定在 hurtPlayer 里，走这条路径才算真的测到
    hurt: (dmg) => hurtPlayer(dmg === undefined ? 30 : dmg),
    hold: (k, v) => { keys[k] = !!v; },
    // 探针专用：直接摆摇杆。摇杆正常只由 touchstart/touchmove 写，
    // 无头桌面 Chrome 里 pointer 恒为 fine，合成 touch 事件又必须先 setTouchMode，
    // 绕一圈太脆 —— 转向探针要量的是 updatePlayer 里的角速度，给个直写口最稳。
    // on=false 用来测「松手后不再转向」。
    setJoy: (x, y, on) => {
      joy.x = x; joy.y = y;
      joy.active = on !== false;
      if (!joy.active) { joy.id = null; joy.x = joy.y = 0; }
      return { active: joy.active, x: joy.x, y: joy.y };
    },
    // 探针专用：直接设定手机版炮口方向（touchAim）。
    // 正常只由右半屏拖动写，无头环境绕一圈太脆 —— 给个直写口测解耦最稳。
    setAim: (a) => { touchAim = a; return touchAim; },
    get aim() { return touchAim; },
    // 探针专用：直接驱动右瞄准杆（落点 + 手指拖到哪）。
    // 正常由 touchstart/touchmove 写，合成 touch 事件在无头环境要先 setTouchMode 才行；
    // 探针要量的是「位移 → 方向」这条映射，给个直写口比绕事件稳得多。
    setAimStick: (ox, oy, tx, ty) => {
      aimDrag.id = 1; aimDrag.ox = ox; aimDrag.oy = oy;
      const dx = tx - ox, dy = ty - oy, m = Math.hypot(dx, dy);
      const c = m > 0 ? Math.min(1, AIM_R / m) : 0;
      aimDrag.x = dx * c; aimDrag.y = dy * c;
      aimDrag.mag = clamp((m - AIM_DZ) / (AIM_R - AIM_DZ), 0, 1);
      if (m > AIM_DZ) touchAim = Math.atan2(dy, dx);
      return { aim: touchAim, mag: aimDrag.mag };
    },
    releaseAimStick: () => {
      aimDrag.id = null; aimDrag.x = 0; aimDrag.y = 0; aimDrag.mag = 0;
      return touchAim;
    },
    get aimStick() { return { id: aimDrag.id, ox: aimDrag.ox, oy: aimDrag.oy, x: aimDrag.x, y: aimDrag.y, mag: aimDrag.mag }; },
    ebullet: (x, y, ang, spd, r, color) => eShot(x, y, ang, spd, r, color || HOSTILE.red),
    // ---- 探针专用：无尽航程 / 深渊档位 ----
    // ⚠️ bossForWave 有副作用（会从轮换袋里抽走一张），所以单独开一个 peek 版本给探针做
    //    「只读式」检查；真要驱动关卡就用 gotoWave / nextWave 走正常路径。
    get wave() { return G.wave; },
    get won() { return !!G.won; },
    get waveState() { return G.waveState; },
    get waveNeed() { return G.waveNeed; },
    get queueLen() { return G.spawnQueue.length; },
    get bossId() { return G.bossPending || (G.boss ? G.boss.boss : null); },
    tier: w => eTier(w === undefined ? G.wave : w),
    tierMul: w => {
      const x = w === undefined ? G.wave : w;
      return { hp: eTierHp(x), dmg: eTierDmg(x), spd: eTierSpd(x), extra: eTierExtra(x) };
    },
    hpScale: () => hpScale(),
    waveLabel: w => waveLabel(w === undefined ? G.wave : w),
    // 只读地算「第 w 段该出哪只巨像」，不消耗轮换袋（照抄 bossForWave 但去掉 bagPick 副作用）
    // ⚠️ peekBoss 现在要走 bossForWave（主线是本局抽的，不再是钉死的 BOSS_WAVES）；
    //    BOSS_WAVES 只是 G 还没建立时的兜底。无尽的「袋」仍不能真抽（有副作用），只报 '(袋)'。
    peekBoss: w => bossForWave(w) || (w >= ENDLESS_FROM && (w - WAVES) % ENDLESS_BOSS_EVERY === 0 ? '(袋)' : null),
    bossBagLeft: () => BOSS_BAG.length,
    // ---- 巨像轮换 / 关卡形态（2026-10-03）----
    bossIds: () => Object.keys(BOSSES),
    bossSlotMul,
    rollMainBosses,
    mainBosses: () => (G ? G.mainBosses : null),
    // 关卡形态：查某段的形态、以及给探针直接铺一段（不靠打完前面的段）
    formForWave,
    forms: () => Object.keys(FORMS),
    waveForm: () => (G ? G.waveForm : null),
    waveState: () => (G ? G.waveState : null),
    // ⚠️ HUD 目标文案也得开个口子：`waveObjective` 是函数声明所以 window 上有，
    //    但**它读的是 G.waveForm**，探针要先铺段再读才读得对，直接调最稳。
    objective: () => waveObjective(),
    // ⚠️ BOSSES 是 `const`，**不会**挂到 window（和 aimMode 那个坑同一条），
    //    探针想看整张表（pats / traitEn / spr）只能走这里。
    bossTable: () => BOSSES,
    // 火场（熔渣锻炉）：探针要验「站进去会掉血 / 会过期」，直接铺一块最稳
    addFire,
    fires: () => (G ? G.fires.length : 0),
    // 真·抽一次巨像（会消耗轮换袋）—— 用来验证「一轮内三只不重复」
    drawBoss: () => bagPickBoss(),
    // 探针专用：把轮换袋倒空重来。gotoWave 到巨像段也会消耗袋子，
    // 所以「三只不重复」这类用例必须先归零，否则测的是上一段留下的残局。
    resetBossBag: () => { BOSS_BAG.length = 0; },
    get squadName() { return G.squadName; },
    // ---- 探针专用：进场方向 / 边界夹取 ----
    // spawnPos 的四个方向曾是**死代码**（irand(4) 恒为 NaN，四个分支全落空，只从右边进场）。
    // 这种「分支永远走不到」的 bug 没有任何报错，只能靠大量采样数分布来抓。
    // ⚠️ wh 现在是**视口**尺寸，不是世界尺寸 —— 世界大了 3 倍之后这两者不再相等。
    //    探针凡是拿 wh 当「敌人能在哪」用的（生成分布、边界夹取），要改读 world/viewRect。
    get wh() { return [W, H]; },
    get world() { return [WORLD.w, WORLD.h]; },
    get cam() { return [cam.x, cam.y]; },
    // 视口在世界里的矩形 [left, top, right, bottom]
    get viewRect() { return [viewL(), viewT(), viewR(), viewB()]; },
    // 屏外敌人指示器：renderer 用的同一份数据（探针直接读它，不重写一份算法）
    get offscreen() {
      const cells = offscreenTargets();
      return {
        live: G.enemies.filter(e => !e.dead && e.hp > 0).length,
        off: G.enemies.filter(e => !e.dead && e.hp > 0 &&
          !(e.x > viewL() && e.x < viewR() && e.y > viewT() && e.y < viewB())).length,
        cells: cells.length,
        n: cells.reduce((a, c) => a + c.n, 0),
        bosses: cells.filter(c => c.rank === 3).length,
        box: (() => { const b = markBox(); return [b.x0, b.y0, b.x1, b.y1]; })(),
        // ⚠️ 这是「和渲染同一份数据」的自洽性检查，不是独立验收 —— 真正有意义的
        //    是探针里那两条硬约束：① 不许出画布；② 不许压在 HUD 的条上。
        inEdge: (() => {
          const b = markBox();
          return cells.every(c => c.x >= b.x0 - 0.5 && c.x <= b.x1 + 0.5 &&
                                  c.y >= b.y0 - 0.5 && c.y <= b.y1 + 0.5);
        })(),
        list: cells.map(c => ({
          x: Math.round(c.x), y: Math.round(c.y), n: c.n, rank: c.rank,
          dx: Math.round(c.dx * 100) / 100, dy: Math.round(c.dy * 100) / 100,
        })),
      };
    },
    get edge() { return EDGE; },
    spawnPosSample: () => spawnPos(),
    spawnFromEdge: type => spawnEnemy(type),   // 不给 x/y → 走 spawnPos 的正常路径
    gotoWave: w => {
      G.enemies.length = 0; G.ebullets.length = 0; G.boss = null; G.bossPending = null;
      startWave(w);
    },
    enemyInfo: () => G.enemies.map(e => ({
      type: e.type, hp: Math.round(e.hp), maxHp: Math.round(e.maxHp),
      dmg: Math.round((e.dmg || 0) * 100) / 100, spdMul: e.spdMul === undefined ? 1 : e.spdMul,
      boss: !!e.boss,
    })),
    get wakeCount() { return G.wakes.length; },
    get lanceCount() { return G.lances.length; },
    get mineCount() { return G.mines.length; },
    // ---- 探针专用：地形（2026-10-21）----
    get layout() { return G.layout; },
    // 只读地形表（含 vent；core / rock 都有 w/h）
    terr: () => G.terr.map(b => ({
      kind: b.kind, x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h,
      hp: Math.round(b.hp || 0), maxHp: Math.round(b.maxHp || 0),
    })),
    ventInfo: () => G.terr.filter(b => b.kind === 'vent').map(b => ({ x: b.x, y: b.y, ph: b.ph, t: +b.t.toFixed(2) })),
    // 「这一点是不是实心」（探针拿它做遮挡 / 阻挡断言）
    terrAt: (x, y) => { const b = terrAt(x, y); return b ? b.kind : null; },
    terrRay: (x, y, a, len) => terrRay(x, y, a, len),
    // 直接铺一套布局（不靠打完前面的段）
    // ⚠️ 不能叫 setLayout —— 这个名字已经被「触屏 / 横竖屏布局」那一档占了，
    //    对象字面量里同名键后者覆盖前者，写上去是静默失效（实测：地形一块都没铺出来）。
    setTerrainLayout: id => { G.terr.length = 0; G.layout = id; const ly = LAYOUTS[id]; if (ly && ly.build) { ly.build(); terrVents(2); } terrIndex(); },
    terrClear: () => { G.terr.length = 0; G.layout = 'open'; terrIndex(); },
    // 星区（2026-10-23）：直接切区（视觉 + 地形贴图一起换）/ 直接开某条机制
    setZone: i => { G.zone = clamp(i | 0, 0, ZONES.length - 1); G.zskinZone = -1; },
    zoneOf: w => zoneIndexFor(w),
    zoneName: i => ZONES[i] ? ZONES[i].name : null,
    hz: () => G.hz,
    startHaz: k => startHazard(k),
    zones: () => ZONES.map(z => ({ name: z.name, en: z.en, terrain: z.terrain, haz: z.haz })),
    hazards: () => HAZARDS,
    ventBlow: () => { const v = G.terr.find(b => b.kind === 'vent'); if (v) ventBlow(v); return !!v; },
    lensAt: (x, y) => { const b = lensAt(x, y); return b ? { x: b.x, y: b.y, a: b.a, dir: b.dir } : null; },
    ventCount: () => G.terr.filter(b => b.kind === 'vent').length,
    // 手动摆一块（探针要精确控制位置，随机布局没法写断言）
    terrPut: (kind, x, y, w, h) => { const b = terrAdd(x, y, w, h, kind); terrIndex(); return !!b; },
    // 巨像碾碎用：把玩家挪到指定点并跑一帧解算
    terrResolve: () => terrResolvePlayer(),
    get bulletCount() { return G.bullets.length; },
    get ebulletCount() { return G.ebullets.length; },
    moduleIds: () => MODULES.map(m => m.id),
    moduleInfo: () => MODULES.map(m => ({ id: m.id, name: m.name, type: m.type, max: m.max })),
    // ---- 配件 / 图标探针 ----
    // 把「船体 + 配件」画进给定 canvas 并返回非透明像素数。
    renderKit: (cv, mods, white) => {
      _drawKit(cv, mods || {}, !!white);
      return _opaque(cv.getContext('2d'), cv.width, cv.height);
    },
    // 更硬的指标：装上这些配件之后，**画面有多少像素变了**。
    // ⚠️ 不能只数「非透明像素」—— 贴在船体上的件（如暴击电容）是画在船体**上面**的，
    //    那些像素本来就是不透明的，计数完全不变，会误判成「配件没画上去」。
    kitDiff: (modsA, modsB) => {
      const a = _scratchKit(), b = _scratchKit();
      _drawKit(a, modsA || {}, false);
      _drawKit(b, modsB || {}, false);
      const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
      const db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) n++;
      }
      return n;
    },
    renderIcon: (cv, id, lv) => {
      const ic = attachIcon(id, lv, cv.width);
      const x = cv.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, cv.width, cv.height);
      if (!ic) return 0;
      x.drawImage(ic, 0, 0);
      return _opaque(x, cv.width, cv.height);
    },
    // 配件的几何与用色（探针据此验「每个模块每一级都有真东西」）
    attachInfo: (id, lv) => {
      const fl = attachFlat(id, lv), ps = attachParts(id, lv);
      if (!fl || !ps) return null;
      const colors = {};
      for (const p of ps) for (const r of p.rows) for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.' || !PAL[ch]) continue;
        colors[ch] = (colors[ch] || 0) + 1;
      }
      return { w: fl.w, h: fl.h, cx: fl.cx, cy: fl.cy, parts: ps.length, colors: colors };
    },
    // 升级卡 / 图鉴上真的渲染出 canvas 图标了吗（不是只有空壳）
    cardIcons: () => {
      const out = [];
      for (const cv of document.querySelectorAll('#cards canvas[data-gic]')) {
        out.push({ i: +cv.dataset.gic, w: cv.width, h: cv.height, px: _opaque(cv.getContext('2d'), cv.width, cv.height) });
      }
      return out;
    },
    codexIcons: () => {
      const out = [];
      for (const cv of document.querySelectorAll('#codex-grid canvas')) {
        out.push({ px: _opaque(cv.getContext('2d'), cv.width, cv.height) });
      }
      return out;
    },
    save: () => SAVE,
    writeSave,
    // ---- 探针专用：机库滑轨（7 台船体单行 650px 装不进 480px）----
    // 探针要断言「翻页真的位移了」「卡片没被 flex 压窄」「选中那张整张露出来」，
    // 光靠截图看不出来（位移 100px 和 188px 在图上几乎一样）。
    hullRow: () => ({
      off: hullOff, max: hullMaxOff(), rowW: hullRowW(), per: hullPerPage(),
      sel: hangarSel, cardW: HULL_CARD_W, gap: HULL_GAP, pad: HULL_PAD,
    }),
    // ---- 探针专用：过热膛线（熔炉专属）----
    get heat() { return { on: G.heatOn, v: G.heat, mul: G.heatMul, lock: G.heatLock }; },
    hullUnlocked: id => hullUnlocked(HULLS.find(h => h.id === id)),
    checkUnlocks: quiet => checkUnlocks(quiet !== false),
    lockAll: () => { SAVE.hulls = ['peregrine', 'rapier', 'bulwark']; writeSave(); },
    webSlowAt: (x, y) => webSlowAt(x === undefined ? G.px : x, y === undefined ? G.py : y),
    reload: () => { SAVE = loadSave(); return SAVE; },
    die,
    soundVol: () => Sound.vol,
    // ---- 输入 / 布局探针 ----
    get pointerKind() { return pointerKind; },
    get touchMode() { return touchMode; },
    get joyActive() { return joy.active; },
    get joyVec() { return [Math.round(joy.x * 1000) / 1000, Math.round(joy.y * 1000) / 1000]; },
    get scale() { return scale; },
    get off() { return [offX, offY]; },
    pickHull,
    fit,
    updateLayoutMode,
    // 探针专用：触屏模式在无头桌面 Chrome 里永远为 false（pointer 恒为 fine），
    // 只能手动挂上 —— 和 setLayout 是同一个理由（不可测的媒体查询要开个口子）。
    setTouchMode: on => { setTouchMode(!!on); return touchMode; },
    // 探针专用：强制 coarse / portrait 类（不可测的媒体查询要开个口子）。
    // 竖屏/横屏不再分流任何 UI，所以 portrait 只是个惰性标记，供将来探针用。
    setLayout: (coarse, portrait) => {
      const r = document.documentElement;
      r.classList.toggle('coarse', !!coarse);
      r.classList.toggle('portrait', !!portrait);
    },
    // ---- 触屏按钮探针 ----
    // 开火开关：读值 / 翻 / 直接设。⚠️ 直接读 G.autoFire 会踩到「G 可能为 null」，
    // 所以走模块级的 autoFire 变量（它就是 G.autoFire 的来源）。
    get autoFire() { return autoFire; },
    get gameAutoFire() { return G ? !!G.autoFire : null; },
    toggleFire,
    setAutoFire: v => {
      autoFire = !!v;
      if (G) G.autoFire = autoFire;
      syncFireBtn();
      return autoFire;
    },
    // 超载电池：水位（%）+ 是否「按得动」+ 按一次的结果
    odState: () => {
      const b = $('btn-od'), f = b && b.querySelector('.odfill');
      return {
        exists: !!b,
        ready: !!(b && b.classList.contains('ready')),
        // ⚠️ 横向电池的水位是 **width**（从左往右灌满），不是 height
        fillPct: f ? parseFloat(f.style.width) || 0 : null,
        fillW: f ? Math.round(f.getBoundingClientRect().width / (scale || 1)) : null,
        fillH: f ? Math.round(f.getBoundingClientRect().height / (scale || 1)) : null,
        energy: G ? Math.round(G.energy) : null,
      };
    },
    // 触屏按钮的布局体检：矩形 + 两两重叠面积（重叠必须为 0）。
    // ⚠️ 必须**减掉 offX/offY 再除 scale**：getBoundingClientRect 给的是视口坐标，
    //    而 #wrap 是 translate(offX,offY) + scale 的 —— 只除 scale 会把信箱式的
    //    左边距算进按钮的 x 里，所有按钮看起来都往右挪了一截（inWrap 会假 FAIL）。
    touchBtns: () => {
      const out = [];
      const s = scale || 1;
      for (const b of document.querySelectorAll('#touch .tbtn')) {
        const r = b.getBoundingClientRect();
        out.push({
          act: b.dataset.act || b.id,
          x: Math.round((r.left - offX) / s), y: Math.round((r.top - offY) / s),
          w: Math.round(r.width / s), h: Math.round(r.height / s),
          visible: r.width > 0 && r.height > 0,
          inWrap: (r.left - offX) >= -0.5 && (r.top - offY) >= -0.5 &&
                  (r.right - offX) <= W * s + 0.5 && (r.bottom - offY) <= H * s + 0.5,
          fontPx: parseFloat(getComputedStyle(b).fontSize),
        });
      }
      let worst = 0;
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0 && oy > 0) worst = Math.max(worst, ox * oy);
      }
      return { btns: out, overlapArea: worst };
    },
    // 超载容器的 DOM 真命中（尺寸判定 + elementFromPoint，别只信 rect）
    odReach: () => {
      const b = $('btn-od'); if (!b) return { ok: false, why: 'no-el' };
      const r = b.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return { ok: false, why: 'zero-size' };
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: t === b || b.contains(t), hit: t ? (t.id || t.className || t.tagName) : null };
    },
    // ---- 中英切换探针 ----
    get lang() { return lang; },
    setLang: l => { setLang(l); return lang; },
    toggleLang,
    // 当前语言下所有**画布上**会出现的 T() 键（探针据此逐键核对，别自己抄一份键表）
    uiKeys: () => Object.keys(UI.zh),
    // 漏翻体检：中英键集合是否一致 + 六张数据表的 *En 字段是否都非空。
    // 把「有没有漏翻」变成一条硬断言，而不是靠人肉翻页。
    i18nMissing: () => {
      const miss = [];
      for (const k in UI.zh) if (!(k in UI.en)) miss.push('UI.en 缺 ' + k);
      for (const k in UI.en) if (!(k in UI.zh)) miss.push('UI.zh 缺 ' + k);
      const tbl = [
        ['HULLS', HULLS, ['en', 'tagEn', 'descEn', 'traitEn']],
        ['ETYPES', ETYPES, ['nameEn', 'traitEn']],
        ['BOSSES', BOSSES, ['en', 'traitEn']],
        ['SQUADS', SQUADS, ['nameEn']],
        ['MODULES', MODULES, ['nameEn', 'descEn']],
        ['SYNERGIES', SYNERGIES, ['nameEn', 'descEn']],
        ['ZONES', ZONES, ['en']],
        ['LAYOUTS', LAYOUTS, ['nameEn']],   // 地形布局名（2026-10-21）
      ];
      for (const t of tbl) {
        const nm = t[0], obj = t[1], fields = t[2];
        const arr = Array.isArray(obj) ? obj : Object.keys(obj).map(k => Object.assign({ _k: k }, obj[k]));
        for (const it of arr) for (const f of fields) {
          const v = it[f];
          if (v == null || String(v).trim() === '') miss.push(nm + '.' + (it.id || it._k) + '.' + f);
        }
      }
      return miss;
    },
    // 画面上还残留的「缺键标记」（T() 缺键返回 ⟪key⟫）。DOM 一层就够 ——
    // 画布上的缺键只可能来自上面那批键，i18nMissing 已经全覆盖。
    domMissingMarks: () => {
      const out = [];
      const walk = el => {
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.nodeValue && n.nodeValue.indexOf('⟪') >= 0) out.push(n.nodeValue.trim());
          else if (n.nodeType === 1) walk(n);
        }
      };
      walk(document.body);
      return out;
    },
  };

  // ============ 中英切换 ============
  // ① 先把 DOM 上的静态文案刷一遍（data-i18n / data-i18n-html / data-i18n-title）。
  // ② 再注册「切完语言要重刷哪些**动态**内容」。⚠️ 只重画，绝不切状态机 ——
  //    切语言时顺手 toTitle() 会把打到一半的人踢回标题页。
  applyDom();
  syncFireBtn();   // 「开火 关/开」是动态文案，data-i18n 刷不到它，得单独来一次
  langRefresh = () => {
    syncMuteBtn();
    syncFireBtn();
    renderVolume();
    if (state === 'title') renderTitle();
    else if (state === 'hangar') renderHangar();
    else if (state === 'codex') drawCodex();
    else if (state === 'upgrade') renderCards();
    else if (state === 'pause') renderPause();
    else if (state === 'over') renderOver();
    // play / help / loading：画布上的 HUD 每帧重画、help 全是静态 DOM，都不用管
  };

  // 像素字体是 font-display:swap **异步**到位的（见 style.css 的首屏关键路径注释）：
  // 到位之前 fit() / 卡面排版是用 monospace 量出来的，字体一换宽度就变了。
  // 所以字体 ready 后重跑一次 fit + 当前面板重画，别把错误宽度留着。
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { try { fit(); langRefresh(); } catch (e) {} });
  }

  // 主题化加载动画：本地资源同步加载、boot 一瞬间跑完，不延时的话动画根本看不到。
  // 2.2s 必须和 style.css 里 .ld-bar i 的 ldfill 时长一致（否则进度条没满就切标题）。
  // BOT 模式会在下面立刻 startGame() 把 state 改成 play，所以 reveal 要判 state==='loading'
  // 才切，否则会把已经开局的 bot 踢回标题页。
  setTimeout(() => { if (state === 'loading') toTitle(); }, LOADING_MIN);
  // ?bot=1 直接开局：平衡性跑测不该还要人肉点进机库（touchMode 已在 boot 开头置位）
  if (BOT) { hangarSel = 0; startGame(); }
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
