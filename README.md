# GAME LAB

[![Pages](https://img.shields.io/badge/Live%20on-GitHub%20Pages-orange)](https://xanthanl.github.io/game-lab/)

A personal pile of frontend things — games mostly, plus a few sites and small tools
I wrote because I wanted them to exist. Everything you can click in the [live index](https://xanthanl.github.io/game-lab/)
runs straight in the browser: no install, no account, no build step on your side.

It is also a scratchpad for a recurring question — *how far can one HTML file go?*
The horror game, one survivor and one of the stage plays are each a single file with
zero dependencies, and eleven plays were each directed by a *different* coding agent from the
same one-line brief.

🔗 **<https://xanthanl.github.io/game-lab/>** · [中文说明](README.zh-CN.md)

---

## Play

| | What it is | Path |
|---|---|---|
| **新星漂移**<br>*Nova Drift* | Inertia-drift asteroid-belt survival in the spirit of Chasing Carrots' *Nova Drift*: three starting hulls, rocks split when shattered, seven enemy hulls — including tadpole swarms that turn faster, hit harder and arrive in bigger clumps every wave — and a build picked one-of-three per level from 22 modules that level up to LV6, each maxing into a gold breakthrough upgrade; boost, repair and overdrive pickups spawn on the field. Offscreen targets glow as faint same-color dots on the screen edge; ESC opens a pause panel with the full build and stats plus a restart; runs auto-cache and resume after a refresh or close. A mother-class boss — Mother Rock, Twin Rocks or the Void Eye — rises every 5th wave; clearing wave 15 opens endless drift. A 112 KB page with procedural WebAudio, a vendored particle engine and an adapted WebGL fluid nebula that sheds its own layers when a GPU can't keep up; keyboard + mouse or touch. | [`/nova-drift/`](https://xanthanl.github.io/game-lab/nova-drift/) |
| **微软大战代码**<br>*Microsoft vs. Code* | A meme-born PvZ parody with the whole meta-game ported to programmer lore: 5 chapters × 2 levels, each chapter a computing scenario (offline mode, merge-conflict waterway, legacy-code fog, a CORS wall where only lobbed bug reports work), 11 cards, 11 enemies, star drops, an npm shop run by the rubber duck, a side-project garden watered with `git commit`, a per-row Ctrl+Z rescue, and a mobile card dock. | [`/microsoft-vs-code/`](https://xanthanl.github.io/game-lab/microsoft-vs-code/) |
| **植物大战僵尸**<br>*Plants vs Zombies* | Full recreation: 23 levels, 6 worlds, 26 plants, 17 zombies, 2 bosses, sun economy and wave pacing. Every sprite is drawn in vector code — not one game image in the folder. | [`/PVZ/`](https://xanthanl.github.io/game-lab/PVZ/) |
| **强渡火星**<br>*Forcing Mars* | Slay-the-Spire-like deckbuilder: 30 cards, 12 relics, 6 potions, 4 classes, descending 3 layers from the Martian surface to a 2,000 m core. Real ending, bilingual. | [`/forcing-mars/`](https://xanthanl.github.io/game-lab/forcing-mars/) |
| **咒 · 怨宅**<br>*JYU / Cursed House* | First-person Chinese horror. 5 chapters / 6 maps, a DDA raycaster, and a ghost with BFS pathfinding, view cones and hearing that sharpens as the ritual progresses. Wardrobe hiding, breath-holding, procedural WebAudio. Ships with touch controls. | [`/cursed-house/`](https://xanthanl.github.io/game-lab/cursed-house/) |
| **欧陆风云 · 1444**<br>*Europa 1444* | Browser grand strategy on a hand-drawn Europe / North Africa / Anatolia map: 60+ countries at the 1444 bookmark, economy, diplomacy, war, sieges and historical events. Static, no build. | [`/europa/`](https://xanthanl.github.io/game-lab/europa/) |
| **Vampire 2D** | Top-down auto-attacking survival: 5 weapons, 6 passives, choose-one-on-level-up, bosses from 180 s and a Blood Frenzy event, 220 enemies on screen. A 45 KB single file; keyboard + mouse. | [`/Vampire-2D/`](https://xanthanl.github.io/game-lab/Vampire-2D/) |

## Watch

| | What it is | Path |
|---|---|---|
| **像素舞台剧 · 十一部**<br>*Persona* | One brief issued verbatim to 11 coding agents — *"create a subfolder and implement a pixel-art animated stage play in the frontend, script to performance, entirely frontend"* — and 11 answers: 5 adapt *Three-Body*, 5 independently put a lamp in the dark, 1 goes to a monster night market. 892 to 2,219 lines each. | [`/persona/`](https://xanthanl.github.io/game-lab/persona/) |
| **ASCII ∴ LAB** | Turns Chinese or Latin text into ASCII art: 6 fonts (incl. CJK faces), 4 glyph styles, 6 stroke sets (classic ramp, blocks, brush strokes, braille), with adjustable output width, gamma and threshold. Copy as image, save PNG, or copy plain text. | [`/ascii-art/`](https://xanthanl.github.io/game-lab/ascii-art/) |

## Use

| | What it is | Path |
|---|---|---|
| **树言 · 旅记**<br>*Shuyan Travel* | A private travel timeline: 53 long-form entries across 53 places — eight years of driving, then two years and a month walking the south-west → north-east diagonal from Yubeng to Hegang. Route map drawn with a locally vendored Leaflet. | [`/shuyan-travel/`](https://xanthanl.github.io/game-lab/shuyan-travel/) |
| **Electric Mirage** | Singles page for music released under the name *XanthanL*: 5 tracks streamed in place with buffer probing, retry, seek and auto-advance, bilingual. Also hosts *Choir of Static*, a track synthesized from scratch in numpy, with its own Web Audio visualizer. | [`/XanthanLMusic/dist/`](https://xanthanl.github.io/game-lab/XanthanLMusic/dist/) |
| **金价观象台**<br>*Golden Wind* | Gold dashboard, statically exported from Next.js: live quote, moving averages and golden/death-cross markers via lightweight-charts. | [`/golden-wind/out/`](https://xanthanl.github.io/game-lab/golden-wind/out/) |
| **ARH — Ideology Coordinate Test** | A 7-axis spectrum quiz in three lengths — 30 / 65 / 95 questions. | [`/ARH/dist/`](https://xanthanl.github.io/game-lab/ARH/dist/) |

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
├── nova-drift/           asteroid survival, vendored FX    (static)
├── europa/               1444 grand strategy               (static)
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
at all, and `nova-drift` keeps its one dependency vendored beside the page — double-clicking
any of their `index.html` over `file://` also just works, handy when you only want to play.

For the three build-based projects, install and rebuild in their own folder:

```bash
cd ARH            && npm install && npm run build   # → ARH/dist
cd XanthanLMusic  && npm install && npm run build   # → XanthanLMusic/dist
cd golden-wind    && npm install && npm run build   # → golden-wind/out
```

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
  (manifest in `forcing-mars/ART_ASSETS.md`), `shuyan-travel` vendoring Leaflet (BSD-2), and
  `nova-drift` vendoring Proton (MIT) plus a nebula layer adapted from
  PavelDoGreat/WebGL-Fluid-Simulation (MIT).
- *Plants vs Zombies* here is a mechanics study with **vector art drawn from scratch** — no
  original assets are included.
- *Nova Drift* here is a mechanics homage to the game by Chasing Carrots — all art is
  canvas-drawn code and all sound is synthesized in WebAudio; nothing is copied.
- The `persona/` folders keep their agent and model names as issued; they are results, not
  branding.

---

中文版说明见 [README.zh-CN.md](README.zh-CN.md)。
