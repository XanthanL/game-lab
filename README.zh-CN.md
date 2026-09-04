# GAME LAB

[![Pages](https://img.shields.io/badge/Live%20on-GitHub%20Pages-orange)](https://xanthanl.github.io/game-lab/)

这里放着我零散写下的前端东西——主要是游戏，外加几个自己用的小站和小工具。
首页上每一条只要能点开，就是已经部署好、直接玩的东西：不用装、不用注册、也不用你构建。

这也是我对一个反复出现的问题的草稿本——*一个 HTML 文件到底能走多远？*
恐怖游戏、Vampire 2D 和其中一部舞台剧，各自都收在一个零依赖的单文件里；
而十一部舞台剧，是同一句话分别交给 11 个 coding agent 各自导出来的。

🔗 **<https://xanthanl.github.io/game-lab/>** · [English](README.md)

---

## 游戏

| | 是什么 | 路径 |
|---|---|---|
| **奇点回响**<br>*Singularity Echo* | 惯性漂移的星域 roguelike 弹幕射击：三艘船体拖着彗尾出击，27 种模块升到 LV6 触发镀金质变，每 5 波巨像降临（母岩 / 虚空之眼 / 双子 / 九首巨兽 / 环带狱卒 / 终焉回响），第 30 波肃清星域通关后可无尽漂移；屏外目标在屏幕边缘有同色亮点指方向，ESC 看构建与状态，进度自动缓存、关页可续；260KB 单页，内置粒子引擎与 WebGL 星云（跑不动会自动降档），键鼠或触屏。 | [`/singularity-echo/`](https://xanthanl.github.io/game-lab/singularity-echo/) |
| **微软大战代码**<br>*Microsoft vs. Code* | 梗图改编的恶搞塔防：5 章 10 关把 PvZ 元游戏全搬进程序员世界——离线机房 / 冲突水道 / 祖传迷雾 / 跨域高墙，★ 经济 + npm 商店（鸭店主）+ 副业花园 + 每行 Ctrl+Z，手机可玩。 | [`/microsoft-vs-code/`](https://xanthanl.github.io/game-lab/microsoft-vs-code/) |
| **植物大战僵尸**<br>*Plants vs Zombies* | 完整复刻：23 关 6 世界、26 植物 17 僵尸 2 Boss，阳光经济与波次节奏。美术全部矢量代码绘制，仓库里没有一张游戏图片。 | [`/PVZ/`](https://xanthanl.github.io/game-lab/PVZ/) |
| **强渡火星**<br>*Forcing Mars* | 杀戮尖塔式卡牌构筑：30 卡 / 12 遗物 / 6 药水 / 4 职业，从火星地表下潜到 2000 米地核。有真实结局，中英双语。 | [`/forcing-mars/`](https://xanthanl.github.io/game-lab/forcing-mars/) |
| **咒 · 怨宅**<br>*JYU / Cursed House* | 第一人称中式恐怖：5 章 6 张地图，单文件里的 DDA 光线投射；怨灵会 BFS 寻路、有视野锥，仪式推进后听觉变灵敏。衣柜躲藏、屏息机制、程序化 WebAudio，手机可玩。 | [`/cursed-house/`](https://xanthanl.github.io/game-lab/cursed-house/) |
| **欧陆风云 · 1444**<br>*Europa 1444* | 浏览器大战略：手绘欧洲 / 北非 / 安纳托利亚地图，60+ 国家 1444 开局，经济 / 外交 / 战争 / 围城 / 历史事件，纯静态无构建。 | [`/europa/`](https://xanthanl.github.io/game-lab/europa/) |
| **Vampire 2D** | 顶视角自动攻击生存：5 种武器 6 种被动，升级三选一，180 秒起遭遇 Boss 并有鲜血狂潮事件，同屏 220 只。45KB 单文件，键鼠。 | [`/Vampire-2D/`](https://xanthanl.github.io/game-lab/Vampire-2D/) |

## 实验

| | 是什么 | 路径 |
|---|---|---|
| **像素舞台剧 · 十一部**<br>*Persona* | 同一句话原封不动发给 11 个 coding agent——「新建子目录，在前端实现一部像素动画舞台剧，从剧本到演出，纯前端」——得到 11 个答案：5 部改编《三体》，5 部各自在黑暗里点了一盏灯，1 部进了妖怪夜市。每部 892–2219 行。 | [`/persona/`](https://xanthanl.github.io/game-lab/persona/) |
| **ASCII ∴ LAB** | 把汉字或英文写成 ASCII 图：6 种字体（含 CJK 字形）、4 种字形、6 套笔触（经典字符、方块、笔刷、盲文），输出宽度 / gamma / 阈值可调，可复制图片、存 PNG 或复制纯文本。 | [`/ascii-art/`](https://xanthanl.github.io/game-lab/ascii-art/) |

## 站点

| | 是什么 | 路径 |
|---|---|---|
| **树言 · 旅记**<br>*Shuyan Travel* | 私人旅行时间线：53 篇长文札记、53 个地点——八年驾车，之后两年零一个月徒步走完西南→东北对角线（雨崩到鹤岗）。路线用本地 vendored 的 Leaflet 画。 | [`/shuyan-travel/`](https://xanthanl.github.io/game-lab/shuyan-travel/) |
| **Electric Mirage** | 以 XanthanL 名义发的 5 首曲子，站内流式播放（缓冲探测 / 重试 / 拖动 / 自动续播），中英双语。也收录《静电合唱团》——一首用 numpy 从零合成、自带 Web Audio 可视化的曲子。 | [`/XanthanLMusic/dist/`](https://xanthanl.github.io/game-lab/XanthanLMusic/dist/) |
| **金价观象台**<br>*Golden Wind* | 金价看板，Next.js 静态导出：实时报价 + 均线 + 金叉 / 死叉标记（lightweight-charts）。 | [`/golden-wind/out/`](https://xanthanl.github.io/game-lab/golden-wind/out/) |
| **ARH — 意识形态坐标测试** | 7 个维度的光谱定位问卷，30 / 65 / 95 题三档。 | [`/ARH/dist/`](https://xanthanl.github.io/game-lab/ARH/dist/) |

## 各项目文档

本文件只做总览，细节留在各自目录里。四个文档值得打开：

| 文档 | 内容 |
|---|---|
| [`PVZ/README.md`](PVZ/README.md) | 真正的操作手册：按键表、响应式 / `devicePixelRatio` 布局策略、draw-call 与渐变缓存性能笔记、如何接入 CC0 贴图集、`node test/smoke.js` |
| [`forcing-mars/README.md`](forcing-mars/README.md) | 不是手册，是游戏剧情文本，逐层下潜到 2000 米 |
| [`XanthanLMusic/musics/README.md`](XanthanLMusic/musics/README.md) | 《静电合唱团》：numpy 合成规格——音色表、结构、母带链 |
| `persona/<agent>-<model>-<title>/README.md` | 11 部里有 6 部自带 agent 写的说明 |

## 目录结构

```
game-lab/
├── index.html            上面的总索引——排版驱动，无图片，中英双语
├── 404.html              Pages 404
├── assets/               共享样式、共享 i18n、分享卡生成器、站点 og 图
├── cursed-house/         单文件光线投射恐怖          (static)
├── forcing-mars/         Phaser 3 卡牌构筑           (static, CDN)
├── PVZ/                  canvas 塔防                (static)
├── microsoft-vs-code/    梗图恶搞塔防               (static)
├── Vampire-2D/           单文件生存                 (static)
├── singularity-echo/   星域 roguelike 弹幕射击，vendored 特效 (static)
├── europa/               1444 大战略                (static)
├── persona/              11 部像素舞台剧 + 子索引    (static)
├── ascii-art/            ASCII 文字工坊             (static)
├── shuyan-travel/        旅行时间线 + 地图          (static, Leaflet vendored)
├── XanthanLMusic/        音乐站 → dist/ 已提交      (Vite + React 19)
├── golden-wind/          金价看板 → out/ 已提交     (Next.js 静态导出)
└── ARH/                  7 维意识形态问卷 (30/65/95 题) → dist/ 已提交 (Vite + React)
```

静态目录只需要一个服务器；凡是 `dist/` 或 `out/` 结尾的都是**已提交的构建产物**——见[部署](#部署)。

## 本地预览

要从**仓库的上一级**起服务，这样 URL 才会和 Pages 一样带上 `/game-lab/` 段：

```bash
cd ..                              # 到仓库的上一级
python -m http.server 8000
# → http://localhost:8000/game-lab/                首页
# → http://localhost:8000/game-lab/cursed-house/   任意子项目
```

这一点对金价观象台很关键：它的 Next 导出把 `/game-lab/golden-wind/out/_next/...` 写死了，
如果把仓库根当文档根起服务，所有样式和脚本会整批 404——页面能开但像坏了。
其余项目都是相对路径，两种起法都行。

单文件游戏（咒·怨宅、Vampire 2D）和 ASCII ∴ LAB 没有任何外部资源，奇点回响把唯一的依赖
vendored 在页面旁边——这几个双击 `index.html` 用 `file://` 打开就能用，随手玩一局最方便。

三个带构建的项目要在各自目录里装依赖再重新构建：

```bash
cd ARH            && npm install && npm run build   # → ARH/dist
cd XanthanLMusic  && npm install && npm run build   # → XanthanLMusic/dist
cd golden-wind    && npm install && npm run build   # → golden-wind/out
```

## 部署

`.github/workflows/pages.yml` 在每次 push 到 `main` 时**原样发布仓库根目录**。
这一件事决定了三条规矩，破任何一条都会让子项目上线 404：

1. **构建产物有意入库，不在 CI 里构建。** `ARH/dist`、`XanthanLMusic/dist`、`golden-wind/out`
   是有意放进版本树的——它们的 `.gitignore` 刻意不忽略这些目录。改了源码就重新 build、两个都提交。
2. **base 路径钉死在 `/game-lab/` 子路径下。** ARH 和 XanthanLMusic 用 Vite `base: './'`
   （相对路径，挂哪都行）；golden-wind 必须在 `next.config.mjs` 里保持
   `basePath: '/game-lab/golden-wind/out'`，与 `out/` 实际落点一致。Next.js 解析不了相对资源
   URL，所以这行字面量必须逐段对上。
3. **根目录的 `.nojekyll` 不能删。** 否则 Pages 会跑 Jekyll，而 Jekyll 会把 `_next/` 静默丢掉——
   整个看板上线就是空的。

分享卡：`python assets/gen_share_cards.py` 重画 600×800 的 `og.png` 海报
（需要 Pillow + numpy），供恐怖游戏 / PVZ / 火星页面和站点本身引用。

## 不在本仓库

跑不进浏览器的工程统一放在仓库根下的 `local-only/`，这个目录被 `.gitignore` 整目录排除——
不推送、不部署、也不上首页。目前有：

- **Protocol Extract** — Godot 4.5 工程（引擎二进制、shader、场景资源）。
- **Minecraft** — Fabric Java 模组（gradle 缓存、世界存档、jar）。

所以首页列出的就是全部会上线的东西——一条能点，就说明它在仓库里、也在 Pages 上；
反过来没列出的项目，仓库里也没有它。

## 致谢与说明

- 代码与文字均为原创，除以下例外：强渡火星的美术 / 音频由 prompt 生成
  （清单见 `forcing-mars/ART_ASSETS.md`）；树言·旅记 vendored 了 Leaflet（BSD-2）；
  奇点回响 vendored 了 Proton（MIT），星云层改编自
  PavelDoGreat/WebGL-Fluid-Simulation（MIT）。
- 这里的植物大战僵尸是机制研究，**矢量美术全部从零绘制**——不含任何原作素材。
- 这里的奇点回响起步于对 Chasing Carrots《Nova Drift》的机制致敬——美术全部 canvas 代码绘制、
  音效全部 WebAudio 合成，没有任何复制。
- `persona/` 各目录保留下发时的 agent 与 model 名称；它们是实验结果，不是品牌标识。
