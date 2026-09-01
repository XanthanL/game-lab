// 外交：关系动作、战争借口、宣战、和约、侵略扩张与包围网。
//
// 增加了「玩家能做」的那一半：改善关系、送礼、联姻、结盟、宿敌、
// 带战争借口的宣战、以及带战争分数预算的和约谈判面板。
// 无理由宣战要付出稳定度与 AE 的代价——这是 EU4 里最重要的一条约束。

import { clamp } from './rng.js';
import { getRelation, isAtWar, bumpMap } from './world.js';
import { warScore, peaceCost } from './military.js';

export const OPINION_MAX = 200;

/* ─────────────── 友好度系统 ───────────────
   友好度（-200..200）由两部分构成：
   · 静态部分：同盟 / 联姻 / 宿敌 / 禁运 / 交战 / 侵略扩张 / 宗教异同 /
     边境摩擦 / 补贴——随关系状态实时变化，不衰减。
   · 动态部分：带时长的修正条目（礼物、使节、背盟、刚结束的战争…），
     按月衰减，到期移除。
   读写约定：读一律走 opinionOf / opinionBreakdown；
   写要么走状态开关（结盟、禁运…），要么走 addOpinionMod。 */

export function addOpinionMod(world, a, b, id, label, amount, months) {
  const r = getRelation(world, a, b);
  if (!r.mods) r.mods = [];
  const ex = r.mods.find((m) => m.id === id);
  if (ex) { ex.label = label; ex.amount = amount; ex.months = months; }
  else r.mods.push({ id, label, amount, months });
}

export function opinionOf(world, a, b) {
  let s = 0;
  for (const x of opinionBreakdown(world, a, b)) s += x.amount;
  return clamp(s, -OPINION_MAX, OPINION_MAX);
}

/** 友好度分解明细，UI 直接渲染 */
export function opinionBreakdown(world, a, b) {
  const r = getRelation(world, a, b);
  const ca = world.countries.get(a), cb = world.countries.get(b);
  const out = [];
  const add = (label, amount, months = null) => { if (amount) out.push({ label, amount, months }); };
  if (!ca || !cb) return out;
  if (r.alliance) add('同盟', 30);
  if (r.marriage) add('王室联姻', 15);
  if (r.militaryAccess) add('军事通行', 10);
  if (r.guarantee) add('独立保障', 10);
  const mutualRival = ca.rivals.has(b) && cb.rivals.has(a);
  add(mutualRival ? '互相宿敌' : '宿敌', mutualRival ? -60 : (ca.rivals.has(b) || cb.rivals.has(a)) ? -30 : 0);
  for (const t of ca.rivals) {
    if (cb.rivals.has(t)) { add('共同的敌人', 10); break; }
  }
  if (ca.embargoes.has(b) || cb.embargoes.has(a)) add('禁运', -40);
  if (isAtWar(world, a, b)) add('交战中', -80);
  const ae = Math.max(ca.ae.get(b) || 0, cb.ae.get(a) || 0);
  add('侵略扩张', -Math.round(ae / 3));
  add(ca.religion === cb.religion ? '同教之谊' : '宗教相异', ca.religion === cb.religion ? 5 : -10);
  add('边境摩擦', -borderFriction(world, a, b));
  if (ca.subsidiesOut.some((s) => s.to === b) || cb.subsidiesOut.some((s) => s.to === a)) add('补贴', 15);
  for (const m of (r.mods || [])) add(m.label, m.amount, m.months);
  return out;
}

/** 边境摩擦：共享边界每段 -2，封顶 -20。结果按国家对缓存。 */
export function borderFriction(world, a, b) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  if (!world._borderCounts) world._borderCounts = new Map();
  let n = world._borderCounts.get(key);
  if (n == null) {
    n = 0;
    let ca = world.countries.get(a), cb = world.countries.get(b);
    if (ca && cb) {
      if (ca.provinces.size > cb.provinces.size) { const t = ca; ca = cb; cb = t; const t2 = a; a = b; b = t2; }
      for (const pid of ca.provinces) {
        for (const nb of world.provinces.get(pid).adj) {
          if (world.provinces.get(nb).owner === b) n++;
        }
      }
    }
    world._borderCounts.set(key, n);
  }
  return Math.min(20, n * 2);
}

