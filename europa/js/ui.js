// 界面层：左栏国情 + 右侧七个标签页（省份 / 军事 / 海军 / 外交 / 贸易 / 经济 / 理念）。
//
// 这一层存在的理由：后端那些系统（贸易节点、理念、贷款、和约谈判……）
// 之前一个按钮都没有接出来，玩家点遍全屏也只能招兵和升科技。
// 现在每个系统都有对应的面板和可点的按钮。
//
// 实现约定：
//   · 所有交互走事件委托（data-act），面板整块重绘也不用重新绑定事件。
//   · 面板重绘有节流（400ms），表单类操作一律弹模态框——模态框不在重绘范围内，
//     否则玩家填到一半的数字会被 tick 冲掉。
//   · 需要点地图下达的指令（移动 / 登陆 / 舰队调动）存进 this.pending，
//     由 main.js 在地图点击时回调 onMapClick 消费。

import { getRelation, isAtWar } from './world.js';
import {
  createArmy, reinforce, disbandArmy, splitArmy, mergeArmies,
  recruitGeneral, assignGeneral, generalOf, generalLimit,
  moveArmy, warScore, peaceCost, CAV_RATIO_LIMIT,
} from './military.js';
import {
  SHIP_TYPES, fleetSize, fleetPower, fleetMaint, buildCost, sailorCost,
  createFleet, disbandFleet, moveFleet, canEmbark, embark, landingOptions, disembark,
} from './navy.js';
import {
  BUILDINGS, buildCost as provBuildCost, buildBuilding, demolishBuilding,
  devCost, developProvince, coreCost, coreProvince,
  loanSize, takeLoan, repayLoan, mintCoins,
  raiseStability, stabilityCost, reduceWarExhaustion, techCost, takeTech,
  moveCapital,
} from './economy.js';
import {
  sendGift, improveRelations, royalMarriage, formAlliance, breakAlliance,
  setRival, removeRival, guarantee, requestMilitaryAccess,
  fabricateClaim, casusBelli, declareWar, peaceOptions, peaceDeal, whitePeace,
  truceMonthsLeft, allianceSlots, opinionOf, opinionBreakdown, canRival,
} from './diplomacy.js';
import {
  GROUP_BY_ID, maxGroups, groupCount, groupProgress,
  ideaCost, canTakeIdea, takeIdea, groupStates,
  POLICIES, policySlots, policyAvailable, togglePolicy,
} from './ideas.js';
import {
  TRADE_NODES, NODE_BY_ID, GOOD_CN, merchantCount, merchantsOf,
  setMerchant, clearMerchant, autoMerchants, shareOf, stepToward,
  setEmbargo, liftEmbargo,
} from './trade.js';
import {
  ESTATES, PRIVILEGES, grantPrivilege, revokePrivilege,
  seizeLand, summonDiet, sellTitles,
} from './estates.js';
import { supplyLimit } from './military.js';
import { levyWarTax, warTaxCooldownMonths, foundNationalBank, BANK_GOLD, BANK_ADM } from './economy.js';
import { CULTURES, RELIGIONS, TERRAINS, TECH_GROUPS, GOVS } from './countries.js';
import { makeRng } from './rng.js';

const $ = (id) => document.getElementById(id);

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const n1 = (v) => (Math.round((v || 0) * 10) / 10).toFixed(1);
const sg = (v) => (v >= 0 ? '+' : '') + n1(v);
const pct = (v) => Math.round((v || 0) * 100) + '%';

/* 修正值里「负数是好事」的字段 */
const NEG_GOOD = new Set(['buildCost', 'devCost', 'coreCost', 'techCost', 'ideaCost',
  'stabilityCost', 'wsCost', 'aeImpact', 'unrest', 'interestMod']);

const MOD_LABEL = {
  taxMod: '税收', prodMod: '生产', tradeEff: '贸易效率', tradeSteer: '贸易引导', tradePowerMod: '贸易力',
  buildCost: '建筑花费', devCost: '发展花费', coreCost: '核心化花费',
  manpowerMod: '人力', sailorMod: '水手', forceLimitMod: '陆军上限', navalLimitMod: '海军上限',
  landMorale: '陆军士气', navalMorale: '海军士气', discipline: '纪律', combatAbility: '战斗力',
  siegeAbility: '围城能力', fortDefense: '要塞防御', supplyLimitMod: '补给上限',
  techCost: '科技花费', ideaCost: '理念花费', stabilityCost: '稳定花费', wsCost: '和约花费',
  interestMod: '利息',
  aeImpact: '侵略扩张', improveRelations: '改善关系', merchants: '商人',
  unrest: '动荡', warExhaustDecay: '厌战衰减',
};

function fmtMods(mods) {
  const out = [];
  for (const k in MOD_LABEL) {
    const v = mods[k];
    if (!v || Math.abs(v) < 0.005) continue;
    const good = NEG_GOOD.has(k) ? v < 0 : v > 0;
    const txt = `${MOD_LABEL[k]} ${v > 0 ? '+' : ''}${Math.round(v * 100) / 100}${k === 'merchants' || k === 'landMorale' || k === 'navalMorale' || k === 'unrest' ? '' : '%'}`;
    out.push(`<span class="mod ${good ? 'good' : 'bad'}">${esc(txt)}</span>`);
  }
  return out.join(' ');
}

function ideaModText(mods) {
  const out = [];
  for (const k in mods) {
    const v = mods[k];
    if (!v || Math.abs(v) < 0.005) continue;
    const label = MOD_LABEL[k] || k;
    out.push(`${label} ${v > 0 ? '+' : ''}${Math.round(v * 100) / 100}`);
  }
  return out.join('，') || '—';
}

const TABS = [
  { id: 'province', name: '省份' },
  { id: 'military', name: '军事' },
  { id: 'navy', name: '海军' },
  { id: 'diplomacy', name: '外交' },
  { id: 'trade', name: '贸易' },
  { id: 'economy', name: '经济' },
  { id: 'estates', name: '阶级' },
  { id: 'ideas', name: '理念' },
];

const BRANCH_CN = { adm: '行政', dip: '外交', mil: '军事' };

export class UI {
  constructor({ world, renderer, onLog }) {
    this.world = world;
    this.renderer = renderer;
    this.onLog = onLog || (() => {});

    this.tab = 'province';
    this.selProv = -1;
    this.selCountry = null;
    this.pending = null;        // { kind:'army'|'fleet'|'land', id }
    this.modal = null;

    this.tabsEl = $('tabs');
    this.bodyEl = $('tabBody');
    this.leftEl = $('leftPanel');
    this.modalEl = $('modal');
    this.modalBodyEl = $('modalBody');

    this.dirty = true;
    this.lastRender = 0;

    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('change', (e) => this.onChange(e));

    this.buildTabs();
  }

  /* ─────────── 基础工具 ─────────── */

  get tag() { return this.world.playerTag; }
  get me() { return this.world.countries.get(this.tag); }

  log(msg) {
    if (!msg) return;
    this.world.log.push(msg);
    if (this.world.log.length > 400) this.world.log.shift();
    this.onLog(msg);
  }

  markDirty() { this.dirty = true; }

  buildTabs() {
    this.tabsEl.innerHTML = TABS
      .map((t) => `<button type="button" data-act="tab" data-tab="${t.id}" class="${t.id === this.tab ? 'active' : ''}">${t.name}</button>`)
      .join('');
  }

  setTab(id) {
    if (this.tab === id) return;
    this.tab = id;
    for (const b of this.tabsEl.children) b.classList.toggle('active', b.dataset.tab === id);
    this.dirty = true;
    this.render(true);
  }

  /** 主循环每帧调用：暂停时立即重绘，运行时限流 400ms */
  update(now) {
    if (this.modal) return;                       // 弹窗打开时不重绘面板
    if (this.dirty || (!this.world.paused && now - this.lastRender > 400)) this.render();
  }

  render(force) {
    if (this.modal && !force) return;
    this.dirty = false;
    this.lastRender = performance.now();
    this.renderTop();
    const st = this.bodyEl.scrollTop;
    this.bodyEl.innerHTML = this.renderBody();
    this.bodyEl.scrollTop = st;
    const ls = this.leftEl.scrollTop;
    this.leftEl.innerHTML = this.renderLeft();
    this.leftEl.scrollTop = ls;
  }

  renderTop() {
    const c = this.me;
    if (!c) return;
    const L = c.ledger || {};
    const bal = (L.income || 0) - (L.expense || 0);
    const army = c.armies.reduce((s, a) => s + a.size, 0);
    const mc = merchantCount(this.world, this.tag);
    const used = merchantsOf(this.world, this.tag).length;
    const set = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
    set('topCountry', c.name);
    set('topTag', c.tag);
    set('topGold', Math.floor(c.treasury));
    set('topBalance', sg(bal) + '/月');
    set('topMan', `${Math.floor(c.manpower)}/${c.maxManpower}`);
    set('topArmy', army);
    set('topFL', c.forceLimit);
    set('topMerch', `${used}/${mc}`);
    const balEl = $('topBalance');
    if (balEl) balEl.className = bal >= 0 ? 'pos' : 'neg';
  }

  /* ─────────── 事件委托 ─────────── */

  onClick(e) {
    const t = e.target instanceof Element ? e.target.closest('[data-act]') : null;
    if (!t) return;
    const act = t.dataset.act;
    e.preventDefault();
    if (act !== 'tab' && act !== 'modalClose') e.stopPropagation();
    try {
      this.doAction(act, t, e);
    } catch (err) {
      console.error('[ui] action failed:', act, err);
      this.log('操作失败：' + err.message);
    }
    this.markDirty();
    if (this.renderer) this.renderer.invalidate();
  }

  onChange(e) {
    const t = e.target instanceof Element ? e.target.closest('[data-act]') : null;
    if (!t || !this.modal) return;
    if (t.dataset.act === 'peaceCalc') this.updatePeaceCost();
    if (t.dataset.act === 'fleetCalc') this.updateFleetCost();
  }

  /* ─────────── 动作分发 ─────────── */

