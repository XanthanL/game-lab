'use strict';
/* 奇点旅途 · 子弹外观系统（2026-10-03）
   ==========================================================================
   纯视觉层：**不参与任何伤害 / 半径 / 穿透 / 命中判定**。这条边界不许越 ——
   `src/game.js` 里只有 drawPBullets 会调到本文件，pBullet / damageEnemy
   / updateBullets 一行都不许反向依赖它。

   为什么要单独一个文件：旧弹药只有「颜色」一维（`b.col`），一张卡一张色，
   叠起来看不出关系。现在拆成三个**正交、可组合**的轴，每条轴都由数据驱动：

       shape  家族 + 等级              → 轮廓（按参数生成，不手写字模）
       tint   具名配色（有界集合）      → 描边 / 弹身 / 弹芯 三色
       deco   附加装饰层（协同专用）    → 叠在最上面的一张独立精灵

   三层各自独立缓存，缓存规模是**相加**而不是相乘 —— 这是本文件最重要的性能纪律。
   如果把「组合」整体烘焙成一张精灵，组合数会炸开（家族 × 等级 × 尺寸 × 配色 × 装饰），
   几分钟就能堆出上千张离屏 canvas。分层之后：
       shape 键 = `<family>_<tier>_<size>_<tint>`
       deco  键 = `<name>`

   ⚠️ 缓存 key 纪律（AGENTS.md「三条硬纪律」第 2 条）：
      key 只能是**有限枚举**的字符串。绝不能把浮点半径、逐帧变化的 alpha 或坐标写进 key，
      否则每帧泄漏一张 canvas。要淡出就在 draw 时用 globalAlpha（见 drawGlow）。

   依赖 sprites.js 的四个全局（index.html 里 sprites.js 必须排在 bulletskin.js 之前）：
   newCanvas / bakeRotation / spriteFrom / dirIndex / drawGlow。
   ========================================================================== */

/* ---------------- ① 轮廓参数：家族 × 等级 ----------------
   L  总长（含两端封口）
   T  总厚（含上下描边；≥3 且为奇数，否则分不出「单亮线」的中轴）
   nose  flat（平）| taper（微收）| point（锥尖）| round（圆头）| step（台阶）
   tail  flat（平）| notch（尾凹）| fork（燕尾）
   fins  0|1|2 —— 向上下各外扩一行尾翼
   core  0 无 / 1 中轴细亮线 / 2 整块亮核
   band  0..3 —— 弹身上压出的深色分隔环数
   hollow 0 无 / 1 中心一个空点 / 2 中心一圈空环 */
