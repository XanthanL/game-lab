// 军事系统：陆军（兵种/将领/拆分合并）、移动、战斗、围城。
//
// 战斗结算现在会吃 modifiers：纪律、战斗力、士气、围城能力、要塞防御、
// 地形与将领点数。之前 dice 决定一切，理念点了跟没点一样。

import { clamp, makeRng } from './rng.js';
import { isAtWar, bumpMap, getRelation } from './world.js';
import { blockadeScore } from './navy.js';

/* 兵种比例上限。骑兵占比过高会吃惩罚，炮兵只在围城和中后期有用。 */
export const CAV_RATIO_LIMIT = 0.5;

export function makeComposition(size, cavRatio = 0.25, artRatio = 0.05) {
  size = Math.max(1, Math.floor(size));
  const art = Math.min(size, Math.round(size * clamp(artRatio, 0, 0.5)));
  const cav = Math.min(size - art, Math.round(size * clamp(cavRatio, 0, CAV_RATIO_LIMIT)));
  const inf = size - art - cav;
  return { inf, cav, art };
}

export function compSize(comp) { return (comp?.inf || 0) + (comp?.cav || 0) + (comp?.art || 0); }

export function createArmy(world, tag, pid, size, opts = {}) {
  const c = world.countries.get(tag);
  const p = world.provinces.get(pid);
  if (!c || !p) return null;
  if (p.owner !== tag || p.sea) return null;
  size = Math.floor(size);
  if (size < 1) return null;
  if (c.manpower < size || c.treasury < size * 2) return null;
  c.manpower -= size;
  c.treasury -= size * 2;
  const mods = world.modsFor ? world.modsFor(tag) : null;
  const comp = opts.comp || makeComposition(size, opts.cavRatio ?? 0.25, opts.artRatio ?? 0.05);
  const a = {
    id: world.nextId++, tag, prov: pid, size: compSize(comp), comp,
    morale: 3 + (mods?.landMorale || 0), maxMorale: 3.5,
    movement: null, general: opts.general || null, embarked: null,
    name: opts.name || '',
  };
  c.armies.push(a);
  return a;
}

/** 补员：把现有部队补到目标规模，优先用人力 */
export function reinforce(world, army, addSize) {
  const c = world.countries.get(army.tag);
  if (!c) return 0;
  const want = Math.max(0, Math.floor(addSize));
  const n = Math.min(want, Math.floor(c.manpower), Math.floor(c.treasury / 2));
  if (n < 1) return 0;
  c.manpower -= n;
  c.treasury -= n * 2;
  const inf = Math.round(n * 0.7), cav = Math.round(n * 0.25);
  army.comp.inf += inf;
  army.comp.cav += cav;
  army.comp.art += Math.max(0, n - inf - cav);
  army.size = compSize(army.comp);
  return n;
}

export function disbandArmy(world, army) {
  const c = world.countries.get(army.tag);
  if (!c) return;
  c.armies = c.armies.filter((a) => a.id !== army.id);
  // 解散返还一半人力
  c.manpower = Math.min(c.maxManpower, c.manpower + army.size * 0.5);
}

/** 拆分：按人数比例切出一半 */
export function splitArmy(world, army) {
  if (army.size < 2) return null;
  const c = world.countries.get(army.tag);
  const half = Math.floor(army.size / 2);
  if (half < 1) return null;
  const comp = {
    inf: Math.floor(army.comp.inf / 2),
    cav: Math.floor(army.comp.cav / 2),
    art: Math.floor(army.comp.art / 2),
  };
  army.comp.inf -= comp.inf; army.comp.cav -= comp.cav; army.comp.art -= comp.art;
  army.size -= compSize(comp);
  const b = {
    id: world.nextId++, tag: army.tag, prov: army.prov, size: compSize(comp), comp,
    morale: army.morale, maxMorale: army.maxMorale, movement: null,
    general: null, embarked: army.embarked, name: '',
  };
  c.armies.push(b);
  return b;
}

