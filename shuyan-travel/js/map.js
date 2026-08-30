// 树言·旅记 - 交互式地图功能 (高德地图版)
// 文件: js/map.js

/**
 * 逻辑路线：
 * 1. 北京 (2018) - 觉醒
 * 2. 大兴安岭 (2019.11) - 迷雾
 * 3. 哈尔滨 (2019.12) - 凝固
 * 4. 敦煌 (2020.09) - 熵增
 * 5. 张掖荒村 (2020.10) - 共温
 * 6. 喀什 (2021) - 节奏
 * 7. 拉萨 (2022) - 剥离
 * 8. 成都 (2023) - 慢速
 * 9. 苍山 (2024.05) - 马帮
 * 10. 大理 (2024.09) - 节律
 * 11. 雨崩 (2025) - 奖赏
 *
 * —— 「对角线」徒步（ID ≥ 12，弃车步行，西南 → 东北）——
 * 12. 德钦 (2025.03) - 弃轮
 * 13. 奔子栏 (2025.03) - 换水
 * 14. 虎跳峡 (2025.03) - 江声
 * 15. 石鼓 (2025.03) - 转弯
 * 16. 丽江 (2025.03) - 冲街
 * 17. 华坪 (2025.04) - 翻色
 *
 * —— 第二段·攀西—大凉山 ——
 * 18. 攀枝花 (2025.04) - 浇城
 * 19. 米易 (2025.05) - 扛季
 * 20. 西昌 (2025.05) - 跨线
 * 21. 昭觉 (2025.05) - 火塘
 * 22. 悬崖村 (2025.06) - 钢梯
 * 23. 峨边 (2025.06) - 忠魂
 *
 * —— 第三段·川中丘陵 ——
 * 24. 乐山 (2025.06) - 水账
 * 25. 犍为 (2025.07) - 铲煤
 * 26. 自贡 (2025.07) - 汗盐
 * 27. 富顺 (2025.07) - 蘸水
 * 28. 南充 (2025.08) - 缫丝
  * 29. 巴中 (2025.08) - 杵声
 *
 * 第四段·秦巴—关中（徒步，2025.09-11）：
 * 30. 米仓山 (2025.09) - 出川
 * 31. 汉中 (2025.09) - 稻界
 * 32. 洋县 (2025.09) - 朱鹮
 * 33. 秦岭分水岭 (2025.10) - 分水
 * 34. 西安 (2025.10) - 早市
 * 35. 韩城 (2025.11) - 黄河
 *
 * 第五段·三晋—华北（徒步，2025.12-2026.05）：
 * 36. 河津 (2025.12) - 过河
 * 37. 临汾 (2025.12) - 白鹭
 * 38. 洪洞 (2025.12) - 槐树
 * 44. 灵石 (2026.01，正定补记) - 空窑
 * 39. 平遥 (2026.01) - 票号
 * 40. 太原 (2026.02) - 酸锈
 * 41. 阳泉 (2026.03) - 矸石
 * 42. 井陉 (2026.03) - 车辙
 * 43. 正定 (2026.04) - 平原
 *
 * 第六段·京畿—出关（徒步，2026.05-07）：
 * 45. 北京 (2026.05) - 闭环
 * 46. 蓟州—玉田 (2026.06) - 麦收
 * 47. 山海关 (2026.07) - 出关
 *
 * 第七段·关东（徒步，2026.08-2027.04，终章）：
 * 48. 兴城 (2026.11) - 冬天的海
 * 49. 沈阳铁西 (2026.12) - 锈带
 * 50. 长春 (2027.01) - 黑土
 * 51. 哈尔滨 (2027.02) - 重上冰面（闭环）
 * 52. 佳木斯 (2027.03) - 白毛风
 * 53. 鹤岗 (2027.04) - 终点
 */