  doAction(act, el) {
    const W = this.world, tag = this.tag, c = this.me;
    const pid = Number(el.dataset.pid ?? -1);
    const id = Number(el.dataset.id ?? -1);

    switch (act) {
      case 'tab': this.setTab(el.dataset.tab); return;
      case 'modalClose': this.closeModal(); return;
      case 'modalSubmit': this.submitModal(); return;

      /* ── 省份 ── */
      case 'selProv':
        this.selProv = pid;
        if (this.renderer) this.renderer.setSelected(pid);
        return;
      case 'dev': {
        const p = W.provinces.get(pid);
        const ok = developProvince(W, pid, el.dataset.kind);
        this.log(ok
          ? `${p.name} 的${el.dataset.kind === 'tax' ? '税收' : el.dataset.kind === 'prod' ? '生产' : '人力'}发展度提升到 ${el.dataset.kind === 'tax' ? p.baseTax : el.dataset.kind === 'prod' ? p.baseProduction : p.baseManpower}`
          : '君主点数不足以提升发展度');
        return;
      }
      case 'build': {
        const p = W.provinces.get(pid), type = el.dataset.type;
        const ok = buildBuilding(W, pid, type);
        this.log(ok ? `在 ${p.name} 建成了${BUILDINGS[type].name}` : `金币不足以在 ${p.name} 建造${BUILDINGS[type].name}`);
        return;
      }
      case 'demolish': {
        const type = el.dataset.type;
        demolishBuilding(W, pid, type);
        this.log(`拆除了 ${W.provinces.get(pid).name} 的${BUILDINGS[type].name}`);
        return;
      }
      case 'core': {
        const p = W.provinces.get(pid);
        const ok = coreProvince(W, tag, pid);
        this.log(ok ? `${p.name} 已成为核心领土` : `行政点数不足，无法核心化 ${p.name}（需 ${coreCost(W, tag, pid)}）`);
        return;
      }
      case 'claim': {
        const p = W.provinces.get(pid);
        const ok = fabricateClaim(W, tag, pid);
        this.log(ok ? `已对 ${p.name} 伪造宣称` : '无法伪造宣称（需接壤且外交点数 ≥ 50）');
        return;
      }
      case 'moveCapital': {
        const p = W.provinces.get(pid);
        const r = moveCapital(W, tag, pid);
        this.log(r.ok ? `朝廷迁往 ${p.name}，本土贸易节点随之迁移` : '迁都失败：' + r.why);
        return;
      }

      /* ── 军事 ── */
      case 'recruitArmy': this.openRecruit(); return;
      case 'recruitGeneral': {
        const g = recruitGeneral(W, tag, makeRng(W.seed + '/gen/' + W.nextId));
        this.log(g ? `任命了将领 ${g.name}（${g.fire}/${g.shock}/${g.maneuver}/${g.siege}）` : '无法任命将领（军事点数不足或已达上限）');
        return;
      }
      case 'armyMove':
        this.pending = { kind: 'army', id };
        this.log('点击地图上相邻的省份下达移动命令（Esc 取消）');
        return;
      case 'armySplit': {
        const a = this.findArmy(id);
        const b = a && splitArmy(W, a);
        this.log(b ? '军队已一分为二' : '兵力太少，无法拆分');
        return;
      }
      case 'armyMerge': this.openMerge(id); return;
      case 'armyReinforce': this.openReinforce(id); return;
      case 'armyDisband': {
        const a = this.findArmy(id);
        if (!a) return;
        this.log(`解散了 ${a.size} 千人的部队`);
        disbandArmy(W, a);
        return;
      }
      case 'armyGeneral': this.openGenerals(id); return;

      /* ── 海军 ── */
      case 'buildFleet': this.openFleetBuild(); return;
      case 'fleetMove':
        this.pending = { kind: 'fleet', id };
        this.log('点击相邻海域调动舰队（Esc 取消）');
        return;
      case 'fleetDisband': {
        const f = this.findFleet(id);
        if (!f) return;
        this.log('舰队已解散');
        disbandFleet(W, f);
        return;
      }
      case 'embark': {
        const a = this.findArmy(id);
        if (!a) return;
        const f = canEmbark(W, a);
        this.log(f && embark(W, a, f) ? `${a.size} 千人登船` : '附近没有可搭载的己方舰队');
        return;
      }
      case 'disembark': this.openLanding(id); return;

      /* ── 外交 ── */
      case 'selCountry': this.selCountry = el.dataset.ctag; return;
      case 'dipGift': {
        const r = sendGift(W, tag, this.selCountry);
        this.log(r.ok ? `赠送了 ${r.amount} 金币` : '送礼失败：' + r.why);
        return;
      }
      case 'dipImprove': {
        const r = improveRelations(W, tag, this.selCountry);
        this.log(r.ok ? '派遣使节改善关系' : '失败：' + r.why);
        return;
      }
      case 'dipMarry': {
        const r = royalMarriage(W, tag, this.selCountry);
        this.log(r.ok ? '两国王室联姻' : '失败：' + r.why);
        return;
      }
      case 'dipAlly': {
        const r = formAlliance(W, tag, this.selCountry);
        this.log(r.ok ? '结为同盟' : '失败：' + r.why);
        return;
      }
      case 'dipBreakAlly': {
        const r = breakAlliance(W, tag, this.selCountry);
        this.log(r.ok ? '同盟已解除' : '失败：' + r.why);
        return;
      }
      case 'dipRival': {
        const r = setRival(W, tag, this.selCountry);
        this.log(r.ok ? '已设为宿敌' : '失败：' + r.why);
        return;
      }
      case 'dipUnrival': {
        const r = removeRival(W, tag, this.selCountry);
        this.log(r.ok ? '已取消宿敌' : '失败：' + r.why);
        return;
      }
      case 'dipGuarantee': {
        const r = guarantee(W, tag, this.selCountry);
        this.log(r.ok ? '已提供独立保障' : '失败：' + r.why);
        return;
      }
      case 'dipAccess': {
        const r = requestMilitaryAccess(W, tag, this.selCountry);
        this.log(r.ok ? '获得军事通行权' : '失败：' + r.why);
        return;
      }
      case 'declareWar': this.openWar(this.selCountry); return;

      /* ── 战争 ── */
      case 'peace': this.openPeace(Number(el.dataset.war)); return;
      case 'whitePeace': {
        const war = W.wars.find((w) => w.id === Number(el.dataset.war));
        if (war) this.log(whitePeace(W, war) ? '缔结白色和约' : '战争已结束');
        return;
      }

      /* ── 贸易 ── */
      case 'merchantSteer': {
        const node = el.dataset.node, to = el.dataset.to;
        const ok = setMerchant(W, tag, node, 'steer', to);
        this.log(ok ? `商人前往 ${NODE_BY_ID.get(node).name} 转移贸易` : '商人数量已满');
        return;
      }
      case 'merchantCollect': {
        const node = el.dataset.node;
        const ok = setMerchant(W, tag, node, 'collect');
        this.log(ok ? `商人留在 ${NODE_BY_ID.get(node).name} 收取` : '商人数量已满');
        return;
      }
      case 'merchantClear': {
        clearMerchant(W, tag, el.dataset.node);
        this.log(`从 ${NODE_BY_ID.get(el.dataset.node).name} 撤回商人`);
        return;
      }
      case 'autoMerchants': {
        autoMerchants(W, tag);
        this.log('商人已自动派驻');
        return;
      }

      /* ── 经济 ── */
      case 'takeLoan': {
        const ok = takeLoan(W, tag);
        this.log(ok ? `获得贷款 ${loanSize(c)} 金币` : '贷款已达上限');
        return;
      }
      case 'repayLoan': {
        this.log(repayLoan(W, tag) ? '偿还了一笔贷款' : '金币不足以还贷');
        return;
      }
      case 'mint': {
        const amt = mintCoins(W, tag);
        this.log(`铸币获得 ${amt} 金币，通胀上升`);
        return;
      }
      case 'raiseStab': {
        this.log(raiseStability(W, tag) ? '稳定度提升' : `行政点数不足（需 ${stabilityCost(W, tag)}）`);
        return;
      }
      case 'reduceWE': {
        this.log(reduceWarExhaustion(W, tag) ? '厌战度下降' : '外交点数不足或厌战度已很低');
        return;
      }
      case 'takeTech': {
        const br = el.dataset.branch;
        this.log(takeTech(W, tag, br) ? `${BRANCH_CN[br]}科技提升至 ${c.tech[br]}` : `${BRANCH_CN[br]}点数不足（需 ${techCost(W, tag, br)}）`);
        return;
      }

      /* ── 理念 ── */
      case 'takeIdea': {
        const gid = el.dataset.gid;
        const r = takeIdea(W, tag, gid);
        const g = GROUP_BY_ID.get(gid);
        if (r.ok) this.log(`${g.name}：解锁「${g.ideas[groupProgress(c, gid) - 1].name}」${r.done ? '，本组完成！' : ''}`);
        else this.log(r.why);
        return;
      }

      /* ── 阶级 ── */
      case 'estatePriv': {
        const p = PRIVILEGES.find((x) => x.id === el.dataset.pid);
        const r = grantPrivilege(W, tag, el.dataset.pid);
        this.log(r.ok ? `授予${ESTATES[p.estate].name}特权「${p.name}」` : '授予失败：' + r.why);
        return;
      }
      case 'estateUnpriv': {
        const p = PRIVILEGES.find((x) => x.id === el.dataset.pid);
        const r = revokePrivilege(W, tag, el.dataset.pid);
        this.log(r.ok ? `收回特权「${p.name}」，${ESTATES[p.estate].name}颇为不满` : '收回失败：' + r.why);
        return;
      }
      case 'estateSeize': {
        const r = seizeLand(W, tag);
        this.log(r.ok ? '王室夺取领地归为己有，四个阶级齐声抱怨' : '夺取失败：' + r.why);
        return;
      }
      case 'estateDiet': {
        const r = summonDiet(W, tag, makeRng(W.seed + '/diet/' + W.stats.tick));
        this.log(r.ok ? `议会召开：${ESTATES[r.estate].name}的忠诚度上升，${r.reward}` : '召开失败：' + r.why);
        return;
      }
      case 'estateSell': {
        const r = sellTitles(W, tag);
        this.log(r.ok ? `出售王室头衔，进账 ${r.amount} 金币，市民笑逐颜开` : '出售失败：' + r.why);
        return;
      }

      /* ── 政策 ── */
      case 'policyToggle': {
        const r = togglePolicy(W, tag, el.dataset.pid);
        this.log(r.ok ? (r.on ? '政策已启用' : '政策已停用') : '无法启用：' + r.why);
        return;
      }

      /* ── 金融 ── */
      case 'warTax': {
        const r = levyWarTax(W, tag);
        this.log(r.ok ? `征收战争税，国库进账 ${r.amount} 金币，厌战度上升` : '无法征收：' + r.why);
        return;
      }
      case 'foundBank': {
        this.log(foundNationalBank(W, tag)
          ? '国家银行成立：利息更轻、贷款更大、通胀回落更快'
          : `成立银行需要 ${BANK_GOLD} 金币与 ${BANK_ADM} 行政点数`);
        return;
      }
      case 'subsidy': this.openSubsidy(); return;

      /* ── 禁运 ── */
      case 'embargo': {
        const o = W.countries.get(this.selCountry);
        const r = setEmbargo(W, tag, this.selCountry);
        this.log(r.ok ? `已对 ${o.name} 实施禁运，商路上见` : '禁运失败：' + r.why);
        return;
      }
      case 'liftEmbargo': {
        const o = W.countries.get(el.dataset.ctag || this.selCountry);
        const r = liftEmbargo(W, tag, el.dataset.ctag || this.selCountry);
        this.log(r.ok ? `解除了对 ${o ? o.name : '对方'} 的禁运` : '解除失败：' + r.why);
        return;
      }
      default: return;
    }
  }

