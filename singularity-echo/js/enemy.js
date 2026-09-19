/**
 * 奇点回响 · 敌人系统
 * 
 * @module enemy
 */

import { BaseEntity } from './entity-base.js';
import { DIFFICULTIES, BOSS_CONFIGS } from './config.js';
import { MovementPatterns as MP } from './entity-base.js';
import { particlesManager } from './particles.js';
import { playSound } from './audio.js';
import { PowerUpSpawner } from './power-ups.js';

// ==================== 敌人类型定义 ====================
export const ENEMY_TYPES = Object.freeze({
  DRONE: 'drone',       // 基础杂兵
  SCOUT: 'scout',       // 快速侦察
  TANK: 'tank',         // 高护甲
  SNIPE: 'snipe',       // 远程狙击
  SWARMER: 'swarmer',   // 自爆单位
  ELITE: 'elite'        // 精英怪
});

// ==================== 敌方武器系统 ====================
export const ENEMY_WEAPONS = Object.freeze({
  BOLT: { speed: 5, damage: 8, size: 6, color: '#ff4040', piercing: 0 },
  BLASTER: { speed: 4, damage: 15, size: 8, color: '#ff6060', piercing: 1 },
  MISSILE: { speed: 2.5, damage: 25, size: 9, color: '#c0402b', homing: true, piercing: 0 },
  BEAM: { speed: Infinity, damage: 40, size: 12, color: '#e0573c', beam: true, pierce: 3 },
  AOE: { speed: 3, damage: 30, size: 15, color: '#d55e00', explode: true, radius: 80, piercing: 0 }
});

// ==================== 基础敌人类 ====================
export class Enemy extends BaseEntity {
  constructor(options = {}) {
    super(options);
    
    this.type = options.type || ENEMY_TYPES.DRONE;
    this.scoreValue = options.scoreValue || 100;
    this.hp = options.hp || 20;
    this.maxHp = this.hp;
    this.shield = options.shield || 0;
    this.explosions = [];
    
    // 配置难度系数
    const diff = options.difficulty || 'standard';
    const config = DIFFICULTIES[diff] || DIFFICULTIES.standard;
    this.hp *= config.hpMult;
    this.maxHp = this.hp;
    
    // 移动模式
    this.movePattern = options.movePattern || 'random';
    this.moveParams = options.moveParams || {};
    this.moveTimer = 0;
    this.target = { x: options.targetX || 0, y: options.targetY || 0 };
    
    // 行为状态
    this.frozen = false;
    this.invincible = false;
    this.flashTime = 0;
    this.deadTimer = 0;
    
    // 攻击能力
    this.canAttack = options.canAttack !== undefined ? options.canAttack : true;
    this.fireRate = options.fireRate || 1;
    this.attackCooldown = 0;
    this.weapon = ENEMY_WEAPONS.BOLT;
    
    // Z 层管理
    this.zIndex = options.zIndex || 10;
  }
  
  update(dt, gameState) {
    if (this.frozen || this.dead) return;
    
    // 处理闪退时间
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flashColor = null;
    }
    
    // 冷却计时器
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    
    // 死亡倒计时
    if (this.dead) {
      this.deadTimer += dt;
      return;
    }
    
    // 移动模式
    this.updateMovement(dt);
    
    // 攻击逻辑
    if (this.canAttack && this.attackCooldown <= 0) {
      this.attemptAttack();
    }
    
    // 边界检查
    this.checkBoundaries();
    
