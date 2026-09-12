# 簪三制壶 · Zansan Teapots

水墨、印章、留白的双语作品集站（英文默认 `/`，中文 `/zh/`）。
Astro 静态站，构建产物为纯 HTML，可部署到任意静态托管。

## 本地预览

```bash
cd site
npm install     # 首次
npm run dev     # 开发预览 http://localhost:4321
npm run build   # 构建到 site/dist/
npm run preview # 预览构建产物
```

## 你需要填的内容（页面上都有红色虚线 [待填] 标记）

| 要填什么 | 在哪填 | 影响 |
|---|---|---|
| 询价邮箱 | `site/src/data/site.json` 的 `"email": ""` | 页尾 + 每件作品的询价按钮，一处生效 |
| 作品规格（泥料/容量/年份） | `site/src/data/works.json` 各件的 `specs` | 详情页规格行，null 会显示「—」 |
| 作品真实定名 | `site/src/data/works.json` 各件的 `title` | 当前是按形态起的描述性暂名 |
| 作品说明 | `works.json` 各件的 `note` | 当前只写了照片可见的事实，请换成你的话 |
| 其余作品（第 6–12 把） | `works.json` 加条目 + 图片放入 `site/src/assets/works/` | 网格空槽位会自动被占用 |
| 生平/师承/工作室 | `site/src/data/site.json` 的 `about.body`（删掉 pending 框） | 关于页 |

改完重新 `npm run build` 即可，无需碰任何组件代码。

## 设计系统

- 锚点：`ink-wash`（水墨）· 族：vernacular · 布局：split-narrative + catalog-grid 作品变体 · 中轴：center-axis
- 唯一 token 真源：`site/src/styles/tokens.css`；可读副本：`design-system/MASTER.md`（两者逐值一致，audit F=0）
- 字体：马善政毛笔体（仅标题）× 思源宋（正文）× Fragment Mono（规格数字），Google Fonts CDN，开源可商用
- 朱砂 `--seal` 仅用于印章图形与 [待填] 标记，全站唯一饱和色

## 决策与验收文档

- `source-map.md` — 源材料与溯源
- `intent-summary.md` — 意图摘要
- `content-profile.md` — 画像 / 排除清单 / 视觉签名 / 待补表
- `tech-stack.md` — 技术栈判定（D1–D8）与证伪条件
- `design-system/MASTER.md` — 设计 token 全表 + never 清单

## 部署

`site/dist/` 是纯静态目录。GitHub Pages / Cloudflare Pages / 对象存储均可：
构建命令 `npm run build`，输出目录 `site/dist`。