  /* ─────────── 地图点击（由 main.js 回调） ─────────── */

  onMapClick(pid) {
    if (!this.pending) return false;
    const p = this.pending;
    this.pending = null;
    const target = this.world.provinces.get(pid);
    if (!target) return true;

    if (p.kind === 'army') {
      const a = this.findArmy(p.id);
      if (!a) return true;
      if (a.embarked != null) {
        this.log(disembark(this.world, a, pid) ? `部队在 ${target.name} 登陆` : '无法在此登陆（需与舰队所在海域相邻，且中立国不会放行）');
      } else if (moveArmy(this.world, a, pid)) {
        this.log(`部队向 ${target.name} 开进`);
      } else {
        this.log('无法移动：目标不与当前省份相邻，或未获得通行权');
      }
      return true;
    }
    if (p.kind === 'fleet') {
      const f = this.findFleet(p.id);
      if (!f) return true;
      this.log(moveFleet(this.world, f, pid) ? `舰队驶向 ${target.name}` : '无法调动：目标海域不相邻');
      return true;
    }
    if (p.kind === 'land') {
      const a = this.findArmy(p.id);
      if (!a) return true;
      this.log(disembark(this.world, a, pid) ? `部队在 ${target.name} 登陆` : '无法在此登陆');
      return true;
    }
    return false;
  }

  cancelPending() {
    if (!this.pending) return false;
    this.pending = null;
    this.log('已取消命令');
    this.markDirty();
    return true;
  }

  findArmy(id) {
    for (const c of this.world.countries.values()) {
      const a = c.armies.find((x) => x.id === id);
      if (a) return a;
    }
    return null;
  }

  findFleet(id) {
    for (const c of this.world.countries.values()) {
      const f = c.fleets.find((x) => x.id === id);
      if (f) return f;
    }
    return null;
  }

  openReinforce(id) {
    const a = this.findArmy(id);
    if (!a) return;
    const c = this.me;
    const cap = Math.min(Math.floor(c.manpower), Math.floor(c.treasury / 2));
    if (cap < 1) { this.log('人力或金币不足，无法补员'); return; }
    const dflt = Math.max(1, Math.min(cap, Math.max(200, Math.round(a.size * 0.25))));
    this.openModal({
      title: '补充兵员',
      body: `<div class="m-note">当前 ${a.size} 千人（步 ${a.comp.inf}·骑 ${a.comp.cav}·炮 ${a.comp.art}）。补员按 7:2.5:0.5 的比例分摊到三个兵种。</div>
        <div class="f"><label>补充人数（千人）</label><input type="number" data-key="n" value="${dflt}" min="1" max="${cap}" step="100" /></div>
        <div class="m-note">花费 2 金 / 千人。可用人力 ${Math.floor(c.manpower)}，金币 ${Math.floor(c.treasury)}。</div>`,
      submit: '补员',
      onSubmit: () => {
        const n = reinforce(this.world, a, Math.floor(this.fieldVal('n') || 0));
        this.log(n > 0 ? `补充了 ${n} 千人，现有 ${a.size} 千人` : '人力或金币不足，无法补员');
      },
    });
  }

  /* ─────────── 左栏：国情 ─────────── */

  renderLeft() {
    const W = this.world, c = this.me;
    if (!c) return '';
    const L = c.ledger || { income: 0, expense: 0 };
    const bal = L.income - L.expense;
    const army = c.armies.reduce((s, a) => s + a.size, 0);
    const ships = c.fleets.reduce((s, f) => s + fleetSize(f), 0);
    const mods = W.modsFor(this.tag);
    const m = c.monarch;

    return `
      <div class="l-head">
        <span class="l-flag" style="background:rgb(${c.color[0]},${c.color[1]},${c.color[2]})"></span>
        <span><b>${esc(c.name)}</b> <i>${esc(c.tag)}</i></span>
      </div>
      <div class="kv"><i>君主</i><b>${esc(m.name)} <em>${m.adm}/${m.dip}/${m.mil}</em></b></div>
      <div class="kv"><i>政体 / 科技组</i><b>${esc(GOVS[c.gov] || c.gov)} · ${esc(TECH_GROUPS[c.techGroup] || c.techGroup)}</b></div>
      <div class="kv"><i>国教 / 主流文化</i><b>${esc((RELIGIONS[c.religion] || {}).name || c.religion)} · ${esc(CULTURES[c.culture] || c.culture)}</b></div>
      <div class="sep"></div>
      <div class="kv"><i>稳定度</i><b class="${c.stability < 0 ? 'bad' : 'good'}">${c.stability > 0 ? '+' : ''}${c.stability}</b></div>
      <div class="kv"><i>威望 / 正统</i><b>${Math.round(c.prestige)} · ${Math.round(c.legitimacy)}</b></div>
      <div class="kv"><i>厌战 / 通胀</i><b class="${c.warExhaustion > 5 ? 'bad' : ''}">${n1(c.warExhaustion)} · ${n1(c.inflation)}%</b></div>
      <div class="sep"></div>
      <div class="kv"><i>国库</i><b>${Math.floor(c.treasury)} <em class="${bal >= 0 ? 'good' : 'bad'}">${sg(bal)}</em></b></div>
      <div class="kv"><i>发展度 / 省份</i><b>${c.development} · ${c.provinceCount}</b></div>
      <div class="kv"><i>人力</i><b>${Math.floor(c.manpower)} / ${c.maxManpower}</b></div>
      <div class="kv"><i>陆军</i><b>${army} / ${c.forceLimit} 千</b></div>
      <div class="kv"><i>水手</i><b>${Math.floor(c.sailors)} / ${c.maxSailors}</b></div>
      <div class="kv"><i>舰船</i><b>${ships} / ${c.navalLimit}</b></div>
      <div class="kv"><i>贷款</i><b class="${c.loans.length ? 'bad' : ''}">${c.loans.length} 笔</b></div>
      <div class="sep"></div>
      <div class="kv"><i>王权领地</i><b class="${c.crownland < 30 ? 'bad' : ''}">${Math.round(c.crownland)}%</b></div>
      <div class="kv"><i>军事传统</i><b>${Math.round(c.armyTradition || 0)}</b></div>
      <div class="sep"></div>
      <div class="kv"><i>科技</i><b>${c.tech.adm} / ${c.tech.dip} / ${c.tech.mil}</b></div>
      <div class="kv"><i>理念组</i><b>${groupCount(c)} / ${maxGroups(c)}</b></div>
      <div class="kv"><i>政策</i><b>${c.policies ? c.policies.size : 0} / ${policySlots(c)}</b></div>
      <div class="mods">${fmtMods(mods)}</div>
    `;
  }

  /* ─────────── 右栏：标签页 ─────────── */

  renderBody() {
    switch (this.tab) {
      case 'military': return this.tabMilitary();
      case 'navy': return this.tabNavy();
      case 'diplomacy': return this.tabDiplomacy();
      case 'trade': return this.tabTrade();
      case 'economy': return this.tabEconomy();
      case 'estates': return this.tabEstates();
      case 'ideas': return this.tabIdeas();
      default: return this.tabProvince();
    }
  }

  banner() {
    if (!this.pending) return '';
    const kind = this.pending.kind === 'fleet' ? '舰队' : '部队';
    return `<div class="banner">正在为${kind}下达移动命令 —— 点击地图上的目标省份（Esc 取消）</div>`;
  }

  hint(t) { return `<div class="hint">${t}</div>`; }

  /* ─────────── 省份 ─────────── */

  tabProvince() {
    const W = this.world;
    const p = W.provinces.get(this.selProv);
    let html = this.banner();
    if (!p || p.sea) {
      html += `<h3 class="th">未选中省份</h3>
        <div class="hint">点击地图上的任意省份查看详情：发展度、建筑、核心化、宣称。</div>`;
      html += this.ownProvinceList();
      return html;
    }

    const owner = p.owner ? W.countries.get(p.owner) : null;
    const ctrl = p.controller ? W.countries.get(p.controller) : null;
    const mine = p.owner === this.tag;
    const dev = p.baseTax + p.baseProduction + p.baseManpower;
    const node = p.tradeNode ? (NODE_BY_ID.get(p.tradeNode) || {}).name : '—';
    const core = p.cores.has(this.tag);

    html += `<h3 class="th">${esc(p.name)}${p.capital ? ' <em class="gold">★首都</em>' : ''}</h3>
      <div class="kv"><i>所有者</i><b>${owner ? esc(owner.name) : '无主之地'}</b></div>
      <div class="kv"><i>控制者</i><b class="${ctrl && owner && ctrl.tag !== owner.tag ? 'bad' : ''}">${ctrl ? esc(ctrl.name) : '—'}</b></div>
      <div class="kv"><i>地形 / 贸易品</i><b>${esc((TERRAINS[p.terrain] || {}).name || p.terrain)} · ${esc(GOOD_CN[p.tradeGood] || p.tradeGood)}</b></div>
      <div class="kv"><i>宗教 / 文化</i><b>${esc((RELIGIONS[p.religion] || {}).name || p.religion)} · ${esc(CULTURES[p.culture] || p.culture)}</b></div>
      <div class="kv"><i>贸易节点</i><b>${esc(node)}</b></div>
      <div class="kv"><i>总发展度</i><b>${dev}</b></div>
      <div class="kv"><i>自治 / 动荡</i><b>${pct(p.autonomy)} · ${n1(p.unrest)}</b></div>
      <div class="kv"><i>要塞等级</i><b>${p.fort || 0}${p.coastal ? ' · 沿海' : ''}${p.capital ? ' · 国都' : ''}</b></div>
      <div class="kv"><i>补给上限</i><b>${supplyLimit(W, p.id)} 千</b></div>
      <div class="kv"><i>破坏度</i><b class="${(p.devastation || 0) > 20 ? 'bad' : ''}">${Math.round(p.devastation || 0)}%</b></div>`;

    html += `<div class="sub">发展度</div>`;
    for (const [kind, label, key, branch] of [
      ['tax', '税收', 'baseTax', 'adm'], ['prod', '生产', 'baseProduction', 'dip'], ['man', '人力', 'baseManpower', 'mil'],
    ]) {
      const cost = devCost(W, this.selProv, kind);
      const can = mine && this.me.powers[branch] >= cost;
      html += `<div class="devrow">
        <span>${label}</span><b>${p[key]}</b>
        <button type="button" data-act="dev" data-pid="${p.id}" data-kind="${kind}" ${can ? '' : 'disabled'}>+1（${cost} ${branch.toUpperCase()}）</button>
      </div>`;
    }

    html += `<div class="sub">建筑</div><div class="builds">`;
    for (const type in BUILDINGS) {
      const B = BUILDINGS[type];
      const has = !!p.buildings[type];
      const cost = provBuildCost(W, p.id, type);
      const can = mine && !has && this.me.treasury >= cost;
      html += `<div class="brow ${has ? 'has' : ''}">
        <span class="bname" title="${esc(B.desc)}">${esc(B.name)}</span>
        <span class="bdesc">${esc(B.desc)}</span>
        ${has
          ? `<button type="button" data-act="demolish" data-pid="${p.id}" data-type="${type}">拆除</button>`
          : `<button type="button" data-act="build" data-pid="${p.id}" data-type="${type}" ${can ? '' : 'disabled'}>${cost} 金</button>`}
      </div>`;
    }
    html += `</div>`;

    if (mine) {
      const cc = coreCost(W, this.tag, p.id);
      html += `<div class="acts">
        <button type="button" data-act="core" data-pid="${p.id}" ${core || this.me.powers.adm < cc ? 'disabled' : ''}>${core ? '已是核心' : `核心化（${cc} ADM）`}</button>
        ${!p.capital && p.cores.has(this.tag) && p.controller === this.tag
          ? `<button type="button" data-act="moveCapital" data-pid="${p.id}" ${this.me.powers.adm < 100 ? 'disabled' : ''} title="首都：城防 2 级、贸易力 +25%；本土贸易节点随首都而定">迁都至此（100 ADM）</button>`
          : ''}
      </div>`;
    } else if (p.owner) {
      const claimed = this.me.claims.has(p.id);
      const adj = [...this.me.provinces].some((id) => W.provinces.get(id).adj.includes(p.id));
      html += `<div class="acts">
        <button type="button" data-act="claim" data-pid="${p.id}" ${claimed || !adj || this.me.powers.dip < 50 ? 'disabled' : ''}>${claimed ? '已有宣称' : adj ? '伪造宣称（50 DIP）' : '不接壤，无法伪造宣称'}</button>
      </div>`;
    }
    html += this.ownProvinceList();
    return html;
  }

