/* script.js — 《三体 · 给岁月以文明》舞台剧剧本数据（剧本即演出） */
'use strict';

const PLAY = {
  title: '三体 · 给岁月以文明',
  subtitle: 'NDS 像素舞台剧',

  characters: {
    ye:     { name: '叶文洁',       color: '#ffd25a' },
    monk:   { name: '1379号监听员', color: '#7ae0c8' },
    wang:   { name: '汪淼',         color: '#7ab8f0' },
    shen:   { name: '申玉菲',       color: '#c89ae0' },
    chang:  { name: '常伟思',       color: '#b8c0c8' },
    luoji:  { name: '罗辑',         color: '#7ae08a' },
    po:     { name: '破壁人',       color: '#e06868' },
    cheng:  { name: '程心',         color: '#ffb0d0' },
    tri:    { name: '三体统帅',     color: '#e09040' },
    zero:   { name: '归零者',       color: '#e8e8ff' }
  },

  scenes: [
    {
      id: 'prologue', act: '序幕', no: '第1场', title: '红岸基地',
      bg: 'redcoast', bgm: 'redcoast',
      cues: [
        { k: 'title', text: '序幕 · 红岸', sub: '公元1969年 · 大兴安岭 · 雷达峰' },
        { k: 'nar', text: '大兴安岭深处的雷达峰。红岸基地的巨型天线对准夜空，像一只向宇宙张开的手。' },
        { k: 'enter', who: 'ye', x: 82, style: 'young' },
        { k: 'sfx', sfx: 'tick' },
        { k: 'line', who: 'ye', text: '爸……你看见了吗。头顶的每一颗星星，都可能是另一个世界。', port: 'scarf' },
        { k: 'nar', text: '她曾是天体物理的研究生。如今，她是红岸基地的监听员。' },
        { k: 'line', who: 'ye', text: '红岸的使命是聆听宇宙。可是为什么，我们不许向宇宙说话？', port: 'scarf' },
        { k: 'dir', text: '深夜。她绕过最高禁令，把人类的信号射向太阳。' },
        { k: 'fx', id: 'wave', cx: 150, cy: 104, dur: 2600, sfx: 'static' },
        { k: 'line', who: 'ye', text: '太阳，请替我传话。请把人类的声音，送到银河的另一端。', port: 'scarf' },
        { k: 'sfx', sfx: 'send' },
        { k: 'fx', id: 'wave', cx: 150, cy: 104, dur: 3200 },
        { k: 'nar', text: '电波穿过日冕层，被太阳放大了一亿倍，飞向四光年外的半人马座。' }
      ]
    },
    {
      id: 'a1', act: '第一幕', no: '第2场', title: '乱纪元',
      bg: 'trisolaris', bgm: 'trisolaris',
      cues: [
        { k: 'title', text: '第一幕 · 乱纪元', sub: '三体世界 · 三颗太阳共舞' },
        { k: 'nar', text: '三体世界。三颗太阳在混乱的轨道上共舞，文明在恒纪元与乱纪元之间脱水、复活。' },
        { k: 'enter', who: 'monk', x: 96 },
        { k: 'line', who: 'monk', text: '我是1379号监听员。我的眼前，是即将燃尽的太阳，和濒临崩溃的文明。' },
        { k: 'nar', text: '监听站捕获了一束来自太阳系的电波——人类的第一声啼鸣。' },
        { k: 'line', who: 'monk', text: '不要回答！不要回答！不要回答！暴露坐标，就是引来毁灭！' },
        { k: 'line', who: 'ye', text: '……不要回答。', port: 'long' },
        { k: 'nar', text: '但四光年外，她按下了回复键。文明的位置，已经无法撤回。' },
        { k: 'fx', id: 'flash', col: '#ff4020', dur: 1200, sfx: 'thunder' },
        { k: 'line', who: 'monk', text: '脱水吧，我的同胞。我们将以舰队的方式，向地球远征。' },
        { k: 'nar', text: '三体舰队启航。四百五十年后，它将抵达太阳系。' },
        { k: 'dir', text: '智子工程同时启动：一颗质子将被展开成二维，蚀刻成智能。' }
      ]
    },
    {
      id: 'a2', act: '第二幕', no: '第3场', title: '智子 · 宇宙闪烁',
      bg: 'sophon', bgm: 'dark',
      cues: [
        { k: 'title', text: '第二幕 · 智子', sub: '地球 · 危机纪元' },
        { k: 'enter', who: 'wang', x: 76 },
        { k: 'line', who: 'wang', text: '我是纳米科学家汪淼。倒计时突然出现在我的视网膜上，挥之不去。' },
        { k: 'enter', who: 'shen', x: 168 },
        { k: 'line', who: 'shen', text: '汪教授，物理学还存在吗？如果实验再无结果，人类将失去未来。' },
        { k: 'line', who: 'wang', text: '申小姐，你在威胁我？' },
        { k: 'line', who: 'shen', text: '是智子在威胁我们。它已经抵达地球，封锁了人类物理。' },
        { k: 'fx', id: 'unfold', dur: 3600, sfx: 'unfold' },
        { k: 'exit', who: 'shen' },
        { k: 'enter', who: 'chang', x: 190 },
        { k: 'line', who: 'chang', text: '那不是天象。质子把整个星空，变成了它的显示屏。' },
        { k: 'fx', id: 'flicker', dur: 3000 },
        { k: 'nar', text: '宇宙闪烁：夜空的一角，像坏掉的屏幕一样明灭不定。' },
        { k: 'line', who: 'chang', text: '我是常伟思。红岸之后，我们追查到一个组织——地球三体运动。' }
      ]
    },
    {
      id: 'a3', act: '第二幕', no: '第4场', title: '古筝行动',
      bg: 'canal', bgm: 'dark',
      cues: [
        { k: 'title', text: '古筝行动', sub: '巴拿马运河 · 审判日号' },
        { k: 'nar', text: 'ETO 的情报装在一艘船上。纳米丝横在河面上，比琴弦还要细。' },
        { k: 'enter', who: 'chang', x: 70 },
        { k: 'line', who: 'chang', text: '行动代号：古筝。汪淼的纳米丝，会把那艘船切成薄片。' },
        { k: 'dir', text: '"审判日"号驶入运河。月色之下，琴弦无声。' },
        { k: 'fx', id: 'cut', dur: 4200, sfx: 'boom' },
        { k: 'nar', text: '弦切过钢铁，像切过豆腐。五十层船体错位滑落，没有一声枪响。' },
        { k: 'enter', who: 'ye', x: 200, style: 'old' },
        { k: 'line', who: 'ye', text: '我告诉三体人：来拯救我们，或者毁灭我们。', port: 'long' }
      ]
    },
    {
      id: 'a4', act: '第三幕', no: '第5场', title: '面壁者',
      bg: 'deterrence', bgm: 'dark',
      cues: [
        { k: 'title', text: '第三幕 · 面壁计划', sub: '危机纪元 · 行星防御理事会' },
        { k: 'enter', who: 'luoji', x: 86 },
        { k: 'line', who: 'luoji', text: '我叫罗辑，一个靠写小说混日子的。你们确定没找错人？' },
        { k: 'enter', who: 'po', x: 182 },
        { k: 'line', who: 'po', text: '罗辑先生，你被选为第四位面壁者。你的思想，是人类的武器。' },
        { k: 'line', who: 'luoji', text: '我不当救世主。我只想找个人，找个地方，安安静静过一辈子。' },
        { k: 'dir', text: '雪山与湖畔。罗辑找到了庄颜，也找到了自己的软肋。' },
        { k: 'bg', id: 'snow' },
        { k: 'line', who: 'luoji', text: '给岁月以文明——这是我给自己写的墓志铭。' },
        { k: 'bg', id: 'fleet' },
        { k: 'fx', id: 'droplet', dur: 4200, sfx: 'droplet' },
        { k: 'line', who: 'luoji', text: '两千艘战舰，在一颗水滴面前灰飞烟灭。' },
        { k: 'sfx', sfx: 'boom' },
        { k: 'nar', text: '罗辑终于明白：威慑，是人类唯一的武器。' }
      ]
    },
    {
      id: 'a5', act: '第三幕', no: '第6场', title: '威慑纪元',
      bg: 'deterrence', bgm: 'dark',
      cues: [
        { k: 'title', text: '威慑纪元', sub: '罗辑 · 执剑人' },
        { k: 'enter', who: 'luoji', x: 96 },
        { k: 'line', who: 'luoji', text: '我把核弹链埋进了太阳。它们对准的，是死神本身。' },
        { k: 'fx', id: 'countdown', dur: 4200, sfx: 'count' },
        { k: 'line', who: 'luoji', text: '我，是执剑人。我与三体文明，同归于尽。' },
        { k: 'nar', text: '半个世纪。罗辑一个人，握着两个文明的生死。' },
        { k: 'title', text: '威慑纪元 · 交接', sub: '人类选择了程心' },
        { k: 'enter', who: 'cheng', x: 118 },
        { k: 'line', who: 'cheng', text: '我是程心……他们把按钮，交到了我的手上。' },
        { k: 'enter', who: 'tri', x: 200 },
        { k: 'sfx', sfx: 'warn' },
        { k: 'line', who: 'tri', text: '威慑失败。引力波天线，将在二十四小时内被摧毁。' },
        { k: 'line', who: 'cheng', text: '我做不到……我不能让人类为我陪葬。' }
      ]
    },
    {
      id: 'a6', act: '第四幕', no: '第7场', title: '黑暗森林',
      bg: 'earth', bgm: 'void',
      cues: [
        { k: 'title', text: '第四幕 · 黑暗森林', sub: '宇宙是一座狩猎场' },
        { k: 'nar', text: '蓝色空间号与万有引力号，在深空中启动了引力波天线。' },
        { k: 'enter', who: 'zero', x: 128 },
        { k: 'line', who: 'zero', text: '坐标已确认：三体星系，与太阳系。广播开始。' },
        { k: 'fx', id: 'broadcast', dur: 3600, sfx: 'chime' },
        { k: 'line', who: 'zero', text: '黑暗森林打击随即而至。二向箔，正在展开。' },
        { k: 'bg', id: 'solarflat' },
        { k: 'fx', id: 'flatten', dur: 5200, sfx: 'unfold' },
        { k: 'nar', text: '太阳系正在变成一幅画。所有文明，都只是画布上的色块。' },
        { k: 'line', who: 'luoji', text: '给岁月以文明，而不是给文明以岁月。', port: 'flat' },
        { k: 'line', who: 'luoji', text: '留下纪念碑吧。让后来者知道，曾有一种文明，仰望过星空。', port: 'flat' }
      ]
    },
    {
      id: 'a7', act: '尾声', no: '第8场', title: '星舰人类',
      bg: 'starship', bgm: 'hope',
      cues: [
        { k: 'title', text: '尾声 · 星舰人类', sub: '数百年后 · 深空' },
        { k: 'nar', text: '人类与三体人的后裔，在同一艘星舰上，继续着漫长的航程。' },
        { k: 'line', who: 'zero', text: '宇宙很大，生活更大。我们一定会在某个角落，再见面。' },
        { k: 'sfx', sfx: 'bow' },
        { k: 'dir', text: '全体演员谢幕。' },
        { k: 'bg', id: 'credits' },
        { k: 'nar', text: '——《三体 · 给岁月以文明》像素舞台剧 · 全剧终' },
        { k: 'nar', text: '愿每一个文明，都被温柔以待。' },
        { k: 'end' }
      ]
    }
  ]
};
