// 平台抽象层：让同一套游戏逻辑在「微信小游戏」和「浏览器」中都能跑。
export interface Pointer {
  x: number;
  y: number;
  id: number;
}

export type Ctx2D = any;
export type CanvasLike = any;

// 音效名称（程序化合成，无需外部音频文件）
export type SfxName =
  | 'pick' // 抓取棋子
  | 'place' // 棋子落入将营
  | 'stack' // 棋子放入/堆叠暂存格
  | 'clear' // 将营装满消除
  | 'checkmate' // 集齐六色将杀彩蛋
  | 'bounce' // 落点非法弹回
  | 'click' // 工具栏按钮
  | 'win' // 关卡完成
  | 'hint' // 提示
  | 'merge' // 合并时每颗棋子落叠的"咔哒"声（随层数升调）
  | 'tick' // 限时关最后几秒的倒计时滴答
  | 'fail'; // 判负：低频下行

// 音频引擎：浏览器用 AudioContext，微信用 wx.createWebAudioContext，接口统一。
export interface AudioEngine {
  resume(): void; // 用户手势后解锁音频上下文（移动端自动播放策略）
  setMuted(m: boolean): void;
  // opts.step：当前堆叠第几层（从 0 起），用于合并音效随层数升调
  play(name: SfxName, opts?: { step?: number }): void;
}

// 广告：横幅 / 插屏 / 激励视频。无广告位 ID 时各方法安全 no-op。
export interface AdManager {
  showBanner(): void;
  hideBanner(): void;
  showInterstitial(): void;
  // 返回 true 表示用户完整看完（可据此发放奖励，如免冷却救援）
  showRewarded(): Promise<boolean>;
}

export interface ShareCard {
  title: string;
  imageUrl?: string;
  query?: string;
}

// 分享：裂变拉新。enableShare 注册右上角菜单卡片；share 主动调起。
export interface ShareManager {
  enableShare(card: ShareCard): void;
  share(card?: Partial<ShareCard>): void;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
}

// 云排行榜：enabled=false 时走本地兜底，配好云环境后切真实云端。
export interface CloudLeaderboard {
  enabled: boolean;
  submitScore(score: number, level: number): void;
  getRank(): Promise<{ rank: number; top: LeaderboardEntry[] }>;
}

export interface Platform {
  getCanvas(): any;
  // 创建离屏画布（像素管线用）：浏览器 document.createElement('canvas')，微信 wx.createCanvas()
  createCanvas(w: number, h: number): any;
  getDpr(): number;
  // 系统「减少动态效果」偏好：true 时关掉屏震与粒子
  prefersReducedMotion?: () => boolean;
  getScreenSize(): { width: number; height: number };
  onPointerDown(cb: (p: Pointer) => void): void;
  onPointerMove(cb: (p: Pointer) => void): void;
  onPointerUp(cb: (p: Pointer) => void): void;
  raf(cb: () => void): void;
  storageGet(key: string): string | null;
  storageSet(key: string, val: string): void;
  log(...a: any[]): void;
  // 可选能力（按环境提供，缺失则游戏逻辑跳过）
  ads?: AdManager;
  share?: ShareManager;
  cloud?: CloudLeaderboard;
  // 启动参数（分享深链用：?level=5 → 直接进入第 5 关）
  launchQuery?: () => Record<string, string>;
  // 音频：Web Audio 程序化合成（无外部资源）。缺省则游戏静音运行。
  audio?: AudioEngine;
}
