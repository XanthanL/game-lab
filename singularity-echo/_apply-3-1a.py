import io, re

P = 'index.html'
src = io.open(P, encoding='utf-8').read()
orig = src

# ============================================================================
# 1) 稀有度表（放在 MODULES 之前）
# ============================================================================
anchor = "const MODULES=["
assert anchor in src
src = src.replace(anchor, """/* ============================== 卡牌稀有度（Phase 3.1） ==============================
   分档原则不是"越稀有越强"，而是**越稀有越特化**：
     common 基础 —— 纯数值成长 / 无依赖的通用能力，几乎每局都会遇到，是构筑的地基；
     rare   进阶 —— 有明确玩法倾向、需搭配才发挥，或强度明显高于同级；
     epic   核心 —— 能单独改变玩法形态的"构筑引擎"（多数与 2~3 条协同相连）。
   权重只影响**出现概率**，不影响强度 —— 稀有卡更容易被跳过，因为玩家看不懂时
   会选熟悉的 common，这正是"构筑多样性"的来源。
   ⚠️ 新增模块必须填 rarity，否则会落进 common 兜底（`rarityOf` 的默认值），
      但那样就失去了设计意图 —— 新卡请显式分档并同步 RARITY_ZH / RARITY_EN。 */
const RARITY_W={common:1.00,rare:0.45,epic:0.18};
const RARITY_ZH={common:'基础',rare:'进阶',epic:'核心'};
const RARITY_EN={common:'COMMON',rare:'RARE',epic:'EPIC'};
const RARITY_ORDER={common:0,rare:1,epic:2};
function rarityOf(m){return (m&&m.rarity)||'common';}
const MODULES=[""", 1)

# ============================================================================
# 2) 给每个 MODULE 精确插入 rarity（插在 max: 之前，保留原有逗号结构）
#    模式：  ,max:  →  ,rarity:'x',max:
# ============================================================================
RARITY = {
    'hull':'common','thruster':'common','loader':'common','warhead':'common',
    'twin':'common','pierce':'common','ricochet':'common','frag':'common',
    'crit':'common','magnet':'common','regen':'common',
    'guided':'rare','ram':'rare','backshot':'rare','leech':'rare',
    'overdrive':'rare','phase':'rare','aegis':'rare','drone':'rare',
    'tesla':'epic','stasis':'epic','nova':'epic','lance':'epic',
    'blink':'epic','deathtrail':'epic','mine':'epic',
}
i0 = src.index('const MODULES=[')
i1 = src.index('const MOD_BY_ID=')
seg = src[i0:i1]
n = 0
for mid, rar in RARITY.items():
    # 在 `{id:'mid',` 之后的第一个 `,max:` 前插入 —— 用 `,max:` 作锚（原格式统一）
    pat = re.compile(r"(\{id:'" + re.escape(mid) + r"',[\s\S]*?)(,max:)")
    m = pat.search(seg)
    assert m, 'MODULE not found: ' + mid
    seg = seg[:m.start(2)] + ",rarity:'" + rar + "'" + seg[m.start(2):]
    n += 1
assert n == 26, n

# 校验：不允许出现 `,,` 或 `'x'max`
assert ',,' not in seg, 'double comma introduced'
assert not re.search(r"'[a-z]+'max:", seg), 'missing comma before max'
# 校验：每张卡都恰好一个 rarity
assert seg.count("rarity:'") == 26, seg.count("rarity:'")
for mid in RARITY:
    blk = re.search(r"\{id:'" + re.escape(mid) + r"',[\s\S]*?(?=\n  \{id:'|\Z)", seg)
    assert blk and blk.group(0).count("rarity:'") == 1, 'rarity count wrong: ' + mid

src = src[:i0] + seg + src[i1:]

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print("OK  稀有度表 + 26 项 rarity 字段")
print("    delta bytes:", len(src) - len(orig))
