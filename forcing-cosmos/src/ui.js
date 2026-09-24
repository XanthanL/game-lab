'use strict';
/* ============================================================
 * UI 层：canvas 战场绘制 + DOM 卡片/弹窗
 * ============================================================ */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
// 运行时错误可视化（同时供自动化探针读取）
window.addEventListener('error', e => {
  const box = $('errlog'); if (!box) return;
  box.classList.remove('hidden');
  box.textContent = 'ERR: ' + (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno;
});
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

/* ---------------- 战场坐标 ---------------- */
const LAY = {
  px: 132, pyBase: 214,      // 玩家：中心 x，底边 y
  ex: 470, eyBase: 208,      // 敌人：中心 x，底边 y
  barW: 168, barH: 10,
  pBarX: 44, eBarX: 372, barY: 74,
  nameY: 58, intentY: 38, markY: 26,
};

/* ---------------- 特效池 ---------------- */
const FX = { parts: [], floats: [], rings: [], shake: 0, shakeT: 0, flash: 0, flashCol: '#e04060', beam: null };

function addParts(x, y, n, col, opt = {}) {
  const sp = opt.speed || 150, life = opt.life || 460;
  for (let i = 0; i < n; i++) {
    const a = opt.dir != null ? opt.dir + (Math.random() - 0.5) * (opt.spread || 1.2) : Math.random() * Math.PI * 2;
    FX.parts.push({ x, y, vx: Math.cos(a) * sp * (0.4 + Math.random()), vy: Math.sin(a) * sp * (0.4 + Math.random()) - (opt.up || 0), life, max: life, col, sz: opt.sz || 2, g: opt.g || 90 });
  }
}
function addFloat(x, y, text, col, big) {
  FX.floats.push({ x, y, text, col: col || '#f4f4f4', life: 900, max: 900, big: !!big });
}
function addRing(x, y, col, r0, r1, life) { FX.rings.push({ x, y, col, r0, r1: r1 || 40, life: life || 320, max: life || 320 }); }
function shake(amp, ms) { FX.shake = amp; FX.shakeT = ms || 260; FX.shakeMax = ms || 260; }
function flash(col, a) { FX.flash = a == null ? 0.28 : a; FX.flashCol = col; }
function beamFx(x0, y0, x1, y1, col) { FX.beam = { x0, y0, x1, y1, col, life: 220, max: 220 }; }

function stepFx(dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life -= dt; if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
    p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += p.g * dt / 1000;
  }
  for (let i = FX.floats.length - 1; i >= 0; i--) {
    const f = FX.floats[i]; f.life -= dt; if (f.life <= 0) FX.floats.splice(i, 1); else f.y -= dt * 0.035;
  }
  for (let i = FX.rings.length - 1; i >= 0; i--) { FX.rings[i].life -= dt; if (FX.rings[i].life <= 0) FX.rings.splice(i, 1); }
  if (FX.shakeT > 0) FX.shakeT -= dt;
  if (FX.flash > 0) FX.flash = Math.max(0, FX.flash - dt / 260);
  if (FX.beam) { FX.beam.life -= dt; if (FX.beam.life <= 0) FX.beam = null; }
}

/* ---------------- 基础绘制工具 ---------------- */
function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
function frame(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}
function text(str, x, y, col, align = 'left', size = 12) {
  ctx.font = size + 'px FP, monospace'; ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillStyle = '#05060d'; ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = col; ctx.fillText(str, x, y);
}
function bar(x, y, w, h, cur, max, col, shield, shieldMax) {
  px(x - 1, y - 1, w + 2, h + 2, '#05060d');
  px(x, y, w, h, '#29366f');
  const r = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
  px(x, y, Math.round(w * r), h, col);
  if (shield > 0) {
    const sr = Math.max(0, Math.min(1, shield / (shieldMax || max)));
    px(x, y + h - 2, Math.round(w * sr), 2, '#73eff7');
  }
  text(cur + '/' + max, x + w / 2, y + 1, '#f4f4f4', 'center');
}
function icon(name, x, y, set, alpha) {
  const s = SPR[set];
  if (!s) return;
  const f = s.r[0];
  if (alpha != null) { const p = ctx.globalAlpha; ctx.globalAlpha = p * alpha; ctx.drawImage(f, x, y); ctx.globalAlpha = p; }
  else ctx.drawImage(f, x, y);
}

