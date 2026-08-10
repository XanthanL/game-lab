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
  private activeIndex = 0;
  private pools: GroundPools;
  private lightnings: Lightnings;
  private swings: Swings;
  onHeavy?: () => void;
  onFire?: () => void;
  onWeaponAdded?: (config: WeaponConfig) => void;
  onActiveChanged?: (config: WeaponConfig) => void;

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
    w.onFire = () => this.onFire?.();
    this.weapons.push(w);
    // 自动装备最新获得的武器，让玩家立即能用上
    this.activeIndex = this.weapons.length - 1;
    this.onWeaponAdded?.(config);
    this.onActiveChanged?.(this.getActiveConfig());
  }

  clear(): void {
    this.weapons = [];
    this.activeIndex = 0;
  }

  getWeapons(): Weapon[] {
    return this.weapons;
  }

  getActiveIndex(): number {
    return this.activeIndex;
  }

  getActiveConfig(): WeaponConfig {
    return this.weapons[this.activeIndex].config;
  }

  /** 直接切换到指定槽位（数字键 1-5）。 */
  setActive(index: number): void {
    if (index < 0 || index >= this.weapons.length || index === this.activeIndex) return;
    this.activeIndex = index;
    this.onActiveChanged?.(this.getActiveConfig());
  }

  /** 循环切换武器（滚轮 / Q）。 */
  cycle(dir: number): void {
    const len = this.weapons.length;
    if (len <= 1) return;
    this.activeIndex = (this.activeIndex + dir + len) % len;
    this.onActiveChanged?.(this.getActiveConfig());
  }

  /** 手动开火：仅当前装备的武器沿瞄准方向发射（受自身冷却限制）。 */
  fire(aimDir: THREE.Vector3, origin: THREE.Vector3): void {
    const w = this.weapons[this.activeIndex];
    if (w) w.fire(origin, aimDir);
  }

  update(dt: number): void {
    for (const w of this.weapons) {
      w.update(dt);
    }
    this.pools.update(dt);
    this.lightnings.update(dt);
    this.swings.update(dt);
  }
}
