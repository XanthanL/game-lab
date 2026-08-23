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
    querySelector(sel) { if (!el['_q' + sel]) el['_q' + sel] = mkEl(el.id + '_' + sel); return el['_q' + sel]; },
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
    for (const id of ['intro0', 'intro2', 'intro3', 'intro4']) {
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
  await tryChapter('ch0Btn');
  // 第〇章：差事交互 + 井边结局触发链
  try {
    vm.runInContext('state="playing";paused=false;chapter=0;lvl=4;', sandbox);
    const t1 = vm.runInContext('(function(){const t=ch0Tasks[0];player.x=t.x-0.3;player.y=t.y;interact();return {errands,done:t.done};})()', sandbox);
    console.log('ch0Task1:', JSON.stringify(t1));
    const well = vm.runInContext('(function(){ch0Tasks.forEach(t=>t.done=true);errands=3;player.x=WELL_X-0.3;player.y=WELL_Y+0.3;interact();return {seq:seq&&seq.mode};})()', sandbox);
    console.log('ch0WellEnding:', JSON.stringify(well));
  } catch (e) {
    console.error('CH0_ERROR:', e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  }
  await tryChapter('ch2Btn');
  await tryChapter('ch3Btn');
  await tryChapter('ch4Btn');
  // 终章：祭品拾取 / 井台沉愿 / 木桶结局 / 真结局文案 / 地图可达性
  try {
    vm.runInContext('state="playing";paused=false;chapter=4;lvl=5;', sandbox);
    // 关键点 BFS 可达性（井/三祭品/三油坛/出生点）
    const reach = vm.runInContext('(function(){const cells=reachableByLevel[5];const ts=[[11,2],[17,2],[3,17],[19,12],[6,13],[16,4],[11,7],[12,17]];return ts.map(t=>cells.some(p=>Math.floor(p.x)===t[0]&&Math.floor(p.y)===t[1]));})()', sandbox);
    console.log('ch4Reach:', JSON.stringify(reach));
    const p1 = vm.runInContext('(function(){const o=offerings[0];player.x=o.x-0.3;player.y=o.y;interact();return {carried:carried.slice(),taken:o.taken};})()', sandbox);
    console.log('ch4Pick1:', JSON.stringify(p1));
    const s = vm.runInContext('(function(){offerings.forEach(o=>o.taken=true);carried=["doll","comb","salt"];let n=0;for(let i=0;i<3;i++){player.x=WELL_X-0.3;player.y=WELL_Y+0.5;interact();n=offerSunk;}return {sunk:n,bucket:bucketSpawned,ghostStun:ghost&&ghost.stunT>0};})()', sandbox);
    console.log('ch4Sink:', JSON.stringify(s));
    const w = vm.runInContext('(function(){player.x=WELL_X-0.3;player.y=WELL_Y+0.5;interact();return {seq:seq&&seq.mode};})()', sandbox);
    console.log('ch4WellEnding:', JSON.stringify(w));
    // 真结局（集齐 12 纸条）：win 分支文案
    vm.runInContext('notesFound=NOTES.map((n,i)=>i);seq={mode:"win",t:2.7};state="playing";', sandbox);
    for (let i = 0; i < 3 && rafQ.length; i++) { const q = rafQ; rafQ = []; q.forEach(f => f(performance.now() + 1e6 + i * 200)); }
    const h1 = vm.runInContext('document.getElementById("win").querySelector("h1").textContent', sandbox);
    const stats = vm.runInContext('document.getElementById("winstats").textContent.slice(0, 18)', sandbox);
    console.log('ch4TrueEnd:', JSON.stringify({ h1, stats }));
  } catch (e) {
    console.error('CH4_ERROR:', e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  }
  // 抓捕三次挣扎：前两次挣脱（怨灵硬直+弹开），第三次死亡
  try {
    const g = vm.runInContext('(function(){seq=null;state="playing";paused=false;chapter=2;grabs=0;grabGrace=0;const px=player.x;const a=hurtByGrab(px-1.2,player.y);grabGrace=0;const b=hurtByGrab(px-1.2,player.y);grabGrace=0;const c=hurtByGrab(px-1.2,player.y);return {a,b,c,dead:!!(seq&&seq.mode==="death"),knocked:player.x>px,grace:grabGrace>0,ghostStun:ghost&&ghost.stunT>0};})()', sandbox);
    console.log('grabSystem:', JSON.stringify(g));
  } catch (e) {
    console.error('GRAB_ERROR:', e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  }
})();
