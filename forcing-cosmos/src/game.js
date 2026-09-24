'use strict';
/* ============================================================
 * 强渡宇宙 · 主逻辑
 * 场景：title / story / charsel / map / battle / over
 * ============================================================ */
const G = {
  scene: 'title', act: 0, turn: 1, phase: 'none',
  player: null, enemy: null,
  deck: [], draw: [], hand: [], discard: [], exhaust: [],
  gold: 0, potions: [], map: null, node: null,
  run: null,              // 本局统计
  selCard: -1, busy: false, paused: false,
  curEvent: null,         // 当前异象（取消选择时要原样退回，不能重抽）
};
const SAVE_KEY = 'forcing_cosmos_save';
const MAP_ROWS = 6, MAP_COLS = 4;
const MAP_X = 300, MAP_Y = 128;   // #map-grid 600x256 内的布局原点

/* 暂停感知的定时器：战斗里所有延时都走这里，暂停时挂起、恢复后继续。
   直接 setTimeout 的话「暂停」只是个盖在上面的壳，敌人照样打你。 */
function after(ms, fn) {
  setTimeout(function run() {
    if (G.paused) { setTimeout(run, 120); return; }
    fn();
  }, ms);
}

/* ============================================================
 * 场景切换
 * ============================================================ */
const SCENES = ['title', 'story', 'help', 'charsel', 'map', 'over'];
function setScene(s) {
  G.scene = s;
  G.paused = false;
  for (const n of SCENES) $(n).classList.toggle('hidden', n !== s);
  $('hud').classList.toggle('hidden', s !== 'battle');
  $('hand').classList.toggle('hidden', s !== 'battle');
  $('pause').classList.add('hidden');
  $('modal').classList.add('hidden');
  modalClose = null;
  if (s !== 'battle') $('hand').innerHTML = '';
}

function log(msg) {
  G.log = G.log || [];
  G.log.push(msg); if (G.log.length > 3) G.log.shift();
  $('logline').textContent = G.log.join('　|　');
}

/* ============================================================
 * 标题 / 剧情 / 选人
 * ============================================================ */
function showTitle() {
  setScene('title');
  const b = localStorage.getItem('fc_best');
  $('best').textContent = b ? '最佳：' + b : '';
  Sound.setTrack(0);
}
function startStory(afterStory) {
  setScene('story');
  $('story-head').textContent = '// EDF 绝密量子广播 · 新纪元 142 年';
  const box = $('story-text'); box.innerHTML = '';
  Sound.sfx.warp();
  let i = 0, timer = null, done = false;
  const cursor = el('span', 'cur', '█');
  function next() {
    if (done) return;
    if (i >= STORY_LINES.length) { finish(); return; }
    const L = STORY_LINES[i++];
    if (!L.t) { box.appendChild(el('div', '', '&nbsp;')); timer = setTimeout(next, L.d || 420); return; }
    const d = el('div', L.c || '');
    box.appendChild(d);
    let n = 0;
    timer = setInterval(() => {
      if (done) { clearInterval(timer); return; }   // 跳过之后别再往里打字
      d.textContent = L.t.slice(0, ++n);
      if (!box.contains(cursor)) box.appendChild(cursor);
      if (n >= L.t.length) { clearInterval(timer); timer = setTimeout(next, 220); }
    }, 26);
  }
  function finish() {
    if (done) return;                               // 跳过键按两次 / 自然播完后再按，都不重复挂监听
    done = true;
    if (timer) { clearTimeout(timer); timer = null; }
    if (cursor.parentNode) cursor.remove();
    const h = el('div', 'hi', '按任意键 / 点击屏幕　开始强渡');
    h.classList.add('blink');
    box.appendChild(h);
    // 「点击屏幕」就得是整块屏幕都能点 —— 之前只挂在 #story-text 上，
    // 而提示条本身比正文高，点在空白处毫无反应。跳过键自己除外（它有自己的语义）。
    const storyEl = $('story');
    const go = () => {
      window.removeEventListener('keydown', go);
      storyEl.removeEventListener('click', onClick);
      afterStory();
    };
    const onClick = ev => { if (ev.target.closest('#story-skip')) return; go(); };
    window.addEventListener('keydown', go);
    storyEl.addEventListener('click', onClick);
  }
  next();
  $('story-skip').textContent = '点击这里跳过';
  $('story-skip').onclick = finish;
}

function showCharSel() {
  setScene('charsel');
  const wrap = $('char-cards'); wrap.innerHTML = '';
  for (const id in CHARACTERS) {
    const c = CHARACTERS[id];
    const d = el('div', 'charcard');
    const cn = document.createElement('canvas'); cn.width = 96; cn.height = 96;
    const g = cn.getContext('2d'); g.imageSmoothingEnabled = false;
    const s = SPR[id]; if (s) { const f = scaled(s.r[0], 96 / s.w); g.drawImage(f, (96 - f.width) / 2, (96 - f.height) / 2); }
    d.append(cn, el('div', 'cn', c.name), el('div', 'ct', c.title), el('div', 'cs', c.passiveText));
    d.onmouseenter = () => { $('char-desc').innerHTML = '<b>' + c.name + '</b>　' + c.maxHp + ' 生命　' + c.battery + ' 电量<br>' + c.passiveText; };
    d.onclick = () => { Sound.sfx.select(); newRun(id); };
    wrap.appendChild(d);
  }
  const first = CHARACTERS[Object.keys(CHARACTERS)[0]];
  $('char-desc').innerHTML = '<b>' + first.name + '</b>　' + first.maxHp + ' 生命　' + first.battery + ' 电量<br>' + first.passiveText;
}

/* ============================================================
 * 开新局
 * ============================================================ */
function newRun(charId) {
  G.run = {
    charId, act: 0, floors: 0, wins: 0, elites: 0, events: 0, shops: 0, potionsUsed: 0,
    gold: 0, curses: 0, usedVoid: false, usedPurify: false, voidChoices: 0, lightChoices: 0,
  };
  G.act = 0; G.gold = 40; G.potions = [];
  G.player = new Player(charId);
  G.deck = buildStarterDeck(charId);
  G.log = [];
  enterAct(0);
}

/* ============================================================
 * 幕 / 地图
 * ============================================================ */
