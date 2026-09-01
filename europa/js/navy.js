// 海军：舰队组建 / 移动 / 海战 / 封锁 / 运兵。
//
// 陆上打仗这套之前是通的，但地图上有 750 个海域却一条船都没有，
// 跨海战争、封锁、运兵这些玩法等于不存在。这里补上。

import { clamp, makeRng } from './rng.js';

export const SHIP_TYPES = {
  heavy: { name: '重舰', cost: 32, power: 3.2, maint: 0.20, sailor: 3 },
  light: { name: '轻舰', cost: 14, power: 1.4, maint: 0.09, sailor: 1 },
  galley: { name: '桨帆船', cost: 9, power: 1.0, maint: 0.05, sailor: 1 },
};

export function fleetSize(f) {
  return (f.ships.heavy || 0) + (f.ships.light || 0) + (f.ships.galley || 0);
}

export function fleetPower(f) {
  return (f.ships.heavy || 0) * SHIP_TYPES.heavy.power
    + (f.ships.light || 0) * SHIP_TYPES.light.power
    + (f.ships.galley || 0) * SHIP_TYPES.galley.power;
}

export function fleetMaint(f) {
  return (f.ships.heavy || 0) * SHIP_TYPES.heavy.maint
    + (f.ships.light || 0) * SHIP_TYPES.light.maint
    + (f.ships.galley || 0) * SHIP_TYPES.galley.maint;
}

export function buildCost(counts) {
  let g = 0;
  for (const k in counts) g += (counts[k] || 0) * SHIP_TYPES[k].cost;
  return g;
}

export function sailorCost(counts) {
  let s = 0;
  for (const k in counts) s += (counts[k] || 0) * SHIP_TYPES[k].sailor;
  return s * 10;
}

export function createFleet(world, tag, seaId, counts) {
  const c = world.countries.get(tag);
  const p = world.provinces.get(seaId);
  if (!c || !p || !p.sea) return null;
  // 必须挨着自家或友邦的港口
  const canLaunch = p.adj.some((n) => {
    const np = world.provinces.get(n);
    return np && !np.sea && np.owner === tag;
  });
  if (!canLaunch) return null;
  const gold = buildCost(counts), sailors = sailorCost(counts);
  if (c.treasury < gold || c.sailors < sailors) return null;
  const n = fleetSize({ ships: counts });
  if (n < 1) return null;
  c.treasury -= gold;
  c.sailors -= sailors;
  const f = {
    id: world.nextId++, tag, prov: seaId,
    ships: { heavy: counts.heavy | 0, light: counts.light | 0, galley: counts.galley | 0 },
    morale: 1, maxMorale: 3, movement: null, name: '',
  };
  c.fleets.push(f);
  return f;
}

export function disbandFleet(world, fleet) {
  const c = world.countries.get(fleet.tag);
  if (!c) return;
  c.fleets = c.fleets.filter((f) => f.id !== fleet.id);
  // 运兵中的部队一并遣散
  for (const a of c.armies) if (a.embarked === fleet.id) a.embarked = null;
}

export function moveFleet(world, fleet, destId) {
  const dest = world.provinces.get(destId);
  const cur = world.provinces.get(fleet.prov);
  if (!dest || !cur.adj.includes(destId)) return false;
  if (!dest.sea) return false;
  fleet.movement = { to: destId, progress: 0 };
  return true;
}

export function updateFleets(world) {
  for (const c of world.countries.values()) {
    for (const f of c.fleets) {
      if (!f.movement) continue;
      f.movement.progress += 0.5;
      if (f.movement.progress >= 1) {
        f.prov = f.movement.to;
        f.movement = null;
        // 跟着船走的部队一起到岸外
        for (const a of c.armies) if (a.embarked === f.id) a.prov = f.prov;
      }
    }
  }
}

/* ─────────────── 运兵 ─────────────── */

export function canEmbark(world, army) {
  if (army.movement || army.embarked) return null;
  const c = world.countries.get(army.tag);
  const p = world.provinces.get(army.prov);
  if (!p || p.sea || !p.coastal) return null;
  for (const f of c.fleets) {
    if (f.movement) continue;
    if (p.adj.includes(f.prov)) return f;
  }
  return null;
}

export function embark(world, army, fleet) {
  if (!fleet || fleet.tag !== army.tag) return false;
  const p = world.provinces.get(army.prov);
  if (!p.adj.includes(fleet.prov)) return false;
  army.embarked = fleet.id;
  army.prov = fleet.prov;   // 船开到哪儿，部队的「位置」就跟到哪儿
  return true;
}

