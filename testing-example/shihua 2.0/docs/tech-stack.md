# 技术栈选型 — 拾花 2.0

> skill 版本：website-style-router v0.8.0 ｜ Phase 1.5 ｜ `pick_stack.py` 确定性输出

## 输入判定（D1–D8）

- D1 页面规模：**single**（单页；依据：同 1.0 的交付形态，内容为一屏门店信息）
- D2 交互：**light**（平滑锚点滚动 + 图注；无状态机；依据：转化目标=到店/订花，无筛选无图表）
- D3 维护者：**nontech**（店主本人；1.0 已确认并沿用）
- D4 数据源：**inline**（价格/花目直接写在 HTML 里，店主改文字即更新；JSON 中间层对非技术维护者是负担）
- D5 交付形态：**standalone**（Grill 确认）
- D6 多语言：**none**（纯中文；街坊客群）
- D7 渲染：**static**（无个性化/鉴权/实时）
- D8 性能预算：**lean**（微信内置浏览器打开；8 张图已占 2.7MB，JS 必须为零）

## 结论

选定：**`plain-html`**（pick_stack 得分 10，唯一幸存候选）

因为：维护者非技术（D3）→ 排除一切需要 Node/命令行的方案；单页（D1）→ 无需路由；
交互轻（D2）→ 原生 JS 够用；数据 inline（D4）→ 无数据层；预算 lean（D8）→ 框架运行时不可接受。

## 被排除项

- `astro` / `eleventy` / `next` / `nuxt` / `hugo` / `vite-vanilla` —— 全部被 **D3=nontech** 排除（维护者不能碰命令行与构建链）

## 该栈的落地约束

- 构建命令：无（双击 index.html 即可预览）
- 内容更新：用记事本改 index.html 里的文字（与 1.0 的维护方式一致）
- 字体加载：**自托管 woff2 + `font-display: swap`**（fonts.json 的 loading=self；Marcellus/Karla/IBM Plex Mono 取 latin 子集，--font-cjk 霞鹜文楷按站点用字子集化）
- 部署：任意静态托管（GitHub Pages / 对象存储）

## 证伪条件（可观测）

1. 若页面数长到 7+ 或需要模板复用 → D1 判断失效，回退 `astro`
2. 若店主需要自己在线改价格（而非改文件）→ D4 判断失效，需要数据层，重选栈
3. 若首屏 JS 超过 100KB → 违反 D8，说明引入了不该有的运行时
