(function (global) {
  'use strict';

  var ctx = null;
  var master = null;
  var musicGain = null;
  var musicTimer = null;
  var enabled = true;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(master);
    return ctx;
  }

  function tone(opts) {
    var c = ensure();
    if (!c || !enabled) return;
    var t0 = c.currentTime + (opts.when || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.2, t0 + (opts.attack || 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  function noise(dur, when, gainVal, filterFreq) {
    var c = ensure();
    if (!c || !enabled) return;
    var t0 = c.currentTime + (when || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buffer = c.createBuffer(1, len, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 800;
    filter.Q.value = 0.8;
    var gain = c.createGain();
    gain.gain.setValueAtTime(gainVal || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  var EFFECTS = {
    match: function () {
      noise(0.05, 0, 0.08, 3000);
      tone({ freq: 1800, dur: 0.04, type: 'square', gain: 0.03, when: 0.02 });
      tone({ freq: 900, dur: 0.14, type: 'sine', gain: 0.05, when: 0.06, slideTo: 1600 });
    },
    bell: function () {
      [880, 1320, 1760].forEach(function (f, i) {
        tone({ freq: f, dur: 0.5, type: 'sine', gain: 0.06, when: i * 0.08 });
      });
    },
    wind: function () {
      noise(1.1, 0, 0.05, 520);
    },
    comet: function () {
      tone({ freq: 220, dur: 0.8, type: 'sawtooth', gain: 0.04, slideTo: 40 });
      noise(0.7, 0, 0.04, 2000);
    },
    star: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ freq: f, dur: 0.8, type: 'sine', gain: 0.06, when: i * 0.1 });
      });
      tone({ freq: 2093, dur: 1.2, type: 'triangle', gain: 0.03, when: 0.45 });
    },
    dawn: function () {
      [262, 330, 392, 523].forEach(function (f, i) {
        tone({ freq: f, dur: 1.6, type: 'triangle', gain: 0.05, when: i * 0.18 });
      });
      tone({ freq: 1047, dur: 2.2, type: 'sine', gain: 0.025, when: 0.8 });
    }
  };

  function play(name) {
    ensure();
    if (!enabled) return;
    var fx = EFFECTS[name];
    if (fx) fx();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (musicGain && ctx) {
      musicGain.gain.setTargetAtTime(enabled ? 0.12 : 0, ctx.currentTime, 0.05);
    }
  }

  var MELODY = [523, 659, 784, 659, 523, 392, 440, 523];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    var step = 0;
    function tick() {
      if (!enabled || !ctx) return;
      var f = MELODY[step % MELODY.length];
      tone({ freq: f, dur: 0.6, type: 'triangle', gain: 0.06 });
      tone({ freq: f * 2, dur: 0.5, type: 'sine', gain: 0.018 });
      step += 1;
      musicTimer = setTimeout(tick, 420);
    }
    tick();
  }

  global.AudioFX = {
    play: play,
    setEnabled: setEnabled,
    startMusic: startMusic,
    isEnabled: function () { return enabled; }
  };
})(window);
