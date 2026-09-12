# MASTER — 拾花 2.0 · 设计系统（tokens.css 的可读副本，逐值一致）

**锚点**：`craft-artisanal` 手作工艺 ｜ **族**：craft ｜ **布局**：editorial-hero ｜ **中轴**：`--axis: center-axis` ｜ **底色档**：`tint` ｜ **变体轴**：`a` 原值 ｜ **image**: required（8 图全上）｜ **icon**: none ｜ **密度**: balanced

> skill 版本 v0.8.0 ｜ 唯一真源 = [`tokens.css`](tokens.css)（emit_tokens.py --anchor craft-artisanal --surface tint 生成，零手编）
> 字体搭配来源 `styles/fonts.json` 锚点条目：Marcellus 的罗马碑刻体有手工凿刻的痕迹，正对『人做的』；正文 Karla 保持朴素。

```css
:root {
  --bg:        #FAE9DD;
  --bg-soft:   #F4DECC;
  --fg:        #231D18;
  --muted:     #706964;
  --line:      rgba(0,0,0,.12);
  --accent:    #944E12;
  --accent-ink:#985C30;
  --accent-soft: rgba(148,78,18,.10);

  --surface:   "tint";
  --variant:   "a";

  --font-display: "Marcellus", "Cormorant", serif;
  --font-body:    "Karla", "Inter", "PingFang SC", sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --font-cjk:     "LXGW WenKai", "Kaiti SC", "STKaiti", serif;
  --font-display-name: "Marcellus";
  --font-body-name:    "Karla";
  --weight-display: 600;
  --weight-body:    400;

  --fs-xs: 13px;  --fs-base: 17px;  --fs-lg: 22px;
  --fs-xl: 29px;  --fs-2xl: 37px;   --fs-display: 63px;

  --lh-xs: 1.8;  --lh-base: 1.75;  --lh-lg: 1.52;
  --lh-xl: 1.41; --lh-2xl: 1.27;   --lh-display: 1.13;

  --trk-display: -0.005em;  --trk-heading: -0.0025em;  --trk-body: 0em;  --trk-label: 0.08em;

  --space-1: 8px;  --space-2: 16px; --space-3: 24px; --space-4: 32px;
  --space-5: 48px; --space-6: 64px; --space-7: 96px; --space-8: 128px;

  --radius-sm: 2px; --radius: 4px; --radius-lg: 8px; --shadow: none;

  --measure: 1080px;  --prose-width: 62ch;  --gutter: 16px;

  --axis: center-axis;

  --dur-fast: 180ms;  --dur-normal: 320ms;  --ease: cubic-bezier(.22,.61,.36,1);
}
```

## 视觉签名（≥3，渲染结果可指认，灰度存活）

1. **63px 楷体「拾花」居中压首屏** —— 首屏正中，`--font-cjk` display 档全站唯一超大使用（hero h1）。
2. **图文左右交替交错** —— 手作/花目/店里区块的双列行（figure+prose）按奇偶互换图位：第 02 块图左、第 03 块图右、第 04 块图左。
3. **手作宣言跨栏引言** —— 「手作」区块的引言块向左出血 64px（超出正文列起点，仍留视口内），楷体 `--fs-xl`。

## 使用规则（可检查）

- 所有区块共用 `--measure: 1080px`，禁止各自为政的 max-width；正文列 `min(var(--prose-width), 100%)`。
- **center-axis**：hero、通栏图、引言居中或按交替轴；**正文/列表/表格一律左对齐**。
- 图与图注同轴：居中图的图注居中，列内图的图注随图对齐。
- 价格/规格/日期数字：`var(--font-mono)` + `font-variant-numeric: tabular-nums`。
- 中文正文 `letter-spacing: 0`；禁 justify、禁 italic。
- 图片三档宽：**320 / 520 / 880**（小图/列图/通栏图），移动端一律 `min(档位, 100%)`。
- 移动端（≤640px）：正文 16px；hero 拾花限幅 48px（两字品牌无孤字风险）；间距降一档。
- 字体自托管（loading=self）：`assets/fonts/*.woff2` + `font-display: swap`；霞鹜文楷为按页面用字子集。

## never（锚点红线 + 批次红线，逐条可查）

- never: 工业化量产定位的话术（流水线/量产/标准化输出）
- never: 无过程图（手作区块必须保留 ba6b5d64 过程图）
- never: 装饰性纹样、emoji 图标、渐变、发光、阴影（分区用 `--line`）
- never: `transition: all`
- never: 编造价格、花目、地址、电话、评价、销量（缺失一律 `[待填]` + 红虚线框；AI 价签文字不采信）
- never: 极限词（最 / 第一 / 国家级 / 顶级）
- never: 正文/列表/表格居中（center-axis 下正文仍左对齐）
- never: 与批次内 1.0 共用锚点 / display 字体 / 底色档（provisions-label / Inter / white 已占用）

## 与签名的有意偏离（audit 豁免登记）

- **标题字重取 400**：签名 `wts=400,600` 且 token 保留 `--weight-display: 600`，但 display 家族（Marcellus、霞鹜文楷）均为单字重，600 会触发伪粗发虚；600 实际用于 Karla 的标签/CTA。依据：字体家族真实字重表。
- **移动端 hero 限幅 48px**（非 34px）：「拾花」仅两字，63px 在 375px 下宽 126px 无溢出孤字风险；48px 兼顾压屏与留白。依据 typography.md §1 注 3 的意图（防长标题溢出）。
- 霞鹜文楷按页面用字子集化自托管（全量 19MB 不可上线；子集为本栈 loading=self 的实现方式）。

## 证伪条件（G2 落定时的 3 条）

1. 若店主拿到真实门店照片并要求替换后仍保留「AI 意象」区块 → 无问题；若要求全站只用实拍且短期拿不到 → 图片策略降级回 1.0 的占位模式，craft-artisanal 的 image required 前置塌了，需重评锚点。
2. 若花目长到 20+ 且要按场景（婚礼/开业/探病）筛选 → editorial-hero 单页装不下，应回 G1 重收敛（product-catalog × astro）。
3. 若店主说「店里其实是批发档口，不是手作工作室」 → 『人做的』主张失真，craft-artisanal 证伪，回 G0 重问内容支撑力。
