;(function () {
'use strict';
/* ============================================================================
   ui.js —— 画布 UI（HUD / 暂停 / 结算 / 选卡 / 主菜单）
   ----------------------------------------------------------------------------
   小游戏没有 DOM，所有 UI 都得用 canvas 画。这里用**立即模式**：
   绘制的同时做命中判定（Input.consumeTap*），不维护控件树。
   代价是每帧重画，好处是不用管控件生命周期 —— 对 12 个面板的规模更省心。
   ========================================================================== */

const U = require('./util.js');
const T = require('./tokens.js');
const ARENA = require('./arena.js');
const SG = require('./singularity.js');
const RG = require('./regions.js');
const PK = require('./pickups.js');
const CD = require('./cards.js');
const Aura = require('./aura.js');
const Input = require('./input.js');
const clamp = U.clamp, TAU = U.TAU;
const AW = ARENA.ARENA_W, AH = ARENA.ARENA_H;

/* ⚠️ 卡池已搬到 cards.js —— 战斗逻辑也要用，寄放在渲染层会让加载顺序变脆弱。
   这里不再 require 它：drawCardPick 只接收传进来的卡，不自己取。 */

/* ── 绘制小工具 ───────────────────────────────────────────────────────── */
function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* 按钮：画出来并做命中判定，返回是否被点中 */
function button(c, x, y, w, h, label, sub, primary) {
  const hot = !!Input.peekTap(x, y, w, h);
  c.save();
  rrect(c, x, y, w, h, 6);
  c.fillStyle = hot
    ? T.rgba('panel', 0.96)
    : T.rgba('panel', primary ? 0.86 : 0.7);
  c.fill();
  c.strokeStyle = T.rgba(primary ? 'amber' : 'line', hot ? 0.95 : 0.6);
  c.lineWidth = primary ? 1.4 : 1;
  c.stroke();
  c.fillStyle = T.rgba(primary ? 'amberHi' : 'ink', 1);
  c.font = T.font('body', 'medium');
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, x + w / 2, y + h / 2 + (sub ? -7 : 0));
  if (sub) {
    c.fillStyle = T.rgba('secInk', 1);
    c.font = T.font('tiny', 'regular');
    c.fillText(sub, x + w / 2, y + h / 2 + 10);
  }
  c.restore();
  return Input.consumeTap(x, y, w, h);
}

function bar(c, x, y, w, h, t, colA, colB) {
  c.save();
  c.fillStyle = T.rgba('voidDeep', 0.72);
  rrect(c, x, y, w, h, h / 2); c.fill();
  const ww = Math.max(0, w - 2) * clamp(t, 0, 1);
  if (ww > 1) {
    const g = c.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, T.hex(colA)); g.addColorStop(1, T.hex(colB));
    c.fillStyle = g;
    rrect(c, x + 1, y + 1, ww, h - 2, (h - 2) / 2); c.fill();
  }
  c.strokeStyle = T.rgba('line', 0.5);
  c.lineWidth = 1;
  rrect(c, x, y, w, h, h / 2); c.stroke();
  c.restore();
}

/* ══════════════════════════════════════════════════════════════════════
   HUD
   ════════════════════════════════════════════════════════════════════ */
const PAUSE_R = 15, PAUSE_CX = AW - 24, PAUSE_CY = 24;

