import { Platform, Pointer } from './types';
import { createMonetization } from './monetize';
import { createAudioEngine } from './audio';

// 微信小游戏平台实现（运行于微信开发者工具 / 真机）
declare const wx: any;

export function createWxPlatform(): Platform {
  const canvas = wx.createCanvas();
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const dpr = info.pixelRatio || 1;
  const screenW = info.screenWidth || info.windowWidth;
  const screenH = info.screenHeight || info.windowHeight;

  let downCb: (p: Pointer) => void = () => {};
  let moveCb: (p: Pointer) => void = () => {};
  let upCb: (p: Pointer) => void = () => {};

  wx.onTouchStart((e: any) => {
    const t = e.touches[0];
    if (t) downCb({ x: t.clientX, y: t.clientY, id: t.identifier ?? 0 });
  });
  wx.onTouchMove((e: any) => {
    const t = e.touches[0];
    if (t) moveCb({ x: t.clientX, y: t.clientY, id: t.identifier ?? 0 });
  });
  wx.onTouchEnd((e: any) => {
    const t = (e.changedTouches && e.changedTouches[0]) || e.touches[0];
    if (t) upCb({ x: t.clientX, y: t.clientY, id: t.identifier ?? 0 });
  });

  const m = createMonetization();
  const audio = createAudioEngine(() => (wx.createWebAudioContext ? wx.createWebAudioContext() : null));
  return {
    getCanvas: () => canvas,
    createCanvas: (w: number, h: number) => {
      const c: any = wx.createCanvas();
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    },
    getDpr: () => dpr,
    getScreenSize: () => ({ width: screenW, height: screenH }),
    onPointerDown: (cb) => { downCb = cb; },
    onPointerMove: (cb) => { moveCb = cb; },
    onPointerUp: (cb) => { upCb = cb; },
    raf: (cb) => wx.requestAnimationFrame(cb),
    storageGet: (k) => { try { return wx.getStorageSync(k) ?? null; } catch { return null; } },
    storageSet: (k, v) => { try { wx.setStorageSync(k, v); } catch {} },
    log: (...a) => console.log('[六边智将]', ...a),
    ads: m.ads,
    share: m.share,
    cloud: m.cloud,
    audio,
    launchQuery: () => {
      try {
        return (wx.getLaunchOptionsSync?.()?.query as Record<string, string>) || {};
      } catch {
        return {};
      }
    },
  };
}
