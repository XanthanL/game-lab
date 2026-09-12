# design-system · MASTER — 铜管与滤芯 · 祖安呼吸安全站

**族**：industrial ｜ **锚点**：`concrete-brutalist` 混凝土粗野 ｜ **布局原型**：`utility-board` 信息扫读板 ｜ **中轴**：`--axis: left-rail` ｜ **image**: optional（无素材 → SVG 线稿）｜ **icon**: none（状态用文字标签）｜ **密度**: compact
**底色档**：`stone`（签名推荐）｜ **变体轴**：`a` 原值 ｜ **字体对**：`Archivo Black` × `Space Grotesk` × `Space Mono`（mono）× zh-sans（CJK 回退，加载：西文自托管 woff2 + 中文系统栈）
> 搭配理由：Archivo Black 的超粗块状字 + Space Grotesk 的粗粝正文，刻意不做『设计感』——反设计即主张。
> 唯一真源：`design-system/tokens.css`（本文件为其可读副本，逐值一致）。

## 锚点特化（均有据，非「看起来更高级」）

1. **强调色**：生成器默认灰紫改为需求文档 §3 品牌主色 —— `--accent` 铜锈 `#8A3E1C`（5.6:1）、`--accent-ink` 滤芯蓝 `#1E4A73`（6.8:1）、`--ok` 废土绿 `#285440`（6.4:1）、`--warn` 警告黄 `#FFCE00` 仅作底/条纹（其上文字恒用 `--fg`，11.1:1）、警示框 `--hazard-bg` × `--hazard-fg`（12.0:1）。全部过 WCAG（脚本 F2 实测）。
2. **`--lh-prose: 1.75`**：签名 `--lh-base: 1.5` 是拉丁带；本站中文为主，长段落按 typography.md §2 中文带 1.7–1.95 设独立 token；台账行/短句仍用 1.5 保持扫读节奏（F5 校验的 `--lh-base` 保持签名原值）。
3. **`--weight-display: 400`**：Archivo Black 为原生单字重家族，声明 700 会触发浏览器仿粗体。
4. **`--row-h: 48px`**：签名 5「固定行高台账行」的载体，6 × 8px 栅格。

## Token（与 tokens.css 逐值一致）

```css
:root {
  --bg:        #D5DFEA;              /* stone 底 · oklch(0.900 0.018 250) 混凝土冷灰 */
  --bg-soft:   #C8D5E4;
  --fg:        #1A1F24;              /* 对 --bg 12.3:1 */
  --muted:     #5D6269;              /* 对 --bg 4.6:1 */
  --line:      rgba(0,0,0,.12);
  --line-strong: #1A1F24;
  --accent:    #8A3E1C;              /* 铜锈 · 5.6:1 */
  --accent-ink:#1E4A73;              /* 滤芯蓝 · 6.8:1 */
  --accent-soft: rgba(138,62,28,.10);
  --ok:        #285440;              /* 废土绿 · 6.4:1 */
  --warn:      #FFCE00;
  --hazard-bg: #14181C;
  --hazard-fg: #FFCE00;

  --surface:   "stone";
  --variant:   "a";

  --font-display: "Archivo Black", "Arial Black", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-body:    "Space Grotesk", "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono:    "Space Mono", ui-monospace, Consolas, monospace;
  --font-cjk:     "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display-name: "Archivo Black";
  --font-body-name:    "Space Grotesk";
  --weight-display: 400;
  --weight-body:    400;

  --fs-xs: 12px;
  --fs-base: 16px;
  --fs-lg: 21px;
  --fs-xl: 28px;
  --fs-2xl: 38px;
  --fs-display: 67px;

  --lh-xs: 1.55;
  --lh-base: 1.5;
  --lh-lg: 1.28;
  --lh-xl: 1.16;
  --lh-2xl: 1.08;
  --lh-display: 1.02;
  --lh-prose: 1.75;

  --trk-display: -0.02em;
  --trk-heading: -0.01em;
  --trk-body:    0em;
  --trk-label:   0.08em;

  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;
  --space-6: 64px;
  --space-7: 96px;
  --space-8: 128px;

  --radius-sm: 0px;
  --radius:    0px;
  --radius-lg: 0px;
  --shadow: none;

  --measure: 1080px;
  --prose-width: 62ch;
  --gutter: 16px;

  --row-h: 48px;

  --axis: left-rail;

  --dur-fast: 120ms;
  --dur-normal: 200ms;
  --ease: cubic-bezier(.2,0,.2,1);
}
```

## 视觉签名（utility-board 菜单选 6 条，可指认位置见 content-profile.md §四）

1. **通栏细线网格** —— 价目表/服务网格列间 1px `--line` 竖线；区块之间 2px `--line-strong` 通栏横线。
2. **等宽数字右对齐成列** —— 价目表价格列、信任条数字：`--font-mono` + `tabular-nums` + 右对齐。
3. **顶部今日状态戳** —— board-bar 右侧黑底黄字标签，JS 按营业时间实时算（营业中 · 至 19:00 / 已打烊 · 明 07:00）。
4. **零卡片零阴影** —— 全站 `--radius: 0`、`--shadow: none`，分区全靠实线边框。
5. **固定行高台账行** —— 价目表行高锁 `--row-h: 48px`。
6. **大写等宽微标签 KICKER** —— 每区块 `SEC.0N / NAME` 等宽大写微标签，0.08em 正字距，铜锈色编号。

## never（锚点红线 + 本站特有，逐条可检查）

- 禁柔和阴影（锚点）—— 分区只用 `--line` / `--line-strong` 实线。
- 禁圆角（锚点签名 rad 0）—— 按钮/输入框/警示框一律直角。
- 禁多语言混排膨胀（锚点）—— 中文单语，黑话点缀不加注释堆砌。
- 禁居中正文与居中标题（中轴 left-rail）—— 一切 flush-left；等宽数字列右对齐是唯一例外。
- 禁现实世界品牌（需求文档 §7）—— 支付/地图/快递/联系方式全部用设定词汇。
- 禁编造价格（需求文档 §7「价目表准确」）—— 源未定价项标「柜台牌价」，不写数字。
- 禁 emoji 与图标库（icon: none）—— 状态一律文字标签。
- 禁中文字距 hack（typography.md §3）—— 中文正文 letter-spacing 恒 0，微标签正字距只用于西文大写。
