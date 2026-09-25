# 奇点旅途 SINGULARITY VOYAGE — project notes

像素风太空弹幕射击。纯静态站点（无构建）：`index.html`、`style.css`、`src/{audio,sprites,game}.js`、`assets/`（Fusion Pixel 12px 字体，OFL）。

**血统**：画风与代码框架照搬 `last-firewall`（终焉防火墙），内容（船体 / 敌型 / 模块 / 波次）来自 `singularity-echo`（奇点回响）的重设计版。
本轮是**垂直切片**：5 船体 / 12 段航程 / 16 敌型 / 3 Boss / 29 模块卡（含 MAX 质变 + 26 组协同），完整可通关，**打通后转入无尽深渊**。
29 张模块卡每一级都带一件**舰体配件**（画在飞船模型上，选不同能力长出不同外形 —— 见下面「舰体配件」一节）。

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

## 三条硬纪律

1. **全局命名不能撞车。** 三个 js 都是普通 script（非 module），共享全局作用域。已经踩过两次：
   - `sprites.js` 的烘焙集合和 `game.js` 的船体数据表都叫 `HULLS` → `Identifier 'HULLS' has already been declared`，整页白屏。
     现在烘焙集合叫 `SHIPSET`。
   - **探针注入的脚本也算**。`.workbuddy/sv-balance.py` 里的 `var lastT` 撞上 `game.js` 的 `let lastT`
     → game.js 整份解析失败、`boot` 根本没定义、页面停在 loading。
     ⚠️ 而且**只在探针页复现**，直接开 index.html 完全正常 —— 极难定位。
     **注入脚本的全局名一律加前缀**（`balLog` / `balOut` / `balPost` / `balTicks`），别用 `out`/`t`/`st`/`lastT` 这种大众名。
   **新增全局常量前先 grep 三个文件 + 两个探针脚本。**
2. **精灵缓存的 key 必须是有界集合。** `_bcache`/`_gcache`/`tcache`/`_pvar` 存 canvas，绝不把逐帧变化的量（alpha、浮点半径）写进 key，
   否则每帧泄漏一个 canvas、几分钟后 GPU 内存耗尽。要淡出就在 draw 时用 `drawGlow(ctx, color, R, alpha, x, y)` 改 `globalAlpha`
   （`glowSprite(color, R)` 本身不带 alpha 参数，key 只有 `color|R|1`，所以安全）。
   `_pvar`（`bulletSetFor(color)`，玩家弹配色变体）同理 —— key 只能是那几个固定色字符串。
   ⚠️ 别拿 `tinted()` 去改玩家弹的颜色，那会把弹芯的白色一起吃掉、弹丸糊成一坨色块；
   要新配色就在 `bulletSetFor()` 里照原样重画一遍细针。
3. **弹幕可读性**：友方 = 青白/金色细针（画在敌人**下**层），敌方 = 红/粉/紫描边圆弹（画在**最上**层）。新颜色只能在这两个色族里加。

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
- **巨像轮换袋 `bagPickBoss()`**：`BOSS_BAG` 装三只巨像的 key，洗牌后逐次 `pop()`，空了才重洗 ——
  一轮里各来一次，不连出同一只。⚠️ **只在 `startWave` 里调一次**（`bossForWave` 有副作用抽走一张），
  任何「预判式」重复调用都会白白吃掉一轮轮换（见下 `irand` 铁律）。
- `bossForWave(w)`：主线 `BOSS_WAVES[w]` 固定 4/8/12；无尽里 `(w - WAVES) % ENDLESS_BOSS_EVERY === 0` 才从袋里抽。
- `startWave(w)`：无尽里星区 `0,1,2` 循环切换；基础敌数 `7 + min(w, WAVES) * 2.2` 再 `+ eTierExtra(w)`；段首 banner 带「深渊 K 档」。
- 无尽过渡：`finishWave()` 在 `G.wave === WAVES` 时设 `G.won = true`、`G.score += 1500`、回满血、
  banner「航程 · 抵达奇点 / 通关 —— 无尽航程开启」，并切 `waveState='warp'` —— **不结束这一局**。
- 探针：`.workbuddy/sv-endless.py`（61 断言：档位序列 / 乘数 / hpScale / 段标签 / 轮换不重复 / 巨像调度 / 12→无尽过渡）。

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

- 四个页签：敌型 16 / 巨像 3 / 船体 5 / 模块 29。条目**全部从现有数据表派生**：
  `ETYPES` / `BOSSES` / `HULLS` 各带一个 `trait`（一行「怎么对付它」），模块复用 `desc`。
  **新敌型只要带上 `trait` 就自动进图鉴。**
- 收录状态在 `SAVE.seen`（id → 1），跨局累计。`markSeen()` **只在首次发现时写盘** ——
  `spawnEnemy` 每生成一个敌人都会被调用，一局几千次，次次 `writeSave()` 纯浪费
  （首次发现整局最多 ~53 次：16 + 3 + 5 + 29）。所以存的是「见过没有」而不是「见过几次」。
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

