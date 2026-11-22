// Pull-to-refresh for a scrolling element.
//  - Touch: pull down while scrolled to the top.
//  - Laptop trackpad / mouse wheel: keep scrolling up (two-finger pull) while
//    already at the top. A gesture only counts if it *starts* at the top, so the
//    momentum of a normal scroll back up can't trigger it by accident.
// The distance has rubber-band resistance, "arms" past PULL_THRESHOLD, and
// releasing while armed runs onRefresh. Haptic ticks mark arming, release and
// completion (see utils/haptics.ts). The caller draws the indicator from
// { pull, phase }.
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '../utils/haptics';

/** settling: sliding back to the top after a release (the content keeps a transform until it lands). */
export type PullPhase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'done' | 'settling';
const SETTLE_MS = 320;

/** Pull distance (px, after resistance) needed to trigger a refresh. */
export const PULL_THRESHOLD = 72;
/** Furthest the content can be pulled. */
const MAX_PULL = 140;
/** Where the indicator rests while refreshing. */
export const PULL_REST = 72;
/** Refresh animation shows at least this long, so it doesn't just blink. */
const MIN_REFRESH_MS = 1300;
/** Wheel gestures: a pause this long ends the gesture (acts as "release"). */
const WHEEL_IDLE_MS = 180;
/** Wheel gestures: a gap this long means a new gesture has started. */
const WHEEL_NEW_GESTURE_MS = 300;
/** Wheel deltas are larger than finger movement; scale them to feel the same. */
const WHEEL_SCALE = 0.6;

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
    // Haptic tick when crossing the threshold either way.
    if (ph === 'armed' && phaseRef.current === 'pulling') haptic('light');
    if (ph === 'pulling' && phaseRef.current === 'armed') haptic('selection');
    pullRef.current = p; phaseRef.current = ph;
    setPull(p); setPhase(ph);
  }, []);

  /** Finger lifted / wheel paused: refresh if armed, otherwise spring back. */
  const release = useCallback(async () => {
    if (phaseRef.current !== 'armed') {
      if (phaseRef.current === 'pulling') {
        set(0, 'settling');
        setTimeout(() => phaseRef.current === 'settling' && set(0, 'idle'), SETTLE_MS);
      }
      return;
    }
    set(PULL_REST, 'refreshing');
    haptic('medium');
    const started = performance.now();
    try { await refreshRef.current(); } catch { /* the caller reports its own errors */ }
    const left = MIN_REFRESH_MS - (performance.now() - started);
    if (left > 0) await new Promise(r => setTimeout(r, left));
    set(PULL_REST, 'done');
    haptic('success');
    await new Promise(r => setTimeout(r, 650));
    set(0, 'settling');
    setTimeout(() => phaseRef.current === 'settling' && set(0, 'idle'), SETTLE_MS);
  }, [set]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    // ---- Touch ----
    const onStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refreshing' || e.touches.length !== 1) return;
      startY.current = el.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null || phaseRef.current === 'refreshing' || phaseRef.current === 'done') return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || el.scrollTop > 0) {
        if (pullRef.current) set(0, 'idle');
        return;
      }
      e.preventDefault(); // stop the page scrolling / the browser's own pull-to-refresh
      const p = rubberBand(dy);
      set(p, p >= PULL_THRESHOLD ? 'armed' : 'pulling');
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      void release();
    };

    // ---- Trackpad / wheel ----
    let wheelDistance = 0;
    let lastWheel = -Infinity;
    let gestureAtTop = false;
    let idleTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom on trackpads
      const now = performance.now();
      if (now - lastWheel > WHEEL_NEW_GESTURE_MS) {
        // New gesture: only pull if it began with the page already at the top.
        gestureAtTop = el.scrollTop <= 0;
        wheelDistance = 0;
      }
      lastWheel = now;
      if (!gestureAtTop || phaseRef.current === 'refreshing' || phaseRef.current === 'done' || phaseRef.current === 'settling') return;
      if (el.scrollTop > 0) { gestureAtTop = false; return; }

      const up = -e.deltaY * (e.deltaMode === 1 ? 16 : 1) * WHEEL_SCALE;
      wheelDistance = Math.max(0, wheelDistance + up);
      if (wheelDistance <= 0) { if (pullRef.current) set(0, 'idle'); return; }
      e.preventDefault();
      const p = rubberBand(wheelDistance);
      set(p, p >= PULL_THRESHOLD ? 'armed' : 'pulling');

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => { wheelDistance = 0; void release(); }, WHEEL_IDLE_MS);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.clearTimeout(idleTimer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [scrollRef, enabled, set, release]);

  /** True while the finger is down: follow it exactly, without transitions. */
  const dragging = phase === 'pulling' || phase === 'armed';
  return { pull, phase, dragging };
}
