/**
 * theme.js — 全局视觉主题：字体栈与文本渲染质量
 * 必须在 Phaser 之后、其余游戏脚本之前加载
 */

/* ============================================================
 * 字体栈
 * ============================================================ */
// UI 主字体：各平台中文黑体，笔画粗壮、小字号下依然清晰
const FONT_UI = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Heiti SC", "WenQuanYi Micro Hei", sans-serif';

// 终端等宽风（开场剧情打字机）：英文等宽，中文自动回退黑体
const FONT_MONO = 'Consolas, "Courier New", "Microsoft YaHei", monospace';

/* ============================================================
 * 高分屏文本渲染补丁
 * Scale.FIT 会把 960×640 画布拉伸到整屏，Canvas 文本按设计分辨率
 * 光栅化后放大必糊。这里让所有 scene.add.text 默认以 2~3x 分辨率
 * 渲染纹理，放大后依旧锐利。
 * ============================================================ */
(() => {
  const TEXT_RES = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
  const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype;
  const origText = factoryProto.text;
  factoryProto.text = function (x, y, content, style) {
    const t = origText.call(this, x, y, content, style);
    t.setResolution(TEXT_RES);
    return t;
  };
})();
