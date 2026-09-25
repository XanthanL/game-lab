'use strict';
/* ============================================================
 * 三幕（沿用旧作分层推进骨架：火星 -> 小行星带 -> 深空奇点）
 * ============================================================ */
const ACTS = [
  { key: 'mars', name: '火星', sub: 'MARS', depth: '0m', tag: '锈色荒原 · 重力井底', fog: '#2a0f12' },
  { key: 'belt', name: '小行星带', sub: 'THE BELT', depth: '4.2亿km', tag: '碎石环带 · 无光区', fog: '#0d1230' },
  { key: 'point', name: '深空奇点', sub: 'SINGULARITY', depth: '坐标无解', tag: '因果失效 · 终末', fog: '#1a0a2c' },
];

/* 每幕的普通敌人池 / 精英池 / Boss */
const ACT_FOES = [
  { pool: ['marsLeech', 'duneStalker', 'lavaSpider'], boss: 'sandTyrant' },
  { pool: ['rockCrab', 'crystalParasite', 'gravityWarp', 'voidLeech', 'magmaGolem', 'quantumSpecter'], boss: 'beltLeviathan' },
  { pool: ['voidLurker', 'entropyMaw', 'singularitySpawn', 'quantumSpecter', 'magmaGolem'], boss: 'singularityDevourer' },
];
const ELITE_KEYS = ['ancientGuardian', 'plasmaHydra', 'voidReaper'];

/* ============================================================
 * 状态效果
 * ============================================================ */
const STATUS_INFO = {
  burn:       { name: '灼烧', icon: 'burn', col: '#ef7d57', decay: 1 },
  poison:     { name: '中毒', icon: 'poison', col: '#a7f070', decay: 0 },
  vulnerable: { name: '易伤', icon: 'vulnerable', col: '#ffcd75', decay: 1 },
  strength:   { name: '力量', icon: 'strength', col: '#c070f0', decay: 0 },
  weak:       { name: '虚弱', icon: 'weak', col: '#566c86', decay: 1 },
  thorns:     { name: '反伤', icon: 'thorns', col: '#38b764', decay: 0 },
};
const DEBUFFS = ['burn', 'poison', 'vulnerable', 'weak'];

/* ============================================================
 * 实体
 * ============================================================ */
class Entity {
  constructor(o) {
    Object.assign(this, {
      name: '', sprite: 'marsLeech', hp: 10, baseMaxHp: 10, shield: 0,
      status: { burn: 0, poison: 0, vulnerable: 0, strength: 0, weak: 0, thorns: 0 },
      big: false, hitFlash: 0,
    }, o);
    this.hp = this.baseMaxHp;
  }
  get maxHp() { return this.baseMaxHp; }
  get alive() { return this.hp > 0; }
  getStatus(k) { return this.status[k] || 0; }
  addStatus(type, n) { this.status[type] = (this.status[type] || 0) + n; }
  clearDebuffs() { for (const d of DEBUFFS) this.status[d] = 0; }

  /** 回合开始结算：灼烧/中毒扣血，易伤/虚弱递减。返回扣血量 */
  tickStatus(reduction = 0) {
    let dmg = 0;
    if (this.status.burn > 0) {
      dmg += Math.floor(this.status.burn * (1 - reduction));
      this.status.burn = Math.max(0, this.status.burn - 1);
    }
    if (this.status.poison > 0) dmg += Math.floor(this.status.poison * (1 - reduction));
    if (dmg > 0) this.rawDamage(dmg);
    for (const k in STATUS_INFO) if (STATUS_INFO[k].decay && this.status[k] > 0) this.status[k]--;
    return dmg;
  }
  /** 直扣（不进护盾、不吃易伤），用于状态伤害 */
  rawDamage(n) { this.hp = Math.max(0, this.hp - n); }
  /** 受击：先吃护盾，易伤 x1.5 */
  takeDamage(amount) {
    let d = amount;
    if (this.status.vulnerable > 0) d = Math.floor(d * 1.5);
    const absorbed = Math.min(this.shield, d);
    this.shield -= absorbed;
    const toHp = d - absorbed;
    this.hp = Math.max(0, this.hp - toHp);
    return { absorbed, toHp, total: d };
  }
  heal(n) { const b = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); return this.hp - b; }
  gainShield(n) { this.shield += n; }
}

