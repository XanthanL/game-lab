/**
 * 树言·旅记 - 故事详情页面功能
 */

function getStoryIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || '1';
}

// 按篇更新 SEO 标签：meta description / og 系列 / canonical
function updateStoryMeta(story) {
    const setMeta = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute('content', value);
    };
    // 从正文 HTML 里提纯文本摘要（去掉旁注，避免注释性长文混入）
    const tmp = document.createElement('div');
    tmp.innerHTML = story.content;
    tmp.querySelectorAll('.side-note-content').forEach(n => n.remove());
    const excerpt = (tmp.textContent || '').replace(/\s+/g, '').slice(0, 90);
    const pageUrl = `https://xanthanl.github.io/game-lab/shuyan-travel/story.html?id=${story.id}`;

    setMeta('meta[name="description"]', `${story.subtitle}。${excerpt}…`);
    setMeta('meta[property="og:title"]', `${story.title} - 树言·旅记`);
    setMeta('meta[property="og:description"]', `${story.location} · ${story.date}。${story.subtitle}`);
    setMeta('meta[property="og:url"]', pageUrl);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', pageUrl);
}

function updateStoryContent() {
    const storyId = getStoryIdFromURL();
    const story = window.getStory ? window.getStory(storyId) : null;

    if (!story) {
        // 无效 ID 兑底，避免页面永远停在“加载中”
        document.getElementById('story-title').textContent = '这一页被风吹走了';
        document.getElementById('story-subtitle').textContent = '你要找的故事不在这里';
        document.getElementById('story-date').textContent = '——';
        document.getElementById('story-location').textContent = '未知之地';
        document.getElementById('story-content').innerHTML =
            '<p class="revealed" style="text-align:center;padding:40px;">或许它还在路上，或许它从未被写下。<a href="index.html" class="read-more">回到时间线</a></p>';
        document.title = '故事不存在 - 树言·旅记';
        return;
    }

    // 更新基础信息
    document.getElementById('story-date').textContent = story.date;
    document.getElementById('story-location').textContent = story.location;
    document.getElementById('story-title').textContent = story.title;
    document.getElementById('story-subtitle').textContent = story.subtitle;

    const contentContainer = document.getElementById('story-content');
    contentContainer.innerHTML = story.content;

    // 首字下沉优化：给第一个段落加上 drop-cap 类
    const firstP = contentContainer.querySelector('p');
    if (firstP) {
        firstP.classList.add('drop-cap');
    }

    // 触发段落淡入监听
    if (window.revealObserver) {
        contentContainer.querySelectorAll('p, blockquote').forEach(el => {
            window.revealObserver.observe(el);
        });
    }

    // 处理旁注点击交互 (移动端)
    contentContainer.querySelectorAll('.has-note').forEach(note => {
        note.addEventListener('click', function(e) {
            if (window.innerWidth <= 1200) {
                e.preventDefault();
                this.classList.toggle('active');
            }
        });
    });

    // 更新导航... (保持不变)
    if (window.getAdjacentStories) {
        const adjacent = window.getAdjacentStories(storyId);
        const prevLink = document.getElementById('prev-story');
        const nextLink = document.getElementById('next-story');
        
        if (adjacent.prev && prevLink) {
            prevLink.href = `story.html?id=${adjacent.prev.id}`;
            prevLink.querySelector('.story-nav-title').textContent = adjacent.prev.title;
            prevLink.style.display = 'flex';
        } else if (prevLink) {
            prevLink.style.display = 'none';
        }
        
        if (adjacent.next && nextLink) {
            nextLink.href = `story.html?id=${adjacent.next.id}`;
            nextLink.querySelector('.story-nav-title').textContent = adjacent.next.title;
            nextLink.style.display = 'flex';
        } else if (nextLink) {
            nextLink.style.display = 'none';
        }
    }
    
    document.title = `${story.title} - 树言·旅记`;
    updateStoryMeta(story);
}

document.addEventListener('DOMContentLoaded', () => {
    // stories.js 在本脚本之前同步加载，直接渲染即可
    updateStoryContent();
});
