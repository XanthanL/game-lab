// AI：经济 / 外交 / 军事决策
import { createArmy, moveArmy, disbandArmy, warScore, peaceCost } from './military.js';
import { declareWar, fabricateClaim, formAlliance, royalMarriage, setRival, peaceDeal, whitePeace, hasTruce, isAtWarAny } from './diplomacy.js';
import { takeTech } from './economy.js';
import { makeRng } from './rng.js';

const GRACE_TICKS = 60; // 开局 15 个月内不主动开战

export function aiTurn(world) {
  const rng = makeRng(world.seed + '/ai/' + world.stats.tick);
  for (const c of world.countries.values()) {
    if (c.tag === world.playerTag) continue;
    if (c.provinces.size === 0) continue;
    try {
      if (isAtWarAny(world, c.tag)) aiWar(world, c, rng);
      else aiPeace(world, c, rng);
      aiTechIdeas(world, c, rng);
    } catch (e) {
      if (world.debug) console.error('[ai]', c.tag, e);
    }
  }
}

/* ---------------- 和平时期 ---------------- */

function aiPeace(world, c, rng) {
  /* 1. 维持常备军规模 */
  const want = Math.max(2, Math.round(c.forceLimit * 0.8));
  const current = c.armies.reduce((s, a) => s + a.size, 0);
  if (current < want && c.manpower > c.maxManpower * 0.25 && c.treasury > 40) {
    const add = Math.min(want - current, Math.floor(c.manpower * 0.6), Math.floor(c.treasury / 3));
    if (add >= 1) createArmy(world, c.tag, c.capital, add);
  } else if (current > want * 1.35 && c.armies.length) {
    const a = c.armies.slice().sort((x, y) => x.size - y.size)[0];
    if (a) disbandArmy(world, a);
  }

  /* 2. 造宣称：优先宿敌/邻国中较弱的 */
  if (world.stats.tick - c.ai.lastClaim > 16 && c.powers.dip > 120) {
    const cand = [];
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      for (const n of p.adj) {
        const np = world.provinces.get(n);
        if (np.sea || np.owner === c.tag || c.claims.has(n) || !np.owner) continue;
        if (hasTruce(world, c.tag, np.owner)) continue;
        const o = world.countries.get(np.owner);
        if (!o || o.provinces.size === 0) continue;
        const w = o.development / Math.max(1, c.development);
        cand.push({ pid: n, score: (c.rivals.has(np.owner) ? 2 : 1) * (1.5 - w) + rng.range(0, 0.5) });
      }
    }
    if (cand.length) {
      cand.sort((a, b) => b.score - a.score);
      if (fabricateClaim(world, c.tag, cand[0].pid)) c.ai.lastClaim = world.stats.tick;
    }
  }

  /* 3. 结盟：同宗教、非宿敌、接壤或邻近的大国 */
  if (c.allies.size < 2 && rng.chance(0.08)) {
    const cand = [...world.countries.values()].filter((o) => {
      if (o.tag === c.tag || o.provinces.size === 0) return false;
      if (c.rivals.has(o.tag) || c.allies.has(o.tag)) return false;
      if (hasTruce(world, c.tag, o.tag)) return false;
      return o.religion === c.religion;
    });
    if (cand.length) {
      const o = rng.pick(cand);
      const r = o.allies.size;
      if (r < 3) {
        formAlliance(world, c.tag, o.tag);
        if (rng.chance(0.5)) royalMarriage(world, c.tag, o.tag);
      }
    }
  }

  /* 4. 宿敌 */
  if (c.rivals.size < 3 && rng.chance(0.04)) {
    const cand = [...world.countries.values()].filter((o) => {
      if (o.tag === c.tag || o.provinces.size === 0) return false;
      if (c.rivals.has(o.tag) || c.allies.has(o.tag)) return false;
      return borders(world, c.tag, o.tag) || o.religion !== c.religion;
    });
    if (cand.length) setRival(world, c.tag, rng.pick(cand).tag);
  }

  /* 5. 宣战 */
  if (world.stats.tick < GRACE_TICKS) return;
  if (world.stats.tick - c.ai.lastWar < 60) return;
  if (c.warExhaustion > 3 || c.manpower < c.maxManpower * 0.35 || c.treasury < 30) return;
  if (current < Math.max(2, want * 0.6)) return;

  const targets = [];
  for (const pid of c.provinces) {
    const p = world.provinces.get(pid);
    for (const n of p.adj) {
      const np = world.provinces.get(n);
      if (np.sea || !np.owner || np.owner === c.tag) continue;
      const o = world.countries.get(np.owner);
      if (!o || o.provinces.size === 0) continue;
      if (hasTruce(world, c.tag, o.tag)) continue;
      // 盟友不宣
      if (c.allies.has(o.tag)) continue;
      const myForce = current + c.manpower * 0.5;
      const hisForce = o.armies.reduce((s, a) => s + a.size, 0) + o.manpower * 0.5;
      // 防御方会拉盟友，估算一下
      const allyForce = [...o.allies].reduce((s, t) => {
        const al = world.countries.get(t);
        return s + (al ? al.armies.reduce((x, a) => x + a.size, 0) * 0.6 : 0);
      }, 0);
      const ratio = myForce / Math.max(1, hisForce + allyForce);
      const ae = c.ae.get(o.tag) || 0;
      let score = ratio;
      if (c.claims.has(n)) score += 0.6;
      if (c.rivals.has(o.tag)) score += 0.3;
      if (o.religion !== c.religion) score += 0.2;
      score -= ae / 100;
      score -= (o.coalition && o.coalition.has(c.tag)) ? 1.5 : 0;
      score += rng.range(-0.15, 0.15);
      targets.push({ tag: o.tag, score });
    }
  }
  if (!targets.length) return;
  targets.sort((a, b) => b.score - a.score);
  const best = targets[0];
  // 门槛：明显占优，或有宣称且略占优
  if (best.score < 1.15) return;
  if (rng.chance(0.25)) {
    declareWar(world, c.tag, best.tag);
    c.ai.lastWar = world.stats.tick;
  }
}

