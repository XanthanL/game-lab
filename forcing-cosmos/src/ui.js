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
const FX = { parts: [], floats: [], rings: [], cards: [], shake: 0, shakeT: 0, flash: 0, flashCol: '#e04060', beam: null };

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

/* ---------------- 出牌演出：卡牌本体飞向目标 ----------------
   为什么要飞：以前 playCard() 直接 splice + renderHand()，卡牌是"啪一下就没了"，
   玩家看不出这张牌打向了谁。现在把被打出的那张卡从 #hand 摘出来、送进 #fxcards，
   沿弧线飞向目标，到达的瞬间才结算效果（applyCard）并炸开。
   返回飞行时长（ms），调用方拿它排后续节拍。
   ⚠️ 元素必须先 append 到 #fxcards 再改 left/top：两层的坐标系都是 #wrap 的游戏像素，
      所以 left/top 可以直接沿用，不需要换算屏幕坐标（#wrap 的整体缩放会一起带上）。 */
const FLY_MS = 150, FLY_BURST = 130;
function flyCard(node, side, onArrive, from) {
  if (!node) { if (onArrive) onArrive(); return 0; }
  const x0 = (parseFloat(node.style.left) || 0) + (from ? from.dx : 0);
  const y0 = (parseFloat(node.style.top) || 0) + (from ? from.dy : 0);
  const tx = (side === 'enemy' ? LAY.ex : LAY.px) - 48;
  const ty = (side === 'enemy' ? LAY.eyBase - 40 : LAY.pyBase - 40) - 55;
  const layer = $('fxcards');
  if (layer) layer.appendChild(node);
  node.classList.remove('sel');
  node.style.left = x0.toFixed(1) + 'px';
  node.style.top = y0.toFixed(1) + 'px';
  FX.cards.push({ node, x0, y0, tx, ty, t: 0, burst: 0, arrived: false, onArrive });
  return FLY_MS;
}
/** 清空飞行中的卡。切场景时必须调 —— #fxcards 不归 renderHand() 管，
    不清的话上一场战斗最后一张卡会一直悬在屏幕上。 */
function clearFlyCards() {
  const layer = $('fxcards');
  if (layer) layer.innerHTML = '';
  FX.cards.length = 0;
}
function stepFlyCards(dt) {
  for (let i = FX.cards.length - 1; i >= 0; i--) {
    const f = FX.cards[i];
    if (!f.arrived) {
      f.t += dt;
      const k = Math.min(1, f.t / FLY_MS);
      const e = 1 - Math.pow(1 - k, 3);              // easeOutCubic：起步快、落点稳
      const arc = Math.sin(k * Math.PI) * -30;       // 上抛弧线，不是直线滑过去
      f.node.style.left = (f.x0 + (f.tx - f.x0) * e).toFixed(1) + 'px';
      f.node.style.top = (f.y0 + (f.ty - f.y0) * e + arc).toFixed(1) + 'px';
      f.node.style.transform = 'scale(' + (1 + k * 0.15).toFixed(3) + ') rotate(' + (arc * 0.16).toFixed(2) + 'deg)';
      // 后半程开始淡出：整张卡一路盖着敌人看不清战况，得让它"化进"攻击里
      f.node.style.opacity = (k < 0.5 ? 1 : 1 - (k - 0.5) * 1.4).toFixed(2);
      if (k >= 1) { f.arrived = true; f.burst = FLY_BURST; if (f.onArrive) f.onArrive(); }
    } else {
      f.burst -= dt;
      const k = 1 - Math.max(0, f.burst) / FLY_BURST;
      f.node.style.transform = 'scale(' + (1.15 + k * 0.5).toFixed(3) + ')';
      f.node.style.opacity = String(Math.max(0, 0.3 * (1 - k)));
      if (f.burst <= 0) { if (f.node.parentNode) f.node.parentNode.removeChild(f.node); FX.cards.splice(i, 1); }
    }
  }
}
/** 出牌落地瞬间按牌类炸开（伤害→斩击线，护盾→蓝色环，状态/战术→紫色环）。 */
function cardImpact(c, side) {
  const toEnemy = side === 'enemy';
  const x = toEnemy ? LAY.ex : LAY.px;
  const y = toEnemy ? LAY.eyBase - 40 : LAY.pyBase - 40;
  const col = c.type === 'damage' ? '#ffcd75' : c.type === 'shield' ? '#41a6f6' : c.type === 'curse' ? '#8a3cc0' : '#c070f0';
  addRing(x, y, col, 4, toEnemy ? 56 : 42, 300);
  addParts(x, y, 10, col, {
    speed: toEnemy ? 210 : 110,
    dir: toEnemy ? 0 : -Math.PI / 2, spread: 1.7, g: toEnemy ? 60 : -50, life: 380,
  });
}

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
  stepFlyCards(dt);
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
/* ⚠️⚠️ 旧版是固定 14x14 的框 + `text(n, cx+13, y+10, 'right')`：
   ① 数字右对齐到 cx+13、框只有 14 宽 → 3 位数（"999" = 18px）从左边戳出框外 5px 并盖住图标；
   ② 数字的 y 是 +10，而 12px 像素字的墨迹落在 [y-1, y+9] → 墨迹整体挂在框底**下面** 5px。
   现在：框宽按数字真实宽度算（`nw + 12`），图标垂直居中，数字右对齐到框内 2px 处、y 用 +2 让墨迹居中。
   探针：`.probe-overflow.cjs` B 组。 */
