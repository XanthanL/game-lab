/**
 * 奇点回响 · 主入口文件
 * 
 * 游戏启动流程：
 * 1. 初始化音频上下文（用户交互触发）
 * 2. 加载配置和存档
 * 3. 初始化游戏循环
 * 4. 进入菜单系统
 * 
 * @module main
 */

import { configLoader } from './config.js';
import { GameState, GameLoop } from './game-loop.js';
import { Player, HULL_CONFIGS } from './player.js';
import { bulletsManager, BULLET_TYPES } from './bullets.js';
import { EnemySpawner, ENEMY_TYPES, Enemy } from './enemy.js';
import { audioManager, playSound, startMusic } from './audio.js';
import { saveManager, loadGame, saveGame } from './save.js';
import { hudSystem, menuSystem, cardSelector, achievements, notificationSystem } from './ui.js';
import { particlesManager } from './particles.js';
import { PowerUpSpawner } from './power-ups.js';
import { CardGenerator } from './upgrades.js';
import { bossSystem, BOSS_ATTACKS } from './boss.js';
import { triggerShake as vfxTriggerShake, update as vfxUpdate, render as vfxRender, triggerDamageFlash as vfxTriggerDamageFlash } from './vfx.js';

// ==================== 全局状态 ====================
const Game = {
  state: GameState.BOOT,
  lastTime: 0,
  accumulator: 0,
  
  // 游戏实体
  player: null,
  enemies: [],
  particles: [],
  
  // 游戏数据
  score: 0,
  wave: 1,
  level: 1,
  difficulty: 'standard',
  
  // 计时器
  startTime: 0,
  timeRemaining: 0,
  
  // 波次管理
  currentWave: null,
  waveInProgress: false,
  enemiesToSpawn: [],
  spawnTimer: 0,
  
  // 难度系数
  enemyScale: 1.0,
  dropRate: 1.0,
  
  // Screen Shake
  shakeDuration: 0,
  shakeIntensity: 5,
  
  // Slow Motion
  timeScale: 1.0,
  slowMotionActive: false
};

// ==================== 初始化 ====================

async function init() {
  console.log('[Init] Starting Singularity Echo...');
  
  try {
    // 1. 初始化音频（需要用户交互）
    await audioManager.init();
    
    // 2. 加载存档
    await loadSaveData();
    
    // 3. 初始化游戏世界
    initWorld();
    
    // 4. 创建游戏循环
    createGameLoop();
    
    // 5. 显示主菜单
    menuSystem.showMenu();
    
    Game.state = GameState.MENU;
    console.log('[Init] Ready');
    
  } catch (err) {
    console.error('[Init] Failed:', err);
    showError(err.message);
  }
}

function initWorld() {
  // Reset game state
  Game.score = 0;
  Game.wave = 1;
  Game.enemies = [];
  Game.particles = [];
  Game.enemiesToSpawn = [];
  Game.waveInProgress = false;
  
  // Create player
  const hullConfig = configLoader.getHullConfig('peregrine');
  Game.player = new Player({
    x: canvas.width / 2,
    y: canvas.height - 100,
    hullType: 'peregrine',
    stats: hullConfig.baseStats
  });
  
  // Initialize upgrade system
  Game.player.initUpgradeSystem();
  
  // Initialize HUD
  hudSystem.init(Game.player);
}

function createGameLoop() {
  // 游戏循环使用 requestAnimationFrame
  function loop(timestamp) {
    if (Game.state === GameState.BOOT || Game.state === GameState.PAUSED) {
      requestAnimationFrame(loop);
      return;
    }
    
    const dt = Math.min((timestamp - Game.lastTime) / 1000, 0.1);
    Game.lastTime = timestamp;
    
    update(dt);
    render();
    
    requestAnimationFrame(loop);
  }
  
  requestAnimationFrame(loop);
}

// ==================== 更新逻辑 ====================

function update(dt) {
  switch (Game.state) {
    case GameState.PLAYING:
      updatePlaying(dt);
      break;
      
    case GameState.OVER:
    case GameState.VICTORY:
      updateEndScreen(dt);
      break;
      
    default:
      break;
  }
}

