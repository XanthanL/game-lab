/* 站群承接：给子页面一个能回到上级的入口。
   不定义任何品牌视觉 —— 字体、字色全部继承当前页面 body，只用一层中性
   半透明底保证在深浅底上都读得清。各站因此保留自己的视觉语言。
   页面通过 data-back / data-label / data-pos 指定目标、文案与角落。 */
(function () {
  "use strict";
  var s = document.currentScript;
  if (!s || !document.body) return;
  var url = s.getAttribute("data-back") || "../";
  var label = s.getAttribute("data-label") || "GAME LAB";
  var side = s.getAttribute("data-pos") || "bottom-left";
  var pos = side === "top-left" ? "top:8px;left:8px"
          : side === "top-right" ? "top:8px;right:8px"
          : side === "bottom-right" ? "bottom:8px;right:8px"
          : "bottom:8px;left:8px";
  var a = document.createElement("a");
  a.href = url;
  a.textContent = "← " + label;
  a.setAttribute("aria-label", "返回 " + label);
  a.style.cssText = "position:fixed;" + pos + ";z-index:2147483000;"
    + "font:inherit;font-size:12px;line-height:1.2;letter-spacing:.03em;"
    + "color:inherit;opacity:.62;text-decoration:none;padding:5px 9px;"
    + "border:1px solid currentColor;border-radius:2px;"
    + "background:rgba(127,127,127,.18);transition:opacity .18s ease;white-space:nowrap";
  a.addEventListener("mouseenter", function () { a.style.opacity = "1"; });
  a.addEventListener("mouseleave", function () { a.style.opacity = ".62"; });
  a.addEventListener("focus", function () { a.style.opacity = "1"; });
  a.addEventListener("blur", function () { a.style.opacity = ".62"; });
  document.body.appendChild(a);
})();
