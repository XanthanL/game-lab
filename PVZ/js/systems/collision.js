// 碰撞与范围查询：子弹命中、僵尸啃食判定
(function () {
  'use strict';

  PVZ.collide = {
    // 同行的子弹命中：僵尸左缘 <= 子弹 x，取其中最接近子弹的（x 最大）
    nearestZombieInRow(zombies, row, x, margin) {
      let best = null;
      for (const z of zombies) {
        if (z.row !== row || z.state === 'dead') continue;
        if (z.x - (margin || 16) <= x) {
          if (!best || z.x > best.x) best = z;
        }
      }
      return best;
    },

    // 同行且水平距离在 range 内（僵尸啃食判定）
    plantInRange(plants, row, x, range) {
      for (const p of plants) {
        if (p.row !== row || p.dead) continue;
        if (Math.abs(p.cx - x) <= range) return p;
      }
      return null;
    }
  };
})();
