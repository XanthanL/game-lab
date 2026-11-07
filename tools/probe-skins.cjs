/* 回归探针：验证「每套皮肤一个自包含样式表」与原始全量 index.css 视觉等价。

   做法：本地服务按 query 生成两个**纯静态**页面，除了 CSS 那张 link 之外
   完全相同；分别导航后比较计算样式。不在运行时切样式表 —— 那样会有
   disabled / onload 竞态，量出来的差异全是假阳性。
     ?skin=X        → 拆分版，加载 assets/skins/X.css
     ?skin=X&full=1 → 全量版，加载 assets/index.css（基准）
   两个页面都把 head 预置脚本的皮肤名写死为 X，并移除 skin-loader，
   保证首屏就是目标皮肤、没有后续 href 改动。

   跑法（Windows，本机）：
     NODE_PATH=C:/Users/www27/.workbuddy/verify/node_modules node tools/probe-skins.cjs
   可传皮肤名只跑几套：node tools/probe-skins.cjs hermes aperture
   依赖 puppeteer-core + 本机 Google Chrome；静态服务自起自关。
*/
const puppeteer = require("puppeteer-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8231;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
               ".js": "application/javascript; charset=utf-8", ".cjs": "text/plain",
               ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
               ".woff2": "font/woff2", ".woff": "font/woff", ".mp3": "audio/mpeg" };
const HOME = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const BASE_HTML = HOME.replace(/\.\/assets\/skins\/hermes\.css/g, "__SKIN_CSS__")
                      .replace(/<script src="\.\/assets\/skin-loader\.js"><\/script>\s*/g, "")
                      .replace('var st = localStorage.getItem("gl-style");', 'var st = "__SKIN__";')
                      .replace("</head>", "<style>*,*::before,*::after{transition:none!important;animation:none!important}</style></head>");
if (!BASE_HTML.includes("__SKIN_CSS__") || !BASE_HTML.includes("__SKIN__")) {
  throw new Error("探针无法在 index.html 中定位样式表 / 皮肤变量，检查页面结构是否改过");
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  if (u.pathname === "/index.html") {
    const skin = u.searchParams.get("skin") || "hermes";
    const css = u.searchParams.get("full") ? "./assets/index.css" : "./assets/skins/" + skin + ".css";
    const body = BASE_HTML.replace(/__SKIN_CSS__/g, css).replace(/__SKIN__/g, skin);
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(body);
    return;
  }
  let rel = decodeURIComponent(u.pathname);
  if (rel === "/" || rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end("404"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const CSS = fs.readFileSync(path.join(ROOT, "assets/index.css"), "utf8");
const VARS = [...new Set((CSS.match(/--[a-zA-Z0-9_-]+/g) || []))].sort();
const only = process.argv.slice(2);
const STYLES = fs.readdirSync(path.join(ROOT, "assets/skins"))
  .filter(f => f.endsWith(".css")).map(f => f.slice(0, -4))
  .filter(s => !only.length || only.includes(s)).sort();

/* 只比「声明型」属性。width / auto margin / px 行高会随 webfont 加载时机变化，
   属于假阳性；源序保留与否要看颜色、边框、阴影、变量这些不会被布局改写的量。 */
const PROPS = [
  "background-color", "background-image", "background-position", "background-size",
  "color", "border-top-width", "border-top-style", "border-top-color", "border-radius",
  "box-shadow", "font-family", "font-size", "font-weight", "letter-spacing",
  "text-shadow", "opacity", "filter", "backdrop-filter", "display",
  "position", "transform", "text-decoration-line", "outline-style", "mix-blend-mode",
  "overflow-x", "overflow-y"
];
const SELS = ["html", "body", ".wrap", ".topbar", ".brand", ".hero", ".foot-meta a",
              ".cat-tab", ".rl-row", ".ring-sec", ".skin-panel", ".skin-toggle"];
/* 皮肤文件在 skins/ 下，url 写成 ../bg/…；指向同一个资源，比较前抹掉 ../ */
const norm = v => String(v || "").replace(/\.\.\//g, "").replace(/\s+/g, " ").trim();

function snapshotFn(vars, props, sels) {
  const out = {};
  void document.body.offsetHeight;
  const cs = getComputedStyle(document.documentElement);
  for (const v of vars) out["@" + v] = cs.getPropertyValue(v).replace(/\s+/g, " ").trim();
  for (const s of sels) {
    const el = document.querySelector(s);
    if (!el) continue;
    const c = getComputedStyle(el);
    for (const p of props) out[s + "|" + p] = c.getPropertyValue(p).replace(/\s+/g, " ").trim();
  }
  return out;
}

async function openSnap(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(r => setTimeout(r, 80));
  });
  return page.evaluate(snapshotFn, VARS, PROPS, SELS);
}

(async () => {
  await new Promise(r => server.listen(PORT, "127.0.0.1", r));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"]
  });
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  await Promise.all([pageA, pageB].map(p => p.setViewport({ width: 1280, height: 900 })));
  const errors = [];
  for (const p of [pageA, pageB]) {
    p.on("pageerror", e => errors.push("pageerror: " + e.message));
    p.on("response", r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  }

  let bad = 0, checked = 0;
  for (const s of STYLES) {
    const [a, b] = await Promise.all([
      openSnap(pageA, `http://127.0.0.1:${PORT}/index.html?skin=${s}`),
      openSnap(pageB, `http://127.0.0.1:${PORT}/index.html?skin=${s}&full=1`)
    ]);
    const diff = [];
    for (const k of Object.keys(a)) if (norm(a[k]) !== norm(b[k])) diff.push(`${k}: ${a[k] || "(空)"} != ${b[k] || "(空)"}`);
    checked += Object.keys(a).length;
    if (diff.length) {
      bad++;
      console.log(`\n[${s}] ${diff.length} 项不一致`);
      diff.slice(0, 6).forEach(d => console.log("   " + d.slice(0, 200)));
      if (diff.length > 6) console.log("   ... 另 " + (diff.length - 6) + " 项");
    }
  }
  console.log(`\n皮肤 ${STYLES.length} 套，比对 ${checked} 项计算样式，不一致皮肤数 ${bad}`);
  console.log(`页面错误 / 4xx ${errors.length} 条`);
  [...new Set(errors)].slice(0, 10).forEach(e => console.log("   " + e));
  await browser.close();
  server.close();
  process.exit(bad || errors.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
