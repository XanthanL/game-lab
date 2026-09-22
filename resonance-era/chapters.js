/* 共振纪元 · 章节清单
 * ------------------------------------------------------------------
 * 全站唯一数据源：目录、目录页、上一章/下一章、文件名全部读这里。
 *
 * 文件名规则（注意空格）：
 *   03_manuscript/第 {n} 章_{title}.md      例：第 8 章_第十四任.md
 * 「第」「章」与数字之间各有一个空格，标题原样照抄。
 * 万一某章改名，用 file 字段单独覆盖即可，不用改解析逻辑。
 *
 * 章首引文 epigraph（2026-09-22 三版定稿）：{ quote, source }
 *   体系见 04_editing/gutaira-proverbs.md。三层叠加：
 *     主干七成 = 实践的唯物论（异化 / 量变引起质变 / 被拿走的那一截 /
 *                历史是干活的人造的 / 没调查就没有发言权 / 做过才算数）
 *     底色二成 = 不可知（知道是要付账的；"我不知道"不是懒，是本来说不出来）
 *     腔调一成 = 启示录（决绝、不收尾、不安慰）
 *   ⚠️ 硬约束：不许出现任何人名 / 流派名 / 作品名（作者 2026-09-22 拍板）。
 *   ⚠️ 硬约束：quote 字数 = 正文里「X 个字」「不认得那 X 个字」的 X。
 *     改 quote 必须同步 grep 正文（res-probe.cjs 不校验这一条）。
 *
 * 标题制度（2026-09-21 定稿，见 04_editing/title-system.md）：
 *   像《地球往事》那样 —— 只命名不评价，2—5 字为主，优先用本章的那个「物」。
 *   不许出现判断词（背叛／例外／错误／代价／不可逆），不许用「物理概念 + 社会学延伸」的论文腔。
 *   ⚠️ 全书最多一个带度量单位的标题（现为第 1 章「每年两米九」）—— 见 04_editing/numeric-discipline.md。
 *      作者 2026-09-21 拍板：前六章曾有四个（每年两米九／三十克／一点一米／十二点七），
 *      1、2、3 连着三章，读起来像报表。已改成 名册 / 一格 / 第一项。
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
    { number: 1,  title: "每年两米九",
      epigraph: { quote: "一年两米九。走到不是它那天，它不通知你。", source: "古泰拉谚语。第 4 扇区通道 B-4 入口铭牌，铭牌于纪元 1012 年拆除。" } },
    { number: 2,  title: "名册",
      epigraph: { quote: "名册上有你，你就在。这跟你人在哪儿不相干。", source: "古泰拉谚语。登记处窗口人员培训手册第 3 页曾引此句，纪元 1015 年后删除。" } },
    { number: 3,  title: "一格",
      epigraph: { quote: "一格一格地满。满了，新来的就没有地方。", source: "古泰拉典籍。第 22 扇区分拣线 B 段墙面标语，现存，字迹已不清。" } },
    { number: 4,  title: "过账",
      epigraph: { quote: "过一次账，就少一次。少的那一回不写在账上。", source: "古泰拉谚语。采集站手册第 13 页（图）下方手写，作者不明。" } },
    { number: 5,  title: "瑟拉",
      epigraph: { quote: "写了八年，手上有的，嘴上没有。", source: "古泰拉诗。第 31 扇区静默写录室墙上有过，纪元 1016 年清库时粉刷覆盖。" } },
    { number: 6,  title: "第一项",
      epigraph: { quote: "你听得见的，都是让它听见你的。", source: "古泰拉谚语。第 2 扇区频谱监控室门牌背面刻字，刻者不明，纪元 1006 年。" } },
    { number: 7,  title: "七四",
      epigraph: { quote: "人有一页，物有一页。哪一页满，你就是哪一个。", source: "古泰拉神庙铭文。底层流传的抄本中，此句常与一个图形同时出现：两条短线，中间一个圆。" } },
    { number: 8,  title: "第十四任",
      epigraph: { quote: "十四行，没有一个签名。活是他们干的。", source: "古泰拉谚语。第 22 扇区织网工位交接记录扉页，每一任交接时抄一遍，现存十四遍。" } },
    { number: 9,  title: "三个人",
      epigraph: { quote: "拆得开的归一个人。拆不开的，谁也拿不走。", source: "古泰拉谚语。第 19 扇区协作单元登记处张贴。该单元编制为三，在册为零；标语于纪元 1018 年 3 月撤下。" } },
    { number: 10, title: "大静默",
      epigraph: { quote: "一千一百零四个人的事，系统里什么也没发生。", source: "古泰拉诗。静默执行站（底层称「洗房」）门外墙面，有人用指甲划上去，三天后被磨平。" } },
    { number: 11, title: "原因栏",
      epigraph: { quote: "有因。", source: "古泰拉谚语。第 31 扇区档案室索引卡片背面印刷，每张都有。" } },
    { number: 12, title: "塔",
      epigraph: { quote: "四百二十七级。你没爬，你就没有发言权。", source: "古泰拉诗。塔第 400 级内壁，指甲划成，非刀刻。塔顶平台在 427 级——划字的人没有上去。" } },
    // 第二卷 · 回响 —— 标题是方向不是锁死，重写时按各章实际的「物」复核
    { number: 13, title: "两本账",
      epigraph: { quote: "中间那一截没有。", source: "古泰拉谚语。第 37 扇区账目核对处门联上联。下联那块墙上留着两条胶痕，一样长，一样宽，一样高。" } },
    { number: 14, title: "回响",
      epigraph: { quote: "三日之后，是死寂。", source: "古泰拉典故。第 12 扇区阅听室门楣，字迹完好——该室自纪元 1013 年起无人进入。" } },
    { number: 15, title: "拷问",
      epigraph: { quote: "耳朵归它。", source: "古泰拉典籍。第 12 扇区判定处门内墙，白底黑字。判定处纪元 1013 年撤销，该层封闭；字还在墙上。" } },
    { number: 16, title: "每天一次",
      epigraph: { quote: "进去的。", source: "古泰拉谚语。第 8 扇区采集站值班室外墙，与作息表并排张贴，字比作息表大。值班的人十九年天天看见，不认得那三个字；问过来修灯的人，只得到一句「那是古时候的话」。" } },
    { number: 17, title: "缝隙",
      epigraph: { quote: "裂开的东西自己要合。你不扳，它就合。", source: "古泰拉谚语。缝巡检表背面手写，字很小，笔画细。表每日一张，昨天那一张扔在墙根；判缝的人十九年天天拿到它，不认得背面那一行。" } },
    { number: 18, title: "走样",
      epigraph: { quote: "差一毫便不是它。", source: "古泰拉典籍。第 12 扇区库第二层，调取窗口左边墙上有一行字，字口里填过白漆，白漆掉了大半。字下面贴着纪元 1018 年第一次偏离报告，报告只有一页，结论栏是空的。" } },
    { number: 19, title: "噪声",
      epigraph: { quote: "听不清的不是噪声，是太多人在说。", source: "古泰拉典籍。第 2 扇区监测站设备间，与操作规程并排。" } },
    { number: 20, title: "中枢",
      epigraph: { quote: "中枢不在哪间屋里。它在每一间屋里。", source: "古泰拉谚语。中枢站入口，字很大，进门先看见。" } },
    { number: 21, title: "预报",
      epigraph: { quote: "预报的不是要来的，是已经来的。", source: "古泰拉谚语。预报处墙上，下面被人用笔加了一行：雨在哪。" } },
    { number: 22, title: "漩涡",
      epigraph: { quote: "进去了就转。转到不是你为止。", source: "古泰拉谚语。第 9 扇区通道转角涂鸦，反复被刷，反复出现。" } },
    { number: 23, title: "巡塔人",
      epigraph: { quote: "巡一趟才知道塔在不在。不巡，你只有一张图。", source: "古泰拉典籍。塔底层入口，刻在台阶第一级的侧面。" } },
    { number: 24, title: "褪色",
      epigraph: { quote: "褪了不是没有。褪了是还记得的人少了一个。", source: "古泰拉谚语。第 24 扇区配给点墙面，字迹褪去一半。" } },
    { number: 25, title: "地面",
      epigraph: { quote: "地是人踩出来的。踩的人不在上面。", source: "古泰拉谚语。第 1 扇区底层入口地面刻字，已被踩平，仅存「地」字。" } }
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
