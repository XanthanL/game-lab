/* GAME LAB 首页交互增强
   - 指针光斑：跟随鼠标在卡片 / 目录按钮上投射液态高光（CSS 变量 --mx/--my 驱动）
   - 点击涟漪：在按钮 / 卡片 / 链接的按下处扩散墨色涟漪
   尊重 prefers-reduced-motion：降级时完全不绑定监听，避免无意义开销。 */
(function () {
  'use strict';
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // —— 指针光斑：把光标位置写进元素的 --mx / --my ——
  var spot = document.querySelectorAll('.card, .toc a');
  Array.prototype.forEach.call(spot, function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    });
  });

  // —— 点击涟漪 ——
  function ripple(e) {
    if (e.button !== undefined && e.button !== 0) return; // 仅左键 / 触摸 / 笔
    var el = e.currentTarget;
    var r = el.getBoundingClientRect();
    var size = Math.max(r.width, r.height);
    var dot = document.createElement('span');
    dot.className = 'ripple-dot';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size / 2) + 'px';
    dot.style.top = (e.clientY - r.top - size / 2) + 'px';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(dot);
    var done = false;
    function clean() {
      if (!done && dot.parentNode) { done = true; dot.parentNode.removeChild(dot); }
    }
    dot.addEventListener('animationend', clean);
    setTimeout(clean, 800); // 兜底清理
  }
  var targets = document.querySelectorAll(
    '.card, .lang-switch, .sm-btn, .skin-chip, .bulb-switch, .brand, .foot-meta a, .btn'
  );
  Array.prototype.forEach.call(targets, function (el) {
    el.addEventListener('pointerdown', ripple);
  });
})();

