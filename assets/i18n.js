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

  /* ---------- 主题：亮 / 暗（灯泡开关）---------- */
  var TKEY = "gl-theme";
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  /* 造型参考 CodePen "Pure CSS Bulb Switch"（Wujek_Greg），按本站尺寸缩放；
     点亮/熄灭由 <html data-theme> 驱动，见 assets/index.css 的 .bulb-switch。 */
  var BULB =
    '<span class="bs-track">' +
      '<span class="bs-bulb">' +
        '<span class="bs-center"></span>' +
        '<span class="bs-f1"></span>' +
        '<span class="bs-f2"></span>' +
        '<span class="bs-refl"><span></span></span>' +
        '<span class="bs-sparks">' +
          '<i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i>' +
        '</span>' +
      '</span>' +
    '</span>';

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
    var zh = next === "light" ? "开灯：切换到亮色模式" : "关灯：切换到暗色模式";
    var en = next === "light" ? "Turn on: switch to light mode" : "Turn off: switch to dark mode";
    themeBtn.setAttribute("aria-checked", currentTheme() === "light" ? "true" : "false");
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
      themeBtn.className = "bulb-switch";
      themeBtn.setAttribute("role", "switch");
      themeBtn.innerHTML = BULB;
      langBtn.parentNode.insertBefore(themeBtn, langBtn);
    }
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  }

  /* ---------- 风格：7 套皮肤 ---------- */
  var SKEY = "gl-style";
  /* 顺序 = 显示顺序。
     chip  平铺按钮上的名字（写全）  short 顶栏下拉里的简称  full 无障碍标签用的全名 */
  var STYLES = ["glass", "soft", "raw", "crete", "xp", "w7", "w10", "classic", "dream", "pool", "weird", "mc",
                "gtavc", "gtasa", "gta4", "gta5", "pipboy"];
  var SMETA = {
    glass: { short: { zh: "玻璃",  en: "GLAS"  }, chip: { zh: "液态玻璃",    en: "Liquid Glass" }, full: { zh: "液态玻璃 · Liquid Glass", en: "Liquid Glass" } },
    soft:  { short: { zh: "拟物",  en: "SOFT"  }, chip: { zh: "新拟物",      en: "Neumorphism" },   full: { zh: "新拟物 · Neumorphism",    en: "Neumorphism" } },
    raw:   { short: { zh: "粗野",  en: "BRUT"  }, chip: { zh: "新粗野",      en: "Neo-brutalism" }, full: { zh: "新粗野 · Neo-brutalism",  en: "Neo-brutalism" } },
    crete: { short: { zh: "砼核",  en: "CONC"  }, chip: { zh: "砼核",        en: "Concretecore" },  full: { zh: "砼核 · Concretecore",     en: "Concretecore" } },
    xp:    { short: { zh: "XP",    en: "XP"    }, chip: { zh: "Windows XP",  en: "Windows XP" },    full: { zh: "Windows XP · Luna",       en: "Windows XP · Luna" } },
    w7:    { short: { zh: "Win7",  en: "WIN7"  }, chip: { zh: "Windows 7",   en: "Windows 7" },     full: { zh: "Windows 7 · Aero",        en: "Windows 7 · Aero" } },
    w10:     { short: { zh: "Win10",   en: "WIN10"   }, chip: { zh: "Windows 10",    en: "Windows 10" },      full: { zh: "Windows 10 · Metro",         en: "Windows 10 · Metro" } },
    classic: { short: { zh: "Classic", en: "CLASSIC" }, chip: { zh: "Windows 经典",  en: "Windows Classic" }, full: { zh: "Windows 经典 · Classic",     en: "Windows Classic" } },
    dream:   { short: { zh: "梦核",    en: "DREAM"   }, chip: { zh: "梦核",          en: "Dreamcore" },       full: { zh: "梦核 · Dreamcore",           en: "Dreamcore" } },
    pool:  { short: { zh: "池核",  en: "POOL"  }, chip: { zh: "池核",        en: "Poolcore" },      full: { zh: "池核 · Poolcore",         en: "Poolcore" } },
    weird: { short: { zh: "怪核",  en: "WEIRD" }, chip: { zh: "怪核",        en: "Weirdcore" },     full: { zh: "怪核 · Weirdcore",        en: "Weirdcore" } },
    mc:    { short: { zh: "MC",    en: "MC"    }, chip: { zh: "我的世界",   en: "Minecraft" },     full: { zh: "我的世界 · Minecraft",    en: "Minecraft" } },
    gtavc: { short: { zh: "VC",    en: "VC"    }, chip: { zh: "罪恶都市",   en: "GTA Vice City" }, full: { zh: "GTA 罪恶都市 · Vice City", en: "GTA Vice City" } },
    gtasa: { short: { zh: "SA",    en: "SA"    }, chip: { zh: "圣安地列斯", en: "GTA San Andreas" }, full: { zh: "GTA 圣安地列斯 · San Andreas", en: "GTA San Andreas" } },
    gta4:  { short: { zh: "GTA4",  en: "GTA4"  }, chip: { zh: "GTA IV",    en: "GTA IV" },        full: { zh: "GTA IV · 自由城",      en: "GTA IV · Liberty City" } },
    gta5:  { short: { zh: "GTA5",  en: "GTA5"  }, chip: { zh: "GTA V",     en: "GTA V" },         full: { zh: "GTA V · 洛圣都",       en: "GTA V · Los Santos" } },
    pipboy: { short: { zh: "PIP",  en: "PIP"  }, chip: { zh: "辐射 Pip-Boy", en: "Fallout Pip-Boy" }, full: { zh: "辐射 · Pip-Boy 3000",  en: "Fallout · Pip-Boy 3000" } }
  };
  /* 首页 hero 里有 #skinBar → 七档平铺；没有（404 / persona 子页）→ 顶栏下拉兜底 */
  var skinBar = document.getElementById("skinBar");
  function normStyle(s) { return STYLES.indexOf(s) !== -1 ? s : "glass"; }
  function currentStyle() { return normStyle(root.getAttribute("data-style")); }
  function setStyle(s, persist) {
    s = normStyle(s);
    root.setAttribute("data-style", s);
    if (persist) { try { localStorage.setItem(SKEY, s); } catch (e) {} }
    labelStyle();
  }
  function labelStyle() {
    var cur = currentStyle();
    /* 平铺版：只同步每颗按钮的按下态，名字由 apply() 按 data-zh/data-en 翻译 */
    if (skinBar) {
      STYLES.forEach(function (s) {
        var b = skinBar.querySelector('.skin-chip[data-style="' + s + '"]');
        if (b) b.setAttribute("aria-pressed", s === cur ? "true" : "false");
      });
      return;
    }
    if (!styleBtn) return;
    var zh = "当前风格：" + SMETA[cur].full.zh + "，点击选择其它风格";
    var en = "Skin: " + SMETA[cur].full.en + " — pick another one";
    var face = styleBtn.querySelector(".sm-cur");
    if (face) face.textContent = SMETA[cur].short[lang];
    var trigger = styleBtn.querySelector(".sm-btn");
    if (trigger) {
      trigger.setAttribute("aria-label", lang === "zh" ? zh : en);
      trigger.setAttribute("title", lang === "zh" ? zh : en);
    }
    STYLES.forEach(function (s) {
      var b = styleBtn.querySelector('.sm-item[data-style="' + s + '"]');
      if (b) b.setAttribute("aria-selected", s === cur ? "true" : "false");
    });
  }
  function closeMenu() {
    if (!styleBtn) return;
    styleBtn.classList.remove("is-open");
    var t = styleBtn.querySelector(".sm-btn");
    if (t) t.setAttribute("aria-expanded", "false");
  }

  /* 平铺版（优先）：把七颗按钮塞进 hero 里的 #skinBar */
  if (skinBar) {
    skinBar.insertAdjacentHTML("afterbegin",
      '<span class="skin-label" data-zh="风格" data-en="Skin">风格</span>');
    skinBar.insertAdjacentHTML("beforeend", STYLES.map(function (s) {
      return '<button type="button" class="skin-chip" data-style="' + s + '" aria-pressed="false">' +
               '<span data-zh="' + SMETA[s].chip.zh + '" data-en="' + SMETA[s].chip.en + '">' +
                 SMETA[s].chip.zh +
               '</span></button>';
    }).join(""));
    skinBar.addEventListener("click", function (e) {
      var chip = e.target.closest ? e.target.closest(".skin-chip") : null;
      if (chip) setStyle(chip.getAttribute("data-style"), true);
    });
  }

  /* 兜底：顶栏胶囊下拉菜单（404 / persona 子页没有 #skinBar 时用） */
  var styleBtn = skinBar ? null : document.getElementById("styleToggle");
  if (!skinBar && !styleBtn) {
    var host = document.getElementById("langToggle");
    if (host && host.parentNode) {
      styleBtn = document.createElement("div");
      styleBtn.id = "styleToggle";
      styleBtn.className = "style-menu";
      var items = STYLES.map(function (s) {
        return '<button type="button" class="sm-item" role="option" aria-selected="false" data-style="' + s + '">' +
                 '<span data-zh="' + SMETA[s].full.zh + '" data-en="' + SMETA[s].full.en + '">' + SMETA[s].full.zh + '</span>' +
               '</button>';
      }).join("");
      styleBtn.innerHTML =
        '<button type="button" class="sm-btn" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="sm-cur">玻璃</span><span class="sm-caret" aria-hidden="true">&#9662;</span>' +
        '</button>' +
        '<div class="sm-panel" role="listbox">' + items + '</div>';
      host.parentNode.insertBefore(styleBtn, themeBtn || host);
    }
  }
  if (styleBtn) {
    styleBtn.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".sm-item") : null;
      if (item) { setStyle(item.getAttribute("data-style"), true); closeMenu(); return; }
      if (e.target.closest && e.target.closest(".sm-btn")) {
        var open = !styleBtn.classList.contains("is-open");
        styleBtn.classList.toggle("is-open", open);
        var t = styleBtn.querySelector(".sm-btn");
        if (t) t.setAttribute("aria-expanded", open ? "true" : "false");
      }
    });
    document.addEventListener("click", function (e) {
      if (styleBtn && !styleBtn.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* 语言切换：把 #langToggle 改成与灯泡同风格的玻璃滑钮（注入一次） */
  var langBtn = document.getElementById("langToggle");
  if (langBtn) {
    langBtn.className = "lang-switch";
    langBtn.setAttribute("role", "switch");
    langBtn.innerHTML =
      '<span class="ls-track">' +
        '<span class="ls-opt ls-zh">中</span>' +
        '<span class="ls-opt ls-en">EN</span>' +
        '<span class="ls-knob"></span>' +
      '</span>';
  }
  /* 没手动选过的时候，跟着系统变化走（setTheme 顺带同步开关的 aria 状态） */
  if (!storedTheme()) setTheme(sysTheme(), false);
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function () { if (!storedTheme()) setTheme(sysTheme(), false); });
  }
  /* 风格：head 里的预置脚本通常已写好；没有就按 localStorage 兜底（默认液态玻璃） */
  if (!root.getAttribute("data-style")) {
    var ss = null; try { ss = localStorage.getItem(SKEY); } catch (e) {}
    root.setAttribute("data-style", normStyle(ss));
  }
  labelStyle();

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
      root.setAttribute("data-lang", lang);
      btn.setAttribute("aria-checked", lang === "en" ? "true" : "false");
      btn.setAttribute("aria-label", lang === "zh" ? "切换到英文 / Switch to English" : "切换到中文 / Switch to Chinese");
    }
    labelTheme();
    labelStyle();
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