/* ============================================================
 * 玩家
 * ============================================================ */
class Player extends Entity {
  constructor(charId) {
    const c = CHARACTERS[charId] || CHARACTERS.astronaut;
    super({ name: c.name, sprite: charId, baseMaxHp: c.maxHp, big: false });
    this.charId = charId;
    this.baseBattery = c.battery;
    this.battery = c.battery;
    this.damageTakenBonus = 0;
    this.keepShield = false;
    this.relics = [];
    this.passive = c.passive;
  }
  get maxBattery() { return this.baseBattery + this.relicBonus('maxBattery'); }
  get maxHp() { return this.baseMaxHp + this.relicBonus('maxHp'); }
  relicBonus(key) {
    let s = 0;
    for (const id of this.relics) { const r = RELICS[id]; if (r && r.effect[key]) s += r.effect[key]; }
    return s;
  }
  hasRelic(id) { return this.relics.includes(id); }
  addRelic(id) {
    if (this.hasRelic(id)) return false;
    this.relics.push(id);
    if (RELICS[id].effect.maxHp) this.hp = Math.min(this.maxHp, this.hp + RELICS[id].effect.maxHp);
    return true;
  }
  get strengthMult() { return this.relicBonus('strengthDouble') ? 2 : 1; }
  resetTurn(keepBlock) {
    this.battery = this.maxBattery;
    this.damageTakenBonus = 0;
    if (!keepBlock) this.shield = 0;
  }
}

/* ============================================================
 * 敌人
 * ============================================================ */
