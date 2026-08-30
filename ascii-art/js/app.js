/* UI 装配：读控件 → 调 studio 渲染 → 复制或导出。 */
(function () {
  "use strict";
  const S = window.AsciiStudio;
  const $ = (id) => document.getElementById(id);
  const out = $('out');

  const state = {
    text: '你好\nASCII',
    cols: 60,
    font: 'hei',
    style: 'solid',
    ramp: 'classic',
    palette: 'green',
    align: 'center',
    gamma: 1,
    threshold: 0.1,
    bold: true,
    italic: false,
  };
  let last = null;
  let cell = null;

  /** 屏幕网格与导出网格必须同一比例，所以字符格尺寸从真实渲染样式里量 */
  function measure() {
    const cs = getComputedStyle(out);
    const fs = parseFloat(cs.fontSize) || 12;
    const lhPx = parseFloat(cs.lineHeight) || fs * 1.28;
    cell = S.measureCell(cs.fontFamily, fs, lhPx / fs); // 行距取 CSS 实际值
  }

  function render() {
    if (!cell) measure();
    const res = S.rasterize({
      text: state.text,
      cols: state.cols,
      font: state.font,
      style: state.style,
      align: state.align,
      bold: state.bold,
      italic: state.italic,
      ramp: S.RAMPS[state.ramp].chars,
      gamma: state.gamma,
      threshold: state.threshold,
      lineGap: 1.24,
      fill: 0.96,
      cellAspect: cell.aspect,
    });
    last = res;
    if (res.empty) {
      out.textContent = '';
      $('meta').textContent = '等待输入';
      return;
    }
    out.textContent = res.grid.map((l) => l.join('')).join('\n');
    const pal = S.PALETTES[state.palette];
    out.style.color = pal.stops[2];
    out.style.background = pal.bg;
    $('meta').textContent = res.cols + ' × ' + res.rows + ' 格 · ' + (res.cols * res.rows) + ' 字符';
  }

  /* ---------- 控件绑定 ---------- */
  document.querySelectorAll('.seg[data-group]').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      state[seg.dataset.group] = b.dataset.v;
      render();
    });
  });

  $('text').addEventListener('input', (e) => {
    state.text = e.target.value;
    $('count').textContent = e.target.value.length + ' / 240';
    render();
  });

  $('cols').addEventListener('input', (e) => {
    state.cols = Number(e.target.value);
    $('colsV').textContent = state.cols + ' 列';
    render();
  });

  $('gamma').addEventListener('input', (e) => {
    state.gamma = Number(e.target.value);
    $('gammaV').textContent = state.gamma.toFixed(2);
    render();
  });

  $('threshold').addEventListener('input', (e) => {
    state.threshold = Number(e.target.value);
    $('thrV').textContent = state.threshold.toFixed(2);
    render();
  });

  $('bold').addEventListener('click', (e) => {
    state.bold = !state.bold;
    e.currentTarget.classList.toggle('on', state.bold);
    render();
  });
  $('italic').addEventListener('click', (e) => {
    state.italic = !state.italic;
    e.currentTarget.classList.toggle('on', state.italic);
    render();
  });

  /* ---------- 导出 ---------- */
  function image() {
    if (!last || last.empty) return null;
    return S.toImage(last, {
      palette: state.palette,
      fontFamily: getComputedStyle(out).fontFamily,
      cellAspect: cell.aspect,
    }, 18); // 每行 18px，导出图比屏幕清晰一档
  }

  function flash(msg) {
    const t = $('tip');
    t.textContent = msg;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { t.textContent = ''; }, 2200);
  }

  $('copyTxt').addEventListener('click', async () => {
    if (!last || last.empty) return flash('先输入文字');
    try {
      await navigator.clipboard.writeText(S.text(last));
      flash('文本已复制');
    } catch (e) {
      flash('复制失败，请手动选取');
    }
  });

  $('copyImg')
    .addEventListener('click', async () => {
      const cv = image();
      if (!cv) return flash('先输入文字');
      try {
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        flash('图片已复制');
      } catch (e) {
        // Safari / 无剪贴板权限时退回下载
        download(cv);
        flash('浏览器不支持复制图片，已改为下载');
      }
    });

  $('saveImg').addEventListener('click', () => {
    const cv = image();
    if (!cv) return flash('先输入文字');
    download(cv);
  });

  function download(cv) {
    const a = document.createElement('a');
    a.download = 'ascii-lab.png';
    a.href = cv.toDataURL('image/png');
    a.click();
  }

  window.addEventListener('resize', () => { measure(); render(); });

  $('text').value = state.text;
  $('count').textContent = state.text.length + ' / 240';
  measure();
  render();
})();
