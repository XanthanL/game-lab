/* ============================================================
   涂涂画画 2.0 · 环廊(viscose ring carousel)
   效果移植自 Viscose carousel(Yousuf-developer,MIT):
   https://github.com/Yousuf-developer/Viscose-carousel
   原实现 Next.js + Three.js + GSAP;此处为服从宿主 plain-html 栈的
   原生 WebGL 移植——零依赖,一个全屏三角形 + 一个 fragment shader
   一次绘制完成:卡片 SDF 经 smooth-min 融合成黏液,邻居间拉蜂蜜丝,
   上下玻璃唇折射,所有画作打包进一张纹理图集。

   对宿主的适配(与原实现的差异):
   - 卡片竖版:比例按 works 数据的实际宽高比自适应(原版 1.5:1 横版)
   - 纸白静奢:透明画布叠在宿主 --bg 上,黏液颜色自动取自画作本身
   - 竖直滚轮还给页面滚动;左右拖拽 / 左右滚轮分量 / 方向键 / 按钮转环
   - 点击正面卡打开宿主灯箱(window.LB.open,由 gallery.js 暴露)
   - prefers-reduced-motion:跳过入场动画,直接呈现可交互的环
   - WebGL 不可用时整区降级隐藏,作品流仍是完整馆藏
   ============================================================ */
