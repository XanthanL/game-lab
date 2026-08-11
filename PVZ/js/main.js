// 入口：画布初始化、响应式缩放、主循环（rAF）、场景切换、输入绑定
(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const cfg = PVZ.config;

  const view = { scale: 1, dpr: 1 };

  // 触屏设备：使用 DOM 卡片 dock（更大触控目标），隐藏画布内卡片栏
  const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);

  function fitCanvas() {
    // 决定渲染模式：手机竖屏 -> portrait；?mode=portrait|landscape 可强制覆盖（便于桌面调试）
    const params = new URLSearchParams(window.location.search || '');
    const force = params.get('mode');
    const portrait = force === 'portrait' ||
      (force !== 'landscape' && isTouch && window.innerHeight > window.innerWidth);
    const mode = portrait ? 'portrait' : 'landscape';
    if (PVZ.config._mode !== mode) {
      PVZ.config._mode = mode;
      // 模式翻转且已在游戏中（未结束）-> 用新布局重开当前关，避免坐标错乱
      if (scene && !scene.over && typeof currentLevel === 'number') {
        startGame(currentLevel);
      }
    }

    const dpr = window.devicePixelRatio || 1;
    const margin = 8;
    // 触屏设备为底部卡片 dock 预留空间，避免遮挡最下方草坪
    const reserve = isTouch ? 108 : 0;
    const DW = cfg.canvasWidth, DH = cfg.canvasHeight;
    const availW = Math.max(200, window.innerWidth - margin * 2);
    const availH = Math.max(200, window.innerHeight - margin * 2 - reserve);
    let scale = Math.min(availW / DW, availH / DH);
    scale = Math.min(scale, 2.2); // 上限，避免 4K 屏过分放大
    const cssW = Math.round(DW * scale);
    const cssH = Math.round(DH * scale);

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    view.scale = scale;
    view.dpr = dpr;

    // 竖屏现已原生支持，旋转提示遮罩始终保持隐藏（仅保留元素以统一样式）
    const rotate = document.getElementById('rotateHint');
    if (rotate) rotate.classList.add('hidden');
  }

  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);

  canvas.width = cfg.canvasWidth;
  canvas.height = cfg.canvasHeight;

  let scene = null;
  let lastTime = 0;
  let currentLevel = 0;
  let dockActive = false;
  let dockTimer = 0;

  fitCanvas(); // 变量声明后再调用，避免竖屏初始化时引用 TDZ 变量

  function startGame(levelIdx) {
    PVZ.audio.init();
    PVZ.audio.startBGM();
    currentLevel = levelIdx;

    scene = new PVZ.Game({
      levelId: levelIdx,
      onPause: showPausePanel,
      onWin: () => {
        PVZ.audio.stopBGM();
        PVZ.audio.play('win');
        PVZ.save.markCleared(levelIdx);
        const hasNext = levelIdx + 1 < PVZ.config.LEVEL_LIST.length;
        if (dockActive) PVZ.ui.hideDock();
        PVZ.ui.showResult('胜利！', PVZ.config.LEVEL_LIST[levelIdx].name + ' 通关！', {
          retry: () => startGame(levelIdx),
          back: toMenu,
          next: hasNext ? () => startGame(levelIdx + 1) : null
        });
      },
      onLose: () => {
        PVZ.audio.stopBGM();
        PVZ.audio.play('lose');
        if (dockActive) PVZ.ui.hideDock();
        PVZ.ui.showResult('失败！', '僵尸闯进了你的房子', {
          retry: () => startGame(levelIdx),
          back: toMenu
        });
      }
    });

    if (isTouch) {
      scene.useDomDock = true;
      PVZ.ui.onDockPauseRef = showPausePanel;
      PVZ.ui.setupTouch(scene);
      dockActive = true;
    }
  }

  function toMenu() {
    scene = null;
    dockActive = false;
    PVZ.ui.hideDock();
    PVZ.ui.showMenu();
  }

  function openLevelSelect() {
    PVZ.ui.showLevelSelect(startGame, toMenu);
  }

  function togglePause() {
    if (!scene || scene.over) return;
    if (scene.paused) {
      scene.paused = false;
      PVZ.ui.hidePause();
    } else {
      scene.paused = true;
      showPausePanel();
    }
  }

  function showPausePanel() {
    if (!scene || scene.over) return;
    scene.paused = true;
    PVZ.ui.showPause({
      speed: scene.timeScale,
      onResume() {
        scene.paused = false;
      },
      onSpeed() {
        scene.cycleSpeed();
        showPausePanel();
      },
      onRetry() {
        startGame(currentLevel);
      },
      onBack() {
        toMenu();
      }
    });
  }

  function frame(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (scene) {
      if (!scene.paused) {
        scene.update(dt * (scene.timeScale || 1));
        PVZ.anim.update(dt * (scene.timeScale || 1)); // 驱动弹性入场/闪光等瞬时动画
      }
      // 应用响应式变换：设计坐标 -> 设备像素（保持清晰）
      ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, 0, 0);
      scene.render(ctx);
      if (dockActive) {
        dockTimer -= dt;
        if (dockTimer <= 0) {
          dockTimer = 0.15;
          PVZ.ui.updateDock(scene);
        }
      }
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    requestAnimationFrame(frame);
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (cfg.canvasWidth / rect.width),
      y: (e.clientY - rect.top) * (cfg.canvasHeight / rect.height)
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2 || !scene || scene.over) return;
    const p = canvasPos(e);
    scene.onPointerDown(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!scene || scene.over) return;
    const p = canvasPos(e);
    scene.onPointerMove(p.x, p.y);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!scene || scene.over) return;
    const p = canvasPos(e);
    scene.onPointerUp(p.x, p.y);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (scene && scene.seedBar) {
      scene.seedBar.selected = null;
      scene.shovelMode = false;
      scene.drag = null;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      togglePause();
    }
  });

  PVZ.ui.init({ onStart: openLevelSelect });
  PVZ.ui.showMenu(); // 启动时显示主菜单

  requestAnimationFrame(frame);
})();
