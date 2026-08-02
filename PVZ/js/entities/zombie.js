// 僵尸实体：状态机 walk | eat | jump | dead，含减速/断头/撑杆跳逻辑
(function () {
  'use strict';

  PVZ.Zombie = class {
    constructor(type, row, x, speedMul) {
      const cfg = PVZ.config.ZOMBIES[type];

      this.type = type;
      this.row = row;
      this.x = x;
      this.py = PVZ.config.lawnOffsetY + row * PVZ.config.cellHeight + PVZ.config.cellHeight; // 底部锚点 y

      this.config = cfg;
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;
      this.speed = cfg.speed * (speedMul || 1);
      this.damage = cfg.damage;
      this.eatInterval = cfg.eatInterval;
      this.headgear = type === 'normal' ? null : type;
      this.poleUsed = type !== 'pole'; // 撑杆跳僵尸：未使用撑杆时遇到植物会跳过

      this.state = 'walk'; // walk | eat | jump | dead
      this.eatTimer = 0;
      this.jumpT = 0;
      this.t = Math.random() * 5;
      this.deadT = 0;
      this.hitT = 0;
      this.slowT = 0; // 减速剩余秒数，>0 时移速减半

      // 断头效果
      this.headX = 0;
      this.headY = 0;
      this.headVx = 0;
      this.headVy = 0;
      this.headRot = 0;
    }

    applySlow(sec) {
      this.slowT = Math.max(this.slowT, sec);
    }

    update(dt, game) {
      this.t += dt;
      if (this.hitT > 0) this.hitT -= dt;
      if (this.slowT > 0) this.slowT -= dt;

      if (this.state === 'dead') {
        this.deadT += dt;
        this.headX += this.headVx * dt;
        this.headY += this.headVy * dt;
        this.headVy += 600 * dt;
        this.headRot += 6 * dt;
        if (this.deadT > 1.5) game.removeZombie(this);
        return;
      }

      if (this.state === 'jump') {
        this.jumpT += dt;
        this.x -= this.speed * 7 * dt; // 快速前冲跳过植物
        if (this.jumpT > 0.7) this.state = 'walk';
        return;
      }

      const plant = game.getPlantInRow(this.row, this.x);
      if (plant) {
        if (!this.poleUsed) {
          this.poleUsed = true;
          this.state = 'jump';
          this.jumpT = 0;
          return;
        }
        if (this.state !== 'eat') PVZ.audio.play('eat');
        this.state = 'eat';
        this.eatTimer -= dt;
        if (this.eatTimer <= 0) {
          this.eatTimer = this.eatInterval;
          plant.takeDamage(this.damage);
          if (plant.dead) game.removePlant(plant);
        }
      } else {
        this.state = 'walk';
        this.x -= this.speed * (this.slowT > 0 ? 0.5 : 1) * dt;
        if (this.x <= game.loseX) game.lose();
      }
    }

    takeDamage(dmg) {
      this.hp -= dmg;
      this.hitT = 0.12;
      if (this.hp <= 0 && this.state !== 'dead') {
        this.state = 'dead';
        this.deadT = 0;
        this.headX = this.x - 2;
        this.headY = this.py - 70;
        this.headVx = -80 + Math.random() * 40;
        this.headVy = -200 - Math.random() * 80;
        this.headRot = 0;
        PVZ.audio.play('die');
      }
    }

    render(ctx) {
      const opts = {
        slow: this.slowT > 0,
        headgear: this.headgear,
        pole: this.type === 'pole' && !this.poleUsed && this.state === 'walk'
      };

      if (this.state === 'dead') {
        const fade = Math.max(0, 1 - this.deadT / 1.5);
        ctx.save();
        if (this.hitT > 0) ctx.translate((Math.random() - 0.5) * 4, 0);
        ctx.globalAlpha = fade;
        ctx.translate(this.x, this.py);
        ctx.rotate(-Math.min(this.deadT * 1.4, 1.4));
        PVZ.art.drawZombieBody(ctx, 0, 0, this.t, 'walk', Object.assign({}, opts, { noHead: true }));
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(this.headX, this.headY);
        ctx.rotate(this.headRot);
        PVZ.art.drawZombieHead(ctx, opts);
        ctx.restore();
        return;
      }

      ctx.save();
      if (this.hitT > 0) ctx.translate((Math.random() - 0.5) * 4, 0);

      if (this.state === 'jump') {
        const p = Math.min(1, this.jumpT / 0.7);
        ctx.translate(0, -Math.sin(p * Math.PI) * 55);
        ctx.rotate(-0.3 * Math.sin(p * Math.PI));
        PVZ.art.drawZombieBody(ctx, this.x, this.py, this.t, 'jump', opts);
      } else {
        PVZ.art.drawZombieBody(ctx, this.x, this.py, this.t, this.state, opts);
      }
      ctx.restore();
    }
  };
})();
