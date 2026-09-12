# 技术栈选型（Phase 1.5）

> skill 版本：website-style-router 0.6.0（SKILL.md 版本记录；F10/F11 判据见 design-qa.md v0.8 补丁说明）
> 选型脚本实跑：`pick_stack.py --pages single --interaction light --maintainer nontech --data inline --host standalone --i18n none --render static --budget lean`

## 输入判定（D1–D8）

| 项 | 取值 | 依据 |
|---|---|---|
| D1 页面规模 | `single` 单页（8 个内容区 + 锚点导航） | S2 §4 页面结构八节；验收「2 次点击内找到预约维修和租赁氧气囊」→ 单页锚点 1 次点击即达 |
| D2 交互复杂度 | `light`（双币切换 / 价目筛选 / 表单校验与讯号板留言 / 今日状态戳 / FAQ 折叠） | S2 §5 功能需求，全部为原生 JS 量级 |
| D3 维护者技术程度 | `nontech` | S1：莉芙是机械师，非技术人员；零构建是硬前提 |
| D4 内容数据源 | `inline`（价目直接进 HTML；离线副本 prices.txt） | S2 §6「静态站 + 轻量表单后端」；无 JS 环境也要能看价目（老旧终端），故不做运行期 fetch |
| D5 交付形态 | `standalone` | 独立官网，无宿主站 |
| D6 多语言 | `none`（中文单语，含祖安黑话点缀） | S2 全文中文；服务对象祖安/皮城客户 |
| D7 渲染 | `static` | S2 §6 技术建议第一句 |
| D8 性能预算 | `lean`（首屏 <300KB、3 秒加载、老旧终端） | S2 §6/§7 验收标准 |

`pick_stack.py` 实跑结果：plain-html 得分 10（单页+3 / 轻交互+2 / 非技术维护者+2 / 数据简单+1 / 首屏紧+2），astro/eleventy/next/nuxt/hugo/vite-vanilla 全部被 D3 排除。

## 结论

**选定 `plain-html`**（一个 index.html + 一张样式表 + 一个小脚本 + prices.txt）。
理由：非技术维护者必须零构建；单页无需路由；交互原生 JS 够用；首屏预算 lean 不允许任何运行时。

## 被排除项

- `astro` / `eleventy` / `next` / `nuxt` / `hugo` / `vite-vanilla` —— 全部被 **D3** 排除（维护者不能碰命令行 / Node 构建链）。
- WordPress/Strapi（S2 §6 备选）—— 被同一判据排除（需运维与后台维护能力），CMS 需求降级为后续阶段，见 content-profile 待补表。

## 该栈的落地约束

- 构建：无。双击 index.html 即可预览；部署任意静态托管（对象存储 / GitHub Pages 均可）。
- 字体：自托管 woff2（fonts.json `loading: self`）+ `font-display: swap` + `<link rel="preload">`；中文一律系统栈（中文字库 3–8MB 自托管必拖垮首屏，typography.md §0）。
- 图片：仅内联 SVG 线稿与手绘地图（无栅格图 → 首屏远低于 300KB；WebP 条款自动满足）。
- 表单：静态站无后端 → 提交生成「讯号板留言」文本 + 复制，异步留言模式；后端 endpoint 标记 `[待接]`。垃圾防护用蜜罐字段（no-JS 也可用）。
- 内容更新：价目/库存都在 index.html 的 `<table id="price-table">` 与 prices.txt 各改一处即可；后续接 CMS 时这两处是同步点。

## 证伪条件（可观测）

1. 若页面区块膨胀到需要第 2 个 HTML 文件（如独立博客/招聘页），D1 判断失效 → 回退 `astro`。
2. 若莉芙方提出表单要直接落库通知手机、或要接入真实支付 → D2/D4 低估 → 评估 `astro` + 轻后端，而非继续在静态站上加代码。
3. 若首屏传输体积实测 >300KB 或 LCP >3s（3G 节流）→ 说明引入了不该有的资产（字体/图片/脚本超重）→ 违反 D8，裁资产而不是换栈。
