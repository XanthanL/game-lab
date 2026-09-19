/**
 * Singularity Echo - Power-Up System Module
 * 
 * Drop & pickup mechanics for temporary/permanent upgrades:
 * - Health packs (healing)
 * - Shield boosters (defense)
 * - Fire rate up (offense)
 * - Homing missiles (tactical)
 * - Explosive shots (AOE damage)
 * - Magnet pickups (resource gathering)
 * 
 * Features:
 * - Physics-based drop spawning
 * - Magnet range pickup mechanic
 * - Visual feedback (glow/pulse)
 * - Stacking buff durations
 * 
 * @module powerups
 */

'use strict';

// ==================== Power-Up Types ====================

export const POWERUP_TYPES = Object.freeze({
  HEALTH: 'health',           // Instant heal (+25 HP)
  SHIELD: 'shield',           // Full shield restore
  FIRE_RATE: 'fire_rate',     // +15% fire rate (30s)
  HOMING: 'homing',           // Missiles track enemies (45s)
  EXPLOSIVE: 'explosive',     // Explosive bullets (45s)
  MAGNET: 'magnet',           // Expand pickup radius (60s)
  RAPID_FIRE: 'rapid_fire',   // +30% speed, stacks (20s)
  TRI_SHOT: 'tri_shot'        // Triple spread shot (30s)
});

const POWERUP_CONFIGS = {
  [POWERUP_TYPES.HEALTH]: {
    color: '#3f7a56',
    glowColor: '#9ed4ac',
    size: 18,
    value: 25,
    spawnChance: 0.15,
    description: 'Instant healing',
    icon: '❤️'
  },
  
  [POWERUP_TYPES.SHIELD]: {
    color: '#33708f',
    glowColor: '#8fd0dd',
    size: 16,
    value: null, // Full restore
    spawnChance: 0.10,
    description: 'Restore shields',
    icon: '🛡️'
  },
  
  [POWERUP_TYPES.FIRE_RATE]: {
    color: '#c9a227',
    glowColor: '#ecd08a',
    size: 14,
    value: 0.15, // +15%
    duration: 30, // seconds
    spawnChance: 0.12,
    description: '+15% Fire Rate',
    icon: '⚡'
  },
  
  [POWERUP_TYPES.HOMING]: {
    color: '#ff6060',
    glowColor: '#ffb08a',
    size: 16,
    value: true,
    duration: 45,
    spawnChance: 0.08,
    description: 'Homing missiles',
    icon: '🎯'
  },
  
  [POWERUP_TYPES.EXPLOSIVE]: {
    color: '#c0402b',
    glowColor: '#e0573c',
    size: 18,
    value: true,
    duration: 45,
    spawnChance: 0.10,
    description: 'Explosive shots',
    icon: '💥'
  },
  
  [POWERUP_TYPES.MAGNET]: {
    color: '#7cb2dd',
    glowColor: '#d8ecff',
    size: 12,
    value: 150, // Pickup radius in pixels
    duration: 60,
    spawnChance: 0.05,
    description: 'Expand magnet range',
    icon: '🧲'
  },
  
  [POWERUP_TYPES.RAPID_FIRE]: {
    color: '#ffd54a',
    glowColor: '#ffeaa7',
    size: 13,
    value: 0.30, // +30% (stackable)
    duration: 20,
    spawnChance: 0.08,
    description: '+30% Attack Speed',
    icon: '🔥'
  },
  
  [POWERUP_TYPES.TRI_SHOT]: {
    color: '#9a7aab',
    glowColor: '#c2a3d0',
    size: 17,
    value: true,
    duration: 30,
    spawnChance: 0.06,
    description: 'Triple spread shot',
    icon: '💫'
  }
};

// ==================== Power-Up Item Class ====================

