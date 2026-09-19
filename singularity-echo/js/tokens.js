/**
 * Singularity Echo - Design Tokens Module
 * 
 * Reads CSS custom properties from :root and caches them for rendering.
 * Single source of truth: all colors must come from this layer.
 * No hardcoded color values in rendering code (except pure black/white).
 * 
 * @module tokens
 */

'use strict';

/**
 * List of token names to read from CSS
 * These must match --c-{name}-rgb in :root
 */
const NAMES = [
  'void', 'panel', 'white', 'black', 'ink', 'steel', 'cyan', 'cyan-hi', 'cyan-hi-2',
  'aim', 'aim-fire', 'aim-danger', 'cd', 'spot', 'card-edge', 'syn', 'syn-2', 'line',
  'danger', 'amber', 'amber-hi', 'violet', 'shadow', 'overlay-a', 'overlay-b', 'foe'
];

/**
 * Current palette cache
 * Keys are token names, values are "r,g,b" strings
 * @type {Record<string, string>}
 */
let PAL = {};

/**
 * Colorblind mode palettes
 * Maps semantic colors to accessible alternatives
 * Based on Viénot CVD simulation matrices
 */
const CB_PAL = {
  /* Red-green blindness (protan/deutan) · Safe axis Blue↔Yellow */
  rg: {
    'danger': '#d55e00', 'amber': '#f0e442', 'amber-hi': '#f7ee9a',
    'cyan': '#56b4e9', 'cyan-hi': '#cfe8fb', 'cyan-hi-2': '#a8d8f0',
    'violet': '#cc79a7', 'syn': '#8fd0e8', 'syn-2': '#7fc4de',
    'hp-a': '#009e73', 'hp-b': '#a8ecd0', 'shield-a': '#00558f', 'shield-b': '#5aa8c8',
    'foe': '#e8a33d'
  },
  /* Blue-yellow blindness (tritan) · Safe axis Red↔Green */
  by: {
    'danger': '#e0301e', 'amber': '#19b56a', 'amber-hi': '#7fe0a8',
    'cyan': '#b9c9d6', 'cyan-hi': '#eaf4ff', 'cyan-hi-2': '#c8d8e6',
    'violet': '#b06ec0', 'syn': '#a6c8e6', 'syn-2': '#92b0cc',
    'hp-a': '#8fe6b5', 'hp-b': '#d6f7e4', 'shield-a': '#1b4f7a', 'shield-b': '#5fa8c8',
    'foe': '#ff3b5c'
  }
};

/**
 * Color keys affected by colorblind mode
 * Only these semantic colors are remapped; structural grays are untouched
 */
const CB_KEYS = Object.keys(CB_PAL.rg);

/**
 * Viénot linear transformation matrices (sRGB space approximation)
 * Used for color selection validation, not clinical simulation
 * @type {{prot: number[][], deut: number[][], trit: number[][]}}
 */
const CVD_M = {
  prot: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deut: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  trit: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]]
};

/**
 * Simulate color appearance under specific colorblind mode
 * Applies Viénot matrix transformation to sRGB values
 * @param {number[]} rgb - Input color as [r, g, b] (0-255)
 * @param {'prot'|'deut'|'trit'|null} mode - Colorblind mode or null for normal vision
 * @returns {number[]} Transformed color [r, g, b]
 */
function simCVD(rgb, mode) {
  const m = CVD_M[mode];
  if (!m) return rgb.slice();
  
  return [0, 1, 2].map(i => Math.max(0, Math.min(255,
    Math.round(m[i][0] * rgb[0] + m[i][1] * rgb[1] + m[i][2] * rgb[2]))));
}

/**
 * Read all design tokens from CSS :root
 * Called once at startup, then cached in PAL
 * @returns {Record<string, string}} Palette object with "r,g,b" values
 */
function readPal() {
  const cs = getComputedStyle(document.documentElement);
  const o = {};
  
  for (const k of NAMES) {
    const v = cs.getPropertyValue(`--c-${k}-rgb`).trim().replace(/\s+/g, ',');
    if (v) o[k] = v;
  }
  
  return o;
}

/**
 * Apply colorblind mode mapping to palette
 * Updates PAL entries for semantic colors based on selected mode
 * @param {'rg'|'by'|null} mode - Colorblind mode ('rg' = red-green, 'by' = blue-yellow)
 */
function applyColorblindMode(mode) {
  const map = mode ? CB_PAL[mode] : null;
  if (!map) return;
  
  for (const [key, hex] of Object.entries(map)) {
    // Convert hex to rgb string
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    PAL[key] = `${r},${g},${b}`;
  }
}

/**
 * Get RGBA string with alpha channel
 * Uses cached PAL values,拼 alpha for transparency
 * @param {string} key - Token name (e.g., 'cyan', 'danger')
 * @param {number} a - Alpha value (0-1)
 * @returns {string} RGBA string like "rgba(124,178,221,0.5)"
 */
const RGBA = (key, a) => `rgba(${PAL[key]},${a})`;

/**
 * Get RGB string without alpha
 * @param {string} key - Token name
 * @returns {string} RGB string like "124,178,221"
 */
const RGB = key => PAL[key];

/**
 * Refresh palette from current CSS
 * Useful if dynamic theme changes occur after startup
 */
function refresh() {
  PAL = readPal();
}

// Export API
export {
  NAMES,
  CB_PAL,
  CB_KEYS,
  CVD_M,
  readPal,
  applyColorblindMode,
  simCVD,
  RGBA,
  RGB,
  refresh,
  PAL
};
