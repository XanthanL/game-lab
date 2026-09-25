'use strict';
// 奇点旅途 · 主逻辑
// 结构沿用终焉防火墙：单文件、无依赖。差异：
//  - 移动改为推进器惯性（WASD），瞄准为鼠标方向（不再自动锁敌）
//  - 关卡制（12 段航程 / 3 星区）而非无限生存
//  - 经验升级三选一模块，取代金币阈值
const W = 480, H = 270, DT = 1 / 60, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const wrap = $('wrap');
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const QS = new URLSearchParams(location.search);
const BOT = QS.has('bot'), GOD = QS.has('god'), FAST = +QS.get('fast') || 1;
const fmtTime = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

let state = 'loading', G = null, scale = 1, offX = 0, offY = 0;
let STARSETS = null, ROCKS = null;
let touchMode = false, hangarSel = 0;
// 混合设备（触屏笔记本）上鼠标和手指会交替用。这个只用来决定准星画哪种样式，
// 判定走 pointer 事件的 pointerType —— 触屏点按之后浏览器会补一发兼容性 mousemove，
// 拿 mousemove 判会把状态误判回鼠标，准星会一闪一闪。
let pointerKind = 'mouse';
const keys = {}, mouse = { x: W / 2, y: H / 2, down: false, inside: false };
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
// 跟奇点回响对齐的「最近一次输入决定朝向控制方式」：
// 'key' = A/D 转向；'mouse' = 朝鼠标方向缓慢转向。光标动了切到 mouse；A/D 一按切回 key。
// ⚠️ 必须用 var 而不是 let —— 探针通过 window.aimMode 读这个状态，
//    plain <script> 下 let 是 script-scope，不会挂到 window。
var aimMode = 'key';

