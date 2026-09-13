# Content Profile — 辰光修表铺

## 画像（Grill 答案，B 系列原文不加工）

- **源与形态**：品牌卡纯文本附件 + 委托正文；`standalone` 独立站，FTP 上传闲置虚拟主机
- **受众**：持名片的老客户（回访查信息）+ 本地路过/转介绍的新客；单角色、公开、无需权限
- **成功定义**：在手机上 30 秒内查到「做什么、多少钱、几点开门、在哪、电话多少」，愿意到店
- **转化目标**：到店（致电为辅）；非购买/留资
- **内容量**：价目 6 条（一行属性）；照片专业（用户自述「专业微距，很清楚」）但**未随附件交付**；更新频率：营业时间年更、新到名表月更（照片）
- **设备**：手机优先（用户原话「手机上把价目和服务看清楚最重要」）；使用频率低（偶尔查询）
- **语言**：中英双语，名片式**同页并列**（中文主、英文辅行），默认中文，无切换器
- **维护者**：店主不动网站；其子（会 FTP）年更营业时间、月更新到名表
- **品牌资产**：品牌卡（色值 3 枚 + 字体偏好 + slogan + 双语牌号），无 logo 文件 → 用文字标（wordmark）排版成招牌
- **合规**：服务型（修表），非食品/医疗/金融，无专项红线；文案不使用极限词、不编造承诺与销量

## 排除

- 排除 `master-detail` / `multi-page` 粒度，因为 `pick_pages.py`：entries=6、depth=shallow、shareable=否、indexable=否、themes=0 → G4 规则 single（详见下段）
- 排除 `catalog-grid` 布局，因为条目仅 6 且图未到位（intake 约束表「内容密度低 → 排除 catalog-grid」）
- 排除 `split-narrative` 布局，因为无长文、受众耐心低（查信息不是读文章）
- 排除 `craft` 族（含 warm-hospitality / soft-organic / paper-ink），因为同批次 yuguang-photo 已用 craft 族（G1.6 锚点与字体唯一性查重）；且「卖空间体验 + 有环境摄影」两条不同时成立
- 排除 `contemplative` 族（quiet-luxury / japanese-ma），因为 families.md 前置硬条件「必须有高质量素材」——照片未交付，无图时整族不成立
- 排除 `nostalgic` 族，因为其手法是「借年代形式语言制造时间感」（做旧纸张/装饰艺术金箔）——本店要的是**延续真实招牌**（材质与字体是既有的），不是布景式复古；且 art-deco-glam 的 never 自认「材质感做不出来就假」
- 排除 `commerce` 族，因为价目是手艺服务报价（6 条、含面议），不是货架 SKU 目录；无购买目标
- 排除 `grid` 族，因为品牌卡指定衬线 + 老宋（grid 族拒绝软性修饰、以无衬线等宽为主），与字体偏好冲突
- 排除 `expressive` / `vernacular` 族，因为 intake 约束表「多语言 → 排除依赖字宽精确控制/书法字形的风格」
- 排除 Contact 表单/邮箱/社交区块，因为 intake Q21「默认别做联系区，没明确要就不做」；到店型转化只需 NAP（地址/电话/时间，均来自品牌卡）

## 剩余空间

- 技术栈：只剩 `plain-html`，因为 D3=nontech 排除全部其余 6 个候选（见 tech-stack.md）
- IA：只剩 `conversion`（到店），因为转化目标=到店、无作品集合（portfolio 不成立）、无长文（narrative 不成立）、非台账日更（directory 不成立）
- 布局：只剩 `editorial-hero`，因为 editorial 族内：内容量否掉 editorial-print / longform-narrative（无长文）、magazine-grid（条目少且图未到位）；editorial-hero 的 when 三条全命中（强主张 slogan「时间交给手工」、先读到再行动、主视觉=门头照/微距照即将到位），never 两条不触碰（无并列 CTA；条目 6+图 ≤30）
- 风格：取 `editorial-hero`（编辑大标题），因为它是「一张有态度的社论开头」——与双语名片的印刷气质同源，图缺位期靠字阶/基线/编号独立成立，图到位后专业微距照恰好成为 hero 后的图文主角；中轴 `center-axis`（锚点注册表声明值，hero 居中如牌匾，正文左对齐）

## 图文策略

- 图片 = **占位**（「实体商品但暂时没图」档）：结构位先立（门头照位、微距图廊 4 槽、新到名表网格），占位框做成设计对象（墨底 + 浅金细框 + 双语标签 + 尺寸提示），绝不拿氛围图替代
- 照片到位机制：按固定文件名 FTP 上传 → `js/site.js` 自动换图（`onload` 换入 / 失败保留占位），零代码改动
- 图标 = `none`（锚点 iconPolicy）：严肃/极简，信息用文字排版承担；电话/地址不配图标

## 页面粒度与页内导航

- 页面粒度：single
- 页内导航：anchor-jump
- 页面清单：index（hero → 行内目录 → 服务与价目 → 手艺 → 机芯微距 → 新到名表 → 到店信息 → 页脚）
- 依据：价目 6 条、每条一行属性（entries=6, depth=shallow）；条目无需被单独分享或收录（shareable=否, indexable=否，本地服务查询场景）；除价目集合外无「各自成篇」的并列主题（themes=0）→ `pick_pages.py` 轴一 single；区块 6 个且含 1 个查阅型区块（价目表，到店信息同为查阅型 NAP）→ 轴二 anchor-jump，IA=conversion 的否决条款要求**锚点只指向查阅型区块、不给整页目录**，故行内目录只列「服务与价目」「到店信息」两个目标
- 被排除：master-detail（条目少且浅，拆页得到空洞详情页）、multi-page（无并列独立主题）、sticky-toc / section-rail（档位过重，会挤占手机首屏）、none（区块 ≥4 且有查阅型区块，纯翻到底解决不了定位）
- 证伪条件：若新到名表条目长期 ≥12 条且每条需独立说明 → 升 master-detail；若上线后 30 天内两个锚点均无点击 → 删导航降为 none；若移动端首屏被目录挤占超过 1/3 高度 → 降档

## 待补（指不回源的内容，页面上以 `[待填]` 红色虚线框显式标记）

| 字段 | 现状 | 需谁提供 | 页面上如何标记 | 位置 |
|---|---|---|---|---|
| contact.phone | 源里即为打码 `028-XXXX-XXXX` | 店主/用户 | `[待填]` 虚线框；填好后改 `index.html` 一处文字 + 一处 `tel:` | hero 联系行 + `#visit` |
| photos.storefront | 未交付 | 用户（FTP） | 占位框 `images/storefront.jpg`，传图即自动替换 | hero |
| photos.movements ×6 | 未交付（手艺区 2 张交错 + 图廊 4 张） | 用户（FTP） | 占位框 `images/movements/movement-1..6.jpg` | `#craft` / `#movements` 图廊 |
| photos.new-arrivals | 月更，尚无首月图 | 用户（FTP + 清单一行） | 空态文案；`js/new-arrivals.js` 加条目 | `#new-arrivals` |
| logo 文件 | 无（仅品牌卡文字） | 可选 | 不阻塞：文字标 wordmark 即招牌复刻 | hero / footer |
| 备案号 | 未提供 | 可选 | **不显示**（不编造）；README 说明备案后如何加 | footer（HTML 注释位） |
