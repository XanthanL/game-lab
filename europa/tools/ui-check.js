// UI 自检：用最小 DOM 桩实例化 ui.js，渲染全部标签页并遍历触发所有 data-act 动作。
// 目的是在没有浏览器的情况下抓出面板渲染与动作分发里的 ReferenceError / TypeError。
// node tools/ui-check.js

/* ── 最小 DOM 桩 ── */
class El {
  constructor(id = '') {
    this.id = id; this.dataset = {}; this.style = {};
    this.innerHTML = ''; this.textContent = ''; this.hidden = false;
    this.scrollTop = 0; this.className = ''; this.title = ''; this.value = '';
    this.children = []; this.classList = { add() {}, remove() {}, toggle() {} };
  }
  appendChild() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
}
const els = new Map();
globalThis.document = {
  getElementById(id) { if (!els.has(id)) els.set(id, new El(id)); return els.get(id); },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return new El(); },
};
globalThis.window = { addEventListener() {} };

const { createWorld } = await import('../js/world.js');
const { initGame, tick } = await import('../js/game.js');
const { UI } = await import('../js/ui.js');

const world = createWorld({ seed: 'ui-check', playerTag: 'FRA' });
initGame(world, { playerTag: 'FRA' });
const renderer = { invalidate() {}, setSelected() {}, setHover() {} };
const ui = new UI({ world, renderer, onLog: () => {} });
ui.render(true);

/* 1) 八个标签页全渲染 */
for (const t of ['province', 'military', 'navy', 'diplomacy', 'trade', 'economy', 'estates', 'ideas']) {
  ui.tab = t;
  const html = ui.renderBody();
  if (typeof html !== 'string' || html.length < 40) throw new Error(`标签页 ${t} 渲染异常`);
}
console.log('✓ 8 个标签页渲染通过');

/* 2) 选中省份与国家后再渲染一轮 */
ui.selProv = world.countries.get('FRA').capital;
ui.selCountry = 'ENG';
for (const t of ['province', 'diplomacy', 'trade']) { ui.tab = t; ui.renderBody(); }
console.log('✓ 选中省份/国家后的面板渲染通过');

/* 3) 遍历动作（含失败路径，只要不抛异常就算过） */
const actions = [
  ['dev', { pid: String(ui.selProv), kind: 'tax' }],
  ['build', { pid: String(ui.selProv), type: 'temple' }],
  ['demolish', { pid: String(ui.selProv), type: 'temple' }],
  ['core', { pid: String(ui.selProv) }],
  ['claim', { pid: String(world.countries.get('ENG').capital) }],
  ['recruitArmy', {}],
  ['recruitGeneral', {}],
  ['armyMove', { id: '-1' }],
  ['armySplit', { id: '-1' }],
  ['armyMerge', { id: '-1' }],
  ['armyReinforce', { id: '-1' }],
  ['armyDisband', { id: '-1' }],
  ['armyGeneral', { id: '-1' }],
  ['buildFleet', {}],
  ['fleetMove', { id: '-1' }],
  ['fleetDisband', { id: '-1' }],
  ['embark', { id: '-1' }],
  ['disembark', { id: '-1' }],
  ['dipImprove', {}], ['dipGift', {}], ['dipMarry', {}], ['dipAlly', {}],
  ['dipBreakAlly', {}], ['dipRival', {}], ['dipUnrival', {}],
  ['dipGuarantee', {}], ['dipAccess', {}], ['declareWar', {}],
  ['peace', { war: '-1' }], ['whitePeace', { war: '-1' }],
  ['merchantCollect', { node: 'channel' }], ['merchantClear', { node: 'channel' }],
  ['autoMerchants', {}],
  ['takeLoan', {}], ['repayLoan', {}], ['mint', {}], ['raiseStab', {}], ['reduceWE', {}],
  ['takeTech', { branch: 'adm' }], ['takeTech', { branch: 'dip' }], ['takeTech', { branch: 'mil' }],
  ['warTax', {}], ['foundBank', {}], ['subsidy', {}],
  ['embargo', {}], ['liftEmbargo', {}],
  ['estateSeize', {}], ['estateDiet', {}], ['estateSell', {}],
  ['policyToggle', { pid: 'pol_mercantile' }],
  ['takeIdea', { gid: 'economic' }],
  ['moveCapital', { pid: '-1' }],
];
const silentLog = () => {};
ui.onLog = silentLog;
for (const [act, ds] of actions) {
  const el = new El();
  el.dataset = { act, ...ds };
  try { ui.doAction(act, el); } catch (err) {
    throw new Error(`动作 ${act} 抛出异常: ${err.message}`);
  }
  if (ui.modal) ui.closeModal();   // 弹窗类动作收尾，别影响下一轮
}
console.log(`✓ ${actions.length} 个动作分发通过（含无目标失败路径）`);