// ============ 像素文字（缓存 canvas） ============
const tcache = new Map();
function textSpr(str, color, size, outline) {
  const key = str + '|' + color + '|' + size + '|' + (outline || '');
  let c = tcache.get(key); if (c) return c;
  const m = document.createElement('canvas').getContext('2d');
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
  if (tcache.size > 900) tcache.clear();
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
const measure = (str, size = 12) => { const m = document.createElement('canvas').getContext('2d'); m.font = size + 'px FP, monospace'; return Math.ceil(m.measureText(str).width); };

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
const HULLS = [
  {
    id: 'peregrine', name: '游隼', en: 'PEREGRINE', tag: '均衡', color: '#73eff7',
    desc: '没有短板的侦查机。\n适合第一次启程。',
    trait: '三项都是 100% —— 没有短板，也没有长板',
    hp: 100, spd: 1.00, dmg: 1.00, rate: 1.00, turn: 1.00,
    stats: '船体 100\n速度 100%\n火力 100%',
  },
  {
    id: 'rapier', name: '轻剑', en: 'RAPIER', tag: '玻璃炮', color: '#ef7d57',
    desc: '推重比拉满，装甲削到最低。\n快，但挨不了几下。',
    trait: '速度 120% / 火力 114%，代价是船体只有 78',
    hp: 78, spd: 1.20, dmg: 1.14, rate: 1.16, turn: 1.15,
    stats: '船体 78\n速度 120%\n火力 114%',
  },
  {
    id: 'bulwark', name: '堡垒', en: 'BULWARK', tag: '重装', color: '#a7f070',
    desc: '厚壳、慢、稳。\n用血量换容错。',
    trait: '船体 150 全场最高，代价是转得慢、火力 90%',
    hp: 150, spd: 0.86, dmg: 0.90, rate: 0.86, turn: 0.82,
    stats: '船体 150\n速度 86%\n火力 90%',
  },
  {
    id: 'raven', name: '玄鸦', en: 'RAVEN', tag: '刺客', color: '#c070f0',
    desc: '装甲薄到能看穿。\n换来的是一击必杀的暴击率。',
    trait: '10% 暴击、暴击 3 倍，但船体只有 62',
    hp: 62, spd: 1.28, dmg: 1.10, rate: 1.20, turn: 1.30,
    stats: '船体 62\n速度 128%\n火力 110%',
    crit: 0.10, critMul: 3.0,
    unlock: { kills: 300, text: '累计击坠 300' },
  },
  {
    id: 'swarm', name: '蜂群', en: 'SWARM', tag: '编队', color: '#ffcd75',
    desc: '出击就带两架僚机。\n自己不开火也能打。',
    trait: '开局自带 2 架僚机，拾取范围 +30%',
    hp: 92, spd: 1.06, dmg: 0.86, rate: 0.94, turn: 1.05,
    stats: '船体 92\n速度 106%\n火力 86%',
    drones: 2, magnetMul: 1.3,
    unlock: { wave: 10, text: '航程抵达第 10 段' },
  },
];

// ============ 敌型（12） ============
const ETYPES = {
  // trait = 图鉴里那一行「怎么对付它」。图鉴是纯数据驱动的、不另建文案表，
  //   所以新敌型只要带上 trait 就会自动进图鉴（和 EN_LIST 一样是派生出来的）。
  seeker:   { name: '追猎者', spr: 'seeker',   hp: 14, spd: 54, r: 5, dmg: 8,  xp: 1, ai: 'chase',   trait: '直冲你当前的位置，转向偏慢 —— 侧滑一下就能甩开' },
  tadpole:  { name: '蝌蚪',   spr: 'tadpole',  hp: 18, spd: 46, r: 6, dmg: 8,  xp: 1, ai: 'wander',  trait: '不追人，四处游走；比杂兵厚一点，别让它堆着' },
  dart:     { name: '飞镖',   spr: 'dart',     hp: 16, spd: 62, r: 5, dmg: 12, xp: 1, ai: 'dash',    trait: '蓄力后高速突进，突进前有明显停顿 —— 那一下要躲' },
  gunner:   { name: '炮手',   spr: 'gunner',   hp: 24, spd: 30, r: 6, dmg: 10, xp: 2, ai: 'shoot', range: 160, cd: 1.5, trait: '保持距离持续开火，贴上去能压住它的输出' },
  splitter: { name: '分裂体', spr: 'splitter', hp: 28, spd: 38, r: 7, dmg: 10, xp: 2, ai: 'chase', split: 3, trait: '死亡裂成三只小的 —— 别在弹幕缝里杀它' },
  reaver:   { name: '掠夺者', spr: 'reaver',   hp: 10, spd: 80, r: 4, dmg: 7,  xp: 1, ai: 'swarm',   trait: '成群高速掠过，数量多但极脆，扫射清场最快' },
  bastion:  { name: '重甲炮台', spr: 'bastion', hp: 78, spd: 22, r: 9, dmg: 14, xp: 4, ai: 'turret', range: 180, cd: 2.2, trait: '几乎不动、火力极密，绕到它背后再打' },
  shifter:  { name: '相位闪现者', spr: 'shifter', hp: 22, spd: 42, r: 6, dmg: 12, xp: 2, ai: 'blink', trait: '短距瞬移贴近，很难预瞄 —— 靠声音判断它去哪了' },
  stalker:  { name: '潜行者', spr: 'stalker',  hp: 32, spd: 48, r: 7, dmg: 16, xp: 3, ai: 'stalk',   trait: '潜行接近再爆发，保持距离别让它贴上' },
  mine:     { name: '浮游雷', spr: 'mine',     hp: 12, spd: 0,  r: 6, dmg: 18, xp: 1, ai: 'mine',    trait: '完全静止，靠太近才自爆 —— 绕开就行' },
  orbiter:  { name: '环轨炮', spr: 'orbiter',  hp: 28, spd: 54, r: 6, dmg: 10, xp: 3, ai: 'orbit', range: 150, cd: 1.8, trait: '绕着你做圆周并射击，专门打乱你的走位节奏' },
  leech:    { name: '吸附虫', spr: 'leech',    hp: 24, spd: 64, r: 5, dmg: 6,  xp: 2, ai: 'leech',   trait: '贴上就持续放血，得靠冲刺或制动甩掉' },
  // ---- 第二批：每个都改变你的决策，而不是只改血量 ----
  // 织网者：在场上撒减速网，压缩你的活动空间
  weaver:   { name: '织网者', spr: 'weaver',   hp: 34, spd: 44, r: 6, dmg: 9,  xp: 3, ai: 'weave', range: 118, cd: 3.2, trait: '往你前方撒减速蛛网 —— 走位要读图，不能直线冲' },
  // 牧者：给周围敌人持续回血 + 加速，必须优先点掉
  shepherd: { name: '牧者',   spr: 'shepherd', hp: 46, spd: 40, r: 6, dmg: 8,  xp: 4, ai: 'shepherd', range: 148, aura: 84, cd: 2.0, trait: '给周围敌人回血 + 加速，不优先点掉这一波清不完' },
  // 新星：死亡时炸出一圈弹幕，别在弹幕缝里杀它
  nova:     { name: '新星',   spr: 'nova',     hp: 26, spd: 50, r: 6, dmg: 12, xp: 3, ai: 'chase', deathRing: 12, trait: '死亡炸出一圈弹幕（留一条缝）—— 杀它的位置很重要' },
  // 铁壁：正面装甲吸收大部分伤害，机头转得慢 —— 所以侧后方真的绕得过去
  bulwark:  { name: '铁壁',   spr: 'bulwark',  hp: 78, spd: 28, r: 8, dmg: 16, xp: 5, ai: 'guard', guard: 0.30, turn: 1.5, range: 190, cd: 3.2, trait: '正面装甲吃掉大部分伤害，机头转得慢 —— 绕到侧后方打' },
};
// 编队主题：决定每段的敌型配比
const SQUADS = {
  swarm:  { name: '虫潮', mix: ['reaver', 'seeker', 'tadpole'], cnt: 1.35 },
  guns:   { name: '炮列', mix: ['gunner', 'orbiter', 'bastion'], cnt: 0.75 },
  rush:   { name: '突袭', mix: ['dart', 'seeker', 'leech'], cnt: 1.1 },
  fort:   { name: '要塞', mix: ['bastion', 'bulwark', 'gunner'], cnt: 0.8 },
  trick:  { name: '诡术', mix: ['shifter', 'stalker', 'mine'], cnt: 1.0 },
  weave:  { name: '罗网', mix: ['weaver', 'seeker', 'dart', 'tadpole'], cnt: 0.95 },
  flock:  { name: '牧群', mix: ['shepherd', 'nova', 'reaver', 'tadpole', 'reaver', 'tadpole'], cnt: 1.0 },
  mixed:  { name: '混编', mix: ['seeker', 'dart', 'gunner', 'splitter', 'orbiter', 'leech'], cnt: 1.0 },
};

// ============ 星区 & 航程 ============
const ZONES = [
  { name: '外环碎屑带', en: 'DEBRIS BELT', from: 1,  to: 4,  squads: ['swarm', 'rush', 'guns', 'mixed'] },
  { name: '中子星云',   en: 'NEUTRON NEBULA', from: 5, to: 8, squads: ['trick', 'weave', 'mixed', 'flock'] },
  { name: '深空奇点',   en: 'DEEP SINGULARITY', from: 9, to: 12, squads: ['fort', 'flock', 'weave', 'mixed'] },
];
const zoneOf = w => ZONES.find(z => w >= z.from && w <= z.to) || ZONES[2];
const WAVES = 12;                 // 主线航段数：打完这 12 段 = 通关，但**不停机**，转入无尽
const BOSS_WAVES = { 4: 'motherrock', 8: 'warden', 12: 'gate' };
const BOSSES = {
  motherrock: { name: '母岩', en: 'MOTHER ROCK', spr: 'motherrock', hp: 900, r: 21, pats: ['charge', 'spread'], color: '#c070f0',
                trait: '冲撞 + 扇形弹幕，冲撞前有蓄力 —— 绕侧后方输出' },
  warden:     { name: '环带狱卒', en: 'ORBITAL WARDEN', spr: 'warden', hp: 2000, r: 22, pats: ['ring', 'spiral', 'fan'], color: '#ff5577',
                trait: '环形 / 螺旋 / 扇形三套弹幕轮转，找缝穿过去' },
  gate:       { name: '奇点之门', en: 'THE GATE', spr: 'gate', hp: 3600, r: 23, pats: ['spiral', 'fan', 'ring', 'laser'], color: '#73eff7',
                trait: '四套弹幕含一道激光，血最厚 —— 拼的是续航' },
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
// 本段该不该出巨像。⚠️ 只在 startWave 里调用一次 —— bagPickBoss 有副作用（抽走一张牌），
//    任何「预判式」的重复调用都会白白吃掉一轮轮换。
function bossForWave(w) {
  if (BOSS_WAVES[w]) return BOSS_WAVES[w];
  if (w >= ENDLESS_FROM && (w - WAVES) % ENDLESS_BOSS_EVERY === 0) return bagPickBoss();
  return null;
}
// 段数标签（HUD 用，带单位）：主线「第 N/12 段」，无尽「第 N 段 · 深渊 K 档」。
// ⚠️ 返回值已经含「段」字，调用方不要再拼一次 —— 否则无尽里会印成
//    「第 17 · 深渊 1 档 段」这种断句。
function waveLabel(w) {
  return w <= WAVES ? '第 ' + w + '/' + WAVES + ' 段' : '第 ' + w + ' 段 · 深渊 ' + eTier(w) + ' 档';
}

// ============ 模块卡（16） ============
// type: stat(数值) / weapon(弹体) / ability(装置)
// apply(S) 每升一级执行一次；bloom(S) 只在升到满级那一刻额外执行一次（质变）。
// glyph 用汉字：像素字体对 ▣➤↻◆ 这类符号覆盖不全，会渲染成缺字方块。
const MODULES = [
  // ---- 数值型 ----
  { id: 'armor', name: '装甲板', type: 'stat', glyph: '甲', max: 4,
    desc: '最大船体 +22\n并立即修复',
    apply: S => { S.maxHp += 22; S.hp += 22; },
    bloom: S => { S.maxHp += 50; S.hp = S.maxHp; } },
  { id: 'thruster', name: '推进器', type: 'stat', glyph: '推', max: 4,
    desc: '推进与极速 +8%',
    apply: S => { S.spd *= 1.08; },
    bloom: S => { S.spd *= 1.18; S.goldTrail = 1; } },
  { id: 'autoloader', name: '自动装填', type: 'stat', glyph: '装', max: 4,
    desc: '射击间隔 -10%',
    apply: S => { S.rate *= 1.10; },
    bloom: S => { S.rate *= 1.25; S.goldMuzzle = 1; } },
  { id: 'warhead', name: '重型弹头', type: 'stat', glyph: '弹', max: 4,
    desc: '所有伤害 +13%',
    apply: S => { S.dmg *= 1.13; },
    bloom: S => { S.dmg *= 1.35; } },
  { id: 'critcap', name: '暴击电容', type: 'stat', glyph: '暴', max: 4,
    desc: '暴击率 +8%\n暴击造成 2.4 倍',
    apply: S => { S.crit += 0.08; },
    bloom: S => { S.crit += 0.10; S.critMul = 3.4; } },
  { id: 'magnet', name: '磁力线圈', type: 'stat', glyph: '磁', max: 3,
    desc: '拾取范围 +25%',
    apply: S => { S.magnet *= 1.25; },
    bloom: S => { S.magnet *= 1.6; S.autoPull = 1; } },
  { id: 'nanorepair', name: '纳米修复', type: 'stat', glyph: '修', max: 3,
    desc: '每秒回复 0.8 船体',
    apply: S => { S.regen += 0.8; },
    bloom: S => { S.regen *= 2; S.dustHeal += 0.6; } },
  { id: 'phasehull', name: '相位外壳', type: 'stat', glyph: '相', max: 3,
    desc: '受击无敌 +0.15 秒',
    apply: S => { S.invBonus += 0.15; },
    bloom: S => { S.invBonus += 0.5; S.goldHurt = 1; } },

  // ---- 弹体型 ----
  { id: 'multigun', name: '多联机炮', type: 'weapon', glyph: '炮', max: 3,
    desc: '追加一根枪管\n齐射更宽',
    apply: S => { S.barrels += 1; },
    bloom: S => { S.barrels += 1; } },
  { id: 'piercer', name: '穿甲弹', type: 'weapon', glyph: '穿', max: 3,
    desc: '炮弹多穿透 1 个目标',
    apply: S => { S.pierce += 1; },
    bloom: S => { S.pierce += 2; } },
  { id: 'hesh', name: '高爆弹', type: 'weapon', glyph: '爆', max: 3,
    desc: '命中炸开\n范围伤害',
    apply: S => { S.blast += 1; },
    bloom: S => { S.blast += 2; S.blastMul *= 1.5; } },

  // ---- 装置型 ----
  { id: 'drone', name: '战斗无人机', type: 'ability', glyph: '机', max: 3,
    desc: '环绕自动开火\n每级 +1 架',
    apply: S => { S.drones += 1; },
    bloom: S => { S.drones += 2; S.droneGold = 1; } },
  { id: 'shield', name: '能量护盾', type: 'ability', glyph: '盾', max: 3,
    desc: '护盾 +28\n脱战自动回复',
    apply: S => { S.shieldMax += 28; S.shield = S.shieldMax; },
    bloom: S => { S.shieldMax += 70; S.shield = S.shieldMax; S.shieldRegenMul *= 2; } },
  { id: 'arc', name: '电弧线圈', type: 'ability', glyph: '电', max: 3,
    desc: '每 2.2 秒链击\n2 个目标',
    apply: S => { S.arc += 1; },
    bloom: S => { S.arc += 1; S.arcCdMul *= 0.55; } },
  { id: 'nova', name: '脉冲核心', type: 'ability', glyph: '冲', max: 3,
    desc: '每 7 秒冲击波\n击伤并震退周身敌人',
    apply: S => { S.nova += 1; S.novaR += 26; },
    bloom: S => { S.novaR += 70; S.novaCd *= 0.7; S.novaVoid = 1; } },
  { id: 'stasis', name: '静止场', type: 'ability', glyph: '滞', max: 3,
    desc: '范围内敌人减速',
    apply: S => { S.stasis += 1; S.stasisR += 34; },
    bloom: S => { S.stasisR += 90; S.stasisSlow += 0.2; } },

  // ---- 从《奇点回响》搬运的机制（搬运机制，不照抄模型：数值 / 上限 / 视觉全部重定） ----
  // ⚠️ 上限一律用本作的 3，不是 echo 的 6 —— 本作一局只升到 8 级左右，6 级卡等于永远拿不满。
  { id: 'backshot', name: '尾炮', type: 'ability', glyph: '尾', max: 3,
    desc: '齐射时向船尾开火\n每级 +1 门',
    apply: S => { S.backshot += 1; },
    bloom: S => { S.backshot += 2; S.backGold = 1; } },
  { id: 'ricochet', name: '跳弹', type: 'weapon', glyph: '跳', max: 3,
    desc: '炮弹撞到屏边\n反弹一次继续飞',
    apply: S => { S.bounce += 1; },
    bloom: S => { S.bounce += 2; } },
  { id: 'guided', name: '制导弹药', type: 'weapon', glyph: '导', max: 3,
    desc: '炮弹自动咬住\n最近的敌人',
    // homeR 不做上限截断：140→170→200→230，满级质变直接 260（接近全屏）。
    // 敢给这么大是因为 updateBullets 里按弹缓存了目标，每 0.12 秒才搜一次 ——
    // 没有那层缓存的话 (R/24)² 个格子 × 每发弹每帧会把帧率吃干净。
    apply: S => { S.homing += 1.1; S.homeR += 30; },
    bloom: S => { S.homing += 1.4; S.homeR = 260; } },
  { id: 'ram', name: '冲角装甲', type: 'ability', glyph: '角', max: 3,
    desc: '撞上去就能杀伤\n撞击自伤 -40%\n射速 -30%（仅首级）',
    apply: (S, n) => { S.ram += 1; if (n === 1) S.rate *= 0.7; },
    bloom: S => { S.ram += 1; S.ramGold = 1; } },
  { id: 'deathtrail', name: '死亡尾流', type: 'ability', glyph: '流', max: 3,
    desc: '高速拖出灼热尾流\n消解触及的敌弹',
    apply: S => { S.death += 1; S.spd *= 1.06; S.rate *= 0.93; },
    bloom: S => { S.death += 1; S.spd *= 1.10; S.deathGold = 1; } },

  // ---- 第二批搬运：《奇点回响》的「弹丸改造」与生存系 ----
  // 这一批的共同点是**改动弹丸本身**或**改动击杀的回报**，而不是再堆一层数值。
  { id: 'caliber', name: '口径校准', type: 'stat', glyph: '径', max: 3,
    desc: '弹丸更粗、飞得更远\n弹速 +8%',
    // 本作唯一同时动「半径 / 弹速 / 射程」三个维度的卡。三者都在 pBullet 里读，
    // 所以扇形弹、尾炮、弹片会一起变粗 —— 它是乘法放大器，不是加法。
    apply: S => { S.bulletR += 1.0; S.bspd *= 1.08; S.rangeMul *= 1.10; },
    bloom: S => { S.bulletR += 2.5; S.bspd *= 1.25; S.rangeMul *= 1.35; S.caliberGold = 1; } },
  { id: 'spray', name: '散射喷嘴', type: 'weapon', glyph: '扇', max: 3,
    desc: '齐射额外喷出扇形弹\n单发伤害较低',
    // ⚠️ 用 n 而不是累乘写等级表：sprayMul 是「覆盖式赋值」，续档逐级重放时
    //    累乘写法（*0.7 之类）会把同一个惩罚叠三次。这一点和 ram 的首级惩罚是同一个坑。
    apply: (S, n) => { S.spray += 2; S.sprayMul = 0.62 + (n - 1) * 0.07; },
    bloom: S => { S.spray += 3; S.sprayMul = 1.0; S.sprayArc = 0.30; S.sprayGold = 1; } },
  { id: 'fission', name: '裂变弹芯', type: 'weapon', glyph: '裂', max: 3,
    desc: '炮弹首次命中时\n炸成一圈弹片',
    apply: (S, n) => { S.fission += 1; S.fissionMul = 0.45 + (n - 1) * 0.13; },
    bloom: S => { S.fission += 2; S.fissionMul = 0.85; S.fissionGold = 1; } },
  { id: 'overclock', name: '过载超频', type: 'stat', glyph: '频', max: 3,
    desc: '射速 +9%、伤害 +7%\n最大船体 -9',
    // 高风险高回报：拿血换输出。⚠️ 必须同时夹住 hp（见 apply 末句），
    //    否则拿卡瞬间 S.hp 会大于新的 S.maxHp，血条直接画出界。
    apply: S => { S.rate *= 1.09; S.dmg *= 1.07; S.maxHp = Math.max(30, S.maxHp - 9); S.hp = Math.min(S.hp, S.maxHp); },
    bloom: S => { S.rate *= 1.22; S.dmg *= 1.18; S.maxHp = Math.max(30, S.maxHp - 20); S.hp = Math.min(S.hp, S.maxHp); S.ovGold = 1; } },
  { id: 'leech', name: '噬能回收', type: 'ability', glyph: '噬', max: 3,
    desc: '每次击坠回复\n最大船体的 1.1%',
    // 按**最大**船体的百分比回血 → 与「装甲板」是乘法关系，堆血同时买生存和续航。
    apply: S => { S.leech += 1.1; },
    bloom: S => { S.leech += 3.4; S.leechGold = 1; } },

  // ---- 第三批搬运：《奇点回响》的三张「主动/被动触发」能力 ----
  // 这三张和前面两批的区别是：它们都不是「加一个持续输出源」，而是**改变一次事件的结果**。
  //   lance 把「一次射击」变成贯穿全场的一击
  //   blink 把「一次受击」变成一次脱险
  //   mine  把「一段走位」变成一片雷区
  { id: 'lance', name: '轨道长枪', type: 'ability', glyph: '枪', max: 3,
    desc: '冷却就绪时\n下一发变成贯穿光矛',
    // 冷却用 S.lanceCd 秒；装弹期间照常开火，所以这张卡不会「禁用主炮」。
    apply: (S, n) => { S.lance = n; S.lanceCd = 7.2 - (n - 1) * 1.6; },
    bloom: S => { S.lance = 3; S.lanceCd = 3.2; S.lanceGold = 1; } },
  { id: 'blink', name: '相位折跃', type: 'ability', glyph: '跃', max: 3,
    desc: '重击袭来时自动折跃\n该次伤害作废',
    // ⚠️ 只对「足以破盾的重击」触发（阈值 22）—— 对每一发流弹都触发等于全程无敌。
    apply: (S, n) => { S.blink = n; S.blinkCd = 15 - (n - 1) * 3.5; },
    bloom: S => { S.blink = 3; S.blinkCd = 6.5; S.blinkMax = 1; } },
  { id: 'mine', name: '磁暴雷', type: 'ability', glyph: '雷', max: 3,
    desc: '定时在船尾布设磁雷\n触爆后炸伤一片',
    apply: (S, n) => { S.mine = n; S.mineCd = 6.4 - (n - 1) * 1.4; S.mineMax = 1 + n; },
    bloom: S => { S.mine = 3; S.mineCd = 2.6; S.mineMax = 5; S.mineGold = 1; } },
];
const TYPE_NAME = { stat: '数值', weapon: '弹体', ability: '装置' };

// ============ 模块协同（成对装配即生效） ============
// 只记 flag，数值在运行时读 —— 这样任何时候重算都不会重复叠加。
const SYNERGIES = [
  { id: 'staticArc',  name: '静滞雷场', a: 'arc',       b: 'stasis',     desc: '电弧冷却 -35%' },
  { id: 'resonance',  name: '共振脉冲', a: 'nova',      b: 'stasis',     desc: '冲击波对减速中的敌人伤害 ×1.7' },
  { id: 'droneSwarm', name: '脉冲机群', a: 'nova',      b: 'drone',      desc: '每次冲击波为所有无人机瞬间装填' },
  { id: 'phaseWall',  name: '相位护壁', a: 'shield',    b: 'phasehull',  desc: '护盾回复速度 ×2' },
  { id: 'volley',     name: '齐射穿甲', a: 'multigun',  b: 'piercer',    desc: '每根枪管额外 +1 穿透' },
  { id: 'cluster',    name: '霰爆',     a: 'hesh',      b: 'multigun',   desc: '爆炸范围 +30%' },
  { id: 'pierceCrit', name: '穿甲暴击', a: 'critcap',   b: 'warhead',    desc: '暴击倍率提到 3.3 倍' },
  { id: 'recycle',    name: '回收循环', a: 'magnet',    b: 'nanorepair', desc: '拾取星尘额外回血' },

  // ---- 新机制的配对协同（效果一律在运行时读 synOn()，不在装配那一刻改数值） ----
  { id: 'rearPierce',   name: '贯穿尾炮', a: 'backshot',   b: 'piercer',   desc: '尾炮火力 +45%，并且能穿透' },
  { id: 'rearVolley',   name: '回马枪',   a: 'backshot',   b: 'multigun',  desc: '齐射时尾炮再多 1 门' },
  { id: 'bouncePierce', name: '穿甲跳弹', a: 'piercer',    b: 'ricochet',  desc: '反弹次数 +1' },
  { id: 'moltenRam',    name: '熔火撞角', a: 'deathtrail', b: 'ram',       desc: '冲角杀伤 +50%' },
  { id: 'guidedPierce', name: '制导穿甲', a: 'guided',     b: 'piercer',   desc: '制导转向更急、锁定更远' },
  { id: 'bounceBlast',  name: '跳雷',     a: 'ricochet',   b: 'hesh',      desc: '反弹过的炮弹爆炸范围 +35%' },

  // ---- 第二批机制的配对协同 ----
  // 这一批刻意让新卡去「咬」旧卡：口径咬穿甲、散射咬多联、裂变咬跳弹与高爆、噬能咬冲角与纳米。
  { id: 'heavyBore',    name: '重弹穿甲', a: 'caliber',   b: 'piercer',    desc: '弹丸半径再 +1.5，穿透 +1' },
  { id: 'bulletWall',   name: '弹幕墙',   a: 'spray',     b: 'multigun',   desc: '扇形弹 +3 发、扇形更宽' },
  { id: 'fissionBoom',  name: '裂变爆破', a: 'fission',   b: 'hesh',       desc: '弹片命中也会炸开' },
  { id: 'bounceFission',name: '跳弹裂变', a: 'fission',   b: 'ricochet',   desc: '弹片继承 1 次反弹' },
  { id: 'ramLeech',     name: '撞击汲取', a: 'leech',     b: 'ram',        desc: '冲角每次命中额外回血' },
  { id: 'fieldMedic',   name: '战地回收', a: 'leech',     b: 'nanorepair', desc: '所有回血 ×1.5' },

  // ---- 第三批机制的配对协同 ----
  { id: 'lanceCaliber', name: '重矛',     a: 'lance',  b: 'caliber',  desc: '光矛更宽，贯穿伤害 +40%' },
  { id: 'lancePierce',  name: '透体圣光', a: 'lance',  b: 'piercer',  desc: '光矛命中后留下一道灼烧带' },
  { id: 'blinkNova',    name: '折跃冲击', a: 'blink',  b: 'nova',     desc: '折跃起点炸开一发冲击波' },
  { id: 'blinkPhase',   name: '相位残响', a: 'blink',  b: 'phasehull',desc: '折跃后的无敌时间 ×2' },
  { id: 'mineHesh',     name: '磁暴高爆', a: 'mine',   b: 'hesh',     desc: '磁雷爆炸范围 +45%' },
  { id: 'mineStasis',   name: '迟滞雷场', a: 'mine',   b: 'stasis',   desc: '磁雷爆炸后留下一片减速场' },
];
const synOn = id => !!G.syn[id];
function recalcSynergies() {
  for (const sy of SYNERGIES) {
    if (G.syn[sy.id]) continue;
    if ((G.mods[sy.a] || 0) > 0 && (G.mods[sy.b] || 0) > 0) {
      G.syn[sy.id] = true;
      Sound.sfx.synergy();
      banner('协同 · ' + sy.name, sy.desc, '#c070f0', 2.4);
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
    if (!quiet) for (const h of fresh) { banner('船体解锁 · ' + h.name, h.en, h.color, 3.2); Sound.sfx.ready(); }
  }
  return fresh;
}
// 距离解锁还差多少（给机库显示用）
function unlockProgress(h) {
  const u = h.unlock; if (!u) return null;
  const parts = [];
  if (u.kills) parts.push(Math.min(SAVE.kills, u.kills) + '/' + u.kills + ' 击坠');
  if (u.wave) parts.push('第 ' + Math.min(SAVE.maxWave, u.wave) + '/' + u.wave + ' 段');
  return parts.join(' · ');
}

// ============ 蛛网（织网者铺下的减速场） ============
// 纯空间压力：不造成伤害，只是把你不想去的地方变慢。所以玩家是在「读地图」而不是在挨打。
const WEB_LIFE = 8, WEB_R = 30, WEB_SLOW = 0.45, WEB_MAX = 14;
function addWeb(x, y) {
  if (G.webs.length > WEB_MAX) G.webs.shift();
  G.webs.push({ x: clamp(x, 16, W - 16), y: clamp(y, 16, H - 16), r: WEB_R, life: WEB_LIFE, t: rand(TAU), grow: 0 });
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
    homing: 0, homeR: 140,
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
    shield: 0, shieldMax: 0, shieldRegenMul: 1, magnet: 46,
    regen: 0, invBonus: 0, dustHeal: 0,
    // 装置型能力状态
    arc: 0, arcT: 0, arcCdMul: 1,
    nova: 0, novaT: 3, novaR: 0, novaCd: 7,
    stasis: 0, stasisR: 0, stasisSlow: 0.5,
    // 质变视觉标记（满级后点亮）
    goldTrail: 0, goldMuzzle: 0, goldHurt: 0, droneGold: 0, autoPull: 0, novaVoid: 0,
  };
  // 船体自带的开局加成（蜂群带无人机之类）
  if (hull.drones) S.drones = hull.drones;
  if (hull.droneGold) S.droneGold = hull.droneGold;
  if (hull.critMul) S.critMul = hull.critMul;
  if (hull.crit) S.crit += hull.crit;
  if (hull.magnetMul) S.magnet *= hull.magnetMul;
  return {
    S, hull,
    t: 0, wave: 1, waveState: 'spawn', waveT: 0, zone: 0,
    px: W / 2, py: H / 2, vx: 0, vy: 0, ang: 0, aim: 0,
    fireT: 0, inv: 0, dashT: 0, dashCd: 0, hurtFlash: 0,
    energy: 0, odT: 0, grazeT: 0,
    xp: 0, xpNext: 8, level: 1, kills: 0, score: 0, combo: 1, comboT: 0,
    dust: 0,
    enemies: [], ebullets: [], bullets: [], pickups: [], parts: [], fx: [], drones: [],
    webs: [],   // 织网者铺下的减速场
    wakes: [], wakeT: 0,   // 死亡尾流留下的灼热带（updateWakes 消费）
    lances: [],   // 轨道长枪的瞬时贯穿光矛（纯视觉，伤害在 fireLance 里一次结算完）
    mines: [],    // 磁暴雷（场上至多 S.mineMax 枚）
    boss: null, bossRef: null, bossWarn: 0, bossPending: null, bossT: 0,
    shake: 0, banners: [], toasts: [], hitFlashN: 0,
    hitstop: 0, heartT: 0, vign: 0,     // 打击感：命中凝滞 / 心跳计时 / 受击暗角
    mods: {}, // id -> level
    syn: {},  // 协同 id -> true
    spawnQueue: [], spawnT: 0, waveKills: 0, waveNeed: 0,
    dead: false, won: false,
  };
}

// ============ 打击感 ============
// 命中瞬间冻结画面几十毫秒。这是像素弹幕游戏最重要的手感来源：
// 没有它，击杀只是"敌人消失"；有了它，每一次命中都有重量。
// 上限 0.18s：连杀时不该把游戏冻成幻灯片
function freeze(t) { if (G) G.hitstop = Math.min(0.18, Math.max(G.hitstop, t)); }
// 按事件分级的震动，避免所有东西都震得一样
const SHAKE = { hit: 1.2, crit: 2.4, kill: 3.2, bigKill: 9, hurt: 5.5, blast: 3.5, od: 6 };

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
function nearest(x, y, R, excl) {
  let best = null, bd = R * R;
  forNear(x, y, R, e => {
    if (e === excl || e.dead) return;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  });
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
function addShake(v) { G.shake = Math.min(11, G.shake + v); }
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
  G.bullets.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, dmg,
    r: o.r || (G.S.bulletR + extraR),
    life: o.life || (homing ? 1.45 : 1.1) * G.S.rangeMul,
    // 齐射穿甲：每根枪管额外 +1 穿透，所以要在发射时算（枪管数会变）
    pierce: o.pierce ?? (G.S.pierce + (synOn('volley') ? G.S.barrels : 0)
                          + (synOn('heavyBore') ? 1 : 0)),
    // 跳弹：反弹次数同样发射时定格；穿甲跳弹协同额外 +1
    bounce: o.bounce ?? (G.S.bounce + (synOn('bouncePierce') ? 1 : 0)),
    blast: o.blast ?? G.S.blast, homing, hit: null, col: o.col || null,
    tgt: null, retarget: 0, bounced: false,
    // 裂变弹芯：随弹丸走，命中那一刻才决定炸几片 —— 这样它也能被尾炮 / 弹片继承。
    fission: o.fission ?? G.S.fission, fissionMul: o.fissionMul ?? G.S.fissionMul,
    fissioned: false,
  });
}
// 敌弹自带 dmg（默认 9）。⚠️ 不要在 updateEBullets 里写死 9 ——
// 无尽档位要靠这里把 TIER_DMG 传播到每一发弹丸上，写死就等于弹幕永远挠痒。
function eShot(x, y, ang, spd, r, color, o = {}) {
  if (G.ebullets.length > 900) return;
  G.ebullets.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, color,
    dmg: (o.dmg || 9) * eTierDmg(G.wave), life: o.life || 6, t: 0,
  });
}
const HOSTILE = { red: '#ff3355', pink: '#ff66cc', purple: '#c070f0', amber: '#ffcd75' };