function drawHUD(c, cb) {
  const sing = cb.sing;
  const st = sing.stageDef();
  const met = sing.metrics();
  const tier = SG.densityTier(sing.compression);

  c.save();
  c.textBaseline = 'middle';

  /* 顶栏底衬 */
  const g = c.createLinearGradient(0, 0, 0, 62);
  g.addColorStop(0, T.rgba('voidDeep', 0.72));
  g.addColorStop(1, T.rgba('voidDeep', 0));
  c.fillStyle = g;
  c.fillRect(0, 0, AW, 62);

  /* 左：波次 */
  c.textAlign = 'left';
  c.fillStyle = T.rgba('steel', 0.8);
  c.font = T.font('tiny', 'medium');
  c.fillText('WAVE', 12, 16);
  c.fillStyle = T.rgba('inkHi', 1);
  c.font = T.font('lead', 'bold');
  c.fillText(String(cb.wave), 12, 32);

  /* 中：区域 + 奇点读数 —— 这是本作的标题栏，必须常驻 */
  const cx = AW / 2 - 14;
  const reg = RG.regionOf(cb.wave);
  c.textAlign = 'center';
  /* 第一行：区域名（区域换了就换色） */
  c.fillStyle = T.rgba(reg.accent, 0.95);
  c.font = T.font('micro', 'medium');
  c.fillText(reg.zh + ' · ' + reg.en, cx, 13);
  /* 第二行：同一个奇点在这个深度上的形态 + 密度档 */
  c.fillStyle = T.rgba(sing.stage >= 2 ? 'singDisk' : (sing.stage === 1 ? 'singHoriz' : 'singHalo'), 0.95);
  c.font = T.font('tiny', 'medium');
  c.fillText('奇点 ' + st.zh + ' · ' + tier.zh + ' ' + Math.round(sing.compression * 100) + '%', cx, 27);
  /* 压缩条 */
  bar(c, cx - 52, 34, 104, 4, sing.compression, 'singHalo', sing.stage >= 2 ? 'singCore' : 'singHoriz');

  /* 右：得分 */
  c.textAlign = 'right';
  c.fillStyle = T.rgba('steel', 0.8);
  c.font = T.font('tiny', 'medium');
  c.fillText('SCORE', AW - 44, 16);
  c.fillStyle = T.rgba('inkHi', 1);
  c.font = T.font('lead', 'bold');
  c.fillText(U.fmt(cb.score), AW - 44, 32);

  /* 暂停键 */
  c.textAlign = 'center';
  c.fillStyle = T.rgba('panel', 0.72);
  c.beginPath(); c.arc(PAUSE_CX, PAUSE_CY, PAUSE_R, 0, TAU); c.fill();
  c.strokeStyle = T.rgba('line', 0.7);
  c.lineWidth = 1;
  c.beginPath(); c.arc(PAUSE_CX, PAUSE_CY, PAUSE_R, 0, TAU); c.stroke();
  c.fillStyle = T.rgba('ink', 0.9);
  c.fillRect(PAUSE_CX - 4, PAUSE_CY - 5, 2.6, 10);
  c.fillRect(PAUSE_CX + 1.4, PAUSE_CY - 5, 2.6, 10);
  c.restore();

  /* 底：船体 / 护盾 */
  const p = cb.p;
  const bw = 132, bx = 12, by = AH - 26;
  bar(c, bx, by, bw, 8, p.hp / Math.max(1, p.maxHp), 'hpA', 'hpB');
  c.save();
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillStyle = T.rgba('inkHi', 0.92);
  c.font = T.font('micro', 'medium');
  c.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, bx + bw + 8, by + 4);
  c.restore();
  if (p.shieldMax > 0) {
    bar(c, bx, by - 11, bw, 5, p.shield / Math.max(1, p.shieldMax), 'shieldA', 'shieldB');
  }

  /* 视界灼烧警告 */
  if (p.alive) {
    const f = sing.fieldAt(p.x, p.y);
    if (f.burn > 0) {
      c.save();
      c.globalAlpha = 0.5 + 0.5 * Math.sin(cb.time * 12);
      c.strokeStyle = T.rgba('danger', 0.85);
      c.lineWidth = 2;
      c.strokeRect(1, 1, AW - 2, AH - 2);
      c.restore();
      c.save();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = T.rgba('dangerHi', 0.95);
      c.font = T.font('small', 'bold');
      c.fillText('事件视界 · 脱离', AW / 2, AH * 0.62);
      c.restore();
    }
  }

  /* 门（通道口）状态提示 —— 放在顶栏下方，别跟读数挤在一起 */
  if (sing.gate === 1) {
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = T.rgba('voidDeep', 0.62);
    c.fillRect(AW / 2 - 118, 62, 236, 26);
    c.strokeStyle = T.rgba('steel', 0.55);
    c.lineWidth = 1;
    c.strokeRect(AW / 2 - 118, 62, 236, 26);
    c.fillStyle = T.rgba('steel', 1);
    c.font = T.font('small', 'medium');
    c.fillText('亚稳态 · 肃清残敌以开启', AW / 2, 75);
    c.restore();
  } else if (sing.gate === 2) {
    /* 开启态要够醒目 —— 玩家 90% 的时间在被训练「躲开它」，这一刻必须反过来说清楚 */
    const pl = 0.65 + 0.35 * Math.sin(cb.time * 6);
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = T.rgba('voidDeep', 0.7);
    c.fillRect(AW / 2 - 118, 62, 236, 26);
    c.strokeStyle = T.rgba('singCore', 0.4 + 0.5 * pl);
    c.lineWidth = 1.4;
    c.strokeRect(AW / 2 - 118, 62, 236, 26);
    c.fillStyle = T.rgba('singCore', 0.7 + 0.3 * pl);
    c.font = T.font('small', 'bold');
    c.fillText('奇点已开启 · 飞进去', AW / 2, 75);
    c.restore();

    /* 门太远时给一个指向箭头，省得玩家找 */
    const dx = sing.x - p.x, dy = sing.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 90) {
      const a = Math.atan2(dy, dx);
      const rr = p.r + 34;
      c.save();
      c.translate(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      c.rotate(a);
      c.fillStyle = T.rgba('singCore', 0.55 + 0.35 * pl);
      c.beginPath();
      c.moveTo(9, 0); c.lineTo(-5, -6); c.lineTo(-5, 6);
      c.closePath(); c.fill();
      c.restore();
    }
  }

  /* buff 徽章放在最后：它画在门提示之上，挂着的 buff 任何时候都该看得到 */
  drawBuffs(c, cb);
}