const travelLocations = [
    {
        id: 1,
        name: "北京",
        lat: 39.9042,
        lng: 116.4074,
        year: 2018,
        season: "春",
        description: "清晨六点，红墙下散发着几百年老楠木被风干的朽气。那是扫帚划过青砖的节拍，也是我旧生活的终点。",
        color: "#8B7355",
        storiesList: [{ title: "故宫的清晨", date: "2018.04.15", storyId: "1" }]
    },
    {
        id: 2,
        name: "大兴安岭",
        lat: 50.7833,
        lng: 124.1167,
        year: 2019,
        season: "冬",
        description: "在零下三十度的密林里，白桦树桩在手电光里像张脸。有些东西，是真的不希望被人类定义。",
        color: "#5D4037",
        storiesList: [{ title: "消失的界碑", date: "2019.11.20", storyId: "2" }]
    },
    {
        id: 3,
        name: "哈尔滨",
        lat: 45.8038,
        lng: 126.5340,
        year: 2019,
        season: "冬",
        description: "在零下三十度的江面上，吸入的每一口空气都像碎玻璃渣子。烧刀子在胃里炸开，睫毛上的霜正变得沉重。",
        color: "#795548",
        storiesList: [{ title: "极寒之地的凝固", date: "2019.12.10", storyId: "3" }]
    },
    {
        id: 4,
        name: "敦煌",
        lat: 40.1130,
        lng: 94.6618,
        year: 2020,
        season: "秋",
        description: "壁画每天都在不可逆转地死亡。老李手里的针头很稳，他在这片荒原深处，做着一笔跟熵增对抗的赔本生意。",
        color: "#A1887F",
        storiesList: [{ title: "戈壁里的千年一瞬", date: "2020.09.22", storyId: "4" }]
    },
    {
        id: 5,
        name: "张掖",
        lat: 38.9300,
        lng: 100.4500,
        year: 2020,
        season: "秋",
        description: "在生理性失温面前，阶级共情是唯一的物理热源。那张带膻味的塑料布和辣嗓子的姜汤，砸碎了关于旅行的伪善想象。",
        color: "#8B7355",
        storiesList: [{ title: "那张带膻味的塑料布", date: "2020.10.05", storyId: "5" }]
    },
    {
        id: 6,
        name: "喀什",
        lat: 39.4677,
        lng: 75.9937,
        year: 2021,
        season: "夏",
        description: "时间是用铜壶和铁锤计算的。只要琴声不断，打铁的节奏不歇，帕米尔高原脚下的心跳就不会断。",
        color: "#5D4037",
        storiesList: [{ title: "喀什老城的茶馆", date: "2021.07.12", storyId: "6" }]
    },
    {
        id: 7,
        name: "拉萨",
        lat: 29.6469,
        lng: 91.1172,
        year: 2022,
        season: "夏",
        description: "在最缺氧的地方，人活得最像活人。剥离了形而上的神圣，信仰是磕响青石板的汗水，和一粒带有体温的奶渣。",
        color: "#8B7355",
        storiesList: [{ title: "众神守望的高原", date: "2022.08.05", storyId: "7" }]
    },
    {
        id: 8,
        name: "成都",
        lat: 30.5728,
        lng: 104.0668,
        year: 2023,
        season: "春",
        description: "竹椅在青瓦下发出吱呀声，盖碗茶里的叶片浮沉。在这里，慢速不再是一种罪过，而是一种与世界相处的尊严。",
        color: "#5D4037",
        storiesList: [{ title: "锦城的卸妆时刻", date: "2023.03.11", storyId: "8" }]
    },
    {
        id: 9,
        name: "苍山",
        lat: 25.7000,
        lng: 100.1500,
        year: 2024,
        season: "春",
        description: "路通了，马闲了。这世上的事，快有快的道理，慢有慢的尊严。那块咸得要命的风干肉，是旅途中最实在的东西。",
        color: "#A1887F",
        storiesList: [{ title: "最后的马帮", date: "2024.05.20", storyId: "9" }]
    },
    {
        id: 10,
        name: "大理",
        lat: 25.6065,
        lng: 100.2676,
        year: 2024,
        season: "秋",
        description: "当太阳这块烧红的重金属挤出山脊，人类的焦躁显得一文不值。自然有它的步子，我们只需要与之对齐。",
        color: "#8B7355",
        storiesList: [{ title: "晨光里的天体节律", date: "2024.09.10", storyId: "10" }]
    },
    {
        id: 11,
        name: "雨崩",
        lat: 28.3934,
        lng: 98.8687,
        year: 2025,
        season: "冬",
        description: "梅里雪山下的寂静是带有重量的。只有双脚被砂石反复磨砺出的痛觉，才能抵消在这片神迹面前的虚浮感。",
        color: "#A1887F",
        storiesList: [{ title: "物理极处的大地真形", date: "2025.01.12", storyId: "11" }]
    },
    {
        id: 12,
        name: "德钦",
        lat: 28.4833,
        lng: 98.9167,
        year: 2025,
        season: "春",
        description: "出雨崩那天，我对停下的面包车摆了摆手。铝杖收进包底，换上一根杜鹃木杖——从这里起，不再上车。",
        color: "#795548",
        storiesList: [{ title: "换杖", date: "2025.03.05", storyId: "12" }]
    },
    {
        id: 13,
        name: "奔子栏",
        lat: 28.1667,
        lng: 99.2833,
        year: 2025,
        season: "春",
        description: "翻过一道山梁，脚下的水换了姓。金沙江浑得像一江黄汤，不喧哗，力气却一分没少。",
        color: "#8B7355",
        storiesList: [{ title: "第一碗浑水", date: "2025.03.10", storyId: "13" }]
    },
    {
        id: 14,
        name: "虎跳峡",
        lat: 27.1783,
        lng: 100.0839,
        year: 2025,
        season: "春",
        description: "江在石头缝里发疯，发了几十万年。那声音先用耳朵听，再用胸口听，最后用脚底板听。",
        color: "#5D4037",
        storiesList: [{ title: "一条江在发疯", date: "2025.03.15", storyId: "14" }]
    },
    {
        id: 15,
        name: "石鼓",
        lat: 26.8667,
        lng: 99.9667,
        year: 2025,
        season: "春",
        description: "长江在这里学会了转弯。我在油腻的桌面上摊开地图，用铅笔把一条斜线从石鼓拉到了鹤岗。",
        color: "#A1887F",
        storiesList: [{ title: "铅笔线", date: "2025.03.20", storyId: "15" }]
    },
    {
        id: 16,
        name: "丽江",
        lat: 26.8721,
        lng: 100.2299,
        year: 2025,
        season: "春",
        description: "白天的古城是一台开足马力的机器。凌晨四点，纳西阿婆用一渠雪水和一把扫帚，把它刷回了真身。",
        color: "#795548",
        storiesList: [{ title: "凌晨四点的古城", date: "2025.03.25", storyId: "16" }]
    },
    {
        id: 17,
        name: "华坪",
        lat: 26.6290,
        lng: 101.2660,
        year: 2025,
        season: "春",
        description: "对角线上第一座煤城。挖煤的手和剪芒果枝的手是同一双，一个朝地底要黑的，一个朝天上要绿的。",
        color: "#8B7355",
        storiesList: [{ title: "煤和芒果", date: "2025.04.08", storyId: "17" }]
    },
    {
        id: 18,
        name: "攀枝花",
        lat: 26.5823,
        lng: 101.7160,
        year: 2025,
        season: "春",
        description: "这座城是挂在山坡上的。六十年前七户人家一棵树，后来树底下浇出一座钢城——先生产，后生活。",
        color: "#5D4037",
        storiesList: [{ title: "钢水当根", date: "2025.04.20", storyId: "18" }]
    },
    {
        id: 19,
        name: "米易",
        lat: 26.8879,
        lng: 102.1103,
        year: 2025,
        season: "夏",
        description: "安宁河谷的大棚里，春天比日历早两个月。早出来的那两个月，是人凌晨三点一担一担挑进去的。",
        color: "#A1887F",
        storiesList: [{ title: "早到的春天", date: "2025.05.02", storyId: "19" }]
    },
    {
        id: 20,
        name: "西昌",
        lat: 27.8944,
        lng: 102.2644,
        year: 2025,
        season: "夏",
        description: "邛海边补网的手和山谷里点火的手，停在同一片天底下。在月城，我跨过了那条看不见的胡焕庸线。",
        color: "#795548",
        storiesList: [{ title: "渔网和火箭", date: "2025.05.14", storyId: "20" }]
    },
    {
        id: 21,
        name: "昭觉",
        lat: 28.0145,
        lng: 102.8430,
        year: 2025,
        season: "夏",
        description: "大凉山腹地，三块石头支起一口锅，一口锅拢住一家人。火塘不熄，家就不散。",
        color: "#8B7355",
        storiesList: [{ title: "三块石头", date: "2025.05.24", storyId: "21" }]
    },
    {
        id: 22,
        name: "悬崖村",
        lat: 28.2560,
        lng: 103.3400,
        year: 2025,
        season: "夏",
        description: "两千五百五十六级钢梯焊在八百米绝壁上，白天是路，雨里是命。花在崖上，蜂在崖上，人就还得回崖上。",
        color: "#5D4037",
        storiesList: [{ title: "钢梯上的雨", date: "2025.06.05", storyId: "22" }]
    },
    {
        id: 23,
        name: "峨边",
        lat: 29.2305,
        lng: 103.2626,
        year: 2025,
        season: "夏",
        description: "金口大峡谷里，火车从山肚子里开出来又钻回去。钢轨底下压着两千多个名字，一公里一忠魂。",
        color: "#A1887F",
        storiesList: [{ title: "钢轨底下有人", date: "2025.06.18", storyId: "23" }]
    },
    {
        id: 24,
        name: "乐山",
        lat: 29.5521,
        lng: 103.7657,
        year: 2025,
        season: "夏",
        description: "大佛坐了一千二百年，不靠法力，靠发髻里那几条排水沟。海通和尚算的是水账，不是佛账。",
        color: "#795548",
        storiesList: [{ title: "水账", date: "2025.06.28", storyId: "24" }]
    },
    {
        id: 25,
        name: "犍为",
        lat: 29.2083,
        lng: 103.9497,
        year: 2025,
        season: "夏",
        description: "一台一九五九年的蒸汽机车还在烧煤。一铲煤进去，一口汽出来，这台机器不赊账。",
        color: "#8B7355",
        storiesList: [{ title: "烧煤的机车", date: "2025.07.06", storyId: "25" }]
    },
    {
        id: 26,
        name: "自贡",
        lat: 29.3390,
        lng: 104.7784,
        year: 2025,
        season: "夏",
        description: "一根竹篾绳把两亿年的古盐海从一千米地底捞上来。盐是汗的化石，这话不是修辞，是换算。",
        color: "#5D4037",
        storiesList: [{ title: "盐是汗的化石", date: "2025.07.15", storyId: "26" }]
    },
    {
        id: 27,
        name: "富顺",
        lat: 29.1812,
        lng: 104.9750,
        year: 2025,
        season: "夏",
        description: "豆花是淡的，蘸水是烈的，分开放才成一碗饭。盐卤本是毒，点进豆浆却开出一窝白花。",
        color: "#A1887F",
        storiesList: [{ title: "一碗豆花的淡", date: "2025.07.20", storyId: "27" }]
    },
    {
        id: 28,
        name: "南充",
        lat: 30.8373,
        lng: 106.1106,
        year: 2025,
        season: "夏",
        description: "嘉陵江用十七公里拐一个弯。缫丝女工把手在热水里泡了三十年，指纹都烫平了。",
        color: "#795548",
        storiesList: [{ title: "泡了三十年的手", date: "2025.08.02", storyId: "28" }]
    },
    {
        id: 29,
        name: "巴中",
        lat: 31.8691,
        lng: 106.7478,
        year: 2025,
        season: "夏",
        description: "巴山脚下，背二哥的打杵子往地上一拄，笃。两百斤还在背上，人已经能喘气了。",
        color: "#8B7355",
        storiesList: [{ title: "打杵子的声音", date: "2025.08.16", storyId: "29" }]
    },
    {
        id: 30,
        name: "米仓山",
        lat: 32.6500,
        lng: 106.8500,
        year: 2025,
        season: "秋",
        description: "红叶还没红，先红的是脚踝。垭口界碑一步跨过去，半年的四川留在身后。",
        color: "#5D4037",
        storiesList: [{ title: "翻米仓山", date: "2025.09.02", storyId: "30" }]
    },
    {
        id: 31,
        name: "汉中",
        lat: 33.0678,
        lng: 107.0238,
        year: 2025,
        season: "秋",
        description: "秦岭挡住寒潮，巴山兜住水汽，稻子在这里守住它的北界。凌晨五点的热面皮，烫红了揭笼布的手。",
        color: "#A1887F",
        storiesList: [{ title: "稻子的北界", date: "2025.09.12", storyId: "31" }]
    },
    {
        id: 32,
        name: "洋县",
        lat: 33.2225,
        lng: 107.5459,
        year: 2025,
        season: "秋",
        description: "四十年前全世界剩七只朱鹮。今天天上飞的每一只，都是那七只的后代。",
        color: "#795548",
        storiesList: [{ title: "七只鸟的后代", date: "2025.09.24", storyId: "32" }]
    },
    {
        id: 33,
        name: "秦岭分水岭",
        lat: 33.8500,
        lng: 108.8700,
        year: 2025,
        season: "秋",
        description: "华西秋雨里翻主脊，夜里石头在水底响。一道岭分开两碗水：碑南入长江，碑北入黄河。",
        color: "#8B7355",
        storiesList: [{ title: "一道岭，两碗水", date: "2025.10.10", storyId: "33" }]
    },
    {
        id: 34,
        name: "西安",
        lat: 34.3416,
        lng: 108.9398,
        year: 2025,
        season: "秋",
        description: "一千三百万人的城，人只在城墙根的早市上露脸。游客吃名气，街坊吃习惯。",
        color: "#5D4037",
        storiesList: [{ title: "城墙根的早市", date: "2025.10.26", storyId: "34" }]
    },
    {
        id: 35,
        name: "韩城",
        lat: 35.4760,
        lng: 110.4425,
        year: 2025,
        season: "秋",
        description: "党家村的家训凿在砖上，六百年没烂。黄河从龙门挤出来，像憋了一千里的话终于说完了。",
        color: "#A1887F",
        storiesList: [{ title: "黄河第一面", date: "2025.11.10", storyId: "35" }]
    },
    {
        id: 36,
        name: "河津",
        lat: 35.5964,
        lng: 110.7118,
        year: 2025,
        season: "冬",
        description: "二十分钟走完黄河，河在脚底下响。桥那头，烟囱林顶着橘红的火苗，替山西接了我。",
        color: "#795548",
        storiesList: [{ title: "过河", date: "2025.12.02", storyId: "36" }]
    },
    {
        id: 37,
        name: "临汾",
        lat: 36.0880,
        lng: 111.5190,
        year: 2025,
        season: "冬",
        description: "鱼回来，鸟就跟着回来。汾河的记性比人好，账一笔一笔记着，只是结得慢。",
        color: "#8B7355",
        storiesList: [{ title: "水的记性", date: "2025.12.18", storyId: "37" }]
    },
    {
        id: 38,
        name: "洪洞",
        lat: 36.2537,
        lng: 111.6740,
        year: 2025,
        season: "冬",
        description: "六百年，二十二代，压成族谱第一页的一行字。老人的手指按在那行字上，按了很久。",
        color: "#5D4037",
        storiesList: [{ title: "大槐树", date: "2025.12.30", storyId: "38" }]
    },
    {
        id: 44,
        name: "灵石",
        lat: 36.8479,
        lng: 111.7785,
        year: 2026,
        season: "冬",
        description: "空窑洞里三个鬼：一个是风吹瓶口，一个是冰锥滴水，一个是热气掠帘。天亮全招了。",
        color: "#795548",
        storiesList: [{ title: "空窑一夜", date: "2026.05.02", storyId: "44" }]
    },
    {
        id: 39,
        name: "平遥",
        lat: 37.1892,
        lng: 112.1763,
        year: 2026,
        season: "冬",
        description: "一张汇票走三千里，押的是算盘珠子的准，和镖师脖子的硬。",
        color: "#A1887F",
        storiesList: [{ title: "算盘和命", date: "2026.01.22", storyId: "39" }]
    },
    {
        id: 40,
        name: "太原",
        lat: 37.8706,
        lng: 112.5489,
        year: 2026,
        season: "冬",
        description: "醋缸里的酸是活着的时间，铁轨上的锈是停了的时间。一座城同时走着两种时间。",
        color: "#795548",
        storiesList: [{ title: "酸和锈", date: "2026.02.12", storyId: "40" }]
    },
    {
        id: 41,
        name: "阳泉",
        lat: 37.8566,
        lng: 113.5804,
        year: 2026,
        season: "春",
        description: "矸石山自己烧自己，烧了几十年。老侯手背上的煤纹，也是火留的字。",
        color: "#8B7355",
        storiesList: [{ title: "烧不完的山", date: "2026.03.06", storyId: "41" }]
    },
    {
        id: 42,
        name: "井陉",
        lat: 38.0323,
        lng: 114.1442,
        year: 2026,
        season: "春",
        description: "手指伸进车辙，大半个手掌深。两千年的车轮，都走在同一道槽里。",
        color: "#5D4037",
        storiesList: [{ title: "车辙", date: "2026.03.28", storyId: "42" }]
    },
    {
        id: 43,
        name: "正定",
        lat: 38.1466,
        lng: 114.5708,
        year: 2026,
        season: "春",
        description: "太行在身后合上门，平原在眼前铺开。从这儿到北京，再没有一座山。",
        color: "#A1887F",
        storiesList: [{ title: "平原开始了", date: "2026.04.16", storyId: "43" }]
    },
    {
        id: 45,
        name: "北京·故宫外",
        lat: 39.9169,
        lng: 116.3907,
        year: 2026,
        season: "夏",
        description: "神武门外站了一上午，没进去。扫帚声还在，嚓，嚓，节拍没变；人不在了。",
        color: "#795548",
        storiesList: [{ title: "神武门外", date: "2026.05.26", storyId: "45" }]
    },
    {
        id: 46,
        name: "蓟州—玉田",
        lat: 39.9004,
        lng: 117.7386,
        year: 2026,
        season: "夏",
        description: "收割机身后那股金色的灰，落在胳膊上细细的痒。整个华北平原都在扬金子。",
        color: "#8B7355",
        storiesList: [{ title: "金色的灰", date: "2026.06.15", storyId: "46" }]
    },
    {
        id: 47,
        name: "山海关",
        lat: 40.0087,
        lng: 119.7736,
        year: 2026,
        season: "夏",
        description: "石道换了几茬，独轮车的辙早没了。可几条路还并排压在三千万人走出来的那条线上。",
        color: "#5D4037",
        storiesList: [{ title: "出关", date: "2026.07.12", storyId: "47" }]
    },
    {
        id: 48,
        name: "兴城",
        lat: 40.6167,
        lng: 120.7290,
        year: 2026,
        season: "冬",
        description: "城砖是明朝的，摸上去凉。大姨撬的海蛎子是今早的，冰碴里透着甜。",
        color: "#A1887F",
        storiesList: [{ title: "冬天的海", date: "2026.11.22", storyId: "48" }]
    },
    {
        id: 49,
        name: "沈阳·铁西",
        lat: 41.8020,
        lng: 123.3489,
        year: 2026,
        season: "冬",
        description: "老关的耳朵是一百多台机床用坏的。炉火退潮了，人没退。",
        color: "#795548",
        storiesList: [{ title: "锈带", date: "2026.12.20", storyId: "49" }]
    },
    {
        id: 50,
        name: "长春",
        lat: 43.8171,
        lng: 125.3235,
        year: 2027,
        season: "冬",
        description: "雪底下是黑的，栈子里是黄的。黑的几百年攒一厘米，黄的一年一茬。",
        color: "#8B7355",
        storiesList: [{ title: "黑土在雪底下", date: "2027.01.16", storyId: "50" }]
    },
    {
        id: 51,
        name: "哈尔滨·重访",
        lat: 45.7750,
        lng: 126.6300,
        year: 2027,
        season: "冬",
        description: "冰还在裂，还是那个调。递酒的话也还在，只是这回，是从我嘴里说出去的。",
        color: "#5D4037",
        storiesList: [{ title: "重上冰面", date: "2027.02.06", storyId: "51" }]
    },
    {
        id: 52,
        name: "佳木斯",
        lat: 46.7996,
        lng: 130.3189,
        year: 2027,
        season: "冬",
        description: "数杆子数到第七十三根，撞上了老于的双闪。平原的危险没有形状。",
        color: "#A1887F",
        storiesList: [{ title: "白毛风", date: "2027.03.08", storyId: "52" }]
    },
    {
        id: 53,
        name: "鹤岗",
        lat: 47.3320,
        lng: 130.2747,
        year: 2027,
        season: "春",
        description: "从雨崩到鹤岗，两年零一个月，木杖磨短了一拃多。线画完了。停笔。",
        color: "#4E342E",
        storiesList: [{ title: "对角线的另一头", date: "2027.04.16", storyId: "53" }]
    }
];

