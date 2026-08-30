/* 引擎：状态机、战役驱动、战斗、HUD、选卡/npm 商店/副业花园与存档 */
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
      case 'undo': this.tone(392, 1046, 0.22, 'triangle', 0.16); this.tone(523, 1318, 0.22, 'triangle', 0.12, 0.06); break;
      case 'star': this.tone(1568, 2093, 0.1, 'sine', 0.1); this.tone(2093, 2637, 0.12, 'sine', 0.08, 0.07); break;
      case 'buy': this.tone(523, 523, 0.08, 'square', 0.1); this.tone(784, 784, 0.12, 'square', 0.1, 0.09); break;
      case 'lose': [400, 320, 250, 180].forEach((f, i) => this.tone(f, f * 0.9, 0.25, 'sawtooth', 0.12, i * 0.22)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.14, i * 0.14)); break;
    }
  }
};

/* ---------- 存档 v2（迁移旧档） ---------- */
const SAVE_KEY = '***';
let SAVE = null;
function loadSave() {
  try { SAVE = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { SAVE = null; }
  if (!SAVE || SAVE.v !== 2) {
    const old = parseInt(localStorage.getItem('mvc.unlocked') || '1', 10) || 1;
    SAVE = { v: 2, unlocked: Math.min(Math.max(old, 1), LEVELS.length), stars: 0, upg: {}, garden: [null, null, null, null, null, null, null, null, null], decks: {} };
  }
  if (!Array.isArray(SAVE.garden) || SAVE.garden.length !== 9) SAVE.garden = new Array(9).fill(null);
  SAVE.upg = SAVE.upg || {}; SAVE.decks = SAVE.decks || {};
}
function saveNow() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
loadSave();
const has = id => !!SAVE.upg[id];
function unlockTo(n) { SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(n, LEVELS.length)); saveNow(); }
/* 卡是否可用：关卡池 + 商店解锁 */
function cardUsable(k) { return k !== 'bug' || has('bug'); }
function levelPool(lv) { return lv.cards.filter(cardUsable); }

/* ---------- 战斗状态 ---------- */
const NIGHT_T = 100;
const FOG_X = LAWN_X + 5 * CELL_W;
let S = null;
function buildScript(lv) {
  const ev = [];
  for (const [t0, t1, type, n] of lv.waves)
    for (let i = 0; i < n; i++)
      ev.push({ t: t0 + (t1 - t0) * (i / Math.max(n - 1, 1)) + Math.random() * 3, type, row: (Math.random() * ROWS) | 0 });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}
function autoDeck(lv) {
  const slots = lv.slots + (has('slot') ? 1 : 0);
  const pool = levelPool(lv);
  const deck = [];
  const take = k => { if (pool.includes(k) && deck.length < slots) { deck.push(k); return true; } return false; };
  take('coffee'); take('coffee');
  if (lv.pool) { take('pad'); take('pad'); }
  if (lv.roof) { take('bug'); take('bug'); } else take('log');
  while (deck.length < Math.min(slots, lv.pool ? 6 : 5)) { if (!(take('log') || take('duck') || take('bp'))) break; }
  while (deck.length < slots) { if (!(take('keyboard') || take('firewall') || take('monitor') || take('stack') || take('rmrf') || take('bug') || take('coffee') || take('log') || take('duck'))) break; }
  return deck.slice(0, slots);
}
function startLevel(cfg, deck) {
  let keys = deck && deck.length ? deck.slice(0, cfg.slots + (has('slot') ? 1 : 0)) : (SAVE.decks[cfg.id] && SAVE.decks[cfg.id].filter(cardUsable).length ? SAVE.decks[cfg.id] : autoDeck(cfg));
  keys = keys.filter(k => cfg.cards.includes(k) && cardUsable(k));
  if (!keys.length) keys = autoDeck(cfg);
  S = {
    lv: cfg, t: 0, coffee: (cfg.night ? 300 : 200) + (has('ram16') ? 100 : 0), phase: cfg.night ? 'night' : 'day',
    plants: [], zombies: [], shots: [], arcs: [], beams: [], tokens: [], drops: [], parts: [], floats: [], flashes: [],
    pads: new Set(),
    undos: new Array(ROWS).fill(has('undo2') ? 2 : 1), mouse: null,
    cards: keys.map(k => ({ key: k, cd: 0, cdMax: PLANTS[k].cd * (has('ssd') ? 0.75 : 1) })),
    sel: null, shovel: false,
    script: buildScript(cfg), si: 0, spawned: 0,
    skyT: 6, kills: 0, got: 0, starGot: 0,
    shake: 0, over: null, overT: 0, paused: false, running: true,
  };
  hideAll();
  buildDock();
}
function idleState() {
  S = { lv: LEVELS[0], t: 0, coffee: 0, phase: 'day', plants: [], zombies: [], shots: [], arcs: [], beams: [], tokens: [], drops: [], parts: [], floats: [], flashes: [], pads: new Set(), undos: new Array(ROWS).fill(1), mouse: null, cards: [], sel: null, shovel: false, script: [], si: 0, spawned: 0, skyT: 99, kills: 0, got: 0, starGot: 0, shake: 0, over: null, overT: 0, paused: false, running: false };
}
idleState();

const isPool = r => S.lv.pool && (r === 1 || r === 2);
const inFog = z => S.lv.fog && z.x > FOG_X;
function bannerAt(t) { return S.lv.banners.find(b => t >= b[0] && t < b[0] + 3); }