/* ── buff 徽章（右侧竖排）─────────────────────────────────────────────────
   边缘光带只回答"有 / 没有"，**精确辨识交给这里**：字形 + 倒计时弧。
   两个 buff 颜色再接近，看字形也不会认错 —— 这是分层的意义。
   ⚠️ 判定直接读 Aura.buffList，跟边缘光带是同一份数据，不会出现一边有一边没有。 */
function drawBuffs(c, cb) {
  const list = Aura.buffList(cb);
  if (!list.length) return;
  const x = AW - 24, y0 = 78, r = 8, step = 22;
  c.save();
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const y = y0 + i * step;
    /* 底衬：深墨圆，保证在星空上不糊 */
    c.fillStyle = T.rgba('voidDeep', 0.66);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = T.rgba(b.col, 0.85);
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();

    /* 字形（与拾取物同一个 drawGlyph —— 捡到的和挂着的长得一样） */
    c.save();
    c.translate(x, y);
    c.strokeStyle = T.rgba(b.col, 0.95);
    PK.drawGlyph(c, b.id, r * 0.76, 1.2);
    c.restore();

    /* 倒计时弧：绕徽章一圈，随剩余量缩短 */
    if (b.max > 0) {
      const t = clamp(b.left / b.max, 0, 1);
      const urgent = b.left < 1.5;
      c.strokeStyle = T.rgba(b.col, urgent ? (0.35 + 0.55 * Math.abs(Math.sin(cb.time * 11))) : 0.7);
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + TAU * t);
      c.stroke();
      /* 只剩 3 秒内才给数字 —— 平时不吵 */
      if (b.left <= 3) {
        c.fillStyle = T.rgba(b.col, 0.95);
        c.font = T.font('micro', 'bold');
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(Math.ceil(b.left)), x, y + r + 9);
      }
    }
  }
  c.restore();
}

function pauseHit() { return Input.consumeTapCircle(PAUSE_CX, PAUSE_CY, PAUSE_R + 6); }

/* ══════════════════════════════════════════════════════════════════════
   面板
   ════════════════════════════════════════════════════════════════════ */
function scrim(c, a) {
  c.save();
  c.fillStyle = T.rgba('voidDeep', a == null ? 0.82 : a);
  c.fillRect(0, 0, AW, AH);
  c.restore();
}
function panelBox(c, x, y, w, h) {
  c.save();
  rrect(c, x, y, w, h, 10);
  c.fillStyle = T.rgba('panel', 0.95);
  c.fill();
  c.strokeStyle = T.rgba('line', 0.65);
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}
function title(c, y, zh, en) {
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = T.rgba('inkHi', 1);
  c.font = T.font('title', 'bold');
  c.fillText(zh, AW / 2, y);
  c.fillStyle = T.rgba('secInk', 0.9);
  c.font = T.font('tiny', 'regular');
  c.fillText(en, AW / 2, y + 20);
  c.restore();
}