const BSHAPE = {
  // 默认：与改造前的默认外观逐像素一致（9×3 青白细针）
  plain: [
    { L: 9, T: 3, nose: 'flat', tail: 'flat', core: 1 },
    { L: 9, T: 3, nose: 'flat', tail: 'flat', core: 1 },
    { L: 9, T: 3, nose: 'flat', tail: 'flat', core: 1 },
  ],
  // 穿甲弹：越长越尖，最高级长出尾翼
  spear: [
    { L: 12, T: 3, nose: 'point', tail: 'flat', core: 1 },
    { L: 15, T: 3, nose: 'point', tail: 'notch', core: 1 },
    { L: 18, T: 5, nose: 'point', tail: 'fork', fins: 1, core: 1 },
  ],
  // 高爆弹：圆头炸药包，越升级越鼓、环越多
  bomb: [
    { L: 10, T: 5, nose: 'round', tail: 'flat', core: 1, band: 1 },
    { L: 12, T: 7, nose: 'round', tail: 'notch', core: 1, band: 1 },
    { L: 14, T: 7, nose: 'round', tail: 'notch', core: 1, band: 2 },
  ],
  // 裂变弹芯：空心壳体 —— 打出去就知道它里面还有东西
  core: [
    { L: 10, T: 5, nose: 'round', tail: 'flat', core: 0, hollow: 1 },
    { L: 11, T: 7, nose: 'round', tail: 'flat', core: 0, hollow: 2 },
    { L: 13, T: 7, nose: 'round', tail: 'notch', core: 2, hollow: 2 },
  ],
  // 制导弹药：永远带侧鳍，鳍随等级变多
  seeker: [
    { L: 10, T: 3, nose: 'taper', tail: 'flat', fins: 1, core: 1 },
    { L: 12, T: 5, nose: 'taper', tail: 'notch', fins: 1, core: 1 },
    { L: 13, T: 5, nose: 'point', tail: 'fork', fins: 2, core: 2 },
  ],
  // —— 组合家族：两张卡同时到手才成立，轮廓同时带上两边的特征 ——
  // 穿甲 × 高爆：脱壳穿甲 + 炸药包
  sabot: [
    { L: 13, T: 5, nose: 'point', tail: 'notch', core: 1, band: 1 },
    { L: 15, T: 5, nose: 'point', tail: 'notch', core: 2, band: 1 },
    { L: 17, T: 7, nose: 'point', tail: 'fork', core: 2, band: 2, fins: 1 },
  ],
  // 穿甲 × 口径：重型矛（尺寸轴还会再叠一层口径加成，所以基数刻意留短）
  hammer: [
    { L: 13, T: 5, nose: 'point', tail: 'flat', core: 2 },
    { L: 15, T: 7, nose: 'point', tail: 'notch', core: 2, band: 1 },
    { L: 17, T: 7, nose: 'point', tail: 'fork', core: 2, band: 2 },
  ],
  // 穿甲 × 制导：带鳍的矛
  dive: [
    { L: 12, T: 3, nose: 'point', tail: 'flat', fins: 1, core: 1 },
    { L: 14, T: 5, nose: 'point', tail: 'notch', fins: 1, core: 1 },
    { L: 16, T: 5, nose: 'point', tail: 'fork', fins: 2, core: 2 },
  ],
  // 跳弹 × 高爆：弹身压出一道道环 —— 看着就该弹来弹去
  bound: [
    { L: 10, T: 5, nose: 'round', tail: 'flat', core: 1, band: 2 },
    { L: 12, T: 5, nose: 'round', tail: 'notch', core: 1, band: 2 },
    { L: 13, T: 7, nose: 'round', tail: 'notch', core: 2, band: 3 },
  ],
  // 裂变 × 高爆：空心荚舱（环 + 空心同时出现）
  pod: [
    { L: 11, T: 5, nose: 'round', tail: 'flat', core: 0, hollow: 1, band: 1 },
    { L: 13, T: 7, nose: 'round', tail: 'notch', core: 0, hollow: 2, band: 1 },
    { L: 15, T: 7, nose: 'round', tail: 'notch', core: 1, hollow: 2, band: 2 },
  ],
  // 裂变弹片：独立小家族 —— 它是母弹炸出来的碎片，不该长得像母体
  frag: [
    { L: 5, T: 3, nose: 'flat', tail: 'flat', core: 1 },
    { L: 6, T: 3, nose: 'taper', tail: 'flat', core: 1 },
    { L: 7, T: 5, nose: 'taper', tail: 'notch', core: 1 },
  ],
  // 无人机弹：永远最小的一档，等级只给一点点体积
  nub: [
    { L: 5, T: 3, nose: 'flat', core: 1 },
    { L: 6, T: 3, nose: 'taper', core: 1 },
    { L: 7, T: 3, nose: 'taper', core: 1, fins: 1 },
  ],
};

/* ---------------- ② 尺寸档：只看「口径校准」的等级 ----------------
   口径是唯一同时改「半径 / 弹速 / 射程」三个维度的卡，所以尺寸轴与它对齐：
   视觉上的「变粗变长」和数值上的「判定半径变大」是同一件事的两种读数。
   ⚠️ 但这里只是给轮廓加数 —— 真正的判定半径仍由 pBullet 的 S.bulletR 决定，本表碰不到它。 */
const BSIZE = [
  { dL: 0, dT: 0 },
  { dL: 2, dT: 2 },
  { dL: 4, dT: 2 },
  { dL: 6, dT: 4 },
];

/* ---------------- ③ 配色：[描边, 弹身, 弹芯] ----------------
   有界集合 —— 缓存 key 直接拿名字。**别从外面传裸颜色字符串进来**，
   那样 key 就不再是有限枚举了。 */
const BTINT = {
  cyan: ['#0b2a3a', '#73eff7', '#f4f4f4'],   // 主炮默认（与改造前逐像素一致）
  ice: ['#0b2a3a', '#94b0c2', '#f4f4f4'],   // 散射弹：苍白、次一等
  amber: ['#2a1206', '#ef7d57', '#ffe9a8'],   // 尾炮 / 裂变弹片
  gold: ['#3a2606', '#ffcd75', '#fff4d0'],   // 质变统一金
  violet: ['#1c0a34', '#c070f0', '#f0d8ff'],   // 拘束 / 相位系
  rose: ['#2a0a18', '#e04060', '#ffd8e4'],   // 湮灭 / 收割系
  mint: ['#06281f', '#38b764', '#d6ffe8'],   // 折跃 / 残响系
};

