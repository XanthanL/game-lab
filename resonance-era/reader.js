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
    last: 're-last-chapter',
    pos: 're-read-pos'
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
    /* 侧栏里的附录页（拓片辑 / 厥初）不是章节，单独判：只有正停在这一页时才亮。
       用 data-appendix 的值跟 body[data-view] 对，加新附录页不用再来改这里。 */
    var apps = document.querySelectorAll('[data-appendix]');
    for (var j = 0; j < apps.length; j++) {
      var a = apps[j];
      var on = n === 0 && el.body.getAttribute('data-view') === a.getAttribute('data-appendix');
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
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
        '<i class="orn orn-cover" aria-hidden="true"></i>' +
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

    /* 附录入口：不是章节，不放进 ch-grid，单独一条满行 */
    var pvCount = proverbsData().items.length;
    if (pvCount) {
      html += '<a class="pv-entry" href="#/proverbs">' +
        '<span class="pv-e-k">附 · Appendix</span>' +
        '<span class="pv-e-t">古泰拉谚语</span>' +
        '<span class="pv-e-n">' + pvCount + ' 条拓片 · Gutaira Proverbs</span>' +
      '</a>';
    }
    var jcCount = juechuData().items.length;
    if (jcCount) {
      html += '<a class="pv-entry" href="#/juechu">' +
        '<span class="pv-e-k">附 II · Appendix</span>' +
        '<span class="pv-e-t">厥初</span>' +
        '<span class="pv-e-n">' + jcCount + ' 型 · Juechu · 缺 II 与 XI</span>' +
      '</a>';
    }

    html += '<div class="colophon">© 2026 ' + esc(DATA.title) + ' | ' + esc(DATA.titleEn) +
      ' BY XANTHANL<br>正文以 Markdown 手稿原样渲染 · 托管于 GitHub Pages</div>';

    el.view.innerHTML = html;
    document.title = DATA.title + ' | ' + DATA.titleEn;
    window.scrollTo(0, 0);
  }

  /* ---------- 古泰拉谚语（作者收藏） ----------
   * 与章首引文是两套东西：那边为某一章服务，这边是私人的句子收藏。
   *
   * ⚠️ 只有一版，就是这个世界的那一版。2026-10-13 删掉了「原版 / 原型」折叠 ——
   *   页面上不再出现替换前的句子，proverbs.js 里也没有 origin 字段了。
   *   不要再往这里加折叠开关、不要再给 KEY 加 origin。
   */
  function proverbsData() {
    var p = window.PROVERBS;
    return p && p.items ? p : { intro: {}, items: [] };
  }

  /* 挂到某一章前面的那条谚语。chapter 只在 proverbs.js 里写一次，
     章节页和谚语页双向都从这一个字段读，不要两边各配一份表。 */
  function pvForChapter(n) {
    var items = proverbsData().items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].chapter === n) return items[i];
    }
    return null;
  }

  function renderProverbs() {
    var P = proverbsData();
    if (!P.items.length) { go('catalog'); return; }

    /* 离开上一章之前，把它的位置存下来 */
    if (current) savePos();

    current = 0;
    el.body.setAttribute('data-view', 'proverbs');
    el.root.setAttribute('data-view', 'proverbs');
    markActive(0);
    updateMobileBar();

    var intro = P.intro || {};

    var html =
      '<section class="cover pv-cover">' +
        '<div class="kicker">Gutaira Proverbs · 拓片辑</div>' +
        '<h1>古泰拉谚语</h1>' +
        '<div class="en">Collected Inscriptions</div>' +
        '<p class="lede">' + esc(intro.lead || '') + '</p>' +
        '<div class="stats">' +
          '<div><b>' + P.items.length + '</b><span>条拓片</span></div>' +
          '<div><b>' + DATA.totalChapters + '</b><span>章引文</span></div>' +
          '<div><b>1018</b><span>宇宙纪元</span></div>' +
        '</div>' +
      '</section>' +
      '<p class="pv-note">' + esc(intro.note || '') + '</p>';

    html += '<ol class="pv-list">';

    P.items.forEach(function (it) {
      var n = pad(it.id);
      html += '<li class="pv-item">' +
        '<div class="pv-head">' +
          '<span class="pv-n">' + n + '</span>' +
          '<span class="pv-tags">' + (it.tags || []).map(esc).join(' · ') + '</span>' +
        '</div>' +
        '<blockquote class="pv-quote">' +
          (it.lines || []).map(function (l) {
            return '<span class="l">' + esc(l) + '</span>';
          }).join('') +
        '</blockquote>' +
        '<p class="pv-src">' + esc(it.source || '') + '</p>';

      /* 挂了章节的，给一条回去的路 */
      var ch = it.chapter && DATA.byNumber[it.chapter];
      if (ch) {
        html += '<a class="pv-goto" href="#/' + ch.number + '">' +
                  '挂在 <b>第 ' + pad(ch.number) + ' 章</b> ' + esc(ch.title) + ' 前面' +
                '</a>';
      }
      html += '</li>';
    });

    html += '</ol><a class="back-catalog" href="#/catalog">返回目录</a>';

    el.view.innerHTML = html;
    document.title = '古泰拉谚语 · ' + DATA.title;
    window.scrollTo(0, 0);
    afterLayout(onScroll);
  }

  /* ---------- 厥初 ----------
   * 古泰拉铸的三十六个初型。与拓片辑是同一个考古层：
   * 拓片是古泰拉墙上的字，厥初是古泰拉册子上的人型。
   *
   * ⚠️ 名字、称号、归口、原籍、四件套全部一字不动地照搬 —— 作者定的（04_editing/juechu.md）。
   *   不要「翻译成泰拉语汇」：它是出土物，泰拉人照抄，并不知道那是什么。
   *   本书自己写的只有 trace（它在泰拉落在哪）。
   */
  function juechuData() {
    var j = window.JUECHU;
    return j && j.items ? j : { intro: {}, dims: [], groups: [], items: [] };
  }

  /* 九轴读数：一格一轴，基线在中线，正值往上、负值往下。
     刻度 -3 ~ +3，只问方向不问强度。 */
  function vecBar(vec, dims) {
    var h = '';
    for (var i = 0; i < dims.length; i++) {
      var d = dims[i], v = vec && typeof vec[i] === 'number' ? vec[i] : 0;
      var pct = Math.abs(v) / 3 * 50;
      var up = v >= 0;
      var side = v === 0 ? '中线' : (up ? d.pos : d.neg);
      h += '<i class="jc-v" title="' + esc(d.k + ' ' + side + ' ' + (v > 0 ? '+' : '') + v) + '">' +
             '<b style="' + (up ? 'bottom:50%;' : 'top:50%;') + 'height:' + pct.toFixed(1) + '%"></b>' +
           '</i>';
    }
    return '<div class="jc-vec" aria-hidden="true">' + h + '</div>';
  }

  function renderJuechu() {
    var J = juechuData();
    if (!J.items.length) { go('catalog'); return; }

    if (current) savePos();

    current = 0;
    el.body.setAttribute('data-view', 'juechu');
    el.root.setAttribute('data-view', 'juechu');
    markActive(0);
    updateMobileBar();

    var intro = J.intro || {};
    var zheng = J.items.filter(function (it) { return it.grp === 'zheng'; }).length;

    var html =
      '<section class="cover pv-cover">' +
        '<div class="kicker">Juechu · 厥初</div>' +
        '<h1>厥初</h1>' +
        '<div class="en">The First Cast</div>' +
        '<p class="lede">' + esc(intro.lead || '') + '</p>' +
        '<div class="stats">' +
          '<div><b>' + J.items.length + '</b><span>型</span></div>' +
          '<div><b>' + zheng + '</b><span>正型</span></div>' +
          '<div><b>缺 II · XI</b><span>编号</span></div>' +
        '</div>' +
      '</section>' +
      '<p class="pv-note">' + esc(intro.note || '') + '</p>';

    /* 九轴读法只列一次，条目里不再重复标签 */
    if (J.dims.length) {
      html += '<section class="jc-dims"><h2>九轴读法</h2><dl>';
      J.dims.forEach(function (d) {
        html += '<div><dt>' + esc(d.k) + '</dt>' +
                  '<dd><b>' + esc(d.pos) + '</b> ↔ <b>' + esc(d.neg) + '</b>' +
                  '<span>' + esc(d.ask || '') + '</span></dd></div>';
      });
      html += '</dl></section>';
    }

    J.groups.forEach(function (g) {
      var list = J.items.filter(function (it) { return it.grp === g.key; });
      if (!list.length) return;
      html += '<section class="jc-grp">' +
                '<h2>' + esc(g.name) + ' <span>' + list.length + '</span></h2>' +
                '<p class="jc-g-note">' + esc(g.note || '') + '</p>' +
                '<ol class="jc-list">';

      list.forEach(function (it) {
        html += '<li class="jc-item">' +
          '<div class="jc-head">' +
            '<span class="jc-num' + (it.num ? '' : ' is-none') + '">' + esc(it.num || '—') + '</span>' +
            '<span class="jc-name">' + esc(it.name) + '</span>' +
            '<span class="jc-title">' + esc(it.title) + '</span>' +
            (it.zai ? '<span class="jc-zai is-' + (it.zai === '在册' ? 'on' : 'off') + '">' +
                        esc(it.zai) + '</span>' : '') +
          '</div>' +
          '<p class="jc-core">' + esc(it.core) + '</p>' +
          '<blockquote class="jc-quote">' + esc(it.quote) + '</blockquote>' +
          vecBar(it.vec, J.dims) +
          '<div class="jc-sides">' +
            '<div class="jc-side is-light"><span class="k">成</span><p>' + esc(it.light) + '</p></div>' +
            '<div class="jc-side is-shadow"><span class="k">积</span><p>' + esc(it.shadow) + '</p></div>' +
          '</div>' +
          '<p class="jc-trace"><span class="k">在泰拉</span>' + esc(it.trace) + '</p>' +
          '<p class="jc-meta">归口 ' + esc(it.gui) + ' · 原籍 ' + esc(it.yuan) + '</p>' +
        '</li>';
      });

      html += '</ol></section>';
    });

    html += '<a class="back-catalog" href="#/catalog">返回目录</a>';

    el.view.innerHTML = html;
    document.title = '厥初 · ' + DATA.title;
    window.scrollTo(0, 0);
    afterLayout(onScroll);
  }

  /* ---------- 角色卡（本书自己的人） ----------
   * 与厥初是两层：厥初是出土物，角色是现在活着的人。
   * 九轴读数直接复用厥初的 dims（九轴是同一套世界语）。 */
  function castData() {
    var c = window.CAST;
    return c && c.items ? c : { intro: {}, items: [] };
  }

  function renderCast() {
    var C = castData();
    if (!C.items.length) { go('catalog'); return; }
    if (current) savePos();

    current = 0;
    el.body.setAttribute('data-view', 'cast');
    el.root.setAttribute('data-view', 'cast');
    markActive(0);
    updateMobileBar();

    var dims = juechuData().dims;
    var J = juechuData().items;

    var intro = C.intro || {};
    var matched = C.items.filter(function (it) { return !!it.jc; }).length;

    var html =
      '<section class="cover pv-cover">' +
        '<div class="kicker">Cast · 角色</div>' +
        '<h1>角色</h1>' +
        '<div class="en">The Living</div>' +
        '<p class="lede">' + esc(intro.lead || '') + '</p>' +
        '<div class="stats">' +
          '<div><b>' + C.items.length + '</b><span>人</span></div>' +
          '<div><b>' + matched + '</b><span>已配型</span></div>' +
        '</div>' +
      '</section>' +
      '<p class="pv-note">' + esc(intro.note || '') + '</p>';

    C.items.forEach(function (it) {
      var jc = it.jc ? J.filter(function (x) { return x.id === it.jc; })[0] : null;
      var jcLabel = jc
        ? (esc(jc.name) + '（' + esc(jc.title) + (jc.num ? '，' + esc(jc.num) : '') + '）')
        : '';

      html += '<article class="cast-card">' +
        '<div class="cast-head">' +
          '<h2 class="cast-name">' + esc(it.name) + '</h2>' +
          (it.hao ? '<span class="cast-hao">' + esc(it.hao) + '</span>' : '') +
        '</div>';

      if (jc) {
        html += '<a class="cast-jc" href="#/juechu"><span class="k">配型</span>' +
                  jcLabel + ' <span class="arr">→</span></a>';
      }

      html += '<p class="cast-core">' + esc(it.core) + '</p>' +
        '<blockquote class="cast-quote">' + esc(it.quote) + '</blockquote>' +
        (it.quoteSrc ? '<p class="cast-qsrc"><span class="k">出处</span>' + esc(it.quoteSrc) + '</p>' : '') +
        vecBar(it.vec, dims) +
        '<div class="cast-sides">' +
          '<div class="cast-side is-light"><span class="k">成</span><p>' + esc(it.light) + '</p></div>' +
          '<div class="cast-side is-shadow"><span class="k">积</span><p>' + esc(it.shadow) + '</p></div>' +
        '</div>';

      if (it.gap) {
        html += '<p class="cast-gap"><span class="k">与配型之分</span>' + esc(it.gap) + '</p>';
      }

      if (it.basis && it.basis.length) {
        html += '<details class="cast-basis"><summary>九轴依据</summary><dl>';
        it.basis.forEach(function (b) {
          var cls = b.v > 0 ? 'is-pos' : b.v < 0 ? 'is-neg' : 'is-zero';
          html += '<div><dt>' + esc(b.k) + ' <b class="' + cls + '">' + (b.v > 0 ? '+' : '') + b.v + '</b></dt>' +
                    '<dd>' + esc(b.why) + '</dd></div>';
        });
        html += '</dl></details>';
      }

      html += '</article>';
    });

    html += '<a class="back-catalog" href="#/catalog">返回目录</a>';

    el.view.innerHTML = html;
    document.title = '角色 · ' + DATA.title;
    window.scrollTo(0, 0);
    afterLayout(onScroll);
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

    /* 离开上一章之前，先把它的位置存下来 */
    if (current && current !== n) savePos();

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
          '<i class="orn orn-body" aria-hidden="true"></i>' +
          '<div class="ch-eyebrow"><em>第 ' + ch.number + ' 章</em>' +
          '<span>' + (vol ? esc(vol.title) + ' · ' + esc(vol.subtitle) : '') + '</span></div>' +
          '<h1 class="ch-title">' + esc(heading) + '</h1>' +
          '<div class="ch-meta">' +
            '<span>' + fmtChars(parsed.chars) + '</span>' +
            '<span>' + ch.number + ' / ' + DATA.totalChapters + '</span>' +
            '<span>' + esc(DATA.titleEn) + '</span>' +
          '</div>' +
        '</header>' +
        epigraphHtml(ch) +
        pvEpigraphHtml(ch.number) +
        '<div class="prose">' + parsed.html + '</div>' +
        '<i class="orn orn-end" aria-hidden="true"></i>' +
        nav +
        '<a class="back-catalog" href="#/catalog">返回目录</a>' +
      '</article>';

    document.title = '第 ' + ch.number + ' 章 ' + ch.title + ' · ' + DATA.title;

    /* 恢复上次读到的位置（换字号/换屏宽也不会错位，因为记的是块序号） */
    window.scrollTo(0, 0);
    afterLayout(function () {
      var y = restorePos(ch.number);
      if (y > 0) { window.scrollTo(0, y); showResumeTip(); } else { hideResumeTip(); }
      onScroll();
    });
  }

  /* 章首引文：古泰拉谚语 / 角色台词。古泰拉 = 我们的时代，
     所以用的都是中文读者耳熟能详的句子 —— 出处说明本身就是世界感。 */
  function epigraphHtml(ch) {
    var e = ch && ch.epigraph;
    if (!e || !e.quote) return '';
    return '<blockquote class="ch-epigraph">' +
             '<p class="epi-q">' + esc(e.quote) + '</p>' +
             (e.source ? '<p class="epi-s">' + esc(e.source) + '</p>' : '') +
           '</blockquote>';
  }

  /* 拓片辑里挂在这一章前面的那条。
     接在章节自己的引文后面，不替换它 —— 那一句的字数跟正文里「X 个字」是绑死的。 */
  function pvEpigraphHtml(n) {
    var it = pvForChapter(n);
    if (!it) return '';
    var html =
      '<blockquote class="ch-epigraph ch-epigraph-2">' +
        '<p class="epi-k">同页拓片 · 第 ' + pad(it.id) + ' 号</p>' +
        '<p class="epi-q">' + (it.lines || []).map(esc).join('<br>') + '</p>' +
        '<p class="epi-s">' + esc(it.source || '') + '</p>' +
        '<a class="epi-link" href="#/proverbs">全部拓片 →</a>';
    return html + '</blockquote>';
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
    if (h === 'proverbs') { renderProverbs(); return; }
    if (h === 'juechu') { renderJuechu(); return; }
    if (h === 'cast') { renderCast(); return; }
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

  /* 四套色温。顺序 = 顶栏按钮的循环顺序：先两套亮，再两套暗。 */
  var THEMES = [
    { id: 'ikb',       name: '克莱因', en: 'Klein' },
    { id: 'parchment', name: '羊皮纸', en: 'Parchment' },
    { id: 'vespers',   name: '夜祷',   en: 'Vespers' },
    { id: 'candle',    name: '烛焰',   en: 'Candle' }
  ];

  function themeIdx(t) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === t) return i;
    return -1;
  }

  /* 旧读者 localStorage 里存的是 light / dark 两个字。
     映射而不是丢弃 —— 那是一次没打招呼就改掉别人偏好的机会。 */
  function normalizeTheme(t) {
    if (t === 'light') return 'ikb';
    if (t === 'dark') return 'vespers';
    return themeIdx(t) >= 0 ? t : 'ikb';
  }

  function setTheme(raw, persist) {
    var t = normalizeTheme(raw);
    var i = themeIdx(t);
    el.root.setAttribute('data-theme', t);

    /* 色板的选中态。⚠️ 不能用 inline onclick —— IIFE 里的函数挂不到 window 上，
       必须走 data-attr + 事件委托。 */
    if (el.swatches) {
      var sws = el.swatches.querySelectorAll('[data-theme]');
      for (var k = 0; k < sws.length; k++) {
        sws[k].setAttribute('aria-pressed', String(sws[k].getAttribute('data-theme') === t));
      }
    }
    if (el.themeVal) el.themeVal.textContent = THEMES[i].name;
    /* 顶栏按钮写「下一套」的名字，不然点下去是什么无从预期 */
    if (el.themeBtn) el.themeBtn.textContent = THEMES[(i + 1) % THEMES.length].name;

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

  /* ---------- 阅读位置记忆 ----------
   * 记的是「视口顶部落在第几个块上」，不是像素。
   * 这样读者改了字号/行距，或者换个屏幕宽度，位置依然对得上。
   */
  function proseBlocks() {
    return el.view.querySelectorAll('.prose > *');
  }

  function savePos() {
    if (!current || el.body.getAttribute('data-view') !== 'chapter') return;
    var blocks = proseBlocks();
    if (!blocks.length) return;
    var top = window.scrollY + 100;
    var idx = 0;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].offsetTop <= top) idx = i; else break;
    }
    /* 按章节分开存：只存一份的话，切到别的章一滚动就把它冲掉了 */
    save(KEY.pos + '.' + current, JSON.stringify({ n: current, i: idx, t: Date.now() }));
  }

  function restorePos(n) {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY.pos + '.' + n) || 'null'); } catch (e) { raw = null; }
    if (!raw || raw.n !== n) return 0;
    /* 第 0 块就是开头，不用跳 —— 跳了反而像 bug */
    if (!raw.i) return 0;
    var blocks = proseBlocks();
    var target = blocks[raw.i];
    if (!target) return 0;
    var y = target.offsetTop - 100;
    return y > 200 ? y : 0;
  }

  /* 等布局真的稳了再定位：字体没加载完时 offsetTop 是错的，
     恢复过去会偏掉几十个块。字体 + 两帧。 */
  function afterLayout(fn) {
    var done = function () {
      requestAnimationFrame(function () { requestAnimationFrame(fn); });
    };
    try {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(done, done);
        return;
      }
    } catch (e) {}
    done();
  }

  function showResumeTip() {
    var tip = document.getElementById('resumeTip');
    if (!tip) return;
    tip.hidden = false;
    clearTimeout(tip._timer);
    tip._timer = setTimeout(function () { tip.hidden = true; }, 6000);
  }
  function hideResumeTip() {
    var tip = document.getElementById('resumeTip');
    if (tip) { clearTimeout(tip._timer); tip.hidden = true; }
  }

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    el.progress.style.width = (p * 100).toFixed(2) + '%';
    savePos();
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

    /* 恢复位置提示条 */
    var resumeTop = document.getElementById('resumeTop');
    var resumeClose = document.getElementById('resumeClose');
    if (resumeTop) resumeTop.addEventListener('click', function () {
      window.scrollTo(0, 0); hideResumeTip();
    });
    if (resumeClose) resumeClose.addEventListener('click', hideResumeTip);

    /* 关掉页面 / 刷新之前再存一次，滚动节流可能还没落盘 */
    window.addEventListener('beforeunload', savePos);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') savePos();
    });

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

    /* 色温：顶栏按钮循环到下一条；抽屉里的色板直接选 */
    el.themeBtn.addEventListener('click', function () {
      var cur = normalizeTheme(el.root.getAttribute('data-theme'));
      setTheme(THEMES[(themeIdx(cur) + 1) % THEMES.length].id, true);
    });
    if (el.swatches) {
      el.swatches.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-theme]');
        if (b) setTheme(b.getAttribute('data-theme'), true);
      });
    }

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
      swatches: document.querySelector('.swatches'),
      themeVal: $('themeVal'),
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

    setTheme(normalizeTheme(el.root.getAttribute('data-theme')), false);
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
