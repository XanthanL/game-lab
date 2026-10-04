# 奇点旅途 SINGULARITY VOYAGE — project notes

像素风太空弹幕射击。纯静态站点（无构建）：`index.html`、`style.css`、`src/{i18n,audio,sprites,bulletskin,game}.js`、`assets/`（Fusion Pixel 12px 字体，OFL）。
**全游戏中英双语可切**（标题页右上角按钮，见「中英切换 i18n」一节）。

**血统**：画风与代码框架照搬 `last-firewall`（终焉防火墙），内容（船体 / 敌型 / 模块 / 波次）来自 `singularity-echo`（奇点回响）的重设计版。
本轮是**垂直切片**：5 船体 / 12 段航程 / 16 敌型 / 7 巨像 / 4 关卡形态 / 39 模块卡（含 MAX 质变 + 30 组协同），完整可通关，**打通后转入无尽深渊**。
39 张模块卡每一级都带一件**舰体配件**（画在飞船模型上，选不同能力长出不同外形 —— 见下面「舰体配件」一节）。

- 480x270 画布，`#wrap`（canvas + DOM 覆盖层）整体 CSS 缩放，UI 按游戏像素布局。

⚠️ **像素字号必须是 12 的整数倍**（12/24/36/48）。字体只有 12px 一档（Fusion Pixel），
  给 32px 就是 2.67 倍缩放 —— 像素网格对不齐、笔画糊边，而且**不抛异常、rect 也正常**，只有盯图才看得出。
  `sv-text.py` 有一条静态断言守着（纯读 `style.css`，在开浏览器之前跑）。
  ⚠️ 唯一的历史遗留是 `.tbtn`（触屏按钮）的 14px，探针会打印 NOTE 但放行 —— 想清掉就改成 12px。
- `src/sprites.js`：调色板字符串精灵 + 烘焙；`src/audio.js`：WebAudio 合成 BGM/SFX；`src/game.js`：其余全部（船体在 `HULLS`，敌型在 `ETYPES`，编队在 `SQUADS`，Boss 在 `BOSSES`，模块在 `MODULES`，协同在 `SYNERGIES`，波次导演在 `startWave`/`updateWave`）。
- 操作（**已向《奇点回响》看齐**，见下面「输入」一节的 `aimMode`）：**A/D 转向 · W 推进 · S 制动**；
  鼠标只负责画准星和「机头朝光标缓慢转」；**自动不开火**——按住左键或空格才射击。Shift/右键冲刺，E 超载。
- 船体外形：5 台船体的像素轮廓由 `.workbuddy/gen_hull.py` 从《奇点回响》的 `hullPath()` 矢量多边形
  **栅格化**得到（22×16 网格，`src/sprites.js` 的 `HULL_SRC`）。**要改轮廓就改脚本里的 `POLY` 再重跑，别手改字符画。**
- 关卡制：12 段主线（第 4/8/12 段是巨像）+ 无尽深渊（13 段起，每 5 段抬一档、每 4 段一只巨像轮换，见下「无尽深渊」）。
  清空全部敌人后跃迁下一段；打通第 12 段不清场结束、直接转入无尽。经验满 → 三选一模块。
- 存档：`localStorage['sv_save_v1']`（`SAVE`），存 best / 累计击坠 / 最远航段 / 通关次数 / 已解锁船体。
  老键 `sv_best` 在 `loadSave()` 里迁移，不要删。

## 中英切换（`src/i18n.js` + `data-i18n*`）

游戏纯静态、零构建，所以 i18n 也是一张扁平表 + 一个 `T()`，不引任何库。

**三条约定，都是为了「漏翻能被发现」而不是「静默退回中文」**：

1. **UI 文案走 `T('a.b.c')`**。缺键时 `T()` 返回 `⟪a.b.c⟫`（书名号键名），不是空串——
   屏幕上一眼能看到 `⟪...⟫`，探针 `sv-lang.py` 的 `domMissingMarks()` 也扫它。
2. **数据表（`MODULES` / `HULLS` / `ETYPES` / `BOSSES` / `SQUADS` / `SYNERGIES` / `ZONES`）的英文写在数据表自己身上**
   （`nameEn` / `descEn` / `traitEn` / `tagEn` / `textEn`），用 `L(obj, 'name')` 取。
   这样「加一张新卡」时中英文在同一处，不会漏。
3. **zh / en 两张 UI 表的键集合必须完全一致**，探针 `sv-lang.py` 的 `__dbg.i18nMissing()` 逐键比对，
   再扫所有六张数据表的 `*En` 字段是否非空。

**实现要点**：

- `LANGS = ['zh', 'en']`，存 `localStorage['sv_lang_v1']`，启动时读出来覆盖默认（默认 zh）。
- `isEn()` / `setLang(l)` / `toggleLang()`：切完调 `applyDom()`（刷 DOM 的 `data-i18n`/`-html`/`-title`）
  + `langRefresh()`（game.js 在 `boot()` 里注册，重画 `renderTitle/renderHangar/drawCodex/renderCards/renderPause/renderOver`）。
- ⚠️ **`langRefresh()` 只重画、绝不切状态机**。切语言时顺手 `toTitle()` 会把打到一半的人踢回标题页。
- **船体 / 巨像 / 星区三张表**故意不走 `L()` —— 它们有「中文名 + 英文副标题」的 `en` 字段
  （机库卡面中文模式显示「游隼」+「PEREGRINE」）。用 `name1(o)`（英文选 `o.en`，否则 `o.name`）
  和 `sub1(o)`（英文模式返空字符串），保留双语观感。
- ⚠️ **DOM 上的 `.ov` 显隐别再用 `display` 控制**，用 `#wrap.showlang` —— `display:none` 会顶掉
  `.ov > *:first-child:last-child { margin-top/bottom:auto }` 的居中，标题页内容直接塌。
- ⚠️ **画在画布上的字**（HUD / 横幅 / 准星）每帧重画，**自动跟随语言**。但横幅对象 `G.banners`
  里存的是**生成时的字符串**——切语言不会自动刷新它们（横幅 ≤ 2.6 秒消失，可接受）。
- ⚠️ **英文版固定高卡片**（`.card` 178px / `.hull` 168px）的描述宽度硬约束：
  `.card .desc` 116px 宽、12px 半角字 = **每行 ≤ 19 字符、≤ 3 行**；
  `.hull .hdesc` 78px 宽 = **每行 ≤ 13 字符、≤ 5 行**（用词折行模拟）。
  `banner` 副标题画在画布上 480px 宽 = **每行 ≤ 78 字符、≤ 1 行**。
  `.workbuddy/sv-i18n-lint.py`（纯读源码）守住这些阈值。
- `__dbg` 加了：`lang` / `setLang` / `toggleLang` / `uiKeys` / `i18nMissing` / `domMissingMarks`。

**新加 UI 文案**：要么加到 `UI.zh` 和 `UI.en`（保持键集合一致），要么加到对应数据表的 `*En` 字段。
加完跑 `python .workbuddy/sv-i18n-lint.py`（静态体检）+ `python .workbuddy/sv-lang.py`（端到端）。

## 三条硬纪律

1. **全局命名不能撞车。** 三个 js 都是普通 script（非 module），共享全局作用域。已经踩过两次：
   - `sprites.js` 的烘焙集合和 `game.js` 的船体数据表都叫 `HULLS` → `Identifier 'HULLS' has already been declared`，整页白屏。
     现在烘焙集合叫 `SHIPSET`。
   - **探针注入的脚本也算**。`.workbuddy/sv-balance.py` 里的 `var lastT` 撞上 `game.js` 的 `let lastT`
     → game.js 整份解析失败、`boot` 根本没定义、页面停在 loading。
     ⚠️ 而且**只在探针页复现**，直接开 index.html 完全正常 —— 极难定位。
     **注入脚本的全局名一律加前缀**（`balLog` / `balOut` / `balPost` / `balTicks`），别用 `out`/`t`/`st`/`lastT` 这种大众名。
   **新增全局常量前先 grep 三个文件 + 两个探针脚本。**
2. **精灵缓存的 key 必须是有界集合。** `_bcache`/`_gcache`/`tcache` 与 bulletskin 的 `BSHAPE_CACHE`/`BDECO_CACHE` 存 canvas，
   绝不把逐帧变化的量（alpha、浮点半径）写进 key，否则每帧泄漏一个 canvas、几分钟后 GPU 内存耗尽。
   要淡出就在 draw 时用 `drawGlow(ctx, color, R, alpha, x, y)` 改 `globalAlpha`
   （`glowSprite(color, R)` 本身不带 alpha 参数，key 只有 `color|R|1`，所以安全）。
   子弹外观的三层缓存 key 只能是**有限枚举字符串**（家族/等级/尺寸/具名配色/装饰名，见「子弹外观系统」一节），
   超出 `BCACHE_MAX(56)` 走 LRU 淘汰 —— 探针穷举 1008 种组合实测封顶不涨。
   ⚠️ 别拿 `tinted()` 去改玩家弹的颜色，那会把弹芯的白色一起吃掉、弹丸糊成一坨色块；
   要新配色就在 `bulletskin.js` 的 `BTINT` 表里加一行具名三色。
3. **弹幕可读性**：友方 = 青白/金色细针（画在敌人**下**层），敌方 = 红/粉/紫描边圆弹（画在**最上**层）。新颜色只能在这两个色族里加。
4. **`o.xxx ?? 表达式` 里的标识符必须在函数作用域里有声明。** 踩过：`pBullet` 写
   `decel: o.decel ?? (kind === 'main')`，而 `kind` 只在对象字面量里出现过（`kind: o.kind || 'main'`），
   作用域里**没有** `kind` 这一个变量 → 调用方不传 `decel` 时（无人机弹、裂变弹片）
   那一侧一定被求值 → `ReferenceError: kind is not defined`，整帧更新中断。
   ⚠️ 危险在于**主炮 / 散射 / 尾炮都显式传了 `decel: true`**，普通试玩和大部分探针都碰不到，
   只有开到无人机或裂变弹片才炸 —— 靠手测几乎发现不了。
   现在 `pBullet` 顶部有一行 `const kind = o.kind || 'main';` 作为唯一真相源。
   **教训：`??` 的右值不是「默认值摆设」，它在左值缺失时一定会跑。**

## 敌型设计原则（第二批定下的）

新增敌型必须**改变玩家的决策**，不能只是换血量：

| 敌型 | AI | 机制 | 玩家的新决策 |
|---|---|---|---|
| 织网者 | `weave` | 往你前进方向前方铺减速蛛网（`G.webs`） | 走位要读图，不能直线冲 |
| 牧者 | `shepherd` | 半径 `aura` 内敌人持续回血 + 加速（`e.buffT`） | 必须优先点掉，否则这一波清不完 |
| 新星 | `chase` + `deathRing` | 死亡炸一圈弹幕（从 `r+6` 处生成，留一条缝） | 杀它的位置很重要 |
| 铁壁 | `guard` | 正面装甲吃掉 75% 伤害（`dx·facing < -0.35`） | 必须绕到侧后方 |

**已知副作用（有意保留）**：`damageEnemy` 的 `dx,dy` 传 `0,0` 时 `dot === 0`，不触发格挡
→ 电弧线圈（`updateAbilities`）无视铁壁装甲。当作「电击绕过装甲板」的设定，不是 bug。

## 无尽深渊（endless 模式）

打通第 12 段不清场结束，直接转入无尽（HUD 段数标签从「第 N/12 段」变成「第 N 段 · 深渊 K 档」）。
全部常量在 `game.js` 顶部的 `ENDLESS_FROM` 一带：

| 常量 | 值 | 含义 |
|---|---|---|
| `ENDLESS_FROM = WAVES + 1` | 13 | 无尽从 13 段起 |
| `ENDLESS_EVERY` | 5 | 每 5 段抬一档 |
| `TIER_HP` | 1.14 | 每档敌血 ×1.14（指数，**不封顶**）|
| `TIER_DMG` | 1.08 | 每档敌伤 ×1.08 |
| `TIER_SPD` / `TIER_SPD_CAP` | 1.03 / 1.5 | 每档敌速 ×1.03，封顶 1.5 倍 |
| `TIER_EXTRA` / `TIER_EXTRA_CAP` | 1 / 10 | 每档多 1 只杂兵，封顶 +10 |
| `ENDLESS_BOSS_EVERY` | 4 | 无尽里每 4 段一只巨像 |

- `eTier(w)`：档位序号，主线恒 0；`eTierHp / eTierDmg / eTierSpd / eTierExtra` 把档位换算成乘数。
  **这些乘数只作用于敌人**（杂兵在 `hpScale()`、敌弹在 `eShot()` 自带 `dmg`、接触伤害在 `spawnEnemy` 的 `e.dmg`、
  巨像在 `spawnBoss` 的 `hp`）。**玩家数值一律不随档位变。**
- ⚠️ **线性成长在主线末段封顶**：`hpScale()` 的线性项是 `(1 + (min(w, WAVES) - 1) * 0.11) × eTierHp(w)`。
  若线性项不封顶，线性和指数会在高段叠乘失控（wave 50 ≈ 6.4 × 2.85 ≈ 18 倍血）。
- **巨像轮换袋 `bagPickBoss()`**：`BOSS_BAG` 装全部巨像的 key，洗牌后逐次 `pop()`，空了才重洗 ——
  一轮里各来一次，不连出同一只。⚠️ **只在 `startWave` 里调一次**（`bossForWave` 有副作用抽走一张），
  任何「预判式」重复调用都会白白吃掉一轮轮换（见下 `irand` 铁律）。
- **主线巨像也轮换**（2026-10-03）：`rollMainBosses()` 每局开局洗牌抽 3 只填进 4/8/12 段，
  存在 `G.mainBosses`。`bossForWave(w)` 主线读它，`BOSS_WAVES` 只剩「G 还没建立时的兜底 / 图鉴预览」。
  理由：巨像扩到 7 只之后，主线还钉死「4 母岩 8 狱卒 12 之门」的话，新做的四只只有进无尽才见得到。
  ⚠️ 一轮内不重复（取洗牌后前 3 个）；7 ≥ 3 才成立，巨像要是被砍到少于 3 只得改成允许跨轮重洗。
- **巨像血量 = `b.hp`（基准）× `bossSlotMul(w)` × `eTierHp(w)`**。
  ⚠️ `b.hp` 是「放到第 4 段时的血」，**不是**最终血量 —— 槽位自己会放大
  （`BOSS_SLOT_MUL = {4:1, 8:2.2, 12:4}`，基准 900 正好复现老的 900/1980/3600）。
  把槽位和巨像解耦，是因为轮换后任何巨像都可能落在任何槽位，
  血厚必须跟着**槽位**走，不是跟着「这只原本排第几」。
- `startWave(w)`：无尽里星区 `0,1,2` 循环切换；基础敌数 `7 + min(w, WAVES) * 2.2` 再 `+ eTierExtra(w)`；段首 banner 带「深渊 K 档」。
- 无尽过渡：`finishWave()` 在 `G.wave === WAVES` 时设 `G.won = true`、`G.score += 1500`、回满血、
  banner「航程 · 抵达奇点 / 通关 —— 无尽航程开启」，并切 `waveState='warp'` —— **不结束这一局**。