  ownProvinceList() {
    const W = this.world, c = this.me;
    const list = [...c.provinces].map((id) => W.provinces.get(id))
      .filter((p) => p && !p.sea)
      .sort((a, b) => (b.baseTax + b.baseProduction + b.baseManpower) - (a.baseTax + a.baseProduction + a.baseManpower))
      .slice(0, 12);
    if (!list.length) return '';
    return `<div class="sub">直辖省份（按发展度）</div><div class="plist">` + list.map((p) => {
      const dev = p.baseTax + p.baseProduction + p.baseManpower;
      return `<button type="button" class="prow ${p.id === this.selProv ? 'on' : ''}" data-act="selProv" data-pid="${p.id}">
        <span>${esc(p.name)}${p.capital ? '★' : ''}</span>
        <em>${dev}</em>
        <i class="${p.unrest > 5 ? 'bad' : ''}">${n1(p.unrest)}</i>
      </button>`;
    }).join('') + `</div>`;
  }

  /* ─────────── 军事 ─────────── */

  tabMilitary() {
    const W = this.world, c = this.me;
    const total = c.armies.reduce((s, a) => s + a.size, 0);
    let html = this.banner();
    html += `<h3 class="th">陆军</h3>
      <div class="kv"><i>兵力 / 上限</i><b class="${total > c.forceLimit ? 'bad' : ''}">${total} / ${c.forceLimit} 千</b></div>
      <div class="kv"><i>可用人力</i><b>${Math.floor(c.manpower)} / ${c.maxManpower}</b></div>
      <div class="kv"><i>军事传统</i><b class="${(c.armyTradition || 0) > 50 ? 'good' : ''}">${Math.round(c.armyTradition || 0)}</b></div>
      <div class="kv"><i>将领</i><b>${c.generals.length} / ${generalLimit(c)}</b></div>
      <div class="hint">军事传统靠打仗积攒、和平流失：提升纪律与士气，也让新将领更有才华。</div>
      <div class="acts">
        <button type="button" data-act="recruitArmy">招募军队</button>
        <button type="button" data-act="recruitGeneral" ${c.powers.mil < 50 || c.generals.length >= generalLimit(c) ? 'disabled' : ''}>任命将领（50 MIL）</button>
      </div>`;

    html += `<div class="sub">军团（${c.armies.length}）</div>`;
    if (!c.armies.length) html += `<div class="empty">没有常备军。先在自家省份招募一支。</div>`;
    for (const a of c.armies) {
      const p = W.provinces.get(a.prov);
      const g = generalOf(W, a);
      const comp = a.comp || { inf: a.size, cav: 0, art: 0 };
      const mp = Math.round((a.morale / (a.maxMorale || 1)) * 100);
      const cap = supplyLimit(W, a.prov);
      const over = a.size > cap;
      html += `<div class="card">
        <div class="c-top">
          <b>${a.size} 千人</b>
          <span>${esc(p ? p.name : '?')}${a.embarked != null ? ' <em class="gold">船上</em>' : ''}</span>
        </div>
        <div class="c-line">
          <span>步 ${comp.inf} · 骑 ${comp.cav} · 炮 ${comp.art}</span>
          <span>士气 ${n1(a.morale)}/${n1(a.maxMorale)}</span>
        </div>
        <div class="bar"><i style="width:${Math.max(0, Math.min(100, mp))}%"></i></div>
        <div class="c-line dim">${g ? `将领 ${esc(g.name)}（${g.fire}/${g.shock}/${g.maneuver}/${g.siege}）` : '无将领'}${a.movement ? ' · 行军中' : ''} · 补给上限 ${cap}${over ? ' <em class="bad">超补给，将折损</em>' : ''}</div>
        <div class="c-acts">
          <button type="button" data-act="armyMove" data-id="${a.id}" ${a.movement ? 'disabled' : ''}>${a.embarked != null ? '登陆' : '移动'}</button>
          <button type="button" data-act="armySplit" data-id="${a.id}" ${a.size < 2 || a.movement ? 'disabled' : ''}>拆分</button>
          <button type="button" data-act="armyMerge" data-id="${a.id}" ${a.movement ? 'disabled' : ''}>合并</button>
          <button type="button" data-act="armyReinforce" data-id="${a.id}">补员</button>
          <button type="button" data-act="armyGeneral" data-id="${a.id}" ${!c.generals.length ? 'disabled' : ''}>将领</button>
          <button type="button" data-act="armyDisband" data-id="${a.id}">解散</button>
        </div>
      </div>`;
    }

    const wars = W.wars.filter((w) => w.active && (w.attackers.has(this.tag) || w.defenders.has(this.tag)));
    html += `<div class="sub">战争（${wars.length}）</div>`;
    if (!wars.length) html += `<div class="empty">目前处于和平状态。</div>`;
    for (const w of wars) {
      const ws = warScore(W, w);
      const mine = w.attackers.has(this.tag) ? ws : -ws;
      const enemy = w.attackers.has(this.tag) ? W.countries.get(w.defender) : W.countries.get(w.attacker);
      const side = w.attackers.has(this.tag) ? '进攻' : '防守';
      const attNames = [...w.attackers].filter((t) => t !== this.tag).map((t) => W.countries.get(t).name).join('、');
      const defNames = [...w.defenders].filter((t) => t !== this.tag).map((t) => W.countries.get(t).name).join('、');
      html += `<div class="card war">
        <div class="c-top"><b>${side}：对 ${esc(enemy.name)}</b><span>战争分数 <em class="${mine >= 0 ? 'good' : 'bad'}">${mine >= 0 ? '+' : ''}${Math.round(mine)}</em></span></div>
        <div class="c-line dim">以「${esc(w.cbName)}」开战 · 已进行 ${(W.date.y - w.start.y) * 12 + W.date.m - w.start.m} 个月</div>
        ${attNames || defNames ? `<div class="c-line dim">我方阵营：${esc([...w.attackers].map((t) => W.countries.get(t).name).join('、'))}　敌方阵营：${esc([...w.defenders].map((t) => W.countries.get(t).name).join('、'))}</div>` : ''}
        <div class="c-acts">
          <button type="button" data-act="peace" data-war="${w.id}">谈判</button>
          <button type="button" data-act="whitePeace" data-war="${w.id}">白色和约</button>
        </div>
      </div>`;
    }

    const rebels = W.rebels.filter((r) => r.home === this.tag);
    if (rebels.length) {
      html += `<div class="sub bad">叛乱（${rebels.length}）</div>`;
      for (const r of rebels) {
        html += `<div class="card"><div class="c-top"><b>${esc((W.provinces.get(r.prov) || {}).name || '?')}</b><span>${r.size} 千人</span></div>
          <div class="c-line dim">已盘踞 ${r.hold} 个月，满 24 个月将强制降低稳定度</div></div>`;
      }
    }
    return html;
  }

  /* ─────────── 海军 ─────────── */

  tabNavy() {
    const W = this.world, c = this.me;
    const ships = c.fleets.reduce((s, f) => s + fleetSize(f), 0);
    let html = this.banner();
    html += `<h3 class="th">海军</h3>
      <div class="kv"><i>舰船 / 上限</i><b class="${ships > c.navalLimit ? 'bad' : ''}">${ships} / ${c.navalLimit}</b></div>
      <div class="kv"><i>水手</i><b>${Math.floor(c.sailors)} / ${c.maxSailors}</b></div>
      <div class="kv"><i>舰队维护</i><b>−${n1(c.fleets.reduce((s, f) => s + fleetMaint(f), 0))}/月</b></div>
      <div class="acts"><button type="button" data-act="buildFleet">建造舰队</button></div>`;

    html += `<div class="sub">舰队（${c.fleets.length}）</div>`;
    if (!c.fleets.length) html += `<div class="empty">没有舰队。沿海省份可在相邻海域编组舰队。</div>`;
    for (const f of c.fleets) {
      const p = W.provinces.get(f.prov);
      const carried = c.armies.filter((a) => a.embarked === f.id);
      html += `<div class="card">
        <div class="c-top"><b>${fleetSize(f)} 艘</b><span>${esc(p ? p.name : '?')}${f.movement ? ' · 航行中' : ''}</span></div>
        <div class="c-line"><span>重 ${f.ships.heavy} · 轻 ${f.ships.light} · 桨 ${f.ships.galley}</span><span>战力 ${n1(fleetPower(f))}</span></div>
        <div class="c-line dim">维护 −${n1(fleetMaint(f))}/月${f.ships.light ? ` · 轻舰 ${f.ships.light} 艘为相邻节点贡献贸易力` : ''}${carried.length ? ` · 载有 ${carried.reduce((s, a) => s + a.size, 0)} 千人` : ''}</div>
        <div class="c-acts">
          <button type="button" data-act="fleetMove" data-id="${f.id}" ${f.movement ? 'disabled' : ''}>调动</button>
          <button type="button" data-act="fleetDisband" data-id="${f.id}">解散</button>
        </div>
      </div>`;
    }

    const landArmies = c.armies.filter((a) => !a.movement);
    html += `<div class="sub">运输</div>`;
    if (!landArmies.length) html += `<div class="empty">没有可调动的部队。</div>`;
    for (const a of landArmies) {
      const p = W.provinces.get(a.prov);
      if (a.embarked != null) {
        html += `<div class="card"><div class="c-top"><b>${a.size} 千人（船上）</b><span>${esc(p ? p.name : '?')}</span></div>
          <div class="c-acts"><button type="button" data-act="disembark" data-id="${a.id}">选择登陆点</button></div></div>`;
      } else if (p && p.coastal) {
        const f = canEmbark(W, a);
        html += `<div class="card"><div class="c-top"><b>${a.size} 千人</b><span>${esc(p.name)}</span></div>
          <div class="c-acts"><button type="button" data-act="embark" data-id="${a.id}" ${f ? '' : 'disabled'}>${f ? '登船' : '附近无己方舰队'}</button></div></div>`;
      }
    }
    return html;
  }

