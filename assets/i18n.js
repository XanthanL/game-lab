/* GAME LAB 共享双语逻辑。
   页面把两种语言直接写在元素的 data-zh / data-en 上（默认渲染中文，静态可见、无需 JS 也能读），
   标题与描述则写在 <html> 的 data-title-zh / data-title-en / data-desc-zh / data-desc-en 上。 */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var KEY = "gl-lang";
  var lang = "zh";
  try { lang = localStorage.getItem(KEY) || "zh"; } catch (e) {}

  function setMeta(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el && value != null) el.setAttribute(attr, value);
  }

  function apply() {
    var root = document.documentElement;
    root.lang = lang === "zh" ? "zh-CN" : "en";

    var title = root.getAttribute("data-title-" + lang);
    var desc = root.getAttribute("data-desc-" + lang);
    if (title) {
      document.title = title;
      setMeta('meta[property="og:title"]', "content", title);
      setMeta('meta[name="twitter:title"]', "content", title);
    }
    if (desc) {
      setMeta('meta[name="description"]', "content", desc);
      setMeta('meta[property="og:description"]', "content", desc);
      setMeta('meta[name="twitter:description"]', "content", desc);
    }
    setMeta('meta[property="og:locale"]', "content", lang === "zh" ? "zh_CN" : "en_US");

    document.querySelectorAll("[data-zh]").forEach(function (el) {
      var v = el.getAttribute("data-" + lang);
      if (v == null) return;
      if (v.indexOf("<") !== -1) el.innerHTML = v; else el.textContent = v;
    });

    var btn = document.getElementById("langToggle");
    if (btn) {
      btn.textContent = lang === "zh" ? "EN" : "中文";
      btn.setAttribute("aria-label", lang === "zh" ? "切换到英文 / Switch to English" : "切换到中文 / Switch to Chinese");
    }
  }

  var btn = document.getElementById("langToggle");
  if (btn) {
    btn.addEventListener("click", function () {
      lang = lang === "zh" ? "en" : "zh";
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      apply();
    });
  }

  apply();

  /* 滚动揭示 */
  var els = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function (e) { e.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }
})();
