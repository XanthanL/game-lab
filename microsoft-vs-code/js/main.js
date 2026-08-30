/* 引擎：状态机、关卡驱动、战斗、HUD、选关与进度存档 */
'use strict';
(() => {

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit); fit();

/* ---------- 音效 ---------- */
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
      case 'ping': this.tone(1244, 1244, 0.09, 'sine', 0.1); this.tone(1660, 1660, 0.14, 'sine', 0.1, 0.09); break;
      case 'pop': this.tone(600, 120, 0.08, 'triangle', 0.16); break;
      case 'beam': this.tone(1600, 300, 0.18, 'sawtooth', 0.07); break;
      case 'revive': this.tone(196, 392, 0.35, 'sawtooth', 0.1); break;
      case 'lose': [400, 320, 250, 180].forEach((f, i) => this.tone(f, f * 0.9, 0.25, 'sawtooth', 0.12, i * 0.22)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.14, i * 0.14)); break;
    }
  }
};

/* ---------- 进度存档 ---------- */
let unlocked = Math.min(Math.max(parseInt(localStorage.getItem('mvc.unlocked') || '1', 10) || 1, 1), LEVELS.length);
function saveUnlock(n) {
  unlocked = Math.max(unlocked, Math.min(n, LEVELS.length));
  localStorage.setItem('mvc.unlocked', String(unlocked));
}

/* ---------- 状态 ---------- */
const NIGHT_T = 100;
let S = null;
function buildScript(lv) {
  const ev = [];
  for (const [t0, t1, type, n] of lv.waves)
    for (let i = 0; i < n; i++)
      ev.push({ t: t0 + (t1 - t0) * (i / Math.max(n - 1, 1)) + Math.random() * 3, type, row: (Math.random() * ROWS) | 0 });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}
function startLevel(cfg) {
  S = {
    lv: cfg, t: 0, coffee: 200, phase: cfg.night ? 'night' : 'day',
    plants: [], zombies: [], shots: [], beams: [], tokens: [], parts: [], floats: [], flashes: [],
    pads: new Set(),
    cards: cfg.cards.map(k => ({ key: k, cd: 0 })),
    sel: null, shovel: false,
    script: buildScript(cfg), si: 0, spawned: 0,
    skyT: 6, kills: 0, got: 0,
    shake: 0, over: null, overT: 0, paused: false, running: true,
  };
  hideAll();
}
function idleState() {
  S = { lv: LEVELS[0], t: 0, coffee: 0, phase: 'day', plants: [], zombies: [], shots: [], beams: [], tokens: [], parts: [], floats: [], flashes: [], pads: new Set(), cards: LEVELS[0].cards.map(k => ({ key: k, cd: 0 })), sel: null, shovel: false, script: [], si: 0, spawned: 0, skyT: 99, kills: 0, got: 0, shake: 0, over: null, overT: 0, paused: false, running: false };
}
idleState();

const poolRows = () => (S.lv.pool ? [1, 2] : []);
const isPool = r => S.lv.pool && (r === 1 || r === 2);
function bannerAt(t) { return S.lv.banners.find(b => t >= b[0] && t < b[0] + 3); }

/* ---------- 实体 ---------- */
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
  const z = {
    type, row, x: W + 30 + Math.random() * 30, y0: cellY(row), hp: d.hp, maxHp: d.hp,
    seed: Math.random() * 7, slow: 0, flash: 0, abT: 6, idle: 0, idleT: 5 + Math.random() * 4,
    fly: type === 'balloon', land: false, dying: false, reviveT: 0, compat: false,
  };
  S.zombies.push(z);
  if (type !== 'popup') S.spawned++;
  if (type !== 'popup') AU.play('groan');
  return z;
}
function addToken(x, y, fromSky) { S.tokens.push({ x, y: fromSky ? -20 : y - 46, ty: y, life: 10, born: 0 }); }
function float(x, y, text, col = '#e8e8e8') { S.floats.push({ x, y, text, col, life: 1.2 }); }
function burst(x, y, n, col, spd = 160, text = null) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 300, life: 0.5 + Math.random() * 0.5, col, r: 2 + Math.random() * 3, text: text && Math.random() < 0.5 ? text : null });
  }
}
function explode(x, y, row, radius, dmg, big) {
  AU.play('boom');
  S.shake = big ? 0.4 : 0.25;
  burst(x, y, big ? 26 : 14, '#ffb347', 240);
  burst(x, y, 8, '#7ed957', 180, 'rm -rf');
  for (const z of S.zombies) {
    if (z.dying) continue;
    const dy = (z.row - row) * CELL_H;
    if (Math.hypot(z.x - x, dy) < radius) damageZombie(z, dmg);
  }
}
function damageZombie(z, dmg) { z.hp -= dmg; z.flash = 0.12; }