/* ---------------- ④ 附加装饰层 ----------------
   一律「朝右」、24 向烘焙，和母弹共用同一个方向索引 —— 所以永远贴合母弹朝向。
   字符走 sprites.js 的 PAL（和舰体配件同一套上色习惯）。
   ⚠️ 尺寸要压得住：它叠在母弹上，太大就把母弹轮廓整个糊掉。 */
const BDECO = {
  goldRing: [      // 重弹穿甲：弹头一道金环
    '........',
    '...yy...',
    '..y..y..',
    '..y..y..',
    '...yy...',
    '........',
  ],
  crossBar: [      // 齐射穿甲：十字撑架
    '.....',
    '..w..',
    '.www.',
    '..w..',
    '.....',
  ],
  critGlint: [     // 穿甲暴击：一道白色刃光
    '.......',
    '.....ww',
    '..www..',
    'ww.....',
    '.......',
  ],
  sparkTail: [     // 跳弹三件套：蹭出一串火星
    '......',
    'y..y.y',
    '.y..y.',
    '......',
  ],
  hotSparks: [     // 已弹过至少一次（bounceN > 0）→ 更烫更亮
    '......',
    'w.w.ww',
    '.ww.w.',
    '......',
  ],
  clusterDot: [    // 霰爆 / 裂变爆破：一圈子炸弹的指示点
    '.......',
    '.y...y.',
    '.......',
    '.y...y.',
    '.......',
  ],
  voidCore: [      // 静滞 / 共振：内部一个空洞
    '.....',
    '.kkk.',
    '.k.k.',
    '.kkk.',
    '.....',
  ],
  haloWave: [      // 制导穿甲：锁定的一圈波纹
    '.......',
    '..ccc..',
    '.c...c.',
    '.c...c.',
    '..ccc..',
    '.......',
  ],
  arrowBack: [     // 尾炮系：往后的箭头（被打到时一眼能看出来源）
    '......',
    'w.....',
    '.w....',
    '.w....',
    'w.....',
    '......',
  ],
  burnEdge: [      // 透体圣光：灼烧边
    '......',
    'o.oo.o',
    '.ooo..',
    'o.oo.o',
    '......',
  ],
  bindRing: [      // 静滞钳制：缠绕的暗环
    '......',
    '.qqqq.',
    '.q..q.',
    '.qqqq.',
    '......',
  ],
  harvestMark: [   // 收割放牧：一滴血
    '....',
    '.RR.',
    '.RR.',
    '....',
  ],
  loneDot: [       // 猎手直觉：准心那一点
    '...',
    '.w.',
    '...',
  ],
  lanceEdge: [     // 重矛：弹身两侧各一道冷光
    '......',
    'wwwww.',
    '......',
    '.wwwww',
    '......',
  ],
  wallSweep: [     // 弹幕墙：横向扫痕
    '.....',
    'wwww.',
    '.....',
    '.wwww',
    '.....',
  ],
  swarmPing: [     // 脉冲机群：一点同步信号
    '....',
    'w..w',
    '....',
    '.ww.',
    '....',
  ],
};

