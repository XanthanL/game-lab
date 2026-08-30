// 游戏场景：把逻辑事件（Ev[]）翻译成动画与音效，处理拖拽、道具、结算。
// 关键点：输入只在 hit-stop 与消除后 150ms 内锁定（现版整段合并动画全程锁死）；
// 落点预览与真正落子共用 rules.ts 的同一个判定函数。
import { GameState, LevelDef, createGame, isPure, topColor, topRun } from '../logic/state';
import {
  Ev, applyMove, applyPlace, advance, movePlan, placePlan, receivable, useHammer, useShuffle,
} from '../logic/rules';
import { findHint } from '../logic/hint';
import { decodeAction } from '../logic/solver';
import { isCheckmate, starsOf, applyScore } from '../logic/scorer';
import { computeLayout, drawBoard, drawTray, cellAt, DragVisual, CellVisual } from '../render/boardView';
import { Fx } from '../render/fx';
import { DUR, COLOR, UI, skin } from '../render/theme';
import { Rect, hslice, vstack } from '../view/layout';
import { drawHud, drawResult, drawToast, drawToolbar, label } from '../view/ui';
import { segmentOf } from '../data/levels';
import { Scene, SceneHost } from './scene';
import { PtrEvent } from '../platform/input';

interface Effect {
  t: number;
  dur: number;
  kind: 'land' | 'ghost' | 'glow';
  cell: number;
  color: number;
  count: number;
}

export class GameScene implements Scene {
  readonly name = 'game';
  st!: GameState;
  private fx = new Fx(false);
  private effects: Effect[] = [];
  private undoStack: GameState[] = [];
  private drag: DragVisual | null = null;
  private dragFrom: { tray?: number; cell?: number } | null = null;
  private lockT = 0;
  private hintCell: number | null = null;
  private hintT = 0;
  private toast = '';
  private toastT = 0;
  private overT = 0;
  private time = 0;
  private stars = 0;
  private checkmate = false;
  private armedHammer = false;
  private autoplay: { queue: string[]; timer: number } | null = null;
  private box!: Rect;
  private areas!: { hud: Rect; board: Rect; tray: Rect; bar: Rect };
  private boardLayout!: ReturnType<typeof computeLayout>;
  private layerH = 10;
  // 首帧之前也要有布局可用：主循环是「先 update 再 render」，
  // 而 update 里可能立刻产生事件并需要格子坐标
  private vw = 390;
  private vh = 700;

  constructor(private host: SceneHost) {}

  enter(arg?: unknown): void {
    const level = (arg as LevelDef) || this.host.levelAt(this.host.save.unlocked) || this.host.levelAt(1)!;
    this.st = createGame(level);
    this.fx = new Fx(this.host.reducedMotion());
    this.st.items = { ...this.st.items, ...this.host.save.items };
    this.effects.length = 0;
    this.undoStack.length = 0;
    this.drag = null;
    this.dragFrom = null;
    this.lockT = 0;
    this.hintCell = null;
    this.hintT = 0;
    this.overT = 0;
    this.stars = 0;
    this.checkmate = false;
    this.armedHammer = false;
    const tut = level.tutorial[0];
    if (tut) this.say(tutText(tut, this.host.lang()));
    // 开发用：按参考解自动走子，便于无头浏览器与肉眼验证「这关确实照解法能通」
    if (this.host.autoplay() && level.solution.length) {
      this.autoplay = { queue: level.solution.slice(), timer: 0.35 };
    }
  }

  private say(text: string): void {
    this.toast = text;
    this.toastT = 3.4;
  }

  private relayout(w: number, h: number): void {
    const pad = 14;
    this.box = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
    const parts = vstack(this.box, [
      { id: 'hud', h: UI.hud },
      { id: 'board', flex: 1, pad: 8 },
      { id: 'tray', h: UI.tray },
      { id: 'bar', h: UI.toolbar },
    ], 6);
    this.areas = { hud: parts.hud, board: parts.board, tray: parts.tray, bar: parts.bar };
    this.boardLayout = computeLayout(parts.board, this.st.cells);
    this.layerH = Math.max(4, this.boardLayout.size * 0.3);
  }