/* 轨道长枪（搬运自 echo 的 lance）
   冷却就绪时，**这一发主动射击**被换成贯穿光矛：不做成「另一门炮自动开火」，
   而是把玩家自己扣的那一次扳机放大 —— 这样它才有「攒一发」的节奏感。
   ⚠️ 判定用「点到线段距离」一次扫全部敌人（O(n)），不要沿矛身逐格 buildGrid+forNear：
      矛长 540px、每 8px 一次查询就是 68 次网格检索，纯浪费。 */
function fireLance(ang) {
  const S = G.S;
  const wide = synOn('lanceCaliber') ? 1.4 : 1;
  const w = (4.5 + S.lance * 1.7) * wide;                     // 半宽
  const len = W + 80;
  const dmg = (44 + S.lance * 26) * S.dmg * (synOn('lanceCaliber') ? 1.4 : 1);
  const ox = G.px + Math.cos(ang) * 10, oy = G.py + Math.sin(ang) * 10;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  let hitN = 0;
  for (const e of G.enemies) {
    if (e.dead || e.hp <= 0) continue;
    const dx = e.x - ox, dy = e.y - oy;
    const along = dx * ca + dy * sa;
    if (along < -e.r || along > len) continue;
    const perp = Math.abs(-dx * sa + dy * ca);
    if (perp > w + e.r) continue;
    damageEnemy(e, dmg, ca, sa, false, 2.4);
    hitN++;
  }
  G.lances.push({ x: ox, y: oy, a: ang, len, w, t: 0, life: 0.26, gold: S.lanceGold ? 1 : 0 });
  // 透体圣光协同：矛身沿途留下一条灼烧带（复用死亡尾流那套 wake 结算）
  if (synOn('lancePierce')) {
    const gold = S.lanceGold ? 1 : 0;
    for (let d = 30; d < len; d += 26) {
      const x = ox + ca * d, y = oy + sa * d;
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) break;
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

function fireMain(ang, dmgMul = 1) {
  const S = G.S, n = S.barrels;
  // 长枪就绪 → 这一发整个换成光矛（不叠主炮，避免「既开炮又开矛」变成双倍 DPS）
  if (S.lance > 0 && S.lanceT <= 0) { fireLance(ang); return; }
  const base = 10 * S.dmg * dmgMul;
  const muzzle = 11;
  const spd = 320 * S.bspd;      // 口径校准：弹速是全局弹丸参数，尾炮 / 扇形弹一起吃
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
    const a = ang + spread;
    pBullet(G.px + Math.cos(a) * muzzle, G.py + Math.sin(a) * muzzle, a, spd, base);
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
      pBullet(G.px + Math.cos(a) * 9, G.py + Math.sin(a) * 9, a, spd * 0.92,
        base * S.sprayMul, { col: S.sprayGold ? '#ffcd75' : '#94b0c2' });
    }
  }
  // 尾炮：每次齐射同时向船尾开火。伤害只有正面的 55%，所以它不是「DPS 翻倍」，
  // 而是把「背后永远安全」这条默认规则取消掉 —— 被追着跑的时候才有意义。
  if (S.backshot > 0) {
    const bn = S.backshot + (synOn('rearVolley') ? 1 : 0);
    const back = ang + Math.PI;
    const bMul = 0.55 * (synOn('rearPierce') ? 1.45 : 1);
    const bpierce = S.pierce + (synOn('volley') ? S.barrels : 0) + (synOn('rearPierce') ? 1 : 0);
    for (let i = 0; i < bn; i++) {
      const spread = bn === 1 ? 0 : (i - (bn - 1) / 2) * 0.17;
      const a = back + spread;
      pBullet(G.px + Math.cos(a) * 9, G.py + Math.sin(a) * 9, a, spd * 0.94, base * bMul,
        { col: S.backGold ? '#ffcd75' : '#ef7d57', pierce: bpierce });
    }
  }
  Sound.sfx.shoot();
  G.muzzle = 0.06;
}

