# MASTER.md — 老陈家面馆 · 设计系统（唯一真源副本）

> skill 版本：website-style-router **0.8.0**
> 锚点：`retro-nostalgic`（nostalgic 族）｜布局原型：`editorial-hero`｜批次：本批次第 1 站（ledger 空账开工）
> 落定：2026-09-12 G2 用户确认（复古怀旧 / paper 底 / plain-html / left-rail）
> 生效 token 文件：`site/style.css` 的 `:root` —— **与本文件逐值一致，两处不得漂移**
> 生成方式：`emit_tokens.py --anchor retro-nostalgic --surface paper --variant a`（0 版本对，确定性输出，非手编）

## 落定记录

| 维度 | 值 |
|---|---|
| 族 → 锚点 | nostalgic → `retro-nostalgic`（无本地 spec，按签名生成） |
| 布局 + 中轴 | `editorial-hero` + `--axis: left-rail` |
| 底色档 | `paper`（纸白暖底 L0.975） |
| 变体轴 | `a` 原值（该锚点批次首用） |
| 字体搭配 | display `DM Serif Display` × body `DM Sans`（自托管 woff2 子集，latin）× cjk 宋体系（系统栈，不整包自托管）× mono `Fragment Mono`（本站未用） |
| 视觉签名 | 见下段（4 条） |

## Tokens（与 `site/style.css` `:root` 逐值一致）

```css
:root {
  /* ── 颜色（锚点 `retro-nostalgic` 签名 · 底色档 `paper` · 色相 45° / 彩度档 2 / 色温 +1.0）── */
  --bg:        #FCF5F0;   /* surface=paper · oklch(0.975 0.016 60) */
  --bg-soft:   #F8E9DE;
  --fg:        #231D18;   /* 对 --bg 对比度 15.5:1 */
  --muted:     #77706A;   /* 对 --bg 对比度 4.6:1（正文下限 4.5） */
  --line:      rgba(0,0,0,.12);
  --accent:    #964C28;   /* 强调 / 装饰；大字下限 3:1 = 5.8:1 */
  --accent-ink:#BD4F0A;   /* 可做正文链接，对比度 4.6:1 */
  --accent-soft: rgba(150,76,40,.10);

  /* ── 反同质化指纹 ── */
  --surface:   "paper";
  --variant:   "a";

  /* ── 字体（具名搭配 · 来源：锚点 `retro-nostalgic`）── */
  --font-display: "DM Serif Display", "Playfair Display", serif;
  --font-body:    "DM Sans", "Inter", "PingFang SC", sans-serif;
  --font-mono:    "Fragment Mono", ui-monospace, Consolas, monospace;
  --font-cjk:     "Source Han Serif SC", "Noto Serif SC", "Songti SC", serif;
  --font-display-name: "DM Serif Display";
  --font-body-name:    "DM Sans";
  --weight-display: 700;
  --weight-body:    400;

  /* 中英混排标题的合成栈：西文走 display，中文落宋体系（文档派生值，非第三真源） */
  --font-heading: "DM Serif Display", "Source Han Serif SC", "Noto Serif SC", "Songti SC", serif;

  /* ── 字阶（公比 1.333，基准 17px，6 级封顶）── */
  --fs-xs: 13px;
  --fs-base: 17px;
  --fs-lg: 23px;
  --fs-xl: 30px;
  --fs-2xl: 40px;
  --fs-display: 72px;

  /* ── 行高 ── */
  --lh-xs: 1.75;
  --lh-base: 1.7;
  --lh-lg: 1.48;
  --lh-xl: 1.36;
  --lh-2xl: 1.22;
  --lh-display: 1.08;

  /* ── 字距 ── */
  --trk-display: 0.005em;
  --trk-heading: 0.0025em;
  --trk-body:    0em;
  --trk-label:   0.08em;

  /* ── 间距（基数 8px）── */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
  --space-6: 64px;
  --space-7: 96px;
  --space-8: 128px;

  /* ── 形状 ── */
  --radius-sm: 2px;
  --radius:    4px;
  --radius-lg: 8px;
  --shadow: none;

  /* ── 版心 ── */
  --measure: 1040px;
  --prose-width: 62ch;
  --gutter: 16px;

  /* ── 中轴 ── */
  --axis: left-rail;

  /* ── 动效（soft）── */
  --dur-fast: 180ms;
  --dur-normal: 320ms;
  --ease: cubic-bezier(.22,.61,.36,1);
}
```

## 视觉签名（≥3 条 · 结构级 · 灰度下仍成立）

1. 超大标题压过首屏 —— 首屏「老陈家面馆」（--fs-display 72px）与招牌面价格数字（--fs-2xl 40px）为全站最大字号
2. 章节编号超大字号当装饰 —— 菜单三区左侧 01 / 02 / 03 衬线大字（--fs-display 级、accent 26% 透明度），编号与标题同行错位
3. 引用块跨栏出血 —— 「一碗红烧牛肉面，街上吃了三代人。」pull quote 右缘撑出版心（桌面端越过 --measure 右边界 48px），accent 竖线标记
4. 首字下沉 —— 店史段首字「牛」下沉两行（::first-letter，衬线体，accent 色）

## never（锚点注册表 + 本站约束，逐条可检查）

- 科技/前沿定位（不出渐变霓虹、等宽中文标题、深色科技底）
- 需要高可读性的长文承载（本站正文仅两句店史，超长文本不进本站）
- 正文、列表、菜单行不居中（left-rail：全站 flush-left）
- 菜单不得增删菜品、价格不得改动（照菜单来，用户原话）
- 不出极限词（最/第一/国家级/顶级）、不出编造评价/销量/荣誉（食品合规）
- 不用 emoji / 装饰图标（iconPolicy 落地为 none；装饰仅纸纹底与衬线大字）
- 不做 Contact 区（邮箱/社交），到店信息三行不可折叠、不缩字号（≥12px）

## 字体加载

- `DM Serif Display` 400（latin）、`DM Sans` 可变 400–700（latin）：自托管 `site/assets/fonts/*.woff2`，`font-display: swap`
- 中文标题：系统宋体栈（Source Han Serif SC → Noto Serif SC → Songti SC → serif），不整包自托管 CJK（体积红线）
- 回退链验证：禁用网络后站点仍完整可读（系统 serif/sans 托底）
