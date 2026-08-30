/**
 * 树言·旅记 - 主JavaScript文件
 */

document.addEventListener('DOMContentLoaded', function() {
    initPageTransitions();
    initProgressBar();
    // stories.js 在 main.js 之前同步加载，无需延时等待
    if (document.getElementById('stories-container')) {
        loadStories();
    }
    initScrollReveal();
});

function initProgressBar() {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);
    document.body.prepend(progressContainer);

    // rAF 节流 + passive，避免滚动主线程卡顿
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            progressBar.style.width = height > 0 ? (winScroll / height) * 100 + '%' : '0%';
            ticking = false;
        });
    }, { passive: true });
}

function initScrollReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // 扫描并监测所有需要淡入的元素
    const elementsToReveal = document.querySelectorAll('.story-excerpt, .story-content p, .story-content blockquote, .about-content p, .section-content p, .about-quote, .final-words p');

    elementsToReveal.forEach(el => {
        // 如果元素已经在视口中，立即显示
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
            el.classList.add('revealed');
        } else {
            revealObserver.observe(el);
        }
    });

    window.revealObserver = revealObserver; // 供动态生成内容调用
}

function loadStories() {
    if (window.getAllStories) {
        const stories = window.getAllStories();
        renderStories(stories);
    }
}

function renderStories(stories) {
    const container = document.getElementById('stories-container');
    if (!container) return;
    
    if (stories.length === 0) {
        container.innerHTML = '<p class="text-center">还没有故事被记录...</p>';
        return;
    }
    
    // 篇目多了之后改用紧凑标题式时间线：按年份分组，一行一篇
    const byYear = new Map();
    stories.forEach(story => {
        const year = story.date.slice(0, 4);
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year).push(story);
    });

    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'timeline';
    byYear.forEach((items, year) => {
        const head = document.createElement('div');
        head.className = 'timeline-year';
        head.innerHTML = `${year}<span class="timeline-year-count">${items.length} 篇</span>`;
        list.appendChild(head);
        items.forEach(story => list.appendChild(createTimelineItem(story)));
    });
    container.appendChild(list);

    // 行进入视口时轻量淡入
    const rowObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                rowObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });
    list.querySelectorAll('.timeline-item, .timeline-year').forEach(el => rowObserver.observe(el));
}

function createTimelineItem(story) {
    const item = document.createElement('a');
    item.className = 'timeline-item';
    item.href = `story.html?id=${story.id}`;
    item.innerHTML = `
        <span class="timeline-date">${story.date.slice(5)}</span>
        <span class="timeline-main">
            <span class="timeline-title">${story.title}</span>
            <span class="timeline-subtitle">${story.subtitle}</span>
        </span>
        <span class="timeline-location">${story.location}</span>
    `;
    return item;
}

function initPageTransitions() {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
}
