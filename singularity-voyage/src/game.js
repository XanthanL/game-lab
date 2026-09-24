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
    hp: 100, spd: 1.00, dmg: 1.00, rate: 1.00, turn: 1.00,
    stats: '船体 100\n速度 100%\n火力 100%',
  },
  {
    id: 'rapier', name: '轻剑', en: 'RAPIER', tag: '玻璃炮', color: '#ef7d57',
    desc: '推重比拉满，装甲削到最低。\n快，但挨不了几下。',
    hp: 78, spd: 1.20, dmg: 1.14, rate: 1.16, turn: 1.15,
    stats: '船体 78\n速度 120%\n火力 114%',
  },
  {
    id: 'bulwark', name: '堡垒', en: 'BULWARK', tag: '重装', color: '#a7f070',
    desc: '厚壳、慢、稳。\n用血量换容错。',
    hp: 150, spd: 0.86, dmg: 0.90, rate: 0.86, turn: 0.82,
    stats: '船体 150\n速度 86%\n火力 90%',
  },
  {
    id: 'raven', name: '玄鸦', en: 'RAVEN', tag: '刺客', color: '#c070f0',
    desc: '装甲薄到能看穿。\n换来的是一击必杀的暴击率。',
    hp: 62, spd: 1.28, dmg: 1.10, rate: 1.20, turn: 1.30,
    stats: '船体 62\n速度 128%\n火力 110%',
    crit: 0.10, critMul: 3.0,
    unlock: { kills: 300, text: '累计击坠 300' },
  },
  {
    id: 'swarm', name: '蜂群', en: 'SWARM', tag: '编队', color: '#a7f070',
    desc: '出击就带两架僚机。\n自己不开火也能打。',
    hp: 92, spd: 1.06, dmg: 0.86, rate: 0.94, turn: 1.05,
    stats: '船体 92\n速度 106%\n火力 86%',
    drones: 2, magnetMul: 1.3,
    unlock: { wave: 10, text: '航程抵达第 10 段' },
  },
];

