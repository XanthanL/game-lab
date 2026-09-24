// 自动通跑探针：用 CDP 驱动页面里的游戏逻辑，一路打到底，抓运行时异常。
// 用法：node .probe-run.mjs [毫秒上限] [char]
const PORT = 9333;
const LIMIT = Number(process.argv[2] || 90000);
const CHAR = process.argv[3] || 'astronaut';

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page');
if (!page) { console.log('no page target'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => ws.addEventListener('open', r));

await send('Runtime.enable');
await send('Page.enable');
await send('Runtime.evaluate', { expression: 'location.href="http://127.0.0.1:8126/index.html?noanim=1"' });
await new Promise(r => setTimeout(r, 1800));

const script = `(async () => {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno));
  const un = [];
  window.addEventListener('unhandledrejection', e => un.push(String(e.reason)));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const R = { chars: 0, battles: 0, wins: 0, acts: [], rewards: 0, events: 0, shops: 0, rests: 0, over: null, maxTurn: 0 };
  try {
    Sound.init && Sound.init();
    newRun('${CHAR}');
    await sleep(200);
    const t0 = Date.now();
    let guard = 0;
    let lastScene = '', lastAct = -1, lastEnemy = null, lastSig = '', sigN = 0;
    while (Date.now() - t0 < ${LIMIT} && guard++ < 20000) {
      if (G.act !== lastAct) { lastAct = G.act; R.acts.push(ACTS[G.act].name); }
      const sc = G.scene;
      if (sc === 'over') { R.over = { win: G.player.hp > 0 && G.enemy === null ? 'maybe' : 'end', hp: G.player.hp }; break; }
      if (sc === 'battle') {
        if (G.enemy !== lastEnemy) { lastEnemy = G.enemy; R.battles++; }
        R.wins = G.run.wins; R.maxTurn = Math.max(R.maxTurn, G.turn);
        if (G.phase === 'player' && !G.busy) {
          // 模拟合理玩家：优先伤害牌，其次任意可打出的牌
          let i = G.hand.findIndex(c => !c.unplayable && G.player.battery >= c.cost && c.type === 'damage');
          if (i < 0) i = G.hand.findIndex(c => !c.unplayable && G.player.battery >= c.cost);
          if (i >= 0) playCard(i); else endTurn();
        }
      } else if (sc === 'map') {
        const all = [].concat(...G.map.nodes);
        const n = all.find(x => x.reach && !x.visited);
        if (n) selectNode(n); else { R.err = 'no reachable node'; break; }
      } else if (sc === 'title' || sc === 'charsel' || sc === 'story') {
        R.err = 'unexpected scene ' + sc; break;
      } else {
        if (sc === 'reward') R.rewards++; else if (sc === 'event') R.events++; else if (sc === 'shop') R.shops++; else if (sc === 'rest') R.rests++;
        // 同一个「场景 + 弹窗标题」反复出现 = 在空转，先数一下
        const title = (document.querySelector('#modal-title') || {}).textContent || '';
        const sig = sc + '|' + title;
        if (sig === lastSig) sigN++; else { lastSig = sig; sigN = 1; }
        if (sigN > 30) {
          // 兜底：先试关闭键（可关弹窗），否则判定卡死
          const x = document.querySelector('#modal-x');
          if (x && !x.classList.contains('hidden')) { x.click(); }
          else { R.err = 'loop in ' + sc + ' / ' + title; break; }
        }
        let opt;
        if (sc === 'shop') {
          // 买两次就离开，否则会在货架上来回点
          R.shopBuys = (R.shopBuys || 0) + 1;
          opt = R.shopBuys <= 2 ? document.querySelector('#modal-body .opt') : document.querySelector('#modal-actions .btn');
        } else {
          // ⚠️ .card 要排在 #modal-actions 之前 —— 否则「返回」这类回退按钮
          // 会被一直点，在「上一层 ↔ 选择器」之间无限来回（曾空转 6351 次）。
          opt = document.querySelector('#modal-body .card')
             || document.querySelector('#modal-body .opt')
             || document.querySelector('#modal-actions .btn');
        }
        if (opt) opt.click(); else { R.err = 'stuck in ' + sc; break; }
      }
      await sleep(22);
      lastScene = sc;
    }
    if (guard >= 20000) R.err = 'guard limit';
    R.gold = G.gold; R.hp = G.player.hp; R.deck = G.deck.length; R.relics = G.player.relics.length;
    R.turns = G.turn;
  } catch (e) { R.crash = String(e && e.stack || e); }
  R.errs = errs; R.unhandled = un;
  return R;
})()`;

const r = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: LIMIT + 20000 });
const v = r.result && r.result.result && r.result.result.value;
console.log(JSON.stringify(v, null, 1));
if (r.result && r.result.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails).slice(0, 900));
ws.close();
process.exit(0);
