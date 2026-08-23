import { PIECES, INK_COLOR, shade } from '../core/colors';
import { lerp, clamp } from '../render/draw';
import {
  drawBackground, drawTrayShelf, drawPieceStack, drawFlyingTile, drawCellStack, drawObstacle,
  STACK_STEP_RATIO,
} from '../render/sprites';
import { levels, LevelConfig } from '../data/levels';
import { hexMap, hexToPixel, fitHexLayout, hexDistance } from '../core/hex';
import { AudioEngine, createNoopAudio } from '../platform/audio';

const COMBO_WINDOW = 2.5;
const ACCEPT_SCALE = 1.25;
const TRAY_R = 30;            // 托盘组底子半径
const TRAY_SLOT_W = 92;       // 托盘组间距（仅 3 组，更宽裕）
const TRAY_GROUPS = 3;        // 托盘固定 3 组（用户要求保持 3 组）
const FLY_INTERVAL = 0.11;      // 每颗棋子起飞的间隔（拉大→逐块更清晰）
const FLY_DURATION = 0.24;      // 单颗飞行时长
const ARC_HOP = 0.55;           // 飞行弧线高度（像素半径倍数，制造"一块块摞上去"的层次）
const LAND_DURATION = 0.16;     // 落地挤压回弹时长
const OB_STAY = 4.0;            // 移动障碍：驻留时长
const OB_OUT = 0.35;            // 移动障碍：缩出时长
const OB_IN = 0.35;             // 移动障碍：缩入时长
const TILT = 0.80;              // 棋盘俯角压缩（<1 即立体俯视；配合旋转构成 3D 视角）
const ROT_SENS = 0.008;         // 旋转灵敏度（rad / 拖动像素）
const CELL_R_RATIO = 0.95;      // 格半径占布局 size 比（1=相切无缝；0.9→0.95 缝隙减半）
const FONT_STACK = '"Courier New", Consolas, monospace';

// 像素风字体：等宽栈 + 构建管线 1/PIXEL 缩放再最近邻放大 → 硬边像素字
function pxFont(size: number, bold = true): string {
  return (bold ? 'bold ' : '') + Math.round(size) + 'px ' + FONT_STACK;
}

interface Tile { color: string; type: string; }

interface HexCell {
  q: number; r: number;              // 轴向坐标（邻接判定用）
  x: number; y: number; rad: number; // 棋盘平面坐标与半径（渲染/命中用）
  locked: boolean;                   // 锁格：灰色不可放置
  stack: Tile[];                     // 该格的堆叠（可混色）；空数组=空格
  highlight: number;
  landT: number;                     // 顶层刚落叠的余韵计时（落地挤压动画）
}

// 移动障碍：周期性 occupy 一个空格（stay → out → 换格 → in）
interface Obstacle {
  idx: number;              // 当前占据的格索引
  phase: 'stay' | 'out' | 'in';
  t: number;                // 当前阶段剩余时间
  scale: number;            // 渲染缩放（out→0，in→1）
}

interface Group {
  id: number;
  tiles: Tile[];             // 一组（一摞）：底→顶，可混色
  slot: number;
  x: number; y: number; tx: number; ty: number;
  scale: number; targetScale: number;
}

interface FlyingTile {
  color: string; type: string;
  sx: number; sy: number;    // 起点（固定）
  x: number; y: number; tx: number; ty: number;
  arcH: number;              // 弧线最高点偏移
  t: number; duration: number; done: boolean;
  sourceIdx: number; destIdx: number; layer: number;   // 落地后要叠到第几层
}

interface Flight { srcIdx: number; tile: Tile; sx: number; sy: number; layer: number; }

interface MergeAnim {
  destIdx: number;            // 合并落点（锚格）
  color: string;              // 本次飞叠的颜色（触发合并的顶层色）
  flights: Flight[];          // 所有需飞行的方块（整摞，含埋藏色）
  baseLen: number;            // 锚格合并前的已有层数
  spawnIdx: number;
  nextSpawn: number;
  flying: FlyingTile[];
  placedIdx: number;          // 触发本次合并的落点（用于后续 resolve）
}

interface UiButton { id: string; label: string; x: number; y: number; w: number; h: number; }
interface SaveData { unlocked: number; stars: Record<number, number>; bestScore: number; muted: boolean; tipShown?: Record<string, boolean>; }

// 进阶机制首次出现的轻提示文案（GDD §3.11）
const MECHANIC_TIPS: Record<string, string> = {
  lockedCell: '锁格：灰色带锁的格子不可放置',
  decoy: '诱饵子：托盘会混入场外颜色的干扰棋子',
  timed: '限时：倒计时结束前完成目标！',
  movingObstacle: '移动障碍：灰色棋子塔会周期性换位',
};

interface Snap {
  cells: { stack: Tile[] }[];
  groups: Group[];
  score: number; clearedTotal: number; clearedColors: string[];
  combo: number; comboTimer: number;
  level: number; levelGoal: number; steps: number;
}

function comboMul(c: number): number {
  if (c <= 1) return 1;
  if (c === 2) return 1.2;
  if (c === 3) return 1.5;
  return 2;
}

let pieceIdSeq = 1;

function activeColorsList(k: number): string[] {
  const n = Math.min(6, Math.max(3, k));
  return PIECES.slice(0, n).map((p) => p.color);
}

