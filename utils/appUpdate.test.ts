import { describe, it, expect } from 'vitest';
import { updateAction, EARLY_RELOAD_MS } from './appUpdate';

describe('updateAction', () => {
  it('reloads straight away right after start', () => {
    expect(updateAction(1000, false)).toBe('reload');
  });
  it('reloads straight away when the app is in the background', () => {
    expect(updateAction(EARLY_RELOAD_MS * 10, true)).toBe('reload');
  });
  it('waits for the background while someone is using the app', () => {
    expect(updateAction(EARLY_RELOAD_MS + 1, false)).toBe('when-hidden');
  });
});
