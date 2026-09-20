// ===== Minimal Novel Reader =====

class NovelReader {
    constructor() {
        this.currentChapter = 1;
        this.chapters = window.NOVEL_DATA?.chapters || [];
        this.totalChapters = window.NOVEL_DATA?.totalChapters || this.chapters.length;
        
        // Chapter title mapping from file names
        this.fileToTitleMap = {
            "第 1 章_测地线方程的非线性解.md": "测地线方程的非线性解",
            "第 2 章_诺特定理的例外情况.md": "诺特定理的例外情况",
            "第 3 章_卡西米尔效应的社会形态.md": "卡西米尔效应的社会形态",
            "第 4 章_彭罗斯过程的底层实现.md": "彭罗斯过程的底层实现",
            "第 5 章_贝尓不等式的背叛.md": "贝尓不等式的背叛",
            "第 6 章_霍金辐射的逆向应用.md": "霍金辐射的逆向应用",
            "第 7 章_乌姆拉夫波动的阈值.md": "乌姆拉夫波动的阈值",
            "第 8 章_杨 - 米尔斯理论的社会学延伸.md": "杨 - 米尔斯理论的社会学延伸",
            "第 9 章_自发对称性破缺的临界点.md": "自发对称性破缺的临界点",
            "第 10 章_重正化群的错误项.md": "重正化群的错误项",
            "第 11 章_拓扑相变的不可逆性.md": "拓扑相变的不可逆性",
            "第 12 章_重整化流动的稳定点.md": "重整化流动的稳定点",
            "第 13 章_多世界诠释的代价.md": "多世界诠释的代价",
            "第 14 章_量子纠缠态的宏观显现.md": "量子纠缠态的宏观显现",
            "第 15 章_贝尓不等式的社会应用.md": "贝尓不等式的社会应用",
            "第 16 章_量子芝诺效应的迟钝.md": "量子芝诺效应的迟钝",
            "第 17 章_量子隧穿的概率分布.md": "量子隧穿的概率分布",
            "第 18 章_色散关系的非线性修正.md": "色散关系的非线性修正",
            "第 19 章_斯塔克效应与环境噪声.md": "斯塔克效应与环境噪声",
            "第 20 章_冯诺依曼架构的社会学延伸.md": "冯诺依曼架构的社会学延伸",
            "第 21 章_混沌理论的非线性预测.md": "混沌理论的非线性预测",
            "第 22 章_洛伦兹吸引子的社会形态.md": "洛伦兹吸引子的社会形态",
            "第 23 章_海森堡不确定性原理的社会应用.md": "海森堡不确定性原理的社会应用",
            "第 24 章_量子退相干的集体意识.md": "量子退相干的集体意识",
            "第 25 章_量子纠缠的宏观显现.md": "量子纠缠的宏观显现"
        };

        this.init();
    }

    async init() {
        if (!window.NOVEL_DATA) {
            await this.loadChapters();
        }
        
        this.setupEventListeners();
        this.renderChapterList();
        this.applySettings();
        this.loadChapter(this.currentChapter);
    }

