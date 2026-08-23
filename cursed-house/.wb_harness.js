// Minimal DOM/canvas/audio stub harness: run the game script, catch load-time and interaction errors.
const fs = require('fs');
const vm = require('vm');

function mkCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (typeof k === 'string') return t[k] !== undefined ? t[k] : function () {};
      return function () {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

const elements = new Map();
function mkEl(id) {
  const el = {
    id, style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(type, fn) { (el._h[type] = el._h[type] || []).push(fn); },
    removeEventListener() {},
    _h: {},
    appendChild(c) { el.children.push(c); return c; },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus() {}, click() { (el._h.click || []).forEach(f => f({ stopPropagation() {}, target: el })); },
    getContext: () => mkCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    requestPointerLock() {},
    width: 800, height: 600,
  };
  Object.defineProperty(el, 'innerHTML', { get: () => el._html || '', set(v) { el._html = v; } });
  Object.defineProperty(el, 'textContent', { get: () => el._txt || '', set(v) { el._txt = v; } });
  return el;
}
const canvas = mkEl('canvas');

const documentStub = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, mkEl(id));
    return elements.get(id);
  },
  createElement(tag) { const e = mkEl(tag); if (tag === 'canvas') e.getContext = () => mkCtx(); return e; },
  addEventListener() {},
  body: mkEl('body'),
  documentElement: mkEl('html'),
  pointerLockElement: null,
  exitPointerLock() {},
  activeElement: null,
  hidden: false,
};
documentStub.activeElement = canvas;

const imageInstances = [];
class ImageStub {
  constructor() { this.width = 64; this.height = 64; this.onload = null; imageInstances.push(this); }
  set src(v) { this._src = v; if (this.onload) setTimeout(this.onload, 0); }
  get src() { return this._src; }
}

let rafQ = [];
const sandbox = {
  console,
  setTimeout: (fn) => { try { fn(); } catch (e) { console.error('[setTimeout error]', e.message); } return 1; },
  setInterval: () => 1, clearTimeout() {}, clearInterval() {},
  requestAnimationFrame: (fn) => { rafQ.push(fn); return 1; },
  performance: { now: () => Date.now() },
  addEventListener(t, fn) { (sandbox._winH[t] = sandbox._winH[t] || []).push(fn); },
  removeEventListener() {},
  _winH: {},
  document: documentStub,
  Image: ImageStub,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { maxTouchPoints: 0, userAgent: 'node', language: 'zh-CN', vibrate() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  location: { reload() {} },
  AudioContext: class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() {} suspend() {} close() {}
    createGain() { return { gain: { value: 1, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, detune: { value: 0 }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0, setValueAtTime() {} }, Q: { value: 0 }, connect() {}, disconnect() {} }; }
    createBuffer(a, b, c) { return { getChannelData: () => new Float32Array(b || 1) }; }
    createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {}, disconnect() {}, onended: null }; }
    createDynamicsCompressor() { return { threshold: { value: 0 }, ratio: { value: 0 }, connect() {}, disconnect() {} }; }
    createPanner() { return { panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0, setPosition() {}, positionX: { value: 0 }, connect() {}, disconnect() {} }; }
    createStereoPanner() { return { pan: { value: 0 }, connect() {}, disconnect() {} }; }
    createWaveShaper() { return { curve: null, connect() {}, disconnect() {} }; }
    createDelay() { return { delayTime: { value: 0 }, connect() {}, disconnect() {} }; }
  }, webkitAudioContext: undefined,
  screen: { orientation: { angle: 0 } },
  devicePixelRatio: 1,
  innerWidth: 800, innerHeight: 600,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

// Extract inline <script> blocks from index.html (self-contained smoke test)
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
try {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'game.js' });
  console.log('LOAD_OK');
} catch (e) {
  console.error('LOAD_ERROR:', e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  process.exit(1);
}

// Pump a few frames.
try {
  for (let i = 0; i < 5 && rafQ.length; i++) {
    const q = rafQ; rafQ = [];
    q.forEach(f => f(performance.now() + 16));
  }
  console.log('FRAMES_OK');
} catch (e) {
  console.error('FRAME_ERROR:', e.stack ? e.stack.split('\n').slice(0, 8).join('\n') : e);
}

// Try entering each chapter through the real handlers.
async function tryChapter(btnId) {
  try {
    const btn = elements.get(btnId);
    if (!btn) { console.error(btnId + ': BUTTON NOT FOUND'); return; }
    (btn._h.click || []).forEach(f => f({ stopPropagation() {}, target: btn }));
    // pump frames in intro state
    for (let i = 0; i < 5 && rafQ.length; i++) { const q = rafQ; rafQ = []; q.forEach(f => f(performance.now() + 16)); }
    // click the intro overlay to begin
    const introId = sandbox.state === 'intro' ? null : 'n/a';
    for (const id of ['intro2', 'intro3']) {
      const iv = elements.get(id);
      if (iv && iv.style.display === 'flex') { iv.click(); break; }
    }
    for (let i = 0; i < 30 && rafQ.length; i++) { const q = rafQ; rafQ = []; q.forEach(f => f(performance.now() + 32)); }
    const probe = vm.runInContext('({state,chapter,lvl,oil:typeof oil!=="undefined"?Math.round(oil):-1})', sandbox);
    console.log(btnId + ' -> ' + JSON.stringify(probe));
  } catch (e) {
    console.error(btnId + '_ERROR:', e.stack ? e.stack.split('\n').slice(0, 8).join('\n') : e);
  }
}
(async () => {
  await tryChapter('ch1Btn');
  // 暂停菜单 + 纸条系统（第一章）
  try {
    vm.runInContext('state="playing";paused=false;', sandbox);
    vm.runInContext('openPause()', sandbox);
    const st1 = vm.runInContext('({paused,prog:document.getElementById("progInfo").innerHTML.length>0,jr:document.getElementById("journal").innerHTML.length>0})', sandbox);
    console.log('pauseOpen:', JSON.stringify(st1));
    vm.runInContext('closePause()', sandbox);
    console.log('pauseClosed paused=', vm.runInContext('paused', sandbox));
    // 纸条拾取：把玩家传送到 lvl0 第一张纸条旁
    const pick = vm.runInContext('(function(){lvl=0;player.x=NOTES[0].x-0.3;player.y=NOTES[0].y;interact();return {found:notesFound.length,txt:toast.text.slice(0,12)};})()', sandbox);
    console.log('notePickup:', JSON.stringify(pick));
    vm.runInContext('openPause();refreshJournal();', sandbox);
    const jr = vm.runInContext('document.getElementById("journal").innerHTML', sandbox);
    console.log('journal has note:', jr.indexOf('撕剩半页的日历') >= 0);
    // 音量
    vm.runInContext('volume=0.5;applyVolume();', sandbox);
    console.log('volume applied OK');
  } catch (e) {
    console.error('PAUSE_NOTE_ERROR:', e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  }
  await tryChapter('ch2Btn');
  await tryChapter('ch3Btn');
})();
