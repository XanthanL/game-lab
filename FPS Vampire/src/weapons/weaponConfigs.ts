import { ICONS } from '../ui/icons';

export type WeaponBehavior = 'bullet' | 'boomerang' | 'groundAoE' | 'beam' | 'meleeSwing';

export interface WeaponConfig {
  id: string;
  name: string;
  icon: string;
  behavior: WeaponBehavior;
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed: number;
  pierce: number;
  projectileRadius: number;
  maxLevel: number;
  meleeHalfAngle?: number;
  splashRadius?: number;
  throwRange?: number;
  poolRadius?: number;
  poolDuration?: number;
  poolTick?: number;
}

export const WEAPON_CONFIGS: Record<string, WeaponConfig> = {
  magicBolt: {
    id: 'magicBolt',
    name: '魔弹',
    icon: ICONS.magicBolt,
    behavior: 'bullet',
    damage: 10,
    cooldown: 0.85,
    range: 24,
    projectileSpeed: 18,
    pierce: 0,
    projectileRadius: 0.25,
    maxLevel: 5,
  },
  soulBlade: {
    id: 'soulBlade',
    name: '飞剑',
    icon: ICONS.soulBlade,
    behavior: 'boomerang',
    damage: 9,
    cooldown: 1.05,
    range: 7,
    projectileSpeed: 13,
    pierce: 0,
    projectileRadius: 0.4,
    maxLevel: 5,
  },
  holyWater: {
    id: 'holyWater',
    name: '圣水',
    icon: ICONS.holyWater,
    behavior: 'groundAoE',
    damage: 5,
    cooldown: 1.5,
    range: 14,
    projectileSpeed: 0,
    pierce: 0,
    projectileRadius: 0,
    maxLevel: 5,
    throwRange: 3.5,
    poolRadius: 1.7,
    poolDuration: 3,
    poolTick: 0.4,
  },
  lightning: {
    id: 'lightning',
    name: '雷击',
    icon: ICONS.lightning,
    behavior: 'beam',
    damage: 26,
    cooldown: 2.4,
    range: 22,
    projectileSpeed: 0,
    pierce: 0,
    projectileRadius: 0,
    maxLevel: 5,
    splashRadius: 1.8,
  },
  whip: {
    id: 'whip',
    name: '鞭刃',
    icon: ICONS.whip,
    behavior: 'meleeSwing',
    damage: 13,
    cooldown: 0.65,
    range: 3.6,
    projectileSpeed: 0,
    pierce: 0,
    projectileRadius: 0,
    maxLevel: 5,
    meleeHalfAngle: 1.05,
  },
};
