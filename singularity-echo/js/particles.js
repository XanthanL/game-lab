/**
 * Singularity Echo - Particle Effects System
 * 
 * High-performance particle system for visual effects:
 * - Explosions & impacts
 * - Weapon trails
 * - Shield effects
 * - Power-up glows
 * 
 * @module particles
 */

'use strict';

// ==================== 粒子基础类 ====================

class Particle {
  constructor(options = {}) {
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.vx = options.vx || (Math.random() - 0.5) * 2;
    this.vy = options.vy || (Math.random() - 0.5) * 2;
    
    this.size = options.size || Math.random() * 3 + 1;
    this.color = options.color || '#ffffff';
    this.alpha = options.alpha || 1.0;
    this.decay = options.decay || Math.random() * 0.03 + 0.01;
    
    this.life = options.life || 1.0;
    this.maxLife = this.life;
    this.dead = false;
    
    this.gravity = options.gravity || 0;
    this.friction = options.friction || 1.0;
  }
  
  update(dt) {
    if (this.dead) return;
    
    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Apply gravity
    if (this.gravity !== 0) {
      this.vy += this.gravity * dt;
    }
    
    // Apply friction
    if (this.friction !== 1.0) {
      this.vx *= this.friction;
      this.vy *= this.friction;
    }
    
    // Update life
    this.life -= dt;
    if (this.life <= 0) {
      this.life = 0;
      this.dead = true;
    }
    
    // Update alpha
    this.alpha = this.life / this.maxLife;
  }
  
  render(ctx) {
    if (this.dead || this.alpha <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = this.alpha;
    
    // Render special particle types
    if (this.isCrosshair) {
      // Crosshair indicators (target markers)
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      
      const size = 8;
      // Top
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - size);
      ctx.lineTo(this.x, this.y - size * 2);
      ctx.stroke();
      // Bottom
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + size);
      ctx.lineTo(this.x, this.y + size * 2);
      ctx.stroke();
      // Left
      ctx.beginPath();
      ctx.moveTo(this.x - size, this.y);
      ctx.lineTo(this.x - size * 2, this.y);
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(this.x + size, this.y);
      ctx.lineTo(this.x + size * 2, this.y);
      ctx.stroke();
      
    } else if (this.isRing || this.isSpiral) {
      // Ring or spiral pattern particles
      const radius = this.size;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth || 2;
      ctx.setLineDash(this.dashPattern || []);
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
    } else if (this.isGlow) {
      // Glow effect for flashes
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size * 2
      );
      gradient.addColorStop(0, this.color);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      ctx.fill();
      
    } else {
      // Standard particle circle
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Render text if present
    if (this.text && typeof this.text === 'string') {
      const fontSize = (this.size * 10) * (this.textScale || 1.0);
      ctx.font = `bold ${fontSize}px Consolas, monospace`;
      ctx.fillStyle = this.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = -3;
      
      ctx.fillText(this.text, this.x, this.y - 5);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
    }
    
    ctx.restore();
  }
}

// ==================== 特效类型工厂 ====================

