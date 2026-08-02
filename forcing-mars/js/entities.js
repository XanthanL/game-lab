/**
 * entities.js — 玩家 & 敌人模型
 * 支持：固定伤害、交替行动、递增伤害、Boss蓄力 四种模式
 * 支持：状态效果系统（灼烧/中毒/易伤/力量/虚弱）
 * 支持：遗物系统（8种遗物）
 */

/* ============================================================
 * 状态效果名称映射
 * ============================================================ */
const STATUS_EFFECT_NAMES = {
  burn: '灼烧',
  poison: '中毒',
  vulnerable: '易伤',
  strength: '力量',
  weak: '虚弱',
  thorns: '反伤',
};

/** 生成状态效果的描述文本（支持单个对象或数组形式） */
function describeStatusEffect(statusEffect) {
  if (!statusEffect) return '';
  const effects = Array.isArray(statusEffect) ? statusEffect : [statusEffect];
  if (effects.length === 0) return '';
  const parts = effects.map(eff => {
    const name = STATUS_EFFECT_NAMES[eff.type] || eff.type;
    return `${eff.stacks}层${name}`;
  });
  return `（附加${parts.join(' + ')}）`;
}

/* ============================================================
 * 基类 Entity
 * ============================================================ */
class Entity {
  constructor(name, maxHp) {
    this.name = name;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.shield = 0;
    // 状态效果：burn(灼烧) / poison(中毒) / vulnerable(易伤) / strength(力量) / weak(虚弱) / thorns(反伤)
    this.statusEffects = {
      burn: 0,
      poison: 0,
      vulnerable: 0,
      strength: 0,
      weak: 0,
      thorns: 0,
    };
  }

  /** 添加状态效果层数 */
  addStatus(type, stacks) {
    if (!(type in this.statusEffects)) {
      this.statusEffects[type] = 0;
    }
    this.statusEffects[type] += stacks;
  }

  /** 获取指定状态效果的当前层数 */
  getStatus(type) {
    return this.statusEffects[type] || 0;
  }

  /** 清除所有状态效果 */
  clearAllStatus() {
    this.statusEffects = {
      burn: 0,
      poison: 0,
      vulnerable: 0,
      strength: 0,
      weak: 0,
      thorns: 0,
    };
  }

  /**
   * 回合结算状态效果
   * - 灼烧：扣血并 -1 层
   * - 中毒：扣血不衰减
   * - 易伤：-1 层
   * - 虚弱：-1 层
   * - 力量：永久，不衰减
   * - 反伤：永久，不衰减
   */
  tickStatusEffects() {
    const effects = this.statusEffects;
    // 状态伤害减免（如量子稳定器遗物，仅 Player 有效）
    const reduction = (typeof this.getRelicBonus === 'function')
      ? this.getRelicBonus('statusReduction')
      : 0;

    // 灼烧：扣血并 -1 层
    if (effects.burn > 0) {
      const burnDamage = Math.floor(effects.burn * (1 - reduction));
      this.hp = Math.max(0, this.hp - burnDamage);
      effects.burn = Math.max(0, effects.burn - 1);
    }
    // 中毒：扣血不衰减
    if (effects.poison > 0) {
      const poisonDamage = Math.floor(effects.poison * (1 - reduction));
      this.hp = Math.max(0, this.hp - poisonDamage);
    }
    // 易伤：-1 层
    if (effects.vulnerable > 0) {
      effects.vulnerable = Math.max(0, effects.vulnerable - 1);
    }
    // 虚弱：-1 层
    if (effects.weak > 0) {
      effects.weak = Math.max(0, effects.weak - 1);
    }
    // 力量：永久，不衰减
    // 反伤：永久，不衰减
  }

