import { BALANCE, PLAYER } from '../config/constants';

export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  damageMult: number;
  armor: number;
  haste: number;
  magnet: number;
}

export class Player {
  readonly stats: PlayerStats = {
    maxHp: PLAYER.MAX_HEALTH,
    moveSpeed: PLAYER.MOVE_SPEED,
    damageMult: 1,
    armor: 0,
    haste: 0,
    magnet: BALANCE.GEM_MAGNET_RADIUS,
  };
  hp = this.stats.maxHp;
  xp = 0;
  kills = 0;
  level = 1;
  passiveLevels: Record<string, number> = {};
  alive = true;
  invulnTimer = 0;
  onDamaged?: (amount: number) => void;

  update(dt: number): void {
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
  }

  takeDamage(raw: number): void {
    if (!this.alive || this.invulnTimer > 0) return;
    this.invulnTimer = BALANCE.IFRAMES;
    const amount = raw * (1 - this.stats.armor / 100);
    this.hp = Math.max(0, this.hp - amount);
    this.onDamaged?.(amount);
    if (this.hp <= 0) this.alive = false;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  reset(): void {
    this.passiveLevels = {};
    this.stats.maxHp = PLAYER.MAX_HEALTH;
    this.stats.moveSpeed = PLAYER.MOVE_SPEED;
    this.stats.damageMult = 1;
    this.stats.armor = 0;
    this.stats.haste = 0;
    this.stats.magnet = BALANCE.GEM_MAGNET_RADIUS;
    this.hp = this.stats.maxHp;
    this.xp = 0;
    this.kills = 0;
    this.level = 1;
    this.alive = true;
    this.invulnTimer = 0;
  }
}