let travelMap = null;
let allMarkers = [];
let markersSmall = null;

// 分段索引：侧栏分组标题用（灵石 44 按地理顺序归入第五段）
const ROUTE_SEGMENTS = [
    { min: 1,  max: 11, name: "八年乘车（2018-2025）" },
    { min: 12, max: 17, name: "第一段 · 横断山" },
    { min: 18, max: 23, name: "第二段 · 攀西—大凉山" },
    { min: 24, max: 29, name: "第三段 · 川中丘陵" },
    { min: 30, max: 35, name: "第四段 · 秦巴—关中" },
    { min: 36, max: 44, name: "第五段 · 三晋—华北" },
    { min: 45, max: 47, name: "第六段 · 京畿—出关" },
    { min: 48, max: 53, name: "第七段 · 关东（终章）" }
];

function segmentOf(id) {
    return ROUTE_SEGMENTS.find(s => id >= s.min && id <= s.max);
}

function initTravelMap() {
    const mapContainer = document.getElementById('travel-map');
    if (!mapContainer) return;
    // Leaflet 加载失败时给出可见提示，不再静默留白
    if (typeof L === 'undefined') {
        mapContainer.innerHTML = '<p style="padding:40px 20px;text-align:center;color:var(--color-earth);">地图组件没加载出来，请刷新重试。</p>';
        return;
    }
    
    travelMap = L.map('travel-map', { zoomControl: false, attributionControl: false }).setView([35.8617, 104.1954], 4);
    
    // 必须使用 https，GitHub Pages 下 http 瓦片会被浏览器作为混合内容拦截
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: '1234', minZoom: 3, maxZoom: 12
    }).addTo(travelMap);
    
    L.control.zoom({ position: 'bottomright' }).addTo(travelMap);

    renderSidebarList();
    addTravelRoute();
    addLocationMarkers();
    addHereMarker();
    addLegend();

    // 初始视野：装下全部足迹，让整条对角线轨迹一眼可见；小屏收窄留白避免轨迹缩成一团
    const bounds = L.latLngBounds(travelLocations.map(loc => [loc.lat, loc.lng]));
    const fitAll = () => travelMap.fitBounds(bounds, { padding: fitPadding(), animate: false });
    fitAll();

    travelMap.on('zoomend', updateMarkerSizes);
    updateMarkerSizes();

    // 移动端关键修复：defer 脚本 + svh/字体布局未完成时，容器高度可能还是 0，
    // Leaflet 会按错误尺寸初始化且不自动纠正，表现为整块空白。
    // 布局稳定后重算尺寸并重新套入轨迹；同时覆盖地址栏收放、旋转、往返缓存等场景。
    const refresh = (shouldFit = false) => {
        if (!travelMap) return;
        travelMap.invalidateSize({ animate: false, debounceMoveend: true });
        if (shouldFit) fitAll();
    };

    // 首屏多时机兜底：rAF、load、延迟 350ms，确保 flex/svh/绝对定位布局完全稳定
    requestAnimationFrame(() => refresh(true));
    window.addEventListener('load', () => refresh(true));
    setTimeout(() => refresh(true), 350);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => refresh(true), 200);
    });
    window.addEventListener('orientationchange', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => refresh(true), 300);
    });
    window.addEventListener('pageshow', e => {
        if (e.persisted) refresh(true);
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => refresh(false), 150);
        });
    }
}

