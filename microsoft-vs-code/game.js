/* 微软大战代码 · Microsoft vs. Code —— 梗图改编的恶搞塔防
   零依赖 · 零构建 · 全矢量绘制 */
(() => {
'use strict';

// ---------- canvas ----------
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 1280, H = 720;
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit); fit();

// ---------- layout ----------
const TITLE_H = 40, HUD_Y = 40, HUD_H = 62;
const LAWN_X = 110, CELL_W = 118, CELL_H = 118, LAWN_Y = 106, ROWS = 5, COLS = 9;
const LAWN_R = LAWN_X + COLS * CELL_W;
const LOSE_X = 96;
const CARD_X0 = 170, CARD_Y = 41, CARD_W = 54, CARD_H = 60, CARD_GAP = 7;
const OUT = '#141414';

const cellX = col => LAWN_X + col * CELL_W + CELL_W / 2;
const cellY = row => LAWN_Y + row * CELL_H + CELL_H / 2;

// ---------- tiny synth ----------
const AU = {
  ctx: null, muted: false,
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
  tone(f0, f1, d, type = 'square', v = 0.12, delay = 0) {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, v = 0.2, freq = 800, delay = 0) {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime + delay;
    const n = Math.floor(c.sampleRate * d);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = v;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  },
  play(n) {
    switch (n) {
      case 'click': this.tone(700, 500, 0.06, 'square', 0.06); break;
      case 'plant': this.tone(300, 160, 0.12, 'triangle', 0.15); break;
      case 'shoot': this.tone(880, 620, 0.05, 'square', 0.04); break;
      case 'hit': this.noise(0.05, 0.08, 1600); break;
      case 'boom': this.noise(0.5, 0.35, 500); this.tone(140, 40, 0.4, 'sine', 0.3); break;
      case 'ding': this.tone(980, 980, 0.09, 'sine', 0.12); this.tone(1470, 1470, 0.12, 'sine', 0.1, 0.08); break;
      case 'groan': this.tone(150, 85, 0.4, 'sawtooth', 0.07); break;
      case 'horn': this.tone(220, 220, 0.5, 'sawtooth', 0.12); this.tone(165, 165, 0.6, 'sawtooth', 0.12, 0.15); break;
      case 'stun': this.tone(520, 240, 0.3, 'square', 0.08); break;
      case 'quack': this.tone(260, 180, 0.08, 'square', 0.07); break;
      case 'lose': [400, 320, 250, 180].forEach((f, i) => this.tone(f, f * 0.9, 0.25, 'sawtooth', 0.12, i * 0.22)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.14, i * 0.14)); break;
    }
  }
};

// ---------- definitions ----------
const PLANTS = {
  coffee:   { name: '咖啡机',       cost: 50,  hp: 300,  cd: 5,  desc: '每 20s 冲一杯咖啡' },
  log:      { name: 'console.log',  cost: 100, hp: 300,  cd: 5,  desc: '发射日志子弹' },
  keyboard: { name: '机械键盘',     cost: 175, hp: 300,  cd: 6,  desc: '双倍射速键帽' },
  firewall: { name: '防火墙',       cost: 150, hp: 450,  cd: 8,  desc: '过滤包使敌减速' },
  duck:     { name: '橡胶鸭',       cost: 50,  hp: 1100, cd: 18, desc: 'debug 用肉墙' },
  bp:       { name: '断点',         cost: 25,  hp: 300,  cd: 16, desc: '8s 后武装，踩中即炸' },
  rmrf:     { name: 'rm -rf',       cost: 150, hp: 300,  cd: 28, desc: '3×3 范围清空' },
};
const PLANT_ORDER = ['coffee', 'log', 'keyboard', 'firewall', 'duck', 'bp', 'rmrf'];
const ZOMBIES = {
  clippy: { name: 'Clippy',        hp: 200,  speed: 20, dps: 80,  desc: '回形针助手' },
  ie:     { name: 'IE 浏览器',     hp: 380,  speed: 10, dps: 80,  desc: '很慢，但终究来了' },
  edge:   { name: 'Edge 弹窗',     hp: 130,  speed: 46, dps: 80,  desc: '弹得飞快' },
  update: { name: 'Windows 更新',  hp: 550,  speed: 17, dps: 80,  desc: '强制重启你的单位' },
  bsod:   { name: '蓝屏 BSOD',     hp: 850,  speed: 13, dps: 80,  desc: '死时整行瘫痪' },
  garg:   { name: '强制更新.exe',  hp: 2400, speed: 11, dps: 600, desc: '巨型安装包' },
};
const ZOMB_ORDER = ['clippy', 'ie', 'edge', 'update', 'bsod', 'garg'];
const NIGHT_T = 100;

// ---------- spawn script ----------
function buildScript() {
  const ev = [];
  const add = (t0, t1, type, n) => {
    for (let i = 0; i < n; i++)
      ev.push({ t: t0 + (t1 - t0) * (i / Math.max(n - 1, 1)) + Math.random() * 3, type, row: (Math.random() * ROWS) | 0 });
  };
  add(20, 62, 'clippy', 4); add(30, 60, 'ie', 2); add(40, 66, 'edge', 2);
  add(74, 130, 'clippy', 7); add(80, 130, 'edge', 3); add(88, 132, 'ie', 3); add(96, 134, 'update', 3);
  add(146, 205, 'clippy', 9); add(150, 205, 'edge', 4); add(154, 208, 'ie', 3);
  add(158, 210, 'update', 3); add(165, 205, 'bsod', 2); add(192, 210, 'bsod', 1);
  ev.push({ t: 178, type: 'garg', row: 2 });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}
