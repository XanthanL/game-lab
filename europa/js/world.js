// 世界状态：国家分配、省份初始化、核心化、月度 tick 的入口
import { buildMap } from './mapgen.js';
import { COUNTRIES, RELIGIONS, CULTURES, TECH_GROUPS, GOVS, TRADE_GOODS, DEFAULTS_BY_TERRAIN } from './countries.js';
import { makeRng, clamp } from './rng.js';
import { createArmy } from './military.js';
import { assignTradeNodes, initTrade, runTrade, autoMerchants } from './trade.js';
import { modsFor, invalidateMods } from './modifiers.js';
import { createFleet } from './navy.js';
import { initEstates } from './estates.js';
import { initReligion } from './religion.js';

/* 简单二叉堆（最小堆） */
class MinHeap {
  constructor(comp = (a, b) => a.pri - b.pri) { this.a = []; this.comp = comp; }
  push(x) {
    const a = this.a; a.push(x); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.comp(a[p], a[i]) <= 0) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a; if (!a.length) return null; const r = a[0]; const x = a.pop(); if (!a.length) return r;
    a[0] = x; let i = 0, n = a.length;
    while (true) {
      let l = i * 2 + 1, best = i;
      if (l < n && this.comp(a[l], a[best]) < 0) best = l;
      if (l + 1 < n && this.comp(a[l + 1], a[best]) < 0) best = l + 1;
      if (best === i) break; [a[i], a[best]] = [a[best], a[i]]; i = best;
    }
    return r;
  }
  peek() { return this.a[0] || null; }
  get length() { return this.a.length; }
}

function nextId(obj) { const id = obj.nextId; obj.nextId++; return id; }

