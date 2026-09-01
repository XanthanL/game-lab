// 贸易系统：节点、贸易实力、商人转移 / 收取、封锁、禁运。
//
//   省份产出贸易价值 → 汇入所属节点 → 各按实力份额决定这部分价值的去向
//   默认向下游流走；派商人转移可加 10% 并在下游获得「商队实力」；
//   派商人收取则在本节点就地变现（非本土节点打五折）。
//
// 于是「把商人放在哪儿」第一次成为一个真的要做的决策。
// 舰队也不再只是战争工具：停泊在海域的轻舰会为船主在相邻节点撑起
// 贸易力；禁运则让你在有实力的节点上排挤对手。
// 节点的「主导者」（按省份发展度份额）在收取时另有加成：
// 份额过半 +10%，完全垄断 +25% —— 把整片节点吃下来是有回报的。

export const GOOD_VALUE = {
  grain: 2, wine: 4, wool: 3, cloth: 6, fish: 2.5, salt: 3.5, iron: 4, gold: 8, copper: 3.5,
  lumber: 2.5, fur: 4, horses: 3.5, cotton: 3, spices: 7, silk: 7,
};

export const GOOD_CN = {
  grain: '谷物', wine: '葡萄酒', wool: '羊毛', cloth: '布匹', fish: '鱼类', salt: '盐',
  iron: '铁', gold: '黄金', copper: '铜', lumber: '木材', fur: '毛皮', horses: '马匹',
  cotton: '棉花', spices: '香料', silk: '丝绸',
};

/* 节点。to = 下游（空数组 = 终端节点，价值到此为止只能收取）。 */
export const TRADE_NODES = [
  { id: 'sevilla', name: '塞维利亚', c: [-6, 37.5], to: [] },
  { id: 'bordeaux', name: '波尔多', c: [-0.5, 45], to: ['channel'] },
  { id: 'channel', name: '英吉利海峡', c: [2, 51], to: [] },
  { id: 'champagne', name: '香槟', c: [4, 48.5], to: ['channel'] },
  { id: 'rhineland', name: '莱茵兰', c: [7.5, 50], to: ['channel'] },
  { id: 'lubeck', name: '吕贝克', c: [11, 54], to: ['channel'] },
  { id: 'saxony', name: '萨克森', c: [13.5, 51], to: ['lubeck'] },
  { id: 'krakow', name: '克拉科夫', c: [20, 50], to: ['saxony'] },
  { id: 'baltic', name: '波罗的海', c: [19, 56], to: ['lubeck'] },
  { id: 'novgorod', name: '诺夫哥罗德', c: [31, 58.5], to: ['baltic'] },
  { id: 'moscow', name: '莫斯科', c: [38, 56], to: ['novgorod'] },
  { id: 'kiev', name: '基辅', c: [30, 50], to: ['baltic'] },
  { id: 'genoa', name: '热那亚', c: [8.5, 44], to: [] },
  { id: 'venice', name: '威尼斯', c: [13.5, 45.5], to: [] },
  { id: 'wien', name: '维也纳', c: [16.5, 48], to: ['venice'] },
  { id: 'pest', name: '佩斯', c: [20.5, 47], to: ['wien'] },
  { id: 'ragusa', name: '拉古萨', c: [18, 43], to: ['venice'] },
  { id: 'constantinople', name: '君士坦丁堡', c: [28.5, 41], to: [] },
  { id: 'crimea', name: '克里米亚', c: [34, 45.5], to: ['constantinople'] },
  { id: 'astrakhan', name: '阿斯特拉罕', c: [47, 46], to: ['crimea'] },
  { id: 'tunis', name: '突尼斯', c: [9, 36.5], to: ['genoa'] },
  { id: 'alexandria', name: '亚历山大', c: [30, 31], to: ['constantinople'] },
];

export const NODE_BY_ID = new Map(TRADE_NODES.map((n) => [n.id, n]));

/** 拓扑序：上游在前，保证算到某节点时它的上游都已结算完毕 */
const TOPO_ORDER = (() => {
  const indeg = new Map(TRADE_NODES.map((n) => [n.id, 0]));
  for (const n of TRADE_NODES) for (const t of n.to) indeg.set(t, (indeg.get(t) || 0) + 1);
  const q = TRADE_NODES.filter((n) => !indeg.get(n.id)).map((n) => n.id);
  const out = [];
  while (q.length) {
    const id = q.shift();
    out.push(id);
    for (const n of TRADE_NODES) {
      if (n.to.includes(id)) {
        const d = indeg.get(n.id) - 1;
        indeg.set(n.id, d);
        if (d === 0) q.push(n.id);
      }
    }
  }
  // 兜底：万一有环，剩下的直接追加
  for (const n of TRADE_NODES) if (!out.includes(n.id)) out.push(n.id);
  return out;
})();