function enterAct(a) {
  G.act = a; G.run.act = a;
  if (a === 1 && !G.player.hasRelic('starCore')) G.player.addRelic('starCore');
  G.map = genMap();
  showMap();
}
function genMap() {
  const nodes = [], edges = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row = [];
    if (r === MAP_ROWS - 1) {
      row.push({ r, c: 1, kind: 'boss', visited: false, reach: false });
    } else {
      const cols = [0, 1, 2, 3];
      shuffleArray(cols);
      const picked = cols.slice(0, 3).sort();
      for (const c of picked) {
        let kind;
        if (r === 0) kind = Math.random() < 0.7 ? 'battle' : 'event';
        else if (r === MAP_ROWS - 2) kind = ['battle', 'battle', 'rest', 'rest', 'event', 'shop'][(Math.random() * 6) | 0];
        else kind = ['battle', 'battle', 'battle', 'battle', 'elite', 'event', 'event', 'shop', 'rest'][(Math.random() * 9) | 0];
        row.push({ r, c, kind, visited: false, reach: false });
      }
    }
    nodes.push(row);
  }
  // 连边：向下相邻列连 1~2 条
  for (let r = 0; r < MAP_ROWS - 1; r++) {
    for (const n of nodes[r]) {
      const cand = nodes[r + 1].filter(m => Math.abs(m.c - n.c) <= 1);
      if (!cand.length) continue;
      const k = Math.random() < 0.4 ? 2 : 1;
      shuffleArray(cand);
      for (const m of cand.slice(0, k)) edges.push({ a: n, b: m });
    }
    // 保证下一行每个节点有入边
    for (const m of nodes[r + 1]) {
      if (edges.some(e => e.b === m)) continue;
      const cand = nodes[r].filter(n => Math.abs(n.c - m.c) <= 1);
      if (cand.length) { cand.sort((x, y) => Math.abs(x.c - m.c) - Math.abs(y.c - m.c)); edges.push({ a: cand[0], b: m }); }
    }
  }
  const map = { nodes, edges };
  updateReach(map);
  return map;
}
function updateReach(map) {
  const visited = [];
  map.nodes.forEach(row => row.forEach(n => { if (n.visited) visited.push(n); n.reach = false; }));
  if (!visited.length) { map.nodes[0].forEach(n => n.reach = true); return; }
  for (const e of map.edges) if (e.a.visited) e.b.reach = true;
}
function showMap() {
  setScene('map');
  const A = ACTS[G.act];
  $('map-title').textContent = A.name + ' · ' + A.depth;
  const grid = $('map-grid'); grid.innerHTML = '';
  const pos = n => ({ x: 75 + n.c * 150, y: 26 + n.r * 40 });
  // 边
  for (const e of G.map.edges) {
    const p = pos(e.a), q = pos(e.b), dx = q.x - p.x, dy = q.y - p.y;
    const d = el('div', 'medge' + (e.a.visited && !e.b.visited ? ' live' : ''));
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    d.style.width = Math.hypot(dx, dy) + 'px';
    d.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
    grid.appendChild(d);
  }
  // 节点
  const GLYPH = { battle: '⚔', elite: '☠', rest: '♨', event: '?', shop: '$', boss: '☠' };
  G.map.nodes.forEach(row => row.forEach(n => {
    const p = pos(n);
    const d = el('div', 'mnode' + (n.visited ? ' visited' : n.reach ? ' reach' : '') + (n.kind === 'boss' || n.kind === 'elite' ? ' boss' : ''), GLYPH[n.kind]);
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    d.title = { battle: '战斗', elite: '精英', rest: '休整', event: '异象', shop: '补给站', boss: '幕末 BOSS' }[n.kind];
    if (n.reach && !n.visited) d.onclick = () => { Sound.sfx.select(); selectNode(n); };
    grid.appendChild(d);
  }));
  $('map-legend').innerHTML = '⚔ 战斗　☠ 精英/BOSS　♨ 休整　? 异象　$ 补给站　　<b>' + A.tag + '</b>';
}
function selectNode(n) {
  n.visited = true; G.run.floors++;
  updateReach(G.map);
  G.node = n;
  if (n.kind === 'battle') startBattle('normal', n.r);
  else if (n.kind === 'elite') startBattle('elite', n.r);
  else if (n.kind === 'boss') startBattle('boss', n.r);
  else if (n.kind === 'rest') restSite();
  else if (n.kind === 'event') rollEvent();
  else if (n.kind === 'shop') shopScreen();
}
function backToMap() { showMap(); saveGame(); }

/* ============================================================
 * 战斗
 * ============================================================ */
