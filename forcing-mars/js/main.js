/**
 * main.js — Forcing Mars 强渡火星
 * 回合制卡牌对战 · 三深度关卡推进 · 左右对峙布局
 */

/* ============================================================
 * Phaser 游戏配置
 * ============================================================ */
// 布局配置：横屏 vs 竖屏（唯一坐标源为 LAYOUT，由 computeLayout 生成）
let isPortrait = false;
let LAYOUT = {};

function computeLayout() {
  // 根据窗口宽高比判断横竖屏
  isPortrait = window.innerHeight > window.innerWidth;

  if (isPortrait) {
    // 竖屏：640×960，敌人在上，玩家在下
    LAYOUT = {
      W: 640, H: 960,
      playerX: 320, playerY: 620,
      enemyX: 320, enemyY: 200,
      // 玩家状态（血条/护甲/状态图标）应锚定在玩家自身上方（底部），
      // 而非顶部——竖屏时敌人在上、玩家在下，hpBarY 若用顶部值会与怪物重叠。
      hpBarY: 470, hpBarW: 200,
      batteryY: 720, potionY: 758,
      intentIconY: 320, intentTextY: 348,
      // 回合提示移到中下部，避开顶部敌人区与底部玩家血条
      turnPhaseY: 430, drawPileY: 800, discardPileY: 800,
      enemyHpBarY: 290,
    };
  } else {
    // 横屏：960×640，玩家在左，敌人在右
    LAYOUT = {
      W: 960, H: 640,
      playerX: 200, playerY: 280,
      enemyX: 820, enemyY: 280,
      hpBarY: 150, hpBarW: 170,
      batteryY: 440, potionY: 488,
      intentIconY: 58, intentTextY: 86,
      turnPhaseY: 390, drawPileY: 460, discardPileY: 460,
      enemyHpBarY: 150,
    };
  }
}

computeLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: LAYOUT.W,
  height: LAYOUT.H,
  parent: 'game-container',
  backgroundColor: '#1a0808',
  scene: [StoryScene, {
    key: 'BattleScene',
    preload,
    create,
    update,
  }],
  // FIT：以设计分辨率为唯一坐标系，画布等比缩放适配任意屏幕（手机/桌面），
  // 触点坐标由 Phaser 自动映射，无需关心真实像素尺寸
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2, // 触屏多指容错
  },
});

// 屏幕方向改变（手机横竖屏切换 / 窗口拖拽）：切换设计分辨率并重启当前场景
let restoreAfterRotate = false; // 旋转重启后静默续档标记
window.addEventListener('resize', () => {
  const wasPortrait = isPortrait;
  computeLayout();
  if (wasPortrait !== isPortrait) {
    // 旋转前先落盘存档，重启后无缝恢复进度（不弹询问框）
    if (GameState.player && GameState.turnPhase !== 'characterSelect' && GameState.turnPhase !== 'gameOver') {
      saveGame();
      restoreAfterRotate = true;
    }
    game.scale.setGameSize(LAYOUT.W, LAYOUT.H);
    game.scale.refresh();
    game.scene.getScenes(true).forEach((s) => s.scene.restart());
  } else {
    game.scale.refresh();
  }
});

/* ============================================================
 * 资源预加载
 * ============================================================ */
function preload() {
  const scene = this;

  // 加载进度条（定义在 story.js，两场景共用）
  createLoadingIndicator(scene, '着陆数据同步中');

  // 背景
  scene.load.image('bg-surface', 'assets/backgrounds/bg_surface.jpg');
  scene.load.image('bg-shallow', 'assets/backgrounds/bg_shallow.jpg');
  scene.load.image('bg-core', 'assets/backgrounds/bg_core.jpg');

  // 敌人
  scene.load.image('enemy_mars_leech', 'assets/enemies/enemy_mars_leech.png');
  scene.load.image('enemy_dune_stalker', 'assets/enemies/enemy_dune_stalker.png');
  scene.load.image('enemy_red_crawler', 'assets/enemies/enemy_red_crawler.png');
  scene.load.image('enemy_crystal_parasite', 'assets/enemies/enemy_crystal_parasite.png');
  scene.load.image('enemy_deep_lurker', 'assets/enemies/enemy_deep_lurker.png');
  scene.load.image('enemy_mars_devourer', 'assets/enemies/enemy_mars_devourer.png');

  // 玩家（四职业独立立绘）
  scene.load.image('player_astronaut', 'assets/player/player_astronaut.png');
  scene.load.image('player_engineer', 'assets/player/player_engineer.png');
  scene.load.image('player_mutant', 'assets/player/player_mutant.png');
  scene.load.image('player_assault', 'assets/player/player_assault.png');

  // UI
  scene.load.image('ui_btn_endturn', 'assets/ui/ui_btn_endturn.png');

  // BGM 音频
  scene.load.audio('bgm-story', 'assets/bgms/bgm_story.mp3');
  scene.load.audio('bgm-battle', 'assets/bgms/bgm_battle.mp3');
  scene.load.audio('bgm-boss', 'assets/bgms/bgm_boss.mp3');
}

/* ============================================================
 * 全局状态（收敛到 GameState，便于调试、存档、扩展）
 * ============================================================ */
const GameState = {
  player: null,
  enemy: null,
  enemyQueue: [],
  depthLevel: 0,
  isFinalBossDefeated: false,

  drawPile: null,
  hand: [],
  discardPile: [],

  turnPhase: 'idle',

  cardContainers: [],
  logLines: [],
  MAX_LOG: 4,

  // 药水系统
  potions: [],          // 当前持有的药水实例数组
  MAX_POTIONS: 3,       // 药水槽上限
  potionContainers: [], // 药水槽 UI 容器引用

  // 地图路线系统
  currentMapNodes: [],    // 当前层的可选节点
  visitedNodes: [],       // 已访问的节点（用于地图历史）
  nodeBattleCount: 0,     // 当前层已进行的战斗次数
  battlesPerLayer: 2,     // 每层需要战斗的次数后进入下一层
  currentMapData: null,   // 杀戮尖塔式完整地图数据

  // 金币系统
  gold: 0,                // 当前持有金币

  // 小 Boss 战标记
  isMiniBossBattle: false,

  // 结局追踪
  endingStats: {
    battlesWon: 0,
    elitesDefeated: 0,
    curseCardsGained: 0,
    voidChoices: 0,
    lightChoices: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    potionsUsed: 0,
    relicsCollected: 0,
    cardsRemoved: 0,
    goldEarned: 0,
    shopsUsed: 0,
    eventsTriggered: 0,
    floorsCleared: 0,
  },
  endingFlags: {
    hasVoidRelic: false,
    hasCurseInDeck: false,
    killedBossWithVoid: false,
    usedVoidEvent: false,
    usedPurifyEvent: false,
  },
};

/* ============================================================
 * UI 组件引用
 * ============================================================ */
let backgroundImage;
let depthUI;
let depthText;
let depthSegLabels = [];
let logText;
let drawPileText;
let discardPileText;
let turnPhaseText;

// 玩家（左侧）
let playerContainer;
let playerSprite;
let playerHpBarBg;
let playerHpBarFill;
let playerShieldBar;
let playerHpText;
let playerShieldIcon;
let playerShieldText;
let batterySlots = [];
let playerRelicSlots = [];
let playerStatusIcons = []; // 玩家状态效果图标

// 敌人（右侧）
let enemyContainer;
let enemySprite;
let enemyNameText;
let enemyHpBarBg;
let enemyHpBarFill;
let enemyShieldBar;
let enemyHpText;
let enemyShieldText;
let enemyIntentIcon;
let enemyIntentText;
let enemyMaskShape;
let bossChargeTween;
let bossWarningText;
let enemyStatusIcons = []; // 敌人状态效果图标

// 结束回合按钮
let endTurnBtn;

// 金币显示
let goldText;

/* ============================================================
 * 场景钩子 create
 * ============================================================ */
function create() {
  /* ---------- 旋转恢复：方向切换重启后静默续档，不打断游玩 ---------- */
  if (restoreAfterRotate) {
    restoreAfterRotate = false;
    if (hasSave() && resumeFromSave(this)) return;
  }

  /* ---------- 检查存档 ---------- */
  if (hasSave()) {
    showSaveLoadPrompt(this);
    return;
  }

  // 没有存档，显示角色选择
  showCharacterSelection(this);
}

