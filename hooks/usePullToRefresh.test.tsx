import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { useRef } from 'react';
import { PULL_THRESHOLD, rubberBand, usePullToRefresh } from './usePullToRefresh';

const Harness: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { pull, phase } = usePullToRefresh(ref, onRefresh);
  return <div ref={ref} data-testid="scroller"><span data-testid="state">{phase}:{Math.round(pull)}</span></div>;
};

const drag = (el: HTMLElement, toY: number) => {
  fireEvent.touchStart(el, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(el, { touches: [{ clientY: toY }] });
};
const state = () => screen.getByTestId('state').textContent!;

afterEach(cleanup);

describe('usePullToRefresh', () => {
  it('rubber-bands: grows with the drag but slows down and never exceeds the max', () => {
    expect(rubberBand(50)).toBeLessThan(50);
    expect(rubberBand(400)).toBeGreaterThan(rubberBand(200));
    expect(rubberBand(5000)).toBeLessThanOrEqual(140);
  });

  it('a short pull shows progress, then springs back without refreshing', async () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');
    act(() => drag(el, 40));
    expect(state()).toMatch(/^pulling:/);
    await act(async () => { fireEvent.touchEnd(el); });
    expect(state()).toBe('settling:0');
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('pulling far enough arms it, and releasing refreshes', async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');
    act(() => drag(el, 400));
    expect(state()).toMatch(/^armed:/);
    expect(Number(state().split(':')[1])).toBeGreaterThanOrEqual(PULL_THRESHOLD);
    await act(async () => { fireEvent.touchEnd(el); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(state()).toMatch(/^refreshing:/);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(state()).toBe('idle:0');
    vi.useRealTimers();
  });

  it('ignores upward drags (normal scrolling)', () => {
    render(<Harness onRefresh={vi.fn()} />);
    const el = screen.getByTestId('scroller');
    act(() => drag(el, -80));
    expect(state()).toBe('idle:0');
  });
});