class PowerUpItem {
  constructor(options = {}) {
    this.type = options.type || POWERUP_TYPES.HEALTH;
    
    // Position & movement
    this.x = options.x || canvas.width / 2;
    this.y = options.y || canvas.height / 2;
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = (Math.random() - 0.5) * 50;
    
    // Config
    this.config = POWERUP_CONFIGS[this.type];
    this.size = this.config.size;
    this.value = options.value !== undefined ? options.value : this.config.value;
    this.duration = options.duration || this.config.duration;
    
    // Lifecycle
    this.spawnTime = Date.now();
    this.lifeTime = options.lifeTime || 8000; // 8 seconds before despawn
    this.dead = false;
    
    // Animation state
    this.pulseOffset = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 2;
    
    // Audio feedback
    this.pickupSoundPlayed = false;
    
    console.log(`[PowerUp] Spawned ${this.type} at (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
  }
  
  update(dt) {
    if (this.dead) return;
    
    // Update life timer
    const age = Date.now() - this.spawnTime;
    if (age > this.lifeTime) {
      this.expire();
      return;
    }
    
    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Bounce off screen edges
    if (this.x < this.size || this.x > canvas.width - this.size) {
      this.vx *= -1;
    }
    if (this.y < this.size || this.y > canvas.height - this.size) {
      this.vy *= -1;
    }
    
    // Rotate for visual flair
    this.rotation += this.rotationSpeed * dt;
  }
  
  expire() {
    this.dead = true;
    
    // Fade out particles
    spawnFadeOutParticles(this.x, this.y, this.config.color);
  }
  
  render(ctx) {
    if (this.dead) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Pulsing glow effect
    const pulse = Math.sin(Date.now() / 200 + this.pulseOffset) * 0.15 + 0.85;
    const glowSize = this.size * (1.2 + 0.3 * (1 - pulse));
    
    // Outer glow
    ctx.shadowColor = this.config.glowColor;
    ctx.shadowBlur = 20 * pulse;
    
    // Main body
    ctx.fillStyle = this.config.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    if (this.type === POWERUP_TYPES.MAGNET) {
      // Diamond shape for magnet
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size, 0);
    } else {
      // Circle for others
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Icon/symbol
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.config.icon, 0, 0);
    
    ctx.restore();
    
    // Draw duration bar for time-based buffs
    if (this.duration) {
      const age = Date.now() - this.spawnTime;
      const progress = age / this.lifeTime;
      const barWidth = 40;
      const barHeight = 4;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(this.x - barWidth / 2, this.y + this.size + 6, barWidth, barHeight);
      
      ctx.fillStyle = this.config.color;
      ctx.fillRect(this.x - barWidth / 2, this.y + this.size + 6, barWidth * (1 - progress), barHeight);
    }
  }
  
  intersects(player) {
    if (this.dead) return false;
    
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Magnet range check first
    const magnetRange = player.magnetRange || 50; // Default magnet range
    return distance < magnetRange + this.size;
  }
  
  applyTo(player) {
    this.dead = true;
    
    switch (this.type) {
      case POWERUP_TYPES.HEALTH:
        player.heal(this.value);
        audioManager.playSound('level_up');
        break;
        
      case POWERUP_TYPES.SHIELD:
        player.shield = player.shieldMax;
        audioManager.playSound('shield');
        break;
        
      case POWERUP_TYPES.FIRE_RATE:
        player.addBuff('fireRate', this.value, this.duration);
        audioManager.playSound('powerup');
        break;
        
      case POWERUP_TYPES.HOMING:
        player.activateWeapon('homing_missiles', this.duration);
        audioManager.playSound('powerup');
        break;
        
      case POWERUP_TYPES.EXPLOSIVE:
        player.activateWeapon('explosive_shots', this.duration);
        audioManager.playSound('powerup');
        break;
        
      case POWERUP_TYPES.MAGNET:
        player.setMagnetRange(this.value, this.duration);
        audioManager.playSound('magnet');
        break;
        
      case POWERUP_TYPES.RAPID_FIRE:
        player.addBuff('attackSpeed', this.value, this.duration);
        audioManager.playSound('rapid');
        break;
        
      case POWERUP_TYPES.TRI_SHOT:
        player.activateWeapon('tri_shot', this.duration);
        audioManager.playSound('powerup');
        break;
    }
    
    console.log(`[PowerUp] Applied ${this.type} to player`);
  }
}

// ==================== Power-Up Spawner ====================

const PowerUpSpawner = {
  items: [],
  maxItems: 10,
  
  /**
   * Spawn power-up from enemy death
   */
  dropFromEnemy(enemy, chance = 0.10) {
    if (Math.random() > chance) return null;
    
    // Pick random type based on weights
    const types = this.getRandomType();
    const item = new PowerUpItem({
      type: types,
      x: enemy.x,
      y: enemy.y
    });
    
    this.items.push(item);
    return item;
  },
  
  /**
   * Pick random power-up type with balanced weights
   */
  getRandomType() {
    const weightedPool = [];
    
    for (const [type, config] of Object.entries(POWERUP_CONFIGS)) {
      const weight = config.spawnChance * 100; // Normalize to 1-15 range
      for (let i = 0; i < weight; i++) {
        weightedPool.push(type);
      }
    }
    
    const index = Math.floor(Math.random() * weightedPool.length);
    return weightedPool[index];
  },
  
  /**
   * Spawn multiple power-ups in sequence (for boss/elite)
   */
  cascadeSpawn(x, y, count = 3, delay = 200) {
    let currentDelay = 0;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const item = this.dropFromEnemy({ x, y }, 0.5);
        if (item) {
          spawnPickupParticles(x, y, item.config.color);
        }
      }, currentDelay);
      currentDelay += delay;
    }
  },
  
  /**
   * Update all active power-ups
   */
  update(dt) {
    this.items = this.items.filter(item => {
      item.update(dt);
      return !item.dead;
    });
  },
  
  /**
   * Render all active power-ups
   */
  render(ctx) {
    this.items.forEach(item => item.render(ctx));
  },
  
  /**
   * Check collisions with player
   */
  checkCollisions(player) {
    for (const item of this.items) {
      if (item.intersects(player)) {
        item.applyTo(player);
        break; // Only pick up one at a time
      }
    }
  },
  
  /**
   * Clear all power-ups
   */
  clear() {
    this.items = [];
  }
};

// ==================== Particle Effects Helpers ====================

function spawnPickupParticles(x, y, color) {
  particlesManager.spawn('powerUpPickup', x, y, color, 20);
}

function spawnFadeOutParticles(x, y, color) {
  particlesManager.spawn('impact', x, y, color, 10);
}

// ==================== Player Extension ====================

Player.prototype = Object.assign(Player.prototype, {
  addBuff(buffType, value, duration) {
    const key = `${buffType}Buff`;
    this.buffs[key] = (this.buffs[key] || 0) + value;
    
    // Clamp maximum stack
    const maxStack = buffType === 'fireRate' ? 0.5 : 
                     buffType === 'attackSpeed' ? 1.0 : 0.5;
    this.buffs[key] = Math.min(this.buffs[key], maxStack);
    
    // Auto-expire via timeout
    setTimeout(() => {
      if (this.buffs[key]) {
        this.buffs[key] -= value;
        if (this.buffs[key] < 0.01) this.buffs[key] = 0;
      }
    }, duration * 1000);
    
    // HUD notification
    hudSystem.showFloatingText(
      this.x, this.y - 20,
      `${buffType.toUpperCase()} +${value * 100}%`,
      POWERUP_CONFIGS[buffType].color
    );
  },
  
  setMagnetRange(radius, duration) {
    this.originalMagnet = this.magnet || 50;
    this.magnet = radius;
    
    setTimeout(() => {
      this.magnet = this.originalMagnet;
    }, duration * 1000);
    
    hudSystem.showFloatingText(
      this.x, this.y - 20,
      `MAGNET +${radius}px`,
      POWERUP_CONFIGS.MAGNET.color
    );
  },
  
  activateWeapon(weaponType, duration) {
    // Temporary weapon activation
    const originalWeapons = [...this.weapons.active];
    
    // Add special weapon temporarily
    if (weaponType === 'homing_missiles') {
      this.weapons.active.push({
        id: 'homing',
        fire: (t, player) => {
          bulletsManager.spawnPlayerBullet({
            x: player.x,
            y: player.y - 20,
            angle: Math.PI / 2,
            weapon: BULLET_TYPES.HOMING_MISSILE,
            homing: true
          });
        }
      });
    }
    
    // Auto-remove after duration
    setTimeout(() => {
      this.weapons.active = originalWeapons;
    }, duration * 1000);
    
    hudSystem.showFloatingText(
      this.x, this.y - 20,
      `WEAPON: ${weaponType}`,
      '#c9a227'
    );
  }
});

// Export API
export {
  POWERUP_TYPES,
  POWERUP_CONFIGS,
  PowerUpItem,
  PowerUpSpawner
};
