'use strict';
/* ═══════════════════════════════════════════════
   演出引擎：开机 → 节目单 → 幕次推进 → 打字机台词
   → 上屏像素动画 / 下屏触控节目单与台词，全部由前端驱动
   ═══════════════════════════════════════════════ */
(function () {
  const cv = document.getElementById('stage');
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const W = 256, H = 192;

  const $ = (id) => document.getElementById(id);
  const ui = {
    menu: $('menu'), stage: $('stagePanel'), scriptView: $('scriptView'),
    actName: $('actName'), actCount: $('actCount'), speaker: $('speaker'),
    lineText: $('lineText'), progressBar: $('progressBar'), actList: $('actList'),
    lineBox: $('lineBox'), scriptBody: $('scriptBody'),
    btnPause: $('btnPause'), btnSound: $('btnSound'),
    powerLed: $('powerLed'),
  };

  /* 状态机：boot → menu → play → (end) → menu；script 为浏览模式 */
  const E = {
    mode: 'boot', act: 0, line: 0, t: 0,
    typed: 0, hold: 0, lineT: 0,
    paused: false, muted: false,
    bootT: 0, endT: 0, lastT: performance.now(),
    jumpAct: null, jumpT: 0, jumpLine: -1,
  };
  window.Engine = E;

  const act = () => PLAY.acts[E.act];
  const curLine = () => {
    const a = act();
    return a.lines[Math.min(E.line, a.lines.length - 1)];
  };

  /* ── 台词 ── */
  function resetLine() {
    E.typed = 0; E.hold = 0; E.lineT = 0;
    const l = curLine();
    if (l.fx) Sfx.play(l.fx);
    paintLine();
  }
  function paintLine() {
    const l = curLine();
    ui.actName.textContent = act().no + ' · ' + act().name;
    ui.actCount.textContent = (E.line + 1) + ' / ' + act().lines.length;
    ui.speaker.textContent = l.who;
    ui.speaker.className = l.dir ? 'speaker dir' : 'speaker';
    ui.lineText.textContent = l.text.slice(0, Math.floor(E.typed));
    if (E.typed < l.text.length) {
      const cur = document.createElement('span');
      cur.className = 'cursor';
      ui.lineText.appendChild(cur);
    }
  }
  function nextLine() {
    const a = act();
    if (E.line < a.lines.length - 1) { E.line++; resetLine(); }
    else if (E.act < PLAY.acts.length - 1) { E.act++; E.line = 0; E.t = 0; resetLine(); Sfx.play('chime'); }
    else endShow();
  }
  function prevLine() {
    if (E.line > 0) { E.line--; resetLine(); }
    else if (E.act > 0) { E.act--; E.line = PLAY.acts[E.act].lines.length - 1; E.t = 0; resetLine(); }
  }
  function advance() {
    if (E.mode !== 'play') return;
    const l = curLine();
    if (E.typed < l.text.length) { E.typed = l.text.length; paintLine(); }
    else nextLine();
  }

  /* ── 幕次控制 ── */
  function playAct(i) {
    E.act = i; E.line = 0; E.t = 0; E.paused = false; E.mode = 'play';
    ui.menu.classList.add('hidden');
    ui.scriptView.classList.add('hidden');
    ui.stage.classList.remove('hidden');
    ui.btnPause.textContent = '⏸';
    resetLine();
    Sfx.play('select');
  }
  function prevAct() {
    if (E.act > 0) { E.act--; E.line = 0; E.t = 0; resetLine(); Sfx.play('back'); }
  }
  function nextAct() {
    if (E.act < PLAY.acts.length - 1) { E.act++; E.line = 0; E.t = 0; resetLine(); Sfx.play('select'); }
  }
  function endShow() { E.mode = 'end'; E.endT = 0; Sfx.play('bell'); }
  function toMenu() {
    E.mode = 'menu';
    ui.stage.classList.add('hidden');
    ui.scriptView.classList.add('hidden');
    ui.menu.classList.remove('hidden');
    if (E.jumpAct != null) {
      const ja = E.jumpAct, jt = E.jumpT, jl = E.jumpLine;
      E.jumpAct = null;
      playAct(ja);
      E.t = jt;
      E.line = Math.min(jl, act().lines.length - 1);
      E.typed = jl >= 0 ? 999 : 0;
      E.hold = 0;
      paintLine();
    }
  }
  function showScript() {
    buildScript();
    E.mode = 'script';
    ui.menu.classList.add('hidden');
    ui.scriptView.classList.remove('hidden');
    Sfx.play('select');
  }
  function togglePause() {
    if (E.mode !== 'play') return;
    E.paused = !E.paused;
    ui.btnPause.textContent = E.paused ? '▶' : '⏸';
    Sfx.play('click');
  }
  function toggleMute() {
    E.muted = !E.muted;
    Sfx.setMuted(E.muted);
    ui.btnSound.textContent = E.muted ? '♪̶' : '♪';
    ui.btnSound.classList.toggle('muted', E.muted);
    ui.powerLed.classList.toggle('off', E.muted);
    Sfx.play('click');
  }

  /* ── 上屏渲染 ── */
  function drawBoot() {
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, W, H);
    const a = Math.min(1, E.bootT * 1.4);
    g.globalAlpha = a;
    ptext(g, '·', 128, 92, 12, '#ffe9a8', 'center');
    g.globalAlpha = 1;
    if (E.bootT > 1.2 && ((E.bootT | 0) % 2 === 0)) ptext(g, '点亮中…', 128, 110, 8, '#cfe3ff', 'center');
  }

  function drawOverlayText(str, t, color, size) {
    g.font = 'bold ' + size + "px 'SimSun','Songti SC',serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const pulse = 1 + Math.sin(t * 5) * 0.03;
    g.save();
    g.translate(128, 46);
    g.scale(pulse, pulse);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillText(str, 1, 1);
    g.fillStyle = color;
    g.fillText(str, 0, 0);
    g.restore();
  }

  function drawAct() {
    const a = act();
    const scene = Scene[a.key] || Scene.title;
    scene(g, E.t);
    const l = curLine();
    if (l.overlay && E.typed > 0) drawOverlayText(l.overlay, E.t, l.overlayColor || '#ffe9a8', 22);
  }

  function render(now) {
    const dt = Math.min(0.05, Math.max(0, (now - E.lastT) / 1000));
    E.lastT = now;
    switch (E.mode) {
      case 'boot':
        E.bootT += dt;
        drawBoot();
        if (E.bootT > 2.4) toMenu();
        break;
      case 'menu':
        Scene.title(g, now / 1000);
        break;
      case 'script':
        Scene.title(g, now / 1000);
        break;
      case 'end':
        E.endT += dt;
        Scene.dawn(g, Math.min(34, E.t + E.endT * 0.5));
        if (E.endT > 6) toMenu();
        break;
      case 'play':
        if (!E.paused) {
          E.t += dt;
          E.lineT += dt;
          const l = curLine();
          const dur = PLAY.lineDur(l);
          if (E.typed < l.text.length) {
            E.typed = Math.min(l.text.length, E.typed + dt * 1000 / 40);
          } else {
            E.hold += dt * 1000;
            if (E.hold > dur) nextLine();
          }
        }
        drawAct();
        const a = act();
        ui.progressBar.style.width = Math.min(100, E.t / a.dur * 100) + '%';
        break;
    }
  }

  /* ── 下屏面板构建 ── */
  function buildMenu() {
    ui.actList.innerHTML = '';
    PLAY.acts.forEach((a, i) => {
      const d = document.createElement('div');
      d.className = 'act-item';
      d.innerHTML = '<span class="no">' + a.no + '</span>' +
        '<span class="nm">' + a.name + '</span>' +
        '<span class="tm">' + a.dur + 's</span>';
      d.addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); playAct(i); });
      ui.actList.appendChild(d);
    });
  }
  function buildScript() {
    let html = '';
    PLAY.acts.forEach((a) => {
      html += '<div class="act-h">── ' + a.no + ' · ' + a.name + ' ──</div>\n';
      a.lines.forEach((l) => {
        if (l.dir) html += '<span class="sd">〔' + l.who + '〕' + l.text + '</span>\n';
        else html += '<span class="sp">' + l.who + '</span>：' + l.text + '\n';
      });
      html += '\n';
    });
    ui.scriptBody.innerHTML = html;
  }

  /* ── 输入 ── */
  function onKey(ev) {
    Sfx.init();
    switch (ev.key) {
      case ' ': case 'Enter':
        ev.preventDefault();
        if (E.mode === 'boot') { E.bootT = 10; } else advance();
        break;
      case 'ArrowLeft': prevAct(); break;
      case 'ArrowRight': nextAct(); break;
      case 'p': case 'P': togglePause(); break;
      case 'm': case 'M': toggleMute(); break;
      case 'Escape': toMenu(); break;
      case 's': case 'S': showScript(); break;
    }
  }

  function bind() {
    cv.addEventListener('click', () => {
      Sfx.init();
      if (E.mode === 'boot') E.bootT = 10;
      else if (E.mode === 'play') advance();
    });
    ui.lineBox.addEventListener('click', () => {
      Sfx.init();
      if (E.mode === 'play') advance();
    });
    $('btnStart').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); playAct(0); });
    $('btnScript').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); showScript(); });
    $('btnBack').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); toMenu(); });
    $('btnMenu').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); toMenu(); });
    $('btnPause').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); togglePause(); });
    $('btnPrev').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); prevAct(); });
    $('btnNext').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); nextAct(); });
    $('btnSound').addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.init(); toggleMute(); });
    document.addEventListener('keydown', onKey);
  }

  /* ── 启动（支持深链 ?act=2&t=12&line=3）── */
  function readParams() {
    try {
      const p = new URLSearchParams(location.search);
      const a = parseInt(p.get('act'), 10);
      if (!isNaN(a) && a >= 0 && a < PLAY.acts.length) {
        E.jumpAct = a;
        E.jumpT = parseFloat(p.get('t'));
        if (isNaN(E.jumpT)) E.jumpT = 6;
        E.jumpLine = parseInt(p.get('line'), 10);
        if (isNaN(E.jumpLine)) E.jumpLine = 0;
      }
    } catch (e) { /* 忽略非法参数 */ }
  }

  buildMenu();
  bind();
  readParams();
  requestAnimationFrame(function loop(now) {
    render(now);
    requestAnimationFrame(loop);
  });
})();
