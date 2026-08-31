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
  if (!['auto', 'light', 'dark', 'midnight'].includes(SAVE.mode)) SAVE.mode = 'auto';
}
function saveNow() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
loadSave();
const has = id => !!SAVE.upg[id];
function unlockTo(n) { SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(n, LEVELS.length)); saveNow(); }
/* 卡是否可用：关卡池 + 商店解锁（GATED_CARDS 里的必须先装包） */
const GATED_CARDS = ['bug', 'rebase', 'cors'];
function cardUsable(k) { return !GATED_CARDS.includes(k) || has(k); }
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
  const take = k => {
    if (!pool.includes(k) || deck.length >= slots) return false;
    if (lv.roof && NO_ROOF.includes(k)) return false; // 自动布阵无法保证与万能头同行，别带废卡
    deck.push(k); return true;
  };
  take('coffee'); take('coffee');
  if (lv.pool) { take('pad'); take('pad'); }
  if (lv.night) take('cron');
  if (lv.fog) take('sourcemap');
  if (lv.roof) { take('bug'); take('bug'); take('bug'); } else take('log');
  while (deck.length < Math.min(slots, lv.pool ? 6 : 5)) { if (!(take('log') || take('duck') || take('ssh') || take('bp'))) break; }
  while (deck.length < slots) { if (!(take('keyboard') || take('firewall') || take('monitor') || take('stack') || take('rmrf') || take('rebase') || take('bug') || take('coffee') || take('log') || take('duck'))) break; }
  return deck.slice(0, slots);
}
let endShown = false;
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
  endShown = false;
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
    cycles: 0, pokeT: 0, showRing: key === 'sourcemap' ? 1 : 0, noBite: key === 'rebase',
  });
}
function spawnZombie(type, row) {
  const d = ZOMBIES[type];
  const z = {
    type, row, x: W + 30 + Math.random() * 30, y0: cellY(row), hp: d.hp, maxHp: d.hp,
    seed: Math.random() * 7, slow: 0, flash: 0, abT: 6, idle: 0, idleT: 5 + Math.random() * 4,
    fly: type === 'balloon', land: false, dying: false, reviveT: 0, compat: false,
    armor: d.armor || 0, shieldHit: 0, marked: 0,
    dig: type === 'invite', surfX: cellX(2 + ((Math.random() * 3) | 0)),
    jumped: false, hop: 0, throwT: 0,
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
function damageZombie(z, dmg) { z.hp -= z.marked > 0 ? dmg * 1.25 : dmg; z.flash = 0.12; }

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
    for (const p of S.plants) if (['log', 'keyboard', 'firewall', 'monitor', 'bug', 'ssh'].includes(p.key) && Math.abs(p.row - st.row) <= 1 && Math.abs(p.col - st.col) <= 1) buffed.add(p);

  /* 万能头：只有它所在的那一行拿到同源豁免 */
  const corsRows = new Set();
  if (S.lv.roof) for (const p of S.plants) if (p.key === 'cors') corsRows.add(p.row);

  for (const p of S.plants) {
    p.biteT = Math.max(0, p.biteT - dt); p.fireT = Math.max(0, p.fireT - dt);
    if (p.stun > 0) { p.stun -= dt; continue; }
    if (p.key === 'coffee') {
      p.prodT -= dt;
      if (p.prodT <= 0) { p.prodT = 15; addToken(p.x + 26, p.y - 6, false, has('coffeexl') ? 40 : 30); AU.play('ding'); }
    } else if (['log', 'keyboard', 'firewall'].includes(p.key)) {
      if (S.lv.roof && !corsRows.has(p.row)) continue; // 直线请求被同源策略弹开，除非本行有万能头
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      const rate = (p.key === 'keyboard' ? 0.7 : 1.4) * boost;
      const target = S.zombies.some(z => z.row === p.row && !z.dying && !z.dig && z.x > p.x + 10 && z.x < W + 40);
      if (target && p.rateT <= 0) {
        p.rateT = rate; p.fireT = 0.15;
        S.shots.push({ x: p.x + 30, y: p.y - 8, row: p.row, kind: p.key, dmg: p.key === 'log' ? 25 : 20, ch: 'QWERTASDFG'[(Math.random() * 10) | 0] });
        AU.play('shoot');
      }
    } else if (p.key === 'bug') {
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      if (p.rateT <= 0) {
        const tgt = S.zombies.filter(z => z.row === p.row && !z.dying && !z.dig && z.x > p.x + 10 && z.x < W + 20).sort((a, b) => a.x - b.x)[0];
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
        const tgt = S.zombies.filter(z => z.row === p.row && !z.dying && !z.dig && z.x > p.x + 10).sort((a, b) => a.x - b.x)[0];
        if (tgt) {
          p.rateT = 4 * boost; p.fireT = 0.25;
          damageZombie(tgt, has('calib') ? 180 : 120);
          S.beams.push({ x1: p.x + 26, x2: tgt.x, y: p.y - 10, life: 0.18 });
          AU.play('beam');
        }
      }
    } else if (p.key === 'cron') {
      p.prodT -= dt;
      if (p.prodT <= 0) {
        p.prodT = 20;
        addToken(p.x + 24, p.y - 6, false, Math.min(15 + p.cycles * 10, 45));
        p.cycles++; AU.play('ding');
      }
    } else if (p.key === 'ssh') {
      const boost = buffed.has(p) ? 0.7 : 1;
      p.rateT -= dt;
      const rows = [p.row - 1, p.row, p.row + 1].filter(r => r >= 0 && r < ROWS);
      if (p.rateT <= 0 && S.zombies.some(z => !z.dying && !z.dig && rows.includes(z.row) && z.x > p.x + 10 && z.x < W + 40)) {
        p.rateT = 1.6 * boost; p.fireT = 0.2;
        for (const r of rows) S.shots.push({ x: p.x + 30, y: cellY(r) - 8, row: r, kind: 'ssh', dmg: 18 });
        AU.play('shoot');
      }
    } else if (p.key === 'rebase') {
      p.pokeT = Math.max(0, p.pokeT - dt);
      for (const z of S.zombies) {
        if (z.dying || z.fly || z.dig || Math.abs(z.x - p.x) > 34) continue;
        z.hp -= 90 * dt * (z.marked > 0 ? 1.25 : 1);
        z.flash = Math.max(z.flash, 0.06); p.pokeT = 0.2;
        if (z.type === 'garg') p.hp = 0; // Boss 直接把它碾平
      }
    } else if (p.key === 'sourcemap') {
      for (const z of S.zombies) {
        if (z.dying) continue;
        if (Math.hypot(z.x - p.x, (z.row - p.row) * CELL_H) < REVEAL_R) z.marked = 0.2;
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
    const z = S.zombies.find(z => z.row === s.row && Math.abs(z.x - s.x) < 26 && z.hp > 0 && !z.dying && !z.dig);
    if (z) {
      if (z.armor > 0) {
        z.armor = Math.max(0, z.armor - s.dmg); z.shieldHit = 0.22; z.flash = Math.max(z.flash, 0.06);
        if (z.armor === 0) float(z.x, cellY(z.row) - 62, '防护已绕过', '#4ec9b0');
      } else {
        damageZombie(z, s.dmg);
        if (s.kind === 'firewall' && !ZOMBIES[z.type].noSlow) z.slow = 3;
      }
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
      for (const z of S.zombies) if (z.row === a.row && !z.dying && !z.dig && Math.abs(z.x - a.x1) < 70) damageZombie(z, a.dmg);
    }
  }
  S.arcs = S.arcs.filter(a => !a.dead);
  for (const b of S.beams) b.life -= dt;
  S.beams = S.beams.filter(b => b.life > 0);

  // 僵尸
  for (const z of S.zombies) {
    z.flash = Math.max(0, z.flash - dt); z.slow = Math.max(0, z.slow - dt);
    z.marked = Math.max(0, z.marked - dt); z.shieldHit = Math.max(0, z.shieldHit - dt);
    z.hop = Math.max(0, z.hop - dt); z.throwT = Math.max(0, z.throwT - dt);
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
    if (z.type === 'invite' && z.dig) {
      z.x -= d.speed * dt;
      if (z.x <= z.surfX) {
        z.dig = false;
        z.row = (z.row + 1 + ((Math.random() * (ROWS - 1)) | 0)) % ROWS;
        z.y0 = cellY(z.row);
        burst(z.x, cellY(z.row) + 12, 12, '#7a5a38', 150);
        AU.play('revive'); float(z.x, cellY(z.row) - 58, '已接受 · 换行', '#b48ee0');
      }
      continue;
    }
    if (z.type === 'store') {
      z.abT -= dt;
      if (z.abT <= 0) {
        z.abT = 9;
        if (S.zombies.filter(p => p.type === 'popup').length < 8) {
          z.throwT = 0.55;
          const im = spawnZombie('popup', z.row); im.x = z.x - 26;
          AU.play('ping'); float(z.x, cellY(z.row) - 56, '已为你安装', '#b48ee0');
        }
      }
    }
    const speed = d.speed * (z.slow > 0 && !d.noSlow ? 0.5 : 1) * (z.speedBuff || 1) * (z.type === 'garg' && z.hp < z.maxHp * 0.5 ? 1.25 : 1);
    if (!z.fly) {
      const meal = S.plants.find(p => p.row === z.row && p.hp > 0 && !p.noBite && z.x - p.x > -6 && z.x - p.x < 34);
      if (meal && z.type === 'copilot' && !z.jumped) {
        z.jumped = true; z.hop = 0.5; z.x = meal.x - 44;
        AU.play('stun'); float(meal.x, cellY(z.row) - 62, 'Tab ↹ 已补全', '#8f94d8');
      } else if (meal) {
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
cv.addEventListener('pointermove', e => { if (!carry) S.mouse = toLogical(e); });
cv.addEventListener('pointerleave', () => { S.mouse = null; });
function cardX(i) { return CARD_X0 + i * (CARD_W + CARD_GAP); }
function onLawn(x, y) { return x >= LAWN_X && x < LAWN_R && y >= LAWN_Y && y < LAWN_Y + ROWS * CELL_H; }
function hudCardAt(x, y) {
  if (y < HUD_Y || y > HUD_Y + HUD_H) return null;
  for (let i = 0; i < S.cards.length; i++) if (x >= cardX(i) && x <= cardX(i) + CARD_W) return i;
  return null;
}
/* 手持：按住卡牌拖到草坪松手放一个；一次手势只结算一次 */
let carry = null;
function startCarry(i, e) {
  if (i === null || !S.running || S.paused || S.over) return;
  S.sel = i; S.shovel = false; AU.play('click');
  carry = { i, x0: e.clientX, y0: e.clientY, moved: false };
  syncDockSel();
}
function endCarry(e) {
  const c = carry; carry = null;
  const p = toLogical(e); S.mouse = p;
  if (onLawn(p.x, p.y)) { const before = S.sel; handleTap(p.x, p.y); if (S.sel === before) S.sel = null; }
  else if (c.moved || Math.hypot(e.clientX - c.x0, e.clientY - c.y0) > 14) S.sel = null;
  syncDockSel();
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e); S.mouse = p;
  const i = hudCardAt(p.x, p.y);
  if (i !== null) { startCarry(i, e); return; }
  handleTap(p.x, p.y);
});
addEventListener('pointermove', e => {
  if (!carry) return;
  S.mouse = toLogical(e);
  if (Math.hypot(e.clientX - carry.x0, e.clientY - carry.y0) > 14) carry.moved = true;
});
addEventListener('pointerup', e => { if (carry) endCarry(e); });
addEventListener('pointercancel', () => { carry = null; S.sel = null; syncDockSel(); });
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
        S.shovel = false; syncDockSel();
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
          S.sel = null; syncDockSel();
          AU.play('plant'); burst(cellX(col), cellY(row) + 14, 6, '#3f9e63', 90);
        }
        return;
      }
      if (water && !hasPad) { float(x, y - 10, '先放分支莲叶', '#d1695c'); return; }
      if (c.cd <= 0 && S.coffee >= d.cost) {
        S.coffee -= d.cost; c.cd = c.cdMax;
        addPlant(key, row, col);
        S.sel = null; syncDockSel();
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
  if (e.key === 'Escape' && !$('ovBook').classList.contains('hidden') && !$('bookDetail').classList.contains('hidden')) { closeDossier(); return; }
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
/* ---------- 外观三档：浅色 / 深色 / 午夜 —— 对应 PvZ 的白天 / 黄昏 / 深夜 ----------
   草坪是「被点亮的编辑器」，外壳（标题栏 / HUD / 状态栏）随模式拉开明暗差 */
const PALETTE = {
  light: {
    a: '#eef1e2', b: '#e3e8d5', bar: '#f7f6f1',
    titleBar: '#e3dfd4', titleInk: '#4d4a42', clockInk: '#6d7a5c', clockNight: '#b3341f',
    hud: '#f4f1e9', hudRule: '#d8d3c6', rowNum: '#a8a294', caret: '#3f9e3f',
    ink: '#2b2a26', dim: '#8d8679', amber: '#8a6100', red: '#b3341f', teal: '#0b7285', star: '#9a6b06',
    keycap: '#fbfaf5', undoOn: '#0b7285', undoOff: '#b8b2a5',
    vig0: 'rgba(90,80,55,0)', vig1: 'rgba(90,80,55,.26)',
    msBox: '#e6e2d7', msEdge: '#b8b2a4', msInk: '#2f6d3a',
    monBody: '#e0dcd1', monScreen: '#fbfdf7', monLine: '#9ec2a6', monCaret: '#2f7a44',
    shadow: 'rgba(90,80,50,.20)', stunInk: '#8a6100',
    tipBg: 'rgba(252,250,244,.97)', tipEdge: '#0b7285', tipName: '#8a6100', tipDim: '#8d8679', tipLore: '#5f5b52',
    track: '#ddd8cb', trackFill: '#4e9e4e',
    status: '#e3dfd4', statusInk: '#6b665c',
    bannerBg: 'rgba(38,36,32,.84)', bannerSub: '#e6e2d8',
    card: '#fbf6e6', cardEdge: '#cfc6ac', cardSel: '#b9861c', cardDim: 'rgba(150,140,110,.46)',
    cardPie: 'rgba(120,112,90,.5)', costOk: '#0b6e4f', costNo: '#b3341f', cardNum: '#a89f88', revertInk: '#4f7a3a',
    water: '#a9cfe4', waterLine: 'rgba(255,255,255,.5)', waterTint: 'rgba(255,255,255,.10)',
    fog0: 'rgba(120,132,140,0)', fog1: 'rgba(126,138,146,.55)', fog2: 'rgba(120,132,142,.80)',
    fogBlob: 'rgba(255,255,255,.13)', fogTodo: 'rgba(38,48,42,.5)',
    veil: 'rgba(120,110,70,.14)', mood: 'rgba(255,240,200,.05)', bossBg: 'rgba(40,38,34,.55)',
  },
  dark: {
    a: '#212121', b: '#272727', bar: '#1e1e1e',
    titleBar: '#2d2d2d', titleInk: '#9d9d9d', clockInk: '#8a8a8a', clockNight: '#d1695c',
    hud: '#252526', hudRule: '#333333', rowNum: '#4a4a4a', caret: '#7ed957',
    ink: '#e8e8e8', dim: '#8a8a8a', amber: '#dcdcaa', red: '#d1695c', teal: '#4ec9b0', star: '#ffe28a',
    keycap: '#2d2d30', undoOn: '#4ec9b0', undoOff: '#555555',
    vig0: 'rgba(0,0,0,0)', vig1: 'rgba(0,0,0,.55)',
    msBox: '#333333', msEdge: '#555555', msInk: '#7ed957',
    monBody: '#2a2a2a', monScreen: '#10241a', monLine: '#3f6f4f', monCaret: '#7ed957',
    shadow: 'rgba(0,0,0,.30)', stunInk: '#dcdcaa',
    tipBg: 'rgba(15,15,15,.95)', tipEdge: '#4ec9b0', tipName: '#dcdcaa', tipDim: '#8a8a8a', tipLore: '#9d9d9d',
    track: '#333333', trackFill: '#7ed957',
    status: '#161616', statusInk: '#5a5a5a',
    bannerBg: 'rgba(0,0,0,.55)', bannerSub: '#c8c8c8',
    card: '#2d2d2d', cardEdge: '#3c3c3c', cardSel: '#dcdcaa', cardDim: 'rgba(20,20,20,.55)',
    cardPie: 'rgba(10,10,10,.75)', costOk: '#dcdcaa', costNo: '#d1695c', cardNum: '#6f6f6f', revertInk: '#6a9955',
    water: '#0e2c40', waterLine: 'rgba(80,170,220,.16)', waterTint: 'rgba(120,200,255,.05)',
    fog0: 'rgba(150,160,170,0)', fog1: 'rgba(150,160,170,.5)', fog2: 'rgba(140,150,160,.72)',
    fogBlob: 'rgba(200,210,220,.14)', fogTodo: 'rgba(220,220,170,.3)',
    veil: 'rgba(8,12,38,.2)', mood: 'rgba(0,0,0,0)', bossBg: 'rgba(0,0,0,.5)',
  },
  midnight: {
    a: '#1a2130', b: '#202a3c', bar: '#05070c',
    titleBar: '#0a0d15', titleInk: '#6f7d95', clockInk: '#5d6b83', clockNight: '#e06a5a',
    hud: '#0c1220', hudRule: '#1b2130', rowNum: '#333f55', caret: '#8ef07a',
    ink: '#cfdcec', dim: '#6b7789', amber: '#e8cd72', red: '#e06a5a', teal: '#5fded0', star: '#ffe28a',
    keycap: '#141c2b', undoOn: '#5fded0', undoOff: '#2b3644',
    vig0: 'rgba(0,0,10,0)', vig1: 'rgba(0,0,10,.78)',
    msBox: '#121a26', msEdge: '#2b3644', msInk: '#8ef07a',
    monBody: '#0d1017', monScreen: '#04261a', monLine: '#2f7a55', monCaret: '#8ef07a',
    shadow: 'rgba(0,0,0,.5)', stunInk: '#e8cd72',
    tipBg: 'rgba(4,6,12,.97)', tipEdge: '#5fded0', tipName: '#e8cd72', tipDim: '#6b7789', tipLore: '#8b97ab',
    track: '#1b2130', trackFill: '#5fded0',
    status: '#03050a', statusInk: '#3f4b5e',
    bannerBg: 'rgba(0,2,10,.72)', bannerSub: '#b9c6d8',
    card: '#182238', cardEdge: '#33455f', cardSel: '#e8cd72', cardDim: 'rgba(2,6,14,.42)',
    cardPie: 'rgba(0,4,14,.55)', costOk: '#e8cd72', costNo: '#e06a5a', cardNum: '#4b5566', revertInk: '#6ab05c',
    water: '#062034', waterLine: 'rgba(70,190,240,.22)', waterTint: 'rgba(90,200,255,.07)',
    fog0: 'rgba(20,30,52,0)', fog1: 'rgba(22,32,56,.6)', fog2: 'rgba(10,16,30,.88)',
    fogBlob: 'rgba(150,180,225,.12)', fogTodo: 'rgba(150,170,210,.34)',
    veil: 'rgba(6,10,30,.34)', mood: 'rgba(20,60,140,.07)', bossBg: 'rgba(0,0,6,.62)',
  },
};
const MODES = ['light', 'dark', 'midnight'];
const MODE_NAME = { light: '浅色模式', dark: '深色模式', midnight: '午夜模式' };
const pal = () => PALETTE[activeMode()] || PALETTE.dark;
/* 当前生效模式：手动锁定优先，否则跟随正在进行的关卡（菜单用续关那一档） */
function activeMode() {
  if (SAVE.mode && SAVE.mode !== 'auto' && PALETTE[SAVE.mode]) return SAVE.mode;
  if (S && S.running && S.lv.mode) return S.lv.mode;
  const lv = LEVELS[Math.min(Math.max(SAVE.unlocked, 1), LEVELS.length) - 1];
  return lv && lv.mode ? lv.mode : 'dark';
}
let domMode = null, domLabel = '';
function syncModeDom() {
  const m = activeMode();
  const label = '外观：' + (SAVE.mode === 'auto' ? '自动 · ' + MODE_NAME[m] : MODE_NAME[m]);
  if (m === domMode && label === domLabel) return;
  domMode = m; domLabel = label;
  document.body.dataset.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.textContent = label);
}
function cycleMode() {
  const opts = ['auto'].concat(MODES);
  SAVE.mode = opts[(opts.indexOf(SAVE.mode) + 1) % opts.length];
  saveNow(); AU.play('click');
  domMode = null; syncModeDom();
}

function draw() {
  const t = S.t, th = pal();
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * S.shake, (Math.random() - 0.5) * 8 * S.shake);

  ctx.fillStyle = th.bar; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = th.titleBar; ctx.fillRect(-10, -10, W + 10, TITLE_H + 10);
  ['#d1695c', '#dcdcaa', '#7ed957'].forEach((col, i) => { ctx.fillStyle = col; circ(ctx, 22 + i * 20, 20, 5); ctx.fill(); });
  ctx.fillStyle = th.titleInk; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(S.lv.file + ' — 微软大战代码 · ' + MODE_NAME[activeMode()] + ' · VS Code (parody)', W / 2, 24);
  ctx.textAlign = 'right'; ctx.fillStyle = S.phase === 'night' ? th.clockNight : th.clockInk;
  ctx.fillText(clockStr() + (S.phase === 'night' ? (S.lv.night ? ' · 离线' : ' · 加班') : ''), W - 16, 24);

  ctx.fillStyle = th.hud; ctx.fillRect(0, HUD_Y, W, HUD_H);
  ctx.strokeStyle = th.hudRule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HUD_Y + HUD_H); ctx.lineTo(W, HUD_Y + HUD_H); ctx.stroke();

  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = r % 2 ? th.a : th.b;
    ctx.fillRect(LAWN_X, LAWN_Y + r * CELL_H, COLS * CELL_W, CELL_H);
    ctx.fillStyle = th.rowNum; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(r + 1), LAWN_X - 12, LAWN_Y + r * CELL_H + 20);
  }
  if (S.lv.roof) drawRoof(ctx, t);
  if (S.lv.pool) drawWater(ctx, t, LAWN_Y + CELL_H, CELL_H * 2, th);
  if (t % 1 < 0.55 && S.running) { ctx.fillStyle = th.caret; ctx.fillRect(LAWN_X + 6, LAWN_Y + (Math.floor(t / 2) % ROWS) * CELL_H + 10, 2, 16); }

  if (S.lv.pool) for (const k of S.pads) {
    const [r, c] = k.split(',').map(Number);
    drawPad(ctx, cellX(c), cellY(r), t);
  }

  // Ctrl+Z 键帽（含 ×2 角标）
  for (let r = 0; r < ROWS; r++) {
    const n = S.undos[r], y = cellY(r);
    ctx.save(); ctx.globalAlpha = n > 0 ? 1 : 0.28;
    ctx.fillStyle = th.keycap; ctx.strokeStyle = n > 0 ? th.undoOn : th.undoOff; ctx.lineWidth = 2;
    rr(ctx, 88, y - 11, 22, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = n > 0 ? th.undoOn : th.undoOff; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('↺', 99, y + 5);
    if (n > 1) { ctx.fillStyle = th.undoOn; ctx.font = 'bold 9px monospace'; ctx.fillText('×' + n, 112, y - 4); }
    if (n <= 0) { ctx.strokeStyle = th.undoOff; ctx.beginPath(); ctx.moveTo(90, y + 10); ctx.lineTo(108, y - 8); ctx.stroke(); }
    ctx.restore();
  }

  const g = ctx.createLinearGradient(LAWN_R, 0, W, 0);
  g.addColorStop(0, th.vig0); g.addColorStop(1, th.vig1);
  ctx.fillStyle = g; ctx.fillRect(LAWN_R, LAWN_Y, W - LAWN_R, ROWS * CELL_H);
  ctx.fillStyle = th.msBox; ctx.strokeStyle = th.msEdge; ctx.lineWidth = 2;
  rr(ctx, 1216, 330, 52, 26, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = th.msInk; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('M$', 1242, 347);
  ctx.strokeStyle = th.msEdge; ctx.beginPath(); ctx.moveTo(1242, 356); ctx.lineTo(1242, 380); ctx.stroke();

  ctx.fillStyle = th.monBody; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  rr(ctx, 14, 320, 76, 56, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = S.over === 'lose' ? '#0078d7' : th.monScreen;
  rr(ctx, 20, 326, 64, 44, 3); ctx.fill();
  if (S.over === 'lose') { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(':(', 52, 352); }
  else {
    ctx.fillStyle = th.monLine; ctx.fillRect(26, 334, 30, 3); ctx.fillRect(26, 342, 40, 3); ctx.fillRect(26, 350, 24, 3);
    ctx.fillStyle = th.monCaret; ctx.fillRect(26, 358, 6, 3);
  }
  ctx.fillStyle = th.monBody; ctx.fillRect(46, 376, 12, 10); ctx.fillRect(34, 386, 36, 6);

  for (const p of [...S.plants].sort((a, b) => a.row - b.row)) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(t * 1.2 + p.seed) * 0.02);
    const q = p.biteT > 0 ? 0.08 : 0;
    ctx.scale(1 + q, 1 - q);
    ctx.fillStyle = th.shadow; ctx.beginPath(); ctx.ellipse(0, 40, 26, 7, 0, 0, 7); ctx.fill();
    ART.p[p.key](ctx, t, p);
    if (buffGlow(p)) { ctx.strokeStyle = 'rgba(244,128,36,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 34, 24, 7, 0, 0, 7); ctx.stroke(); }
    if (p.stun > 0) {
      ctx.save(); ctx.translate(0, -52); ctx.rotate(t * 3);
      ctx.strokeStyle = th.caret; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0.4, 5.6); ctx.stroke();
      ctx.fillStyle = th.caret; ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(12, -2); ctx.lineTo(4, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = th.stunInk; ctx.font = '9px monospace'; ctx.textAlign = 'center';
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
    } else if (s.kind === 'ssh') {
      ctx.shadowColor = '#5fded0'; ctx.shadowBlur = 7;
      ctx.strokeStyle = '#5fded0'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (const dx of [-4, 2]) { ctx.beginPath(); ctx.moveTo(dx - 3, -6); ctx.lineTo(dx + 3, 0); ctx.lineTo(dx - 3, 6); ctx.stroke(); }
      ctx.lineCap = 'butt';
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
    ctx.fillStyle = th.shadow;
    ctx.beginPath(); ctx.ellipse(ax, cellY(a.row) + 26, 10, 4, 0, 0, 7); ctx.fill();
  }

  for (const z of [...S.zombies].sort((a, b) => a.row - b.row)) {
    if (inFog(z) && !z.marked) continue; // 祖传迷雾：看不见就不画（被溯源标记的除外）
    const flying = z.fly;
    let y = cellY(z.row);
    if (S.lv.pool && (z.row === 1 || z.row === 2) && !flying) y += 8;
    if (z.hop > 0) y -= Math.sin(Math.PI * (1 - z.hop / 0.5)) * 34;
    z.y0 = y;
    ctx.save(); ctx.translate(z.x, y);
    if (flying) ctx.translate(0, -36);
    if (z.dying) { ctx.globalAlpha = 0.45; ctx.rotate(-1.3); }
    else if (z.type === 'telemetry' && z.x > 700) ctx.globalAlpha = 0.3 + 0.08 * Math.sin(t * 5);
    if (!z.dig) { ctx.fillStyle = th.shadow; ctx.beginPath(); ctx.ellipse(0, flying ? 46 : 42, 24, 7, 0, 0, 7); ctx.fill(); }
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
    if (z.marked > 0 && !z.dig) {
      ctx.strokeStyle = 'rgba(95,222,208,' + Math.min(1, z.marked * 6) + ')'; ctx.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(sx * 30, sy * 44 - 12); ctx.lineTo(sx * 30, sy * 30 - 12); ctx.lineTo(sx * 20, sy * 30 - 12);
        ctx.stroke();
      }
    }
    if (z.type === 'defender' && z.armor > 0 && !z.dying) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, -18, -60, 36, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#35c1f1'; rr(ctx, -18, -60, 36 * (z.armor / ZOMBIES.defender.armor), 5, 2.5); ctx.fill();
    }
    ctx.restore();
  }

  if (S.lv.fog) {
    const maps = S.plants.filter(p => p.key === 'sourcemap');
    drawFog(ctx, t, th, maps.map(p => ({ x: p.x, y: p.y, r: REVEAL_R })));
    if (maps.length) {
      ctx.save();
      ctx.beginPath(); ctx.rect(LAWN_X, LAWN_Y, COLS * CELL_W, ROWS * CELL_H); ctx.clip();
      ctx.strokeStyle = 'rgba(95,222,208,.3)'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
      for (const p of maps) { ctx.beginPath(); ctx.arc(p.x, p.y, REVEAL_R, 0, 7); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

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
    ctx.fillStyle = th.star; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('×' + dr.val, 0, 24);
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

  if (S.phase === 'night') { ctx.fillStyle = th.veil; ctx.fillRect(0, LAWN_Y, W, ROWS * CELL_H); }
  ctx.fillStyle = th.mood; ctx.fillRect(0, LAWN_Y, W, ROWS * CELL_H);

  drawCup(ctx, 34, HUD_Y + 31, 1.5);
  ctx.fillStyle = th.ink; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(S.coffee), 58, HUD_Y + 38);
  drawStar(ctx, 132, HUD_Y + 30, 0.85, false);
  ctx.fillStyle = th.star; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(SAVE.stars), 148, HUD_Y + 36);
  if (!TOUCH) {
    for (let i = 0; i < S.cards.length; i++) drawCard(i);
    drawShovel();
  }
  const frac = S.spawned / Math.max(S.script.length, 1);
  ctx.fillStyle = th.track; rr(ctx, 960, HUD_Y + 27, 220, 9, 4); ctx.fill();
  ctx.fillStyle = th.trackFill; rr(ctx, 960, HUD_Y + 27, Math.max(6, 220 * frac), 9, 4); ctx.fill();
  ctx.fillStyle = th.dim; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText('波次', 954, HUD_Y + 35);
  ctx.strokeStyle = th.titleInk; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1206, HUD_Y + 22); ctx.lineTo(1206, HUD_Y + 40); ctx.moveTo(1215, HUD_Y + 22); ctx.lineTo(1215, HUD_Y + 40); ctx.stroke();
  ctx.fillStyle = th.titleInk;
  ctx.beginPath(); ctx.moveTo(1238, HUD_Y + 22); ctx.lineTo(1238, HUD_Y + 40); ctx.lineTo(1252, HUD_Y + 31); ctx.closePath(); ctx.fill();
  if (AU.muted) { ctx.strokeStyle = th.red; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(1254, HUD_Y + 24); ctx.lineTo(1262, HUD_Y + 38); ctx.stroke(); }

  const gargs = S.zombies.filter(z => z.type === 'garg');
  if (gargs.length) {
    ctx.fillStyle = th.bossBg; rr(ctx, W / 2 - 160, HUD_Y + HUD_H + 8, 320, 22, 5); ctx.fill();
    const tot = gargs.reduce((a, z) => a + z.hp, 0) / gargs.reduce((a, z) => a + z.maxHp, 0);
    ctx.fillStyle = th.red; rr(ctx, W / 2 - 156, HUD_Y + HUD_H + 12, 312 * tot, 14, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('强制更新.exe × ' + gargs.length, W / 2, HUD_Y + HUD_H + 23);
  }

  ctx.fillStyle = th.status; ctx.fillRect(0, LAWN_Y + ROWS * CELL_H, W, H - LAWN_Y - ROWS * CELL_H);
  ctx.fillStyle = th.statusInk; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('第 ' + S.lv.label + ' 关 · ' + S.lv.name + ' · ' + S.lv.world, 16, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText('击杀 ' + S.kills, W - 16, H - 8);

  const b = bannerAt(t);
  if (b && S.running) {
    const k = (t - b[0]) / 3;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = th.bannerBg; ctx.fillRect(0, 300, W, 110);
    ctx.fillStyle = b[3]; ctx.font = '900 42px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(b[1], W / 2, 352); ctx.fillText(b[1], W / 2, 352);
    ctx.fillStyle = th.bannerSub; ctx.font = '15px monospace'; ctx.fillText(b[2], W / 2, 386);
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
    } else if (carry && S.sel !== null) {
      ctx.save(); ctx.globalAlpha = .85;
      ctx.translate(mx, my - 20); ctx.scale(.86, .86);
      ART.p[S.cards[S.sel].key](ctx, t, { seed: 3, fireT: 0, armT: 8, armed: true, fuse: 1 });
      ctx.restore();
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
      ctx.fillStyle = th.tipBg; ctx.strokeStyle = th.tipEdge; ctx.lineWidth = 1.5;
      rr(ctx, tx, HUD_Y + HUD_H + 6, tw, thh, 6); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = th.tipName; ctx.font = 'bold 12px monospace'; ctx.fillText(tip.name, tx + 12, HUD_Y + HUD_H + 23);
      const nw = ctx.measureText(tip.name).width;
      ctx.fillStyle = th.tipDim; ctx.font = '10px monospace'; ctx.fillText(tip.line, tx + 12 + nw + 10, HUD_Y + HUD_H + 23);
      ctx.fillStyle = th.tipLore; ctx.font = '10px monospace'; ctx.fillText(tip.lore, tx + 12, HUD_Y + HUD_H + 40);
    }
  }
  ctx.restore();
}
function buffGlow(p) {
  return ['log', 'keyboard', 'firewall', 'monitor', 'bug', 'ssh'].includes(p.key) &&
    S.plants.some(st => st.key === 'stack' && Math.abs(st.row - p.row) <= 1 && Math.abs(st.col - p.col) <= 1);
}

function drawCard(i) {
  const th = pal();
  const key = S.cards[i].key, c = S.cards[i], d = PLANTS[key];
  const x = cardX(i), y = CARD_Y;
  const afford = S.coffee >= d.cost, ready = c.cd <= 0;
  ctx.fillStyle = th.card; ctx.strokeStyle = S.sel === i ? th.cardSel : th.cardEdge; ctx.lineWidth = S.sel === i ? 3 : 1.5;
  rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + 26);
  ctx.scale(0.46, 0.46);
  ART.p[key](ctx, S.t, { seed: i, fireT: 0, armT: 8, armed: true, fuse: 1 });
  ctx.restore();
  if (!afford || !ready) {
    ctx.save();
    rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.clip();
    ctx.fillStyle = th.cardDim; ctx.fillRect(x, y, CARD_W, CARD_H);
    if (!ready) {
      ctx.fillStyle = th.cardPie;
      ctx.beginPath(); ctx.moveTo(x + CARD_W / 2, y + 26);
      ctx.arc(x + CARD_W / 2, y + 26, 44, -Math.PI / 2, -Math.PI / 2 + (c.cd / c.cdMax) * Math.PI * 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  drawCup(ctx, x + 10, y + CARD_H - 9, 0.7);
  ctx.fillStyle = afford ? th.costOk : th.costNo; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(d.cost), x + 20, y + CARD_H - 5);
  ctx.fillStyle = th.cardNum; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(i + 1), x + CARD_W - 8, y + 11);
}
function drawShovel() {
  const th = pal();
  const x = cardX(S.cards.length), y = CARD_Y;
  ctx.fillStyle = th.card; ctx.strokeStyle = S.shovel ? th.cardSel : th.cardEdge; ctx.lineWidth = S.shovel ? 3 : 1.5;
  rr(ctx, x, y, CARD_W, CARD_H, 6); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x + CARD_W / 2, y + 24); ctx.rotate(-0.6);
  ctx.strokeStyle = '#b0895a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 6); ctx.stroke();
  ctx.fillStyle = '#9d9d9d'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, 6); ctx.lineTo(4, 18); ctx.lineTo(-4, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#b0895a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(5, -14); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = th.revertInk; ctx.font = '9px monospace'; ctx.textAlign = 'center';
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
    b.addEventListener('dragstart', ev => ev.preventDefault());
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); startCarry(i, ev); });
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
  if (endShown) return;
  endShown = true;
  S.running = false;
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
    const noRoof = pickLv.roof && NO_ROOF.includes(k) && !pickSel.includes('cors');
    const sel = pickSel.includes(k);
    const cnt = pickSel.filter(x => x === k).length;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pk-card' + (sel ? ' sel' : '') + (!usable || noRoof ? ' dis' : '');
    el.appendChild(iconCanvas((g, t) => ART.p[k](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1 }), 0.5, 46));
    let tag = d.cost + ' 咖啡';
    if (!usable) tag = 'npm 商店解锁';
    else if (noRoof) tag = '被 CORS 弹开';
    else if (pickLv.roof && NO_ROOF.includes(k)) tag = '需与万能头同行';
    el.insertAdjacentHTML('beforeend', '<div class="nm">' + d.name + (cnt > 1 ? ' ×' + cnt : '') + '</div><div class="cost">' + tag + '</div>');
    if (usable && !noRoof) el.onclick = () => {
      if (sel) {
        pickSel.splice(pickSel.indexOf(k), 1);
        if (k === 'cors' && pickLv.roof)
          for (let i = pickSel.length - 1; i >= 0; i--) if (NO_ROOF.includes(pickSel[i])) pickSel.splice(i, 1);
      }
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
function openBook(side) {
  hideAll();
  bookAnim = null;
  $('bookDetail').classList.add('hidden');
  $('bookDetail').innerHTML = '';
  $('bookList').classList.remove('hidden');
  bookTab(side || 'you');
  $('ovBook').classList.remove('hidden');
}
function bookTab(side) {
  $('rosterYou').classList.toggle('hidden', side !== 'you');
  $('rosterFoe').classList.toggle('hidden', side !== 'foe');
  $('tabYou').classList.toggle('on', side === 'you');
  $('tabFoe').classList.toggle('on', side === 'foe');
  if (!$('bookDetail').classList.contains('hidden')) closeDossier(); else buildRoster();
}
$('btnStart').onclick = () => { AU.ensure(); openLevels(); };
$('btnShop').onclick = () => { AU.ensure(); openShop(); };
$('btnGarden').onclick = () => { AU.ensure(); openGarden(); };
$('btnBook').onclick = () => { AU.ensure(); openBook(); };
document.querySelectorAll('.mode-btn').forEach(b => b.onclick = cycleMode);
$('tabYou').onclick = () => bookTab('you');
$('tabFoe').onclick = () => bookTab('foe');
$('btnLevelsBack').onclick = showStart;
$('btnShopBack').onclick = showStart;
$('btnGardenBack').onclick = showStart;
$('btnBookBack').onclick = () => { if (!$('bookDetail').classList.contains('hidden')) closeDossier(); else showStart(); };
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
const Z_ICON = { clippy: [0.62, 62], ie: [0.62, 62], edge: [0.62, 62], update: [0.56, 64], bsod: [0.52, 66], garg: [0.32, 54], telemetry: [0.6, 62], teams: [0.58, 62], popup: [0.8, 52], balloon: [0.5, 40], dotnet: [0.5, 62], defender: [0.58, 62], copilot: [0.6, 60], invite: [0.6, 62], hotfix: [0.56, 60], store: [0.6, 62] };
const GATE_PRICE = {}; for (const it of SHOP) GATE_PRICE[it.id] = it.cost;
/* 一侧的图鉴元数据：数值、状态、解锁/出场 */
function unitMeta(side, k) {
  const story = (STORIES[side] || {})[k] || '';
  if (side === 'you') {
    const d = PLANTS[k];
    const unlockLv = cardUnlockLevel(k);
    const first = unlockLv ? LEVELS.find(l => l.id === unlockLv) : null;
    const gated = GATED_CARDS.includes(k);
    const reached = unlockLv !== null && unlockLv <= SAVE.unlocked;
    const owned = !gated ? reached : (has(k) && reached);
    const notes = [];
    if (NO_ROOF.includes(k)) notes.push('「跨域高墙」一章里直线请求被同源策略弹开：单独部署不开火，除非牌组里有「万能头」并和它种在同一行。');
    if (k === 'pad') notes.push('只能铺在「冲突水道」的水面上，铺好之前那一格种不了任何东西。');
    if (k === 'bug') notes.push(owned ? '抛物线越过一切地形与高墙，是「跨域高墙」一章唯一的稳定输出。' : '需要先在 npm 商店用 ★' + (GATE_PRICE.bug || 45) + ' 安装 `bug-report` 才能携带。');
    if (k === 'cron') notes.push('夜关天上不掉咖啡，它是唯一不占咖啡机位子的产能：每完成一轮定时产量 +10，爬到 45/20s 封顶。');
    if (k === 'ssh') notes.push('一次往上中下三行各发一枚隧道包，全场唯一能同时压住三条路的直线输出；隧道不算同源请求，屋顶照打。');
    if (k === 'rebase') notes.push('它是地刺不是塔：敌人不会停下啃它，直接踩过去持续掉血；40 血的身板，强制更新.exe 一脚就碾平。');
    if (k === 'sourcemap') notes.push('半径 165px 内的敌人一律显形并额外吃 25% 伤害，迷雾关还会顺手吹开一团视野——把它种在雾线上。');
    if (k === 'cors') notes.push('自己不打人，只给所在那一行签发跨域豁免：console.log / 机械键盘 / 防火墙 必须和它同一行才开火。');
    if (k === 'stack') notes.push('加速范围是自身 3×3：console.log / 机械键盘 / 防火墙 / 4K 显示器 / BUG 报告 / SSH 隧道 都能吃到。');
    if (k === 'coffee') notes.push('断网场景天上不掉咖啡，全靠它；夜关开局送 300 咖啡，第一波之前尽量铺满三台。');
    return {
      side, key: k, name: d.name, tagline: d.lore, fx: d.fx, story, owned,
      role: '可部署单位',
      badge: owned ? '可携带' : (gated && !has(k) ? 'npm ★' + (GATE_PRICE[k] || 0) : '第 ' + (first ? first.ch : '?') + ' 章解锁'),
      stats: [['咖啡成本', d.cost], ['生命值', d.hp], ['冷却', d.cd + 's'], ['首次解锁', first ? '第 ' + first.ch + ' 章 · ' + first.name : '—']],
      notes, sc: 0.62, oy: 52,
      art: (g, t) => ART.p[k](g, t, { seed: 1, fireT: 0, armT: 8, armed: true, fuse: 1, hp: 999, maxHp: 999 }),
    };
  }
  const d = ZOMBIES[k];
  const lvs = LEVELS.filter(l => l.waves.some(w => w[2] === k));
  /* 小红点这类纯召唤兵不在剧本里，遭遇判定跟着它的召唤者走 */
  const SUMMONED = { popup: ['teams', 'store'] };
  const met = lvs.some(l => l.id <= SAVE.unlocked) ||
    (SUMMONED[k] || []).some(s => LEVELS.some(l => l.id <= SAVE.unlocked && l.waves.some(w => w[2] === s)));
  const notes = [];
  if (k === 'update') notes.push('强制重启会把你那一行的一个单位打出 4s 停摆——包括后排的咖啡机。');
  if (k === 'bsod') notes.push('倒下瞬间瘫掉整行 3s，所以补位要等它咽气之后。');
  if (k === 'teams') notes.push('每 10s 召唤一只小红点，场上上限 8 只；优先点掉发通知的那个。');
  if (k === 'balloon') notes.push('飞行期间无视肉墙，被打爆后落地，速度降到 66%。');
  if (k === 'dotnet') notes.push('首次倒下会以兼容模式复活一次（380 血），要杀两遍。');
  if (k === 'garg') notes.push('半血后移速 +25%，啃咬 600 dps：任何单位都撑不过一秒，留给 rm -rf 或 Ctrl+Z。');
  if (k === 'telemetry') notes.push('在画面右端只画 30% 不透明度，靠近才显形——纯障眼法，子弹并不会绕开它。');
  if (k === 'edge') notes.push('移速 46 是全场最快，等看见它再补塔通常已经来不及。');
  if (k === 'defender') notes.push('380 点护盾只吸收直线伤害，console.log 打它等于挠痒；BUG 报告的抛物线与 4K 显示器光束直接绕过护盾。');
  if (k === 'copilot') notes.push('第一次碰到你的单位会按 Tab 越过去，肉盾拦不住它；跳完之后就是普通 340 血。');
  if (k === 'invite') notes.push('地下潜行期间免疫子弹、抛物线和光束，只吃爆炸（断点续跑 / rm -rf）；出土时随机换一行，专治按行布防。');
  if (k === 'hotfix') notes.push('移速 52 且免疫减速，防火墙拦不住；能拖住它的只剩 rebase 地刺和 Ctrl+Z，别无脑堆 coffee。');
  if (k === 'store') notes.push('每 9s 从购物袋抛一只小红点，场上上限 8 只；它走得慢血厚，最怕和 Teams 通知同屏叠加。');
  const stats = [['生命值', d.hp], ['移速', d.speed + ' px/s'], ['啃咬', d.dps + ' dps'], ['★ 掉落', d.star[0] + '★ / ' + Math.round(d.star[1] * 100) + '%']];
  if (d.armor) stats.splice(1, 0, ['护盾', d.armor + '（仅吸收直线）']);
  if (d.noSlow) stats.push(['减速抗性', '免疫']);
  return {
    side, key: k, name: d.name, tagline: d.lore, fx: d.fx, story, owned: met,
    role: '敌方单位',
    badge: met ? '已遭遇' : '未遭遇',
    stats,
    notes, sc: Z_ICON[k][0], oy: Z_ICON[k][1],
    art: (g, t) => ART.z[k](g, t, { seed: 1, hp: 999, maxHp: 999 }),
    appear: lvs.map(l => l.label).join(' · '),
  };
}
function buildRoster() {
  const sides = { you: ['rosterYou', ALL_CARDS], foe: ['rosterFoe', Object.keys(ZOMBIES)] };
  let ownedYou = 0, ownedFoe = 0;
  for (const side of ['you', 'foe']) {
    const wrap = $(sides[side][0]); wrap.innerHTML = '';
    for (const k of sides[side][1]) {
      const m = unitMeta(side, k);
      if (m.owned) { if (side === 'you') ownedYou++; else ownedFoe++; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'unit' + (m.owned ? '' : ' locked') + (side === 'foe' ? ' foe' : '');
      b.dataset.side = side; b.dataset.k = k;
      b.appendChild(unitIcon(m, 52));
      b.insertAdjacentHTML('beforeend',
        '<span class="nm">' + m.name + '</span><span class="fx">' + m.fx + '</span>' +
        '<span class="cost">' + m.badge + '</span>');
      b.onclick = () => { AU.play('click'); openDossier(side, k); };
      wrap.appendChild(b);
    }
  }
  $('tbYouN').textContent = ownedYou + '/' + ALL_CARDS.length;
  $('tbFoeN').textContent = ownedFoe + '/' + Object.keys(ZOMBIES).length;
  const cur = $('tabFoe').classList.contains('on') ? 'foe' : 'you';
  $('bookMeta').textContent = cur === 'you'
    ? '你手上的单位：' + ownedYou + ' 个可携带。点任意一格查看功能与档案。'
    : '微软方已遭遇 ' + ownedFoe + ' / ' + Object.keys(ZOMBIES).length + ' 种。点任意一格查看弱点与档案。';
}
/* 图鉴图标：同一套矢量美术，按 size 等比放大 */
function unitIcon(m, cssPx) {
  const size = Math.round(cssPx * 2);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const f = size / 92;
  const g = c.getContext('2d');
  g.setTransform(2 * m.sc * f, 0, 0, 2 * m.sc * f, size / 2, m.oy * f);
  m.art(g, 0.6);
  return c;
}
/* ---------- 档案详情页 ---------- */
let bookAnim = null;
function openDossier(side, k) {
  const m = unitMeta(side, k);
  $('bookList').classList.add('hidden');
  $('bookMeta').textContent = m.side === 'you' ? '代码方档案 · ' + m.name : '微软方档案 · ' + m.name;
  const rows = m.owned ? m.stats.map(s => '<tr><th>' + s[0] + '</th><td>' + s[1] + '</td></tr>').join('')
    : '<tr><th>数据</th><td>尚未记录 —— ' + m.badge + '</td></tr>';
  const chips = [];
  if (m.appear) chips.push('出场关卡 ' + m.appear);
  if (side === 'you') chips.push('部署方式：长按卡牌拖到草坪松手');
  $('bookDetail').innerHTML =
    '<div class="cd-top">' +
      '<div class="cd-art-box' + (m.owned ? '' : ' locked') + '"><canvas id="cdArt" width="300" height="300"></canvas>' +
        '<div class="cd-role ' + side + '">' + m.role + '</div></div>' +
      '<div class="cd-head">' +
        '<h3 class="cd-name">' + m.name + '</h3>' +
        '<div class="cd-tagline">' + m.tagline + '</div>' +
        '<table class="cd-stats">' + rows + '</table>' +
        '<div class="cd-chips">' + chips.map(c => '<span>' + c + '</span>').join('') + '</div>' +
      '</div>' +
    '</div>' +
    (m.owned ? '<div class="cd-sec">功能</div><p class="cd-body">' + m.fx + '。' + (m.notes.join('')) + '</p>' :
               '<div class="cd-sec">功能</div><p class="cd-body dim">遭遇或解锁之后，这里会自动补全「' + m.name + '」的实测数据。</p>') +
    '<div class="cd-sec">背景故事</div>' +
    (m.owned ? '<p class="cd-body story">' + m.story + '</p>' : '<p class="cd-body dim">档案待补。</p>') +
    '<div class="actions" style="justify-content:flex-start;margin-top:16px">' +
      '<button class="btn ghost" id="btnCdBack" type="button">← 返回图鉴</button>' +
    '</div>';
  $('btnCdBack').onclick = () => { AU.play('click'); closeDossier(); };
  $('bookDetail').classList.remove('hidden');
  const cv2 = $('cdArt'), g = cv2.getContext('2d'), f = 300 / 92;
  bookAnim = t => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 300, 300);
    g.setTransform(1.56 * m.sc * f, 0, 0, 1.56 * m.sc * f, 150, (m.oy - 4) * f);
    m.art(g, t);
  };
  bookAnim(clock);
}
function closeDossier() {
  bookAnim = null;
  $('bookDetail').classList.add('hidden');
  $('bookDetail').innerHTML = '';
  $('bookList').classList.remove('hidden');
  buildRoster();
}
buildRoster();


/* ---------- 主循环 ---------- */
let last = 0;
let clock = 0;
function frame(ts) {
  const dt = Math.min((ts - last) / 1000, 0.05);
  last = ts; clock += dt;
  if (S.running && !S.paused && !S.over) update(dt);
  else if (S.over) { if (S.overT > 0) S.overT -= dt; if (S.overT <= 0) showEnd(S.over); }
  tickDock(dt);
  if (bookAnim) bookAnim(clock);
  syncModeDom();
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