    // 生成爆炸特效
    if (this.explosions && this.explosions.length > 0) {
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const exp = this.explosions[i];
        exp.t += dt;
        if (exp.t >= exp.duration) {
          this.explosions.splice(i, 1);
        }
      }
    }
  }
  
  updateMovement(dt) {
    this.moveTimer += dt;
    
    switch (this.movePattern) {
      case 'chase':
        MP.chase(this, this.target.x, this.target.y, this.moveParams.speed || 1.5);
        break;
        
      case 'orbit':
        MP.orbit(this, this.target.x, this.target.y, 
                 this.moveParams.radius || 150, this.moveParams.angular || 0.5);
        break;
        
      case 'sine':
        MP.sineWave(this, this.moveParams.amplitude || 100, 
                    this.moveParams.frequency || 2);
        break;
        
      case 'wander':
        MP.wander(this, this.moveParams.maxChange || 0.3);
        break;
        
      case 'stationary':
        // 保持静止
        break;
        
      default:
        // 随机移动
        this.updateRandomMovement(dt);
    }
  }
  
  updateRandomMovement(dt) {
    if (this.moveTimer < this.moveParams.interval || !this.moveParams.interval) {
      return;
    }
    
    // 重新选择目标点
    const margin = 50;
    this.target.x = this.x + (Math.random() - 0.5) * 400;
    this.target.y = this.y + (Math.random() - 0.5) * 400;
    
    this.moveTimer = 0;
  }
  
  checkBoundaries() {
    const margin = 60;
    if (this.x < margin) this.x = margin;
    if (this.x > canvas.width - margin) this.x = canvas.width - margin;
    if (this.y < margin) this.y = margin;
    if (this.y > canvas.height - margin) this.y = canvas.height - margin;
  }
  
  attemptAttack() {
    if (!this.canAttack) return;
    
    // 检查是否可见（不被障碍物遮挡）
    if (this.shouldFire()) {
      this.fire();
      this.attackCooldown = 1 / this.fireRate;
    }
  }
  
  shouldFire() {
    // 简化版：总是可以射击
    // TODO: 添加视线检测（使用 Raycasting 或遮挡检测）
    return true;
  }
  
  fire() {
    if (!this.weapon) return;
    
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    bulletsManager.spawnEnemyBullet({
      x: this.x,
      y: this.y,
      angle: angle,
      weapon: this.weapon
    });
  }
  
  takeDamage(amount, source) {
    if (this.invincible || this.dead) return false;
    
    this.hp -= amount;
    this.flash(0.1);
    
    // 伤害反馈
    source.damage?.(amount);
    
    // 死亡判定
    if (this.hp <= 0) {
      this.die(source);
      return true;
    }
    
    return false;
  }
  
  die(source) {
    this.dead = true;
    this.deadTimer = 0;
    
    // Spawn explosion particles with type-specific effects
    const typeColors = {
      drone: '#ffd54a',
      scout: '#ff6060',
      tank: '#3f7a56',
      sniper: '#9a7aab',
      swarmer: '#c0402b',
      elite: '#7fc4de',
      boss: '#e0573c'
    };
    const color = typeColors[this.type] || '#ffffff';
    
    if (this.type === 'boss') {
      particlesManager.spawn('deathShatter', this.x, this.y, color, 80);
      playSound('explosion', { vol: 1.5 });
      
      // Boss drops special power-up cascade
      setTimeout(() => {
        PowerUpSpawner.cascadeSpawn(this.x, this.y, 5);
      }, 500);
    } else {
      // Spawn damage numbers for score feedback
      if (Game && Game.player) {
        const comboMultiplier = Game.player.getComboMultiplier();
        const finalScore = Math.floor(this.scoreValue * comboMultiplier);
        
        // Show damage number at enemy position with combo color
        particlesManager.spawn('damageNumber', this.x, this.y - 30, finalScore, false, comboMultiplier);
      }
      
      particlesManager.spawn('explosion', this.x, this.y, 30, color);
      playSound('enemy_die');
      
      // Regular enemies have 10% chance to drop power-up
      PowerUpSpawner.dropFromEnemy(this, 0.10);
    }
    
    // Remove old explosion tracking
    this.explosions = [];
    
    // Trigger events
    if (source?.player) {
      source.player.onKill(this);
    }
  }
  
  createExplosion() {
    // Deprecated - particle system handles explosions now
    return;
  }
  
  flash(duration) {
    this.flashTime = duration;
    this.flashColor = '#ffffff';
  }
  
  freeze() {
    this.frozen = true;
  }
  
  unfreeze() {
    this.frozen = false;
  }
  
  draw(ctx) {
    if (this.dead && this.deadTimer > 0.2) return;
    
    ctx.save();
    
    // 绘制爆炸特效
    this.explosions.forEach(exp => exp.fx?.(ctx));
    
    // 绘制本体
    this.drawBody(ctx);
    
    // 绘制生命值条
    if (this.hp < this.maxHp) {
      this.drawHealthBar(ctx);
    }
    
    ctx.restore();
  }
  
  drawBody(ctx) {
    // 子类实现
  }
  
  drawHealthBar(ctx) {
    const barW = 30, barH = 4;
    const hpPct = this.hp / this.maxHp;
    const x = this.x - barW / 2;
    const y = this.y - this.radius - 10;
    
    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, barW, barH);
    
    // 血量
    ctx.fillStyle = `rgba(74, 124, 89, ${hpPct})`;
    ctx.fillRect(x, y, barW * hpPct, barH);
    
    // 边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);
  }
  
  setWeapon(type) {
    this.weapon = ENEMY_WEAPONS[type];
  }
}