- 探针：`.workbuddy/sv-endless.py`（61 断言：档位序列 / 乘数 / hpScale / 段标签 / 轮换不重复 / 巨像调度 / 12→无尽过渡）。

## 巨像 7 只 & 关卡形态 4 种（2026-10-03）

### 巨像：每只都必须改变玩家的决策

和「敌型设计原则」同一条铁律 —— **不能只是换个血条和配色**：

| 巨像 | 机制 | 玩家的新决策 |
|---|---|---|
| 母岩 | `charge` 冲撞 + `spread` | 绕侧后方，别站正面 |
| 环带狱卒 | `ring`/`spiral`/`fan` 三套轮转 | 读缝穿过去 |
| 奇点之门 | 含 `laser`，血最厚 | 拼续航 |
| 蜂巢母体 | `summon` 持续产兵 | **顶着弹幕优先拆巢**，否则被小怪淹没 |
| 磁暴核心 | `pull` 引力井（**每帧**拉）+ 脉冲 | 靠冲刺/制动对抗拉力，别被拖进弹幕 |
| 熔渣锻炉 | `burn` 一路留火场 | 场地被逐渐切割，别往它去过的地方飞 |
| 棱镜之眼 | `beamFan` 分光激光扇（6 道、间距 0.3rad） | 贴着缝站，别乱窜 |

- `pull` 有**两层**：`bossFire` 里的「突然一顿拽」（210 脉冲）+ `updateBoss` 里的**持续**拉力。
  只做前者玩家会当成「偶尔被推一把」；持续拉力才是它的身份。
  ⚠️ 持续拉力按距离衰减 `clamp(1 - d/520, 0.15, 1)` —— 贴脸时反而松，
  否则一旦被拽到核心就再也出不来（必死循环）。
- `summon` 必须有场上上限（`G.enemies.length < 34` 才产）：它每 1.9 秒就来一次，
  不封顶的话玩家一躲，十几秒内堆到上百只，直接卡死。
- `beamFan` 的「6 道 × 0.3rad 间距」是刻意的：150px 处两道之间约 45px，
  玩家船（约 30px 宽）钻得过去但很挤。间距再小就不是弹幕是处刑。

### 火场（`G.fires`，和蛛网同族但落点不同）

- 蛛网 = 不痛、只是把不想去的地方变慢 → 玩家**读地图**；
  火场 = 真掉血 → 玩家被**切割场地**。这才是它有资格撑起一只巨像的原因。
- ⚠️ 持续伤害靠 `f.tick` 间隔（0.5s），**不是每帧扣** —— 每帧扣的话 60fps 下
  7 点伤害一秒 420 点，玩家 0.1 秒蒸发且看不出死因。
- 常量 `FIRE_LIFE=5.5 / FIRE_R=26 / FIRE_DMG=7 / FIRE_TICK=0.5 / FIRE_MAX=18`（有界，同蛛网）。
- 绘制顺序在蛛网**之上**：锻炉和织网者同场时，玩家得先看见「哪里会烧到我」。

### 关卡形态：9 个非 Boss 段不再全是「杀光」

| 形态 | 目标 | 玩家的取舍 |
|---|---|---|
| 清剿 purge | 杀光队列（原默认） | 比输出 |
| 潮涌 surge | **存活 N 秒**，敌人一直涌 | 比走位，杀不完也不用杀完 |
| 回收 salvage | 在骚扰下捡够 N 份星尘 | 逼你离开安全路线去够掉落 |
| 死斗 duel | 3~4 只精锐重甲，杀光 | 少量高血，考验穿透/爆发 |

- 编排 `MAIN_FORMS`（4/8/12 是 Boss 段不在表里）；无尽按 `ENDLESS_FORM_CYCLE` 四种轮着来。
- ⚠️ **完成条件逐形态不同**，全挂在 `updateWave` 按 `G.waveForm` 分支。
  漏一个分支 = 那段永远打不完 = 整局卡死，而且**不报错** —— 四种都要有探针覆盖。
- ⚠️ 回收的星尘必须**开场预撒**（`need + 6` 份，留漏捡余量），
  不能指望击杀掉落 —— 脸黑时场上根本凑不齐，那段就永远完不成。
  另有补撒安全阀（场上星尘 < 缺口时每 3s 补 6 份）。
- ⚠️ 潮涌时长 `22 + min(w,12)×0.9`（w=6 约 27s）：一开始写 30+w×1.1（w=11 时 42s），
  实测读起来是「这段怎么还没完」。存活段的压力来自**密度不停**，不是熬满一分钟。
- ⚠️ 场上敌人上限逐形态不同：清剿 58（它靠杀光推进）/ 潮涌·回收 26 / 死斗 12。
  死斗超过 12 只就不是死斗了；潮涌堆到 58 会把帧率和可读性一起打穿。
- ⚠️ Boss 段要**显式把 `G.waveForm` 切成 `'boss'`**：不切的话它留着上一段的值
  （第 3 段回收 → 第 4 段打巨像时 HUD 还挂着「星尘 3/17」）。
  `waveObjective()` 对 boss 返回空串 —— 巨像已有血条，再挂「剩余 N」只会误导。
- HUD 目标文案：`waveObjective()`（清剿「剩余 N」/ 潮涌「存活 Xs」/ 回收「星尘 N/M」/ 死斗「精锐 N」），
  非清剿形态用金色，让玩家注意到「这段的规则不一样」。

## 图鉴 & 续档（搬《奇点回响》的 logbook / save 那套 UI）

回响那边是 `#logbook`（上半图鉴：20 敌型 + 6 巨像 + 3 词缀 + 7 船体，全部复用现有数据）
和 `js/save.js`（**5 个存档槽位** + 30 秒自动保存 + 槽位网格 UI）。
本作搬了「图鉴 + 续档」这两件事，但**没搬 5 个槽位** —— 理由见下面第一条。

### 续档：`SAVE.run` 只留一份

- 结构 `{hull, wave, score, level, xp, xpNext, dust, kills, mods:{}, hp, won, t, at}`，`null` = 没有。
- **每段 `startWave()` 开头快照一次**。⚠️ 选「段首」而不是定时存，是因为段首场上还是干净的，
  恢复出来的语义清楚；中途定时存会把「半段敌人 + 满屏弹幕」一起存下来，恢复成什么全靠猜。
- 暂停里 `saveAndQuit()`（act `savequit`）：先 `snapshotRun()` 再 `toTitle()`。
- ⚠️ **恢复必须按等级一级一级重放模块**（`replayMods`）：`apply()` 是就地改数值的，
  而且有些卡的逻辑挂在等级上（「冲角装甲」的首级射速惩罚只在 `n === 1` 时结算一次）。
  只把 `G.mods` 抄回去的话 `S` 里一个模块效果都没有 —— 和 `choose()` 里那条注释是同一件事。
  `replayMods` 里另外做了三件保险：等级夹到 `m.max`、存档里有已删掉的卡就跳过（别炸掉整个恢复流程）、
  血量最后 `Math.min(S.hp, S.maxHp)` 夹一次（「过载超频」会扣最大船体）。
- `gameOver()` 里 `clearRun()`：船毁了就不能再「继续」那一局。
- 老档没有 `run` / `seen` → `loadSave()` 给默认值；`run` 还会校验 `hull` 和 `wave` 都在，
  残缺的直接当没有 —— 一个残缺快照会让「继续航程」在恢复时炸掉，而玩家根本看不懂发生了什么。
- **为什么不做多槽位**：`#wrap` 只有 480×270，满装配的暂停面板就已经把按钮顶出框外过一次
  （见「其它已踩过的坑」里那条）；roguelike 一局本来就是一次性的，一个「继续」位够用。
  真要多槽位，得先解决槽位网格占掉的那一整块高度。

### 图鉴：纯数据驱动，不另建文案表

- 四个页签：敌型 16 / 巨像 7 / 船体 5 / 模块 33。条目**全部从现有数据表派生**：
  `ETYPES` / `BOSSES` / `HULLS` 各带一个 `trait`（一行「怎么对付它」），模块复用 `desc`。
  **新敌型只要带上 `trait` 就自动进图鉴。**
- 收录状态在 `SAVE.seen`（id → 1），跨局累计。`markSeen()` **只在首次发现时写盘** ——
  `spawnEnemy` 每生成一个敌人都会被调用，一局几千次，次次 `writeSave()` 纯浪费
  （首次发现整局最多 ~57 次：16 + 3 + 5 + 33）。所以存的是「见过没有」而不是「见过几次」。
- 没遭遇过的显示「？？？」+ 暗剪影 +「尚未遭遇」；遭遇过才显示名字和 trait。
- 精灵预览：敌型 / 巨像走 `SPR[spr].r[0]`，船体走 `SHIPSET[id].imgs[0]`（`imageSmoothingEnabled = false` 放大）。

### 两个命名陷阱

- ⚠️ **续档的 act 叫 `continue`，不能叫 `resume`** —— 暂停面板的「继续」已经把 `resume` 占了
  （`= togglePause`）。同名会让点暂停「继续」直接变成去读档。
- ⚠️ **图鉴页签是四个独立 act（`cdx-enemy` / `cdx-boss` / `cdx-hull` / `cdx-mod`），不是读 `data-tab`。**
  按钮委托里 `handleAct(b.dataset.act)` **只拿得到 act 字符串**，拿不到元素上的其它 dataset。
  要带参数就得拆成多个 act（拆 act 还能顺带白拿「Tab 聚焦 + Enter 激活」那条补丁）。
- ⚠️ 图鉴从暂停打开时返回要**回暂停**（`codexFrom`，和 `helpFrom` 一个套路），
  不能把人踢回标题 —— 那等于「翻个图鉴就把这一局丢了」。

### 探针

`.workbuddy/sv-codex.py` —— 28 断言：四个页签条数（16 / 3 / 5 / 33）、收录计数、
「？？？」→ 遭遇后解锁、**每一页「返回」的真实 `elementFromPoint` 命中**（模块页 33 条最容易被
`#wrap` 的 270px 切掉，另外还断言按钮 rect 完整落在 `#wrap` 内）、
标题 / 暂停往返不产生死路、`spawn → markSeen`、保存并退出 → 继续航程 → 段数 / 船体恢复、`gameOver` 清档。

## 从《奇点回响》搬运的机制（搬运机制，不照抄模型）

原则：**搬「玩法行为」，不搬数值表和上限。** echo 的卡是 6 级制，本作一局只升到 8 级左右，
6 级卡等于永远拿不满 —— 所以新卡一律 `max: 3`，数值按本作的量级重定，视觉用本作的
`pline` / `framePx` / `disc` / `burst` 原语重画（敌型也是重绘的）。

| 卡 | 类型 | 机制 | 关键实现点 |
|---|---|---|---|
| 尾炮 `backshot` | ability | 每次齐射同时向船尾开火，伤害 55% | `fireMain()` 末尾追加反向弹丸，`col` 橙 / 满级金 |
| 跳弹 `ricochet` | weapon | 弹丸撞屏边反射一次继续飞 | `updateBullets()` 里出界分支先判 `b.bounce`，反射点固定 ±20 |
| 制导弹药 `guided` | weapon | 弹丸自动咬住最近敌人 | `b.homing` 是转向速率，`b.tgt` 按弹缓存，**每 0.12s 才搜一次** |
| 冲角装甲 `ram` | ability | 贴上去就造成伤害，撞击自伤 -40%，首级射速 -30% | `ramCheck()`，按敌人记 0.35s 重击间隔 |
| 死亡尾流 `deathtrail` | ability | 高速拖出灼热带，灼伤敌人 + **消解敌弹** | `updateWakes()`，带子存在 `G.wakes` |

第二批（**改弹丸本身**与**改击杀回报**，不再堆一层数值）：

| 卡 | 类型 | 机制 | 关键实现点 |
|---|---|---|---|
| 口径校准 `caliber` | stat | 弹丸半径 +1 / 弹速 +8% / 射程 +10% | `S.bulletR` `S.bspd` `S.rangeMul`，全在 `pBullet()` 里读 |
| 散射喷嘴 `spray` | weapon | 齐射额外喷 2 发扇形弹，单发伤害 62% | `fireMain()` 中段；扇形弹走同一套 `pBullet`，**穿甲/跳弹/制导/裂变全自动继承** |
| 裂变弹芯 `fission` | weapon | 炮弹**首次**命中时炸成一圈弹片 | `updateBullets()` 命中处，`b.fissioned` 闸门 |
| 过载超频 `overclock` | stat | 射速 +9% / 伤害 +7% / **最大船体 -9** | 拿血换输出，`apply` 末句必须 `S.hp = Math.min(S.hp, S.maxHp)` |
| 噬能回收 `leech` | ability | 每次击坠回 1.1% **最大**船体 | `killEnemy()` 末尾调 `healPlayer()` |

⚠️ **`apply(S, n)` 的第二个参数是这张卡当前等级。** 绝大多数卡用不到，但「冲角装甲」的
首级射速惩罚**必须只在 `n === 1` 时结算一次**，「散射喷嘴」的 `sprayMul` 也必须用
`0.62 + (n-1)*0.07` **覆盖式赋值**而不是累乘 —— 少了这两条，将来做续档重放会把惩罚叠三次。
`choose()` 里传的是 `m.apply(G.S, lv)`。

⚠️ **弹片必须显式 `fission: 0`。** `pBullet()` 里是 `o.fission ?? G.S.fission`，
弹片不传这个字段就会**继承当前等级** → 弹片命中再裂变 → 指数级弹幕爆炸。
`pBullet` 的每一个「继承式」字段（`homing` / `pierce` / `bounce` / `blast` / `fission`）
在生成子弹丸时都要想清楚：**是继承还是清零**。

⚠️ **尾流必须排在 `updateEBullets` 之前**（`step()` 里的顺序是 bullets → wakes → ebullets）。
排到后面就变成「先被弹打到、再把弹清掉」，玩家会觉得这模块根本没生效。

⚠️ **协同一律在运行时读 `synOn()`，不在装配那一刻改数值**（和 echo 的 `apply()` 式协同相反）。
本作已有 8 条就是这么写的，新加的 18 条照旧：`rearPierce` `rearVolley` `bouncePierce`
`moltenRam` `guidedPierce` `bounceBlast` + `heavyBore` `bulletWall` `fissionBoom`
`bounceFission` `ramLeech` `fieldMedic` + `lanceCaliber` `lancePierce` `blinkNova`
`blinkPhase` `mineHesh` `mineStasis`。

⚠️ **`nearest(x,y,R)` 的 R 变大是有代价的**：格子数 `(R/24)²`。制导的 `homeR` 敢开到 260（近全屏），
**前提是 `updateBullets` 里那层「按弹缓存目标 + 0.12s 重搜」**。谁要是把那层缓存删了，帧率会被吃干净。

### 第三批（**改变一次事件的结果**，不再加持续输出源）