/* ─────────────── 关系动作 ─────────────── */

export function sendGift(world, a, b) {
  const ca = world.countries.get(a);
  const amount = Math.min(ca.treasury, Math.round(50 + ca.development * 0.6));
  if (amount < 20) return { ok: false, why: '国库不足' };
  ca.treasury -= amount;
  addOpinionMod(world, a, b, 'gift', '礼物', 20, 24);
  return { ok: true, amount };
}

export function improveRelations(world, a, b) {
  const ca = world.countries.get(a);
  if (ca.powers.dip < 20) return { ok: false, why: '外交点数不足' };
  const r = getRelation(world, a, b);
  if ((r.mods || []).filter((m) => m.id === 'envoy').length >= 3) {
    return { ok: false, why: '使节好评已达三份上限，等旧的衰减吧' };
  }
  const mods = world.modsFor ? world.modsFor(a) : null;
  ca.powers.dip -= 20;
  const amount = Math.round(15 * (1 + (mods?.improveRelations || 0) / 100));
  addOpinionMod(world, a, b, 'envoy', '友好使节', amount, 24);
  return { ok: true };
}

export function royalMarriage(world, a, b) {
  const r = getRelation(world, a, b);
  if (opinionOf(world, a, b) < 0) return { ok: false, why: '对方态度不佳（需 ≥ 0）' };
  if (r.marriage) return { ok: false, why: '已有王室联姻' };
  r.marriage = true;
  world.countries.get(a).marriages.add(b);
  world.countries.get(b).marriages.add(a);
  return { ok: true };
}

export function formAlliance(world, a, b) {
  const r = getRelation(world, a, b);
  if (r.alliance) return { ok: false, why: '已经结盟' };
  if (opinionOf(world, a, b) < 50) return { ok: false, why: '对方态度不足（需 ≥ 50）' };
  if (world.countries.get(a).rivals.has(b)) return { ok: false, why: '宿敌之间无法结盟' };
  const slots = allianceSlots(world.countries.get(a));
  if (world.countries.get(a).allies.size >= slots) return { ok: false, why: `同盟槽已满（${slots}）` };
  if (world.countries.get(b).allies.size >= allianceSlots(world.countries.get(b))) return { ok: false, why: '对方同盟槽已满' };
  r.alliance = true;
  world.countries.get(a).allies.add(b);
  world.countries.get(b).allies.add(a);
  return { ok: true };
}

export function allianceSlots(c) {
  return 1 + Math.floor(c.tech.dip / 6) + (c.ideas ? Object.keys(c.ideaGroups || {}).length >= 2 ? 1 : 0 : 0);
}

export function breakAlliance(world, a, b) {
  const r = getRelation(world, a, b);
  if (!r.alliance) return { ok: false, why: '并非同盟' };
  r.alliance = false;
  addOpinionMod(world, a, b, 'broken', '背盟毁约', -30, 60);
  world.countries.get(a).allies.delete(b);
  world.countries.get(b).allies.delete(a);
  world.countries.get(a).prestige -= 5;
  return { ok: true };
}

/* ─────────────── 宿敌 ───────────────
   宿敌是宣示性的对抗关系：只允许冲着自己量级相当的国家设
   （体量悬殊的谈不上宿敌），收益是共同的敌人带来好评、羞辱借口、
   以及每月的威望与人力加成（权力投射）。 */

export function canRival(world, a, b) {
  const ca = world.countries.get(a);
  const cb = world.countries.get(b);
  if (!ca || !cb || cb.provinces.size === 0) return { ok: false, why: '国家不存在' };
  if (ca.rivals.has(b)) return { ok: false, why: '已是宿敌' };
  if (ca.rivals.size >= 3) return { ok: false, why: '宿敌最多三个' };
  if (ca.allies.has(b)) return { ok: false, why: '不能把盟友设为宿敌' };
  if (cb.development < ca.development * 0.35 || cb.development > ca.development * 2.5) {
    return { ok: false, why: '体量过于悬殊，不足以成为宿敌' };
  }
  return { ok: true };
}

export function setRival(world, a, b) {
  const chk = canRival(world, a, b);
  if (!chk.ok) return chk;
  world.countries.get(a).rivals.add(b);
  return { ok: true };
}

