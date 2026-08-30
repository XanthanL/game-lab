'use strict';
/* ═══════════════════════════════════════════════
   《三体》像素舞台剧 —— 剧本
   数据即剧本：演出引擎直接读取本文件驱动整场演出
   lines:  who=角色  dir=舞台指示  fx=音效  overlay=上屏大字
   ═══════════════════════════════════════════════ */
const PLAY = {
  title: '三体',
  subtitle: '像 素 舞 台 剧 · NDS 双屏版',
  credit: '原著 刘慈欣《三体》  ·  改编 / 演出：Hermes Agent (DeepSeek-V4-Flash)  ·  从剧本到演出，全部由前端实现',

  acts: [
    {
      key: 'prologue', no: '序幕', name: '宇宙为你闪烁', dur: 22,
      lines: [
        { who: '舞台指示', dir: 1, text: '深夜。天文台。汪淼仰望星空。' },
        { who: '汪淼', text: '那倒计时……一直悬在我的眼前。是幽灵吗？' },
        { who: '旁白', text: '他看到的不是倒计时——是宇宙，在为他闪烁。', fx: 'alarm' },
        { who: '舞台指示', dir: 1, text: '星空忽明忽暗，红色数字开始跳动。', overlay: '1200:00:00' },
      ],
    },
    {
      key: 'redcoast', no: '第一幕', name: '红岸 · 不要回答', dur: 34,
      lines: [
        { who: '舞台指示', dir: 1, text: '1968年。大兴安岭深处。红岸基地。' },
        { who: '叶文洁', text: '人类……已经无法依靠自己的力量解决自己的问题了。' },
        { who: '舞台指示', dir: 1, text: '她按下了那个红色按钮。电波射向太阳。', fx: 'transmit' },
        { who: '叶文洁', text: '到这里来吧。我将帮助你们获得这个世界。' },
        { who: '旁白', text: '三体文明，收到了这条信息。', overlay: '不要回答！！', overlayColor: '#ff4030' },
        { who: '舞台指示', dir: 1, text: '电波穿过星海。三体舰队，启航。', fx: 'launch' },
      ],
    },
    {
      key: 'threebody', no: '第二幕', name: '三体游戏 · 恒纪元与乱纪元', dur: 36,
      lines: [
        { who: '旁白', text: '三体游戏。虚拟的星球上，三颗太阳在乱舞。' },
        { who: '周文王', text: '乱纪元！太阳要出来了——脱水！脱水！', fx: 'alarm' },
        { who: '舞台指示', dir: 1, text: '人群卷起身体，化为干枯的皮囊。' },
        { who: '旁白', text: '太阳升起又落下。文明在毁灭与重生之间轮回。' },
        { who: '周文王', text: '恒纪元到了！浸泡！复活！', fx: 'chime' },
        { who: '旁白', text: '三体问题无解。文明一万八千次轮回，只为寻找答案。' },
      ],
    },
    {
      key: 'sophon', no: '第三幕', name: '智子 · 睁开眼', dur: 28,
      lines: [
        { who: '旁白', text: '三体人，展开了一枚质子。' },
        { who: '舞台指示', dir: 1, text: '质子在二维展开，覆盖了整个天空。', fx: 'door' },
        { who: '旁白', text: '它睁开眼。注视着地球。', overlay: '智子睁开眼', overlayColor: '#7ec8ff', fx: 'eye' },
        { who: '三体元首', text: '锁死地球的科学。我们，将抵达。' },
      ],
    },
    {
      key: 'droplet', no: '第四幕', name: '水滴 · 毁灭你', dur: 32,
      lines: [
        { who: '舞台指示', dir: 1, text: '太阳系舰队。两千艘战舰列阵。' },
        { who: '丁仪', text: '它是完美的。完美得……令人恐惧。' },
        { who: '旁白', text: '它像一滴水银，缓缓滑过舰队。', fx: 'whoosh' },
        { who: '舞台指示', dir: 1, text: '水滴骤然加速。一艘接一艘，化为焰火。', fx: 'boom' },
        { who: '旁白', text: '毁灭你，与你何干。' },
      ],
    },
    {
      key: 'darkforest', no: '第五幕', name: '黑暗森林', dur: 32,
      lines: [
        { who: '舞台指示', dir: 1, text: '墓园。罗辑仰望星空。' },
        { who: '罗辑', text: '宇宙就是一座黑暗森林。每个文明都是带枪的猎人。' },
        { who: '罗辑', text: '如果我向一颗恒星发射咒语……你们，敢赌吗？', fx: 'transmit' },
        { who: '舞台指示', dir: 1, text: '咒语命中。187J3X1 恒星，毁灭。', overlay: '黑暗森林', overlayColor: '#ffd24a' },
        { who: '旁白', text: '黑暗森林威慑，建立。两个文明在枪口下对峙。' },
      ],
    },
    {
      key: 'epilogue', no: '终幕', name: '给岁月以文明', dur: 30,
      lines: [
        { who: '旁白', text: '给岁月以文明，而不是给文明以岁月。' },
        { who: '舞台指示', dir: 1, text: '晨光越过地平线。三体舰队，转向。' },
        { who: '旁白', text: '人类从尘埃中走来，向星海走去。' },
        { who: '舞台指示', dir: 1, text: '宇宙依然沉默。', overlay: '全剧终', overlayColor: '#ffffff', fx: 'dawn' },
      ],
    },
  ],
};

/* 台词时长：打字机完成后停留的时间 */
PLAY.lineDur = function (l) {
  return l.dir ? 900 + l.text.length * 55 : 1300 + l.text.length * 70;
};