| 卡 | 类型 | 机制 | 关键实现点 |
|---|---|---|---|
| 轨道长枪 `lance` | ability | 冷却就绪时，**这一发主动射击**换成贯穿光矛 | `fireMain()` 开头 `if (S.lance > 0 && S.lanceT <= 0) { fireLance(ang); return; }` |
| 相位折跃 `blink` | ability | 重击（≥22）袭来时自动脱险，该次伤害作废 | `hurtPlayer()` 开头 `if (tryBlink(dmg)) return;` |
| 磁暴雷 `mine` | ability | 定时在船尾布设磁雷，磁引靠近的敌人，触爆炸一片 | `updateAbilities()` 布设 + `updateMines()` 结算 |

⚠️ **`lance` 的判定要用「点到线段距离」一次扫全部敌人，不要沿矛身逐格 `buildGrid`+`forNear`。**
矛长 540px、每 8px 一次网格检索 = 68 次查询，纯浪费；`G.enemies` 最多 40 个，O(n) 一次算完。
公式是 `(44 + S.lance * 26) * dmg` —— **44 是截距不是首级值**，1 级就是 70。写期望值别按 44 算。

⚠️ **`blink` 必须有伤害阈值（`BLINK_MIN = 22`）。** 对每一发流弹都触发 = 全程无敌，卡直接废掉。
判定要放在**护盾结算之前**（文案是「足以破盾的重击」），比较的是**总伤害**不是扣完盾的余量。

⚠️ **磁雷的磁引要限速**（`k = 62 * (1 - d/pull) * dt`）。直接把敌人坐标插值到雷上会变成吸尘器，
敌人瞬移过来，「走位引导」的意味就没了。磁雷还有 `arm`（0.35s 待机）—— 不加的话刚落就被贴脸怪点掉。

⚠️ **`mineStasis` 协同往 `G.webs` 里塞元素时必须带 `grow` 字段**：
`webSlowAt()` 算的是 `w.r * w.grow`，漏了就是 `NaN` 半径 → 减速判定全废且不报错。

### 第四批：**条件式**能力（2026-10-03，参考《英雄联盟》的四个技能）

前三批给的都是「输出源」或「更大的数字」，这一批给的是**判断**。参考对象写在这里，
方便以后往同一条思路上接着补：

| 卡 | 类型 | LoL 原型 | 机制 | 接线点 |
|---|---|---|---|---|
| 孤立协议 `isolate` | stat | 卡兹克「孤立无援」 | 半径内没有同伙的目标 +isoMul | `condMul()`（damageEnemy 扣血前） |
| 湮灭指令 `execute` | stat | 诺手「断头台」+ 收割天赋 | 残血（execHp）目标 ×execMul；斩杀后 3 秒 +8%/级 | `condMul()` + `killEnemy()` 挂 `G.furyT` |
| 拘束立场 `bind` | ability | 莫甘娜「暗之禁锢」 | 命中有几率把敌人钉住（不动、不开火、循环计时也冻） | `condMul()` 判定 + `updateEnemies()` 解冻逻辑 |
| 时滞回溯 `rewind` | ability | 艾克「时空断裂」 | 致命伤触发倒带，回到几秒前的位置与部分船体 | `hurtPlayer()` 里 `tryRewind()`，`pushSnap()` 攒快照 |

**四条实现约束（踩的方向都在这）**：
- ⚠️ **`isoMul / isoR / execHp / execMul / bindP / bindT / rewindCd` 一律覆盖式赋值，不能累乘** ——
  续档是**逐级重放 `apply()`** 的，累乘写法会把同一级的加成叠三次（和 `sprayMul` / `fissionMul` 同一个坑）。
- ⚠️ **敌人身上的定身字段叫 `e.root`，卡等级叫 `S.bind`** —— 混起来写会让敌人永远不被解冻，
  场上出现一排活的雕像，而且不报错。
- ⚠️ **拘束要冻结攻击计时**：`e.cd -= dt` 写在各 case 内部，被定身时得**先前进再回滚**（`e.cd += dt`），
  否则解禁瞬间会打出一颗蓄了很久的子弹。`e.st` 的回滚要夹 `Math.max(0, ...)` —— 不是每种 AI 都用到 `e.st`，
  减成负数会让 dash AI 卡在「一直在蓄力」。
- ⚠️ **回溯的血不能给当时的值**（通常是满血）：现在取 `snap.hp * 0.7` 再夹到 `maxHp` 的 25%~60%。
  给满就是多一条命，不给就是回到原位再死一次。

配套协同 4 组：`loneMark`（孤立×暴击 → 落单必暴，**一次性开关** `e.forceCrit`）、
`harvest`（湮灭×噬能 → 斩杀线以下打死额外回 3%，标记要在**扣血前**打 `e.executed`）、
`staticBind`（拘束×脉冲 → 冲击波必定定住）、`echoPhase`（回溯×相位 → 无敌翻倍）。

### 第五批：**英雄联盟技能**主题能力（2026-10-04）

继续借 LoL 招牌技能，但拆成「**攻击型装置**」而非纯数值（和第四批的「判断」形成分工）。
数值不照抄英雄面板，按本作弹幕节奏重定：

| 卡 | 类型 | LoL 原型 | 机制 | 接线点 |
|---|---|---|---|---|
| 风之障壁 `windwall` | ability | 亚索「风之障壁」 | 周期性在机首前方竖起拦截线，吞掉穿过的敌弹（只吃 `ebullets`，不吃敌人） | `updateAbilities()` 周期生成 `G.walls` → `updateWalls()` 用「点到线段距离」吞弹 |
| 影奥义 `shadow` | ability | 劫「影奥义」 | 冷却就绪在身后召出镜像分身，周期朝最近敌人射半伤弹（补输出，不挡枪） | `updateAbilities()` 生成 `G.clones` → `updateClones()` 朝最近敌人 `nearestN()` 开火 |
| 审判 `spin` | ability | 盖伦「审判」 | **只在移动时**旋斩光环，每 0.22s 对近身敌人造成一段伤害（逼走位，不站桩） | `updatePlayer()` 写 `G.moving`；`updateAbilities()` 内 `G.spinT` 脉冲结算 |
| 死亡莲华 `lotus` | ability | 卡特琳娜「死亡莲华」 | 冷却就绪向四周绽放一圈刃雨（走主炮派生，继承穿甲/制导/裂变） | `updateAbilities()` 调 `pBullet()` 全向齐射 |
| 杀戮狂热 `rampage` | ability | 金克丝「罪恶快感」 | 每次击杀刷新 3 秒狂热，期间射速与移速飙升 | `killEnemy()` 挂 `G.rampageT`；`updatePlayer()` 在 fireT / ACC / MAXV 两处消费倍率（**不进 `S.rate/S.spd`**，避免续档重放叠死） |
| 圣银弩箭 `silver` | ability | 薇恩「圣银弩箭」 | 对同一目标连续直接命中叠银印，满 3 层结算一次**真伤**（绕过护甲，Boss 也吃但夹到 25% 血） | `damageEnemy()` 内（非 quiet 直接命中才叠层；爆炸/电链不叠） |

⚠️ **四条实现约束（踩的方向都在这）**：
- ⚠️ **所有新 S 字段在 `newGame()` 里初始化、卡 `apply()` 覆盖式赋值、不累乘** —— 续档是逐级重放 `apply()` 的，累乘会把一级加成叠三次（和 `sprayMul`/`fissionMul` 同坑）。
- ⚠️ **`G.walls` / `G.clones` 是数组、靠 `t >= life` 自然消散**；吞弹用「点到线段距离」而非「上一帧在左/这一帧在右」的穿越检测，否则快弹会漏判。
- ⚠️ **杀戮狂热的倍率只落在 `updatePlayer` 的两处消费点**（开火间隔、推进与极速），绝不写进 `S.rate`/`S.spd` —— 写进去会被续档重放叠成越打越快且不可逆。
- ⚠️ **圣银真伤上限夹 `e.maxHp * 0.25`** 且 `!e.boss` 才叠层：否则它会变成秒巨像。
- 6 张卡都补了 `attachIcon` 舰体配件（青/紫/橙/红/银像素件），卡面与舰体 kit 显示正常。

### 能力选择上限：6 能力型 / 6 数值型（2026-10-04，借鉴 singularity-echo）

借鉴 echo 的「只能选 6 个能力型、6 个数值型」约束，限定**同时持有的不同模块种类数**：

- `TYPE_CAP = { ability: 6, stat: 6 }`（`game.js` 顶部常量，想放宽直接改这里）。
- **「能力型」= `ability` + `weapon` 共用 6 个坑**；**「数值型」= `stat` 单列 6 个坑**。一个模块升到 3 级只占 1 个坑位。
- `countType(t)`：遍历 `MODULES`，数 `G.mods` 里属于该 super-type 的不同 id 数。
- `rollChoices()` 过滤：`lv >= max` 排除；已持有（`lv>0`）永远可继续升级（不受坑位约束）；**新模块**只在 `countType(m.type) < TYPE_CAP` 时才进卡池。
- 升级面板副标题显示 `能力 n/6 · 数值 n/6`（`up.capAbil` / `up.capStat` 两个 i18n 键，zh/en 都有）。
- `choose()` 有双保险：新模块超出坑位上限直接 return（rollChoices 已挡，这里兜底）。
- 验证探针 `probes/sv-lol-check.js`：填 6 能力型→卡池不再出现新能力卡、已持有仍可升级；填 6 数值型→同理；双满→新卡一律 0；空 mods 对照→两类新卡都出现（证明不是「全禁」）。

### 2026-10-03 全局平衡

削（覆盖面太广 / 完全被动 / 只是剂量问题）：

| 卡 | 改动 | 理由 |
|---|---|---|
| `guided` | 转弯 1.1→0.62、homeR 260→204、**新增 homeTrav 里程上限** | 详见下面「制导」一节 |
| `warhead` | 13%→11%、bloom 1.35→1.28 | 唯一乘法作用于**所有伤害来源**，满装配约 2.22 倍全盘，变成必拿而非选择 |
| `critcap` | 8%→7%、bloom 3.4→3.2 | 叠够之后近一半子弹是 3 倍多，不再像「运气好」 |
| `blink` | cd 15/11.5/8 → 17/13.5/10，bloom 6.5→8.5 | 完全被动、白嫖一次大伤害免疫，短冷却 = 多一条命 |
| `lance` | cd 7.2/5.6/4.0 → 8.6/7.0/5.4，bloom 3.2→4.4 | 削频率不削伤害：白送的直线 AOE 太密就成了随身副炮 |
| `fission` | 倍率 0.45→0.42 起、bloom 0.85→0.75 | 它是唯一「自己繁殖」的卡，与 hesh 组合是连锁的指数底数 |
| `caliber` | bspd 1.08→1.06、range 1.10→1.08，bloom 同退 | 三维乘法放大器；`bulletR` 不动（「看得见的变粗」是它的性格） |
| `overclock` | 扣血 -9→-12、bloom -20→-24 | 两个乘数同时给，9 点血在 armor / nanorepair 面前算不上代价，取舍就不存在了 |

加（弱到没人选 / 存在感被基础值吃掉）：

| 卡 | 改动 | 理由 |
|---|---|---|
| `nanorepair` | 0.8→1.3/秒，bloom dustHeal 0.6→1.0 | 满级 2.4/秒在后期等于没有，是唯一开局就完全没手感的生存卡 |
| `phasehull` | +0.15→+0.22/级，bloom +0.5→+0.65 | 0.15 秒只有 9 帧，肉眼看不见；它给的是容错窗口，要和 shield 竞争得看得见 |
| `arc` | 单跳 9→12（`ARC_DMG`）、范围 210→235、每跳 0.35→0.45 | 面板 DPS 比同期所有装置都低一截 |
| `ricochet` | **新增 `bounceBoost`**：每弹一次伤害 +10%（bloom 16%） | 世界放大后反弹越来越像惩罚；给它正反馈才是「贴边打」的战术工具 |
| `deathtrail` | spd 1.06→1.09、射速惩罚 -7%→-4% | 惩罚比收益清楚的典型，两头不讨好 |
| `magnet` | +25%→+30%/级 | 基础吸附已从 46 抬到 78，这张卡的存在感被基础值吃掉了 |
| `shield` | 28→32/级，bloom +70→+80 | 敌伤随段数线性涨，28 点一级后期是一次性纸 |
| `drone` | 单发 7→8（`DRONE_DMG`） | 完全不占走位的火力本该弱，但满装满协同只有约 37 DPS，推不动后期血条 |

### 制导（2026-10-03 削弱，作者口径「追踪别做那么好，全图追踪了」）

问题不是「打得远」，而是**哪都能拐回来**。三处一起收：

| 量 | 旧 | 新 | 说明 |
|---|---|---|---|
| `S.homing` | 1.1/级 +1.4 bloom（满级 4.70 rad/s） | 0.62/级 +0.75 bloom（满级 **2.61**） | 不再是「看见就必中」；横向拉开有可能甩掉 |
| `S.homeR` | 140 起 +30/级，bloom **260**（近全屏） | 138 起 +22/级，bloom **204** | 超过锁定半径找不到目标，退化成普通弹 |
| `S.homeTrav` | — | 300/340/380，bloom 430（**新增**） | 单发飞行里程上限，`updateBullets` 里按 `b.trav` 累计 |

- 里程到限 → `expireBullet()`：一小撮灰烟 + `Sound.sfx.fizzle()`（节流 260ms，不然一梭子失坠会响成噪音墙）。
  ⚠️ **失坠必须有看得见的反馈** —— 静默 splice 的话玩家只会觉得「制导时灵时不灵」。
- ⚠️ 里程上限要**乘 `S.rangeMul`**：口径校准是「弹丸飞得更远」的卡，不乘就会出现
  「射程卡反而把制导玩短」的倒错。
- `guidedPierce` 协同的转向倍率也一起退（1.45 → 1.3）。
- 目标缓存仍然 0.12s 搜一次（见 `updateBullets`），`b.trav` 只有制导弹记账。
- 实测（`sv-modules-check.js`）：无目标直飞 **427px** 失坠（理论上限 `homeTrav × rangeMul` = 430），
  带目标时 10 帧内转过 **24.9°**。

## 舰体配件（DIY 视觉升级）

用户要的：**每次升级除了加数值，还往飞船上挂一件看得见的配件** —— 选不同能力就长出不同外形，
「不只是能力强了，视觉上也能感知到」，而且**配件要和能力语义相符**（护盾长盾、长枪长矛、磁雷挂雷舱）。

### 数据：`sprites.js` 的 `ATTACH_ART`

`ATTACH_ART[id][lv]` → `[part, ...]`，`part = { x, y, rows }`，`rows` 是字符画（`PAL` 调色板字符，`.` 透明）。
33 张卡每一级都有图（`max` 是 3 或 4）。缺图/空图时 `attachParts()` 返回 `null`，绘制自动跳过 —— 加了新卡忘了画图不会炸，只是没配件。

**坐标是「本地格」**，就是 `HULL_SRC` 那张 22×16 字符画的网格：

- 原点在格 `(11, 8)` = 船心；**`+x` 指向机头，`+y` 指向右舷**（机头朝右时就是屏幕下方）。
- 船体大约占 `x∈[-8, 8]`、`y∈[-5, 4]`，机头尖在 `(8, 0)`。
- **1 格 = 2 游戏像素**（和船体 2× 烘焙同一比例）。所有坐标/半径都用整数，
  这样任意 90° 旋转后每个像素都还落在游戏像素上。

