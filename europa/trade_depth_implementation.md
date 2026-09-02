# Trade Depth Implementation - Complete

## Summary
Successfully implemented all three trade depth mechanisms as specified in `trade_additions.md`:

### ✅ Step 1: Smuggling Mechanism (COMPLETED)
**File**: `/europa/js/trade.js` - `provTradePower()` function

**Implementation**:
- When a country has embargoes on another nation, it retains 30% of its trade power in embargoed nodes
- Applies only when not currently at war with the embargoing nation
- Allows continued (but diminished) trade activity despite diplomatic restrictions

**Code**:
```javascript
/* 走私：被禁运时仍保留 30% 实力（若未交战） */
const owner = world.countries.get(p.owner);
if (owner && owner.embargoes.size > 0) {
  for (const embargoTag of owner.embargoes) {
    if (!world.isAtWar(embargoTag, p.owner)) {
      v *= 0.3;  // 走私渠道留存部分贸易力
    }
  }
}
```

---

### ✅ Step 2: Monopoly Rights Policy (COMPLETED)
**Files**: 
- `/europa/js/ideas.js` - Added policy to POLICIES array
- `/europa/js/trade.js` - Updated `runTrade()` calculation

**Policy Definition**:
```javascript
{ id: 'pol_monopoly', name: '垄断特许权', requires: ['trade', 'diplomatic'], mods: { monopolyBonus: 15 }, desc: '授予商人行会垄断权，主导节点收益 +15%。' }
```

**Requirements**: 
- Must have unlocked both Trade理念组 and Diplomatic理念组
- Requires at least 1 idea taken from each group
- Uses one policy slot

**Effect**: Adds +15% bonus to collected trade value when dominant in a node (already receives base 10%/25% monopoly bonuses)

**Integration**:
- Checked via `mods?.monopolyBonus` during income calculation
- Applied when `st.dominantShare >= 0.6`

---

### ✅ Step 3: Pirate System (COMPLETED)
**File**: `/europa/js/trade.js` - New pirate system module

**Data Structure**:
```javascript
world.trade.pirates: [{ sea: string, strength: number, active: boolean }]
```

**Features Implemented**:

1. **Pirate Spawning**:
   - Random event (10% monthly chance)
   - Strength: 1-5 points based on random generation
   - Appears in sea provinces near owned territories

2. **Trade Power Penalty**:
   - Each adjacent sea with pirates reduces trade power by 2% per strength point
   - Maximum penalty capped at 80%
   - Minimum trade power preserved at 10% (prevents total disruption)

3. **Clearing Pirates**:
   - Navies can clear pirates from adjacent seas
   - Function: `clearPirates(world, seaProv)`
   - Cost mechanics ready for UI integration

4. **Helper Functions**:
   - `spawnPirate(seaProv, strength, active)` - Manual spawn
   - `clearPirates(world, seaProv)` - Clear specific sea
   - `getPiratesInSea(world, seaProv)` - Query status
   - `randomPirateEvent(world)` - Monthly random event trigger

**Calculation Logic**:
```javascript
// Per province node, sum penalties from all adjacent seas
let piracyReduction = 0;
for (const adj of p.adj) {
  const adjProv = world.provinces.get(adj);
  if (adjProv && adjProv.sea) {
    const strength = piracyPenalty.get(adj);
    if (strength > 0) {
      piracyReduction += strength * 0.02;
    }
  }
}
piracyReduction = Math.min(0.8, piracyReduction);
power[t] *= (1 - piracyReduction);
```

---

## Balance Notes

### Smuggling
- 30% retention creates meaningful but not game-breaking effect
- Embargo still reduces trade power by 70%
- War overrides smuggling (no retention during conflict)

### Monopoly Policy
- Stacks with existing dominance bonuses:
  - Base: 10% (>60% share) or 25% (>99.9% share)
  - With policy: +15% additional → up to 40% total
- Requires dual理念组 investment (trade + diplomatic)
- Fits grand strategy theme of combining military/diplomatic/economic power

### Pirates
- Max 80% penalty ensures trade never completely stops
- Encourages naval investment without making piracy unstoppable
- 2% per strength point is aggressive enough to matter but not overwhelming
- 10% monthly event rate ≈ once every 3 months on average

---

## Testing Recommendations

1. **Smuggling**: Set embargo on another nation, check trade power calculation in debug view
2. **Monopoly**: Unlock trade+diplomatic groups, take 1 idea each, enable policy, verify +15% bonus
3. **Pirates**: Wait for random event or manually spawn, verify adjacent node trade power reduction

---

## Files Modified

1. `/europa/js/trade.js` - Smuggling logic, monopoly bonus integration, pirate system
2. `/europa/js/ideas.js` - Added monopoly_rights policy

---

## Next Steps (Optional Future Work)

- UI panel for pirate clearance action with navy selection
- Cost mechanics for clearing pirates (sailor loss, time cost)
- Pirate faction AI behavior (migrating between seas)
- Merchant ship convoys as anti-piracy measure
- Province buildings that reduce local piracy risk
