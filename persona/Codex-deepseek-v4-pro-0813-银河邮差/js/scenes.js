(function (global) {
  'use strict';

  var c = global.Pixel;

  function nightSky(ctx, t, horizon, seed, starCount) {
    c.gradientV(ctx, 0, 0, 256, horizon || 150, '#050815', '#1b2450');
    var rng = c.makeRng(seed || 7);
    var n = starCount || 80;
    for (var i = 0; i < n; i++) {
      var x = Math.floor(rng() * 256);
      var y = Math.floor(rng() * Math.max(4, (horizon || 150) - 4));
      var b = rng();
      var col = b > 0.82 ? '#ffffff' : (b > 0.45 ? '#cdd7ff' : '#6d7cb5');
      c.px(ctx, x, y, col);
      var tw = Math.sin(t * 2 + x * 0.7 + y * 1.1);
      if (b > 0.6 && tw > 0.35) {
        c.px(ctx, x - 1, y, col);
        c.px(ctx, x + 1, y, col);
        c.px(ctx, x, y - 1, col);
        c.px(ctx, x, y + 1, col);
      }
    }
  }

  function ground(ctx, y, color1, color2) {
    c.gradientV(ctx, 0, y, 256, 192 - y, color1, color2);
  }

  function citySkyline(ctx, horizon, seed) {
    var rng = c.makeRng(seed || 11);
    var x = 8;
    c.rect(ctx, 0, horizon - 1, 256, 1, '#0b1224');
    while (x < 250) {
      var w = 12 + Math.floor(rng() * 22);
      var h = 20 + Math.floor(rng() * 42);
      var top = horizon - h;
      c.rect(ctx, x, top, w, h, '#0d1527');
      for (var wy = top + 3; wy < horizon - 4; wy += 5) {
        for (var wx = x + 2; wx < x + w - 2; wx += 4) {
          var r = rng();
          if (r > 0.72) c.rect(ctx, wx, wy, 2, 3, '#f6c85e');
          else if (r > 0.9) c.rect(ctx, wx, wy, 2, 3, '#d69e3a');
        }
      }
      x += w + 3 + Math.floor(rng() * 5);
    }
  }

  function postOffice(ctx, x, y, w, h) {
    c.rect(ctx, x, y, w, h, '#3c2416');
    c.rect(ctx, x, y, w, 2, '#7b4a26');
    c.rect(ctx, x - 3, y - 5, w + 6, 6, '#5b3a24');
    c.rect(ctx, x - 3, y - 6, w + 6, 1, '#8a5a2e');
    c.rect(ctx, x + Math.floor(w / 2) - 5, y + h - 22, 10, 22, '#f6c85e');
    c.rect(ctx, x + Math.floor(w / 2) - 4, y + h - 21, 4, 20, '#fff0b8');
    c.rect(ctx, x + 4, y + 10, 9, 10, '#f6c85e');
    c.rect(ctx, x + 5, y + 11, 3, 8, '#fff0b8');
    c.rect(ctx, x + 9, y + 11, 3, 8, '#fff0b8');
    c.rect(ctx, x + Math.floor(w / 2) - 10, y + 4, 20, 6, '#e7c877');
  }

  function streetLamp(ctx, x, y) {
    c.rect(ctx, x - 1, y - 34, 2, 34, '#3a2315');
    c.rect(ctx, x - 4, y, 8, 2, '#3a2315');
    c.rect(ctx, x - 1, y - 34, 9, 2, '#3a2315');
    c.rect(ctx, x + 7, y - 32, 5, 6, '#f6e05e');
    c.rect(ctx, x + 7, y - 32, 5, 1, '#fff7d6');
    c.glow(ctx, x + 9, y - 28, 6, '#f6e05e');
  }

  function drawStar(ctx, x, y, r, color, twinkle, t) {
    c.disc(ctx, x, y, Math.max(1, Math.round(r * 0.45)), color);
    c.line(ctx, x - r, y, x + r, y, color);
    c.line(ctx, x, y - r, x, y + r, color);
    if (r >= 3) {
      c.line(ctx, x - r + 1, y - 1, x + r - 1, y - 1, color);
      c.line(ctx, x - r + 1, y + 1, x + r - 1, y + 1, color);
    }
  }

  function drawPostman(ctx, x, y, t, opts) {
    opts = opts || {};
    var walk = opts.walk ? Math.floor(t * 3) % 2 : 0;
    c.rect(ctx, x - 2, y + 21, 24, 1, 'rgba(0,0,0,0.35)');

    if (walk) {
      c.rect(ctx, x + 5, y + 15, 3, 6, '#1a202c');
      c.rect(ctx, x + 11, y + 14, 3, 6, '#1a202c');
      c.rect(ctx, x + 5, y + 20, 3, 1, '#2f2a26');
      c.rect(ctx, x + 11, y + 19, 3, 1, '#2f2a26');
    } else {
      c.rect(ctx, x + 5, y + 15, 3, 6, '#1a202c');
      c.rect(ctx, x + 11, y + 15, 3, 6, '#1a202c');
      c.rect(ctx, x + 5, y + 20, 3, 1, '#2f2a26');
      c.rect(ctx, x + 11, y + 20, 3, 1, '#2f2a26');
    }

    c.rect(ctx, x + 3, y + 8, 13, 8, '#2b6cb0');
    c.rect(ctx, x + 3, y + 8, 13, 1, '#63b3ed');
    c.rect(ctx, x + 6, y + 7, 7, 1, '#1a365d');
    c.rect(ctx, x + 1, y + 9, 2, 6, '#2b6cb0');
    c.rect(ctx, x + 15, y + 9, 2, 3, '#2b6cb0');

    c.disc(ctx, x + 9, y + 4, 5, '#e8b78c');
    c.rect(ctx, x + 5, y, 8, 2, '#1a365d');
    c.rect(ctx, x + 6, y - 4, 6, 4, '#1a365d');
    c.rect(ctx, x + 6, y - 4, 6, 1, '#2c5282');
    c.px(ctx, x + 11, y + 3, '#2f2a26');

    c.rect(ctx, x + 17, y + 9, 4, 5, '#f6e05e');
    c.rect(ctx, x + 17, y + 9, 4, 1, '#fff7d6');
    c.rect(ctx, x + 17, y + 9, 1, 5, '#8a5a1e');
    c.rect(ctx, x + 20, y + 9, 1, 5, '#8a5a1e');
    c.rect(ctx, x + 18, y + 8, 2, 1, '#8a5a1e');
    c.glow(ctx, x + 19, y + 11, 7, '#f6e05e');
  }

  function drawChild(ctx, x, y, t, opts) {
    opts = opts || {};
    c.rect(ctx, x - 1, y + 15, 14, 1, 'rgba(0,0,0,0.35)');
    c.rect(ctx, x + 3, y + 10, 2, 5, '#1a202c');
    c.rect(ctx, x + 8, y + 10, 2, 5, '#1a202c');
    c.rect(ctx, x + 3, y + 14, 2, 1, '#2f2a26');
    c.rect(ctx, x + 8, y + 14, 2, 1, '#2f2a26');
    c.rect(ctx, x + 2, y + 6, 9, 5, '#c53030');
    c.rect(ctx, x + 2, y + 6, 9, 1, '#e53e3e');
    c.rect(ctx, x, y + 7, 2, 4, '#c53030');
    c.rect(ctx, x + 11, y + 7, 2, 4, '#c53030');
    c.disc(ctx, x + 6, y + 3, 4, '#e8b78c');
    c.rect(ctx, x + 3, y, 7, 2, '#2f2a26');
    c.rect(ctx, x + 3, y, 1, 3, '#2f2a26');
    c.rect(ctx, x + 9, y, 1, 3, '#2f2a26');
    c.px(ctx, x + 8, y + 3, '#2f2a26');
  }

  function drawBoat(ctx, x, y, t, opts) {
    var bob = Math.round(Math.sin(t * 2.2) * 1.2);
    var yy = y + bob;
    c.line(ctx, x + 9, yy - 2, x + 2, yy - 10, '#f7fafc');
    c.line(ctx, x + 9, yy - 2, x + 16, yy - 10, '#f7fafc');
    c.line(ctx, x + 2, yy - 10, x + 16, yy - 10, '#e2e8f0');
    c.line(ctx, x + 9, yy - 2, x + 9, yy + 1, '#e2e8f0');
    c.line(ctx, x + 1, yy + 1, x + 17, yy + 1, '#f7fafc');
    c.line(ctx, x + 1, yy + 1, x + 6, yy + 6, '#e2e8f0');
    c.line(ctx, x + 17, yy + 1, x + 12, yy + 6, '#e2e8f0');
    c.line(ctx, x + 6, yy + 6, x + 12, yy + 6, '#e2e8f0');
    c.rect(ctx, x + 9, yy - 10, 4, 2, '#c53030');
  }

  function drawMilkyWay(ctx, t, x0, y0, x1, y1) {
    for (var i = 0; i < 60; i++) {
      var tt = i / 59;
      var x = x0 + (x1 - x0) * tt;
      var y = y0 + (y1 - y0) * tt;
      var off = Math.sin(i * 0.8 + t * 0.5) * 4;
      c.glow(ctx, Math.round(x), Math.round(y + off), 2, '#8ea7ff');
    }
    var rng = c.makeRng(2024);
    for (var j = 0; j < 140; j++) {
      var r = rng();
      var x2 = x0 + (x1 - x0) * r + (rng() - 0.5) * 26;
      var y2 = y0 + (y1 - y0) * r + (rng() - 0.5) * 12;
      var col = rng() > 0.7 ? '#ffffff' : '#c6d2ff';
      c.px(ctx, Math.round(x2), Math.round(y2), col);
    }
  }

  function act0(ctx, t, cue) {
    var horizon = 118;
    nightSky(ctx, t, horizon, 31, 90);
    c.disc(ctx, 205, 42, 14, '#e7e2d0');
    c.disc(ctx, 209, 39, 12, '#0c1230');
    citySkyline(ctx, horizon, 31);
    ground(ctx, horizon, '#141a2a', '#0a0e18');
    streetLamp(ctx, 62, horizon + 1);
    postOffice(ctx, 158, horizon - 52, 54, 52);
    drawPostman(ctx, 88, horizon - 8, t, { walk: cue >= 2 && cue <= 3 });
    if (cue >= 1) {
      c.glow(ctx, 88 + 19, horizon - 8 + 11, 5, '#f6e05e');
    }
  }

  function act1(ctx, t, cue) {
    var horizon = 122;
    nightSky(ctx, t, horizon, 41, 80);
    c.disc(ctx, 52, 38, 10, '#e7e2d0');
    c.disc(ctx, 55, 36, 8, '#0c1230');
    citySkyline(ctx, horizon, 41);
    ground(ctx, horizon, '#151a28', '#0a0e16');
    streetLamp(ctx, 180, horizon + 1);
    c.drawSprite(ctx, 'mailbox', 120, horizon - 36, 1);
    drawPostman(ctx, 70, horizon - 7, t, { walk: false });
    drawChild(ctx, 150, horizon - 1, t, { idle: true });
    c.drawSprite(ctx, 'letter', 158, horizon - 14, 1);
  }

  function act2(ctx, t, cue) {
    var horizon = 104;
    nightSky(ctx, t, horizon, 51, 70);
    c.rect(ctx, 0, horizon - 3, 256, 3, '#0b1224');
    ground(ctx, horizon, '#13234f', '#0a1228');
    var rng = c.makeRng(8);
    for (var i = 0; i < 90; i++) {
      var x = Math.floor(rng() * 256);
      var y = horizon + Math.floor(rng() * 70);
      if (Math.sin(t * 2 + y * 0.3 + x * 0.2) > 0.2) {
        c.px(ctx, x, y, '#8fa7ff');
      }
    }
    for (var j = 0; j < 14; j++) {
      c.glow(ctx, 150 + j * 7, horizon - j * 5, 2, '#8ea7ff');
    }
    drawPostman(ctx, 60, horizon - 7, t, { walk: false });
    drawBoat(ctx, 116, horizon + 16, t);
  }

  function act3(ctx, t, cue) {
    nightSky(ctx, t, 176, 91, 120);
    drawMilkyWay(ctx, t, 10, 170, 245, 20);
    var cometX = (t * 18) % 280 - 12;
    var cometY = 40 + (cometX / 280) * 50;
    if (cometX > 20 && cometX < 250) {
      c.glow(ctx, Math.round(cometX), Math.round(cometY), 3, '#fff7d6');
      c.line(ctx, Math.round(cometX) - 14, Math.round(cometY), Math.round(cometX), Math.round(cometY), '#ffe6a3');
    }
    var prog = (t * 0.12) % 1;
    var bx = 28 + prog * 200;
    var by = 156 - prog * 120;
    drawBoat(ctx, Math.round(bx), Math.round(by), t);
    var rng = c.makeRng(77);
    for (var i = 0; i < 60; i++) {
      var x = Math.round(bx + (rng() - 0.5) * 50);
      var y = Math.round(by + (rng() - 0.5) * 24);
      if (rng() > 0.5) c.px(ctx, x, y, '#c6d2ff');
    }
  }

  function act4(ctx, t, cue) {
    nightSky(ctx, t, 160, 131, 90);
    drawMilkyWay(ctx, t, 30, 170, 210, 70);
    var sx = 128, sy = 62;
    var pulse = 0.7 + 0.3 * Math.sin(t * 2);
    c.glow(ctx, sx, sy, Math.round(12 * pulse), '#fff7d6');
    c.glow(ctx, sx, sy, 7, '#ffffff');
    drawStar(ctx, sx, sy, 14, '#fff3b8', true, t);
    drawStar(ctx, sx, sy, 7, '#ffffff', true, t);
    c.drawSprite(ctx, 'letter', sx - 4, sy + 12, 1);
    var bx = 122 + Math.sin(t * 0.8) * 3;
    var by = 128;
    drawBoat(ctx, Math.round(bx), by, t);
    if (cue >= 2) {
      for (var i = 0; i < 18; i++) {
        var tt = i / 17;
        var x = sx + (bx + 9 - sx) * tt;
        var y = sy + (by - sy) * tt;
        c.glow(ctx, Math.round(x), Math.round(y), 2, '#fff3b8');
      }
    }
    if (cue >= 4) {
      var fall = (t * 0.15) % 1;
      c.glow(ctx, Math.round(sx + 4), Math.round(sy + 14 + fall * 40), 3, '#fff7d6');
    }
  }

  function act5(ctx, t, cue) {
    var horizon = 118;
    c.gradientV(ctx, 0, 0, 256, horizon, '#2a1f4d', '#f6a5c0');
    var sunY = horizon - 10 - Math.sin(t * 0.4) * 8;
    c.glow(ctx, 170, Math.round(sunY), 16, '#ffd89a');
    c.disc(ctx, 170, Math.round(sunY), 8, '#fff3c4');
    var rng = c.makeRng(9);
    for (var i = 0; i < 30; i++) {
      var x = Math.floor(rng() * 256);
      var y = Math.floor(rng() * (horizon - 30));
      c.px(ctx, x, y, '#e8e6ff');
    }
    if (cue >= 4) {
      c.glow(ctx, 74, 52, 6, '#fff7d6');
      drawStar(ctx, 74, 52, 8, '#ffffff', true, t);
    }
    ground(ctx, horizon, '#f2b78c', '#b96a4b');
    c.rect(ctx, 0, horizon, 256, 4, 'rgba(255,255,255,0.25)');
    drawChild(ctx, 78, horizon - 3, t, { idle: true });
    drawBoat(ctx, 150, horizon + 6, t);
    drawPostman(ctx, 190, horizon - 8, t, { walk: false });
    if (cue >= 3) {
      c.glow(ctx, 88, horizon - 10, 4, '#fff7d6');
    }
  }

  function drawTitle(ctx, t) {
    nightSky(ctx, t, 150, 21, 70);
    c.glow(ctx, 128, 70, 12, '#fff7d6');
    drawStar(ctx, 128, 70, 16, '#fff3b8', true, t);
    drawStar(ctx, 128, 70, 8, '#ffffff', true, t);
    c.text(ctx, '银河邮差', 128, 118, '#f7e6b0', 20, 'center');
    c.text(ctx, '寄往星星的一封信', 128, 142, '#c9b789', 12, 'center');
  }

  global.Scenes = {
    draw: function (ctx, state) {
      var t = typeof state.actTime === 'number' ? state.actTime : (state.time || 0);
      var cue = state.cue || 0;
      if (state.act === 0) act0(ctx, t, cue);
      else if (state.act === 1) act1(ctx, t, cue);
      else if (state.act === 2) act2(ctx, t, cue);
      else if (state.act === 3) act3(ctx, t, cue);
      else if (state.act === 4) act4(ctx, t, cue);
      else act5(ctx, t, cue);
    },
    drawTitle: drawTitle
  };
})(window);
