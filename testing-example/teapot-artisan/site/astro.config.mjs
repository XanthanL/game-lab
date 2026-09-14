// @ts-check
import { defineConfig } from 'astro/config';

// 部署在 Pages 的子路径下，不是站点根 —— 没有 base 时产物里会写死 /_astro/、/about/，
// 上线后 CSS、图片、站内链接全部 404。改这里的路径必须和 dist/ 实际落点一致。
const BASE = '/game-lab/testing-example/teapot-artisan/site/dist/';

// i18n：英文默认（根路径 /），中文 /zh/
export default defineConfig({
  base: BASE,
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
});
