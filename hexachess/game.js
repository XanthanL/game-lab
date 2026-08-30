// src/platform/monetize.ts
var AD_UNIT = {
  banner: "",
  // 例如 'adunit-xxxxxxxxxxxx'
  interstitial: "",
  rewarded: ""
};
var SHARE_CARD = {
  title: "\u516D\u8FB9\u667A\u5C06 \xB7 \u76CA\u667A\u89E3\u8C1C\uFF0C\u6765\u6311\u6218\u4F60\u7684\u8111\u529B\uFF01",
  query: "from=share"
};
function wxReady() {
  return typeof wx !== "undefined";
}
function wxAds() {
  let banner = null;
  return {
    showBanner() {
      if (!AD_UNIT.banner || !wxReady()) return;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const screenH = info.screenHeight || info.windowHeight;
        const screenW = info.screenWidth || info.windowWidth;
        banner = wx.createBannerAd({
          adUnitId: AD_UNIT.banner,
          style: { left: 0, top: Math.max(0, screenH - 90), width: screenW }
        });
        banner.show().catch(() => {
        });
      } catch {
      }
    },
    hideBanner() {
      try {
        banner?.destroy();
      } catch {
      }
      banner = null;
    },
    showInterstitial() {
      if (!AD_UNIT.interstitial || !wxReady()) return;
      try {
        const ad = wx.createInterstitialAd({ adUnitId: AD_UNIT.interstitial });
        ad.show().catch(() => {
        });
      } catch {
      }
    },
    showRewarded() {
      return new Promise((resolve) => {
        if (!AD_UNIT.rewarded || !wxReady()) {
          resolve(false);
          return;
        }
        try {
          const ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT.rewarded });
          ad.onClose((res) => resolve(!!(res && res.isEnded)));
          ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => resolve(false)));
        } catch {
          resolve(false);
        }
      });
    }
  };
}
function domAds() {
  return {
    showBanner() {
    },
    hideBanner() {
    },
    showInterstitial() {
    },
    showRewarded: async () => false
  };
}
function wxShare() {
  return {
    enableShare(card) {
      if (!wxReady()) return;
      try {
        wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
        wx.onShareAppMessage(() => ({
          title: card.title,
          imageUrl: card.imageUrl,
          query: card.query || ""
        }));
      } catch {
      }
    },
    share(card) {
      if (!wxReady()) return;
      try {
        wx.shareAppMessage({
          title: card?.title || SHARE_CARD.title,
          imageUrl: card?.imageUrl,
          query: card?.query || SHARE_CARD.query
        });
      } catch {
      }
    }
  };
}
function domShare() {
  return {
    enableShare() {
    },
    share(card) {
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          navigator.share({ title: card?.title || SHARE_CARD.title, url: location.href }).catch(() => {
          });
        }
      } catch {
      }
    }
  };
}
function wxCloud() {
  const KEY = "lbzj_lb";
  return {
    enabled: false,
    // 配好 wx.cloud 环境后改为 true
    submitScore(score) {
      if (!wxReady()) return;
      try {
        const arr = JSON.parse(wx.getStorageSync(KEY) || "[]");
        arr.push(score);
        wx.setStorageSync(KEY, JSON.stringify(arr.slice(-50)));
      } catch {
      }
    },
    async getRank() {
      try {
        const arr = JSON.parse(wx.getStorageSync(KEY) || "[]");
        arr.sort((a, b) => b - a);
        return {
          rank: 0,
          top: arr.slice(0, 10).map((s, i) => ({ name: "\u73A9\u5BB6" + (i + 1), score: s }))
        };
      } catch {
        return { rank: 0, top: [] };
      }
    }
  };
}
function domCloud() {
  const KEY = "lbzj_lb";
  return {
    enabled: false,
    submitScore(score) {
      try {
        const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
        arr.push(score);
        localStorage.setItem(KEY, JSON.stringify(arr.slice(-50)));
      } catch {
      }
    },
    async getRank() {
      try {
        const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
        arr.sort((a, b) => b - a);
        return {
          rank: 0,
          top: arr.slice(0, 10).map((s, i) => ({ name: "\u73A9\u5BB6" + (i + 1), score: s }))
        };
      } catch {
        return { rank: 0, top: [] };
      }
    }
  };
}
function createMonetization() {
  if (wxReady()) {
    return { ads: wxAds(), share: wxShare(), cloud: wxCloud() };
  }
  return { ads: domAds(), share: domShare(), cloud: domCloud() };
}

// src/platform/audio.ts
function createAudioEngine(getCtx) {
  let muted = false;
  function ctx() {
    const c = getCtx();
    if (!c) return null;
    if (c.state === "suspended") {
      try {
        c.resume();
      } catch {
      }
    }
    return c;
  }
  function tone(opts) {
    const c = ctx();
    if (!c || muted) return;
    const t0 = c.currentTime + opts.start;
    const osc = c.createOscillator();
    const g = c.createGain();
    const peak = opts.peak ?? 0.18;
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.dur);
    }
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + opts.dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.03);
  }
  function arp(freqs, start, step, dur, type = "triangle", peak = 0.16) {
    freqs.forEach((f, i) => tone({ freq: f, start: start + i * step, dur, type, peak }));
  }
  const map = {
    // 抓取：短促低音，给出「拿起」反馈
    pick: () => tone({ freq: 330, start: 0, dur: 0.07, type: "sine", peak: 0.15 }),
    // 放入将营：清脆小三度回落，给出「对上了」的满足感
    place: () => tone({ freq: 523, start: 0, dur: 0.13, type: "sine", peak: 0.2, slideTo: 392 }),
    // 暂存：比 place 略闷，区分两种落点
    stack: () => tone({ freq: 392, start: 0, dur: 0.1, type: "triangle", peak: 0.14 }),
    // 消除：明快上行琶音（C5-E5-G5）
    clear: () => arp([523, 659, 784], 0, 0.07, 0.14, "triangle", 0.18),
    // 将杀：明亮大和弦 + 低频铺底（胜利感）
    checkmate: () => {
      arp([523, 659, 784, 1046], 0, 0.06, 0.5, "triangle", 0.16);
      tone({ freq: 130, start: 0, dur: 0.55, type: "sine", peak: 0.12 });
    },
    // 弹回：下行方波，轻微「不对」提示（不刺耳）
    bounce: () => tone({ freq: 300, start: 0, dur: 0.1, type: "square", peak: 0.07, slideTo: 170 }),
    // 按钮：极短轻点
    click: () => tone({ freq: 200, start: 0, dur: 0.04, type: "sine", peak: 0.12 }),
    // 通关：两声铃声（E5 + B5）
    win: () => {
      tone({ freq: 659, start: 0, dur: 0.18, type: "sine", peak: 0.18 });
      tone({ freq: 988, start: 0.13, dur: 0.32, type: "sine", peak: 0.16 });
    },
    // 提示：双音 ping
    hint: () => {
      tone({ freq: 880, start: 0, dur: 0.08, type: "sine", peak: 0.14 });
      tone({ freq: 1100, start: 0.08, dur: 0.1, type: "sine", peak: 0.12 });
    },
    // 合并：每颗棋子落叠的木质"咔哒"声。短促方波 + 快速下滑，像棋子磕在栈上；
    // step 越高音越亮，制造"一块一块往上摞"的节奏升调。
    merge: (step = 0) => {
      const base = 300 + Math.min(18, step) * 26;
      tone({ freq: base, start: 0, dur: 0.05, type: "square", peak: 0.12, slideTo: base * 0.7 });
      tone({ freq: base * 2, start: 0, dur: 0.03, type: "sine", peak: 0.06 });
    },
    // 倒计时滴答：短促高频轻点（限时关最后 5s）
    tick: () => tone({ freq: 1250, start: 0, dur: 0.045, type: "square", peak: 0.07 })
  };
  return {
    resume() {
      const c = getCtx();
      if (c && c.state === "suspended") {
        try {
          c.resume();
        } catch {
        }
      }
    },
    setMuted(m) {
      muted = m;
    },
    play(name, opts) {
      try {
        const step = opts?.step ?? 0;
        if (name === "merge") map.merge(step);
        else map[name]();
      } catch {
      }
    }
  };
}
function createNoopAudio() {
  return { resume() {
  }, setMuted() {
  }, play() {
  } };
}