/* ---------------- 状态图标行 ---------------- */
function statusRow(e, x, y) {
  let cx = x;
  for (const k in STATUS_INFO) {
    const n = e.getStatus(k); if (!n) continue;
    const info = STATUS_INFO[k];
    px(cx, y, 14, 14, '#0e1022'); frame(cx, y, 14, 14, info.col);
    icon(info.icon, cx + 1, y + 1, 's_' + info.icon);
    text(n, cx + 13, y + 10, '#ffffff', 'right', 12);
    cx += 16;
  }
}
/* ---------------- 意图 ---------------- */
const INTENT_COL = { attack: '#e04060', defend: '#41a6f6', charge: '#c070f0', charged: '#ffcd75' };
const INTENT_GLYPH = { attack: '▲', defend: '■', charge: '◇', charged: '★' };
function intentBox(e, x, y) {
  const it = e.getIntent(); if (!it) return;
  const col = INTENT_COL[it.type] || '#566c86';
  const label = it.type === 'defend' ? '防御 ' + it.value
    : it.type === 'charge' ? '蓄能 ' + it.left + '/' + e.chargeTurns
      : it.type === 'charged' ? '致命 ' + it.value
        : it.value + ' 伤害';
  const w = 12 + label.length * 6;
  px(x - w / 2 - 2, y - 2, w + 4, 16, '#05060dcc');
  frame(x - w / 2 - 2, y - 2, w + 4, 16, col);
  // 图标：三角/方块/菱/星（用像素直接画）
  ctx.fillStyle = col;
  const gx = x - w / 2 + 4, gy = y + 2;
  if (it.type === 'attack' || it.type === 'charged') { for (let i = 0; i < 5; i++) ctx.fillRect(gx + 2 - i * 0.5 | 0, gy + i, i + 1, 1); }
  else if (it.type === 'defend') { ctx.fillRect(gx, gy, 5, 5); }
  else { for (let i = 0; i < 5; i++) ctx.fillRect(gx + Math.abs(i - 2), gy + i, 5 - Math.abs(i - 2) * 2, 1); }
  text(label, x - w / 2 + 12, y + 1, col);
}

