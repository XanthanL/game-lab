# Content Profile — 拾花 · 花店网站 2.0

## 画像（Grill 答案，1.0 沿用 + 本批次新增）

- 图片素材：**8 张 AI 生成图**（元宝生成，右下角水印已按裁决裁除）→ 图文策略从 1.0 的「占位」翻转为「要且为主角」
- AI 图裁决（本批次 C 类新增）：「直接当正式配图，裁掉水印」——用户代表店主接受 AI 意象表达；花目价格不采信图中 AI 价签文字
- 核心目标 / 店铺信息 / 风格参考 / 语言：与 1.0 一致（到店+微信/电话订花；实体信息 [待填]；无参考站；纯中文）
- 维护者：店主本人（非技术）→ D3=nontech

## 排除（约束筛选）

**排除 IA / 布局**
- 排除 `narrative` / `split-narrative` —— 街坊受众耐心低（与 1.0 同源）
- 排除 `catalog-grid` —— 条目 <10 且无筛选需求
- 排除 `minimal-state` / `utility-board` —— 前者装不下到店+订花双信息；后者台账气质压不住 8 张实拍材质图

**排除风格（本批次关键变化：图片在场，旧排除反转）**
- 排除 `provisions-label` —— **批次查重 G1.6**：1.0 已用该锚点（锚点必须唯一）
- 排除 `warm-hospitality` —— when 前置条件②「确实在卖空间体验（有座位、可停留）」无法从源验证（花店非座位业态）；when③「不介意与同类同质化」亦未确认
- 排除 `soft-organic` —— claymorphism 拟物与实拍材质图冲突（触感由照片承担，拟物冗余且偏幼）
- 排除 `washi-japanese` —— 日式语法与杭州街坊主体错位，且绑定 split-narrative（被耐心排除）
- 排除 `market-stall` —— when「图是随手拍」不成立（图是精修 AI 图）；`product-catalog` SKU<10；`luxury-retail` 非高单价私洽
- 排除 `japanese-ma` / `quiet-luxury` —— never「促销/高转化目标」命中；contemplative 族要求素材顶级且客单价高
- 排除 editorial / grid / industrial / expressive / nostalgic / techno / institutional 七族 —— 同 1.0 分析（文字主体/高密度/工业遗产/艺术实验/年代辨识/科技/公信均不命中）

## 剩余空间

- **族**：`craft` 材质工艺族。三问判定——内容支撑力：8 张图全是材质/手作/环境（craft 的主场）；转化目标：到店+订花（soft conversion，commerce 族锚点已全灭：provisions-label 被查重锁死，其余三个 when 不成立）；密度诉求：低密度、看图感受。
- **锚点**：`craft-artisanal` 手作工艺。when 三条全命中且**全部有源**：卖手艺（包花）✓、有过程图（ba6b5d64 双手麻绳捆扎）✓、需要证明人做的（街坊生意=人情手艺）✓；never 两条不命中。无本地 spec → 按 `_specFallback` ② 用签名 7 字段确定性落 token（不靠印象）。
- **布局**：editorial-hero（锚点绑定）；**中轴**：center-axis（锚点声明；与 1.0 left-rail 错开）。
- **取 craft-artisanal 因为**：它是唯一「when 三条全部能指到具体源图、never 零冲突、且不与 1.0 锚点重复」的候选——warm-hospitality 差一条可验证前置，commerce 族整族被查重与 when 排除。

## 待补

| 字段 | 现状 | 需谁提供 | 页面标记 |
|---|---|---|---|
| contact.wechat / phone / address / hours | 无 | 店主 | [待填] + 红虚线框 |
| catalog.items（品名/花材/规格/价格） | 无（图中价签为 AI 虚构，禁用） | 店主 | 价签表占位行 ×3 |
| hero.claim / pull quote 文案 | 文案创作（非事实宣称） | 可改 | — |
| AI 图的长期处置 | 用户裁决：正式配图 | 建议实景到位后逐步替换 | 交付说明 |

## 视觉签名落定（F10 必填，灰度可存活）

| # | 签名 | 渲染结果哪里能看见 |
|---|---|---|
| 1 | 63px 楷体「拾花」居中压首屏 | 首屏正中，霞鹜文楷/楷体大字标，display 档唯一使用 |
| 2 | 图文左右交替交错 | 手作/花目/店里区块奇偶图位互换（奇数图左、偶数图右） |
| 3 | 手作宣言跨栏引言 | 「手作」区块的引言块向左出血 64px（超出正文列起点、仍在视口内），楷体 29px |

组合与 1.0 无重合（1.0 无签名声明）；三条均为结构手法，转灰度后仍在。