function activateOverdrive() {
  if (G.energy < 100 || G.odT > 0) return;
  G.energy = 0; G.odT = 5;
  Sound.sfx.overdrive();
  banner('超载爆发', '火力翻倍 · 5 秒', '#73eff7', 1.8);
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
  let dx = 0, dy = 0;
  if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
  if (!dx && !dy) { dx = Math.cos(G.aim); dy = Math.sin(G.aim); }
  const m = Math.hypot(dx, dy) || 1;
  G.vx += dx / m * 300 * S.spd; G.vy += dy / m * 300 * S.spd;
  G.dashT = 0.22; G.dashCd = 1.25; G.inv = Math.max(G.inv, 0.3);
  Sound.sfx.dash();
  for (let i = 0; i < 10; i++) {
    part({ x: G.px - dx * i * 2, y: G.py - dy * i * 2, vx: -dx * 40, vy: -dy * 40, life: .3, max: .3, col: '#73eff7', size: 2, drag: 4 });
  }
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
  e.hp -= dmg;
  e.flash = 0.09;
  if (guarded) {
    if (!quiet && (e.guardT || 0) <= 0) {
      e.guardT = 0.35;
      const gx = e.x + Math.cos(e.ang) * e.r, gy = e.y + Math.sin(e.ang) * e.r;
      floatText(gx, gy - 6, '格挡', '#c0cbdc', .55);
      ring(gx, gy, 10, '#c0cbdc', .2, 1);
      Sound.sfx.shield();
    }
  } else if (!quiet && G.hitFlashN < 90) { addNum(e.x + rand(-4, 4), e.y - e.r - 2, dmg, crit); G.hitFlashN++; }
  if (kb) { e.x += dx * kb * 1.5; e.y += dy * kb * 1.5; }
  // 普通命中不加凝滞（每发都冻会变幻灯片），只在暴击时给一记顿挫
  if (crit && e.hp > 0) { freeze(0.028); addShake(SHAKE.crit); }
  if (e.hp <= 0) killEnemy(e);
  else if (!quiet) Sound.sfx.hit();
}

function dropPickup(type, x, y, v = 1) {
  if (G.pickups.length > 260) return;
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
  // 噬能回收：以战养战。按**最大**船体的百分比回血，所以它和「装甲板」是乘法关系 ——
  // 堆血同时买生存和续航。放在最后，让同一帧的击杀结算完再回。
  if (G.S.leech > 0) healPlayer(G.S.leech / 100 * G.S.maxHp * (synOn('fieldMedic') ? 1.5 : 1));
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
  G.px = clamp(G.px + Math.cos(a) * dist, 16, W - 16);
  G.py = clamp(G.py + Math.sin(a) * dist, 16, H - 16);
  G.vx *= 0.25; G.vy *= 0.25;
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
  S.hp -= dmg;
  G.hurtFlash = 0.35; G.inv = 0.55 + S.invBonus; G.combo = 1; G.comboT = 0;
  addShake(SHAKE.hurt); Sound.sfx.hurt(); freeze(0.07);
  G.vign = 1;   // 受击暗角，随时间衰减
  burst(G.px, G.py, 14, ['#e04060', '#ffcd75'], 110, .5, 2, true);
  if (S.hp <= 0) { S.hp = 0; die(); }
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
  if (!small) { Sound.sfx.boom(); addShake(SHAKE.blast); freeze(0.05); }
  buildGrid();
  forNear(x, y, R, e => {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > R + e.r) return;
    damageEnemy(e, dmg * (1 - d / (R + e.r) * .5), (e.x - x) / (d || 1), (e.y - y) / (d || 1), false, 1.5, small);
  });
}

// ============ 敌人 ============
// ⚠️ 敌人能被推到的最远处必须**小于**子弹的回收边界（updateBullets 里的 ±20），
// 否则会出现「站在屏边、子弹够不着」的不死敌人 → updateWave 的「场上清空」永远不成立。
// 踩过两次：浮游雷生成在屏外不移动；牧者一路后退被夹在 ±40 停住。
const EDGE = 20;
// ⚠️⚠️ 这里原来写的是 `irand(4)` —— 但 irand 是 (a, b) 两参数签名，
//   `irand(4)` 的第二参是 undefined → `rand(4, undefined + 1)` = `rand(4, NaN)` = NaN。
//   s 恒为 NaN，四个 `if (s === n)` 全部落空，**永远走最后一条 return** ——
//   也就是说整局游戏的杂兵**只从右侧一条边进场**（四个方向的设计完全没生效）。
//   不抛异常、不掉帧、没有任何报错，只是玩法悄悄少掉 3/4 的进场方向。
//   同款错误在 bagPickBoss 的洗牌里也有一份（见那里注释）。
//   以后新增 irand 调用一律写 irand(lo, hi)。
function spawnPos() {
  const s = irand(0, 3), m = EDGE;
  if (s === 0) return [rand(W), -m];
  if (s === 1) return [rand(W), H + m];
  if (s === 2) return [-m, rand(H)];
  return [W + m, rand(H)];
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
  // spawnPos() 一律给屏外 26px，而玩家被夹在 [10, W-10] → 最近也有 36px，
  // 触发不了 d<34 的自爆；子弹又在 x<-20 就被回收 → 这颗雷谁也打不到，
  // updateWave 的「场上清空」永远不成立 → **整段航程卡死**（实测卡了 700 秒）。
  if (c.ai === 'mine') { x = clamp(x, 14, W - 14); y = clamp(y, 14, H - 14); }
  const hp = c.hp * hpScale() * (opt.hpMul || 1);
  const e = {
    type, cfg: c, x, y, vx: 0, vy: 0, hp, maxHp: hp, r: c.r,
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
  if (e.elite) { e.hp *= 1.8; e.maxHp *= 1.8; e.r += 1; }
  G.enemies.push(e);
  markSeen(type);        // 图鉴：这只算「遭遇过」
  return e;
}
function spawnBoss(id) {
  const b = BOSSES[id]; if (!b) return;
  markSeen(id);          // 图鉴：巨像名录
  // 巨像血量：主线的线性成长同样在 WAVES 封顶，之后交给深渊档位的指数曲线。
  // 无尽里巨像会重复出场（轮换袋），所以它必须真的跟着档位变硬，否则第 3 轮就是纸糊的。
  const hp = b.hp * (1 + (Math.min(G.wave, WAVES) - 4) * 0.05) * eTierHp(G.wave);
  const e = {
    type: 'boss', boss: id, name: b.name, en: b.en, spr: b.spr, color: b.color,
    x: W / 2, y: -40, vx: 0, vy: 0, hp, maxHp: hp, r: b.r,
    // 巨像固定掉 12 颗星尘（killEnemy 的 big 分支），每颗 6 点 → 一只巨像约一级。
    // 同样必须显式给，否则又是 undefined → NaN。
    xp: 6,
    t: 0, flash: 0, cd: 1.6, touchCd: 0, alpha: 1, st: 0, ang: Math.PI / 2,
    pats: b.pats, patI: 0, patT: 2, phase: 1, enraged: false, entering: true,
  };
  G.enemies.push(e);
  G.boss = e; G.bossRef = b;
  banner(b.name, b.en, b.color, 3);
  Sound.sfx.warn();
  Sound.setMode('boss');
}

function bossFire(e, dx, dy) {
  const R = Math.hypot(dx, dy) || 1; dx /= R; dy /= R;
  const pat = e.pats[e.patI % e.pats.length];
  // 主线 +3/段，到 WAVES 封顶；无尽里交给档位速度倍率（它自己也有 1.5 的上限）
  const spd = (92 + Math.min(G.wave, WAVES) * 3) * eTierSpd(G.wave);
  const fast = e.enraged ? 1.25 : 1;
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
  }
}

