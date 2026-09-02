# Diplomacy Additions - 外交使节系统设计文档

## 目标功能

### 1. 使节派驻系统 (Ambassador System)

**核心概念**:
- 每个国家最多可派驻 3 份使节到其他国家
- 每份使节提供 +15 友好度，持续 24 个月
- 使节到期后自动消失

**数据结构新增**:

```javascript
// Country 对象新增字段
country.ambassadors = [
  {
    to: 'TARGET_TAG',      // 目标国家标签
    createdAt: tickCount,  // 派驻时间戳 (tick)
    duration: 96           // 持续时间 (24 月 = 96 tick)
  },
  // ... 最多 3 个
];

// World 对象新增辅助方法
world.getFriendlyRelation(tagA, tagB) {
  const baseOpinion = world.relations.get(key).opinion || 0;
  const ambassadorBonus = world.countActiveAmbassadors(tagA, tagB) * 15;
  return baseOpinion + ambassadorBonus;
}

world.countActiveAmbassadors(fromTag, toTag) {
  const fromCountry = world.countries.get(fromTag);
  if (!fromCountry || !fromCountry.ambassadors) return 0;
  
  const now = world.stats.tick;
  return fromCountry.ambassadors.filter(a => 
    a.to === toTag && (now - a.createdAt) < a.duration
  ).length;
}
```

### 2. UI 交互设计

**位置**: 右侧外交面板 - 国家详情区域底部

**按钮布局**:
```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│ 🎖️ 驻派使节          │ ← 点击打开模态框
└───────────────────┘

已派驻使节：
• 对 France: +15 友好 (剩余 18 月)
• 对 England: +15 友好 (剩余 5 月)
[取消对 France 的使节]
```

**模态框内容**:
```
选择驻派目标:
[国家列表 - 按友好度排序]
✕ 不能对已有盟国/宿敌驻派
✓ 需要友好度 >= 0
```

### 3. 派遣限制规则

**禁止驻派情况**:
- ✗ 目标已是同盟关系 (ally)
- ✗ 目标是宿敌 (rival)
- ✗ 正处于战争中 (atWar)
- ✗ 已有 3 份使节在其他国家
- ✗ 对目标友好度 < 0

**允许上限**:
```javascript
maxAmbassadors = 3
usedSlots = country.ambassadors.length
availableSlots = maxAmbassadors - usedSlots
```

### 4. 使节收益计算

**月度结算时应用**:
```javascript
// economy.js monthlyTick 中调用
function applyAmbassadorBonuses(world) {
  for (const [key, rel] of world.relations) {
    const [tagA, tagB] = key.split(':');
    
    // 计算使节加成
    const bonusFromAtoB = world.countActiveAmbassadors(tagA, tagB);
    const bonusFromBtoA = world.countActiveAmbassadors(tagB, tagA);
    
    // 暂存月度加成供 opinionOf 使用
    rel.ambassadorBonus = (bonusFromAtoB + bonusFromBtoA) * 15;
  }
}

// opinionOf 函数修改
function opinionOf(world, fromTag, toTag) {
  const key = getRelationKey(fromTag, toTag);
  const rel = world.relations.get(key) || {};
  
  let opinion = rel.opinion || 0;
  opinion += rel.ambassadorBonus || 0;  // 加上使节加成
  
  // ... 原有其他修正计算
  
  return opinion;
}
```

### 5. 到期清理逻辑

**每月执行**:
```javascript
function cleanupExpiredAmbassadors(world) {
  for (const country of world.countries.values()) {
    if (!country.ambassadors) continue;
    
    const before = country.ambassadors.length;
    const now = world.stats.tick;
    
    country.ambassadors = country.ambassadors.filter(a => 
      (now - a.createdAt) < a.duration
    );
    
    const expired = before - country.ambassadors.length;
    if (expired > 0) {
      world.log.push(`${country.name} 的 ${expired} 份使节任期到期`);
    }
  }
}
```

**调用时机**: `monthlyTick()` 末尾

### 6. 日志追踪

**玩家操作反馈**:
- "🎖️ 已向 France 驻派使节 (+15 友好度，持续 24 月)"
- "❌ 无法驻派：与 France 处于战争状态"
- "⚠️ 只能再驻派 X 份使节"
- "🎖️ France 使节任期到期 (-15 友好度)"

---

## 文件修改清单

1. **js/world.js**
   - Country 初始化添加 `ambassadors: []`
   - 添加 `countActiveAmbassadors(tagA, tagB)` 静态方法

2. **js/diplomacy.js**
   - 添加 `sendAmbassador(world, fromTag, toTag)` 
   - 添加 `recallAmbassador(world, fromTag, toTag)`
   - 修改 `opinionOf()` 集成使节加成

3. **js/economy.js**
   - `monthlyTick()` 末尾添加：
     ```javascript
     cleanupExpiredAmbassadors(world);
     applyAmbassadorBonuses(world);
     ```

4. **js/ui.js**
   - `tabDiplomacy()` 中添加使节 UI 组件
   - 添加 `openAmbassadorPlacement()` 模态框
   - 处理 `assignAmbassador` action

---

## 实现步骤

**Step 1**: 数据结构 (world.js)
**Step 2**: 核心逻辑 (diplomacy.js)  
**Step 3**: 月度维护 (economy.js)
**Step 4**: UI 实现 (ui.js)
**Step 5**: 测试验证

预计总工时：**2-3 小时**
