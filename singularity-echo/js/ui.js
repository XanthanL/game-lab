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
   * Update combo display
   * @param {number} comboCount - Current combo count
   * @param {number} multiplier - Combo multiplier (1.0 - 3.0)
   */
  updateCombo(comboCount, multiplier) {
    // Create combo display element if it doesn't exist
    if (!this.comboElement) {
      this.comboElement = document.createElement('div');
      this.comboElement.className = 'combo-display';
      this.comboElement.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        text-align: center;
        font-size: var(--fs-4);
        font-weight: bold;
        color: #f59e0b;
        text-shadow: 0 2px 8px rgba(0,0,0,0.6);
        opacity: 0;
        transition: opacity 0.3s ease-out;
        z-index: 100;
      `;
      document.body.appendChild(this.comboElement);
    }
    
    if (comboCount > 0) {
      this.comboElement.innerHTML = `
        <div style="font-size: 2rem;">${comboCount}x</div>
        <div style="font-size: 0.75rem; opacity: 0.8;">+${Math.floor((multiplier - 1) * 100)}%</div>
      `;
      this.comboElement.style.opacity = '1';
      
      // Pulse animation when new kill
      const pulseEl = this.comboElement.querySelector('.combo-pulse');
      if (pulseEl) {
        pulseEl.remove();
      }
      const pulse = document.createElement('div');
      pulse.className = 'combo-pulse';
      pulse.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        border: 2px solid #f59e0b;
        border-radius: 50%;
        animation: comboPulseOut 0.5s ease-out forwards;
      `;
      this.comboElement.appendChild(pulse);
    } else {
      this.comboElement.style.opacity = '0';
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
    
    // Toast container
    this.toastContainer = null;
    
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
   * Show toast notification (achievement/combo popup)
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'success', 'info', 'combo'
   */
  showToast(message, type = 'info') {
    // Create or get toast container
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = `toast ${type}`;
      document.body.appendChild(this.toastContainer);
    }
    
    // Remove existing toasts
    const existingToast = this.toastContainer.querySelector('.toast-message');
    if (existingToast) {
      this.toastContainer.removeChild(existingToast);
    }
    
    // Create new toast message element
    const toastMsg = document.createElement('div');
    toastMsg.className = 'toast-message';
    toastMsg.textContent = message;
    
    // Add animation classes
    toastMsg.classList.add('toast-in');
    this.toastContainer.appendChild(toastMsg);
    
    // Animate in
    setTimeout(() => {
      toastMsg.classList.add('toast-visible');
    }, 10);
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      toastMsg.classList.remove('toast-visible');
      toastMsg.classList.add('toast-out');
      
      setTimeout(() => {
        this.toastContainer.removeChild(toastMsg);
        if (this.toastContainer.children.length === 0) {
          this.toastContainer.remove();
          this.toastContainer = null;
        }
      }, 300);
    }, 2000);
  }
  
  /**
   * Show damage flash effect
   * @param {string} color - Flash color (default: red)
   */
  showDamageFlash(color = '#c842d') {
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

import { CardGenerator, UPGRADE_DATABASE } from './upgrades.js';

export class CardSelector {
  constructor() {
    this.cardRow = $('#cardrow');
    this.selectedCard = null;
    this.onChoiceCallback = null;
    
    console.log('[CardSelector] Initialized');
  }
  
  /**
   * Show level-up card selection
   * Called when wave is completed and player reaches level threshold
   */
  showLevelUpCards() {
    if (!Game.player) {
      console.warn('[CardSelector] No player available');
      return;
    }
    
    // Generate 3 random upgrade cards
    const cards = CardGenerator.generateCards(Game.player.level, Game.player.upgrades || []);
    
    if (cards.length === 0) {
      console.warn('[CardSelector] No cards generated');
      return;
    }
    
    // Store choices globally for input handling
    window.G = window.G || {};
    window.G.choices = cards;
    window.G.rerolled = false;
    
    // Render the cards
    this.render(cards, (selected) => {
      this.onChoiceCallback = null; // Reset callback
      this.hide();
      this.confirmSelection(selected);
    });
    
    // Show the overlay
    const cardsOverlay = $('#cards');
    if (cardsOverlay) {
      cardsOverlay.hidden = false;
    }
    
    console.log('[CardSelector] Showing', cards.length, 'upgrade options');
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
    this.onChoiceCallback = onSelect;
    
    cards.forEach((card, index) => {
      const cardEl = this.createUpgradeCard(card, index);
      
      // Click handler
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
   * Create upgrade card element from data
   * @param {Object} card - Upgrade card configuration
   * @param {number} index - Card index
   * @returns {HTMLElement} Card DOM element
   */
  createUpgradeCard(card, index) {
    const cardEl = document.createElement('div');
    
    // Rarity-based styling
    const rarityColors = {
      common: '#b8c6d9',    // Gray-white
      uncommon: '#56b4e9',  // Cyan
      rare: '#78b2dd',      // Blue
      epic: '#a855f7',      // Purple
      legendary: '#f59e0b'  // Amber-gold
    };
    
    const rarity = card.rarity || 'common';
    cardEl.className = `card r-${rarity}`;
    cardEl.dataset.cardIndex = index;
    cardEl.style.borderColor = rarityColors[rarity] || rarityColors.common;
    
    const upgrade = card.upgrade;
    
    // Card structure
    cardEl.innerHTML = `
      <div class="header">
        <span class="g" style="color:${rarityColors[rarity]}">${this.getIconByType(upgrade.type)}</span>
        <h3>${upgrade.name}</h3>
        <span class="en">${upgrade.tier}</span>
      </div>
      <p class="desc">${upgrade.description}</p>
      <div class="synergy" style="display:none">
        <b>Synergies:</b>
        <div class="synrow"></div>
      </div>
      <div class="rd" style="margin-top:auto;padding-top:12px;font-size:var(--fs-2)">
        ${this.getReadouts(upgrade)}
      </div>
    `;
    
    return cardEl;
  }
  
  /**
   * Get icon based on upgrade type
   * @param {string} type - Upgrade type
   * @returns {string} Icon character
   */
  getIconByType(type) {
    const icons = {
      'stat_mod': '+',
      'stat_add': '↑',
      'weapon_unlock': '⚔',
      'ability': '★',
      'passive': '♾'
    };
    return icons[type] || '?';
  }
  
  /**
   * Get readout text for card
   * @param {Object} upgrade - Upgrade configuration
   * @returns {string} Readout HTML
   */
  getReadouts(upgrade) {
    const parts = [];
    
    if (upgrade.statMod) {
      parts.push(`${upgrade.statMod}% ${upgrade.statName}`);
    }
    if (upgrade.valueAdded) {
      parts.push(`+${upgrade.valueAdded} ${upgrade.statName}`);
    }
    
    return parts.join(' · ');
  }
  
  /**
   * Confirm the selected upgrade
   * @param {Object} upgrade - Selected upgrade data
   */
  confirmSelection(upgrade) {
    if (!upgrade) return;
    
    console.log('[CardSelector] Player chose:', upgrade.id);
    
    // Apply the upgrade to the player
    if (Game.player) {
      Game.player.addUpgrade(upgrade);
      
      // Show upgrade toast notification
      setTimeout(() => {
        Game.player.showUpgradeToast(upgrade);
      }, 100);
    }
    
    // Play sound effect
    if (typeof playSound === 'function') {
      playSound('level_up');
    }
    
    // Refresh HUD
    hudSystem.updateLevel(Game.player.level);
    
    // Log what was added
    console.log('[Upgrade Applied]', upgrade);
  }
  
  /**
   * Hide the card selection overlay
   */
  hide() {
    const cardsOverlay = $('#cards');
    if (cardsOverlay) {
      cardsOverlay.hidden = true;
    }
    
    if (this.cardRow) {
      this.cardRow.innerHTML = '';
    }
    
    this.selectedCard = null;
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
