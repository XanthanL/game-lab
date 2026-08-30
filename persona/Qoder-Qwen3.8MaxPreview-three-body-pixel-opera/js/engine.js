/* === 三体 NDS像素舞台剧 - 游戏引擎核心 === */

class StageEngine {
    constructor() {
        this.stageCanvas = document.getElementById('stage-canvas');
        this.uiCanvas = document.getElementById('ui-canvas');
        this.renderer = new PixelRenderer(this.stageCanvas);
        this.uiCtx = this.uiCanvas.getContext('2d');
        this.uiCtx.imageSmoothingEnabled = false;

        // 状态
        this.state = 'title'; // title, playing, transition, ended
        this.currentAct = null;
        this.currentSceneIndex = 0;
        this.acts = ['prologue', 'act1', 'act2', 'act3', 'epilogue'];
        this.actIndex = 0;

        // 对话系统
        this.typewriter = {
            text: '',
            displayed: '',
            index: 0,
            speed: 50,
            timer: null,
            done: false
        };

        // 转场
        this.transition = {
            active: false,
            alpha: 0,
            direction: 'in', // in = 变黑, out = 变亮
            callback: null
        };

        // 动画
        this.animFrame = null;
        this.lastTime = 0;

        // 当前场景数据
        this.currentScene = null;
        this.currentBg = 'space';

        // 选择系统
        this.choiceActive = false;
        this.choiceIndex = 0;
        this.choices = [];

        this.bindEvents();
    }

    bindEvents() {
        // 键盘
        document.addEventListener('keydown', (e) => this.handleInput(e.key));
        // 按钮
        document.getElementById('btn-a').addEventListener('click', () => this.handleInput('a'));
        document.getElementById('btn-b').addEventListener('click', () => this.handleInput('b'));
        document.getElementById('btn-start').addEventListener('click', () => this.handleInput('a'));
        // 点击屏幕推进
        document.getElementById('top-screen').addEventListener('click', () => this.handleInput('a'));
        document.getElementById('bottom-screen').addEventListener('click', () => this.handleInput('a'));
    }

    handleInput(key) {
        Audio.init();
        Audio.resume();

        switch (this.state) {
            case 'title':
                if (key === 'a' || key === 'Enter' || key === ' ') {
                    this.startPlay();
                }
                break;
            case 'playing':
                if (this.choiceActive) {
                    this.handleChoiceInput(key);
                } else if (key === 'a' || key === 'Enter' || key === ' ') {
                    this.advance();
                }
                break;
            case 'ended':
                if (key === 'a' || key === 'Enter' || key === ' ') {
                    this.restart();
                }
                break;
        }
    }

    handleChoiceInput(key) {
        if (key === 'ArrowUp' || key === 'w') {
            this.choiceIndex = Math.max(0, this.choiceIndex - 1);
            Audio.playSfx('blip');
            this.renderChoices();
        } else if (key === 'ArrowDown' || key === 's') {
            this.choiceIndex = Math.min(this.choices.length - 1, this.choiceIndex + 1);
            Audio.playSfx('blip');
            this.renderChoices();
        } else if (key === 'a' || key === 'Enter' || key === ' ') {
            this.selectChoice();
        }
    }

    // === 游戏流程 ===
    startPlay() {
        const overlay = document.getElementById('title-overlay');
        overlay.classList.add('fade-out');
        setTimeout(() => { overlay.style.display = 'none'; }, 1000);

        Audio.playSfx('transition');
        this.state = 'playing';
        this.actIndex = 0;
        this.startAct(this.acts[0]);
        this.startLoop();
    }

    startAct(actName) {
        this.currentAct = SCRIPT[actName];
        this.currentSceneIndex = 0;

        // 显示幕标题
        this.showActTitle(this.currentAct.title, this.currentAct.subtitle);

        // 播放BGM
        if (this.currentAct.bgm) {
            Audio.playBgm(this.currentAct.bgm);
        }

        // 延迟开始场景
        setTimeout(() => {
            this.hideActTitle();
            this.playScene();
        }, 2500);
    }

    showActTitle(title, subtitle) {
        const el = document.getElementById('act-title');
        el.innerHTML = `${title}<div class="act-sub">${subtitle}</div>`;
        el.classList.remove('hidden');
    }

    hideActTitle() {
        document.getElementById('act-title').classList.add('hidden');
    }

