# 共振纪元 | RESONANCE ERA

## 长篇科幻小说在线阅读平台

硬科幻 / 反乌托邦 / 革命叙事。底层集群里的一群人，和系统记账的方式。

---

## 📖 阅读指南

### 在线访问
直接在浏览器中打开 [`index.html`](./index.html) 即可开始阅读。

### 章节结构
- **第一卷 · 众生**（第 1-12 章）
- **第二卷 · 回响**（第 13-25 章）

标题走《地球往事》的路子：**只命名、不评价**，2—5 字为主，优先用本章的那个「物」。
不许出现判断词，不用「物理概念 + 社会学延伸」的论文腔。
例：每年两米九 / 三十克 / 一点一米 / 过账 / 瑟拉 / 十二点七 / 七四 / 塔。
完整制度见 [`04_editing/title-system.md`](./04_editing/title-system.md)。

---

## 🛠️ 技术架构

### 前端技术栈
```
├── index.html              # 阅读器主页面（壳）
├── assets/
│   └── style.css           # 克莱因蓝设计系统（含日/夜主题、移动端）
├── chapters.js             # 章节清单：标题、卷、文件名（唯一数据源）
├── reader.js               # 阅读器逻辑：路由 / 取文件 / Markdown / 设置
└── 03_manuscript/          # 小说原始稿
    ├── 第 1 章_每年两米九.md
    ├── 第 2 章_三十克.md
    └── ... (共 25 章)

文件名规则：「第 {n} 章_{标题}.md」——「第」「章」与数字之间各有一个空格。
例：第 8 章_第十四任.md

⚠️ 文件名由 `chapters.js` 的 `title` 派生。**改 title = 改文件名**，
改完必须跑 `.workbuddy/res-probe.cjs`（会验 文件名 / title / 首行 H1 三者一致）。
```

### 功能特性
- ✅ 克莱因蓝设计系统（IKB #002FA7 + 酸黄 #EDFF45）
- ✅ 日间 / 夜间双主题，自动跟随系统
- ✅ 字号、行距调节（写到 CSS 变量，换章不会失效）
- ✅ 响应式：移动端侧栏变抽屉 + 底部悬浮翻章栏 + 安全区适配
- ✅ 目录页 + 深链：`#/catalog` 和 `#/3` 可分享、可刷新
- ✅ 上次读到哪章自动恢复（localStorage）
- ✅ 键盘 ←/→ 翻章，Esc 关抽屉
- ✅ 阅读进度条（顶部 2px 酸黄）
- ✅ 25 章手稿 0 取不到

---

## 🚀 部署方式

### GitHub Pages（推荐）
将本项目添加到 game-lab 主仓库后，通过 GitHub Actions 自动部署：

```yaml
# .github/workflows/deploy.yml
name: Deploy Novel Reader
on:
  push:
    branches: [main]
    paths: ['resonance-era/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          publish_dir: ./resonance-era
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

访问地址：`https://xanthanl.github.io/game-lab/resonance-era/`

### 其他静态托管平台
- Vercel / Netlify：直接导入 `resonance-era` 目录
- Cloudflare Pages：配置 CI/CD 自动构建

---

## 📝 内容说明

### 世界观设定
- **时代**：架空宇宙纪元 1018 年
- **社会结构**：六层级空间分布，协作单元制度
- **统治机制**："文明管理中枢"AI 系统，大规模记忆清除计划

### 核心物理概念
| 概念 | 书中含义 |
|------|---------|
| 测地线方程的非线性解 | 底层阻力梯度的理论基础 |
| 诺特定理的例外情况 | 帮助他人会破坏能量平衡的原因 |
| 12.7Hz 共振频率 | 集体意识觉醒的临界点信号 |
| 量子记忆残留效应 | 被清除记忆的潜在保存方式 |

### 创作信息
- **总字数**: 约 33.6 万字（已完成 25 章）
- **作者**: XanthanL

---

## 🔧 自定义配置

### 本地预览
章节文件用 fetch 加载，浏览器禁止从 `file://` 直接读。需要在本目录起一个静态服务：

```powershell
# PowerShell
python -m http.server 8000
# 然后访问 http://localhost:8000/
```

（或用 VS Code 的 Live Server 插件）

### 修改颜色主题
编辑 `assets/style.css` 顶部 `:root` 里的 token：

```css
:root {
  --ikb: #002FA7;     /* 克莱因蓝本体 —— 整本书的颜色基石 */
  --acid: #EDFF45;    /* 酸黄，只用在「当前」与「进度」 */
}
```

日间主题调整 `--bg`（页底）/ `--surface`（阅读卡）/ `--ink`（正文）。
夜间主题调整：`:root[data-theme="dark"] { ... }` 区块。

### 调整字体设置
滑杆范围与默认值在 `assets/style.css` 根 token：

```css
--reader-fs: 17px;   /* 字号，滑杆 15–24 */
--reader-lh: 1.9;    /* 行距，滑杆 1.5–2.4 */
```

---

## 📊 数据结构

`chapters.js` 是唯一数据源，结构：

```javascript
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
    { number: 1, title: "测地线方程的非线性解", file: "...", volume: 1 },
    ...
  ]
};
```

---

## 🎯 后续规划

### 功能增强
- [x] 目录页显示所有章节列表（封面 + 双卷网格）
- [ ] 书签功能
- [ ] 笔记标注
- [ ] 搜索功能
- [ ] TTS 语音朗读

### 内容扩展
- [ ] 第三卷创作（第 26-45 章）
- [ ] 人物关系图谱可视化
- [ ] 伏笔回收进度追踪

---

## 📞 联系方式

如有疑问或建议，欢迎通过 [GitHub Issues](https://github.com/XanthanL/game-lab/issues) 反馈。

---

© 2026 共振纪元 | A Science Fiction Novel by XanthanL