function startBattle(kind, row) {
  setScene('battle');
  G.battleKind = kind;
  G.enemy = makeEnemy(G.act, kind, row);
  G.enemy.hitFlash = 0;
  G.player.hitFlash = 0;
  G.player.shield = 0; G.player.keepShield = false;
  G.draw = shuffleArray(G.deck.map(c => ({ ...c })));
  G.hand = []; G.discard = []; G.exhaust = [];
  G.turn = 1; G.busy = false; G.selCard = -1;
  FX.parts.length = 0; FX.floats.length = 0;
  Sound.setTrack(kind === 'boss' ? 2 : 1);
  Sound.music(true);
  log('遭遇 ' + G.enemy.name);
  updateHud();
  after(420, () => startPlayerTurn(true));
}
function updateHud() {
  const A = ACTS[G.act];
  $('act-label').textContent = '▸ ' + A.name + ' ' + A.depth + '　' + A.tag;
  $('gold-label').textContent = '◆ ' + G.gold + ' 金';
  $('turn-label').textContent = '回合 ' + G.turn;
  $('draw-pile').textContent = '抽 ' + G.draw.length;
  $('discard-pile').textContent = '弃 ' + G.discard.length;
  // 药水
  const pw = $('potions'); pw.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const p = G.potions[i];
    const d = el('div', 'potion' + (p ? '' : ' empty'));
    if (p) {
      const cn = document.createElement('canvas'); cn.width = 24; cn.height = 24;
      const g = cn.getContext('2d'); g.imageSmoothingEnabled = false;
      const s = SPR['p_' + p.icon]; if (s) g.drawImage(s.r[0], 0, 0);
      d.appendChild(cn);
      d.title = p.name + '：' + p.desc;
      d.onclick = () => usePotion(i);
    }
    pw.appendChild(d);
  }
}
function startPlayerTurn(first) {
  if (G.scene !== 'battle') return;
  const p = G.player;
  if (!p.alive) return gameOver(false);
  if (G.enemy && !G.enemy.alive) return winBattle();
  G.phase = 'player';
  if (!first) { G.turn++; }
  // 回合开始
  const dmg = p.tickStatus(p.relicBonus('statusCut'));
  if (dmg > 0) { addFloat(LAY.px, 150, '-' + dmg, '#ef7d57'); Sound.sfx.burn(); }
  if (!p.alive) { after(400, () => gameOver(false)); return; }
  const keep = p.pendingKeep; p.pendingKeep = false;
  p.resetTurn(keep);
  const ts = p.relicBonus('turnShield'); if (ts) p.gainShield(ts);
  const th = p.relicBonus('turnHeal'); if (th) p.heal(th * (p.relicBonus('potionDouble') ? 2 : 1));
  // 被动
  if (p.passive === 'astronautShield' && Math.random() < 0.1) p.gainShield(1);
  const n = 4 + p.relicBonus('extraDraw');
  drawCards(n);
  G.busy = false;
  updateHud(); renderHand();
  Sound.sfx.turn();
  $('turn-label').textContent = '回合 ' + G.turn;
}
function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (!G.draw.length) {
      if (!G.discard.length) break;
      G.draw = shuffleArray(G.discard); G.discard = [];
    }
    G.hand.push(G.draw.pop());
  }
  Sound.sfx.draw();
}
function renderHand() {
  const box = $('hand'); box.innerHTML = '';
  const n = G.hand.length; if (!n) return;
  const CW = 96, GAP = 6, MAXW = 600;
  const totalW = n * CW + (n - 1) * GAP;
  const step = totalW <= MAXW ? CW + GAP : (MAXW - CW) / (n - 1);
  const startX = totalW <= MAXW ? (640 - totalW) / 2 : (640 - MAXW) / 2;
  const y = 244;
  G.hand.forEach((c, i) => {
    const playable = G.phase === 'player' && !G.busy && !c.unplayable && G.player.battery >= c.cost;
    const d = cardEl(c, { playable });
    d.style.left = Math.round(startX + i * step) + 'px';
    d.style.top = y + 'px';
    d.style.zIndex = 10 + i;
    d.dataset.idx = i;
    if (c.unplayable) {
      d.onclick = () => { addFloat(LAY.px, 170, '无法打出', '#8a3cc0'); Sound.sfx.deny(); };
    } else {
      d.onmouseenter = () => { d.style.top = (y - 14) + 'px'; d.style.zIndex = 60; Sound.sfx.hover(); };
      d.onmouseleave = () => { d.style.top = y + 'px'; d.style.zIndex = 10 + i; };
      // 点击出牌；或拖到敌人身上出牌（杀戮尖塔手感）
      d.onpointerdown = ev => {
        if (G.paused || G.phase !== 'player' || G.busy) return;
        const sx = ev.clientX, sy = ev.clientY;
        let dragging = false;
        try { d.setPointerCapture(ev.pointerId); } catch (e) { }
        const move = e2 => {
          const dx = e2.clientX - sx, dy = e2.clientY - sy;
          if (!dragging && Math.hypot(dx, dy) > 10) { dragging = true; d.style.zIndex = 200; d.style.opacity = '0.92'; }
          if (dragging) d.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.08)';
        };
        const up = e2 => {
          d.removeEventListener('pointermove', move);
          d.removeEventListener('pointerup', up);
          d.style.transform = ''; d.style.opacity = '';
          if (dragging) {
            const r = cv.getBoundingClientRect(), sc = r.width / 640;
            const gx = (e2.clientX - r.left) / sc, gy = (e2.clientY - r.top) / sc;
            if (gx > 330 && gy < 250) playCard(i);      // 丢到敌人身上
            else { d.style.top = y + 'px'; d.style.zIndex = 10 + i; }
          } else playCard(i);
        };
        d.addEventListener('pointermove', move);
        d.addEventListener('pointerup', up);
      };
    }
    box.appendChild(d);
  });
}
function playCard(i) {
  if (G.paused || G.phase !== 'player' || G.busy) return;
  const c = G.hand[i]; if (!c) return;
  if (c.unplayable) { addFloat(LAY.px, 170, '无法打出', '#8a3cc0'); Sound.sfx.deny(); return; }
  if (G.player.battery < c.cost) { addFloat(LAY.px, 170, '电量不足', '#566c86'); Sound.sfx.deny(); return; }
  G.busy = true;
  G.player.battery -= c.cost;
  // 职业被动（出牌时）
  if (G.player.passive === 'engineerShield' && c.type === 'shield') G.player.gainShield(2);
  if (G.player.passive === 'assaultCombo' && c.type === 'damage' && Math.random() < 0.15) {
    G.player.battery = Math.min(G.player.maxBattery, G.player.battery + 1);
    addFloat(LAY.px, 150, '+1 电量', '#73eff7');
  }
  G.hand.splice(i, 1);
  Sound.sfx.play();
  applyCard(c);
  updateHud();
  renderHand();
  after(220, () => {
    G.busy = false;
    if (G.enemy && !G.enemy.alive) { winBattle(); return; }
    if (!G.player.alive) { gameOver(false); return; }
    renderHand();
  });
}function applyCard(c) {
  const p = G.player, e = G.enemy;
  const mult = p.relicBonus('potionDouble') ? 2 : 1;
  const boost = p.getStatus('strength') * p.strengthMult;
  let totalDealt = 0;

  // 伤害
  if (c.type === 'damage' && c.value + (c.percentDamage ? 1 : 0) > 0) {
    let per = c.value;
    if (c.shieldFromStrength) { /* 护盾分支处理 */ }
    if (c.percentDamage) per = Math.floor(e.maxHp * c.percentDamage);
    per += boost;
    const hits = c.hits || 1;
    for (let h = 0; h < hits; h++) {
      let dmg = per;
      if (c.pierce) { const before = e.hp; e.hp = Math.max(0, e.hp - dmg); totalDealt += before - e.hp; }
      else { const r = e.takeDamage(dmg); totalDealt += r.toHp; }
      addParts(LAY.ex, LAY.eyBase - 40, 10, c.pierce ? '#e04060' : '#ffcd75', { speed: 170 });
      addFloat(LAY.ex + (Math.random() - 0.5) * 30, LAY.eyBase - 50, '-' + dmg, '#ffcd75');
      if (c.statusEffect && !c.selfTarget) applyStatus(e, c.statusEffect, p.passive === 'mutantStatus' ? 2 : 1);
      Sound.sfx.hit();
      shake(3, 140);
    }
    if (c.pierce) Sound.sfx.beam(); else Sound.sfx.slash();
    beamFx(LAY.px + 30, LAY.pyBase - 40, LAY.ex - 24, LAY.eyBase - 40, c.pierce ? '#e04060' : '#ffcd75');
    e.hitFlash = 160;
  }
  // 护盾
  if (c.type === 'shield' || c.shieldFromStrength) {
    let sh = c.value;
    if (c.shieldFromStrength) sh = p.getStatus('strength') * 2;
    p.gainShield(sh);
    addFloat(LAY.px, 150, '+' + sh + ' 盾', '#73eff7');
    addParts(LAY.px, LAY.pyBase - 34, 12, '#41a6f6', { speed: 120, g: -40 });
    Sound.sfx.shield();
  }
  if (c.retainBlock) { p.pendingKeep = true; }
  if (c.gainThorns) { p.addStatus('thorns', c.gainThorns); addFloat(LAY.px, 165, '反伤+' + c.gainThorns, '#38b764'); }
  // 状态（非伤害牌）
  if (c.statusEffect && c.type !== 'damage') {
    const m = p.passive === 'mutantStatus' ? 2 : 1;
    applyStatus(c.selfTarget ? p : e, c.statusEffect, m);
  }
  if (c.statusEffectAction === 'doubleBurn') {
    e.status.burn *= 2;
    addFloat(LAY.ex, LAY.eyBase - 60, '灼烧 x2', '#ef7d57');
    Sound.sfx.burn();
  }
  if (c.purifySelf) { p.clearDebuffs(); addFloat(LAY.px, 150, '净化', '#73eff7'); Sound.sfx.buff(); }
  if (c.consumeStrength) {
    const k = Math.min(p.getStatus('strength'), c.consumeStrength);
    p.status.strength -= k;
    if (k) addFloat(LAY.px, 165, '-' + k + ' 力量', '#c070f0');
  }
  // 治疗 / 吸血 / 自伤
  if (c.heal) { const g = p.heal(c.heal * mult); addFloat(LAY.px, 140, '+' + g, '#38b764'); Sound.sfx.heal(); }
  if (c.lifesteal && totalDealt > 0) after(200, () => { const g = p.heal(totalDealt * mult); addFloat(LAY.px, 140, '+' + g, '#38b764'); });
  if (c.selfDamage) { p.rawDamage(c.selfDamage); addFloat(LAY.px, 175, '-' + c.selfDamage, '#e04060'); Sound.sfx.hurt(); shake(4, 180); }
  if (c.gainBattery) { p.battery = Math.min(p.maxBattery, p.battery + c.gainBattery); addFloat(LAY.px, 130, '+' + c.gainBattery + ' 电量', '#41a6f6'); }
  if (c.damageTakenBonus) p.damageTakenBonus += c.damageTakenBonus;
  // 抽牌
  if (c.drawCards) drawCards(c.drawCards);
  if (c.conditionalDraw) { drawCards(1); if (G.hand.length <= 3) drawCards(1); }
  // 入堆
  if (c.exhaust) { G.exhaust.push(c); addFloat(LAY.px, 190, '消耗', '#8a3cc0'); }
  else G.discard.push(c);
  // Boss 二阶段
  if (e.alive && e.checkPhase()) {
    addFloat(LAY.ex, LAY.eyBase - 70, e.name, '#ff5577', true);
    addRing(LAY.ex, LAY.eyBase - 45, '#e04060', 8, 80, 480);
    flash('#e04060', 0.34); shake(7, 420); Sound.sfx.nova();
    log(e.name + ' 进入狂暴');
  }
}
// 兼容两种写法：{type:'burn',stacks:2} 与简写 {burn:2}
function applyStatus(target, se, mult) {
  if (!se) return;
  const list = Array.isArray(se) ? se : [se];
  for (const s of list) {
    const type = s.type || Object.keys(s)[0];
    const stacks = s.type ? s.stacks : s[type];
    const info = STATUS_INFO[type];
    if (!info || !stacks) continue;
    const n = stacks * (mult || 1);
    target.addStatus(type, n);
    addFloat(target === G.player ? LAY.px : LAY.ex, (target === G.player ? 150 : LAY.eyBase - 60),
      info.name + '+' + n, info.col);
    Sound.sfx.debuff();
  }
}
function usePotion(i) {
  if (G.paused || G.phase !== 'player' || G.busy) { Sound.sfx.deny(); return; }
  const p = G.potions[i]; if (!p) return;
  const pl = G.player, mult = pl.relicBonus('potionDouble') ? 2 : 1;
  const ef = p.effect;
  if (ef.type === 'heal') { const g = pl.heal(ef.value * mult); addFloat(LAY.px, 140, '+' + g, '#38b764'); Sound.sfx.heal(); }
  else if (ef.type === 'battery') { pl.battery = Math.min(pl.maxBattery, pl.battery + ef.value); addFloat(LAY.px, 130, '+' + ef.value + ' 电量', '#41a6f6'); }
  else if (ef.type === 'shield') { pl.gainShield(ef.value * mult); addFloat(LAY.px, 150, '+' + ef.value * mult + ' 盾', '#73eff7'); Sound.sfx.shield(); }
  else if (ef.type === 'status') { G.enemy.addStatus(ef.status, ef.stacks * mult); Sound.sfx.debuff(); }
  else if (ef.type === 'purify') { pl.clearDebuffs(); addFloat(LAY.px, 150, '净化', '#73eff7'); }
  G.potions.splice(i, 1); G.run.potionsUsed++;
  Sound.sfx.potion();
  updateHud();
}
function endTurn() {
  if (G.paused || G.phase !== 'player' || G.busy) return;
  G.phase = 'enemy'; G.busy = true;
  // 诅咒：回合结束自伤
  let curseDmg = 0;
  G.curseAmp = false;
  for (const c of G.hand) { if (c.endTurnDamage) curseDmg += c.endTurnDamage; if (c.damageAmplify) G.curseAmp = true; }
  if (curseDmg) { G.player.rawDamage(curseDmg); addFloat(LAY.px, 175, '-' + curseDmg, '#8a3cc0'); }
  G.discard.push(...G.hand); G.hand = [];
  renderHand(); updateHud();
  if (!G.player.alive) { after(400, () => gameOver(false)); return; }
  after(520, enemyTurn);
}
function enemyTurn() {
  if (G.scene !== 'battle') return;
  const e = G.enemy, p = G.player;
  if (!e.alive) { winBattle(); return; }
  // 敌人状态结算
  const dmg = e.tickStatus(0);
  if (dmg > 0) { addFloat(LAY.ex, LAY.eyBase - 60, '-' + dmg, '#ef7d57'); Sound.sfx.burn(); }
  if (!e.alive) { after(300, winBattle); return; }
  const act = e.executeTurn();
  Sound.sfx.eturn();
  after(260, () => {
    if (act.type === 'defend') {
      e.gainShield(act.value);
      addFloat(LAY.ex, LAY.eyBase - 55, '+' + act.value + ' 盾', '#41a6f6');
      addParts(LAY.ex, LAY.eyBase - 40, 10, '#41a6f6', { speed: 110, g: -30 });
      Sound.sfx.shield();
    } else if (act.type === 'charge') {
      addFloat(LAY.ex, LAY.eyBase - 60, '蓄能 ' + act.value + '/' + e.chargeTurns, '#c070f0', true);
      addRing(LAY.ex, LAY.eyBase - 45, '#c070f0', 10, 60, 420);
      Sound.sfx.charge();
    } else {
      // 攻击
      let d = act.value + p.damageTakenBonus + e.getStatus('strength');
      if (e.getStatus('weak') > 0) d = Math.floor(d * 0.75);
      // 诅咒增伤（回合结束时手牌里带诅咒则记录）
      if (G.curseAmp) d += 1;
      const r = p.takeDamage(d);
      p.hitFlash = 160;
      addFloat(LAY.px, 150, '-' + r.total, '#e04060', true);
      addParts(LAY.px, LAY.pyBase - 34, 14, '#e04060', { speed: 160 });
      flash('#e04060', 0.22); shake(6, 300);
      Sound.sfx.bighit();
      // 反伤
      const th = p.getStatus('thorns');
      if (th > 0) { e.rawDamage(th); addFloat(LAY.ex, LAY.eyBase - 55, '-' + th, '#38b764'); }
      // 附加状态
      if (act.statuses) applyStatus(p, act.statuses, 1);
      beamFx(LAY.ex - 24, LAY.eyBase - 40, LAY.px + 30, LAY.pyBase - 40, '#e04060');
    }
    updateHud();
    after(480, () => {
      if (!p.alive) return gameOver(false);
      if (!e.alive) return winBattle();
      startPlayerTurn(false);
    });
  });
}
function winBattle() {
  if (G.scene !== 'battle') return;
  const e = G.enemy;
  G.phase = 'none'; G.busy = true;
  addParts(LAY.ex, LAY.eyBase - 45, 30, '#ffcd75', { speed: 210 });
  addRing(LAY.ex, LAY.eyBase - 45, '#ffcd75', 6, 90, 520);
  flash('#ffcd75', 0.3); shake(8, 420);
  Sound.sfx.kill();
  G.run.wins++;
  if (e.elite) G.run.elites++;
  const gold = G.battleKind === 'boss' ? 60 : e.elite ? 35 : 15;
  G.gold += gold; G.run.gold += gold;
  after(620, () => {
    Sound.sfx.coin();
    if (G.battleKind === 'boss') return actCleared();
    // 药水
    if (e.elite || Math.random() < 0.5) {
      if (G.potions.length < 3) { const pt = rollPotion(); G.potions.push(pt); log('获得 ' + pt.name); }
    }
    rewardChoice();
  });
}
function rewardChoice() {
  setScene('reward');
  const opts = [
    { label: '纳入新卡（三选一）', fn: () => pickCards('选择一张卡', rollRewards(3),
        c => { if (c) { G.deck.push(c); log('获得 ' + c.name); } afterReward(); },
        { onCancel: rewardChoice, cancelLabel: '返回' }) },
    { label: '升级一张卡', fn: () => pickFromDeck('升级哪一张', G.deck, c => !c.upgraded && UPGRADES[c.id],
        c => { if (c) { const u = upgradeCard(c); const i = G.deck.findIndex(x => x.uid === c.uid); if (u && i >= 0) G.deck[i] = u; log('升级 ' + u.name); } afterReward(); },
        { onCancel: rewardChoice, cancelLabel: '返回' }) },
    { label: '+25 金币', fn: () => { G.gold += 25; Sound.sfx.coin(); afterReward(); } },
  ];
  if (G.potions.length < 3) opts.push({ label: '获得一瓶药水', fn: () => { const pt = rollPotion(); G.potions.push(pt); log('获得 ' + pt.name); afterReward(); } });
  showModal('战后整理', b => {
    const g = el('div', 'grid');
    opts.forEach(o => { const d = el('div', 'opt', '<div class="on">' + o.label + '</div>'); d.onclick = () => { Sound.sfx.select(); o.fn(); }; g.appendChild(d); });
    b.appendChild(g);
  }, []);
}
function afterReward() { updateHud(); backToMap(); }

