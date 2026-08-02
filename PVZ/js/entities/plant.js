// 植物实体：网格上的可种植单位，行为由 config.PLANTS 中的 action 驱动
(function () {
  'use strict';

  PVZ.Plant = class {
    constructor(type, col, row) {
      const cfg = PVZ.config.PLANTS[type];
      const g = PVZ.config;

      this.type = type;
      this.col = col;
      this.row = row;

      // 坐标缓存（静态，避免每帧换算）
      this.cx = g.lawnOffsetX + col * g.cellWidth + g.cellWidth / 2; // 中心 x
      this.cellYTop = g.lawnOffsetY + row * g.cellHeight;            // 格顶 y
      this.px = this.cx;                                             // 绘制锚点 x
      this.py = this.cellYTop + g.cellHeight;                        // 绘制锚点 y（底部中心）

      this.config = cfg;
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;

      this.t = Math.random() * 5;
      this.timer = 0;
      this.hitT = 0;
      this.dead = false;
      this.armed = false;     // 土豆雷武装状态
      this.squashPhase = -1;  // 窝瓜砸落进度（-1 = 蹲守）
      this.squashTargetX = 0;
    }

    update(dt, game) {
      this.t += dt;
      if (this.hitT > 0) this.hitT -= dt;
      if (this.dead) return;

      const a = this.config.action;
      if (!a) return;

      this.timer += dt;

      if (a.type === 'explode') {
        if (this.timer >= a.delay) {
          game.explodeAt(this.col, this.row, a.damage, a.radius);
          this.dead = true;
          game.removePlant(this);
        }
        return;
      }

      if (a.type === 'armed') {
        if (!this.armed && this.timer >= a.delay) this.armed = true;
        if (this.armed && game.getZombieNear(this.row, this.cx, PVZ.config.cellWidth * 0.6)) {
          game.explodeAt(this.col, this.row, a.damage, a.range);
          this.dead = true;
          game.removePlant(this);
        }
        return;
      }

      if (a.type === 'squash') {
        if (this.squashPhase < 0) {
          if (game.getZombieNear(this.row, this.cx, PVZ.config.cellWidth * 0.6)) {
            this.squashPhase = 0;
            this.squashTargetX = this.cx;
          }
        } else {
          this.squashPhase += dt / 0.55;
          if (this.squashPhase >= 1) {
            game.squashHit(this.row, this.squashTargetX, a.damage, a.range);
            this.dead = true;
            game.removePlant(this);
          }
        }
        return;
      }

      if (this.timer < a.interval) return;
      this.timer = 0;

      if (a.type === 'produce') {
        game.sunSystem.spawn(this.cx, this.cellYTop + 30, { value: 50 });
      } else if (a.type === 'shoot') {
        if (!game.hasZombieInRow(this.row)) return;
        const volley = a.volley || 1;
        for (let i = 0; i < volley; i++) {
          game.addPea(new PVZ.Pea(
            this.row,
            this.cx + 15 + i * 10,
            this.cellYTop + 40 + (i % 2 ? 8 : -4),
            20,
            300,
            !!a.ice
          ));
        }
        PVZ.audio.play('shoot');
      }
    }

    takeDamage(dmg) {
      this.hp -= dmg;
      this.hitT = 0.12;
      if (this.hp <= 0) this.dead = true;
    }

    render(ctx) {
      ctx.save();
      if (this.hitT > 0) ctx.translate((Math.random() - 0.5) * 3, 0);
      PVZ.art.drawPlant(ctx, this.type, this.px, this.py, this.t, this.hp / this.maxHp, 1, {
        armed: this.armed,
        phase: this.squashPhase
      });
      ctx.restore();
    }
  };
})();
