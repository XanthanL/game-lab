# 技术栈选型 — 老陈家面馆

> skill 版本：website-style-router **0.8.0**（Phase 1.5 产出）

## 输入判定（D1–D8）

| 项 | 取值 | 依据 |
|---|---|---|
| D1 页面规模 | `single` | 菜单 + 店史 + 到店信息，单页足够；无多页需求迹象 |
| D2 交互 | `light` | 至多：锚点导航、平滑滚动、拨号链接；无状态管理 |
| D3 维护者 | `nontech`（推断，G2 确认） | 家庭面馆，请 AI 建站；无 Node/命令行迹象（intake Q24） |
| D4 数据源 | `inline` | 12 个菜品 + 4 条信息，硬编码进 HTML 即可；单页上 fetch JSON 反而破坏 file:// 直开 |
| D5 交付形态 | `standalone` | 用户「帮我们做个网站」，未提及任何已有站点 |
| D6 多语言 | `none` | 内容纯中文，街坊客群 |
| D7 渲染 | `static` | 纯展示，无鉴权/实时/个性化 |
| D8 性能预算 | `lean` | 街坊手机流量场景；菜单站无理由带运行时 |

`pick_stack.py` 实跑（0.8.0）：得分 10，唯一候选 `plain-html`。

## 结论

选定：**`plain-html`**（index.html + style.css + 可选少量原生 JS）
因为：非技术维护者（D3）→ 排除一切 Node 构建链；单页（D1）→ 无需路由；交互轻（D2）→ 原生 JS 够用；
性能预算 lean（D8）→ 零运行时。产物 = 双击 `index.html` 即可打开，也可整体拷进任意静态托管。

## 被排除项（含排除判据）

- `astro` / `eleventy` / `next` / `nuxt` / `hugo` / `vite-vanilla` —— 全部被 **D3（nontech）** 排除：维护者不能碰 npm install / 命令行
- `next` / `nuxt` 另被 **D7（static）+ D8（lean）** 复排除：框架运行时与首屏预算冲突

## 该栈的落地约束

- 构建命令：**无**。预览 = 双击 `site/index.html`
- 内容更新方式：直接改 `site/index.html` 里的文字（价格都在带注释的清单结构里）
- 字体加载：`styles/fonts.json` 的 `loading: "self"` → 自托管 woff2 子集 + `font-display: swap`；中文字体不整包自托管（体积爆炸），标题宋体走系统衬线栈，西文展示字自托管子集
- 部署：任意静态托管（GitHub Pages / 对象存储 / 服务器静态目录均可）

## 证伪条件（如果…就说明栈选错了）

1. 若维护者表示愿意且能够跑 `npm` 命令维护内容 → D3 判定错误，应回退评估 `astro`（模板化 + 内容文件）
2. 若需要长出第 2 个页面（如「堂食/外卖分开」）或超过 30 个菜品并需要筛选 → D1/D2 低估，应迁移 `astro`
3. 若页面出现任何框架运行时或首屏 JS > 100KB → 违反 D8，实现层跑偏，回退纯 HTML+CSS
