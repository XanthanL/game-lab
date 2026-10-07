/* 降噪练习本 · pack.js
 * ------------------------------------------------------------------
 * 交付物本体。整页只有一件事：让「认出那句话」变成「今天少响一次」。
 *
 * 三条设计约束（改之前先读）：
 *   1. 不给人打分。这里唯一被记录的数字是「音量」——一个主观读数，
 *      不是成绩、不是进度条、不做任何「你变好了」的判断。措辞上一律中性。
 *   2. 一天一条。攒着不做是这类练习唯一的失败方式，所以入口只放一个动作。
 *   3. 全部存本机。没有服务端，也永远不会有——所以「清空」要问一次，
 *      因为清了就真没了。
 *
 * 存储键前缀与主站一致（cht.v1.），unlocked 因此天然跨页共享。
 */
(function () {
  'use strict';

  var D = window.DATA || {};
  var PK = D.pack || {};
  var PKEY = 'cht.v1.';

  /* ---------- 存取 ---------- */
  var mem = {};
  function get(k) {
    try { return localStorage.getItem(PKEY + k); } catch (e) { return mem[k] === undefined ? null : mem[k]; }
  }
  function set(k, v) {
    try { localStorage.setItem(PKEY + k, v); } catch (e) { mem[k] = v; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function habit(code) {
    var r = (D.habits || []).filter(function (h) { return h.code === code; });
    return r[0] || (D.habits || [])[0];
  }
  /* 可点元素：顺手把键盘也接上，免得只在触屏上能用 */
  function tappable(el, fn, role) {
    el.setAttribute('role', role || 'button');
    if (role === 'checkbox') el.setAttribute('aria-checked', 'false');
    el.tabIndex = 0;
    el.addEventListener('click', fn);
    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fn(); }
    });
  }
  function markOn(el, on) {
    el.classList.toggle('on', on);
    if (el.getAttribute('role') === 'checkbox') el.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  /* ---------- 日期 ---------- */
  function dayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dayShow(s) { return s.slice(5).replace('-', ' / '); }

  /* ---------- 解锁 ---------- */
  function urlKey() {
    var m = /[?&]k=([^&#]+)/.exec(location.search || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function unlockFromUrl() {
    var k = urlKey();
    if (k && window.CKEY && window.CKEY.valid(k, D.keyfps)) {
      set('unlocked', k.toUpperCase());
      return true;
    }
    return false;
  }
  function alreadyUnlocked() {
    var k = get('unlocked') || '';
    return !!(k && window.CKEY && window.CKEY.valid(k, D.keyfps));
  }
  function showMain() {
    $('pk-lock').hidden = true;
    $('pk-nav').hidden = false;   // 没解锁时不摆区块导航：点了会滚到一个空页面
    $('pk-main').hidden = false;
    if (location.hash) {
      var t = document.querySelector(location.hash);
      if (t) setTimeout(function () { t.scrollIntoView(); }, 60);
    }
  }
  function showLock(msg) {
    $('pk-lock').hidden = false;
    $('pk-main').hidden = true;
    if (msg) $('pk-lock-tip').textContent = msg;
  }

  /* ---------- 记录 ---------- */
  var entries = [];      // [{d,c,q,s,b,a}]
  function loadEntries() {
    try { entries = JSON.parse(get('pack.entries') || '[]') || []; } catch (e) { entries = []; }
    entries = entries.filter(function (e) { return e && e.d && habit(e.c); });
  }
  function saveEntries() { set('pack.entries', JSON.stringify(entries)); }
  function entryOf(day) {
    var r = entries.filter(function (e) { return e.d === day; });
    return r[0] || null;
  }

  /* ---------- 今日草稿 ---------- */
  var drafts = {};       // code -> {q,s,asks,act}
  var today = dayStr();
  var state = { sel: '', b: 5, a: 5 };

  function loadDraft() {
    try { drafts = JSON.parse(get('pack.drafts') || '{}') || {}; } catch (e) { drafts = {}; }
    var t = null;
    try { t = JSON.parse(get('pack.today') || 'null'); } catch (e) { t = null; }
    if (t && t.d === today) {
      state.sel = t.sel || '';
      state.b = typeof t.b === 'number' ? t.b : 5;
      state.a = typeof t.a === 'number' ? t.a : 5;
      return;
    }
    /* 今天已经记过、草稿却没留下（换了设备或清过缓存）：按那条记录回填。
       否则一进来滑块停在 5，一按保存就把原来那条悄悄覆盖了。*/
    var e = entryOf(today);
    if (e) {
      state.sel = e.c;
      state.b = e.b;
      state.a = e.a;
      drafts[e.c] = { q: e.q || '', s: e.s || '', asks: [false, false, false], act: false };
    }
  }
  function saveDraft() {
    set('pack.drafts', JSON.stringify(drafts));
    set('pack.today', JSON.stringify({ d: today, sel: state.sel, b: state.b, a: state.a }));
  }
  function draftOf(code) {
    if (!drafts[code]) {
      /* s 刻意留空。卡片上已经印了建议的那句，输入框再预填一遍的话，
         人会当成「已经写好了」，一个字不改地交上来 —— 交出来的还是卡上那句。*/
      drafts[code] = { q: '', s: '', asks: [false, false, false], act: false };
    }
    if (!Array.isArray(drafts[code].asks) || drafts[code].asks.length !== 3) {
      drafts[code].asks = [false, false, false];
    }
    return drafts[code];
  }

  /* 默认选哪张卡：优先用主页测出来的命中顺序 */
  function firstCode() {
    var picks = [];
    try { picks = JSON.parse(get('picks') || '[]') || []; } catch (e) { picks = []; }
    for (var i = 0; i < picks.length; i++) {
      var h = (D.habits || []).filter(function (x) { return x.id === picks[i]; })[0];
      if (h) return h.code;
    }
    return ((D.habits || [])[0] || {}).code || '';
  }
  function hitCodes() {
    var picks = [];
    try { picks = JSON.parse(get('picks') || '[]') || []; } catch (e) { return []; }
    return (D.habits || []).filter(function (h) { return picks.indexOf(h.id) >= 0; })
      .map(function (h) { return h.code; });
  }

  /* ---------- 封面 / 静态文案 ---------- */
  function renderStatic() {
    $('pk-title').textContent = PK.title || '降噪练习本';
    $('pk-sub').textContent = PK.sub || '';
    $('pk-lead').textContent = PK.lead || '';
    $('pk-daytip').textContent = PK.dayTip || '';
    $('pk-keepnote').textContent = PK.keepNote || '';
    $('pk-fine').textContent = PK.fine || '';
    $('pk-lock-tip').textContent = PK.lockTip || '码在发货消息里，开头是四位，后面还有一截。';
    $('pk-howto').innerHTML = (PK.howto || []).map(function (t, i) {
      return '<li><b>' + ('0' + (i + 1)).slice(-2) + '</b><span>' + esc(t) + '</span></li>';
    }).join('');
  }

  /* ---------- 今日 ---------- */
  function renderPick() {
    var box = $('pk-pick');
    var hits = hitCodes();
    var order = (D.habits || []).slice().sort(function (x, y) {
      return hits.indexOf(y.code) - hits.indexOf(x.code);
    });
    box.innerHTML = order.map(function (h) {
      var on = h.code === state.sel ? ' on' : '';
      var hit = hits.indexOf(h.code) >= 0 ? ' hit' : '';
      return '<button type="button" class="' + (on + hit).trim() + '" data-c="' + h.code + '"' +
        ' aria-pressed="' + (h.code === state.sel) + '">' +
        esc(h.tag || h.name) + '<b>' + h.code + '</b></button>';
    }).join('');
    Array.prototype.forEach.call(box.children, function (btn) {
      btn.addEventListener('click', function () {
        if (state.sel === btn.getAttribute('data-c')) return;
        state.sel = btn.getAttribute('data-c');
        saveDraft(); renderPick(); renderDay();
      });
    });
  }

  function renderDay() {
    var h = habit(state.sel);
    var df = draftOf(state.sel);
    var L = PK.labels || {};
    var done = !!entryOf(today);

    var asks = (h.ask || []).map(function (t, i) {
      return '<div class="pk-ask' + (df.asks[i] ? ' on' : '') + '" data-i="' + i + '" role="checkbox"' +
        ' aria-checked="' + !!df.asks[i] + '" tabindex="0">' +
        '<b>' + ('0' + (i + 1)).slice(-2) + '</b><span>' + esc(t) + '</span></div>';
    }).join('');

    $('pk-day-card').innerHTML =
      '<div class="pk-dc-top"><span class="pk-dc-code">' + esc(h.code) + '</span>' +
        (h.tag ? '<span class="pk-dc-tag">' + esc(h.tag) + '</span>' : '') + '</div>' +
      '<h3 class="pk-dc-name">' + esc(h.name) + '</h3>' +
      '<p class="pk-dc-one">' + esc(h.one) + '</p>' +

      '<div class="pk-asks"><p>' + esc(L.ask || '问自己三句') + '</p>' + asks + '</div>' +

      '<div class="pk-swap">' +
        '<p>' + esc(L.swap || '换成哪句') + '</p>' +
        '<p class="pk-swap-q">' + esc(h.swap) + '</p>' +
        '<textarea id="pk-swap-in" rows="2" placeholder="按你的说法改一遍，改完就是你的了">' + esc(df.s) + '</textarea>' +
      '</div>' +

      '<div class="pk-act' + (df.act ? ' on' : '') + '" id="pk-act" role="checkbox"' +
        ' aria-checked="' + !!df.act + '" tabindex="0">' +
        '<b>✓</b><span><em>' + esc(L.act || '今天做一件小事') + '</em><i>' + esc(h.act) + '</i></span></div>' +

      '<div class="pk-vol">' +
        volRow('b', PK.volBefore || '写之前，它有多响', state.b) +
        volRow('a', PK.volAfter || '写完之后，还剩多响', state.a) +
        '<div class="pk-vol-ends"><span>1 · ' + esc(PK.volLow || '') + '</span>' +
          '<span>10 · ' + esc(PK.volHigh || '') + '</span></div>' +
      '</div>';

    /* 交互绑定 */
    Array.prototype.forEach.call($('pk-day-card').querySelectorAll('.pk-ask'), function (el) {
      tappable(el, function () {
        var i = +el.getAttribute('data-i');
        df.asks[i] = !df.asks[i];
        markOn(el, df.asks[i]);
        saveDraft();
      }, 'checkbox');
    });
    tappable($('pk-act'), function () {
      df.act = !df.act;
      markOn($('pk-act'), df.act);
      saveDraft();
    }, 'checkbox');
    $('pk-swap-in').addEventListener('input', function () {
      df.s = this.value; saveDraft();
    });
    Array.prototype.forEach.call($('pk-day-card').querySelectorAll('input[type=range]'), function (r) {
      r.addEventListener('input', function () {
        var v = +this.value;
        state[this.getAttribute('data-f')] = v;
        this.style.setProperty('--pv', pct(v));
        this.parentNode.querySelector('.pk-vol-num').textContent = v;
        saveDraft();
      });
    });

    $('pk-save').textContent = done ? '改一改，再记一次' : '记下来';
  }

  function volRow(f, label, v) {
    return '<div class="pk-vol-row"><span class="pk-vol-lab">' + esc(label) + '</span>' +
      '<input type="range" min="1" max="10" step="1" value="' + v + '" data-f="' + f + '"' +
      ' style="--pv:' + pct(v) + '" aria-label="' + esc(label) + '">' +
      '<span class="pk-vol-num">' + v + '</span></div>';
  }
  function pct(v) { return ((v - 1) / 9 * 100).toFixed(1) + '%'; }

  function saveDay() {
    var df = draftOf(state.sel);
    var e = { d: today, c: state.sel, q: df.q || '', s: (df.s || '').trim(), b: state.b, a: state.a };
    entries = entries.filter(function (x) { return x.d !== today; });
    entries.push(e);
    saveEntries();
    renderLog();
    renderDay();
    var note = $('pk-save-note');
    note.textContent = '写下来了。这一条已经记到下面的记录里。';
    setTimeout(function () { if (note.textContent.indexOf('写下来了') === 0) note.textContent = ''; }, 4000);
  }

  /* ---------- 记录区 ---------- */
  function avg(list) {
    if (!list.length) return 0;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }
  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function sorted() {
    return entries.slice().sort(function (x, y) { return x.d < y.d ? -1 : (x.d > y.d ? 1 : 0); });
  }
  function dayCount() {
    var s = {};
    entries.forEach(function (e) { s[e.d] = 1; });
    return Object.keys(s).length;
  }

  function renderLog() {
    var es = sorted();
    /* 条带：30 个槽位，已记录的格子按「写完之后」的音量给一个高度 */
    var strips = [];
    for (var i = 0; i < 30; i++) {
      var e = es[i];
      if (e) {
        strips.push('<i class="on" title="' + esc(dayShow(e.d)) + '" style="--h:' +
          Math.max(12, Math.round(e.a / 10 * 100)) + '%"></i>');
      } else {
        strips.push('<i></i>');
      }
    }
    $('pk-strip').innerHTML = strips.join('');

    if (!es.length) {
      $('pk-stat').innerHTML = '';
      $('pk-log').innerHTML = '<div class="pk-log-empty">' + esc(PK.emptyDay || '还没有记录。') + '</div>';
      return;
    }

    var nb = avg(es.map(function (e) { return e.b; }));
    var na = avg(es.map(function (e) { return e.a; }));
    $('pk-stat').innerHTML =
      '<div><span>记过的天数</span><b>' + dayCount() + ' 天</b></div>' +
      '<div><span>写之前 · 平均音量</span><b>' + f1(nb) + '</b></div>' +
      '<div><span>写完之后 · 平均音量</span><b>' + f1(na) + '</b></div>' +
      '<p class="pk-stat-note">' + esc(PK.statNote || '') + '</p>';

    $('pk-log').innerHTML = es.slice().reverse().map(function (e, i) {
      var h = habit(e.c);
      return '<article class="pk-entry">' +
        '<div class="pk-entry-h"><time>' + esc(dayShow(e.d)) + '</time>' +
          '<b>' + esc(e.c) + '</b>' +
          '<span class="pk-vol-badge">' + e.b + ' → ' + e.a + '</span></div>' +
        (e.q ? '<p class="pk-entry-q">' + esc(e.q) + '</p>' : '') +
        (e.s ? '<p class="pk-entry-s">' + esc(e.s) + '</p>' : '') +
        '</article>';
    }).join('');
  }

  /* ---------- 导出 ---------- */
  function exportText() {
    var es = sorted();
    var out = ['降噪练习本 · 我的记录'];
    if (!es.length) {
      out.push('还没开始记。第一条不用写得漂亮，写得像就行。');
      return out.join('\n');
    }
    out.push('记过 ' + dayCount() + ' 天 · 音量 ' +
      f1(avg(es.map(function (e) { return e.b; }))) + ' → ' +
      f1(avg(es.map(function (e) { return e.a; }))));
    out.push('');
    es.forEach(function (e, i) {
      out.push(('0' + (i + 1)).slice(-2) + ' · ' + dayShow(e.d) + '  ' + e.c);
      if (e.q) out.push('那句：' + e.q);
      if (e.s) out.push('换句：' + e.s);
      out.push('音量 ' + e.b + ' → ' + e.a);
      out.push('');
    });
    return out.join('\n').replace(/\s+$/, '');
  }

  function doExport() {
    var t = exportText();
    var note = $('pk-export-note');
    var box = $('pk-export-box');
    if (!box) {
      box = document.createElement('textarea');
      box.id = 'pk-export-box';
      box.readOnly = true;
      box.rows = 10;
      box.className = 'pk-swap';
      box.style.cssText = 'margin-top:12px;width:100%;font-family:inherit;font-size:13px;' +
        'line-height:1.7;color:var(--ink);background:#fff;border:1px solid var(--line);' +
        'border-radius:14px;padding:12px;resize:vertical;outline:none';
      $('pk-log-btns').parentNode.insertBefore(box, $('pk-export-note'));
    }
    box.value = t;
    box.hidden = false;
    var ok = function () { note.textContent = PK.copyOk || '已复制'; };
    var fail = function () {
      note.textContent = PK.copyFail || '复制没成功，上面这段可以自己选';
      try { box.focus(); box.select(); } catch (e) { /* 选不中也不拦着 */ }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(ok, fail);
    } else {
      try {
        box.select();
        document.execCommand('copy') ? ok() : fail();
      } catch (e) { fail(); }
    }
  }

  /* ---------- 十张卡 ---------- */
  function renderCards() {
    var L = PK.labels || {};
    $('pk-cards').innerHTML = (D.habits || []).map(function (h, i) {
      var scenes = (h.signs || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
      var asks = (h.ask || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<article class="pk-card" data-c="' + h.code + '">' +
        '<button class="pk-card-h" type="button" aria-expanded="false">' +
          '<span class="pk-card-n">' + ('0' + (i + 1)).slice(-2) + '</span>' +
          '<span class="pk-card-t"><b>' + esc(h.code) + '</b>' +
            '<span>' + esc(h.name) + '</span>' +
            '<i>' + esc(h.tag || '') + '</i></span>' +
          '<svg class="pk-card-x" viewBox="0 0 20 20" aria-hidden="true">' +
            '<path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.7" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<div class="pk-card-b"><div class="pk-card-in">' +
          '<div class="pk-blk"><em>' + esc(L.quote || '那句话') + '</em>' +
            '<p class="pk-quote">' + esc(h.one) + '</p></div>' +
          '<div class="pk-blk"><em>' + esc(L.when || '它通常在什么时候冒出来') + '</em>' +
            '<ul>' + scenes + '</ul></div>' +
          '<div class="pk-blk"><em>' + esc(L.ask || '问自己三句') + '</em>' +
            '<ol>' + asks + '</ol></div>' +
          '<div class="pk-blk"><em>' + esc(L.swap || '换成哪句') + '</em>' +
            '<p class="pk-swap-q">' + esc(h.swap) + '</p>' +
            '<p style="margin-top:9px;font-size:12.5px;color:var(--muted)">' + esc(h.contrast || '') + '</p></div>' +
          '<div class="pk-blk"><em>' + esc(L.act || '今天做一件小事') + '</em>' +
            '<div class="pk-do">' + esc(h.act) + '</div></div>' +
          '<div class="pk-blk"><button class="pk-btn pk-btn-ghost" type="button" ' +
            'data-jump="' + h.code + '" style="width:100%">今天就练这张</button></div>' +
        '</div></div></article>';
    }).join('');

    Array.prototype.forEach.call($('pk-cards').querySelectorAll('.pk-card-h'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.parentNode;
        var open = card.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    Array.prototype.forEach.call($('pk-cards').querySelectorAll('[data-jump]'), function (b) {
      b.addEventListener('click', function () {
        state.sel = b.getAttribute('data-jump');
        saveDraft();
        renderPick(); renderDay();
        $('day').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---------- 五样底色 ---------- */
  function renderGiven() {
    $('pk-given').innerHTML = (D.strengths || []).map(function (s) {
      return '<article class="pk-gv">' +
        '<div class="pk-gv-h"><b>' + esc(s.code) + '</b>' +
          (s.tag ? '<i>' + esc(s.tag) + '</i>' : '') + '</div>' +
        '<p class="pk-gv-s">' + esc(s.slogan) + '</p>' +
        '<p class="pk-gv-w">' + esc(s.what) + '</p>' +
        (s.use ? '<div class="pk-gv-u">' + esc(s.use) + '</div>' : '') +
        '</article>';
    }).join('');
  }

  /* ---------- 启动 ---------- */
  function boot() {
    renderStatic();
    if (unlockFromUrl() || alreadyUnlocked()) {
      showMain();
    } else {
      showLock();
      var go = function () {
        var v = ($('pk-code').value || '').replace(/\s/g, '');
        if (window.CKEY && window.CKEY.valid(v, D.keyfps)) {
          set('unlocked', v.toUpperCase());
          $('pk-lock-tip').classList.remove('bad');
          showMain();
        } else {
          $('pk-lock-tip').classList.add('bad');
          $('pk-lock-tip').textContent = '这串码对不上。核对一下发货消息里的链接，或者把整条消息发我看看。';
        }
      };
      $('pk-open').addEventListener('click', go);
      $('pk-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      return;
    }

    loadEntries();
    loadDraft();
    if (!state.sel) state.sel = firstCode();
    if (!habit(state.sel)) state.sel = firstCode();

    renderPick();
    renderDay();
    renderLog();
    renderCards();
    renderGiven();

    $('pk-save').addEventListener('click', saveDay);
    $('pk-export').addEventListener('click', doExport);
    $('pk-reset').addEventListener('click', function () {
      if (!window.confirm(PK.resetAsk || '清空全部记录？')) return;
      entries = []; drafts = {};
      saveEntries();
      set('pack.drafts', '{}');
      set('pack.today', 'null');
      renderLog(); renderDay();
      $('pk-export-note').textContent = PK.resetOk || '已清空';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