/* ---------------- 战争时期 ---------------- */

function aiWar(world, c, rng) {
  const war = world.wars.find((w) => w.active && (w.attackers.has(c.tag) || w.defenders.has(c.tag)));
  if (!war) return;
  const isAtt = war.attackers.has(c.tag);
  const enemySide = isAtt ? war.defenders : war.attackers;

  /* 1. 军队调度 */
  for (const a of c.armies) {
    if (a.movement) continue;
    const p = world.provinces.get(a.prov);
    // 士气过低 → 撤回本土休整
    if (a.morale < 1.2 && p.owner !== c.tag) {
      const home = nearestOwn(world, c.tag, a.prov);
      if (home != null) { moveArmy(world, a, home); continue; }
    }
    // 守家：本土有敌军则回防
    const threat = homeThreat(world, c);
    if (threat != null && p.owner === c.tag && a.prov !== threat) {
      if (adjacentTo(world, a.prov, threat)) { moveArmy(world, a, threat); continue; }
      const step = pathStep(world, a.prov, threat, c.tag);
      if (step != null) { moveArmy(world, a, step); continue; }
    }
    // 进攻：找相邻的、价值最高的敌方省
    let target = null, best = -Infinity;
    for (const n of p.adj) {
      const np = world.provinces.get(n);
      if (np.sea || !np.controller) continue;
      if (!enemySide.has(np.controller) && !enemySide.has(np.owner)) continue;
      let score = 0;
      if (np.controller !== c.tag) score += 12;
      if (np.capital) score += 25;
      if (np.fort) score -= 6;
      if (np.terrain === 'alpine' || np.terrain === 'desert') score -= 8;
      if (enemyArmyOf(world, n, enemySide)) score -= 14;
      if (p.siege && p.siege.tag === c.tag) score -= 40; // 正在围城，别走
      score += rng.range(-2, 2);
      if (score > best) { best = score; target = n; }
    }
    if (target != null && best > 0) moveArmy(world, a, target);
  }

  /* 2. 媾和判断 */
  const ws = warScore(world, war);
  const mine = isAtt ? ws : -ws;
  const months = monthsBetween(war.start, world.date);

  // 打不动了 / 拖太久 → 白和
  if (months > 36 && Math.abs(ws) < 35 && rng.chance(0.12)) { whitePeace(world, war); return; }
  if (c.warExhaustion > 8 && mine < 40 && rng.chance(0.1)) { whitePeace(world, war); return; }

  if (mine >= 25 && rng.chance(0.28)) {
    const loser = isAtt ? war.defender : war.attacker;
    const demands = buildDemands(world, war, c.tag, loser, mine, isAtt);
    if (demands && peaceCost(world, war, isAtt ? 'attacker' : 'defender', demands) <= mine) {
      peaceDeal(world, war, isAtt ? 'attacker' : 'defender', demands);
    }
  }
}