/* ---------- 实体 ---------- */
function plantAt(row, col) { return S.plants.find(p => p.row === row && p.col === col); }
function addPlant(key, row, col) {
  const d = PLANTS[key];
  const hp = key === 'duck' && has('duckpaint') ? Math.round(d.hp * 1.6) : d.hp;
  S.plants.push({
    key, row, col, x: cellX(col), y: cellY(row),
    hp, maxHp: hp, seed: Math.random() * 7,
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
function addToken(x, y, fromSky, val) { S.tokens.push({ x, y: fromSky ? -20 : y - 46, ty: y, life: 10, born: 0, val: val || 30 }); }
function dropStar(z) {
  const [v, p] = ZOMBIES[z.type].star;
  if (Math.random() < p) S.drops.push({ x: Math.min(z.x, LAWN_R - 20), y: cellY(z.row) - 34, ty: cellY(z.row) + 6, val: v, life: 9, born: 0 });
}
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
    if (S.skyT <= 0) { S.skyT = 10; addToken(LAWN_X + 40 + Math.random() * (LAWN_R - LAWN_X - 80), LAWN_Y + 30 + Math.random() * (ROWS * CELL_H - 60), true, 30); }
  }
  while (S.si < S.script.length && S.script[S.si].t <= S.t) { const e = S.script[S.si++]; spawnZombie(e.type, e.row); }

  const buffed = new Set();
  for (const st of S.plants) if (st.key === 'stack')
    for (const p of S.plants) if (['log', 'keyboard', 'firewall', 'monitor'].includes(p.key) && Math.abs(p.row - st.row) <= 1 && Math.abs(p.col - st.col) <= 1) buffed.add(p);

  for (const p of S.plants) {
    p.biteT = Math.max(0, p.biteT - dt); p.fireT = Math.max(0, p.fireT - dt);
    if (p.stun > 0) { p.stun -= dt; continue; }
    if (p.key === 'coffee') {
      p.prodT -= dt;
      if (p.prodT <= 0) { p.prodT = 15; addToken(p.x + 26, p.y - 6, false, has('coffeexl') ? 40 : 30); AU.play('ding'); }
    } else if (['log', 'keyboard', 'firewall'].includes(p.key)) {
      if (S.lv.roof) continue; // 直线请求被同源策略弹开（选卡界面已禁用，双保险）
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      const rate = (p.key === 'keyboard' ? 0.7 : 1.4) * boost;
      const target = S.zombies.some(z => z.row === p.row && !z.dying && z.x > p.x + 10 && z.x < W + 40);
      if (target && p.rateT <= 0) {
        p.rateT = rate; p.fireT = 0.15;
        S.shots.push({ x: p.x + 30, y: p.y - 8, row: p.row, kind: p.key, dmg: p.key === 'log' ? 25 : 20, ch: 'QWERTASDFG'[(Math.random() * 10) | 0] });
        AU.play('shoot');
      }
    } else if (p.key === 'bug') {
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      if (p.rateT <= 0) {
        const tgt = S.zombies.filter(z => z.row === p.row && !z.dying && z.x > p.x + 60 && z.x < W + 20).sort((a, b) => a.x - b.x)[0];
        if (tgt) {
          p.rateT = 1.6 * boost; p.fireT = 0.2;
          const dist = tgt.x - p.x;
          S.arcs.push({ x0: p.x + 20, y0: p.y - 34, x1: tgt.x, row: p.row, t: 0, dur: Math.min(Math.max(dist / 300, 0.5), 1.6), dmg: 75 });
          AU.play('shoot');
        }
      }
    } else if (p.key === 'monitor') {
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      if (p.rateT <= 0) {
        const tgt = S.zombies.filter(z => z.row === p.row && !z.dying && z.x > p.x + 10).sort((a, b) => a.x - b.x)[0];
        if (tgt) {
          p.rateT = 4 * boost; p.fireT = 0.25;
          damageZombie(tgt, has('calib') ? 180 : 120);
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

  // 直线子弹
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

  // 抛物线 BUG 单
  for (const a of S.arcs) {
    a.t += dt;
    const k = a.t / a.dur;
    if (k >= 1) {
      a.dead = true;
      burst(a.x1, cellY(a.row) + 6, 10, '#d1695c', 150, '!');
      AU.play('pop');
      for (const z of S.zombies) if (z.row === a.row && !z.dying && Math.abs(z.x - a.x1) < 70) damageZombie(z, a.dmg);
    }
  }
  S.arcs = S.arcs.filter(a => !a.dead);
  for (const b of S.beams) b.life -= dt;
  S.beams = S.beams.filter(b => b.life > 0);

  // 僵尸
  for (const z of S.zombies) {
    z.flash = Math.max(0, z.flash - dt); z.slow = Math.max(0, z.slow - dt);
    const d = ZOMBIES[z.type];
    if (z.dying) {
      z.reviveT -= dt;
      if (z.reviveT <= 0) { z.dying = false; z.compat = true; z.hp = 380; z.speedBuff = 1.3; AU.play('revive'); float(z.x, cellY(z.row) - 60, '兼容模式 启动', '#b48ee0'); }
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
          AU.play('ping'); float(z.x, cellY(z.row) - 56, '方便吗？', '#8f94d8');
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
    } else {
      z.x -= speed * dt;
    }
    if (z.x < LOSE_X && !S.over) { S.over = 'lose'; S.overT = 1.4; AU.play('lose'); }
  }

  // Ctrl+Z 撤销救援
  for (const z of S.zombies) {
    if (!z.dying && z.x < 178 && S.undos[z.row] > 0) {
      S.undos[z.row]--;
      S.flashes.push({ row: z.row, life: 0.45, max: 0.45, col: '240,240,240' });
      S.shake = 0.35; AU.play('undo');
      float(LAWN_X + 52, cellY(z.row) - 36, 'Ctrl + Z !', '#4ec9b0');
      for (const t2 of S.zombies) if (t2.row === z.row && !t2.dying) { t2.hp = 0; burst(Math.max(t2.x, LAWN_X + 10), cellY(t2.row), 8, '#c8c8c8', 160); }
    }
  }

  // 死亡与 star 掉落
  for (const z of S.zombies) {
    if (z.hp <= 0 && !z.dying) {
      if (z.type === 'dotnet' && !z.compatDone) {
        z.dying = true; z.reviveT = 3; z.compatDone = true;
        burst(z.x, cellY(z.row), 10, '#b48ee0', 130);
        float(z.x, cellY(z.row) - 60, '正在重启…', '#b48ee0');
        continue;
      }
      S.kills++;
      dropStar(z);
      burst(z.x, cellY(z.row), 12, '#9fb89f', 150);
      if (z.type === 'balloon' && z.fly) AU.play('pop');
      if (z.type === 'bsod') {
        S.flashes.push({ row: z.row, life: 0.6, max: 0.6, col: '0,120,215' });
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
  for (const dr of S.drops) {
    dr.born += dt; dr.life -= dt;
    if (dr.y < dr.ty) dr.y = Math.min(dr.ty, dr.y + 240 * dt);
    if (has('vacuum') && dr.born > 0.9) { collectStar(dr); dr.life = 0; }
  }
  S.drops = S.drops.filter(dr => dr.life > 0);
  for (const p of S.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
  S.parts = S.parts.filter(p => p.life > 0);
  for (const f of S.floats) { f.life -= dt; f.y -= 40 * dt; }
  S.floats = S.floats.filter(f => f.life > 0);
  for (const f of S.flashes) f.life -= dt;
  S.flashes = S.flashes.filter(f => f.life > 0);

  if (!S.over && S.si >= S.script.length && S.zombies.length === 0 && S.t > S.lv.winT) {
    S.over = 'win'; S.overT = 1.0; AU.play('win');
    unlockTo(S.lv.id + 1);
  }
}
function collectStar(dr) {
  SAVE.stars += dr.val; S.starGot += dr.val; saveNow();
  float(dr.x, dr.y - 14, '+' + dr.val + ' ★', '#ffe28a');
  burst(dr.x, dr.y, 5, '#ffe28a', 90);
  AU.play('star');
}

/* ---------- 输入 ---------- */
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = toLogical(e); S.mouse = p; handleTap(p.x, p.y); });
cv.addEventListener('pointermove', e => { S.mouse = toLogical(e); });
cv.addEventListener('pointerleave', () => { S.mouse = null; });
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
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const dr = S.drops[i];
    if (Math.hypot(dr.x - x, dr.y - y) < 32) { collectStar(dr); S.drops.splice(i, 1); return; }
  }
  for (let i = S.tokens.length - 1; i >= 0; i--) {
    const tk = S.tokens[i];
    if (Math.hypot(tk.x - x, tk.y - y) < 30) {
      S.coffee += tk.val; S.got += tk.val;
      float(tk.x, tk.y - 14, '+' + tk.val, '#dcdcaa');
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
      if (S.lv.roof && col < 5) { float(x, y - 10, '旧缓存塌方，禁止施工', '#d1695c'); return; }
      if (key === 'pad') {
        if (water && !hasPad && c.cd <= 0 && S.coffee >= d.cost) {
          S.coffee -= d.cost; c.cd = c.cdMax; S.pads.add(row + ',' + col);
          AU.play('plant'); burst(cellX(col), cellY(row) + 14, 6, '#3f9e63', 90);
        }
        return;
      }
      if (water && !hasPad) { float(x, y - 10, '先放分支莲叶', '#d1695c'); return; }
      if (c.cd <= 0 && S.coffee >= d.cost) {
        S.coffee -= d.cost; c.cd = c.cdMax;
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
  if (S.lv.night) m = 3 * 60 + S.t * 0.6;
  else if (S.phase === 'day') m = 9 * 60 + (S.t / NIGHT_T) * 600;
  else m = 19 * 60 + Math.min(S.t - NIGHT_T, 140) / 140 * 180;
  m = Math.floor(m) % (24 * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
const THEME = {
  day:     { a: '#212121', b: '#272727', bar: '#1e1e1e' },
  offline: { a: '#181c26', b: '#1d2230', bar: '#151820' },
  pool:    { a: '#20242a', b: '#262b31', bar: '#1c1f24' },
  fog:     { a: '#1f2426', b: '#252b2e', bar: '#1a1f21' },
  server:  { a: '#15222b', b: '#1a2a35', bar: '#101a21' },
  roof:    { a: '#262021', b: '#2b2426', bar: '#1d1718' },
  boss:    { a: '#231c1e', b: '#2b2225', bar: '#1c1416' },
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
  ctx.fillText(clockStr() + (S.phase === 'night' ? (S.lv.night ? ' · 离线' : ' · 加班') : ''), W - 16, 24);

  ctx.fillStyle = '#252526'; ctx.fillRect(0, HUD_Y, W, HUD_H);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HUD_Y + HUD_H); ctx.lineTo(W, HUD_Y + HUD_H); ctx.stroke();

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
  if (S.lv.roof) drawRoof(ctx, t);
  if (S.lv.pool) drawWater(ctx, t, LAWN_Y + CELL_H, CELL_H * 2);
  if (t % 1 < 0.55 && S.running) { ctx.fillStyle = '#7ed957'; ctx.fillRect(LAWN_X + 6, LAWN_Y + (Math.floor(t / 2) % ROWS) * CELL_H + 10, 2, 16); }

  if (S.lv.pool) for (const k of S.pads) {
    const [r, c] = k.split(',').map(Number);
    drawPad(ctx, cellX(c), cellY(r), t);
  }

  // Ctrl+Z 键帽（含 ×2 角标）
  for (let r = 0; r < ROWS; r++) {
    const n = S.undos[r], y = cellY(r);
    ctx.save(); ctx.globalAlpha = n > 0 ? 1 : 0.28;
    ctx.fillStyle = '#2d2d30'; ctx.strokeStyle = n > 0 ? '#4ec9b0' : '#555'; ctx.lineWidth = 2;
    rr(ctx, 88, y - 11, 22, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = n > 0 ? '#4ec9b0' : '#666'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('↺', 99, y + 5);
    if (n > 1) { ctx.fillStyle = '#4ec9b0'; ctx.font = 'bold 9px monospace'; ctx.fillText('×' + n, 112, y - 4); }
    if (n <= 0) { ctx.strokeStyle = '#666'; ctx.beginPath(); ctx.moveTo(90, y + 10); ctx.lineTo(108, y - 8); ctx.stroke(); }
    ctx.restore();
  }

  const g = ctx.createLinearGradient(LAWN_R, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = g; ctx.fillRect(LAWN_R, LAWN_Y, W - LAWN_R, ROWS * CELL_H);
  ctx.fillStyle = '#333'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  rr(ctx, 1216, 330, 52, 26, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7ed957'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('M$', 1242, 347);
  ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(1242, 356); ctx.lineTo(1242, 380); ctx.stroke();

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

  for (const b of S.beams) {
    ctx.strokeStyle = 'rgba(191,232,255,' + (b.life / 0.18) * 0.9 + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y); ctx.lineTo(b.x2, b.y); ctx.stroke();
  }

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

  // 抛物线 BUG 单
  for (const a of S.arcs) {
    const k = Math.min(a.t / a.dur, 1);
    const ax = a.x0 + (a.x1 - a.x0) * k;
    const ay = a.y0 - 150 * 4 * k * (1 - k) * 0.55;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(k * 7);
    ctx.fillStyle = '#e8e8e8'; ctx.strokeStyle = '#a33'; ctx.lineWidth = 2;
    rr(ctx, -8, -10, 16, 20, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d1695c'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', 0, 4);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(ax, cellY(a.row) + 26, 10, 4, 0, 0, 7); ctx.fill();
  }

  for (const z of [...S.zombies].sort((a, b) => a.row - b.row)) {
    if (inFog(z)) continue; // 祖传迷雾：看不见就不画
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
      ctx.save(); ctx.translate(0, -58); ctx.rotate(t * 6);
      ctx.strokeStyle = '#dcdcaa'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0.5, 5.5); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  if (S.lv.fog) drawFog(ctx, t);

  for (const f of S.flashes) {
    ctx.fillStyle = 'rgba(' + (f.col || '0,120,215') + ',' + (f.life / (f.max || 0.6) * 0.5) + ')';
    ctx.fillRect(LAWN_X, LAWN_Y + f.row * CELL_H, COLS * CELL_W, CELL_H);
  }

  for (const tk of S.tokens) {
    ctx.save(); ctx.translate(tk.x, tk.y);
    if (tk.life < 2 && t % 0.4 < 0.15) ctx.globalAlpha = 0.3;
    const sc = tk.born < 0.3 ? 0.6 + tk.born * 1.3 : 1 + 0.05 * Math.sin(t * 4);
    ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(220,220,170,.7)'; ctx.shadowBlur = 12;
    drawCup(ctx, 0, 0, 1.4);
    ctx.restore();
  }
  for (const dr of S.drops) {
    ctx.save(); ctx.translate(dr.x, dr.y);
    if (dr.life < 2 && t % 0.4 < 0.15) ctx.globalAlpha = 0.3;
    drawStar(ctx, 0, 0, 1.3 + 0.08 * Math.sin(t * 5 + dr.x), true);
    ctx.fillStyle = '#ffe28a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('×' + dr.val, 0, 24);
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

  drawCup(ctx, 34, HUD_Y + 31, 1.5);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(S.coffee), 58, HUD_Y + 38);
  drawStar(ctx, 132, HUD_Y + 30, 0.85, false);
  ctx.fillStyle = '#ffe28a'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(SAVE.stars), 148, HUD_Y + 36);
  if (!TOUCH) {
    for (let i = 0; i < S.cards.length; i++) drawCard(i);
    drawShovel();
  }
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
  ctx.fillText('第 ' + S.lv.label + ' 关 · ' + S.lv.name + ' · ' + S.lv.world, 16, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText('击杀 ' + S.kills, W - 16, H - 8);

  const b = bannerAt(t);
  if (b && S.running) {
    const k = (t - b[0]) / 3;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 300, W, 110);
    ctx.fillStyle = b[3]; ctx.font = '900 42px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(b[1], W / 2, 352); ctx.fillText(b[1], W / 2, 352);
    ctx.fillStyle = '#c8c8c8'; ctx.font = '15px monospace'; ctx.fillText(b[2], W / 2, 386);
    ctx.globalAlpha = 1;
  }

  // 悬停反馈
  if (S.running && !S.paused && !S.over && S.mouse) {
    const { x: mx, y: my } = S.mouse;
    if (my > LAWN_Y && my < LAWN_Y + ROWS * CELL_H && mx >= LAWN_X && mx < LAWN_R && (S.sel !== null || S.shovel)) {
      const col = Math.floor((mx - LAWN_X) / CELL_W), row = Math.floor((my - LAWN_Y) / CELL_H);
      const occ = plantAt(row, col);
      let ok;
      if (S.shovel) ok = !!occ;
      else {
        const key = S.cards[S.sel].key, d = PLANTS[key], water = isPool(row), hp = S.pads.has(row + ',' + col);
        ok = !occ && !(S.lv.roof && col < 5) && (key === 'pad' ? (water && !hp) : (!water || hp)) && S.cards[S.sel].cd <= 0 && S.coffee >= d.cost;
      }
      const rgb = S.shovel ? '220,220,170' : ok ? '126,217,87' : '209,105,92';
      ctx.strokeStyle = 'rgba(' + rgb + ',.9)'; ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(' + rgb + ',.12)';
      rr(ctx, LAWN_X + col * CELL_W + 3, LAWN_Y + row * CELL_H + 3, CELL_W - 6, CELL_H - 6, 8);
      ctx.fill(); ctx.stroke();
      if (!S.shovel && !occ && ok) {
        ctx.save(); ctx.globalAlpha = 0.5;
        ctx.translate(cellX(col), cellY(row)); ctx.scale(0.9, 0.9);
        ART.p[S.cards[S.sel].key](ctx, t, { seed: 3, fireT: 0, armT: 8, armed: true, fuse: 1 });
        ctx.restore();
      }
    }
    let tip = null;
    if (my >= HUD_Y && my <= HUD_Y + HUD_H) {
      for (let i = 0; i < S.cards.length; i++) {
        const cx0 = cardX(i);
        if (mx >= cx0 && mx <= cx0 + CARD_W) { const d = PLANTS[S.cards[i].key]; tip = { name: d.name, line: d.cost + ' 咖啡 · 冷却 ' + Math.round(d.cd * 10) / 10 + 's', lore: d.fx, ax: cx0 + CARD_W / 2 }; }
      }
      const sx = cardX(S.cards.length);
      if (mx >= sx && mx <= sx + CARD_W) tip = { name: 'git revert', line: '铲子 · X', lore: '移除一个单位，返还一半咖啡', ax: sx + CARD_W / 2 };
    }
    if (tip) {
      const tw = 252, thh = 44;
      const tx = Math.min(Math.max(tip.ax - tw / 2, 6), W - tw - 6);
      ctx.fillStyle = 'rgba(15,15,15,.95)'; ctx.strokeStyle = '#4ec9b0'; ctx.lineWidth = 1.5;
      rr(ctx, tx, HUD_Y + HUD_H + 6, tw, thh, 6); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#dcdcaa'; ctx.font = 'bold 12px monospace'; ctx.fillText(tip.name, tx + 12, HUD_Y + HUD_H + 23);
      const nw = ctx.measureText(tip.name).width;
      ctx.fillStyle = '#8a8a8a'; ctx.font = '10px monospace'; ctx.fillText(tip.line, tx + 12 + nw + 10, HUD_Y + HUD_H + 23);
      ctx.fillStyle = '#9d9d9d'; ctx.font = '10px monospace'; ctx.fillText(tip.lore, tx + 12, HUD_Y + HUD_H + 40);
    }
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
      ctx.arc(x + CARD_W / 2, y + 26, 44, -Math.PI / 2, -Math.PI / 2 + (c.cd / c.cdMax) * Math.PI * 2);
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

/* ---------- 界面与存档 ---------- */
const $ = id => document.getElementById(id);
const OVERLAYS = ['ovStart', 'ovLevels', 'ovPicker', 'ovShop', 'ovGarden', 'ovBook', 'ovPause', 'ovEnd'];
function hideAll() {
  OVERLAYS.forEach(id => $(id).classList.add('hidden'));
  if (typeof gardenTimer !== 'undefined' && gardenTimer) { clearInterval(gardenTimer); gardenTimer = null; }
  if (typeof dockEl !== 'undefined' && TOUCH) dockEl.classList.add('hidden');
}

/* ---------- 移动端：底部卡片 dock ---------- */
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const dockEl = $('dock');
function buildDock() {
  if (!TOUCH) return;
  dockEl.classList.remove('hidden');
  dockEl.innerHTML = '';
  S.cards.forEach((c, i) => {
    const d = PLANTS[c.key];
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.appendChild(iconCanvas((g, t) => ART.p[c.key](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1 }), 0.5, 44));
    b.insertAdjacentHTML('beforeend', '<span class="dk-cost">' + d.cost + '</span><span class="dk-cd"></span>');
    b.onclick = () => { selectCard(i); syncDockSel(); };
    dockEl.appendChild(b);
  });
  const sh = document.createElement('button');
  sh.type = 'button'; sh.className = 'dk-shovel'; sh.textContent = '';
  sh.insertAdjacentHTML('beforeend', '<span class="dk-cost">revert</span>');
  sh.onclick = () => { S.shovel = !S.shovel; S.sel = null; AU.play('click'); syncDockSel(); };
  dockEl.appendChild(sh);
  syncDockSel();
}
function syncDockSel() {
  if (!TOUCH) return;
  dockEl.querySelectorAll('button').forEach((b, i) => {
    if (b.classList.contains('dk-shovel')) { b.classList.toggle('on', S.shovel); return; }
    b.classList.toggle('on', S.sel === i);
    b.classList.toggle('poor', S.coffee < PLANTS[S.cards[i].key].cost);
  });
}
let dockTick = 0;
function tickDock(dt) {
  if (!TOUCH || !S.running) return;
  dockTick += dt;
  if (dockTick < 0.2) return;
  dockTick = 0;
  syncDockSel();
  dockEl.querySelectorAll('button').forEach((b, i) => {
    if (b.classList.contains('dk-shovel')) return;
    const c = S.cards[i], bar = b.querySelector('.dk-cd');
    if (bar) bar.style.height = (c.cd > 0 ? Math.min(1, c.cd / c.cdMax) * 100 : 0) + '%';
  });
}
if (TOUCH) {
  addEventListener('resize', () => document.body.classList.toggle('portrait', innerHeight > innerWidth));
  document.body.classList.toggle('portrait', innerHeight > innerWidth);
}
function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function showEnd(kind) {
  if (!$('ovEnd').classList.contains('hidden')) return;
  const win = kind === 'win';
  $('endKicker').textContent = win ? 'BUILD SUCCESS' : 'BUILD FAILED';
  $('endKicker').style.color = win ? '#7ed957' : '#d1695c';
  $('endTitle').textContent = win ? '第 ' + S.lv.label + ' 关「' + S.lv.name + '」通过' : '你的电脑被装满了全家桶';
  $('endTerm').innerHTML = win
    ? '<span class="ok">&gt; build finished in ' + S.t.toFixed(1) + 's</span>\n<span class="ok">&gt; 0 errors, 0 warnings</span>\n<span class="dim">&gt; [OK] 编辑器 守住了</span>\n<span class="dim">&gt; [OK] 发际线 守住了</span>'
    : '<span class="bad">&gt; 正在安装全家桶… 100%</span>\n<span class="dim">&gt; [OK] Clippy 已恢复为默认助手</span>\n<span class="dim">&gt; [OK] Edge 已设为默认浏览器</span>\n<span class="dim">&gt; [OK] 开机启动项 +7</span>\n<span class="bad">&gt; [ERR] 你的代码 未保存</span>';
  $('endStats').textContent = '用时 ' + fmtTime(S.t) + ' · 击杀 ' + S.kills + ' · 咖啡 ' + S.got + ' · 本局 ★+' + S.starGot;
  const next = win && S.lv.id < LEVELS.length;
  $('btnNext').style.display = next ? '' : 'none';
  $('ovEnd').classList.remove('hidden');
}

/* 选关 */
function openLevels() {
  hideAll();
  S.running = false;
  buildLevelCards();
  $('ovLevels').classList.remove('hidden');
}
function buildLevelCards() {
  const wrap = $('lvGrid'); wrap.innerHTML = '';
  for (const ch of CHAPTERS) {
    const row = document.createElement('div');
    row.className = 'ch-row';
    row.innerHTML = '<div class="ch-head"><div class="ch-name">第' + '一二三四五'[ch.n - 1] + '章 · ' + ch.name + '</div>' +
      '<div class="ch-file">' + ch.file + ' — ' + ch.scene + '</div></div>';
    const nodes = document.createElement('div');
    nodes.className = 'ch-nodes';
    for (const lv of LEVELS.filter(l => l.ch === ch.n)) {
      const lock = lv.id > SAVE.unlocked;
      const done = lv.id < SAVE.unlocked;
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'nd' + (lock ? ' locked' : '') + (done ? ' done' : '');
      d.innerHTML = '<div class="nd-n">' + (lock ? '&#128274;' : lv.label) + '</div>' +
        '<div class="nd-name">' + lv.name + '</div>' +
        (done ? '<div class="nd-star">★</div>' : '');
      if (!lock) d.onclick = () => { AU.ensure(); openPicker(lv); };
      nodes.appendChild(d);
    }
    row.appendChild(nodes);
    wrap.appendChild(row);
  }
}

/* 选卡（部署前） */
let pickLv = null, pickSel = [];
function openPicker(lv) {
  hideAll();
  pickLv = lv;
  const slots = lv.slots + (has('slot') ? 1 : 0);
  const saved = (SAVE.decks[lv.id] || []).filter(k => lv.cards.includes(k) && cardUsable(k));
  pickSel = saved.length === saved.length && saved.length ? saved.slice(0, slots) : autoDeck(lv);
  renderPicker(slots);
  $('ovPicker').classList.remove('hidden');
}
function renderPicker(slots) {
  slots = slots ?? pickLv.slots + (has('slot') ? 1 : 0);
  $('pkTitle').textContent = '第 ' + pickLv.label + ' 关「' + pickLv.name + '」— ' + pickLv.world;
  const briefEl = $('pkBrief');
  if (briefEl) briefEl.textContent = pickLv.brief || '';
  $('pkCount').textContent = pickSel.length + ' / ' + slots;
  const wrap = $('pkGrid'); wrap.innerHTML = '';
  for (const k of pickLv.cards) {
    const d = PLANTS[k];
    const usable = cardUsable(k);
    const noRoof = pickLv.roof && NO_ROOF.includes(k);
    const sel = pickSel.includes(k);
    const cnt = pickSel.filter(x => x === k).length;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pk-card' + (sel ? ' sel' : '') + (!usable || noRoof ? ' dis' : '');
    el.appendChild(iconCanvas((g, t) => ART.p[k](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1 }), 0.5, 46));
    let tag = d.cost + ' 咖啡';
    if (!usable) tag = 'npm 商店解锁';
    else if (noRoof) tag = '被 CORS 弹开';
    el.insertAdjacentHTML('beforeend', '<div class="nm">' + d.name + (cnt > 1 ? ' ×' + cnt : '') + '</div><div class="cost">' + tag + '</div>');
    if (usable && !noRoof) el.onclick = () => {
      if (sel) pickSel.splice(pickSel.indexOf(k), 1);
      else if (pickSel.length < slots) pickSel.push(k);
      else { $('pkCount').style.color = '#d1695c'; setTimeout(() => $('pkCount').style.color = '', 400); }
      AU.play('click'); renderPicker(slots);
    };
    wrap.appendChild(el);
  }
}
$('pkAuto').onclick = () => { pickSel = autoDeck(pickLv); AU.play('click'); renderPicker(); };
$('pkGo').onclick = () => {
  if (!pickSel.length) return;
  SAVE.decks[pickLv.id] = pickSel.slice(); saveNow();
  startLevel(pickLv, pickSel);
};
$('pkBack').onclick = openLevels;

/* npm 商店 */
function openShop() {
  hideAll();
  S.running = false;
  renderShop();
  $('ovShop').classList.remove('hidden');
}
function renderShop() {
  $('shopStars').textContent = '★ ' + SAVE.stars;
  const wrap = $('shopList'); wrap.innerHTML = '';
  for (const it of SHOP) {
    const owned = has(it.id);
    const row = document.createElement('div');
    row.className = 'shop-row' + (owned ? ' owned' : '');
    row.innerHTML = '<div class="sp-pkg">' + it.pkg + '</div><div class="sp-desc">' + it.desc + '</div>';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost sp-buy';
    btn.textContent = owned ? '已安装' : '★ ' + it.cost;
    if (!owned && SAVE.stars >= it.cost) {
      btn.classList.add('buyable');
      btn.onclick = () => { SAVE.stars -= it.cost; SAVE.upg[it.id] = true; saveNow(); AU.play('buy'); renderShop(); buildRoster(); };
    }
    row.appendChild(btn);
    wrap.appendChild(row);
  }
}
$('btnShop').onclick = () => { AU.ensure(); openShop(); };
$('btnShopBack').onclick = () => { hideAll(); $('ovStart').classList.remove('hidden'); buildRoster(); };

/* 副业花园 */
let gardenTimer = null;
function openGarden() {
  hideAll();
  S.running = false;
  renderGarden();
  gardenTimer = setInterval(renderGarden, 2000);
  $('ovGarden').classList.remove('hidden');
}
function closeGarden() {
  if (gardenTimer) { clearInterval(gardenTimer); gardenTimer = null; }
  hideAll(); $('ovStart').classList.remove('hidden');
}
function renderGarden() {
  $('garStars').textContent = '★ ' + SAVE.stars;
  const wrap = $('garGrid'); wrap.innerHTML = '';
  const now = Date.now();
  SAVE.garden.forEach((g, i) => {
    const cell = document.createElement('div');
    cell.className = 'plot' + (g ? '' : ' empty');
    if (!g) {
      cell.innerHTML = '<div class="plot-add">npm init</div>';
      for (const key of ['side', 'ossl']) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn ghost plot-btn';
        b.textContent = GARDEN[key].name + ' ★' + GARDEN[key].seed;
        b.disabled = SAVE.stars < GARDEN[key].seed;
        b.onclick = () => {
          SAVE.stars -= GARDEN[key].seed;
          SAVE.garden[i] = { kind: key, stage: 0, nextAt: now + WATER_CD };
          saveNow(); AU.play('plant'); renderGarden();
        };
        cell.appendChild(b);
      }
    } else {
      const def = GARDEN[g.kind];
      const done = g.stage >= def.water;
      const cn = document.createElement('canvas');
      cn.width = 96; cn.height = 96;
      const gc = cn.getContext('2d');
      gc.setTransform(2, 0, 0, 2, 48, 64);
      drawGardenPot(gc, g.kind === 'ossl' ? 'ossl' : 'side', g.stage, Date.now() / 1000);
      cell.appendChild(cn);
      cell.insertAdjacentHTML('beforeend', '<div class="plot-name">' + def.name + ' ' + Math.min(g.stage, def.water) + '/' + def.water + '</div>');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost plot-btn';
      if (done) {
        b.textContent = 'Release ★+' + def.harvest;
        b.classList.add('buyable');
        b.onclick = () => { SAVE.stars += def.harvest; SAVE.garden[i] = null; saveNow(); AU.play('star'); renderGarden(); };
      } else {
        const left = Math.max(0, Math.ceil((g.nextAt - now) / 1000));
        b.textContent = left > 0 ? 'git commit (' + left + 's)' : 'git commit';
        b.disabled = left > 0;
        b.onclick = () => { g.stage++; g.nextAt = Date.now() + WATER_CD; saveNow(); AU.play('click'); renderGarden(); };
      }
      cell.appendChild(b);
    }
    wrap.appendChild(cell);
  });
}
$('btnGarden').onclick = () => { AU.ensure(); openGarden(); };
$('btnGardenBack').onclick = closeGarden;

/* 暂停/结算按钮 */
function showStart() {
  hideAll();
  if (S) S.running = false;
  const cur = LEVELS.find(l => l.id === SAVE.unlocked) || LEVELS[LEVELS.length - 1];
  $('saveLine').textContent = '进度：第 ' + cur.label + ' 关「' + cur.name + '」 · ★ ' + SAVE.stars + ' · 已装 ' + Object.keys(SAVE.upg).length + ' 个包';
  $('btnStart').textContent = SAVE.unlocked > 1 ? '继续战役' : '开始战役';
  if (TOUCH) dockEl.classList.add('hidden');
  $('ovStart').classList.remove('hidden');
}
function openBook() {
  hideAll();
  buildRoster();
  $('ovBook').classList.remove('hidden');
}
function bookTab(side) {
  $('bookYou').classList.toggle('hidden', side !== 'you');
  $('bookFoe').classList.toggle('hidden', side !== 'foe');
  $('tabYou').classList.toggle('on', side === 'you');
  $('tabFoe').classList.toggle('on', side === 'foe');
}
$('btnStart').onclick = () => { AU.ensure(); openLevels(); };
$('btnShop').onclick = () => { AU.ensure(); openShop(); };
$('btnGarden').onclick = () => { AU.ensure(); openGarden(); };
$('btnBook').onclick = () => { AU.ensure(); openBook(); };
$('tabYou').onclick = () => bookTab('you');
$('tabFoe').onclick = () => bookTab('foe');
$('btnLevelsBack').onclick = showStart;
$('btnShopBack').onclick = showStart;
$('btnGardenBack').onclick = showStart;
$('btnBookBack').onclick = showStart;
$('btnResume').onclick = togglePause;
$('btnRestart1').onclick = () => startLevel(S.lv, S.cards.map(c => c.key));
$('btnLevels1').onclick = openLevels;
$('btnLevels2').onclick = openLevels;
$('btnAgain').onclick = () => startLevel(S.lv, S.cards.map(c => c.key));
$('btnNext').onclick = () => openPicker(LEVELS.find(l => l.id === S.lv.id + 1));
showStart();

/* ---------- 首页图鉴（含解锁状态） ---------- */
function iconCanvas(drawFn, sc, oy) {
  const c = document.createElement('canvas');
  c.width = 92; c.height = 92;
  const g = c.getContext('2d');
  g.setTransform(2 * sc, 0, 0, 2 * sc, 46, oy);
  drawFn(g, 0.6, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1, hp: 999, maxHp: 999 });
  return c;
}
function cardUnlockLevel(k) {
  const lv = LEVELS.find(l => l.cards.includes(k));
  return lv ? lv.id : null;
}
const Z_ICON = { clippy: [0.62, 62], ie: [0.62, 62], edge: [0.62, 62], update: [0.56, 64], bsod: [0.52, 66], garg: [0.32, 54], telemetry: [0.6, 62], teams: [0.58, 62], popup: [0.8, 52], balloon: [0.5, 40], dotnet: [0.5, 62] };
function buildRoster() {
  const you = $('rosterYou'); you.innerHTML = '';
  for (const k of ALL_CARDS) {
    const d = PLANTS[k];
    const unlockLv = cardUnlockLevel(k);
    const owned = k === 'bug' ? has('bug') : (unlockLv !== null && unlockLv <= SAVE.unlocked);
    const div = document.createElement('div');
    div.className = 'unit' + (owned ? '' : ' locked');
    div.appendChild(iconCanvas((g, t) => ART.p[k](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1 }), 0.62, 52));
    let badge = owned ? '可用' : (k === 'bug' ? 'npm ★45' : '第' + (LEVELS.find(l => l.cards.includes(k)) || { ch: '?' }).ch + '章解锁');
    div.insertAdjacentHTML('beforeend',
      '<div class="nm">' + d.name + '</div><div class="fx">' + d.fx + '</div><div class="cost">' + d.cost + ' 咖啡 · ' + badge + '</div>');
    you.appendChild(div);
  }
  const foe = $('rosterFoe'); foe.innerHTML = '';
  const Z_ICON = { clippy: [0.62, 62], ie: [0.62, 62], edge: [0.62, 62], update: [0.56, 64], bsod: [0.52, 66], garg: [0.32, 54], telemetry: [0.6, 62], teams: [0.58, 62], popup: [0.8, 52], balloon: [0.5, 40], dotnet: [0.5, 62] };
  for (const k of Object.keys(ZOMBIES)) {
    const d = ZOMBIES[k];
    const seen = LEVELS.filter(l => l.waves.some(w => w[2] === k)).map(l => l.id).join('·');
    const met = LEVELS.some(l => l.id <= SAVE.unlocked && l.waves.some(w => w[2] === k));
    const div = document.createElement('div');
    div.className = 'unit' + (met ? '' : ' locked');
    div.appendChild(iconCanvas((g, t) => ART.z[k](g, t, { seed: 1, hp: 999, maxHp: 999 }), Z_ICON[k][0], Z_ICON[k][1]));
    div.insertAdjacentHTML('beforeend',
      '<div class="nm">' + d.name + '</div><div class="fx">' + d.fx + '</div><div class="cost">' + (met ? '出场: ' + seen : '未遭遇') + '</div>');
    foe.appendChild(div);
  }
}
buildRoster();

/* ---------- 主循环 ---------- */
let last = 0;
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  if (S.running && !S.paused && !S.over) update(dt);
  else if (S.over) { if (S.overT > 0) S.overT -= dt; if (S.overT <= 0) showEnd(S.over); }
  tickDock(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(ts => { last = ts; requestAnimationFrame(frame); });

/* ---------- 调试钩子 ---------- */
window.__mvc = {
  state: () => S,
  save: () => SAVE,
  tap: handleTap,
  give: n => { S.coffee += n; },
  spawn: (ty, row) => spawnZombie(ty, row ?? (Math.random() * ROWS) | 0),
  to: tt => { S.t = tt; },
  end: kind => { S.over = kind; S.overT = 0.01; },
  start: (n, deck) => { AU.ensure(); startLevel(LEVELS[(n || S.lv.id) - 1], deck); },
  pick: (n, deck) => { AU.ensure(); startLevel(LEVELS[n - 1], deck); },
  buy: id => { const it = SHOP.find(s => s.id === id); if (it && (SAVE.stars >= it.cost || SAVE.stars === -1)) { SAVE.stars -= it.cost; SAVE.upg[id] = true; saveNow(); } },
  setStars: n => { SAVE.stars = n; saveNow(); },
  unlockAll: () => { SAVE.unlocked = LEVELS.length; saveNow(); },
  reset: openLevels,
};
})();