四个定位助手（都在 `ATTACH_ART` 的 IIFE 顶部）：

| 助手 | 作用 |
|---|---|
| `A(x, y, rows)` | 直接按左上角定位 |
| `C(x, rows)` | 按垂直居中定位（`y = -⌊len/2⌋`），侧挂件常用 |
| `MV(p)` | 沿中线镜像（`rows` 反向 → 行步进变 −1） |
| `BOTH(p)` | `[p, MV(p)]`，上下两侧对称件一次给两件 |
| `OUT(x, body, col)` | **外环件**：舱体在外，底下补一行「挂架柱」`col` 固定落在 `y = -5`（船体边缘） |

⚠️ **`OUT()` 是「配件别飘到船外」的唯一解法。** 侧挂件直接放 `y = -8` 之类会悬空 ——
挂架柱把舱体钉在船壳上，升级只是往上/往外长，视觉上永远连着船。**加侧挂件一律走 `OUT` 或 `y = -6` 内环。**

⚠️ **硬约束（探针断言）：等级升高不得缩小。** 升级却让配件变小 = 玩家以为退级。每级的部件数/像素数只增不减。
⚠️ **单件至少 2 种调色板字符**（`ricochet` 1 级曾是个纯 `k` 实心块，被探针逮到），不然和背景糊在一起。

### 绘制链路

- `attachFlat(id, lv, solo)` → **1px/格**的平面画布，`cx/cy` 是中心（格坐标）。
  `solo` 见下面「图标」那条，缓存 key 带 `|s` 区分。
- `attachSprite(id, lv, white)` = `scaled(flat, 2)` + `bakeRotation`（**24 向预烘焙**，和船体同一套）。
  每件按**自己的中心**旋转，缓存 key 带 `white` 标志（受击白闪变体）。
- **挂载公式**（在 `drawShipKit` 里）：
  `wx = x + (cos*ox − sin*oy) * k`，`wy = y + (sin*ox + cos*oy) * k`，
  其中 `ox/oy = flat.cx/cy * 2`（格 → 游戏像素）。
- ⚠️ **`drawShipKit(c, hull, x, y, ang, mods, white, k)` 是唯一入口** —— 战斗、暂停预览、探针全走它。
  别再另写一份「船体 + 配件」的绘制，不然三处会漂移。
- ⚠️ **配件不能按动画时间 `t` 改半径/位置**（那种件会每帧抖动）。要动就在烘焙阶段定死。

### 图标：`attachIcon(id, lv, size)`

把平面图转 **−90°（机头朝上）** 再整数倍放大到 `size×size`。

⚠️⚠️ **旋转的 `translate` 量必须是「源宽」`fl.w`，不是源高。** 输出画布是 `(h, w)`，
像素 `(i, j)` 映射到 `(j, W−i)` —— 不补 `W` 整块会掉到画布下面。
踩过：13/29 张图标**全空**（当时全套是 29 张，现在 33 张），`fillRect` 计数为 0 但不报任何错。正确写法：

```js
const rot = newCanvas(fl.h, fl.w), rx = rot.getContext('2d');
rx.imageSmoothingEnabled = false;
rx.translate(0, fl.w); rx.rotate(-Math.PI / 2);
rx.drawImage(fl.cv, 0, 0);
```

⚠️⚠️ **`BOTH` 件在图标里必须只取一半。** 一对镜像件在船上是上下两排（相隔 ~10 格），
照原样缩进 40px 图标 → bbox 被撑到 40 格宽 → 缩放系数塌成 1 → 变成**两个遥遥相望的点**。
`_iconParts(ps)` 检测精确的 MV 配对（同 `x`、`b.y === -a.y - a.rows.length`、`b.rows === a.rows.reverse()`），
命中就只返回 `ps[0]`，并让 `attachFlat` 走 `solo` 缓存键。
踩过：`armor/magnet/phasehull/multigun/drone/shield/stasis/ricochet/deathtrail/spray/leech/blink/mine` 共 13 张全废。

⚠️⚠️ **放大倍率要按「填满卡面」算，别用 `min(size/w, size/h)` 再卡个小上限。**
一级配件常常只有 3×2 格，旧写法（`min` + 上限 8）只剩 16×24 px，在 40px 卡面上糊成一个小点 ——
实测「尾炮」和「多联机炮」**长得一模一样**。现在是
`k = floor(size * 0.82 / max(w, h))`，上限 16，整数倍放大（像素风不能非整数缩放）。

⚠️⚠️ **图标底色必须和 `k` 拉开**：`.card .glyph` 曾是 `#1a1c2c` —— 那正好等于调色板里的 `k`，
而绝大多数配件都用 `k` 画深色描边 → **描边凭空消失**，卡面上只剩中间一小块亮色。
现在统一成太空黑 `#05060d`（和 `.cde canvas` / `#shipview` 一致，也和星区背景 `#070a18` 同族）。
**给配件换用色前先确认它在卡面底色上还看得见。**

### 接线点

- **升级三选一**：`renderCards()` 里每张卡是 `<canvas width="40" height="40" data-gic="i">`，
  循环结束后画 `attachIcon(m.id, 下一级, 40)`。⚠️ 画的是**下一级**的图 —— 玩家要看到「选了之后长什么样」。
- **图鉴模块页**：`codexEntries('mod')` 带 `mod` / `modLv: m.max`，`drawCodexArt` 走 `attachIcon`。
  `.cdg` 那条「汉字 glyph」分支已删掉，现在**图鉴模块页全是 canvas 图标**。
- **暂停页舰体预览**：`#shipview`（128×96，2×），`drawShipView()` 画当前船体 + 全部配件，
  再以 `globalAlpha = 0.34` **重描一遍船体** —— 33 件配件会盖满船壳，不补这一层剪影就完全读不出来。

### 度量：不要数「非透明像素」

⚠️⚠️ **贴在船体上的配件（如暴击电容）是画在船体「上面」的，那些像素本来就是不透明的** ——
`_opaque()` 计数**完全不变**，会误判成「配件没画上去」。
正确指标是 `__dbg.kitDiff(modsA, modsB)`：把两个配装各渲染一遍，**逐像素比 RGBA**，返回变了多少像素。

### 调试参数与探针

- `?kit=N`（第 N 个模块拉满）/ `?kit=all`（全 33 张拉满）—— 在 `startGame()` 里经 `replayMods` 应用。
  ⚠️ **`QS.get('kit')` 不带值会返回空串（falsy）→ 整个入口被静默跳过**（和 forcing-cosmos 的 `?charsel` 同一个坑）。
  所以顶部常量写的是 `QS.get('kit') || ''`，探针一律带值传参。
- `__dbg` 新增：`renderKit(cv, mods, white)`、`kitDiff(a, b)`、`renderIcon(cv, id, lv)`、
  `attachInfo(id, lv)`（返回 `{w,h,cx,cy,parts,colors}`）、`cardIcons()`、`codexIcons()`。
- `.workbuddy/sv-attach.py` —— **20 断言**：模块表 ≥33 · 每张卡每一级都有非空部件 · `attachInfo` 几何有效 ·
  每件 ≥2 种颜色 · **像素数随等级单调不减** · 33 张图标都渲染出 >0 像素 ·
  **逐卡 `kitDiff({}, {id:max}) > 0`**（真画上船了）· 满装 > 2× 空装 · 白闪变体可用 ·
  升级卡 canvas 非空 · 暂停预览像素随装配增长且 caption 含「配件」· 图鉴模块页 33 条无空白 · 返回可达 ·
  **卡池抽空那张「满」卡（唯一还用汉字字形的卡面）字号没顶出图标框**。
- `.workbuddy/sv-kit-shot.py` —— **眼睛迭代工具**（不是断言）：把 8 种典型装配
  （空 / 侧挂 / 鼻部武器 / 尾部 / 外环舱 / 背脊 / 中期 8 件 / 满 33 件）画进一张图，
  POST base64 存到 `.workbuddy/out/sv-kit.png`。
  ⚠️ **「好不好看」没法断言**，改完 `ATTACH_ART` 就靠它看一眼再定稿。
  ⚠️ 它需要 `?bot=1` 才会进 play 态，且超时分支必须**也 POST 一次**（否则探针侧只看到 NO RESULT）。

## 子弹外观系统（`src/bulletskin.js`，2026-10-03）

**纯视觉层，一条铁律**：本文件只被 `drawPBullets` 调用；`pBullet` / `damageEnemy` / `updateBullets`
一行都不许反向依赖它。判定半径、伤害、穿透、命中一律不读外观 —— 外观调整永远不许悄悄变成数值调整。

旧玩家弹只有「颜色」一维（`b.col`），叠多少张卡都只换色。现在拆成**三个正交、可组合的轴**，
全部由 `game.js` 里的数据表驱动（外观层自己一张表都不查进度，只吃传入的 spec）：

| 轴 | 来源表（game.js） | 说明 |
|---|---|---|
| shape 家族×等级 | `BSPEC_FAMILY` + `bFamilyIndex()` | 从上往下第一条命中生效 → **组合家族必须排在单卡前面**；双卡组合的 tier = 两卡等级均值向上取整 |
| shape 尺寸档 | `BSIZE` | 只吃「口径校准」等级（视觉变粗变长 = 判定半径变大的另一种读数；`BSIZE` 本身碰不到判定） |
| tint 具名配色 | `BTINT`（bulletskin）+ `BKIND[*].tint` + `BTINT_BY_MOD` | 优先级：**协同 > 质变金 > 卡 > 来源默认**；一律具名（cyan/ice/amber/gold/violet/rose/mint），禁止裸色串进缓存 key |
| deco 装饰层 | `BDECO_BY_SYN`（协同）> `BDECO_BY_MOD`（单卡 lv2+）> `BDECO_BOUNCED`（已弹过，临时态最优先） | 独立小精灵叠在最上层，24 向与母弹同索引，永远贴合朝向 |

- 来源种类（`b.kind`，`pBullet` 的纯视觉字段）：`main` 主炮 / `rear` 尾炮 / `spray` 散射 / `shard` 裂变弹片 / `drone` 无人机。
  `main/rear/spray` 跟着主炮装配长（家族 + 口径尺寸档），`shard/drone` 有自己固定的小家族 —— 它们是「别的东西」，不是主炮缩小版。
- 家族速查：无卡 `plain`（与改造前逐像素一致）· 穿甲 `spear` · 高爆 `bomb` · 裂变 `core`（空心）· 制导 `seeker`（带鳍）·
  穿甲×高爆 `sabot` · 穿甲×口径 `hammer` · 穿甲×制导 `dive` · 跳弹×高爆 `bound` · 裂变×高爆 `pod` · 弹片 `frag` · 无人机 `nub`。
- **性能纪律（分层缓存）**：把「组合」整体烘焙成一张精灵的话，家族×等级×尺寸×配色×装饰会炸出上千张 canvas。
  分三层各自缓存（shape 键 `<family>_<tier>_<size>|<tint>`、deco 键 `<名>`），规模相加不相乘；
  `bulletLookSpec()` **每种来源每帧只调一次**（drawPBullets 里一次性取齐），绝不在子弹循环里逐发拼 spec。
  辉光 aura 是一发一次 drawImage，场上弹 ≥110 就整体关掉。
- 弹头「提亮」：锥尖/圆头前缘的孤立像素会被「贴空气即描边」规则判成描边色，在星空背景上等于隐形 ——
  所以非 flat 弹头的前缘孤立像素强制提亮成弹芯色（`bnoseK` 两处共用同一个 k，各算一次就会留下暗针）。
- 探针：`probes/sv-bulletskin-check.js`（自带静态服务，**809 行的跑法表要加它一条**）——
  家族矩阵 11 例 · 逐级 tier 单调 · 来源/质变配色 · 协同装饰与配色覆盖 · 单卡 lv2 装饰（lv1 无）·
  已弹装饰 · 全家族×3 级轮廓非空白 · **穷举 1008 种组合后缓存封顶 56 不涨** · 真实对局 90 帧零 JS 错误 · 产出 `probes/bullet-overview.png` 总览图。
- 旧链路已删：`sprites.js` 的 `BULLET_SET` / `bulletSetFor` / `_pvar` / `drawBulletSet` 全部移除，玩家弹绘制只有 `BulletSkin` 一条路。

## 操控模型：`aimMode`（对齐《奇点回响》）

**A/D 转向 · W 推进 · S 制动**，鼠标只负责画准星 + 让机头缓慢朝光标转。三档优先级在 `updatePlayer()` 里：

1. `joy.active`（触屏摇杆）—— **杆指向哪就立刻朝哪转**（见下方「摇杆转向」一节）
2. `aimMode === 'mouse' && mouse.inside` —— 朝光标方向转，**最大 12 rad/s**（`clamp(d, -12*dt, 12*dt)`）
3. 否则（`aimMode === 'key'`）—— `kd = D - A`，**不按键就不转**（绝不自行漂移）

**摇杆转向：推向哪就转向哪**（2026-10-03）。手机是**唯一只能靠机身朝向瞄准**的输入方式，
所以摇杆单独用 `TURN_TOUCH = 20` rad/s（键盘的 `TURN_BASE = 3.2` 只管键盘 / 键鼠那条路）：

- 实测满舵掉头 180° 约 **0.17s**、90° 约 0.08s。老路径（3.2 rad/s）掉头要 1 秒，推了像没反应。
- **仍然保留角速度上限**，绝不写 `G.ang = want`：一帧瞬移过去看眼里是「闪转 / 不听指挥」，
  反而更不像操控。留 0.14s 转过去才有「跟手」的手感。
  20 rad/s ≈ 每帧 19°，正好对齐 24 向烘焙船体的 15°/帧，看不出跳帧。
- **死区 0.12 是必需的安全阀**：幅度很小时 `atan2` 的方向只是手指抖出来的噪声，
  不过滤的话船会在死区里自己小幅抽搐。死区内**完全保持原朝向**（不漂移）。
- 幅度仍留一点权重（`0.6 + 0.4 × min(1, jm/0.35)`），让刚出死区的微调柔一点；但下限 0.6
  保证最差也有 12 rad/s（180°/0.26s），依旧是「立刻」。
- 差值 < 0.02 rad（1.1°）时**直接吸附到 `want`**：否则会以每帧不到一度的步长在目标附近
  「蹭」过去，看着像角度抖动；吸附后枪口严格对准摇杆方向，弹道不偏。

**转向基准 `TURN_BASE = 3.2` rad/s**（2026-10-03）：`S.turn` 只是船体倍率，原来实际转向 = 1.0 rad/s，
掉头要 3 秒。3.2 rad/s = 半圈 1 秒，键盘和鼠标共用；**摇杆不走这个基准**（见上）。

