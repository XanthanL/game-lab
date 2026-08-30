/* === 三体 NDS像素舞台剧 - 像素精灵渲染系统 === */

class PixelRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.W = canvas.width;  // 256
        this.H = canvas.height; // 192
        this.frame = 0;
        this.particles = [];
        this.stars = [];
        this.initStars();
    }

    initStars() {
        for (let i = 0; i < 60; i++) {
            this.stars.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H,
                size: Math.random() < 0.3 ? 2 : 1,
                speed: 0.1 + Math.random() * 0.3,
                blink: Math.random() * Math.PI * 2
            });
        }
    }

    clear(color = '#0a0a1a') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.W, this.H);
    }

    // 绘制像素矩形
    px(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    }

    // 绘制星空背景
    drawStars(intensity = 1) {
        this.frame++;
        for (const star of this.stars) {
            const alpha = (0.4 + 0.6 * Math.sin(this.frame * 0.02 + star.blink)) * intensity;
            this.ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            this.ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
            star.y += star.speed;
            if (star.y > this.H) { star.y = 0; star.x = Math.random() * this.W; }
        }
    }

    // === 背景场景 ===
    drawBackground(scene) {
        switch (scene) {
            case 'space': this.drawSpace(); break;
            case 'redcoast': this.drawRedCoast(); break;
            case 'redcoast_night': this.drawRedCoastNight(); break;
            case 'lab': this.drawLab(); break;
            case 'city': this.drawCity(); break;
            case 'game_world': this.drawGameWorld(); break;
            case 'trisolara': this.drawTrisolara(); break;
            case 'fleet': this.drawFleet(); break;
            case 'earth': this.drawEarth(); break;
            case 'dark_forest': this.drawDarkForest(); break;
            default: this.drawSpace();
        }
    }

    drawSpace() {
        this.clear('#050510');
        this.drawStars(1);
        // 远处星云
        const grd = this.ctx.createRadialGradient(200, 60, 5, 200, 60, 60);
        grd.addColorStop(0, 'rgba(60,20,80,0.3)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(140, 0, 120, 120);
    }

    drawRedCoast() {
        this.clear('#1a1520');
        // 天空渐变
        const sky = this.ctx.createLinearGradient(0, 0, 0, 120);
        sky.addColorStop(0, '#2a1a1a');
        sky.addColorStop(1, '#4a2a1a');
        this.ctx.fillStyle = sky;
        this.ctx.fillRect(0, 0, this.W, 120);
        // 山脉
        this.px(0, 100, 256, 92, '#1a1210');
        for (let i = 0; i < 8; i++) {
            const mh = 30 + Math.sin(i * 1.2) * 20;
            this.px(i * 34, 120 - mh, 36, mh, '#221a14');
        }
        // 红岸天线
        this.drawAntenna(128, 50);
        // 基地建筑
        this.px(90, 130, 76, 40, '#2a2a30');
        this.px(94, 134, 12, 8, '#ffaa33');
        this.px(112, 134, 12, 8, '#ffaa33');
        this.px(130, 134, 12, 8, '#ffaa33');
        this.px(148, 134, 12, 8, '#334455');
        // 地面
        this.px(0, 170, 256, 22, '#0f0f12');
    }

    drawRedCoastNight() {
        this.clear('#0a0a15');
        this.drawStars(0.7);
        // 月光
        this.px(210, 20, 12, 12, '#ddeeff');
        this.px(212, 18, 8, 2, '#ddeeff');
        // 山脉剪影
        for (let i = 0; i < 8; i++) {
            const mh = 35 + Math.sin(i * 1.5) * 25;
            this.px(i * 34, 130 - mh, 36, mh + 62, '#0f0f18');
        }
        // 天线剪影
        this.drawAntenna(128, 55, '#1a1a2a');
        // 基地微弱灯光
        this.px(100, 140, 56, 30, '#12121a');
        this.px(108, 146, 6, 5, '#553300');
        this.px(124, 146, 6, 5, '#553300');
        this.px(0, 170, 256, 22, '#080810');
    }

    drawAntenna(x, y, color = '#4a4a55') {
        // 大天线 - 红岸基地标志
        this.px(x - 2, y, 4, 80, color);
        // 碟形
        for (let i = -20; i <= 20; i += 2) {
            const h = Math.floor(12 - (i * i) / 40);
            this.px(x + i, y - h, 2, h + 4, color);
        }
        // 支撑
        this.px(x - 12, y + 60, 3, 20, color);
        this.px(x + 10, y + 60, 3, 20, color);
        // 红色警示灯
        if (this.frame % 60 < 30) {
            this.px(x - 1, y - 14, 3, 3, '#ff0000');
        }
    }

    drawLab() {
        this.clear('#1a1a22');
        // 墙壁
        this.px(0, 0, 256, 140, '#22222a');
        // 地板
        this.px(0, 140, 256, 52, '#2a2a32');
        for (let i = 0; i < 16; i++) {
            this.px(i * 16, 140, 1, 52, '#222228');
        }
        // 设备
        this.px(10, 80, 40, 60, '#333340');
        this.px(14, 84, 14, 10, '#003322');
        this.px(14, 98, 14, 10, '#002233');
        // 屏幕闪烁
        const sc = this.frame % 40 < 20 ? '#00ff88' : '#00cc66';
        this.px(16, 86, 10, 6, sc);
        // 大型计算机
        this.px(180, 60, 60, 80, '#2a2a35');
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
                const on = Math.random() > 0.5;
                this.px(186 + c * 13, 66 + r * 14, 8, 8, on ? '#00aa44' : '#113311');
            }
        }
        // 天花板灯
        this.px(100, 4, 56, 4, '#555566');
        this.px(108, 8, 40, 2, '#aaaacc');
    }

    drawCity() {
        this.clear('#0f1525');
        this.drawStars(0.3);
        // 城市天际线
        const buildings = [
            [10, 80, 20, 112], [35, 60, 25, 132], [65, 90, 18, 102],
            [88, 50, 30, 142], [122, 70, 22, 122], [148, 45, 28, 147],
            [180, 85, 20, 107], [205, 55, 25, 137], [234, 75, 22, 117]
        ];
        for (const [bx, by, bw, bh] of buildings) {
            this.px(bx, by, bw, bh, '#1a2035');
            // 窗户
            for (let wy = by + 6; wy < by + bh - 8; wy += 12) {
                for (let wx = bx + 4; wx < bx + bw - 6; wx += 8) {
                    const lit = Math.random() > 0.4;
                    this.px(wx, wy, 4, 6, lit ? '#ffdd66' : '#111825');
                }
            }
        }
        // 地面
        this.px(0, 175, 256, 17, '#0a0f18');
    }

    drawGameWorld() {
        this.clear('#1a0a05');
        // 三体游戏 - 荒芜世界
        // 混沌天空
        const skyC = this.frame % 200 < 100 ? '#3a1505' : '#150a25';
        const sky = this.ctx.createLinearGradient(0, 0, 0, 100);
        sky.addColorStop(0, skyC);
        sky.addColorStop(1, '#2a1a0a');
        this.ctx.fillStyle = sky;
        this.ctx.fillRect(0, 0, this.W, 100);
        // 三个太阳
        const sunPhase = this.frame * 0.01;
        for (let i = 0; i < 3; i++) {
            const sx = 80 + Math.sin(sunPhase + i * 2.1) * 60;
            const sy = 30 + Math.cos(sunPhase * 0.7 + i * 1.5) * 20;
            const sr = 8 + i * 3;
            this.ctx.fillStyle = i === 0 ? '#ffaa00' : (i === 1 ? '#ff6600' : '#ff3300');
            this.ctx.beginPath();
            this.ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            this.ctx.fill();
            // 光晕
            this.ctx.fillStyle = `rgba(255,${150 - i * 40},0,0.2)`;
            this.ctx.beginPath();
            this.ctx.arc(sx, sy, sr + 6, 0, Math.PI * 2);
            this.ctx.fill();
        }
        // 荒原
        this.px(0, 120, 256, 72, '#2a1a0a');
        // 金字塔
        this.drawPyramid(60, 80);
        this.drawPyramid(180, 90);
        // 干裂地面纹理
        for (let i = 0; i < 12; i++) {
            this.px(i * 22 + 5, 140 + (i % 3) * 15, 14, 1, '#1a0f05');
        }
    }

    drawPyramid(x, y) {
        for (let row = 0; row < 40; row += 2) {
            const w = row * 1.2;
            this.px(x - w / 2, y + row, w, 2, '#4a3a20');
        }
        this.px(x - 3, y + 30, 6, 10, '#2a1a0a');
    }

    drawTrisolara() {
        this.clear('#150505');
        // 三体星系
        this.drawStars(0.5);
        // 三颗恒星
        const t = this.frame * 0.008;
        const suns = [
            { x: 128 + Math.sin(t) * 50, y: 70 + Math.cos(t) * 30, c: '#ffcc00' },
            { x: 128 + Math.sin(t + 2.1) * 50, y: 70 + Math.cos(t + 2.1) * 30, c: '#ff8800' },
            { x: 128 + Math.sin(t + 4.2) * 50, y: 70 + Math.cos(t + 4.2) * 30, c: '#ff4400' }
        ];
        for (const s of suns) {
            this.ctx.fillStyle = s.c;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = s.c.replace(')', ',0.15)').replace('#', 'rgba(').length > 7 ?
                'rgba(255,150,0,0.15)' : 'rgba(255,150,0,0.15)';
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
            this.ctx.fill();
        }
        // 行星
        const px = 128 + Math.sin(t * 3) * 80;
        const py = 140 + Math.cos(t * 2) * 20;
        this.ctx.fillStyle = '#4466aa';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 6, 0, Math.PI * 2);
        this.ctx.fill();
        // 地表
        this.px(0, 170, 256, 22, '#1a0a05');
    }

    drawFleet() {
        this.clear('#020208');
        this.drawStars(1.2);
        // 三体舰队 - 光点阵列
        const t = this.frame * 0.005;
        for (let i = 0; i < 20; i++) {
            const fx = 40 + (i % 5) * 40 + Math.sin(t + i) * 5;
            const fy = 30 + Math.floor(i / 5) * 35 + Math.cos(t + i * 0.5) * 3;
            const bright = 0.5 + 0.5 * Math.sin(this.frame * 0.05 + i);
            this.ctx.fillStyle = `rgba(100,200,255,${bright})`;
            this.ctx.fillRect(fx, fy, 3, 3);
            // 引擎尾焰
            this.ctx.fillStyle = `rgba(255,150,50,${bright * 0.5})`;
            this.ctx.fillRect(fx - 4, fy + 1, 3, 1);
        }
        // 航向线
        this.ctx.strokeStyle = 'rgba(100,200,255,0.1)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 100);
        this.ctx.lineTo(256, 80);
        this.ctx.stroke();
    }

    drawEarth() {
        this.clear('#020210');
        this.drawStars(0.8);
        // 地球
        this.ctx.fillStyle = '#2244aa';
        this.ctx.beginPath();
        this.ctx.arc(128, 130, 50, 0, Math.PI * 2);
        this.ctx.fill();
        // 大陆
        this.ctx.fillStyle = '#228833';
        this.ctx.beginPath();
        this.ctx.arc(115, 120, 15, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(145, 135, 12, 0, Math.PI * 2);
        this.ctx.fill();
        // 大气层
        this.ctx.strokeStyle = 'rgba(100,180,255,0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(128, 130, 52, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawDarkForest() {
        this.clear('#020205');
        this.drawStars(1.5);
        // 黑暗森林 - 无数文明的光点，逐一熄灭
        const t = this.frame * 0.01;
        for (let i = 0; i < 30; i++) {
            const cx = (i * 37 + 10) % 256;
            const cy = (i * 23 + 5) % 150;
            const alive = Math.sin(t + i * 0.7) > -0.3;
            if (alive) {
                const alpha = 0.3 + 0.4 * Math.sin(t * 2 + i);
                this.ctx.fillStyle = `rgba(200,220,255,${alpha})`;
                this.ctx.fillRect(cx, cy, 2, 2);
            } else {
                this.ctx.fillStyle = 'rgba(80,20,20,0.3)';
                this.ctx.fillRect(cx, cy, 2, 2);
            }
        }
    }

    // === 角色精灵 ===
    drawCharacter(name, x, y, emotion = 'normal', flip = false) {
        this.ctx.save();
        if (flip) {
            this.ctx.translate(x + 16, 0);
            this.ctx.scale(-1, 1);
            x = 0;
        }
        switch (name) {
            case 'yewenjie': this.drawYeWenjie(x, y, emotion); break;
            case 'wangmiao': this.drawWangMiao(x, y, emotion); break;
            case 'scientist': this.drawScientist(x, y, emotion); break;
            case 'trisolara': this.drawTrisolaran(x, y, emotion); break;
            case 'narrator': break;
            default: this.drawScientist(x, y, emotion);
        }
        this.ctx.restore();
    }

    drawYeWenjie(x, y, emotion) {
        // 叶文洁 - 军绿色外套，短发
        const bob = Math.sin(this.frame * 0.05) * 1;
        y += bob;
        // 头发
        this.px(x + 4, y, 24, 6, '#2a2a2a');
        this.px(x + 2, y + 4, 28, 10, '#2a2a2a');
        // 脸
        this.px(x + 6, y + 8, 20, 14, '#ffcc99');
        // 眼睛
        if (emotion === 'sad') {
            this.px(x + 10, y + 13, 4, 2, '#333');
            this.px(x + 18, y + 13, 4, 2, '#333');
        } else if (emotion === 'determined') {
            this.px(x + 10, y + 12, 4, 3, '#333');
            this.px(x + 18, y + 12, 4, 3, '#333');
            this.px(x + 10, y + 11, 4, 1, '#2a2a2a');
            this.px(x + 18, y + 11, 4, 1, '#2a2a2a');
        } else {
            this.px(x + 10, y + 12, 4, 3, '#333');
            this.px(x + 18, y + 12, 4, 3, '#333');
        }
        // 嘴
        if (emotion === 'sad') {
            this.px(x + 13, y + 19, 6, 1, '#cc8866');
        } else {
            this.px(x + 13, y + 18, 6, 2, '#cc8866');
        }
        // 身体 - 军绿外套
        this.px(x + 4, y + 22, 24, 26, '#3a5a3a');
        this.px(x + 14, y + 22, 4, 26, '#2a4a2a');
        // 手臂
        this.px(x, y + 24, 5, 20, '#3a5a3a');
        this.px(x + 27, y + 24, 5, 20, '#3a5a3a');
        // 腿
        this.px(x + 8, y + 48, 7, 14, '#2a2a3a');
        this.px(x + 18, y + 48, 7, 14, '#2a2a3a');
    }

    drawWangMiao(x, y, emotion) {
        // 汪淼 - 深色夹克，学者气质
        const bob = Math.sin(this.frame * 0.05 + 1) * 1;
        y += bob;
        // 头发
        this.px(x + 5, y, 22, 5, '#1a1a1a');
        this.px(x + 4, y + 3, 24, 6, '#1a1a1a');
        // 脸
        this.px(x + 6, y + 7, 20, 14, '#ffcc99');
        // 眼镜
        this.px(x + 8, y + 11, 7, 5, '#aaddff');
        this.px(x + 17, y + 11, 7, 5, '#aaddff');
        this.px(x + 15, y + 12, 2, 2, '#666');
        this.px(x + 8, y + 11, 7, 1, '#333');
        this.px(x + 17, y + 11, 7, 1, '#333');
        // 眼睛
        this.px(x + 10, y + 13, 3, 2, '#333');
        this.px(x + 19, y + 13, 3, 2, '#333');
        // 嘴
        this.px(x + 13, y + 18, 6, 2, '#cc8866');
        // 身体 - 深色夹克
        this.px(x + 4, y + 21, 24, 27, '#2a3040');
        this.px(x + 14, y + 21, 4, 20, '#222830');
        // 手臂
        this.px(x, y + 23, 5, 20, '#2a3040');
        this.px(x + 27, y + 23, 5, 20, '#2a3040');
        // 腿
        this.px(x + 8, y + 48, 7, 14, '#1a1a2a');
        this.px(x + 18, y + 48, 7, 14, '#1a1a2a');
    }

    drawScientist(x, y, emotion) {
        // 通用科学家 - 白大褂
        const bob = Math.sin(this.frame * 0.05 + 2) * 1;
        y += bob;
        // 头发
        this.px(x + 6, y, 20, 5, '#4a4a4a');
        this.px(x + 5, y + 3, 22, 5, '#4a4a4a');
        // 脸
        this.px(x + 7, y + 7, 18, 13, '#ffcc99');
        // 眼睛
        this.px(x + 11, y + 12, 3, 3, '#333');
        this.px(x + 18, y + 12, 3, 3, '#333');
        // 身体 - 白大褂
        this.px(x + 5, y + 20, 22, 28, '#ddeeff');
        this.px(x + 14, y + 20, 4, 28, '#ccddee');
        // 手臂
        this.px(x + 1, y + 22, 5, 18, '#ddeeff');
        this.px(x + 26, y + 22, 5, 18, '#ddeeff');
        // 腿
        this.px(x + 9, y + 48, 6, 14, '#333340');
        this.px(x + 17, y + 48, 6, 14, '#333340');
    }

    drawTrisolaran(x, y, emotion) {
        // 三体人 - 抽象光影形态
        const pulse = Math.sin(this.frame * 0.08) * 3;
        const alpha = 0.6 + 0.3 * Math.sin(this.frame * 0.05);
        // 光体
        this.ctx.fillStyle = `rgba(100,200,255,${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 12 + pulse, 0, Math.PI * 2);
        this.ctx.fill();
        // 内核
        this.ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 20, 5, 0, Math.PI * 2);
        this.ctx.fill();
        // 触须/思维波
        for (let i = 0; i < 4; i++) {
            const angle = (this.frame * 0.03) + i * Math.PI / 2;
            const ex = x + 16 + Math.cos(angle) * (18 + pulse);
            const ey = y + 20 + Math.sin(angle) * (18 + pulse);
            this.ctx.strokeStyle = `rgba(100,200,255,${alpha * 0.5})`;
            this.ctx.beginPath();
            this.ctx.moveTo(x + 16, y + 20);
            this.ctx.lineTo(ex, ey);
            this.ctx.stroke();
        }
        // 下半身渐变
        this.ctx.fillStyle = `rgba(60,120,200,${alpha * 0.4})`;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 6, y + 30);
        this.ctx.lineTo(x + 26, y + 30);
        this.ctx.lineTo(x + 20, y + 55);
        this.ctx.lineTo(x + 12, y + 55);
        this.ctx.fill();
    }

    // 粒子效果
    addParticle(x, y, type = 'spark') {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3 - 1,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                type,
                color: type === 'signal' ? '#44ffaa' :
                       type === 'fire' ? '#ff6600' : '#ffffff'
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            const alpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color.replace(')', `,${alpha})`).replace('#', '');
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
            this.ctx.globalAlpha = 1;
        }
    }

    // 信号波特效
    drawSignalWave(x, y) {
        const t = this.frame * 0.1;
        for (let i = 0; i < 3; i++) {
            const r = ((t + i * 10) % 30) * 2;
            const alpha = 1 - r / 60;
            if (alpha > 0) {
                this.ctx.strokeStyle = `rgba(0,255,150,${alpha})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y, r, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
    }

    // 倒计时效果
    drawCountdown(num) {
        this.ctx.fillStyle = 'rgba(255,0,0,0.1)';
        this.ctx.fillRect(0, 0, this.W, this.H);
        this.ctx.font = '24px monospace';
        this.ctx.fillStyle = `rgba(255,50,50,${0.5 + 0.5 * Math.sin(this.frame * 0.1)})`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(num.toString(), this.W / 2, this.H / 2);
        this.ctx.textAlign = 'left';
    }
}
