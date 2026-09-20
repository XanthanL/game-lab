/* 共振纪元 · 章节清单
 * ------------------------------------------------------------------
 * 全站唯一数据源：目录、目录页、上一章/下一章、文件名全部读这里。
 *
 * 文件名规则（注意空格）：
 *   03_manuscript/第 {n} 章_{title}.md      例：第 8 章_杨 - 米尔斯理论的社会学延伸.md
 * 「第」「章」与数字之间各有一个空格，标题原样照抄（含「杨 - 米尔斯」里的空格）。
 * 万一某章改名，用 file 字段单独覆盖即可，不用改解析逻辑。
 */
window.NOVEL_DATA = {
  title: "共振纪元",
  titleEn: "RESONANCE ERA",
  subtitle: "硬科幻 / 反乌托邦 / 革命叙事",
  manuscriptDir: "03_manuscript",
  volumes: [
    { id: 1, title: "第一卷", subtitle: "世界观奠基篇", range: [1, 12] },
    { id: 2, title: "第二卷", subtitle: "量子纠缠态的社会显现篇", range: [13, 25] }
  ],
  chapters: [
    { number: 1,  title: "测地线方程的非线性解" },
    { number: 2,  title: "诺特定理的例外情况" },
    { number: 3,  title: "卡西米尔效应的社会形态" },
    { number: 4,  title: "彭罗斯过程的底层实现" },
    { number: 5,  title: "贝尓不等式的背叛" },
    { number: 6,  title: "霍金辐射的逆向应用" },
    { number: 7,  title: "乌姆拉夫波动的阈值" },
    { number: 8,  title: "杨 - 米尔斯理论的社会学延伸" },
    { number: 9,  title: "自发对称性破缺的临界点" },
    { number: 10, title: "重正化群的错误项" },
    { number: 11, title: "拓扑相变的不可逆性" },
    { number: 12, title: "重整化流动的稳定点" },
    { number: 13, title: "多世界诠释的代价" },
    { number: 14, title: "量子纠缠态的宏观显现" },
    { number: 15, title: "贝尓不等式的社会应用" },
    { number: 16, title: "量子芝诺效应的迟钝" },
    { number: 17, title: "量子隧穿的概率分布" },
    { number: 18, title: "色散关系的非线性修正" },
    { number: 19, title: "斯塔克效应与环境噪声" },
    { number: 20, title: "冯诺依曼架构的社会学延伸" },
    { number: 21, title: "混沌理论的非线性预测" },
    { number: 22, title: "洛伦兹吸引子的社会形态" },
    { number: 23, title: "海森堡不确定性原理的社会应用" },
    { number: 24, title: "量子退相干的集体意识" },
    { number: 25, title: "量子纠缠的宏观显现" }
  ]
};

/* 派生字段：卷号 + 文件名。写在这里而不是各处重复拼字符串。 */
(function (data) {
  data.totalChapters = data.chapters.length;
  data.chapters.forEach(function (ch) {
    ch.file = ch.file || "第 " + ch.number + " 章_" + ch.title + ".md";
    ch.volume = (data.volumes.find(function (v) {
      return ch.number >= v.range[0] && ch.number <= v.range[1];
    }) || {}).id || 1;
  });
  data.byNumber = {};
  data.chapters.forEach(function (ch) { data.byNumber[ch.number] = ch; });
})(window.NOVEL_DATA);