  /**
   * 承受伤害：护盾优先吸收，溢出部分扣减生命值
   * 易伤状态：受到伤害 ×1.5
   * 注意：力量层数应在攻击计算时加入，不由 takeDamage 处理
   */
  takeDamage(amount) {
    let finalDamage = amount;
    // 易伤状态：受到伤害 ×1.5
    if (this.getStatus('vulnerable') > 0) {
      finalDamage = Math.floor(finalDamage * 1.5);
    }
    const absorbed = Math.min(this.shield, finalDamage);
    this.shield -= absorbed;
    const remaining = finalDamage - absorbed;
    this.hp = Math.max(0, this.hp - remaining);
    return { absorbed, damageToHp: remaining, total: finalDamage };
  }

  addShield(amount) {
    this.shield += amount;
  }

  clearShield() {
    this.shield = 0;
  }

  get isAlive() {
    return this.hp > 0;
  }
}

/* ============================================================
 * 遗物（Relic）定义
 * ============================================================ */
const RELICS = {
  marsPowerCore: {
    id: 'marsPowerCore',
    name: '火星动力核心',
    desc: '最大生命值上限 +10',
    type: 'basic',
    color: 0xff6633,
    effect: { maxHpBonus: 10 },
  },
  thuliumBattery: {
    id: 'thuliumBattery',
    name: '铥元素电池',
    desc: '每回合初始电量 +1',
    type: 'epic',
    color: 0x33ccff,
    effect: { maxBatteryBonus: 1 },
  },
  hematiteAmulet: {
    id: 'hematiteAmulet',
    name: '赤铁护符',
    desc: '每回合开始获得 3 点护盾',
    type: 'basic',
    color: 0xaa3322,
    effect: { turnShield: 3 },
  },
  quantumStabilizer: {
    id: 'quantumStabilizer',
    name: '量子稳定器',
    desc: '灼烧/中毒伤害减半',
    type: 'rare',
    color: 0x9966ff,
    effect: { statusReduction: 0.5 },
  },
  deepSpaceMonocle: {
    id: 'deepSpaceMonocle',
    name: '深空目镜',
    desc: '每回合多抽 1 张牌',
    type: 'rare',
    color: 0x66ccff,
    effect: { extraDraw: 1 },
  },
  nanoRepairSwarm: {
    id: 'nanoRepairSwarm',
    name: '纳米修复蜂群',
    desc: '每回合恢复 2 点生命值',
    type: 'rare',
    color: 0x33ff99,
    effect: { turnHeal: 2 },
  },
  antimatterCore: {
    id: 'antimatterCore',
    name: '反物质核心',
    desc: '力量效果翻倍',
    type: 'epic',
    color: 0xff33ff,
    effect: { strengthDouble: true },
  },
  marsAncientRune: {
    id: 'marsAncientRune',
    name: '火星古老符文',
    desc: '药水效果翻倍',
    type: 'epic',
    color: 0xffaa33,
    effect: { potionDouble: true },
  },
};

/* ============================================================
 * 角色/职业定义
 * ============================================================ */
const CHARACTERS = {
  astronaut: {
    id: 'astronaut',
    name: '宇航员',
    title: '平衡的探索者',
    desc: 'HP 80 / 电量 3。初始牌组均衡，适合新手。每回合开始时 10% 概率获得 1 点护盾。',
    color: 0x4488cc,
    maxHp: 80,
    baseBattery: 3,
    starterDeck: [
      { def: 'laserShot', count: 4 },
      { def: 'overchargeBlast', count: 1 },
      { def: 'plasmaShield', count: 4 },
      { def: 'shieldMatrix', count: 1 },
    ],
    passive: 'astronautShield',
    sprite: 'player_astronaut',
  },
  engineer: {
    id: 'engineer',
    name: '工程兵',
    title: '护盾大师',
    desc: 'HP 70 / 电量 4。擅长护盾防御，初始牌组含护盾卡。出护盾卡时额外获得 2 点护盾。',
    color: 0x44aa66,
    maxHp: 70,
    baseBattery: 4,
    starterDeck: [
      { def: 'laserShot', count: 2 },
      { def: 'plasmaShield', count: 5 },
      { def: 'shieldMatrix', count: 2 },
      { def: 'nanoArmor', count: 1 },
    ],
    passive: 'engineerShieldBonus',
    sprite: 'player_engineer',
  },
  mutant: {
    id: 'mutant',
    name: '异变者',
    title: '状态操控者',
    desc: 'HP 75 / 电量 3。擅长灼烧和中毒，初始牌组含状态卡。施加状态效果时层数 +1。',
    color: 0xaa44aa,
    maxHp: 75,
    baseBattery: 3,
    starterDeck: [
      { def: 'laserShot', count: 3 },
      { def: 'plasmaBurn', count: 2 },
      { def: 'corrosiveFog', count: 2 },
      { def: 'plasmaShield', count: 2 },
      { def: 'sporeRelease', count: 1 },
    ],
    passive: 'mutantStatusBonus',
    sprite: 'player_mutant',
  },
  assault: {
    id: 'assault',
    name: '突击兵',
    title: '连击杀手',
    desc: 'HP 65 / 电量 3。低血量高输出，初始牌组含多段攻击。打出攻击卡时 15% 概率获得 1 点电量。',
    color: 0xcc4444,
    maxHp: 65,
    baseBattery: 3,
    starterDeck: [
      { def: 'laserShot', count: 5 },
      { def: 'overchargeBlast', count: 2 },
      { def: 'empCannon', count: 1 },
      { def: 'plasmaShield', count: 2 },
    ],
    passive: 'assaultEnergyChance',
    sprite: 'player_assault',
  },
};

