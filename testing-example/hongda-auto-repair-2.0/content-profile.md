# Content Profile — 宏达汽修 2.0

## 画像

- 主体：社区店型汽修铺（一家店、一位联系人王师傅、一张 9 大项价目表）
- 受众：附近小区车主，手机访问，目的极明确——查价、打电话；含中老年用户（字号下限敏感）
- 维护者：老板儿子，"会一点电脑"，季更价目 → 非技术维护者，单一数据文件 + 纯静态 + 中文注释
- 更新频率：季更
- 设备：手机优先，白天户外场景（眩光敏感）
- 语言：纯中文

## 排除（约束筛选 + 批次查重）

| # | 排除项 | 被谁排除 |
|---|---|---|
| 1 | 布局 editorial-hero / catalog-grid / split-narrative | 视觉资产=无（intake 约束表第 1 行） |
| 2 | 风格 warm-hospitality / editorial-print / museum-modern / product-catalog / quiet-luxury / japanese-ma / scandinavian-clean / market-stall / luxury-retail / industrial-documentary / craft-artisanal | imagePolicy required/preferred 且无专业摄影 |
| 3 | 锚点 swiss-utility | **G1.6 批次高冲突**（1.0 已用，锚点全批次唯一） |
| 4 | 锚点 provisions-label | **G1.6 批次高冲突**（shihua-1.0 / maimang-site 已用 2 次） |
| 5 | 锚点 swiss-editorial | 其绑定布局 split-narrative 被约束"受众耐心低"排除 |
| 6 | 锚点 technical-drawing | 需线稿/剖面图，无素材 |
| 7 | 锚点 concrete-brutalist | never"需信任背书"（汽修转化靠信任） |
| 8 | 锚点 archival-index | never"内容量 <20 条"（12 行价目） |
| 9 | 锚点 agentic-minimal | 绑定 minimal-state 单屏单动作布局，容不下 12 行台账；且 never"需要品牌辨识度" |
| 10 | techno 族（glass-tech / dark-console / cyber-terminal） | 白天户外场景 + never"主流消费者/营销首屏" |
| 11 | IA catalog / narrative / portfolio / directory | 条目量 12、受众扫读、单一转化（同 1.0 判定） |
| 12 | 留言表单 / Contact 区 | 用户第 6 条 |
| 13 | 大圆角 / 卡片阴影 / 装饰图形 / 渐变 / emoji | data-dense-app compact 工具语法 + 用户第 8 条"别花哨"（rad=2，近直角） |
| 14 | 变体轴 b（收紧） | 会把基准字号压到 13px，触发 audit F3（中文正文 <14px 致命） |
| 15 | 编造文案（"20 年老店""技术精湛"等） | D 类红线：页面事实性内容必须能指回 source-map |

## 剩余空间

- 技术栈：只剩 `plain-html`（D3 一票排除其余，详见 tech-stack.md）
- IA：只剩 `conversion`（单一可数转化动作=拨号）
- 布局：只剩 `utility-board`（data-dense-app 绑定；无图+扫读双约束满足）
- 风格：取 `data-dense-app`，因为同族其余锚点分别被批次高冲突（swiss-utility）、布局排除（swiss-editorial）、素材缺失（technical-drawing）淘汰，而它的 never"营销展示站"在本页不成立——页面零营销话术、纯价格数据+单一拨号动作，且 when 三条（数据为主/高频使用/操作密度）全中

## 视觉签名落点（渲染结果里能指出来的位置）

| 签名 | 在哪里能看见 |
|---|---|
| ① 通栏细线网格 | 价目区每一行的分类栏右缘与价格栏左缘各有一条 1px 竖线，从表头贯通到表尾（含桌面端） |
| ② 等宽数字右对齐成列 | 价格列整体右对齐（IBM Plex Mono + tabular-nums），"180 起 / 20 / 380 起"右缘齐平成一条线 |
| ⑥ 固定行高台账行 | 全部 12 行等高（--row-h 44px），扫读节奏一致，不随备注增减跳动 |
| ⑦ 左侧固定标签栏 | 每行行首 64px 窄列放分类标签（保养/刹车/轮胎/电瓶/空调/救援/清洗），同组连续行合并显示，独占一列 |

与 1.0 相比：换入 ①⑦，②由列内左对齐翻转为右对齐，底色 white→stone、display Inter→Barlow Condensed。

## 待补（指不回源/占位的内容）

| 字段 | 现状 | 需谁提供 | 页面上如何标记 |
|---|---|---|---|
| contact.phone | 139-XXXX-XXXX（源占位） | 用户 | 号码旁 `[待填]` 红色虚线框；编辑位置 data.js 顶部注释 |
| address | 幸福路 12 号（工商银行对面）（源 L3 自述占位） | 用户 | 同上标记机制 |
| 价目更新时间 | 空 | 维护者季更时填 | 填了才显示，不预填 |
| 车间照片 | 未提供 | 用户 | 本版无图 |
| 字体文件 | Barlow Condensed 600 / IBM Plex Sans 400,600 / IBM Plex Mono 400（latin 子集） | — | 本环境经 jsdelivr @fontsource 镜像下载落盘 assets/fonts/；若下载失败则系统回退，交付时明说 |

## 假设与待确认

| 假设 | 依据 | 若不成立 |
|---|---|---|
| 电话与微信同号 | 源 L21 同栏书写 | data.js 拆字段即可 |
| 营业状态按访客本机时间 | 无服务端 | 改为常显营业时间 |
| stone 灰底户外可读性可接受 | surface 预设注明"降低眩光，适合数据密集界面" | 证伪条件 2 生效，回退 white |
