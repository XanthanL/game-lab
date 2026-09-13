# References — 参考站采集:Viscose carousel

> 来源:https://github.com/Yousuf-developer/Viscose-carousel(MIT,源码部分;
> 其 `public/` 内示例图与 PP Neue Montreal 字体**不在许可内**,一律未采用)
> 采集方式:git clone 到临时目录逐文件精读(README / BREAKDOWN / Carousel.jsx /
> planeShaders.js / params.js / atlas.js / tag.js / utils.js)

## 学什么(3 条)

1. **「一个 shader、一次绘制」的环形轮播架构**
   全部画作打包进一张纹理图集,卡片位置以 uniform 数组传入,fragment shader 里
   对所有卡片的圆角矩形 SDF 做 smooth-min 融合——黏液、蜂蜜丝、玻璃折射唇都是
   这一个距离场的副产品。移植时逐段保留了该 shader(smin / sdBridge /
   glassBend / simplex noise / 图集交叉渐变 / 光标标签反色),这是效果的灵魂。
2. **交互手感参数组**
   拖拽角速度直传 + 指数阻尼 + 「甩到快停时才吸附最近卡位」的 snap 算法、
   悬停的非对称快抓慢放(grab 0.14 / release 0.06)、点击偏心卡以距离开方计时
   转到正面——这些数值手感直接沿用(见 js/ring-carousel.js 参数区注释)。
3. **入场编排:计数器即闸门**
   种子出生 → 载入计数 001→100 → 计数落定环才出发 → 展开/转身/偏移落位。
   数字到位与环出发是同一时刻,等待感变成了仪式感。本站保留该编排。

## 不学什么(2 条)

1. **它的暗色实验向排版与字体**(PP Neue Montreal / Satoshi / Geist,后两者许可
   不明)——本站是纸白静奢的儿童美术教室,字体一律沿用宿主 token
   (Cormorant Garamond + 衬线中文 + Jost/mono),布局铭牌也按静奢重做。
2. **它的技术栈依赖**(Next.js + Three.js + GSAP + lil-gui)——宿主是 plain-html
   零构建,且面向国内托管。移植为**原生 WebGL 1**:一个全屏三角形 +
   一个 fragment shader,零外部依赖;GSAP 时间线以 ~40 行原生时序器替代;
   lil-gui 调参面板不进产物。

## 宿主适配(与原实现的差异清单)

| 项 | 原实现 | 本站 |
|---|---|---|
| 卡片 | 1.5:1 横版 | 竖版,比例按 works 数据实际宽高比自适应 |
| 邻居弦长 | 定值半径 | 随件数计算:弦长 ≈ 1.75 倍卡高(经用户两轮反馈定为疏朗档) |
| 滚轮 | 抓走全部滚动 | 整页即环廊后,滚轮=转环浏览(用户指定) |
| 点击 | 只转到正面 | 正面卡点击=打开灯箱看大图;标签只在正面卡出现 |
| 品牌 | 画布内字形动画,与卡重叠 | 片头字标:先独占画面,自淡出后环才出生,绝无重叠(用户指定) |
| 降级 | 无 | WebGL/扩展缺失 → 整区降级为文字指引 |
| 动效偏好 | 无 | prefers-reduced-motion:跳过入场直切终态 |
| 图集 | NPOT(依赖 WebGL2) | 补边到 ≤2048 的 2 的幂,WebGL1 即可跑满;加载挂起 4s 自动重试 |
