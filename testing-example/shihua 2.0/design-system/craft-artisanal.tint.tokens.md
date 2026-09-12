# craft-artisanal — token 骨架（由 signatures.json + fonts.json 确定性生成）

**族**：craft ｜ **布局原型**：`editorial-hero` ｜ **中轴**：`center-axis` ｜ **image**：required ｜ **icon**：none ｜ **密度**：balanced
**底色档**：`tint`（命令行 --surface 指定）｜ **变体轴**：`a` 原值
**字体搭配**：`Marcellus`（标题）× `Karla`（正文）—— 来源 锚点 `craft-artisanal`

> **交付前先查批次账本**：`python scripts/ledger.py --check --anchor craft-artisanal --surface tint` —— 若与同批次已交付的站撞车，换底色档或换变体轴，不要靠「看起来还行」蒙过去。

> 搭配理由：Marcellus 的罗马碑刻体有手工凿刻的痕迹，正对『人做的』；正文 Karla 保持朴素。

> 本锚点**无本地 spec**，以下为签名生成结果 —— 它是**确定的、可复核的**设计参数，不是印象补全。
> 可在此之上做锚点特化，但**不要**改成「看起来更高级」的通用值，那正是 AI 均值味的来源。
> 要动字阶比 / 行高 / 行长三处，先读 `typography.md`。

```css
:root {
  /* ── 颜色（锚点 `craft-artisanal` 签名 · 底色档 `tint` · 色相 55° / 彩度档 1 / 色温 +1.0）── */
  --bg:        #FAE9DD;   /* surface=tint · oklch(0.945 0.042 60) */
  --bg-soft:   #F4DECC;
  --fg:        #231D18;   /* 对 --bg 对比度 14.2:1 */
  --muted:     #706964;   /* 对 --bg 对比度 4.5:1（正文下限 4.5） */
  --line:      rgba(0,0,0,.12);
  --accent:    #944E12;   /* 强调 / 装饰；大字下限 3:1 = 5.3:1 */
  --accent-ink:#985C30;   /* 可做正文链接，对比度 4.6:1 */
  --accent-soft: rgba(148,78,18,.10);

  /* ── 反同质化指纹（同批次内这三项都必须唯一）── */
  --surface:   "tint";   /* 底色档 */
  --variant:   "a";   /* 尺度变体轴：原值 */

  /* ── 字体（具名搭配 · 来源：锚点 `craft-artisanal`）── */
  --font-display: "Marcellus", "Cormorant", serif;
  --font-body:    "Karla", "Inter", "PingFang SC", sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --font-cjk:     "LXGW WenKai", "Kaiti SC", "STKaiti", serif;
  --font-display-name: "Marcellus";   /* 反同质化比对用：全库唯一 */
  --font-body-name:    "Karla";
  /* 搭配理由：Marcellus 的罗马碑刻体有手工凿刻的痕迹，正对『人做的』；正文 Karla 保持朴素。 */
  --weight-display: 600;   /* 标题取重端 */
  --weight-body:    400;   /* 正文取轻端；字重总数 ≤2 */

  /* ── 字阶（公比 1.3，基准 17px，6 级封顶）── */
  --fs-xs: 13px;   /* 1.3^-1 × 17 = 13.1 */
  --fs-base: 17px;   /* 1.3^0 × 17 = 17.0 */
  --fs-lg: 22px;   /* 1.3^1 × 17 = 22.1 */
  --fs-xl: 29px;   /* 1.3^2 × 17 = 28.7 */
  --fs-2xl: 37px;   /* 1.3^3 × 17 = 37.3 */
  --fs-display: 63px;   /* 1.3^5 × 17 = 63.1 */

  /* ── 行高（字号越大越紧；CJK 主站整体上浮）── */
  --lh-xs: 1.8;
  --lh-base: 1.75;
  --lh-lg: 1.52;
  --lh-xl: 1.41;
  --lh-2xl: 1.27;
  --lh-display: 1.13;

  /* ── 字距 ── */
  --trk-display: -0.005em;   /* 大字负字距 */
  --trk-heading: -0.0025em;
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
  --radius-sm: 2px;
  --radius:    4px;
  --radius-lg: 8px;
  --shadow: none;   /* 用 --line 分区替代 */

  /* ── 版心 ── */
  --measure: 1080px;   /* 主容器；全站共用，禁止各区块自定 max-width */
  --prose-width: 62ch;   /* 正文列宽目标（45–75ch 之间才算合格） */
  --gutter: 16px;   /* 页面边距，独立于纵向节奏栅格 */

  /* ── 中轴（决定对齐策略，见 layouts.md）── */
  --axis: center-axis;

  /* ── 动效（性格：soft）── */
  --dur-fast: 180ms;
  --dur-normal: 320ms;
  --ease: cubic-bezier(.22,.61,.36,1);
}
```

## never（来自锚点注册表，必须逐条遵守）

- 工业化量产定位
- 无过程图

## 落地后必跑

```
python scripts/audit_tokens.py <你的 MASTER.md 或 tokens.css>
```

数值判据不过 = 没做完。判据清单见 `design-qa.md`。
