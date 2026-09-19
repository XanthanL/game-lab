/**
 * Singularity Echo - UI System Module
 * 
 * Manages all user interface elements including:
 * - HUD (Heads-Up Display)
 * - Menus (Main menu, Pause, Settings)
 * - Panels (Over screen, Victory, Logbook)
 * - Interactive widgets (Buttons, Cards, Sliders)
 * 
 * @module ui
 */

'use strict';

import { $, Storage } from './utils.js';
import { RGBA, PAL } from './tokens.js';

// ============================================
// HUD System
// ============================================

export class HUD {
  constructor() {
    this.elements = {
      score: $('#score'),
      wave: $('#wavelabel'),
      best: $('#best'),
      time: $('#ptime'),
      enLeft: $('#enleft'),
      bossName: $('#bossname'),
      bossBar: $('#bossbar'),
      bossBarFill: $('#bossbar i'),
      xpBar: $('#xpbar'),
      level: $('#lv')
    };
    
    this.bossHP = 0;
    this.maxBossHP = 0;
    
    console.log('[HUD] Initialized');
  }
  
  /**
   * Update score display
   * @param {number} score
   */
  updateScore(score) {
    if (this.elements.score) {
      this.elements.score.textContent = Math.round(score).toLocaleString();
      
      // Pop animation
      const el = this.elements.score;
      el.classList.remove('pop');
      void el.offsetWidth; // Force reflow
      el.classList.add('pop');
    }
  }
  
  /**
   * Update wave indicator
   * @param {number} wave
   * @param {boolean} hasBoss
   * @param {boolean} isChamp
   */
  updateWave(wave, hasBoss, isChamp) {
    if (this.elements.wave) {
      this.elements.wave.textContent = `WAVE ${wave}${hasBoss ? ' 🐉' : ''}${isChamp ? ' 💀' : ''}`;
    }
  }
  
  /**
   * Update time display
   * @param {number} seconds
   */
  updateTime(seconds) {
    if (this.elements.time) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      this.elements.time.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Update boss bar
   * @param {number} currentHP
   * @param {number} maxHP
   */
  updateBossBar(currentHP, maxHP) {
    if (!this.elements.bossBar || !this.elements.bossBarFill) return;
    
    this.bossHP = currentHP;
    this.maxBossHP = maxHP;
    
    const percent = Math.max(0, Math.min(1, currentHP / maxHP));
    this.elements.bossBarFill.style.width = `${percent * 100}%`;
  }
  
  /**
   * Set boss name
   * @param {string} name
   */
  setBossName(name) {
    if (this.elements.bossName) {
      this.elements.bossName.textContent = name;
    }
  }
  
  /**
   * Update XP bar
   * @param {number} currentXP
   * @param {number} maxXpForLevel
   */
  updateXP(currentXP, maxXpForLevel) {
    if (!this.elements.xpBar) return;
    
    const percent = currentXP / maxXpForLevel;
    this.elements.xpBar.style.width = `${percent * 100}%`;
  }
  
  /**
   * Update player level
   * @param {number} level
   */
  updateLevel(level) {
    if (this.elements.level) {
      this.elements.level.textContent = `LV ${level}`;
    }
  }
  
  /**
   * Hide/show HUD based on context
   * @param {boolean} show
   */
  setVisible(show) {
    Object.values(this.elements).forEach(el => {
      if (el) el.style.display = show ? 'block' : 'none';
    });
  }
}

// ============================================
// Menu System
// ============================================

export class MenuSystem {
  constructor() {
    this.panels = {
      menu: $('#menu'),
      settings: $('#settings'),
      daily: $('#menuDaily'),
      seed: $('#seedpanel'),
      board: $('#board'),
      share: $('#sharecard'),
      logbook: $('#logbook'),
      music: $('#musicroom')
    };
    
    this.buttons = {
      resume: $('#btnResume'),
      restart: $('#btnRestart'),
      quit: $('#btnQuit'),
      settingsP: $('#btnSettingsP')
    };
    
    this.setupListeners();
    console.log('[MenuSystem] Initialized');
  }
  
  /**
   * Setup button click listeners
   */
  setupListeners() {
    if (this.buttons.resume) {
      this.buttons.resume.addEventListener('click', () => {
        eventBus.emit('menu:resume');
      });
    }
    
    if (this.buttons.restart) {
      this.buttons.restart.addEventListener('click', () => {
        eventBus.emit('menu:restart');
      });
    }
    
    if (this.buttons.quit) {
      this.buttons.quit.addEventListener('click', () => {
        eventBus.emit('menu:returnToMenu');
      });
    }
    
    if (this.buttons.settingsP) {
      this.buttons.settingsP.addEventListener('click', () => {
        eventBus.emit('menu:openSettings');
      });
    }
  }
  