/** 合并：同省同国（且都没在移动/登船）的两支部队合为一支 */
export function mergeArmies(world, a, b) {
  if (a.tag !== b.tag || a.prov !== b.prov) return false;
  if (a.movement || b.movement || a.embarked || b.embarked) return false;
  const sa = a.size, sb = b.size;
  a.morale = (a.morale * sa + b.morale * sb) / Math.max(1, sa + sb);
  a.comp.inf += b.comp.inf; a.comp.cav += b.comp.cav; a.comp.art += b.comp.art;
  a.size = compSize(a.comp);
  if (b.general && !a.general) a.general = b.general;
  disbandArmy(world, b);
  return true;
}

/* ─────────────── 将领 ─────────────── */

const GEN_NAMES = ['阿尔布雷希特', '加斯东', '皮埃尔', '扬', '汉斯', '里卡多', '杜阿尔特', '斯特凡',
  '安德烈', '米哈伊', '威廉', '罗贝尔', '奥托', '西吉斯蒙德', '雅各布', '恩里克', '鲍里斯', '卡齐米日'];

export function recruitGeneral(world, tag, rng) {
  const c = world.countries.get(tag);
  if (!c) return null;
  if (c.powers.mil < 50) return null;
  if (c.generals.length >= generalLimit(c)) return null;
  if (!rng) rng = makeRng(world.seed + '/gen/' + world.nextId);
  c.powers.mil -= 50;
  // 军事传统高的国家出好将军：传统带来更高的能力上限与加成概率
  const bonus = (c.armyTradition > 40 ? 1 : 0) + (c.armyTradition > 70 ? 1 : 0);
  const g = {
    id: world.nextId++,
    name: rng.pick(GEN_NAMES) + '·' + (c.adj || c.name),
    fire: clamp(rng.int(0, 4) + (rng.chance(c.armyTradition / 150) ? 1 : 0), 0, 4 + bonus),
    shock: clamp(rng.int(0, 4) + (rng.chance(c.armyTradition / 150) ? 1 : 0), 0, 4 + bonus),
    maneuver: rng.int(0, 3), siege: rng.int(0, 3),
  };
  c.generals.push(g);
  return g;
}

export function generalLimit(c) {
  return 1 + Math.floor(c.tech.mil / 8) + (c.ideas && Object.keys(c.ideaGroups || {}).length >= 2 ? 1 : 0);
}

/** 军事传统增减（0..100）。战斗中成长，和平年代生疏。 */
export function addTradition(c, amount) {
  if (!c) return;
  c.armyTradition = clamp((c.armyTradition || 0) + amount, 0, 100);
}

/** 补给上限：省份能养活多少千人。地形、发展度、占领状态共同决定。 */
const SUPPLY_TERRAIN = {
  farmlands: 5, grasslands: 4, coastal: 3, hills: 2, highlands: 2,
  forest: 2, steppe: 1.5, tundra: 1, desert: 0.5, mountains: 0, alpine: 0,
};
export function supplyLimit(world, pid) {
  const p = world.provinces.get(pid);
  if (!p) return 10;
  const dev = p.sea ? 0 : (p.baseTax + p.baseProduction + p.baseManpower);
  let base = 2 + dev * 0.35 + (SUPPLY_TERRAIN[p.terrain] ?? 2);
  const owner = p.owner ? world.countries.get(p.owner) : null;
  const mods = owner && world.modsFor ? world.modsFor(owner.tag) : null;
  base *= 1 + (mods?.supplyLimitMod || 0) / 100;
  if (p.controller && p.owner && p.controller !== p.owner) base *= 0.5;   // 敌占区补给减半
  return Math.max(1, Math.round(base));
}

export function assignGeneral(world, army, generalId) {
  const c = world.countries.get(army.tag);
  const g = c.generals.find((x) => x.id === generalId);
  if (!g) return false;
  // 一个将领只能带一支军队
  for (const a of c.armies) if (a.general === g.id && a.id !== army.id) a.general = null;
  army.general = g.id;
  return true;
}

export function generalOf(world, army) {
  if (!army.general) return null;
  return world.countries.get(army.tag).generals.find((x) => x.id === army.general) || null;
}

/* ─────────────── 移动 ─────────────── */

