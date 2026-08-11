(function () {
  'use strict';

  // Web Audio 程序化合成音效与 BGM，无音频文件
  let actx = null;
  let master = null;
  let bgmTimer = null;
  let bgmStep = 0;

  function ensure() {
    if (actx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = PVZ.save.getSettings().volume;
      master.connect(actx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, opts) {
    if (!ensure()) return;
    opts = opts || {};
    const t = actx.currentTime;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t + dur);
    g.gain.setValueAtTime(opts.vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = actx.currentTime;
    const n = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, n, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource();
    src.buffer = buf;
    const f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 800;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  const SOUNDS = {
    plant: () => { tone(320, 0.08, { type: 'square', freqEnd: 180 }); },
    shoot: () => { tone(520, 0.06, { type: 'square', freqEnd: 420 }); },
    eat: () => { tone(140, 0.09, { type: 'triangle', freqEnd: 90 }); },
    boom: () => { noise(0.5, 0.5, 600); tone(90, 0.5, { type: 'sawtooth', freqEnd: 30, vol: 0.25 }); },
    sun: () => { tone(1046, 0.09, { type: 'sine' }); tone(1568, 0.14, { type: 'sine', vol: 0.08 }); },
    die: () => { tone(420, 0.3, { type: 'sawtooth', freqEnd: 70, vol: 0.1 }); },
    click: () => { tone(700, 0.05, { type: 'square', vol: 0.06 }); },
    zombieSpawn: () => { tone(160, 0.4, { type: 'sawtooth', freqEnd: 120, vol: 0.05 }); },
    chomp: () => { noise(0.18, 0.35, 500); tone(120, 0.18, { type: 'sawtooth', freqEnd: 60, vol: 0.12 }); },
    torch: () => { noise(0.25, 0.25, 1400); tone(880, 0.2, { type: 'sine', freqEnd: 1200, vol: 0.06 }); },
    armorBreak: () => { noise(0.12, 0.4, 2600); tone(420, 0.1, { type: 'square', freqEnd: 200, vol: 0.1 }); },
    shovel: () => { noise(0.12, 0.3, 700); },
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => tone(f, 0.25, { type: 'sine', vol: 0.12 }), i * 180);
      });
    },
    lose: () => {
      [400, 300, 220].forEach((f, i) => {
        setTimeout(() => tone(f, 0.35, { type: 'triangle', vol: 0.12 }), i * 220);
      });
    }
  };

  const BGM_NOTES = [110, 0, 130, 0, 146, 0, 98, 0, 123, 0, 87, 0, 130, 0, 110, 0];

  PVZ.audio = {
    init() {
      ensure();
      if (actx && actx.state === 'suspended') actx.resume();
    },

    play(name) {
      const fn = SOUNDS[name];
      if (fn) fn();
    },

    setVolume(v) {
      if (master) master.gain.value = v;
    },

    startBGM() {
      if (!ensure() || bgmTimer) return;
      bgmStep = 0;
      bgmTimer = setInterval(() => {
        const f = BGM_NOTES[bgmStep % BGM_NOTES.length];
        if (f) tone(f, 0.4, { type: 'triangle', vol: 0.045 });
        bgmStep++;
      }, 420);
    },

    stopBGM() {
      if (bgmTimer) {
        clearInterval(bgmTimer);
        bgmTimer = null;
      }
    }
  };
})();
