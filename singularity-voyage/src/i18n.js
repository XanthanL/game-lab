'use strict';
/* ============ 多语言（中 / 英） ============
   游戏是纯静态零构建的，所以这里也不引任何 i18n 库 —— 一张扁平表 + 一个 T()。

   三条约定，都是为了「漏翻能被发现」而不是「静默退回中文」：
     ① UI 文案全部走 T('a.b.c')。缺键时 T() 返回 `⟪a.b.c⟫` 而不是空串 ——
        屏幕上会直接出现带书名号的键名，肉眼一眼可见。
     ② 数据表（模块 / 敌型 / 巨像 / 船体 / 协同）的英文**写在数据表自己身上**
        （`nameEn` / `descEn` / `traitEn` …），用 L(obj, 'name') 取。
        这样「加一张新卡」时中英文在同一处，不会漏；探针再扫一遍所有 *En 字段是否非空。
     ③ zh / en 两张表的**键集合必须完全一致**，sv-lang.py 会逐键比对。

   ⚠️ 英文比中文长得多，而画布只有 480x270。凡是往画布上画的文字（HUD / 横幅）
      都要按英文长度重新确认不越界；DOM 那边靠换行，但固定高度的卡片（升级卡 178px、
      船体卡 168px）会被撑爆 —— 写英文时优先用短词，别直译。 */

const LANGS = ['zh', 'en'];
const LANG_KEY = 'sv_lang_v1';
// 按钮上显示的是「点了会切到哪一门」，不是当前语言
const LANG_NEXT = { zh: 'EN', en: '中' };
let lang = 'zh';
try { const s = localStorage.getItem(LANG_KEY); if (LANGS.indexOf(s) >= 0) lang = s; } catch (e) {}
const isEn = () => lang === 'en';

/* 数据表取词：英文优先，缺了退回中文。
   ⚠️ 用 `!= null` 而不是 `if (v)` —— 空串是「故意留空」的合法值（比如没写 trait 的条目），
      用真值判断会把它当成缺失、悄悄退回中文。 */
function L(o, f) {
  if (!o) return '';
  if (lang === 'en') { const v = o[f + 'En']; if (v != null) return v; }
  const z = o[f];
  return z == null ? '' : z;
}

