// 输入归一层：主指针追踪 + cancel 语义。
// 现版把任意 touch 都转发进来且不看 pointerId，两指同按就会撕裂拖拽状态
// （platform/dom.ts 与 wx.ts 都已带上 id，只是没人用）。
import { Platform, Pointer } from './types';

export type Phase = 'down' | 'move' | 'up' | 'cancel';

export interface PtrEvent {
  x: number;
  y: number;
  id: number;
  phase: Phase;
}

export interface InputHub {
  on(cb: (e: PtrEvent) => void): void;
  /** 场景在动画锁定期间可调用：忽略新的 down，但放行进行中的拖拽收尾 */
  setIgnoreNewDown(v: boolean): void;
  activeId(): number | null;
}

export function createInput(platform: Platform): InputHub {
  let handler: (e: PtrEvent) => void = () => {};
  let active: number | null = null;
  let ignoreNewDown = false;

  const emit = (e: PtrEvent) => handler(e);

  platform.onPointerDown((p: Pointer) => {
    if (active !== null) return; // 已有主指针，忽略后续手指
    if (ignoreNewDown) return;
    active = p.id;
    emit({ x: p.x, y: p.y, id: p.id, phase: 'down' });
  });

  platform.onPointerMove((p: Pointer) => {
    if (active === null || p.id !== active) return;
    emit({ x: p.x, y: p.y, id: p.id, phase: 'move' });
  });

  platform.onPointerUp((p: Pointer) => {
    if (active === null || p.id !== active) return;
    active = null;
    emit({ x: p.x, y: p.y, id: p.id, phase: 'up' });
  });

  return {
    on(cb) {
      handler = cb;
    },
    setIgnoreNewDown(v) {
      ignoreNewDown = v;
    },
    activeId() {
      return active;
    },
  };
}

// 注：cancel 语义已由平台层归约 —— dom.ts 把 pointercancel 接到同一个 up 回调，
// wx.ts 用 touchEnd 的 changedTouches，因此这里不需要额外通道。