function updatePlaying(dt) {
  // Apply slow motion
  const effectiveDt = dt * Game.timeScale;
  
  // Update player
  Game.player.update(effectiveDt, Game.state);
  
  // Update combo system
  Game.player.updateCombo(effectiveDt);
  
  // Update enemies (including Boss AI)
  for (let i = Game.enemies.length - 1; i >= 0; i--) {
    const enemy = Game.enemies[i];
    enemy.update(effectiveDt, Game.state);
    
    // Update Boss AI if this is a boss
    if (enemy.type === 'boss' && typeof bossSystem !== 'undefined') {
      bossSystem.updateBossAI(enemy, effectiveDt);
    }
    
    if (enemy.dead) {
      handleEnemyDeath(enemy, i);
    }
  }
  
  // Update bullets
  bulletsManager.update(effectiveDt, Game.state);
  
  // Update particles
  particlesManager.update(effectiveDt);
  
  // Update power-ups
  PowerUpSpawner.update(effectiveDt);
  
  // Update VFX system
  vfxUpdate(effectiveDt);
  
  // Adjust particle pool capacity based on game state (Performance optimization)
  const activeEnemyCount = Game.enemies.filter(e => !e.dead).length;
  const isBossFight = Game.enemies.some(e => e.type === 'boss' && !e.dead);
  if (typeof particlesManager !== 'undefined') {
    particlesManager.adjustCapacity(activeEnemyCount, isBossFight);
  }
  
  // Check wave progress
  checkWaveProgress();
  
  // Auto-save
  if (Date.now() - Game.lastAutoSave > 30000) {
    autoSave();
  }
}

function checkWaveProgress() {
  if (!Game.waveInProgress) return;
  
  // 如果所有敌人都被消灭
  if (Game.enemies.filter(e => !e.dead).length === 0) {
    completeWave();
  }
}

function completeWave() {
  Game.waveInProgress = false;
  
  // Play victory sound
  playSound('powerup');
  
  // Show wave clear message
  hudSystem.showWaveClear(Game.wave);
  
  // Give XP based on kills this wave
  const xpGained = Game.player.kills * 10;
  Game.player.addXp(xpGained);
  
  // Check for level up and show cards
  setTimeout(() => {
    if (Game.player.level >= 3) {
      cardSelector.showLevelUpCards();
    } else {
      // Continue to next wave
      setTimeout(() => {
        startWave(Game.wave + 1);
      }, 2000);
    }
  }, 1000);
}

// New function: Start boss fight with warning
function startBossFight(bossConfig) {
  // Clear existing enemies
  Game.enemies = Game.enemies.filter(e => e.dead);
  
  // Show warning notification
  notificationSystem.showToast(`⚠️ ${bossConfig.name.zh} APPROACHING`, 'info', 4000);
  
  // Play dramatic music or sound
  playSound('boss_enter');
  
  // Start boss warning sequence
  bossSystem.startBossFight(bossConfig, () => {
    console.log('[Main] Boss combat phase started');
  });
}

// ==================== 渲染逻辑 ====================

function render() {
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.fillStyle = '#0e1520';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Apply screen shake if active
  let shakeOffsetX = 0;
  let shakeOffsetY = 0;
  if (Game.shakeDuration > 0) {
    shakeOffsetX = (Math.random() - 0.5) * Game.shakeIntensity;
    shakeOffsetY = (Math.random() - 0.5) * Game.shakeIntensity;
    ctx.save();
    ctx.translate(shakeOffsetX, shakeOffsetY);
    Game.shakeDuration--;
  }
  
  // Draw starfield background
  drawStarfield(ctx);
  
  if (Game.state === GameState.PLAYING) {
    // Draw game entities
    drawGameEntities(ctx);
    
    // Draw HUD
    hudSystem.render(ctx, Game);
    
    // VFX overlays (damage flash, etc.)
    vfxRender(ctx);
  } else if (Game.state === GameState.OVER || Game.state === GameState.VICTORY) {
    // End screen
    renderEndScreen(ctx);
  }
  
  // Restore context if shake was applied
  if (Game.shakeDuration >= 0 || shakeOffsetX !== 0) {
    ctx.restore();
  }
}