    playScene() {
        const scenes = this.currentAct.scenes;
        if (this.currentSceneIndex >= scenes.length) {
            this.nextAct();
            return;
        }

        const scene = scenes[this.currentSceneIndex];
        this.currentScene = scene;
        this.currentBg = scene.bg || this.currentBg;

        // 播放音效
        if (scene.sfx) {
            Audio.playSfx(scene.sfx);
        }

        // 根据类型处理
        switch (scene.type) {
            case 'narration':
                this.showNarration(scene.text);
                break;
            case 'dialogue':
                this.showDialogue(scene.speaker, scene.text, scene.char, scene.emotion);
                break;
            case 'choice':
                this.showChoice(scene);
                break;
        }
    }

    advance() {
        // 如果打字机未完成，先完成
        if (!this.typewriter.done) {
            this.completeTypewriter();
            return;
        }

        Audio.playSfx('advance');
        this.hideDialogue();
        this.hideNarration();
        this.currentSceneIndex++;
        this.playScene();
    }

    nextAct() {
        this.actIndex++;
        if (this.actIndex >= this.acts.length) {
            this.endPlay();
            return;
        }

        // 转场
        this.doTransition(() => {
            this.startAct(this.acts[this.actIndex]);
        });
    }

    doTransition(callback) {
        this.transition.active = true;
        this.transition.alpha = 0;
        this.transition.direction = 'in';
        this.transition.callback = () => {
            if (callback) callback();
            this.transition.direction = 'out';
        };
        Audio.playSfx('transition');
    }

    endPlay() {
        this.state = 'ended';
        Audio.stopBgm();
        Audio.playSfx('cosmic');
    }

    restart() {
        this.state = 'playing';
        this.actIndex = 0;
        this.doTransition(() => {
            this.startAct(this.acts[0]);
        });
    }

    // === 对话系统 ===
    showDialogue(speaker, text, char, emotion) {
        const box = document.getElementById('dialogue-box');
        const nameEl = document.getElementById('speaker-name');
        const textEl = document.getElementById('dialogue-text');
        const indicator = document.getElementById('dialogue-indicator');

        box.classList.remove('hidden');
        document.getElementById('narration-box').classList.add('hidden');
        indicator.style.display = 'none';

        nameEl.textContent = speaker;
        this.startTypewriter(text, textEl, () => {
            indicator.style.display = 'block';
        });

        // 设置角色精灵标记
        this._currentChar = char;
        this._currentEmotion = emotion;
    }

    showNarration(text) {
        const box = document.getElementById('narration-box');
        const textEl = document.getElementById('narration-text');

        box.classList.remove('hidden');
        document.getElementById('dialogue-box').classList.add('hidden');

        this._currentChar = null;
        this.startTypewriter(text, textEl, null);
    }

    startTypewriter(text, element, onComplete) {
        if (this.typewriter.timer) {
            clearInterval(this.typewriter.timer);
        }
        this.typewriter.text = text;
        this.typewriter.displayed = '';
        this.typewriter.index = 0;
        this.typewriter.done = false;
        this.typewriter.element = element;
        this.typewriter.onComplete = onComplete;

        this.typewriter.timer = setInterval(() => {
            if (this.typewriter.index < this.typewriter.text.length) {
                this.typewriter.displayed += this.typewriter.text[this.typewriter.index];
                this.typewriter.index++;
                element.textContent = this.typewriter.displayed;

                // 打字音效
                if (this.typewriter.index % 3 === 0) {
                    Audio.playSfx('blip');
                }
            } else {
                this.completeTypewriter();
            }
        }, this.typewriter.speed);
    }

    completeTypewriter() {
        if (this.typewriter.timer) {
            clearInterval(this.typewriter.timer);
            this.typewriter.timer = null;
        }
        this.typewriter.displayed = this.typewriter.text;
        this.typewriter.done = true;
        if (this.typewriter.element) {
            this.typewriter.element.textContent = this.typewriter.text;
        }
        if (this.typewriter.onComplete) {
            this.typewriter.onComplete();
        }
    }

    hideDialogue() {
        document.getElementById('dialogue-box').classList.add('hidden');
        document.getElementById('dialogue-indicator').style.display = 'none';
    }

    hideNarration() {
        document.getElementById('narration-box').classList.add('hidden');
    }