export function createWorld(opts = {}) {
  const seed = opts.seed || 'europa-1444';
  const rng = makeRng(seed);
  const M = buildMap({ seed, spacing: opts.spacing, res: opts.res });

  const world = {
    seed,
    map: M,
    provinces: new Map(),
    countries: new Map(),
    armies: [],
    fleets: [],
    rebels: [],
    wars: [],
    relations: new Map(),
    date: { y: 1444, m: 11, d: 11 },
    speed: 1, paused: true,
    playerTag: opts.playerTag || null,
    nextId: 1,
    log: [],
    eventQueue: [],
    stats: { tick: 0 },
    // 省份归属/控制权的版本号。渲染器据此决定要不要重烘焙底图，
    // 免得每 tick 都无条件重画 2000 个省份。
    mapVersion: 0,
  };

  /* 这三个闭包挂在 world 上：modifiers.js 想用 modsFor，
     但 world.js 又不能 import 依赖链上游的模块，否则成环。 */
  world.modsFor = (tag) => modsFor(world, tag);
  world.invalidateMods = () => invalidateMods(world);
  world.isAtWar = (a, b) => isAtWar(world, a, b);

  /* 1. 省份状态对象 */
  for (const p of M.provinces) {
    const prov = {
      id: p.id, name: '', sea: false,
      owner: null, controller: null,
      cores: new Set(),
      culture: '', religion: '', terrain: p.terrain,
      tradeGood: '', coastal: p.coastal,
      baseTax: 0, baseProduction: 0, baseManpower: 0,
      buildings: {}, fort: 0, capital: false,
      unrest: 0, devastation: 0, autonomy: 0,
      occupation: null, // { tag, progress }
      siege: null,
      adj: p.adj,
      lon: p.lon, lat: p.lat, cx: p.cx, cy: p.cy, cell: p.cell,
      seaDist: p.seaDist,
    };
    world.provinces.set(p.id, prov);
  }
  for (const p of M.seas) {
    world.provinces.set(p.id, {
      id: p.id, name: p.seaName, sea: true,
      owner: null, controller: null, cores: new Set(),
      culture: '', religion: '', terrain: 'ocean', tradeGood: 'fish', coastal: false,
      baseTax: 0, baseProduction: 0, baseManpower: 0,
      buildings: {}, fort: 0, capital: false, unrest: 0, autonomy: 0,
      adj: p.adj, lon: p.lon, lat: p.lat, cx: p.cx, cy: p.cy, cell: p.cell,
    });
  }

  /* 2. 国家对象 */
  for (const c of COUNTRIES) {
    const country = {
      tag: c.tag, name: c.name, en: c.en, adj: c.adj, color: c.color,
      religion: c.religion, culture: c.culture, techGroup: c.tech, gov: c.gov,
      capital: null, capital2: c.capital2 || [],
      hre: !!c.hre, emperor: !!c.emperor,
      treasury: 25, inflation: 0,
      stability: 1, prestige: 10, legitimacy: 80, warExhaustion: 0,
      monarch: rollMonarch(c, rng),
      powers: { adm: 50, dip: 50, mil: 50 },
      tech: { adm: 3, dip: 3, mil: 3 },
      ideaGroups: {},
      policies: new Set(),
      // 金融：国家银行、战争税冷却、对外补贴
      nationalBank: false,
      lastWarTax: -999,
      subsidiesOut: [],      // [{ to, amount, months }]
      // 贸易：禁运对象
      embargoes: new Set(),
      // 军事传统（0..100）：打仗积攒，影响纪律/士气/将领质量
      armyTradition: clamp(rng.int(8, 30), 0, 100),
      homeNode: null,
      manpower: 0, maxManpower: 0, sailors: 0, maxSailors: 0,
      forceLimit: 0, navalLimit: 0,
      loans: [], ledger: null,
      armies: [], fleets: [], generals: [],
      provinces: new Set(), cores: new Set(), claims: new Set(),
      subjects: [], overlord: null,
      rivals: new Set(), allies: new Set(), marriages: new Set(), truces: new Map(),
      ae: new Map(), // tag -> number
      opinion: new Map(),
      coalition: new Set(), // 参与的包围网：针对哪些国家
      ambassadors: [], // 驻派使节 [{ to, createdAt, duration(96) }]
      ai: { lastWar: -120, lastClaim: -60 },
      stats: { income: 0, expense: 0 },
    };
    world.countries.set(c.tag, country);
    initEstates(world, country, rng);
  }

  /* 3. 分配省份给国家 */
  assignProvinces(world, rng);

  /* 4. 初始化省份数值：文化/宗教/发展度/贸易品/建筑 */
  initProvinceValues(world, rng);

  /* 5. 贸易节点归属 + 本土节点 */
  assignTradeNodes(world);
  initTrade(world);
  
  /* 6. 宗教系统初始化 */
  initReligion(world);

  /* 7. 国家次要初始化：人力/上限/收入首算 */
  recalcCountries(world);

  /* 7. 外交关系默认值 */
  for (const a of world.countries.keys()) for (const b of world.countries.keys()) if (a !== b) getRelation(world, a, b);

  /* 8. 开局军队、舰队、国库、AI 计时器错峰 */
  seedStartingForces(world, rng);
  seedStartingFleets(world, rng);

  /* 9. 首月贸易结算，让开局面板就有数字 */
  runTradeOnce(world);

  return world;
}

/** 沿海国家开局给一支小舰队，否则海军面板永远是空的 */
function seedStartingFleets(world, rng) {
  for (const c of world.countries.values()) {
    if (!c.capital) continue;
    const coastal = [...c.provinces].filter((pid) => world.provinces.get(pid).coastal);
    if (!coastal.length) continue;
    const n = clamp(Math.round(c.navalLimit * rng.range(0.3, 0.6)), 0, 20);
    if (n < 2) continue;
    const sea = world.provinces.get(coastal[0]).adj.find((a) => world.provinces.get(a).sea);
    if (sea == null) continue;
    c.sailors = c.maxSailors;
    c.treasury += 60;
    createFleet(world, c.tag, sea, {
      heavy: Math.floor(n * 0.25),
      light: Math.floor(n * 0.5),
      galley: Math.max(1, Math.ceil(n * 0.25)),
    });
  }
}

