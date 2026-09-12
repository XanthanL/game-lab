# Intent Summary — 意图摘要(v2.0)

> skill 版本 v0.8.0 · 判断段(G-1→G1.6)全部走完,G2 经用户确认(AskUserQuestion,选项「静奢·纸白(推荐)」)。

## 源材料
- 6 张儿童画作照片(v1 沿用,本工程重新提取)+ 原品牌需求陈述
- 溯源:[source-map.md](source-map.md)

## 交付形态
- **standalone** 单页站,plain-html(Phase 1.5 实跑 pick_stack.py,见 [tech-stack.md](tech-stack.md))

## 成功定义
家长手机刷到 → 静奢观感留驻 → 发起试听课咨询。

## 转化目标
**咨询试听课**(沿用)。转化面:顶栏锚点 + 移动端底部 CTA(试听区可见时退场)+ 试听区。

## 图文策略
- 图片:**要,且是主角**(quiet-luxury imagePolicy: required);手机随拍以「原始比例 + 大图慢流 + 大留白」呈现,禁 cover 裁切
- 图标:**none**

## 语言策略
纯中文;拉丁仅限 mono 微标签与自托管 latin 字体。

## 参考站
无;风格基准 = 用户原话 + 批次查重约束。

## 族与锚点(两级收敛)
- 族:**contemplative**(内容支撑力:40+ 图为主角;转化:轻留资;密度诉求:慢、感受)
- 锚点:**quiet-luxury** —— 族内唯一可行:museum-modern 被批次锁定(v1 已用,锚点唯一率要求);
  japanese-ma never(高转化目标+条目并列);scandinavian-clean never(高端奢品);agentic-minimal imagePolicy forbidden
- 布局:**split-narrative**(锚点绑定;catalog-grid 会让 v2 结构复刻 v1,违背重做意图)
- 中轴:**center-axis**(锚点声明;ledger 提示 split 未用,但 audit F5 硬性校验锚点声明,取锚点为准,中冲突为建议级)

## 批次查重(G1.6)
`ledger.py --check` 通过(exit 0):锚点 quiet-luxury / display 字体 Cormorant Garamond 均为批次内唯一;
底色 paper 首次出现;中轴 center-axis 为第 4 次(中冲突,建议级,受 F5 锚点绑定约束保留)。
v1 站点已补记账。

## 区块与尺寸
| 区块 | 去留 | 说明 |
|---|---|---|
| 顶栏 | 要 | 衬线字标 + mono 试听锚点 |
| 首屏宣言 | 要 | 纯排版,86px 衬线大字标(签名①) |
| 作品流 | 要 | 交错栏 5:7(签名②)+ 每 4 件通栏断点(签名④);灯箱承担大图与翻页 |
| 理念 | 要 | prose 54ch 左对齐 |
| 教室 | 要 | 照片待上架占位 |
| 试听 | 要 | split 双栏;字段待填(青铜金虚线) |
| 通用 Contact/社交 | **不做** | intake Q21 默认 |
| 页脚 | 要 | 衬线字标 + ICP 占位 |

三档图片宽度:作品流媒体列(7/12 栏)/ 灯箱 ≤880px / 环境图 4:3。

## 硬约束
1. 纸白底 `#F9F7EF`(用户在 G2 三选项中选定 paper 档)
2. 大量留白(签名③;区块距 128–192px)
3. 单一青铜金强调 #785E40
4. 无促销语气、无极限词、无编造(合规审慎 + 锚点 never)
5. 移动端优先(375px 起步,微信内打开)
6. CJK 零 webfont;latin 子集自托管
7. 40+ 件可持续上架(inbox → build.py)
