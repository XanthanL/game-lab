import * as THREE from 'three';
import { Weapon } from './Weapon';
import { Projectiles } from './Projectiles';
import { GroundPools } from './GroundPools';
import { Lightnings } from './Lightnings';
import { Swings } from './Swings';
import type { WeaponConfig } from './weaponConfigs';
import type { EnemyManager } from '../enemies/EnemyManager';
import type { Player } from '../player/Player';

export class WeaponManager {
  private weapons: Weapon[] = [];
  private pools: GroundPools;
  private lightnings: Lightnings;
  private swings: Swings;
  onHeavy?: () => void;

  constructor(
    scene: THREE.Scene,
    private projectiles: Projectiles,
    private enemies: EnemyManager,
    private player: Player
  ) {
    this.pools = new GroundPools(scene, enemies);
    this.lightnings = new Lightnings(scene);
    this.swings = new Swings(scene);
  }

  addWeapon(config: WeaponConfig): void {
    const w = new Weapon(
      config,
      this.projectiles,
      this.pools,
      this.lightnings,
      this.swings,
      this.enemies,
      this.player
    );
    w.onHeavy = this.onHeavy;
    this.weapons.push(w);
  }

  clear(): void {
    this.weapons = [];
  }

  getWeapons(): Weapon[] {
    return this.weapons;
  }

  update(dt: number, origin: THREE.Vector3, yaw: number): void {
    for (const w of this.weapons) {
      w.update(dt, origin, yaw);
    }
    this.pools.update(dt);
    this.lightnings.update(dt);
    this.swings.update(dt);
  }
}