const BANNERS = [
  { t: 2,   text: '第一波 · 他们来了',        sub: 'Clippy 还记得你',            col: '#e8e8e8' },
  { t: 72,  text: '第二波 · 开始推送更新',    sub: '这次是认真的',                col: '#e8e8e8' },
  { t: NIGHT_T, text: '加班时间到',           sub: '天空不再掉咖啡，靠咖啡机撑住', col: '#dcdcaa' },
  { t: 142, text: '一大波全家桶正在接近！',   sub: '守住编辑器',                  col: '#d1695c' },
];

// ---------- state ----------
let S = null;
function reset() {
  S = {
    t: 0, coffee: 200, phase: 'day',
    plants: [], zombies: [], shots: [], tokens: [], parts: [], floats: [], flashes: [],
    cards: PLANT_ORDER.map(k => ({ key: k, cd: 0 })),
    sel: null, shovel: false,
    script: buildScript(), si: 0, spawned: 0,
    skyT: 6, prodNote: 0,
    kills: 0, got: 0,
    shake: 0, over: null, overT: 0, paused: false, running: false,
  };
}
reset();

function bannerAt(t) { return BANNERS.find(b => t >= b.t && t < b.t + 3); }

// ---------- entities ----------
function plantAt(row, col) { return S.plants.find(p => p.row === row && p.col === col); }
function addPlant(key, row, col) {
  const d = PLANTS[key];
  S.plants.push({
    key, row, col, x: cellX(col), y: cellY(row),
    hp: d.hp, maxHp: d.hp, seed: Math.random() * 7,
    fireT: 0, biteT: 0, stun: 0, rateT: 0.5, prodT: 10, armT: 0, armed: false, fuse: 1.0,
  });
}
function spawnZombie(type, row) {
  const d = ZOMBIES[type];
  S.zombies.push({
    type, row, x: W + 30 + Math.random() * 30, hp: d.hp, maxHp: d.hp,
    seed: Math.random() * 7, slow: 0, flash: 0, abT: 6, idle: 0, idleT: 5 + Math.random() * 4,
  });
  S.spawned++;
  AU.play('groan');
}
function addToken(x, y, fromSky) {
  S.tokens.push({ x, y: fromSky ? -20 : y - 46, ty: y, life: 10, born: 0 });
}
function float(x, y, text, col = '#e8e8e8') { S.floats.push({ x, y, text, col, life: 1.2 }); }
function burst(x, y, n, col, spd = 160, text = null) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 300, life: 0.5 + Math.random() * 0.5, col, r: 2 + Math.random() * 3, text: text && Math.random() < 0.5 ? text : null });
  }
}
function explode(x, y, radius, dmg, big) {
  AU.play('boom');
  S.shake = big ? 0.4 : 0.25;
  burst(x, y, big ? 26 : 14, '#ffb347', 240);
  burst(x, y, 8, '#7ed957', 180, 'rm -rf');
  for (const z of S.zombies) {
    const dy = (z.row - Math.round((y - LAWN_Y - CELL_H / 2) / CELL_H)) * CELL_H;
    if (Math.hypot(z.x - x, dy) < radius) damageZombie(z, dmg);
  }
}
function damageZombie(z, dmg) { z.hp -= dmg; z.flash = 0.12; }