/** 登陆：只能在舰队所在海域相邻的陆地上岸 */
export function landingOptions(world, army) {
  const c = world.countries.get(army.tag);
  const f = c.fleets.find((x) => x.id === army.embarked);
  if (!f || f.movement) return [];
  const out = [];
  for (const n of world.provinces.get(f.prov).adj) {
    const np = world.provinces.get(n);
    if (!np || np.sea) continue;
    out.push(n);
  }
  return out;
}

export function disembark(world, army, destId) {
  const c = world.countries.get(army.tag);
  const f = c.fleets.find((x) => x.id === army.embarked);
  if (!f || f.movement) return false;
  if (!world.provinces.get(f.prov).adj.includes(destId)) return false;
  const dest = world.provinces.get(destId);
  if (!dest || dest.sea) return false;
  const atWar = dest.owner && world.isAtWar(army.tag, dest.owner);
  if (dest.owner !== army.tag && !atWar && dest.owner) return false;   // 中立国不让进
  army.prov = destId;
  army.embarked = null;
  return true;
}

/* ─────────────── 海战 ─────────────── */

export function resolveNavalBattles(world, rng) {
  if (!rng) rng = makeRng(world.seed + '/naval/' + world.stats.tick);
  const out = [];
  const bySea = new Map();
  for (const c of world.countries.values()) {
    for (const f of c.fleets) {
      if (f.movement) continue;
      const list = bySea.get(f.prov) || [];
      list.push(f);
      bySea.set(f.prov, list);
    }
  }
  for (const [sid, fleets] of bySea) {
    if (fleets.length < 2) continue;
    const groups = new Map();
    for (const f of fleets) {
      let g = groups.get(f.tag);
      if (!g) groups.set(f.tag, (g = { tag: f.tag, power: 0, fleets: [] }));
      g.power += fleetPower(f);
      g.fleets.push(f);
    }
    if (groups.size < 2) continue;
    const tags = [...groups.keys()];
    let a = null, b = null;
    outer: for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        if (world.isAtWar(tags[i], tags[j])) { a = tags[i]; b = tags[j]; break outer; }
      }
    }
    if (!a) continue;
    const ga = groups.get(a), gb = groups.get(b);
    const ca = world.countries.get(a), cb = world.countries.get(b);
    const ma = world.modsFor ? world.modsFor(a) : null;
    const mb = world.modsFor ? world.modsFor(b) : null;
    const discA = 1 + ((ma?.discipline || 0) + (ca.prestige * 0.05)) / 100;
    const discB = 1 + ((mb?.discipline || 0) + (cb.prestige * 0.05)) / 100;

    const rollA = rng.int(1, 9) + (ca.monarch.mil || 0) + discA * 2;
    const rollB = rng.int(1, 9) + (cb.monarch.mil || 0) + discB * 2;
    const winner = rollA >= rollB ? a : b;
    const loser = winner === a ? b : a;
    const gw = groups.get(winner), gl = groups.get(loser);
    const ratio = gw.power / Math.max(1, gl.power);
    const lossRatio = clamp(0.10 + 0.30 / (1 + ratio), 0.05, 0.45);

    for (const f of gl.fleets) {
      for (const k in f.ships) f.ships[k] = Math.floor(f.ships[k] * (1 - lossRatio));
      f.morale = Math.max(0.2, f.morale - 1.2);
    }
    for (const f of gw.fleets) {
      for (const k in f.ships) f.ships[k] = Math.floor(f.ships[k] * (1 - lossRatio * 0.35));
      f.morale = Math.max(0.2, f.morale - 0.3);
    }
    out.push({ sid, winner, loser, lossRatio });
  }

  // 打光的舰队清掉
  for (const c of world.countries.values()) {
    c.fleets = c.fleets.filter((f) => fleetSize(f) > 0);
  }
  return out;
}

/* ─────────────── 封锁对战争分数的贡献 ─────────────── */

export function blockadeScore(world, war) {
  const blocked = world.trade?.blockaded;
  if (!blocked || !blocked.size) return 0;
  // blockaded 里只装「被敌国舰队堵住的港口」，而此处敌国必然是交战方，
  // 所以直接按防守方被封港口的发展度占比计分即可。
  let dev = 0, blockedDev = 0;
  for (const p of world.provinces.values()) {
    if (p.sea || p.owner !== war.defender) continue;
    const d = p.baseTax + p.baseProduction + p.baseManpower;
    dev += d;
    if (blocked.has(p.id)) blockedDev += d;
  }
  if (!dev) return 0;
  return clamp(10 * (blockedDev / dev), 0, 10);
}