(function () {
  "use strict";

  var MAX_PLANES = 32;
  var MAX_LINKS = 32;
  var TAU = Math.PI * 2;
  var HALF_PI = Math.PI / 2;
  var DEG = Math.PI / 180;
  var FAN_START = 0.06;

  /* ── 数据与元素 ─────────────────────────────────────────── */
  var allWorks = window.WORKS && window.WORKS.works ? window.WORKS.works : [];
  var stage = document.getElementById("ring-stage");
  if (!allWorks.length || !stage) return;
  var works = allWorks.slice(0, MAX_PLANES);
  var count = works.length;

  var el = {
    brand: document.getElementById("ring-brand"),
    loader: document.getElementById("ring-loader"),
    list: document.getElementById("ring-list"),
    no: document.getElementById("ring-no"),
    title: document.getElementById("ring-title"),
    media: document.getElementById("ring-media"),
    sub: document.getElementById("ring-sub"),
    capTitle: document.getElementById("ring-cap-title"),
    capMeta: document.getElementById("ring-cap-meta"),
    prev: document.getElementById("ring-prev"),
    next: document.getElementById("ring-next"),
    fallback: document.getElementById("ring-fallback"),
    live: null
  };

  function metaText(w) {
    var bits = [];
    if (w.media) bits.push(w.media);
    if (w.author) bits.push(w.author);
    if (w.age) bits.push(w.age + "岁");
    return bits.join(" · ");
  }

  /* ── 参数(数值基准窗 1512×870,与原实现同约定)──────────── */
  var P = {
    refWidth: 1512, refHeight: 870,
    fitHeight: 0.45, minScale: 0.5, maxScale: 1.6,

    narrowAt: 1024, narrowPlane: 1.22, narrowRadius: 1.28, narrowEndScale: 3.5,
    tightAt: 640, tightRadius: 0.8, tightEndScale: 4.8,

    planeSize: 100,      // 长边(竖版 = 高),px
    ringRadius: 150,     // ×g
    radius: 10,          // 卡片圆角,画纸的钝角
    blend: 14,           // 相邻画作在黏液里的交叉渐变 px

    stagger: 0.34,
    launchTime: 1.6, spreadTime: 2.9, stageAt: 0.7,
    spinTurns: 1, spinTime: 2.2, moveTime: 1.8, moveDelay: 0.2,
    posY: 0, endScale: 4.2,
    holdAfter: 0.15,

    scrollSpeed: 0.012, damping: 0.94, maxSpeed: 10, dragSpeed: 1,
    snap: true, snapTime: 0.8, snapFrom: 1, pickTime: 0.55,

    hover: true, touchHold: 0.16, touchSlop: 10, lag: 0.3,
    melt: 30, meltReach: 240, reach: 1.7, swell: 0.09, pull: 26,
    grab: 0.14, release: 0.06, web: 0.2, webReach: 1.15,
    wave: 4, waveFreq: 0.05, waveSpeed: 7,
    sideScale: 0.035, sidePush: 17, sideDim: 0.15, sideReach: 2.4,

    glass: true, bandTop: 0.09, bandBottom: 0.09,
    refract: 44, squeeze: 0.04, ripple: 3, rippleFreq: 0.02,
    fringe: 1.2, sheen: 0.04,

    tagFrom: 720, tagX: 54, tagY: -34, tagFrost: 0.14, tagRim: 0.02, tagRefract: 30,

    thread: 1.0, thin: 0.4, pinch: 0.35, sag: 6, dissolve: 2.9, fillet: 14,
    wobble: 3, goo: 32
  };

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) { P.wobble = 0; P.wave = 0; }

  // 环半径随件数走:邻居弦长 ≈ 1.75 倍卡高 —— 比初版疏朗、又不至于散开,
  // 拖拽/悬停时蜂蜜丝仍够得着(quiet-luxury:平时克制,触碰才黏)
  P.ringRadius = (P.planeSize * 0.875) / Math.sin(Math.PI / count);

  /* ── 工具(与原实现 utils.js 同名同义)───────────────────── */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }
  function easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function smoothstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function signedOffset(i) { return i === 0 ? 0 : (i % 2 === 1 ? (i + 1) / 2 : -i / 2); }
  function chase(dt, rate) { return 1 - Math.pow(1 - rate, dt * 60); }
  function elasticOut(t, period) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var s = period / (2 * Math.PI) * Math.asin(1);
    return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1;
  }

  /* ── 着色器(移植自 components/shaders/planeShaders.js)───── */
  var vertexShader = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = aPos * 0.5 + 0.5;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}"
  ].join("\n");

  var fragmentShader = [
    "#extension GL_OES_standard_derivatives : enable",
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "varying vec2 vUv;",
    "uniform vec2  uResolution;",
    "uniform vec2  uSize;",
    "uniform float uRadius;",
    "uniform float uCount;",
    "uniform vec2  uPos[" + MAX_PLANES + "];",
    "uniform float uRot[" + MAX_PLANES + "];",
    "uniform vec4  uScale[" + MAX_PLANES + "];",
    "uniform float uLinkCount;",
    "uniform vec2  uLinkA[" + MAX_LINKS + "];",
    "uniform vec2  uLinkB[" + MAX_LINKS + "];",
    "uniform vec4  uLinkPar[" + MAX_LINKS + "];",
    "uniform float uK;",
    "uniform float uWobble;",
    "uniform float uTime;",
    "uniform vec3  uColor;",
    "uniform vec3  uPage;",
    "uniform sampler2D uAtlas;",
    "uniform vec2  uGrid;",
    "uniform vec2  uCell;",
    "uniform float uBlend;",
    "uniform float uTextured;",
    "uniform vec4 uMouse;",
    "uniform vec4 uMelt;",
    "uniform sampler2D uTagTex;",
    "uniform vec4 uTag;",
    "uniform vec4 uTagP;",
    "uniform vec4 uTagQ;",
    // 图集坐标:idx → 格位,uv 乘以单格占整张图集的比例(图集补边到 2 的幂)
    "vec2 atlasUV(vec2 uv, float idx) {",
    "  float col = mod(idx, uGrid.x);",
    "  float row = floor(idx / uGrid.x);",
    "  return (vec2(col, row) + uv) * uCell;",
    "}",
    // 上下玻璃唇:对采样位置 p 做圆形截面折弯,卡片与蜂蜜一起被折射
    "uniform float uBandTop;",
    "uniform float uBandBottom;",
    "uniform vec4  uGlass;",
    "uniform float uFringe;",
    "uniform float uSheen;",
    "float glassBend(inout vec2 p) {",
    "  float band = p.y > 0.0 ? uBandTop : uBandBottom;",
    "  if (band <= 0.5) return 0.0;",
    "  float dy = abs(p.y) - (uResolution.y * 0.5 - band);",
    "  if (dy <= 0.0) return 0.0;",
    "  float t = clamp(dy / band, 0.0, 1.0);",
    "  float bend = 1.0 - sqrt(max(0.0, 1.0 - t * t));",
    "  float s = sign(p.y);",
    "  p.y -= s * bend * (uGlass.x + sin(p.x * uGlass.w) * uGlass.z);",
    "  p.x *= 1.0 - bend * uGlass.y;",
    "  return bend;",
    "}",
    // simplex noise (Ashima Arts / Stefan Gustavson,MIT)
    "vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
    "vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
    "vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }",
    "float snoise(vec2 v) {",
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439,",
    "                     -0.577350269189626, 0.024390243902439);",
    "  vec2 i  = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod289(i);",
    "  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))",
    "                          + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),",
    "                          dot(x12.zw, x12.zw)), 0.0);",
    "  m = m * m; m = m * m;",
    "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);",
    "  vec3 g;",
    "  g.x  = a0.x  * x0.x  + h.x  * x0.y;",
    "  g.yz = a0.y  * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",
    "float sdRoundBox(vec2 p, vec2 b, float r) {",
    "  vec2 q = abs(p) - b + r;",
    "  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;",
    "}",
    // 两张卡之间的蜂蜜:平扫过的板,中段收细,自重下垂。
    // 刻意不用胶囊形——扫盒子在卡片重叠期完全藏在卡内,轮廓仍是整张卡。
    "float sdBridge(vec2 p, vec2 a, vec2 b, float rEnd, float rMid, float sag) {",
    "  vec2 ba = b - a;",
    "  float len = length(ba);",
    "  if (len < 0.001) return 1e6;",
    "  vec2 dir = ba / len;",
    "  vec2 nrm = vec2(-dir.y, dir.x);",
    "  vec2 q = p - (a + b) * 0.5;",
    "  float along = dot(q, dir);",
    "  float across = dot(q, nrm);",
    "  float h = clamp(along / len + 0.5, 0.0, 1.0);",
    "  float bell = sin(3.14159265 * h);",
    "  across += sag * bell * nrm.y;",
    "  float taper = pow(1.0 - bell, 1.7);",
    "  float r = mix(rMid, rEnd, taper);",
    "  return max(abs(along) - len * 0.5, abs(across) - r);",
    "}",
    "float sdTag(vec2 p) {",
    "  vec2 hs = uTagP.xy * abs(uTag.zw);",
    "  return sdRoundBox(p - uTag.xy, hs, min(uTagP.z, min(hs.x, hs.y)));",
    "}",
    "vec2 tagNormal(vec2 p) {",
    "  vec2 e = vec2(1.0, 0.0);",
    "  vec2 g = vec2(",
    "    sdTag(p + e.xy) - sdTag(p - e.xy),",
    "    sdTag(p + e.yx) - sdTag(p - e.yx)",
    "  );",
    "  float l = length(g);",
    "  return l > 0.0001 ? g / l : vec2(0.0);",
    "}",
    // smooth minimum —— 让形状读作液体的那一步
    "float smin(float a, float b, float k) {",
    "  if (k <= 0.0001) return min(a, b);",
    "  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);",
    "  return mix(b, a, h) - k * h * (1.0 - h);",
    "}",
    "void main() {",
    "  vec2 ps = (vUv - 0.5) * uResolution;",
    "  vec2 p = ps;",
    "  float bend = glassBend(p);",
    "  float dTag = sdTag(ps);",
    "  float tagOn = min(abs(uTag.z), abs(uTag.w));",
    "  if (tagOn > 0.001 && dTag < 0.0 && uTagP.w > 0.0) {",
    "    float depth = clamp(-dTag / max(uTagP.y * abs(uTag.w), 1.0), 0.0, 1.0);",
    "    float t = 1.0 - depth;",
    "    p += tagNormal(ps) * (1.0 - sqrt(max(0.0, 1.0 - t * t))) * uTagP.w;",
    "  }",
    "  float toMouse = length(p - uMouse.xy);",
    "  float k = uK;",
    "  if (uMouse.z > 0.001) {",
    "    float t = 1.0 - smoothstep(0.0, max(uMelt.x, 1.0), toMouse);",
    "    k += uMouse.w * uMouse.z * t * t;",
    "  }",
    "  float d = 1e6;",
    "  float d0 = 1e6, d1 = 1e6;",
    "  vec2 uv0 = vec2(0.5), uv1 = vec2(0.5);",
    "  float im0 = 0.0, im1 = 0.0;",
    "  float dm0 = 1.0, dm1 = 1.0;",
    "  float halfSpan = length(uSize) * 0.5;",
    "  for (int i = 0; i < " + MAX_PLANES + "; i++) {",
    "    if (float(i) >= uCount) break;",
    "    vec4 st = uScale[i];",
    "    vec2 sc = st.xy;",
    "    float grown = max(sc.x, sc.y);",
    "    if (grown <= 0.0001) continue;",
    "    vec2 q = p - uPos[i];",
    "    float cull = halfSpan * grown + k + uWobble + 8.0;",
    "    if (dot(q, q) > cull * cull) continue;",
    "    float a  = uRot[i];",
    "    float ca = cos(a), sa = sin(a);",
    "    q = vec2(q.x * ca + q.y * sa, -q.x * sa + q.y * ca);",
    "    vec2 halfSize = max(uSize * 0.5 * sc, vec2(0.0001));",
    "    float rMax = min(halfSize.x, halfSize.y);",
    "    float r = min(rMax, mix(rMax, uRadius, smoothstep(0.30, 1.0, min(sc.x, sc.y))));",
    "    float di = sdRoundBox(q, halfSize, r);",
    "    d = smin(d, di, k);",
    "    vec2 luv = q / (2.0 * halfSize) + 0.5;",
    "    luv.y = 1.0 - luv.y;",
    "    luv = clamp(luv, 0.004, 0.996);",
    "    if (di < d0) {",
    "      d1 = d0; uv1 = uv0; im1 = im0; dm1 = dm0;",
    "      d0 = di; uv0 = luv; im0 = st.w; dm0 = st.z;",
    "    } else if (di < d1) {",
    "      d1 = di; uv1 = luv; im1 = st.w; dm1 = st.z;",
    "    }",
    "  }",
    "  for (int i = 0; i < " + MAX_LINKS + "; i++) {",
    "    if (float(i) >= uLinkCount) break;",
    "    vec4 par = uLinkPar[i];",
    "    if (par.x <= -3.0) continue;",
    "    vec2 a = uLinkA[i];",
    "    vec2 b = uLinkB[i];",
    "    vec2 mid = (a + b) * 0.5;",
    "    float reach = length(b - a) * 0.5 + par.x + par.w + 8.0;",
    "    if (dot(p - mid, p - mid) > reach * reach) continue;",
    "    d = smin(d, sdBridge(p, a, b, par.x, par.y, par.z), par.w);",
    "  }",
    "  if (uWobble > 0.001) {",
    "    float n = snoise(p * 0.012 + vec2(uTime * 0.22, uTime * -0.17));",
    "    d += n * uWobble;",
    "  }",
    "  if (uMelt.y > 0.001) {",
    "    d += sin(toMouse * uMelt.z - uTime * uMelt.w)",
    "       * uMelt.y * exp(-toMouse / max(uMelt.x, 1.0));",
    "  }",
    "  float aa = clamp(fwidth(d), 0.5, 2.0);",
    "  float alpha = 1.0 - smoothstep(-aa, aa, d);",
    "  float taa = clamp(fwidth(dTag), 0.5, 2.0);",
    "  float ta = tagOn > 0.001 ? 1.0 - smoothstep(-taa, taa, dTag) : 0.0;",
    "  if (alpha <= 0.001 && ta <= 0.001) discard;",
    "  float nearest = smoothstep(-uBlend, uBlend, d1 - d0);",
    "  vec3 col = uColor;",
    "  if (uTextured > 0.5) {",
    "    vec3 c0, c1;",
    "    if (uFringe > 0.0) {",
    "      vec2 fr = vec2(uFringe * bend / max(uSize.x, 1.0), 0.0);",
    "      c0 = vec3(",
    "        texture2D(uAtlas, atlasUV(uv0 + fr, im0)).r,",
    "        texture2D(uAtlas, atlasUV(uv0, im0)).g,",
    "        texture2D(uAtlas, atlasUV(uv0 - fr, im0)).b",
    "      );",
    "      c1 = vec3(",
    "        texture2D(uAtlas, atlasUV(uv1 + fr, im1)).r,",
    "        texture2D(uAtlas, atlasUV(uv1, im1)).g,",
    "        texture2D(uAtlas, atlasUV(uv1 - fr, im1)).b",
    "      );",
    "    } else {",
    "      c0 = texture2D(uAtlas, atlasUV(uv0, im0)).rgb;",
    "      c1 = texture2D(uAtlas, atlasUV(uv1, im1)).rgb;",
    "    }",
    "    col = mix(c1, c0, nearest);",
    "  }",
    "  col *= mix(dm1, dm0, nearest);",
    "  col += bend * uSheen;",
    "  if (ta > 0.001) {",
    "    vec3 under = mix(uPage, col, alpha);",
    "    vec3 glass = mix(under, vec3(1.0), uTagQ.x);",
    "    float band = clamp(1.0 + dTag / max(uTagP.z, 1.0), 0.0, 1.0);",
    "    glass += band * band * uTagQ.y *",
    "             dot(tagNormal(ps), vec2(-0.7071, 0.7071));",
    "    vec2 tuv = (ps - uTag.xy) / (uTagP.xy * 2.0 * abs(uTag.zw)) + 0.5;",
    "    float m = texture2D(uTagTex, clamp(tuv, 0.0, 1.0)).a;",
    "    float l = dot(glass, vec3(0.2126, 0.7152, 0.0722));",
    "    glass = mix(glass, vec3(1.0 - smoothstep(0.46, 0.54, l)), m);",
    "    col = mix(col, glass, ta);",
    "    alpha = max(alpha, ta);",
    "  }",
    "  gl_FragColor = vec4(col, alpha);",
    "}"
  ].join("\n");

  /* ── GL 初始化(失败 → 整区降级)─────────────────────────── */
  var canvas = document.createElement("canvas");
  canvas.className = "ring__canvas";
  stage.insertBefore(canvas, stage.firstChild);

  var gl = canvas.getContext("webgl", {
    alpha: true, antialias: true, premultipliedAlpha: false
  });
  var derivatives = gl && gl.getExtension("OES_standard_derivatives");

  function shutDown() {
    stage.classList.add("ring--off");
    if (el.fallback) el.fallback.hidden = false;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  if (!gl || !derivatives) { shutDown(); return; }

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
    }
    return sh;
  }

  var prog, U = {};
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    }
  } catch (err) {
    shutDown();
    if (window.console) console.warn("[ring]", err.message);
    return;
  }
  gl.useProgram(prog);

  // 全屏三角形
  var triBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  ["uResolution", "uSize", "uRadius", "uCount",
    "uPos", "uRot", "uScale",
    "uLinkCount", "uLinkA", "uLinkB", "uLinkPar",
    "uK", "uWobble", "uTime", "uColor", "uPage",
    "uAtlas", "uGrid", "uCell", "uBlend", "uTextured",
    "uMouse", "uMelt", "uTagTex", "uTag", "uTagP", "uTagQ",
    "uBandTop", "uBandBottom", "uGlass", "uFringe", "uSheen"
  ].forEach(function (name) { U[name] = gl.getUniformLocation(prog, name); });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  function hexToRGB(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  // 取自 css/tokens.css:--fg 作未贴图色,--bg 作光标标签下的纸色
  gl.uniform3fv(U.uColor, hexToRGB("#201E19"));
  gl.uniform3fv(U.uPage, hexToRGB("#F9F7EF"));

  // 1×1 占位纹理,保证采样器从一开始就绑定着东西
  function blankTexture() {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  var atlasTex = blankTexture();
  var tagTex = blankTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.uniform1i(U.uAtlas, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tagTex);
  gl.uniform1i(U.uTagTex, 1);

  var anisoExt = gl.getExtension("EXT_texture_filter_anisotropic") ||
    gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  /* ── 图集:全部画作打包进一张 2 的幂纹理 ──────────────────── */
  var aspectSum = 0;
  works.forEach(function (w) {
    aspectSum += (w.w && w.h) ? (w.w / w.h) : 0.83;
  });
  var artAspect = clamp01((aspectSum / works.length) || 0.83);
  artAspect = Math.min(0.98, Math.max(0.5, artAspect));

  var atlas = { grid: [1, 1], cell: [1, 1], count: count, first: false, prog: 0 };
  (function buildAtlas() {
    var n = works.length;
    var cap = Math.min(2048, maxTex);
    var CELL_MAX = 1024;   // 件数很少时别为一张画开满整张纹理
    // 打包形状由件数决定:把列数 1..n 扫一遍,取「格位最长边最大」的那一种。
    // 旧写法从 640 起按 2 的幂降档,14 件时 640 档要 2048×4096(超 MAX_TEXTURE_SIZE)
    // 就一路掉到 320 档 —— 中间能装下的档位(14 件时 4 列 × 4 行的 450×512)它不试。
    // 后果是第 10 件起全环分辨率腰斩,且到 32 件都不回升(格位 281×320),
    // 而正面卡在 dpr2 屏上要 738×840 设备像素 → 整环被放大 2.63 倍,画是糊的。
    var cellW, cellH, cols, rows, w, h;
    var best = null;
    for (var c = 1; c <= n; c++) {
      var r = Math.ceil(n / c);
      // 两个约束:c 列宽不超 cap、r 行高不超 cap
      var hMax = Math.min(cap / (c * artAspect), cap / r);
      if (!best || hMax > best.hMax) best = { cols: c, rows: r, hMax: hMax };
    }
    cols = best.cols;
    rows = best.rows;
    cellH = Math.max(64, Math.min(CELL_MAX, Math.floor(best.hMax)));
    cellW = Math.round(cellH * artAspect);
    w = 1; while (w < cols * cellW) w *= 2;   // 补边到 2 的幂:WebGL1 生成 mipmap 的前提
    h = 1; while (h < rows * cellH) h *= 2;
    atlas.grid = [cols, rows];
    atlas.cell = [cellW / w, cellH / h];

    var sheet = document.createElement("canvas");
    sheet.width = w; sheet.height = h;
    var ctx = sheet.getContext("2d");

    var settled = 0;
    var uploaded = 0;
    function upload() {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (anisoExt) {
        gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(8, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
      uploaded++;
    }

    function paint(img, i) {
      var x = (i % cols) * cellW;
      var y = Math.floor(i / cols) * cellH;
      var s = Math.max(cellW / img.width, cellH / img.height);
      var dw = img.width * s;
      var dh = img.height * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH); // 裁掉溢出,绝不压扁
      ctx.clip();
      ctx.drawImage(img, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
      ctx.restore();
    }

    function fetchInto(i) {
      var img = new Image();
      var tries = 0;
      var finished = false;
      var watchdog = 0;
      // 环上只取 thumb(长边 720)。图集格位最长边 ≤1024,720 已够采样;
      // 而 w-*.jpg(1400,给灯箱看大图用)是它的 1.7 倍体积 —— 首屏不必背。
      var src = works[i].thumb || works[i].src;

      // 看门狗:请求挂起 4s 就换参重试,至多 3 次;一格坏图照常走
      function arm() {
        clearTimeout(watchdog);
        watchdog = setTimeout(function () {
          if (finished) return;
          if (tries < 3) {
            tries++;
            img.src = src + "?retry=" + tries;
          } else {
            finish(false);
          }
        }, 4000);
      }
      function finish(ok) {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        if (ok) paint(img, i);
        settled++;
        atlas.prog = settled / n;
        if (i === 0 && ok) { atlas.first = true; upload(); }
        else if (settled === n) upload();
      }
      img.onload = function () { finish(true); };
      img.onerror = function () {
        if (tries < 3) {
          tries++;
          arm();
          img.src = src + "?retry=" + tries;
        } else {
          finish(false);
        }
      };
      arm();
      img.src = src;
    }

    for (var i = 0; i < n; i++) fetchInto(i);
  })();

  // 图集格位常量:idx→(列,行) 用 uGrid,uv→图集内比例 用 uCell。漏传会让
  // 全部采样落在 (0,0),整环变成图集的深度 mip 平均色
  gl.uniform2f(U.uGrid, atlas.grid[0], atlas.grid[1]);
  gl.uniform2f(U.uCell, atlas.cell[0], atlas.cell[1]);

  /* ── 光标标签:2D 画布写「看大图」+ 手绘箭头,只取 alpha ────── */
  var TAG_W = 118, TAG_H = 44;
  var tagBox = { sx: 0.5, sy: 0 };
  var tagAnim = { on: false, t0: 0 };
  (function buildTag() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2) * 2;
    var c = document.createElement("canvas");
    c.width = Math.ceil(TAG_W * dpr);
    c.height = Math.ceil(TAG_H * dpr);
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.6;
    ctx.font = "500 15px \"Jost\",\"PingFang SC\",\"HarmonyOS Sans SC\",\"Microsoft YaHei\",sans-serif";
    var label = "看大图";
    var tw = ctx.measureText(label).width;
    var arrow = 14, gap = 7;
    var run = arrow + gap + tw;
    var x0 = (TAG_W - run) / 2;
    ctx.fillText(label, x0 + arrow + gap, TAG_H / 2 + 1);
    var ay = (TAG_H - arrow) / 2 + 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 2.5, ay + arrow - 2.5);
    ctx.lineTo(x0 + arrow - 3, ay + 3.5);
    ctx.moveTo(x0 + arrow - 9.5, ay + 3);
    ctx.lineTo(x0 + arrow - 3, ay + 3.5);
    ctx.lineTo(x0 + arrow - 3.5, ay + 10);
    ctx.stroke();

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tagTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // 世界坐标 y 向上
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  })();

  function showTag(on) {
    tagAnim.on = on;
    tagAnim.t0 = performance.now();
  }

  /* ── uniform 数组(CPU 侧平铺)────────────────────────────── */
  var uPos = new Float32Array(MAX_PLANES * 2);
  var uRot = new Float32Array(MAX_PLANES);
  var uScale = new Float32Array(MAX_PLANES * 4);
  var uLinkA = new Float32Array(MAX_LINKS * 2);
  var uLinkB = new Float32Array(MAX_LINKS * 2);
  var uLinkPar = new Float32Array(MAX_LINKS * 4);

  /* ── 状态 ───────────────────────────────────────────────── */
  var state = { progress: 0, launch: 0, spread: 0, spin: 0, shift: 0 };
  var interactive = false;

  var viewW = 1, viewH = 1;
  var bounds = { left: 0, top: 0 };
  var fit = 1, planeK = 1, radiusK = 1;
  var narrowNow = false, tightNow = false;
  var endScaleNow = P.endScale;
  var posXNow = -2;

  var ringCentre = { x: 0, y: 0 };
  var frontAngle = 0;
  var spinVel = 0;
  var dragging = false;
  var dragPrevAngle = 0, dragPrevTime = 0;
  var settling = false, snapTo = 0, snapCap = 0;
  var pickAnim = null; // { from, to, t0, dur }

  var pointer = { x: 0, y: 0, inside: false, seeded: false };
  var cursor = { x: 0, y: 0, amt: 0, wake: 0 };
  var coarse = false, held = false, holdTimer = 0;

  var pointerTravel = 0, travelX = 0, travelY = 0;

  var travel = new Float32Array(MAX_PLANES);
  var cum = new Float32Array(MAX_PLANES);
  var order = [];
  var rest = [];
  var hoverF = new Float32Array(MAX_PLANES);
  var leanX = new Float32Array(MAX_PLANES);
  var leanY = new Float32Array(MAX_PLANES);
  var webF = new Float32Array(MAX_LINKS);
  var sideF = new Float32Array(MAX_PLANES);
  var focusPos = { x: 0, y: 0 };
  for (var ri = 0; ri < MAX_PLANES; ri++) rest.push({ x: 0, y: 0 });

  var shownCell = -1;
  var over = -1;
  var frontI = -1;
  var tagUp = false;

  var imageCount = atlas.count;
  function cellOf(slot) {
    return imageCount > 0 ? (((slot % imageCount) + imageCount) % imageCount) : 0;
  }

  function swellOf(i) {
    return Math.max(0.05, 1 + P.swell * hoverF[i] - P.sideScale * sideF[i]);
  }

  /* ── 尺寸 ───────────────────────────────────────────────── */
  function refit() {
    var byW = viewW / Math.max(1, P.refWidth);
    var byH = viewH / Math.max(1, P.refHeight);
    var s = byW * (1 - P.fitHeight) + Math.min(byW, byH) * P.fitHeight;
    fit = Math.min(P.maxScale, Math.max(P.minScale, s));

    narrowNow = viewW <= P.narrowAt;
    tightNow = viewW <= P.tightAt;
    planeK = narrowNow ? P.narrowPlane : 1;
    radiusK = (narrowNow ? P.narrowRadius : 1) * (tightNow ? P.tightRadius : 1);
    endScaleNow = tightNow ? P.tightEndScale :
      (narrowNow ? P.narrowEndScale : P.endScale);

    // 正面卡钉在屏宽中心:环心左移 R·g,posX 以半屏宽为单位反推
    var g = endScaleNow * fit;
    var Rnow = P.ringRadius * radiusK * g;
    posXNow = -2 * Rnow / Math.max(1, viewW);
  }

  function resize() {
    viewW = stage.clientWidth;
    viewH = stage.clientHeight;
    if (!viewW || !viewH) return;
    refit();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uResolution, viewW, viewH);
    bounds = stage.getBoundingClientRect();
  }

  /* ── 布局(移植 Carousel.jsx 的 layout,竖版适配)──────────── */
  function layout(dt, time) {
    var step = TAU / count;
    var spread = clamp01(state.spread);

    var shift = clamp01(state.shift);
    var g = (1 + (endScaleNow - 1) * shift) * fit;
    var cx = posXNow * viewW * 0.5 * shift;
    var cy = P.posY * viewH * 0.5 * shift;

    ringCentre.x = viewW * 0.5 + cx;
    ringCentre.y = viewH * 0.5 - cy;
    frontAngle = (cx !== 0 || cy !== 0) ? Math.atan2(-cy, -cx) : 0;

    // 竖版卡片:长边是高。径向朝外的是宽(短边),邻居沿切向隔着长边相望
    var H = P.planeSize * planeK * g;       // 长边 = 高
    var W = H * artAspect;                   // 短边 = 宽
    gl.uniform2f(U.uSize, W, H);
    gl.uniform1f(U.uRadius, P.radius * planeK * g);

    var sepExtent = H;    // 沿切向量到邻居的伸展 = 长边
    var faceEdge = W;     // 与邻居相望的边 = 短边(竖版的上下边)

    var R = P.ringRadius * radiusK * g;
    var restingGap = 2 * R * Math.sin(step / 2) - sepExtent;
    var finalSep = Math.max(1, restingGap);

    var maxN = Math.max(1, Math.abs(signedOffset(count - 1)));
    var dur = Math.max(0.1, 1 - FAN_START - P.stagger);
    cum[0] = 0;
    for (var n = 1; n <= maxN; n++) {
      var start = FAN_START + ((n - 1) / maxN) * P.stagger;
      var t = clamp01((spread - start) / dur);
      travel[n] = t * t * (3 - 2 * t);
      cum[n] = cum[n - 1] + travel[n];
    }

    var seedAngle = 0 * DEG;
    var launch = easeInOutQuad(clamp01(state.launch));
    var Rnow = R * launch;

    order.length = 0;

    var track = cursor.amt > 0.001;
    var reach = Math.max(1, P.reach * W);
    var sideReach = Math.max(1, P.sideReach * W);
    var kRise = chase(dt, P.grab);
    var kFall = chase(dt, P.release);

    var fD = 1e9, fI = -1, fCell = 0;
    var probe = pointer.inside && pointer.seeded && interactive;
    var overI = -1;
    var focusI = track ? over : -1;

    for (var i = 0; i < count; i++) {
      var sIdx = signedOffset(i);
      var gen = Math.abs(sIdx);
      var u = i === 0 ? clamp01(state.progress) : travel[gen];
      var cell = cellOf(sIdx);

      var angle = seedAngle + (sIdx > 0 ? 1 : sIdx < 0 ? -1 : 0) * step * cum[gen] + state.spin;
      var px = Math.cos(angle) * Rnow + cx;
      var py = Math.sin(angle) * Rnow + cy;
      rest[i].x = px; rest[i].y = py;

      var da = angle - frontAngle;
      var toFront = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      if (toFront < fD) { fD = toFront; fI = i; fCell = cell; }

      var f = 0, toX = 0, toY = 0;
      if (track) {
        var dx = cursor.x - px;
        var dy = cursor.y - py;
        var dist = Math.sqrt(dx * dx + dy * dy);
        f = smoothstep(reach, reach * 0.22, dist) * cursor.amt * u;
        if (f > 0.0001 && dist > 0.0001) {
          var lean = (P.pull * fit * f) / dist;
          toX = dx * lean;
          toY = dy * lean;
        }
      }
      var k = f > hoverF[i] ? kRise : kFall;
      hoverF[i] += (f - hoverF[i]) * k;
      leanX[i] += (toX - leanX[i]) * k;
      leanY[i] += (toY - leanY[i]) * k;

      var sf = 0;
      if (focusI >= 0 && i !== focusI) {
        var fd = Math.sqrt(
          (focusPos.x - px) * (focusPos.x - px) +
          (focusPos.y - py) * (focusPos.y - py));
        sf = smoothstep(sideReach, sideReach * 0.2, fd) * u;
      }
      sideF[i] += (sf - sideF[i]) * (sf > sideF[i] ? kRise : kFall);

      var pushX = 0, pushY = 0;
      if (sideF[i] > 0.0001) {
        var ex = px - focusPos.x;
        var ey = py - focusPos.y;
        var ed = Math.sqrt(ex * ex + ey * ey);
        if (ed > 0.0001) {
          var away = (P.sidePush * fit * sideF[i]) / ed;
          pushX = ex * away;
          pushY = ey * away;
        }
      }

      uPos[i * 2] = px + leanX[i] + pushX;
      uPos[i * 2 + 1] = py + leanY[i] + pushY;
      uRot[i] = angle * launch;   // 竖版:angle 本身即直立(前面已证)

      var sx = i === 0
        ? easeOutCubic(clamp01(u / 0.7))
        : easeOutCubic(clamp01(u / 0.34));
      var sy = i === 0
        ? easeOutCubic(clamp01((u - 0.18) / 0.74))
        : easeOutCubic(clamp01((u - 0.06) / 0.36));
      var sw = swellOf(i);
      uScale[i * 4] = sx * sw;
      uScale[i * 4 + 1] = sy * sw;
      uScale[i * 4 + 2] = 1 - P.sideDim * sideF[i];
      uScale[i * 4 + 3] = cell;

      if (probe && overI < 0) {
        var rot = uRot[i];
        var qx = cursor.x - uPos[i * 2];
        var qy = cursor.y - uPos[i * 2 + 1];
        var cr = Math.cos(rot), sr = Math.sin(rot);
        if (Math.abs(qx * cr + qy * sr) <= W * 0.5 * sx * sw &&
            Math.abs(-qx * sr + qy * cr) <= H * 0.5 * sy * sw) {
          overI = i;
        }
      }

      order.push(i);
    }

    for (i = count; i < MAX_PLANES; i++) {
      uScale[i * 4] = 0; uScale[i * 4 + 1] = 0;
      uScale[i * 4 + 2] = 1; uScale[i * 4 + 3] = 0;
      hoverF[i] = 0; leanX[i] = 0; leanY[i] = 0; sideF[i] = 0;
    }

    over = overI;
    frontI = fI;
    // 标签只在正面卡出现:侧面卡点了是转过来,不该许诺"看大图"
    var wantTag = over >= 0 && over === frontI && !coarse && viewW > P.tagFrom;
    if (wantTag !== tagUp) { tagUp = wantTag; showTag(wantTag); }
    if (over >= 0) { focusPos.x = rest[over].x; focusPos.y = rest[over].y; }

    if (fI >= 0 && imageCount > 0) setFront(fCell);

    /* ---- 蜂蜜丝 ---- */
    order.sort(function (a, b) { return signedOffset(a) - signedOffset(b); });

    var edgeHalf = faceEdge * 0.5 * P.thread;
    var closed = spread > 0.995 && count > 2;
    var linkCount = Math.min(closed ? count : count - 1, MAX_LINKS);

    for (var l = 0; l < linkCount; l++) {
      var ia = order[l];
      var ib = order[(l + 1) % count];

      var ax = uPos[ia * 2], ay = uPos[ia * 2 + 1];
      var bx = uPos[ib * 2], by = uPos[ib * 2 + 1];
      var scAx = uScale[ia * 4], scAy = uScale[ia * 4 + 1];
      var scBx = uScale[ib * 4], scBy = uScale[ib * 4 + 1];

      // 只按静止中心和出生缩放计,悬停的膨胀不许回灌进几何
      var shrinkA = scAx / swellOf(ia);
      var shrinkB = scBx / swellOf(ib);
      var rdx = rest[ia].x - rest[ib].x;
      var rdy = rest[ia].y - rest[ib].y;
      var sep = Math.sqrt(rdx * rdx + rdy * rdy) - sepExtent * 0.5 * (shrinkA + shrinkB);
      var v = clamp01(sep / finalSep);

      var fl = 0;
      if (track && P.web > 0.0001) {
        var mx = (ax + bx) * 0.5;
        var my = (ay + by) * 0.5;
        var webReach = Math.max(1, P.webReach * W);
        var wd = Math.sqrt((cursor.x - mx) * (cursor.x - mx) + (cursor.y - my) * (cursor.y - my));
        fl = smoothstep(webReach, webReach * 0.15, wd) * cursor.amt;
      }
      webF[l] += (fl - webF[l]) * (fl > webF[l] ? kRise : kFall);

      var wgt = Math.max(Math.pow(1 - v, P.thin), P.web * webF[l]);
      var rEnd = edgeHalf * wgt - P.dissolve;
      var rMid = rEnd * (1 - (1 - P.pinch) * smoothstep(0, 0.7, v));

      uLinkA[l * 2] = ax; uLinkA[l * 2 + 1] = ay;
      uLinkB[l * 2] = bx; uLinkB[l * 2 + 1] = by;
      uLinkPar[l * 4] = rEnd;
      uLinkPar[l * 4 + 1] = rMid;
      uLinkPar[l * 4 + 2] = P.sag * g * Math.pow(v, 1.5);
      uLinkPar[l * 4 + 3] = Math.min(
        P.fillet * g * smoothstep(0, 0.35, v),
        Math.max(rMid, 0) * 1.5);
    }
    for (l = linkCount; l < MAX_LINKS; l++) {
      uLinkPar[l * 4] = -100; uLinkPar[l * 4 + 1] = -100;
      uLinkPar[l * 4 + 2] = 0; uLinkPar[l * 4 + 3] = 0;
    }

    /* ── 上传本帧全部 uniform ── */
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uCount, count);
    gl.uniform1fv(U.uRot, uRot);
    gl.uniform2fv(U.uPos, uPos);
    gl.uniform4fv(U.uScale, uScale);
    gl.uniform2fv(U.uLinkA, uLinkA);
    gl.uniform2fv(U.uLinkB, uLinkB);
    gl.uniform4fv(U.uLinkPar, uLinkPar);
    gl.uniform1f(U.uLinkCount, linkCount);
    gl.uniform1f(U.uK, P.goo * planeK * fit);
    gl.uniform1f(U.uWobble, reduceMotion ? 0 :
      P.wobble * fit * (1 - smoothstep(0.2, 0.95, state.progress)));
    gl.uniform1f(U.uTextured, atlas.first ? 1 : 0);
    gl.uniform1f(U.uBlend, Math.max(0.5, P.blend * planeK * g));

    var on = P.glass;
    gl.uniform1f(U.uBandTop, on ? P.bandTop * viewH : 0);
    gl.uniform1f(U.uBandBottom, on ? P.bandBottom * viewH : 0);
    gl.uniform4f(U.uGlass, P.refract, P.squeeze, P.ripple, P.rippleFreq);
    gl.uniform1f(U.uFringe, on ? P.fringe : 0);
    gl.uniform1f(U.uSheen, on ? P.sheen : 0);

    // 光标标签:两根弹簧先后弹出,收回时压扁成一颗珠
    var sx, sy;
    if (tagAnim.on) {
      var kt = (performance.now() - tagAnim.t0) / 1000;
      sx = elasticOut(clamp01(kt / 0.62), 0.5);
      sy = elasticOut(clamp01(kt / 0.74), 0.42);
    } else {
      var kd = clamp01((performance.now() - tagAnim.t0) / 280);
      sx = 0.5 - 0.5 * kd * kd * kd;
      sy = 1 - easeInOutQuad(kd);
    }
    tagBox.sx = sx; tagBox.sy = sy;
    gl.uniform4f(U.uTag,
      cursor.x + P.tagX, cursor.y + P.tagY, sx, sy);
    gl.uniform4f(U.uTagP,
      TAG_W * 0.5, TAG_H * 0.5, TAG_H * 0.5, P.tagRefract);
    gl.uniform4f(U.uTagQ, P.tagFrost, P.tagRim, 0, 0);
  }

  /* ── 入场时间线(替代 GSAP:种子出生 → 等图 → 出发 → 展开 → 转身)── */
  var entry = {
    t0: null,        // 种子开始出生的时刻
    launchAt: null,  // 计数到 100 之后一小拍,环出发
    done: false
  };
  var PROGRESS_DUR = 1.2;

  var brandShownAt = null;   // 片头字标出现的时刻
  var brandDismissed = false;
  var seedArmed = false;

  function startEntry() {
    if (brandShownAt !== null) return;
    if (reduceMotion) {
      state.progress = 1; state.launch = 1; state.spread = 1;
      state.shift = 1; state.spin = 0;
      interactive = true;
      entry.done = true;
      brandDismissed = true; seedArmed = true;
      if (el.loader) el.loader.style.display = "none";
      if (el.brand) el.brand.classList.add("is-in", "is-out");
      stage.classList.add("is-live");
      return;
    }
    // 片头:字标独占画面(此刻无任何卡片,绝无重叠)
    if (el.brand) el.brand.classList.add("is-in");
    brandShownAt = performance.now();
  }

  function entryEval(now) {
    if (entry.done || brandShownAt === null) return;

    // 字标独占 1.6s → 自行淡出(0.6s) → 再半拍,种子才出生,环才展开
    if (!brandDismissed && now - brandShownAt > 1600) {
      brandDismissed = true;
      if (el.brand) el.brand.classList.add("is-out");
    }
    if (!seedArmed && now - brandShownAt > 2050) {
      seedArmed = true;
      entry.t0 = now;
      stage.classList.add("is-live");
    }
    if (entry.t0 === null) return;

    var t = (now - entry.t0) / 1000;
    state.progress = easeOutQuad(clamp01(t / PROGRESS_DUR));

    if (entry.launchAt !== null) {
      var tl = (now - entry.launchAt) / 1000;
      state.launch = easeInOutQuad(clamp01(tl / P.launchTime));
      var spreadStart = P.launchTime - 0.15;
      state.spread = easeOutQuad(clamp01((tl - spreadStart) / P.spreadTime));
      var stageStart = spreadStart + P.stageAt * P.spreadTime;
      state.spin = easeInOutQuad(clamp01((tl - stageStart) / P.spinTime)) *
        P.spinTurns * TAU;
      state.shift = easeInOutQuad(clamp01((tl - stageStart - P.moveDelay) / P.moveTime));
      if (tl >= stageStart + P.moveDelay + P.moveTime) {
        entry.done = true;
        interactive = true;
      }
    }
  }

  /* ── 载入计数(只反映画作到达;环的出发还要等片头结束)───────── */
  var loading = { shown: 0, ready: false };
  function tickLoader(dt) {
    if (reduceMotion) return;
    if (!el.loader) {
      if (!loading.ready && atlas.prog >= 1 && seedArmed) {
        loading.ready = true; armLaunch();
      }
      return;
    }
    var target = atlas.prog;
    loading.shown += (target - loading.shown) * chase(dt, 0.18);
    var np = Math.round(loading.shown * 100);
    np = Math.min(100, Math.max(1, np));
    el.loader.textContent = ("00" + np).slice(-3);
    if (!loading.ready && np >= 100 && atlas.prog >= 1 && seedArmed) {
      loading.ready = true;
      armLaunch();
    }
  }
  function armLaunch() {
    // 计数落定后一小拍,环出发;计数同时淡出
    setTimeout(function () {
      if (el.loader) el.loader.classList.add("is-done");
      entry.launchAt = performance.now();
    }, P.holdAfter * 1000);
  }

  /* ── DOM:正面卡信息 ─────────────────────────────────────── */
  var listItems = [];
  var swapTimer = 0;

  (function buildList() {
    if (!el.list) return;
    works.forEach(function (w, i) {
      var li = document.createElement("li");
      li.textContent = w.no + " " + w.title;
      el.list.appendChild(li);
      listItems.push(li);
    });
  })();

  if (!el.live) {
    el.live = document.createElement("div");
    el.live.className = "visually-hidden";
    el.live.setAttribute("aria-live", "polite");
    stage.appendChild(el.live);
  }

  function fillFront(cell) {
    var w = works[cell];
    if (!w) return;
    if (el.no) el.no.textContent = "No." + w.no;
    if (el.title) el.title.textContent = "《" + w.title + "》";
    if (el.media) el.media.textContent = metaText(w) || "馆藏作品";
    if (el.sub) el.sub.textContent = "馆藏 · " + w.no + "/" + count;
    if (el.capTitle) el.capTitle.textContent = "《" + w.title + "》";
    if (el.capMeta) el.capMeta.textContent = metaText(w);
    listItems.forEach(function (li, i) {
      if (li) li.className = i === cell ? "is-on" : "";
    });
  }

  function setFront(cell) {
    if (cell === shownCell) return;
    var first = shownCell < 0;
    shownCell = cell;
    if (first) { fillFront(cell); }
    else {
      // 糊一下再换字,静奢的换场不跳变
      var metas = stage.querySelectorAll(".ring__meta,.ring__caption");
      Array.prototype.forEach.call(metas, function (m) { m.classList.add("is-swap"); });
      clearTimeout(swapTimer);
      swapTimer = setTimeout(function () {
        fillFront(cell);
        Array.prototype.forEach.call(metas, function (m) { m.classList.remove("is-swap"); });
      }, 170);
    }
    if (el.live) {
      var w = works[cell];
      el.live.textContent = "第 " + (cell + 1) + " 件,《" + w.title + "》";
    }
  }

  /* ── 输入 ───────────────────────────────────────────────── */
  function endHold() {
    clearTimeout(holdTimer);
    holdTimer = 0;
    held = false;
  }
  function beginHold() {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { held = true; }, P.touchHold * 1000);
  }
  function engaged() { return coarse ? held : pointer.inside; }

  function trackPointer(e) {
    coarse = e.pointerType === "touch";
    pointer.x = e.clientX - bounds.left - viewW * 0.5;
    pointer.y = viewH * 0.5 - (e.clientY - bounds.top);
    pointer.inside = true;
    if (!pointer.seeded) {
      pointer.seeded = true;
      cursor.x = pointer.x;
      cursor.y = pointer.y;
    }
  }

  function stopPick() { pickAnim = null; }

  function pick(i) {
    var slot = TAU / count;
    var base = frontAngle - 0 * DEG - signedOffset(i) * slot;
    var target = base + Math.round((state.spin - base) / TAU) * TAU;
    var slots = Math.abs(target - state.spin) / slot;
    if (slots < 0.01) return false;
    spinVel = 0;
    settling = false;
    stopPick();
    pickAnim = {
      from: state.spin, to: target,
      t0: performance.now(),
      dur: P.pickTime * 1000 * Math.sqrt(Math.max(1, slots))
    };
    return true;
  }

  function onWheel(e) {
    if (!interactive) return;
    // 整页即环廊:滚轮就是浏览作品,页面不再滚动
    e.preventDefault();
    var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!d) return;
    stopPick();
    settling = false;
    spinVel += d * P.scrollSpeed;
    spinVel = Math.max(-P.maxSpeed, Math.min(P.maxSpeed, spinVel));
  }

  function pointerAngle(e) {
    var dx = e.clientX - bounds.left - ringCentre.x;
    var dy = e.clientY - bounds.top - ringCentre.y;
    return Math.atan2(-dy, dx);
  }

  function onPointerDown(e) {
    pointerTravel = 0;
    travelX = e.clientX; travelY = e.clientY;
    trackPointer(e);
    if (!interactive) return;
    stopPick();
    if (coarse) beginHold();
    dragging = true;
    settling = false;
    spinVel = 0;
    dragPrevAngle = pointerAngle(e);
    dragPrevTime = performance.now();
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 无妨 */ }
    }
  }

  function onPointerMove(e) {
    trackPointer(e);
    pointerTravel += Math.abs(e.clientX - travelX) + Math.abs(e.clientY - travelY);
    travelX = e.clientX; travelY = e.clientY;
    if (coarse && !held && pointerTravel > P.touchSlop) endHold();
    if (!dragging) return;

    var a = pointerAngle(e);
    var delta = a - dragPrevAngle;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;

    var turn = delta * P.dragSpeed;
    state.spin += turn;
    var now = performance.now();
    spinVel = turn / (Math.max(8, now - dragPrevTime) / 1000);
    dragPrevAngle = a;
    dragPrevTime = now;
  }

  function onPointerUp(e) {
    trackPointer(e);
    endHold();
    if (!dragging) return;
    dragging = false;
    if (canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 无妨 */ }
    }
  }

  function onPointerLeave() { pointer.inside = false; }

  function onClick() {
    if (!interactive || pointerTravel >= 6 || over < 0) return;
    // 点的就是正面卡 → 看大图;点旁边卡 → 先转过来
    if (over === frontI) {
      if (window.LB && window.LB.open) window.LB.open(shownCell);
      else if (works[shownCell] && works[shownCell].src) {
        window.open(works[shownCell].src, "_blank");
      }
    } else {
      pick(over);
    }
  }

  function stepFocus(dir) {
    if (!interactive || frontI < 0) return;
    pick((frontI + dir + count) % count);
  }

  function onKey(e) {
    if (e.key === "ArrowRight") { e.preventDefault(); stepFocus(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stepFocus(-1); }
    else if (e.key === "Enter") {
      if (interactive && shownCell >= 0 && window.LB && window.LB.open) {
        window.LB.open(shownCell);
      }
    }
  }

  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("pointerleave", onPointerLeave);
  stage.addEventListener("click", onClick);
  stage.addEventListener("keydown", onKey);
  if (el.prev) el.prev.addEventListener("click", function () { stepFocus(-1); });
  if (el.next) el.next.addEventListener("click", function () { stepFocus(1); });

  function updatePointer(dt) {
    var live = P.hover && engaged() && pointer.seeded && interactive;
    cursor.amt += ((live ? 1 : 0) - cursor.amt) * chase(dt, 0.12);

    var k = chase(dt, P.lag);
    cursor.x += (pointer.x - cursor.x) * k;
    cursor.y += (pointer.y - cursor.y) * k;

    var tdx = pointer.x - cursor.x;
    var tdy = pointer.y - cursor.y;
    var trail = Math.sqrt(tdx * tdx + tdy * tdy);
    cursor.wake = Math.max(
      cursor.wake * Math.pow(0.94, dt * 60),
      clamp01(trail / (Math.max(dt, 0.001) * 2600)));

    gl.uniform4f(U.uMouse, cursor.x, cursor.y, cursor.amt,
      reduceMotion ? 0 : P.melt * fit);
    gl.uniform4f(U.uMelt,
      P.meltReach * fit,
      (reduceMotion ? 0 : P.wave * fit * cursor.wake * cursor.amt),
      P.waveFreq, P.waveSpeed);
  }

  /* ── 主循环(离屏即歇:每帧用矩形判定,不依赖 IntersectionObserver)── */
  var visible = true;
  var lastWait = "";

  function checkVisible() {
    var r = stage.getBoundingClientRect();
    var vh = window.innerHeight || viewH || 900;
    return r.bottom > -120 && r.top < vh + 120;
  }

  var started = performance.now();
  var prevT = started;
  var frameErr = null;
  var frameTick = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - prevT) / 1000);
    prevT = now;
    visible = checkVisible();
    if (!visible || !viewW) {
      // 探针:卡在等可见还是等尺寸,直接写到节点上便于排查
      var waitTag = visible ? "size" : "visible";
      if (waitTag !== lastWait) {
        lastWait = waitTag;
        if (!frameErr) stage.setAttribute("data-ring-wait", waitTag);
      }
      return;
    }
    if (lastWait !== "run") {
      lastWait = "run";
      if (!frameErr) stage.setAttribute("data-ring-wait", "run");
    }
    if (frameErr) return;
    try {
      var time = (now - started) / 1000;

      startEntry();
      entryEval(now);

      // 点击归位:转环补间期间动量整体让位
      if (pickAnim) {
        var kt = clamp01((now - pickAnim.t0) / pickAnim.dur);
        state.spin = pickAnim.from + (pickAnim.to - pickAnim.from) * easeInOutCubic(kt);
        if (kt >= 1) pickAnim = null;
      }

      if (interactive && !dragging && !pickAnim) {
        state.spin += spinVel * dt;
        spinVel *= Math.pow(P.damping, dt * 60);

        var off = 0;
        if (P.snap) {
          var slot = TAU / count;
          var decay = Math.max(0.01, -Math.log(P.damping) * 60);
          var engage = Math.max(P.snapFrom, decay * slot * 0.5);
          var rate = 4.8 / Math.max(0.05, P.snapTime);

          if (!settling && Math.abs(spinVel) < engage) {
            var coast = state.spin + spinVel / decay;
            var phase = 0 * DEG - frontAngle;
            snapTo = Math.round((coast + phase) / slot) * slot - phase;
            snapCap = Math.max(Math.abs(spinVel), slot * 0.5 * rate);
            settling = true;
          }
          if (settling) {
            off = snapTo - state.spin;
            var aim = Math.max(-snapCap, Math.min(snapCap, off * rate));
            spinVel += (aim - spinVel) * clamp01(rate * dt);
          }
        } else {
          settling = false;
        }

        if (Math.abs(spinVel) < 0.0015 && Math.abs(off) < 0.0008) {
          spinVel = 0;
          state.spin += off;
        }
      }

      tickLoader(dt);
      updatePointer(dt);
      layout(dt, time);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // 轻量状态回显:每 30 帧一写(不可见属性,便于远程排查)
      if ((frameTick = (frameTick + 1) % 30) === 0) {
        stage.setAttribute("data-ring-state",
          "p" + state.progress.toFixed(2) +
          " l" + state.launch.toFixed(2) +
          " s" + state.spread.toFixed(2) +
          " sh" + state.shift.toFixed(2) +
          " atlas" + atlas.prog.toFixed(2) +
          (entry.done ? " done" : ""));
      }
    } catch (err) {
      frameErr = err;
      stage.setAttribute("data-ring-error", String((err && err.message) || err));
      if (window.console) console.warn("[ring frame]", err);
    }
  }
  requestAnimationFrame(frame);

  /* ── resize / 滚动时更新画布与指针基准 ────────────────────── */
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", function () {
    bounds = stage.getBoundingClientRect();
  }, { passive: true });
  resize();
}
)();