// src/platform/wx.ts
function createWxPlatform() {
  const canvas = wx.createCanvas();
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const dpr = info.pixelRatio || 1;
  const screenW = info.screenWidth || info.windowWidth;
  const screenH = info.screenHeight || info.windowHeight;
  let downCb = () => {
  };
  let moveCb = () => {
  };
  let upCb = () => {
  };
  wx.onTouchStart((e) => {
    const t = e.touches[0];
    if (t) downCb({ x: t.clientX, y: t.clientY, id: t.identifier ?? 0 });
  });
  wx.onTouchMove((e) => {
    const t = e.touches[0];
    if (t) moveCb({ x: t.clientX, y: t.clientY, id: t.identifier ?? 0 });
  });
  wx.onTouchEnd((e) => {
    const t = e.changedTouches && e.changedTouches[0] || e.touches[0];
    if (t) upCb({ x: t.clientX, y: t.clientY, id: t.identifier ?? 0 });
  });
  const m = createMonetization();
  const audio = createAudioEngine(() => wx.createWebAudioContext ? wx.createWebAudioContext() : null);
  return {
    getCanvas: () => canvas,
    createCanvas: (w, h) => {
      const c = wx.createCanvas();
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    },
    getDpr: () => dpr,
    getScreenSize: () => ({ width: screenW, height: screenH }),
    onPointerDown: (cb) => {
      downCb = cb;
    },
    onPointerMove: (cb) => {
      moveCb = cb;
    },
    onPointerUp: (cb) => {
      upCb = cb;
    },
    raf: (cb) => wx.requestAnimationFrame(cb),
    storageGet: (k) => {
      try {
        return wx.getStorageSync(k) ?? null;
      } catch {
        return null;
      }
    },
    storageSet: (k, v) => {
      try {
        wx.setStorageSync(k, v);
      } catch {
      }
    },
    log: (...a) => console.log("[\u516D\u8FB9\u667A\u5C06]", ...a),
    ads: m.ads,
    share: m.share,
    cloud: m.cloud,
    audio,
    launchQuery: () => {
      try {
        return wx.getLaunchOptionsSync?.()?.query || {};
      } catch {
        return {};
      }
    }
  };
}

// src/core/colors.ts
var PIECES = [
  { type: "pawn", name: "\u5175", color: "#E8635A" },
  { type: "knight", name: "\u9A6C", color: "#4C8BF5" },
  { type: "bishop", name: "\u8C61", color: "#3FB68B" },
  { type: "rook", name: "\u8F66", color: "#F2B84B" },
  { type: "queen", name: "\u540E", color: "#9B6BD6" },
  { type: "king", name: "\u738B", color: "#5AC3D9" }
];
var BG_COLOR = "#FAF6EF";
var INK_COLOR = "#3A3530";
var HEX_STROKE = "#E7DFD3";
function shade(hex, percent) {
  const c = hex.replace("#", "");
  const n = parseInt(
    c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c,
    16
  );
  let r = n >> 16 & 255;
  let g = n >> 8 & 255;
  let b = n & 255;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// src/render/draw.ts
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// src/core/hex.ts
function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
var SQRT3 = Math.sqrt(3);
function hexToPixel(q, r, size) {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2)
  };
}
function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}
function hexMap(radius) {
  const cells = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (hexDistance({ q: 0, r: 0 }, { q, r }) <= radius) cells.push({ q, r });
    }
  }
  cells.sort(
    (a, b) => hexDistance({ q: 0, r: 0 }, a) - hexDistance({ q: 0, r: 0 }, b) || a.q - b.q || a.r - b.r
  );
  return cells;
}
function fitHexLayout(coords, cx, cy, maxW, maxH) {
  const raw = coords.map((c) => hexToPixel(c.q, c.r, 1));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of raw) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const size = Math.min(maxW / spanX, maxH / spanY) * 0.92;
  const raw2 = coords.map((c) => hexToPixel(c.q, c.r, size));
  let minX2 = Infinity;
  let maxX2 = -Infinity;
  let minY2 = Infinity;
  let maxY2 = -Infinity;
  for (const p of raw2) {
    minX2 = Math.min(minX2, p.x);
    maxX2 = Math.max(maxX2, p.x);
    minY2 = Math.min(minY2, p.y);
    maxY2 = Math.max(maxY2, p.y);
  }
  const ox = cx - (minX2 + maxX2) / 2;
  const oy = cy - (minY2 + maxY2) / 2;
  return { size, ox, oy };
}