export class Board {
  W: number; H: number; cfg: LevelConfig;
  cells: HexCell[] = [];
  neighborIdx: number[][] = [];   // 预计算邻接表（buildLevel 时一次性生成）
  groups: Group[] = [];
  particles: any[] = [];
  score = 0; level = 1; clearedTotal = 0; clearedColors = new Set<string>();
  levelGoal = 3;
  over: 'none' | 'complete' | 'fail' = 'none';
  failReason: 'full' | 'timeout' = 'full';
  stars = 0;
  steps = 0; rescuesUsed = 0;
  combo = 0; comboTimer = 0;
  history: Snap[] = [];
  hint: { cellIdx: number; t: number } | null = null;
  toast: { text: string; t: number } | null = null;
  tutorial = false; tutorialArmed = false;
  checkmateFlash = 0;
  obstacles: Obstacle[] = [];
  timeLeft = 0;                  // 限时关倒计时（cfg.timeLimit=0 时不启用）
  viewAngle = 0;                 // 棋盘旋转角（rad）；空白处拖动改变
  boardCx = 0; boardCy = 0;      // 棋盘中心（屏幕坐标，视角变换的轴心）
  traySlotW = TRAY_SLOT_W; trayY = 0;
  uiButtons: UiButton[] = []; overlayButtons: UiButton[] = []; failButtons: UiButton[] = [];
  mergeAnim: MergeAnim | null = null;
  private storageGet: (k: string) => string | null = () => null;
  private storageSet: (k: string, v: string) => void = () => {};
  save: SaveData = { unlocked: 1, stars: {}, bestScore: 0, muted: false };
  audio: AudioEngine = createNoopAudio();
  onShare?: () => void;
  onLevelComplete?: (level: number, stars: number, score: number) => void;
  onLevelFail?: (level: number) => void;
  private drag: { group: Group } | null = null;
  private rotating: { lastX: number } | null = null;   // 空白处拖动 → 旋转棋盘

  constructor(W: number, H: number) {
    this.W = W; this.H = H; this.trayY = H - 66; this.buildLevel(1);
  }

  typeOf(color: string): string {
    return PIECES.find((p) => p.color === color)?.type || 'pawn';
  }

  attachStorage(get: (k: string) => string | null, set: (k: string, v: string) => void): void {
    this.storageGet = get; this.storageSet = set;
  }
  attachAudio(a: AudioEngine): void { this.audio = a; a.setMuted(this.save.muted); }
  loadSave(): void {
    try {
      const raw = this.storageGet('lbzj_save');
      if (raw) this.save = { ...this.save, ...JSON.parse(raw) };
    } catch { /* ignore */ }
  }
  private persist(): void {
    try { this.storageSet('lbzj_save', JSON.stringify(this.save)); } catch { /* ignore */ }
  }

  private eliminateAt(): number { return this.cfg.eliminateAt; }

  // ── 视角变换：棋盘平面 ↔ 屏幕 ─────────────────────────────
  // screen = center + Squash(1,TILT) · Rotate(θ) · (board - center)
  // 先旋转（绕棋盘中心）再沿屏幕竖直方向压缩（固定俯角）→ 立体棋盘。
  boardToScreen(x: number, y: number): { x: number; y: number } {
    const dx = x - this.boardCx; const dy = y - this.boardCy;
    const cos = Math.cos(this.viewAngle); const sin = Math.sin(this.viewAngle);
    return {
      x: this.boardCx + dx * cos - dy * sin,
      y: this.boardCy + (dx * sin + dy * cos) * TILT,
    };
  }
  screenToBoard(x: number, y: number): { x: number; y: number } {
    const u = x - this.boardCx; const v = (y - this.boardCy) / TILT;
    const cos = Math.cos(this.viewAngle); const sin = Math.sin(this.viewAngle);
    return {
      x: this.boardCx + u * cos + v * sin,
      y: this.boardCy - u * sin + v * cos,
    };
  }

  buildLevel(level: number): void {
    this.level = clamp(level, 1, levels.length);
    this.cfg = levels[this.level - 1];
    this.levelGoal = this.cfg.goal;
    this.clearedTotal = 0; this.clearedColors = new Set();
    this.over = 'none'; this.steps = 0; this.rescuesUsed = 0;
    this.combo = 0; this.comboTimer = 0; this.history = [];
    this.hint = null; this.toast = null;
    this.tutorial = this.cfg.tutorial.includes('dragToEmpty');
    this.tutorialArmed = false;
    this.particles = []; this.checkmateFlash = 0;
    this.mergeAnim = null; this.drag = null; this.rotating = null;
    this.failReason = 'full';
    this.timeLeft = this.cfg.timeLimit;
    this.obstacles = [];
    // viewAngle 保留（跨关维持玩家视角）

    const coords = hexMap(this.cfg.boardRadius);
    this.boardCx = this.W / 2; this.boardCy = this.H * 0.40;
    // 高度按 TILT 补偿（0.66/0.8 ≈ 0.53 屏高视觉占比）；宽度留旋转余量
    const maxW = this.W * 0.95; const maxH = this.H * 0.66;
    const { size, ox, oy } = fitHexLayout(coords, this.boardCx, this.boardCy, maxW, maxH);
    this.cells = coords.map((c) => {
      const p = hexToPixel(c.q, c.r, size);
      return {
        q: c.q, r: c.r,
        x: p.x + ox, y: p.y + oy, rad: size * CELL_R_RATIO,
        locked: false,
        stack: [], highlight: 0, landT: 0,
      };
    });
    // 邻接表一次性预计算（flood-fill 高频查询，避免每次 O(n) 扫描）
    this.neighborIdx = this.cells.map((c, i) => {
      const out: number[] = [];
      for (let j = 0; j < this.cells.length; j++) {
        if (i === j) continue;
        const o = this.cells[j];
        if (hexDistance({ q: c.q, r: c.r }, { q: o.q, r: o.r }) === 1) out.push(j);
      }
      return out;
    });

    // 进阶机制：锁格（避开中心格，随机分布）
    if (this.cfg.lockedCells > 0) {
      const cand = this.cells
        .map((c, i) => ({ i, d: hexDistance({ q: c.q, r: c.r }, { q: 0, r: 0 }) }))
        .filter((c) => c.d >= 1)
        .map((c) => c.i);
      for (let n = cand.length - 1; n > 0; n--) {
        const k = Math.floor(Math.random() * (n + 1));
        [cand[n], cand[k]] = [cand[k], cand[n]];
      }
      for (let k = 0; k < Math.min(this.cfg.lockedCells, cand.length); k++) {
        this.cells[cand[k]].locked = true;
      }
    }
    // 进阶机制：移动障碍
    for (let k = 0; k < this.cfg.obstacles; k++) this.spawnObstacle();
    this.showMechanicTips();

    this.groups = [];
    while (this.groups.length < TRAY_GROUPS) this.spawnGroup();
    this.relayoutTray();
    this.computeLayout();
  }

