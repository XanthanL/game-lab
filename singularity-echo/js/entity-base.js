/**
 * Singularity Echo - Entity Base Class Module
 * 
 * Provides base class for all game entities (player, enemies, bullets, particles).
 * Implements common properties and methods shared across entity types.
 * 
 * @module entity-base
 */

'use strict';

import { rand, d2, mod } from './utils.js';
import { GameState } from './game-loop.js';

// ============================================
// Base Entity Class
// ============================================

/**
 * Abstract base class for all game entities
 * @abstract
 */
class BaseEntity {
  /**
   * Create a new entity
   * @param {Object} options - Entity configuration
   * @param {number} [options.x] - Initial X position
   * @param {number} [options.y] - Initial Y position
   * @param {string} [options.type] - Entity type identifier
   * @param {boolean} [options.visible=true] - Visibility flag
   */
  constructor(options = {}) {
    // Position & dimensions
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.vx = 0;
    this.vy = 0;
    
    this.width = options.width || 30;
    this.height = options.height || 30;
    this.radius = options.radius || 15;
    
    // State
    this.type = options.type || 'base';
    this.visible = options.visible !== false;
    this.dead = false;
    this.life = Infinity; // Never die by default
    this.maxLife = Infinity;
    
    // Physics
    this.gravity = 0;
    this.friction = 0;
    this.mass = 1;
    
    // Z-index for rendering order
    this.zIndex = options.zIndex || 10;
    
    // Custom data for specialized use
    this.data = {};
    
    // Cleanup handlers
    this.onRemoveCallbacks = [];
    
    console.debug(`[Entity] Created ${this.type} at (${this.x.toFixed(1)}, ${this.y.toFixed(1)})`);
  }
  
  /**
   * Update entity state
   * @param {number} dt - Delta time in seconds
   * @param {GameState} gameState - Current game state
   */
  update(dt, gameState) {
    if (!this.visible || this.dead) return;
    
    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Apply gravity
    if (this.gravity !== 0) {
      this.vy += this.gravity * dt;
    }
    
    // Apply friction
    if (this.friction !== 0) {
      this.vx *= 1 - this.friction * dt;
      this.vy *= 1 - this.friction * dt;
    }
    
    // Clamp to world bounds (optional override)
    if (this.clampToWorld) {
      this.clampToWindow();
    }
    
    // Life timer
    if (this.maxLife < Infinity && this.life > 0) {
      this.life -= dt;
      if (this.life <= 0) {
        this.die();
      }
    }
  }
  
  /**
   * Render the entity
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  render(ctx) {
    if (!this.visible || this.dead) return;
    // Override in subclasses
  }
  
  /**
   * Check collision with another entity
   * @param {BaseEntity} other - Other entity
   * @returns {boolean} True if colliding
   */
  intersects(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distSq = dx * dx + dy * dy;
    const radiusSum = this.radius + other.radius;
    
    return distSq <= radiusSum * radiusSum;
  }
  
  /**
   * Die and schedule removal
   */
  die() {
    this.dead = true;
    
    // Trigger callbacks
    this.onRemoveCallbacks.forEach(cb => cb(this));
  }
  
  /**
   * Add callback when entity is removed
   * @param {Function} callback - Function(entity)
   */
  onRemoved(callback) {
    this.onRemoveCallbacks.push(callback);
  }
  
  /**
   * Move to specific position
   * @param {number} x 
   * @param {number} y 
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }
  
  /**
   * Set velocity
   * @param {number} vx 
   * @param {number} vy 
   */
  setVelocity(vx, vy) {
    this.vx = vx;
    this.vy = vy;
  }
  
  /**
   * Get velocity magnitude
   * @returns {number} Speed
   */
  getSpeed() {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }
  
  /**
   * Normalize velocity to target speed
   * @param {number} targetSpeed 
   */
  normalizeToSpeed(targetSpeed) {
    const currentSpeed = this.getSpeed();
    if (currentSpeed > 0) {
      const ratio = targetSpeed / currentSpeed;
      this.vx *= ratio;
      this.vy *= ratio;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
  }
  
  /**
   * Bounce off edge of screen
   */
  clampToWindow() {
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    
    if (this.x < -this.radius) this.x = -this.radius;
    if (this.x > canvasWidth + this.radius) this.x = canvasWidth + this.radius;
    if (this.y < -this.radius) this.y = -this.radius;
    if (this.y > canvasHeight + this.radius) this.y = canvasHeight + this.radius;
  }
  
  /**
   * Check if entity is on-screen
   * @returns {boolean}
   */
  isOnScreen() {
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    
    return (
      this.x - this.radius > 0 &&
      this.x + this.radius < canvasWidth &&
      this.y - this.radius > 0 &&
      this.y + this.radius < canvasHeight
    );
  }
  
  /**
   * Clone this entity
   * @returns {BaseEntity} New instance
   */
  clone() {
    const copy = new (Object.getPrototypeOf(this).constructor)({
      x: this.x,
      y: this.y,
      type: this.type,
      visible: this.visible
    });
    
    Object.assign(copy, this);
    return copy;
  }
  
  /**
   * Destroy entity and cleanup resources
   */
  destroy() {
    this.dead = true;
    this.onRemoveCallbacks = [];
    this.data = null;
  }
}

// ============================================
// Movement Patterns
// ============================================

/**
 * Movement pattern interface
 */
const MovementPatterns = {
  /**
   * Linear movement towards target
   * @param {BaseEntity} entity 
   * @param {number} tx Target X
   * @param {number} ty Target Y
   * @param {number} speed 
   */
  chase(entity, tx, ty, speed) {
    const dx = tx - entity.x;
    const dy = ty - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
      entity.vx = (dx / dist) * speed;
      entity.vy = (dy / dist) * speed;
    }
  },
  
  /**
   * Orbit around center point
   * @param {BaseEntity} entity 
   * @param {number} cx Center X
   * @param {number} cy Center Y
   * @param {number} radius 
   * @param {number} speed Angular speed (rad/s)
   */
  orbit(entity, cx, cy, radius, speed) {
    const angle = Date.now() / 1000 * speed;
    entity.x = cx + Math.cos(angle) * radius;
    entity.y = cy + Math.sin(angle) * radius;
    
    // Calculate velocity for physics
    entity.vx = -Math.sin(angle) * radius * speed;
    entity.vy = Math.cos(angle) * radius * speed;
  },
  
  /**
   * Sine wave motion
   * @param {BaseEntity} entity 
   * @param {number} amplitude 
   * @param {number} frequency 
   */
  sineWave(entity, amplitude, frequency) {
    const t = Date.now() / 1000;
    entity.x += Math.sin(t * frequency) * amplitude * 0.016;
  },
  
  /**
   * Random wander
   * @param {BaseEntity} entity 
   * @param {number} maxChange Max velocity change per frame
   */
  wander(entity, maxChange = 0.1) {
    if (Math.random() < 0.05) {
      entity.vx += rand(-maxChange, maxChange);
      entity.vy += rand(-maxChange, maxChange);
    }
    entity.normalizeToSpeed(Math.min(entity.getSpeed(), 100));
  }
};

// Export API
export {
  BaseEntity,
  MovementPatterns
};
