/* BGM 内存探针 —— 量化「解码后常驻内存」到底有多大。
 *
 * 背景：BGMManager._load() 走 fetch → arrayBuffer → decodeAudioData，
 * 也就是**整首曲子解码成 Float32 PCM 后再缓存**，LRU 上限 4 首。
 * mp3 只有 4~6 MB，但解码后按 duration × sampleRate × 声道 × 4 字节算，
 * 可能大两个数量级。这个探针就是把那个数字量出来，别再靠估算吵。
 *
 * ⚠️ 必须跑在 http 上：fetch 在 file:// 下会被 CORS 挡掉，BGM 会静默加载失败
 *    （代码里是 try/catch + console.warn，页面照常跑，很容易误判成"没问题"）。
 *
 * 用法：
 *   python -m http.server 8731 --directory E:/Code/game-lab
 *   NODE_PATH=<playwright-core 的 node_modules> node probe-bgm-mem.js
 */

const { chromium } = require('playwright-core');
const { exe } = require('./_browser');

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:8731';
const GROUPS = ['menu', 'cruise', 'combat', 'boss', 'evolve', 'endless', 'end'];

const MB = (b) => (b / 1048576).toFixed(1) + ' MB';

const SNAPSHOT = `
JSON.stringify((() => {
  const out = [];
  for (const [url, buf] of BGM.cache) {
    out.push({
      url: url.replace(/^.*\\//, ''),
      dur: +buf.duration.toFixed(1),
      sr: buf.sampleRate,
      ch: buf.numberOfChannels,
      bytes: Math.round(buf.duration * buf.sampleRate * buf.numberOfChannels * 4),
    });
  }
  return {
    cached: BGM.cache.size,
    group: BGM.group,
    ctxState: (AU.ctx && AU.ctx.state) || 'none',
    ctxRate: (AU.ctx && AU.ctx.sampleRate) || 0,
    heap: (performance.memory && performance.memory.usedJSHeapSize) || 0,
    entries: out,
    totalBytes: out.reduce((s, e) => s + e.bytes, 0),
  };
})())
`;

(async () => {
  const b = await chromium.launch({
    executablePath: exe(),
    args: [
      '--autoplay-policy=no-user-gesture-required', // 否则 AudioContext 起不来
      '--mute-audio',
      '--enable-precise-memory-info',
    ],
  });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('  PAGEERROR', e.message));
  p.on('console', (m) => { if (m.type() === 'warning') console.log('  warn:', m.text()); });

  await p.goto(BASE + '/singularity-echo/index.html');
  await p.waitForFunction(() => window.NOVA && window.NOVA.debug, null, { timeout: 30000 });
  await p.evaluate(() => NOVA.debug('AU.ensure(); BGM.unlock();'));
  await p.waitForTimeout(500);

  const snap = () => p.evaluate((code) => JSON.parse(NOVA.debug(code)), SNAPSHOT);
  const s0 = await snap();
  console.log(`AudioContext: ${s0.ctxState} @ ${s0.ctxRate} Hz`);
  console.log(`初始 JS 堆: ${MB(s0.heap)}\n`);

  let peak = 0;
  for (const g of GROUPS) {
    await p.evaluate((grp) => NOVA.debug(`BGM.switchTo('${grp}')`), g);
    // 等到这一组真的出声（或超时）
    await p.waitForFunction(() => NOVA.debug('!!(BGM.cur && BGM.cur.src)'), null, { timeout: 30000 })
      .catch(() => {});
    await p.waitForTimeout(1200);
    const s = await snap();
    peak = Math.max(peak, s.totalBytes);
    const per = s.entries.map((e) => `${e.url.slice(0, 22)} ${e.dur}s ${e.ch}ch ${MB(e.bytes)}`).join(' | ');
    console.log(
      `${g.padEnd(8)} 缓存 ${s.cached} 首 · 合计 ${MB(s.totalBytes).padStart(9)} · 堆 ${MB(s.heap).padStart(9)}\n         ${per}`
    );
  }

  // 冷加载耗时：决定「缓存压到 1 首」会不会在切场景时听出空档。
  // 注意这里是本机 http，只反映 fetch + decode 的成本，不含真实网络延迟。
  // BGM 是脚本内部作用域的 const，页面全局拿不到，必须借 NOVA.debug 在作用域里 eval
  const cold = await p.evaluate(async () => await NOVA.debug(
    '(async()=>{BGM.cache.clear();' +
    'const url=BGM.groups.evolve.urls[0];' +
    'const t0=performance.now();' +
    'const buf=await BGM._load(url);' +
    'return {ms:Math.round(performance.now()-t0),ok:!!buf};})()'
  ));
  console.log(`\n冷加载一首（本机 http，仅 fetch+decode）: ${cold.ms} ms`);

  const fin = await snap();
  console.log(`\n峰值解码内存: ${MB(peak)}（LRU 上限 4 首）`);
  console.log(`JS 堆变化:    ${MB(s0.heap)} → ${MB(fin.heap)}（+${MB(fin.heap - s0.heap)}）`);
  console.log('\n注：AudioBuffer 的内存在 Chrome 里通常不计入 JS 堆，');
  console.log('    所以「峰值解码内存」才是真实占用，堆变化只能当参考。');

  await b.close();
})();