/* ---------- 更新 ---------- */
function update(dt) {
  S.t += dt;
  if (S.shake > 0) S.shake -= dt;
  for (const c of S.cards) c.cd = Math.max(0, c.cd - dt);

  if (S.phase === 'day' && S.t >= NIGHT_T) { S.phase = 'night'; AU.play('horn'); }
  if (S.phase === 'day') {
    S.skyT -= dt;
    if (S.skyT <= 0) { S.skyT = 10; addToken(LAWN_X + 40 + Math.random() * (LAWN_R - LAWN_X - 80), LAWN_Y + 30 + Math.random() * (ROWS * CELL_H - 60), true); }
  }
  while (S.si < S.script.length && S.script[S.si].t <= S.t) { const e = S.script[S.si++]; spawnZombie(e.type, e.row); }

  // stack 增益图
  const buffed = new Set();
  for (const st of S.plants) if (st.key === 'stack')
    for (const p of S.plants) if (['log', 'keyboard', 'firewall', 'monitor'].includes(p.key) && Math.abs(p.row - st.row) <= 1 && Math.abs(p.col - st.col) <= 1) buffed.add(p);

  // 植物
  for (const p of S.plants) {
    p.biteT = Math.max(0, p.biteT - dt); p.fireT = Math.max(0, p.fireT - dt);
    if (p.stun > 0) { p.stun -= dt; continue; }
    if (p.key === 'coffee') {
      p.prodT -= dt;
      if (p.prodT <= 0) { p.prodT = 18; addToken(p.x + 26, p.y - 6, false); AU.play('ding'); }
    } else if (['log', 'keyboard', 'firewall'].includes(p.key)) {
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      const rate = (p.key === 'keyboard' ? 0.7 : 1.4) * boost;
      const target = S.zombies.some(z => z.row === p.row && !z.dying && z.x > p.x + 10 && z.x < W + 40);
      if (target && p.rateT <= 0) {
        p.rateT = rate; p.fireT = 0.15;
        S.shots.push({ x: p.x + 30, y: p.y - 8, row: p.row, kind: p.key, dmg: p.key === 'log' ? 25 : 20, ch: 'QWERTASDFG'[(Math.random() * 10) | 0] });
        AU.play('shoot');
      }
    } else if (p.key === 'monitor') {
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      if (p.rateT <= 0) {
        const tgt = S.zombies.filter(z => z.row === p.row && !z.dying && z.x > p.x + 10).sort((a, b) => a.x - b.x)[0];
        if (tgt) {
          p.rateT = 4 * boost; p.fireT = 0.25;
          damageZombie(tgt, 120);
          S.beams.push({ x1: p.x + 26, x2: tgt.x, y: p.y - 10, life: 0.18 });
          AU.play('beam');
        }
      }
    } else if (p.key === 'bp') {
      if (!p.armed) { p.armT += dt; if (p.armT >= 8) p.armed = true; }
      else if (S.zombies.some(z => !z.fly && !z.dying && Math.abs(z.x - p.x) < 28 && z.row === p.row)) {
        explode(p.x, p.y, p.row, 95, 1200, false); p.hp = -1;
      }
    } else if (p.key === 'rmrf') {
      p.fuse -= dt;
      if (p.fuse <= 0) { explode(p.x, p.y, p.row, CELL_W * 1.7, 1800, true); p.hp = -1; }
    }
  }

  // 子弹
  for (const s of S.shots) {
    s.x += 420 * dt;
    const z = S.zombies.find(z => z.row === s.row && Math.abs(z.x - s.x) < 26 && z.hp > 0 && !z.dying);
    if (z) {
      damageZombie(z, s.dmg);
      if (s.kind === 'firewall') z.slow = 3;
      if (z.type === 'balloon' && z.fly && z.hp <= 60) { z.fly = false; z.land = true; z.speedBuff = 0.66; AU.play('pop'); burst(z.x, z.y0 - 40, 10, '#ff8080', 160); }
      AU.play('hit');
      burst(s.x, s.y, 4, s.kind === 'firewall' ? '#35c1f1' : '#7ed957', 90);
      s.dead = true;
    } else if (s.x > W + 20) s.dead = true;
  }
  S.shots = S.shots.filter(s => !s.dead);
  for (const b of S.beams) b.life -= dt;
  S.beams = S.beams.filter(b => b.life > 0);

  // 僵尸
  for (const z of S.zombies) {
    z.flash = Math.max(0, z.flash - dt); z.slow = Math.max(0, z.slow - dt);
    const d = ZOMBIES[z.type];
    if (z.dying) {
      z.reviveT -= dt;
      if (z.reviveT <= 0) { z.dying = false; z.compat = true; z.hp = 380; z.speedBuff = 1.3; AU.play('revive'); float(z.x, cellY(z.row) - 80, '兼容模式 启动', '#b48ee0'); }
      continue;
    }
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
    if (z.type === 'teams') {
      z.abT -= dt;
      if (z.abT <= 0) {
        z.abT = 10;
        if (S.zombies.filter(p => p.type === 'popup').length < 8) {
          const im = spawnZombie('popup', z.row); im.x = z.x - 10;
          AU.play('ping'); float(z.x, cellY(z.row) - 84, '方便吗？', '#8f94d8');
        }
      }
    }
    const speed = d.speed * (z.slow > 0 ? 0.5 : 1) * (z.speedBuff || 1) * (z.type === 'garg' && z.hp < z.maxHp * 0.5 ? 1.25 : 1);
    if (!z.fly) {
      const meal = S.plants.find(p => p.row === z.row && p.hp > 0 && z.x - p.x > -6 && z.x - p.x < 34);
      if (meal) {
        meal.hp -= d.dps * dt; meal.biteT = 0.25;
        if (meal.key === 'duck' && Math.random() < dt * 2) AU.play('quack');
      } else if (z.idle <= 0) {
        z.x -= speed * dt;
      }
      if (z.x < LOSE_X && !S.over) { S.over = 'lose'; S.overT = 1.4; AU.play('lose'); }
    } else {
      z.x -= speed * dt;
      if (z.x < LOSE_X && !S.over) { S.over = 'lose'; S.overT = 1.4; AU.play('lose'); }
    }
  }

  // 死亡
  for (const z of S.zombies) {
    if (z.hp <= 0 && !z.dying) {
      if (z.type === 'dotnet' && !z.compatDone) {
        z.dying = true; z.reviveT = 3; z.compatDone = true;
        burst(z.x, cellY(z.row), 10, '#b48ee0', 130);
        float(z.x, cellY(z.row) - 70, '正在重启…', '#b48ee0');
        continue;
      }
      S.kills++;
      burst(z.x, cellY(z.row), 12, '#9fb89f', 150);
      if (z.type === 'balloon' && z.fly) AU.play('pop');
      if (z.type === 'bsod') {
        S.flashes.push({ row: z.row, life: 0.6 });
        for (const p of S.plants) if (p.row === z.row) p.stun = Math.max(p.stun, 3);
        AU.play('stun');
      }
    }
  }
  S.zombies = S.zombies.filter(z => z.hp > 0 || z.dying);
  S.plants = S.plants.filter(p => p.hp > 0);

  // 杂项
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

  if (!S.over && S.si >= S.script.length && S.zombies.length === 0 && S.t > S.lv.winT) {
    S.over = 'win'; S.overT = 1.0; AU.play('win');
    saveUnlock(S.lv.id + 1);
  }
}