**冲刺方向只认机头 `G.ang`**（2026-10-03 修）：`tryDash()` 不读 WASD、也不用鼠标准星 `G.aim`
—— 按键是给**转向**用的，机头才是「船正对着哪」的唯一真相。旧实现读 WASD 组合，
导致「按住 A 转向的同时按冲刺」会往身体侧面飞；`aimMode === 'key'` 时 `G.aim` 和 `G.ang` 根本不是一个角。
另外冲刺前要把旧速度**投影到机头轴上、只留正向分量**：
```js
const keep = Math.max(0, G.vx * dx + G.vy * dy);
G.vx = dx * (keep + 300 * S.spd); G.vy = dy * (keep + 300 * S.spd);
```
横向分量不清掉会让这一下偏出机头方向，反向漂移（刚被打退 / 正在倒退）甚至能把冲刺**拽成倒着飞**。
注意要用 `=` 而不是 `+=`（`+=` 就是把旧矢量叠回来，等于没清）。
探针 `sv-dash-dir.js`：13 个组合（8 方向 + 侧移 + 倒退 + 按住反向键 + 准星偏离）位移/速度方向偏差全为 **0.00°**。

推进：`W` 或摇杆出死区（`mag > 0.25`）→ `vx += cos(G.ang) * ACC * dt`（`ACC_BASE = 1500`）。
**松手 / 制动：线性刹车**（详见下面「运动模型」）——常量减速度，不是指数阻尼。
`G.aim` 现在恒等于 `G.ang`（保留这个字段是因为绘制 / 冲角 / 尾焰都在读它）。

⚠️ **`aimMode` 必须用 `var` 而不是 `let` 声明。** 三个 js 都是普通 `<script>`，
`let` 是 script-scope **不会挂到 `window`**，探针读 `window.aimMode` 会拿到 `undefined`。

⚠️ **切换时机**：`keydown` 里 A/D/←/→ → `aimMode = 'key'`；`mousemove` → `aimMode = 'mouse'`。
少了「A/D 切回 key」那一行，鼠标控制下按 A 机身不转，手感直接崩。

⚠️ **`__dbg.hold(k,v)` 只改 `keys[]`，不走 `keydown` 监听器** —— 所以它**不会**翻转 `aimMode`。
探针要测 `aimMode` 就得派真的 `KeyboardEvent`；要测推进/转向用 `hold` 更稳。

⚠️ **测摇杆转向用 `__dbg.setJoy(x, y, on)`**（2026-10-03 新增），不要去合成 `touchstart`：
无头桌面 Chrome 里 pointer 恒为 fine，合成 touch 事件还得先 `setTouchMode(true)`，绕一圈太脆。
`setJoy` 直写 `joy.x/y/active`，而 `updatePlayer` 的转向分支读的就是这三个值 ——
量的正是真实代码路径。`on=false` 顺带清零并复位 `joy.id`（模拟松手）。
参考：`probes/sv-touch-turn-check.js`。

⚠️ **bot 不再走 `keys['KeyW/S/A/D']` 那套八向推进**（那套和现在的操控不是一回事了）。
`botStep()` 直接吃 `G.ang` + `keys['KeyW']` 两个自由度：机首角度直接赋值，推进按 W，开火仍走 `mouse.down`。
⚠️ 探针里凡是靠「按 D 让船动起来」的用例（比如死亡尾流要求速度 > 55）**全都会失效** ——
现在按 D 只原地打转。改成 `G.ang = 0; __dbg.hold('KeyW', true)`。

## 输入 / 移动端（这一轮补的）

- ⚠️⚠️ **UI 按钮不要用 `click` 委托，用 `pointerdown`。** 触屏上手指按下去只要挪动一点点，
  `touchmove` 里的 `preventDefault()` 就会把浏览器随后**合成**的 `click` 掐掉 ——
  症状是「点『出击』完全没反应」（桌面端一切正常，只有手机复现，极难定位）。
  `pointerdown` 在任何手势判定之前触发，且不受后续 `preventDefault` 影响，鼠标/触屏/触控笔一套通吃。
  顺带把 `touchmove` 里那句 `preventDefault()` 删了 —— `html,body,#wrap` 上的 `touch-action:none`
  + `overscroll-behavior:none` 本来就够，它是多余的且有害的。
- ⚠️ **同一个交互不要同时挂 `el.onclick` 和 document 委托。** 委托里的 `renderHangar()` 会先把节点换掉，
  随后冒泡上来的 `onclick` 作用在一个已经脱离文档的节点上。选船现在统一走 `pickHull(i)`。
- ⚠️ **`banner()` / `toast()` 都往 `G` 上挂，但机库里 `G === null`**（`toTitle()` 会清掉）。
  机库点未解锁船体本来会走 `toast` → 直接抛 TypeError。两个函数现在都有 `if (!G) return`。
  没有画面反馈的失败 = 玩家以为按钮坏了，所以点锁定的船体会让 `#hull-detail` 抖一下（`.deny`）。
- **半屏判定要用游戏坐标**：`const [gx] = toGame(t.clientX, t.clientY); gx < W/2`。
  直接拿 `clientX - offX < innerWidth/2` 比，在居中的信箱式布局里会错位。
- **判断"玩家在用鼠标还是手指"要用 `pointerType`，不能用 `mousemove`。** 触屏点按之后浏览器会补一发
  兼容性的 `mousemove`，拿它判会让准星一闪一闪。现在 `pointerKind` 只由 `pointerdown`/`pointermove` 的
  `pointerType` 决定。
- **`isTouchDevice()` 只认 `matchMedia('(pointer: coarse)')`**。`'ontouchstart' in window`
  在带触摸屏的 Windows 上也为真，会把桌面端误判成手机（并在开局时弹全屏）。
- **安全区**：CSS 把 `env(safe-area-inset-*)` 读进 `--sat/--sab/--sal/--sar`，
  `fit()` 用 `getComputedStyle` 取出来，从视口尺寸里减掉再算缩放。`fit()` 同时改用 `visualViewport`
  （地址栏收放 / 转屏 / 进全屏都会改视口，只听 `window.resize` 会漏）。
- **移动端「直接横屏」（2026-10-03 改）**：不再读手机物理朝向 —— `#rotate`「请横屏」遮罩、
  `screen.orientation.lock('landscape')`、开局全屏的「必须已横屏」门槛**全部移除**。
  现在 `fit()` 在「触屏 + 竖屏视口」时把 480×270 舞台**顺时针转 90°** 直接以横屏呈现
  （`rot=90`，transform 追加 `rotate(90deg)`，缩放改为 `min(vw/H, vh/W)`，偏移把旋转后包围盒
  `H·s × W·s` 对到可用区中心）；横屏视口 / 桌面端一律不转。⚠️ 旋转必须同步改两处输入：
  `toGame()` 的逆变换（`[(cy-offY)/s, (offX-cx)/s]`）和 touchmove 里摇杆增量的逆旋
  （`dx↔dy` 交换再取负），否则手指点和飞船朝向差 90°。探针 `sv-orientation-check.js` 验证。
- **准星**（`drawCrosshair`）：桌面画在鼠标位置（`#wrap.playing { cursor:none }` 负责藏系统光标），
  触屏换成四角括线 + 摇杆底座。**全用 `fillRect` 画，不用 `ctx.arc`/`stroke`** ——
  1px 的圆弧会被抗锯齿糊成灰边，跟像素素材不是一套语言。坐标每帧都变，**绝不能进任何精灵缓存**。
  `pointerKind === 'touch'` 时画触屏版；`mouse.inside` 为假（鼠标移出窗口 / 切到别的标签）时不画。

## 成品曲 BGM 接入（2026-10-04）

`src/audio.js` 在 WebAudio 合成 BGM 之外，新增**成品曲 BGM**（`fileBgm` 模块）：用 `HTMLAudioElement`
循环播放 `assets/bgm/` 下已入库的 4 首成品曲，按游戏模式映射：
`title → Afterglow` / `cruise → Endless_Drift_1` / `battle → Comet_Trail_1` / `boss → Colossus`。

互斥规则：**成品曲在播时 `schedule()` 直接 return，压住合成 BGM**；成品曲加载/播放失败则合成 BGM 自然兜底
（`startFileCur()` 的 `play()` catch 吞掉自动播放被拦错误，`init()` 末尾在首次手势后补播）。
`setMode(m)` 切模式时若 `fileBgmOn && musOn && BGM_MAP[m]` 就切曲；`music(on)` 开关、`toggleMute()`、
`setVolumes()` 都同步 `applyFileVol()`（成品曲音量 = `volBgm × 0.7`）。

⚠️ **这 4 首是复用 `singularity-echo/bgms/` 里已 git 跟踪的成品，复制到 `assets/bgm/`（ASCII 文件名）。**
`singularity-echo/bgms/` 下另有 5 首**未跟踪的 WIP**（Ember Cradle / Tidewalk 1&2 / Crimson Bloom / Still Idol），
**绝不允许纳入本仓库提交**——仓库根是 `E:/Code/game-lab` 单仓，两个子项目都在里面；
`git add` 时只能精确指定 voyage 内文件，**禁止 `git add -A` / `git add .`**（`-A` 会把那 5 首 WIP 一起收进来）。
换曲只从已跟踪成品里挑。i18n 已补 `title.ctrlTouch` / `help.col1` 的手机瞄准说明。

## 触屏操作区：右下三件套 + 顶栏工具键（2026-09-26）

作者口径：「右边的按钮改为两个 —— 一个是大一点的控制开火的开关，另一个是稍微小一点的控制冲刺」，
超载「也放右侧，显示像一个容器，容器装满才可以按动触发」；
随后（同日）追加：「把燃设定在开火上方，形状换成手机电量一样的东西，开火按钮改成透明淡蓝色，不要红色」。

布局（游戏像素，480×270）：

| 控件 | 位置 | 尺寸 | 说明 |
|---|---|---|---|
| 开火开关 `#btn-fire` | right 10 / bottom 10 | 60×60 圆 | 最大，贴拇指支点；**默认关**；**透明淡蓝**（两态同色相，靠亮度分） |
| 冲刺 `.tb-dash` | right 80 / bottom 14 | 46×46 圆 | 稍小 |
| 超载电池 `#btn-od` | right 10 / bottom 78 | 60×28 横向电池 | **手机电量样式**：外壳 + 右侧极柱，装满才可按；在开火**正上方**（右边缘对齐） |
| 暂停 `.tb-pause` | left 207 / top 28 | 34×28 | 工具键（2026-10-04 上移到 y=28：顶栏正中整条空着，巨像战只压面板空底边；像素切角+青描边+顶部凸耳+青光，配成对仪表） |
| 全屏 `.tb-full` | left 247 / top 28 | 34×28 | 工具键（左边不能越过 x=124，只能往右挪；两键间距保持 8px；同款顶部设计） |

- ⚠️ **触屏按钮一律「像素轮廓」，不许用平滑圆角/圆弧**（作者 2026-10-04，嫌 `border-radius` 的
  反锯齿弧线和像素 HUD「打架」）：
  - 圆钮（开火 60px / 冲刺 46px）→ **像素圆 `clip-path`**：脚本生成的 staircase 多边形
    （只有横/竖边，直角台阶 = 像素圆）。生成器见 probes 笔记，改尺寸要重新生成，别手抄。
  - 方钮（燃标外壳 / 暂停 / 全屏）→ **2px 切角 `clip-path`**（polygon 12 点模板），删 `border-radius`。
  - ⚠️ **`clip-path` 会裁掉元素自身的外扩 `box-shadow`** → 描边一律写 `inset`；
    外发光（开火「开」态青光 / 燃标就绪金光）改 `filter: drop-shadow()` —— 它顺着被裁出的像素轮廓发光。
  - 这些样式只作用于 `#touch`（手机端），桌面端 `display:none` 不受影响。
  - 验证：`probes/sv-touch-style-check.js`（横屏大视口 + `getBoundingClientRect` 自算 clip 裁图 ——
    ⚠️ Playwright 对带 clip-path 的旋转元素会误判「不可见」，element.screenshot 会超时，别用）。
- ⚠️ **开火按钮不许再用红色**（作者 2026-09-26 明确）。本作里红色只留给「受击 / 危险」这类真报警，
  开火是常态动作 → 用青蓝色系；开 / 关两态**共用同一色相**，只靠「填充透明度 + 描边亮度 + 文字色」区分
  （关 `rgba(115,239,247,.16)` + 细描边；开 `rgba(140,244,255,.42)` + `0 0 0 2px #9df3fa` 双描边）。
  ⚠️ 别把 `.tb-fire` 的关态描边调得比旁边 `.tb-dash` 还暗 —— 最大那颗反而最不显眼。
- ⚠️⚠️ **超载是横向电池，水位写 `width` 不是 `height`**（从左往右灌满）。
  老版本是「圆形竖灌容器」（`height` + `border-radius:50%` + `overflow:hidden`），
  改形状时**极易漏改 `syncOdBtn()` 和 `__dbg.odState()`** —— 漏了水位就永远是 0，不报错。
  结构是四层：`.odbatt`（外壳，`overflow:hidden` 裁水位）/ `.odnub`（右侧极柱）/
  `.odfill`（水位）/ `.odtext`（「燃」字，绝对定位居中在**外壳**那一格，不含极柱）。
  ⚠️ 电池的按下反馈要**只加在外壳上**并 `background:none` 掉按钮级底色，
  否则按下时那整块 60×28 矩形（含极柱旁那条透明缝）一起变蓝，就不像电池了。

- ⚠️⚠️ **工具键绝对不能放两个上角。** HUD 把左上（船体/护盾/经验，`x 8..124`，`y 8..60`）和右上
  （分数/航段/星区/时间，右对齐到 `x 472`）全占了 —— 老版 `tb-pause{left:6;top:26}` /
  `tb-full{right:14;top:26}` 正好把血量数字和「第 N/12 段」盖住（截图确认）。
  顶栏 `y=28` 那条空档是算出来的：巨像面板 `y 4..38`、但名字 `y 12..24`/血条 `y 10..18` 都在上半、
  横幅从 `y 74` 起、左右 HUD 各占 `x ≤124` / `x ≥380` → 只有 `x 124..380, y 28..64` 整条不打架
  （巨像战时按钮 28..56 只压到面板空底边 y28..38，不挡名字/血条，刻意取舍）。
  放正中还有个好处：**两个拇指的常驻区（左下摇杆 / 右下动作簇）都够不着**，躲弹幕时不会误触。
- ⚠️ **文案必须挂在内层 `<span>` 上**：`data-i18n` 走 `textContent`，挂在外层会把里面的
  `.odfill`（能量水位）一起清掉。开火按钮是 `.firetext` + `#fire-state`，超载是 `.odtext` + `.odfill`。
- ⚠️ **开火开关的「开/关」是动态文案，不能给 `data-i18n`** —— `applyDom()` 会把它按静态键写死。
  由 `syncFireBtn()` 负责，`boot()` 和 `langRefresh` 里各调一次（否则切完语言会留在旧语言）。

