/* 屿光摄影 · 交互（原生 JS，无依赖）
   1) 顶栏 scrollspy  2) 作品筛选  3) 灯箱（计数/翻页/键盘/Esc）
   4) 预约表单 mailto 降级（表单服务接入后可切换为 fetch 提交）
   说明：form.endpoint [待填]；接入方法见 submitForm 内注释            */
(function () {
  'use strict';

  /* ── 1) scrollspy：当前区块高亮 ─────────────────────── */
  var links = Array.prototype.slice.call(document.querySelectorAll('.topbar-links a'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  function setCurrent(id) {
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-current', on);
      if (on) { a.setAttribute('aria-current', 'true'); } else { a.removeAttribute('aria-current'); }
    });
  }
  if ('IntersectionObserver' in window && sections.length) {
    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { setCurrent(e.target.id); } });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(function (s) { vis.observe(s); });
  }

  /* ── 2) 作品分类筛选 ───────────────────────────────── */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('#masonry .card'));
  var emptyTip = document.querySelector('.works-empty');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var f = chip.dataset.filter;
      var shown = 0;
      cards.forEach(function (card) {
        var show = f === 'all' || card.dataset.cat === f;
        card.classList.toggle('is-hidden', !show);
        if (show) { shown++; }
      });
      if (emptyTip) { emptyTip.hidden = shown !== 0; }
    });
  });

  /* ── 3) 灯箱：以当前可见卡片为序列 ─────────────────── */
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbCap = document.getElementById('lbCap');
  var lbCount = document.getElementById('lbCount');
  var lastFocus = null;
  var seq = [];
  var idx = 0;

  function visibleCards() {
    return cards.filter(function (c) { return !c.classList.contains('is-hidden'); });
  }
  function render() {
    var card = seq[idx];
    var img = card.querySelector('img');
    lbImg.src = img.getAttribute('src');
    lbImg.alt = img.alt;
    lbCap.textContent = card.querySelector('figcaption').textContent;
    lbCount.textContent = (idx + 1) + ' / ' + seq.length;
  }
  function openLb(card) {
    seq = visibleCards();
    idx = Math.max(0, seq.indexOf(card));
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
    lb.querySelector('.lb-close').focus();
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = '';
    lbImg.src = '';
    if (lastFocus) { lastFocus.focus(); }
  }
  function step(d) {
    idx = (idx + d + seq.length) % seq.length;
    render();
  }
  cards.forEach(function (card) {
    card.querySelector('.card-btn').addEventListener('click', function () { openLb(card); });
  });
  lb.querySelector('.lb-close').addEventListener('click', closeLb);
  lb.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
  lb.querySelector('.lb-next').addEventListener('click', function () { step(1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) { closeLb(); } });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) { return; }
    if (e.key === 'Escape') { closeLb(); }
    else if (e.key === 'ArrowLeft') { step(-1); }
    else if (e.key === 'ArrowRight') { step(1); }
  });

  /* ── 4) 预约表单：mailto 降级 ────────────────────────
     接入表单服务后，把下面的 mailto 分支替换为：
       fetch('https://formspree.io/f/<你的ID>', { method:'POST', ... })
     即可实现页内直接提交（无需后端）。endpoint 待老陈注册后填入。 */
  var form = document.getElementById('bookForm');
  var status = document.getElementById('formStatus');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(form);
    if (!String(data.get('name')).trim() || !String(data.get('contact')).trim()) {
      status.textContent = '请至少留下称呼和联系方式，老陈才找得到你。';
      return;
    }
    var subject = '【屿光摄影官网预约】' + data.get('name') + ' · ' + data.get('type');
    var body =
      '称呼：' + data.get('name') + '\n' +
      '微信/手机：' + data.get('contact') + '\n' +
      '想拍：' + data.get('type') + '\n' +
      '大概日期：' + (data.get('date') || '未定') + '\n' +
      '想说的话：' + (data.get('msg') || '—');
    location.href = 'mailto:yuguang@example.com?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    status.textContent = '已打开邮件应用；若未弹出，也可直接加微信 138-XXXX-XXXX（占位）。';
  });
})();
