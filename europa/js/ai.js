// AI：经济 / 内政 / 外交 / 军事决策。
//
// AI 现在会做以前没做的事：点理念、造建筑、造舰队、用正确的战争借口开战、
// 在战争分数合适时带着具体条件去谈判。之前它只会造兵和随机宣战。

import {
  createArmy, moveArmy, disbandArmy, warScore, peaceCost,
  recruitGeneral, assignGeneral,
} from './military.js';
import {
  declareWar, fabricateClaim, formAlliance, royalMarriage, setRival,
  peaceDeal, whitePeace, hasTruce, isAtWarAny, casusBelli, peaceOptions,
  improveRelations, opinionOf, breakAlliance,
} from './diplomacy.js';
import { takeTech, buildBuilding, raiseStability, reduceWarExhaustion, coreProvince, developProvince, foundNationalBank } from './economy.js';
import { takeIdea, IDEA_GROUPS, canTakeIdea, POLICIES, policySlots, policyAvailable, togglePolicy } from './ideas.js';
import { grantPrivilege, seizeLand, sellTitles, PRIVILEGES, PRIV_BY_ID } from './estates.js';
import { setEmbargo } from './trade.js';
import { createFleet } from './navy.js';
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
      aiDomestic(world, c, rng);
      aiTechIdeas(world, c, rng);
    } catch (e) {
      if (world.debug) console.error('[ai]', c.tag, e);
    }
  }
}

/* ---------------- 和平时期 ---------------- */

