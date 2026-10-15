// 一条命令跑全套回归：  node probes/run-all.js [名字过滤]
//
// 为什么需要它：老探针要么自己起服务、要么指望外部 8612，各自为政，
// 跑一次全套得先手工起 http server、再一个个 node 过去。这里统一：
//   ① 起一个共享静态服务，SV_URL 注入给所有子进程（依赖外部的那个 6 个直接复用）
//   ② CHROME_EXE 由 probe-lib 自动解析，这里不用管
//   ③ 逐个 spawn，用 exit code 判定成败（探针失败时都 process.exit(1)），最后汇总
//
// 例：
//   node probes/run-all.js            # 全跑
//   node probes/run-all.js touch      # 只跑名字里含 touch 的
//   node probes/run-all.js boot perf  # 含 boot 或 perf 的

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..');
const SKIP = new Set(['probe-lib.js', 'run-all.js']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml',
};

// node_modules 在哪？本机放在隔离目录里，直接 node 跑会 require 不到 playwright-core
function nodePath() {
  const parts = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  const cand = ['C:/Users/www27/.workbuddy/verify/node_modules'];
  for (const c of cand) if (fs.existsSync(path.join(c, 'playwright-core')) && !parts.includes(c)) parts.push(c);
  return parts.join(path.delimiter);
}

function serve() {
  const R = path.resolve(ROOT);   // 同 probe-lib：path.join 吐反斜杠，比较前先统一
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
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

function run(file, env) {
  return new Promise(res => {
    const t0 = Date.now();
    const out = [];
    // ⚠️ cwd 必须是项目根，不是 probes/：好几个探针往相对路径写截图（'probes/xxx.png'），
    //    在 probes/ 里起就会写成 probes/probes/xxx.png 直接 ENOENT。
    const cp = spawn(process.execPath, [path.join(DIR, file)], {
      cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const grab = d => d.on('data', b => out.push(b.toString()));
    grab(cp.stdout); grab(cp.stderr);
    const timer = setTimeout(() => cp.kill('SIGKILL'), 240000);   // 单探针 4 分钟上限
    cp.on('close', code => {
      clearTimeout(timer);
      res({ file, code, ms: Date.now() - t0, out: out.join('') });
    });
  });
}

(async () => {
  const filter = process.argv.slice(2);
  let files = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !SKIP.has(f)).sort();
  if (filter.length) files = files.filter(f => filter.some(k => f.includes(k)));
  if (!files.length) { console.error('没有匹配的探针：' + filter.join(' ')); process.exit(2); }

  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const env = { ...process.env, NODE_PATH: nodePath(), SV_URL: base };

  console.log('共享静态服务 ' + base + '   共 ' + files.length + ' 个探针\n');
  const rows = [];
  for (const f of files) {
    const r = await run(f, env);
    rows.push(r);
    const tag = r.code === 0 ? 'PASS' : 'FAIL';
    console.log(('  [' + tag + '] ' + f).padEnd(46) + (r.ms / 1000).toFixed(1) + 's');
    if (r.code !== 0) {
      // 失败时把尾部输出打出来，省得再单独跑一遍看原因
      const tail = r.out.trim().split(/\r?\n/).slice(-6);
      for (const l of tail) console.log('         │ ' + l);
    }
  }
  server.close();

  const bad = rows.filter(r => r.code !== 0);
  console.log('\n== 汇总 ==  ' + (rows.length - bad.length) + ' PASS / ' + bad.length + ' FAIL'
    + '   总耗时 ' + (rows.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(0) + 's');
  if (bad.length) console.log('   失败：' + bad.map(r => r.file.replace(/^sv-|\.js$/g, '')).join(', '));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