export function moveArmy(world, army, destId) {
  if (army.embarked) return false;
  const dest = world.provinces.get(destId);
  const cur = world.provinces.get(army.prov);
  if (!dest || !cur.adj.includes(destId)) return false;
  if (dest.sea) return false;
  if (dest.owner !== army.tag && dest.owner && !isAtWar(world, army.tag, dest.owner)) {
    // 中立国只有签了军事通行权才放行（无主地除外）
    const r = getRelation(world, army.tag, dest.owner);
    if (!r.militaryAccess) return false;
  }
  army.movement = { to: destId, progress: 0, speed: 1 };
  return true;
}

export function updateMovement(world) {
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (!a.movement) continue;
      const dest = world.provinces.get(a.movement.to);
      let speed = a.movement.speed;
      if (dest.terrain === 'alpine' || dest.terrain === 'mountains') speed *= 0.5;
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

/* ─────────────── 战斗 ─────────────── */

const TERRAIN_COMBAT = {
  farmlands: { atk: 0, width: 1.0 }, grasslands: { atk: 0, width: 1.0 },
  forest: { atk: -1, width: 0.85 }, mountains: { atk: -2, width: 0.6 },
  alpine: { atk: -2, width: 0.55 }, highlands: { atk: -1, width: 0.8 },
  hills: { atk: -1, width: 0.85 }, desert: { atk: -1, width: 0.9 },
  steppe: { atk: 0, width: 1.1 }, tundra: { atk: -1, width: 0.9 },
};

export function resolveBattles(world, rng) {
  if (!rng) rng = makeRng(world.seed + '/battle/' + world.stats.tick);
  const battles = [];
  const byProv = new Map();
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (a.movement || a.embarked) continue;
      const list = byProv.get(a.prov) || [];
      list.push(a);
      byProv.set(a.prov, list);
    }
  }
  for (const [pid, armies] of byProv) {
    if (armies.length < 2) continue;
    const groups = new Map();
    for (const a of armies) {
      let g = groups.get(a.tag);
      if (!g) groups.set(a.tag, (g = { tag: a.tag, size: 0, morale: 0, armies: [] }));
      g.size += a.size;
      g.morale += a.morale * a.size;
      g.armies.push(a);
    }
    if (groups.size < 2) continue;
    const tags = [...groups.keys()];
    let a = null, b = null;
    outer: for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        if (isAtWar(world, tags[i], tags[j])) { a = tags[i]; b = tags[j]; break outer; }
      }
    }
    if (!a) continue;
    const ga = groups.get(a), gb = groups.get(b);
    ga.morale /= Math.max(1, ga.size); gb.morale /= Math.max(1, gb.size);
    const ca = world.countries.get(a), cb = world.countries.get(b);
    const p = world.provinces.get(pid);
    const terrain = TERRAIN_COMBAT[p.terrain] || TERRAIN_COMBAT.farmlands;

    const da = rollDamage(world, rng, ga, gb, ca, cb, terrain, false);
    const db = rollDamage(world, rng, gb, ga, cb, ca, terrain, true);
    ga.morale -= db.morale; gb.morale -= da.morale;
    ga.size -= db.size; gb.size -= da.size;
    distributeLosses(ga.armies, db.size, db.morale);
    distributeLosses(gb.armies, da.size, da.morale);
    battles.push({ pid, a, b, lossesA: db.size, lossesB: da.size });
    // 实战是唯一的老师：打赢远比打输长传统
    addTradition(ca, 1.5); addTradition(cb, 0.6);

    const war = world.wars.find((w) => w.active &&
      ((w.attackers.has(a) && w.defenders.has(b)) || (w.defenders.has(a) && w.attackers.has(b))));
    const retreat = [];
    if (ga.morale <= 0.4 || ga.size <= 0) retreat.push(ga);
    if (gb.morale <= 0.4 || gb.size <= 0) retreat.push(gb);
    for (const g of retreat) {
      const winner = g === ga ? b : a;
      addTradition(world.countries.get(winner), 1.5);
      if (war) {
        if (winner === war.attacker) war.battlesWonA++; else war.battlesWonD++;
      }
      for (const aa of g.armies) {
        aa.morale = Math.max(0.2, aa.morale - 1.0);
        const pp = world.provinces.get(aa.prov);
        let fallback = null;
        for (const n of pp.adj) {
          const np = world.provinces.get(n);
          if (np.sea) continue;
          if (np.owner === aa.tag || (np.owner && !isAtWar(world, aa.tag, np.owner))) { fallback = n; break; }
        }
        if (fallback) { aa.prov = fallback; aa.movement = null; }
      }
    }
  }
  for (const c of world.countries.values()) {
    c.armies = c.armies.filter((a) => a.size >= 1 && a.morale > 0.05);
  }
  return battles;
}

