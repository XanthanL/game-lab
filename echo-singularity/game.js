;(function () {
'use strict';
/* ============================================================================
   game.js —— 小游戏入口
   ----------------------------------------------------------------------------
   只做三件事：创建主画布、对齐视口、把 App 跑起来。
   任何游戏逻辑都不许写在这里 —— 这里越薄，H5 预览越容易复用同一份代码。
   ========================================================================== */

const PAL = require('./js/pal.js');
const AppMod = require('./js/app.js');

const cv = PAL.createMainCanvas();
PAL.fitCanvas(cv);

const app = new AppMod.App();
app.start();

/* 调试钩子：真机/模拟器上可以在控制台里摸状态（打包前不影响逻辑）
   小游戏里全局对象是 global，浏览器里是 window —— 两个都挂，探针才好拿。 */
var __g = (typeof global !== 'undefined') ? global : (typeof window !== 'undefined' ? window : null);
if (__g) __g.__ES = { app: app, PAL: PAL };
})();
