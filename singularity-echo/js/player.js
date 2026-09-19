/**
 * Singularity Echo - Player Entity Module
 * 
 * Represents the player's ship with all combat capabilities.
 * Handles movement, shooting, shields, and power-up effects.
 * 
 * @module player
 */

'use strict';

import { BaseEntity } from './entity-base.js';
import { configLoader } from './config.js';
import { RGBA } from './tokens.js';
import { particlesManager } from './particles.js';
import { playSound } from './audio.js';
import { PowerUpSpawner } from './power-ups.js';

// ============================================
// Weapon Types
// ============================================

const WEAPON_TYPES = Object.freeze({
  PULSE: 'pulse',      // Continuous beam
  BLASTER: 'blaster',  // High damage projectile
  Gatling: 'gatling',  // High fire rate spread
  HOMING: 'homing',    // Missile tracking
  TESLA: 'tesla'       // Chain lightning
});

// ============================================
// Player Class
// ============================================

/**
 * Player ship entity
 */
class Player extends BaseEntity {
  /**
   * Create a new player
   * @param {Object} options - Configuration
   * @param {string} [options.hull='peregrine'] - Ship hull type
   */
  constructor(options = {}) {
    const hullConfig = HULL_CONFIGS[options.hull] || HULL_CONFIGS.peregrine;
    
    super({
      x: window.innerWidth / 2,
      y: window.innerHeight - 100,
      radius: 20,
      zIndex: 20,
      ...options
    });
    
    this.type = 'player';
    this.hull = hullConfig.id;
    
    // Base stats from hull config
    const stats = hullConfig.baseStats;
    this.hp = stats.hp;
    this.maxHp = stats.maxHp;
    this.damage = stats.damage || 10; // Add damage stat
    this.shield = 0;
    this.shieldMax = stats.shieldMax;
    this.regen = stats.regen;
    this.speed = stats.maxSpeed;
    this.fireRate = stats.fireRate;
    this.magnet = stats.magnet;
    
    // Build state (upgrades)
    this.build = {}; // { module_id: level }
    this.buffs = {
      fireRateBuff: 0,
      speedBuff: 0,
      damageBuff: 0
    };
    
    // Weapons
    this.weapons = {
      primary: [],     // Always active weapons
      secondary: [],   // Charged abilities
      active: []       // Currently firing weapons
    };
    
    // Add starting weapons
    if (hullConfig.startingModules) {
      hullConfig.startingModules.forEach(moduleId => {
        this.addWeapon(moduleId, 1);
      });
    }
    
    // Shield system
    this.invulnTime = 3.0; // Starting invulnerability
    this.hitFlashTimer = 0;
    this.shieldBreakTimer = 0;
    
    // Input state
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      dash: false
    };
    
    // Combo system
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMaxTime = 3.0; // Seconds before combo resets
    
    // Dash cooldown
    this.dashCooldown = 0;
    this.dashDuration = 0.2;
    this.isDashing = false;
    
    // Trail effect data
    this.trailPositions = [];
    this.maxTrailLength = 10;
    this.trailColor = hullConfig.style?.trailColor || '#7cb2dd';
    