function fitPadding() {
    const p = window.innerWidth <= 900 ? 14 : 40;
    return [p, p];
}

function renderSidebarList() {
    const listContainer = document.getElementById('location-list');
    const countBadge = document.getElementById('location-count');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const walkCount = travelLocations.filter(loc => loc.id >= 12).length;
    countBadge.textContent = `共 ${travelLocations.length} 处足迹 · 徒步 ${walkCount} 处`;

    const sortedLocations = [...travelLocations].sort((a, b) => a.year - b.year);

    let lastSegment = null;
    sortedLocations.forEach(loc => {
        const segment = segmentOf(loc.id);
        if (segment && segment !== lastSegment) {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'location-group-title';
            groupTitle.textContent = segment.name;
            listContainer.appendChild(groupTitle);
            lastSegment = segment;
        }

        const item = document.createElement('div');
        item.className = 'location-item';
        item.id = `sidebar-item-${loc.id}`;
        item.innerHTML = `
            <span class="location-item-name">${loc.name}</span>
            <span class="location-item-date">${loc.year} · ${loc.season}</span>
            <div class="location-item-desc">${loc.description}</div>
        `;
        item.onclick = () => focusLocation(loc.id);
        listContainer.appendChild(item);
    });
}

// 两套图标：低缩放用小圆点（密集点位不遮轨迹），放大后换回带编号的大点
function buildMarkerIcon(location, small) {
    if (small) {
        const size = location.id >= 12 ? 10 : 14;
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="width:${size}px;height:${size}px;background:${location.color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2]
        });
    }
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:24px;height:24px;background:${location.color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">${location.id}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
}