/* ============ UI 文案表 ============ */
const UI = {
  zh: {
    // ---- 标题页 ----
    'title.logo1': '奇点旅途',
    'title.logo2': 'S I N G U L A R I T Y &nbsp; V O Y A G E',
    'title.tag': '像素太空弹幕射击 · 穿越十二段航程 · 无尽深渊',
    'title.continue': '继续航程',
    'title.continueW': '继续航程 · 第 {0} 段（{1}）',
    'title.unknown': '未知',
    'title.start': '&gt; 开始航行',
    'title.codex': '图鉴',
    'title.help': '操作说明',
    'title.clrrun': '放弃这段航程',
    'title.best': '最佳分数 {0}',
    'title.maxwave': '最远 {0} 段',
    'title.maxtier': '最远 {0} 段（深渊 {1} 档）',
    'title.kills': '累计击坠 {0}',
    'title.locked': '还有 {0} 台待解锁',
    'title.ctrlDesk': 'A/D 转向 · W 推进 · S 制动 · 鼠标瞄准 · 左键/空格开火 · Shift/右键冲刺',
    'title.ctrlTouch': '左半屏拖动转向推进 · 右半屏拖动瞄准 · 右下角：开火 / 冲刺 / 超载',
    'title.hintDesk': '按 ENTER 开始',
    'title.hintTouch': '轻触「开始航行」',

    // ---- 机库 ----
    'hangar.title': '选择船体',
    'hangar.sub': '方向键左右切换 · ENTER 出击',
    'hangar.launch': '出击 [ENTER]',
    'hangar.locked': '未解锁',
    'hangar.unlockCond': '解锁条件<br>{0}',
    'hangar.status': '状态',
    'hangar.cond': '条件',
    'hangar.prog': '进度',
    'hangar.lockedV': '未解锁',
    'hangar.hp': '船体',
    'hangar.spd': '速度',
    'hangar.dmg': '火力',
    'hangar.rate': '射速',
    'hangar.kills': '{0}/{1} 击坠',
    'hangar.waveProg': '第 {0}/{1} 段',

    // ---- 通用按钮 ----
    'btn.back': '返回',

    // ---- 操作说明 ----
    'help.title': '操作说明',
    'help.col1': [
      '<p><b>A / D</b>（或方向键）转向 — 不按键就保持当前朝向<br><span class="dim">按一下 A/D 切回键盘朝向；鼠标一动就切回鼠标朝向</span></p>',
      '<p><b>W / 方向键上</b> 推进器点火 — 沿当前机首方向加速<br><span class="dim">松开会继续漂移（太空惯性）</span></p>',
      '<p><b>S / 方向键下</b> 制动 — 速度指数衰减</p>',
      '<p><b>鼠标</b> 瞄准 — 机头缓慢朝光标转向（最大 12 rad/s）</p>',
      '<p><b>左键 / 空格</b> 主炮开火（可长按）</p>',
      '<p><b>SHIFT / 右键</b> 助推冲刺（短暂无敌）</p>',
      '<p><b>E</b> 超载爆发（能量满时）</p>',
      '<p><b>ESC / P</b> 暂停　<b>M</b> 静音</p>',
      '<p class="dim">手机：左半屏拖动 = 推进 + 转向 · 右半屏拖动 = 瞄准<br>右下角 大按钮 = <b>开火开关</b>（默认关）· 小按钮 = 冲刺 · 上方容器 = 超载（攒满才可按）</p>',
    ].join(''),
    'help.col2': [
      '<p><em class="c-c">青白色细针</em> 是你的炮弹；<em class="c-r">红紫圆弹</em> 是敌弹，务必躲开</p>',
      '<p><em class="c-y">星尘</em> 击坠掉落，拾取后累积经验</p>',
      '<p>经验满 → 三选一<b>模块</b>，装配后永久生效</p>',
      '<p><em class="c-o">能量</em> 击坠与擦弹积攒，满格释放<b>超载</b>：清屏冲击波 + 火力翻倍</p>',
      '<p>每段航程清空全部敌人即可跃迁下一段</p>',
      '<p>第 <em class="c-r">4 / 8 / 12</em> 段是<b>巨像</b>，血更厚、弹更密</p>',
      '<p>打通 12 段即<b>通关</b>，但不结束 —— 直接转入<em class="c-y">无尽航程</em><br><span class="dim">13 段起每 5 段抬一档「深渊强度」：敌人血量指数上涨、伤害与速度跟涨（各自封顶）</span></p>',
      '<p>无尽里每 <em class="c-r">4</em> 段来一只巨像，三只<b>轮换</b>出场，不会连着重复</p>',
      '<p><em class="c-p">织网者</em>撒网减速 · <em class="c-y">牧者</em>给同伴回血 · <em class="c-y">新星</em>死亡炸弹 · <em class="c-c">铁壁</em>正面免伤<br><span class="dim">这四种不能硬碰，先点掉或绕后</span></p>',
      '<p class="dim">击坠与航段进度会存档；<em class="c-p">玄鸦</em> 与 <em class="c-y">蜂群</em> 需要解锁</p>',
    ].join(''),

    // ---- 图鉴 ----
    'codex.title': '图鉴',
    'codex.tab.enemy': '敌型',
    'codex.tab.boss': '巨像',
    'codex.tab.hull': '船体',
    'codex.tab.mod': '模块',
    'codex.count': '已收录 {0} / {1}',
    'codex.unknown': '？？？',
    'codex.unseen': '尚未遭遇',

    // ---- 升级选卡 ----
    'up.title': '模块装配 · 选择一项',
    'up.sub': 'LV {0} · 已装配 {1} 种模块',
    'up.subSyn': ' · 协同 {0}',
    'up.subMaxed': 'LV {0} · 模块已全部满级',
    'up.reroll': '重抽 [R] ({0})',
    'up.rerollNone': '无需重抽',
    'up.rerollUsed': '重抽已用完',
    'up.maxTag': '满级',
    'up.maxName': '全部满级',
    'up.maxDesc': '所有模块都已升到顶<br>本段奖励折算为分数',
    'up.maxKey': '[ENTER] 继续',
    'up.syn': '协同 {0}',
    'up.type.stat': '数值',
    'up.type.weapon': '弹体',
    'up.type.ability': '装置',

    // ---- 暂停 ----
    'pause.title': '暂停',
    'pause.stats': '第 {0} 段 · 击坠 {1} · 分数 {2} · {3}',
    'pause.cap': '当前舰体 · 配件 {0} 件',
    'pause.capNone': '当前舰体 · 尚未装配',
    'pause.noMods': '尚未装配模块',
    'pause.synChip': '协同·{0}',
    'pause.resume': '继续',
    'pause.mute': '声音',
    'pause.muteOn': '声音 开',
    'pause.muteOff': '声音 关',
    'pause.savequit': '保存并退出',
    'pause.restart': '重新出击',
    'pause.hangar': '机库',

    // ---- 结算 ----
    'over.lose': '航程 · 中断',
    'over.win': '航程 · 抵达奇点',
    'over.subWin': '你穿过了全部十二段航程。',
    'over.subWinEndless': '已通关，并在无尽航程中推进到第 {0} 段（深渊 {1} 档）。',
    'over.subLose': '船体解体于第 {0} 段。',
    'over.score': '分数',
    'over.kills': '击坠',
    'over.wave': '航段',
    'over.level': '等级',
    'over.dust': '星尘',
    'over.time': '用时',
    'over.waveN': '{0} 段',
    'over.waveOf': '{0}/{1}',
    'over.newBest': '新的最佳成绩',
    'over.best': '最佳 {0}',
    'over.unlock': '解锁船体 {0}',
    'over.again': '再来一次 [ENTER]',
    'log.ship': '船体',
    'log.wave': '航段',
    'log.kills': '击坠',
    'log.score': '分数',
    'log.empty': '还没有航行记录',
    'log.win': ' ·通',

    // ---- HUD ----
    'hud.hull': '船体',
    'hud.shield': '盾',
    'hud.score': '分数',
    'hud.dash': '冲刺',
    'hud.energy': '能量',
    'hud.odReady': '超载就绪 [E]',
    'hud.left': '剩余 {0}',
    'hud.cd.lance': '枪',
    'hud.cd.blink': '跃',
    'hud.cd.mine': '雷',
    'hud.waveMain': '第 {0}/{1} 段',
    'hud.waveEndless': '第 {0} 段 · 深渊 {1} 档',

    // ---- 横幅 / 提示 ----
    'bn.wave': '第 {0} 段 · {1}',
    'bn.bossSoon': '巨像接近中',
    'bn.bossTier': '{0}（深渊 {1} 档）',
    'bn.squad': '编队主题：{0}',
    'bn.squadTier': '深渊 {0} 档 · {1}',
    'bn.clear': '航段肃清',
    'bn.warp': '跃迁至第 {0} 段',
    'bn.winSub': '通关 —— 无尽航程开启',
    'bn.od': '超载爆发',
    'bn.odSub': '火力翻倍 · 5 秒',
    'bn.bossDead': '巨像 · 已击碎',
    'bn.enrage': '狂暴',
    'bn.enrageSub': '{0} · 第二阶段',
    'bn.bloom': '质变 · {0}',
    'bn.bloomSub': '已升至满级',
    'bn.syn': '协同 · {0}',
    'bn.unlock': '船体解锁 · {0}',
    'toast.mute': '静音',
    'toast.unmute': '声音开',
    'toast.fitLv': '装配等级 {0}',
    'toast.allMax': '模块已全部满级',
    'toast.allMaxSub': '本段奖励折算为分数 · 船体已修复',
    'float.block': '格挡',

    // ---- 其他 ----
    'vol.music': '音乐',
    'vol.sfx': '音效',
    'touch.pause': 'II',
    'touch.full': '全',
    'touch.dash': '冲',
    'touch.od': '燃',
    // 开火开关（右下角最大的那颗）。开/关两字是**动态**文案，不走 data-i18n，
    // 由 game.js 的 syncFireBtn() 刷 —— 但也必须在中英表里各留一份。
    'touch.fire': '开火',
    'touch.on': '开',
    'touch.off': '关',
    'rotate.t': '请把手机横过来',
    'rotate.s': 'R O T A T E&nbsp;&nbsp;T O&nbsp;&nbsp;L A N D S C A P E',
    'rotate.x': '轻触此处仍然继续',
    'lang.title': '切换中英文 / Switch language',
    'doc.title': '奇点旅途 · SINGULARITY VOYAGE',
    'doc.desc': '奇点旅途 SINGULARITY VOYAGE — 像素风太空弹幕射击。穿越十二段航程，抵达奇点。',
  },

  en: {
    // ---- Title ----
    'title.logo1': 'SINGULARITY VOYAGE',
    'title.logo2': '奇点旅途',
    'title.tag': 'PIXEL BULLET-HELL SHOOTER · 12 WAVES · ENDLESS ABYSS',
    'title.continue': 'CONTINUE',
    'title.continueW': 'CONTINUE · WAVE {0} ({1})',
    'title.unknown': 'UNKNOWN',
    'title.start': '&gt; START VOYAGE',
    'title.codex': 'CODEX',
    'title.help': 'CONTROLS',
    'title.clrrun': 'ABANDON THIS RUN',
    'title.best': 'BEST {0}',
    'title.maxwave': 'FURTHEST WAVE {0}',
    'title.maxtier': 'FURTHEST WAVE {0} (ABYSS {1})',
    'title.kills': 'TOTAL KILLS {0}',
    'title.locked': '{0} HULLS STILL LOCKED',
    'title.ctrlDesk': 'A/D TURN · W THRUST · S BRAKE · MOUSE AIM · LMB/SPACE FIRE · SHIFT/RMB DASH',
    // ⚠️ 这条走 data-i18n（textContent），**不能**写 &amp; —— 会被原样显示出来。
    'title.ctrlTouch': 'L HALF = STEER + THRUST · R HALF = AIM · CORNER: FIRE / DASH / BURN',
    'title.hintDesk': 'PRESS ENTER TO START',
    'title.hintTouch': 'TAP START VOYAGE',

    // ---- Hangar ----
    'hangar.title': 'SELECT HULL',
    'hangar.sub': 'ARROW KEYS TO SWITCH · ENTER TO LAUNCH',
    'hangar.launch': 'LAUNCH [ENTER]',
    'hangar.locked': 'LOCKED',
    'hangar.unlockCond': 'UNLOCK<br>{0}',
    'hangar.status': 'STATUS',
    'hangar.cond': 'REQUIRE',
    'hangar.prog': 'PROGRESS',
    'hangar.lockedV': 'LOCKED',
    'hangar.hp': 'HULL',
    'hangar.spd': 'SPEED',
    'hangar.dmg': 'POWER',
    'hangar.rate': 'RATE',
    'hangar.kills': '{0}/{1} KILLS',
    'hangar.waveProg': 'WAVE {0}/{1}',

    // ---- Shared ----
    'btn.back': 'BACK',

    // ---- Help ----
    'help.title': 'CONTROLS',
    'help.col1': [
      '<p><b>A/D</b> (or arrows) turn · release to hold heading</p>',
      '<p><b>W / ↑</b> thrust · <b>S / ↓</b> brake</p>',
      '<p><b>Mouse</b> aim — nose turns toward cursor (max 12 rad/s)</p>',
      '<p><b>LMB / Space</b> fire (hold) · <b>Shift / RMB</b> dash</p>',
      '<p><b>E</b> overdrive · <b>ESC/P</b> pause · <b>M</b> mute</p>',
      '<p class="dim">Phone: L half = thrust + steer · R half = aim<br>Bottom-right: big = <b>FIRE</b> toggle (off by default) · small = DASH · vessel above = OVERDRIVE (only when full)</p>',
    ].join(''),
    'help.col2': [
      '<p><em class="c-c">Cyan needles</em> = your shots · <em class="c-r">red/purple orbs</em> = enemy fire (dodge)</p>',
      '<p><em class="c-y">Stardust</em> from kills → XP · full bar → pick a <b>module</b></p>',
      '<p><em class="c-o">Energy</em> from kills &amp; near-misses · full bar = <b>Overdrive</b> (shockwave + double firepower)</p>',
      '<p>Clear the wave to warp · waves <em class="c-r">4 / 8 / 12</em> are <b>Colossi</b></p>',
      '<p>Clearing all 12 → <em class="c-y">Endless Voyage</em> (every 5 waves = Abyss tier ↑, HP / dmg / speed scale)</p>',
      '<p>Endless bosses every <em class="c-r">4</em> waves · 3 Colossi <b>rotate</b>, never back-to-back</p>',
      '<p><em class="c-p">Weaver</em> slows · <em class="c-y">Shepherd</em> heals · <em class="c-y">Nova</em> explodes · <em class="c-c">Bulwark</em> blocks front — kill them first</p>',
      '<p class="dim">Saves kills and wave progress · <em class="c-p">Raven</em> &amp; <em class="c-y">Swarm</em> are unlockable</p>',
    ].join(''),

    // ---- Codex ----
    'codex.title': 'CODEX',
    'codex.tab.enemy': 'ENEMIES',
    'codex.tab.boss': 'COLOSSI',
    'codex.tab.hull': 'HULLS',
    'codex.tab.mod': 'MODULES',
    'codex.count': 'RECORDED {0} / {1}',
    'codex.unknown': '???',
    'codex.unseen': 'NOT YET SEEN',

    // ---- Upgrade ----
    'up.title': 'MODULE FITTING · CHOOSE ONE',
    'up.sub': 'LV {0} · {1} MODULES FITTED',
    'up.subSyn': ' · {0} SYNERGIES',
    'up.subMaxed': 'LV {0} · ALL MODULES MAXED',
    'up.reroll': 'REROLL [R] ({0})',
    'up.rerollNone': 'NOTHING TO REROLL',
    'up.rerollUsed': 'NO REROLLS LEFT',
    'up.maxTag': 'MAXED',
    'up.maxName': 'ALL MAXED',
    'up.maxDesc': 'Every module is maxed<br>Reward converted to score',
    'up.maxKey': '[ENTER] CONTINUE',
    'up.syn': 'SYN {0}',
    'up.type.stat': 'STAT',
    'up.type.weapon': 'WEAPON',
    'up.type.ability': 'DEVICE',

    // ---- Pause ----
    'pause.title': 'PAUSED',
    'pause.stats': 'WAVE {0} · KILLS {1} · SCORE {2} · {3}',
    'pause.cap': 'CURRENT SHIP · {0} PARTS',
    'pause.capNone': 'CURRENT SHIP · NO PARTS',
    'pause.noMods': 'NO MODULES FITTED',
    'pause.synChip': 'SYN·{0}',
    'pause.resume': 'RESUME',
    'pause.mute': 'SOUND',
    'pause.muteOn': 'SOUND ON',
    'pause.muteOff': 'SOUND OFF',
    'pause.savequit': 'SAVE &amp; QUIT',
    'pause.restart': 'RESTART',
    'pause.hangar': 'HANGAR',

    // ---- Game over ----
    'over.lose': 'VOYAGE · LOST',
    'over.win': 'VOYAGE · SINGULARITY REACHED',
    'over.subWin': 'You crossed all twelve waves.',
    'over.subWinEndless': 'Cleared, then pushed to wave {0} in the Endless Voyage (Abyss tier {1}).',
    'over.subLose': 'Hull destroyed on wave {0}.',
    'over.score': 'SCORE',
    'over.kills': 'KILLS',
    'over.wave': 'WAVE',
    'over.level': 'LEVEL',
    'over.dust': 'DUST',
    'over.time': 'TIME',
    'over.waveN': 'W{0}',
    'over.waveOf': '{0}/{1}',
    'over.newBest': 'NEW BEST SCORE',
    'over.best': 'BEST {0}',
    'over.unlock': 'HULL UNLOCKED {0}',
    'over.again': 'PLAY AGAIN [ENTER]',
    'log.ship': 'SHIP',
    'log.wave': 'WAVE',
    'log.kills': 'KILLS',
    'log.score': 'SCORE',
    'log.empty': 'NO RUNS LOGGED YET',
    'log.win': ' ·W',

    // ---- HUD ----
    'hud.hull': 'HULL',
    'hud.shield': 'SHD',
    'hud.score': 'SCORE',
    'hud.dash': 'DASH',
    'hud.energy': 'ENERGY',
    'hud.odReady': 'OVERLOAD [E]',
    'hud.left': 'LEFT {0}',
    'hud.cd.lance': 'L',
    'hud.cd.blink': 'B',
    'hud.cd.mine': 'M',
    'hud.waveMain': 'WAVE {0}/{1}',
    'hud.waveEndless': 'WAVE {0} · ABYSS {1}',

    // ---- Banners / toasts ----
    'bn.wave': 'WAVE {0} · {1}',
    'bn.bossSoon': 'COLOSSUS INBOUND',
    'bn.bossTier': '{0} (ABYSS {1})',
    'bn.squad': 'FORMATION: {0}',
    'bn.squadTier': 'ABYSS {0} · {1}',
    'bn.clear': 'WAVE CLEARED',
    'bn.warp': 'WARPING TO WAVE {0}',
    'bn.winSub': 'CLEARED — ENDLESS VOYAGE UNLOCKED',
    'bn.od': 'OVERDRIVE',
    'bn.odSub': 'DOUBLE FIREPOWER · 5s',
    'bn.bossDead': 'COLOSSUS · DESTROYED',
    'bn.enrage': 'ENRAGED',
    'bn.enrageSub': '{0} · PHASE 2',
    'bn.bloom': 'BLOOM · {0}',
    'bn.bloomSub': 'MAX LEVEL REACHED',
    'bn.syn': 'SYNERGY · {0}',
    'bn.unlock': 'HULL UNLOCKED · {0}',
    'toast.mute': 'MUTED',
    'toast.unmute': 'SOUND ON',
    'toast.fitLv': 'FITTED LV {0}',
    'toast.allMax': 'ALL MODULES MAXED',
    'toast.allMaxSub': 'Reward converted to score · hull repaired',
    'float.block': 'BLOCK',

    // ---- Misc ----
    'vol.music': 'MUSIC',
    'vol.sfx': 'SFX',
    'touch.pause': 'II',
    'touch.full': 'FULL',
    'touch.dash': 'DASH',
    'touch.od': 'BURN',
    'touch.fire': 'FIRE',
    'touch.on': 'ON',
    'touch.off': 'OFF',
    'rotate.t': 'PLEASE ROTATE YOUR PHONE',
    'rotate.s': 'R O T A T E&nbsp;&nbsp;T O&nbsp;&nbsp;L A N D S C A P E',
    'rotate.x': 'TAP ANYWHERE TO CONTINUE',
    'lang.title': 'Switch language / 切换中英文',
    'doc.title': 'SINGULARITY VOYAGE · 奇点旅途',
    'doc.desc': 'SINGULARITY VOYAGE — a pixel-art space bullet-hell. Cross twelve waves and reach the singularity.',
  },
};

