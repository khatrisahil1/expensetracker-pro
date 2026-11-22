// Pull-to-refresh for a scrolling element (touch screens). Pull down while the
// element is scrolled to the top: the distance follows the finger with rubber-
// band resistance, "arms" past THRESHOLD, and releasing while armed runs
// onRefresh. The caller draws the indicator from { pull, phase }.
import { useCallback, useEffect, useRef, useState } from 'react';

/** settling: sliding back to the top after a release (the content keeps a transform until it lands). */
export type PullPhase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'done' | 'settling';
const SETTLE_MS = 320;

/** Pull distance (px, after resistance) needed to trigger a refresh. */
export const PULL_THRESHOLD = 72;
/** Furthest the content can be pulled. */
const MAX_PULL = 140;
/** Where the indicator rests while refreshing. */
export const PULL_REST = 64;
/** Refresh spinner shows at least this long, so it doesn't just blink. */
const MIN_REFRESH_MS = 900;

/** Rubber band: easy at first, harder the further you pull. */
export const rubberBand = (dy: number) => MAX_PULL * (1 - Math.exp(-dy / 220));

export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown> | unknown,
  enabled = true,
) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<PullPhase>('idle');
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const phaseRef = useRef<PullPhase>('idle');
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const set = useCallback((p: number, ph: PullPhase) => {
    pullRef.current = p; phaseRef.current = ph;
    setPull(p); setPhase(ph);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refreshing' || e.touches.length !== 1) return;
      // Only when already at the very top, so normal scrolling is untouched.
      startY.current = el.scrollTop <= 0 ? e.touches[0].clientY : null;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || phaseRef.current === 'refreshing') return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || el.scrollTop > 0) {
        if (pullRef.current) set(0, 'idle');
        return;
      }
      e.preventDefault(); // stop the page scrolling / the browser's own pull-to-refresh
      const p = rubberBand(dy);
      set(p, p >= PULL_THRESHOLD ? 'armed' : 'pulling');
    };

    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (phaseRef.current !== 'armed') {
        set(0, 'settling');
        setTimeout(() => phaseRef.current === 'settling' && set(0, 'idle'), SETTLE_MS);
        return;
      }
      set(PULL_REST, 'refreshing');
      if (navigator.vibrate) navigator.vibrate(12);
      const started = performance.now();
      try { await refreshRef.current(); } catch { /* the caller reports its own errors */ }
      const left = MIN_REFRESH_MS - (performance.now() - started);
      if (left > 0) await new Promise(r => setTimeout(r, left));
      set(PULL_REST, 'done');
      await new Promise(r => setTimeout(r, 450));
      set(0, 'settling');
      setTimeout(() => phaseRef.current === 'settling' && set(0, 'idle'), SETTLE_MS);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [scrollRef, enabled, set]);

  /** True while the finger is down: follow it exactly, without transitions. */
  const dragging = phase === 'pulling' || phase === 'armed';
  return { pull, phase, dragging };
}
