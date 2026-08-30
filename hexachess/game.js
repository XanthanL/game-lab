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
      return new Promise((resolve2) => {
        if (!AD_UNIT.rewarded || !wxReady()) {
          resolve2(false);
          return;
        }
        try {
          const ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT.rewarded });
          ad.onClose((res) => resolve2(!!(res && res.isEnded)));
          ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => resolve2(false)));
        } catch {
          resolve2(false);
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
    tick: () => tone({ freq: 1250, start: 0, dur: 0.045, type: "square", peak: 0.07 }),
    // 判负：低频三连下行，明确「这局堵死了」但不刺耳
    fail: () => {
      tone({ freq: 220, start: 0, dur: 0.16, type: "sine", peak: 0.16, slideTo: 165 });
      tone({ freq: 165, start: 0.15, dur: 0.22, type: "sine", peak: 0.13, slideTo: 110 });
    }
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
        map[name](opts?.step ?? 0);
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
    // 小游戏没有公开的「减少动态效果」开关，恒报 false
    prefersReducedMotion: () => false,
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

// src/view/layout.ts
function rect(x, y, w, h) {
  return { x, y, w, h };
}
function inset(r, d) {
  return { x: r.x + d, y: r.y + d, w: Math.max(0, r.w - 2 * d), h: Math.max(0, r.h - 2 * d) };
}
function contains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function vstack(box, specs, gap = 0) {
  const out = {};
  let fixed = 0;
  let flexSum = 0;
  for (const s of specs) {
    if (s.h != null) fixed += s.h;
    else flexSum += s.flex || 1;
  }
  const gaps = Math.max(0, specs.length - 1) * gap;
  const rest = Math.max(0, box.h - fixed - gaps);
  let y = box.y;
  let usedFlex = 0;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const h = s.h != null ? s.h : flexSum ? rest * (s.flex || 1) / flexSum : 0;
    const inner = s.pad ? inset(rect(box.x, y, box.w, h), s.pad) : rect(box.x, y, box.w, h);
    out[s.id] = inner;
    usedFlex += h;
    y += h + gap;
  }
  if (flexSum > 0 && specs.length) {
    const last = specs[specs.length - 1];
    if (last.flex != null || last.h == null) {
      const r = out[last.id];
      r.h = Math.max(0, r.h + (box.y + box.h - (r.y + r.h)));
    }
  }
  return out;
}
function hslice(box, n, gap = 0) {
  const out = [];
  const total = Math.max(1, n);
  const w = Math.max(0, (box.w - gap * (total - 1)) / total);
  for (let i = 0; i < total; i++)
    out.push(rect(box.x + i * (w + gap), box.y, w, box.h));
  return out;
}
var HitTree = class {
  constructor() {
    this.items = [];
  }
  clear() {
    this.items.length = 0;
  }
  add(id, r, z = 0) {
    this.items.push({ id, r, z });
  }
  pick(x, y) {
    let best = null;
    for (const it of this.items) {
      if (!contains(it.r, x, y)) continue;
      if (!best || it.z >= best.z) best = it;
    }
    return best ? best.id : null;
  }
};
function roundRectPath(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}

// src/core/colors.ts
var PIECES = [
  { type: "pawn", name: "\u5175", color: "#F2766C", deep: "#C94F46" },
  { type: "knight", name: "\u9A6C", color: "#5E97F8", deep: "#3B6FD0" },
  { type: "bishop", name: "\u8C61", color: "#43C08E", deep: "#2A9669" },
  { type: "rook", name: "\u8F66", color: "#F7BE55", deep: "#D19432" },
  { type: "queen", name: "\u540E", color: "#A87DE0", deep: "#7E54B8" },
  { type: "king", name: "\u738B", color: "#54CBDD", deep: "#2FA1B4" }
];
var BG_COLOR = "#FBF7F0";
var INK_COLOR = "#43392F";
var SUB_COLOR = "#A79B8C";
var PANEL_COLOR = "#FFFFFF";
var FONT_STACK = '-apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif';
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

// src/render/theme.ts
var DUR = {
  place: 180,
  mergePiece: 220,
  mergeStagger: 70,
  ghostFade: 160,
  clear: 260,
  lightShaft: 300,
  fail: 480,
  win: 600,
  starPop: 180,
  overlay: 240,
  hitStopCascade: 40,
  hitStopClear: 60,
  hitStopWin: 80,
  inputLockClear: 150
};
var UI = {
  radius: 14,
  radiusSmall: 9,
  gap: 10,
  hud: 84,
  tray: 108,
  toolbar: 56,
  minFont: 13,
  // DPR1 下中文可读下限
  liftDrag: 42
  // 拖拽抬升：绘制与命中共用同一个值（现版两处不同导致「看到≠命中」）
};
var COLOR = {
  bg: BG_COLOR,
  ink: INK_COLOR,
  sub: SUB_COLOR,
  panel: PANEL_COLOR,
  ok: "#3FB68B",
  // 整摞可落
  part: "#F7BE55",
  // 只能部分转移
  bad: "rgba(120,110,100,0.55)",
  // 非法
  socket: "#EFE7DA",
  // 空格内壁
  socketEdge: "#E0D5C4",
  locked: "#CFC6B8",
  obstacle: "#9A8F80",
  shadow: "rgba(70,55,40,0.16)"
};
var SKINS = PIECES.map((p) => ({
  color: p.color,
  deep: p.deep,
  name: p.name,
  type: p.type,
  light: shade(p.color, 22)
}));
function skin(ci) {
  return SKINS[(ci % SKINS.length + SKINS.length) % SKINS.length];
}
function font(size, bold = false) {
  const px = Math.max(UI.minFont, Math.round(size));
  return (bold ? "700 " : "500 ") + px + "px " + FONT_STACK;
}

// src/render/sprites.ts
function createKit(make) {
  return { make, faces: /* @__PURE__ */ new Map() };
}
function r2(n) {
  return Math.round(n * 100) / 100;
}
function faceSprite(kit, s, d) {
  const key2 = s.type + "@" + d;
  const cached = kit.faces.get(key2);
  if (cached) return cached;
  const c = kit.make(d, d);
  const g = c.getContext("2d");
  const r = d / 2;
  const grd = g.createRadialGradient(r * 0.66, r * 0.6, r * 0.1, r, r, r);
  grd.addColorStop(0, s.light);
  grd.addColorStop(0.55, s.color);
  grd.addColorStop(1, s.deep);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(r, r, r - 1, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = Math.max(1, r * 0.09);
  g.beginPath();
  g.arc(r, r, r * 0.78, Math.PI * 1.06, Math.PI * 1.62);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.14)";
  g.lineWidth = 1;
  g.beginPath();
  g.arc(r, r, r - 1, 0, Math.PI * 2);
  g.stroke();
  kit.faces.set(key2, c);
  return c;
}
function drawTower(ctx, kit, x, y, r, ci, h, anim = {}) {
  if (h <= 0) return;
  const s = skin(ci);
  const alpha = anim.alpha == null ? 1 : anim.alpha;
  const scale = anim.scale == null ? 1 : anim.scale;
  const layerH = Math.max(3, r * 0.3);
  const topR = r * Math.pow(0.94, Math.min(h, 10) - 1) * scale;
  const bodyH = (h - 1) * layerH;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLOR.shadow;
  ctx.beginPath();
  ctx.ellipse(r2(x), r2(y + r * 0.36), r2(topR * 1.06), r2(topR * 0.34), 0, 0, Math.PI * 2);
  ctx.fill();
  if (bodyH > 0) {
    const wallTop = y - bodyH;
    const grd = ctx.createLinearGradient(0, r2(wallTop), 0, r2(y));
    grd.addColorStop(0, s.deep);
    grd.addColorStop(0.55, s.color);
    grd.addColorStop(1, s.light);
    ctx.fillStyle = grd;
    ctx.beginPath();
    const w = topR * 2;
    const hh = bodyH + topR;
    const rr = Math.min(topR * 0.5, layerH);
    roundRectPath(ctx, r2(x - topR), r2(wallTop), r2(w), r2(hh), rr);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(r2(x - topR * 0.96), r2(wallTop + topR * 0.4));
    ctx.lineTo(r2(x - topR * 0.96), r2(y + topR * 0.2));
    ctx.stroke();
  }
  const d = Math.max(4, Math.round(topR * 2));
  const face = faceSprite(kit, s, d);
  ctx.drawImage(face, r2(x - topR), r2(y - bodyH - topR), d, d);
  if (anim.glow) {
    ctx.globalAlpha = alpha * Math.min(1, anim.glow);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(r2(x), r2(y - bodyH), r2(topR * 0.92), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  const bw = Math.max(16, topR * 0.92);
  const bh = bw * 0.72;
  const bx = x + topR * 0.52;
  const by = y - bodyH - topR * 1.02;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  roundRectPath(ctx, r2(bx - bw / 2), r2(by - bh / 2), r2(bw), r2(bh), bh / 2);
  ctx.fill();
  ctx.strokeStyle = s.deep;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLOR.ink;
  ctx.font = Math.round(bh * 0.66) + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(h), r2(bx), r2(by + 0.5));
  ctx.restore();
}
function drawSocket(ctx, x, y, r) {
  const grd = ctx.createRadialGradient(x, y + r * 0.22, r * 0.15, x, y, r);
  grd.addColorStop(0, COLOR.socket);
  grd.addColorStop(1, "#F7F1E7");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOR.socketEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "rgba(90,70,50,0.10)";
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r * 0.92), Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
}
function drawLocked(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r), 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = COLOR.locked;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let i = -2; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r + i * (r * 0.5), y - r);
    ctx.lineTo(x - r + i * (r * 0.5) + r, y + r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(70,60,50,0.55)";
  const w = r * 0.5;
  roundRectPath(ctx, r2(x - w / 2), r2(y - w * 0.1), r2(w), r2(w * 0.8), w * 0.18);
  ctx.fill();
  ctx.strokeStyle = "rgba(70,60,50,0.55)";
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(r2(x), r2(y - w * 0.1), r2(w * 0.3), Math.PI, Math.PI * 2);
  ctx.stroke();
}
function drawObstacle(ctx, x, y, r, pulse = 0) {
  ctx.fillStyle = COLOR.shadow;
  ctx.beginPath();
  ctx.ellipse(r2(x), r2(y + r * 0.3), r2(r * 0.98), r2(r * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  const grd = ctx.createLinearGradient(x - r, y, x + r, y);
  grd.addColorStop(0, "#7E7466");
  grd.addColorStop(0.5, COLOR.obstacle);
  grd.addColorStop(1, "#847A6C");
  ctx.fillStyle = grd;
  roundRectPath(ctx, r2(x - r * 0.86), r2(y - r * 1.1), r2(r * 1.72), r2(r * 1.5), r * 0.3);
  ctx.fill();
  ctx.fillStyle = "#B3A897";
  ctx.beginPath();
  ctx.ellipse(r2(x), r2(y - r * 1.02), r2(r * 0.86), r2(r * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  if (pulse > 0) {
    ctx.strokeStyle = "rgba(255,120,80," + r2(0.5 * pulse) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r2(x), r2(y - r * 0.3), r2(r * 1.15), 0, Math.PI * 2);
    ctx.stroke();
  }
}
function drawPreview(ctx, x, y, r, kind, count) {
  const col = kind === "whole" ? COLOR.ok : kind === "part" ? COLOR.part : COLOR.bad;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, r * 0.13);
  ctx.setLineDash(kind === "bad" ? [4, 5] : [Math.max(3, r * 0.28), Math.max(3, r * 0.2)]);
  ctx.beginPath();
  ctx.arc(r2(x), r2(y), r2(r * 1.06), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (kind !== "bad" && count) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(r2(x + r * 0.86), r2(y - r * 0.86), r2(r * 0.38), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = Math.round(r * 0.42) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+" + count, r2(x + r * 0.86), r2(y - r * 0.84));
  }
  ctx.restore();
}

// src/scene/scene.ts
var SceneManager = class {
  constructor() {
    this.stack = [];
    this.byName = /* @__PURE__ */ new Map();
  }
  register(scene) {
    this.byName.set(scene.name, scene);
    return scene;
  }
  current() {
    return this.stack[this.stack.length - 1];
  }
  replace(name, arg) {
    const s = this.byName.get(name);
    if (!s) throw new Error("no scene: " + name);
    while (this.stack.length) this.stack.pop().exit?.();
    this.stack.push(s);
    s.enter?.(arg);
  }
  update(dt) {
    this.current()?.update(dt);
  }
  render(ctx, w, h) {
    this.current()?.render(ctx, w, h);
  }
  pointer(e) {
    this.current()?.pointer?.(e);
  }
};

// src/core/hex.ts
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

// src/core/rng.ts
function seedOf(n) {
  let h = (n | 0) ^ 2654435769;
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^ h >>> 16) >>> 0;
}
function rand(st) {
  st.rng = st.rng + 1831565813 | 0;
  let t = st.rng;
  t = Math.imul(t ^ t >>> 15, 1 | t);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function randInt(st, n) {
  return Math.floor(rand(st) * n);
}

// src/logic/state.ts
var NCOLORS = 6;
var CAP = 10;
var TRAY_SLOTS = 3;
var DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1]
];
function key(q, r) {
  return q + "," + r;
}
function buildNeighbors(cells) {
  const idx = /* @__PURE__ */ new Map();
  cells.forEach((c, i) => idx.set(key(c.q, c.r), i));
  return cells.map((c) => {
    const out = [];
    for (const [dq, dr] of DIRS) {
      const n = idx.get(key(c.q + dq, c.r + dr));
      if (n !== void 0) out.push(n);
    }
    return out;
  });
}
function usedItems(st) {
  return st.used.hint + st.used.shuffle + st.used.hammer + st.used.undo;
}
function makeGroup(st, bias) {
  const lv = st.level;
  const size = lv.groupMin + randInt(st, Math.max(1, lv.groupMax - lv.groupMin + 1));
  const hot = neededColor(st);
  const out = [];
  for (let i = 0; i < size; i++) {
    let c;
    if (hot >= 0 && rand(st) < bias) c = hot;
    else c = randInt(st, lv.colors);
    if (lv.decoyChance > 0 && rand(st) < lv.decoyChance) {
      c = lv.colors + randInt(st, Math.max(1, NCOLORS - lv.colors));
      if (c >= NCOLORS) c = NCOLORS - 1;
    }
    out.push(c);
  }
  return out;
}
function neededColor(st) {
  let best = -1;
  let bestScore = -1;
  for (const s of st.stacks) {
    if (!s.length || !isPure(s)) continue;
    const sc = s.length;
    if (sc > bestScore && CAP - sc >= 1) {
      bestScore = sc;
      best = s[s.length - 1];
    }
  }
  return best;
}
function isPure(s) {
  if (s.length <= 1) return true;
  const c = s[0];
  for (let i = 1; i < s.length; i++) if (s[i] !== c) return false;
  return true;
}
function topColor(s) {
  return s.length ? s[s.length - 1] : -1;
}
function topRun(s) {
  if (!s.length) return 0;
  const c = s[s.length - 1];
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === c; i--) n++;
  return n;
}
function refillTray(st) {
  for (let i = 0; i < TRAY_SLOTS; i++) {
    if (st.tray[i]) continue;
    if (st.supply.length) st.tray[i] = st.supply.shift();
    else if (st.level.refill) st.tray[i] = makeGroup(st, st.level.spawnBias);
    else break;
  }
}
function createGame(level) {
  const cells = hexMap(level.radius);
  const st = {
    rng: seedOf(level.seed),
    level,
    cells,
    nbrs: buildNeighbors(cells),
    stacks: cells.map(() => []),
    locked: new Uint8Array(cells.length),
    obstacle: new Uint8Array(cells.length),
    obstPos: [],
    obstTimer: 8,
    tray: [null, null, null],
    supply: [],
    removed: 0,
    score: 0,
    removedByColor: new Array(NCOLORS).fill(0),
    steps: 0,
    clock: 0,
    status: "playing",
    loss: null,
    used: { hint: 0, shuffle: 0, hammer: 0, undo: 0 },
    items: { hint: 3, shuffle: 2, hammer: 2 },
    chain: 0
  };
  const order = cells.map((_, i) => i).filter((i) => i > Math.min(4, cells.length >> 2));
  for (let k = 0; k < level.lockedCells && order.length; k++) {
    const j = randInt(st, order.length);
    st.locked[order[j]] = 1;
    order.splice(j, 1);
  }
  const free = cells.map((_, i) => i).filter((i) => !st.locked[i]);
  for (let k = 0; k < level.obstacles && free.length; k++) {
    const j = randInt(st, free.length);
    const c = free.splice(j, 1)[0];
    st.obstPos.push(c);
    st.obstacle[c] = 1;
  }
  for (let i = 0; i < level.queueSize; i++) st.supply.push(makeGroup(st, level.spawnBias));
  for (let i = 0; i < TRAY_SLOTS; i++) st.tray[i] = makeGroup(st, level.spawnBias);
  if (!level.refill) {
    st.supply.length = Math.max(0, level.queueSize - TRAY_SLOTS);
  }
  return st;
}

