/* GAME LAB 首页交互增强
   - 指针光斑：跟随鼠标在卡片 / 目录按钮上投射液态高光（CSS 变量 --mx/--my 驱动）
   - 点击涟漪：在按钮 / 卡片 / 链接的按下处扩散墨色涟漪
   尊重 prefers-reduced-motion：降级时完全不绑定监听，避免无意义开销。 */
(function () {
  'use strict';
  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // —— 指针光斑：把光标位置写进元素的 --mx / --my ——
  var spot = document.querySelectorAll('.card, .toc a');
  Array.prototype.forEach.call(spot, function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    });
  });

  // —— 点击涟漪 ——
  function ripple(e) {
    if (e.button !== undefined && e.button !== 0) return; // 仅左键 / 触摸 / 笔
    var el = e.currentTarget;
    var r = el.getBoundingClientRect();
    var size = Math.max(r.width, r.height);
    var dot = document.createElement('span');
    dot.className = 'ripple-dot';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size / 2) + 'px';
    dot.style.top = (e.clientY - r.top - size / 2) + 'px';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(dot);
    var done = false;
    function clean() {
      if (!done && dot.parentNode) { done = true; dot.parentNode.removeChild(dot); }
    }
    dot.addEventListener('animationend', clean);
    setTimeout(clean, 800); // 兜底清理
  }
  var targets = document.querySelectorAll(
    '.toc a, .card, .lang-switch, .bulb-switch, .brand, .foot-meta a, .btn'
  );
  Array.prototype.forEach.call(targets, function (el) {
    el.addEventListener('pointerdown', ripple);
  });
})();