// ---------- update ----------
function update(dt) {
  S.t += dt;
  if (S.shake > 0) S.shake -= dt;
  for (const c of S.cards) c.cd = Math.max(0, c.cd - dt);

  if (S.phase === 'day' && S.t >= NIGHT_T) { S.phase = 'night'; AU.play('horn'); }
  if (S.phase === 'day') {
    S.skyT -= dt;
    if (S.skyT <= 0) { S.skyT = 8; addToken(LAWN_X + 40 + Math.random() * (LAWN_R - LAWN_X - 80), LAWN_Y + 30 + Math.random() * (ROWS * CELL_H - 60), true); }
  }

  while (S.si < S.script.length && S.script[S.si].t <= S.t) { const e = S.script[S.si++]; spawnZombie(e.type, e.row); }

  // plants
  for (const p of S.plants) {
    p.biteT = Math.max(0, p.biteT - dt); p.fireT = Math.max(0, p.fireT - dt);
    if (p.stun > 0) { p.stun -= dt; continue; }
    const d = PLANTS[p.key];
    if (p.key === 'coffee') {
      p.prodT -= dt;
      if (p.prodT <= 0) { p.prodT = 20; addToken(p.x + 26, p.y - 6, false); AU.play('ding'); }
    } else if (p.key === 'log' || p.key === 'keyboard' || p.key === 'firewall') {
      p.rateT -= dt;
      const rate = p.key === 'keyboard' ? 0.7 : 1.4;
      const target = S.zombies.some(z => z.row === p.row && z.x > p.x + 10 && z.x < W + 40);
      if (target && p.rateT <= 0) {
        p.rateT = rate; p.fireT = 0.15;
        S.shots.push({ x: p.x + 30, y: p.y - 8, row: p.row, kind: p.key, dmg: p.key === 'log' ? 25 : 20, ch: 'QWERTASDFG'[(Math.random() * 10) | 0] });
        AU.play('shoot');
      }
    } else if (p.key === 'bp') {
      if (!p.armed) { p.armT += dt; if (p.armT >= 8) p.armed = true; }
      else if (S.zombies.some(z => Math.abs(z.x - p.x) < 28 && z.row === p.row)) {
        explode(p.x, p.y, 95, 1200, false); p.hp = -1;
      }
    } else if (p.key === 'rmrf') {
      p.fuse -= dt;
      if (p.fuse <= 0) { explode(p.x, p.y, CELL_W * 1.7, 1800, true); p.hp = -1; }
    }
  }

  // shots
  for (const s of S.shots) {
    s.x += 420 * dt;
    const z = S.zombies.find(z => z.row === s.row && Math.abs(z.x - s.x) < 26 && z.hp > 0);
    if (z) {
      damageZombie(z, s.dmg);
      if (s.kind === 'firewall') z.slow = 3;
      AU.play('hit');
      burst(s.x, s.y, 4, s.kind === 'firewall' ? '#35c1f1' : '#7ed957', 90);
      s.dead = true;
    } else if (s.x > W + 20) s.dead = true;
  }
  S.shots = S.shots.filter(s => !s.dead);

  // zombies
  for (const z of S.zombies) {
    z.flash = Math.max(0, z.flash - dt); z.slow = Math.max(0, z.slow - dt);
    const d = ZOMBIES[z.type];
    if (z.type === 'update') {
      z.abT -= dt;
      if (z.abT <= 0) {
        z.abT = 12;
        const targets = S.plants.filter(p => p.row === z.row && p.stun <= 0 && p.hp > 0);
        if (targets.length) {
          const v = targets[(Math.random() * targets.length) | 0];
          v.stun = 4; AU.play('stun'); float(v.x, v.y - 50, '强制重启!', '#dcdcaa');
        }
      }
    }
    if (z.type === 'ie') {
      if (z.idle > 0) z.idle -= dt;
      else { z.idleT -= dt; if (z.idleT <= 0) { z.idleT = 6 + Math.random() * 4; z.idle = 1.2; } }
    }
    const meal = S.plants.find(p => p.row === z.row && p.hp > 0 && z.x - p.x > -6 && z.x - p.x < 34);
    if (meal) {
      meal.hp -= d.dps * dt; meal.biteT = 0.25;
      if (pIsDuck(meal) && Math.random() < dt * 2) AU.play('quack');
    } else if (z.idle <= 0) {
      z.x -= d.speed * (z.slow > 0 ? 0.5 : 1) * dt;
    }
    if (z.x < LOSE_X && !S.over) { S.over = 'lose'; S.overT = 1.4; AU.play('lose'); }
  }

  // deaths
  for (const z of S.zombies) {
    if (z.hp <= 0) {
      S.kills++;
      burst(z.x, cellY(z.row), 12, '#9fb89f', 150);
      if (z.type === 'bsod') {
        S.flashes.push({ row: z.row, life: 0.6 });
        for (const p of S.plants) if (p.row === z.row) p.stun = Math.max(p.stun, 3);
        AU.play('stun');
      }
    }
  }
  S.zombies = S.zombies.filter(z => z.hp > 0);
  S.plants = S.plants.filter(p => p.hp > 0);

  // tokens / particles / floats
  for (const tk of S.tokens) {
    tk.born += dt; tk.life -= dt;
    if (tk.y < tk.ty) tk.y = Math.min(tk.ty, tk.y + 260 * dt);
  }
  S.tokens = S.tokens.filter(tk => tk.life > 0);
  for (const p of S.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
  S.parts = S.parts.filter(p => p.life > 0);
  for (const f of S.floats) { f.life -= dt; f.y -= 40 * dt; }
  S.floats = S.floats.filter(f => f.life > 0);
  for (const f of S.flashes) f.life -= dt;
  S.flashes = S.flashes.filter(f => f.life > 0);

  // end
  if (S.over) {
    S.overT -= dt;
    if (S.overT <= 0) showEnd(S.over);
  } else if (S.si >= S.script.length && S.zombies.length === 0 && S.t > 215) {
    S.over = 'win'; S.overT = 1.0; AU.play('win');
  }
}
const pIsDuck = p => p.key === 'duck';

// ---------- input ----------
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e);
  handleTap(p.x, p.y);
});
function handleTap(x, y) {
  if (!S.running || S.paused || S.over) return;
  // HUD
  if (y >= HUD_Y && y <= HUD_Y + HUD_H) {
    for (let i = 0; i < PLANT_ORDER.length; i++) {
      const cx = CARD_X0 + i * (CARD_W + CARD_GAP);
      if (x >= cx && x <= cx + CARD_W) { selectCard(i); return; }
    }
    const sx = CARD_X0 + 7 * (CARD_W + CARD_GAP);
    if (x >= sx && x <= sx + CARD_W) { S.shovel = !S.shovel; S.sel = null; AU.play('click'); return; }
    if (x >= 1196 && x <= 1224) { togglePause(); return; }
    if (x >= 1232 && x <= 1260) { AU.muted = !AU.muted; AU.play('click'); return; }
    return;
  }
  // coffee tokens first
  for (let i = S.tokens.length - 1; i >= 0; i--) {
    const tk = S.tokens[i];
    if (Math.hypot(tk.x - x, tk.y - y) < 30) {
      S.coffee += 25; S.got += 25;
      float(tk.x, tk.y - 14, '+25', '#dcdcaa');
      burst(tk.x, tk.y, 6, '#dcdcaa', 100);
      AU.play('ding');
      S.tokens.splice(i, 1);
      return;
    }
  }
  // lawn
  if (x >= LAWN_X && x < LAWN_R && y >= LAWN_Y && y < LAWN_Y + ROWS * CELL_H) {
    const col = Math.floor((x - LAWN_X) / CELL_W), row = Math.floor((y - LAWN_Y) / CELL_H);
    const occ = plantAt(row, col);
    if (S.shovel) {
      if (occ) {
        const refund = Math.floor(PLANTS[occ.key].cost / 2);
        S.coffee += refund;
        float(occ.x, occ.y - 30, 'git revert +' + refund, '#9d9d9d');
        burst(occ.x, occ.y, 8, '#9d9d9d', 120);
        S.plants = S.plants.filter(p => p !== occ);
        AU.play('click');
      }
      return;
    }
    if (S.sel !== null && !occ) {
      const key = PLANT_ORDER[S.sel], c = S.cards[S.sel], d = PLANTS[key];
      if (c.cd <= 0 && S.coffee >= d.cost) {
        S.coffee -= d.cost; c.cd = d.cd;
        addPlant(key, row, col);
        AU.play('plant');
        burst(cellX(col), cellY(row), 6, '#7ed957', 90);
      }
    }
  }
}
function selectCard(i) {
  S.sel = S.sel === i ? null : i; S.shovel = false; AU.play('click');
}
function togglePause() {
  if (!S.running || S.over) return;
  S.paused = !S.paused;
  document.getElementById('ovPause').classList.toggle('hidden', !S.paused);
  AU.play('click');
}
addEventListener('keydown', e => {
  if (e.key === 'Escape') togglePause();
  if (!S.running || S.paused || S.over) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 7) selectCard(n - 1);
  if (e.key === 'x' || e.key === 'X') { S.shovel = !S.shovel; S.sel = null; }
});
addEventListener('blur', () => { if (S.running && !S.over && !S.paused) togglePause(); });

