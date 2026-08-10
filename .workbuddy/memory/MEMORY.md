# GAME LAB 项目记忆

## 部署
- 仓库：`XanthanL/game-lab`，GitHub Pages 从仓库根目录发布。
- 站点根：`https://xanthanl.github.io/game-lab/`（og:image 等绝对 URL 都用这个前缀）。
- 工作流：`.github/workflows/pages.yml`（push 到 main 触发）。

## 微信/Open Graph 分享卡片约定
- 每个页面 `<head>` 注入 `og:title / og:description / og:image / og:url` + twitter 等价标签，微信分享卡片读取这些。
- 缩略图：竖版 600×800 PNG，与首页 canvas poster 同配色，用 `.workbuddy/gen_thumbs.py`（Pillow）生成。
- 缩略图位置：**不要把 FPS Vampire 的图放进 `dist/`**，因为 `dist/` 是构建产物会被重建清空；放在 `FPS Vampire/og.png` 才安全。
- 缩略图清单：`assets/og-gamelab.png`(主站) + `cursed-house/og.png`、`PVZ/og.png`、`forcing-mars/og.png`、`FPS Vampire/og.png`。
- 首页 2026-08-10 重构为「卡片网格」：`GAMES[].thumb` 即 `og.png` 作为封面；hover 时封面缓推缩放 + 渐变遮罩 + 标题上移 + 详情(简介/技术栈/进入)滑入，**已移除原先的 canvas 悬浮海报**。Hero 右侧为自动轮播封面预览（Ken Burns + 交叉淡入），另有滚动揭示、自定义光标高光、跑马灯等技术标签条。`prefers-reduced-motion` 与触屏下自动降级。

## 字体（缩略图生成用）
- Latin 衬线 `C:/Windows/Fonts/times.ttf`；CJK `C:/Windows/Fonts/simsun.ttc` / `simhei.ttf`。
- Python 环境：`C:/Users/www27/.workbuddy/binaries/python/envs/default`（已装 Pillow + numpy）。
