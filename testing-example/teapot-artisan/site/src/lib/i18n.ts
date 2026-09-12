export type Lang = 'en' | 'zh';

import site from '../data/site.json';

type SiteStrings = (typeof site)['en'];

export function strings(lang: Lang): SiteStrings {
  return site[lang] as SiteStrings;
}

export function switchPath(pathname: string, to: Lang): string {
  const clean = pathname.replace(/^\/zh(?=\/|$)/, '') || '/';
  return to === 'zh' ? '/zh' + (clean === '/' ? '/' : clean) : clean;
}

export const brandZh: string = site.brand.zh;
export const brandEn: string = site.brand.en;
export const siteEmail: string = site.email;
