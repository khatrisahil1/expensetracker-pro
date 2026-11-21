/**
 * Parse a JSON object from model output. Accepts plain JSON, or JSON wrapped in
 * extra text or ``` fences (the outermost { ... } is used). Returns null when
 * no object can be parsed.
 */
export function extractJsonObject<T = unknown>(text: string | null | undefined): T | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first < 0 || last <= first) return null;
    try {
      return JSON.parse(trimmed.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
}
