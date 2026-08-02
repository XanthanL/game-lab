/**
 * cards.js — 卡牌定义、牌组构建、抽牌/弃牌系统、升级与药水
 */

/* ============================================================
 * 稀有度常量
 * ============================================================ */
const CARD_RARITY = {
  STARTER: 'starter',
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
};

/* ============================================================
 * 卡牌定义
 * ============================================================ */
const CARD_DEFS = {
  /* ---------- 初始卡牌 ---------- */
  laserShot: {
    id: 'laserShot',
    name: '激光射击',
    cost: 1,
    desc: '造成 6 点伤害',
    type: 'damage',
    value: 6,
    color: 0xff4444,
    rarity: CARD_RARITY.STARTER,
  },
  overchargeBlast: {
    id: 'overchargeBlast',
    name: '过载轰击',
    cost: 2,
    desc: '造成 14 点伤害',
    type: 'damage',
    value: 14,
    color: 0xff8800,
    rarity: CARD_RARITY.UNCOMMON,
  },
  plasmaShield: {
    id: 'plasmaShield',
    name: '电浆护盾',
    cost: 1,
    desc: '获得 5 点护盾',
    type: 'shield',
    value: 5,
    color: 0x44aaff,
    rarity: CARD_RARITY.STARTER,
  },
  shieldMatrix: {
    id: 'shieldMatrix',
    name: '矩阵防御',
    cost: 2,
    desc: '获得 12 点护盾',
    type: 'shield',
    value: 12,
    color: 0x66ddff,
    rarity: CARD_RARITY.UNCOMMON,
  },
  /* ---------- 战后奖励扩展卡池 ---------- */
  piercingBeam: {
    id: 'piercingBeam',
    name: '穿透光束',
    cost: 2,
    desc: '造成 10 点伤害，无视护盾',
    type: 'damage',
    value: 10,
    color: 0xff2266,
    rarity: CARD_RARITY.RARE,
    pierce: true,
  },
  emergencyRepair: {
    id: 'emergencyRepair',
    name: '紧急维修',
    cost: 1,
    desc: '获得 8 点护盾，下一回合保留',
    type: 'shield',
    value: 8,
    color: 0x22ddff,
    rarity: CARD_RARITY.COMMON,
    retain: true,
  },
  antimatterRailgun: {
    id: 'antimatterRailgun',
    name: '反物质轨道炮',
    cost: 3,
    desc: '造成 24 点毁灭伤害',
    type: 'damage',
    value: 24,
    color: 0xff22ff,
    rarity: CARD_RARITY.RARE,
  },
  emergencyOverloadValve: {
    id: 'emergencyOverloadValve',
    name: '应急过载应急阀',
    cost: 0,
    desc: '获得 1 点电量，本回合受伤 +2',
    type: 'special',
    value: 1,
    color: 0xffdd00,
    rarity: CARD_RARITY.UNCOMMON,
    gainBattery: 1,
    damageTakenBonus: 2,
  },
  nanoRepairBoost: {
    id: 'nanoRepairBoost',
    name: '纳米修复强化',
    cost: 1,
    desc: '获得 4 护盾并恢复 3 生命',
    type: 'shield',
    value: 4,
    color: 0x22ffaa,
    rarity: CARD_RARITY.COMMON,
    heal: 3,
  },

  /* ---------- 灼烧系 ---------- */
  plasmaBurn: {
    id: 'plasmaBurn',
    name: '等离子燃烧弹',
    cost: 1,
    desc: '造成 4 点伤害，施加 3 层灼烧',
    type: 'damage',
    value: 4,
    color: 0xff6600,
    rarity: CARD_RARITY.UNCOMMON,
    statusEffect: { type: 'burn', stacks: 3 },
  },
  thermalConduction: {
    id: 'thermalConduction',
    name: '热能传导',
    cost: 1,
    desc: '灼烧层数翻倍',
    type: 'special',
    value: 0,
    color: 0xff9900,
    rarity: CARD_RARITY.RARE,
    statusEffectAction: 'doubleBurn',
  },

  /* ---------- 中毒系 ---------- */
  corrosiveFog: {
    id: 'corrosiveFog',
    name: '腐蚀毒雾',
    cost: 1,
    desc: '施加 2 层中毒',
    type: 'special',
    value: 0,
    color: 0x66ff44,
    rarity: CARD_RARITY.UNCOMMON,
    statusEffect: { type: 'poison', stacks: 2 },
  },
  sporeRelease: {
    id: 'sporeRelease',
    name: '孢子释放',
    cost: 0,
    desc: '施加 1 层中毒，抽 1 张牌',
    type: 'special',
    value: 0,
    color: 0x88ff66,
    rarity: CARD_RARITY.COMMON,
    statusEffect: { type: 'poison', stacks: 1 },
    drawCards: 1,
  },

  /* ---------- 易伤系 ---------- */
  weaknessScan: {
    id: 'weaknessScan',
    name: '弱点扫描',
    cost: 1,
    desc: '施加 2 层易伤',
    type: 'special',
    value: 0,
    color: 0xffff44,
    rarity: CARD_RARITY.UNCOMMON,
    statusEffect: { type: 'vulnerable', stacks: 2 },
  },
  tacticalMark: {
    id: 'tacticalMark',
    name: '战术标记',
    cost: 1,
    desc: '造成 5 点伤害，施加 1 层易伤',
    type: 'damage',
    value: 5,
    color: 0xffdd33,
    rarity: CARD_RARITY.COMMON,
    statusEffect: { type: 'vulnerable', stacks: 1 },
  },

  /* ---------- 力量系 ---------- */
  adrenaline: {
    id: 'adrenaline',
    name: '肾上腺素',
    cost: 1,
    desc: '获得 2 层力量，抽 1 张牌',
    type: 'special',
    value: 0,
    color: 0xff44ff,
    rarity: CARD_RARITY.RARE,
    statusEffect: { type: 'strength', stacks: 2 },
    selfTarget: true,
    drawCards: 1,
  },
  overclockOverload: {
    id: 'overclockOverload',
    name: '超频过载',
    cost: 0,
    desc: '获得 3 层力量，失去 6 点生命',
    type: 'special',
    value: 0,
    color: 0xff22cc,
    rarity: CARD_RARITY.RARE,
    statusEffect: { type: 'strength', stacks: 3 },
    selfTarget: true,
    selfDamage: 6,
  },

  /* ---------- 抽牌/电量系 ---------- */
  quickReload: {
    id: 'quickReload',
    name: '快速装填',
    cost: 0,
    desc: '抽 2 张牌',
    type: 'special',
    value: 0,
    color: 0x44ddff,
    rarity: CARD_RARITY.COMMON,
    drawCards: 2,
  },
  tacticalAnalysis: {
    id: 'tacticalAnalysis',
    name: '战术分析',
    cost: 0,
    desc: '抽 1 张牌，获得 1 点电量',
    type: 'special',
    value: 0,
    color: 0x33ccff,
    rarity: CARD_RARITY.UNCOMMON,
    drawCards: 1,
    gainBattery: 1,
  },

  /* ---------- 多段攻击 ---------- */
  empCannon: {
    id: 'empCannon',
    name: '电磁脉冲炮',
    cost: 2,
    desc: '造成 4 次 3 点伤害，每次施加 1 层灼烧',
    type: 'damage',
    value: 3,
    color: 0xff44aa,
    rarity: CARD_RARITY.RARE,
    hits: 4,
    statusEffect: { type: 'burn', stacks: 1 },
  },

  /* ---------- 增益系 ---------- */
  forceResonance: {
    id: 'forceResonance',
    name: '力场共振',
    cost: 1,
    desc: '获得护盾等于力量层数×2',
    type: 'shield',
    value: 0,
    color: 0x66ffcc,
    rarity: CARD_RARITY.UNCOMMON,
    shieldFromStrength: true,
  },
  nanoArmor: {
    id: 'nanoArmor',
    name: '纳米护甲',
    cost: 1,
    desc: '获得 6 护盾并恢复 2 生命',
    type: 'shield',
    value: 6,
    color: 0x22ffaa,
    rarity: CARD_RARITY.COMMON,
    heal: 2,
  },

  /* ---------- 新增卡牌：吸血系 ---------- */
  bloodDrain: {
    id: 'bloodDrain',
    name: '生命汲取',
    cost: 2,
    desc: '造成 8 点伤害，恢复等量生命',
    type: 'damage',
    value: 8,
    color: 0xcc3344,
    rarity: CARD_RARITY.UNCOMMON,
    lifesteal: true,
  },
  vampiricStrike: {
    id: 'vampiricStrike',
    name: '吸血打击',
    cost: 1,
    desc: '造成 5 点伤害，恢复 3 点生命',
    type: 'damage',
    value: 5,
    color: 0xaa2244,
    rarity: CARD_RARITY.COMMON,
    heal: 3,
    lifesteal: false,
  },

  /* ---------- 新增卡牌：百分比伤害系 ---------- */
  gravityCrush: {
    id: 'gravityCrush',
    name: '引力碾压',
    cost: 2,
    desc: '造成敌人最大生命值 15% 的伤害',
    type: 'damage',
    value: 0,
    color: 0x9966ff,
    rarity: CARD_RARITY.RARE,
    percentDamage: 0.15,
  },

  /* ---------- 新增卡牌：弃牌检索系 ---------- */
  battlePlan: {
    id: 'battlePlan',
    name: '战术规划',
    cost: 0,
    desc: '抽 1 张牌，若手牌≤3 则再抽 1 张',
    type: 'special',
    value: 0,
    color: 0x4488ff,
    rarity: CARD_RARITY.UNCOMMON,
    conditionalDraw: true,
  },

  /* ---------- 新增卡牌：护盾反击系 ---------- */
  thornArmor: {
    id: 'thornArmor',
    name: '荆棘装甲',
    cost: 1,
    desc: '获得 6 护盾，获得 2 层反伤',
    type: 'shield',
    value: 6,
    color: 0x88aa44,
    rarity: CARD_RARITY.UNCOMMON,
    gainThorns: 2,
  },

  /* ---------- 新增卡牌：过载系 ---------- */
  meltdown: {
    id: 'meltdown',
    name: '核心熔毁',
    cost: 0,
    desc: '造成 20 点伤害，失去 10 点生命',
    type: 'damage',
    value: 20,
    color: 0xff3300,
    rarity: CARD_RARITY.RARE,
    selfDamage: 10,
  },

  /* ---------- 新增卡牌：状态清除系 ---------- */
  systemReboot: {
    id: 'systemReboot',
    name: '系统重启',
    cost: 1,
    desc: '清除自身所有负面状态，抽 2 张牌',
    type: 'special',
    value: 0,
    color: 0x33ffff,
    rarity: CARD_RARITY.UNCOMMON,
    purifySelf: true,
    drawCards: 2,
  },

  /* ---------- 新增卡牌：力量消耗系 ---------- */
  voidSlash: {
    id: 'voidSlash',
    name: '虚空斩击',
    cost: 1,
    desc: '造成 12 点伤害，消耗 1 层力量',
    type: 'damage',
    value: 12,
    color: 0x8844cc,
    rarity: CARD_RARITY.RARE,
    consumeStrength: 1,
  },
};

