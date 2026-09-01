// 开局选国界面。
// 世界已经生成好了，这里只是把 82 个国家摆出来让玩家挑一个，
// 右侧小地图实时高亮选中的国家。

import { RELIGIONS, CULTURES, TECH_GROUPS, GOVS } from './countries.js';
import { WORLD_W, WORLD_H } from './geo.js';
import { paintBase, fitView, pathOfIds } from './paint.js';

/* 按首都经纬度粗分地区，只用于筛选，不需要精确 */
function regionOf(lon, lat) {
  if (lat < 33) return '北非';
  if (lon < -8) return '大西洋';
  if (lon < 2.5 && lat >= 49.5) return '不列颠';
  if (lon < 3.5 && lat < 44.5) return '伊比利亚';
  if (lon < 8.5 && lat < 51.5) return '法兰西';
  if (lon < 13 && lat < 54) return '低地';
  if (lon < 17 && lat < 47.5) return '德意志';
  if (lon < 20.5 && lat < 46.5) return '意大利';
  if (lon < 25 && lat < 55) return '中欧';
  if (lon < 31 && lat < 48.5) return '巴尔干';
  if (lon < 41 && lat < 52) return '东欧';
  if (lon < 41) return '罗斯';
  if (lat < 42) return '中东';
  return '东方';
}

const REL = (k) => (RELIGIONS[k] ? RELIGIONS[k].name : k || '—');
const CUL = (k) => CULTURES[k] || k || '—';
const TEC = (k) => (TECH_GROUPS[k] ? TECH_GROUPS[k] : k || '—');
const GOV = (k) => (GOVS[k] ? GOVS[k] : k || '—');

/** 难度按发展度在所有国家里的分位，自适应，不写死阈值 */
function buildDifficulty(world) {
  const devs = [...world.countries.values()].map((c) => c.development || 0).sort((a, b) => a - b);
  const at = (q) => devs[Math.min(devs.length - 1, Math.floor(devs.length * q))] || 0;
  const cuts = [at(0.18), at(0.38), at(0.62), at(0.84)];
  const tiers = [
    { stars: 1, label: '轻松' },
    { stars: 2, label: '适中' },
    { stars: 3, label: '挑战' },
    { stars: 4, label: '艰难' },
    { stars: 5, label: '地狱' },
  ];
  return (dev) => {
    let i = 0;
    while (i < cuts.length && dev > cuts[i]) i++;
    return tiers[i];
  };
}

