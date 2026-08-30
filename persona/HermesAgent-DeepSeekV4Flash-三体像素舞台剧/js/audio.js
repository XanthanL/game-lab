'use strict';
/* ═══════════════════════════════════════════════
   Sfx — NDS 风格音效引擎（Web Audio API，零资源）
   ═══════════════════════════════════════════════ */
const Sfx = (() => {
  let ctx = null, master = null, _muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }

  /* 单音：方波/三角波/锯齿波，可滑音 */
  function tone(freq, dur, type = 'square', vol = 0.5, delay = 0, slideTo = 0) {
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

  /* 噪声：爆炸/风声 */
  function noise(dur, vol = 0.5, delay = 0) {
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
    src.connect(g); g.connect(master); src.start(t0);
  }

  /* 乐句序列：[[freq,dur,type,vol], ...] */
  function seq(notes, delay = 0) {
    let t = delay;
    for (const n of notes) { tone(n[0], n[1], n[2] || 'square', n[3] || 0.4, t); t += n[1]; }
  }

  const map = {
    click:   () => tone(920, .05, 'square', .22),
    select:  () => tone(660, .07, 'square', .3),
    back:    () => tone(330, .07, 'square', .3),
    transmit:() => seq([[880,.08],[660,.08],[440,.1],[330,.16]]),
    alarm:   () => { tone(220, .9, 'sawtooth', .28, 0, 660); tone(224, .9, 'sawtooth', .28, 0.02, 664); },
    boom:    () => { noise(.7, .55); tone(90, .5, 'sine', .5, 0, 38); },
    whoosh:  () => { noise(.45, .22); tone(1500, .3, 'triangle', .14, 0, 180); },
    chime:   () => seq([[523,.09],[659,.09],[784,.12],[1047,.22]]),
    dawn:    () => seq([[262,.14],[330,.14],[392,.16],[523,.32]]),
    blink:   () => tone(1200, .03, 'square', .1),
    step:    () => tone(170, .03, 'triangle', .1),
    door:    () => tone(500, .22, 'square', .2, 0, 110),
    eye:     () => seq([[196,.3,'sine',.3],[147,.5,'sine',.3]]),
    launch:  () => seq([[300,.1],[420,.1],[560,.14,'square',.3],[840,.3]]),
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
