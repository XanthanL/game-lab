# Intent Summary — 辰光修表铺 / Chenguang Watch Atelier

## 意图摘要

- 源材料：品牌卡纯文本（T16-brand-notes.txt）+ 委托正文 → 直接读取，溯源见 [source-map.md](source-map.md)
- 交付形态：`standalone`（FTP 上传闲置虚拟主机的独立站，无构建）
- 成功定义：老客户/新客在手机上 30 秒内查到服务、价目、地址、电话、营业时间，愿意到店
- 转化目标：**到店**（致电为辅）
- 图文策略：图片=**占位**（专业微距照已确认存在、待 FTP 交付；占位框为设计对象，固定文件名自动换图）；图标=`none`
- 语言策略：**中英双语·同页并列**（名片式，中文主行 + 英文辅行）；默认=zh；切换器=无（单页无路由）
- 参考站：无（风格参照物 = 店内招牌：烫金浅金 × 墨黑底 × 纸质米白墙 × 衬线英文 + 老宋中文）
- 技术栈：`plain-html`（D1–D8 判定与被排除项见 [tech-stack.md](tech-stack.md)）
- **页面粒度：single（单页 index）**
- **页内导航：anchor-jump（行内编号目录，仅指向查阅型区块：价目 / 到店信息）**
- 中轴：`center-axis`（hero/招牌居中，正文与价目行左对齐）
- 区块与尺寸：hero（含门头照位）✓ / 行内目录 ✓ / 服务与价目 ✓ / 手艺 ✓ / 机芯微距图廊 ✓ / 新到名表 ✓ / 到店信息（NAP，即信任条）✓ / 页脚 ✓；Contact 表单/邮箱/社交 = **不做**；主图（门头照）目标宽 620px（桌面）/全宽（手机）；图廊条目 320px；新到名表卡 300px
- 硬约束：FTP-only 交付、零构建、零外部运行时依赖、营业时间单点维护、新到名表「传图+一行清单」可月更、品牌卡三色三字体必须成立、手机价目可读性最优先

## G2 落定记录（v0.9.0 流程；自主模式下以本节为确认载体）

| 项 | 落定 | 依据 |
|---|---|---|
| 技术栈 | `plain-html` | pick_stack.py 得分 10；D3 排除其余全部 |
| IA | conversion | 转化目标=到店 |
| 族 | editorial 编辑印刷族 | 两级收敛：文字成立/受众来查/图缺位期排版支撑；craft 撞批次、contemplative 无图不成立、nostalgic 是布景不是延续 |
| 锚点 | `editorial-hero` | 族内唯一同时满足内容量与 when 三条；never 不触碰 |
| 布局 | editorial-hero 原型 | 锚点绑定 |
| 中轴 | `center-axis` | 锚点注册表声明值；招牌=居中牌匾 |
| 底色档 | `paper`（品牌米白 #F7F4EE 覆盖预设值） | 品牌卡 L12 |
| 变体轴 | `a` 原值 | 本批次首次使用 editorial-hero 取原值档（emit_tokens.py 输出）；手机可读性由 18px 基准 + 1.75 行高 + 25px 价目数字承担；直角贴合印刷气质 |
| 字体对 | display **EB Garamond** × body **Lora** × cjk **zh-serif 宋体栈** | 品牌卡 L15-16「Garamond 老式感觉 + 老宋体」覆盖注册表默认 Playfair Display（fonts.json 锚点条目 audit 以 info 记录偏离，理由可溯源）；EB Garamond 作 display 首族全库唯一（quiet-luxury 首族为 Cormorant Garamond） |
| 视觉签名 | ①超大标题压过首屏 ②单一主 CTA+次要文字链接 ③图文交错左右交替 ④大标题负字距收紧 ⑤章节编号超大装饰 | layouts.md editorial-hero 签名菜单，与渔光照相馆组合不同 |
| 页面粒度 / 导航 | single / anchor-jump | pick_pages.py（见 content-profile.md） |
| 批次查重 | `ledger.py --check` **通过** | 锚点/底色档/中轴/display 字体与 yuguang-photo 全部错开 |

**锚点证伪条件（3 条）**：
1. 若最终图到位后发现专业微距照数量 ≥12 张且需要按表款浏览 → editorial-hero 的 hero+图廊结构撑不住，应换 `magazine-grid`
2. 若店主提出要在线预约/留言表单 → 说明转化目标变了，应重跑 Grill（转化目标）而非加组件
3. 若品牌方要求换成无衬线现代脸 → 字体对推翻，editorial 族不再成立，应回族选择

## 待补

见 [content-profile.md](content-profile.md)「待补」表：电话 `[待填]`、门头照 ×1、微距照 ×4、新到名表首月内容。