/* ─────────────── 初始化 ─────────────── */

/** 每个陆省归到最近的节点；国家的本土节点 = 首都所在节点 */
export function assignTradeNodes(world) {
  for (const p of world.provinces.values()) {
    if (p.sea) { p.tradeNode = null; continue; }
    let best = null, bd = Infinity;
    for (const n of TRADE_NODES) {
      const d = (p.lon - n.c[0]) ** 2 + ((p.lat - n.c[1]) * 0.72) ** 2;
      if (d < bd) { bd = d; best = n.id; }
    }
    p.tradeNode = best;
  }
  for (const c of world.countries.values()) {
    c.homeNode = c.capital != null ? (world.provinces.get(c.capital)?.tradeNode || null) : null;
  }
}

export function initTrade(world) {
  world.trade = { nodes: {}, merchants: new Map(), income: new Map(), blockaded: new Set() };
  for (const c of world.countries.values()) world.trade.merchants.set(c.tag, []);
}

/* ─────────────── 省份层面 ─────────────── */

export function provTradeValue(p) {
  if (!p || p.sea || !p.owner) return 0;
  const dev = p.baseProduction;
  return dev * (GOOD_VALUE[p.tradeGood] || 3) * 0.030 * (1 - p.autonomy * 0.5);
}

export function provTradePower(world, p) {
  if (!p || p.sea || !p.owner) return 0;
  const dev = p.baseTax + p.baseProduction + p.baseManpower;
  let v = 2 + dev * 0.6;
  if (p.coastal) v *= 1.5;
  if (p.capital) v *= 1.25;                 // 首都天然是贸易集散地
  if (p.buildings && p.buildings.marketplace) v *= 1.6;
  if (p.buildings && p.buildings.dock) v *= 1.35;
  v *= 1 - p.autonomy * 0.5;
  if (p.devastation > 0) v *= 1 - p.devastation * 0.004;   // 兵灾之下市集萧条
  if (world.trade.blockaded.has(p.id)) v *= 0.45;   // 被封锁的港口几乎做不了生意
  return v;
}

/* ─────────────── 商人 ─────────────── */

export function merchantCount(world, tag) {
  const c = world.countries.get(tag);
  if (!c) return 0;
  const mods = world.modsFor ? world.modsFor(tag) : null;
  return Math.max(1, 2 + Math.floor(c.tech.dip / 6) + (mods?.merchants || 0));
}

export function merchantsOf(world, tag) {
  return world.trade.merchants.get(tag) || [];
}

/** 玩家手动设定：{ node, action:'steer'|'collect', to?:nodeId } */
export function setMerchant(world, tag, nodeId, action, to) {
  const list = world.trade.merchants.get(tag) || [];
  const i = list.findIndex((m) => m.node === nodeId);
  const entry = { node: nodeId, action, to: to || null };
  if (i >= 0) list[i] = entry;
  else {
    if (list.length >= merchantCount(world, tag)) return false;
    list.push(entry);
  }
  world.trade.merchants.set(tag, list);
  return true;
}

export function clearMerchant(world, tag, nodeId) {
  const list = world.trade.merchants.get(tag) || [];
  world.trade.merchants.set(tag, list.filter((m) => m.node !== nodeId));
}

/* ─────────────── 禁运 ─────────────── */

/** 禁运某国：它在你握有贸易力的节点上损失三分之一实力（友好度 −40 由静态部分计算）。 */
export function setEmbargo(world, tag, target) {
  const c = world.countries.get(tag), t = world.countries.get(target);
  if (!c || !t || tag === target) return { ok: false, why: '无法禁运' };
  if (c.embargoes.has(target)) return { ok: false, why: '已在禁运' };
  if (c.allies.has(target)) return { ok: false, why: '不能禁运盟友' };
  c.embargoes.add(target);
  return { ok: true };
}

export function liftEmbargo(world, tag, target) {
  const c = world.countries.get(tag);
  if (!c || !c.embargoes.has(target)) return { ok: false, why: '并未禁运' };
  c.embargoes.delete(target);
  return { ok: true };
}

