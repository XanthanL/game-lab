/* 找本机可用的 Chromium —— 不要写死版本号。
 *
 * 为什么需要它：playwright-core 的 chromium.executablePath() 返回的是**它自己那份
 * registry 里登记的版本号**（比如 chromium-1234），而本机装的可能是另一个 build
 * （比如 1234 还没下、只有 1228）。直接用就会报
 *   "Failed to launch chromium because executable doesn't exist at ...chromium-1234..."
 * 所以这里自己扫一遍 ms-playwright 缓存目录，取装了的、版本号最大的那个。
 *
 * 优先级：CHROME_EXE 环境变量 > registry 指向且确实存在 > 缓存目录里最新的 build。
 */

const fs = require('fs');
const path = require('path');

function cacheDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (process.platform === 'win32') return path.join(home, 'AppData', 'Local', 'ms-playwright');
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Caches', 'ms-playwright');
  return path.join(home, '.cache', 'ms-playwright');
}

const EXE_RE = /^(chrome|headless_shell|chrome-headless-shell)(\.exe)?$/i;

function scan(dir, depth, out) {
  if (depth < 0) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p, depth - 1, out);
    else if (e.isFile() && EXE_RE.test(e.name)) out.push(p);
  }
}

function findExe() {
  if (process.env.CHROME_EXE) return process.env.CHROME_EXE;

  const { chromium } = require('playwright-core');
  const registered = chromium.executablePath();
  if (fs.existsSync(registered)) return registered;

  const dir = cacheDir();
  const found = [];
  scan(dir, 3, found);
  if (!found.length) return registered; // 交给 playwright 报它自己的错，信息更准

  // 路径里带 build 号（chromium_headless_shell-1228），取最大的那个
  const build = (p) => parseInt((p.match(/-(\d+)[\\/]/) || [])[1] || '0', 10);
  found.sort((a, b) => build(b) - build(a));
  return found[0];
}

module.exports = { exe: findExe, cacheDir };
