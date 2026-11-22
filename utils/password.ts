// Password strength for the sign-up form: a 0–4 score with a label and hint.
// Firebase only requires 6 characters; this nudges people towards better ones.

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Okay' | 'Good' | 'Strong';
  /** One short suggestion for doing better, or '' when it's strong. */
  hint: string;
}

export function passwordStrength(pw: string): PasswordStrength {
  if (pw.length < 6) return { score: 0, label: 'Too short', hint: 'Use at least 6 characters.' };
  const checks = {
    length: pw.length >= 10,
    cases: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.max(1, Math.min(4, passed + (pw.length >= 14 ? 1 : 0))) as PasswordStrength['score'];
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'] as const;
  const hint = !checks.length ? 'Longer is stronger: try 10+ characters.'
    : !checks.digit ? 'Add a number.'
    : !checks.cases ? 'Mix upper and lower case.'
    : !checks.symbol ? 'Add a symbol like ! or #.'
    : '';
  return { score, label: labels[score], hint: score === 4 ? '' : hint };
}
