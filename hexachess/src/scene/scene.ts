// 场景机与宿主接口。现版没有场景：Board 一个类同时管玩法 / HUD / 工具条 / 引导 /
// Toast / 通关与失败遮罩，靠 over 字符串分流输入。这里把「谁在接收输入、谁在画」拆开。
import { PtrEvent } from '../platform/input';
import { AudioEngine } from '../platform/types';
import { LevelDef } from '../logic/state';
import { HitTree } from '../view/layout';
import { SpriteKit } from '../render/sprites';

export interface SaveData {
  unlocked: number;
  stars: Record<string, number>;
  best: number;
  muted: boolean;
  lang: 'zh' | 'en';
  items: { hint: number; shuffle: number; hammer: number };
}

export interface SceneHost {
  hits: HitTree;
  kit: SpriteKit;
  audio: AudioEngine;
  save: SaveData;
  lang(): 'zh' | 'en';
  reducedMotion(): boolean;
  /** 开发用：自动回放本关参考解（?autoplay=1） */
  autoplay(): boolean;
  totalLevels(): number;
  levelAt(id: number): LevelDef | null;
  /** 切场景：replace 清空栈，push 叠一层 */
  replace(name: string, arg?: unknown): void;
  persist(): void;
  /** 激励视频：看完返回 true。无广告能力（浏览器试玩）时返回 true 直接放行 */
  rewardAd(): Promise<boolean>;
  log(...a: unknown[]): void;
}

export interface Scene {
  readonly name: string;
  enter?(arg?: unknown): void;
  exit?(): void;
  update(dt: number): void;
  /** 绘制并向 hits 注册可点矩形；两者必须同源 */
  render(ctx: any, w: number, h: number): void;
  pointer?(e: PtrEvent): void;
}

export class SceneManager {
  private stack: Scene[] = [];
  private byName = new Map<string, Scene>();

  register(scene: Scene): Scene {
    this.byName.set(scene.name, scene);
    return scene;
  }

  current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  replace(name: string, arg?: unknown): void {
    const s = this.byName.get(name);
    if (!s) throw new Error('no scene: ' + name);
    while (this.stack.length) this.stack.pop()!.exit?.();
    this.stack.push(s);
    s.enter?.(arg);
  }

  update(dt: number): void {
    // 遮罩之下的场景不推进，避免游戏在结算界面背后偷偷跑倒计时
    this.current()?.update(dt);
  }

  render(ctx: any, w: number, h: number): void {
    this.current()?.render(ctx, w, h);
  }

  pointer(e: PtrEvent): void {
    this.current()?.pointer?.(e);
  }
}