// ---------- art ----------
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 7); };

const ART = { p: {}, z: {} };

ART.p.coffee = (c, t, e) => {
  c.fillStyle = '#3b3b3b'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -24, -26, 48, 50, 7); c.fill(); c.stroke();
  c.fillStyle = '#4a4a4a'; rr(c, -24, -36, 48, 14, 5); c.fill(); c.stroke();
  c.fillStyle = Math.sin(t * 4) > 0 ? '#7ed957' : '#5a5a5a'; circ(c, 15, -29, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, -14, -6, 28, 26, 4); c.fill();
  const lv = 0.45 + 0.3 * (Math.sin(t * 0.8 + e.seed) + 1) / 2;
  c.fillStyle = '#7a4a21'; rr(c, -12, 18 - 22 * lv, 24, 22 * lv, 3); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const ph = t * 3 + i * 2;
    c.beginPath(); c.moveTo(-6 + i * 12, -40);
    c.quadraticCurveTo(-6 + i * 12 + Math.sin(ph) * 4, -48, -6 + i * 12, -56);
    c.globalAlpha = 0.3 + 0.2 * Math.sin(ph); c.stroke(); c.globalAlpha = 1;
  }
};
ART.p.log = (c, t, e) => {
  c.fillStyle = '#10241a'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -28, -32, 56, 58, 6); c.fill(); c.stroke();
  c.fillStyle = '#2d2d2d'; rr(c, -28, -32, 56, 13, 6); c.fill();
  ['#d1695c', '#dcdcaa', '#7ed957'].forEach((col, i) => { c.fillStyle = col; circ(c, -20 + i * 8, -25.5, 2.2); c.fill(); });
  c.fillStyle = '#3f6f4f'; c.fillRect(-20, -12, 30, 3); c.fillRect(-20, -4, 22, 3); c.fillRect(-20, 4, 26, 3);
  if (t % 1 < 0.6) { c.fillStyle = '#7ed957'; c.font = 'bold 12px monospace'; c.textAlign = 'left'; c.fillText('>_', -20, 20); }
  if (e.fireT > 0) { c.fillStyle = 'rgba(126,217,87,.8)'; circ(c, 32, -6, 6); c.fill(); }
};
ART.p.keyboard = (c, t, e) => {
  const rec = e.fireT > 0 ? 2 : 0;
  c.strokeStyle = '#555'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(20, -8 + rec); c.quadraticCurveTo(34, -22, 30, -30); c.stroke();
  c.fillStyle = '#262626'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -32, -10 + rec, 64, 30, 5); c.fill(); c.stroke();
  for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) {
    c.fillStyle = (r === 0 && k === 3) ? '#dcdcaa' : '#3d3d3d';
    rr(c, -28 + k * 8.4, -5 + rec + r * 11, 7, 9, 2); c.fill();
  }
};
ART.p.firewall = (c, t, e) => {
  c.strokeStyle = OUT; c.lineWidth = 3; c.fillStyle = '#1f4e5f';
  rr(c, -26, -32, 52, 64, 5); c.fill(); c.stroke();
  c.strokeStyle = '#12333d'; c.lineWidth = 2;
  for (let r = 0; r < 4; r++) {
    const y = -32 + r * 16;
    c.beginPath(); c.moveTo(-26, y + 16); c.lineTo(26, y + 16); c.stroke();
    const off = r % 2 ? -13 : 0;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(off - 13 + k * 26, y); c.lineTo(off - 13 + k * 26, y + 16); c.stroke(); }
  }
  c.save(); c.shadowColor = '#35c1f1'; c.shadowBlur = 10;
  c.strokeStyle = '#bfe8ff'; c.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + t * 0.5;
    c.beginPath(); c.moveTo(-Math.cos(a) * 9, -Math.sin(a) * 9); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); c.stroke();
  }
  c.restore();
};
ART.p.duck = (c, t, e) => {
  c.fillStyle = '#ffd94a'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 0, 8, 19); c.fill(); c.stroke();
  circ(c, 7, -17, 12); c.fill(); c.stroke();
  c.fillStyle = '#f28c28'; c.beginPath(); c.moveTo(17, -20); c.lineTo(28, -15); c.lineTo(17, -11); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = OUT; circ(c, 10, -20, 2.5); c.fill();
  c.strokeStyle = '#d9a92a'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(-4, 8, 10, 0.5, 2.6); c.stroke();
};
ART.p.bp = (c, t, e) => {
  c.fillStyle = '#333'; rr(c, -30, 10, 60, 4, 2); c.fill();
  if (!e.armed) {
    c.fillStyle = 'rgba(255,64,64,.55)'; circ(c, 0, 12, 5); c.fill();
    c.strokeStyle = 'rgba(255,64,64,.6)'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 12, 9, -Math.PI / 2, -Math.PI / 2 + (e.armT / 8) * Math.PI * 2); c.stroke();
  } else {
    const pu = 1 + 0.12 * Math.sin(t * 7);
    c.save(); c.shadowColor = '#ff4040'; c.shadowBlur = 12;
    c.fillStyle = '#ff4040'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    circ(c, 0, 12, 7 * pu); c.fill(); c.stroke(); c.restore();
  }
};
ART.p.rmrf = (c, t, e) => {
  c.fillStyle = '#1b1b1b'; c.strokeStyle = '#000'; c.lineWidth = 3;
  circ(c, 0, 4, 18); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(-6, -2, 7, 0, 7); c.fill();
  c.fillStyle = '#e8e8e8'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('rm -rf', 0, 8);
  c.fillStyle = '#333'; rr(c, -5, -20, 10, 8, 2); c.fill();
  c.strokeStyle = '#888'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -20); c.quadraticCurveTo(6, -26, 10, -27); c.stroke();
  if (Math.sin(t * 20) > -0.3) {
    c.strokeStyle = '#ffd94a'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 6; c.beginPath(); c.moveTo(10 + Math.cos(a) * 2, -27 + Math.sin(a) * 2); c.lineTo(10 + Math.cos(a) * 6, -27 + Math.sin(a) * 6); c.stroke(); }
  }
  if (e.fuse < 0.35 && Math.sin(t * 30) > 0) { c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, 0, 4, 18); c.fill(); }
};