- **HUD 排版（2026-10-03 重排，「舰桥仪表」）**：左上舰况 / 右上航程 / 顶部巨像 / 底部控制台
  四簇共用 `hudPanel()` 背板（`rgba(10,12,26,.78)` + 1px `#29366f` 描边 + 角上 10×2 亮色角标），
  只动「框」和「行距」，**锚点避让计算不变**（工具键 y=28 空档、摇杆/开火键圆形区）。
  - ⚠️ **巨像血条必须收进居中背板并让开两侧**：旧版血条 `x=120..360` 与船体条 `x=8..124`
    同在 `y=8` 且同为红色系，视觉上连成一条 350px 长条。现在 `bw=216`（`bx=132..348`），
    左簇面板到 128、右簇面板从 ≥378 起，三块互不越界。
  - ⚠️ **左簇统计行距 = `barH + 15`**，行内「条 + 标签」按真实行高推进——旧版过热条写死在
    `yxp+10`，会压住经验行「LV 3」的字（4px 条 + 12px 标签 > 10px 旧行距）。
  - ⚠️ **模块芯片 19px 宽是量出来的**：12px 像素字汉字墨宽 ~10px + 等级数字 ~6px，
    旧版 15px 格里「首字母 + 数字」左右排必撞、数字还溢出到下一行。一行 5 枚（pitch 21）、
    最多 3 行，溢出折成「+N」——完整清单在暂停页，战斗中没人逐枚读芯片。
  - ⚠️ **横幅多条同时在场要压行距**：`step = min(48, 131/(n-1))`，否则开段四连横幅
    （航段+巨像+协同×2）的第 4 条副标题正好压进底部控制台（y≥243）。
  - ⚠️ **升级 / 结算两屏不画 HUD**（`render()` 里按 state 跳过）：`.96` 遮罩下 HUD 仍会
    透出灰字，这两屏和战局无关；暂停页保留（遮罩 .55，「战场还在」的氛围是故意的）。
  - 遮罩底色统一加深：`#upgrade .96` / `#over .94` / `#hangar .94` / `.panel #0e1022f2` ——
    旧 `.86/.78` 时 HUD 文字透过遮罩和标题叠成一团。
  - **暂停页双栏**（`.pause-cols`）：舰体预览居左、装配清单居右——上下堆叠常高 ≈340px
    必然把底部按钮顶出 270px 的框；双栏后 ≈235px 放得下，满装配仍由 `#build` 内滚兜底。
  - ⚠️ **机库内容总高必须 ≤ 270px**：`.ov` 的「首/末子元素 margin:auto」在内容溢出时会把
    顶部顶到滚动原点之外——「选择船体」字头被裁掉且滚不回来（截图确认过）。
  - 截图台：`probes/sv-ui-shots.js`（8 张全界面截图进 `probes/ui-*.png`，改排版先拍再看）。
- **开火开关只喂 `G.autoFire`**，和 `mouse.down` / `Space` 是「或」关系（`updatePlayer` 里的 `wantFire`）。
  桌面端 `touchMode` 恒 false、按钮也不显示 → 「按住才开火」的手感与平衡探针基线都不受影响。
  ⚠️ `autoFire` 是模块级 `let`，`newGame()` 里**必须**建 `autoFire:` 字段 —— `G.xxx` 不会自动存在
  （和 `spawnEnemy` 漏 `xp` 是同一类坑）。
- **超载电池**：`syncOdBtn()` 每帧把 `G.energy` 写进 `.odfill` 的 `width`（0~100%，横向灌满），
  外壳 `.odbatt` 用 `overflow:hidden` 把水位裁在框内；`energy >= 100` 时挂 `.ready`（金框 + 金水位 + 金字）。
  ⚠️ **只在值变了才写 DOM**（1% 阈值），每帧无条件写 `style.width` 会让浏览器每帧重排。
  没满时按下走 `tryOverdrive()` → 只加 `.deny` 抖一下，**不放超载** —— 没有反馈的按钮等于坏按钮。
- **触屏瞄准的三个连带修改**（不做的话「右半屏拖动瞄准」会静默失效、或抬指后一直追残影）：
  1. 右半屏 `touchstart` 里**必须顺手 `aimMode = 'mouse'`**：合成 `mousemove` 被第 3 条挡掉了，再没人翻这个开关；
  2. `endTouch` 里抬指要 `mouse.inside = false`：不然鼠标残留在最后那个触点，摇杆松手后
     `updatePlayer` 的 `aimMode==='mouse'` 分支继续把船往残影方向带；
  3. `mousemove` / `mousedown` 开头判 `e.sourceCapabilities.firesTouchEvents` 直接 return ——
     触屏抬指后浏览器会补发一串兼容性鼠标事件（坐标就是最后那个触点），照单全收会让第 2 条当场失效。
     Safari 没这个属性 → 退化成「照旧处理」，与改动前一致。
- **悬浮瞄准标（2026-10-04 新增，触屏专属）**：`touchMode && !BOT` 时，炮口方向 `G.aim` 与船体方向
  `G.ang` **解耦**——`touchAim`（`let`，模块级）单独存一个角，`G.aim = touchAim`、开火沿它（不是 `G.ang`）：
  - 摇杆按下 → 船体立刻朝摇杆（`G.ang` 跟 `joy`），`touchAim` 不动；
  - 摇杆松手 → 船体以 `TURN_TOUCH × S.turn × dt` 回摆到 `touchAim`；
  - 右半屏拖动 → `aimFromTouch(cx,cy)` 重算 `touchAim`（船→手指的世界夹角），拖动期间 `aimDrag.fire=true` 即开火。
  - 桌面端不启用，保持旧的 `G.aim = G.ang` 行为。
  - ⚠️ 开局 / `resumeRun()` 后必须 `touchAim = G.ang`，否则船会无故甩头。
  - ⚠️ 调参铁律：`wantFire` 已含 `aimDrag.fire`；`fireMain(G.aim, …)` 必须在 `updatePlayer` 转向段
    之后调用（同帧里 G.aim 已被同步成 touchAim）。探针 `probes/sv-aim-mark-check.js` 验四项：
    解耦 / 松手回摆 / 拖动 / 开火沿瞄准，全绿。
- ~~**横屏锁定**：`toggleFullscreen()` 里 `screen.orientation.lock('landscape')`~~ **已移除（2026-10-03）**：
  朝向交给 CSS 旋转（见上文「移动端直接横屏」），不再依赖方向锁 API（iOS 没实现、桌面端一律 reject）。
- **运动模型（2026-10-03 重写，作者口径「惯性再降，松开立刻停」）**：参数都在 `updatePlayer` 上方：
  `MAXV_BASE = 168` / `ACC_BASE = 1500` / `DECEL_COAST = 940` / `DECEL_BRAKE = 2400` / `DECEL_DASH = 180` / `STOP_EPS = 6`，
  另有转向基准 `TURN_BASE = 3.2`。
  旧的**指数阻尼** `exp(-k·dt)`（k=0.53，τ≈1.9s）已经删掉了 —— 它数学上永远逼近不到零，
  观感就是「松了手还在漂」。现在是**常量（线性）减速度**：`T_stop = MAXV/DECEL ≈ 0.18s`、
  `S_stop ≈ 15px`，能真正到零。实测：加速到 95% 满速 0.30s，松手到停 0.183s（滑行 13.6px）。
  ⚠️ **DECEL 必须远小于 ACC**：线性摩擦只要还在动就一直扣，推进时净加速度 = `ACC - DECEL`，
  反过来就是船根本开不出去 —— ACC 抬到 1500 正是为了配得上这么强的刹车（净 560 → 满速 0.3s）。
  ⚠️ 三者都乘 `S.spd`，所以各船体的**停止时间一致**，只有速度和刹车距离不同。
  ⚠️ 冲刺那 0.22 秒走 `DECEL_DASH`（180），保留一点滑行，否则冲刺只剩位移没有速度感。
  ⚠️ **`vm` 必须取「推进之后」的值**：推进门禁用 `vmPre = hypot(vx,vy)`（`< MAXV` 才加推力），
     但刹车段和 `MAXV_CAP` 夹取要用**加完推力后重新算的** `vm`。写成同一个变量会退化成
     「本帧刚加的 25px/s 立刻被刹车扣掉」→ 按住 W 稳态速度 0.0px/s（不报错，只有探针量得出来）。
     这是为支持 `MAXV_CAP`（冲刺硬上限 `MAXV * DASH_TOP`，冲刺余速交给刹车慢慢收、不能被硬夹）
     引入 `vm` 时踩的：踩过点「就错一帧」。
- **命中凝滞 `freeze()` 的两道闸**（2026-10-03，作者口径「爆炸不要卡顿，画面简单震动即可」）：
  1. `noFreeze()`：`explode()` / `explodeMine()` 的范围伤害连带的一切（含它打死的敌人、
     引发的新星deathRing、连锁）**只留屏抖、不留凝滞**。以前 `explode` 里有一句
     `freeze(0.05)`，高爆 / 集束 / 裂变一叠加，一帧十几次就把画面打成连续顿挫。
  2. `HITSTOP_GAP = 0.16`：剩下「逐杀 0.045s」依然能锁住画面，所以给**小事件**（t < 0.06）
     加最短间隔；受击(0.07)/精英击杀(0.08)/巨像陨落(0.16)每次都给，那是玩家要读到的信息。
  ⚠️ `hitstopCd` 必须在 `step()` 里、在「凝滞早退」**之前**递减 —— 否则被冻的那些帧不走这一步，
     冷却永远到不了 0，连杀之后就再也冻不起来了。
  探针实测（满级高爆 build，bot 自动打正常波次）：凝滞帧 **9.0% → 4.3%**；
  极端密集场景 **~50% → 22.5%**。
- **屏抖改成「帧末合并」**：`addShake()` 不再直接写 `G.shake`，而是记账，由 `step()` 开头的
  `flushShake()` 结算 —— `最大值全额 + 其余取平方根 ×0.6`，上限 `SHAKE_CAP = 9`（原 11）。
  目的是让「连锁爆炸」表现为**有节奏的一片震动**（量级可控），而不是一路顶到上限糊屏；
  同时保证巨像陨落这种单次大事件不被旁边的小震稀释。
  `SHAKE.blastSmall = 1.1` 是新增的：以前小爆炸（R<40，弹片 / 连锁的主力）完全不震。
- ⚠️ **`.tbtn` 的字号必须是 12 的整数倍**。老版本是 14px（1.17 倍缩放 → 像素网格对不齐），
  `sv-text.py` 一直给它打 NOTE；现在统一回 12px，守卫也干净了。
- 探针：`.workbuddy/sv-touch.py`（**49 条**：布局不重叠/都在 `#wrap` 内/字号 12 的倍数/工具键不压 HUD/
  每颗按钮 `elementFromPoint` 真命中/开火开关四态/容器水位与 ready 与 deny/中英文跟着切/
  触屏瞄准「按住会转、抬指停转」/暂停时收起按钮），
  截图工具 `.workbuddy/sv-touch-shot.py [off|on] [宽x高]`。

## 其它已踩过的坑

- ⚠️⚠️ **`irand(a, b)` 是「两参数」签名：`Math.floor(rand(a, b + 1))`，即闭区间 [a, b] 整数随机。**
  写成单参数 `irand(4)` 或 `irand(i + 1)` 时，第二参是 `undefined → NaN`，洗牌/取边会**静默**出 `undefined` 或只落一个分支：
  ① `spawnPos()` 曾写 `irand(4)` → 四方向分支全落空 → **敌人永远只从右边进场**（不报错、探针全绿，只有数生成分布才抓得到）；
  ② `bagPickBoss()` 曾写 `irand(i + 1)` → 洗牌把 `undefined` 塞进袋 → `pop()` 返回 undefined →
  **巨像段静默退化成普通编队**（同样不报错）。两处都已修成 `irand(0, i)` / `irand(0, 3)`。
  **新增任何用 `irand` 的代码，先确认传了两个参数。**
- ⚠️ **全构筑下的覆盖层会被 `#wrap` 的 `overflow:hidden` 切掉。** `#wrap` 是 480×270 的信箱，
  满构筑（39 卡 + 30 协同）的暂停 / 升级面板**物理高度超过 270**，多出来的按钮落在 `#wrap` 外面 →
  `document.elementFromPoint` 返回 `null` → 点不到（rect 仍正常，纯 DOM 断言抓不到，必须真实命中测试）。
  修法：`.ov` 改 `justify-content:flex-start` + `overflow-y:auto` + 首尾 `margin:auto` + `.ov > * { flex-shrink:0 }`，
  让高面板内部滚动；`#build` 再 `max-height:104px; overflow-y:auto` 夹住长列表。
  探针 `.workbuddy/sv-fit.py` 用真实 `elementFromPoint`（等 CSS 动画 `getAnimations` 静默后再量）验每个面板按钮可达。
- ⚠️⚠️ **同一组选择器里出现 `scrollbar-width` / `scrollbar-color`，Chromium 就会整组丢弃 `::-webkit-scrollbar`。**
  默认滚动条 ~10px，在 480×270 的信箱里又粗又显眼（用户报的就是这个）。要画细滚动条，两条路必须**分开**：
  webkit 伪元素给 Chromium，标准属性给 Firefox，且标准属性包在
  `@supports not selector(::-webkit-scrollbar) { ... }` 里。曾经把两组写在同一个选择器里 →
  Chromium 改用「标准」渲染 → 实测宽度从 5px **弹回 10px**，`width:5px` 被整组静默丢弃。
  现在 `.ov` / `#build` / `.cdgrid` 三处都是 5px 蓝底滑块的像素风滚动条。
  ⚠️ 顺手**别给这些容器加 `overflow:hidden`** —— 那会重新触发上面那条「按钮被切在 #wrap 外」的坑。
- ⚠️⚠️ **12px 像素字形的「内容盒」比 `line-height:12px` 的「行盒」高约 3px（上下各 ~1.5px）。**
  两个后果都在 `#wrap{overflow:hidden}` 下**静默**发生：
  ① 贴边的一行会被切掉 3px（标题页「按 ENTER 开始」曾被切底）；
  ② 相邻两行的**内容盒**天然重叠 ~6px —— 所以「量文字矩形算重叠」的探针用
  `Range.getBoundingClientRect()`（多行时返回并集盒）会报满屏假重叠。
  正确做法：`Range.getClientRects()` **逐行**取矩形，再按 computed `lineHeight` 把矩形收缩回行盒
  （`cy ± lh/2`）再比。`sv-text.py` 的 `txLineBox()` 就是这么干的。
  同理，探针里**布局 px 与缩放 px 不能混**：`offsetWidth/clientWidth/scrollHeight` 不受 `transform:scale()`
  影响，`getBoundingClientRect()` 受影响（本机 `scale ≈ 2.1`）—— 几何比较一律走 `getBoundingClientRect` 族，
  阈值（现在 `TX_TOL = 2` 缩放 px）才可比。
- ⚠️ **`.ov > *:last-child { margin-bottom: auto }` 会落在 `display:none` 的那个孩子身上。**
  桌面端 `#title` 的最后一个孩子是 `.hint.touch-only`（隐藏），于是只剩 `margin-top:auto` 生效
  → 内容被顶到底边 → 叠加上面那条字形溢出，末行被切。
  修法是给容器补 `padding-bottom`（`#title` 现为 10px），探针加一条 `bottom-slack ≥ 6` 守着（现在标题页 21）。
