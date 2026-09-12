# MASTER.md — 设计系统（swiss-utility · 二手唱片库存查询站）

> 本文件是 `assets/tokens.css` 的可读副本，**两者必须逐值一致**（铁律 26：两份值不一致 = 漂移）。
> 唯一生效文件是 `assets/tokens.css`；改 token 先改它，再同步这里。

**锚点**：swiss-utility（grid 族）｜**布局**：utility-board｜**中轴**：`left-rail`｜**image**：forbidden｜**icon**：functional｜**密度**：compact

## token 总表（值列保持裸值，便于 audit_tokens.py 机器校验）

| 组 | 变量 | 值 | 来源与备注 |
|---|---|---|---|
| 颜色 | `--bg` | #FFFFFF | spec swiss-utility |
| 颜色 | `--bg-soft` | #F6F6F6 | spec |
| 颜色 | `--fg` | #111111 | spec；对 --bg 19.0:1 |
| 颜色 | `--muted` | #767676 | spec；对 --bg 4.54:1 |
| 颜色 | `--line` | #DCDCDC | spec；1px 分区线替代阴影 |
| 颜色 | `--accent` | #1F3FD8 | spec 钴蓝（信息型强调色，不是咖啡棕）；对 --bg 7.6:1 |
| 颜色 | `--accent-ink` | #1F3FD8 | 同 accent；7.6:1 可做正文链接 |
| 颜色 | `--accent-soft` | rgba(31,63,216,.08) | 由 accent 派生 |
| 字体 | `--font-display` | "Archivo", "Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif | fonts.json 锚点条目（display 全库唯一） |
| 字体 | `--font-body` | "Inter", "Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif | fonts.json |
| 字体 | `--font-mono` | "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", monospace | fonts.json；台账数字列 |
| 字体 | `--font-cjk` | "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif | emit_tokens |
| 字体 | `--font-display-name` | Archivo | 反同质化比对用 |
| 字体 | `--font-body-name` | Inter | 反同质化比对用 |
| 字重 | `--weight-display` | 600 | 签名 wts；全站 ≤2 档 |
| 字重 | `--weight-body` | 400 | 签名 wts |
| 字阶 | `--fs-xs` | 12px | 公比 1.2 × 15 |
| 字阶 | `--fs-base` | 15px | 基准 |
| 字阶 | `--fs-lg` | 18px | 公比 1.2 |
| 字阶 | `--fs-xl` | 22px | 公比 1.2 |
| 字阶 | `--fs-2xl` | 26px | 公比 1.2 |
| 字阶 | `--fs-display` | 37px | 公比 1.2⁵；本站未用到（台账型无大标题） |
| 行高 | `--lh-xs` | 1.55 | 无单位；说明文字 |
| 行高 | `--lh-base` | 1.5 | 签名 lh |
| 行高 | `--lh-lg` | 1.28 | 字号越大越紧 |
| 行高 | `--lh-xl` | 1.16 | |
| 行高 | `--lh-2xl` | 1.08 | |
| 行高 | `--lh-display` | 1.02 | |
| 字距 | `--trk-display` | 0em | 签名 trk=0；中文标题不收紧 |
| 字距 | `--trk-heading` | 0em | |
| 字距 | `--trk-body` | 0em | 中文正文绝加正字距 |
| 字距 | `--trk-label` | 0.08em | 微标签 / 全大写 |
| 间距 | `--space-1` | 4px | 基数 4px |
| 间距 | `--space-2` | 8px | |
| 间距 | `--space-3` | 12px | |
| 间距 | `--space-4` | 16px | |
| 间距 | `--space-5` | 24px | |
| 间距 | `--space-6` | 32px | |
| 间距 | `--space-7` | 48px | |
| 间距 | `--space-8` | 64px | |
| 形状 | `--radius-sm` | 0px | 直角 |
| 形状 | `--radius` | 0px | 直角 |
| 形状 | `--radius-lg` | 0px | 直角 |
| 形状 | `--shadow` | none | 只用 1px --line 分区 |
| 版心 | `--measure` | 960px | spec；全站唯一容器宽 |
| 版心 | `--prose-width` | 74ch | grid 族带 62–78ch，折合 37 汉字/行 |
| 版心 | `--gutter` | 16px | 页面边距 |
| 版心 | `--row-h` | 44px | spec；台账行高（min-height） |
| 中轴 | `--axis` | left-rail | 锚点声明；一切 flush-left，无居中标题 |
| 底色档 | `--surface` | white | 显式选择：台账型信息站用纯白，非默认滑入 |
| 变体轴 | `--variant` | a | 本批次 swiss-utility 首次使用（ledger.py 登记） |
| 动效 | `--dur-fast` | 120ms | 签名 mot=snap |
| 动效 | `--dur-normal` | 200ms | |
| 动效 | `--ease` | cubic-bezier(.2,0,.2,1) | |

## 字体加载（plain-html 栈落地约束）

自托管 latin 子集 woff2（`assets/fonts/`，共 6 文件 ≈117KB），`font-display: swap`；
中文一律系统栈回退（中文字库 3–8MB 不自托管，不阻塞首屏）。

## 视觉签名（≥3 条结构级手法）

- 签名 1 · 等宽数字右对齐成列：台账「编号 / 年份 / 价格」三列用 IBM Plex Mono + tabular-nums，价格列个位对齐
- 签名 2 · 状态文字标签非颜色传达：每行末列「在架 / 已预留 / 已售」1px 边框文字标签；已售行整行删除线降调
- 签名 3 · 顶栏 LIVE 数据戳：等宽字体 `● 库存更新于 <时间>`，值随 data.js 自动变化，页脚同源时间戳
- 签名 4 · 通栏 1px 细线分区：零卡片、零阴影、零圆角；表头分隔线用 --fg 加重一级与正文线拉开层级

灰度测试：四条均为结构 / 字体 / 线条手法，转灰度后全部保留。
与 never 清单无冲突（无居中标题、全站 400/600 两档字重、无装饰图形）。

## never（锚点注册表，逐条可检查）

- 居中标题（一切标题 flush-left）
- 超过两个字重（全站只有 400 / 600）
- 装饰性图形 / 插画 / 渐变 / 图片（`imagePolicy: forbidden`）
- 大圆角（radius=0）
- 卡片阴影（分区只用 1px `--line`）
- 状态只靠颜色传达（必须文字标签 + 已售删除线）
- 内容硬编码进 HTML（数据只来自 `data.js` 单一真源）
