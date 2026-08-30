// HUD / 工具条 / 结算遮罩 / Toast。所有可点矩形都注册进 HitTree，
// 画在哪就能点在哪（现版是两处各自硬编码像素，异形屏必错位）。
import { Rect, HitTree, roundRectPath, hslice } from './layout';
import { COLOR, font } from '../render/theme';

export interface ItemState {
  hint: number;
  shuffle: number;
  hammer: number;
  undo: boolean;
  muted: boolean;
}

const LABELS: Record<string, { zh: string; en: string }> = {
  undo: { zh: '撤销', en: 'Undo' },
  hint: { zh: '提示', en: 'Hint' },
  shuffle: { zh: '洗牌', en: 'Shuffle' },
  hammer: { zh: '锤子', en: 'Hammer' },
  menu: { zh: '菜单', en: 'Menu' },
  next: { zh: '下一关', en: 'Next' },
  retry: { zh: '再来一次', en: 'Retry' },
  levels: { zh: '选关', en: 'Levels' },
  start: { zh: '开始游戏', en: 'Play' },
  continue: { zh: '继续第 ', en: 'Continue ' },
  soundOn: { zh: '音效 开', en: 'Sound on' },
  soundOff: { zh: '音效 关', en: 'Sound off' },
};

export function label(key: string, lang: 'zh' | 'en'): string {
  const l = LABELS[key];
  return l ? (lang === 'zh' ? l.zh : l.en) : key;
}