/* ============================================================
 * 玩家类
 * ============================================================ */
class Player extends Entity {
  constructor(characterId = 'astronaut') {
    const charConfig = CHARACTERS[characterId] || CHARACTERS.astronaut;
    super(charConfig.name, charConfig.maxHp);
    this.characterId = charConfig.id;
    this.character = charConfig;
    this.baseBattery = charConfig.baseBattery;
    this.baseMaxHp = charConfig.maxHp;
    this.relics = [];
    this.damageTakenBonus = 0; // 本回合受到的伤害额外加值

    // maxHp 改为受遗物加成的计算属性
    Object.defineProperty(this, 'maxHp', {
      get() { return this.baseMaxHp + this.getRelicBonus('maxHpBonus'); },
      configurable: true,
      enumerable: true,
    });
  }

  /** 获取遗物提供的指定加成总和 */
  getRelicBonus(key) {
    return this.relics.reduce((sum, relic) => sum + (relic.effect[key] || 0), 0);
  }

  /** 当前最大电量（含遗物加成） */
  get maxBattery() {
    return this.baseBattery + this.getRelicBonus('maxBatteryBonus');
  }

  /** 获得遗物，同时按遗物效果调整当前状态 */
  addRelic(relic) {
    this.relics.push(relic);
    if (relic.effect.maxHpBonus) {
      this.hp = Math.min(this.maxHp, this.hp + relic.effect.maxHpBonus);
    }
  }

  /**
   * 获取力量效果倍率
   * 反物质核心遗物：力量效果翻倍
   */
  getStrengthMultiplier() {
    return this.relics.some(r => r.effect.strengthDouble) ? 2 : 1;
  }

  /**
   * 重置电量（每回合开始调用）
   * 注意：虚弱等临时状态由 tickStatusEffects 管理，不在此清除
   */
  resetBattery() {
    this.battery = this.maxBattery;
    this.damageTakenBonus = 0;
  }

  canPlay(cost) {
    return this.battery >= cost;
  }

  spendBattery(cost) {
    if (this.canPlay(cost)) {
      this.battery -= cost;
      return true;
    }
    return false;
  }
}

/* ============================================================
 * 敌人 AI 模式常量
 * ============================================================ */
const ENEMY_PATTERN = {
  FIXED: 'fixed',               // 固定伤害
  ALTERNATING: 'alternating',   // 交替行动
  RAMPING: 'ramping',           // 递增伤害
  BOSS_CHARGE: 'boss_charge',   // Boss蓄力
};

/* ============================================================
 * 敌人行动结果描述
 * ============================================================ */
class EnemyActionResult {
  constructor(type = 'none', value = 0, desc = '') {
    this.type = type;   // 'damage' | 'shield' | 'charge' | 'chargedAttack'
    this.value = value;
    this.desc = desc;   // 人类可读的描述
  }
}

