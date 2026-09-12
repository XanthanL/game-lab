# 技术栈选型(Phase 1.5)

> skill 版本:**v0.8.0** · `pick_stack.py` 实跑(非手工推演),输出见下。

## 输入判定(D1–D8)

- D1 页面规模:**single** —— 招生单页;沿用 v1 需求(Grill B2/Q5)
- D2 交互:**light**(作品流 + 灯箱:计数/翻页/键盘/Esc)—— layouts.md 多图条目硬规则
- D3 维护者:**nontech**(美术教室经营者)—— B 类推断,v1 未被推翻
- D4 数据源:**single-json**(js/works-data.js,tools/build.py 生成)—— 40+ 张图可持续上架
- D5 交付形态:**standalone** —— 用户新开子目录独立工程
- D6 多语言:**none**(纯中文)—— 国内家长
- D7 渲染:**static** —— 展示 + 留资
- D8 性能预算:**lean** —— 微信内手机打开;latin 字体子集自托管 125KB,零运行时

## 结论(pick_stack.py 实跑输出)

```
候选排序
  1. plain-html    纯静态 HTML + CSS     得分 10
       +3 单页,无需路由
       +2 交互轻,原生 JS 够用
       +2 非技术维护者,零构建
       +1 数据简单,运行期读取即可
       +2 首屏预算紧,无运行时
被排除
  × astro / eleventy / next / nuxt / hugo / vite-vanilla
    —— maintainer=nontech:维护者不能碰命令行 / Node 构建链
```

选定:**`plain-html`**。与 v1 同栈 —— 同一需求画像得出同一栈是排除了「默认继承」之后的
确定结论;**栈可以相同,锚点/底色/字体/布局必须错开**(见 ledger 查重,G1.6)。

## 该栈的落地约束

- 预览:`python -m http.server`(推荐);双击 index.html 亦可
- 内容更新:照片进 `assets/art/inbox/` → `python tools/build.py`;信息在 tools/works.json
- 字体加载:fonts.json 标注 loading=self → **latin 子集自托管**(assets/fonts/,4 文件 ~125KB,font-display: swap);中文系统栈零请求
- 部署:任意静态托管;国内访问建议国内主机 + ICP 备案(页脚已留位)

## 证伪条件

1. 若站点扩到第 2 个页面且区块 >8 个 → D1 判断错误,回退评估 astro
2. 若维护者要求在线增删画作、不碰任何文件 → D3/D4 判断错误,引入图床/CMS 重评
3. 若 40 张图全量上架后首页流量超 15MB 或微信内首屏可交互超 3s → D8 失守,构建期压缩或分辑加载
