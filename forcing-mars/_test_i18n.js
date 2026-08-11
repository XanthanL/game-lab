// Stub browser globals, then evaluate i18n.js and test tr()
const fs = require('fs');
const vm = require('vm');

const noop = () => {};
const fakeEl = () => ({ style: {}, addEventListener: noop, appendChild: noop, textContent: '' });
const sandbox = {
  window: {},
  document: {
    getElementById: () => null,
    createElement: fakeEl,
    addEventListener: noop,
    readyState: 'complete',
    body: { appendChild: noop },
  },
  localStorage: { getItem: () => null, setItem: noop },
  Phaser: undefined,
  console,
};
sandbox.window = sandbox; // window === global-ish
vm.createContext(sandbox);
const code = fs.readFileSync('js/i18n.js', 'utf8');
vm.runInContext(code, sandbox);

const tr = sandbox.I18N.tr;
const I18N = sandbox.I18N;

function show(label, s) {
  console.log(label.padEnd(34), '=>', JSON.stringify(tr(s)));
}

console.log('--- lang =', I18N.lang, '---');
// 静态数据
show('card name', '等离子燃烧弹');
show('card desc', '造成 4 点伤害，施加 3 层灼烧');
show('upgrade desc', '灼烧层数翻倍（消耗降为 0）');
show('curse desc', '无法打出。占用手牌位。');
show('relic', '火星动力核心');
show('relic desc', '最大生命值上限 +10');
show('character', '异变者');
show('enemy', '火星吞噬者');
show('enemy phase2 literal', '火星吞噬者 · 狂暴');
show('enemy phase2 dyn', '沙暴暴君 · 狂暴');
show('depth', '地核深处 — 2000m');
show('status icon char', '灼');
// 动态战斗日志 / 浮动文字
show('float burn', '+5 灼烧');
show('float shield', '+8 护盾');
show('float energy', '+1 电量');
show('float gold', '+25 金币');
show('float lifesteal', '+8 吸血');
show('log deal', '火星幼蛭 造成 6 点伤害');
show('log apply status', '等离子燃烧弹 施加（附加3层灼烧）');
show('pile draw', '抽牌堆: 5 张');
show('pile discard', '弃牌堆: 3 张');
show('gold', '◆ 12 金币');
show('turn player', '▶ 玩家回合');
show('turn enemy', '● 敌人回合');
show('end turn btn', '结束回合');
show('buy card', '购买卡牌：等离子燃烧弹（-50金币）');
show('invalid burn', '${enemy} 未处于灼烧状态，无效');
show('story line', '「这里是 EDF 最高指挥部。这不是演习。」');
// 中文模式应原样返回
I18N.lang = 'zh';
show('[zh] card name', '等离子燃烧弹');
I18N.lang = 'en';
console.log('--- done ---');
