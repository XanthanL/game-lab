import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file:///E:/Code/mine-skills/testing-example/laochen-noodles/site/index.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const r = await page.evaluate(() => ({
  fontsStatus: document.fonts.status,
  dmSerif: document.fonts.check('20px "DM Serif Display"'),
  dmSans: document.fonts.check('16px "DM Sans"'),
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
console.log(JSON.stringify(r), '| errors:', errors.length ? errors : 'none');
await browser.close();