// ============ 敌型（12） ============
const ETYPES = {
  seeker:   { name: '追猎者', spr: 'seeker',   hp: 14, spd: 54, r: 5, dmg: 8,  xp: 1, ai: 'chase' },
  tadpole:  { name: '蝌蚪',   spr: 'tadpole',  hp: 18, spd: 46, r: 6, dmg: 8,  xp: 1, ai: 'wander' },
  dart:     { name: '飞镖',   spr: 'dart',     hp: 16, spd: 62, r: 5, dmg: 12, xp: 1, ai: 'dash' },
  gunner:   { name: '炮手',   spr: 'gunner',   hp: 24, spd: 30, r: 6, dmg: 10, xp: 2, ai: 'shoot', range: 160, cd: 1.5 },
  splitter: { name: '分裂体', spr: 'splitter', hp: 28, spd: 38, r: 7, dmg: 10, xp: 2, ai: 'chase', split: 3 },
  reaver:   { name: '掠夺者', spr: 'reaver',   hp: 10, spd: 80, r: 4, dmg: 7,  xp: 1, ai: 'swarm' },
  bastion:  { name: '重甲炮台', spr: 'bastion', hp: 78, spd: 22, r: 9, dmg: 14, xp: 4, ai: 'turret', range: 180, cd: 2.2 },
  shifter:  { name: '相位闪现者', spr: 'shifter', hp: 22, spd: 42, r: 6, dmg: 12, xp: 2, ai: 'blink' },
  stalker:  { name: '潜行者', spr: 'stalker',  hp: 32, spd: 48, r: 7, dmg: 16, xp: 3, ai: 'stalk' },
  mine:     { name: '浮游雷', spr: 'mine',     hp: 12, spd: 0,  r: 6, dmg: 18, xp: 1, ai: 'mine' },
  orbiter:  { name: '环轨炮', spr: 'orbiter',  hp: 28, spd: 54, r: 6, dmg: 10, xp: 3, ai: 'orbit', range: 150, cd: 1.8 },
  leech:    { name: '吸附虫', spr: 'leech',    hp: 24, spd: 64, r: 5, dmg: 6,  xp: 2, ai: 'leech' },
  // ---- 第二批：每个都改变你的决策，而不是只改血量 ----
  // 织网者：在场上撒减速网，压缩你的活动空间
  weaver:   { name: '织网者', spr: 'weaver',   hp: 34, spd: 44, r: 6, dmg: 9,  xp: 3, ai: 'weave', range: 118, cd: 3.2 },
  // 牧者：给周围敌人持续回血 + 加速，必须优先点掉
  shepherd: { name: '牧者',   spr: 'shepherd', hp: 46, spd: 40, r: 6, dmg: 8,  xp: 4, ai: 'shepherd', range: 148, aura: 84, cd: 2.0 },
  // 新星：死亡时炸出一圈弹幕，别在弹幕缝里杀它
  nova:     { name: '新星',   spr: 'nova',     hp: 26, spd: 50, r: 6, dmg: 12, xp: 3, ai: 'chase', deathRing: 12 },
  // 铁壁：正面装甲吸收 70% 伤害，机头转得慢 —— 所以侧后方真的绕得过去
  bulwark:  { name: '铁壁',   spr: 'bulwark',  hp: 78, spd: 28, r: 8, dmg: 16, xp: 5, ai: 'guard', guard: 0.30, turn: 1.5, range: 190, cd: 3.2 },
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
const WAVES = 12;
const BOSS_WAVES = { 4: 'motherrock', 8: 'warden', 12: 'gate' };
const BOSSES = {
  motherrock: { name: '母岩', en: 'MOTHER ROCK', spr: 'motherrock', hp: 900, r: 21, pats: ['charge', 'spread'], color: '#c070f0' },
  warden:     { name: '环带狱卒', en: 'ORBITAL WARDEN', spr: 'warden', hp: 2000, r: 22, pats: ['ring', 'spiral', 'fan'], color: '#ff5577' },
  gate:       { name: '奇点之门', en: 'THE GATE', spr: 'gate', hp: 3600, r: 23, pats: ['spiral', 'fan', 'ring', 'laser'], color: '#73eff7' },
};

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
  // 老版本只写了 sv_best，顺手迁过来
  try {
    const legacy = +(localStorage.getItem('sv_best') || 0);
    if (legacy > s.best) s.best = legacy;
  } catch (e) {}
  return s;
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
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

// ============ 开局 ============
function newGame(hullId) {
  const hull = HULLS.find(h => h.id === hullId) || HULLS[0];
  const S = {
    hull: hull.id, hullName: hull.name, hullColor: hull.color,
    maxHp: hull.hp, hp: hull.hp,
    spd: hull.spd, dmg: hull.dmg, rate: hull.rate, turn: hull.turn,
    crit: 0.05, critMul: 2.4, pierce: 0, blast: 0, blastMul: 1,
    barrels: 1, drones: 0,
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
  G.bullets.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, dmg,
    r: o.r || 3, life: o.life || 1.1,
    // 齐射穿甲：每根枪管额外 +1 穿透，所以要在发射时算（枪管数会变）
    pierce: o.pierce ?? (G.S.pierce + (synOn('volley') ? G.S.barrels : 0)),
    blast: o.blast ?? G.S.blast, homing: o.homing || 0, hit: null, col: o.col || '#73eff7',
  });
}
function eShot(x, y, ang, spd, r, color, o = {}) {
  if (G.ebullets.length > 900) return;
  G.ebullets.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, color, life: o.life || 6, t: 0 });
}
const HOSTILE = { red: '#ff3355', pink: '#ff66cc', purple: '#c070f0', amber: '#ffcd75' };

function fireMain(ang, dmgMul = 1) {
  const S = G.S, n = S.barrels;
  const base = 10 * S.dmg * dmgMul;
  const muzzle = 11;
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
    const a = ang + spread;
    pBullet(G.px + Math.cos(a) * muzzle, G.py + Math.sin(a) * muzzle, a, 320, base);
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
}

