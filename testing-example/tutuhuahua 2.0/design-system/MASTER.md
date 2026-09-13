# MASTER — 涂涂画画 2.0 · 设计系统

锚点:**quiet-luxury**(静奢)· 族 contemplative · 布局 **split-narrative** · 中轴 **center-axis**
底色档 **paper**(用户选定)· 变体轴 **a 原值**(锚点首次使用,按轴说明取默认)· 字体对 **pair 0**
skill 版本:**v0.8.0** · 技术栈 plain-html(见 docs/tech-stack.md)
生效文件:[css/tokens.css](../css/tokens.css) —— 本文件是它的可读副本,两处必须逐值一致。

## 依据链

- token 骨架:`emit_tokens.py --anchor quiet-luxury --surface paper --variant a --pair 0`(签名:公比 1.5 / 基准 17 / 行高 1.9 / 行长 54ch / 栅格 16px / 直角 / drift 动效 / 色相 70° 青铜金)
- 字体搭配:fonts.json 锚点 quiet-luxury —— Cormorant Garamond(标题)× Jost(正文)。
  **2026-09-13 起不再自托管任何 webfont**:环廊版全站可见文字只有中文与数字(数字走
  `--font-mono`,而 JetBrains Mono 从未自托管),两个栈的 latin 字体零可见字形,
  已移除(省 140 KB)。字体栈保留不删 —— 将来要加拉丁文,按名字放回即可。
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
| 环廊卡片 | 环上竖版卡 | 比例取画作实际宽高比均值;纹理图集单格长边 ≤640px |
| 灯箱大图 | 全屏查看(点击正面卡) | ≤860px 显示 |

> 2026-09-13 改版:整站即环廊,首屏宣言/作品流/理念/教室/试听/页脚均已移除(用户决策)。

## 视觉签名(≥3 条,均可在渲染结果中指出)

1. **字体即图形(片头字标)**:开场画面只有「涂涂画画」clamp(96px,15vw,220px) 衬线大字标(移动端 64px)+ 一行 muted 宣言,零图片零卡片;字标自淡出后画作环才自种子展开——见 `.ring__brand`,灰度下仍是页面最强结构。
2. **黏液融边**:相邻画作在拖拽/悬停时经 smooth-min 熔融共享边缘色、拉出蜂蜜丝,上下玻璃唇折射扫过的画——见 `js/ring-carousel.js` 片段着色器;静置时卡片互不粘连,熔融只在触碰时发生。
3. **疏朗环距**:邻居弦长 ≈ 1.75 倍卡高,静置一屏只见正面卡,环的其余部分隐在画框之外——大留白从「区块距」变为「环周长」。
4. **随卡换场的铭牌**:左右两侧 mono 编号 + 衬线画名/媒介,正面卡一换,铭牌模糊淡出换字——见 `.ring__meta` `.is-swap`。

## never(逐条可检查)

- **never 使用 `object-fit: cover` 裁切画作进入卡片** —— 图集格内 cover 裁切仅用于统一格位,比例按画作数据自适应,偏差 <2%
- **never 深色模式** —— quiet-luxury 红线(surface 固定 paper 亮档)
- **never 出现第二个强调色** —— 青铜金 #785E40 系唯一 accent;黏液颜色自动取自画作本身
- **never 片头字标与卡片同屏重叠** —— 字标阶段环尚未出生(用户明令)
- **never 促销语气、极限词、编造数据** —— 未提供字段一律不展示
- **never 加载 CJK webfont** —— 国内网络;latin 子集自托管 ≤125KB
- **never 渲染 images[0] 而丢弃其余图** —— 每件作品上环(上限 32),名录计数真实
- **never 让页面出现滚动条** —— 滚轮属于环廊(html/body overflow hidden)

## 证伪条件(G2,2026-09-13 随环廊改版修订)

1. 若环上作品超过 32 件上限,或家长反馈「转环找不到想看的那幅」→ 「单环可承载馆藏」被证伪,加辑号分区或检索名录。
2. 若家长/老师反馈「找不到报名入口」(试听区已随改版移除)→ 转化缺失被证实,以极简方式补回(顶栏一枚锚点或片头字标副行,须用户确认)。
3. 若 Cormorant 自托管字体在微信 iOS 加载失败率可观测地高(>5% 请求 404)→ 「latin 子集自托管可行」被证伪,回退 Georgia/宋体栈(视觉签名 ① 仍由 CJK 衬线承担)。
4. 若微信 iOS WebView 出现着色器编译失败或持续掉帧 → 「原生 WebGL 可承载黏液环」被证伪,降级为静态作品页兜底。
