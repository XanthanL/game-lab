// 冒烟测试：生成世界并跑若干年，检查没有未捕获异常、且模拟结果合理
import { createWorld } from '../js/world.js';
import { initGame, tick } from '../js/game.js';

const MONTHS = Number(process.argv[2] || 120); // 默认 10 年
const world = createWorld({ seed: 'smoke', playerTag: 'FRA' });
initGame(world, { playerTag: 'FRA' });
world.paused = false;
world.speed = 1;

const land = [...world.provinces.values()].filter((p) => !p.sea);
const sum = (f) => [...world.countries.values()].reduce((s, c) => s + f(c), 0);

console.log(`世界：${land.length} 个陆地省 / ${world.provinces.size - land.length} 个海域 / ${world.countries.size} 个国家`);
console.log(`开局：常备军 ${sum((c) => c.armies.length)} 支 / ${sum((c) => c.armies.reduce((s, a) => s + a.size, 0))} 千人`);

const mark = [];
const t0 = Date.now();
for (let i = 0; i < MONTHS * 4; i++) {
  tick(world);
  if (i % (MONTHS * 4 / 5) === 0 && i > 0) {
    mark.push({
      date: `${world.date.y}.${world.date.m}`,
      wars: world.wars.filter((w) => w.active).length,
      armies: sum((c) => c.armies.length),
      men: Math.round(sum((c) => c.armies.reduce((s, a) => s + a.size, 0))),
      states: [...world.countries.values()].filter((c) => c.provinces.size > 0).length,
    });
  }
}
const ms = Date.now() - t0;

const alive = [...world.countries.values()].filter((c) => c.provinces.size > 0);
const sizes = alive.map((c) => ({ tag: c.tag, name: c.name, n: c.provinces.size, dev: c.development, gold: Math.round(c.treasury) }))
  .sort((a, b) => b.n - a.n);

console.log(`\n跑完 ${MONTHS} 个月（${world.date.y} 年 ${world.date.m} 月），耗时 ${ms}ms`);
for (const m of mark) console.log(`  ${m.date}  战争 ${String(m.wars).padStart(2)}  军队 ${String(m.armies).padStart(3)} 支 ${String(m.men).padStart(5)} 千人  存活国家 ${m.states}`);

console.log(`\n存活国家 ${alive.length} / ${world.countries.size}，被吞并 ${world.countries.size - alive.length}`);
console.log('最大五国：', sizes.slice(0, 5).map((x) => `${x.name}(${x.n}省/${x.dev}发展度)`).join('、'));
console.log('最小五国：', sizes.slice(-5).map((x) => `${x.name}(${x.n}省)`).join('、'));
console.log(`战争总数 ${world.wars.length}，进行中 ${world.wars.filter((w) => w.active).length}`);
console.log(`国库合计 ${sizes.reduce((s, x) => s + x.gold, 0)} 杜卡特`);
const sample = [...world.countries.values()].filter((c) => c.provinces.size >= 6 && c.provinces.size <= 12).slice(0, 5);
for (const c of sample) {
  console.log(`  ${c.name.padEnd(8)} ${c.provinces.size}省 发展度${String(c.development).padStart(3)} 收入 ${c.stats.income.toFixed(1)} 支出 ${c.stats.expense.toFixed(1)} 国库 ${Math.round(c.treasury)} 人力 ${Math.round(c.manpower)}/${c.maxManpower} 兵力上限 ${c.forceLimit}`);
}

// 健康检查
const problems = [];
if (alive.length < world.countries.size * 0.8) problems.push(`国家灭亡过快（仅剩 ${alive.length}）`);
if (sum((c) => c.armies.length) === 0) problems.push('全世界没有军队');
if (world.wars.length === 0) problems.push('十年没有爆发任何战争');
const negTreasury = [...world.countries.values()].filter((c) => c.treasury < 0).length;
if (negTreasury) problems.push(`${negTreasury} 个国家国库为负`);
const nan = [...world.countries.values()].filter((c) => !Number.isFinite(c.treasury) || !Number.isFinite(c.manpower) || !Number.isFinite(c.development)).length;
if (nan) problems.push(`${nan} 个国家出现 NaN`);

if (problems.length) { console.error('\n✗ ' + problems.join('；')); process.exit(1); }
console.log('\n✓ 冒烟测试通过');