  /* ─────────── 外交 ─────────── */

  tabDiplomacy() {
    const W = this.world, c = this.me;
    let html = `<h3 class="th">外交</h3>
      <div class="kv"><i>同盟槽</i><b>${c.allies.size} / ${allianceSlots(c)}</b></div>
      <div class="kv"><i>宿敌</i><b>${[...c.rivals].map((t) => esc(W.countries.get(t).name)).join('、') || '—'}</b></div>
      <div class="kv"><i>盟友</i><b>${[...c.allies].map((t) => esc(W.countries.get(t).name)).join('、') || '—'}</b></div>`;

    const others = [...W.countries.values()]
      .filter((o) => o.tag !== this.tag && o.provinces.size > 0)
      .sort((a, b) => {
        const ra = opinionOf(W, this.tag, a.tag), rb = opinionOf(W, this.tag, b.tag);
        if (rb !== ra) return rb - ra;
        return b.development - a.development;
      });

    html += `<div class="sub">国家（按友好度）</div><div class="plist tall">`;
    for (const o of others) {
      const op = opinionOf(W, this.tag, o.tag);
      const truce = truceMonthsLeft(W, this.tag, o.tag);
      const ae = Math.round(c.ae.get(o.tag) || 0);
      const flags = [
        c.allies.has(o.tag) ? '<em class="good">盟</em>' : '',
        c.rivals.has(o.tag) ? '<em class="bad">敌</em>' : '',
        truce > 0 ? `<em>休${truce}月</em>` : '',
        isAtWar(W, this.tag, o.tag) ? '<em class="bad">战</em>' : '',
        o.coalition && o.coalition.has(this.tag) ? '<em class="bad">包围网</em>' : '',
      ].join(' ');
      html += `<button type="button" class="prow ${o.tag === this.selCountry ? 'on' : ''}" data-act="selCountry" data-ctag="${o.tag}">
        <span class="dot" style="background:rgb(${o.color[0]},${o.color[1]},${o.color[2]})"></span>
        <span class="pname">${esc(o.name)}</span>
        <i>${flags}</i>
        <em class="${op >= 0 ? 'good' : 'bad'}">${op > 0 ? '+' : ''}${Math.round(op)}</em>
        ${ae >= 10 ? `<u class="bad" title="侵略扩张">AE${ae}</u>` : '<u></u>'}
      </button>`;
    }
    html += `</div>`;

    const o = this.selCountry ? W.countries.get(this.selCountry) : null;
    if (o) {
      const r = getRelation(W, this.tag, o.tag);
      const op = opinionOf(W, this.tag, o.tag);
      const truce = truceMonthsLeft(W, this.tag, o.tag);
      const atWar = isAtWar(W, this.tag, o.tag);
      const rivalChk = canRival(W, this.tag, o.tag);
      html += `<div class="sub">${esc(o.name)} · ${esc(o.tag)}</div>
        <div class="kv"><i>友好度</i><b class="${op >= 0 ? 'good' : 'bad'}">${op > 0 ? '+' : ''}${Math.round(op)} <em>/ ±200</em></b></div>
        <div class="i-desc">${opinionBreakdown(W, this.tag, o.tag)
          .map((x) => `<span class="${x.amount >= 0 ? 'good' : 'bad'}">${esc(x.label)} ${x.amount > 0 ? '+' : ''}${Math.round(x.amount)}${x.months ? `<i class="dim">（剩 ${x.months} 月）</i>` : ''}</span>`)
          .join('　')}</div>
        <div class="kv"><i>发展度 / 省份</i><b>${o.development} · ${o.provinceCount}</b></div>
        <div class="kv"><i>宗教 / 文化</i><b>${esc((RELIGIONS[o.religion] || {}).name || o.religion)} · ${esc(CULTURES[o.culture] || o.culture)}</b></div>
        <div class="kv"><i>军队</i><b>${o.armies.reduce((s, a) => s + a.size, 0)} 千</b></div>
        <div class="kv"><i>同盟 / 宿敌</i><b>${o.allies.size} · ${[...o.rivals].length}</b></div>
        <div class="kv"><i>对你的侵略扩张</i><b class="${(o.ae.get(this.tag) || 0) > 30 ? 'bad' : ''}">${Math.round(Math.max(0, c.ae.get(o.tag) || 0))}</b></div>
        <div class="kv"><i>关系标记</i><b>${r.alliance ? '同盟 ' : ''}${r.marriage ? '联姻 ' : ''}${r.guarantee ? '保障 ' : ''}${r.militaryAccess ? '通行权 ' : ''}${c.embargoes.has(o.tag) ? '禁运中 ' : ''}${c.subsidiesOut.some((s) => s.to === o.tag) ? '补贴中 ' : ''}${truce > 0 ? `休战${truce}月` : ''}${!r.alliance && !r.marriage && !r.guarantee && !r.militaryAccess && !truce && !c.embargoes.has(o.tag) && !c.subsidiesOut.some((s) => s.to === o.tag) ? '—' : ''}</b></div>
        <div class="acts">
          <button type="button" data-act="dipImprove" ${c.powers.dip < 20 ? 'disabled' : ''}>改善关系（20 DIP）</button>
          <button type="button" data-act="dipGift" ${c.treasury < 20 ? 'disabled' : ''}>赠送金币</button>
          <button type="button" data-act="dipMarry" ${r.marriage || op < 0 ? 'disabled' : ''}>王室联姻</button>
          ${r.alliance
            ? `<button type="button" data-act="dipBreakAlly">解除同盟</button>`
            : `<button type="button" data-act="dipAlly" ${op < 50 ? 'disabled' : ''}>提议结盟（需 ≥50）</button>`}
          ${c.rivals.has(o.tag)
            ? `<button type="button" data-act="dipUnrival">取消宿敌</button>`
            : `<button type="button" data-act="dipRival" title="${esc(rivalChk.ok ? '宿敌：体量相当、彼此为敌' : rivalChk.why)}" ${rivalChk.ok ? '' : 'disabled'}>设为宿敌</button>`}
          <button type="button" data-act="dipGuarantee" ${r.guarantee || op < 25 ? 'disabled' : ''}>保障独立</button>
          <button type="button" data-act="dipAccess" ${r.militaryAccess || op < 10 ? 'disabled' : ''}>请求通行权</button>
          ${c.embargoes.has(o.tag)
            ? `<button type="button" data-act="liftEmbargo">解除禁运</button>`
            : `<button type="button" data-act="embargo" ${c.allies.has(o.tag) ? 'disabled' : ''}>禁运</button>`}
          <button type="button" data-act="subsidy" ${!c.allies.has(o.tag) || c.subsidiesOut.some((s) => s.to === o.tag) ? 'disabled' : ''}>${c.subsidiesOut.some((s) => s.to === o.tag) ? '补贴中' : '补贴…'}</button>
          <button type="button" class="danger" data-act="declareWar" ${atWar || truce > 0 ? 'disabled' : ''}>${atWar ? '交战中' : truce > 0 ? `休战中（${truce} 月）` : '宣战…'}</button>
        </div>`;
    } else {
      html += this.hint('在上面点选一个国家，查看友好度构成（同盟、宿敌、边境摩擦、侵略扩张……）与可执行的外交动作。');
    }
    return html;
  }

  /* ─────────── 贸易 ─────────── */

