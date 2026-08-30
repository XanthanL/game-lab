/* === 三体 NDS像素舞台剧 - 主入口 === */

(function () {
    'use strict';

    let engine = null;

    // 标题画面星空动画
    function initTitleStars() {
        const container = document.getElementById('title-stars');
        if (!container) return;
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.style.cssText = `
                position: absolute;
                width: ${Math.random() < 0.3 ? 2 : 1}px;
                height: ${Math.random() < 0.3 ? 2 : 1}px;
                background: white;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: ${0.3 + Math.random() * 0.7};
                animation: star-twinkle ${2 + Math.random() * 3}s infinite alternate;
                animation-delay: ${Math.random() * 2}s;
            `;
            container.appendChild(star);
        }

        // 添加CSS动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes star-twinkle {
                0% { opacity: 0.2; transform: scale(1); }
                100% { opacity: 1; transform: scale(1.3); }
            }
        `;
        document.head.appendChild(style);
    }

    // 初始化
    function init() {
        initTitleStars();

        // 创建引擎实例
        engine = new StageEngine();

        // 标题画面点击
        const titleOverlay = document.getElementById('title-overlay');
        titleOverlay.addEventListener('click', () => {
            if (engine.state === 'title') {
                engine.handleInput('a');
            }
        });

        // 电源LED闪烁
        const led = document.getElementById('power-led');
        setInterval(() => {
            led.style.opacity = led.style.opacity === '0.3' ? '1' : '0.3';
        }, 2000);

        console.log('%c三体 · NDS像素舞台剧', 'color: #4488ff; font-size: 16px; font-weight: bold;');
        console.log('%c基于刘慈欣《三体》改编 | 前端像素动画舞台剧', 'color: #888; font-size: 11px;');
    }

    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
