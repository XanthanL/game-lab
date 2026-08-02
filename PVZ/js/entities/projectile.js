// 子弹实体：豌豆/冰豌豆，命中判定与命中特效
(function () {
  'use strict';

  PVZ.Pea = class {
    constructor(row, x, y, damage, speed, ice) {
      this.row = row;
      this.x = x;
      this.y = y;
      this.damage = damage;
      this.speed = speed;
      this.ice = !!ice;
      this.t = 0;
      this.dead = false;
    }

    update(dt, game) {
      this.t += dt;
      this.x += this.speed * dt;

      const z = game.getZombieInRow(this.row, this.x);
      if (z) {
        game.spawnParticles(this.x, this.y - 20, {
          colors: ['#7cb342', '#9ccc65', '#dcedc8'],
          count: 5, speed: 80, life: 0.3, size: 2.5, gravity: 300
        });
        z.takeDamage(this.damage);
        if (z.hp <= 0) {
          game.spawnParticles(z.x, z.y - 40, {
            colors: ['#a6b078', '#7c8a5e', '#66734a'],
            count: 12, speed: 150, life: 0.6, size: 3, gravity: 420
          });
        }
        if (this.ice) z.applySlow(4);
        game.removePea(this);
        return;
      }
      if (this.x > PVZ.config.canvasWidth + 40) game.removePea(this);
    }

    render(ctx) {
      PVZ.art.drawPea(ctx, this.x, this.y, this.ice);
    }
  };
})();
