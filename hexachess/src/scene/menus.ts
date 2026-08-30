// 主菜单与选关。选关是纯网格 + HitTree，没有硬编码像素命中。
import { Scene, SceneHost } from './scene';
import { Rect, HitTree, vstack, hslice, roundRectPath } from '../view/layout';
import { COLOR, UI, font } from '../render/theme';
import { LEVELS, TOTAL_LEVELS, isUnlocked, segmentOf } from '../data/levels';
import { label } from '../view/ui';

function button(ctx: any, hits: HitTree, r: Rect, text: string, id: string, tone: 'plain' | 'primary' = 'plain'): void {
  ctx.save();
  ctx.fillStyle = tone === 'primary' ? COLOR.ok : 'rgba(255,255,255,0.88)';
  roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = tone === 'primary' ? 'rgba(0,0,0,0.05)' : 'rgba(150,138,124,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = tone === 'primary' ? '#FFFFFF' : COLOR.ink;
  ctx.font = font(r.h * 0.38, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
  hits.add(id, r, 5);
}

export class MenuScene implements Scene {
  readonly name = 'menu';
  constructor(private host: SceneHost) {}

  update(): void {}

  render(ctx: any, w: number, h: number): void {
    const hits = this.host.hits;
    hits.clear();
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);
    const box: Rect = { x: 24, y: 24, w: w - 48, h: h - 48 };
    const parts = vstack(box, [{ id: 'top', flex: 1 }, { id: 'c1', h: 54 }, { id: 'gap', h: 12 }, { id: 'c2', h: 54 }, { id: 'foot', h: 40 }], 0);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = box.x + box.w / 2;
    ctx.fillStyle = COLOR.ink;
    ctx.font = font(Math.min(52, box.w * 0.14), true);
    ctx.fillText(this.host.lang() === 'zh' ? '六边智将' : 'HEXACHESS', cx, parts.top.y + parts.top.h * 0.42);
    ctx.font = font(15);
    ctx.fillStyle = COLOR.sub;
    ctx.fillText(
      this.host.lang() === 'zh' ? '同色成塔 · 叠满十子即消' : 'Stack one colour ten deep',
      cx,
      parts.top.y + parts.top.h * 0.42 + Math.min(62, box.w * 0.16),
    );
    ctx.font = font(13);
    ctx.fillText(
      (this.host.lang() === 'zh' ? '已解锁 ' : 'Unlocked ') + Math.min(TOTAL_LEVELS, this.host.save.unlocked) +
        ' / ' + TOTAL_LEVELS + '   ' + (this.host.lang() === 'zh' ? '最高分 ' : 'Best ') + this.host.save.best,
      cx,
      parts.top.y + parts.top.h * 0.42 + Math.min(96, box.w * 0.24),
    );
    ctx.restore();

    const cont = this.host.save.unlocked > 1;
    button(ctx, hits, parts.c1, cont
      ? label('continue', this.host.lang()) + this.host.save.unlocked + (this.host.lang() === 'zh' ? ' 关' : '')
      : label('start', this.host.lang()), 'btn.play', 'primary');
    button(ctx, hits, parts.c2, label('levels', this.host.lang()), 'btn.levels');

    const foot = hslice(parts.foot, 3, 8);
    button(ctx, hits, foot[1], label(this.host.save.muted ? 'soundOff' : 'soundOn', this.host.lang()), 'btn.sound');
    button(ctx, hits, foot[2], this.host.lang() === 'zh' ? 'EN' : '中文', 'btn.lang');
  }

  pointer(e: { phase: string; x: number; y: number }): void {
    if (e.phase !== 'up') return;
    const id = this.host.hits.pick(e.x, e.y);
    if (!id) return;
    this.host.audio.play('click');
    if (id === 'btn.play') this.host.replace('game', this.host.levelAt(Math.min(TOTAL_LEVELS, this.host.save.unlocked)));
    else if (id === 'btn.levels') this.host.replace('levels');
    else if (id === 'btn.sound') {
      this.host.save.muted = !this.host.save.muted;
      this.host.audio.setMuted(this.host.save.muted);
      this.host.persist();
    } else if (id === 'btn.lang') {
      this.host.save.lang = this.host.lang() === 'zh' ? 'en' : 'zh';
      this.host.persist();
    }
  }
}

export class LevelsScene implements Scene {
  readonly name = 'levels';
  private cols = 6;

  constructor(private host: SceneHost) {}

  update(): void {}

  render(ctx: any, w: number, h: number): void {
    const hits = this.host.hits;
    hits.clear();
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);
    const box: Rect = { x: 18, y: 18, w: w - 36, h: h - 36 };
    const parts = vstack(box, [{ id: 'head', h: 52 }, { id: 'grid', flex: 1 }, { id: 'back', h: 48 }], 8);

    ctx.save();
    ctx.fillStyle = COLOR.ink;
    ctx.font = font(20, true);
    ctx.textBaseline = 'middle';
    ctx.fillText(this.host.lang() === 'zh' ? '选关' : 'Levels', parts.head.x, parts.head.y + 26);
    ctx.font = font(12.5);
    ctx.fillStyle = COLOR.sub;
    ctx.textAlign = 'right';
    ctx.fillText(TOTAL_LEVELS + ' ' + (this.host.lang() === 'zh' ? '关 · 每关都经求解器验证可解' : 'levels · each verified solvable'), parts.head.x + parts.head.w, parts.head.y + 26);
    ctx.restore();

    const g = parts.grid;
    const cols = Math.max(4, Math.min(9, Math.floor(g.w / 62)));
    this.cols = cols;
    const rows = Math.ceil(TOTAL_LEVELS / cols);
    const cw = g.w / cols;
    const ch = g.h / rows;
    LEVELS.forEach((lv, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const cell: Rect = { x: g.x + c * cw + 3, y: g.y + r * ch + 3, w: cw - 6, h: ch - 6 };
      const open = isUnlocked(this.host.save.unlocked, lv.id);
      const stars = this.host.save.stars[String(lv.id)] || 0;
      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.4;
      ctx.fillStyle = open ? 'rgba(255,255,255,0.9)' : 'rgba(226,218,206,0.5)';
      roundRectPath(ctx, cell.x, cell.y, cell.w, cell.h, 10);
      ctx.fill();
      if (open) {
        ctx.strokeStyle = 'rgba(150,138,124,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = COLOR.ink;
      ctx.font = font(Math.min(19, cell.w * 0.34), true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(lv.id), cell.x + cell.w / 2, cell.y + cell.h * 0.38);
      // 三颗星
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < stars ? '#F7BE55' : 'rgba(160,148,134,0.3)';
        ctx.beginPath();
        ctx.arc(cell.x + cell.w / 2 + (s - 1) * 11, cell.y + cell.h * 0.72, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (open) hits.add('lv:' + lv.id, cell, 4);
    });
    button(ctx, hits, parts.back, label('menu', this.host.lang()), 'btn.back');
  }

  pointer(e: { phase: string; x: number; y: number }): void {
    if (e.phase !== 'up') return;
    const id = this.host.hits.pick(e.x, e.y);
    if (!id) return;
    this.host.audio.play('click');
    if (id === 'btn.back') return this.host.replace('menu');
    if (id.indexOf('lv:') === 0) {
      const lv = this.host.levelAt(Number(id.slice(3)));
      if (lv) this.host.replace('game', lv);
    }
  }
}

export { segmentOf, UI };