class Enemy extends Entity {
  constructor(key, scale = 1) {
    const d = ENEMIES[key];
    const hp = Math.round(d.hp * scale);
    super({ name: d.name, sprite: key, baseMaxHp: hp, big: !!d.boss });
    Object.assign(this, {
      key, pattern: d.pattern, actions: d.actions ? JSON.parse(JSON.stringify(d.actions)) : null,
      baseDamage: d.baseDamage || 0, damageIncrement: d.increment || 0,
      chargeTurns: d.chargeTurns || 0, chargeDamage: d.chargeDamage || 0,
      elite: !!d.elite, boss: !!d.boss, phase2: d.phase2 || null, enraged: false,
      turnCount: 0, currentCharge: 0,
      dmgMul: 1,                      // 梯度等级「敌人伤害 +N%」挂在这里
    });
    if (d.boss) this.chargeDamageNow = this.chargeDamage;
  }
  /** 伤害统一走这里缩放 —— getIntent 与 executeTurn 都必须过一遍，
      否则「显示的意图」和「实际打出来的数字」会不一样，那是最伤信任的一类 bug。 */
  dmg(v) { return Math.round((v || 0) * this.dmgMul); }
  /** 结构化意图：{type:'attack'|'defend'|'charge'|'charged', value, statuses} */
  getIntent() {
    const d = ENEMIES[this.key];
    switch (this.pattern) {
      case 'FIXED':
        return { type: 'attack', value: this.dmg(this.baseDamage) };
      case 'ALTERNATING': {
        const a = this.actions[this.turnCount % this.actions.length];
        return a.shield ? { type: 'defend', value: a.shield } : { type: 'attack', value: this.dmg(a.dmg), statuses: a.status };
      }
      case 'RAMPING':
        return { type: 'attack', value: this.dmg(this.baseDamage + this.turnCount * this.damageIncrement), statuses: d.status };
      case 'BOSS_CHARGE':
        if (this.currentCharge < this.chargeTurns)
          return { type: 'charge', value: 0, left: this.chargeTurns - this.currentCharge };
        return { type: 'charged', value: this.dmg(this.chargeDamageNow || this.chargeDamage), statuses: this.bossStatus() };
      default:
        return { type: 'attack', value: this.dmg(this.baseDamage) };
    }
  }
  bossStatus() {
    const d = ENEMIES[this.key];
    return (this.enraged && d.phase2 && d.phase2.status) ? d.phase2.status : d.status;
  }
  /** 检查进入二阶段 */
  checkPhase() {
    if (this.enraged || !this.phase2) return false;
    if (this.hp > 0 && this.hp <= this.maxHp * (this.phase2.at || 0.5)) {
      this.enraged = true;
      const p = this.phase2;
      if (p.actions) this.actions = JSON.parse(JSON.stringify(p.actions));
      if (p.baseDamage != null) this.baseDamage = p.baseDamage;
      if (p.increment != null) this.damageIncrement = p.increment;
      if (p.chargeTurns != null) this.chargeTurns = p.chargeTurns;
      if (p.chargeDamage != null) this.chargeDamageNow = p.chargeDamage;
      if (p.status) this.status_override = p.status;
      this.name = ENEMIES[this.key].name + ' · 狂暴';
      return true;
    }
    return false;
  }
  /** 执行一回合，返回 {type, value, statuses, shield} */
  executeTurn() {
    this.turnCount++;
    switch (this.pattern) {
      case 'FIXED':
        return { type: 'attack', value: this.dmg(this.baseDamage) };
      case 'ALTERNATING': {
        const a = this.actions[(this.turnCount - 1) % this.actions.length];
        if (a.shield) return { type: 'defend', value: a.shield };
        return { type: 'attack', value: this.dmg(a.dmg), statuses: a.status };
      }
      case 'RAMPING':
        return { type: 'attack', value: this.dmg(this.baseDamage + (this.turnCount - 1) * this.damageIncrement), statuses: this.bossStatus() };
      case 'BOSS_CHARGE':
        if (this.currentCharge < this.chargeTurns) { this.currentCharge++; return { type: 'charge', value: this.currentCharge }; }
        this.currentCharge = 0;
        return { type: 'charged', value: this.dmg(this.chargeDamageNow || this.chargeDamage), statuses: this.bossStatus() };
      default:
        return { type: 'attack', value: this.dmg(this.baseDamage) };
    }
  }
}

/* ============================================================
 * 职业
 * ============================================================ */
const CHARACTERS = {
  astronaut: {
    id: 'astronaut', name: '宇航员', title: '平衡的探索者', maxHp: 80, battery: 3, col: '#41a6f6',
    passive: 'astronautShield', passiveText: '回合开始 10% 得 1 护盾',
    deck: [['laserShot', 4], ['overchargeBlast', 1], ['plasmaShield', 4], ['shieldMatrix', 1]],
  },
  engineer: {
    id: 'engineer', name: '工程兵', title: '护盾大师', maxHp: 70, battery: 4, col: '#38b764',
    passive: 'engineerShield', passiveText: '护盾牌额外 +2 护盾',
    deck: [['laserShot', 2], ['plasmaShield', 5], ['shieldMatrix', 2], ['nanoArmor', 1]],
  },
  mutant: {
    id: 'mutant', name: '异变者', title: '状态操控者', maxHp: 75, battery: 3, col: '#c070f0',
    passive: 'mutantStatus', passiveText: '状态牌层数翻倍',
    deck: [['laserShot', 3], ['plasmaBurn', 2], ['corrosiveFog', 2], ['plasmaShield', 2], ['sporeRelease', 1]],
  },
  assault: {
    id: 'assault', name: '突击兵', title: '连击杀手', maxHp: 65, battery: 3, col: '#e04060',
    passive: 'assaultCombo', passiveText: '攻击牌 15% 得 1 电量',
    deck: [['laserShot', 5], ['overchargeBlast', 2], ['empCannon', 1], ['plasmaShield', 2]],
  },
};
function buildStarterDeck(charId) {
  const c = CHARACTERS[charId], out = [];
  for (const [id, n] of c.deck) for (let i = 0; i < n; i++) out.push(createCardInstance(CARD_DEFS[id]));
  return out;
}

