/* ============================================================
   textart.js — 文字工坊（本站主功能）
   将任意文字（含中文）渲染为 ASCII 字符画：
   · 通过离屏 canvas 用系统字体绘制文字 → 逐格采样亮度 → 映射字符
   · 支持: 多种字体、粗体/斜体、多种文字样式、对齐、长文本、多行
   缓存机制: 仅在参数或画布尺寸变化时重算, 渲染时直接铺帧。
   ============================================================ */

(function (global) {
  "use strict";
  const { M } = global.ASCII;
  const scenes = global.ASCII_SCENES;

  // 可选字体（含中文字库回退）
  const FONTS = {
    hei:     '"Microsoft YaHei","PingFang SC","Heiti SC","SimHei",sans-serif',
    song:    '"SimSun","Songti SC","STSong",serif',
    kai:     '"KaiTi","STKaiti","Kaiti SC","楷体",serif',
    yuan:    '"YouYuan","圆体-简","Yuanti SC","Microsoft YaHei",sans-serif',
    sans:    '"Segoe UI","Helvetica Neue","Microsoft YaHei",Arial,sans-serif',
    serif:   '"Georgia","Times New Roman","Songti SC",serif',
    mono:    '"Consolas","Courier New","Microsoft YaHei",monospace',
    impact:  '"Impact","Haettenschweiler","Arial Black","Microsoft YaHei",sans-serif',
  };

  const textStudio = {
    id: "textart",
    name: "文字工坊",
    badge: "★",
    primary: true,
    _params: {
      text: "你好\nASCII",
      font: FONTS.hei,
      bold: true,
      italic: false,
      style: "solid",   // solid | outline | gradient | shadow | double
      align: "center",
      lineGap: 1.28,
    },
    _cache: null,
    _cw: 0, _ch: 0,
    _dirty: true,

    setParams(p) {
      Object.assign(this._params, p);
      if (p.font && FONTS[p.font]) this._params.font = FONTS[p.font];
      this._dirty = true;
    },

    init(fb) { this._dirty = true; },

    render(fb, t, frame, eng) {
      if (this._dirty || this._cw !== fb.cols || this._ch !== fb.rows ||
          this._ramp !== (eng.ramp || " .:-=+*#%@")) {
        this._ramp = eng.ramp || " .:-=+*#%@";
        this._rebuild(fb, eng);
      }
      const cache = this._cache;
      if (!cache) return;
      // 铺帧（垂直居中已在缓存中完成，直接落位）
      for (let i = 0; i < cache.chars.length; i++) {
        const ch = cache.chars[i];
        if (ch !== " ") {
          fb.chars[i] = ch;
          fb.lum[i] = cache.lum[i];
        }
      }
    },

    _rebuild(fb, eng) {
      this._dirty = false;
      this._cw = fb.cols; this._ch = fb.rows;
      const cols = fb.cols, rows = fb.rows;
      const ramp = this._ramp;
      const p = this._params;
      const outChars = new Array(cols * rows).fill(" ");
      const outLum = new Float32Array(cols * rows);

      const lines = (p.text || "").length ? p.text.split("\n") : [""];
      const allEmpty = lines.every((l) => l.trim() === "");
      if (allEmpty) {
        this._cache = this._placeholder(cols, rows);
        return;
      }

      // 1) 离屏 canvas 用系统字体高分辨率绘制
      const scratch = this._scratch || (this._scratch = document.createElement("canvas"));
      const sctx = scratch.getContext("2d", { willReadFrequently: true });
      const fontPx = 120;
      const fontStr =
        (p.italic ? "italic " : "") +
        (p.bold ? "bold " : "normal ") +
        fontPx + "px " + p.font;
      sctx.font = fontStr;

      const lineH = fontPx * p.lineGap;
      let maxW = 1;
      for (const ln of lines) maxW = Math.max(maxW, sctx.measureText(ln || " ").width);
      const pad = fontPx * 0.35;
      scratch.width = Math.ceil(maxW + pad * 2);
      scratch.height = Math.ceil(lineH * lines.length + pad * 2);

      // resize 后需重设上下文
      sctx.font = fontStr;
      sctx.textBaseline = "top";
      sctx.textAlign = p.align;
      sctx.clearRect(0, 0, scratch.width, scratch.height);

      const anchorX =
        p.align === "left" ? pad :
        p.align === "right" ? scratch.width - pad : scratch.width / 2;

      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li] || " ";
        const y = pad + li * lineH;
        drawStyled(sctx, ln, anchorX, y, fontPx, p.style);
      }

      // 2) 缩放到目标网格（垂直压缩 2×, 抵消字符单元高宽比）
      const target = this._target || (this._target = document.createElement("canvas"));
      target.width = cols; target.height = rows;
      const tctx = target.getContext("2d", { willReadFrequently: true });
      tctx.fillStyle = "#000";
      tctx.fillRect(0, 0, cols, rows);
      tctx.imageSmoothingEnabled = true;

      const sw = scratch.width, sh = scratch.height;
      const fill = 0.94;
      const scale = Math.min(cols / sw, (rows * 2) / sh) * fill;
      const dw = sw * scale;
      const dh = sh * scale / 2;   // 垂直压缩
      const dx = (cols - dw) / 2;
      const dy = (rows - dh) / 2;
      tctx.drawImage(scratch, 0, 0, sw, sh, dx, dy, dw, dh);

      // 3) 采样 → 字符
      const data = tctx.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < cols * rows; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (lum > 0.06) {
          outChars[i] = M.rampChar(ramp, lum);
          outLum[i] = lum;
        }
      }
      this._cache = { chars: outChars, lum: outLum };
    },

    _placeholder(cols, rows) {
      const chars = new Array(cols * rows).fill(" ");
      const lum = new Float32Array(cols * rows);
      const msg = [
        "在右侧输入文字 →",
        "支持中文 · 多行 · 多种字体与样式",
      ];
      let y = (rows / 2 - 1) | 0;
      for (const line of msg) {
        const x = Math.max(0, (cols - line.length) / 2 | 0);
        for (let k = 0; k < line.length; k++) {
          const idx = y * cols + (x + k);
          if (idx < chars.length) { chars[idx] = line[k]; lum[idx] = 0.7; }
        }
        y++;
      }
      return { chars, lum };
    },
  };

  /* 依据样式绘制单行文字（白色前景, 黑底采样） */
  function drawStyled(ctx, text, x, y, fontPx, style) {
    ctx.save();
    if (style === "solid") {
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x, y);
    } else if (style === "outline") {
      ctx.lineWidth = Math.max(2, fontPx * 0.05);
      ctx.strokeStyle = "#fff";
      ctx.lineJoin = "round";
      ctx.strokeText(text, x, y);
    } else if (style === "double") {
      // 外描边 + 稍暗填充 → 双线立体
      ctx.lineWidth = Math.max(3, fontPx * 0.09);
      ctx.strokeStyle = "#fff";
      ctx.lineJoin = "round";
      ctx.strokeText(text, x, y);
      ctx.fillStyle = "#000";
      ctx.fillText(text, x, y);
      ctx.lineWidth = Math.max(1, fontPx * 0.02);
      ctx.strokeStyle = "#fff";
      ctx.strokeText(text, x, y);
    } else if (style === "gradient") {
      const grad = ctx.createLinearGradient(0, y, 0, y + fontPx);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#3a3a3a");
      ctx.fillStyle = grad;
      ctx.fillText(text, x, y);
    } else if (style === "shadow") {
      // 立体挤出：多层偏移递减亮度
      const layers = Math.max(4, Math.floor(fontPx * 0.12));
      for (let d = layers; d >= 1; d--) {
        const g = Math.floor(40 + (110 * (layers - d)) / layers);
        ctx.fillStyle = "rgb(" + g + "," + g + "," + g + ")";
        ctx.fillText(text, x + d, y + d * 0.5);
      }
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x, y);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  scenes.unshift(textStudio);          // 放在首位 → 默认主场景
  global.ASCII_TEXT_STUDIO = textStudio;
  global.ASCII_FONTS = FONTS;
})(window);