    console.log(`[Player] Created ${this.hull} hull at (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
  }
  
  /**
   * Update player state
   * @param {number} dt - Delta time
   * @param {GameState} gameState
   */
  update(dt, gameState) {
    if (gameState === GameState.PAUSED || this.dead) return;
    
    // Invulnerability
    if (this.invulnTime > 0) {
      this.invulnTime -= dt;
    }
    
    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
    
    // Shield break recovery
    if (this.shieldBreakTimer > 0) {
      this.shieldBreakTimer -= dt;
    }
    
    // Dash cooldown
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
    }
    
    // Regenerate shield
    if (this.shield < this.shieldMax && this.shieldBreakTimer <= 0) {
      this.shield = Math.min(this.shield + this.regen * dt, this.shieldMax);
    }
    
    // Movement
    this.updateMovement(dt);
    
    // Position limits
    this.clampToWindow();
    
    // Trail update
    this.updateTrail();
    
    // Fire weapons
    if (this.input.fire && this.weapons.active.length > 0) {
      this.fireWeapons(dt);
    }
    
    // Check power-up pickups
    PowerUpSpawner.checkCollisions(this);
  }
  
  /**
   * Process input and apply movement
   * @param {number} dt 
   */
  updateMovement(dt) {
    let dx = 0;
    let dy = 0;
    
    // Check input (touch or keyboard)
    if (this.input.up) dy -= 1;
    if (this.input.down) dy += 1;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }
    
    // Apply speed (with buffs)
    const effectiveSpeed = this.speed * (1 + this.buffs.speedBuff);
    
    this.vx = dx * effectiveSpeed;
    this.vy = dy * effectiveSpeed;
  }
  
  /**
   * Fire all active weapons
   * @param {number} dt 
   */
  fireWeapons(dt) {
    const now = Date.now() / 1000;
    
    for (const weapon of this.weapons.active) {
      if (!weapon.cooldown) {
        weapon.cooldown = weapon.maxCooldown;
        weapon.fire(now, this);
      } else {
        weapon.cooldown -= dt;
      }
    }
  }
  
  /**
   * Add a weapon to the player
   * @param {string} moduleId 
   * @param {number} level 
   */
  addWeapon(moduleId, level) {
    // 使用 modules 数组（从 config 加载）
    const module = configLoader.getModuleTemplate(moduleId);
    if (!module) return false;
    
    this.weapons.active.push({
      id: moduleId,
      level: level,
      maxCooldown: 1.0 / (this.fireRate * (1 + this.buffs.fireRateBuff)),
      cooldown: 0,
      fire: module.fireFn,
      damage: module.statMods?.dmg || 10
    });
    
    return true;
  }
  
  /**
   * Check if entity is visible (not occluded by obstacles)
   * Simplified for now - could use raycasting in future
   * @returns {boolean}
   */
  shouldFire() {
    // 当前简化版本：总是可以射击
    // TODO: 添加视线检测
    return true;
  }
  
  /**
   * Update trail positions
   */
  updateTrail() {
    // Add current position
    this.trailPositions.push({ x: this.x, y: this.y, alpha: 1.0 });
    
    // Remove old positions
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }
    
    // Decay alpha
    this.trailPositions.forEach(p => p.alpha -= 0.05);
    
    // Remove invisible positions
    this.trailPositions = this.trailPositions.filter(p => p.alpha > 0);
  }
  
  /**
   * Take damage
   * @param {number} amount 
   * @param {Object} source - Damage source info
   */
  takeDamage(amount, source = {}) {
    if (this.invulnTime > 0) return false;
    
    // Apply shield first
    if (this.shield > 0) {
      const shieldDamage = Math.min(amount, this.shield);
      this.shield -= shieldDamage;
      
      if (this.shield <= 0) {
        this.shieldBreakTimer = 1.0; // Brief shield regeneration delay
      }
      
      amount -= shieldDamage;
      
      if (amount <= 0) {
        return true; // Blocked by shield
      }
    }
    
    // Apply to HP
    this.hp -= amount;
    this.hitFlashTimer = 0.2;
    
    // Flash red on hit
    document.dispatchEvent(new CustomEvent('playerHit', { detail: { x: this.x, y: this.y } }));
    
    if (this.hp <= 0) {
      this.die(source);
      return true;
    }
    
    return true;
  }
  
  /**
   * Die with optional cause
   * @param {Object} cause - Death information
   */
  die(cause = {}) {
    this.dead = true;
    
    // Trigger death event
    document.dispatchEvent(new CustomEvent('playerDied', {
      detail: {
        cause: cause.sourceType || 'unknown',
        score: GlobalScore || 0,
        wave: CurrentWave || 0,
        hull: this.hull
      }
    }));
    
    console.log(`[Player] Died! Cause: ${cause.sourceType || 'unknown'}`);
  }
  
  /**
   * Heal HP
   * @param {number} amount 
   */
  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }
  
  /**
   * Boost temporarily
   * @param {'speed'|'fireRate'|'damage'} type
   * @param {number} duration
   * @param {number} multiplier
   */
  boost(type, duration, multiplier) {
    const buffKey = `${type}Buff`;
    this.buffs[buffKey] = multiplier;
    
    setTimeout(() => {
      this.buffs[buffKey] = 0;
    }, duration * 1000);
  }
  
  /**
   * Dash forward - instant direction reversal
   */
  dash() {
    if (this.dashCooldown > 0 || this.isDashing) return;
    
    this.isDashing = true;
    this.dashCooldown = 2.0; // 2 second cooldown
    
    const dashSpeed = this.speed * 5;
    const dashDuration = this.dashDuration;
    
    // Use a single animation frame loop instead of recursive refs
    let remaining = dashDuration;
    const step = () => {
      if (remaining <= 0 || this.dead) {
        this.isDashing = false;
        return;
      }
      
      // Invert velocity for instant direction change
      this.vx = -this.vx * 2;
      this.vy = -this.vy * 2;
      
      remaining -= 0.016;
      requestAnimationFrame(step);
    };
    
    requestAnimationFrame(step);
    
    // Cleanup timer
    setTimeout(() => {
      this.isDashing = false;
    }, dashDuration * 1000);
  }
  
  /**
   * Draw the player
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    if (!this.visible || this.dead) return;
    
    // Draw trail
    this.drawTrail(ctx);
    
    // Draw body
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Hit flash effect
    if (this.hitFlashTimer > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 20);
    }
    
    // Draw based on hull type
    this.drawHullBody(ctx);
    
    // Draw shield indicator
    if (this.shield > 0) {
      this.drawShieldRing(ctx);
    }
    
    ctx.restore();
  }
  
  /**
   * Draw ship body (override per hull)
   * @param {CanvasRenderingContext2D} ctx 
   */
  drawHullBody(ctx) {
    const hull = HULL_CONFIGS[this.hull];
    const color = hull.style?.primaryColor || '#7cb2dd';
    
    ctx.fillStyle = RGBA(color.replace('#', ''), 0.9);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    // Simple delta vector shape (triangle pointing up)
    ctx.beginPath();
    ctx.moveTo(0, -this.radius); // Top
    ctx.lineTo(this.radius, this.radius); // Bottom right
    ctx.lineTo(-this.radius, this.radius); // Bottom left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Engine glow
    ctx.fillStyle = RGBA(color.replace('#', ''), 0.6);
    ctx.beginPath();
    ctx.arc(0, this.radius - 5, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  
  /**
   * Draw shield ring around player
   * @param {CanvasRenderingContext2D} ctx 
   */
  drawShieldRing(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const percent = this.shield / this.shieldMax;
    const angle = (Date.now() / 500) % (Math.PI * 2); // Rotating effect
    
    ctx.rotate(angle);
    
    ctx.strokeStyle = RGBA('cyan-hi', 0.4);
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    // Partial ring based on shield percentage
    ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2 * percent);
    ctx.stroke();
    
    ctx.restore();
  }
  
  /**
   * Draw engine trail
   * @param {CanvasRenderingContext2D} ctx 
   */
  drawTrail(ctx) {
    if (this.trailPositions.length < 2) return;
    
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${this.trailColor.replace('#', '')}, 0.3)`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const pos = this.trailPositions[0];
    ctx.moveTo(pos.x, pos.y);
    
    for (let i = 1; i < this.trailPositions.length; i++) {
      const p = this.trailPositions[i];
      ctx.lineTo(p.x, p.y);
    }
    
    ctx.stroke();
    ctx.restore();
  }
  
