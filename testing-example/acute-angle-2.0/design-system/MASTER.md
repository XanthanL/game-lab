# MASTER — 锐角 ACUTE ANGLE 2.0 设计系统

> skill 版本：**website-style-router v0.8.0**
> 本文件是 `tokens.css` 的可读副本，**逐值一致**（两处不一致即漂移）。
> v1 工程保留于 `../acute-angle/`（swiss-utility / white / Inter）；本 v2 为同锚点换组合的重做。

## 选型摘要

| 项 | 值 | 来源 |
|---|---|---|
| 锚点 | `swiss-utility` 瑞士实用主义（**第二次使用，换组合**） | v1 G2 落定沿用；铁律 32 |
| 族 | grid 网格理性族 | 无图硬约束收敛（intake 约束筛选，v2 全量重跑见 content-profile） |
| 布局原型 | `utility-board` | 锚点声明 |
| 中轴 | `left-rail` | 锚点声明 |
| **底色档** | **`ink`**（近黑 L 0.17，深底浅字） | G1.6 查重补救路径：white 已被 hongda-auto-repair 占用 |
| **变体轴** | **`a` 原值** | 见下方「两工具冲突记录」 |
| **字体对** | **grid 族备用池第 3 对「北欧理性」** | pair 0（Archivo/Inter）已被同锚点首次使用占用 |
| IA | conversion 单页（唯一动作 = 微信预约） | B2 转化目标（沿用） |
| 语言 | 中文为主 + 英文点缀，单语无切换 | G0 落定（沿用） |
| 图片 | **禁止**，全站靠排版撑 | G0 落定（沿用） |
| 图标 | functional（仅 `●` `○` `→`，禁 emoji） | 锚点声明 |
| 技术栈 | `plain-html`（pick_stack 判定，非技术维护者排除全部构建链） | Phase 1.5 / tech-stack.md |

## 批次查重记录（G1.6，`ledger.py --check` 实跑）

- **工具判定**：锚点 swiss-utility 已被 `hongda-auto-repair`（white / a / pair 0 / Inter）使用 → 高冲突，「不通过」。
- **工具自带补救路径**（查重输出原文）：「若必须保留该锚点：换组合 —— surface ∈ {deep, ink, slate}，variant ∈ {b,c,d}，pair ∈ {1,2,3}」。
- **本站采取**：surface → **ink** ✓、pair → **3** ✓、display 字体 → **Familjen Grotesk**（额外换掉身份权重最高的维度）；variant 保持 **a**，理由见下。
- **两工具冲突记录**：补救路径要求 variant ∈ {b,c,d}，但 `audit_tokens.py` 的 F5 签名一致性校验**不感知变体轴**——b/c/d 的间距基数（2/6/8px ≠ 签名 4px）与圆角（c/d ≠ 0px）必然判 F 级失败；铁律 25「F 级不为 0 = 没做完」优先。变体轴的差异化改由**底色 + 字体对 + display 字体 + 视觉签名组**承担（组合规则 5 要求签名组至少换 2 条，实际换 4 条，见下）。
- F11（交付前 `audit_tokens --batch`）无锚点检查项；display 唯一率不受本站影响（Familjen Grotesk 全库唯一）。

## Token

```css
:root {
  /* ── 颜色（ink 底，emit_tokens 按 WCAG 求解）── */
  --bg:          #110F09;
  --bg-soft:     #1F1C13;
  --fg:          #EFEDE7;              /* 对 --bg 16.3:1 */
  --muted:       #7E7B74;              /* 对 --bg 4.6:1 */
  --line:        rgba(255,255,255,.16);
  --accent:      #87AAF1;              /* 淡钴蓝（深底自动调亮），全页唯一强色块 */
  --accent-ink:  #4C78DA;              /* 对 --bg 4.6:1 */
  --accent-soft: rgba(135,170,241,.10);

  /* ── 反同质化指纹 ── */
  --surface: "ink";
  --variant: "a";

  /* ── 字体（具名搭配 · grid 族备用池第 3 对「北欧理性」）── */
  --font-display: "Familjen Grotesk", "Helvetica Neue", Arial, sans-serif;
  --font-body:    "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --font-cjk:     "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display-name: "Familjen Grotesk";
  --font-body-name:    "IBM Plex Sans";
  --weight-display: 600;
  --weight-body:    400;

  /* ── 字阶（r=1.2 / base=15 / 6 级）── */
  --fs-xs: 12px;  --fs-base: 15px;  --fs-lg: 18px;
  --fs-xl: 22px;  --fs-2xl: 26px;   --fs-display: 37px;

  /* ── 行高 ── */
  --lh-xs: 1.59; --lh-base: 1.54;  --lh-lg: 1.32;
  --lh-xl: 1.2;  --lh-2xl: 1.08;   --lh-display: 1.02;

  /* ── 字距 ── */
  --trk-display: 0em;  --trk-heading: 0em;
  --trk-body: 0em;     --trk-label: 0.08em;

  /* ── 间距（基数 4px）── */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* ── 形状 ── */
  --radius-sm: 0px; --radius: 0px; --radius-lg: 0px; --shadow: none;

  /* ── 版心 ── */
  --measure: 960px; --prose-width: 74ch; --gutter: 16px; --row-h: 44px;

  /* ── 中轴 ── */
  --axis: left-rail;

  /* ── 动效（snap）── */
  --dur-fast: 120ms; --dur-normal: 200ms; --ease: cubic-bezier(.2,0,.2,1);
}
```

