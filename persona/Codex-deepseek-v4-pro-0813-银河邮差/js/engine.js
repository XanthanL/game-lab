(function () {
  'use strict';

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var state = {
    act: 0,
    cue: 0,
    time: 0,
    actTime: 0,
    paused: false,
    sound: true,
    started: false,
    menu: true,
    tab: 'program',
    typed: '',
    typedIndex: 0,
    typedDone: true,
    _last: undefined
  };

  var els = {};
  ['stage', 'program', 'dialog', 'script', 'dialog-scene', 'dialog-speaker', 'dialog-text',
    'btn-prev', 'btn-play', 'btn-sound', 'btn-menu', 'btn-script', 'btn-next'
  ].forEach(function (id) {
    els[id] = document.getElementById(id);
  });

  function act() { return SCRIPT.acts[state.act]; }
  function cue() { return act().cues[state.cue]; }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildProgram() {
    els.program.innerHTML = '';
    SCRIPT.acts.forEach(function (a, i) {
      var btn = document.createElement('button');
      btn.className = 'program-item' + (i === state.act && !state.menu ? ' is-current' : '');
      btn.setAttribute('data-act', i);
      var name = document.createElement('span');
      name.className = 'p-name';
      name.textContent = a.name + ' · ' + a.title;
      var setting = document.createElement('span');
      setting.className = 'p-setting';
      setting.textContent = a.setting;
      btn.appendChild(name);
      btn.appendChild(setting);
      btn.addEventListener('click', function () { goAct(i); });
      els.program.appendChild(btn);
    });
  }

  function buildScript() {
    els.script.innerHTML = '';
    SCRIPT.acts.forEach(function (a) {
      var h = document.createElement('h3');
      h.textContent = a.name + ' · ' + a.title + '（' + a.setting + '）';
      els.script.appendChild(h);
      a.cues.forEach(function (cu) {
        var p = document.createElement('p');
        if (cu.t === 'stage') {
          p.className = 's-stage';
          p.textContent = '（' + cu.text + '）';
        } else {
          p.className = 's-line';
          p.innerHTML = '<span class="s-who">' + escapeHtml(cu.who) + '：</span>' + escapeHtml(cu.text);
        }
        els.script.appendChild(p);
      });
    });
  }

  function setTab(name) {
    state.tab = name;
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-pane').forEach(function (p) {
      p.classList.toggle('is-active', p.id === name);
    });
  }

  function startCue() {
    var cu = cue();
    state.typed = cu.text;
    state.typedIndex = 0;
    state.typedDone = false;
    if (cu.fx) AudioFX.play(cu.fx);
    renderDialog();
  }

  function completeTypewriter() {
    state.typedIndex = Array.from(state.typed).length;
    state.typedDone = true;
    renderDialog();
  }

  function updateTypewriter(dt) {
    if (state.typedDone) return;
    var chars = Array.from(state.typed);
    state.typedIndex += dt * 22;
    if (state.typedIndex >= chars.length) {
      state.typedIndex = chars.length;
      state.typedDone = true;
    }
    renderDialog();
  }

  function renderDialog() {
    if (state.menu || !state.started) {
      els['dialog-scene'].textContent = '节目单';
      els['dialog-speaker'].textContent = '请选择一幕开演';
      els['dialog-text'].textContent = '点击上方节目单，或按 → 开始。';
      els['dialog-text'].className = 'dialog-text is-stage';
      return;
    }
    var a = act();
    var cu = cue();
    els['dialog-scene'].textContent = a.name + ' · ' + a.title + ' · ' + a.setting;
    if (cu.t === 'stage') {
      els['dialog-speaker'].textContent = '舞台指示';
      els['dialog-text'].className = 'dialog-text is-stage';
    } else {
      els['dialog-speaker'].textContent = cu.who;
      els['dialog-text'].className = 'dialog-text';
    }
    var chars = Array.from(state.typed);
    els['dialog-text'].textContent = chars.slice(0, Math.floor(state.typedIndex)).join('');
  }

  function goAct(i) {
    i = Math.max(0, Math.min(SCRIPT.acts.length - 1, i));
    state.act = i;
    state.cue = 0;
    state.actTime = 0;
    state.started = true;
    state.menu = false;
    state.paused = false;
    updatePlayButton();
    setTab('dialog');
    buildProgram();
    startCue();
  }

  function advance() {
    firstInteract();
    if (state.menu) {
      goAct(0);
      return;
    }
    if (!state.typedDone) {
      completeTypewriter();
      return;
    }
    if (state.cue < act().cues.length - 1) {
      state.cue += 1;
      startCue();
    } else if (state.act < SCRIPT.acts.length - 1) {
      goAct(state.act + 1);
    } else {
      goMenu();
    }
  }

  function goMenu() {
    state.menu = true;
    state.started = false;
    state.paused = false;
    updatePlayButton();
    setTab('program');
    buildProgram();
    renderDialog();
  }

  function prevAct() {
    goAct(Math.max(0, state.act - 1));
  }

  function nextAct() {
    if (state.act < SCRIPT.acts.length - 1) goAct(state.act + 1);
  }

  function togglePause() {
    if (state.menu) return;
    state.paused = !state.paused;
    updatePlayButton();
  }

  function updatePlayButton() {
    els['btn-play'].textContent = state.paused ? '▶' : '⏸';
  }

  function toggleSound() {
    state.sound = !state.sound;
    AudioFX.setEnabled(state.sound);
    els['btn-sound'].classList.toggle('muted', !state.sound);
  }

  function firstInteract() {
    AudioFX.startMusic();
  }

  function loop(ts) {
    if (state._last === undefined) state._last = ts;
    var dt = (ts - state._last) / 1000;
    state._last = ts;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    state.time += dt;
    if (!state.paused) {
      state.actTime += dt;
      updateTypewriter(dt);
    }
    if (state.menu) Scenes.drawTitle(ctx, state.time);
    else Scenes.draw(ctx, state);
    requestAnimationFrame(loop);
  }

  function bind() {
    els['btn-prev'].addEventListener('click', prevAct);
    els['btn-next'].addEventListener('click', nextAct);
    els['btn-play'].addEventListener('click', togglePause);
    els['btn-sound'].addEventListener('click', toggleSound);
    els['btn-menu'].addEventListener('click', goMenu);
    els['btn-script'].addEventListener('click', function () { setTab('script'); });
    els.stage.addEventListener('click', advance);

    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); advance(); }
      else if (e.key === ' ') { e.preventDefault(); togglePause(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevAct(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextAct(); }
      else if (e.key === 'Escape') { goMenu(); }
      else if (e.key === 'm' || e.key === 'M') { toggleSound(); }
      else if (e.key === 's' || e.key === 'S') { setTab('script'); }
    });
  }

  function parseQuery() {
    var q = {};
    var s = (typeof location !== 'undefined' && location.search) ? location.search.replace(/^\?/, '') : '';
    if (!s) return q;
    s.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      q[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
    });
    return q;
  }

  buildProgram();
  buildScript();
  setTab('program');
  renderDialog();
  bind();

  var q = parseQuery();
  if (q.start === '1' || q.menu === '0' || q.act !== undefined) {
    var actIndex = parseInt(q.act || '0', 10);
    if (isNaN(actIndex)) actIndex = 0;
    goAct(actIndex);
    if (q.cue !== undefined) {
      var cueIndex = parseInt(q.cue, 10);
      if (!isNaN(cueIndex)) {
        state.cue = Math.max(0, Math.min(act().cues.length - 1, cueIndex));
        startCue();
      }
    }
  }

  requestAnimationFrame(loop);
})();