export function removeRival(world, a, b) {
  const ca = world.countries.get(a);
  if (!ca.rivals.has(b)) return { ok: false, why: '并非宿敌' };
  ca.rivals.delete(b);
  return { ok: true };
}

export function guarantee(world, a, b) {
  const r = getRelation(world, a, b);
  if (r.guarantee) return { ok: false, why: '已在保障' };
  if (r.opinion < 25) return { ok: false, why: '对方态度不足（需 ≥ 25）' };
  r.guarantee = true;
  return { ok: true };
}

export function requestMilitaryAccess(world, a, b) {
  const r = getRelation(world, a, b);
  if (r.militaryAccess) return { ok: false, why: '已获得通行权' };
  if (r.opinion < 10) return { ok: false, why: '对方态度不足（需 ≥ 10）' };
  r.militaryAccess = true;
  return { ok: true };
}

/* ─────────────── 宣称 ─────────────── */

export function claimCost(world, tag) {
  return 50;
}

export function fabricateClaim(world, tag, pid) {
  const c = world.countries.get(tag);
  const p = world.provinces.get(pid);
  if (!p || p.sea || p.owner === tag) return false;
  if (c.claims.has(pid)) return false;
  const hasAdj = [...c.provinces].some((id) => world.provinces.get(id).adj.includes(pid));
  if (!hasAdj) return false;
  const cost = claimCost(world, tag);
  if (c.powers.dip < cost) return false;
  c.powers.dip -= cost;
  c.claims.add(pid);
  return true;
}

/* ─────────────── 战争借口 ─────────────── */

/**
 * 列出对某国可用的开战理由。每种借口决定：AE 倍率、能否割地、稳定度代价。
 */
export function casusBelli(world, attacker, defender) {
  const A = world.countries.get(attacker);
  const D = world.countries.get(defender);
  if (!A || !D) return [];
  const out = [];
  const claimedProvs = [...A.claims].filter((pid) => world.provinces.get(pid)?.owner === defender);
  if (claimedProvs.length) {
    out.push({ id: 'conquest', name: '征服', ae: 1.0, stab: 0, target: claimedProvs[0], desc: `对 ${world.provinces.get(claimedProvs[0]).name} 的宣称` });
  }
  const cores = [...A.cores].filter((pid) => world.provinces.get(pid)?.owner === defender);
  if (cores.length) {
    out.push({ id: 'reconquest', name: '收复核心', ae: 0.25, stab: 0, target: cores[0], desc: `收复 ${world.provinces.get(cores[0]).name}，AE 极低` });
  }
  if (A.religion !== D.religion) {
    out.push({ id: 'religious', name: '宗教战争', ae: 0.75, stab: 0, desc: '异教徒，可割让任意省份' });
  }
  if (A.rivals.has(defender)) {
    out.push({ id: 'humiliate', name: '羞辱宿敌', ae: 0.5, stab: 0, desc: '目标是羞辱而非割地' });
  }
  out.push({ id: 'nocb', name: '无理由宣战', ae: 2.0, stab: -2, desc: '稳定度 −2，侵略扩张翻倍' });
  return out;
}

