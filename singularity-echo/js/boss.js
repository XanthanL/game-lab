/**
 * Singularity Echo - Boss System Module
 * 
 * Manages boss encounters, warnings, and telegraphed attacks:
 * - Pre-fight warning sequence with countdown
 * - Attack pattern telegraphs (visual/audio cues)
 * - Phase transition effects
 * - AI movement and combat behavior
 * 
 * @module boss
 */

'use strict';

// Import needed modules (ensure they exist before import)
import { bulletsManager } from './bullets.js';
import { particlesManager } from './particles.js';
import { playSound, triggerDamageFlash as vfxTriggerDamageFlash } from './audio.js';
import { notificationSystem, hudSystem } from './ui.js';
import { triggerScreenFreeze as vfxTriggerScreenFreeze } from './vfx.js';

/**
 * Boss attack patterns with telegraph duration
 */
export const BOSS_ATTACKS = {
  spiral: {
    name: '螺旋射击',
    english: 'Spiral Shot',
    telegraphTime: 2.0,
    audioSignal: 'boss_warning',
    visualType: 'spiral_pattern',
    damage: 15
  },
  burst: {
    name: '连射',
    english: 'Burst',
    telegraphTime: 1.5,
    audioSignal: 'boss_warning',
    visualType: 'rapid_fire',
    damage: 8
  },
  multi: {
    name: '多重打击',
    english: 'Multi-Strike',
    telegraphTime: 2.5,
    audioSignal: 'boss_warning',
    visualType: 'spread_attack',
    damage: 20
  }
};

/**
 * Boss movement patterns
 */
const BOSS_MOVEMENT = {
  hover: { speed: 60, amplitude: 100, frequency: 0.002 },
  sineWave: { speed: 40, amplitude: 150, frequency: 0.003 },
  orbit: { speed: 30, radius: 200, frequency: 0.001 }
};

/**
 * Boss encounter manager
 */
class BossSystem {
  constructor() {
    this.activeBoss = null;
    this.warningSequence = false;
    this.telegraphActive = false;
    this.phase = 1;
    
    // Boss movement tracking
    this.bossMovement = null;
    
    console.log('[BossSystem] Initialized');
  }
  
  /**
   * Start boss fight with warning sequence
   * @param {Object} bossConfig - Boss configuration
   * @param {Function} onComplete - Callback when warning ends
   */
  startBossFight(bossConfig, onComplete) {
    this.activeBoss = {
      config: bossConfig,
      phase: 1,
      warningTimer: 3.0 // 3 seconds warning
    };
    
    this.warningSequence = true;
    
    // Play warning sound every second
    const warningInterval = setInterval(() => {
      if (this.activeBoss.warningTimer <= 0) {
        clearInterval(warningInterval);
        this.warningSequence = false;
        
        if (onComplete) {
          onComplete();
        }
        
        // Start the fight after warning
        this.beginCombat();
      } else {
        playSound('boss_warning');
        this.activeBoss.warningTimer -= 1.0;
      }
    }, 1000);
  }
  
  /**
   * Begin actual combat after warning
   */
  beginCombat() {
    console.log('[BossSystem] Combat started!');
    
    // Trigger screen shake for dramatic effect
    triggerShake(15, 10);
    
    // Spawn boss at center-top
    const spawnX = canvas.width / 2;
    const spawnY = 150;
    
    // Create boss enemy
    const bossTemplate = getBossTemplate(this.activeBoss.config.id);
    const boss = new Enemy({
      ...bossTemplate,
      x: spawnX,
      y: spawnY,
      type: 'boss',
      id: this.activeBoss.config.id
    });
    
    Game.enemies.push(boss);
    
    // Update HUD
    hudSystem.setBossName(boss.name || this.activeBoss.config.name.zh);
    hudSystem.updateBossBar(boss.hp, boss.maxHp);
    
    // Mark wave as boss wave
    Game.waveInProgress = true;
  }
  
  /**
   * Telegraph a boss attack (visual + audio cue)
   * @param {string} attackId - Attack pattern ID
   * @param {number} x - Target position
   * @param {number} y - Target position
   */
  telegraphAttack(attackId, x, y) {
    const attack = BOSS_ATTACKS[attackId];
    if (!attack) return;
    
    this.telegraphActive = true;
    
    // Play warning sound
    playSound(attack.audioSignal);
    
    // Show visual telegraph marker
    particlesManager.spawn('warningMarker', x, y, attack.visualType);
    
    // Flash warning indicator
    setTimeout(() => {
      notificationSystem.showToast(`⚠️ ${attack.name}`, 'info');
    }, 500);
    
    // Execute attack after telegraph period
    setTimeout(() => {
      this.executeAttack(attackId, x, y);
      this.telegraphActive = false;
    }, attack.telegraphTime * 1000);
  }
  
  /**
   * Execute a telegraphed attack
   * @param {string} attackId - Attack pattern ID
   * @param {number} x - Origin position
   * @param {number} y - Origin position
   */
  executeAttack(attackId, x, y) {
    switch (attackId) {
      case 'spiral':
        this.spawnSpiralPattern(x, y);
        break;
      case 'burst':
        this.spawnRapidBurst(x, y);
        break;
      case 'multi':
        this.spawnSpreadAttack(x, y);
        break;
    }
  }
  
