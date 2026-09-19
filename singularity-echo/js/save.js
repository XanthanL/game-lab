/**
 * 奇点回响 · 存档系统
 * 
 * 使用 localStorage 进行游戏进度持久化
 * 支持多个存档槽位、自动保存、手动保存/加载
 * 
 * @module save
 */

// ==================== 存档数据结构 ====================

export const SAVE_SCHEMAS = Object.freeze({
  PROFILE: {
    version: '1.0',
    hullType: 'peregrine',
    hullLevel: 1,
    score: 0,
    highScore: 0,
    wavesCompleted: 0,
    enemiesKilled: 0,
    perfectRuns: 0,
    totalPlayTime: 0,
    unlockedModules: [],
    unlockedHulls: ['peregrine']
  },
  
  GAME: {
    wave: 1,
    score: 0,
    playerHP: 100,
    playerShield: 50,
    modules: {},
    upgrades: []
  },
  
  SETTINGS: {
    difficulty: 'standard',
    audioVolume: 0.7,
    audioMuted: false,
    motionBlur: true,
    particleQuality: 'high'
  }
});

// ==================== 存档管理器 ====================

class SaveManager {
  constructor() {
    this.storageKey = 'singularity-echo-save';
    this.autoSaveInterval = 30; // 秒
    this.lastAutoSaveTime = 0;
    
    // 多个存档槽位（最多 5 个）
    this.slots = 5;
    
    // 当前选择的槽位
    this.currentSlot = 0;
    
    // 事件订阅
    this.subscribers = new Map();
  }
  
  // ==================== 核心方法 ====================
  
  /**
   * 获取指定槽位的存档
   */
  load(slot = this.currentSlot) {
    try {
      const key = `${this.storageKey}-slot-${slot}`;
      const data = localStorage.getItem(key);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // 版本兼容性检查
      if (parsed.version !== SAVE_SCHEMAS.PROFILE.version) {
        console.warn('Save version mismatch, attempting migration...');
        return this.migrateSave(parsed);
      }
      
      return parsed;
      
    } catch (err) {
      console.error('Failed to load save:', err);
      return null;
    }
  }
  
  /**
   * 保存游戏到指定槽位
   */
  save(profile, game, settings, slot = this.currentSlot) {
    try {
      const saveData = {
        version: SAVE_SCHEMAS.PROFILE.version,
        timestamp: Date.now(),
        slot: slot,
        profile: { ...SAVE_SCHEMAS.PROFILE, ...profile },
        game: { ...SAVE_SCHEMAS.GAME, ...game },
        settings: { ...SAVE_SCHEMAS.SETTINGS, ...settings }
      };
      
      const key = `${this.storageKey}-slot-${slot}`;
      localStorage.setItem(key, JSON.stringify(saveData));
      
      console.log(`Game saved to slot ${slot}`);
      this.emit('save', { slot, data: saveData });
      
      return true;
      
    } catch (err) {
      console.error('Failed to save game:', err);
      this.emit('save_error', { error: err });
      return false;
    }
  }
  
  /**
   * 删除指定槽位的存档
   */
  delete(slot = this.currentSlot) {
    try {
      const key = `${this.storageKey}-slot-${slot}`;
      localStorage.removeItem(key);
      
      this.emit('delete', { slot });
      return true;
      
    } catch (err) {
      console.error('Failed to delete save:', err);
      return false;
    }
  }
  
