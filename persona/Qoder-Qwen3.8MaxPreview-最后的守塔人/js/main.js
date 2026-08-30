/**
 * 最后的守塔人 - 入口初始化
 * 负责：初始化引擎、绑定事件、启动渲染
 */

(function () {
    'use strict';

    // 初始化音频引擎
    const audio = new AudioEngine();

    // 初始化舞台引擎
    const canvas = document.getElementById('stage-canvas');
    const engine = new StageEngine(canvas, SCRIPT, audio);

    // DOM 元素
    const titleScreen = document.getElementById('title-screen');
    const btnStart = document.getElementById('btn-start');
    const btnAuto = document.getElementById('btn-auto');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnAutoToggle = document.getElementById('btn-auto-toggle');
    const btnSound = document.getElementById('btn-sound');

    // ===== 标题画面动画背景 =====
    function animateTitle() {
        if (engine.state !== 'title') return;
        const ctx = engine.ctx;
        const w = canvas.width;
        const h = canvas.height;
        const t = performance.now() / 1000;

        ctx.clearRect(0, 0, w, h);

        // 夜空
        Sprites.drawSky(ctx, w, h, Sprites.palette.sky_night, t);
        Sprites.drawStars(ctx, w, h, t, 40, 0.6);
        Sprites.drawSea(ctx, w, h, t, Sprites.palette.sea, 0.5);
        Sprites.drawRocks(ctx, w, h);
        Sprites.drawLighthouse(ctx, w * 0.5, h * 0.6, t, true, t * 0.3);
        Sprites.drawLightReflection(ctx, w, h, t, true);

        // 暗角
        const vignette = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.7);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        requestAnimationFrame(animateTitle);
    }

    // ===== 开始演出 =====
    function startShow(autoPlay = false) {
        audio.init();
        audio.resume();

        titleScreen.classList.add('fade-out');
        setTimeout(() => {
            titleScreen.style.display = 'none';
            engine.start(autoPlay);
            engine.startRender();
            if (autoPlay) {
                btnAutoToggle.classList.add('active');
            }
        }, 1000);
    }

    // ===== 事件绑定 =====
    btnStart.addEventListener('click', () => startShow(false));
    btnAuto.addEventListener('click', () => startShow(true));

    btnNext.addEventListener('click', () => engine.next());
    btnPrev.addEventListener('click', () => engine.prev());

    btnAutoToggle.addEventListener('click', () => {
        const isAuto = engine.toggleAuto();
        btnAutoToggle.classList.toggle('active', isAuto);
        btnAutoToggle.textContent = isAuto ? '⏸' : '⏵';
    });

    btnSound.addEventListener('click', () => {
        const enabled = audio.toggle();
        btnSound.classList.toggle('active', enabled);
        btnSound.textContent = enabled ? '♪' : '✕';
    });

    // 键盘控制
    document.addEventListener('keydown', (e) => {
        if (engine.state === 'title') {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startShow(false);
            }
            return;
        }

        switch (e.key) {
            case ' ':
            case 'Enter':
            case 'ArrowRight':
                e.preventDefault();
                engine.next();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                engine.prev();
                break;
            case 'a':
            case 'A':
                const isAuto = engine.toggleAuto();
                btnAutoToggle.classList.toggle('active', isAuto);
                btnAutoToggle.textContent = isAuto ? '⏸' : '⏵';
                break;
            case 'm':
            case 'M':
                const enabled = audio.toggle();
                btnSound.classList.toggle('active', enabled);
                btnSound.textContent = enabled ? '♪' : '✕';
                break;
        }
    });

    // 点击画布推进对话
    canvas.addEventListener('click', () => {
        if (engine.state === 'acting') {
            engine.next();
        }
    });

    // ===== 启动标题动画 =====
    animateTitle();

})();
