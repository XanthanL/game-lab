# Phase 3.1 稀有度设计表
# 分档原则（不是"越稀有越强"，而是"越稀有越特化"）：
#   common 基础 —— 纯数值成长 / 无依赖的通用能力。几乎每局都会拿到，构筑的地基。
#   rare   进阶 —— 有明确玩法倾向、需要搭配才能发挥，或强度明显高于同级。
#   epic   核心 —— 能单独改变玩法形态的"构筑引擎"（多与 2~3 条协同相连）。
#
# 权重（rollChoices 里的基础权重，再乘现有的 ability 加权）：
#   common 1.00 / rare 0.45 / epic 0.18

RARITY = {
    # ---- common 1.00：地基 ----
    'hull':      'common',   # +20/+60 船体，纯生存
    'thruster':  'common',   # 速度 / 机动
    'loader':    'common',   # 装填
    'warhead':   'common',   # 弹头伤害
    'crit':      'common',   # 暴击
    'magnet':    'common',   # 拾取半径
    'regen':     'common',   # 回复
    'pierce':    'common',   # 穿透（线性成长，无依赖）
    'ricochet':  'common',   # 跳弹
    'twin':      'common',   # 多联机炮
    'frag':      'common',   # 高爆
    # ---- rare 0.45：进阶 ----
    'guided':    'rare',     # 制导：改变弹道行为
    'ram':       'rare',     # 冲角：需要贴脸，风险换收益
    'backshot':  'rare',     # 尾炮：需要走位
    'leech':     'rare',     # 噬能：伤害转回复
    'overdrive': 'rare',     # 过载：射速伤害换血，赌博性
    'phase':     'rare',     # 相位外壳：无敌窗口
    'aegis':     'rare',     # 护盾：与 ram / deathtrail 强协同
    'drone':     'rare',     # 无人机：需要养
    # ---- epic 0.18：构筑引擎 ----
    'tesla':     'epic',     # 电弧：3 条协同（storm / blink_arc / swarm_arc）
    'stasis':    'epic',     # 静止场：3 条协同（storm / nova_stasis / judge_frost）
    'nova':      'epic',     # 脉冲核心：2 条协同
    'lance':     'epic',     # 轨道长枪：2 条协同（judge_frost / rear_lance）
    'blink':     'epic',     # 相位折跃：2 条协同（blink_ram / blink_arc）
    'deathtrail':'epic',     # 死亡尾流：3 条协同
    'mine':      'epic',     # 磁暴雷：1 条协同但玩法独特
}

W = {'common': 1.00, 'rare': 0.45, 'epic': 0.18}
from collections import Counter
c = Counter(RARITY.values())
print("分档统计:", dict(c), " 合计", sum(c.values()))
print()
for k in ('common', 'rare', 'epic'):
    ids = [i for i, v in RARITY.items() if v == k]
    print(f"{k:6s} ({len(ids):2d}) w={W[k]:.2f}: {' '.join(ids)}")
print()
# 抽样期望分布（忽略 ability 加权）
tot = sum(len([i for i, v in RARITY.items() if v == k]) * W[k] for k in W)
print("纯稀有度权重下的出现占比期望（单张）：")
for k in ('common', 'rare', 'epic'):
    n = len([i for i, v in RARITY.items() if v == k])
    print(f"  {k:6s} {n*W[k]/tot*100:5.1f}%")
