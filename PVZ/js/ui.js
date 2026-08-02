// DOM 界面层：主菜单、关卡选择、暂停面板、结算
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
      PVZ.config.LEVEL_LIST.forEach((lv, i) => {
        const btn = document.createElement('button');
        const unlocked = PVZ.save.isUnlocked(i);
        btn.className = 'level' + (unlocked ? '' : ' locked');
        btn.textContent = unlocked ? lv.name : lv.name + '（未解锁）';
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
    }
  };
})();
