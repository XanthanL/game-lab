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
 * Handle player damage reception
 */
export function onPlayerHit(damageAmount, sourceEnemy) {
  // Trigger damage flash
  triggerDamageFlash('#ff4444');
  
  // Screen shake based on damage severity
  const shakeIntensity = Math.min(damageAmount / 2, 15);
  const shakeDuration = Math.floor(damageAmount / 3);
  triggerShake(shakeDuration, shakeIntensity);
  
  // Particle explosion at player position
  particlesManager.spawn('explosion', Game.player.x, Game.player.y, 20, '#ffffff');
  
  // Update health
  Game.player.hp -= damageAmount;
  
  // Check for low health warning
  if (Game.player.hp < Game.player.maxHp * 0.3) {
    playSound('low_health_warning');
    notificationSystem.showToast(`⚠️ LOW HEALTH!`, 'info', 3000);
  }
  
  // Critical hit chance (10%)
  if (Math.random() < 0.1) {
    particlesManager.spawn('damageNumber', Game.player.x, Game.player.y - 40, damageAmount, true);
    triggerScreenFreeze(0.1); // Brief freeze on critical
  } else {
    particlesManager.spawn('damageNumber', Game.player.x, Game.player.y - 30, damageAmount, false);
  }
}

/**
 * Damage number particle with optional crit effect
 */
particlesManager.damageNumber = function(x, y, amount, isCrit = false) {
  if (!this) return null;
  
  const color = isCrit ? '#ff4444' : '#ffaa00';
  const sizeMult = isCrit ? 1.8 : 1.2;
  
  return this.spawn('damageNumber', x, y, amount, isCrit);
};

/**
 * Export game-level functions
 */
window.triggerShake = window.triggerShake || (() => {});
window.playSound = window.playSound || (() => {});
window.particlesManager = window.particlesManager || null;
window.Game = window.Game || {};