function updateBoss(e, dt, dx, dy, d) {
  e.t += dt;
  if (e.entering) {
    e.y += 40 * dt;
    if (e.y > 62) { e.entering = false; e.vy = 0; }
    return;
  }
  if (!e.enraged && e.hp < e.maxHp * 0.45) {
    e.enraged = true; e.phase = 2;
    banner('狂暴', e.name + ' · 第二阶段', '#ff5577', 2);
    Sound.sfx.warn(); addShake(6);
  }
  // 悬停机动：绕场心做 8 字，狂暴后逼近
  const tx = W / 2 + Math.cos(e.t * 0.55) * 128;
  const ty = 78 + Math.sin(e.t * 1.1) * 34 - (e.enraged ? 20 : 0);
  e.vx += (tx - e.x) * 1.4 * dt * (e.enraged ? 1.5 : 1);
  e.vy += (ty - e.y) * 1.4 * dt * (e.enraged ? 1.5 : 1);
  e.vx *= 0.97; e.vy *= 0.97;
  e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
  e.y = clamp(e.y + e.vy * dt, e.r, H - e.r);
  e.ang = Math.atan2(dy, dx);
  e.cd -= dt * (e.enraged ? 1.5 : 1);
  if (e.cd <= 0) {
    bossFire(e, dx, dy);
    e.patI++;
    e.cd = (e.enraged ? 1.1 : 1.9) + rand(0.3);
  }
  // 阶段转换时撒一波小怪
  if (e.enraged && !e.spawnedAdds) {
    e.spawnedAdds = true;
    for (let i = 0; i < 4; i++) spawnEnemy('reaver', e.x + rand(-30, 30), e.y + rand(-20, 20));
  }
}

function bossDeath(e) {
  G.boss = null; G.bossRef = null;
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
  banner('巨像 · 已击碎', e.name, '#ffcd75', 2.4);
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
    // 静止场的减速由 updateAbilities 每帧挂上，这里用完就衰减，出圈立刻恢复
    // spdMul 是生成时按深渊档位定死的（见 spawnEnemy），这里只乘上去
    const spd = c.spd * (e.spdMul || 1) * (e.elite ? 1.15 : 1) * (1 - (e.slow || 0)) * (e.buffT > 0 ? 1.22 : 1);
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
          e.x = clamp(px + Math.cos(a) * r, 10, W - 10);
          e.y = clamp(py + Math.sin(a) * r, 10, H - 10);
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
        // 缓慢往场内漂：万一被推到屏外也能自己回来（见 spawnEnemy 里的说明）
        const inx = clamp(e.x, 26, W - 26), iny = clamp(e.y, 26, H - 26);
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
    // 只靠硬夹边不够 —— 它们会一路后退停在屏边，玩家够不着，这一波就清不完。
    if (c.range && !e.boss) {
      const IN = 44, k = spd * 3.2 * dt;
      if (e.x < IN) e.vx += k;
      if (e.x > W - IN) e.vx -= k;
      if (e.y < IN) e.vy += k;
      if (e.y > H - IN) e.vy -= k;
    }
    // 阻尼 & 限速（冲锋态允许超速）
    const damp = c.ai === 'dash' && e.st >= 0.9 && e.st < 1.5 ? 0.995 : 0.94;
    e.vx *= damp; e.vy *= damp;
    const maxV = spd * (c.ai === 'dash' ? 3.4 : 1.5);
    const vm = Math.hypot(e.vx, e.vy);
    if (vm > maxV) { e.vx = e.vx / vm * maxV; e.vy = e.vy / vm * maxV; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    // 边界：允许贴在屏边一点点，但绝不允许超出子弹够得着的范围（见 EDGE 的说明）
    if (e.x < -EDGE) e.x = -EDGE; if (e.x > W + EDGE) e.x = W + EDGE;
    if (e.y < -EDGE) e.y = -EDGE; if (e.y > H + EDGE) e.y = H + EDGE;
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
  // 清理
  for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].hp <= 0) G.enemies.splice(i, 1);
}

