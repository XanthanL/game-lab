/* ==========================================================================
   共振纪元 · 阅读器
   --------------------------------------------------------------------------
   修过的坑（别再踩回去）：
     1. 手稿文件名是「第 1 章_标题.md」——「第」「章」和数字之间各有一个空格。
        旧版拼成「第1章_标题.md」，25 章全部 404，页面只会显示「无法加载」。
        现在文件名由 chapters.js 的 title 派生，并额外试一次无空格变体兜底。
     2. 目录副标题取不到：旧版用 key.includes('第1章') 去匹配带空格的键，全落空。
        现在目录只从 chapters.js 读，没有第二份标题表。
     3. 字号/行距换章就失效：旧版把内联样式写在 .chapter-body 元素上，
        innerHTML 一换全丢。现在写 CSS 变量到 :root，跟 DOM 重建无关。
     4. 没有目录页、没有深链：现在 #/3 直达第 3 章，#/catalog 回目录，可分享可刷新。
   ========================================================================== */
(function () {
  'use strict';

  var DATA = window.NOVEL_DATA;
  if (!DATA) { console.error('[共振纪元] chapters.js 没加载'); return; }

  var KEY = {
    theme: 're-theme',
    fs: 're-font-size',
    lh: 're-line-height',
    last: 're-last-chapter'
  };

  var el = {};
  var cache = {};        /* number -> { title, html, chars } */
  var current = 0;       /* 0 = 目录页 */
  var rafPending = false;

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
  }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 取文件 ---------- */
  function urlCandidates(ch) {
    var dir = DATA.manuscriptDir || '03_manuscript';
    var list = [dir + '/' + ch.file];
    /* 兜底：万一某天文件名被改成不带空格的写法 */
    var flat = ch.file.replace(/第\s*(\d+)\s*章/, '第$1章');
    if (flat !== ch.file) list.push(dir + '/' + flat);
    return list.map(encodeURI);
  }

  function fetchChapter(ch) {
    var list = urlCandidates(ch);
    var i = 0;
    function attempt() {
      if (i >= list.length) return Promise.reject(new Error('NOT_FOUND'));
      var url = list[i++];
      return fetch(url).then(function (res) {
        if (!res.ok) return attempt();
        return res.text();
      }, function () { return attempt(); });
    }
    return attempt();
  }

  /* ---------- Markdown ---------- */
  function inlineMd(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function parseMarkdown(md) {
    var text = String(md).replace(/\r\n?/g, '\n');
    var lines = text.split('\n');
    var title = '';

    /* 首行 H1 是章节标题，不进正文 */
    if (/^#\s+/.test(lines[0])) title = lines.shift().replace(/^#\s+/, '').trim();

    var out = [];
    lines.join('\n').split(/\n{2,}/).forEach(function (block) {
      var t = block.trim();
      if (!t) return;

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { out.push('<hr>'); return; }

      var h = t.match(/^(#{2,6})\s+(.*)$/);
      if (h) { out.push('<h3>' + inlineMd(h[2]) + '</h3>'); return; }

      if (/^>\s?/.test(t)) {
        var q = t.split('\n').map(function (l) { return l.replace(/^>\s?/, ''); }).join('\n');
        out.push('<blockquote><p>' + inlineMd(q).replace(/\n/g, '<br>') + '</p></blockquote>');
        return;
      }

      out.push('<p>' + inlineMd(t).replace(/\n/g, '<br>') + '</p>');
    });

    return {
      title: title,
      html: out.join('\n'),
      chars: text.replace(/\s/g, '').length
    };
  }

  function fmtChars(n) {
    if (!n) return '';
    return n >= 10000 ? '约 ' + (n / 10000).toFixed(1) + ' 万字' : '约 ' + (n / 1000).toFixed(1) + ' 千字';
  }

  function volumeOf(n) {
    for (var i = 0; i < DATA.volumes.length; i++) {
      var v = DATA.volumes[i];
      if (n >= v.range[0] && n <= v.range[1]) return v;
    }
    return null;
  }

  /* ---------- 目录（侧栏） ---------- */
  function renderToc() {
    var html = '';
    DATA.volumes.forEach(function (v) {
      html += '<div class="vol">' +
        '<div class="vol-h">' + esc(v.title) + '</div>' +
        '<div class="vol-sub">' + esc(v.subtitle) + ' · ' + v.range[0] + '–' + v.range[1] + '</div>' +
        '<ul class="chapter-list">';
      for (var i = v.range[0]; i <= v.range[1]; i++) {
        var c = DATA.byNumber[i];
        if (!c) continue;
        html += '<li><a href="#/' + c.number + '" data-ch="' + c.number + '">' +
          '<span class="n">' + pad(c.number) + '</span><span>' + esc(c.title) + '</span></a></li>';
      }
      html += '</ul></div>';
    });
    el.toc.innerHTML = html;
  }

  function markActive(n) {
    var links = el.toc.querySelectorAll('a[data-ch]');
    for (var i = 0; i < links.length; i++) {
      var on = Number(links[i].getAttribute('data-ch')) === n;
      links[i].classList.toggle('active', on);
      if (on) links[i].setAttribute('aria-current', 'true');
      else links[i].removeAttribute('aria-current');
    }
  }

  /* ---------- 目录页 ---------- */
  function renderCatalog() {
    current = 0;
    el.body.setAttribute('data-view', 'catalog');
    el.root.setAttribute('data-view', 'catalog');
    markActive(0);
    updateMobileBar();

    var last = parseInt(read(KEY.last, '0'), 10);
    var resume = DATA.byNumber[last];

    var html =
      '<section class="cover">' +
        '<div class="kicker">Hard Science Fiction · 长篇连载</div>' +
        '<h1>' + esc(DATA.title) + '</h1>' +
        '<div class="en">' + esc(DATA.titleEn) + '</div>' +
        '<p class="lede">架空宇宙纪元 1018 年。六层级空间把人按高度分开，协作单元取代了家庭，' +
        '「文明管理中枢」替每个人算好了最短路径——多走的四十七米，要从你的账户里扣。' +
        '直到有人听见 <span class="acid">12.7Hz</span>。</p>' +
        '<div class="stats">' +
          '<div><b>' + DATA.totalChapters + '</b><span>章</span></div>' +
          '<div><b>' + DATA.volumes.length + '</b><span>卷</span></div>' +
          '<div><b>33.6</b><span>万字</span></div>' +
          '<div><b>1018</b><span>宇宙纪元</span></div>' +
        '</div>' +
      '</section>';

    if (resume) {
      html += '<p style="margin:-18px 0 30px;font-family:var(--mono);font-size:12px;letter-spacing:.06em">' +
        '上次读到 <a href="#/' + resume.number + '" style="color:var(--accent);text-decoration:none;' +
        'border-bottom:1px solid currentColor">第 ' + resume.number + ' 章 ' + esc(resume.title) + '</a></p>';
    }

    DATA.volumes.forEach(function (v) {
      html += '<section class="vol-block">' +
        '<h2>' + esc(v.title) + ' · ' + esc(v.subtitle) + '</h2>' +
        '<p>CHAPTER ' + v.range[0] + ' – ' + v.range[1] + '</p>' +
        '<div class="ch-grid">';
      for (var i = v.range[0]; i <= v.range[1]; i++) {
        var c = DATA.byNumber[i];
        if (!c) continue;
        html += '<a href="#/' + c.number + '"><span class="n">' + pad(c.number) + '</span>' +
          '<span class="t">' + esc(c.title) + '</span></a>';
      }
      html += '</div></section>';
    });

    html += '<div class="colophon">© 2026 ' + esc(DATA.title) + ' | ' + esc(DATA.titleEn) +
      ' BY XANTHANL<br>正文以 Markdown 手稿原样渲染 · 托管于 GitHub Pages</div>';

    el.view.innerHTML = html;
    document.title = DATA.title + ' | ' + DATA.titleEn;
    window.scrollTo(0, 0);
  }

  /* ---------- 章节页 ---------- */
  function skeleton() {
    var s = '<div class="skeleton">';
    for (var i = 0; i < 9; i++) s += '<i></i>';
    return s + '</div>';
  }

  function renderChapter(n) {
    var ch = DATA.byNumber[n];
    if (!ch) { go('catalog'); return; }

    current = n;
    el.body.setAttribute('data-view', 'chapter');
    el.root.setAttribute('data-view', 'chapter');
    markActive(n);
    updateMobileBar();
    save(KEY.last, n);

    if (cache[n]) { paintChapter(ch, cache[n]); return; }

    el.view.innerHTML = '<div class="ch-head"><div class="ch-eyebrow"><em>第 ' + n + ' 章</em>' +
      '<span>载入中</span></div><h1 class="ch-title">' + esc(ch.title) + '</h1></div>' + skeleton();

    fetchChapter(ch).then(function (md) {
      var parsed = parseMarkdown(md);
      cache[n] = parsed;
      if (current === n) paintChapter(ch, parsed);
    }).catch(function (err) {
      if (current === n) paintError(ch, err);
    });
  }

  function paintChapter(ch, parsed) {
    var vol = volumeOf(ch.number);
    var heading = (parsed.title || ('第 ' + ch.number + ' 章 ' + ch.title))
      .replace(/^第\s*\d+\s*章\s*/, '');

    var prev = DATA.byNumber[ch.number - 1];
    var next = DATA.byNumber[ch.number + 1];

    var nav = '<nav class="ch-nav">';
    nav += prev
      ? '<a href="#/' + prev.number + '" class="prev"><span class="k">← 上一章 ' + pad(prev.number) +
        '</span><span class="t">' + esc(prev.title) + '</span></a>'
      : '<span class="prev disabled"><span class="k">← 上一章</span><span class="t">已是第一章</span></span>';
    nav += next
      ? '<a href="#/' + next.number + '" class="next"><span class="k">下一章 ' + pad(next.number) +
        ' →</span><span class="t">' + esc(next.title) + '</span></a>'
      : '<span class="next disabled"><span class="k">下一章 →</span><span class="t">已是最后一章</span></span>';
    nav += '</nav>';

    el.view.innerHTML =
      '<article>' +
        '<header class="ch-head">' +
          '<div class="ch-eyebrow"><em>第 ' + ch.number + ' 章</em>' +
          '<span>' + (vol ? esc(vol.title) + ' · ' + esc(vol.subtitle) : '') + '</span></div>' +
          '<h1 class="ch-title">' + esc(heading) + '</h1>' +
          '<div class="ch-meta">' +
            '<span>' + fmtChars(parsed.chars) + '</span>' +
            '<span>' + ch.number + ' / ' + DATA.totalChapters + '</span>' +
            '<span>' + esc(DATA.titleEn) + '</span>' +
          '</div>' +
        '</header>' +
        '<div class="prose">' + parsed.html + '</div>' +
        nav +
        '<a class="back-catalog" href="#/catalog">返回目录</a>' +
      '</article>';

    document.title = '第 ' + ch.number + ' 章 ' + ch.title + ' · ' + DATA.title;
    window.scrollTo(0, 0);
    onScroll();
  }

  function paintError(ch, err) {
    var isFile = location.protocol === 'file:';
    var msg = isFile
      ? '<p><b>浏览器不允许从 <code>file://</code> 直接读取章节文件</b>（同源策略）。在本目录起一个静态服务再打开：</p>' +
        '<p><code>python -m http.server 8000</code></p>' +
        '<p>然后访问 <code>http://localhost:8000/</code></p>'
      : '<p><b>第 ' + ch.number + ' 章没读到。</b></p>' +
        '<p>手稿：<code>' + esc((DATA.manuscriptDir || '03_manuscript') + '/' + ch.file) + '</code></p>' +
        '<p>常见原因：文件名与 <code>chapters.js</code> 里的 title 对不上（注意「第」「章」两侧的空格）。' +
        '<br>错误：' + esc(err && err.message ? err.message : String(err)) + '</p>';

    el.view.innerHTML = '<div class="notice">' + msg +
      '<p style="margin-top:20px"><a href="#/catalog" style="color:var(--accent)">← 返回目录</a></p></div>';
    document.title = '加载失败 · ' + DATA.title;
  }

  /* ---------- 路由 ---------- */
  function go(target) {
    var hash = target === 'catalog' ? '#/catalog' : '#/' + target;
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  function route() {
    var h = String(location.hash || '').replace(/^#\/?/, '').trim();
    if (h === '' || h === 'catalog' || h === '/') { renderCatalog(); return; }
    var n = parseInt(h, 10);
    if (!isNaN(n) && DATA.byNumber[n]) renderChapter(n);
    else renderCatalog();
  }

  /* ---------- 设置 ---------- */
  function applySettings() {
    var fs = clamp(parseInt(read(KEY.fs, '17'), 10) || 17, 15, 24);
    var lh = clamp(parseFloat(read(KEY.lh, '1.9')) || 1.9, 1.5, 2.4);

    el.root.style.setProperty('--reader-fs', fs + 'px');
    el.root.style.setProperty('--reader-lh', String(lh));
    el.fontSize.value = fs;
    el.lineHeight.value = lh;
    el.fsVal.textContent = fs + 'px';
    el.lhVal.textContent = lh.toFixed(1);
  }

  function setTheme(t, persist) {
    el.root.setAttribute('data-theme', t);
    el.themeLight.setAttribute('aria-pressed', String(t === 'light'));
    el.themeDark.setAttribute('aria-pressed', String(t === 'dark'));
    el.themeBtn.textContent = t === 'dark' ? '日间' : '夜间';
    if (persist) save(KEY.theme, t);
  }

  /* ---------- 抽屉 ---------- */
  function openDrawer() {
    el.body.classList.add('drawer-open');
    el.menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    el.body.classList.remove('drawer-open');
    el.menuBtn.setAttribute('aria-expanded', 'false');
  }
  function drawerOpen() { return el.body.classList.contains('drawer-open'); }

  /* ---------- 底部条 / 进度 ---------- */
  function updateMobileBar() {
    if (current === 0) {
      el.mbPrev.hidden = true;
      el.mbNext.hidden = true;
    } else {
      el.mbPrev.hidden = false;
      el.mbNext.hidden = false;
      el.mbPrev.disabled = current <= 1;
      el.mbNext.disabled = current >= DATA.totalChapters;
    }
  }

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    el.progress.style.width = (p * 100).toFixed(2) + '%';
  }
  function onScrollRaf() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; onScroll(); });
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    el.menuBtn.addEventListener('click', function () {
      if (drawerOpen()) closeDrawer(); else openDrawer();
    });
    el.railClose.addEventListener('click', closeDrawer);
    el.scrim.addEventListener('click', closeDrawer);

    /* 抽屉里点章节就关掉抽屉（hashchange 会负责换页） */
    el.rail.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[data-ch]')) closeDrawer();
    });

    el.mbToc.addEventListener('click', openDrawer);
    el.mbPrev.addEventListener('click', function () { if (current > 1) go(current - 1); });
    el.mbNext.addEventListener('click', function () {
      if (current > 0 && current < DATA.totalChapters) go(current + 1);
    });

    el.fontSize.addEventListener('input', function () {
      save(KEY.fs, this.value);
      applySettings();
    });
    el.lineHeight.addEventListener('input', function () {
      save(KEY.lh, this.value);
      applySettings();
    });

    el.themeBtn.addEventListener('click', function () {
      setTheme(el.root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });
    el.themeLight.addEventListener('click', function () { setTheme('light', true); });
    el.themeDark.addEventListener('click', function () { setTheme('dark', true); });

    window.addEventListener('hashchange', route);
    window.addEventListener('scroll', onScrollRaf, { passive: true });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && drawerOpen()) closeDrawer();
      onScroll();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerOpen()) { closeDrawer(); return; }
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft' && current > 1) go(current - 1);
      if (e.key === 'ArrowRight' && current > 0 && current < DATA.totalChapters) go(current + 1);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    el = {
      root: document.documentElement,
      body: document.body,
      view: $('view'),
      toc: $('toc'),
      rail: $('rail'),
      railClose: $('railClose'),
      scrim: $('scrim'),
      menuBtn: $('menuBtn'),
      themeBtn: $('themeBtn'),
      themeLight: $('themeLight'),
      themeDark: $('themeDark'),
      fontSize: $('fontSize'),
      lineHeight: $('lineHeight'),
      fsVal: $('fsVal'),
      lhVal: $('lhVal'),
      mbToc: $('mbToc'),
      mbPrev: $('mbPrev'),
      mbNext: $('mbNext'),
      progress: $('progressFill')
    };

    el.railCount = $('railCount');
    if (el.railCount) el.railCount.textContent = DATA.totalChapters + ' 章';

    setTheme(el.root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
    applySettings();
    renderToc();
    bind();
    route();

    /* 给探针 / 调试用 */
    window.RE = { go: go, route: route, cache: cache, data: DATA, current: function () { return current; } };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
