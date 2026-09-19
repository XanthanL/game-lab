/**
 * Singularity Echo - Random Number Generator Module
 * 
 * Provides seeded random number generation for deterministic gameplay.
 * Two-layer design:
 * 1. Layout/Reward Layer: Seeded randomness (deck composition, elites, affixes)
 * 2. Combat/Visual Layer: Unseeded randomness (ballistics, AI timing, particles)
 * 
 * @module rng
 */

'use strict';

const TAU = Math.PI * 2;

/**
 * RNG state container
 * @type {{on: boolean, s: number, s0: number}}
 */
const RND = { on: false, s: 0, s0: 0 };

/**
 * Mulberry32 PRNG algorithm
 * @returns {number} Pseudo-random number in [0, 1)
 */
function _mulberry32() {
  let t = RND.s += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

/**
 * Get random number (seeded or unseeded based on RND.on)
 * @returns {number} Random float in [0, 1)
 */
function srand01() {
  return RND.on ? _mulberry32() : Math.random();
}

/**
 * Set seed for reproducible runs
 * @param {number} s - Seed value
 */
function setSeed(s) {
  RND.on = true;
  RND.s = (s | 0) || 1;
  RND.s0 = RND.s;
}

/**
 * Reseed at context key for layout/reward layer
 * Prevents combat duration from affecting deck/selection outcomes
 * @param {number} k - Context key (wave number, level, etc.)
 * @param {number} i - Index within context
 */
function seedAt(k, i) {
  if (!RND.on) return;
  const x = (RND.s0 ^ Math.imul(k, 0x9E3779B1) ^ Math.imul((i | 0) + 1, 0x85EBCA6B)) | 0;
  RND.s = x || 1;
}

/**
 * Maximum seed value for 6-digit base36 encoding
 * 36^6 - 1 = 2176782335 (ZZZZZZ in base36)
 */
const SEED_MAX = 2176782335;

/**
 * Normalize seed to [1, SEED_MAX] range
 * Uses fold-over instead of min to avoid all超限 seeds collapsing to ZZZZZZ
 * @param {number} v - Raw seed value
 * @returns {number} Normalized seed
 */
function normSeed(v) {
  const x = (v >>> 0) % SEED_MAX;
  return x || SEED_MAX;
}

/**
 * Convert seed to 6-character base36 code
 * Format: padded with zeros (e.g., "00ABCD")
 * @param {number} n - Seed value
 * @returns {string} 6-char base36 code
 */
function seedCode(n) {
  let s = normSeed(n).toString(36).toUpperCase();
  while (s.length < 6) s = '0' + s;
  return s;
}

/**
 * Parse base36 code back to seed
 * @param {string} c - Base36 code string
 * @returns {number} Seed value, or 0 if invalid
 */
function codeSeed(c) {
  const v = parseInt(String(c || '').trim(), 36);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return normSeed(v);
}

/**
 * Clear seed mode, return to Math.random()
 */
function clearSeed() {
  RND.on = false;
  RND.s = 0;
}

/**
 * Get random float in range [a, b)
 * @param {number} a - Lower bound (inclusive)
 * @param {number} b - Upper bound (exclusive), undefined for [0, a)
 * @returns {number} Random float
 */
const rand = (a = 1, b) => b === undefined ? srand01() * a : a + srand01() * (b - a);

/**
 * Get random integer in range [a, b]
 * @param {number} a - Lower bound (inclusive)
 * @param {number} b - Upper bound (inclusive)
 * @returns {number} Random integer
 */
const irand = (a, b) => Math.floor(a + srand01() * (b - a + 1));

/**
 * Pick random element from array
 * @template T
 * @param {T[]} a - Array of elements
 * @returns {T} Random element
 */
const pick = a => a[(srand01() * a.length) | 0];

/**
 * Shuffle array in place (Fisher-Yates)
 * @template T
 * @param {T[]} a - Array to shuffle
 * @returns {T[]} Shuffled array
 */
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (srand01() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Export API
export {
  RND,
  setSeed,
  seedAt,
  clearSeed,
  normSeed,
  seedCode,
  codeSeed,
  srand01,
  rand,
  irand,
  pick,
  shuffle,
  SEED_MAX,
  TAU
};