function statusRow(e, x, y) {
  let cx = x;
  ctx.font = '12px FP, monospace';
  for (const k in STATUS_INFO) {
    const n = e.getStatus(k); if (!n) continue;
    const info = STATUS_INFO[k];
    const ns = String(n);
    const nw = Math.ceil(ctx.measureText(ns).width);
    const w = nw + 12;                       // 2(左留白) + 6(图标) + 2(间隙) + nw + 2(右留白)
    px(cx, y, w, 14, '#0e1022'); frame(cx, y, w, 14, info.col);
    icon(info.icon, cx + 2, y + 4, 's_' + info.icon);
    text(ns, cx + w - 2, y + 2, '#ffffff', 'right', 12);
    cx += w + 2;
  }
}
/* ---------------- 意图 ---------------- */
const INTENT_COL = { attack: '#e04060', defend: '#41a6f6', charge: '#c070f0', charged: '#ffcd75' };
/* 意图框的文字。抽出来是因为「量宽度」和「画文字」必须是同一个字符串。 */
function intentLabel(e, it) {
  return it.type === 'defend' ? '防御 ' + it.value
    : it.type === 'charge' ? '蓄能 ' + it.left + '/' + e.chargeTurns
      : it.type === 'charged' ? '致命 ' + it.value
        : it.value + ' 伤害';
}
/* ⚠️⚠️ 框宽必须用 measureText 量出来，**不能**按 label.length * 6 估。
   这个字体里 CJK / ★▲ 是 12px 宽、ASCII 是 6px，按 length*6 估的话
   「3 伤害」实际 36px 只算 24px —— 六种意图形态（攻击/防御/蓄能/致命，含个位到四位）
   全部短 11px，文字戳出右边框。2026-09-26 作者截图报的 bug。
   探针：`.probe-overflow.cjs` A 组（劫持 fillText/fillRect 量真实绘制）。 */
