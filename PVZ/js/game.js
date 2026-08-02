// 游戏场景：主循环、波次、胜负、输入路由、HUD、特效整合
(function () {
  'use strict';

  PVZ.Game = class {
    constructor(opts) {
      opts = opts || {};
      this.onWin = opts.onWin || function () {};
      this.onLose = opts.onLose || function () {};
      this.onPause = opts.onPause || function () {};

      const g = PVZ.config;
      this.levelIndex = opts.levelId || 0;
      this.level = g.LEVEL_LIST[this.levelIndex];

      this.time = 0;
      this.over = false;
      this.paused = false;
      this.timeScale = 1;
      this.shake = 0;

      this.sun = this.level.initialSun;
      this.grid = [];
      for (let r = 0; r < g.gridRows; r++) {
        this.grid.push(new Array(g.gridCols).fill(null));
      }
      this.plants = [];
      this.zombies = [];
      this.peas = [];
      this.effects = [];
      this.particles = [];

      this.sunSystem = new PVZ.SunSystem(this);
      this.seedBar = new PVZ.SeedBar(this, this.level.deck);

      this.waves = this.level.waves.map(w => Object.assign({}, w));
      this.activeWave = null;
      this.waveTotal = this.waves.length;
      this.waveStarted = 0;
      this.wavesEndTime = 0;

      this.loseX = g.lawnOffsetX + 10;

      // 拖拽选卡种植
      this.drag = null; // { id, x, y }

      // 性能：静态背景离屏缓存 + 粒子对象池
      this.bgCache = null;
      this.particlePool = [];
    }

    // ===== 主循环 =====

    update(dt) {
      if (this.over || this.paused) return;
      this.time += dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);

      this.sunSystem.update(dt);
      this.seedBar.update(dt);

      for (let i = this.plants.length - 1; i >= 0; i--) {
        this.plants[i].update(dt, this);
      }
      for (let i = this.zombies.length - 1; i >= 0; i--) {
        this.zombies[i].update(dt, this);
      }
      for (let i = this.peas.length - 1; i >= 0; i--) {
        this.peas[i].update(dt, this);
      }
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.update(dt);
        if (e.dead) this.effects.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.update(dt);
        if (p.dead) {
          this.particles.splice(i, 1);
          this.particlePool.push(p); // 回收复用
        }
      }

      this.updateWaves(dt);
      this.checkWin();
    }

    render(ctx) {
      if (!this.bgCache) this.buildBgCache();

      ctx.save();
      if (this.shake > 0) {
        ctx.translate((Math.random() - 0.5) * this.shake * 10, (Math.random() - 0.5) * this.shake * 10);
      }

      if (this.bgCache) {
        ctx.drawImage(this.bgCache, 0, 0);
      } else {
        this.drawBackground(ctx);
        this.drawLawn(ctx);
      }
      for (const p of this.plants) p.render(ctx);
      for (const z of this.zombies) z.render(ctx);
      this.sunSystem.render(ctx); // 阳光绘制在植物上层，保证可见可点
      for (const p of this.peas) p.render(ctx);
      for (const p of this.particles) p.render(ctx);
      for (const e of this.effects) e.render(ctx);

      this.drawHUD(ctx);
      this.drawDrag(ctx);
      ctx.restore();
    }

    // 静态背景（顶栏/草坪/网格/栅栏）预渲染到离屏画布，每帧仅 drawImage
    buildBgCache() {
      if (typeof document === 'undefined') return; // 无头测试环境跳过
      try {
        const c = PVZ.config;
        const canvas = document.createElement('canvas');
        canvas.width = c.canvasWidth;
        canvas.height = c.canvasHeight;
        const bctx = canvas.getContext('2d');
        this.drawBackground(bctx);
        this.drawLawn(bctx);
        this.bgCache = canvas;
      } catch (e) {
        this.bgCache = null;
      }
    }

    // 倍速切换：1x → 2x → 4x → 8x 循环
    cycleSpeed() {
      const speeds = [1, 2, 4, 8];
      const i = speeds.indexOf(this.timeScale);
      this.timeScale = speeds[(i + 1) % speeds.length];
      return this.timeScale;
    }

    // ===== 波次 =====

    updateWaves(dt) {
      if (!this.activeWave && this.waves.length && this.time >= this.waves[0].time) {
        const w = this.waves.shift();
        this.activeWave = { list: [], timer: 0 };
        w.spawns.forEach(s => {
          for (let i = 0; i < s.count; i++) this.activeWave.list.push(s.type);
        });
        this.waveStarted++;
        this.wavesEndTime = Math.max(this.wavesEndTime, this.time + this.activeWave.list.length * 3 + 5);
      }

      if (this.activeWave) {
        this.activeWave.timer -= dt;
        while (this.activeWave.timer <= 0 && this.activeWave.list.length) {
          this.spawnZombie(this.activeWave.list.shift());
          this.activeWave.timer += 2 + Math.random() * 3;
        }
        if (!this.activeWave.list.length) {
          this.activeWave = null;
          this.wavesEndTime = Math.max(this.wavesEndTime, this.time + 15);
        }
      }
    }

    spawnZombie(type) {
      const g = PVZ.config;
      const row = Math.floor(Math.random() * g.gridRows);
      const x = g.lawnOffsetX + g.gridCols * g.cellWidth + 40;
      this.zombies.push(new PVZ.Zombie(type, row, x, this.level.speedMul));
      PVZ.audio.play('zombieSpawn');
    }

    // ===== 爆炸 / 窝瓜 =====

    explodeAt(col, row, damage, radius) {
      const c = PVZ.config;
      const cell = this.cellToPixel(col, row);
      const cx = cell.x + c.cellWidth / 2;
      const cy = cell.y + c.cellHeight / 2;
      this.addEffect(new PVZ.Explosion(cx, cy));
      this.spawnParticles(cx, cy, {
        colors: ['#ff9800', '#ffd54f', '#fff3e0'],
        count: 26, speed: 220, life: 0.7, size: 4, gravity: 300
      });
      this.shake = Math.max(this.shake, 0.5);
      PVZ.audio.play('boom');

      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        if (z.state === 'dead') continue;
        const zcol = Math.floor((z.x - c.lawnOffsetX) / c.cellWidth);
        if (Math.abs(z.row - row) <= radius && Math.abs(zcol - col) <= radius) {
          z.takeDamage(damage);
        }
      }
    }

    squashHit(row, x, damage, range) {
      const c = PVZ.config;
      const y = c.lawnOffsetY + row * c.cellHeight + c.cellHeight / 2;
      this.addEffect(new PVZ.Explosion(x, y));
      this.spawnParticles(x, y, {
        colors: ['#66bb6a', '#a5d6a7', '#dcedc8'],
        count: 16, speed: 170, life: 0.55, size: 4, gravity: 350
      });
      this.shake = Math.max(this.shake, 0.35);
      PVZ.audio.play('boom');

      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        if (z.state === 'dead') continue;
        if (z.row === row && Math.abs(z.x - x) <= range) {
          z.takeDamage(damage);
        }
      }
    }

    // ===== 粒子（对象池复用） =====

    spawnParticles(x, y, opts) {
      opts = opts || {};
      const n = opts.count || 8;
      const colors = opts.colors || ['#ffffff'];
      const speed = opts.speed || 100;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.3 + Math.random() * 0.7) * speed;
        let p = this.particlePool.pop();
        if (!p) p = new PVZ.Particle();
        p.reset(
          x, y,
          Math.cos(a) * sp,
          -(0.4 + Math.random() * 0.6) * sp,
          (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
          (opts.size || 3) * (0.7 + Math.random() * 0.6),
          colors[Math.floor(Math.random() * colors.length)],
          opts.gravity || 400
        );
        this.particles.push(p);
      }
    }

    // ===== 胜负 =====

    checkWin() {
      if (!this.waves.length && !this.activeWave && !this.zombies.length && this.time > this.wavesEndTime) {
        this.over = true;
        this.onWin();
      }
    }

    lose() {
      if (this.over) return;
      this.over = true;
      this.onLose();
    }

    // ===== 实体管理 =====

    plantAt(col, row, type) {
      const g = PVZ.config;
      if (col < 0 || col >= g.gridCols || row < 0 || row >= g.gridRows) return false;
      if (this.grid[row][col]) return false;

      const p = new PVZ.Plant(type, col, row);
      this.grid[row][col] = p;
      this.plants.push(p);

      const cell = this.cellToPixel(col, row);
      this.spawnParticles(cell.x + g.cellWidth / 2, cell.y + g.cellHeight, {
        colors: ['#8d6e63', '#6d4c41', '#a1887f'],
        count: 10, speed: 130, life: 0.5, size: 3, gravity: 520
      });
      return true;
    }

    removePlant(p) {
      if (this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
      const i = this.plants.indexOf(p);
      if (i >= 0) this.plants.splice(i, 1);
    }

    removeZombie(z) {
      const i = this.zombies.indexOf(z);
      if (i >= 0) this.zombies.splice(i, 1);
    }

    removePea(p) {
      const i = this.peas.indexOf(p);
      if (i >= 0) this.peas.splice(i, 1);
    }

    addPea(p) {
      this.peas.push(p);
    }

    addEffect(e) {
      this.effects.push(e);
    }

    // ===== 查询 =====

    getPlantInRow(row, x) {
      return PVZ.collide.plantInRange(this.plants, row, x, PVZ.config.cellWidth * 0.55);
    }

    getZombieInRow(row, x) {
      return PVZ.collide.nearestZombieInRow(this.zombies, row, x, 16);
    }

    hasZombieInRow(row) {
      return this.zombies.some(z => z.row === row && z.state !== 'dead');
    }

    getZombieNear(row, x, range) {
      for (const z of this.zombies) {
        if (z.row !== row || z.state === 'dead') continue;
        if (Math.abs(z.x - x) <= range) return z;
      }
      return null;
    }

    // ===== 输入（Pointer 事件统一鼠标/触控） =====

    lawnCellAt(x, y) {
      const g = PVZ.config;
      const col = Math.floor((x - g.lawnOffsetX) / g.cellWidth);
      const row = Math.floor((y - g.lawnOffsetY) / g.cellHeight);
      if (col < 0 || col >= g.gridCols || row < 0 || row >= g.gridRows) return null;
      return { col, row };
    }

    pauseBtnRect() {
      const w = PVZ.config.canvasWidth;
      return { x: w - 44, y: 8, w: 34, h: 30 };
    }

    onPointerDown(x, y) {
      if (this.over || this.paused) return;

      const pb = this.pauseBtnRect();
      if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
        this.paused = true;
        this.drag = null;
        this.onPause();
        return;
      }

      const r = this.seedBar.onMouseDown(x, y);
      if (r.hit) {
        if (r.id) this.drag = { id: r.id, x, y };
        return;
      }

      if (this.sunSystem.tryCollect(x, y)) return;

      // 点击草坪直接种植（支持连续种植）
      const pos = this.lawnCellAt(x, y);
      if (pos) {
        if (this.seedBar.selected) {
          this.seedBar.tryPlant(pos.col, pos.row);
        }
      } else if (this.seedBar.selected) {
        this.seedBar.selected = null; // 点击空白区域取消选择
      }
    }

    onPointerMove(x, y) {
      if (this.drag) {
        this.drag.x = x;
        this.drag.y = y;
      }
    }

    onPointerUp(x, y) {
      if (!this.drag) return;
      const pos = this.lawnCellAt(x, y);
      if (pos) {
        this.seedBar.selected = this.drag.id;
        this.seedBar.tryPlant(pos.col, pos.row);
      } else {
        this.seedBar.selected = null;
      }
      this.drag = null;
    }

    // ===== 渲染 =====

    cellToPixel(col, row) {
      const c = PVZ.config;
      return {
        x: c.lawnOffsetX + col * c.cellWidth,
        y: c.lawnOffsetY + row * c.cellHeight
      };
    }

    drawBackground(ctx) {
      const c = PVZ.config;
      ctx.fillStyle = c.colors.canvasBg;
      ctx.fillRect(0, 0, c.canvasWidth, c.canvasHeight);

      ctx.fillStyle = c.colors.topBar;
      ctx.fillRect(0, 0, c.canvasWidth, c.topBarHeight);

      ctx.fillStyle = c.colors.seedPanel;
      ctx.fillRect(0, 0, c.seedPanelWidth, c.topBarHeight);
    }

    drawLawn(ctx) {
      const c = PVZ.config;
      const { lawnOffsetX, lawnOffsetY, cellWidth, cellHeight } = c;

      for (let r = 0; r < c.gridRows; r++) {
        for (let col = 0; col < c.gridCols; col++) {
          const { x, y } = this.cellToPixel(col, r);
          ctx.fillStyle = (col + r) % 2 === 0 ? c.colors.lawnA : c.colors.lawnB;
          ctx.fillRect(x, y, cellWidth, cellHeight);
        }
      }

      ctx.strokeStyle = c.colors.lawnBorder;
      ctx.lineWidth = 1;
      for (let col = 0; col <= c.gridCols; col++) {
        const x = lawnOffsetX + col * cellWidth;
        ctx.beginPath();
        ctx.moveTo(x, lawnOffsetY);
        ctx.lineTo(x, lawnOffsetY + c.gridRows * cellHeight);
        ctx.stroke();
      }
      for (let r = 0; r <= c.gridRows; r++) {
        const y = lawnOffsetY + r * cellHeight;
        ctx.beginPath();
        ctx.moveTo(lawnOffsetX, y);
        ctx.lineTo(lawnOffsetX + c.gridCols * cellWidth, y);
        ctx.stroke();
      }

      this.drawFence(ctx);
    }

    drawFence(ctx) {
      const c = PVZ.config;
      const x = c.lawnOffsetX - 22;
      const w = 22;
      const h = c.gridRows * c.cellHeight;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, c.lawnOffsetY, w, h);
      ctx.clip();
      ctx.fillStyle = c.colors.fenceWhite;
      ctx.fillRect(x, c.lawnOffsetY, w, h);
      ctx.strokeStyle = c.colors.fenceRed;
      ctx.lineWidth = 7;
      for (let i = -h; i < h; i += 14) {
        ctx.beginPath();
        ctx.moveTo(x + i, c.lawnOffsetY + h);
        ctx.lineTo(x + i + h, c.lawnOffsetY);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawDrag(ctx) {
      if (!this.drag) return;
      ctx.globalAlpha = 0.6;
      PVZ.art.drawPlant(ctx, this.drag.id, this.drag.x, this.drag.y, 0, 1, 0.85);
      ctx.globalAlpha = 1;
    }

    drawHUD(ctx) {
      const c = PVZ.config;
      ctx.textBaseline = 'middle';

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText('植物大战僵尸 · 阶段3', 10, 14);

      PVZ.art.drawSun(ctx, 34, 44, this.time, 15);
      ctx.fillStyle = c.colors.text;
      ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
      ctx.fillText(String(this.sun), 56, 46);

      this.seedBar.render(ctx);

      ctx.textAlign = 'right';
      ctx.fillStyle = c.colors.text;
      ctx.font = '15px "Microsoft YaHei", sans-serif';
      ctx.fillText('波次 ' + this.waveStarted + ' / ' + this.waveTotal, c.canvasWidth - 20, 38);

      const bx = c.canvasWidth - 270, by = 52, bw = 226, bh = 10;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      PVZ.art.roundRect(ctx, bx, by, bw, bh, 5);
      ctx.fill();
      if (this.waveTotal > 0) {
        const f = Math.min(1, this.waveStarted / this.waveTotal);
        ctx.fillStyle = '#8bc34a';
        PVZ.art.roundRect(ctx, bx, by, Math.max(bh, bw * f), bh, 5);
        ctx.fill();
      }

      const pb = this.pauseBtnRect();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      PVZ.art.roundRect(ctx, pb.x, pb.y, pb.w, pb.h, 6);
      ctx.fill();
      ctx.fillStyle = c.colors.text;
      ctx.fillRect(pb.x + 10, pb.y + 8, 4, 14);
      ctx.fillRect(pb.x + 20, pb.y + 8, 4, 14);

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText('点击/拖拽卡片种植 · 右键取消选择 · P 暂停', c.canvasWidth / 2, c.topBarHeight - 18);

      ctx.textAlign = 'left';
    }
  };
})();
