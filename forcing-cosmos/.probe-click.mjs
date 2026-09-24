// 出牌交互探针：合成 pointer 事件验证「点击出牌」与「拖到敌人出牌」两条路径。
const PORT = 9333;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Page.enable');
await send('Runtime.evaluate', { expression: 'location.href="http://127.0.0.1:8126/index.html?noanim=1&auto=1"' });
await new Promise(r => setTimeout(r, 2500));

const script = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  const R = {};
  const fire = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, isPrimary: true }));
  const cards = () => [...document.querySelectorAll('#hand .card')];
  const rect = () => { const r = document.getElementById('game').getBoundingClientRect(); return r; };
  const sc = () => rect().width / 640;
  const toScreen = (gx, gy) => { const r = rect(); return [r.left + gx * sc(), r.top + gy * sc()]; };

  // 1) 点击出牌
  await sleep(400);
  R.handBefore = G.hand.length;
  const c0 = cards().find(c => !c.classList.contains('no'));
  R.foundClickable = !!c0;
  if (c0) {
    const r0 = c0.getBoundingClientRect();
    fire(c0, 'pointerdown', r0.left + 40, r0.top + 50);
    fire(c0, 'pointerup', r0.left + 40, r0.top + 50);
  }
  await sleep(500);
  R.handAfterClick = G.hand.length;
  R.clickPlayed = R.handAfterClick < R.handBefore;

  // 2) 拖到敌人身上出牌
  await sleep(400);
  R.handBefore2 = G.hand.length;
  const c1 = cards().find(c => !c.classList.contains('no'));
  if (c1) {
    const r1 = c1.getBoundingClientRect();
    const [ex, ey] = toScreen(470, 150);
    fire(c1, 'pointerdown', r1.left + 40, r1.top + 50);
    fire(c1, 'pointermove', r1.left + 60, r1.top + 20);
    fire(c1, 'pointermove', ex, ey);
    fire(c1, 'pointerup', ex, ey);
  }
  await sleep(500);
  R.handAfterDrag = G.hand.length;
  R.dragPlayed = R.handAfterDrag < R.handBefore2;

  // 3) 拖到空白处应取消（不出牌）
  await sleep(600);
  R.handBefore3 = G.hand.length;
  const c2 = cards().find(c => !c.classList.contains('no'));
  if (c2) {
    const r2 = c2.getBoundingClientRect();
    const [bx, by] = toScreen(80, 120);
    fire(c2, 'pointerdown', r2.left + 40, r2.top + 50);
    fire(c2, 'pointermove', r2.left + 60, r2.top + 20);
    fire(c2, 'pointermove', bx, by);
    fire(c2, 'pointerup', bx, by);
  }
  await sleep(400);
  R.handAfterMiss = G.hand.length;
  R.missCancelled = R.handAfterMiss === R.handBefore3;

  // 4) 结束回合按钮
  document.getElementById('btn-end').click();
  await sleep(900);
  R.phaseAfterEnd = G.phase;
  R.turn = G.turn;
  R.errs = errs;
  return R;
})()`;
const r = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: 30000 });
console.log(JSON.stringify(r.result && r.result.result && r.result.result.value, null, 1));
if (r.result && r.result.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails).slice(0, 700));
ws.close(); process.exit(0);