function addLocationMarkers() {
    allMarkers = [];
    travelLocations.forEach(location => {
        const marker = L.marker([location.lat, location.lng], { icon: buildMarkerIcon(location, false) }).addTo(travelMap);
        // 窄屏下弹窗限宽，避免溢出地图画布
        marker.bindPopup(createPopupContent(location), { maxWidth: Math.min(300, window.innerWidth - 90) });
        marker.on('click', () => focusLocation(location.id));
        marker.locationData = location;
        allMarkers.push(marker);
    });
}

function updateMarkerSizes() {
    if (!travelMap) return;
    const small = travelMap.getZoom() < 6;
    if (small === markersSmall) return;
    markersSmall = small;
    allMarkers.forEach(marker => marker.setIcon(buildMarkerIcon(marker.locationData, small)));
}

// 终点：对角线收尾处的脉冲标记
function addHereMarker() {
    const latest = travelLocations.reduce((a, b) => (b.id > a.id ? b : a));
    const hereIcon = L.divIcon({
        className: 'here-marker',
        html: `<div class="here-pulse"></div><div class="here-label">终点 · 鹤岗</div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
    L.marker([latest.lat, latest.lng], { icon: hereIcon, interactive: false, zIndexOffset: -100, keyboard: false }).addTo(travelMap);
}

function addLegend() {
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <div><span class="legend-line legend-dashed"></span>乘车旧路（2018-2025）</div>
            <div><span class="legend-line legend-solid"></span>徒步对角线（2025.03-2027.04）</div>
            <div><span class="legend-dot"></span>终点 · 鹤岗</div>
        `;
        return div;
    };
    legend.addTo(travelMap);
}

function createPopupContent(location) {
    const storiesHTML = location.storiesList.map(story => {
        if (story.storyId) {
            return `<li><a href="story.html?id=${story.storyId}" style="color:var(--color-accent);text-decoration:none;">${story.title}</a></li>`;
        } else {
            return `<li style="color:var(--color-earth); opacity:0.7;">${story.title}</li>`;
        }
    }).join('');
    
    return `
        <div style="font-family:var(--font-serif);padding:5px;">
            <h3 style="margin:0 0 10px 0;color:var(--color-dark-earth);border-bottom:1px solid var(--color-border);padding-bottom:5px;">${location.name}</h3>
            <p style="font-size:0.9rem;margin-bottom:10px;line-height:1.5;">${location.description}</p>
            <ul style="margin:0;padding-left:15px;font-size:0.85rem;line-height:1.6;">${storiesHTML}</ul>
        </div>
    `;
}

function focusLocation(locationId) {
    const location = travelLocations.find(l => l.id === locationId);
    if (!location || !travelMap) return;

    travelMap.flyTo([location.lat, location.lng], 7, { duration: 1.2 });

    document.querySelectorAll('.location-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.getElementById(`sidebar-item-${locationId}`);
    if (sidebarItem) {
        sidebarItem.classList.add('active');
        sidebarItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setTimeout(() => {
        travelMap.eachLayer(layer => {
            if (layer.locationData && layer.locationData.id === locationId) {
                layer.openPopup();
            }
        });
    }, 1300);
}

function addTravelRoute() {
    // 拷贝后排序，避免修改原数组；同年份的点保持数组书写顺序（稳定排序）
    // SVG 属性不支持 CSS 变量，需使用具体色值
    const sorted = [...travelLocations].sort((a, b) => a.year - b.year);
    const vehiclePoints = sorted.filter(loc => loc.id <= 11).map(loc => [loc.lat, loc.lng]);
    const walkPoints = sorted.filter(loc => loc.id >= 12).map(loc => [loc.lat, loc.lng]);

    // 乘车岁月（ID 1-11）：乘车/飞行轨迹，淡虚线，不和徒步线抢眼
    L.polyline(vehiclePoints, { color: '#795548', weight: 2, opacity: 0.35, dashArray: '5, 10' }).addTo(travelMap);

    // 徒步（ID ≥ 12）：对角线，从雨崩（乘车岁月的终点）起笔
    // 三层叠画：宽底衬压出轮廓 + 实线主体 + 流动虚线模拟脚步前进
    if (walkPoints.length) {
        const pivot = travelLocations.find(loc => loc.id === 11);
        const walkLine = pivot ? [[pivot.lat, pivot.lng], ...walkPoints] : walkPoints;
        L.polyline(walkLine, { color: '#BF360C', weight: 8, opacity: 0.15, lineCap: 'round', interactive: false }).addTo(travelMap);
        L.polyline(walkLine, { color: '#BF360C', weight: 3, opacity: 0.9 }).addTo(travelMap);
        L.polyline(walkLine, { color: '#FFF8E1', weight: 1.5, opacity: 0.95, className: 'walk-flow', interactive: false }).addTo(travelMap);
    }
}

function showAllLocations() {
    if (travelMap) {
        const bounds = L.latLngBounds(travelLocations.map(loc => [loc.lat, loc.lng]));
        travelMap.fitBounds(bounds, { padding: fitPadding() });
        document.querySelectorAll('.location-item').forEach(el => el.classList.remove('active'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('travel-map')) {
        setTimeout(initTravelMap, 100);
    }
});