  private slots(): Rect[] {
    return hslice(this.areas.tray, 3, 10);
  }

  update(dt: number): void {
    if (!this.boardLayout) this.relayout(this.vw, this.vh);
    this.time += dt;
    this.lockT = Math.max(0, this.lockT - dt);
    this.toastT = Math.max(0, this.toastT - dt);
    this.hintT = Math.max(0, this.hintT - dt);
    if (!this.hintT) this.hintCell = null;
    if (this.st.status !== 'playing') this.overT = Math.min(1, this.overT + dt / (DUR.overlay / 1000));

    if (this.fx.hitStop > 0) {
      // hit-stop：逻辑冻结，特效照跑
      this.fx.hitStop = Math.max(0, this.fx.hitStop - dt);
    } else if (this.st.status === 'playing') {
      const evs = advance(this.st, dt);
      if (evs.length) this.onEvents(evs);
    }
    if (this.autoplay && this.st.status === 'playing' && this.lockT <= 0 && !this.fx.hitStop) {
      this.autoplay.timer -= dt;
      if (this.autoplay.timer <= 0) {
        const code = this.autoplay.queue.shift();
        this.autoplay.timer = 0.42;
        if (code) {
          const a = decodeAction(code);
          this.pushUndo();
          this.onEvents(a.k === 'place' ? applyPlace(this.st, a.tray, a.cell) : applyMove(this.st, a.from, a.to));
        } else this.autoplay = null;
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].t += dt;
      if (this.effects[i].t >= this.effects[i].dur) this.effects.splice(i, 1);
    }
    this.fx.update(dt);
  }

  private visFor(cell: number): CellVisual | null {
    let v: CellVisual | null = null;
    for (const e of this.effects) {
      if (e.cell !== cell) continue;
      const p = e.t / e.dur;
      v = v || {};
      if (e.kind === 'land') v.land = p;
      else if (e.kind === 'glow') v.glow = Math.max(v.glow || 0, 1 - p);
      else if (e.kind === 'ghost') v.ghost = { color: e.color, count: e.count, alpha: (1 - p) * 0.8 };
    }
    return v;
  }

  render(ctx: any, w: number, h: number): void {
    const hits = this.host.hits;
    hits.clear();
    this.vw = w;
    this.vh = h;
    this.relayout(w, h);
    ctx.save();
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);
    this.fx.applyShake(ctx);

    const vis = new Map<number, CellVisual>();
    for (let i = 0; i < this.st.cells.length; i++) {
      const v = this.visFor(i);
      if (v) vis.set(i, v);
    }
    drawBoard(ctx, this.host.kit, this.boardLayout, this.st, vis, this.drag, this.hintCell, this.time, this.layerH);
    drawTray(ctx, this.host.kit, this.slots(), this.st, this.dragFrom?.tray ?? null, null, this.layerH);

    // 命中区与绘制同源
    this.slots().forEach((r, i) => {
      if (this.st.tray[i]) hits.add('tray:' + i, r, 3);
    });
    this.boardLayout.pos.forEach((p, i) => {
      if (!this.st.stacks[i].length) return;
      const r = this.boardLayout.size * 0.95;
      hits.add('cell:' + i, { x: p.x - r, y: p.y - r * 2.4, w: r * 2, h: r * 3.4 }, 2);
    });

    const tl = this.st.level.timeLimit;
    drawHud(ctx, this.areas.hud, {
      levelNo: this.st.level.id,
      segName: segmentOf(this.st.level.id).name,
      removed: this.st.removed,
      goal: this.st.level.goal,
      score: this.st.score,
      timeLeft: tl > 0 ? tl - this.st.clock : null,
      lang: this.host.lang(),
    });
    drawToolbar(ctx, hits, this.areas.bar, {
      hint: this.st.items.hint,
      shuffle: this.st.items.shuffle,
      hammer: this.st.items.hammer,
      undo: this.undoStack.length > 0,
      muted: this.host.save.muted,
    }, this.host.lang());
    this.fx.render(ctx);
    if (this.toastT > 0) drawToast(ctx, this.areas.board, this.toast, Math.min(1, this.toastT));

