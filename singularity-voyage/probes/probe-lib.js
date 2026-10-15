// 探针共享工具（不是探针本身，run-all 会跳过它）
//
// 存在的理由：以前每个探针都各自写
//   const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
//   const BASE   = process.env.SV_URL     || 'http://127.0.0.1:8612/index.html';
// 两条默认值在本机都不成立：本机没装 Google Chrome，也没人常驻 8612，
// 于是「直接 node probes/xxx.js」必然失败，得先手工起服务、再手工传 CHROME_EXE。
// 这里把它们变成「自己找 / 自己起」，探针就能开箱即跑。
//
// 用法：
//   const { chrome: CHROME, ensureBase, serve } = require('./probe-lib');
//   let BASE = process.env.SV_URL || 'http://127.0.0.1:8612/index.html';
//   (async () => { BASE = await ensureBase(BASE); ... })()

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');

// ---------------- 浏览器路径 ----------------

// 候选 1：环境变量（作者想临时换浏览器时用它）
// 候选 2：playwright 自己下载的 chromium（本机就是这条命中）
// 候选 3：系统装的 Chrome / Edge（别人机器上大概率是这条）
function findChrome() {
  if (process.env.CHROME_EXE) return process.env.CHROME_EXE;

  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    || path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (fs.existsSync(pwRoot)) {
    // chromium-1228 / chromium_headless_shell-1228 …取版本号最大的那个
    const dirs = fs.readdirSync(pwRoot)
      .filter(d => /^chromium(-|_)/.test(d))
      .sort((a, b) => {
        const na = parseInt((a.match(/(\d+)$/) || [0, 0])[1], 10);
        const nb = parseInt((b.match(/(\d+)$/) || [0, 0])[1], 10);
        return nb - na;
      });
    for (const d of dirs) {
      // 完整 chromium 优先于 headless shell（headless shell 跑不了有头模式）
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']) {
        const p = path.join(pwRoot, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }

  const system = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of system) if (fs.existsSync(p)) return p;
  return null;
}

const chrome = findChrome();

if (!chrome) {
  console.error('[probe-lib] 找不到浏览器。装一个： npx playwright install chromium\n'
    + '          或者用 CHROME_EXE=<路径> 指定。');
  process.exit(1);
}

// ---------------- 静态服务 ----------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// root 默认是项目根（probes/ 的上一级）
function serve(port = 0, root = path.resolve(__dirname, '..')) {
  // ⚠️ 必须 resolve：Windows 上 path.join 一律吐反斜杠，直接拿调用方传进来的
  //    正斜杠 root 去做 startsWith 会全部失配 —— 表现是「页面加载了但整个是 404」，
  //    极其难查（页面 readyState=complete，只是 body 里写着 404）。
  const R = path.resolve(root);
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const fp = path.join(R, p);
    if (!fp.startsWith(R) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      s.writeHead(404); s.end('404'); return;
    }
    s.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(s);
  });
  return new Promise((res, rej) => {
    server.once('error', rej);
    // 端口 0 = 让系统挑一个空闲的，彻底避开「几个探针抢同一个 8612」
    server.listen(port, '127.0.0.1', () => {
      // ⚠️ unref：不然自起的服务会把 node 进程一直挂住，探针跑完也退不出去
      server.unref();
      res({ server, base: 'http://127.0.0.1:' + server.address().port + '/index.html' });
    });
  });
}

// 端口上有人在听吗？（用来判断「外部服务已经起了没」）
function listening(port, host = '127.0.0.1') {
  return new Promise(res => {
    const s = net.connect(port, host);
    const done = ok => { s.destroy(); res(ok); };
    s.setTimeout(400);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
  });
}

// 给「依赖外部服务」的老探针用：
//   1) 设了 SV_URL 就用 SV_URL（不碰）
//   2) 默认端口上已经有人在听 → 原样返回（复用手工起的 python -m http.server，行为不变）
//   3) 没人听 → 自己起一个，返回新地址
async function ensureBase(preferred) {
  const u = new URL(preferred);
  if (await listening(Number(u.port || 80), u.hostname)) return preferred;
  const { base } = await serve(0);
  console.log('[probe-lib] ' + preferred + ' 没人在听，已自起静态服务 → ' + base);
  return base;
}

// 老探针里存的常常是**带 query 的完整地址**（`.../index.html?god=1`），
// 直接拿去 ensureBase 会把 `?god=1` 当成路径一部分。这里拆开再拼回去。
async function ensureUrl(full) {
  const u = new URL(full);
  const base = await ensureBase(u.origin + u.pathname);
  return base + (u.search || '');
}

module.exports = { chrome, serve, ensureBase, ensureUrl, listening };