/* ============================================================
 * 遗物
 * ============================================================ */
const RELICS = {
  starCore:      { id: 'starCore', name: '星核动力核心', icon: 'core', desc: '最大生命 +10', effect: { maxHp: 10 }, col: '#ef7d57' },
  thuliumCell:   { id: 'thuliumCell', name: '铥元素电池', icon: 'battery', desc: '每回合电量 +1', effect: { maxBattery: 1 }, col: '#41a6f6' },
  hematite:      { id: 'hematite', name: '赤铁护符', icon: 'amulet', desc: '回合开始 +3 护盾', effect: { turnShield: 3 }, col: '#b13e53' },
  stabilizer:    { id: 'stabilizer', name: '量子稳定器', icon: 'stabilizer', desc: '灼烧/中毒伤害减半', effect: { statusCut: 0.5 }, col: '#c070f0' },
  monocle:       { id: 'monocle', name: '深空目镜', icon: 'monocle', desc: '每回合多抽 1 张', effect: { extraDraw: 1 }, col: '#73eff7' },
  nanoSwarm:     { id: 'nanoSwarm', name: '纳米修复蜂群', icon: 'swarm', desc: '每回合恢复 2 生命', effect: { turnHeal: 2 }, col: '#38b764' },
  antimatter:    { id: 'antimatter', name: '反物质核心', icon: 'antimatter', desc: '力量效果翻倍', effect: { strengthDouble: 1 }, col: '#ffcd75' },
  ancientRune:   { id: 'ancientRune', name: '太古符文', icon: 'rune', desc: '药水与治疗效果翻倍', effect: { potionDouble: 1 }, col: '#ffcd75' },
};
const RELIC_IDS = Object.keys(RELICS);
function randomRelic(owned) {
  const pool = RELIC_IDS.filter(i => !owned.includes(i));
  return pool.length ? pool[(Math.random() * pool.length) | 0] : null;
}

/* ============================================================
 * 敌人图鉴
 * pattern: FIXED 恒定 / ALTERNATING 循环 / RAMPING 递增 / BOSS_CHARGE 蓄力
 * ============================================================ */