const INTENT_PAD_L = 12;   // 左侧图标区（图标画在 +4，宽约 5）
const INTENT_PAD_R = 4;    // 右侧留白
function intentLayout(e, x, y) {
  const it = e.getIntent(); if (!it) return null;
  const label = intentLabel(e, it);
  ctx.font = '12px FP, monospace';
  const tw = Math.ceil(ctx.measureText(label).width);
  const w = INTENT_PAD_L + tw + INTENT_PAD_R;
  return {
    it, label, tw, w,
    boxX: x - w / 2 - 2, boxY: y - 2, boxW: w + 4, boxH: 16,
    textX: x - w / 2 + INTENT_PAD_L, textY: y + 1,
  };
}
function intentBox(e, x, y) {
  const L = intentLayout(e, x, y); if (!L) return;
  const col = INTENT_COL[L.it.type] || '#566c86';
  px(L.boxX, L.boxY, L.boxW, L.boxH, '#05060dcc');
  frame(L.boxX, L.boxY, L.boxW, L.boxH, col);
  // 图标：三角/方块/菱/星（用像素直接画）
  ctx.fillStyle = col;
  const gx = x - L.w / 2 + 4, gy = y + 2;
  if (L.it.type === 'attack' || L.it.type === 'charged') { for (let i = 0; i < 5; i++) ctx.fillRect(gx + 2 - i * 0.5 | 0, gy + i, i + 1, 1); }
  else if (L.it.type === 'defend') { ctx.fillRect(gx, gy, 5, 5); }
  else { for (let i = 0; i < 5; i++) ctx.fillRect(gx + Math.abs(i - 2), gy + i, 5 - Math.abs(i - 2) * 2, 1); }
  text(L.label, L.textX, L.textY, col);
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
    // 电量。⚠️ 上限取 Math.max(maxBattery, battery) —— 「先手协议」遗物会让电量**超过上限**
    //    （回合一 resetTurn 就把 battery 顶到 maxBattery，只加不溢出的话那条遗物等于没有），
    //    用 maxBattery 画就会把多出来的那格藏起来，玩家以为遗物没生效。
    const battN = Math.max(p.maxBattery, p.battery);
    for (let i = 0; i < battN; i++) {
      const bx = LAY.pBarX + i * 14, by = LAY.barY + 32;
      px(bx, by, 11, 11, i < p.battery ? '#41a6f6' : '#1a1c2c');
      frame(bx, by, 11, 11, i < p.battery ? '#73eff7' : '#333c57');
    }
    text('电量', LAY.pBarX + battN * 14 + 4, LAY.barY + 33, '#566c86');
    // 遗物。⚠️ 扩容到 24 件后一行放不下（44 + 24×13 = 356，会顶到右侧敌人区）——
    //    每行 12 个换行。别指望玩家只有 3-4 件。
    let rx = LAY.pBarX, ry = LAY.barY + 48, perRow = 0;
    for (const id of p.relics) {
      const r = RELICS[id]; if (!r) continue;
      icon(r.icon, rx, ry, 'r_' + r.icon);
      rx += 13;
      if (++perRow >= 12) { perRow = 0; rx = LAY.pBarX; ry += 13; }
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
  // ch-<职业> 决定卡面主色（--ch）；没有 char 的通用卡退回类型色
  d.className = 'card t-' + card.type + (card.upgraded ? ' up' : '') + (opts.playable === false ? ' no' : '')
    + (card.char ? ' ch-' + card.char : '');
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
// 当前弹窗的「关闭」动作；null = 强制选择（战后整理 / 休整 / 异象），不给关闭口子
let modalClose = null;

function showModal(title, buildBody, actions, opts = {}) {
  $('modal-title').textContent = title;
  const body = $('modal-body'); body.innerHTML = '';
  buildBody(body);
  body.scrollTop = 0;
  const act = $('modal-actions'); act.innerHTML = '';
  (actions || []).forEach(a => {
    const b = el('button', 'btn' + (a.primary ? ' primary' : ''), a.label);
    b.onclick = () => { Sound.sfx.select(); a.fn(); };
    if (a.disabled) b.disabled = true;
    act.appendChild(b);
  });
  modalClose = opts.onClose || null;
  const x = $('modal-x');
  x.classList.toggle('hidden', !modalClose);
  x.onclick = () => closeModal();
  $('modal').classList.remove('hidden');
}
function hideModal() { $('modal').classList.add('hidden'); modalClose = null; }
/** 关掉当前弹窗（若有）；返回是否真的关掉了 —— 强制选择弹窗返回 false */
function closeModal() {
  if (!modalClose) return false;
  const fn = modalClose;
  hideModal();
  Sound.sfx.select();
  fn();
  return true;
}
// 点弹窗外的暗色背景 = 关闭（只对可关的弹窗生效）
$('modal').addEventListener('pointerdown', e => { if (e.target === $('modal')) closeModal(); });

/* 三选一卡牌 */
function pickCards(title, cards, onPick, opts = {}) {
  const cancel = opts.onCancel || null;
  const acts = [];
  if (cancel) acts.push({ label: opts.cancelLabel || '返回', fn: () => { hideModal(); cancel(); } });
  else if (opts.skippable) acts.push({ label: opts.skipLabel || '跳过', fn: () => { hideModal(); onPick(null); } });
  showModal(title, body => {
    const g = el('div', 'grid');
    cards.forEach(c => {
      const ce = cardEl(c, {});
      ce.onclick = () => { Sound.sfx.select(); hideModal(); onPick(c); };
      g.appendChild(ce);
    });
    body.appendChild(g);
  }, acts, cancel ? { onClose: () => { hideModal(); cancel(); } } : {});
}
/* 从牌组里挑一张（升级 / 移除 / 丢弃）；取消默认回调 onPick(null)，
   传 opts.onCancel 可以让「取消」退回上一层（而不是直接结束这个节点） */
function pickFromDeck(title, deck, filter, onPick, opts = {}) {
  const list = deck.filter(filter || (() => true));
  const cancel = opts.onCancel || (() => onPick(null));
  if (!list.length) { hideModal(); cancel(); return; }
  showModal(title, body => {
    const g = el('div', 'grid');
    list.forEach(c => {
      const ce = cardEl(c, {});
      ce.onclick = () => { Sound.sfx.select(); hideModal(); onPick(c); };
      g.appendChild(ce);
    });
    body.appendChild(g);
  }, [{ label: opts.cancelLabel || '取消', fn: () => { hideModal(); cancel(); } }],
     { onClose: () => { hideModal(); cancel(); } });
}

