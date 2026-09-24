'use strict';
// 奇点旅途 — 全部声音运行时用 WebAudio 合成：太空 chiptune BGM + SFX。
// 架构沿用终焉防火墙：tone() / noise() / thr() 三件套，无外部资源。
const Sound = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf, muted = false;
  let volBgm = 1, volSfx = 1;   // 0..1，从存档恢复；init() 之前就设也生效
  const last = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function applyVol() {
    if (!ac) return;
    master.gain.value = muted ? 0 : 0.55;
    sfxBus.gain.value = 0.9 * volSfx;
    musBus.gain.value = 0.4 * volBgm;
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.55;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    comp.connect(master); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    musBus = ac.createGain(); musBus.gain.value = 0.4; musBus.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
    setInterval(schedule, 25);
  }

  function thr(name, ms) {
    const n = performance.now();
    if (last[name] && n - last[name] < ms) return false;
    last[name] = n; return true;
  }

  function tone({ f = 440, f2, d = 0.1, type = 'square', v = 0.2, t0 = 0, dest }) {
    if (!ac) return;
    const t = ac.currentTime + t0;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + d + 0.02);
  }

  function noise({ d = 0.1, v = 0.2, f = 2000, f2, type = 'lowpass', q = 1, t0 = 0, dest }) {
    if (!ac) return;
    const t = ac.currentTime + t0;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }

  // ---------------- SFX ----------------
  const sfx = {
    // 主炮：短促下扫方波 + 高通噪声，密集开火时靠 thr 节流
    shoot() { if (!thr('shoot', 48)) return; tone({ f: 760 + Math.random() * 90, f2: 220, d: 0.05, v: 0.04 }); noise({ d: 0.03, v: 0.035, f: 7000, type: 'highpass' }); },
    drone() { if (!thr('drone', 90)) return; tone({ f: 1400, f2: 800, d: 0.04, v: 0.022 }); },
    hit() { if (!thr('hit', 38)) return; noise({ d: 0.035, v: 0.09, f: 4000, type: 'highpass' }); tone({ f: 240, f2: 100, d: 0.045, v: 0.055 }); },
    kill() { if (!thr('kill', 32)) return; noise({ d: 0.16, v: 0.2, f: 2400, f2: 160 }); tone({ f: 190, f2: 44, d: 0.13, type: 'triangle', v: 0.28 }); },
    bigKill() { if (!thr('big', 80)) return; noise({ d: 0.55, v: 0.45, f: 1800, f2: 50 }); tone({ f: 110, f2: 26, d: 0.45, type: 'sine', v: 0.7 }); tone({ f: 220, f2: 38, d: 0.26, type: 'square', v: 0.12 }); },
    // 星尘拾取：清脆两声上行
    dust() { if (!thr('dust', 40)) return; tone({ f: 1245, d: 0.045, v: 0.045 }); tone({ f: 1868, d: 0.08, v: 0.045, t0: 0.04 }); },
    energy() { if (!thr('en', 60)) return; tone({ f: 520, f2: 1500, d: 0.08, type: 'sine', v: 0.075 }); },
    heal() { [523, 659, 784].forEach((f, i) => tone({ f, d: 0.1, type: 'triangle', v: 0.15, t0: i * 0.06 })); },
    hurt() { tone({ f: 280, f2: 50, d: 0.3, type: 'sawtooth', v: 0.26 }); noise({ d: 0.25, v: 0.32, f: 1100, f2: 90 }); },
    // 助推冲刺：带通噪声扫频，像推进器点火
    dash() { noise({ d: 0.18, v: 0.16, f: 900, f2: 4200, type: 'bandpass', q: 2 }); tone({ f: 180, f2: 640, d: 0.14, type: 'sawtooth', v: 0.07 }); },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, d: 0.12, v: 0.09, t0: i * 0.055 })); },
    select() { tone({ f: 784, f2: 1568, d: 0.12, v: 0.12 }); tone({ f: 392, d: 0.2, type: 'triangle', v: 0.2 }); noise({ d: 0.3, v: 0.14, f: 6000, f2: 900 }); },
    ready() { [880, 1175, 1760].forEach((f, i) => tone({ f, d: 0.09, v: 0.08, t0: i * 0.07 })); },
    overdrive() { tone({ f: 80, f2: 1600, d: 0.55, type: 'sawtooth', v: 0.22 }); noise({ d: 1.1, v: 0.48, f: 6000, f2: 70 }); tone({ f: 60, f2: 28, d: 0.9, type: 'sine', v: 0.8, t0: 0.05 }); },
    warn() { for (let i = 0; i < 6; i++) tone({ f: i % 2 ? 466 : 622, d: 0.22, type: 'square', v: 0.09, t0: i * 0.25 }); },
    zap() { if (!thr('zap', 70)) return; noise({ d: 0.14, v: 0.2, f: 5000, type: 'highpass' }); tone({ f: 1700, f2: 140, d: 0.12, v: 0.08, type: 'sawtooth' }); },
    boom() { if (!thr('boom', 55)) return; noise({ d: 0.28, v: 0.3, f: 1700, f2: 80 }); tone({ f: 130, f2: 38, d: 0.25, type: 'sine', v: 0.4 }); },
    // Boss 大激光：长下扫 + 低频冲击
    laser() { tone({ f: 2000, f2: 70, d: 0.9, type: 'sawtooth', v: 0.2 }); noise({ d: 1.0, v: 0.55, f: 3200, f2: 55 }); tone({ f: 52, f2: 24, d: 1.0, type: 'sine', v: 0.9 }); },
    lock() { tone({ f: 1760, d: 0.06, v: 0.06 }); tone({ f: 1760, d: 0.06, v: 0.06, t0: 0.12 }); },
    graze() { if (!thr('graze', 70)) return; tone({ f: 2600, f2: 3200, d: 0.03, v: 0.03, type: 'triangle' }); },
    eshot() { if (!thr('eshot', 110)) return; tone({ f: 320, f2: 150, d: 0.06, v: 0.032 }); },
    nova() { noise({ d: 0.4, v: 0.24, f: 7000, f2: 380, type: 'bandpass', q: 1.5 }); tone({ f: 1300, f2: 320, d: 0.3, type: 'triangle', v: 0.12 }); },
    // 护盾：金属感的短金属击
    shield() { tone({ f: 1200, f2: 2200, d: 0.09, type: 'square', v: 0.07 }); tone({ f: 800, d: 0.16, type: 'triangle', v: 0.1 }); },
    // 跃迁：上行扫频，段落切换时播放
    warp() { tone({ f: 160, f2: 2400, d: 0.7, type: 'sawtooth', v: 0.14 }); noise({ d: 0.8, v: 0.3, f: 400, f2: 8000, type: 'bandpass', q: 1.2 }); },
    // 低血量心跳：两下闷响
    heart() {
      tone({ f: 62, f2: 34, d: 0.16, type: 'sine', v: 0.5 });
      tone({ f: 52, f2: 30, d: 0.13, type: 'sine', v: 0.32, t0: 0.19 });
      noise({ d: 0.1, v: 0.07, f: 260 });
    },
    // 模块质变：厚重上行 + 金属泛音
    bloom() {
      [392, 523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.16, type: 'triangle', v: 0.12, t0: i * 0.055 }));
      noise({ d: 0.5, v: 0.2, f: 6000, f2: 900, type: 'bandpass', q: 1.4 });
      tone({ f: 98, d: 0.5, type: 'sine', v: 0.3 });
    },
    // 协同激活：两声上行金属音
    synergy() {
      tone({ f: 880, f2: 1320, d: 0.1, type: 'square', v: 0.08 });
      tone({ f: 1175, f2: 1760, d: 0.14, type: 'square', v: 0.07, t0: 0.09 });
    },
  };

  // ---------------- BGM ----------------
  // 四个段落：title(空灵) / cruise(巡航) / battle(战斗) / boss(巨像)
  let musOn = false, nextT = 0, step = 0, mode = 'title';
  // 每小节一个 [低音根音, 三和弦琶音]
  const PROG = {
    title:  [[45, [57, 60, 64]], [43, [55, 59, 62]], [41, [53, 57, 60]], [48, [55, 60, 64]]],
    cruise: [[45, [57, 60, 64]], [48, [55, 60, 64]], [43, [55, 59, 62]], [41, [53, 56, 60]]],
    battle: [[45, [57, 60, 64]], [46, [58, 62, 65]], [45, [57, 60, 64]], [44, [56, 59, 63]]],
    boss:   [[40, [52, 55, 59]], [40, [52, 55, 59]], [41, [53, 56, 60]], [39, [51, 55, 58]]],
  };
  const MEL = {
    title:  [72, 0, 0, 76, 0, 79, 0, 0, 77, 0, 0, 74, 0, 0, 72, 0, 69, 0, 0, 72, 0, 76, 0, 0, 74, 0, 0, 71, 0, 0, 69, 0],
    cruise: [69, 0, 72, 76, 81, 79, 76, 72, 77, 0, 76, 72, 69, 72, 77, 76, 76, 0, 79, 76, 72, 76, 79, 84, 83, 0, 81, 79, 74, 79, 83, 81],
    battle: [81, 0, 81, 80, 81, 0, 76, 0, 82, 0, 82, 81, 82, 0, 77, 0, 81, 0, 84, 83, 81, 0, 76, 0, 80, 0, 83, 81, 80, 0, 76, 75],
    boss:   [64, 0, 64, 0, 67, 0, 64, 0, 62, 0, 64, 0, 66, 0, 67, 0, 64, 0, 64, 0, 71, 0, 70, 0, 67, 0, 66, 0, 64, 0, 62, 0],
  };
  const BPM = { title: 96, cruise: 132, battle: 158, boss: 172 };

  function playStep(s, t) {
    const P = PROG[mode], M = MEL[mode];
    const bar = (s >> 4) & 3, b = s & 15;
    const [root, ch] = P[bar];
    const dly = t - ac.currentTime;
    const D = musBus;
    const heavy = mode === 'boss' || mode === 'battle';
    // 底鼓
    if (b === 0 || b === 8 || (heavy && (b === 6 || b === 14)) || b === 11)
      tone({ f: mode === 'title' ? 120 : 160, f2: 36, d: 0.14, type: 'sine', v: 0.55, t0: dly, dest: D });
    // 军鼓 / 噪声拍
    if (b === 4 || b === 12) {
      noise({ d: 0.12, v: mode === 'title' ? 0.1 : 0.22, f: 2400, type: 'bandpass', q: 0.8, t0: dly, dest: D });
      if (heavy) tone({ f: 190, f2: 110, d: 0.06, type: 'triangle', v: 0.2, t0: dly, dest: D });
    }
    // hi-hat
    if (b % 2 === 1) noise({ d: 0.025, v: 0.045, f: 9000, type: 'highpass', t0: dly, dest: D });
    // 贝斯
    if (b % 2 === 0) tone({ f: mtof(root - (mode === 'boss' ? 12 : 0)), d: 0.11, type: mode === 'title' ? 'triangle' : 'sawtooth', v: 0.08, t0: dly, dest: D });
    // 琶音
    tone({ f: mtof(ch[s % 3] + 12), d: 0.05, type: 'square', v: 0.016, t0: dly, dest: D });
    // 主旋律
    if (b % 2 === 0) {
      const m = M[bar * 8 + (b >> 1)];
      if (m) tone({ f: mtof(m), d: 0.16, type: mode === 'title' ? 'triangle' : 'square', v: mode === 'title' ? 0.05 : 0.045, t0: dly, dest: D });
    }
  }

  function schedule() {
    if (!ac || !musOn) return;
    const bpm = BPM[mode] || 132;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.12) {
      playStep(step, nextT);
      nextT += 60 / bpm / 4; step = (step + 1) % 64;
    }
  }

  return {
    init, sfx,
    music(on) { musOn = on; if (on) step = 0; },
    setMode(m) { if (PROG[m]) mode = m; },
    toggleMute() { muted = !muted; applyVol(); return muted; },
    get muted() { return muted; },
    // 音量 0..1；ac 还没建也先存着，init() 时会一起应用
    setVolumes(v) {
      if (v && typeof v.bgm === 'number') volBgm = Math.max(0, Math.min(1, v.bgm));
      if (v && typeof v.sfx === 'number') volSfx = Math.max(0, Math.min(1, v.sfx));
      applyVol();
    },
    get vol() { return { bgm: volBgm, sfx: volSfx }; },
  };
})();
