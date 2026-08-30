import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://xanthanl.github.io/game-lab/golden-wind/out/'),
  title: '金价观象台 · Gold Observatory',
  description: '金价观象台 — 实时查看 XAU / AU9999 金价，K 线 + 均线 + 金叉死叉信号。',
  openGraph: {
    title: '金价观象台 · Gold Observatory',
    description: '实时查看 XAU / AU9999 金价，K 线 + 均线 + 金叉死叉信号。',
    images: ['thumbnail.jpg'],
  },
};

// 防闪烁：在 React 渲染前依本地偏好设置夜间模式
const themeScript = `(function(){try{var t=localStorage.getItem('gw_theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