    if (this.st.status !== 'playing') {
      drawResult(ctx, hits, this.box, {
        won: this.st.status === 'won',
        stars: this.stars,
        score: this.st.score,
        removed: this.st.removed,
        goal: this.st.level.goal,
        checkmate: this.checkmate,
        reason: this.st.status === 'lost' ? loseText(this.st.loss, this.host.lang()) : undefined,
        hasNext: this.st.status === 'won' && this.st.level.id < this.host.totalLevels(),
        lang: this.host.lang(),
        t: this.overT,
      });
    }
    ctx.restore();
  }

  pointer(e: PtrEvent): void {
    const hits = this.host.hits;
    const id = hits.pick(e.x, e.y);
    if (this.st.status !== 'playing') {
      if (e.phase === 'up' && id) this.handleResultTap(id);
      return;
    }
    if (e.phase === 'down') {
      if (id && id.indexOf('btn.') === 0) {
        void this.onButton(id.slice(4));
        return;
      }
      if (this.armedHammer && id && id.indexOf('cell:') === 0) {
        this.armedHammer = false;
        this.pushUndo();
        this.onEvents(useHammer(this.st, Number(id.slice(5))));
        return;
      }
      if (this.lockT > 0) return;
      if (id && id.indexOf('tray:') === 0) this.beginTrayDrag(Number(id.slice(5)), e);
      else if (id && id.indexOf('cell:') === 0) this.beginCellDrag(Number(id.slice(5)), e);
      return;
    }
    if (e.phase === 'move' && this.drag) {
      this.drag.x = e.x;
      this.drag.y = e.y - UI.liftDrag;
      this.updatePreview(e.x, e.y);
      return;
    }
    if ((e.phase === 'up' || e.phase === 'cancel') && this.drag) {
      this.release(e.phase === 'cancel' ? null : cellAt(this.boardLayout, e.x, e.y));
    }
  }

  private beginTrayDrag(i: number, e: PtrEvent): void {
    const g = this.st.tray[i];
    if (!g || !g.length) return;
    this.dragFrom = { tray: i };
    this.drag = { color: topColor(g), count: g.length, x: e.x, y: e.y - UI.liftDrag, target: null, chain: [] };
    this.host.audio.play('pick');
  }

  private beginCellDrag(cell: number, e: PtrEvent): void {
    const s = this.st.stacks[cell];
    if (!s.length) return;
    this.dragFrom = { cell };
    this.drag = { color: topColor(s), count: topRun(s), x: e.x, y: e.y - UI.liftDrag, target: null, chain: [] };
    this.host.audio.play('pick');
  }

  private updatePreview(x: number, y: number): void {
    const drag = this.drag;
    const from = this.dragFrom;
    if (!drag || !from) return;
    const cell = cellAt(this.boardLayout, x, y);
    drag.target = null;
    drag.chain = [];
    if (cell < 0) return;
    if (from.tray != null) {
      const ok = !!placePlan(this.st, from.tray, cell);
      drag.target = { cell, kind: ok ? 'whole' : 'bad', count: drag.count };
      return;
    }
    const plan = movePlan(this.st, from.cell!, cell);
    if (!plan) {
      drag.target = { cell, kind: 'bad', count: 0 };
      return;
    }
    drag.target = { cell, kind: plan.k, count: plan.count };
    drag.chain = this.chainOf(cell);
  }

  /** 落下去后会被吸走的同色纯塔链 —— 提前画出来，级联才读得懂 */
  private chainOf(cell: number): number[] {
    const out: number[] = [];
    const seen = new Set<number>([cell]);
    let frontier = [cell];
    while (frontier.length) {
      const next: number[] = [];
      for (const c of frontier) {
        for (const nb of this.st.nbrs[c]) {
          if (seen.has(nb)) continue;
          const s = this.st.stacks[nb];
          if (!s.length || !isPure(s) || topColor(s) !== topColor(this.st.stacks[cell])) continue;
          seen.add(nb);
          out.push(nb);
          next.push(nb);
        }
      }
      frontier = next;
    }
    return out;
  }

  private release(cell: number | null): void {
    const drag = this.drag;
    const from = this.dragFrom;
    this.drag = null;
    this.dragFrom = null;
    if (!drag || !from) return;
    // cellAt 找不到格时返回 -1（不是 null）；这里漏挡会让 placePlan 摸到 st.stacks[-1] 抛错，
    // 而主循环把 raf 放在末尾，一次抛错就永久停摆
    if (cell == null || cell < 0) {
      this.host.audio.play('bounce');
      return;
    }
    this.pushUndo();
    const evs = from.tray != null ? applyPlace(this.st, from.tray, cell) : applyMove(this.st, from.cell!, cell);
    this.onEvents(evs);
  }

  private pushUndo(): void {
    this.undoStack.push(structuredClone(this.st));
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  private onEvents(evs: Ev[]): void {
    if (!evs.length) return;
    applyScore(this.st, evs);
    for (const e of evs) this.playEffect(e);
    if (evs.some((e) => e.k === 'clear' && e.chain >= 2)) this.fx.stop(DUR.hitStopCascade);
  }

  private playEffect(e: Ev): void {
    const pos = (i: number) => this.boardLayout.pos[i];
    const S = this.boardLayout.size;
    switch (e.k) {
      case 'place':
        this.effects.push({ t: 0, dur: DUR.place / 1000, kind: 'land', cell: e.cell, color: e.color, count: e.count });
        this.host.audio.play('place');
        break;
      case 'move':
      case 'fuse':
        this.effects.push({ t: 0, dur: DUR.mergePiece / 1000, kind: 'land', cell: e.to, color: e.color, count: e.count });
        this.effects.push({ t: 0, dur: DUR.ghostFade / 1000, kind: 'ghost', cell: e.from, color: e.color, count: e.count });
        this.effects.push({ t: 0, dur: 0.3, kind: 'glow', cell: e.to, color: e.color, count: e.count });
        this.host.audio.play('merge', { step: e.count });
        break;
      case 'clear': {
        this.effects.push({ t: 0, dur: DUR.clear / 1000, kind: 'glow', cell: e.cell, color: e.color, count: e.count });
        const p = pos(e.cell);
        if (p) {
          this.fx.burst(p.x, p.y - S * 0.4, skin(e.color).color, 22);
          this.fx.ring(p.x, p.y, skin(e.color).deep, S * 0.9);
          this.fx.addFlash(0.3);
        }
        this.fx.addShake(Math.min(4, 1.5 + e.chain));
        this.fx.stop(DUR.hitStopClear);
        this.lockT = DUR.inputLockClear / 1000;
        this.host.audio.play('clear');
        break;
      }
      case 'bounce':
        this.host.audio.play('bounce');
        break;
      case 'obstacle': {
        const p = pos(e.to);
        if (p) this.fx.ring(p.x, p.y, COLOR.obstacle, S * 0.7);
        break;
      }
      case 'win':
        this.onWin();
        break;
      case 'lose':
        this.fx.addShake(3);
        this.host.audio.play('fail');
        break;
      case 'refill':
      default:
        break;
    }
  }

  private onWin(): void {
    this.stars = starsOf(this.st);
    this.checkmate = isCheckmate(this.st);
    this.fx.stop(DUR.hitStopWin);
    this.host.audio.play(this.checkmate ? 'checkmate' : 'win');
    const id = String(this.st.level.id);
    this.host.save.stars[id] = Math.max(this.host.save.stars[id] || 0, this.stars);
    this.host.save.best = Math.max(this.host.save.best, this.st.score);
    this.host.save.unlocked = Math.max(this.host.save.unlocked, this.st.level.id + 1);
    this.host.save.items = { ...this.st.items };
    this.host.persist();
  }

  private handleResultTap(id: string): void {
    if (id === 'btn.next') {
      const nxt = this.host.levelAt(this.st.level.id + 1);
      if (nxt) return this.host.replace('game', nxt);
    }
    if (id === 'btn.retry') this.host.replace('game', this.st.level);
    else if (id === 'btn.levels') this.host.replace('levels');
  }

  private async onButton(key: string): Promise<void> {
    this.host.audio.play('click');
    if (key === 'menu') return this.host.replace('menu');
    if (key === 'sound') {
      this.host.save.muted = !this.host.save.muted;
      this.host.audio.setMuted(this.host.save.muted);
      return this.host.persist();
    }
    if (key === 'undo') {
      const prev = this.undoStack.pop();
      if (prev) {
        prev.used.undo += 1;
        this.st = prev;
        this.effects.length = 0;
        this.drag = null;
        this.dragFrom = null;
      }
      return;
    }
    if (key === 'hint') {
      if (!(await this.spendItem('hint'))) return;
      const h = findHint(this.st);
      if (!h.action) return this.say(this.host.lang() === 'zh' ? '确实没有更好的走了' : 'Nothing better here');
      this.hintCell = h.action.k === 'place' ? h.action.cell : h.action.to;
      this.hintT = 2.6;
      this.say(
        h.reason === 'solved'
          ? (this.host.lang() === 'zh' ? '这样走可以通关' : 'This keeps the level winnable')
          : this.host.lang() === 'zh' ? '来不及算到底，先这样走' : 'Best I can see right now',
      );
      return;
    }
    if (key === 'shuffle') {
      if (!(await this.spendItem('shuffle'))) return;
      this.pushUndo();
      this.onEvents(useShuffle(this.st));
      return;
    }
    if (key === 'hammer') {
      if (!(await this.spendItem('hammer'))) return;
      this.armedHammer = true;
      this.say(this.host.lang() === 'zh' ? '点一座塔，敲掉它最上面那颗' : 'Tap a tower to knock its top piece off');
    }
  }

  /** 道具次数用尽时看一次激励视频；浏览器试玩没有广告能力，直接放行 */
  private async spendItem(k: 'hint' | 'shuffle' | 'hammer'): Promise<boolean> {
    if (this.st.items[k] > 0) {
      this.st.items[k] -= 1;
      this.st.used[k] += 1;
      return true;
    }
    if (await this.host.rewardAd()) {
      this.st.used[k] += 1;
      this.say(this.host.lang() === 'zh' ? '已补上这一次' : 'Refilled');
      return true;
    }
    this.say(this.host.lang() === 'zh' ? '这个道具用完了' : 'Out of ' + k);
    return false;
  }
}

