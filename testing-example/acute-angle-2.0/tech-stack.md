# 技术栈选型 — 锐角 ACUTE ANGLE 2.0

> skill 版本：website-style-router **v0.8.0**（Phase 1.5 新增门）
> 判定工具：`python scripts/pick_stack.py`（确定性推荐，非印象选型）

## 输入判定（D1–D8）

| # | 判定项 | 取值 | 依据 |
|---|---|---|---|
| D1 | 页面规模 | `single` | G2(v1) 已落定 conversion 单页；v2 为同一业务的视觉重做，IA 不变 |
| D2 | 交互复杂度 | `light` | 唯一交互 = 微信号复制按钮 + 锚点跳转（v1 实测 10 行 JS 覆盖） |
| D3 | 维护者技术程度 | `nontech` | B4(v1) 未答，按最保守假设（店主本人维护）；v1 交付后无维护问题反馈 |
| D4 | 内容数据源 | `inline` | 内容一次性、约 10 个字段，硬编码在 HTML 中即可，无需数据文件 |
| D5 | 交付形态 | `standalone` | B0：独立静态站，无宿主 |
| D6 | 多语言 | `none` | G0 已落定：中文为主 + 英文点缀，单语无切换器 |
| D7 | 渲染需求 | `static` | 预约走微信（站外完成），无登录/表单提交/实时数据 |
| D8 | 性能预算 | `lean` | 单页官网，访客以手机扫码进入为主，首屏必须快 |

## 结论

**选定：`plain-html`**（pick_stack 得分 10，唯一存活候选）。
因为：非技术维护者（D3）排除一切 Node 构建链（astro/eleventy/next/nuxt/hugo/vite-vanilla 全部被 D3 排除）；
单页（D1）+ 轻交互（D2）+ inline 数据（D4）+ lean 预算（D8）→ 纯 HTML + CSS ± 原生 JS。

## 被排除项（含被哪条判据排除）

| 被排除 | 判据 |
|---|---|
| astro / eleventy / next / nuxt / hugo / vite-vanilla | 全部被 **D3=nontech** 排除（维护者不能碰命令行/构建链） |
| next / nuxt | 另被 D7=static、D8=lean 排除（无 SSR 需求，运行时与预算冲突） |

## 该栈的落地约束

- 构建：无。双击 `index.html` 或任意静态服务器即可
- 目录形状：`index.html + site.css + design-system/tokens.css + fonts/*.woff2`（plain-html 形状，与 astro 的 `src/pages/` 明确区分）
- 字体加载：**自托管 woff2 + `font-display: swap`**（fonts.json `loading: "self"`；Latin 子集自托管，CJK 走 `--font-cjk` 系统栈——中文 webfont 体积不可接受）
- 部署：任意静态托管；大陆服务器需页脚补 ICP

## 证伪条件（可观测）

1. 若页面数出现第 2 个路由页（如案例页/动态页）→ D1 判错，迁 `astro`
2. 若店主要求自助改内容且 1 个月内改坏 HTML ≥2 次 → D3/D4 判错，抽单一数据文件或接 headless CMS
3. 若自托管字体总体积 >300KB 或首屏 >2s → D8 判错，砍 webfont 退系统栈