// ============ 轮廓生成：参数 → 图层字符画（o 描边 / b 弹身 / c 弹芯 / . 透明） ============
// 弹头塑形影响的列数 k。提亮逻辑要用同一个 k，所以单独抽出来 ——
// 两边各算一次的话，改了这里忘了那里，尖头会留下一段没提亮的暗针。
function bnoseK(nose, L) {
  if (nose === 'point') return Math.max(2, Math.round(L * 0.38));
  if (nose === 'round') return Math.max(3, Math.round(L * 0.42));   // 圆头要摊得开才圆
  return 2;                                                        // taper / step / flat
}
function bcutNose(g, nose, L, T, y0) {
  if (!nose || nose === 'flat') return;
  const half = (T - 1) / 2;
  const k = bnoseK(nose, L);
  for (let i = 0; i < k; i++) {
    const x = L - 1 - i;
    if (x < 0) break;
    let cut;
    switch (nose) {
      case 'point': cut = Math.round(half * (1 - i / k)); break;
      case 'round': cut = Math.ceil(half * Math.cos((i / k) * Math.PI / 2)); break;
      case 'taper': cut = i === 0 ? 1 : 0; break;
      case 'step': cut = i === 0 ? 1 : 0; break;
      default: cut = 0;
    }
    cut = Math.min(cut, Math.floor(half));
    for (let d = 0; d < cut; d++) {
      if (g[y0 + d]) g[y0 + d][x] = 0;
      if (g[y0 + T - 1 - d]) g[y0 + T - 1 - d][x] = 0;
    }
  }
}
function bcutTail(g, tail, L, T, y0) {
  if (!tail || tail === 'flat') return;
  if (T < 5) return;                       // 太薄，挖不出燕尾，只会把弹尾削断
  const mid = y0 + (T >> 1);
  const depth = tail === 'fork' ? 2 : 1;
  for (let x = 0; x < depth; x++) g[mid][x] = 0;
}
function bRows(p) {
  const L = Math.max(3, p.L | 0), T = Math.max(3, p.T | 0), fins = p.fins | 0;
  const H = T + (fins ? 2 : 0), y0 = fins ? 1 : 0;
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(L).fill(0));
  for (let y = y0; y < y0 + T; y++) for (let x = 0; x < L; x++) g[y][x] = 1;
  if (fins) {
    const fl = Math.max(2, Math.round(L * 0.3));
    for (let x = 0; x < fl; x++) { g[0][x] = 1; g[H - 1][x] = 1; }
  }
  bcutNose(g, p.nose, L, T, y0);
  bcutTail(g, p.tail, L, T, y0);

  // 先分「描边 / 内部」：紧贴空气的那一圈就是描边。这条规则有两个好处：
  // ① 不需要为每个形状手写一圈轮廓 —— 削出来的斜边、尾翼、尾凹全都自动带上描边；
  // ② 单排矩形（T=3）的两侧端点也落在这条规则里，正好复刻旧的青白细针。
  const c = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < L; x++) {
      if (!g[y][x]) { row.push('.'); continue; }
      const nb =
        (y === 0 || !g[y - 1][x]) || (y === H - 1 || !g[y + 1][x]) ||
        (x === 0 || !g[y][x - 1]) || (x === L - 1 || !g[y][x + 1]);
      row.push(nb ? 'o' : '@');
    }
    c.push(row);
  }
  /* 弹头提亮：前缘那些「上下都是空气」的像素会被上面那条规则判成描边，
     于是锥尖 / 圆头在星空背景上变成一条暗针 —— 恰好是最该被看见的一段。
     只提亮**前缘最后 3 列**、且只动那些孤立像素：轮廓形状一个不变，
     但看得见的那条亮线就是弹的走向。 */
  if (p.nose && p.nose !== 'flat') {
    const k = bnoseK(p.nose, L);
    // ⚠️ 提亮只能在限制条件里进行：只有「上下都是空气的孤立像素」才会被点亮，
    //    所以哪怕扫过整个塑形区也不会把正常描边吃掉。
    for (let y = 0; y < H; y++) for (let x = Math.max(0, L - k - 1); x < L; x++) {
      if (c[y][x] !== 'o') continue;
      const upEmpty = y === 0 || !g[y - 1][x];
      const dnEmpty = y === H - 1 || !g[y + 1][x];
      if (upEmpty && dnEmpty) c[y][x] = 'c';
    }
  }
  // 内部再按 core / band / hollow 上色
  const midY = y0 + (T >> 1);
  const core = p.core | 0;
  const xCore1 = Math.ceil(L * 0.33);
  const xCore2 = Math.floor(L * 0.28);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    if (c[y][x] !== '@') continue;
    let ch = 'b';
    if (core === 1 && y === midY && x >= xCore1) ch = 'c';
    else if (core === 2 && x >= xCore2) ch = 'c';
    c[y][x] = ch;
  }
  // 分隔环：在弹身上压出深色窄环
  const band = Math.min(3, p.band | 0);
  for (let i = 0; i < band; i++) {
    const x = Math.round(L * (0.30 + i * 0.16));
    if (x < 1 || x >= L - 1) continue;
    for (let y = 0; y < H; y++) if (c[y][x] !== '.') c[y][x] = 'o';
  }
  // 空心：中心一个空点 / 一圈空环
  const hollow = p.hollow | 0;
  if (hollow) {
    const x = Math.round(L * 0.5);
    if (hollow === 1) {
      if (c[midY]) c[midY][x] = 'o';
    } else {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = midY + dy, xx = x + dx;
        if (c[yy] && c[yy][xx] && c[yy][xx] !== '.') c[yy][xx] = (dx === 0 && dy === 0) ? 'c' : 'o';
      }
    }
  }
  return c.map(r => r.join(''));
}
function rowsToCanvas(rows, tint) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const cv = newCanvas(w, h), x = cv.getContext('2d');
  const [co, cb, cc] = BTINT[tint] || BTINT.cyan;
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    const col = ch === 'o' ? co : ch === 'b' ? cb : ch === 'c' ? cc : null;
    if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
  }
  return cv;
}

