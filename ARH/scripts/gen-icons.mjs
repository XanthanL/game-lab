// 图标生成器（一次性工具）：从 public/*.svg 母版生成 favicon.ico / apple-touch-icon.png / share.png
// 依赖未入库，使用前先执行：npm i -D sharp png-to-ico，然后 npm run gen:icons
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const faviconSvg = readFileSync(join(root, 'favicon.svg'));
const shareSvg = readFileSync(join(root, 'share.svg'));

// PNG 光栅化（density 提高以获得清晰边缘）
const render = (svg, size) =>
  sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer();

// 1) favicon 多尺寸 -> favicon.ico
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await render(faviconSvg, s));
const ico = await pngToIco(pngs);
writeFileSync(join(root, 'favicon.ico'), ico);
console.log('favicon.ico', ico.length, 'bytes');

// 2) apple-touch-icon 180x180
writeFileSync(join(root, 'apple-touch-icon.png'), await render(faviconSvg, 180));
console.log('apple-touch-icon.png ok');

// 3) 微信/OG 分享卡 600x600
writeFileSync(join(root, 'share.png'), await sharp(shareSvg, { density: 192 }).resize(600, 600).png().toBuffer());
console.log('share.png ok');