/* ---------- 输入 ---------- */
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = toLogical(e); handleTap(p.x, p.y); });
function cardX(i) { return CARD_X0 + i * (CARD_W + CARD_GAP); }
function handleTap(x, y) {
  if (!S.running || S.paused || S.over) return;
  if (y >= HUD_Y && y <= HUD_Y + HUD_H) {
    for (let i = 0; i < S.cards.length; i++) {
      if (x >= cardX(i) && x <= cardX(i) + CARD_W) { selectCard(i); return; }
    }
    const sx = cardX(S.cards.length);
    if (x >= sx && x <= sx + CARD_W) { S.shovel = !S.shovel; S.sel = null; AU.play('click'); return; }
    if (x >= 1196 && x <= 1224) { togglePause(); return; }
    if (x >= 1232 && x <= 1260) { AU.muted = !AU.muted; AU.play('click'); return; }
    return;
  }
  for (let i = S.tokens.length - 1; i >= 0; i--) {
    const tk = S.tokens[i];
    if (Math.hypot(tk.x - x, tk.y - y) < 30) {
      S.coffee += 30; S.got += 30;
      float(tk.x, tk.y - 14, '+30', '#dcdcaa');
      burst(tk.x, tk.y, 6, '#dcdcaa', 100);
      AU.play('ding');
      S.tokens.splice(i, 1);
      return;
    }
  }
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
      const key = S.cards[S.sel].key, c = S.cards[S.sel], d = PLANTS[key];
      const water = isPool(row), hasPad = S.pads.has(row + ',' + col);
      if (key === 'pad') {
        if (water && !hasPad && c.cd <= 0 && S.coffee >= d.cost) {
          S.coffee -= d.cost; c.cd = d.cd; S.pads.add(row + ',' + col);
          AU.play('plant'); burst(cellX(col), cellY(row) + 14, 6, '#3f9e63', 90);
        }
        return;
      }
      if (water && !hasPad) { float(x, y - 10, '先放分支莲叶', '#d1695c'); return; }
      if (c.cd <= 0 && S.coffee >= d.cost) {
        S.coffee -= d.cost; c.cd = d.cd;
        addPlant(key, row, col);
        AU.play('plant');
        burst(cellX(col), cellY(row), 6, '#7ed957', 90);
      }
    }
  }
}
function selectCard(i) { S.sel = S.sel === i ? null : i; S.shovel = false; AU.play('click'); }
function togglePause() {
  if (!S.running || S.over) return;
  S.paused = !S.paused;
  $('ovPause').classList.toggle('hidden', !S.paused);
  AU.play('click');
}
addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.running && !S.over) togglePause();
  if (!S.running || S.paused || S.over) return;
  const n = parseInt(e.key, 10);
  if (e.key === '0' && S.cards.length >= 10) selectCard(9);
  else if (n >= 1 && n <= S.cards.length) selectCard(n - 1);
  if (e.key === 'x' || e.key === 'X') { S.shovel = !S.shovel; S.sel = null; }
});
addEventListener('blur', () => { if (S.running && !S.over && !S.paused) togglePause(); });

