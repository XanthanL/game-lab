# Intent Summary — 屿光摄影（T04）

> skill 版本：website-style-router 0.9.1 ｜ Phase 0 产物 ｜ 2026-09-13

## 意图摘要

- **源材料**：`../fixtures/T04-photo-studio.txt`（文字）+ 7 张 AI 示意图附件 → 见 `source-map.md` 溯源表
- **交付形态**：standalone 独立站（给客人直接看）
- **成功定义**：准新人/家庭看完作品与套餐结构后，愿意发微信咨询预约
- **转化目标**：联系（咨询预约）——全站唯一实心 CTA「预约看片」
- **图文策略**：图片=要（占位示意图，显式标注"AI 生成 · 非客户作品"）；图标=decorative
- **语言策略**：纯中文；默认 zh；无切换器
- **参考站**：无 `[待定]`（无 references.md）
- **技术栈**：`plain-html`（D1–D8 判定与被排除项见 `tech-stack.md`）
- **页面粒度**：single（1 页 8 区块）；**页内导航**：sticky-toc（粘性顶栏 + scrollspy）——见 `content-profile.md`
- **中轴**：center-axis（hero/标题居中；正文/表格左对齐）
- **区块与尺寸**：hero / 关于 / 作品集 / 服务价格 / 预约档期 / 好评 / 条款合规 / 页脚；
  hero 图全宽、作品列 ≈340px、关于插图 ≈440px
- **硬约束**：合规区独立不可折叠且字号 ≥12px；不编造荣誉/数据/价格；无清晰真人面孔充当客户作品；
  明星客片不上站；示意图片必须显式标注；素材体积 <15MB（实测 1.52MB）

## 落定指纹（G2 / ledger 用）

- 锚点：`soft-organic`（craft 族）｜ 布局：`editorial-hero` ｜ 中轴：`center-axis`
- 底色档：`tint` ｜ 变体轴：`a` ｜ 字体对：pair 0（Baloo 2 × Nunito）
- 批次：本工作区首批第 1 站（此前无 `.style-ledger.json`）

## 页面粒度与页内导航（摘要行）

- 页面粒度：single（1 页）
- 页内导航：sticky-toc