## 有意偏离（相对签名 / spec）

| 字段 | 签名/spec | 实际 | 理由 |
|---|---|---|---|
| `--lh-base` | 1.5 | **1.54** | 中文为主，`typography.md` §2 汉字行间需上浮；+0.04 落在 F5 容差（±0.05）内；conversion 型正文段落 ≤3 行，无需 1.7+ 长文带（与 v1 同一特化） |
| `--lh-xs/lg/xl/2xl/display` | 1.55/1.28/1.16/1.08/1.02 | 1.59/1.32/1.2/1.08/1.02 | 随 `--lh-base` 按 `emit_tokens.py` 的 `leading()` 公式整体重算，阶梯单调 |
| 颜色来源 | spec（白底调色板） | **emit_tokens 按 `--surface ink` 求解的深底调色板** | swiss-utility 本地 spec 的配色写在白底前提下；`--surface ink` 是显式选定的底色维度，emit 按 WCAG 重新求解并自动调亮 accent（#87AAF1，8.2:1）。深底上沿用 spec 白色调色板会违反 F2 对比度判据 |
| 字体加载 | fonts.json `loading: "self"` | **自托管 woff2（Latin 子集，49KB）+ `--font-cjk` 系统栈** | 中文 webfont 体积不可接受；Latin 三族（Familjen Grotesk 600 / IBM Plex Sans 400 / IBM Plex Mono 400）自托管 + `font-display: swap` |
| 用法层字体组合 | — | `var(--font-display), var(--font-cjk)` 组合使用 | emit 的 `--font-display` 栈不含 CJK 回退；在 site.css 以变量拼接（不改 token 本体），保证中文标题落到 Noto Sans SC / 雅黑 |

## 视觉签名（≥3 条，F10 必查；转灰度全部成立）

1. **左侧固定标签栏（label rail）**：到店信息与台账的字段名列独占一窄列，与内容列之间以**通栏纵向细线**分隔（细线贯穿整个区块，不止一行）——见 `#visit .info-row dt` 的右缘竖线与 `#services` 编号列。
2. **大写等宽 KICKER + 延伸细线**：每区块头部为「编号 · 大写英文 + 中文」微标签行（`01 · SERVICES 服务`），文字右侧一条 1px 细线**延伸到版心右缘**（flex + ::after）——见各区块 `.kicker`。
3. **深底反白台账行**：服务行 hover 时底色升为 `--bg-soft`、行尾 `→` 由 `--muted` 变 `--accent`，零卡片零阴影——见 `#services .ledger-row:hover`。
4. **底色微差分区**：预约区整场使用 `--bg-soft`（深一档的黑）而非仅靠分割线，CTA 唯一强色块落场中央——见 `.block-booking`。
5. **等宽数字右对齐成列**：台账时长列 `tabular-nums` 右对齐，编号列等宽——见 `.ledger-row .dur`。

（组合规则 5 校验：v1 签名组 = 板头状态位 / 双语 kicker / 台账 hover 白底语法 / 虚线占位框；v2 换入 label rail、延伸细线、深底反白 hover、底色微差分区、数字右对齐，**换掉 4 条 ≥ 要求的 2 条**。）

## never（逐条可检查）

1. **禁居中标题**（`--axis: left-rail`，一切 flush-left）
2. **禁超过两档字重**（只用 400 / 600）
3. **禁装饰性图形、插画、渐变、hero 大图**（`imagePolicy: forbidden`，全站零图片；二维码占位框为功能位）
4. **禁大圆角**（全站 0px，含按钮）
5. **禁卡片阴影**（分区只用 1px `--line` 与底色微差）
6. **禁 emoji 图标**（功能符号仅 `●` `○` `→`）
7. **禁中文正文 `text-align: justify` 与 `font-style: italic`**
8. **禁中文正文正字距**（`--trk-body: 0`；正字距仅限大写英文微标签）
9. **禁各区块自定 max-width**（统一 `--measure: 960px`）
10. **禁第二个并列 CTA / 第二个强色块**（整页唯一动作 = 微信预约）
11. **禁编造实体信息**（缺失处一律 `[待填]` 可见标记）

## 排版规则速查

- 数字 / 时间 / 编号列一律 `--font-mono` + `font-variant-numeric: tabular-nums`；时长列右对齐
- 标题字体用法：`var(--font-display), var(--font-cjk)`；正文：`var(--font-body), var(--font-cjk)`
- 中英混排间距 ≥0.25em；标题上间距 : 下间距 ≥ 1.5 : 1；区块间距用 `--space-6/7/8`
- 移动端断点 720px：台账行转堆叠栅格，label rail 保持竖线
