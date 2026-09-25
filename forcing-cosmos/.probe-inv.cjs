/* 一次性：把数据表在 Node 里求值，精确统计当前内容量（写差距清单用） */
'use strict';
const fs = require('fs');
const el = () => ({
  style: {}, dataset: {}, textContent: '', innerHTML: '', className: '',
  classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
  appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  // canvas：只求「能拿到 ctx」，不真的画 —— 什麼方法都返回一个空壳
  getContext: () => new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (k === 'canvas' ? { width: 640, height: 360 } : function () {
      return { width: 0, addColorStop() {} };
    })),
    set: () => true,
  }),
  width: 640, height: 360,
});
global.window = { addEventListener() {}, visualViewport: null, innerWidth: 1280, innerHeight: 720 };
global.document = {
  getElementById: () => el(), createElement: () => el(), addEventListener() {},
  querySelector: () => null, querySelectorAll: () => [],
  documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } },
  body: el(),
};
// Node 22 的 globalThis.navigator 只有 getter，必须 defineProperty 覆盖
Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true, writable: true });
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.location = { search: '' };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 0;
global.matchMedia = () => ({ matches: false });
global.URLSearchParams = function () { return { get: () => null }; };
global.getComputedStyle = () => ({ getPropertyValue: () => '' });

const files = ['src/audio.js', 'src/entities.js', 'src/cards.js', 'src/sprites.js', 'src/ui.js', 'src/game.js', 'src/story.js'];
const src = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n');
const fn = new Function(src + `
; return {
  ACTS: ACTS.length,
  CHARACTERS: Object.keys(CHARACTERS).length,
  ENEMIES: Object.keys(ENEMIES).length,
  RELICS: Object.keys(RELICS).length,
  STATUS_INFO: Object.keys(STATUS_INFO),
  CARD_DEFS: Object.keys(CARD_DEFS).length,
  CURSE_CARDS: Object.keys(CURSE_CARDS).length,
  UPGRADES: Object.keys(UPGRADES).length,
  POTION_DEFS: Object.keys(POTION_DEFS).length,
  EVENTS: EVENTS.length,
};`);
console.log(JSON.stringify(fn(), null, 1));
