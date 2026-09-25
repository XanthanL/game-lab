/* 出牌交互探针：合成 pointer 事件验证「点击出牌」「拖到敌人出牌」「拖到空白取消」三条路径。
   ⚠️ 每个用例都先把战场钉成确定状态再动手。老版本是"跑完一步 sleep 400ms 读结果"，
      靠 220ms 的旧出牌时序侥幸通过；出牌演出把时序拉长之后基线立刻被自动回合污染
      （读到的是敌人回合清空手牌的结果，不是拖拽的结果）。
   用法：先带 --remote-debugging-port=9333 起一个 Chrome，然后 node .probe-click.mjs */
const PORT = 9333;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page');
if (!page) { console.log('no page target'); process.exit(1); }
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
  const R = { cases: [] };
  const add = (id, pass, extra) => R.cases.push({ id, pass: !!pass, extra });

  const fire = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, isPrimary: true }));
  const cards = () => [...document.querySelectorAll('#hand .card')];
  const rect = () => document.getElementById('game').getBoundingClientRect();
  const sc = () => rect().width / 640;
  const toScreen = (gx, gy) => { const r = rect(); return [r.left + gx * sc(), r.top + gy * sc()]; };
  const centre = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const cardCentre = i => { const c = cards()[i]; return c ? centre(c) : null; };
  const waitIdle = async () => { for (let i = 0; i < 40 && G.busy; i++) await sleep(50); };

  // 把战场钉成确定状态：手牌内容、电量、敌人血量都自己定，绕开自动回合的干扰
  const setup = (ids, opt = {}) => {
    const e = G.enemy, pl = G.player;
    e.baseMaxHp = 9999; e.hp = 9999; e.shield = 0;
    pl.baseMaxHp = 9999; pl.hp = 9999;
    pl.baseBattery = opt.battery == null ? 9 : opt.battery;
    pl.battery = pl.baseBattery;
    pl.status.strength = 0; pl.status.weak = 0;
    G.asc = 0; G.turn = 1; G.phase = 'player'; G.busy = false;
    G.hand = ids.map(id => createCardInstance(CARD_DEFS[id]));
    G.draw = []; G.discard = []; G.exhaust = [];
    FX.parts.length = 0; FX.floats.length = 0; FX.rings.length = 0;
    if (typeof clearFlyCards === 'function') clearFlyCards();
    renderHand(); updateHud();
  };
  const flyEls = () => [...document.querySelectorAll('#fxcards .card')];

  /* ---------- 1) 点击出牌 ---------- */
  setup(['laserShot', 'laserShot', 'laserShot']);
  const hp0 = G.enemy.hp;
  let c = cardCentre(0);
  fire(cards()[0], 'pointerdown', c[0], c[1]);
  fire(cards()[0], 'pointerup', c[0], c[1]);
  await sleep(60);
  add('C1 点击后手牌立即少一张', G.hand.length === 2, 'hand=' + G.hand.length);
  add('C2 点击后卡牌在飞（不是瞬间消失）', flyEls().length === 1, 'flying=' + flyEls().length);
  await waitIdle();
  await sleep(200);
  add('C3 点击出牌最终打出了伤害', G.enemy.hp < hp0, hp0 + '→' + G.enemy.hp);
  add('C4 演出结束后飞行层清空', flyEls().length === 0);

  /* ---------- 2) 拖到敌人身上出牌 ---------- */
  setup(['laserShot', 'laserShot', 'laserShot']);
  const hp1 = G.enemy.hp;
  c = cardCentre(0);
  const [ex, ey] = toScreen(470, 150);
  fire(cards()[0], 'pointerdown', c[0], c[1]);
  fire(cards()[0], 'pointermove', c[0] + 20, c[1] - 30);
  fire(cards()[0], 'pointermove', ex, ey);
  fire(cards()[0], 'pointerup', ex, ey);
  await sleep(60);
  add('C5 拖到敌人身上能出牌', G.hand.length === 2, 'hand=' + G.hand.length);
  {
    // 从松手的位置起飞，而不是先弹回手牌位
    const f = flyEls()[0];
    const startLeft = f ? parseFloat(f.style.left) : null;
    add('C6 卡牌从松手位置起飞（不是弹回手牌位）', f != null && startLeft > 200,
      'startLeft=' + (startLeft == null ? 'null' : Math.round(startLeft)) + '（手牌位约 ' + Math.round((640 - (3 * 96 + 2 * 6)) / 2) + '）');
  }
  await waitIdle();
  await sleep(200);
  add('C7 拖拽出牌最终打出了伤害', G.enemy.hp < hp1, hp1 + '→' + G.enemy.hp);

  /* ---------- 3) 拖到空白处应取消 ---------- */
  setup(['laserShot', 'laserShot', 'laserShot']);
  const hp2 = G.enemy.hp;
  c = cardCentre(0);
  const [bx, by] = toScreen(80, 120);
  fire(cards()[0], 'pointerdown', c[0], c[1]);
  fire(cards()[0], 'pointermove', c[0] + 20, c[1] - 30);
  fire(cards()[0], 'pointermove', bx, by);
  fire(cards()[0], 'pointerup', bx, by);
  await sleep(500);
  add('C8 拖到空白处不出牌（手牌不变）', G.hand.length === 3, 'hand=' + G.hand.length);
  add('C9 拖到空白处敌人不掉血', G.enemy.hp === hp2, 'hp=' + G.enemy.hp);
  add('C10 拖到空白处没有卡在飞', flyEls().length === 0);
  {
    const back = cards()[0];
    const top = back ? parseFloat(back.style.top) : null;
    add('C11 取消后卡牌回到手牌位（y=244）', top === 244, 'top=' + top);
  }

  /* ---------- 4) 电量不足的牌点不动 ---------- */
  setup(['overchargeBlast'], { battery: 0 });   // 2 费
  const hp3 = G.enemy.hp;
  add('C12 电量不足时卡牌渲染成不可用', cards()[0].classList.contains('no'));
  c = cardCentre(0);
  fire(cards()[0], 'pointerdown', c[0], c[1]);
  fire(cards()[0], 'pointerup', c[0], c[1]);
  await sleep(300);
  add('C13 电量不足点了不出牌', G.hand.length === 1 && G.enemy.hp === hp3, 'hand=' + G.hand.length + ' hp=' + G.enemy.hp);

  /* ---------- 5) 不可打出的诅咒牌点不动 ---------- */
  setup([]);
  G.hand = [createCurseCard()];
  renderHand(); updateHud();
  const hp4 = G.enemy.hp;
  c = cardCentre(0);
  // ⚠️ 不可打出的牌走的是 onclick（不是 onpointerdown/up）——
  //    合成的 pointerdown+pointerup **不会**派生出 click，所以这里必须直接派发 click。
  cards()[0].dispatchEvent(new MouseEvent('click', { clientX: c[0], clientY: c[1], bubbles: true }));
  await sleep(300);
  add('C14 诅咒牌点了不出牌', G.hand.length === 1 && G.enemy.hp === hp4, 'hand=' + G.hand.length);
  add('C15 诅咒牌标了「无法打出」', FX.floats.some(f => /无法打出/.test(f.text)), JSON.stringify(FX.floats.map(f => f.text)));

  /* ---------- 6) 结束回合按钮 ---------- */
  setup(['laserShot']);
  document.getElementById('btn-end').click();
  await sleep(1200);
  add('C16 结束回合按钮生效', G.phase === 'enemy' || G.turn >= 2, 'phase=' + G.phase + ' turn=' + G.turn);

  R.errs = errs;
  return R;
})()`;
const r = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true, timeout: 60000 });
const v = r.result && r.result.result && r.result.result.value;
if (!v) { console.log('PROBE ERROR', JSON.stringify(r.result, null, 1)); process.exit(2); }
let pass = 0;
for (const c of v.cases) {
  if (c.pass) pass++;
  console.log((c.pass ? '  PASS  ' : '  FAIL  ') + c.id + (c.extra != null ? '   ' + c.extra : ''));
}
console.log('\n' + (pass === v.cases.length ? 'ALL PASS' : 'FAILED') + '  ' + pass + '/' + v.cases.length);
if (v.errs && v.errs.length) console.log('页面报错：', v.errs);
process.exit(pass === v.cases.length && (!v.errs || !v.errs.length) ? 0 : 1);