/* 4) 理念/阶级状态推进后再渲染：开 2 组理念 → 政策槽解锁 */
const fra = world.countries.get('FRA');
fra.powers.adm = 9999; fra.powers.dip = 9999; fra.powers.mil = 9999;
fra.tech.adm = 12;
for (const gid of ['economic', 'trade']) {
  const { takeIdea } = await import('../js/ideas.js');
  for (let i = 0; i < 7; i++) takeIdea(world, 'FRA', gid);
}
ui.tab = 'ideas'; ui.renderBody();
ui.tab = 'estates'; ui.renderBody();
if (Math.floor(Object.keys(fra.ideaGroups).length / 2) < 1) throw new Error('两组理念后政策槽未解锁');
console.log('✓ 理念完成组 + 政策槽解锁路径通过');

/* 4.5) 友好度 / 迁都 / 宿敌 / 事件链路 */
const { opinionOf, opinionBreakdown, canRival, addOpinionMod } = await import('../js/diplomacy.js');
const op0 = opinionOf(world, 'FRA', 'ENG');
const bd = opinionBreakdown(world, 'FRA', 'ENG');
if (!Array.isArray(bd) || !bd.length) throw new Error('友好度分解为空');
addOpinionMod(world, 'FRA', 'ENG', 'test', '测试修正', 30, 12);
if (opinionOf(world, 'FRA', 'ENG') !== op0 + 30) throw new Error('友好度修正未生效');
if (Math.abs(opinionOf(world, 'FRA', 'ENG')) > 200) throw new Error('友好度超出 ±200');
if (canRival(world, 'FRA', 'ENG').ok === undefined) throw new Error('canRival 返回异常');
// 迁都：把法兰西朝廷迁到已核心省份
const { moveCapital } = await import('../js/economy.js');
const cap2 = [...fra.provinces].map((id) => world.provinces.get(id))
  .find((p) => p && !p.sea && p.owner === 'FRA' && p.cores.has('FRA') && p.id !== fra.capital);
if (cap2) {
  const r = moveCapital(world, 'FRA', cap2.id);
  if (!r.ok) throw new Error('迁都失败：' + r.why);
  if (fra.capital !== cap2.id || !cap2.capital) throw new Error('迁都后首都标记未更新');
}
// 事件：用变化种子的 rng 触发 200 轮事件检查，不能抛错且要有产出
const { checkEvents } = await import('../js/events.js');
const { makeRng } = await import('../js/rng.js');
let fired = 0;
for (let i = 0; i < 200; i++) fired += checkEvents(world, makeRng('ui-check-evt/' + i)).length;
if (fired === 0) throw new Error('200 轮事件检查没有触发任何事件');
console.log(`✓ 友好度/分解/宿敌资格/迁都通过（200 轮事件检查触发 ${fired} 个事件）`);

/* 5) 模态框生命周期 */
ui.openModal({ title: '测试', body: '<div class="f"><input data-key="n" value="3"/></div>', submit: '确定', onSubmit: () => {} });
if (!ui.modal) throw new Error('模态框未打开');
ui.fieldVal('n');
ui.closeModal();
console.log('✓ 模态框打开/取值/关闭通过');

/* 6) 世界继续跑 24 个月，确认 UI 相关状态字段无 NaN */
world.paused = false;
for (let i = 0; i < 96; i++) tick(world);
for (const c of world.countries.values()) {
  if (!Number.isFinite(c.crownland)) throw new Error(`${c.tag} 王权领地 NaN`);
  if (c.armyTradition != null && !Number.isFinite(c.armyTradition)) throw new Error(`${c.tag} 军事传统 NaN`);
  for (const e of Object.values(c.estates || {})) {
    if (!Number.isFinite(e.influence) || !Number.isFinite(e.loyalty)) throw new Error(`${c.tag} 阶级数据 NaN`);
  }
}
console.log('✓ 24 个月模拟后阶级/传统/领地数据无 NaN');

console.log('\n✓ UI 自检全部通过');
