// Gemini, through Firebase AI Logic (firebase/ai).
//
// There is no Gemini API key in the app any more. Firebase holds it on its
// side, and the app calls Gemini through Firebase using the project config.
// Works on the free Spark plan. Set up once in the Firebase console:
// AI Logic → Get started → Gemini Developer API.
//
// To stop other sites using the project's AI quota, turn on App Check
// (reCAPTCHA) and set VITE_RECAPTCHA_SITE_KEY; see initAppCheck() below.
//
// createGeminiClient() keeps the shape of the @google/genai client the screens
// were written against: `ai.models.generateContent({ model, contents, config })`
// resolving to `{ text }`. Only the options the app uses are supported:
// a string or { parts } as contents, config.responseMimeType and config.tools.

/** Model used for every AI feature (audit, receipt scan, link lookup). Change it here. */
export const GEMINI_MODEL = 'gemini-3-flash-preview';

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface GenerateRequest {
  model: string;
  contents: string | { parts: Part[] };
  config?: { responseMimeType?: string; tools?: Array<{ googleSearch: Record<string, never> }> };
}

/** Turn the request into firebase/ai's arguments (exported for tests). */
export const toModelArgs = ({ model, contents, config }: GenerateRequest) => ({
  params: {
    model,
    ...(config?.responseMimeType ? { generationConfig: { responseMimeType: config.responseMimeType } } : {}),
    ...(config?.tools?.length ? { tools: config.tools } : {}),
  },
  input: typeof contents === 'string' ? contents : contents.parts,
});

let appCheckStarted = false;
/** App Check, if a reCAPTCHA v3 site key is configured. Safe to call repeatedly. */
async function initAppCheck(app: import('firebase/app').FirebaseApp) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (appCheckStarted || !siteKey) return;
  appCheckStarted = true;
  const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
}

/**
 * A Gemini client backed by Firebase AI Logic.
 * Loaded on first use, so the AI SDK stays out of the startup bundle.
 */
export const createGeminiClient = async () => {
  const [{ getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] = await Promise.all([
    import('firebase/app'),
    import('firebase/ai'),
  ]);
  const app = getApp();
  await initAppCheck(app);
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  return {
    models: {
      async generateContent(request: GenerateRequest): Promise<{ text: string }> {
        const { params, input } = toModelArgs(request);
        const result = await getGenerativeModel(ai, params).generateContent(input);
        return { text: result.response.text() };
      },
    },
  };
};
