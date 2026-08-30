/* ============================================================
   main.js — 应用控制器
   主功能: 文字工坊 (textart) —— 面板控件实时驱动文字→ASCII
   次功能: 创意特效实验室 (可折叠抽屉) —— 3D/特效/图像等场景
   ============================================================ */

(function () {
  "use strict";
  const { Engine } = window.ASCII;
  const $ = (id) => document.getElementById(id);
  const screen = $("screen");
  const eng = new Engine(screen);
  eng.ramp = " .:-=+*#%@";

  // 注册全部场景（textart 已 unshift 到首位）
  for (const s of window.ASCII_SCENES) eng.register(s);
  const studio = window.ASCII_TEXT_STUDIO;

  /* ============================================================
     文字工坊（主功能）
     ============================================================ */
  const textEl = $("text");
  const charCount = $("charCount");
  const MAX = parseInt(textEl.getAttribute("maxlength"), 10) || 120;

  // 用工坊默认文本初始化输入框
  textEl.value = studio._params.text;

  function pushText() {
    studio.setParams({ text: textEl.value });
    charCount.textContent = [...textEl.value].length + " / " + MAX;
  }
  textEl.addEventListener("input", pushText);

  // 字体
  $("font").addEventListener("change", (e) => {
    studio.setParams({ font: e.target.value });
  });

  // 粗体 / 斜体
  const tgBold = $("tgBold"), tgItalic = $("tgItalic");
  tgBold.addEventListener("click", () => {
    tgBold.classList.toggle("active");
    studio.setParams({ bold: tgBold.classList.contains("active") });
  });
  tgItalic.addEventListener("click", () => {
    tgItalic.classList.toggle("active");
    studio.setParams({ italic: tgItalic.classList.contains("active") });
  });

  // 文字样式
  bindChipRow("styleRow", "style", (v) => studio.setParams({ style: v }));
  // 对齐
  bindChipRow("alignRow", "align", (v) => studio.setParams({ align: v }));

  function bindChipRow(rowId, dataKey, cb) {
    const row = $(rowId);
    row.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      for (const c of row.querySelectorAll(".chip")) c.classList.remove("active");
      chip.classList.add("active");
      cb(chip.dataset[dataKey]);
    });
  }

  /* ---------- 字符集（笔触） ---------- */
  $("ramp").addEventListener("change", (e) => { eng.ramp = e.target.value; });

  /* ---------- 主题 ---------- */
  const themeRow = $("themeRow");
  themeRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const theme = chip.dataset.theme;
    document.body.dataset.theme = theme;
    eng.rainbow = theme === "rainbow";
    screen.classList.toggle("rainbow", eng.rainbow);
    for (const c of themeRow.querySelectorAll(".chip")) c.classList.remove("active");
    chip.classList.add("active");
  });

  /* ---------- 导出工具 ---------- */
  $("btnCopy").addEventListener("click", () => {
    navigator.clipboard.writeText(eng.getFrameText()).then(
      () => toast("已复制到剪贴板 ✓"),
      () => toast("复制失败：浏览器限制")
    );
  });
  $("btnSave").addEventListener("click", () => {
    const blob = new Blob([eng.getFrameText()], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ascii-" + (eng.current ? eng.current.id : "art") + "-" + Date.now() + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已保存 .txt 文件 ✓");
  });
  $("btnFull").addEventListener("click", () => {
    if (!document.fullscreenElement) screen.requestFullscreen && screen.requestFullscreen();
    else document.exitFullscreen && document.exitFullscreen();
  });

  /* ---------- 导出为图片（微信友好：非等宽字体不会错位） ---------- */
  // 将当前帧缓冲逐格绘制到 canvas，保持等宽栅格对齐
  function renderFrameToCanvas() {
    const fb = eng.fb;
    const { cols, rows, chars, lum } = fb;
    const cs = getComputedStyle(screen);
    const fg = cs.color;
    const bg = cs.backgroundColor || "#030604";
    const family = getComputedStyle(document.body).fontFamily || "monospace";
    const FS = 18;              // 字号
    const charW = FS * 0.6;     // 等宽步进（与屏幕栅格一致）
    const lineH = FS;           // 行高 (line-height:1.0)
    const pad = 24;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.ceil(cols * charW + pad * 2);
    const h = Math.ceil(rows * lineH + pad * 2);
    const cv = document.createElement("canvas");
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.font = "600 " + FS + "px " + family;
    ctx.textBaseline = "top";
    const rainbow = eng.rainbow;
    if (!rainbow) ctx.fillStyle = fg;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const ch = chars[i];
        if (!ch || ch === " ") continue;
        if (rainbow) {
          const hue = Math.round((x * 3 + y * 6 + eng.frame * 2 + lum[i] * 120) % 360 / 12) * 12;
          ctx.fillStyle = "hsl(" + hue + ",100%,65%)";
        }
        ctx.fillText(ch, pad + x * charW, pad + y * lineH);
      }
    }
    return cv;
  }

  function downloadCanvas(blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ascii-" + Date.now() + ".png";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportImage(download) {
    const cv = renderFrameToCanvas();
    cv.toBlob((blob) => {
      if (!blob) { toast("导出失败"); return; }
      if (download) { downloadCanvas(blob); toast("已保存 PNG ✓"); return; }
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(
          () => toast("图片已复制，可直接粘贴到微信 ✓"),
          () => { downloadCanvas(blob); toast("不支持复制图片，已下载 PNG"); }
        );
      } else {
        downloadCanvas(blob);
        toast("不支持复制图片，已下载 PNG");
      }
    }, "image/png");
  }
  $("btnCopyImg").addEventListener("click", () => exportImage(false));
  $("btnSaveImg").addEventListener("click", () => exportImage(true));

  /* ============================================================
     创意特效实验室（次功能）
     ============================================================ */
  const fxTabs = $("fxTabs");
  const imageCtl = $("imageCtl");
  const tabs = {};
  // 除主功能 textart / 已被工坊取代的 banner 外, 其余场景进入抽屉
  const HIDDEN = new Set(["textart", "banner"]);
  for (const id of eng.order) {
    if (HIDDEN.has(id)) continue;
    const s = eng.scenes[id];
    const btn = document.createElement("button");
    btn.className = "fx-tab";
    btn.innerHTML = '<span style="opacity:.6">' + (s.badge || "•") + "</span> " + s.name;
    btn.addEventListener("click", () => selectFx(id));
    fxTabs.appendChild(btn);
    tabs[id] = btn;
  }

  function selectFx(id) {
    eng.select(id);
    for (const k in tabs) tabs[k].classList.toggle("active", k === id);
    $("hudScene").textContent = eng.scenes[id].name;
    imageCtl.hidden = id !== "image";
  }

  function backToText() {
    eng.select("textart");
    for (const k in tabs) tabs[k].classList.remove("active");
    imageCtl.hidden = true;
    $("hudScene").textContent = studio.name;
  }
  $("btnBackText").addEventListener("click", backToText);

  // 展开抽屉即切换到上次/首个特效; 收起则回到文字工坊
  const drawer = $("fxDrawer");
  drawer.addEventListener("toggle", () => {
    if (drawer.open) {
      if (eng.current && eng.current.id === "textart") {
        selectFx(Object.keys(tabs)[0]);
      }
    } else {
      backToText();
    }
  });

  // 播放控制
  const btnPlay = $("btnPlay");
  btnPlay.addEventListener("click", () => {
    btnPlay.textContent = eng.toggle() ? "⏸ 暂停" : "▶ 播放";
  });
  $("btnStep").addEventListener("click", () => eng.step());
  $("btnShuffle").addEventListener("click", shuffle);
  function shuffle() {
    const ids = Object.keys(tabs).filter((id) => id !== (eng.current && eng.current.id));
    selectFx(ids[(Math.random() * ids.length) | 0]);
  }

  // 速度 / 密度
  const speed = $("speed"), speedVal = $("speedVal");
  speed.addEventListener("input", () => {
    eng.speed = parseFloat(speed.value);
    speedVal.textContent = eng.speed.toFixed(1) + "×";
  });
  const scale = $("scale"), scaleVal = $("scaleVal");
  scale.addEventListener("input", () => {
    scaleVal.textContent = scale.value + "%";
    eng.setScale(parseFloat(scale.value));
  });

  /* ---------- 图像转 ASCII ---------- */
  const imgInput = $("imgInput");
  imgInput.addEventListener("change", () => handleImageFile(imgInput.files[0]));
  function handleImageFile(file) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      window.ASCII_IMAGE_SCENE.convert(img, eng.fb, eng.ramp, false);
      toast("图像已转换 ✓");
    };
    img.onerror = () => toast("图片加载失败");
    img.src = URL.createObjectURL(file);
  }
  screen.addEventListener("dragover", (e) => e.preventDefault());
  screen.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) {
      if (!drawer.open) drawer.open = true;
      selectFx("image");
      handleImageFile(f);
    }
  });

  /* ---------- HUD ---------- */
  eng.onStats = (s) => {
    $("hudFps").textContent = s.fps;
    $("hudRes").textContent = s.cols + "×" + s.rows;
    $("hudFrame").textContent = s.frame;
  };

  /* ---------- 顶部时钟 ---------- */
  setInterval(() => {
    const d = new Date();
    $("clock").textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, "0")).join(":");
  }, 1000);

  /* ---------- toast ---------- */
  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.cssText =
        "position:fixed;left:50%;bottom:70px;transform:translateX(-50%);" +
        "background:var(--panel);border:1px solid var(--accent);color:var(--accent);" +
        "padding:10px 18px;border-radius:8px;font-family:var(--font-mono);font-size:12px;" +
        "z-index:10000;box-shadow:0 0 20px var(--glow);transition:opacity .3s;pointer-events:none;";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.style.opacity = "0"; }, 1800);
  }

  /* ---------- 尺寸变化 ---------- */
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      eng._measure();
      if (eng.current && eng.current.init) eng.current.init(eng.fb, eng);
    }, 200);
  });

  /* ---------- 启动 ---------- */
  document.body.dataset.theme = "green";
  themeRow.querySelector('[data-theme="green"]').classList.add("active");
  pushText();
  eng.select("textart");
  $("hudScene").textContent = studio.name;
  eng.start();
})();
