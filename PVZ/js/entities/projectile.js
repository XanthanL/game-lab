// 子弹实体：豌豆 / 冰豌豆 / 火球（经火炬树桩转化） / 投弹（西瓜/玉米），命中判定与特效
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
      this.fire = false;
      this.fired = false;
      this.t = 0;
      this.dead = false;
      // 投弹属性
      this.isBomb = false;
      this.bombDamage = 0;
      this.bombRadius = 0;
      this.butterStun = 0;
      this.pierce = false; // 大喷菇穿透
    }

    update(dt, game) {
      this.t += dt;
      this.x += this.speed * dt;

      // 火炬树桩：豌豆经过被点燃为火球
      if (!this.fired && !this.isBomb) {
        const tw = game.torchAt(this.row, this.x);
        if (tw) {
          this.fired = true;
          this.fire = true;
          this.ice = false;
          this.damage = Math.round(this.damage * 1.6);
          PVZ.audio.play('torch');
        }
      }

      // 投弹类：抛物线轨迹 + 范围爆炸
      if (this.isBomb) {
        // 简化抛物线：y 随 x 变化
        this.y -= Math.abs(Math.sin(this.t * 4)) * 15;
        const z = game.getZombieInRow(this.row, this.x);
        if (z && z.state !== 'dead') {
          // 范围爆炸
          const c = PVZ.config;
          game.spawnParticles(this.x, this.y - 20, {
            colors: ['#66bb6a', '#a5d6a7', '#dcedc8'],
            count: 14, speed: 160, life: 0.5, size: 3.5, gravity: 350
          });
          // 对范围内所有僵尸造成伤害
          for (const tz of game.zombies) {
            if (tz.state === 'dead') continue;
            const tcol = Math.floor((tz.x - c.lawnOffsetX) / c.cellWidth);
            const pcol = Math.floor((this.x - c.lawnOffsetX) / c.cellWidth);
            if (Math.abs(tz.row - this.row) <= this.bombRadius && Math.abs(tcol - pcol) <= this.bombRadius) {
              tz.takeDamage(this.bombDamage || this.damage);
              if (this.butterStun > 0) tz.applySlow(this.butterStun);
            }
          }
          game.removePea(this);
          return;
        }
        if (this.x > PVZ.config.canvasWidth + 40) { game.removePea(this); return; }
        return;
      }

      // 普通豌豆/冰豌豆/火球
      const z = game.getZombieInRow(this.row, this.x);
      if (z) {
        // 催眠僵尸不攻击
        if (z.hypnotized) {
          // 催眠僵尸被豌豆击中后恢复正常（简化处理）
          z.hypnotized = false;
          game.removePea(this);
          return;
        }
        if (this.fire) {
          game.spawnParticles(this.x, this.y - 20, {
            colors: ['#ff7043', '#ffca28', '#fff3e0'],
            count: 8, speed: 120, life: 0.4, size: 3, gravity: 200
          });
          z.slowT = 0;
        } else {
          game.spawnParticles(this.x, this.y - 20, {
            colors: ['#7cb342', '#9ccc65', '#dcedc8'],
            count: 5, speed: 80, life: 0.3, size: 2.5, gravity: 300
          });
        }
        z.takeDamage(this.damage);
        if (z.hp <= 0) {
          game.spawnParticles(z.x, z.y - 40, {
            colors: ['#a6b078', '#7c8a5e', '#66734a'],
            count: 12, speed: 150, life: 0.6, size: 3, gravity: 420
          });
        }
        if (this.ice) z.applySlow(4);
        if (!this.pierce) {
          game.removePea(this);
          return;
        }
        // 穿透：继续飞行，但伤害减半
        this.damage = Math.round(this.damage * 0.6);
      }
      if (this.x > PVZ.config.canvasWidth + 40) game.removePea(this);
    }

    render(ctx) {
      if (this.isBomb) {
        // 投弹绘制（西瓜粒/玉米粒）
        ctx.save();
        if (this.bombDamage >= 80) {
          // 西瓜：绿色大圆
          ctx.fillStyle = PVZ.art._rgrad ? null : '#43a047';
          const g = ctx.createRadialGradient(this.x - 2, this.y - 2, 1, this.x, this.y, 8);
          g.addColorStop(0, '#81c784'); g.addColorStop(1, '#2e7d32');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // 玉米粒：黄色小椭圆
          ctx.fillStyle = '#ffee58';
          ctx.beginPath(); ctx.ellipse(this.x, this.y, 6, 5, 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      } else {
        PVZ.art.drawPea(ctx, this.x, this.y, this.ice, this.fire);
      }
    }
  };
})();