// ==================== 敌人变体 ====================

export class Drone extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: ENEMY_TYPES.DRONE,
      scoreValue: 100,
      hp: 20,
      movePattern: 'wander',
      weapon: ENEMY_WEAPONS.BOLT
    });
    this.radius = 15;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 主体
    ctx.fillStyle = this.flashColor || '#88ccff';
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius, 0);
    ctx.closePath();
    ctx.fill();
    
    // 核心
    ctx.fillStyle = '#4a7c59';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  fire() {
    // 基础射击
  }
}

export class Scout extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: ENEMY_TYPES.SCOUT,
      scoreValue: 150,
      hp: 15,
      movePattern: 'chase',
      moveParams: { speed: 2.5 },
      canAttack: false
    });
    this.radius = 12;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 三角形飞行器
    ctx.fillStyle = this.flashColor || '#ffd54a';
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 1.5);
    ctx.lineTo(this.radius, this.radius);
    ctx.lineTo(-this.radius, this.radius);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

export class Tank extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: ENEMY_TYPES.TANK,
      scoreValue: 300,
      hp: 80,
      movePattern: 'wander',
      shield: 40,
      weapon: ENEMY_WEAPONS.BLASTER
    });
    this.radius = 25;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 厚装甲主体
    ctx.fillStyle = this.flashColor || '#4a7c59';
    ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    
    // 护盾指示器
    if (this.shield > 0) {
      ctx.strokeStyle = '#56b4e9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

export class Sniper extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: ENEMY_TYPES.SNIPE,
      scoreValue: 250,
      hp: 35,
      movePattern: 'stationary',
      weapon: ENEMY_WEAPONS.BEAM,
      fireRate: 0.5
    });
    this.radius = 18;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 长条形狙击手
    ctx.fillStyle = this.flashColor || '#c77dff';
    ctx.fillRect(-this.radius * 0.5, -this.radius, this.radius, this.radius * 2);
    
    // 瞄准镜
    ctx.fillStyle = '#e0573c';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  shouldFire() {
    // 远距离才射击
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist > 200;
  }
}

export class Swarmer extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: ENEMY_TYPES.SWARMER,
      scoreValue: 200,
      hp: 25,
      movePattern: 'chase',
      moveParams: { speed: 3 },
      canAttack: false,
      invincible: true
    });
    this.radius = 14;
    this.invincibleTime = 2;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 圆形自爆者
    ctx.fillStyle = this.flashColor || '#ff6060';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 脉冲效果
    const pulse = Math.sin(Date.now() / 100) * 3;
    ctx.strokeStyle = '#c0402b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }
  
  update(dt, gameState) {
    super.update(dt, gameState);
    
    if (this.invincible) {
      this.invincibleTime -= dt;
      if (this.invincibleTime <= 0) {
        this.invincible = false;
      }
    }
  }
  
  takeDamage(amount, source) {
    if (this.invincible) return false;
    return super.takeDamage(amount, source);
  }
  
  die(source) {
    super.die(source);
    
    // 接触伤害判定
    if (player.intersects(this)) {
      player.takeDamage(50, { source: this });
    }
  }
}