// src/logic/rules.ts
function receivable(st, cell) {
  if (cell < 0 || cell >= st.stacks.length) return false;
  return st.stacks[cell].length === 0 && !st.locked[cell] && !st.obstacle[cell];
}
function movePlan(st, from, to) {
  if (from === to) return null;
  if (from < 0 || to < 0 || from >= st.stacks.length || to >= st.stacks.length) return null;
  const a = st.stacks[from];
  const b = st.stacks[to];
  if (!a.length || !b.length) return null;
  if (st.locked[to] || st.obstacle[to] || st.locked[from] || st.obstacle[from]) return null;
  if (st.nbrs[from].indexOf(to) < 0) return null;
  const c = topColor(a);
  if (c !== topColor(b)) return null;
  if (!isPure(b)) return null;
  const room = CAP - b.length;
  if (room <= 0) return null;
  const t = Math.min(topRun(a), room);
  if (t <= 0) return null;
  return { k: isPure(a) && t === a.length ? "whole" : "part", count: t };
}
function placePlan(st, trayIdx, cell) {
  const g = st.tray[trayIdx];
  if (!g || !g.length) return null;
  if (g.length >= CAP) return null;
  if (!receivable(st, cell)) return null;
  return { k: "whole", count: g.length };
}
function takeTop(src, n) {
  return src.splice(src.length - n, n);
}
function resolve(st, seeds, out = []) {
  const work = new Set(seeds);
  let guard = st.cells.length * st.cells.length + 16;
  while (work.size || hasOverflow(st)) {
    if (guard-- <= 0) break;
    if (!work.size) {
      for (let i = 0; i < st.cells.length; i++) if (st.stacks[i].length >= CAP) work.add(i);
    }
    const cell = Math.min(...work);
    work.delete(cell);
    const s = st.stacks[cell];
    if (s.length >= CAP) {
      const c = topColor(s);
      const n = Math.min(s.length, CAP);
      s.splice(s.length - n, n);
      st.removed += n;
      st.removedByColor[c] += n;
      st.chain += 1;
      out.push({ k: "clear", cell, color: c, count: n, chain: st.chain });
      work.add(cell);
      for (const nb of st.nbrs[cell]) work.add(nb);
      continue;
    }
    if (s.length && isPure(s)) {
      const c = topColor(s);
      for (const nb of st.nbrs[cell]) {
        const o = st.stacks[nb];
        if (!o.length || !isPure(o) || topColor(o) !== c) continue;
        if (o.length + s.length > CAP) continue;
        const moved = o.slice();
        st.stacks[nb] = [];
        for (const m of moved) s.push(m);
        out.push({ k: "fuse", from: nb, to: cell, color: c, count: moved.length });
        work.add(nb);
        work.add(cell);
        for (const n2 of st.nbrs[nb]) work.add(n2);
        break;
      }
    }
    for (const nb of st.nbrs[cell]) if (st.stacks[nb].length >= CAP) work.add(nb);
  }
  return out;
}
function hasOverflow(st) {
  for (const s of st.stacks) if (s.length >= CAP) return true;
  return false;
}
function applyPlace(st, trayIdx, cell) {
  const out = [];
  if (!placePlan(st, trayIdx, cell)) {
    out.push({ k: "bounce", cell, reason: "place" });
    return out;
  }
  const g = st.tray[trayIdx];
  st.stacks[cell] = g.slice();
  st.tray[trayIdx] = null;
  st.steps += 1;
  st.chain = 0;
  out.push({ k: "place", cell, color: topColor(g), count: g.length });
  refillTray(st);
  out.push({ k: "refill" });
  resolve(st, [cell], out);
  settle(st, out);
  return out;
}
function applyMove(st, from, to) {
  const out = [];
  const plan = movePlan(st, from, to);
  if (!plan) {
    out.push({ k: "bounce", cell: to, reason: "move" });
    return out;
  }
  const moved = takeTop(st.stacks[from], plan.count);
  st.stacks[to].push(...moved);
  st.steps += 1;
  st.chain = 0;
  out.push({
    k: "move",
    from,
    to,
    color: moved[0],
    count: moved.length,
    whole: plan.k === "whole"
  });
  resolve(st, [to, from], out);
  settle(st, out);
  return out;
}
function settle(st, out) {
  if (st.status !== "playing") return;
  if (st.removed >= st.level.goal) {
    st.status = "won";
    out.push({ k: "win" });
    return;
  }
  const why = loseReason(st);
  if (why) {
    st.status = "lost";
    st.loss = why;
    out.push({ k: "lose", why });
  }
}
function loseReason(st) {
  if (st.level.timeLimit > 0 && st.clock >= st.level.timeLimit) return "timeout";
  let pool = 0;
  for (const s of st.stacks) pool += s.length;
  for (const g of st.tray) if (g) pool += g.length;
  for (const g of st.supply) pool += g.length;
  const need = st.level.goal - st.removed;
  if (!st.level.refill && pool < need) return "supply";
  if (!hasAnyAction(st)) return "noaction";
  return null;
}
function hasAnyAction(st) {
  for (let i = 0; i < TRAY_SLOTS; i++) {
    if (!st.tray[i]) continue;
    for (let c = 0; c < st.cells.length; c++) if (receivable(st, c)) return true;
  }
  for (let a = 0; a < st.cells.length; a++) {
    if (!st.stacks[a].length) continue;
    for (const b of st.nbrs[a]) if (movePlan(st, a, b)) return true;
  }
  return false;
}
function useHammer(st, cell) {
  const out = [];
  const s = st.stacks[cell];
  if (!s.length || st.items.hammer <= 0) {
    out.push({ k: "bounce", cell, reason: "hammer" });
    return out;
  }
  st.items.hammer -= 1;
  st.used.hammer += 1;
  const c = s.pop();
  st.removed += 1;
  st.removedByColor[c] += 1;
  out.push({ k: "clear", cell, color: c, count: 1, chain: 0 });
  resolve(st, [cell], out);
  settle(st, out);
  return out;
}
function useShuffle(st) {
  const out = [];
  if (st.items.shuffle <= 0) return out;
  st.items.shuffle -= 1;
  st.used.shuffle += 1;
  const cellsWith = [];
  const bag = [];
  st.stacks.forEach((s, i) => {
    if (s.length) {
      cellsWith.push(i);
      bag.push(...s);
    }
  });
  for (let i = bag.length - 1; i > 0; i--) {
    const j = randInt(st, i + 1);
    const t = bag[i];
    bag[i] = bag[j];
    bag[j] = t;
  }
  let p = 0;
  for (const c of cellsWith) {
    const h = st.stacks[c].length;
    st.stacks[c] = bag.slice(p, p + h);
    p += h;
  }
  refillTray(st);
  out.push({ k: "refill" });
  resolve(st, cellsWith, out);
  settle(st, out);
  return out;
}
function advance(st, dt) {
  const out = [];
  if (st.status !== "playing") return out;
  st.clock += dt;
  const lv = st.level;
  if (lv.timeLimit > 0 && st.clock >= lv.timeLimit) {
    settle(st, out);
    return out;
  }
  if (lv.obstacles > 0) {
    st.obstTimer -= dt;
    if (st.obstTimer <= 0) {
      st.obstTimer = 8;
      for (let i = 0; i < st.obstPos.length; i++) {
        const from = st.obstPos[i];
        const cand = st.nbrs[from].filter(
          (n) => !st.obstacle[n] && !st.locked[n] && st.stacks[n].length === 0
        );
        if (!cand.length) continue;
        const to = cand[randInt(st, cand.length)];
        st.obstacle[from] = 0;
        st.obstacle[to] = 1;
        st.obstPos[i] = to;
        out.push({ k: "obstacle", from, to });
      }
      settle(st, out);
    }
  }
  return out;
}

// src/logic/solver.ts
function actions(st) {
  const out = [];
  const occupied = st.stacks.map((s) => s.length > 0);
  let anyOccupied = occupied.some(Boolean);
  const seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < st.tray.length; i++) {
    const g = st.tray[i];
    if (!g || !g.length) continue;
    const sig = g.join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    let hot = 0;
    for (let c = 0; c < st.cells.length; c++) {
      if (!receivable(st, c)) continue;
      if (anyOccupied && !st.nbrs[c].some((n) => occupied[n])) continue;
      out.push({ k: "place", tray: i, cell: c });
      hot++;
    }
    if (!anyOccupied && hot === 0) {
      out.push({ k: "place", tray: i, cell: 0 });
    }
  }
  for (let a = 0; a < st.cells.length; a++) {
    if (!st.stacks[a].length) continue;
    for (const b of st.nbrs[a]) if (movePlan(st, a, b)) out.push({ k: "move", from: a, to: b });
  }
  return out;
}
function applyAction(st, a) {
  if (a.k === "place") applyPlace(st, a.tray, a.cell);
  else applyMove(st, a.from, a.to);
}
function evaluate(st) {
  let v = st.removed * 100;
  let occ = 0;
  for (const s of st.stacks) {
    if (!s.length) continue;
    occ++;
    if (isPure(s)) {
      const h = s.length;
      v += h * 14;
      if (h >= 7) v += (h - 6) * 40;
      if (h === CAP) v += 500;
    } else {
      v -= topColor(s) >= 0 ? s.length * 3 : 0;
    }
  }
  v -= occ * 1.2;
  v -= st.tray.filter(Boolean).length * 0.4;
  v -= st.steps * 0.05;
  return v;
}
function snapshot(st) {
  const s = [];
  for (let i = 0; i < st.stacks.length; i++) {
    const t = st.stacks[i];
    s.push(t.length ? String.fromCharCode(48 + t.length) + String.fromCharCode(65 + topColor(t)) : ".");
  }
  const tray = st.tray.map((g) => g ? g.length + ":" + topColor(g) : "-").join("|");
  return s.join("") + "#" + tray + "#" + st.removed;
}
function solve(st0, opts = {}) {
  const beam = opts.beam ?? 240;
  const maxSteps = opts.maxSteps ?? 400;
  const nodeCap = opts.nodeCap ?? 6e4;
  let expanded = 0;
  let frontier = [{ st: st0, path: [] }];
  const seen = /* @__PURE__ */ new Set([snapshot(st0)]);
  for (let depth = 0; depth < maxSteps; depth++) {
    const next = [];
    for (const n of frontier) {
      if (n.st.status === "won") return n.path;
      for (const a of actions(n.st)) {
        if (++expanded > nodeCap) return null;
        const st = structuredClone(n.st);
        applyAction(st, a);
        if (st.status === "lost") continue;
        const sig = snapshot(st);
        if (seen.has(sig)) continue;
        seen.add(sig);
        next.push({ st, path: n.path.concat([a]) });
      }
    }
    if (!next.length) return null;
    next.sort((x, y) => evaluate(y.st) - evaluate(x.st));
    frontier = next.slice(0, beam);
    if (seen.size > nodeCap * 3) seen.clear();
  }
  return frontier.find((n) => n.st.status === "won")?.path ?? null;
}
function decodeAction(s) {
  if (s[0] === "p") {
    const [t, c] = s.slice(1).split(":");
    return { k: "place", tray: Number(t), cell: Number(c) };
  }
  const [f, to] = s.slice(1).split(">");
  return { k: "move", from: Number(f), to: Number(to) };
}

// src/logic/hint.ts
var TIGHT = { nodeCap: 3e3, beam: 48, depth: 60 };
function argmaxOnePly(st) {
  let best = null;
  let bestVal = -Infinity;
  for (const a of actions(st)) {
    const probe = structuredClone(st);
    applyAction(probe, a);
    if (probe.status === "lost") continue;
    const v = evaluate(probe) + (probe.status === "won" ? 1e6 : 0);
    if (v > bestVal) {
      bestVal = v;
      best = a;
    }
  }
  return best;
}
function findHint(st, budget = TIGHT) {
  if (st.status !== "playing") return { action: null, reason: "none" };
  const path = solve(st, { beam: budget.beam, maxSteps: budget.depth, nodeCap: budget.nodeCap });
  if (path && path.length) return { action: path[0], reason: "solved" };
  const one = argmaxOnePly(st);
  if (one) return { action: one, reason: "bestEffort" };
  return { action: null, reason: "none" };
}

// src/logic/scorer.ts
var CLEAR_BASE = 100;
function chainMultiplier(chain) {
  return 1 + 0.5 * Math.max(0, chain - 1);
}
function applyScore(st, evs) {
  let gained = 0;
  for (const e of evs) {
    if (e.k === "clear") {
      gained += Math.round(CLEAR_BASE * (e.count / CAP) * chainMultiplier(e.chain));
    } else if (e.k === "fuse") {
      gained += 5 * e.count;
    }
  }
  st.score += gained;
  return gained;
}
function starsOf(st) {
  if (st.status !== "won") return 0;
  const par = Math.max(1, st.level.par);
  const items = usedItems(st);
  if (st.steps <= Math.ceil(par * 1.2) && items === 0) return 3;
  if (st.steps <= Math.ceil(par * 1.8) && items <= 1) return 2;
  return 1;
}
function isCheckmate(st) {
  if (st.level.colors < NCOLORS) return false;
  for (let c = 0; c < NCOLORS; c++) if (st.removedByColor[c] < CAP) return false;
  return true;
}