function groupMods(world, group, c) {
  const mods = world.modsFor ? world.modsFor(c.tag) : null;
  let cav = 0, art = 0;
  for (const a of group.armies) {
    cav += a.comp?.cav || 0;
    art += a.comp?.art || 0;
  }
  const cavRatio = group.size > 0 ? cav / group.size : 0;
  const artRatio = group.size > 0 ? art / group.size : 0;
  return { mods: mods || {}, cavRatio, artRatio };
}

function rollDamage(world, rng, attacker, defender, ca, cb, terrain, isDefenderSide) {
  const A = groupMods(world, attacker, ca);
  const D = groupMods(world, defender, cb);
  const ma = A.mods, md = D.mods;

  const techDiff = ca.tech.mil - cb.tech.mil;
  const general = attacker.armies[0] ? generalOf(world, attacker.armies[0]) : null;
  const dGeneral = defender.armies[0] ? generalOf(world, defender.armies[0]) : null;

  let pip = 0;
  if (general) pip += general.shock * 0.5 + general.fire * 0.3;
  if (dGeneral) pip -= dGeneral.shock * 0.5 + dGeneral.fire * 0.3;

  const disc = 1 + ((ma.discipline || 0) + (ca.prestige * 0.05)) / 100;
  const dDisc = 1 + ((md.discipline || 0) + (cb.prestige * 0.05)) / 100;

  const diceA = rng.int(1, 9), diceD = rng.int(1, 6);
  let mod = 1
    + (diceA - diceD) * 0.12
    + (disc / dDisc - 1) * 0.8
    + (ma.combatAbility || 0) / 200
    - (md.combatAbility || 0) / 200
    + pip * 0.06
    + techDiff * 0.04;

  // 骑兵优势，但比例过高会失序
  mod += A.cavRatio * 0.25;
  if (A.cavRatio > CAV_RATIO_LIMIT + 0.1) mod -= (A.cavRatio - CAV_RATIO_LIMIT) * 0.6;
  // 炮兵在前排（防守方）提供火力
  mod += A.artRatio * 0.3;
  // 地形：进攻方吃惩罚；宽度受限时人多的优势打折
  if (isDefenderSide) mod += Math.abs(terrain.atk) * 0.05;
  else mod += terrain.atk * 0.08;
  const widthPenalty = clamp(terrain.width, 0.5, 1.2);
  const over = attacker.size / Math.max(1, defender.size);
  const effSize = attacker.size * (over > 1 ? 1 - (over - 1) * 0.25 * (1 - widthPenalty) : 1);

  mod = clamp(mod, 0.15, 2.6);
  const base = Math.max(1, effSize) * 0.055 * mod;
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
    const keep = compSize(a.comp);
    if (keep > 0) {
      const k = a.size / keep;
      a.comp.inf = Math.round(a.comp.inf * k);
      a.comp.cav = Math.round(a.comp.cav * k);
      a.comp.art = Math.round(a.comp.art * k);
    }
  }
}

/* ─────────────── 围城 ─────────────── */