export function declareWar(world, attackerTag, defenderTag, cbId = 'nocb') {
  if (isAtWar(world, attackerTag, defenderTag)) return null;
  const att = world.countries.get(attackerTag);
  const def = world.countries.get(defenderTag);
  if (!att || !def) return null;

  const cbs = casusBelli(world, attackerTag, defenderTag);
  const cb = cbs.find((c) => c.id === cbId) || cbs.find((c) => c.id === 'nocb');
  if (!cb) return null;
  if (hasTruce(world, attackerTag, defenderTag)) return null;

  // 防御战是盟约义务：被侵略方的盟友全部参战。
  // 进攻战则看忠诚：友好度 ≥ 100 的盟友才会跟着开战，其余的拒绝出兵、关系恶化。
  const aAllies = [], aDeclined = [];
  for (const t of att.allies) {
    if (!getRelation(world, attackerTag, t).alliance || isAtWarAny(world, t)) continue;
    if (opinionOf(world, attackerTag, t) >= 100) aAllies.push(t);
    else {
      aDeclined.push(t);
      addOpinionMod(world, attackerTag, t, 'nojoin', '拒不出兵', -25, 36);
    }
  }
  const dAllies = [...def.allies].filter((t) => getRelation(world, defenderTag, t).alliance && !isAtWarAny(world, t));
  // 被保障的国家会把保障者拉进来
  for (const o of world.countries.values()) {
    const r = getRelation(world, o.tag, defenderTag);
    if (r.guarantee && o.tag !== attackerTag && !dAllies.includes(o.tag) && !isAtWarAny(world, o.tag)) dAllies.push(o.tag);
  }
  const coalition = [];
  for (const o of world.countries.values()) {
    if (o.tag === defenderTag || !o.coalition || !o.coalition.has(attackerTag)) continue;
    if (isAtWarAny(world, o.tag)) continue;
    coalition.push(o.tag);
  }

  const war = {
    id: world.nextId++,
    attacker: attackerTag,
    defender: defenderTag,
    attackers: new Set([attackerTag, ...aAllies]),
    defenders: new Set([defenderTag, ...dAllies, ...coalition]),
    coalition,
    active: true,
    start: { ...world.date },
    battlesWonA: 0, battlesWonD: 0,
    occupations: new Map(),
    cb: cb.id,
    cbName: cb.name,
    aeMult: cb.ae,
    warGoal: cb.target ?? null,
  };
  if (war.warGoal == null) {
    for (const pid of def.provinces) {
      if (!world.provinces.get(pid).sea) { war.warGoal = pid; break; }
    }
  }

  world.wars.push(war);
  att.ai.lastWar = world.stats.tick;
  def.ai.lastWar = world.stats.tick;
  att.stability = clamp(att.stability + (cb.stab || 0), -3, 3);
  if (world.invalidateMods) world.invalidateMods();
  addAE(world, attackerTag, defenderTag, 12 * cb.ae);

  world.log.push(coalition.length
    ? `${att.name} 以「${cb.name}」向 ${def.name} 宣战！包围网介入（${coalition.map((t) => world.countries.get(t).name).join('、')}）`
    : `${att.name} 以「${cb.name}」向 ${def.name} 宣战！`);
  if (aAllies.length) {
    world.log.push(`  参战的盟友：${aAllies.map((t) => world.countries.get(t).name).join('、')}`);
  }
  if (aDeclined.length) {
    world.log.push(`  拒绝出兵的盟友：${aDeclined.map((t) => world.countries.get(t).name).join('、')}`);
  }
  return war;
}

export function isAtWarAny(world, tag) {
  return world.wars.some((w) => w.active && (w.attackers.has(tag) || w.defenders.has(tag)));
}

/* ─────────────── 和约 ─────────────── */

export function whitePeace(world, war) {
  if (!war.active) return false;
  war.active = false;
  setTruce(world, war.attacker, war.defender, 60);
  addOpinionMod(world, war.attacker, war.defender, 'recentwar', '刚结束的战争', -25, 48);
  restoreOccupations(world, war);
  world.log.push(`${world.countries.get(war.attacker).name} 与 ${world.countries.get(war.defender).name} 缔结白色和约。`);
  return true;
}

/** 和约签订后，占领区要还回去（已割让的除外） */
function restoreOccupations(world, war) {
  for (const p of world.provinces.values()) {
    if (p.sea || !p.owner) continue;
    if (p.controller === p.owner) continue;
    const wasOccupied = war.occupations.has(p.id);
    if (!wasOccupied) continue;
    p.controller = p.owner;
  }
  bumpMap(world);
}

/** 谈判桌上能开的条件清单 */
export function peaceOptions(world, war) {
  const out = { provinces: [], cores: [], ducats: 0, canHumiliate: false, canAnnul: false };
  const ws = warScore(world, war);
  const winnerSide = ws > 0 ? 'attacker' : 'defender';
  const winner = winnerSide === 'attacker' ? war.attacker : war.defender;
  const loser = winnerSide === 'attacker' ? war.defender : war.attacker;
  const wc = world.countries.get(winner);
  const lc = world.countries.get(loser);
  if (!wc || !lc) return out;
  for (const p of world.provinces.values()) {
    if (p.sea || p.owner !== loser) continue;
    // 必须实际占领，或者是战争目标
    const occupied = p.controller === winner || war.occupations.has(p.id);
    if (!occupied && p.id !== war.warGoal) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    const claimed = wc.claims.has(p.id);
    const isCore = wc.cores.has(p.id);
    let cost = dev * 1.6;
    if (p.capital) cost *= 1.5;
    if (!claimed && !isCore) cost *= 1.6;
    else if (claimed) cost *= 0.9;
    if (isCore) out.cores.push({ pid: p.id, name: p.name, cost, dev });
    else out.provinces.push({ pid: p.id, name: p.name, cost, dev, claimed });
  }
  out.ducats = Math.floor(lc.treasury * 0.6);
  out.canHumiliate = true;
  out.canAnnul = lc.allies.size > 0;
  out.winner = winner; out.loser = loser; out.winnerSide = winnerSide;
  out.available = Math.abs(ws);
  return out;
}

