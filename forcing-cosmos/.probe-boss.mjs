// Boss 专项探针：直接进指定幕的 Boss/精英战，自动打到结束，验证蓄力/二阶段/结局流程。
// 用法：node .probe-boss.mjs [act] [kind] [毫秒]
const PORT = 9333;
const ACT = process.argv[2] ?? '2';
const KIND = process.argv[3] ?? 'boss';
const LIMIT = Number(process.argv[4] || 90000);
const BOOST = process.argv[5] === 'boost';   // 削弱敌人 + 强化玩家，用于验证胜利/结局路径

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Page.enable');
const url = `http://127.0.0.1:8126/index.html?noanim=1&auto=1&act=${ACT}&${KIND === 'elite' ? 'elite=1' : 'boss=1'}&row=5`;
await send('Runtime.evaluate', { expression: `location.href=${JSON.stringify(url)}` });
await new Promise(r => setTimeout(r, 2000));

const script = `(async () => {
  const errs = []; const un = [];
  window.addEventListener('error', e => errs.push(e.message + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => un.push(String(e.reason)));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const R = { enemy: G.enemy && G.enemy.name, hp: G.enemy && G.enemy.hp, phases: 0, charge: 0, charged: 0, maxHit: 0, turns: 0, endScene: null, errs, unhandled: un };
  try {
    Sound.init && Sound.init();
    if (${BOOST}) { G.enemy.baseMaxHp = 26; G.enemy.hp = 26; G.player.baseMaxHp = 400; G.player.hp = 400; }
    let lastCharge = -1, enraged = false, guard = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < ${LIMIT} && guard++ < 12000) {
      if (G.scene !== 'battle') {
        if (G.scene === 'actclear') {   // 幕终面板：点按钮继续，验证推进/结局
          const b = document.querySelector('#modal-actions .btn');
          R.actCleared = (R.actCleared || 0) + 1;
          if (b) { b.click(); await sleep(700); continue; }
        }
        R.endScene = G.scene; break;
      }
      const e = G.enemy;
      if (e) {
        if (e.currentCharge !== lastCharge) { lastCharge = e.currentCharge; if (e.currentCharge > 0) R.charge++; }
        if (e.enraged && !enraged) { enraged = true; R.phases++; R.phase2hp = e.hp; }
        const it = e.getIntent(); if (it.type === 'charged') R.charged++;
        R.turns = G.turn;
      }
      if (G.phase === 'player' && !G.busy) {
        const i = G.hand.findIndex(c => !c.unplayable && G.player.battery >= c.cost);
        if (i >= 0) playCard(i); else endTurn();
      }
      await sleep(22);
    }
    R.playerHp = G.player.hp; R.deck = G.deck.length;
    R.log = (G.log || []).slice(-4);
    R.overTitle = document.getElementById('over-title').textContent;
    R.overSub = document.getElementById('over-sub').textContent;
  } catch (e) { R.crash = String(e && e.stack || e); }
  return R;
})()`;
const r = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: LIMIT + 20000 });
console.log(JSON.stringify(r.result && r.result.result && r.result.result.value, null, 1));
if (r.result && r.result.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails).slice(0, 800));
ws.close(); process.exit(0);
