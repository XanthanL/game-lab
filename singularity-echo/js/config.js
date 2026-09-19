/**
 * Singularity Echo - Configuration System Module
 * 
 * Centralized configuration management for all game data.
 * Replaces hardcoded values with structured config files.
 * Provides validation, defaults, and runtime overrides.
 * 
 * @module config
 */

'use strict';

/**
 * Configuration loader with validation and defaults
 */
class ConfigLoader {
  constructor() {
    this.configs = new Map();
    this.defaultConfig = {};
  }

  /**
   * Load a configuration object from source (or use default)
   * @template T
   * @param {string} key - Config identifier
   * @param {T} defaultValues - Default configuration values
   * @param {Object} [source] - Optional source (e.g., file, API)
   * @returns {T} Validated configuration
   */
  load(key, defaultValues, source = null) {
    if (this.configs.has(key)) {
      return { ...defaultValues, ...(source || {}) };
    }

    const validated = this.validate(key, defaultValues, source);
    this.configs.set(key, validated);
    return validated;
  }

  /**
   * Validate configuration against schema
   * @private
   * @param {string} key - Config key
   * @param {Object} defaults - Default values
   * @param {Object} source - Source values
   * @returns {Object} Merged validated config
   */
  validate(key, defaults, source) {
    const result = { ...defaults };
    
    if (source) {
      for (const [propPath, value] of Object.entries(source)) {
        this.deepSet(result, propPath, value);
      }
    }
    
    return result;
  }

