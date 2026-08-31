// 军事系统：陆军/海军、移动、战斗、围城
import { clamp, makeRng } from './rng.js';
import { isAtWar, getRelation } from './world.js';

export function createArmy(world, tag, pid, size) {
  const c = world.countries.get(tag);
  const p = world.provinces.get(pid);
  if (!c || !p) return null;
  if (p.owner !== tag || p.sea) return null;
  size = Math.floor(size);
  if (size < 1) return null;
  if (c.manpower < size || c.treasury < size * 2) return null;
  c.manpower -= size;
  c.treasury -= size * 2;
  const a = {
    id: world.nextId++, tag, prov: pid, size,
    morale: 3 + c.tech.mil * 0.15, maxMorale: 3.5,
    movement: null, general: null,
  };
  c.armies.push(a);
  return a;
}

export function disbandArmy(world, army) {
  const c = world.countries.get(army.tag);
  c.armies = c.armies.filter((a) => a.id !== army.id);
}

export function moveArmy(world, army, destId) {
  const dest = world.provinces.get(destId);
  const cur = world.provinces.get(army.prov);
  if (!dest || !cur.adj.includes(destId)) return false;
  if (dest.sea) return false;
  if (dest.owner !== army.tag && !isAtWar(world, army.tag, dest.owner)) return false;
  army.movement = { to: destId, progress: 0, speed: 1 };
  return true;
}

export function updateMovement(world) {
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (!a.movement) continue;
      const dest = world.provinces.get(a.movement.to);
      let speed = a.movement.speed;
      if (dest.terrain === 'alpine') speed *= 0.5;
      if (dest.terrain === 'desert') speed *= 0.7;
      if (dest.terrain === 'forest') speed *= 0.85;
      a.movement.progress += speed;
      if (a.movement.progress >= 1) {
        a.prov = a.movement.to;
        a.movement = null;
      }
    }
  }
}

export function resolveBattles(world, rng) {
  if (!rng) rng = makeRng(world.seed + '/battle/' + world.stats.tick);
  const battles = [];
  // 按省份分组
  const byProv = new Map();
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (a.movement) continue;
      const list = byProv.get(a.prov) || [];
      list.push(a);
      byProv.set(a.prov, list);
    }
  }
  for (const [pid, armies] of byProv) {
    if (armies.length < 2) continue;
    const groups = new Map();
    for (const a of armies) {
      const key = a.tag;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { tag: key, size: 0, morale: 0, armies: [] }));
      g.size += a.size;
      g.morale += a.morale * a.size;
      g.armies.push(a);
    }
    if (groups.size < 2) continue;
    // 找出一对真正交战的国家
    const tags = [...groups.keys()];
    let a = null, b = null;
    outer: for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        if (isAtWar(world, tags[i], tags[j])) { a = tags[i]; b = tags[j]; break outer; }
      }
    }
    if (!a) continue;
    const ga = groups.get(a), gb = groups.get(b);
    ga.morale /= ga.size; gb.morale /= gb.size;
    const ca = world.countries.get(a), cb = world.countries.get(b);
    const da = rollDamage(rng, ga, gb, ca, cb);
    const db = rollDamage(rng, gb, ga, cb, ca);
    ga.morale -= db.morale; gb.morale -= da.morale;
    ga.size -= db.size; gb.size -= da.size;
    // 分摊到各军
    distributeLosses(ga.armies, db.size, db.morale);
    distributeLosses(gb.armies, da.size, da.morale);
    battles.push({ pid, a, b, lossesA: db.size, lossesB: da.size });

    // 撤退判定：士气崩溃的一方退出战场
    const war = world.wars.find((w) => w.active &&
      ((w.attackers.has(a) && w.defenders.has(b)) || (w.defenders.has(a) && w.attackers.has(b))));
    const retreat = [];
    if (ga.morale <= 0.4 || ga.size <= 0) retreat.push(ga);
    if (gb.morale <= 0.4 || gb.size <= 0) retreat.push(gb);
    for (const g of retreat) {
      const winner = g === ga ? b : a;
      if (war) {
        if (winner === war.attacker) war.battlesWonA++; else war.battlesWonD++;
      }
      for (const aa of g.armies) {
        aa.morale = Math.max(0.2, aa.morale - 1.0);
        // 撤退到相邻的己方或友方省
        const p = world.provinces.get(aa.prov);
        let fallback = null;
        for (const n of p.adj) {
          const np = world.provinces.get(n);
          if (np.sea) continue;
          if (np.owner === aa.tag || (np.owner && !isAtWar(world, aa.tag, np.owner))) { fallback = n; break; }
        }
        if (fallback) { aa.prov = fallback; aa.movement = null; }
      }
    }
  }
  // 清理被彻底打光的军团
  for (const c of world.countries.values()) {
    c.armies = c.armies.filter((a) => a.size >= 1 && a.morale > 0.05);
  }
  return battles;
}

