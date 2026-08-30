export type TranslationKey =
  | 'nav.music'
  | 'nav.about'
  | 'hero.subtitle'
  | 'hero.cta'
  | 'hero.scroll'
  | 'music.title'
  | 'music.albumTitle'
  | 'music.albumDesc'
  | 'music.albumMeta'
  | 'music.buffering'
  | 'music.networkError'
  | 'about.signalSource'
  | 'about.para1'
  | 'about.para2'
  | 'about.para3'
  | 'about.quote'
  | 'about.quoteAuthor'
  | 'about.materializing'
  | 'about.signalLocked'
  | 'about.replay'
  | 'about.mute'
  | 'about.unmute'
  | 'footer.tagline'
  | 'footer.description1'
  | 'footer.description2'
  | 'footer.hint'
  | 'footer.moreWorks'
  | 'footer.copyright';

export const translations: Record<'en' | 'zh', Record<TranslationKey, string>> = {
  en: {
    'nav.music': 'Music',
    'nav.about': 'About',
    'hero.subtitle': 'Synth-Pop • Neo-Psychedelic',
    'hero.cta': 'Enter',
    'hero.scroll': 'Scroll',
    'music.title': 'Music',
    'music.albumTitle': 'Electric Mirage',
    'music.albumDesc':
      'Synth-pop drenched in 80s disco drums and neo-psychedelic textures. Phasing effects and ethereal vocals define the sound of XanthanL.',
    'music.albumMeta':
      'A hypnotic fusion of synth-pop and neo-psychedelia. Explore the shimmering textures of disco-infused rhythms and ethereal soundscapes.',
    'music.buffering': 'Buffering',
    'music.networkError': 'Network error: failed to load audio after multiple retries',
    'about.signalSource': 'Signal Source',
    'about.para1':
      'Every sound starts as noise. XanthanL tunes into the static between genres — synth-pop, disco, neo-psychedelia — and pulls out patterns that feel like memories from a future that never happened.',
    'about.para2':
      'The project is less about a single statement and more about a slow drift: phasing textures, groove-driven basslines, and vocals that hover somewhere between dream and signal loss.',
    'about.para3':
      '"Electric Mirage" is simply the first transmission. A collection of tracks built from old hardware, late nights, and the belief that repetition can become hypnosis if you let it run long enough.',
    'about.quote':
      'The music is a mirage — a fleeting, beautiful glitch in the reality of sound. It\'s about the rhythm that keeps you moving and the dreams that keep you drifting.',
    'about.quoteAuthor': '— XanthanL',
    'about.materializing': 'Materializing',
    'about.signalLocked': 'Signal Locked',
    'about.replay': 'Replay',
    'about.mute': 'Mute',
    'about.unmute': 'Unmute',
    'footer.tagline':
      'XanthanL is a synthetic phantom drifting between sound, image, and code — a solo project born from neon-lit dreams and late-night experiments.',
    'footer.description1':
      'Behind the mask lies a restless creator: the same hands that shape synth-pop mirages have built visual worlds, architectural sketches, travel memories, and digital tools.',
    'footer.description2':
      'Each project is a fragment of the same obsession — capturing fleeting beauty in structured form.',
    'footer.hint': 'Follow the signals. Not everything is meant to be understood.',
    'footer.moreWorks': 'More Works',
    'footer.copyright': '© 2026 XanthanL',
  },
  zh: {
    'nav.music': '音乐',
    'nav.about': '关于',
    'hero.subtitle': '合成器流行 · 新迷幻',
    'hero.cta': '进入',
    'hero.scroll': '滚动',
    'music.title': '音乐',
    'music.albumTitle': 'Electric Mirage',
    'music.albumDesc':
      '浸润在 80 年代迪斯科鼓点与新迷幻质感中的合成器流行。相位效果与空灵感的人声，构成了 XanthanL 的声音签名。',
    'music.albumMeta':
      '合成器流行与新迷幻的催眠融合。探索迪斯科节奏与空灵声景交织而成的闪烁纹理。',
    'music.buffering': '缓冲中',
    'music.networkError': '网络错误：多次重试后仍无法加载音频',
    'about.signalSource': '信号源起',
    'about.para1':
      '每个声音最初都是噪音。XanthanL 调谐于流派之间的静电 —— 合成器流行、迪斯科、新迷幻 —— 从中抽出一些图案，像是来自一个从未发生的未来的记忆。',
    'about.para2':
      '这个项目无关一句宣言，而更像一次缓慢漂流：相位纹理、 groove 驱动的贝斯线，以及徘徊在梦境与信号丢失之间的人声。',
    'about.para3':
      '《Electric Mirage》只是第一次传输。一组由旧硬件、深夜，以及「只要让重复持续得够久，它就能变成催眠」的信念所构成的曲目。',
    'about.quote':
      '音乐是一场海市蜃楼 —— 声音现实中一个短暂而美丽的故障。它关乎让你不断前行的节奏，也关乎让你持续漂浮的梦境。',
    'about.quoteAuthor': '—— XanthanL',
    'about.materializing': '信号具象中',
    'about.signalLocked': '信号已锁定',
    'about.replay': '重播',
    'about.mute': '静音',
    'about.unmute': '取消静音',
    'footer.tagline':
      'XanthanL 是一道穿梭于声音、图像与代码之间的合成幻影 —— 一个诞生于霓虹梦境与深夜实验的个人项目。',
    'footer.description1':
      '面具背后是一个不安分的创造者：塑造合成器流行海市蜃楼的双手，也曾构建视觉世界、建筑草图、旅行记忆与数字工具。',
    'footer.description2':
      '每个项目都是同一种执念的碎片 —— 以结构化的形式捕捉转瞬即逝的美。',
    'footer.hint': '跟随信号。并非所有事物都注定被理解。',
    'footer.moreWorks': '更多作品',
    'footer.copyright': '© 2026 XanthanL',
  },
};

export function translate(language: 'en' | 'zh', key: TranslationKey): string {
  return translations[language][key];
}