  /**
   * Spawn spiral bullet pattern
   */
  spawnSpiralPattern(x, y, count = 16) {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + now / 1000;
      bulletsManager.spawnEnemyBullet({
        x, y,
        angle: angle,
        weapon: 'spiral_bolt',
        speed: 200,
        color: '#a855f7'
      });
    }
  }
  
  /**
   * Spawn rapid fire burst
   */
  spawnRapidBurst(x, y) {
    const angles = [-Math.PI/4, -Math.PI/6, 0, Math.PI/6, Math.PI/4];
    angles.forEach((angle, i) => {
      setTimeout(() => {
        bulletsManager.spawnEnemyBullet({
          x, y,
          angle: angle,
          weapon: 'laser_beam',
          speed: 400,
          color: '#fb7185'
        });
      }, i * 100);
    });
  }
  
  /**
   * Spawn spread attack
   */
  spawnSpreadAttack(x, y) {
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 0.5;
      bulletsManager.spawnEnemyBullet({
        x, y,
        angle: offset,
        weapon: 'heavy_round',
        speed: 250,
        color: '#f59e0b'
      });
      
      // Heavy particle burst
      particlesManager.spawn('impact', x, y, 10, '#f59e0b');
    }
    
    // Trigger screen freeze for dramatic impact
    this.triggerScreenFreeze(0.15);
  }
  
  /**
   * Trigger screen freeze for impactful moments
   * @param {number} duration - Freeze duration in seconds
   */
  triggerScreenFreeze(duration = 0.3) {
    // Use VFX system function
    if (typeof vfxTriggerScreenFreeze !== 'undefined') {
      vfxTriggerScreenFreeze(duration);
    } else {
      // Fallback to old method
      if (!Game) return;
      Game.freezeDuration = duration;
      Game.isFrozen = true;
      setTimeout(() => {
        if (Game.state === GameState.PLAYING) {
          Game.isFrozen = false;
          Game.freezeDuration = 0;
        }
      }, duration * 1000);
    }
  }
  
  /**
   * Handle boss phase transition
   * @param {Object} boss - Boss entity
   */
  onBossPhaseChange(boss) {
    this.phase++;
    
    // Visual flash effect
    particlesManager.spawn('phaseFlash', boss.x, boss.y);
    
    // Audio sting
    playSound('level_up');
    
    // Notification
    notificationSystem.showToast(`PHASE ${this.phase}`, 'success');
    
    // Choose next attack pattern
    setTimeout(() => {
      const attacks = ['spiral', 'burst', 'multi'];
      const selected = attacks[Math.floor(Math.random() * attacks.length)];
      
      // Find player position
      if (Game.player && !Game.player.dead) {
        this.telegraphAttack(selected, Game.player.x, Game.player.y);
      }
    }, 2000);
  }
  
  /**
   * Check if boss warning is active
   * @returns {boolean}
   */
  isWarningActive() {
    return this.warningSequence;
  }
  
  /**
   * Update boss AI behavior (called each frame)
   * @param {Enemy} boss - Boss entity
   * @param {number} dt - Delta time
   */
  updateBossAI(boss, dt) {
    if (!this.activeBoss || boss.dead) return;
    
    // Simple AI: hover and move towards player periodically
    const player = Game?.player;
    if (!player || player.dead) return;
    
    // Move toward player if too far
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 300) {
      boss.vx += (dx / distance) * BOSS_MOVEMENT.hover.speed * dt * 60;
      boss.vy += (dy / distance) * BOSS_MOVEMENT.hover.speed * dt * 60;
    } else if (distance < 150) {
      // Back away if too close
      boss.vx -= (dx / distance) * BOSS_MOVEMENT.hover.speed * dt * 60;
      boss.vy -= (dy / distance) * BOSS_MOVEMENT.hover.speed * dt * 60;
    }
    
    // Hover pattern (up/down oscillation)
    if (this.bossMovement) {
      const now = Date.now();
      boss.x += Math.sin(now * this.bossMovement.frequency) * this.bossMovement.amplitude * dt;
      boss.y += Math.cos(now * this.bossMovement.frequency) * this.bossMovement.amplitude * dt * 0.5;
    }
    
    // Clamp to canvas bounds
    boss.x = Math.max(50, Math.min(canvas.width - 50, boss.x));
    boss.y = Math.max(100, Math.min(canvas.height - 100, boss.y));
    
    // Attack cooldown
    if (!this.lastAttackTime) this.lastAttackTime = 0;
    this.lastAttackTime += dt;
    
    // Trigger attack every 3-5 seconds
    if (this.lastAttackTime > 3.0 + Math.random() * 2.0 && !this.telegraphActive) {
      this.triggerRandomAttack();
      this.lastAttackTime = 0;
    }
  }
  
  /**
   * Trigger a random telegraphed attack
   */
  triggerRandomAttack() {
    const attacks = Object.keys(BOSS_ATTACKS);
    const selected = attacks[Math.floor(Math.random() * attacks.length)];
    
    if (Game.player && !Game.player.dead) {
      this.telegraphAttack(selected, Game.player.x, Game.player.y);
    }
  }
}

// Helper function to get boss template from config
function getBossTemplate(bossId) {
  const configs = BOSS_CONFIGS || {
    hydra: { hp: 5000, drops: ['core'] },
    colossus: { hp: 8000, drops: ['heavy_weapon'] },
    nebula: { hp: 6000, drops: ['teleport'] }
  };
  
  const config = configs[bossId] || configs.hydra;
  
  return {
    hp: config.hp,
    maxHp: config.hp,
    scoreValue: 10000,
    type: 'boss',
    id: bossId,
    behavior: 'chase',
    attacks: config.attackPatterns || ['spiral'],
    drops: config.drops || []
  };
}

// Export singleton instance
const bossSystem = new BossSystem();

export { bossSystem, BOSS_ATTACKS };
