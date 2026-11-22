// Press-and-hold gesture with progress. While held, `progress` goes 0 → 1 over
// `ms`; reaching 1 fires onLongPress (with a small vibration). Letting go early
// cancels. A normal short tap still fires onTap, and a completed long press
// suppresses the click that follows it.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLongPress(onLongPress: () => void, { ms = 600, onTap }: { ms?: number; onTap?: () => void } = {}) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const start = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    start.current = null;
    setProgress(0);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const tick = useCallback((now: number) => {
    if (start.current === null) return;
    const p = Math.min(1, (now - start.current) / ms);
    setProgress(p);
    if (p >= 1) {
      fired.current = true;
      if (navigator.vibrate) navigator.vibrate(18);
      stop();
      onLongPress();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  }, [ms, onLongPress, stop]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      start.current = performance.now();
      frame.current = requestAnimationFrame(tick);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // Moving more than a few pixels is a scroll or drag, not a hold.
      if (start.current !== null && origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: (e: React.MouseEvent) => {
      if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; return; }
      onTap?.();
    },
    // Stop the long-press context menu / image save sheet on phones.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { progress, handlers };
}