export class Elite extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: ENEMY_TYPES.ELITE,
      scoreValue: 500,
      hp: 150,
      shield: 60,
      movePattern: 'orbit',
      weapon: ENEMY_WEAPONS.MISSILE,
      fireRate: 0.8
    });
    this.radius = 28;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 八边形精英结构
    ctx.fillStyle = this.flashColor || '#7fc4de';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const x = Math.cos(angle) * this.radius;
      const y = Math.sin(angle) * this.radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // 核心能量
    ctx.fillStyle = '#f0e442';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// ==================== Boss 基类 ====================
export class Boss extends Enemy {
  constructor(options = {}) {
    super({
      ...options,
      type: 'boss',
      scoreValue: 10000,
      hp: BOSS_CONFIGS[options.bossType]?.hp?.standard || 5000,
      movePattern: 'pattern',
      canAttack: true,
      fireRate: 0.5
    });
    
    this.bossType = options.bossType || 'hydra';
    this.phase = 1;
    this.totalPhases = BOSS_CONFIGS[options.bossType]?.phases || 3;
    this.phaseStartTime = Date.now();
    this.patternTimer = 0;
    this.attackPatterns = [];
    this.currentPattern = null;
    
    // Boss 血条特殊样式
    this.zIndex = 15;
  }
  
  update(dt, gameState) {
    super.update(dt, gameState);
    
    // Boss 专属阶段逻辑
    this.updatePhase(dt);
    this.updateAttackPattern(dt);
  }
  
  updatePhase(dt) {
    // 基于时间和血量切换阶段
    const hpPercent = this.hp / this.maxHp;
    
    if (hpPercent < 0.5 && this.phase === 1) {
      this.enterPhase(2);
    } else if (hpPercent < 0.25 && this.phase === 2) {
      this.enterPhase(3);
    }
  }
  
  enterPhase(phaseNum) {
    this.phase = phaseNum;
    this.phaseStartTime = Date.now();
    
    // 广播阶段变化事件
    GameEvents.emit('boss_phase_change', {
      bossType: this.bossType,
      phase: phaseNum
    });
  }
  
  updateAttackPattern(dt) {
    this.patternTimer += dt;
    
    // 每个阶段有独特的攻击模式
    switch (this.currentPattern) {
      case 'spread':
        this.spawnSpreadBullets();
        break;
      case 'aimed':
        this.spawnAimedBullets();
        break;
      case 'circle':
        this.spawnCircleBullets();
        break;
      case 'rain':
        this.spawnRainBullets();
        break;
      case 'chaos':
        this.spawnChaosBullets();
        break;
    }
  }
  
  spawnSpreadBullets(count = 12) {
    const angleStep = Math.PI * 2 / count;
    for (let i = 0; i < count; i++) {
      const angle = this.patternTimer * 2 + i * angleStep;
      bulletsManager.spawnEnemyBullet({
        x: this.x,
        y: this.y,
        angle: angle,
        weapon: ENEMY_WEAPONS.BLASTER
      });
    }
  }
  
  spawnAimedBullets() {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const angle = Math.atan2(dy, dx);
    
    // 预测玩家位置
    const predictDist = 300;
    const predX = player.x + player.vx * predictDist / player.maxSpeed;
    const predY = player.y + player.vy * predictDist / player.maxSpeed;
    const aimedAngle = Math.atan2(predY - this.y, predX - this.x);
    
    bulletsManager.spawnEnemyBullet({
      x: this.x,
      y: this.y,
      angle: aimedAngle,
      weapon: ENEMY_WEAPONS.MISSILE
    });
  }
  
