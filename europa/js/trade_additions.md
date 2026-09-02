# Trade Depth Additions - 贸易深度系统设计文档

## 目标功能

### 1. 走私机制 (Smuggling) 🟡

**核心概念**:
- 禁运国家对节点贡献保留部分贸易力（30%）
- 防止完全断绝贸易，增加策略维度

**数据结构新增**:

```javascript
// 无需新结构，直接在贸易结算时计算
// 在 provTradePower() 函数中修改：
if (embargoed) {
  return basePower * 0.3;  // 保留 30% 贸易力
}
```

**实现逻辑**:
```javascript
export function provTradePower(world, p) {
  const owner = world.countries.get(p.owner);
  if (!owner || !p.owner) return 0;
  
  let pw = tradePowerBase(p) * (1 + mods.tradePowerMod / 100);
  
  // 海岸省份加成
  if (p.coastal) pw *= 1.5;
  
  // 首都加成
  if (p.capital) pw *= 1.25;
  
  // 轻舰挂靠
  for (const fleet of owner.fleets) {
    if (fleet.prov === adjSeaTo(p)) {
      pw += fleet.ships.light * 1.2 * (1 + mods.tradePowerMod / 100);
    }
  }
  
  // 【新增】禁运下保留 30% 贸易力（走私）
  for (const embargoTag of owner.embargoes) {
    const embArgoCountry = world.countries.get(embargoTag);
    if (embargoCountry && isAtWar(world, owner.tag, embargoTag)) continue;
    // 仅在被禁运但非战争状态下应用走私修正
    pw *= 0.3;
  }
  
  return pw;
}
```

---

### 2. 海盗袭击 (Piracy) 🔴

**核心概念**:
- 特定海域可能滋生海盗
- 降低相邻节点的贸易收入
- 玩家可花费金币清理海盗

**数据结构新增**:

```javascript
// World.trade 对象新增字段
world.trade.pirates = [
  {
    sea: 'sea_id',           // 海盗所在海域
    strength: 2,             // 海盗强度 (1-5)
    active: true,            // 是否活跃
    clearedAt: null          // 清除时间（如有）
  }
];

// Country 对象新增
country.pirateHunts = [];    // [{ sea, lastCleared }]
```

**海盗影响计算**:

```javascript
export function runTrade(world) {
  computeBlockade(world);
  
  // 计算海盗影响
  const piracyPenalty = new Map();  // node_id -> penalty
  for (const pirate of world.trade.pirates) {
    if (!pirate.active) continue;
    
    // 找到相邻的所有节点
    const adjacentNodes = getAdjacentNodes(world, pirate.sea);
    for (const nodeId of adjacentNodes) {
      const penalty = piracyPenalty.get(nodeId) || 0;
      piracyPenalty.set(nodeId, penalty + pirate.strength * 2);
    }
  }
  
  // 后续贸易结算中应用惩罚
  for (const n of Object.values(nodes)) {
    const penalty = piracyPenalty.get(n.id) || 0;
    n.value *= (1 - penalty * 0.01);  // 最大 -50%
  }
}
```

**清理海盗 UI**:

```javascript
// 在海军面板或贸易面板添加按钮
<button data-act="clearPirates" data-sea="${seaId}" ${canClear ? '' : 'disabled'}>
  清理海盗 (${cost} 金)
</button>
```

**action 处理**:

```javascript
case 'clearPirates': {
  const seaId = el.dataset.sea;
  const r = clearPirates(world, tag, seaId);
  this.log(r.ok ? `已清理${seaId}的海盗` : '清理失败：' + r.why);
  return;
}
```

---

### 3. 垄断特许权 (Monopoly Rights) 🟢

**核心概念**:
- 主导者份额 ≥ 99.9% 时获得额外 +15% 收益
- 需要投入点数解锁"垄断特许"政策

**数据结构新增**:

```javascript
// POLICIES 数组新增
POLICIES.push({
  id: 'monopoly_rights',
  name: '垄断特许权',
  requires: ['trade'],  // 需要贸易理念组
  slots: 1,
  mods: { monopolyBonus: 15 },  // 新增修正
  desc: '授予商人行会垄断权，主导节点收益 +15%。'
});
```

**垄断判断与加成**:

```javascript
export function runTrade(world) {
  for (const n of Object.values(nodes)) {
    // 计算主导者份额
    const dominantShare = n.dominantShare;  // 已有逻辑
    
    // 判断是否达到垄断阈值
    n.monopolyStrict = dominantShare >= 0.999;
    
    // 收取价值时应用加成
    for (const [tag, share] of Object.entries(n.share)) {
      const country = world.countries.get(tag);
      const hasMonopolyPolicy = country.policies?.has('monopoly_rights');
      
      let collected = n.collected[tag] || 0;
      
      // 基础垄断加成（主导者份额 > 60%）
      if (dominantShare >= 0.6 && n.dominant === tag) {
        collected *= 1.1;
      }
      
      // 垄断特许权（完全垄断 + 政策）
      if (n.monopolyStrict && hasMonopolyPolicy) {
        collected *= 1.15;  // 额外 +15%
      }
      
      // 本土收集加成
      if (n.id === country.homeNode) {
        collected *= 1.0;  // 100% 收取
      } else {
        collected *= 0.5;  // 非本土打五折
      }
      
      n.collected[tag] = collected;
    }
  }
}
```

---

## 文件修改清单

1. **js/trade.js**
   - `provTradePower()` - 添加走私逻辑
   - `runTrade()` - 添加海盗惩罚计算
   - 垄断判断增强

2. **js/world.js**
   - World.trade 初始化添加 `pirates: []`
   - Country 新增 `pirateHunts: []`

3. **js/economy.js**
   - 无重大修改（海盗清理费用通过 treasury 扣除）

4. **js/ui.js**
   - `tabTrade()` - 添加海盗警告/清理按钮
   - 添加 `clearPirates` action
   - 显示垄断政策效果

---

## 实施优先级

### 🔥 Step 1: 走私机制 (30 分钟)
- 最易实现，对现有代码侵入最小
- 立即提升禁运策略深度

### ⚖️ Step 2: 垄断特许权 (1 小时)  
- 需要政策和理念系统配合
- 增加贸易理念组的独特性

### 🌙 Step 3: 海盗系统 (1.5 小时)
- 需要完整 UI 和 action 处理
- 增加沿海节点的战略风险

预计总工时：**2-3 小时**

---

## 数值平衡建议

| 机制 | 基础值 | 调整范围 | 备注 |
|------|--------|---------|------|
| 走私保留率 | 30% | 25-40% | 太低失去意义，太高削弱禁运 |
| 海盗强度 | 1-5 | 1-7 | 5 级以上视为大型海盗团 |
| 海盗影响/级 | 2%/级 | 1-3%/级 | 总计最多 -50% |
| 海盗清理费 | 100+dev | 50-200 | 按海域大小定价 |
| 垄断特许加成 | +15% | 10-20% | 需要高投入才值得 |

---

## 设计哲学

**走私**: 
- ✅ 允许被禁运国仍有贸易通道
- ✅ 增加"半禁运"灰色地带
- ❌ 不破坏禁运的核心威慑力

**海盗**:
- ✅ 增加海权的战略维度
- ✅ 鼓励发展海军而非仅作为战争工具
- ❌ 不过度影响贸易经济稳定性

**垄断特许**:
- ✅ 给贸易理念组独特回报
- ✅ 奖励长期贸易投资
- ❌ 避免单一国家完全垄断全球贸易