`.workbuddy/sv-codex.py` —— 28 断言：四个页签条数（16 / 3 / 5 / 29）、收录计数、
「？？？」→ 遭遇后解锁、**每一页「返回」的真实 `elementFromPoint` 命中**（模块页 29 条最容易被
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

## 舰体配件（DIY 视觉升级）

用户要的：**每次升级除了加数值，还往飞船上挂一件看得见的配件** —— 选不同能力就长出不同外形，
「不只是能力强了，视觉上也能感知到」，而且**配件要和能力语义相符**（护盾长盾、长枪长矛、磁雷挂雷舱）。

### 数据：`sprites.js` 的 `ATTACH_ART`

`ATTACH_ART[id][lv]` → `[part, ...]`，`part = { x, y, rows }`，`rows` 是字符画（`PAL` 调色板字符，`.` 透明）。
29 张卡每一级都有图（`max` 是 3 或 4）。缺图/空图时 `attachParts()` 返回 `null`，绘制自动跳过 —— 加了新卡忘了画图不会炸，只是没配件。

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
踩过：13/29 张图标**全空**，`fillRect` 计数为 0 但不报任何错。正确写法：

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
  再以 `globalAlpha = 0.34` **重描一遍船体** —— 29 件配件会盖满船壳，不补这一层剪影就完全读不出来。

### 度量：不要数「非透明像素」

⚠️⚠️ **贴在船体上的配件（如暴击电容）是画在船体「上面」的，那些像素本来就是不透明的** ——
`_opaque()` 计数**完全不变**，会误判成「配件没画上去」。
正确指标是 `__dbg.kitDiff(modsA, modsB)`：把两个配装各渲染一遍，**逐像素比 RGBA**，返回变了多少像素。

### 调试参数与探针

- `?kit=N`（第 N 个模块拉满）/ `?kit=all`（全 29 张拉满）—— 在 `startGame()` 里经 `replayMods` 应用。
  ⚠️ **`QS.get('kit')` 不带值会返回空串（falsy）→ 整个入口被静默跳过**（和 forcing-cosmos 的 `?charsel` 同一个坑）。
  所以顶部常量写的是 `QS.get('kit') || ''`，探针一律带值传参。
- `__dbg` 新增：`renderKit(cv, mods, white)`、`kitDiff(a, b)`、`renderIcon(cv, id, lv)`、
  `attachInfo(id, lv)`（返回 `{w,h,cx,cy,parts,colors}`）、`cardIcons()`、`codexIcons()`。
- `.workbuddy/sv-attach.py` —— **20 断言**：模块表 ≥29 · 每张卡每一级都有非空部件 · `attachInfo` 几何有效 ·
  每件 ≥2 种颜色 · **像素数随等级单调不减** · 29 张图标都渲染出 >0 像素 ·
  **逐卡 `kitDiff({}, {id:max}) > 0`**（真画上船了）· 满装 > 2× 空装 · 白闪变体可用 ·
  升级卡 canvas 非空 · 暂停预览像素随装配增长且 caption 含「配件」· 图鉴模块页 29 条无空白 · 返回可达 ·
  **卡池抽空那张「满」卡（唯一还用汉字字形的卡面）字号没顶出图标框**。
- `.workbuddy/sv-kit-shot.py` —— **眼睛迭代工具**（不是断言）：把 8 种典型装配
  （空 / 侧挂 / 鼻部武器 / 尾部 / 外环舱 / 背脊 / 中期 8 件 / 满 29 件）画进一张图，
  POST base64 存到 `.workbuddy/out/sv-kit.png`。
  ⚠️ **「好不好看」没法断言**，改完 `ATTACH_ART` 就靠它看一眼再定稿。
  ⚠️ 它需要 `?bot=1` 才会进 play 态，且超时分支必须**也 POST 一次**（否则探针侧只看到 NO RESULT）。

## 操控模型：`aimMode`（对齐《奇点回响》）

**A/D 转向 · W 推进 · S 制动**，鼠标只负责画准星 + 让机头缓慢朝光标转。三档优先级在 `updatePlayer()` 里：

1. `joy.active`（触屏摇杆）—— 杆指向哪就朝哪转，转速随推杆幅度线性放缩（`0.45 → 1.0` 倍 `S.turn`）
2. `aimMode === 'mouse' && mouse.inside` —— 朝光标方向转，**最大 12 rad/s**（`clamp(d, -12*dt, 12*dt)`）
3. 否则（`aimMode === 'key'`）—— `kd = D - A`，**不按键就不转**（绝不自行漂移）

推进：`W` 或摇杆出死区（`mag > 0.25`）→ `vx += cos(G.ang) * ACC * dt`。
制动：`S` 或摇杆按在死区里（`mag <= 0.05`）→ `vx *= exp(-2.6*dt)`；常态阻尼是 `exp(-0.45*dt)`（保留太空惯性）。
`G.aim` 现在恒等于 `G.ang`（保留这个字段是因为绘制 / 冲角 / 尾焰都在读它）。

⚠️ **`aimMode` 必须用 `var` 而不是 `let` 声明。** 三个 js 都是普通 `<script>`，
`let` 是 script-scope **不会挂到 `window`**，探针读 `window.aimMode` 会拿到 `undefined`。

