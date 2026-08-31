// 外交系统：战争、和平、同盟、王婚、宿敌、宣称、侵略扩张
import { clamp } from './rng.js';
import { getRelation, isAtWar, bumpMap } from './world.js';
import { warScore, peaceCost } from './military.js';

export function fabricateClaim(world, tag, pid) {
  const c = world.countries.get(tag);
  const p = world.provinces.get(pid);
  if (!p || p.sea || p.owner === tag) return false;
  // 必须相邻或已有相邻核心
  const hasAdj = [...c.provinces].some((id) => world.provinces.get(id).adj.includes(pid));
  if (!hasAdj) return false;
  const cost = 50;
  if (c.powers.dip < cost) return false;
  c.powers.dip -= cost;
  c.claims.add(pid);
  return true;
}

export function declareWar(world, attackerTag, defenderTag, cbType = 'conquest') {
  if (isAtWar(world, attackerTag, defenderTag)) return false;
  const att = world.countries.get(attackerTag);
  const def = world.countries.get(defenderTag);
  // 召集盟友：防御方还会拉上包围网成员
  const aAllies = [...att.allies].filter((t) => getRelation(world, attackerTag, t).alliance);
  const dAllies = [...def.allies].filter((t) => getRelation(world, defenderTag, t).alliance);
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
    occupations: new Map(), // pid -> tag
    cb: cbType,
    warGoal: null,
  };
  // 战争目标：最近的敌方核心省
  for (const pid of def.provinces) {
    const p = world.provinces.get(pid);
    if (p.sea) continue;
    war.warGoal = pid;
    break;
  }
  world.wars.push(war);
  att.ai.lastWar = world.stats.tick;
  def.ai.lastWar = world.stats.tick;
  world.log.push(coalition.length
    ? `${att.name} 向 ${def.name} 宣战！包围网介入（${coalition.map((t) => world.countries.get(t).name).join('、')}）`
    : `${att.name} 向 ${def.name} 宣战！`);
  return war;
}

export function isAtWarAny(world, tag) {
  return world.wars.some((w) => w.active && (w.attackers.has(tag) || w.defenders.has(tag)));
}

export function whitePeace(world, war) {
  if (!war.active) return false;
  war.active = false;
  setTruce(world, war.attacker, war.defender, 60);
  world.log.push(`${world.countries.get(war.attacker).name} 与 ${world.countries.get(war.defender).name} 缔结白色和约。`);
  return true;
}

export function peaceDeal(world, war, winnerSide, demands) {
  // demands: { provinces:[pid], ducats:number, humiliate:bool }
  if (!war.active) return false;
  const winner = winnerSide === 'attacker' ? war.attacker : war.defender;
  const loser = winnerSide === 'attacker' ? war.defender : war.attacker;
  const wc = world.countries.get(winner), lc = world.countries.get(loser);
  if (!wc || !lc) return false;

  // 战争分数预算：需求不能超过当前战果，且不能超过 100
  const available = winnerSide === 'attacker' ? warScore(world, war) : -warScore(world, war);
  const cost = peaceCost(world, war, winnerSide, demands);
  if (available < 10 || cost > available || cost > 100) return false;

  const taken = [];
  for (const pid of demands.provinces || []) {
    const p = world.provinces.get(pid);
    if (!p || p.sea) continue;
    // 只能割让败方的省份，且须已被胜方占领
    if (p.owner !== loser) continue;
    if (p.controller !== winner && !war.occupations.has(pid)) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    transferProvince(world, pid, winner);
    addAE(world, winner, loser, dev * 0.8);
    taken.push(p.name);
  }
  const ducats = Math.min(demands.ducats || 0, Math.floor(lc.treasury));
  if (ducats) { lc.treasury -= ducats; wc.treasury += ducats; }
  if (demands.humiliate) { lc.prestige -= 20; wc.prestige += 10; }
  if (demands.annulTreaties) {
    for (const t of [...lc.allies]) breakAlliance(world, loser, t);
  }
  // 停战时长随索取规模增加
  const truce = Math.min(180, 36 + Math.round(cost * 0.7));
  war.active = false;
  setTruce(world, winner, loser, truce);
  world.log.push(`${wc.name} 强迫 ${lc.name} 签订和约${taken.length ? `（割让 ${taken.join('、')}）` : ''}。`);
  return true;
}

export function breakAlliance(world, a, b) {
  const r = getRelation(world, a, b);
  r.alliance = false;
  world.countries.get(a).allies.delete(b);
  world.countries.get(b).allies.delete(a);
}

/**
 * 侵略扩张 → 包围网。AE 超过 50 且国家还有实力时，邻国可能组建包围网。
 * 返回本次新加入包围网的国家列表。
 */
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
  // AE 消退后退出包围网
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
  p.owner = newOwner;
  p.controller = newOwner;
  p.cores.add(newOwner);
  p.autonomy = 0.5;
  world.countries.get(newOwner).provinces.add(pid);
  bumpMap(world);
}

export function setTruce(world, a, b, months) {
  const r = getRelation(world, a, b);
  const until = { y: world.date.y, m: world.date.m + months, d: world.date.d };
  if (until.m > 12) { until.m -= 12; until.y++; }
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

export function addAE(world, from, to, amount) {
  if (from === to) return;
  const c = world.countries.get(from);
  c.ae.set(to, (c.ae.get(to) || 0) + amount);
}

export function improveRelations(world, a, b) {
  const r = getRelation(world, a, b);
  r.opinion = clamp(r.opinion + 15, -200, 200);
}

export function formAlliance(world, a, b) {
  const r = getRelation(world, a, b);
  if (r.opinion < 50) return false;
  r.alliance = true;
  world.countries.get(a).allies.add(b);
  world.countries.get(b).allies.add(a);
  return true;
}

export function royalMarriage(world, a, b) {
  const r = getRelation(world, a, b);
  if (r.opinion < 0) return false;
  r.marriage = true;
  world.countries.get(a).marriages.add(b);
  world.countries.get(b).marriages.add(a);
  return true;
}

export function setRival(world, a, b) {
  world.countries.get(a).rivals.add(b);
  const r = getRelation(world, a, b);
  r.opinion -= 50;
}

export function monthlyDiploTick(world) {
  // 关系自然衰减/恢复
  for (const r of world.relations.values()) {
    if (r.opinion > 0) r.opinion = Math.max(0, r.opinion - 0.3);
    if (r.opinion < 0) r.opinion = Math.min(0, r.opinion + 0.2);
  }
  // 侵略扩张缓慢衰减
  for (const c of world.countries.values()) {
    for (const [t, v] of c.ae) {
      if (v > 0) c.ae.set(t, Math.max(0, v - 0.25));
      else c.ae.delete(t);
    }
  }
  // 包围网
  const joined = updateCoalitions(world);
  for (const j of joined) {
    world.log.push(`${world.countries.get(j.member).name} 加入了对 ${world.countries.get(j.against).name} 的包围网。`);
  }
  // 停战到期
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
