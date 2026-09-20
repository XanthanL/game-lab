// ===== Minimal Novel Reader =====

class NovelReader {
    constructor() {
        this.currentChapter = 1;
        this.chapters = window.NOVEL_DATA?.chapters || [];
        this.totalChapters = window.NOVEL_DATA?.totalChapters || this.chapters.length;
        
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

        // Group by volume
        const volumes = [
            { name: '第一卷：世界观奠基篇', chapters: '1-12' },
            { name: '第二卷：量子纠缠态的社会显现篇', chapters: '13-25' }
        ];

        let html = '<li style="margin-bottom: 1rem;"><a href="#" style="pointer-events: none;">';
        volumes.forEach(vol => {
            html += `<span style="color: var(--text-secondary); font-weight: 400; margin-bottom: 0.5rem; display: block; font-size: 0.875rem;">${vol.name}</span>`;
            html += `<span style="color: var(--text-muted); font-weight: 300;">Chapter ${vol.chapters}</span>`;
        });
        html += '</a></li>';

        chapterList.innerHTML = html;
    }

    async loadChapter(chapterNumber) {
        const chapter = this.chapters.find(c => c.number === chapterNumber);
        if (!chapter) return;

        this.currentChapter = chapterNumber;

        try {
            // Map chapter number to actual file name
            const fileMap = {
                1: "测地线方程的非线性解",
                2: "诺特定理的例外情况",
                3: "卡西米尔效应的社会形态",
                4: "彭罗斯过程的底层实现",
                5: "贝尓不等式的背叛",
                6: "霍金辐射的逆向应用",
                7: "乌姆拉夫波动的阈值",
                8: "杨 - 米尔斯理论的社会学延伸",
                9: "自发对称性破缺的临界点",
                10: "重正化群的错误项",
                11: "拓扑相变的不可逆性",
                12: "重整化流动的稳定点",
                13: "多世界诠释的代价",
                14: "量子纠缠态的宏观显现",
                15: "贝尓不等式的社会应用",
                16: "量子芝诺效应的迟钝",
                17: "量子隧穿的概率分布",
                18: "色散关系的非线性修正",
                19: "斯塔克效应与环境噪声",
                20: "冯诺依曼架构的社会学延伸",
                21: "混沌理论的非线性预测",
                22: "洛伦兹吸引子的社会形态",
                23: "海森堡不确定性原理的社会应用",
                24: "量子退相干的集体意识",
                25: "量子纠缠的宏观显现"
            };

            const subtitle = fileMap[chapterNumber] || "测地线方程的非线性解";
            const chapterFile = `./03_manuscript/第${chapterNumber}章_${subtitle}.md`;
            
            const response = await fetch(chapterFile);
            
            if (!response.ok) throw new Error('Chapter not found');

            const markdown = await response.text();
            const htmlContent = this.markdownToHtml(markdown);

            const bookContent = document.getElementById('book-content');
            
            // Use the mapped title
            const chapterTitle = `第${chapterNumber}章 ${chapter.title || subtitle}`;

            bookContent.innerHTML = `
                <h2 class="chapter-title">${chapterTitle}</h2>
                <div class="chapter-body">${htmlContent}</div>
            `;

            // Update active state
            this.updateActiveState(chapterNumber);

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Update button states
            this.updateButtonStates();

        } catch (error) {
            console.error('Error loading chapter:', error);
            document.getElementById('book-content').innerHTML = 
                `<p style="text-align:center;color:var(--text-secondary);padding:${this.spacing(2)}">无法加载该章节内容</p>`;
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
        // Currently showing TOC summary only
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

    spacing(unit) {
        const units = {
            0.5: '0.5rem',
            1: '1rem',
            1.5: '1.5rem',
            2: '2rem',
            3: '3rem',
            4: '4rem'
        };
        return units[unit] || unit + 'rem';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new NovelReader();
});
