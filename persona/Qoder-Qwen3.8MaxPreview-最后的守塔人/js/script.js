/**
 * 最后的守塔人 - 剧本数据
 * 一部像素风动画舞台剧
 * 
 * 故事：老灯塔看守人陈守光在灯塔自动化改造前的最后一夜，
 * 回忆四十年守塔岁月，与大海告别。
 */

const SCRIPT = {
    title: "最后的守塔人",
    subtitle: "THE LAST LIGHTHOUSE KEEPER",
    
    // 角色定义
    characters: {
        narrator: { name: "", color: "#8899aa" },
        keeper: { name: "陈守光", color: "#ffd700" },
        sea: { name: "海", color: "#66bbdd" },
        memory: { name: "回忆", color: "#ddaaff" },
        radio: { name: "电台", color: "#88ee88" }
    },

    // 幕次
    acts: [
        {
            id: 1,
            number: "第一幕",
            name: "黄昏·最后一班岗",
            scene: "sunset",
            lines: [
                { speaker: "narrator", text: "东海之滨，孤岬角上，白岩灯塔已守望了整整一百年。", action: "pan_slow" },
                { speaker: "narrator", text: "而今晚，是守塔人陈守光在这里的最后一夜。", action: "fade_in_keeper" },
                { speaker: "keeper", text: "……四十年了啊。", action: "keeper_sigh" },
                { speaker: "keeper", text: "明天他们就会装上自动系统，这灯，再也不需要人守了。", action: "look_up" },
                { speaker: "narrator", text: "他缓缓登上灯塔的一百二十八级台阶，像过去一万四千多个夜晚一样。", action: "climb" },
                { speaker: "keeper", text: "老伙计，今晚我最后一次给你点灯。", action: "touch_lamp" },
                { speaker: "narrator", text: "灯塔亮了。光柱划过暮色，如同四十年来每一个黄昏。", action: "light_on" },
                { speaker: "sea", text: "……呜…………", action: "wave_sound" },
                { speaker: "keeper", text: "你也在跟我道别吗，老海？", action: "look_sea" }
            ]
        },
        {
            id: 2,
            number: "第二幕",
            name: "风暴·旧日重现",
            scene: "storm",
            lines: [
                { speaker: "narrator", text: "入夜，风骤然紧了。乌云吞没了最后一丝晚霞。", action: "darken" },
                { speaker: "narrator", text: "浪头一个接一个砸向礁石，像是大海压抑了许久的怒吼。", action: "waves_intense" },
                { speaker: "keeper", text: "这风……跟八三年那场台风，一模一样。", action: "grip_rail" },
                { speaker: "narrator", text: "那一夜，他二十七岁，刚来灯塔不到三年。", action: "flashback_start" },
                { speaker: "memory", text: "「这里是白岩灯塔！这里是白岩灯塔！有渔船在东北礁搁浅——」", action: "radio_static" },
                { speaker: "keeper", text: "我记得那晚的浪，比塔顶还高。", action: "memory_wave" },
                { speaker: "keeper", text: "我把灯芯拧到最亮，手抖得几乎握不住扳手。", action: "memory_hands" },
                { speaker: "narrator", text: "那一夜，十七艘渔船循着光回了港。三个人没能回来。", action: "memory_fade" },
                { speaker: "keeper", text: "从那以后我就知道了——这灯，不是点的，是命换的。", action: "determine" },
                { speaker: "narrator", text: "闪电撕裂夜空，将老人的影子拉得很长很长。", action: "lightning" }
            ]
        },
        {
            id: 3,
            number: "第三幕",
            name: "长夜·与海书",
            scene: "night",
            lines: [
                { speaker: "narrator", text: "风暴渐远。海面重归沉默，只剩潮汐的低语。", action: "calm" },
                { speaker: "keeper", text: "他们说我守了一辈子灯，可我觉得，是灯守了我一辈子。", action: "sit_down" },
                { speaker: "keeper", text: "妻子走的那年，我差点也走了。是这灯把我拽回来的。", action: "look_lamp" },
                { speaker: "narrator", text: "他从口袋里摸出一封泛黄的信，借着灯光又读了一遍。", action: "letter" },
                { speaker: "memory", text: "「守光，灯亮着，我就知道你平安。别惦记家里，海比我温柔。」", action: "letter_read" },
                { speaker: "keeper", text: "……你骗人。海哪有你温柔。", action: "smile_sad" },
                { speaker: "narrator", text: "他将信折好，放回贴近心口的口袋。", action: "letter_keep" },
                { speaker: "sea", text: "……哗……哗……", action: "gentle_waves" },
                { speaker: "keeper", text: "好了好了，不说了。再说下去，我这老脸可挂不住了。", action: "wipe_eye" },
                { speaker: "narrator", text: "灯塔的光一圈一圈转着，像时间本身在呼吸。", action: "light_rotate" }
            ]
        },
        {
            id: 4,
            number: "第四幕",
            name: "黎明·交接",
            scene: "dawn",
            lines: [
                { speaker: "narrator", text: "天边泛起鱼肚白。最后一颗星沉入了海平线。", action: "dawn_break" },
                { speaker: "narrator", text: "远处，一艘小艇正朝岬角驶来。那是来接他回陆地上的人。", action: "boat_appear" },
                { speaker: "radio", text: "「白岩灯塔，这里是港务局。交接船已到，陈师傅，辛苦了。」", action: "radio_call" },
                { speaker: "keeper", text: "收到。我这就下去。", action: "radio_reply" },
                { speaker: "narrator", text: "他最后环视了一圈灯室。铜器、透镜、被海风蚀刻的墙壁。", action: "look_around" },
                { speaker: "keeper", text: "老伙计……以后你自己照顾自己了。", action: "farewell" },
                { speaker: "narrator", text: "他关上了灯室的门。一百二十八级台阶，他一步一步走下去。", action: "descend" },
                { speaker: "narrator", text: "身后，灯塔的自动系统第一次亮起——不需要任何人。", action: "auto_light" },
                { speaker: "keeper", text: "……亮得倒挺准时。", action: "last_look" },
                { speaker: "narrator", text: "小艇离岸。老人没有回头。", action: "boat_leave" },
                { speaker: "narrator", text: "但海风里，似乎有人听见他哼起了一首很旧很旧的歌。", action: "hum" },
                { speaker: "narrator", text: "白岩灯塔依旧矗立。光依旧亮着。只是再没有人，在塔顶等天亮了。", action: "final" }
            ]
        }
    ],

    // 尾声
    epilogue: {
        text: "献给所有在无人处守望的人",
        subtext: "— 全剧终 —"
    }
};
