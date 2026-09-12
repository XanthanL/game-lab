import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
page.on('requestfailed', r => errors.push('REQ FAIL: ' + r.url()));

// 滚动全页触发懒加载，等所有图片解码完成
async function settle(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await Promise.all(Array.from(document.images).map(img =>
      img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; })
    ));
    await document.fonts.ready;
  });
  await new Promise(r => setTimeout(r, 200));
}

await page.setViewport({ width: 1280, height: 900 });
await page.goto('http://127.0.0.1:8321/', { waitUntil: 'networkidle0' });
await settle(page);
await page.screenshot({ path: 'desktop-full.png', fullPage: true });

await page.setViewport({ width: 375, height: 812 });
await page.reload({ waitUntil: 'networkidle0' });
await settle(page);
await page.screenshot({ path: 'mobile-full.png', fullPage: true });

// 灰度版：验证视觉签名过「关掉颜色还成立吗」
await page.setViewport({ width: 1280, height: 900 });
await page.reload({ waitUntil: 'networkidle0' });
await settle(page);
await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: 'desktop-gray.png', fullPage: true });

const pending = await page.evaluate(() =>
  Array.from(document.images).filter(i => !i.complete || !i.naturalWidth).length);
console.log('images pending:', pending, '| console errors:', errors.length ? errors : 'none');
await browser.close();
