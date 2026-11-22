// One-time "coach mark": dims the screen except a glowing hole around a target
// element, with a speech bubble next to it. The overlay lets touches through to
// the target itself, so the user can do the thing being taught (e.g. press and
// hold), while the bubble's buttons stay clickable.
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** CSS selector for the element to highlight (first visible match). */
  target: string;
  title: string;
  body: React.ReactNode;
  /** Shown inside the hole: e.g. an animated hand. */
  hint?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  onDismiss: () => void;
}

const PADDING = 10;

/** First match that's actually on screen (not hidden, not parked off-screen like a closed drawer). */
const findVisible = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find(el => {
    if (el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
  }) ?? null;

const Spotlight: React.FC<Props> = ({ target, title, body, hint, primaryLabel, onPrimary, onDismiss }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const update = () => setRect(findVisible(target)?.getBoundingClientRect() ?? null);
    update();
    const id = window.setInterval(update, 300); // follows layout shifts / scrolling
    window.addEventListener('resize', update);
    return () => { window.clearInterval(id); window.removeEventListener('resize', update); };
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  if (!rect) return null;
  const size = Math.max(rect.width, rect.height) + PADDING * 2;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // Bubble below the target if there's room, otherwise above; clamped to the screen.
  const below = cy < window.innerHeight * 0.55;
  const bubbleWidth = Math.min(300, window.innerWidth - 24);
  const bubbleLeft = Math.min(Math.max(12, cx - bubbleWidth / 2), window.innerWidth - bubbleWidth - 12);
  const arrowLeft = Math.min(Math.max(20, cx - bubbleLeft), bubbleWidth - 20);

  return createPortal(
    <div className="fixed inset-0 z-[320] pointer-events-none animate-fade-in" role="dialog" aria-modal="false" aria-labelledby="spotlight-title">
      {/* Dim everything except the hole (a huge box-shadow around a circle) */}
      <div className="absolute rounded-full transition-all duration-300"
        style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size, boxShadow: '0 0 0 9999px rgba(5, 8, 8, 0.78)' }} />
      {/* Glowing, pulsing ring */}
      <div className="absolute rounded-full border-2 border-[#F5C542] animate-[spot-pulse_1.6s_ease-out_infinite]"
        style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size }} />
      {hint && <div className="absolute" style={{ left: cx, top: cy }}>{hint}</div>}

      {/* Bubble */}
      <div className="absolute pointer-events-auto animate-sheet-in" style={{ left: bubbleLeft, width: bubbleWidth, ...(below ? { top: cy + size / 2 + 16 } : { bottom: window.innerHeight - (cy - size / 2) + 16 }) }}>
        <span className="absolute size-4 rotate-45 bg-white dark:bg-[#1b2222]" style={{ left: arrowLeft - 8, ...(below ? { top: -7 } : { bottom: -7 }) }} aria-hidden="true" />
        <div className="relative rounded-3xl bg-white dark:bg-[#1b2222] text-slate-900 dark:text-white p-5 shadow-2xl border border-black/5 dark:border-white/10">
          <h2 id="spotlight-title" className="text-lg font-black">{title}</h2>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{body}</div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onDismiss} className="px-4 py-2 rounded-full text-sm font-bold text-slate-500 hover:bg-black/5 dark:hover:bg-white/5">Skip</button>
            {primaryLabel && onPrimary && (
              <button onClick={onPrimary} className="px-4 py-2 rounded-full text-sm font-black bg-primary text-[#0b2615]">{primaryLabel}</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Spotlight;
