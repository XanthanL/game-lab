# MASTER — 屿光摄影 设计系统（soft-organic × editorial-hero）

> skill 版本：website-style-router 0.9.1 ｜ `emit_tokens.py --anchor soft-organic --surface tint --variant a --pair 0 --lang zh` 确定性生成
> **一份真源**：生效 token 文件为 `css/tokens.css`，本文件是其可读副本，两者逐值一致；改动先改脚本输入再重新生成，不许手编其一。

**族**：craft ｜ **布局原型**：`editorial-hero` ｜ **中轴**：`center-axis` ｜ **image**：preferred ｜ **icon**：decorative ｜ **密度**：airy
**底色档**：`tint` ｜ **变体轴**：`a` 原值（锚点首次使用取默认轴） ｜ **字体搭配**：`Baloo 2`（标题）× `Nunito`（正文）
**搭配理由**：Baloo 2 的粗圆笔画自带亲和的拟物感，和 20px 圆角是一套语言。

## token（与 css/tokens.css 逐值一致）

```css
:root {
  /* ── 颜色（锚点 `soft-organic` 签名 · 底色档 `tint` · 色相 150° / 彩度档 1 / 色温 +1.0）── */
  --bg:        #FAE9DD;   /* surface=tint · oklch(0.945 0.042 60) */
  --bg-soft:   #F4DECC;
  --fg:        #231D18;   /* 对 --bg 对比度 14.2:1 */
  --muted:     #706964;   /* 对 --bg 对比度 4.5:1（正文下限 4.5） */
  --line:      rgba(0,0,0,.12);
  --accent:    #26753E;   /* 强调 / 装饰；大字下限 3:1 = 4.8:1 */
  --accent-ink:#397749;   /* 可做正文链接，对比度 4.6:1 */
  --accent-soft: rgba(38,117,62,.10);

  /* ── 待填警示（语义色：页面 [待填] 标记专用，非装饰强调色）── */
  --warn:        #A93226;   /* 待填文字，对 --bg 5.6:1 */
  --warn-border: #C0392B;   /* 待填虚线框，对 --bg 4.4:1 ≥3:1 */
  --warn-bg:     rgba(192,57,43,.06);

  /* ── 反同质化指纹（同批次内这三项都必须唯一）── */
  --surface:   "tint";
  --variant:   "a";

  /* ── 字体（具名搭配 · 来源：锚点 `soft-organic`）── */
  --font-display: "Baloo 2", "Quicksand", sans-serif;
  --font-body:    "Nunito", "PingFang SC", sans-serif;
  --font-mono:    "Roboto Mono", ui-monospace, Consolas, monospace;
  --font-cjk:     "ZCOOL XiaoWei", "Noto Sans SC", "PingFang SC", sans-serif;
  --font-display-name: "Baloo 2";
  --font-body-name:    "Nunito";
  --weight-display: 600;
  --weight-body:    400;

  /* ── 字阶（公比 1.3，基准 17px，6 级封顶）── */
  --fs-xs: 13px;
  --fs-base: 17px;
  --fs-lg: 22px;
  --fs-xl: 29px;
  --fs-2xl: 37px;
  --fs-display: 63px;

  /* ── 行高（字号越大越紧；CJK 主站整体上浮）── */
  --lh-xs: 1.85;
  --lh-base: 1.8;
  --lh-lg: 1.52;
  --lh-xl: 1.42;
  --lh-2xl: 1.32;
  --lh-display: 1.18;

  /* ── 字距 ── */
  --trk-display: 0.0em;
  --trk-heading: 0.0em;
  --trk-body:    0em;
  --trk-label:   0.08em;

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
  --radius-sm: 10px;
  --radius:    20px;
  --radius-lg: 28px;
  --shadow: none;   /* 用 --line 分区替代 */

  /* ── 版心 ── */
  --measure: 1080px;
  --prose-width: 60ch;
  --gutter: 16px;

  /* ── 中轴 ── */
  --axis: center-axis;

  /* ── 动效（性格：soft）── */
  --dur-fast: 180ms;
  --dur-normal: 320ms;
  --ease: cubic-bezier(.22,.61,.36,1);
}
```

## 中轴

`--axis: center-axis` —— hero 主标题、区块标题与编号、CTA、灯箱标题居中；
**正文段落、列表、表格、表单、图注保持左对齐**（中文超过 3 行居中极难读）。

## 视觉签名（≥3 条结构级手法；灰度化后仍成立）

1. **超大标题压过首屏** —— hero 主标题用 `--fs-display`（桌面 63px / 移动 37px 两档限幅），
   两行断行（"把海边的光/留在你们身上"），占首屏视觉主导。位置：首屏。
2. **章节编号超大装饰** —— 每个区块标题左侧 01–06 编号取 `--fs-2xl`、display 字体、
   `--accent` 低透明度色，与标题基线错位悬挂。位置：02–06 区块标题行。
3. **图文交错（左右交替）** —— 关于区两张图文卡采用非对称栏比（文字 7fr / 图 5fr），奇偶卡图左右互换。位置：02 关于。
4. **单一主 CTA + 次要文字链接** —— 全站唯一实心按钮「预约看片」；其余跳转一律下划线文字链。位置：hero、预约区、页脚。

## never（锚点注册表 + 本站补充，逐条可检查）

- 专业/严肃场景（不采用公文语气与冷灰配色）
- 数据密集（单屏不出现 >1 个表格；价格表不与条款表并排）
- 需要紧凑布局（区块间距不小于 `--space-5`）
- 正文段落/列表/表格 **不得居中**（中轴规则）
- 中文正文不加正字距、不用 italic、不两端对齐
- 合规/条款信息不得折叠、不得小于 12px
- 不出现清晰可辨真人面孔充当"客户作品"；示意图片必须带"AI 生成"标注
- 不出现编造的荣誉、统计数字、第三方评价
