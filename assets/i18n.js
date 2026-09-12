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

  /* ---------- 风格：48 套皮肤，按来源分成 8 组 ---------- */
  var SKEY = "gl-style";
  var GKEY = "gl-style-group";   /* 记住上次翻的是哪一组 */

  /* GROUPS 是唯一事实源。STYLES 由它派生，保证「组里的键」和「总清单」永不脱节。
     组序 = 页 tab 顺序；组内顺序 = 芯片显示顺序。 */
  var GROUPS = [
    { id: "texture", zh: "质感", en: "Texture",
      styles: ["glass", "soft", "clay", "crete", "raw"] },
    { id: "os", zh: "系统", en: "OS",
      styles: ["xp", "w7", "w10", "classic", "mac7", "dos"] },
    { id: "retro", zh: "复古数字", en: "Retro",
      styles: ["fc", "gb", "crt", "winamp", "pokemon"] },
    { id: "net", zh: "网络美学", en: "Net",
      styles: ["dream", "pool", "weird", "vaporwave", "synthwave", "glitch"] },
    { id: "art", zh: "艺术运动", en: "Art",
      styles: ["construct", "bauhaus", "deco", "memphis", "pop", "swiss", "morandi", "washi",
               "decon", "ink", "shanshui", "futurism", "diagonal"] },
    { id: "game", zh: "游戏界面", en: "Games",
      styles: ["mc", "gtavc", "gtasa", "gta4", "gta5", "pipboy", "cyberpunk",
               "rdr2", "p5", "aperture", "halo", "splatoon", "skate"] },
    { id: "draft", zh: "图纸", en: "Draft",
      styles: ["blueprint"] },
    { id: "tech", zh: "科技品牌", en: "Tech",
      styles: ["hermes", "klein"] }
  ];
  var STYLES = GROUPS.reduce(function (acc, g) { return acc.concat(g.styles); }, []);
  /* 反查：皮肤键 → 组 id（选皮肤时用来自动跳到它所在的组） */
  var GROUP_OF = {};
  GROUPS.forEach(function (g) { g.styles.forEach(function (s) { GROUP_OF[s] = g.id; }); });
  function groupById(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return GROUPS[0];
  }
  function normGroup(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return id;
    return GROUPS[0].id;
  }
  /* chip  平铺按钮上的名字（写全）  short 顶栏下拉里的简称  full 无障碍标签用的全名 */
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
    pipboy: { short: { zh: "PIP",  en: "PIP"  }, chip: { zh: "辐射 Pip-Boy", en: "Fallout Pip-Boy" }, full: { zh: "辐射 · Pip-Boy 3000",  en: "Fallout · Pip-Boy 3000" } },
    construct: { short: { zh: "构成", en: "CNST" }, chip: { zh: "苏联构成主义", en: "Constructivism" }, full: { zh: "苏联构成主义 · Constructivism", en: "Soviet Constructivism" } },
    blueprint: { short: { zh: "蓝图", en: "BLUE" }, chip: { zh: "工程蓝图", en: "Blueprint" }, full: { zh: "工程蓝图 · Blueprint", en: "Blueprint" } },
    fc: { short: { zh: "FC", en: "FC" }, chip: { zh: "红白机", en: "Famicom" }, full: { zh: "红白机 · Famicom", en: "Famicom / NES" } },
    synthwave: { short: { zh: "浪潮", en: "WAVE" }, chip: { zh: "合成器浪潮", en: "Synthwave" }, full: { zh: "合成器浪潮 · Synthwave", en: "Synthwave / Outrun" } },
    glitch: { short: { zh: "故障", en: "GLCH" }, chip: { zh: "故障艺术", en: "Glitch Art" }, full: { zh: "故障艺术 · Glitch", en: "Glitch Art" } },
    clay: { short: { zh: "粘土", en: "CLAY" }, chip: { zh: "粘土拟态", en: "Claymorphism" }, full: { zh: "粘土拟态 · Claymorphism", en: "Claymorphism" } },
    cyberpunk: { short: { zh: "2077", en: "2077" }, chip: { zh: "赛博朋克 2077", en: "Cyberpunk 2077" }, full: { zh: "赛博朋克 2077 · Cyberpunk", en: "Cyberpunk 2077" } },
    rdr2: { short: { zh: "RDR2", en: "RDR2" }, chip: { zh: "荒野大镖客 2", en: "Red Dead 2" }, full: { zh: "荒野大镖客 2 · Red Dead Redemption", en: "Red Dead Redemption 2" } },
    p5: { short: { zh: "P5", en: "P5" }, chip: { zh: "女神异闻录 5", en: "Persona 5" }, full: { zh: "女神异闻录 5 · Persona 5", en: "Persona 5" } },
    aperture: { short: { zh: "光圈", en: "APRT" }, chip: { zh: "传送门 Aperture", en: "Portal Aperture" }, full: { zh: "传送门 · Aperture Science", en: "Portal · Aperture Science" } },
    halo: { short: { zh: "光环", en: "HALO" }, chip: { zh: "光环 HUD", en: "Halo HUD" }, full: { zh: "光环 · UNSC HUD", en: "Halo · UNSC HUD" } },
    splatoon: { short: { zh: "喷射", en: "SPLT" }, chip: { zh: "喷射战士", en: "Splatoon" }, full: { zh: "喷射战士 · Splatoon", en: "Splatoon" } },
    pokemon: { short: { zh: "宝可梦", en: "PKMN" }, chip: { zh: "宝可梦红白", en: "Pokémon GB" }, full: { zh: "宝可梦红白 · Game Boy", en: "Pokémon · Game Boy" } },
    crt: { short: { zh: "终端", en: "CRT" }, chip: { zh: "CRT 绿终端", en: "CRT Terminal" }, full: { zh: "CRT 绿终端 · Phosphor", en: "CRT Green Terminal" } },
    gb: { short: { zh: "GB", en: "GB" }, chip: { zh: "Game Boy DMG", en: "Game Boy DMG" }, full: { zh: "Game Boy DMG · 元祖灰", en: "Game Boy DMG" } },
    winamp: { short: { zh: "WA", en: "WA" }, chip: { zh: "Winamp · Y2K", en: "Winamp Y2K" }, full: { zh: "Winamp · Y2K 铬金属", en: "Winamp · Y2K" } },
    dos: { short: { zh: "DOS", en: "DOS" }, chip: { zh: "MS-DOS 蓝", en: "MS-DOS" }, full: { zh: "MS-DOS · 文本模式蓝", en: "MS-DOS · Blue Mode" } },
    mac7: { short: { zh: "Mac7", en: "MAC7" }, chip: { zh: "老 Mac System 7", en: "Mac System 7" }, full: { zh: "老 Mac · System 7", en: "Mac System 7" } },
    bauhaus: { short: { zh: "包豪斯", en: "BAU" }, chip: { zh: "包豪斯", en: "Bauhaus" }, full: { zh: "包豪斯 · Bauhaus", en: "Bauhaus" } },
    deco: { short: { zh: "装饰", en: "DECO" }, chip: { zh: "装饰艺术", en: "Art Deco" }, full: { zh: "装饰艺术 · Art Deco", en: "Art Deco" } },
    memphis: { short: { zh: "孟菲斯", en: "MEM" }, chip: { zh: "孟菲斯", en: "Memphis" }, full: { zh: "孟菲斯 · Memphis", en: "Memphis" } },
    pop: { short: { zh: "波普", en: "POP" }, chip: { zh: "波普艺术", en: "Pop Art" }, full: { zh: "波普艺术 · Pop Art", en: "Pop Art" } },
    swiss: { short: { zh: "瑞士", en: "CH" }, chip: { zh: "瑞士国际主义", en: "Swiss" }, full: { zh: "瑞士国际主义 · Swiss", en: "Swiss International" } },
    vaporwave: { short: { zh: "蒸汽", en: "VAPR" }, chip: { zh: "蒸汽波", en: "Vaporwave" }, full: { zh: "蒸汽波 · Vaporwave", en: "Vaporwave" } },
    morandi: { short: { zh: "莫兰迪", en: "MOR" }, chip: { zh: "莫兰迪灰", en: "Morandi" }, full: { zh: "莫兰迪高级灰 · Morandi", en: "Morandi Muted" } },
    skate: { short: { zh: "滑板", en: "SK8" }, chip: { zh: "Skate Story", en: "Skate Story" }, full: { zh: "Skate Story · 玻璃恶魔滑板", en: "Skate Story · Glass Demon" } },
    washi: { short: { zh: "和纸", en: "WASHI" }, chip: { zh: "和纸和风", en: "Washi" }, full: { zh: "和纸和风 · Washi", en: "Washi" } },
    decon: { short: { zh: "解构", en: "DECON" }, chip: { zh: "解构主义", en: "Deconstructivism" }, full: { zh: "解构主义 · Deconstructivism", en: "Deconstructivism" } },
    ink: { short: { zh: "水墨", en: "INK" }, chip: { zh: "水墨", en: "Ink Wash" }, full: { zh: "水墨 · Ink Wash", en: "Chinese Ink Wash" } },
    futurism: { short: { zh: "未来", en: "FUTR" }, chip: { zh: "未来主义", en: "Futurism" }, full: { zh: "未来主义 · Futurism", en: "Italian Futurism" } },
    hermes: { short: { zh: "电光蓝", en: "ELEC" }, chip: { zh: "电光蓝", en: "Electric Blue" }, full: { zh: "电光蓝", en: "Electric Blue" } },
    klein: { short: { zh: "克莱因蓝", en: "KLEIN" }, chip: { zh: "克莱因蓝", en: "Klein Blue" }, full: { zh: "克莱因蓝", en: "Klein Blue" } },
    diagonal: { short: { zh: "对角", en: "DIAG" }, chip: { zh: "对角线计划", en: "Diagonal" }, full: { zh: "对角线计划 · Diagonal", en: "Diagonal Archive" } },
    shanshui: { short: { zh: "山水", en: "INK" }, chip: { zh: "水墨山水", en: "Ink Landscape" }, full: { zh: "水墨山水 · 黑白", en: "Ink Landscape · Monochrome" } }
  };
  /* 首页 hero 里有 #skinBar → 七档平铺；没有（404 / persona 子页）→ 顶栏下拉兜底 */
  var skinBar = document.getElementById("skinBar");
  function normStyle(s) { return STYLES.indexOf(s) !== -1 ? s : "hermes"; }
  function currentStyle() { return normStyle(root.getAttribute("data-style")); }
  /* 真正落地的那一步：写属性 + 存盘 + 跨组跳转 + 同步按钮态 */
  function commitStyle(s, persist) {
    root.setAttribute("data-style", s);
    if (persist) { try { localStorage.setItem(SKEY, s); } catch (e) {} }
    /* 选到别的组的皮肤时，页码自动跟着跳过去，否则选中态看不见 */
    if (skinBar && typeof jumpGroup === "function" && GROUP_OF[s] !== curGroup) jumpGroup(GROUP_OF[s], true);
    labelStyle();
  }
  /* 换肤过渡：淡出 → 换 → 淡入。SWITCH_MS 与 CSS 的 body opacity 过渡对齐（180ms）。
     只在用户主动切换时播放；首次进入、reduced-motion、重选同一套都不播。 */
  var SWITCH_MS = 180;
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function applyStyle(s, persist) {
    s = normStyle(s);
    var prev = currentStyle();
    if (!persist || s === prev || (reduceMQ && reduceMQ.matches)) { commitStyle(s, persist); return; }
    root.classList.add("style-fading");
    window.setTimeout(function () {
      commitStyle(s, persist);
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { root.classList.remove("style-fading"); });
      });
    }, SWITCH_MS);
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

  /* 由 skinBar 分支在运行时填上，供 applyStyle 跨组跳转用（严格模式下块级函数不外泄） */
  var jumpGroup = null;

  /* 当前翻到哪一组：优先读 localStorage，否则落在当前皮肤所在的组 */
  var curGroup = (function () {
    var saved = null;
    try { saved = localStorage.getItem(GKEY); } catch (e) {}
    if (saved && groupById(saved).id === saved && groupById(saved).styles.indexOf(root.getAttribute("data-style")) !== -1) return saved;
    return GROUP_OF[currentStyle()] || GROUPS[0].id;
  })();

  /* 平铺版（优先）：hero 里的 #skinBar → 组 tab 行 + 当前组芯片区。
     44 套一次铺开会占掉大半屏，所以按 7 组收纳，一次只摊开 5~13 个。 */
  if (skinBar) {
    skinBar.insertAdjacentHTML("afterbegin",
      '<div class="skin-head">' +
        '<span class="skin-label" data-zh="风格" data-en="Skin">风格</span>' +
        '<div class="skin-tabs" role="tablist" aria-label="风格分组">' +
          GROUPS.map(function (g) {
            return '<button type="button" class="skin-tab" role="tab" data-group="' + g.id + '"' +
                   ' aria-selected="false">' +
                   '<span data-zh="' + g.zh + '" data-en="' + g.en + '">' + g.zh + '</span></button>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div class="skin-chips" id="skinChips"></div>');

    var chipHost = skinBar.querySelector("#skinChips");
    function renderChips() {
      var g = groupById(curGroup);
      /* 直接写当前语言，同时挂 data-zh/data-en —— 切换语种时由 apply() 统一改写 */
      chipHost.innerHTML = g.styles.map(function (s) {
        var txt = lang === "zh" ? SMETA[s].chip.zh : SMETA[s].chip.en;
        return '<button type="button" class="skin-chip" data-style="' + s + '" aria-pressed="false">' +
                 '<span data-zh="' + SMETA[s].chip.zh + '" data-en="' + SMETA[s].chip.en + '">' +
                   txt +
                 '</span></button>';
      }).join("");
      labelStyle();
      skinBar.querySelectorAll(".skin-tab").forEach(function (t) {
        t.setAttribute("aria-selected", t.getAttribute("data-group") === curGroup ? "true" : "false");
      });
    }
    jumpGroup = function (id, persist) {
      curGroup = normGroup(id);
      if (persist) { try { localStorage.setItem(GKEY, curGroup); } catch (e) {} }
      renderChips();
    };
    renderChips();

    skinBar.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var tab = e.target.closest(".skin-tab");
      if (tab) { jumpGroup(tab.getAttribute("data-group"), true); return; }
      var chip = e.target.closest(".skin-chip");
      if (chip) applyStyle(chip.getAttribute("data-style"), true);
    });
  }

  /* 首页 hero 里的「随机切换风格」按钮：从全部皮肤里随机抽一套（排除当前这套），
     走和手动点芯片完全相同的 applyStyle 流程（含过渡动画 + 写盘 + 同步按钮态）。 */
  var rndBtn = document.getElementById("skinRandom");
  if (rndBtn) {
    rndBtn.addEventListener("click", function () {
      var cur = currentStyle();
      var pool = STYLES.filter(function (s) { return s !== cur; });
      var next = pool[Math.floor(Math.random() * pool.length)];
      applyStyle(next, true);
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
      /* 下拉也按 7 组分段，每组一个小标题，44 项不再糊成一片 */
      var items = GROUPS.map(function (g) {
        return '<div class="sm-group" role="presentation">' +
                 '<span class="sm-group-t" data-zh="' + g.zh + '" data-en="' + g.en + '">' +
                   (lang === "zh" ? g.zh : g.en) +
                 '</span>' +
                 g.styles.map(function (s) {
                   return '<button type="button" class="sm-item" role="option" aria-selected="false" data-style="' + s + '">' +
                            '<span data-zh="' + SMETA[s].full.zh + '" data-en="' + SMETA[s].full.en + '">' +
                              (lang === "zh" ? SMETA[s].full.zh : SMETA[s].full.en) +
                            '</span></button>';
                 }).join("") +
               '</div>';
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
      if (item) { applyStyle(item.getAttribute("data-style"), true); closeMenu(); return; }
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