/* ============================================================
 * 休整 / 事件 / 商店
 * ============================================================ */
function restSite() {
  setScene('rest');
  const p = G.player, amt = Math.floor(p.maxHp * 0.3);
  showModal('♨ 休整营地', b => {
    b.innerHTML = '<div>气闸闭合，你把面罩摘下来三分钟。</div>';
    const opts = [
      { label: '休眠　恢复 ' + amt + ' 生命', fn: () => { const g = p.heal(amt); log('恢复了 ' + g + ' 生命'); Sound.sfx.heal(); afterNode(); } },
      { label: '锻打　升级一张卡', fn: () => pickFromDeck('升级哪一张', G.deck, c => !c.upgraded && UPGRADES[c.id], c => { if (c) { const u = upgradeCard(c); const i = G.deck.findIndex(x => x.uid === c.uid); if (u && i >= 0) G.deck[i] = u; log('升级 ' + u.name); } afterNode(); }, { onCancel: restSite, cancelLabel: '返回' }) },
    ];
    const g = el('div', 'grid');
    opts.forEach(o => { const d = el('div', 'opt', '<div class="on">' + o.label + '</div>'); d.onclick = () => { Sound.sfx.select(); o.fn(); }; g.appendChild(d); });
    b.appendChild(g);
  }, []);
}
function afterNode() { hideModal(); backToMap(); }

