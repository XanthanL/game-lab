const magicBolt = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="mb-orb" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#fff6c8"/>
      <stop offset="50%" stop-color="#ffd23f"/>
      <stop offset="100%" stop-color="#ff8c00"/>
    </radialGradient>
    <linearGradient id="mb-bolt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#5b21b6"/>
    </linearGradient>
  </defs>
  <circle cx="24" cy="24" r="17" fill="url(#mb-orb)" stroke="#fff8dc" stroke-width="1.5"/>
  <path d="M26.5 12 L17.5 26.5 L23.5 26.5 L21 36.5 L31.5 21 L25 21 Z" fill="url(#mb-bolt)"/>
</svg>`;

const hp = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hp-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff6b81"/>
      <stop offset="100%" stop-color="#c9184a"/>
    </linearGradient>
  </defs>
  <path d="M24 40 C 14 32, 7 25, 7 17 C 7 11, 12 7, 17 7 C 20.5 7, 22.8 8.5, 24 11 C 25.2 8.5, 27.5 7, 31 7 C 36 7, 41 11, 41 17 C 41 25, 34 32, 24 40 Z" fill="url(#hp-g)" stroke="#7f1d3a" stroke-width="1.5"/>
</svg>`;

const speed = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sp-g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffd23f"/>
      <stop offset="100%" stop-color="#ff7a1a"/>
    </linearGradient>
  </defs>
  <path d="M10 14 L26 24 L10 34 Z" fill="url(#sp-g)" opacity="0.7"/>
  <path d="M22 14 L38 24 L22 34 Z" fill="url(#sp-g)"/>
</svg>`;

const damage = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dm-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff8a8a"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke-linecap="round">
    <path d="M10 10 L38 38" stroke="url(#dm-g)" stroke-width="6"/>
    <path d="M38 10 L10 38" stroke="url(#dm-g)" stroke-width="6"/>
    <path d="M10 10 L16 16" stroke="#fff" stroke-width="3"/>
    <path d="M38 10 L32 16" stroke="#fff" stroke-width="3"/>
  </g>
</svg>`;

const armor = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ar-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <path d="M24 5 L40 11 V23 C40 33, 33 40, 24 44 C15 40, 8 33, 8 23 V11 Z" fill="url(#ar-g)" stroke="#0c4a6e" stroke-width="1.5"/>
  <path d="M24 11 L33 14.5 V23 C33 29.5, 29 34.5, 24 37 C19 34.5, 15 29.5, 15 23 V14.5 Z" fill="#0c4a6e" opacity="0.25"/>
</svg>`;

const magnet = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mg-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke-linecap="round">
    <path d="M14 10 V28 C14 33.5, 18.5 38, 24 38 C29.5 38, 34 33.5, 34 28 V10" stroke="url(#mg-g)" stroke-width="6"/>
  </g>
  <rect x="6" y="6" width="17" height="8" rx="3" fill="url(#mg-g)"/>
  <rect x="25" y="6" width="17" height="8" rx="3" fill="url(#mg-g)"/>
  <path d="M19.5 12 V19" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M28.5 12 V19" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const haste = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hs-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#67e8f9"/>
      <stop offset="100%" stop-color="#0891b2"/>
    </linearGradient>
  </defs>
  <circle cx="24" cy="24" r="17" fill="#164e63" stroke="url(#hs-g)" stroke-width="3"/>
  <path d="M24 12.5 V24 L31.5 28" stroke="#67e8f9" stroke-width="3" stroke-linecap="round" fill="none"/>
  <circle cx="24" cy="24" r="2.5" fill="#67e8f9"/>
</svg>`;

const soulBlade = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sb-blade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#7dd3fc"/>
    </linearGradient>
    <linearGradient id="sb-hilt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <g transform="rotate(45 24 24)">
    <path d="M22.5 4 L27 8.5 L23 12.5 L18.5 8 Z" fill="url(#sb-blade)"/>
    <path d="M21 14 L27 14 L24.5 30 Z" fill="url(#sb-blade)" stroke="#0ea5e9" stroke-width="0.5"/>
    <rect x="19.5" y="30" width="9" height="3.5" rx="1.5" fill="#fbbf24"/>
    <rect x="23.2" y="33.5" width="1.6" height="8" rx="0.8" fill="url(#sb-hilt)"/>
  </g>
</svg>`;

const holyWater = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hw-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c4b5fd"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="hw-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e9d5ff"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <path d="M20 6 H28 V14 L33 20 V38 C33 42 29 44 24 44 C19 44 15 42 15 38 V20 L20 14 Z" fill="url(#hw-glass)" stroke="#5b21b6" stroke-width="1.5"/>
  <path d="M18 20 L30 20 L28 30 L20 30 Z" fill="url(#hw-g)" opacity="0.9"/>
  <circle cx="24" cy="34" r="3.5" fill="#ede9fe" opacity="0.8"/>
</svg>`;

const lightning = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lt-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff7d6"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
  </defs>
  <path d="M27 4 L14 26 L23 26 L19 44 L35 19 L25 19 Z" fill="url(#lt-g)" stroke="#d97706" stroke-width="1.5"/>
</svg>`;

const whip = `
<svg viewBox="0 0 48 48" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wp-g" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="#fca5a5"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <rect x="9" y="32" width="6" height="13" rx="2.5" fill="#7f1d1d" transform="rotate(-14 12 38)"/>
  <path d="M14 30 C 16 22, 24 16, 38 10" fill="none" stroke="url(#wp-g)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M38 4.5 L43 13 L36 9 Z" fill="#dc2626"/>
</svg>`;

export const ICONS: Record<string, string> = {
  magicBolt,
  soulBlade,
  holyWater,
  lightning,
  whip,
  hp,
  speed,
  damage,
  armor,
  magnet,
  haste,
};
