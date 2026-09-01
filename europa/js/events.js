// 事件系统：历史风味事件 + 按国家状态触发的随机小事件。
// 随机事件不再是纯 flavour：它们会动友好度（带时长的修正条目）、
// 破坏度、阶级忠诚，让"选哪个选项"成为真的权衡。
import { transferProvince, addOpinionMod, royalMarriage } from './diplomacy.js';
import { clamp, makeRng } from './rng.js';

export function checkEvents(world, rng) {
  if (!rng || !rng.chance) rng = makeRng(world.seed + '/events/' + world.stats.tick);
  const evs = [];
  const d = world.date;
  const byTag = (tag) => world.countries.get(tag);
  world.events = world.events || {};

  /* ---- 历史节点 ---- */

  // 1453 君士坦丁堡陷落
  if (d.y >= 1453 && !world.events.constantinople) {
    const byz = byTag('BYZ'), ott = byTag('OTT');
    const cons = [...world.provinces.values()].find((p) => p.capital && p.owner === 'BYZ');
    if (byz && ott && byz.provinces.size > 0 && cons) {
      world.events.constantinople = true;
      evs.push({
        id: 'constantinople',
        title: '君士坦丁堡陷落',
        text: '奥斯曼的巨炮轰开了狄奥多西城墙。千年帝国的最后一夜结束了，博斯普鲁斯海峡两岸换了主人。',
        options: [{
          text: '时代变了',
          effects: () => {
            transferProvince(world, cons.id, 'OTT');
            ott.prestige += 25;
            byz.prestige -= 50;
            for (const p of byz.provinces) {
              const q = world.provinces.get(p);
              if (q) q.controller = 'OTT';
            }
          }
        }]
      });
    }
  }

  // 1492 收复失地运动
  if (d.y >= 1492 && !world.events.reconquista) {
    const gra = byTag('GRA');
    if (gra && gra.provinces.size === 0) {
      world.events.reconquista = true;
      const cas = byTag('CAS');
      evs.push({
        id: 'reconquista', title: '收复失地运动完成',
        text: '格拉纳达的最后一个埃米尔交出了阿尔罕布拉宫的钥匙。伊比利亚的八百年拉锯，就此收尾。',
        options: [{ text: '荣耀归于卡斯蒂利亚', effects: () => { if (cas) { cas.prestige += 15; cas.stability = clamp(cas.stability + 1, -3, 3); } } }]
      });
    }
  }

  // 1517 宗教改革
  if (d.y >= 1517 && !world.events.reformation) {
    world.events.reformation = true;
    evs.push({
      id: 'reformation', title: '宗教改革',
      text: '一位德意志修士把《九十五条论纲》钉在了维滕贝格的教堂门上。信仰的版图，从今天起开始碎裂。',
      options: [{
        text: '这是动荡的开始',
        effects: () => {
          for (const p of world.provinces.values()) {
            if (p.sea || p.religion !== 'catholic' || !p.owner) continue;
            const o = world.countries.get(p.owner);
            if (o && ['german', 'czech', 'scandinavian', 'english', 'dutch'].includes(o.culture) && rng() < 0.22) {
              p.religion = 'protestant';
            }
          }
        }
      }]
    });
  }

  /* ---- 随机事件：按国家状态构建候选池，挑一个触发 ---- */
  if (rng() < 0.06) {
    const alive = [...world.countries.values()].filter((c) => c.provinces.size > 0);
    if (alive.length) {
      // 六成概率落在玩家头上（若玩家有资格），其余落在随机国家——世界也要有自己的故事
      const pc = world.countries.get(world.playerTag);
      let c;
      if (pc && pc.provinces.size > 0 && rng.chance(0.6)) c = pc;
      else c = rng.pick(alive);
      if (c && c.estates) {
        const provs = () => [...c.provinces].map((id) => world.provinces.get(id)).filter((p) => p && !p.sea && p.owner === c.tag && p.controller === c.tag);
        const pool = [];

        // 1) 继承人
        pool.push(() => ({
          id: 'heir', title: '继承人的诞生', text: `${c.name} 的宫廷迎来了一位新的继承人，继位问题的阴云暂时散去。`,
          options: [{ text: '可喜可贺', effects: () => { c.legitimacy = clamp(c.legitimacy + 8, 0, 100); } }]
        }));
        // 2) 丰年
        pool.push(() => ({
          id: 'harvest', title: '丰年', text: `${c.name} 的乡野迎来了一个丰年，粮仓充实，国库也宽裕了几分。`,
          options: [{ text: '感谢上苍', effects: () => { c.treasury += Math.round(c.development * 0.6); } }]
        }));
        // 3) 瘟疫：砸出破坏度
        pool.push(() => {
          const list = provs().sort((a, b) => (b.baseTax + b.baseProduction + b.baseManpower) - (a.baseTax + a.baseProduction + a.baseManpower));
          const p = list[0];
          if (!p) return null;
          return {
            id: 'plague', title: '瘟疫', text: `一场热病沿着商路蔓延到了 ${p.name}。田地荒芜，市集冷清。`,
            options: [
              { text: '封锁疫区', effects: () => { c.manpower = Math.max(0, c.manpower * 0.75); c.treasury -= 20; p.devastation = clamp((p.devastation || 0) + 10, 0, 100); } },
              { text: '听天由命', effects: () => { c.manpower = Math.max(0, c.manpower * 0.6); c.stability = clamp(c.stability - 1, -3, 3); p.devastation = clamp((p.devastation || 0) + 25, 0, 100); } }
            ]
          };
        });
        // 4) 商人行会请愿
        pool.push(() => ({
          id: 'merchants', title: '商人行会的请愿', text: `${c.name} 的商人行会请求更大的贸易特权，代价是一笔可观的献金。`,
          options: [
            { text: '准了', effects: () => {
              c.treasury += Math.round(c.development * 0.8); c.prestige -= 3;
              if (c.estates?.burghers) c.estates.burghers.loyalty = clamp(c.estates.burghers.loyalty + 10, 0, 100);
            } },
            { text: '驳回', effects: () => {
              c.prestige += 3;
              if (c.estates?.burghers) c.estates.burghers.loyalty = clamp(c.estates.burghers.loyalty - 8, 0, 100);
            } }
          ]
        }));
        // 5) 贵族比武大会
        if (c.estates.nobles.influence >= 30) {
          pool.push(() => ({
            id: 'nobles_tourney', title: '贵族的比武大会', text: `${c.name} 的贵族们请求王室赞助一场盛大的比武大会，以重振武士的荣光。`,
            options: [
              { text: '倾力赞助', effects: () => {
                c.treasury -= Math.min(c.treasury, Math.round(30 + c.development * 0.4));
                if (c.estates?.nobles) c.estates.nobles.loyalty = clamp(c.estates.nobles.loyalty + 12, 0, 100);
                c.armyTradition = Math.min(100, (c.armyTradition || 0) + 3);
              } },
              { text: '国库没有余钱', effects: () => {
                if (c.estates?.nobles) c.estates.nobles.loyalty = clamp(c.estates.nobles.loyalty - 8, 0, 100);
              } }
            ]
          }));
        }
        // 6) 什一税之争
        if (c.estates.clergy.loyalty < 70) {
          pool.push(() => ({
            id: 'clergy_tithe', title: '什一税之争', text: `${c.name} 的主教团要求把拖欠的什一税一分不少地收齐，乡野间已有人抱怨。`,
            options: [
              { text: '全力征收', effects: () => {
                c.treasury += Math.round(c.development * 0.5);
                if (c.estates?.commoners) c.estates.commoners.loyalty = clamp(c.estates.commoners.loyalty - 10, 0, 100);
                if (c.estates?.clergy) c.estates.clergy.loyalty = clamp(c.estates.clergy.loyalty + 10, 0, 100);
              } },
              { text: '暂缓征收', effects: () => {
                if (c.estates?.clergy) c.estates.clergy.loyalty = clamp(c.estates.clergy.loyalty - 8, 0, 100);
                if (c.estates?.commoners) c.estates.commoners.loyalty = clamp(c.estates.commoners.loyalty + 6, 0, 100);
              } }
            ]
          }));
        }
        // 7) 城市大火
        pool.push(() => {
          const list = provs().filter((p) => (p.baseTax + p.baseProduction + p.baseManpower) >= 6);
          const p = list.length ? list[Math.floor(rng() * list.length)] : null;
          if (!p) return null;
          return {
            id: 'fire', title: '城市大火', text: `${p.name} 的木构城区一夜之间烧成了白地，商栈与作坊化为焦炭。`,
            options: [
              { text: '拨款重建', effects: () => { c.treasury -= Math.min(c.treasury, Math.round(30 + c.development * 0.5)); p.devastation = clamp((p.devastation || 0) + 8, 0, 100); } },
              { text: '自求多福', effects: () => { p.devastation = clamp((p.devastation || 0) + 30, 0, 100); } }
            ]
          };
        });
        // 8) 发现矿脉
        pool.push(() => {
          const list = provs().filter((p) => ['iron', 'copper', 'gold'].includes(p.tradeGood));
          const p = list.length ? list[Math.floor(rng() * list.length)] : null;
          if (!p) return null;
          return {
            id: 'ore', title: '新矿脉', text: `${p.name} 的山里勘出了新的矿脉，矿工的锤声日夜不停。`,
            options: [{ text: '天赐宝山', effects: () => { p.baseProduction += 1; c.prestige = clamp(c.prestige + 2, -100, 100); } }]
          };
        });
        // 9) 宗教骚动
        pool.push(() => {
          const list = provs().filter((p) => p.religion !== c.religion);
          const p = list.length ? list[Math.floor(rng() * list.length)] : null;
          if (!p) return null;
          return {
            id: 'sect', title: '异端集会', text: `${p.name} 有人聚众宣讲与国教相悖的道理，地方官不知如何处置。`,
            options: [
              { text: '宽容以待', effects: () => { c.treasury -= 10; p.unrest = Math.max(0, p.unrest - 2); } },
              { text: '严厉镇压', effects: () => {
                p.unrest += 2;
                if (c.estates?.clergy) c.estates.clergy.loyalty = clamp(c.estates.clergy.loyalty + 8, 0, 100);
              } }
            ]
          };
        });
        // 10) 王室婚约提议：动真格的联姻与友好度
        pool.push(() => {
          const cand = [...world.countries.values()].filter((o) => o.tag !== c.tag && o.provinces.size > 0
            && o.religion === c.religion && !getRelationPair(world, c, o).marriage
            && !c.rivals.has(o.tag) && !isPairAtWar(world, c, o));
          const o = cand.length ? cand[Math.floor(rng() * cand.length)] : null;
          if (!o) return null;
          return {
            id: 'marry_offer', title: '王室婚约', text: `${o.name} 的宫廷遣使提议两国联姻。这门亲事将把两家绑在同一条船上。`,
            options: [
              { text: '应允婚事', effects: () => {
                if (royalMarriage(world, c.tag, o.tag).ok) addOpinionMod(world, c.tag, o.tag, 'wed', '联姻之谊', 15, 120);
              } },
              { text: '婉言谢绝', effects: () => { addOpinionMod(world, c.tag, o.tag, 'declined', '婉拒联姻', -10, 24); } }
            ]
          };
        });
        // 11) 边境冲突：与宿敌或积怨邻国之间
        pool.push(() => {
          const cand = [...world.countries.values()].filter((o) => o.tag !== c.tag && o.provinces.size > 0
            && !isPairAtWar(world, c, o) && (c.rivals.has(o.tag) || (c.ae.get(o.tag) || 0) > 20)
            && borders(world, c, o));
          const o = cand.length ? cand[Math.floor(rng() * cand.length)] : null;
          if (!o) return null;
          return {
            id: 'border_incident', title: '边境冲突', text: `边境村庄为一块牧场大打出手，${o.name} 的边民与 ${c.name} 的边民各有死伤。两国边防军已剑拔弩张。`,
            options: [
              { text: '强硬交涉', effects: () => {
                c.prestige = clamp(c.prestige + 2, -100, 100);
                addOpinionMod(world, c.tag, o.tag, 'border', '边境冲突', -10, 24);
              } },
              { text: '各打五十大板', effects: () => {
                c.prestige = clamp(c.prestige - 2, -100, 100);
                addOpinionMod(world, c.tag, o.tag, 'border', '息事宁人', 10, 24);
              } }
            ]
          };
        });
        // 12) 走私犯
        if (provs().some((p) => p.coastal)) {
          pool.push(() => ({
            id: 'smugglers', title: '走私船', text: `海关在 ${c.name} 的港口截获了一批走私船，货主背后隐约有行会的影子。`,
            options: [
              { text: '连赃带货充公', effects: () => {
                c.treasury += Math.round(c.development * 0.3);
                if (c.estates?.burghers) c.estates.burghers.loyalty = clamp(c.estates.burghers.loyalty - 5, 0, 100);
              } },
              { text: '睁一只眼闭一只眼', effects: () => {
                c.inflation += 0.2;
                if (c.estates?.burghers) c.estates.burghers.loyalty = clamp(c.estates.burghers.loyalty + 5, 0, 100);
              } }
            ]
          }));
        }

        const fns = pool.map((f) => f()).filter(Boolean);
        if (fns.length) evs.push(fns[Math.floor(rng() * fns.length)]);
      }
    }
  }

  return evs;
}

/* 事件内的小工具 */
function getRelationPair(world, a, b) {
  const key = a.tag < b.tag ? `${a.tag}:${b.tag}` : `${b.tag}:${a.tag}`;
  return world.relations.get(key) || {};
}
function isPairAtWar(world, a, b) {
  return world.wars.some((w) => w.active && ((w.attackers.has(a.tag) && w.defenders.has(b.tag)) || (w.attackers.has(b.tag) && w.defenders.has(a.tag))));
}
function borders(world, c, o) {
  for (const pid of c.provinces) {
    for (const n of world.provinces.get(pid).adj) {
      if (world.provinces.get(n).owner === o.tag) return true;
    }
  }
  return false;
}