/* ============================================================
 * 敌人图鉴（数据驱动，新增敌人只需在这里注册）
 * ============================================================ */
const ENEMY_CATALOG = {
  marsLeech: {
    key: 'marsLeech',
    name: '火星幼蛭',
    sprite: 'enemy_mars_leech',
    maxHp: 28,
    pattern: ENEMY_PATTERN.FIXED,
    fixedDamage: 6,
  },
  duneStalker: {
    key: 'duneStalker',
    name: '沙丘跃行者',
    sprite: 'enemy_dune_stalker',
    maxHp: 34,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'shield', value: 5 },
      { type: 'damage', value: 9 },
    ],
  },
  redCrawler: {
    key: 'redCrawler',
    name: '红土爬行者',
    sprite: 'enemy_red_crawler',
    maxHp: 46,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'damage', value: 11, statusEffect: { type: 'vulnerable', stacks: 1 } },
      { type: 'shield', value: 8 },
    ],
  },
  crystalParasite: {
    key: 'crystalParasite',
    name: '晶化寄生虫',
    sprite: 'enemy_crystal_parasite',
    maxHp: 40,
    pattern: ENEMY_PATTERN.RAMPING,
    baseDamage: 5,
    damageIncrement: 3,
    statusEffect: { type: 'poison', stacks: 1 },
  },
  deepLurker: {
    key: 'deepLurker',
    name: '地底潜伏者',
    sprite: 'enemy_deep_lurker',
    maxHp: 55,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'shield', value: 15 },
      { type: 'damage', value: 14, statusEffect: { type: 'burn', stacks: 2 } },
    ],
  },
  lavaSpider: {
    key: 'lavaSpider',
    name: '熔岩蜘蛛',
    sprite: 'enemy_lava_spider',
    maxHp: 32,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'damage', value: 3, statusEffect: { type: 'burn', stacks: 1 } },
      { type: 'damage', value: 3, statusEffect: { type: 'burn', stacks: 1 } },
    ],
  },
  gravityWarp: {
    key: 'gravityWarp',
    name: '引力扭曲者',
    sprite: 'enemy_gravity_warp',
    maxHp: 38,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'damage', value: 8, statusEffect: { type: 'weak', stacks: 1 } },
      { type: 'shield', value: 6 },
    ],
  },
  /* ---------- 新增普通敌人 ---------- */
  magmaGolem: {
    key: 'magmaGolem',
    name: '岩浆魔像',
    sprite: 'enemy_magma_golem',
    maxHp: 50,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'shield', value: 10 },
      { type: 'damage', value: 12, statusEffect: { type: 'burn', stacks: 2 } },
    ],
  },
  voidLeech: {
    key: 'voidLeech',
    name: '虚空蛭',
    sprite: 'enemy_void_leech',
    maxHp: 36,
    pattern: ENEMY_PATTERN.RAMPING,
    baseDamage: 4,
    damageIncrement: 2,
    statusEffect: { type: 'weak', stacks: 1 },
  },
  quantumSpecter: {
    key: 'quantumSpecter',
    name: '量子幽灵',
    sprite: 'enemy_quantum_specter',
    maxHp: 42,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'damage', value: 7, statusEffect: { type: 'vulnerable', stacks: 2 } },
      { type: 'shield', value: 5 },
    ],
  },
  /* ---------- 新增精英敌人（高难度高奖励） ---------- */
  ancientGuardian: {
    key: 'ancientGuardian',
    name: '远古守护者',
    sprite: 'enemy_ancient_guardian',
    maxHp: 68,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'shield', value: 18 },
      { type: 'damage', value: 16, statusEffect: { type: 'vulnerable', stacks: 2 } },
    ],
    isElite: true,
  },
  plasmaHydra: {
    key: 'plasmaHydra',
    name: '等离子九头蛇',
    sprite: 'enemy_plasma_hydra',
    maxHp: 62,
    pattern: ENEMY_PATTERN.RAMPING,
    baseDamage: 6,
    damageIncrement: 4,
    statusEffect: { type: 'burn', stacks: 2 },
    isElite: true,
  },
  voidReaper: {
    key: 'voidReaper',
    name: '虚空收割者',
    sprite: 'enemy_void_reaper',
    maxHp: 58,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'damage', value: 13, statusEffect: { type: 'weak', stacks: 2 } },
      { type: 'damage', value: 13, statusEffect: { type: 'vulnerable', stacks: 2 } },
    ],
    isElite: true,
  },
  marsDevourer: {
    key: 'marsDevourer',
    name: '火星吞噬者',
    sprite: 'enemy_mars_devourer',
    maxHp: 70,
    pattern: ENEMY_PATTERN.BOSS_CHARGE,
    chargeTurns: 2,
    chargeDamage: 26,
    statusEffect: [
      { type: 'vulnerable', stacks: 3 },
      { type: 'burn', stacks: 2 },
    ],
    // 阶段2配置（HP < 50% 时触发）
    phase2: {
      threshold: 0.5,
      name: '火星吞噬者 · 狂暴',
      chargeTurns: 1,          // 蓄力回合缩短
      chargeDamage: 30,        // 伤害提升
      statusEffect: [
        { type: 'vulnerable', stacks: 3 },
        { type: 'burn', stacks: 3 },
        { type: 'weak', stacks: 1 },
      ],
    },
  },
  sandTyrant: {
    key: 'sandTyrant',
    name: '沙暴暴君',
    sprite: 'enemy_dune_stalker',
    maxHp: 60,
    pattern: ENEMY_PATTERN.ALTERNATING,
    actions: [
      { type: 'shield', value: 10 },
      { type: 'damage', value: 12, statusEffect: { type: 'vulnerable', stacks: 2 } },
      { type: 'damage', value: 8 },
    ],
    phase2: {
      threshold: 0.5,
      name: '沙暴暴君 · 狂暴',
      actions: [
        { type: 'shield', value: 6 },
        { type: 'damage', value: 16, statusEffect: { type: 'vulnerable', stacks: 2 } },
        { type: 'damage', value: 10, statusEffect: { type: 'weak', stacks: 1 } },
      ],
    },
  },
  crystalTitan: {
    key: 'crystalTitan',
    name: '晶化巨像',
    sprite: 'enemy_crystal_parasite',
    maxHp: 75,
    pattern: ENEMY_PATTERN.RAMPING,
    baseDamage: 6,
    damageIncrement: 2,
    statusEffect: { type: 'poison', stacks: 2 },
    phase2: {
      threshold: 0.5,
      name: '晶化巨像 · 狂暴',
      baseDamage: 8,
      damageIncrement: 3,
      statusEffect: { type: 'poison', stacks: 3 },
    },
  },
};