// src/render/sprites.ts
var PIE_H_RATIO = 0.36;
var STACK_STEP_RATIO = 0.34;
var PIXEL = (n) => Math.round(n);
var BAND_LIGHT = -6;
var BAND_MID = -18;
var BAND_DARK = -32;
function drawBackground(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#FCF9F3");
  g.addColorStop(1, BG_COLOR);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.4, W * 0.2, W / 2, H * 0.52, W * 0.95);
  rg.addColorStop(0, "rgba(255,255,255,0)");
  rg.addColorStop(1, "rgba(58,53,48,0.05)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = "rgba(58,53,48,0.05)";
  const step = 50;
  for (let y = 70; y < H - 120; y += step) {
    for (let x = Math.round(y / step) % 2 * (step / 2); x < W; x += step) {
      ctx.fillRect(PIXEL(x), PIXEL(y), 2, 2);
    }
  }
  ctx.restore();
}
function drawTrayShelf(ctx, W, H) {
  const top = H - 110;
  const h = H - 6 - top;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillRect(8, top, W - 16, h);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(8, top, W - 16, 2);
  ctx.fillStyle = "rgba(231,223,211,0.9)";
  ctx.fillRect(8, top + h - 2, W - 16, 2);
  ctx.restore();
}
function drawHexTile3D(ctx, x, y, r, color, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(58,53,48,0.18)";
  ctx.beginPath();
  ctx.ellipse(PIXEL(x), PIXEL(y + h + r * 0.28), r * 0.96, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const n = 6;
  const topV = [];
  const botV = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 180 * (60 * i);
    topV.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    botV.push([x + r * Math.cos(a), y + r * Math.sin(a) + h]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const midY = (topV[i][1] + topV[j][1]) / 2;
    if (midY > y) {
      ctx.moveTo(topV[i][0], topV[i][1]);
      ctx.lineTo(topV[j][0], topV[j][1]);
      ctx.lineTo(botV[j][0], botV[j][1]);
      ctx.lineTo(botV[i][0], botV[i][1]);
      ctx.closePath();
    }
  }
  ctx.fillStyle = shade(color, BAND_MID);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const bandH = Math.max(2, PIXEL(h * 0.14));
  ctx.fillStyle = shade(color, BAND_LIGHT);
  ctx.fillRect(PIXEL(x - r), PIXEL(y + 2), PIXEL(r * 2), bandH);
  ctx.fillStyle = shade(color, BAND_DARK);
  ctx.fillRect(PIXEL(x - r), PIXEL(y + h - bandH - 2), PIXEL(r * 2), bandH);
  ctx.restore();
  hexPath(ctx, x, y, r);
  ctx.fillStyle = shade(color, 6);
  ctx.fill();
  hexPath(ctx, x, y, r * 0.78);
  ctx.fillStyle = shade(color, 18);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = shade(color, -32);
  hexPath(ctx, x, y, r);
  ctx.stroke();
  ctx.restore();
}
function drawEmptyCell(ctx, cell, valid = false) {
  hexPath(ctx, cell.x, cell.y, cell.rad);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = valid ? "#3FB68B" : HEX_STROKE;
  hexPath(ctx, cell.x, cell.y, cell.rad * 0.94);
  ctx.stroke();
  ctx.restore();
  if (cell.highlight > 0) {
    ctx.save();
    ctx.globalAlpha = cell.highlight * 0.55;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFC93C";
    hexPath(ctx, cell.x, cell.y, cell.rad * 1.1);
    ctx.stroke();
    ctx.restore();
  }
}
function drawLockedCell(ctx, cell) {
  hexPath(ctx, cell.x, cell.y, cell.rad);
  ctx.fillStyle = "#CBC4B8";
  ctx.fill();
  ctx.save();
  hexPath(ctx, cell.x, cell.y, cell.rad * 0.97);
  ctx.clip();
  ctx.strokeStyle = "rgba(58,53,48,0.10)";
  ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) {
    const off = i * cell.rad * 0.45;
    ctx.beginPath();
    ctx.moveTo(PIXEL(cell.x - cell.rad + off), PIXEL(cell.y + cell.rad));
    ctx.lineTo(PIXEL(cell.x + cell.rad + off), PIXEL(cell.y - cell.rad));
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#A9A093";
  hexPath(ctx, cell.x, cell.y, cell.rad * 0.94);
  ctx.stroke();
  const s = cell.rad * 0.3;
  ctx.save();
  ctx.translate(PIXEL(cell.x), PIXEL(cell.y));
  ctx.strokeStyle = INK_COLOR;
  ctx.fillStyle = INK_COLOR;
  ctx.lineWidth = Math.max(2, s * 0.22);
  ctx.beginPath();
  ctx.arc(0, -s * 0.25, s * 0.55, Math.PI, 0);
  ctx.stroke();
  const bw = s * 1.1;
  const bh = s * 0.8;
  const by = -s * 0.2;
  ctx.fillRect(PIXEL(-bw / 2), PIXEL(by), PIXEL(bw), PIXEL(bh));
  ctx.restore();
}
function drawObstacle(ctx, x, y, r) {
  if (r <= 0.5) return;
  const h = r * PIE_H_RATIO;
  drawHexTile3D(ctx, x, y, r, "#9A9186", h, 1);
  drawChessIcon(ctx, "rook", r * 0.42, "rgba(58,53,48,0.88)");
}
function drawFlyingTile(ctx, x, y, r, color, type) {
  const h = r * PIE_H_RATIO;
  drawHexTile3D(ctx, x, y, r, color, h, 1);
  drawChessIcon(ctx, type, r * 0.42);
}
function drawPieceStack(ctx, x, y, r, tiles, scale, alpha) {
  const s = scale === void 0 ? 1 : scale;
  const a = alpha === void 0 ? 1 : alpha;
  if (tiles.length === 0) return;
  const h = r * PIE_H_RATIO;
  const step = r * STACK_STEP_RATIO;
  const topJ = tiles.length - 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-x, -y);
  for (let j = 0; j < tiles.length; j++) {
    const t = tiles[j];
    const tileR = j === topJ ? r * 0.96 : r * 0.92;
    drawHexTile3D(ctx, x, y - j * step, tileR, t.color, h, 1);
  }
  const top = tiles[topJ];
  ctx.save();
  ctx.translate(x, y - topJ * step);
  drawChessIcon(ctx, top.type, r * 0.4);
  ctx.restore();
  ctx.restore();
}
function drawCellStack(ctx, cell) {
  if (cell.locked) {
    drawLockedCell(ctx, cell);
    return;
  }
  if (cell.highlight > 0) {
    ctx.save();
    ctx.globalAlpha = cell.highlight * 0.55;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#FFC93C";
    hexPath(ctx, cell.x, cell.y, cell.rad * 1.12);
    ctx.stroke();
    ctx.restore();
  }
  if (!cell.stack || cell.stack.length === 0) {
    drawEmptyCell(ctx, cell, false);
    return;
  }
  const step = cell.rad * STACK_STEP_RATIO;
  const h = cell.rad * PIE_H_RATIO;
  const landT = cell.landT ?? 0;
  const landPop = landT > 0 ? 1 + 0.22 * Math.sin(Math.min(1, Math.max(0, landT / 0.16)) * Math.PI) : 1;
  const topJ = cell.stack.length - 1;
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.scale(landPop, landPop);
  ctx.translate(-cell.x, -cell.y);
  for (let j = 0; j < cell.stack.length; j++) {
    const t = cell.stack[j];
    const tileR = j === topJ ? cell.rad * 0.96 : cell.rad * 0.92;
    drawHexTile3D(ctx, cell.x, cell.y - j * step, tileR, t.color, h, 1);
  }
  ctx.restore();
  const top = cell.stack[topJ];
  ctx.save();
  ctx.translate(cell.x, cell.y - topJ * step);
  drawChessIcon(ctx, top.type, cell.rad * 0.4);
  ctx.restore();
  if (cell.stack.length > 1) {
    ctx.fillStyle = INK_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "bold " + Math.round(cell.rad * 0.42) + 'px "Courier New", Consolas, monospace';
    ctx.fillText("x" + cell.stack.length, cell.x, cell.y + cell.rad * 0.86);
  }
}
function drawChessIcon(ctx, type, s, fill = "#FFFFFF") {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = "rgba(58,53,48,0.12)";
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const u = s;
  const fl = (p) => {
    ctx.beginPath();
    p();
    ctx.fill();
    ctx.stroke();
  };
  switch (type) {
    case "pawn":
      fl(() => {
        ctx.arc(0, -u * 0.4, u * 0.3, 0, Math.PI * 2);
      });
      fl(() => {
        ctx.moveTo(-u * 0.26, u * 0.55);
        ctx.lineTo(-u * 0.16, -u * 0.08);
        ctx.lineTo(u * 0.16, -u * 0.08);
        ctx.lineTo(u * 0.26, u * 0.55);
        ctx.closePath();
      });
      break;
    case "knight":
      fl(() => {
        ctx.moveTo(-u * 0.34, u * 0.5);
        ctx.lineTo(-u * 0.14, u * 0.08);
        ctx.lineTo(-u * 0.3, -u * 0.2);
        ctx.lineTo(0, -u * 0.5);
        ctx.quadraticCurveTo(u * 0.36, -u * 0.45, u * 0.2, u * 0.05);
        ctx.lineTo(u * 0.34, u * 0.5);
        ctx.closePath();
      });
      break;
    case "bishop":
      fl(() => {
        ctx.moveTo(-u * 0.28, u * 0.5);
        ctx.lineTo(-u * 0.12, -u * 0.08);
        ctx.quadraticCurveTo(0, -u * 0.52, u * 0.12, -u * 0.08);
        ctx.lineTo(u * 0.28, u * 0.5);
        ctx.closePath();
      });
      fl(() => {
        ctx.arc(0, -u * 0.48, u * 0.15, 0, Math.PI * 2);
      });
      break;
    case "rook":
      fl(() => {
        ctx.moveTo(-u * 0.3, u * 0.5);
        ctx.lineTo(-u * 0.3, -u * 0.12);
        ctx.lineTo(-u * 0.16, -u * 0.12);
        ctx.lineTo(-u * 0.16, -u * 0.4);
        ctx.lineTo(-u * 0.05, -u * 0.4);
        ctx.lineTo(-u * 0.05, -u * 0.16);
        ctx.lineTo(u * 0.05, -u * 0.16);
        ctx.lineTo(u * 0.05, -u * 0.4);
        ctx.lineTo(u * 0.16, -u * 0.4);
        ctx.lineTo(u * 0.16, -u * 0.12);
        ctx.lineTo(u * 0.3, -u * 0.12);
        ctx.lineTo(u * 0.3, u * 0.5);
        ctx.closePath();
      });
      break;
    case "queen":
      fl(() => {
        ctx.moveTo(-u * 0.34, u * 0.45);
        ctx.lineTo(-u * 0.34, -u * 0.1);
        ctx.lineTo(-u * 0.17, u * 0.12);
        ctx.lineTo(0, -u * 0.2);
        ctx.lineTo(u * 0.17, u * 0.12);
        ctx.lineTo(u * 0.34, -u * 0.1);
        ctx.lineTo(u * 0.34, u * 0.45);
        ctx.closePath();
      });
      fl(() => {
        ctx.arc(0, -u * 0.28, u * 0.1, 0, Math.PI * 2);
      });
      break;
    case "king":
      fl(() => {
        ctx.moveTo(-u * 0.34, u * 0.45);
        ctx.lineTo(-u * 0.34, -u * 0.1);
        ctx.lineTo(-u * 0.17, u * 0.12);
        ctx.lineTo(0, -u * 0.18);
        ctx.lineTo(u * 0.17, u * 0.12);
        ctx.lineTo(u * 0.34, -u * 0.1);
        ctx.lineTo(u * 0.34, u * 0.45);
        ctx.closePath();
      });
      fl(() => {
        ctx.arc(0, -u * 0.32, u * 0.12, 0, Math.PI * 2);
      });
      break;
    default:
      fl(() => {
        ctx.arc(0, 0, u * 0.4, 0, Math.PI * 2);
      });
  }
  ctx.restore();
}

