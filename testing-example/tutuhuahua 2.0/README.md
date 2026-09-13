# 涂涂画画 · 官网 v2(整站即环廊)

儿童美术教室「涂涂画画」的单页站:**整站就是一座黏液环廊**。
「涂涂画画」以片头字标开场,字标淡出后,孩子们的画作为竖版卡片沿一座
黏液圆环展开——相邻卡片触碰时熔融相连、拉出蜂蜜丝,上下边缘有玻璃折射。
效果移植自 [Viscose carousel](https://github.com/Yousuf-developer/Viscose-carousel)
(MIT),用**原生 WebGL 重写为零依赖版本**,决策与取舍见 `docs/references.md`。

## 操作

- **转环**:拖拽 / 鼠标滚轮 / 触屏左右滑 / 方向键(←→)
  (原先底部的操作条 —— 提示小字与左右箭头按钮 —— 已按作者要求整条移除,
  界面只剩画面本身;三条转环通路都不依赖它)
- **看大图**:点击正面的卡片(悬停会出现「看大图」标签),Esc 或 × 关闭
- 环有惯性并自动吸附到最近的卡片

## 上新画作(最常用)

1. 照片放进 `assets/art/inbox/`(jpg / png / webp)
2. 跑一次:
   ```
   python tools/build.py
   ```
3. 完成。环上自动多一张卡;画名/媒介在 `tools/works.json` 里补,再跑一次即可
   (build.py 会同步 index.html 里数据的版本号,微信等强缓存环境也能及时上新)

**环上限 32 件**(着色器 uniform 预算),当前 14 件;超出部分需要分辑时再议。
注意件数越多图集格位越小(见「体积与资源」)—— 想保住清晰度,与其往环上加件数,不如分辑。

**拍照建议**:画摆正、正上方拍、避开反光;「兼容性最佳」格式(iPhone)。

## 本地预览

```
python tools/dev-server.py        # 推荐:禁缓存,改完刷新即生效
```

浏览器开 http://localhost:8095 。纯静态文件,任意静态托管可上线。

## 项目结构

```
index.html              页面(环廊 + 灯箱)
css/tokens.css          设计 token(唯一真源;配 design-system/MASTER.md)
css/site.css            环廊与灯箱样式
assets/art/inbox/       ← 画作原图丢这里(构建输入,不发布)
assets/art/w-*.jpg      build 产物:灯箱大图(长边 ≤1400px)
assets/art/thumb/       build 产物:环廊图集源(长边 ≤720px)
tools/build.py          上架脚本(会同步 works-data.js 版本号)
tools/pack.py           发布打包 → dist/(只收运行时文件,并自检引用)
tools/probe-ring.py     渲染探针(无头 Chrome 量首屏请求 / 纹理尺寸 / 入场)
tools/dev-server.py     本地预览(no-store)
tools/works.json        画作信息(画名/媒介/作者/年龄)
js/works-data.js        画作数据(build 生成)
js/ring-carousel.js     环廊(原生 WebGL 移植,零依赖)
js/gallery.js           灯箱(window.LB.open 供环廊调用)
docs/                   选型与溯源文档(references / tech-stack / intent-summary / source-map)
design-system/MASTER.md 设计系统(token 值 + 视觉签名 + never 清单)
source/                 溯源素材(v1 沿用,不发布)
```

## 体积与资源(2026-09-13 实测)

首屏(环廊转起来所需的全部)约 **1.2 MB** —— 就是 14 张 `assets/art/thumb/*.jpg`。
大图 `w-*.jpg` 只在点开灯箱时按需加载。

- **环廊吃 thumb(≤720px),不吃大图。** 图集格位最长边 ≤1024,720 已够采样;
  拿 1400px 的大图去填 320px 的格位是纯浪费 —— 实测首屏会从 1.18 MB 涨到 1.98 MB。
  取值在 `js/ring-carousel.js` 的 `fetchInto`:`works[i].thumb || works[i].src`。
- **图集打包按件数自动选形状。** `buildAtlas` 把列数 1..n 扫一遍,取「格位最长边最大」
  的那一种。14 件 → 4 列 × 4 行,格位 **450×512**,图集 2048²(约 16 MB 显存,不含 mipmap)。
  改之前是从 640 起按 2 的幂降档,14 件装不下就直接掉到 **281×320**,画被放大 2.63 倍。
  件数越多格位越小:20 件 409×466,32 件 299×341 —— 环上限 32 件这条约束仍在。
- **不加载任何 webfont。** 全站可见文字只有中文和数字:数字走 `--font-mono`
  (JetBrains Mono,从未自托管),中文两个字体栈都没有 CJK 字形 —— 原先自托管的
  Cormorant Garamond / Jost 一个可见字形都落不到,已移除(省 140 KB)。
  token 里的字体栈保留不删:将来真要加拉丁文,把字体按名字放回去即可。

## 发布

```
python tools/pack.py          # 生成 dist/(约 3.2 MB,34 个文件)
python tools/pack.py --zip    # 顺手打个 zip
```

`assets/art/inbox/`(原图 12 MB)和 `source/`(7.5 MB)是构建输入与溯源素材,
**不进 dist/**。整目录上传会把它们一起送上服务器 —— 用 pack.py,别手动传整个文件夹。
pack.py 会顺带自检:解析 index.html 的 `src`/`href`,确认每个引用在 dist/ 里都存在。

## 改完怎么验

```
python tools/probe-ring.py                              # 桌面视口 1512×870
python tools/probe-ring.py --width 390 --height 844     # 手机视口
```

无头 Chrome 真跑一遍,打出「请求了哪些图 / 首屏多少 MB / 图集多大 / 入场走到哪」。
环廊的毛病大多**不报错、只是静默变差**(图集降档、图源换错、入场卡住)—— 这条命令能抓住。
软件渲染下虚拟时钟走得慢,入场时间线不一定在预算内走完,那只是探针的局限;
真出错会明确报 `[失败]`。

## 兼容与降级

- WebGL 1 + OES_standard_derivatives(近十年浏览器全覆盖);缺失时整区降级为一行指引
- `prefers-reduced-motion`:跳过入场动画,直接呈现可交互的环
- 手机竖屏:两侧铭牌退场,画名/媒介走底部一行
- 交互:滚轮/拖拽已被环廊占用,页面本身不滚动

## 与旧版(v2 交错流 / v1 网格)的关系

前两版(展签网格、交错作品流)已被本版整体替代:同样的画作数据管线,
不同的展示哲学——从「翻看一面墙」变成「走进一座环廊」。