/* ============================================================
 * 敌人类（支持多种 AI 模式）
 * ============================================================ */
class Enemy extends Entity {
  /**
   * @param {object} config
   *   name          - 敌人名称
   *   maxHp         - 最大生命值
   *   pattern       - ENEMY_PATTERN 之一
   *   fixedDamage   - FIXED 模式下固定伤害值
   *   actions       - ALTERNATING 模式下行动列表 [{type, value, statusEffect?}, ...]
   *   baseDamage    - RAMPING 模式下起始伤害
   *   damageIncrement - RAMPING 模式下每回合递增
   *   chargeTurns   - BOSS_CHARGE 模式下蓄力回合数
   *   chargeDamage  - BOSS_CHARGE 模式下蓄满后伤害
   *   statusEffect  - RAMPING/BOSS_CHARGE 模式下攻击附带的状态效果
   */
  constructor(config) {
    super(config.name, config.maxHp);
    this.key = config.key || null;
    this.sprite = config.sprite || null;
    this.pattern = config.pattern;
    this.turnCount = 0;

    // FIXED
    this.fixedDamage = config.fixedDamage || 0;

    // ALTERNATING
    this.actions = config.actions || [];

    // RAMPING
    this.baseDamage = config.baseDamage || 0;
    this.damageIncrement = config.damageIncrement || 0;

    // BOSS_CHARGE
    this.chargeTurns = config.chargeTurns || 0;
    this.chargeDamage = config.chargeDamage || 0;
    this.currentCharge = 0;

    // 攻击附带的状态效果（RAMPING / BOSS_CHARGE 模式）
    this.attackStatusEffect = config.statusEffect || null;

    // 阶段切换配置（Boss 专属）
    this.phase2Config = config.phase2 || null;
    this.phase = 1; // 当前阶段（1 或 2）
    this.originalName = this.name;
  }

