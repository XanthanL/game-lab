/* engine.js — NDS 像素演出引擎：画布、像素角色、文字、程序化音效 */
'use strict';

const PIX = (function () {
  const W = 256, H = 192, TAU = Math.PI * 2;

  const makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const C = {
    black: '#000000', ink: '#0c0e16', white: '#ffffff',
    cream: '#f2ead0', paper: '#e8dcc0',
    red: '#e0342e', crimson: '#a41020', orange: '#f07828',
    yellow: '#ffd25a', gold: '#d8b050',
    green: '#36a84a', teal: '#2fa89a', blue: '#3a78d8', sky: '#7ab8f0',
    skin: '#f0c49c', skin2: '#d8a878',
    hair: '#2e2116', hair2: '#4a3520',
    grey: '#9aa0a8', dgrey: '#5a6068', brown: '#5a4430',
    purple: '#8050b0'
  };

  const rect = (g, x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(Math.floor(x), Math.floor(y), w, h);
  };

  /* 星空（确定性伪随机位置，随时间闪烁） */
  function stars(g, t, count, opts) {
    opts = opts || {};
    const seed = opts.seed || 7;
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < count; i++) {
      const x = rnd() * W;
      const y = rnd() * (H * 0.86);
      let a = 0.3 + 0.6 * rnd();
      if (opts.twinkle !== false) a *= 0.55 + 0.45 * Math.sin(t * 1.6 + i * 2.3);
      const sz = rnd() > 0.78 ? 2 : 1;
      g.fillStyle = rnd() > 0.9 ? C.sky : C.white;
      g.globalAlpha = clamp(a, 0.05, 1);
      g.fillRect(Math.floor(x), Math.floor(y), sz, sz);
    }
    g.globalAlpha = 1;
  }

  /* 噪点抖动 */
  function dither(g, alpha, density, col) {
    const n = Math.floor(W * H * (density || 0.12));
    g.fillStyle = col || '#ffffff';
    g.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      g.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
    }
    g.globalAlpha = 1;
  }

  /* 同心圆辉光 */
  function glowOrb(g, x, y, r, col, alpha) {
    const steps = Math.max(4, Math.round(r / 3));
    for (let i = steps; i >= 1; i--) {
      g.globalAlpha = alpha * (1 - i / (steps + 1));
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, r * i / steps, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ---------- 像素文字 ---------- */
  const FONT_FAMILY = '"SimSun","NSimSun","Microsoft YaHei","PingFang SC",monospace';
  const fontOf = (size, bold) => (bold ? '700' : '400') + ' ' + size + 'px ' + FONT_FAMILY;

  function wrap(g, text, maxW, size, bold) {
    g.font = fontOf(size, bold);
    const out = [];
    let line = '';
    for (const ch of text) {
      if (ch === '\n') { out.push(line); line = ''; continue; }
      if (line && g.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
      else line += ch;
    }
    out.push(line);
    return out;
  }

  function drawText(g, text, x, y, o) {
    o = o || {};
    const size = o.size || 11;
    const col = o.color || C.white;
    const align = o.align || 'left';
    const bold = o.bold !== false;
    const alpha = o.alpha != null ? o.alpha : 1;
    g.font = fontOf(size, bold);
    g.textBaseline = 'top';
    g.globalAlpha = alpha;
    const lines = o.wrap ? wrap(g, text, o.wrap, size, bold) : String(text).split('\n');
    lines.forEach((ln, i) => {
      const yy = Math.floor(y + i * (size + (o.lh != null ? o.lh : 3)));
      if (o.shadow !== false) {
        g.fillStyle = 'rgba(0,0,0,0.85)';
        g.fillText(ln, Math.floor(x) + 1, yy + 1);
      }
      g.fillStyle = col;
      if (align === 'center') g.fillText(ln, Math.floor(x - g.measureText(ln).width / 2), yy);
      else if (align === 'right') g.fillText(ln, Math.floor(x - g.measureText(ln).width), yy);
      else g.fillText(ln, Math.floor(x), yy);
    });
    g.globalAlpha = 1;
    return lines.length;
  }

  function panel(g, x, y, w, h, fill, border) {
    rect(g, x, y, w, h, fill || '#10131a');
    if (border) {
      g.fillStyle = border;
      g.fillRect(x, y, w, 1);
      g.fillRect(x, y + h - 1, w, 1);
      g.fillRect(x, y, 1, h);
      g.fillRect(x + w - 1, y, 1, h);
    }
  }

  function scanlines(g) {
    g.fillStyle = 'rgba(0,0,0,0.17)';
    for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
  }

  /* ---------- 像素头像（24×24） ---------- */
  function portrait(o) {
    const c = makeCanvas(24, 24), g = c.getContext('2d');
    const skin = o.skin || C.skin;
    const hair = o.hair || C.hair;
    const style = o.hairStyle || 'short';

    rect(g, 10, 16, 4, 3, skin);            // 脖子
    rect(g, 7, 7, 10, 10, skin);            // 脸

    if (style === 'alien') {
      rect(g, 6, 4, 12, 10, skin);
      rect(g, 5, 2, 14, 4, '#d0e8ff');
      rect(g, '#d0e8ff', 8, 9, 5, 6); rect(g, '#d0e8ff', 13, 9, 5, 6);
      rect(g, '#101018', 9, 10, 3, 4); rect(g, '#101018', 14, 10, 3, 4);
      rect(g, '#101018', 11, 15, 3, 1);
      return c;
    }
    if (style === 'void') {
      rect(g, 5, 3, 14, 12, '#0a0a16');
      rect(g, 7, 6, 3, 3, '#e8f0ff'); rect(g, 14, 6, 3, 3, '#e8f0ff');
      rect(g, 10, 12, 4, 1, '#e8f0ff');
      rect(g, 11, 14, 2, 1, '#e8f0ff');
      return c;
    }

    if (style === 'scarf') {                  // 年轻叶文洁：红头巾
      rect(g, 5, 2, 14, 5, '#b02818');
      rect(g, 5, 6, 2, 4, '#b02818'); rect(g, 17, 6, 2, 4, '#b02818');
      rect(g, 9, 5, 6, 3, skin);
    } else if (style === 'long') {            // 老年叶文洁：花白长发
      rect(g, 6, 3, 12, 4, '#cfc8bc');
      rect(g, 5, 5, 2, 8, '#cfc8bc'); rect(g, 17, 5, 2, 8, '#cfc8bc');
      rect(g, 6, 12, 2, 3, '#cfc8bc'); rect(g, 16, 12, 2, 3, '#cfc8bc');
    } else if (style === 'flat') {            // 罗辑
      rect(g, 6, 3, 12, 4, hair);
      rect(g, 5, 6, 2, 4, hair); rect(g, 17, 6, 2, 4, hair);
    } else if (style === 'pony') {            // 程心 / 申玉菲
      rect(g, 6, 3, 12, 5, hair);
      rect(g, 17, 4, 2, 8, hair);
      rect(g, 16, 10, 2, 4, hair);
    } else if (style === 'hood') {            // 破壁人
      rect(g, 5, 2, 14, 6, '#3a3a46');
      rect(g, 5, 6, 2, 7, '#3a3a46'); rect(g, 17, 6, 2, 7, '#3a3a46');
      rect(g, 7, 3, 10, 2, '#26262f');
      rect(g, 8, 10, 2, 2, '#101018'); rect(g, 14, 10, 2, 2, '#101018');
    } else if (style === 'mili') {            // 常伟思：军帽
      rect(g, 5, 2, 14, 4, '#4a5a68');
      rect(g, 6, 5, 12, 2, '#2a3a4a');
      rect(g, 6, 6, 3, 3, hair);
    } else {                                  // 短直发（汪淼）
      rect(g, 6, 3, 12, 4, hair);
      rect(g, 5, 6, 2, 4, hair); rect(g, 17, 6, 2, 4, hair);
    }

    rect(g, 9, 10, 2, 3, '#202028'); rect(g, 14, 10, 2, 3, '#202028');
    if (o.wrinkles) {
      rect(g, 6, 12, 2, 1, '#c89070'); rect(g, 16, 12, 2, 1, '#c89070');
    }
    if (o.glasses) {
      rect(g, 7, 9, 4, 4, '#d8e8f0'); rect(g, 14, 9, 4, 4, '#d8e8f0');
      rect(g, 11, 10, 3, 1, '#d8e8f0');
      rect(g, 10, 13, 5, 1, '#d8e8f0');
    }
    rect(g, 11, 15, 3, 1, '#8a4a42');
    return c;
  }

  /* ---------- 舞台小人（16×30，两帧行走） ---------- */
  function figure(o) {
    const mk = (leg) => {
      const c = makeCanvas(16, 30), g = c.getContext('2d');
      const skin = o.skin || C.skin;
      const hair = o.hair || C.hair;
      const coat = o.coat || C.blue;
      const pants = o.pants || C.dgrey;

      if (leg) {
        rect(g, 6, 23, 2, 5, pants); rect(g, 9, 23, 2, 5, pants);
        rect(g, 5, 28, 3, 2, C.black); rect(g, 9, 28, 3, 2, C.black);
      } else {
        rect(g, 5, 23, 2, 5, pants); rect(g, 10, 23, 2, 5, pants);
        rect(g, 4, 28, 3, 2, C.black); rect(g, 10, 28, 3, 2, C.black);
      }

      rect(g, 4, 15, 8, 9, coat);                    // 身体
      rect(g, 5, 15, 6, 2, o.coatLt || coat);
      rect(g, 2, 16, 2, 5, coat); rect(g, 12, 16, 2, 5, coat); // 手臂

      if (o.alien) {
        rect(g, 4, 4, 8, 9, skin);
        rect(g, 5, 2, 6, 3, '#a0e0d0');
        rect(g, '#101018', 6, 8, 2, 3); rect(g, '#101018', 9, 8, 2, 3);
      } else if (o.void) {
        rect(g, 4, 5, 8, 7, '#0a0a16');
        rect(g, 6, 7, 1, 1, '#e8f0ff'); rect(g, 9, 7, 1, 1, '#e8f0ff');
        rect(g, 7, 10, 2, 1, '#e8f0ff');
      } else {
        rect(g, 5, 6, 6, 7, skin);                   // 头
        rect(g, 6, 3, 4, 4, hair);
        if (o.mili) {
          rect(g, 4, 5, 8, 2, '#4a5a68');
          rect(g, 6, 3, 4, 1, '#2a3a4a');
        }
        if (o.hood) {
          rect(g, 3, 3, 10, 5, '#33334a');
          rect(g, 4, 7, 8, 3, '#22223a');
        }
        if (o.pony) rect(g, 10, 4, 2, 6, hair);
        rect(g, 6, 9, 1, 2, '#202028'); rect(g, 9, 9, 1, 2, '#202028');
        if (o.scarf) rect(g, 5, 11, 6, 3, '#b02818');
        if (o.glasses) {
          rect(g, 5, 8, 3, 3, '#d8e8f0');
          rect(g, 9, 8, 3, 3, '#d8e8f0');
        }
      }
      return c;
    };
    return { f0: mk(true), f1: mk(false) };
  }

  function drawSprite(g, img, x, y, flip) {
    x = Math.floor(x); y = Math.floor(y);
    if (flip) {
      g.save();
      g.translate(x + img.width, y);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0);
      g.restore();
    } else {
      g.drawImage(img, x, y);
    }
  }

  /* ---------- WebAudio：程序化音效与背景音乐 ---------- */
  let AC = null, master = null, muted = false;
  let bgmTimer = null, bgmIdx = 0;

  function initAudio() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        master = AC.createGain();
        master.gain.value = muted ? 0 : 0.42;
        master.connect(AC.destination);
      } catch (e) { /* 无音频环境时静默 */ }
    }
    if (AC && AC.state === 'suspended') AC.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.42;
  }
  const isMuted = () => muted;

  function tone(freq, dur, type, vol, when, slide) {
    if (!AC || muted) return;
    const t0 = AC.currentTime + (when || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.06, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  function noiseBurst(dur, vol, freq, when) {
    if (!AC || muted) return;
    const t0 = AC.currentTime + (when || 0);
    const len = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = AC.createGain(); g.gain.value = vol || 0.12;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    blip: () => tone(880, 0.06, 'square', 0.045),
    tick: () => tone(520, 0.05, 'square', 0.045),
    select: () => { tone(660, 0.08, 'square', 0.045); tone(990, 0.1, 'square', 0.04, 0.07); },
    send: () => { tone(220, 0.5, 'sawtooth', 0.05, 0, 420); noiseBurst(0.4, 0.05, 900); },
    static: () => noiseBurst(0.5, 0.09, 2000),
    thunder: () => { noiseBurst(0.8, 0.16, 300); tone(90, 0.7, 'sine', 0.11, 0, -40); },
    boom: () => { noiseBurst(0.7, 0.18, 400); tone(70, 0.8, 'sine', 0.13, 0, -30); },
    chime: () => { tone(1320, 0.3, 'sine', 0.045); tone(1760, 0.4, 'sine', 0.04, 0.12); tone(2200, 0.5, 'sine', 0.03, 0.24); },
    unfold: () => { tone(180, 0.8, 'sawtooth', 0.05, 0, 260); tone(360, 0.7, 'sawtooth', 0.04, 0.3, 300); },
    droplet: () => { tone(2400, 0.12, 'sine', 0.05, 0, -500); tone(3200, 0.2, 'sine', 0.03, 0.08, -800); },
    count: () => tone(420, 0.09, 'square', 0.055),
    warn: () => { tone(200, 0.3, 'sawtooth', 0.06, 0, 30); tone(200, 0.3, 'sawtooth', 0.06, 0.4, 30); },
    bow: () => { tone(523, 0.5, 'triangle', 0.055); tone(659, 0.5, 'triangle', 0.05, 0.5); tone(784, 0.8, 'triangle', 0.05, 1.0); }
  };

  const BGM = {
    redcoast: { tempo: 2300, notes: [[110, 0.6], [110, 0.6], [146, 0.6], [110, 0.6], [0, 1], [98, 0.6], [110, 0.6]], type: 'triangle', vol: 0.05 },
    trisolaris: { tempo: 1700, notes: [[98, 1], [104, 1], [98, 1], [116, 1], [92, 2]], type: 'sawtooth', vol: 0.025 },
    dark: { tempo: 2900, notes: [[55, 2], [0, 1], [55, 2], [41, 3]], type: 'sine', vol: 0.09 },
    void: { tempo: 2500, notes: [[0, 2], [131, 1], [0, 1], [0, 2], [98, 1]], type: 'sine', vol: 0.05 },
    hope: { tempo: 1350, notes: [[262, 0.6], [330, 0.6], [392, 0.6], [523, 1.2], [392, 0.6], [330, 0.6], [294, 1.6]], type: 'triangle', vol: 0.045 }
  };

  function playBGM(id) {
    stopBGM();
    const p = BGM[id];
    if (!p) return;
    bgmIdx = 0;
    bgmTimer = setInterval(() => {
      const n = p.notes[bgmIdx % p.notes.length];
      bgmIdx++;
      if (n && n[0] > 0) tone(n[0], n[1], p.type, p.vol);
    }, p.tempo);
  }

  function stopBGM() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  return {
    W, H, TAU, C, clamp,
    rect, stars, dither, glowOrb, drawText, panel, scanlines,
    portrait, figure, drawSprite,
    initAudio, setMuted, isMuted, tone, noiseBurst, SFX, playBGM, stopBGM
  };
})();