// src/render/boardView.ts
function computeLayout(box, cells) {
  const { size, ox, oy } = fitHexLayout(cells, box.x + box.w / 2, box.y + box.h / 2, box.w, box.h);
  const pos = cells.map((c) => ({
    x: size * 1.5 * c.q + ox,
    y: size * Math.sqrt(3) * (c.r + c.q / 2) + oy
  }));
  return {
    box,
    size,
    pos,
    hitR: size * 0.98,
    maxH: Math.max(size * 3, box.h * 0.5)
  };
}
function cellAt(l, x, y) {
  let best = -1;
  let bd = l.hitR * l.hitR;
  for (let i = 0; i < l.pos.length; i++) {
    const dx = l.pos[i].x - x;
    const dy = l.pos[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
function drawBoard(ctx, kit, l, st, vis, drag, hintCell, time, layerH) {
  const r = l.size * 0.86;
  for (let i = 0; i < l.pos.length; i++) {
    const p = l.pos[i];
    if (st.locked[i]) drawLocked(ctx, p.x, p.y, r);
    else drawSocket(ctx, p.x, p.y, r);
  }
  if (hintCell != null && hintCell >= 0 && l.pos[hintCell]) {
    const p = l.pos[hintCell];
    const k = 0.5 + 0.5 * Math.sin(time * 5.2);
    ctx.save();
    ctx.strokeStyle = COLOR.ok;
    ctx.globalAlpha = 0.35 + 0.45 * k;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (1.02 + 0.08 * k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (drag && drag.chain.length) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(63,182,139,0.75)";
    ctx.lineWidth = 2;
    for (const c of drag.chain) {
      const p = l.pos[c];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  const order = l.pos.map((_, i) => i).sort((a, b) => l.pos[a].y - l.pos[b].y);
  for (const i of order) {
    const s = st.stacks[i];
    const v = vis.get(i);
    if (v && v.ghost && v.ghost.count > 0) {
      const p2 = l.pos[i];
      drawTower(ctx, kit, p2.x, p2.y, r, v.ghost.color, v.ghost.count, { alpha: v.ghost.alpha });
    }
    if (!s.length) continue;
    const p = l.pos[i];
    const anim = {
      glow: v?.glow,
      scale: v?.land != null ? 1 + 0.12 * Math.sin(Math.PI * Math.min(1, v.land)) : void 0
    };
    drawTower(ctx, kit, p.x, p.y, r, s.length ? s[s.length - 1] : 0, s.length, anim);
    if (st.obstacle[i]) drawObstacle(ctx, p.x, p.y, r, v?.pulse);
  }
  if (drag && drag.target) {
    const p = l.pos[drag.target.cell];
    if (p) {
      drawPreview(
        ctx,
        p.x,
        p.y - Math.min(towerLift(st, l, drag.target.cell, layerH), l.maxH),
        r,
        drag.target.kind,
        drag.target.kind === "part" ? drag.target.count : void 0
      );
    }
  }
  if (drag) {
    drawTower(ctx, kit, drag.x, drag.y, r * 1.02, drag.color, drag.count, { alpha: 0.96 });
  }
}
function towerLift(st, l, cell, layerH) {
  const h = st.stacks[cell]?.length || 0;
  return h > 1 ? Math.min((h - 1) * layerH, l.maxH) : 0;
}
function drawTray(ctx, kit, slots, st, dragFrom, selected, layerH) {
  slots.forEach((r, i) => {
    const g = st.tray[i];
    ctx.save();
    if (!g || i === dragFrom) {
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "rgba(150,138,124,0.5)";
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = selected === i ? COLOR.ok : "rgba(180,166,150,0.55)";
      ctx.lineWidth = selected === i ? 2.5 : 1.2;
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
    }
    ctx.restore();
    if (!g || i === dragFrom) return;
    const pr = Math.min(r.w * 0.34, r.h * 0.3);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h - pr * 1.15;
    const lift = Math.min((g.length - 1) * layerH, r.h - pr * 2.6);
    drawTower(ctx, kit, cx, cy - lift, pr, g[g.length - 1], g.length);
  });
}

// src/render/fx.ts
var Fx = class {
  constructor(reduced = false) {
    this.parts = [];
    this.shake = 0;
    // 剩余位移像素
    this.hitStop = 0;
    // 剩余秒数（逻辑冻结）
    this.flash = 0;
    this.reduced = reduced;
  }
  burst(x, y, color, n = 14, power = 1) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 2 * i / n + Math.random() * 0.4;
      const sp = (60 + Math.random() * 150) * power;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.25,
        max: 0.7,
        size: 2 + Math.random() * 3.2,
        color,
        ring: false
      });
    }
  }
  ring(x, y, color, size = 10) {
    if (this.reduced) return;
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.42, max: 0.42, size, color, ring: true });
  }
  addShake(px) {
    if (!this.reduced) this.shake = Math.max(this.shake, px);
  }
  stop(ms) {
    if (!this.reduced) this.hitStop = Math.max(this.hitStop, ms / 1e3);
  }
  addFlash(v) {
    if (!this.reduced) this.flash = Math.max(this.flash, v);
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 3.4);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.ring) p.vy += 420 * dt;
    }
  }
  /** 屏震：以像素为单位平移画布，收敛要快 */
  applyShake(ctx) {
    if (this.shake <= 0.01) return;
    const a = Math.random() * Math.PI * 2;
    ctx.translate(Math.cos(a) * this.shake, Math.sin(a) * this.shake);
  }
  render(ctx) {
    if (!this.parts.length && this.flash <= 0) return;
    ctx.save();
    for (const p of this.parts) {
      const t = Math.max(0, p.life / p.max);
      ctx.globalAlpha = t;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + 3 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - t) * p.size * 3.4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash * 0.5);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(-2e3, -2e3, 4e3, 4e3);
    }
    ctx.restore();
  }
};