export function peaceDeal(world, war, winnerSide, demands) {
  if (!war.active) return { ok: false, why: '战争已结束' };
  const winner = winnerSide === 'attacker' ? war.attacker : war.defender;
  const loser = winnerSide === 'attacker' ? war.defender : war.attacker;
  const wc = world.countries.get(winner), lc = world.countries.get(loser);
  if (!wc || !lc) return { ok: false, why: '国家不存在' };

  const ws = warScore(world, war);
  const available = winnerSide === 'attacker' ? ws : -ws;
  const cost = peaceCost(world, war, winnerSide, demands);
  if (available < 10) return { ok: false, why: '战争分数不足，无法提出要求' };
  if (cost > available) return { ok: false, why: `要求超出战争分数（需 ${Math.round(cost)}，现有 ${Math.round(available)}）` };
  if (cost > 100) return { ok: false, why: '要求超出 100 分上限' };

  const taken = [];
  for (const pid of demands.provinces || []) {
    const p = world.provinces.get(pid);
    if (!p || p.sea || p.owner !== loser) continue;
    if (p.controller !== winner && !war.occupations.has(pid) && pid !== war.warGoal) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    transferProvince(world, pid, winner);
    addAE(world, winner, loser, dev * 0.8 * (war.aeMult ?? 1));
    taken.push(p.name);
  }
  const ducats = Math.min(demands.ducats || 0, Math.floor(lc.treasury));
  if (ducats > 0) { lc.treasury -= ducats; wc.treasury += ducats; }
  if (demands.warReparations) {
    const rep = Math.min(Math.round(lc.stats.income * 12 * 0.25), Math.floor(lc.treasury));
    if (rep > 0) { lc.treasury -= rep; wc.treasury += rep; }
  }
  if (demands.humiliate) {
    lc.prestige -= 25; wc.prestige += 15;
    addAE(world, winner, loser, 8 * (war.aeMult ?? 1));
  }
  if (demands.annulTreaties) {
    for (const t of [...lc.allies]) breakAlliance(world, loser, t);
  }

  const truce = Math.min(180, 36 + Math.round(cost * 0.7));
  war.active = false;
  restoreOccupations(world, war);
  setTruce(world, winner, loser, truce);
  addOpinionMod(world, war.attacker, war.defender, 'recentwar', '刚结束的战争', -25, 48);
  world.log.push(`${wc.name} 强迫 ${lc.name} 签订和约${taken.length ? `（割让 ${taken.join('、')}）` : ''}。`);
  return { ok: true, taken, cost };
}

/* ─────────────── 侵略扩张 / 包围网 ─────────────── */

export function updateCoalitions(world) {
  const joined = [];
  for (const c of world.countries.values()) {
    if (c.provinces.size === 0) continue;
    for (const [other, amount] of c.ae) {
      if (amount < 50) continue;
      const o = world.countries.get(other);
      if (!o || o.provinces.size === 0) continue;
      const r = getRelation(world, c.tag, other);
      if (r.alliance || r.truce) continue;
      if (!o.coalition) o.coalition = new Set();
      if (!o.coalition.has(c.tag)) {
        o.coalition.add(c.tag);
        joined.push({ member: other, against: c.tag });
      }
    }
  }
  for (const o of world.countries.values()) {
    if (!o.coalition) continue;
    for (const t of [...o.coalition]) {
      const src = world.countries.get(t);
      if (!src || (src.ae.get(o.tag) || 0) < 30) o.coalition.delete(t);
    }
  }
  return joined;
}

