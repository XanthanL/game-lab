# GAME LAB

[![Pages](https://img.shields.io/badge/Live%20on-GitHub%20Pages-orange)](https://xanthanl.github.io/game-lab/)

A personal pile of frontend things — games mostly, plus a few sites and small tools
I wrote because I wanted them to exist. Everything you can click in the [live index](https://xanthanl.github.io/game-lab/)
runs straight in the browser: no install, no account, no build step on your side.

It is also a scratchpad for a recurring question — *how far can one HTML file go?*
The horror game, the survivor game and one of the stage plays are each a single file with
zero dependencies, and eleven plays were each directed by a *different* coding agent from the
same one-line brief.

🔗 **<https://xanthanl.github.io/game-lab/>** · [中文说明](#中文说明)

---

## Play

| | What it is | Path |
|---|---|---|
| **咒 · 怨宅**<br>*JYU / Cursed House* | First-person Chinese horror. 5 chapters / 6 maps, a DDA raycaster, and a ghost with BFS pathfinding, view cones and hearing that sharpens as the ritual progresses. Wardrobe hiding, breath-holding, procedural WebAudio. Ships with touch controls. | [`/cursed-house/`](https://xanthanl.github.io/game-lab/cursed-house/) |
| **强渡火星**<br>*Forcing Mars* | Slay-the-Spire-like deckbuilder: 30 cards, 12 relics, 6 potions, 4 classes, descending 3 layers from the Martian surface to a 2,000 m core. Real ending, bilingual. | [`/forcing-mars/`](https://xanthanl.github.io/game-lab/forcing-mars/) |
| **植物大战僵尸**<br>*Plants vs Zombies* | Full recreation: 23 levels, 6 worlds, 26 plants, 17 zombies, 2 bosses, sun economy and wave pacing. Every sprite is drawn in vector code — not one game image in the folder. | [`/PVZ/`](https://xanthanl.github.io/game-lab/PVZ/) |
| **微软大战代码**<br>*Microsoft vs. Code* | A meme-born PvZ-shaped parody: defend a code-editor lawn with console.log, rubber ducks and `rm -rf` against Clippy, IE and forced Windows updates. Coffee economy, a git-revert shovel that refunds half, and enemies that force-reboot your units. | [`/microsoft-vs-code/`](https://xanthanl.github.io/game-lab/microsoft-vs-code/) |
| **Vampire 2D** | Top-down auto-attacking survival: 5 weapons, 6 passives, choose-one-on-level-up, bosses from 180 s and a Blood Frenzy event, 220 enemies on screen. A 45 KB single file; keyboard + mouse. | [`/Vampire-2D/`](https://xanthanl.github.io/game-lab/Vampire-2D/) |
| **六边智将**<br>*Hexachess* | Hexa Sort mechanics wearing chess: 50 levels on 19/37/61-cell hex boards, locked cells and decoys unlocking gradually, and a board you can spin by dragging empty space. One TypeScript core builds both the browser demo and a WeChat mini-game; 80 unit tests. | [`/hexachess/`](https://xanthanl.github.io/game-lab/hexachess/) |

## Watch

| | What it is | Path |
|---|---|---|
| **像素舞台剧 · 十一部**<br>*Persona* | One brief issued verbatim to 11 coding agents — *"create a subfolder and implement a pixel-art animated stage play in the frontend, script to performance, entirely frontend"* — and 11 answers: 5 adapt *Three-Body*, 5 independently put a lamp in the dark, 1 goes to a monster night market. 892 to 2,219 lines each. | [`/persona/`](https://xanthanl.github.io/game-lab/persona/) |
| **ASCII ∴ LAB** | A studio for turning Chinese or Latin text into ASCII art: 8 CJK fonts, 6 character sets (blocks, dots, brush strokes, braille), export to PNG / TXT — plus 14 animated scenes from the spinning donut to Mandelbrot. | [`/ascii-art/`](https://xanthanl.github.io/game-lab/ascii-art/) |

## Use

| | What it is | Path |
|---|---|---|
| **树言 · 旅记**<br>*Shuyan Travel* | A private travel timeline: 53 long-form entries across 53 places — eight years of driving, then two years and a month walking the south-west → north-east diagonal from Yubeng to Hegang. Route map drawn with a locally vendored Leaflet. | [`/shuyan-travel/`](https://xanthanl.github.io/game-lab/shuyan-travel/) |
| **Electric Mirage** | Singles page for music released under the name *XanthanL*: 5 tracks streamed in place with buffer probing, retry, seek and auto-advance, bilingual. Also hosts *Choir of Static*, a track synthesized from scratch in numpy, with its own Web Audio visualizer. | [`/XanthanLMusic/dist/`](https://xanthanl.github.io/game-lab/XanthanLMusic/dist/) |
| **金价观象台**<br>*Golden Wind* | Gold dashboard, statically exported from Next.js: live quote, moving averages and golden/death-cross markers via lightweight-charts. | [`/golden-wind/out/`](https://xanthanl.github.io/game-lab/golden-wind/out/) |

## Per-project docs

This file is the index; the detail stays where it belongs. Four documents survive inside
their projects and are worth opening:

| Doc | What's in it |
|---|---|
| [`PVZ/README.md`](PVZ/README.md) | The real manual: controls table, responsive/`devicePixelRatio` layout strategy, draw-call and gradient-cache performance notes, how to plug in a CC0 sprite atlas, `node test/smoke.js` |
| [`forcing-mars/README.md`](forcing-mars/README.md) | Not a manual — the game's story text, layer by layer down to 2000 m |
| [`XanthanLMusic/musics/README.md`](XanthanLMusic/musics/README.md) | *Choir of Static*: the numpy synthesis spec — timbre list, structure, mastering chain |
| `persona/<agent>-<model>-<title>/README.md` | 6 of the 11 plays carry their own notes, written by the agent that made them |

## Layout

```
game-lab/
├── index.html            the index above — typographic, no images, bilingual (中文/EN)
├── 404.html              Pages 404
├── assets/               shared stylesheet, shared i18n, share-card generator, site og image
├── cursed-house/         single-file raycast horror        (static)
├── forcing-mars/         Phaser 3 deckbuilder              (static, CDN)
├── PVZ/                  canvas tower defense              (static)
├── microsoft-vs-code/    meme parody tower defense         (static)
├── Vampire-2D/           single-file survivor              (static)
├── hexachess/            TS core → web demo + WeChat mini-game (esbuild)
├── persona/              11 pixel stage plays + sub-index  (static)
├── ascii-art/            ASCII text studio                 (static)
├── shuyan-travel/        travel timeline + map             (static, Leaflet vendored)
├── XanthanLMusic/        music site  → dist/ committed     (Vite + React 19)
├── golden-wind/          gold dashboard → out/ committed   (Next.js static export)
└── ARH/                  7-axis ideology quiz (30/65/95 questions) → dist/ committed (Vite + React)
```

The static folders need nothing but a server; anything ending in `dist/` or `out/` is a
**committed build artifact** — see [Deploying](#deploying).

## Running locally

Serve the folder **containing** this repo, not the repo itself — that way your local URLs
carry the same `/game-lab/` prefix Pages gives them:

```bash
cd ..                              # 到仓库的上一级
python -m http.server 8000
# → http://localhost:8000/game-lab/                首页
# → http://localhost:8000/game-lab/cursed-house/   任意子项目
```

This matters for `golden-wind`: its Next export hard-codes
`/game-lab/golden-wind/out/_next/...`, so serving the repo root as the document root gives
you a dashboard with every stylesheet and chunk 404ing — the page opens, but looks broken.
Everything else uses relative paths and survives either way.

The single-file games (`cursed-house`, `Vampire-2D`) and `ascii-art` have no external assets
at all, so double-clicking their `index.html` over `file://` also just works — handy when you
only want to play.

For the three build-based projects, install and rebuild in their own folder:

```bash
cd ARH            && npm install && npm run build   # → ARH/dist
cd XanthanLMusic  && npm install && npm run build   # → XanthanLMusic/dist
cd golden-wind    && npm install && npm run build   # → golden-wind/out
cd hexachess      && npm install && npm run build:web && npm test
```

`hexachess` additionally carries `game.js` / `game.json` / `project.config.json` for the
WeChat mini-game target — that side is opened with the WeChat devtools, not a browser.

## Deploying

`.github/workflows/pages.yml` publishes the **repository root as-is** on every push to `main`.
That single fact drives three conventions, and breaking any of them 404s a subproject:

1. **Artifacts are committed, not built in CI.** `ARH/dist`, `XanthanLMusic/dist` and
   `golden-wind/out` are in the tree on purpose — their `.gitignore`s deliberately do *not*
   ignore them. Edit a source, rebuild, commit both.
2. **Base paths are pinned to the `/game-lab/` subpath.** `ARH` and `XanthanLMusic` build with
   Vite `base: './'` (relative, so any mount point works); `golden-wind` must keep
   `basePath: '/game-lab/golden-wind/out'` in `next.config.mjs`, matching where `out/` actually
   lands. Next.js cannot resolve relative asset URLs, so that literal has to stay in sync.
3. **`.nojekyll` must stay.** Pages runs Jekyll over the artifact otherwise, and Jekyll
   silently drops `_next/` — the whole dashboard would deploy looking empty.

Share cards: `python assets/gen_share_cards.py` redraws the 600×800 `og.png` posters
(needs Pillow + numpy) referenced by the horror / PVZ / Mars pages and the site itself.

## Not in this repo

Anything that cannot run in a browser goes into a `local-only/` folder at the repo root,
which `.gitignore` excludes wholesale — never pushed, never deployed, never listed on the
index. Currently that holds:

- **Protocol Extract** — a Godot 4.5 project (engine binary, shaders, scene assets).
- **Minecraft** — a Fabric Java mod (gradle caches, world saves, jars).

So the index you see is exactly the set of things that ship: if a row is on it, it is in the
repo and live on Pages; if a project is not on it, it is not in the repo either.

## Credits & notes

- Original code and writing, apart from: *Forcing Mars* art/audio produced from prompts
  (manifest in `forcing-mars/ART_ASSETS.md`), and `shuyan-travel` vendoring Leaflet (BSD-2).
- *Plants vs Zombies* here is a mechanics study with **vector art drawn from scratch** — no
  original assets are included.
- The `persona/` folders keep their agent and model names as issued; they are results, not
  branding.

---

## 中文说明

这里放着我零散写下的前端东西，主要是游戏，外加几个自己用的小站和小工具。
首页上每一条只要能点开，就是已经部署好、直接玩的东西：不用装、不用注册、也不用你构建。

| 分区 | 项目 | 一句话 |
|---|---|---|
| 玩得 | **咒 · 怨宅** | 第一人称中式恐怖，5 章 6 张地图，单文件里的 DDA 光线投射 + 会听会寻路的怨灵，手机可玩 |
| 玩得 | **强渡火星** | 杀戮尖塔式卡牌构筑，30 卡 / 12 遗物 / 4 职业，从火星地表下潜到 2000 米地核，有结局 |
| 玩得 | **植物大战僵尸** | 完整复刻：23 关 6 世界、26 植物 17 僵尸 2 Boss，美术全部矢量代码绘制，没有一张图片 |
| 玩得 | **微软大战代码** | 梗图改编的恶搞塔防：console.log / 橡胶鸭 / rm -rf 守编辑器，对抗 Clippy 与强制更新，咖啡经济 + git revert 铲子 |
| 玩得 | **Vampire 2D** | 顶视角自动攻击生存，5 武器 6 被动，180 秒起出 Boss，同屏 220 只，45KB 单文件（键鼠） |
| 玩得 | **六边智将** | Hexa Sort 内核 + 国际象棋包装，50 关可旋转六边形棋盘，同一份 TS 逻辑出网页与微信小游戏 |
| 看得 | **像素舞台剧 · 十一部** | 同一句话发给 11 个 coding agent 得到的 11 部像素舞台剧，5 部三体、5 部黑夜与灯、1 部妖怪夜市 |
| 看得 | **ASCII ∴ LAB** | 把汉字写成 ASCII 图的工坊，6 套字符集、可导出 PNG/TXT，另附 14 个动画场景 |
| 用得 | **树言 · 旅记** | 53 篇旅行札记与 53 个地点，八年驾车之后两年多徒步走完西南—东北对角线，本地 Leaflet 画轨迹 |
| 用得 | **Electric Mirage** | 以 XanthanL 名义发的 5 首曲子，站内流式播放；另有 numpy 从零合成的《静电合唱团》与配套可视化 |
| 用得 | **金价观象台** | Next.js 静态导出的金价看板，实时报价 + 均线 + 金叉死叉 |

本地预览要从**仓库的上一级**起服务，这样 URL 才会和 Pages 一样带上 `/game-lab/` 段：
`cd .. && python -m http.server 8000`，然后开 `http://localhost:8000/game-lab/`。
在仓库根直接起服务会坑在金价看板上——它的产物里写死了 `/game-lab/golden-wind/out/_next/...`，
样式和脚本会整批 404，页面能开但像坏了。咒·怨宅、Vampire 2D、ASCII ∴ LAB 这几个单文件的
没有外部依赖，双击 `index.html` 用 `file://` 打开就能玩。

关于部署有三条规矩不能破，否则子项目上线就是 404：
**构建产物有意入库**（`ARH/dist`、`XanthanLMusic/dist`、`golden-wind/out`，改了源码要重新 build 再提交）；
**base 路径钉死在 `/game-lab/` 前缀下**（Vite 用相对 `./`，Next 的 `basePath` 必须逐段对上）；
**根目录的 `.nojekyll` 不能删**（不然 Jekyll 会把 `_next/` 静默丢掉）。

跑不进浏览器的工程统一放在仓库根下的 `local-only/`，这个目录被 `.gitignore` 整目录排除：
不推送、不部署、也不上首页。所以首页列出的就是全部会上线的东西 —— 一条能点，就说明它在仓库里、
也在 Pages 上；反过来没列出的项目，仓库里也没有它。

这份 README 只做总览。具体的东西仍留在各项目自己目录里：`PVZ/README.md` 是真正的操作表 +
实现要点（含 `node test/smoke.js` 回归测试），`forcing-mars/README.md` 是剧情文本而非文档，
`XanthanLMusic/musics/README.md` 记着《静电合唱团》的合成参数，11 部舞台剧里有 6 部带着
各自 Agent 写的说明。原先 `persona/README.md` 只有题目的一句话残句，已删除——那段原话现在
完整印在 [/persona/](https://xanthanl.github.io/game-lab/persona/) 页面上。
