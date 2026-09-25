'use strict';
/* ============================================================
 * 局外进度：梯度等级（难度阶梯）· 航行日志（战绩）· 累计统计
 * ============================================================
 * 存 localStorage['fc_meta_v1']。
 *
 * ⚠️ 必须与局内存档 SAVE_KEY 分开：gameOver() 会 removeItem(SAVE_KEY)，
 *    局外进度要是存在里面会被一起清掉 —— 玩家通了关才发现阶梯白爬了。
 *
 * ⚠️ v 字段是版本闸：改结构就 +1，loadMeta 会直接丢弃旧数据回默认。
 *    宁可让玩家丢一次进度，也不要让半新半旧的对象污染后面所有读点。
 * ============================================================ */

const META_KEY = 'fc_meta_v1';
const META_V = 1;
const ASC_MAX = 10;      // 梯度等级上限（STS 是 20 层，我们内容量撑不住，砍一半）
const LOG_MAX = 30;      // 航行日志只留最近 30 局

/* 梯度等级：每层一条独立修正，**Lv.N = 累加前 N 条**。
   设定上沿用「共振梯度」——梯度越陡，宇宙越不欢迎你。
   ⚠️ 加层时只往数组尾部追加，别在中途插 —— 老玩家的解锁等级是按序号存的。 */
const ASC_STEPS = [
  null,                                          // Lv.0 标准梯度，无修正
  { hp: 0.10, t: '敌人生命 +10%' },
  { dmg: 0.10, t: '敌人伤害 +10%' },
  { startCurse: 1, t: '开局多带 1 张诅咒' },
  { elite: 0.20, t: '精英更强 +20%' },
  { price: 0.25, t: '商店涨价 +25%' },
  { rest: -0.30, t: '休整恢复 -30%' },
  { bossHp: 0.25, t: 'BOSS 生命 +25%' },
  { battleHp: 3, t: '每场战斗开局 -3 生命' },
  { startGold: -20, t: '起始金币 -20' },
  { battleHp: 3, t: '战斗开局再 -3 生命' },   // ⚠️ 别让 ASC_MAX 大于这张表的实际条目数，否则最高一级是空的
];

const META_DEFAULT = {
  v: META_V,
  unlockedAsc: 0,                                // 已解锁到的最高梯度等级
  bestAsc: 0,                                    // 实际通关过的最高等级
  log: [],                                       // 航行日志，最新在前
  stats: { runs: 0, wins: 0, kills: 0, floors: 0, gold: 0 },
};

function ascClamp(lv) {
  lv = Math.max(0, Math.min(ASC_MAX, lv | 0));
  return Math.min(lv, META ? META.unlockedAsc : lv);   // 选不了没解锁的等级
}

/** Lv.N 生效的全部修正（累加） */
function ascMods(level) {
  const m = { hp: 0, dmg: 0, elite: 0, price: 0, rest: 0, bossHp: 0, startCurse: 0, battleHp: 0, startGold: 0 };
  const n = Math.max(0, Math.min(ASC_MAX, level | 0));
  for (let i = 1; i <= n; i++) {
    const s = ASC_STEPS[i]; if (!s) continue;
    for (const k in s) if (k !== 't') m[k] += s[k];
  }
  return m;
}
/** Lv.N 的逐条说明（给 UI 列出来看） */
function ascLines(level) {
  const out = [];
  const n = Math.max(0, Math.min(ASC_MAX, level | 0));
  for (let i = 1; i <= n; i++) if (ASC_STEPS[i]) out.push(ASC_STEPS[i].t);
  return out;
}

function loadMeta() {
  try {
    const s = JSON.parse(localStorage.getItem(META_KEY));
    if (s && s.v === META_V && typeof s.unlockedAsc === 'number') {
      const d = JSON.parse(JSON.stringify(META_DEFAULT));
      return Object.assign(d, s, { stats: Object.assign(d.stats, s.stats || {}) });
    }
  } catch (e) { /* 存档坏了就当新玩家，不要卡在启动流程里 */ }
  return JSON.parse(JSON.stringify(META_DEFAULT));
}

let META = loadMeta();
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch (e) { } }
function metaReset() { META = JSON.parse(JSON.stringify(META_DEFAULT)); saveMeta(); }

/** 一局结束：记日志 + 攒统计 + 结算解锁。返回新解锁的等级（没解锁就返回 -1）。 */
function metaRecordRun(rec) {
  META.stats.runs++;
  if (rec.win) META.stats.wins++;
  META.stats.kills += rec.kills || 0;
  META.stats.floors += rec.floors || 0;
  META.stats.gold += rec.gold || 0;
  META.log.unshift(Object.assign({ at: Date.now() }, rec));
  if (META.log.length > LOG_MAX) META.log.length = LOG_MAX;
  let newly = -1;
  if (rec.win) {
    if (rec.asc > META.bestAsc) META.bestAsc = rec.asc;
    const next = Math.min((rec.asc | 0) + 1, ASC_MAX);
    if (next > META.unlockedAsc) { META.unlockedAsc = next; newly = next; }
  }
  saveMeta();
  return newly;
}
/** 上一局（不含当前这局）—— 结局面板拿它做对比 */
function metaPrevRun() { return META.log[0] || null; }
