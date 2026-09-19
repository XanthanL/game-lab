/**
 * Singularity Echo - Upgrade Tree & Card Selection System
 * 
 * Roguelite progression system with:
 * - Wave completion card selection (choose 1 of 3)
 * - Permanent upgrades (stats, unlocks)
 * - Module synergies (active/passive skills)
 * - Hull unlocks (new ships via star map)
 * 
 * @module upgrades
 */

'use strict';

// ==================== Upgrade Categories ====================

export const UPGRADE_CATEGORIES = Object.freeze({
  ATTACK: 'attack',        // Direct damage output
  DEFENSE: 'defense',      // Survivability
  UTILITY: 'utility',      // Tactical flexibility
  SPECIAL: 'special'       // Unique mechanics
});

// ==================== Upgrade Definitions ====================

const UPGRADE_DATABASE = {
  // --- Attack Category ---
  [UPGRADE_CATEGORIES.ATTACK]: {
    // Base Stats
    'dmg_plus_10': {
      id: 'dmg_plus_10',
      name: { zh: '伤害 +10%', en: '+10% Damage' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'stat_mod',
      stat: 'damage',
      value: 0.10,
      cost: 100,
      description: { zh: '所有武器伤害提升 10%', en: '+10% damage with all weapons' },
      icon: '💪',
      rarity: 'common'
    },
    
    'dmg_plus_25': {
      id: 'dmg_plus_25',
      name: { zh: '伤害 +25%', en: '+25% Damage' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'stat_mod',
      stat: 'damage',
      value: 0.25,
      cost: 250,
      description: { zh: '所有武器伤害提升 25%', en: '+25% damage with all weapons' },
      icon: '🔥',
      rarity: 'uncommon'
    },
    
    'fire_rate_up': {
      id: 'fire_rate_up',
      name: { zh: '射速提升', en: 'Fire Rate Up' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'stat_mod',
      stat: 'fireRate',
      value: 0.15,
      cost: 150,
      description: { zh: '射击速度 +15%', en: '+15% attack speed' },
      icon: '⚡',
      rarity: 'common'
    },
    
    // Active Weapons
    'blaster_unlock': {
      id: 'blaster_unlock',
      name: { zh: '爆裂炮', en: 'Blaster' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'weapon_unlock',
      weaponId: 'blaster',
      cost: 300,
      description: { zh: '高伤害脉冲激光，可穿透敌人', en: 'High-damage pulse laser that pierces enemies' },
      icon: '🔫',
      rarity: 'rare'
    },
    
    'gatling_unlock': {
      id: 'gatling_unlock',
      name: { zh: '加特林机枪', en: 'Gatling' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'weapon_unlock',
      weaponId: 'gatling',
      cost: 400,
      description: { zh: '极高射速的霰弹枪，适合近距离作战', en: 'High fire-rate shotgun for close combat' },
      icon: '💣',
      rarity: 'epic'
    },
    
    // Abilities
    'homing_missiles': {
      id: 'homing_missiles',
      name: { zh: '制导导弹', en: 'Homing Missiles' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'ability',
      abilityId: 'homing',
      cost: 350,
      description: { zh: '自动追踪最近敌人的导弹', en: 'Missiles that track the nearest enemy' },
      icon: '🎯',
      rarity: 'rare'
    },
    
    'tesla_coil': {
      id: 'tesla_coil',
      name: { zh: '特斯拉线圈', en: 'Tesla Coil' },
      category: UPGRADE_CATEGORIES.ATTACK,
      type: 'ability',
      abilityId: 'tesla',
      cost: 400,
      description: { zh: '在敌人间跳跃的电弧闪电', en: 'Arc lightning that chains between enemies' },
      icon: '⚡',
      rarity: 'epic'
    }
  },
  
  // --- Defense Category ---
  [UPGRADE_CATEGORIES.DEFENSE]: {
    'hp_plus_25': {
      id: 'hp_plus_25',
      name: { zh: '最大生命 +25', en: '+25 Max HP' },
      category: UPGRADE_CATEGORIES.DEFENSE,
      type: 'stat_add',
      stat: 'maxHp',
      value: 25,
      cost: 100,
      description: { zh: '最大生命值 +25', en: '+25 max hit points' },
      icon: '❤️',
      rarity: 'common'
    },
    
    'shield_boost': {
      id: 'shield_boost',
      name: { zh: '护盾强化', en: 'Shield Boost' },
      category: UPGRADE_CATEGORIES.DEFENSE,
      type: 'stat_mod',
      stat: 'shieldMax',
      value: 0.20,
      cost: 150,
      description: { zh: '护盾上限 +20%，再生加速', en: '+20% shield capacity and regeneration' },
      icon: '🛡️',
      rarity: 'uncommon'
    },
    
    'regen_fast': {
      id: 'regen_fast',
      name: { zh: '快速再生', en: 'Fast Regen' },
      category: UPGRADE_CATEGORIES.DEFENSE,
      type: 'stat_mod',
      stat: 'regen',
      value: 0.50,
      cost: 200,
      description: { zh: '护盾再生速度 +50%', en: '+50% shield regeneration rate' },
      icon: '🌿',
      rarity: 'rare'
    },
    
    'dash_upgrade': {
      id: 'dash_upgrade',
      name: { zh: '冲刺强化', en: 'Dash Upgrade' },
      category: UPGRADE_CATEGORIES.DEFENSE,
      type: 'ability',
      abilityId: 'dash_improved',
      cost: 300,
      description: { zh: '冲刺冷却减少 30%，无敌帧延长', en: '-30% dash cooldown with longer i-frames' },
      icon: '💨',
      rarity: 'rare'
    }
  },
  
  // --- Utility Category ---
  [UPGRADE_CATEGORIES.UTILITY]: {
    'magnet_range': {
      id: 'magnet_range',
      name: { zh: '拾取范围扩大', en: 'Larger Pickup Range' },
      category: UPGRADE_CATEGORIES.UTILITY,
      type: 'stat_mod',
      stat: 'magnet',
      value: 0.50,
      cost: 120,
      description: { zh: '星尘和道具拾取范围 +50%', en: '+50% pickup radius for dust and power-ups' },
      icon: '🧲',
      rarity: 'common'
    },
    
    'score_mult': {
      id: 'score_mult',
      name: { zh: '得分加成', en: 'Score Multiplier' },
      category: UPGRADE_CATEGORIES.UTILITY,
      type: 'global_bonus',
      bonusType: 'score',
      value: 0.15,
      cost: 180,
      description: { zh: '所有得分 +15%', en: '+15% score from all sources' },
      icon: '🏆',
      rarity: 'uncommon'
    },
    
    'drop_rate': {
      id: 'drop_rate',
      name: { zh: '掉落率提升', en: 'Increased Drop Rate' },
      category: UPGRADE_CATEGORIES.UTILITY,
      type: 'global_bonus',
      bonusType: 'drops',
      value: 0.25,
      cost: 250,
      description: { zh: '道具掉落率 +25%', en: '+25% chance for items to drop' },
      icon: '📦',
      rarity: 'rare'
    }
  },
  
  // --- Special Category ---
  [UPGRADE_CATEGORIES.SPECIAL]: {
    'slow_motion': {
      id: 'slow_motion',
      name: { zh: '子弹时间', en: 'Slow Motion' },
      category: UPGRADE_CATEGORIES.SPECIAL,
      type: 'passive',
      trigger: 'low_health',
      threshold: 0.30, // Below 30% HP
      effect: 'time_scale_0.5', // Reduce time scale by half
      cost: 500,
      description: { zh: '生命值低于 30% 时触发慢动作效果', en: 'Activates when below 30% HP, slowing time' },
      icon: '⏱️',
      rarity: 'legendary'
    },
    
    'explosion_booster': {
      id: 'explosion_booster',
      name: { zh: '爆炸增强', en: 'Explosion Booster' },
      category: UPGRADE_CATEGORIES.SPECIAL,
      type: 'passive',
      passiveType: 'aoe_damage',
      multiplier: 1.5,
      cost: 400,
      description: { zh: '爆炸类技能伤害提升 50%', en: '+50% damage from explosive abilities' },
      icon: '💥',
      rarity: 'epic'
    },
    
    'chain_reaction': {
      id: 'chain_reaction',
      name: { zh: '连锁反应', en: 'Chain Reaction' },
      category: UPGRADE_CATEGORIES.SPECIAL,
      type: 'synergy',
      triggers: ['explosive_shot'],
      effect: 'secondary_explosion',
      cost: 600,
      description: { zh: '爆炸伤害会在范围内生成二次爆炸', en: 'Explosions create secondary explosions in area' },
      icon: '🌋',
      rarity: 'legendary'
    }
  }
};

// ==================== Synergy Combinations ====================

const SYNERGY_TABLE = {
  // Weapon combinations
  'pulse_cannon+homing': {
    id: 'pulse_homing_synergy',
    name: { zh: '脉冲制导', en: 'Pulse Homing' },
    description: { zh: '脉冲枪发射的子弹会自动追踪敌人', en: 'Pulse shots automatically track nearby enemies' },
    triggerModules: ['pulse_cannon', 'homing_missiles'],
    rank: 2 // Rank 2 or higher synergy
  },
  
  'blaster+explosive_shots': {
    id: 'blaster_explosive_synergy',
    name: { zh: '爆破脉冲', en: 'Explosive Blaster' },
    description: { zh: '爆裂炮发射爆炸性弹丸', en: 'Blaster fires explosive projectiles' },
    triggerModules: ['blaster_unlock', 'explosive_shots'],
    rank: 2
  },
  
  'gatling+tesla_coil': {
    id: 'gatling_tesla_synergy',
    name: { zh: '电光风暴', en: 'Lightning Storm' },
    description: { zh: '加特林机枪每次命中都释放电弧', en: 'Each Gatling hit releases arc lightning' },
    triggerModules: ['gatling_unlock', 'tesla_coil'],
    rank: 3
  }
};

// ==================== Card Selection System ====================

class CardSelector {
  constructor() {
    this.selectedCard = null;
    this.onCardSelectedCallbacks = [];
  }
  
  /**
   * Generate 3 random upgrade cards based on player level
   */
  generateCards(playerLevel, excludedUpgrades = []) {
    const availableUpgrades = this.getAvailableUpgrades(playerLevel);
    
    // Filter out already owned upgrades
    const pool = availableUpgrades.filter(u => 
      !excludedUpgrades.includes(u.id) && !player.hasUpgrade(u.id)
    );
    
    if (pool.length < 3) {
      console.warn('[CardSelector] Insufficient upgrades in pool:', pool.length);
      return this.generateFallbackCards();
    }
    
    // Weighted random selection (prefer higher cost/rarity)
    const cards = [];
    for (let i = 0; i < 3; i++) {
      const weightedPool = this.weightByRarity(pool);
      const selectedId = weightedPool[Math.floor(Math.random() * weightedPool.length)];
      const card = UPGRADE_DATABASE[this.findCategory(selectedId)][selectedId];
      
      cards.push(card);
      pool.splice(pool.indexOf(selectedId), 1);
    }
    
    return cards;
  }
  
  /**
   * Weight upgrades by rarity (higher rarity = higher probability)
   */
  weightByRarity(upgrades) {
    const weights = {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5
    };
    
    const weighted = [];
    for (const id of upgrades) {
      const upgrade = this.findUpgrade(id);
      const rarity = upgrade.rarity || 'common';
      const weight = weights[rarity] || 1;
      
      for (let i = 0; i < weight; i++) {
        weighted.push(id);
      }
    }
    
    return weighted;
  }
  
  findUpgrade(id) {
    for (const cat of Object.values(UPGRADE_DATABASE)) {
      if (cat[id]) return cat[id];
    }
    return null;
  }
  
  findCategory(id) {
    for (const [category, upgrades] of Object.entries(UPGRADE_DATABASE)) {
      if (upgrades[id]) return category;
    }
    return null;
  }
  
  /**
   * Get upgrades available at given level
   */
  getAvailableUpgrades(level) {
    const available = [];
    
    for (const category of Object.values(UPGRADE_DATABASE)) {
      for (const [id, upgrade] of Object.entries(category)) {
        // Simple level requirement: cost-based
        if (upgrade.cost <= level * 100) {
          available.push(id);
        }
      }
    }
    
    return available;
  }
  
  generateFallbackCards() {
    // Fallback: health/defense focused when pool is exhausted
    return [
      UPGRADE_DATABASE[UPGRADE_CATEGORIES.DEFENSE]['hp_plus_25'],
      UPGRADE_DATABASE[UPGRADE_CATEGORIES.DEFENSE]['shield_boost'],
      UPGRADE_DATABASE[UPGRADE_CATEGORIES.UTILITY]['magnet_range']
    ];
  }
  
  /**
   * Subscribe to card selection events
   */
  onSelection(callback) {
    this.onCardSelectedCallbacks.push(callback);
  }
  
  emitSelection(card) {
    this.selectedCard = card;
    this.onCardSelectedCallbacks.forEach(cb => cb(card));
  }
}

// ==================== Player Extension ====================

Player.prototype.hasUpgrade = function(upgradeId) {
  return this.upgrades?.includes(upgradeId) || false;
};

Player.prototype.addUpgrade = function(upgrade) {
  if (!this.upgrades) this.upgrades = [];
  
  if (this.upgrades.includes(upgrade.id)) {
    console.warn(`[Upgrade] Already has upgrade: ${upgrade.id}`);
    return false;
  }
  
  this.upgrades.push(upgrade.id);
  
  // Apply effects immediately
  this.applyUpgrade(upgrade);
  
  console.log(`[Upgrade] Added: ${upgrade.name.en}`, upgrade.icon);
  return true;
};

Player.prototype.applyUpgrade = function(upgrade) {
  switch (upgrade.type) {
    case 'stat_add':
      this[upgrade.stat] += upgrade.value;
      break;
      
    case 'stat_mod':
      // Store multipliers separately
      if (!this.statMods) this.statMods = {};
      this.statMods[upgrade.stat] = (this.statMods[upgrade.stat] || 1) + upgrade.value;
      break;
      
    case 'weapon_unlock':
      configLoader.unlockModule(upgrade.weaponId);
      break;
      
    case 'ability':
      this.activeAbilities = this.activeAbilities || {};
      this.activeAbilities[upgrade.abilityId] = true;
      break;
      
    case 'passive':
      // Handle special passive effects
      if (upgrade.trigger === 'low_health') {
        this.passives = this.passives || {};
        this.passives.slowMotion = upgrade;
      }
      break;
      
    case 'synergy':
      // Register synergy combinations
      registerSynergy(upgrade);
      break;
  }
};

// ==================== Global Functions ====================

function registerSynergy(upgrade) {
  if (SYNERGY_TABLE[upgrade.id]) {
    console.log('[Synergy] Registered:', SYNERGY_TABLE[upgrade.id].name.en);
  }
}

// ==================== Export API ====================

export {
  UPGRADE_CATEGORIES,
  UPGRADE_DATABASE,
  SYNERGY_TABLE,
  CardSelector
};

// Singleton instance
export const cardSelector = new CardSelector();