export function updateSieges(world, rng) {
  if (!rng) rng = makeRng(world.seed + '/siege/' + world.stats.tick);
  const results = [];
  const byProv = new Map();
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (a.movement || a.embarked) continue;
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
    if (garrison.length) { p.siege = null; continue; }

    const lead = besiegers[0].tag;
    if (!p.siege || p.siege.tag !== lead) p.siege = { progress: 0, tag: lead };
    const strength = besiegers.reduce((s, a) => s + a.size, 0);
    let art = 0;
    for (const a of besiegers) art += a.comp?.art || 0;

    const mods = world.modsFor ? world.modsFor(lead) : null;
    const holderC = world.countries.get(holder);
    const hMods = world.modsFor && holderC ? world.modsFor(holder) : null;
    const gen = generalOf(world, besiegers[0]);
    const fortDef = (hMods?.fortDefense || 0) / 100;
    const siegeAbility = 1 + (mods?.siegeAbility || 0) / 100 + (gen ? gen.siege * 0.12 : 0);

    const need = (30 + p.fort * 18) * (1 + fortDef);
    const roll = rng.int(1, 14);
    const artBonus = Math.min(6, art * 0.25) + Math.min(4, art * 0.1 * p.fort);
    let gain = (roll * 0.5 + artBonus * 0.35 - p.fort * 1.5) * siegeAbility;
    if (rng.chance(Math.max(0, (strength - p.fort * 4) * 0.02))) gain += 10 * siegeAbility;  // 轰开城墙
    // 港口被封锁 → 补给进不来
    if (world.trade?.blockaded?.has(pid)) gain += 2;
    p.siege.progress += Math.max(0, gain);
    if (p.siege.progress >= need) {
      p.controller = lead;
      p.siege = null;
      p.devastation = clamp((p.devastation || 0) + 10, 0, 100);
      bumpMap(world);
      addTradition(world.countries.get(lead), 1.2);
      const holder0 = world.countries.get(holder);
      if (holder0) holder0.warExhaustion = Math.min(20, holder0.warExhaustion + 1.2);
      // 首都陷落：攻守双方的威望与正统都受重创，废墟格外狼藉
      if (p.capital) {
        const attC = world.countries.get(lead);
        if (attC) attC.prestige = clamp(attC.prestige + 5, -100, 100);
        if (holder0) {
          holder0.prestige = clamp(holder0.prestige - 5, -100, 100);
          holder0.legitimacy = clamp(holder0.legitimacy - 5, 0, 100);
        }
        p.devastation = clamp(p.devastation + 15, 0, 100);
        world.log.push(`${p.name} 陷落——${holder0 ? holder0.name : '?'} 的国都易手！`);
      }
      const war = world.wars.find((w) => w.active &&
        (w.attackers.has(lead) || w.defenders.has(lead)) &&
        (w.attackers.has(holder) || w.defenders.has(holder)));
      if (war) war.occupations.set(pid, lead);
      results.push({ pid, tag: lead });
    }
  }
  return results;
}

/* ─────────────── 叛军 ─────────────── */

/**
 * 叛军不与正规军共用一套逻辑：他们不打外交战，只占地、逼宫。
 * 占满 24 个月就强制该国稳定度 −1 后自行解散。
 */
