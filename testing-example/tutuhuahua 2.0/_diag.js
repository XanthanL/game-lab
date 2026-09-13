(function () {
  var names = {}, dump = {};
  var origGetUL = WebGLRenderingContext.prototype.getUniformLocation;
  WebGLRenderingContext.prototype.getUniformLocation = function (p, n) {
    var loc = origGetUL.call(this, p, n);
    if (loc) { try { names[loc.__id = (loc.__id || (loc.__id = Math.random()))] = n; } catch (e) {} }
    return loc;
  };
  function wrap(fn, key, n) {
    var orig = WebGLRenderingContext.prototype[fn];
    WebGLRenderingContext.prototype[fn] = function (loc) {
      if (loc && names[loc.__id]) {
        var a = arguments[arguments.length - 1];
        if (a && a.length !== undefined) {
          var arr = []; for (var i = 0; i < a.length; i++) arr.push(Math.round(a[i] * 1000) / 1000);
          dump[names[loc.__id]] = arr.slice(0, n);
        }
      }
      return orig.apply(this, arguments);
    };
  }
  wrap('uniform2fv', 'uPos', 28);
  wrap('uniform4fv', 'uScale', 56);
  wrap('uniform1fv', 'uRot', 14);
  var orig1f = WebGLRenderingContext.prototype.uniform1f;
  WebGLRenderingContext.prototype.uniform1f = function (loc, v) {
    if (loc && names[loc.__id]) {
      var n = names[loc.__id];
      if (n === 'uCount' || n === 'uLinkCount') dump[n] = v;
    }
    return orig1f.apply(this, arguments);
  };
  (function flush() {
    if (document.body) {
      var pos = dump.uPos || [], sc = dump.uScale || [];
      var lines = [];
      for (var i = 0; i < 14; i++) {
        lines.push(i + ':' + pos[i * 2] + ',' + pos[i * 2 + 1] +
          ' s=' + sc[i * 4] + '/' + sc[i * 4 + 1] + ' cell=' + sc[i * 4 + 3]);
      }
      document.body.setAttribute('data-diag-count', dump.uCount);
      document.body.setAttribute('data-diag-rot', (dump.uRot || []).join(','));
      document.body.setAttribute('data-diag-pos', lines.join(' | '));
    }
    requestAnimationFrame(flush);
  })();
})();