    async loadChapters() {
        // Auto-detect chapters from manuscript folder
        const chapters = [];
        for (let i = 1; i <= 25; i++) {
            chapters.push({
                number: i,
                title: `第${i}章`
            });
        }
        this.chapters = chapters;
        this.totalChapters = chapters.length;
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('prev-chapter')?.addEventListener('click', () => {
            if (this.currentChapter > 1) {
                this.loadChapter(this.currentChapter - 1);
            }
        });

        document.getElementById('next-chapter')?.addEventListener('click', () => {
            if (this.currentChapter < this.totalChapters) {
                this.loadChapter(this.currentChapter + 1);
            }
        });

        document.getElementById('to-catalog')?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Settings
        document.getElementById('font-size')?.addEventListener('input', (e) => {
            localStorage.setItem('novel-font-size', e.target.value);
            this.updateFontSize(parseInt(e.target.value));
        });

        document.getElementById('line-height')?.addEventListener('input', (e) => {
            localStorage.setItem('novel-line-height', e.target.value);
            this.updateLineHeight(parseFloat(e.target.value));
        });

        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            const body = document.body;
            const isLight = body.getAttribute('data-theme') === 'light';
            body.setAttribute('data-theme', isLight ? 'dark' : 'light');
            localStorage.setItem('novel-theme', isLight ? 'dark' : 'light');
        });
    }

    renderChapterList() {
        const chapterList = document.getElementById('chapter-list');
        if (!chapterList) return;

        let html = '';
        
        // First volume (1-12)
        html += '<li style="margin-bottom: 1.5rem;"><span style="color: var(--text-secondary); font-weight: 400; margin-bottom: 0.75rem; display: block; font-size: 0.875rem;">第一卷：世界观奠基篇</span>';
        for (let i = 1; i <= 12; i++) {
            const title = this.getChapterSubtitle(i);
            const activeClass = i === this.currentChapter ? 'active' : '';
            html += `<li><a href="#" class="${activeClass}" onclick="reader.loadChapter(${i}); return false;">第${i}章 ${title}</a></li>`;
        }
        html += '</li>';

        // Second volume (13-25)
        html += '<li style="margin-bottom: 1.5rem;"><span style="color: var(--text-secondary); font-weight: 400; margin-bottom: 0.75rem; display: block; font-size: 0.875rem;">第二卷：量子纠缠态的社会显现篇</span>';
        for (let i = 13; i <= 25; i++) {
            const title = this.getChapterSubtitle(i);
            const activeClass = i === this.currentChapter ? 'active' : '';
            html += `<li><a href="#" class="${activeClass}" onclick="reader.loadChapter(${i}); return false;">第${i}章 ${title}</a></li>`;
        }
        html += '</li>';

        chapterList.innerHTML = html;
    }

    getChapterSubtitle(chapterNumber) {
        const fileName = `第${chapterNumber}章_${this.fileToTitleMap[`第${chapterNumber}章_*.md`] || ''}.md`;
        // Extract subtitle from filename
        for (const [key, value] of Object.entries(this.fileToTitleMap)) {
            if (key.includes(`第${chapterNumber}章`)) {
                return value;
            }
        }
        return '';
    }

    async loadChapter(chapterNumber) {
        const chapter = this.chapters.find(c => c.number === chapterNumber);
        if (!chapter) return;

        this.currentChapter = chapterNumber;

        try {
            // Get the correct subtitle for this chapter
            let subtitle = '';
            for (const [fileName, title] of Object.entries(this.fileToTitleMap)) {
                if (fileName.includes(`第${chapterNumber}章`)) {
                    subtitle = title;
                    break;
                }
            }

            const chapterFile = `./03_manuscript/第${chapterNumber}章_${subtitle}.md`;
            
            console.log('Loading:', chapterFile);
            
            const response = await fetch(chapterFile);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const markdown = await response.text();
            const htmlContent = this.markdownToHtml(markdown);

            const bookContent = document.getElementById('book-content');
            
            const chapterTitle = `第${chapterNumber}章 ${subtitle}`;

            bookContent.innerHTML = `
                <h2 class="chapter-title">${chapterTitle}</h2>
                <div class="chapter-body">${htmlContent}</div>
            `;

            // Update active state in sidebar
            this.updateActiveState(chapterNumber);

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Update button states
            this.updateButtonStates();

        } catch (error) {
            console.error('Error loading chapter:', error);
            document.getElementById('book-content').innerHTML = 
                `<p style="text-align:center;color:var(--text-secondary);padding:2rem;">无法加载该章节内容<br/><small>${error.message}</small></p>`;
        }
    }

    markdownToHtml(markdown) {
        // Simple markdown parser for basic formatting
        let html = markdown
            // Headers (h3 level for subheadings)
            .replace(/^###\s+(.*$)/gim, '<h3>$1</h3>')
            // Bold
            .replace(/\*\*(.+?)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/gim, '<em>$1</em>')
            // Split into paragraphs
            .split(/\n\s*\n/)
            .map(paragraph => {
                if (paragraph.trim().startsWith('#')) {
                    return paragraph;
                }
                return `<p>${paragraph.replace(/\n/gim, '</p><p>')}</p>`;
            })
            .join('');

        return html;
    }

    updateActiveState(currentChapter) {
        const links = document.querySelectorAll('.chapter-list a');
        links.forEach(link => link.classList.remove('active'));
        
        const currentLink = document.querySelector(`.chapter-list a[onclick*="loadChapter(${currentChapter})"]`);
        if (currentLink) {
            currentLink.classList.add('active');
        }
    }

    updateButtonStates() {
        const prevBtn = document.getElementById('prev-chapter');
        const nextBtn = document.getElementById('next-chapter');

        prevBtn.disabled = this.currentChapter <= 1;
        nextBtn.disabled = this.currentChapter >= this.totalChapters;
    }

    applySettings() {
        const fontSize = localStorage.getItem('novel-font-size') || '17';
        const lineHeight = localStorage.getItem('novel-line-height') || '1.8';
        const theme = localStorage.getItem('novel-theme') || 'light';

        // Apply settings
        document.body.setAttribute('data-theme', theme);
        this.updateFontSize(parseInt(fontSize));
        this.updateLineHeight(parseFloat(lineHeight));
    }

    updateFontSize(size) {
        document.documentElement.style.setProperty('--base-font-size', `${size}px`);
        const body = document.querySelector('.chapter-body');
        if (body) {
            body.style.fontSize = `${size}px`;
        }
    }

    updateLineHeight(ratio) {
        document.documentElement.style.setProperty('--base-line-height', ratio);
        const body = document.querySelector('.chapter-body');
        if (body) {
            body.style.lineHeight = ratio;
        }
    }
}

// Make reader instance globally accessible for onclick handlers
let reader;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    reader = new NovelReader();
});
