# 技术栈选型

> skill 版本：website-style-router **0.9.0**（选型逻辑与判据以该版为准）

## 输入判定（D1–D8）

| # | 判定项 | 取值 | 依据 |
|---|---|---|---|
| D1 | 页面规模 | `single` | 用户明说「一页就够」；`pick_pages.py` 判定 single |
| D2 | 交互复杂度 | `light` | 新到名表清单渲染 + 照片位按固定文件名自动替换 + 锚点跳转；无筛选/灯箱/状态机 |
| D3 | 维护者技术程度 | `nontech` | 店主 58 岁完全不用电脑；实际维护者（其子）在外地、自述「只会用 FTP」「Git、Node、Go 都没有也不会装」 |
| D4 | 内容数据源 | `single-json`（落地为单文件 JS 清单） | 新到名表月更 → `js/new-arrivals.js` 用 `const` 数组而非 `fetch('*.json')`，保证双击 `index.html` 本地预览（`file://`）与 FTP 虚拟主机两种环境都能跑 |
| D5 | 交付形态 | `standalone` | FTP 上传到闲置虚拟主机的独立站 |
| D6 | 多语言 | `none`（双语并列，无语言路由） | 「名片一直是中英双语的，网站保持双语」→ 同页双语并列（中文主行 + 英文辅行），无切换器、无多套页面 |
| D7 | 渲染需求 | `static` | 无登录、无表单提交、无实时数据 |
| D8 | 性能预算 | `lean` | 虚拟主机 + 手机优先受众；中文 webfont（3–8MB）拒绝自托管，中文走系统栈 |

## 结论

选定：**`plain-html`**（`python scripts/pick_stack.py` 得分 10 / 排序第 1）

因为：维护者非技术（D3）→ 排除一切需要 Node/命令行的方案；单页 + 轻交互（D1/D2）→ 无需路由与状态管理；
数据量小且月更（D4）→ 运行期读取单个 JS 清单即可；性能预算 lean（D8）→ 框架运行时不可接受。

## 被排除项

- `astro` —— 被 D3 排除（维护者不能碰 `npm install` / 命令行）
- `eleventy` —— 被 D3 排除（同上）
- `next` —— 被 D3 + D7 + D8 排除（非技术维护者、无 SSR 需求、运行时体积与 lean 预算冲突）
- `nuxt` —— 被 D3 排除（同 next；且维护者无 Vue 背景）
- `hugo` —— 被 D3 排除（Go 模板链对 FTP-only 维护者不可用）
- `vite-vanilla` —— 被 D3 排除（需要构建步骤，产物无法直接 FTP）

## 该栈的落地约束

- 构建命令：**无**。双击 `index.html` 即可本地预览（不依赖 `file://` 下会失败的 `fetch`，数据用 JS 清单）
- 部署：任意静态虚拟主机。上传清单 = `index.html` + `css/` + `js/` + `fonts/` + `images/`（见 README.md）
- 字体加载：西文（EB Garamond / Lora）自托管 woff2 + `font-display: swap`（`fonts.json` 锚点条目 `loading: "self"`）；**中文一律系统栈**（typography.md §0：中文 webfont 3–8MB 会拖垮首屏）
- 内容更新方式：营业时间/电话改 `index.html` 单一位置；新到名表改 `js/new-arrivals.js` 加一行 + FTP 传图；照片按固定文件名放入 `images/` 即自动显示
- 无外部运行时依赖（无 jQuery/无 CDN 请求），符合 lean 预算与国内主机环境（不依赖被墙资源）

## 证伪条件（可观测）

1. 若页面文件需要增加到第 2 个（例如价目拆出独立页）→ 说明 D1 判断错误，应回退 `astro` 静态生成
2. 若 `index.html` 首屏总传输量（HTML+CSS+JS+字体）超过 300KB → 说明引入了不该有的东西，违反 D8
3. 若维护者反馈「改一次营业时间要动超过 1 个文件」→ 说明单点维护被破坏，违反 plain-html 落地约束