const ENEMIES = {
  /* --- 第一幕 火星 --- */
  marsLeech:      { name: '火星幼蛭', hp: 28, pattern: 'FIXED', baseDamage: 6 },
  duneStalker:    { name: '沙丘跃行者', hp: 34, pattern: 'ALTERNATING', actions: [{ shield: 5 }, { dmg: 9 }] },
  lavaSpider:     { name: '熔岩蜘蛛', hp: 32, pattern: 'ALTERNATING', actions: [{ dmg: 3, status: { burn: 1 } }, { dmg: 3, status: { burn: 1 } }] },
  sandTyrant:     {
    name: '沙暴暴君', hp: 60, pattern: 'ALTERNATING', boss: true,
    actions: [{ shield: 10 }, { dmg: 12, status: { vulnerable: 2 } }, { dmg: 8 }],
    phase2: { at: 0.5, actions: [{ shield: 6 }, { dmg: 16, status: { vulnerable: 2 } }, { dmg: 10, status: { weak: 1 } }] },
  },
  /* --- 第二幕 小行星带 --- */
  rockCrab:       { name: '陨壳蟹', hp: 46, pattern: 'ALTERNATING', actions: [{ dmg: 11, status: { vulnerable: 1 } }, { shield: 8 }] },
  crystalParasite:{ name: '晶化寄生虫', hp: 40, pattern: 'RAMPING', baseDamage: 5, increment: 3, status: { poison: 1 } },
  gravityWarp:    { name: '引力扭曲者', hp: 38, pattern: 'ALTERNATING', actions: [{ dmg: 8, status: { weak: 1 } }, { shield: 6 }] },
  voidLeech:      { name: '虚空蛭', hp: 36, pattern: 'RAMPING', baseDamage: 4, increment: 2, status: { weak: 1 } },
  magmaGolem:     { name: '熔核魔像', hp: 50, pattern: 'ALTERNATING', actions: [{ shield: 10 }, { dmg: 12, status: { burn: 2 } }] },
  quantumSpecter: { name: '量子幽灵', hp: 42, pattern: 'ALTERNATING', actions: [{ dmg: 7, status: { vulnerable: 2 } }, { shield: 5 }] },
  beltLeviathan:  {
    name: '带核利维坦', hp: 78, pattern: 'RAMPING', baseDamage: 6, increment: 2, status: { poison: 2 }, boss: true,
    phase2: { at: 0.5, baseDamage: 8, increment: 3, status: { poison: 3 } },
  },
  /* --- 第三幕 深空 --- */
  voidLurker:     { name: '虚空潜伏者', hp: 58, pattern: 'ALTERNATING', actions: [{ shield: 15 }, { dmg: 14, status: { burn: 2 } }] },
  entropyMaw:     { name: '熵噬兽', hp: 52, pattern: 'RAMPING', baseDamage: 7, increment: 4, status: { vulnerable: 1 } },
  singularitySpawn:{ name: '奇点裔', hp: 48, pattern: 'ALTERNATING', actions: [{ dmg: 9, status: { weak: 2 } }, { dmg: 13, status: { vulnerable: 2 } }] },
  singularityDevourer: {
    name: '奇点吞噬者', hp: 92, pattern: 'BOSS_CHARGE', chargeTurns: 2, chargeDamage: 26, boss: true,
    status: [{ vulnerable: 3 }, { burn: 2 }],
    phase2: { at: 0.4, chargeTurns: 1, chargeDamage: 30, status: [{ vulnerable: 3 }, { burn: 3 }, { weak: 1 }] },
  },
  /* --- 精英 --- */
  ancientGuardian:{ name: '远古守望者', hp: 68, elite: true, pattern: 'ALTERNATING', actions: [{ shield: 18 }, { dmg: 16, status: { vulnerable: 2 } }] },
  plasmaHydra:    { name: '等离子九头蛇', hp: 62, elite: true, pattern: 'RAMPING', baseDamage: 6, increment: 4, status: { burn: 2 } },
  voidReaper:     { name: '虚空收割者', hp: 58, elite: true, pattern: 'ALTERNATING', actions: [{ dmg: 13, status: { weak: 2 } }, { dmg: 13, status: { vulnerable: 2 } }] },
};

/** 按幕生成敌人；scale 让同幕内靠后的战斗略强 */
function makeEnemy(act, kind, row, asc) {
  const a = ACT_FOES[Math.min(act, 2)];
  let key;
  if (kind === 'elite') key = ELITE_KEYS[(Math.random() * ELITE_KEYS.length) | 0];
  else if (kind === 'boss') key = a.boss;
  else key = a.pool[(Math.random() * a.pool.length) | 0];
  // 梯度等级：敌血 / 敌伤按等级放大。
  // BOSS 本来就不吃 row 缩放（体量单独定过），所以只叠加它自己的 bossHp 那一条。
  // ⚠️ asc **必须由调用方传进来**，不要在 entities.js 里直接读 G ——
  //    顶层 const 有 TDZ，typeof 也救不了；显式传参顺带去掉跨文件的隐式依赖。
  const m = ascMods(asc || 0);
  const extra = m.hp + (kind === 'boss' ? m.bossHp : 0) + (kind === 'elite' ? m.elite : 0);
  const scale = kind === 'boss' ? 1 + extra : 1 + Math.min(row, 5) * 0.06 + act * 0.05 + extra;
  const e = new Enemy(key, scale);
  e.dmgMul = 1 + m.dmg;
  return e;
}
