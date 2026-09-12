# 技术栈选型 — maimang-site-2.0

> **skill 版本：website-style-router 0.8.0**（Phase 1.5 为本版新增；按 SKILL.md 要求在头部落版本戳）

## 输入判定（D1–D8）

- D1 页面规模：**single** ｜ 依据：微信转发的单页（用户原话"微信里能转发的页面"），4 个 SKU + 品牌故事，无多页需求
- D2 交互：**light** ｜ 依据：唯一交互 = 点击复制微信号 + 轻提示；无灯箱/筛选/状态机
- D3 维护者：**nontech** ｜ 依据：家庭烘焙工作室主理人（阿慧）自维护，B4/Q13 推断；无专职、无技术背景
- D4 数据源：**inline** ｜ 依据：内容一次性落定、量级小（34 行文案）；single-json 需 fetch，file:// 直开即失效，对非技术维护者反而更脆
- D5 形态：**standalone** ｜ 依据：独立转发页，非嵌入宿主
- D6 多语言：**none** ｜ 依据：国内微信私域，纯中文
- D7 渲染：**static** ｜ 依据：无登录/表单/实时数据；下单在微信侧完成
- D8 性能预算：**lean** ｜ 依据：微信内嵌浏览器首屏敏感；目标整体 <100KB

## 结论

选定：**`plain-html`**（`scripts/pick_stack.py` 得分 10，其余 6 个候选全部被 D3 排除）

因为：维护者非技术（D3）→ 排除一切需要 Node/命令行的方案（astro/eleventy/next/nuxt/hugo/vite-vanilla 六项全部命中此排除）；单页 + 轻交互（D1/D2）→ 无需路由与状态管理；数据 inline（D4）→ 无数据层；性能预算 lean（D8）→ 框架运行时不可接受。

## 被排除项

- `astro` —— 被 D3 排除（非技术维护者无法维护 npm 构建链）；D1=single 亦命中"杀鸡用牛刀"
- `eleventy` —— 被 D3 排除；D6/D2 无增益
- `next` —— 被 D3 + D8 排除（运行时与构建双重量负债）
- `nuxt` —— 同 next；且团队无 Vue 背景（Q27）
- `hugo` —— 被 D3 排除（Go 模板学习曲线对非技术维护者不可行）
- `vite-vanilla` —— 被 D3 排除；D2=light 亦无重交互需求

## 该栈的落地约束

- 构建命令：无（产物即 `index.html` + `styles/tokens.css` + `assets/`，任意静态托管可部署）
- 字体加载：**自托管 woff2**（`assets/fonts/`，共 3 个文件 52KB）+ `font-display: swap` + `<link rel="preload">`；中文回退走系统栈（`fonts.json` loading 图例：中文一律 system，避免 3–8MB 中文字库拖垮首屏）。**不用 Google Fonts CDN**——大陆微信内不可靠，`loading: self` 是该锚点的指定值
- 内容更新方式：直接改 `index.html` 里的文字（附注释标记各区块）
- 部署：任意静态托管；微信转发卡片需 `og:` meta + 托管域名（JSSDK 卡片缩略图需公众号配置，交付说明单列）

## 证伪条件（可观测）

1. 若维护者需要在页面上自行增删 SKU 到 7 个以上且频繁改动 → 说明 D1/D4 判断错误，应回退评估 `astro`（模板化 + 数据文件）
2. 若出现"下单表单直连后端/库存实时查询"需求 → 说明 D7 判断错误，`plain-html` 不再成立
3. 若部署后首屏传输总量（HTML+CSS+字体）超过 150KB → 说明违反 D8，需裁剪字体字重或内联关键 CSS