/* ---------- 绘制 ---------- */
function clockStr() {
  let m;
  if (S.lv.night) m = 23 * 60 + S.t * 0.6;
  else if (S.phase === 'day') m = 9 * 60 + (S.t / NIGHT_T) * 600;
  else m = 19 * 60 + Math.min(S.t - NIGHT_T, 140) / 140 * 180;
  m = Math.floor(m) % (24 * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
const THEME = {
  day:    { a: '#212121', b: '#272727', bar: '#1e1e1e' },
  night:  { a: '#181c26', b: '#1d2230', bar: '#151820' },
  pool:   { a: '#20242a', b: '#262b31', bar: '#1c1f24' },
  server: { a: '#15222b', b: '#1a2a35', bar: '#101a21' },
  boss:   { a: '#231c1e', b: '#2b2225', bar: '#1c1416' },
};

function draw() {
  const t = S.t, th = THEME[S.lv.theme] || THEME.day;
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * S.shake, (Math.random() - 0.5) * 8 * S.shake);

  ctx.fillStyle = th.bar; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = '#2d2d2d'; ctx.fillRect(-10, -10, W + 10, TITLE_H + 10);
  ['#d1695c', '#dcdcaa', '#7ed957'].forEach((col, i) => { ctx.fillStyle = col; circ(ctx, 22 + i * 20, 20, 5); ctx.fill(); });
  ctx.fillStyle = '#9d9d9d'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(S.lv.file + ' — 微软大战代码 · Visual Studio Code (parody)', W / 2, 24);
  ctx.textAlign = 'right'; ctx.fillStyle = S.phase === 'night' ? '#d1695c' : '#8a8a8a';
  ctx.fillText(clockStr() + (S.phase === 'night' ? ' · 加班' : ''), W - 16, 24);

  ctx.fillStyle = '#252526'; ctx.fillRect(0, HUD_Y, W, HUD_H);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HUD_Y + HUD_H); ctx.lineTo(W, HUD_Y + HUD_H); ctx.stroke();

  // 草坪（编辑器行）
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = r % 2 ? th.a : th.b;
    ctx.fillRect(LAWN_X, LAWN_Y + r * CELL_H, COLS * CELL_W, CELL_H);
    ctx.fillStyle = '#4a4a4a'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(r + 1), LAWN_X - 12, LAWN_Y + r * CELL_H + 20);
    if (S.lv.theme === 'server') {
      ctx.fillStyle = (Math.floor(t * 2) + r) % 3 === 0 ? '#7ed957' : '#31424e';
      circ(ctx, 26, LAWN_Y + r * CELL_H + 16, 2.5); ctx.fill();
      ctx.fillStyle = (Math.floor(t * 3) + r) % 4 === 0 ? '#dcdcaa' : '#31424e';
      circ(ctx, 36, LAWN_Y + r * CELL_H + 16, 2.5); ctx.fill();
    }
  }
  if (S.lv.pool) drawWater(ctx, t, LAWN_Y + CELL_H, CELL_H * 2);
  if (t % 1 < 0.55 && S.running) { ctx.fillStyle = '#7ed957'; ctx.fillRect(LAWN_X + 6, LAWN_Y + (Math.floor(t / 2) % ROWS) * CELL_H + 10, 2, 16); }

  // 分支莲叶
  if (S.lv.pool) for (const k of S.pads) {
    const [r, c] = k.split(',').map(Number);
    drawPad(ctx, cellX(c), cellY(r), t);
  }

  // 右侧来袭区
  const g = ctx.createLinearGradient(LAWN_R, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = g; ctx.fillRect(LAWN_R, LAWN_Y, W - LAWN_R, ROWS * CELL_H);
  ctx.fillStyle = '#333'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  rr(ctx, 1216, 330, 52, 26, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7ed957'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('M$', 1242, 347);
  ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(1242, 356); ctx.lineTo(1242, 380); ctx.stroke();

  // 你的主机
  ctx.fillStyle = '#2a2a2a'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  rr(ctx, 14, 320, 76, 56, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = S.over === 'lose' ? '#0078d7' : (S.lv.theme === 'server' ? '#10243a' : '#10241a');
  rr(ctx, 20, 326, 64, 44, 3); ctx.fill();
  if (S.over === 'lose') { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(':(', 52, 352); }
  else {
    ctx.fillStyle = '#3f6f4f'; ctx.fillRect(26, 334, 30, 3); ctx.fillRect(26, 342, 40, 3); ctx.fillRect(26, 350, 24, 3);
    ctx.fillStyle = '#7ed957'; ctx.fillRect(26, 358, 6, 3);
  }
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(46, 376, 12, 10); ctx.fillRect(34, 386, 36, 6);

  // 植物
  for (const p of [...S.plants].sort((a, b) => a.row - b.row)) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(t * 1.2 + p.seed) * 0.02);
    const q = p.biteT > 0 ? 0.08 : 0;
    ctx.scale(1 + q, 1 - q);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, 7); ctx.fill();
    ART.p[p.key](ctx, t, p);
    if (buffGlow(p)) { ctx.strokeStyle = 'rgba(244,128,36,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 34, 24, 7, 0, 0, 7); ctx.stroke(); }
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

  // 4K 显示器光束
  for (const b of S.beams) {
    ctx.strokeStyle = 'rgba(191,232,255,' + (b.life / 0.18) * 0.9 + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y); ctx.lineTo(b.x2, b.y); ctx.stroke();
  }

  // 子弹
  for (const s of S.shots) {
    ctx.save(); ctx.translate(s.x, s.y);
    if (s.kind === 'log') {
      ctx.shadowColor = '#7ed957'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#7ed957'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('{}', 0, 4);
    } else if (s.kind === 'keyboard') {
      ctx.fillStyle = '#d8d8d8'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      rr(ctx, -6, -6, 12, 12, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(s.ch, 0, 3);
    } else if (s.kind === 'monitor') {
      ctx.fillStyle = '#bfe8ff'; rr(ctx, -8, -2, 16, 4, 2); ctx.fill();
    } else {
      ctx.shadowColor = '#35c1f1'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#35c1f1';
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // 僵尸
  for (const z of [...S.zombies].sort((a, b) => a.row - b.row)) {
    const flying = z.fly;
    let y = cellY(z.row);
    if (S.lv.pool && (z.row === 1 || z.row === 2) && !flying) y += 8;
    z.y0 = y;
    ctx.save(); ctx.translate(z.x, y);
    if (flying) ctx.translate(0, -36);
    if (z.dying) { ctx.globalAlpha = 0.45; ctx.rotate(-1.3); }
    else if (z.type === 'telemetry' && z.x > 700) ctx.globalAlpha = 0.3 + 0.08 * Math.sin(t * 5);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, flying ? 46 : 42, 24, 7, 0, 0, 7); ctx.fill();
    if (z.type === 'edge' && !z.dying) {
      ctx.globalAlpha *= 0.16; ctx.translate(16, 0); ART.z.edge(ctx, t, z); ctx.translate(-16, 0); ctx.globalAlpha = z.dying ? 0.45 : (z.type === 'telemetry' && z.x > 700 ? 0.3 : 1);
    }
    ART.z[z.type](ctx, t, z);
    if (z.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; circ(ctx, 0, -20, 26); ctx.fill(); }
    if (z.slow > 0) {
      ctx.fillStyle = 'rgba(53,193,241,.18)'; circ(ctx, 0, -16, 30); ctx.fill();
      ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 6, -40 - Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 6, -40 + Math.sin(a) * 6); ctx.stroke(); }
    }
    if (z.type === 'ie' && z.idle > 0) {
      ctx.save(); ctx.translate(0, -74); ctx.rotate(t * 6);
      ctx.strokeStyle = '#dcdcaa'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0.5, 5.5); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // BSOD 行闪
  for (const f of S.flashes) {
    ctx.fillStyle = 'rgba(0,120,215,' + (f.life * 0.5) + ')';
    ctx.fillRect(LAWN_X, LAWN_Y + f.row * CELL_H, COLS * CELL_W, CELL_H);
  }

  // 咖啡
  for (const tk of S.tokens) {
    ctx.save(); ctx.translate(tk.x, tk.y);
    if (tk.life < 2 && t % 0.4 < 0.15) ctx.globalAlpha = 0.3;
    const sc = tk.born < 0.3 ? 0.6 + tk.born * 1.3 : 1 + 0.05 * Math.sin(t * 4);
    ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(220,220,170,.7)'; ctx.shadowBlur = 12;
    drawCup(ctx, 0, 0, 1.4);
    ctx.restore();
  }

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

  if (S.phase === 'night') { ctx.fillStyle = 'rgba(8,12,38,.2)'; ctx.fillRect(0, LAWN_Y, W, ROWS * CELL_H); }
  if (S.lv.theme === 'boss') {
    ctx.fillStyle = 'rgba(160,20,30,' + (0.05 + 0.03 * Math.sin(t * 2)) + ')';
    ctx.fillRect(0, LAWN_Y, W, ROWS * CELL_H);
  }

  // HUD
  drawCup(ctx, 34, HUD_Y + 31, 1.5);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(S.coffee), 58, HUD_Y + 38);
  for (let i = 0; i < S.cards.length; i++) drawCard(i);
  drawShovel();
  const frac = S.spawned / Math.max(S.script.length, 1);
  ctx.fillStyle = '#333'; rr(ctx, 960, HUD_Y + 27, 220, 9, 4); ctx.fill();
  ctx.fillStyle = '#7ed957'; rr(ctx, 960, HUD_Y + 27, Math.max(6, 220 * frac), 9, 4); ctx.fill();
  ctx.fillStyle = '#8a8a8a'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText('波次', 954, HUD_Y + 35);
  ctx.strokeStyle = '#9d9d9d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1206, HUD_Y + 22); ctx.lineTo(1206, HUD_Y + 40); ctx.moveTo(1215, HUD_Y + 22); ctx.lineTo(1215, HUD_Y + 40); ctx.stroke();
  ctx.fillStyle = '#9d9d9d';
  ctx.beginPath(); ctx.moveTo(1238, HUD_Y + 22); ctx.lineTo(1238, HUD_Y + 40); ctx.lineTo(1252, HUD_Y + 31); ctx.closePath(); ctx.fill();
  if (AU.muted) { ctx.strokeStyle = '#d1695c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(1254, HUD_Y + 24); ctx.lineTo(1262, HUD_Y + 38); ctx.stroke(); }

  // Boss 血条
  const gargs = S.zombies.filter(z => z.type === 'garg');
  if (gargs.length) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, W / 2 - 160, HUD_Y + HUD_H + 8, 320, 22, 5); ctx.fill();
    const tot = gargs.reduce((a, z) => a + z.hp, 0) / gargs.reduce((a, z) => a + z.maxHp, 0);
    ctx.fillStyle = '#d1695c'; rr(ctx, W / 2 - 156, HUD_Y + HUD_H + 12, 312 * tot, 14, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('强制更新.exe × ' + gargs.length, W / 2, HUD_Y + HUD_H + 23);
  }

  ctx.fillStyle = '#161616'; ctx.fillRect(0, LAWN_Y + ROWS * CELL_H, W, H - LAWN_Y - ROWS * CELL_H);
  ctx.fillStyle = '#5a5a5a'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('第 ' + S.lv.id + ' 关 · ' + S.lv.name + ' · 守住编辑器', 16, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText('击杀 ' + S.kills, W - 16, H - 8);

  const b = bannerAt(t);
  if (b && S.running) {
    const k = (t - b[0]) / 3;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 300, W, 110);
    ctx.fillStyle = b[3]; ctx.font = '900 44px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(b[1], W / 2, 352); ctx.fillText(b[1], W / 2, 352);
    ctx.fillStyle = '#c8c8c8'; ctx.font = '15px monospace'; ctx.fillText(b[2], W / 2, 386);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function buffGlow(p) {
  return ['log', 'keyboard', 'firewall', 'monitor'].includes(p.key) &&
    S.plants.some(st => st.key === 'stack' && Math.abs(st.row - p.row) <= 1 && Math.abs(st.col - p.col) <= 1);
}

function drawCard(i) {
  const key = S.cards[i].key, c = S.cards[i], d = PLANTS[key];
  const x = cardX(i), y = CARD_Y;
  const afford = S.coffee >= d.cost, ready = c.cd <= 0;
  ctx.fillStyle = '#2d2d2d'; ctx.strokeStyle = S.sel === i ? '#dcdcaa' : '#3c3c3c'; ctx.lineWidth = S.sel === i ? 3 : 1.5;
  rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + 26);
  ctx.scale(0.46, 0.46);
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
  const x = cardX(S.cards.length), y = CARD_Y;
  ctx.fillStyle = '#2d2d2d'; ctx.strokeStyle = S.shovel ? '#dcdcaa' : '#3c3c3c'; ctx.lineWidth = S.shovel ? 3 : 1.5;
  rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x + CARD_W / 2, y + 24); ctx.rotate(-0.6);
  ctx.strokeStyle = '#b0895a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 6); ctx.stroke();
  ctx.fillStyle = '#9d9d9d'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, 6); ctx.lineTo(4, 18); ctx.lineTo(-4, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#b0895a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(5, -14); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#6a9955'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('revert', x + CARD_W / 2, y + CARD_H - 5);
}

