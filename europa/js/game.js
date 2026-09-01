// 游戏循环：把经济、军事、海军、叛乱、外交、事件、AI 串起来。
//
// tick 的粒度是「周」（每月 4 tick）。移动、战斗、围城每 tick 都跑，
// 经济与外交每月一次 —— 这是 EU4 的节奏，也是性能与手感的折中。

import { monthlyTick } from './economy.js';
import { updateMovement, resolveBattles, updateSieges, resolveRebels } from './military.js';
import { updateFleets, resolveNavalBattles } from './navy.js';
import { monthlyDiploTick } from './diplomacy.js';
import { checkEvents } from './events.js';
import { aiTurn } from './ai.js';
import { dateStr } from './world.js';
import { makeRng } from './rng.js';

export const SPEEDS = [0, 1, 2, 4]; // 0=暂停

export function initGame(world, opts = {}) {
  world.playerTag = opts.playerTag || world.playerTag || 'FRA';
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

  updateMovement(world);
  updateFleets(world);

  if (world.stats.tick % 4 === 0) {
    monthlyTick(world);
    monthlyDiploTick(world);
    const evs = checkEvents(world, rng);
    if (evs.length) world.eventQueue.push(...evs);
    aiTurn(world);
  }

  const battles = resolveBattles(world, rng);
  const naval = resolveNavalBattles(world, rng);
  const sieges = updateSieges(world, rng);
  const rebelEvents = resolveRebels(world, rng);

  for (const b of battles) {
    const p = world.provinces.get(b.pid);
    world.log.push(`${world.countries.get(b.a).name} 与 ${world.countries.get(b.b).name} 在 ${p?.name} 交战`);
  }
  for (const n of naval) {
    world.log.push(`${world.countries.get(n.winner).name} 的舰队击败了 ${world.countries.get(n.loser).name} 的舰队`);
  }
  for (const s of sieges) {
    const p = world.provinces.get(s.pid);
    world.log.push(`${world.countries.get(s.tag).name} 攻占了 ${p?.name}`);
  }
  for (const r of rebelEvents) {
    const p = world.provinces.get(r.pid);
    if (r.type === 'crushed') world.log.push(`${p?.name} 的叛乱被镇压`);
    else if (r.type === 'occupied') world.log.push(`叛军占据了 ${p?.name}`);
  }
  if (world.log.length > 400) world.log.splice(0, world.log.length - 400);

  return { date: dateStr(world.date), battles, naval, sieges };
}