- ⚠️⚠️ **`spawnEnemy()` 建敌人对象时必须把 `cfg` 里要用的字段显式抄进去。**
  `e.cfg = c` 只是挂了个引用，`e.xp` **不会**自动存在。曾经漏了 `xp: c.xp`，而 `killEnemy` 里
  有三处读它 —— 加分 `(e.xp * 10 + 5) * combo`、掉落分档 `e.xp >= 3 / >= 2`、每颗星尘的面值。
  三处全部吃到 `undefined`，症状是：
  ① HUD 右上角、暂停页、结算页、航行日志**全部常驻「分数 NaN」**；
  ② 星尘面值走 `dropPickup(..., undefined)`，被默认参数悄悄兜成 1 —— 硬敌和杂兵掉的一样多，
  **整局经验收入少一半**（12 段通关只能升到 7 级而不是 10 级）。
  **不抛异常、不白屏、探针全绿，只有肉眼看画面才抓得到。**
  同类字段还有 `elite` / `split` / `deathRing`（后两个是 `updateEnemies`/`killEnemy` 读 `e.cfg`，安全）。
  冒烟探针现在有两条断言专门盯它：`击杀后分数是有限数` / `星尘面值是有限数`。
  **新增读 `e.xxx` 的代码之前，先确认 `spawnEnemy` 里真的建了这个字段。**
- ⚠️⚠️ **敌人能被推到的最远处必须小于子弹的回收边界。** `updateBullets` 在 `|x|>20 或 |y|>20` 就回收弹丸，
  所以任何停在 ±40 的敌人**谁也打不到**，而 `updateWave` 的「场上清空才算过」永远不成立 → **整段航程卡死**。
  踩过两次：① 浮游雷 `spawnPos()` 生成在屏外 26px 且自己不动；② 牧者一路后退被硬夹在 ±40。
  现在统一 `const EDGE = 20`（生成边距 + 硬夹边都用它），并给所有带 `c.range` 的远程单位加**软性收容**（贴边往回走）。
  `updateWave` 里还留了一条 180 秒兜底（`alive <= 3` 就清场），防将来再出同类问题。
  **新增「不移动」或「会后退」的敌型时，先想清楚它能不能被子弹够到。**
- ⚠️ **`setTimeout` 是真实时间，`G.waveT` 是游戏时间。** 用 `setTimeout` 排巨像入场，`?fast=4` 时
  `waveT` 先跑到 2 秒 → 判「场上没 boss 也没敌人」→ 直接 `finishWave()`，第 4/8 段被整段跳过（3.7s 就过）。
  现在走 `G.bossPending` + `G.bossT -= dt`。**游戏内的一切计时都用 dt，只有 `gameOver` 的过场才用 setTimeout。**
- **卡片 glyph 用汉字，不要用 `▣ ➤ ↻ ◆ ✦` 这类符号。** 像素字体对符号覆盖不全，会渲染成缺字方块。
  现在用的是「甲 推 装 弹 暴 磁 修 相 炮 穿 爆 机 盾 电 冲 滞 尾 跳 导 角 流 径 扇 裂 频 噬」。
- **`nearest(x, y, R)` 走空间网格，格子数是 (R/24)²，别传大半径。** 传 9999 会每帧扫 17 万个格子，直接卡死。
  `__dbg.nearest()` 与 `botStep()` 都用线性扫描。
- 船体精灵是**预烘焙 24 向**（`bakeRotation`），不要改成逐帧 `ctx.rotate`，否则糊掉像素边缘。
- **机库宽度是硬约束**：`#wrap` 只有 480px，5 台船体每台 86px + 8px 间距 = 462px。
  再加船体必须同步缩卡片（或改成两行 / 翻页），否则会被 `overflow:hidden` 切掉。
- **改完精灵表先验行宽**：`spriteFrom` 用 `Math.max(...rows.length)` 补宽，短一行不会报错，只会静默错位。
- **全局 keydown 里 `preventDefault` 会吃掉滑杆的方向键。** 先判 `e.target.tagName === 'INPUT'`，是输入控件就放行（Esc 仍交给游戏）。
- **`?bot=1` 会直接开局**（不再停在标题页），并且 bot 会自己把选卡面板点掉 —— 否则平衡跑测永远卡在升级界面。
- ⚠️⚠️ **同一个函数名在同一个 <script> 里被声明两次时，不报错，后者胜出 —— 改动会静默失效。**
  2026-10-03 给 `addShake()` 换实现时在「打击感」那一节新写了一份，忘了删掉「特效」那一节的
  旧定义（`Math.min(11, ...)`）：语法检查过、页面不报错、屏幕照样抖，**只有数值对不上**
  （本该封顶 9，实测峰值 11）才露馅。改名 / 换实现前先 `grep -n "function <名字>"` 数一遍。
- **星尘吸附的机制在 `updatePickups()`**（2026-10-03）：基础半径 `S.magnet = 78`（船体精灵 44×32，
  也就是「比机体大一圈」），并且**场内直接给位移**（`MAG_SPD_MIN/MAX = 220/430` px/s）而不是给加速度。
  旧写法是「每帧加速度 + `p.vx *= 0.9` 固定沉减」，稳态速度被压到 `0.15 × pull`：边缘 13px/s、
  贴脸 58px/s，而船的满速是 168px/s —— **星尘追不上在移动的船**，看上去像「吸不到」。
  ⚠️ 光把半径调大根本没用，沉减才是瓶颈。另外 `*= 0.9` 是「每帧」量纲，改写时要用
  `Math.pow(0.9, dt*60)` 才能和帧率解耦。
- **手机端受击的触觉反馈：`buzz(ms)`**（`navigator.vibrate`，只在 `isTouchDevice()` 时调用）。
  iOS Safari 没这个 API（桌面 Chrome 反而有），所以必须两层判都有，缺了会在某些版本上抛异常。

## 命令

⚠️ **2026-10-03 磁盘实况**：下面列出的 `.workbuddy/*.py` 探针在磁盘上**已经找不到了**（`.workbuddy/` 只剩 `memory/`），
  它们从来没进过 git（`git ls-files singularity-voyage` 只有 10 个源文件），所以删除后无法恢复。
  现在**实际可用的探针**是 `probes/*.js`（Node + playwright-core，见本节末尾）。
  ⚠️ 根因：仓库根目录 `.gitignore:30` 有 `**/.workbuddy/`，所以放在 `.workbuddy` 下的东西
  **永远进不了 git**，删了就是真没了 —— 探针一律放 `probes/`（可入库）。

- 本地：`python -m http.server 8127` → http://127.0.0.1:8127/
- 冒烟探针：`python .workbuddy/sv-probe.py`（自带 HTTP 服务，无需另起；每次自动清空 Chrome profile）
  覆盖：标题 → 机库 → 开局 → 生成敌人 → 开火 → 击杀 → **分数/星尘面值是有限数** → 升级三选一 → 选卡 → Boss → 跃迁
  → **4 种新敌型机制（铺网 / 治疗脉冲 / 正面减伤 / 死亡弹幕）→ 蛛网减速 → 命中凝滞 → 协同 → 存档解锁
  → 浮游雷夹边 → 巨像按游戏时间入场 → 航行日志 → 音量滑杆**，33 条断言。改完 `game.js` 就跑一次。
  ⚠️ 用例顺序有讲究：`die()` 之后 `state` 变 `over`，主循环不再 `step()`，所以**所有需要跑帧的用例
  （比如等巨像入场）必须排在 `die()` 之前**。
- 平衡跑测：`python .workbuddy/sv-balance.py [秒数] [倍速]` —— `?bot=1&god=1&fast=N` 自动游玩，
  每 ~5 秒回传快照（bot 无敌，永远不会「结束」，别只等 final），输出逐段用时 / 等级 / **实际装配了哪几张卡** /
  协同 / 同屏峰值敌人 / 峰值蛛网 / **滞留敌人诊断**。改了 `ETYPES` / `SQUADS` / `ZONES` / `hpScale` / `MODULES` 之后跑一次。
  ⚠️ **单次跑测的时长散得很开，别拿一把当基线。** 实测三把（`240 6`，**修 `e.xp` 之前**）：
  游戏内 271 / 373 / 426 s，等级 7—8、模块 5—6、协同 0—1。**1—7 段高度一致**
  （9.5±0.3 / 11±0.3 / 14±0.4 / 21.2 / 14.8 / 17±0.5 / 26.5±0.3），
  散的全在 8 段之后（第 8 段 33—49s、第 9 段 30—63s、第 10 段 52—59s、第 11 段 32—47s）——
  那是星区二的编队，**牧者刷在哪儿决定了这一波清多快**。要判断改动有没有影响，先比 1—7 段。
  ⚠️ **`e.xp` 修好之后基线整体上移**：星尘面值恢复成 `e.xp`（不再是默认参数兜出来的 1），
  实测一把（`900 6`）**等级 14 / 模块 9 / 协同 3 / 吃到经验 854**，总时长 439.8 s，12 段通关。
  对比修复前的同参数跑测是 **等级 7 / 模块 3 / 吃到经验 245** —— 也就是说修之前整局经验收入少了一半多，
  **「构筑」这一层基本是废的**（12 段打完只有 3—7 张卡）。现在的等级曲线才符合
  `xpNext = 8 + level*4.5 + level²*0.35` 的设计意图。
  ⚠️ **搬完第二批（26 张卡）后的三把（`900 6`，都在修 `e.xp` 之后）**：

  | 总时长 | 等级 | 模块 | 协同 | 经验 | 装配 |
  |---|---|---|---|---|---|
  | 215.7 s | 15 | 11 | 3 | 1061 | leech,arc,critcap,backshot,piercer,guided,nanorepair,armor,thruster,fission,drone |
  | 188.1 s | 15 | 12 | 7 | 975 | multigun,nova,spray,autoloader,phasehull,fission,caliber,leech,shield,guided,backshot,piercer |
  | 222.8 s | 15 | 12 | 4 | 1001 | magnet,stasis,piercer,drone,phasehull,critcap,multigun,hesh,ram,overclock,warhead,deathtrail |

  三把全部 12/12 通关、0 JS 错误，**散差比修复前小得多**（188—223 s，修复前是 271—426 s）。
  等级稳定在 15 是「构筑终于成立」的正常结果，不是 bug。
  ⚠️ 但**「现在是不是太容易了」是设计问题、由作者定**：1—7 段现在 9.3 / 10.8 / 12.7 / 16 / 19.3 / 12 / 14.4，
  对比修复前的 9.5 / 11 / 14 / 21.2 / 14.8 / 17 / 26.5 —— 第 4 / 6 / 7 段明显变快。
  真要拉长，优先调 `xpNext` 曲线或 `hpScale()`，不要先动单卡数值。
- ⚠️ **bot 是随机选卡的，所以跑测结果会被「代价卡」污染。** 加完 5 张新卡后实测两把（都在修 `e.xp` 之前）：
  - 装配 `backshot,stasis,magnet,armor,nanorepair,piercer,autoloader`（全是纯收益卡）→ 383 s，
    第 3 段 **14.2 s**，与基线 14±0.4 完全吻合。
  - 另一把只装到 3 种模块、第 3 段 25.5 s、第 5 段 25.7 s、总时长 482 s —— 抽到了带负面代价的卡
    （「冲角装甲」首级射速 **-30%**、「死亡尾流」每级射速 -7%）。bot 从不主动撞人，等于白吃惩罚。
  **看到某一把突然变慢，先看「装配:」那一行再下结论。** 那两张是有意做成 build-around 的，
  不是平衡 bug —— 但要评估它们的性价比，得用真人手感而不是 bot 跑测。
- ⚠️ **滞留诊断里的「敌人」多数是濒死快照，不是卡死。** 例如 `shepherd(7/92)@44,225 v8`
  是「牧者剩 7 血、bot 正在打」的那一帧，这一波随后就清了。真正要看的是**这一波最终有没有过**
  （12/12 通关 = 没卡死）。牧者不自愈（`o === e` 被跳过），所以它不会被治疗成僵局；
  慢是因为 **bot 不会预判提前量**，打一个横向漂移的牧者效率很低 —— 这是 bot 的短板，不是游戏的 bug。
- 输入链路探针：`python .workbuddy/sv-input.py` —— 专治「桌面能跑、手机上按不动」这类问题。
  覆盖：`pointerdown` 能否真的出击 · 点未解锁船体不抛异常且不改变选中 · **准星画在鼠标位置 / 移动后旧位置
  清空 / `mouse.inside=false` 时收掉** · 触屏 `pointerType` 切换 · 左半屏摇杆满推杆 ·
  暂停时收起按钮。改了输入 / 布局 / 准星就跑一次。
  它用 `PointerEvent` + `TouchEvent` 构造器打真实事件序列（不是 `click`），
  ⚠️ 所以**不要再用 `click` 去测按钮** —— 委托已经不听 `click` 了。
- 触屏控件探针：`python .workbuddy/sv-touch.py` —— **51 条**，专治右下角三件套 + 顶栏工具键。
  覆盖：`#touch` 的显隐时机（标题页 / 暂停时都必须是 `none`）· 五颗按钮两两**重叠面积为 0** ·
  全部落在 `#wrap` 框内 · **字号是 12 的整数倍** · 开火比冲刺大 ·
  **超载电池在开火正上方**（右边缘对齐 + 整块在开火顶边之上）· 动作簇都在下半屏 ·
  **工具键不压左右 HUD**（`x>124` / `x+w<380` / `34<=y` 且 `y+h<=74`）·
  每颗按钮 `elementFromPoint` 真命中（先判尺寸再判 `el===t||el.contains(t)`）·
  开火开关「关→真的不开火 / 开→真的开火 / 再关→停火 / `G.autoFire` 同步」·
  超载电池「水位跟着能量 / 半满不是 ready / 没满按下不放超载且有 `.deny` / 满了水位 100 且可按」·
  ⚠️ 水位量的是 **`fillW`（横向宽度）**，并加一条「`fillH` 必须 < 28」防止哪天又退回竖灌 ·
  中英切换后 FIRE/OFF/ON/BURN/DASH 都对 · **触屏「按住会转机头、抬指必须停转」** ·
  暂停时收起按钮。
  ⚠️ 两个容易写错的点：① 等开火要等够**一个开火间隔**（`0.17/rate`，约 170ms）——
  只等 4 个心跳（64ms）会让「关了不开火」假 PASS、「开了会开火」假 FAIL；
  ② 布局坐标必须 `(rect.left - offX) / scale`，只除 scale 会把信箱式左边距算进 x 里，
  `inWrap` 会整排假 FAIL。
- 触屏截图：`python .workbuddy/sv-touch-shot.py [off|on] [宽x高]`（默认 `960x432` 手机横屏尺寸）
  —— 无头桌面 Chrome 的 pointer 恒为 fine，所以靠 `__dbg.setTouchMode(true)` 手动挂 `.touch`，
  再把 `G.energy` 钉死，截右下角三件套在真实缩放下的样子。改触屏 CSS 后看一眼。
- UI 体检探针：`python .workbuddy/sv-ui.py` —— 遍历每个覆盖层，抓「当前可见的 `data-act`」和
  「当前可见的覆盖层」，专门找**开得出来、退不出去**的死路。还会用 `click`（`detail: 0`）
  模拟键盘激活 `<button>`。改 `index.html` 的覆盖层 / `handleAct()` / `onKey` 就跑一次。
