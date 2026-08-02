# 《强渡火星》美术资源清单

> 本文档记录当前实际在用的美术资源、规格与用途。
> 所有立绘类素材统一为**方形、深色火星洞穴渐晕底**（边缘融入 `#140806`），
> 游戏内用圆角矩形底板 + 遮罩承载，不依赖 PNG 透明通道。

## 美术风格基调

- 关键词：硬核科幻、暗铁锈红、火星地下、低饱和、2D 插画
- 主色调：背景 `#140806` / 金属边框 `#6a2a1a` / 能量 `#ff4444→#ff8844` / 科技 `#44aaff→#66ddff`
- 生成提示词公共后缀：
  ```
  painterly 2D game illustration, rust-red Mars underground palette, dramatic rim lighting,
  dark Mars cave background fading to near-black deep brown at all edges, strong vignette,
  square game portrait, high detail, no text
  ```

## 在用资源

### 背景（assets/backgrounds/）1920×1080 JPG

| 文件 | 用途 |
|---|---|
| `bg_surface.jpg` | 地表 · 0m 战斗背景 |
| `bg_shallow.jpg` | 地下浅层 · 500m 战斗背景 |
| `bg_core.jpg` | 地核深处 · 2000m / Boss 战背景 |

### 玩家立绘（assets/player/）512×512 PNG，四职业各一张

| 文件 | 职业 |
|---|---|
| `player_astronaut.png` | 宇航员 · 平衡的探索者 |
| `player_engineer.png` | 工程兵 · 护盾大师 |
| `player_mutant.png` | 异变者 · 状态操控者 |
| `player_assault.png` | 突击兵 · 连击杀手 |

### 敌人立绘（assets/enemies/）512×512 PNG

| 文件 | 敌人 | 出现层 |
|---|---|---|
| `enemy_mars_leech.png` | 火星幼蛭 | 地表 |
| `enemy_dune_stalker.png` | 沙丘跃行者 | 地表 |
| `enemy_red_crawler.png` | 红土爬行者 | 浅层 |
| `enemy_crystal_parasite.png` | 晶化寄生虫 | 浅层 |
| `enemy_deep_lurker.png` | 地底潜伏者 | 地核 |
| `enemy_mars_devourer.png` | 火星吞噬者（最终 Boss） | 地核 |

### UI（assets/ui/）

| 文件 | 规格 | 用途 |
|---|---|---|
| `ui_btn_endturn.png` | 280×64 | 结束回合按钮 |

> `ui_card_base.png` 已废弃（v21）：卡牌改为程序化绘制（js/main.js createCardGraphics），字体与主题见 js/theme.js。

### BGM（assets/bgms/）MP3

| 文件 | 用途 |
|---|---|
| `bgm_story.mp3` | 开场剧情 |
| `bgm_battle.mp3` | 普通战斗 |
| `bgm_boss.mp3` | Boss 战 |

## 已废弃（2026-07 清理）

以下资源因"从未被代码使用"或"假透明（棋盘格/白底烤进图内）"已删除：

- `bg_transition.png`（1MB，加载后从未显示）
- `player_avatar.png`、`ui_bar_bg.png`（加载后从未使用）
- `ui_depth_segment.png`、`vfx_laser_beam.png`、`vfx_shield_burst.png`、`vfx_hit_spark.png`、`vfx_charge_orb.png`（从未加载，特效均为代码 Graphics 绘制）

## 新增/替换素材约定

1. 立绘一律方形（512×512 或 1024×1024 后缩放），深色渐晕底，不要求透明通道。
2. 文件放入对应目录后，在 `js/main.js` 的 `preload()` 注册，并递增 `index.html` 中脚本的 `?v=` 版本号。
3. 敌人立绘在 `js/entities.js` 的敌人定义中通过 `sprite` 字段引用；玩家立绘通过 `CHARACTERS[*].sprite` 引用。
