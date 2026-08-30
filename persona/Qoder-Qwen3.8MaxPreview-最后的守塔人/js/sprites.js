/**
 * 最后的守塔人 - 像素精灵与场景绘制
 * 所有图形均通过Canvas像素级绘制，无外部资源
 */

const Sprites = {
    // 调色板
    palette: {
        sky_sunset: ['#1a0a2e', '#2d1b4e', '#5c2d6e', '#a83279', '#e85d4a', '#ff9a3c', '#ffd93d'],
        sky_storm: ['#0a0a12', '#12121f', '#1a1a2e', '#22223a', '#2a2a44'],
        sky_night: ['#050510', '#0a0a1a', '#0f0f24', '#14142e', '#1a1a38'],
        sky_dawn: ['#0a1a2e', '#1a3a5e', '#2a5a7e', '#4a8aae', '#7abade', '#aad4f0', '#ddeeff'],
        sea: ['#0a2a3a', '#0d3a4a', '#1a4a5a', '#2a5a6a', '#3a6a7a'],
        sea_storm: ['#0a1a2a', '#0d2233', '#102a3a', '#143344', '#183a4a'],
        rock: ['#2a2a2a', '#3a3a3a', '#4a4a4a', '#5a5a5a'],
        lighthouse: ['#e8e8e8', '#d0d0d0', '#b8b8b8', '#cc3333', '#aa2222'],
        lamp: ['#ffee88', '#ffdd44', '#ffcc00', '#ffaa00'],
        keeper: ['#3a3a4a', '#4a4a5a', '#5a5a6a', '#dda877', '#cc9966', '#888888']
    },

    // 绘制像素矩形（带抖动效果）
    pixelRect(ctx, x, y, w, h, color, dither = false) {
        ctx.fillStyle = color;
        if (dither) {
            for (let py = 0; py < h; py += 2) {
                for (let px = (py % 4 === 0 ? 0 : 1); px < w; px += 2) {
                    ctx.fillRect(x + px, y + py, 1, 1);
                }
            }
        } else {
            ctx.fillRect(x, y, w, h);
        }
    },

    // 绘制天空渐变
    drawSky(ctx, w, h, palette, time) {
        const bandH = Math.ceil(h * 0.6 / palette.length);
        for (let i = 0; i < palette.length; i++) {
            this.pixelRect(ctx, 0, i * bandH, w, bandH + 1, palette[i]);
            // 抖动过渡
            if (i < palette.length - 1) {
                this.pixelRect(ctx, 0, (i + 1) * bandH - 2, w, 4, palette[i + 1], true);
            }
        }
    },

    // 绘制星星
    drawStars(ctx, w, h, time, count = 30, alpha = 1) {
        for (let i = 0; i < count; i++) {
            const sx = (i * 97 + 13) % w;
            const sy = (i * 53 + 7) % (h * 0.4);
            const twinkle = Math.sin(time * 2 + i * 1.7) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 255, 240, ${twinkle * alpha})`;
            const size = (i % 3 === 0) ? 2 : 1;
            ctx.fillRect(sx, sy, size, size);
        }
    },

    // 绘制海面
    drawSea(ctx, w, h, time, palette, intensity = 1) {
        const seaTop = h * 0.6;
        const seaH = h - seaTop;
        const bandH = Math.ceil(seaH / palette.length);
        
        for (let i = 0; i < palette.length; i++) {
            const y = seaTop + i * bandH;
            this.pixelRect(ctx, 0, y, w, bandH + 1, palette[i]);
        }
        
        // 波浪
        for (let layer = 0; layer < 3; layer++) {
            const waveY = seaTop + layer * 12 + 5;
            const speed = (layer + 1) * 0.8;
            const amp = (3 + layer * 2) * intensity;
            ctx.fillStyle = `rgba(180, 220, 255, ${0.15 - layer * 0.03})`;
            for (let x = 0; x < w; x += 2) {
                const wy = waveY + Math.sin((x * 0.02) + time * speed) * amp;
                ctx.fillRect(x, wy, 2, 1);
            }
        }
    },

    // 绘制礁石
    drawRocks(ctx, w, h) {
        const baseY = h * 0.62;
        ctx.fillStyle = this.palette.rock[1];
        // 左侧礁石
        ctx.beginPath();
        ctx.moveTo(0, baseY + 20);
        ctx.lineTo(30, baseY - 5);
        ctx.lineTo(60, baseY + 5);
        ctx.lineTo(90, baseY - 10);
        ctx.lineTo(120, baseY + 15);
        ctx.lineTo(120, h);
        ctx.lineTo(0, h);
        ctx.fill();
        
        ctx.fillStyle = this.palette.rock[2];
        ctx.beginPath();
        ctx.moveTo(w - 100, baseY + 10);
        ctx.lineTo(w - 70, baseY - 8);
        ctx.lineTo(w - 40, baseY + 5);
        ctx.lineTo(w, baseY - 5);
        ctx.lineTo(w, h);
        ctx.lineTo(w - 100, h);
        ctx.fill();

        // 像素纹理
        ctx.fillStyle = this.palette.rock[3];
        for (let i = 0; i < 20; i++) {
            const rx = (i * 37) % 120;
            const ry = baseY + 5 + (i * 13) % 30;
            ctx.fillRect(rx, ry, 2, 1);
        }
    },

    // 绘制灯塔
    drawLighthouse(ctx, x, baseY, time, lit = false, lightAngle = 0) {
        const towerH = 100;
        const towerW = 24;
        const topW = 30;
        
        // 塔身（白红条纹）
        for (let i = 0; i < towerH; i += 2) {
            const ratio = i / towerH;
            const curW = towerW - ratio * 6;
            const stripe = Math.floor(i / 14) % 2 === 0;
            ctx.fillStyle = stripe ? this.palette.lighthouse[0] : this.palette.lighthouse[3];
            ctx.fillRect(x - curW / 2, baseY - i - 2, curW, 2);
        }
        
        // 塔顶灯室
        const lampY = baseY - towerH - 16;
        ctx.fillStyle = '#333340';
        ctx.fillRect(x - topW / 2, lampY, topW, 16);
        
        // 灯室玻璃
        ctx.fillStyle = lit ? this.palette.lamp[0] : '#2a3a4a';
        ctx.fillRect(x - topW / 2 + 3, lampY + 3, topW - 6, 10);
        
        // 灯顶
        ctx.fillStyle = '#222230';
        ctx.fillRect(x - topW / 2 - 2, lampY - 4, topW + 4, 4);
        ctx.fillRect(x - 4, lampY - 10, 8, 6);
        
        // 灯光光束
        if (lit) {
            const beamLen = 200;
            const angle = lightAngle;
            const bx = x + Math.cos(angle) * beamLen;
            const by = lampY + 8 + Math.sin(angle) * beamLen * 0.3;
            
            const grad = ctx.createLinearGradient(x, lampY + 8, bx, by);
            grad.addColorStop(0, 'rgba(255, 238, 136, 0.6)');
            grad.addColorStop(1, 'rgba(255, 238, 136, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x, lampY + 5);
            ctx.lineTo(bx, by - 20);
            ctx.lineTo(bx, by + 20);
            ctx.closePath();
            ctx.fill();
            
            // 灯光光晕
            ctx.fillStyle = `rgba(255, 238, 100, ${0.3 + Math.sin(time * 3) * 0.1})`;
            ctx.beginPath();
            ctx.arc(x, lampY + 8, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 门
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x - 5, baseY - 14, 10, 14);
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(x - 4, baseY - 12, 8, 12);
    },

    // 绘制守塔人
    drawKeeper(ctx, x, y, time, frame = 'idle') {
        const bob = frame === 'idle' ? Math.sin(time * 2) * 1 : 0;
        const py = y + bob;
        
        // 身体（深色外套）
        ctx.fillStyle = this.palette.keeper[0];
        ctx.fillRect(x - 4, py - 16, 8, 12);
        
        // 外套细节
        ctx.fillStyle = this.palette.keeper[1];
        ctx.fillRect(x - 3, py - 15, 2, 10);
        
        // 头
        ctx.fillStyle = this.palette.keeper[3];
        ctx.fillRect(x - 3, py - 23, 6, 6);
        
        // 帽子
        ctx.fillStyle = this.palette.keeper[5];
        ctx.fillRect(x - 4, py - 25, 8, 3);
        ctx.fillRect(x - 3, py - 27, 6, 2);
        
        // 腿
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(x - 3, py - 4, 3, 5);
        ctx.fillRect(x + 1, py - 4, 3, 5);
        
        // 手臂动画
        if (frame === 'wave' || frame === 'look_up') {
            ctx.fillStyle = this.palette.keeper[0];
            ctx.fillRect(x + 4, py - 18, 3, 2);
            ctx.fillRect(x + 6, py - 20, 2, 3);
        } else {
            ctx.fillStyle = this.palette.keeper[0];
            ctx.fillRect(x - 6, py - 14, 2, 6);
            ctx.fillRect(x + 4, py - 14, 2, 6);
        }
        
        // 烟斗（微弱的光点）
        if (frame === 'idle' || frame === 'sit') {
            const smokeAlpha = Math.sin(time * 4) * 0.3 + 0.4;
            ctx.fillStyle = `rgba(255, 150, 50, ${smokeAlpha})`;
            ctx.fillRect(x + 5, py - 20, 1, 1);
            // 烟
            ctx.fillStyle = `rgba(200, 200, 210, ${smokeAlpha * 0.4})`;
            ctx.fillRect(x + 5, py - 22 - Math.sin(time) * 2, 1, 1);
            ctx.fillRect(x + 6, py - 25 - Math.sin(time + 1) * 2, 1, 1);
        }
    },

    // 绘制小船
    drawBoat(ctx, x, y, time) {
        const bob = Math.sin(time * 1.5) * 2;
        const by = y + bob;
        
        // 船体
        ctx.fillStyle = '#5a4a3a';
        ctx.beginPath();
        ctx.moveTo(x - 12, by);
        ctx.lineTo(x - 8, by + 5);
        ctx.lineTo(x + 8, by + 5);
        ctx.lineTo(x + 12, by);
        ctx.closePath();
        ctx.fill();
        
        // 桅杆
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x, by - 14, 2, 14);
        
        // 帆
        ctx.fillStyle = '#ddd8cc';
        ctx.beginPath();
        ctx.moveTo(x + 2, by - 13);
        ctx.lineTo(x + 2, by - 3);
        ctx.lineTo(x + 10, by - 5);
        ctx.closePath();
        ctx.fill();
    },

    // 绘制闪电
    drawLightning(ctx, w, h, progress) {
        if (progress <= 0 || progress >= 1) return;
        const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        ctx.strokeStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let lx = w * 0.3 + Math.random() * w * 0.4;
        let ly = 0;
        ctx.moveTo(lx, ly);
        for (let i = 0; i < 6; i++) {
            lx += (Math.random() - 0.5) * 30;
            ly += h * 0.1;
            ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        
        // 闪光效果
        ctx.fillStyle = `rgba(200, 210, 255, ${alpha * 0.1})`;
        ctx.fillRect(0, 0, w, h);
    },

    // 绘制雨
    drawRain(ctx, w, h, time, intensity = 1) {
        ctx.fillStyle = 'rgba(150, 180, 220, 0.3)';
        const drops = Math.floor(60 * intensity);
        for (let i = 0; i < drops; i++) {
            const rx = (i * 73 + time * 200) % w;
            const ry = (i * 47 + time * 400) % h;
            ctx.fillRect(rx, ry, 1, 4);
        }
    },

    // 绘制云层
    drawClouds(ctx, w, h, time, dark = false) {
        const color = dark ? 'rgba(20, 20, 35, 0.8)' : 'rgba(60, 60, 80, 0.4)';
        for (let i = 0; i < 5; i++) {
            const cx = ((i * 150 + time * 10) % (w + 100)) - 50;
            const cy = 20 + i * 15;
            ctx.fillStyle = color;
            ctx.fillRect(cx, cy, 60, 8);
            ctx.fillRect(cx + 10, cy - 5, 40, 6);
            ctx.fillRect(cx + 5, cy + 7, 50, 5);
        }
    },

    // 绘制飞鸟
    drawBirds(ctx, w, h, time) {
        ctx.strokeStyle = 'rgba(40, 40, 50, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const bx = ((time * 20 + i * 80) % (w + 40)) - 20;
            const by = 40 + i * 20 + Math.sin(time * 3 + i) * 5;
            const wing = Math.sin(time * 8 + i * 2) * 3;
            ctx.beginPath();
            ctx.moveTo(bx - 4, by + wing);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + 4, by + wing);
            ctx.stroke();
        }
    },

    // 绘制灯塔光旋转效果（俯视投影到海面）
    drawLightReflection(ctx, w, h, time, lit) {
        if (!lit) return;
        const seaTop = h * 0.6;
        const angle = time * 0.5;
        const rx = w * 0.5 + Math.cos(angle) * 100;
        
        const grad = ctx.createLinearGradient(rx, seaTop, rx, h);
        grad.addColorStop(0, 'rgba(255, 238, 136, 0.2)');
        grad.addColorStop(1, 'rgba(255, 238, 136, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(rx - 8, seaTop, 16, h - seaTop);
    }
};
