# MASTER — 涂涂画画 2.0 · 设计系统

锚点:**quiet-luxury**(静奢)· 族 contemplative · 布局 **split-narrative** · 中轴 **center-axis**
底色档 **paper**(用户选定)· 变体轴 **a 原值**(锚点首次使用,按轴说明取默认)· 字体对 **pair 0**
skill 版本:**v0.8.0** · 技术栈 plain-html(见 docs/tech-stack.md)
生效文件:[css/tokens.css](../css/tokens.css) —— 本文件是它的可读副本,两处必须逐值一致。

## 依据链

- token 骨架:`emit_tokens.py --anchor quiet-luxury --surface paper --variant a --pair 0`(签名:公比 1.5 / 基准 17 / 行高 1.9 / 行长 54ch / 栅格 16px / 直角 / drift 动效 / 色相 70° 青铜金)
- 字体搭配:fonts.json 锚点 quiet-luxury —— Cormorant Garamond(标题)× Jost(正文),latin 子集已自托管(assets/fonts/,OFL 许可);中文走系统栈,不加载 CJK webfont(国内网络 + 首屏预算)
- 锚点特化两处(已声明):display 栈补中文衬线回退;body 栈补 Windows/鸿蒙具名黑体回退
- 批次查重:ledger --check 通过(2026-09-12);与 v1(tutuhuahua,museum-modern/white/catalog-grid/Songti SC)全维度错开

## Token

### 颜色(paper 底 · 单一青铜金强调)
| token | 值 | 校验 |
|---|---|---|
| `--bg` | `#F9F7EF` | surface=paper,oklch(0.975 0.010 90) |
| `--bg-soft` | `#F0ECE2` | 图片容器底色 |
| `--fg` | `#201E19` | 对 bg 15.5:1(≥7 ✓) |
| `--muted` | `#747169` | 对 bg 4.6:1(≥4.5 ✓) |
| `--line` | `rgba(0,0,0,.12)` | 分区细线 |
| `--accent` | `#785E40` | 青铜金;对 bg 5.6:1(≥3 ✓) |
| `--accent-ink` | `#856D52` | 对 bg 4.6:1(≥4.5 ✓) |
| `--accent-soft` | `rgba(120,94,64,.10)` | 待填标记底色 |

### 反同质化指纹
| token | 值 |
|---|---|
| `--surface` | `"paper"` |
| `--variant` | `"a"` |

### 字体
| token | 值 |
|---|---|
| `--font-display` | `"Cormorant Garamond", "EB Garamond", Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif` |
| `--font-body` | `"Jost", "Inter", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", Consolas, monospace` |
| `--font-cjk` | `"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif` |
| `--weight-display` | `400` |
| `--weight-body` | `300` |

### 字阶(6 级封顶,公比 1.5,基准 17px)
| token | 值 |
|---|---|
| `--fs-xs` | `11.5px` |
| `--fs-base` | `17px` |
| `--fs-lg` | `26px` |
| `--fs-xl` | `38px` |
| `--fs-2xl` | `57px` |
| `--fs-display` | `86px` |

移动端限幅(hero h1):375px 视口下 60px(site.css 媒体查询,typography.md §1 移动端 display 单独限幅;token 保持桌面值)。

### 行高(无单位)
| token | 值 |
|---|---|
| `--lh-xs` | `1.95` |
| `--lh-base` | `1.9` |
| `--lh-lg` | `1.52` |
| `--lh-xl` | `1.42` |
| `--lh-2xl` | `1.32` |
| `--lh-display` | `1.22` |

### 字距
| token | 值 | 说明 |
|---|---|---|
| `--trk-display` | `0.02em` | 锚点签名疏朗大字(东方留白例外,≤0.04em 有意为之) |
| `--trk-heading` | `0.01em` | |
| `--trk-body` | `0em` | 中文正文恒为 0 |
| `--trk-label` | `0.08em` | 大写/微标签正字距 |

