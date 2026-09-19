/**
 * Singularity Echo - Utility Functions Module
 * 
 * Core utility functions used throughout the game.
 * Includes: string formatting, geometric calculations, array helpers
 * 
 * @module utils
 */

'use strict';

/**
 * Format number with thousand separators
 * @param {number} n - Number to format
 * @returns {string} Formatted string (e.g., "1,234,567")
 */
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Clamp value between min and max
 * @template T
 * @param {T} v - Value to clamp
 * @param {T} a - Minimum
 * @param {T} b - Maximum
 * @returns {T} Clamped value
 */
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/**
 * Linear interpolation
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Modulo operator that handles negative numbers correctly
 * @param {number} n - Numerator
 * @param {number} m - Denominator
 * @returns {number} Result in [0, m)
 */
const mod = (n, m) => ((n % m) + m) % m;

/**
 * Calculate squared Euclidean distance between two points
 * Avoids sqrt for performance when only comparing distances
 * @param {number} ax - X coord of point A
 * @param {number} ay - Y coord of point A
 * @param {number} bx - X coord of point B
 * @param {number} by - Y coord of point B
 * @returns {number} Squared distance (dx² + dy²)
 */
const d2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/**
 * Calculate angle from point A to point B
 * @param {number} ax - X coord of point A
 * @param {number} ay - Y coord of point A
 * @param {number} bx - X coord of point B
 * @param {number} by - Y coord of point B
 * @returns {number} Angle in radians [-π, π]
 */
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/**
 * Calculate angular difference between two angles
 * Normalizes to [-π, π] range
 * @param {number} a - First angle
 * @param {number} b - Second angle
 * @returns {number} Signed difference in [-π, π]
 */
const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * Get element by ID (shorthand for document.getElementById)
 * @template T
 * @param {string} id - Element ID
 * @returns {T|null} DOM element or null
 */
const $ = id => /** @type {T} */ (document.getElementById(id));

/**
 * Check if element exists
 * @param {string} id - Element ID
 * @returns {boolean} True if element exists
 */
const exists = id => document.getElementById(id) !== null;

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
const debounce = (fn, wait) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

/**
 * Throttle function calls
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time window in ms
 * @returns {Function} Throttled function
 */
const throttle = (fn, limit) => {
  let inThrottle = false;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * LocalStorage helper with error handling
 */
const Storage = {
  /**
   * Get item from localStorage
   * @param {string} key - Storage key
   * @param {*} fallback - Default value if not found
   * @returns {*} Stored value or fallback
   */
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (e) {
      console.warn('[Storage] Error reading', key, e);
      return fallback;
    }
  },

  /**
   * Set item in localStorage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[Storage] Error writing', key, e);
      return false;
    }
  },

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage] Error deleting', key, e);
    }
  },

  /**
   * Clear all items with given prefix
   * @param {string} prefix - Key prefix
   */
  clearPrefix(prefix) {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) {
        this.remove(key);
      }
    }
  }
};

/**
 * Performance timing helper
 */
const Perf = {
  now: () => performance.now(),

  /**
   * Measure function execution time
   * @param {string} label - Measurement label
   * @param {Function} fn - Function to measure
   * @returns {*} Return value of fn
   */
  measure(label, fn) {
    const t0 = this.now();
    const result = fn();
    const t1 = this.now();
    console.log(`[Perf] ${label}: ${(t1 - t0).toFixed(2)}ms`);
    return result;
  }
};

/**
 * Debug utilities (only active in debug mode)
 */
const Debug = {
  enabled: false,

  log(...args) {
    if (this.enabled) console.log('[Debug]', ...args);
  },

  trace(label) {
    if (!this.enabled) return;
    console.trace(label);
  }
};

// Export API
export {
  fmt,
  clamp,
  lerp,
  mod,
  d2,
  angTo,
  angDiff,
  $,
  exists,
  debounce,
  throttle,
  Storage,
  Perf,
  Debug
};
