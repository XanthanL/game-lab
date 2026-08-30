/* ============================================================
   三体 · 像素歌剧 — 演出总控
   ============================================================ */

const $ = id => document.getElementById(id);
const stage = new Stage($('stage'));
const fx = new FX();
const audio = window.AUDIO;

let sig = { aborted: false };
let current = 0;
let started = false;
let finished = false;
let jumpTarget = null;
let paused = false;

/* ---------- 舞台指令集（交给每一幕） ---------- */
const S = {
  stage, fx, audio, cam: stage.cam,
  wait: ms => Clock.wait(ms, sig),
  tween: (ms, fn, ease) => Clock.tween(ms, fn, ease, sig),
  camTo: (x, y, zoom, ms) => camTo(stage.cam, x, y, zoom, ms, sig),
  sub, clearSub, flash,
  bg: p => { p.catch(e => { if (!(e instanceof ActAbort)) console.error(e); }); }
};

/* ---------- 字幕 / 闪光 / 幕布 ---------- */
function sub(speaker, text) {
  $('speaker').textContent = speaker || '';
  $('line').textContent = text || '';
  $('subtitle').classList.remove('hidden');
}
function clearSub() { $('subtitle').classList.add('hidden'); }
function flash(color, peak = .8) {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.background = color;
  f.style.opacity = peak;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    f.style.transition = 'opacity .55s ease-out';
    f.style.opacity = 0;
  }));
}
function curtains(open) {
  $('curtainL').classList.toggle('open', open);
  $('curtainR').classList.toggle('open', open);
}
function showCard(act) {
  $('actNum').textContent = act.num;
  $('actTitle').textContent = act.title;
  $('actSub').textContent = act.sub;
  $('actcard').classList.remove('hidden');
}
function hideCard() { $('actcard').classList.add('hidden'); }

/* ---------- 脚灯与幕次导航 ---------- */
(function buildChrome() {
  const fl = $('footlights');
  for (let i = 0; i < 26; i++) fl.appendChild(document.createElement('i'));
  const nav = $('actlist');
  const CN = ['一', '二', '三', '四', '五', '六', '七'];
  ACTS.forEach((a, i) => {
    const b = document.createElement('button');
    b.textContent = CN[i] || (i + 1);
    b.title = `${a.num} · ${a.title}`;
    b.onclick = () => { if (started && !finished) jumpTo(i); };
    nav.appendChild(b);
  });
})();
function markNav(i) {
  [...$('actlist').children].forEach((b, k) => b.classList.toggle('now', k === i));
}

/* ---------- 演出流程 ---------- */
async function playAct(i) {
  const act = ACTS[i];
  markNav(i);
  sig = { aborted: false };
  stage.reset(); fx.reset();
  clearSub(); hideCard();
  try {
    curtains(false);
    await S.wait(1050);
    showCard(act);
    audio.startTheme(act.theme);
    await S.wait(2400);
    hideCard();
    curtains(true);
    await S.wait(1700);
    await act.play(S);
  } catch (e) {
    if (!(e instanceof ActAbort)) console.error(e);
  }
  clearSub(); hideCard();
}

async function runLoop(startAt) {
  let i = startAt;
  while (i < ACTS.length) {
    current = i;
    await playAct(i);
    if (jumpTarget !== null) { i = jumpTarget; jumpTarget = null; continue; }
    i++;
  }
  finale();
}

function jumpTo(i) {
  jumpTarget = clamp(i, 0, ACTS.length - 1);
  sig.aborted = true; /* 中止当前幕的所有等待 */
}

/* ---------- 谢幕 ---------- */
async function finale() {
  finished = true;
  markNav(-1);
  curtains(false);
  clearSub();
  sig = { aborted: false };
  stage.reset(); fx.reset();
  audio.startTheme('finale');
  audio.sfxApplause();
  const credits = [
    ['三体 · 像素歌剧', 13, '#e8e3d8'],
    ['THE THREE-BODY OPERA', 7, '#6b665c'],
    ['', 8],
    ['剧 终', 16, '#c9a96e'],
    ['', 10],
    ['叶文洁 —— 红岸的抉择', 8, '#9a958a'],
    ['汪淼 —— 三日凌空', 8, '#9a958a'],
    ['史强 —— 古筝行动', 8, '#9a958a'],
    ['罗辑 —— 面壁者 · 执剑人', 8, '#9a958a'],
    ['', 10],
    ['影像 —— Canvas 像素伪3D', 7, '#6b665c'],
    ['音乐与音效 —— Web Audio 程序化合成', 7, '#6b665c'],
    ['原著 —— 刘慈欣《三体》', 7, '#6b665c'],
  ];
  stage.setLayers([layer(0, (ctx, t) => {
    ctx.fillStyle = '#020204';
    ctx.fillRect(-80, -40, 640, 360);
    credits.forEach((c, idx) => {
      if (!c[0]) return;
      const y = 300 + idx * 20 - t / 28;
      if (y > -12 && y < 285)
        drawText(ctx, c[0], 240, y, { size: c[1], color: c[2], glow: idx === 3 ? '#c9a96e' : undefined, blur: 6 });
    });
  })]);
  setTimeout(() => {
    const ov = $('overture');
    ov.querySelector('.ov-title').innerHTML = '剧<span>·</span>终';
    ov.querySelector('.ov-en').textContent = 'FINALE';
    ov.querySelector('.ov-desc').textContent = '感谢观赏 · 三体 · 像素歌剧';
    const btn = $('btnStart');
    btn.textContent = '再 演 一 场';
    btn.onclick = () => location.reload();
    ov.querySelector('.ov-hint').textContent = '';
    ov.classList.remove('gone');
  }, 17500);
}

/* ---------- 控制 ---------- */
function setPaused(p) {
  paused = p;
  Clock.setPaused(p);
  if (p) audio.suspend(); else audio.resume();
  $('btnPlay').innerHTML = p ? '&#9654;' : '&#10074;&#10074;';
}
$('btnPlay').onclick = () => { if (started) setPaused(!paused); };
$('btnNext').onclick = () => { if (started && !finished) jumpTo(current + 1); };
$('btnPrev').onclick = () => { if (started && !finished) jumpTo(current - 1); };
$('btnMute').onclick = function () {
  audio.setMute(!audio.muted);
  this.classList.toggle('off', audio.muted);
};
document.addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
  else if (e.code === 'ArrowRight') $('btnNext').click();
  else if (e.code === 'ArrowLeft') $('btnPrev').click();
  else if (e.code === 'KeyM') $('btnMute').click();
});

/* ---------- 开幕 ---------- */
$('btnStart').onclick = () => {
  if (started) return;
  started = true;
  audio.init();
  audio.resume();
  audio.startTheme('overture');
  $('overture').classList.add('gone');
  curtains(true);
  setTimeout(() => runLoop(0), 1400);
};

/* URL 参数：?auto=1 自动开幕；&act=N 从第 N 幕开始（0 基） */
(function autoStart() {
  const q = new URLSearchParams(location.search);
  if (!q.has('auto')) return;
  const idx = clamp(parseInt(q.get('act') || '0', 10) || 0, 0, ACTS.length - 1);
  started = true;
  try { audio.init(); } catch (e) {}
  $('overture').classList.add('gone');
  curtains(true);
  runLoop(idx);
})();
