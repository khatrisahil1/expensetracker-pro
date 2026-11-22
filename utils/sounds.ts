// The four notification tones, made with the Web Audio API so the app ships
// no sound files. Settings has offered "Aurora / Bloom / Crystal / Deep" for a
// while, but nothing ever played them.

export const NOTIFICATION_TONES = ['Aurora', 'Bloom', 'Crystal', 'Deep'] as const;
export type NotificationTone = (typeof NOTIFICATION_TONES)[number];

export const TONE_DESCRIPTIONS: Record<NotificationTone, string> = {
  Aurora: 'Soft two-note chime',
  Bloom: 'Bright rising notes',
  Crystal: 'Short glassy ping',
  Deep: 'Low, warm tone',
};

/** One note: frequency in Hz, start offset and length in seconds. */
interface Note { freq: number; at: number; length: number; type?: OscillatorType; gain?: number }

const TONES: Record<NotificationTone, Note[]> = {
  Aurora: [
    { freq: 659.25, at: 0, length: 0.45 },    // E5
    { freq: 987.77, at: 0.14, length: 0.6 },  // B5
  ],
  Bloom: [
    { freq: 523.25, at: 0, length: 0.25 },    // C5
    { freq: 659.25, at: 0.09, length: 0.25 }, // E5
    { freq: 783.99, at: 0.18, length: 0.45 }, // G5
  ],
  Crystal: [
    { freq: 1567.98, at: 0, length: 0.35, gain: 0.18 },             // G6
    { freq: 3135.96, at: 0, length: 0.2, type: 'triangle', gain: 0.05 }, // shimmer
  ],
  Deep: [
    { freq: 196.0, at: 0, length: 0.8, type: 'triangle', gain: 0.35 }, // G3
    { freq: 293.66, at: 0.05, length: 0.7, gain: 0.12 },               // D4
  ],
};

let ctx: AudioContext | null = null;
const audioContext = () => {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
};

/** True for a known tone name; anything else falls back to Aurora. */
export const isTone = (name: unknown): name is NotificationTone => NOTIFICATION_TONES.includes(name as NotificationTone);

/**
 * Play a tone. Browsers only allow sound after the user has interacted with the
 * page, so the first notifications after a reload may stay silent; that's
 * expected and not an error.
 */
export function playTone(name: string | undefined): void {
  try {
    const audio = audioContext();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();
    const tone = TONES[isTone(name) ? name : 'Aurora'];
    const now = audio.currentTime + 0.02;
    for (const note of tone) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = note.type ?? 'sine';
      osc.frequency.value = note.freq;
      const start = now + note.at;
      const peak = note.gain ?? 0.22;
      // Quick attack, smooth exponential release: a bell-like envelope.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.length);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + note.length + 0.05);
    }
  } catch {
    // Audio is a nicety; never let it break the app.
  }
}
