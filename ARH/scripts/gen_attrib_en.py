#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate src/i18n/attrib.en.ts from src/data/hat_attributions.ts.
Maps each Chinese `from` to its existing nameEn, and each slang `label`
token (split on 、) through a curated zh->en dictionary.
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAT = os.path.join(ROOT, "src", "data", "hat_attributions.ts")
IDEO = os.path.join(ROOT, "src", "data", "ideologies.ts")
OUT = os.path.join(ROOT, "src", "i18n", "attrib.en.ts")

hat_src = open(HAT, encoding="utf-8").read()
ideo_src = open(IDEO, encoding="utf-8").read()

# --- name -> nameEn map (covers regular ideologies + hidden results) ---
name_en = {}
for m in re.finditer(r'name:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)"', ideo_src):
    name_en[m.group(1)] = m.group(2)

# --- label slang token dictionary (zh -> en) ---
TOK = {
    "极左": "ultra-leftist", "老登": "Old Fart", "修正主义者": "revisionist",
    "官僚": "bureaucrat", "红色官僚": "red bureaucrat", "权威左": "authoritarian leftist",
    "工贼": "scab", "改良派": "reformist", "福利党": "welfare party", "大政府": "big-government",
    "白左": "SJW", "机会主义者": "opportunist", "票友": "dilettante", "空想家": "utopian dreamer",
    "托派": "Trot", "分裂分子": "splitter", "职业革命家": "professional revolutionary",
    "小资病": "petty-bourgeois malaise", "空想派": "utopian", "乌托邦信徒": "utopian believer",
    "进步派": "progressivist", "圣母": "sanctimonious do-gooder", "社会工程师": "social engineer",
    "觉醒党": "woke crowd", "女拳": "feminazi", "环保左": "eco-leftist", "红绿灯": "red-green",
    "先锋队": "vanguard", "集权派": "centralist", "民粹": "populist", "仇富党": "wealth-hating mob",
    "身份政治": "identity-politics peddler", "民族主义者": "nationalist", "小粉红": "Little Pink",
    "国家主义者": "statist", "法西斯": "fascist", "独裁者": "dictator", "反动派": "reactionary",
    "资本走狗": "capitalist lapdog", "刽子手": "executioner", "极权派": "totalitarian",
    "慈父信徒": "Dear-Leader cultist", "威权派": "authoritarian", "顺民": "docile subject",
    "纳粹": "Nazi", "战犯": "war criminal", "人类公敌": "enemy of humanity",
    "种族主义者": "racist", "血统论": "bloodline theorist", "红脖子": "redneck",
    "工业党": "industrial clique", "技术官僚": "technocrat", "煽动家": "demagogue",
    "老大哥": "Big Brother", "新自由派": "neoliberal", "资本喉舌": "capitalist mouthpiece",
    "买办": "comprador", "自由放任派": "laissez-faire zealot", "巨婴": "man-child",
    "刁民": "unruly rabble", "精致利己主义者": "refined egoist", "拜金客": "money-worshipper",
    "保守派": "conservative", "卫道士": "moralist", "资本家": "capitalist", "吸血鬼": "bloodsucker",
    "保皇党": "royalist", "遗老": "diehard old guard", "社达": "social Darwinist", "卷王": "rat-race king",
    "带路党": "fifth columnist", "公知": "liberal pundit", "资本原教旨": "capitalist fundamentalist",
    "币圈人": "crypto bro", "无政府乱源": "anarchic troublemaker", "无政府主义者": "anarchist",
    "朋克": "punk", "电子异端": "digital heretic", "机改人": "cyborg", "技术傲慢者": "tech-arrogant",
    "世界公民": "citizen of the world", "香蕉人": "banana", "环保神棍": "eco-charlatan",
    "反人类": "anti-human", "技术信徒": "tech disciple", "马斯克粉": "Musk fanboy",
    "单一税信徒": "single-tax believer", "加速主义者": "accelerationist", "赌徒": "gambler",
    "资本乘客": "capitalist passenger", "减速党": "decelerationist", "末日论者": "doomsayer",
    "监管说客": "regulation lobbyist", "西装民粹": "suit-wearing populist", "新右翼": "new right",
    "关税信徒": "tariff believer", "苦行僧": "ascetic monk", "反增长派": "anti-growth",
    "经济自杀者": "economic suicide", "推土机": "bulldozer", "YIMBY": "YIMBY",
    "开发商说客": "developer lobbyist", "红褐": "red-brown", "投机分子": "opportunist",
    "缝合怪": "frankenstein", "神棍": "charlatan", "原教旨": "fundamentalist",
    "宗教警察": "religious police", "工团派": "syndicalist", "罢工党": "strike partisan",
    "计委官僚": "planning-bureau bureaucrat", "小生产者": "small producer",
    "蒲鲁东信徒": "Proudhonist", "革命牧师": "revolutionary priest", "红色教徒": "red believer",
    "教条主义者": "dogmatist", "加速师": "acceleration master", "赛博左": "cyber-left",
    "温和派": "moderate", "护宪党": "constitutionalist", "生态法西斯": "eco-fascist",
    "灭霸信徒": "Thanos believer", "权贵资本": "crony capital", "国企官僚": "SOE bureaucrat",
    "新秩序": "new world order", "威权买办": "authoritarian comprador", "血汗工头": "sweatshop foreman",
    "虚无主义者": "nihilist", "利己怪": "egoist freak", "算盘慈善家": "spreadsheet charity",
    "功利党": "utilitarian", "原始人": "caveman", "卢德分子": "Luddite", "墙头草": "fence-sitter",
    "建制派": "establishment", "表演环保": "performative environmentalist", "浅绿": "shallow green",
    "数字游民": "digital nomad", "市场空想家": "market utopian", "避世教徒": "reclusive believer",
    "发钱党": "UBI-pusher", "UBI 信徒": "UBI believer", "教会建制派": "church establishment",
    "小农空想家": "peasant utopian", "老好人": "nice guy", "战争贩子": "war monger", "鹰派": "hawk",
    "新反动": "neo-reactionary", "复辟派": "restorationist", "激进女拳": "radical feminazi",
    "6B4T": "6B4T", "白女权": "western feminist", "名媛拳": "socialite feminist",
    "退网党": "log-off cult", "理中客": "false-neutral poseur", "端水大师": "balance-keeper",
    "骑墙派": "fence-sitter", "魔怔人": "overdosed zealot", "乐子源": "entertainment source",
    "乐子人": "for-the-lulz", "吃瓜的": "spectator", "搅屎棍": "shit-stirrer",
    "节奏党": "hype-stirrer", "网左": "Online Left", "键政壬": "keyboard activist",
    "小将": "young radical", "赤旗军": "red-banner army", "网右": "Online Right",
    "慕洋犬": "western-bootlicker", "恨国党": "China-hater", "义和团": "Boxer",
    "战狼": "Wolf Warrior", "护旗手": "flag-defender", "岁静": "peaceful apolitical",
    "基本盘": "the base", "沉默大多数": "silent majority", "非基本盘": "non-base",
    "公知苗子": "pundit seedling", "殖人": "colonized mind", "精神外宾": "spiritual foreign guest",
    "造反派": "rebel", "盲动主义": "adventurism", "砸烂一切": "smash-everything",
    "代餐": "knock-off", "民粹化官僚": "populist bureaucrat", "唯心主义者": "idealist",
    "装神弄鬼": "hocus-pocus", "伪科学": "pseudoscience", "智商税": "IQ tax",
    "精神鸦片": "spiritual opium", "韭菜": "leek", "庸俗唯物": "vulgar materialist",
    "无神论者": "atheist", "理性原教旨": "rational fundamentalist", "祛魅狂": "disenchantment zealot",
    "现代性打手": "modernity enforcer", "工具理性": "instrumental reason",
    "秘教遗老": "occult old guard", "招魂的": "necromancer", "活化石": "living fossil",
    "跳大神的": "shaman", "政治正确警察": "PC police", "教材复读机": "textbook parrot",
}

