/* 铜管与滤芯 · app.js — 原生 JS，无依赖，逐功能容错 */
(function () {
  "use strict";

  /* ── 1. 顶栏今日状态戳（营业 07:00–19:00；风暴日以讯号板公告为准）── */
  try {
    var stamp = document.getElementById("shop-status");
    if (stamp) {
      var h = new Date().getHours();
      var open = h >= 7 && h < 19;
      stamp.textContent = open ? "营业中 · 至 19:00"
        : (h < 7 ? "已打烊 · 07:00 开门" : "已打烊 · 明 07:00 开门");
      if (open) stamp.classList.add("is-open");
    }
  } catch (e) {}

  /* ── 2. 双币切换：银轮 → 金海克斯（柜台牌价 1:5）── */
  var fmt = function (silver, cur) {
    if (cur === "hex") {
      var v = silver / 5;
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    }
    return String(silver);
  };
  var setCurrency = function (cur) {
    var nums = document.querySelectorAll(".num[data-silver]");
    for (var i = 0; i < nums.length; i++) {
      var el = nums[i];
      el.textContent = fmt(parseInt(el.getAttribute("data-silver"), 10), cur);
    }
    var label = document.getElementById("cur-label");
    if (label) label.textContent = cur === "hex" ? "金海克斯" : "银轮";
    var btns = document.querySelectorAll(".cur-btn");
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute("aria-pressed", btns[j].getAttribute("data-cur") === cur ? "true" : "false");
    }
    try { localStorage.setItem("tg13-cur", cur); } catch (e) {}
  };
  try {
    var curBtns = document.querySelectorAll(".cur-btn");
    for (var k = 0; k < curBtns.length; k++) {
      curBtns[k].addEventListener("click", function () { setCurrency(this.getAttribute("data-cur")); });
    }
    var saved = null;
    try { saved = localStorage.getItem("tg13-cur"); } catch (e) {}
    if (saved === "hex") setCurrency("hex");
  } catch (e) {}

  /* ── 3. 价目表筛选：维修 / 滤芯 / 租赁 ── */
  var applyFilter = function (f) {
    var rows = document.querySelectorAll("#price-table tbody tr");
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      var cat = rows[i].getAttribute("data-cat") || "";
      var show = f === "全部" || cat === f;
      rows[i].style.display = show ? "" : "none";
      if (show) n++;
    }
    var c = document.getElementById("price-count");
    if (c) c.textContent = (f === "全部" ? "共 " + n + " 项" : f + " · " + n + " 项");
    var btns = document.querySelectorAll(".f-btn");
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute("aria-pressed", btns[j].getAttribute("data-filter") === f ? "true" : "false");
    }
  };
  try {
    var fBtns = document.querySelectorAll(".f-btn");
    for (var m = 0; m < fBtns.length; m++) {
      fBtns[m].addEventListener("click", function () { applyFilter(this.getAttribute("data-filter")); });
    }
  } catch (e) {}

  /* 首屏 CTA 带筛选直达价目表 */
  try {
    var gotoLinks = document.querySelectorAll("[data-goto-filter]");
    for (var g = 0; g < gotoLinks.length; g++) {
      gotoLinks[g].addEventListener("click", function () {
        applyFilter(this.getAttribute("data-goto-filter"));
      });
    }
  } catch (e) {}

  /* ── 4. 预约表单：校验 + 蜜罐 → 生成讯号板留言 ──
     [待接] 接轻量表单后端时，把 payload POST 到 FORM_ENDPOINT 即可 */
  var FORM_ENDPOINT = ""; /* 例：https://form.example.com/tg13 */
  try {
    var form = document.getElementById("booking-form");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();

        /* 蜜罐：机器人填了就静默丢弃 */
        var hp = document.getElementById("f-fax");
        if (hp && hp.value) { form.reset(); return; }

        var val = function (id) {
          var el = document.getElementById(id);
          return el ? el.value.trim() : "";
        };
        var bad = [];
        if (!val("f-name")) bad.push("f-name");
        if (!val("f-contact")) bad.push("f-contact");
        if (!val("f-desc")) bad.push("f-desc");
        if (bad.length) {
          for (var i = 0; i < bad.length; i++) {
            var el = document.getElementById(bad[i]);
            el.style.borderColor = "var(--accent)";
          }
          document.getElementById(bad[0]).focus();
          return;
        }

        var d = new Date();
        var pad = function (x) { return (x < 10 ? "0" : "") + x; };
        var no = "TG-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
                 "-" + String(Math.floor(Math.random() * 900) + 100);

        var photos = document.getElementById("f-photo").files;
        var ph = photos.length ? photos.length + " 张（" +
          Array.prototype.slice.call(photos, 0, 3).map(function (f) { return f.name; }).join("、") +
          "）" : "无";

        var msg =
          "【预约 · " + no + "】\n" +
          "姓名：" + val("f-name") + "\n" +
          "联系：" + val("f-contact") + "\n" +
          "型号：" + (val("f-model") || "到店确认") + "\n" +
          "环境：" + val("f-env") + "\n" +
          "问题：" + val("f-desc") + "\n" +
          "期望：" + val("f-time") + "\n" +
          "备用机：" + (document.getElementById("f-spare").checked ? "要" : "不要") + "\n" +
          "照片：" + ph;

        var out = document.getElementById("booking-out");
        var box = document.getElementById("booking-msg");
        if (out && box) {
          out.hidden = false;
          box.textContent = msg;
          out.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        if (FORM_ENDPOINT) {
          /* [待接] 后端就绪后启用：
          fetch(FORM_ENDPOINT, { method: "POST", body: JSON.stringify({ no: no, text: msg }) }); */
        }
      });
    }
  } catch (e) {}

  /* ── 5. 复制留言 ── */
  try {
    var copyBtn = document.getElementById("copy-msg");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = document.getElementById("booking-msg").textContent;
        var state = document.getElementById("copy-state");
        var done = function (ok) {
          if (state) state.textContent = ok ? "已复制 ✓ 粘贴到讯号板 LX-13 即可" : "复制失败 —— 请长按留言文本手动全选复制";
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta);
          done(ok);
        }
      });
    }
  } catch (e) {}
})();
