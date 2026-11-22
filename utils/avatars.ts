// Built-in profile pictures, drawn as small SVGs in code (no image files, no
// licence questions, ~1 KB each). Stored on the account as a data URL, so every
// <img src={avatar}> in the app shows them like an uploaded photo.
//
// Three sets ("feminine", "masculine", "neutral"). The picker shows the set that
// matches the user's gender setting first, but every avatar is available to
// everyone. To add your own artwork later (e.g. a purchased pack), put the files
// in /public/avatars and add entries to EXTRA_AVATARS below.

export type AvatarStyle = 'feminine' | 'masculine' | 'neutral';

export interface AvatarPreset {
  id: string;
  style: AvatarStyle;
  label: string;
  /** Image URL (data: URL for the built-in ones). */
  src: string;
}

interface Look {
  id: string; style: AvatarStyle; label: string;
  bg: string; skin: string; hair: string; shirt: string;
  hairStyle: 'bun' | 'long' | 'bob' | 'ponytail' | 'short' | 'spiky' | 'curly' | 'beard' | 'beanie' | 'afro' | 'buzz' | 'cap';
  extra?: 'glasses' | 'freckles' | 'earrings';
}

const LOOKS: Look[] = [
  { id: 'f1', style: 'feminine', label: 'Bun', bg: '#FDE2E4', skin: '#F6C9A8', hair: '#3B2A20', shirt: '#F472B6', hairStyle: 'bun', extra: 'earrings' },
  { id: 'f2', style: 'feminine', label: 'Long hair', bg: '#E0E7FF', skin: '#E8B48F', hair: '#7C3A1D', shirt: '#818CF8', hairStyle: 'long' },
  { id: 'f3', style: 'feminine', label: 'Bob', bg: '#DCFCE7', skin: '#C68B5E', hair: '#1F1A17', shirt: '#2ECC71', hairStyle: 'bob', extra: 'glasses' },
  { id: 'f4', style: 'feminine', label: 'Ponytail', bg: '#FEF3C7', skin: '#FAD7BD', hair: '#D97706', shirt: '#FB923C', hairStyle: 'ponytail', extra: 'freckles' },
  { id: 'm1', style: 'masculine', label: 'Short hair', bg: '#DBEAFE', skin: '#F2C6A0', hair: '#2B1D14', shirt: '#3B82F6', hairStyle: 'short' },
  { id: 'm2', style: 'masculine', label: 'Spiky', bg: '#FCE7F3', skin: '#D9A07A', hair: '#111827', shirt: '#EC4899', hairStyle: 'spiky', extra: 'glasses' },
  { id: 'm3', style: 'masculine', label: 'Curly', bg: '#ECFCCB', skin: '#A86B45', hair: '#1C1410', shirt: '#65A30D', hairStyle: 'curly' },
  { id: 'm4', style: 'masculine', label: 'Beard', bg: '#FFEDD5', skin: '#EDBB94', hair: '#5B3A24', shirt: '#F97316', hairStyle: 'beard' },
  { id: 'n1', style: 'neutral', label: 'Beanie', bg: '#CCFBF1', skin: '#F0C29C', hair: '#4B3621', shirt: '#14B8A6', hairStyle: 'beanie' },
  { id: 'n2', style: 'neutral', label: 'Afro', bg: '#EDE9FE', skin: '#8D5A3B', hair: '#16100C', shirt: '#8B5CF6', hairStyle: 'afro', extra: 'freckles' },
  { id: 'n3', style: 'neutral', label: 'Buzz cut', bg: '#FEE2E2', skin: '#E3A982', hair: '#3F2E22', shirt: '#EF4444', hairStyle: 'buzz', extra: 'earrings' },
  { id: 'n4', style: 'neutral', label: 'Cap', bg: '#E0F2FE', skin: '#F7D0B1', hair: '#6B4226', shirt: '#0EA5E9', hairStyle: 'cap', extra: 'glasses' },
];

/** Hair drawn behind the head. */
const hairBack = (l: Look) => {
  switch (l.hairStyle) {
    case 'long': return `<path d="M26 56c0-22 12-34 34-34s34 12 34 34v34H26z" fill="${l.hair}"/>`;
    case 'bob': return `<path d="M28 58c0-21 12-33 32-33s32 12 32 33v14c0 6-5 9-10 9H38c-5 0-10-3-10-9z" fill="${l.hair}"/>`;
    case 'ponytail': return `<path d="M88 46c12 4 16 18 10 34-3-10-8-16-14-18z" fill="${l.hair}"/>`;
    case 'bun': return `<circle cx="60" cy="18" r="11" fill="${l.hair}"/>`;
    case 'afro': return `<circle cx="60" cy="46" r="34" fill="${l.hair}"/>`;
    case 'curly': return `<g fill="${l.hair}">${[30, 40, 52, 64, 76, 88].map((x, i) => `<circle cx="${x}" cy="${36 - (i % 2) * 6}" r="10"/>`).join('')}</g>`;
    default: return '';
  }
};

