/**
 * story.js — 开场剧情场景（太空终端打字机 + 长按跳过）
 */

/** 终端风加载进度条（剧情/战斗场景 preload 共用，加载完自行销毁） */
function createLoadingIndicator(scene, label) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const barW = Math.min(360, W - 120);

  const text = scene.add.text(W / 2, H / 2 - 24, `> ${label}... 0%`, {
    fontSize: '15px',
    fontFamily: FONT_MONO,
    color: '#33ff77',
  }).setOrigin(0.5);

  const bar = scene.add.graphics();
  const drawBar = (p) => {
    bar.clear();
    bar.lineStyle(1, 0x33ff77, 0.6);
    bar.strokeRect(W / 2 - barW / 2, H / 2, barW, 12);
    bar.fillStyle(0x33ff77, 0.85);
    bar.fillRect(W / 2 - barW / 2 + 2, H / 2 + 2, Math.max(0, (barW - 4) * p), 8);
  };
  drawBar(0);

  scene.load.on('progress', (p) => {
    text.setText(`> ${label}... ${Math.round(p * 100)}%`);
    drawBar(p);
  });
  scene.load.once('complete', () => {
    text.destroy();
    bar.destroy();
  });
}

class StoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StoryScene' });
  }

  preload() {
    // 只预载剧情 BGM，战斗/Boss 曲留给 BattleScene，减少首屏下载量
    createLoadingIndicator(this, '信号接入中');
    this.load.audio('bgm-story', 'assets/bgms/bgm_story.mp3');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.cameras.main.setBackgroundColor('#000000');

    // 播放开场剧情 BGM
    BGM.play(this, 'bgm-story', true);

    // 终端外框
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x00ff44, 0.5);
    frame.strokeRect(30, 30, W - 60, H - 60);
    frame.lineStyle(1, 0x006622, 0.3);
    frame.strokeRect(40, 40, W - 80, H - 80);

    // 扫描线
    const scanline = this.add.graphics();
    scanline.fillStyle(0x00ff44, 0.03);
    scanline.fillRect(42, 42, W - 84, 2);
    this.tweens.add({
      targets: scanline,
      y: H - 88,
      duration: 4000,
      repeat: -1,
      yoyo: true,
      ease: 'Linear',
    });

    // 噪点层
    const noise = this.add.graphics();
    this.time.addEvent({
      delay: 100,
      callback: () => {
        noise.clear();
        noise.fillStyle(0x00ff44, Math.random() * 0.02);
        noise.fillRect(Math.random() * (W - 80) + 40, Math.random() * (H - 80) + 40, Math.random() * 3, Math.random() * 2);
      },
      repeat: -1,
    });

    this.storyLines = [
      { prefix: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', text: '', isHeader: true },
      { prefix: '[ 地球联合防卫阵线 (EDF) · 绝密量子广播 ]', text: '', isHeader: true },
      { prefix: '[ 时间戳：新纪元 142 年 / 地球资源枯竭第 11 载 ]', text: '', isHeader: true },
      { prefix: '[ 接收人：编号 #M-07 · 宇航员「你」 ]', text: '', isHeader: true },
      { prefix: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', text: '', isHeader: true },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '...信号接入中...' },
      { prefix: '', text: '...量子纠缠链路建立...信号强度 37%...' },
      { prefix: '', text: '...正在解密...解密完成...' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「这里是 EDF 最高指挥部。这不是演习。」' },
      { prefix: '', text: '「这是人类文明的最后一则简报。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「十一年前，我们的母星死了。」' },
      { prefix: '', text: '「地核冷却，磁场消散，太阳风在三日内剥离了大气层。海水沸腾蒸发，地表化为焦土。我们倾尽最后的资源，将五十亿幸存者塞进火星轨道殖民站——我们叫它‘温床’。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「我们以为逃出来了。」' },
      { prefix: '', text: '「我们以为火星会接纳我们。」' },
      { prefix: '', text: '「我们错了。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「三天前，72 小时整，火星地下传来一道超低频震荡。频率单一，稳定，像是心跳。」' },
      { prefix: '', text: '「地核内的引力常数开始坍塌。殖民站轨道每天衰减 12 公里。按照这个速率，47 小时后，温床将坠入火星大气层，五十亿人将化为赤红天空中的一缕青烟。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「我们向地下 2000 米的‘太古空腔’发射了最后一枚深探针。」' },
      { prefix: '', text: '「传回的图像让整个指挥部陷入死寂。」' },
      { prefix: '', text: '「那不是岩石，不是矿物。那是一个正在苏醒的生命体——直径超过 3 公里，缠绕在地核之上，正在用它庞大的身躯抽干这颗行星的引力。」' },
      { prefix: '', text: '「我们给它起了个名字——『火星吞噬者』。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「它是星体寄生虫。它杀死了地球，现在它要杀死火星。」' },
      { prefix: '', text: '「而我们的殖民站，不过是它苏醒前的一粒尘埃。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「EDF 启动了最后的预案——『强渡计划』。」' },
      { prefix: '', text: '「你，编号 #M-07，是唯一具备神经接合等级 S 的宇航员。只有你能驾驶单人轨道舱，强行破击降落火星，深入地下，直抵它的心脏。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「你已经在路上了。」' },
      { prefix: '', text: '「此时此刻，你的轨道舱正在穿越火星大气层，外壳温度 2400 度，舷窗外是一片赤红的火海。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「任务简报如下：」' },
      { prefix: '', text: '▸ 第一阶段 · 地表 0m：辐射沙丘。清剿地表异星幼蛭，建立下降通道。' },
      { prefix: '', text: '▸ 第二阶段 · 地下 500m：晶化矿脉。依靠有限的电磁卡组生存下来。' },
      { prefix: '', text: '▸ 第三阶段 · 地下 2000m：炽热地核。在殖民站坠毁前，彻底抹杀『火星吞噬者』。' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「你的装甲只配备了 3 点初始充能电量。每往下一层，异变生态将呈指数级恶化。」' },
      { prefix: '', text: '「你将在战斗中获取新的电磁卡牌、古老的火星遗物、以及稀有的战术药水。」' },
      { prefix: '', text: '「你将独自选择下潜的路径——是绕开精英怪物，还是冒险获取更丰厚的奖励。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「我们没有第二次机会。」' },
      { prefix: '', text: '「五十亿人正在轨道上看着你。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「着陆倒计时：3... 2... 1...」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '', text: '「强渡火星。」' },
      { prefix: '', text: '「祝人类……好运。」' },
      { prefix: '', text: '', isBreak: true },
      { prefix: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', text: '', isHeader: true },
      { prefix: '[ 信号中断 · 任务开始 ]', text: '', isHeader: true },
      { prefix: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', text: '', isHeader: true },
    ];

    this.lineObjects = [];
    this.currentLineIndex = 0;
    this.charIndex = 0;
    this.typeTimer = null;
    this.isTyping = false;
    this.isFinished = false;

    // 跳过状态
    this.skipHoldTime = 0;
    this.skipRequired = 1500;
    this.skipActive = false;

    // 跳过提示（底部居中，支持鼠标/触摸长按）
    this.skipContainer = this.add.container(W / 2, H - 28).setAlpha(0.8);
    this.skipText = this.add.text(0, 0, '长按 [SPACE] 或 按住屏幕 1.5秒跳过', {
      fontSize: '13px',
      fontFamily: FONT_MONO,
      color: '#33ff66',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
    this.skipContainer.add(this.skipText);

    // 跳过进度条背景
    this.skipBarBg = this.add.graphics();
    this.skipBarFill = this.add.graphics();
    this.skipContainer.add([this.skipBarBg, this.skipBarFill]);
    this.skipBarBg.fillStyle(0x003300, 0.7);
    this.skipBarBg.fillRoundedRect(-120, -24, 240, 8, 4);

    this.input.keyboard.on('keydown-SPACE', () => { if (!this.isFinished) this.skipActive = true; });
    this.input.keyboard.on('keyup-SPACE', () => { this.skipActive = false; });

    // 鼠标/触摸按下也触发跳过（剧情播放期间有效）
    this.input.on('pointerdown', () => { if (!this.isFinished) this.skipActive = true; });
    this.input.on('pointerup', () => { this.skipActive = false; });

    this.startTypingNextLine();
  }

  startTypingNextLine() {
    if (this.currentLineIndex >= this.storyLines.length) {
      this.isFinished = true;
      this.skipText.setText('按任意键或点击屏幕开始');
      this.input.once('pointerdown', () => this.startBattle());
      this.input.keyboard.once('keydown', () => this.startBattle());
      return;
    }

    const lineData = this.storyLines[this.currentLineIndex];

    if (lineData.isBreak) {
      this.currentLineIndex++;
      this.time.delayedCall(1500, () => this.startTypingNextLine());
      return;
    }

    const y = 100 + this.lineObjects.length * 32;
    const prefixColor = lineData.isHeader ? '#00cc44' : (lineData.prefix ? '#00cc44' : '#00ff66');
    const prefixWeight = lineData.isHeader ? 'bold' : (lineData.prefix ? 'bold' : 'normal');
    const mainColor = lineData.isHeader ? '#00ff66' : '#44ff88';

    const prefixText = this.add.text(60, y, lineData.prefix, {
      fontSize: '15px',
      fontFamily: FONT_MONO,
      color: prefixColor,
      fontStyle: prefixWeight,
      stroke: '#000000',
      strokeThickness: 2,
    });

    const mainText = this.add.text(60 + (lineData.prefix ? prefixText.width + 8 : 0), y, '', {
      fontSize: '15px',
      fontFamily: FONT_MONO,
      color: mainColor,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: 800 },
    });

    this.lineObjects.push({ prefix: prefixText, main: mainText, fullText: lineData.text });
    this.charIndex = 0;
    this.isTyping = true;

    const typeDelay = lineData.isHeader ? 30 : 50;
    this.typeTimer = this.time.addEvent({
      delay: typeDelay,
      callback: () => this.typeNextChar(),
      repeat: lineData.text.length,
    });
  }

  typeNextChar() {
    const line = this.lineObjects[this.lineObjects.length - 1];
    this.charIndex++;
    line.main.setText(line.fullText.slice(0, this.charIndex));

    if (this.charIndex >= line.fullText.length) {
      this.isTyping = false;
      this.currentLineIndex++;
      const pauseTime = this.storyLines[this.currentLineIndex]?.isBreak ? 500 : 1500;
      this.time.delayedCall(pauseTime, () => {
        this.scrollLines();
        this.startTypingNextLine();
      });
    }
  }

  scrollLines() {
    const maxVisible = 10;
    if (this.lineObjects.length > maxVisible) {
      const removed = this.lineObjects.shift();
      removed.prefix.destroy();
      removed.main.destroy();
    }
    this.lineObjects.forEach((line, idx) => {
      const targetY = 100 + idx * 32;
      this.tweens.add({
        targets: [line.prefix, line.main],
        y: targetY,
        duration: 300,
        ease: 'Power1',
      });
    });
  }

  update(time, delta) {
    if (this.isFinished) return;

    if (this.skipActive) {
      this.skipHoldTime += delta;
      const pct = Math.min(this.skipHoldTime / this.skipRequired, 1);
      this.skipText.setText(`跳过中... ${Math.floor(pct * 100)}%`);
      this.skipBarFill.clear();
      this.skipBarFill.fillStyle(0x00ff44, 0.85);
      this.skipBarFill.fillRoundedRect(-120, -24, 240 * pct, 8, 4);

      if (this.skipHoldTime >= this.skipRequired) {
        this.skipActive = false;
        this.startBattle();
      }
    } else {
      if (this.skipHoldTime > 0) {
        this.skipHoldTime = Math.max(0, this.skipHoldTime - delta * 2);
        const pct = this.skipHoldTime / this.skipRequired;
        this.skipText.setText('长按 [SPACE] 或 按住屏幕 1.5秒跳过');
        this.skipBarFill.clear();
        this.skipBarFill.fillStyle(0x00ff44, 0.85);
        this.skipBarFill.fillRoundedRect(-120, -24, 240 * pct, 8, 4);
      }
    }
  }

  startBattle() {
    if (this.typeTimer) this.typeTimer.remove();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BattleScene');
    });
  }
}