/** 从 from 出发沿下游走到 home，返回第一跳；走不到（home 在下游）返回 null */
export function stepToward(from, home) {
  if (!from || !home || from === home) return null;
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const nx of (NODE_BY_ID.get(cur)?.to || [])) {
      if (prev.has(nx)) continue;
      prev.set(nx, cur);
      if (nx === home) {
        let step = nx;
        while (prev.get(step) !== from && prev.get(step) != null) step = prev.get(step);
        return step;
      }
      q.push(nx);
    }
  }
  return null;
}

/** AI / 玩家「自动派驻」：有价值的节点优先，能往本土导流就转移，否则就地收取 */
export function autoMerchants(world, tag) {
  const c = world.countries.get(tag);
  if (!c) return;
  const home = c.homeNode;
  const list = [];
  const cand = [];
  for (const n of TRADE_NODES) {
    const st = world.trade.nodes[n.id];
    if (!st) continue;
    const pw = st.power[tag] || 0;
    if (pw <= 0) continue;
    const share = st.totalPower > 0 ? pw / st.totalPower : 0;
    const val = st.value * share;
    if (n.id === home) { list.push({ node: n.id, action: 'collect' }); continue; }
    if (val < 0.35) continue;
    cand.push({ id: n.id, val });
  }
  cand.sort((a, b) => b.val - a.val);
  let slots = merchantCount(world, tag) - list.length;
  for (const it of cand) {
    if (slots <= 0) break;
    const hop = stepToward(it.id, home);
    list.push(hop ? { node: it.id, action: 'steer', to: hop } : { node: it.id, action: 'collect' });
    slots--;
  }
  world.trade.merchants.set(tag, list);
}

/* ─────────────── 封锁 ─────────────── */

export function computeBlockade(world) {
  const blockaded = new Set();
  const bySea = new Map();     // seaId -> Set(tag) 在该海域有舰队的国家
  for (const c of world.countries.values()) {
    for (const f of c.fleets) {
      if (f.movement) continue;
      let s = bySea.get(f.prov);
      if (!s) bySea.set(f.prov, (s = new Set()));
      s.add(c.tag);
    }
  }
  if (!bySea.size) { world.trade.blockaded = blockaded; return; }
  for (const p of world.provinces.values()) {
    if (p.sea || !p.owner || !p.coastal) continue;
    for (const adj of p.adj) {
      const tags = bySea.get(adj);
      if (!tags) continue;
      for (const t of tags) {
        if (world.isAtWar(t, p.owner)) { blockaded.add(p.id); break; }
      }
      if (blockaded.has(p.id)) break;
    }
  }
  world.trade.blockaded = blockaded;
}

/* ─────────────── 月度结算 ─────────────── */

function sumObj(o) {
  let s = 0;
  for (const k in o) s += o[k];
  return s;
}