// ============ 玩家 ============
// 操控向《奇点回响》看齐：
//   转向：A / D（或方向键左/右） —— aimMode=='key' 时按角速度 S.turn 旋转
//         鼠标（aimMode=='mouse'） —— 朝光标方向缓慢转向（最大 12 rad/s）
//         摇杆（joy.active） —— 推满 = 满舵；微推 = 慢转
//   推进：W（或方向键上） —— 沿当前 G.ang 方向施加加速度
//   制动：S（或方向键下） —— 指数衰减速度（强于常规阻尼）
//   常态阻尼：exp(-0.45*dt)，松手后慢慢漂停
// 开火 / 冲刺 / 超载 / 子弹 / 冲角 / 死亡尾流 / 网黏粒子照旧。
function updatePlayer(dt) {
  const S = G.S;
  // ---- 转向 ----
  if (joy.active) {
    // 摇杆：方向即目标，转速随推杆幅度线性放缩（模拟量手感）
    const want = Math.atan2(joy.y, joy.x);
    const mag = Math.hypot(joy.x, joy.y);
    const rate = S.turn * (0.45 + 0.55 * Math.min(1, mag));
    let d = ((want - G.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (d > rate * dt) d = rate * dt;
    else if (d < -rate * dt) d = -rate * dt;
    G.ang += d;
  } else if (aimMode === 'mouse' && mouse.inside) {
    const want = Math.atan2(mouse.y - G.py, mouse.x - G.px);
    const d = ((want - G.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const max = 12 * dt;
    G.ang += clamp(d, -max, max);
  } else {
    // 键盘 A/D：未按键不漂移
    const kd = ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0)
             - ((keys['KeyA'] || keys['ArrowLeft']) ? 1 : 0);
    if (kd) G.ang += kd * S.turn * dt;
  }
  G.aim = G.ang;

  // ---- 推进 / 制动 / 阻尼 ----
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
  const ACC = 620 * S.spd * slowMul;
  const MAXV = 168 * S.spd * slowMul;
  if (thrusting) {
    G.vx += Math.cos(G.ang) * ACC * dt;
    G.vy += Math.sin(G.ang) * ACC * dt;
  }
  // 阻尼：制动用 echo 的强衰减（exp -2.6），常态用轻阻尼（exp -0.45）保留太空感
  const k = Math.exp((braking ? -2.6 : -0.45) * dt);
  G.vx *= k; G.vy *= k;
  const vm = Math.hypot(G.vx, G.vy);
  if (vm > MAXV) { G.vx = G.vx / vm * MAXV; G.vy = G.vy / vm * MAXV; }
  G.px = clamp(G.px + G.vx * dt, 10, W - 10);
  G.py = clamp(G.py + G.vy * dt, 10, H - 10);
  if (G.px <= 10 || G.px >= W - 10) G.vx *= 0.4;
  if (G.py <= 10 || G.py >= H - 10) G.vy *= 0.4;
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
  const wantFire = (mouse.down || keys['Space'] || G.autoFire) && !G.dead;
  if (wantFire && G.fireT <= 0) {
    const iv = 0.17 / S.rate / (G.odT > 0 ? 2 : 1);
    G.fireT = iv;
    fireMain(G.ang, G.odT > 0 ? 1.35 : 1);
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
        pBullet(d.x, d.y, a, 300, 7 * S.dmg, { col: '#ffcd75', r: 2 });
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

function updateAbilities(dt) {
  const S = G.S;
  // --- 电弧线圈：定时链击最近 N 个目标 ---
  if (S.arc > 0) {
    S.arcT -= dt;
    if (S.arcT <= 0) {
      const cd = 2.2 * S.arcCdMul * (synOn('staticArc') ? 0.65 : 1);
      const targets = nearestN(G.px, G.py, 210, 1 + S.arc);
      if (targets.length) {
        S.arcT = cd;
        let ax = G.px, ay = G.py;
        for (const t of targets) {
          G.fx.push({ type: 'arc', x0: ax, y0: ay, x1: t.x, y1: t.y, t: 0, life: 0.18, gold: S.arc >= 4 });
          damageEnemy(t, 9 * S.dmg * (1 + S.arc * 0.35), 0, 0, false, 0.4, true);
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
      const bx = clamp(G.px - Math.cos(G.ang) * 14, 8, W - 8);
      const by = clamp(G.py - Math.sin(G.ang) * 14, 8, H - 8);
      G.mines.push({
        x: bx, y: by, t: 0, life: 11, arm: 0.35,   // arm：布设后短暂待机，免得刚落就被贴脸怪点掉
        r: 7 + S.mine * 1.4, blast: 34 + S.mine * 14, dmg: (30 + S.mine * 22) * S.dmg,
        gold: S.mineGold ? 1 : 0, pull: 34 + S.mine * 12,
      });
      ring(bx, by, 10, S.mineGold ? '#ffcd75' : '#c070f0', .22, 1);
      Sound.sfx.mine();
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
  forNear(m.x, m.y, R, e => {
    if (e.dead || e.hp <= 0) return;
    const d = Math.hypot(e.x - m.x, e.y - m.y);
    if (d > R + e.r) return;
    damageEnemy(e, dmg, (e.x - m.x) / (d || 1), (e.y - m.y) / (d || 1), false, 3);
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
    // --- 制导：每隔 0.12 秒才重新找一次目标 ---
    // ⚠️ 每帧都 nearest(homeR 满级 260) 的话是 (260/24)²≈118 个格子 × 场上每发弹，
    //    装上制导就等于给整个弹幕系统加了一层固定开销。按弹缓存目标后开销降到 1/7。
    //    正因为有这层缓存，homeR 才敢开到 260（近全屏）。
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
        const turn = b.homing * (synOn('guidedPierce') ? 1.45 : 1);
        b.ang += clamp(da, -turn * dt, turn * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(b.ang) * sp; b.vy = Math.sin(b.ang) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0) { G.bullets.splice(i, 1); continue; }
    // --- 出界：跳弹先反弹，没次数了才回收 ---
    // ⚠️ 反弹点固定在 ±20（和 EDGE 同一个值）。反弹后子弹一定留在场内，
    //    所以不会出现「子弹在场外打转、永远打不到屏边敌人」的死循环。
    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      if (b.bounce > 0) {
        b.bounce--;
        if (b.x < -20 || b.x > W + 20) { b.vx = -b.vx; b.x = clamp(b.x, -19, W + 19); }
        if (b.y < -20 || b.y > H + 20) { b.vy = -b.vy; b.y = clamp(b.y, -19, H + 19); }
        b.ang = Math.atan2(b.vy, b.vx);
        b.tgt = null; b.retarget = 0;
        b.bounced = true;
        b.life = Math.max(b.life, 0.55);   // 别刚弹回来就寿终，那玩家根本看不见这一跳
        burst(b.x, b.y, 3, ['#73eff7', '#f4f4f4'], 46, .18, 1);
      } else { G.bullets.splice(i, 1); continue; }
    }
    // 命中
    let hit = null;
    forNear(b.x, b.y, 14, e => {
      if (hit || e.dead) return;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 <= (e.r + b.r) ** 2) hit = e;
    });
    if (!hit) continue;
    const S = G.S;
    const crit = Math.random() < S.crit;
    const dmg = b.dmg * (crit ? (synOn('pierceCrit') ? 3.3 : S.critMul) : 1);
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
          col: G.S.fissionGold ? '#ffcd75' : '#ef7d57',
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
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { G.ebullets.splice(i, 1); continue; }
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
function updatePickups(dt) {
  // 磁力线圈质变后全屏吸附
  const S = G.S, R = S.autoPull ? 420 : S.magnet;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i];
    p.t += dt; p.life -= dt;
    if (p.life <= 0) { G.pickups.splice(i, 1); continue; }
    const dx = G.px - p.x, dy = G.py - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < R) {
      // 磁力吸附：越近越快
      const pull = 300 * (1 - d / R) + 90;
      p.vx += dx / d * pull * dt; p.vy += dy / d * pull * dt;
    }
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, 4, W - 4); p.y = clamp(p.y, 4, H - 4);
    if (d < 11) {
      G.pickups.splice(i, 1);
      if (p.type === 'dust') {
        addXp(p.v); Sound.sfx.dust();
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
    if (p.life <= 0) { G.parts.splice(i, 1); continue; }
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
      if (!f.fired && f.t >= fireAt) {
        f.fired = true;
        const dx = Math.cos(f.ang), dy = Math.sin(f.ang);
        const dd = Math.abs((G.px - f.x) * -dy + (G.py - f.y) * dx); // 点到直线距离
        if (dd < f.w + 7) hurtPlayer(16);
        addShake(5);
      }
    }
    if (f.t >= f.life) G.fx.splice(i, 1);
  }
  for (let i = G.banners.length - 1; i >= 0; i--) { G.banners[i].t += dt; if (G.banners[i].t > G.banners[i].life) G.banners.splice(i, 1); }
  for (let i = G.toasts.length - 1; i >= 0; i--) { G.toasts[i].t += dt; if (G.toasts[i].t > G.toasts[i].life) G.toasts.splice(i, 1); }
}

// ============ 航程导演 ============
function startWave(w) {
  G.wave = w;
  // 星区：主线按 ZONES 的区间走；无尽里 1-2-3 循环，让星野背景也跟着换（视觉不至于腻）。
  const zi = ZONES.findIndex(zz => w >= zz.from && w <= zz.to);
  G.zone = zi >= 0 ? zi : (w - 1) % ZONES.length;
  const zone = ZONES[G.zone];
  G.waveKills = 0;
  G.spawnQueue = [];
  G.spawnT = 0.6;
  G.waveT = 0;
  Sound.sfx.warp();
  const tier = eTier(w);
  const bossId = bossForWave(w);
  if (bossId) {
    G.waveState = 'boss';
    // ⚠️ 不要用 setTimeout 排 boss 入场：那是**真实时间**，而 waveT 是**游戏时间**。
    // fast>1 时 waveT 先跑到 2 秒 → updateWave 判「场上没 boss 也没敌人」→ 直接 finishWave，
    // 巨像整段被跳过（实测 fast=4 时第 4/8 段只用 3.7s 就过了）。
    G.bossPending = bossId;
    G.bossT = 1.2;
    const b = BOSSES[bossId];
    // 无尽里巨像会重复出场，所以要把档位报出来 —— 不然玩家会以为游戏没在变难
    banner('第 ' + w + ' 段 · ' + zone.name,
      tier > 0 ? b.name + '（深渊 ' + tier + ' 档）' : '巨像接近中', '#ff5577', 2.4);
    G.waveNeed = 1;
  } else {
    G.waveState = 'spawn';
    G.bossPending = null;
    const sq = SQUADS[zone.squads[(w - 1) % 4]] || SQUADS.mixed;
    G.squadName = sq.name;
    // 无尽里每档额外加量（封顶 +10）—— 这是「越打越挤」的主要来源，比单纯加血更有压迫感
    const base = 7 + Math.min(w, WAVES) * 2.2;
    const n = Math.round(base * sq.cnt) + eTierExtra(w);
    G.waveNeed = n;
    for (let i = 0; i < n; i++) {
      let t = pick(sq.mix);
      // 星区越深，混入更硬的敌型；无尽里强度固定按最深的星区来配
      if (G.zone === 2 || tier > 0) {
        if (Math.random() < 0.26) t = pick(['bastion', 'stalker', 'bulwark', 'shepherd', 'weaver']);
      } else if (G.zone === 1 && Math.random() < 0.2) t = pick(['shifter', 'mine', 'leech', 'weaver', 'nova']);
      G.spawnQueue.push(t);
    }
    banner('第 ' + w + ' 段 · ' + zone.name,
      tier > 0 ? '深渊 ' + tier + ' 档 · ' + sq.name : '编队主题：' + sq.name, '#73eff7', 2.2);
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
    G.spawnT -= dt;
    if (G.spawnQueue.length && G.spawnT <= 0 && alive < 58) {
      G.spawnT = Math.max(0.12, 0.55 - w * 0.02);
      const t = G.spawnQueue.shift();
      const elite = Math.random() < Math.min(0.18, 0.03 + w * 0.012);
      spawnEnemy(t, undefined, undefined, { elite });
    }
    if (!G.spawnQueue.length && alive === 0) finishWave();
    // 兜底：真有敌人卡在打不到的位置（浮游雷踩过一次），别让整局挂死
    else if (!G.spawnQueue.length && alive <= 3 && G.waveT > 180) {
      for (const e of G.enemies.slice()) if (e.hp > 0) killEnemy(e);
    }
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
    banner('航程 · 抵达奇点', '通关 —— 无尽航程开启', '#ffcd75', 3.4);
    Sound.sfx.ready();
    addShake(8);
    G.waveState = 'warp'; G.waveT = 0;
    return;
  }
  G.waveState = 'warp'; G.waveT = 0;
  banner('航段肃清', '跃迁至第 ' + (G.wave + 1) + ' 段', '#a7f070', 1.8);
  Sound.sfx.ready();
  Sound.setMode('cruise');
}

// ============ 主步进 ============
function step(dt) {
  G.t += dt;
  G.hitFlashN = 0;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
  if (G.vign > 0) G.vign = Math.max(0, G.vign - dt * 2.4);
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
  updateBullets(dt);
  // ⚠️ 尾流必须在 updateEBullets 之前：它的职责之一是把敌弹吃掉，
  //    排到后面就变成「先被弹打到、再把弹清掉」，玩家会觉得这模块根本没生效。
  updateWakes(dt);
  updateMines(dt);
  updateEBullets(dt);
  updatePickups(dt);
  updateParts(dt);
  updateFx(dt);
  updateLances(dt);
  updateWebs(dt);
  updateWave(dt);
}

// ============ 渲染 ============
function onScreen(x, y, m = 40) { return x > -m && x < W + m && y > -m && y < H + m; }

function drawBackground() {
  const set = STARSETS[G.zone] || STARSETS[0];
  ctx.fillStyle = set.bg; ctx.fillRect(0, 0, W, H);
  // 三层视差星野
  const pf = [0.06, 0.14, 0.26];
  for (let L = 0; L < 3; L++) {
    const tile = set.layers[L];
    const ox = -((G.px * pf[L]) % 64), oy = -((G.py * pf[L]) % 64);
    for (let y = oy - 64; y < H + 64; y += 64)
      for (let x = ox - 64; x < W + 64; x += 64)
        ctx.drawImage(tile, Math.round(x), Math.round(y));
  }
  // 漂浮岩石
  if (!G.decor) {
    G.decor = [];
    for (let i = 0; i < 12; i++) G.decor.push({ x: rand(W), y: rand(H), s: irand(0, 1), big: Math.random() < 0.3, a: rand(TAU), va: rand(-0.25, 0.25), p: rand(0.1, 0.3) });
  }
  for (const d of G.decor) {
    d.a += d.va * DT;
    const rk = ROCKS[G.zone] || ROCKS[0];
    const img = d.big ? rk.big : rk.s;
    const px = ((d.x - G.px * d.p) % (W + 80) + (W + 80)) % (W + 80) - 40;
    const py = ((d.y - G.py * d.p) % (H + 80) + (H + 80)) % (H + 80) - 40;
    ctx.save();
    ctx.translate(px + img.width / 2, py + img.height / 2);
    ctx.rotate(d.a);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
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
    }
  }
}

function drawPlayer() {
  const S = G.S;
  // 冲刺残影
  if (G.dashT > 0) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.18 * (4 - i);
      drawShip(ctx, S.hull, G.ang, G.px - Math.cos(G.ang) * i * 7, G.py - Math.sin(G.ang) * i * 7, true);
      ctx.globalAlpha = 1;
    }
  }
  if (G.dead) return;
  const blink = G.inv > 0 && ((G.t * 20) | 0) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.45;
  if (G.odT > 0) drawGlow(ctx, '#73eff7', 22, 0.4, G.px, G.py);
  drawShip(ctx, S.hull, G.ang, G.px, G.py, G.hurtFlash > 0);
  ctx.globalAlpha = 1;
  // 引擎焰
  if (G.thrust) {
    const bx = G.px - Math.cos(G.ang) * 9, by = G.py - Math.sin(G.ang) * 9;
    const len = 3 + ((G.t * 30) | 0) % 3;
    ctx.fillStyle = '#ffcd75';
    for (let i = 0; i < len; i++) {
      const d = 3 + i * 2;
      ctx.fillRect(Math.round(bx - Math.cos(G.ang) * d) - 1, Math.round(by - Math.sin(G.ang) * d) - 1, 2, 2);
    }
  }
  // 枪口闪光（自动装填质变后喷金焰）
  if (G.muzzle > 0) {
    const mx = G.px + Math.cos(G.ang) * 12, my = G.py + Math.sin(G.ang) * 12;
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

function drawPBullets() {
  // 友方：青白细针，画在敌人之下。带 col 的（尾炮橙 / 满级尾炮金 / 无人机金）走配色变体。
  for (const b of G.bullets) {
    drawBulletSet(ctx, b.ang, b.x, b.y, b.col);
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
  for (const p of G.parts) {
    const f = p.life / p.max;
    if (p.num !== undefined) {
      ctx.globalAlpha = Math.min(1, f * 1.6);
      text(p.num, p.x, p.y, p.color, 'c', p.size === 0 ? 12 : p.size);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.globalAlpha = Math.min(1, f * 1.4);
    const s = Math.max(1, Math.round(p.size * (0.5 + f)));
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    ctx.globalAlpha = 1;
  }
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

function drawHUD() {
  const S = G.S;
  // 左上：船体 / 护盾 / 经验
  const hpf = S.hp / S.maxHp;
  bar(8, 8, 116, 7, hpf, hpf > 0.35 ? '#e04060' : '#ff3355', '#1a1c2c', '#ff8aa0');
  text('船体', 8, 17, '#7a86a8');
  text(Math.ceil(S.hp) + '/' + Math.round(S.maxHp), 124, 17, '#f4f4f4', 'r');
  if (S.shieldMax > 0) {
    bar(8, 26, 116, 4, S.shield / S.shieldMax, '#73eff7');
    text('盾', 8, 31, '#7a86a8');
  }
  const yxp = S.shieldMax > 0 ? 42 : 30;
  bar(8, yxp, 116, 4, G.xp / G.xpNext, '#ffcd75');
  text('LV ' + G.level, 8, yxp + 5, '#ffcd75');
  text(G.xp + '/' + G.xpNext, 124, yxp + 5, '#7a86a8', 'r');

  // 已装配模块
  let mx = 8, my = yxp + 18;
  for (const id in G.mods) {
    const m = MODULES.find(v => v.id === id); if (!m) continue;
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, 15, 13);
    ctx.strokeStyle = m.type === 'stat' ? '#41a6f6' : m.type === 'weapon' ? '#ef7d57' : '#c070f0';
    ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, 16, 14);
    text(m.name[0], mx + 2, my + 1, '#f4f4f4');
    text('' + G.mods[id], mx + 11, my + 6, '#ffcd75', 'c', 12, null);
    mx += 18;
    if (mx > 110) { mx = 8; my += 16; }
  }

  // 主动能力冷却（装了才显示）：长枪 / 折跃 / 磁雷。
  // 这三张卡的强度全在「就绪」那一刻，玩家必须一眼看到还剩多久 —— 藏在暂停页里等于没有。
  let ax = 8;
  const ay = my + 17;
  const cdPip = (g, ready, ratio, col) => {
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(ax, ay, 15, 14);
    // 就绪时外框亮起，未就绪时只画底部进度条
    ctx.strokeStyle = ready ? col : '#333c57';
    ctx.lineWidth = 1; ctx.strokeRect(ax - 0.5, ay - 0.5, 16, 15);
    text(g, ax + 3, ay + 1, ready ? col : '#566c86');
    ctx.fillStyle = ready ? col : '#41a6f6';
    ctx.fillRect(ax, ay + 12, Math.round(15 * clamp(ratio, 0, 1)), 2);
    ax += 18;
  };
  if (S.lance > 0) cdPip('枪', S.lanceT <= 0, 1 - S.lanceT / S.lanceCd, S.lanceGold ? '#ffcd75' : '#73eff7');
  if (S.blink > 0) cdPip('跃', S.blinkT <= 0, 1 - S.blinkT / S.blinkCd, S.blinkMax ? '#ffcd75' : '#c070f0');
  if (S.mine > 0) cdPip('雷', G.mines.length < S.mineMax, 1 - S.mineT / S.mineCd, S.mineGold ? '#ffcd75' : '#c070f0');

  // 右上：分数 / 航段 / 时间
  text('分数', W - 8, 6, '#7a86a8', 'r');
  text('' + G.score, W - 8, 16, '#f4f4f4', 'r');
  const z = ZONES[G.zone];
  text(waveLabel(G.wave), W - 8, 28, G.wave > WAVES ? '#ffcd75' : '#73eff7', 'r');
  text(z.name, W - 8, 38, '#7a86a8', 'r');
  text(fmtTime(G.t), W - 8, 48, '#7a86a8', 'r');
  if (G.combo > 1) text('x' + G.combo, W - 8, 60, '#ffcd75', 'r');

  // 能量条（底部中央）
  const ew = 120, ex = (W - ew) / 2, ey = H - 16;
  bar(ex, ey, ew, 6, G.energy / 100, G.energy >= 100 ? '#ffcd75' : '#41a6f6');
  text(G.energy >= 100 ? '超载就绪 [E]' : '能量', W / 2, ey - 11, G.energy >= 100 ? '#ffcd75' : '#7a86a8', 'c');
  // 冲刺冷却
  const dw = 60, dx2 = W / 2 - dw - 74;
  bar(dx2, ey, dw, 6, G.dashCd > 0 ? 1 - G.dashCd / 1.25 : 1, G.dashCd > 0 ? '#566c86' : '#73eff7');
  text('冲刺', dx2 + dw / 2, ey - 11, '#7a86a8', 'c');
  // 剩余敌数
  const remain = G.spawnQueue.length + G.enemies.length;
  text('剩余 ' + remain, W / 2 + 74 + 14, ey + 1, '#c0cbdc', 'l');

  // Boss 血条
  if (G.boss) {
    const b = G.boss, bw = 240, bx = (W - bw) / 2;
    bar(bx, 8, bw, 8, b.hp / b.maxHp, b.enraged ? '#ff3355' : '#e04060', '#1a1c2c', '#ff8aa0');
    text(b.name + ' · ' + b.en, W / 2, 20, '#ffcd75', 'c');
  }
}

function drawBanners() {
  let y = 74;
  for (const b of G.banners) {
    const k = b.t / b.life;
    const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    text(b.title, W / 2, y, b.color, 'c', 24);
    if (b.sub) text(b.sub, W / 2, y + 26, '#c0cbdc', 'c');
    ctx.globalAlpha = 1;
    y += 48;
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
function drawCrosshair() {
  const S = G.S;
  const firing = G.muzzle > 0;
  const col = G.odT > 0 ? '#ffcd75' : (firing ? '#f4f4f4' : (S.hullColor || '#73eff7'));

  if (pointerKind === 'touch') {
    // 摇杆底座 + 推杆：之前触屏完全没有操作反馈，指头一按下去什么都看不见
    if (joy.active) {
      const [jx, jy] = toGame(joy.ox, joy.oy);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#73eff7'; framePx(jx - 22, jy - 22, 45, 45);
      ctx.globalAlpha = 0.9; disc(jx + joy.x * 22, jy + joy.y * 22, 5);
      ctx.globalAlpha = 1;
    }
    if (!mouse.down) return;
    // 手指会盖住瞄准点，所以画一组更大的四角括线，让玩家看得见自己在瞄哪
    const x = Math.round(mouse.x), y = Math.round(mouse.y);
    const R = 9;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bx = x + sx * R - (sx > 0 ? 0 : 5), by = y + sy * R - (sy > 0 ? 0 : 5);
      ctx.fillStyle = '#0a0c18'; ctx.fillRect(bx, by, 5, 5);
      ctx.fillStyle = col;       ctx.fillRect(bx + 1, by + 1, 3, 3);
    }
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 1, y - 1, 2, 2);
    return;
  }

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

function render() {
  ctx.save();
  if (G.shake > 0.1) {
    ctx.translate(Math.round(rand(-G.shake, G.shake)), Math.round(rand(-G.shake, G.shake)));
  }
  drawBackground();
  drawWebs();
  drawWakes();
  drawMines();
  drawPickups();
  drawPBullets();
  drawEnemies();
  drawDrones();
  drawPlayer();
  drawLances();     // 光矛压在船身之上：它是「刚打出去」的一击，必须盖住一切
  drawEBullets();
  drawParts();
  drawFx();
  ctx.restore();
  drawHUD();
  drawBanners();
  drawToasts();
  if (state === 'play' && !G.dead) drawCrosshair();
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
}
function toTitle() {
  state = 'title'; G = null;
  Sound.setMode('title'); Sound.music(true);
  showOverlay('title');
  checkUnlocks(true);
  renderVolume();
  const locked = HULLS.filter(h => !hullUnlocked(h));
  const bits = [];
  if (SAVE.best) bits.push('最佳分数 ' + SAVE.best);
  // 无尽打通之后 maxWave 会超过 WAVES，再写 "N/12" 就自相矛盾了
  if (SAVE.maxWave) bits.push('最远 ' + SAVE.maxWave + ' 段'
    + (SAVE.maxWave > WAVES ? '（深渊 ' + eTier(SAVE.maxWave) + ' 档）' : ''));
  if (SAVE.kills) bits.push('累计击坠 ' + SAVE.kills);
  if (locked.length) bits.push('还有 ' + locked.length + ' 台待解锁');
  $('best').textContent = bits.join(' · ');
  // 「继续航程」只在真的有续档快照时出现。有存档时把「开始航行」降级成普通按钮，
  // 免得屏幕上并排两个高亮主按钮，让人不敢点。
  const cb = $('btn-continue'), sb = $('btn-start'), xb = $('btn-clrrun');
  if (SAVE.run) {
    const hh = HULLS.find(h => h.id === SAVE.run.hull);
    cb.textContent = '继续航程 · 第 ' + SAVE.run.wave + ' 段（' + (hh ? hh.name : '未知') + '）';
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
  { id: 'enemy', name: '敌型' },
  { id: 'boss',  name: '巨像' },
  { id: 'hull',  name: '船体' },
  { id: 'mod',   name: '模块' },
];
let codexTab = 'enemy';
let codexFrom = 'title';     // 从哪打开的，返回就回哪（和 helpFrom 一个套路）

function codexEntries(kind) {
  if (kind === 'boss') return Object.keys(BOSSES).map(k => {
    const b = BOSSES[k];
    return { id: k, name: b.name, trait: b.trait || '', seen: !!SAVE.seen[k], spr: b.spr };
  });
  if (kind === 'hull') return HULLS.map(h => ({
    id: h.id, name: h.name, trait: h.trait || '', seen: !!SAVE.seen[h.id], hull: h.id,
  }));
  if (kind === 'mod') return MODULES.map(m => ({
    id: m.id, name: m.name, trait: m.desc || '', seen: !!SAVE.seen[m.id], glyph: m.glyph, type: m.type,
  }));
  return Object.keys(ETYPES).map(k => {
    const c = ETYPES[k];
    return { id: k, name: c.name, trait: c.trait || '', seen: !!SAVE.seen[k], spr: c.spr };
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
// 图鉴小图：敌型 / 巨像走 SPR[spr].r[0]，船体走 SHIPSET[id].imgs[0]。
// ⚠️ 放大要取整（保住像素锐利），缩小才按比例 —— 巨像精灵是 2x 烘焙的，比 40px 画布大。
function drawCodexArt(x, e) {
  const cv = x.canvas;
  let img = null;
  if (e.hull) { const s = SHIPSET[e.hull]; if (s && s.imgs) img = s.imgs[0]; }
  else if (e.spr) { const st = SPR[e.spr]; if (st && st.r && st.r.length) img = st.r[0]; }
  if (!img || !img.width) return;
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
  $('codex-count').textContent = '已收录 ' + got + ' / ' + list.length;
  $('codex-tabs').innerHTML = CODEX_TABS.map(t =>
    '<button class="btn small' + (t.id === codexTab ? ' primary' : '') +
    '" data-act="cdx-' + t.id + '">' + t.name + '</button>').join('');
  const box = $('codex-grid');
  box.innerHTML = '';
  for (const e of list) {
    const el = document.createElement('div');
    el.className = 'cde' + (e.seen ? ' seen' : '');
    el.innerHTML = (e.glyph
        ? '<div class="cdg">' + (e.seen ? e.glyph : '?') + '</div>'
        : '<canvas width="40" height="40"></canvas>')
      + '<div class="cdn">' + (e.seen ? e.name : '？？？') + '</div>'
      + '<div class="cdt">' + (e.seen ? e.trait : '尚未遭遇') + '</div>';
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
// 竖屏提示的逃生口：万一 coarse/portrait 判定卡住，玩家还能点掉它继续玩。
// 没有这个，一张全屏遮罩就能让游戏永久不可玩。
let rotateDismissed = false;
function dismissRotateHint() {
  rotateDismissed = true;
  document.documentElement.classList.add('norotate');
}
function updateRotateHint() {
  document.documentElement.classList.toggle('norotate', rotateDismissed);
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
    el.innerHTML = `<div class="tag">${locked ? '未解锁' : h.tag}</div>
      <canvas width="64" height="64"></canvas>
      <div class="hname">${h.name}</div>
      <div class="hen">${h.en}</div>
      <div class="hdesc">${locked ? '解锁条件<br>' + h.unlock.text
                                  : h.desc.replace(/\n/g, '<br>')}</div>`;
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
    ? `<div class="hstat">状态 <u>未解锁</u></div>
       <div class="hstat">条件 <u>${h.unlock.text}</u></div>
       <div class="hstat">进度 <u>${unlockProgress(h)}</u></div>`
    : `<div class="hstat">船体 <u>${h.hp}</u></div>
       <div class="hstat">速度 <u>${Math.round(h.spd * 100)}%</u></div>
       <div class="hstat">火力 <u>${Math.round(h.dmg * 100)}%</u></div>
       <div class="hstat">射速 <u>${Math.round(h.rate * 100)}%</u></div>`;
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
  markSeen(h.id);        // 图鉴：船体名录
  state = 'play';
  // 手机上开局顺手进全屏：横屏游戏被地址栏吃掉 60~80px 高度差别很大。
  // 只在「粗指针 + 已横屏」时尝试，桌面端完全不碰。
  if (isTouchDevice() && matchMedia('(orientation: landscape)').matches
      && !document.fullscreenElement && !document.webkitFullscreenElement) {
    toggleFullscreen();
  }
  Sound.init(); Sound.music(true); Sound.setMode('cruise');
  showOverlay(null);
  startWave(1);
}
function togglePause() {
  if (state === 'play') {
    state = 'pause';
    const S = G.S;
    $('pause-stats').textContent = `第 ${G.wave} 段 · 击坠 ${G.kills} · 分数 ${G.score} · ${fmtTime(G.t)}`;
    const modChips = Object.keys(G.mods).map(id => {
      const m = MODULES.find(v => v.id === id);
      const maxed = G.mods[id] >= m.max;
      return `<span class="chip t-${m.type}${maxed ? ' maxed' : ''}">${m.name} ${G.mods[id]}</span>`;
    }).join('');
    const synChips = Object.keys(G.syn).map(id => {
      const sy = SYNERGIES.find(s => s.id === id);
      return sy ? `<span class="chip t-syn">协同·${sy.name}</span>` : '';
    }).join('');
    $('build').innerHTML = modChips
      ? modChips + synChips
      : '<span class="dim">尚未装配模块</span>';
    renderVolume();
    showOverlay('pause');
  } else if (state === 'pause') {
    state = 'play'; showOverlay(null);
  }
}

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
  const fresh = checkUnlocks();
  $('over-title').textContent = G.won ? '航程 · 抵达奇点' : '航程 · 中断';
  $('over-title').className = 'over-title' + (G.won ? ' win' : '');
  $('over-sub').textContent = G.won
    ? (G.wave > WAVES
      ? '已通关，并在无尽航程中推进到第 ' + G.wave + ' 段（深渊 ' + eTier(G.wave) + ' 档）。'
      : '你穿过了全部十二段航程。')
    : '船体解体于第 ' + G.wave + ' 段。';
  $('over-stats').innerHTML = `
    <div><span>分数</span><b>${G.score}</b></div>
    <div><span>击坠</span><b>${G.kills}</b></div>
    <div><span>航段</span><b>${G.wave > WAVES ? G.wave + ' 段' : G.wave + '/' + WAVES}</b></div>
    <div><span>等级</span><b>${G.level}</b></div>
    <div><span>星尘</span><b>${G.dust}</b></div>
    <div><span>用时</span><b>${fmtTime(G.t)}</b></div>`;
  const unlocked = fresh.map(h => '解锁船体 ' + h.name).join(' · ');
  $('over-rank').innerHTML = (isBest ? '<b>新的最佳成绩</b>' : '最佳 ' + SAVE.best)
    + (unlocked ? ' · <b>' + unlocked + '</b>' : '');
  renderLog();
  showOverlay('over');
}

// 最近几局的航行日志（结算页表格）
function renderLog() {
  const box = $('over-log');
  if (!box) return;
  const rows = SAVE.log.slice().reverse();
  if (!rows.length) { box.innerHTML = '<div class="dim">还没有航行记录</div>'; return; }
  box.innerHTML = '<div class="logrow head"><span>船体</span><span>航段</span><span>击坠</span><span>分数</span></div>'
    + rows.map((r, i) => {
      const hull = HULLS.find(h => h.id === r.hull);
      const nm = (hull ? hull.name : (r.hullName || '—'));
      const cls = i === 0 ? 'logrow now' : 'logrow';
      return `<div class="${cls}"><span>${nm}${r.won ? ' ·通' : ''}</span>`
        + `<span>${r.wave > WAVES ? r.wave + ' 段' : r.wave + '/' + WAVES}</span>`
        + `<span>${r.kills}</span><span>${r.score}</span></div>`;
    }).join('');
}

// 音量滑杆：页面上所有 .volbox 都会渲染一份
function renderVolume() {
  for (const el of document.querySelectorAll('.volbox')) {
    el.innerHTML = '<label class="vol"><span>音乐</span>'
      + `<input type="range" min="0" max="10" step="1" value="${Math.round(SAVE.bgm * 10)}" data-vol="bgm">`
      + '</label><label class="vol"><span>音效</span>'
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
  $('btn-reroll').disabled = false;
  $('btn-reroll').textContent = '重抽 [R] (' + rerollLeft + ')';
}
function rollChoices() {
  const pool = MODULES.filter(m => (G.mods[m.id] || 0) < m.max);
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
  toast('模块已全部满级', '本段奖励折算为分数 · 船体已修复', '#ffcd75', 2.2);
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
      <div class="tag">满级</div>
      <div class="glyph">满</div>
      <div class="name">全部满级</div>
      <div class="desc">所有模块都已升到顶<br>本段奖励折算为分数</div>
      <div class="syn">&nbsp;</div>
      <div class="key">[ENTER] 继续</div>
    </div>`;
    $('up-sub').textContent = 'LV ' + G.level + ' · 模块已全部满级';
    $('btn-reroll').disabled = true;
    $('btn-reroll').textContent = '无需重抽';
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
      ? `<div class="syn">协同 ${syn.map(s => s.name).join(' · ')}</div>`
      : (lv > 0 ? '' : '<div class="syn dim2">&nbsp;</div>');
    return `<div class="card t-${m.type}${isMax ? ' max' : ''}" data-i="${i}">
      <div class="tag">${TYPE_NAME[m.type]}</div>
      ${lv === 0 ? '<div class="new">NEW</div>' : ''}
      ${isMax ? '<div class="mx">MAX</div>' : ''}
      <div class="glyph">${m.glyph}</div>
      <div class="name">${m.name}</div>
      <div class="pips">${pips}</div>
      <div class="desc">${m.desc.replace(/\n/g, '<br>')}</div>
      ${synHtml}
      <div class="key">[${i + 1}]</div>
    </div>`;
  }).join('');
  const synCount = Object.keys(G.syn).length;
  $('up-sub').textContent = 'LV ' + G.level + ' · 已装配 ' + Object.keys(G.mods).length + ' 种模块'
    + (synCount ? ' · 协同 ' + synCount : '');
}
function choose(i, viaPointer) {
  if (state !== 'upgrade') return;
  if (viaPointer && performance.now() - G.upOpen < UP_ARM) return;
  const m = choices[i]; if (!m) return;
  const lv = G.mods[m.id] = (G.mods[m.id] || 0) + 1;
  markSeen(m.id);        // 图鉴：模块名录
  // ⚠️ 第二个参数是本卡当前等级。绝大多数卡用不到，但「冲角装甲」的首级惩罚
  //    （射速 -30%）必须只在 n === 1 时结算一次 —— 少了它续档重放会把惩罚叠三次。
  m.apply(G.S, lv);
  if (lv >= m.max && m.bloom) {
    // 质变：满级那一刻额外执行一次，给音效 + 横幅（不是静默加数值）
    m.bloom(G.S);
    Sound.sfx.bloom();
    banner('质变 · ' + m.name, '已升至满级', '#ffcd75', 2.4);
    freeze(0.12); addShake(3);
  } else {
    Sound.sfx.select();
    toast(m.name, '装配等级 ' + lv, '#ffcd75');
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
  $('btn-reroll').disabled = rerollLeft <= 0;
  $('btn-reroll').textContent = rerollLeft > 0 ? '重抽 [R] (' + rerollLeft + ')' : '重抽已用完';
}

// ============ 输入 ============
function onKey(code, down) {
  if (down) keys[code] = true; else delete keys[code];
  if (!down) return;
  Sound.init();
  if (code === 'KeyM') { const m = Sound.toggleMute(); toast(m ? '静音' : '声音开', '', '#73eff7', 1); return; }
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

function toGame(cx, cy) { return [(cx - offX) / scale, (cy - offY) / scale]; }

function setTouchMode(on) { touchMode = on; wrap.classList.toggle('touch', on); }

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
  else if (a === 'mute') { const m = Sound.toggleMute(); $('btn-mute').textContent = m ? '声音 关' : '声音 开'; }
  else if (a === 'reroll') reroll(true);
  else if (a === 'skipup') closeUpgrade();
  else if (a === 'pause') togglePause();
  else if (a === 'dash') tryDash();
  else if (a === 'od') activateOverdrive();
  else if (a === 'full') toggleFullscreen();
  else if (a === 'rotatedismiss') dismissRotateHint();
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
  const s = Math.min(vw / W, vh / H);
  scale = s;
  offX = sa.l + (vw - W * s) / 2;
  offY = sa.t + (vh - H * s) / 2;
  wrap.style.transform = `translate(${offX}px, ${offY}px) scale(${s})`;
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

// 竖屏提示的开关。CSS 里那条 @media 已经够用，但它是「不可测」的 ——
// 无头桌面 Chrome 的 pointer 永远是 fine，媒体查询永远为假，没法验证。
// 所以在 <html> 上再挂一份 JS 判定的 class，探针可以直接改这两个 class 看效果。
// 两条路都要求「粗指针 + 竖屏」，桌面端不可能误触发。
function updateLayoutMode() {
  const root = document.documentElement;
  root.classList.toggle('coarse', isTouchDevice());
  root.classList.toggle('portrait', matchMedia('(orientation: portrait)').matches);
  updateRotateHint();
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
    mouse.x = G.px + Math.cos(ta) * 60; mouse.y = G.py + Math.sin(ta) * 60;
    mouse.inside = true;
    if (td > 140) thrust = 1;          // 远：贴上去
    else if (td < 70) brake = 1;       // 太近：刹住，让它自己撞进火线（顺便少吃撞击）
    // 70..140 之间滑行 —— 保持全 DPS，这才是「单摇杆」的正确打法
    // 贴边时给一点向内的偏置，别把自己顶在墙角
    if (G.px < 34 || G.px > W - 34 || G.py < 34 || G.py > H - 34) {
      const ca = Math.atan2(H / 2 - G.py, W / 2 - G.px);
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
    const [x, y] = toGame(e.clientX, e.clientY); mouse.x = x; mouse.y = y; mouse.inside = true;
    if (state === 'play') aimMode = 'mouse';
  };
  window.addEventListener('mousemove', upd);
  window.addEventListener('mousedown', e => {
    Sound.init();
    if (e.button === 2) { if (state === 'play') tryDash(); return; }
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
      if (gx < W / 2) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.active = true;
      } else {
        mouse.down = true;
        const [x, y] = toGame(t.clientX, t.clientY); mouse.x = x; mouse.y = y; mouse.inside = true;
      }
    }
  }, { passive: true });
  // ⚠️ 这里**不能** preventDefault。手指按下去只要挪一点就会触发 touchmove，
  //    一旦 preventDefault，浏览器就取消随后合成的 click —— 「点出击没反应」的根因。
  //    滚动/缩放本来就被 html,body,#wrap 上的 touch-action:none 和 overscroll-behavior 挡住了。
  wrapEl.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        const dx = (t.clientX - joy.ox) / scale, dy = (t.clientY - joy.oy) / scale;
        const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 40);
        joy.x = dx / m * k; joy.y = dy / m * k;
      } else {
        const [x, y] = toGame(t.clientX, t.clientY); mouse.x = x; mouse.y = y;
      }
    }
  }, { passive: true });
  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { joy.id = null; joy.active = false; joy.x = joy.y = 0; }
      else mouse.down = false;
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
    setPos: (x, y) => { G.px = x; G.py = y; G.vx = 0; G.vy = 0; },
    // 探针专用：直接开一枪 / 按住某个键 / 塞一发敌弹。
    // 这三种都是「不给探针开口就只能靠合成事件碰运气」的路径，直接暴露函数最稳。
    fire: (ang) => fireMain(ang === undefined ? G.aim : ang, 1),
    // 直接吃一次伤害：相位折跃的判定在 hurtPlayer 里，走这条路径才算真的测到
    hurt: (dmg) => hurtPlayer(dmg === undefined ? 30 : dmg),
    hold: (k, v) => { keys[k] = !!v; },
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
    peekBoss: w => BOSS_WAVES[w] || (w >= ENDLESS_FROM && (w - WAVES) % ENDLESS_BOSS_EVERY === 0 ? '(袋)' : null),
    bossBagLeft: () => BOSS_BAG.length,
    // 真·抽一次巨像（会消耗轮换袋）—— 用来验证「一轮内三只不重复」
    drawBoss: () => bagPickBoss(),
    // 探针专用：把轮换袋倒空重来。gotoWave 到巨像段也会消耗袋子，
    // 所以「三只不重复」这类用例必须先归零，否则测的是上一段留下的残局。
    resetBossBag: () => { BOSS_BAG.length = 0; },
    get squadName() { return G.squadName; },
    // ---- 探针专用：进场方向 / 边界夹取 ----
    // spawnPos 的四个方向曾是**死代码**（irand(4) 恒为 NaN，四个分支全落空，只从右边进场）。
    // 这种「分支永远走不到」的 bug 没有任何报错，只能靠大量采样数分布来抓。
    get wh() { return [W, H]; },
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
    get bulletCount() { return G.bullets.length; },
    get ebulletCount() { return G.ebullets.length; },
    moduleIds: () => MODULES.map(m => m.id),
    moduleInfo: () => MODULES.map(m => ({ id: m.id, name: m.name, type: m.type, max: m.max })),
    save: () => SAVE,
    writeSave,
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
    // 探针专用：强制竖屏提示的开关，验证它不会在桌面端误触发
    setLayout: (coarse, portrait) => {
      const r = document.documentElement;
      r.classList.toggle('coarse', !!coarse);
      r.classList.toggle('portrait', !!portrait);
      rotateDismissed = false; updateRotateHint();
    },
    get rotateDismissed() { return rotateDismissed; },
  };

  toTitle();
  // 触屏设备一进来就把 .touch 挂上：右下角的按钮不该等到玩家先碰一下屏幕才出现
  if (isTouchDevice()) setTouchMode(true);
  // ?bot=1 直接开局：平衡性跑测不该还要人肉点进机库
  if (BOT) { hangarSel = 0; startGame(); }
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