const ParticleEffects = {
  /**
   * Create warning marker (target circle or attack indicator)
   */
  warningMarker(x, y, type = 'target_circle') {
    const particles = [];
    
    if (type === 'target_circle') {
      // Animated expanding ring for targeting
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        particles.push(new Particle({
          x, y,
          vx: 0,
          vy: 0,
          size: 3,
          color: '#ff6060',
          alpha: 0.7,
          decay: 0.015,
          life: 1.5,
          floatUp: true,
          rotation: angle
        }));
      }
      
      // Add expanding dashed ring as particle
      const ringParticle = new Particle({
        x, y,
        vx: 0,
        vy: 0,
        size: 20,
        color: '#ff4444',
        alpha: 0.8,
        decay: 0.008,
        life: 2.0,
        lineWidth: 3,
        isRing: true,
        dashPattern: [10, 5],
        rotationOffset: 0
      });
      particles.push(ringParticle);
      
    } else if (type === 'spiral_pattern') {
      // Spiral attack preview - multiple rings
      for (let spiral = 0; spiral < 3; spiral++) {
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2 + spiral * Math.PI / 2;
          const radius = spiral * 40 + 20;
          particles.push(new Particle({
            x: x + Math.cos(angle) * radius,
            y: y + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            size: 2,
            color: '#aa88ff',
            alpha: 0.6,
            decay: 0.01,
            life: 2.0,
            lineWidth: 2,
            isRing: true,
            isSpiral: true
          }));
        }
      }
    } else if (type === 'rapid_fire') {
      // Rapid fire pattern - crosshairs
      const size = 30;
      particles.push(new Particle({
        x: x - size, y,
        vx: 0, vy: 0,
        size: 4, color: '#ff4444', alpha: 0.8,
        decay: 0.01, life: 1.5, isCrosshair: true
      }));
      particles.push(new Particle({
        x: x + size, y,
        vx: 0, vy: 0,
        size: 4, color: '#ff4444', alpha: 0.8,
        decay: 0.01, life: 1.5, isCrosshair: true
      }));
      particles.push(new Particle({
        x, y: y - size,
        vx: 0, vy: 0,
        size: 4, color: '#ff4444', alpha: 0.8,
        decay: 0.01, life: 1.5, isCrosshair: true
      }));
      particles.push(new Particle({
        x, y: y + size,
        vx: 0, vy: 0,
        size: 4, color: '#ff4444', alpha: 0.8,
        decay: 0.01, life: 1.5, isCrosshair: true
      }));
      
    } else if (type === 'spread_attack') {
      // Spread attack - arc indicators
      for (let arc = 0; arc < 3; arc++) {
        const angle = (arc / 3) * Math.PI * 2 - Math.PI / 2;
        for (let i = 0; i < 8; i++) {
          const spreadAngle = angle + (i / 8) * Math.PI * 0.5;
          particles.push(new Particle({
            x: x + Math.cos(spreadAngle) * 50,
            y: y + Math.sin(spreadAngle) * 50,
            vx: Math.cos(spreadAngle) * 30,
            vy: Math.sin(spreadAngle) * 30,
            size: 3,
            color: '#ffaa44',
            alpha: 0.7,
            decay: 0.012,
            life: 1.8
          }));
        }
      }
    }
    
    return particles;
  },
  
  /**
   * Create phase flash effect (boss transition)
   */
  phaseFlash(x, y, count = 30, color = '#ffd54a') {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        size: Math.random() * 5 + 3,
        color: color,
        alpha: 0.9,
        decay: 0.02,
        life: 0.8
      }));
    }
    
    // Add bright central flash
    particles.push(new Particle({
      x, y,
      vx: 0, vy: 0,
      size: 20,
      color: '#ffffff',
      alpha: 1.0,
      decay: 0.05,
      life: 0.4,
      isGlow: true
    }));
    
    return particles;
  },
  
  /**
   * Create explosion effect
   */
  explosion(x, y, count = 30, color = '#ff4040') {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = Math.random() * 200 + 50;
      particles.push(new Particle({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        decay: Math.random() * 0.02 + 0.01,
        life: 0.8,
        gravity: 100,
        friction: 0.95
      }));
    }
    return particles;
  },
  
  /**
   * Create impact spark effect
   */
  impact(x, y, color = '#ffd54a', count = 15) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: -Math.random() * 300 - 50,
        size: Math.random() * 3 + 1,
        color: color,
        decay: 0.015,
        life: 0.5,
        gravity: 200,
        friction: 0.9
      }));
    }
    return particles;
  },
  
  /**
   * Create energy trail behind moving object
   */
  trail(x, y, color = '#7cb2dd', length = 10) {
    const particles = [];
    for (let i = 0; i < length; i++) {
      const offset = i * 5;
      particles.push(new Particle({
        x: x - Math.sin(Date.now() / 200) * offset,
        y: y - Math.cos(Date.now() / 200) * offset,
        vx: 0,
        vy: 50,
        size: (length - i) * 0.3,
        color: color,
        alpha: 1 - i / length,
        decay: 0.05,
        life: 0.6,
        friction: 0.98
      }));
    }
    return particles;
  },
  
  /**
   * Create shield bubble effect
   */
  shieldBubble(x, y, radius = 40, color = '#33708f', count = 20) {
    const particles = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (now / 500) % (Math.PI * 2);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      
      particles.push(new Particle({
        x: px,
        y: py,
        vx: Math.cos(angle) * 30,
        vy: Math.sin(angle) * 30,
        size: 2,
        color: color,
        alpha: 0.6,
        decay: 0.02,
        life: 0.8,
        friction: 0.99
      }));
    }
    return particles;
  },
  
  /**
   * Create power-up pickup glow
   */
  powerUpPickup(x, y, color = '#c9a227', count = 25) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        size: Math.random() * 5 + 2,
        color: color,
        decay: 0.01,
        life: 1.0,
        alpha: 0.8
      }));
    }
    return particles;
  },
  
  /**
   * Create wave start announcement rings
   */
  waveAnnouncement(x, y, maxRadius = 200, color = '#d9dfe8', count = 3) {
    const particles = [];
    const now = Date.now();
    for (let ring of Array(count)) {
      const offset = ring * 80;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2 + (now + offset) / 300;
        particles.push(new Particle({
          x: x + Math.cos(angle) * offset,
          y: y + Math.sin(angle) * offset,
          vx: 0,
          vy: 0,
          size: 3,
          color: color,
          alpha: 0.5,
          decay: 0.02,
          life: 0.6,
          friction: 0.99
        }));
      }
    }
    return particles;
  },
  
  /**
   * Create death shatter effect
   */
  deathShatter(x, y, color = '#cc79a7', count = 40) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle({
        x, y,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 0.5) * 400,
        size: Math.random() * 3 + 1,
        color: color,
        decay: 0.02,
        life: 1.0,
        gravity: 150,
        friction: 0.9
      }));
    }
    return particles;
  },
  
  /**
   * Create boss entrance shockwave
   */
  bossShockwave(x, y, maxRadius = 300, color = '#e0573c') {
    const particles = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      particles.push(new Particle({
        x: x + Math.cos(angle) * 20,
        y: y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * 150,
        vy: Math.sin(angle) * 150,
        size: 4,
        color: color,
        alpha: 0.8,
        decay: 0.015,
        life: 1.5,
        friction: 0.98
      }));
    }
    return particles;
  },
  
  /**
   * Create damage number popup
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} amount - Damage/score amount
   * @param {boolean} isCrit - Is critical hit
   * @param {number} comboMultiplier - Current combo multiplier for color variation
   */
  damageNumber(x, y, amount, isCrit = false, comboMultiplier = 1.0) {
    // Determine color based on combo level and crit
    let color;
    let sizeMultiplier = 1.0;
    let textScale = 1.0;
    
    if (comboMultiplier >= 2.5) {
      // 3x combo - gold/legendary
      color = '#f59e0b';
      sizeMultiplier = 1.8;
      textScale = 1.5;
    } else if (comboMultiplier >= 2.0) {
      // 2x combo - orange/combo
      color = '#fb7185';
      sizeMultiplier = 1.5;
      textScale = 1.2;
    } else if (isCrit) {
      // Critical hit - red
      color = '#c0402b';
      sizeMultiplier = 1.3;
      textScale = 1.1;
    } else {
      // Normal - pink
      color = '#ff6060';
    }
    
    return [new Particle({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -50 - Math.random() * 20,
      size: 2 * sizeMultiplier,
      color: color,
      alpha: 1.0,
      decay: 0.008,
      life: 1.2,
      text: `-${amount}`,
      floatUp: true,
      textScale: textScale
    })];
  },
  
  /**
   * Create health pack regeneration
   */
  regenEffect(x, y, color = '#9ed4ac', count = 15) {
    const particles = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      particles.push(new Particle({
        x: x + Math.cos(angle) * 15,
        y: y + Math.sin(angle) * 15,
        vx: Math.cos(angle) * 50,
        vy: Math.sin(angle) * 50,
        size: 2,
        color: color,
        alpha: 0.8,
        decay: 0.01,
        life: 1.0,
        friction: 0.97
      }));
    }
    return particles;
  }
};