export function transferProvince(world, pid, newOwner) {
  const p = world.provinces.get(pid);
  const old = world.countries.get(p.owner);
  if (old) old.provinces.delete(pid);
  // 首都陷落：旧主把朝廷迁到剩下的最富庶省份，威望与正统大跌
  if (old && old.capital === pid) {
    old.capital = null;
    const candidates = [...old.provinces].map((id) => world.provinces.get(id))
      .filter((q) => q && !q.sea && q.owner === old.tag)
      .sort((a, b) => (b.baseTax + b.baseProduction + b.baseManpower) - (a.baseTax + a.baseProduction + a.baseManpower));
    if (candidates.length) {
      const nc = candidates[0];
      old.capital = nc.id;
      nc.capital = true;
      nc.fort = Math.max(nc.fort, 2);
      world.log.push(`${old.name} 的首都陷落，朝廷迁往 ${nc.name}。`);
    }
    old.prestige = clamp(old.prestige - 25, -100, 100);
    old.legitimacy = clamp(old.legitimacy - 15, 0, 100);
  }
  p.owner = newOwner;
  p.controller = newOwner;
  p.capital = false;
  p.cores.add(newOwner);
  p.autonomy = 0.5;
  p.siege = null;
  world.countries.get(newOwner).provinces.add(pid);
  if (world._borderCounts) world._borderCounts = null;   // 边境摩擦缓存失效
  bumpMap(world);
}

export function setTruce(world, a, b, months) {
  const r = getRelation(world, a, b);
  const until = { y: world.date.y, m: world.date.m + months, d: world.date.d };
  while (until.m > 12) { until.m -= 12; until.y++; }
  r.truce = until;
  world.countries.get(a).truces.set(b, until);
  world.countries.get(b).truces.set(a, until);
}

export function hasTruce(world, a, b) {
  const r = getRelation(world, a, b);
  if (!r.truce) return false;
  const t = r.truce, d = world.date;
  if (t.y > d.y) return true;
  if (t.y < d.y) return false;
  return t.m > d.m;
}

export function truceMonthsLeft(world, a, b) {
  const r = getRelation(world, a, b);
  if (!r.truce) return 0;
  const d = world.date;
  const months = (r.truce.y - d.y) * 12 + (r.truce.m - d.m);
  return Math.max(0, months);
}

export function addAE(world, from, to, amount) {
  if (from === to) return;
  const c = world.countries.get(from);
  const mods = world.modsFor ? world.modsFor(from) : null;
  const mult = clamp(1 + (mods?.aeImpact || 0) / 100, 0.25, 2.5);
  const v = (c.ae.get(to) || 0) + amount * mult;
  c.ae.set(to, v);
  // 邻国看着也会不舒服
  for (const t of neighboursOf(world, to)) {
    if (t === from || t === to) continue;
    c.ae.set(t, (c.ae.get(t) || 0) + amount * mult * 0.35);
  }
}

function neighboursOf(world, tag) {
  const out = new Set();
  const c = world.countries.get(tag);
  if (!c) return out;
  for (const pid of c.provinces) {
    for (const n of world.provinces.get(pid).adj) {
      const np = world.provinces.get(n);
      if (np && np.owner && np.owner !== tag) out.add(np.owner);
    }
  }
  return out;
}

export function monthlyDiploTick(world) {
  // 带时长的友好度修正按月衰减
  for (const r of world.relations.values()) {
    if (!r.mods || !r.mods.length) continue;
    for (const m of r.mods) m.months--;
    r.mods = r.mods.filter((m) => m.months > 0);
  }
  for (const c of world.countries.values()) {
    for (const [t, v] of c.ae) {
      if (v > 0) c.ae.set(t, Math.max(0, v - 0.25));
      else c.ae.delete(t);
    }
  }
  const joined = updateCoalitions(world);
  for (const j of joined) {
    world.log.push(`${world.countries.get(j.member).name} 加入了对 ${world.countries.get(j.against).name} 的包围网。`);
  }
  for (const c of world.countries.values()) {
    for (const [t, until] of [...c.truces]) {
      const d = world.date;
      if (until.y < d.y || (until.y === d.y && until.m <= d.m)) {
        c.truces.delete(t);
        const r = getRelation(world, c.tag, t);
        if (r.truce && (r.truce.y < d.y || (r.truce.y === d.y && r.truce.m <= d.m))) r.truce = null;
      }
    }
  }
}
