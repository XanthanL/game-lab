# MASTER — 虚空典籍设计系统（tokens.css 的可读副本）

> 真源：`void-codex/css/tokens.css`。本文件与其逐值一致；改动先改 tokens.css 再同步此处。
> 骨架：`emit_tokens.py --anchor glass-tech` 确定性生成；带 `[特化]` 处为已记录依据的人工叠加。

- **族 / 锚点**：techno / `glass-tech`（半透明玻璃、发光、深色底）
- **布局原型**：`editorial-hero`（锚点默认绑定 minimal-state 被信息目标否决，见 content-profile.md 排除清单）
- **中轴 `--axis`**：`center-axis` —— hero / 店名 / 主张居中；**正文、列表、地址一律左对齐**
- **imagePolicy / iconPolicy / density**：optional / functional / compact
- **技术栈**：plain-html（零构建）

## 颜色

| token | 值 | 用途 |
|---|---|---|
| `--bg` | `#0C1014` | 页面底（oklch 0.985 0.006 250 推导） |
| `--bg-soft` | `#181C21` | 次级底 |
| `--fg` | `#E9EDF2` | 正文（对 bg 16.3:1） |
| `--muted` | `#767C83` | 次级文字（对 bg 4.6:1，正文下限 4.5） |
| `--line` | `rgba(255,255,255,.16)` | 分区线（替代投影） |
| `--accent` | `#73B0EE` | 交互强调（8.3:1） |
| `--accent-ink` | `#167FD4` | 正文链接（4.6:1） |
| `--accent-soft` | `rgba(115,176,238,.10)` | 强调底色 |

**[特化] 霓虹层**（依据：参考站 CSS 实测 `#b026ff/#ff006e/#00d4ff` + 用户 G2 点名保留暗夜霓虹）：

| token | 值 | 用途限定 |
|---|---|---|
| `--neon-purple` | `#C06BFF` | 标题渐变端点 1（较原值提亮保 3:1） |
| `--neon-pink` | `#FF5C9D` | 标题渐变端点 2 |
| `--neon-cyan` | `#56E1FF` | 标题渐变端点 3 / 眉标 / 状态灯 |
| `--grad-display` | `linear-gradient(94deg, purple 0%, pink 55%, cyan 118%)` | 仅大标题渐变字 |
| `--glow-purple` | `0 0 28px rgba(176,38,255,.32)` | 发光（原值紫） |
| `--glow-pink` | `0 0 28px rgba(255,0,110,.22)` | 发光（原值粉） |
| `--glass-bg` | `rgba(255,255,255,.045)` | 玻璃卡底 |
| `--glass-line` | `rgba(255,255,255,.12)` | 玻璃卡描边 |

霓虹层**只**用于：标题渐变、发光描边、粒子、微标签。正文文字一律用确定性 token。

## 字体搭配

| token | 值 |
|---|---|
| `--font-display` | `"Sora", "Inter", sans-serif`（西文标题；全库唯一具名搭配） |
| `--font-body` | `"Inter", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace`（编号/日期，`tabular-nums`） |
| `--font-cjk` | `"Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` |
| **[特化] `--font-display-cjk`** | `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif` |

- 中文衬线 display 特化依据：用户 G2「标题要有文学气质，去科幻感」。CDN 引入 Noto Serif SC 分片子集，失败回退系统宋体。
- 字重总数 ≤2：display 600 / body 400（mono 400）。
- 加载：西文三件自托管 `assets/fonts/*.woff2` + `font-display: swap` + preload；中文正文系统栈；中文衬线 CDN。
- 中文**正文不加正字距**；`--trk-label: 0.08em` 只用于全大写西文眉标。

## 字阶 / 行高

| 级 | 字号 | 行高 |
|---|---|---|
| xs | 12px | 1.65 |
| base | 15px | 1.6 |
| lg | 19px | 1.38 |
| xl | 23px | 1.26 |
| 2xl | 29px | 1.12 |
| display | 46px | 1.02 |
| [特化] hero（display 档倍率） | `clamp(60px, 14vw, calc(46px × 2.956))` | 同 display |

字阶比 1.25 / 基准 15px / **6 级封顶**——hero 不是第 7 级，是 display 档的倍率放大（`--size-hero`，calc 绑定 `--fs-display`，单源）。行高为签名确定值；本站正文均为短区块，15px/1.6 成立。