const EVENTS = [
  {
    id: 'supplier', name: '神秘商人', text: '一艘无标识的穿梭艇贴上你的舱门。对方不开舱，只伸出来一只手。',
    opts: [
      { t: '用 15 生命换一件遗物', fn: () => { const r = randomRelic(G.player.relics); if (!r) return Sound.sfx.deny(); G.player.rawDamage(15); G.player.addRelic(r); log('获得遗物 ' + RELICS[r].name); afterNode(); } },
      { t: '不开门', fn: afterNode },
    ],
  },
  {
    id: 'cache', name: '物资缓存', text: '一只被遗弃的补给舱卡在岩壁里，舱门变形但锁芯还亮着。',
    opts: [{ t: '撬开', fn: () => { if (Math.random() < 0.55 && G.potions.length < 3) { const p = rollPotion(); G.potions.push(p); log('获得 ' + p.name); } else { G.gold += 30; log('获得 30 金币'); } afterNode(); } }, { t: '只拿走能量，+10 护盾', fn: () => { G.player.gainShield(10); afterNode(); } }],
  },
  {
    id: 'anomaly', name: '量子异常', text: '前方有一片区域，你的计时器显示它同时是三秒前和三小时后。',
    opts: [{ t: '伸手进去（-8 生命，+3 力量）', fn: () => { G.player.rawDamage(8); G.player.addStatus('strength', 3); afterNode(); } }, { t: '绕开（+5 护盾）', fn: () => { G.player.gainShield(5); afterNode(); } }, { t: '凝视（虚空 +1）', fn: () => { G.run.usedVoid = true; G.run.voidChoices++; G.deck.push(createCurseCard()); G.run.curses++; log('你听见了什么东西'); afterNode(); } }],
  },
  {
    id: 'shrine', name: '古老神殿', text: '有人在石头上刻了一个不属于人类的符号，边缘被摩挲得发亮。',
    opts: [{ t: '献祭（一半概率：药水 / -10 生命）', fn: () => { if (Math.random() < 0.5) { if (G.potions.length < 3) G.potions.push(rollPotion()); } else G.player.rawDamage(10); afterNode(); } }, { t: '祈祷（恢复 20 生命）', fn: () => { G.player.heal(20); afterNode(); } }],
  },
  {
    id: 'altar', name: '血色祭坛', text: '祭坛上的凹槽刚好是一只手掌的形状。它还没干。',
    opts: [{ t: '按上去（-20 生命，+5 力量）', fn: () => { G.player.rawDamage(20); G.player.addStatus('strength', 5); afterNode(); } }, { t: '撬走镶边（-10 生命，+30 金币）', fn: () => { G.player.rawDamage(10); G.gold += 30; afterNode(); } }, { t: '离开', fn: afterNode }],
  },
  {
    id: 'rift', name: '时空裂缝', text: '一道竖直的裂缝悬在真空里，边缘不断掉出不属于这个年代的碎片。',
    opts: [
      { t: '丢弃一张卡，换一件遗物', fn: () => { if (!randomRelic(G.player.relics)) return Sound.sfx.deny();
        pickFromDeck('丢弃哪一张', G.deck, null, c => { if (!c) return showEvent(G.curEvent); const i = G.deck.findIndex(x => x.uid === c.uid); if (i >= 0) G.deck.splice(i, 1); const r = randomRelic(G.player.relics); if (r) G.player.addRelic(r); afterNode(); }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' }); } },
      { t: '抽取能量（-12 生命，电量上限 +1）', fn: () => { G.player.rawDamage(12); G.player.baseBattery++; afterNode(); } },
      { t: '离开', fn: afterNode },
    ],
  },
  {
    id: 'terminal', name: '古老终端', text: '屏幕上滚动着一种早已被淘汰的编码。它认得你。',
    opts: [
      { t: '接入（升级一张卡，但获得诅咒）', fn: () => pickFromDeck('升级哪一张', G.deck, c => !c.upgraded && UPGRADES[c.id], c => {
        if (!c) return showEvent(G.curEvent);           // 取消 = 没接入，不该白吃一张诅咒
        const u = upgradeCard(c); const i = G.deck.findIndex(x => x.uid === c.uid);
        if (u && i >= 0) G.deck[i] = u;
        G.deck.push(createCurseCard()); G.run.curses++;
        log('升级 ' + (u ? u.name : c.name) + '，并带回一张诅咒');
        afterNode();
      }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' }) },
      { t: '拆掉贵金属（+25 金币）', fn: () => { G.gold += 25; afterNode(); } },
      { t: '离开（光明 +1）', fn: () => { G.run.lightChoices++; afterNode(); } },
    ],
  },
  {
    id: 'forge', name: '地下熔炉', text: '一座还在烧的炉子。没人添柴，它自己烧了很久了。',
    opts: [
      { t: '花 15 金币升级一张卡', fn: () => { if (G.gold < 15) return Sound.sfx.deny();
        pickFromDeck('升级哪一张', G.deck, c => !c.upgraded && UPGRADES[c.id], c => {
          if (!c) return showEvent(G.curEvent);         // 取消不该扣钱
          G.gold -= 15; Sound.sfx.coin();
          const u = upgradeCard(c); const i = G.deck.findIndex(x => x.uid === c.uid);
          if (u && i >= 0) G.deck[i] = u;
          log('升级 ' + (u ? u.name : c.name));
          afterNode();
        }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' }); } },
      { t: '烧毁一张诅咒', fn: () => { G.run.usedPurify = true; pickFromDeck('烧毁哪一张', G.deck, c => c.curse, c => { if (!c) return showEvent(G.curEvent); const i = G.deck.indexOf(c); if (i >= 0) G.deck.splice(i, 1); G.run.curses--; afterNode(); }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' }); } },
      { t: '熔掉一张卡（+20 金币）', fn: () => pickFromDeck('熔掉哪一张', G.deck, null, c => { if (!c) return showEvent(G.curEvent); const i = G.deck.findIndex(x => x.uid === c.uid); if (i >= 0) G.deck.splice(i, 1); G.gold += 20; afterNode(); }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' }) },
    ],
  },
  {
    id: 'ghost', name: '游魂低语', text: '通讯频道里有一个人在报数。他报的每一个数字你都见过。',
    opts: [
      { t: '回应（丢弃两张卡，换遗物）', fn: () => pickFromDeck('丢弃第一张', G.deck, null, c1 => {
        if (!c1) return showEvent(G.curEvent);
        const i1 = G.deck.findIndex(x => x.uid === c1.uid); if (i1 >= 0) G.deck.splice(i1, 1);
        pickFromDeck('丢弃第二张', G.deck, null, c2 => {
          if (!c2) return showEvent(G.curEvent);        // 第二张反悔：两张都不丢
          const i2 = G.deck.findIndex(x => x.uid === c2.uid); if (i2 >= 0) G.deck.splice(i2, 1);
          const r = randomRelic(G.player.relics); if (r) G.player.addRelic(r); else G.gold += 40;
          afterNode();
        }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' });
      }, { onCancel: () => showEvent(G.curEvent), cancelLabel: '返回' }) },
      { t: '关闭频道（+8 护盾，光明 +1）', fn: () => { G.player.gainShield(8); G.run.lightChoices++; afterNode(); } },
    ],
  },
  {
    id: 'core', name: '能量核心', text: '一枚还在运转的反应核心，外壳温度高得能烙穿手套。',
    opts: [{ t: '强行超频（电量上限 +2，+5 灼烧）', fn: () => { G.player.baseBattery += 2; G.player.addStatus('burn', 5); afterNode(); } }, { t: '安全取能（电量上限 +1）', fn: () => { G.player.baseBattery++; afterNode(); } }],
  },
];
function rollEvent() {
  setScene('event'); G.run.events++;
  G.curEvent = EVENTS[(Math.random() * EVENTS.length) | 0];
  showEvent(G.curEvent);
}
/** 单独抽出来：子选择器取消时要退回「同一个」异象，不能重抽一个。
    这里同时回写 G.curEvent —— 让「当前异象」这个不变量自己成立，不依赖调用方。 */
function showEvent(ev) {
  G.curEvent = ev;
  showModal('? ' + ev.name, b => {
    b.innerHTML = '<div style="max-width:460px;text-align:center;line-height:16px">' + ev.text + '</div>';
    const g = el('div', 'grid');
    ev.opts.forEach(o => {
      const d = el('div', 'opt', '<div class="on">' + o.t + '</div>');
      d.onclick = () => { Sound.sfx.select(); o.fn(); };
      g.appendChild(d);
    });
    b.appendChild(g);
  }, []);
}

function shopScreen() {
  setScene('shop'); G.run.shops++;
  const cards = rollRewards(3);
  const relics = [];
  for (let i = 0; i < 2; i++) { const r = randomRelic(G.player.relics.concat(relics)); if (r) relics.push(r); }
  const potion = rollPotion();
  const bought = {};
  const PRICE = { card: 50, relic: 120, potion: 40, remove: 75 };
  function render() {
    showModal('$ 补给站　◆ ' + G.gold + ' 金', b => {
      // buy(commit)：commit() 才真正扣钱 + 标记售出 + 重绘。
      // 这样「移除一张卡」这类要先弹选择器的服务，玩家取消时不会白扣钱。
      function cell(inner, key, price, buy) {
        const w = el('div', 'shopcol' + (bought[key] ? ' sold' : ''));
        w.appendChild(inner);
        w.appendChild(el('div', 'price', bought[key] ? '已售出' : '◆ ' + price));
        if (bought[key]) return w;
        w.style.cursor = 'pointer';
        w.onclick = () => {
          if (G.gold < price) return Sound.sfx.deny();
          buy(() => { G.gold -= price; bought[key] = 1; Sound.sfx.coin(); render(); });
        };
        return w;
      }
      const r1 = el('div', 'shoprow');
      cards.forEach((c, i) => {
        const inner = el('div', 'opt sm', '<div class="on">' + c.name + '</div><div class="od">' + (c.desc || '').replace(/\n/g, ' ') + '</div>');
        r1.appendChild(cell(inner, 'c' + i, PRICE.card, commit => { G.deck.push(c); log('购入 ' + c.name); commit(); }));
      });
      b.appendChild(el('div', 'lbl', '卡牌'));
      b.appendChild(r1);
      const r2 = el('div', 'shoprow');
      relics.forEach((id, i) => {
        const r = RELICS[id];
        const inner = el('div', 'opt sm', '<div class="on">' + r.name + '</div><div class="od">' + r.desc + '</div>');
        r2.appendChild(cell(inner, 'r' + i, PRICE.relic, commit => { G.player.addRelic(id); log('购入 ' + r.name); commit(); }));
      });
      { const inner = el('div', 'opt sm', '<div class="on">' + potion.name + '</div><div class="od">' + potion.desc + '</div>');
        r2.appendChild(cell(inner, 'p', PRICE.potion, commit => { if (G.potions.length >= 3) return Sound.sfx.deny(); G.potions.push(potion); log('购入 ' + potion.name); commit(); })); }
      { const inner = el('div', 'opt sm', '<div class="on">移除一张卡</div><div class="od">永久删除</div>');
        r2.appendChild(cell(inner, 'rm', PRICE.remove, commit => {
          pickFromDeck('移除哪一张', G.deck, null, c => {
            if (!c) return render();                       // 反悔：不扣钱，回到货架
            const i = G.deck.findIndex(x => x.uid === c.uid);
            if (i >= 0) G.deck.splice(i, 1);
            log('移除 ' + c.name);
            commit();
          }, { onCancel: render, cancelLabel: '不买了' });
        })); }
      b.appendChild(el('div', 'lbl', '遗物 / 药水 / 服务'));
      b.appendChild(r2);
    }, [{ label: '离开补给站', primary: true, fn: afterNode }]);
  }
  render();
}


/* ============================================================
 * 幕推进 / 结局
 * ============================================================ */
function actCleared() {
  const A = ACTS[G.act];
  Sound.setTrack(0);
  setScene('actclear');   // 收掉战斗 HUD 与手牌，只留幕终面板
  showModal('幕终 · ' + A.name, b => {
    b.innerHTML = '<div style="max-width:460px;text-align:center;line-height:16px">'
      + (G.act >= 2 ? '共振读数归零。梯度消失了。' : '<b>' + ACTS[G.act + 1].name + '</b>　' + ACTS[G.act + 1].depth + '<br>' + ACT_INTRO[G.act + 1].lines.join('<br>'))
      + '</div>';
  }, [{ label: G.act >= 2 ? '结束' : '继续推进', primary: true, fn: () => {
    hideModal();
    if (G.act >= 2) return gameOver(true);
    G.act++; G.run.act = G.act;
    Sound.sfx.warp();
    enterAct(G.act);
  } }]);
}
function gameOver(win) {
  setScene('over');
  Sound.music(false);
  const p = G.player, r = G.run;
  r.curses = G.deck.filter(c => c.curse).length;
  if (win) { Sound.sfx.win(); localStorage.setItem('fc_best', ACTS[2].name + ' 通关'); }
  else Sound.sfx.lose();
  const end = win ? determineEnding({ usedVoid: r.usedVoid, curses: r.curses, voidChoices: r.voidChoices, usedPurify: r.usedPurify, lightChoices: r.lightChoices, hpRatio: p.hp / p.maxHp }) : null;
  $('over-title').textContent = win ? end.title : '强渡失败';
  $('over-title').style.color = win ? end.col : '#ff5577';
  $('over-sub').textContent = win ? end.name : '宇航员倒在了 ' + ACTS[G.act].name;
  $('over-stats').innerHTML = [
    ['乘员', CHARACTERS[r.charId].name], ['推进', r.floors + ' 节点'], ['胜利', r.wins + ' 场'],
    ['精英', r.elites + ' 只'], ['遗物', p.relics.length + ' 件'], ['诅咒', r.curses + ' 张'],
    ['异象', r.events + ' 次'], ['补给', r.shops + ' 次'], ['金币', r.gold + ''],
  ].map(x => '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('');
  $('over-desc').textContent = win ? end.desc : '倒计时没有为你停下。温床还在坠，而这次没有人能替你走完剩下的路。';
  localStorage.removeItem(SAVE_KEY);
}

/* ============================================================
 * 存档
 * ============================================================ */
function saveGame() {
  if (!G.run || G.scene === 'over') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, run: G.run, act: G.act, gold: G.gold,
      hp: G.player.hp, relics: G.player.relics, charId: G.run.charId,
      deck: G.deck.map(c => ({ id: c.id, up: !!c.upgraded })),
      potions: G.potions.map(p => p.id),
      map: G.map.nodes.map(row => row.map(n => ({ r: n.r, c: n.c, kind: n.kind, v: n.visited }))),
      edges: G.map.edges.map(e => [e.a.r, e.a.c, e.b.r, e.b.c]),
    }));
  } catch (e) { }
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s) return false;
    G.run = s.run; G.act = s.act; G.gold = s.gold; G.potions = (s.potions || []).map(id => POTION_DEFS[id]).filter(Boolean);
    G.player = new Player(s.charId); G.player.hp = s.hp; G.player.relics = s.relics || [];
    G.deck = s.deck.map(d => { const c = createCardInstance(CARD_DEFS[d.id]); return d.up ? (upgradeCard(c) || c) : c; });
    G.map = { nodes: s.map.map(row => row.map(n => ({ ...n, reach: false }))), edges: s.edges.map(e => ({ a: null, b: null })) };
    G.map.edges = s.edges.map(([ar, ac, br, bc]) => ({ a: G.map.nodes[ar].find(n => n.c === ac), b: G.map.nodes[br].find(n => n.c === bc) }));
    updateReach(G.map);
    return true;
  } catch (e) { return false; }
}

/* ============================================================
 * 输入
 * ============================================================ */
window.addEventListener('keydown', e => {
  if (G.scene === 'story') return;
  const k = e.key.toLowerCase();
  if (k === 'm') { const m = Sound.toggleMute(); log(m ? '静音' : '声音开'); return; }
  // ESC 先关弹窗；关不掉（强制选择）才继续往下走
  if (k === 'escape' && !$('modal').classList.contains('hidden')) { if (closeModal()) return; }
  if (G.scene === 'title') {
    if (k === 'enter' || k === ' ') { Sound.init(); Sound.music(true); startStory(showCharSel); }
    return;
  }
  if (G.scene === 'battle') {
    if (k === ' ' || k === 'enter') { e.preventDefault(); endTurn(); return; }
    if (k === 'escape' || k === 'p') return togglePause();
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 9) playCard(n - 1);
    return;
  }
  if (k === 'escape') { if (G.scene === 'map') togglePause(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  Sound.init(); Sound.sfx.select();
  if (a === 'start') { Sound.music(true); startStory(showCharSel); }
  else if (a === 'story') startStory(() => setScene('title'));
  else if (a === 'help') setScene('help');
  else if (a === 'title') showTitle();
  else if (a === 'resume') { $('pause').classList.add('hidden'); G.paused = false; }
  else if (a === 'mute') { const m = Sound.toggleMute(); $('btn-mute').textContent = m ? '静音中' : '声音'; }
  else if (a === 'restart') { $('pause').classList.add('hidden'); G.paused = false; showCharSel(); }
  else if (a === 'pause') togglePause();
});
$('btn-end').onclick = () => endTurn();
$('btn-deck').onclick = () => {
  showModal('牌组 · ' + G.deck.length + ' 张', b => {
    const g = el('div', 'grid');
    G.deck.forEach(c => g.appendChild(cardEl(c, {})));
    b.appendChild(g);
  }, [{ label: '关闭', fn: hideModal }], { onClose: hideModal });
};
function togglePause() {
  const box = $('pause');
  if (!box.classList.contains('hidden')) { box.classList.add('hidden'); G.paused = false; return; }
  if (G.scene !== 'battle' && G.scene !== 'map') return;   // 标题/选人/结局不给暂停
  $('pause-stats').textContent = ACTS[G.act].name + '　◆ ' + G.gold + ' 金　牌组 ' + G.deck.length + ' 张';
  $('build').innerHTML = G.player.relics.map(id => '<span class="chip" style="color:' + RELICS[id].col + '">' + RELICS[id].name + '</span>').join('');
  G.paused = true;
  box.classList.remove('hidden');
}
// 无键盘设备才显示触摸暂停键（桌面靠 ESC / P）
function updatePointerMode() {
  document.documentElement.classList.toggle('coarse', matchMedia('(pointer: coarse)').matches);
}


/* ============================================================
 * 主循环
 * ============================================================ */
let lastT = performance.now(), acc = 0;
function loop(t) {
  const dt = Math.min(60, t - lastT); lastT = t;
  stepFx(dt);
  if (G.scene === 'battle' || G.scene === 'map' || G.scene === 'event' || G.scene === 'shop' || G.scene === 'reward' || G.scene === 'rest' || G.scene === 'actclear') {
    drawBattle(G, t, G.scene === 'battle');
    if (G.player) G.player.hitFlash = Math.max(0, (G.player.hitFlash || 0) - dt);
    if (G.enemy) G.enemy.hitFlash = Math.max(0, (G.enemy.hitFlash || 0) - dt);
  } else {
    // 标题/选人：星空底
    ctx.drawImage(skyCanvas(0), 0, 0);
    ctx.globalAlpha = 0.35; px(0, 0, 640, 360, '#05060d'); ctx.globalAlpha = 1;
  }
  if (FX.shakeT > 0) {
    const a = FX.shake * (FX.shakeT / (FX.shakeMax || 260));
    cv.style.transform = 'translate(' + ((Math.random() - 0.5) * a * 6).toFixed(1) + 'px,' + ((Math.random() - 0.5) * a * 6).toFixed(1) + 'px)';
  } else if (cv.style.transform) cv.style.transform = '';
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash; ctx.fillStyle = FX.flashCol; ctx.fillRect(0, 0, 640, 360); ctx.globalAlpha = 1; }
  requestAnimationFrame(loop);
}

/* ============================================================
 * 缩放：把 640x360 的 #wrap 整体缩放到窗口
 * ============================================================ */
function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = Math.min(w / 640, h / 360);
  const wrap = $('wrap');
  wrap.style.transform = 'scale(' + s + ') translate(' + ((w / s - 640) / 2) + 'px,' + ((h / s - 360) / 2) + 'px)';
}
window.addEventListener('resize', () => { fit(); updatePointerMode(); });

/* ============================================================
 * 启动
 * ============================================================ */
/* 调试入口：?auto=1 直进战斗，&act=N 指定幕，&boss=1 打 BOSS，&map=1 看地图 */
const QS = new URLSearchParams(location.search);
function debugJump() {
  const keys = ['auto', 'map', 'fight', 'charsel', 'shop', 'event', 'reward', 'rest', 'over'];
  if (!keys.some(k => QS.get(k))) return false;
  if (QS.get('charsel')) { showCharSel(); return true; }
  if (QS.get('over')) { newRun(QS.get('char') || 'astronaut'); gameOver(QS.get('over') === 'win'); return true; }
  newRun(QS.get('char') || 'astronaut');
  if (QS.get('act')) { G.act = Math.min(2, +QS.get('act')); G.run.act = G.act; G.map = genMap(); }
  if (QS.get('shop')) { shopScreen(); return true; }
  if (QS.get('event')) { rollEvent(); return true; }
  if (QS.get('rest')) { restSite(); return true; }
  if (QS.get('reward')) { G.battleKind = 'normal'; G.enemy = makeEnemy(G.act, 'normal', 0); setScene('reward'); rewardChoice(); return true; }
  if (QS.get('act')) { G.act = Math.min(2, +QS.get('act')); G.run.act = G.act; G.map = genMap(); }
  if (QS.get('map')) { showMap(); return true; }
  startBattle(QS.get('boss') ? 'boss' : QS.get('elite') ? 'elite' : 'normal', +QS.get('row') || 0);
  return true;
}
function boot() {
  if (QS.get('noanim')) $('wrap').classList.add('noanim');
  buildSprites();
  updatePointerMode();
  fit();
  $('loading').classList.add('hidden');
  if (debugJump()) { requestAnimationFrame(loop); return; }
  showTitle();
  if (loadGame()) {
    const b = el('button', 'btn primary', '继续上次的强渡');
    b.onclick = () => { Sound.init(); Sound.music(true); showMap(); };
    $('title').querySelector('.menu').prepend(b);
  }
  requestAnimationFrame(loop);
}
boot();
