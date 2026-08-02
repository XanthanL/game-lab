import type { Player } from '../player/Player';
import { BALANCE, PLAYER } from '../config/constants';
import { ICONS } from '../ui/icons';

export interface PassiveDef {
  id: string;
  name: string;
  desc: (level: number) => string;
  icon: string;
  maxLevel: number;
}

export const PASSIVE_DEFS: PassiveDef[] = [
  {
    id: 'hp',
    name: '生命强化',
    desc: (l) => `生命上限 +${20 * l}`,
    icon: ICONS.hp,
    maxLevel: 5,
  },
  {
    id: 'speed',
    name: '迅捷',
    desc: (l) => `移动速度 +${8 * l}%`,
    icon: ICONS.speed,
    maxLevel: 5,
  },
  {
    id: 'damage',
    name: '力量',
    desc: (l) => `伤害 +${12 * l}%`,
    icon: ICONS.damage,
    maxLevel: 5,
  },
  {
    id: 'armor',
    name: '铁壁',
    desc: (l) => `护甲 +${5 * l}（减免伤害）`,
    icon: ICONS.armor,
    maxLevel: 5,
  },
  {
    id: 'magnet',
    name: '磁力',
    desc: (l) => `拾取范围 +${40 * l}%`,
    icon: ICONS.magnet,
    maxLevel: 3,
  },
  {
    id: 'haste',
    name: '急速',
    desc: (l) => `冷却时间 -${8 * l}%`,
    icon: ICONS.haste,
    maxLevel: 5,
  },
];

export function recomputeStats(player: Player): void {
  const lv = (id: string): number => player.passiveLevels[id] ?? 0;
  const prevMax = player.stats.maxHp;
  player.stats.maxHp = PLAYER.MAX_HEALTH * (1 + 0.2 * lv('hp'));
  player.stats.moveSpeed = PLAYER.MOVE_SPEED * (1 + 0.08 * lv('speed'));
  player.stats.damageMult = 1 + 0.12 * lv('damage');
  player.stats.armor = 5 * lv('armor');
  player.stats.haste = 0.08 * lv('haste');
  player.stats.magnet = BALANCE.GEM_MAGNET_RADIUS * (1 + 0.4 * lv('magnet'));
  player.hp += player.stats.maxHp - prevMax;
}
