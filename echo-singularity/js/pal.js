;(function () {
'use strict';
/* ============================================================================
   pal.js —— 平台适配层（Platform Adaptation Layer）
   ----------------------------------------------------------------------------
   铁律：**全项目只有本文件允许出现 `wx.` 调用。**
   任何其它模块需要平台能力，一律走 PAL 暴露的接口。
   这样 H5 预览（tools/h5/wx-shim.js）只要伪造一个全局 wx 就能跑同一份逻辑，
   也保证将来换宿主只改这一个文件。

   能力对账（网页版 → 小游戏）：
     document/canvas   → wx.createCanvas()            （只有一个主 canvas）
     addEventListener  → wx.onTouchStart/Move/End/Cancel
     localStorage      → wx.get/setStorageSync        （同步，可直接存对象）
     new Audio()       → wx.createInnerAudioContext()
     location.hash     → wx.getLaunchOptionsSync().query + wx.shareAppMessage
     window.innerWidth → wx.getSystemInfoSync().windowWidth（逻辑 px）
     requestAnimationFrame → 全局可用（小游戏提供）
     performance.now   → 不保证存在，用 now() 兜底 Date.now()
   ========================================================================== */

var _wx = (typeof wx !== 'undefined') ? wx : null;

/* ── 基础环境探测 ─────────────────────────────────────────────────────── */
function _sys() {
  if (_wx && _wx.getSystemInfoSync) {
    try {
      var s = _wx.getSystemInfoSync();
      return {
        W: s.windowWidth || 375,
        H: s.windowHeight || 667,
        DPR: Math.min(s.pixelRatio || 2, 3),   // 封顶 3，再高纯属烧 GPU
        brand: s.brand || '',
        model: s.model || '',
        platform: s.platform || '',
        SDK: s.SDKVersion || '',
        benchmark: s.benchmarkLevel || -1,      // 低端机判别用
      };
    } catch (e) { /* 落到兜底 */ }
  }
  return {
    W: typeof window !== 'undefined' ? window.innerWidth : 375,
    H: typeof window !== 'undefined' ? window.innerHeight : 667,
    DPR: (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 3) : 2,
    brand: '', model: '', platform: 'devtools', SDK: '', benchmark: -1,
  };
}

var SYS = _sys();

/* ── 主画布 ───────────────────────────────────────────────────────────── */
var _canvas = null, _ctx = null;

function createMainCanvas() {
  if (_canvas) return _canvas;
  if (_wx && _wx.createCanvas) {
    _canvas = _wx.createCanvas();
  } else if (typeof document !== 'undefined') {
    _canvas = document.createElement('canvas');
  } else {
    throw new Error('PAL: 无法创建画布 —— 宿主既不是小游戏也不是浏览器');
  }
  return _canvas;
}

/* 把画布尺寸对齐到视口：canvas 用物理像素，逻辑坐标系用 setTransform 缩放 */
function fitCanvas(cv) {
  cv = cv || _canvas;
  cv.width = Math.round(SYS.W * SYS.DPR);
  cv.height = Math.round(SYS.H * SYS.DPR);
  if (cv.style) { cv.style.width = SYS.W + 'px'; cv.style.height = SYS.H + 'px'; }
  const c = cv.getContext('2d');
  if (c && c.setTransform) c.setTransform(SYS.DPR, 0, 0, SYS.DPR, 0, 0);
  return c;
}

function getCtx() {
  if (!_ctx) { createMainCanvas(); _ctx = fitCanvas(_canvas); }
  return _ctx;
}

/* ── 离屏 2D 画布 ─────────────────────────────────────────────────────────
   给「黑洞透镜」用：把主画布奇点周围那块先拷进来，再逐环重采样。
   ⚠️ 官方文档明确：离屏 canvas 类型不可混用（webgl 的不能 getContext('2d')），
      不同 canvas 创建的图片对象也不支持混用。所以这里只开 **2d** 类型，
      不要试图拿 webgl 离屏画布往 2d 主画布上 drawImage —— 那是未文档化的行为。 */
function createOffscreen2D(w, h) {
  if (_wx && _wx.createOffscreenCanvas) {
    try {
      const cv = _wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
      if (cv) return cv;
    } catch (e) { /* 落到浏览器兜底 */ }
  }
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }
  return null;
}

/* ── 时间 ─────────────────────────────────────────────────────────────── */
var _hasPerf = (typeof performance !== 'undefined' && typeof performance.now === 'function');
function now() { return _hasPerf ? performance.now() : Date.now(); }

/* ── 帧循环 ───────────────────────────────────────────────────────────── */
var _raf = (typeof requestAnimationFrame === 'function')
  ? requestAnimationFrame.bind(null)
  : (function () {
      return function (cb) { return setTimeout(function () { cb(now()); }, 16); };
    })();

/* ── 触摸 ─────────────────────────────────────────────────────────────────
   小游戏四个回调的 event 形如：
     { type, timeStamp, touches:[{identifier,x,y}], changedTouches:[{...}] }
   注意：x/y 已经是**逻辑像素**（与 canvas 的逻辑坐标一致），不需要再除 DPR。 */
function _bind(name, cb) {
  if (_wx && _wx[name]) { _wx[name](cb); return true; }
  return false;
}

const Touch = {
  onStart:  function (cb) { if (!_bind('onTouchStart', cb)) _fallbackTouch('start', cb); },
  onMove:   function (cb) { if (!_bind('onTouchMove', cb)) _fallbackTouch('move', cb); },
  onEnd:    function (cb) { if (!_bind('onTouchEnd', cb)) _fallbackTouch('end', cb); },
  onCancel: function (cb) { if (!_bind('onTouchCancel', cb)) _fallbackTouch('cancel', cb); },
};

/* H5 兜底：把原生事件包装成小游戏同构的 event 对象 */
function _fallbackTouch(kind, cb) {
  if (typeof document === 'undefined') return;
  const map = { start: 'touchstart', move: 'touchmove', end: 'touchend', cancel: 'touchcancel' };
  const mouse = { start: 'mousedown', move: 'mousemove', end: 'mouseup', cancel: 'mouseleave' };
  /* ★ 必须优先读 changedTouches：touchend / touchcancel 时 touches 是空列表，
       若优先读 touches 就会回退成原生 event，identifier 变成 0 → 跟摇杆 id
       对不上 → 摇杆永远释放不掉（松手后船还在飘）。 */
  const pack = function (e) {
    let src = [e];
    if (e.changedTouches && e.changedTouches.length) src = e.changedTouches;
    else if (e.touches && e.touches.length) src = e.touches;
    const list = [];
    for (let i = 0; i < src.length; i++) {
      const t = src[i];
      list.push({
        identifier: t.identifier != null ? t.identifier : 0,
        x: t.clientX || 0, y: t.clientY || 0,
      });
    }
    return { type: kind, timeStamp: e.timeStamp || now(), touches: list, changedTouches: list };
  };
  document.addEventListener(map[kind], function (e) { e.preventDefault && e.preventDefault(); cb(pack(e)); }, { passive: false });
  document.addEventListener(mouse[kind], function (e) { cb(pack(e)); });
}

/* ── 存储（同步；小游戏可直接存对象，H5 兜底走 JSON + localStorage） ──── */
const Store = {
  get: function (k, def) {
    try {
      let v;
      if (_wx && _wx.getStorageSync) { v = _wx.getStorageSync(k); }
      else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(k);
        v = raw == null ? '' : JSON.parse(raw);
      }
      return (v === '' || v == null) ? def : v;
    } catch (e) { return def; }
  },
  set: function (k, v) {
    try {
      if (_wx && _wx.setStorageSync) { _wx.setStorageSync(k, v); return true; }
      if (typeof localStorage !== 'undefined') { localStorage.setItem(k, JSON.stringify(v)); return true; }
    } catch (e) { /* 配额满 / 隐私模式：静默失败，游戏不该因此崩 */ }
    return false;
  },
  del: function (k) {
    try {
      if (_wx && _wx.removeStorageSync) { _wx.removeStorageSync(k); return; }
      if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    } catch (e) { }
  },
};

