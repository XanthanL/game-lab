/* ============================================================
 * 《妖怪夜市》audio.js —— WebAudio 芯片配乐与音效
 * 纯前端合成，无外部音频文件
 * ============================================================ */

window.AudioStage = (function () {
  "use strict";

  let ac = null;
  let master = null;
  let muted = false;
  let seqTimer = null;
  let currentBgm = null;

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  }

  function now() { return ac.currentTime; }

  /* ---------- 基础音符 ---------- */
  function note(freq, time, dur, type = "square", vol = 0.08, slide = 0) {
    if (!ac || muted) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), time + dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(master);
    o.start(time); o.stop(time + dur + 0.05);
  }

  function noise(time, dur, vol = 0.06, hp = 800) {
    if (!ac || muted) return;
    const len = Math.max(1, (dur * ac.sampleRate) | 0);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = hp;
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(time);
  }

  /* ---------- 音阶工具 ---------- */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function f(name) {
    // 形如 "A4" "#C5"
    let sharp = 0, s = name;
    if (s[0] === "#") { sharp = 1; s = s.slice(1); }
    const semitone = NOTE[s[0]] + sharp + (parseInt(s[1], 10) + 1) * 12;
    return 440 * Math.pow(2, (semitone - 69) / 12);
  }

  /* ---------- 背景音乐（简易步进音序器） ---------- */
  const BGM = {
    /* 神秘序幕：五声音阶慢板 */
    prologue: {
      bpm: 72, wave: "triangle",
      melody: ["E4", "-", "G4", "A4", "-", "B4", "A4", "-",
               "G4", "-", "E4", "D4", "-", "E4", "-", "-"],
      bass:   ["E2", "-", "-", "-", "A2", "-", "-", "-",
               "C3", "-", "-", "-", "B2", "-", "-", "-"],
    },
    /* 热闹的夜市：节奏加快 */
    market: {
      bpm: 116, wave: "square",
      melody: ["A4", "C5", "D5", "C5", "A4", "G4", "A4", "-",
               "E5", "D5", "C5", "D5", "A4", "-", "G4", "-"],
      bass:   ["A2", "A2", "F2", "F2", "C3", "C3", "G2", "G2",
               "A2", "A2", "F2", "F2", "C3", "G2", "A2", "-"],
    },
    /* 离别前夜：温柔 */
    tender: {
      bpm: 84, wave: "triangle",
      melody: ["C5", "-", "B4", "A4", "-", "G4", "A4", "-",
               "E4", "-", "G4", "A4", "-", "C5", "-", "-"],
      bass:   ["C3", "-", "-", "-", "G2", "-", "-", "-",
               "A2", "-", "-", "-", "F2", "-", "-", "-"],
    },
    /* 黎明：渐亮 */
    dawn: {
      bpm: 96, wave: "triangle",
      melody: ["C4", "E4", "G4", "C5", "-", "B4", "C5", "-",
               "D5", "-", "C5", "B4", "G4", "-", "C5", "-"],
      bass:   ["C3", "-", "E3", "-", "F2", "-", "G2", "-",
               "A2", "-", "G2", "-", "C3", "-", "-", "-"],
    },
  };

  function playBgm(name) {
    if (!ac) return;
    stopBgm();
    currentBgm = name;
    const song = BGM[name];
    if (!song) return;
    const stepDur = 60 / song.bpm / 2; // 八分音符
    let step = 0;
    let nextTime = now() + 0.1;

    function schedule() {
      if (currentBgm !== name) return;
      while (nextTime < now() + 0.4) {
        const i = step % song.melody.length;
        const m = song.melody[i];
        if (m && m !== "-") note(f(m), nextTime, stepDur * 1.6, song.wave, 0.055);
        const b = song.bass[i];
        if (b && b !== "-") note(f(b), nextTime, stepDur * 1.8, "triangle", 0.07);
        if (name === "market" && step % 4 === 2) noise(nextTime, 0.03, 0.015, 4000);
        nextTime += stepDur;
        step++;
      }
      seqTimer = setTimeout(schedule, 120);
    }
    schedule();
  }

  function stopBgm() {
    currentBgm = null;
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
  }

  /* ---------- 音效 ---------- */
  const SFX = {
    bell() {
      if (!ac) return;
      const t0 = now();
      note(880, t0, 1.4, "sine", 0.22);
      note(1320, t0, 1.0, "sine", 0.10);
      note(660, t0 + 0.02, 1.6, "sine", 0.12);
    },
    pop() {
      if (!ac) return;
      note(520, now(), 0.09, "square", 0.1, 260);
    },
    whoosh() {
      if (!ac) return;
      noise(now(), 0.35, 0.08, 600);
    },
    sparkle() {
      if (!ac) return;
      const t0 = now();
      [1046, 1318, 1568, 2093].forEach((fr, i) =>
        note(fr, t0 + i * 0.07, 0.18, "triangle", 0.08));
    },
    step() {
      if (!ac) return;
      noise(now(), 0.04, 0.03, 2000);
    },
    cock() {
      // 破晓号声
      if (!ac) return;
      const t0 = now();
      note(784, t0, 0.18, "sawtooth", 0.07);
      note(1046, t0 + 0.2, 0.2, "sawtooth", 0.07);
      note(1318, t0 + 0.42, 0.5, "sawtooth", 0.09);
    },
  };

  function sfx(name) { if (SFX[name]) SFX[name](); }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { init, playBgm, stopBgm, sfx, toggleMute };
})();
