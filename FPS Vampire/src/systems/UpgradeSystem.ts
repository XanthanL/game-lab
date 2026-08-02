import type { Player } from '../player/Player';
import type { WeaponManager } from '../weapons/WeaponManager';
import { WEAPON_CONFIGS } from '../weapons/weaponConfigs';
import { BALANCE } from '../config/constants';
import { PASSIVE_DEFS, recomputeStats } from './passiveDefs';

export type UpgradeOption =
  | {
      kind: 'weapon';
      id: string;
      name: string;
      desc: string;
      icon: string;
      level: number;
      nextLevel: number;
      maxLevel: number;
    }
  | {
      kind: 'passive';
      id: string;
      name: string;
      desc: string;
      icon: string;
      level: number;
      nextLevel: number;
      maxLevel: number;
    };

export class UpgradeSystem {
  constructor(
    private player: Player,
    private weapons: WeaponManager
  ) {}

  xpToNext(level: number): number {
    return 5 + level * 3;
  }

  checkLevelUp(): boolean {
    if (this.player.xp < this.xpToNext(this.player.level)) return false;
    this.player.xp -= this.xpToNext(this.player.level);
    this.player.level++;
    return true;
  }

  roll(count: number): UpgradeOption[] {
    const options: UpgradeOption[] = [];
    const owned = this.weapons.getWeapons();
    for (const cfg of Object.values(WEAPON_CONFIGS)) {
      const w = owned.find((x) => x.config.id === cfg.id);
      if (w) {
        if (w.level >= cfg.maxLevel) continue;
        options.push({
          kind: 'weapon',
          id: cfg.id,
          name: cfg.name,
          desc: '伤害提升、冷却缩短',
          icon: cfg.icon,
          level: w.level,
          nextLevel: w.level + 1,
          maxLevel: cfg.maxLevel,
        });
      } else if (owned.length < BALANCE.MAX_WEAPONS) {
        options.push({
          kind: 'weapon',
          id: cfg.id,
          name: cfg.name,
          desc: '获得新武器',
          icon: cfg.icon,
          level: 0,
          nextLevel: 1,
          maxLevel: cfg.maxLevel,
        });
      }
    }
    for (const def of PASSIVE_DEFS) {
      const level = this.player.passiveLevels[def.id] ?? 0;
      if (level >= def.maxLevel) continue;
      options.push({
        kind: 'passive',
        id: def.id,
        name: def.name,
        desc: def.desc(level + 1),
        icon: def.icon,
        level,
        nextLevel: level + 1,
        maxLevel: def.maxLevel,
      });
    }
    return this.shuffle(options).slice(0, count);
  }

  apply(option: UpgradeOption): void {
    if (option.kind === 'weapon') {
      const w = this.weapons.getWeapons().find((x) => x.config.id === option.id);
      if (w) {
        w.levelUp();
      } else {
        this.weapons.addWeapon(WEAPON_CONFIGS[option.id]);
      }
    } else {
      this.player.passiveLevels[option.id] = option.nextLevel;
      recomputeStats(this.player);
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
