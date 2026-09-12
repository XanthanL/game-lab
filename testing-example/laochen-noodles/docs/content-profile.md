# Content Profile — 老陈家面馆

## 画像

家庭经营 30 年街坊面馆；内容 = 一份 12 项菜单（5 面 + 3 加料 + 4 凉菜 + 3 饮料）+ 两句店史 + 三条到店信息；无摄影、无 VI、无参考站；受众手机扫读；转化 = 到店。

## 约束判定与排除（「不能做什么」清单）

| 约束维度 | 判定 | 排除 |
|---|---|---|
| 视觉资产质量 | 低（仅菜单扫描件） | 布局：editorial-print 型图文并置、catalog-grid、split-narrative（依赖图）；风格：editorial-print、warm-hospitality、expressive-artistic、quiet-luxury、japanese-ma |
| 转化目标 | 到店（非购买） | commerce 族（provisions-label / market-stall：触发条件是「需要下单」，不成立） |
| 空间体验 | 不卖（街坊面馆非精品店） | craft 族 warm-hospitality（「餐厅→自动套 warm-hospitality」即 families.md 点名的陷阱） |
| 内容密度 | 低（12 条目） | catalog-grid（15+ 条目才成立）、bento、多级导航 |
| 密度诉求 | 扫读，但量小 | grid 族非必需；保留其 flush-left 纪律于 left-rail 中轴 |
| 明暗 | 白天营业（6:30–20:30） | quiet-luxury、glass-tech（深色底） |
| 多语言 | 否 | vernacular / expressive 族的字形控制问题不触发，但两族主体不符（非书画/艺术主体），整族排除 |
| 食品合规 | 命中 | 禁极限词、禁编造评价与销量、禁疾病宣称；「三十年/老卤十年不换」只作源原文表述；到店信息不可折叠 |

## 剩余空间

- **技术栈**：只剩 `plain-html`（D3 nontech 排除全部 Node 栈，见 tech-stack.md）
- **族**：剩 `grid` 与 `nostalgic` 两族 —— craft（无图+不卖空间）、commerce（不到店下单）、contemplative（素材质量不达标）、editorial（长文/图文并置不成立）、vernacular/expressive/institutional/techno（主体不符）均被排除
- **锚点**：grid 族 `swiss-utility`（命中 4 条 when，但「公交站牌/药品说明书」气质给不了本店唯一的内容差异化——时间纵深）vs nostalgic 族 `retro-nostalgic`（when「主体涉及历史/老品牌」逐条命中：三十年老店、老卤十年不换、三代人、冰峰/大窑/酸梅汤皆年代品牌；`imagePolicy: optional` 容忍零摄影）。**取 `retro-nostalgic`**，因为本站的转化逻辑是「老店可信、有食欲」，年代辨识度直接服务它，而 swiss-utility 的致密台账在 12 条目上无处发挥。
- **布局**：`editorial-hero`（锚点绑定；hero 可纯文字立招牌）+ 中轴 `left-rail`（锚点声明）

## 待补（指不回源的内容）

| 字段 | 现状 | 需谁提供 | 页面上如何标记 |
|---|---|---|---|
| （无） | 全部内容均溯源至 p1/p2 或用户口述 | — | — |

> 若用户后续想加「Wi-Fi、外卖、停车」等菜单外信息，属新增内容，须用户提供，页面以 `[待填]` 标记，不得编造。
