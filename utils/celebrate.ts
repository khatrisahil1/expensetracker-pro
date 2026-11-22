// Small celebratory bursts for moments worth a smile: saving a transaction,
// adding money to a goal, resisting an impulse buy, finishing a tidy-up.
// Particles are plain DOM nodes animated with the Web Animations API and removed
// when done, so there's no library and nothing left behind. Skipped entirely
// when the user prefers reduced motion.
//
//   celebrate()                    // confetti from wherever the user last tapped
//   celebrate(null, 'coins')       // coins (money added)
//   celebrate(element, 'hearts')   // hearts from an element (a good choice)

export type CelebrationKind = 'confetti' | 'coins' | 'hearts';

const COLORS = ['#2ECC71', '#38bdf8', '#f5c542', '#f472b6', '#a78bfa', '#fb923c'];
const GLYPHS: Record<Exclude<CelebrationKind, 'confetti'>, string[]> = {
  coins: ['🪙', '💰', '✨'],
  hearts: ['💚', '✨', '💖'],
};

/** Where the user last tapped or clicked; the default origin for a burst. */
let lastPointer: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Burst particles from the centre of `origin` (an element) or from a point. */
export function celebrate(origin?: Element | { x: number; y: number } | null, kind: CelebrationKind = 'confetti', count = 18): void {
  if (typeof document === 'undefined' || reducedMotion() || typeof Element.prototype.animate !== 'function') return;
  origin ??= lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const point = 'getBoundingClientRect' in origin
    ? (() => { const r = origin.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()
    : origin;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:400;overflow:hidden';
  document.body.appendChild(layer);

  const animations: Animation[] = [];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const distance = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40; // bias upwards, then gravity pulls down
    const spin = (Math.random() - 0.5) * 720;

    if (kind === 'confetti') {
      const w = 6 + Math.random() * 5;
      p.style.cssText = `position:absolute;left:${point.x}px;top:${point.y}px;width:${w}px;height:${w * (Math.random() > 0.5 ? 1 : 0.45)}px;`
        + `background:${COLORS[i % COLORS.length]};border-radius:${Math.random() > 0.6 ? '999px' : '2px'};`;
    } else {
      const glyphs = GLYPHS[kind];
      p.textContent = glyphs[i % glyphs.length];
      p.style.cssText = `position:absolute;left:${point.x}px;top:${point.y}px;font-size:${14 + Math.random() * 10}px;line-height:1;`;
    }
    layer.appendChild(p);

    animations.push(p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8}px)) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 70}px)) scale(0.9) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    ));
  }

  Promise.all(animations.map(a => a.finished)).finally(() => layer.remove());
}