/** 跑两遍：第一遍算出各节点实力，第二遍才有数据供 autoMerchants 参考 */
function runTradeOnce(world) {
  runTrade(world);
  for (const c of world.countries.values()) autoMerchants(world, c.tag);
  runTrade(world);
}

/**
 * 开局给每个国家一支常备军、一份启动国库，并把 AI 的「上次宣战/造宣称」
 * 计时器随机打散——否则所有国家会在同一个月一起开战。
 */
function seedStartingForces(world, rng) {
  for (const c of world.countries.values()) {
    c.treasury = Math.round(40 + c.development * 0.3);
    c.manpower = c.maxManpower;
    c.ai.lastWar = -rng.int(48, 480);
    c.ai.lastClaim = -rng.int(8, 160);
    if (!c.capital) continue;
    const want = clamp(Math.round(c.forceLimit * rng.range(0.55, 0.9)), 2, 60);
    const stacks = want > 14 ? 2 : 1;
    for (let i = 0; i < stacks; i++) {
      const size = Math.round(want / stacks);
      if (size >= 1) createArmy(world, c.tag, c.capital, size);
    }
  }
}

function connectedComponents(ids, provById) {
  const seen = new Set();
  const comps = [];
  for (const start of ids) {
    if (seen.has(start)) continue;
    const stack = [start], comp = [];
    seen.add(start);
    while (stack.length) {
      const pid = stack.pop();
      comp.push(pid);
      const p = provById.get(pid);
      for (const n of p.adj) {
        if (seen.has(n)) continue;
        if (!ids.includes(n)) continue;
        seen.add(n); stack.push(n);
      }
    }
    comps.push(comp);
  }
  return comps;
}

function rollMonarch(c, rng) {
  const names = { M: ['亨利','路易','查理','腓力','詹姆斯','约翰','威廉','弗朗索瓦','费迪南德','马克西米利安'], F: ['玛丽','伊丽莎白','安妮','凯瑟琳'] };
  const gender = rng.chance(0.85) ? 'M' : 'F';
  return {
    name: rng.pick(names[gender]), gender,
    adm: clamp(Math.round(rng.gauss(3, 2)), 0, 6),
    dip: clamp(Math.round(rng.gauss(3, 2)), 0, 6),
    mil: clamp(Math.round(rng.gauss(3, 2)), 0, 6),
    age: rng.int(16, 45),
  };
}

/**
 * 省份分配：
 *   1) 首都播种——按国力强弱依次认领，保证每个国家至少有一块地，且不互相抢同一块
 *   2) 加权多源 Dijkstra 漫灌——每个国家从首都沿陆地图扩散，
 *      扩张「速度」与其目标规模的平方根成正比
 *   3) 迭代收敛：一次漫灌后按「实得/目标」修正各国的速度乘子，重跑。
 *      这一步是必需的——单纯加权 Voronoi 只控制相对速度，
 *      人烟稀少的东欧会让莫斯科这类国家吃到 4 倍于目标的面积
 *   4) 失衡修补 + 残片 + 飞地收拾
 */
