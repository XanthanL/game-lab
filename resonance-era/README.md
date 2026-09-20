# 共振纪元 | RESONANCE ERA

## 长篇硬科幻小说在线阅读平台

一部关于自由意志、认知解放与集体觉醒的科幻作品，融合了广义相对论、量子力学、混沌理论等物理概念与社会批判。

---

## 📖 阅读指南

### 在线访问
直接在浏览器中打开 [`index.html`](./index.html) 即可开始阅读。

### 章节结构
- **第一卷：世界观奠基篇**（第 1-12 章）
- **第二卷：量子纠缠态的社会显现篇**（第 13-25 章）

每章标题都包含一个物理学术语，如"测地线方程的非线性解"、"诺特定理的例外情况"等。

---

## 🛠️ 技术架构

### 前端技术栈
```
├── index.html              # 阅读器主页面
├── assets/
│   ├── style.css          # 全局样式与响应式设计
│   ├── novel.js           # 阅读器核心逻辑
│   └── chapters.js        # 章节元数据
└── 03_manuscript/         # 小说原始稿
    ├── 第 1 章_*.md
    ├── 第 2 章_*.md
    └── ... (共 25 章)
```

### 功能特性
- ✅ 响应式设计（适配移动端）
- ✅ 深色/浅色主题切换
- ✅ 字号与行距调节
- ✅ 章节目录导航
- ✅ 上一章/下一章快速跳转
- ✅ Markdown 格式渲染
- ✅ 本地存储用户偏好

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
- **类型**：硬科幻 / 反乌托邦 / 革命叙事
- **总字数**：约 33.6 万字（已完成 25 章）
- **作者**：XanthanL

---

## 🔧 自定义配置

### 修改颜色主题
编辑 `assets/style.css` 中的 CSS 变量：

```css
.novel-title {
    background: linear-gradient(45deg, #00f2ff, #0066ff, #00f2ff);
}
```

### 调整字体设置
在 `novel.js` 中修改默认值：

```javascript
const fontSize = localStorage.getItem('novel-font-size') || '18';
const lineHeight = localStorage.getItem('novel-line-height') || '1.8';
```

---

## 📊 数据结构示例

```javascript
window.NOVEL_DATA = {
    title: "共振纪元",
    totalChapters: 25,
    chapters: [
        { number: 1, title: "测地线方程的非线性解" },
        { number: 2, title: "诺特定理的例外情况" },
        // ...更多章节
    ]
};
```

---

## 🎯 后续规划

### 功能增强
- [ ] 目录页显示所有章节列表
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

© 2026 共振纪元 | A Hard Science Fiction Novel by XanthanL
