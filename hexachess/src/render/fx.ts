// 粒子 / 屏震 / hit-stop。原则：反馈强度与事件意义成比例，
// 且 prefers-reduced-motion 下屏震与粒子全关，只保留位移与色彩。
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  ring: boolean;
}

export class Fx {
  parts: Particle[] = [];
  shake = 0; // 剩余位移像素
  hitStop = 0; // 剩余秒数（逻辑冻结）
  flash = 0; // 全屏白闪 0..1

  reduced: boolean;

  constructor(reduced = false) {
    this.reduced = reduced;
  }

  burst(x: number, y: number, color: string, n = 14, power = 1): void {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = (60 + Math.random() * 150) * power;
      this.parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.25,
        max: 0.7,
        size: 2 + Math.random() * 3.2,
        color,
        ring: false,
      });
    }
  }

  ring(x: number, y: number, color: string, size = 10): void {
    if (this.reduced) return;
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.42, max: 0.42, size, color, ring: true });
  }

  addShake(px: number): void {
    if (!this.reduced) this.shake = Math.max(this.shake, px);
  }

  stop(ms: number): void {
    if (!this.reduced) this.hitStop = Math.max(this.hitStop, ms / 1000);
  }

  addFlash(v: number): void {
    if (!this.reduced) this.flash = Math.max(this.flash, v);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 3.4);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.ring) p.vy += 420 * dt; // 重力
    }
  }

  /** 屏震：以像素为单位平移画布，收敛要快 */
  applyShake(ctx: any): void {
    if (this.shake <= 0.01) return;
    const a = Math.random() * Math.PI * 2;
    ctx.translate(Math.cos(a) * this.shake, Math.sin(a) * this.shake);
  }

  render(ctx: any): void {
    if (!this.parts.length && this.flash <= 0) return;
    ctx.save();
    for (const p of this.parts) {
      const t = Math.max(0, p.life / p.max);
      ctx.globalAlpha = t;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + 3 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - t) * p.size * 3.4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash * 0.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2000, -2000, 4000, 4000);
    }
    ctx.restore();
  }
}
