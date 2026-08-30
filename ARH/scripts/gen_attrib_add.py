# -*- coding: utf-8 -*-
# Enrich Appendix A (他者视角 / hat attributions) by INSERTING extra entries
# into src/data/hat_attributions.ts (ZH) and src/i18n/attrib.en.ts (EN).
# Existing entries are preserved verbatim; only new lines are added before each
# block's closing "],".
#
# Each addition is a 4-tuple: (zh_from, zh_label, en_from, en_label)
# so ZH and EN stay aligned per entry.

ADD = {
  # ============ 左 ============
  "ml": [
    ("社会民主主义", "教条左、喊口号的", "Social Democracy", "dogmatic leftist, slogan-shouter"),
    ("自由意志主义", "抢劫犯、平等强迫症", "Libertarianism", "robber, equality-obsessive"),
  ],
  "socdem": [
    ("无政府主义", "议会迷、体制内乖宝宝", "Anarchism", "parliamentary fetishist, house pet"),
    ("民主社会主义", "温吞水、妥协派", "Democratic Socialism", "lukewarm, compromiser"),
  ],
  "demsoc": [
    ("社会民主主义", "骑墙派、和事佬", "Social Democracy", "fence-sitter, peacemaker"),
    ("自由意志主义", "平均主义者", "Libertarianism", "equalizer"),
  ],
  "trotskyism": [
    ("马克思列宁主义", "异端、永久反对派", "Marxism-Leninism", "heretic, permanent opposition"),
    ("无政府主义", "政变贩子", "Anarchism", "coup-peddler"),
  ],
  "ancom": [
    ("社会民主主义", "改良骗子、体制狗", "Social Democracy", "reform fraud, system dog"),
    ("列宁主义", "集权红", "Leninism", "centralist red"),
  ],
  "progressivism": [
    ("古典自由主义", "保姆国、管太多", "Classical Liberalism", "nanny state, too-many-rules"),
    ("马克思列宁主义", "小布尔乔亚、假左", "Marxism-Leninism", "petty-bourgeois, fake left"),
  ],
  "wokeism": [
    ("社会民主主义", "文化战士、对线机器", "Social Democracy", "culture warrior, debater-bot"),
    ("民族主义", "逆向民族主义者", "Nationalism", "reverse nationalist"),
  ],
  "marxfem": [
    ("自由意志主义", "仇男癌、性别警察", "Libertarianism", "man-hater, gender police"),
    ("社会保守主义", "分裂主义者", "Social Conservatism", "separatist"),
  ],
  "ecosocialism": [
    ("社会民主主义", "绿洗、假环保", "Social Democracy", "greenwasher, fake eco"),
    ("马克思列宁主义", "生态空想家", "Marxism-Leninism", "eco-utopian"),
  ],
  "leninism": [
    ("社会民主主义", "政变狂、灌输派", "Social Democracy", "coup maniac, indoctrinator"),
    ("民主社会主义", "密谋集团", "Democratic Socialism", "conspiracy clique"),
  ],
  "left_populism": [
    ("技术官僚主义", "反智民粹、草台班", "Technocracy", "anti-intellectual populist, amateur hour"),
    ("全球主义", "闭关锁国派", "Globalism", "autarky cultist"),
  ],
  "intersectional_fem": [
    ("自由意志主义", "标签警察、叠buff怪", "Libertarianism", "label police, buff-stacker"),
    ("马克思主义女性主义", "分裂左、小圈子", "Marxist Feminism", "splitter left, clique"),
  ],
  # ============ 兔 ============
  "nationalism": [
    ("全球主义", "狭隘民族、排外鬼", "Globalism", "narrow nationalist, xenophobe"),
    ("社会保守主义", "爱国生意", "Social Conservatism", "patriotism-for-profit"),
  ],
  "fascism": [
    ("社会民主主义", "褐衫暴徒、冲锋队", "Social Democracy", "brown-shirt thug, stormtrooper"),
    ("无政府主义", "秩序癌、条令狂", "Anarchism", "order cancer, regulation freak"),
  ],
  "stalinism": [
    ("民主社会主义", "大清洗粉、古拉格迷", "Democratic Socialism", "purge fan, gulag fanboy"),
    ("无政府主义", "铁腕狂、清洗控", "Anarchism", "iron-fist, purge addict"),
  ],
  "authoritarianism": [
    ("古典自由主义", "奴才思维、跪着的人", "Classical Liberalism", "servant mindset, kneeler"),
    ("社会民主主义", "秩序癌", "Social Democracy", "order cancer"),
  ],
  "nazism": [
    ("社会民主主义", "种族灭绝犯、毒瘤", "Social Democracy", "genocidaire, tumor"),
    ("马克思列宁主义", "万恶之源", "Marxism-Leninism", "root of all evil"),
  ],
  "ethnonationalism": [
    ("全球主义", "血统纳粹、纯种控", "Globalism", "bloodline Nazi, pureblood fetishist"),
    ("多元文化主义", "排外狂", "Multiculturalism", "exclusion maniac"),
  ],
  "rightwingpopulism": [
    ("技术官僚主义", "反智民粹、草台班", "Technocracy", "anti-intellectual populist, amateur hour"),
    ("社会民主主义", "仇精英、反智", "Social Democracy", "elite-hater, anti-intellect"),
  ],
  "technocracy": [
    ("民主社会主义", "专家治国、寡头", "Democratic Socialism", "expert-rule, oligarch"),
    ("无政府主义", "机器拜物教", "Anarchism", "machine fetishist"),
  ],
  "populism": [
    ("全球主义", "煽动家、草台班", "Globalism", "demagogue, amateur hour"),
    ("技术官僚主义", "民粹投机客", "Technocracy", "populist opportunist"),
  ],
  "totalitarianism": [
    ("社会民主主义", "监控狂、全景监狱", "Social Democracy", "surveillance freak, panopticon"),
    ("古典自由主义", "奴役者", "Classical Liberalism", "enslaver"),
  ],
  # ============ 右 ============
  "neolib": [
    ("民主社会主义", "市场原教旨、私有化狂", "Democratic Socialism", "market fundamentalist, privatization maniac"),
    ("民族主义", "WTO 信徒、全球化狗", "Nationalism", "WTO believer, globalization dog"),
  ],
  "libertarianism": [
    ("社会民主主义", "大政府走狗、税奴", "Social Democracy", "big-gov lapdog, tax slave"),
    ("马克思列宁主义", "无政府幻想家", "Marxism-Leninism", "anarchist dreamer"),
  ],
  "objectivism": [
    ("社会民主主义", "精致利己、自私自利", "Social Democracy", "refined egoist, selfish"),
    ("宗教社会主义", "拜金教主", "Religious Socialism", "money-worship cult leader"),
  ],
  "soccons": [
    ("进步主义", "裹脚布、旧道德", "Progressivism", "foot-binding cloth, old morality"),
    ("自由意志主义", "道德警察", "Libertarianism", "morality police"),
  ],
  "ultra_capitalism": [
    ("社会民主主义", "人血馒头、剥削机器", "Social Democracy", "blood bun, exploitation machine"),
    ("生态社会主义", "榨干地球", "Eco-Socialism", "earth-drainer"),
  ],
  "monarchism": [
    ("民主社会主义", "复古狂、王权梦", "Democratic Socialism", "restoration maniac, crown dreamer"),
    ("古典自由主义", "封建余孽", "Classical Liberalism", "feudal relic"),
  ],
  "social_darwinism": [
    ("社会民主主义", "冷血动物、优胜劣汰疯", "Social Democracy", "cold-blooded, survival-of-fittest freak"),
    ("宗教社会主义", "丛林法则信徒", "Religious Socialism", "jungle-law believer"),
  ],
  # ============ 神 ============
  "classic_lib": [
    ("马克思列宁主义", "自由派、西奴", "Marxism-Leninism", "liberal, western slave"),
    ("社会保守主义", "道德虚无、无根人", "Social Conservatism", "moral nihilist, rootless"),
  ],
  "ancap": [
    ("社会民主主义", "无政府资本家、币圈神棍", "Social Democracy", "anarcho-capitalist, crypto shaman"),
    ("威权主义", "私有化原教旨", "Authoritarianism", "privatization fundamentalist"),
  ],
  "anarchism": [
    ("社会民主主义", "破坏性左、砸店党", "Social Democracy", "destructive left, smash-shop gang"),
    ("威权主义", "混乱源", "Authoritarianism", "chaos source"),
  ],
  "transhumanism": [
    ("社会保守主义", "赛博疯子、改造狂", "Social Conservatism", "cyber freak, modification maniac"),
    ("深层生态学", "肉体背叛者", "Deep Ecology", "body traitor"),
  ],
  "globalism": [
    ("民族主义", "无国界、世界政府", "Nationalism", "borderless, world government"),
    ("社会保守主义", "世界公民、无根", "Social Conservatism", "citizen of the world, rootless"),
  ],
  "deepecology": [
    ("超资本主义", "反人类、灭霸", "Ultra-Capitalism", "anti-human, Thanos"),
    ("技术乐观主义", "卢德神棍", "Techno-Optimism", "Luddite charlatan"),
  ],
  "techno-optimism": [
    ("深层生态学", "技术盲目、增长癌", "Deep Ecology", "tech-blind, growth cancer"),
    ("去增长主义", "进步毒药", "Degrowth", "progress poison"),
  ],
  "georgism": [
    ("新自由主义", "土地税疯、单一税魔", "Neoliberalism", "land-tax madman, single-tax demon"),
    ("客观主义", "温和劫富", "Objectivism", "soft wealth-robber"),
  ],
  "multiculturalism": [
    ("种族民族主义", "文化相对、和稀泥", "Ethno-Nationalism", "cultural relativist, mush"),
    ("社会保守主义", "无原则包容", "Social Conservatism", "principless inclusion"),
  ],
  # ============ v1.2 ============
  "effective_accelerationism": [
    ("去增长主义", "赌徒、末日加速器", "Degrowth", "gambler, doomsday accelerator"),
    ("左翼加速主义", "资本顺风车", "Left Accelerationism", "capitalist free-rider"),
  ],
  "ai_decelerationism": [
    ("有效加速主义", "刹车党、恐惧贩子", "Effective Accelerationism (e/acc)", "brake party, fear-monger"),
    ("技术乐观主义", "卢德伪善", "Techno-Optimism", "Luddite hypocrisy"),
  ],
  "national_conservatism": [
    ("全球主义", "关税疯、贸易保护", "Globalism", "tariff madman, protectionist"),
    ("社会民主主义", "新保守、西装鹰", "Social Democracy", "new-con, suit hawk"),
  ],
  "degrowth": [
    ("超资本主义", "反发展、苦行", "Ultra-Capitalism", "anti-growth, ascetic"),
    ("技术乐观主义", "技术恐惧症", "Techno-Optimism", "techno-phobe"),
  ],
  "abundance_agenda": [
    ("去增长主义", "推土机、增长瘾", "Degrowth", "bulldozer, growth addict"),
    ("主流环保主义", "假环保、开发商", "Mainstream Environmentalism", "fake eco, developer"),
  ],
  "nazbol": [
    ("马克思列宁主义", "红褐缝合、投机", "Marxism-Leninism", "red-brown frankenstein, opportunist"),
    ("古典自由主义", "左右通吃怪", "Classical Liberalism", "both-sides freak"),
  ],
  "theocracy": [
    ("古典自由主义", "政教合一、火刑粉丝", "Classical Liberalism", "church-state, burning-fan"),
    ("无政府主义", "神权警察", "Anarchism", "theo police"),
  ],
  # ============ 其余 ============
  "anarcho_syndicalism": [
    ("威权主义", "工会官僚、罢工表演", "Authoritarianism", "union bureaucrat, strike theater"),
    ("马克思列宁主义", "改良空想", "Marxism-Leninism", "reform utopia"),
  ],
  "state_socialism": [
    ("自由意志主义", "计委怪、大政府", "Libertarianism", "planned-economy freak, big-gov"),
    ("无政府主义", "官僚社会主义", "Anarchism", "bureaucratic socialism"),
  ],
  "anarcho_mutualism": [
    ("新自由主义", "小生产者、空想", "Neoliberalism", "small producer, utopia"),
    ("马克思列宁主义", "蒲鲁东复读", "Marxism-Leninism", "Proudhon parrot"),
  ],
  "religious_socialism": [
    ("客观主义", "上帝左、红牧师", "Objectivism", "god-left, red priest"),
    ("古典自由主义", "神权社会主义", "Classical Liberalism", "theo-socialist"),
  ],
  "de_leonism": [
    ("新自由主义", "工会官僚、教条", "Neoliberalism", "union bureaucrat, dogmatist"),
    ("马克思列宁主义", "工团空想", "Marxism-Leninism", "syndicalist utopia"),
  ],
  "social_liberalism": [
    ("马克思列宁主义", "粉红左、白左", "Marxism-Leninism", "pink left, SJW"),
    ("新自由主义", "中间派、和稀泥", "Neoliberalism", "centrist, mush"),
  ],
  "left_accelerationism": [
    ("新卢德主义", "赛博左、加速师", "Neo-Luddism", "cyber-left, acceleration master"),
    ("民主社会主义", "左翼技术宅", "Democratic Socialism", "left tech nerd"),
  ],
  "civicnationalism": [
    ("种族民族主义", "软弱民族、宪法迷", "Ethno-Nationalism", "soft nation, constitution fetishist"),
    ("全球主义", "温和排他", "Globalism", "mild exclusionist"),
  ],
  "ecofascism": [
    ("主流环保主义", "生态纳粹、灭霸", "Mainstream Environmentalism", "eco-Nazi, Thanos"),
    ("社会民主主义", "绿褐缝合", "Social Democracy", "green-brown frankenstein"),
  ],
  "state_capitalism": [
    ("自由意志主义", "权贵资本、红顶", "Libertarianism", "crony capital, red-cap"),
    ("社会民主主义", "国企官僚", "Social Democracy", "SOE bureaucrat"),
  ],
  "theocratic_socialism": [
    ("马克思列宁主义", "神权左、缝合", "Marxism-Leninism", "theo-left, frankenstein"),
    ("古典自由主义", "政教怪胎", "Classical Liberalism", "church-state mutant"),
  ],
  "global_totalitarianism": [
    ("自由意志主义", "世界政府、新秩序", "Libertarianism", "world government, new order"),
    ("民族主义", "全球铁幕", "Nationalism", "global iron curtain"),
  ],
  "authoritarian_capitalism": [
    ("社会民主主义", "威权买办、血汗", "Social Democracy", "authoritarian comprador, sweatshop"),
    ("自由意志主义", "国家资本怪", "Libertarianism", "state-capital freak"),
  ],
  "anarchoegoism": [
    ("社会保守主义", "虚无怪、利己狂", "Social Conservatism", "nihilist freak, ego maniac"),
    ("马克思列宁主义", "无政府个人", "Marxism-Leninism", "anarcho-individual"),
  ],
  "effectivealtruism": [
    ("宗教社会主义", "算盘慈善、功利", "Religious Socialism", "spreadsheet charity, utilitarian"),
    ("社会保守主义", "冷血算法", "Social Conservatism", "cold-blooded algorithm"),
  ],
  "anarchoprimitivism": [
    ("技术乐观主义", "原始人、卢德", "Techno-Optimism", "caveman, Luddite"),
    ("超资本主义", "反文明", "Ultra-Capitalism", "anti-civilization"),
  ],
  "thirdway": [
    ("民主社会主义", "墙头草、建制", "Democratic Socialism", "fence-sitter, establishment"),
    ("新自由主义", "中间套利", "Neoliberalism", "middle arbitrageur"),
  ],
  "environmentalism": [
    ("深层生态学", "浅绿、表演环保", "Deep Ecology", "shallow green, performative eco"),
    ("超资本主义", "绿洗", "Ultra-Capitalism", "greenwash"),
  ],
  "cyberlibertarianism": [
    ("威权主义", "币圈无政府、数字游民", "Authoritarianism", "crypto anarchist, digital nomad"),
    ("社会民主主义", "加密自由派", "Social Democracy", "crypto liberal"),
  ],
  "market_anarchism": [
    ("马克思列宁主义", "市场空想、私产左", "Marxism-Leninism", "market utopia, private-property left"),
    ("威权主义", "无政府市场", "Authoritarianism", "anarcho-market"),
  ],
  "religious_anarchism": [
    ("威权主义", "避世教徒、山中人", "Authoritarianism", "reclusive believer, mountain man"),
    ("科学主义", "迷信无政府", "Scientism", "superstitious anarchist"),
  ],
  "social_libertarianism": [
    ("客观主义", "发钱党、UBI 迷", "Objectivism", "UBI-pusher, UBI believer"),
    ("社会保守主义", "进步自由派", "Social Conservatism", "progressive liberal"),
  ],
  "christian_democracy": [
    ("进步主义", "教会建制、十字派", "Progressivism", "church establishment, cross faction"),
    ("马克思列宁主义", "神权温和", "Marxism-Leninism", "mild theo"),
  ],
  "distributism": [
    ("新自由主义", "小农空想、作坊迷", "Neoliberalism", "peasant utopia, workshop fetishist"),
    ("社会民主主义", "反规模", "Social Democracy", "anti-scale"),
  ],
  "moderate_conservatism": [
    ("进步主义", "老好人、和事佬", "Progressivism", "nice guy, peacemaker"),
    ("反动复古主义", "温和遗老", "Reactionaryism", "mild old guard"),
  ],
  "neo_conservatism": [
    ("左翼民粹主义", "战争鹰、新保守", "Left-Wing Populism", "war hawk, neo-con"),
    ("社会民主主义", "干涉派", "Social Democracy", "interventionist"),
  ],
  "darkenlightenment": [
    ("古典自由主义", "新反动、复辟", "Classical Liberalism", "neo-reactionary, restoration"),
    ("进步主义", "技术封建迷", "Progressivism", "tech-feudal fetishist"),
  ],
  "radfem": [
    ("社会保守主义", "激进女拳、割男党", "Social Conservatism", "radical feminazi, man-cutter"),
    ("马克思主义女性主义", "分离主义", "Marxist Feminism", "separatist"),
  ],
  "reactionary": [
    ("进步主义", "反动派、复辟", "Progressivism", "reactionary, restorationist"),
    ("社会民主主义", "旧秩序迷", "Social Democracy", "old-order fetishist"),
  ],
  "liberalfeminism": [
    ("马克思主义女性主义", "白女权、名媛", "Marxist Feminism", "white feminism, socialite"),
    ("社会保守主义", "资产阶级女权", "Social Conservatism", "bourgeois feminism"),
  ],
  "neoluddism": [
    ("技术乐观主义", "卢德、退网", "Techno-Optimism", "Luddite, log-off cult"),
    ("超资本主义", "反机器", "Ultra-Capitalism", "anti-machine"),
  ],
  # ============ 隐藏结局 ============
  "hidden_centrist": [
    ("左翼民粹主义", "骑墙、和稀泥", "Left-Wing Populism", "fence-sitter, mush"),
    ("网左", "岁静、中立表演", "Online Left", "peaceful apolitical, neutral actor"),
  ],
  "hidden_maniac": [
    ("社会民主主义", "极端疯、二极管", "Social Democracy", "extreme nut, binary thinker"),
    ("粉红", "魔怔粉、战斗粉", "Little Pink", "overdosed pink, battle pink"),
  ],
  # ============ v1.5 ============
  "continuous_revolution": [
    ("社会民主主义", "盲动派、砸烂党", "Social Democracy", "adventurist, smash party"),
    ("民主社会主义", "永久革命疯", "Democratic Socialism", "permanent-revolution madman"),
  ],
  # ============ v1.4 神秘 ============
  "mysticism": [
    ("进步主义", "玄学逃避、避世", "Progressivism", "mystic escapist, recluse"),
    ("古典自由主义", "反理性神秘", "Classical Liberalism", "anti-reason mystic"),
  ],
  "new_age": [
    ("社会保守主义", "灵修骗子", "Social Conservatism", "spirituality fraud"),
    ("客观主义", "鸡汤教主", "Objectivism", "self-help guru"),
  ],
  "dialectical_materialism": [
    ("社会保守主义", "无神棍、冷血", "Social Conservatism", "godless freak, cold-blooded"),
    ("进步主义", "历史决定论狂", "Progressivism", "historical-determinism maniac"),
  ],
  "scientism": [
    ("社会保守主义", "科学教、工具理性", "Social Conservatism", "scienology, instrumental reason"),
    ("进步主义", "技术崇拜", "Progressivism", "tech worship"),
  ],
  "traditionalism": [
    ("民主社会主义", "封建迷", "Democratic Socialism", "feudal fetishist"),
    ("古典自由主义", "复古狂", "Classical Liberalism", "restoration maniac"),
  ],
  # ============ v1.3 网络 ============
  "net_troll": [
    ("粉红", "钓鱼怪、引战", "Little Pink", "troll-baiter, flame-starter"),
    ("网左", "对线乐子人", "Online Left", "debate-for-lulz"),
  ],
  "net_left": [
    ("粉红", "左圈、冲锋", "Little Pink", "left circle, charger"),
    ("民族主义", "逆向小将", "Nationalism", "reverse young radical"),
  ],
  "net_right": [
    ("社会民主主义", "右圈、冲锋", "Social Democracy", "right circle, charger"),
    ("全球主义", "殖人右", "Globalism", "colonized-mind right"),
  ],
  "net_pink": [
    ("网左", "爱国冲锋", "Online Left", "patriotic charger"),
    ("理中客", "情绪粉、战斗粉", "Professional Fence-Sitter", "emotional pink, battle pink"),
  ],
  "net_base": [
    ("粉红", "安稳派、吃瓜群众", "Little Pink", "stable faction, spectator"),
    ("网右", "沉默基本盘", "Online Right", "silent base"),
  ],
  "net_nonbase": [
    ("网右", "摇摆派", "Online Right", "swing faction"),
    ("殖人", "边缘人", "The Colonized Mind", "marginal"),
  ],
  "net_colonized": [
    ("网左", "精神外国人", "Online Left", "spiritual foreigner"),
    ("理中客", "慕洋怪", "Professional Fence-Sitter", "west-worshipper"),
  ],
}