// ============ 缓存（Map 保序，溢出时丢最早的 —— 谁最久没用就丢谁） ============
const BSHAPE_CACHE = new Map(), BDECO_CACHE = new Map();
const BCACHE_MAX = 56;              // ≈56 套 × 24 向；实测一局同时存在的不会超过十来套
function bCacheGet(map, key, build) {
  const hit = map.get(key);
  if (hit) return hit;
  const v = build();
  map.set(key, v);
  if (map.size > BCACHE_MAX) map.delete(map.keys().next().value);
  return v;
}
function bShapeSet(family, tier, size, tint) {
  const base = (BSHAPE[family] || BSHAPE.plain)[Math.min(2, Math.max(0, tier - 1))];
  const dz = BSIZE[Math.min(3, Math.max(0, size | 0))];
  // 组合后的尺寸：**先叠口径，再夹上限** —— 夹上限是防止「多重弹体卡 + 口径」长出一条比飞船还长的船锚
  const p = Object.assign({}, base, {
    L: Math.min(22, base.L + dz.dL),
    T: Math.min(9, base.T + dz.dT),
  });
  return { key: family + '_' + tier + '_' + size, rows: bRows(p), params: p };
}
function bShapeSprites(keyed) {
  return bCacheGet(BSHAPE_CACHE, keyed.key + '|' + keyed.tintKey,
    () => bakeRotation(rowsToCanvas(keyed.rows, keyed.tint), 24));
}

// ============ 对外 API ============
const BulletSkin = {
  families: () => Object.keys(BSHAPE),
  decos: () => Object.keys(BDECO),
  tints: () => Object.keys(BTINT),
  cacheSize: () => ({ shape: BSHAPE_CACHE.size, deco: BDECO_CACHE.size }),
  // 探针 / 总览图专用：把某个 spec 拆出来的图层字符画（不经过缓存）
  rows(spec) { return bShapeSet(spec.family, spec.tier, spec.size, 'cyan').rows; },
  params(spec) {
    const k = bShapeSet(spec.family, spec.tier, spec.size, 'cyan');
    return k.params;
  },
  /* spec: {family, tier, size, tint, deco, aura:[color, R, alpha]}
     每次 drawPBullets **每种来源只调一次**，别在子弹循环里逐发拼 spec。 */
  make(spec) {
    const kd = bShapeSet(spec.family || 'plain', spec.tier | 0 || 1, spec.size | 0, null);
    kd.tintKey = spec.tint || 'cyan';
    const set = bShapeSprites(kd);
    let deco = null;
    if (spec.deco && BDECO[spec.deco]) {
      deco = bCacheGet(BDECO_CACHE, spec.deco,
        () => bakeRotation(spriteFrom(BDECO[spec.deco]), 24));
    }
    const aura = spec.aura || null;
    return { set, deco, aura };
  },
  /* ang/x/y 与旧 drawBulletSet 完全同义。
     aura=true 时才画辉光 —— 场上弹多时由调用方关掉（一发一次 drawImage，几百发就肉疼）。 */
  draw(ctx, look, ang, x, y, aura) {
    const i = dirIndex(ang, look.set.n);
    const px = Math.round(x), py = Math.round(y);
    if (aura && look.aura) drawGlow(ctx, look.aura[0], look.aura[1], look.aura[2], px, py);
    ctx.drawImage(look.set.imgs[i], px - look.set.half, py - look.set.half);
    if (look.deco) ctx.drawImage(look.deco.imgs[i], px - look.deco.half, py - look.deco.half);
  },
};