/* ── 音频 ─────────────────────────────────────────────────────────────────
   小游戏音频是 InnerAudioContext：src / loop / volume / play / stop / destroy。
   ⚠️ 分包里的音频要用分包路径，且首次 play 有解码延迟 —— 预热在 boot 里做。
   ⚠️ 音频不在 PAL 自动创建，交给 audio 模块按需建，避免开局就吃内存。 */
const AudioCtl = {
  create: function (src, opt) {
    opt = opt || {};
    if (_wx && _wx.createInnerAudioContext) {
      const a = _wx.createInnerAudioContext();
      a.src = src;
      a.loop = !!opt.loop;
      a.volume = opt.volume != null ? opt.volume : 1;
      if (opt.autoplay) a.play();
      return {
        play:    function () { try { a.play(); } catch (e) { } },
        stop:    function () { try { a.stop(); } catch (e) { } },
        pause:   function () { try { a.pause(); } catch (e) { } },
        seek:    function (s) { try { a.seek(s); } catch (e) { } },
        volume:  function (v) { try { a.volume = v; } catch (e) { } },
        destroy: function () { try { a.destroy(); } catch (e) { } },
      };
    }
    // H5 兜底
    if (typeof window !== 'undefined' && window.Audio) {
      const a = new window.Audio(src);
      a.loop = !!opt.loop;
      a.volume = opt.volume != null ? opt.volume : 1;
      if (opt.autoplay) { try { a.play(); } catch (e) { } }
      return {
        play:    function () { try { a.currentTime = 0; a.play(); } catch (e) { } },
        stop:    function () { try { a.pause(); a.currentTime = 0; } catch (e) { } },
        pause:   function () { try { a.pause(); } catch (e) { } },
        seek:    function (s) { try { a.currentTime = s; } catch (e) { } },
        volume:  function (v) { try { a.volume = v; } catch (e) { } },
        destroy: function () { try { a.pause(); } catch (e) { } },
      };
    }
    const noop = function () { };
    return { play: noop, stop: noop, pause: noop, seek: noop, volume: noop, destroy: noop };
  },
};