// ==================== 粒子管理器 (Phase 17+ Optimization) ====================

class ParticleManager {
  constructor() {
    this.particles = [];
    this.baseMaxParticles = 500; // Performance baseline
    this.currentMaxParticles = this.baseMaxParticles;
    
    // Dynamic capacity management
    this.activeEnemies = 0;
    this.bossFightActive = false;
    
    console.log('[ParticleManager] Initialized with', this.baseMaxParticles, 'base capacity');
  }
  
  /**
   * Adjust particle pool capacity based on game state (Performance optimization - Priority Aware)
   */
  adjustCapacity(enemyCount, isBossFight = false) {
    const wasBossFight = this.bossFightActive;
    this.bossFightActive = isBossFight;
    this.activeEnemies = enemyCount;
    
    // Increase capacity during boss fights
    if (isBossFight) {
      this.currentMaxParticles = Math.max(
        this.currentMaxParticles,
        this.baseMaxParticles + 200
      );
    }
    
    // Scale based on enemy count (more enemies = more particles allowed)
    const enemyFactor = 1 + Math.min(enemyCount / 20, 1.5); // Cap at +150%
    
    // Reduce if idle to save resources
    if (!isBossFight && enemyCount < 3) {
      this.currentMaxParticles = this.baseMaxParticles;
    } else {
      this.currentMaxParticles = Math.floor(this.baseMaxParticles * enemyFactor);
    }
    
    // Enforce new limit immediately by trimming excess (Priority-aware: delete low-priority first)
    while (this.particles.length > this.currentMaxParticles) {
      // Find lowest priority particle for removal
      let victimIndex = -1;
      let lowestPriority = Infinity;
      
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        
        // Priority levels (lower number = higher priority, won't be deleted until necessary)
        // 1 = damage numbers (never delete unless critical)
        // 2 = phase flashes, warning markers (keep visible)
        // 3 = explosions, impacts (can delete if needed)
        // 4 = trails, decorative (delete first)
        let priority = 4;
        
        if (p.type === 'damageNumber' || p.text?.includes('-')) {
          priority = 1; // Critical feedback - last resort
        } else if (p.isRing || p.isCrosshair || p.isGlow) {
          priority = 2; // Important visual cues
        } else if (p.spawnType === 'explosion' || p.spawnType === 'impact') {
          priority = 3; // Standard effects
        }
        
        if (priority < lowestPriority) {
          lowestPriority = priority;
          victimIndex = i;
        }
      }
      
      // Remove the lowest priority particle
      if (victimIndex >= 0) {
        this.particles.splice(victimIndex, 1);
      } else {
        // No suitable victim found, remove from back (fallback)
        this.particles.pop();
      }
    }
  }
  
  /**
   * Spawn particles from effect factory (Priority-aware)
   */
  spawn(effectName, ...args) {
    const effect = ParticleEffects[effectName];
    if (!effect) {
      console.warn(`[Particles] Unknown effect: ${effectName}`);
      return [];
    }
    
    const newParticles = effect(...args);
    
    // Mark each particle with its type for priority management
    newParticles.forEach(p => {
      p.type = effectName;
      
      // Set additional metadata
      if (effectName === 'damageNumber') {
        p.priority = 1; // Critical feedback
        p.neverDeleteEarly = true;
      } else if (['warningMarker', 'phaseFlash'].includes(effectName)) {
        p.priority = 2; // Important visual cues
        p.neverDeleteEarly = true;
      } else if (['explosion', 'impact', 'deathShatter'].includes(effectName)) {
        p.priority = 3; // Standard effects
      } else {
        p.priority = 4; // Decorative/trails
      }
    });
    
    // Enforce dynamic limit (priority-aware)
    while (this.particles.length + newParticles.length > this.currentMaxParticles) {
      let victimIndex = -1;
      let lowestPriority = Infinity;
      let hasHighPriority = false;
      
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        
        // Check if this is high-priority (shouldn't be deleted unless necessary)
        if (p.neverDeleteEarly || (p.priority <= 2 && p.life > 0.3)) {
          hasHighPriority = true;
        }
        
        if (p.priority < lowestPriority) {
          lowestPriority = p.priority;
          victimIndex = i;
        }
      }
      
      // Only delete if we have a suitable victim or no high-priority particles exist
      if (victimIndex >= 0 && (!hasHighPriority || lowestPriority >= 3)) {
        this.particles.splice(victimIndex, 1);
      } else if (lowestPriority >= 3) {
        // Delete lowest priority even if some are medium-high
        this.particles.splice(victimIndex, 1);
      } else {
        // No suitable victim found, remove from back (fallback - should rarely happen)
        this.particles.pop();
      }
    }
    
    this.particles.push(...newParticles);
    return newParticles;
  }
  
  /**
   * Update all particles (with optimization)
   */
  update(dt) {
    // Remove dead particles and inactive particles faster than active ones
    const beforeCount = this.particles.length;
    this.particles = this.particles.filter(p => {
      if (p.dead || p.life <= 0) return false;
      p.update(dt);
      return true;
    });
    
    const removedCount = beforeCount - this.particles.length;
    if (removedCount > 50) {
      // Log large cleanup operations for debugging
      console.log(`[Particles] Cleaned up ${removedCount} particles`);
    }
    
    // Update remaining
    this.particles.forEach(p => p.update(dt));
  }
  
  /**
   * Render all particles
   */
  render(ctx) {
    // Batch rendering can be added here for performance
    this.particles.forEach(p => p.render(ctx));
  }
  
  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
    this.currentMaxParticles = this.baseMaxParticles;
  }
  
  /**
   * Get particle count
   */
  get count() {
    return this.particles.length;
  }
  
  /**
   * Emergency cleanup (call when memory is high)
   */
  emergencyCleanup(targetCount = 200) {
    while (this.particles.length > targetCount) {
      this.particles.shift();
    }
  }
}

// ==================== 导出 API ====================

export {
  Particle,
  ParticleEffects,
  ParticleManager
};

// Export singleton for easy access
export const particlesManager = new ParticleManager();
