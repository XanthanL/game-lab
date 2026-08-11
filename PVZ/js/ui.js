// DOM 界面层：主菜单、关卡选择（按世界分组 + 星星）、暂停、结算、移动端触控 dock
(function () {
  'use strict';

  const menuEl = document.getElementById('menu');
  const resultEl = document.getElementById('result');
  const levelSelectEl = document.getElementById('levelSelect');
  const pausePanelEl = document.getElementById('pausePanel');
  const levelBtns = document.getElementById('levelBtns');
  const levelBackBtn = document.getElementById('levelBackBtn');
  const startBtn = document.getElementById('startBtn');
  const resultTitle = document.getElementById('resultTitle');
  const resultMsg = document.getElementById('resultMsg');
  const retryBtn = document.getElementById('retryBtn');
  const nextBtn = document.getElementById('nextBtn');
  const backBtn = document.getElementById('backBtn');

  const resumeBtn = document.getElementById('resumeBtn');
  const speedBtn = document.getElementById('speedBtn');
  const pauseVolume = document.getElementById('pauseVolume');
  const pauseRetryBtn = document.getElementById('pauseRetryBtn');
  const pauseBackBtn = document.getElementById('pauseBackBtn');
  const menuVolume = document.getElementById('menuVolume');

  let dockEl = null;
  let dockCards = {}; // id -> { el, costEl, overlay }

  function bindVolume(input) {
    input.value = Math.round(PVZ.save.getSettings().volume * 100);
    input.addEventListener('input', () => {
      const v = Number(input.value) / 100;
      PVZ.audio.setVolume(v);
      PVZ.save.setVolume(v);
    });
  }

  PVZ.ui = {
    init(opts) {
      startBtn.addEventListener('click', () => {
        menuEl.classList.add('hidden');
        PVZ.audio.play('click');
        if (opts.onStart) opts.onStart();
      });
      bindVolume(menuVolume);
    },

    showMenu() {
      resultEl.classList.add('hidden');
      levelSelectEl.classList.add('hidden');
      pausePanelEl.classList.add('hidden');
      menuEl.classList.remove('hidden');
    },

    showLevelSelect(onPick, onBack) {
      PVZ.audio.play('click');
      menuEl.classList.add('hidden');
      pausePanelEl.classList.add('hidden');
      levelSelectEl.classList.remove('hidden');

      levelBackBtn.onclick = () => {
        levelSelectEl.classList.add('hidden');
        if (onBack) onBack();
      };

      levelBtns.innerHTML = '';
      const list = PVZ.config.LEVEL_LIST;
      const worlds = PVZ.config.WORLDS || [];
      let lastWorld = null;
      list.forEach((lv, i) => {
        if (lv.world !== lastWorld) {
          lastWorld = lv.world;
          const h = document.createElement('div');
          h.className = 'world-title';
          h.textContent = lv.world || '其他';
          levelBtns.appendChild(h);
        }
        const btn = document.createElement('button');
        const unlocked = PVZ.save.isUnlocked(i);
        const cleared = PVZ.save.starOf(i) > 0;
        btn.className = 'level' + (unlocked ? '' : ' locked') + (cleared ? ' cleared' : '');
        btn.textContent = (lv.world ? '' : '') + lv.name + (cleared ? '  ★' : (unlocked ? '' : '（未解锁）'));
        btn.disabled = !unlocked;
        if (unlocked) {
          btn.addEventListener('click', () => {
            PVZ.audio.play('click');
            levelSelectEl.classList.add('hidden');
            onPick(i);
          });
        }
        levelBtns.appendChild(btn);
      });
    },

    showPause(actions) {
      PVZ.audio.play('click');
      pausePanelEl.classList.remove('hidden');
      resumeBtn.onclick = () => {
        pausePanelEl.classList.add('hidden');
        actions.onResume();
      };
      speedBtn.textContent = '速度: ' + actions.speed + 'x';
      speedBtn.onclick = () => {
        pausePanelEl.classList.add('hidden');
        actions.onSpeed();
      };
      pauseRetryBtn.onclick = () => {
        pausePanelEl.classList.add('hidden');
        actions.onRetry();
      };
      pauseBackBtn.onclick = () => {
        pausePanelEl.classList.add('hidden');
        actions.onBack();
      };
      bindVolume(pauseVolume);
    },

    hidePause() {
      pausePanelEl.classList.add('hidden');
    },

    showResult(title, msg, actions) {
      pausePanelEl.classList.add('hidden');
      resultTitle.textContent = title;
      resultTitle.style.color = title.indexOf('胜') >= 0 ? '#8bc34a' : '#ef5350';
      resultMsg.textContent = msg;

      if (actions.next) {
        nextBtn.classList.remove('hidden');
        nextBtn.onclick = () => {
          resultEl.classList.add('hidden');
          actions.next();
        };
      } else {
        nextBtn.classList.add('hidden');
      }

      retryBtn.onclick = () => {
        resultEl.classList.add('hidden');
        actions.retry();
      };
      backBtn.onclick = () => {
        resultEl.classList.add('hidden');
        actions.back();
      };
      resultEl.classList.remove('hidden');
    },

    // ===== 移动端触控 dock =====
    // 由 main.js 在触屏设备开局时调用
    setupTouch(game) {
      if (!dockEl) this._buildDock();
      dockEl.classList.remove('hidden');

      dockCards = {};
      const row = dockEl.querySelector('.dock-cards');
      row.innerHTML = '';
      game.seedBar.cards.forEach(card => {
        const id = card.id;
        const p = PVZ.config.PLANTS[id];
        const el = document.createElement('button');
        el.className = 'dock-card';
        el.type = 'button';

        const ic = document.createElement('canvas');
        ic.width = 56; ic.height = 56;
        ic.className = 'dock-icon';
        const ictx = ic.getContext('2d');
        PVZ.art.drawPlant(ictx, id, 28, 50, 0, 1, 0.62);
        el.appendChild(ic);

        const name = document.createElement('div');
        name.className = 'dock-name';
        name.textContent = p.name;
        el.appendChild(name);

        const cost = document.createElement('div');
        cost.className = 'dock-cost';
        cost.textContent = p.cost;
        el.appendChild(cost);

        const overlay = document.createElement('div');
        overlay.className = 'dock-overlay hidden';
        el.appendChild(overlay);

        el.addEventListener('click', () => {
          if (game.seedBar.select(id)) {
            PVZ.audio.play('click');
            // 更新选中态
            Object.keys(dockCards).forEach(k => dockCards[k].el.classList.remove('sel'));
            if (game.seedBar.selected === id) el.classList.add('sel');
          }
        });

        row.appendChild(el);
        dockCards[id] = { el, costEl: cost, overlay };
      });

      // 铲子
      const shovel = dockEl.querySelector('.dock-shovel');
      shovel.onclick = () => {
        game.shovelMode = !game.shovelMode;
        shovel.classList.toggle('sel', game.shovelMode);
        PVZ.audio.play('click');
      };
      // 暂停
      const pause = dockEl.querySelector('.dock-pause');
      pause.onclick = () => {
        if (PVZ.ui.onDockPauseRef) PVZ.ui.onDockPauseRef();
      };

      this.updateDock(game);
    },

    _buildDock() {
      dockEl = document.createElement('div');
      dockEl.id = 'touchDock';
      dockEl.className = 'hidden';
      dockEl.innerHTML =
        '<div class="dock-cards"></div>' +
        '<div class="dock-tools">' +
        '  <button class="dock-btn dock-shovel" type="button">铲子</button>' +
        '  <button class="dock-btn dock-pause" type="button">暂停</button>' +
        '</div>';
      document.body.appendChild(dockEl);
    },

    updateDock(game) {
      if (!dockEl || dockEl.classList.contains('hidden')) return;
      Object.keys(dockCards).forEach(id => {
        const c = dockCards[id];
        const st = game.seedBar.stateOf(id);
        if (!st) return;
        c.el.classList.toggle('disabled', !st.affordable);
        if (st.cd > 0) {
          c.overlay.classList.remove('hidden');
          c.overlay.style.height = (st.cdFrac * 100) + '%';
          c.overlay.textContent = Math.ceil(st.cd) + 's';
        } else {
          c.overlay.classList.add('hidden');
          c.overlay.textContent = '';
        }
        if (game.seedBar.selected !== id) c.el.classList.remove('sel');
      });
    },

    hideDock() {
      if (dockEl) dockEl.classList.add('hidden');
    },

    // main.js 在触屏开局时赋值，供 dock 暂停按钮调用
    onDockPauseRef: null
  };
})();
