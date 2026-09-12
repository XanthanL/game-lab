# MASTER — 宏达汽修 2.0 设计系统

**skill 版本**：v0.8.0 ｜ **锚点**：`data-dense-app`（grid 族）｜ **布局原型**：`utility-board` ｜ **中轴**：`left-rail` ｜ **密度**：compact
**底色档**：`stone` ｜ **变体轴**：`a`（原值）｜ **字体对**：`pair 0`（锚点专属）
**imagePolicy**: optional（本站无图）｜ **iconPolicy**: functional ｜ **语言**: 纯中文（zh-CN）｜ **技术栈**: plain-html
**来源**：`scripts/emit_tokens.py --anchor data-dense-app --surface stone --variant a --pair 0 --lang zh`（签名 + fonts.json 确定性生成）。
**唯一真源**：`site/tokens.css`（本文件是其可读副本，逐值一致；改动须两处同步）。

```css
:root {
  /* ── 颜色（底色档 stone · 色相 255° / 彩度档 1 / 色温 +0.0）── */
  --bg:        #E1DED4;   /* surface=stone · oklch(0.900 0.014 90) */
  --bg-soft:   #D8D3C6;
  --fg:        #201E19;   /* 对 --bg 对比度 12.4:1 */
  --muted:     #64625A;   /* 对 --bg 对比度 4.6:1（仅用于 --bg 上的次要文字） */
  --line:      rgba(0,0,0,.22);   /* 生成值 .12 按 white 底校准，stone（L0.9）底上不可辨，按发丝线可见度加深一档 */
  --accent:    #3164A3;   /* 强调 / 装饰；大字下限 3:1 = 4.5:1 */
  --accent-ink:#396398;   /* 可做正文链接，对比度 4.6:1 */
  --accent-soft: rgba(49,100,163,.10);
  --danger:    #B3261E;   /* 仅用于 [待填] 占位标记；对 --bg 11.7:1 */

  /* ── 反同质化指纹 ── */
  --surface:   "stone";
  --variant:   "a";

  /* ── 字体（具名搭配 · 锚点 data-dense-app · pair 0）── */
  --font-display: "Barlow Condensed", "Roboto Condensed", sans-serif;
  --font-body:    "IBM Plex Sans", "Inter", "PingFang SC", sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --font-cjk:     "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display-name: "Barlow Condensed";
  --font-body-name:    "IBM Plex Sans";
  /* 派生栈（R4 中西混排；由生成 token 组合，非手填值） */
  --font-display-mixed: "Barlow Condensed", "Roboto Condensed", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-body-mixed:    "IBM Plex Sans", "Inter", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --weight-display: 600;
  --weight-body:    400;

  /* ── 字阶（公比 1.167，基准 14px，6 级封顶）── */
  --fs-xs: 12px;
  --fs-base: 14px;
  --fs-lg: 16px;
  --fs-xl: 19px;
  --fs-2xl: 22px;
  --fs-display: 30px;

  /* ── 行高 ── */
  --lh-xs: 1.5;
  --lh-base: 1.45;
  --lh-lg: 1.23;
  --lh-xl: 1.14;
  --lh-2xl: 1.08;
  --lh-display: 1.02;

  /* ── 字距 ── */
  --trk-display: 0.0em;
  --trk-heading: 0.0em;
  --trk-body:    0em;
  --trk-label:   0.08em;

  /* ── 间距（基数 4px）── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* ── 形状（rad=2 近直角）── */
  --radius-sm: 2px;
  --radius:    2px;
  --radius-lg: 4px;
  --shadow: none;

  /* ── 版心与行 ── */
  --measure: 1280px;
  --prose-width: 80ch;
  --gutter: 16px;
  --row-h: 44px;
  --rail-w: 64px;
  --price-w: 88px;

  /* ── 中轴 ── */
  --axis: left-rail;

  /* ── 动效（snap）── */
  --dur-fast: 120ms;
  --dur-normal: 200ms;
  --ease: cubic-bezier(.2,0,.2,1);
}
```

## 视觉签名（≥3 条结构级手法，渲染结果里可指出；转灰度仍成立）

1. **通栏细线网格**：价目区每行的分类栏右缘与价格栏左缘各有一条 1px 竖线（`--line`），自表头贯通至表尾——见渲染结果价目表区各行的竖向分隔。竖线贯通依赖价格列**固定宽**（`--price-w: 88px`）：每行是独立 grid 容器，若价格列用 `auto`，其左缘会随各行内容宽度逐行内收成锯齿。
2. **等宽数字右对齐成列**：价格列 IBM Plex Mono + `tabular-nums`、`justify-content: flex-end`，12 行价格右缘齐平成一条线——见价目列最右侧。
3. **固定行高台账行**：全部行 `min-height: --row-h (44px)` 等高，扫读节奏不随备注增减跳动——见价目 12 行等高。
4. **左侧固定标签栏（label rail）**：每行行首 64px（窄屏 56px）窄列放分类标签（保养/刹车/轮胎/电瓶/空调/救援/清洗），相邻同分类合并显示，独占一列——见价目区最左列。

## never（可检查项，逐条可判）

- 营销展示话术（无主张文案、无卖点罗列、无情感诉求——本页只有价格/时间/地址事实 + 拨号）
- 居中标题（一切 flush-left，`--axis: left-rail`）
- 超过两个字重（400 / 600）
- 装饰性图形、插画、渐变、阴影（`--shadow: none`，分区只用 1px 线）
- 大圆角（`--radius: 2px`）
- 中文正文加正字距 / `text-align: justify` / `font-style: italic`
- 让中文字体渲染西文（西文归 Barlow Condensed / IBM Plex，中文归 --font-cjk，见派生栈）
- 内容硬编码散落（数据只能来自 `site/data.js` 一个文件）
- 表单类输入控件（转化动作只有拨号一个）
- 状态只靠颜色传达（营业/休息带文字标签）

## 字体加载（plain-html 落地约束）

- 自托管 woff2（latin 子集）于 `site/assets/fonts/`：Barlow Condensed 600（22KB）、IBM Plex Sans 400/600（23+24KB）、IBM Plex Mono 400（15KB），合计 84KB；`font-display: swap`。
- CJK 走系统栈（--font-cjk），不加载中文字库（几 MB 字库会拖垮首屏，fonts.json loading 图例）。
- 运行时零第三方请求，适配中国大陆访问。

## 基准字号说明

签名 base=14px 为 data-dense-app 的紧凑工具基准，audit F3 以 14 为中文下限；若用户反馈偏小，
可在 F5 容差（±1px）内整体上调至 15px 并同步 MASTER/tokens 两处，不可只改一处。