  tabTrade() {
    const W = this.world, c = this.me;
    if (!W.trade) return `<h3 class="th">贸易</h3><div class="empty">贸易系统尚未初始化。</div>`;
    const T = W.trade;
    const mc = merchantCount(W, this.tag);
    const used = merchantsOf(W, this.tag);
    const income = T.income.get(this.tag) || 0;
    const home = c.homeNode ? (NODE_BY_ID.get(c.homeNode) || {}).name : '—';
    const map = new Map(used.map((m) => [m.node, m]));

    let html = `<h3 class="th">贸易</h3>
      <div class="kv"><i>商人</i><b>${used.length} / ${mc}</b></div>
      <div class="kv"><i>本土节点</i><b>${esc(home)}</b></div>
      <div class="kv"><i>贸易收入</i><b class="good">+${n1(income)}/月</b></div>
      <div class="acts"><button type="button" data-act="autoMerchants">自动派驻商人</button></div>
      <div class="hint">价值沿节点图向下游流动。派商人「转移」增值 10% 并导流；在首都节点「收取」不打折，别处收取打五折。停泊在海域的轻舰为船主在相邻节点撑起贸易力；禁运则排挤你节点的对手。</div>`;

    const mine = [], rest = [];
    for (const n of TRADE_NODES) {
      const st = T.nodes[n.id];
      if (!st) continue;
      (st.power[this.tag] > 0 || st.steer[this.tag] > 0 ? mine : rest).push({ n, st });
    }
    mine.sort((a, b) => ((b.st.power[this.tag] || 0) / Math.max(1, b.st.totalPower)) - ((a.st.power[this.tag] || 0) / Math.max(1, a.st.totalPower)));

    html += `<div class="sub">有贸易实力的节点</div>`;
    if (!mine.length) html += `<div class="empty">你在任何节点都没有贸易实力。</div>`;
    for (const { n, st } of mine) {
      const share = shareOf(W, this.tag, n.id);
      const got = st.collected[this.tag] || 0;
      const m = map.get(n.id);
      const isHome = c.homeNode === n.id;
      const isEnd = !n.to.length;
      const hop = isHome || isEnd ? null : (stepToward(n.id, c.homeNode) || n.to[0]);
      const dom = st.dominant ? W.countries.get(st.dominant) : null;
      const domTxt = dom ? `${esc(dom.name)}（${pct(st.dominantShare)}）` : '—';
      html += `<div class="card">
        <div class="c-top"><b>${esc(n.name)}${isHome ? ' <em class="gold">本土</em>' : ''}</b><span>份额 ${pct(share)}</span></div>
        <div class="c-line"><span>本地 ${n1(st.local)} · 流入 ${n1(st.incoming)}</span><span>总额 ${n1(st.value)}</span></div>
        <div class="c-line dim">主导者：${domTxt}${st.monopoly ? ' <em class="good">垄断 +25%</em>' : st.dominantShare >= 0.6 ? ' <em class="good">主导 +10%</em>' : ''}</div>
        <div class="c-line dim">下游：${n.to.length ? n.to.map((t) => esc((NODE_BY_ID.get(t) || {}).name || t)).join('、') : '终端节点'} · 收取 ${n1(got)}/月</div>
        <div class="c-line dim">${m ? (m.action === 'steer' ? `商人：转移 → ${esc((NODE_BY_ID.get(m.to) || {}).name || m.to)}` : '商人：就地收取') : '未派驻商人'}</div>
        <div class="c-acts">
          ${hop ? `<button type="button" data-act="merchantSteer" data-node="${n.id}" data-to="${hop}" ${m ? '' : used.length >= mc ? 'disabled' : ''}>转移 → ${esc((NODE_BY_ID.get(hop) || {}).name || hop)}</button>` : ''}
          <button type="button" data-act="merchantCollect" data-node="${n.id}" ${m ? '' : used.length >= mc ? 'disabled' : ''}>收取</button>
          ${m ? `<button type="button" data-act="merchantClear" data-node="${n.id}">撤回</button>` : ''}
        </div>
      </div>`;
    }

    html += `<div class="sub">其他节点</div><div class="plist">`;
    for (const { n, st } of rest) {
      const dom = st.dominant ? W.countries.get(st.dominant) : null;
      html += `<div class="prow static"><span>${esc(n.name)}<i class="dim">　主导 ${dom ? esc(dom.name) + ' ' + pct(st.dominantShare) : '—'}</i></span><em>${n1(st.value)}</em><i class="dim">${n.to.length ? '→ ' + esc((NODE_BY_ID.get(n.to[0]) || {}).name || n.to[0]) : '终端'}</i></div>`;
    }
    html += `</div>`;

    if (c.embargoes.size) {
      html += `<div class="sub">禁运（${c.embargoes.size}）</div>`;
      for (const t of c.embargoes) {
        const o = W.countries.get(t);
        html += `<div class="prow static"><span>${esc(o ? o.name : t)}</span><em class="dim">其贸易力 −33%</em>
          <i><button type="button" data-act="liftEmbargo" data-ctag="${t}">解除</button></i></div>`;
      }
    }
    return html;
  }

  /* ─────────── 经济 ─────────── */

  tabEconomy() {
    const W = this.world, c = this.me;
    const L = c.ledger || { tax: 0, production: 0, trade: 0, army: 0, navy: 0, fort: 0, interest: 0, income: 0, expense: 0 };
    const bal = L.income - L.expense;
    let html = `<h3 class="th">财政</h3>
      <div class="kv"><i>国库</i><b>${Math.floor(c.treasury)}</b></div>
      <div class="kv"><i>月度结余</i><b class="${bal >= 0 ? 'good' : 'bad'}">${sg(bal)}</b></div>
      <div class="kv"><i>通胀</i><b class="${c.inflation > 5 ? 'bad' : ''}">${n1(c.inflation)}%</b></div>
      <div class="kv"><i>贷款</i><b class="${c.loans.length ? 'bad' : ''}">${c.loans.length} 笔 · 利息 −${n1(L.interest)}/月</b></div>`;

    html += `<div class="sub">收入</div>
      <div class="kv"><i>税收</i><b class="good">+${n1(L.tax)}</b></div>
      <div class="kv"><i>生产</i><b class="good">+${n1(L.production)}</b></div>
      <div class="kv"><i>贸易</i><b class="good">+${n1(L.trade)}</b></div>
      <div class="kv"><i>补贴收入</i><b class="good">+${n1(L.subsidiesIn)}</b></div>
      <div class="kv"><i>合计</i><b class="good">+${n1(L.income)}</b></div>
      <div class="sub">支出</div>
      <div class="kv"><i>陆军维护</i><b class="bad">−${n1(L.army)}</b></div>
      <div class="kv"><i>海军维护</i><b class="bad">−${n1(L.navy)}</b></div>
      <div class="kv"><i>要塞维护</i><b class="bad">−${n1(L.fort)}</b></div>
      <div class="kv"><i>利息</i><b class="bad">−${n1(L.interest)}</b></div>
      <div class="kv"><i>对外补贴</i><b class="bad">−${n1(L.subsidiesOut)}</b></div>
      <div class="kv"><i>合计</i><b class="bad">−${n1(L.expense)}</b></div>`;

    const wtCd = warTaxCooldownMonths(W, this.tag);
    const wtAmt = Math.max(10, Math.round((c.stats.income || 5) * 4));
    const atWarNow = W.wars.some((w) => w.active && (w.attackers.has(this.tag) || w.defenders.has(this.tag)));
    html += `<div class="sub">国库操作</div><div class="acts">
      <button type="button" data-act="takeLoan">贷款 +${loanSize(c)} 金</button>
      <button type="button" data-act="repayLoan" ${!c.loans.length || c.treasury < Math.round((c.loans[0]?.amount || 0) * 1.1) ? 'disabled' : ''}>还贷 ${c.loans.length ? Math.round(c.loans[0].amount * 1.1) : 0} 金</button>
      <button type="button" data-act="mint">铸币（通胀 +0.35）</button>
      <button type="button" data-act="warTax" ${wtCd > 0 || !atWarNow ? 'disabled' : ''}>${!atWarNow ? '战争税（战时可用）' : wtCd > 0 ? `战争税冷却 ${wtCd} 月` : `征收战争税（约 +${wtAmt} 金）`}</button>
      <button type="button" data-act="foundBank" ${c.nationalBank || c.treasury < BANK_GOLD || c.powers.adm < BANK_ADM ? 'disabled' : ''}>${c.nationalBank ? '国家银行已设立' : `设立国家银行（${BANK_GOLD} 金 + ${BANK_ADM} ADM）`}</button>
      <button type="button" data-act="raiseStab" ${c.stability >= 3 || c.powers.adm < stabilityCost(W, this.tag) ? 'disabled' : ''}>提升稳定度（${stabilityCost(W, this.tag)} ADM）</button>
      <button type="button" data-act="reduceWE" ${c.warExhaustion <= 0.05 || c.powers.dip < Math.round(30 + c.development * 0.25) ? 'disabled' : ''}>降低厌战（${Math.round(30 + c.development * 0.25)} DIP）</button>
    </div>`;

    html += `<div class="sub">科技</div>`;
    for (const br of ['adm', 'dip', 'mil']) {
      const cost = techCost(W, this.tag, br);
      const can = c.powers[br] >= cost;
      html += `<div class="devrow">
        <span class="pw ${br}">${BRANCH_CN[br]}</span><b>${c.tech[br]} → ${c.tech[br] + 1}</b>
        <button type="button" data-act="takeTech" data-branch="${br}" ${can ? '' : 'disabled'}>${cost} 点（现有 ${c.powers[br]}）</button>
      </div>`;
    }
    html += this.hint('科技领先时代会加价。三条线分别带来税收/贸易/纪律方面的实打实收益。');
    return html;
  }

  /* ─────────── 阶级 ─────────── */

