import * as THREE from 'three';
import type { WeaponConfig } from './weaponConfigs';
import type { EnemyManager } from '../enemies/EnemyManager';
import type { Projectiles } from './Projectiles';
import type { GroundPools } from './GroundPools';
import type { Lightnings } from './Lightnings';
import type { Swings } from './Swings';
import type { Player } from '../player/Player';
import { sound } from '../audio/SoundManager';

export class Weapon {
  level = 1;
  onHeavy?: () => void;
  onFire?: () => void;
  private timer = 0;

  constructor(
    readonly config: WeaponConfig,
    private projectiles: Projectiles,
    private pools: GroundPools,
    private lightnings: Lightnings,
    private swings: Swings,
    private enemies: EnemyManager,
    private player: Player
  ) {}

  get cooldown(): number {
    return this.config.cooldown * Math.pow(0.92, this.level - 1) * (1 - this.player.stats.haste);
  }

  get damage(): number {
    return this.config.damage * (1 + 0.25 * (this.level - 1)) * this.player.stats.damageMult;
  }

  levelUp(): void {
    if (this.level < this.config.maxLevel) this.level++;
  }

  update(dt: number): void {
    this.timer -= dt;
  }

  /** 玩家手动开火：沿 aimDir 方向发射（不再自动连发）。 */
  fire(origin: THREE.Vector3, aimDir: THREE.Vector3): void {
    if (this.timer > 0) return;
    switch (this.config.behavior) {
      case 'bullet':
        this.fireBullet(origin, aimDir);
        break;
      case 'boomerang':
        this.fireBoomerang(origin, aimDir);
        break;
      case 'groundAoE':
        this.throwPool(origin, aimDir);
        break;
      case 'beam':
        this.castLightning(origin);
        break;
      case 'meleeSwing':
        this.swing(origin, aimDir);
        break;
    }
  }

  private fireBullet(origin: THREE.Vector3, aimDir: THREE.Vector3): void {
    const dir = aimDir.clone().normalize();
    const start = origin.clone().addScaledVector(dir, 0.6);
    this.timer = this.cooldown;
    this.projectiles.spawnLinear(
      start,
      dir,
      this.config.projectileSpeed,
      this.damage,
      this.config.pierce,
      this.config.range,
      this.config.projectileRadius
    );
    sound.play('shoot');
    this.onFire?.();
  }

  private fireBoomerang(origin: THREE.Vector3, aimDir: THREE.Vector3): void {
    const dir = aimDir.clone().normalize();
    this.timer = this.cooldown;
    this.projectiles.spawnBoomerang(
      origin,
      dir,
      this.config.projectileSpeed,
      this.damage,
      this.config.range,
      this.config.projectileRadius
    );
    sound.play('throw');
    this.onFire?.();
  }

  private throwPool(origin: THREE.Vector3, aimDir: THREE.Vector3): void {
    const hdir = new THREE.Vector3(aimDir.x, 0, aimDir.z);
    if (hdir.lengthSq() < 1e-6) hdir.set(-Math.sin(this.playerYaw(aimDir)), 0, -Math.cos(this.playerYaw(aimDir)));
    hdir.normalize();
    const throwRange = this.config.throwRange ?? 3.5;
    const point = new THREE.Vector3(
      origin.x + hdir.x * throwRange,
      origin.y,
      origin.z + hdir.z * throwRange
    );
    this.timer = this.cooldown;
    this.pools.spawn(
      point,
      this.config.poolRadius ?? 1.7,
      this.config.poolDuration ?? 3,
      this.config.poolTick ?? 0.4,
      this.damage
    );
    sound.play('throw');
    this.onFire?.();
  }

  private playerYaw(aimDir: THREE.Vector3): number {
    return Math.atan2(-aimDir.x, -aimDir.z);
  }

  private castLightning(origin: THREE.Vector3): void {
    const target = this.enemies.getNearestEnemy(origin, this.config.range);
    if (!target) return;
    this.timer = this.cooldown;
    this.enemies.applyDamage(target, this.damage);
    const splash = this.config.splashRadius ?? 1.5;
    for (const e of this.enemies.queryInRadius(target.pos, splash)) {
      if (e !== target) this.enemies.applyDamage(e, this.damage * 0.6);
    }
    this.lightnings.spawn(target.pos);
    sound.play('lightning');
    this.onHeavy?.();
    this.onFire?.();
  }

  private swing(origin: THREE.Vector3, aimDir: THREE.Vector3): void {
    const yaw = this.playerYaw(aimDir);
    this.timer = this.cooldown;
    for (const e of this.enemies.queryInArc(origin, this.config.range, yaw, this.config.meleeHalfAngle ?? 1.0)) {
      this.enemies.applyDamage(e, this.damage);
    }
    this.swings.spawn(origin, yaw);
    sound.play('swing');
    this.onHeavy?.();
    this.onFire?.();
  }
}