export function resolveRebels(world, rng) {
  if (!rng) rng = makeRng(world.seed + '/rebel/' + world.stats.tick);
  const out = [];
  const byProv = new Map();
  for (const c of world.countries.values()) {
    for (const a of c.armies) {
      if (a.movement || a.embarked) continue;
      const list = byProv.get(a.prov) || [];
      list.push(a);
      byProv.set(a.prov, list);
    }
  }
  for (const r of world.rebels) {
    const p = world.provinces.get(r.prov);
    if (!p) { r.dead = true; continue; }
    const holders = (byProv.get(r.prov) || []).filter((a) => a.tag === (p.controller || p.owner) || a.tag === p.owner);
    if (holders.length) {
      // 野战
      const mine = holders.reduce((s, a) => s + a.size, 0);
      const mod = 1 + rng.range(-0.2, 0.2);
      const loss = Math.max(1, Math.round(r.size * 0.18 * mod));
      const theirLoss = Math.max(1, Math.round(mine * 0.06 * mod));
      r.size -= theirLoss;
      let left = loss;
      for (const a of holders) {
        const take = Math.min(a.size, Math.ceil(left / holders.length));
        a.size -= take; a.morale = Math.max(0.2, a.morale - 0.3);
        const k = a.size / Math.max(1, a.size + take);
        a.comp.inf = Math.round(a.comp.inf * k);
        a.comp.cav = Math.round(a.comp.cav * k);
        a.comp.art = Math.round(a.comp.art * k);
      }
      if (r.size <= 0) { r.dead = true; out.push({ type: 'crushed', pid: r.prov }); }
      continue;
    }
    // 无人防守 → 占领推进
    r.hold += 1;
    if (p.controller !== 'REB' && r.hold >= 3) {
      p.controller = 'REB';
      p.devastation = clamp((p.devastation || 0) + 5, 0, 100);
      bumpMap(world);
      out.push({ type: 'occupied', pid: r.prov });
    }
    if (r.hold >= 24) {
      const c = world.countries.get(r.home);
      if (c) {
        c.stability = Math.max(-3, c.stability - 1);
        world.log.push(`叛军在 ${p.name} 站稳了脚跟，${c.name} 的稳定度下降。`);
      }
      if (p.controller === 'REB') { p.controller = r.home; bumpMap(world); }
      r.dead = true;
      out.push({ type: 'enforced', pid: r.prov });
    }
  }
  if (world.rebels.some((r) => r.dead)) {
    world.rebels = world.rebels.filter((r) => !r.dead);
    for (const c of world.countries.values()) c.armies = c.armies.filter((a) => a.size >= 1);
    bumpMap(world);
  }
  return out;
}

/* ─────────────── 战争分数 ─────────────── */

/** 战争分数 −100..100，正数代表进攻方占优。 */
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
      if (p.controller && war.attackers.has(p.controller)) defOccDev += dev;
    }
    if (p.owner === war.attacker) {
      attDev += dev;
      if (p.controller && war.defenders.has(p.controller)) attOccDev += dev;
    }
  }
  let score = 0;
  if (defDev > 0) score += 70 * (defOccDev / defDev);
  if (attDev > 0) score -= 45 * (attOccDev / attDev);
  score += (war.battlesWonA - war.battlesWonD) * 4;
  score += blockadeScore(world, war);
  if (war.warGoal != null) {
    const wg = world.provinces.get(war.warGoal);
    if (wg && wg.controller && war.attackers.has(wg.controller)) score += 8;
  }
  // 首都的分量：攻陷敌国京城 +10，自家京城被围则 -10
  const defCap = def.capital != null ? world.provinces.get(def.capital) : null;
  if (defCap && defCap.controller && war.attackers.has(defCap.controller)) score += 10;
  const attCap = att.capital != null ? world.provinces.get(att.capital) : null;
  if (attCap && attCap.controller && war.defenders.has(attCap.controller)) score -= 10;
  // 时间站在守方一边：久攻不下，进攻方的分数会缓慢流失
  return clamp(score, -100, 100);
}

/** 估算一份和约要求的战争分数成本 */
export function peaceCost(world, war, winnerSide, demands) {
  const winner = winnerSide === 'attacker' ? war.attacker : war.defender;
  const wc = world.countries.get(winner);
  if (!wc) return Infinity;
  const mods = world.modsFor ? world.modsFor(winner) : null;
  const wsMod = 1 + (mods?.wsCost || 0) / 100;
  let cost = 0;
  for (const pid of demands.provinces || []) {
    const p = world.provinces.get(pid);
    if (!p || p.sea) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    cost += dev * 1.6;
    if (p.capital) cost *= 1.5;
    if (!wc.claims.has(pid) && !wc.cores.has(pid)) cost *= 1.6;   // 无宣称要价翻倍
    else if (wc.claims.has(pid)) cost *= 0.9;
  }
  for (const pid of (demands.revokeCores || [])) {
    const p = world.provinces.get(pid);
    if (p) cost += (p.baseTax + p.baseProduction + p.baseManpower) * 1.0;
  }
  cost += (demands.ducats || 0) * 0.25;
  if (demands.humiliate) cost += 20;
  if (demands.annulTreaties) cost += 10;
  if (demands.warReparations) cost += 15;
  return Math.max(0, cost * clamp(wsMod, 0.6, 1.5));
}