/* ---------- 界面 ---------- */
const $ = id => document.getElementById(id);
function hideAll() { ['ovStart', 'ovLevels', 'ovPause', 'ovEnd'].forEach(id => $(id).classList.add('hidden')); }
function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function showEnd(kind) {
  if (!$('ovEnd').classList.contains('hidden')) return;
  const win = kind === 'win';
  $('endKicker').textContent = win ? 'BUILD SUCCESS' : 'BUILD FAILED';
  $('endKicker').style.color = win ? '#7ed957' : '#d1695c';
  $('endTitle').textContent = win ? '第 ' + S.lv.id + ' 关通过，编辑器守住了' : '你的电脑被装满了全家桶';
  $('endTerm').innerHTML = win
    ? '<span class="ok">&gt; build finished in ' + S.t.toFixed(1) + 's</span>\n<span class="ok">&gt; 0 errors, 0 warnings</span>\n<span class="dim">&gt; [OK] 编辑器 守住了</span>\n<span class="dim">&gt; [OK] 发际线 守住了</span>'
    : '<span class="bad">&gt; 正在安装全家桶… 100%</span>\n<span class="dim">&gt; [OK] Clippy 已恢复为默认助手</span>\n<span class="dim">&gt; [OK] Edge 已设为默认浏览器</span>\n<span class="dim">&gt; [OK] 开机启动项 +7</span>\n<span class="bad">&gt; [ERR] 你的代码 未保存</span>';
  $('endStats').textContent = '用时 ' + fmtTime(S.t) + ' · 击杀 ' + S.kills + ' · 收集咖啡 ' + S.got;
  const next = win && S.lv.id < LEVELS.length;
  $('btnNext').style.display = next ? '' : 'none';
  $('ovEnd').classList.remove('hidden');
}
function openLevels() {
  hideAll();
  S.running = false;
  buildLevelCards();
  $('ovLevels').classList.remove('hidden');
}
function buildLevelCards() {
  const wrap = $('lvGrid'); wrap.innerHTML = '';
  for (const lv of LEVELS) {
    const lock = lv.id > unlocked;
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'lv-card' + (lock ? ' locked' : '');
    d.innerHTML = '<div class="lv-n">' + (lock ? '&#128274;' : String(lv.id).padStart(2, '0')) + '</div>' +
      '<div class="lv-name">' + lv.name + '</div>' +
      '<div class="lv-file">' + lv.file + '</div>' +
      '<div class="lv-brief">' + (lock ? '先通过上一关' : lv.brief) + '</div>' +
      (lv.pool ? '<div class="lv-tag">水道</div>' : '') + (lv.night ? '<div class="lv-tag">夜</div>' : '');
    if (!lock) d.onclick = () => { AU.ensure(); startLevel(lv); };
    wrap.appendChild(d);
  }
}
$('btnStart').onclick = () => { AU.ensure(); openLevels(); };
$('btnLevelsBack').onclick = () => { hideAll(); $('ovStart').classList.remove('hidden'); };
$('btnResume').onclick = togglePause;
$('btnRestart1').onclick = () => startLevel(S.lv);
$('btnLevels1').onclick = openLevels;
$('btnLevels2').onclick = openLevels;
$('btnAgain').onclick = () => startLevel(S.lv);
$('btnNext').onclick = () => startLevel(LEVELS.find(l => l.id === S.lv.id + 1));