// src/data/levels.ts
function activeColorsFor(level) {
  if (level <= 5) return 3;
  if (level <= 20) return 4;
  if (level <= 40) return 5;
  return 6;
}
function boardRadiusFor(level) {
  if (level <= 3) return 2;
  if (level <= 20) return 3;
  return 4;
}
function mechanicsFor(level, goal) {
  const ac = activeColorsFor(level);
  const lockedCells = level >= 8 ? Math.min(7, 2 + Math.floor((level - 8) / 6)) : 0;
  const decoyChance = level >= 14 && ac < 6 ? level >= 30 ? 0.18 : 0.12 : 0;
  const timeLimit = level >= 21 ? Math.min(200, 90 + goal * 6) : 0;
  const obstacles = level >= 31 ? level >= 41 ? 2 : 1 : 0;
  const mechanics = [];
  if (lockedCells > 0) mechanics.push("lockedCell");
  if (decoyChance > 0) mechanics.push("decoy");
  if (timeLimit > 0) mechanics.push("timed");
  if (obstacles > 0) mechanics.push("movingObstacle");
  return { mechanics, lockedCells, decoyChance, timeLimit, obstacles };
}
function generateLevels(count = 50) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const ac = activeColorsFor(i);
    const br = boardRadiusFor(i);
    const goal = i <= 5 ? 3 : 3 + Math.floor((i - 1) / 5);
    const traySlots = 3;
    const groupMin = 3;
    const groupMax = i <= 10 ? 5 : 6;
    const tutorial = i === 1 ? ["dragToEmpty"] : [];
    const m = mechanicsFor(i, goal);
    out.push({
      id: i,
      boardRadius: br,
      goal,
      activeColors: ac,
      traySlots,
      groupMin,
      groupMax,
      spawnBias: 0.7,
      eliminateAt: 10,
      mechanics: m.mechanics,
      lockedCells: m.lockedCells,
      decoyChance: m.decoyChance,
      timeLimit: m.timeLimit,
      obstacles: m.obstacles,
      tutorial,
      starThresholds: { steps: goal * 4, rescues: 0 }
    });
  }
  return out;
}
var levels = generateLevels(50);