  /**
   * Deep merge properties using dot notation paths
   * @private
   * @param {Object} obj - Target object
   * @param {string} path - Dot-notation path (e.g., "boss.hydra.hp")
   * @param {*} value - Value to set
   */
  deepSet(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = /^[0-9]+$/.test(parts[i + 1]) ? [] : {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Get configuration value by path
   * @param {string} key - Config key
   * @param {string} path - Dot-notation path
   * @param {*} fallback - Fallback value
   * @returns {*} Configuration value
   */
  get(key, path, fallback = undefined) {
    const config = this.configs.get(key);
    if (!config) return fallback;

    if (path) {
      const parts = path.split('.');
      let value = config;
      
      for (const part of parts) {
        if (value === undefined || value === null) {
          return fallback;
        }
        value = value[part];
      }
      
      return value ?? fallback;
    }

    return config;
  }

  /**
   * Update a configuration value
   * @param {string} key - Config key
   * @param {string} path - Dot-notation path
   * @param {*} value - New value
   */
  set(key, path, value) {
    const config = this.configs.get(key);
    if (config) {
      this.deepSet(config, path, value);
    }
  }

  /**
   * Clear cached configurations
   */
  clear() {
    this.configs.clear();
  }
}

// Singleton instance
const configLoader = new ConfigLoader();

// ============================================
// Default Configuration Definitions
// ============================================

/**
 * Wave difficulty scaling parameters (Phase 15+)
 */
export const WAVE_SCALING = {
  hpGrowth: 0.12,        // 每波敌人 HP 增长 12%
  damageGrowth: 0.10,   // 每波伤害增长 10%
  spawnRateReduction: 0.03, // 每波生成间隔减少 3%
  minSpawnInterval: 0.5  // 最短生成间隔（秒）
};

/**
 * Shield system configuration (Phase 15+)
 */
export const SHIELD_CONFIG = {
  baseShield: 20,
  shieldRechargeRate: 0.5,        // 每秒恢复量
  shieldBreakCooldown: 1.0,       // 破碎后冷却时间（秒）
  maxShield: 150,                 // 最大护盾值
  hitInvincibility: 0.2,          // 受击无敌时间（秒）
  damageThreshold: 10,            // 低于此值的伤害不会触发硬直
  hardKnockbackDuration: 0.3      // 硬直时间（秒）
};

/**
 * Boss phase configurations (Phase 16+)
 */
export const BOSS_PHASE_CONFIGS = {
  hydra: {
    phases: [
      {
        percentage: 1.0,
        name: { zh: '深渊海德拉', en: 'Abyssal Hydra' },
        hpMultiplier: 1.0,
        attacks: ['spiral', 'burst'],
        movement: 'hover',
        color: '#a855f7'
      },
      {
        percentage: 0.7,
        name: { zh: '扭曲形态', en: 'Twisted Form' },
        hpMultiplier: 0.8,
        attacks: ['spiral', 'burst', 'spread'],
        movement: 'sineWave',
        color: '#c026d3'
      },
      {
        percentage: 0.4,
        name: { zh: '完全体', en: 'True Form' },
        hpMultiplier: 0.6,
        attacks: ['spiral', 'burst', 'spread', 'ultimate'],
        movement: 'orbit',
        color: '#e879f9'
      }
    ]
  },
  colossus: {
    phases: [
      {
        percentage: 1.0,
        name: { zh: '巨神壁垒', en: 'Colossal Bastion' },
        hpMultiplier: 1.0,
        attacks: ['heavy_shield', 'tsunami'],
        movement: 'slow_advance',
        color: '#f59e0b'
      },
      {
        percentage: 0.6,
        name: { zh: '震地猛击', en: 'Earth Shaker' },
        hpMultiplier: 0.7,
        attacks: ['heavy_shield', 'tsunami', 'earthquake'],
        movement: 'aggressive_chase',
        color: '#fb923c'
      }
    ]
  },
  nebula: {
    phases: [
      {
        percentage: 1.0,
        name: { zh: '星云守护者', en: 'Nebula Guardian' },
        hpMultiplier: 1.0,
        attacks: ['phaseray', 'singularity'],
        movement: 'teleport_hover',
        color: '#3b82f6'
      },
      {
        percentage: 0.5,
        name: { zh: '黑洞核心', en: 'Black Hole Core' },
        hpMultiplier: 0.5,
        attacks: ['phaseray', 'singularity', 'event_horizon'],
        movement: 'chaotic_orbit',
        color: '#8b5cf6'
      }
    ]
  }
};

/**
 * Difficulty presets
 */
export const DIFFICULTIES = {
  standard: {
    id: 'standard',
    hpMult: 1.0,
    dmgMult: 1.0,
    spdMult: 1.0,
    cntMult: 1.0,
    scoreMult: 1.0,
    label: { zh: '标准', en: 'Standard' },
    desc: { zh: '正常难度', en: 'Normal difficulty' },
    unlockReq: 0
  },
  hard: {
    id: 'hard',
    hpMult: 1.5,
    dmgMult: 1.3,
    spdMult: 1.2,
    cntMult: 1.1,
    scoreMult: 1.5,
    label: { zh: '困难', en: 'Hard' },
    desc: { zh: '更具挑战性', en: 'More challenging' },
    unlockReq: 10000
  },
  insane: {
    id: 'insane',
    hpMult: 2.5,
    dmgMult: 2.0,
    spdMult: 1.5,
    cntMult: 1.3,
    scoreMult: 2.5,
    label: { zh: '癫狂', en: 'Insane' },
    desc: { zh: '极限挑战', en: 'Extreme challenge' },
    unlockReq: 50000
  }
};

/**
 * Boss configurations
 */
export const BOSS_CONFIGS = {
  hydra: {
    type: 'boss',
    name: { zh: '九头蛇', en: 'Hydra' },
    hp: { standard: 5000, hard: 7500, insane: 12500 },
    phases: 3,
    attackPatterns: ['spiral', 'burst', 'multi'],
    weakPoints: 3,
    drops: ['core', 'upgrade'],
    firstSeenWave: 5
  },
  colossus: {
    type: 'boss',
    name: { zh: '星之巨像', en: 'Colossus' },
    hp: { standard: 8000, hard: 12000, insane: 20000 },
    phases: 4,
    attackPatterns: ['beam', 'orbit', 'meteor'],
    weakPoints: 5,
    drops: ['heavy_weapon', 'shield'],
    firstSeenWave: 10
  },
  nebula: {
    type: 'boss',
    name: { zh: '星云领主', en: 'Nebula Lord' },
    hp: { standard: 6000, hard: 9000, insane: 15000 },
    phases: 3,
    attackPatterns: ['swarm', 'void', 'singularity'],
    weakPoints: 4,
    drops: ['teleport', 'time_slow'],
    firstSeenWave: 15
  }
};

/**
 * Enemy templates
 */
export const ENEMY_TEMPLATES = {
  wraith: {
    type: 'enemy',
    name: { zh: '幽灵', en: 'Wraith' },
    hp: 100,
    speed: 1.5,
    damage: 10,
    size: 20,
    behavior: 'chase',
    attacks: ['laser'],
    dropTable: [
      { item: 'energy', chance: 0.8, amount: [1, 3] },
      { item: 'dust', chance: 0.3, amount: [1, 2] }
    ]
  },
  tadpole: {
    type: 'enemy',
    name: { zh: '蝌蚪', en: 'Tadpole' },
    hp: 80,
    speed: 2.5,
    damage: 8,
    size: 15,
    behavior: 'follow',
    attacks: ['bite'],
    dropTable: [
      { item: 'energy', chance: 1.0, amount: [1, 2] }
    ]
  },
  drifter: {
    type: 'enemy',
    name: { zh: '漂流者', en: 'Drifter' },
    hp: 150,
    speed: 1.0,
    damage: 15,
    size: 30,
    behavior: 'circle',
    attacks: ['mine', 'dash'],
    dropTable: [
      { item: 'energy', chance: 0.9, amount: [2, 4] },
      { item: 'metal', chance: 0.4, amount: [1, 1] }
    ]
  }
};

/**
 * Hull (ship) configurations
 */
export const HULL_CONFIGS = {
  peregrine: {
    id: 'peregrine',
    name: { zh: '隼', en: 'Peregrine' },
    description: { zh: '快速灵活的侦查机', en: 'Fast and agile scout' },
    baseStats: {
      hp: 100,
      maxHp: 100,
      damage: 10,
      fireRate: 1.0,
      maxSpeed: 4.0,
      shieldMax: 50,
      regen: 0.5,
      magnet: 100
    },
    startingModules: ['pulse_cannon'],
    unlockCost: 0,
    style: {
      primaryColor: 'cyan',
      trailColor: '#56b4e9'
    }
  },
  rapier: {
    id: 'rapier',
    name: { zh: '轻剑', en: 'Rapier' },
    description: { zh: '均衡的多用途战机', en: 'Balanced multi-role fighter' },
    baseStats: {
      hp: 120,
      maxHp: 120,
      damage: 12,
      fireRate: 0.9,
      maxSpeed: 3.5,
      shieldMax: 60,
      regen: 0.4,
      magnet: 120
    },
    startingModules: ['blaster'],
    unlockCost: 5000,
    style: {
      primaryColor: 'amber',
      trailColor: '#c08a3e'
    }
  },
  bulwark: {
    id: 'bulwark',
    name: { zh: '壁垒', en: 'Bulwark' },
    description: { zh: '重型防御战机', en: 'Heavy defense fighter' },
    baseStats: {
      hp: 180,
      maxHp: 180,
      damage: 6,
      fireRate: 0.7,
      maxSpeed: 2.5,
      shieldMax: 120,
      regen: 0.3,
      magnet: 80
    },
    startingModules: ['heavy_cannon'],
    unlockCost: 15000,
    style: {
      primaryColor: 'hp-a',
      trailColor: '#4a7c59'
    }
  },
  raven: {
    id: 'raven',
    name: { zh: '渡鸦', en: 'Raven' },
    description: { zh: '暗影突击战机', en: 'Shadow assault fighter' },
    baseStats: {
      hp: 90,
      maxHp: 90,
      damage: 14,
      fireRate: 1.3,
      maxSpeed: 4.5,
      shieldMax: 40,
      regen: 0.6,
      magnet: 150
    },
    startingModules: ['photon_blaster'],
    unlockCost: 25000,
    style: {
      primaryColor: 'violet',
      trailColor: '#9a7aab'
    }
  },
  swarm: {
    id: 'swarm',
    name: { zh: '蜂群', en: 'Swarm' },
    description: { zh: '多管炮台战机', en: 'Multi-barrel turret' },
    baseStats: {
      hp: 110,
      maxHp: 110,
      damage: 11,
      fireRate: 1.5,
      maxSpeed: 3.0,
      shieldMax: 50,
      regen: 0.35,
      magnet: 100
    },
    startingModules: ['gatling'],
    unlockCost: 20000,
    style: {
      primaryColor: 'foe',
      trailColor: '#ff3b5c'
    }
  },
  nemesis: {
    id: 'nemesis',
    name: { zh: '回响', en: 'Nemesis' },
    description: { zh: '终极奇点战机', en: 'Ultimate singularity fighter' },
    baseStats: {
      hp: 200,
      maxHp: 200,
      damage: 20,
      fireRate: 1.2,
      maxSpeed: 5.0,
      shieldMax: 100,
      regen: 0.8,
      magnet: 200
    },
    startingModules: ['singularity_cannon', 'quantum_shield'],
    unlockCost: 100000,
    style: {
      primaryColor: 'white',
      trailColor: '#e8e2d4'
    },
    secret: true
  }
};

/**
 * Modifiers/Challenges
 */
export const MODIFIERS = {
  ironman: {
    id: 'ironman',
    name: { zh: '铁人模式', en: 'Ironman' },
    description: { zh: '单次死亡即删除存档', en: 'One life only' },
    effect: (state) => { state.permadeath = true; },
    unlockReq: 10000
  },
  no_shields: {
    id: 'no_shields',
    name: { zh: '破盾', en: 'No Shields' },
    description: { zh: '禁用护盾', en: 'Shields disabled' },
    effect: (state) => { state.shieldMax = 0; },
    unlockReq: 5000
  },
  slow_mo: {
    id: 'slow_mo',
    name: { zh: '时间减缓', en: 'Slow Mo' },
    description: { zh: '敌人速度降低 50%', en: 'Enemies move at 50% speed' },
    effect: (state) => { state.enemySpeedMult = 0.5; },
    unlockReq: 0
  },
  bullet_time: {
    id: 'bullet_time',
    name: { zh: '子弹时间', en: 'Bullet Time' },
    description: { zh: '玩家视野内时间减半', en: 'Time halved in player FOV' },
    effect: (state) => { state.playerTimeScale = 0.5; },
    unlockReq: 20000
  }
};

/**
 * Modules/Upgrades
 */
export const MODULE_TEMPLATES = {
  pulse_cannon: {
    id: 'pulse_cannon',
    name: { zh: '脉冲加农', en: 'Pulse Cannon' },
    description: { zh: '基础武器：连续能量射弹', en: 'Basic weapon: continuous energy projectiles' },
    type: 'weapon',
    cost: 0,
    maxLevel: 6,
    statMods: {
      fireRate: 0.05,
      dmg: 2.0
    }
  },
  blaster: {
    id: 'blaster',
    name: { zh: '爆裂炮', en: 'Blaster' },
    description: { zh: '高伤害但射速较慢', en: 'High damage but slow fire rate' },
    type: 'weapon',
    cost: 100,
    maxLevel: 5,
    statMods: {
      dmg: 5.0,
      fireRate: -0.1
    }
  },
  heavy_cannon: {
    id: 'heavy_cannon',
    name: { zh: '重炮', en: 'Heavy Cannon' },
    description: { zh: '慢速但穿透的轨道炮', en: 'Slow but piercing railgun' },
    type: 'weapon',
    cost: 200,
    maxLevel: 5,
    statMods: {
      dmg: 10.0,
      pierce: 1,
      fireRate: -0.15
    }
  },
  gatling: {
    id: 'gatling',
    name: { zh: '加特林', en: 'Gatling' },
    description: { zh: '超高射速的旋转炮', en: 'Ultra-high fire rate rotary cannon' },
    type: 'weapon',
    cost: 150,
    maxLevel: 6,
    statMods: {
      fireRate: 0.2,
      dmg: 0.5
    }
  },
  homing_missiles: {
    id: 'homing_missiles',
    name: { zh: '制导导弹', en: 'Homing Missiles' },
    description: { zh: '自动追踪的火箭弹', en: 'Auto-tracking rockets' },
    type: 'ability',
    cost: 300,
    maxLevel: 4,
    statMods: {
      homing: 1,
      homeR: 100
    }
  },
  tesla_coil: {
    id: 'tesla_coil',
    name: { zh: '特斯拉线圈', en: 'Tesla Coil' },
    description: { zh: '连锁闪电能力', en: 'Chain lightning ability' },
    type: 'ability',
    cost: 350,
    maxLevel: 4,
    statMods: {
      tesla: 1,
      teslaCd: 2.0
    }
  },
  mine_layer: {
    id: 'mine_layer',
    name: { zh: '雷区', en: 'Mine Layer' },
    description: { zh: '身后留下爆炸地雷', en: 'Leaves explosive mines behind' },
    type: 'ability',
    cost: 250,
    maxLevel: 5,
    statMods: {
      mine: 1,
      minePow: 1.5
    }
  },
  nova_burst: {
    id: 'nova_burst',
    name: { zh: '新星爆发', en: 'Nova Burst' },
    description: { zh: '周期性大范围冲击波', en: 'Periodic area-of-effect burst' },
    type: 'ability',
    cost: 400,
    maxLevel: 5,
    statMods: {
      nova: 1,
      novaR: 200,
      novaCd: 8.0
    }
  },
  shield_boost: {
    id: 'shield_boost',
    name: { zh: '护盾增强', en: 'Shield Boost' },
    description: { zh: '增加最大护盾值和回复速度', en: 'Increases max shield and regen rate' },
    type: 'stat',
    cost: 100,
    maxLevel: 6,
    statMods: {
      shieldMax: 20,
      regen: 0.1
    }
  },
  magnet_range: {
    id: 'magnet_range',
    name: { zh: '磁力范围', en: 'Magnet Range' },
    description: { zh: '扩大拾取范围', en: 'Increases pickup range' },
    type: 'stat',
    cost: 80,
    maxLevel: 5,
    statMods: {
      magnet: 25
    }
  }
};

/**
 * Affixes (world modifiers)
 */
export const AFFIXES = {
  elite: {
    id: 'elite',
    name: { zh: '精英', en: 'Elite' },
    description: { zh: '强化敌人', en: 'Buffed enemies' },
    effects: {
      hpMult: 1.5,
      dmgMult: 1.3,
      shieldMult: 1.2
    },
    tier: 1
  },
  champion: {
    id: 'champion',
    name: { zh: '冠军', en: 'Champion' },
    description: { zh: '精英 Boss 变体', en: 'Elite boss variant' },
    effects: {
      hpMult: 2.0,
      dmgMult: 1.5,
      spdMult: 1.2,
      patternCount: 2
    },
    tier: 2
  },
  relentless: {
    id: 'relentless',
    name: { zh: ' relentless', en: 'Relentless' },
    description: { zh: '敌人持续生成不消退', en: 'Enemies persist endlessly' },
    effects: {
      despawnRate: 0.0,
      spawnRateMult: 1.5
    },
    tier: 2
  },
  vacuum: {
    id: 'vacuum',
    name: { zh: '真空', en: 'Vacuum' },
    description: { zh: '减少屏幕敌人上限', en: 'Reduced enemy capacity' },
    effects: {
      maxEnemies: 0.7
    },
    tier: 1
  },
  overload: {
    id: 'overload',
    name: { zh: '过载', en: 'Overload' },
    description: { zh: '增加火力但过热更快', en: 'Increased firepower but overheats faster' },
    effects: {
      fireRateMult: 1.3,
      heatRateMult: 1.8
    },
    tier: 1
  }
};

/**
 * Wave configurations
 */
export const WAVE_CONFIGS = {
  early: {
    waveRange: [1, 5],
    enemyTypes: ['wraith', 'tadpole'],
    bossInterval: 5,
    champInterval: null,
    affixFrequency: 0.2
  },
  mid: {
    waveRange: [6, 15],
    enemyTypes: ['wraith', 'tadpole', 'drifter', 'raider'],
    bossInterval: 5,
    champInterval: 10,
    affixFrequency: 0.4
  },
  late: {
    waveRange: [16, 30],
    enemyTypes: ['all'],
    bossInterval: 5,
    champInterval: 5,
    affixFrequency: 0.6
  },
  endless: {
    waveRange: [31, Infinity],
    enemyTypes: ['all'],
    bossInterval: 5,
    champInterval: 5,
    affixFrequency: 0.8,
    scaleFactor: 1.15 // Each wave 15% harder
  }
};

/**
 * Daily challenge rules
 */
export const DAILY_RULES = {
  random_hull: {
    id: 'random_hull',
    name: '随机战船',
    description: '每局使用随机选择的初始战机',
    weight: 1.0
  },
  one_shot: {
    id: 'one_shot',
    name: '一击必杀',
    description: '只能装一个升级模块',
    weight: 0.5
  },
  limited_pools: {
    id: 'limited_pools',
    name: '精简卡池',
    description: '只出现基础武器模块',
    weight: 0.7
  },
  bonus_dust: {
    id: 'bonus_dust',
    name: '双倍星尘',
    description: '每关结算获得额外星尘',
    weight: 0.6
  }
};

// Initialize configs with defaults
configLoader.load('difficulties', DIFFICULTIES);
configLoader.load('bosses', BOSS_CONFIGS);
configLoader.load('enemies', ENEMY_TEMPLATES);
configLoader.load('hulls', HULL_CONFIGS);
configLoader.load('modifiers', MODIFIERS);
configLoader.load('modules', MODULE_TEMPLATES);
configLoader.load('affixes', AFFIXES);
configLoader.load('waves', WAVE_CONFIGS);
configLoader.load('daily', DAILY_RULES);

// Export API
export {
  configLoader,
  DIFFICULTIES,
  BOSS_CONFIGS,
  ENEMY_TEMPLATES,
  HULL_CONFIGS,
  MODIFIERS,
  MODULE_TEMPLATES,
  AFFIXES,
  WAVE_CONFIGS,
  DAILY_RULES
};
