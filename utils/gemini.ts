
/** Model used for every AI feature (audit, receipt scan, link lookup). Change it here. */
export const GEMINI_MODEL = 'gemini-3-flash-preview';

/**
 * Create a Gemini client from the API key in the environment.
 *
 * Known issue (scheduled as the last item of the code review): the key is
 * bundled into the browser build, so anyone can read it. It should move behind
 * a server-side proxy such as a Cloud Function.
 *
 * @throws (rejects) if no key is configured.
 */
export const createGeminiClient = async () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ||
                 (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : null);

  if (!apiKey) {
    throw new Error(
      "Gemini API key not found. Please add VITE_GEMINI_API_KEY or GEMINI_API_KEY to your .env file."
    );
  }

  // Loaded on first use: the SDK is large and most sessions never call it,
  // so it stays out of the startup bundle.
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey });
};