// src/entities/board.ts
var COMBO_WINDOW = 2.5;
var ACCEPT_SCALE = 1.25;
var TRAY_R = 30;
var TRAY_SLOT_W = 92;
var TRAY_GROUPS = 3;
var FLY_INTERVAL = 0.11;
var FLY_DURATION = 0.24;
var ARC_HOP = 0.55;
var LAND_DURATION = 0.16;
var OB_STAY = 4;
var OB_OUT = 0.35;
var OB_IN = 0.35;
var TILT = 0.8;
var ROT_SENS = 8e-3;
var CELL_R_RATIO = 0.95;
var FONT_STACK = '"Courier New", Consolas, monospace';
function pxFont(size, bold = true) {
  return (bold ? "bold " : "") + Math.round(size) + "px " + FONT_STACK;
}
var MECHANIC_TIPS = {
  lockedCell: "\u9501\u683C\uFF1A\u7070\u8272\u5E26\u9501\u7684\u683C\u5B50\u4E0D\u53EF\u653E\u7F6E",
  decoy: "\u8BF1\u9975\u5B50\uFF1A\u6258\u76D8\u4F1A\u6DF7\u5165\u573A\u5916\u989C\u8272\u7684\u5E72\u6270\u68CB\u5B50",
  timed: "\u9650\u65F6\uFF1A\u5012\u8BA1\u65F6\u7ED3\u675F\u524D\u5B8C\u6210\u76EE\u6807\uFF01",
  movingObstacle: "\u79FB\u52A8\u969C\u788D\uFF1A\u7070\u8272\u68CB\u5B50\u5854\u4F1A\u5468\u671F\u6027\u6362\u4F4D"
};
function comboMul(c) {
  if (c <= 1) return 1;
  if (c === 2) return 1.2;
  if (c === 3) return 1.5;
  return 2;
}
var pieceIdSeq = 1;
function activeColorsList(k) {
  const n = Math.min(6, Math.max(3, k));
  return PIECES.slice(0, n).map((p) => p.color);
}
var Board = class {
  // 空白处拖动 → 旋转棋盘
  constructor(W, H) {
    this.cells = [];
    this.neighborIdx = [];
    // 预计算邻接表（buildLevel 时一次性生成）
    this.groups = [];
    this.particles = [];
    this.score = 0;
    this.level = 1;
    this.clearedTotal = 0;
    this.clearedColors = /* @__PURE__ */ new Set();
    this.levelGoal = 3;
    this.over = "none";
    this.failReason = "full";
    this.stars = 0;
    this.steps = 0;
    this.rescuesUsed = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.history = [];
    this.hint = null;
    this.toast = null;
    this.tutorial = false;
    this.tutorialArmed = false;
    this.checkmateFlash = 0;
    this.obstacles = [];
    this.timeLeft = 0;
    // 限时关倒计时（cfg.timeLimit=0 时不启用）
    this.viewAngle = 0;
    // 棋盘旋转角（rad）；空白处拖动改变
    this.boardCx = 0;
    this.boardCy = 0;
    // 棋盘中心（屏幕坐标，视角变换的轴心）
    this.traySlotW = TRAY_SLOT_W;
    this.trayY = 0;
    this.uiButtons = [];
    this.overlayButtons = [];
    this.failButtons = [];
    this.mergeAnim = null;
    this.storageGet = () => null;
    this.storageSet = () => {
    };
    this.save = { unlocked: 1, stars: {}, bestScore: 0, muted: false };
    this.audio = createNoopAudio();
    this.drag = null;
    this.rotating = null;
    this.W = W;
    this.H = H;
    this.trayY = H - 66;
    this.buildLevel(1);
  }
  typeOf(color) {
    return PIECES.find((p) => p.color === color)?.type || "pawn";
  }
  attachStorage(get, set) {
    this.storageGet = get;
    this.storageSet = set;
  }
  attachAudio(a) {
    this.audio = a;
    a.setMuted(this.save.muted);
  }
  loadSave() {
    try {
      const raw = this.storageGet("lbzj_save");
      if (raw) this.save = { ...this.save, ...JSON.parse(raw) };
    } catch {
    }
  }
  persist() {
    try {
      this.storageSet("lbzj_save", JSON.stringify(this.save));
    } catch {
    }
  }
  eliminateAt() {
    return this.cfg.eliminateAt;
  }
  // ── 视角变换：棋盘平面 ↔ 屏幕 ─────────────────────────────
  // screen = center + Squash(1,TILT) · Rotate(θ) · (board - center)
  // 先旋转（绕棋盘中心）再沿屏幕竖直方向压缩（固定俯角）→ 立体棋盘。
  boardToScreen(x, y) {
    const dx = x - this.boardCx;
    const dy = y - this.boardCy;
    const cos = Math.cos(this.viewAngle);
    const sin = Math.sin(this.viewAngle);
    return {
      x: this.boardCx + dx * cos - dy * sin,
      y: this.boardCy + (dx * sin + dy * cos) * TILT
    };
  }
  screenToBoard(x, y) {
    const u = x - this.boardCx;
    const v = (y - this.boardCy) / TILT;
    const cos = Math.cos(this.viewAngle);
    const sin = Math.sin(this.viewAngle);
    return {
      x: this.boardCx + u * cos + v * sin,
      y: this.boardCy - u * sin + v * cos
    };
  }
  buildLevel(level) {
    this.level = clamp(level, 1, levels.length);
    this.cfg = levels[this.level - 1];
    this.levelGoal = this.cfg.goal;
    this.clearedTotal = 0;
    this.clearedColors = /* @__PURE__ */ new Set();
    this.over = "none";
    this.steps = 0;
    this.rescuesUsed = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.history = [];
    this.hint = null;
    this.toast = null;
    this.tutorial = this.cfg.tutorial.includes("dragToEmpty");
    this.tutorialArmed = false;
    this.particles = [];
    this.checkmateFlash = 0;
    this.mergeAnim = null;
    this.drag = null;
    this.rotating = null;
    this.failReason = "full";
    this.timeLeft = this.cfg.timeLimit;
    this.obstacles = [];
    const coords = hexMap(this.cfg.boardRadius);
    this.boardCx = this.W / 2;
    this.boardCy = this.H * 0.4;
    const maxW = this.W * 0.95;
    const maxH = this.H * 0.66;
    const { size, ox, oy } = fitHexLayout(coords, this.boardCx, this.boardCy, maxW, maxH);
    this.cells = coords.map((c) => {
      const p = hexToPixel(c.q, c.r, size);
      return {
        q: c.q,
        r: c.r,
        x: p.x + ox,
        y: p.y + oy,
        rad: size * CELL_R_RATIO,
        locked: false,
        stack: [],
        highlight: 0,
        landT: 0
      };
    });
    this.neighborIdx = this.cells.map((c, i) => {
      const out = [];
      for (let j = 0; j < this.cells.length; j++) {
        if (i === j) continue;
        const o = this.cells[j];
        if (hexDistance({ q: c.q, r: c.r }, { q: o.q, r: o.r }) === 1) out.push(j);
      }
      return out;
    });
    if (this.cfg.lockedCells > 0) {
      const cand = this.cells.map((c, i) => ({ i, d: hexDistance({ q: c.q, r: c.r }, { q: 0, r: 0 }) })).filter((c) => c.d >= 1).map((c) => c.i);
      for (let n = cand.length - 1; n > 0; n--) {
        const k = Math.floor(Math.random() * (n + 1));
        [cand[n], cand[k]] = [cand[k], cand[n]];
      }
      for (let k = 0; k < Math.min(this.cfg.lockedCells, cand.length); k++) {
        this.cells[cand[k]].locked = true;
      }
    }
    for (let k = 0; k < this.cfg.obstacles; k++) this.spawnObstacle();
    this.showMechanicTips();
    this.groups = [];
    while (this.groups.length < TRAY_GROUPS) this.spawnGroup();
    this.relayoutTray();
    this.computeLayout();
  }
  // 障碍出生/换位：随机挑一个空且未锁、无其他障碍的格
  spawnObstacle() {
    const idx = this.pickObstacleCell(-1);
    if (idx < 0) return;
    this.obstacles.push({ idx, phase: "in", t: OB_IN, scale: 0 });
  }
  pickObstacleCell(exclude) {
    const cand = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (i === exclude) continue;
      const c = this.cells[i];
      if (c.locked || c.stack.length > 0) continue;
      if (this.obstacles.some((o) => o.idx === i)) continue;
      cand.push(i);
    }
    if (cand.length === 0) return exclude < 0 ? -1 : exclude;
    return cand[Math.floor(Math.random() * cand.length)];
  }
  // 某格当前是否被移动障碍遮挡（out 阶段视为已让开）
  isBlocked(idx) {
    return this.obstacles.some((o) => o.idx === idx && o.phase !== "out");
  }
  // 机制首次出现 → 弹一次轻提示并写入存档去重
  showMechanicTips() {
    for (const m of this.cfg.mechanics) {
      if (!this.save.tipShown) this.save.tipShown = {};
      if (this.save.tipShown[m]) continue;
      this.save.tipShown[m] = true;
      this.toast = { text: MECHANIC_TIPS[m] || m, t: 3 };
      this.persist();
      break;
    }
  }
  computeLayout() {
    const pad = 10;
    const bw = (this.W - 6 * pad) / 5;
    const bh = 34;
    const by = this.H - 122;
    this.uiButtons = [
      { id: "hint", label: "\u63D0\u793A", x: pad, y: by, w: bw, h: bh },
      { id: "undo", label: "\u64A4\u9500", x: pad * 2 + bw, y: by, w: bw, h: bh },
      { id: "shuffle", label: "\u6D17\u724C", x: pad * 3 + 2 * bw, y: by, w: bw, h: bh },
      { id: "restart", label: "\u91CD\u5F00", x: pad * 4 + 3 * bw, y: by, w: bw, h: bh },
      { id: "share", label: "\u5206\u4EAB", x: pad * 5 + 4 * bw, y: by, w: bw, h: bh }
    ];
    const ow = 150;
    const oh = 46;
    const oy = this.H * 0.62;
    this.overlayButtons = [
      { id: "next", label: "\u4E0B\u4E00\u5173", x: this.W / 2 - ow - 8, y: oy, w: ow, h: oh },
      { id: "replay", label: "\u91CD\u73A9", x: this.W / 2 + 8, y: oy, w: ow, h: oh }
    ];
    this.failButtons = [{ id: "restartFail", label: "\u91CD\u5F00\u672C\u5173", x: this.W / 2 - ow / 2, y: oy, w: ow, h: oh }];
  }
  collectBoardColors() {
    const s = /* @__PURE__ */ new Set();
    for (const c of this.cells) for (const t of c.stack) s.add(t.color);
    return s;
  }
  pickColor() {
    if (this.cfg.decoyChance > 0 && Math.random() < this.cfg.decoyChance) {
      const inactive = PIECES.slice(this.cfg.activeColors);
      if (inactive.length > 0) return inactive[Math.floor(Math.random() * inactive.length)].color;
    }
    const needed = this.collectBoardColors();
    if (needed.size > 0 && Math.random() < this.cfg.spawnBias) {
      const arr = Array.from(needed);
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const pool = activeColorsList(this.cfg.activeColors);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  makeTile(color) {
    return { color, type: this.typeOf(color) };
  }
  spawnGroup(slot) {
    const n = this.cfg.groupMin + Math.floor(Math.random() * (this.cfg.groupMax - this.cfg.groupMin + 1));
    const tiles = [];
    for (let i = 0; i < n; i++) tiles.push(this.makeTile(this.pickColor()));
    this.groups.push({
      id: pieceIdSeq++,
      tiles,
      slot: slot ?? this.groups.length,
      x: this.W / 2,
      y: this.H + 80,
      tx: this.W / 2,
      ty: this.H + 80,
      scale: 1,
      targetScale: 1
    });
  }
  refillGroups() {
    while (this.groups.length < TRAY_GROUPS) this.spawnGroup();
  }
  relayoutTray() {
    const n = this.groups.length;
    const w = this.traySlotW;
    const startX = this.W / 2 - (n - 1) * w / 2;
    this.groups.forEach((g, i) => {
      g.slot = i;
      g.tx = startX + i * w;
      g.ty = this.trayY;
    });
  }
  pointerDown(x, y) {
    if (this.over === "complete") {
      const b = this.overlayButtons.find((bt) => x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h);
      if (b && b.id === "next") this.buildLevel(this.level + 1);
      else if (b && b.id === "replay") this.buildLevel(this.level);
      else this.buildLevel(this.level + 1);
      return -1;
    }
    if (this.over === "fail") {
      const b = this.failButtons.find((bt) => x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h);
      if (b && b.id === "restartFail") this.buildLevel(this.level);
      return -1;
    }
    if (this.mergeAnim) {
      this.rotating = { lastX: x };
      return -1;
    }
    const btn = this.uiButtons.find((bt) => x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h);
    if (btn) {
      this.handleButton(btn.id);
      return -1;
    }
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const g = this.groups[i];
      const step = TRAY_R * STACK_STEP_RATIO;
      const top = g.y - (g.tiles.length - 1) * step;
      if (x >= g.x - TRAY_R && x <= g.x + TRAY_R && y >= top - TRAY_R && y <= g.y + TRAY_R) {
        this.pushHistory();
        this.groups.splice(i, 1);
        g.scale = 1.15;
        g.targetScale = 1.15;
        this.drag = { group: g };
        this.audio.play("pick");
        return g.id;
      }
    }
    this.rotating = { lastX: x };
    return -1;
  }
  pointerMove(x, y) {
    if (this.rotating) {
      this.viewAngle += (x - this.rotating.lastX) * ROT_SENS;
      this.rotating.lastX = x;
      return;
    }
    if (this.drag) {
      this.drag.group.tx = x;
      this.drag.group.ty = y - 30;
    }
  }
  pointerUp(x, y) {
    this.rotating = null;
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const group = drag.group;
    group.scale = 1;
    group.targetScale = 1;
    if (this.over !== "none") {
      this.bounceGroup(group);
      return;
    }
    const p = this.screenToBoard(x, y);
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) {
      this.bounceGroup(group);
      return;
    }
    const cell = this.cells[bestIdx];
    const acceptR2 = cell.rad * ACCEPT_SCALE * (cell.rad * ACCEPT_SCALE);
    if (bestD > acceptR2 || cell.stack.length > 0 || cell.locked || this.isBlocked(bestIdx)) {
      this.bounceGroup(group);
      return;
    }
    cell.stack = group.tiles.map((t) => ({ ...t }));
    cell.highlight = 1;
    cell.landT = LAND_DURATION;
    this.score += 5 * group.tiles.length;
    this.steps++;
    this.refillGroups();
    this.relayoutTray();
    this.audio.play("place");
    if (this.tutorial && !this.tutorialArmed) this.tutorialArmed = true;
    this.resolveBoard(bestIdx);
    this.checkFail();
  }
  bounceGroup(group) {
    this.audio.play("bounce");
    this.groups.push(group);
    this.relayoutTray();
  }
  getNeighbors(cellIdx) {
    return this.neighborIdx[cellIdx].map((j) => ({ idx: j, cell: this.cells[j] }));
  }
  // —— 逐色合并/消除核心（M3-K：仅顶层色参与邻接） ——
  // 合并以"顶层颜色"为单位：仅当相邻格的【最上层】棋子同色才触发；
  // 触发后来源格【整摞】（含埋藏色）飞向锚格叠高，埋藏色保持原顺序。
  // 消除改为单格判定：某一格内同色累计 ≥ eliminateAt(10) 即消除该色。
  topColor(idx) {
    const st = this.cells[idx].stack;
    return st.length > 0 ? st[st.length - 1].color : null;
  }
  allBoardColors() {
    const s = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.cells.length; i++) {
      const t = this.topColor(i);
      if (t) s.add(t);
    }
    return Array.from(s);
  }
  firstCellWith(color) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.topColor(i) === color) return i;
    }
    return -1;
  }
  // 以 seed 为起点，找出"顶层为 color"的连通分量
  colorComponent(color, seed) {
    if (seed < 0 || this.topColor(seed) !== color) return [];
    const seen = /* @__PURE__ */ new Set([seed]);
    const queue = [seed];
    const comp = [seed];
    while (queue.length) {
      const cur = queue.shift();
      for (const j of this.neighborIdx[cur]) {
        if (seen.has(j)) continue;
        if (this.topColor(j) === color) {
          seen.add(j);
          queue.push(j);
          comp.push(j);
        }
      }
    }
    return comp;
  }
  chooseAnchor(comp, placedIdx) {
    if (comp.includes(placedIdx)) return placedIdx;
    let best = comp[0];
    let bestLen = -1;
    for (const idx of comp) {
      const n = this.cells[idx].stack.length;
      if (n > bestLen) {
        bestLen = n;
        best = idx;
      }
    }
    return best;
  }
  // 优先合并：选一个"顶层同色且分散（>1 格）"的颜色，整摞飞叠到锚格
  pickConsolidateColor(placedIdx) {
    const colors = this.allBoardColors();
    let preferred = null;
    for (const c of colors) {
      const seed = placedIdx >= 0 && this.topColor(placedIdx) === c ? placedIdx : this.firstCellWith(c);
      const comp = this.colorComponent(c, seed);
      if (comp.length > 1) {
        if (comp.includes(placedIdx)) return c;
        if (!preferred) preferred = c;
      }
    }
    return preferred;
  }
  // 找一个"单格内同色 ≥ 消除阈值"的格（合并会把同顶层色收拢到一格，故只需单格判定）
  pickClearIdx() {
    for (let i = 0; i < this.cells.length; i++) {
      const st = this.cells[i].stack;
      if (st.length === 0) continue;
      const tally = /* @__PURE__ */ new Map();
      for (const t of st) tally.set(t.color, (tally.get(t.color) ?? 0) + 1);
      for (const [color, n] of tally) {
        if (n >= this.eliminateAt()) return { idx: i, color };
      }
    }
    return null;
  }
  // 放置/消除后的统一结算：先整摞收拢、再消除，循环直到稳定
  resolveBoard(placedIdx) {
    if (this.over !== "none") return;
    if (this.mergeAnim) return;
    const colC = this.pickConsolidateColor(placedIdx);
    if (colC) {
      const seed = placedIdx >= 0 && this.topColor(placedIdx) === colC ? placedIdx : this.firstCellWith(colC);
      const comp = this.colorComponent(colC, seed);
      const anchor = this.chooseAnchor(comp, placedIdx);
      this.startConsolidate(colC, comp, anchor, placedIdx);
      return;
    }
    const clr = this.pickClearIdx();
    if (clr) {
      this.clearCellColor(clr.idx, clr.color);
      this.resolveBoard(placedIdx);
    }
  }
  // 兼容老调用：模拟"idx 处刚放入"触发结算
  tryMergeFrom(idx) {
    this.resolveBoard(idx);
  }
  startConsolidate(color, comp, anchorIdx, placedIdx) {
    const flights = [];
    const baseLen = this.cells[anchorIdx].stack.length;
    let k = 0;
    for (const idx of comp) {
      if (idx === anchorIdx) continue;
      const src = this.cells[idx];
      const step = src.rad * STACK_STEP_RATIO;
      for (let j = 0; j < src.stack.length; j++) {
        flights.push({ srcIdx: idx, tile: src.stack[j], sx: src.x, sy: src.y - j * step, layer: baseLen + k });
        k++;
      }
      src.stack = [];
    }
    if (flights.length === 0) return;
    this.mergeAnim = { destIdx: anchorIdx, color, flights, baseLen, spawnIdx: 0, nextSpawn: 0, flying: [], placedIdx };
  }
  update(dt) {
    for (const g of this.groups) {
      g.x = lerp(g.x, g.tx, clamp(dt * 9, 0, 1));
      g.y = lerp(g.y, g.ty, clamp(dt * 9, 0, 1));
      g.scale = lerp(g.scale, g.targetScale, clamp(dt * 14, 0, 1));
    }
    if (this.drag) {
      const k = clamp(dt * 20, 0, 1);
      const g = this.drag.group;
      g.x = lerp(g.x, g.tx, k);
      g.y = lerp(g.y, g.ty, k);
      g.scale = lerp(g.scale, g.targetScale, clamp(dt * 16, 0, 1));
    }
    for (const c of this.cells) {
      if (c.highlight > 0) c.highlight = Math.max(0, c.highlight - dt * 2);
      if (c.landT > 0) c.landT = Math.max(0, c.landT - dt);
    }
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 400 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.hint) {
      this.hint.t -= dt;
      if (this.hint.t <= 0) this.hint = null;
    }
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    if (this.checkmateFlash > 0) this.checkmateFlash = Math.max(0, this.checkmateFlash - dt);
    this.updateObstacles(dt);
    this.updateTimer(dt);
    if (this.mergeAnim) this.updateMerge(dt);
  }
  // 移动障碍状态机：stay(OB_STAY) → out(缩出) → 换格 → in(缩入) → stay
  updateObstacles(dt) {
    for (const ob of this.obstacles) {
      ob.t -= dt;
      if (ob.phase === "stay") {
        if (ob.t <= 0) {
          ob.phase = "out";
          ob.t = OB_OUT;
        }
      } else if (ob.phase === "out") {
        ob.scale = clamp(ob.t / OB_OUT, 0, 1);
        if (ob.t <= 0) {
          ob.idx = this.pickObstacleCell(ob.idx);
          ob.phase = "in";
          ob.t = OB_IN;
        }
      } else {
        ob.scale = clamp(1 - ob.t / OB_IN, 0, 1);
        if (ob.t <= 0) {
          ob.phase = "stay";
          ob.t = OB_STAY;
          ob.scale = 1;
        }
      }
    }
  }
  // 限时倒计时：合并动画播放期间暂停（此时玩家无法操作）；最后 5s 逐秒 tick 提醒
  updateTimer(dt) {
    if (this.cfg.timeLimit <= 0 || this.over !== "none" || this.mergeAnim) return;
    const prev = Math.ceil(this.timeLeft);
    this.timeLeft -= dt;
    const now = Math.ceil(this.timeLeft);
    if (now !== prev && now > 0 && now <= 5) this.audio.play("tick");
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.over = "fail";
      this.failReason = "timeout";
      this.onLevelFail?.(this.level);
      this.audio.play("bounce");
      this.toast = { text: "\u65F6\u95F4\u5230", t: 2 };
    }
  }
  updateMerge(dt) {
    const m = this.mergeAnim;
    m.nextSpawn -= dt;
    while (m.nextSpawn <= 0 && m.spawnIdx < m.flights.length) {
      const fl = m.flights[m.spawnIdx];
      const dest = this.cells[m.destIdx];
      const step = dest.rad * STACK_STEP_RATIO;
      const ty = dest.y - fl.layer * step;
      m.flying.push({
        color: fl.tile.color,
        type: fl.tile.type,
        sx: fl.sx,
        sy: fl.sy,
        x: fl.sx,
        y: fl.sy,
        tx: dest.x,
        ty,
        arcH: dest.rad * ARC_HOP,
        t: 0,
        duration: FLY_DURATION,
        done: false,
        sourceIdx: fl.srcIdx,
        destIdx: m.destIdx,
        layer: fl.layer
      });
      m.spawnIdx++;
      m.nextSpawn += FLY_INTERVAL;
    }
    for (const f of m.flying) {
      if (f.done) continue;
      f.t += dt;
      const u = Math.min(1, f.t / f.duration);
      const e = 1 - (1 - u) * (1 - u);
      const bx = lerp(f.sx, f.tx, e);
      const by = lerp(f.sy, f.ty, e);
      f.x = bx;
      f.y = by - f.arcH * Math.sin(u * Math.PI);
      if (f.t >= f.duration) f.done = true;
    }
    const arrived = m.flying.filter((f) => f.done);
    for (const f of arrived) {
      const dest = this.cells[f.destIdx];
      dest.stack.push({ color: f.color, type: f.type });
      dest.landT = LAND_DURATION;
      dest.highlight = Math.max(dest.highlight, 0.5);
      this.audio.play("merge", { step: dest.stack.length - 1 });
    }
    m.flying = m.flying.filter((f) => !f.done);
    if (m.spawnIdx >= m.flights.length && m.flying.length === 0) {
      this.mergeAnim = null;
      this.resolveBoard(m.placedIdx);
    }
  }
  clearCellColor(idx, color) {
    if (this.comboTimer > 0) this.combo++;
    else this.combo = 1;
    this.comboTimer = COMBO_WINDOW;
    this.score += Math.round(100 * comboMul(this.combo));
    this.clearedTotal++;
    this.clearedColors.add(color);
    const cell = this.cells[idx];
    const before = cell.stack.length;
    cell.stack = cell.stack.filter((t) => t.color !== color);
    this.spawnParticles(cell.x, cell.y, color, Math.min(22, before));
    cell.highlight = 1;
    this.audio.play("clear");
    if (this.clearedColors.size >= 6) {
      this.score += 200;
      this.checkmateFlash = 1.6;
      this.toast = { text: "\u5C06\u6740 Checkmate!", t: 1.6 };
      this.audio.play("checkmate");
      this.clearedColors = /* @__PURE__ */ new Set();
    }
    if (this.clearedTotal >= this.levelGoal) this.completeLevel();
  }
  completeLevel() {
    this.over = "complete";
    const stepOk = this.steps <= this.cfg.starThresholds.steps;
    const rescueOk = this.rescuesUsed <= this.cfg.starThresholds.rescues;
    let s = 1;
    if (stepOk || rescueOk) s = 2;
    if (stepOk && rescueOk) s = 3;
    this.stars = s;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(levels.length, this.level + 1));
    const prev = this.save.stars[this.level] || 0;
    this.save.stars[this.level] = Math.max(prev, s);
    this.save.bestScore = Math.max(this.save.bestScore, this.score);
    this.persist();
    this.onLevelComplete?.(this.level, this.stars, this.score);
    this.audio.play("win");
  }
  checkFail() {
    if (this.over !== "none") return;
    if (this.mergeAnim) return;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.locked || this.isBlocked(i)) continue;
      if (c.stack.length === 0) return;
    }
    this.over = "fail";
    this.failReason = "full";
    this.onLevelFail?.(this.level);
    this.audio.play("bounce");
    this.toast = { text: "\u683C\u6EE1\u5931\u8D25", t: 2 };
  }
  pushHistory() {
    const snap = {
      cells: this.cells.map((c) => ({ stack: [...c.stack] })),
      groups: this.groups.map((g) => ({ ...g, tiles: g.tiles.map((t) => ({ ...t })) })),
      score: this.score,
      clearedTotal: this.clearedTotal,
      clearedColors: Array.from(this.clearedColors),
      combo: this.combo,
      comboTimer: this.comboTimer,
      level: this.level,
      levelGoal: this.levelGoal,
      steps: this.steps
    };
    this.history.push(snap);
    if (this.history.length > 30) this.history.shift();
  }
  doUndo() {
    const snap = this.history.pop();
    if (!snap) {
      this.toast = { text: "\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u6B65\u9AA4", t: 1.4 };
      return;
    }
    for (let i = 0; i < this.cells.length; i++) {
      const s = snap.cells[i];
      if (!s) continue;
      this.cells[i].stack = [...s.stack];
      this.cells[i].highlight = 0;
      this.cells[i].landT = 0;
    }
    this.groups = snap.groups.map((g) => ({ ...g, tiles: g.tiles.map((t) => ({ ...t })) }));
    this.score = snap.score;
    this.clearedTotal = snap.clearedTotal;
    this.clearedColors = new Set(snap.clearedColors);
    this.combo = snap.combo;
    this.comboTimer = snap.comboTimer;
    this.level = snap.level;
    this.levelGoal = snap.levelGoal;
    this.steps = snap.steps;
    this.mergeAnim = null;
    this.over = "none";
    this.relayoutTray();
    this.audio.play("click");
  }
  doShuffle() {
    if (this.over !== "none") return;
    const needed = this.collectBoardColors();
    const pool = needed.size > 0 ? Array.from(needed) : activeColorsList(this.cfg.activeColors);
    for (const g of this.groups) {
      for (const t of g.tiles) {
        const c = pool[Math.floor(Math.random() * pool.length)];
        t.color = c;
        t.type = this.typeOf(c);
      }
    }
    this.relayoutTray();
    this.rescuesUsed++;
    this.toast = { text: "\u5DF2\u6D17\u724C", t: 1.2 };
    this.audio.play("click");
  }
  doHint() {
    const mv = this.findValidMove();
    if (!mv) {
      this.toast = { text: "\u6682\u65E0\u53EF\u8D70\u6B65\uFF0C\u8BD5\u8BD5\u6D17\u724C", t: 1.6 };
      return;
    }
    this.hint = { cellIdx: mv.cellIdx, t: 3 };
    this.rescuesUsed++;
    this.audio.play("hint");
  }
  findValidMove() {
    const trayColors = /* @__PURE__ */ new Set();
    for (const g of this.groups) for (const t of g.tiles) trayColors.add(t.color);
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.stack.length > 0 || c.locked || this.isBlocked(i)) continue;
      for (const j of this.neighborIdx[i]) {
        const n = this.cells[j];
        if (n.stack.length > 0) {
          const col = n.stack.find((t) => trayColors.has(t.color));
          if (col) return { cellIdx: i, color: col.color };
        }
      }
    }
    return null;
  }
  hasValidMove() {
    if (this.mergeAnim) return false;
    if (this.over !== "none") return false;
    for (const c of this.cells) {
      if (!c.locked && c.stack.length === 0) return this.groups.length > 0;
    }
    return false;
  }
  handleButton(id) {
    this.audio.play("click");
    if (id === "hint") this.doHint();
    else if (id === "undo") this.doUndo();
    else if (id === "shuffle") this.doShuffle();
    else if (id === "restart") this.buildLevel(this.level);
    else if (id === "share") this.onShare?.();
  }
  spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        color,
        size: 4 + Math.random() * 4
      });
    }
  }
  gotoLevel(n) {
    const l = Math.max(1, Math.min(levels.length, Math.floor(n) || 1));
    this.buildLevel(l);
  }
  render(ctx) {
    drawBackground(ctx, this.W, this.H);
    ctx.save();
    ctx.translate(this.boardCx, this.boardCy);
    ctx.scale(1, TILT);
    ctx.rotate(this.viewAngle);
    ctx.translate(-this.boardCx, -this.boardCy);
    const order = this.cells.map((c, i) => ({ i, sy: this.boardToScreen(c.x, c.y).y })).sort((a, b) => a.sy - b.sy);
    for (const o of order) {
      drawCellStack(ctx, this.cells[o.i]);
      const ob = this.obstacles.find((q) => q.idx === o.i);
      if (ob && ob.scale > 0.02) {
        const c = this.cells[o.i];
        const bob = Math.sin(Date.now() / 300 + o.i) * 2.5;
        drawObstacle(ctx, c.x, c.y - c.rad * 0.08 + bob, c.rad * 0.92 * ob.scale);
      }
    }
    if (this.hint) {
      const c = this.cells[this.hint.cellIdx];
      if (c) {
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 150);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#FFC93C";
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.rad * 1.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (this.mergeAnim) {
      for (const f of this.mergeAnim.flying) {
        drawFlyingTile(ctx, f.x, f.y, this.cells[f.sourceIdx].rad * 0.9, f.color, f.type);
      }
    }
    ctx.save();
    for (const pt of this.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    drawTrayShelf(ctx, this.W, this.H);
    for (const g of this.groups) drawPieceStack(ctx, g.x, g.y, TRAY_R, g.tiles, g.scale, 1);
    if (this.drag) {
      const g = this.drag.group;
      drawPieceStack(ctx, g.x, g.y, TRAY_R, g.tiles, g.scale, 1);
    }
    this.renderHud(ctx);
    this.renderToolbar(ctx);
    if (this.tutorial && !this.tutorialArmed) this.renderTutorial(ctx);
    if (this.toast) this.renderToast(ctx);
    if (this.over === "complete") this.renderComplete(ctx);
    if (this.over === "fail") this.renderFail(ctx);
    if (this.checkmateFlash > 0) this.renderCheckmate(ctx);
  }
  renderHud(ctx) {
    ctx.fillStyle = INK_COLOR;
    ctx.font = pxFont(19);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("\u5173\u5361 " + this.level, 16, 14);
    ctx.textAlign = "right";
    ctx.fillText("\u5206\u6570 " + this.score, this.W - 16, 14);
    ctx.textAlign = "center";
    ctx.font = pxFont(14, false);
    ctx.fillText("\u76EE\u6807 " + this.clearedTotal + "/" + this.levelGoal, this.W / 2, 16);
    if (this.combo >= 2) {
      ctx.fillStyle = "#E8635A";
      ctx.font = pxFont(13);
      ctx.fillText("\u8FDE\u51FB x" + comboMul(this.combo), this.W / 2, 38);
    }
    if (this.cfg.timeLimit > 0 && this.over === "none") {
      const t = Math.max(0, Math.ceil(this.timeLeft));
      const danger = this.timeLeft <= 10;
      ctx.fillStyle = danger ? "#E8635A" : "#9b9389";
      ctx.font = pxFont(13, danger);
      ctx.textAlign = "left";
      ctx.fillText("\u65F6\u95F4 " + t + "s", 16, 40);
    }
    ctx.fillStyle = "#9b9389";
    ctx.font = pxFont(10, false);
    ctx.textAlign = "right";
    ctx.fillText("\u6700\u4F73 " + this.save.bestScore, this.W - 16, 38);
  }
  renderToolbar(ctx) {
    for (const b of this.uiButtons) {
      if (b.id === "share") this.drawButton(ctx, b, "#FFC93C", "#3A3530");
      else this.drawButton(ctx, b, "#EFE6D8", INK_COLOR);
    }
  }
  // 像素风按钮：亮边框 + 主体 + 底部暗边（硬边斜面，无圆角无抗锯齿）
  drawButton(ctx, b, bg, fg) {
    ctx.fillStyle = shade(bg, 16);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = bg;
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = shade(bg, -20);
    ctx.fillRect(b.x + 2, b.y + b.h - 5, b.w - 4, 3);
    ctx.fillStyle = fg;
    ctx.font = pxFont(14);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  renderTutorial(ctx) {
    const mv = this.findValidMove();
    if (!mv) return;
    const c = this.cells[mv.cellIdx];
    const group = this.groups.find((g) => g.tiles.some((t) => t.color === mv.color)) || this.groups[0];
    if (!c || !group) return;
    const cp = this.boardToScreen(c.x, c.y);
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = "#3FB68B";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(group.x, group.y - 40);
    ctx.lineTo(cp.x, cp.y + c.rad * TILT + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#3FB68B";
    ctx.font = pxFont(12);
    ctx.textAlign = "center";
    ctx.fillText("\u62D6\u5230\u7A7A\u683C \u2192", (group.x + cp.x) / 2, (group.y + cp.y) / 2 - 30);
    ctx.restore();
  }
  renderToast(ctx) {
    if (!this.toast) return;
    const a = clamp(this.toast.t, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const tw = 230;
    const th = 42;
    const tx = this.W / 2 - tw / 2;
    const ty = this.H * 0.5 - th / 2;
    ctx.fillStyle = "rgba(58,53,48,0.88)";
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(tx, ty, tw, 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = pxFont(13);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.toast.text, this.W / 2, this.H * 0.5);
    ctx.restore();
  }
  renderComplete(ctx) {
    ctx.fillStyle = "rgba(58,53,48,0.82)";
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = pxFont(28);
    ctx.fillText("\u7B2C " + this.level + " \u5173\u5B8C\u6210\uFF01", this.W / 2, this.H * 0.34);
    ctx.font = "36px " + FONT_STACK;
    const starY = this.H * 0.46;
    for (let i = 0; i < 3; i++) {
      const sx = this.W / 2 + (i - 1) * 54;
      ctx.fillStyle = i < this.stars ? "#FFC93C" : "rgba(255,255,255,0.25)";
      ctx.fillText("\u2605", sx, starY);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.font = pxFont(14, false);
    ctx.fillText("\u5F97\u5206 " + this.score + "  \u6700\u4F73 " + this.save.bestScore, this.W / 2, this.H * 0.54);
    for (const b of this.overlayButtons) this.drawButton(ctx, b, "#FFC93C", "#3A3530");
  }
  renderFail(ctx) {
    ctx.fillStyle = "rgba(58,53,48,0.82)";
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = "#E8635A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = pxFont(28);
    const isTimeout = this.failReason === "timeout";
    ctx.fillText(isTimeout ? "\u65F6\u95F4\u5230" : "\u683C\u6EE1\u5931\u8D25", this.W / 2, this.H * 0.36);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = pxFont(13, false);
    ctx.fillText(isTimeout ? "\u5012\u8BA1\u65F6\u7ED3\u675F\uFF0C\u91CD\u5F00\u4E0D\u7F5A\u5206" : "\u68CB\u76D8\u88AB\u6CBE\u6EE1\uFF0C\u65E0\u6CD5\u7EE7\u7EED\u6D88\u9664", this.W / 2, this.H * 0.44);
    for (const b of this.failButtons) this.drawButton(ctx, b, "#FFC93C", "#3A3530");
  }
  renderCheckmate(ctx) {
    const a = clamp(this.checkmateFlash / 1.6, 0, 1);
    const ease = a * a;
    ctx.save();
    ctx.globalAlpha = ease * 0.5;
    ctx.fillStyle = "#FFD86B";
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.translate(this.W / 2, this.H / 2);
    const scale = 0.7 + ease * 0.5;
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = pxFont(40);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(255,233,168,0.9)";
    ctx.strokeText("\u5C06\u6740 CHECKMATE!", 0, 0);
    ctx.fillStyle = "#3A3530";
    ctx.fillText("\u5C06\u6740 CHECKMATE!", 0, 0);
    ctx.restore();
  }
};

// src/game.ts
function runGame(platform) {
  const canvas = platform.getCanvas();
  const ctx = canvas.getContext("2d");
  const screen = platform.getScreenSize();
  const PIXEL2 = 2;
  const W = Math.round(screen.width);
  const H = Math.round(screen.height);
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;
  const bw = Math.ceil(W / PIXEL2);
  const bh = Math.ceil(H / PIXEL2);
  const buffer = platform.createCanvas(bw, bh);
  const bctx = buffer.getContext("2d");
  const board = new Board(W, H);
  board.attachStorage(
    (k) => platform.storageGet(k),
    (k, v) => platform.storageSet(k, v)
  );
  board.loadSave();
  board.attachAudio(platform.audio ?? createNoopAudio());
  const SHOW_BANNER = false;
  const INTERSTITIAL_EVERY = 3;
  if (platform.share) {
    platform.share.enableShare({ title: "\u516D\u8FB9\u667A\u5C06 \xB7 \u76CA\u667A\u89E3\u8C1C\uFF0C\u6765\u6311\u6218\u4F60\u7684\u8111\u529B\uFF01", query: "from=share" });
    board.onShare = () => platform.share?.share({ title: "\u516D\u8FB9\u667A\u5C06 \xB7 \u76CA\u667A\u89E3\u8C1C\uFF0C\u6765\u6311\u6218\u4F60\u7684\u8111\u529B\uFF01" });
  }
  if (platform.ads && SHOW_BANNER) platform.ads.showBanner();
  board.onLevelComplete = (lvl, _stars, score) => {
    platform.cloud?.submitScore(score, lvl);
    if (platform.ads && lvl % INTERSTITIAL_EVERY === 0) platform.ads.showInterstitial();
  };
  const lq = platform.launchQuery?.();
  if (lq && lq.level) board.gotoLevel(Number(lq.level));
  platform.onPointerDown((p) => {
    platform.audio?.resume();
    board.pointerDown(p.x, p.y);
  });
  platform.onPointerMove((p) => board.pointerMove(p.x, p.y));
  platform.onPointerUp((p) => board.pointerUp(p.x, p.y));
  let last = Date.now();
  function frame() {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1e3);
    last = now;
    board.update(dt);
    bctx.setTransform(1 / PIXEL2, 0, 0, 1 / PIXEL2, 0, 0);
    board.render(bctx);
    ctx.drawImage(buffer, 0, 0, bw, bh, 0, 0, bw * PIXEL2, bh * PIXEL2);
    platform.raf(frame);
  }
  platform.raf(frame);
  platform.log("\u516D\u8FB9\u667A\u5C06 M3-K \u5DF2\u542F\u52A8\uFF08\u50CF\u7D20\u7BA1\u7EBF + \u53EF\u65CB\u8F6C\u7ACB\u4F53\u68CB\u76D8\uFF09");
}

// src/main.ts
runGame(createWxPlatform());
