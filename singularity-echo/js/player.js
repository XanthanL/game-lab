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
}

// Export API
export {
  Player,
  WEAPON_TYPES
};
