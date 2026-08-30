/* 文字工坊：把任意文字（含中文）转成 ASCII 字符画。
   渲染只在参数变化时跑一次，没有动画循环。 */
(function (global) {
  "use strict";

  const FONTS = {
    hei: '"Microsoft YaHei","PingFang SC","Heiti SC","SimHei",sans-serif',
    song: '"SimSun","Songti SC","STSong",serif',
    kai: '"KaiTi","STKaiti","Kaiti SC",serif',
    sans: '"Segoe UI","Helvetica Neue","Microsoft YaHei",Arial,sans-serif',
    serif: '"Georgia","Times New Roman","Songti SC",serif',
    impact: '"Impact","Arial Black","Microsoft YaHei",sans-serif',
  };

  const RAMPS = {
    classic: { label: '经典 10 阶', chars: ' .:-=+*#%@' },
    fine: { label: '精细 70 阶', chars: ' .,;:!\'^~*<aovwxczxqpkijlvtrdfhnmJHLIBFUYTEZGSVO24789#MW&8%B@$' },
    block: { label: '方块 5 阶', chars: ' ░▒▓█' },
    dots: { label: '圆点', chars: ' .oO0' },
    cjk: { label: '汉字笔画', chars: ' 一二三十王田' },
    braille: { label: '盲文点阵', chars: ' ⠁⠃⠇⠧⠿⡿' },
  };

  // 配色按亮度静态取色（不再随帧流动）
  const PALETTES = {
    green: { bg: '#050b06', stops: ['#1e5f3a', '#39b06b', '#8dfab4'] },
    amber: { bg: '#0b0703', stops: ['#7a4a12', '#d99436', '#ffd9a0'] },
    ice: { bg: '#04080d', stops: ['#1d4a6b', '#4f9fd0', '#cdefff'] },
    magma: { bg: '#0b0402', stops: ['#6e1a10', '#d95f26', '#ffd27a'] },
    mono: { bg: '#0a0a0a', stops: ['#7a7a7a', '#c4c4c4', '#ffffff'] },
  };

  const STYLES = ['solid', 'outline', 'gradient', 'shadow'];

  // 屏幕与导出共用同一个行距：字符格 = 宽 (LH*aspect) × 高 LH，三处必须一致，
  // 否则导出图会比屏幕上的稀疏一圈
  const LINE_HEIGHT = 1.28;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // 纯映射：gamma/阈值都在调用侧算过，这里不再叠第二层曲线
  function rampChar(chars, t) {
    const n = chars.length;
    return chars[clamp(Math.floor(t * (n - 1) + 1e-4), 0, n - 1)];
  }

  /* ---------- 核心：文字 → 字符矩阵 ---------- */
  function rasterize(opt) {
    const cols = clamp(opt.cols | 0, 12, 240);
    const lines = String(opt.text == null ? '' : opt.text).split('\n');
    if (!lines.some((l) => l.trim())) return { cells: [], cols: 0, rows: 0, empty: true };

    // 1) 高分辨率画出文字
    const src = document.createElement('canvas');
    const sctx = src.getContext('2d', { willReadFrequently: true });
    const fontPx = 132;
    const fontStr = (opt.italic ? 'italic ' : '') + (opt.bold ? 'bold ' : 'normal ') + fontPx + 'px ' + (FONTS[opt.font] || FONTS.hei);
    sctx.font = fontStr;
    const lineH = fontPx * opt.lineGap;
    let maxW = 1;
    for (const l of lines) maxW = Math.max(maxW, sctx.measureText(l || ' ').width);
    const pad = fontPx * 0.3;
    src.width = Math.ceil(maxW + pad * 2);
    src.height = Math.ceil(lineH * lines.length + pad * 2);
    sctx.font = fontStr; // 改尺寸会重置状态
    sctx.textBaseline = 'top';
    sctx.textAlign = opt.align;
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, src.width, src.height);
    const ax = opt.align === 'left' ? pad : opt.align === 'right' ? src.width - pad : src.width / 2;
    lines.forEach((l, i) => drawStyled(sctx, l || ' ', ax, pad + i * lineH, fontPx, opt.style));

    // 2) 按字符格宽高比反推行数，保证不被压扁（关键修正：旧版写死 /2）
    const aspect = opt.cellAspect; // 字符格 宽/高，约 0.5~0.62
    const wantH = (src.height / src.width) * cols * aspect;
    const rows = clamp(Math.round(wantH), 1, 160);

    // 3) 缩到 cols×rows 后逐格采样
    const tgt = document.createElement('canvas');
    tgt.width = cols;
    tgt.height = rows;
    const tctx = tgt.getContext('2d', { willReadFrequently: true });
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, cols, rows);
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    const fill = opt.fill;
    // 目标网格每格是 aspect:1 的扁矩形，所以纵向要按 aspect 压缩；
    // 少了这一步，min() 会取到高度约束，把内容压成只剩 1/3 宽。
    const sc = Math.min((cols * fill) / src.width, (rows * fill) / (src.height * aspect));
    const dw = src.width * sc;
    const dh = src.height * sc * aspect;
    tctx.drawImage(src, 0, 0, src.width, src.height, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    const data = tctx.getImageData(0, 0, cols, rows).data;

    const chars = [];
    const lum = [];
    for (let i = 0; i < cols * rows; i++) {
      const v = clamp(data[i * 4] / 255, 0, 1);
      const g = Math.pow(v, opt.gamma);
      chars.push(g > opt.threshold ? rampChar(opt.ramp, g) : ' ');
      lum.push(g);
    }
    const grid = [];
    for (let y = 0; y < rows; y++) grid.push(chars.slice(y * cols, y * cols + cols));
    return { grid: grid, lum: lum, cols: cols, rows: rows, empty: false };
  }

  function drawStyled(ctx, text, x, y, fontPx, style) {
    ctx.save();
    if (style === 'outline') {
      ctx.lineWidth = Math.max(2, fontPx * 0.05);
      ctx.strokeStyle = '#fff';
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    } else if (style === 'gradient') {
      const g = ctx.createLinearGradient(0, y, 0, y + fontPx * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#2c2c2c');
      ctx.fillStyle = g;
      ctx.fillText(text, x, y);
    } else if (style === 'shadow') {
      const layers = Math.max(4, Math.floor(fontPx * 0.1));
      for (let d = layers; d >= 1; d--) {
        const gv = Math.floor(36 + (100 * (layers - d)) / layers);
        ctx.fillStyle = 'rgb(' + gv + ',' + gv + ',' + gv + ')';
        ctx.fillText(text, x + d, y + d * 0.5);
      }
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, y);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  /* ---------- 输出：等宽字符 → 高分辨率位图（导出与显示同一份真相） ---------- */
  /** res → 位图。cellH 是「一行的高度」，字号要按行距折算，不能直接当字号 */
  function toImage(res, opt, cellH) {
    const cs = document.createElement('canvas');
    const h = Math.max(8, cellH | 0);
    const cw = h * opt.cellAspect;
    const pad = Math.round(h * 0.6);
    cs.width = Math.ceil(res.cols * cw) + pad * 2;
    cs.height = Math.ceil(res.rows * h) + pad * 2;
    const c = cs.getContext('2d');
    const pal = PALETTES[opt.palette] || PALETTES.green;
    c.fillStyle = pal.bg;
    c.fillRect(0, 0, cs.width, cs.height);
    c.font = (h / LINE_HEIGHT).toFixed(2) + 'px ' + opt.fontFamily;
    c.textBaseline = 'top';
    const yOff = (h - h / LINE_HEIGHT) / 2; // 在行盒里垂直居中
    for (let y = 0; y < res.rows; y++) {
      const row = res.grid[y];
      for (let x = 0; x < res.cols; x++) {
        const ch = row[x];
        if (ch === ' ') continue;
        c.fillStyle = pick(pal, res.lum[y * res.cols + x]);
        c.fillText(ch, pad + x * cw, pad + y * h + yOff);
      }
    }
    return cs;
  }

  function pick(pal, lum) {
    const s = pal.stops;
    const i = clamp(Math.floor(lum * (s.length - 1) + 0.5), 0, s.length - 1);
    return s[i];
  }

  /** 实测字符格尺寸：等宽字的宽高比差别很大，写死 0.6 会让部分字体变形 */
  function measureCell(fontFamily, fontSize, lineHeight) {
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;white-space:pre;' +
      'font:' + fontSize + 'px ' + fontFamily + ';line-height:' + lineHeight;
    probe.textContent = 'MMMMMMMMMMMMMMMMMM';
    document.body.appendChild(probe);
    const box = probe.getBoundingClientRect();
    document.body.removeChild(probe);
    const charW = box.width / 18;
    const lineH = fontSize * lineHeight;
    return { charW: charW, lineH: lineH, aspect: clamp(charW / lineH, 0.3, 0.9) };
  }

  global.AsciiStudio = {
    LINE_HEIGHT: LINE_HEIGHT,
    FONTS: FONTS,
    RAMPS: RAMPS,
    PALETTES: PALETTES,
    STYLES: STYLES,
    rasterize: rasterize,
    toImage: toImage,
    measureCell: measureCell,
    text: (res) => (res.empty ? '' : res.grid.map((l) => l.join('')).join('\n')),
  };
})(window);