function zbody(c, t, e, speedF, shirt, scale = 1) {
  c.save(); c.scale(scale, scale);
  const w = Math.sin(t * 5 * speedF + e.seed), w2 = Math.sin(t * 5 * speedF + e.seed + Math.PI);
  c.fillStyle = '#4a4a4a';
  rr(c, -8 + w * 3, 26, 8, 16, 3); c.fill();
  rr(c, 2 + w2 * 3, 26, 8, 16, 3); c.fill();
  c.save(); c.rotate(0.1);
  c.fillStyle = shirt; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -12, -16, 26, 44, 8); c.fill(); c.stroke();
  c.fillStyle = '#a33'; c.beginPath(); c.moveTo(-2, -12); c.lineTo(2, -12); c.lineTo(0, 4); c.closePath(); c.fill();
  c.restore();
  const skin = '#a8bfa0';
  c.fillStyle = skin; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -30, -12 + w * 2, 22, 7, 3); c.fill(); c.stroke();
  rr(c, -30, -2 + w2 * 2, 22, 7, 3); c.fill(); c.stroke();
  c.restore();
}
const zface = (c, x, y) => {
  c.fillStyle = '#c0392b'; circ(c, x - 4, y, 2); c.fill(); circ(c, x + 3, y, 2); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 5, y + 6); c.lineTo(x + 4, y + 6); c.stroke();
};

ART.z.clippy = (c, t, e) => {
  zbody(c, t, e, 1, '#cfcfcf', 0.85);
  c.strokeStyle = '#c9c9c9'; c.lineWidth = 5; c.lineCap = 'round';
  rr(c, -11, -60, 22, 36, 11); c.stroke();
  c.beginPath(); c.moveTo(-4, -52); c.lineTo(-4, -30); c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2;
  circ(c, -5, -48, 5.5); c.fill(); c.stroke(); circ(c, 5, -48, 5.5); c.fill(); c.stroke();
  c.fillStyle = OUT; circ(c, -6.5, -48, 2); c.fill(); circ(c, 3.5, -48, 2); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-9, -56); c.lineTo(-2, -55); c.stroke();
  c.beginPath(); c.moveTo(9, -56); c.lineTo(2, -55); c.stroke();
};
ART.z.ie = (c, t, e) => {
  zbody(c, t, e, 0.5, '#b8b8a8', 0.95);
  c.save(); c.translate(0, -44); c.rotate(-0.4);
  c.strokeStyle = '#f7d038'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(0, 2, 17, 6, 0, 0, 7); c.stroke();
  c.restore();
  c.fillStyle = '#1e8fd0'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 0, -44, 15); c.fill(); c.stroke();
  c.strokeStyle = '#e8f4ff'; c.lineWidth = 3;
  c.beginPath(); c.arc(0, -44, 8, 0.4, 5.8); c.stroke();
  c.fillStyle = '#e8f4ff'; c.fillRect(-10, -46, 16, 3);
};
ART.z.edge = (c, t, e) => {
  zbody(c, t, e, 2, '#d8d8d8', 0.9);
  c.fillStyle = '#e8e8e8'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -14, -60, 28, 27, 4); c.fill(); c.stroke();
  c.fillStyle = '#b5b5b5'; c.fillRect(-14, -60, 28, 7);
  c.strokeStyle = '#35c1f1'; c.lineWidth = 3.5;
  c.beginPath(); c.arc(0, -45, 8, -0.5, 4.2); c.stroke();
  c.strokeStyle = '#0c59a4'; c.lineWidth = 3;
  c.beginPath(); c.arc(1, -44, 4.5, 2, 7.5); c.stroke();
};
ART.z.update = (c, t, e) => {
  zbody(c, t, e, 0.8, '#c8c8c8', 1.05);
  c.fillStyle = '#9fb89f'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 0, -40, 12); c.fill(); c.stroke();
  zface(c, 0, -42);
  c.save(); c.translate(0, -58); c.rotate(t * 2);
  c.strokeStyle = '#7ed957'; c.lineWidth = 4;
  c.beginPath(); c.arc(0, 0, 10, 0.3, 2.8); c.stroke();
  c.beginPath(); c.arc(0, 0, 10, 3.4, 5.9); c.stroke();
  c.fillStyle = '#7ed957';
  c.beginPath(); c.moveTo(9, 4); c.lineTo(13, -2); c.lineTo(5, -1); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-9, -4); c.lineTo(-13, 2); c.lineTo(-5, 1); c.closePath(); c.fill();
  c.restore();
};
ART.z.bsod = (c, t, e) => {
  zbody(c, t, e, 0.65, '#b0b0b0', 1.1);
  c.fillStyle = '#9fb89f'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 4, -42, 11); c.fill(); c.stroke();
  zface(c, 4, -44);
  c.fillStyle = '#0078d7'; c.strokeStyle = '#003a66'; c.lineWidth = 3;
  rr(c, -32, -56, 18, 68, 3); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 10px monospace'; c.textAlign = 'center'; c.fillText(':(', -23, -40);
  c.fillStyle = 'rgba(255,255,255,.6)';
  c.fillRect(-29, -32, 12, 2); c.fillRect(-29, -26, 10, 2); c.fillRect(-29, -20, 12, 2);
};
ART.z.garg = (c, t, e) => {
  zbody(c, t, e, 0.5, '#8a8a8a', 1.6);
  c.fillStyle = '#9fb89f'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, -2, -40, 11); c.fill(); c.stroke();
  zface(c, -2, -42);
  c.save(); c.translate(6, -62); c.rotate(-0.15);
  c.fillStyle = '#e8e8e8'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -16, -14, 34, 26, 3); c.fill(); c.stroke();
  c.fillStyle = '#333'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.fillText('setup.exe', 1, -4);
  c.fillStyle = '#444'; c.fillRect(-11, 2, 24, 5);
  c.fillStyle = '#7ed957'; c.fillRect(-11, 2, 22, 5);
  c.restore();
};

