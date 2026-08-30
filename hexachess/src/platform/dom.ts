import { Platform, Pointer } from './types';
import { createMonetization } from './monetize';
import { createAudioEngine } from './audio';

// 浏览器平台实现（用于免 AppID 即时试玩 / 逻辑验证）
export function createDomPlatform(canvas: any): Platform {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  let downCb: (p: Pointer) => void = () => {};
  let moveCb: (p: Pointer) => void = () => {};
  let upCb: (p: Pointer) => void = () => {};

  const rect = () => canvas.getBoundingClientRect();
  canvas.addEventListener('pointerdown', (e: any) => {
    const r = rect();
    downCb({ x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId ?? 0 });
  });
  canvas.addEventListener('pointermove', (e: any) => {
    const r = rect();
    moveCb({ x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId ?? 0 });
  });
  const up = (e: any) => {
    const r = rect();
    upCb({ x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId ?? 0 });
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const m = createMonetization();

  // 浏览器 AudioContext 只创建一次（缓存），首次用户手势后由 resume() 解锁
  let ac: any = null;
  const audio = createAudioEngine(() => {
    if (!ac) {
      try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        ac = Ctor ? new Ctor() : null;
      } catch {
        return null;
      }
    }
    return ac;
  });

  return {
    getCanvas: () => canvas,
    createCanvas: (w: number, h: number) => {
      const c: any = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    },
    getDpr: () => dpr,
    getScreenSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
    onPointerDown: (cb) => { downCb = cb; },
    onPointerMove: (cb) => { moveCb = cb; },
    onPointerUp: (cb) => { upCb = cb; },
    raf: (cb) => requestAnimationFrame(cb),
    storageGet: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    storageSet: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    log: (...a) => console.log('[六边智将]', ...a),
    ads: m.ads,
    share: m.share,
    cloud: m.cloud,
    audio,
    launchQuery: () => {
      try {
        const q: Record<string, string> = {};
        new URL(location.href).searchParams.forEach((v, k) => (q[k] = v));
        return q;
      } catch {
        return {};
      }
    },
  };
}