/* ── 分享 ─────────────────────────────────────────────────────────────────
   网页版用 location.hash 的 #g= 分享轨迹码；小游戏换成 query。
   这是**唯一天然增长引擎**，移植里优先级最高的一块。 */
const Share = {
  /* 设置右上角「…」转发的默认内容 */
  setDefault: function (o) {
    if (_wx && _wx.onShareAppMessage) { _wx.onShareAppMessage(function () { return o; }); return true; }
    return false;
  },
  /* 主动拉起转发（只能由用户点击触发） */
  show: function (o) {
    if (_wx && _wx.shareAppMessage) { _wx.shareAppMessage(o); return true; }
    return false;
  },
  /* 启动参数：别人从你的分享卡片进来时带上 */
  getLaunchQuery: function () {
    try {
      if (_wx && _wx.getLaunchOptionsSync) {
        const o = _wx.getLaunchOptionsSync() || {};
        return o.query || {};
      }
    } catch (e) { }
    // H5 兜底：读 location.hash / search 里的 query
    if (typeof location !== 'undefined') {
      const out = {};
      const s = (location.search || '').replace(/^\?/, '') || (location.hash || '').replace(/^#/, '');
      s.split('&').forEach(function (kv) {
        if (!kv) return;
        const i = kv.indexOf('=');
        if (i > 0) out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      });
      return out;
    }
    return {};
  },
  /* 冷启动之后（onShow）也可能带 query，转发链要接住 */
  onShowQuery: function (cb) {
    if (_wx && _wx.onShow) {
      _wx.onShow(function (res) { if (res && res.query) cb(res.query); });
      return true;
    }
    return false;
  },
};

/* ── 生命周期 ─────────────────────────────────────────────────────────── */
const Life = {
  onShow: function (cb) { if (_wx && _wx.onShow) _wx.onShow(cb); },
  onHide: function (cb) { if (_wx && _wx.onHide) _wx.onHide(cb); },
};

/* ── 反馈 ─────────────────────────────────────────────────────────────── */
function vibrate(type) {
  if (_wx && _wx.vibrateShort) { try { _wx.vibrateShort({ type: type || 'light' }); } catch (e) { } }
}

/* ── 其它 ─────────────────────────────────────────────────────────────── */
function isWechat() { return !!_wx; }
function exit() { if (_wx && _wx.exitMiniProgram) { try { _wx.exitMiniProgram(); } catch (e) { } } }
/* 分享图：把当前主画布截成临时文件（用于转发卡片的 imageUrl） */
function canvasToTempFilePath(cv, cb) {
  cv = cv || _canvas;
  if (_wx && _wx.canvasToTempFilePath) {
    _wx.canvasToTempFilePath({
      canvas: cv, x: 0, y: 0,
      width: cv.width, height: cv.height,
      destWidth: Math.round(cv.width * 0.5), destHeight: Math.round(cv.height * 0.5),
      success: function (r) { cb && cb(r.tempFilePath); },
      fail: function () { cb && cb(null); },
    });
    return;
  }
  if (cv && cv.toDataURL) { cb && cb(cv.toDataURL('image/png')); return; }
  cb && cb(null);
}

module.exports = {
  wx: _wx,
  isWechat: isWechat,
  SYS: SYS,
  W: SYS.W, H: SYS.H, DPR: SYS.DPR,
  createMainCanvas: createMainCanvas,
  createOffscreen2D: createOffscreen2D,
  fitCanvas: fitCanvas,
  getCtx: getCtx,
  get canvas() { return _canvas; },
  now: now,
  raf: _raf,
  Touch: Touch,
  Store: Store,
  Audio: AudioCtl,
  Share: Share,
  Life: Life,
  vibrate: vibrate,
  exit: exit,
  canvasToTempFilePath: canvasToTempFilePath,
};
})();