function pill(
  ctx: any,
  hits: HitTree,
  r: Rect,
  text: string,
  opts: { id?: string; tone?: 'plain' | 'primary' | 'danger'; disabled?: boolean; z?: number } = {},
): void {
  const tone = opts.tone || 'plain';
  ctx.save();
  ctx.globalAlpha = opts.disabled ? 0.42 : 1;
  ctx.fillStyle = tone === 'primary' ? COLOR.ok : tone === 'danger' ? '#E88C7A' : 'rgba(255,255,255,0.9)';
  roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = tone === 'plain' ? 'rgba(150,138,124,0.5)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = tone === 'plain' ? COLOR.ink : '#FFFFFF';
  ctx.font = font(Math.min(r.h * 0.42, r.w * 0.2), true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
  if (opts.id && !opts.disabled && opts.id) hits.add(opts.id, r, opts.z ?? 5);
}

export function drawHud(
  ctx: any,
  r: Rect,
  o: { levelNo: number; segName: string; removed: number; goal: number; score: number; timeLeft: number | null; lang: 'zh' | 'en' },
): void {
  ctx.save();
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(22, r.h * 0.34), true);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(
    (o.lang === 'zh' ? '第 ' : 'Lv ') + o.levelNo + (o.lang === 'zh' ? ' 关' : ''),
    r.x,
    r.y,
  );
  ctx.font = font(12.5);
  ctx.fillStyle = COLOR.sub;
  ctx.fillText(o.segName, r.x, r.y + Math.min(26, r.h * 0.42));

  ctx.textAlign = 'right';
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(22, r.h * 0.34), true);
  // 目标量是本局唯一要紧的信息，字号给足并写明单位是「子」
  ctx.fillText(
    o.removed + ' / ' + o.goal + (o.lang === 'zh' ? ' 子' : ''),
    r.x + r.w,
    r.y,
  );
  ctx.font = font(12.5);
  ctx.fillStyle = COLOR.sub;
  const right =
    o.timeLeft != null
      ? (o.lang === 'zh' ? '剩 ' : '') + Math.max(0, Math.ceil(o.timeLeft)) + (o.lang === 'zh' ? ' 秒' : 's') +
        ' · ' + (o.lang === 'zh' ? '分 ' : '') + o.score
      : (o.lang === 'zh' ? '得分 ' : 'Score ') + o.score;
  ctx.fillText(right, r.x + r.w, r.y + Math.min(26, r.h * 0.42));

  // 目标进度条：贴在 HUD 底缘，随消除量增长
  const bar: Rect = { x: r.x, y: r.y + r.h - 7, w: r.w, h: 7 };
  ctx.fillStyle = 'rgba(120,108,96,0.16)';
  roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2);
  ctx.fill();
  const p = Math.max(0, Math.min(1, o.removed / o.goal));
  if (p > 0) {
    ctx.fillStyle = COLOR.ok;
    roundRectPath(ctx, bar.x, bar.y, Math.max(bar.h, bar.w * p), bar.h, bar.h / 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawToolbar(
  ctx: any,
  hits: HitTree,
  r: Rect,
  items: ItemState,
  lang: 'zh' | 'en',
  z = 5,
): void {
  const keys = ['undo', 'hint', 'shuffle', 'hammer', 'menu'];
  const cells = hslice(r, keys.length, 8);
  keys.forEach((k, i) => {
    const c = cells[i];
    let text = label(k, lang);
    let disabled = false;
    if (k === 'undo') disabled = !items.undo;
    if (k === 'hint') {
      disabled = items.hint <= 0;
      text += items.hint > 0 ? ' ×' + items.hint : '';
    }
    if (k === 'shuffle') {
      disabled = items.shuffle <= 0;
      text += items.shuffle > 0 ? ' ×' + items.shuffle : '';
    }
    if (k === 'hammer') {
      disabled = items.hammer <= 0;
      text += items.hammer > 0 ? ' ×' + items.hammer : '';
    }
    pill(ctx, hits, c, text, { id: 'btn.' + k, disabled, z });
  });
}

export function drawSoundToggle(ctx: any, hits: HitTree, r: Rect, on: boolean, lang: 'zh' | 'en'): void {
  const box: Rect = { x: r.x + r.w - 76, y: r.y, w: 76, h: 26 };
  pill(ctx, hits, box, label(on ? 'soundOn' : 'soundOff', lang), { id: 'btn.sound', z: 6 });
}

/** 结算遮罩：通关 / 失败。按钮之外的区域不响应（现版点任意处即跳关） */
export function drawResult(
  ctx: any,
  hits: HitTree,
  box: Rect,
  o: {
    won: boolean;
    stars: number;
    score: number;
    removed: number;
    goal: number;
    checkmate: boolean;
    reason?: string;
    hasNext: boolean;
    lang: 'zh' | 'en';
    t: number; // 0..1 入场进度
  },
): void {
  const a = Math.min(1, o.t);
  ctx.save();
  ctx.fillStyle = 'rgba(250,246,238,' + (0.9 * a).toFixed(3) + ')';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = a;

  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.36;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(34, box.w * 0.09), true);
  ctx.fillText(o.won ? (o.lang === 'zh' ? '通关！' : 'Cleared!') : o.lang === 'zh' ? '这一步走不通' : 'No way out', cx, cy);

  if (o.won) {
    // 三颗星：每颗 180ms 连击入场
    const R = Math.min(26, box.w * 0.06);
    for (let i = 0; i < 3; i++) {
      const t = Math.max(0, Math.min(1, (o.t * 1.4 - 0.2 - i * 0.16) * 4));
      const x = cx + (i - 1) * R * 2.6;
      const y = cy + R * 2.4;
      ctx.save();
      ctx.globalAlpha = a * t;
      ctx.translate(x, y);
      ctx.scale(1 + (1 - t) * 0.5, 1 + (1 - t) * 0.5);
      star(ctx, 0, 0, R, i < o.stars ? '#F7BE55' : 'rgba(160,148,134,0.28)');
      ctx.restore();
    }
    ctx.fillStyle = COLOR.sub;
    ctx.font = font(14);
    ctx.fillText(
      (o.lang === 'zh' ? '得分 ' : 'Score ') + o.score + '   ' + o.removed + '/' + o.goal,
      cx,
      cy + R * 4.4,
    );
    if (o.checkmate) {
      ctx.fillStyle = '#C0392B';
      ctx.font = font(16, true);
      ctx.fillText(o.lang === 'zh' ? '将杀！六色全部收齐' : 'Checkmate! All six colors', cx, cy + R * 6.2);
    }
  } else if (o.reason) {
    ctx.fillStyle = COLOR.sub;
    ctx.font = font(14);
    ctx.fillText(o.reason, cx, cy + 34);
  }

  const bw = Math.min(150, box.w * 0.34);
  const bh = 46;
  const by = box.y + box.h * 0.72;
  if (o.won && o.hasNext) {
    pill(ctx, hits, { x: cx - bw - 6, y: by, w: bw, h: bh }, label('next', o.lang), { id: 'btn.next', tone: 'primary', z: 20 });
    pill(ctx, hits, { x: cx + 6, y: by, w: bw, h: bh }, label('levels', o.lang), { id: 'btn.levels', z: 20 });
  } else {
    pill(ctx, hits, { x: cx - bw - 6, y: by, w: bw, h: bh }, label('retry', o.lang), { id: 'btn.retry', tone: 'primary', z: 20 });
    pill(ctx, hits, { x: cx + 6, y: by, w: bw, h: bh }, label('levels', o.lang), { id: 'btn.levels', z: 20 });
  }
  ctx.restore();
}

function star(ctx: any, cx: number, cy: number, r: number, fill: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** 机制教学条：出现在棋盘上方，几秒后淡出 */
export function drawToast(ctx: any, box: Rect, text: string, t: number): void {
  if (t <= 0) return;
  const a = Math.min(1, t * 2.2);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = font(14, true);
  const w = Math.min(box.w - 24, ctx.measureText(text).width + 34);
  const r: Rect = { x: box.x + (box.w - w) / 2, y: box.y + 6, w, h: 34 };
  ctx.fillStyle = 'rgba(67,57,47,0.9)';
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 17);
  ctx.fill();
  ctx.fillStyle = '#FFF8EC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
}

export function drawTitle(ctx: any, box: Rect, o: { lang: 'zh' | 'en'; unlocked: number; best: number }): void {
  const cx = box.x + box.w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLOR.ink;
  ctx.font = font(Math.min(46, box.w * 0.12), true);
  ctx.fillText(o.lang === 'zh' ? '六边智将' : 'HEXACHESS', cx, box.y + box.h * 0.26);
  ctx.font = font(15);
  ctx.fillStyle = COLOR.sub;
  ctx.fillText(
    o.lang === 'zh' ? '同色成塔 · 叠满十子即消' : 'Stack one colour ten deep',
    cx,
    box.y + box.h * 0.26 + Math.min(54, box.w * 0.14),
  );
  ctx.restore();
}
