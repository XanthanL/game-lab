'use strict';
/* ═══════════════════════════════════════════════
   Sfx — 温暖风格音效引擎（Web Audio API，零资源）
   火柴、灯火、风声、雨声、音乐盒音阶……
   ═══════════════════════════════════════════════ */
const Sfx = (() => {
  let ctx = null, master = null, _muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  }

  /* 单音：方波/三角波/正弦/锯齿，可滑音 */
  function tone(freq, dur, type = 'triangle', vol = 0.5, delay = 0, slideTo = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  /* 噪声：风/雨/火柴 */
  function noise(dur, vol = 0.5, delay = 0, lp = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = src;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lp;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(master); src.start(t0);
  }

  /* 乐句序列：[[freq,dur,type,vol], ...] */
  function seq(notes, delay = 0) {
    let t = delay;
    for (const n of notes) { tone(n[0], n[1], n[2] || 'triangle', n[3] || 0.4, t); t += n[1]; }
  }

  const map = {
    /* UI */
    click:   () => tone(880, .05, 'square', .18),
    select:  () => seq([[659,.07],[988,.1]]),
    back:    () => tone(330, .08, 'square', .26),
    /* 火柴点燃（摩擦噪声 + 噗的火苗） */
    match:   () => { noise(.12, .3, 0, 2600); tone(740, .14, 'triangle', .22, .1, 1180); },
    /* 点灯：火苗升起 + 明亮和弦 */
    light:   () => { noise(.1, .18, 0, 1800); seq([[523,.1,'sine',.34],[659,.12,'sine',.32],[784,.18,'sine',.3]], .06); },
    step:    () => tone(150, .04, 'sine', .12, 0, 110),
    /* 风 */
    wind:    () => { noise(1.4, .22, 0, 700); tone(140, 1.3, 'sine', .1, 0, 90); },
    /* 雨 */
    rain:    () => noise(1.1, .16, 0, 4200),
    /* 火焰濒危的噗噗声 */
    flicker: () => { tone(420, .12, 'sawtooth', .14, 0, 180); noise(.1, .12, .02, 1500); },
    /* 护灯成功：温暖的拨弦 */
    shield:  () => seq([[392,.1],[523,.1],[659,.14],[784,.26]]),
    /* 熄灯：火苗低落 */
    out:     () => tone(520, .4, 'sine', .22, 0, 130),
    /* 音乐盒和弦（闪回/回忆） */
    memory:  () => seq([[784,.16,'sine',.3],[988,.16,'sine',.28],[1175,.3,'sine',.26]], .02),
    /* 黎明：上行大调音阶 */
    dawn:    () => seq([[262,.16],[330,.16],[392,.18],[523,.22],[659,.5]], .04),
    /* 全剧终的钟（低沉温暖） */
    bell:    () => { tone(196, 1.2, 'sine', .3); tone(294, 1.2, 'sine', .18, .02); },
  };

  return {
    init,
    play(name) { if (!_muted && map[name]) map[name](); },
    seq, tone, noise,
    setMuted(m) { _muted = m; },
    get muted() { return _muted; },
    get ready() { return !!ctx; },
  };
})();