  /** 检查是否需要切换到阶段2，返回是否发生了切换 */
  checkPhaseTransition() {
    if (this.phase !== 1 || !this.phase2Config) return false;
    const threshold = this.maxHp * this.phase2Config.threshold;
    if (this.hp <= threshold) {
      this.switchToPhase2();
      return true;
    }
    return false;
  }

  /** 切换到阶段2：更新属性和技能 */
  switchToPhase2() {
    this.phase = 2;
    const p2 = this.phase2Config;
    this.name = p2.name || (this.originalName + ' · 狂暴');

    // 更新 BOSS_CHARGE 属性
    if (p2.chargeTurns !== undefined) this.chargeTurns = p2.chargeTurns;
    if (p2.chargeDamage !== undefined) this.chargeDamage = p2.chargeDamage;

    // 更新 ALTERNATING 行动
    if (p2.actions) this.actions = p2.actions;

    // 更新 RAMPING 属性
    if (p2.baseDamage !== undefined) this.baseDamage = p2.baseDamage;
    if (p2.damageIncrement !== undefined) this.damageIncrement = p2.damageIncrement;

    // 更新状态效果
    if (p2.statusEffect) this.attackStatusEffect = p2.statusEffect;

    // 重置蓄力计数
    this.currentCharge = 0;
  }

  /** 从图鉴 key 快速创建敌人实例 */
  static fromCatalog(catalogKey) {
    const data = ENEMY_CATALOG[catalogKey];
    if (!data) {
      throw new Error(`Enemy catalog key not found: ${catalogKey}`);
    }
    return new Enemy(data);
  }

  /** 获取敌人意图描述（用于 UI 显示） */
  getIntentDescription() {
    switch (this.pattern) {
      case ENEMY_PATTERN.FIXED:
        return `造成 ${this.fixedDamage} 点伤害`;

      case ENEMY_PATTERN.ALTERNATING: {
        const idx = this.turnCount % this.actions.length;
        const action = this.actions[idx];
        const statusDesc = action.statusEffect ? describeStatusEffect(action.statusEffect) : '';
        if (action.type === 'damage') return `攻击！造成 ${action.value} 点伤害${statusDesc}`;
        if (action.type === 'shield') return `防御！获得 ${action.value} 点护盾`;
        return '未知行动';
      }

      case ENEMY_PATTERN.RAMPING: {
        const dmg = this.baseDamage + this.turnCount * this.damageIncrement;
        const statusDesc = this.attackStatusEffect ? describeStatusEffect(this.attackStatusEffect) : '';
        return `造成 ${dmg} 点伤害（递增）${statusDesc}`;
      }

      case ENEMY_PATTERN.BOSS_CHARGE: {
        const remaining = this.chargeTurns - this.currentCharge;
        if (remaining > 0) {
          return `蓄力中... (${remaining}/${this.chargeTurns})`;
        }
        const statusDesc = this.attackStatusEffect ? describeStatusEffect(this.attackStatusEffect) : '';
        return `◆ 致命一击！${this.chargeDamage} 点伤害 ◆${statusDesc}`;
      }

      default:
        return '待机';
    }
  }

