import * as THREE from 'three';
import type { EnemyConfig } from './enemyConfigs';

export class Enemy {
  active = true;
  dying = false;
  dieT = 0;
  flashTimer = 0;
  hitCooldown = 0;
  hp: number;
  yaw = 0;
  eyeA = 0;
  eyeB = 0;
  wobblePhase = Math.random() * Math.PI * 2;
  readonly pos = new THREE.Vector3();

  constructor(
    readonly config: EnemyConfig,
    readonly slot: number,
    hp: number,
    readonly speed: number,
    readonly damage: number,
    readonly xp: number,
    readonly scale: number
  ) {
    this.hp = hp;
  }

  get radius(): number {
    return this.config.radius * this.scale;
  }
}