function drawCup(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#f5f5f5'; c.strokeStyle = OUT; c.lineWidth = 2;
  rr(c, -8, -6, 16, 13, 3); c.fill(); c.stroke();
  c.beginPath(); c.arc(9, 0, 4, -1.4, 1.4); c.stroke();
  c.fillStyle = '#6f4e37'; c.beginPath(); c.ellipse(0, -5, 6.5, 2.4, 0, 0, 7); c.fill();
  c.restore();
}

// ---------- draw ----------
function clockStr() {
  let m;
  if (S.phase === 'day') m = 9 * 60 + (S.t / NIGHT_T) * 10 * 60;
  else m = 19 * 60 + Math.min(S.t - NIGHT_T, 140) / 140 * 7 * 60;
  m = Math.floor(m) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
}

function draw() {
  const t = S.t;
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * S.shake, (Math.random() - 0.5) * 8 * S.shake);

  // editor chrome
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = '#2d2d2d'; ctx.fillRect(-10, -10, W + 20, TITLE_H + 10);
  ['#d1695c', '#dcdcaa', '#7ed957'].forEach((col, i) => { ctx.fillStyle = col; circ(ctx, 22 + i * 20, 20, 5); ctx.fill(); });
  ctx.fillStyle = '#9d9d9d'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('defense.js — 微软大战代码 · Visual Studio Code (parody)', W / 2, 24);
  ctx.textAlign = 'right'; ctx.fillStyle = S.phase === 'night' ? '#d1695c' : '#8a8a8a';
  ctx.fillText(clockStr() + (S.phase === 'night' ? ' · 加班' : ''), W - 16, 24);

  // HUD
  ctx.fillStyle = '#252526'; ctx.fillRect(0, HUD_Y, W, HUD_H);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HUD_Y + HUD_H); ctx.lineTo(W, HUD_Y + HUD_H); ctx.stroke();

  // lawn
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = r % 2 ? '#212121' : '#272727';
    ctx.fillRect(LAWN_X, LAWN_Y + r * CELL_H, COLS * CELL_W, CELL_H);
    ctx.fillStyle = '#4a4a4a'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(r + 1), LAWN_X - 12, LAWN_Y + r * CELL_H + 20);
  }
  if (t % 1 < 0.55) { ctx.fillStyle = '#7ed957'; ctx.fillRect(LAWN_X + 6, LAWN_Y + (Math.floor(t / 2) % ROWS) * CELL_H + 10, 2, 16); }
  // spawn side
  const g = ctx.createLinearGradient(LAWN_R, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = g; ctx.fillRect(LAWN_R, LAWN_Y, W - LAWN_R, ROWS * CELL_H);
  ctx.fillStyle = '#333'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  rr(ctx, 1216, 330, 52, 26, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7ed957'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('M$', 1242, 347);
  ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(1242, 356); ctx.lineTo(1242, 380); ctx.stroke();

  // your monitor
  ctx.fillStyle = '#2a2a2a'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  rr(ctx, 14, 320, 76, 56, 6); ctx.fill(); cStroke();
  ctx.fillStyle = S.over === 'lose' ? '#0078d7' : '#10241a';
  rr(ctx, 20, 326, 64, 44, 3); ctx.fill();
  if (S.over === 'lose') { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(':(', 52, 352); }
  else {
    ctx.fillStyle = '#3f6f4f'; ctx.fillRect(26, 334, 30, 3); ctx.fillRect(26, 342, 40, 3); ctx.fillRect(26, 350, 24, 3);
    ctx.fillStyle = '#7ed957'; ctx.fillRect(26, 358, 6, 3);
  }
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(46, 376, 12, 10); ctx.fillRect(34, 386, 36, 6);
  function cStroke() { ctx.stroke(); }

  // plants
  const sorted = [...S.plants].sort((a, b) => a.row - b.row);
  for (const p of sorted) {
    ctx.save(); ctx.translate(p.x, p.y);
    const q = p.biteT > 0 ? 0.08 : 0;
    ctx.scale(1 + q, 1 - q);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, 7); ctx.fill();
    ART.p[p.key](ctx, t, p);
    if (p.stun > 0) {
      ctx.save(); ctx.translate(0, -52); ctx.rotate(t * 3);
      ctx.strokeStyle = '#7ed957'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0.4, 5.6); ctx.stroke();
      ctx.fillStyle = '#7ed957'; ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(12, -2); ctx.lineTo(4, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#dcdcaa'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText('配置更新 ' + (Math.floor(t * 17) % 99) + '%', 0, -66);
    }
    ctx.restore();
  }

  // shots
  for (const s of S.shots) {
    ctx.save(); ctx.translate(s.x, s.y);
    if (s.kind === 'log') {
      ctx.shadowColor = '#7ed957'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#7ed957'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('{}', 0, 4);
    } else if (s.kind === 'keyboard') {
      ctx.fillStyle = '#d8d8d8'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      rr(ctx, -6, -6, 12, 12, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(s.ch, 0, 3);
    } else {
      ctx.shadowColor = '#35c1f1'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#35c1f1';
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // zombies
  const zs = [...S.zombies].sort((a, b) => a.row - b.row);
  for (const z of zs) {
    ctx.save(); ctx.translate(z.x, cellY(z.row));
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 42, 24, 7, 0, 0, 7); ctx.fill();
    ART.z[z.type](ctx, t, z);
    if (z.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; circ(ctx, 0, -20, 26); ctx.fill(); }
    if (z.slow > 0) {
      ctx.fillStyle = 'rgba(53,193,241,.18)'; circ(ctx, 0, -16, 30); ctx.fill();
      ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 6, -40 - Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 6, -40 + Math.sin(a) * 6); ctx.stroke(); }
    }
    if (z.type === 'ie' && z.idle > 0) {
      ctx.save(); ctx.translate(0, -70); ctx.rotate(t * 6);
      ctx.strokeStyle = '#dcdcaa'; ctx.lineWidth = 2.5;
      ctx.beginPath(); cArc(); ctx.stroke(); ctx.restore();
      function cArc() { ctx.arc(0, 0, 7, 0.5, 5.5); }
    }
    ctx.restore();
  }

  // row flashes (bsod death)
  for (const f of S.flashes) {
    ctx.fillStyle = 'rgba(0,120,215,' + (f.life * 0.5) + ')';
    ctx.fillRect(LAWN_X, LAWN_Y + f.row * CELL_H, COLS * CELL_W, CELL_H);
  }

  // coffee tokens
  for (const tk of S.tokens) {
    ctx.save(); ctx.translate(tk.x, tk.y);
    if (tk.life < 2 && t % 0.4 < 0.15) ctx.globalAlpha = 0.3;
    const sc = tk.born < 0.3 ? 0.6 + tk.born * 1.3 : 1 + 0.05 * Math.sin(t * 4);
    ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(220,220,170,.7)'; ctx.shadowBlur = 12;
    drawCup(ctx, 0, 0, 1.4);
    ctx.restore();
  }

  // particles / floats
  for (const p of S.parts) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    if (p.text) { ctx.fillStyle = p.col; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); }
    else { ctx.fillStyle = p.col; circ(ctx, p.x, p.y, p.r); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const f of S.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.col; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  // night tint
  if (S.phase === 'night') {
    ctx.fillStyle = 'rgba(8,12,38,.22)';
    ctx.fillRect(0, LAWN_Y, W, ROWS * CELL_H);
  }

  // HUD content
  drawCup(ctx, 34, HUD_Y + 31, 1.5);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(S.coffee), 58, HUD_Y + 38);
  for (let i = 0; i < PLANT_ORDER.length; i++) drawCard(i);
  drawShovel();
  // progress
  const frac = S.spawned / S.script.length;
  ctx.fillStyle = '#333'; rr(ctx, 960, HUD_Y + 27, 220, 9, 4); ctx.fill();
  ctx.fillStyle = '#7ed957'; rr(ctx, 960, HUD_Y + 27, Math.max(6, 220 * frac), 9, 4); ctx.fill();
  ctx.fillStyle = '#8a8a8a'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText('波次', 954, HUD_Y + 35);
  // pause & mute buttons
  ctx.strokeStyle = '#9d9d9d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1206, HUD_Y + 22); ctx.lineTo(1206, HUD_Y + 40); ctx.moveTo(1215, HUD_Y + 22); ctx.lineTo(1215, HUD_Y + 40); ctx.stroke();
  ctx.fillStyle = '#9d9d9d';
  ctx.beginPath(); ctx.moveTo(1238, HUD_Y + 22); ctx.lineTo(1238, HUD_Y + 40); ctx.lineTo(1252, HUD_Y + 31); ctx.closePath(); ctx.fill();
  if (AU.muted) { ctx.strokeStyle = '#d1695c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(1254, HUD_Y + 24); ctx.lineTo(1262, HUD_Y + 38); ctx.stroke(); }

  // boss bar
  const garg = S.zombies.find(z => z.type === 'garg');
  if (garg) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, W / 2 - 160, HUD_Y + HUD_H + 8, 320, 22, 5); ctx.fill();
    ctx.fillStyle = '#d1695c'; rr(ctx, W / 2 - 156, HUD_Y + HUD_H + 12, 312 * (garg.hp / garg.maxHp), 14, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('强制更新.exe', W / 2, HUD_Y + HUD_H + 23);
  }

  // bottom strip
  ctx.fillStyle = '#161616'; ctx.fillRect(0, LAWN_Y + ROWS * CELL_H, W, H - LAWN_Y - ROWS * CELL_H);
  ctx.fillStyle = '#5a5a5a'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('守住编辑器 · 拒绝全家桶', 16, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText('击杀 ' + S.kills, W - 16, H - 8);

  // banner
  const b = bannerAt(t);
  if (b && S.running) {
    const k = (t - b.t) / 3;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 300, W, 110);
    ctx.fillStyle = b.col; ctx.font = '900 44px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(b.text, W / 2, 352); ctx.fillText(b.text, W / 2, 352);
    ctx.fillStyle = '#c8c8c8'; ctx.font = '15px monospace'; ctx.fillText(b.sub, W / 2, 386);
    ctx.globalAlpha = 1;
  }

  // hover cell highlight
  ctx.restore();
}

