# MASTER — 麦芒手作 2.0 设计系统

锚点 **market-stall**（commerce 族 ｜ 布局 `editorial-hero` ｜ 密度 balanced ｜ image required ｜ icon functional）。
**底色档 `tint` ｜ 变体轴 `d` 张扬 ｜ 字体对 pair 0：Zilla Slab × Karla × Roboto Mono × zh-sans。**
本文件是 `styles/tokens.css` 的可读副本，**两者逐值一致**；生效真源是 tokens.css。
skill 版本 **0.8.0**；1.0（v0.6.0）产物保留于 `../maimang-site/`，本页为同批次的反同质化重做版。

## 中轴覆盖记录

- **`--axis: center-axis`**（锚点注册表默认 `left-rail`；批次内第 2 次使用 center-axis，处于 ≤2 上限内）。
- **偏离理由**：用户硬约束"把大标语放到首页正中间"，属宣言型 hero 居中，`layouts.md` 明示 editorial-hero 存在 center-axis 变体。`ledger.py --check` 判为中冲突并建议改 split——用户指令优先于查重建议，予以保留并记录。
- **边界**：仅 hero（标语/价格行/CTA）与其下产品图居中；**正文、列表、表格、产品卡、合规表一律左对齐**（never：居中正文）。图与图注同轴。

## 字体搭配（F6 · fonts.json 锚点主选）

| 角色 | 值 | 说明 |
|---|---|---|
| `--font-display` | Zilla Slab（首族）→ Roboto Slab → Noto Sans SC → … | 方肩衬线像手写价签；具名、全库唯一 |
| `--font-body` | Karla（首族）→ Inter → Noto Sans SC → … | 朴素怪诞体承接市井气；与 display 不同族（R2 分离） |
| `--font-mono` | Roboto Mono → ui-monospace → … | 价格/微信号/截单时间，tabular 数字 |
| `--font-cjk` | Noto Sans SC → PingFang SC → Microsoft YaHei | 显式 CJK 回退（R4）；汉字不渲染西文 |
| 加载 | **self 自托管** `assets/fonts/*.woff2` 共 52KB + `font-display: swap` + preload | `fonts.json loading: self`；不用 CDN（大陆微信内不可靠）；中文走系统栈（中文字库 3–8MB 不进首屏） |
| 字重 | 700（display）/ 400（body）共 2 档（R5） | 只加载用到的字重 |

## 视觉签名（F10 · ≥3 条结构级手法，灰度下成立）

1. **超大标题压过首屏** —— h1 87px（变体 d 公比 1.37 生成），首屏高度的约 1/3；375px 下 40px 居中单行。位置：首屏正中。
2. **章节编号当超大装饰** —— 每个区块 h2 前的 01/02/03/04：Zilla Slab 700、46px（移动端 30px）、橄榄绿，比标题文字更大。位置：四个区块标题左侧。
3. **单一主 CTA + 次要文字链接** —— 全页仅一个按钮（首屏「加微信下单」）；下单区微信号是下划线文字链接（点击复制），无第二按钮。位置：首屏 vs 下单区。
4. **大标题负字距收紧** —— h1 `letter-spacing: -0.015em`（typography.md 中文标题 ≥32px 带 0~-0.02em）。位置：首屏大标题。

签名组合与同批次 1.0（无签名段）及账本其余站点均不相同（组合规则 1）。

## Token（与 tokens.css 逐值一致）

```css
:root {
  --bg:         #F8EADF;   /* tint 档 · 对 fg 14.2:1 */
  --bg-soft:    #FBDCC3;
  --fg:         #231D18;   /* 14.2:1 */
  --muted:      #706964;   /* 4.6:1 ≥4.5 */
  --line:       rgba(0, 0, 0, 0.12);
  --accent:     #4E6F23;   /* 4.9:1 ≥3；麦叶橄榄绿，全站唯一高饱和色 */
  --accent-ink: #567336;   /* 4.6:1 ≥4.5，可作正文链接 */
  --accent-soft: rgba(78, 111, 35, 0.10);

  --surface:    "tint";
  --variant:    "d";

  --font-display: "Zilla Slab", "Roboto Slab", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", serif;
  --font-body:    "Karla", "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono:    "Roboto Mono", ui-monospace, Consolas, monospace;
  --font-cjk:     "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display-name: "Zilla Slab";
  --font-body-name:    "Karla";
  --weight-display: 700;
  --weight-body:    400;

  --fs-xs: 13px;  --fs-base: 18px;  --fs-lg: 25px;
  --fs-xl: 34px;  --fs-2xl: 46px;   --fs-display: 87px;

  --lh-xs: 1.7;  --lh-base: 1.65;  --lh-lg: 1.43;
  --lh-xl: 1.31; --lh-2xl: 1.17;   --lh-display: 1.03;

  --trk-display: -0.015em;  --trk-heading: 0em;
  --trk-body: 0em;          --trk-label: 0.08em;

  --space-1: 16px;  --space-2: 32px;  --space-3: 48px;  --space-4: 64px;
  --space-5: 96px;  --space-6: 128px; --space-7: 192px; --space-8: 256px;

  --radius-sm: 8px;  --radius: 16px;  --radius-lg: 24px;  --shadow: none;

  --measure: 1120px;  --prose-width: 60ch;  --gutter: 16px;

  --axis: center-axis;

  --dur-fast: 300ms;  --dur-normal: 600ms;  --ease: cubic-bezier(0.16, 0.84, 0.24, 1);

  --card: #FFFFFF;
}
```