  /** 获取本回合的实际伤害数值（用于受击震屏参考） */
  getCurrentDamage() {
    switch (this.pattern) {
      case ENEMY_PATTERN.FIXED:
        return this.fixedDamage;
      case ENEMY_PATTERN.ALTERNATING: {
        const idx = this.turnCount % this.actions.length;
        return this.actions[idx].type === 'damage' ? this.actions[idx].value : 0;
      }
      case ENEMY_PATTERN.RAMPING:
        return this.baseDamage + this.turnCount * this.damageIncrement;
      case ENEMY_PATTERN.BOSS_CHARGE: {
        const remaining = this.chargeTurns - this.currentCharge;
        return remaining > 0 ? 0 : this.chargeDamage;
      }
      default:
        return 0;
    }
  }

  /** 执行敌人回合行动，返回行动结果 */
  executeTurn(player) {
    this.turnCount++;
    const result = new EnemyActionResult();

    /**
     * 对玩家造成伤害
     * @param {number} baseDamage - 基础伤害
     * @param {object|array|null} statusEffect - 攻击附带的状态效果
     * @returns {number} 实际造成的总伤害
     */
    const dealDamage = (baseDamage, statusEffect = null) => {
      const bonus = player.damageTakenBonus || 0;
      // 力量层数加成（攻击方）
      const strengthStacks = this.getStatus('strength');
      let totalDamage = baseDamage + bonus + strengthStacks;
      // 虚弱：攻击伤害 -25%
      if (this.getStatus('weak') > 0) {
        totalDamage = Math.floor(totalDamage * 0.75);
      }
      player.takeDamage(totalDamage);
      // 反伤：玩家受到攻击时，敌人受到反伤层数的伤害
      const playerThorns = player.getStatus('thorns');
      if (playerThorns > 0) {
        this.hp = Math.max(0, this.hp - playerThorns);
      }
      // 施加状态效果
      if (statusEffect) {
        const effects = Array.isArray(statusEffect) ? statusEffect : [statusEffect];
        for (const eff of effects) {
          player.addStatus(eff.type, eff.stacks);
        }
      }
      return { damage: totalDamage, thornsDamage: playerThorns };
    };

    switch (this.pattern) {
      case ENEMY_PATTERN.FIXED: {
        const dmgResult = dealDamage(this.fixedDamage);
        result.type = 'damage';
        result.value = dmgResult.damage;
        result.thornsDamage = dmgResult.thornsDamage;
        result.desc = `${this.name} 造成 ${dmgResult.damage} 点伤害` +
          (dmgResult.thornsDamage > 0 ? `（反伤 ${dmgResult.thornsDamage}）` : '');
        break;
      }

      case ENEMY_PATTERN.ALTERNATING: {
        const idx = (this.turnCount - 1) % this.actions.length;
        const action = this.actions[idx];
        if (action.type === 'damage') {
          const dmgResult = dealDamage(action.value, action.statusEffect || null);
          result.type = 'damage';
          result.value = dmgResult.damage;
          result.thornsDamage = dmgResult.thornsDamage;
          const statusDesc = action.statusEffect ? describeStatusEffect(action.statusEffect) : '';
          result.desc = `${this.name} 造成 ${dmgResult.damage} 点伤害${statusDesc}` +
            (dmgResult.thornsDamage > 0 ? `（反伤 ${dmgResult.thornsDamage}）` : '');
        } else if (action.type === 'shield') {
          result.type = 'shield';
          result.value = action.value;
          result.desc = `${this.name} 获得 ${action.value} 点护盾`;
          this.addShield(action.value);
        }
        break;
      }

      case ENEMY_PATTERN.RAMPING: {
        const baseDmg = this.baseDamage + (this.turnCount - 1) * this.damageIncrement;
        const dmgResult = dealDamage(baseDmg, this.attackStatusEffect);
        result.type = 'damage';
        result.value = dmgResult.damage;
        result.thornsDamage = dmgResult.thornsDamage;
        const statusDesc = this.attackStatusEffect ? describeStatusEffect(this.attackStatusEffect) : '';
        result.desc = `${this.name} 造成 ${dmgResult.damage} 点伤害${statusDesc}` +
          (dmgResult.thornsDamage > 0 ? `（反伤 ${dmgResult.thornsDamage}）` : '');
        break;
      }

      case ENEMY_PATTERN.BOSS_CHARGE: {
        if (this.currentCharge < this.chargeTurns) {
          this.currentCharge++;
          const remaining = this.chargeTurns - this.currentCharge;
          result.type = 'charge';
          result.value = 0;
          result.desc = `${this.name} 正在蓄力... (${this.currentCharge}/${this.chargeTurns})`;
        } else {
          const dmgResult = dealDamage(this.chargeDamage, this.attackStatusEffect);
          result.type = 'chargedAttack';
          result.value = dmgResult.damage;
          result.thornsDamage = dmgResult.thornsDamage;
          const statusDesc = this.attackStatusEffect ? describeStatusEffect(this.attackStatusEffect) : '';
          result.desc = `★ ${this.name} 释放致命一击！造成 ${dmgResult.damage} 点伤害 ★${statusDesc}` +
            (dmgResult.thornsDamage > 0 ? `（反伤 ${dmgResult.thornsDamage}）` : '');
          // 重置蓄力，开始新一轮
          this.currentCharge = 0;
        }
        break;
      }

      default:
        result.type = 'none';
        result.value = 0;
        result.desc = `${this.name} 什么都没做`;
    }

    return result;
  }
}