  /**
   * Show a specific panel
   * @param {string} panelId - Panel identifier ('menu', 'settings', 'daily', etc.)
   */
  show(panelId) {
    Object.values(this.panels).forEach(el => {
      if (el) el.hidden = true;
    });
    
    const panel = this.panels[panelId];
    if (panel) {
      panel.hidden = false;
      eventBus.emit('menu:show', panelId);
    }
  }
  
  /**
   * Hide all panels
   */
  hideAll() {
    Object.values(this.panels).forEach(el => {
      if (el) el.hidden = true;
    });
  }
  
  /**
   * Open settings panel
   */
  openSettings() {
    this.show('settings');
  }
  
  /**
   * Open seed input
   * @param {string} initialValue - Pre-filled seed code
   */
  openSeed(initialValue = '') {
    if (initialValue) {
      const input = $('#sdInput');
      if (input) input.value = initialValue;
    }
    this.show('seed');
  }
  
  /**
   * Open leaderboard
   */
  openLeaderboard() {
    this.show('board');
  }
  
  /**
   * Open daily challenge
   */
  openDaily() {
    this.show('daily');
  }
}

// ============================================
// Overlay Notifications
// ============================================

export class NotificationSystem {
  constructor() {
    this.banner = $('#banner');
    this.bannerMain = $('#bannerMain');
    this.bannerSub = $('#bannerSub');
    
    this.flash = $('#flash');
    this.danger = $('#danger');
    
    console.log('[NotificationSystem] Initialized');
  }
  
  /**
   * Show banner notification
   * @param {string} mainText - Main message
   * @param {string} subText - Subtitle
   * @param {number} duration - Display duration in ms
   */
  showBanner(mainText, subText = '', duration = 3000) {
    if (!this.banner) return;
    
    this.bannerMain.textContent = mainText;
    this.bannerSub.innerHTML = subText || '';
    
    this.banner.classList.add('on');
    this.banner.style.opacity = '1';
    
    setTimeout(() => {
      this.hideBanner();
    }, duration);
  }
  
  /**
   * Hide banner
   */
  hideBanner() {
    if (this.banner) {
      this.banner.classList.remove('on');
      this.banner.style.opacity = '0';
    }
  }
  
  /**
   * Show damage flash effect
   * @param {string} color - Flash color (default: red)
   */
  showDamageFlash(color = '#c8482d') {
    if (!this.flash) return;
    
    this.flash.style.background = `radial-gradient(ellipse at center, rgba(${color.replace('#', '')}, 0.7), transparent)`;
    this.flash.style.opacity = '0.5';
    
    setTimeout(() => {
      this.fadeDamageFlash();
    }, 100);
  }
  
  /**
   * Fade damage flash
   */
  fadeDamageFlash() {
    if (this.flash) {
      this.flash.style.opacity = '0';
    }
  }
  
  /**
   * Show danger overlay
   */
  showDanger() {
    if (this.danger) {
      this.danger.style.opacity = '0.45';
    }
  }
  
  /**
   * Hide danger overlay
   */
  hideDanger() {
    if (this.danger) {
      this.danger.style.opacity = '0';
    }
  }
}

// ============================================
// Card Selection System
// ============================================

export class CardSelector {
  constructor() {
    this.cardRow = $('#cardrow');
    this.selectedCard = null;
    
    console.log('[CardSelector] Initialized');
  }
  
  /**
   * Render card selection options
   * @param {Array} cards - Array of card data objects
   * @param {Function} onSelect - Callback when card selected
   */
  render(cards, onSelect) {
    if (!this.cardRow) {
      console.warn('[CardSelector] No card container found');
      return;
    }
    
    this.cardRow.innerHTML = '';
    
    cards.forEach((card, index) => {
      const cardEl = this.createCardElement(card, index);
      cardEl.addEventListener('click', () => {
        onSelect(card);
      });
      this.cardRow.appendChild(cardEl);
    });
    
    // Add animations to cards
    const cardElements = this.cardRow.querySelectorAll('.card');
    cardElements.forEach((el, idx) => {
      el.style.animationDelay = `${idx * 0.1}s`;
    });
  }
  
  /**
   * Create card element from data
   * @param {Object} card - Card configuration
   * @param {number} index - Card index
   * @returns {HTMLElement} Card DOM element
   */
  createCardElement(card, index) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card r-' + (card.rarity || 'common');
    cardEl.dataset.cardIndex = index;
    
