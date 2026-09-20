/* 共振纪元 · 章节清单
 * ------------------------------------------------------------------
 * 全站唯一数据源：目录、目录页、上一章/下一章、文件名全部读这里。
 *
 * 文件名规则（注意空格）：
 *   03_manuscript/第 {n} 章_{title}.md      例：第 8 章_第十四任.md
 * 「第」「章」与数字之间各有一个空格，标题原样照抄。
 * 万一某章改名，用 file 字段单独覆盖即可，不用改解析逻辑。
 *
 * 标题制度（2026-09-21 定稿，见 04_editing/title-system.md）：
 *   像《地球往事》那样 —— 只命名不评价，2—5 字为主，优先用本章的那个「物」。
 *   不许出现判断词（背叛／例外／错误／代价／不可逆），不许用「物理概念 + 社会学延伸」的论文腔。
 *   改 title = 改文件名（file 由 title 派生），改完必须跑 .workbuddy/res-probe.cjs。
 */
window.NOVEL_DATA = {
  title: "共振纪元",
  titleEn: "RESONANCE ERA",
  subtitle: "硬科幻 / 反乌托邦 / 革命叙事",
  manuscriptDir: "03_manuscript",
  volumes: [
    { id: 1, title: "第一卷", subtitle: "众生", range: [1, 12] },
    { id: 2, title: "第二卷", subtitle: "回响", range: [13, 25] }
  ],
  chapters: [
    // 第一卷 · 众生 —— 前六章着力众生面貌，第七章起才说七四
    { number: 1,  title: "每年两米九" },
    { number: 2,  title: "三十克" },
    { number: 3,  title: "一点一米" },
    { number: 4,  title: "过账" },
    { number: 5,  title: "瑟拉" },
    { number: 6,  title: "十二点七" },
    { number: 7,  title: "七四" },
    { number: 8,  title: "第十四任" },
    { number: 9,  title: "三个人" },
    { number: 10, title: "大静默" },
    { number: 11, title: "原因栏" },
    { number: 12, title: "塔" },
    // 第二卷 · 回响 —— 标题是方向不是锁死，重写时按各章实际的「物」复核
    { number: 13, title: "两本账" },
    { number: 14, title: "回响" },
    { number: 15, title: "拷问" },
    { number: 16, title: "每天一次" },
    { number: 17, title: "缝隙" },
    { number: 18, title: "走样" },
    { number: 19, title: "噪声" },
    { number: 20, title: "中枢" },
    { number: 21, title: "预报" },
    { number: 22, title: "漩涡" },
    { number: 23, title: "巡塔人" },
    { number: 24, title: "褪色" },
    { number: 25, title: "地面" }
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
