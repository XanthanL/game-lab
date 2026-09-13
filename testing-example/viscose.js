/* ==================================================================
   样例站点 · Viscose 环形轮播
   参考 https://github.com/Yousuf-developer/Viscose-carousel

   原作是一整块全屏片元着色器：卡片沿一只大半在屏外的圆环排布，相邻卡片用
   SDF 的 smooth-minimum 混在一起 —— 靠近时融成一坨，分开时拉出细丝。
   这里照搬同一套做法，只把「图片」换成站点卡片。

   与站点其余部分的接缝：
   · 配色从 CSS 变量读（--bg / --card-bg / --accent），所以 52 套皮肤换装时
     轮播跟着换；data-style 一变就重新取色。
   · 卡面文字用 Canvas 2D 图集贴上去（着色器里没有字体引擎，画不了中文），
     每张卡采自己那一格，所以正面的和两侧的都显示各自的内容。
     底部的 DOM 叠加层再留一份可读、可选中的副本给无障碍和搜索。
   · 拿不到 WebGL、或用户开了 prefers-reduced-motion，就整个不启用，
     退回下面那列朴素链接（原作没做 reduced-motion，这里补上）。
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

  /* ---------------- 数据整形 ----------------
     卡片上要放「站名 + 一行小字介绍」。这两样都由 tools/build-index.py 预处理好
     中英两份写进 sites-data（nameZh / nameEn / descZh / descEn），这里只负责按
     当前 <html data-lang> 挑一份 —— 切语言时整张图集重画。 */
  function isEn() { return document.documentElement.getAttribute('data-lang') === 'en'; }

  function subOf(s) {
    var np = s.pages.length;
    var zh = !isEn();
    var cnt = np > 1 ? (np + (zh ? ' 页' : ' pages')) : (zh ? '单页' : 'one page');
    var d = String(s.updated || '').slice(0, 7) || String(s.dir || '');
    return cnt + ' · ' + (zh ? '更新 ' : 'upd ') + d;
  }

  /* 缺英文就退回中文（宁可显中文，也别在卡上留一块空白） */
  function pick(s, zhKey, enKey) {
    var zh = String(s[zhKey] || '').trim();
    var en = String(s[enKey] || '').trim();
    return isEn() ? (en || zh) : (zh || en);
  }

  var items = [];
  function buildItems() {
    items = sites.map(function (s) {
      return {
        name: pick(s, 'nameZh', 'nameEn') || String(s.name || s.dir || '').trim(),
        desc: pick(s, 'descZh', 'descEn'),
        sub:  subOf(s),
        href: encodeURI(s.pages[0].path),
        dir:  s.dir,
        /* 搜索要中英都命中，所以两份都留着 */
        hay: (s.dir + ' ' + (s.nameZh || '') + ' ' + (s.nameEn || '') + ' ' +
              (s.name || '')).toLowerCase()
      };
    });
  }
  buildItems();

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
  var COL = { bg: [1, 1, 1], paper: [0.1, 0.1, 0.1], accent: [1, 0.8, 0],
              hair: [0.8, 0.8, 0.8], inkOnPaper: [0.1, 0.1, 0.1],
              chip: [1, 0.8, 0] };
  /* 卡面与底色至少要有这么多亮度差，否则在浅色皮肤里卡片会糊进背景 */
  var MIN_DELTA = 0.13;
  /* 卡面当作纸，明度至少提到这里（只提不压） */
  var PAPER_LUM = 0.82;
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    var bg   = parseColor(cs.getPropertyValue('--bg'))      || [1, 1, 1, 1];
    var card = parseColor(cs.getPropertyValue('--card-bg')) || bg;
    var acc  = parseColor(cs.getPropertyValue('--accent'))  || [1, .8, 0, 1];
    /* 优先读 --hm-paper —— 这是「电光蓝」等几套皮肤显式声明的白纸色，
       比 card-bg 更准（card-bg 经常是半透明）。读不到再退回 card-bg，
       并用一个保证对比度的目标色兜底，免得在某些皮肤里卡片糊进背景。 */
    var hmPaper = parseColor(cs.getPropertyValue('--hm-paper'));
    var a, paper;
    if (hmPaper) {
      a = hmPaper[3];
      paper = [hmPaper[0] * a + bg[0] * (1 - a), hmPaper[1] * a + bg[1] * (1 - a),
               hmPaper[2] * a + bg[2] * (1 - a)];
    } else {
      a = card[3];
      paper = [card[0] * a + bg[0] * (1 - a), card[1] * a + bg[1] * (1 - a),
               card[2] * a + bg[2] * (1 - a)];
      /* 卡面永远当「一张纸」处理：把皮肤声明的 card-bg 往亮里提到纸的明度，
         只提不压，所以浅色皮肤（本来就是纸）原样保留，深色皮肤那张近黑的
         card-bg 会变成暖灰纸 —— 和原先的观感一致，但色相仍是皮肤自己的。
         往白里混而不是等比缩放：后者在饱和的深色上会把通道压爆、色相跑偏。 */
      var lumBg = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
      var lumP  = 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2];
      var target = Math.max(lumP, PAPER_LUM);
      /* 底色本身也接近纸白时（浅色皮肤的纸压纸），再提一点，保住卡片边界 */
      if (target - lumBg < MIN_DELTA) target = Math.min(0.985, lumBg + MIN_DELTA);
      if (target > lumP) {
        var t = (target - lumP) / Math.max(1 - lumP, 1e-3);
        paper = [paper[0] + (1 - paper[0]) * t, paper[1] + (1 - paper[1]) * t,
                 paper[2] + (1 - paper[2]) * t];
      }
    }
    COL.bg = [bg[0], bg[1], bg[2]];
    COL.paper = paper;
    COL.accent = [acc[0], acc[1], acc[2]];
    COL.hair = [paper[0] * 0.38 + bg[0] * 0.62, paper[1] * 0.38 + bg[1] * 0.62,
                paper[2] * 0.38 + bg[2] * 0.62];
    /* 纸上的墨色（图集里画字用）：优先吃皮肤自己声明的品牌蓝 —— 电光蓝那套就是
       #0000f2，白纸上写蓝字正是它的招牌。读不到再按纸的明暗反推。 */
    var blue = parseColor(cs.getPropertyValue('--hm-blue'));
    var lp = 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2];
    if (blue && lp > 0.35) COL.inkOnPaper = [blue[0], blue[1], blue[2]];
    else COL.inkOnPaper = lp > 0.5 ? [0.055, 0.055, 0.085] : [0.96, 0.96, 0.94];
    /* 卡面右下角那个小方块：电光蓝这类皮肤里 --accent 是结构蓝，酸黄才是内容色，
       所以有 --hm-acid 就用它（其余 51 套没有这个变量，自动退回 --accent）。 */
    var acid = parseColor(cs.getPropertyValue('--hm-acid'));
    COL.chip = acid ? [acid[0], acid[1], acid[2]] : COL.accent;
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
    'uniform vec4  uActive;',       /* 正面那张的 cx, cy, halfW, halfH —— 只用来描那道边 */
    'uniform vec4  uCell[MAXC];',   /* 每张卡在图集里的格子 (u0, v0, du, dv) */
    'uniform float uFace[MAXC];',   /* 每张卡「正对镜头」的程度 |cos a|：越侧身字越不可读 */
    'uniform vec3  uBg;',
    'uniform vec3  uAccent;',
    'uniform vec3  uHair;',
    'uniform float uK;',            /* 融合半径（像素） */
    'uniform float uCorner;',
    'uniform float uMark;',
    'uniform sampler2D uAtlas;',    /* 卡面内容图集：Canvas 2D 画好的站名 / 序号 / 元信息 */
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
    '  float wSum    = 0.0;',
    '  for (int i = 0; i < MAXC; i++) {',
    '    if (i < uCount) {',
    '      vec4  c   = uCard[i];',
    '      float vis = uVis[i];',
    /* 不可见的卡推到极远：smin 对远处的值几乎不敏感，等于没参与融合 */
    '      float di = sdBox(p - c.xy, c.zw, min(c.z, c.w) * uCorner) + (1.0 - vis) * 6000.0;',
    '      float w  = exp(-max(di, 0.0) / (uK * 2.5 + 14.0));',
    '      tintSum += uTint[i] * w;',
    '      wSum    += w;',
    '      d = (d > 1e8) ? di : smin(d, di, uK);',
    '    }',
    '  }',
    '  float m    = 1.0 - sstep(-1.2, 1.2, d);',
    '  vec3  tint = tintSum / max(wSum, 1e-5);',
    '  vec3 col = uBg;',
    '  float topLight = 0.965 + 0.035 * (1.0 - clamp(p.y / uRes.y, 0.0, 1.0));',
    '  col = mix(col, tint * topLight, m);',
    /* 卡面内容：每张卡用自己的局部坐标采自己那一格，再按自己的轮廓叠上去。
       四个要点，缺一个就会出问题：
       ① 不能按 goo 的权重去混各卡 UV —— 那等于把 12 张卡的字摊平叠在一起。
          要各采各的，再按各自的轮廓遮罩合成。
       ② 用各自的 SDF 而不是融合后的 d：细丝落在两张卡轮廓之外，遮罩天然为 0，
          文字不会顺着 goo 溢到丝上，丝保持干净纸色。
       ③ 叠的顺序：cards 在 JS 里已按景深「近 → 远」排好上传，所以这里必须
          **从远往近**遍历，近的才会盖在远的上面（GLSL ES 1.0 的循环边界是常量，
          倒着数没问题）。
       ④ **每张卡要先把自己的纸色铺满自己的轮廓，再叠字。** 图集里除文字外都是
          透明的，如果只叠字，近处这张卡「没字」的地方就盖不住远处那张卡的字 ——
          侧卡上会透出后面几张卡的站名（实测能读出 Void Codex / Tutuhuahua）。 */
    '  for (int i = MAXC - 1; i >= 0; i--) {',
    '    if (i < uCount && uVis[i] > 0.02) {',
    '      vec4  c  = uCard[i];',
    '      float sd = sdBox(p - c.xy, c.zw, min(c.z, c.w) * uCorner);',
    '      float mi = 1.0 - sstep(-0.6, 0.6, sd);',
    '      if (mi > 0.004) {',
    '        col = mix(col, uTint[i] * topLight, mi * uVis[i]);',
    '        float fk = sstep(0.52, 0.88, uFace[i]);',
    '        if (fk > 0.004) {',
    '          vec2 qi  = (p - c.xy) / max(c.zw, vec2(1.0));',
    '          vec2 uvl = clamp(qi * 0.5 + 0.5, 0.0, 1.0);',
    '          vec4 tex = texture2D(uAtlas, uCell[i].xy + uvl * uCell[i].zw);',
    '          col = mix(col, tex.rgb, tex.a * mi * uHasTex * uMark * uVis[i] * fk);',
    '        }',
    '      }',
    '    }',
    '  }',
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
  ['uRes', 'uCount', 'uCard[0]', 'uTint[0]', 'uVis[0]', 'uFace[0]', 'uActive',
   'uCell[0]', 'uBg', 'uAccent', 'uHair', 'uK', 'uCorner', 'uMark',
   'uAtlas', 'uHasTex'].forEach(function (k) {
    U[k.replace('[0]', '')] = gl.getUniformLocation(prog, k);
  });

  var aCard = new Float32Array(MAXC * 4);
  var aTint = new Float32Array(MAXC * 3);
  var aVis  = new Float32Array(MAXC);
  var aFace = new Float32Array(MAXC);       /* 每张卡正对镜头的程度，决定卡面显不显字 */
  /* 两个格子表，别混：
     cellOf —— 按**站点序号**存，buildAtlas 填，画卡面时按 c.idx 查
     aCell  —— 按**上传槽位**存（= cards[] 的景深序），每帧重填给 uCell */
  var cellOf = new Float32Array(MAXC * 4);
  var aCell  = new Float32Array(MAXC * 4);

  /* ================= 卡面内容图集 =================
     着色器里画不了中文，也排不了一段会自动换行的标题。所以改用 Canvas 2D 把
     每张卡的序号 / 站名 / 元信息画进一张图集，着色器按各自格子去采。
     这样内容是真正「长」在卡面上的：跟着卡片一起转、缩放、被 goo 拉扯；
     而底部的 DOM 叠加层只留一份可读、可选中的副本给无障碍和搜索。 */
  var atlasTex = null, hasTex = 0;
  var FONT_SERIF = 'Georgia, serif', FONT_MONO = 'monospace';

  function readFonts() {
    var cs = getComputedStyle(document.documentElement);
    FONT_SERIF = (cs.getPropertyValue('--serif') || '').trim() || 'Georgia, serif';
    FONT_MONO  = (cs.getPropertyValue('--mono')  || '').trim() || 'monospace';
    /* canvas 字体栈需要尾部带一个平台能用的 CJK fallback：
       headless Chrome 在 Windows 上往往没装 Songti SC / Noto Serif SC，
       缺了这层站名里的中文就掉成方块。把系统中文字体直接补进去。 */
    FONT_SERIF += ', "Microsoft YaHei", "PingFang SC", "Heiti SC", "SimHei", "Microsoft JhengHei", "WenQuanYi Micro Hei"';
    FONT_MONO  += ', "Microsoft YaHei", "PingFang SC", "Heiti SC", "SimHei"';
  }
  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
           Math.round(c[2] * 255) + ',' + a + ')';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 拉丁词（含数字与常见连接符）整块切，其余字符逐个切 ——
     中文逐字断行才自然，但 ACUTE ANGLE 不能断成 ACUTE ANG / LE。 */
  function tokenize(text) {
    var s = String(text || ''), out = [], buf = '', i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (/[0-9A-Za-z\u00c0-\u024f&'\u2019.\-\u2013\u2014]/.test(c)) buf += c;
      else {
        if (buf) { out.push(buf); buf = ''; }
        out.push(c);
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  /* 按可用宽度断行；最多 maxLines 行，还有字没放下就把末行收成省略号 */
  function wrapText(g, text, maxW, maxLines) {
    var toks = tokenize(text);
    var lines = [], cur = '', truncated = false, i, t, cut, last;
    for (i = 0; i < toks.length; i++) {
      t = toks[i];
      if (!cur && (t === ' ' || t === '\u00a0')) continue;   /* 行首不留空格 */
      if (cur && g.measureText(cur + t).width > maxW) {
        lines.push(cur); cur = '';
        if (lines.length >= maxLines) { truncated = true; break; }
      }
      /* 单个词自己就超宽：按字符硬拆到放得下为止 */
      while (g.measureText(t).width > maxW && t.length > 1) {
        cut = t.length - 1;
        while (cut > 1 && g.measureText(t.slice(0, cut)).width > maxW) cut--;
        lines.push(t.slice(0, cut));
        t = t.slice(cut);
        if (lines.length >= maxLines) { truncated = true; break; }
      }
      if (truncated) break;
      cur += t;
    }
    if (!truncated && cur && lines.length < maxLines) lines.push(cur);
    if (truncated && lines.length) {                        /* 截断了 */
      last = lines[lines.length - 1];
      while (last.length > 1 && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[lines.length - 1] = last + '…';
    }
    return lines;
  }

  /* 一张卡面的排布（从上到下）：序号 → 发丝线 → 站名 → 小字介绍 → …留白… → 底部元信息。
     字号都以 cellW 为基准 —— 整张卡投影到屏幕上只剩 ~0.36 倍，所以这里得往大写，
     否则站名勉强能看、介绍就成了一排糊点。 */
  function drawCardFace(g, x, y, w, h, i) {
    var it  = items[i];
    var pad = Math.round(w * 0.100);
    var iw  = w - pad * 2;
    var ink = COL.inkOnPaper;

    g.save();
    g.translate(x, y);
    g.textAlign = 'left';
    g.textBaseline = 'top';

    /* 序号 */
    var f1 = Math.round(w * 0.056);
    g.font = '600 ' + f1 + 'px ' + FONT_MONO;
    g.fillStyle = rgba(ink, 0.5);
    g.fillText(pad2(i + 1), pad, pad);

    /* 序号下一条发丝线 */
    var ry = pad + f1 + Math.round(h * 0.018);
    g.fillStyle = rgba(ink, 0.22);
    g.fillRect(pad, ry, iw, Math.max(1, Math.round(h * 0.0032)));

    /* 站名：主视觉，最多两行 */
    var f2 = Math.round(w * 0.094);
    var lh2 = Math.round(f2 * 1.16);
    g.font = '700 ' + f2 + 'px ' + FONT_SERIF;
    g.fillStyle = rgba(ink, 1);
    var lines = wrapText(g, it.name, iw, 2);
    var ty = ry + Math.round(h * 0.042);
    for (var k = 0; k < lines.length; k++) g.fillText(lines[k], pad, ty + k * lh2);

    /* 小字介绍：紧接站名下方，最多三行，比站名轻一档 */
    var dy = ty + lines.length * lh2 + Math.round(h * 0.026);
    if (it.desc) {
      var f4 = Math.round(w * 0.058);
      var lh4 = Math.round(f4 * 1.46);
      g.font = '400 ' + f4 + 'px ' + FONT_SERIF;
      g.fillStyle = rgba(ink, 0.70);
      var dl = wrapText(g, it.desc, iw, 3);
      for (var m = 0; m < dl.length; m++) g.fillText(dl[m], pad, dy + m * lh4);
    }

    /* 底部元信息 */
    var f3 = Math.round(w * 0.046);
    g.font = '500 ' + f3 + 'px ' + FONT_MONO;
    g.fillStyle = rgba(ink, 0.48);
    g.fillText(it.sub, pad, h - pad - f3 - Math.round(h * 0.004));

    /* 右下角酸黄方块 —— favicon 那个 2×2 标记里的第四格 */
    var sq = Math.round(w * 0.058);
    g.fillStyle = rgba(COL.chip, 1);
    g.fillRect(w - pad - sq, h - pad - sq, sq, sq);

    g.restore();
  }

  function buildAtlas() {
    var maxSide = Math.min(1792, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048);
    var cols = Math.max(1, Math.ceil(Math.sqrt(N)));
    var rows = Math.max(1, Math.ceil(N / cols));
    var ch = Math.min(Math.floor(maxSide / rows), Math.round(Math.floor(maxSide / cols) / P.aspect));
    var cw = Math.round(ch * P.aspect);            /* 格子和卡片保持同一比例 */
    if (cw < 8 || ch < 8) { hasTex = 0; return; }

    var cv = document.createElement('canvas');
    cv.width = cw * cols; cv.height = ch * rows;
    if (cv.width > maxSide || cv.height > maxSide) { hasTex = 0; return; }

    var g = cv.getContext('2d');
    if (!g) { hasTex = 0; return; }
    g.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < N; i++) {
      drawCardFace(g, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch, i);
    }
    /* 采样格子。
       两处方向约定必须对上，错一个就会采到隔壁站点的卡面：
       ① 上传时 UNPACK_FLIP_Y_WEBGL = false —— 画布第一行（图像顶部）落在 t=0，
          所以图集里 v 越大越往下。
       ② 着色器里 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y)，p.y 也是
          自上而下增大；uvlF.y 在卡顶为 0、卡底为 1。
       两者同向，于是「行号从上数」直接算就行，不用翻。 */
    /* 格子表按**站点序号**（= 图集里的格号）存，不是按绘制顺序。
       cards[] 是按景深排过序的，第 j 个槽位和第 j 个站点不是一回事 ——
       上传时要用 c.idx 去查，否则每张卡都会贴到别人的脸。 */
    for (var j = 0; j < N; j++) {
      var c0 = j % cols, r0 = (j / cols) | 0;
      cellOf[j * 4]     = (c0 * cw) / cv.width;
      cellOf[j * 4 + 1] = (r0 * ch) / cv.height;
      cellOf[j * 4 + 2] = cw / cv.width;
      cellOf[j * 4 + 3] = ch / cv.height;
    }

    if (!atlasTex) atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    hasTex = 1;
  }

  /* 字体没就位会画成回退字形，所以 fonts.ready 之后再补画一次 */
  function rebuildAtlas() {
    readFonts();
    buildAtlas();
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { buildAtlas(); });
    }
  }

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
        p: p, vis: vis,
        /* 侧身的卡横向被投影压扁（60° 时只剩一半宽），字跟着挤成一团。
           记下 |cos a|，着色器据此把太侧的那几张卡面淡掉，只留纸色。
           阈值取 0.52~0.88：12 张时 ±30° 的邻居（0.866）拿到 ~1.0，
           ±60° 那张（0.5）刚好归零，不会在边上留一层读不出的鬼影。 */
        face: Math.abs(facing)
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
  function goTo(i, instant) {
    var step = TAU / N;
    var want = -i * step;
    want += Math.round((phase - want) / TAU) * TAU;
    if (instant) { phase = want; targetPhase = null; vel = 0; return; }
    targetPhase = want;
  }

  /* ---------------- 叠加层 ---------------- */
  var nameEl = document.getElementById('ringName');
  var descEl = document.getElementById('ringDesc');
  var subEl  = document.getElementById('ringSub');
  var colEl  = document.getElementById('ringCol');
  var lastIdx = -1;

  /* 右侧索引列只画一次；站名会随语言变，所以标签单独一遍 */
  if (colEl) {
    colEl.innerHTML = '';
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      b.addEventListener('click', function () { goTo(i); });
      li.appendChild(b);
      colEl.appendChild(li);
    });
    relabelCol();
  }
  function relabelCol() {
    if (!colEl) return;
    var bs = colEl.querySelectorAll('button');
    for (var k = 0; k < bs.length && k < items.length; k++) {
      bs[k].setAttribute('aria-label', items[k].name + (items[k].desc ? ' — ' + items[k].desc : ''));
    }
  }

  function syncMeta(i) {
    if (i === lastIdx) return;
    lastIdx = i;
    if (nameEl) { nameEl.textContent = items[i].name; nameEl.href = items[i].href; }
    if (descEl) { descEl.textContent = items[i].desc; descEl.hidden = !items[i].desc; }
    if (subEl)  { subEl.textContent = items[i].sub; }
    if (colEl) {
      var bs = colEl.querySelectorAll('button');
      for (var k = 0; k < bs.length; k++) {
        if (k === i) bs[k].setAttribute('aria-current', 'true');
        else bs[k].removeAttribute('aria-current');
      }
    }
  }

  /* 切语言：站名、介绍、副标题三样都要换，然后整张图集重画
     （data-zh/data-en 只认静态元素，这里的内容是脚本拼的，管不到） */
  new MutationObserver(function () {
    buildItems();
    relabelCol();
    lastIdx = -1;
    rebuildAtlas();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

  /* 皮肤换了就重新取色 */
  new MutationObserver(function () {
    readColors();
    rebuildAtlas();                    /* 纸色和墨色都换了，卡面得重画 */
  }).observe(document.documentElement, {
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

  /* #07 这样的锚点直接落到第 7 张卡 —— 轮播里没有可分享的 URL，补一个。
     顺带也是截图核对的抓手（无头浏览器点不了方向键）。 */
  function applyHash() {
    var m = /^#(\d{1,2})$/.exec(window.location.hash || '');
    if (!m) return;
    var i = parseInt(m[1], 10) - 1;
    if (i >= 0 && i < N) goTo(i, true);      /* 锚点是「已经在这张卡上」，不播旋转 */
  }
  window.addEventListener('hashchange', applyHash);

  /* 顶部那个筛选框：轮播启用后没有网格可筛了，改成「跳到第一个匹配的站点」 */
  window.__ringJump = function (q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].hay.indexOf(q) !== -1) { goTo(i); return; }
    }
  };

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
      var k = c.idx;                        /* 槽位 → 站点序号，查格子用 */
      aCard[j * 4] = c.sx * DPR; aCard[j * 4 + 1] = c.sy * DPR;
      aCard[j * 4 + 2] = Math.max(c.hw * DPR, 0.5); aCard[j * 4 + 3] = Math.max(c.hh * DPR, 0.5);
      /* 远的卡往背景色里沉一点，给景深 */
      var f = 0.86 + 0.14 * c.p;
      aTint[j * 3]     = COL.paper[0] * f + COL.bg[0] * (1 - f);
      aTint[j * 3 + 1] = COL.paper[1] * f + COL.bg[1] * (1 - f);
      aTint[j * 3 + 2] = COL.paper[2] * f + COL.bg[2] * (1 - f);
      aVis[j] = c.vis;
      aFace[j] = c.face;
      aCell[j * 4]     = cellOf[k * 4];
      aCell[j * 4 + 1] = cellOf[k * 4 + 1];
      aCell[j * 4 + 2] = cellOf[k * 4 + 2];
      aCell[j * 4 + 3] = cellOf[k * 4 + 3];
    }

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1i(U.uCount, N);
    gl.uniform4fv(U.uCard, aCard);
    gl.uniform3fv(U.uTint, aTint);
    gl.uniform1fv(U.uVis, aVis);
    gl.uniform1fv(U.uFace, aFace);
    gl.uniform4f(U.uActive, act.sx * DPR, act.sy * DPR,
                 Math.max(act.hw * DPR, 0.5), Math.max(act.hh * DPR, 0.5));
    /* 每张卡在图集里的格子 —— 每张采自己那一格 */
    gl.uniform4fv(U.uCell, aCell);
    gl.uniform3f(U.uBg, COL.bg[0], COL.bg[1], COL.bg[2]);
    gl.uniform3f(U.uAccent, COL.accent[0], COL.accent[1], COL.accent[2]);
    gl.uniform3f(U.uHair, COL.hair[0], COL.hair[1], COL.hair[2]);
    /* 卡面内容图集：绑到 0 号纹理单元 */
    if (atlasTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.uniform1i(U.uAtlas, 0);
    }
    gl.uniform1f(U.uHasTex, hasTex);
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

  rebuildAtlas();
  /* 轮播接管：收起那列兜底链接，把舞台放出来 */
  var listEl = document.getElementById('ringList');
  if (listEl) listEl.hidden = true;
  stage.hidden = false;
  running = true;
  requestAnimationFrame(frame);
  applyHash();
})();
