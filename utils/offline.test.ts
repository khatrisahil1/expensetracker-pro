import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleWrite, WRITE_WAIT_MS } from './offline';

const setOnline = (online: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('settleWrite', () => {
  it('waits for the server while online', async () => {
    setOnline(true);
    await expect(settleWrite(Promise.resolve())).resolves.toBe('synced');
  });
  it('surfaces real errors while online (e.g. permissions)', async () => {
    setOnline(true);
    await expect(settleWrite(Promise.reject(new Error('permission-denied')))).rejects.toThrow('permission-denied');
  });
  it('does not wait at all when the device is offline', async () => {
    setOnline(false);
    const never = new Promise(() => {});
    await expect(settleWrite(never)).resolves.toBe('queued');
  });
  it('stops waiting when the server never answers (connection dropped but still "online")', async () => {
    vi.useFakeTimers();
    setOnline(true);
    const result = settleWrite(new Promise(() => {}));
    vi.advanceTimersByTime(WRITE_WAIT_MS);
    await expect(result).resolves.toBe('queued');
  });
  it('a queued write that fails later is logged, not an unhandled rejection', async () => {
    setOnline(false);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail!: (e: Error) => void;
    const write = new Promise((_, reject) => { fail = reject; });
    await settleWrite(write);
    fail(new Error('boom'));
    await new Promise(r => setTimeout(r, 0));
    expect(log).toHaveBeenCalled();
  });
});