function assignProvinces(world, rng) {
  const M = world.map;

  /* 气候荒地：撒哈拉腹地与北极冻土。1444 年谁也不住在那儿，
     而且它们必须从「可分配土地」的分母里剔除——否则目标规模会被
     一大片没人要的沙子和苔原稀释，法兰西这种拥挤地带的国家永远吃不到额度。
     沙漠只算「内陆沙漠」：离海 4.5° 以内仍有降水（尼罗河、北非海岸、
     阿拉伯沿海），真实尺寸的地球上把全部沙漠划成荒地会连埃及一起抹掉。 */
  const wasteland = [];
  const land = [];
  for (const p of M.provinces) {
    const arctic = p.terrain === 'tundra' || p.lat > 67.5;
    const deepDesert = p.terrain === 'desert' && (p.seaDist ?? 0) > 4.5;
    if (arctic || deepDesert) {
      p.wasteland = true;
      const wp = world.provinces.get(p.id);
      if (wp) wp.wasteland = true;      // 几何对象与游戏状态是两套，两边都要标
      wasteland.push(p);
    } else land.push(p);
  }
  const total = land.length;
  const landIds = new Set(land.map((p) => p.id));

  /* 地形阻力：山脉/沙漠/冻土让边界更容易停在自然屏障上。
     代价以世界像素计，BUDGET 即一个国家能离首都走多远；随 spacing 缩放，
     保证不同粒度下国家的地理覆盖范围一致。 */
  const TERRAIN_COST = {
    alpine: 2.4, hills: 1.35, steppe: 1.15, forest: 1.35,
    desert: 2.6, tundra: 2.0, farmland: 1.0, coastal: 1.0, grasslands: 1.0,
  };
  const BUDGET = 900 * (M.spacing / 40);
  function edgeCost(p, q) {
    let d = Math.hypot(p.cx - q.cx, p.cy - q.cy);
    if (d < 1e-6) d = 0.5;
    return d * (0.55 * (TERRAIN_COST[p.terrain] || 1) + 0.45 * (TERRAIN_COST[q.terrain] || 1));
  }

  /* --- 1) 首都播种：全局「最近优先」配对，每块地只认领一次 ---
     早先按国力从大到小依次认领，结果在省密的地方出了岔子：托斯卡纳
     周边每一块地都被邻国先行占作首府，锡耶纳的首府被挤到 3° 外的阿尔卑斯。
     改成把所有首都请求的候选省放在一起按距离统一排序、近的先配。 */
  const capProv = new Map();
  const taken = new Set();
  const reqs = [];
  for (const c of COUNTRIES) {
    capProv.set(c.tag, []);
    [c.capital, ...(c.capital2 || [])].forEach((cap, i) => {
      reqs.push({ tag: c.tag, i, lon: cap[1], lat: cap[2] });
    });
  }
  const K = 40;                        // 每个请求考察的候选省数
  const cands = [];
  for (const r of reqs) {
    const top = [];                    // 按距离降序的 K 小表，堆顶是最远的
    for (const p of land) {
      const d = (p.lon - r.lon) ** 2 + ((p.lat - r.lat) * 0.7) ** 2;
      if (top.length < K) { top.push([d, p.id]); if (top.length === K) top.sort((a, b) => b[0] - a[0]); continue; }
      if (d >= top[0][0]) continue;
      top[0] = [d, p.id];
      let i = 0;
      while (i + 1 < K && top[i][0] < top[i + 1][0]) { [top[i], top[i + 1]] = [top[i + 1], top[i]]; i++; }
    }
    for (const [d, pid] of top) cands.push({ d, tag: r.tag, i: r.i, pid });
  }
  cands.sort((a, b) => a.d - b.d);
  const filled = new Map();
  for (const c of cands) {
    const key = c.tag + '#' + c.i;
    if (filled.has(key) || taken.has(c.pid)) continue;
    taken.add(c.pid);
    filled.set(key, c.pid);
  }
  for (const r of reqs) {
    const key = r.tag + '#' + r.i;
    let pid = filled.get(key);
    if (pid == null) {                 // 候选池被邻国占满：退回全局最近的空地
      let best = null, bd = Infinity;
      for (const p of land) {
        if (taken.has(p.id)) continue;
        const d = (p.lon - r.lon) ** 2 + ((p.lat - r.lat) * 0.7) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { pid = best.id; taken.add(pid); }
    }
    if (pid != null) capProv.get(r.tag).push(pid);
  }

  /* --- 1.5) 圈内供给：从所有首都种子按行军代价走 BUDGET ---
     真实地球上，撒哈拉—伊朗—塔克拉玛干—喜马拉雅这条荒地腰带把印度、
     中国、中南半岛隔在了行军范围之外，而 1444 年的名单也只有欧陆与
     近东八十二国。目标规模必须按「首都走得到的地」算，
     否则等于给每个国家派了它根本拿不到的额度，欧洲自己先空掉三分之二。
     限额用行军代价而非跳数：省子大小现在随开发度变化，一跳的实地距离不等。 */
  let reachable = 0;
  {
    const cost = new Map();
    const pq = new MinHeap((a, b) => a.k - b.k);
    for (const list of capProv.values()) for (const pid of list) {
      if (cost.has(pid)) continue;
      cost.set(pid, 0); pq.push({ k: 0, pid });
    }
    while (pq.length) {
      const it = pq.pop();
      if (it.k > (cost.get(it.pid) ?? Infinity) + 1e-6 || it.k > BUDGET) continue;
      reachable++;
      const p = world.provinces.get(it.pid);
      for (const nb of p.adj) {
        if (!landIds.has(nb) || cost.has(nb)) continue;
        const v = it.k + edgeCost(p, world.provinces.get(nb));
        if (v <= BUDGET) { cost.set(nb, v); pq.push({ k: v, pid: nb }); }
      }
    }
  }

  /* 目标规模：权重按可达土地缩放，并保底 2 省 */
  const rawSum = COUNTRIES.reduce((s, c) => s + c.weight, 0);
  const scale = (reachable * 0.92) / rawSum;
  const target = new Map(COUNTRIES.map((c) => [c.tag, Math.max(2, Math.round(c.weight * scale))]));

  /* --- 2) 轮转配额生长 ---
     先前是「全局优先队列 + 加权速度 + 六轮收敛」，在真实尺寸的地球上彻底失配：
     跑得快的国家成批吃地，跑得慢的小国被邻国围死，威尼斯、米兰、萨伏依
     最后只剩 1 省，可达陆地也有八成无人认领——因为波前一旦被邻国占住的
     地块挡住就整片死掉（地峡尤其致命：苏伊士、黎凡特、乌拉尔缺口）。
     现在改成每轮各国依次落一子：谁都不会被排队饿死，吃满配额即停；
     生长范围限制在首都行军代价 BUDGET 之内，1444 年的 Old World 势力
     不会一路漫到印度去。范围同时决定了可用土地的分母——
     圈外的地（西伯利亚、撒哈拉腹地、印度、中国、美洲）留作未殖民区。 */
  function grow(cap) {
    const owner = new Map();
    const count = new Map(COUNTRIES.map((c) => [c.tag, 0]));
    const heap = new Map(), dist = new Map();
    for (const c of COUNTRIES) {
      const tag = c.tag;
      heap.set(tag, new MinHeap((a, b) => a.k - b.k));
      dist.set(tag, new Map());
      for (const pid of capProv.get(tag)) {
        dist.get(tag).set(pid, 0);
        heap.get(tag).push({ k: 0, pid });
      }
    }
    function push(tag, from, nb, k) {
      if (k > BUDGET || owner.has(nb)) return;
      const dm = dist.get(tag);
      const v = k + edgeCost(from, world.provinces.get(nb)) * rng.range(0.94, 1.10);
      if (v <= BUDGET && v < (dm.get(nb) ?? Infinity)) { dm.set(nb, v); heap.get(tag).push({ k: v, pid: nb }); }
    }
    const n = COUNTRIES.length;
    for (let round = 0; ; round++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        const tag = COUNTRIES[(i + round) % n].tag;
        if (count.get(tag) >= cap.get(tag)) continue;
        const h = heap.get(tag), dm = dist.get(tag);
        let it = null;
        while (h.length) {
          const x = h.pop();
          if (dm.get(x.pid) === undefined || x.k > dm.get(x.pid) + 1e-6) continue; // 过期
          if (owner.has(x.pid)) continue;
          it = x; break;
        }
        if (!it) continue;
        owner.set(it.pid, tag);
        count.set(tag, count.get(tag) + 1);
        moved = true;
        const p = world.provinces.get(it.pid);
        for (const nb of p.adj) if (landIds.has(nb)) push(tag, p, nb, it.k);
      }
      if (!moved) break;
    }
    return { owner, count };
  }
  const { owner, count } = grow(target);

  const ratioOf = (t) => count.get(t) / target.get(t);
  const isSeed = (pid) => {
    for (const list of capProv.values()) if (list.includes(pid)) return true;
    return false;
  };

  /* --- 4) 失衡修补：被围死的国家先吃邻近无主地，再从「相对更宽裕」的邻国接管边境省 ---
     注意 borderOf 必须查 owner 表：country.provinces 到第 7 步才写入。 */
  function borderOf(tag) {
    const out = new Map();
    for (const [pid, o] of owner) {
      if (o !== tag) continue;
      for (const n of world.provinces.get(pid).adj) {
        if (!landIds.has(n)) continue;
        const no = owner.get(n);
        if (no === tag) continue;
        const key = no ?? '';           // '' 代表无主地
        const arr = out.get(key) || [];
        arr.push(n);
        out.set(key, arr);
      }
    }
    return out;
  }
  for (let pass = 0; pass < 120; pass++) {
    const hungry = COUNTRIES.filter((c) => ratioOf(c.tag) < 0.8)
      .sort((a, b) => ratioOf(a.tag) - ratioOf(b.tag));
    if (!hungry.length) break;
    let moved = false;
    for (const c of hungry) {
      if (ratioOf(c.tag) >= 0.8) continue;
      const b = borderOf(c.tag);
      const free = (b.get('') || []).filter((pid) => !owner.has(pid));
      if (free.length) {
        owner.set(free[0], c.tag);
        count.set(c.tag, count.get(c.tag) + 1);
        moved = true;
        continue;
      }
      let pick = null, best = 0.22;      // 至少宽裕 22% 才值得动刀
      for (const [other, pids] of b) {
        if (!other) continue;
        const gain = ratioOf(other) - ratioOf(c.tag);
        if (gain <= best) continue;
        for (const pid of pids) {
          if (isSeed(pid)) continue;     // 不抢别人首都
          best = gain; pick = { pid, other };
        }
      }
      if (pick) {
        owner.set(pick.pid, c.tag);
        count.set(pick.other, count.get(pick.other) - 1);
        count.set(c.tag, count.get(c.tag) + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }

  /* --- 5) 无主地整理：小口袋并入邻国（欧洲腹地不留窟窿），
           成片的（西伯利亚、撒哈拉内陆、拉普兰）保留为未殖民区 --- */
  {
    const freeIds = land.filter((p) => !owner.has(p.id)).map((p) => p.id);
    const POCKET_MAX = 10;
    for (const pk of connectedComponents(freeIds, world.provinces)) {
      if (pk.length > POCKET_MAX) continue;
      let host = null, bestR = Infinity;
      for (const pid of pk) {
        for (const n of world.provinces.get(pid).adj) {
          const o = owner.get(n);
          if (!o) continue;
          const r = ratioOf(o);
          if (r < bestR) { bestR = r; host = o; }
        }
      }
      if (!host) continue;
      for (const pid of pk) { owner.set(pid, host); count.set(host, count.get(host) + 1); }
    }
  }

  /* --- 6) 修飞地：每个国家只保留最大连通块，碎块转给最饥饿的邻国 --- */
  for (const tag of [...new Set(owner.values())]) {
    const ids = land.filter((p) => owner.get(p.id) === tag).map((p) => p.id);
    if (ids.length <= 2) continue;
    const comps = connectedComponents(ids, world.provinces);
    if (comps.length <= 1) continue;
    comps.sort((a, b) => b.length - a.length);
    for (let i = 1; i < comps.length; i++) {
      if (comps[i].some((pid) => isSeed(pid))) continue;   // 含首都的块不动
      let host = null, bestScore = Infinity;
      for (const pid of comps[i]) {
        for (const n of world.provinces.get(pid).adj) {
          const no = owner.get(n);
          if (!no || no === tag || !landIds.has(n)) continue;
          const s = ratioOf(no);
          if (s < bestScore) { bestScore = s; host = no; }
        }
      }
      if (!host) continue;
      for (const pid of comps[i]) {
        owner.set(pid, host);
        count.set(tag, count.get(tag) - 1);
        count.set(host, count.get(host) + 1);
      }
    }
  }

  /* --- 7) 写到世界。没被认领的陆省 = 未殖民区（terra incognita） --- */
  for (const [pid, tag] of owner) {
    const p = world.provinces.get(pid);
    const c = world.countries.get(tag);
    if (!p || !c) continue;
    p.owner = tag; p.controller = tag;
    p.cores.add(tag);
    c.provinces.add(pid);
  }
  for (const p of land) {
    if (owner.has(p.id)) continue;
    p.uncolonized = true;
    const wp = world.provinces.get(p.id);
    if (wp) { wp.uncolonized = true; wp.owner = null; wp.controller = null; wp.fort = 0; }
  }
  for (const p of wasteland) {
    const wp = world.provinces.get(p.id);
    if (wp) { wp.owner = null; wp.controller = null; wp.fort = 0; }
  }
  for (const c of COUNTRIES) {
    const country = world.countries.get(c.tag);
    const caps = capProv.get(c.tag);
    let capId = caps.find((id) => owner.get(id) === c.tag) ?? null;
    if (capId == null) {
      const owned = [...country.provinces];
      if (owned.length) {
        const seed = world.provinces.get(caps[0]);
        owned.sort((a, b) => dist2(world.provinces.get(a), seed) - dist2(world.provinces.get(b), seed));
        capId = owned[0];
      }
    }
    country.capital = capId;
    if (capId != null) {
      const capP = world.provinces.get(capId);
      capP.capital = true;
      capP.fort = Math.max(capP.fort, 2);   // 首都城防 2 级
    }
  }
}

function dist2(a, b) {
  return (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
}

function initProvinceValues(world, rng) {
  const M = world.map;
  for (const p of world.provinces.values()) {
    if (p.sea) continue;
    const owner = p.owner ? world.countries.get(p.owner) : null;
    if (!owner) { p.name = '荒地'; continue; }

    // 文化/宗教默认继承国家；部分历史地区微调
    p.religion = owner.religion;
    p.culture = owner.culture;
    applyRegionalCultureReligion(p, owner);

    // 命名
    const list = COUNTRIES.find((c) => c.tag === owner.tag).names;
    const dists = Array.from(owner.provinces).map((pid) => {
      const q = world.provinces.get(pid);
      return { pid, d: (q.cx - p.cx) ** 2 + (q.cy - p.cy) ** 2 };
    });
    dists.sort((a, b) => a.d - b.d);
    p.name = list[dists.findIndex((x) => x.pid === p.id) % list.length] || `${owner.adj} 属地`;

    // 发展度
    const t = p.terrain;
    const info = DEFAULTS_BY_TERRAIN[t] || DEFAULTS_BY_TERRAIN.farmland;
    let base = info.devBase + rng.int(-1, 2);
    if (owner.tech === 'western') base += 1;
    if (owner.culture === 'italian') base += 1;
    if (owner.culture === 'french') base += 0;
    if (['russian', 'lithuanian', 'turkish'].includes(owner.culture)) base -= 1;
    if (t === 'desert' || t === 'tundra') base -= 1;
    if (p.capital) base += 4;
    base = clamp(base, 2, 16);

    const taxR = 0.42, prodR = 0.38, manR = 0.20;
    p.baseTax = Math.max(1, Math.round(base * taxR + rng.range(-0.3, 0.3)));
    p.baseProduction = Math.max(1, Math.round(base * prodR + rng.range(-0.3, 0.3)));
    p.baseManpower = Math.max(1, Math.round(base * manR + rng.range(-0.2, 0.2)));

    // 贸易品
    const goods = info.goods;
    p.tradeGood = goods[rng.int(0, goods.length - 1)];
    if (p.capital && rng.chance(0.5)) p.tradeGood = 'cloth';

    // 堡垒：首都 2 级 / 边境可能 1 级
    if (p.capital) p.fort = Math.max(p.fort || 0, 2);
    else if (p.adj.some((j) => world.provinces.get(j).owner !== p.owner && !world.provinces.get(j).sea)) {
      if (rng.chance(0.12)) p.fort = 1;
    }
  }
}

const REGION_OVERRIDES = [
  { box: [-5, 51.5, -2.5, 53.5], culture: 'welsh' },
  { box: [-6, 50, -1, 51.5], culture: 'cornish' },
  { box: [-5, 53.5, -2, 56,], culture: 'scottish' },
  { box: [-4, 42.5, 3.5, 43.5], culture: 'basque' },
  { box: [1.5, 41, 4, 43], culture: 'iberian' }, // 加泰罗尼亚保持伊比利亚
  { box: [19, 44, 27, 48], culture: 'romanian', religion: 'orthodox' }, // 特兰西瓦尼亚
  { box: [20, 41, 24, 44], culture: 'greek', religion: 'orthodox' }, // 希腊北部
  { box: [22, 36, 25, 39], culture: 'greek', religion: 'orthodox' }, // 伯罗奔尼撒
  { box: [25.5, 36, 28.5, 38], culture: 'greek', religion: 'orthodox' }, // 爱琴海东岸
  { box: [-10, 34, -1, 37], culture: 'berber' },
  { box: [-1, 33, 12, 37], culture: 'berber' },
  { box: [12, 30, 22, 35], culture: 'arabic' }, // 利比亚
  { box: [22, 29.5, 35, 32], culture: 'arabic' }, // 埃及
  { box: [35, 32, 37, 36], culture: 'greek', religion: 'orthodox' }, // 塞浦路斯 override
];
function applyRegionalCultureReligion(p, owner) {
  for (const r of REGION_OVERRIDES) {
    const [w, s, e, n] = r.box;
    if (p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n) {
      if (r.culture) p.culture = r.culture;
      if (r.religion) p.religion = r.religion;
    }
  }
}

export function recalcCountries(world) {
  for (const c of world.countries.values()) {
    let dev = 0, prov = 0, coastal = 0;
    for (const pid of c.provinces) {
      const p = world.provinces.get(pid);
      if (p.sea) continue;
      prov++;
      dev += p.baseTax + p.baseProduction + p.baseManpower;
      if (p.coastal) coastal++;
    }
    c.development = dev;
    c.provinceCount = prov;
    const mods = world.modsFor ? world.modsFor(c.tag) : null;
    const flMod = 1 + (mods?.forceLimitMod || 0) / 100;
    const nlMod = 1 + (mods?.navalLimitMod || 0) / 100;
    // size 单位 = 千人（1 个军团 = 1000 人）
    c.maxManpower = Math.max(200, Math.round(dev * 55 * (1 + (mods?.manpowerMod || 0) / 100)));
    c.manpower = clamp(c.manpower, 0, c.maxManpower);
    c.maxSailors = Math.max(100, Math.round(dev * 8 * (1 + (mods?.sailorMod || 0) / 100)));
    c.sailors = clamp(c.sailors, 0, c.maxSailors);
    c.forceLimit = Math.max(2, Math.round((dev * 0.075 + prov * 0.28) * flMod));
    c.navalLimit = Math.max(0, Math.round(coastal * 1.2 * nlMod));
  }
}

export function getRelation(world, a, b) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  let r = world.relations.get(key);
  if (!r) {
    r = { mods: [], truce: 0, alliance: false, marriage: false, guarantee: false, militaryAccess: false, hostile: false };
    world.relations.set(key, r);
  }
  return r;
}

export function isAtWar(world, a, b) {
  return world.wars.some((w) => w.active && ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)));
}

export function dateStr(d) { return `${d.y} 年 ${d.m} 月 ${d.d} 日`; }

/** 省份易主后调用：通知渲染器底图过期 */
export function bumpMap(world) {
  world.mapVersion = (world.mapVersion | 0) + 1;
}