## 数值来源与特化说明（F5/F6 相关）

**F5 审计口径备注（v0.8.0 工具缺口）**：`audit_tokens.py --anchor` 比对的是**原始签名**（base 16 / r 1.25 / unit 8 / rad 8），未感知 `--variant d`；而 `emit_tokens.py --variant d` 生成的是变体修正值（base 18 / r 1.37 / unit 16 / rad 16）。已做补偿验证：按 `_variantAxes.d` 手工重算期望值（base 18 / r 1.40 / unit 16 / rad 16）与 tokens 逐值比对——**全部一致（PASS）**。因此 `--anchor` 模式下报的 5 条 F5 中：4 条是变体轴 d 的确定性产物（非手工调参），1 条是中轴用户覆盖（见上）。除中轴外无任何手工偏离。

| 项 | 值 | 来源 |
|---|---|---|
| 全部颜色 / 字阶 / 行高 / 间距 / 圆角 / 版心 / 动效 | 上表 | `emit_tokens.py --anchor market-stall --surface tint --variant d` 确定性输出 |
| 字体栈尾的 CJK 显式回退 | 并入 display/body | R4（显式 CJK 回退，防通用 serif 抢接汉字）；F6 首族仍为具名字体 |
| `--trk-display: -0.015em`（脚本原值 0em） | 带内调整 | typography.md §3 中文标题 ≥32px 带 0~-0.02em；同时满足 I7"大字负"与视觉签名 4 |
| `--axis: center-axis`（脚本原值 left-rail） | 有意偏离 | 见"中轴覆盖记录" |
| `--card: #FFFFFF` | 锚点特化 | 无本地 spec，`_specFallback` 允许特化；货摊卡片白承载产品卡与照片位，非第二个高饱和色 |
| 移动端覆盖 | base 16px、display 40px、2xl 30px、xl 26px、lg 20px | typography.md：base 减档 + 头图标题以"375px 单行无孤字"为限（87px 的 8 字标语 375px 下 40px 单行）；写在页面样式，不改 tokens.css 真源 |

## never（可检查清单）

> **2026-09-12 修订**：用户声明店铺为明示虚构创作（梦境工坊企划）。下表中「疾病宣称 / 极限词 / 编造评价与销量 / 合规信息」四条内容类红线，在该明示虚构语境下修订为：**保持虚构可见性**（页面三处虚构声明 + 许可证号带「（虚构编号）」标记 + 幻想文案自明）；真实交易信息（微信号 / 价格 / 真实过敏原 / 3 日食用期）仍须真实。结构类 never 不变。
- never: 精致奢感取向（烫金/衬线大留白高级感套路）；SKU 筛选层
- never: 居中正文（center-axis 下正文/表格/列表一律左对齐）
- never: 折叠、隐藏或以 <12px 呈现合规信息
- never: 疾病预防或治疗功能宣称（健脾/养胃/控糖/增强免疫等）
- never: 极限词（最 / 第一 / 国家级 / 顶级 / 必备）
- never: 编造评价与销量（含"月销/回头率"类不可核实数据）
- never: 第二个高饱和色（accent 系除外）
- never: 用氛围大图替代产品图（占位必须标明"产品图"）
- never: `transition: all`；emoji 当图标；无意义渐变/发光/模糊
- never: 首屏三等分卡片阵
- never: 中文正文 `text-align: justify` 或 `font-style: italic`；中文正文加正字距
- never: 各区块自定 max-width（只准用 `--measure`）
- never: `@import` 加载字体（用 preload + font-display: swap）

## 纵向节奏

- 标题上间距 : 下间距 ≥ 1.5 : 1；区块间距用 `--space-5/6`（基数 16 的栅格）
- 分区靠 1px `--line` 与 `--bg-soft` 通栏（零阴影流派）
- 价格、微信号、截单时间用 `--font-mono` + `font-variant-numeric: tabular-nums`
