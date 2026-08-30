/**
 * 最后的守塔人 - 核心引擎
 * 负责：渲染循环、对话系统、场景管理、动画控制、转场效果
 */

class StageEngine {
    constructor(canvas, script, audio) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.script = script;
        this.audio = audio;

        // 状态
        this.state = 'title'; // title | acting | transition | epilogue | end
        this.currentAct = 0;
        this.currentLine = 0;
        this.time = 0;
        this.autoPlay = false;
        this.autoTimer = null;

        // 对话系统
        this.dialogueQueue = '';
        this.dialogueDisplayed = '';
        this.dialogueIndex = 0;
        this.typingSpeed = 60; // ms per char
        this.lastTypeTime = 0;
        this.dialogueComplete = false;

        // 动画状态
        this.sceneState = {
            lit: false,
            lightAngle: 0,
            keeperVisible: false,
            keeperX: 320,
            keeperY: 250,
            keeperFrame: 'idle',
            boatVisible: false,
            boatX: -30,
            lightning: 0,
            rainIntensity: 0,
            cloudDark: false,
            starsAlpha: 0,
            flashback: 0,
            transitionAlpha: 0,
            transitionDir: 0 // 0=none, 1=fade out, -1=fade in
        };

        // 转场
        this.transitionCallback = null;

        // DOM 元素
        this.el = {
            dialogueBox: document.getElementById('dialogue-box'),
            speakerName: document.getElementById('speaker-name'),
            dialogueText: document.getElementById('dialogue-text'),
            indicator: document.getElementById('dialogue-indicator'),
            actTitle: document.getElementById('act-title'),
            actNumber: document.querySelector('.act-number'),
            actName: document.querySelector('.act-name'),
            controls: document.getElementById('controls'),
            progressBar: document.getElementById('progress-bar'),
            progressFill: document.getElementById('progress-fill')
        };

