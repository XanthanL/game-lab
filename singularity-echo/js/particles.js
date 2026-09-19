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
    
    // Render particle circle
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
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

// ==================== 粒子管理器 ====================

class ParticleManager {
  constructor() {
    this.particles = [];
    this.maxParticles = 500; // Performance limit
  }
  
  /**
   * Spawn particles from effect factory
   */
  spawn(effectName, ...args) {
    const effect = ParticleEffects[effectName];
    if (!effect) {
      console.warn(`[Particles] Unknown effect: ${effectName}`);
      return [];
    }
    
    const newParticles = effect(...args);
    
    // Enforce limit
    while (this.particles.length + newParticles.length > this.maxParticles) {
      this.particles.shift();
    }
    
    this.particles.push(...newParticles);
    return newParticles;
  }
  
  /**
   * Update all particles
   */
  update(dt) {
    // Remove dead particles
    this.particles = this.particles.filter(p => !p.dead);
    
    // Update remaining
    this.particles.forEach(p => p.update(dt));
  }
  
  /**
   * Render all particles
   */
  render(ctx) {
    this.particles.forEach(p => p.render(ctx));
  }
  
  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
  }
  
  /**
   * Get particle count
   */
  get count() {
    return this.particles.length;
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
