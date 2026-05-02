import { GoogleGenAI } from "@google/genai";

export const createGeminiClient = () => {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || 
                 (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : null);
  
  if (!apiKey) {
    throw new Error(
      "Gemini API key not found. Please add VITE_GEMINI_API_KEY or GEMINI_API_KEY to your .env file."
    );
  }

  return new GoogleGenAI({ apiKey });
};
