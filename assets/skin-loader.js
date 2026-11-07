/* 皮肤样式按需加载 —— 在 head 内、首屏绘制之前执行。
   版式核心与每套皮肤的 CSS 由 assets/split_skins.py 从 index.css 生成。
   静态那张 link 先给默认 hermes（同步加载，不会闪一下），只有 localStorage
   里选过别的皮肤时才在这里把 href 换掉；换肤时的动态切换由 i18n.js 管。 */
(function () {
  "use strict";
  var s = document.documentElement.getAttribute("data-style");
  if (!s || s === "hermes") return;
  var skin = document.getElementById("skinCss");
  if (!skin) return;
  var base = (skin.getAttribute("href") || "").replace(/skins\/[^/]*\.css.*$/, "skins/");
  skin.setAttribute("href", base + s + ".css");
})();