// src/view/ui.ts
var LABELS = {
  undo: { zh: "\u64A4\u9500", en: "Undo" },
  hint: { zh: "\u63D0\u793A", en: "Hint" },
  shuffle: { zh: "\u6D17\u724C", en: "Shuffle" },
  hammer: { zh: "\u9524\u5B50", en: "Hammer" },
  menu: { zh: "\u83DC\u5355", en: "Menu" },
  next: { zh: "\u4E0B\u4E00\u5173", en: "Next" },
  retry: { zh: "\u518D\u6765\u4E00\u6B21", en: "Retry" },
  levels: { zh: "\u9009\u5173", en: "Levels" },
  start: { zh: "\u5F00\u59CB\u6E38\u620F", en: "Play" },
  continue: { zh: "\u7EE7\u7EED\u7B2C ", en: "Continue " },
  soundOn: { zh: "\u97F3\u6548 \u5F00", en: "Sound on" },
  soundOff: { zh: "\u97F3\u6548 \u5173", en: "Sound off" }
};
function label(key2, lang) {
  const l = LABELS[key2];
  return l ? lang === "zh" ? l.zh : l.en : key2;
}
function pill(ctx, hits, r, text, opts = {}) {
  const tone = opts.tone || "plain";
  ctx.save();
  ctx.globalAlpha = opts.disabled ? 0.42 : 1;
  ctx.fillStyle = tone === "primary" ? COLOR.ok : tone === "danger" ? "#E88C7A" : "rgba(255,255,255,0.9)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = tone === "plain" ? "rgba(150,138,124,0.5)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = tone === "plain" ? COLOR.ink : "#FFFFFF";
  ctx.font = font(Math.min(r.h * 0.42, r.w * 0.2), true);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
  if (opts.id && !opts.disabled && opts.id) hits.add(opts.id, r, opts.z ?? 5);
}
function drawHud(ctx, r, o) {
  ctx.save();
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(22, r.h * 0.34), true);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(
    (o.lang === "zh" ? "\u7B2C " : "Lv ") + o.levelNo + (o.lang === "zh" ? " \u5173" : ""),
    r.x,
    r.y
  );
  ctx.font = font(12.5);
  ctx.fillStyle = COLOR.sub;
  ctx.fillText(o.segName, r.x, r.y + Math.min(26, r.h * 0.42));
  ctx.textAlign = "right";
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(22, r.h * 0.34), true);
  ctx.fillText(
    o.removed + " / " + o.goal + (o.lang === "zh" ? " \u5B50" : ""),
    r.x + r.w,
    r.y
  );
  ctx.font = font(12.5);
  ctx.fillStyle = COLOR.sub;
  const right = o.timeLeft != null ? (o.lang === "zh" ? "\u5269 " : "") + Math.max(0, Math.ceil(o.timeLeft)) + (o.lang === "zh" ? " \u79D2" : "s") + " \xB7 " + (o.lang === "zh" ? "\u5206 " : "") + o.score : (o.lang === "zh" ? "\u5F97\u5206 " : "Score ") + o.score;
  ctx.fillText(right, r.x + r.w, r.y + Math.min(26, r.h * 0.42));
  const bar = { x: r.x, y: r.y + r.h - 7, w: r.w, h: 7 };
  ctx.fillStyle = "rgba(120,108,96,0.16)";
  roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2);
  ctx.fill();
  const p = Math.max(0, Math.min(1, o.removed / o.goal));
  if (p > 0) {
    ctx.fillStyle = COLOR.ok;
    roundRectPath(ctx, bar.x, bar.y, Math.max(bar.h, bar.w * p), bar.h, bar.h / 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawToolbar(ctx, hits, r, items, lang, z = 5) {
  const keys = ["undo", "hint", "shuffle", "hammer", "menu"];
  const cells = hslice(r, keys.length, 8);
  keys.forEach((k, i) => {
    const c = cells[i];
    let text = label(k, lang);
    let disabled = false;
    if (k === "undo") disabled = !items.undo;
    if (k === "hint") {
      disabled = items.hint <= 0;
      text += items.hint > 0 ? " \xD7" + items.hint : "";
    }
    if (k === "shuffle") {
      disabled = items.shuffle <= 0;
      text += items.shuffle > 0 ? " \xD7" + items.shuffle : "";
    }
    if (k === "hammer") {
      disabled = items.hammer <= 0;
      text += items.hammer > 0 ? " \xD7" + items.hammer : "";
    }
    pill(ctx, hits, c, text, { id: "btn." + k, disabled, z });
  });
}
function drawResult(ctx, hits, box, o) {
  const a = Math.min(1, o.t);
  ctx.save();
  ctx.fillStyle = "rgba(250,246,238," + (0.9 * a).toFixed(3) + ")";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = a;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.36;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(34, box.w * 0.09), true);
  ctx.fillText(o.won ? o.lang === "zh" ? "\u901A\u5173\uFF01" : "Cleared!" : o.lang === "zh" ? "\u8FD9\u4E00\u6B65\u8D70\u4E0D\u901A" : "No way out", cx, cy);
  if (o.won) {
    const R = Math.min(26, box.w * 0.06);
    for (let i = 0; i < 3; i++) {
      const t = Math.max(0, Math.min(1, (o.t * 1.4 - 0.2 - i * 0.16) * 4));
      const x = cx + (i - 1) * R * 2.6;
      const y = cy + R * 2.4;
      ctx.save();
      ctx.globalAlpha = a * t;
      ctx.translate(x, y);
      ctx.scale(1 + (1 - t) * 0.5, 1 + (1 - t) * 0.5);
      star(ctx, 0, 0, R, i < o.stars ? "#F7BE55" : "rgba(160,148,134,0.28)");
      ctx.restore();
    }
    ctx.fillStyle = COLOR.sub;
    ctx.font = font(14);
    ctx.fillText(
      (o.lang === "zh" ? "\u5F97\u5206 " : "Score ") + o.score + "   " + o.removed + "/" + o.goal,
      cx,
      cy + R * 4.4
    );
    if (o.checkmate) {
      ctx.fillStyle = "#C0392B";
      ctx.font = font(16, true);
      ctx.fillText(o.lang === "zh" ? "\u5C06\u6740\uFF01\u516D\u8272\u5168\u90E8\u6536\u9F50" : "Checkmate! All six colors", cx, cy + R * 6.2);
    }
  } else if (o.reason) {
    ctx.fillStyle = COLOR.sub;
    ctx.font = font(14);
    ctx.fillText(o.reason, cx, cy + 34);
  }
  const bw = Math.min(150, box.w * 0.34);
  const bh = 46;
  const by = box.y + box.h * 0.72;
  if (o.won && o.hasNext) {
    pill(ctx, hits, { x: cx - bw - 6, y: by, w: bw, h: bh }, label("next", o.lang), { id: "btn.next", tone: "primary", z: 20 });
    pill(ctx, hits, { x: cx + 6, y: by, w: bw, h: bh }, label("levels", o.lang), { id: "btn.levels", z: 20 });
  } else {
    pill(ctx, hits, { x: cx - bw - 6, y: by, w: bw, h: bh }, label("retry", o.lang), { id: "btn.retry", tone: "primary", z: 20 });
    pill(ctx, hits, { x: cx + 6, y: by, w: bw, h: bh }, label("levels", o.lang), { id: "btn.levels", z: 20 });
  }
  ctx.restore();
}
function star(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function drawToast(ctx, box, text, t) {
  if (t <= 0) return;
  const a = Math.min(1, t * 2.2);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = font(14, true);
  const w = Math.min(box.w - 24, ctx.measureText(text).width + 34);
  const r = { x: box.x + (box.w - w) / 2, y: box.y + 6, w, h: 34 };
  ctx.fillStyle = "rgba(67,57,47,0.9)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 17);
  ctx.fill();
  ctx.fillStyle = "#FFF8EC";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
}

// src/data/levels.gen.ts
var LEVELS = [
  { "id": 1, "rulesVersion": 2, "radius": 2, "colors": 3, "goal": 20, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.5, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": ["dragToEmpty"], "par": 31, "winRate": 0.8333333333333334, "solution": ["p1:10", "p0:3", "p0:5", "p0:6", "p0:12", "m5>3", "p0:18", "p0:7", "p2:1", "p0:14", "p2:2", "p0:17", "p0:9", "p1:16", "p2:15", "p1:0", "m14>5", "p1:3", "p2:13", "p2:11", "m6>15", "m16>14", "m2>9", "m3>14", "p2:8", "p2:9", "m0>3", "m9>8", "p1:5", "p2:4", "m4>0"], "seed": 1010 },
  { "id": 2, "rulesVersion": 2, "radius": 2, "colors": 3, "goal": 20, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.54, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 25, "winRate": 0.6666666666666666, "solution": ["p1:18", "p2:15", "p0:17", "p0:16", "p2:6", "p1:5", "p1:4", "p2:3", "p2:2", "p0:1", "p0:0", "p1:11", "p2:10", "p2:4", "p2:8", "p2:9", "p1:7", "p2:4", "p2:2", "p2:9", "p2:14", "p1:0", "p0:12", "p1:2", "m9>2"], "seed": 2009 },
  { "id": 3, "rulesVersion": 2, "radius": 2, "colors": 3, "goal": 20, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.59, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 25, "winRate": 1, "solution": ["p0:17", "p2:5", "p2:14", "p2:3", "p2:10", "p2:7", "m7>10", "p0:18", "p0:6", "p0:8", "p0:9", "p0:11", "p0:12", "m12>10", "p0:16", "p0:15", "p0:1", "m1>7", "p1:10", "p1:0", "m10>1", "m14>16", "p1:4", "m0>4", "p1:6"], "seed": 3001 },
  { "id": 4, "rulesVersion": 2, "radius": 2, "colors": 3, "goal": 20, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.63, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 24, "winRate": 1, "solution": ["p2:3", "p1:10", "p1:7", "p0:8", "p2:5", "p0:12", "p0:0", "p0:4", "p0:11", "p0:16", "p0:6", "p0:17", "p2:2", "p2:1", "p1:7", "m2>1", "m7>1", "p1:15", "p1:18", "p2:9", "p2:13", "p2:14", "p1:1", "p2:15"], "seed": 4008 },
  { "id": 5, "rulesVersion": 2, "radius": 2, "colors": 3, "goal": 20, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.68, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 27, "winRate": 1, "solution": ["p2:7", "p2:1", "p2:0", "p1:10", "p1:3", "p1:6", "p1:2", "p1:15", "p0:9", "p1:8", "p1:5", "p1:12", "p1:16", "p1:18", "p1:5", "p1:14", "p2:16", "m5>14", "p0:17", "p1:12", "p2:4", "m2>4", "m3>5", "p2:13", "m15>13", "p2:11", "p1:14"], "seed": 5011 },
  { "id": 6, "rulesVersion": 2, "radius": 2, "colors": 3, "goal": 30, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.85, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 26, "winRate": 1, "solution": ["p2:9", "p1:8", "p0:1", "p2:10", "p2:12", "p1:11", "p2:13", "p2:2", "p2:14", "p0:5", "p0:0", "p0:3", "p0:4", "m12>3", "m2>4", "p0:14", "p0:0", "m3>14", "p0:17", "p0:6", "p0:7", "p0:15", "p0:6", "p0:0", "m8>7", "m0>3"], "seed": 6002 },
  { "id": 7, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 20, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.7, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": ["partialTransfer"], "seed": 7012, "par": 25, "winRate": 0.5, "solution": ["p1:8", "p1:2", "p0:4", "p2:13", "p2:7", "p2:1", "p2:6", "p2:5", "p1:11", "p2:9", "p1:0", "p2:10", "p0:14", "p0:12", "p2:17", "p0:15", "p0:10", "m13>15", "p2:3", "m6>15", "m0>3", "p2:18", "p0:18", "p0:12", "m14>3"] },
  { "id": 8, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 30, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.74, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 8001, "par": 28, "winRate": 0.5, "solution": ["p1:5", "p1:14", "p0:17", "p1:12", "p2:16", "p1:3", "p1:18", "p1:15", "p0:0", "p0:10", "p2:2", "p2:1", "p2:10", "p2:11", "p2:8", "p2:9", "p0:1", "p0:8", "m1>8", "p0:13", "p0:7", "p0:4", "p0:11", "p1:6", "m8>9", "m8>7", "p0:10", "p0:9"] },
  { "id": 9, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 30, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.79, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 9010, "par": 23, "winRate": 0.3333333333333333, "solution": ["p1:5", "p0:3", "p0:14", "p1:0", "p1:6", "p1:16", "p1:18", "p1:12", "p2:2", "p1:1", "p2:7", "p1:8", "p1:4", "p2:10", "p1:13", "p2:15", "p2:4", "p1:9", "p2:17", "p1:8", "p1:11", "p2:9", "p1:8"] },
  { "id": 10, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 30, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.63, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 34, "winRate": 0.6666666666666666, "solution": ["p1:8", "p0:7", "p0:2", "p1:4", "p0:1", "p2:15", "p1:6", "p2:2", "p0:10", "m6>4", "p1:11", "p1:18", "p2:17", "p2:12", "p0:16", "p1:13", "p1:0", "p1:14", "p0:5", "p0:4", "m5>0", "m2>0", "p0:9", "m6>0", "m14>5", "m4>0", "p0:3", "m4>13", "p1:1", "p1:3", "p1:4", "p1:5", "p1:8", "m1>8"], "seed": 10008 },
  { "id": 11, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 40, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.8800000000000001, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 11e3, "par": 29, "winRate": 0.8333333333333334, "solution": ["p0:1", "p1:3", "p2:7", "p2:10", "p2:8", "p1:12", "p1:9", "p1:2", "p1:11", "p2:0", "m0>3", "p2:6", "p2:17", "p1:16", "p2:5", "p2:17", "p1:5", "p2:3", "m3>5", "p1:6", "p1:18", "p2:6", "p1:17", "p1:4", "p0:13", "p0:5", "p0:14", "p0:15", "m12>14"] },
  { "id": 12, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 40, "groupMin": 2, "groupMax": 4, "queueSize": 9, "refill": true, "spawnBias": 0.85, "lockedCells": 0, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 35, "winRate": 0.8333333333333334, "solution": ["p0:15", "p2:6", "p1:13", "p1:18", "p0:4", "p2:2", "m4>6", "p2:15", "p2:17", "m2>4", "p1:5", "m15>4", "p0:0", "p0:16", "p1:11", "p2:3", "p1:8", "p1:9", "p1:1", "p1:14", "p2:7", "p1:16", "p1:10", "p2:8", "p2:1", "p0:12", "p1:14", "p0:14", "p1:16", "p0:9", "p0:7", "p1:8", "p1:9", "p2:7", "m10>7"], "seed": 12010 },
  { "id": 13, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 30, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.75, "lockedCells": 1, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": ["lockedCell"], "par": 28, "winRate": 0.6666666666666666, "solution": ["p1:11", "p0:13", "p0:15", "p0:6", "p1:18", "p0:5", "p2:14", "p2:17", "p2:16", "p2:3", "p2:2", "p2:0", "p0:10", "p0:8", "p2:9", "p0:11", "m9>11", "p0:11", "p0:9", "p0:4", "p0:9", "p0:8", "p0:11", "p0:1", "p0:7", "p2:9", "p0:0", "m7>8"], "seed": 13010 },
  { "id": 14, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 40, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.79, "lockedCells": 1, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 32, "winRate": 0.3333333333333333, "solution": ["p1:3", "p1:14", "p2:12", "p2:16", "p1:5", "p2:10", "m10>3", "p0:17", "p2:0", "p0:7", "p1:8", "p1:9", "p1:1", "p1:11", "p0:6", "p0:15", "p0:4", "p1:9", "p1:2", "m1>2", "p1:2", "p0:11", "p1:15", "m9>2", "p1:13", "m11>13", "p1:4", "p0:15", "p1:2", "m13>15", "p1:4", "m13>4"], "seed": 14004 },
  { "id": 15, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 40, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.79, "lockedCells": 1, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 15009, "par": 36, "winRate": 0.3333333333333333, "solution": ["p1:18", "p0:6", "p0:0", "p0:1", "p0:8", "p0:17", "p0:9", "p2:2", "p0:5", "m8>1", "p0:3", "p0:11", "p0:4", "p0:13", "p0:12", "m2>4", "m4>13", "p0:7", "p0:10", "p0:7", "p0:13", "p0:12", "p1:15", "p1:4", "p0:11", "m2>0", "p2:10", "p1:12", "p2:1", "m1>7", "m9>2", "p1:13", "p2:8", "m8>7", "p1:7", "m13>4"] },
  { "id": 16, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 50, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.88, "lockedCells": 1, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 36, "winRate": 0.8333333333333334, "solution": ["p2:4", "p0:2", "p0:11", "p1:8", "p1:6", "p1:0", "p0:9", "m4>2", "p1:13", "p0:17", "p1:18", "p1:1", "p1:10", "p1:2", "p1:16", "m2>1", "p1:12", "m6>4", "m12>10", "p1:7", "p1:14", "p1:16", "p1:1", "p1:5", "m5>14", "m17>6", "p1:14", "p1:5", "p1:14", "p0:5", "p2:3", "p2:1", "p1:10", "m7>10", "p1:16", "m14>16"], "seed": 16009 },
  { "id": 17, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 50, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8800000000000001, "lockedCells": 2, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 17005, "par": 41, "winRate": 0.5, "solution": ["p0:1", "p0:8", "p0:2", "p2:10", "p2:12", "m2>1", "p2:4", "p1:6", "p1:13", "p1:5", "p1:14", "p2:0", "p0:18", "p1:7", "p2:17", "p2:3", "m14>3", "p2:1", "p2:16", "m17>16", "m1>7", "p1:3", "m3>1", "p1:7", "p1:1", "m7>1", "p1:1", "p1:7", "p2:15", "m7>1", "p1:1", "p1:7", "p2:1", "m7>1", "m5>3", "p2:1", "p2:7", "m0>5", "p2:1", "m0>1", "m7>1"] },
  { "id": 18, "rulesVersion": 2, "radius": 2, "colors": 4, "goal": 50, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.85, "lockedCells": 2, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 35, "winRate": 0.5, "solution": ["p0:13", "p0:4", "p0:11", "p0:2", "p0:9", "p0:1", "m13>11", "p1:10", "p2:0", "p2:12", "p0:5", "p0:3", "p0:6", "p0:18", "p0:16", "p0:17", "p2:14", "p2:6", "m18>6", "p0:15", "p0:6", "p0:18", "p0:15", "p0:18", "p0:15", "m15>18", "p0:18", "p0:6", "p2:15", "p0:18", "p2:15", "p0:18", "m18>15", "p0:15", "m15>6"], "seed": 18007 },
  { "id": 19, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 40, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.75, "lockedCells": 2, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": ["cascade"], "par": 47, "winRate": 0.6666666666666666, "solution": ["p2:1", "p1:2", "p1:11", "p2:8", "p0:9", "p0:21", "p0:7", "p0:22", "p2:19", "p0:3", "p0:13", "p0:28", "p0:5", "p0:26", "p2:14", "p0:17", "p2:16", "p0:29", "p0:0", "p0:24", "m14>16", "m26>28", "p2:34", "p0:17", "p0:31", "p0:30", "p0:32", "p0:10", "p2:27", "p2:33", "p0:18", "p2:16", "p0:12", "p2:36", "p0:35", "p0:23", "m18>32", "p2:30", "p2:15", "m16>14", "p2:25", "m36>35", "p2:4", "m29>12", "p2:13", "m10>12", "m2>4"], "seed": 19011 },
  { "id": 20, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 50, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.73, "lockedCells": 2, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 20007, "par": 60, "winRate": 0.3333333333333333, "solution": ["p1:29", "p1:12", "p1:10", "p1:31", "p2:23", "p0:1", "p2:2", "p1:14", "p1:19", "p1:3", "p1:8", "p1:25", "p1:16", "p1:20", "p1:5", "p2:33", "m20>8", "p1:34", "p2:6", "p0:4", "p2:21", "p1:27", "p0:15", "p2:22", "p2:17", "p2:13", "p2:28", "p2:6", "p1:30", "p2:17", "p1:8", "p1:6", "p1:16", "p1:35", "p0:9", "m17>34", "m6>17", "p1:21", "p0:24", "p0:11", "p1:18", "m8>20", "p2:35", "m35>34", "p2:17", "p2:22", "p0:21", "m27>25", "p0:35", "m17>35", "p2:26", "p0:36", "p2:0", "m1>8", "p1:35", "p2:16", "m13>26", "p1:17", "p0:16", "m16>17"] },
  { "id": 21, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.81, "lockedCells": 3, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 49, "winRate": 0.6666666666666666, "solution": ["p0:4", "p1:13", "p2:28", "p0:15", "p2:11", "p2:18", "p0:30", "m13>4", "m15>18", "m30>13", "m11>13", "p2:24", "p2:9", "p1:21", "m30>15", "m28>30", "p0:20", "p0:17", "p0:22", "p0:32", "p0:18", "p0:26", "p0:7", "p1:8", "p1:23", "p0:19", "p0:18", "p2:7", "p2:2", "p0:23", "p1:0", "p1:2", "p0:1", "m32>30", "p0:36", "p0:32", "m2>1", "p0:1", "p0:3", "p0:14", "p2:3", "p0:36", "m36>32", "p2:13", "p0:26", "m1>2", "p2:0", "p0:18", "m26>13"], "seed": 21006 },
  { "id": 22, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.84, "lockedCells": 3, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 41, "winRate": 1, "solution": ["p0:27", "p2:29", "p2:25", "p1:10", "p0:7", "p2:20", "p0:31", "p0:33", "p2:19", "p0:3", "p1:23", "p1:1", "p1:2", "p1:9", "p2:22", "p0:1", "p0:2", "p2:14", "p2:0", "p0:2", "p2:0", "p2:2", "p0:21", "m2>9", "m1>2", "p0:0", "p0:34", "p0:4", "p2:15", "p2:2", "p2:9", "p2:17", "p2:2", "p2:35", "p1:4", "p1:8", "m10>1", "p1:15", "p1:11", "p0:0", "p1:33"], "seed": 22003 },
  { "id": 23, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8300000000000001, "lockedCells": 3, "decoyChance": 0.12, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 23010, "par": 60, "winRate": 0.3333333333333333, "solution": ["p1:25", "p0:27", "p0:12", "p0:10", "p1:3", "p0:14", "p0:31", "p1:1", "p0:33", "p0:2", "m14>31", "p1:7", "p0:9", "p0:34", "p0:35", "p0:8", "p0:0", "p2:34", "p2:22", "p0:16", "p0:36", "p0:17", "m2>0", "p1:4", "m4>0", "p0:19", "p1:20", "p0:29", "p1:31", "m3>0", "p1:29", "p0:18", "p1:35", "p0:21", "p0:11", "m22>21", "p1:24", "p1:31", "m9>11", "m31>29", "p0:15", "p1:32", "p1:26", "p1:6", "m18>36", "p1:26", "m16>31", "p1:29", "p0:15", "m18>6", "p1:20", "p1:11", "m15>6", "m29>31", "p1:36", "p1:26", "p1:30", "m27>29", "p2:11", "m11>26"] },
  { "id": 24, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.91, "lockedCells": 3, "decoyChance": 0.12, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 36, "winRate": 0.6666666666666666, "solution": ["p0:16", "p2:31", "p2:34", "p1:29", "p1:33", "p2:27", "p1:17", "p2:6", "p2:18", "p2:5", "p0:32", "p1:36", "p0:25", "p0:12", "p2:3", "p2:1", "p1:4", "p1:2", "p0:8", "p2:14", "m29>12", "p0:16", "p1:3", "p2:7", "p2:10", "p1:15", "p0:0", "p0:1", "p0:14", "p0:3", "m7>1", "m0>3", "p2:2", "p0:12", "p1:14", "p1:8"], "seed": 24012 },
  { "id": 25, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.92, "lockedCells": 4, "decoyChance": 0.12, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 50, "winRate": 0.8333333333333334, "solution": ["p1:3", "p1:1", "p2:14", "p2:10", "p2:7", "p0:20", "p0:23", "p0:29", "p0:31", "p0:5", "p0:6", "p0:18", "p0:21", "p2:22", "p1:12", "p1:17", "p2:18", "p2:4", "m17>18", "p2:13", "p2:28", "p0:25", "p0:2", "p2:4", "p2:15", "p2:30", "m5>17", "p0:11", "p0:9", "p0:0", "p0:32", "p0:35", "p0:19", "p1:26", "p0:28", "m4>0", "p2:17", "p2:13", "p2:13", "p2:21", "p0:24", "p2:18", "m17>35", "p2:4", "p2:15", "p0:9", "p2:32", "p2:30", "p2:13", "m15>13"], "seed": 25001 },
  { "id": 26, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 70, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.92, "lockedCells": 4, "decoyChance": 0.12, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 26e3, "par": 57, "winRate": 0.6666666666666666, "solution": ["p1:12", "p1:10", "p1:23", "p0:3", "p1:5", "p0:1", "p1:17", "p0:7", "p0:2", "p1:16", "p0:34", "p1:35", "p0:0", "p0:9", "p0:18", "p0:6", "p1:33", "p0:15", "p1:36", "p1:21", "p0:4", "p1:15", "p1:24", "p1:18", "p1:31", "p1:14", "m31>14", "p1:32", "p1:20", "p1:13", "m4>13", "m6>4", "p1:13", "p0:33", "p1:14", "m18>32", "m13>4", "p0:8", "p0:32", "p1:30", "p0:22", "p1:15", "m21>22", "p0:15", "p1:7", "p0:25", "p0:9", "m9>8", "m14>31", "p1:29", "p1:15", "p1:4", "m29>31", "m33>31", "p0:20", "p0:8", "m24>22"] },
  { "id": 27, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 50, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.9, "lockedCells": 4, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": ["finiteSupply"], "par": 40, "winRate": 0.6666666666666666, "solution": ["p2:26", "p2:28", "p1:11", "p1:13", "p0:30", "p2:9", "p2:32", "p2:18", "p2:24", "p2:4", "p0:35", "p2:2", "p0:8", "p0:1", "p0:21", "p2:0", "p2:22", "p0:1", "p2:20", "p0:3", "p0:7", "m8>7", "p2:17", "p0:23", "p0:19", "p2:23", "p0:6", "p0:12", "p2:10", "p0:14", "p2:5", "m14>5", "p2:10", "p0:23", "p2:5", "p2:15", "p0:19", "p1:12", "p1:0", "m7>19"], "seed": 27003 },
  { "id": 28, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.9, "lockedCells": 4, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 60, "winRate": 0.6666666666666666, "solution": ["p0:12", "p2:3", "p1:5", "p2:0", "p2:16", "p1:14", "p1:2", "p1:1", "p2:34", "p2:4", "p0:35", "p2:25", "p2:9", "p2:29", "p1:31", "p0:24", "p1:9", "p0:18", "p0:23", "m9>24", "p0:24", "p1:7", "p2:33", "p1:10", "p1:23", "m23>10", "p2:22", "p1:15", "m22>24", "p2:30", "p1:7", "p1:10", "p1:13", "p1:7", "p0:28", "p0:21", "p1:26", "p0:36", "p1:10", "p1:7", "p1:11", "p1:24", "m26>11", "m18>36", "p1:9", "p0:11", "p0:20", "p0:32", "p1:19", "p0:21", "m7>19", "m15>32", "p0:23", "p1:36", "m30>32", "p1:20", "p0:32", "m32>36", "p1:25", "p0:21"], "seed": 28010 },
  { "id": 29, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.9, "lockedCells": 5, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 48, "winRate": 0.5, "solution": ["p0:22", "p2:9", "p2:8", "p2:7", "p0:21", "p0:20", "p0:2", "p2:1", "p0:3", "p2:0", "p2:12", "p0:23", "p0:6", "p0:27", "p2:17", "p0:35", "p0:29", "p0:14", "p2:16", "p0:29", "m14>16", "p2:18", "p2:16", "p2:34", "m18>35", "p2:14", "p2:25", "m16>14", "m34>35", "p2:5", "p2:12", "p2:15", "p2:6", "p2:33", "p1:32", "p1:14", "p2:6", "p2:15", "p1:6", "m6>15", "p2:4", "m5>16", "p2:31", "m17>5", "m17>6", "p1:35", "p2:15", "p2:36"], "seed": 29004 },
  { "id": 30, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 70, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.84, "lockedCells": 5, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 61, "winRate": 0.5, "solution": ["p0:21", "p1:9", "p0:2", "p0:24", "p1:11", "p0:0", "p1:3", "p2:12", "p1:5", "p1:6", "p2:15", "p1:32", "p1:8", "p2:1", "p1:29", "p2:7", "m1>7", "p1:25", "p1:31", "p2:20", "p2:17", "p1:23", "p2:16", "p1:14", "p2:4", "p1:34", "p1:29", "p2:13", "p2:36", "p2:27", "p2:14", "m29>27", "p2:28", "p2:7", "p2:14", "m14>29", "p1:31", "p1:19", "m31>29", "m28>13", "p0:4", "p0:35", "m12>29", "p1:27", "p1:13", "p1:7", "p1:29", "m7>19", "m19>20", "m4>13", "m27>29", "p1:22", "p1:20", "m19>20", "p0:8", "m23>19", "p0:20", "m19>20", "p1:20", "m8>20", "p0:19"], "seed": 30011 },
  { "id": 31, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.9, "lockedCells": 5, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 50, "winRate": 0.3333333333333333, "solution": ["p0:24", "p1:9", "p0:22", "p0:11", "p2:2", "p2:1", "p0:0", "p0:4", "p0:3", "p0:8", "p0:7", "p0:13", "p0:21", "p1:28", "p1:19", "p1:23", "p0:7", "p0:10", "p1:26", "m11>26", "p2:30", "p1:13", "p1:14", "p2:6", "p2:26", "p2:29", "p2:20", "m24>11", "p2:17", "p2:16", "p2:6", "p1:14", "p1:23", "p2:33", "m6>17", "p1:13", "m14>16", "p2:23", "p1:15", "p1:34", "p1:13", "p2:15", "p1:34", "p2:32", "p2:19", "m15>32", "p2:16", "p0:6", "p0:36", "m26>13"], "seed": 31006 },
  { "id": 32, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 80, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8600000000000001, "lockedCells": 5, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "seed": 32003, "par": 67, "winRate": 0.16666666666666666, "solution": ["p2:6", "p2:4", "p1:2", "p2:8", "p0:9", "p2:7", "p2:23", "p1:19", "p2:25", "p0:27", "p1:22", "p2:17", "p2:34", "p2:35", "p2:5", "p2:15", "p2:30", "p2:14", "p2:0", "p0:3", "p2:1", "p2:32", "p0:12", "p2:10", "p1:24", "m6>0", "p0:36", "m5>0", "p1:20", "m3>0", "m5>6", "p1:34", "p1:0", "p1:12", "m14>5", "p1:34", "m5>0", "m36>32", "p1:10", "p1:33", "p2:12", "p2:35", "p1:13", "p1:31", "p1:11", "p2:33", "p2:0", "m1>0", "p2:23", "p2:0", "p2:34", "m24>11", "p1:26", "p1:5", "p1:15", "p2:35", "m26>11", "m32>15", "p2:15", "p2:32", "m13>15", "p0:11", "p2:15", "m15>6", "p0:34", "m0>5", "p0:32"] },
  { "id": 33, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.9, "lockedCells": 5, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 48, "winRate": 0.6666666666666666, "solution": ["p2:9", "p2:8", "p1:21", "p1:1", "p2:11", "p2:13", "p1:26", "p2:7", "p2:0", "p2:4", "p0:20", "p1:30", "p0:10", "p1:32", "p1:12", "p2:24", "p1:15", "p2:25", "p1:2", "p1:22", "p1:3", "m9>22", "p0:14", "p0:16", "p1:27", "p0:10", "m8>2", "p1:33", "p1:32", "m7>10", "p2:4", "m32>15", "p0:31", "p1:3", "p1:8", "p2:18", "p2:5", "p1:15", "p1:3", "p1:34", "p0:18", "m4>15", "m31>33", "p2:25", "m20>8", "m0>3", "m25>10", "m14>3"], "seed": 33004 },
  { "id": 34, "rulesVersion": 2, "radius": 3, "colors": 5, "goal": 80, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.92, "lockedCells": 5, "decoyChance": 0.1, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 59, "winRate": 0.6666666666666666, "solution": ["p1:36", "p0:35", "p1:17", "p1:6", "p0:4", "p2:2", "p2:0", "p2:8", "p1:3", "p2:10", "p2:25", "p2:9", "p1:16", "p1:5", "p1:31", "p1:11", "p1:9", "p2:29", "p2:21", "p2:32", "p1:7", "p1:9", "p1:20", "p1:22", "p2:23", "p2:19", "p1:9", "p1:1", "p2:21", "p1:24", "p2:25", "m20>21", "p1:33", "p1:18", "m22>21", "m2>1", "p2:35", "m22>24", "m18>32", "p2:15", "p1:25", "p1:18", "p1:11", "p1:9", "p1:21", "p0:22", "p0:32", "p0:23", "m25>23", "p0:15", "p2:13", "m18>15", "p2:19", "p2:24", "p2:9", "m9>21", "p2:24", "p2:9", "m9>24"], "seed": 34009 },
  { "id": 35, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 70, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.75, "lockedCells": 5, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 64, "winRate": 0.8333333333333334, "solution": ["p2:25", "p0:12", "p2:3", "p2:5", "p1:23", "p1:10", "p0:46", "p2:14", "p2:17", "p0:29", "p2:34", "p0:42", "p2:6", "p0:44", "p0:0", "p0:16", "p2:33", "p2:52", "p0:1", "p0:35", "p2:59", "p2:2", "p0:6", "p2:48", "p2:56", "p2:57", "p0:54", "p2:1", "p0:31", "p2:58", "p2:4", "p0:36", "p2:55", "p2:18", "p0:53", "p0:60", "p0:37", "p2:7", "p0:59", "m6>18", "p0:1", "p1:36", "p0:50", "p1:2", "p1:19", "p1:0", "p1:37", "p2:52", "p1:19", "m19>37", "p2:38", "m52>50", "p0:32", "p2:4", "p0:0", "p2:18", "p1:11", "p0:39", "p1:30", "p0:17", "p1:1", "m16>17", "p1:18", "m3>1"], "seed": 35001 },
  { "id": 36, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 90, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.77, "lockedCells": 5, "decoyChance": 0, "timeLimit": 234, "obstacles": 0, "tutorial": ["timed"], "par": 77, "winRate": 0.6666666666666666, "solution": ["p1:49", "p0:51", "p1:53", "p1:55", "p1:47", "p1:30", "p0:13", "p0:4", "p0:2", "p0:60", "p0:26", "p1:11", "p1:9", "p0:21", "p0:15", "p2:32", "p2:1", "p2:20", "p2:8", "m21>8", "p2:1", "p2:40", "p2:10", "p1:6", "p2:3", "p2:19", "p2:18", "p1:7", "p1:5", "p1:8", "p2:35", "m6>5", "p1:17", "p1:45", "p1:43", "p1:39", "p1:24", "p2:0", "p2:5", "p2:59", "p2:12", "m40>39", "p1:16", "p1:22", "p2:29", "m5>3", "m21>39", "p1:34", "p1:14", "p2:33", "m9>22", "p2:1", "p2:20", "p1:3", "p2:7", "p1:54", "p2:10", "p2:58", "p1:17", "p1:43", "p2:56", "m59>58", "m43>22", "p1:8", "m20>39", "p2:1", "p1:29", "p2:12", "p2:36", "p2:29", "p1:14", "p1:19", "p1:45", "p1:57", "m45>43", "m14>29", "m57>58"], "seed": 36003 },
  { "id": 37, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 60, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.92, "lockedCells": 3, "decoyChance": 0, "timeLimit": 0, "obstacles": 0, "tutorial": [], "par": 55, "winRate": 0.8333333333333334, "solution": ["p0:9", "p1:8", "p2:21", "p2:24", "p2:1", "p0:43", "p2:40", "p0:0", "p1:5", "p1:45", "p0:11", "p0:26", "p0:28", "p0:47", "p2:41", "p2:3", "p1:30", "p0:22", "p1:32", "p1:49", "p1:18", "p1:4", "p1:35", "p0:16", "p0:36", "p1:15", "p0:34", "p1:20", "p1:13", "p0:2", "p2:55", "p0:4", "p0:18", "p0:12", "p2:15", "p2:18", "p2:25", "p2:36", "m15>4", "p2:53", "p1:14", "p2:23", "m3>12", "p2:39", "p2:35", "p1:27", "m14>12", "p2:13", "p2:29", "p2:50", "p1:52", "p1:13", "p0:54", "p0:29", "p0:59"], "seed": 37003 },
  { "id": 38, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 90, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.81, "lockedCells": 5, "decoyChance": 0, "timeLimit": 234, "obstacles": 0, "tutorial": [], "par": 63, "winRate": 0.6666666666666666, "solution": ["p1:40", "p0:22", "p2:41", "p1:43", "p2:45", "p1:47", "p1:21", "p1:20", "p2:8", "p1:39", "p1:38", "p1:1", "p1:26", "p1:19", "p1:38", "p2:3", "p2:11", "p2:26", "p2:37", "m41>40", "p1:49", "p1:26", "p1:7", "p2:2", "p2:19", "m38>19", "p1:24", "p1:14", "p1:31", "p2:52", "p0:7", "p2:14", "p1:19", "p2:0", "m19>38", "m52>31", "p2:29", "p1:9", "p1:4", "p2:6", "p2:18", "p2:28", "p1:15", "p1:42", "p1:37", "p1:30", "p1:14", "p1:23", "p1:11", "m37>38", "p2:25", "p2:13", "p2:30", "p2:44", "m23>44", "p1:17", "p2:42", "p2:27", "p1:48", "p1:46", "m25>46", "p1:28", "m46>48"], "seed": 38005 },
  { "id": 39, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 90, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.78, "lockedCells": 5, "decoyChance": 0, "timeLimit": 234, "obstacles": 0, "tutorial": [], "seed": 39e3, "par": 76, "winRate": 0.5, "solution": ["p1:17", "p1:16", "p1:18", "p0:34", "p2:58", "p2:6", "p2:57", "p2:32", "p0:53", "p1:56", "p0:14", "p0:54", "p0:3", "p0:52", "p0:12", "p1:1", "p1:55", "p2:35", "p2:50", "m1>3", "p2:0", "p2:60", "p0:2", "p2:48", "p1:29", "p1:8", "p1:25", "m17>6", "p1:36", "p0:5", "p0:10", "p0:44", "p0:42", "p0:55", "p2:60", "p0:4", "p0:3", "p0:21", "p0:19", "p2:20", "p2:59", "m60>55", "p2:22", "m19>20", "p2:43", "p0:38", "p2:7", "p2:19", "p2:45", "p2:37", "m19>7", "p1:30", "p1:40", "p1:3", "p0:46", "p1:6", "p0:51", "p0:22", "p1:49", "p1:55", "p1:27", "p1:39", "p2:20", "p1:8", "m40>22", "p1:4", "m2>4", "p1:43", "m5>6", "p0:51", "m38>39", "m51>49", "p0:41", "p1:45", "p1:43", "p1:43"] },
  { "id": 40, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 90, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.85, "lockedCells": 5, "decoyChance": 0, "timeLimit": 234, "obstacles": 0, "tutorial": [], "par": 74, "winRate": 0.6666666666666666, "solution": ["p1:55", "p2:60", "p2:32", "p1:30", "p2:15", "p2:51", "p0:28", "p0:26", "p0:47", "p1:4", "p1:53", "p1:36", "p1:0", "p1:13", "p2:11", "p1:3", "p1:14", "p2:35", "p2:29", "p1:2", "p0:9", "p1:17", "p2:27", "p0:29", "p1:5", "p2:1", "p2:12", "p2:31", "p1:54", "p0:22", "p0:10", "p2:56", "p1:8", "p0:7", "p0:16", "p1:23", "p2:21", "p0:8", "p1:5", "p0:21", "p2:1", "m22>21", "p0:43", "p0:33", "m31>33", "p1:16", "p0:20", "m16>5", "p1:29", "p1:52", "p1:7", "p0:33", "p0:1", "p0:7", "p0:42", "p0:1", "m23>7", "p1:17", "p1:37", "p0:5", "p1:50", "p0:8", "p0:18", "p1:34", "p0:38", "p0:7", "p0:58", "p2:44", "p2:20", "m17>5", "p2:45", "m7>20", "p1:42", "p1:16"], "seed": 40007 },
  { "id": 41, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 100, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.87, "lockedCells": 5, "decoyChance": 0, "timeLimit": 260, "obstacles": 1, "tutorial": ["obstacle"], "par": 60, "winRate": 0.8333333333333334, "solution": ["p0:32", "p1:18", "p1:36", "p0:59", "p2:15", "p1:13", "p0:11", "p0:30", "p0:24", "p1:58", "p0:17", "p0:28", "p0:51", "m28>51", "p0:4", "p1:55", "p1:16", "p1:2", "p0:4", "p0:22", "p0:36", "p0:57", "p1:43", "m4>2", "p1:49", "p2:9", "p2:45", "p1:34", "m43>45", "p2:6", "p1:36", "p1:8", "p2:20", "p0:49", "p1:40", "p2:55", "p1:21", "p1:33", "p2:8", "p2:41", "p2:33", "p2:35", "p2:16", "p1:60", "p1:34", "p2:57", "p2:7", "m22>21", "m34>57", "p2:40", "p2:51", "p1:47", "p1:20", "p1:19", "p1:41", "p1:37", "m22>41", "p1:26", "m16>34", "m37>19"], "seed": 41001 },
  { "id": 42, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 100, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8400000000000001, "lockedCells": 5, "decoyChance": 0, "timeLimit": 260, "obstacles": 1, "tutorial": [], "seed": 42009, "par": 73, "winRate": 0.6666666666666666, "solution": ["p0:46", "p0:44", "p1:27", "p0:12", "p1:29", "p2:14", "p0:50", "p2:5", "p2:10", "p0:31", "p0:23", "p0:6", "p0:4", "p1:16", "p1:6", "p0:3", "p0:25", "m5>3", "p1:42", "p1:54", "p2:7", "p1:20", "p1:39", "p1:18", "p1:23", "p1:8", "p1:20", "p0:25", "p0:0", "m6>5", "p0:34", "p1:42", "p1:15", "m4>15", "p1:9", "m25>23", "p0:52", "p1:2", "m50>52", "p1:15", "p1:13", "p2:1", "m4>15", "p2:30", "p0:4", "m1>2", "p0:23", "p0:15", "p0:58", "p0:2", "p1:9", "p1:59", "p1:33", "p1:3", "p1:30", "p0:24", "p1:28", "m42>23", "p1:22", "p2:60", "p1:43", "p2:57", "p2:30", "p1:21", "p1:39", "p1:53", "m60>59", "m12>3", "p2:6", "p2:34", "p0:18", "p0:59", "m13>30"] },
  { "id": 43, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 100, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.91, "lockedCells": 5, "decoyChance": 0, "timeLimit": 260, "obstacles": 1, "tutorial": [], "par": 66, "winRate": 0.8333333333333334, "solution": ["p0:38", "p0:20", "p0:21", "p1:40", "p1:7", "p0:39", "p1:19", "p1:9", "p1:11", "p1:23", "p2:44", "p1:4", "p2:0", "p1:2", "p1:42", "p1:25", "p1:1", "p2:26", "p2:47", "p1:28", "p1:13", "p1:10", "p2:25", "p1:46", "p2:1", "p2:6", "p1:25", "m25>10", "p0:3", "p0:18", "p0:28", "p0:5", "p1:10", "p0:49", "p0:24", "p0:45", "p1:17", "p0:25", "p0:32", "p1:17", "p1:55", "p2:32", "p1:51", "p2:34", "p1:30", "p1:28", "p2:33", "p1:46", "p1:10", "p1:32", "p2:47", "p1:24", "p2:43", "p2:57", "m23>10", "p2:55", "p0:41", "p0:1", "p0:13", "p0:45", "p2:25", "m45>43", "p0:17", "p0:53", "p2:6", "m13>30"], "seed": 43001 },
  { "id": 44, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 100, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8800000000000001, "lockedCells": 5, "decoyChance": 0, "timeLimit": 260, "obstacles": 1, "tutorial": [], "seed": 44e3, "par": 67, "winRate": 0.5, "solution": ["p2:57", "p1:56", "p0:33", "p2:16", "p0:17", "p2:6", "p1:34", "p2:31", "p2:18", "p1:54", "p0:52", "p1:14", "p0:50", "p1:32", "p2:53", "p1:5", "p1:4", "p2:30", "p0:51", "p0:11", "p2:2", "p0:26", "p2:1", "p1:48", "p0:10", "p1:36", "p1:24", "p1:1", "p1:58", "p2:55", "p1:45", "p1:12", "p1:55", "p2:28", "p1:0", "p1:26", "p1:13", "p1:46", "p0:28", "p0:45", "p1:29", "p0:27", "p0:11", "p2:24", "p1:3", "m45>24", "p2:5", "m3>12", "p0:14", "p0:31", "p2:1", "p1:46", "p1:14", "p2:11", "p1:24", "p2:43", "p1:12", "p1:14", "p0:10", "p0:49", "m28>49", "p1:45", "p1:36", "m26>13", "p1:8", "p1:29", "p1:20"] },
  { "id": 45, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 100, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8999999999999999, "lockedCells": 5, "decoyChance": 0, "timeLimit": 260, "obstacles": 1, "tutorial": [], "seed": 45002, "par": 76, "winRate": 1, "solution": ["p0:6", "p1:15", "p1:4", "p1:11", "p1:5", "p0:14", "p2:17", "p1:18", "p0:30", "p1:53", "p1:0", "p1:3", "p2:1", "p2:12", "p1:27", "p0:51", "p1:12", "p1:10", "p2:25", "p2:29", "p2:31", "p0:8", "p0:21", "p0:23", "p0:42", "p1:22", "p1:13", "p1:23", "p2:54", "p0:25", "p0:31", "p0:29", "p0:56", "p0:41", "p0:43", "p1:49", "p1:9", "p1:57", "p1:26", "p1:35", "m22>43", "m54>56", "p2:44", "p1:59", "p2:58", "p1:42", "p2:40", "p1:12", "p2:2", "m5>0", "p1:35", "p1:45", "p1:33", "p1:37", "p0:19", "p2:46", "p0:59", "p2:55", "p2:43", "m35>59", "m58>59", "p2:28", "p1:42", "p1:6", "p2:60", "p1:8", "p1:20", "p2:27", "p0:9", "p0:22", "m9>22", "p1:54", "p1:8", "p0:40", "p1:26", "m22>40"] },
  { "id": 46, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 110, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.85, "lockedCells": 5, "decoyChance": 0, "timeLimit": 286, "obstacles": 1, "tutorial": [], "par": 75, "winRate": 0.6666666666666666, "solution": ["p2:22", "p0:9", "p0:11", "p0:13", "p0:24", "p0:26", "p0:40", "p2:21", "p2:39", "p2:4", "p2:41", "p0:0", "p2:3", "p2:38", "p0:12", "p2:1", "p0:22", "p2:7", "p2:2", "p2:1", "p2:22", "p2:30", "p2:19", "p2:23", "p0:6", "p2:44", "p2:38", "p0:28", "p2:25", "m26>28", "p2:15", "p1:17", "p0:18", "p0:51", "p1:28", "p1:35", "p0:30", "p1:42", "p0:58", "p0:10", "m12>10", "p1:20", "p0:36", "p2:45", "p1:19", "m1>10", "p1:60", "p2:57", "p1:41", "p1:16", "p1:56", "p2:54", "p1:42", "p1:31", "p2:38", "p1:55", "p1:46", "p1:53", "p1:23", "p1:47", "m19>20", "p0:35", "p0:34", "p0:20", "p1:59", "p1:52", "m58>59", "p1:54", "p2:56", "p1:10", "p1:60", "m10>1", "m31>54", "p2:52", "p2:29"], "seed": 46011 },
  { "id": 47, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 100, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.75, "lockedCells": 5, "decoyChance": 0, "timeLimit": 260, "obstacles": 2, "tutorial": ["checkmate"], "par": 79, "winRate": 0.5, "solution": ["p1:52", "p0:54", "p1:50", "p2:56", "p1:33", "p1:29", "p0:27", "p2:46", "p2:12", "p2:10", "p2:57", "p2:3", "p2:25", "p0:5", "p0:17", "p0:31", "p0:6", "p0:44", "p1:4", "p0:2", "p0:25", "p0:58", "p1:18", "p1:32", "p1:30", "p0:10", "p0:28", "p0:32", "p0:15", "m58>57", "p1:35", "p1:14", "p1:47", "m6>15", "p1:26", "p0:44", "p1:14", "p0:36", "p0:30", "p0:11", "m27>25", "p0:51", "p0:49", "p0:13", "p1:32", "p1:3", "m10>3", "p1:55", "p1:51", "p0:3", "p0:23", "p0:53", "p0:24", "m32>15", "p0:45", "m49>28", "p0:1", "p0:43", "p0:7", "p0:47", "p2:0", "p0:20", "p0:31", "m11>26", "p2:38", "p2:25", "p2:45", "p2:9", "p0:14", "p0:21", "p0:44", "p2:15", "m52>31", "p2:20", "m18>15", "m3>1", "m9>21", "p1:2", "p2:21"], "seed": 47013 },
  { "id": 48, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 110, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.78, "lockedCells": 5, "decoyChance": 0, "timeLimit": 286, "obstacles": 2, "tutorial": [], "par": 91, "winRate": 0.5, "solution": ["p1:56", "p1:57", "p1:34", "p1:35", "p1:58", "p1:18", "p1:32", "p1:15", "p1:59", "p1:36", "p2:30", "p2:53", "p0:13", "p0:4", "p1:11", "p1:2", "p0:55", "p0:28", "p0:60", "p0:8", "p1:26", "p0:1", "p0:47", "p1:0", "p0:0", "p0:8", "p0:1", "p0:20", "p0:3", "p0:45", "p2:24", "p2:47", "p0:17", "p2:7", "p0:22", "p2:14", "p2:10", "p2:19", "p2:49", "p2:39", "m10>7", "p2:31", "p2:51", "p2:52", "p2:50", "p2:5", "p0:21", "p0:47", "p0:7", "p1:41", "p1:12", "p1:14", "p0:48", "p0:42", "p0:28", "p0:49", "m48>50", "p1:47", "p0:17", "m47>28", "p2:51", "p2:23", "p2:10", "m5>17", "m47>45", "p0:25", "m0>5", "p0:28", "m30>28", "p0:1", "p0:23", "m23>7", "p1:17", "p0:10", "p0:44", "m44>23", "p0:50", "p1:47", "p1:49", "p1:42", "m49>28", "p1:25", "p1:46", "m14>5", "p0:27", "m51>28", "m12>27", "p2:45", "p2:43", "p0:37", "m25>27"], "seed": 48003 },
  { "id": 49, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 90, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.9, "lockedCells": 5, "decoyChance": 0, "timeLimit": 286, "obstacles": 2, "tutorial": [], "par": 67, "winRate": 0.8333333333333334, "solution": ["p0:10", "p1:12", "p1:29", "p2:14", "p0:1", "p2:31", "p2:16", "p2:5", "p2:34", "p2:35", "p2:6", "p0:52", "p2:27", "p0:0", "p0:54", "p2:7", "p1:23", "p1:25", "p2:48", "p2:15", "p2:2", "p2:20", "p2:9", "p2:4", "p1:36", "p2:17", "p2:19", "p1:11", "p2:33", "p1:38", "p1:15", "p1:50", "p1:57", "p1:44", "p1:60", "p1:19", "p2:42", "p0:25", "p0:55", "m55>60", "p0:42", "p0:18", "p0:58", "p2:3", "m11>4", "p2:2", "p2:13", "p0:33", "m57>58", "p0:56", "p2:13", "p2:19", "p2:60", "p2:33", "p2:26", "p2:45", "p0:4", "p2:57", "m19>38", "p2:36", "p2:13", "m36>18", "p0:26", "p0:33", "p0:58", "p2:45", "p0:24"], "seed": 49013 },
  { "id": 50, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 110, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.84, "lockedCells": 5, "decoyChance": 0, "timeLimit": 286, "obstacles": 2, "tutorial": [], "par": 86, "winRate": 0.8333333333333334, "solution": ["p2:33", "p2:54", "p0:31", "p2:56", "p0:14", "p2:34", "p2:57", "p2:17", "p0:5", "p1:12", "p0:18", "p0:15", "p0:30", "p1:35", "p1:36", "p2:25", "p0:55", "p0:59", "p2:6", "p0:60", "m59>60", "m5>6", "p0:10", "p2:4", "p0:2", "p0:36", "p0:9", "p2:46", "p1:7", "p2:2", "p2:8", "p2:1", "p2:22", "p0:58", "p0:40", "p0:21", "m21>22", "p1:39", "p1:3", "p1:20", "p0:19", "p0:48", "p0:60", "p0:11", "m60>36", "p0:27", "p0:4", "p0:37", "m1>3", "p0:11", "p0:6", "p0:36", "m37>19", "p1:40", "p1:23", "p1:59", "p2:26", "p2:60", "p1:4", "m4>11", "p2:24", "p0:43", "p2:9", "p0:32", "p0:23", "p0:47", "p1:28", "p1:50", "p2:6", "p1:42", "p1:51", "p1:30", "p2:45", "m45>43", "p1:41", "p2:15", "m30>15", "p1:22", "p2:41", "p2:11", "m26>11", "m7>23", "p1:19", "p2:49", "m43>22", "p1:24"], "seed": 5e4 },
  { "id": 51, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 120, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.8300000000000001, "lockedCells": 5, "decoyChance": 0, "timeLimit": 312, "obstacles": 2, "tutorial": [], "seed": 51002, "par": 77, "winRate": 0.6666666666666666, "solution": ["p1:23", "p0:10", "p0:3", "p2:0", "p2:25", "p2:42", "p0:27", "p2:46", "p0:6", "p2:48", "p2:15", "p0:4", "p0:2", "p0:17", "p0:11", "p0:26", "p0:47", "p2:14", "p0:37", "p2:1", "p0:28", "p0:34", "p2:11", "p0:17", "p1:44", "m17>34", "p1:18", "p2:15", "p0:17", "p0:32", "p0:18", "p1:38", "p0:36", "m2>11", "p0:29", "p1:15", "p0:9", "p2:19", "m14>29", "p2:8", "p2:1", "p2:5", "p0:24", "p2:39", "p1:53", "p0:17", "p0:5", "m15>32", "m9>11", "m0>1", "p1:8", "p1:16", "p0:52", "p1:18", "m24>9", "p0:31", "p0:33", "p2:16", "p0:5", "p2:40", "p0:34", "m3>14", "p0:36", "p0:8", "p0:22", "p1:11", "p2:29", "m6>5", "p2:1", "m16>34", "p0:34", "p2:21", "p0:59", "p0:60", "m19>23", "p2:8", "p1:33"] },
  { "id": 52, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 120, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.91, "lockedCells": 5, "decoyChance": 0, "timeLimit": 312, "obstacles": 2, "tutorial": [], "par": 74, "winRate": 0.8333333333333334, "solution": ["p1:41", "p0:40", "p0:21", "p0:20", "p2:38", "p0:9", "p0:39", "p2:37", "p2:43", "p0:11", "p2:42", "p2:23", "p1:24", "p1:25", "p2:10", "p2:7", "p2:27", "p2:19", "p2:50", "p2:52", "p2:42", "p2:48", "p1:54", "p1:46", "m19>42", "p1:12", "p1:50", "p2:44", "p1:23", "p1:44", "m44>23", "m44>25", "p1:23", "p1:2", "m50>48", "p2:13", "p1:28", "p2:7", "p1:47", "p2:10", "m10>23", "p2:12", "p2:31", "p2:19", "m27>12", "p0:33", "p0:30", "p0:48", "p0:50", "p1:1", "p1:22", "p2:51", "p1:25", "m7>1", "m50>48", "p2:23", "p1:10", "p0:12", "p2:32", "m10>1", "p2:34", "p2:46", "p0:17", "m23>10", "p0:5", "p2:19", "p0:14", "p0:31", "p1:2", "p0:10", "p0:3", "m10>3", "p2:28", "p2:34"], "seed": 52011 },
  { "id": 53, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 120, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.92, "lockedCells": 5, "decoyChance": 0, "timeLimit": 312, "obstacles": 2, "tutorial": [], "par": 70, "winRate": 0.6666666666666666, "solution": ["p0:9", "p1:22", "p1:24", "p1:2", "p2:21", "p0:4", "p2:41", "p2:43", "p2:45", "p0:6", "p0:39", "p2:13", "p2:17", "p0:34", "m21>39", "p0:16", "p0:40", "p1:39", "p1:1", "p1:0", "p1:15", "p1:32", "p2:18", "p1:11", "p1:3", "p1:35", "p1:17", "p1:15", "m18>15", "p2:1", "p1:7", "p1:1", "p2:15", "p2:35", "p0:32", "p1:59", "p2:1", "p2:16", "p1:10", "p1:53", "p0:33", "p1:38", "p1:34", "p1:35", "p2:23", "p0:16", "p0:44", "p1:26", "p1:51", "p0:26", "p2:33", "p0:47", "p1:0", "p0:42", "p2:34", "p1:60", "p1:35", "p1:18", "m16>17", "p1:1", "p2:49", "m26>47", "m1>10", "p1:11", "p2:7", "m32>18", "p2:5", "p1:1", "p2:53", "p2:35"], "seed": 53003 },
  { "id": 54, "rulesVersion": 2, "radius": 4, "colors": 6, "goal": 120, "groupMin": 2, "groupMax": 5, "queueSize": 9, "refill": true, "spawnBias": 0.85, "lockedCells": 5, "decoyChance": 0, "timeLimit": 312, "obstacles": 2, "tutorial": [], "par": 82, "winRate": 0.6666666666666666, "solution": ["p1:24", "p2:26", "p1:13", "p1:45", "p0:15", "p1:22", "p0:6", "p0:4", "p1:9", "p0:5", "p0:8", "p0:1", "p0:41", "p0:0", "p0:1", "p0:17", "p0:34", "p0:16", "p1:30", "p0:8", "p1:3", "p0:12", "p0:21", "p0:10", "p1:8", "p1:27", "p0:33", "p1:34", "p1:34", "p0:0", "p0:21", "p0:35", "p0:1", "p1:43", "p1:59", "m17>16", "p0:33", "p0:14", "p1:16", "p0:7", "p2:36", "m34>16", "p2:46", "p1:8", "p1:55", "p1:19", "m5>14", "m7>19", "p1:8", "p0:20", "p1:48", "p0:35", "p1:44", "p1:47", "p1:21", "p0:1", "p0:57", "p1:33", "p1:7", "p0:2", "p0:29", "p0:16", "p0:51", "p0:14", "p1:59", "p0:35", "p0:11", "p1:7", "p0:28", "p1:32", "p1:38", "m15>32", "m59>35", "p1:57", "p0:12", "p0:8", "p0:50", "p0:52", "p0:48", "p1:39", "p1:32", "m20>39"], "seed": 54005 }
];

// src/data/levels.ts
var TOTAL_LEVELS = LEVELS.length;
function levelById(id) {
  return LEVELS[id - 1] || null;
}
function isUnlocked(unlocked, id) {
  return id === 1 || id <= unlocked;
}
function segmentOf(id) {
  const segs = [
    [1, 6, "\u6559\u5B66 \xB7 \u653E\u7F6E\u4E0E\u7EAF\u5854\u878D\u5408"],
    [7, 12, "\u6DF7\u8272\u90E8\u5206\u8F6C\u79FB"],
    [13, 18, "\u9501\u683C"],
    [19, 26, "\u957F\u94FE\u7EA7\u8054\u4E0E\u8BF1\u9975"],
    [27, 34, "\u8282\u594F\u4E0E\u51B2\u523A"],
    [35, 46, "\u65F6\u9650\u4E0E\u79FB\u52A8\u969C\u788D"],
    [47, 54, "\u5927\u5E08 \xB7 \u5C06\u6740"]
  ];
  for (let i = 0; i < segs.length; i++) {
    const [a, b, name] = segs[i];
    if (id >= a && id <= b) return { index: i, name };
  }
  return { index: segs.length - 1, name: segs[segs.length - 1][2] };
}

// src/scene/gameScene.ts
var GameScene = class {
  constructor(host) {
    this.host = host;
    this.name = "game";
    this.fx = new Fx(false);
    this.effects = [];
    this.undoStack = [];
    this.drag = null;
    this.dragFrom = null;
    this.lockT = 0;
    this.hintCell = null;
    this.hintT = 0;
    this.toast = "";
    this.toastT = 0;
    this.overT = 0;
    this.time = 0;
    this.stars = 0;
    this.checkmate = false;
    this.armedHammer = false;
    this.autoplay = null;
    this.layerH = 10;
    // 首帧之前也要有布局可用：主循环是「先 update 再 render」，
    // 而 update 里可能立刻产生事件并需要格子坐标
    this.vw = 390;
    this.vh = 700;
  }
  enter(arg) {
    const level = arg || this.host.levelAt(this.host.save.unlocked) || this.host.levelAt(1);
    this.st = createGame(level);
    this.fx = new Fx(this.host.reducedMotion());
    this.st.items = { ...this.st.items, ...this.host.save.items };
    this.effects.length = 0;
    this.undoStack.length = 0;
    this.drag = null;
    this.dragFrom = null;
    this.lockT = 0;
    this.hintCell = null;
    this.hintT = 0;
    this.overT = 0;
    this.stars = 0;
    this.checkmate = false;
    this.armedHammer = false;
    const tut = level.tutorial[0];
    if (tut) this.say(tutText(tut, this.host.lang()));
    if (this.host.autoplay() && level.solution.length) {
      this.autoplay = { queue: level.solution.slice(), timer: 0.35 };
    }
  }
  say(text) {
    this.toast = text;
    this.toastT = 3.4;
  }
  relayout(w, h) {
    const pad = 14;
    this.box = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
    const parts = vstack(this.box, [
      { id: "hud", h: UI.hud },
      { id: "board", flex: 1, pad: 8 },
      { id: "tray", h: UI.tray },
      { id: "bar", h: UI.toolbar }
    ], 6);
    this.areas = { hud: parts.hud, board: parts.board, tray: parts.tray, bar: parts.bar };
    this.boardLayout = computeLayout(parts.board, this.st.cells);
    this.layerH = Math.max(4, this.boardLayout.size * 0.3);
  }
  slots() {
    return hslice(this.areas.tray, 3, 10);
  }
  update(dt) {
    if (!this.boardLayout) this.relayout(this.vw, this.vh);
    this.time += dt;
    this.lockT = Math.max(0, this.lockT - dt);
    this.toastT = Math.max(0, this.toastT - dt);
    this.hintT = Math.max(0, this.hintT - dt);
    if (!this.hintT) this.hintCell = null;
    if (this.st.status !== "playing") this.overT = Math.min(1, this.overT + dt / (DUR.overlay / 1e3));
    if (this.fx.hitStop > 0) {
      this.fx.hitStop = Math.max(0, this.fx.hitStop - dt);
    } else if (this.st.status === "playing") {
      const evs = advance(this.st, dt);
      if (evs.length) this.onEvents(evs);
    }
    if (this.autoplay && this.st.status === "playing" && this.lockT <= 0 && !this.fx.hitStop) {
      this.autoplay.timer -= dt;
      if (this.autoplay.timer <= 0) {
        const code = this.autoplay.queue.shift();
        this.autoplay.timer = 0.42;
        if (code) {
          const a = decodeAction(code);
          this.pushUndo();
          this.onEvents(a.k === "place" ? applyPlace(this.st, a.tray, a.cell) : applyMove(this.st, a.from, a.to));
        } else this.autoplay = null;
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].t += dt;
      if (this.effects[i].t >= this.effects[i].dur) this.effects.splice(i, 1);
    }
    this.fx.update(dt);
  }
  visFor(cell) {
    let v = null;
    for (const e of this.effects) {
      if (e.cell !== cell) continue;
      const p = e.t / e.dur;
      v = v || {};
      if (e.kind === "land") v.land = p;
      else if (e.kind === "glow") v.glow = Math.max(v.glow || 0, 1 - p);
      else if (e.kind === "ghost") v.ghost = { color: e.color, count: e.count, alpha: (1 - p) * 0.8 };
    }
    return v;
  }
  render(ctx, w, h) {
    const hits = this.host.hits;
    hits.clear();
    this.vw = w;
    this.vh = h;
    this.relayout(w, h);
    ctx.save();
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);
    this.fx.applyShake(ctx);
    const vis = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.st.cells.length; i++) {
      const v = this.visFor(i);
      if (v) vis.set(i, v);
    }
    drawBoard(ctx, this.host.kit, this.boardLayout, this.st, vis, this.drag, this.hintCell, this.time, this.layerH);
    drawTray(ctx, this.host.kit, this.slots(), this.st, this.dragFrom?.tray ?? null, null, this.layerH);
    this.slots().forEach((r, i) => {
      if (this.st.tray[i]) hits.add("tray:" + i, r, 3);
    });
    this.boardLayout.pos.forEach((p, i) => {
      if (!this.st.stacks[i].length) return;
      const r = this.boardLayout.size * 0.95;
      hits.add("cell:" + i, { x: p.x - r, y: p.y - r * 2.4, w: r * 2, h: r * 3.4 }, 2);
    });
    const tl = this.st.level.timeLimit;
    drawHud(ctx, this.areas.hud, {
      levelNo: this.st.level.id,
      segName: segmentOf(this.st.level.id).name,
      removed: this.st.removed,
      goal: this.st.level.goal,
      score: this.st.score,
      timeLeft: tl > 0 ? tl - this.st.clock : null,
      lang: this.host.lang()
    });
    drawToolbar(ctx, hits, this.areas.bar, {
      hint: this.st.items.hint,
      shuffle: this.st.items.shuffle,
      hammer: this.st.items.hammer,
      undo: this.undoStack.length > 0,
      muted: this.host.save.muted
    }, this.host.lang());
    this.fx.render(ctx);
    if (this.toastT > 0) drawToast(ctx, this.areas.board, this.toast, Math.min(1, this.toastT));
    if (this.st.status !== "playing") {
      drawResult(ctx, hits, this.box, {
        won: this.st.status === "won",
        stars: this.stars,
        score: this.st.score,
        removed: this.st.removed,
        goal: this.st.level.goal,
        checkmate: this.checkmate,
        reason: this.st.status === "lost" ? loseText(this.st.loss, this.host.lang()) : void 0,
        hasNext: this.st.status === "won" && this.st.level.id < this.host.totalLevels(),
        lang: this.host.lang(),
        t: this.overT
      });
    }
    ctx.restore();
  }
  pointer(e) {
    const hits = this.host.hits;
    const id = hits.pick(e.x, e.y);
    if (this.st.status !== "playing") {
      if (e.phase === "up" && id) this.handleResultTap(id);
      return;
    }
    if (e.phase === "down") {
      if (id && id.indexOf("btn.") === 0) {
        void this.onButton(id.slice(4));
        return;
      }
      if (this.armedHammer && id && id.indexOf("cell:") === 0) {
        this.armedHammer = false;
        this.pushUndo();
        this.onEvents(useHammer(this.st, Number(id.slice(5))));
        return;
      }
      if (this.lockT > 0) return;
      if (id && id.indexOf("tray:") === 0) this.beginTrayDrag(Number(id.slice(5)), e);
      else if (id && id.indexOf("cell:") === 0) this.beginCellDrag(Number(id.slice(5)), e);
      return;
    }
    if (e.phase === "move" && this.drag) {
      this.drag.x = e.x;
      this.drag.y = e.y - UI.liftDrag;
      this.updatePreview(e.x, e.y);
      return;
    }
    if ((e.phase === "up" || e.phase === "cancel") && this.drag) {
      this.release(e.phase === "cancel" ? null : cellAt(this.boardLayout, e.x, e.y));
    }
  }
  beginTrayDrag(i, e) {
    const g = this.st.tray[i];
    if (!g || !g.length) return;
    this.dragFrom = { tray: i };
    this.drag = { color: topColor(g), count: g.length, x: e.x, y: e.y - UI.liftDrag, target: null, chain: [] };
    this.host.audio.play("pick");
  }
  beginCellDrag(cell, e) {
    const s = this.st.stacks[cell];
    if (!s.length) return;
    this.dragFrom = { cell };
    this.drag = { color: topColor(s), count: topRun(s), x: e.x, y: e.y - UI.liftDrag, target: null, chain: [] };
    this.host.audio.play("pick");
  }
  updatePreview(x, y) {
    const drag = this.drag;
    const from = this.dragFrom;
    if (!drag || !from) return;
    const cell = cellAt(this.boardLayout, x, y);
    drag.target = null;
    drag.chain = [];
    if (cell < 0) return;
    if (from.tray != null) {
      const ok = !!placePlan(this.st, from.tray, cell);
      drag.target = { cell, kind: ok ? "whole" : "bad", count: drag.count };
      return;
    }
    const plan = movePlan(this.st, from.cell, cell);
    if (!plan) {
      drag.target = { cell, kind: "bad", count: 0 };
      return;
    }
    drag.target = { cell, kind: plan.k, count: plan.count };
    drag.chain = this.chainOf(cell);
  }
  /** 落下去后会被吸走的同色纯塔链 —— 提前画出来，级联才读得懂 */
  chainOf(cell) {
    const out = [];
    const seen = /* @__PURE__ */ new Set([cell]);
    let frontier = [cell];
    while (frontier.length) {
      const next = [];
      for (const c of frontier) {
        for (const nb of this.st.nbrs[c]) {
          if (seen.has(nb)) continue;
          const s = this.st.stacks[nb];
          if (!s.length || !isPure(s) || topColor(s) !== topColor(this.st.stacks[cell])) continue;
          seen.add(nb);
          out.push(nb);
          next.push(nb);
        }
      }
      frontier = next;
    }
    return out;
  }
  release(cell) {
    const drag = this.drag;
    const from = this.dragFrom;
    this.drag = null;
    this.dragFrom = null;
    if (!drag || !from) return;
    if (cell == null || cell < 0) {
      this.host.audio.play("bounce");
      return;
    }
    this.pushUndo();
    const evs = from.tray != null ? applyPlace(this.st, from.tray, cell) : applyMove(this.st, from.cell, cell);
    this.onEvents(evs);
  }
  pushUndo() {
    this.undoStack.push(structuredClone(this.st));
    if (this.undoStack.length > 30) this.undoStack.shift();
  }
  onEvents(evs) {
    if (!evs.length) return;
    applyScore(this.st, evs);
    for (const e of evs) this.playEffect(e);
    if (evs.some((e) => e.k === "clear" && e.chain >= 2)) this.fx.stop(DUR.hitStopCascade);
  }
  playEffect(e) {
    const pos = (i) => this.boardLayout.pos[i];
    const S = this.boardLayout.size;
    switch (e.k) {
      case "place":
        this.effects.push({ t: 0, dur: DUR.place / 1e3, kind: "land", cell: e.cell, color: e.color, count: e.count });
        this.host.audio.play("place");
        break;
      case "move":
      case "fuse":
        this.effects.push({ t: 0, dur: DUR.mergePiece / 1e3, kind: "land", cell: e.to, color: e.color, count: e.count });
        this.effects.push({ t: 0, dur: DUR.ghostFade / 1e3, kind: "ghost", cell: e.from, color: e.color, count: e.count });
        this.effects.push({ t: 0, dur: 0.3, kind: "glow", cell: e.to, color: e.color, count: e.count });
        this.host.audio.play("merge", { step: e.count });
        break;
      case "clear": {
        this.effects.push({ t: 0, dur: DUR.clear / 1e3, kind: "glow", cell: e.cell, color: e.color, count: e.count });
        const p = pos(e.cell);
        if (p) {
          this.fx.burst(p.x, p.y - S * 0.4, skin(e.color).color, 22);
          this.fx.ring(p.x, p.y, skin(e.color).deep, S * 0.9);
          this.fx.addFlash(0.3);
        }
        this.fx.addShake(Math.min(4, 1.5 + e.chain));
        this.fx.stop(DUR.hitStopClear);
        this.lockT = DUR.inputLockClear / 1e3;
        this.host.audio.play("clear");
        break;
      }
      case "bounce":
        this.host.audio.play("bounce");
        break;
      case "obstacle": {
        const p = pos(e.to);
        if (p) this.fx.ring(p.x, p.y, COLOR.obstacle, S * 0.7);
        break;
      }
      case "win":
        this.onWin();
        break;
      case "lose":
        this.fx.addShake(3);
        this.host.audio.play("fail");
        break;
      case "refill":
      default:
        break;
    }
  }
  onWin() {
    this.stars = starsOf(this.st);
    this.checkmate = isCheckmate(this.st);
    this.fx.stop(DUR.hitStopWin);
    this.host.audio.play(this.checkmate ? "checkmate" : "win");
    const id = String(this.st.level.id);
    this.host.save.stars[id] = Math.max(this.host.save.stars[id] || 0, this.stars);
    this.host.save.best = Math.max(this.host.save.best, this.st.score);
    this.host.save.unlocked = Math.max(this.host.save.unlocked, this.st.level.id + 1);
    this.host.save.items = { ...this.st.items };
    this.host.persist();
  }
  handleResultTap(id) {
    if (id === "btn.next") {
      const nxt = this.host.levelAt(this.st.level.id + 1);
      if (nxt) return this.host.replace("game", nxt);
    }
    if (id === "btn.retry") this.host.replace("game", this.st.level);
    else if (id === "btn.levels") this.host.replace("levels");
  }
  async onButton(key2) {
    this.host.audio.play("click");
    if (key2 === "menu") return this.host.replace("menu");
    if (key2 === "sound") {
      this.host.save.muted = !this.host.save.muted;
      this.host.audio.setMuted(this.host.save.muted);
      return this.host.persist();
    }
    if (key2 === "undo") {
      const prev = this.undoStack.pop();
      if (prev) {
        prev.used.undo += 1;
        this.st = prev;
        this.effects.length = 0;
        this.drag = null;
        this.dragFrom = null;
      }
      return;
    }
    if (key2 === "hint") {
      if (!await this.spendItem("hint")) return;
      const h = findHint(this.st);
      if (!h.action) return this.say(this.host.lang() === "zh" ? "\u786E\u5B9E\u6CA1\u6709\u66F4\u597D\u7684\u8D70\u4E86" : "Nothing better here");
      this.hintCell = h.action.k === "place" ? h.action.cell : h.action.to;
      this.hintT = 2.6;
      this.say(
        h.reason === "solved" ? this.host.lang() === "zh" ? "\u8FD9\u6837\u8D70\u53EF\u4EE5\u901A\u5173" : "This keeps the level winnable" : this.host.lang() === "zh" ? "\u6765\u4E0D\u53CA\u7B97\u5230\u5E95\uFF0C\u5148\u8FD9\u6837\u8D70" : "Best I can see right now"
      );
      return;
    }
    if (key2 === "shuffle") {
      if (!await this.spendItem("shuffle")) return;
      this.pushUndo();
      this.onEvents(useShuffle(this.st));
      return;
    }
    if (key2 === "hammer") {
      if (!await this.spendItem("hammer")) return;
      this.armedHammer = true;
      this.say(this.host.lang() === "zh" ? "\u70B9\u4E00\u5EA7\u5854\uFF0C\u6572\u6389\u5B83\u6700\u4E0A\u9762\u90A3\u9897" : "Tap a tower to knock its top piece off");
    }
  }
  /** 道具次数用尽时看一次激励视频；浏览器试玩没有广告能力，直接放行 */
  async spendItem(k) {
    if (this.st.items[k] > 0) {
      this.st.items[k] -= 1;
      this.st.used[k] += 1;
      return true;
    }
    if (await this.host.rewardAd()) {
      this.st.used[k] += 1;
      this.say(this.host.lang() === "zh" ? "\u5DF2\u8865\u4E0A\u8FD9\u4E00\u6B21" : "Refilled");
      return true;
    }
    this.say(this.host.lang() === "zh" ? "\u8FD9\u4E2A\u9053\u5177\u7528\u5B8C\u4E86" : "Out of " + k);
    return false;
  }
};
function tutText(key2, lang) {
  const t = TUTORIAL[key2];
  return t ? lang === "zh" ? t[0] : t[1] : key2;
}
function loseText(why, lang) {
  const m = {
    noaction: ["\u68CB\u76D8\u6EE1\u4E86\uFF0C\u6CA1\u6709\u80FD\u843D\u7684\u5730\u65B9", "Board is full \u2014 nowhere left to play"],
    supply: ["\u5269\u4E0B\u7684\u5B50\u51D1\u4E0D\u6EE1\u76EE\u6807\u4E86", "Not enough pieces left to reach the goal"],
    timeout: ["\u65F6\u95F4\u5230", "Time up"]
  };
  const t = m[why || "noaction"] || m.noaction;
  return lang === "zh" ? t[0] : t[1];
}
var TUTORIAL = {
  dragToEmpty: ["\u628A\u4E0B\u65B9\u7684\u4E00\u645E\u62D6\u5230\u7A7A\u683C\u4E0A", "Drag a pile from the tray onto an empty cell"],
  partialTransfer: ["\u6DF7\u8272\u5854\u53EA\u628A\u9876\u90E8\u540C\u8272\u90A3\u51E0\u9897\u9001\u51FA\u53BB", "Mixed towers give away only their top run"],
  lockedCell: ["\u659C\u7EB9\u683C\u88AB\u9501\u4F4F\uFF0C\u4E0D\u80FD\u843D\u5B50", "Hatched cells are locked"],
  cascade: ["\u540C\u8272\u7EAF\u5854\u4F1A\u81EA\u52A8\u878D\u5408\uFF0C\u51D1\u6EE1 10 \u5C31\u6D88", "Same-colour pure towers fuse; ten clears"],
  finiteSupply: ["\u68CB\u5B50\u6709\u9650\uFF0C\u522B\u4E71\u4E22", "Pieces are limited \u2014 place with care"],
  timed: ["\u9650\u65F6\u5173\uFF1A\u5148\u60F3\u597D\u957F\u94FE\u518D\u52A8\u624B", "Timed: plan the chain first"],
  obstacle: ["\u6696\u7070\u5706\u67F1\u4F1A\u79FB\u52A8\uFF0C\u522B\u628A\u8DEF\u5835\u6B7B", "The pillar moves \u2014 keep your lanes open"],
  checkmate: ["\u516D\u8272\u5404\u6D88\u4E00\u7EC4\u5373\u4E3A\u300C\u5C06\u6740\u300D", "Clear a full tower of each colour: checkmate"]
};

// src/scene/menus.ts
function button(ctx, hits, r, text, id, tone = "plain") {
  ctx.save();
  ctx.fillStyle = tone === "primary" ? COLOR.ok : "rgba(255,255,255,0.88)";
  roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = tone === "primary" ? "rgba(0,0,0,0.05)" : "rgba(150,138,124,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = tone === "primary" ? "#FFFFFF" : COLOR.ink;
  ctx.font = font(r.h * 0.38, true);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
  hits.add(id, r, 5);
}
var MenuScene = class {
  constructor(host) {
    this.host = host;
    this.name = "menu";
  }
  update() {
  }
  render(ctx, w, h) {
    const hits = this.host.hits;
    hits.clear();
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);
    const box = { x: 24, y: 24, w: w - 48, h: h - 48 };
    const parts = vstack(box, [{ id: "top", flex: 1 }, { id: "c1", h: 54 }, { id: "gap", h: 12 }, { id: "c2", h: 54 }, { id: "foot", h: 40 }], 0);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = box.x + box.w / 2;
    ctx.fillStyle = COLOR.ink;
    ctx.font = font(Math.min(52, box.w * 0.14), true);
    ctx.fillText(this.host.lang() === "zh" ? "\u516D\u8FB9\u667A\u5C06" : "HEXACHESS", cx, parts.top.y + parts.top.h * 0.42);
    ctx.font = font(15);
    ctx.fillStyle = COLOR.sub;
    ctx.fillText(
      this.host.lang() === "zh" ? "\u540C\u8272\u6210\u5854 \xB7 \u53E0\u6EE1\u5341\u5B50\u5373\u6D88" : "Stack one colour ten deep",
      cx,
      parts.top.y + parts.top.h * 0.42 + Math.min(62, box.w * 0.16)
    );
    ctx.font = font(13);
    ctx.fillText(
      (this.host.lang() === "zh" ? "\u5DF2\u89E3\u9501 " : "Unlocked ") + Math.min(TOTAL_LEVELS, this.host.save.unlocked) + " / " + TOTAL_LEVELS + "   " + (this.host.lang() === "zh" ? "\u6700\u9AD8\u5206 " : "Best ") + this.host.save.best,
      cx,
      parts.top.y + parts.top.h * 0.42 + Math.min(96, box.w * 0.24)
    );
    ctx.restore();
    const cont = this.host.save.unlocked > 1;
    button(ctx, hits, parts.c1, cont ? label("continue", this.host.lang()) + this.host.save.unlocked + (this.host.lang() === "zh" ? " \u5173" : "") : label("start", this.host.lang()), "btn.play", "primary");
    button(ctx, hits, parts.c2, label("levels", this.host.lang()), "btn.levels");
    const foot = hslice(parts.foot, 3, 8);
    button(ctx, hits, foot[1], label(this.host.save.muted ? "soundOff" : "soundOn", this.host.lang()), "btn.sound");
    button(ctx, hits, foot[2], this.host.lang() === "zh" ? "EN" : "\u4E2D\u6587", "btn.lang");
  }
  pointer(e) {
    if (e.phase !== "up") return;
    const id = this.host.hits.pick(e.x, e.y);
    if (!id) return;
    this.host.audio.play("click");
    if (id === "btn.play") this.host.replace("game", this.host.levelAt(Math.min(TOTAL_LEVELS, this.host.save.unlocked)));
    else if (id === "btn.levels") this.host.replace("levels");
    else if (id === "btn.sound") {
      this.host.save.muted = !this.host.save.muted;
      this.host.audio.setMuted(this.host.save.muted);
      this.host.persist();
    } else if (id === "btn.lang") {
      this.host.save.lang = this.host.lang() === "zh" ? "en" : "zh";
      this.host.persist();
    }
  }
};
var LevelsScene = class {
  constructor(host) {
    this.host = host;
    this.name = "levels";
    this.cols = 6;
  }
  update() {
  }
  render(ctx, w, h) {
    const hits = this.host.hits;
    hits.clear();
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);
    const box = { x: 18, y: 18, w: w - 36, h: h - 36 };
    const parts = vstack(box, [{ id: "head", h: 52 }, { id: "grid", flex: 1 }, { id: "back", h: 48 }], 8);
    ctx.save();
    ctx.fillStyle = COLOR.ink;
    ctx.font = font(20, true);
    ctx.textBaseline = "middle";
    ctx.fillText(this.host.lang() === "zh" ? "\u9009\u5173" : "Levels", parts.head.x, parts.head.y + 26);
    ctx.font = font(12.5);
    ctx.fillStyle = COLOR.sub;
    ctx.textAlign = "right";
    ctx.fillText(TOTAL_LEVELS + " " + (this.host.lang() === "zh" ? "\u5173 \xB7 \u6BCF\u5173\u90FD\u7ECF\u6C42\u89E3\u5668\u9A8C\u8BC1\u53EF\u89E3" : "levels \xB7 each verified solvable"), parts.head.x + parts.head.w, parts.head.y + 26);
    ctx.restore();
    const g = parts.grid;
    const cols = Math.max(4, Math.min(9, Math.floor(g.w / 62)));
    this.cols = cols;
    const rows = Math.ceil(TOTAL_LEVELS / cols);
    const cw = g.w / cols;
    const ch = g.h / rows;
    LEVELS.forEach((lv, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const cell = { x: g.x + c * cw + 3, y: g.y + r * ch + 3, w: cw - 6, h: ch - 6 };
      const open = isUnlocked(this.host.save.unlocked, lv.id);
      const stars = this.host.save.stars[String(lv.id)] || 0;
      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.4;
      ctx.fillStyle = open ? "rgba(255,255,255,0.9)" : "rgba(226,218,206,0.5)";
      roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, 10);
      ctx.fill();
      if (open) {
        ctx.strokeStyle = "rgba(150,138,124,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = COLOR.ink;
      ctx.font = font(Math.min(19, cell.w * 0.34), true);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(lv.id), cell.x + cell.w / 2, cell.y + cell.h * 0.38);
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? "#F7BE55" : "rgba(160,148,134,0.3)";
        ctx.beginPath();
        ctx.arc(cell.x + cell.w / 2 + (s - 1) * 11, cell.y + cell.h * 0.72, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (open) hits.add("lv:" + lv.id, cell, 4);
    });
    button(ctx, hits, parts.back, label("menu", this.host.lang()), "btn.back");
  }
  pointer(e) {
    if (e.phase !== "up") return;
    const id = this.host.hits.pick(e.x, e.y);
    if (!id) return;
    this.host.audio.play("click");
    if (id === "btn.back") return this.host.replace("menu");
    if (id.indexOf("lv:") === 0) {
      const lv = this.host.levelAt(Number(id.slice(3)));
      if (lv) this.host.replace("game", lv);
    }
  }
};

// src/platform/input.ts
function createInput(platform) {
  let handler = () => {
  };
  let active = null;
  let ignoreNewDown = false;
  const emit = (e) => handler(e);
  platform.onPointerDown((p) => {
    if (active !== null) return;
    if (ignoreNewDown) return;
    active = p.id;
    emit({ x: p.x, y: p.y, id: p.id, phase: "down" });
  });
  platform.onPointerMove((p) => {
    if (active === null || p.id !== active) return;
    emit({ x: p.x, y: p.y, id: p.id, phase: "move" });
  });
  platform.onPointerUp((p) => {
    if (active === null || p.id !== active) return;
    active = null;
    emit({ x: p.x, y: p.y, id: p.id, phase: "up" });
  });
  return {
    on(cb) {
      handler = cb;
    },
    setIgnoreNewDown(v) {
      ignoreNewDown = v;
    },
    activeId() {
      return active;
    }
  };
}

// src/game.ts
var SAVE_KEY = "hexachess2.save";
var STEP = 1 / 120;
function loadSave(p) {
  const base = {
    unlocked: 1,
    stars: {},
    best: 0,
    muted: false,
    lang: "zh",
    items: { hint: 3, shuffle: 2, hammer: 2 }
  };
  try {
    const raw = p.storageGet(SAVE_KEY);
    if (!raw) return base;
    const j = JSON.parse(raw);
    return {
      ...base,
      ...j,
      stars: j.stars || {},
      items: { ...base.items, ...j.items || {} }
    };
  } catch {
    return base;
  }
}
function runGame(platform) {
  const canvas = platform.getCanvas();
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(platform.getDpr() || 1, 3);
  let W = 0;
  let H = 0;
  const resize = () => {
    const s = platform.getScreenSize();
    W = Math.max(240, Math.round(s.width));
    H = Math.max(320, Math.round(s.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (canvas.style) {
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    }
  };
  resize();
  const save = loadSave(platform);
  const audio = platform.audio || createNoopAudio();
  audio.setMuted(save.muted);
  const reduced = platform.prefersReducedMotion ? platform.prefersReducedMotion() : false;
  const query = platform.launchQuery ? platform.launchQuery() : {};
  const autoplay = query.autoplay === "1";
  const hits = new HitTree();
  const kit = createKit((w, h) => platform.createCanvas(w, h));
  const host = {
    hits,
    kit,
    audio,
    save,
    lang: () => save.lang,
    reducedMotion: () => reduced,
    autoplay: () => autoplay,
    totalLevels: () => TOTAL_LEVELS,
    levelAt: (id) => levelById(id),
    replace: (name, arg) => mgr.replace(name, arg),
    persist: () => {
      try {
        platform.storageSet(SAVE_KEY, JSON.stringify(save));
      } catch {
      }
    },
    rewardAd: async () => platform.ads ? platform.ads.showRewarded() : true,
    log: (...a) => platform.log(...a)
  };
  const mgr = new SceneManager();
  mgr.register(new MenuScene(host));
  mgr.register(new LevelsScene(host));
  mgr.register(new GameScene(host));
  const q = query;
  const startLevel = Number(q.level || 0);
  if (startLevel >= 1 && startLevel <= TOTAL_LEVELS) mgr.replace("game", levelById(startLevel));
  else mgr.replace("menu");
  const input = createInput(platform);
  input.on((e) => mgr.pointer(e));
  let last = Date.now();
  let acc = 0;
  const frame = () => {
    const now = Date.now();
    let dt = (now - last) / 1e3;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 30) {
      mgr.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 30) acc = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mgr.render(ctx, W, H);
    platform.raf(frame);
  };
  if (query.debug === "1" && typeof window !== "undefined") {
    window.__hexa = { host, mgr, scene: () => mgr.current(), st: () => mgr.current()?.st };
  }
  platform.raf(frame);
  platform.log("\u516D\u8FB9\u667A\u5C06 v2 \u5DF2\u542F\u52A8\uFF08\u6B63\u7EDF\u53E0\u6D88\u89C4\u5219 \xB7 \u6C42\u89E3\u5668\u9A8C\u8BC1\u5173\u5361 \xB7 \u8F6F\u6241\u5E73\uFF09");
}

// src/main.ts
runGame(createWxPlatform());
