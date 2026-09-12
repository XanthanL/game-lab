/* 涂涂画画 2.0 · 作品流渲染 + 灯箱
   数据来自 js/works-data.js(由 tools/build.py 生成)
   布局:split-narrative 交错栏 —— 奇数项图右注左,偶数项图左注右;
        每 4 件插入一次跨栏横线断点(签名④),辑号为展示节奏而非事实分组 */
(function () {
  "use strict";

  var data = window.WORKS && window.WORKS.works ? window.WORKS.works : [];
  var stream = document.getElementById("stream");
  var count = document.getElementById("work-count");
  var labelN = document.getElementById("works-label-n");
  var VOL_SIZE = 4;
  var VOL_NAMES = ["第一辑", "第二辑", "第三辑", "第四辑", "第五辑", "第六辑", "第七辑", "第八辑"];

  function metaText(w) {
    var bits = [];
    if (w.media) bits.push(w.media);
    if (w.author) bits.push(w.author);
    if (w.age) bits.push(w.age + "岁");
    return bits.join(" · ");
  }

  function render() {
    if (!stream) return;
    if (!data.length) {
      stream.innerHTML = '<li class="mono">作品整理中，即将上架。</li>';
      return;
    }
    stream.innerHTML = "";
    data.forEach(function (w, i) {
      if (i > 0 && i % VOL_SIZE === 0) {
        var brk = document.createElement("li");
        brk.className = "stream-break mono";
        brk.setAttribute("aria-hidden", "true");
        brk.textContent = VOL_NAMES[Math.floor(i / VOL_SIZE) - 1] + " · Vol." + (Math.floor(i / VOL_SIZE));
        stream.appendChild(brk);
      }

      var li = document.createElement("li");
      li.className = "work" + (i % 2 === 1 ? " work--flip" : "");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "查看大图:" + w.title);
      btn.addEventListener("click", function () { openLb(i); });

      var fig = document.createElement("figure");
      var img = document.createElement("img");
      img.src = w.thumb;
      img.alt = "儿童画《" + w.title + "》，" + w.media;
      img.width = w.w;
      img.height = w.h;
      img.loading = "lazy";
      img.decoding = "async";
      fig.appendChild(img);
      btn.appendChild(fig);

      var side = document.createElement("div");
      side.className = "work__cap";
      var no = document.createElement("span");
      no.className = "work__no";
      no.textContent = "No." + w.no;
      var title = document.createElement("span");
      title.className = "work__title";
      title.textContent = "《" + w.title + "》";
      var meta = document.createElement("span");
      meta.textContent = metaText(w);
      side.appendChild(no);
      side.appendChild(title);
      side.appendChild(meta);

      li.appendChild(btn);
      li.appendChild(side);
      stream.appendChild(li);
    });
    if (count) count.textContent = String(data.length);
    if (labelN) labelN.textContent = String(data.length);
  }

  /* ── 灯箱 ── */
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
    lbImg.src = w.src;
    lbImg.alt = "儿童画《" + w.title + "》，" + w.media;
    lbCounter.textContent = (current + 1) + " / " + data.length;
    lbCaption.textContent = "";
    var t = document.createElement("span");
    t.textContent = "《" + w.title + "》";
    lbCaption.appendChild(t);
    var m = document.createElement("span");
    m.className = "mono";
    m.textContent = "No." + w.no + (metaText(w) ? " · " + metaText(w) : "");
    lbCaption.appendChild(m);
  }

  function openLb(i) {
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    document.getElementById("cta-bar").classList.add("is-hidden");
    document.getElementById("lb-close").focus();
  }

  function closeLb() {
    lb.classList.remove("is-open");
    lbImg.src = "";
    document.body.style.overflow = "";
    updateBar();
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

  /* ── 底部 CTA:试听区进入视口即隐藏(滚动判定,不依赖 IO)── */
  var bar = document.getElementById("cta-bar");
  var trial = document.getElementById("trial");
  function updateBar() {
    if (!bar || !trial) return;
    var r = trial.getBoundingClientRect();
    var inView = r.top < window.innerHeight * 0.92 && r.bottom > 0;
    bar.classList.toggle("is-hidden", inView && !lb.classList.contains("is-open"));
  }
  window.addEventListener("scroll", updateBar, { passive: true });
  window.addEventListener("resize", updateBar);
  updateBar();

  render();
})();
