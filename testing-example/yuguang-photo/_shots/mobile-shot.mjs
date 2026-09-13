// 截图工装：CDP 真移动仿真 + 整页截图（仅测试用，不属于交付物）
// 用法: node mobile-shot.mjs <url> <out.png> <width> [height]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [url, out, wStr, hStr] = process.argv.slice(2);
const W = parseInt(wStr || '375', 10);
const H = parseInt(hStr || '900', 10);
const PORT = 9333;

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=' + process.env.TEMP + '/cdp-profile-' + Date.now(),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  let target;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch {}
  }
  if (!target) throw new Error('no CDP target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) { events.push(msg.method); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: W < 600,
  });
  await send('Page.enable');
  await send('Page.navigate', { url });
  for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
  await sleep(800);

  // 逐屏滚动触发懒加载，并等所有图片加载完成
  const { result: scroll } = await send('Runtime.evaluate', {
    expression: `(async () => {
      const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await Promise.all([...document.images].map(img => img.complete ? 1 :
        new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 5000); })));
      return JSON.stringify({
        imgs: document.images.length,
        done: [...document.images].filter(i => i.complete && i.naturalWidth > 0).length,
        h: document.documentElement.scrollHeight,
      });
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  console.log('scroll:', scroll.result && scroll.result.value);
  await sleep(500);

  const { result: metrics } = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, iw: window.innerWidth})', returnByValue: true,
  });
  console.log('metrics:', metrics.value);

  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('written', out);
  ws.close();
  chrome.kill();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