function rollDamage(rng, attacker, defender, ca, cb) {
  const techDiff = ca.tech.mil - cb.tech.mil;
  const disc = 1 + (ca.prestige + ca.legitimacy * 0.1) * 0.002 + techDiff * 0.04;
  const diceA = rng.int(1, 9), diceD = rng.int(1, 6);
  const terrainMod = 1; // 地形修正留给后续
  const mod = clamp(1 + (diceA - diceD) * 0.12 + (disc - 1), 0.15, 2.5) * terrainMod;
  const base = attacker.size * 0.055 * mod;
  return {
    morale: base * (0.30 + rng.range(-0.04, 0.04)),
    size: base * (0.22 + rng.range(-0.04, 0.04)),
  };
}

function distributeLosses(armies, sizeLoss, moraleLoss) {
  const total = armies.reduce((s, a) => s + a.size, 0);
  if (total <= 0) return;
  for (const a of armies) {
    const ratio = a.size / total;
    a.size = Math.max(0, a.size - sizeLoss * ratio);
    a.morale = Math.max(0, a.morale - moraleLoss * ratio);
  }
}

export function updateSieges(world, rng) {
  if (!rng) rng = makeRng(world.seed + '/siege/' + world.stats.tick);
  const results = [];
  // 省份 → 所有驻军
  const byProv = new Map();
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (a.movement) continue;
      const p = world.provinces.get(a.prov);
      if (!p || p.sea) continue;
      const list = byProv.get(a.prov) || [];
      list.push(a);
      byProv.set(a.prov, list);
    }
  }
  for (const [pid, armies] of byProv) {
    const p = world.provinces.get(pid);
    const holder = p.controller || p.owner;
    if (!holder) continue;
    const garrison = armies.filter((a) => a.tag === holder || a.tag === p.owner);
    const besiegers = armies.filter((a) => a.tag !== holder && isAtWar(world, a.tag, holder));
    if (!besiegers.length) { p.siege = null; continue; }
    // 守军在场 → 先打野战，不推进围城
    if (garrison.length) { p.siege = null; continue; }

    const lead = besiegers[0].tag;
    if (!p.siege || p.siege.tag !== lead) p.siege = { progress: 0, tag: lead };
    const strength = besiegers.reduce((s, a) => s + a.size, 0);
    const need = 30 + p.fort * 18;
    const roll = rng.int(1, 14);
    const art = Math.min(6, strength * 0.25);
    let gain = roll * 0.5 + art * 0.35 - p.fort * 1.5;
    if (rng.chance(Math.max(0, (strength - p.fort * 4) * 0.02))) gain += 10; // 轰开城墙
    p.siege.progress += Math.max(0, gain);
    if (p.siege.progress >= need) {
      p.controller = lead;
      p.siege = null;
      const holder0 = world.countries.get(holder);
      if (holder0) holder0.warExhaustion = Math.min(20, holder0.warExhaustion + 1.2);
      const war = world.wars.find((w) => w.active &&
        (w.attackers.has(lead) || w.defenders.has(lead)) &&
        (w.attackers.has(holder) || w.defenders.has(holder)));
      if (war) war.occupations.set(pid, lead);
      results.push({ pid, tag: lead });
    }
  }
  return results;
}

/**
 * 战争分数 −100..100，正数代表进攻方占优。
 * 主要来自：占领敌方省份的发展度比例 + 战斗胜负 + 战争目标。
 */
export function warScore(world, war) {
  const att = world.countries.get(war.attacker);
  const def = world.countries.get(war.defender);
  if (!att || !def) return 0;
  let defDev = 0, attDev = 0;
  let defOccDev = 0, attOccDev = 0;
  for (const p of world.provinces.values()) {
    if (p.sea) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    if (p.owner === war.defender) {
      defDev += dev;
      if (war.attackers.has(p.controller)) defOccDev += dev;
    }
    if (p.owner === war.attacker) {
      attDev += dev;
      if (war.defenders.has(p.controller)) attOccDev += dev;
    }
  }
  let score = 0;
  if (defDev > 0) score += 70 * (defOccDev / defDev);
  if (attDev > 0) score -= 45 * (attOccDev / attDev);
  score += (war.battlesWonA - war.battlesWonD) * 4;
  if (war.warGoal != null) {
    const wg = world.provinces.get(war.warGoal);
    if (wg && war.attackers.has(wg.controller)) score += 8;
  }
  return clamp(score, -100, 100);
}

/** 估算一份和约要求的战争分数成本 */
export function peaceCost(world, war, winnerSide, demands) {
  const winner = winnerSide === 'attacker' ? war.attacker : war.defender;
  const loser = winnerSide === 'attacker' ? war.defender : war.attacker;
  let cost = 0;
  for (const pid of demands.provinces || []) {
    const p = world.provinces.get(pid);
    if (!p || p.sea) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    cost += dev * 1.6;
    if (p.capital) cost *= 1.5;
    if (!world.countries.get(winner).claims.has(pid)) cost *= 1.6; // 无宣称要价翻倍
  }
  for (const pid of (demands.revokeCores || [])) {
    const p = world.provinces.get(pid);
    if (p) cost += (p.baseTax + p.baseProduction + p.baseManpower) * 1.0;
  }
  cost += (demands.ducats || 0) * 0.25;
  if (demands.humiliate) cost += 20;
  if (demands.annulTreaties) cost += 10;
  return cost;
}
