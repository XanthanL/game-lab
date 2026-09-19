/**
 * Singularity Echo - Bullet & Projectile System
 * 
 * Handles all types of projectiles including player bullets,
 * enemy projectiles, and special effects.
 * Implements collision detection and damage resolution.
 * 
 * @module bullets
 */

'use strict';

import { BaseEntity } from './entity-base.js';
import { rand, d2 } from './utils.js';
import { RGBA } from './tokens.js';

// ============================================
// Bullet Types
// ============================================

const BULLET_TYPES = Object.freeze({
  PLAYER_PULSE: 'pulse',      // Continuous beam
  PLAYER_BLASTER: 'blaster',  // High damage projectile
  PLAYER_SPLASH: 'splash',    // Area damage
  ENEMY_BOLT: 'bolt',         // Basic enemy shot
  ENEMY_HOMING: 'homing',     // Tracking missile
  ENEMY_ORBIT: 'orbit',       // Circular pattern
  BOSS_BEAM: 'beam'           // Boss special attack
});

// ============================================
// Player Bullet Class
// ============================================

class PlayerBullet extends BaseEntity {
  /**
   * Create a new player bullet
   * @param {Object} options 
   */
  constructor(options = {}) {
    super({
      x: options.x || 0,
      y: options.y || 0,
      radius: 4,
      zIndex: 15,
      ...options
    });
    
    this.type = BULLET_TYPES.PLAYER_BLASTER;
    this.damage = options.damage || 10;
    this.speed = options.speed || 8;
    this.life = options.life || 3.0;
    this.pierce = options.pierce || 0;
    this.spread = options.spread || 0;
    
    // Direction vector (normalized)
    const angle = options.angle || -Math.PI / 2;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    
    this.color = options.color || '#7cb2dd';
    this.gold = !!options.gold;
    
    console.debug(`[PlayerBullet] Created at (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
  }
  
  update(dt, gameState) {
    if (this.dead || gameState !== GameState.PLAYING) return;
    
    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Life timer
    this.life -= dt;
    if (this.life <= 0) {
      this.die();
    }
    
    // Off-screen cleanup
    if (!this.isOnScreen()) {
      this.die();
    }
  }
  
  render(ctx) {
    if (!this.visible || this.dead) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    
    ctx.fillStyle = this.gold ? 'rgb(var(--c-amber-rgb))' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    
    // Draw bullet
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  die() {
    this.dead = true;
  }
}

// ============================================
// Enemy Bullet Class
// ============================================

class EnemyBullet extends BaseEntity {
  /**
   * Create an enemy projectile
   * @param {Object} options 
   */
  constructor(options = {}) {
    super({
      x: options.x || 0,
      y: options.y || 0,
      radius: 6,
      zIndex: 15,
      ...options
    });
    
    this.type = options.type || BULLET_TYPES.ENEMY_BOLT;
    this.damage = options.damage || 8;
    this.homing = options.homing || false;
    this.trackingTarget = null;
    this.speed = options.speed || 4;
    
    // Initial velocity
    const angle = options.angle || Math.PI / 2;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    
    this.color = options.color || '#ffb08a';
  }
  
  update(dt, gameState) {
    if (this.dead || gameState !== GameState.PLAYING) return;
    
    // Homing behavior
    if (this.homing && this.trackingTarget && !this.trackingTarget.dead) {
      const dx = this.trackingTarget.x - this.x;
      const dy = this.trackingTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        const targetVx = (dx / dist) * this.speed;
        const targetVy = (dy / dist) * this.speed;
        
        // Smooth turn (lerp towards target direction)
        this.vx = this.vx * 0.9 + targetVx * 0.1;
        this.vy = this.vy * 0.9 + targetVy * 0.1;
      }
    }
    
    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Cleanup if off-screen
    if (!this.isOnScreen()) {
      this.die();
    }
  }
  
  render(ctx) {
    if (!this.visible || this.dead) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    
    // Draw as circle with core
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    ctx.restore();
  }
  
  setTarget(entity) {
    this.trackingTarget = entity;
  }
}

// ============================================
// Beam Weapon Class (Continuous)
// ============================================

class BeamWeapon extends BaseEntity {
  /**
   * Continuous beam weapon (pulse cannon)
   */
  constructor(options = {}) {
    super({
      x: options.x || 0,
      y: options.y || 0,
      radius: 0,
      visible: false,
      zIndex: 14,
      ...options
    });
    
    this.damage = options.damage || 5;
    this.width = options.width || 3;
    this.life = options.life || 0.1;
    this.beamLength = options.beamLength || 200;
    this.color = options.color || '#7cb2dd';
    
    this.segments = [];
    this.currentSegment = 0;
  }
  
  update(dt, gameState) {
    if (this.dead || gameState !== GameState.PLAYING) return;
    
    this.life -= dt;
    if (this.life <= 0) {
      this.die();
    }
    
    // Add beam segment
    this.segments.push({
      x1: this.x,
      y1: this.y,
      x2: this.x,
      y2: this.y - this.beamLength
    });
    
    if (this.segments.length > 10) {
      this.segments.shift();
    }
  }
  
  render(ctx) {
    if (!this.visible || this.dead || this.segments.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    
    for (let i = 0; i < this.segments.length - 1; i++) {
      const seg = this.segments[i];
      const nextSeg = this.segments[i + 1];
      
      ctx.globalAlpha = (i / this.segments.length) * 0.5;
      
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

// ============================================
// Bullet Manager
// ============================================

class BulletManager {
  constructor() {
    this.bullets = [];
    this.beams = [];
    this.maxBullets = 200;
    
    // Delayed cleanup queue (prevents deleting bullets in same frame they're spawned)
    this.cleanupQueue = [];
    
    console.log('[BulletManager] Initialized with delayed cleanup');
  }
  
  /**
   * Schedule bullet for delayed cleanup
   */
  scheduleCleanup(bullet) {
    this.cleanupQueue.push({
      bullet,
      safeToRemove: Date.now() + 50 // 50ms buffer
    });
  }
  
  /**
   * Process delayed cleanup queue
   */
  processCleanup() {
    const now = Date.now();
    this.cleanupQueue = this.cleanupQueue.filter(entry => {
      if (entry.safeToRemove > now) return true; // Still waiting
      
      // Safe to remove
      const idx = this.bullets.indexOf(entry.bullet);
      if (idx > -1) {
        this.bullets.splice(idx, 1);
      }
      return false;
    });
  }
  
  /**
   * Spawn a player bullet
   * @param {Object} options 
   * @returns {PlayerBullet|null}
   */
  spawnPlayerBullet(options = {}) {
    if (this.bullets.length >= this.maxBullets) {
      console.warn('[BulletManager] Max bullets reached');
      return null;
    }
    
    const bullet = new PlayerBullet(options);
    this.bullets.push(bullet);
    return bullet;
  }
  
  /**
   * Spawn an enemy bullet
   * @param {Object} options 
   * @returns {EnemyBullet}
   */
  spawnEnemyBullet(options = {}) {
    const bullet = new EnemyBullet(options);
    this.bullets.push(bullet);
    return bullet;
  }
  
  /**
   * Spawn a beam
   * @param {Object} options 
   * @returns {BeamWeapon}
   */
  spawnBeam(options = {}) {
    if (this.beams.length >= this.maxBullets / 2) {
      return null;
    }
    
    const beam = new BeamWeapon(options);
    this.beams.push(beam);
    return beam;
  }
  
  /**
   * Update all bullets (Phase 17+ with delayed cleanup)
   * @param {number} dt 
   * @param {GameState} gameState 
   */
  update(dt, gameState) {
    // Process cleanup queue first
    this.processCleanup();
    
    // Update and filter bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, gameState);
      
      if (b.dead) {
        this.scheduleCleanup(b);
      }
    }
    
    // Update beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      beam.update(dt, gameState);
      
      if (!beam.dead) continue;
      
      const idx = this.beams.indexOf(beam);
      if (idx > -1) {
        this.beams.splice(idx, 1);
      }
    }
  }
  
  /**
   * Render all bullets
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    // Sort by zIndex
    const all = [...this.bullets.sort((a, b) => a.zIndex - b.zIndex), ...this.beams];
    
    for (const bullet of all) {
      if (bullet.visible) {
        bullet.render(ctx);
      }
    }
  }
  
  /**
   * Check collisions between bullets and entities
   * Optimized version: only check player bullets vs enemies, enemy bullets vs player
   * @param {Array} targets - Array of target entities (enemies or player)
   * @returns {Array} Collision events
   */
  checkCollisions(targets = []) {
    const collisions = [];
    
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      
      // Player bullets hit enemies
      if (bullet.type.startsWith('PLAYER_')) {
        for (const target of targets) {
          if (target.dead || target.type === 'player' || target.type.startsWith('enemy_')) continue;
          
          if (bullet.intersects(target)) {
            // Record collision
            collisions.push({
              bullet,
              target,
              distance: Math.sqrt(d2(bullet.x, bullet.y, target.x, target.y))
            });
            
            // Apply damage
            target.takeDamage(bullet.damage, {
              source: bullet,
              sourceType: 'player_shoot',
              damage: bullet.damage
            });
            
            if (bullet.pierce <= 0) {
              bullet.die();
            } else {
              bullet.pierce--;
            }
          }
        }
      }
      // Enemy bullets hit player
      else if (bullet.type.startsWith('ENEMY_') || bullet.type === 'beam') {
        const target = targets.find(t => t.type === 'player');
        if (target && !target.dead && bullet.intersects(target)) {
          target.takeDamage(bullet.damage, {
            source: bullet,
            sourceType: 'enemy_shoot',
            damage: bullet.damage
          });
          
          if (bullet.pierce <= 0) {
            bullet.die();
          } else {
            bullet.pierce--;
          }
        }
      }
    }
    
    return collisions;
  }
  
  /**
   * Clear all bullets
   */
  clear() {
    this.bullets.forEach(b => b.destroy());
    this.beams.forEach(b => b.destroy());
    this.bullets = [];
    this.beams = [];
  }
  
  /**
   * Get bullet count
   * @returns {number}
   */
  getCount() {
    return this.bullets.length + this.beams.length;
  }
}

// Singleton instance
const bulletManager = new BulletManager();

// Export API
export {
  PlayerBullet,
  EnemyBullet,
  BeamWeapon,
  BULLET_TYPES,
  BulletManager,
  bulletManager
};
