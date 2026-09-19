/**
 * Singularity Echo - Visual Effects Manager (Phase 11)
 * 
 * Enhanced visual feedback system:
 * - Screen shake intensity control
 * - Slow motion transitions  
 * - Screen freeze impact frames
 * - Damage number variations
 * - Player hit flash effects
 * - Particle explosions
 * 
 * @module vfx
 */

'use strict';

/**
 * VFX state management
 */
export const VFXState = {
  shake: {
    duration: 0,
    intensity: 5,
    x: 0,
    y: 0
  },
  slowMo: {
    active: false,
    scale: 1.0,
    targetScale: 1.0,
    transitionTime: 0.3
  },
  freeze: {
    active: false,
    duration: 0,
    frameOffset: 0
  },
  flash: {
    active: false,
    color: '#ff0000',
    alpha: 0,
    decay: 2.0
  }
};

/**
 * Trigger screen shake with configurable parameters
 * @param {number} frames - Duration in frames
 * @param {number} intensity - Pixel intensity
 */
export function triggerShake(frames = 10, intensity = 5) {
  VFXState.shake.duration = frames;
  VFXState.shake.intensity = intensity;
  
  // Also apply to Game object if available
  if (typeof Game !== 'undefined' && Game.state === GameState.PLAYING) {
    Game.shakeDuration = frames;
    Game.shakeIntensity = intensity;
  }
}

/**
 * Activate slow motion effect
 * @param {number} scale - Time scale (0.3 = 30% speed)
 * @param {number} duration - Duration in seconds
 */
export function activateSlowMo(scale = 0.3, duration = 2.0) {
  VFXState.slowMo.active = true;
  VFXState.slowMo.scale = scale;
  VFXState.slowMo.transitionTime = duration;
  
  if (typeof Game !== 'undefined') {
    Game.timeScale = scale;
    Game.slowMotionActive = true;
    
    setTimeout(() => {
      if (Game.state === GameState.PLAYING) {
        Game.timeScale = 1.0;
        Game.slowMotionActive = false;
        VFXState.slowMo.active = false;
      }
    }, duration * 1000);
  }
}

/**
 * Trigger screen freeze impact
 * @param {number} duration - Freeze duration in seconds
 */
export function triggerScreenFreeze(duration = 0.3) {
  VFXState.freeze.active = true;
  VFXState.freeze.duration = duration;
  
  if (typeof Game !== 'undefined') {
    Game.freezeDuration = duration;
    Game.isFrozen = true;
    
    setTimeout(() => {
      if (Game.state === GameState.PLAYING) {
        Game.isFrozen = false;
        Game.freezeDuration = 0;
        VFXState.freeze.active = false;
      }
    }, duration * 1000);
  }
}

/**
 * Apply player damage flash effect
 * @param {string} color - Flash color
 */
export function triggerDamageFlash(color = '#ff4444') {
  VFXState.flash.active = true;
  VFXState.flash.color = color;
  VFXState.flash.alpha = 0.6;
  VFXState.flash.decay = 3.0;
}

/**
 * Update VFX state per frame
 * @param {number} dt - Delta time
 */
export function update(dt) {
  // Update shake offset
  if (VFXState.shake.duration > 0) {
    VFXState.shake.x = (Math.random() - 0.5) * VFXState.shake.intensity;
    VFXState.shake.y = (Math.random() - 0.5) * VFXState.shake.intensity;
    VFXState.shake.duration--;
  } else {
    VFXState.shake.x = 0;
    VFXState.shake.y = 0;
  }
  
  // Decay damage flash
  if (VFXState.flash.alpha > 0) {
    VFXState.flash.alpha -= VFXState.flash.decay * dt;
    if (VFXState.flash.alpha <= 0) {
      VFXState.flash.active = false;
      VFXState.flash.alpha = 0;
    }
  }
}

/**
 * Render VFX overlays on canvas
 * @param {CanvasRenderingContext2D} ctx 
 */
export function render(ctx) {
  // Draw damage flash overlay
  if (VFXState.flash.active) {
    ctx.save();
    ctx.globalAlpha = VFXState.flash.alpha;
    ctx.fillStyle = VFXState.flash.color;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
}