function drawCard(i) {
  const key = PLANT_ORDER[i], c = S.cards[i], d = PLANTS[key];
  const x = CARD_X0 + i * (CARD_W + CARD_GAP), y = CARD_Y;
  const afford = S.coffee >= d.cost, ready = c.cd <= 0;
  ctx.fillStyle = '#2d2d2d'; ctx.strokeStyle = S.sel === i ? '#dcdcaa' : '#3c3c3c'; ctx.lineWidth = S.sel === i ? 3 : 1.5;
  rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + 26);
  ctx.scale(0.48, 0.48);
  ART.p[key](ctx, S.t, { seed: i, fireT: 0, armT: 8, armed: true, fuse: 1 });
  ctx.restore();
  if (!afford || !ready) {
    ctx.save();
    rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.clip();
    ctx.fillStyle = 'rgba(20,20,20,.55)'; ctx.fillRect(x, y, CARD_W, CARD_H);
    if (!ready) {
      ctx.fillStyle = 'rgba(10,10,10,.75)';
      ctx.beginPath(); ctx.moveTo(x + CARD_W / 2, y + 26);
      ctx.arc(x + CARD_W / 2, y + 26, 44, -Math.PI / 2, -Math.PI / 2 + (c.cd / d.cd) * Math.PI * 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  drawCup(ctx, x + 10, y + CARD_H - 9, 0.7);
  ctx.fillStyle = afford ? '#dcdcaa' : '#d1695c'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(d.cost), x + 20, y + CARD_H - 5);
  ctx.fillStyle = '#6f6f6f'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(i + 1), x + CARD_W - 8, y + 11);
}
function drawShovel() {
  const x = CARD_X0 + 7 * (CARD_W + CARD_GAP), y = CARD_Y;
  ctx.fillStyle = '#2d2d2d'; ctx.strokeStyle = S.shovel ? '#dcdcaa' : '#3c3c3c'; ctx.lineWidth = S.shovel ? 3 : 1.5;
  rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x + CARD_W / 2, y + 24); ctx.rotate(-0.6);
  ctx.strokeStyle = '#b0895a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 6); ctx.stroke();
  ctx.fillStyle = '#9d9d9d'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, 6); ctx.lineTo(4, 18); ctx.lineTo(-4, 18); ctx.closePath(); ctx.fill(); cStroke2();
  ctx.strokeStyle = '#b0895a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(5, -14); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#6a9955'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('revert', x + CARD_W / 2, y + CARD_H - 5);
  function cStroke2() { ctx.stroke(); }
}