/* ============================================================
 * 卡牌池（按稀有度分组，用于战后奖励、商店等）
 * ============================================================ */
const CARD_POOL = {
  [CARD_RARITY.COMMON]: [
    'emergencyRepair',
    'nanoRepairBoost',
    'sporeRelease',
    'tacticalMark',
    'quickReload',
    'nanoArmor',
    'vampiricStrike',
  ],
  [CARD_RARITY.UNCOMMON]: [
    'overchargeBlast',
    'shieldMatrix',
    'emergencyOverloadValve',
    'plasmaBurn',
    'corrosiveFog',
    'weaknessScan',
    'tacticalAnalysis',
    'forceResonance',
    'bloodDrain',
    'battlePlan',
    'thornArmor',
    'systemReboot',
  ],
  [CARD_RARITY.RARE]: [
    'piercingBeam',
    'antimatterRailgun',
    'thermalConduction',
    'adrenaline',
    'overclockOverload',
    'empCannon',
    'gravityCrush',
    'meltdown',
    'voidSlash',
  ],
};

/* ============================================================
 * 卡牌实例唯一 ID 生成器
 * ============================================================ */
let CARD_UID_COUNTER = 0;

function createCardInstance(def) {
  return { ...def, uid: CARD_UID_COUNTER++ };
}

