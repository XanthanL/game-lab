/* ==================================================================
   样例站点 · Viscose 环形轮播
   参考 https://github.com/Yousuf-developer/Viscose-carousel

   原作是一整块全屏片元着色器：卡片沿一只大半在屏外的圆环排布，相邻卡片用
   SDF 的 smooth-minimum 混在一起 —— 靠近时融成一坨，分开时拉出细丝。
   这里照搬同一套做法，只把「图片」换成站点卡片。

   与站点其余部分的接缝：
   · 配色从 CSS 变量读（--bg / --card-bg / --accent），所以 52 套皮肤换装时
     轮播跟着换；data-style 一变就重新取色。
   · 卡片文字（站名 / 页数 / 更新时间）留在 DOM 叠加层。WebGL 里画中文不现实，
     而且文字被 goo 糊掉也没法读 —— 原作同样把 meta 放在着色器之外。
   · 拿不到 WebGL、或用户开了 prefers-reduced-motion，就整个不启用，
     下面原有的卡片网格照常工作（原作没做 reduced-motion，这里补上）。
   · 不劫持滚轮：这是页面里的一个区块而非整屏体验，劫持会让人翻不出去。
     改用拖动 / 点击 / 方向键 / 右侧索引列。
================================================================== */
(function () {
  'use strict';

  var MAXC = 24;                       /* 着色器数组上限；站点数不超过它 */
  var TAU = Math.PI * 2;

  /* 几何与手感，全部相对舞台尺寸，改这里就能调 */
  var P = {
    radius: 0.50,   /* 环半径 = 舞台宽 × 此值 */
    dist:   1.15,   /* 相机到环前方的距离 = 半径 × 此值（越大透视越平） */
    tilt:   0.20,   /* 环绕 X 轴倾斜（弧度）：决定「高弧」拱起多少 */
    cardH:  0.56,   /* 卡高 = 舞台高 × 此值 */
    aspect: 0.82,   /* 卡宽 = 卡高 × 此值 */
    cy:     0.46,   /* 环心在舞台高度的位置 */
    goo:    0.075,  /* 融合半径 = min(宽,高) × 此值 */
    corner: 0.13,   /* 圆角 = min(半宽,半高) × 此值 */
    dragK:  2.6,    /* 拖过整个舞台宽度 = 2.6 弧度 */
    intro:  1700    /* 入场时长（毫秒） */
  };

  var dataEl = document.getElementById('sites-data');
  var sec    = document.getElementById('ringSec');
  var stage  = document.getElementById('ringStage');
  var canvas = document.getElementById('ringCanvas');
  if (!dataEl || !sec || !stage || !canvas) return;

  var sites;
  try { sites = (JSON.parse(dataEl.textContent).sites || []); } catch (e) { return; }
  sites = sites.filter(function (s) { return s.status === 'ok' && s.pages && s.pages.length; });
  if (sites.length < 3 || sites.length > MAXC) return;

  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (reduceMQ && reduceMQ.matches) return;                 /* 交给下面的网格 */

  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false })
        || canvas.getContext('experimental-webgl', { antialias: false, alpha: false, depth: false });
  if (!gl) return;

  var N = sites.length;

  /* ---------------- 数据整形 ---------------- */
  function shortName(s) {
    var n = String(s.name || s.dir || '').trim();
    var first = n.split(/[·｜|—–／\/]/)[0].trim();
    return (first.length >= 2 ? first : n).slice(0, 22);
  }
  function subOf(s) {
    var np = s.pages.length;
    var zh = window.__ringLang !== 'en';
    var cnt = np > 1 ? (np + (zh ? ' 页' : ' pages')) : (zh ? '单页' : 'one page');
    var d = String(s.updated || '').slice(0, 7) || String(s.dir || '');
    return cnt + ' · ' + (zh ? '更新 ' : 'upd ') + d;
  }
  var items = sites.map(function (s) {
    return {
      name: shortName(s),
      sub: subOf(s),
      href: encodeURI(s.pages[0].path),
      dir: s.dir
    };
  });

  /* ---------------- 从皮肤变量取色 ---------------- */
  function parseColor(str) {
    if (!str) return null;
    var s = String(str).trim(), m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(s)))
      return [parseInt(m[1][0] + m[1][0], 16) / 255, parseInt(m[1][1] + m[1][1], 16) / 255,
              parseInt(m[1][2] + m[1][2], 16) / 255, 1];
    if ((m = /^#([0-9a-f]{6})$/i.exec(s)))
      return [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255,
              parseInt(m[1].slice(4, 6), 16) / 255, 1];
    if ((m = /^#([0-9a-f]{8})$/i.exec(s)))
      return [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255,
              parseInt(m[1].slice(4, 6), 16) / 255, parseInt(m[1].slice(6, 8), 16) / 255];
    if ((m = /^rgba?\(([^)]+)\)$/i.exec(s))) {
      var q = m[1].split(/[,\s/]+/).filter(Boolean);
      if (q.length < 3) return null;
      var a = q.length > 3 ? (/%/.test(q[3]) ? parseFloat(q[3]) / 100 : parseFloat(q[3])) : 1;
      return [parseFloat(q[0]) / 255, parseFloat(q[1]) / 255, parseFloat(q[2]) / 255, isNaN(a) ? 1 : a];
    }
    return null;
  }
  var COL = { bg: [1, 1, 1], paper: [0.1, 0.1, 0.1], accent: [1, 0.8, 0], hair: [0.8, 0.8, 0.8] };
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    var bg   = parseColor(cs.getPropertyValue('--bg'))      || [1, 1, 1, 1];
    var card = parseColor(cs.getPropertyValue('--card-bg')) || bg;
    var acc  = parseColor(cs.getPropertyValue('--accent'))  || [1, .8, 0, 1];
    /* 优先读 --hm-paper —— 这是「电光蓝」等几套皮肤显式声明的白纸色，
       比 card-bg 更准（card-bg 经常是半透明）。读不到再退回 card-bg，
       并用一个保证对比度的目标色兜底，免得在某些皮肤里卡片糊进背景。 */
    var hmPaper = parseColor(cs.getPropertyValue('--hm-paper'));
    var a, paper, lum, tgt;
    if (hmPaper) {
      a = hmPaper[3];
      paper = [hmPaper[0] * a + bg[0] * (1 - a), hmPaper[1] * a + bg[1] * (1 - a),
               hmPaper[2] * a + bg[2] * (1 - a)];
    } else {
      a = card[3];
      paper = [card[0] * a + bg[0] * (1 - a), card[1] * a + bg[1] * (1 - a),
               card[2] * a + bg[2] * (1 - a)];
      lum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
      tgt = lum > 0.5 ? [0.07, 0.07, 0.08] : [0.97, 0.97, 0.95];
      paper = [(paper[0] + tgt[0]) * 0.5, (paper[1] + tgt[1]) * 0.5, (paper[2] + tgt[2]) * 0.5];
    }
    COL.bg = [bg[0], bg[1], bg[2]];
    COL.paper = paper;
    COL.accent = [acc[0], acc[1], acc[2]];
    COL.hair = [paper[0] * 0.38 + bg[0] * 0.62, paper[1] * 0.38 + bg[1] * 0.62,
                paper[2] * 0.38 + bg[2] * 0.62];
  }
  readColors();

  /* ---------------- 着色器 ---------------- */
  var VS = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FS = [
    'precision highp float;',
    '#define MAXC ' + MAXC,
    'uniform vec2  uRes;',
    'uniform int   uCount;',
    'uniform vec4  uCard[MAXC];',   /* cx, cy, halfW, halfH（像素） */
    'uniform vec3  uTint[MAXC];',   /* 每张卡的纸色（按景深微调） */
    'uniform float uVis[MAXC];',    /* 0..1 可见度，背面淡出 */
    'uniform vec4  uActive;',       /* 正面那张的 cx, cy, halfW, halfH */
    'uniform vec3  uBg;',
    'uniform vec3  uAccent;',
    'uniform vec3  uHair;',
    'uniform float uK;',            /* 融合半径（像素） */
    'uniform float uCorner;',
    'uniform float uMark;',
    'uniform sampler2D uAtlas;',    /* 卡面内容图集：Canvas 2D 画好的站名 / 序号 / 元信息 */
    'uniform vec4  uCell[MAXC];',   /* 每张卡在图集里的格子 (u0, v0, du, dv) */
    'uniform float uHasTex;',       /* 图集就绪 = 1；否则 0，走纯色兜底 */
    'float sdBox(vec2 p, vec2 b, float r){',
    '  vec2 q = abs(p) - b + r;',
    '  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;',
    '}',
    /* 多项式 smooth-minimum：整个 goo 的来源。两个距离接近到 k 以内时，
       等值线会向外鼓出并连成一体 —— 靠得越近鼓得越狠，拉开则收细成丝。 */
    'float smin(float a, float b, float k){',
    '  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);',
    '  return mix(b, a, h) - k * h * (1.0 - h);',
    '}',
    'float sstep(float e0, float e1, float x){',
    '  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);',
    '  return t * t * (3.0 - 2.0 * t);',
    '}',
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  float d = 1e9;',
    '  vec3  tintSum = vec3(0.0);',
    '  vec2  locSum  = vec2(0.0);',
    '  float wSum    = 0.0;',
    '  for (int i = 0; i < MAXC; i++) {',
    '    if (i < uCount) {',
    '      vec4  c   = uCard[i];',
    '      float vis = uVis[i];',
    /* 不可见的卡推到极远：smin 对远处的值几乎不敏感，等于没参与融合 */
    '      float di = sdBox(p - c.xy, c.zw, min(c.z, c.w) * uCorner) + (1.0 - vis) * 6000.0;',
    '      float w  = exp(-max(di, 0.0) / (uK * 2.5 + 14.0));',
    '      tintSum += uTint[i] * w;',
    '      locSum  += ((p - c.xy) / max(c.z, 1.0)) * w;',
    '      wSum    += w;',
    '      d = (d > 1e8) ? di : smin(d, di, uK);',
    '    }',
    '  }',
    '  float m    = 1.0 - sstep(-1.2, 1.2, d);',
    '  vec3  tint = tintSum / max(wSum, 1e-5);',
    '  vec2  loc  = locSum  / max(wSum, 1e-5);',
    '  vec3 col = uBg;',
    '  vec3 paper = tint * (0.965 + 0.035 * (1.0 - clamp(p.y / uRes.y, 0.0, 1.0)));',
    '  col = mix(col, paper, m);',
    /* 卡内的 2×2 标记（与 favicon 同款）。用的是融合后的局部坐标，
       所以两张卡粘住时标记会被一起拉扯 —— 这正是 goo 该有的样子。 */
    '  float s = 0.22, cs = 0.140;',
    '  float d1 = sdBox(loc - vec2(-s, -s), vec2(cs), cs * 0.30);',
    '  float d2 = sdBox(loc - vec2( s, -s), vec2(cs), cs * 0.30);',
    '  float d3 = sdBox(loc - vec2(-s,  s), vec2(cs), cs * 0.30);',
    '  float d4 = sdBox(loc - vec2( s,  s), vec2(cs), cs * 0.30);',
    '  float dm = min(min(d1, d2), min(d3, d4));',
    '  float mAll  = (1.0 - sstep(-0.03, 0.03, dm)) * m * uMark;',
    '  float mAcid = (1.0 - sstep(-0.03, 0.03, d4)) * m * uMark;',
    '  col = mix(col, uHair,   mAll);',
    '  col = mix(col, uAccent, mAcid);',
    /* 正面那张：沿轮廓描一道酸黄，指明「点这张会打开」 */
    '  float dA = sdBox(p - uActive.xy, uActive.zw, min(uActive.z, uActive.w) * uCorner);',
    '  float rim = (1.0 - sstep(0.0, 2.4, abs(dA))) * m;',
    '  col = mix(col, uAccent, rim * 0.5);',
    /* 极轻的抖色，压掉大面积平涂可能出的色带 */
    '  float n = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (n - 0.5) * 0.010;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var o = gl.createShader(type);
    gl.shaderSource(o, src); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
      console.warn('[viscose] shader:', gl.getShaderInfoLog(o));
      return null;
    }
    return o;
  }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[viscose] link:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['uRes', 'uCount', 'uCard[0]', 'uTint[0]', 'uVis[0]', 'uActive',
   'uBg', 'uAccent', 'uHair', 'uK', 'uCorner', 'uMark'].forEach(function (k) {
    U[k.replace('[0]', '')] = gl.getUniformLocation(prog, k);
  });

  var aCard = new Float32Array(MAXC * 4);
  var aTint = new Float32Array(MAXC * 3);
  var aVis  = new Float32Array(MAXC);

  /* ---------------- 几何 ---------------- */
  var phase = 0, vel = 0, targetPhase = null;
  var cards = [];                 /* 每帧重算：{sx, sy, hw, hh, p, vis, idx} */
  var W = 0, H = 0, DPR = 1;
  var baseK = 30, cornerPx = 8;

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    gl.viewport(0, 0, canvas.width, canvas.height);
    baseK = Math.min(W, H) * P.goo;
  }

  function smoothstep(e0, e1, x) {
    var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function layout(sizeMul) {
    var R = W * P.radius;
    var D = R * P.dist;
    var cx = W * 0.5, cy = H * P.cy;
    var baseH = H * P.cardH * sizeMul;
    var baseW = baseH * P.aspect;
    var sinT = Math.sin(P.tilt), cosT = Math.cos(P.tilt);
    cards.length = 0;
    for (var i = 0; i < N; i++) {
      var a = i * TAU / N + phase;
      var wx = R * Math.sin(a);
      var wz = R * Math.cos(a);
      /* 绕 X 轴倾斜，再整体上移 R·sin(tilt)，让正面那张正好落在环心：
         于是前一张在中、两侧抬高、背面升到屏外 —— 就是那条「高弧」。 */
      var wy = -wz * sinT + R * sinT;
      var wz2 = wz * cosT;
      var depth = (R + D) - wz2;
      var p = D / Math.max(depth, 1);
      var facing = Math.cos(a);
      var vis = smoothstep(-0.30, 0.10, facing);
      cards.push({
        idx: i,
        sx: cx + wx * p,
        sy: cy + wy * p,
        hw: baseW * 0.5 * p * Math.max(0.055, Math.abs(facing)),
        hh: baseH * 0.5 * p,
        p: p, vis: vis
      });
    }
    cards.sort(function (x, y) { return y.p - x.p; });   /* 近的在前，命中测试用 */
    cornerPx = Math.min(baseW, baseH) * 0.5 * P.corner;
  }

  function activeIndex() {
    var step = TAU / N;
    var i = Math.round(-phase / step) % N;
    return i < 0 ? i + N : i;
  }
  function nearestPhase() {
    var step = TAU / N;
    return Math.round(phase / step) * step;
  }
  function goTo(i) {
    var step = TAU / N;
    var want = -i * step;
    want += Math.round((phase - want) / TAU) * TAU;
    targetPhase = want;
  }

  /* ---------------- 叠加层 ---------------- */
  var nameEl = document.getElementById('ringName');
  var subEl  = document.getElementById('ringSub');
  var colEl  = document.getElementById('ringCol');
  var lastIdx = -1;

  if (colEl) {
    colEl.innerHTML = '';
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      b.setAttribute('aria-label', it.name);
      b.addEventListener('click', function () { goTo(i); });
      li.appendChild(b);
      colEl.appendChild(li);
    });
  }

  function syncMeta(i) {
    if (i === lastIdx) return;
    lastIdx = i;
    if (nameEl) { nameEl.textContent = items[i].name; nameEl.href = items[i].href; }
    if (subEl)  { subEl.textContent = items[i].sub; }
    if (colEl) {
      var bs = colEl.querySelectorAll('button');
      for (var k = 0; k < bs.length; k++) {
        if (k === i) bs[k].setAttribute('aria-current', 'true');
        else bs[k].removeAttribute('aria-current');
      }
    }
  }

  /* 语言切换后副标题要跟着换（data-zh/data-en 管不到动态插入的文本） */
  window.__ringLang = document.documentElement.getAttribute('data-lang') || 'zh';
  new MutationObserver(function () {
    window.__ringLang = document.documentElement.getAttribute('data-lang') || 'zh';
    items.forEach(function (it, i) { it.sub = subOf(sites[i]); });
    lastIdx = -1;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

  /* 皮肤换了就重新取色 */
  new MutationObserver(readColors).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-style', 'data-theme']
  });

  /* ---------------- 输入 ---------------- */
  var dragging = false, lastX = 0, moved = 0, downX = 0, downY = 0, velSample = 0;

  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; moved = 0; lastX = downX = e.clientX; downY = e.clientY;
    vel = 0; velSample = 0; targetPhase = null;
    stage.classList.add('is-drag');
    if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    phase += dx / Math.max(W, 1) * P.dragK;
    velSample = dx / Math.max(W, 1) * P.dragK;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-drag');
    vel = velSample * 0.9;
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);

  stage.addEventListener('click', function (e) {
    if (moved > 8) return;                       /* 是拖动，不是点击 */
    var r = stage.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.vis < 0.35) continue;
      if (Math.abs(px - c.sx) <= c.hw && Math.abs(py - c.sy) <= c.hh) {
        if (c.idx === activeIndex()) window.location.href = items[c.idx].href;
        else goTo(c.idx);
        return;
      }
    }
  });

  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.addEventListener('keydown', function (e) {
    var cur = activeIndex();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { goTo((cur + 1) % N); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { goTo((cur - 1 + N) % N); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { window.location.href = items[cur].href; e.preventDefault(); }
  });

  /* ---------------- 主循环 ---------------- */
  var t0 = 0, running = false, onScreen = true;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!onScreen) return;
    if (!t0) t0 = now;

    var introT = Math.min(1, (now - t0) / P.intro);
    introT = 1 - Math.pow(1 - introT, 3);

    if (!dragging) {
      if (targetPhase !== null) {
        phase += (targetPhase - phase) * 0.13;
        if (Math.abs(targetPhase - phase) < 0.0015) { phase = targetPhase; targetPhase = null; }
      } else {
        phase += vel;
        vel *= 0.93;
        if (Math.abs(vel) < 0.0009) {
          phase += (nearestPhase() - phase) * 0.12;
          vel *= 0.5;
        }
      }
    }

    layout(0.58 + 0.42 * introT);

    var ai = activeIndex();
    syncMeta(ai);
    var act = null;
    for (var i = 0; i < cards.length; i++) if (cards[i].idx === ai) { act = cards[i]; break; }
    if (!act) act = cards[0];

    for (var j = 0; j < N; j++) {
      var c = cards[j];
      aCard[j * 4] = c.sx * DPR; aCard[j * 4 + 1] = c.sy * DPR;
      aCard[j * 4 + 2] = Math.max(c.hw * DPR, 0.5); aCard[j * 4 + 3] = Math.max(c.hh * DPR, 0.5);
      /* 远的卡往背景色里沉一点，给景深 */
      var f = 0.86 + 0.14 * c.p;
      aTint[j * 3]     = COL.paper[0] * f + COL.bg[0] * (1 - f);
      aTint[j * 3 + 1] = COL.paper[1] * f + COL.bg[1] * (1 - f);
      aTint[j * 3 + 2] = COL.paper[2] * f + COL.bg[2] * (1 - f);
      aVis[j] = c.vis;
    }

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1i(U.uCount, N);
    gl.uniform4fv(U.uCard, aCard);
    gl.uniform3fv(U.uTint, aTint);
    gl.uniform1fv(U.uVis, aVis);
    gl.uniform4f(U.uActive, act.sx * DPR, act.sy * DPR,
                 Math.max(act.hw * DPR, 0.5), Math.max(act.hh * DPR, 0.5));
    gl.uniform3f(U.uBg, COL.bg[0], COL.bg[1], COL.bg[2]);
    gl.uniform3f(U.uAccent, COL.accent[0], COL.accent[1], COL.accent[2]);
    gl.uniform3f(U.uHair, COL.hair[0], COL.hair[1], COL.hair[2]);
    /* 入场：融合半径从极大收到常态 —— 所有卡先是糊成一坨，再一张张撕开 */
    gl.uniform1f(U.uK, baseK * DPR * (1 + (1 - introT) * 16));
    gl.uniform1f(U.uCorner, P.corner);
    gl.uniform1f(U.uMark, introT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
    }, { rootMargin: '120px' }).observe(stage);
  }

  sec.hidden = false;
  running = true;
  requestAnimationFrame(frame);
})();