def tr_from(s):
    return name_en.get(s, s)

def tr_label(s):
    parts = [p.strip() for p in s.split("、") if p.strip()]
    out = []
    for p in parts:
        out.append(TOK.get(p, p))
    return ", ".join(out)

# --- parse hat_attributions.ts into id -> [{from,label}] ---
entries = {}
cur = None
for line in hat_src.splitlines():
    km = re.match(r'\s{2}([A-Za-z_][\w-]*):\s*\[', line)
    if km:
        cur = km.group(1)
        entries[cur] = []
        continue
    om = re.search(r'\{\s*from:\s*"([^"]*)",\s*label:\s*"([^"]*)"\s*\}', line)
    if om and cur is not None:
        entries[cur].append({"from": om.group(1), "label": om.group(2)})

# --- emit ---
lines = []
lines.append("// 他者视角（帽子间）英文资源：id → [{ from, label }]。")
lines.append("// from 取自 ideologies.ts 的 nameEn；label 为中文网络蔑称的英文对应。")
lines.append("// Appendix A in Result.ts uses this when lang === 'en'.")
lines.append("export interface AttribEn { from: string; label: string; }")
lines.append("")
lines.append("export const ATTRIB_EN: Record<string, AttribEn[]> = {")
for k, lst in entries.items():
    lines.append(f"  {k}: [")
    for e in lst:
        fe = tr_from(e["from"]).replace("\\", "\\\\").replace('"', '\\"')
        le = tr_label(e["label"]).replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'    {{ from: "{fe}", label: "{le}" }},')
    lines.append("  ],")
lines.append("};")
lines.append("")

open(OUT, "w", encoding="utf-8").write("\n".join(lines))
print(f"wrote {OUT}: {len(entries)} ids, {sum(len(v) for v in entries.values())} entries")
# sanity: report any token not in TOK
missing = set()
for lst in entries.values():
    for e in lst:
        for p in [x.strip() for x in e["label"].split("、") if x.strip()]:
            if p not in TOK:
                missing.add(p)
print("missing label tokens:", missing if missing else "none")
missing_from = set()
for lst in entries.values():
    for e in lst:
        if e["from"] not in name_en:
            missing_from.add(e["from"])
print("missing from names:", missing_from if missing_from else "none")
