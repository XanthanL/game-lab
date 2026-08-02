export type EnemyTypeId = 'grunt' | 'runner' | 'brute' | 'elite' | 'boss';

export interface EnemyConfig {
  id: EnemyTypeId;
  shape: 'box' | 'cone' | 'octahedron';
  color: number;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  radius: number;
  poolSize: number;
  weight: number;
  unlockAt: number;
}

export const ENEMY_TYPES: EnemyConfig[] = [
  {
    id: 'grunt',
    shape: 'box',
    color: 0x8a3b5c,
    hp: 20,
    speed: 3.2,
    damage: 10,
    xp: 1,
    scale: 1,
    radius: 0.5,
    poolSize: 90,
    weight: 1.0,
    unlockAt: 0,
  },
  {
    id: 'runner',
    shape: 'cone',
    color: 0xc94f4f,
    hp: 12,
    speed: 5.4,
    damage: 8,
    xp: 1,
    scale: 0.8,
    radius: 0.4,
    poolSize: 40,
    weight: 0.35,
    unlockAt: 20,
  },
  {
    id: 'brute',
    shape: 'octahedron',
    color: 0x4f4f9e,
    hp: 80,
    speed: 1.8,
    damage: 22,
    xp: 5,
    scale: 1.7,
    radius: 0.9,
    poolSize: 12,
    weight: 0.12,
    unlockAt: 45,
  },
  {
    id: 'elite',
    shape: 'octahedron',
    color: 0xff4d6d,
    hp: 220,
    speed: 2.7,
    damage: 30,
    xp: 15,
    scale: 1.6,
    radius: 0.85,
    poolSize: 8,
    weight: 0.06,
    unlockAt: 60,
  },
  {
    id: 'boss',
    shape: 'octahedron',
    color: 0xb91c1c,
    hp: 1500,
    speed: 1.5,
    damage: 45,
    xp: 60,
    scale: 3.4,
    radius: 1.7,
    poolSize: 2,
    weight: 0,
    unlockAt: 99999,
  },
];