    // === 选择系统 ===
    showChoice(scene) {
        this.showNarration(scene.text);
        this.choices = scene.choices;
        this.choiceActive = true;
        this.choiceIndex = 0;
        this._currentChar = scene.char;
        this._currentEmotion = scene.emotion;

        setTimeout(() => {
            this.renderChoices();
            document.getElementById('choices-box').classList.remove('hidden');
        }, 1500);
    }

    renderChoices() {
        const box = document.getElementById('choices-box');
        box.innerHTML = '';
        this.choices.forEach((choice, i) => {
            const item = document.createElement('div');
            item.className = 'choice-item' + (i === this.choiceIndex ? ' selected' : '');
            item.textContent = choice.text;
            item.addEventListener('click', () => {
                this.choiceIndex = i;
                this.selectChoice();
            });
            box.appendChild(item);
        });
    }

    selectChoice() {
        Audio.playSfx('advance');
        this.choiceActive = false;
        document.getElementById('choices-box').classList.add('hidden');
        this.hideNarration();

        const choice = this.choices[this.choiceIndex];
        // 跳转到对应场景
        const scenes = this.currentAct.scenes;
        const targetIdx = scenes.findIndex(s => s.id === choice.next);
        if (targetIdx >= 0) {
            this.currentSceneIndex = targetIdx;
        } else {
            this.currentSceneIndex++;
        }
        this.playScene();
    }

    // === 渲染循环 ===
    startLoop() {
        const loop = (time) => {
            this.update(time);
            this.render();
            this.animFrame = requestAnimationFrame(loop);
        };
        this.animFrame = requestAnimationFrame(loop);
    }

    update(time) {
        const dt = time - this.lastTime;
        this.lastTime = time;

        // 转场更新
        if (this.transition.active) {
            if (this.transition.direction === 'in') {
                this.transition.alpha += 0.03;
                if (this.transition.alpha >= 1) {
                    this.transition.alpha = 1;
                    if (this.transition.callback) {
                        this.transition.callback();
                        this.transition.callback = null;
                    }
                }
            } else {
                this.transition.alpha -= 0.03;
                if (this.transition.alpha <= 0) {
                    this.transition.alpha = 0;
                    this.transition.active = false;
                }
            }
        }
    }

    render() {
        const r = this.renderer;

        // 上屏 - 舞台
        r.drawBackground(this.currentBg);

        // 角色
        if (this._currentChar && this.state === 'playing') {
            r.drawCharacter(this._currentChar, 100, 80, this._currentEmotion || 'normal');
        }

        // 特效
        if (this.currentScene && this.currentScene.effect === 'signal_wave') {
            r.drawSignalWave(128, 60);
        }
        if (this.currentScene && this.currentScene.effect === 'fire') {
            if (Math.random() > 0.7) {
                r.addParticle(Math.random() * 256, 150, 'fire');
            }
        }
        r.updateParticles();

        // 下屏 - UI背景
        this.renderUI();

        // 转场遮罩
        if (this.transition.active) {
            r.ctx.fillStyle = `rgba(0,0,0,${this.transition.alpha})`;
            r.ctx.fillRect(0, 0, r.W, r.H);
            this.uiCtx.fillStyle = `rgba(0,0,0,${this.transition.alpha})`;
            this.uiCtx.fillRect(0, 0, 256, 192);
        }
    }

    renderUI() {
        const ctx = this.uiCtx;
        // 深色背景
        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(0, 0, 256, 192);

        // 装饰边框
        ctx.strokeStyle = '#223';
        ctx.strokeRect(4, 4, 248, 184);

        // 顶部装饰线
        ctx.fillStyle = '#1a2a4a';
        ctx.fillRect(8, 8, 240, 2);

        // 底部信息
        if (this.currentAct) {
            ctx.fillStyle = '#334';
            ctx.font = '8px monospace';
            ctx.fillText(this.currentAct.title + ' - ' + this.currentAct.subtitle, 10, 186);
        }

        // 进度指示
        if (this.currentAct) {
            const total = this.currentAct.scenes.length;
            const current = this.currentSceneIndex;
            const barW = 60;
            const progress = total > 0 ? current / total : 0;
            ctx.fillStyle = '#222';
            ctx.fillRect(186, 180, barW, 4);
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(186, 180, barW * progress, 4);
        }
    }
}
