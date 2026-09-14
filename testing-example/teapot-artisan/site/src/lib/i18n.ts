export type Lang = 'en' | 'zh';

import site from '../data/site.json';

type SiteStrings = (typeof site)['en'];

export function strings(lang: Lang): SiteStrings {
  return site[lang] as SiteStrings;
}

/**
 * 部署 base（astro.config.mjs 里的 base）。末尾带斜杠。
 * 站内任何绝对路径都要过一遍 local()，否则上线 404。
 */
export const BASE: string = import.meta.env.BASE_URL;

/** 把站内绝对路径挂到部署 base 之下：`/about/` → `/game-lab/…/dist/about/` */
export function local(p: string): string {
  return BASE.replace(/\/+$/, '') + (p.startsWith('/') ? p : '/' + p);
}

export function switchPath(pathname: string, to: Lang): string {
  // 先剥掉 base，再判 /zh，最后挂回去 —— 顺序反了会把 base 当成语言前缀
  const rel = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\/+/, '');
  const clean = ('/' + rel).replace(/^\/zh(?=\/|$)/, '') || '/';
  return local(to === 'zh' ? '/zh' + (clean === '/' ? '/' : clean) : clean);
}

export const brandZh: string = site.brand.zh;
export const brandEn: string = site.brand.en;
export const siteEmail: string = site.email;
