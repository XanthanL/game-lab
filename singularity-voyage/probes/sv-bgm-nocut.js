// 成品曲「播完再换」验证（2026-10-16）
//
// 背景：旧实现在 setMode 里直接 pause 旧的 / play 新的，波次起伏 + 进出 boss 能把一首歌
//       剁成几段。作者要求：**已经在播的这首放完，才允许开始播下一首**。
// 验证的是三件事：
//   ① setMode 之后，正在播的那首一个字节都没动（src 不变、currentTime 不回零）
//   ② 那一刻不许去下载新曲（否则就是「已经在偷偷准备切」）
//   ③ 曲子自然播到 ended 之后，才真的换成新曲
//
// 运行： node probes/sv-bgm-nocut.js

const { chromium } = require('playwright-core');
const { chrome: CHROME, serve } = require('./probe-lib');

let pass = 0, fail = 0;
const chk = (ok, msg, extra) => {
  if (ok) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra ? '   → ' + extra : '')); }
};
const shortName = u => (u || '').split('/').pop();

(async () => {
  const { server, base } = await serve(0);
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  const errs = [], mp3 = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });
  page.on('request', r => { if (/\.mp3($|\?)/.test(r.url())) mp3.push(shortName(r.url())); });

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__dbg && window.__dbg.state === 'title', null, { timeout: 30000 });

  // ① 首次手势 → Sound.init() → armFileBgm(1200ms) → 第一首开始下
  await page.mouse.click(450, 260);
  await page.waitForFunction(
    () => typeof Sound !== 'undefined' && Sound.dbg.cur && Sound.dbg.cur.readyState >= 3,
    null, { timeout: 40000 });

  const s0 = await page.evaluate(() => {
    const d = Sound.dbg;
    return { src: d.src, curMode: d.curMode, wantMode: d.wantMode, t: d.cur.currentTime, paused: d.cur.paused, loop: d.cur.loop };
  });
  console.log('== 起步 ==');
  chk(!!s0.src, '① 手势之后成品曲起来了：' + shortName(s0.src));
  chk(s0.paused === false, '①b 它确实在播（paused=false）');
  chk(s0.curMode === 'title', '①c curMode=title（标题页播的是标题曲）', '实际 ' + s0.curMode);

  // ② 切到 boss —— 按新纪律，此刻**什么声音都不该变**
  const before = mp3.length;
  await page.evaluate(() => { Sound.setMode('boss'); });
  await page.waitForTimeout(300);
  const s1 = await page.evaluate(() => {
    const d = Sound.dbg;
    return { src: d.src, curMode: d.curMode, wantMode: d.wantMode, t: d.cur.currentTime, paused: d.cur.paused, loop: d.cur.loop };
  });
  console.log('== setMode(boss) 之后（不该有任何变化）==');
  chk(s1.src === s0.src, '② 正在播的那首没被换掉：仍是 ' + shortName(s1.src), '变成了 ' + shortName(s1.src));
  chk(s1.paused === false, '②b 它还在播，没被 pause');
  chk(s1.t >= s0.t, '②c 播放位置没回零（' + s0.t.toFixed(2) + 's → ' + s1.t.toFixed(2) + 's）');
  chk(s1.wantMode === 'boss', '②d 只是把「下一首」记成了 boss', '实际 ' + s1.wantMode);
  chk(s1.curMode === 'title', '②e curMode 仍是 title（换曲还没发生）', '实际 ' + s1.curMode);
  const pulled = mp3.slice(before);
  chk(!pulled.some(n => /Colossus/.test(n)), '②f 此刻没去下载 boss 曲（' + (pulled.length ? pulled.join(',') : '无新增请求') + '）');

  // ③ 让它自然播完 —— 把播放头推到结尾，走真实的 ended 路径。
  // ⚠️ 必须等 readyState 到 4（整首都在缓冲区里）再 seek：
  //    mp3 是流式加载的，数据没到就 seek 到 239s 会被 Chrome 直接弹回 0，
  //    表现为「设了 currentTime 却从 0 开始播」，ended 永远不来（踩过）。
  chk(s1.loop === false, '②g loop 已关掉（否则永远播不完、也就永远换不了曲）', 'loop=' + s1.loop);
  // ⚠️ 为什么直接派发 ended 而不是等它真的播完：
  //    ① 一首 4 分钟，等不起；② 本机 headless 下 seek 到结尾并不可靠 ——
  //       mp3 的 duration 未必准（这-reporting 239s），且缓冲没铺满时 seek 会被弹回 0。
  //    「真实环境会不会走到 ended」由 ②g（loop=false）单独守住：不循环就一定会播完。
  //    派发事件走的是**同一个 handler**，验的还是同一条换曲逻辑。
  // ⚠️ 派发前必须 pause()：合成的 ended 事件**不会**把 audio.ended 置真，
  //    而 startFileCur 的「不许打断」判据看的就是 ended/paused —— 不 pause 会被它当成
  //    「还在播」直接挡回去，换曲就永远不发生（真实播放到结尾时 ended 本来就是 true）。
  await page.evaluate(() => { const a = Sound.dbg.cur; a.pause(); a.dispatchEvent(new Event('ended')); });
  await page.waitForTimeout(1500);
  await page.waitForFunction(
    () => Sound.dbg.curMode === 'boss' && Sound.dbg.src && /Colossus/.test(Sound.dbg.src),
    null, { timeout: 30000 }).catch(() => {});
  const s2 = await page.evaluate(() => {
    const d = Sound.dbg;
    return { src: d.src, curMode: d.curMode, wantMode: d.wantMode, paused: d.cur.paused, t: d.cur.currentTime };
  });
  console.log('== 上一首播完（ended）之后 ==');
  chk(/Colossus/.test(s2.src || ''), '③ 换成了 boss 曲：' + shortName(s2.src), '仍是 ' + shortName(s2.src));
  chk(s2.curMode === 'boss', '③b curMode 跟进为 boss', '实际 ' + s2.curMode);
  chk(s2.paused === false, '③c 新曲在播');
  chk(mp3.some(n => /Colossus/.test(n)), '③d 这时候才去下载 boss 曲');
  chk(s2.t < 5, '③e 新曲从头开始播（t=' + s2.t.toFixed(2) + 's）');

  // ④ 同一首播完应该续播，而不是停（同 ③：pause 后派发 ended）
  await page.evaluate(() => { const a = Sound.dbg.cur; a.pause(); a.dispatchEvent(new Event('ended')); });
  await page.waitForTimeout(1200);
  const s3 = await page.evaluate(() => {
    const d = Sound.dbg;
    return { src: d.src, curMode: d.curMode, paused: d.cur.paused, t: d.cur.currentTime };
  });
  console.log('== 同一首播完（不该停）==');
  chk(/Colossus/.test(s3.src || ''), '④ 还是 boss 曲（没跑掉）', shortName(s3.src));
  chk(s3.paused === false, '④b 续播没停（等效旧的 loop=true）');
  chk(s3.t < 5, '④c 从头续播（t=' + s3.t.toFixed(2) + 's）');

  console.log('== JS 错误 ==');
  console.log(errs.length ? errs.slice(0, 5).join('\n') : ' 无');
  chk(errs.length === 0, '无 JS 错误');

  console.log('\n== mp3 请求全程 ==  ' + mp3.join(' → '));
  chk(mp3.length <= 3, '全程只拉了 ' + mp3.length + ' 首（不预取，一次一首）');

  await browser.close();
  server.close();
  console.log('\n==> ' + (fail ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
