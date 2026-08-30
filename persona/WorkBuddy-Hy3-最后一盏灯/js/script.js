'use strict';
/* ═══════════════════════════════════════════════
   《最后一盏灯》—— 剧本（数据即剧本）
   演出引擎直接读取本文件驱动整场演出
   lines:  who=角色  dir=舞台指示  fx=音效  overlay=上屏大字
   ═══════════════════════════════════════════════ */
const PLAY = {
  title: '最后一盏灯',
  subtitle: '像 素 舞 台 剧',
  credit: '编剧 / 演出：WorkBuddy (Hy3)  ·  从剧本到演出，全部由前端实现',

  acts: [
    {
      key: 'prologue', no: '序幕', name: '熄灭的城市', dur: 24,
      lines: [
        { who: '舞台指示', dir: 1, text: '夜。一座小城。所有的路灯都熄了，像合上的眼。' },
        { who: '旁白', text: '电的光太亮，于是没有人再记得，火的光是什么样子。', fx: 'step' },
        { who: '舞台指示', dir: 1, text: '一个提着空灯的老者，从巷口走来。他是这座城最后的点灯人。' },
        { who: '点灯人', text: '今晚，还有一盏，要我点亮。' },
        { who: '旁白', text: '他是全城唯一，还在与黑暗说话的人。', overlay: '最后一盏灯', overlayColor: '#ffe9a8' },
      ],
    },
    {
      key: 'light', no: '第一幕', name: '点灯人', dur: 30,
      lines: [
        { who: '舞台指示', dir: 1, text: '他停在街角那根锈了的灯杆下，划亮一根火柴。', fx: 'match' },
        { who: '点灯人', text: '火苗认得我。每年这个夜晚，它都还醒着。', fx: 'light' },
        { who: '舞台指示', dir: 1, text: '玻璃罩里，暖黄的光一点点升起来，在地上铺开一圈温柔。' },
        { who: '旁白', text: '那圈光，像一句很久没说出口的晚安。' },
        { who: '舞台指示', dir: 1, text: '暗处，一双小眼睛亮了一下——是个孩子，正偷偷望着这盏灯。', overlay: '火，认得他', overlayColor: '#ffcaa0' },
      ],
    },
    {
      key: 'follow', no: '第二幕', name: '跟随', dur: 32,
      lines: [
        { who: '舞台指示', dir: 1, text: '点灯人提着灯往前走，孩子不远不近地跟在后面。' },
        { who: '孩子', text: '老爷爷，你为什么不把所有的灯都点亮？' },
        { who: '点灯人', text: '点亮一盏，要好多年。点亮所有，要好几辈子。', fx: 'step' },
        { who: '舞台指示', dir: 1, text: '风穿过空荡的街，吹得灯影摇晃。孩子的影子被拉得很长。' },
        { who: '孩子', text: '那……这盏灯，会一直亮着吗？' },
        { who: '点灯人', text: '只要还有人愿意看着它，它就一直亮着。' },
      ],
    },
    {
      key: 'under', no: '第三幕', name: '灯下', dur: 34,
      lines: [
        { who: '舞台指示', dir: 1, text: '他们坐在灯下。光把两人的影子，叠在了一起。', fx: 'memory' },
        { who: '点灯人', text: '我父亲，是这座城第一个点灯人。他走的那晚，把这盏留给了我。' },
        { who: '孩子', text: '他走的时候，灯还亮着吗？' },
        { who: '点灯人', text: '亮着。他说，灯灭了，路才真的黑。', overlay: '灯灭了，路才真的黑', overlayColor: '#ffe9a8' },
        { who: '舞台指示', dir: 1, text: '孩子把小手凑近焰心，像在接住一小片会呼吸的太阳。' },
        { who: '孩子', text: '爷爷，我好像，有点懂了。' },
      ],
    },
    {
      key: 'wind', no: '第四幕', name: '风', dur: 32,
      lines: [
        { who: '舞台指示', dir: 1, text: '夜忽然起了大风。灯焰被压得几乎贴到玻璃上。', fx: 'wind' },
        { who: '旁白', text: '风想吹灭它。可它不想走。', fx: 'flicker' },
        { who: '舞台指示', dir: 1, text: '孩子张开手臂，把自己变成一面小小的墙，挡在灯前。', fx: 'rain' },
        { who: '点灯人', text: '傻孩子，风大，你挡不住的。' },
        { who: '孩子', text: '可我挡得住一会儿——就一会儿。', fx: 'shield' },
        { who: '舞台指示', dir: 1, text: '焰心重新挺直了身子。风过去了。灯，还亮着。', overlay: '就一会儿', overlayColor: '#ffcaa0' },
      ],
    },
    {
      key: 'dawn', no: '终幕', name: '黎明', dur: 34,
      lines: [
        { who: '舞台指示', dir: 1, text: '天边泛起鱼肚白。点灯人伸手，轻轻旋灭了灯。', fx: 'out' },
        { who: '点灯人', text: '该你啦。天亮了，火要歇一歇。' },
        { who: '舞台指示', dir: 1, text: '他递给孩子一只小小提灯。孩子把灯举过头顶。', fx: 'light' },
        { who: '孩子', text: '那……等天黑了，我再来点这一盏，好不好？' },
        { who: '点灯人', text: '好。光，会传下去的。', fx: 'dawn' },
        { who: '旁白', text: '最后一盏灯灭了。可第一盏，已经亮在了另一双手里。', overlay: '光，会传下去', overlayColor: '#ffe9a8', fx: 'bell' },
      ],
    },
  ],
};

/* 台词时长：打字机完成后停留的时间 */
PLAY.lineDur = function (l) {
  return l.dir ? 950 + l.text.length * 55 : 1350 + l.text.length * 68;
};
