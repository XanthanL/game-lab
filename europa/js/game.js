// 游戏循环：把经济、军事、外交、事件、AI 串起来
import { monthlyTick } from './economy.js';
import { updateMovement, resolveBattles, updateSieges } from './military.js';
import { monthlyDiploTick } from './diplomacy.js';
import { checkEvents } from './events.js';
import { aiTurn } from './ai.js';
import { dateStr } from './world.js';
import { makeRng } from './rng.js';

export const SPEEDS = [0, 1, 2, 4]; // 0=暂停

export function initGame(world, opts = {}) {
  world.playerTag = opts.playerTag || 'FRA';
  world.paused = true;
  world.speed = 1;
  world.stats.tick = 0;
  world.log = [];
  world.eventQueue = [];
  return world;
}

export function tick(world) {
  if (world.paused || world.speed === 0) return null;
  world.stats.tick++;
  const rng = makeRng(world.seed + '/tick/' + world.stats.tick);

  // 移动
  updateMovement(world);

  // 每月一次
  if (world.stats.tick % 4 === 0) {
    monthlyTick(world);
    monthlyDiploTick(world);
    const evs = checkEvents(world, rng);
    if (evs.length) world.eventQueue.push(...evs);
    aiTurn(world);
  }

  // 战斗 / 围城 每 tick 都跑（军队抵达后立即触发）
  const battles = resolveBattles(world, rng);
  const sieges = updateSieges(world, rng);
  for (const b of battles) {
    const p = world.provinces.get(b.pid);
    world.log.push(`${world.countries.get(b.a).name} 与 ${world.countries.get(b.b).name} 在 ${p.name} 交战`);
  }
  for (const s of sieges) {
    const p = world.provinces.get(s.pid);
    world.log.push(`${world.countries.get(s.tag).name} 攻占了 ${p.name}`);
  }
  if (world.log.length > 400) world.log.splice(0, world.log.length - 400);

  return { date: dateStr(world.date), battles, sieges };
}
