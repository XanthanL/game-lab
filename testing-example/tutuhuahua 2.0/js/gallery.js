/* 涂涂画画 2.0 · 灯箱
   数据来自 js/works-data.js(由 tools/build.py 生成);
   作品展示由环廊(js/ring-carousel.js)承担,灯箱通过 window.LB.open(索引) 供其调用 */
(function () {
  "use strict";

  var data = window.WORKS && window.WORKS.works ? window.WORKS.works : [];

  function metaText(w) {
    var bits = [];
    if (w.media) bits.push(w.media);
    if (w.author) bits.push(w.author);
    if (w.age) bits.push(w.age + "岁");
    return bits.join(" · ");
  }

  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lb-img");
  var lbCounter = document.getElementById("lb-counter");
  var lbCaption = document.getElementById("lb-caption");
  var current = 0;
  var lastFocus = null;

  function show(i) {
    if (!data.length) return;
    current = (i + data.length) % data.length;
    var w = data[current];
    lbImg.classList.remove("is-in");
    lbImg.src = w.src;
    lbImg.alt = "儿童画《" + w.title + "》，" + w.media;
    lbCounter.textContent = "No." + w.no + " · " + (current + 1) + " / " + data.length;
    lbCaption.textContent = "";
    var t = document.createElement("span");
    t.className = "lb__title";
    t.textContent = "《" + w.title + "》";
    lbCaption.appendChild(t);
    var m = document.createElement("span");
    m.className = "mono";
    m.textContent = metaText(w) || "馆藏作品";
    lbCaption.appendChild(m);
    // 换一张时重新落定,让缩放入场重放
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { lbImg.classList.add("is-in"); });
    });
  }

  function openLb(i) {
    if (!data.length) return;
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    document.getElementById("lb-close").focus();
  }

  function closeLb() {
    lb.classList.remove("is-open");
    lbImg.classList.remove("is-in");
    lbImg.src = "";
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  document.getElementById("lb-close").addEventListener("click", closeLb);
  document.getElementById("lb-prev").addEventListener("click", function () { show(current - 1); });
  document.getElementById("lb-next").addEventListener("click", function () { show(current + 1); });
  lb.addEventListener("click", function (e) {
    if (e.target === lb) closeLb();
  });
  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLb();
    else if (e.key === "ArrowLeft") show(current - 1);
    else if (e.key === "ArrowRight") show(current + 1);
  });

  // 环廊点击正面卡时打开同一盏灯箱
  window.LB = { open: openLb };
})();