/* ── 主菜单 ───────────────────────────────────────────────────────────── */
function drawMenu(c, cb) {
  scrim(c, 0.9);
  /* 菜单背景也放一个奇点 —— 让玩家第一眼就看到它 */
  if (cb && cb.sing) { cb.sing.drawBack(c); cb.sing.drawFront(c); }
  scrim(c, 0.55);

  const y = AH * 0.24;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = T.rgba('inkHi', 1);
  c.font = T.font('hero', 'bold');
  c.fillText('奇点回响', AW / 2, y);
  c.fillStyle = T.rgba('singHoriz', 0.9);
  c.font = T.font('small', 'medium');
  c.fillText('ECHO · SINGULARITY', AW / 2, y + 26);
  c.fillStyle = T.rgba('secInk', 0.95);
  c.font = T.font('tiny', 'regular');
  c.fillText('你的构筑会把它压得越来越小，也越来越危险', AW / 2, y + 48);
  c.restore();

  return button(c, (AW - 168) / 2, AH * 0.52, 168, 46, '开始', 'START', true);
}

/* ── 暂停 ─────────────────────────────────────────────────────────────── */
function drawPause(c, cb, ch) {
  scrim(c, 0.86);
  const w = 240, h = 210, x = (AW - w) / 2, y = (AH - h) / 2;
  panelBox(c, x, y, w, h);
  title(c, y + 34, '暂停', 'PAUSED');

  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = T.rgba('secInk', 0.95);
  c.font = T.font('tiny', 'regular');
  if (ch) {
    c.fillText('通道中 · 已收集 ' + ch.got + ' 星尘', AW / 2, y + 62);
  } else {
    c.fillText('第 ' + cb.wave + ' 波 · 得分 ' + U.fmt(cb.score) + ' · 击坠 ' + cb.kills, AW / 2, y + 62);
  }
  const tier = SG.densityTier(cb.sing.compression);
  c.fillStyle = T.rgba('singDisk', 0.95);
  c.fillText('奇点密度 ' + tier.zh + ' ' + Math.round(cb.sing.compression * 100) + '%', AW / 2, y + 80);
  c.restore();

  const bw = w - 48;
  const r1 = button(c, x + 24, y + 100, bw, 40, '继续', 'RESUME', true);
  const r2 = button(c, x + 24, y + 148, bw, 36, '重新开始', 'RESTART');
  return { resume: r1, restart: r2 };
}

/* ── 结算 ─────────────────────────────────────────────────────────────── */
function drawOver(c, cb, best) {
  scrim(c, 0.9);
  const w = 268, h = 300, x = (AW - w) / 2, y = (AH - h) / 2;
  panelBox(c, x, y, w, h);
  title(c, y + 36, '奇点已合拢', 'SINGULARITY CLOSED');

  const rows = [
    ['抵达波次', String(cb.wave)],
    ['击坠', String(cb.kills)],
    ['得分', U.fmt(cb.score)],
    ['协同', String(cb.synergy) + ' 张'],
    ['存活', U.mmss(cb.time)],
  ];
  c.save();
  c.textBaseline = 'middle';
  let ry = y + 76;
  for (let i = 0; i < rows.length; i++) {
    c.textAlign = 'left';
    c.fillStyle = T.rgba('secInk', 0.95);
    c.font = T.font('small', 'regular');
    c.fillText(rows[i][0], x + 28, ry);
    c.textAlign = 'right';
    c.fillStyle = T.rgba('inkHi', 1);
    c.font = T.font('small', 'bold');
    c.fillText(rows[i][1], x + w - 28, ry);
    ry += 24;
  }
  if (best != null) {
    c.textAlign = 'center';
    c.fillStyle = T.rgba(best > cb.score ? 'steel' : 'amberHi', 0.95);
    c.font = T.font('tiny', 'regular');
    c.fillText(best > cb.score ? ('最佳 ' + U.fmt(best)) : '新纪录', AW / 2, ry + 4);
  }
  c.restore();

  const bw = w - 56;
  const r1 = button(c, x + 28, y + h - 96, bw, 40, '再来一局', 'RETRY', true);
  const r2 = button(c, x + 28, y + h - 50, bw, 36, '分享这一局', 'SHARE');
  return { retry: r1, share: r2 };
}

