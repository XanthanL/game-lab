/* 认知习惯自测工具 · 逻辑层
 * 0 依赖：原生 JS，localStorage，手写图表
 */
(function () {
  'use strict';

  var D = window.DATA;
  var KEY = 'cht.v1.';
  var SALT = 'cht2026x';
  /* ---------- 两个比例阈值（都按「命中 / 机会」算，不写死绝对分） ----------
     题库从 10 题扩到 60 题后，每条的机会数从 4 变成 24，绝对分不再有意义，
     一切判定改为比例；以后再改题量，这两行不用动。
       SPREAD = 0.30：最高那条占比 ≤ 30% 才算「没有哪条特别突出」。
         60 题下总分恒等于 60（每题必选一条），10 条均分 6，故最大值必 ≥ 6；
         ⌊24×0.30⌋ = 7，取 7 留出余量——避免「随便选」被判成均匀分散。
       DENSE  = 0.75：某条占比 ≥ 75%（24 次里命中 18 次）才提示「几乎每次都出现」。
     免费层不做任何分散兜底，一律列命中数靠前的几条（v2 §0 / §5.3）。
  */
  var SPREAD = 0.30;
  var DENSE = 0.75;
  var ANALYZE_MS = 1800;
  var EVIDENCE_CLIP = 24;             // 证据行里原话的最大字数

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var clip = function (s, n) { return s.length > n ? s.slice(0, n) + '…' : s; };
  var pad2 = function (n) { return n < 10 ? '0' + n : String(n); };

  /* ---------- 图片装饰：统一入口 + 统一降级 ----------
     小图走 sprite（一次加载，多处复用），大图只在结果页按需加载 1 张。
     所有装饰元素都带 class="deco"：sprite 探测失败时给 body 加 .no-art，CSS 一律隐藏。
     所以图没做、没传、或用户网络挂了，页面就是纯文字版——布局不塌，也不留空洞。
  */
  function artOn() { return !!(D.art && D.art.enabled); }
  function habitImg(id) { return D.art.dir + 'ip-' + pad2(id) + '.webp'; }
  function applyArtClasses() {
    if (!artOn()) return;
  }
  // kind='ui'|'ip'|'sc'，idx=精灵图第几格，h=显示高度（宽度按原比例算出）
  function deco(kind, idx, h, cls) {
    if (!artOn()) return '';
    var spec = {
      ui: [D.art.uiSprite, D.art.uiCell, D.art.uiH],
      ip: [D.art.ipSprite, D.art.ipCell, D.art.ipH],
      sc: [D.art.scSprite, D.art.scCell, D.art.scH]
    }[kind];
    if (!spec || !spec[0]) return '';
    var k = h / spec[2];
    var w = Math.round(spec[1] * k);
    return '<i class="deco spr ' + (cls || '') + '" aria-hidden="true" style="' +
      'background-image:url(' + spec[0] + ');' +
      'background-position:' + (-idx * spec[1] * k) + 'px 0;' +
      'background-size:auto ' + h + 'px;' +
      'width:' + w + 'px;height:' + h + 'px"></i>';
  }
  /* 题干卡右上角的场景图：格位由 question.img 指定（1-based）。
     60 题共用 10 个场景格位（按场景大类复用）；img 缺失或超出 scCells 时，
     自动回退「想想」陪伴小人——不会出现裂图，也不会因为加题就得补图。 */
  function sceneDeco(q, h, cls) {
    if (!artOn()) return '';
    var n = (D.art && D.art.scCells) || 10;
    var idx = (q && q.img) ? q.img - 1 : -1;
    if (idx < 0 || idx >= n) return deco('ui', D.art.ui.think, h, cls);
    return deco('sc', idx, h, cls);
  }
  // 探测失败才降级（乐观策略：有图时不延迟，无图时只是短暂空白，不是裂图）
  function probeArt() {
    if (!artOn()) return;
    [D.art.uiSprite, D.art.scSprite].forEach(function (src) {
      if (!src) return;
      var im = new Image();
      im.onerror = function () { document.body.classList.add('no-art'); };
      im.src = src;
    });
  }

  /* ---------- 解锁：fnv1a + salt，纯前端校验 ---------- */
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function signature(body) {
    return (fnv1a(body + SALT) % 1679616).toString(36).toUpperCase().padStart(4, '0');
  }
  function validKey(k) {
    if (!/^[0-9A-Z]{6}$/.test(k)) return false;
    return signature(k.slice(0, 2)) === k.slice(2);
  }
  function makeKey(tail) {
    return (tail + signature(tail)).slice(0, 6).toUpperCase();
  }
  // 控制台里跑 CHT.makeKey('37') 生成解锁码。
  // __test 是给 产出/_smoke.js 和 产出/_layout.js 用的入口：
  // 分享长图的排版只能靠自动化断言守（手点截图看不过来），需要能在无头里直接驱动。
  // ⚠️ 这行在文件靠前位置执行，那时 state 还没声明——直接写 state 会存成 undefined 快照。
  //    所以一律用 getter 现取。
  window.CHT = {
    makeKey: makeKey,
    __test: {
      startQuiz: function () { startQuiz(); },
      answer: function (i) { $('q-opts').children[i].click(); },
      makeShare: function () { makeShare(); },
      score: function () { return score(); },
      get state() { return state; },
      setState: function (o) { for (var k in o) state[k] = o[k]; }
    }
  };

  /* ---------- 存储 ---------- */
  var mem = {};
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(KEY + k);
      localStorage.setItem(KEY + k, v);
    } catch (e) { mem[k] = v; return mem[k]; }
    return null;
  }
  function lsGet(k) { try { return localStorage.getItem(KEY + k); } catch (e) { return mem[k] || null; } }

  /* ---------- 状态 ---------- */
  var state = {
    stage: 'free',
    answers: [],
    unlocked: '',
    cursor: 0
  };

  function load() {
    try { state.answers = JSON.parse(lsGet('answers') || '[]'); } catch (e) { state.answers = []; }
    state.stage = lsGet('stage') || 'free';
    state.unlocked = lsGet('unlocked') || '';
  }
  function save() {
    ls('answers', JSON.stringify(state.answers));
    ls('stage', state.stage);
    ls('unlocked', state.unlocked);
  }

  function scope() {
    return state.stage === 'free' ? D.freeIds.slice() : D.questions.map(function (q) { return q.id; });
  }
  function answered() {
    var s = scope();
    return state.answers.filter(function (a) { return s.indexOf(a.q) >= 0; });
  }
  function pending() {
    var s = scope();
    return s.filter(function (id) {
      return !state.answers.some(function (a) { return a.q === id; });
    });
  }
  function habit(id) {
    return D.habits.filter(function (h) { return h.id === id; })[0];
  }
  function question(id) {
    return D.questions.filter(function (q) { return q.id === id; })[0];
  }
  // 某条习惯在当前题量下的机会数（= 有多少题的某个选项指向它）
  function oppsOf(hid) {
    return scope().filter(function (qid) {
      return question(qid).opts.some(function (o) { return o.h === hid; });
    });
  }

  /* ---------- 计分 ----------
     score 恒等于已答题数（每题必选且只选一条），所以「命中多」是相对的，
     分母（机会数）必须一起给——分母相等，命中数才可比。
     ⚠️ 2026-10-04 起每题 5 个选项，第 5 个是「这次我没被带走」（h:0）。
        它不进任何惯性，所以「命中」不再是 60 题 × 4 选项的必然满额——
        一个人完全可以 40 题都没被带走。此时惯性分母（机会数）不变，
        分子自然降低，这就是我们要的正向空间。
        keptOf() 统计「没被带走」的次数，它是一个**正向指标**，
        不是第 11 条惯性（那样会把它塞进同一个排名里，变成「你得分最高」）。 */
  function keptOf() {
    return answered().filter(function (a) { return !a.h; }).length;
  }
  function score() {
    var out = [];
    D.habits.forEach(function (h) {
      var opps = oppsOf(h.id);
      if (!opps.length) return;
      var hit = answered().filter(function (a) { return a.h === h.id; }).length;
      out.push({ id: h.id, score: hit, opps: opps.length });
    });
    out.sort(function (a, b) { return b.score - a.score || a.id - b.id; });
    return out;
  }

  // 分散判定：免费层一律 false（不做兜底判断），完整层按 SPREAD 比例
  function isLow(sc, free) {
    if (free || !sc.length) return false;
    return sc[0].score <= Math.floor(sc[0].opps * SPREAD);
  }

  /* ---------- 正向结果态（2026-10-04）----------
     加了 h:0 选项之后出现的新情况：一个人可能大部分题都选了「没被带走」。
     这时命中数普遍偏低，会落进 isLow 的「分散」分支，对用户说「十种都沾了一点」——
     可用户真实的处境是「这批题基本没把我带走」，这是**好消息**，
     把它说成「分散」是误读，等于刚做完一次自我觉察就被泼冷水。
     所以先判正向态：走这一支时不列任何惯性，只给正向数字 + 解释。 */
  var KEPT_STRONG = 0.60;
  function isKeptStrong() {
    var a = answered();
    if (!a.length) return false;
    return keptOf() / a.length >= KEPT_STRONG;
  }

  /* ---------- 结果条目取舍（并列规则，显式写死） ----------
     完整层：
       1. 先取「命中数 == 最高命中数」的那一组，这就是并列组；
       2. 并列组 ≥ 2 条时，按 habit id 升序取前 2 条，其余一律不显示。
          三条以上并列是常态，必须显式截断到 2 条，不能依赖遍历顺序，更不能随机；
       3. 并列组只有 1 条时，按 v2 §5.2 补第 2 名：与第 1 名只差 1 次才一起出；
          差 1 次的若有多条并列，同样按 id 升序取第 1 条。
     免费层（15 题 / 每条 6 次机会）：
       命中 ≥ 2 次算「最近常出现」；一条都没到 2 次时退回命中 1 次的（否则结果页空的）。
       最多 3 条——15 题样本下排前三是合理的，再多就变成十条的平铺清单，
       而「完整版看全图谱」这个钩子就没了。
  */
  function selectPicks(sc, free, low) {
    if (low || !sc.length) return [];
    if (free) {
      var g2 = sc.filter(function (r) { return r.score >= 2; });
      var base = g2.length ? g2 : sc.filter(function (r) { return r.score >= 1; });
      return base.slice(0, 3);
    }
    var top = sc[0].score;
    var tied = sc.filter(function (r) { return r.score === top; })
      .sort(function (a, b) { return a.id - b.id; });
    if (tied.length >= 2) return tied.slice(0, 2);      // 并列 ≥2：id 升序取前 2
    var second = sc.filter(function (r) { return r.id !== tied[0].id && r.score === top - 1; })
      .sort(function (a, b) { return a.id - b.id; })[0];
    return second ? [tied[0], second] : [tied[0]];
  }

  /* ---------- 场景画像（「想法发生在哪儿」）----------
     与 10 条习惯完全独立：不加习惯、不动 opts[].h、不进平衡矩阵，
     只是对已答题目按 cat 做统计，所以改词改阈都不会影响题库平衡。
     口径用**命中率**（该场景里命中最常出现那条的题数 ÷ 该场景题数），不用绝对题数：
     恋爱 28 题 vs 家庭 5 题，比绝对数等于让恋爱永远赢，画像就没了区分度。
     参与门槛：该场景题数 ≥ MIN_CAT 且命中 ≥ 3。免费层只剩恋爱（11 题）够格，
     所以免费层只会出「恋爱脑」——完整层才比得出来到底在哪个场合最集中，这就是付费点。
     ⚠️ 给的是**场合**不是人：文案一律「你的想法大多发生在 X」，热词只描述状态。 */
  var MIN_CAT = 3, SCENE_RATE = 0.35;
  function sceneProfile(picks) {
    if (!picks || !picks.length) return null;
    var ids = picks.map(function (r) { return r.id; });
    var t = {};
    answered().forEach(function (a) {
      var q = question(a.q);
      if (!q || !q.cat) return;
      var b = t[q.cat] || (t[q.cat] = { hit: 0, total: 0 });
      b.total++;
      if (ids.indexOf(a.h) >= 0) b.hit++;
    });
    var best = null;
    Object.keys(t).forEach(function (c) {
      var b = t[c];
      if (b.total < MIN_CAT || b.hit < 3) return;
      var rate = b.hit / b.total;
      if (!best || rate > best.rate || (rate === best.rate && b.total > best.total)) {
        best = { cat: c, hit: b.hit, total: b.total, rate: rate };
      }
    });
    if (!best || best.rate < SCENE_RATE) return null;
    var st = (D.sceneTags || {})[best.cat];
    if (!st) return null;
    best.hot = st.hot;
    best.line = st.line;
    return best;
  }
  function sceneHTML(sp) {
    if (!sp) return '';
    return '<div class="where">' +
      '<p class="where-line">' + esc(sp.line) + '，<b>' + sp.hit + '/' + sp.total + '</b> 的想法都落在它身上。</p>' +
      '<p class="where-hot">网友管这种状态叫 <b>' + esc(sp.hot) + '</b></p>' +
      '<p class="where-note">' + esc(D.sceneNote) + '</p>' +
      '</div>';
  }

  /* ---------- 关系敏感度轴（第二个抽屉） ----------
     与 10 条惯性**完全正交**：那边答「哪句想法」，这边答「在关系里容易在哪一步卡住」。
     ⚠️ 口径纪律（与 sceneTags / SPREAD / DENSE 同一套）：
        一律用比例，命中数 = 该维里「选了带 h 的惯性选项」的题数，
        分母 = 该维**已答**题数。分母用已答而不是全题库，
        因为免费层只答了 15 题，用 10 当分母会凭空把比例压低 6 倍。 */
  /* 小样本门槛：某一维已答题数 < MIN_HIT 时，**不许**拿它的比例下结论。
     为什么必需：免费层每维只有 2~3 题，2/2 就是 100%，
     六维会一起冲过 HOT 线，「6 条几乎是常态」——统计上完全站不住，
     而且这句话会直接盖在结果页第一屏。
     这与 10 条那边 DENSE 只在完整层启用（每条 24 次机会）是同一个道理：
     **机会数不够，就不判定。** */
  var REL_MIN_HIT = 4;
  function relScore() {
    var A = D.relAxis;
    if (!A || !A.dims || !A.dims.length) return [];
    var t = {};
    A.dims.forEach(function (d) { t[d.k] = { k: d.k, hit: 0, total: 0, qs: [] }; });
    answered().forEach(function (a) {
      var q = question(a.q);
      if (!q) return;
      var d = t[A.dims[q.id % A.dims.length].k];
      if (!d) return;
      d.total++;
      if (a.h) { d.hit++; d.qs.push(a); }   // h=0 是「没被带走」，不计入任何维度的命中
    });
    var out = A.dims.map(function (dim) {
      var r = t[dim.k];
      return {
        k: dim.k, name: dim.name, hot: dim.hot, one: dim.one,
        what: dim.what, acts: dim.acts || [],
        hit: r.hit, total: r.total,
        rate: r.total ? r.hit / r.total : 0,
        /* 够不够格下结论。与分数一起算，别在渲染时才判断——
           否则「6 条几乎是常态」这种话会在样本不足时被算出来。 */
        solid: r.total >= REL_MIN_HIT
      };
    });
    // 展示顺序：命中多的在前，同命中按维度原序（稳定排序，别让每次刷新跳动）
    out.sort(function (x, y) {
      if (y.hit !== x.hit) return y.hit - x.hit;
      return A.dims.findIndex(function (d) { return d.k === x.k; }) -
             A.dims.findIndex(function (d) { return d.k === y.k; });
    });
    return out;
  }
  function relHTML() {
    var A = D.relAxis;
    if (!A) return '';
    var rows = relScore();
    if (!rows.length) return '';
    var anyHit = rows.some(function (r) { return r.hit > 0; });
    // ⚠️ 正向态下**不抽这一轴**：「这批题基本没把你带走」已经说完结论，
    //    紧跟一句「你关系敏感度如何」等于把结论拽回分类游戏。
    if (!anyHit) return '';
    var hot = rows.filter(function (r) { return r.solid && r.rate >= A.HOT; });
    var main = rows.filter(function (r) { return r.solid && r.rate >= A.GRID && r.hit > 0; });
    /* 摘要行分三种说法，别混用：
       够样本 + 有超 HOT 的 → 说「N 条几乎是常态」；
       够样本 + 没有       → 说「主区 N 条」；
       **不够样本**（免费层每维只 2~3 题）→ 只报「这批题里中了几条」，
         绝不说「几乎是常态」：2/2 = 100% 在统计上站不住，
         而这句话会直接盖在结果页上，比不说更糟。 */
    var thin = !rows.some(function (r) { return r.solid; });
    var hits = rows.filter(function (r) { return r.hit > 0; }).length;
    var sum = thin
      ? '这批题里中了 <b>' + hits + '</b> 条'
      : (hot.length
        ? '<b>' + hot.length + '</b> 条几乎是常态'
        : '主区 ' + main.length + ' 条');
    var body = rows.map(function (r) {
      var pctTxt = r.total ? Math.round(r.rate * 100) + '%' : '—';
      return '<div class="rl' + (r.hit ? ' on' : '') + '">' +
        '<div class="rl-h"><span class="rl-n">' + esc(r.name) + '</span>' +
        '<span class="rl-v"><b>' + r.hit + '</b>/' + r.total + ' · ' + pctTxt +
        (r.solid ? '' : ' <i>题少</i>') + '</span></div>' +
        '<div class="rl-bar"><i style="width:' + Math.round(r.rate * 100) + '%"></i></div>' +
        '<p class="rl-one">' + esc(r.one) + ' 网友管这叫 <b>' + esc(r.hot) + '</b></p>' +
        (r.hit ? '<p class="rl-what">' + esc(r.what) + '</p>' +
          '<ul class="rl-acts">' + r.acts.map(function (s) {
            return '<li>' + esc(s) + '</li>';
          }).join('') + '</ul>' : '') +
        '</div>';
    }).join('');
    return '<div class="rel" id="rel-acc-w">' +
      '<button class="rel-h" id="rel-h" aria-expanded="false">' +
      '<span class="rel-t">' + esc(A.title) + '</span>' +
      '<span class="rel-s">' + sum + '</span>' +
      '<i class="acc-arrow" aria-hidden="true"></i>' +
      '</button>' +
      '<div class="rel-b" id="rel-b">' +
      '<p class="rel-lead">' + esc(A.lead) + '</p>' + body +
      (hot.length ? '<p class="rel-flag">' + esc(A.flag) + '</p>' : '') +
      '<p class="rel-note">' + esc(A.note) + '</p>' +
      '</div></div>';
  }

  /* ---------- 动态证据（结果页第二层开场） ---------- */
  function hitQuestion(hid) {
    var a = answered().filter(function (x) { return x.h === hid; })
      .sort(function (x, y) { return x.q - y.q; })[0];
    if (!a) return null;
    var q = question(a.q);
    if (!q) return null;
    return { q: a.q, short: q.short || q.scene, text: q.opts[a.i].t };
  }
  function evidenceHTML(hid) {
    var ev = hitQuestion(hid);
    if (!ev) return '';   // 取不到数据时降级：只用通用反问句
    return '<p class="revidence">第 ' + pad2(ev.q) + ' 题 · ' + esc(ev.short) +
      '<br>你选的是「' + esc(clip(ev.text, EVIDENCE_CLIP)) + '」</p>';
  }

  /* ---------- 视图切换 ---------- */
  function show(name) {
    ['land', 'quiz', 'analyzing', 'result'].forEach(function (v) {
      $('view-' + v).classList.toggle('on', v === name);
    });
    document.body.classList.toggle('in-result', name === 'result');
    window.scrollTo(0, 0);
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ---------- 落地页 ---------- */
  function renderLand() {
    var done = answered().length >= scope().length && answered().length > 0;
    var partial = !done && answered().length > 0;
    var full = state.stage === 'full';

    $('resume').innerHTML = '';
    if (done) {
      $('resume').innerHTML = '<button class="ghost" id="btn-last">看上次的结果</button>';
      $('btn-last').onclick = function () { renderResult(); };
    } else if (partial) {
      $('resume').innerHTML = '<button class="ghost" id="btn-cont">继续上次（还剩 ' + pending().length + ' 题）</button>';
      $('btn-cont').onclick = startQuiz;
    }

    // 落地页上的题量一律从 data.js 读，改题库不用再改 HTML（避免数字漂移）
    $('h1-n').textContent = D.freeIds.length;
    $('chip-free').textContent = D.freeIds.length + ' 题 · 免费';
    $('chip-full').textContent = '完整 ' + D.questions.length + ' 题 · 全场景';
    $('btn-free').textContent = '先试 ' + D.freeIds.length + ' 题（免费）';

    $('btn-free').style.display = (full || partial) ? 'none' : '';
    $('btn-full').textContent = full ? '开始（完整 ' + D.questions.length + ' 题）' : '做完整 ' + D.questions.length + ' 题';

    /* 码预览：从 data.js 现读，改代号不用再改 HTML（两个信息源必然会漂移）。
       每次随机抽 3 个——都是真码，只是轮换展示；比固定三个更像「预览」，也不会
       让人误以为这是别人的结果。
       ⚠️ 文案不许写成「最近有人测出」——上线初期没有真实数据，那是编的。
       「会出这 10 种码里的一个」是真的：结果必然落在这 10 个码里。 */
    var pool = D.habits.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    $('peek-n').textContent = D.habits.length;
    $('peek').innerHTML = pool.slice(0, 3).map(function (h) {
      return '<span><b>' + esc(h.code) + '</b> ' + esc(h.tag) + '</span>';
    }).join('') + '<span class="peek-more">还有 ' + (D.habits.length - 3) + ' 种</span>';
    $('btn-full').className = full ? 'primary' : 'secondary';

    var u = '';
    if (state.unlocked) {
      u = '<p class="unlock-note">本链接由订单 #' + esc(state.unlocked.slice(0, 2)) + ' 解锁</p>';
    }
    $('unlock-note').innerHTML = u;
    show('land');
  }

  /* ---------- 答题页 ---------- */
  function startQuiz() {
    var p = pending();
    if (!p.length) { finish(); return; }
    state.cursor = p[0];
    renderQuiz();
  }
  function renderQuiz() {
    var q = question(state.cursor);
    var s = scope();
    var idx = s.indexOf(state.cursor);

    var cells = s.map(function (id) {
      var done = state.answers.some(function (a) { return a.q === id; });
      var cur = id === state.cursor;
      return '<i class="pcell' + (done ? ' done' : '') + (cur ? ' cur' : '') + '"></i>';
    }).join('');
    $('prog').innerHTML = cells;
    $('prog-num').textContent = (idx + 1) + ' / ' + s.length;

    $('q-scene').textContent = q.scene;
    // 题干卡右上角 = 该题的场景图（走 sc-sprite 一次加载，格位由 q.img 指定）；
    // 缺格 / 越界自动回退「想想」陪伴小人（sceneDeco 内部处理）
    $('q-comp').innerHTML = sceneDeco(q, 76);
    $('q-opts').innerHTML = q.opts.map(function (o, i) {
      /* 选项从 4 个变成 5 个（第 5 个是「这次我没被带走」），字母表跟着扩到 ABCDE。
         h:0 那个选项在视觉上不标出来——它是出口，不是「正确答案」，
         标出来等于告诉用户「选这个就对了」，测的就不是真东西了。 */
      return '<button class="opt' + (o.h ? '' : ' opt-free') + '" data-i="' + i + '">' +
        '<span class="key">' + 'ABCDE'[i] + '</span><span>' + esc(o.t) + '</span></button>';
    }).join('');

    Array.prototype.forEach.call($('q-opts').children, function (btn) {
      btn.onclick = function () {
        var i = +btn.dataset.i;
        btn.classList.add('picked');
        state.answers = state.answers.filter(function (a) { return a.q !== q.id; });
        state.answers.push({ q: q.id, i: i, h: q.opts[i].h });
        save();
        setTimeout(next, 140);
      };
    });

    $('btn-back').style.visibility = idx > 0 ? 'visible' : 'hidden';
    $('btn-back').onclick = function () {
      var prev = s[idx - 1];
      if (prev == null) return;
      state.answers = state.answers.filter(function (a) { return a.q !== state.cursor; });
      save();
      state.cursor = prev;
      renderQuiz();
    };
    show('quiz');
  }
  function next() {
    var p = pending();
    if (!p.length) { finish(); return; }
    state.cursor = p[0];
    renderQuiz();
  }

  /* ---------- 分析中 ---------- */
  function finish() {
    show('analyzing');
    // 等待小人：蹲着看格子一格格亮起来
    $('an-comp').innerHTML = artOn() ? deco('ui', D.art.ui.wait, 96) : '';
    var grid = $('an-grid');
    var cells = [];
    grid.innerHTML = D.habits.map(function (h, i) {
      var opps = oppsOf(h.id);
      if (!opps.length) return '';
      return '<div class="an-row">' + opps.map(function (qid) {
        var on = answered().some(function (a) { return a.q === qid && a.h === h.id; });
        if (on) cells.push(null);
        var key = i + '-' + qid;
        return '<i class="acell" data-k="' + key + '"' + (on ? ' data-on="1"' : '') + '></i>';
      }).join('') + '</div>';
    }).join('');

    var targets = grid.querySelectorAll('.acell[data-on]');
    var order = [];
    for (var i = 0; i < targets.length; i++) order.push(i);
    order.sort(function () { return Math.random() - 0.5; });
    // 60 题下命中格可达 60 个，步长要压住，否则「分析中」要等 4 秒以上
    var step = Math.max(28, Math.min(90, Math.floor(ANALYZE_MS / Math.max(1, order.length + 2))));
    var msgs = ['正在比对 10 种想事情的方式', '正在找出现最多的那条', '快好了'];
    var mi = 0;
    $('an-msg').textContent = msgs[0];
    var mt = setInterval(function () {
      mi = (mi + 1) % msgs.length;
      $('an-msg').textContent = msgs[mi];
    }, 620);

    order.forEach(function (idx, n) {
      setTimeout(function () { targets[idx].classList.add('on'); }, 220 + n * step);
    });
    setTimeout(function () {
      clearInterval(mt);
      renderResult();
    }, 220 + order.length * step + 460);
  }

  /* ---------- 方块矩阵 ----------
     机会数随题量变（免费 6 / 完整 24），格子区单独占一行，名字不被挤成省略号。 */
  function matrixHTML(interactive) {
    var rows = score().map(function (r) {
      var h = habit(r.id);
      var opps = oppsOf(r.id);
      var cells = opps.map(function (qid) {
        var a = answered().filter(function (x) { return x.q === qid && x.h === r.id; })[0];
        var cls = 'cell' + (a ? ' on' : '');
        return '<i class="' + cls + '" data-h="' + r.id + '" data-q="' + qid + '"></i>';
      }).join('');
      return '<div class="mx-row' + (r.score ? ' hit' : '') + '">' +
        '<i class="mx-idx">' + pad2(h.id) + '</i>' +
        '<span class="mx-name">' + esc(h.name) + '</span>' +
        '<span class="mx-num">' + r.score + '/' + r.opps + '</span>' +
        '<span class="mx-cells">' + cells + '</span></div>';
    }).join('');
    var wx = interactive
      ? '<p class="mx-tip">点实心格子，可以看是哪道题选的</p>'
      : '';
    return '<div class="mx">' + rows + '</div>' + wx;
  }
  function bindMatrix(el) {
    Array.prototype.forEach.call(el.querySelectorAll('.cell'), function (c) {
      c.onclick = function () {
        if (!c.classList.contains('on')) return;
        var qid = +c.dataset.q, h = +c.dataset.h;
        var q = question(qid);
        var a = answered().filter(function (x) { return x.q === qid && x.h === h; })[0];
        toast('第 ' + qid + ' 题你选的是：' + q.opts[a.i].t.slice(0, 18) + '…');
      };
    });
  }

  /* ---------- 十条总览卡（免费层） ---------- */
  /* 十条总览卡（免费层）——默认折叠，十条清单太长，别一上来就摊开 */
  function overviewHTML() {
    return '<div class="acc" id="acc-w-ov">' +
      '<button class="acc-head" id="ov-h">' +
        '<span class="acc-title">十条完整清单</span>' +
        '<span class="acc-one">这 ' + D.freeIds.length + ' 题没覆盖到的那几条也在里面。点开存下来当对照表。</span>' +
        '<i class="acc-arrow" aria-hidden="true"></i>' +
      '</button>' +
      '<div class="acc-body" id="ov-b"><ul class="ov-list">' + D.habits.map(function (h) {
        return '<li><b>' + esc(h.name) + '</b> —— ' + esc(h.one) + '</li>';
      }).join('') + '</ul></div>' +
      '</div>';
  }

  /* ---------- hero 代号卡（结果页最值得截图的一块） ----------
     英文码是传播货币（评论区暗号），中文代号负责解释；大字承载传播，中文字承载理解。
     只做社交货币，不做判定：代号 + 自述 + 朋友圈句，三者都不评价好坏。
     热词（hot）只标这一句想法，不标这个人——落在代号下面，不落在人身上。
     NOTE 那句是刻意的——我们整套方法论反对给人盖章，玩梗越强这句越不能删。
  */
  function renderHero(picks, free, low) {
    var top = (!low && picks.length) ? habit(picks[0].id) : null;
    var r0 = top ? picks[0] : null;
    var kept = keptOf(), total = answered().length;
    var keptStrong = isKeptStrong();
    /* 正向指标：「没被带走」N/M。放在 hero 代号卡里，与「命中 n/m」并列。
       为什么不用百分比：命中用「n/机会数」，这里也用同一种口径，两行能直接对照读。
       为什么不给它单独造一个代号：它是**次数**，不是第 11 条惯性——
       塞进同一个排名就会变成「你在这一条上得分最高」，正好和我们的口径相反。 */
    var keptHTML = '<p class="hero-kept"><b>' + kept + '/' + total + '</b> 题你没被带走</p>';

    $('res-say').innerHTML =
      '<div class="say">' +
      (artOn() ? deco('ui', D.art.ui.report, 72, 'say-comp') : '') +
      (top
        ? '<b>评论区对暗号</b>' +
          '<p>把 <b class="say-code">#' + esc(top.code) + '</b> 贴到评论区，顺便 @ 那个该来测的人。' +
          '攒够了我出一期「哪种码最多」。</p></div>'
        : '<b>隔几天再测一次</b>' +
          '<p>出现最多的那条，就是你的码。评论区对暗号，等它成形再来。</p></div>');

    if (!top || keptStrong) {
      $('res-hero').innerHTML =
        '<div class="hero">' +
        (artOn() ? deco('ui', D.art.ui.shrug, 116, 'hero-art') : '') +
        '<p class="hero-kicker">这次的结果</p>' +
        '<p class="hero-tag" style="font-size:28px">' +
        (keptStrong ? '这批题基本没把你带走' : '十种都沾了一点') + '</p>' +
        keptHTML +
        '<p class="hero-line">' +
        (keptStrong
          ? '这不代表你以后也不会被带走——只是这一次，这 ' + total + ' 句话里，你没被其中任何一条拽住。记住这个手感，它有名字，叫「我在」。'
          : '没有被某一种带走，也是一种结果。真要用起来，先记具体那句话，别急着分类。') +
        '</p>' +
        '</div>';
      return;
    }
    $('res-hero').innerHTML =
      '<div class="hero">' +
      // 习惯小人大图压右上角（走 sprite，结果页零额外请求）；不挤压代号大字
      (artOn() ? deco('ip', top.id - 1, 116, 'hero-art') : '') +
      '<p class="hero-kicker">' + (free ? '这 ' + D.freeIds.length + ' 题里，先出场的是' : '你最常出现的一条') + '</p>' +
      '<p class="hero-code">' + esc(top.code) + '</p>' +
      '<p class="hero-tag">' + esc(top.tag) + '</p>' +
      '<p class="hero-line">' + esc(top.tagline) + '</p>' +
      (top.hot ? '<p class="hero-hot">网友管这种想法叫 <b>' + esc(top.hot) + '</b></p>' : '') +
      '<p class="hero-hit">命中 <b>' + r0.score + '/' + r0.opps + '</b></p>' +
      keptHTML +
      (top.post ? '<div class="hero-post"><i>如果它发朋友圈</i>' + esc(top.post) + '</div>' : '') +
      '<p class="hero-pair">让朋友也测一个，评论区对暗号 <b>#' + esc(top.code) + '</b></p>' +
      '<p class="hero-note">代号和热词都只是为了方便记住和搜索，不是给你盖章。</p>' +
      '</div>';

    // 点 hero 复制「暗号 + 代号 + 自述」，去评论区直接贴
    $('res-hero').onclick = function () {
      var text = '我来对暗号：#' + top.code + ' 「' + top.tag + '」' + top.tagline;
      copyText(text) ? toast('复制好了，去评论区贴上就行') : toast(text);
    };
  }

  /* 抽屉开合：用显式 id 绑定，不依赖 querySelectorAll（旧机型/简单环境也能跑） */
  function bindAcc(i) { bindAccEl('acc-h-' + i, 'acc-b-' + i, 'acc-w-' + i); }
  function bindAccEl(headId, bodyId, wrapId) {
    var head = $(headId), box = $(bodyId), wrap = wrapId ? $(wrapId) : null;
    if (!head || !box) return;
    head.onclick = function () {
      var on = !box.classList.contains('open');
      if (on) { box.classList.add('open'); if (wrap) wrap.classList.add('open'); }
      else { box.classList.remove('open'); if (wrap) wrap.classList.remove('open'); }
    };
  }

  function copyText(t) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t); return true;
      }
    } catch (e) { /* 降级：调用方会 toast 出原文 */ }
    return false;
  }

  /* ---------- 结果页 ---------- */
  function renderResult() {
    var sc = score();
    var top = sc[0];
    var free = state.stage === 'free';
    var low = isLow(sc, free);
    var keptStrong = isKeptStrong();

    var picks = selectPicks(sc, free, low);   // 取舍规则见 selectPicks 注释

    $('res-head').textContent = free
      ? '这 ' + D.freeIds.length + ' 题里，你选到了这几条'
      : (keptStrong
        ? '这批题基本没把你带走'
        : (low ? '十条里没有哪条特别突出' : (picks.length > 1 ? '你最常出现的是这两条' : '你最常出现的是这一条')));
    $('res-sub').textContent = free
      ? D.freeIds.length + ' 题只覆盖感情和日常这两块。完整 ' + D.questions.length + ' 题还有职场、家里、一个人待着的时候。'
      : '';

    renderHero(picks, free, low);

    var sp = sceneProfile(picks);
    $('res-chart').innerHTML = matrixHTML(true) +
      sceneHTML(sp) +
      /* 正向态下矩阵几乎全空（这正是「基本没被带走」的图形含义），
         但空矩阵看起来像加载失败，补一句说明把它变成结论的一部分。 */
      (keptStrong
        ? '<p class="mx-kept">上面这 10 行基本没亮 —— 那就是这题的答案。</p>'
        : '') +
      '<p class="mx-note">' + esc(D.resNote) + '</p>';
    bindMatrix($('res-chart'));

    // 抽屉式结果：收件了解概览，点开看完整拆解。第一条默认展开，其余折叠。
    if (keptStrong) {
      /* 正向态：不列惯性清单，改说「接下来怎么用」。
         为什么不给「十大清单」当补充材料——那个入口的语义是
         「看看哪条最像你」，用在正向态上等于把刚形成的正向结论立刻拽回分类游戏。 */
      $('res-cards').innerHTML =
        '<div class="card flat">' +
        (artOn() ? '<div class="flat-comp">' + deco('ui', D.art.ui.note, 100) + '</div>' : '') +
        '<p class="what">这 ' + answered().length + ' 题里有 ' + keptOf() +
        ' 题你没被带走——占了大头。说明这批场景当下踩不中你的开关。</p>' +
        '<p class="what">接下来换个难一点的场景试试：越贴近你真实生活里反复出现的那件事，' +
        '越可能看到平时看不到的那一句。</p>' +
        '<p class="what">也留意另外那几题——它们不是「答错」，只是说明那一句你还在用。</p></div>';
    } else if (low) {
      $('res-cards').innerHTML =
        '<div class="card flat">' +
        (artOn() ? '<div class="flat-comp">' + deco('ui', D.art.ui.note, 100) + '</div>' : '') +
        '<p class="what">你的反应比较分散，没有被某一种固定的模式带走。</p>' +
        '<p class="what">这本身也是个结果。真想用起来的话，比起先记分类，不如先记具体那句话：' +
        '下次心里冒出什么，把它原样写下来，比判断它属于哪一类更有用。</p></div>';
    } else {
      $('res-cards').innerHTML =
        '<p class="list-hint">下面这几条点一下能展开，里面有具体的拆解。</p>' +
        picks.map(function (r, i) {
          var h = habit(r.id);
          // 第一层：通用反问（任何命中者都认）＋ 第二层：动态证据（这就是我）
          var inner = '<p class="ropen">' + esc(h.open) + '</p>' + evidenceHTML(r.id) +
            '<p class="what">' + esc(h.what) + '</p>';
          inner += free
            ? '<div class="swap"><p class="rlabel">换一句试试</p><p class="swap-t">' + esc(h.swap) + '</p></div>'
            : '<p class="rlabel">你大概在哪些时候见过它</p>' +
              '<ul class="signs">' + h.signs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
              '<div class="swap"><p class="rlabel">换一句试试</p><p class="swap-t">' + esc(h.swap) + '</p></div>' +
              '<p class="contrast">' + esc(h.contrast) + '</p>';
          return '<div class="acc' + (i === 0 ? ' open' : '') + '" id="acc-w-' + i + '">' +
            '<button class="acc-head" id="acc-h-' + i + '">' +
              '<span class="acc-tag">' + esc(h.tag) + '</span>' +
              '<span class="acc-title">' + esc(h.name) + '</span>' +
              '<span class="acc-one">' + esc(h.one) + ' 网友管这叫：' + esc(h.hot) + '</span>' +
              '<i class="acc-arrow" aria-hidden="true"></i>' +
            '</button>' +
            '<div class="acc-body' + (i === 0 ? ' open' : '') + '" id="acc-b-' + i + '">' + inner + '</div>' +
            '</div>';
        }).join('');
      for (var i = 0; i < picks.length; i++) bindAcc(i);
    }

    // 高集中提示：只在完整层触发（按 DENSE 比例）。免费层关闭。
    // 理由：免费层每条只有 6 次机会，「几乎每次都出现」统计上不成立；
    //       且这是未付费用户的第一印象，在这里推「找专业的人聊聊」会掉转化。
    //       合规风险集中在完整层；免费层题量少 + 只有一句话，风险低。
    // ⚠️ 正向态下一律不弹：刚说完「这批题基本没把你带走」，紧跟一句
    //    「可以找专业的人聊聊」是自相矛盾的自伤。
    var concentrated = (free || keptStrong) ? [] : sc.filter(function (r) {
      return r.score >= Math.ceil(r.opps * DENSE);
    });
    $('res-flag').innerHTML = concentrated.length
      ? '<div class="card flag"><p class="what">这一条几乎每次都出现了。说明它已经很熟练，靠自己硬拧通常拧不动。</p>' +
        '<p class="what">先停一下。也可以找专业的人聊聊 —— 这不是什么大事，只是效率问题。</p></div>'
      : '';

    /* 关系敏感度轴（第二个抽屉）。装在 res-flag 之后：
       「哪句想法」→「哪条惯性几乎每次都出现」→「关系里容易卡在哪」，
       是一条从内到外的顺序，不打断。 */
    $('res-rel').innerHTML = relHTML();
    bindAccEl('rel-h', 'rel-b', 'rel-acc-w');

    if (free) {
      $('res-upgrade').innerHTML = overviewHTML() +
        '<div class="card up">' +
        (artOn() ? deco('ui', D.art.ui.door, 88, 'up-comp') : '') +
        '<p class="what">' + (sp
          ? '这 ' + D.freeIds.length + ' 题只比得出「恋爱里」这一块。完整 ' + D.questions.length +
            ' 题会把上班、家里、一个人待着也一起比，看你的想法到底在哪个场合最集中。'
          : '这是 ' + D.freeIds.length + ' 题快速版，只覆盖了 10 条里的一部分场景。完整 ' +
            D.questions.length + ' 题还会告诉你：你的想法主要发生在哪个场合。') + '</p>' +
        '<button class="primary" id="btn-up">再答 ' + (D.questions.length - D.freeIds.length) + ' 题，看完整图谱</button>' +
        '<p class="fine">' + esc(D.unlockHint) + '。已经拿到的点上面就行。</p></div>';
      bindAccEl('ov-h', 'ov-b', 'acc-w-ov');
      $('btn-up').onclick = function () {
        if (state.unlocked) {
          state.stage = 'full'; save(); startQuiz();
        } else {
          toast(D.unlockHint);
        }
      };
    } else {
      $('res-upgrade').innerHTML = '';
    }

    $('res-next').innerHTML =
      '<div class="card"><p class="rlabel">接下来</p>' +
      '<ol class="next"><li>把这张图存下来。下次它冒头的时候，对着看一眼就够了。</li>' +
      '<li>把「换一句试试」那句话记进备忘录。它比整页都有用。</li>' +
      (D.packUrl
        ? '<li>练习包：10 条完整拆解 + 30 天记录表。<a href="' + esc(D.packUrl) + '" target="_blank" rel="noopener">在这里</a></li>'
        : '<li>练习包：10 条完整拆解 + 30 天记录表，还在做。</li>') +
      '</ol></div>';

    $('btn-share').onclick = makeShare;
    $('btn-again').onclick = function () {
      state.answers = []; save(); renderLand();
    };
    show('result');
  }

  /* ---------- 分享长图（Canvas 手绘 750×1000） ----------
     配色与 style.css 同一套：界面暖白 / 数据层深蓝。
     ⚠️ 格子（数据层）不许用暖色，否则等于说「红＝不好」，与核心口径冲突。
  */
  function makeShare() {
    // 分享图里的小人异步加载：先起加载，回来再画；失败就画纯文字版。
    // 不弹窗、不让用户干等——没图也要立刻拿到一张能发的图。
    var first = pickFirst();
    var src = (first && artOn()) ? habitImg(first.id) : '';
    if (!src) { drawShare(null); return; }
    var im = new Image();
    im.onload = function () { drawShare(im); };
    im.onerror = function () { drawShare(null); };
    im.src = src;
  }
  function pickFirst() {
    var sc = score(), free = state.stage === 'free';
    var low = isLow(sc, free);
    /* 正向态不返回代号：分享图的 hero 位置要留给「你没被带走 N/M」，
       空出位置由 drawShare 的正向分支接管。 */
    if (isKeptStrong()) return null;
    var picks = selectPicks(sc, free, low);
    return picks[0] ? habit(picks[0].id) : null;
  }
  function drawShare(im) {
    var W = 750, H = 1120, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var F = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    var ACCENT = '#2557A7', CELL = '#EDE2D8', INK = '#2B2320', INK2 = '#4A403A';
    var MUTED = '#8B7C72', CORAL = '#D9705A', CARD = '#FFFFFF', BLUSH = '#FBE9E1';
    var MW = im ? 570 : 630;   // 有小人图时，文字区让出右上角

    g.fillStyle = '#FDF7F2'; g.fillRect(0, 0, W, H);

    var sc = score();
    var free = state.stage === 'free';
    var low = isLow(sc, free);
    var keptStrong = isKeptStrong();
    // 矩阵画全部命中（不排序、不取舍），hero 只写第一条代号
    /* 正向态下不给代号：截图上的主角应该是「你没被带走 N/M」，
       硬塞一条最多 5/24 的惯性代号上去，等于把一张正向的图讲成负面的。 */
    var picks = keptStrong ? [] : selectPicks(sc, free, low);
    var first = picks[0] ? habit(picks[0].id) : null;

    var MONO = '"SFMono-Regular",Menlo,Consolas,"Liberation Mono",monospace';
    var NQ = free ? D.freeIds.length : D.questions.length;

    // eyebrow：产品名 + 题量。产品名在前——转发出去别人第一眼看到的是名字，不是题量。
    g.fillStyle = CORAL;
    g.font = '700 20px ' + F;
    g.fillText((D.brand ? D.brand + ' · ' : '') + NQ + ' 题 · 我的结果代号', 60, 92);

    // 习惯小人大图压右上角；文字区已限宽到 MW，压不到字
    if (im) {
      var iw = 110, ih = Math.round(iw * im.naturalHeight / im.naturalWidth);
      g.drawImage(im, 640, 56, iw, ih);
    }

    // hero：英文码大字承载传播，中文代号负责解释（与页面 hero 同一分工）
    var y = 148;
    if (first) {
      g.fillStyle = ACCENT;
      g.font = '700 64px ' + MONO;
      if ('letterSpacing' in g) g.letterSpacing = '5px';
      g.fillText(first.code, 58, y + 54);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      y += 84;
      g.fillStyle = INK;
      g.font = '800 30px ' + F;
      var tw = g.measureText(first.tag).width;
      g.fillText(first.tag, 60, y + 26);
      // 热词跟在代号后面（同一行，不额外占高）：只标这一句想法，不标这个人
      if (first.hot) {
        g.fillStyle = MUTED;
        g.font = '500 18px ' + F;
        g.fillText('网友管这叫 ' + first.hot, 60 + tw + 16, y + 24);
      }
      y += 42;
      g.fillStyle = INK2;
      g.font = '500 26px ' + F;
      y = wrap(g, first.tagline, 60, y + 32, MW, 38);
      // 命中 n/m：等宽深蓝。有朋友圈气泡就跟气泡同行右侧，不另占一行
      var hitNum = picks[0].score + '/' + picks[0].opps;
      var keptNum = keptOf() + '/' + answered().length;
      g.font = '700 26px ' + MONO;
      var nw = g.measureText(hitNum).width;
      g.font = '600 20px ' + F;
      var lw = g.measureText('命中 ').width;
      if (first.post) {
        var pw = g.measureText(first.post).width;
        rr(g, 60, y + 2, Math.min(MW, pw + 48), 64, 16, BLUSH);
        g.fillStyle = INK2;
        g.font = '400 24px ' + F;
        wrap(g, first.post, 84, y + 42, MW - 40, 34);
        g.fillStyle = MUTED;
        g.font = '600 20px ' + F;
        g.fillText('命中 ', 690 - nw - lw - 8, y + 42);
        g.fillStyle = ACCENT;
        g.font = '700 26px ' + MONO;
        g.fillText(hitNum, 690 - nw, y + 42);
        y += 78;
      } else {
        g.fillStyle = MUTED;
        g.font = '600 20px ' + F;
        g.fillText('命中 ', 60, y + 28);
        g.fillStyle = ACCENT;
        g.font = '700 26px ' + MONO;
        g.fillText(hitNum, 60 + lw, y + 28);
        y += 48;
      }
      /* 「没被带走」正向指标（2026-10-04）：
         截图会被转发到评论区/朋友圈，所以正向口径必须**印在图上**，
         不能只在网页里——不然发出去的图还是只有「命中」这一条负面数字。
         写法上和「命中」对齐：等宽深蓝的 n/m + 灰字标签。
         ⚠️ 本区块属于「自下而上排版」的内容，必须参与上面 y 的推进，
            否则会压到下面的矩阵卡（2026-10-04 修过一次同样的压字 bug）。 */
      g.fillStyle = MUTED;
      g.font = '600 20px ' + F;
      var ktxt = '你没被带走 ';
      g.fillText(ktxt, 60, y + 28);
      var kw = g.measureText(ktxt).width;
      g.fillStyle = ACCENT;
      g.font = '700 26px ' + MONO;
      g.fillText(keptNum, 60 + kw, y + 28);
      y += 48;
    } else {
      g.fillStyle = INK;
      g.font = '800 40px ' + F;
      y = wrap(g, keptStrong ? '这批题基本没把我带走' : '十种都沾了一点', 60, y, 630, 52);
      /* 空结果分支：没有代号，但「你没被带走」的数字必须印出来——
         这个场景下它是图上唯一的数字，不印就成了一张纯负面图。 */
      g.fillStyle = MUTED;
      g.font = '600 20px ' + F;
      var kt3 = '你没被带走 ';
      g.fillText(kt3, 60, y + 26);
      var kw3 = g.measureText(kt3).width;
      g.fillStyle = ACCENT;
      g.font = '700 26px ' + MONO;
      g.fillText(keptNum, 60 + kw3, y + 26);
      y += 48;
    }

    // 矩阵（白卡）：格子数随题量变，24 格时自动缩成 10px + 2px 间距的密度条
    var rows = sc.filter(function (r) { return r.opps; });

    // ⚠️ 底部区自下而上排版（2026-10-04 修）：
    //    原来页脚钉在 H-96、换一句卡自适应高度往上顶 —— 内容一变多就压页脚，
    //    场景行还骑在矩阵卡边框上（用户截图里「突破了背景框」就是这两处）。
    //    现在先把页脚量出来当基准，再从页脚往上倒推每块高度。
    var FOOT1 = H - 96;          // 页脚第一行（@品牌 + 互测暗号）基线
    var FOOT2 = H - 60;          // 免责基线
    var BOTTOM = FOOT1 - 34;     // 页脚区上沿：往上所有内容不得越过这条线

    // 场景画像：两行，写在矩阵卡**内部**下方（跟着矩阵走，不另占版位）
    // spH 必须 ≥ 场景块实际高度（第二行基线 my+50，行高 20，底部留白 14）= 84，
    // 否则文字会溢出白卡底边 —— 这就是用户截图里「突出背景框」那处。
    var spS = first ? sceneProfile(picks) : null;
    var spH = spS ? 86 : 0;

    // 换一句试试：高度由实际折行数决定。
    // 卡片高度 = 上内边距32 + 标题19 + 间隔23 + 正文行数×34 + 下内边距。
    // ⚠️ 下内边距给 22px：正文行盒是1.06em，24px 字≈25.4px，字形还会下伸一点，
    //    只留 12px 会出现「文字压在卡片底边上」（用户 2026-10-04 截图）。
    var swapLines = first ? wrapLines(g, first.swap, 578) : [];
    var swapH = first ? (74 + swapLines.length * 34 + 22) : 0;

    // 行距自适应：把 hero 到页脚之间的余量分给矩阵行，行距夹在 26..30。
    // 30 是最好看的（格子 20px 时上下各留 10）；不够就往下压，够了也不贪。
    var avail = (BOTTOM - (swapH ? swapH + 16 : 0) - y - 20 - 26 - 8 - spH) / rows.length;
    var step = Math.max(26, Math.min(30, Math.floor(avail)));

    var mh = 26 + rows.length * step + 8 + spH;
    var mCardTop = BOTTOM - (swapH ? swapH + 16 : 0) - mh;
    /* ⚠️ 2026-10-04：这里曾经加过一条「矩阵卡顶不许压到 hero 末行」的钳制
     *    （Math.min(mCardTop, heroBottom + 22)）。实测 9 种情形后确认它是**死代码**——
     *    矩阵卡顶由 BOTTOM 往上倒推（swapH + mh），跟 hero 占多高无关；
     *    正向态下 rows 为空、mh≈34，卡片根本不画（实测 mCardTop 恒为 464/492，
     *    距 hero 末行还有富余）。注入变异把它去掉，_layout.js 27 项断言全过——
     *    即「没有它也不会坏」。留着它只会让人误以为这里有保护。
     *    真正防压字的是：① 自下而上从 BOTTOM 倒推；② swapH 按实际折行数算；
     *    ③ _layout.js 验 9 种情形（含正向态、惯性占多数、3/4 边界）。
     *    若日后 hero 再加内容，先跑 _layout.js，再考虑要不要真正的钳制。 */
    rr(g, 60, mCardTop, 630, mh, 22, CARD);
    var my = mCardTop + 26;
    rows.forEach(function (r) {
      var h = habit(r.id);
      g.fillStyle = r.score ? INK : MUTED;
      g.font = (r.score ? '600 ' : '400 ') + '16px ' + F;
      g.fillText(clipText(g, h.name, 208), 76, my + 15);
      var opps = oppsOf(r.id);
      var big = opps.length <= 12;
      var cell = big ? 20 : 10, gap = big ? 8 : 2;
      var strip = opps.length * cell + (opps.length - 1) * gap;
      var x = 600 - strip;   // 右对齐到 600，左侧留给名字
      opps.forEach(function (qid) {
        var on = answered().some(function (a) { return a.q === qid && a.h === r.id; });
        g.fillStyle = on ? ACCENT : CELL;
        g.fillRect(x, my + 1, cell, cell);
        x += cell + gap;
      });
      g.fillStyle = r.score ? ACCENT : CELL;
      g.font = '700 16px ' + F;
      g.textAlign = 'right';
      g.fillText(r.score + '/' + r.opps, 660, my + 15);
      g.textAlign = 'left';
      my += step;
    });

    // 场景画像：一行写完（不另画卡），随图一起转——「恋爱脑」这类梗在图上也带得走
    if (spS) {
      g.fillStyle = INK2;
      g.font = '500 19px ' + F;
      g.fillText(clipText(g, spS.line + ' ' + spS.hit + '/' + spS.total, 600), 76, my + 24);
      g.fillStyle = CORAL;
      g.font = '700 19px ' + F;
      g.fillText('· 网友管这种状态叫 ' + spS.hot, 76, my + 50);
    }

    // 换一句试试：底边钉在 BOTTOM（页脚上方 34px），高度按实际行数
    if (first) {
      var sy = BOTTOM - swapH;
      rr(g, 60, sy, 630, swapH, 20, BLUSH);
      g.fillStyle = CORAL;
      g.font = '700 18px ' + F;
      g.fillText('换一句试试', 84, sy + 32);
      g.fillStyle = INK;
      g.font = '600 24px ' + F;
      var syy = sy + 74;
      swapLines.forEach(function (line) {
        g.fillText(line, 84, syy); syy += 34;
      });
    }

    g.fillStyle = MUTED;
    g.font = '400 20px ' + F;
    if (D.brand) g.fillText('@' + D.brand, 60, FOOT1);
    g.fillText(D.disclaimer, 60, FOOT2);
    // 互测引导：右下角，随图转发——裂变入口印在图上
    if (first) {
      g.font = '700 24px ' + MONO;
      var cw = g.measureText('#' + first.code).width;
      g.textAlign = 'right';
      g.fillStyle = ACCENT;
      g.fillText('#' + first.code, 690, FOOT1);
      g.fillStyle = INK2;
      g.font = '500 20px ' + F;
      g.fillText('让朋友也测一个 · 对暗号 ', 690 - cw, FOOT1);
      g.textAlign = 'left';
    }

    var url = c.toDataURL('image/png');
    $('share-img').src = url;
    $('share-link').href = url;
    $('share-link').download = 'result.png';
    $('share').classList.add('on');
  }
  function rr(g, x, y, w, h, r, fill) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.fillStyle = fill; g.fill();
  }
  /* 按像素宽度截断，超出加省略号。
     ⚠️ 习惯名最长 14 字（「满屏好评，我只看见那一条差评」），固定 slice(0,9)
     会把话说一半；按像素裁才不会在 24 格模式下把名字撑到格子上。 */
  function clipText(g, text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    var s = text;
    while (s.length && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function wrap(g, text, x, y, maxW, lh) {
    var yy = y;
    wrapLines(g, text, maxW, lh).forEach(function (line) {
      g.fillText(line, x, yy); yy += lh;
    });
    return yy;
  }
  /* 先算折行结果再决定画在哪 —— 卡片高度必须由实际行数决定，
     不能先画卡再往上溢出（这是排版 bug 的根源：高度猜的，内容是实的）。 */
  function wrapLines(g, text, maxW) {
    var out = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var t = line + text[i];
      if (g.measureText(t).width > maxW && line) { out.push(line); line = text[i]; }
      else { line = t; }
    }
    if (line) out.push(line);
    return out;
  }

  /* ---------- 启动 ---------- */
  function boot() {
    load();
    applyArtClasses();
    probeArt();   // 图不在就降级成纯文字版，不等它
    var k = (new URLSearchParams(location.search).get('k') || '').toUpperCase();
    if (k) {
      if (validKey(k)) {
        state.unlocked = k; state.stage = 'full'; save();
        toast('已解锁完整版');
      } else {
        toast('这个链接不对，可以先试 ' + D.freeIds.length + ' 题');
      }
    }
    $('btn-free').onclick = function () { state.stage = 'free'; save(); startQuiz(); };
    $('btn-full').onclick = function () {
      if (state.unlocked) { state.stage = 'full'; save(); startQuiz(); }
      else { toast(D.unlockHint); }
    };
    $('share-close').onclick = function () { $('share').classList.remove('on'); };
    renderLand();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