def insert_entries(text, add, lang):
    """Insert extra hat-attribution entries into an id-block file.

    For every key in `add`, locate the block `  key: [` ... `  ],` and inject the
    new entries (zh pair when lang=='zh', en pair when lang=='en') immediately
    before the closing `],`. Pre-existing entries are preserved verbatim. Keys in
    `add` that have no matching block in the file are silently skipped.
    """
    import re
    lines = text.split("\n")
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        out.append(line)
        matched_key = None
        for key in add:
            pat = re.compile(r'^\s*(?:"?' + re.escape(key) + r'"?\s*:\s*\[)\s*$')
            if pat.match(line):
                matched_key = key
                break
        if matched_key:
            j = i + 1
            while j < n and lines[j].strip() != "],":
                j += 1
            # body lines i+1..j-1 (opening line i already appended above)
            for k in range(i + 1, j):
                out.append(lines[k])
            indent = "    "
            for (zh_from, zh_label, en_from, en_label) in add[matched_key]:
                if lang == "zh":
                    out.append(f'{indent}{{ from: "{zh_from}", label: "{zh_label}" }},')
                else:
                    out.append(f'{indent}{{ from: "{en_from}", label: "{en_label}" }},')
            out.append(lines[j])  # closing "],"
            i = j + 1
            continue
        i += 1
    return "\n".join(out)


if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    zh_path = "src/data/hat_attributions.ts"
    en_path = "src/i18n/attrib.en.ts"
    zh_text = open(zh_path, encoding="utf-8").read()
    en_text = open(en_path, encoding="utf-8").read()
    zh_out = insert_entries(zh_text, ADD, "zh")
    en_out = insert_entries(en_text, ADD, "en")
    open(zh_path, "w", encoding="utf-8").write(zh_out)
    open(en_path, "w", encoding="utf-8").write(en_out)
    print("done")