## 字距

`--trk-display: -0.01em`（≥32px 标题轻收紧）· `--trk-heading: -0.005em` · `--trk-body: 0` · `--trk-label: 0.08em`（西文眉标专用）

## 间距 / 形状 / 版心

- 间距：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64（基数 4px，纵向节奏只取整数倍）
- 圆角：sm 8 / md 16 / lg 24；投影 none（分区靠 `--line`）
- 版心：`--measure: 1120px`（全站唯一）· 正文列 `--prose-width: 68ch` · 页边距 16px

## 动效

`--dur-fast: 120ms` / `--dur-normal: 200ms` / `[特化] --dur-slow: 600ms`（入场与滚动显现）/ `--ease: cubic-bezier(.2,0,.2,1)`。粒子与逐字入场必须响应 `prefers-reduced-motion`。

## never（锚点注册表 + 本站裁定）

1. 需打印或强可访问性场景 → **不适用本站**（纯屏幕展示站）
2. 内容长的页面 → 遵守：单页短区块，无长文；正文列 ≤68ch
3. 非科技品类 → **[用户裁定覆盖]**：主体为魔法科技都市虚构设定 + 用户 G2 点名保留该风格调调（记录于 content-profile.md）
4. 中文正文 `text-align: justify` / `italic` → 禁
5. 居中 ≠ 全部居中：正文、列表、地址保持左对齐 → 禁居中正文
6. 霓虹层上正文 → 禁（正文只用确定性 token 色）

## 视觉签名（结构级，灰度成立）

1. 超大渐变衬线标题压过首屏，整块流光入场（hero 店名；逐字动画实测会打断 background-clip:text 跨层光栅，故收敛为整块入场）
2. 活动台账：等宽编号左置 + 日期右对齐成列（tabular-nums），最近一场玻璃卡 + 霓虹左描边
3. 悬挂眉标系统：区块标题上方 0.08em 字距青色微标签 + 前置短横线
4. 竖排引文侧栏：#about 右缘 vertical-rl 引文（窄屏收起）

## 机器可读镜像（与 css/tokens.css 逐值一致）

```css
:root {
  --bg: #0C1014;
  --bg-soft: #181C21;
  --fg: #E9EDF2;
  --muted: #767C83;
  --line: rgba(255,255,255,.16);
  --accent: #73B0EE;
  --accent-ink: #167FD4;
  --accent-soft: rgba(115,176,238,.10);
  --neon-purple: #C06BFF;
  --neon-pink: #FF5C9D;
  --neon-cyan: #56E1FF;
  --grad-display: linear-gradient(94deg, var(--neon-purple) 0%, var(--neon-pink) 55%, var(--neon-cyan) 118%);
  --glass-bg: rgba(255,255,255,.045);
  --glass-line: rgba(255,255,255,.12);
  --font-display: "Sora", "Inter", sans-serif;
  --font-body: "Inter", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
  --font-cjk: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-display-cjk: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif;
  --font-display-name: "Sora";
  --font-body-name: "Inter";
  --weight-display: 600;
  --weight-body: 400;
  --fs-xs: 12px;
  --fs-base: 15px;
  --fs-lg: 19px;
  --fs-xl: 23px;
  --fs-2xl: 29px;
  --fs-display: 46px;
  --size-hero: clamp(60px, 14vw, calc(var(--fs-display) * 2.956));
  --lh-xs: 1.65;
  --lh-base: 1.6;
  --lh-lg: 1.38;
  --lh-xl: 1.26;
  --lh-2xl: 1.12;
  --lh-display: 1.02;
  --trk-display: -0.01em;
  --trk-heading: -0.005em;
  --trk-body: 0;
  --trk-label: 0.08em;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --radius-sm: 8px;
  --radius: 16px;
  --radius-lg: 24px;
  --shadow: none;
  --measure: 1120px;
  --prose-width: 68ch;
  --gutter: 16px;
  --axis: center-axis;
  --tnum: tabular-nums;
  --dur-fast: 120ms;
  --dur-normal: 200ms;
  --dur-slow: 600ms;
  --ease: cubic-bezier(.2, 0, .2, 1);
}
```