/* 开始页阵容图鉴 */
function iconCanvas(drawFn, sc, oy) {
  const c = document.createElement('canvas');
  c.width = 92; c.height = 92;
  const g = c.getContext('2d');
  g.setTransform(2 * sc, 0, 0, 2 * sc, 46, oy);
  drawFn(g, 0.6, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1, hp: 999, maxHp: 999 });
  return c;
}
for (const k of ALL_CARDS) {
  const d = PLANTS[k];
  const div = document.createElement('div'); div.className = 'unit';
  div.appendChild(iconCanvas((g, t) => ART.p[k](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1 }), 0.62, 52));
  div.insertAdjacentHTML('beforeend', '<div class="nm">' + d.name + '</div><div class="cost">' + d.cost + ' 咖啡</div>');
  $('rosterYou').appendChild(div);
}
const Z_ICON = { clippy: [0.62, 62], ie: [0.62, 62], edge: [0.62, 62], update: [0.56, 64], bsod: [0.52, 66], garg: [0.32, 54], telemetry: [0.6, 62], teams: [0.58, 62], popup: [0.8, 52], balloon: [0.5, 40], dotnet: [0.5, 62] };
for (const k of Object.keys(ZOMBIES)) {
  const d = ZOMBIES[k];
  const div = document.createElement('div'); div.className = 'unit';
  div.appendChild(iconCanvas((g, t) => ART.z[k](g, t, { seed: 1, hp: 999, maxHp: 999 }), Z_ICON[k][0], Z_ICON[k][1]));
  div.insertAdjacentHTML('beforeend', '<div class="nm">' + d.name + '</div><div class="cost">' + d.lore + '</div>');
  $('rosterFoe').appendChild(div);
}

/* ---------- 主循环 ---------- */
let last = 0;
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  if (S.running && !S.paused && !S.over) update(dt);
  else if (S.over) { if (S.overT > 0) S.overT -= dt; if (S.overT <= 0) showEnd(S.over); }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(ts => { last = ts; requestAnimationFrame(frame); });

/* ---------- 调试钩子 ---------- */
window.__mvc = {
  state: () => S,
  tap: handleTap,
  give: n => { S.coffee += n; },
  spawn: (ty, row) => spawnZombie(ty, row ?? (Math.random() * ROWS) | 0),
  to: tt => { S.t = tt; },
  end: kind => { S.over = kind; S.overT = 0.01; },
  start: n => { AU.ensure(); startLevel(LEVELS[(n || S.lv.id) - 1]); },
  unlockAll: () => { saveUnlock(LEVELS.length); },
  reset: openLevels,
};
})();
