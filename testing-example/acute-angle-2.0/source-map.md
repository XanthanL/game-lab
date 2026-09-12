# Source Map — 锐角 ACUTE ANGLE 2.0

> v2 = 同一业务的视觉重做。源与 G0 答案沿用 v1 会话（2026-09-12）的用户确认，不重复提问。
> v1 工程保留于 `../acute-angle/`，本目录为其 v0.8 skill 下的重做。

## 源

| 源 | 类型 | 提取方式 | 产出 |
|---|---|---|---|
| 会话用户请求（2026-09-12，两轮） | 第 11 类：一段文字要求 | 逐句录入 | 本表「内容映射」 |
| v1 会话 Grill 回答（4 项 C 类，AskUserQuestion） | 用户口述，已确认 | 直接沿用 | 微信预约 / 无图纯排版 / 中文+英文点缀 / 只列服务不标价 |
| `styles/specs/swiss-utility.md` + `styles/fonts.json`(swiss-utility + grid 池) + `styles/signatures.json`(_surfacePresets/_variantAxes) | v0.8 注册表 | skill 读取 | tokens.css |
| 批次账本 `.style-ledger.json`（9 条，含 hongda-auto-repair 同锚点记录） | v0.8 新机制 | `ledger.py --check` | G1.6 查重结论 |
| 无图片、无 PDF、无参考站 | — | — | verify_assets 不适用（0 资产：缺失 0 / 未用 0 / 格式 0） |

## 内容映射

| 目标字段 | 值 | 溯源 | 备注 |
|---|---|---|---|
| brand.name / brand.en | 锐角 / ACUTE ANGLE | v1 溯源表；英文为直译推断（B 类，v1 已确认策略） | |
| positioning | 市中心创意园 · 预约制理发店 | 用户请求原句 | 园名 [待填] |
| booking.channel | 微信预约 | Grill 第 1 题 | 信号/二维码 [待填] |
| imagePolicy | 不要图 | Grill 第 2 题 | v2 沿用，无图硬约束不变 |
| language | 中文为主 + 英文点缀 | Grill 第 3 题 | |
| pricing | 只列服务不标价 | Grill 第 4 题 | |
| services[] | 占位结构 | 用户未提供 | [待填] 红色虚线标记 |
| 视觉层（底色/字体/变体/签名） | ink + Familjen Grotesk 等 | v0.8 注册表 + 批次查重 | 见 design-system/MASTER.md |

## 未采用的源内容

| 内容 | 理由 |
|---|---|
| （无） | |

## 提取告警

| 告警 | 影响 | 处置 |
|---|---|---|
| 实体信息为零（沿 v1） | 服务/地址/时间/联系方式缺失 | `[待填]` 红色虚线标记，禁止编造 |
| 批次账本中 swiss-utility 已被 hongda-auto-repair 使用 | G1.6 锚点高冲突 | 见 tech-stack.md 与 MASTER.md 的冲突处理记录：按查重工具自带补救路径换组合（底色 ink + 备用池第 3 对字体 + 新签名组），变体轴保持 a（audit F5 对变体偏移不感知，b/c/d 必然 F≠0，两工具冲突处记录在案） |