function starStr(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

export function runSetup(world, paths) {
  const root = document.getElementById('setup');
  const listEl = document.getElementById('csList');
  const detailEl = document.getElementById('csDetail');
  const searchEl = document.getElementById('csSearch');
  const sortEl = document.getElementById('csSort');
  const filterEl = document.getElementById('csFilter');
  const startEl = document.getElementById('csStart');
  const randEl = document.getElementById('csRandom');
  const canvas = document.getElementById('csMap');
  const countEl = document.getElementById('csCount');

  const diffOf = buildDifficulty(world);
  const rows = [];
  for (const c of world.countries.values()) {
    if (c.provinces.size === 0) continue;         // 开局没地的国家不给选
    const cap = c.capital != null ? world.provinces.get(c.capital) : null;
    const d = diffOf(c.development || 0);
    rows.push({
      c,
      tag: c.tag,
      dev: c.development || 0,
      provs: c.provinces.size,
      region: cap ? regionOf(cap.lon, cap.lat) : '未知',
      diff: d,
      hay: `${c.name} ${c.en || ''} ${c.adj || ''} ${c.tag}`.toLowerCase(),
    });
  }

  /* 地区筛选下拉：按出现次数排序，保证筛选项都是有效的 */
  const regionCount = new Map();
  for (const r of rows) regionCount.set(r.region, (regionCount.get(r.region) || 0) + 1);
  const regions = [...regionCount.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  filterEl.innerHTML = '';
  const optAll = (value, text) => {
    const o = document.createElement('option');
    o.value = value; o.textContent = text;
    return o;
  };
  filterEl.appendChild(optAll('all', `全部地区（${rows.length}）`));
  for (const rg of regions) {
    filterEl.appendChild(optAll('rg:' + rg, `${rg}（${regionCount.get(rg)}）`));
  }
  filterEl.appendChild(optAll('rel:catholic', '天主教国家'));
  filterEl.appendChild(optAll('rel:orthodox', '东正教国家'));
  filterEl.appendChild(optAll('rel:sunni', '伊斯兰国家'));
  filterEl.appendChild(optAll('gov:republic', '共和国'));
  filterEl.appendChild(optAll('gov:theocracy', '神权国'));
  filterEl.appendChild(optAll('hre', '神圣罗马帝国成员'));

  let selected = null;
  let hoverTag = null;

  function visibleRows() {
    const q = searchEl.value.trim().toLowerCase();
    const f = filterEl.value;
    const out = rows.filter((r) => {
      if (q && !r.hay.includes(q)) return false;
      if (f === 'all') return true;
      if (f === 'hre') return r.c.hre;
      const [k, v] = f.split(':');
      if (k === 'rg') return r.region === v;
      if (k === 'rel') return r.c.religion === v;
      if (k === 'gov') return r.c.gov === v;
      return true;
    });
    const mode = sortEl.value;
    if (mode === 'dev') out.sort((a, b) => b.dev - a.dev);
    else if (mode === 'prov') out.sort((a, b) => b.provs - a.provs);
    else if (mode === 'name') out.sort((a, b) => a.c.name.localeCompare(b.c.name, 'zh'));
    else if (mode === 'easy') out.sort((a, b) => (a.diff.stars - b.diff.stars) || (b.dev - a.dev));
    return out;
  }

  let cardOf = new Map();

  function renderList() {
    const list = visibleRows();
    countEl.textContent = `${list.length} / ${rows.length}`;
    const frag = document.createDocumentFragment();
    cardOf = new Map();
    for (const r of list) {
      const el = document.createElement('button');
      el.className = 'cs-card' + (selected === r.tag ? ' on' : '');
      el.type = 'button';
      const [cr, cg, cb] = r.c.color;
      el.innerHTML =
        `<span class="cs-flag" style="background:rgb(${cr},${cg},${cb})"></span>` +
        `<span class="cs-main"><b>${r.c.name}</b>` +
        `<i>${r.tag} · ${r.region} · ${REL(r.c.religion)}</i></span>` +
        `<span class="cs-num"><b>${r.dev}</b><i>${r.provs} 省</i></span>` +
        `<span class="cs-diff d${r.diff.stars}">${starStr(r.diff.stars)}<i>${r.diff.label}</i></span>`;
      el.addEventListener('click', () => select(r.tag));
      el.addEventListener('dblclick', () => { select(r.tag); finish(); });
      el.addEventListener('mouseenter', () => {
        if (hoverTag === r.tag) return;
        hoverTag = r.tag;
        paintMini(hoverTag, true);
      });
      el.addEventListener('mouseleave', () => {
        if (hoverTag !== r.tag) return;
        hoverTag = null;
        paintMini(selected, false);
      });
      cardOf.set(r.tag, el);
      frag.appendChild(el);
    }
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function select(tag) {
    const prev = cardOf.get(selected);
    if (prev) prev.classList.remove('on');
    selected = tag;
    const cur = cardOf.get(tag);
    if (cur) cur.classList.add('on');
    startEl.disabled = false;
    renderDetail();
    paintMini(tag, false);
  }

  function renderDetail() {
    const c = world.countries.get(selected);
    if (!c) { detailEl.innerHTML = ''; return; }
    const cap = c.capital != null ? world.provinces.get(c.capital) : null;
    const d = diffOf(c.development || 0);
    const m = c.monarch;
    const [cr, cg, cb] = c.color;
    detailEl.innerHTML =
      `<div class="csd-head"><span class="csd-flag" style="background:rgb(${cr},${cg},${cb})"></span>` +
      `<div><h3>${c.name}</h3><p>${c.en || ''} · ${c.tag}</p></div></div>` +
      `<div class="csd-diff d${d.stars}">难度 ${starStr(d.stars)} ${d.label}</div>` +
      `<div class="csd-grid">
         <div><i>发展度</i><b>${c.development || 0}</b></div>
         <div><i>省份</i><b>${c.provinces.size}</b></div>
         <div><i>人力</i><b>${Math.floor(c.manpower)} / ${c.maxManpower}</b></div>
         <div><i>陆军上限</i><b>${c.forceLimit}</b></div>
         <div><i>国库</i><b>${Math.floor(c.treasury)}</b></div>
         <div><i>海军上限</i><b>${c.navalLimit}</b></div>
       </div>` +
      `<div class="csd-lines">
         <div><i>首都</i><b>${cap ? cap.name : '—'}${cap ? `（${regionOf(cap.lon, cap.lat)}）` : ''}</b></div>
         <div><i>君主</i><b>${m ? `${m.name}（${m.age}） ${m.adm}/${m.dip}/${m.mil}` : '—'}</b></div>
         <div><i>宗教</i><b>${REL(c.religion)}</b></div>
         <div><i>文化</i><b>${CUL(c.culture)}</b></div>
         <div><i>科技组</i><b>${TEC(c.techGroup)}</b></div>
         <div><i>政体</i><b>${GOV(c.gov)}</b></div>
         <div><i>神罗</i><b>${c.hre ? (c.emperor ? '成员国 · 皇帝' : '成员国') : '否'}</b></div>
       </div>`;
  }

  function paintMini(tag, ghost) {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    const view = fitView(WORLD_W, WORLD_H, w, h, 0.99);
    paintBase(ctx, world, paths, 'political', view, { w, h, dpr });
    if (!tag) return;
    const c = world.countries.get(tag);
    if (!c) return;
    const ids = [];
    for (const pid of c.provinces) if (world.provinces.get(pid)?.owner === tag) ids.push(pid);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(view.panX, view.panY);
    ctx.scale(view.zoom, view.zoom);
    const p = pathOfIds(paths, ids);
    ctx.fillStyle = ghost ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.38)';
    ctx.fill(p);
    ctx.strokeStyle = ghost ? 'rgba(201,162,39,0.65)' : '#c9a227';
    ctx.lineWidth = 1.8 / view.zoom;
    ctx.stroke(p);
    if (c.capital != null) {
      const cp = world.provinces.get(c.capital);
      if (cp) {
        ctx.beginPath();
        ctx.arc(cp.cx, cp.cy, 4 / view.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#1f1a15';
        ctx.lineWidth = 1.2 / view.zoom;
        ctx.stroke();
      }
    }
  }

  function finish() {
    if (!selected) return;
    cleanup();
    resolve_(selected);
  }

  let resolve_;
  const onSearch = () => renderList();
  const onSort = () => renderList();
  const onFilter = () => renderList();
  const onStart = () => finish();
  const onRandom = () => {
    const list = visibleRows();
    if (!list.length) return;
    const r = list[Math.floor(Math.random() * list.length)];
    select(r.tag);
    cardOf.get(r.tag)?.scrollIntoView({ block: 'center' });
  };
  const onKey = (e) => { if (e.key === 'Enter' && selected) finish(); };

  function cleanup() {
    searchEl.removeEventListener('input', onSearch);
    sortEl.removeEventListener('change', onSort);
    filterEl.removeEventListener('change', onFilter);
    startEl.removeEventListener('click', onStart);
    randEl.removeEventListener('click', onRandom);
    window.removeEventListener('keydown', onKey);
    root.classList.add('gone');
    setTimeout(() => { root.style.display = 'none'; }, 260);
  }

  searchEl.addEventListener('input', onSearch);
  sortEl.addEventListener('change', onSort);
  filterEl.addEventListener('change', onFilter);
  startEl.addEventListener('click', onStart);
  randEl.addEventListener('click', onRandom);
  window.addEventListener('keydown', onKey);

  root.style.display = '';
  root.classList.remove('gone');
  canvas.parentElement.style.aspectRatio = `${WORLD_W} / ${WORLD_H}`;
  // MessageChannel 宏任务让步：rAF 在后台标签页里永远不触发，选国界面必须照样能进
  new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); r(); };
    ch.port2.postMessage(0);
  }).then(() => {
    root.classList.add('in');
    renderList();
    // 默认落在法兰西上，但只是预选，不替玩家决定
    const def = rows.find((r) => r.tag === 'FRA') || rows[0];
    if (def) {
      select(def.tag);
      cardOf.get(def.tag)?.scrollIntoView({ block: 'center' });
    }
    paintMini(selected, false);
  });

  return new Promise((res) => { resolve_ = res; });
}
