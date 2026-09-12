# concrete-brutalist — token 骨架（由 signatures.json + fonts.json 确定性生成）

**族**：industrial ｜ **布局原型**：`utility-board` ｜ **中轴**：`left-rail` ｜ **image**：optional ｜ **icon**：none ｜ **密度**：compact
**底色档**：`stone`（命令行 --surface 指定）｜ **变体轴**：`a` 原值
**字体搭配**：`Archivo Black`（标题）× `Space Grotesk`（正文）—— 来源 锚点 `concrete-brutalist`

> **交付前先查批次账本**：`python scripts/ledger.py --check --anchor concrete-brutalist --surface stone` —— 若与同批次已交付的站撞车，换底色档或换变体轴，不要靠「看起来还行」蒙过去。

> 搭配理由：Archivo Black 的超粗块状字 + Space Grotesk 的粗粝正文，刻意不做『设计感』——反设计即主张。

> 本锚点**无本地 spec**，以下为签名生成结果 —— 它是**确定的、可复核的**设计参数，不是印象补全。
> 可在此之上做锚点特化，但**不要**改成「看起来更高级」的通用值，那正是 AI 均值味的来源。
> 要动字阶比 / 行高 / 行长三处，先读 `typography.md`。

```css
:root {
  /* ── 颜色（锚点 `concrete-brutalist` 签名 · 底色档 `stone` · 色相 0° / 彩度档 0 / 色温 -0.5）── */
  --bg:        #D5DFEA;   /* surface=stone · oklch(0.900 0.018 250) */
  --bg-soft:   #C8D5E4;
  --fg:        #1A1F24;   /* 对 --bg 对比度 12.4:1 */
  --muted:     #5D6269;   /* 对 --bg 对比度 4.6:1（正文下限 4.5） */
  --line:      rgba(0,0,0,.12);
  --accent:    #7E5662;   /* 强调 / 装饰；大字下限 3:1 = 4.6:1 */
  --accent-ink:#7C5862;   /* 可做正文链接，对比度 4.6:1 */
  --accent-soft: rgba(126,86,98,.10);

  /* ── 反同质化指纹（同批次内这三项都必须唯一）── */
  --surface:   "stone";   /* 底色档 */
  --variant:   "a";   /* 尺度变体轴：原值 */

  /* ── 字体（具名搭配 · 来源：锚点 `concrete-brutalist`）── */
  --font-display: "Archivo Black", "Arial Black", sans-serif;
  --font-body:    "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
  --font-mono:    "Space Mono", ui-monospace, Consolas, monospace;
  --font-cjk:     "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display-name: "Archivo Black";   /* 反同质化比对用：全库唯一 */
  --font-body-name:    "Space Grotesk";
  /* 搭配理由：Archivo Black 的超粗块状字 + Space Grotesk 的粗粝正文，刻意不做『设计感』——反设计即主张。 */
  --weight-display: 700;   /* 标题取重端 */
  --weight-body:    400;   /* 正文取轻端；字重总数 ≤2 */

  /* ── 字阶（公比 1.333，基准 16px，6 级封顶）── */
  --fs-xs: 12px;   /* 1.333^-1 × 16 = 12.0 */
  --fs-base: 16px;   /* 1.333^0 × 16 = 16.0 */
  --fs-lg: 21px;   /* 1.333^1 × 16 = 21.3 */
  --fs-xl: 28px;   /* 1.333^2 × 16 = 28.4 */
  --fs-2xl: 38px;   /* 1.333^3 × 16 = 37.9 */
  --fs-display: 67px;   /* 1.333^5 × 16 = 67.3 */

  /* ── 行高（字号越大越紧；CJK 主站整体上浮）── */
  --lh-xs: 1.55;
  --lh-base: 1.5;
  --lh-lg: 1.28;
  --lh-xl: 1.16;
  --lh-2xl: 1.08;
  --lh-display: 1.02;

  /* ── 字距 ── */
  --trk-display: -0.02em;   /* 大字负字距 */
  --trk-heading: -0.01em;
  --trk-body:    0em;
  --trk-label:   0.08em;   /* 全大写 / 微标签正字距 */

  /* ── 间距（基数 8px，全部为它的整数倍）── */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
  --space-6: 64px;
  --space-7: 96px;
  --space-8: 128px;

  /* ── 形状 ── */
  --radius-sm: 0px;
  --radius:    0px;
  --radius-lg: 0px;
  --shadow: none;   /* 用 --line 分区替代 */

  /* ── 版心 ── */
  --measure: 1080px;   /* 主容器；全站共用，禁止各区块自定 max-width */
  --prose-width: 62ch;   /* 正文列宽目标（45–75ch 之间才算合格） */
  --gutter: 16px;   /* 页面边距，独立于纵向节奏栅格 */

  /* ── 中轴（决定对齐策略，见 layouts.md）── */
  --axis: left-rail;

  /* ── 动效（性格：snap）── */
  --dur-fast: 120ms;
  --dur-normal: 200ms;
  --ease: cubic-bezier(.2,0,.2,1);
}
```

## never（来自锚点注册表，必须逐条遵守）

- 企业/医疗/金融等需信任背书
- 多语言（字宽失控）
- 柔和阴影

## 落地后必跑

```
python scripts/audit_tokens.py <你的 MASTER.md 或 tokens.css>
```

数值判据不过 = 没做完。判据清单见 `design-qa.md`。