### 间距(基数 16px)
| token | 值 |
|---|---|
| `--space-1` | `16px` |
| `--space-2` | `32px` |
| `--space-3` | `48px` |
| `--space-4` | `64px` |
| `--space-5` | `96px` |
| `--space-6` | `128px` |
| `--space-7` | `192px` |
| `--space-8` | `256px` |

### 版心 / 形状 / 动效
| token | 值 |
|---|---|
| `--measure` | `1120px` |
| `--prose-width` | `54ch` |
| `--gutter` | `16px`(≥720px 时 24px) |
| `--radius` | `0px`(直角,单档) |
| `--shadow` | `none`(用 `--line` 分区) |
| `--axis` | `center-axis` |
| `--dur-fast` | `300ms` |
| `--dur-normal` | `600ms` |
| `--ease` | `cubic-bezier(.16,.84,.24,1)` |

### 图片三档宽度
| 档 | 用途 | 尺寸 |
|---|---|---|
| 作品流大图 | 交错栏媒体列(7/12 栏) | 文件长边 ≤1400px,显示随栏 |
| 灯箱大图 | 全屏查看 | ≤880px 显示 |
| 环境图 | 教室照片位 | 4:3,移动 1 列 / ≥720px 3 列 |

## 视觉签名(≥3 条,均可在渲染结果中指出)

1. **字体即图形**:首屏「涂涂画画」以 86px 衬线大字标(移动端限幅 60px)+ 0.02em 疏朗字距独占一屏重心,零图片——见 index.html `.hero h1`,灰度下仍是页面最强结构。
2. **交错栏**:作品流奇数项「图右注左」、偶数项「图左注右」,5:7 栏比,随滚动左右互换——见 `.work` / `.work--flip`,任取相邻两件作品可见。
3. **大留白**:区块纵向间距 128–192px(--space-6/7),作品条目间距 128px,是正文行高的 3 倍以上——见任意两个 section 之间;灰度下节奏不变。
4. **跨栏横线章节断点**:每 4 件作品插一条通栏细线 + mono 辑号(第一辑 · Vol.1)——见 `#works .stream-break`,横线贯穿整个版心。

## never(逐条可检查)

- **never 使用 `object-fit: cover` 裁切作品图** —— 一律原始比例
- **never 深色模式** —— quiet-luxury 红线(surface 固定 paper 亮档)
- **never 出现第二个强调色** —— 青铜金 #785E40 系唯一 accent
- **never 出现需要快速扫读的信息形态**(筛选条/密集表格/价格墙)—— 与锚点 never 冲突,作品流只保留线性序列
- **never 促销语气、极限词、编造数据**(师资/获奖/数量/价格)—— 未提供字段一律 `[待填]`
- **never 中文正文居中或加字距** —— center-axis 只作用于 hero/标题/图;正文左对齐
- **never 图注与图不同轴** —— 交错栏内注随图同侧,灯箱图注居中
- **never 加载 CJK webfont** —— 国内网络;latin 子集自托管 ≤125KB
- **never 渲染 images[0] 而丢弃其余图** —— 每件作品进灯箱序列,计数真实

## 证伪条件(G2)

1. 若 40+ 件作品上齐后,单列大图流让家长在 3 秒内滑不出第一辑(微信内实测首屏后滑动距离 >4 屏才见第 5 件)→ 「慢流可承载 40+ 件」被证伪,回 catalog-grid 类紧凑呈现并重跑批次查重。
2. 若家长反馈「找不到报名入口」→ 「静奢克制与留资转化兼容」被证伪,把试听区前移至第一辑之后并提高 CTA 对比(唯一允许的强调色加码)。
3. 若 Cormorant 自托管字体在微信 iOS 加载失败率可观测地高(>5% 请求 404)→ 「latin 子集自托管可行」被证伪,回退 Georgia/宋体栈(视觉签名 ① 仍由 CJK 衬线承担)。
