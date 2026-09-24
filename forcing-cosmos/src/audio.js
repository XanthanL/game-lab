'use strict';
// 全部音频运行时用 WebAudio 合成：深空 chiptune BGM + 卡牌音效。零音频文件。
const Sound = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf, muted = false;
  const last = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5;
    comp.connect(master); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    musBus = ac.createGain(); musBus.gain.value = 0.34; musBus.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }

  /* ---------------- 音效 ---------------- */
  const sfx = {
    draw()   { if (!thr('draw', 40)) return; noise({ d: 0.05, v: 0.06, f: 5200, type: 'highpass' }); },
    hover()  { if (!thr('hov', 60)) return; tone({ f: 1200, d: 0.02, v: 0.02, type: 'triangle' }); },
    select() { tone({ f: 784, f2: 1568, d: 0.1, v: 0.1 }); tone({ f: 392, d: 0.14, type: 'triangle', v: 0.14 }); },
    deny()   { tone({ f: 180, f2: 90, d: 0.16, type: 'sawtooth', v: 0.16 }); },
    play()   { tone({ f: 600, f2: 1200, d: 0.07, v: 0.06, type: 'square' }); },
    slash()  { noise({ d: 0.12, v: 0.2, f: 4200, f2: 600, type: 'bandpass', q: 1.4 }); tone({ f: 900, f2: 200, d: 0.1, v: 0.09, type: 'sawtooth' }); },
    beam()   { tone({ f: 1500, f2: 180, d: 0.26, type: 'sawtooth', v: 0.16 }); noise({ d: 0.24, v: 0.12, f: 3000, f2: 400 }); },
    hit()    { if (!thr('hit', 30)) return; noise({ d: 0.05, v: 0.16, f: 2600, type: 'highpass' }); tone({ f: 200, f2: 70, d: 0.07, v: 0.09 }); },
    bighit() { noise({ d: 0.3, v: 0.34, f: 1800, f2: 70 }); tone({ f: 120, f2: 34, d: 0.3, type: 'sine', v: 0.42 }); },
    shield() { tone({ f: 300, f2: 620, d: 0.16, type: 'triangle', v: 0.14 }); tone({ f: 900, d: 0.1, type: 'sine', v: 0.06, t0: 0.05 }); },
    heal()   { [523, 659, 784].forEach((f, i) => tone({ f, d: 0.11, type: 'triangle', v: 0.12, t0: i * 0.055 })); },
    burn()   { noise({ d: 0.2, v: 0.12, f: 1200, f2: 300, type: 'bandpass', q: 2 }); },
    poison() { tone({ f: 220, f2: 160, d: 0.2, type: 'sawtooth', v: 0.07 }); noise({ d: 0.16, v: 0.06, f: 700, type: 'lowpass' }); },
    buff()   { [440, 587, 880].forEach((f, i) => tone({ f, d: 0.1, v: 0.08, t0: i * 0.05 })); },
    debuff() { tone({ f: 400, f2: 150, d: 0.22, type: 'square', v: 0.08 }); },
    hurt()   { tone({ f: 240, f2: 50, d: 0.28, type: 'sawtooth', v: 0.24 }); noise({ d: 0.22, v: 0.3, f: 800, f2: 90 }); },
    kill()   { noise({ d: 0.42, v: 0.4, f: 2000, f2: 60 }); tone({ f: 150, f2: 32, d: 0.4, type: 'sine', v: 0.5 }); },
    coin()   { if (!thr('coin', 40)) return; tone({ f: 1318, d: 0.05, v: 0.05 }); tone({ f: 1976, d: 0.09, v: 0.05, t0: 0.04 }); },
    levelup(){ [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.12, v: 0.09, t0: i * 0.055 })); },
    potion() { tone({ f: 500, f2: 1100, d: 0.14, type: 'sine', v: 0.1 }); noise({ d: 0.1, v: 0.06, f: 4000, type: 'highpass' }); },
    turn()   { [660, 880].forEach((f, i) => tone({ f, d: 0.08, v: 0.07, t0: i * 0.06 })); },
    eturn()  { [330, 247].forEach((f, i) => tone({ f, d: 0.1, v: 0.07, type: 'sawtooth', t0: i * 0.07 })); },
    charge() { tone({ f: 110, f2: 660, d: 0.6, type: 'sawtooth', v: 0.16 }); },
    nova()   { tone({ f: 90, f2: 1600, d: 0.7, type: 'sawtooth', v: 0.22 }); noise({ d: 0.9, v: 0.5, f: 4800, f2: 80 }); tone({ f: 60, f2: 28, d: 0.9, type: 'sine', v: 0.7 }); },
    win()    { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ f, d: 0.2, v: 0.11, t0: i * 0.1 })); },
    lose()   { [392, 349, 311, 233].forEach((f, i) => tone({ f, d: 0.4, v: 0.13, type: 'triangle', t0: i * 0.22 })); },
    warp()   { tone({ f: 200, f2: 2000, d: 0.5, type: 'sine', v: 0.14 }); noise({ d: 0.5, v: 0.2, f: 6000, f2: 300, type: 'bandpass' }); },
  };

  /* ---------------- BGM ----------------
   * 三套：0 探索（稀疏、空旷） / 1 战斗（推进） / 2 Boss（压迫）
   * 16 分音符步进，4 小节循环（64 步）
   */
  let musOn = false, nextT = 0, step = 0, track = 0;
  // 和声进行：[根音, 三和弦音级]
  const PROG = [
    [[45, [57, 60, 64]], [43, [55, 59, 62]], [41, [53, 57, 60]], [48, [55, 60, 64]]],   // 探索 Am-F-C-G
    [[45, [57, 60, 64]], [45, [57, 60, 64]], [50, [57, 62, 65]], [48, [55, 60, 64]]],   // 战斗
    [[45, [57, 60, 63]], [44, [56, 59, 62]], [45, [57, 60, 63]], [46, [58, 61, 64]]],   // Boss 半音下行
  ];
  // 主旋律：0 表示休止
  const MEL = [
    [76, 0, 0, 0, 72, 0, 74, 0, 76, 0, 0, 0, 69, 0, 72, 0, 71, 0, 0, 0, 72, 0, 74, 0, 76, 0, 0, 0, 0, 0, 0, 0],
    [69, 0, 72, 76, 81, 0, 79, 76, 77, 0, 76, 72, 69, 72, 77, 0, 76, 0, 79, 76, 72, 76, 79, 0, 81, 0, 79, 76, 74, 0, 72, 0],
    [81, 0, 81, 80, 81, 0, 76, 0, 82, 0, 82, 81, 82, 0, 77, 0, 81, 0, 84, 83, 81, 0, 76, 0, 80, 0, 83, 81, 80, 0, 76, 75],
  ];

  function playStep(s, t) {
    const bar = (s >> 4) & 3, b = s & 15, tr = track;
    const [root, ch] = PROG[tr][bar];
    const dly = t - ac.currentTime, D = musBus;
    const heavy = tr >= 1;
    // 底鼓
    if (b === 0 || b === 8 || (tr === 2 && (b === 6 || b === 14)) || (heavy && b === 11))
      tone({ f: tr === 0 ? 120 : 160, f2: 38, d: 0.14, type: 'sine', v: tr === 0 ? 0.4 : 0.55, t0: dly, dest: D });
    // 军鼓 / 噪声
    if ((b === 4 || b === 12) && heavy) {
      noise({ d: 0.12, v: 0.2, f: 2200, type: 'bandpass', q: 0.8, t0: dly, dest: D });
      tone({ f: 190, f2: 120, d: 0.06, type: 'triangle', v: 0.16, t0: dly, dest: D });
    }
    // hi-hat
    if (b % 2 === 1 || tr === 2) noise({ d: 0.025, v: tr === 0 ? 0.03 : 0.05, f: 8000, type: 'highpass', t0: dly, dest: D });
    // 贝斯
    if (b % 2 === 0 && (tr > 0 || b % 4 === 0))
      tone({ f: mtof(root + (b % 4 === 0 ? 0 : 12)), d: 0.12, type: 'sawtooth', v: tr === 0 ? 0.05 : 0.07, t0: dly, dest: D });
    // 铺底 pad
    if (b === 0) tone({ f: mtof(ch[0]), d: 1.2, type: 'triangle', v: tr === 0 ? 0.05 : 0.03, t0: dly, dest: D });
    tone({ f: mtof(ch[s % 3] + 12), d: 0.05, type: 'square', v: 0.016, t0: dly, dest: D });
    // 旋律
    if (b % 2 === 0) {
      const m = MEL[tr][bar * 8 + (b >> 1)];
      if (m) tone({ f: mtof(m), d: tr === 0 ? 0.3 : 0.16, type: tr === 0 ? 'triangle' : 'square', v: tr === 0 ? 0.05 : 0.045, t0: dly, dest: D });
    }
  }
  function schedule() {
    if (!ac || !musOn) return;
    const bpm = track === 0 ? 96 : track === 1 ? 150 : 168;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.12) {
      playStep(step, nextT);
      nextT += 60 / bpm / 4; step = (step + 1) % 64;
    }
  }

  return {
    init, sfx,
    music(on) { musOn = on; if (on) step = 0; },
    setTrack(t) { if (t === track) return; track = t; step = 0; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
})();
