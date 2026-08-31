// 事件系统：历史风味事件 + 随机小事件
import { transferProvince } from './diplomacy.js';
import { clamp } from './rng.js';

export function checkEvents(world, rng) {
  if (!rng) rng = () => Math.random();
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

  /* ---- 随机小事件 ---- */
  if (rng() < 0.022) {
    const pool = [...world.countries.values()].filter((c) => c.provinces.size > 0);
    const c = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
    if (c) {
      const pick = Math.floor(rng() * 4);
      if (pick === 0) {
        evs.push({
          id: 'heir', title: '继承人的诞生', text: `${c.name} 的宫廷迎来了一位新的继承人，继位问题的阴云暂时散去。`,
          options: [{ text: '可喜可贺', effects: () => { c.legitimacy = clamp(c.legitimacy + 8, 0, 100); } }]
        });
      } else if (pick === 1) {
        evs.push({
          id: 'harvest', title: '丰年', text: `${c.name} 的乡野迎来了一个丰年，粮仓充实，国库也宽裕了几分。`,
          options: [{ text: '感谢上苍', effects: () => { c.treasury += Math.round(c.development * 0.6); } }]
        });
      } else if (pick === 2) {
        evs.push({
          id: 'plague', title: '瘟疫', text: `一场热病沿着商路蔓延到了 ${c.name}。田地荒芜，兵源也跟着告急。`,
          options: [
            { text: '封锁疫区', effects: () => { c.manpower = Math.max(0, c.manpower * 0.75); c.treasury -= 20; } },
            { text: '听天由命', effects: () => { c.manpower = Math.max(0, c.manpower * 0.6); c.stability = clamp(c.stability - 1, -3, 3); } }
          ]
        });
      } else {
        evs.push({
          id: 'merchants', title: '商人行会的请愿', text: `${c.name} 的商人行会请求更大的贸易特权，代价是一笔可观的献金。`,
          options: [
            { text: '准了', effects: () => { c.treasury += Math.round(c.development * 0.8); c.prestige -= 3; } },
            { text: '驳回', effects: () => { c.prestige += 3; } }
          ]
        });
      }
    }
  }

  return evs;
}
