# 涂涂画画 · 官网 v2(静奢 · 纸白)

儿童美术教室「涂涂画画」招生单页的第二版:静奢(quiet-luxury)风格,交错作品流。
孩子的画以大图慢流呈现,像奢侈品官网的 lookbook,而不是卡片网格(v1 的呈现方式,两版并存可对照)。

## 上新画作(最常用)

1. 照片放进 `assets/art/inbox/`(jpg / png / webp)
2. 跑一次:
   ```
   npm run build        # 或者:python tools/build.py
   ```
3. 完成。作品流自动上架,每 4 件自动分一辑

**改画名 / 标媒介 / 标年龄**:`tools/works.json`,按文件名改 `title / media / author / age`,保存后再跑 `npm run build`。

**拍照建议**(决定页面质感的关键):

- 画摆正、正上方拍、不要斜
- 避开灯光反光;尽量纯色/白墙背景,画铺满画面
- iPhone:「设置 → 相机 → 格式」选**兼容性最佳**(否则 heic 读不了)

## 填还没填的信息

页面所有青铜金虚线 `[待填]` 都要补:试听的年龄/人数/时长/费用、微信号、电话、地址、ICP 备案号。
改 `index.html` 对应位置;教室照片搜 `space-slot` 替换为 `<img>`。

## 本地预览

```
npm run serve        # 或者:python -m http.server 8081
```

浏览器开 http://localhost:8081 。

## 上线

纯静态文件,任意静态托管;国内建议国内主机 + ICP 备案(填页脚)。

## 项目结构

```
index.html              页面(文案、待填标记)
css/tokens.css          设计 token(唯一真源;配 design-system/MASTER.md)
css/site.css            布局与组件
assets/fonts/           自托管拉丁字体(Cormorant Garamond / Jost,latin 子集,OFL)
assets/art/inbox/       ← 画作原图丢这里
assets/art/             build 产物
tools/build.py          上架脚本
tools/works.json        画作信息(画名/媒介/作者/年龄)
js/works-data.js        画作数据(build 生成)
js/gallery.js           作品流渲染 + 灯箱
docs/                   选型与溯源文档(tech-stack / intent-summary / content-profile / source-map)
design-system/MASTER.md 设计系统(token 值 + 视觉签名 + never 清单)
```

## 与 v1 的区别(为什么要两版)

| | v1(tutuhuahua/) | v2(tutuhuahua 2.0/) |
|---|---|---|
| 风格锚点 | museum-modern 美术馆现代 | quiet-luxury 静奢 |
| 布局 | 展签卡片网格(2/3 列) | 交错作品流(5:7 栏,左右互换) |
| 底色 | 纯白 #FFFFFF | 纸白 #F9F7EF |
| 强调色 | 展签朱红 | 青铜金 |
| 标题字体 | 系统宋体栈 | Cormorant Garamond(拉丁)+ 衬线中文栈 |
| 节奏 | 扫读型网格 | 慢流型,每 4 件分辑 |

两版共用同一套画作数据管线(inbox → build.py),照片丢进哪一版的 inbox 就上哪一版。
