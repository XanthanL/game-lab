// 特效实体：飘字、爆炸、粒子
(function () {
  'use strict';

  PVZ.FloatingText = class {
    constructor(text, color, x, y) {
      this.text = text;
      this.color = color;
      this.x = x;
      this.y = y;
      this.vy = -45;
      this.life = 1;
      this.dead = false;
    }

    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }

    render(ctx) {
      PVZ.art.drawFloatingText(ctx, this.x, this.y, this.text, this.color, Math.max(0, Math.min(1, this.life)));
    }
  };

  PVZ.Explosion = class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.t = 0;
      this.life = 0.5;
      this.dead = false;
    }

    update(dt) {
      this.t += dt;
      if (this.t > this.life) this.dead = true;
    }

    render(ctx) {
      PVZ.art.drawExplosion(ctx, this.x, this.y, Math.min(1, this.t / this.life));
    }
  };

  PVZ.Particle = class {
    constructor() {
      this.dead = true;
    }

    reset(x, y, vx, vy, life, size, color, gravity) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.maxLife = life;
      this.life = life;
      this.size = size;
      this.color = color;
      this.gravity = gravity;
      this.dead = false;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.gravity * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }

    render(ctx) {
      ctx.globalAlpha = Math.max(0, Math.min(1, this.life / this.maxLife));
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  };
})();