  // 障碍出生/换位：随机挑一个空且未锁、无其他障碍的格
  private spawnObstacle(): void {
    const idx = this.pickObstacleCell(-1);
    if (idx < 0) return;
    this.obstacles.push({ idx, phase: 'in', t: OB_IN, scale: 0 });
  }

  private pickObstacleCell(exclude: number): number {
    const cand: number[] = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (i === exclude) continue;
      const c = this.cells[i];
      if (c.locked || c.stack.length > 0) continue;
      if (this.obstacles.some((o) => o.idx === i)) continue;
      cand.push(i);
    }
    if (cand.length === 0) return exclude < 0 ? -1 : exclude; // 无处可去：原地不动
    return cand[Math.floor(Math.random() * cand.length)];
  }

  // 某格当前是否被移动障碍遮挡（out 阶段视为已让开）
  isBlocked(idx: number): boolean {
    return this.obstacles.some((o) => o.idx === idx && o.phase !== 'out');
  }

  // 机制首次出现 → 弹一次轻提示并写入存档去重
  private showMechanicTips(): void {
    for (const m of this.cfg.mechanics) {
      if (!this.save.tipShown) this.save.tipShown = {};
      if (this.save.tipShown[m]) continue;
      this.save.tipShown[m] = true;
      this.toast = { text: MECHANIC_TIPS[m] || m, t: 3 };
      this.persist();
      break; // 每次进关最多提示一条，避免刷屏
    }
  }

  private computeLayout(): void {
    const pad = 10; const bw = (this.W - 6 * pad) / 5; const bh = 34; const by = this.H - 122;
    this.uiButtons = [
      { id: 'hint', label: '提示', x: pad, y: by, w: bw, h: bh },
      { id: 'undo', label: '撤销', x: pad * 2 + bw, y: by, w: bw, h: bh },
      { id: 'shuffle', label: '洗牌', x: pad * 3 + 2 * bw, y: by, w: bw, h: bh },
      { id: 'restart', label: '重开', x: pad * 4 + 3 * bw, y: by, w: bw, h: bh },
      { id: 'share', label: '分享', x: pad * 5 + 4 * bw, y: by, w: bw, h: bh },
    ];
    const ow = 150; const oh = 46; const oy = this.H * 0.62;
    this.overlayButtons = [
      { id: 'next', label: '下一关', x: this.W / 2 - ow - 8, y: oy, w: ow, h: oh },
      { id: 'replay', label: '重玩', x: this.W / 2 + 8, y: oy, w: ow, h: oh },
    ];
    this.failButtons = [{ id: 'restartFail', label: '重开本关', x: this.W / 2 - ow / 2, y: oy, w: ow, h: oh }];
  }

  collectBoardColors(): Set<string> {
    const s = new Set<string>();
    for (const c of this.cells) for (const t of c.stack) s.add(t.color);
    return s;
  }

  private pickColor(): string {
    // 进阶机制 decoy：小概率混入"场外色"（不在 activeColors 池里的颜色）
    if (this.cfg.decoyChance > 0 && Math.random() < this.cfg.decoyChance) {
      const inactive = PIECES.slice(this.cfg.activeColors);
      if (inactive.length > 0) return inactive[Math.floor(Math.random() * inactive.length)].color;
    }
    const needed = this.collectBoardColors();
    if (needed.size > 0 && Math.random() < this.cfg.spawnBias) {
      const arr = Array.from(needed);
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const pool = activeColorsList(this.cfg.activeColors);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private makeTile(color: string): Tile {
    return { color, type: this.typeOf(color) };
  }

  private spawnGroup(slot?: number): void {
    const n = this.cfg.groupMin + Math.floor(Math.random() * (this.cfg.groupMax - this.cfg.groupMin + 1));
    const tiles: Tile[] = [];
    for (let i = 0; i < n; i++) tiles.push(this.makeTile(this.pickColor()));
    this.groups.push({
      id: pieceIdSeq++, tiles,
      slot: slot ?? this.groups.length,
      x: this.W / 2, y: this.H + 80,
      tx: this.W / 2, ty: this.H + 80,
      scale: 1, targetScale: 1,
    });
  }

  private refillGroups(): void {
    while (this.groups.length < TRAY_GROUPS) this.spawnGroup();
  }

  relayoutTray(): void {
    const n = this.groups.length;
    const w = this.traySlotW;
    const startX = this.W / 2 - ((n - 1) * w) / 2;
    this.groups.forEach((g, i) => {
      g.slot = i;
      g.tx = startX + i * w; g.ty = this.trayY;
    });
  }

  pointerDown(x: number, y: number): number {
    if (this.over === 'complete') {
      const b = this.overlayButtons.find((bt) => x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h);
      if (b && b.id === 'next') this.buildLevel(this.level + 1);
      else if (b && b.id === 'replay') this.buildLevel(this.level);
      else this.buildLevel(this.level + 1);
      return -1;
    }
    if (this.over === 'fail') {
      const b = this.failButtons.find((bt) => x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h);
      if (b && b.id === 'restartFail') this.buildLevel(this.level);
      return -1;
    }
    // 合并动画期间不能抓子/按按钮，但允许转视角（纯视图操作）
    if (this.mergeAnim) { this.rotating = { lastX: x }; return -1; }

    const btn = this.uiButtons.find((bt) => x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h);
    if (btn) { this.handleButton(btn.id); return -1; }

    for (let i = this.groups.length - 1; i >= 0; i--) {
      const g = this.groups[i];
      const step = TRAY_R * STACK_STEP_RATIO;
      const top = g.y - (g.tiles.length - 1) * step;
      if (x >= g.x - TRAY_R && x <= g.x + TRAY_R && y >= top - TRAY_R && y <= g.y + TRAY_R) {
        this.pushHistory();
        this.groups.splice(i, 1);
        g.scale = 1.15; g.targetScale = 1.15;
        this.drag = { group: g };
        this.audio.play('pick');
        return g.id;
      }
    }
    // 没抓到任何东西 → 开始旋转棋盘（拖到哪转到哪，松手保持视角）
    this.rotating = { lastX: x };
    return -1;
  }

  pointerMove(x: number, y: number): void {
    if (this.rotating) {
      this.viewAngle += (x - this.rotating.lastX) * ROT_SENS;
      this.rotating.lastX = x;
      return;
    }
    if (this.drag) { this.drag.group.tx = x; this.drag.group.ty = y - 30; }
  }

  pointerUp(x: number, y: number): void {
    this.rotating = null;
    const drag = this.drag; if (!drag) return;
    this.drag = null;
    const group = drag.group;
    group.scale = 1; group.targetScale = 1;

    // 限时关超时瞬间可能仍握着棋子：直接回托盘，不再放置
    if (this.over !== 'none') { this.bounceGroup(group); return; }

    // 屏幕坐标 → 棋盘平面坐标（逆视角变换），在棋盘空间找最近格
    const p = this.screenToBoard(x, y);
    let bestIdx = -1; let bestD = Infinity;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i]; const dx = p.x - c.x; const dy = p.y - c.y; const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    if (bestIdx < 0) { this.bounceGroup(group); return; }
    const cell = this.cells[bestIdx];
    const acceptR2 = (cell.rad * ACCEPT_SCALE) * (cell.rad * ACCEPT_SCALE);
    if (
      bestD > acceptR2 || cell.stack.length > 0
      || cell.locked || this.isBlocked(bestIdx)   // 锁格 / 移动障碍：不可放置
    ) { this.bounceGroup(group); return; }

    // 整组放入：成为该格的堆叠（可混色）
    cell.stack = group.tiles.map((t) => ({ ...t }));
    cell.highlight = 1;
    cell.landT = LAND_DURATION;   // 软着陆：落下后轻轻一弹再归位
    this.score += 5 * group.tiles.length;
    this.steps++;
    this.refillGroups();
    this.relayoutTray();
    this.audio.play('place');
    if (this.tutorial && !this.tutorialArmed) this.tutorialArmed = true;
    this.resolveBoard(bestIdx);
    this.checkFail();
  }

  private bounceGroup(group: Group): void {
    this.audio.play('bounce');
    this.groups.push(group);
    this.relayoutTray();
  }

  getNeighbors(cellIdx: number): { idx: number; cell: HexCell }[] {
    return this.neighborIdx[cellIdx].map((j) => ({ idx: j, cell: this.cells[j] }));
  }

  // —— 逐色合并/消除核心（M3-K：仅顶层色参与邻接） ——
  // 合并以"顶层颜色"为单位：仅当相邻格的【最上层】棋子同色才触发；
  // 触发后来源格【整摞】（含埋藏色）飞向锚格叠高，埋藏色保持原顺序。
  // 消除改为单格判定：某一格内同色累计 ≥ eliminateAt(10) 即消除该色。

  private topColor(idx: number): string | null {
    const st = this.cells[idx].stack;
    return st.length > 0 ? st[st.length - 1].color : null;
  }

  private allBoardColors(): string[] {
    const s = new Set<string>();
    for (let i = 0; i < this.cells.length; i++) {
      const t = this.topColor(i);
      if (t) s.add(t);
    }
    return Array.from(s);
  }

  private firstCellWith(color: string): number {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.topColor(i) === color) return i;
    }
    return -1;
  }

  // 以 seed 为起点，找出"顶层为 color"的连通分量
  private colorComponent(color: string, seed: number): number[] {
    if (seed < 0 || this.topColor(seed) !== color) return [];
    const seen = new Set<number>([seed]);
    const queue = [seed];
    const comp: number[] = [seed];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const j of this.neighborIdx[cur]) {
        if (seen.has(j)) continue;
        if (this.topColor(j) === color) {
          seen.add(j); queue.push(j); comp.push(j);
        }
      }
    }
    return comp;
  }

  private chooseAnchor(comp: number[], placedIdx: number): number {
    if (comp.includes(placedIdx)) return placedIdx;
    let best = comp[0]; let bestLen = -1;
    for (const idx of comp) {
      const n = this.cells[idx].stack.length;
      if (n > bestLen) { bestLen = n; best = idx; }
    }
    return best;
  }

  // 优先合并：选一个"顶层同色且分散（>1 格）"的颜色，整摞飞叠到锚格
  private pickConsolidateColor(placedIdx: number): string | null {
    const colors = this.allBoardColors();
    let preferred: string | null = null;
    for (const c of colors) {
      const seed = (placedIdx >= 0 && this.topColor(placedIdx) === c)
        ? placedIdx : this.firstCellWith(c);
      const comp = this.colorComponent(c, seed);
      if (comp.length > 1) {
        if (comp.includes(placedIdx)) return c;
        if (!preferred) preferred = c;
      }
    }
    return preferred;
  }

  // 找一个"单格内同色 ≥ 消除阈值"的格（合并会把同顶层色收拢到一格，故只需单格判定）
  private pickClearIdx(): { idx: number; color: string } | null {
    for (let i = 0; i < this.cells.length; i++) {
      const st = this.cells[i].stack;
      if (st.length === 0) continue;
      const tally = new Map<string, number>();
      for (const t of st) tally.set(t.color, (tally.get(t.color) ?? 0) + 1);
      for (const [color, n] of tally) {
        if (n >= this.eliminateAt()) return { idx: i, color };
      }
    }
    return null;
  }

  // 放置/消除后的统一结算：先整摞收拢、再消除，循环直到稳定
  resolveBoard(placedIdx: number): void {
    if (this.over !== 'none') return;
    if (this.mergeAnim) return;

    const colC = this.pickConsolidateColor(placedIdx);
    if (colC) {
      const seed = (placedIdx >= 0 && this.topColor(placedIdx) === colC)
        ? placedIdx : this.firstCellWith(colC);
      const comp = this.colorComponent(colC, seed);
      const anchor = this.chooseAnchor(comp, placedIdx);
      this.startConsolidate(colC, comp, anchor, placedIdx);
      return;
    }

    const clr = this.pickClearIdx();
    if (clr) {
      this.clearCellColor(clr.idx, clr.color);
      this.resolveBoard(placedIdx);   // 消除后顶层变化，可能引发新合并
    }
  }

  // 兼容老调用：模拟"idx 处刚放入"触发结算
  tryMergeFrom(idx: number): void { this.resolveBoard(idx); }

  private startConsolidate(color: string, comp: number[], anchorIdx: number, placedIdx: number): void {
    const flights: Flight[] = [];
    const baseLen = this.cells[anchorIdx].stack.length;
    let k = 0;
    for (const idx of comp) {
      if (idx === anchorIdx) continue;
      const src = this.cells[idx];
      const step = src.rad * STACK_STEP_RATIO;
      // 整摞迁移：底→顶逐片登记飞行，埋藏色随行且保持顺序
      for (let j = 0; j < src.stack.length; j++) {
        flights.push({ srcIdx: idx, tile: src.stack[j], sx: src.x, sy: src.y - j * step, layer: baseLen + k });
        k++;
      }
      src.stack = [];
    }
    if (flights.length === 0) return;
    this.mergeAnim = { destIdx: anchorIdx, color, flights, baseLen, spawnIdx: 0, nextSpawn: 0, flying: [], placedIdx };
  }

  update(dt: number): void {
    for (const g of this.groups) {
      g.x = lerp(g.x, g.tx, clamp(dt * 9, 0, 1));
      g.y = lerp(g.y, g.ty, clamp(dt * 9, 0, 1));
      g.scale = lerp(g.scale, g.targetScale, clamp(dt * 14, 0, 1));
    }
    if (this.drag) {
      const k = clamp(dt * 20, 0, 1);
      const g = this.drag.group;
      g.x = lerp(g.x, g.tx, k);
      g.y = lerp(g.y, g.ty, k);
      g.scale = lerp(g.scale, g.targetScale, clamp(dt * 16, 0, 1));
    }
    for (const c of this.cells) {
      if (c.highlight > 0) c.highlight = Math.max(0, c.highlight - dt * 2);
      if (c.landT > 0) c.landT = Math.max(0, c.landT - dt);
    }
    for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 400 * dt; pt.life -= dt; }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.checkmateFlash > 0) this.checkmateFlash = Math.max(0, this.checkmateFlash - dt);
    this.updateObstacles(dt);
    this.updateTimer(dt);
    if (this.mergeAnim) this.updateMerge(dt);
  }

  // 移动障碍状态机：stay(OB_STAY) → out(缩出) → 换格 → in(缩入) → stay
  private updateObstacles(dt: number): void {
    for (const ob of this.obstacles) {
      ob.t -= dt;
      if (ob.phase === 'stay') {
        if (ob.t <= 0) { ob.phase = 'out'; ob.t = OB_OUT; }
      } else if (ob.phase === 'out') {
        ob.scale = clamp(ob.t / OB_OUT, 0, 1);
        if (ob.t <= 0) {
          ob.idx = this.pickObstacleCell(ob.idx); // 无候选则原地不动
          ob.phase = 'in'; ob.t = OB_IN;
        }
      } else { // in
        ob.scale = clamp(1 - ob.t / OB_IN, 0, 1);
        if (ob.t <= 0) { ob.phase = 'stay'; ob.t = OB_STAY; ob.scale = 1; }
      }
    }
  }

  // 限时倒计时：合并动画播放期间暂停（此时玩家无法操作）；最后 5s 逐秒 tick 提醒
  private updateTimer(dt: number): void {
    if (this.cfg.timeLimit <= 0 || this.over !== 'none' || this.mergeAnim) return;
    const prev = Math.ceil(this.timeLeft);
    this.timeLeft -= dt;
    const now = Math.ceil(this.timeLeft);
    if (now !== prev && now > 0 && now <= 5) this.audio.play('tick');
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.over = 'fail';
      this.failReason = 'timeout';
      this.onLevelFail?.(this.level);
      this.audio.play('bounce');
      this.toast = { text: '时间到', t: 2.0 };
    }
  }

  private updateMerge(dt: number): void {
    const m = this.mergeAnim!;
    m.nextSpawn -= dt;
    while (m.nextSpawn <= 0 && m.spawnIdx < m.flights.length) {
      const fl = m.flights[m.spawnIdx];
      const dest = this.cells[m.destIdx];
      const step = dest.rad * STACK_STEP_RATIO;
      const ty = dest.y - fl.layer * step;
      m.flying.push({
        color: fl.tile.color, type: fl.tile.type,
        sx: fl.sx, sy: fl.sy, x: fl.sx, y: fl.sy, tx: dest.x, ty,
        arcH: dest.rad * ARC_HOP,
        t: 0, duration: FLY_DURATION, done: false,
        sourceIdx: fl.srcIdx, destIdx: m.destIdx, layer: fl.layer,
      });
      m.spawnIdx++;
      m.nextSpawn += FLY_INTERVAL;
    }
    for (const f of m.flying) {
      if (f.done) continue;
      f.t += dt;
      const u = Math.min(1, f.t / f.duration);
      const e = 1 - (1 - u) * (1 - u);
      const bx = lerp(f.sx, f.tx, e);
      const by = lerp(f.sy, f.ty, e);
      f.x = bx;
      f.y = by - f.arcH * Math.sin(u * Math.PI); // 弧线 hop：中段高高跃起，逐块落下
      if (f.t >= f.duration) f.done = true;
    }
    const arrived = m.flying.filter((f) => f.done);
    for (const f of arrived) {
      const dest = this.cells[f.destIdx];
      dest.stack.push({ color: f.color, type: f.type });
      dest.landT = LAND_DURATION;          // 触发落地挤压回弹
      dest.highlight = Math.max(dest.highlight, 0.5);
      // 每落一块播放一次"咔哒"，音高随当前层数升高 → 一块一块摞上去的层次感
      this.audio.play('merge', { step: dest.stack.length - 1 });
    }
    m.flying = m.flying.filter((f) => !f.done);

    if (m.spawnIdx >= m.flights.length && m.flying.length === 0) {
      this.mergeAnim = null;
      this.resolveBoard(m.placedIdx);   // 继续结算（可能再合并或消除）
    }
  }

  private clearCellColor(idx: number, color: string): void {
    if (this.comboTimer > 0) this.combo++;
    else this.combo = 1;
    this.comboTimer = COMBO_WINDOW;
    this.score += Math.round(100 * comboMul(this.combo));
    this.clearedTotal++;
    this.clearedColors.add(color);
    const cell = this.cells[idx];
    const before = cell.stack.length;
    cell.stack = cell.stack.filter((t) => t.color !== color);
    this.spawnParticles(cell.x, cell.y, color, Math.min(22, before));
    cell.highlight = 1;
    this.audio.play('clear');
    if (this.clearedColors.size >= 6) {
      this.score += 200;
      this.checkmateFlash = 1.6;
      this.toast = { text: '将杀 Checkmate!', t: 1.6 };
      this.audio.play('checkmate');
      this.clearedColors = new Set();
    }
    if (this.clearedTotal >= this.levelGoal) this.completeLevel();
  }

  private completeLevel(): void {
    this.over = 'complete';
    const stepOk = this.steps <= this.cfg.starThresholds.steps;
    const rescueOk = this.rescuesUsed <= this.cfg.starThresholds.rescues;
    let s = 1;
    if (stepOk || rescueOk) s = 2;
    if (stepOk && rescueOk) s = 3;
    this.stars = s;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(levels.length, this.level + 1));
    const prev = this.save.stars[this.level] || 0;
    this.save.stars[this.level] = Math.max(prev, s);
    this.save.bestScore = Math.max(this.save.bestScore, this.score);
    this.persist();
    this.onLevelComplete?.(this.level, this.stars, this.score);
    this.audio.play('win');
  }

  private checkFail(): void {
    if (this.over !== 'none') return;
    if (this.mergeAnim) return; // 合并进行中：等动画结算完再判（可能即将消除腾格）
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      // 锁格永不可用；障碍格暂不可用——两者都不算"还有地方可放"
      if (c.locked || this.isBlocked(i)) continue;
      if (c.stack.length === 0) return;
    }
    this.over = 'fail';
    this.failReason = 'full';
    this.onLevelFail?.(this.level);
    this.audio.play('bounce');
    this.toast = { text: '格满失败', t: 2.0 };
  }

  private pushHistory(): void {
    const snap: Snap = {
      cells: this.cells.map((c) => ({ stack: [...c.stack] })),
      groups: this.groups.map((g) => ({ ...g, tiles: g.tiles.map((t) => ({ ...t })) })),
      score: this.score, clearedTotal: this.clearedTotal,
      clearedColors: Array.from(this.clearedColors),
      combo: this.combo, comboTimer: this.comboTimer,
      level: this.level, levelGoal: this.levelGoal, steps: this.steps,
    };
    this.history.push(snap);
    if (this.history.length > 30) this.history.shift();
  }

  doUndo(): void {
    const snap = this.history.pop();
    if (!snap) { this.toast = { text: '没有可撤销的步骤', t: 1.4 }; return; }
    for (let i = 0; i < this.cells.length; i++) {
      const s = snap.cells[i]; if (!s) continue;
      this.cells[i].stack = [...s.stack];
      this.cells[i].highlight = 0;
      this.cells[i].landT = 0;
    }
    this.groups = snap.groups.map((g) => ({ ...g, tiles: g.tiles.map((t) => ({ ...t })) }));
    this.score = snap.score; this.clearedTotal = snap.clearedTotal;
    this.clearedColors = new Set(snap.clearedColors);
    this.combo = snap.combo; this.comboTimer = snap.comboTimer;
    this.level = snap.level; this.levelGoal = snap.levelGoal;
    this.steps = snap.steps;
    this.mergeAnim = null;
    this.over = 'none';
    this.relayoutTray();
    this.audio.play('click');
  }

  doShuffle(): void {
    if (this.over !== 'none') return;
    const needed = this.collectBoardColors();
    const pool = needed.size > 0 ? Array.from(needed) : activeColorsList(this.cfg.activeColors);
    for (const g of this.groups) {
      for (const t of g.tiles) {
        const c = pool[Math.floor(Math.random() * pool.length)];
        t.color = c; t.type = this.typeOf(c);
      }
    }
    this.relayoutTray();
    this.rescuesUsed++;
    this.toast = { text: '已洗牌', t: 1.2 };
    this.audio.play('click');
  }

  doHint(): void {
    const mv = this.findValidMove();
    if (!mv) { this.toast = { text: '暂无可走步，试试洗牌', t: 1.6 }; return; }
    this.hint = { cellIdx: mv.cellIdx, t: 3 };
    this.rescuesUsed++;
    this.audio.play('hint');
  }

  findValidMove(): { cellIdx: number; color: string } | null {
    const trayColors = new Set<string>();
    for (const g of this.groups) for (const t of g.tiles) trayColors.add(t.color);
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.stack.length > 0 || c.locked || this.isBlocked(i)) continue;
      for (const j of this.neighborIdx[i]) {
        const n = this.cells[j];
        if (n.stack.length > 0) {
          const col = n.stack.find((t) => trayColors.has(t.color));
          if (col) return { cellIdx: i, color: col.color };
        }
      }
    }
    return null;
  }

  hasValidMove(): boolean {
    if (this.mergeAnim) return false;
    if (this.over !== 'none') return false;
    for (const c of this.cells) {
      if (!c.locked && c.stack.length === 0) return this.groups.length > 0;
    }
    return false;
  }

  private handleButton(id: string): void {
    this.audio.play('click');
    if (id === 'hint') this.doHint();
    else if (id === 'undo') this.doUndo();
    else if (id === 'shuffle') this.doShuffle();
    else if (id === 'restart') this.buildLevel(this.level);
    else if (id === 'share') this.onShare?.();
  }

  spawnParticles(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        color,
        size: 4 + Math.random() * 4,
      });
    }
  }

  gotoLevel(n: number): void {
    const l = Math.max(1, Math.min(levels.length, Math.floor(n) || 1));
    this.buildLevel(l);
  }

  render(ctx: any): void {
    drawBackground(ctx, this.W, this.H);

    // ── 棋盘层（应用视角变换：旋转 + 俯角压缩）──────────────
    ctx.save();
    ctx.translate(this.boardCx, this.boardCy);
    ctx.scale(1, TILT);
    ctx.rotate(this.viewAngle);
    ctx.translate(-this.boardCx, -this.boardCy);

    // 远→近排序（按屏幕 y 升序）：前方棋堆遮挡后方，转动视角可见被挡格
    const order = this.cells
      .map((c, i) => ({ i, sy: this.boardToScreen(c.x, c.y).y }))
      .sort((a, b) => a.sy - b.sy);
    for (const o of order) {
      drawCellStack(ctx, this.cells[o.i]);
      const ob = this.obstacles.find((q) => q.idx === o.i);
      if (ob && ob.scale > 0.02) {
        const c = this.cells[o.i];
        const bob = Math.sin(Date.now() / 300 + o.i) * 2.5; // 轻微浮动，示意"活着"
        drawObstacle(ctx, c.x, c.y - c.rad * 0.08 + bob, c.rad * 0.92 * ob.scale);
      }
    }

    if (this.hint) {
      const c = this.cells[this.hint.cellIdx];
      if (c) {
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 150);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFC93C';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.rad * 1.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.mergeAnim) {
      for (const f of this.mergeAnim.flying) {
        drawFlyingTile(ctx, f.x, f.y, this.cells[f.sourceIdx].rad * 0.9, f.color, f.type);
      }
    }

    ctx.save();
    for (const pt of this.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore(); // 结束棋盘层变换

    // ── 屏幕层（托盘/HUD/弹窗，不随棋盘旋转）──────────────
    drawTrayShelf(ctx, this.W, this.H);
    for (const g of this.groups) drawPieceStack(ctx, g.x, g.y, TRAY_R, g.tiles, g.scale, 1);
    if (this.drag) {
      const g = this.drag.group;
      drawPieceStack(ctx, g.x, g.y, TRAY_R, g.tiles, g.scale, 1);
    }

    this.renderHud(ctx);
    this.renderToolbar(ctx);
    if (this.tutorial && !this.tutorialArmed) this.renderTutorial(ctx);
    if (this.toast) this.renderToast(ctx);
    if (this.over === 'complete') this.renderComplete(ctx);
    if (this.over === 'fail') this.renderFail(ctx);
    if (this.checkmateFlash > 0) this.renderCheckmate(ctx);
  }

  private renderHud(ctx: any): void {
    ctx.fillStyle = INK_COLOR; ctx.font = pxFont(19);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('关卡 ' + this.level, 16, 14);
    ctx.textAlign = 'right';
    ctx.fillText('分数 ' + this.score, this.W - 16, 14);
    ctx.textAlign = 'center'; ctx.font = pxFont(14, false);
    ctx.fillText('目标 ' + this.clearedTotal + '/' + this.levelGoal, this.W / 2, 16);
    if (this.combo >= 2) {
      ctx.fillStyle = '#E8635A'; ctx.font = pxFont(13);
      ctx.fillText('连击 x' + comboMul(this.combo), this.W / 2, 38);
    }
    // 限时关倒计时（左下角 HUD；最后 10s 变红加粗）
    if (this.cfg.timeLimit > 0 && this.over === 'none') {
      const t = Math.max(0, Math.ceil(this.timeLeft));
      const danger = this.timeLeft <= 10;
      ctx.fillStyle = danger ? '#E8635A' : '#9b9389';
      ctx.font = pxFont(13, danger);
      ctx.textAlign = 'left';
      ctx.fillText('时间 ' + t + 's', 16, 40);
    }
    ctx.fillStyle = '#9b9389'; ctx.font = pxFont(10, false); ctx.textAlign = 'right';
    ctx.fillText('最佳 ' + this.save.bestScore, this.W - 16, 38);
  }

  private renderToolbar(ctx: any): void {
    for (const b of this.uiButtons) {
      if (b.id === 'share') this.drawButton(ctx, b, '#FFC93C', '#3A3530');
      else this.drawButton(ctx, b, '#EFE6D8', INK_COLOR);
    }
  }

  // 像素风按钮：亮边框 + 主体 + 底部暗边（硬边斜面，无圆角无抗锯齿）
  private drawButton(ctx: any, b: UiButton, bg: string, fg: string): void {
    ctx.fillStyle = shade(bg, 16);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = bg;
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = shade(bg, -20);
    ctx.fillRect(b.x + 2, b.y + b.h - 5, b.w - 4, 3);
    ctx.fillStyle = fg; ctx.font = pxFont(14);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }

  private renderTutorial(ctx: any): void {
    const mv = this.findValidMove(); if (!mv) return;
    const c = this.cells[mv.cellIdx];
    const group = this.groups.find((g) => g.tiles.some((t) => t.color === mv.color)) || this.groups[0];
    if (!c || !group) return;
    const cp = this.boardToScreen(c.x, c.y); // 目标格的屏幕位置（随视角变换）
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = '#3FB68B'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(group.x, group.y - 40);
    ctx.lineTo(cp.x, cp.y + c.rad * TILT + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3FB68B'; ctx.font = pxFont(12); ctx.textAlign = 'center';
    ctx.fillText('拖到空格 →', (group.x + cp.x) / 2, (group.y + cp.y) / 2 - 30);
    ctx.restore();
  }

  private renderToast(ctx: any): void {
    if (!this.toast) return;
    const a = clamp(this.toast.t, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    const tw = 230; const th = 42;
    const tx = this.W / 2 - tw / 2; const ty = this.H * 0.5 - th / 2;
    ctx.fillStyle = 'rgba(58,53,48,0.88)';
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(tx, ty, tw, 2);
    ctx.fillStyle = '#FFFFFF'; ctx.font = pxFont(13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.toast.text, this.W / 2, this.H * 0.5);
    ctx.restore();
  }

  private renderComplete(ctx: any): void {
    ctx.fillStyle = 'rgba(58,53,48,0.82)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = pxFont(28);
    ctx.fillText('第 ' + this.level + ' 关完成！', this.W / 2, this.H * 0.34);
    ctx.font = '36px ' + FONT_STACK;
    const starY = this.H * 0.46;
    for (let i = 0; i < 3; i++) {
      const sx = this.W / 2 + (i - 1) * 54;
      ctx.fillStyle = i < this.stars ? '#FFC93C' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', sx, starY);
    }
    ctx.fillStyle = '#FFFFFF'; ctx.font = pxFont(14, false);
    ctx.fillText('得分 ' + this.score + '  最佳 ' + this.save.bestScore, this.W / 2, this.H * 0.54);
    for (const b of this.overlayButtons) this.drawButton(ctx, b, '#FFC93C', '#3A3530');
  }

  private renderFail(ctx: any): void {
    ctx.fillStyle = 'rgba(58,53,48,0.82)'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#E8635A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = pxFont(28);
    const isTimeout = this.failReason === 'timeout';
    ctx.fillText(isTimeout ? '时间到' : '格满失败', this.W / 2, this.H * 0.36);
    ctx.fillStyle = '#FFFFFF'; ctx.font = pxFont(13, false);
    ctx.fillText(isTimeout ? '倒计时结束，重开不罚分' : '棋盘被沾满，无法继续消除', this.W / 2, this.H * 0.44);
    for (const b of this.failButtons) this.drawButton(ctx, b, '#FFC93C', '#3A3530');
  }

  private renderCheckmate(ctx: any): void {
    const a = clamp(this.checkmateFlash / 1.6, 0, 1);
    const ease = a * a;
    ctx.save();
    ctx.globalAlpha = ease * 0.5; ctx.fillStyle = '#FFD86B'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.translate(this.W / 2, this.H / 2);
    const scale = 0.7 + ease * 0.5;
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = pxFont(40); ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,233,168,0.9)'; ctx.strokeText('将杀 CHECKMATE!', 0, 0);
    ctx.fillStyle = '#3A3530'; ctx.fillText('将杀 CHECKMATE!', 0, 0);
    ctx.restore();
  }
}
