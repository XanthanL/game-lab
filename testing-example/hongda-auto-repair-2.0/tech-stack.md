# 技术栈选型 — 宏达汽修 2.0

> 本文件基于 **website-style-router v0.8.0**（Phase 1.5 新增阶段）。
> 选型由 `scripts/pick_stack.py` 确定性产出，非默认继承。

## 输入判定（D1–D8）

- D1 页面规模：**single** —— 用户第 1 条"就一页"（Grill B0）
- D2 交互：**light** —— 查价（零交互扫读）+ 拨号链接 + 营业状态角标（原生 JS 即可，Grill B5）
- D3 维护者：**nontech** —— 用户第 3 条"老板儿子会一点电脑"（Grill B4/Q13）；这是排除力最强的一条
- D4 数据源：**single-json** —— 价目表一季一换、单一维护者，必须是单一数据文件（Grill B4/Q12）
- D5 交付形态：**standalone** —— 独立单页，无宿主站（Grill B0/Q0b）
- D6 多语言：**none** —— 用户第 5 条"纯中文"
- D7 渲染：**static** —— 无登录/表单/实时数据；用户第 6 条明确不做表单（Grill B10/Q26）
- D8 性能预算：**lean** —— 手机端、可能在中国大陆移动网络下打开（Grill B5/Q14 推断）

## 结论

选定：**`plain-html`**（纯静态 HTML + CSS ± 原生 JS）

因为：维护者非技术（D3）→ 一票排除 astro / eleventy / next / nuxt / hugo / vite-vanilla 全部需要 Node 构建链的方案；
单页（D1）→ 无需路由；交互轻（D2）→ 原生 JS 够用；单一数据文件（D4）→ 运行期读取即可；
性能预算 lean（D8）→ 框架运行时不可接受。

`pick_stack.py` 原始输出：候选排序 plain-html 得分 10（+3 单页 / +2 轻交互 / +2 非技术 / +1 数据简单 / +2 首屏预算紧），其余 6 个候选全部被 D3 排除。

## 被排除项

| 栈 | 被哪条排除 |
|---|---|
| astro | D3（非技术维护者无法运行 npm install / 命令行） |
| eleventy | D3 |
| next | D3 + D8 |
| nuxt | D3 + D8 |
| hugo | D3（Go 模板对非技术维护者不可维护） |
| vite-vanilla | D3（构建工具链） |

## 该栈的落地约束

- 构建命令：**无**（双击 index.html 即可预览；`pick_stack.py` 建议的目录形状：index.html + style.css + app.js）
- 内容更新方式：改 `data.js`（单一数据文件，中文注释，记事本可编辑）
- 字体加载：自托管 woff2 于 `assets/fonts/` + `font-display: swap`（fonts.json loading=self；
  本环境 Google Fonts 直连不可用，经 jsdelivr 的 @fontsource 镜像下载后落盘自托管，
  不依赖任何运行时第三方请求，适配中国大陆访问）
- 部署：任意静态托管（GitHub Pages / 对象存储 / 云主机静态目录）

## 证伪条件（可观测；如果…就说明栈选错了）

1. 若维护者提出"想在手机上直接改价目、不碰文件" → 说明 D3/D4 判断错误（需要 CMS 或服务端），应回 G0 重问并换栈。
2. 若页面要扩到第 7 个页面（如分店、加盟页）→ 说明 D1 判错，plain-html 维护成本爆炸，应回退 `astro`。
3. 若上线后首屏传输体积 >100KB（HTML+CSS+JS+字体合计）→ 违反 D8，说明引入了不该有的运行时或全量字库，必须瘦身。
