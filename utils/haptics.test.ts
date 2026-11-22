import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, hapticSupport } from './haptics';

const setUA = (ua: string, touch = 0) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true });
};
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('haptics', () => {
  it('uses the Vibration API on Android', () => {
    setUA('Mozilla/5.0 (Linux; Android 14) Chrome/130');
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    expect(hapticSupport()).toBe('vibrate');
    haptic('success');
    expect(vibrate).toHaveBeenCalledWith([12, 40, 18]);
  });

  it('toggles a hidden native switch on iPhone', () => {
    vi.useFakeTimers();
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605', 5);
    expect(hapticSupport()).toBe('ios');
    haptic('heavy');
    vi.advanceTimersByTime(200);
    const input = document.querySelector('input[switch]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.checked).toBe(false); // toggled twice
  });

  it('keeps focus in the field being typed in on iPhone', () => {
    vi.useFakeTimers();
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605', 5);
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    haptic('light');
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(field);
  });

  it('does nothing when the user prefers reduced motion', () => {
    setUA('Mozilla/5.0 (Linux; Android 14)');
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    haptic('medium');
    expect(vibrate).not.toHaveBeenCalled();
  });
});
