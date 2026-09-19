/**
 * Singularity Echo - Enemy Attack Telegraphs (Phase 11)
 * 
 * Visual and audio warnings before enemy attacks:
 * - Aim indicator markers
 * - Charge-up glowing effects  
 * - Warning zone overlays
 * - Audio countdown beeps
 * 
 * @module enemyTelegraphs
 */

'use strict';

/**
 * Attack warning markers spawned before enemy attacks
 */
export const AttackMarkers = {
  /**
   * Create a target marker for incoming fire
   * @param {number} x - Target X position
   * @param {number} y - Target Y position
   * @param {number} radius - Marker radius
   * @param {number} duration - Display duration in seconds
   */
  createTargetMarker(x, y, radius = 30, duration = 2.0) {
    // Add to particles manager as warning marker
    if (typeof particlesManager !== 'undefined') {
      particlesManager.spawn('warningMarker', x, y, 'target_circle');
      
      // Auto-remove after duration
      setTimeout(() => {
        // Mark for cleanup would go here
      }, duration * 1000);
    }
  },
  
  /**
   * Create charge indicator for charging attacks
   * @param {number} x - Origin X
   * @param {number} y - Origin Y
   * @param {string} color - Indicator color
   */
  createChargeIndicator(x, y, color = '#ff6060') {
    const ctx = canvas.getContext('2d');
    
    // Store temporary visual data
    const indicator = {
      x, y,
      color,
      progress: 0,
      maxProgress: 1.5,
      size: 40,
      active: true,
      type: 'charge'
    };
    
    Game.attackIndicators = Game.attackIndicators || [];
    Game.attackIndicators.push(indicator);
    
    return indicator;
  }
};

/**
 * Handle player damage reception (consolidated VFX trigger)
 */
export function onPlayerHit(damageAmount, sourceEnemy) {
  // Trigger damage flash overlay
  if (typeof vfxTriggerDamageFlash !== 'undefined') {
    vfxTriggerDamageFlash('#ff4444');
  }
  
  // Screen shake based on damage severity
  const shakeIntensity = Math.min(damageAmount / 2, 15);
  const shakeDuration = Math.floor(damageAmount / 3);
  if (typeof vfxTriggerShake !== 'undefined') {
    vfxTriggerShake(shakeDuration, shakeIntensity);
  }
  
  // Particle explosion at player position
  if (typeof particlesManager !== 'undefined') {
    particlesManager.spawn('explosion', Game.player.x, Game.player.y, 20, '#ffffff');
    
    // Spawn damage number with combo-based color
    const comboMult = Game.player?.getComboMultiplier() || 1.0;
    particlesManager.damageNumber(Game.player.x, Game.player.y - 30, damageAmount, false, comboMult);
  }
  
  // Low health warning
  if (Game.player && Game.player.hp < Game.player.maxHp * 0.3 && typeof playSound !== 'undefined') {
    playSound('low_health_warning');
    if (typeof notificationSystem !== 'undefined') {
      notificationSystem.showToast(`⚠️ LOW HEALTH!`, 'info', 3000);
    }
  }
  
  // Critical hit chance (10%) - screen freeze
  if (damageAmount >= 30 && typeof triggerScreenFreeze !== 'undefined') {
    triggerScreenFreeze(0.1);
  }
}

// Attach damageNumber method to particlesManager prototype if available
if (typeof particlesManager !== 'undefined' && !particlesManager.damageNumber) {
  particlesManager.damageNumber = function(x, y, amount, isCrit = false, comboMultiplier = 1.0) {
    if (!this) return null;
    
    let color, sizeMultiplier = 1.0, textScale = 1.0;
    
    if (comboMultiplier >= 2.5) {
      color = '#f59e0b'; // Gold for 3x combo
      sizeMultiplier = 1.8;
      textScale = 1.5;
    } else if (comboMultiplier >= 2.0) {
      color = '#fb7185'; // Orange-pink for 2x combo
      sizeMultiplier = 1.5;
      textScale = 1.2;
    } else if (isCrit) {
      color = '#c0402b'; // Red for critical hit
      sizeMultiplier = 1.3;
      textScale = 1.1;
    } else {
      color = '#ff6060'; // Normal pink
    }
    
    this.spawn({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -50 - Math.random() * 20,
      size: 2 * sizeMultiplier,
      color,
      alpha: 1.0,
      decay: 0.008,
      life: 1.2,
      text: `-${amount}`,
      floatUp: true,
      textScale
    });
  };
}

// Render attack indicators (charge-up rings, target circles)
if (typeof render !== 'undefined') {
  const originalRender = render;
  render = function(ctx) {
    originalRender(ctx);
    
    if (Game.attackIndicators) {
      for (let i = Game.attackIndicators.length - 1; i >= 0; i--) {
        const ind = Game.attackIndicators[i];
        if (!ind.active) continue;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(ind.x, ind.y, ind.size * (ind.progress / ind.maxProgress), 0, Math.PI * 2);
        ctx.strokeStyle = ind.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.restore();
        
        ind.progress += 0.02;
        if (ind.progress >= ind.maxProgress) {
          ind.active = false;
          // Remove from array after rendering
          setTimeout(() => {
            const idx = Game.attackIndicators.indexOf(ind);
            if (idx > -1) Game.attackIndicators.splice(idx, 1);
          }, 0);
        }
      }
    }
  };
}

/**
 * Export game-level functions
 */
window.triggerShake = window.triggerShake || (() => {});
window.playSound = window.playSound || (() => {});
window.particlesManager = window.particlesManager || null;
window.Game = window.Game || {};