/* 风格独有交互增强（2026-09-10）
   - 指针视差：hero 母题随光标轻微位移（配合 CSS 的 translate: var(--hx) var(--hy)）
   - CRT：一条跟随光标的绿色扫描线
   - Aperture：点击 hero 让传送门光圈向内坍缩再恢复
   全部尊重 prefers-reduced-motion。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PARALLAX = ['dream', 'clay', 'weird', 'ink', 'morandi', 'futurism',
    'vaporwave', 'synthwave', 'skate', 'decon', 'hermes', 'klein', 'pop', 'swiss',
    'raw', 'mac7', 'glitch', 'diagonal', 'blueprint'];

  var hero = document.querySelector('.hero');

  // —— 1) 指针视差 ——
  if (!reduce && hero) {
    hero.addEventListener('pointermove', function (e) {
      if (PARALLAX.indexOf(root.getAttribute('data-style')) === -1) return;
      var r = hero.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      hero.style.setProperty('--hx', (dx * 14).toFixed(2) + 'px');
      hero.style.setProperty('--hy', (dy * 14).toFixed(2) + 'px');
    });
    hero.addEventListener('pointerleave', function () {
      hero.style.setProperty('--hx', '0px');
      hero.style.setProperty('--hy', '0px');
    });
  }

  // —— 2) CRT 光标扫描线 ——
  if (!reduce) {
    var scan = document.createElement('div');
    scan.className = 'fx-crtscan';
    document.body.appendChild(scan);
    window.addEventListener('pointermove', function (e) {
      var isCrt = root.getAttribute('data-style') === 'crt';
      scan.style.opacity = isCrt ? '0.7' : '0';
      scan.style.top = e.clientY + 'px';
    });
  }

  // —— 3) Aperture 点击内爆 ——
  if (hero) {
    hero.addEventListener('click', function () {
      if (root.getAttribute('data-style') !== 'aperture' || reduce) return;
      hero.classList.add('ap-burst');
    });
    hero.addEventListener('animationend', function (e) {
      if (e.animationName === 'apBurst') hero.classList.remove('ap-burst');
    });
  }
})();

/* diagonal（对角线计划）独有交互（2026-09-10）
   模仿 E:/Code/Diagonal 首页的「斜切纸面翻页」：点站内链接时，
   一张比视口大一圈的暖纸面板斜切（skewX -12deg）自左向右掠过，
   先行发丝线跑在纸面前缘之前，线上挂一枚暗朱刻痕；纸面盖满后再导航。
   另加一条贴在视口顶端的暗朱发丝滚动进度条。全部尊重 prefers-reduced-motion。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var COVER_MS = 420;   // 纸面盖满屏幕所需时间（动画总长 620ms）

  var wipe = document.createElement('div');
  wipe.className = 'dg-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  wipe.innerHTML = '<span class="dg-sheet"><i class="dg-rule"></i></span>';
  document.body.appendChild(wipe);

  // —— 滚动进度发丝 ——
  var bar = document.createElement('div');
  bar.className = 'dg-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function paint() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? (window.scrollY / h) : 0;
    bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(paint);
  }, { passive: true });
  window.addEventListener('resize', paint, { passive: true });
  paint();

  // —— 斜切纸面翻页：拦截站内导航，先演完转场再走 ——
  document.addEventListener('click', function (e) {
    if (root.getAttribute('data-style') !== 'diagonal') return;
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(https?:)?\/\//.test(href) || /^(mailto|tel):/.test(href)) return;

    e.preventDefault();
    wipe.classList.add('on');
    window.setTimeout(function () { window.location.href = href; }, COVER_MS);
  }, false);

  // 从缓存返回（bfcache）时把转场收回去，否则纸面会一直压着
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) wipe.classList.remove('on');
  });
})();

/* blueprint（工程蓝图）独有交互（2026-09-10）
   CAD 十字准星：指针落在首屏范围内时，一条贯穿视口的水平导线 + 一条垂直导线
   跟随光标，光标右下挂一枚坐标读数框（X / Y）；点击首屏会落下一枚圆圈定位十字，
   1.2s 内放大淡出。纯装饰、pointer-events:none、不拦任何事件。
   只在精细指针设备（鼠标）启用；尊重 prefers-reduced-motion。
   显隐交给 CSS（:root[data-style="blueprint"] .bp-cross），所以运行时换肤也正确。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  if (!(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return;

  var cross = document.createElement('div');
  cross.className = 'bp-cross';
  cross.setAttribute('aria-hidden', 'true');
  cross.innerHTML = '<i class="bp-cx"></i><i class="bp-cy"></i><b class="bp-read"></b>';
  document.body.appendChild(cross);

  var cx = cross.querySelector('.bp-cx');
  var cy = cross.querySelector('.bp-cy');
  var read = cross.querySelector('.bp-read');
  var on = false;

  function heroRect() {
    var hero = document.querySelector('.hero');
    return hero ? hero.getBoundingClientRect() : null;
  }

  document.addEventListener('pointermove', function (e) {
    if (root.getAttribute('data-style') !== 'blueprint') return;
    var r = heroRect();
    if (!r) return;
    var inHero = e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inHero) {
      if (on) { cross.classList.remove('on'); on = false; }
      return;
    }
    if (!on) { cross.classList.add('on'); on = true; }
    cx.style.top = e.clientY.toFixed(0) + 'px';
    cy.style.left = e.clientX.toFixed(0) + 'px';
    read.style.top = e.clientY.toFixed(0) + 'px';
    read.style.left = e.clientX.toFixed(0) + 'px';
    read.textContent = 'X ' + Math.round(e.clientX) + '  Y ' + Math.round(e.clientY);
  }, { passive: true });

  // 点击首屏：落下一枚定位十字（放大淡出），像在图纸上钉一个点
  document.addEventListener('pointerdown', function (e) {
    if (root.getAttribute('data-style') !== 'blueprint') return;
    var r = heroRect();
    if (!r || e.clientY < r.top || e.clientY > r.bottom) return;
    var m = document.createElement('span');
    m.className = 'bp-mark';
    m.style.left = e.clientX.toFixed(0) + 'px';
    m.style.top = e.clientY.toFixed(0) + 'px';
    document.body.appendChild(m);
    window.setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 1300);
  }, { passive: true });

  // 切走皮肤 / 离开首屏时把准星收掉
  window.addEventListener('blur', function () {
    cross.classList.remove('on'); on = false;
  });
  document.addEventListener('scroll', function () {
    if (on) { cross.classList.remove('on'); on = false; }
  }, { passive: true });
})();

/* hermes（电光蓝 Electric Blue）/ klein（克莱因蓝 Klein Blue）共有交互（复制自 Hermes Agent 设计）
   取材自官网的两处签名，都是「把随机性当署名」的实验标注：
   ① 实验印章：nousresearch.com 每个条目右侧都挂一栏 mono 小字
      「OUTPUT 96 / SEED: 3573860127」。这里给站内每个 .sec 右下角注入同款印章，
      SEED 每次载入随机一次（10 位），页内所有印章共用同一个种子。
   ② 终端状态栏：右下角固定一条 mono 状态条，OUTPUT 三位数随滚动进度跑，
      末尾一枚闪动的方块光标（CSS 动画）。
   显隐一律交给 CSS（:root[data-style="hermes"] / [data-style="klein"] .hm-stamp / .hm-hud），
   所以运行时换肤也正确 —— 不在这里判皮肤、不写 style.display。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var seed = String(1000000000 + Math.floor(Math.random() * 8999999999));

  /* ① 每个分区右下角的 OUTPUT / SEED 印章 */
  var secs = document.querySelectorAll('.sec');
  for (var i = 0; i < secs.length; i++) {
    if (secs[i].querySelector('.hm-stamp')) continue;
    var s = document.createElement('span');
    s.className = 'hm-stamp';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<i>OUTPUT ' + (96 + i * 111) + '</i><i>SEED: ' + seed + '</i>';
    secs[i].appendChild(s);
  }

  /* ② 终端状态栏（OUTPUT 跟滚动）。刻意做窄：它是固定层，压住卡片就不好了。
        SEED 只留在每个分区的印章里，状态栏不再重复。 */
  var hud = document.createElement('div');
  hud.className = 'hm-hud';
  hud.setAttribute('aria-hidden', 'true');
  var hudName = (root.getAttribute('data-style') === 'klein') ? '克莱因蓝' : '电光蓝';
  hud.innerHTML = '<span class="hm-hud-t">\u25AE ' + hudName + '</span>' +
                  '<span class="hm-hud-o">OUTPUT 000</span>';
  var hudT = hud.querySelector('.hm-hud-t');
  if (window.MutationObserver) {
    new MutationObserver(function () {
      hudT.textContent = '\u25AE ' + ((root.getAttribute('data-style') === 'klein') ? '克莱因蓝' : '电光蓝');
    }).observe(root, { attributes: true, attributeFilter: ['data-style'] });
  }
  document.body.appendChild(hud);

  var out = hud.querySelector('.hm-hud-o');
  var ticking = false;
  function paint() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? window.scrollY / h : 0;
    var n = Math.round(Math.max(0, Math.min(1, p)) * 999);
    out.textContent = 'OUTPUT ' + ('000' + n).slice(-3);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(paint);
  }, { passive: true });
  window.addEventListener('resize', paint, { passive: true });
  paint();

  /* 换肤切到别的皮肤时状态栏并不用移除：CSS 关掉即可。 */
  void root;
})();