        // 绑定
        this.render = this.render.bind(this);
        this.lastFrameTime = 0;
    }

    // ===== 启动 =====
    start(autoPlay = false) {
        this.autoPlay = autoPlay;
        this.state = 'acting';
        this.el.controls.classList.remove('hidden');
        this.el.progressBar.classList.remove('hidden');
        this.audio.init();
        this.audio.resume();
        this.showActTitle(0);
    }

    // ===== 幕间标题 =====
    showActTitle(actIndex) {
        const act = this.script.acts[actIndex];
        this.state = 'transition';
        this.el.actTitle.classList.remove('hidden');
        this.el.actNumber.textContent = act.number;
        this.el.actName.textContent = act.name;
        this.audio.playTransition();

        setTimeout(() => {
            this.el.actTitle.classList.add('show');
        }, 50);

        setTimeout(() => {
            this.el.actTitle.classList.remove('show');
            setTimeout(() => {
                this.el.actTitle.classList.add('hidden');
                this.beginAct(actIndex);
            }, 800);
        }, 2500);
    }

    // ===== 开始一幕 =====
    beginAct(actIndex) {
        this.currentAct = actIndex;
        this.currentLine = 0;
        this.state = 'acting';

        const act = this.script.acts[actIndex];
        this.setupScene(act.scene);
        this.audio.setSceneAmbient(act.scene);
        this.showLine();
    }

    // ===== 场景初始化 =====
    setupScene(scene) {
        const s = this.sceneState;
        switch (scene) {
            case 'sunset':
                s.lit = false;
                s.keeperVisible = false;
                s.starsAlpha = 0.2;
                s.rainIntensity = 0;
                s.cloudDark = false;
                s.boatVisible = false;
                break;
            case 'storm':
                s.lit = true;
                s.keeperVisible = true;
                s.starsAlpha = 0;
                s.rainIntensity = 0.8;
                s.cloudDark = true;
                break;
            case 'night':
                s.lit = true;
                s.keeperVisible = true;
                s.starsAlpha = 0.8;
                s.rainIntensity = 0;
                s.cloudDark = false;
                break;
            case 'dawn':
                s.lit = true;
                s.keeperVisible = true;
                s.starsAlpha = 0.3;
                s.rainIntensity = 0;
                s.cloudDark = false;
                s.boatVisible = false;
                break;
        }
    }

    // ===== 显示对话行 =====
    showLine() {
        const act = this.script.acts[this.currentAct];
        if (this.currentLine >= act.lines.length) {
            this.nextAct();
            return;
        }

        const line = act.lines[this.currentLine];
        const char = this.script.characters[line.speaker];

        // 设置说话者
        this.el.speakerName.textContent = char.name;
        this.el.speakerName.style.color = char.color;

        // 开始打字
        this.dialogueQueue = line.text;
        this.dialogueDisplayed = '';
        this.dialogueIndex = 0;
        this.dialogueComplete = false;
        this.el.dialogueBox.classList.remove('hidden');
        this.el.indicator.style.display = 'none';

        // 执行动作
        this.executeAction(line.action);
        this.updateProgress();
    }

    // ===== 打字机效果 =====
    updateTyping(timestamp) {
        if (this.dialogueComplete) return;
        if (timestamp - this.lastTypeTime < this.typingSpeed) return;

        this.lastTypeTime = timestamp;
        if (this.dialogueIndex < this.dialogueQueue.length) {
            this.dialogueDisplayed += this.dialogueQueue[this.dialogueIndex];
            this.dialogueIndex++;
            this.el.dialogueText.textContent = this.dialogueDisplayed;
            // 打字音
            if (this.dialogueIndex % 3 === 0) {
                this.audio.playType();
            }
        } else {
            this.dialogueComplete = true;
            this.el.indicator.style.display = 'block';
            if (this.autoPlay) {
                this.scheduleAutoNext();
            }
        }
    }

    // ===== 下一句 =====
    next() {
        if (this.state !== 'acting') return;

        if (!this.dialogueComplete) {
            // 跳过打字，直接显示全部
            this.dialogueDisplayed = this.dialogueQueue;
            this.dialogueIndex = this.dialogueQueue.length;
            this.dialogueComplete = true;
            this.el.dialogueText.textContent = this.dialogueDisplayed;
            this.el.indicator.style.display = 'block';
            if (this.autoPlay) {
                this.scheduleAutoNext();
            }
            return;
        }

        this.clearAutoTimer();
        this.currentLine++;
        this.showLine();
    }

    // ===== 上一句 =====
    prev() {
        if (this.state !== 'acting') return;
        if (this.currentLine > 0) {
            this.clearAutoTimer();
            this.currentLine--;
            this.showLine();
        }
    }

    // ===== 下一幕 =====
    nextAct() {
        this.currentAct++;
        if (this.currentAct >= this.script.acts.length) {
            this.showEpilogue();
        } else {
            this.el.dialogueBox.classList.add('hidden');
            this.showActTitle(this.currentAct);
        }
    }

    // ===== 尾声 =====
    showEpilogue() {
        this.state = 'epilogue';
        this.el.dialogueBox.classList.add('hidden');
        this.audio.stopAmbient();
        this.audio.playEnding();

        this.el.actTitle.classList.remove('hidden');
        this.el.actNumber.textContent = this.script.epilogue.text;
        this.el.actName.textContent = this.script.epilogue.subtext;
        setTimeout(() => this.el.actTitle.classList.add('show'), 50);

        setTimeout(() => {
            this.state = 'end';
        }, 6000);
    }

    // ===== 自动播放 =====
    scheduleAutoNext() {
        this.clearAutoTimer();
        const delay = Math.max(2000, this.dialogueQueue.length * 120);
        this.autoTimer = setTimeout(() => this.next(), delay);
    }

    clearAutoTimer() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
    }

    toggleAuto() {
        this.autoPlay = !this.autoPlay;
        if (this.autoPlay && this.dialogueComplete) {
            this.scheduleAutoNext();
        } else {
            this.clearAutoTimer();
        }
        return this.autoPlay;
    }

    // ===== 进度 =====
    updateProgress() {
        const act = this.script.acts[this.currentAct];
        const totalLines = this.script.acts.reduce((s, a) => s + a.lines.length, 0);
        let doneLines = 0;
        for (let i = 0; i < this.currentAct; i++) {
            doneLines += this.script.acts[i].lines.length;
        }
        doneLines += this.currentLine;
        const pct = (doneLines / totalLines) * 100;
        this.el.progressFill.style.width = pct + '%';
    }

    // ===== 动作执行 =====
    executeAction(action) {
        const s = this.sceneState;
        switch (action) {
            case 'fade_in_keeper':
                s.keeperVisible = true;
                break;
            case 'light_on':
                s.lit = true;
                this.audio.playLightOn();
                break;
            case 'keeper_sigh':
            case 'look_up':
                s.keeperFrame = 'look_up';
                setTimeout(() => s.keeperFrame = 'idle', 2000);
                break;
            case 'touch_lamp':
                s.keeperFrame = 'wave';
                setTimeout(() => s.keeperFrame = 'idle', 2000);
                break;
            case 'wave_sound':
                this.audio.playHorn();
                break;
            case 'darken':
                s.cloudDark = true;
                s.starsAlpha = 0;
                break;
            case 'waves_intense':
                s.rainIntensity = 1.0;
                break;
            case 'flashback_start':
                s.flashback = 1;
                break;
            case 'radio_static':
                this.audio.playRadioStatic();
                break;
            case 'memory_fade':
                s.flashback = 0;
                break;
            case 'lightning':
                s.lightning = 1;
                this.audio.playThunder();
                setTimeout(() => { s.lightning = 0; }, 500);
                break;
            case 'calm':
                s.rainIntensity = 0;
                s.cloudDark = false;
                s.starsAlpha = 0.8;
                s.flashback = 0;
                break;
            case 'letter_read':
                s.flashback = 0.5;
                break;
            case 'letter_keep':
                s.flashback = 0;
                break;
            case 'dawn_break':
                s.starsAlpha = 0.1;
                break;
            case 'boat_appear':
                s.boatVisible = true;
                s.boatX = -30;
                break;
            case 'radio_call':
                this.audio.playRadioStatic();
                break;
            case 'boat_leave':
                s.boatX = 700;
                break;
            case 'final':
                s.keeperVisible = false;
                break;
            case 'hum':
                this.audio.playEnding();
                break;
        }
    }

    // ===== 渲染循环 =====
    render(timestamp) {
        const dt = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;
        this.time += dt;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 清屏
        ctx.clearRect(0, 0, w, h);

        if (this.state === 'title' || this.state === 'end') {
            requestAnimationFrame(this.render);
            return;
        }

        // 获取当前场景
        const scene = this.script.acts[this.currentAct]?.scene || 'night';
        const s = this.sceneState;

        // 绘制天空
        let skyPalette;
        switch (scene) {
            case 'sunset': skyPalette = Sprites.palette.sky_sunset; break;
            case 'storm': skyPalette = Sprites.palette.sky_storm; break;
            case 'night': skyPalette = Sprites.palette.sky_night; break;
            case 'dawn': skyPalette = Sprites.palette.sky_dawn; break;
            default: skyPalette = Sprites.palette.sky_night;
        }
        Sprites.drawSky(ctx, w, h, skyPalette, this.time);

        // 星星
        if (s.starsAlpha > 0) {
            Sprites.drawStars(ctx, w, h, this.time, 30, s.starsAlpha);
        }

        // 云
        if (scene === 'storm' || s.cloudDark) {
            Sprites.drawClouds(ctx, w, h, this.time, true);
        } else if (scene === 'sunset' || scene === 'dawn') {
            Sprites.drawClouds(ctx, w, h, this.time, false);
        }

        // 海面
        let seaPalette = scene === 'storm' ? Sprites.palette.sea_storm : Sprites.palette.sea;
        const waveIntensity = scene === 'storm' ? 2.0 : 1.0;
        Sprites.drawSea(ctx, w, h, this.time, seaPalette, waveIntensity);

        // 灯光海面反射
        Sprites.drawLightReflection(ctx, w, h, this.time, s.lit);

        // 礁石
        Sprites.drawRocks(ctx, w, h);

        // 灯塔
        s.lightAngle = this.time * 0.5;
        Sprites.drawLighthouse(ctx, w * 0.5, h * 0.6, this.time, s.lit, s.lightAngle);

        // 守塔人
        if (s.keeperVisible) {
            Sprites.drawKeeper(ctx, s.keeperX, s.keeperY, this.time, s.keeperFrame);
        }

        // 小船
        if (s.boatVisible) {
            if (s.boatX < 150) s.boatX += dt * 15;
            Sprites.drawBoat(ctx, s.boatX, h * 0.63, this.time);
        }

        // 鸟（黄昏/黎明）
        if (scene === 'sunset' || scene === 'dawn') {
            Sprites.drawBirds(ctx, w, h, this.time);
        }

        // 雨
        if (s.rainIntensity > 0) {
            Sprites.drawRain(ctx, w, h, this.time, s.rainIntensity);
        }

        // 闪电
        if (s.lightning > 0) {
            Sprites.drawLightning(ctx, w, h, 1 - s.lightning);
            s.lightning -= dt * 2;
        }

        // 回忆滤镜
        if (s.flashback > 0) {
            ctx.fillStyle = `rgba(180, 140, 255, ${s.flashback * 0.08})`;
            ctx.fillRect(0, 0, w, h);
            // 老胶片颗粒
            for (let i = 0; i < 30; i++) {
                const gx = Math.random() * w;
                const gy = Math.random() * h;
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05 * s.flashback})`;
                ctx.fillRect(gx, gy, 1, 1);
            }
        }

        // 暗角
        const vignette = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.8);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        // 打字更新
        this.updateTyping(timestamp);

        requestAnimationFrame(this.render);
    }

    // 启动渲染
    startRender() {
        requestAnimationFrame(this.render);
    }
}