/* ---------------- 实体绘制 ---------------- */
function drawEntity(e, cx, baseY, t, isPlayer) {
  const s = SPR[e.sprite]; if (!s) return;
  const fi = (t / 380 | 0) % s.r.length;
  let f = isPlayer ? s.r[fi] : s.l[fi];
  const w = s.w, h = s.h;
  const x = Math.round(cx - w / 2), y = Math.round(baseY - h);
  // 影子
  ctx.globalAlpha = 0.32; ctx.fillStyle = '#05060d';
  ctx.beginPath(); ctx.ellipse(cx, baseY + 2, w * 0.42, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  // 蓄力呼吸
  let alpha = 1;
  if (!isPlayer && e.getIntent && e.getIntent().type === 'charged') alpha = 0.6 + Math.sin(t / 120) * 0.4;
  if (e.hitFlash > 0) { drawGlow(ctx, '#ffffff', w * 0.6, e.hitFlash / 160, cx, baseY - h / 2); }
  ctx.globalAlpha = alpha;
  ctx.drawImage(e.hitFlash > 0 ? (s.wr[fi] || f) : f, x, y);
  ctx.globalAlpha = 1;
  if (e.shield > 0) {
    drawGlow(ctx, '#41a6f6', w * 0.62, 0.22 + Math.sin(t / 260) * 0.06, cx, baseY - h / 2);
  }
  // Boss 蓄能描边
  if (!isPlayer && e.boss && e.getIntent && e.getIntent().type === 'charged') {
    frame(x - 3, y - 3, w + 6, h + 6, '#e04060');
  }
}

/* ---------------- 战场主绘制 ---------------- */
// hud=false 时只画战场氛围（实体 + 特效），用于弹窗场景做背景
function drawBattle(G, t, hud = true) {
  ctx.drawImage(skyCanvas(G.act), 0, 0);
  // 幕色雾
  ctx.globalAlpha = 0.12; px(0, 0, 640, 360, ACTS[G.act].fog); ctx.globalAlpha = 1;
  // 地面辉光带
  drawGlow(ctx, ACTS[G.act].fog, 150, 0.3, 320, 250);

  const p = G.player, e = G.enemy;
  // 敌人
  if (e && e.alive) {
    drawEntity(e, LAY.ex, LAY.eyBase, t, false);
    if (!hud) { drawFx(); return; }
    intentBox(e, LAY.ex, LAY.intentY);
    bar(LAY.eBarX, LAY.barY, LAY.barW, LAY.barH, e.hp, e.maxHp, e.boss ? '#b13e53' : e.elite ? '#c070f0' : '#e04060', e.shield, e.maxHp);
    text(e.name, LAY.eBarX + LAY.barW / 2, LAY.nameY, e.boss ? '#ff5577' : '#ffcd75', 'center');
    statusRow(e, LAY.eBarX, LAY.barY + 14);
    if (e.boss) text('◆ BOSS', LAY.ex, LAY.markY, '#ff5577', 'center');
    else if (e.elite) text('◆ 精英', LAY.ex, LAY.markY, '#c070f0', 'center');
  }
  // 玩家
  if (p && p.alive) {
    drawEntity(p, LAY.px, LAY.pyBase, t, true);
    if (!hud) { drawFx(); return; }
    bar(LAY.pBarX, LAY.barY, LAY.barW, LAY.barH, p.hp, p.maxHp, p.hp > p.maxHp * 0.5 ? '#38b764' : p.hp > p.maxHp * 0.25 ? '#ef7d57' : '#e04060', p.shield, p.maxHp);
    text(p.name, LAY.pBarX + LAY.barW / 2, LAY.nameY, '#73eff7', 'center');
    statusRow(p, LAY.pBarX, LAY.barY + 14);
    // 电量
    for (let i = 0; i < p.maxBattery; i++) {
      const bx = LAY.pBarX + i * 14, by = LAY.barY + 32;
      px(bx, by, 11, 11, i < p.battery ? '#41a6f6' : '#1a1c2c');
      frame(bx, by, 11, 11, i < p.battery ? '#73eff7' : '#333c57');
    }
    text('电量', LAY.pBarX + p.maxBattery * 14 + 4, LAY.barY + 33, '#566c86');
    // 遗物
    let rx = LAY.pBarX;
    for (const id of p.relics) {
      const r = RELICS[id]; if (!r) continue;
      icon(r.icon, rx, LAY.barY + 48, 'r_' + r.icon);
      rx += 13;
    }
    // 护盾数字
    if (p.shield > 0) text('◆' + p.shield, LAY.pBarX + LAY.barW + 6, LAY.barY, '#73eff7');
    if (e && e.shield > 0) text('◆' + e.shield, LAY.eBarX - 4, LAY.barY, '#73eff7', 'right');
  }

  drawFx();
}

/* 光束 / 冲击环 / 粒子 / 飘字 */
function drawFx() {
  if (FX.beam) {
    const b = FX.beam, a = b.life / b.max;
    ctx.globalAlpha = a; ctx.strokeStyle = b.col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 环
  for (const r of FX.rings) {
    const a = r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * (1 - a);
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = r.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // 粒子
  for (const q of FX.parts) {
    ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6);
    ctx.fillStyle = q.col; ctx.fillRect(q.x | 0, q.y | 0, q.sz, q.sz);
  }
  ctx.globalAlpha = 1;
  // 飘字
  for (const f of FX.floats) {
    ctx.globalAlpha = Math.min(1, f.life / f.max * 1.5);
    text(f.text, f.x, f.y, f.col, 'center', f.big ? 24 : 12);
    ctx.globalAlpha = 1;
  }
}

/* ============================================================
 * DOM：卡牌元素
 * ============================================================ */
const TYPE_NAME = { damage: '攻击', shield: '防护', special: '战术', curse: '诅咒' };
function cardEl(card, opts = {}) {
  const d = document.createElement('div');
  d.className = 'card t-' + card.type + (card.upgraded ? ' up' : '') + (opts.playable === false ? ' no' : '');
  d.dataset.uid = card.uid;
  const tag = el('div', 'tag', TYPE_NAME[card.type] || '');   // 顶条显示类型，卡名在下方
  const cost = el('div', 'cost', card.cost);
  const gl = document.createElement('canvas');
  gl.className = 'glyph'; gl.width = 40; gl.height = 40;
  const g = gl.getContext('2d'); g.imageSmoothingEnabled = false;
  const ic = SPR['i_' + (card.icon || card.type)];
  if (ic) { const f = ic.r[0]; g.drawImage(f, (40 - f.width) / 2, (40 - f.height) / 2); }
  const nm = el('div', 'nm', card.name);
  const ds = el('div', 'ds', (card.desc || '').replace(/\n/g, '<br>'));
  const ty = el('div', 'ty');
  d.append(tag, cost, gl, nm, ds, ty);
  if (opts.tip !== false) d.title = card.name + '　' + TYPE_NAME[card.type] + '　' + card.cost + ' 电\n' + (card.desc || '').replace(/\n/g, ' ');
  return d;
}

/* ============================================================
 * DOM：通用弹窗
 * ============================================================ */
function showModal(title, buildBody, actions) {
  $('modal-title').textContent = title;
  const body = $('modal-body'); body.innerHTML = '';
  buildBody(body);
  const act = $('modal-actions'); act.innerHTML = '';
  (actions || []).forEach(a => {
    const b = el('button', 'btn' + (a.primary ? ' primary' : ''), a.label);
    b.onclick = () => { Sound.sfx.select(); a.fn(); };
    if (a.disabled) b.disabled = true;
    act.appendChild(b);
  });
  $('modal').classList.remove('hidden');
}
function hideModal() { $('modal').classList.add('hidden'); }

/* 三选一卡牌 */
function pickCards(title, cards, onPick, opts = {}) {
  showModal(title, body => {
    const g = el('div', 'grid');
    cards.forEach(c => {
      const ce = cardEl(c, {});
      ce.onclick = () => { Sound.sfx.select(); hideModal(); onPick(c); };
      g.appendChild(ce);
    });
    body.appendChild(g);
  }, opts.skippable ? [{ label: opts.skipLabel || '跳过', fn: () => { hideModal(); onPick(null); } }] : []);
}
/* 从牌组里挑一张（升级 / 移除） */
function pickFromDeck(title, deck, filter, onPick, opts = {}) {
  const list = deck.filter(filter || (() => true));
  if (!list.length) { hideModal(); onPick(null); return; }
  showModal(title, body => {
    const g = el('div', 'grid');
    list.forEach(c => {
      const ce = cardEl(c, {});
      ce.onclick = () => { Sound.sfx.select(); hideModal(); onPick(c); };
      g.appendChild(ce);
    });
    body.appendChild(g);
  }, [{ label: '取消', fn: () => { hideModal(); onPick(null); } }]);
}
