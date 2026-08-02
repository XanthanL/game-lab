// 入口：画布初始化、主循环（rAF）、场景切换、输入绑定
(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const cfg = PVZ.config;

  canvas.width = cfg.canvasWidth;
  canvas.height = cfg.canvasHeight;

  let scene = null;
  let lastTime = 0;
  let currentLevel = 0;

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
        PVZ.ui.showResult('胜利！', PVZ.config.LEVEL_LIST[levelIdx].name + ' 通关！', {
          retry: () => startGame(levelIdx),
          back: toMenu,
          next: hasNext ? () => startGame(levelIdx + 1) : null
        });
      },
      onLose: () => {
        PVZ.audio.stopBGM();
        PVZ.audio.play('lose');
        PVZ.ui.showResult('失败！', '僵尸闯进了你的房子', {
          retry: () => startGame(levelIdx),
          back: toMenu
        });
      }
    });
  }

  function toMenu() {
    scene = null;
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
      if (!scene.paused) scene.update(dt * (scene.timeScale || 1));
      scene.render(ctx);
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
    if (scene && scene.seedBar) scene.seedBar.selected = null;
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
