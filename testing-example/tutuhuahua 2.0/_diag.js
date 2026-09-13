(function () {
  var errs = [];
  window.addEventListener('error', function (e) {
    errs.push('onerror: ' + (e.message || e.type));
  }, true);
  var ow = console.warn, oe = console.error;
  console.warn = function () { errs.push('warn: ' + Array.prototype.join.call(arguments, ' ')); return ow.apply(console, arguments); };
  console.error = function () { errs.push('error: ' + Array.prototype.join.call(arguments, ' ')); return oe.apply(console, arguments); };
  var texFails = [];
  var origTex = WebGLRenderingContext.prototype.texImage2D;
  WebGLRenderingContext.prototype.texImage2D = function () {
    try { return origTex.apply(this, arguments); }
    catch (e) { texFails.push(String(e && e.name) + ':' + String(e && e.message).slice(0, 80)); throw e; }
  };
  (function flush() {
    if (document.body) {
      var fb = document.getElementById('ring-fallback');
      var st = document.getElementById('ring-stage');
      document.body.setAttribute('data-diag-errs', errs.slice(0, 6).join(' || ') || '(none)');
      document.body.setAttribute('data-diag-texfail', texFails.slice(0, 4).join(' || ') || '(none)');
      document.body.setAttribute('data-diag-fb', fb ? (getComputedStyle(fb).display + ' hidden=' + fb.hasAttribute('hidden') + ' rect=' + JSON.stringify(fb.getBoundingClientRect().toJSON ? fb.getBoundingClientRect().toJSON() : {})) : 'none');
      document.body.setAttribute('data-diag-off', st ? String(st.className) : 'none');
    }
    requestAnimationFrame(flush);
  })();
})();
