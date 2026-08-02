// localStorage 存档：关卡解锁、星星、音量设置
(function () {
  'use strict';

  // localStorage 存档；无 localStorage 环境（如 node 测试）退化为内存模式
  const KEY = 'pvz_save';
  let data = null;

  function defaults() {
    return { unlocked: 0, stars: {}, settings: { volume: 0.8 } };
  }

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  PVZ.save = {
    load() {
      if (data) return data;
      data = defaults();
      const ls = storage();
      if (ls) {
        try {
          const raw = ls.getItem(KEY);
          if (raw) data = Object.assign(defaults(), JSON.parse(raw));
        } catch (e) { /* 损坏存档忽略 */ }
      }
      return data;
    },

    persist() {
      const ls = storage();
      if (ls) {
        try {
          ls.setItem(KEY, JSON.stringify(data));
        } catch (e) { /* 存储满忽略 */ }
      }
    },

    unlockedIndex() {
      return this.load().unlocked;
    },

    isUnlocked(idx) {
      return idx <= this.unlockedIndex();
    },

    markCleared(idx) {
      const d = this.load();
      d.stars['L' + idx] = 1;
      if (idx === d.unlocked && idx + 1 < PVZ.config.LEVEL_LIST.length) {
        d.unlocked = idx + 1;
      }
      this.persist();
    },

    starOf(idx) {
      return this.load().stars['L' + idx] || 0;
    },

    getSettings() {
      return this.load().settings;
    },

    setVolume(v) {
      const d = this.load();
      d.settings.volume = v;
      this.persist();
    }
  };

  PVZ.save.load();
})();
