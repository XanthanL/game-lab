/* 辰光修表铺 · 站点脚本（无依赖）
   1) 照片位自动换图：FTP 上传 data-photo 指定文件名的图片即自动显示
   2) 新到名表渲染：读 js/new-arrivals.js 的 window.NEW_ARRIVALS
   3) 页脚年份 / 锚点跳转后焦点落位 */
(function () {
  "use strict";

  /* 1) 照片位：加载成功换入真图，失败保留占位框 */
  document.querySelectorAll(".ph[data-photo]").forEach(function (fig) {
    var src = fig.getAttribute("data-photo");
    var alt = fig.getAttribute("data-alt") || "";
    var probe = new Image();
    probe.onload = function () {
      var frame = fig.querySelector(".ph-frame");
      var empty = fig.querySelector(".ph-empty");
      var img = document.createElement("img");
      img.src = src;
      img.alt = alt;
      img.loading = "lazy";
      frame.insertBefore(img, frame.firstChild);
      if (empty) { empty.remove(); }
      fig.classList.add("ph-loaded");
    };
    probe.src = src;
  });

  /* 2) 新到名表 */
  var grid = document.getElementById("na-grid");
  var list = window.NEW_ARRIVALS || [];
  if (grid) {
    var noscript = grid.querySelector("noscript");
    if (noscript) { noscript.remove(); }
    if (!list.length) {
      var empty = document.createElement("p");
      empty.className = "na-empty";
      empty.innerHTML =
        "本期上新整理中——欢迎到店或来电询问。" +
        '<span lang="en">New arrivals are being photographed — please call or visit the shop.</span>';
      grid.appendChild(empty);
    } else {
      list.forEach(function (item) {
        var card = document.createElement("figure");
        card.className = "na-card";

        var frame = document.createElement("div");
        frame.className = "ph-frame";
        if (item.photo) {
          var img = document.createElement("img");
          img.src = item.photo;
          img.alt = (item.name || "新到名表") + (item.nameEn ? " " + item.nameEn : "");
          img.loading = "lazy";
          frame.appendChild(img);
        }
        card.appendChild(frame);

        var cap = document.createElement("figcaption");
        var name = document.createElement("span");
        name.className = "na-name";
        name.textContent = item.name || "";
        if (item.nameEn) {
          var nameEn = document.createElement("span");
          nameEn.className = "na-name-en";
          nameEn.setAttribute("lang", "en");
          nameEn.textContent = item.nameEn;
          name.appendChild(nameEn);
        }
        cap.appendChild(name);

        if (item.detail) {
          var detail = document.createElement("span");
          detail.className = "na-detail";
          detail.textContent = item.detail;
          cap.appendChild(detail);
        }
        if (item.price) {
          var price = document.createElement("span");
          price.className = "na-price";
          price.textContent = item.price;
          cap.appendChild(price);
        }
        card.appendChild(cap);
        grid.appendChild(card);
      });
    }
  }

  /* 3) 页脚年份 */
  var year = document.getElementById("year");
  if (year) { year.textContent = String(new Date().getFullYear()); }

  /* 锚点跳转后焦点落位（键盘可达） */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var target = document.querySelector(a.getAttribute("href"));
      if (target) { target.focus({ preventScroll: true }); }
    });
  });
})();
