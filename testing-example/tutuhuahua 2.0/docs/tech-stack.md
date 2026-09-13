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
- 字体加载:**零 webfont**(2026-09-13 修正)。原先按 fonts.json 的 loading=self 自托管了
  latin 子集(assets/fonts/,4 文件 ~125KB,font-display: swap);但环廊版全站可见文字只有
  中文和数字 —— 数字走 `--font-mono`(JetBrains Mono,从未自托管),中文两个栈都没有 CJK
  字形,自托管字体**零可见字形**,已移除。「中文系统栈零请求」这条不变。
- 部署:任意静态托管;国内访问建议国内主机 + ICP 备案(页脚已留位)

## 证伪条件

1. 若站点扩到第 2 个页面且区块 >8 个 → D1 判断错误,回退评估 astro
2. 若维护者要求在线增删画作、不碰任何文件 → D3/D4 判断错误,引入图床/CMS 重评
3. 若 40 张图全量上架后首页流量超 15MB 或微信内首屏可交互超 3s → D8 失守,构建期压缩或分辑加载

---

## 追记(2026-09-13)· 环廊模块 Phase 1.5 复核(skill v0.9.0)

> 整站改版为「环廊即整页」后,对技术栈做一次嵌入式复核(embedded → 确认宿主栈)。

- 宿主栈:**plain-html 维持**。环廊效果参考 Viscose carousel(Next + Three + GSAP),
  依赖**不进宿主**:以原生 WebGL 1 移植(一个全屏三角形 + 一个 fragment shader,
  零运行时依赖),GSAP 时间线以原生时序器替代。D8(lean/微信内打开)再次成立。
- 被排除:Three.js(GSL 封装只用得到 5% 体积;CDN 国内不稳,自托管 +600KB 不值)、
  GSAP(本效果只需 5 段补间,原生 40 行覆盖)、CSS 3D 轮播(表达不了 SDF 黏液融合)。
- 新增落地约束:WebGL 1 + OES_standard_derivatives;图集补边 ≤2048²(2 的幂);
  纹理加载挂起 4s 自动重试;`prefers-reduced-motion` 直切终态;
  WebGL 不可用 → 整区降级文字指引。
- 预览服务器:开发期用 `tools/dev-server.py`(no-store,改完即刷新),
  生产仍为任意静态托管。

原证伪条件不变;追加一条:
4. 若环廊在微信 iOS WebView 出现着色器编译失败/掉帧 >50% → 原生 WebGL 判断错误,
   降级为静态交错流兜底页。
