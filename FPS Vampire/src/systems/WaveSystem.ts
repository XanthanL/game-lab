import type { EnemyManager } from '../enemies/EnemyManager';

interface ScheduledEvent {
  at: number;
  done: boolean;
  run: () => void;
}

export class WaveSystem {
  private events: ScheduledEvent[] = [];

  constructor(
    private enemies: EnemyManager,
    private announce: (msg: string) => void
  ) {
    this.schedule(60, () => this.announce('精英开始出现！'));
    this.schedule(90, () => {
      this.enemies.forceSpawn('elite', 4, true);
      this.announce('⚠ 精英涌入！');
    });
    this.schedule(180, () => {
      this.enemies.forceSpawn('boss', 1, true);
      this.announce('⚠ BOSS 降临！');
    });
    this.schedule(330, () => {
      this.enemies.forceSpawn('boss', 1, true);
      this.announce('⚠ BOSS 再临！');
    });
  }

  private schedule(at: number, run: () => void): void {
    this.events.push({ at, done: false, run });
  }

  update(elapsed: number): void {
    for (const e of this.events) {
      if (!e.done && elapsed >= e.at) {
        e.done = true;
        e.run();
      }
    }
  }

  reset(): void {
    for (const e of this.events) {
      e.done = false;
    }
  }
}
