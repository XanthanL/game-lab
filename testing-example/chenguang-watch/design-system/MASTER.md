# MASTER — 辰光修表铺 · 设计系统（可读副本）

> 唯一真源：[`../css/tokens.css`](../css/tokens.css)。本文件为可读副本，两者必须逐值一致（审计 F18）。
> 骨架由 `emit_tokens.py --anchor editorial-hero --surface paper --variant c --pair 0` 生成；
> 颜色与字体按品牌卡覆盖，派生关系见下。

## token 全量（与 tokens.css `:root` 逐值一致）

```css
:root {
  /* 颜色（品牌卡覆盖：浅金 #C8A96B / 墨黑 #1A1A1A / 纸质米白 #F7F4EE） */
  --bg:        #F7F4EE;
  --bg-soft:   #EFE9DB;
  --fg:        #1A1A1A;
  --muted:     #716C5C;
  --line:      rgba(26,26,26,.14);
  --accent:      #8A6C39;   /* 浅金同色相加深：纸上强调（浅金原值 2.07:1 不可作纸上文字） */
  --accent-ink:  #7E6234;   /* 链接金 */
  --accent-soft: rgba(138,108,57,.10);
  --gold:      #C8A96B;   /* 品牌浅金：只用于墨黑面文字与装饰线框 */
  --ink:       #1A1A1A;
  --on-ink:    #F7F4EE;
  --on-ink-muted: rgba(247,244,238,.72);

  /* 反同质化指纹 */
  --surface: "paper";
  --variant: "a";

  /* 字体（品牌卡 L15-16 覆盖注册表默认 Playfair Display） */
  --font-display: "EB Garamond", Georgia, "Times New Roman", serif;
  --font-body: "Lora", Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --font-cjk: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
  --font-display-name: "EB Garamond";
  --font-body-name: "Lora";
  --weight-display: 700;
  --weight-body: 400;

  /* 字阶（公比 1.414，基准 18px） */
  --fs-xs: 13px;
  --fs-base: 18px;
  --fs-lg: 25px;
  --fs-xl: 36px;
  --fs-2xl: 51px;
  --fs-display: 72px;

  /* 行高 */
  --lh-xs: 1.8;
  --lh-base: 1.75;
  --lh-lg: 1.52;
  --lh-xl: 1.41;
  --lh-2xl: 1.27;
  --lh-display: 1.13;

  /* 字距 */
  --trk-display: -0.02em;
  --trk-heading: -0.01em;
  --trk-body: 0em;
  --trk-label: 0.08em;

  /* 间距（基数 8px） */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
  --space-6: 64px;
  --space-7: 96px;
  --space-8: 128px;

  /* 形状（印刷直角） */
  --radius-sm: 0px;
  --radius: 0px;
  --radius-lg: 0px;
  --shadow: none;

  /* 版心 */
  --measure: 1080px;
  --prose-width: 60ch;
  --gutter: 16px;

  /* 中轴 */
  --axis: center-axis;

  /* 动效（soft） */
  --dur-fast: 180ms;
  --dur-normal: 320ms;
  --ease: cubic-bezier(.22,.61,.36,1);
}
```

## 一句话

一张「有态度的社论开头」式老铺页面：墨黑招牌面压首屏，纸质米白承载印刷语法的价目与图文，浅金只出现在墨面上——像把店内招牌与双语名片排版上网。

## 中轴

`--axis: center-axis` —— hero（招牌）、区块标题、图注居中；**正文、价目行、NAP 一律左对齐**（中文超过三行居中极难读）。

## 底色档与变体轴

- `--surface: "paper"`（纸质米白 #F7F4EE，品牌卡 L12 覆盖预设值 oklch(0.975 0.011 90) → 实测 ≈0.956，同档族）
- `--variant: "a"`（签名原值轴：本批次首次使用 editorial-hero，取原值档；基准 18px / 行高 1.75 / 间距栅格 8px / 圆角全 0——直角更贴「印刷与招牌」气质。手机可读性由 18px 基准、1.75 行高与 25px 价目数字承担，已满足「价目看清」优先级）

## 颜色（品牌卡三色 + 派生规则）

| token | 值 | 来源 |
|---|---|---|
| `--bg` | #F7F4EE | 品牌卡 L12 纸质米白（店内墙面） |
| `--fg` / `--ink` | #1A1A1A | 品牌卡 L11 墨黑（招牌底色） |
| `--gold` | #C8A96B | 品牌卡 L10 浅金（招牌烫金）——**只用于墨黑面文字与装饰线框**（对 --ink 7.7:1） |
| `--accent` | #8A6C39 | **派生**：浅金同色相加深（纸上价格/编号/大字强调，对 --bg ≈4.5:1）。理由：浅金在米白底仅 2.07:1，不能作纸上文字；印刷实践中烫金压纸面也做加深处理 |
| `--accent-ink` | #7E6234 | **派生**：链接/小字强调金（对 --bg ≈5.3:1） |
| `--muted` | #716C5C | 派生暖灰（对 --bg ≈4.8:1，恰好过 4.5 下限） |
| `--bg-soft` | #EFE9DB | 米白加深一档（面板/图框底） |
| `--on-ink` / `--on-ink-muted` | #F7F4EE / rgba(247,244,238,.72) | 墨底文字对 |