function tutText(key: string, lang: 'zh' | 'en'): string {
  const t = TUTORIAL[key];
  return t ? (lang === 'zh' ? t[0] : t[1]) : key;
}

function loseText(why: GameState['loss'], lang: 'zh' | 'en'): string {
  const m: Record<string, [string, string]> = {
    noaction: ['棋盘满了，没有能落的地方', 'Board is full — nowhere left to play'],
    supply: ['剩下的子凑不满目标了', 'Not enough pieces left to reach the goal'],
    timeout: ['时间到', 'Time up'],
  };
  const t = m[why || 'noaction'] || m.noaction;
  return lang === 'zh' ? t[0] : t[1];
}

/** 教程气泡文案：元组表 + 显式取值，避免把 key 直接甩到屏幕上 */
const TUTORIAL: Record<string, [string, string]> = {
  dragToEmpty: ['把下方的一摞拖到空格上', 'Drag a pile from the tray onto an empty cell'],
  partialTransfer: ['混色塔只把顶部同色那几颗送出去', 'Mixed towers give away only their top run'],
  lockedCell: ['斜纹格被锁住，不能落子', 'Hatched cells are locked'],
  cascade: ['同色纯塔会自动融合，凑满 10 就消', 'Same-colour pure towers fuse; ten clears'],
  finiteSupply: ['棋子有限，别乱丢', 'Pieces are limited — place with care'],
  timed: ['限时关：先想好长链再动手', 'Timed: plan the chain first'],
  obstacle: ['暖灰圆柱会移动，别把路堵死', 'The pillar moves — keep your lanes open'],
  checkmate: ['六色各消一组即为「将杀」', 'Clear a full tower of each colour: checkmate'],
};
