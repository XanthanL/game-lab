/* ============================================================
   app.js — 渲染 + 搜索 + 筛选（无依赖，原生 JS）
   数据唯一来源：data.js（由 更新网站.bat 从 CSV 生成，请勿手改）
   字段按「表头名」映射，不按列序：店主改列顺序、增删行都不影响
   ============================================================ */
(function () {
  "use strict";

  /* ── 表头同义词表：店主换列名也能对上 ── */
  var SYN = {
    id:        ["编号", "id", "ID", "No", "编号ID"],
    artist:    ["艺人", "艺术家", "歌手", "artist", "Artist"],
    album:     ["专辑", "唱片", "专辑名", "标题", "album", "Album"],
    year:      ["年份", "年", "year", "Year"],
    format:    ["格式", "介质", "规格", "format"],
    condition: ["品相", "成色", "condition"],
    price:     ["价格", "售价", "price", "Price"],
    status:    ["状态", "status"],
    note:      ["备注", "版本", "版本备注", "note", "备注/版本"]
  };

  var STATUS_ORDER = { "在架": "is-stock", "已预留": "is-reserved", "已售": "is-sold" };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function findCol(headers, keys) {
    for (var k = 0; k < keys.length; k++) {
      var i = headers.indexOf(keys[k]);
      if (i !== -1) return i;
    }
    return -1;
  }

  /* ── 读取数据 ── */
  var data = window.__INVENTORY__;
  var listEl = document.getElementById("ledger");
  var resultEl = document.getElementById("result-line");
  var stampEl = document.getElementById("live-stamp");
  var footStampEl = document.getElementById("foot-stamp");
  var errEl = document.getElementById("dataload-error");
  var controlsEl = document.getElementById("controls");

  if (!data || !data.headers || !data.rows || !data.rows.length) {
    errEl.hidden = false;
    controlsEl.hidden = true;
    resultEl.hidden = true;
    return;
  }

  var headers = data.headers.map(function (h) { return String(h).trim(); });
  var col = {
    id: findCol(headers, SYN.id), artist: findCol(headers, SYN.artist),
    album: findCol(headers, SYN.album), year: findCol(headers, SYN.year),
    format: findCol(headers, SYN.format), condition: findCol(headers, SYN.condition),
    price: findCol(headers, SYN.price), status: findCol(headers, SYN.status),
    note: findCol(headers, SYN.note)
  };
  var missing = Object.keys(col).filter(function (k) { return col[k] === -1; });

  var items = data.rows.map(function (r, i) {
    function g(k) { return col[k] === -1 ? "" : String(r[col[k]] == null ? "" : r[col[k]]).trim(); }
    var priceRaw = g("price").replace(/[^\d.]/g, "");
    return {
      idx: i,
      id: g("id"), artist: g("artist"), album: g("album"), year: g("year"),
      format: g("format"), condition: g("condition"),
      price: priceRaw === "" ? null : priceRaw,
      status: g("status"),
      note: g("note"),
      search: r.join("\u0001").toLowerCase()
    };
  });

  /* ── 状态集合与计数（未知/空状态只出现在「全部」里）── */
  var KNOWN = ["在架", "已预留", "已售"];
  var counts = {};
  KNOWN.forEach(function (s) { counts[s] = 0; });
  var otherStatus = 0;
  items.forEach(function (it) {
    if (KNOWN.indexOf(it.status) !== -1) counts[it.status]++;
    else otherStatus++;
  });

  /* ── 筛选控件 ── */
  var state = { status: "在架", format: "", cond: "", q: "" };

  var statusBtns = Array.prototype.slice.call(document.querySelectorAll(".status-group button[data-status]"));
  statusBtns.forEach(function (b) {
    var n = b.querySelector(".n");
    var s = b.getAttribute("data-status");
    if (n) n.textContent = s === "全部" ? items.length : (counts[s] || 0) + (s === "其他" ? otherStatus : 0);
    b.addEventListener("click", function () {
      state.status = s;
      statusBtns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      render();
    });
  });
  /* 「其他」按钮：仅当表里出现未知状态值时显示 */
  if (otherStatus > 0) {
    var otherBtn = document.querySelector('[data-status="其他"]');
    if (otherBtn) otherBtn.hidden = false;
  }

  var fmtSel = document.getElementById("filter-format");
  var condSel = document.getElementById("filter-condition");
  var qInput = document.getElementById("search-box");

  function fillSelect(sel, values, allLabel) {
    sel.innerHTML = "";
    var opt = document.createElement("option");
    opt.value = ""; opt.textContent = allLabel;
    sel.appendChild(opt);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }
  /* 取值顺序：品相按成色从高到低，格式按首次出现 */
  var COND_RANK = { "近全新": 0, "十成": 0, "九五成": 1, "九成": 2, "八五成": 3, "八成": 4, "七五成": 5, "七成": 6, "六成": 7 };
  var fmtValues = [], condSet = {};
  items.forEach(function (it) {
    if (it.format && fmtValues.indexOf(it.format) === -1) fmtValues.push(it.format);
    if (it.condition) condSet[it.condition] = true;
  });
  var condValues = Object.keys(condSet).sort(function (a, b) {
    return (COND_RANK[a] != null ? COND_RANK[a] : 99) - (COND_RANK[b] != null ? COND_RANK[b] : 99);
  });
  fillSelect(fmtSel, fmtValues, "全部格式");
  fillSelect(condSel, condValues, "全部品相");

  fmtSel.addEventListener("change", function () { state.format = fmtSel.value; render(); });
  condSel.addEventListener("change", function () { state.cond = condSel.value; render(); });
  qInput.addEventListener("input", function () { state.q = qInput.value.trim().toLowerCase(); render(); });

  function match(it) {
    if (state.status === "其他") {
      if (KNOWN.indexOf(it.status) !== -1) return false;
    } else if (state.status !== "全部" && it.status !== state.status) return false;
    if (state.format && it.format !== state.format) return false;
    if (state.cond && it.condition !== state.cond) return false;
    if (state.q) {
      var toks = state.q.split(/\s+/);
      for (var t = 0; t < toks.length; t++) {
        if (it.search.indexOf(toks[t]) === -1) return false;
      }
    }
    return true;
  }

  /* 空结果的「清除筛选」：把状态一并恢复为默认（在架） */
  document.getElementById("empty-clear").addEventListener("click", function () {
    state = { status: "在架", format: "", cond: "", q: "" };
    statusBtns.forEach(function (x) {
      x.setAttribute("aria-pressed", x.getAttribute("data-status") === "在架" ? "true" : "false");
    });
    fmtSel.value = ""; condSel.value = ""; qInput.value = "";
    render();
  });

  /* ── 渲染 ── */
  function rowHTML(it) {
    var stCls = STATUS_ORDER[it.status] || "is-unknown";
    var stText = it.status || "未标状态";
    var price = it.price == null ? '<span class="ask">到店询价</span>' : "¥" + esc(it.price);
    var sold = it.status === "已售" ? " is-sold" : "";
    return '<div class="row' + sold + '" role="row">' +
      '<div class="c-id mono" role="cell">' + esc(it.id) + "</div>" +
      '<div class="c-main" role="cell"><span class="album">' + esc(it.album || "（无专辑名）") + "</span>" +
      (it.artist ? '<span class="artist">' + esc(it.artist) + "</span>" : "") + "</div>" +
      '<div class="c-year mono" role="cell">' + esc(it.year) + "</div>" +
      '<div class="c-format" role="cell">' + esc(it.format) + "</div>" +
      '<div class="c-cond" role="cell">' + esc(it.condition) + "</div>" +
      '<div class="c-note" role="cell">' + esc(it.note) + "</div>" +
      '<div class="c-price" role="cell">' + price + "</div>" +
      '<div class="c-status" role="cell"><span class="tag ' + stCls + '">' + esc(stText) + "</span></div>" +
      "</div>";
  }

  function render() {
    var shown = items.filter(match);
    listEl.innerHTML = shown.map(rowHTML).join("");
    document.getElementById("empty-state").hidden = shown.length !== 0;
    var parts = ["显示 " + shown.length + " / " + items.length + " 条"];
    if (state.status !== "全部") parts.push("状态=" + state.status);
    if (state.format) parts.push("格式=" + state.format);
    if (state.cond) parts.push("品相=" + state.cond);
    if (state.q) parts.push('搜索"' + state.q + '"');
    resultEl.innerHTML = "<span>" + esc(parts.join(" · ")) + "</span>" +
      '<button class="clear" id="clear-inline" hidden>清除筛选</button>';
    var inline = document.getElementById("clear-inline");
    var filtered = state.format || state.cond || state.q;
    inline.hidden = !filtered;
    if (filtered) inline.addEventListener("click", function () {
      state.format = ""; state.cond = ""; state.q = "";
      fmtSel.value = ""; condSel.value = ""; qInput.value = "";
      render();
    });
  }

  /* ── 更新时间戳（来自 data.js 的生成时间）── */
  var stampText = "库存更新于 " + (data.generatedAt || "未知时间");
  stampEl.innerHTML = '<span class="dot">●</span> ' + esc(stampText);
  footStampEl.textContent = "数据生成于 " + (data.generatedAt || "—") + " · 每周日更新";

  /* 表头缺失提示（不阻塞，缺的列显示为空） */
  if (missing.length) {
    console.warn("CSV 表头里没找到这些列：", missing.join(", "));
  }

  /* 桌面端表头（ARIA 表格语义） */
  var headRow = document.querySelector(".ledger-head");
  if (headRow) {
    headRow.setAttribute("role", "row");
  }

  render();
})();