export function runTrade(world) {
  computeBlockade(world);
  const T = world.trade;
  const nodes = {};
  for (const n of TRADE_NODES) {
    nodes[n.id] = {
      id: n.id, name: n.name, to: n.to,
      local: 0, incoming: 0, value: 0,
      power: {}, steer: {}, totalPower: 0,
      outflow: {}, collected: {},
      ownerDev: {}, dominant: null, dominantShare: 0, monopoly: false,
    };
  }

  // 1) 本地价值与实力；同时按发展度统计节点内各省的归属，得出「主导者」
  for (const p of world.provinces.values()) {
    if (p.sea || !p.owner || !p.tradeNode) continue;
    const st = nodes[p.tradeNode];
    if (!st) continue;
    const who = p.controller || p.owner;
    st.local += provTradeValue(p);
    const pw = provTradePower(world, p);
    if (pw > 0) st.power[who] = (st.power[who] || 0) + pw;
    if (p.controller === p.owner) {
      st.ownerDev[p.owner] = (st.ownerDev[p.owner] || 0) + (p.baseTax + p.baseProduction + p.baseManpower);
    }
  }
  for (const id in nodes) {
    const st = nodes[id];
    let total = 0, best = 0, bestTag = null;
    for (const t in st.ownerDev) {
      total += st.ownerDev[t];
      if (st.ownerDev[t] > best) { best = st.ownerDev[t]; bestTag = t; }
    }
    st.dominant = bestTag;
    st.dominantShare = total > 0 ? best / total : 0;
    st.monopoly = bestTag != null && st.dominantShare >= 0.999;
  }

  // 1.5) 轻舰贸易力：停在海域的轻舰为船主在相邻节点撑场面
  for (const c of world.countries.values()) {
    if (!c.fleets.length) continue;
    const mods = world.modsFor ? world.modsFor(c.tag) : null;
    const eff = 1 + (mods?.tradePowerMod || 0) / 100;
    for (const f of c.fleets) {
      if (f.movement) continue;
      const sea = world.provinces.get(f.prov);
      if (!sea || !sea.sea) continue;
      const light = f.ships.light || 0;
      if (light <= 0) continue;
      for (const n of sea.adj) {
        const np = world.provinces.get(n);
        if (!np || np.sea || !np.tradeNode) continue;
        const st = nodes[np.tradeNode];
        if (st) st.power[c.tag] = (st.power[c.tag] || 0) + light * 1.2 * eff;
        break;   // 一支舰队只挂靠一个节点
      }
    }
  }

  // 1.6) 禁运：你握有贸易力的节点上，被你禁运的国家损失 1/3 实力
  for (const id in nodes) {
    const st = nodes[id];
    const present = Object.keys(st.power);
    if (present.length < 2) continue;
    const hit = new Set();
    for (const t of present) {
      const tc = world.countries.get(t);
      if (!tc || !tc.embargoes || !tc.embargoes.size) continue;
      for (const target of tc.embargoes) {
        if (target !== t && (st.power[target] || 0) > 0) hit.add(target);
      }
    }
    for (const target of hit) st.power[target] *= 0.67;
  }

  // 2) 自上而下结算
  const income = new Map();
  for (const id of TOPO_ORDER) {
    const st = nodes[id];
    st.incoming = st.incoming || 0;
    st.value = st.local + st.incoming;

    const power = { ...st.power };
    for (const t in st.steer) power[t] = (power[t] || 0) + st.steer[t];
    const total = sumObj(power);
    st.totalPower = total;
    if (total <= 0) continue;

    const isEnd = !st.to.length;

    for (const t in power) {
      const share = power[t] / total;
      const val = st.value * share;
      const c = world.countries.get(t);
      if (!c) continue;
      const mods = world.modsFor ? world.modsFor(t) : null;
      const eff = 1 + (mods?.tradeEff || 0) / 100;
      const steerBonus = 1 + (0.10 + (mods?.tradeSteer || 0) / 100);
      const home = c.homeNode === id;
      const m = merchantsFor(world, t).get(id);

      let taken = 0;
      if (m && m.action === 'steer' && !isEnd) {
        const target = nodes[m.to] ? m.to : st.to[0];
        const sent = val * steerBonus;
        nodes[target].incoming += sent;
        nodes[target].steer[t] = (nodes[target].steer[t] || 0) + val * 0.2;
        st.outflow[target] = (st.outflow[target] || 0) + sent;
      } else if (m && m.action === 'collect') {
        taken = val * (home ? 1 : 0.5) * eff;
      } else if (home) {
        taken = val * eff;
      } else if (isEnd) {
        taken = val * 0.7 * eff;
      } else {
        const hop = st.to[0];
        nodes[hop].incoming += val;
        st.outflow[hop] = (st.outflow[hop] || 0) + val;
      }
      // 主导者红利：垄断整片节点 +25%，份额过半 +10%
      if (taken > 0 && t === st.dominant) {
        taken *= st.monopoly ? 1.25 : (st.dominantShare >= 0.6 ? 1.1 : 1);
      }
      if (taken > 0) {
        income.set(t, (income.get(t) || 0) + taken);
        st.collected[t] = (st.collected[t] || 0) + taken;
      }
    }
  }

  T.nodes = nodes;
  T.income = income;
  return income;
}

function merchantsFor(world, tag) {
  const m = new Map();
  for (const it of (world.trade.merchants.get(tag) || [])) m.set(it.node, it);
  return m;
}

export function tradeIncomeOf(world, tag) {
  return world.trade?.income?.get(tag) || 0;
}

/** UI 用：某国在某节点的份额（0..1） */
export function shareOf(world, tag, nodeId) {
  const st = world.trade?.nodes?.[nodeId];
  if (!st || !st.totalPower) return 0;
  return (st.power[tag] || 0) / st.totalPower;
}