  /**
   * 列出所有可用的存档槽位
   */
  listSlots() {
    const slots = [];
    
    for (let i = 0; i < this.slots; i++) {
      const key = `${this.storageKey}-slot-${i}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        try {
          const parsed = JSON.parse(data);
          slots.push({
            slot: i,
            available: true,
            timestamp: parsed.timestamp,
            wave: parsed.game?.wave || 0,
            score: parsed.profile?.score || 0,
            difficulty: parsed.settings?.difficulty || 'standard'
          });
        } catch (e) {
          slots.push({ slot: i, available: false });
        }
      } else {
        slots.push({ slot: i, available: false });
      }
    }
    
    return slots;
  }
  
  /**
   * 设置当前选中的槽位
   */
  setCurrentSlot(slot) {
    if (slot >= 0 && slot < this.slots) {
      this.currentSlot = slot;
      this.emit('slot_change', { slot });
    }
  }
  
  // ==================== 版本迁移 ====================
  
  migrateSave(oldSave) {
    console.log('Migrating save from version:', oldSave.version);
    
    // 简单示例：从 v0 迁移到 v1
    if (oldSave.version === '0.9') {
      return {
        version: SAVE_SCHEMAS.PROFILE.version,
        timestamp: Date.now(),
        slot: oldSave.slot || 0,
        profile: {
          ...SAVE_SCHEMAS.PROFILE,
          hullType: oldSave.hullType || 'peregrine',
          score: oldSave.score || 0,
          unlockedHulls: [oldSave.hullType || 'peregrine']
        },
        game: {
          ...SAVE_SCHEMAS.GAME,
          wave: oldSave.wave || 1,
          score: oldSave.score || 0
        },
        settings: SAVE_SCHEMAS.SETTINGS
      };
    }
    
    // 其他版本的迁移逻辑...
    return oldSave;
  }
  
  // ==================== 自动保存 ====================
  
  startAutoSave(gameState) {
    this.autoSaveIntervalId = setInterval(() => {
      const now = Date.now() / 1000;
      
      if (now - this.lastAutoSaveTime >= this.autoSaveInterval) {
        this.autoSave(gameState);
        this.lastAutoSaveTime = now;
      }
    }, 1000);
  }
  
  stopAutoSave() {
    if (this.autoSaveIntervalId) {
      clearInterval(this.autoSaveIntervalId);
    }
  }
  
  autoSave(gameState) {
    if (!gameState.isPlaying()) return;
    
    this.save(
      gameState.getProfileData(),
      gameState.getGameData(),
      gameState.getSettings(),
      this.currentSlot
    );
  }
  
  // ==================== 事件系统 ====================
  
  on(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
  }
  
  off(event, callback) {
    if (callback) {
      const handlers = this.subscribers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(callback);
        if (idx > -1) handlers.splice(idx, 1);
      }
    } else {
      this.subscribers.delete(event);
    }
  }
  
  emit(event, data) {
    const handlers = this.subscribers.get(event);
    if (handlers) {
      handlers.forEach(cb => cb(data));
    }
  }
  
  // ==================== 清除数据 ====================
  
  clearAll() {
    for (let i = 0; i < this.slots; i++) {
      this.delete(i);
    }
    this.emit('clear_all');
  }
}

// ==================== 单例导出 ====================

export const saveManager = new SaveManager();

// ==================== 快捷函数 ====================

export const loadGame = (slot) => saveManager.load(slot);
export const saveGame = (profile, game, settings, slot) => 
  saveManager.save(profile, game, settings, slot);
export const deleteSave = (slot) => saveManager.delete(slot);
export const listSaves = () => saveManager.listSlots();
export const switchSlot = (slot) => saveManager.setCurrentSlot(slot);
export const enableAutoSave = (gameState) => saveManager.startAutoSave(gameState);
export const disableAutoSave = () => saveManager.stopAutoSave();

// ==================== UI 辅助工具 ====================

export const SaveUI = {
  createSlotGrid(container) {
    const slots = listSaves();
    const grid = document.createElement('div');
    grid.className = 'save-slot-grid';
    
    slots.forEach(slot => {
      const slotEl = this.createSlotElement(slot);
      grid.appendChild(slotEl);
    });
    
    container.innerHTML = '';
    container.appendChild(grid);
  },
  
  createSlotElement(slotData) {
    const slotEl = document.createElement('button');
    slotEl.className = `save-slot ${slotData.available ? 'has-save' : 'empty'}`;
    
    if (slotData.available) {
      const date = new Date(slotData.timestamp);
      const waveText = `Wave ${slotData.wave}`;
      const scoreText = `Score: ${slotData.score.toLocaleString()}`;
      
      slotEl.innerHTML = `
        <span class="slot-index">${slotData.slot + 1}</span>
        <span class="slot-info">
          <span class="slot-wave">${waveText}</span>
          <span class="slot-score">${scoreText}</span>
          <span class="slot-date">${date.toLocaleDateString()}</span>
        </span>
        <span class="slot-actions">
          <button class="load-btn" data-slot="${slotData.slot}">Load</button>
          <button class="delete-btn" data-slot="${slotData.slot}">×</button>
        </span>
      `;
      
      // 绑定事件
      slotEl.querySelector('.load-btn').onclick = (e) => {
        e.preventDefault();
        this.loadFromSlot(slotData.slot);
      };
      
      slotEl.querySelector('.delete-btn').onclick = (e) => {
        e.preventDefault();
        if (confirm(`Delete save from slot ${slotData.slot + 1}?`)) {
          deleteSave(slotData.slot);
          this.createSlotGrid(e.target.closest('.save-container'));
        }
      };
      
    } else {
      slotEl.innerHTML = `
        <span class="slot-index">${slotData.slot + 1}</span>
        <span class="slot-empty">(Empty)</span>
        <button class="new-game-btn" data-slot="${slotData.slot}">New Game</button>
      `;
      
      slotEl.querySelector('.new-game-btn').onclick = (e) => {
        e.preventDefault();
        this.newGameInSlot(slotData.slot);
      };
    }
    
    return slotEl;
  },
  
  loadFromSlot(slot) {
    const data = loadGame(slot);
    if (data) {
      saveManager.setCurrentSlot(slot);
      // 触发加载事件
      window.dispatchEvent(new CustomEvent('game_loaded', { detail: data }));
    }
  },
  
  newGameInSlot(slot) {
    saveManager.setCurrentSlot(slot);
    window.dispatchEvent(new CustomEvent('new_game_started', { detail: { slot } }));
  }
};