/** Hair / headwear drawn on top of the head. */
const hairFront = (l: Look) => {
  switch (l.hairStyle) {
    case 'short': case 'beard': return `<path d="M34 50c0-16 11-26 26-26s26 10 26 26c-6-8-16-11-26-11s-20 3-26 11z" fill="${l.hair}"/>`;
    case 'spiky': return `<path d="M33 50l4-18 7 8 5-14 7 10 6-13 6 13 6-9 4 13 6-6 1 16c-7-6-16-9-26-9s-19 3-26 9z" fill="${l.hair}"/>`;
    case 'buzz': return `<path d="M35 48c0-14 11-23 25-23s25 9 25 23c-7-6-15-8-25-8s-18 2-25 8z" fill="${l.hair}" opacity=".85"/>`;
    case 'long': case 'bob': case 'ponytail': case 'bun':
      return `<path d="M33 52c1-17 12-27 27-27s26 10 27 27c-9-2-17-8-21-15-6 9-19 14-33 15z" fill="${l.hair}"/>`;
    case 'beanie': return `<path d="M32 48c0-17 12-28 28-28s28 11 28 28z" fill="${l.shirt}"/><rect x="30" y="44" width="60" height="9" rx="4.5" fill="#fff" opacity=".9"/><circle cx="60" cy="18" r="6" fill="#fff"/>`;
    case 'cap': return `<path d="M33 49c0-16 12-27 27-27s27 11 27 27z" fill="${l.shirt}"/><path d="M58 47h40c3 0 3 5 0 6H58z" fill="${l.shirt}"/><path d="M33 49c0-16 12-27 27-27" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/>`;
    case 'curly': return `<g fill="${l.hair}">${[38, 50, 62, 74, 84].map(x => `<circle cx="${x}" cy="38" r="8"/>`).join('')}</g>`;
    case 'afro': return '';
    default: return '';
  }
};

const extras = (l: Look) => {
  const parts: string[] = [];
  if (l.hairStyle === 'beard') parts.push(`<path d="M42 66c2 14 9 20 18 20s16-6 18-20c-4 5-10 7-18 7s-14-2-18-7z" fill="${l.hair}"/>`);
  if (l.extra === 'glasses') parts.push('<g fill="none" stroke="#1f2937" stroke-width="2.5"><circle cx="49" cy="58" r="7"/><circle cx="71" cy="58" r="7"/><path d="M56 58h8"/></g>');
  if (l.extra === 'freckles') parts.push('<g fill="#b45309" opacity=".45"><circle cx="45" cy="66" r="1.2"/><circle cx="49" cy="68" r="1.2"/><circle cx="71" cy="68" r="1.2"/><circle cx="75" cy="66" r="1.2"/></g>');
  if (l.extra === 'earrings') parts.push('<g fill="#f5c542"><circle cx="34" cy="70" r="3"/><circle cx="86" cy="70" r="3"/></g>');
  return parts.join('');
};

/** SVG markup for one look: background, shoulders, head, face, hair. */
const svgFor = (l: Look) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" fill="${l.bg}"/>
${hairBack(l)}
<path d="M22 120c2-20 17-30 38-30s36 10 38 30z" fill="${l.shirt}"/>
<rect x="52" y="78" width="16" height="14" rx="6" fill="${l.skin}"/>
<ellipse cx="60" cy="58" rx="26" ry="28" fill="${l.skin}"/>
<ellipse cx="34" cy="60" rx="4" ry="6" fill="${l.skin}"/><ellipse cx="86" cy="60" rx="4" ry="6" fill="${l.skin}"/>
<g fill="#1f2937"><ellipse cx="49" cy="58" rx="3" ry="3.6"/><ellipse cx="71" cy="58" rx="3" ry="3.6"/></g>
<g fill="#fff"><circle cx="50" cy="56.6" r="1"/><circle cx="72" cy="56.6" r="1"/></g>
<g fill="#fb7185" opacity=".35"><ellipse cx="43" cy="67" rx="5" ry="3"/><ellipse cx="77" cy="67" rx="5" ry="3"/></g>
<path d="M53 70c3 4 11 4 14 0" stroke="#1f2937" stroke-width="2.5" fill="none" stroke-linecap="round"/>
${extras(l)}
${hairFront(l)}
</svg>`;

const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n/g, ''))}`;

/** Add files from /public/avatars here, e.g. { id: 'tf1', style: 'neutral', label: 'Toy face 1', src: '/avatars/tf1.png' }. */
const EXTRA_AVATARS: AvatarPreset[] = [];

export const AVATAR_PRESETS: AvatarPreset[] = [
  ...LOOKS.map(l => ({ id: l.id, style: l.style, label: l.label, src: toDataUrl(svgFor(l)) })),
  ...EXTRA_AVATARS,
];

/** Which set to show first for a gender answer from onboarding/profile. */
export const styleForGender = (gender?: string): AvatarStyle =>
  gender === 'Female' ? 'feminine' : gender === 'Male' ? 'masculine' : 'neutral';

/** Presets with the matching set first. */
export const presetsFor = (gender?: string): AvatarPreset[] => {
  const first = styleForGender(gender);
  return [...AVATAR_PRESETS].sort((a, b) => Number(b.style === first) - Number(a.style === first));
};

/** True if an avatar value is one of the built-in pictures. */
export const isPresetAvatar = (src?: string) => !!src && AVATAR_PRESETS.some(p => p.src === src);
