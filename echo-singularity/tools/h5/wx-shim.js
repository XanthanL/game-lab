/* ============================================================================
   wx-shim.js —— 浏览器里的假 wx
   ----------------------------------------------------------------------------
   目的：不开微信开发者工具也能跑同一份游戏代码（真跑、真截图、真断言）。
   刻意**不实现** onTouchStart/Move/End/Cancel —— 让 PAL 走自己的 DOM 兜底，
   这样鼠标和触屏都能操作，headless 里也能派发事件做回归。
   ========================================================================== */
(function () {
  'use strict';

  var listeners = { show: [], hide: [] };

  window.wx = {
    /* ── 系统 ─────────────────────────────────────────────────────── */
    getSystemInfoSync: function () {
      return {
        windowWidth: window.innerWidth || 390,
        windowHeight: window.innerHeight || 844,
        pixelRatio: window.devicePixelRatio || 2,
        platform: 'devtools',
        brand: 'shim', model: 'browser',
        SDKVersion: '0.0.0',
        benchmarkLevel: 99,
      };
    },

    /* ── 画布 ─────────────────────────────────────────────────────── */
    createCanvas: function () {
      var c = document.createElement('canvas');
      c.style.position = 'fixed';
      c.style.left = '0';
      c.style.top = '0';
      c.style.display = 'block';
      c.style.background = '#0e1520';
      document.body.appendChild(c);
      return c;
    },

    /* ── 存储（本地兜底，不污染真实 localStorage 语义） ────────────── */
    getStorageSync: function (k) {
      try { var raw = localStorage.getItem('wx_' + k); return raw == null ? '' : JSON.parse(raw); }
      catch (e) { return ''; }
    },
    setStorageSync: function (k, v) {
      try { localStorage.setItem('wx_' + k, JSON.stringify(v)); return; } catch (e) { }
    },
    removeStorageSync: function (k) {
      try { localStorage.removeItem('wx_' + k); } catch (e) { }
    },

    /* ── 音频（浏览器里直接 no-op，免得自动播放策略报错） ──────────── */
    createInnerAudioContext: function () {
      var a = {
        src: '', loop: false, volume: 1, autoplay: false,
        play: function () { }, stop: function () { }, pause: function () { },
        seek: function () { }, destroy: function () { },
      };
      return a;
    },

    /* ── 分享 ─────────────────────────────────────────────────────── */
    onShareAppMessage: function (fn) { window.__wxShareDefault = fn; },
    shareAppMessage: function (o) {
      window.__wxLastShare = o;
      if (typeof console !== 'undefined') console.log('[wx.shareAppMessage]', o);
    },
    getLaunchOptionsSync: function () {
      var q = {};
      var s = (location.search || '').replace(/^\?/, '') || (location.hash || '').replace(/^#/, '');
      s.split('&').forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf('=');
        if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      });
      return { scene: 1001, query: q };
    },

    /* ── 生命周期（映射到浏览器可见性） ───────────────────────────── */
    onShow: function (cb) { listeners.show.push(cb); },
    onHide: function (cb) { listeners.hide.push(cb); },

    /* ── 反馈 ─────────────────────────────────────────────────────── */
    vibrateShort: function () { },
    exitMiniProgram: function () { },
    canvasToTempFilePath: function (o) { (o.fail || function () { })(); },
  };

  document.addEventListener('visibilitychange', function () {
    var arr = document.hidden ? listeners.hide : listeners.show;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i]({ scene: 1001, query: {} }); } catch (e) { }
    }
  });
})();