// ---------- overlays ----------
const $ = id => document.getElementById(id);
function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function showEnd(kind) {
  if ($('ovEnd').classList.contains('hidden') === false) return;
  const win = kind === 'win';
  $('endKicker').textContent = win ? 'BUILD SUCCESS' : 'BUILD FAILED';
  $('endKicker').style.color = win ? '#7ed957' : '#d1695c';
  $('endTitle').textContent = win ? '编译通过，编辑器守住了' : '你的电脑被装满了全家桶';
  $('endTerm').innerHTML = win
    ? '<span class="ok">&gt; build finished in 3.2s</span>\n<span class="ok">&gt; 0 errors, 0 warnings</span>\n<span class="dim">&gt; [OK] 编辑器 守住了</span>\n<span class="dim">&gt; [OK] 发际线 守住了</span>'
    : '<span class="bad">&gt; 正在安装全家桶… 100%</span>\n<span class="dim">&gt; [OK] Clippy 已恢复为默认助手</span>\n<span class="dim">&gt; [OK] Edge 已设为默认浏览器</span>\n<span class="dim">&gt; [OK] 开机启动项 +7</span>\n<span class="bad">&gt; [ERR] 你的代码 未保存</span>';
  $('endStats').textContent = '用时 ' + fmtTime(S.t) + ' · 击杀 ' + S.kills + ' · 收集咖啡 ' + S.got;
  $('ovEnd').classList.remove('hidden');
}
function start() {
  AU.ensure();
  reset();
  S.running = true;
  $('ovStart').classList.add('hidden');
  $('ovPause').classList.add('hidden');
  $('ovEnd').classList.add('hidden');
}
$('btnStart').onclick = start;
$('btnAgain').onclick = start;
$('btnRestart1').onclick = start;
$('btnResume').onclick = togglePause;

// start-screen roster icons
function iconCanvas(drawFn, sc, oy) {
  const c = document.createElement('canvas');
  c.width = 92; c.height = 92;
  const g = c.getContext('2d');
  g.setTransform(2 * sc, 0, 0, 2 * sc, 46, oy);
  drawFn(g, 0.6, {});
  return c;
}
for (const k of PLANT_ORDER) {
  const d = PLANTS[k];
  const div = document.createElement('div'); div.className = 'unit';
  div.appendChild(iconCanvas((g, t) => ART.p[k](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1 }), 0.62, 52));
  div.insertAdjacentHTML('beforeend', '<div class="nm">' + d.name + '</div><div class="cost">' + d.cost + ' 咖啡</div>');
  $('rosterYou').appendChild(div);
}
const Z_ICON = { clippy: [0.62, 62], ie: [0.62, 62], edge: [0.62, 62], update: [0.56, 64], bsod: [0.56, 62], garg: [0.36, 58] };
for (const k of ZOMB_ORDER) {
  const d = ZOMBIES[k];
  const div = document.createElement('div'); div.className = 'unit';
  div.appendChild(iconCanvas((g, t) => ART.z[k](g, t, { seed: 1 }), Z_ICON[k][0], Z_ICON[k][1]));
  div.insertAdjacentHTML('beforeend', '<div class="nm">' + d.name + '</div><div class="cost">' + d.desc + '</div>');
  $('rosterFoe').appendChild(div);
}

// ---------- loop ----------
let last = 0;
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  if (S.running && !S.paused && !S.over) update(dt);
  else if (S.over) { S.overT > 0 && (S.overT -= dt); if (S.overT <= 0) showEnd(S.over); }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(ts => { last = ts; requestAnimationFrame(frame); });

// debug / test hook
window.__mvc = {
  state: () => S,
  tap: handleTap,
  give: n => { S.coffee += n; },
  spawn: (ty, row) => spawnZombie(ty, row ?? (Math.random() * ROWS) | 0),
  to: t => { S.t = t; },
  end: kind => { S.over = kind; S.overT = 0.01; },
  start,
};
})();
