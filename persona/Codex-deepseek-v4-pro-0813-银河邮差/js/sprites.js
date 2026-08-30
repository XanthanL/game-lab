(function (global) {
  'use strict';

  var PALETTE = {
    '.': null,
    k: '#08070f',
    K: '#11111f',
    C: '#2b6cb0',
    c: '#63b3ed',
    H: '#1a365d',
    h: '#2c5282',
    F: '#e8b78c',
    f: '#c98a63',
    L: '#f6e05e',
    l: '#fff7d6',
    W: '#f7fafc',
    w: '#cbd5e0',
    R: '#c53030',
    r: '#e53e3e',
    Y: '#ecc94b',
    y: '#f6e05e',
    B: '#2f2a26',
    b: '#4a443c',
    S: '#a0aec0',
    s: '#718096',
    G: '#2f855a',
    g: '#48bb78',
    N: '#1a202c',
    O: '#dd6b20'
  };

  var SPRITES = {
    letter: [
      'KKKKKKKK',
      'KWWWWWWK',
      'KWWWWWWK',
      'KWRRWWWK',
      'KWWWWWWK',
      'KKKKKKKK'
    ],
    mailbox: [
      '..KKKKKK....',
      '.KSSSSSSK...',
      'KSSSSSSSSK..',
      'KSKSSSSKSK..',
      'KSSSSSSSSK..',
      'KSSSSSSSSK..',
      '.KSSSSSSK...',
      '..KSSSSK....',
      '..KSSSSK....',
      '...KSSK.....',
      '...KSSK.....',
      '...KBBK.....'
    ]
  };

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function line(ctx, x0, y0, x1, y1, color) {
    ctx.fillStyle = color;
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    cx = Math.round(cx); cy = Math.round(cy);
    r = Math.max(0, Math.round(r));
    for (var y = -r; y <= r; y++) {
      var w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }

  function circle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    var x = r, y = 0, err = 0;
    while (x >= y) {
      ctx.fillRect(cx + x, cy + y, 1, 1);
      ctx.fillRect(cx + y, cy + x, 1, 1);
      ctx.fillRect(cx - x, cy + y, 1, 1);
      ctx.fillRect(cx - y, cy + x, 1, 1);
      ctx.fillRect(cx - x, cy - y, 1, 1);
      ctx.fillRect(cx - y, cy - x, 1, 1);
      ctx.fillRect(cx + x, cy - y, 1, 1);
      ctx.fillRect(cx + y, cy - x, 1, 1);
      if (err <= 0) { y += 1; err += 2 * y + 1; }
      if (err > 0) { x -= 1; err -= 2 * x + 1; }
    }
  }

  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function text(ctx, str, x, y, color, size, align) {
    ctx.fillStyle = color;
    ctx.font = (size || 12) + 'px "Microsoft YaHei", "PingFang SC", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
  }

  function glow(ctx, cx, cy, r, color) {
    r = Math.max(1, Math.round(r));
    for (var i = r; i > 0; i--) {
      ctx.globalAlpha = (1 - i / r) * 0.22;
      disc(ctx, cx, cy, i, color);
    }
    ctx.globalAlpha = 1;
  }

  function drawSprite(ctx, name, x, y, scale, flip) {
    var rows = SPRITES[name];
    scale = scale || 1;
    if (!rows) return;
    for (var ry = 0; ry < rows.length; ry++) {
      var row = rows[ry];
      for (var rx = 0; rx < row.length; rx++) {
        var color = PALETTE[row[rx]];
        if (!color) continue;
        var sx = flip ? row.length - 1 - rx : rx;
        ctx.fillStyle = color;
        ctx.fillRect(x + sx * scale, y + ry * scale, scale, scale);
      }
    }
  }

  function parseColor(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) {
      var v = parseInt(m[1], 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    }
    var rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(c);
    if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
    return [255, 255, 255];
  }

  function lerpColor(a, b, t) {
    var pa = parseColor(a), pb = parseColor(b);
    var r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    var g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    var bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function gradientV(ctx, x, y, w, h, c1, c2) {
    for (var i = 0; i < h; i++) {
      var t = h <= 1 ? 0 : i / (h - 1);
      ctx.fillStyle = lerpColor(c1, c2, t);
      ctx.fillRect(x, y + i, w, 1);
    }
  }

  global.Pixel = {
    PALETTE: PALETTE,
    SPRITES: SPRITES,
    rect: rect,
    px: px,
    line: line,
    disc: disc,
    circle: circle,
    makeRng: makeRng,
    text: text,
    glow: glow,
    drawSprite: drawSprite,
    gradientV: gradientV,
    lerpColor: lerpColor
  };
})(window);
