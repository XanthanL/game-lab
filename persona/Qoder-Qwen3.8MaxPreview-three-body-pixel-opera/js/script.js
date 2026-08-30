/* === 三体 NDS像素舞台剧 - 剧本数据 === */

const SCRIPT = {
    meta: {
        title: '三体',
        subtitle: 'NDS PIXEL STAGE PLAY',
        author: '基于刘慈欣《三体》改编',
        acts: 4
    },

    // 序章
    prologue: {
        title: '序 章',
        subtitle: '寂静的春天',
        bgm: 'title',
        scenes: [
            {
                type: 'narration',
                bg: 'space',
                text: '宇宙很大，生活更大。',
                sfx: 'cosmic'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '但在黑暗森林中，\n每一个文明都是带枪的猎人。'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '这是一个关于人类\n第一次仰望星空的故事——',
                sfx: 'signal'
            },
            {
                type: 'narration',
                bg: 'earth',
                text: '也是一个关于回答的故事。\n一个改变了一切的回答。'
            }
        ]
    },

    // 第一幕：红岸
    act1: {
        title: '第一幕',
        subtitle: '红岸基地 · 1969',
        bgm: 'redcoast',
        scenes: [
            {
                type: 'narration',
                bg: 'redcoast',
                text: '大兴安岭，红岸基地。\n一座巨大的天线指向苍穹。',
                sfx: 'transition'
            },
            {
                type: 'dialogue',
                bg: 'redcoast',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'normal',
                text: '太阳是一个电波放大器……\n如果利用太阳作为天线，\n我们的信号可以到达更远的地方。'
            },
            {
                type: 'dialogue',
                bg: 'lab',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'determined',
                text: '计算完成了。\n增益系数远超预期。\n这不仅仅是理论——它可以实现。'
            },
            {
                type: 'narration',
                bg: 'redcoast_night',
                text: '深夜。叶文洁独自站在控制台前。\n她的手指悬在发射键上方。',
                sfx: 'alarm'
            },
            {
                type: 'dialogue',
                bg: 'redcoast_night',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'determined',
                text: '向宇宙发出信号……\n如果那里有文明存在，\n他们会听到我们的声音。'
            },
            {
                type: 'dialogue',
                bg: 'redcoast_night',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'sad',
                text: '这个世界已经疯了。\n也许……外面的世界会不同。',
                sfx: 'signal'
            },
            {
                type: 'narration',
                bg: 'redcoast_night',
                text: '她按下了发射键。\n一道无形的电波，以光速飞向深空。',
                effect: 'signal_wave'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '八年。\n信号在宇宙中旅行了八年。',
                sfx: 'cosmic'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '然后——\n它被听到了。',
                effect: 'signal_wave',
                sfx: 'signal'
            },
            {
                type: 'dialogue',
                bg: 'lab',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'normal',
                text: '这……这是回复信号！\n来自半人马座α星！\n天哪，他们真的存在！'
            },
            {
                type: 'narration',
                bg: 'lab',
                text: '屏幕上，一行行文字缓缓显现——\n来自四光年外的警告：',
                sfx: 'dramatic'
            },
            {
                type: 'dialogue',
                bg: 'lab',
                speaker: '???（三体世界）',
                char: 'trisolara',
                emotion: 'normal',
                text: '不要回答！\n不要回答！\n不要回答！'
            },
            {
                type: 'narration',
                bg: 'lab',
                text: '警告重复了三次。\n那个世界的和平主义者，\n冒着生命危险发来了这条消息。'
            },
            {
                type: 'dialogue',
                bg: 'lab',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'determined',
                text: '……',
            },
            {
                type: 'choice',
                bg: 'lab',
                speaker: '叶文洁',
                char: 'yewenjie',
                text: '叶文洁凝视着屏幕。\n她的手再次伸向了发射键——',
                choices: [
                    { text: '▶ 回答他们', next: 'reply' },
                    { text: '▶ 保持沉默', next: 'silence' }
                ]
            },
            {
                type: 'dialogue',
                bg: 'redcoast_night',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'determined',
                text: '到这里来吧，我将帮助你们\n获得这个世界。\n\n——她发出了回答。',
                id: 'reply',
                sfx: 'dramatic'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '这一刻，人类的命运被改写了。\n一个文明的邀请函，\n飞向了四光年外的三体世界。',
                id: 'silence',
                sfx: 'cosmic'
            }
        ]
    },

    // 第二幕：三体游戏
    act2: {
        title: '第二幕',
        subtitle: '三体游戏 · 2007',
        bgm: 'game',
        scenes: [
            {
                type: 'narration',
                bg: 'city',
                text: '三十八年后。北京。\n纳米材料研究员汪淼，\n被卷入了一场离奇的事件。',
                sfx: 'transition'
            },
            {
                type: 'dialogue',
                bg: 'city',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '倒计时……我的眼睛里\n出现了一个倒计时。\n只有我能看见。'
            },
            {
                type: 'dialogue',
                bg: 'lab',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '1200小时……1199……\n它在不断减少。\n这到底意味着什么？'
            },
            {
                type: 'narration',
                bg: 'lab',
                text: '为了寻找答案，汪淼进入了\n一个神秘的VR游戏——《三体》。',
                sfx: 'signal'
            },
            {
                type: 'narration',
                bg: 'game_world',
                text: '游戏世界。\n一片荒芜的大地，\n天空中有三个太阳。',
                sfx: 'cosmic'
            },
            {
                type: 'dialogue',
                bg: 'game_world',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '三个太阳……\n这就是三体问题。\n三颗恒星的引力混沌运动。'
            },
            {
                type: 'dialogue',
                bg: 'game_world',
                speaker: '科学家（NPC）',
                char: 'scientist',
                emotion: 'normal',
                text: '当三颗太阳同时出现——\n"三日连珠"——\n我们的文明就会被毁灭。'
            },
            {
                type: 'dialogue',
                bg: 'game_world',
                speaker: '科学家（NPC）',
                char: 'scientist',
                emotion: 'normal',
                text: '恒纪元，我们发展文明。\n乱纪元，我们脱水保存自己。\n这就是三体世界的生存法则。'
            },
            {
                type: 'narration',
                bg: 'game_world',
                text: '汪淼目睹了文明的诞生与毁灭，\n一次又一次。\n三体人已经历了两百多次轮回。',
                effect: 'fire'
            },
            {
                type: 'dialogue',
                bg: 'trisolara',
                speaker: '三体文明',
                char: 'trisolara',
                emotion: 'normal',
                text: '我们的世界没有未来。\n三颗太阳的混沌运动\n永远无法预测。'
            },
            {
                type: 'dialogue',
                bg: 'trisolara',
                speaker: '三体文明',
                char: 'trisolara',
                emotion: 'normal',
                text: '唯一的出路——\n是找到一个新的家园。\n一个拥有稳定恒星的世界。',
                sfx: 'dramatic'
            },
            {
                type: 'dialogue',
                bg: 'trisolara',
                speaker: '三体文明',
                char: 'trisolara',
                emotion: 'normal',
                text: '四光年外，有一颗蓝色星球。\n那里有且仅有一颗太阳。\n那里，就是我们的应许之地。'
            },
            {
                type: 'narration',
                bg: 'fleet',
                text: '三体第一舰队启航了。\n一千艘星际战舰，\n以百分之一光速驶向地球。',
                sfx: 'cosmic'
            },
            {
                type: 'narration',
                bg: 'fleet',
                text: '到达时间：四百五十年。'
            }
        ]
    },

    // 第三幕：黑暗森林
    act3: {
        title: '第三幕',
        subtitle: '黑暗森林',
        bgm: 'truth',
        scenes: [
            {
                type: 'narration',
                bg: 'dark_forest',
                text: '宇宙社会学。\n两条公理，两个概念，\n推导出一个冰冷的真相。',
                sfx: 'cosmic'
            },
            {
                type: 'dialogue',
                bg: 'dark_forest',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '第一公理：\n生存是文明的第一需要。'
            },
            {
                type: 'dialogue',
                bg: 'dark_forest',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '第二公理：\n文明不断增长和扩张，\n但宇宙中的物质总量不变。'
            },
            {
                type: 'dialogue',
                bg: 'dark_forest',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '加上"猜疑链"和"技术爆炸"……\n结论只有一个——'
            },
            {
                type: 'narration',
                bg: 'dark_forest',
                text: '宇宙就是一座黑暗森林。\n每个文明都是带枪的猎人，\n在林间幽灵般潜行。',
                sfx: 'dramatic'
            },
            {
                type: 'narration',
                bg: 'dark_forest',
                text: '如果他发现了别的生命，\n能做的只有一件事——\n开枪消灭之。'
            },
            {
                type: 'narration',
                bg: 'dark_forest',
                text: '在这片森林中，\n他人就是地狱，\n就是永恒的威胁。',
                sfx: 'alarm'
            },
            {
                type: 'dialogue',
                bg: 'earth',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '所以叶文洁的回答……\n不仅仅是暴露了地球的位置。\n她向整个黑暗森林喊了一声。'
            },
            {
                type: 'dialogue',
                bg: 'earth',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '而三体人，是第一个\n循声而来的猎人。'
            },
            {
                type: 'narration',
                bg: 'fleet',
                text: '舰队仍在航行。\n还有四百年。\n但智子已经到达——\n人类的科学，已被锁死。',
                sfx: 'signal'
            }
        ]
    },

    // 终章
    epilogue: {
        title: '终 章',
        subtitle: '面壁者',
        bgm: 'finale',
        scenes: [
            {
                type: 'narration',
                bg: 'earth',
                text: '面对不可战胜的敌人，\n人类启动了最后的计划——\n"面壁计划"。',
                sfx: 'transition'
            },
            {
                type: 'narration',
                bg: 'earth',
                text: '四位面壁者，\n将在自己的思维中\n构建对抗三体的战略。'
            },
            {
                type: 'dialogue',
                bg: 'earth',
                speaker: '汪淼',
                char: 'wangmiao',
                emotion: 'normal',
                text: '智子可以监控一切，\n但有一样东西它无法窥探——\n人类的思维。'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '四百年。\n人类还有四百年的时间。',
                sfx: 'cosmic'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '这是绝望，\n也是希望。'
            },
            {
                type: 'dialogue',
                bg: 'space',
                speaker: '叶文洁',
                char: 'yewenjie',
                emotion: 'sad',
                text: '我点燃了火，\n却不知它将烧向何方。\n\n……对不起。'
            },
            {
                type: 'narration',
                bg: 'dark_forest',
                text: '黑暗森林中，\n猎人们仍在潜行。\n而地球，这粒微小的尘埃，\n正在学习如何在黑暗中生存。',
                sfx: 'cosmic'
            },
            {
                type: 'narration',
                bg: 'space',
                text: '— 全 剧 终 —\n\n「三体」NDS像素舞台剧\n基于刘慈欣同名小说改编'
            }
        ]
    }
};
