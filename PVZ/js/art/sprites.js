// 可选：真实素材（CC0 图集）接入层
// 默认关闭。调用 PVZ.sprites.load({ url, atlas }) 指向一张 CC0 精灵图集
// （如 Kenney 的 Plant & Food / Monsters 包，均为公共领域 CC0 授权）后，
// draw.js 的 drawPlant / drawZombieBody 会优先用 drawImage 绘制，否则回退到程序化矢量绘制。
// 这样既能"整合现有优质美术资源"，又保持零依赖、可离线、风格可控。
(function () {
  'use strict';
  const S = { sheet: null, ready: false, enabled: false, map: {} };
  PVZ.sprites = S;

  // opts.url: 图集图片地址；opts.atlas: { 'plant:peashooter': {sx,sy,sw,sh}, ... }
  S.load = function (opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        S.sheet = img;
        S.ready = true;
        S.enabled = true;
        S.map = opts.atlas || {};
        resolve(true);
      };
      img.onerror = () => reject(new Error('sprite sheet load failed'));
      img.src = opts.url;
    });
  };

  S.disable = function () { S.enabled = false; };

  // 在绘制函数中调用：若启用且图集含该 key，则绘制并返回 true（调用方跳过程序化绘制）
  // anchorBottom=true 时以 (x,y) 为底端中心锚点（与植物生长点一致）
  S.draw = function (ctx, key, x, y, scale, anchorBottom) {
    if (!S.enabled || !S.sheet || !S.map[key]) return false;
    const f = S.map[key];
    const w = f.sw * scale;
    const h = f.sh * scale;
    ctx.drawImage(
      S.sheet, f.sx, f.sy, f.sw, f.sh,
      x - w / 2, y - (anchorBottom ? h : h / 2), w, h
    );
    return true;
  };
})();
