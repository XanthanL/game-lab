# Content Profile — 锐角 ACUTE ANGLE 2.0

## 画像（v2 新增判定 + v1 沿用）

- B0–B9：全部沿用 v1 已确认答案（源=一句话；standalone；转化=微信预约到店；无图；中文+英文点缀；非技术维护；MVP 单页）
- B10（v2 新增）：Q24 部署维护 = 店主本人（非技术假设）→ D3=nontech；Q25 部署 = 静态托管未定；Q26 无服务端需求 → D7=static；Q27 未答 → 不为技术新而选 → 见 tech-stack.md
- 视觉收束（v2 新增维度）：底色档 = **ink**；变体轴 = **a**；字体对 = **grid 池第 3 对（北欧理性）**

## 排除（v2 全量重跑，含批次维度）

约束排除（与 v1 相同判据，结论不变）：
- 排除布局 **editorial-hero / catalog-grid / split-narrative**（无图硬约束，intake 约束表第 1 行）
- 排除 **technical-drawing**（never：情感化生活方式品类）、**concrete-brutalist**（反建制气质 ≠ 高级感）、**data-dense-app**（never：营销展示站——v2 复核命中）、**agentic-minimal**（never：需要品牌辨识度/竞争差异化）、**swiss-editorial**（绑定 split-narrative，被无图排除）、**archival-index**（never：内容量 <20 条）、**art-deco-glam**（imagePolicy required + never 极简定位）、**collage-cutout / kinetic-type**（expressive 族，不花哨排除）、**glass-tech / dark-console / cyber-terminal**（techno 族，花哨排除）
- 排除 IA portfolio / narrative / directory（唯一可数转化 = 微信预约）

批次排除（G1.6 新增，v2 特有）：
- 查重工具判定：锚点 swiss-utility 已被 hongda-auto-repair 使用（white / variant a / pair 0 / Inter）→ **高冲突，结论「不通过」**
- 工具自带补救路径：「若必须保留该锚点：换组合 surface ∈ {deep, ink, slate}，variant ∈ {b,c,d}，pair ∈ {1,2,3}」
- **两工具冲突记录在案**：补救路径要求 variant ∈ {b,c,d}，但 `audit_tokens.py` F5 对变体偏移不感知（b/c/d 的间距基数 2/6/8px ≠ 签名 4px、圆角 ≠ 0px 必然 F 级失败），铁律 25「F 级不为 0 = 没做完」优先 → **变体轴取 a，其余三维全换**：surface white→**ink**、pair 0→**3**、display Inter→**Familjen Grotesk**（比 hongda 多换一个身份维度：字体）
- 单站审计（F=0）与批次报告（F11）双过验证：v2 组合单站 F 0 PASS（已实测）；F11 无锚点检查项，display 唯一率不受影响（Familjen Grotesk 全库唯一）

## 剩余空间

- 技术栈：只剩 **plain-html**（D3=nontech 排除其余全部，pick_stack 实跑）
- IA：只剩 **conversion**（唯一可数转化动作）
- 布局：只剩 **utility-board**（swiss-utility 绑定 + 无图约束）
- 风格：取 **swiss-utility（ink / a / pair 3）**，因为——约束系统下它是唯一全过 when/never 的锚点（其余候选均命中各自 never，逐条见上）；批次维度上 surface/字体对/display 字体三维全换，满足查重补救路径的可换维度中审计允许的全部

## 反同质化 · 结构级视觉签名（≥3 条，灰度后仍在，与 v1 组合至少换 2 条）

| # | 签名 | 渲染结果位置 | 与 v1 的差异 |
|---|---|---|---|
| 1 | **左侧固定标签栏（label rail）**：字段名（ADDRESS/HOURS/TEL、服务编号列）独占一窄列，与内容列之间以通栏细线分隔 | 到店信息区、服务台账列结构 | v1 无 label rail（字段名与内容同行堆叠） |
| 2 | **大写等宽 KICKER 行 + 正字距**：每区块 `01 · SERVICES` 式编号行，全大写 + 0.08em 字距 + 顶部通栏细线 | 每区块头部 | v1 有 kicker 但为灰字无通栏线；v2 升级为通栏细线 + 编号当视觉锚 |
| 3 | **深底反白台账行**：hover 时行内出现 `→` 且行底色微升（rgba white .04），零卡片零阴影 | 服务台账、预约区 | v1 为白底灰字 hover；v2 深底反白语法整体不同 |
| 4 | **底色微差分区**：预约区用 `--bg-soft`（深一档的黑）而非分割线单独成场，CTA 唯一强色块落在场中央 | 预约区 | v1 靠 1px 线分区为主；v2 深底上以明度差分区为主 |
| 5 | **等宽数字右对齐成列**：服务时长、编号列 `font-variant-numeric: tabular-nums` 右对齐 | 服务台账数字列 | v1 数字左对齐 |

（规则 5 校验：v1 签名 = 板头状态位/双语kicker/台账行/虚线占位框；v2 换掉其中 2 条（状态位、台账 hover 语法），保留的 2 条（kicker、占位框）为内容语法非视觉语法，组合不同。）

## 待补（与 v1 同一份事实，页面上红色虚线 `[待填]` 标记）

| 字段 | 现状 | 需谁提供 | 页面上如何标记 |
|---|---|---|---|
| location.park / address / hours / phone | 无 | 店主 | 到店信息区 `[待填]` |
| contact.wechat_id / qr | 无 | 店主 | 预约区 `[待填]` + 二维码虚线框 |
| services[] ×3 | 占位结构 | 店主 | 台账行逐格 `[待填]` |
| brand.en_registered | ACUTE ANGLE 为直译推断 | 店主 | 替换即生效 |
| site.icp | 无 | 店主（大陆部署时） | 页脚未放，README 记补法 |