function drawGameEntities(ctx) {
  // 绘制子弹（按 Z 索引排序）
  const allBullets = [
    ...bulletsManager.bullets.map(b => ({ ...b, type: 'bullet' }))
  ];
  allBullets.sort((a, b) => a.zIndex - b.zIndex);
  
  for (const bullet of allBullets) {
    bullet.draw(ctx);
  }
  
  // 绘制敌人
  for (const enemy of Game.enemies) {
    if (!enemy.dead) {
      enemy.draw(ctx);
    }
  }
  
  // 绘制玩家
  if (Game.player && !Game.player.dead) {
    Game.player.draw(ctx);
  }
  
  // 绘制粒子效果
  particlesManager.render(ctx);
  
  // 绘制道具
  PowerUpSpawner.render(ctx);
}

function drawStarfield(ctx) {
  // 简单星场效果（可从配置文件读取）
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ffffff';
  
  // 固定位置的星星
  const stars = starfieldStars || [];
  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ==================== 事件处理 ====================

function handleEnemyDeath(enemy, index) {
  // Remove enemy
  Game.enemies.splice(index, 1);
  
  // Calculate score with combo multiplier
  const comboMultiplier = Game.player.getComboMultiplier();
  const bonusScore = Math.floor(enemy.scoreValue * comboMultiplier);
  
  // Give score
  Game.score += bonusScore;
  
  // Stat kill count
  Game.player.kills++;
  
  // Record combo
  Game.player.onKill(enemy);
  
  // Update combo HUD display
  hudSystem.updateCombo(Game.player.comboCount, comboMultiplier);
  
  // Show toast for high combos (2x and above)
  const comboMult = Game.player.getComboMultiplier();
  if (comboMult >= 2.0 && Game.player.comboCount % 3 === 0) {
    const comboText = `${Game.player.comboCount}x Combo! +${Math.floor((comboMult - 1) * 100)}% Score`;
    notificationSystem.showToast(comboText, 'combo');
    
    // Multi-kill bonus at milestones
    if ([5, 10, 15, 20].includes(Game.player.comboCount)) {
      const isDouble = Game.player.comboCount >= 10;
      const text = isDouble ? `${Game.player.comboCount}x MULTI-KILL!` : `SUSTAINED COMBO ${Game.player.comboCount}x!`;
      
      // Play multi-kill celebration sound
      playSound('multi_kill');
      
      setTimeout(() => {
        notificationSystem.showToast(text, 'success');
      }, 500);
    }
  }
  
  // Check boss defeat
  if (enemy.type === 'boss') {
    handleBossDefeat();
  }
}

function handleBossDefeat() {
  // Boss battle victory handling
  Game.waveInProgress = false;
  playSound('powerup');
  
  // Unlock new hull?
  if (Game.wave === 15) {
    achievements.unlockAchievement('defeat_first_boss');
  }
}

// Old function - no longer needed, PowerUpSpawner handles all drops

// ==================== 波次生成 ====================

function startWave(waveNum) {
  Game.wave = waveNum;
  Game.waveInProgress = true;
  Game.enemiesToSpawn = EnemySpawner.generateWave(waveNum, Game.difficulty);
  Game.spawnTimer = 0;
  
  hudSystem.showWaveStart(waveNum);
  playSound('boss_enter');
}

function spawnNextEnemy() {
  if (Game.enemiesToSpawn.length === 0) return;
  
  const enemyTemplate = Game.enemiesToSpawn.shift();
  const enemy = new Enemy({
    ...enemyTemplate,
    x: rand(50, canvas.width - 50),
    y: rand(50, 200)
  });
  
  Game.enemies.push(enemy);
}

// ==================== 输入处理 ====================

function handleInput(action) {
  switch (action) {
    case 'move':
      // 由输入管理器处理
      break;
      
    case 'fire':
      if (Game.state === GameState.PLAYING && Game.player) {
        fireWeapon();
      }
      break;
      
    case 'dash':
      if (Game.state === GameState.PLAYING && Game.player) {
        Game.player.dash();
      }
      break;
      
    case 'pause':
      togglePause();
      break;
      
    case 'menu':
      showMainMenu();
      break;
  }
}

function fireWeapon() {
  if (!Game.player?.canAttack) return;
  
  // 根据当前武器类型射击
  const weapon = Game.player.activeWeapons[0] || 'pulse_cannon';
  const shot = bulletsManager.spawnPlayerBullet({
    x: Game.player.x,
    y: Game.player.y - 20,
    angle: -Math.PI / 2,
    weapon: weapon
  });
  
  if (shot) {
    playSound('shoot', { x: Game.player.x, y: Game.player.y });
  }
}

// ==================== 游戏控制 ====================

function togglePause() {
  if (Game.state === GameState.PLAYING) {
    Game.state = GameState.PAUSED;
    menuSystem.showPause();
  } else if (Game.state === GameState.PAUSED) {
    Game.state = GameState.PLAYING;
    menuSystem.hidePause();
  }
}

function showMainMenu() {
  Game.state = GameState.MENU;
  menuSystem.showMenu();
}

function gameOver(reason) {
  Game.state = GameState.OVER;
  
  // 保存最终成绩
  saveFinalScore();
  
  // 显示结算界面
  hudSystem.showGameOver(Game.score, reason);
}

function gameVictory() {
  Game.state = GameState.VICTORY;
  
  // 保存最终成绩
  saveFinalScore();
  
  // 显示胜利界面
  hudSystem.showVictory(Game.score);
}

// ==================== 存档相关 ====================

async function loadSaveData() {
  const saved = loadGame();
  
  if (saved) {
    Game.difficulty = saved.settings?.difficulty || 'standard';
    Game.player?.loadFromSave(saved.profile);
    console.log('[Save] Loaded:', saved);
  } else {
    console.log('[Save] No save data found');
  }
}

function autoSave() {
  if (!Game.player) return;
  
  saveGame(
    Game.player.getProfileData(),
    getGameData(),
    getConfigData()
  );
  
  Game.lastAutoSave = Date.now();
}

function saveFinalScore() {
  if (!Game.player) return;
  
  const finalData = {
    profile: Game.player.getProfileData(),
    game: getGameData(),
    settings: getConfigData(),
    finalScore: Game.score,
    completionTime: formatTime(Date.now() - Game.startTime)
  };
  
  saveGame(finalData.profile, finalData.game, finalData.settings);
  console.log('[Save] Final score saved:', finalData);
}

function getGameData() {
  return {
    wave: Game.wave,
    score: Game.score,
    kills: Game.player?.kills || 0,
    level: Game.player?.level || 1
  };
}

function getConfigData() {
  return {
    difficulty: Game.difficulty,
    audioVolume: audioManager.volume,
    audioMuted: audioManager.muted
  };
}

// ==================== 辅助函数 ====================

/**
 * Trigger screen shake effect
 * @param {number} duration - Number of frames to shake (default: 10)
 * @param {number} intensity - Shake intensity in pixels (default: 5)
 */
function triggerShake(duration = 10, intensity = 5) {
  Game.shakeDuration = duration;
  Game.shakeIntensity = intensity;
}

/**
 * Activate slow motion effect
 * @param {number} scale - Time scale factor (0.3 = 30% speed, default: 0.3)
 * @param {number} duration - Duration in seconds (default: 2.0)
 */
function activateSlowMotion(scale = 0.3, duration = 2.0) {
  Game.timeScale = scale;
  Game.slowMotionActive = true;
  
  // Revert after duration
  setTimeout(() => {
    if (Game.state === GameState.PLAYING) {
      Game.timeScale = 1.0;
      Game.slowMotionActive = false;
    }
  }, duration * 1000);
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showError(message) {
  console.error('[Error]', message);
  // TODO: 显示错误 UI
}

/**
 * Global API helpers
 */
window.triggerShake = triggerShake;
window.activateSlowMotion = activateSlowMotion;

// ==================== 导出 API ====================

export {
  init,
  handleInput,
  startWave,
  spawnNextEnemy,
  Game
};

// ==================== 启动 ====================

// 等待 DOM 加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