WCAG：fg 15.9:1 · muted 4.8:1 · accent 4.5:1 · accent-ink 5.3:1 · gold(on-ink) 7.7:1。

## 字体搭配（品牌卡覆盖注册表默认，理由可溯源）

| token | 值 | 来源 |
|---|---|---|
| `--font-display` | `"EB Garamond", Georgia, "Times New Roman", serif` | 品牌卡 L15「类似 Garamond 的老式感觉」。注册表默认 Playfair Display 被品牌卡显式推翻（fonts.json 审计按 info 记录偏离）；EB Garamond 作 display 首族在 40 锚点全库唯一 |
| `--font-body` | `"Lora", Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif` | Lora 沿用注册表锚点条目正文；中文栈在注册表 zh-serif 基础上补 `"SimSun"`（Windows 全覆盖的老宋体，A 类实现细节） |
| `--font-mono` | IBM Plex Mono 栈 | 注册表 plex（价格数字实际用 body 的 tabular-nums，mono 仅备用） |
| `--font-cjk` | `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif` | 品牌卡 L16「中文是老宋体」；中文**不自托管 webfont**（3–8MB 拖垮首屏，typography.md §0） |
| 字重 | display 700 / body 400（总数 ≤2） | 西文自托管 latin woff2 共 65KB，`font-display: swap`，preload |

## 字阶 / 行高 / 字距 / 间距 / 版心

- 字阶（公比 1.414，基准 18px）：`--fs-xs 13 · base 18 · lg 25 · xl 36 · 2xl 51 · display 72`
- 行高：`xs 1.8 · base 1.75 · lg 1.52 · xl 1.41 · 2xl 1.27 · display 1.13`（无单位）
- 字距：display **-0.02em** · heading -0.01em · body 0 · label（全大写微标签）+0.08em
- 间距：基数 8px → 8/16/24/32/48/64/96/128
- 版心：`--measure 1080px`（全站唯一容器宽）；正文列 `--prose-width 60ch`；`--gutter 16px`
- 形状：圆角全 0（印刷直角流派），`--shadow: none`（用 1px `--line` 分区）
- 动效：`--dur-fast 180ms / --dur-normal 320ms / --ease cubic-bezier(.22,.61,.36,1)`；尊重 `prefers-reduced-motion`
- 响应式：店名 `clamp(44px, 17.5vw, 72px)`（5 个汉字在 320px 宽不溢出、无孤字）；手机正文基准不变（18px）

## 视觉签名（≥3 条结构级手法，渲染结果中可指出）

1. **超大标题压过首屏** —— hero 墨黑面上「辰光修表铺」以 `--fs-display`（clamp 至 72px 上限）浅金呈现，占首屏约 60% 高度；关闭颜色后（灰度）结构不变。
2. **单一主 CTA + 次要文字链接** —— hero 末尾仅一枚描边按钮「查看服务与价目」+ 一条文字链「到店信息」，无并列按钮组（锚点 never「多个并列 CTA」）。
3. **图文交错左右交替** —— 手艺区两张微距照桌面端左/右交替、窄屏退化为单列（editorial-hero 签名④）。
4. **大标题负字距收紧** —— 店名与区块标题分别取 -0.02em / -0.01em（签名⑤，可在任意大标题上量出）。
5. **章节编号超大装饰** —— 各区块 kicker 行用「01 / 02 / 03 / 04 / 05」EB Garamond 大号深化金数字压在标题上方，行内目录沿用同一编号（签名⑧）。

## never 清单

- 多个并列 CTA（锚点 never）
- 行宽 >75ch；各区块自定 max-width（全站只用 `--measure`）
- 中文正文 `text-align: justify`；中文斜体；中文正文正字距
- center-axis 下把正文段落/价目行/表格居中（只有 hero、标题、图注居中）
- 圆角 >6px、重阴影（印刷直角气质）
- 低质配图（editorial 族 never）：图未到位用占位框，不上手机随拍
- 超过两种西文字族；中文字体渲染西文数字（价格用 tabular-nums 西文栈）
- 极限词与编造承诺（「最专业」「修不好不收钱」等源里没有的一律不写）

## 批次指纹

锚点 `editorial-hero`（editorial 族）· 底色档 paper · 变体 c · 中轴 center-axis · display `EB Garamond` —— 与同批次 yuguang-photo（soft-organic / craft / tint / a / center-axis / Baloo 2）全部错开，`ledger.py --check` 通过。