  spawnCircleBullets() {
    const radius = 150;
    const count = 8;
    const angleStep = Math.PI * 2 / count;
    
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep + this.patternTimer;
      const bx = this.x + Math.cos(angle) * radius;
      const by = this.y + Math.sin(angle) * radius;
      
      bulletsManager.spawnEnemyBullet({
        x: bx,
        y: by,
        angle: angle + Math.PI,
        weapon: ENEMY_WEAPONS.BOLT
      });
    }
  }
  
  spawnRainBullets() {
    if (this.patternTimer % 0.3 < 0.05) {
      const x = this.x + (Math.random() - 0.5) * 400;
      bulletsManager.spawnEnemyBullet({
        x: x,
        y: this.y - 20,
        angle: Math.PI / 2,
        weapon: ENEMY_WEAPONS.AOE
      });
    }
  }
  
  spawnChaosBullets() {
    // Switch attack pattern every 2 seconds instead of per-frame
    if (this.patternTimer % 2.0 < 0.05) {
      const pattern = Math.floor(Date.now() / 1000) % 4;
      switch (pattern) {
        case 0: this.currentPattern = 'spread'; break;
        case 1: this.currentPattern = 'aimed'; break;
        case 2: this.currentPattern = 'circle'; break;
        case 3: this.currentPattern = 'chaos'; break;
      }
    }
  }
}

// ==================== Boss 实现 ====================

// Global refs set in main.js to avoid circular deps
let player;
let bulletsManager;

export function setGameRefs(_player, _bulletsManager) {
  player = _player;
  bulletsManager = _bulletsManager;
}

export class Hydra extends Boss {
  constructor(options = {}) {
    super({ ...options, bossType: 'hydra' });
    this.heads = 3;
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 多头蛇主体
    ctx.fillStyle = this.flashColor || '#6b4b7a';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制头部
    for (let i = 0; i < this.heads; i++) {
      const headAngle = (i / this.heads) * Math.PI * 2 + this.patternTimer * 0.5;
      const hx = Math.cos(headAngle) * (this.radius + 20);
      const hy = Math.sin(headAngle) * (this.radius + 20);
      
      ctx.fillStyle = '#cc79a7';
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

export class Colossus extends Boss {
  constructor(options = {}) {
    super({ ...options, bossType: 'colossus' });
  }
  
  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // 巨像结构
    ctx.fillStyle = this.flashColor || '#c08a3e';
    ctx.fillRect(-this.radius, -this.radius * 2, this.radius * 2, this.radius * 4);
    
    // 核心能量
    ctx.fillStyle = '#f0e442';
    ctx.fillRect(-15, -30, 30, 60);
    
    ctx.restore();
  }
}

// ==================== 敌人生成管理器 ====================
export const EnemySpawner = {
  waveConfigs: [
    { count: 5, types: ['drone'], interval: 1.5 },
    { count: 8, types: ['drone', 'scout'], interval: 1.2 },
    { count: 10, types: ['drone', 'tank'], interval: 1.0 },
    { count: 15, types: ['sniper', 'swarmer', 'elite'], interval: 0.8 }
  ],
  
  generateWave(waveNum, difficulty = 'standard') {
    const config = this.waveConfigs[Math.min(waveNum - 1, this.waveConfigs.length - 1)];
    const enemies = [];
    
    for (let i = 0; i < config.count; i++) {
      const type = config.types[Math.floor(Math.random() * config.types.length)];
      const enemy = this.createEnemy(type, { difficulty });
      enemies.push(enemy);
    }
    
    return enemies;
  },
  
  createEnemy(typeStr, options = {}) {
    const typeMap = {
      drone: Drone,
      scout: Scout,
      tank: Tank,
      sniper: Sniper,
      swarmer: Swarmer,
      elite: Elite
    };
    
    const Constructor = typeMap[typeStr];
    if (!Constructor) throw new Error(`Unknown enemy type: ${typeStr}`);
    
    return new Constructor(options);
  }
};