⚠️ **切换时机**：`keydown` 里 A/D/←/→ → `aimMode = 'key'`；`mousemove` → `aimMode = 'mouse'`。
少了「A/D 切回 key」那一行，鼠标控制下按 A 机身不转，手感直接崩。

⚠️ **`__dbg.hold(k,v)` 只改 `keys[]`，不走 `keydown` 监听器** —— 所以它**不会**翻转 `aimMode`。
探针要测 `aimMode` 就得派真的 `KeyboardEvent`；要测推进/转向用 `hold` 更稳。

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
- ⚠️ **竖屏提示 `#rotate` 走了两条路**：CSS `@media (orientation:portrait) and (pointer:coarse)`
  **加上** `<html>` 上的 JS class（`html.coarse.portrait #rotate`）。原因是纯媒体查询在无头桌面 Chrome 里
  永远为假、**测不了** —— 而这种全屏遮罩一旦在桌面端误触发，游戏直接不可玩。
  探针用 `__dbg.setLayout(coarse, portrait)` 四种组合都验一遍。
- **准星**（`drawCrosshair`）：桌面画在鼠标位置（`#wrap.playing { cursor:none }` 负责藏系统光标），
  触屏换成四角括线 + 摇杆底座。**全用 `fillRect` 画，不用 `ctx.arc`/`stroke`** ——
  1px 的圆弧会被抗锯齿糊成灰边，跟像素素材不是一套语言。坐标每帧都变，**绝不能进任何精灵缓存**。
  `pointerKind === 'touch'` 时画触屏版；`mouse.inside` 为假（鼠标移出窗口 / 切到别的标签）时不画。

## 其它已踩过的坑

- ⚠️⚠️ **`irand(a, b)` 是「两参数」签名：`Math.floor(rand(a, b + 1))`，即闭区间 [a, b] 整数随机。**
  写成单参数 `irand(4)` 或 `irand(i + 1)` 时，第二参是 `undefined → NaN`，洗牌/取边会**静默**出 `undefined` 或只落一个分支：
  ① `spawnPos()` 曾写 `irand(4)` → 四方向分支全落空 → **敌人永远只从右边进场**（不报错、探针全绿，只有数生成分布才抓得到）；
  ② `bagPickBoss()` 曾写 `irand(i + 1)` → 洗牌把 `undefined` 塞进袋 → `pop()` 返回 undefined →
  **巨像段静默退化成普通编队**（同样不报错）。两处都已修成 `irand(0, i)` / `irand(0, 3)`。
  **新增任何用 `irand` 的代码，先确认传了两个参数。**
- ⚠️ **全构筑下的覆盖层会被 `#wrap` 的 `overflow:hidden` 切掉。** `#wrap` 是 480×270 的信箱，
  满构筑（29 卡 + 26 协同）的暂停 / 升级面板**物理高度超过 270**，多出来的按钮落在 `#wrap` 外面 →
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

## 命令

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
  **竖屏提示四种组合只有「粗指针 + 竖屏」显示**。改了输入 / 布局 / 准星就跑一次。
  它用 `PointerEvent` + `TouchEvent` 构造器打真实事件序列（不是 `click`），
  ⚠️ 所以**不要再用 `click` 去测按钮** —— 委托已经不听 `click` 了。
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
  「？？？」→ 解锁 / **每一页「返回」的真实命中测试**（模块页 29 条最容易被切）/
  标题与暂停往返无死路 / `spawn → markSeen` / 保存并退出 → 继续航程 → 段数·船体恢复 / `gameOver` 清档。
  改了 `codexEntries` / `drawCodex` / `markSeen` / `snapshotRun` / `resumeRun` / `SAVE_DEF` 就跑一次。
- 舰体配件探针：`python .workbuddy/sv-attach.py` —— **20 断言**，验 29 张卡的配件图
  （每级非空 / ≥2 色 / **像素随等级单调不减** / 逐卡 `kitDiff` 真的画上船 / 图标非空 /
  升级卡与图鉴的 canvas 真有内容 / 暂停页舰体预览随装配增长 / **「满」卡汉字没顶出图标框**）。
  改了 `ATTACH_ART` / `attachSprite` / `attachIcon` / `drawShipKit` / `renderCards` / `drawCodex` /
  `drawShipView` / `.card .glyph` 就跑一次。
  另配一个**眼睛工具**：`python .workbuddy/sv-kit-shot.py` 出 8 种装配的对比图（`.workbuddy/out/sv-kit.png`）。
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
  输入/布局用的 `pointerKind`、`touchMode`、`joyActive`、`joyVec`、`scale`、`off`、`pickHull`、`fit`、`updateLayoutMode`、`setLayout(coarse,portrait)`，
  以及机制验证用的 `grant(id, n)`、`resetStats()`、`setPos(x,y)`、`fire(ang)`、`hold(key,bool)`、`ebullet(...)`、
  `wakeCount`、`bulletCount`、`ebulletCount`。
  ⚠️ **`setMods()` 只改 `G.mods` 表，一次 `apply()` 都不执行** —— 想验「装了卡之后属性真的变了」必须用 `grant()`。

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

