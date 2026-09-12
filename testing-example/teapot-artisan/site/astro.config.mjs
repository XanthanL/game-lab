// @ts-check
import { defineConfig } from 'astro/config';

// i18n：英文默认（根路径 /），中文 /zh/
export default defineConfig({
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
});
