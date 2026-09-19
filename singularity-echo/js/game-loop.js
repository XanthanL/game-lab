/**
 * Singularity Echo - Game Loop Module
 * 
 * Central game loop controller with fixed timestep updates.
 * Handles game state transitions, rendering, and timing.
 * Separates logic (fixed update) from rendering (variable rate).
 * 
 * @module game-loop
 */

'use strict';

import { Perf } from './utils.js';

// ============================================
// Constants & Configuration
// ============================================

const FPS_TARGET = 60;
const FIXED_DT = 1 / 60; // Fixed timestep in seconds
const MAX_FRAME_TIME = 0.250; // Cap at 250ms to prevent spiral of death

// Game states
export const GameState = Object.freeze({
  BOOT: 'boot',           // Loading screen
  MENU: 'menu',           // Main menu
  PLAYING: 'playing',     // In-game
  PAUSED: 'paused',       // Game paused
  OVER: 'over',           // Game over
  VICTORY: 'victory',     // Victory screen
  LOADING: 'loading'      // Between screens
});

// ============================================
// Game Loop Controller
// ============================================

class GameLoop {
  constructor() {
    this.state = GameState.BOOT;
    this.lastTime = 0;
    this.accumulator = 0;
    this.isRunning = false;
    this.frameCount = 0;
    
    // Callbacks for state changes
    this.onStateChange = null;
    this.onUpdate = null;
    this.onRender = null;
    
    console.log('[GameLoop] Initialized');
  }
  
  /**
   * Start the game loop
   * @param {Function} onUpdate - Update callback(state, dt)
   * @param {Function} onRender - Render callback(context)
   * @param {Function} onStateChange - State change callback(newState)
   */
  start(onUpdate, onRender, onStateChange = null) {
    if (this.isRunning) {
      console.warn('[GameLoop] Already running');
      return;
    }
    
    console.log('[GameLoop] Starting...');
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.onStateChange = onStateChange;
    this.lastTime = performance.now();
    this.isRunning = true;
    this.state = GameState.PLAYING;
    
    this.loop(performance.now());
  }
  
  /**
   * Main game loop function
   * @param {number} currentTime - Current timestamp
   */
  loop(currentTime) {
    if (!this.isRunning) return;
    
    // Calculate delta time
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, MAX_FRAME_TIME);
    this.lastTime = currentTime;
    
    // Accumulate delta time for fixed step updates
    this.accumulator += deltaTime;
    
    // Fixed timestep updates
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    
    // Render at variable rate
    this.render();
    this.frameCount++;
    
    // Continue loop
    requestAnimationFrame(this.loop.bind(this));
  }
  
  /**
   * Update game state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.onUpdate) return;
    
    try {
      this.onUpdate(dt, this.state);
      
      if (this.state === GameState.PAUSED) {
        this.accumulator = 0; // Freeze physics when paused
      }
    } catch (error) {
      console.error('[GameLoop] Update error:', error);
      throw error;
    }
  }
  
  /**
   * Render current frame
   */
  render() {
    if (!this.onRender) return;
    
    try {
      this.onRender();
    } catch (error) {
      console.error('[GameLoop] Render error:', error);
      throw error;
    }
  }
  
  /**
   * Change game state
   * @param {string} newState - New game state
   */
  setState(newState) {
    if (this.state !== newState && this.onStateChange) {
      this.onStateChange(newState);
    }
    this.state = newState;
  }
  
  /**
   * Get current state
   * @returns {string} Current game state
   */
  getState() {
    return this.state;
  }
  
  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
    console.log('[GameLoop] Stopped');
  }
  
  /**
   * Pause the game
   */
  pause() {
    if (this.state === GameState.PLAYING) {
      this.setState(GameState.PAUSED);
    }
  }
  
  /**
   * Resume the game
   */
  resume() {
    if (this.state === GameState.PAUSED) {
      this.setState(GameState.PLAYING);
    }
  }
  
  /**
   * Get FPS counter
   * @returns {number} Current FPS
   */
  getFPS() {
    return this.frameCount / ((performance.now() - this.lastTime) / 1000);
  }
}

// Singleton instance
const gameLoop = new GameLoop();

// Export API
export {
  GameLoop,
  GameState,
  FPS_TARGET,
  FIXED_DT,
  gameLoop
};