/* ============================================================
 * 深度关卡配置
 * ============================================================ */
const DEPTH_LEVELS = [
  {
    key: 'surface',
    name: '地表',
    depth: '0m',
    label: '地表 — 0m',
    color: 0xdd7733,
    bgColor: 0x1a0808,
    miniBoss: 'sandTyrant',
  },
  {
    key: 'shallow',
    name: '地下浅层',
    depth: '500m',
    label: '地下浅层 — 500m',
    color: 0xcc4422,
    bgColor: 0x1a0a06,
    miniBoss: 'crystalTitan',
  },
  {
    key: 'core',
    name: '地核深处',
    depth: '2000m',
    label: '地核深处 — 2000m',
    color: 0xcc2211,
    bgColor: 0x1a0404,
    miniBoss: 'marsDevourer',
  },
];

/* ============================================================
 * 关卡敌人配置（数据驱动）
 * pick: 0 表示顺序出现，1 表示从中随机选取一个
 * ============================================================ */
const LEVEL_ENEMY_CONFIG = [
  { catalogKeys: ['marsLeech', 'duneStalker', 'lavaSpider'], pick: 1 },
  { catalogKeys: ['redCrawler', 'crystalParasite', 'gravityWarp', 'voidLeech', 'quantumSpecter', 'magmaGolem'], pick: 1 },
  { catalogKeys: ['deepLurker', 'magmaGolem', 'quantumSpecter'], pick: 1 },
];

/* ============================================================
 * 精英敌人池（用于精英战斗节点）
 * ============================================================ */
const ELITE_ENEMY_KEYS = ['ancientGuardian', 'plasmaHydra', 'voidReaper'];

/** 随机生成一个精英敌人 */
function buildEliteEnemy() {
  const key = ELITE_ENEMY_KEYS[Math.floor(Math.random() * ELITE_ENEMY_KEYS.length)];
  return Enemy.fromCatalog(key);
}

/* ============================================================
 * 敌人池配置（按关卡索引）
 * 返回一个敌人实例数组。最后一关特殊：先出小Boss再出大Boss。
 * ============================================================ */
function buildEnemyForLevel(levelIndex) {
  const config = LEVEL_ENEMY_CONFIG[levelIndex];
  if (!config) {
    throw new Error(`No enemy config for level index: ${levelIndex}`);
  }

  const enemies = [];

  if (config.pick === 1) {
    const key = config.catalogKeys[Math.floor(Math.random() * config.catalogKeys.length)];
    enemies.push(Enemy.fromCatalog(key));
  } else {
    for (const key of config.catalogKeys) {
      enemies.push(Enemy.fromCatalog(key));
    }
  }

  return enemies;
}

/** 创建最终 Boss：火星吞噬者 */
function buildFinalBoss() {
  return Enemy.fromCatalog('marsDevourer');
}