function hurtPlayer(dmg) {
  if (G.inv > 0 || G.dead || GOD) return;
  const S = G.S;
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
function spawnPos() {
  const s = irand(4), m = EDGE;
  if (s === 0) return [rand(W), -m];
  if (s === 1) return [rand(W), H + m];
  if (s === 2) return [-m, rand(H)];
  return [W + m, rand(H)];
}
function hpScale() {
  // 随航程线性变硬：第 1 段 1.0，第 12 段约 2.2
  return 1 + (G.wave - 1) * 0.11;
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
    t: rand(TAU), flash: 0, cd: rand(0.4, c.cd || 1.5), touchCd: 0,
    split: opt.split !== undefined ? opt.split : c.split,
    alpha: 1, st: 0, ang: 0, elite: !!opt.elite,
  };
  if (e.elite) { e.hp *= 1.8; e.maxHp *= 1.8; e.r += 1; }
  G.enemies.push(e);
  return e;
}
function spawnBoss(id) {
  const b = BOSSES[id]; if (!b) return;
  const hp = b.hp * (1 + (G.wave - 4) * 0.05);
  const e = {
    type: 'boss', boss: id, name: b.name, en: b.en, spr: b.spr, color: b.color,
    x: W / 2, y: -40, vx: 0, vy: 0, hp, maxHp: hp, r: b.r,
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
  const spd = 92 + G.wave * 3;
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
    const spd = c.spd * (e.elite ? 1.15 : 1) * (1 - (e.slow || 0)) * (e.buffT > 0 ? 1.22 : 1);
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
          hurtPlayer(c.dmg);
          floatText(G.px, G.py - 16, '-' + c.dmg, '#ff5577', .7);
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
      hurtPlayer(c.dmg);
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
function updatePlayer(dt) {
  const S = G.S;
  // 推进输入
  let ix = 0, iy = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
  if (joy.active) { ix = joy.x; iy = joy.y; }
  const im = Math.hypot(ix, iy);
  if (im > 1) { ix /= im; iy /= im; }
  G.thrust = im > 0.05;
  // 蛛网减速：不扣血，只是让你在网里变笨重
  const slow = webSlowAt(G.px, G.py);
  G.webSlow = slow;
  const slowMul = 1 - slow;
  const ACC = 620 * S.spd * slowMul, MAXV = 168 * S.spd * slowMul;
  G.vx += ix * ACC * dt; G.vy += iy * ACC * dt;
  // 惯性阻尼（松手后继续漂移）
  G.vx *= 0.955; G.vy *= 0.955;
  const vm = Math.hypot(G.vx, G.vy);
  if (vm > MAXV) { G.vx = G.vx / vm * MAXV; G.vy = G.vy / vm * MAXV; }
  G.px = clamp(G.px + G.vx * dt, 10, W - 10);
  G.py = clamp(G.py + G.vy * dt, 10, H - 10);
  if (G.px <= 10 || G.px >= W - 10) G.vx *= 0.4;
  if (G.py <= 10 || G.py >= H - 10) G.vy *= 0.4;
  // 网里掉紫屑，给个「黏住了」的体感
  if (slow > 0 && Math.random() < 0.25) {
    part({ x: G.px + rand(-8, 8), y: G.py + rand(-8, 8), vx: rand(-12, 12), vy: rand(-12, 12), life: .4, max: .4, col: '#c070f0', size: 1, drag: 2 });
  }

  // 瞄准：机头平滑跟随光标
  const aim = Math.atan2(mouse.y - G.py, mouse.x - G.px);
  let da = ((aim - G.aim + Math.PI) % TAU + TAU) % TAU - Math.PI;
  G.aim += da * Math.min(1, dt * 14 * S.turn);
  G.ang = G.aim;

  // 开火
  G.fireT -= dt;
  const wantFire = (mouse.down || keys['Space'] || G.autoFire) && !G.dead;
  if (wantFire && G.fireT <= 0) {
    const iv = 0.17 / S.rate / (G.odT > 0 ? 2 : 1);
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
  // 护盾脱战回复（相位护壁协同 / 护盾质变会翻倍）
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
}

// ============ 子弹 ============
function updateBullets(dt) {
  buildGrid();
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    if (b.homing) {
      const t = nearest(b.x, b.y, 150, null);
      if (t) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        let da = ((want - b.ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
        b.ang += clamp(da, -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(b.ang) * sp; b.vy = Math.sin(b.ang) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { G.bullets.splice(i, 1); continue; }
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
      const R = (26 + b.blast * 12) * S.blastMul * (synOn('cluster') ? 1.3 : 1);
      explode(b.x, b.y, R, b.dmg * (0.5 + b.blast * 0.22), R < 40);
    }
    burst(b.x, b.y, crit ? 7 : 3, crit ? ['#ffcd75', '#f4f4f4'] : ['#73eff7', '#f4f4f4'], 70, .25, 1);
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
      hurtPlayer(9);
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
  const z = ZONES.findIndex(zz => w >= zz.from && w <= zz.to);
  G.zone = z < 0 ? 2 : z;
  const zone = ZONES[G.zone];
  G.waveKills = 0;
  G.spawnQueue = [];
  G.spawnT = 0.6;
  G.waveT = 0;
  Sound.sfx.warp();
  if (BOSS_WAVES[w]) {
    G.waveState = 'boss';
    // ⚠️ 不要用 setTimeout 排 boss 入场：那是**真实时间**，而 waveT 是**游戏时间**。
    // fast>1 时 waveT 先跑到 2 秒 → updateWave 判「场上没 boss 也没敌人」→ 直接 finishWave，
    // 巨像整段被跳过（实测 fast=4 时第 4/8 段只用 3.7s 就过了）。
    G.bossPending = BOSS_WAVES[w];
    G.bossT = 1.2;
    banner('第 ' + w + ' 段 · ' + zone.name, '巨像接近中', '#ff5577', 2.4);
    G.waveNeed = 1;
  } else {
    G.waveState = 'spawn';
    G.bossPending = null;
    const sq = SQUADS[zone.squads[(w - 1) % 4]] || SQUADS.mixed;
    G.squadName = sq.name;
    const base = 7 + w * 2.2;
    const n = Math.round(base * sq.cnt);
    G.waveNeed = n;
    for (let i = 0; i < n; i++) {
      let t = pick(sq.mix);
      // 星区越深，混入更硬的敌型
      if (G.zone === 2 && Math.random() < 0.26) t = pick(['bastion', 'stalker', 'bulwark', 'shepherd', 'weaver']);
      else if (G.zone === 1 && Math.random() < 0.2) t = pick(['shifter', 'mine', 'leech', 'weaver', 'nova']);
      G.spawnQueue.push(t);
    }
    banner('第 ' + w + ' 段 · ' + zone.name, '编队主题：' + sq.name, '#73eff7', 2.2);
  }
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
  if (G.wave >= WAVES) {
    G.won = true; G.dead = true;
    Sound.setMode('title');
    setTimeout(gameOver, 700);
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
  updateEBullets(dt);
  updatePickups(dt);
  updateParts(dt);
  updateFx(dt);
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
  // 友方：青白细针，画在敌人之下
  for (const b of G.bullets) {
    drawBulletSet(ctx, b.ang, b.x, b.y);
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

  // 右上：分数 / 航段 / 时间
  text('分数', W - 8, 6, '#7a86a8', 'r');
  text('' + G.score, W - 8, 16, '#f4f4f4', 'r');
  const z = ZONES[G.zone];
  text('第 ' + G.wave + '/' + WAVES + ' 段', W - 8, 28, '#73eff7', 'r');
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
  drawPickups();
  drawPBullets();
  drawEnemies();
  drawDrones();
  drawPlayer();
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
  if (SAVE.maxWave) bits.push('最远 ' + SAVE.maxWave + '/' + WAVES + ' 段');
  if (SAVE.kills) bits.push('累计击坠 ' + SAVE.kills);
  if (locked.length) bits.push('还有 ' + locked.length + ' 台待解锁');
  $('best').textContent = bits.join(' · ');
}
function openHangar() {
  state = 'hangar';
  showOverlay('hangar');
  renderHangar();
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

function startGame() {
  const h = HULLS[hangarSel];
  if (!hullUnlocked(h)) { Sound.sfx.lock(); denyDetail(); return; }
  G = newGame(h.id);
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
  const fresh = checkUnlocks();
  $('over-title').textContent = G.won ? '航程 · 抵达奇点' : '航程 · 中断';
  $('over-title').className = 'over-title' + (G.won ? ' win' : '');
  $('over-sub').textContent = G.won ? '你穿过了全部十二段航程。' : '船体解体于第 ' + G.wave + ' 段。';
  $('over-stats').innerHTML = `
    <div><span>分数</span><b>${G.score}</b></div>
    <div><span>击坠</span><b>${G.kills}</b></div>
    <div><span>航段</span><b>${G.wave}/${WAVES}</b></div>
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
        + `<span>${r.wave}/${WAVES}</span><span>${r.kills}</span><span>${r.score}</span></div>`;
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
// 这张卡选下去会触发哪些协同（用于卡面预告）
function synergyPreview(m) {
  const will = { ...G.mods };
  will[m.id] = (will[m.id] || 0) + 1;
  return SYNERGIES.filter(sy => !G.syn[sy.id] && will[sy.a] > 0 && will[sy.b] > 0);
}
function renderCards() {
  const box = $('cards');
  box.classList.remove('locked');
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
  m.apply(G.S);
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
    return;
  }
  if (state === 'pause') {
    if (code === 'Escape' || code === 'KeyP') togglePause();
    return;
  }
  if (state === 'over') {
    if (code === 'Enter' || code === 'Space') { G = null; startGame(); }
    if (code === 'Escape') openHangar();
    return;
  }
  if (state === 'help' && (code === 'Escape' || code === 'Enter')) toTitle();
}

function toGame(cx, cy) { return [(cx - offX) / scale, (cy - offY) / scale]; }

function setTouchMode(on) { touchMode = on; wrap.classList.toggle('touch', on); }

function handleAct(a) {
  Sound.init();
  if (a === 'hangar') openHangar();
  else if (a === 'launch') startGame();
  else if (a === 'title') toTitle();
  else if (a === 'help') { state = 'help'; showOverlay('help'); }
  else if (a === 'start') openHangar();
  else if (a === 'resume') togglePause();
  else if (a === 'restart') { G = null; startGame(); }
  else if (a === 'mute') { const m = Sound.toggleMute(); $('btn-mute').textContent = m ? '声音 关' : '声音 开'; }
  else if (a === 'reroll') reroll(true);
  else if (a === 'pause') togglePause();
  else if (a === 'dash') tryDash();
  else if (a === 'od') activateOverdrive();
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
}

// ============ bot（?bot=1 自动游玩，用于平衡性验证） ============
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
  // 瞄准：永远先瞄敌人（保证 DPS），没敌人才把炮口转向星尘
  const aimAt = t || nearDust();
  if (aimAt) {
    const a = Math.atan2(aimAt.y - G.py, aimAt.x - G.px);
    mouse.x = G.px + Math.cos(a) * 60; mouse.y = G.py + Math.sin(a) * 60;
  }
  // 走位：有近敌就中距缠斗，否则去捡星尘。
  // ⚠️ 走位和瞄准必须分开 —— 早先写成「td>150 就整体转向星尘」，
  // 结果炮口对着星尘发呆，第 9 段从 50s 拖到 106s。
  let wx = 0, wy = 0;
  if (t && td <= 150) {
    botA += dt * 0.7;
    const a = Math.atan2(t.y - G.py, t.x - G.px);
    const want = td < 90 ? a + Math.PI : a;
    wx = Math.cos(want); wy = Math.sin(want) + Math.sin(botA) * 0.5;
  } else {
    const bp = nearDust();
    if (bp) { const a = Math.atan2(bp.y - G.py, bp.x - G.px); wx = Math.cos(a); wy = Math.sin(a); }
    else { botA += dt * 0.5; wx = Math.cos(botA); wy = Math.sin(botA); }   // 没事干就绕着飘，别原地死等
  }
  keys['KeyW'] = wy < -0.25;
  keys['KeyS'] = wy > 0.25;
  keys['KeyA'] = wx < -0.25;
  keys['KeyD'] = wx > 0.25;
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
    onKey(e.code, true);
  });
  window.addEventListener('keyup', e => onKey(e.code, false));
  window.addEventListener('blur', () => { for (const k in keys) delete keys[k]; mouse.down = false; });

  // 鼠标
  const upd = e => { const [x, y] = toGame(e.clientX, e.clientY); mouse.x = x; mouse.y = y; mouse.inside = true; };
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
  function uiHit(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    const b = el.closest('[data-act]');
    if (b) { handleAct(b.dataset.act); return true; }
    const c = el.closest('.card');
    if (c && state === 'upgrade') { choose(+c.dataset.i, true); return true; }
    const h = el.closest('.hull');
    if (h && state === 'hangar') { pickHull([...$('hulls').children].indexOf(h)); return true; }
    return false;
  }
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', e => {
      pointerKind = e.pointerType === 'mouse' ? 'mouse' : 'touch';
      if (e.pointerType === 'mouse' && e.button !== 0) return;   // 右键留给冲刺
      uiHit(e.clientX, e.clientY);
    });
    document.addEventListener('pointermove', e => {
      if (e.pointerType) pointerKind = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    });
  } else {
    document.addEventListener('click', e => {
      const el = e.target && e.target.closest && e.target.closest('[data-act],.card,.hull');
      if (el) uiHit(e.clientX, e.clientY);
    });
  }

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
    },
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