/* 取 UI 文案。{0} / {1} 位置参数。
   ⚠️ 缺键返回 `⟪键名⟫`（不是空串、也不是静默退回中文）：漏翻必须在画面上看得见。 */
function T(k, a, b, c) {
  let s = UI[lang] && UI[lang][k];
  if (s == null) s = UI.zh[k];
  if (s == null) return '⟪' + k + '⟫';
  if (a !== undefined) s = String(s).split('{0}').join(a);
  if (b !== undefined) s = String(s).split('{1}').join(b);
  if (c !== undefined) s = String(s).split('{2}').join(c);
  return s;
}

/* 把 DOM 上的 data-i18n / data-i18n-html 刷一遍。
   ⚠️ 用 textContent 而不是 innerHTML 的场合必须分开 —— 文案里带 `&gt;` 之类的实体，
      textContent 会把它原样显示出来。所以「开始航行」那条走 html 版本。 */
function applyDom() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = T(el.dataset.i18n);
    if (el.textContent !== v) el.textContent = v;
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = T(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = T(el.dataset.i18nTitle);
  const w = document.getElementById('wrap');
  if (w) w.classList.toggle('en', isEn());
  document.documentElement.lang = isEn() ? 'en' : 'zh-CN';
  document.title = T('doc.title');
  const md = document.querySelector('meta[name=description]');
  if (md) md.setAttribute('content', T('doc.desc'));
  // ⚠️ 切换按钮不止一个（标题页右上角一个、暂停面板和结算页各一个），
  //    所以按 [data-act="lang"] 全刷一遍，别只写死 #btn-lang。
  for (const lb of document.querySelectorAll('[data-act="lang"]')) lb.textContent = LANG_NEXT[lang];
}

// game.js 在 boot() 里注册「切完语言要重画哪些动态内容」（标题页 best / 机库 / 图鉴 / 卡面…）
let langRefresh = null;
function setLang(l) {
  if (LANGS.indexOf(l) < 0 || l === lang) return;
  lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  applyDom();
  if (langRefresh) langRefresh();
}
function toggleLang() { setLang(isEn() ? 'zh' : 'en'); }