/** 在战争分数预算内挑最想要的省份 */
function buildDemands(world, war, winner, loser, budget, isAtt) {
  const wc = world.countries.get(winner);
  const side = isAtt ? 'attacker' : 'defender';
  const cand = [];
  for (const p of world.provinces.values()) {
    if (p.sea || p.owner !== loser) continue;
    if (p.controller !== winner && !war.occupations.has(p.id)) continue;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    let v = dev;
    if (wc.claims.has(p.id)) v *= 1.8;
    if (wc.cores.has(p.id)) v *= 2.2; // 收复核心优先
    if (p.capital) v *= 0.35; // 首都贵且招 AE
    cand.push({ pid: p.id, v, dev });
  }
  if (!cand.length) return null;
  cand.sort((a, b) => b.v - a.v);
  const demands = { provinces: [], ducats: 0, humiliate: false };
  let used = 0;
  for (const it of cand) {
    const trial = { ...demands, provinces: [...demands.provinces, it.pid] };
    const cost = peaceCost(world, war, side, trial);
    if (cost > budget) continue;
    demands.provinces.push(it.pid);
    used = cost;
    if (used > budget * 0.85) break;
  }
  if (!demands.provinces.length) {
    // 没占到地也要点钱
    const lc = world.countries.get(loser);
    demands.ducats = Math.min(Math.floor(lc.treasury * 0.5), Math.floor(budget * 2));
    if (demands.ducats < 10) return null;
  }
  return demands;
}

/* ---------------- 科技与理念 ---------------- */

function aiTechIdeas(world, c, rng) {
  const order = c.tag === world.playerTag ? ['adm', 'dip', 'mil'] : ['mil', 'adm', 'dip'];
  // 优先补最落后的分支
  const branches = order.slice().sort((a, b) => c.tech[a] - c.tech[b]);
  const br = branches[0];
  if (rng.chance(0.35)) takeTech(world, c.tag, br);
}

/* ---------------- 工具 ---------------- */

function enemyArmyOf(world, pid, side) {
  for (const c of world.countries.values()) {
    if (!side.has(c.tag)) continue;
    for (const a of c.armies) if (a.prov === pid && !a.movement) return true;
  }
  return false;
}

function homeThreat(world, c) {
  for (const a of world.countries.values()) {
    for (const arm of a.armies) {
      if (arm.movement) continue;
      const p = world.provinces.get(arm.prov);
      if (p && (p.owner === c.tag || p.controller === c.tag)) return arm.prov;
    }
  }
  return null;
}

function nearestOwn(world, tag, from) {
  const start = world.provinces.get(from);
  const seen = new Set([from]);
  const q = [[from, null]];
  while (q.length) {
    const [cur, first] = q.shift();
    const p = world.provinces.get(cur);
    for (const n of p.adj) {
      if (seen.has(n)) continue;
      seen.add(n);
      const np = world.provinces.get(n);
      if (np.sea) continue;
      if (np.owner === tag) return first == null ? n : first;
      q.push([n, first == null ? n : first]);
    }
  }
  return null;
}

/** 单步 BFS：朝目标走一格（只走可通行省） */
function pathStep(world, from, to, tag) {
  if (from === to) return null;
  const prev = new Map([[from, null]]);
  const q = [from];
  let found = false;
  while (q.length && !found) {
    const cur = q.shift();
    const p = world.provinces.get(cur);
    for (const n of p.adj) {
      if (prev.has(n)) continue;
      const np = world.provinces.get(n);
      if (np.sea) continue;
      if (np.owner !== tag && np.controller !== tag && n !== to) continue;
      prev.set(n, cur);
      if (n === to) { found = true; break; }
      q.push(n);
    }
  }
  if (!prev.has(to)) return null;
  let cur = to;
  while (prev.get(cur) !== from && prev.get(cur) != null) cur = prev.get(cur);
  return cur;
}

function adjacentTo(world, a, b) {
  return world.provinces.get(a).adj.includes(b);
}

function borders(world, a, b) {
  const ca = world.countries.get(a);
  for (const pid of ca.provinces) {
    const p = world.provinces.get(pid);
    for (const n of p.adj) {
      const np = world.provinces.get(n);
      if (np && np.owner === b) return true;
    }
  }
  return false;
}

function monthsBetween(a, b) {
  return (b.y - a.y) * 12 + (b.m - a.m);
}
