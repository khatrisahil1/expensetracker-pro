import { useCallback, useRef, useState } from 'react';
import { useStore } from '../context/Store';
import { downloadFile } from '../utils/csv';
import { extractJsonObject } from '../utils/json';

/** Shape the Gemini audit prompt (Store.generateFinancialAudit) asks for. Every field is optional because the model may leave some out. */
export interface FinancialInsight {
  summary?: string;
  status?: { label?: string; emoji?: string; message?: string };
  visual?: { type?: string; headline?: string };
  metrics?: Record<string, number | string>;
  insights?: { emoji?: string; title?: string; message?: string }[];
  actions?: { emoji?: string; text?: string }[];
  tone?: { vibe?: string; one_liner?: string };
}

/** How long a "Copied" / "Copy failed" notice stays visible. */
const NOTICE_MS = 3000;

/**
 * Runs the AI financial audit and keeps its result. Used by the Dashboard and
 * Budget screens, which previously each had their own copy of this logic.
 */
export const useFinancialInsight = () => {
  const { generateFinancialAudit } = useStore();
  /** The model's raw text, shown when it isn't valid JSON. */
  const [raw, setRaw] = useState<string | null>(null);
  /** The parsed result, or null when the response couldn't be parsed. */
  const [json, setJson] = useState<FinancialInsight | null>(null);
  const [loading, setLoading] = useState(false);
  /** Set when the request itself failed. */
  const [error, setError] = useState<string | null>(null);
  /** Short-lived status line: parse problems, copy results. */
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flashNotice = (message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  /** Clear any previous result. */
  const reset = useCallback(() => {
    setRaw(null);
    setJson(null);
    setError(null);
    setNotice(null);
  }, []);

  /** Request a new audit. */
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await generateFinancialAudit();
      setRaw(response);
      const parsed = extractJsonObject<FinancialInsight>(response);
      setJson(parsed);
      if (!parsed && response) setNotice('Could not parse JSON output; showing raw response.');
    } catch {
      setError('Unable to reach Gemini AI.');
      setJson(null);
    } finally {
      setLoading(false);
    }
  }, [generateFinancialAudit]);

  const copyJson = async () => {
    if (!json) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      flashNotice('Copied insight JSON to clipboard.');
    } catch {
      flashNotice('Clipboard copy failed.');
    }
  };

  const exportJson = () => {
    if (json) downloadFile(JSON.stringify(json, null, 2), 'insight.json', 'application/json');
  };

  return { raw, json, loading, error, notice, run, reset, copyJson, exportJson };
};
