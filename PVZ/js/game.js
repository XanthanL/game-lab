// 游戏场景：主循环、波次、胜负、输入路由、HUD、特效整合、割草机系统
(function () {
  'use strict';

  // ===== 割草机实体 =====
  PVZ.Lawnmower = class {
    constructor(row) {
      this.row = row;
      const c = PVZ.config;
      const lm = c.LAWNMOWER;
      // 割草机停在栅栏右侧、草坪最左端
      this.x = c.lawnOffsetX + lm.offsetX;
      this.y = c.lawnOffsetY + row * c.cellHeight + (c.cellHeight - lm.height) / 2;
      this.w = lm.width;
      this.h = lm.height;
      this.speed = lm.speed;
      this.state = 'idle'; // idle | active | used
      this.activeTime = 0;
    }

    update(dt, scene) {
      if (this.state === 'active') {
        this.activeTime += dt;
        this.x += this.speed * dt;
        const c = PVZ.config;
        // 碾压路径上的僵尸：割草机向右扫，碾过其右缘及左侧整行的僵尸
        for (const z of scene.zombies) {
          if (z.row === this.row && z.state !== 'dead' && z.x <= this.x + this.w * 0.6) {
            z.takeDamage(9999);
            scene.spawnParticles(z.x, z.y - 30, {
              colors: ['#8d6e63', '#5d4037', '#3e2723'],
              count: 12, speed: 180, life: 0.4, size: 3, gravity: 400
            });
          }
        }
        // 飞出屏幕右边缘后标记已用
        if (this.x > c.canvasWidth + 50) {
          this.state = 'used';
        }
      }
    }

    activate() {
      if (this.state !== 'idle') return false;
      this.state = 'active';
      this.activeTime = 0;
      PVZ.audio.play('boom');
      return true;
    }

    render(ctx) {
      if (this.state === 'used') return;
      const c = PVZ.config;
      const lm = c.LAWNMOWER;

      ctx.save();
      // 轮子（激活时旋转）
      ctx.fillStyle = lm.wheelColor;
      ctx.beginPath();
      ctx.arc(this.x + 10, this.y + this.h - 6, 9, 0, Math.PI * 2);
      ctx.arc(this.x + this.w - 10, this.y + this.h - 6, 9, 0, Math.PI * 2);
      ctx.fill();
      if (this.state === 'active') {
        const spin = this.activeTime * 22;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        [10, this.w - 10].forEach((dx) => {
          ctx.beginPath();
          for (let s = 0; s < 4; s++) {
            const a = spin + (s / 4) * Math.PI * 2;
            ctx.moveTo(this.x + dx, this.y + this.h - 6);
            ctx.lineTo(this.x + dx + Math.cos(a) * 7, this.y + this.h - 6 + Math.sin(a) * 7);
          }
          ctx.stroke();
        });
        // 排气烟雾
        const phase = (this.activeTime * 30) % 16;
        ctx.fillStyle = 'rgba(180,180,180,0.32)';
        ctx.beginPath();
        ctx.arc(this.x - 12 - phase, this.y + 12, 4 + phase * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 车身
      ctx.fillStyle = lm.color;
      PVZ.art.roundRect(ctx, this.x, this.y + 8, this.w, this.h - 14, 5);
      ctx.fill();

      // 车身高光
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      PVZ.art.roundRect(ctx, this.x + 3, this.y + 11, this.w - 16, 8, 3);
      ctx.fill();

      // 把手
      ctx.strokeStyle = lm.handleColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x + this.w - 4, this.y + 10);
      ctx.lineTo(this.x + this.w + 6, this.y + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.x + this.w - 4, this.y + 18);
      ctx.lineTo(this.x + this.w + 6, this.y + 10);
      ctx.stroke();

      // 激活时添加速度线
      if (this.state === 'active') {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ly = this.y + 10 + i * 9;
          ctx.beginPath();
          ctx.moveTo(this.x - 15 - i * 8, ly);
          ctx.lineTo(this.x - 5 - i * 8, ly);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  };

  // ===== 游戏场景 =====
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

      // 失败判定线（房屋门位置）
      this.loseX = 8;

      // 割草机：每行一台
      this.lawnmowers = [];
      for (let r = 0; r < g.gridRows; r++) {
        this.lawnmowers.push(new PVZ.Lawnmower(r));
      }

      // 拖拽选卡种植
      this.drag = null;

      // Boss 与移动端
      this.bosses = [];
      this.shovelMode = false;
      this.useDomDock = false;

      // 爆炸闪光（由动画系统驱动衰减）
      this._flash = 0;
      this._flashColor = '255,240,200';
      this._flashHandle = null;

      // 性能：静态背景离屏缓存 + 粒子对象池
      this.bgCache = null;
      this.particlePool = [];

      // 泳池行 / 迷雾 / 屋顶 标记
      this.poolRows = this.level.pool || [];
      this.fog = !!this.level.fog;
      this.roof = !!this.level.roof;
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
          this.particlePool.push(p);
        }
      }

      // 更新割草机
      for (const lm of this.lawnmowers) {
        lm.update(dt, this);
      }

      this.updateWaves(dt);
      this.updateBosses(dt);
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

      // 绘制割草机（在植物下层，草坪上层）
      for (const lm of this.lawnmowers) {
        lm.render(ctx);
      }

      for (const p of this.plants) p.render(ctx);
      for (const z of this.zombies) z.render(ctx);
      this.sunSystem.render(ctx);
      for (const p of this.peas) p.render(ctx);
      for (const p of this.particles) p.render(ctx);
      for (const e of this.effects) e.render(ctx);

      // 迷雾层（最上层）
      if (this.fog) this.drawFog(ctx);

      this.drawHUD(ctx);
      this.drawDrag(ctx);

      // 爆炸闪光叠加（廉价全屏填充）
      if (this._flash > 0) {
        ctx.fillStyle = 'rgba(' + this._flashColor + ',' + (this._flash * 0.5) + ')';
        ctx.fillRect(0, 0, PVZ.config.canvasWidth, PVZ.config.canvasHeight);
      }

      ctx.restore();
    }

    buildBgCache() {
      if (typeof document === 'undefined') return;
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
      let row = Math.floor(Math.random() * g.gridRows);
      // 潜水僵尸偏好泳池行
      const zCfg = g.ZOMBIES[type];
      if (zCfg && zCfg.dive && this.poolRows.length) {
        if (Math.random() < 0.6) row = this.poolRows[Math.floor(Math.random() * this.poolRows.length)];
      }
      const x = g.lawnEndX + 40;
      const z = new PVZ.Zombie(type, row, x, this.level.speedMul);
      if (z.isBoss) {
        z.summonTimer = 7;
        this.bosses.push(z);
      }
      this.zombies.push(z);
      PVZ.audio.play('zombieSpawn');
    }

    updateBosses(dt) {
      for (const b of this.bosses) {
        if (b.state === 'dead' || !b.config.summon) continue;
        b.summonTimer -= dt;
        if (b.summonTimer <= 0) {
          b.summonTimer = 7;
          const types = ['normal', 'cone', 'bucket', 'screen', 'football'];
          const t = types[Math.floor(Math.random() * types.length)];
          const row = Math.floor(Math.random() * PVZ.config.gridRows);
          const x = PVZ.config.lawnEndX + 40;
          this.zombies.push(new PVZ.Zombie(t, row, x, this.level.speedMul));
          PVZ.audio.play('zombieSpawn');
        }
      }
      this.bosses = this.bosses.filter(b => b.state !== 'dead');
    }

    // ===== 爆炸 / 窝瓜 / 整行清除 / 火炬 =====

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
      this.flash(0.22, '255,160,60');
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
      this.flash(0.16, '180,255,160');
      PVZ.audio.play('boom');

      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        if (z.row === row && z.state !== 'dead' && Math.abs(z.x - x) <= range) {
          z.takeDamage(damage);
        }
      }
    }

    rowClear(row, damage) {
      const c = PVZ.config;
      const y = c.lawnOffsetY + row * c.cellHeight + c.cellHeight / 2;
      const cx = c.lawnOffsetX + c.gridCols * c.cellWidth / 2;
      this.addEffect(new PVZ.Explosion(cx, y));
      this.spawnParticles(cx, y, {
        colors: ['#ff7043', '#ffca28', '#fff3e0'],
        count: 40, speed: 300, life: 0.8, size: 5, gravity: 200
      });
      this.shake = Math.max(this.shake, 0.6);
      this.flash(0.24, '255,140,60');
      PVZ.audio.play('boom');
      for (const z of this.zombies) {
        if (z.row === row && z.state !== 'dead') z.takeDamage(damage);
      }
    }

    torchAt(row, x) {
      for (const p of this.plants) {
        if (p.row === row && p.torch && !p.dead && Math.abs(p.cx - x) <= PVZ.config.cellWidth * 0.5) {
          return p;
        }
      }
      return null;
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

    // ===== 胜负 & 割草机触发 =====

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

    // 爆炸闪光：一次性设置强度，由 PVZ.anim 管理器每帧衰减，绘制为全屏暖色叠加
    flash(amt, color) {
      this._flash = Math.max(this._flash || 0, amt);
      if (color) this._flashColor = color;
      if (!this._flashHandle) {
        const g = this;
        this._flashHandle = PVZ.anim.run((dt) => {
          g._flash = Math.max(0, g._flash - dt * 0.9);
          if (g._flash <= 0.001) { g._flashHandle = null; return false; }
          return true;
        });
      }
    }

    // 僵尸到达左边界时调用：优先触发割草机
    onZombieReachHouse(zombie) {
      const lm = this.lawnmowers[zombie.row];
      if (lm && lm.state === 'idle') {
        lm.activate();
        // 触发它的僵尸本身停在房屋内（割草机扫不到的最左侧），直接碾碎
        zombie.takeDamage(9999);
        return true; // 割草机已触发，僵尸被碾碎
      }
      // 无可用割草机 → 判负
      this.lose();
      return false;
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
      if (this.grid[p.row] && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
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

    shovelBtnRect() {
      const w = PVZ.config.canvasWidth;
      return { x: w - 86, y: 8, w: 34, h: 30 };
    }

    onPointerDown(x, y) {
      if (this.over || this.paused) return;

      // 画布内暂停按钮（仅非 dock 模式；触控 dock 自带暂停键，避免重复命中）
      if (!this.useDomDock) {
        const pb = this.pauseBtnRect();
        if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
          this.paused = true;
          this.drag = null;
          this.shovelMode = false;
          this.onPause();
          return;
        }
      }

      // 铲子按钮：切换铲除模式（仅非 dock 模式；触控 dock 自带铲子键）
      if (!this.useDomDock) {
        const sb = this.shovelBtnRect();
        if (x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
          this.shovelMode = !this.shovelMode;
          this.seedBar.selected = null;
          this.drag = null;
          PVZ.audio.play('click');
          return;
        }
      }

      if (this.shovelMode) {
        const pos = this.lawnCellAt(x, y);
        if (pos && this.grid[pos.row] && this.grid[pos.row][pos.col]) {
          const p = this.grid[pos.row][pos.col];
          this.spawnParticles(p.cx, p.py - 20, {
            colors: ['#8d6e63', '#6d4c41', '#a1887f'],
            count: 10, speed: 120, life: 0.5, size: 3, gravity: 500
          });
          this.removePlant(p);
          PVZ.audio.play('shovel');
        }
        // 保持铲子模式，可连续铲除；再次点铲子按钮或右键取消
        return;
      }

      if (this.seedBar.visible !== false) {
        const r = this.seedBar.onMouseDown(x, y);
        if (r.hit) {
          if (r.id) this.drag = { id: r.id, x, y };
          return;
        }
      }

      if (this.sunSystem.tryCollect(x, y)) return;

      const pos = this.lawnCellAt(x, y);
      if (pos) {
        if (this.seedBar.selected) {
          this.seedBar.tryPlant(pos.col, pos.row);
        }
      } else if (this.seedBar.selected) {
        this.seedBar.selected = null;
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

      // 全局背景
      ctx.fillStyle = c.colors.canvasBg;
      ctx.fillRect(0, 0, c.canvasWidth, c.canvasHeight);

      // 顶栏
      ctx.fillStyle = c.colors.topBar;
      ctx.fillRect(0, 0, c.canvasWidth, c.topBarHeight);

      // 种子面板区
      ctx.fillStyle = c.colors.seedPanel;
      ctx.fillRect(0, 0, c.seedPanelWidth, c.topBarHeight);

      // ===== 房屋侧区域（左侧） =====
      this.drawHouseArea(ctx);
    }

    drawHouseArea(ctx) {
      const c = PVZ.config;
      const hx = 0;
      const hy = c.topBarHeight;
      const hw = c.houseWidth;
      const hh = c.canvasHeight - hy;

      // 房屋墙壁
      ctx.fillStyle = c.colors.houseWall;
      ctx.fillRect(hx, hy, hw, hh);

      // 墙壁纹理线条
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      for (let y = hy; y < c.canvasHeight; y += 28) {
        ctx.beginPath();
        ctx.moveTo(hx, y);
        ctx.lineTo(hx + hw, y);
        ctx.stroke();
      }
      for (let x = hx; x < hx + hw; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, hy);
        ctx.lineTo(x, c.canvasHeight);
        ctx.stroke();
      }

      // 门框
      const doorW = 46;
      const doorH = 80;
      const doorX = hx + (hw - doorW) / 2;
      const doorY = hy + hh - doorH - 12;
      ctx.fillStyle = c.colors.houseDoor;
      PVZ.art.roundRect(ctx, doorX, doorY, doorW, doorH, 4);
      ctx.fill();

      // 门板高光
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      PVZ.art.roundRect(ctx, doorX + 4, doorY + 4, doorW - 18, doorH - 8, 3);
      ctx.fill();

      // 门把手
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(doorX + doorW - 12, doorY + doorH / 2 + 6, 4, 0, Math.PI * 2);
      ctx.fill();

      // 窗户（门上方）
      const winW = 36;
      const winH = 30;
      const winX = hx + (hw - winW) / 2;
      const winY = doorY - winH - 14;
      // 窗框
      ctx.fillStyle = c.colors.windowFrame;
      PVZ.art.roundRect(ctx, winX - 3, winY - 3, winW + 6, winH + 6, 3);
      ctx.fill();
      // 玻璃
      ctx.fillStyle = c.colors.windowGlass;
      PVZ.art.roundRect(ctx, winX, winY, winW, winH, 2);
      ctx.fill();
      // 窗格十字
      ctx.strokeStyle = c.colors.windowFrame;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(winX + winW / 2, winY);
      ctx.lineTo(winX + winW / 2, winY + winH);
      ctx.moveTo(winX, winY + winH / 2);
      ctx.lineTo(winX + winW, winY + winH / 2);
      ctx.stroke();

      // 窗户反光
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(winX + 3, winY + 3, 10, 8);

      // 屋顶三角
      ctx.fillStyle = c.colors.houseRoof;
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy);
      ctx.lineTo(hx + hw / 2, hy - 28);
      ctx.lineTo(hx + hw + 4, hy);
      ctx.closePath();
      ctx.fill();

      // 屋顶边缘高光
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy);
      ctx.lineTo(hx + hw / 2, hy - 28);
      ctx.lineTo(hx + hw + 4, hy);
      ctx.stroke();
    }

    drawLawn(ctx) {
      const c = PVZ.config;
      const night = this.level && this.level.night;
      const roof = this.roof;
      const poolRows = this.poolRows;
      const { lawnOffsetX, lawnOffsetY, cellWidth, cellHeight } = c;

      for (let r = 0; r < c.gridRows; r++) {
        for (let col = 0; col < c.gridCols; col++) {
          const { x, y } = this.cellToPixel(col, r);
          let base;
          if (roof) {
            // 屋顶：紫褐色瓦片
            base = (col + r) % 2 === 0 ? '#795548' : '#8d6e63';
          } else if (poolRows.includes(r)) {
            // 泳池行：蓝色水面
            base = (col + r) % 2 === 0 ? c.colors.poolA : c.colors.poolB;
          } else if (night) {
            base = (col + r) % 2 === 0 ? '#3f5a8c' : '#46639a';
          } else {
            base = (col + r) % 2 === 0 ? c.colors.lawnA : c.colors.lawnB;
          }
          ctx.fillStyle = base;
          ctx.fillRect(x, y, cellWidth, cellHeight);
        }
      }

      // 网格线
      const gridColor = roof ? '#5d4037' : (night ? '#2c3f66' : c.colors.lawnBorder);
      const poolGridColor = '#1565c0';
      ctx.lineWidth = 1;
      for (let col = 0; col <= c.gridCols; col++) {
        const x = lawnOffsetX + col * cellWidth;
        ctx.beginPath();
        ctx.moveTo(x, lawnOffsetY);
        ctx.lineTo(x, lawnOffsetY + c.gridRows * cellHeight);
        ctx.strokeStyle = gridColor;
        ctx.stroke();
      }
      for (let r = 0; r <= c.gridRows; r++) {
        const y = lawnOffsetY + r * cellHeight;
        ctx.beginPath();
        ctx.moveTo(lawnOffsetX, y);
        ctx.lineTo(lawnOffsetX + c.gridCols * cellWidth, y);
        ctx.stroke();
        // 泳池额外边线
        if (poolRows.includes(r - 1)) {
          ctx.strokeStyle = poolGridColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lawnOffsetX, y);
          ctx.lineTo(lawnOffsetX + c.gridCols * cellWidth, y);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }

      this.drawFence(ctx);

      if (night) this.drawMoon(ctx);
      if (roof) this.drawRoofTiles(ctx);
    }

    drawMoon(ctx) {
      const c = PVZ.config;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f5f3d0';
      ctx.beginPath();
      ctx.arc(c.lawnOffsetX + c.gridCols * c.cellWidth - 60, c.lawnOffsetY + 70, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(70,90,140,0.55)';
      ctx.beginPath();
      ctx.arc(c.lawnOffsetX + c.gridCols * c.cellWidth - 48, c.lawnOffsetY + 60, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawRoofTiles(ctx) {
      const c = PVZ.config;
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 1;
      // 斜瓦纹
      for (let i = -c.gridRows * c.cellHeight; i < c.gridCols * c.cellWidth; i += 18) {
        ctx.beginPath();
        ctx.moveTo(c.lawnOffsetX + i, c.lawnOffsetY);
        ctx.lineTo(c.lawnOffsetX + i + c.gridRows * c.cellHeight * 0.6, c.lawnOffsetY + c.gridRows * c.cellHeight);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFence(ctx) {
      const c = PVZ.config;
      const x = c.lawnOffsetX - c.fenceWidth;
      const w = c.fenceWidth;
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

    // 迷雾绘制
    drawFog(ctx) {
      const c = PVZ.config;
      const fogStartCol = 4; // 从第几列开始有迷雾
      const fogX = c.lawnOffsetX + fogStartCol * c.cellWidth;

      // 半透明渐变迷雾
      const grad = ctx.createLinearGradient(fogX, 0, c.canvasWidth, 0);
      grad.addColorStop(0, 'rgba(180,190,200,0)');
      grad.addColorStop(0.3, 'rgba(180,190,200,0.55)');
      grad.addColorStop(1, 'rgba(160,172,185,0.72)');
      ctx.fillStyle = grad;
      ctx.fillRect(fogX, c.lawnOffsetY, c.canvasWidth - fogX, c.gridRows * c.cellHeight);

      // 迷雾颗粒感
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#b0bac6';
      for (let i = 0; i < 80; i++) {
        const fx = fogX + Math.random() * (c.canvasWidth - fogX);
        const fy = c.lawnOffsetY + Math.random() * (c.gridRows * c.cellHeight);
        const fr = 2 + Math.random() * 6;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // "迷雾中"提示文字
      ctx.fillStyle = 'rgba(220,225,230,0.45)';
      ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('--- 迷雾 ---', fogX + (c.canvasWidth - fogX) / 2, c.lawnOffsetY + 22);
      ctx.textAlign = 'left';
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

      // 阳光计数
      PVZ.art.drawSun(ctx, 28, 44, this.time, 15);
      ctx.fillStyle = c.colors.text;
      ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(this.sun), 50, 46);

      // 卡片栏（移动端 DOM dock 模式下隐藏）
      if (this.useDomDock !== true) {
        this.seedBar.render(ctx);
      }

      // 波次进度
      ctx.textAlign = 'right';
      ctx.fillStyle = c.colors.text;
      ctx.font = '15px "Microsoft YaHei", sans-serif';
      const waveX = this.useDomDock ? c.canvasWidth - 100 : c.canvasWidth - 130;
      ctx.fillText('波次 ' + this.waveStarted + ' / ' + this.waveTotal, waveX, 38);

      if (!this.useDomDock) {
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
      }

      // 画布内铲子/暂停按钮（仅非 dock 模式；触控 dock 自带，避免顶栏拥挤/重复）
      if (!this.useDomDock) {
        // 铲子按钮
        const sb = this.shovelBtnRect();
        ctx.fillStyle = this.shovelMode ? 'rgba(255,213,79,0.5)' : 'rgba(0,0,0,0.35)';
        PVZ.art.roundRect(ctx, sb.x, sb.y, sb.w, sb.h, 6);
        ctx.fill();
        PVZ.art.drawShovel(ctx, sb.x + sb.w / 2, sb.y + sb.h / 2);

        // 暂停按钮
        const pb = this.pauseBtnRect();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        PVZ.art.roundRect(ctx, pb.x, pb.y, pb.w, pb.h, 6);
        ctx.fill();
        ctx.fillStyle = c.colors.text;
        ctx.fillRect(pb.x + 10, pb.y + 8, 4, 14);
        ctx.fillRect(pb.x + 20, pb.y + 8, 4, 14);
      }

      // Boss 血条
      this.drawBossBars(ctx);

      // 操作提示（仅非 dock 模式；dock 模式自解释，且避免与阳光计数重叠）
      if (!this.useDomDock) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '13px "Microsoft YaHei", sans-serif';
        ctx.fillText('点击/拖拽卡片种植 . 铲子移除植物 . 右键取消 . P 暂停', c.canvasWidth / 2, c.topBarHeight - 18);
        ctx.textAlign = 'left';
      }
    }

    drawBossBars(ctx) {
      if (!this.bosses.length) return;
      const c = PVZ.config;
      ctx.textAlign = 'center';
      const bw = 420, bh = 16;
      const x0 = (c.canvasWidth - bw) / 2;
      let y = c.topBarHeight + 14;
      for (const b of this.bosses) {
        if (b.state === 'dead') continue;
        const totalMax = b.maxHp + (b.armorMax || 0);
        const total = Math.max(0, b.hp + b.armorHp);
        const frac = Math.max(0, Math.min(1, total / totalMax));
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        PVZ.art.roundRect(ctx, x0 - 4, y - 4, bw + 8, bh + 8, 8);
        ctx.fill();
        ctx.fillStyle = '#5a1e1e';
        PVZ.art.roundRect(ctx, x0, y, bw, bh, 6);
        ctx.fill();
        ctx.fillStyle = frac > 0.4 ? '#e53935' : '#ff7043';
        PVZ.art.roundRect(ctx, x0, y, bw * frac, bh, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
        ctx.fillText(b.config.name, c.canvasWidth / 2, y + bh / 2);
        y += bh + 22;
      }
      ctx.textAlign = 'left';
    }
  };
})();
