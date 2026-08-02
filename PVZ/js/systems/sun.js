// 阳光系统：天空掉落、植物产出、点击收集
(function () {
  'use strict';

  PVZ.SunSystem = class {
    constructor(game) {
      this.game = game;
      this.suns = [];
      this.skyTimer = PVZ.randomRange(PVZ.config.SUN.skyInterval[0], PVZ.config.SUN.skyInterval[1]);
    }

    update(dt) {
      const cfg = PVZ.config.SUN;

      this.skyTimer -= dt;
      if (this.skyTimer <= 0) {
        this.skyTimer = PVZ.randomRange(cfg.skyInterval[0], cfg.skyInterval[1]);
        this.spawnSky();
      }

      for (let i = this.suns.length - 1; i >= 0; i--) {
        const s = this.suns[i];
        s.t += dt;

        if (s.state === 'fall') {
          s.y += cfg.fallSpeed * dt;
          if (s.y >= s.targetY) {
            s.y = s.targetY;
            s.state = 'idle';
            s.life = cfg.life;
          }
        } else if (s.state === 'pop') {
          // 植物产出：从花盘位置向上弹出，避免被植物遮挡
          s.y = s.y0 - 34 * Math.min(1, s.t / 0.3);
          if (s.t > 0.3) {
            s.state = 'idle';
            s.life = s.life || cfg.life;
          }
        } else if (s.state === 'idle') {
          s.life -= dt;
          if (s.life <= 0) this.suns.splice(i, 1);
        }
      }
    }

    spawnSky() {
      const g = PVZ.config;
      const col = Math.floor(Math.random() * g.gridCols);
      const row = Math.floor(Math.random() * g.gridRows);
      const x = g.lawnOffsetX + col * g.cellWidth + g.cellWidth / 2;
      const targetY = g.lawnOffsetY + row * g.cellHeight + 30;
      this.suns.push({ x, y: 20, y0: 20, targetY, state: 'fall', t: 0, value: g.SUN.value, life: 0 });
    }

    // 植物产出阳光：从出生点向上弹出后停留
    spawn(x, y, opts) {
      opts = opts || {};
      this.suns.push({
        x, y,
        y0: y,
        targetY: y,
        state: 'pop',
        t: 0,
        value: opts.value || 25,
        life: opts.life || 10
      });
    }

    tryCollect(x, y) {
      const r = PVZ.config.SUN.collectRadius;
      for (let i = this.suns.length - 1; i >= 0; i--) {
        const s = this.suns[i];
        if (Math.hypot(s.x - x, s.y - y) <= r) {
          this.suns.splice(i, 1);
          this.game.sun += s.value;
          PVZ.audio.play('sun');
          this.game.spawnParticles(x, y, {
            colors: ['#ffd54f', '#ffecb3', '#ffca28'],
            count: 8, speed: 90, life: 0.4, size: 2.5, gravity: 250
          });
          this.game.addEffect(new PVZ.FloatingText('+' + s.value, '#ffd54f', x, y - 20));
          return true;
        }
      }
      return false;
    }

    render(ctx) {
      for (const s of this.suns) {
        const r = s.state === 'pop' ? Math.min(22, 22 * (s.t / 0.3)) : 22;
        PVZ.art.drawSun(ctx, s.x, s.y, s.t, r);
      }
    }
  };
})();