/* ── 通道结算 ─────────────────────────────────────────────────────────── */
function drawChannelEnd(c, ch) {
  scrim(c, 0.86);
  const w = 258, h = 248, x = (AW - w) / 2, y = (AH - h) / 2;
  panelBox(c, x, y, w, h);
  title(c, y + 32, '通道尽头', 'CHANNEL END');

  /* 升级舱换到的永久强化（ch.upgrades 是卡 id 数组） */
  const ups = ch.upgrades || [];
  const upNames = [];
  for (let i = 0; i < ups.length; i++) {
    const cd = CD.byId(ups[i]);
    if (cd) upNames.push(cd.zh);
  }

  c.save();
  c.textBaseline = 'middle';
  let ry = y + 70;
  const rows = [
    ['收集星尘', String(ch.got)],
    ['撞击', String(ch.hits)],
    ['抢到升级舱', ups.length + ' 项'],
    ['折算强化', ch.cards() + ' 张'],
  ];
  for (let i = 0; i < rows.length; i++) {
    c.textAlign = 'left';
    c.fillStyle = T.rgba('secInk', 0.95);
    c.font = T.font('small', 'regular');
    c.fillText(rows[i][0], x + 30, ry);
    c.textAlign = 'right';
    c.fillStyle = T.rgba(i === 2 ? 'violetHi' : (i === 3 ? 'amberHi' : 'inkHi'), 1);
    c.font = T.font('small', 'bold');
    c.fillText(rows[i][1], x + w - 30, ry);
    ry += 24;
  }

  /* 拿到升级就报名字（玩家要看见"我变强在哪"）；没拿到才讲设计哲学 */
  c.textAlign = 'center';
  if (upNames.length) {
    c.fillStyle = T.rgba('violetHi', 0.95);
    c.font = T.font('micro', 'bold');
    c.fillText(upNames.join(' · '), AW / 2, ry + 2);
  } else {
    c.fillStyle = T.rgba('steel', 0.9);
    c.font = T.font('micro', 'regular');
    c.fillText('巨像不掉东西 —— 回报都在这一段里', AW / 2, ry + 2);
  }
  c.restore();

  return button(c, x + 30, y + h - 62, w - 60, 42, '继续', 'CONTINUE', true);
}

/* ── 选卡 ─────────────────────────────────────────────────────────────── */
function drawCardPick(c, cards) {
  scrim(c, 0.86);
  const w = 268, h = 210, x = (AW - w) / 2, y = (AH - h) / 2;
  panelBox(c, x, y, w, h);
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = T.rgba('inkHi', 1);
  c.font = T.font('title', 'bold');
  c.fillText('强化', AW / 2, y + 34);
  c.fillStyle = T.rgba('secInk', 0.9);
  c.font = T.font('tiny', 'regular');
  c.fillText('选择一项 —— 「协同」会压缩奇点', AW / 2, y + 56);
  c.restore();

  const cw = (w - 56 - 12) / 2, ch = 96, cy = y + 76;
  let picked = -1;
  for (let i = 0; i < cards.length && i < 2; i++) {
    const cd = cards[i];
    const cxx = x + 28 + i * (cw + 12);
    const isSyn = cd.id === 'synergy';
    const hot = !!Input.peekTap(cxx, cy, cw, ch);
    c.save();
    rrect(c, cxx, cy, cw, ch, 8);
    c.fillStyle = T.rgba('panel', hot ? 0.98 : 0.84);
    c.fill();
    c.strokeStyle = T.rgba(isSyn ? 'singDisk' : 'line', hot ? 0.98 : 0.62);
    c.lineWidth = isSyn ? 1.6 : 1;
    c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = T.rgba(isSyn ? 'singCore' : 'inkHi', 1);
    c.font = T.font('body', 'bold');
    c.fillText(cd.zh, cxx + cw / 2, cy + 24);
    c.fillStyle = T.rgba('secInk', 0.85);
    c.font = T.font('micro', 'regular');
    c.fillText(cd.en, cxx + cw / 2, cy + 40);
    /* 描述换行（canvas 没有自动换行，手动按字数折） */
    c.fillStyle = T.rgba('steel', 0.95);
    c.font = T.font('micro', 'regular');
    const words = cd.desc;
    const per = 8;
    let line = '', ln = 0;
    for (let k = 0; k < words.length; k += per) {
      line = words.slice(k, k + per);
      c.fillText(line, cxx + cw / 2, cy + 58 + ln * 12);
      ln++;
    }
    c.restore();
    if (Input.consumeTap(cxx, cy, cw, ch)) picked = i;
  }
  return picked;
}

module.exports = {
  drawHUD: drawHUD, pauseHit: pauseHit, drawBuffs: drawBuffs,
  drawMenu: drawMenu, drawPause: drawPause, drawOver: drawOver, drawCardPick: drawCardPick,
  drawChannelEnd: drawChannelEnd,
  button: button, bar: bar, rrect: rrect, scrim: scrim, panelBox: panelBox, title: title,
};
})();
