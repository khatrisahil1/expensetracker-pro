import { GoogleGenAI } from "@google/genai";

const STORAGE_KEY = "EXPENSE_TRACKER_GEMINI_KEY";

export const getGeminiApiKey = (): string | null => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }

  // Vite exposes env vars through define() in vite.config.ts.
  // The project defaults to reading GEMINI_API_KEY from .env.local.
  const envKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY) as string | undefined;
  if (envKey) return envKey;

  return null;
};

export const setGeminiApiKey = (key: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, key);
  }
};

export const clearGeminiApiKey = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const createGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key not found. Add it to .env.local as GEMINI_API_KEY or enter it in Settings."
    );
  }

  return new GoogleGenAI({ apiKey });
};