function aiPeace(world, c, rng) {
  /* 1. 常备军规模 */
  // 有钱就把军队拉满，钱紧就缩编——不然 AI 的国库会一路涨到四位数
  const ratio = c.treasury > 400 ? 1.0 : c.treasury > 120 ? 0.8 : 0.5;
  const want = Math.max(2, Math.round(c.forceLimit * ratio));
  const current = c.armies.reduce((s, a) => s + a.size, 0);
  if (current < want && c.manpower > c.maxManpower * 0.25 && c.treasury > 40) {
    const add = Math.min(want - current, Math.floor(c.manpower * 0.6), Math.floor(c.treasury / 3));
    if (add >= 1) createArmy(world, c.tag, c.capital, add);
  } else if (current > want * 1.35 && c.armies.length) {
    const a = c.armies.slice().sort((x, y) => x.size - y.size)[0];
    if (a) disbandArmy(world, a);
  }

  /* 2. 造宣称 */
  if (world.stats.tick - c.ai.lastClaim > 16 && c.powers.dip > 140) {
    const cand = [];
    for (const pid of c.provinces) {
      for (const n of world.provinces.get(pid).adj) {
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

  /* 3. 结盟：先派使节示好，态度攒够了再提结盟与联姻 */
  if (c.allies.size < 2) {
    const cand = [...world.countries.values()].filter((o) => {
      if (o.tag === c.tag || o.provinces.size === 0) return false;
      if (c.rivals.has(o.tag) || c.allies.has(o.tag)) return false;
      if (hasTruce(world, c.tag, o.tag)) return false;
      return o.religion === c.religion;
    });
    if (cand.length) {
      const o = rng.pick(cand);
      const op = opinionOf(world, c.tag, o.tag);
      if (op < 50 && c.powers.dip > 100 && rng.chance(0.5)) {
        improveRelations(world, c.tag, o.tag);
      } else if (op >= 50 && o.allies.size < 3 && rng.chance(0.3)) {
        const rr = formAlliance(world, c.tag, o.tag);
        if (rr.ok && rng.chance(0.5)) royalMarriage(world, c.tag, o.tag);
      }
    }
  }

  /* 3.5 同盟维护：关系烂到谷底的盟约不如趁早体面散场 */
  if (c.allies.size && rng.chance(0.03)) {
    for (const t of c.allies) {
      if (opinionOf(world, c.tag, t) < -20) { breakAlliance(world, c.tag, t); break; }
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

  /* 5. 补贴：有收入盈余的大国资助打仗的小盟友，既买好感也保住同盟 */
  if (c.stats.income > 9 && c.treasury > 80 && rng.chance(0.15)) {
    const ally = [...c.allies].map((t) => world.countries.get(t))
      .find((o) => o && o.provinces.size > 0 && isAtWarAny(world, o.tag)
        && !c.subsidiesOut.some((s) => s.to === o.tag));
    if (ally && ally.development < c.development) {
      const amount = Math.max(2, Math.min(4, Math.round(c.stats.income * 0.08)));
      c.subsidiesOut.push({ to: ally.tag, amount, months: 24 });
    }
  }

  /* 6. 禁运宿敌：关系已经烂了，不如在商路上再踩一脚 */
  if (c.rivals.size && rng.chance(0.02)) {
    const t = [...c.rivals].find((x) => {
      const o = world.countries.get(x);
      return o && o.provinces.size > 0 && !c.embargoes.has(x);
    });
    if (t) setEmbargo(world, c.tag, t);
  }

  /* 5. 宣战 */
  if (world.stats.tick < GRACE_TICKS) return;
  if (world.stats.tick - c.ai.lastWar < 120) return;
  if (c.warExhaustion > 3 || c.manpower < c.maxManpower * 0.35 || c.treasury < 30) return;
  if (current < Math.max(2, want * 0.6)) return;

  const targets = [];
  for (const pid of c.provinces) {
    for (const n of world.provinces.get(pid).adj) {
      const np = world.provinces.get(n);
      if (np.sea || !np.owner || np.owner === c.tag) continue;
      const o = world.countries.get(np.owner);
      if (!o || o.provinces.size === 0) continue;
      if (hasTruce(world, c.tag, o.tag) || c.allies.has(o.tag)) continue;
      const myForce = current + c.manpower * 0.5;
      const hisForce = o.armies.reduce((s, a) => s + a.size, 0) + o.manpower * 0.5;
      const allyForce = [...o.allies].reduce((s, t) => {
        const al = world.countries.get(t);
        return s + (al ? al.armies.reduce((x, a) => x + a.size, 0) * 0.6 : 0);
      }, 0);
      const ratio = myForce / Math.max(1, hisForce + allyForce);
      let score = ratio;
      if (c.claims.has(n)) score += 0.6;
      if (c.rivals.has(o.tag)) score += 0.3;
      if (o.religion !== c.religion) score += 0.2;
      score -= (c.ae.get(o.tag) || 0) / 100;
      score -= (o.coalition && o.coalition.has(c.tag)) ? 1.5 : 0;
      score += rng.range(-0.15, 0.15);
      targets.push({ tag: o.tag, score });
    }
  }
  if (!targets.length) return;
  targets.sort((a, b) => b.score - a.score);
  const best = targets[0];
  if (best.score < 1.45) return;
  if (!rng.chance(0.08)) return;

  // 挑一个 AE 最低的战争借口
  const cbs = casusBelli(world, c.tag, best.tag);
  const pick = cbs.find((x) => x.id === 'reconquest')
    || cbs.find((x) => x.id === 'conquest')
    || cbs.find((x) => x.id === 'religious')
    || cbs.find((x) => x.id === 'humiliate');
  if (!pick || pick.id === 'nocb') return;   // AI 不打无理由战争
  if (declareWar(world, c.tag, best.tag, pick.id)) c.ai.lastWar = world.stats.tick;
}

/* ---------------- 战争时期 ---------------- */

function aiWar(world, c, rng) {
  const war = world.wars.find((w) => w.active && (w.attackers.has(c.tag) || w.defenders.has(c.tag)));
  if (!war) return;
  const isAtt = war.attackers.has(c.tag);
  const enemySide = isAtt ? war.defenders : war.attackers;

  /* 1. 军队调度 */
  for (const a of c.armies) {
    if (a.movement || a.embarked) continue;
    const p = world.provinces.get(a.prov);
    if (a.morale < 1.2 && p.owner !== c.tag) {
      const home = nearestOwn(world, c.tag, a.prov);
      if (home != null) { moveArmy(world, a, home); continue; }
    }
    const threat = homeThreat(world, c);
    if (threat != null && p.owner === c.tag && a.prov !== threat) {
      if (adjacentTo(world, a.prov, threat)) { moveArmy(world, a, threat); continue; }
      const step = pathStep(world, a.prov, threat, c.tag);
      if (step != null) { moveArmy(world, a, step); continue; }
    }
    let target = null, best = -Infinity;
    for (const n of p.adj) {
      const np = world.provinces.get(n);
      if (np.sea || !np.controller) continue;
      if (!enemySide.has(np.controller) && !enemySide.has(np.owner)) continue;
      let score = 0;
      if (np.controller !== c.tag) score += 12;
      if (np.capital) score += 25;
      if (np.fort) score -= 6;
      if (np.terrain === 'alpine' || np.terrain === 'desert' || np.terrain === 'mountains') score -= 8;
      if (enemyArmyOf(world, n, enemySide)) score -= 14;
      if (p.siege && p.siege.tag === c.tag) score -= 40;
      score += rng.range(-2, 2);
      if (score > best) { best = score; target = n; }
    }
    if (target != null && best > 0) moveArmy(world, a, target);
  }

  /* 2. 媾和判断 */
  const ws = warScore(world, war);
  const mine = isAtt ? ws : -ws;
  const months = monthsBetween(war.start, world.date);

  if (months > 36 && Math.abs(ws) < 35 && rng.chance(0.12)) { whitePeace(world, war); return; }
  if (c.warExhaustion > 8 && mine < 40 && rng.chance(0.1)) { whitePeace(world, war); return; }
  if (mine >= 25 && rng.chance(0.3)) {
    const loser = isAtt ? war.defender : war.attacker;
    const demands = buildDemands(world, war, c.tag, loser, mine, isAtt);
    if (demands && peaceCost(world, war, isAtt ? 'attacker' : 'defender', demands) <= mine) {
      peaceDeal(world, war, isAtt ? 'attacker' : 'defender', demands);
    }
  }
}

/** 在战争分数预算内挑最想要的省份 */
function buildDemands(world, war, winner, loser, budget, isAtt) {
  const opts = peaceOptions(world, war);
  const side = isAtt ? 'attacker' : 'defender';
  const cand = [...opts.cores.map((x) => ({ ...x, v: x.dev * 2.2 })),
    ...opts.provinces.map((x) => ({ ...x, v: x.dev * (x.claimed ? 1.8 : 1) }))];
  if (!cand.length) {
    const lc = world.countries.get(loser);
    const ducats = Math.min(Math.floor(lc.treasury * 0.5), Math.floor(budget * 2));
    return ducats >= 10 ? { provinces: [], ducats } : null;
  }
  cand.sort((a, b) => b.v - a.v);
  const demands = { provinces: [], ducats: 0, humiliate: false };
  for (const it of cand) {
    const trial = { ...demands, provinces: [...demands.provinces, it.pid] };
    if (peaceCost(world, war, side, trial) > budget) continue;
    demands.provinces.push(it.pid);
    if (peaceCost(world, war, side, demands) > budget * 0.85) break;
  }
  if (!demands.provinces.length) {
    const lc = world.countries.get(loser);
    demands.ducats = Math.min(Math.floor(lc.treasury * 0.5), Math.floor(budget * 2));
    if (demands.ducats < 10) return null;
  }
  return demands;
}

/* ---------------- 内政 ---------------- */

function aiDomestic(world, c, rng) {
  /* 稳定度与厌战 */
  if (c.stability <= 0 && c.powers.adm > 220 && rng.chance(0.3)) raiseStability(world, c.tag);
  if (c.warExhaustion > 5 && c.powers.dip > 200 && rng.chance(0.2)) reduceWarExhaustion(world, c.tag);

  /* 核心化 */
  if (c.powers.adm > 180) {
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      if (p.sea || p.cores.has(c.tag)) continue;
      if (coreProvince(world, c.tag, pid)) break;
    }
  }

  /* 建筑：从发展度最高的省往下铺。钱多了之后这是 AI 主要的去库存手段。 */
  if (c.treasury > 200) {
    const types = c.treasury > 700 ? ['workshop', 'temple', 'marketplace', 'barracks', 'fort'] : ['workshop', 'temple', 'marketplace'];
    const provs = [...c.provinces].map((id) => world.provinces.get(id))
      .filter((p) => !p.sea && p.owner === c.tag && p.controller === c.tag)
      .sort((a, b) => (b.baseTax + b.baseProduction + b.baseManpower) - (a.baseTax + a.baseProduction + a.baseManpower));
    let built = 0;
    for (const p of provs) {
      if (built >= 2 || c.treasury < 200) break;
      for (const t of types) {
        if (p.buildings[t]) continue;
        if (buildBuilding(world, p.id, t)) { built++; break; }
      }
    }
  }

  /* 舰队：沿海国家维持一半海军上限 */
  if (c.navalLimit > 3 && c.treasury > 300 && rng.chance(0.12)) {
    const have = c.fleets.reduce((s, f) => s + (f.ships.heavy + f.ships.light + f.ships.galley), 0);
    if (have < c.navalLimit * 0.5) {
      const coastal = [...c.provinces].find((pid) => world.provinces.get(pid).coastal);
      const sea = coastal != null
        ? world.provinces.get(coastal).adj.find((a) => world.provinces.get(a).sea)
        : null;
      if (sea != null) {
        createFleet(world, c.tag, sea, { heavy: 1, light: 2, galley: 2 });
      }
    }
  }

  /* 发展度：点数和钱都富余时投资最值钱的省份 */
  if (c.treasury > 350 && rng.chance(0.25)) {
    const cap = world.provinces.get(c.capital);
    const which = c.powers.adm > 300 ? 'tax' : c.powers.dip > 300 ? 'prod' : c.powers.mil > 300 ? 'man' : null;
    if (cap && which && cap.owner === c.tag) developProvince(world, cap.id, which);
  }

  /* 将领 */
  if (c.armies.length > c.generals.length && c.powers.mil > 120 && rng.chance(0.2)) {
    const g = recruitGeneral(world, c.tag, rng);
    if (g) {
      const free = c.armies.find((a) => !a.general);
      if (free) assignGeneral(world, free, g.id);
    }
  }

  /* 阶级：先安抚要反的，再趁忠诚尚可时收权，穷极了就卖头衔 */
  if (c.estates) {
    const naked = Object.keys(c.estates).find((id) => c.estates[id].loyalty < 25
      && ![...c.privileges].some((pid) => PRIV_BY_ID.get(pid)?.estate === id));
    if (naked) {
      const cand = PRIVILEGES.filter((p) => p.estate === naked && !c.privileges.has(p.id));
      for (const p of cand) if (grantPrivilege(world, c.tag, p.id).ok) break;
    }
    if (c.crownland < 35) {
      const loy = Object.values(c.estates).reduce((s, e) => s + e.loyalty, 0) / 4;
      if (loy > 45) seizeLand(world, c.tag);
    }
    if (c.treasury < 30 && c.crownland > 45 && rng.chance(0.3)) sellTitles(world, c.tag);
  }

  /* 国家银行：钱和点数都宽裕的老牌国家优先设立 */
  if (!c.nationalBank && c.treasury > 400 && c.powers.adm > 250 && rng.chance(0.2)) {
    foundNationalBank(world, c.tag);
  }
}

/* ---------------- 科技与理念 ---------------- */

function aiTechIdeas(world, c, rng) {
  // 优先补最落后的分支，但不落下军事太多
  const branches = ['adm', 'dip', 'mil'].slice().sort((a, b) => c.tech[a] - c.tech[b]);
  const br = branches[0];
  if (rng.chance(0.4)) takeTech(world, c.tag, br);

  // 理念：行政科技允许时优先开军事或贸易组
  const open = IDEA_GROUPS.filter((g) => canTakeIdea(world, c.tag, g.id).ok);
  if (!open.length) return;
  const prefer = ['quantity', 'offensive', 'trade', 'economic', 'administrative', 'quality', 'defensive', 'religious', 'diplomatic', 'innovative', 'influence', 'maritime'];
  open.sort((a, b) => prefer.indexOf(a.id) - prefer.indexOf(b.id));
  const g = open[0];
  // 别把点数全砸在理念上
  if (c.powers[g.branch] > 550 || (c.powers[g.branch] > 420 && rng.chance(0.4))) {
    takeIdea(world, c.tag, g.id);
  }

  // 政策：槽位空着就填上（军事向的优先）
  if ((c.policies?.size ?? 0) < policySlots(c)) {
    const avail = POLICIES.filter((p) => policyAvailable(c, p) && !c.policies.has(p.id));
    avail.sort((a, b) => prefer.indexOf(a.requires[0]) - prefer.indexOf(b.requires[0]));
    if (avail.length) togglePolicy(world, c.tag, avail[0].id);
  }
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
    if (a.tag === c.tag) continue;
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
  if (!start) return null;
  const seen = new Set([from]);
  const q = [[from, null]];
  while (q.length) {
    const [cur, first] = q.shift();
    for (const n of world.provinces.get(cur).adj) {
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

function pathStep(world, from, to, tag) {
  if (from === to) return null;
  const prev = new Map([[from, null]]);
  const q = [from];
  let found = false;
  while (q.length && !found) {
    const cur = q.shift();
    for (const n of world.provinces.get(cur).adj) {
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
    for (const n of world.provinces.get(pid).adj) {
      const np = world.provinces.get(n);
      if (np && np.owner === b) return true;
    }
  }
  return false;
}

function monthsBetween(a, b) {
  return (b.y - a.y) * 12 + (b.m - a.m);
}