  /**
   * Get current weapon count
   * @returns {number}
   */
  getWeaponCount() {
    return this.weapons.active.length;
  }
  
  /**
   * Get upgrade points available
   * @returns {number}
   */
  getUpgradePoints() {
    // Usually comes from XP/system
    return 0;
  }
  
  // ========== Combo System Extensions ==========
  
  /**
   * Record a kill for combo tracking
   * @param {Object} enemy - The killed enemy
   */
  onKill(enemy) {
    // Increment combo counter
    this.comboCount++;
    this.comboTimer = this.comboMaxTime;
    
    // Calculate combo bonus
    const multiplier = Math.min(1 + (this.comboCount - 1) * 0.1, 3.0); // Max 3x
    
    if (this.comboCount > 1) {
      console.log(`[Combo] ${this.comboCount}x kill! (+${((multiplier - 1) * 100).toFixed(0)}% score)`);
      
      // Trigger screen shake for high combos
      if (this.comboCount >= 5) {
        triggerShake(Math.floor(this.comboCount / 5), 2);
      }
    }
  }
  
  /**
   * Update combo timer in game loop
   * @param {number} dt - Delta time
   */
  updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }
  }
  
  /**
   * Reset combo counter
   */
  resetCombo() {
    if (this.comboCount > 0) {
      console.log(`[Combo Lost] Combo ended at ${this.comboCount}x`);
    }
    this.comboCount = 0;
    this.comboTimer = 0;
  }
  
  /**
   * Get current combo multiplier
   * @returns {number} Score multiplier (1.0 - 3.0)
   */
  getComboMultiplier() {
    return Math.min(1 + (this.comboCount - 1) * 0.1, 3.0);
  }
  
  // ========== Upgrade System Extensions ==========
  
  /**
   * Initialize upgrade system properties
   */
  initUpgradeSystem() {
    this.upgrades = [];         // Array of applied upgrade IDs
    this.level = 1;
    this.xp = 0;
    this.xpForNextLevel = 100;
  }
  
  /**
   * Add XP and check for level up
   * @param {number} amount - XP to add
   */
  addXp(amount) {
    this.xp += amount;
    
    if (this.xp >= this.xpForNextLevel) {
      this.xp -= this.xpForNextLevel;
      this.level++;
      this.xpForNextLevel = Math.floor(this.xpForNextLevel * 1.2);
      
      console.log(`[Player] Level Up! Now at level ${this.level}`);
      
      // Trigger sound
      playSound('level_up');
      
      return true; // Level up occurred
    }
    
    return false;
  }
  
  /**
   * Check if player has a specific upgrade
   * @param {string} upgradeId - Upgrade ID
   * @returns {boolean}
   */
  hasUpgrade(upgradeId) {
    return this.upgrades.includes(upgradeId);
  }
  
  /**
   * Apply an upgrade to the player
   * @param {Object} upgrade - Upgrade configuration
   */
  addUpgrade(upgrade) {
    if (!upgrade || !upgrade.id) {
      console.error('[Player] Invalid upgrade:', upgrade);
      return;
    }
    
    // Prevent duplicate upgrades
    if (this.hasUpgrade(upgrade.id)) {
      console.warn(`[Player] Already has upgrade: ${upgrade.id}`);
      return;
    }
    
    // Record the upgrade
    this.upgrades.push(upgrade.id);
    
    // Apply the effect
    this.applyUpgrade(upgrade);
    
    console.log(`[Player] Applied upgrade: ${upgrade.id}`);
    
    // Trigger sound and visual feedback if game is available
    if (typeof playSound === 'function') {
      playSound('level_up', { vol: 0.5 });
    }
  }
  
  /**
   * Show upgrade toast notification
   * @param {Object} upgrade - The applied upgrade
   */
  showUpgradeToast(upgrade) {
    const rarityColors = {
      common: '#b8c6d9',
      uncommon: '#56b4e9',
      rare: '#78b2dd',
      epic: '#a855f7',
      legendary: '#f59e0b'
    };
    
    const rarity = upgrade.rarity || 'common';
    const message = `${upgrade.name}\n${upgrade.description}`;
    
    if (typeof notificationSystem !== 'undefined') {
      // Create custom styled toast element
      const toast = document.createElement('div');
      toast.className = `toast toast-${rarity}`;
      toast.style.cssText = `
        position: fixed;
        top: 10%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: linear-gradient(135deg, ${rarityColors[rarity]} 0%, ${rarityColors[rarity].replace('#', 'rgba(' + parseInt(rarityColors[rarity].slice(1,3), 16).toString() + ',' + parseInt(rarityColors[rarity].slice(3,5), 16).toString() + ',' + parseInt(rarityColors[rarity].slice(5,7), 16).toString() + ', 0.9)'), 100%);
        color: white;
        padding: 20px 32px;
        border-radius: 12px;
        text-align: center;
        font-size: var(--fs-3);
        font-weight: bold;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        animation: upgradeToastIn 0.4s ease-out forwards;
        max-width: 400px;
      `;
      
      toast.innerHTML = `
        <div style="font-size: 1.2rem; margin-bottom: 8px;">✨ ${upgrade.name}</div>
        <div style="font-size: 0.85rem; opacity: 0.9;">${upgrade.description}</div>
      `;
      
      document.body.appendChild(toast);
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        toast.style.transition = 'all 0.3s ease-out';
        
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    }
    
    return message;
  }
  
  /**
   * Apply the effects of an upgrade
   * @param {Object} upgrade - Upgrade data
   */
  applyUpgrade(upgrade) {
    if (!upgrade.type) {
      console.warn('[Player] Upgrade missing type:', upgrade);
      return;
    }
    
    switch (upgrade.type) {
      case 'stat_mod':
        // Stat multiplier (+10% Damage, etc.)
        if (upgrade.stat === 'damage') {
          const oldDmg = this.damage;
          this.damage *= (1 + upgrade.value);
          console.log(`[Stat Mod] Damage: ${oldDmg.toFixed(2)} → ${this.damage.toFixed(2)}`);
        } else if (upgrade.stat === 'fireRate') {
          const oldFR = this.fireRate;
          this.fireRate *= (1 + upgrade.value);
          console.log(`[Stat Mod] Fire Rate: ${oldFR.toFixed(3)} → ${this.fireRate.toFixed(3)}`);
        } else if (upgrade.stat === 'maxHp') {
          const oldHp = this.maxHp;
          this.maxHp += upgrade.value;
          this.hp += upgrade.value; // Also heal
          console.log(`[Stat Mod] Max HP: ${oldHp} → ${this.maxHp}`);
        } else if (upgrade.stat === 'shieldMax') {
          const oldShield = this.shieldMax;
          this.shieldMax = Math.floor(this.shieldMax * (1 + upgrade.value));
          console.log(`[Stat Mod] Shield Max: ${oldShield} → ${this.shieldMax}`);
        } else if (upgrade.stat === 'magnet') {
          const oldMag = this.magnet;
          this.magnet += upgrade.value;
          console.log(`[Stat Mod] Magnet: ${oldMag} → ${this.magnet}`);
        }
        break;
        
      case 'stat_add':
        // Fixed stat addition (+25 HP, etc.)
        if (upgrade.stat === 'maxHp') {
          this.maxHp += upgrade.value;
          this.hp += upgrade.value;
        }
        break;
        
      case 'weapon_unlock':
        // Unlock a new weapon
        if (upgrade.weaponId && !this.weapons.primary.includes(upgrade.weaponId)) {
          this.weapons.primary.push(upgrade.weaponId);
          console.log(`[Weapon Unlocked] ${upgrade.weaponId}`);
        }
        break;
        
      case 'ability':
        // Unlock special ability (homing missiles, etc.)
        this.specialAbilities = this.specialAbilities || {};
        this.specialAbilities[upgrade.abilityId] = true;
        console.log(`[Ability Unlocked] ${upgrade.abilityId}`);
        break;
        
      case 'passive':
        // Passive triggers on conditions
        this.passives = this.passives || {};
        this.passives[upgrade.id] = {
          trigger: upgrade.trigger,
          threshold: upgrade.threshold,
          active: false
        };
        console.log(`[Passive Activated] ${upgrade.id}`, this.passives[upgrade.id]);
        
        // Check immediate trigger condition
        if (upgrade.trigger === 'low_health' && this.hp < this.maxHp * upgrade.threshold) {
          this.activatePassive(upgrade.id);
        }
        break;
        
      default:
        console.warn('[Player] Unknown upgrade type:', upgrade.type);
    }
  }
  
  /**
   * Activate a passive ability
   * @param {string} passiveId - Passive upgrade ID
   */
  activatePassive(passiveId) {
    const passive = this.passives?.[passiveId];
    if (!passive) return;
    
    console.log(`[Passive] Activating: ${passiveId}`);
    
    switch (passiveId) {
      case 'slow_motion':
        // Slow down time by 30% when health is low
        Game.timeScale = 0.7;
        setTimeout(() => { Game.timeScale = 1.0; }, 5000);
        break;
    }
    
    // Mark as activated (one-time use)
    passive.active = true;
  }
  
  /**
   * Calculate synergy bonuses between equipped modules
   * @returns {Object} Synergy bonuses
   */
  calculateSynergies() {
    if (!this.weapons.primary.length < 2) {
      return {};
    }
    
    const synergies = {
      damageBonus: 0,
      fireRateBonus: 0,
      specialEffects: []
    };
    
    const weapons = [...this.weapons.primary];
    
    // Check for known synergies
    const synergyPairs = [
      ['pulse_cannon', 'homing', { damageBonus: 0.15, desc: 'Homing pulses' }],
      ['blaster', 'explosive', { damageBonus: 0.20, desc: 'Explosive blasts' }],
      ['laser', 'rapid_fire', { fireRateBonus: 0.30, desc: 'Rapid lasers' }],
      ['mine_layer', 'chain_lightning', { specialEffects: ['chain'] }]
    ];
    
    synergyPairs.forEach(([w1, w2, bonus]) => {
      if (weapons.includes(w1) && weapons.includes(w2)) {
        synergies.damageBonus += bonus.damageBonus || 0;
        synergies.fireRateBonus += bonus.fireRateBonus || 0;
        if (bonus.specialEffects) {
          synergies.specialEffects.push(...bonus.specialEffects);
        }
        console.log(`[Synergy] Activated: ${w1} + ${w2} ->`, bonus);
      }
    });
    
    return synergies;
  }
}

// Export API
export {
  Player,
  WEAPON_TYPES
};
