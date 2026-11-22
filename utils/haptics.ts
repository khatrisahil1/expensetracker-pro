// Haptic feedback from the web, as far as browsers allow:
//  - Android (Chrome, Firefox, Samsung): the Vibration API with short patterns.
//  - iPhone (iOS 18+ Safari / installed app): no API, but toggling a native
//    <input type="checkbox" switch> plays the system "tick". We keep one hidden
//    switch and click its label.
//  - Mac trackpads / desktops: browsers expose no haptics, so this does nothing.
// Respects the system "reduce motion" setting (no buzzing for those users).
//
//   haptic('light')   // tiny tick, e.g. crossing a threshold
//   haptic('medium')  // confirm, e.g. release to refresh
//   haptic('success') // done
//   haptic('error')   // something went wrong

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 6,
  light: 10,
  medium: 18,
  heavy: 30,
  success: [12, 40, 18],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

/** How many iOS ticks to play for each kind (each tick needs a separate toggle). */
const IOS_TICKS: Record<HapticKind, number> = { selection: 1, light: 1, medium: 1, heavy: 2, success: 2, warning: 2, error: 3 };

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let iosLabel: HTMLLabelElement | null = null;
/** One hidden native switch; clicking its label makes iOS play a haptic tick. */
const iosSwitch = () => {
  if (iosLabel?.isConnected) return iosLabel;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosLabel = label;
  return label;
};

/** What this device can do. */
export const hapticSupport = (): 'vibrate' | 'ios' | 'none' => {
  if (typeof navigator === 'undefined') return 'none';
  if (typeof navigator.vibrate === 'function' && !isIOS()) return 'vibrate';
  if (isIOS()) return 'ios';
  return 'none';
};

export function haptic(kind: HapticKind = 'light'): void {
  try {
    if (reducedMotion()) return;
    const support = hapticSupport();
    if (support === 'vibrate') { navigator.vibrate(PATTERNS[kind]); return; }
    if (support === 'ios') {
      const label = iosSwitch();
      // Clicking the label focuses the hidden switch, which would blur the field
      // the user is typing in (closing the keyboard). Put focus straight back.
      const tick = () => {
        const active = document.activeElement as HTMLElement | null;
        label.click();
        if (active && active !== document.body && active !== label.firstElementChild) active.focus({ preventScroll: true });
      };
      for (let i = 0; i < IOS_TICKS[kind]; i++) setTimeout(tick, i * 70);
    }
  } catch {
    // Haptics are a nicety; never let them break anything.
  }
}
