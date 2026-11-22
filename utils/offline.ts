// Offline-friendly Firestore writes. Used by every data write in context/Store.tsx.
/**
 * Firestore resolves a write only when the server confirms it. With the network
 * gone that never happens, so every "Saving…" spinner waited for ever. The
 * write is already in the offline cache (persistentLocalCache) and the listeners
 * show it at once; it syncs when the connection returns. So: wait for the
 * server while online (to surface real errors such as permissions), but stop
 * waiting when offline or after a few seconds of no answer.
 * Returns 'synced' or 'queued' (saved on this device, not yet on the server).
 */
export const WRITE_WAIT_MS = 4000;
export async function settleWrite(write: Promise<unknown>): Promise<'synced' | 'queued'> {
  // A queued write that later fails must not become an unhandled rejection.
  write.catch(err => console.error('Firestore write failed', err));
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'queued';
  return Promise.race([
    write.then(() => 'synced' as const),
    new Promise<'queued'>(resolve => setTimeout(() => resolve('queued'), WRITE_WAIT_MS)),
  ]);
}

