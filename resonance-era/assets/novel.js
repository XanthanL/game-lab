// ===== Novel Reader Application =====

class NovelReader {
    constructor() {
        this.currentChapter = 1;
        this.chapters = window.NOVEL_DATA?.chapters || [];
        this.init();
    }

    async init() {
        if (window.NOVEL_DATA) {
            this.totalChapters = window.NOVEL_DATA.totalChapters;
        } else {
            await this.loadChapters();
        }
        this.setupEventListeners();
        this.renderChapterList();
        this.loadChapter(this.currentChapter);
        this.applySettings();
    }

    async loadChapters() {
        // Auto-detect chapters from manuscript folder
        this.chapters = this.generateChapterList();
        this.totalChapters = this.chapters.length;
    }

    generateChapterList() {
        const chapters = [];
        for (let i = 1; i <= 25; i++) {
            chapters.push({
                number: i,
                title: `第${i}章`,
                file: `03_manuscript/第${i}章_*.md`
            });
        }
        return chapters;
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('prev-chapter').addEventListener('click', () => {
            if (this.currentChapter > 1) {
                this.loadChapter(this.currentChapter - 1);
            }
        });

        document.getElementById('next-chapter').addEventListener('click', () => {
            if (this.currentChapter < this.totalChapters) {
                this.loadChapter(this.currentChapter + 1);
            }
        });

        document.getElementById('to-catalog').addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Settings
        document.getElementById('font-size').addEventListener('input', (e) => {
            localStorage.setItem('novel-font-size', e.target.value);
            this.applySettings();
        });

        document.getElementById('line-height').addEventListener('input', (e) => {
            localStorage.setItem('novel-line-height', e.target.value);
            this.applySettings();
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            const body = document.body;
            const isLight = body.getAttribute('data-theme') === 'light';
            body.setAttribute('data-theme', isLight ? 'dark' : 'light');
            localStorage.setItem('novel-theme', isLight ? 'dark' : 'light');
        });
    }

    renderChapterList() {
        const chapterList = document.getElementById('chapter-list');
        const navContainer = chapterList.closest('.chapter-nav');
        
        if (!navContainer || !chapterList) return;
        
        // Clear existing content
        chapterList.innerHTML = '';
        
        // Show table of contents only
        const toc = document.createElement('div');
        toc.className = 'toc-content';
        
        const sections = [
            { title: '第一卷：世界观奠基篇', chapters: '1-12' },
            { title: '第二卷：量子纠缠态的社会显现篇', chapters: '13-25' }
        ];
        
        sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.style.cssText = 'margin-bottom: 1.5rem;';
            
            const sectionTitle = document.createElement('div');
            sectionTitle.style.cssText = 'color: #00f2ff; font-weight: 600; margin-bottom: 0.8rem; letter-spacing: 0.1em;';
            sectionTitle.textContent = section.title;
            sectionDiv.appendChild(sectionTitle);
            
            const chapterRange = document.createElement('div');
            chapterRange.style.cssText = 'font-size: 0.85rem; color: rgba(224,224,224,0.7);';
            chapterRange.textContent = `Chapter ${section.chapters}`;
            sectionDiv.appendChild(chapterRange);
            
            toc.appendChild(sectionDiv);
        });
        
        chapterList.appendChild(toc);
    }

    async loadChapter(chapterNumber) {
        const chapter = this.chapters.find(c => c.number === chapterNumber);
        if (!chapter) return;

        this.currentChapter = chapterNumber;
        
        try {
            const chapterFile = `03_manuscript/第${chapterNumber}章_测地线方程的非线性解.md`;
            const response = await fetch(`../resonance-era/${chapterFile}`);
            if (!response.ok) throw new Error('Chapter not found');
            
            const markdown = await response.text();
            const html = this.markdownToHtml(markdown);
            
            const bookContent = document.getElementById('book-content');
            // Extract chapter title from markdown header
            const match = markdown.match(/^#\s*(.+)$/m);
            const chapterTitle = match ? match[1] : `第${chapterNumber}章`;
            
            bookContent.innerHTML = `
                <h2 class="chapter-title">${chapterTitle}</h2>
                <div class="chapter-body">${html}</div>
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
                '<p style="text-align:center;color:#ff6b6b;">无法加载章节内容<br>' +
                '请确保小说文件正确放置</p>';
        }
    }

    markdownToHtml(markdown) {
        // Simple markdown parser for basic formatting
        let html = markdown
            // Headers
            .replace(/^#\s+(.*$)/gim, '<h3 class="sub-heading">$1</h3>')
            // Bold
            .replace(/\*\*(.+?)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/gim, '<em>$1</em>')
            // Paragraphs
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
        const links = document.querySelectorAll('.chapter-nav nav a');
        links.forEach(link => link.classList.remove('active'));
        
        // Note: We're showing TOC instead of individual chapters
        // This could be enhanced if needed
    }

    updateButtonStates() {
        const prevBtn = document.getElementById('prev-chapter');
        const nextBtn = document.getElementById('next-chapter');
        
        prevBtn.disabled = this.currentChapter <= 1;
        nextBtn.disabled = this.currentChapter >= this.totalChapters;
    }

    applySettings() {
        const fontSize = localStorage.getItem('novel-font-size') || '18';
        const lineHeight = localStorage.getItem('novel-line-height') || '1.8';
        const theme = localStorage.getItem('novel-theme') || 'dark';
        
        document.getElementById('font-size').value = fontSize;
        document.getElementById('line-height').value = lineHeight;
        document.body.setAttribute('data-theme', theme);
        
        const chapterBody = document.querySelector('.chapter-body');
        if (chapterBody) {
            chapterBody.style.fontSize = `${fontSize}px`;
            chapterBody.style.lineHeight = lineHeight;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NovelReader();
});
