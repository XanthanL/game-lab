/* Choir of Static — 可视化播放器
 * 播放 choir_of_static.mp3，用 Web Audio API 实时分析并绘制迷幻频谱环。
 * 建议通过本地服务器打开（py -m http.server 8000 → http://localhost:8000）
 */
"use strict";

const AUDIO_SRC = "choir_of_static.mp3";

// 歌曲段落（小节长 = 4 × 60/88 ≈ 2.727s，每段 4 小节 ≈ 10.909s）
const SECTIONS = [
  { start: 0.000,  name: "Intro",      tag: "Intro — 序曲" },
  { start: 10.909, name: "Verse A",    tag: "Verse A — 主题" },
  { start: 21.818, name: "Verse B",    tag: "Verse B — 装饰" },
  { start: 32.727, name: "Chorus I",   tag: "Chorus I — 光" },
  { start: 43.636, name: "Bridge",     tag: "Bridge — 雾中" },
  { start: 54.545, name: "Chorus II",  tag: "Chorus II — 满" },
  { start: 65.455, name: "Outro I",    tag: "Outro I — 散场" },
  { start: 76.364, name: "Outro II",   tag: "Outro II — 磁带停止" },
];

// ---------- 元素 ----------
const el = (id) => document.getElementById(id);
const btnPlay = el("play");
const seekEl = el("seek");
const volEl = el("vol");
const tCur = el("tCur");
const tDur = el("tDur");
const tagEl = document.querySelector(".section-tag");
const clockEl = document.querySelector(".clock");
const hintEl = el("hint");

// ---------- 音频 ----------
const audio = new Audio(AUDIO_SRC);
audio.preload = "auto";
audio.volume = volEl.value / 100;

let ctx = null;      // AudioContext（首次播放时创建，遵守浏览器手势策略）
let analyser = null;
let vizData = null;  // Uint8Array
let started = false;

// 是否 file:// 打开：此时 MediaElementSource 会被浏览器（Chrome/Edge）静音，
// 因此降级为「音频元素裸播放」——保证出声，但拿不到频谱数据。
const IS_FILE = location.protocol === "file:";

function ensureGraph() {
  if (ctx) return;
  if (IS_FILE) {
    // 本地文件模式：不建立 Web Audio 图，音频元素直接播放（file:// 下 audio 元素出声不受 CORS 限制）
    console.info("本地文件模式：仅音频播放，频谱可视化需本地服务器（py -m http.server 8000）");
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    const src = ctx.createMediaElementSource(audio);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    vizData = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) {
    // 极少数情况：仍可裸播放，只是无频谱
    console.warn("频谱分析不可用：", e);
    analyser = null;
  }
}

// ---------- 播放控制 ----------
function togglePlay() {
  ensureGraph();
  const willPlay = audio.paused;
  const go = () => {
    if (willPlay) audio.play().catch(() => showHint());
    else audio.pause();
  };
  // 首次点击时 AudioContext 处于 suspended，必须等 resume 完成再播放，
  // 否则 WebAudio 图不处理音频，会出现「看似在播但没声音」。
  if (ctx && ctx.state === "suspended") {
    ctx.resume().then(go).catch(go);
  } else {
    go();
  }
}

function showHint() {
  hintEl.classList.add("show");
  setTimeout(() => hintEl.classList.remove("show"), 6000);
}

btnPlay.addEventListener("click", togglePlay);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    togglePlay();
  }
});

audio.addEventListener("play", () => document.body.classList.add("playing"));
audio.addEventListener("pause", () => document.body.classList.remove("playing"));

audio.addEventListener("loadedmetadata", () => {
  if (isFinite(audio.duration)) {
    seekEl.max = Math.ceil(audio.duration);
    tDur.textContent = fmt(audio.duration);
  }
});
audio.addEventListener("ended", () => {
  document.body.classList.remove("playing");
  seekEl.value = 0;
  tCur.textContent = "0:00";
});

seekEl.addEventListener("input", () => {
  tCur.textContent = fmt(Number(seekEl.value));
});
seekEl.addEventListener("change", () => {
  if (isFinite(audio.duration)) audio.currentTime = Number(seekEl.value);
});
volEl.addEventListener("input", () => {
  audio.volume = volEl.value / 100;
});

function fmt(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}

function currentSection(t) {
  let cur = SECTIONS[0];
  for (const s of SECTIONS) {
    if (t >= s.start) cur = s;
    else break;
  }
  return cur;
}

// ---------- 迷幻背景 ----------
const bg = el("bg");
const bctx = bg.getContext("2d");
const BW = 160, BH = 90;
const off = document.createElement("canvas");
off.width = BW; off.height = BH;
const octx = off.getContext("2d");