    const module = card.module;
    
    // Card header with symbol and type
    cardEl.innerHTML = `
      <span class="g">${module.symbol || '?'}</span>
      <h3>${module.name.zh || module.name.en || '?'}</h3>
      ${module.name.en ? `<span class="en">${module.name.en}</span>` : ''}
      <p>${module.description.zh || module.description.en || ''}</p>
      <div class="rd">
        <span>${module.statMods.fireRate ? (module.statMods.fireRate > 0 ? '+' : '') + (module.statMods.fireRate * 100).toFixed(0) + '% Fire Rate' : ''}</span>
      </div>
      ${module.synonyms && module.synonyms.length > 0 ? `
        <div class="syn live">
          <div class="synrow"><b>${module.synonyms[0]}</b></div>
        </div>
      ` : ''}
    `;
    
    return cardEl;
  }
  
  /**
   * Clear all cards
   */
  clear() {
    if (this.cardRow) {
      this.cardRow.innerHTML = '';
    }
  }
}

// ============================================
// Achievement Tree Renderer
// ============================================

export class AchievementTree {
  constructor(containerId = 'lbTree') {
    this.container = $(containerId);
    this.wrap = $('.lb-tree-wrap');
    this.nodesLayer = $('.lb-tree-nodes');
    this.linksLayer = $('.lb-tree-links');
    
    console.log('[AchievementTree] Initialized');
  }
  
  /**
   * Render achievement tree
   * @param {Array} achievements - Achievement data array
   * @param {Array} unlockedIds - IDs of unlocked achievements
   */
  render(achievements, unlockedIds) {
    if (!this.container || !this.nodesLayer || !this.linksLayer) return;
    
    this.clear();
    
    // Calculate canvas size from data
    let maxX = 0;
    let maxY = 0;
    
    for (const ach of achievements) {
      maxX = Math.max(maxX, ach.x || 0);
      maxY = Math.max(maxY, ach.y || 0);
    }
    
    const padding = 100;
    const width = maxX * 150 + padding;
    const height = maxY * 100 + padding;
    
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    
    // Draw connections first
    this.drawConnections(achievements);
    
    // Then draw nodes
    this.drawNodes(achievements, unlockedIds);
  }
  
  /**
   * Clear all rendered content
   */
  clear() {
    if (this.nodesLayer) this.nodesLayer.innerHTML = '';
    if (this.linksLayer) this.linksLayer.innerHTML = '';
  }
  
  /**
   * Draw achievement connections
   * @param {Array} achievements
   */
  drawConnections(achievements) {
    if (!this.linksLayer) return;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    
    for (const ach of achievements) {
      if (ach.req) {
        const parent = achievements.find(a => a.id === ach.req);
        if (parent) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', (parent.x + 0.5) * 150 + 'px');
          line.setAttribute('y1', (parent.y + 0.5) * 100 + 'px');
          line.setAttribute('x2', (ach.x + 0.5) * 150 + 'px');
          line.setAttribute('y2', (ach.y + 0.5) * 100 + 'px');
          line.setAttribute('stroke', 'rgba(124, 178, 221, 0.3)');
          line.setAttribute('stroke-width', '2');
          
          svg.appendChild(line);
        }
      }
    }
    
    this.linksLayer.appendChild(svg);
  }
  
  /**
   * Draw achievement nodes
   * @param {Array} achievements
   * @param {Array} unlockedIds
   */
  drawNodes(achievements, unlockedIds) {
    if (!this.nodesLayer) return;
    
    for (const ach of achievements) {
      const node = document.createElement('div');
      node.className = 'lbnode' + (unlockedIds.includes(ach.id) ? ' done' : ' locked');
      node.style.left = (ach.x * 150) + 'px';
      node.style.top = (ach.y * 100) + 'px';
      
      node.innerHTML = `
        <b>${ach.zh || ach.en || '?'}</b>
        <span>${ach.desc?.zh || ach.desc?.en || ''}</span>
        ${ach.cost ? `<i>${ach.cost} Dust</i>` : ''}
      `;
      
      this.nodesLayer.appendChild(node);
    }
  }
}

// Export singleton instances
const hud = new HUD();
const menuSystem = new MenuSystem();
const notificationSystem = new NotificationSystem();
const cardSelector = new CardSelector();
const achievementTree = new AchievementTree();

export {
  hud,
  menuSystem,
  notificationSystem,
  cardSelector,
  achievementTree
};
