/* ============================================================
   三体 · 像素歌剧 — 音频引擎
   全部声音由 Web Audio API 程序化合成，无外部音频文件。
   ============================================================ */

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

/* 和弦性质：根音上方半音间隔 */
const QUALS = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], dim: [0, 3, 6], sus: [0, 5, 7] };

/* 每幕配乐主题配置 */
const THEMES = {
  overture:    { bpm: 76,  root: 45, chords: [[0,'m'],[-4,'M'],[5,'M'],[-2,'M']], pad: .8,  bass: .7,  arp: .3,  mel: .10, wave: 'sawtooth', cut: 850,  drums: 0 },
  redcoast:    { bpm: 62,  root: 43, chords: [[0,'m'],[0,'m'],[-4,'M'],[-2,'M']], pad: .7,  bass: .55, arp: .14, mel: .13, wave: 'triangle', cut: 700,  drums: 0 },
  trisolaris:  { bpm: 92,  root: 41, chords: [[0,'m'],[1,'M'],[0,'m'],[-2,'dim']],pad: .75, bass: .8,  arp: .38, mel: .08, wave: 'sawtooth', cut: 1200, drums: 1 },
  guzheng:     { bpm: 104, root: 38, chords: [[0,'m'],[0,'m7'],[-1,'M'],[-2,'M']],pad: .4,  bass: .9,  arp: .2,  mel: .04, wave: 'square',   cut: 500,  drums: 2 },
  sophon:      { bpm: 58,  root: 47, chords: [[0,'m'],[1,'sus'],[0,'m'],[2,'dim']],pad: .8, bass: .4,  arp: .1,  mel: .06, wave: 'sine',     cut: 2400, drums: 0 },
  darkforest:  { bpm: 66,  root: 40, chords: [[0,'m'],[-5,'M'],[-4,'M'],[-2,'sus']],pad:.85,bass: .6,  arp: .2,  mel: .12, wave: 'triangle', cut: 900,  drums: 0 },
  doomsday:    { bpm: 138, root: 38, chords: [[0,'m'],[0,'m'],[-2,'M'],[-1,'M']], pad: .55, bass: 1,   arp: .3,  mel: .05, wave: 'sawtooth', cut: 1500, drums: 3 },
  deterrence:  { bpm: 72,  root: 45, chords: [[0,'M'],[-3,'M'],[5,'M'],[-2,'m']], pad: .85,  bass: .6,  arp: .3,  mel: .14, wave: 'triangle', cut: 1100, drums: 0 },
  finale:      { bpm: 80,  root: 45, chords: [[0,'M'],[5,'M'],[-3,'M'],[-2,'M']], pad: .9,   bass: .65, arp: .42, mel: .16, wave: 'sawtooth', cut: 1300, drums: 1 },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._sched = null;
    this.currentTheme = null;
    this._noiseBuf = null;
    this._melNote = 0;
  }

  /* 必须由用户手势触发 */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = .85;
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = .5;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = .9;
    /* 简易空间感：反馈延迟 */
    this.delay = this.ctx.createDelay(1); this.delay.delayTime.value = .29;
    this.fb = this.ctx.createGain(); this.fb.gain.value = .32;
    this.wet = this.ctx.createGain(); this.wet.gain.value = .22;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.delay);
    this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delay.connect(this.wet); this.wet.connect(this.master);
    this.master.connect(this.ctx.destination);
    /* 预生成噪声缓冲 */
    const len = this.ctx.sampleRate * 2;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume()  { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  suspend() { if (this.ctx && this.ctx.state === 'running')  this.ctx.suspend(); }
  setMute(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : .85, this.ctx.currentTime, .05);
  }
  now() { return this.ctx.currentTime; }

  /* ---------- 基础发声 ---------- */
  tone(o) {
    if (!this.ctx) return;
    const t = o.time !== undefined ? o.time : this.now();
    const dur = o.dur || .2;
    const osc = this.ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq || 440, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const g = this.ctx.createGain();
    const atk = o.attack !== undefined ? o.attack : .008;
    const gv = o.gain !== undefined ? o.gain : .15;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gv, t + atk);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let head = osc;
    if (o.detune) {
      const o2 = this.ctx.createOscillator();
      o2.type = osc.type; o2.frequency.setValueAtTime((o.freq || 440) * 1.006, t);
      if (o.slide) o2.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide * 1.006), t + dur);
      o2.connect(g); o2.start(t); o2.stop(t + dur + .05);
    }
    if (o.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.filter; f.Q.value = o.q || .8;
      head.connect(f); f.connect(g);
    } else head.connect(g);
    g.connect(o.bus || this.musicBus);
    osc.start(t); osc.stop(t + dur + .05);
  }

  noise(o) {
    if (!this.ctx) return;
    const t = o.time !== undefined ? o.time : this.now();
    const dur = o.dur || .4;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.filter || 1000, t);
    if (o.slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.slideTo), t + dur);
    f.Q.value = o.q || .7;
    const g = this.ctx.createGain();
    const gv = o.gain !== undefined ? o.gain : .25;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gv, t + (o.attack || .01));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
    src.start(t); src.stop(t + dur + .05);
  }

  /* ---------- 配乐音序器 ---------- */
  startTheme(name) {
    if (!this.ctx) return;
    if (this.currentTheme === name) return;
    this.stopTheme();
    const T = THEMES[name]; if (!T) return;
    this.currentTheme = name;
    this._melNote = 0;
    const stepDur = 60 / T.bpm / 4;
    let step = 0;
    let nextT = this.now() + .12;
    this._sched = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      while (nextT < this.now() + .2) {
        this._step(T, step, nextT, stepDur);
        step++; nextT += stepDur;
      }
    }, 45);
  }
  stopTheme() {
    if (this._sched) { clearInterval(this._sched); this._sched = null; }
    this.currentTheme = null;
  }

  _step(T, step, t, sd) {
    const SPC = 16; /* 每和弦16步 */
    const ci = Math.floor(step / SPC) % T.chords.length;
    const [cr, qual] = T.chords[ci];
    const tones = QUALS[qual];
    const root = T.root + cr;
    /* Pad：和弦开始 */
    if (T.pad > 0 && step % SPC === 0)
      tones.forEach(iv => this.tone({ freq: mtof(root + iv + 12), dur: sd * SPC * 1.02, type: T.wave, gain: .045 * T.pad, attack: sd * 6, filter: T.cut, detune: true, time: t }));
    /* Bass：八分音符 */
    if (T.bass > 0 && step % 2 === 0)
      this.tone({ freq: mtof(root - 12), dur: sd * 1.7, type: 'triangle', gain: .11 * T.bass, attack: .01, time: t });
    /* Arp：十六分概率 */
    if (T.arp > 0 && Math.random() < T.arp) {
      const iv = tones[step % tones.length] + 24;
      this.tone({ freq: mtof(root + iv), dur: sd * 1.1, type: 'square', gain: .035, filter: T.cut + 900, time: t });
    }
    /* 咏叹旋律：小调随机漫步 */
    if (T.mel > 0 && step % 2 === 0 && Math.random() < T.mel) {
      const scale = [0, 2, 3, 5, 7, 8, 10];
      this._melNote += Math.floor(Math.random() * 5) - 2;
      this._melNote = Math.max(-4, Math.min(8, this._melNote));
      const oct = Math.floor(this._melNote / 7), idx = ((this._melNote % 7) + 7) % 7;
      this.tone({ freq: mtof(root + 24 + scale[idx] + oct * 12), dur: sd * 5, type: 'triangle', gain: .08, attack: .05, time: t });
    }
    /* 打击 */
    if (T.drums > 0) {
      if (step % 8 === 0) this.tone({ freq: 120, slide: 38, dur: .16, type: 'sine', gain: .3, bus: this.sfxBus, time: t }); // kick
      if (step % 4 === 2) this.noise({ dur: .04, filter: 7000, type: 'highpass', gain: .05, time: t }); // hat
      if (T.drums >= 2 && step % 16 === 8) this.noise({ dur: .14, filter: 1800, type: 'bandpass', gain: .14, q: 1.2, time: t }); // snare
      if (T.drums >= 3 && step % 16 === 14) this.tone({ freq: 90, slide: 40, dur: .12, type: 'sine', gain: .22, bus: this.sfxBus, time: t });
    }
  }

  /* ---------- 音效 ---------- */
  sfxBeep(f = 880, d = .09) { this.tone({ freq: f, dur: d, type: 'square', gain: .1, bus: this.sfxBus }); }
  sfxTick() { this.tone({ freq: 1600, dur: .03, type: 'square', gain: .06, bus: this.sfxBus }); }
  sfxAlarm() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 740, dur: .18, type: 'square', gain: .1, bus: this.sfxBus, time: this.now() + i * .44 });
      this.tone({ freq: 520, dur: .18, type: 'square', gain: .1, bus: this.sfxBus, time: this.now() + i * .44 + .22 });
    }
  }
  sfxPress() {
    this.tone({ freq: 220, slide: 60, dur: .14, type: 'square', gain: .2, bus: this.sfxBus });
    this.noise({ dur: .05, filter: 3000, gain: .12 });
  }
  sfxBoom(big = 1) {
    this.noise({ dur: 1.1 * big, filter: 900, slideTo: 60, gain: .4 * big, q: .5 });
    this.tone({ freq: 90, slide: 28, dur: .9 * big, type: 'sine', gain: .5 * big, bus: this.sfxBus });
  }
  sfxZap() {
    this.tone({ freq: 1500, slide: 90, dur: .3, type: 'sawtooth', gain: .16, filter: 2400, bus: this.sfxBus });
  }
  sfxWhoosh() {
    this.noise({ dur: .8, filter: 400, slideTo: 3200, type: 'bandpass', gain: .18, q: 1.4 });
  }
  sfxChime(f = 1046) {
    this.tone({ freq: f, dur: 1.6, type: 'sine', gain: .12, attack: .01, bus: this.sfxBus });
    this.tone({ freq: f * 2.01, dur: 1.2, type: 'sine', gain: .05, attack: .01, bus: this.sfxBus });
  }
  sfxPing() { /* 水滴金属声 */
    this.tone({ freq: 2240, dur: .5, type: 'square', gain: .06, attack: .001, filter: 4000, bus: this.sfxBus });
    this.tone({ freq: 3310, dur: .34, type: 'sine', gain: .07, attack: .001, bus: this.sfxBus });
  }
  sfxSplash() {
    this.noise({ dur: .35, filter: 1100, slideTo: 300, gain: .22 });
    this.tone({ freq: 300, slide: 90, dur: .22, type: 'sine', gain: .12, bus: this.sfxBus });
  }
  sfxCrack() {
    this.noise({ dur: .08, filter: 2600, type: 'bandpass', gain: .28, q: 2 });
    this.noise({ dur: .2, filter: 500, gain: .15, time: this.now() + .05 });
  }
  sfxHeartbeat() {
    const t = this.now();
    this.tone({ freq: 58, dur: .14, type: 'sine', gain: .4, bus: this.sfxBus, time: t });
    this.tone({ freq: 52, dur: .18, type: 'sine', gain: .3, bus: this.sfxBus, time: t + .3 });
  }
  sfxRumble(dur = 3) { /* 持续低鸣 */
    this.noise({ dur, filter: 140, gain: .3, q: .4, attack: dur * .3 });
  }
  sfxSlice() { /* 飞刃切割 */
    this.noise({ dur: .5, filter: 5200, slideTo: 900, type: 'bandpass', gain: .14, q: 3 });
    this.tone({ freq: 3400, slide: 700, dur: .4, type: 'sine', gain: .05, bus: this.sfxBus });
  }
  sfxApplause() {
    const t0 = this.now();
    for (let i = 0; i < 130; i++) {
      const t = t0 + Math.random() * 3.2;
      this.noise({ dur: .03 + Math.random() * .04, filter: 1200 + Math.random() * 2500, type: 'bandpass', gain: .05 + Math.random() * .08, q: 1.6, time: t });
    }
    this.noise({ dur: 3.4, filter: 900, gain: .05, attack: .4 });
  }
}

window.AUDIO = new AudioEngine();
