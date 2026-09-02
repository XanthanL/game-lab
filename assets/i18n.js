/* GAME LAB 共享双语逻辑。
   页面把两种语言直接写在元素的 data-zh / data-en 上（默认渲染中文，静态可见、无需 JS 也能读），
   标题与描述则写在 <html> 的 data-title-zh / data-title-en / data-desc-zh / data-desc-en 上。
   另外负责亮 / 暗主题切换：<html data-theme="light|dark">，未手动选择时跟随系统。 */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var KEY = "gl-lang";
  var lang = "zh";
  try { lang = localStorage.getItem(KEY) || "zh"; } catch (e) {}

  function setMeta(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el && value != null) el.setAttribute(attr, value);
  }

  /* ---------- 主题：亮 / 暗 ---------- */
  var TKEY = "gl-theme";
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var SUN = '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>';
  var MOON = '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2z"/></svg>';

  function sysTheme() { return mq && mq.matches ? "light" : "dark"; }
  function storedTheme() { try { return localStorage.getItem(TKEY); } catch (e) { return null; } }
  function currentTheme() {
    var a = root.getAttribute("data-theme");
    return a === "light" || a === "dark" ? a : sysTheme();
  }
  function setTheme(t, persist) {
    root.setAttribute("data-theme", t);
    if (persist) { try { localStorage.setItem(TKEY, t); } catch (e) {} }
    labelTheme();
  }
  function labelTheme() {
    if (!themeBtn) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    var zh = next === "light" ? "切换到亮色模式" : "切换到暗色模式";
    var en = next === "light" ? "Switch to light mode" : "Switch to dark mode";
    themeBtn.setAttribute("aria-label", lang === "zh" ? zh : en);
    themeBtn.setAttribute("title", lang === "zh" ? zh : en);
  }

  /* 按钮由脚本注入：任何引用本文件的页面都自动拿到，不用逐个改 HTML */
  var themeBtn = document.getElementById("themeToggle");
  if (!themeBtn) {
    var langBtn = document.getElementById("langToggle");
    if (langBtn && langBtn.parentNode) {
      themeBtn = document.createElement("button");
      themeBtn.id = "themeToggle";
      themeBtn.type = "button";
      themeBtn.className = "theme-toggle glass";
      themeBtn.innerHTML = SUN + MOON;
      langBtn.parentNode.insertBefore(themeBtn, langBtn);
    }
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  }
  /* 没手动选过的时候，跟着系统变化走 */
  if (!storedTheme()) root.setAttribute("data-theme", sysTheme());
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function () { if (!storedTheme()) setTheme(sysTheme(), false); });
  }

  function apply() {
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
    labelTheme();
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