  tabEstates() {
    const c = this.me;
    if (!c.estates) return `<h3 class="th">阶级</h3><div class="empty">阶级系统未初始化。</div>`;
    const cl = Math.round(c.crownland);
    let html = `<h3 class="th">阶级</h3>
      <div class="kv"><i>王权领地</i><b class="${cl < 30 ? 'bad' : cl > 55 ? 'good' : ''}">${cl}%</b></div>
      <div class="bar"><i style="width:${Math.max(0, Math.min(100, cl))}%"></i></div>
      <div class="hint">影响力 ≥ 40 的阶级会持续蚕食王室领地；领地低于 25% 动荡加剧、国力萎缩。忠诚低于 30 且影响力过半的阶级随时可能举兵逼宫。</div>
      <div class="acts">
        <button type="button" data-act="estateSeize" ${cl >= 65 ? 'disabled' : ''}>夺取领地（+5%，全体忠诚 −10）</button>
        <button type="button" data-act="estateDiet">召开议会</button>
        <button type="button" data-act="estateSell" ${cl < 30 ? 'disabled' : ''}>出售头衔（−5% 换现金）</button>
      </div>`;

    for (const id in ESTATES) {
      const E = ESTATES[id], e = c.estates[id];
      const privs = PRIVILEGES.filter((p) => p.estate === id);
      const danger = e.loyalty < 30 && e.influence > 50;
      html += `<div class="card ${danger ? 'war' : ''}">
        <div class="c-top"><b>${esc(E.name)}</b><span>${danger ? '<em class="bad">濒临叛乱</em>' : ''}</span></div>
        <div class="c-line dim">${esc(E.desc)}</div>
        <div class="c-line"><span>影响力 <b>${Math.round(e.influence)}%</b></span><span class="${e.loyalty < 30 ? 'bad' : ''}">忠诚 <b>${Math.round(e.loyalty)}%</b></span></div>
        <div class="bar"><i class="${e.loyalty < 30 ? 'bad' : ''}" style="width:${Math.round(e.loyalty)}%"></i></div>`;
      for (const p of privs) {
        const has = c.privileges.has(p.id);
        html += `<div class="brow ${has ? 'has' : ''}">
          <span class="bname" title="${esc(ideaModText(p.mods))}">${esc(p.name)}</span>
          <span class="bdesc">${esc(p.desc)}</span>
          ${has
            ? `<button type="button" data-act="estateUnpriv" data-pid="${p.id}">收回</button>`
            : `<button type="button" data-act="estatePriv" data-pid="${p.id}">授予</button>`}
        </div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  /* ─────────── 理念 ─────────── */

  tabIdeas() {
    const W = this.world, c = this.me;
    const max = maxGroups(c);
    const states = groupStates(c);
    let html = `<h3 class="th">理念</h3>
      <div class="kv"><i>已开启</i><b>${groupCount(c)} / ${max} 组</b></div>
      <div class="kv"><i>行政科技</i><b>${c.tech.adm}（每 3 级多开一组）</b></div>
      <div class="hint">每组 7 条理念，全部点完还有一条完成奖励。开组数量受行政科技限制，和冲科技是同一批点数的竞争关系。</div>`;

    /* 政策：理念组两两组合的第二层收益 */
    const slots = policySlots(c);
    const onCount = c.policies ? c.policies.size : 0;
    html += `<div class="sub">政策（${onCount} / ${slots} 槽）</div>`;
    for (const pol of POLICIES) {
      const avail = policyAvailable(c, pol);
      const on = !!(c.policies && c.policies.has(pol.id));
      const full = !on && onCount >= slots;
      const reqNames = pol.requires.map((gid) => (GROUP_BY_ID.get(gid) || {}).name || gid).join(' + ');
      html += `<div class="idea ${on ? 'done' : ''}">
        <div class="i-top"><b>${esc(pol.name)}</b><em class="${on ? 'good' : avail ? '' : 'dim'}">${on ? '生效中' : avail ? '可启用' : '未解锁'}</em></div>
        <div class="i-desc">需要：${esc(reqNames)}</div>
        <div class="i-next">${esc(ideaModText(pol.mods))} —— ${esc(pol.desc)}</div>
        <button type="button" data-act="policyToggle" data-pid="${pol.id}" ${avail && (on || !full) ? '' : 'disabled'}>${on ? '停用' : '启用'}</button>
        ${avail || on ? '' : `<div class="i-why">开启上述两个理念组后解锁</div>`}
        ${full ? `<div class="i-why">政策槽已满</div>` : ''}
      </div>`;
    }

    const branchOrder = ['adm', 'dip', 'mil'];
    for (const br of branchOrder) {
      html += `<div class="sub">${BRANCH_CN[br]}理念</div>`;
      for (const s of states.filter((x) => x.group.branch === br)) {
        const g = s.group;
        const cost = ideaCost(c, g.id, W.modsFor(this.tag));
        const chk = canTakeIdea(W, this.tag, g.id);
        const next = s.done < s.total ? g.ideas[s.done] : null;
        const dots = Array.from({ length: s.total }, (_, i) => `<i class="${i < s.done ? 'on' : ''}"></i>`).join('');
        html += `<div class="idea ${s.complete ? 'done' : ''}">
          <div class="i-top">
            <b>${esc(g.name)}</b>
            <span class="dots">${dots}</span>
            ${s.done === 0 ? `<em class="dim">开组</em>` : `<em>${s.done}/${s.total}</em>`}
          </div>
          <div class="i-desc">${esc(g.desc)}</div>
          <div class="i-next">${s.complete
            ? `完成奖励：${esc(ideaModText(g.bonus.mods))}`
            : `下一条：${esc(next.name)} — ${esc(ideaModText(next.mods))}`}</div>
          <button type="button" data-act="takeIdea" data-gid="${g.id}" ${chk.ok ? '' : 'disabled'}>${s.complete ? '已完成' : `${cost} ${br.toUpperCase()}`}</button>
          ${chk.ok ? '' : `<div class="i-why">${esc(chk.why)}</div>`}
        </div>`;
      }
    }
    return html;
  }

  /* ─────────── 模态框 ─────────── */

  openModal({ title, body, submit, onSubmit, wide }) {
    this.wasPaused = this.world.paused;
    this.world.paused = true;
    this.modal = { onSubmit };
    this.modalEl.hidden = false;
    this.modalBodyEl.innerHTML = `
      <div class="m-head"><h3>${esc(title)}</h3><button type="button" class="m-x" data-act="modalClose">×</button></div>
      <div class="m-body">${body}</div>
      ${submit ? `<div class="m-foot"><button type="button" data-act="modalClose">取消</button><button type="button" class="primary" data-act="modalSubmit">${esc(submit)}</button></div>` : ''}
    `;
    if (wide) this.modalBodyEl.classList.add('wide'); else this.modalBodyEl.classList.remove('wide');
  }

  closeModal() {
    if (!this.modal) return;
    this.modal = null;
    this.modalEl.hidden = true;
    this.modalBodyEl.innerHTML = '';
    if (!this.wasPaused) this.world.paused = false;
    this.markDirty();
  }

  fieldVal(key) {
    const el = this.modalBodyEl.querySelector(`[data-key="${key}"]`);
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number' || el.type === 'range') return Number(el.value);
    return el.value;
  }

  submitModal() {
    if (!this.modal || !this.modal.onSubmit) { this.closeModal(); return; }
    const fn = this.modal.onSubmit;
    let keep = false;
    try {
      keep = fn() === true;
    } catch (err) {
      console.error(err);
      this.log('操作失败：' + err.message);
    }
    if (!keep) this.closeModal();
    this.markDirty();
    if (this.renderer) this.renderer.invalidate();
  }

  /* ── 招募军队 ── */

  openRecruit() {
    const c = this.me;
    const provs = [...c.provinces].map((id) => this.world.provinces.get(id)).filter((p) => p && !p.sea);
    if (!provs.length) { this.log('没有可驻军的城市'); return; }
    const maxSize = Math.min(Math.floor(c.manpower), Math.floor(c.treasury / 2), Math.max(1, c.forceLimit * 2));
    const body = `
      <div class="f"><label>驻扎省份</label><select data-key="pid">
        ${provs.map((p) => `<option value="${p.id}">${esc(p.name)}（发展度 ${p.baseTax + p.baseProduction + p.baseManpower}）</option>`).join('')}
      </select></div>
      <div class="f"><label>兵力（千人）</label><input type="number" data-key="size" value="${Math.max(1, Math.min(6, maxSize))}" min="1" max="${Math.max(1, maxSize)}" step="1" /></div>
      <div class="f"><label>骑兵占比</label><input type="number" data-key="cav" value="25" min="0" max="${Math.round(CAV_RATIO_LIMIT * 100)}" step="5" /><em>%</em></div>
      <div class="f"><label>炮兵占比</label><input type="number" data-key="art" value="5" min="0" max="30" step="5" /><em>%</em></div>
      <div class="m-note">花费：2 金 / 千人，另需等量人力。人力 ${Math.floor(c.manpower)}，金币 ${Math.floor(c.treasury)}。骑兵超过 ${Math.round(CAV_RATIO_LIMIT * 100)}% 会吃阵型惩罚。</div>`;
    this.openModal({
      title: '招募军队', body, submit: '招募',
      onSubmit: () => {
        const pid = Number(this.fieldVal('pid'));
        const size = Math.max(1, Math.floor(this.fieldVal('size') || 1));
        const cav = (Number(this.fieldVal('cav')) || 0) / 100;
        const art = (Number(this.fieldVal('art')) || 0) / 100;
        const a = createArmy(this.world, this.tag, pid, size, { cavRatio: cav, artRatio: art });
        this.log(a ? `在 ${this.world.provinces.get(pid).name} 招募了 ${a.size} 千人` : '招募失败：人力或金币不足');
      },
    });
  }

  /* ── 合并 ── */

  openMerge(id) {
    const a = this.findArmy(id);
    if (!a) return;
    const c = this.me;
    const cand = c.armies.filter((b) => b.id !== a.id && b.prov === a.prov && !b.movement && !b.embarked && !a.embarked);
    if (!cand.length) { this.log('同省没有其他可合并的部队'); return; }
    this.openModal({
      title: '合并部队',
      body: `<div class="m-note">把选中的部队并入 ${a.size} 千人的主力。</div>` + cand.map((b) => `
        <label class="chk"><input type="checkbox" data-key="b${b.id}" /> ${b.size} 千人（步 ${b.comp.inf}·骑 ${b.comp.cav}·炮 ${b.comp.art}）</label>`).join(''),
      submit: '合并',
      onSubmit: () => {
        let n = 0;
        for (const b of cand) {
          if (this.fieldVal(`b${b.id}`)) { if (mergeArmies(this.world, a, b)) n++; }
        }
        this.log(n ? `合并了 ${n} 支部队，现有 ${a.size} 千人` : '没有选择任何部队');
      },
    });
  }

  /* ── 任命将领 ── */

  openGenerals(id) {
    const a = this.findArmy(id);
    if (!a) return;
    const c = this.me;
    this.openModal({
      title: '指派将领',
      body: `<div class="m-note">一个将领只能统领一支军队。点数：火 / 冲 / 机动 / 围城。</div>` +
        `<label class="chk"><input type="radio" name="gen" data-key="gen" value="-1" ${a.general ? '' : 'checked'} /> 不指派</label>` +
        c.generals.map((g) => `
          <label class="chk"><input type="radio" name="gen" data-key="gen" value="${g.id}" ${a.general === g.id ? 'checked' : ''} />
            ${esc(g.name)}（${g.fire}/${g.shock}/${g.maneuver}/${g.siege}）</label>`).join(''),
      submit: '确定',
      onSubmit: () => {
        const gid = Number(this.fieldVal('gen'));
        if (gid < 0) { a.general = null; this.log('已撤下将领'); return; }
        this.log(assignGeneral(this.world, a, gid) ? '将领已就位' : '指派失败');
      },
    });
  }

  /* ── 建造舰队 ── */

  openFleetBuild() {
    const W = this.world, c = this.me;
    const seas = [];
    const seen = new Set();
    for (const pid of c.provinces) {
      const p = W.provinces.get(pid);
      if (!p || p.sea || !p.coastal) continue;
      for (const s of p.adj) {
        if (seen.has(s)) continue;
        const sp = W.provinces.get(s);
        if (!sp || !sp.sea) continue;
        seen.add(s);
        seas.push({ id: s, name: sp.name, port: p.name });
      }
    }
    if (!seas.length) { this.log('没有沿海省份，无法编组舰队'); return; }
    const unitRow = Object.entries(SHIP_TYPES)
      .map(([k, v]) => `<span>${v.name}：${v.cost} 金 / ${v.sailor * 10} 水手</span>`).join('　');
    const body = `
      <div class="f"><label>编组海域</label><select data-key="sea">
        ${seas.map((s) => `<option value="${s.id}">${esc(s.name)}（邻 ${esc(s.port)}）</option>`).join('')}
      </select></div>
      <div class="f"><label>重舰</label><input type="number" data-key="heavy" value="1" min="0" max="40" /></div>
      <div class="f"><label>轻舰</label><input type="number" data-key="light" value="3" min="0" max="60" /></div>
      <div class="f"><label>桨帆船</label><input type="number" data-key="galley" value="2" min="0" max="60" /></div>
      <div class="m-note">${unitRow}<br/>金币 ${Math.floor(c.treasury)} · 水手 ${Math.floor(c.sailors)} · 海军上限 ${c.navalLimit}</div>
      <div class="m-note" id="fleetCost" data-act="fleetCalc"></div>`;
    this.openModal({
      title: '建造舰队', body, submit: '编组',
      onSubmit: () => {
        const counts = {
          heavy: Math.max(0, Math.floor(this.fieldVal('heavy') || 0)),
          light: Math.max(0, Math.floor(this.fieldVal('light') || 0)),
          galley: Math.max(0, Math.floor(this.fieldVal('galley') || 0)),
        };
        const f = createFleet(W, this.tag, Number(this.fieldVal('sea')), counts);
        this.log(f ? `新舰队成军：${fleetSize(f)} 艘（战力 ${n1(fleetPower(f))}）` : '编组失败：金币或水手不足，或所在地不靠己方港口');
      },
    });
    this.updateFleetCost();
  }

  updateFleetCost() {
    const el = this.modalBodyEl.querySelector('#fleetCost');
    if (!el) return;
    const counts = {
      heavy: Math.max(0, Math.floor(this.fieldVal('heavy') || 0)),
      light: Math.max(0, Math.floor(this.fieldVal('light') || 0)),
      galley: Math.max(0, Math.floor(this.fieldVal('galley') || 0)),
    };
    const g = buildCost(counts), s = sailorCost(counts);
    const okAll = g <= this.me.treasury && s <= this.me.sailors;
    el.innerHTML = `合计 <b class="${okAll ? 'good' : 'bad'}">${g} 金 · ${s} 水手</b>　维护 −${n1(counts.heavy * SHIP_TYPES.heavy.maint + counts.light * SHIP_TYPES.light.maint + counts.galley * SHIP_TYPES.galley.maint)}/月`;
  }

  /* ── 登陆点 ── */

  openLanding(id) {
    const a = this.findArmy(id);
    if (!a) return;
    const opts = landingOptions(this.world, a).map((pid) => this.world.provinces.get(pid)).filter(Boolean);
    if (!opts.length) { this.log('附近没有可登陆的陆地'); return; }
    this.openModal({
      title: '选择登陆点',
      body: `<div class="m-note">只能在与舰队所在海域相邻的省份上岸，中立国不会放行。</div>` +
        opts.map((p) => `<label class="chk"><input type="radio" name="land" data-key="land" value="${p.id}" />
          ${esc(p.name)}（${p.owner ? esc(this.world.countries.get(p.owner).name) : '无主'}${p.fort ? ` · 要塞 ${p.fort}` : ''}）</label>`).join(''),
      submit: '登陆',
      onSubmit: () => {
        const dest = Number(this.fieldVal('land'));
        if (!dest) return;
        this.log(disembark(this.world, a, dest) ? `部队在 ${this.world.provinces.get(dest).name} 登陆` : '登陆失败');
      },
    });
  }

  /* ── 宣战 ── */

  openWar(defTag) {
    const W = this.world;
    if (!defTag) return;
    const cbs = casusBelli(W, this.tag, defTag);
    const def = W.countries.get(defTag);
    this.openModal({
      title: `向 ${def.name} 宣战`,
      body: `<div class="m-note">对方盟友与保障者可能一并参战，侵略扩张过高还会引来包围网。</div>` +
        cbs.map((cb) => `<label class="chk ${cb.id === 'nocb' ? 'danger' : ''}">
          <input type="radio" name="cb" data-key="cb" value="${cb.id}" ${cb.id === cbs[0].id ? 'checked' : ''} />
          <b>${esc(cb.name)}</b>　AE ×${cb.ae}${cb.stab ? ` · 稳定度 ${cb.stab}` : ''}<br/><em>${esc(cb.desc)}</em>
        </label>`).join(''),
      submit: '宣战',
      onSubmit: () => {
        const cb = this.fieldVal('cb');
        const war = declareWar(W, this.tag, defTag, cb);
        this.log(war ? `战争爆发：${this.me.name} 对 ${def.name}` : '无法宣战（已在交战或休战未结束）');
      },
    });
  }

  /* ── 和约谈判 ── */

  openPeace(warId) {
    const W = this.world;
    const war = W.wars.find((w) => w.id === warId);
    if (!war) return;
    const mySide = war.attackers.has(this.tag) ? 'attacker' : 'defender';
    const otherSide = mySide === 'attacker' ? 'defender' : 'attacker';
    const ws = warScore(W, war);
    const available = mySide === 'attacker' ? ws : -ws;
    const enemy = W.countries.get(mySide === 'attacker' ? war.defender : war.attacker);

    if (available < 10 || mySide !== (ws > 0 ? 'attacker' : 'defender')) {
      this.openModal({
        title: `与 ${enemy.name} 的谈判`,
        body: `<div class="m-note">战争分数 ${Math.round(available)}，不足以提出任何要求（需 ≥ 10）。<br/>
          你可以选择承认现状（白色和约，休战 5 年），或接受对方的条件结束战争。</div>`,
        submit: '结束战争',
        onSubmit: () => {
          const r = peaceDeal(W, war, otherSide, {});
          if (!r.ok) { whitePeace(W, war); this.log('缔结白色和约'); }
          else this.log('接受对方条件，战争结束');
        },
      });
      return;
    }

    const opts = peaceOptions(W, war);
    this.peaceState = { war, mySide, available, opts };
    const body = `
      <div class="m-note">战争分数：<b class="good">${Math.round(available)}</b>　当前要求：<b id="pcCost">0</b> / ${Math.round(available)}</div>
      <div class="sub">割让省份</div>
      ${opts.provinces.length ? opts.provinces.map((p) => `<label class="chk">
        <input type="checkbox" data-key="p${p.pid}" data-act="peaceCalc" />
        ${esc(p.name)}${p.claimed ? ' <em class="good">有宣称</em>' : ''}　<em>发展度 ${p.dev} · 代价 ${Math.round(p.cost)}</em>
      </label>`).join('') : '<div class="empty">没有可要求的省份（需实际占领，或是战争目标）。</div>'}
      ${opts.cores.length ? `<div class="sub">收复核心</div>` + opts.cores.map((p) => `<label class="chk">
        <input type="checkbox" data-key="c${p.pid}" data-act="peaceCalc" />
        ${esc(p.name)}　<em>发展度 ${p.dev} · 代价 ${Math.round(p.cost)}</em>
      </label>`).join('') : ''}
      <div class="sub">其他条款</div>
      <div class="f"><label>赔款（金币）</label><input type="number" data-key="ducats" data-act="peaceCalc" value="0" min="0" max="${Math.max(0, Math.floor(enemy.treasury))}" step="10" /><em>最多 ${Math.max(0, Math.floor(enemy.treasury))}</em></div>
      <label class="chk"><input type="checkbox" data-key="warRep" data-act="peaceCalc" /> 战争赔款（对方年收入的 25%）<em>代价 15</em></label>
      <label class="chk"><input type="checkbox" data-key="humiliate" data-act="peaceCalc" /> 羞辱（我方威望 +15，对方 −25）<em>代价 20</em></label>
      ${opts.canAnnul ? `<label class="chk"><input type="checkbox" data-key="annul" data-act="peaceCalc" /> 废除条约（切断对方所有同盟）<em>代价 10</em></label>` : ''}
      <div class="m-note">和约总代价越高，休战期越长（最多 15 年），激起的侵略扩张也越多。</div>`;

    this.openModal({
      title: `与 ${enemy.name} 的和约`, body, submit: '签订和约', wide: true,
      onSubmit: () => {
        const d = this.collectPeaceDemands();
        const r = peaceDeal(W, war, mySide, d);
        if (!r.ok) { this.log('和约被拒：' + r.why); return true; }
        this.log(`和约签订${r.taken && r.taken.length ? '：获得 ' + r.taken.join('、') : ''}`);
        this.peaceState = null;
      },
    });
  }

  collectPeaceDemands() {
    const st = this.peaceState;
    if (!st) return {};
    const d = { provinces: [], revokeCores: [], ducats: Math.max(0, Math.floor(this.fieldVal('ducats') || 0)) };
    for (const p of st.opts.provinces) if (this.fieldVal(`p${p.pid}`)) d.provinces.push(p.pid);
    for (const p of st.opts.cores) if (this.fieldVal(`c${p.pid}`)) d.revokeCores.push(p.pid);
    d.warReparations = !!this.fieldVal('warRep');
    d.humiliate = !!this.fieldVal('humiliate');
    d.annulTreaties = !!this.fieldVal('annul');
    return d;
  }

  updatePeaceCost() {
    const st = this.peaceState;
    if (!st) return;
    const d = this.collectPeaceDemands();
    const cost = peaceCost(this.world, st.war, st.mySide, d);
    const el = this.modalBodyEl.querySelector('#pcCost');
    if (el) {
      el.textContent = String(Math.round(cost));
      el.className = cost > st.available ? 'bad' : 'good';
    }
  }

  /* ── 补贴 ── */

  openSubsidy() {
    const c = this.me;
    const o = this.world.countries.get(this.selCountry);
    if (!o) return;
    if (!c.allies.has(o.tag)) { this.log('只能补贴盟友'); return; }
    if (c.subsidiesOut.some((s) => s.to === o.tag)) { this.log('已在补贴该国'); return; }
    this.openModal({
      title: `补贴 ${o.name}`,
      body: `<div class="m-note">每月支付固定金额直到期满；付不起会自动断供。对方好感随每月到账缓慢上升。</div>
        <div class="f"><label>每月金额</label><input type="number" data-key="amt" value="4" min="1" max="20" step="1" /><em>金币 / 月</em></div>
        <div class="f"><label>持续期</label><input type="number" data-key="months" value="24" min="6" max="120" step="6" /><em>月</em></div>
        <div class="m-note">国库 ${Math.floor(c.treasury)} 金 · 月结余 ${sg((c.ledger?.income || 0) - (c.ledger?.expense || 0))}</div>`,
      submit: '开始补贴',
      onSubmit: () => {
        const amt = Math.max(1, Math.floor(this.fieldVal('amt') || 1));
        const months = Math.max(6, Math.floor(this.fieldVal('months') || 24));
        c.subsidiesOut.push({ to: o.tag, amount: amt, months });
        this.log(`开始每月补贴 ${o.name} ${amt} 金币，为期 ${months} 个月`);
      },
    });
  }

  /* ── 事件弹窗 ── */

  showEvent(ev, onDone) {
    this.openModal({
      title: ev.title,
      body: `<p>${esc(ev.text)}</p>`,
      submit: null,
      onSubmit: null,
    });
    const foot = document.createElement('div');
    foot.className = 'ev-options';
    for (const opt of ev.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt.text;
      b.addEventListener('click', () => {
        try { opt.effects(); } catch (err) { console.error(err); }
        this.closeModal();
        if (onDone) onDone();
      });
      foot.appendChild(b);
    }
    this.modalBodyEl.querySelector('.m-body').appendChild(foot);
    this.modal.onSubmit = null;
  }
}