/** 显示角色选择界面 */
function showCharacterSelection(scene) {
  GameState.turnPhase = 'characterSelect';

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.95);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  // 标题
  const title = scene.add.text(LAYOUT.W / 2, 60, '◆ 选择你的角色 ◆', {
    fontSize: '32px',
    fontFamily: FONT_UI,
    color: '#66ddff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const hint = scene.add.text(LAYOUT.W / 2, 105, '不同角色拥有不同的生命值、电量和被动技能', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#88aabb',
  }).setOrigin(0.5);

  // 角色卡片
  const charKeys = Object.keys(CHARACTERS);
  const cardW = isPortrait ? 140 : 160;
  const cardH = isPortrait ? 360 : 400;
  const gap = 16;
  const totalW = charKeys.length * cardW + (charKeys.length - 1) * gap;
  const startX = (LAYOUT.W - totalW) / 2 + cardW / 2;
  const cardY = LAYOUT.H / 2 + 20;

  const charCards = [];

  for (let i = 0; i < charKeys.length; i++) {
    const char = CHARACTERS[charKeys[i]];
    const x = startX + i * (cardW + gap);

    const container = scene.add.container(x, cardY);
    const bg = scene.add.graphics();
    const drawBg = (highlighted, selected) => {
      bg.clear();
      bg.fillStyle(highlighted ? 0x1a2a3a : 0x0a1525, 0.98);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
      bg.lineStyle(highlighted ? 3 : 2, highlighted ? 0x66ffff : char.color, highlighted ? 1 : 0.8);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
    };
    drawBg(false, false);
    container.add(bg);

    // 顶部颜色条
    const topBar = scene.add.graphics();
    topBar.fillStyle(char.color, 0.85);
    topBar.fillRoundedRect(-cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, 32, { tl: 7, tr: 7, bl: 0, br: 0 });
    container.add(topBar);

    // 角色名
    const nameText = scene.add.text(0, -cardH / 2 + 24, char.name, {
      fontSize: '20px',
      fontFamily: FONT_UI,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(nameText);

    // 角色标题
    const titleText = scene.add.text(0, -cardH / 2 + 60, char.title, {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: '#aacccc',
      fontStyle: 'italic',
    }).setOrigin(0.5);
    container.add(titleText);

    // 角色立绘
    const avatarKey = char.sprite;
    const avatarSize = 96;
    const avatarCY = -cardH / 2 + 128;
    if (scene.textures.exists(avatarKey)) {
      const avatarImg = scene.add.image(0, avatarCY, avatarKey)
        .setOrigin(0.5)
        .setDisplaySize(avatarSize, avatarSize);
      const avatarMaskShape = scene.add.graphics();
      avatarMaskShape.fillStyle(0xffffff);
      // 遮罩用世界坐标（geometry mask 不随容器变换）
      avatarMaskShape.fillRoundedRect(
        x - avatarSize / 2, cardY + avatarCY - avatarSize / 2,
        avatarSize, avatarSize, 10);
      avatarImg.setMask(avatarMaskShape.createGeometryMask());
      avatarMaskShape.setVisible(false);
      container.add(avatarImg);
      const avatarFrame = scene.add.graphics();
      avatarFrame.lineStyle(2, char.color, 0.8);
      avatarFrame.strokeRoundedRect(-avatarSize / 2, avatarCY - avatarSize / 2, avatarSize, avatarSize, 10);
      container.add(avatarFrame);
    } else {
      const avatar = scene.add.graphics();
      avatar.fillStyle(char.color, 0.4);
      avatar.fillRoundedRect(-40, -cardH / 2 + 80, 80, 80, 10);
      avatar.lineStyle(2, char.color, 0.8);
      avatar.strokeRoundedRect(-40, -cardH / 2 + 80, 80, 80, 10);
      container.add(avatar);
    }

    // 属性
    const statsY = -cardH / 2 + 180;
    const hpText = scene.add.text(0, statsY, `♥ ${char.maxHp} HP`, {
      fontSize: '14px',
      fontFamily: FONT_UI,
      color: '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(hpText);

    const batteryText = scene.add.text(0, statsY + 22, `⚡ ${char.baseBattery} 电量`, {
      fontSize: '14px',
      fontFamily: FONT_UI,
      color: '#33ccff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(batteryText);

    // 描述
    const descText = scene.add.text(0, statsY + 60, char.desc, {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: '#ddeeff',
      align: 'center',
      wordWrap: { width: cardW - 16 },
      lineSpacing: 4,
    }).setOrigin(0.5);
    container.add(descText);

    // 点击热区
    const hitZone = scene.add.rectangle(0, 0, cardW + 8, cardH + 8, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      scene.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
      drawBg(true, false);
    });
    hitZone.on('pointerout', () => {
      scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
      drawBg(false, false);
    });
    hitZone.on('pointerdown', () => {
      charCards.forEach(c => c.hitZone.disableInteractive());
      scene.tweens.add({
        targets: container,
        scaleX: 1.2, scaleY: 1.2, alpha: 0,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          overlay.destroy();
          title.destroy();
          hint.destroy();
          charCards.forEach(c => c.container.destroy());
          startNewGameWithCharacter(scene, char.id);
        },
      });
    });

    charCards.push({ container, hitZone, bg });
  }
}

/** 开始新游戏（指定角色） */
function startNewGameWithCharacter(scene, characterId) {
  GameState.player = new Player(characterId);
  GameState.depthLevel = 0;
  GameState.isFinalBossDefeated = false;
  GameState.turnPhase = 'idle';
  GameState.hand = [];
  GameState.discardPile = [];
  GameState.drawPile = new DrawPile(buildStarterDeck(characterId));
  GameState.cardContainers = [];
  GameState.logLines = [];
  GameState.potions = [];
  GameState.potionContainers = [];
  GameState.currentMapNodes = [];
  GameState.visitedNodes = [];
  GameState.nodeBattleCount = 0;
  GameState.battlesPerLayer = 2;
  GameState.currentMapData = null;
  GameState.gold = 0;
  GameState.isMiniBossBattle = false;

  // 重置结局追踪（避免跨局污染）
  for (const k of Object.keys(GameState.endingStats)) GameState.endingStats[k] = 0;
  for (const k of Object.keys(GameState.endingFlags)) GameState.endingFlags[k] = false;

  initLevel(GameState.depthLevel);
  setupScene(scene);

  addLog('系统', `=== 强渡火星 ===`);
  addLog('系统', `角色：${GameState.player.name} — ${GameState.player.character.title}`);
  addLog('系统', `当前深度：${DEPTH_LEVELS[GameState.depthLevel].label}`);

  refreshUI(scene);
  scene.time.delayedCall(500, () => {
    showMapSelectionPopup(scene, (node) => handleMapNodeSelected(scene, node));
  });
}

/** 显示存档加载提示 */
function showSaveLoadPrompt(scene) {
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.9);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = Math.min(500, LAYOUT.W - 40);
  const popupH = 280;
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x0a1a2a, 0.98);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0x33ccff, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 55, '◆ 检测到存档 ◆', {
    fontSize: '24px',
    fontFamily: FONT_UI,
    color: '#66ffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const hint = scene.add.text(LAYOUT.W / 2, popupY + 100, '是否继续上次的进度？', {
    fontSize: '15px',
    fontFamily: FONT_UI,
    color: '#aaccdd',
  }).setOrigin(0.5);

  // 继续游戏按钮
  const continueBtn = scene.add.container(LAYOUT.W / 2, popupY + 170);
  const continueBg = scene.add.graphics();
  continueBg.fillStyle(0x113322, 1);
  continueBg.fillRoundedRect(-100, -22, 200, 44, 10);
  continueBg.lineStyle(2, 0x44ff88, 1);
  continueBg.strokeRoundedRect(-100, -22, 200, 44, 10);
  continueBtn.add(continueBg);

  const continueText = scene.add.text(0, 0, '继续游戏', {
    fontSize: '17px',
    fontFamily: FONT_UI,
    color: '#44ff88',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  continueBtn.add(continueText);

  const continueHit = scene.add.rectangle(0, 0, 200, 44, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  continueBtn.add(continueHit);

  continueHit.on('pointerover', () => {
    continueBg.clear();
    continueBg.fillStyle(0x1a4433, 1);
    continueBg.fillRoundedRect(-100, -22, 200, 44, 10);
    continueBg.lineStyle(2, 0x88ffaa, 1);
    continueBg.strokeRoundedRect(-100, -22, 200, 44, 10);
  });
  continueHit.on('pointerout', () => {
    continueBg.clear();
    continueBg.fillStyle(0x113322, 1);
    continueBg.fillRoundedRect(-100, -22, 200, 44, 10);
    continueBg.lineStyle(2, 0x44ff88, 1);
    continueBg.strokeRoundedRect(-100, -22, 200, 44, 10);
  });
  continueHit.on('pointerdown', () => {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    hint.destroy();
    continueBtn.destroy();
    newGameBtn.destroy();

    if (!resumeFromSave(scene)) {
      // 加载失败，删掉坏档走选人界面开新局
      deleteSave();
      showCharacterSelection(scene);
    }
  });

  // 新游戏按钮
  const newGameBtn = scene.add.container(LAYOUT.W / 2, popupY + 230);
  const newGameBg = scene.add.graphics();
  newGameBg.fillStyle(0x331122, 1);
  newGameBg.fillRoundedRect(-100, -22, 200, 44, 10);
  newGameBg.lineStyle(2, 0xff6644, 1);
  newGameBg.strokeRoundedRect(-100, -22, 200, 44, 10);
  newGameBtn.add(newGameBg);

  const newGameText = scene.add.text(0, 0, '开始新游戏', {
    fontSize: '17px',
    fontFamily: FONT_UI,
    color: '#ff6644',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  newGameBtn.add(newGameText);

  const newGameHit = scene.add.rectangle(0, 0, 200, 44, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  newGameBtn.add(newGameHit);

  newGameHit.on('pointerover', () => {
    newGameBg.clear();
    newGameBg.fillStyle(0x442222, 1);
    newGameBg.fillRoundedRect(-100, -22, 200, 44, 10);
    newGameBg.lineStyle(2, 0xff8866, 1);
    newGameBg.strokeRoundedRect(-100, -22, 200, 44, 10);
  });
  newGameHit.on('pointerout', () => {
    newGameBg.clear();
    newGameBg.fillStyle(0x331122, 1);
    newGameBg.fillRoundedRect(-100, -22, 200, 44, 10);
    newGameBg.lineStyle(2, 0xff6644, 1);
    newGameBg.strokeRoundedRect(-100, -22, 200, 44, 10);
  });
  newGameHit.on('pointerdown', () => {
    deleteSave();
    overlay.destroy();
    popup.destroy();
    title.destroy();
    hint.destroy();
    continueBtn.destroy();
    newGameBtn.destroy();
    // 新开局走选人界面，而不是固定宇航员
    showCharacterSelection(scene);
  });
}

/** 从存档恢复并进入地图选择（返回是否成功） */
function resumeFromSave(scene) {
  if (!loadGame()) return false;
  initLevel(GameState.depthLevel);
  setupScene(scene);
  addLog('系统', '=== 存档已加载 ===');
  addLog('系统', `当前深度：${DEPTH_LEVELS[GameState.depthLevel].label}`);
  refreshUI(scene);
  scene.time.delayedCall(400, () => {
    showMapSelectionPopup(scene, (node) => handleMapNodeSelected(scene, node));
  });
  return true;
}

/** 场景 UI 初始化（新游戏和加载存档共用） */
function setupScene(scene) {
  /* ---------- 背景 ---------- */
  setBackgroundForLevel(scene, GameState.depthLevel);

  /* ---------- 顶部状态栏 ---------- */
  createDepthUI(scene);

  /* ---------- 日志 ---------- */
  logText = scene.add.text(LAYOUT.W / 2, 58, '', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#ffddbb',
    align: 'center',
    lineSpacing: 4,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5, 0);

  /* ---------- 角色对抗区 ---------- */
  createPlayerUI(scene);
  createEnemyUI(scene);

  /* ---------- 药水槽 UI ---------- */
  createPotionUI(scene);

  /* ---------- 金币显示 ---------- */
  goldText = scene.add.text(LAYOUT.W - 100, 50, '', {
    fontSize: '16px',
    fontFamily: FONT_UI,
    color: '#ffdd44',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(100);

  /* ---------- 阶段提示 ---------- */
  turnPhaseText = scene.add.text(LAYOUT.W / 2, LAYOUT.turnPhaseY, '', {
    fontSize: '15px',
    fontFamily: FONT_UI,
    color: '#ffaa44',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  /* ---------- 牌库信息（左右下角） ---------- */
  drawPileText = scene.add.text(40, LAYOUT.drawPileY, '', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#ffccaa',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  discardPileText = scene.add.text(LAYOUT.W - 40, LAYOUT.discardPileY, '', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#ffccaa',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  /* ---------- 结束回合按钮 ---------- */
  endTurnBtn = createEndTurnButton(scene);

}

/* ============================================================
 * 背景图管理
 * ============================================================ */
function setBackgroundForLevel(scene, levelIndex) {
  const bgKeys = ['bg-surface', 'bg-shallow', 'bg-core'];
  const bgKey = bgKeys[levelIndex] || bgKeys[0];

  if (backgroundImage) backgroundImage.destroy();

  backgroundImage = scene.add.image(0, 0, bgKey)
    .setOrigin(0)
    .setDisplaySize(LAYOUT.W, LAYOUT.H)
    .setDepth(-10);
}

/* ============================================================
 * 深度指示器（顶部状态栏）
 * ============================================================ */
function createDepthUI(scene) {
  depthUI = scene.add.graphics();
  updateDepthUI(scene);
}

function updateDepthUI(scene) {
  depthUI.clear();

  const barH = 42;

  // 背景条
  depthUI.fillStyle(0x0a0505, 0.92);
  depthUI.fillRect(0, 0, LAYOUT.W, barH);

  // 顶部霓虹绿线
  depthUI.lineStyle(1, 0x33ff77, 0.6);
  depthUI.lineBetween(0, barH - 1, LAYOUT.W, barH - 1);

  // 左侧标签
  depthUI.fillStyle(0x22aa44, 1);
  depthUI.fillRect(0, 0, 4, barH);

  // 清理旧段标签
  for (const lbl of depthSegLabels) { lbl.destroy(); }
  depthSegLabels = [];

  // 三段式深度指示条（竖屏时缩小以适配窄屏）
  const indicatorY = barH / 2;
  const segmentH = 16;
  let indicatorStartX, segmentW, gap;
  if (isPortrait) {
    segmentW = 120;
    gap = 8;
    const totalIndicatorW = 3 * segmentW + 2 * gap;
    indicatorStartX = (LAYOUT.W - totalIndicatorW) / 2;
  } else {
    indicatorStartX = 300;
    segmentW = 160;
    gap = 10;
  }

  for (let i = 0; i < 3; i++) {
    const lvl = DEPTH_LEVELS[i];
    const segX = indicatorStartX + i * (segmentW + gap);
    const isActive = i === GameState.depthLevel;
    const isPast = i < GameState.depthLevel;

    depthUI.fillStyle(0x1a1110, 0.85);
    depthUI.fillRoundedRect(segX, indicatorY - segmentH / 2, segmentW, segmentH, 3);

    if (isActive) {
      depthUI.fillStyle(lvl.color, 0.9);
      depthUI.fillRoundedRect(segX, indicatorY - segmentH / 2, segmentW, segmentH, 3);
      depthUI.lineStyle(2, 0x33ff77, 1);
      depthUI.strokeRoundedRect(segX, indicatorY - segmentH / 2, segmentW, segmentH, 3);
    } else if (isPast) {
      depthUI.fillStyle(0x4a2820, 0.7);
      depthUI.fillRoundedRect(segX, indicatorY - segmentH / 2, segmentW, segmentH, 3);
    }

    const segLabel = scene.add.text(segX + segmentW / 2, indicatorY, lvl.depth, {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: isActive ? '#ccffcc' : (isPast ? '#887766' : '#55332a'),
      fontStyle: isActive ? 'bold' : 'normal',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    depthSegLabels.push(segLabel);
  }

  // 深度文字
  if (depthText) depthText.destroy();
  const depthStr = GameState.depthLevel === 0 ? '地表' :
    GameState.depthLevel === 1 ? '地下浅层' : '地核深处';
  depthText = scene.add.text(LAYOUT.W / 2, 10, `◈ 探索深度  ${DEPTH_LEVELS[GameState.depthLevel].depth}  —  ${depthStr}`, {
    fontSize: '16px',
    fontFamily: FONT_UI,
    color: '#66ff99',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5, 0);
}

/* ============================================================
 * 玩家 UI（左侧）
 * ============================================================ */
function createPlayerUI(scene) {
  playerContainer = scene.add.container(0, 0);

  const px = LAYOUT.playerX;
  const py = LAYOUT.playerY;

  // 玩家底色板（与立绘深色背景融为一体）
  const playerBg = scene.add.graphics();
  playerBg.fillStyle(0x140806, 1);
  playerBg.fillRoundedRect(px - 72, py - 72, 144, 144, 16);
  playerBg.lineStyle(2, 0x336688, 0.6);
  playerBg.strokeRoundedRect(px - 72, py - 72, 144, 144, 16);
  playerContainer.add(playerBg);

  // 玩家立绘（按职业选图）
  const playerSpriteKey = (GameState.player && GameState.player.character.sprite) || 'player_astronaut';
  if (scene.textures.exists(playerSpriteKey)) {
    playerSprite = scene.add.image(px, py, playerSpriteKey)
      .setOrigin(0.5)
      .setDisplaySize(144, 144);
  } else {
    const fallback = scene.add.graphics();
    fallback.fillStyle(0x224466, 1);
    fallback.fillRoundedRect(px - 60, py - 60, 120, 120, 12);
    fallback.lineStyle(2, 0x66ccff, 1);
    fallback.strokeRoundedRect(px - 60, py - 60, 120, 120, 12);
    playerSprite = fallback;
  }
  // 圆角矩形遮罩，与底板对齐
  const playerMaskShape = scene.add.graphics();
  playerMaskShape.fillStyle(0xffffff);
  playerMaskShape.fillRoundedRect(px - 71, py - 71, 142, 142, 15);
  const playerMask = playerMaskShape.createGeometryMask();
  playerSprite.setMask(playerMask);
  playerMaskShape.setVisible(false);
  playerContainer.add(playerSprite);
  playerContainer.add(playerMaskShape);

  // 玩家名
  const nameText = scene.add.text(px, py + 82, GameState.player.name, {
    fontSize: '15px',
    fontFamily: FONT_UI,
    color: '#66ddff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);
  playerContainer.add(nameText);

  // HP 条位置（顶部，对齐敌人血条 Y=150）
  // 在 updatePlayerUI 中使用 hpBarY = 150

  // HP 条
  playerHpBarBg = scene.add.graphics();
  playerHpBarFill = scene.add.graphics();
  playerShieldBar = scene.add.graphics();
  playerContainer.add([playerHpBarBg, playerShieldBar, playerHpBarFill]);

  // HP 数值
  playerHpText = scene.add.text(0, 0, '', {
    fontSize: '13px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  playerContainer.add(playerHpText);

  // 护盾图标（六边形）
  playerShieldIcon = scene.add.graphics();
  playerShieldText = scene.add.text(0, 0, '', {
    fontSize: '12px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  playerContainer.add([playerShieldIcon, playerShieldText]);

  // 能量电池槽
  batterySlots = [];
  for (let i = 0; i < GameState.player.maxBattery; i++) {
    const slot = scene.add.graphics();
    playerContainer.add(slot);
    batterySlots.push(slot);
  }

  // 遗物槽（空位与已获取遗物均由 updatePlayerUI 绘制）
  playerRelicSlots = [];

  updatePlayerUI(scene);
}

function drawHexagon(gfx, cx, cy, r, color, alpha) {
  gfx.fillStyle(color, alpha);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 2;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  gfx.fillPoints(points, true, true);
}

function drawHexagonOutline(gfx, cx, cy, r, color, alpha, lineWidth = 1.5) {
  gfx.lineStyle(lineWidth, color, alpha);
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 2;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  gfx.strokePoints(points, true, true);
}

function drawStar(gfx, cx, cy, points, outerR, innerR) {
  const path = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    path.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  gfx.fillPoints(path, true, true);
}

function updatePlayerUI(scene) {
  const px = LAYOUT.playerX;
  const hpBarY = LAYOUT.hpBarY;
  const hpBarW = LAYOUT.hpBarW;
  const hpBarH = 14;
  const hpBarX = px - hpBarW / 2;

  // HP 条背景
  playerHpBarBg.clear();
  playerHpBarBg.fillStyle(0x2a1410, 1);
  playerHpBarBg.fillRoundedRect(hpBarX, hpBarY, hpBarW, hpBarH, 4);

  // 护盾覆盖条
  playerShieldBar.clear();
  const shieldRatio = Math.min(GameState.player.shield / GameState.player.maxHp, 1);
  if (shieldRatio > 0) {
    playerShieldBar.fillStyle(0x44aaff, 0.5);
    playerShieldBar.fillRoundedRect(hpBarX, hpBarY, hpBarW * shieldRatio, hpBarH, 4);
  }

  // HP 填充
  playerHpBarFill.clear();
  const hpRatio = GameState.player.hp / GameState.player.maxHp;
  const hpColor = hpRatio > 0.5 ? 0x33cc55 : (hpRatio > 0.25 ? 0xccaa33 : 0xcc3333);
  playerHpBarFill.fillStyle(hpColor, 1);
  playerHpBarFill.fillRoundedRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH, 4);

  // HP 数值
  playerHpText.setPosition(px, hpBarY + hpBarH / 2);
  playerHpText.setText(`${GameState.player.hp}/${GameState.player.maxHp}`);

  // 护盾六边形
  playerShieldIcon.clear();
  const shieldX = hpBarX - 24;
  const shieldY = hpBarY + hpBarH / 2;
  if (GameState.player.shield > 0) {
    drawHexagon(playerShieldIcon, shieldX, shieldY, 16, 0x44aaff, 1);
    playerShieldText.setPosition(shieldX, shieldY);
    playerShieldText.setText(`${GameState.player.shield}`);
  } else {
    playerShieldText.setText('');
  }

  // 电池槽（动态增减，以适配遗物提升的最大电量）
  const battY = LAYOUT.batteryY;
  while (batterySlots.length < GameState.player.maxBattery) {
    const slot = scene.add.graphics();
    playerContainer.add(slot);
    batterySlots.push(slot);
  }
  while (batterySlots.length > GameState.player.maxBattery) {
    const slot = batterySlots.pop();
    slot.destroy();
  }
  for (let i = 0; i < batterySlots.length; i++) {
    const slot = batterySlots[i];
    slot.clear();
    const filled = i < GameState.player.battery;
    const color = filled ? 0x33ccff : 0x223344;
    const glow = filled ? 0x66ffff : 0x112233;
    const x = px - 40 + i * 28;
    slot.lineStyle(2, glow, filled ? 1 : 0.4);
    slot.fillStyle(color, filled ? 1 : 0.3);
    slot.fillCircle(x, battY, 10);
    slot.strokeCircle(x, battY, 10);
  }

  // 状态效果图标（HP 条下方，遗物槽上方）
  for (const icon of playerStatusIcons) { icon.destroy(); }
  playerStatusIcons = [];
  const statusY = hpBarY + hpBarH + 8;
  drawStatusIcons(scene, playerContainer, px - 60, statusY, GameState.player, playerStatusIcons);

  // 遗物槽（状态效果图标下方）
  for (const slot of playerRelicSlots) { slot.destroy(); }
  playerRelicSlots = [];

  const relicY = statusY + 18;
  const relicSize = 10;
  const relicGap = 8;
  const relicStartX = hpBarX + relicSize + 4;

  if (GameState.player.relics.length === 0) {
    const emptySlot = scene.add.graphics();
    drawHexagonOutline(emptySlot, relicStartX, relicY, relicSize, 0x887766, 0.65);
    playerContainer.add(emptySlot);
    playerRelicSlots.push(emptySlot);
  } else {
    for (let i = 0; i < GameState.player.relics.length; i++) {
      const relic = GameState.player.relics[i];
      const rx = relicStartX + i * (relicSize * 2 + relicGap);
      const slot = scene.add.graphics();
      drawHexagon(slot, rx, relicY, relicSize, relic.color, 0.95);
      drawHexagonOutline(slot, rx, relicY, relicSize, 0xffffff, 0.4);
      playerContainer.add(slot);
      playerRelicSlots.push(slot);
    }
  }
}

/* ============================================================
 * 状态效果图标绘制（玩家 & 敌人通用）
 * ============================================================ */
const STATUS_ICON_CONFIG = {
  burn:        { color: 0xff6600, label: '灼' },
  poison:      { color: 0x66ff44, label: '毒' },
  vulnerable:  { color: 0xffff44, label: '伤' },
  strength:    { color: 0xff44ff, label: '力' },
  weak:        { color: 0x888888, label: '弱' },
  thorns:      { color: 0x88aa44, label: '反' },
};

function drawStatusIcons(scene, container, startX, startY, entity, iconArray) {
  const iconSize = 14;
  const iconGap = 4;
  let x = startX;

  for (const [type, config] of Object.entries(STATUS_ICON_CONFIG)) {
    const stacks = entity.getStatus(type);
    if (stacks > 0) {
      const iconBg = scene.add.graphics();
      iconBg.fillStyle(config.color, 0.9);
      iconBg.fillCircle(x, startY, iconSize);
      iconBg.lineStyle(1.5, 0x000000, 0.7);
      iconBg.strokeCircle(x, startY, iconSize);
      container.add(iconBg);
      iconArray.push(iconBg);

      const iconText = scene.add.text(x, startY, config.label, {
        fontSize: '11px',
        fontFamily: FONT_UI,
        color: '#000000',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(iconText);
      iconArray.push(iconText);

      const stackText = scene.add.text(x + iconSize - 2, startY - iconSize + 2, `${stacks}`, {
        fontSize: '11px',
        fontFamily: FONT_UI,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      container.add(stackText);
      iconArray.push(stackText);

      x += iconSize * 2 + iconGap;
    }
  }
}

/* ============================================================
 * 药水槽 UI
 * ============================================================ */
function createPotionUI(scene) {
  // 药水槽位于玩家电池槽下方（y=460）
  // 在 createPlayerUI 之后调用
  updatePotionUI(scene);
}

function updatePotionUI(scene) {
  // 清理旧 UI
  for (const c of GameState.potionContainers) { c.destroy(); }
  GameState.potionContainers = [];

  const px = LAYOUT.playerX;
  const potionY = LAYOUT.potionY;
  const slotSize = 32;
  const slotGap = 8;
  const totalSlots = GameState.MAX_POTIONS;
  const totalW = totalSlots * slotSize + (totalSlots - 1) * slotGap;
  const startX = px - totalW / 2 + slotSize / 2;

  for (let i = 0; i < totalSlots; i++) {
    const slotX = startX + i * (slotSize + slotGap);
    const potion = GameState.potions[i];
    const container = scene.add.container(slotX, potionY);

    if (potion) {
      // 有药水：绘制药水瓶
      const bottle = scene.add.graphics();
      // 瓶身（药水颜色）
      bottle.fillStyle(potion.color, 0.9);
      bottle.fillRoundedRect(-slotSize / 2 + 4, -slotSize / 2 + 6, slotSize - 8, slotSize - 12, 4);
      // 瓶颈
      bottle.fillStyle(0x332222, 0.8);
      bottle.fillRect(-4, -slotSize / 2 + 2, 8, 6);
      // 瓶身描边
      bottle.lineStyle(1.5, 0xffffff, 0.4);
      bottle.strokeRoundedRect(-slotSize / 2 + 4, -slotSize / 2 + 6, slotSize - 8, slotSize - 12, 4);
      container.add(bottle);

      // 药水名称首字
      const firstChar = scene.add.text(0, 0, potion.name.charAt(0), {
        fontSize: '13px',
        fontFamily: FONT_UI,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      container.add(firstChar);

      // 点击使用药水
      const hitZone = scene.add.rectangle(0, 0, slotSize + 8, slotSize + 8, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitZone);

      hitZone.on('pointerover', () => {
        scene.tweens.add({ targets: container, scaleY: 1.12, scaleX: 1.12, duration: 80 });
      });
      hitZone.on('pointerout', () => {
        scene.tweens.add({ targets: container, scaleY: 1, scaleX: 1, duration: 80 });
      });
      hitZone.on('pointerdown', () => {
        if (GameState.turnPhase !== 'playerTurn') return;
        usePotion(scene, i);
      });

    } else {
      // 空槽位
      const emptySlot = scene.add.graphics();
      emptySlot.lineStyle(1.5, 0x554433, 0.5);
      emptySlot.strokeRoundedRect(-slotSize / 2 + 4, -slotSize / 2 + 6, slotSize - 8, slotSize - 12, 4);
      emptySlot.fillStyle(0x1a0a08, 0.4);
      emptySlot.fillRoundedRect(-slotSize / 2 + 4, -slotSize / 2 + 6, slotSize - 8, slotSize - 12, 4);
      container.add(emptySlot);
    }

    GameState.potionContainers.push(container);
  }

  // 药水标签
  const label = scene.add.text(px, potionY + 28, '药水', {
    fontSize: '11px',
    fontFamily: FONT_UI,
    color: '#aa8866',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  GameState.potionContainers.push(label);
}

/** 使用药水 */
function usePotion(scene, index) {
  const potion = GameState.potions[index];
  if (!potion) return;

  // 结局统计
  GameState.endingStats.potionsUsed++;

  // 药水效果翻倍遗物
  const isDouble = GameState.player.relics.some(r => r.id === RELICS.marsAncientRune.id);
  const eff = potion.effect;

  if (eff.type === 'heal') {
    const value = isDouble ? eff.value * 2 : eff.value;
    const actualHeal = Math.min(value, GameState.player.maxHp - GameState.player.hp);
    GameState.player.hp += actualHeal;
    addLog('药水', `${potion.name}：恢复 ${actualHeal} 点生命${isDouble ? '（遗物翻倍）' : ''}`);
    spawnFloatingText(scene, 'player', `+${actualHeal} HP`, '#33ff77', 40, '22px');

  } else if (eff.type === 'battery') {
    const value = isDouble ? eff.value * 2 : eff.value;
    const beforeBattery = GameState.player.battery;
    GameState.player.battery = Math.min(GameState.player.maxBattery, GameState.player.battery + value);
    const actualGain = GameState.player.battery - beforeBattery;
    addLog('药水', `${potion.name}：获得 ${actualGain} 点电量${isDouble ? '（遗物翻倍）' : ''}`);
    spawnFloatingText(scene, 'player', `+${actualGain} 电量`, '#ffdd00', 40, '22px');

  } else if (eff.type === 'shield') {
    const value = isDouble ? eff.value * 2 : eff.value;
    GameState.player.addShield(value);
    addLog('药水', `${potion.name}：获得 ${value} 点护盾${isDouble ? '（遗物翻倍）' : ''}`);
    spawnFloatingText(scene, 'player', `+${value} 护盾`, '#44aaff', 40, '22px');

  } else if (eff.type === 'burn') {
    const stacks = isDouble ? eff.stacks * 2 : eff.stacks;
    GameState.enemy.addStatus('burn', stacks);
    addLog('药水', `${potion.name}：施加 ${stacks} 层灼烧${isDouble ? '（遗物翻倍）' : ''}`);
    spawnFloatingText(scene, 'enemy', `+${stacks} 灼烧`, '#ff6600', -30, '18px');

  } else if (eff.type === 'poison') {
    const stacks = isDouble ? eff.stacks * 2 : eff.stacks;
    GameState.enemy.addStatus('poison', stacks);
    addLog('药水', `${potion.name}：施加 ${stacks} 层中毒${isDouble ? '（遗物翻倍）' : ''}`);
    spawnFloatingText(scene, 'enemy', `+${stacks} 中毒`, '#66ff44', -30, '18px');

  } else if (eff.type === 'purify') {
    GameState.player.statusEffects.burn = 0;
    GameState.player.statusEffects.poison = 0;
    GameState.player.statusEffects.vulnerable = 0;
    GameState.player.statusEffects.weak = 0;
    addLog('药水', `${potion.name}：清除所有负面状态`);
    spawnFloatingText(scene, 'player', '净化！', '#ffffff', 40, '20px');
  }

  // 移除已使用的药水
  GameState.potions.splice(index, 1);
  refreshUI(scene);
}

/** 尝试添加药水到槽位，返回是否成功 */
function tryAddPotion(potion) {
  if (GameState.potions.length >= GameState.MAX_POTIONS) {
    return false;
  }
  GameState.potions.push({ ...potion });
  return true;
}

/** 玩家受击震屏 */
function shakePlayerUI(scene, intensity = 'medium') {
  if (!playerContainer) return;
  const amp = intensity === 'heavy' ? 10 : (intensity === 'light' ? 4 : 7);
  const repeatN = intensity === 'heavy' ? 5 : 3;
  scene.tweens.add({
    targets: playerContainer,
    x: { from: -amp, to: amp },
    yoyo: true,
    repeat: repeatN,
    duration: 40,
    ease: 'Power1',
    onComplete: () => {
      playerContainer.x = 0;
      playerContainer.y = 0;
    }
  });

  playerHpBarFill.clear();
  playerHpBarFill.fillStyle(0xff0000, 0.9);
  const px = LAYOUT.playerX;
  const hpBarY = LAYOUT.hpBarY;
  const hpBarW = LAYOUT.hpBarW;
  const hpBarH = 14;
  const hpBarX = px - hpBarW / 2;
  playerHpBarFill.fillRoundedRect(hpBarX, hpBarY, hpBarW, hpBarH, 4);

  scene.time.delayedCall(150, () => updatePlayerUI(scene));
}

/* ============================================================
 * 敌人 UI（右侧）
 * ============================================================ */
function createEnemyUI(scene) {
  enemyContainer = scene.add.container(0, 0);

  const ex = LAYOUT.enemyX;
  const ey = LAYOUT.enemyY;

  // 敌人底色板（与立绘深色背景融为一体）
  const enemyBg = scene.add.graphics();
  enemyBg.fillStyle(0x140806, 1);
  enemyBg.fillRoundedRect(ex - 92, ey - 92, 184, 184, 16);
  enemyBg.lineStyle(2, 0x883322, 0.6);
  enemyBg.strokeRoundedRect(ex - 92, ey - 92, 184, 184, 16);
  enemyContainer.add(enemyBg);

  // 敌人立绘（先占位，在 updateEnemyUI 中按实际敌人设置贴图）
  enemySprite = scene.add.image(ex, ey, 'enemy_mars_leech')
    .setOrigin(0.5)
    .setAlpha(0);

  // 圆角矩形遮罩，与底板对齐
  enemyMaskShape = scene.add.graphics();
  enemyMaskShape.fillStyle(0xffffff);
  enemyMaskShape.fillRoundedRect(ex - 91, ey - 91, 182, 182, 15);
  const enemyMask = enemyMaskShape.createGeometryMask();
  enemySprite.setMask(enemyMask);
  enemyMaskShape.setVisible(false);
  enemyContainer.add(enemySprite);
  enemyContainer.add(enemyMaskShape);

  // 敌人名
  enemyNameText = scene.add.text(ex, ey + 98, '', {
    fontSize: '16px',
    fontFamily: FONT_UI,
    color: '#ff6666',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);
  enemyContainer.add(enemyNameText);

  // HP 条
  enemyHpBarBg = scene.add.graphics();
  enemyHpBarFill = scene.add.graphics();
  enemyShieldBar = scene.add.graphics();
  enemyContainer.add([enemyHpBarBg, enemyShieldBar, enemyHpBarFill]);

  enemyHpText = scene.add.text(0, 0, '', {
    fontSize: '13px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  enemyContainer.add(enemyHpText);

  enemyShieldText = scene.add.text(0, 0, '', {
    fontSize: '12px',
    fontFamily: FONT_UI,
    color: '#ffaa44',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  enemyContainer.add(enemyShieldText);

  // 意图图标
  enemyIntentIcon = scene.add.graphics();
  enemyIntentText = scene.add.text(0, 0, '', {
    fontSize: '13px',
    fontFamily: FONT_UI,
    color: '#ff8844',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  enemyContainer.add([enemyIntentIcon, enemyIntentText]);

  updateEnemyUI(scene);
}

function updateEnemyUI(scene) {
  if (!GameState.enemy) return;

  const ex = LAYOUT.enemyX;
  const ey = LAYOUT.enemyY;
  // 意图区域：顶部 56-92（图标+文字）
  const intentIconY = LAYOUT.intentIconY;
  const intentTextY = LAYOUT.intentTextY;
  // 血条区域：下移到 150，避开意图
  const hpBarY = LAYOUT.enemyHpBarY;
  const hpBarW = LAYOUT.hpBarW + 10;
  const hpBarH = 14;
  const hpBarX = ex - hpBarW / 2;

  // 立绘（方形立绘铺满底板）
  const spriteKey = GameState.enemy.sprite || 'enemy_mars_leech';
  if (scene.textures.exists(spriteKey)) {
    enemySprite.setTexture(spriteKey);
    enemySprite.setAlpha(1);
    enemySprite.setDisplaySize(182, 182);
    enemySprite.setPosition(ex, ey);
  } else {
    enemySprite.setAlpha(0);
  }

  // 敌人名（立绘下方）
  enemyNameText.setPosition(ex, ey + 98);
  enemyNameText.setText(`◥ ${GameState.enemy.name}`);

  // HP 条背景
  enemyHpBarBg.clear();
  enemyHpBarBg.fillStyle(0x2a1410, 1);
  enemyHpBarBg.fillRoundedRect(hpBarX, hpBarY, hpBarW, hpBarH, 4);

  // 护盾条
  enemyShieldBar.clear();
  const shieldRatio = Math.min(GameState.enemy.shield / GameState.enemy.maxHp, 1);
  if (shieldRatio > 0) {
    enemyShieldBar.fillStyle(0xffaa44, 0.5);
    enemyShieldBar.fillRoundedRect(hpBarX, hpBarY, hpBarW * shieldRatio, hpBarH, 4);
  }

  // HP 填充
  enemyHpBarFill.clear();
  const hpRatio = GameState.enemy.hp / GameState.enemy.maxHp;
  const hpColor = hpRatio > 0.5 ? 0xdd6633 : (hpRatio > 0.25 ? 0xcc8833 : 0xcc3333);
  enemyHpBarFill.fillStyle(hpColor, 1);
  enemyHpBarFill.fillRoundedRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH, 4);

  enemyHpText.setPosition(ex, hpBarY + hpBarH / 2);
  enemyHpText.setText(`${GameState.enemy.hp}/${GameState.enemy.maxHp}`);

  // 护盾文字（移到血条左侧，避免与状态图标冲突）
  if (GameState.enemy.shield > 0) {
    enemyShieldText.setPosition(ex - hpBarW / 2 - 30, hpBarY + hpBarH / 2);
    enemyShieldText.setText(`护盾 ${GameState.enemy.shield}`);
  } else {
    enemyShieldText.setText('');
  }

  // 状态效果图标（血条下方）
  for (const icon of enemyStatusIcons) { icon.destroy(); }
  enemyStatusIcons = [];
  drawStatusIcons(scene, enemyContainer, ex - 60, hpBarY + hpBarH + 12, GameState.enemy, enemyStatusIcons);

  // 意图（顶部，与血条分离）
  drawIntentIcon(scene, ex, intentIconY, GameState.enemy);
  enemyIntentText.setPosition(ex, intentTextY);
  enemyIntentText.setText(GameState.enemy.getIntentDescription());

  // Boss 蓄力视觉：淡红色呼吸灯 + 头顶警告文字（移到立绘顶部上方，不遮挡血条）
  const isBossCharging = GameState.enemy.pattern === ENEMY_PATTERN.BOSS_CHARGE &&
                         GameState.enemy.currentCharge < GameState.enemy.chargeTurns;
  if (isBossCharging) {
    if (!bossChargeTween) {
      enemySprite.setTint(0xff4444);
      bossChargeTween = scene.tweens.add({
        targets: enemySprite,
        alpha: { from: 1, to: 0.55 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      // 警告文字放在敌人头顶（立绘上方），不再遮挡血条
      bossWarningText = scene.add.text(ex, ey - 100, '⚠ BOSS 蓄能中 ⚠', {
        fontSize: '16px',
        fontFamily: FONT_UI,
        color: '#ff4422',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5);
      enemyContainer.add(bossWarningText);
    }
  } else {
    if (bossChargeTween) {
      bossChargeTween.stop();
      bossChargeTween = null;
    }
    if (bossWarningText) {
      bossWarningText.destroy();
      bossWarningText = null;
    }
    if (enemySprite) {
      enemySprite.clearTint();
      enemySprite.setAlpha(1);
    }
  }
}

function drawIntentIcon(scene, cx, cy, enemy) {
  enemyIntentIcon.clear();

  const desc = enemy.getIntentDescription();
  let type = 'unknown';
  if (desc.includes('蓄力')) type = 'charge';
  else if (desc.includes('致命')) type = 'chargedAttack';
  else if (desc.includes('护盾') || desc.includes('防御')) type = 'shield';
  else if (desc.includes('伤害') || desc.includes('攻击')) type = 'damage';

  const size = 20;

  // 意图图标暗色衬底，提升可见度
  enemyIntentIcon.fillStyle(0x000000, 0.6);
  enemyIntentIcon.fillCircle(cx, cy, size + 4);
  enemyIntentIcon.lineStyle(2, 0x000000, 0.8);

  switch (type) {
    case 'damage':
      enemyIntentIcon.fillStyle(0xff3333, 0.9);
      enemyIntentIcon.fillTriangle(cx, cy - size, cx - size, cy + size * 0.6, cx + size, cy + size * 0.6);
      break;
    case 'shield':
      enemyIntentIcon.fillStyle(0x44aaff, 0.9);
      enemyIntentIcon.fillCircle(cx, cy, size * 0.85);
      break;
    case 'charge':
      enemyIntentIcon.fillStyle(0xaa44ff, 0.9);
      enemyIntentIcon.fillCircle(cx, cy, size * 0.6);
      enemyIntentIcon.lineStyle(2, 0xff66ff, 1);
      enemyIntentIcon.strokeCircle(cx, cy, size);
      break;
    case 'chargedAttack':
      enemyIntentIcon.fillStyle(0xff00aa, 0.95);
      drawStar(enemyIntentIcon, cx, cy, 5, size, size * 0.5);
      break;
    default:
      enemyIntentIcon.fillStyle(0x888888, 0.6);
      enemyIntentIcon.fillCircle(cx, cy, size * 0.5);
  }
}

/** 敌人受击震屏 */
function shakeEnemyUI(scene, intensity = 'medium') {
  if (!enemyContainer) return;
  const origX = 0;
  const origY = 0;
  const amp = intensity === 'heavy' ? 10 : (intensity === 'light' ? 4 : 7);
  const repeatN = intensity === 'heavy' ? 5 : 3;
  scene.tweens.add({
    targets: enemyContainer,
    x: { from: -amp, to: amp },
    yoyo: true,
    repeat: repeatN,
    duration: 40,
    ease: 'Power1',
    onComplete: () => {
      enemyContainer.x = origX;
      enemyContainer.y = origY;
    }
  });

  enemyHpBarFill.clear();
  enemyHpBarFill.fillStyle(0xff0000, 0.9);
  const ex = LAYOUT.enemyX;
  const hpBarY = 120;
  const hpBarW = 170;
  const hpBarH = 14;
  const hpBarX = ex - hpBarW / 2;
  enemyHpBarFill.fillRoundedRect(hpBarX, hpBarY, hpBarW, hpBarH, 4);

  scene.time.delayedCall(150, () => updateEnemyUI(scene));
}

/* ============================================================
 * 日志
 * ============================================================ */
function addLog(sender, msg) {
  GameState.logLines.push(`[${sender}] ${msg}`);
  if (GameState.logLines.length > GameState.MAX_LOG) GameState.logLines.shift();
}

/* ============================================================
 * UI 刷新
 * ============================================================ */
function refreshUI(scene) {
  updateEnemyUI(scene);
  updatePlayerUI(scene);
  updateDepthUI(scene);
  updatePotionUI(scene);

  logText.setText(GameState.logLines.slice(-3).join('  |  '));

  drawPileText.setText(`抽牌堆: ${GameState.drawPile.size} 张`);
  discardPileText.setText(`弃牌堆: ${GameState.discardPile.length} 张`);

  if (goldText) {
    goldText.setText(`◆ ${GameState.gold} 金币`);
  }

  if (GameState.turnPhase === 'playerTurn') {
    turnPhaseText.setText('▶ 玩家回合');
  } else if (GameState.turnPhase === 'enemyTurn') {
    turnPhaseText.setText('● 敌人回合');
  } else if (GameState.turnPhase === 'gameOver') {
    turnPhaseText.setText('');
  } else {
    turnPhaseText.setText('');
  }
}

/* ============================================================
 * 数值飘字特效
 * ============================================================ */
/* ============================================================
 * 特效系统（粒子 / 闪光 / 横幅 / 震动）
 * 贴合科幻火星风格：霓虹色 + 能量粒子 + 扫描线
 * ============================================================ */

/**
 * 命中粒子爆发：攻击命中目标时迸发能量粒子
 * @param {Phaser.Scene} scene
 * @param {number} x 粒子中心 X
 * @param {number} y 粒子中心 Y
 * @param {number} color 粒子颜色（0xRRGGBB）
 * @param {number} count 粒子数量
 * @param {object} opts { speed, size, spread, life }
 */
function spawnHitParticles(scene, x, y, color = 0xff4422, count = 14, opts = {}) {
  const speed = opts.speed || 180;
  const size = opts.size || 4;
  const life = opts.life || 500;
  const spread = opts.spread || Math.PI * 2;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * spread - spread / 2 + (opts.angle || -Math.PI / 2);
    const v = speed * (0.5 + Math.random() * 0.5);
    const vx = Math.cos(angle) * v;
    const vy = Math.sin(angle) * v;

    const p = scene.add.graphics();
    p.fillStyle(color, 1);
    const ps = size * (0.6 + Math.random() * 0.6);
    p.fillCircle(0, 0, ps);
    p.lineStyle(1, 0xffffff, 0.5);
    p.strokeCircle(0, 0, ps);
    p.setPosition(x, y);
    p.setDepth(500);

    const lifeJitter = life * (0.7 + Math.random() * 0.6);
    scene.tweens.add({
      targets: p,
      x: x + vx * (lifeJitter / 1000),
      y: y + vy * (lifeJitter / 1000),
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: lifeJitter,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    });
  }

  // 中心闪光环
  const flashRing = scene.add.graphics();
  flashRing.lineStyle(2, color, 0.9);
  flashRing.strokeCircle(x, y, 6);
  flashRing.setDepth(501);
  scene.tweens.add({
    targets: flashRing,
    alpha: 0,
    scaleX: 4,
    scaleY: 4,
    duration: 350,
    ease: 'Cubic.easeOut',
    onComplete: () => flashRing.destroy(),
  });
}

/**
 * 治疗上升粒子：恢复生命时绿色光粒向上飘
 */
function spawnHealParticles(scene, x, y, color = 0x33ff77, count = 10) {
  for (let i = 0; i < count; i++) {
    const p = scene.add.graphics();
    p.fillStyle(color, 0.9);
    p.fillCircle(0, 0, 3 + Math.random() * 2);
    p.lineStyle(1, 0xffffff, 0.6);
    p.strokeCircle(0, 0, 3);
    const offX = (Math.random() - 0.5) * 60;
    p.setPosition(x + offX, y + 20);
    p.setDepth(500);

    scene.tweens.add({
      targets: p,
      y: y - 60 - Math.random() * 30,
      x: x + offX + (Math.random() - 0.5) * 20,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 800 + Math.random() * 400,
      ease: 'Sine.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}

/**
 * 护盾获得粒子：蓝色能量环上升
 */
function spawnShieldParticles(scene, x, y, color = 0x44aaff, count = 12) {
  // 环形粒子
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 50;
    const p = scene.add.graphics();
    p.fillStyle(color, 0.9);
    p.fillCircle(0, 0, 3);
    p.lineStyle(1, 0xffffff, 0.5);
    p.strokeCircle(0, 0, 3);
    p.setPosition(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    p.setDepth(500);

    scene.tweens.add({
      targets: p,
      x: x,
      y: y,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => p.destroy(),
    });
  }
  // 外环描边
  const ring = scene.add.graphics();
  ring.lineStyle(2, color, 0.8);
  ring.strokeCircle(x, y, 55);
  ring.setDepth(501);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scaleX: 0.6,
    scaleY: 0.6,
    duration: 500,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

/**
 * 实体闪光：精灵被命中/治疗时短暂染色闪烁
 * @param {Phaser.GameObjects.Image} sprite
 * @param {number} color 0xffffff 或 0xff0000 等
 * @param {number} duration
 */
function flashEntity(scene, sprite, color = 0xffffff, duration = 120) {
  if (!sprite) return;
  sprite.setTint(color);
  scene.tweens.add({
    targets: sprite,
    duration: duration,
    onComplete: () => {
      if (sprite) sprite.clearTint();
    },
  });
  // 闪白后立即回色（更明显的打击感）
  scene.time.delayedCall(duration * 0.4, () => {
    if (sprite) sprite.setTint(0xffeeee);
  });
}

/**
 * 分级屏幕震动
 * @param {Phaser.Scene} scene
 * @param {string} level 'light' | 'medium' | 'heavy'
 */
function shakeScreen(scene, level = 'light') {
  const config = {
    light:  { duration: 120, intensity: 0.004 },
    medium: { duration: 280, intensity: 0.012 },
    heavy:  { duration: 500, intensity: 0.022 },
  };
  const c = config[level] || config.light;
  scene.cameras.main.shake(c.duration, c.intensity);
}

/**
 * 回合切换横幅：从屏幕中央滑入，停留后滑出
 * @param {Phaser.Scene} scene
 * @param {string} text 横幅文字
 * @param {number} color 0xRRGGBB
 */
function showTurnBanner(scene, text, color = 0x33ff66) {
  const W = LAYOUT.W;
  const H = LAYOUT.H;
  const bannerH = 56;

  // 背景条
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.75);
  bg.fillRect(0, H / 2 - bannerH / 2, W, bannerH);
  // 顶部底部霓虹线
  bg.lineStyle(2, color, 0.9);
  bg.lineBetween(0, H / 2 - bannerH / 2, W, H / 2 - bannerH / 2);
  bg.lineBetween(0, H / 2 + bannerH / 2, W, H / 2 + bannerH / 2);
  bg.setAlpha(0);
  bg.setDepth(900);

  // 文字
  const txt = scene.add.text(W / 2, H / 2, text, {
    fontSize: '30px',
    fontFamily: FONT_UI,
    color: '#' + color.toString(16).padStart(6, '0'),
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 5,
  }).setOrigin(0.5).setAlpha(0).setDepth(901);

  // 滑入
  scene.tweens.add({
    targets: [bg, txt],
    alpha: 1,
    duration: 200,
    ease: 'Power2',
  });
  // 停留后滑出
  scene.time.delayedCall(750, () => {
    scene.tweens.add({
      targets: [bg, txt],
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        bg.destroy();
        txt.destroy();
      },
    });
  });
}

/**
 * 屏幕短暂闪光（红色受伤 / 蓝色护盾 / 绿色治疗 / 金色获得）
 */
function flashScreen(scene, color = 0xff0000, alpha = 0.25, duration = 150) {
  const flash = scene.add.graphics();
  flash.fillStyle(color, alpha);
  flash.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
  flash.setDepth(800);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: duration,
    ease: 'Linear',
    onComplete: () => flash.destroy(),
  });
}

/**
 * 敌人击败爆炸特效
 */
function spawnDefeatExplosion(scene, x, y, color = 0xff6622) {
  // 中心大闪光
  const bigFlash = scene.add.graphics();
  bigFlash.fillStyle(color, 0.9);
  bigFlash.fillCircle(x, y, 20);
  bigFlash.setDepth(500);
  scene.tweens.add({
    targets: bigFlash,
    alpha: 0,
    scaleX: 6,
    scaleY: 6,
    duration: 500,
    ease: 'Cubic.easeOut',
    onComplete: () => bigFlash.destroy(),
  });

  // 多色粒子爆发
  const colors = [color, 0xffaa00, 0xffffff, 0xff4400];
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = 120 + Math.random() * 200;
    const p = scene.add.graphics();
    const c = colors[Math.floor(Math.random() * colors.length)];
    p.fillStyle(c, 1);
    p.fillCircle(0, 0, 3 + Math.random() * 3);
    p.setPosition(x, y);
    p.setDepth(501);

    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * v,
      y: y + Math.sin(angle) * v,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 600 + Math.random() * 400,
      ease: 'Cubic.easeOut',
      onComplete: () => p.destroy(),
    });
  }
  // 外环扩散
  const ring = scene.add.graphics();
  ring.lineStyle(3, color, 1);
  ring.strokeCircle(x, y, 20);
  ring.setDepth(501);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scaleX: 8,
    scaleY: 8,
    duration: 600,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
}

function spawnFloatingText(scene, target, text, color, offsetY, fontSize = '20px') {
  let targetX, targetY;

  if (target === 'player') {
    targetX = LAYOUT.playerX;
    targetY = LAYOUT.playerY + (offsetY || 0);
  } else if (target === 'enemy') {
    targetX = LAYOUT.enemyX;
    targetY = LAYOUT.enemyY + (offsetY || 0);
  } else {
    targetX = LAYOUT.playerX;
    targetY = 110 + (offsetY || 0);
  }

  const ft = scene.add.text(targetX, targetY - 10, text, {
    fontSize: fontSize,
    fontFamily: FONT_UI,
    color: color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setAlpha(1).setDepth(600);

  // 入场缩放弹跳
  ft.setScale(0.4);
  scene.tweens.add({
    targets: ft,
    scale: 1.15,
    duration: 120,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: ft,
        scale: 1,
        duration: 100,
      });
    },
  });

  scene.tweens.add({
    targets: ft,
    y: targetY - 80,
    alpha: 0,
    duration: 1100,
    delay: 200,
    ease: 'Power2',
    onComplete: () => ft.destroy(),
  });
}

/* ============================================================
 * Graphics 卡牌渲染
 * ============================================================ */
const CARD_W = 132;
const CARD_H = 84;

function renderHand(scene) {
  for (const c of GameState.cardContainers) { c.destroy(); }
  GameState.cardContainers = [];

  if (GameState.hand.length === 0) return;

  // 动态计算卡牌尺寸：竖屏时更小，手牌多时自动缩小避免溢出
  const maxW = LAYOUT.W - 40;
  const baseCardW = isPortrait ? 106 : CARD_W;
  const baseCardH = isPortrait ? 70 : CARD_H;
  const gap = isPortrait ? 6 : 10;

  let cardW = baseCardW;
  let cardH = baseCardH;
  let totalW = GameState.hand.length * cardW + (GameState.hand.length - 1) * gap;

  // 如果溢出，按比例缩小
  if (totalW > maxW) {
    const scale = maxW / totalW;
    cardW = Math.floor(cardW * scale);
    cardH = Math.floor(cardH * scale);
    totalW = GameState.hand.length * cardW + (GameState.hand.length - 1) * gap;
  }

  const startX = (LAYOUT.W - totalW) / 2 + cardW / 2;
  const y = isPortrait ? LAYOUT.H - 110 : 510;

  for (let i = 0; i < GameState.hand.length; i++) {
    const card = GameState.hand[i];
    const x = startX + i * (cardW + gap);
    const container = createCardGraphics(scene, x, y, cardW, cardH, card, i);
    GameState.cardContainers.push(container);
  }
}

function createCardGraphics(scene, x, y, w, h, card, index) {
  const container = scene.add.container(x, y);
  const canPlay = GameState.player.canPlay(card.cost);

  // 边框色：诅咒紫 / 攻击红 / 技能蓝
  const edgeColor = card.curse ? 0xaa55dd : (card.type === 'damage' ? 0xff5544 : 0x44aaff);
  const topBarH = h < 76 ? 20 : 22;

  // 程序化卡面：深色面板 + 顶部卡色标题栏 + 类型色描边
  const bg = scene.add.graphics();
  bg.fillStyle(0x0d1826, canPlay ? 0.97 : 0.85);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
  bg.fillStyle(card.color, canPlay ? 0.85 : 0.3);
  bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, topBarH, { tl: 7, tr: 7, bl: 0, br: 0 });
  bg.lineStyle(2, canPlay ? edgeColor : 0x44505e, canPlay ? 0.95 : 0.7);
  bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
  container.add(bg);

  // 悬停/拖拽辉光边框（代替旧底图的 tint）
  const glow = scene.add.graphics();
  glow.lineStyle(3, 0xffee99, 0.9);
  glow.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 11);
  glow.setVisible(false);
  container.add(glow);

  // 费用徽章（左上角，压住顶栏）
  const costColors = [0x44bb66, 0xffdd44, 0xff8800, 0xff4444, 0xcc2266];
  const costColor = costColors[Math.max(0, Math.min(card.cost, costColors.length - 1))];
  const costCX = -w / 2 + 13;
  const costCY = -h / 2 + 13;
  const costBg = scene.add.graphics();
  costBg.fillStyle(0x000000, 0.75);
  costBg.fillCircle(costCX, costCY, 12);
  costBg.fillStyle(costColor, canPlay ? 1 : 0.4);
  costBg.fillCircle(costCX, costCY, 10);
  costBg.lineStyle(1.5, 0xffffff, canPlay ? 0.8 : 0.3);
  costBg.strokeCircle(costCX, costCY, 10);
  container.add(costBg);

  const costTxt = scene.add.text(costCX, costCY, `${card.cost}`, {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);
  container.add(costTxt);

  // 卡名（升级卡金色）
  const nameTxt = scene.add.text(9, -h / 2 + 3 + topBarH / 2, card.name, {
    fontSize: h < 76 ? '12px' : '13px',
    fontFamily: FONT_UI,
    color: canPlay ? (card.upgraded ? '#ffe680' : '#ffffff') : '#8899aa',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);
  container.add(nameTxt);

  // 描述：卡面主体居中，自动换行
  const descTxt = scene.add.text(0, topBarH / 2 - 1, card.desc, {
    fontSize: h < 76 ? '11px' : '12px',
    fontFamily: FONT_UI,
    color: canPlay ? '#e8f4ff' : '#66788a',
    align: 'center',
    wordWrap: { width: w - 14 },
    lineSpacing: 2,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  container.add(descTxt);

  // 底部类型指示条
  const bottomBar = scene.add.graphics();
  bottomBar.fillStyle(edgeColor, canPlay ? 0.55 : 0.25);
  bottomBar.fillRoundedRect(-w / 2 + 8, h / 2 - 8, w - 16, 4, 2);
  container.add(bottomBar);

  const hitZone = scene.add.rectangle(0, 0, w + 12, h + 16, 0xffffff, 0)
    .setInteractive({ useHandCursor: true, draggable: true });
  container.add(hitZone);

  let origY = y;
  let isDragging = false;
  let dragStartY = 0;
  let hoverTween = null;

  // 诅咒卡无法打出
  const isUnplayable = card.unplayable || card.curse;

  hitZone.on('pointerdown', () => {
    if (GameState.turnPhase !== 'playerTurn') return;
    dragStartY = scene.input.activePointer.y;
  });

  hitZone.on('dragstart', () => {
    if (GameState.turnPhase !== 'playerTurn' || isUnplayable) return;
    isDragging = true;
    container.setDepth(1000);
    glow.setVisible(true);
  });

  hitZone.on('drag', (pointer) => {
    if (!isDragging) return;
    container.x = pointer.x;
    container.y = pointer.y;
    // 拖拽时缩放放大
    const dist = Math.abs(pointer.y - origY);
    const scale = 1 + Math.min(dist / 300, 0.3);
    container.setScale(scale);
  });

  hitZone.on('dragend', (pointer) => {
    if (!isDragging) return;
    isDragging = false;
    container.setDepth(0);

    const dragDistance = pointer.y - dragStartY;
    // 向上拖拽超过 80 像素，且电量足够，且非诅咒卡 → 出牌
    if (dragDistance < -80 && canPlay && !isUnplayable) {
      // 检查是否拖到敌人区域（横屏在右侧，竖屏在上方）
      const enemyY = LAYOUT.enemyY;
      const enemyX = LAYOUT.enemyX;
      const distToEnemy = Math.hypot(pointer.x - enemyX, pointer.y - enemyY);
      // 拖到敌人附近 或 向上拖够距离 都可以出牌
      if (distToEnemy < 200 || dragDistance < -150) {
        glow.setVisible(false);
        container.setScale(1);
        playCard(scene, index, container, x, origY);
        return;
      }
    }

    // 未出牌：回到原位
    scene.tweens.add({
      targets: container,
      x: x, y: origY, scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => { glow.setVisible(false); },
    });
  });

  // 保留点击出牌（非拖拽时）
  hitZone.on('pointerup', () => {
    if (GameState.turnPhase !== 'playerTurn') return;
    if (isDragging) return; // 拖拽中不触发点击
    if (isUnplayable) {
      // 诅咒卡提示
      spawnFloatingText(scene, 'player', '此卡无法打出', '#aa66aa', -30, '14px');
      return;
    }
    // 点击出牌（短按）
    const clickDist = Math.abs(scene.input.activePointer.y - dragStartY);
    if (clickDist < 10) {
      playCard(scene, index, container, x, origY);
    }
  });

  hitZone.on('pointerover', () => {
    if (!canPlay || isUnplayable) return;
    hoverTween = scene.tweens.add({
      targets: container,
      y: origY - 16,
      duration: 80,
      ease: 'Back.easeOut',
    });
    glow.setVisible(true);
  });
  hitZone.on('pointerout', () => {
    if (hoverTween) hoverTween.stop();
    scene.tweens.add({
      targets: container,
      y: origY,
      duration: 80,
      ease: 'Power1',
    });
    glow.setVisible(false);
  });

  return container;
}

/* ============================================================
 * 结束回合按钮
 * ============================================================ */
function createEndTurnButton(scene) {
  const container = scene.add.container(LAYOUT.W / 2, isPortrait ? LAYOUT.H - 35 : 600);

  const btnW = 160;
  const btnH = 42;

  const bg = scene.add.image(0, 0, 'ui_btn_endturn')
    .setDisplaySize(btnW, btnH)
    .setOrigin(0.5);
  container.add(bg);

  const text = scene.add.text(0, 0, '结束回合', {
    fontSize: '15px',
    fontFamily: FONT_UI,
    color: '#ffddaa',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);
  container.add(text);

  const hitZone = scene.add.rectangle(0, 0, btnW + 20, btnH + 16, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  container.add(hitZone);

  hitZone.on('pointerdown', () => {
    if (GameState.turnPhase !== 'playerTurn') return;
    endPlayerTurn(scene);
  });

  hitZone.on('pointerover', () => {
    bg.setTint(0xffddaa);
    text.setScale(1.05);
  });
  hitZone.on('pointerout', () => {
    bg.clearTint();
    text.setScale(1);
  });

  return container;
}

/* ============================================================
 * 关卡初始化
 * ============================================================ */
function initLevel(levelIndex) {
  GameState.enemyQueue = buildEnemyForLevel(levelIndex);
  if (GameState.enemyQueue.length === 0) {
    GameState.enemyQueue = buildEnemyForLevel(0);
  }
  GameState.enemy = GameState.enemyQueue.shift();
  GameState.enemy.turnCount = 0;
}

function advanceLevel(scene) {
  GameState.depthLevel++;
  GameState.endingStats.floorsCleared++;
  if (GameState.depthLevel >= DEPTH_LEVELS.length) return;
  initLevel(GameState.depthLevel);
  setBackgroundForLevel(scene, GameState.depthLevel);
  updateDepthUI(scene);
  addLog('系统', `=== 下潜至 ${DEPTH_LEVELS[GameState.depthLevel].label} ===`);
  addLog('系统', `敌军：${GameState.enemy.name} 出现了！`);

  // BGM 切换：500m 位置继续播放战斗音乐
  if (GameState.depthLevel === 1) {
    BGM.switch(scene, 'bgm-battle', true);
  }
}

function startBossFight(scene) {
  GameState.enemy = buildFinalBoss();
  GameState.enemy.turnCount = 0;
  addLog('系统', '⚠ 警告：火星吞噬者 出现了！');

  // BGM 切换：Boss 战开始时播放 Boss 音乐
  BGM.switch(scene, 'bgm-boss', true);
}

/* ============================================================
 * 关卡过渡动画
 * ============================================================ */
function playTransitionToNextLevel(scene, callback) {
  GameState.turnPhase = 'transition';

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const nextLevel = DEPTH_LEVELS[GameState.depthLevel + 1];
  const transitText = scene.add.text(LAYOUT.W / 2, LAYOUT.H / 2 - 40, '▼ 向下潜入中...', {
    fontSize: '36px',
    fontFamily: FONT_UI,
    color: '#ff8844',
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0);

  const depthLabel = scene.add.text(LAYOUT.W / 2, LAYOUT.H / 2 + 20, `目标深度：${nextLevel.label}`, {
    fontSize: '20px',
    fontFamily: FONT_UI,
    color: '#cc8866',
  }).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: overlay,
    alpha: { from: 0, to: 0.85 },
    duration: 300,
    ease: 'Power2',
  });

  scene.tweens.add({
    targets: transitText,
    alpha: 1,
    y: LAYOUT.H / 2 - 50,
    duration: 400,
    ease: 'Power2',
  });

  scene.tweens.add({
    targets: depthLabel,
    alpha: 1,
    duration: 500,
    delay: 200,
  });

  let flashCount = 0;
  const flashInterval = scene.time.addEvent({
    delay: 250,
    callback: () => {
      flashCount++;
      const flash = scene.add.graphics();
      flash.fillStyle(0xffffff, flashCount % 2 === 1 ? 0.15 : 0);
      flash.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
      scene.time.delayedCall(100, () => flash.destroy());

      if (flashCount >= 6) {
        flashInterval.remove();
        scene.tweens.add({
          targets: [transitText, depthLabel, overlay],
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => {
            transitText.destroy();
            depthLabel.destroy();
            overlay.destroy();
            if (callback) callback();
          }
        });
      }
    },
    repeat: 5,
  });
}

/* ============================================================
 * 地图路线选择系统
 * ============================================================ */
const MAP_NODE_TYPES = {
  BATTLE: { key: 'battle', name: '战斗', color: 0xcc4422, icon: '⚔', desc: '普通战斗，获得卡牌奖励' },
  ELITE:  { key: 'elite',  name: '精英', color: 0xaa22aa, icon: '★', desc: '精英战斗，高难度高奖励（必出药水）' },
  REST:   { key: 'rest',   name: '休息', color: 0x44aa66, icon: '♡', desc: '恢复 30% 最大生命值' },
  EVENT:  { key: 'event',  name: '事件', color: 0xddaa22, icon: '?', desc: '随机事件，风险与收益并存' },
  SHOP:   { key: 'shop',   name: '商店', color: 0xddaa44, icon: '$', desc: '花费金币购买卡牌/遗物/药水或移除卡牌' },
};

/** 生成杀戮尖塔式整层地图（保证连通性，无死胡同） */
function generateFullMap() {
  const ROWS = 7;          // 总行数（最后一行是Boss）
  const COLS = 4;          // 列数（每行最多4个节点位置）

  // 初始化网格：grid[row][col] = node 或 null
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([null, null, null, null]);
  }

  /* ---------- Step 1: 生成每行的节点位置 ---------- */
  for (let r = 0; r < ROWS - 1; r++) {
    // 每行固定 3 个节点，确保路径丰富
    const nodeCount = 3;
    // 随机选 3 个不同的列
    const allCols = [0, 1, 2, 3];
    // 打乱并取前3个
    for (let i = allCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCols[i], allCols[j]] = [allCols[j], allCols[i]];
    }
    const colPositions = allCols.slice(0, nodeCount).sort((a, b) => a - b);

    for (const col of colPositions) {
      // 分配节点类型
      let nodeType;
      if (r === 0) {
        // 第一行：战斗为主，偶尔休息
        nodeType = Math.random() < 0.7 ? { ...MAP_NODE_TYPES.BATTLE } : { ...MAP_NODE_TYPES.EVENT };
      } else if (r === ROWS - 2) {
        // Boss 前一行：休息/事件为主，做最后准备
        const weighted = [
          ...Array(2).fill(MAP_NODE_TYPES.BATTLE),
          ...Array(2).fill(MAP_NODE_TYPES.REST),
          ...Array(2).fill(MAP_NODE_TYPES.EVENT),
          ...Array(1).fill(MAP_NODE_TYPES.SHOP),
        ];
        nodeType = { ...weighted[Math.floor(Math.random() * weighted.length)] };
      } else {
        // 中间行：战斗权重高
        const weighted = [
          ...Array(4).fill(MAP_NODE_TYPES.BATTLE),
          ...Array(1).fill(MAP_NODE_TYPES.ELITE),
          ...Array(2).fill(MAP_NODE_TYPES.EVENT),
          ...Array(1).fill(MAP_NODE_TYPES.SHOP),
          ...Array(1).fill(MAP_NODE_TYPES.REST),
        ];
        nodeType = { ...weighted[Math.floor(Math.random() * weighted.length)] };
      }
      grid[r][col] = {
        ...nodeType,
        row: r,
        col,
        id: `${r}-${col}`,
        visited: false,
        reachable: false,
        connections: [],
      };
    }
  }

  /* ---------- Step 2: Boss 节点（最后一行居中） ---------- */
  const bossCol = 1;
  const bossRow = ROWS - 1;
  grid[bossRow][bossCol] = {
    ...MAP_NODE_TYPES.BATTLE,
    name: '小 Boss',
    icon: '☠',
    color: 0xcc2222,
    desc: `迎战 ${ENEMY_CATALOG[DEPTH_LEVELS[GameState.depthLevel].miniBoss].name}`,
    row: bossRow,
    col: bossCol,
    id: `${bossRow}-${bossCol}`,
    visited: false,
    reachable: false,
    isBossNode: true,
    connections: [],
  };

  /* ---------- Step 3: 建立连接（保证连通性） ---------- */
  for (let r = 0; r < ROWS - 1; r++) {
    // 收集当前行和下一行的节点
    const currentNodes = [];
    const nextNodes = [];
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]) currentNodes.push(grid[r][c]);
      if (grid[r + 1][c]) nextNodes.push(grid[r + 1][c]);
    }

    // 3a: 每个当前节点连接到下一行 1-2 个相邻节点
    for (const node of currentNodes) {
      // 相邻列：col-1, col, col+1
      const adjacent = [node.col - 1, node.col, node.col + 1]
        .filter(c => c >= 0 && c < COLS && grid[r + 1][c])
        .map(c => grid[r + 1][c]);

      if (adjacent.length > 0) {
        // 随机选 1-2 个
        const count = adjacent.length === 1 ? 1 : (Math.random() < 0.4 ? 2 : 1);
        const shuffled = [...adjacent].sort(() => Math.random() - 0.5);
        for (let i = 0; i < count; i++) {
          if (!node.connections.includes(shuffled[i].id)) {
            node.connections.push(shuffled[i].id);
          }
        }
      } else {
        // 没有相邻节点：连接到最近的下一行节点
        const nearest = nextNodes.reduce((best, n) =>
          Math.abs(n.col - node.col) < Math.abs(best.col - node.col) ? n : best
        );
        if (nearest && !node.connections.includes(nearest.id)) {
          node.connections.push(nearest.id);
        }
      }
    }

    // 3b: 确保下一行的每个节点至少有一个入边（保证可达性）
    for (const nextNode of nextNodes) {
      const hasIncoming = currentNodes.some(n => n.connections.includes(nextNode.id));
      if (!hasIncoming) {
        // 找到最近的当前行节点，强制连接
        const nearest = currentNodes.reduce((best, n) =>
          Math.abs(n.col - nextNode.col) < Math.abs(best.col - nextNode.col) ? n : best
        );
        if (nearest && !nearest.connections.includes(nextNode.id)) {
          nearest.connections.push(nextNode.id);
        }
      }
    }
  }

  /* ---------- Step 4: 可达性计算 ---------- */
  function updateReachable() {
    // 清除所有节点的 reachable（保留 visited）
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const n = grid[r][c];
        if (n && !n.visited) n.reachable = false;
      }
    }

    // 检查是否有已访问节点
    let hasVisited = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && grid[r][c].visited) { hasVisited = true; break; }
      }
      if (hasVisited) break;
    }

    if (!hasVisited) {
      // 没有已访问节点：第一行全部可达
      for (let c = 0; c < COLS; c++) {
        if (grid[0][c]) grid[0][c].reachable = true;
      }
    } else {
      // 从已访问节点的连接向下传递可达性
      for (let r = 0; r < ROWS - 1; r++) {
        for (let c = 0; c < COLS; c++) {
          const n = grid[r][c];
          if (n && n.visited) {
            for (const connId of n.connections) {
              const [nr, nc] = connId.split('-').map(Number);
              const target = grid[nr] && grid[nr][nc];
              if (target && !target.visited) {
                target.reachable = true;
              }
            }
          }
        }
      }
    }
  }

  return { grid, ROWS, COLS, updateReachable };
}

/** 显示杀戮尖塔式地图路线选择弹窗 */
function showMapSelectionPopup(scene, onNodeSelected) {
  GameState.turnPhase = 'mapSelection';

  // 首次进入本层时生成完整地图
  if (!GameState.currentMapData) {
    GameState.currentMapData = generateFullMap();
  }
  const { grid, ROWS, COLS, updateReachable } = GameState.currentMapData;
  updateReachable();

  // 安全检查：如果没有可达节点，重新生成地图
  let hasReachable = false;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] && grid[r][c].reachable) { hasReachable = true; break; }
    }
    if (hasReachable) break;
  }
  if (!hasReachable) {
    // 地图异常：重新生成
    console.warn('[Map] No reachable nodes found, regenerating map...');
    GameState.currentMapData = generateFullMap();
    GameState.currentMapData.updateReachable();
  }

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.92);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = Math.min(760, LAYOUT.W - 40);
  const popupH = Math.min(620, LAYOUT.H - 20);
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x0a1a1a, 0.98);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0x44ff88, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.fillStyle(0x44ff88, 0.9);
  popup.fillRect(popupX + 30, popupY + 28, popupW - 60, 3);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 55, '◆ 火星地下路径图 ◆', {
    fontSize: '24px',
    fontFamily: FONT_UI,
    color: '#44ff88',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const layerLabel = scene.add.text(LAYOUT.W / 2, popupY + 88, `深度：${DEPTH_LEVELS[GameState.depthLevel].label}`, {
    fontSize: '13px',
    fontFamily: FONT_UI,
    color: '#aaffcc',
  }).setOrigin(0.5);

  // 节点坐标计算
  const mapAreaY = popupY + 115;
  const mapAreaH = popupH - 135;
  const rowGap = mapAreaH / ROWS;
  const colGap = (popupW - 60) / COLS;
  const nodeRadius = 20;

  const nodePosition = (r, c) => ({
    x: popupX + 30 + colGap * (c + 0.5),
    y: mapAreaY + rowGap * (r + 0.5),
  });

  // 绘制连接线
  const linesGfx = scene.add.graphics();
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      if (!node) continue;
      const from = nodePosition(r, c);
      for (const connId of node.connections) {
        const [nr, nc] = connId.split('-').map(Number);
        const to = nodePosition(nr, nc);
        const isPathTaken = node.visited;
        linesGfx.lineStyle(2, isPathTaken ? 0x44ff88 : 0x334455, isPathTaken ? 0.9 : 0.5);
        linesGfx.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }

  // 绘制节点
  const nodeObjects = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      if (!node) continue;

      const pos = nodePosition(r, c);
      const container = scene.add.container(pos.x, pos.y);

      // 节点背景圆
      const bg = scene.add.graphics();
      const drawNode = (highlighted) => {
        bg.clear();
        // 已访问：暗色实心
        if (node.visited) {
          bg.fillStyle(0x223322, 0.9);
          bg.fillCircle(0, 0, nodeRadius);
          bg.lineStyle(2, node.color, 0.5);
          bg.strokeCircle(0, 0, nodeRadius);
        } else if (node.reachable) {
          // 可达：高亮 + 脉冲
          bg.fillStyle(highlighted ? 0x2a4a2a : 0x1a3a2a, 0.95);
          bg.fillCircle(0, 0, nodeRadius + (highlighted ? 4 : 0));
          bg.lineStyle(3, highlighted ? 0x88ffaa : node.color, 1);
          bg.strokeCircle(0, 0, nodeRadius + (highlighted ? 4 : 0));
        } else {
          // 不可达：暗灰
          bg.fillStyle(0x111111, 0.7);
          bg.fillCircle(0, 0, nodeRadius * 0.8);
          bg.lineStyle(1, 0x444444, 0.5);
          bg.strokeCircle(0, 0, nodeRadius * 0.8);
        }
      };
      drawNode(false);
      container.add(bg);

      // 节点图标
      const iconText = scene.add.text(0, 0, node.icon, {
        fontSize: node.isBossNode ? '22px' : '16px',
        fontFamily: FONT_UI,
        color: node.visited ? '#666666' : (node.reachable ? '#ffffff' : '#444444'),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(iconText);

      // 可达节点添加脉冲动画
      let pulseTween = null;
      if (node.reachable && !node.visited) {
        pulseTween = scene.tweens.add({
          targets: container,
          scaleX: 1.1, scaleY: 1.1,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // 点击热区
      const hitZone = scene.add.rectangle(0, 0, nodeRadius * 2.5, nodeRadius * 2.5, 0xffffff, 0);
      if (node.reachable && !node.visited) {
        hitZone.setInteractive({ useHandCursor: true });
      }
      container.add(hitZone);

      if (node.reachable && !node.visited) {
        hitZone.on('pointerover', () => {
          scene.tweens.add({ targets: container, scaleX: 1.3, scaleY: 1.3, duration: 100 });
          drawNode(true);
        });
        hitZone.on('pointerout', () => {
          scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
          drawNode(false);
        });
        hitZone.on('pointerdown', () => {
          nodeObjects.forEach(n => { if (n.hitZone.disableInteractive) n.hitZone.disableInteractive(); });
          if (pulseTween) pulseTween.stop();
          scene.tweens.add({
            targets: container,
            scaleX: 1.8, scaleY: 1.8, alpha: 0,
            duration: 250,
            ease: 'Back.easeIn',
            onComplete: () => {
              cleanup();
              onNodeSelected(node);
            },
          });
        });
      }

      nodeObjects.push({ container, hitZone, bg, pulseTween });
    }
  }

  // 节点类型图例
  const legendY = popupY + popupH - 30;
  const legendItems = [
    { icon: '⚔', name: '战斗', color: '#cc4422' },
    { icon: '★', name: '精英', color: '#aa22aa' },
    { icon: '$', name: '商店', color: '#ddaa44' },
    { icon: '♡', name: '休息', color: '#44aa66' },
    { icon: '?', name: '事件', color: '#ddaa22' },
    { icon: '☠', name: 'Boss', color: '#cc2222' },
  ];
  const legendTexts = [];
  const legendGap = 90;
  const legendStartX = LAYOUT.W / 2 - (legendItems.length - 1) * legendGap / 2;
  for (let i = 0; i < legendItems.length; i++) {
    const item = legendItems[i];
    const lx = legendStartX + i * legendGap;
    const lt = scene.add.text(lx, legendY, `${item.icon} ${item.name}`, {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: item.color,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    legendTexts.push(lt);
  }

  function cleanup() {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    layerLabel.destroy();
    linesGfx.destroy();
    nodeObjects.forEach(n => {
      if (n.pulseTween) n.pulseTween.stop();
      n.container.destroy();
    });
    legendTexts.forEach(t => t.destroy());
  }
}

/** 处理地图节点选择 */
function handleMapNodeSelected(scene, node) {
  GameState.visitedNodes.push({ depthLevel: GameState.depthLevel, nodeType: node.key });

  // 标记节点为已访问
  if (GameState.currentMapData) {
    const n = GameState.currentMapData.grid[node.row] && GameState.currentMapData.grid[node.row][node.col];
    if (n) n.visited = true;
  }

  // Boss 节点：触发小 Boss 战
  if (node.isBossNode) {
    startMiniBossSequence(scene);
    return;
  }

  switch (node.key) {
    case 'battle':
      // 普通战斗
      startMapBattle(scene, false);
      break;
    case 'elite':
      // 精英战斗
      startMapBattle(scene, true);
      break;
    case 'rest':
      // 休息点：恢复30%最大生命
      const healAmount = Math.floor(GameState.player.maxHp * 0.3);
      const actualHeal = Math.min(healAmount, GameState.player.maxHp - GameState.player.hp);
      GameState.player.hp += actualHeal;
      addLog('系统', `休息点：恢复 ${actualHeal} 点生命`);
      showRestScene(scene, actualHeal, () => {
        showNextMapOrProgress(scene);
      });
      break;
    case 'event':
      // 随机事件
      triggerRandomEvent(scene, () => {
        showNextMapOrProgress(scene);
      });
      break;
    case 'shop':
      // 商店
      showShopPopup(scene, () => {
        showNextMapOrProgress(scene);
      });
      break;
  }
}

/** 显示下一张地图或检查进度 */
function showNextMapOrProgress(scene) {
  refreshUI(scene);
  autoSave(); // 自动保存
  scene.time.delayedCall(300, () => {
    showMapSelectionPopup(scene, (node) => handleMapNodeSelected(scene, node));
  });
}

/** 开始地图战斗（普通或精英） */
function startMapBattle(scene, isElite) {
  if (isElite) {
    GameState.enemy = buildEliteEnemy();
    GameState.enemy.turnCount = 0;
    addLog('系统', `⚠ 精英敌人：${GameState.enemy.name} 出现了！`);
  } else {
    GameState.enemyQueue = buildEnemyForLevel(GameState.depthLevel);
    if (GameState.enemyQueue.length === 0) {
      GameState.enemyQueue = buildEnemyForLevel(0);
    }
    GameState.enemy = GameState.enemyQueue.shift();
    GameState.enemy.turnCount = 0;
    addLog('系统', `敌军：${GameState.enemy.name} 出现了！`);
  }

  refreshUI(scene);
  scene.time.delayedCall(400, () => startPlayerTurn(scene));
}

/** 检查层进度：是否需要进入下一层 */
function checkLayerProgression(scene) {
  if (GameState.nodeBattleCount >= GameState.battlesPerLayer) {
    // 完成本层战斗，迎战小 Boss
    startMiniBossSequence(scene);
  } else {
    // 继续本层探索，显示地图选择
    refreshUI(scene);
    scene.time.delayedCall(300, () => {
      showMapSelectionPopup(scene, (node) => handleMapNodeSelected(scene, node));
    });
  }
}

/** 小 Boss 战序列 */
function startMiniBossSequence(scene) {
  const levelConfig = DEPTH_LEVELS[GameState.depthLevel];
  const miniBossKey = levelConfig.miniBoss;

  // 最后一层的小 Boss 就是最终 Boss
  if (GameState.depthLevel === DEPTH_LEVELS.length - 1) {
    startBossSequence(scene);
    return;
  }

  addLog('系统', `⚠ 即将遭遇小 Boss：${ENEMY_CATALOG[miniBossKey].name} ⚠`);

  // 过渡效果
  playTransitionToNextLevel(scene, () => {
    const miniBoss = Enemy.fromCatalog(miniBossKey);
    miniBoss.isElite = true;
    GameState.enemy = miniBoss;
    GameState.isMiniBossBattle = true;
    refreshUI(scene);

    addLog('系统', `${miniBoss.name} 挡住了去路！`);

    // 弃手牌
    GameState.discardPile = GameState.discardPile.concat(GameState.hand);
    GameState.hand = [];
    GameState.drawPile.reshuffle(GameState.discardPile);
    GameState.discardPile = [];
    refreshUI(scene);

    scene.time.delayedCall(400, () => startPlayerTurn(scene));
  });
}

/** 小 Boss 战胜利后进入下一层 */
function handleMiniBossDefeated(scene) {
  addLog('系统', `击败小 Boss：${GameState.enemy.name}！`);

  // 小 Boss 奖励：金币 + 药水 + 卡牌/升级/金币选择
  const goldReward = 50;
  GameState.gold += goldReward;
  addLog('系统', `获得 ${goldReward} 金币`);
  spawnFloatingText(scene, 'player', `+${goldReward} 金币`, '#ffdd44', 60, '18px');

  // 必出药水
  if (GameState.potions.length < GameState.MAX_POTIONS) {
    const potion = rollPotionReward();
    if (tryAddPotion(potion)) {
      addLog('系统', `获得药水：${potion.name}`);
    }
  }

  // 奖励选择
  showPostBattleRewardChoice(scene, () => {
    // 进入下一层
    if (GameState.depthLevel < DEPTH_LEVELS.length - 1) {
      playTransitionToNextLevel(scene, () => {
        advanceLevel(scene);
        GameState.nodeBattleCount = 0;
        GameState.currentMapData = null; // 清空地图数据，下一层重新生成

        // 进入第二层时固定获得基础遗物
        if (GameState.depthLevel === 1 && !GameState.player.relics.some(r => r.id === RELICS.marsPowerCore.id)) {
          GameState.player.addRelic(RELICS.marsPowerCore);
          addLog('系统', `获得遗物：${RELICS.marsPowerCore.name} — ${RELICS.marsPowerCore.desc}`);
        }

        refreshUI(scene);
        GameState.discardPile = GameState.discardPile.concat(GameState.hand);
        GameState.hand = [];
        GameState.drawPile.reshuffle(GameState.discardPile);
        GameState.discardPile = [];
        refreshUI(scene);
        autoSave(); // 进入下一层时保存

        scene.time.delayedCall(300, () => {
          showMapSelectionPopup(scene, (node) => handleMapNodeSelected(scene, node));
        });
      });
    }
  });
}

/* ============================================================
 * 商店系统
 * ============================================================ */
function showShopPopup(scene, onComplete) {
  GameState.turnPhase = 'shop';
  GameState.endingStats.shopsUsed++;

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.9);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = Math.min(820, LAYOUT.W - 40);
  const popupH = Math.min(560, LAYOUT.H - 40);
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x1a1a0a, 0.97);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0xddaa44, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.fillStyle(0xddaa44, 0.9);
  popup.fillRect(popupX + 30, popupY + 28, popupW - 60, 3);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 55, '$ 火星流浪商人 $', {
    fontSize: '26px',
    fontFamily: FONT_UI,
    color: '#ffdd44',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  // 金币显示
  const goldDisplay = scene.add.text(LAYOUT.W / 2, popupY + 92, `持有金币：${GameState.gold}`, {
    fontSize: '16px',
    fontFamily: FONT_UI,
    color: '#ffeeaa',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const updateGoldDisplay = () => {
    goldDisplay.setText(`持有金币：${GameState.gold}`);
  };

  // 生成商店库存
  const shopCards = rollPostBattleRewards(3);
  const shopRelicKeys = Object.keys(RELICS).filter(k =>
    !GameState.player.relics.some(r => r.id === RELICS[k].id));
  // 随机选2个遗物
  const shopRelics = [];
  for (let i = 0; i < 2 && shopRelicKeys.length > 0; i++) {
    const idx = Math.floor(Math.random() * shopRelicKeys.length);
    shopRelics.push(RELICS[shopRelicKeys[idx]]);
    shopRelicKeys.splice(idx, 1);
  }
  const shopPotion = rollPotionReward();

  // 价格
  const cardPrice = 50;
  const relicPrice = 120;
  const potionPrice = 40;
  const removePrice = 75;

  // 购买状态
  const purchased = { cards: [false, false, false], relics: [false, false], potion: false, removed: false };

  const shopElements = [];

  // === 第一行：3张卡牌 ===
  const cardLabel = scene.add.text(popupX + 30, popupY + 130, '卡牌（50金币/张）', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#ccbb88',
  });
  shopElements.push(cardLabel);

  const cardW = 130;
  const cardH = 160;
  const cardGap = 16;
  const cardTotalW = 3 * cardW + 2 * cardGap;
  const cardStartX = popupX + 30 + cardW / 2;
  const cardY = popupY + 220;

  for (let i = 0; i < shopCards.length; i++) {
    const card = shopCards[i];
    const cx = cardStartX + i * (cardW + cardGap);

    const container = scene.add.container(cx, cardY);
    const bg = scene.add.graphics();
    const drawCardBg = (highlighted, bought) => {
      bg.clear();
      bg.fillStyle(bought ? 0x222222 : (highlighted ? 0x2a3a1a : 0x112211), 0.98);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
      bg.lineStyle(highlighted ? 3 : 2, bought ? 0x444444 : (highlighted ? 0x88ff44 : 0xddaa44), bought ? 0.3 : 0.8);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
    };
    drawCardBg(false, false);
    container.add(bg);

    const topBar = scene.add.graphics();
    topBar.fillStyle(card.color, 0.8);
    topBar.fillRoundedRect(-cardW / 2 + 6, -cardH / 2 + 6, cardW - 12, 20, { tl: 5, tr: 5, bl: 0, br: 0 });
    container.add(topBar);

    const nameText = scene.add.text(0, -cardH / 2 + 16, card.name, {
      fontSize: '13px',
      fontFamily: FONT_UI,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameText);

    const costText = scene.add.text(0, 10, card.desc, {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: '#ddddee',
      align: 'center',
      wordWrap: { width: cardW - 12 },
      lineSpacing: 3,
    }).setOrigin(0.5);
    container.add(costText);

    const priceText = scene.add.text(0, cardH / 2 - 18, `◆ ${cardPrice}`, {
      fontSize: '13px',
      fontFamily: FONT_UI,
      color: '#ffdd44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(priceText);

    const hitZone = scene.add.rectangle(0, 0, cardW + 6, cardH + 6, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      if (!purchased.cards[i]) {
        scene.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 80 });
        drawCardBg(true, false);
      }
    });
    hitZone.on('pointerout', () => {
      if (!purchased.cards[i]) {
        scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
        drawCardBg(false, false);
      }
    });
    hitZone.on('pointerdown', () => {
      if (purchased.cards[i]) return;
      if (GameState.gold < cardPrice) {
        spawnFloatingText(scene, 'player', '金币不足！', '#ff4444', 40, '16px');
        return;
      }
      GameState.gold -= cardPrice;
      GameState.drawPile.cards.push(card);
      purchased.cards[i] = true;
      addLog('商店', `购买卡牌：${card.name}（-${cardPrice}金币）`);
      drawCardBg(false, true);
      container.removeAllListeners();
      scene.tweens.add({ targets: container, alpha: 0.4, duration: 200 });
      updateGoldDisplay();
      refreshUI(scene);
    });

    shopElements.push(container);
  }

  // === 第二行：遗物 + 药水 + 移除卡 ===
  const itemY = popupY + 420;
  const itemLabel = scene.add.text(popupX + 30, itemY - 50, '遗物 / 药水 / 服务', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#ccbb88',
  });
  shopElements.push(itemLabel);

  // 遗物
  for (let i = 0; i < shopRelics.length; i++) {
    const relic = shopRelics[i];
    const rx = popupX + 60 + i * 140;

    const container = scene.add.container(rx, itemY);
    const bg = scene.add.graphics();
    const drawRelicBg = (highlighted, bought) => {
      bg.clear();
      bg.fillStyle(bought ? 0x222222 : (highlighted ? 0x3a2a1a : 0x2a1a0a), 0.98);
      bg.fillRoundedRect(-60, -50, 120, 100, 10);
      bg.lineStyle(highlighted ? 3 : 2, bought ? 0x444444 : (highlighted ? 0xffaa66 : 0xddaa44), bought ? 0.3 : 0.8);
      bg.strokeRoundedRect(-60, -50, 120, 100, 10);
    };
    drawRelicBg(false, false);
    container.add(bg);

    const hex = scene.add.graphics();
    drawHexagon(hex, 0, -20, 16, relic.color, 0.9);
    container.add(hex);

    const nameText = scene.add.text(0, 5, relic.name, {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: 110 },
    }).setOrigin(0.5);
    container.add(nameText);

    const priceText = scene.add.text(0, 35, `◆ ${relicPrice}`, {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: '#ffdd44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(priceText);

    const hitZone = scene.add.rectangle(0, 0, 130, 110, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      if (!purchased.relics[i]) {
        scene.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 80 });
        drawRelicBg(true, false);
      }
    });
    hitZone.on('pointerout', () => {
      if (!purchased.relics[i]) {
        scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
        drawRelicBg(false, false);
      }
    });
    hitZone.on('pointerdown', () => {
      if (purchased.relics[i]) return;
      if (GameState.gold < relicPrice) {
        spawnFloatingText(scene, 'player', '金币不足！', '#ff4444', 40, '16px');
        return;
      }
      GameState.gold -= relicPrice;
      GameState.player.addRelic(relic);
      purchased.relics[i] = true;
      addLog('商店', `购买遗物：${relic.name}（-${relicPrice}金币）`);
      drawRelicBg(false, true);
      container.removeAllListeners();
      scene.tweens.add({ targets: container, alpha: 0.4, duration: 200 });
      updateGoldDisplay();
      refreshUI(scene);
    });

    shopElements.push(container);
  }

  // 药水
  const potionContainerShop = scene.add.container(popupX + 60 + shopRelics.length * 140, itemY);
  const potionBg = scene.add.graphics();
  const drawPotionBg = (highlighted, bought) => {
    potionBg.clear();
    potionBg.fillStyle(bought ? 0x222222 : (highlighted ? 0x1a3a2a : 0x0a2a1a), 0.98);
    potionBg.fillRoundedRect(-60, -50, 120, 100, 10);
    potionBg.lineStyle(highlighted ? 3 : 2, bought ? 0x444444 : (highlighted ? 0x44ff88 : 0x44aa66), bought ? 0.3 : 0.8);
    potionBg.strokeRoundedRect(-60, -50, 120, 100, 10);
  };
  drawPotionBg(false, false);
  potionContainerShop.add(potionBg);

  const potionBottle = scene.add.graphics();
  potionBottle.fillStyle(shopPotion.color, 0.9);
  potionBottle.fillRoundedRect(-12, -30, 24, 28, 4);
  potionBottle.fillStyle(0x332222, 0.8);
  potionBottle.fillRect(-4, -38, 8, 8);
  potionContainerShop.add(potionBottle);

  const potionName = scene.add.text(0, 5, shopPotion.name, {
    fontSize: '11px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
    align: 'center',
    wordWrap: { width: 110 },
  }).setOrigin(0.5);
  potionContainerShop.add(potionName);

  const potionPriceText = scene.add.text(0, 35, `◆ ${potionPrice}`, {
    fontSize: '12px',
    fontFamily: FONT_UI,
    color: '#ffdd44',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  potionContainerShop.add(potionPriceText);

  const potionHit = scene.add.rectangle(0, 0, 130, 110, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  potionContainerShop.add(potionHit);

  potionHit.on('pointerover', () => {
    if (!purchased.potion) {
      scene.tweens.add({ targets: potionContainerShop, scaleX: 1.05, scaleY: 1.05, duration: 80 });
      drawPotionBg(true, false);
    }
  });
  potionHit.on('pointerout', () => {
    if (!purchased.potion) {
      scene.tweens.add({ targets: potionContainerShop, scaleX: 1, scaleY: 1, duration: 80 });
      drawPotionBg(false, false);
    }
  });
  potionHit.on('pointerdown', () => {
    if (purchased.potion) return;
    if (GameState.potions.length >= GameState.MAX_POTIONS) {
      spawnFloatingText(scene, 'player', '药水槽已满！', '#ff4444', 40, '16px');
      return;
    }
    if (GameState.gold < potionPrice) {
      spawnFloatingText(scene, 'player', '金币不足！', '#ff4444', 40, '16px');
      return;
    }
    GameState.gold -= potionPrice;
    tryAddPotion(shopPotion);
    purchased.potion = true;
    addLog('商店', `购买药水：${shopPotion.name}（-${potionPrice}金币）`);
    drawPotionBg(false, true);
    potionContainerShop.removeAllListeners();
    scene.tweens.add({ targets: potionContainerShop, alpha: 0.4, duration: 200 });
    updateGoldDisplay();
    refreshUI(scene);
  });

  shopElements.push(potionContainerShop);

  // 移除卡服务
  const removeContainer = scene.add.container(popupX + 60 + (shopRelics.length + 1) * 140, itemY);
  const removeBg = scene.add.graphics();
  const drawRemoveBg = (highlighted, used) => {
    removeBg.clear();
    removeBg.fillStyle(used ? 0x222222 : (highlighted ? 0x3a1a2a : 0x2a0a1a), 0.98);
    removeBg.fillRoundedRect(-60, -50, 120, 100, 10);
    removeBg.lineStyle(highlighted ? 3 : 2, used ? 0x444444 : (highlighted ? 0xff66aa : 0xaa3366), used ? 0.3 : 0.8);
    removeBg.strokeRoundedRect(-60, -50, 120, 100, 10);
  };
  drawRemoveBg(false, false);
  removeContainer.add(removeBg);

  const removeIcon = scene.add.text(0, -20, '✕', {
    fontSize: '24px',
    fontFamily: FONT_UI,
    color: '#ff66aa',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  removeContainer.add(removeIcon);

  const removeName = scene.add.text(0, 5, '移除卡牌', {
    fontSize: '11px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);
  removeContainer.add(removeName);

  const removePriceText = scene.add.text(0, 35, `◆ ${removePrice}`, {
    fontSize: '12px',
    fontFamily: FONT_UI,
    color: '#ffdd44',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  removeContainer.add(removePriceText);

  const removeHit = scene.add.rectangle(0, 0, 130, 110, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  removeContainer.add(removeHit);

  removeHit.on('pointerover', () => {
    if (!purchased.removed) {
      scene.tweens.add({ targets: removeContainer, scaleX: 1.05, scaleY: 1.05, duration: 80 });
      drawRemoveBg(true, false);
    }
  });
  removeHit.on('pointerout', () => {
    if (!purchased.removed) {
      scene.tweens.add({ targets: removeContainer, scaleX: 1, scaleY: 1, duration: 80 });
      drawRemoveBg(false, false);
    }
  });
  removeHit.on('pointerdown', () => {
    if (purchased.removed) return;
    if (GameState.gold < removePrice) {
      spawnFloatingText(scene, 'player', '金币不足！', '#ff4444', 40, '16px');
      return;
    }
    // 弹出卡牌选择
    showCardRemovePopup(scene, (removedCard) => {
      if (removedCard) {
        GameState.gold -= removePrice;
        const idx = GameState.drawPile.cards.findIndex(c => c.uid === removedCard.uid);
        if (idx >= 0) GameState.drawPile.cards.splice(idx, 1);
        purchased.removed = true;
        addLog('商店', `移除卡牌：${removedCard.name}（-${removePrice}金币）`);
        drawRemoveBg(false, true);
        removeContainer.removeAllListeners();
        scene.tweens.add({ targets: removeContainer, alpha: 0.4, duration: 200 });
        updateGoldDisplay();
        refreshUI(scene);
      }
    });
  });

  shopElements.push(removeContainer);

  // 离开按钮
  const leaveBtnY = popupY + popupH - 40;
  const leaveBtn = scene.add.container(LAYOUT.W / 2, leaveBtnY);
  const leaveBg = scene.add.graphics();
  leaveBg.fillStyle(0x442222, 1);
  leaveBg.fillRoundedRect(-80, -18, 160, 36, 8);
  leaveBg.lineStyle(2, 0xaa6644, 1);
  leaveBg.strokeRoundedRect(-80, -18, 160, 36, 8);
  leaveBtn.add(leaveBg);

  const leaveText = scene.add.text(0, 0, '离开商店', {
    fontSize: '15px',
    fontFamily: FONT_UI,
    color: '#ddccaa',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  leaveBtn.add(leaveText);

  const leaveHit = scene.add.rectangle(0, 0, 160, 36, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  leaveBtn.add(leaveHit);

  leaveHit.on('pointerover', () => {
    leaveBg.clear();
    leaveBg.fillStyle(0x663333, 1);
    leaveBg.fillRoundedRect(-80, -18, 160, 36, 8);
    leaveBg.lineStyle(2, 0xff8866, 1);
    leaveBg.strokeRoundedRect(-80, -18, 160, 36, 8);
  });
  leaveHit.on('pointerout', () => {
    leaveBg.clear();
    leaveBg.fillStyle(0x442222, 1);
    leaveBg.fillRoundedRect(-80, -18, 160, 36, 8);
    leaveBg.lineStyle(2, 0xaa6644, 1);
    leaveBg.strokeRoundedRect(-80, -18, 160, 36, 8);
  });
  shopElements.push(leaveBtn);

  leaveHit.on('pointerdown', () => {
    // 停止所有商店相关的 tween
    scene.tweens.killTweensOf(shopElements);
    // 销毁所有元素
    shopElements.forEach(e => {
      if (e && e.destroy) e.destroy();
    });
    overlay.destroy();
    popup.destroy();
    title.destroy();
    goldDisplay.destroy();
    onComplete();
  });

  refreshUI(scene);
}

/** 移除卡牌选择弹窗 */
function showCardRemovePopup(scene, onSelect) {
  const cards = GameState.drawPile.cards;
  if (cards.length === 0) {
    onSelect(null);
    return;
  }

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = Math.min(760, LAYOUT.W - 40);
  // 竖屏时根据卡牌数量动态计算高度，避免垂直溢出
  const cardW = isPortrait ? 120 : 130;
  const cardH = isPortrait ? 130 : 150;
  const gap = isPortrait ? 8 : 10;
  const perRow = isPortrait ? 4 : 5;
  const rows = Math.ceil(cards.length / perRow);
  const popupH = isPortrait
    ? Math.min(LAYOUT.H - 40, 110 + rows * (cardH + gap) + 60)
    : Math.min(480, LAYOUT.H - 40);
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x2a0a1a, 0.97);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0xff66aa, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 45, '✕ 选择要移除的卡牌 ✕', {
    fontSize: isPortrait ? '20px' : '22px',
    fontFamily: FONT_UI,
    color: '#ff66aa',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const hint = scene.add.text(LAYOUT.W / 2, popupY + 80, '点击卡牌将其从牌组中永久移除', {
    fontSize: '13px',
    fontFamily: FONT_UI,
    color: '#ddaabb',
  }).setOrigin(0.5);

  const startY = popupY + 110 + cardH / 2;
  const startX = popupX + 20 + cardW / 2;

  const cardObjects = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const cx = startX + col * (cardW + gap);
    const cy = startY + row * (cardH + gap);

    const container = scene.add.container(cx, cy);
    const bg = scene.add.graphics();
    bg.fillStyle(0x1a0a14, 0.98);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
    bg.lineStyle(2, 0xaa3366, 0.7);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
    container.add(bg);

    const topBar = scene.add.graphics();
    topBar.fillStyle(card.color, 0.8);
    topBar.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, 18, { tl: 4, tr: 4, bl: 0, br: 0 });
    container.add(topBar);

    const nameText = scene.add.text(0, -cardH / 2 + 14, card.name, {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameText);

    const descText = scene.add.text(0, 10, card.desc, {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: '#ddddee',
      align: 'center',
      wordWrap: { width: cardW - 8 },
      lineSpacing: 2,
    }).setOrigin(0.5);
    container.add(descText);

    const hitZone = scene.add.rectangle(0, 0, cardW + 4, cardH + 4, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      scene.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 80 });
    });
    hitZone.on('pointerout', () => {
      scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
    });
    hitZone.on('pointerdown', () => {
      cardObjects.forEach(c => c.hitZone.disableInteractive());
      scene.tweens.add({
        targets: container,
        scaleX: 0.5, scaleY: 0.5, alpha: 0,
        duration: 200,
        onComplete: () => {
          overlay.destroy();
          popup.destroy();
          title.destroy();
          hint.destroy();
          cardObjects.forEach(c => c.container.destroy());
          onSelect(card);
        },
      });
    });

    cardObjects.push({ container, hitZone });
  }

  // 取消按钮
  const cancelBtn = scene.add.container(LAYOUT.W / 2, popupY + popupH - 40);
  const cancelBg = scene.add.graphics();
  cancelBg.fillStyle(0x333333, 1);
  cancelBg.fillRoundedRect(-60, -16, 120, 32, 8);
  cancelBg.lineStyle(2, 0x888888, 1);
  cancelBg.strokeRoundedRect(-60, -16, 120, 32, 8);
  cancelBtn.add(cancelBg);

  const cancelText = scene.add.text(0, 0, '取消', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#cccccc',
  }).setOrigin(0.5);
  cancelBtn.add(cancelText);

  const cancelHit = scene.add.rectangle(0, 0, 120, 32, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  cancelBtn.add(cancelHit);

  cancelHit.on('pointerdown', () => {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    hint.destroy();
    cardObjects.forEach(c => c.container.destroy());
    cancelBtn.destroy();
    onSelect(null);
  });
}

/** 休息点场景 */
function showRestScene(scene, healAmount, onComplete) {
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = 500;
  const popupH = 280;
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x0a2a1a, 0.97);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0x44ff88, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 50, '♡ 休息营地 ♡', {
    fontSize: '28px',
    fontFamily: FONT_UI,
    color: '#44ff88',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const msg = scene.add.text(LAYOUT.W / 2, popupY + 110, `宇航员在火星洞穴中找到片刻安宁...\n恢复 ${healAmount} 点生命值`, {
    fontSize: '16px',
    fontFamily: FONT_UI,
    color: '#aaffcc',
    align: 'center',
    lineSpacing: 6,
  }).setOrigin(0.5);

  const continueBtn = scene.add.container(LAYOUT.W / 2, popupY + 220);
  const btnBg = scene.add.graphics();
  btnBg.fillStyle(0x224433, 1);
  btnBg.fillRoundedRect(-80, -20, 160, 40, 8);
  btnBg.lineStyle(2, 0x44ff88, 1);
  btnBg.strokeRoundedRect(-80, -20, 160, 40, 8);
  continueBtn.add(btnBg);

  const btnText = scene.add.text(0, 0, '继续探索', {
    fontSize: '16px',
    fontFamily: FONT_UI,
    color: '#aaffcc',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  continueBtn.add(btnText);

  const btnHit = scene.add.rectangle(0, 0, 160, 40, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });
  continueBtn.add(btnHit);

  btnHit.on('pointerdown', () => {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    msg.destroy();
    continueBtn.destroy();
    onComplete();
  });

  refreshUI(scene);
}

/** 随机事件触发 */
const RANDOM_EVENTS = [
  {
    id: 'supplier',
    name: '神秘商人',
    desc: '一位火星地表的流浪商人 offering 你一件遗物，代价是 15 点生命',
    options: [
      { text: '接受交易（-15 HP，获得随机遗物）', effect: 'tradeRelic' },
      { text: '拒绝', effect: 'none' },
    ],
  },
  {
    id: 'cache',
    name: '物资缓存',
    desc: '发现一个旧时代的物资缓存，里面有未知内容',
    options: [
      { text: '打开缓存（获得药水）', effect: 'gainPotion' },
      { text: '打开缓存（获得 10 护盾）', effect: 'gainShield' },
    ],
  },
  {
    id: 'anomaly',
    name: '量子异常',
    desc: '遭遇空间扭曲，可以获得力量但会受伤',
    options: [
      { text: '汲取力量（+3 力量，-8 HP）', effect: 'powerSacrifice' },
      { text: '安全离开（+5 护盾）', effect: 'safeLeave' },
    ],
  },
  {
    id: 'shrine',
    name: '古老神殿',
    desc: '发现火星远古文明的神殿遗迹',
    options: [
      { text: '祈祷（恢复 20 HP）', effect: 'pray' },
      { text: '搜刮（50% 获得药水，50% 失去 10 HP）', effect: 'gamble' },
    ],
  },
  /* ---------- 新增事件（方向1扩充） ---------- */
  {
    id: 'altar',
    name: '血色祭坛',
    desc: '一座浸满暗红色液体的祭坛，散发着不祥的气息。似乎可以用生命换取力量',
    options: [
      { text: '献祭 20 HP，获得 5 层力量', effect: 'altarSacrifice' },
      { text: '献祭 10 HP，获得 30 金币', effect: 'altarGold' },
      { text: '离开', effect: 'none' },
    ],
  },
  {
    id: 'rift',
    name: '时空裂缝',
    desc: '一道闪烁的时空裂缝出现在眼前，里面似乎有什么在召唤你',
    options: [
      { text: '跳入裂缝（移除 1 张卡，获得遗物）', effect: 'riftRelic' },
      { text: '汲取能量（+2 电量上限，-12 HP）', effect: 'riftBattery' },
      { text: '离开', effect: 'none' },
    ],
  },
  {
    id: 'terminal',
    name: '古老终端',
    desc: '一台仍在运行的远古终端，屏幕上闪烁着「卡牌变异协议」字样',
    options: [
      { text: '执行变异（随机升级 1 张卡，获得诅咒卡）', effect: 'terminalMutate' },
      { text: '下载数据（获得 25 金币）', effect: 'terminalGold' },
      { text: '离开', effect: 'none' },
    ],
  },
  {
    id: 'crystal',
    name: '晶簇巢穴',
    desc: '巨大的水晶簇中封存着远古能量，但触碰可能引发共振',
    options: [
      { text: '开采水晶（获得 15 金币，-6 HP）', effect: 'crystalMine' },
      { text: '吸收能量（获得 4 层灼烧抗性 → 获得 10 护盾）', effect: 'crystalAbsorb' },
    ],
  },
  {
    id: 'survivor',
    name: '幸存者营地',
    desc: '遇到一群火星殖民地的幸存者，他们愿意提供帮助',
    options: [
      { text: '接受治疗（恢复 15 HP）', effect: 'survivorHeal' },
      { text: '接受物资（获得 2 张随机卡牌）', effect: 'survivorCards' },
      { text: '分享金币（-20 金币，获得药水）', effect: 'survivorShare' },
    ],
  },
  {
    id: 'void',
    name: '虚空凝视',
    desc: '一片纯黑的虚空在你面前展开，凝视它的人会获得禁忌知识',
    options: [
      { text: '凝视虚空（获得 3 张随机卡，HP 降至 1）', effect: 'voidGaze' },
      { text: '移开视线（获得 5 层力量）', effect: 'voidReject' },
    ],
  },
  {
    id: 'forge',
    name: '地下熔炉',
    desc: '一座仍在燃烧的远古熔炉，可以锻造卡牌或销毁诅咒',
    options: [
      { text: '锻造升级（升级 1 张卡，-15 金币）', effect: 'forgeUpgrade' },
      { text: '销毁诅咒（移除 1 张诅咒卡）', effect: 'forgeCleanse' },
      { text: '熔炼卡牌（移除 1 张卡，获得 20 金币）', effect: 'forgeMelt' },
    ],
  },
  {
    id: 'spore',
    name: '孢子花园',
    desc: '一片充满荧光孢子的地下花园，空气中弥漫着甜腻的气味',
    options: [
      { text: '吸入孢子（获得 8 层中毒抗性 → 获得 6 力量）', effect: 'sporeInhale' },
      { text: '采集样本（获得药水）', effect: 'sporeCollect' },
      { text: '快速离开（+5 护盾）', effect: 'safeLeave' },
    ],
  },
  {
    id: 'wreckage',
    name: '坠毁飞船',
    desc: '一坠毁的远古飞船，舱内可能有宝物也可能有危险',
    options: [
      { text: '搜索驾驶舱（50% 获得遗物，50% 爆炸受伤）', effect: 'wreckageCockpit' },
      { text: '搜索货舱（获得 20-40 金币）', effect: 'wreckageCargo' },
    ],
  },
  {
    id: 'mirror',
    name: '幻影之镜',
    desc: '一面映照出你内心深处恐惧的神秘镜面',
    options: [
      { text: '直面恐惧（-15 HP，获得 4 层力量和 4 层易伤抗性）', effect: 'mirrorFace' },
      { text: '打破镜面（获得 15 金币，获得诅咒卡）', effect: 'mirrorBreak' },
      { text: '离开', effect: 'none' },
    ],
  },
  {
    id: 'core',
    name: '能量核心',
    desc: '一个脉动的地核能量节点，可以直接汲取能量',
    options: [
      { text: '汲取大量能量（+2 电量上限，获得 5 层灼烧）', effect: 'coreDrain' },
      { text: '温和汲取（+1 电量上限）', effect: 'coreGentle' },
    ],
  },
  {
    id: 'ghost',
    name: '游魂低语',
    desc: '一个远古火星人的游魂在你耳边低语，提出诡异的交易',
    options: [
      { text: '接受交易（移除 2 张卡，获得随机遗物）', effect: 'ghostTrade' },
      { text: '驱逐游魂（+8 护盾）', effect: 'ghostBanish' },
    ],
  },
];

function triggerRandomEvent(scene, onComplete) {
  const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  GameState.endingStats.eventsTriggered++;

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.9);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  // 自适应弹窗尺寸：竖屏时宽度自适应，按钮垂直堆叠
  const optCount = event.options.length;
  const popupW = Math.min(600, LAYOUT.W - 40);
  // 竖屏：按钮垂直堆叠，高度随选项数动态变化；横屏：按钮水平排列
  const btnW = isPortrait ? (popupW - 60) : Math.min(280, (popupW - 40 - (optCount - 1) * 16) / optCount);
  const btnH = 46;
  const btnGap = 12;
  const btnsBlockH = optCount * btnH + (optCount - 1) * btnGap;
  // 描述区域预留 140px，按钮区块下方留 24px 边距
  const popupH = isPortrait
    ? Math.min(LAYOUT.H - 40, 120 + 140 + btnsBlockH + 24)
    : 360;
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x1a1a0a, 0.97);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0xddaa22, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 45, `? ${event.name} ?`, {
    fontSize: isPortrait ? '22px' : '26px',
    fontFamily: FONT_UI,
    color: '#ddaa22',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const desc = scene.add.text(LAYOUT.W / 2, popupY + 100, event.desc, {
    fontSize: isPortrait ? '14px' : '15px',
    fontFamily: FONT_UI,
    color: '#eeddcc',
    align: 'center',
    wordWrap: { width: popupW - 40 },
    lineSpacing: 6,
  }).setOrigin(0.5);

  // 选项按钮：竖屏垂直堆叠，横屏水平排列
  const btnBlockTop = popupY + popupH - btnsBlockH - 24;
  const btnContainers = [];

  for (let i = 0; i < optCount; i++) {
    const opt = event.options[i];
    let bx, by;
    if (isPortrait) {
      // 竖屏：垂直堆叠，水平居中
      bx = LAYOUT.W / 2;
      by = btnBlockTop + i * (btnH + btnGap) + btnH / 2;
    } else {
      // 横屏：水平排列
      const totalBtnW = optCount * btnW + (optCount - 1) * btnGap;
      const btnStartX = (LAYOUT.W - totalBtnW) / 2 + btnW / 2;
      bx = btnStartX + i * (btnW + btnGap);
      by = popupY + 220;
    }

    const btnContainer = scene.add.container(bx, by);
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(0x2a2410, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
    btnBg.lineStyle(2, 0xddaa22, 0.8);
    btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
    btnContainer.add(btnBg);

    const btnText = scene.add.text(0, 0, opt.text, {
      fontSize: '13px',
      fontFamily: FONT_UI,
      color: '#eecdcc',
      align: 'center',
      wordWrap: { width: btnW - 20 },
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    const btnHit = scene.add.rectangle(0, 0, btnW, btnH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(btnHit);

    btnContainers.push({ container: btnContainer, hitZone: btnHit });

    btnHit.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x3a3420, 1);
      btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
      btnBg.lineStyle(2, 0xffcc44, 1);
      btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
    });
    btnHit.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x2a2410, 1);
      btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
      btnBg.lineStyle(2, 0xddaa22, 0.8);
      btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
    });
    btnHit.on('pointerdown', () => {
      // 禁用所有按钮
      btnContainers.forEach(b => b.hitZone.disableInteractive());
      // 先尝试新事件效果，失败则走旧效果
      const handled = resolveNewEventEffect(scene, opt.effect);
      if (!handled) {
        resolveEventEffect(scene, opt.effect);
      }
      overlay.destroy();
      popup.destroy();
      title.destroy();
      desc.destroy();
      btnContainers.forEach(b => b.container.destroy());
      onComplete();
    });
  }
}

/** 解析事件效果 */
function resolveEventEffect(scene, effect) {
  switch (effect) {
    case 'tradeRelic': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 15);
      // 随机获得一个遗物
      const relicKeys = Object.keys(RELICS).filter(k =>
        !GameState.player.relics.some(r => r.id === RELICS[k].id));
      if (relicKeys.length > 0) {
        const randomKey = relicKeys[Math.floor(Math.random() * relicKeys.length)];
        GameState.player.addRelic(RELICS[randomKey]);
        addLog('事件', `商人交易：失去 15 HP，获得遗物 ${RELICS[randomKey].name}`);
        spawnFloatingText(scene, 'player', `-15 HP`, '#ff4444', -20);
      } else {
        addLog('事件', `商人交易：失去 15 HP，但已无新遗物可获得`);
      }
      break;
    }
    case 'gainPotion': {
      if (GameState.potions.length < GameState.MAX_POTIONS) {
        const potion = rollPotionReward();
        tryAddPotion(potion);
        addLog('事件', `物资缓存：获得药水 ${potion.name}`);
        spawnFloatingText(scene, 'player', `获得药水`, '#ffaa00', 40, '16px');
      } else {
        addLog('事件', `药水槽已满，获得 10 护盾代替`);
        GameState.player.addShield(10);
      }
      break;
    }
    case 'gainShield': {
      GameState.player.addShield(10);
      addLog('事件', `物资缓存：获得 10 护盾`);
      spawnFloatingText(scene, 'player', `+10 护盾`, '#44aaff', 20, '16px');
      break;
    }
    case 'powerSacrifice': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 8);
      GameState.player.addStatus('strength', 3);
      addLog('事件', `量子异常：失去 8 HP，获得 3 层力量`);
      spawnFloatingText(scene, 'player', `-8 HP +3力量`, '#ff44ff', -20, '14px');
      break;
    }
    case 'safeLeave': {
      GameState.player.addShield(5);
      addLog('事件', `安全离开：获得 5 护盾`);
      spawnFloatingText(scene, 'player', `+5 护盾`, '#44aaff', 20, '14px');
      break;
    }
    case 'pray': {
      const healAmount = Math.min(20, GameState.player.maxHp - GameState.player.hp);
      GameState.player.hp += healAmount;
      addLog('事件', `神殿祈祷：恢复 ${healAmount} HP`);
      spawnFloatingText(scene, 'player', `+${healAmount} HP`, '#33ff77', 40, '18px');
      break;
    }
    case 'gamble': {
      if (Math.random() < 0.5) {
        if (GameState.potions.length < GameState.MAX_POTIONS) {
          const potion = rollPotionReward();
          tryAddPotion(potion);
          addLog('事件', `搜刮成功：获得药水 ${potion.name}`);
          spawnFloatingText(scene, 'player', `获得药水`, '#ffaa00', 40, '16px');
        } else {
          addLog('事件', `药水槽已满，什么也没得到`);
        }
      } else {
        GameState.player.hp = Math.max(1, GameState.player.hp - 10);
        addLog('事件', `搜刮失败：失去 10 HP`);
        spawnFloatingText(scene, 'player', `-10 HP`, '#ff4444', -20, '18px');
      }
      break;
    }
    case 'none':
    default:
      addLog('事件', `你选择了离开`);
      break;
  }
  refreshUI(scene);
}

/** 获取牌组中可移除的卡牌（非诅咒、非初始必需） */
function getRemovableCards() {
  return GameState.drawPile.cards.filter(c => !c.curse);
}

/** 随机移除一张卡牌，返回被移除的卡或 null */
function removeRandomCard() {
  const removable = getRemovableCards();
  if (removable.length === 0) return null;
  const card = removable[Math.floor(Math.random() * removable.length)];
  const idx = GameState.drawPile.cards.findIndex(c => c.uid === card.uid);
  if (idx >= 0) GameState.drawPile.cards.splice(idx, 1);
  return card;
}

/** 解析新增事件效果 */
function resolveNewEventEffect(scene, effect) {
  switch (effect) {
    case 'altarSacrifice': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 20);
      GameState.player.addStatus('strength', 5);
      addLog('事件', `血色祭坛：-20 HP，+5 力量`);
      spawnFloatingText(scene, 'player', `-20 HP +5力量`, '#ff44ff', -20, '14px');
      break;
    }
    case 'altarGold': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 10);
      GameState.gold += 30;
      addLog('事件', `血色祭坛：-10 HP，+30 金币`);
      spawnFloatingText(scene, 'player', `-10 HP +30金币`, '#ffdd44', -20, '14px');
      break;
    }
    case 'riftRelic': {
      const removed = removeRandomCard();
      if (removed) {
        const relicKeys = Object.keys(RELICS).filter(k =>
          !GameState.player.relics.some(r => r.id === RELICS[k].id));
        if (relicKeys.length > 0) {
          const key = relicKeys[Math.floor(Math.random() * relicKeys.length)];
          GameState.player.addRelic(RELICS[key]);
          addLog('事件', `时空裂缝：移除 ${removed.name}，获得遗物 ${RELICS[key].name}`);
        } else {
          addLog('事件', `时空裂缝：移除 ${removed.name}，但已无新遗物`);
        }
      } else {
        addLog('事件', `时空裂缝：没有可移除的卡牌`);
      }
      break;
    }
    case 'riftBattery': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 12);
      GameState.player.baseBattery += 2;
      addLog('事件', `时空裂缝：-12 HP，+2 电量上限`);
      spawnFloatingText(scene, 'player', `-12 HP +2电量`, '#33ccff', -20, '14px');
      break;
    }
    case 'terminalMutate': {
      const upgradable = GameState.drawPile.cards.filter(c => !c.upgraded && UPGRADES[c.id]);
      if (upgradable.length > 0) {
        const card = upgradable[Math.floor(Math.random() * upgradable.length)];
        const upgraded = upgradeCard(card);
        const idx = GameState.drawPile.cards.findIndex(c => c.uid === card.uid);
        if (idx >= 0) GameState.drawPile.cards[idx] = upgraded;
        addLog('事件', `古老终端：${card.name} 升级为 ${upgraded.name}`);
      }
      // 添加诅咒卡
      GameState.drawPile.cards.push(createCurseCard());
      GameState.endingStats.curseCardsGained++;
      GameState.endingStats.voidChoices++;
      GameState.endingFlags.hasCurseInDeck = true;
      addLog('事件', `古老终端：获得诅咒卡 — 虚空之咒`);
      break;
    }
    case 'terminalGold': {
      GameState.gold += 25;
      addLog('事件', `古老终端：+25 金币`);
      spawnFloatingText(scene, 'player', `+25 金币`, '#ffdd44', 40, '16px');
      break;
    }
    case 'crystalMine': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 6);
      GameState.gold += 15;
      addLog('事件', `晶簇巢穴：-6 HP，+15 金币`);
      spawnFloatingText(scene, 'player', `-6 HP +15金币`, '#ffdd44', -20, '14px');
      break;
    }
    case 'crystalAbsorb': {
      GameState.player.addShield(10);
      addLog('事件', `晶簇巢穴：+10 护盾`);
      spawnFloatingText(scene, 'player', `+10 护盾`, '#44aaff', 20, '16px');
      break;
    }
    case 'survivorHeal': {
      const heal = Math.min(15, GameState.player.maxHp - GameState.player.hp);
      GameState.player.hp += heal;
      addLog('事件', `幸存者：+${heal} HP`);
      spawnFloatingText(scene, 'player', `+${heal} HP`, '#33ff77', 40, '18px');
      break;
    }
    case 'survivorCards': {
      for (let i = 0; i < 2; i++) {
        const rewards = rollPostBattleRewards(1);
        if (rewards[0]) {
          GameState.drawPile.cards.push(rewards[0]);
          addLog('事件', `幸存者：获得卡牌 ${rewards[0].name}`);
        }
      }
      break;
    }
    case 'survivorShare': {
      if (GameState.gold >= 20) {
        GameState.gold -= 20;
        if (GameState.potions.length < GameState.MAX_POTIONS) {
          const potion = rollPotionReward();
          tryAddPotion(potion);
          addLog('事件', `幸存者：-20 金币，获得药水 ${potion.name}`);
        } else {
          addLog('事件', `药水槽已满，-20 金币换得 10 护盾`);
          GameState.player.addShield(10);
        }
      } else {
        addLog('事件', `金币不足，幸存者给了你 5 护盾`);
        GameState.player.addShield(5);
      }
      break;
    }
    case 'voidGaze': {
      GameState.player.hp = 1;
      for (let i = 0; i < 3; i++) {
        const rewards = rollPostBattleRewards(1);
        if (rewards[0]) {
          GameState.drawPile.cards.push(rewards[0]);
          addLog('事件', `虚空凝视：获得卡牌 ${rewards[0].name}`);
        }
      }
      GameState.endingStats.voidChoices++;
      GameState.endingFlags.usedVoidEvent = true;
      spawnFloatingText(scene, 'player', `HP降至1 +3张卡`, '#ff44ff', -20, '14px');
      break;
    }
    case 'voidReject': {
      GameState.player.addStatus('strength', 5);
      addLog('事件', `虚空凝视：+5 力量`);
      GameState.endingStats.lightChoices++;
      spawnFloatingText(scene, 'player', `+5 力量`, '#ff44ff', 20, '16px');
      break;
    }
    case 'forgeUpgrade': {
      if (GameState.gold >= 15) {
        GameState.gold -= 15;
        const upgradable = GameState.drawPile.cards.filter(c => !c.upgraded && UPGRADES[c.id]);
        if (upgradable.length > 0) {
          const card = upgradable[Math.floor(Math.random() * upgradable.length)];
          const upgraded = upgradeCard(card);
          const idx = GameState.drawPile.cards.findIndex(c => c.uid === card.uid);
          if (idx >= 0) GameState.drawPile.cards[idx] = upgraded;
          addLog('事件', `地下熔炉：${card.name} 升级为 ${upgraded.name}`);
        } else {
          addLog('事件', `地下熔炉：无可升级卡牌，退还 15 金币`);
          GameState.gold += 15;
        }
      } else {
        addLog('事件', `金币不足`);
      }
      break;
    }
    case 'forgeCleanse': {
      const curseCards = GameState.drawPile.cards.filter(c => c.curse);
      if (curseCards.length > 0) {
        const idx = GameState.drawPile.cards.findIndex(c => c.uid === curseCards[0].uid);
        if (idx >= 0) GameState.drawPile.cards.splice(idx, 1);
        GameState.endingStats.lightChoices++;
        GameState.endingFlags.usedPurifyEvent = true;
        addLog('事件', `地下熔炉：销毁诅咒卡 ${curseCards[0].name}`);
      } else {
        addLog('事件', `地下熔炉：没有诅咒卡可销毁`);
      }
      break;
    }
    case 'forgeMelt': {
      const removed = removeRandomCard();
      if (removed) {
        GameState.gold += 20;
        addLog('事件', `地下熔炉：熔炼 ${removed.name}，+20 金币`);
      } else {
        addLog('事件', `地下熔炉：没有可熔炼的卡牌`);
      }
      break;
    }
    case 'sporeInhale': {
      GameState.player.addStatus('strength', 6);
      GameState.player.addStatus('poison', 8);
      addLog('事件', `孢子花园：+6 力量，+8 中毒`);
      spawnFloatingText(scene, 'player', `+6力量 +8中毒`, '#66ff44', -20, '14px');
      break;
    }
    case 'sporeCollect': {
      if (GameState.potions.length < GameState.MAX_POTIONS) {
        const potion = rollPotionReward();
        tryAddPotion(potion);
        addLog('事件', `孢子花园：获得药水 ${potion.name}`);
      } else {
        addLog('事件', `药水槽已满`);
      }
      break;
    }
    case 'wreckageCockpit': {
      if (Math.random() < 0.5) {
        const relicKeys = Object.keys(RELICS).filter(k =>
          !GameState.player.relics.some(r => r.id === RELICS[k].id));
        if (relicKeys.length > 0) {
          const key = relicKeys[Math.floor(Math.random() * relicKeys.length)];
          GameState.player.addRelic(RELICS[key]);
          addLog('事件', `坠毁飞船：获得遗物 ${RELICS[key].name}`);
        } else {
          GameState.gold += 30;
          addLog('事件', `坠毁飞船：获得 30 金币`);
        }
      } else {
        GameState.player.hp = Math.max(1, GameState.player.hp - 15);
        addLog('事件', `坠毁飞船：爆炸！-15 HP`);
        spawnFloatingText(scene, 'player', `-15 HP`, '#ff4444', -20, '18px');
      }
      break;
    }
    case 'wreckageCargo': {
      const gold = 20 + Math.floor(Math.random() * 21);
      GameState.gold += gold;
      addLog('事件', `坠毁飞船：获得 ${gold} 金币`);
      spawnFloatingText(scene, 'player', `+${gold} 金币`, '#ffdd44', 40, '16px');
      break;
    }
    case 'mirrorFace': {
      GameState.player.hp = Math.max(1, GameState.player.hp - 15);
      GameState.player.addStatus('strength', 4);
      addLog('事件', `幻影之镜：-15 HP，+4 力量`);
      spawnFloatingText(scene, 'player', `-15 HP +4力量`, '#ff44ff', -20, '14px');
      break;
    }
    case 'mirrorBreak': {
      GameState.gold += 15;
      GameState.drawPile.cards.push(createCurseCard());
      addLog('事件', `幻影之镜：+15 金币，获得诅咒卡`);
      break;
    }
    case 'coreDrain': {
      GameState.player.baseBattery += 2;
      GameState.player.addStatus('burn', 5);
      addLog('事件', `能量核心：+2 电量上限，+5 灼烧`);
      spawnFloatingText(scene, 'player', `+2电量 +5灼烧`, '#ff6600', -20, '14px');
      break;
    }
    case 'coreGentle': {
      GameState.player.baseBattery += 1;
      addLog('事件', `能量核心：+1 电量上限`);
      spawnFloatingText(scene, 'player', `+1 电量上限`, '#33ccff', 20, '16px');
      break;
    }
    case 'ghostTrade': {
      const removed1 = removeRandomCard();
      const removed2 = removeRandomCard();
      if (removed1 || removed2) {
        const relicKeys = Object.keys(RELICS).filter(k =>
          !GameState.player.relics.some(r => r.id === RELICS[k].id));
        if (relicKeys.length > 0) {
          const key = relicKeys[Math.floor(Math.random() * relicKeys.length)];
          GameState.player.addRelic(RELICS[key]);
          addLog('事件', `游魂交易：移除卡牌，获得遗物 ${RELICS[key].name}`);
        } else {
          GameState.gold += 40;
          addLog('事件', `游魂交易：移除卡牌，获得 40 金币`);
        }
      } else {
        addLog('事件', `游魂交易：没有可移除的卡牌`);
      }
      break;
    }
    case 'ghostBanish': {
      GameState.player.addShield(8);
      addLog('事件', `游魂低语：+8 护盾`);
      spawnFloatingText(scene, 'player', `+8 护盾`, '#44aaff', 20, '16px');
      break;
    }
    default:
      // 未知效果交给旧函数处理
      return false;
  }
  refreshUI(scene);
  return true;
}

/** Boss 战序列 */
function startBossSequence(scene) {
  // 迎战最终 Boss 前固定获得史诗遗物：铥元素电池
  if (!GameState.player.relics.some(r => r.id === RELICS.thuliumBattery.id)) {
    GameState.player.addRelic(RELICS.thuliumBattery);
    addLog('系统', `获得史诗遗物：${RELICS.thuliumBattery.name} — ${RELICS.thuliumBattery.desc}`);
    refreshUI(scene);
  }

  // Boss 战前固定获得一瓶药水
  if (GameState.potions.length < GameState.MAX_POTIONS) {
    const bossPotion = POTION_DEFS.healthSerum;
    if (tryAddPotion(bossPotion)) {
      addLog('系统', `获得药水：${bossPotion.name} — ${bossPotion.desc}`);
      refreshUI(scene);
    }
  }

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const warningText = scene.add.text(LAYOUT.W / 2, LAYOUT.H / 2 - 20, '⚠ 检测到巨大生命信号...', {
    fontSize: '26px',
    fontFamily: FONT_UI,
    color: '#ff6633',
    fontStyle: 'bold',
  }).setOrigin(0.5).setAlpha(0);

  const bossText = scene.add.text(LAYOUT.W / 2, LAYOUT.H / 2 + 25, '火星吞噬者 正在苏醒！', {
    fontSize: '22px',
    fontFamily: FONT_UI,
    color: '#ff4422',
  }).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({ targets: overlay, alpha: { from: 0, to: 0.8 }, duration: 500 });
  scene.tweens.add({ targets: warningText, alpha: 1, duration: 400 });
  scene.tweens.add({ targets: bossText, alpha: 1, duration: 400, delay: 300 });

  let flashCount = 0;
  const flashTimer = scene.time.addEvent({
    delay: 300,
    callback: () => {
      flashCount++;
      const flash = scene.add.graphics();
      flash.fillStyle(0xff0000, flashCount % 2 === 1 ? 0.1 : 0);
      flash.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
      scene.time.delayedCall(100, () => flash.destroy());

      if (flashCount >= 6) {
        flashTimer.remove();
        scene.tweens.add({
          targets: [warningText, bossText, overlay],
          alpha: 0,
          duration: 400,
          onComplete: () => {
            warningText.destroy();
            bossText.destroy();
            overlay.destroy();
            startBossFight(scene);
            GameState.isFinalBossDefeated = true;
            refreshUI(scene);
            scene.time.delayedCall(300, () => startPlayerTurn(scene));
          }
        });
      }
    },
    repeat: 5,
  });
}

/* ============================================================
 * 战后奖励选择面板（获得卡牌 / 升级卡牌 / 获得金币）
 * ============================================================ */
function showPostBattleRewardChoice(scene, onComplete) {
  GameState.turnPhase = 'reward';

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.88);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  // 三个选项（先定义，供布局计算使用）
  const options = [
    { key: 'card',    label: '获得卡牌', desc: '从 3 张卡中选 1 张加入牌组', color: 0x33ccff, icon: '▤' },
    { key: 'upgrade', label: '升级卡牌', desc: '选择牌组中 1 张卡进行升级', color: 0x88ff44, icon: '↑' },
    { key: 'gold',    label: '获得金币', desc: '获得 25 金币（用于商店）', color: 0xffdd44, icon: '◆' },
  ];

  // 判断升级选项是否可用（需要有可升级的卡）
  const upgradableCards = GameState.drawPile.cards.filter(c => !c.upgraded && UPGRADES[c.id]);
  if (upgradableCards.length === 0) {
    options[1].desc = '（无可升级卡牌）';
    options[1].disabled = true;
  }

  // 竖屏：选项垂直堆叠（横向条形布局）；横屏：3列水平排列
  const popupW = Math.min(680, LAYOUT.W - 40);
  // 竖屏时选项为横向条形：高度小、宽度满；横屏时为竖向卡片：高度大、宽度小
  const btnGap = 14;
  let btnW, btnH, popupH;
  if (isPortrait) {
    btnW = popupW - 60;
    btnH = 78;
    popupH = Math.min(LAYOUT.H - 40, 120 + options.length * btnH + (options.length - 1) * btnGap + 30);
  } else {
    btnW = Math.min(200, (popupW - 60) / 3 - 10);
    btnH = 140;
    popupH = 320;
  }
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x0a1a2a, 0.97);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0x33ccff, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.fillStyle(0x33ccff, 0.9);
  popup.fillRect(popupX + 30, popupY + 28, popupW - 60, 3);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 55, '◆ 战后奖励 ◆', {
    fontSize: isPortrait ? '22px' : '24px',
    fontFamily: FONT_UI,
    color: '#66ffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const hint = scene.add.text(LAYOUT.W / 2, popupY + 90, '选择一项奖励', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#88ccdd',
  }).setOrigin(0.5);

  // 按钮起始位置
  const btnObjects = [];
  const btnBlockTop = popupY + 120;
  // 横屏时水平排列所需变量
  const totalBtnW_h = options.length * btnW + (options.length - 1) * btnGap;
  const btnStartX_h = (LAYOUT.W - totalBtnW_h) / 2 + btnW / 2;
  const btnY_h = popupY + 180;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    let bx, by;
    if (isPortrait) {
      // 竖屏：垂直堆叠
      bx = LAYOUT.W / 2;
      by = btnBlockTop + i * (btnH + btnGap) + btnH / 2;
    } else {
      // 横屏：水平排列
      bx = btnStartX_h + i * (btnW + btnGap);
      by = btnY_h;
    }

    const container = scene.add.container(bx, by);
    const bg = scene.add.graphics();
    const drawBg = (highlighted) => {
      bg.clear();
      bg.fillStyle(highlighted ? 0x1a3a5a : 0x112233, 0.98);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      bg.lineStyle(highlighted ? 3 : 2, highlighted ? 0x66ffff : opt.color, highlighted ? 1 : (opt.disabled ? 0.3 : 0.8));
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    };
    drawBg(false);
    container.add(bg);

    if (isPortrait) {
      // 竖屏：左侧颜色条 + 图标，右侧名称+描述（横向布局）
      const leftBar = scene.add.graphics();
      leftBar.fillStyle(opt.color, opt.disabled ? 0.3 : 0.85);
      leftBar.fillRoundedRect(-btnW / 2 + 6, -btnH / 2 + 6, 8, btnH - 12, 4);
      container.add(leftBar);

      const iconText = scene.add.text(-btnW / 2 + 42, 0, opt.icon, {
        fontSize: '28px',
        fontFamily: FONT_UI,
        color: opt.disabled ? '#666666' : '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(iconText);

      const nameText = scene.add.text(-btnW / 2 + 80, -12, opt.label, {
        fontSize: '17px',
        fontFamily: FONT_UI,
        color: opt.disabled ? '#666666' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0, 0.5);
      container.add(nameText);

      const descText = scene.add.text(-btnW / 2 + 80, 14, opt.desc, {
        fontSize: '12px',
        fontFamily: FONT_UI,
        color: opt.disabled ? '#555555' : '#cceeff',
        align: 'left',
        wordWrap: { width: btnW - 100 },
        lineSpacing: 3,
      }).setOrigin(0, 0.5);
      container.add(descText);
    } else {
      // 横屏：保持原竖向卡片布局
      const topBar = scene.add.graphics();
      topBar.fillStyle(opt.color, opt.disabled ? 0.3 : 0.85);
      topBar.fillRoundedRect(-btnW / 2 + 8, -btnH / 2 + 8, btnW - 16, 28, { tl: 6, tr: 6, bl: 0, br: 0 });
      container.add(topBar);

      const iconText = scene.add.text(0, -btnH / 2 + 22, opt.icon, {
        fontSize: '20px',
        fontFamily: FONT_UI,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(iconText);

      const nameText = scene.add.text(0, -btnH / 2 + 55, opt.label, {
        fontSize: '16px',
        fontFamily: FONT_UI,
        color: opt.disabled ? '#666666' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      container.add(nameText);

      const descText = scene.add.text(0, 10, opt.desc, {
        fontSize: '11px',
        fontFamily: FONT_UI,
        color: opt.disabled ? '#555555' : '#cceeff',
        align: 'center',
        wordWrap: { width: btnW - 16 },
        lineSpacing: 4,
      }).setOrigin(0.5);
      container.add(descText);
    }

    const hitZone = scene.add.rectangle(0, 0, btnW + 10, btnH + 10, 0xffffff, 0)
      .setInteractive({ useHandCursor: !opt.disabled });
    container.add(hitZone);

    if (!opt.disabled) {
      hitZone.on('pointerover', () => {
        scene.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 80 });
        drawBg(true);
      });
      hitZone.on('pointerout', () => {
        scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
        drawBg(false);
      });
      hitZone.on('pointerdown', () => {
        btnObjects.forEach(b => b.hitZone.disableInteractive());
        scene.tweens.add({
          targets: container,
          scaleX: 1.2, scaleY: 1.2, alpha: 0,
          duration: 200,
          ease: 'Back.easeIn',
          onComplete: () => {
            cleanup();
            handleRewardChoice(scene, opt.key, onComplete);
          },
        });
      });
    }

    btnObjects.push({ container, hitZone, bg });
  }

  function cleanup() {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    hint.destroy();
    btnObjects.forEach(b => b.container.destroy());
  }
}

/** 处理奖励选择结果 */
function handleRewardChoice(scene, choice, onComplete) {
  if (choice === 'card') {
    // 弹出三选一卡牌
    const rewards = rollPostBattleRewards(3);
    showCardRewardPopup(scene, rewards, (selectedCard) => {
      GameState.drawPile.cards.push(selectedCard);
      addLog('系统', `获得奖励卡牌：${selectedCard.name}`);
      refreshUI(scene);
      onComplete();
    });
  } else if (choice === 'upgrade') {
    // 弹出升级卡牌选择
    showCardUpgradePopup(scene, onComplete);
  } else if (choice === 'gold') {
    GameState.gold += 25;
    addLog('系统', `获得 25 金币`);
    spawnFloatingText(scene, 'player', `+25 金币`, '#ffdd44', 60, '18px');
    refreshUI(scene);
    onComplete();
  }
}

/** 卡牌升级弹窗 */
function showCardUpgradePopup(scene, onComplete) {
  GameState.turnPhase = 'reward';

  const upgradableCards = GameState.drawPile.cards.filter(c => !c.upgraded && UPGRADES[c.id]);
  if (upgradableCards.length === 0) {
    addLog('系统', '无可升级卡牌');
    onComplete();
    return;
  }

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.88);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = Math.min(760, LAYOUT.W - 40);
  // 竖屏时 cardH 减小，行数动态计算 popupH 避免垂直溢出
  const cardW = isPortrait ? 140 : 155;
  const cardH = isPortrait ? 150 : 180;
  const gap = 12;
  const perRow = isPortrait ? 3 : 4;
  const rows = Math.ceil(upgradableCards.length / perRow);
  const popupH = isPortrait
    ? Math.min(LAYOUT.H - 40, 120 + rows * (cardH + gap) + 20)
    : 420;
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  popup.fillStyle(0x0a2a1a, 0.97);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.lineStyle(3, 0x88ff44, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);
  popup.fillStyle(0x88ff44, 0.9);
  popup.fillRect(popupX + 30, popupY + 28, popupW - 60, 3);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 55, '◆ 升级卡牌 ◆', {
    fontSize: '24px',
    fontFamily: FONT_UI,
    color: '#88ff44',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const hint = scene.add.text(LAYOUT.W / 2, popupY + 90, '选择一张卡牌进行升级', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#aaddaa',
  }).setOrigin(0.5);

  // 卡牌网格坐标计算（变量已在上方定义）
  const totalW = Math.min(perRow, upgradableCards.length) * cardW + (Math.min(perRow, upgradableCards.length) - 1) * gap;
  const startX = (LAYOUT.W - totalW) / 2 + cardW / 2;
  const startY = popupY + 120 + cardH / 2;

  const cardObjects = [];

  for (let i = 0; i < upgradableCards.length; i++) {
    const card = upgradableCards[i];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    const container = scene.add.container(x, y);
    const upgrade = UPGRADES[card.id];

    const bg = scene.add.graphics();
    const drawBg = (highlighted) => {
      bg.clear();
      bg.fillStyle(highlighted ? 0x1a4a2a : 0x112a18, 0.98);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
      bg.lineStyle(highlighted ? 3 : 2, highlighted ? 0xaaff66 : 0x88ff44, highlighted ? 1 : 0.8);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 10);
    };
    drawBg(false);
    container.add(bg);

    // 顶部颜色条
    const topBar = scene.add.graphics();
    topBar.fillStyle(card.color, 0.8);
    topBar.fillRoundedRect(-cardW / 2 + 6, -cardH / 2 + 6, cardW - 12, 22, { tl: 5, tr: 5, bl: 0, br: 0 });
    container.add(topBar);

    const nameText = scene.add.text(0, -cardH / 2 + 17, card.name, {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameText);

    // 当前效果
    const currentDesc = scene.add.text(0, -10, card.desc, {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: '#bbbbcc',
      align: 'center',
      wordWrap: { width: cardW - 12 },
      lineSpacing: 3,
    }).setOrigin(0.5);
    container.add(currentDesc);

    // 升级箭头
    const arrow = scene.add.text(0, 35, '↓ 升级后 ↓', {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: '#88ff44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(arrow);

    // 升级后效果
    const upgradedDesc = scene.add.text(0, 60, upgrade.desc, {
      fontSize: '11px',
      fontFamily: FONT_UI,
      color: '#88ff44',
      align: 'center',
      wordWrap: { width: cardW - 12 },
      lineSpacing: 3,
    }).setOrigin(0.5);
    container.add(upgradedDesc);

    const hitZone = scene.add.rectangle(0, 0, cardW + 8, cardH + 8, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      scene.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 80 });
      drawBg(true);
    });
    hitZone.on('pointerout', () => {
      scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
      drawBg(false);
    });
    hitZone.on('pointerdown', () => {
      cardObjects.forEach(c => c.hitZone.disableInteractive());
      // 执行升级
      const upgradedCard = upgradeCard(card);
      // 替换牌组中的卡牌（保留原位置）
      const idx = GameState.drawPile.cards.findIndex(c => c.uid === card.uid);
      if (idx >= 0) {
        GameState.drawPile.cards[idx] = upgradedCard;
      }
      addLog('系统', `${card.name} 升级为 ${upgradedCard.name}`);
      refreshUI(scene);

      scene.tweens.add({
        targets: container,
        scaleX: 1.3, scaleY: 1.3, alpha: 0,
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          cleanup();
          onComplete();
        },
      });
    });

    cardObjects.push({ container, hitZone, bg });
  }

  function cleanup() {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    hint.destroy();
    cardObjects.forEach(c => c.container.destroy());
  }
}

/* ============================================================
 * 战后三选一卡牌奖励弹窗
 * ============================================================ */
function showCardRewardPopup(scene, rewards, onSelect) {
  GameState.turnPhase = 'reward';

  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, LAYOUT.W, LAYOUT.H);

  const popupW = Math.min(760, LAYOUT.W - 40);
  const popupH = 380;
  const popupX = (LAYOUT.W - popupW) / 2;
  const popupY = (LAYOUT.H - popupH) / 2;

  const popup = scene.add.graphics();
  // 深蓝科技背景
  popup.fillStyle(0x0a1a2a, 0.96);
  popup.fillRoundedRect(popupX, popupY, popupW, popupH, 18);
  // 亮蓝主边框
  popup.lineStyle(3, 0x33ccff, 1);
  popup.strokeRoundedRect(popupX, popupY, popupW, popupH, 18);
  // 内发光装饰线
  popup.lineStyle(1, 0x66ffff, 0.5);
  popup.strokeRoundedRect(popupX + 6, popupY + 6, popupW - 12, popupH - 12, 14);
  // 顶部霓虹条
  popup.fillStyle(0x33ccff, 0.9);
  popup.fillRect(popupX + 30, popupY + 28, popupW - 60, 3);

  const title = scene.add.text(LAYOUT.W / 2, popupY + 55, '◆ 选择一张奖励卡牌 ◆', {
    fontSize: '26px',
    fontFamily: FONT_UI,
    color: '#66ffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);

  const hint = scene.add.text(LAYOUT.W / 2, popupY + 92, '点击或触摸卡牌，将其加入抽牌堆', {
    fontSize: '14px',
    fontFamily: FONT_UI,
    color: '#88ccdd',
  }).setOrigin(0.5);

  const cardW = isPortrait ? 170 : 190;
  const cardH = 220;
  const gap = isPortrait ? 20 : 28;
  const totalW = rewards.length * cardW + (rewards.length - 1) * gap;
  const startX = (LAYOUT.W - totalW) / 2 + cardW / 2;
  const cardY = popupY + 210;

  const rewardObjects = [];

  for (let i = 0; i < rewards.length; i++) {
    const card = rewards[i];
    const x = startX + i * (cardW + gap);

    const container = scene.add.container(x, cardY);

    // 卡牌背景
    const bg = scene.add.graphics();
    bg.fillStyle(0x112233, 0.98);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    bg.lineStyle(2, 0x33ccff, 0.9);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    container.add(bg);

    // 顶部颜色条
    const topBar = scene.add.graphics();
    topBar.fillStyle(card.color, 0.85);
    topBar.fillRoundedRect(-cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, 30, { tl: 6, tr: 6, bl: 0, br: 0 });
    container.add(topBar);

    // 费用圆
    const costBg = scene.add.graphics();
    costBg.fillStyle(0x000000, 0.7);
    costBg.fillCircle(-cardW / 2 + 26, -cardH / 2 + 24, 17);
    costBg.fillStyle(0xffdd44, 0.95);
    costBg.fillCircle(-cardW / 2 + 26, -cardH / 2 + 24, 14);
    container.add(costBg);

    const costText = scene.add.text(-cardW / 2 + 26, -cardH / 2 + 24, `${card.cost}`, {
      fontSize: '16px',
      fontFamily: FONT_UI,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(costText);

    // 卡牌名称
    const nameText = scene.add.text(0, -cardH / 2 + 58, card.name, {
      fontSize: '15px',
      fontFamily: FONT_UI,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: cardW - 20 },
    }).setOrigin(0.5);
    container.add(nameText);

    // 卡牌描述
    const descText = scene.add.text(0, 14, card.desc, {
      fontSize: '13px',
      fontFamily: FONT_UI,
      color: '#cceeff',
      align: 'center',
      wordWrap: { width: cardW - 20 },
      lineSpacing: 5,
    }).setOrigin(0.5);
    container.add(descText);

    // 类型指示条
    const typeColor = card.type === 'damage' ? 0xff4444 : (card.type === 'shield' ? 0x44aaff : 0xffdd00);
    const typeBar = scene.add.graphics();
    typeBar.fillStyle(typeColor, 0.7);
    typeBar.fillRoundedRect(-cardW / 2 + 10, cardH / 2 - 18, cardW - 20, 7, 3);
    container.add(typeBar);

    // 点击/触摸热区（略大于卡牌，提升手机体验）
    const hitZone = scene.add.rectangle(0, 0, cardW + 20, cardH + 20, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      scene.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 100 });
      bg.clear();
      bg.fillStyle(0x1a3a5a, 0.99);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      bg.lineStyle(3, 0x66ffff, 1);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    });

    hitZone.on('pointerout', () => {
      scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
      bg.clear();
      bg.fillStyle(0x112233, 0.98);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      bg.lineStyle(2, 0x33ccff, 0.9);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    });

    hitZone.on('pointerdown', () => {
      // 禁用所有选项，防止重复选择
      rewardObjects.forEach(r => r.hitZone.disableInteractive());

      // 选中放大并消失
      scene.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0,
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          cleanup();
          onSelect(card);
        },
      });
    });

    rewardObjects.push({ container, hitZone, bg });
  }

  function cleanup() {
    overlay.destroy();
    popup.destroy();
    title.destroy();
    hint.destroy();
    rewardObjects.forEach(r => r.container.destroy());
  }
}

/* ============================================================
 * 回合状态机
 * ============================================================ */
function startPlayerTurn(scene) {
  if (!GameState.player.isAlive) {
    gameOver(scene, 'defeat');
    return;
  }
  if (!GameState.enemy.isAlive) {
    handleEnemyDefeated(scene);
    return;
  }

  GameState.turnPhase = 'playerTurn';

  // 回合切换横幅
  showTurnBanner(scene, '▸ 你的回合 ◂', 0x33ff66);

  // BGM 切换：进入战斗场景时播放战斗音乐
  if (GameState.depthLevel === 0) {
    BGM.switch(scene, 'bgm-battle', true);
  }

  GameState.player.resetBattery();
  GameState.player.clearShield();
  addLog('系统', `--- 玩家回合 ---`);
  addLog('系统', `电量重置为 ${GameState.player.maxBattery}，护盾已清空`);

  // 玩家回合开始：结算玩家身上的状态效果（灼烧/中毒扣血，易伤/虚弱递减）
  const playerBurnBefore = GameState.player.hp;
  GameState.player.tickStatusEffects();
  const playerBurnDmg = playerBurnBefore - GameState.player.hp;
  if (playerBurnDmg > 0) {
    addLog('系统', `状态效果：玩家受到 ${playerBurnDmg} 点伤害（灼烧/中毒）`);
    spawnFloatingText(scene, 'player', `-${playerBurnDmg} 状态`, '#ff6600', -40, '14px');
    const statusColor = GameState.player.getStatus('burn') > 0 ? 0xff6600 : 0x66ff44;
    spawnHitParticles(scene, LAYOUT.playerX, LAYOUT.playerY, statusColor, 8, { speed: 100, size: 3 });
    flashEntity(scene, playerSprite, statusColor);
    shakePlayerUI(scene, 'light');
  }

  // 遗物触发：赤铁护符（回合开始获得3护盾）
  const turnShield = GameState.player.getRelicBonus('turnShield');
  if (turnShield > 0) {
    GameState.player.addShield(turnShield);
    addLog('遗物', `赤铁护符：获得 ${turnShield} 点护盾`);
    spawnFloatingText(scene, 'player', `+${turnShield} 护盾`, '#44aaff', 20, '14px');
  }

  // 遗物触发：纳米修复蜂群（回合开始恢复2生命）
  const turnHeal = GameState.player.getRelicBonus('turnHeal');
  if (turnHeal > 0 && GameState.player.hp < GameState.player.maxHp) {
    const actualHeal = Math.min(turnHeal, GameState.player.maxHp - GameState.player.hp);
    GameState.player.hp += actualHeal;
    addLog('遗物', `纳米修复蜂群：恢复 ${actualHeal} 点生命`);
    spawnFloatingText(scene, 'player', `+${actualHeal} HP`, '#33ff77', 40, '14px');
  }

  // 玩家可能在状态效果结算后死亡
  if (!GameState.player.isAlive) {
    scene.time.delayedCall(500, () => gameOver(scene, 'defeat'));
    return;
  }

  // 角色被动技能触发（回合开始）
  triggerPassiveOnTurnStart(scene);

  // 遗物触发：深空目镜（每回合多抽1张牌）
  const extraDraw = GameState.player.getRelicBonus('extraDraw');
  const baseDraw = 4;
  drawCards(scene, baseDraw + extraDraw);
  if (extraDraw > 0) {
    addLog('遗物', `深空目镜：多抽 ${extraDraw} 张牌`);
  }

  refreshUI(scene);
  renderHand(scene);
}

function drawCards(scene, count) {
  let drawn = GameState.drawPile.draw(count);
  if (drawn.length < count) {
    addLog('系统', `抽牌堆不足，洗入弃牌堆 (${GameState.discardPile.length} 张)`);
    GameState.drawPile.reshuffle(GameState.discardPile);
    GameState.discardPile = [];
    const remaining = count - drawn.length;
    const more = GameState.drawPile.draw(remaining);
    drawn = drawn.concat(more);
  }
  GameState.hand = GameState.hand.concat(drawn);
  addLog('系统', `抽取了 ${drawn.length} 张牌`);
}

function playCard(scene, index, cardContainer, cardX, cardY) {
  const card = GameState.hand[index];
  if (!card) return;
  if (GameState.turnPhase !== 'playerTurn') return;

  if (!GameState.player.canPlay(card.cost)) {
    addLog('提示', `电量不足！需要 ${card.cost} 电量`);
    refreshUI(scene);
    return;
  }

  GameState.player.spendBattery(card.cost);

  // 触发角色出牌被动
  triggerPassiveOnPlayCard(scene, card);

  // 动画：卡牌飞出（与手牌同风格的程序化卡面）
  const w = CARD_W, h = CARD_H;
  const flyEdge = card.type === 'damage' ? 0xff5544 : 0x44aaff;
  const flyCard = scene.add.graphics();
  flyCard.fillStyle(0x0d1826, 0.97);
  flyCard.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
  flyCard.fillStyle(card.color, 0.85);
  flyCard.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, 22, { tl: 7, tr: 7, bl: 0, br: 0 });
  flyCard.lineStyle(2, flyEdge, 0.95);
  flyCard.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);

  const flyName = scene.add.text(0, -h / 2 + 14, card.name, {
    fontSize: '13px',
    fontFamily: FONT_UI,
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);

  const flyDesc = scene.add.text(0, 11, card.desc, {
    fontSize: '12px',
    fontFamily: FONT_UI,
    color: '#cfe4f5',
    align: 'center',
    wordWrap: { width: w - 14 },
  }).setOrigin(0.5);

  const flyContainer = scene.add.container(cardX, cardY, [flyCard, flyName, flyDesc]);

  scene.tweens.add({
    targets: flyContainer,
    x: cardX + (card.type === 'damage' ? 320 : -160),
    y: cardY - 180,
    alpha: 0,
    scaleX: 0.7,
    scaleY: 0.7,
    duration: 350,
    ease: 'Power2',
    onComplete: () => flyContainer.destroy(),
  });

  /* ============================================================
   * 卡牌效果执行（完整支持所有字段）
   * ============================================================ */

  // 力量加成计算（玩家力量层数 × 力量倍率，受反物质核心遗物影响）
  const playerStrength = GameState.player.getStatus('strength');
  const strengthMult = GameState.player.getStrengthMultiplier();
  const strengthBonus = playerStrength * strengthMult;

  if (card.type === 'damage') {
    // 多段攻击支持
    const hits = card.hits || 1;
    const baseDamagePerHit = card.value;
    let totalDamage = 0;
    let totalAbsorbed = 0;

    // 百分比伤害：基于敌人最大生命值
    if (card.percentDamage) {
      const percentDmg = Math.floor(GameState.enemy.maxHp * card.percentDamage) + strengthBonus;
      const result = GameState.enemy.takeDamage(percentDmg);
      totalDamage = result.total;
      totalAbsorbed = result.absorbed;
      addLog(card.name, `对 ${GameState.enemy.name} 造成 ${totalDamage} 点伤害（最大生命值${Math.floor(card.percentDamage * 100)}%）` +
        (totalAbsorbed > 0 ? ` (护盾吸收 ${totalAbsorbed})` : ''));
      spawnFloatingText(scene, 'enemy', `-${totalDamage} HP`, '#9966ff', 0, '22px');
      spawnHitParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, 0x9966ff, 20, { speed: 240 });
      flashEntity(scene, enemySprite, 0x9966ff);
      shakeEnemyUI(scene, 'heavy');
      shakeScreen(scene, 'medium');
      flashScreen(scene, 0x9966ff, 0.12);
    } else {
      const hitDesc = hits > 1 ? `（${hits}段）` : '';
      const hitColor = card.pierce ? 0xff2266 : (hits > 1 ? 0xff44aa : 0xff4422);

      // 多段攻击：每段独立扣血、独立特效、错开时间
      for (let i = 0; i < hits; i++) {
        const delay = i * 150;
        scene.time.delayedCall(delay, () => {
          // 每段攻击：基础伤害 + 力量加成
          let dmgPerHit = baseDamagePerHit + strengthBonus;

          // 穿透护盾：直接扣血
          if (card.pierce) {
            GameState.enemy.hp = Math.max(0, GameState.enemy.hp - dmgPerHit);
            totalDamage += dmgPerHit;
          } else {
            const result = GameState.enemy.takeDamage(dmgPerHit);
            totalDamage += result.total;
            totalAbsorbed += result.absorbed;
          }

          // 每段独立飘字（垂直位置错开）
          spawnFloatingText(scene, 'enemy', `-${dmgPerHit}`, '#ff4422', -i * 28, '18px');
          // 每段独立粒子（位置微偏）
          const offsetX = (Math.random() - 0.5) * 30;
          const offsetY = (Math.random() - 0.5) * 30;
          spawnHitParticles(scene, LAYOUT.enemyX + offsetX, LAYOUT.enemyY + offsetY, hitColor, 8, { speed: 180 });
          flashEntity(scene, enemySprite, 0xffffff);
          shakeEnemyUI(scene, 'light');
          refreshUI(scene);
        });
      }

      // 最后一段后：总日志、总震屏、状态效果
      scene.time.delayedCall(hits * 150 + 80, () => {
        addLog(card.name, `对 ${GameState.enemy.name} 造成 ${totalDamage} 点伤害${hitDesc}` +
          (totalAbsorbed > 0 ? ` (护盾吸收 ${totalAbsorbed})` : ''));
        spawnFloatingText(scene, 'enemy', `总计 -${totalDamage} HP${hitDesc}`, '#ff2211', -hits * 28 - 30, '22px');
        spawnHitParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, hitColor, 10 + hits * 3, { speed: 220 });
        shakeEnemyUI(scene, hits > 1 ? 'medium' : 'medium');
        if (totalDamage >= 15 || hits > 1) {
          shakeScreen(scene, hits > 1 ? 'medium' : 'light');
        }

        // 多段攻击的状态效果只在最后施加一次
        if (card.statusEffect) {
          const effects = Array.isArray(card.statusEffect) ? card.statusEffect : [card.statusEffect];
          for (const eff of effects) {
            GameState.enemy.addStatus(eff.type, eff.stacks);
          }
          const statusDesc = describeStatusEffect(card.statusEffect);
          if (statusDesc) {
            addLog(card.name, `施加${statusDesc}`);
            spawnFloatingText(scene, 'enemy', statusDesc, '#ffaa00', -60, '14px');
          }
        }
      });
    }

    // 多段攻击完成后处理吸血 / 自伤 / 力量消耗 / Boss 阶段切换
    scene.time.delayedCall(hits * 150 + 80, () => {
      // 吸血效果：恢复等于造成的伤害
      if (card.lifesteal) {
        const healAmount = GameState.player.relics.some(r => r.id === RELICS.marsAncientRune.id)
          ? totalDamage * 2 : totalDamage;
        const actualHeal = Math.min(healAmount, GameState.player.maxHp - GameState.player.hp);
        GameState.player.hp += actualHeal;
        addLog(card.name, `吸血恢复 ${actualHeal} 点生命`);
        spawnFloatingText(scene, 'player', `+${actualHeal} 吸血`, '#cc3344', -20, '16px');
        spawnHealParticles(scene, LAYOUT.playerX, LAYOUT.playerY, 0xcc3344, 8);
      }

      // 消耗力量层数
      if (card.consumeStrength) {
        const consumed = Math.min(GameState.player.statusEffects.strength, card.consumeStrength);
        GameState.player.statusEffects.strength -= consumed;
        addLog(card.name, `消耗 ${consumed} 层力量`);
      }

      // 自伤效果（伤害类卡牌，如核心熔毁）
      if (card.selfDamage) {
        GameState.player.hp = Math.max(0, GameState.player.hp - card.selfDamage);
        addLog(card.name, `失去 ${card.selfDamage} 点生命`);
        spawnFloatingText(scene, 'player', `-${card.selfDamage} HP`, '#ff4444', -20);
        spawnHitParticles(scene, LAYOUT.playerX, LAYOUT.playerY, 0xff3300, 12, { speed: 160 });
        flashEntity(scene, playerSprite, 0xff0000);
        shakePlayerUI(scene, 'medium');
        flashScreen(scene, 0xff0000, 0.2);
      }

      // 检查 Boss 阶段切换
      if (GameState.enemy.isAlive && GameState.enemy.checkPhaseTransition()) {
        addLog('系统', `⚠ ${GameState.enemy.name} 进入狂暴状态！⚠`);
        spawnFloatingText(scene, 'enemy', '狂暴化！', '#ff00ff', -50, '24px');
        shakeScreen(scene, 'heavy');
        flashScreen(scene, 0xff00ff, 0.35, 300);
        // Boss 狂暴粒子爆发
        spawnHitParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, 0xff00ff, 30, { speed: 280 });
        flashEntity(scene, enemySprite, 0xff00ff);
      }

      refreshUI(scene);
    });
  } else if (card.type === 'shield') {
    let shieldAmount = card.value;

    // 力量转护盾：力量层数 × 2
    if (card.shieldFromStrength) {
      shieldAmount = playerStrength * strengthMult * 2;
    }

    GameState.player.addShield(shieldAmount);
    addLog(card.name, `获得 ${shieldAmount} 点护盾`);
    spawnFloatingText(scene, 'player', `+${shieldAmount} 护盾`, '#ffaa44');
    spawnShieldParticles(scene, LAYOUT.playerX, LAYOUT.playerY, 0x44aaff, 12);
    flashEntity(scene, playerSprite, 0x44aaff);

    // 获得反伤层数
    if (card.gainThorns) {
      GameState.player.addStatus('thorns', card.gainThorns);
      addLog(card.name, `获得 ${card.gainThorns} 层反伤`);
      spawnFloatingText(scene, 'player', `+${card.gainThorns} 反伤`, '#88aa44', 20, '14px');
    }

    // 治疗效果
    if (card.heal) {
      const healAmount = GameState.player.relics.some(r => r.id === RELICS.marsAncientRune.id)
        ? card.heal * 2 : card.heal;
      GameState.player.hp = Math.min(GameState.player.maxHp, GameState.player.hp + healAmount);
      addLog(card.name, `恢复 ${healAmount} 点生命`);
      spawnFloatingText(scene, 'player', `+${healAmount} HP`, '#33ff77', -20);
      spawnHealParticles(scene, LAYOUT.playerX, LAYOUT.playerY, 0x33ff77, 10);
    }
  } else if (card.type === 'special') {
    // 应急过载应急阀：获得电量 + 本回合受伤加成
    if (card.id === 'emergencyOverloadValve') {
      const beforeBattery = GameState.player.battery;
      GameState.player.battery = Math.min(GameState.player.maxBattery, GameState.player.battery + card.gainBattery);
      const actualGain = GameState.player.battery - beforeBattery;
      GameState.player.damageTakenBonus = (GameState.player.damageTakenBonus || 0) + card.damageTakenBonus;
      addLog(card.name, `获得 ${actualGain} 点电量，本回合受伤 +${card.damageTakenBonus}`);
      spawnFloatingText(scene, 'player', `+${actualGain} 电量`, '#ffdd00');
    }

    // 灼烧翻倍：将敌人灼烧层数翻倍
    if (card.statusEffectAction === 'doubleBurn') {
      const currentBurn = GameState.enemy.getStatus('burn');
      if (currentBurn > 0) {
        GameState.enemy.addStatus('burn', currentBurn);
        addLog(card.name, `${GameState.enemy.name} 灼烧层数翻倍至 ${currentBurn * 2} 层`);
        spawnFloatingText(scene, 'enemy', `灼烧×2 (${currentBurn * 2})`, '#ff6600', -30, '14px');
      } else {
        addLog(card.name, `${GameState.enemy.name} 未处于灼烧状态，无效`);
      }
    }

    // 清除自身负面状态
    if (card.purifySelf) {
      GameState.player.statusEffects.burn = 0;
      GameState.player.statusEffects.poison = 0;
      GameState.player.statusEffects.vulnerable = 0;
      GameState.player.statusEffects.weak = 0;
      addLog(card.name, `清除所有负面状态`);
      spawnFloatingText(scene, 'player', '净化！', '#33ffff', -20, '18px');
    }

    // 条件抽牌：手牌少时多抽
    if (card.conditionalDraw) {
      const baseDraw = 1;
      const handSize = GameState.hand.length;
      const bonusDraw = handSize <= 3 ? 1 : 0;
      drawCards(scene, baseDraw + bonusDraw);
      addLog(card.name, `抽取 ${baseDraw + bonusDraw} 张牌${bonusDraw > 0 ? '（条件满足）' : ''}`);
    }

    // 施加状态效果（selfTarget 给自己，否则给敌人）
    if (card.statusEffect && !card.statusEffectAction) {
      const effects = Array.isArray(card.statusEffect) ? card.statusEffect : [card.statusEffect];
      const statusDesc = describeStatusEffect(card.statusEffect);
      if (card.selfTarget) {
        for (const eff of effects) {
          GameState.player.addStatus(eff.type, eff.stacks);
        }
        addLog(card.name, `获得${statusDesc}`);
        spawnFloatingText(scene, 'player', statusDesc, '#ff44ff', -30, '14px');
      } else {
        for (const eff of effects) {
          GameState.enemy.addStatus(eff.type, eff.stacks);
        }
        addLog(card.name, `对 ${GameState.enemy.name} 施加${statusDesc}`);
        spawnFloatingText(scene, 'enemy', statusDesc, '#ffaa00', -30, '14px');
      }
    }

    // 自伤效果（特殊类卡牌，如超频过载）
    if (card.selfDamage) {
      GameState.player.hp = Math.max(0, GameState.player.hp - card.selfDamage);
      addLog(card.name, `失去 ${card.selfDamage} 点生命`);
      spawnFloatingText(scene, 'player', `-${card.selfDamage} HP`, '#ff4444', -20);
    }

    // 获得电量
    if (card.gainBattery && card.id !== 'emergencyOverloadValve') {
      const beforeBattery = GameState.player.battery;
      GameState.player.battery = Math.min(GameState.player.maxBattery, GameState.player.battery + card.gainBattery);
      const actualGain = GameState.player.battery - beforeBattery;
      addLog(card.name, `获得 ${actualGain} 点电量`);
      spawnFloatingText(scene, 'player', `+${actualGain} 电量`, '#ffdd00');
    }
  }

  // 抽牌效果（所有类型卡牌通用）
  if (card.drawCards) {
    drawCards(scene, card.drawCards);
    addLog(card.name, `抽取 ${card.drawCards} 张牌`);
  }

  GameState.hand.splice(index, 1);
  GameState.discardPile.push(card);

  // 多段攻击需要等全部伤害结算完再检查敌人是否死亡
  const isMultiHit = card.type === 'damage' && (card.hits || 1) > 1;
  const checkDelay = isMultiHit ? ((card.hits || 1) * 150 + 150) : 100;

  scene.time.delayedCall(checkDelay, () => {
    refreshUI(scene);
    if (!GameState.enemy.isAlive) {
      renderHand(scene);
      handleEnemyDefeated(scene);
      return;
    }
    renderHand(scene);
  });
}

function handleEnemyDefeated(scene) {
  addLog('系统', `✦ ${GameState.enemy.name} 已被击败！`);

  // 敌人击败爆炸特效
  const isBoss = GameState.isFinalBossDefeated || GameState.enemy.isElite;
  const explosionColor = GameState.enemy.isElite ? 0xaa22aa : 0xff6622;
  spawnDefeatExplosion(scene, LAYOUT.enemyX, LAYOUT.enemyY, explosionColor);
  shakeScreen(scene, isBoss ? 'heavy' : 'medium');
  flashScreen(scene, explosionColor, 0.3, 250);
  if (enemySprite) {
    flashEntity(scene, enemySprite, 0xffffff, 200);
    scene.tweens.add({
      targets: enemySprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 500,
      ease: 'Cubic.easeOut',
    });
  }

  // 结局统计埋点
  GameState.endingStats.battlesWon++;
  if (GameState.enemy.isElite) GameState.endingStats.elitesDefeated++;
  GameState.endingStats.relicsCollected = GameState.player.relics.length;
  // 检查是否使用虚空力量击杀（手牌中有诅咒卡 或 牌组中有诅咒卡）
  const hasCurse = GameState.drawPile.cards.some(c => c.curse);
  if (hasCurse && GameState.isFinalBossDefeated) {
    GameState.endingFlags.killedBossWithVoid = true;
  }

  GameState.discardPile = GameState.discardPile.concat(GameState.hand);
  GameState.hand = [];
  renderHand(scene);
  refreshUI(scene);

  // Boss 战胜利 = 游戏胜利
  if (GameState.isFinalBossDefeated) {
    gameOver(scene, 'victory');
    return;
  }

  // 检查是否还有排队的敌人
  if (GameState.enemyQueue.length > 0) {
    GameState.enemy = GameState.enemyQueue.shift();
    GameState.enemy.turnCount = 0;
    addLog('系统', `敌军：${GameState.enemy.name} 出现了！`);
    scene.time.delayedCall(600, () => startPlayerTurn(scene));
    return;
  }

  // 小 Boss 战胜利
  if (GameState.isMiniBossBattle) {
    GameState.isMiniBossBattle = false;
    handleMiniBossDefeated(scene);
    return;
  }

  // 地图战斗胜利后，增加战斗计数
  GameState.nodeBattleCount++;
  addLog('系统', `战斗完成 (${GameState.nodeBattleCount}/${GameState.battlesPerLayer})`);

  // 战斗金币奖励
  const goldReward = GameState.enemy.isElite ? 35 : 15;
  GameState.gold += goldReward;
  addLog('系统', `获得 ${goldReward} 金币`);
  spawnFloatingText(scene, 'player', `+${goldReward} 金币`, '#ffdd44', 60, '18px');

  // 精英战斗必出药水
  if (GameState.enemy.isElite && GameState.potions.length < GameState.MAX_POTIONS) {
    const potion = rollPotionReward();
    if (tryAddPotion(potion)) {
      addLog('系统', `精英奖励：获得药水 ${potion.name}`);
    }
  }

  // 战后奖励选择（卡牌/升级/金币）
  showPostBattleRewardChoice(scene, () => {
    // 50% 概率获得药水（非精英战斗）
    if (!GameState.enemy.isElite && Math.random() < 0.5 && GameState.potions.length < GameState.MAX_POTIONS) {
      const potion = rollPotionReward();
      if (tryAddPotion(potion)) {
        addLog('系统', `获得药水：${potion.name} — ${potion.desc}`);
        spawnFloatingText(scene, 'player', `获得药水：${potion.name}`, '#ffaa00', 60, '16px');
        refreshUI(scene);
      }
    }

    // 继续地图探索
    showNextMapOrProgress(scene);
  });
}

function endPlayerTurn(scene) {
  GameState.turnPhase = 'enemyTurn';
  addLog('系统', `--- 敌人回合 ---`);
  showTurnBanner(scene, '⚠ 敌人回合 ⚠', 0xff4422);

  addLog('系统', `${GameState.hand.length} 张手牌进入弃牌堆`);
  GameState.discardPile = GameState.discardPile.concat(GameState.hand);
  GameState.hand = [];

  refreshUI(scene);
  renderHand(scene);

  scene.time.delayedCall(700, () => {
    if (!GameState.enemy.isAlive) {
      handleEnemyDefeated(scene);
      return;
    }
    executeEnemyTurn(scene);
  });
}

function executeEnemyTurn(scene) {
  if (!GameState.enemy.isAlive) {
    handleEnemyDefeated(scene);
    return;
  }

  // 敌人回合开始：结算敌人身上的状态效果（灼烧/中毒扣血，易伤/虚弱递减）
  const enemyHpBefore = GameState.enemy.hp;
  GameState.enemy.tickStatusEffects();
  const enemyStatusDmg = enemyHpBefore - GameState.enemy.hp;
  if (enemyStatusDmg > 0) {
    addLog('系统', `状态效果：${GameState.enemy.name} 受到 ${enemyStatusDmg} 点伤害（灼烧/中毒）`);
    spawnFloatingText(scene, 'enemy', `-${enemyStatusDmg} 状态`, '#ff6600', -40, '14px');
    // 状态伤害粒子（灼烧橙红色，中毒绿色）
    const statusColor = GameState.enemy.getStatus('burn') > 0 ? 0xff6600 : 0x66ff44;
    spawnHitParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, statusColor, 8, { speed: 100, size: 3 });
    shakeEnemyUI(scene, 'light');
  }

  // 敌人可能因状态效果死亡
  if (!GameState.enemy.isAlive) {
    scene.time.delayedCall(300, () => handleEnemyDefeated(scene));
    return;
  }

  refreshUI(scene);

  const result = GameState.enemy.executeTurn(GameState.player);

  if (result.type === 'damage' || result.type === 'chargedAttack') {
    addLog(GameState.enemy.name, result.desc);
    spawnFloatingText(scene, 'player', `-${result.value} HP`, '#ff2211', 0,
      result.type === 'chargedAttack' ? '38px' : '20px');
    // 敌人攻击粒子：红色命中玩家
    const isCharged = result.type === 'chargedAttack';
    spawnHitParticles(scene, LAYOUT.playerX, LAYOUT.playerY, 0xff2211,
      isCharged ? 24 : 12, { speed: isCharged ? 260 : 180 });
    flashEntity(scene, playerSprite, 0xff0000);
    shakePlayerUI(scene, isCharged ? 'heavy' : 'medium');
    if (isCharged) {
      shakeScreen(scene, 'heavy');
      flashScreen(scene, 0xff0000, 0.35, 250);
    } else if (result.value >= 12) {
      shakeScreen(scene, 'light');
      flashScreen(scene, 0xff0000, 0.15);
    }
    // 反伤效果显示
    if (result.thornsDamage > 0) {
      spawnFloatingText(scene, 'enemy', `-${result.thornsDamage} 反伤`, '#88aa44', -30, '16px');
      spawnHitParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, 0x88aa44, 10, { speed: 150 });
      shakeEnemyUI(scene, 'light');
    }
  } else if (result.type === 'shield') {
    addLog(GameState.enemy.name, result.desc);
    spawnFloatingText(scene, 'enemy', `+${result.value} 护盾`, '#ffaa44');
    spawnShieldParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, 0xffaa00, 10);
  } else if (result.type === 'charge') {
    addLog(GameState.enemy.name, result.desc);
    // 蓄力特效：敌人身上聚集能量
    spawnHitParticles(scene, LAYOUT.enemyX, LAYOUT.enemyY, 0xff4400, 16, { speed: 80, size: 5 });
    flashEntity(scene, enemySprite, 0xffaa00);
  }

  refreshUI(scene);

  // 敌人可能因反伤死亡
  if (!GameState.enemy.isAlive) {
    scene.time.delayedCall(300, () => handleEnemyDefeated(scene));
    return;
  }

  if (!GameState.player.isAlive) {
    scene.time.delayedCall(500, () => gameOver(scene, 'defeat'));
    return;
  }

  scene.time.delayedCall(600, () => startPlayerTurn(scene));
}

/* ============================================================
 * 游戏结束
 * ============================================================ */
function gameOver(scene, result) {
  GameState.turnPhase = 'gameOver';
  deleteSave(); // 游戏结束删除存档

  const W2 = LAYOUT.W, H2 = LAYOUT.H;
  const overlay = scene.add.graphics();

  if (result === 'victory' && GameState.isFinalBossDefeated) {
    // 判定多结局
    const ending = determineEnding();

    overlay.fillStyle(ending.bgColor || 0x080202, 0);
    overlay.fillRect(0, 0, W2, H2);

    scene.tweens.add({ targets: overlay, alpha: { from: 0, to: 0.9 }, duration: 800, ease: 'Power2' });

    // 粒子效果
    for (let i = 0; i < 40; i++) {
      const px = Phaser.Math.Between(0, W2);
      const py = Phaser.Math.Between(0, H2);
      const dot = scene.add.circle(px, py, Phaser.Math.Between(1, 3), ending.particleColor, 0.3);
      scene.tweens.add({
        targets: dot,
        alpha: { from: 0, to: 0.6 },
        y: py - Phaser.Math.Between(20, 60),
        duration: Phaser.Math.Between(1500, 3000),
        repeat: -1,
        yoyo: true,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }

    // 结局标题
    const missionTitle = scene.add.text(W2 / 2, 80, ending.title, {
      fontSize: '38px',
      fontFamily: FONT_UI,
      color: ending.titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    scene.tweens.add({ targets: missionTitle, alpha: 1, y: 90, duration: 700, ease: 'Back.easeOut' });

    // 结局名称
    const endingName = scene.add.text(W2 / 2, 145, `◆ ${ending.name} ◆`, {
      fontSize: '24px',
      fontFamily: FONT_UI,
      color: ending.endingColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);
    scene.tweens.add({ targets: endingName, alpha: 1, duration: 600, delay: 500 });

    // 分隔线
    const line = scene.add.graphics().setAlpha(0);
    scene.tweens.add({ targets: line, alpha: 1, delay: 800, duration: 400 });
    line.lineStyle(2, ending.lineColor, 0.7);
    line.lineBetween(W2 / 2 - 200, 180, W2 / 2 + 200, 180);

    // 结局描述
    const descText = scene.add.text(W2 / 2, 220, ending.description, {
      fontSize: '15px',
      fontFamily: FONT_UI,
      color: ending.descColor,
      align: 'center',
      wordWrap: { width: W2 - 80 },
      lineSpacing: 6,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setAlpha(0);
    scene.tweens.add({ targets: descText, alpha: 1, duration: 600, delay: 1000 });

    // 战绩统计面板
    const statsY = isPortrait ? 360 : 340;
    const statsTitle = scene.add.text(W2 / 2, statsY, '— 本局战绩 —', {
      fontSize: '14px',
      fontFamily: FONT_UI,
      color: '#88aabb',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    scene.tweens.add({ targets: statsTitle, alpha: 1, duration: 400, delay: 1300 });

    const stats = GameState.endingStats;
    const statsLines = [
      `角色: ${GameState.player.name}  |  楼层: ${stats.floorsCleared}  |  战斗胜利: ${stats.battlesWon}`,
      `精英击败: ${stats.elitesDefeated}  |  遗物收集: ${stats.relicsCollected}  |  诅咒卡: ${stats.curseCardsGained}`,
      `事件触发: ${stats.eventsTriggered}  |  药水使用: ${stats.potionsUsed}  |  商店使用: ${stats.shopsUsed}`,
      `虚空选择: ${stats.voidChoices}  |  光明选择: ${stats.lightChoices}  |  剩余金币: ${GameState.gold}`,
    ];
    const statsText = scene.add.text(W2 / 2, statsY + 25, statsLines.join('\n'), {
      fontSize: '12px',
      fontFamily: FONT_UI,
      color: '#aabbcc',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0).setAlpha(0);
    scene.tweens.add({ targets: statsText, alpha: 1, duration: 600, delay: 1500 });

    // 重新开始按钮
    const btnContainer = scene.add.container(W2 / 2, H2 - 80).setAlpha(0);
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(0x5a2212, 1);
    btnBg.fillRoundedRect(-100, -22, 200, 44, 10);
    btnBg.lineStyle(2, 0xcc4420, 1);
    btnBg.strokeRoundedRect(-100, -22, 200, 44, 10);
    btnContainer.add(btnBg);

    const btnText = scene.add.text(0, 0, '⟳ 重新开始', {
      fontSize: '18px',
      fontFamily: FONT_UI,
      color: '#ffcc88',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    const btnHit = scene.add.rectangle(0, 0, 200, 44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(btnHit);

    btnHit.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x7a3018, 1);
      btnBg.fillRoundedRect(-100, -22, 200, 44, 10);
      btnBg.lineStyle(2, 0xff6633, 1);
      btnBg.strokeRoundedRect(-100, -22, 200, 44, 10);
      scene.tweens.add({ targets: btnContainer, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btnHit.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x5a2212, 1);
      btnBg.fillRoundedRect(-100, -22, 200, 44, 10);
      btnBg.lineStyle(2, 0xcc4420, 1);
      btnBg.strokeRoundedRect(-100, -22, 200, 44, 10);
      scene.tweens.add({ targets: btnContainer, scaleX: 1, scaleY: 1, duration: 100 });
    });
    btnHit.on('pointerdown', () => scene.scene.restart());

    scene.tweens.add({ targets: btnContainer, alpha: 1, duration: 600, delay: 1800, ease: 'Power2' });

  } else {
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W2, H2);

    scene.tweens.add({ targets: overlay, alpha: { from: 0, to: 0.75 }, duration: 500, ease: 'Power2' });

    let msg, subMsg, color;
    if (result === 'victory') {
      msg = '✦ 胜利 ✦';
      subMsg = '';
      color = '#ffdd44';
    } else {
      msg = '✧ 战败... 宇航员倒下了 ✧';
      subMsg = '火星的深处，埋藏着未竟的使命...';
      color = '#ff4444';
    }

    const title = scene.add.text(W2 / 2, H2 / 2 - 40, msg, {
      fontSize: '26px',
      fontFamily: FONT_UI,
      color,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = scene.add.text(W2 / 2, H2 / 2 + 5, subMsg, {
      fontSize: '16px',
      fontFamily: FONT_UI,
      color: '#cc8866',
    }).setOrigin(0.5).setAlpha(0);

    const restartHint = scene.add.text(W2 / 2, H2 / 2 + 50, '点击任意位置重新开始', {
      fontSize: '15px',
      fontFamily: FONT_UI,
      color: '#886655',
    }).setOrigin(0.5).setAlpha(0);

    scene.tweens.add({ targets: title, alpha: 1, y: H2 / 2 - 50, duration: 600, delay: 200 });
    scene.tweens.add({ targets: subtitle, alpha: 1, duration: 600, delay: 500 });
    scene.tweens.add({ targets: restartHint, alpha: 1, duration: 600, delay: 800 });

    const restartZone = scene.add.rectangle(W2 / 2, H2 / 2, W2, H2, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    restartZone.on('pointerdown', () => scene.scene.restart());
  }

  addLog('系统', result === 'victory' ? '✦ 使命完成！' : '✧ 战败...');
  refreshUI(scene);
}

/* ============================================================
 * 多结局判定系统
 * ============================================================ */
const ENDINGS = {
  purifier: {
    id: 'purifier',
    title: 'MISSION SUCCESS',
    name: '净化结局 · 火星之净',
    description: '你以纯净之力击败了火星吞噬者。\n没有使用任何虚空力量，没有诅咒污染牌组。\n\n火星的地核重归平静，远古的寄生体被彻底净化。\n人类在这颗红色星球上建立了永恒的家园，\n你的名字将被刻在第一座纪念碑上。',
    titleColor: '#ffdd44',
    endingColor: '#ffaa44',
    descColor: '#ffdd99',
    lineColor: 0xffaa44,
    bgColor: 0x080202,
    particleColor: 0xff8844,
  },
  balanced: {
    id: 'balanced',
    title: 'MISSION SUCCESS',
    name: '平衡结局 · 灰色抉择',
    description: '你击败了火星吞噬者。\n在光与暗之间，你选择了灰色的平衡之路。\n既不纯粹也不堕落，既使用力量也保持理智。\n\n火星被征服了，但代价沉重。\n前哨站建立起来，但你知道深渊仍在地底沉睡。\n未来的某一天，它可能再次苏醒。',
    titleColor: '#88ddff',
    endingColor: '#66aaff',
    descColor: '#aaccdd',
    lineColor: 0x66aaff,
    bgColor: 0x020208,
    particleColor: 0x66aaff,
  },
  void: {
    id: 'void',
    title: 'MISSION COMPLETE?',
    name: '虚空结局 · 深渊凝视',
    description: '你击败了火星吞噬者，但代价是什么？\n你的牌组中充斥着诅咒，你的灵魂已被虚空侵蚀。\n\n当寄生体倒下的那一刻，你感受到了它的低语。\n「我们合而为一了。」\n\n你站在地核之中，眼中闪烁着不属于人类的紫光。\n前哨站的信号永远消失了。',
    titleColor: '#cc44ff',
    endingColor: '#aa44ff',
    descColor: '#cc88ff',
    lineColor: 0xaa44ff,
    bgColor: 0x040208,
    particleColor: 0xaa44ff,
  },
  sacrifice: {
    id: 'sacrifice',
    title: 'MISSION COMPLETE',
    name: '牺牲结局 · 永恒守护',
    description: '你没有选择离开。\n在最后一刻，你选择与火星吞噬者同归于尽。\n\n你的生命化作了封印，永远镇压着地核中的深渊。\n\n前哨站的同伴们安全了。\n他们不知道你做了什么，\n但每当夜幕降临，火星的天空中会多出一颗微弱的星。\n那是你。',
    titleColor: '#ff6644',
    endingColor: '#ff4444',
    descColor: '#ff8866',
    lineColor: 0xff4444,
    bgColor: 0x080202,
    particleColor: 0xff4444,
  },
};

/** 根据游戏过程判定结局 */
function determineEnding() {
  const stats = GameState.endingStats;
  const flags = GameState.endingFlags;
  const hasCurse = GameState.drawPile.cards.some(c => c.curse);

  // 虚空结局：使用过虚空事件 + 牌组中有诅咒卡
  if (flags.usedVoidEvent && hasCurse && stats.voidChoices >= 2) {
    return ENDINGS.void;
  }

  // 净化结局：从未使用虚空事件 + 牌组中无诅咒卡 + 净化过诅咒或光明选择较多
  if (!flags.usedVoidEvent && !hasCurse &&
      (flags.usedPurifyEvent || stats.lightChoices >= 2)) {
    return ENDINGS.purifier;
  }

  // 牺牲结局：玩家HP极低（< 20% maxHp）时击败Boss
  if (GameState.player.hp < GameState.player.maxHp * 0.2) {
    return ENDINGS.sacrifice;
  }

  // 平衡结局：默认结局
  return ENDINGS.balanced;
}

/* ============================================================
 * update 循环
 * ============================================================ */
function update() {
  // 战斗场景暂无每帧逻辑
}

/* ============================================================
 * 存档系统（localStorage）
 * ============================================================ */
const SAVE_KEY = 'forcing_mars_save';

/** 保存游戏进度 */
function saveGame() {
  try {
    const player = GameState.player;
    const saveData = {
      version: 2,
      timestamp: Date.now(),
      characterId: player.characterId,
      player: {
        hp: player.hp,
        baseMaxHp: player.baseMaxHp,
        baseBattery: player.baseBattery,
        shield: player.shield,
        relics: player.relics.map(r => r.id),
        statusEffects: { ...player.statusEffects },
      },
      deck: GameState.drawPile.cards.map(c => ({ id: c.id, upgraded: c.upgraded || false, uid: c.uid })),
      hand: GameState.hand.map(c => ({ id: c.id, upgraded: c.upgraded || false, uid: c.uid })),
      discardPile: GameState.discardPile.map(c => ({ id: c.id, upgraded: c.upgraded || false, uid: c.uid })),
      potions: GameState.potions.map(p => p.id),
      gold: GameState.gold,
      depthLevel: GameState.depthLevel,
      nodeBattleCount: GameState.nodeBattleCount,
      isFinalBossDefeated: GameState.isFinalBossDefeated,
      isMiniBossBattle: GameState.isMiniBossBattle,
      currentMapData: GameState.currentMapData,
      endingStats: { ...GameState.endingStats },
      endingFlags: { ...GameState.endingFlags },
      CARD_UID_COUNTER: CARD_UID_COUNTER,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) {
    console.error('保存失败：', e);
    return false;
  }
}

/** 加载游戏进度，返回是否成功 */
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    // 恢复玩家（按存档职业重建，旧存档无 characterId 时回退宇航员）
    const player = new Player(data.characterId || 'astronaut');
    player.hp = data.player.hp;
    player.baseMaxHp = data.player.baseMaxHp;
    player.baseBattery = data.player.baseBattery;
    player.shield = data.player.shield;
    player.statusEffects = data.player.statusEffects || player.statusEffects;
    // 恢复遗物
    for (const relicId of data.player.relics) {
      const relic = RELICS[relicId];
      if (relic) player.relics.push(relic);
    }

    // 恢复卡组
    const restoreCard = (cardData) => {
      const def = CARD_DEFS[cardData.id];
      if (!def) return null;
      let card = createCardInstance(def);
      card.uid = cardData.uid;
      if (cardData.upgraded) {
        card = upgradeCard(card) || card;
      }
      return card;
    };

    const deckCards = data.deck.map(restoreCard).filter(c => c);
    const handCards = data.hand.map(restoreCard).filter(c => c);
    const discardCards = data.discardPile.map(restoreCard).filter(c => c);

    // 恢复药水
    const potions = data.potions.map(pid => POTION_DEFS[pid]).filter(p => p);

    // 恢复 UID 计数器
    CARD_UID_COUNTER = data.CARD_UID_COUNTER || 0;

    // 写入 GameState（续档总是回到地图选择，战斗中断的手牌/弃牌全部洗回牌库）
    GameState.player = player;
    GameState.drawPile = new DrawPile([...deckCards, ...handCards, ...discardCards]);
    GameState.hand = [];
    GameState.discardPile = [];
    // 清理瞬态战斗状态（旋转续档时全局可能残留上一场战斗的引用）
    GameState.enemy = null;
    GameState.enemyQueue = [];
    GameState.turnPhase = 'idle';
    GameState.cardContainers = [];
    GameState.potionContainers = [];
    GameState.logLines = [];
    GameState.potions = potions;
    GameState.gold = data.gold;
    GameState.depthLevel = data.depthLevel;
    GameState.nodeBattleCount = data.nodeBattleCount;
    GameState.isFinalBossDefeated = data.isFinalBossDefeated;
    GameState.isMiniBossBattle = data.isMiniBossBattle;
    GameState.currentMapData = data.currentMapData;
    if (data.endingStats) GameState.endingStats = { ...GameState.endingStats, ...data.endingStats };
    if (data.endingFlags) GameState.endingFlags = { ...GameState.endingFlags, ...data.endingFlags };

    return true;
  } catch (e) {
    console.error('加载存档失败：', e);
    return false;
  }
}

/** 删除存档 */
function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

/** 检查是否有存档 */
function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/** 自动保存（在关键节点调用） */
function autoSave() {
  if (GameState.turnPhase !== 'gameOver') {
    saveGame();
  }
}

/* ============================================================
 * 角色被动技能系统
 * ============================================================ */

/** 回合开始时触发的被动 */
function triggerPassiveOnTurnStart(scene) {
  const passive = GameState.player.character.passive;
  switch (passive) {
    case 'astronautShield':
      // 宇航员：10% 概率获得 1 点护盾
      if (Math.random() < 0.10) {
        GameState.player.addShield(1);
        addLog('被动', `宇航员：获得 1 点护盾`);
        spawnFloatingText(scene, 'player', `+1 护盾`, '#44aaff', 20, '12px');
      }
      break;
    // 工程兵/异变者/突击兵的被动在出牌时触发
    case 'engineerShieldBonus':
    case 'mutantStatusBonus':
    case 'assaultEnergyChance':
      break;
  }
}

/** 出牌时触发的被动，返回附加效果 */
function triggerPassiveOnPlayCard(scene, card) {
  const passive = GameState.player.character.passive;
  switch (passive) {
    case 'engineerShieldBonus':
      // 工程兵：出护盾卡时额外获得 2 点护盾
      if (card.type === 'shield') {
        GameState.player.addShield(2);
        addLog('被动', `工程兵：额外获得 2 点护盾`);
        spawnFloatingText(scene, 'player', `+2 护盾`, '#44aaff', 30, '12px');
      }
      break;
    case 'mutantStatusBonus':
      // 异变者：施加状态效果时，在卡牌原有层数基础上额外叠加等同层数的状态，
      // 支持多层累加：若目标已存在该效果，则叠在其原有层数之上，而非限制为单层。
      if (card.statusEffect) {
        const effects = Array.isArray(card.statusEffect) ? card.statusEffect : [card.statusEffect];
        let total = 0;
        for (const eff of effects) {
          GameState.enemy.addStatus(eff.type, eff.stacks);
          total += eff.stacks;
        }
        addLog('被动', `异变者：状态效果叠加 +${total} 层`);
      }
      break;
    case 'assaultEnergyChance':
      // 突击兵：打出攻击卡时 15% 概率获得 1 点电量
      if (card.type === 'damage' && Math.random() < 0.15) {
        GameState.player.battery = Math.min(GameState.player.maxBattery, GameState.player.battery + 1);
        addLog('被动', `突击兵：获得 1 点电量`);
        spawnFloatingText(scene, 'player', `+1 电量`, '#33ccff', 20, '12px');
      }
      break;
  }
}

/* ============================================================
 * 中英双语：重写 addLog 以即时翻译日志
 * （i18n.js 已重写 scene.add.text / Text.setText；此处补日志通道）
 * ============================================================ */
if (window.I18N && typeof I18N.wrapLog === 'function') {
  I18N.wrapLog();
}
