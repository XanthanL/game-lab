window.SCRIPT = {
  title: '银河邮差',
  subtitle: '寄往星星的一封信',
  acts: [
    {
      name: '序幕',
      title: '夜班邮局',
      setting: '深夜的小城 · 巷口邮局',
      cues: [
        { t: 'stage', text: '夜深了。小城睡着了，只有巷口邮局的灯还亮着。' },
        { t: 'line', who: '旁白', text: '当整座城都睡了，还有一个人醒着。' },
        { t: 'line', who: '旁白', text: '他叫小满，是这座城里唯一的邮差。' },
        { t: 'stage', text: '小满把最后一封信贴在胸口，抬头望了望天上的星星。' },
        { t: 'line', who: '小满', text: '今晚这封信，得寄到天上去。', fx: 'match' }
      ]
    },
    {
      name: '第一幕',
      title: '寄信的孩子',
      setting: '邮局门口 · 一盏灯下',
      cues: [
        { t: 'stage', text: '一个孩子从暗处跑出来，怀里抱着一封信。' },
        { t: 'line', who: '孩子', text: '邮差叔叔，请你帮我把这封信寄给星星。' },
        { t: 'line', who: '小满', text: '寄给星星？天上可没有门牌号呀。' },
        { t: 'line', who: '孩子', text: '有的。妈妈说，离开我们的人，都住在星星上。' },
        { t: 'stage', text: '小满低头看信，信封上歪歪扭扭写着：寄给最亮的那颗星。' },
        { t: 'line', who: '小满', text: '好，那叔叔就替你跑这一趟。', fx: 'bell' }
      ]
    },
    {
      name: '第二幕',
      title: '纸船启航',
      setting: '护城河边 · 星光倒影',
      cues: [
        { t: 'stage', text: '小满把信折成一只纸船，轻轻放进水里。' },
        { t: 'line', who: '小满', text: '顺着水走，水会流进银河。' },
        { t: 'stage', text: '河水渐渐亮起来，映满了天上的星星，像一条发光的河。' },
        { t: 'line', who: '旁白', text: '小满跳上自己的小船，朝着河心划去。' },
        { t: 'line', who: '小满', text: '启程！给星星送信去喽。', fx: 'wind' }
      ]
    },
    {
      name: '第三幕',
      title: '银河之上',
      setting: '银河 · 星尘与流火',
      cues: [
        { t: 'stage', text: '小船顺流而上，驶进了一条由星光铺成的河。' },
        { t: 'line', who: '旁白', text: '银河在船下缓缓流动，像一条发光的丝带。' },
        { t: 'line', who: '小满', text: '原来，每一颗星星，都有人想念着啊。' },
        { t: 'stage', text: '一颗流星从头顶划过，像谁轻轻应了一声。', fx: 'comet' }
      ]
    },
    {
      name: '第四幕',
      title: '星星的回信',
      setting: '银河深处 · 最亮的星',
      cues: [
        { t: 'stage', text: '小船停在一颗最亮的星星前。' },
        { t: 'line', who: '小满', text: '你好，我替一个孩子送来一封信。' },
        { t: 'stage', text: '星星读完信，慢慢亮了起来，落下一点暖暖的光。' },
        { t: 'line', who: '星星', text: '告诉那孩子，想念会变成光，一直亮着。' },
        { t: 'stage', text: '小满把这一点光收进怀里，像是收下了一颗小小的太阳。', fx: 'star' }
      ]
    },
    {
      name: '终幕',
      title: '黎明归来',
      setting: '河岸 · 天将破晓',
      cues: [
        { t: 'stage', text: '天快亮了。小满划着船，回到了岸边。' },
        { t: 'line', who: '孩子', text: '邮差叔叔，星星收到我的信了吗？' },
        { t: 'stage', text: '小满摊开手掌，一点光轻轻落在孩子的手心。' },
        { t: 'line', who: '小满', text: '星星说，想念会变成光，亮在你抬头就能看见的地方。' },
        { t: 'stage', text: '孩子抬头。天边，一颗新的小星星刚刚亮起来。' },
        { t: 'line', who: '旁白', text: '从那天起，每一份想念，都有了回信。', fx: 'dawn' }
      ]
    }
  ]
};
