/* 虚空典籍 · 页面脚本（无依赖，vanilla JS）
   1) 星尘粒子背景  2) hero 逐字入场  3) 滚动显现
   4) 活动列表渲染（读 data/events.js）  5) 导航当前区高亮 */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1 · 星尘粒子 ---------- */
  var canvas = document.getElementById('starfield');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, stars = [];
    var COLORS = [
      { c: '176,38,255',  w: 26 },   /* 紫 */
      { c: '255,0,110',   w: 20 },   /* 粉 */
      { c: '0,212,255',   w: 22 },   /* 青 */
      { c: '233,237,242', w: 32 }    /* 白 */
    ];
    var COLOR_BAG = [];
    COLORS.forEach(function (item) {
      for (var i = 0; i < item.w; i++) COLOR_BAG.push(item.c);
    });

    function makeStars() {
      W = canvas.width = Math.floor(innerWidth * dpr);
      H = canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      var count = Math.min(140, Math.floor(innerWidth * innerHeight / 9000));
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: (0.6 + Math.random() * 1.6) * dpr,
          vx: (-0.06 - Math.random() * 0.12) * dpr,
          vy: (-0.04 - Math.random() * 0.1) * dpr,
          tw: Math.random() * Math.PI * 2,
          tws: 0.008 + Math.random() * 0.02,
          c: COLOR_BAG[Math.floor(Math.random() * COLOR_BAG.length)]
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x += s.vx; s.y += s.vy; s.tw += s.tws;
        if (s.x < -4) s.x = W + 4; if (s.x > W + 4) s.x = -4;
        if (s.y < -4) s.y = H + 4; if (s.y > H + 4) s.y = -4;
        var a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw));
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + s.c + ',' + a.toFixed(3) + ')';
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var rafId = null;
    function loop() {
      draw();
      rafId = requestAnimationFrame(loop);
    }

    makeStars();
    if (reduceMotion) {
      draw();                       /* 静态星点一次 */
    } else {
      loop();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
        else if (!rafId) { loop(); }
      });
    }
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        makeStars();
        if (reduceMotion) draw();
      }, 200);
    });
  }

  /* ---------- 2 · hero 逐字入场 ----------
     注：入场动画最终由 CSS 作用于 .hero-name 整块（heroIn keyframes）。
     实测子 span 上的任何动画都会打断父级 background-clip:text 的光栅合成，
     故此处不再对字符单独加动画。 */

  /* ---------- 3 · 滚动显现 ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(revealEls, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('is-in'); });
  }

  /* ---------- 4 · 活动列表渲染 ---------- */
  var list = document.getElementById('event-list');
  if (list && window.VOID_EVENTS && window.VOID_EVENTS.length) {
    var frag = document.createDocumentFragment();
    window.VOID_EVENTS.forEach(function (ev, i) {
      var row = document.createElement('article');
      row.className = 'event-row reveal' + (i === 0 ? ' event-next' : '');
      row.style.setProperty('--d', (i * 70) + 'ms');

      var no = document.createElement('span');
      no.className = 'event-no';
      no.textContent = String(i + 1).padStart(2, '0');
      no.setAttribute('aria-hidden', 'true');

      var main = document.createElement('div');
      main.className = 'event-main';
      var kind = document.createElement('span');
      kind.className = 'event-kind';
      kind.textContent = ev.kind || '';
      var title = document.createElement('h3');
      title.className = 'event-title';
      title.textContent = ev.title || '';
      var desc = document.createElement('p');
      desc.className = 'event-desc';
      desc.textContent = ev.desc || '';
      main.appendChild(kind);
      main.appendChild(title);
      main.appendChild(desc);

      var meta = document.createElement('div');
      meta.className = 'event-meta';
      var date = document.createElement('span');
      date.className = 'event-date';
      date.textContent = ev.date || '';
      var sub = document.createElement('span');
      sub.className = 'event-sub';
      sub.textContent = (ev.sub || '') + (ev.time ? ' · ' + ev.time : '');
      meta.appendChild(date);
      meta.appendChild(sub);

      var badges = document.createElement('div');
      badges.className = 'event-badges';
      if (i === 0) {
        var next = document.createElement('span');
        next.className = 'badge badge-next';
        next.textContent = '最近一场';
        badges.appendChild(next);
      }
      if (ev.sample) {
        var sample = document.createElement('span');
        sample.className = 'badge badge-sample';
        sample.textContent = '示例';
        badges.appendChild(sample);
      }
      if (ev.status) {
        var st = document.createElement('span');
        st.className = 'badge';
        st.textContent = ev.status;
        badges.appendChild(st);
      }
      meta.appendChild(badges);

      row.appendChild(no);
      row.appendChild(main);
      row.appendChild(meta);
      frag.appendChild(row);
    });
    list.innerHTML = '';
    list.appendChild(frag);
    /* 新插入的行补进滚动显现观察 */
    if ('IntersectionObserver' in window && !reduceMotion) {
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io2.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      list.querySelectorAll('.reveal').forEach(function (el) { io2.observe(el); });
    } else {
      list.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  /* ---------- 5 · 导航当前区高亮 ---------- */
  var navLinks = document.querySelectorAll('.nav-link[data-target]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var sections = {};
    Array.prototype.forEach.call(navLinks, function (a) {
      var sec = document.getElementById(a.getAttribute('data-target'));
      if (sec) sections[a.getAttribute('data-target')] = sec;
    });
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = document.querySelector('.nav-link[data-target="' + entry.target.id + '"]');
        if (link) link.classList.toggle('is-active', entry.isIntersecting);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(sections).forEach(function (k) { navIo.observe(sections[k]); });
  }
})();