/* ============================================================
 * 诅咒卡系统
 * ============================================================ */
const CURSE_CARDS = {
  voidCurse: {
    id: 'voidCurse',
    name: '虚空之咒',
    cost: 0,
    desc: '无法打出。占用手牌位。',
    type: 'curse',
    color: 0x660066,
    rarity: 'curse',
    curse: true,
    unplayable: true,
  },
  parasite: {
    id: 'parasite',
    name: '寄生孢子',
    cost: 0,
    desc: '无法打出。回合结束时受到 1 点伤害。',
    type: 'curse',
    color: 0x336622,
    rarity: 'curse',
    curse: true,
    unplayable: true,
    endTurnDamage: 1,
  },
  frail: {
    id: 'frail',
    name: '虚弱之咒',
    cost: 0,
    desc: '无法打出。手牌中存在此卡时，受到伤害 +1。',
    type: 'curse',
    color: 0x553333,
    rarity: 'curse',
    curse: true,
    unplayable: true,
    damageAmplify: 1,
  },
};

/** 随机创建一张诅咒卡实例 */
function createCurseCard() {
  const keys = Object.keys(CURSE_CARDS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return createCardInstance(CURSE_CARDS[key]);
}

/* ============================================================
 * 初始牌组（按角色构建）
 * ============================================================ */
function buildStarterDeck(characterId = 'astronaut') {
  const character = CHARACTERS[characterId] || CHARACTERS.astronaut;
  const deck = [];
  const template = character.starterDeck;
  for (const entry of template) {
    for (let i = 0; i < entry.count; i++) {
      deck.push(createCardInstance(CARD_DEFS[entry.def]));
    }
  }
  return deck;
}

/* ============================================================
 * 卡牌升级系统
 * UPGRADES 定义每张卡牌升级后的字段覆盖（含新描述）
 * upgradeCard 接受卡牌实例，返回保留 uid 的升级后新实例
 * ============================================================ */
const UPGRADES = {
  /* 初始卡牌 */
  laserShot:             { value: 9,  desc: '造成 9 点伤害' },
  overchargeBlast:       { value: 20, desc: '造成 20 点伤害' },
  plasmaShield:          { value: 8,  desc: '获得 8 点护盾' },
  shieldMatrix:          { value: 16, desc: '获得 16 点护盾' },
  /* 扩展卡牌 */
  piercingBeam:          { value: 15, desc: '造成 15 点伤害，无视护盾' },
  emergencyRepair:       { value: 12, desc: '获得 12 点护盾，下一回合保留' },
  antimatterRailgun:     { value: 32, desc: '造成 32 点毁灭伤害' },
  emergencyOverloadValve:{ gainBattery: 2, desc: '获得 2 点电量，本回合受伤 +2' },
  nanoRepairBoost:       { value: 6, heal: 5, desc: '获得 6 护盾并恢复 5 生命' },
  /* 灼烧系 */
  plasmaBurn:            { value: 6, statusEffect: { type: 'burn', stacks: 4 }, desc: '造成 6 点伤害，施加 4 层灼烧' },
  thermalConduction:     { cost: 0, desc: '灼烧层数翻倍（消耗降为 0）' },
  /* 中毒系 */
  corrosiveFog:          { statusEffect: { type: 'poison', stacks: 3 }, desc: '施加 3 层中毒' },
  sporeRelease:          { statusEffect: { type: 'poison', stacks: 2 }, drawCards: 2, desc: '施加 2 层中毒，抽 2 张牌' },
  /* 易伤系 */
  weaknessScan:          { statusEffect: { type: 'vulnerable', stacks: 3 }, desc: '施加 3 层易伤' },
  tacticalMark:          { value: 7, statusEffect: { type: 'vulnerable', stacks: 2 }, desc: '造成 7 点伤害，施加 2 层易伤' },
  /* 力量系 */
  adrenaline:            { statusEffect: { type: 'strength', stacks: 3 }, desc: '获得 3 层力量，抽 1 张牌' },
  overclockOverload:     { statusEffect: { type: 'strength', stacks: 4 }, selfDamage: 4, desc: '获得 4 层力量，失去 4 点生命' },
  /* 抽牌/电量系 */
  quickReload:           { drawCards: 3, desc: '抽 3 张牌' },
  tacticalAnalysis:      { drawCards: 2, gainBattery: 2, desc: '抽 2 张牌，获得 2 点电量' },
  /* 多段攻击 */
  empCannon:             { value: 4, desc: '造成 4 次 4 点伤害，每次施加 1 层灼烧' },
  /* 增益系 */
  forceResonance:        { cost: 0, desc: '获得护盾等于力量层数×2（消耗降为 0）' },
  nanoArmor:             { value: 8, heal: 3, desc: '获得 8 护盾并恢复 3 生命' },
  /* 新增卡牌升级 */
  bloodDrain:            { value: 12, desc: '造成 12 点伤害，恢复等量生命' },
  vampiricStrike:        { value: 7, heal: 5, desc: '造成 7 点伤害，恢复 5 点生命' },
  gravityCrush:          { percentDamage: 0.25, desc: '造成敌人最大生命值 25% 的伤害' },
  battlePlan:            { drawCards: 1, desc: '抽 1 张牌，若手牌≤4 则再抽 2 张' },
  thornArmor:            { value: 9, gainThorns: 3, desc: '获得 9 护盾，获得 3 层反伤' },
  meltdown:              { value: 28, selfDamage: 6, desc: '造成 28 点伤害，失去 6 点生命' },
  systemReboot:          { cost: 0, drawCards: 3, desc: '清除自身所有负面状态，抽 3 张牌（消耗降为 0）' },
  voidSlash:             { value: 16, desc: '造成 16 点伤害，消耗 1 层力量' },
};

function upgradeCard(card) {
  // 已升级的卡牌不可再次升级
  if (card.upgraded) return null;
  const upgrade = UPGRADES[card.id];
  if (!upgrade) return null;
  // 浅拷贝原卡牌并覆盖升级字段，保留 uid
  const upgraded = {
    ...card,
    ...upgrade,
    name: card.name + '+',
    upgraded: true,
    uid: card.uid,
  };
  return upgraded;
}

/* ============================================================
 * 药水系统
 * POTION_DEFS 定义所有药水；rollPotionReward 随机返回一种
 * ============================================================ */
const POTION_DEFS = {
  healthSerum: {
    id: 'healthSerum',
    name: '生命血清',
    desc: '恢复 15 点生命',
    color: 0xff3333,
    effect: { type: 'heal', value: 15 },
  },
  energyCell: {
    id: 'energyCell',
    name: '能量电池',
    desc: '获得 2 点电量',
    color: 0x33ccff,
    effect: { type: 'battery', value: 2 },
  },
  shieldSpray: {
    id: 'shieldSpray',
    name: '护盾喷雾',
    desc: '获得 12 点护盾',
    color: 0x44aaff,
    effect: { type: 'shield', value: 12 },
  },
  fireBottle: {
    id: 'fireBottle',
    name: '燃烧瓶',
    desc: '施加 5 层灼烧',
    color: 0xff6600,
    effect: { type: 'burn', stacks: 5 },
  },
  poisonBomb: {
    id: 'poisonBomb',
    name: '毒气弹',
    desc: '施加 5 层中毒',
    color: 0x66ff44,
    effect: { type: 'poison', stacks: 5 },
  },
  purifier: {
    id: 'purifier',
    name: '净化剂',
    desc: '清除玩家所有负面状态（灼烧/中毒/易伤/虚弱）',
    color: 0xffffff,
    effect: { type: 'purify' },
  },
};

function rollPotionReward() {
  const keys = Object.keys(POTION_DEFS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return POTION_DEFS[key];
}

/* ============================================================
 * 战后奖励抽卡
 * 按权重随机抽取指定数量的不同卡牌
 * ============================================================ */
function rollCardRewards(count = 3, weights = { common: 0.6, uncommon: 0.3, rare: 0.1 }) {
  const rewards = [];
  const pickedIds = new Set();

  while (rewards.length < count) {
    const roll = Math.random();
    let rarity;
    if (roll < weights.rare) {
      rarity = CARD_RARITY.RARE;
    } else if (roll < weights.rare + weights.uncommon) {
      rarity = CARD_RARITY.UNCOMMON;
    } else {
      rarity = CARD_RARITY.COMMON;
    }

    const pool = CARD_POOL[rarity];
    if (!pool || pool.length === 0) continue;

    const key = pool[Math.floor(Math.random() * pool.length)];
    const def = CARD_DEFS[key];
    if (pickedIds.has(def.id)) continue;

    pickedIds.add(def.id);
    rewards.push(createCardInstance(def));
  }

  return rewards;
}

/* ============================================================
 * 战后三选一奖励专用扩展卡池（含所有非初始卡牌）
 * ============================================================ */
const POST_BATTLE_REWARD_POOL = [
  'overchargeBlast',
  'shieldMatrix',
  'piercingBeam',
  'emergencyRepair',
  'antimatterRailgun',
  'emergencyOverloadValve',
  'nanoRepairBoost',
  'plasmaBurn',
  'thermalConduction',
  'corrosiveFog',
  'sporeRelease',
  'weaknessScan',
  'tacticalMark',
  'adrenaline',
  'overclockOverload',
  'quickReload',
  'tacticalAnalysis',
  'empCannon',
  'forceResonance',
  'nanoArmor',
  'bloodDrain',
  'vampiricStrike',
  'gravityCrush',
  'battlePlan',
  'thornArmor',
  'meltdown',
  'systemReboot',
  'voidSlash',
];

function rollPostBattleRewards(count = 3) {
  const pool = [...POST_BATTLE_REWARD_POOL];
  const rewards = [];
  while (rewards.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    rewards.push(createCardInstance(CARD_DEFS[key]));
  }
  return rewards;
}

/* ============================================================
 * Fisher–Yates 洗牌
 * ============================================================ */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ============================================================
 * 抽牌堆
 * ============================================================ */
class DrawPile {
  constructor(cards) {
    this.cards = shuffleArray([...cards]);
  }

  /** 抽出 count 张牌 */
  draw(count) {
    return this.cards.splice(0, count);
  }

  /** 将弃牌堆洗回抽牌堆 */
  reshuffle(discarded) {
    this.cards.push(...discarded);
    shuffleArray(this.cards);
  }

  get size() {
    return this.cards.length;
  }
}
