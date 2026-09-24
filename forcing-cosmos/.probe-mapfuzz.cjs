/* 地图连通性回归探针（永久保留）
   1) 模糊测试：随机走图 600 次，必须一次死路都没有
   2) 结构体检：每个非末行节点都必须有出边（2026-09-24 修复的正是这条）
   3) 老存档救援：手工造一张「早期版本会生成」的死路图，验证 updateReach 能自己补边救回来
   历史 bug：末行 BOSS 固定只有 c=1，倒数第二行可能选出 c=3，|3-1|=2 连不上 →
   踩上去之后地图上没有任何可点节点 = 「打完这场就进不了下一关」，只能重新开始。 */
'use strict';
const { chromium } = require('playwright-core');
const CHROME = 'C:/Users/www27/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
// 默认打本地；验线上就 PROBE_BASE=https://xanthanl.github.io/game-lab/forcing-cosmos/index.html
const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:8126/index.html';

const FUZZ = `(() => {
  const fails = [], shapeFails = [];
  let runs = 0, deadEnds = 0;
  for (let i = 0; i < 600; i++) {
    const m = genMap();
    runs++;
    for (const row of m.nodes) for (const n of row) {
      if (n.r === MAP_ROWS - 1) continue;
      if (!m.edges.some(e => e.a === n)) shapeFails.push('r' + n.r + 'c' + n.c + ':' + n.kind);
    }
    let step = 0, stuck = false;
    while (step++ < 12) {
      const reach = [];
      m.nodes.forEach(r => r.forEach(n => { if (n.reach && !n.visited) reach.push(n); }));
      if (!reach.length) { stuck = true; break; }
      const pick = reach[(Math.random() * reach.length) | 0];
      pick.visited = true;
      updateReach(m);
      if (pick.kind === 'boss') break;
    }
    if (stuck) {
      deadEnds++;
      if (fails.length < 3) fails.push(m.nodes.flat().filter(n => n.visited).map(n => 'r' + n.r + 'c' + n.c).join(' -> '));
    }
  }
  return { runs, deadEnds, shapeFailCount: shapeFails.length, shapeSamples: shapeFails.slice(0, 5), fails };
})()`;

/* 老存档救援：把 genMap 补好的出边**删掉**，再把玩家按在死节点上，
   看 updateReach 会不会自己补回来（loadGame 也是走 updateReach，所以这一条覆盖了读档路径） */
const RESCUE = `(() => {
  // 反复生成，直到拿到「倒数第二行含 c=3」的那张图（这正是老版本会死路的形状）
  let m = null, n = null;
  for (let i = 0; i < 200 && !n; i++) {
    m = genMap();
    n = m.nodes[MAP_ROWS - 2].find(x => x.c === 3) || null;
  }
  if (!n) return { skipped: true };
  m.edges = m.edges.filter(e => e.a !== n);   // 抹掉出边 = 还原成老版本生成的地图
  n.visited = true;                            // 玩家已经踩在这个死节点上
  const warn = [];
  const oldWarn = console.warn;
  console.warn = (...a) => warn.push(a.join(' '));
  updateReach(m);
  console.warn = oldWarn;
  const reach = m.nodes.flat().filter(x => x.reach && !x.visited);
  return {
    node: 'r' + n.r + 'c' + n.c,
    reachCount: reach.length,
    reach: reach.map(x => 'r' + x.r + 'c' + x.c),
    patched: m.edges.filter(e => e.a === n).length,
    warned: warn.length > 0,
  };
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-proxy-server', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('page: ' + e.message));
  await p.goto(BASE + '?map=1&noanim=1', { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  let fail = 0;
  const chk = (ok, label, extra) => { console.log((ok ? '  ✓ ' : '  ✗ ') + label + (extra ? '  ' + extra : '')); if (!ok) fail++; };

  console.log('[1] 模糊测试：600 张图随机走');
  const r = await p.evaluate(FUZZ);
  console.log('    runs=' + r.runs + ' deadEnds=' + r.deadEnds + ' 无出边节点=' + r.shapeFailCount);
  chk(r.deadEnds === 0, '随机走图零死路', r.deadEnds ? JSON.stringify(r.fails) : '');
  chk(r.shapeFailCount === 0, '每个非末行节点都有出边', r.shapeFailCount ? JSON.stringify(r.shapeSamples) : '');

  console.log('[2] 老存档救援：手工造死路图 → updateReach 自动补边');
  const s = await p.evaluate(RESCUE);
  console.log('    ' + JSON.stringify(s));
  if (s.skipped) { chk(false, '没能造出 r4c3 形状的图（采样不足）'); }
  else {
    chk(s.patched >= 1, '补上了缺失的出边', 'edges=' + s.patched);
    chk(s.reachCount >= 1, '补边后至少有 1 个可点节点', 'reach=' + JSON.stringify(s.reach));
    chk(s.warned, 'console.warn 有告警（便于下次排查）');
  }

  console.log('errs =', JSON.stringify(errs.slice(0, 3)));
  console.log(fail === 0 ? '\nALL PASS' : '\n' + fail + ' FAILED');
  await b.close();
  process.exit(fail === 0 ? 0 : 1);
})();
