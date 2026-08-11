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
      this.torch = !!cfg.torch;

      this.t = Math.random() * 5;
      this.birth = 0;     // 入场弹性动画计时
      this.timer = 0;
      this.hitT = 0;
      this.dead = false;
      this.armed = false;     // 土豆雷武装状态
      this.squashPhase = -1;  // 窝瓜砸落进度（-1 = 蹲守）
      this.squashTargetX = 0;

      // 新增：大嘴花吞噬冷却 / 动画
      this.chompCd = 0;
      this.chomping = 0;
    }

    update(dt, game) {
      this.t += dt;
      this.birth += dt;
      if (this.hitT > 0) this.hitT -= dt;
      if (this.chompCd > 0) this.chompCd -= dt;
      if (this.chomping > 0) this.chomping -= dt;
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

      if (a.type === 'rowclear') {
        if (this.timer >= a.delay) {
          game.rowClear(this.row, a.damage);
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

      if (a.type === 'spikes') {
        const dmg = a.dps * dt;
        const range = PVZ.config.cellWidth * 0.5;
        for (const z of game.zombies) {
          if (z.row === this.row && z.state !== 'dead' && Math.abs(z.x - this.cx) <= range) {
            z.takeDamage(dmg, true); // 无声闪烁的持续伤害
          }
        }
        return;
      }

      if (a.type === 'chomp') {
        if (this.chompCd <= 0) {
          const z = game.getZombieNear(this.row, this.cx, a.range);
          if (z) {
            if (a.hypnotize) {
              // 催眠菇：反转僵尸方向（标记为 hypnotized）
              z.hypnotized = true;
            } else {
              z.takeDamage(a.damage);
            }
            this.chompCd = a.recharge;
            this.chomping = 0.35;
            PVZ.audio.play('chomp');
          }
        }
        return;
      }

      if (a.type === 'magnet') {
        if (this.timer >= a.interval) {
          this.timer = 0;
          const rangeCells = (a.range || 3) * PVZ.config.cellWidth;
          for (const z of game.zombies) {
            if (z.state === 'dead') continue;
            // 同行或相邻行，在范围内，且有护甲
            const rowOk = Math.abs(z.row - this.row) <= 1;
            const distOk = Math.abs(z.x - this.cx) <= rangeCells;
            if (rowOk && distOk && z.armorHp > 0) {
              z.armorHp = 0;
              z.armorKind = null;
              PVZ.audio.play('armorBreak');
            }
          }
        }
        return;
      }

      if (a.type === 'shield') {
        // 南瓜头：给同格植物加护甲（简化：增加自身 HP 作为缓冲）
        return;
      }

      if (a.type === 'coffee') {
        // 咖啡豆：一次性唤醒周围植物（立即死亡，效果暂为视觉）
        if (!this.coffeeUsed) {
          this.coffeeUsed = true;
          this.dead = true;
          game.removePlant(this);
          game.spawnParticles(this.cx, this.py - 20, {
            colors: ['#8d6e63', '#6d4c41', '#a1887f'],
            count: 12, speed: 150, life: 0.5, size: 3, gravity: 400
          });
        }
        return;
      }

      if (a.type === 'umbrella') {
        // 灯笼草/叶子保护伞：迷雾中照亮区域（由 game.fog + drawFog 处理）
        return;
      }

      if (this.timer < a.interval) return;
      this.timer = 0;

      if (a.type === 'produce') {
        game.sunSystem.spawn(this.cx, this.cellYTop + 30, { value: a.value || 25 });
      } else if (a.type === 'shoot') {
        // 短射程检测（小喷菇）
        if (a.shortRange) {
          if (!game.getZombieNear(this.row, this.cx, PVZ.config.cellWidth * 3)) return;
        } else {
          if (!game.hasZombieInRow(this.row)) return;
        }
        const volley = a.volley || 1;
        const rows = a.rows || 1; // 三线射手: rows=3
        const rowOffset = Math.floor(rows / 2);
        for (let ri = 0; ri < rows; ri++) {
          const targetRow = this.row - rowOffset + ri;
          if (targetRow < 0 || targetRow >= PVZ.config.gridRows) continue;
          for (let i = 0; i < volley; i++) {
            const isBomb = !!a.damage; // 投弹类（西瓜/玉米）
            const pea = new PVZ.Pea(
              targetRow,
              this.cx + 15 + i * 10,
              this.cellYTop + 40 + (i % 2 ? 8 : -4),
              isBomb ? 14 : 20,
              isBomb ? 220 : 300,
              !!a.ice
            );
            pea.isBomb = isBomb;
            pea.bombDamage = a.damage || 0;
            pea.bombRadius = a.radius || 0;
            pea.butterStun = a.butterStun || 0;
            pea.pierce = !!a.pierce; // 大喷菇穿透
            game.addPea(pea);
          }
        }
        PVZ.audio.play('shoot');
      } else if (a.type === 'bomb') {
        // 西瓜/玉米投手：定时投弹
        if (!game.hasZombieInRow(this.row)) return;
        const pea = new PVZ.Pea(
          this.row,
          this.cx + 10,
          this.cellYTop + 35,
          12,
          180,
          false
        );
        pea.isBomb = true;
        pea.bombDamage = a.damage || 80;
        pea.bombRadius = a.radius || 1;
        pea.butterStun = a.butterStun || 0;
        game.addPea(pea);
        PVZ.audio.play('shoot');
      }
    }

    takeDamage(dmg, silent) {
      this.hp -= dmg;
      if (!silent) this.hitT = 0.12;
      if (this.hp <= 0) this.dead = true;
    }

    render(ctx) {
      ctx.save();
      if (this.hitT > 0) ctx.translate((Math.random() - 0.5) * 3, 0);
      // 入场弹性缩放（从地面"啵"地长出来）
      const pop = PVZ.anim.outBack(Math.min(1, this.birth / 0.32));
      ctx.scale(pop, pop);
      // 按格宽缩放，使植物在两套布局（横屏 80 / 竖屏 72）下视觉大小一致、不溢出
      PVZ.art.drawPlant(ctx, this.type, this.px, this.py, this.t, this.hp / this.maxHp, PVZ.config.cellWidth / 80, {
        armed: this.armed,
        phase: this.squashPhase,
        chomping: this.chomping
      });
      ctx.restore();
    }
  };
})();