- 机制搬运探针：`python .workbuddy/sv-port.py` —— 验「新卡真的生效」而不是「字段被写进去了」，
  **37 条断言**：
  - 第一批：尾炮真多出反向弹丸（满级换金）· 跳弹真从屏边反射回来 · 制导真拐弯**且对照组不拐** ·
    冲角真掉血**且撞击自伤真按 40% 减免** · 尾流真留带子 / 真吃敌弹 / 真灼伤敌人 · 6 条新协同。
  - 第二批：口径真同时改半径/弹速/射程（且重弹协同是**叠加**不是替换）· 散射真多出扇形弹且单发伤害 62% ·
    裂变弹片规格（r=2 / pierce=0 / homing=0 / **fission=0**）与「**只在首次命中裂变**」· 过载真拿血换输出且 `hp` 被夹住 ·
    噬能真按最大船体回血且战地回收协同 ×1.5 · 6 条新协同。
  ⚠️ 每个用例开头必须 `__dbg.resetStats()` + `clearMods()` —— `apply()` 是**就地改数值**的，
  `clearMods()` 只清 `mods` 表；不重置属性的话，前一组给射速打的 0.7 会一直留在后面的用例里。
  ⚠️ 探针里的**逐帧采样要写在 `switch` 外面**（等待期间控制流不进 `switch`，
  「弹丸在这 22 帧里拐了多少度」这类信息会全丢）。
  ⚠️ **期望值要按 `grant()` 实际装到的等级算。** 两处踩过：`grant('fission', 2)` 是 2 级 →
  `fissionMul = 0.45+0.13 = 0.58`（不是 1 级的 0.45）；`grant('overclock', 2)` 是**再装 2 级**
  → 减血 `9*3 + 20`（不是 `9 + 20`）。这类错会让**正确的游戏逻辑**报 FAIL。
  ⚠️ 测「只在首次裂变」不能数「当前活着几片弹片」—— 弹片会被靶子吃掉，计数永远不准。
  现在的做法是**累计每帧正增量**（弹片只增不减时该和是精确的），并且在第一次裂变后把靶子搬到
  200px 外，让弹片（射程 ~66px）够不到，负增量就不会污染累计值。
- 截图探针：`python .workbuddy/sv-shot.py [宽x高]` —— 点出击 → 跑 90 帧 → 把 canvas 存成 PNG
  到 `.workbuddy/out/`。想看某一帧长什么样就用它（canvas 上只有战场，DOM 覆盖层拍不到）。
- 无尽机制探针：`python .workbuddy/sv-endless.py` —— 61 断言验深渊档位序列 / 乘数 / hpScale / 段标签 /
  巨像轮换不重复 / 巨像调度 / 12→无尽过渡。改了 `ENDLESS_*` / `eTier*` / `bagPickBoss` / `bossForWave` 之后跑一次。
- 覆盖层可达性探针：`python .workbuddy/sv-fit.py` —— 每个覆盖层的按钮用真实 `elementFromPoint`
  （等 CSS 动画 `getAnimations` 静默后再量）验「点得到」，专门抓 `#wrap` 溢出切按钮。
  改了 `.ov` / `#build` / 任意覆盖层高度就跑一次。
- 生成分布探针：`python .workbuddy/sv-spawn.py` —— 600 样本验敌人四方向进场分布均匀（150±）、浮游雷夹边、
  巨像轮换无 undefined / 两轮不重复 / 巨像段调度正确。改了 `spawnPos` / `bagPickBoss` 之后跑一次。
- 操控探针（改版）：`python .workbuddy/sv-keys.py` —— 用**游戏时间 G.t** 计时（不再用墙钟 ms；
  无头 Chrome 的 rAF 被代理成 16ms 定时器，游戏时间滞后真实时间），`?god=1` 下验 A/D 转向 · W 推进 · S 制动。
  改了 `updatePlayer` / `aimMode` 就跑一次。
- 图鉴 + 续档探针：`python .workbuddy/sv-codex.py` —— 28 断言：四个页签条数 / 收录计数 /
  「？？？」→ 解锁 / **每一页「返回」的真实命中测试**（模块页 33 条最容易被切）/
  标题与暂停往返无死路 / `spawn → markSeen` / 保存并退出 → 继续航程 → 段数·船体恢复 / `gameOver` 清档。
  改了 `codexEntries` / `drawCodex` / `markSeen` / `snapshotRun` / `resumeRun` / `SAVE_DEF` 就跑一次。
- 舰体配件探针：`python .workbuddy/sv-attach.py` —— **20 断言**，验 33 张卡的配件图
  （每级非空 / ≥2 色 / **像素随等级单调不减** / 逐卡 `kitDiff` 真的画上船 / 图标非空 /
  升级卡与图鉴的 canvas 真有内容 / 暂停页舰体预览随装配增长 / **「满」卡汉字没顶出图标框**）。
  改了 `ATTACH_ART` / `attachSprite` / `attachIcon` / `drawShipKit` / `renderCards` / `drawCodex` /
  `drawShipView` / `.card .glyph` 就跑一次。
  另配一个**眼睛工具**：`python .workbuddy/sv-kit-shot.py` 出 8 种装配的对比图（`.workbuddy/out/sv-kit.png`）。
- 中英切换探针：`python .workbuddy/sv-lang.py` —— **91 断言**（标题 → 机库 → 开局 → 暂停 → 图鉴 → 升级 → 结算 → 帮助全程测切换；含「在 play 里切语言不许动状态机」、DOM 没 CJK / 没 `⟪...⟫` 缺键、33 条模块页英文描述不溢出、帮助面板两种语言都可滚到底）。改了 `i18n.js` / 数据表的 `*En` 字段 / 任何 `T()`/`L()` 接入点就跑一次。
- 静态体检：`python .workbuddy/sv-i18n-lint.py`（纯读源码、不起浏览器）：六张数据表 `*En` 字段齐全 + 描述/特性行的宽度与行数在卡片阈值内 + zh/en UI 表键集合一致 + game.js 里没有硬编码中文的 `banner/toast/floatText` 字面量。
- 布局体检探针：`python .workbuddy/sv-text.py [--shots]` —— **71 断言**，遍历每个覆盖层
  （标题 / 标题带存档 / 帮助 / 机库 / 对局 / 满构筑暂停 / 图鉴三页 / 升级 / 结算），逐层验：
  **滚动条够不够细**（`sbW/sbH ≤ 8`）· **文字有没有溢出容器**（`txBoxSpill`）·
  **文字之间有没有重叠**（`txOverlap`）· 覆盖层是否存在 · **底部留白 ≥ 6**（`bottom-slack`）；
  另验 `#build` / `.cdgrid` 真的可滚。
  `--shots` 按 `?ui=<state>` 逐个隔离截图（**不加** `--hide-scrollbars`，否则测不到滚动条）。
  改了 `style.css` 的覆盖层 / 字号 / 间距就跑一次。
  ⚠️ 它任何一条 FAIL 都可能是**探针自己的度量假象**（见上面「字形内容盒 vs 行盒」那条）—— 先确认量法，再改 CSS。
- 调试 URL 参数：`?bot=1`（自动游玩）、`&god=1`（无敌）、`&fast=N`（N 倍速）、`&loop=1`。
  `window.__dbg` 暴露 `G`、`state`、`spawnBoss`、`giveXp`、`nextWave`、`aim(x,y)`、`aimOff()`、`nearest()`、`die()`，
  探针用的 `spawn/clearEnemies/killAll/hit/setMods/clearMods/save/writeSave/hullUnlocked/checkUnlocks/lockAll/reload/webSlowAt/soundVol`，
  输入/布局用的 `pointerKind`、`touchMode`、`joyActive`、`joyVec`、`scale`、`off`、`pickHull`、`fit`、`updateLayoutMode`、`setLayout(coarse,portrait)`、`setTouchMode(on)`，
  触屏控件用的 `autoFire`、`gameAutoFire`、`toggleFire`、`setAutoFire(v)`、`odState()`、`touchBtns()`、`odReach()`，
  以及机制验证用的 `grant(id, n)`、`resetStats()`、`setPos(x,y)`、`fire(ang)`、`hold(key,bool)`、`ebullet(...)`、
  `wakeCount`、`bulletCount`、`ebulletCount`。
  ⚠️ **`setMods()` 只改 `G.mods` 表，一次 `apply()` 都不执行** —— 想验「装了卡之后属性真的变了」必须用 `grant()`。

### 现存的可跑探针：`probes/*.js`（Node + playwright-core，随仓库入库）

`.py` 那批丢了以后，这几份是唯一还能跑的端到端验证。它们依赖 `playwright-core` 和本机 Chrome，
所以**从 Node managed workspace 里跑**，全局名一律带前缀（见「三条硬纪律」第 1 条的 `__dbg` 撞车事故）：

```bash
# CWD = singularity-voyage 项目根目录（脚本按相对路径起静态服务，别在别的目录跑）
WS=/c/Users/www27/.workbuddy/binaries/node
export NODE_PATH=$WS/workspace/node_modules     # playwright-core 装在这儿
export CHROME_EXE='C:/Program Files/Google/Chrome/Application/chrome.exe'
$WS/versions/22.22.2-3/node.exe probes/sv-modules-check.js
```
⚠️ **`sv-bulletskin-check.js` 与 `sv-orientation-check.js` 自己起静态服务**；其余几份依赖 `http://127.0.0.1:8612`
（`SV_URL` 可覆盖）—— 先在项目根起 `python -m http.server 8612 --bind 127.0.0.1` 再跑。

| 脚本 | 验什么 | 改了什么之后跑 |
|---|---|---|
| `sv-modules-check.js` | 模块表条数 / 新卡字段 / 协同是否成立 / 配件像素随等级单调 / i18n 缺键 / 页面 `⟪⟫` 漏翻 / JS 错误 | `MODULES` / `SYNERGIES` / `ATTACH_ART` / `i18n.js` |
| `sv-dash-dir.js` | **冲刺只沿机头**：13 组按键 × 朝向组合，位移与速度方向相对 `G.ang` 偏差全 0° | `tryDash` / `updatePlayer` / 输入模型 |
| `sv-move-check.js` | 推进加速时间 / 稳态速度 / 制动 / 滑行距离 / 吸附 / 爆炸 | `updatePlayer` / `aBoom` |
| `sv-touch-check.js` | 移动端触屏按钮命中与射击 | `#touch` / `setTouchMode` / `.tbtn` |
| `sv-touch-style-check.js` | 触屏按钮**像素轮廓**：开火/冲刺像素圆、燃标/暂停/全屏切角、开火「开」态与燃标就绪态的 drop-shadow 发光，单键高清截图 | `.tb-fire` / `.tb-dash` / `.odbatt` / `clip-path` / `drop-shadow` |
| `sv-orientation-check.js` | 移动端直接横屏：竖屏视口 `#wrap` 含 `rotate(90deg)` / 横屏不转 / `#rotate` 已移除 / 不调 `screen.orientation.lock` / `toGame` 逆变换误差 <1px，双截图 | `fit()` / `rot` / `toGame` |
| `sv-bulletskin-check.js` | 子弹外观：家族矩阵 / 逐级 tier / 配色优先级 / 协同+单卡装饰 / 缓存封顶 / 90 帧零 JS 错误，产出 `bullet-overview.png` | `bulletskin.js` / `BSPEC_FAMILY` / `BKIND` / `BDECO_BY_*` / `drawPBullets` |
| `sv-touch-turn-check.js` | **摇杆「推向哪转向哪」**：满舵 180°/90° 耗时（≤0.2s / ≤0.1s）/ 轻推档 / 死区不转不漂 / 满速掉头时速度方向跟上 / 松手不转，阈值 0.2s+0.35s+0° | `TURN_TOUCH` / `updatePlayer` 转向分支 / `__dbg.setJoy` |
| `sv-loading-check.js` | 主题化加载动画 + 手机端**首帧即横屏**（内联脚本先于 game.js 生效 / `fit()` 首帧就转 / 标题延后揭示），双截图 | `#loading` / `LOADING_MIN` / `fit()` / `boot()` |
| `sv-boss-form-check.js` | **7 只巨像 + 4 种关卡形态**：逐只逐模式有可观测产物（弹/兵/火/激光/拽）/ 槽位倍率 1-2.2-4 / 轮换覆盖 7 只且一轮不重复 / 四形态都能完成 / 死斗全精锐 / 回收星尘够数 / 火场掉血·过期·场外安全 / HUD 目标文案，4 张新巨像截图 | `BOSSES` / `bossFire` / `rollMainBosses` / `bossSlotMul` / `FORMS` / `updateWave` / `addFire` |
| `sv-ui-shots.js` | **UI 截图台**（无断言，改排版先拍再看）：标题 / 机库 / 图鉴 / 选卡 / HUD（满装配+巨像）/ 暂停 / 结算 / 手机端 HUD 八张进 `probes/ui-*.png` | `hudPanel` / `drawHUD` / `.pause-cols` / 遮罩底色 |

⚠️ `sv-dash-dir.js` 每个用例开头必须 `d.clearEnemies(); G.spawnQueue.length = 0;` ——
  不隔离的话，`updateWave` 补出来的怪会用接触伤害的互推 `G.vx += ux*40` 污染速度，
  偶发报 3° 的假偏差（flaky）。
⚠️ `sv-modules-check.js` 测「制导失坠里程」时**每一帧都要清场**，不能只在开头清：
  `updateWave` 会持续补怪，正前方随机生成一只就会让子弹「打到人就消失」，
  报出来的里程是到那只敌人的距离。踩过一次报 **28px**（理论上限 430px），
  改成分帧清场后稳定在 427px。

## 待办（下一轮）

- **故事框架未定**：用户说「会有新故事框架」，本轮玩法优先，标题页只有占位标语。
  接入点：`index.html` 的 `#title`（tagline）与 `game.js` 的 `startWave()`（每段一条 banner），
  想做开场 SYSTEM LOG 可以照搬 last-firewall 的 `#story` 覆盖层。
- 从垂直切片扩到全量：12 段主线 + 无尽深渊已落地；剩余扩到 8 船体 / 20 敌型 / 6 Boss / 30 段主线。
  加船体前先看「机库宽度是硬约束」那条。
- 机制搬运（尾炮/跳弹/制导/冲角/尾流/口径/散射/裂变/过载/噬能/**轨道长枪/相位折跃/磁暴雷** 共 13 张）已全部落地，
  见「从《奇点回响》搬运的机制」三批表格。后续若要继续搬 echo 的其余卡，先查 `MODULES` 是否已有同 id。
- **画面上还看不出 `overclock` / `leech` 的满级质变。** 这两张的 `ovGold` / `leechGold`
  目前只影响浮字颜色，还没像其它卡那样给一个「一眼看得出」的视觉（口径是弹丸变粗、
  散射是弹幕变宽、裂变是弹片变金 —— 那三张自带）。
  （配件层已补上外形差异，见「舰体配件」；这里说的是**弹幕/特效**层面的质变，仍未做。）

