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

  // 灵光寄语池：刷新随机出现
  var QUOTES = [
    { t: '你不是那个在头脑中喋喋不休的声音，你是听见那个声音的觉察者。', a: '埃克哈特·托利' },
    { t: '人不是被事情本身所困扰，而是被他们对事情的看法所困扰。', a: '爱比克泰德' },
    { t: '在刺激与回应之间，存在着一段距离。在那段距离里，藏着我们的选择与自由。', a: '维克多·弗兰克尔' },
    { t: '世事本无好坏，全在念头之间。', a: '莎士比亚' }
  ];
  function randomQuote() {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }

  // 挖掘用户的闪光面与稳定内核（支持 h: -1 耍起原则与 6 选项体系）
  function strengthProfile(sc) {
    var slist = (D.strengths && D.strengths.length) ? D.strengths : [];
    // 完备兜底：即使数据层未配齐，也自带 code 属性，绝不报错卡死
    if (!slist.length) {
      return { k: 'chill', tag: '舒服者耍起', code: 'CHILL', slogan: '天大地大，我自己呆得舒服最大；生活本就是用来耍的。', what: '你骨子里有一股极珍贵的野生生命力。规矩和人情是别人的，只有「自己舒不舒服」是真真切切的。遇到内耗不接茬，遇到扫兴不强求，能玩就尽兴耍，累了就痛快躺。' };
    }

    var ans = answered();
    var zeros = sc.filter(function (r) { return r.score === 0; }).map(function (r) { return r.id; });
    var keptAnswers = ans.filter(function (a) { return a.h <= 0; });

    // 1. 先安全初始化 5 种特质的累积分数对象
    var scores = {
      chill: 0,   // 舒服者耍起
      praise: 0,  // 好评收集器
      bound: 0,   // 课题绝缘体
      flow: 0,    // 允许一切发生
      rest: 0     // 心安理得歇着
    };

    // 2. 凡是主动选了 h: -1（舒服者耍起），直接给 chill 强力加分！
    var chillPicks = ans.filter(function (a) { return a.h === -1; }).length;
    scores.chill += chillPicks * 4;

    // 3. 根据具体题目里的松弛选择（h: 0）进行特征倾向加分
    keptAnswers.forEach(function (a) {
      var qid = a.q;
      // 玩乐、约会、随性生活相关
      if ([1, 8, 9, 13, 21, 23, 26, 36, 41, 57].indexOf(qid) >= 0) scores.chill += 2;
      // 评价、称赞、反馈相关
      if ([3, 4, 14, 19, 24, 31, 35, 44, 46, 49].indexOf(qid) >= 0) scores.praise += 2;
      // 人际、背锅、气氛相关
      if ([5, 7, 10, 11, 20, 22, 28, 34, 38, 40, 48, 52, 55].indexOf(qid) >= 0) scores.bound += 2;
      // 搞砸、预期落空、变故相关
      if ([2, 6, 12, 16, 17, 27, 32, 33, 42, 43, 47, 50, 51, 56, 59].indexOf(qid) >= 0) scores.flow += 2;
      // 躺平、独处、休息相关
      if ([15, 25, 30, 39, 45, 54, 58, 60].indexOf(qid) >= 0) scores.rest += 2;
    });

    // 4. 根据完全避开的负向低语加分（反向印证正向能力）
    if (zeros.indexOf(8) >= 0) { scores.rest += 3; scores.chill += 2; }
    if (zeros.indexOf(10) >= 0) { scores.bound += 3; scores.chill += 1; }
    if (zeros.indexOf(3) >= 0) { scores.praise += 3; }
    if (zeros.indexOf(1) >= 0 || zeros.indexOf(2) >= 0) { scores.flow += 2; }
    if (zeros.indexOf(6) >= 0) { scores.chill += 2; }

    // 5. 选出得分最高的那项正向特质
    var bestKey = 'chill';
    var maxScore = -1;
    ['chill', 'praise', 'bound', 'flow', 'rest'].forEach(function (k) {
      if (scores[k] > maxScore) {
        maxScore = scores[k];
        bestKey = k;
      }
    });

    var result = slist.filter(function (s) { return s.k === bestKey; })[0];
    return result || slist[0];
  }
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
    // 凡是 <= 0 的（0为辩证，-1为耍起），均算作未被内耗裹挟
    return answered().filter(function (a) { return a.h <= 0; }).length;
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
    // 无论是免费还是完整版，都只看最高分；如果最高分都是0，则没有有效命中
    var top = sc[0].score;
    if (top <= 0) return [];
    // 找出所有命中数并列第一的卡片（不展示次高的项）
    var tied = sc.filter(function (r) { return r.score === top; })
      .sort(function (a, b) { return a.id - b.id; });
    // 如果并列过多（比如选得很散），最多并列展示前 2 个，否则只展示绝对第 1
    return tied.slice(0, 2);
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
      if (a.h > 0) { d.hit++; d.qs.push(a); }   // 严格限定 a.h > 0 才算负向卡点，0 和 -1 不计入
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
    // 只取 2 个展示，视觉平衡对称，不拥挤折行
    $('peek').innerHTML = pool.slice(0, 2).map(function (h) {
      return '<span><b>' + esc(h.code) + '</b> ' + esc(h.tag) + '</span>';
    }).join('') + '<span class="peek-more">还有 ' + (D.habits.length - 2) + ' 种声音</span>';
    $('btn-full').className = full ? 'primary' : 'secondary';

    var u = '';
    if (state.unlocked) {
      u = '<p class="unlock-note">本链接由订单 #' + esc(state.unlocked.slice(0, 2)) + ' 解锁</p>';
    }
    $('unlock-note').innerHTML = u;
    // 落地页直接把随机名言填在标题下方
    var q = randomQuote();
    var quoteBox = $('land-quote');
    if (quoteBox) {
      quoteBox.innerHTML = '<span class="ql-t">“' + esc(q.t) + '”</span><span class="ql-a">—— ' + esc(q.a) + '</span>';
    }
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
      return '<button class="opt' + (o.h > 0 ? '' : ' opt-free') + '" data-i="' + i + '">' +
        '<span class="key">' + 'ABCDEF'[i] + '</span><span>' + esc(o.t) + '</span></button>';
    }).join('');

    Array.prototype.forEach.call($('q-opts').children, function (btn) {
      btn.onclick = function () {
        var i = +btn.dataset.i;
        btn.classList.add('picked');
        state.answers = state.answers.filter(function (a) { return a.q !== q.id; });
        state.answers.push({ q: q.id, i: i, h: q.opts[i].h });
        save();
        // 240ms：按压 160ms + 圆点弹 180ms 里的大半，够看清「选上了」再翻页。
        // 原来 140ms 时选中态几乎是一闪而过，反馈等于没给。
        // ⚠️ 产出/_smoke.js 里答题间隔是 200ms，改这个值必须同步调大，否则点空。
        setTimeout(next, 240);
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
    var msgs = ['正在梳理那些纷乱的思绪…', '正在辨认纠缠你最深的那句低语…', '脑海的回声即将浮现…'];
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
    // 只展示命中次数大于 0 的低语，0 次的直接隐藏，不给用户添堵
    var hitRows = score().filter(function (r) { return r.score > 0; });
    if (!hitRows.length) return '';

    var rows = hitRows.map(function (r) {
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
    return '<div class="mx">' + rows + '</div>';
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
    var q = randomQuote(); // 每次进入结果页随机抽一句名言

    var keptHTML = '<p class="hero-kept"><b>' + kept + '/' + total + '</b> 个场景你未被低语裹挟</p>';

    var quoteHTML =
      '<div class="hero-quote">' +
        '<span>“' + esc(q.t) + '”</span>' +
        '<i>—— ' + esc(q.a) + '</i>' +
      '</div>';

    $('res-say').innerHTML =
      '<div class="say">' +
      (artOn() ? deco('ui', D.art.ui.report, 72, 'say-comp') : '') +
      (top
        ? '<b>找找同频的人</b>' +
          '<p>把 <b class="say-code">#' + esc(top.code) + '</b> 留下来，看看有多少人和你听着同样的低语。<br>' +
          '看清那句话，它就很难再悄悄拽着你走了。</p></div>'
        : '<b>脑海清澈，风平浪静</b>' +
          '<p>最近你没有被哪句固执的声音困住。把这份难得的清醒与松弛留住吧。</p></div>');

    if (!top || keptStrong) {
      $('res-hero').innerHTML =
        '<div class="hero">' +
        (artOn() ? deco('ui', D.art.ui.shrug, 116, 'hero-art') : '') +
        '<p class="hero-kicker">这次的回声探测</p>' +
        '<p class="hero-tag" style="font-size:28px">' +
        (keptStrong ? '脑海晴朗，未曾深陷内耗' : '思绪很散，没有沉溺某处') + '</p>' +
        keptHTML +
        '<p class="hero-line">' +
        (keptStrong
          ? '这 ' + total + ' 个极易让人内耗的场景，几乎都没在你心里勾起波澜。你没有顺着杂音往下演，也没有忙着给自己判罪。这种「事情归事情、我不受裹挟」的从容与钝感，是你极珍贵的护城河。'
          : '面对生活里的波折，你的反应比较随性，没有被哪一句固执的声音死死拽住。保持这种呼吸感，不要急着给自己下任何结论。') +
        '</p>' +
        quoteHTML +
        '</div>';
      return;
    }

    $('res-hero').innerHTML =
      '<div class="hero">' +
      (artOn() ? deco('ip', top.id - 1, 116, 'hero-art') : '') +
      '<p class="hero-kicker">你脑海中最频繁的那句低语</p>' +
      '<p class="hero-code">' + esc(top.code) + '</p>' +
      '<p class="hero-tag">' + esc(top.tag) + '</p>' +
      '<p class="hero-line">“' + esc(top.tagline) + '”</p>' +
      (top.hot ? '<p class="hero-hot"><b>' + esc(top.hot) + '</b></p>' : '') +
      '<p class="hero-hit">回响 <b>' + r0.score + '/' + r0.opps + '</b> 次</p>' +
      keptHTML +
      (top.post ? '<div class="hero-post"><i>如果脑内的低语写成动态</i>' + esc(top.post) + '</div>' : '') +
      quoteHTML +
      '</div>';

    $('res-hero').onclick = function () {
      var text = '我脑海里常回响的声音：#' + top.code + ' 「' + top.tag + '」——' + top.tagline;
      copyText(text) ? toast('暗号已复制，快去评论区对号吧') : toast(text);
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

    // 彻底清空定头标题和副标题，界面更纯粹利落
    $('res-head').textContent = '';
    $('res-sub').textContent = '';

    renderHero(picks, free, low);

    var sp = sceneProfile(picks);
    var str = strengthProfile(sc);

    // 正向超能力卡片（明火·精神底色）
    var strengthHTML =
      '<div class="card strength-card">' +
      '<div class="str-header">' +
        '<span class="str-kicker">精神底色 · 隐藏超能力</span>' +
        '<span class="str-code">#' + esc(str.code) + '</span>' +
      '</div>' +
      '<h3 class="str-tag">' + esc(str.tag) + '</h3>' +
      '<p class="str-slogan">“' + esc(str.slogan) + '”</p>' +
      '<p class="str-what">' + esc(str.what) + '</p>' +
      '</div>';

    // 将超能力卡片置于矩阵上方，形成【暗色低语 + 明亮底色】的绝佳呼应
    $('res-chart').innerHTML = strengthHTML + matrixHTML(true) + sceneHTML(sp);
    bindMatrix($('res-chart'));

    if (keptStrong) {
      $('res-cards').innerHTML =
        '<div class="card flat">' +
        (artOn() ? '<div class="flat-comp">' + deco('ui', D.art.ui.note, 100) + '</div>' : '') +
        '<p class="what">这 ' + answered().length + ' 道题里，有 ' + keptOf() +
        ' 次你选择不纠缠、不内耗。说明这些预设的场景并未击中你的软肋。</p>' +
        '<p class="what">生活里难免会有更具挑战性的时刻，但记住今天这种「不往心里去」的手感，它就是你对抗纷扰最坚实的底气。</p></div>';
    } else if (low) {
      $('res-cards').innerHTML =
        '<div class="card flat">' +
        (artOn() ? '<div class="flat-comp">' + deco('ui', D.art.ui.note, 100) + '</div>' : '') +
        '<p class="what">你的反应很均衡，没有某一种固执的念头在反复折磨你。保持这种呼吸感，遇到事顺其自然就好。</p></div>';
    } else {
      // 抽屉只展示最高项（在 selectPicks 里已过滤），默认展开，删去“点一下能展开”的废话提示
      $('res-cards').innerHTML = picks.map(function (r, i) {
          var h = habit(r.id);
          var inner = '<p class="ropen">' + esc(h.open) + '</p>' + evidenceHTML(r.id) +
            '<p class="what">' + esc(h.what) + '</p>' +
            '<div class="swap"><p class="rlabel">换一句试试</p><p class="swap-t">' + esc(h.swap) + '</p></div>' +
            '<p class="contrast">' + esc(h.contrast) + '</p>';
          return '<div class="acc open" id="acc-w-' + i + '">' +
            '<button class="acc-head" id="acc-h-' + i + '">' +
              '<span class="acc-tag">' + esc(h.tag) + '</span>' +
              '<span class="acc-title">' + esc(h.name) + '</span>' +
              '<span class="acc-one">' + esc(h.one) + (h.hot ? ' · ' + esc(h.hot) : '') + '</span>' +
              '<i class="acc-arrow" aria-hidden="true"></i>' +
            '</button>' +
            '<div class="acc-body open" id="acc-b-' + i + '">' + inner + '</div>' +
            '</div>';
        }).join('');
      for (var i = 0; i < picks.length; i++) bindAcc(i);
    }

    var concentrated = (free || keptStrong) ? [] : sc.filter(function (r) {
      return r.score >= Math.ceil(r.opps * DENSE);
    });
    $('res-flag').innerHTML = concentrated.length
      ? '<div class="card flag"><p class="what">这一条几乎每次都出现了。说明它已经很熟练，靠自己硬拧通常拧不动。</p>' +
        '<p class="what">先停一下。也可以找专业的人聊聊 —— 这不是什么大事，只是效率问题。</p></div>'
      : '';

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

    $('res-next').innerHTML = '';

    $('btn-share').onclick = makeShare;
    $('btn-again').onclick = function () {
      state.answers = []; save(); renderLand();
    };
    show('result');
  }
  /* ---------- 黄金合体版分享长图引擎（750×1160 紧凑海报版） ----------
     完美结合图 1 的丰富体检报告质感（粘土小人 + 朋友圈气泡 + 10行方块打点大白卡 + 换一句粉卡）
     与新版的精神底色超能力（#CHILL 舒服者耍起），绝无大面积空挡！
  */
  function makeShare() {
    var imObj = pickShareArt();
    if (!imObj || !artOn()) { drawShare(null); return; }
    var im = new Image();
    im.onload = function () { drawShare(im); };
    im.onerror = function () { drawShare(null); };
    im.src = imObj.src;
  }

  // 保证无论何时都有小人（即使全未受裹挟也绝不丢小人）
  function pickShareArt() {
    var sc = score(), free = state.stage === 'free';
    var low = isLow(sc, free);
    var picks = selectPicks(sc, free, low);
    var hid = picks[0] ? picks[0].id : (sc[0] ? sc[0].id : 4); // 兜底显示可爱小人
    return { hid: hid, src: habitImg(hid) };
  }

  function pickFirst() {
    var sc = score(), free = state.stage === 'free';
    var low = isLow(sc, free);
    if (isKeptStrong()) return null;
    var picks = selectPicks(sc, free, low);
    return picks[0] ? habit(picks[0].id) : null;
  }

  /* ---------- 分享长图（750×1160 体检报告 / 情绪底片版）----------
     版面纪律（吃过两次亏之后写死在这里，改前先读）：

     1. **自下而上排版。** 页脚先落位（FOOT1 / FOOT2），BOTTOM = 页脚上沿；
        换一句卡底边贴 BOTTOM，再往上倒推矩阵卡、Hero。
        自顶向下累加 y 的写法必然出问题——内容少了底部一大块空洞（用户反馈的
        「大面积空旷留白」就是这么来的），内容多了又压到页脚上。
     2. 富余空间分给两块之间的 gap（每边最多 +34），不够用时先压 gap 再让 Hero 上移。
        所以任何文案长度下都刚好填满：不留白、不溢出。
     3. ⚠️ wrapLines **必须在设置字体之后**调用。它用 g.measureText 折行，
        绘制用同一个 g.font，两者字号不一致就是「按小字号折行、按大字号绘制」
        → 该折的行没折 → 文字捅出卡片（30 字文案溢出 12px，7 项 FAIL）。
     4. 粘土小人任何情况下都要在：pickShareArt() 有兜底（没命中就用得分最高那条，
        都没命中用 ip-04），这里只要 im 在就画。Hero 文字宽度要感知小人占位，
        否则长代号会压到小人头上。 */
  function drawShare(im) {
    var W = 750, H = 1160, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');

    var F = '"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif';
    var MONO = '"SFMono-Regular",Menlo,Consolas,"Liberation Mono",monospace';

    /* 色彩系统：界面层（奶油/珊瑚/浅粉）与数据层（深蓝）严格分色，不得互串。
       数据层一旦变红变粉，视觉上等于说「命中＝不好」，会打穿「命中多 ≠ 更糟」的口径。 */
    var COLOR_BG = '#FDF7F2';        // 温润暖米
    var CARD_WHITE = '#FFFFFF';      // 白卡
    var INK = '#2B2320';             // 主字
    var INK2 = '#4A403A';            // 正文深灰
    var MUTED = '#8B7C72';           // 标签浅灰
    var DIM = '#B4A79E';             // 零命中灰
    var ACCENT = '#2557A7';          // 数据层深蓝
    var CORAL = '#D9705A';           // 珊瑚红（装饰点缀）
    var BLUSH = '#FBE9E1';           // 气泡浅粉
    var CELL = '#EDE2D8';            // 未命中方格
    var STR_COLOR = '#245C4B';       // 精神底色森林绿
    var STR_BG = '#F0F6F2';
    var STR_BORDER = '#D2E5DA';

    // ---- 版面几何 ----
    var LEFT = 60, RIGHT = 690, CW = RIGHT - LEFT;   // 内容左右边界，宽 630
    var HERO_TOP_MIN = 118;                          // Hero 最高只能到这儿（eyebrow 下方）
    var FOOT1 = H - 64, FOOT2 = H - 36;              // 两行页脚基线
    var BOTTOM = FOOT1 - 30;                         // 内容区最低边（页脚之上）
    var SWAP_TXT_W = 540;                            // 换一句正文可用宽（卡内 630 - 左右内边距）

    g.fillStyle = COLOR_BG;
    g.fillRect(0, 0, W, H);

    var sc = score();
    var free = state.stage === 'free';
    var low = isLow(sc, free);
    var keptStrong = isKeptStrong();
    var picks = selectPicks(sc, free, low);
    var first = picks[0] ? habit(picks[0].id) : null;
    var str = strengthProfile(sc);              // 正向精神底色（永远有值，函数内自带兜底）
    var NQ = free ? D.freeIds.length : D.questions.length;
    var keptNum = keptOf() + '/' + answered().length;
    var rows = sc.filter(function (r) { return r.opps; });
    var spS = sceneProfile(picks);

    /* ============ 顶部：eyebrow + 粘土小人 ============ */
    g.fillStyle = CORAL;
    g.font = '700 20px ' + F;
    g.fillText((D.brand ? D.brand + ' · ' : '') + NQ + ' 题 · 听见我脑海里的低语', LEFT, 80);

    var imBottom = 0;
    if (im) {
      var iw = 116, ih = Math.round(iw * im.naturalHeight / im.naturalWidth);
      g.drawImage(im, RIGHT - iw, 40, iw, ih);
      imBottom = 40 + ih;
    }
    /* Hero 某一行的顶部若还与小人同高，就得让开它的宽度，不然长文案会压到小人上。 */
    function heroW(yTop) { return (im && yTop < imBottom) ? 548 : CW; }

    /* ============ Hero 区：先量高，不画 ============
       自下而上需要总高，所以把每一行攒成 {h, pad, draw}，最后统一排布。
       h 是「自然内容高」，pad 是定位阶段按剩余空间补给它的弹性，
       draw 拿到的 y 已经是该行垂直居中后的内容顶部。 */
    var heroRows = [];
    function mkRow(contentH, drawFn) { heroRows.push({ h: contentH, pad: 0, draw: drawFn }); }
    var hitNum = picks[0] ? picks[0].score + '/' + picks[0].opps : '0/0';
    var chill = first && !keptStrong;   // true = 有主打低语；false = 全场松弛态

    // 行 1：大号深蓝等宽码
    mkRow(76, function (y) {
        g.fillStyle = ACCENT;
        g.font = '800 62px ' + MONO;
        g.fillText(clipText(g, (chill ? '' : '#') + (chill ? first.code : str.code), heroW(y) ), LEFT, y + 48);
      }
    );

    // 行 2：中文代号 + 网友热词
    mkRow(38, function (y) {
        var W0 = heroW(y);
        g.fillStyle = INK;
        g.font = '800 26px ' + F;
        var nm = chill ? first.tag : ('精神底色 · ' + str.tag);
        g.fillText(clipText(g, nm, W0 * 0.72), LEFT, y + 24);
        var nw = g.measureText(clipText(g, nm, W0 * 0.72)).width;
        if (chill && first.hot) {
          g.fillStyle = MUTED;
          g.font = '500 16px ' + F;
          g.fillText(clipText(g, '网友管这叫 ' + first.hot, W0 - nw - 18), LEFT + nw + 16, y + 23);
        }
      }
    );

    // 行 3：自述金句（按行数据行，高度可变）
    (function () {
      g.font = '500 22px ' + F;
      var t = chill ? first.tagline : ('“' + str.slogan + '”');
      var lines = wrapLines(g, t, 548);
      mkRow(lines.length * 32 + 6, function (y) {
          g.fillStyle = INK2;
          g.font = '500 22px ' + F;      // ⚠️ 与上面折行同一个字号，别改
          var yy = y + 24;
          lines.forEach(function (ln) { g.fillText(ln, LEFT, yy); yy += 32; });
        }
      );
    })();

    // 行 4：朋友圈气泡（粉底圆角 + 同行右侧回响次数）
    (function () {
      var postText = chill
        ? (first.post || first.one)
        : '面对外界的波折，我不接茬也不内耗，自己舒服最重要！';
      g.font = '400 20px ' + F;
      /* ⚠️ 回响数字只在「有主打低语」时才成立——松弛态没有"这句低语"，
         硬写「这句低语回响 20/60」语义是错的（20/60 是全场未裹挟数，
         下一行已经印了）。此时让气泡占满整行宽，反而更饱满。 */
      var label = '这句低语回响 ';
      var rightW = 0, lw = 0, nw = 0;
      if (chill) {
        g.font = '600 17px ' + F;
        lw = g.measureText(label).width;
        g.font = '700 22px ' + MONO;
        nw = g.measureText(hitNum).width;
        rightW = lw + nw + 12;
      }
      var maxBubble = CW - rightW - 14;
      g.font = '400 20px ' + F;
      var bw = Math.max(180, Math.min(maxBubble, g.measureText(postText).width + 40));

      mkRow(68, function (y) {
          rr(g, LEFT, y + 4, bw, 54, 14, BLUSH);
          g.fillStyle = INK2;
          g.font = '400 20px ' + F;
          /* 基线 y+36 不是 y+38：行盒 1.06em 会往下伸 21px，38 就捅出气泡底 1px
             （layout 的「文字突出卡片底边」抓的，肉眼根本看不出来但确实出了）。 */
          g.fillText(clipText(g, postText, bw - 32), LEFT + 16, y + 36);

          if (chill) {
            g.fillStyle = MUTED;
            g.font = '600 17px ' + F;
            g.fillText(label, RIGHT - nw - lw, y + 37);
            g.fillStyle = ACCENT;
            g.font = '700 22px ' + MONO;
            g.fillText(hitNum, RIGHT - nw, y + 37);
          }
        }
      );
    })();

    // 行 5：未受裹挟计数 + 浅绿精神底色勋章
    (function () {
      var ktxt = (chill ? '未受低语裹挟 ' : '全场未受裹挟 ');
      g.font = '600 18px ' + F;
      var kw = g.measureText(ktxt).width;
      g.font = '700 22px ' + MONO;
      var knw = g.measureText(keptNum).width;
      /* ⚠️ 勋章文案必须跟数据一致（mix 情形抓到的语义 bug）：
         分散态（keptStrong=false）也走松弛分支，但那时明明有一堆惯性命中，
         说「松弛达成 · 无惯性上榜」是在对用户撒谎。两种情形分开说：
           - 真松弛（keptStrong）→ 松弛达成 · 无惯性上榜
           - 只是分散（isLow）→ 没有哪条特别重（这是事实：最高命中率低） */
      var badgeText = '✦ ' + (chill
        ? '精神底色 · #' + str.code + ' ' + str.tag
        : (keptStrong ? '松弛达成 · 无惯性上榜'
                      : '没有哪条特别重 · 十种都沾了一点'));
      g.font = '700 13px ' + F;
      var bwanted = g.measureText(badgeText).width + 24;
      var bmax = RIGHT - (LEFT + kw + knw + 18);
      var bw = Math.max(0, Math.min(bwanted, bmax));

      mkRow(40, function (y) {
          g.fillStyle = MUTED;
          g.font = '600 18px ' + F;
          g.fillText(ktxt, LEFT, y + 22);
          g.fillStyle = ACCENT;
          g.font = '700 22px ' + MONO;
          g.fillText(keptNum, LEFT + kw, y + 22);

          /* 勋章：宽度是被右侧剩余空间算出来的，不是拍脑袋。
             放不下时 clipText 截断，绝不让胶囊捅出右边界。 */
          if (bw > 90) {
            rr(g, RIGHT - bw, y + 2, bw, 30, 8, STR_BG);
            g.strokeStyle = STR_BORDER; g.lineWidth = 1; g.stroke();
            g.fillStyle = STR_COLOR;
            g.font = '700 13px ' + F;
            g.fillText(clipText(g, badgeText, bw - 20), RIGHT - bw + 12, y + 21);
          }
        }
      );
    })();

    var heroH = 0;
    heroRows.forEach(function (r) { heroH += r.h; });

    /* ============ 矩阵白卡 / 换一句卡：先算高度 ============ */
    var step = rows.length > 10 ? 26 : 28;
    var spH = spS ? 54 : 0;
    var mh = 24 + rows.length * step + spH + 10;

    var swapText = (chill && first && first.swap)
      ? first.swap
      : (str.slogan + '——累了就歇，别跟自己较劲。');
    g.font = '600 20px ' + F;                        // ⚠️ 折行与绘制必须是同一个字号
    var swapLines = wrapLines(g, swapText, SWAP_TXT_W);
    var swapH = 46 + swapLines.length * 30;

    /* ============ 自下而上定位 ============
       ⚠️ 核心恒等式：heroTop + heroH + gap + mh + gap + swapH === BOTTOM
       换一句卡的底边因此**恒等于**页脚上沿，底部一个像素都不留白。
       富余空间全部浮到顶部（那里有粘土小人占位，浮上去视觉不空），
       ⚠️ 不能反过来让 heroTop 居中、swapTop 钉底 —— 两者只在恰好填满时才重合，
          其他情况不是底部空洞就是压到页脚（第一版就是这个 bug，空了 134px）。

       装不下时的压缩顺序不能反：先压块间距，再压矩阵行距。
       先压行距会让字挤在一起，那是比留白更糟的问题。 */
    var MIN_GAP = 14, MAX_GAP = 56, MAX_ROW_PAD = 8;
    var availH = BOTTOM - HERO_TOP_MIN;
    var heroH0 = 0;
    heroRows.forEach(function (r) { heroH0 += r.h; });

    var needMin = heroH0 + swapH + mh + MIN_GAP * 2;
    if (needMin > availH) {
      /* 只有矩阵能安全收窄：10 行 × step，每行省一点就能腾出几十 px */
      var over = needMin - availH;
      var per = Math.ceil(over / Math.max(1, rows.length));
      step = Math.max(22, step - per);
      mh = 24 + rows.length * step + spH + 10;
    }

    var gap = Math.max(MIN_GAP, Math.min(MAX_GAP, (availH - heroH0 - mh - swapH) / 2));

    /* 还剩富余 → 按「最能吸收的人先吃」分配：矩阵 10 行 > Hero 5 行 > 浮到顶部。
       为什么是这个顺序：10 行每行多 6px 就是 60px，肉眼只是「行距更舒服」；
       浮到顶部却会变成 eyebrow 与 Hero 之间的一大块空 —— 那是事故不是留白。
       最后一档落在 eyebrow 与 Hero 之间，右上角有粘土小人占着所以不算太空，
       但绝不能剩太多：_layout.js 有「顶部无大片留白（≤170px）」的断言守着。 */
    var remaining = availH - (heroH0 + mh + swapH + gap * 2);

    var stepPad = 0;
    if (remaining > 0 && rows.length) {
      stepPad = Math.min(8, Math.floor(remaining / rows.length));
      if (stepPad > 0) {
        step += stepPad;
        mh = 24 + rows.length * step + spH + 10;
        remaining -= stepPad * rows.length;
      }
    }

    var rowPad = Math.min(MAX_ROW_PAD, Math.max(0, remaining / Math.max(1, heroRows.length)));
    var heroH = 0;
    heroRows.forEach(function (r) { r.pad = rowPad; r.h += rowPad; heroH += r.h; });

    var usedH = heroH + mh + swapH + gap * 2;
    var heroTop = HERO_TOP_MIN + Math.max(0, availH - usedH);
    var mCardTop = heroTop + heroH + gap;
    var swapTop = mCardTop + mh + gap;      // 由恒等式保证：swapTop + swapH === BOTTOM

    // ---- 画 Hero（每行在自己那格里垂直居中）----
    var hy = heroTop;
    heroRows.forEach(function (r) { r.draw(hy + r.pad / 2); hy += r.h; });

    // ---- 画矩阵大白卡（10 行方块打点，深蓝命中 vs 浅灰未命中）----
    rr(g, LEFT, mCardTop, CW, mh, 20, CARD_WHITE);
    g.strokeStyle = '#F0E5DC'; g.lineWidth = 1; g.stroke();

    var my = mCardTop + 24;
    rows.forEach(function (r) {
      var h = habit(r.id);
      g.fillStyle = r.score ? INK : DIM;
      g.font = (r.score ? '600 ' : '400 ') + '16px ' + F;
      g.fillText(clipText(g, h.name, 210), LEFT + 18, my + 15);

      var opps = oppsOf(r.id);
      var big = opps.length <= 12;
      var cell = big ? 20 : 10, gp = big ? 8 : 2;
      var strip = opps.length * cell + (opps.length - 1) * gp;
      var x = 600 - strip;

      opps.forEach(function (qid) {
        var on = answered().some(function (a) { return a.q === qid && a.h === r.id; });
        g.fillStyle = on ? ACCENT : CELL;
        g.fillRect(x, my + 1, cell, cell);
        x += cell + gp;
      });

      g.fillStyle = r.score ? ACCENT : DIM;
      g.font = '700 16px ' + F;
      g.textAlign = 'right';
      g.fillText(r.score + '/' + r.opps, 660, my + 15);
      g.textAlign = 'left';
      my += step;
    });

    // 场景画像内嵌条
    if (spS) {
      my += 4;
      var spLine = clipText(g, spS.line + ' · ' + spS.hit + '/' + spS.total, 380);
      g.fillStyle = INK2;
      g.font = '500 17px ' + F;
      g.fillText(spLine, LEFT + 18, my + 22);
      var slw = g.measureText(spLine).width;
      g.fillStyle = CORAL;
      g.font = '700 17px ' + F;
      g.fillText(clipText(g, '· 网友管这叫 ' + spS.hot, CW - 36 - slw - 10), LEFT + 18 + slw + 8, my + 22);
    }

    // ---- 画换一句卡（swapTop 由上面的恒等式算出，底边必然贴着 BOTTOM）----
    rr(g, LEFT, swapTop, CW, swapH, 18, BLUSH);
    g.fillStyle = CORAL;
    g.font = '700 16px ' + F;
    g.fillText(chill ? '换一句试试' : '给生活的松弛解法', LEFT + 22, swapTop + 28);

    g.fillStyle = INK;
    g.font = '600 20px ' + F;                        // ⚠️ 与上面 wrapLines 同一个字号
    var syy = swapTop + 54;
    swapLines.forEach(function (line) {
      g.fillText(line, LEFT + 22, syy);
      syy += 30;
    });

    // ---- 页脚：双暗号对线货币 ----
    g.fillStyle = MUTED;
    g.font = '400 16px ' + F;
    if (D.brand) g.fillText('@' + D.brand, LEFT, FOOT1);
    g.fillText(D.disclaimer, LEFT, FOOT2);

    var dualCode = (chill ? '#' + first.code + ' ' : '') + '× #' + str.code;
    g.font = '700 20px ' + MONO;
    var cw = g.measureText(dualCode).width;
    g.textAlign = 'right';
    g.fillStyle = ACCENT;
    g.fillText(dualCode, RIGHT, FOOT1);
    g.fillStyle = INK2;
    g.font = '500 16px ' + F;
    g.fillText('让朋友也测一个 · 对暗号 ', RIGHT - cw - 6, FOOT1);
    g.textAlign = 'left';

    // 导出高清图片
    var url = c.toDataURL('image/png');
    $('share-img').src = url;
    $('share-link').href = url;
    $('share-link').download = '情绪取样_心智档案卡.png';
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
    g.fillStyle = fill;
    g.fill();
  }

  function clipText(g, text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    var s = text;
    while (s.length && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function wrap(g, text, x, y, maxW, lh) {
    var yy = y;
    wrapLines(g, text, maxW, lh).forEach(function (line) {
      g.fillText(line, x, yy);
      yy += lh;
    });
    return yy;
  }

  function wrapLines(g, text, maxW) {
    var out = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var t = line + text[i];
      if (g.measureText(t).width > maxW && line) {
        out.push(line);
        line = text[i];
      } else {
        line = t;
      }
    }
    if (line) out.push(line);
    return out;
  }

  /* ---------- 启动 ---------- */
  function boot() {
    load();
    applyArtClasses();
    probeArt();
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