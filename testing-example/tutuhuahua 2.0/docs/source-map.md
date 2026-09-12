# Source Map — 源与内容映射(v2.0)

> skill 版本 v0.8.0 · 本工程为「涂涂画画」官网的第二版,素材沿用 v1 工程,按规程重新提取。

## 源

| 源 | 类型 | 提取方式 | 产出 |
|---|---|---|---|
| 用户消息(重做指令 + 原品牌需求) | 纯文本 | 直接读取 | intent-summary.md 画像段 |
| 6 张儿童画作照片(v1 `source/raw/` 沿用) | 图片 ×6 | 本工程重新跑 `extract_source.py`(真实格式校验 + 归一化 JPEG) | `source/extracted/assets/*.jpg`,零告警 |
| v1 工程 tools/works.json(画名/媒介元数据) | JSON | 复制到 `tools/works.json` | 画名/媒介字段溯源见 v1 source-map(画面观察级) |

- 校验:`verify_assets.py assets/art js/works-data.js index.html` → PASS(见 G5 记录)
- 参考站:无具体 URL(同 v1);风格基准 = 用户原话「性冷淡/大留白/白底」+ v0.8 批次查重约束
- **批次账本**:v1 站点已补记入 `.style-ledger.json`(museum-modern / white / center-axis / Songti SC),
  v2.0 选型据此查重通过 —— 这是 v2 换锚点与字体的直接依据

## 内容映射

| 目标字段 | 值 | 溯源 | 备注 |
|---|---|---|---|
| brand.name | 涂涂画画 | 用户消息(v1/v2 一致) | |
| hero.tagline | 「孩子的画，值得一面白墙。」 | v1 品牌语,沿用 | 非事实宣称 |
| works[*].title | 飞向太空/深海里的鲸/爸爸妈妈和我/彩虹花园/猫与金鱼/喷火龙与火山 | 画面观察(《爸爸妈妈和我》有画内手写字) | 观察级字段,works.json 可改 |
| works[*].media | 蜡笔/水彩/线描 | 画面笔触观察 | 观察级字段 |
| works[*].author / age | 空 | — | 页面不显示,进待补表 |
| 版本结构差异 | v1 展签网格 → v2 交错作品流 | 用户「重新再制作一个」+ ledger 查重 | 见 intent-summary |

## 未采用的源内容

| 内容 | 理由 |
|---|---|
| v1 的 css/site.css / index.html 结构 | v2 按新锚点(quiet-luxury/split-narrative)重写;仅复用构建管线与文案(文案为已确认的品牌语) |
| 用户消息中「教室环境的照片」 | 未提供实际图片 → 显式占位,进待补表 |

## 提取告警

| 告警 | 影响 | 处置 |
|---|---|---|
| extract_source.py 零告警(_WARNINGS.txt 未生成) | — | — |
| HEIC 风险(用户后续 40+ 张) | PIL 读不了 heic | README:相机设「兼容性最佳」 |
| 画作照片反光/桌面杂物(观察) | quiet-luxury「不解释」的呈现方式反而吃拍面质量 | 沿用 v1 对策:原始比例 + 大留白小尺寸呈现;README 拍摄规范;证伪条件盯防 |

## 回源抽查(年份/作品名/人名/数字)

- 年份:页面唯一年份 `© 2026` ← 当前日期 2026-09-12 ✓
- 作品名:6 条均为画面观察级,与 works.json 逐条一致 ✓
- 人名:页面无人名(作者待补)✓
- 数字:馆藏计数由 works-data.js 生成 = 磁盘 6 件 ✓;辑号 Vol.N 由序号取整生成,非事实分组 ✓