function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function renderBg(t) {
  const img = octx.createImageData(BW, BH);
  const d = img.data;
  const hueBase = 268 + 26 * Math.sin(t * 0.06);
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      const v = Math.sin(x * 0.115 + t * 0.42) * Math.sin(y * 0.131 - t * 0.28)
              + Math.sin((x + y) * 0.052 + t * 0.16);
      const v2 = Math.sin(x * 0.31 - t * 0.65) * Math.cos(y * 0.23 + t * 0.43);
      const lum = 9 + 11 * (v * 0.5 + 0.5) + 5 * (v2 * 0.5 + 0.5);
      const sat = 52 + 26 * Math.sin(x * 0.05 + t * 0.10);
      const hue = hueBase + x * 0.9 + y * 0.6 + 14 * v2;
      const [r, g, b] = hsl2rgb(hue, sat, lum);
      const i = (y * BW + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(off, 0, 0, bg.width, bg.height);
}

// ---------- 胶片颗粒（JS 生成噪声纹理） ----------
function makeGrain() {
  const g = document.createElement("canvas");
  g.width = 240; g.height = 240;
  const gc = g.getContext("2d");
  const gi = gc.createImageData(240, 240);
  const d = gi.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  gc.putImageData(gi, 0, 0);
  el("grain").style.backgroundImage = `url(${g.toDataURL()})`;
}

// ---------- 频谱环可视化 ----------
const viz = el("viz");
const vctx = viz.getContext("2d");
let vw = 0, vh = 0;

function resizeViz() {
  const r = viz.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = r.width; vh = r.height;
  viz.width = Math.round(r.width * dpr);
  viz.height = Math.round(r.height * dpr);
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeViz);
resizeViz();

const BARS = 72;
const WAVE_PTS = 400;

function drawViz(t, playing) {
  vctx.clearRect(0, 0, vw, vh);
  const cx = vw / 2, cy = vh / 2;
  const R = Math.min(vw, vh) * 0.44;      // 频谱环外半径
  const Rin = R * 0.70;                    // 频谱环内半径
  const hueBase = 292 + 24 * Math.sin(t * 0.10);

  // 外圈细环（磁带盘外缘）
  vctx.beginPath();
  vctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
  vctx.strokeStyle = "rgba(236,228,248,0.10)";
  vctx.lineWidth = 1;
  vctx.stroke();

  // 频率数据 → 环形频谱条
  let levels = null;
  if (analyser && vizData) {
    analyser.getByteFrequencyData(vizData);
    levels = new Array(BARS);
    const maxBin = 230;                   // 约 0–5 kHz 覆盖旋律区
    for (let i = 0; i < BARS; i++) {
      const k0 = Math.floor(Math.pow(i / BARS, 1.6) * maxBin);
      const k1 = Math.max(k0 + 1, Math.floor(Math.pow((i + 1) / BARS, 1.6) * maxBin));
      let m = 0;
      for (let k = k0; k <= k1; k++) m = Math.max(m, vizData[k]);
      levels[i] = Math.pow(m / 255, 1.25);
    }
  }

  const startA = -Math.PI / 2 - Math.PI * 0.94;   // 顶部起，留一点缺口
  const span = Math.PI * 2 * 0.94;

  vctx.save();
  vctx.translate(cx, cy);
  for (let i = 0; i < BARS; i++) {
    const a = startA + (i / BARS) * span;
    const hgt = levels ? levels[i] * (R - Rin) + 1.5 : 1.5;
    const sat = 78 + 18 * Math.sin(t * 0.9 + i * 0.35);
    const hue = hueBase + i * 1.6;
    vctx.save();
    vctx.rotate(a);
    vctx.shadowColor = `hsl(${hue}, 90%, 62%)`;
    vctx.shadowBlur = 9;
    vctx.fillStyle = `hsl(${hue}, ${sat}%, ${50 + 26 * (hgt / (R - Rin))}%)`;
    vctx.fillRect(Rin - (hgt > 4 ? 1.2 : 1), -1.6, hgt, 3.2);
    vctx.restore();
  }
  vctx.restore();

  // 波形（时域）画在环内侧
  if (analyser && vizData) {
    const td = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(td);
    const Rw = Rin * 0.78;
    vctx.beginPath();
    for (let i = 0; i <= WAVE_PTS; i++) {
      const a = startA + (i / WAVE_PTS) * span;
      const v = (td[Math.floor(i * td.length / WAVE_PTS)] - 128) / 128;
      const rr = Rw + v * Rw * 0.5;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) vctx.moveTo(x, y); else vctx.lineTo(x, y);
    }
    vctx.strokeStyle = playing
      ? "rgba(0, 224, 208, 0.5)"
      : "rgba(236, 228, 248, 0.18)";
    vctx.lineWidth = 1.2;
    vctx.stroke();
  }
}

// ---------- 主循环 ----------
let lastTag = "";
function frame(now) {
  const t = now / 1000;
  renderBg(t);

  const cur = audio.currentTime || 0;
  const playing = !audio.paused && !audio.ended;

  // 进度 UI（节流：仅当变化超过 0.05s 或拖动中不更新滑块值）
  if (!seekEl.matches(":active")) {
    if (isFinite(cur)) {
      seekEl.value = Math.min(Math.floor(cur), seekEl.max);
      tCur.textContent = fmt(cur);
    }
  }
  clockEl.textContent = `${fmt(cur)} / ${fmt(audio.duration)}`;

  // 段落标签
  const sec = currentSection(cur);
  if (sec.name !== lastTag) {
    lastTag = sec.name;
    tagEl.textContent = sec.tag;
    tagEl.classList.remove("flash");
    void tagEl.offsetWidth;              // 重启动画
    tagEl.classList.add("flash");
  }

  drawViz(t, playing);
  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
function boot() {
  makeGrain();
  if (IS_FILE) {
    el("fileBanner").classList.add("show");
    el("bannerClose").addEventListener("click", () => el("fileBanner").classList.remove("show"));
  }
  requestAnimationFrame(frame);
  audio.addEventListener("error", () => showHint());
}
boot();
