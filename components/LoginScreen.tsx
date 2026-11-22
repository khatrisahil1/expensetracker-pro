// Sign-in / sign-up page (/login): a premium, interactive welcome.
//  - The piggy mascot (PiggyCharacter) watches the cursor, reads along as you
//    type your email, covers its eyes while you type a password (peeks if you
//    show it), smiles at a valid email and looks sad on errors.
//  - Wide screens: hero with parallax cards that drift with the cursor, and a
//    form card that tilts slightly in 3D. Phones: piggy on top, form below.
//  - Sign in is one screen. Create account is a 3-step flow (email → password
//    → name) with progress, so each step has one clear job.
//  - Haptics (utils/haptics.ts) on tab switches, steps, errors and success;
//    confetti on success.
// Routing back to the requested page is handled in router/AppRoutes.tsx.
//
// Removed earlier: "Remember me" (did nothing), "Continue with Phone" (not
// implemented) and the "256-bit encryption" claim.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, SocialProvider } from '../context/Store';
import { STORAGE_KEYS } from '../constants/app';
import { passwordStrength } from '../utils/password';
import { celebrate } from '../utils/celebrate';
import { haptic } from '../utils/haptics';
import PiggyCharacter, { type PiggyMood } from './PiggyCharacter';

type Mode = 'signin' | 'signup';
type SignupStep = 0 | 1 | 2;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Friendly text for Firebase auth error codes. */
const authMessage = (code?: string, fallback = 'Something went wrong. Please try again.') => {
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'That email and password don’t match.';
    case 'auth/email-already-in-use': return 'There’s already an account with this email. Try signing in.';
    case 'auth/weak-password': return 'Use at least 6 characters for your password.';
    case 'auth/invalid-email': return 'That doesn’t look like an email address.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed': return 'No connection. Check your internet and try again.';
    case 'auth/popup-blocked': return 'The sign-in window was blocked. Allow pop-ups and try again.';
    case 'auth/unauthorized-domain': return 'This address isn’t allowed for this sign-in method yet.';
    default: return fallback;
  }
};

interface FieldProps {
  id: string; label: string; icon: string; type?: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; trailing?: React.ReactNode; autoFocus?: boolean; valid?: boolean;
  onFocus?: () => void; onBlur?: () => void; inputRef?: React.Ref<HTMLInputElement>;
}

/** Floating-label input with a glowing focus ring and an optional "valid" tick. */
const Field: React.FC<FieldProps> = ({ id, label, icon, type = 'text', value, onChange, autoComplete, trailing, autoFocus, valid, onFocus, onBlur, inputRef }) => {
  // Fields that auto-focus (each sign-up step) report it, so the piggy reacts
  // straight away: React's autoFocus doesn't always deliver a focus event.
  const own = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!autoFocus) return;
    own.current?.focus({ preventScroll: true });
    onFocus?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setRef = (el: HTMLInputElement | null) => {
    own.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };
  return (
  <div className="relative group rounded-2xl p-[1.5px] bg-transparent focus-within:bg-gradient-to-r focus-within:from-primary focus-within:via-emerald-300 focus-within:to-sky-400 transition-all">
    <div className="relative rounded-[14.5px] bg-slate-100 dark:bg-[#151b1b] group-focus-within:bg-white dark:group-focus-within:bg-[#111717] transition-colors">
      <span aria-hidden="true" className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none">{icon}</span>
      <input id={id} ref={setRef} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder=" " autoComplete={autoComplete}
        onFocus={onFocus} onBlur={onBlur}
        className="peer w-full h-14 rounded-[14.5px] pl-12 pr-12 pt-4 text-[15px] font-semibold bg-transparent text-slate-900 dark:text-white border-0 outline-none focus:ring-0" />
      <label htmlFor={id}
        className="absolute left-12 top-1/2 -translate-y-1/2 text-[15px] text-slate-400 pointer-events-none transition-all duration-200
          peer-focus:top-4 peer-focus:text-[11px] peer-focus:font-bold peer-focus:text-primary
          peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-bold">
        {label}
      </label>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {valid && <span className="size-6 rounded-full bg-primary text-[#0b2615] flex items-center justify-center animate-pop"><span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span></span>}
        {trailing}
      </span>
    </div>
  </div>
  );
};

const STRENGTH_COLORS = ['bg-slate-300', 'bg-rose-500', 'bg-amber-500', 'bg-lime-500', 'bg-primary'];

const ICONS = {
  google: <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.4 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>,
  github: <svg className="size-5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>,
  apple: <svg className="size-5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.63-3.12 1.88-2.6 5.75.35 7.1-.93 1.98-2.13 3.32-2.4 4.28zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>,
  facebook: <svg className="size-5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.07C24 5.4 18.6 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>,
};

const Spinner: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <span className={`size-5 rounded-full border-[3px] animate-spin ${dark ? 'border-[#0b2615]/30 border-t-[#0b2615]' : 'border-slate-300 border-t-slate-700'}`} />
);

const LoginScreen: React.FC = () => {
  const { login, signup, googleLogin, loginWithProvider, enableDemo, resetPassword } = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<SignupStep>(0);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);
  const [success, setSuccess] = useState(false);

  // Piggy state
  const [focus, setFocus] = useState<'email' | 'password' | 'name' | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [sad, setSad] = useState(false);
  const piggyRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Theme (the account's theme takes over after sign-in).
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const emailValid = EMAIL_RE.test(email.trim());
  const strength = passwordStrength(password);
  const signingUp = mode === 'signup';

  /** Point the piggy's eyes at a screen point. */
  const lookAt = useCallback((x: number, y: number) => {
    const box = piggyRef.current?.getBoundingClientRect();
    if (!box) return;
    const cx = box.left + box.width * 0.72; // the eye sits on the right of the drawing
    const cy = box.top + box.height * 0.45;
    setLook({ x: Math.max(-1, Math.min(1, (x - cx) / 300)), y: Math.max(-1, Math.min(1, (y - cy) / 300)) });
  }, []);

  // Eyes follow the cursor, and the hero cards / form card react to it (desktop).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (focus !== 'email') lookAt(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      heroRef.current?.style.setProperty('--px', String(nx));
      heroRef.current?.style.setProperty('--py', String(ny));
      cardRef.current?.style.setProperty('--tilt-x', `${(-ny * 4).toFixed(2)}deg`);
      cardRef.current?.style.setProperty('--tilt-y', `${(nx * 5).toFixed(2)}deg`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [focus, lookAt]);

  // While typing an email, the piggy "reads along" the text.
  useEffect(() => {
    if (focus !== 'email' || !emailRef.current) return;
    const r = emailRef.current.getBoundingClientRect();
    lookAt(r.left + 48 + Math.min(email.length * 8, r.width - 60), r.top + r.height / 2);
  }, [focus, email, lookAt]);

  const mood: PiggyMood =
    success ? 'happy'
    : sad ? 'sad'
    : focus === 'password' ? (showPassword ? 'peek' : 'cover')
    : focus === 'email' && emailValid ? 'happy'
    : 'idle';

  const fail = (message: string) => {
    setError(message);
    setSad(true);
    setTimeout(() => setSad(false), 1600);
    haptic('error');
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      shakeRef.current?.animate?.(
        [{ transform: 'none' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(9px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }],
        { duration: 420, easing: 'ease-in-out' },
      );
    }
  };

  const succeed = () => {
    setSuccess(true);
    haptic('success');
    celebrate({ x: window.innerWidth / 2, y: window.innerHeight * 0.4 }, 'confetti', 40);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m); setError(''); setStep(0); setStepDir(1);
    haptic('selection');
  };

  const goStep = (to: SignupStep) => {
    setStepDir(to > step ? 1 : -1);
    setStep(to);
    setError('');
    haptic('light');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailValid) return fail('That doesn’t look like an email address.');
    if (!password) return fail('Enter your password.');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      succeed();
    } catch (err: any) {
      console.error(err);
      fail(authMessage(err?.code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) { if (!emailValid) return fail('That doesn’t look like an email address.'); return goStep(1); }
    if (step === 1) { if (strength.score === 0) return fail(strength.hint); return goStep(2); }
    if (!name.trim()) return fail('Tell us what to call you.');
    setIsSubmitting(true);
    try {
      await signup(email.trim(), password, name.trim());
      succeed();
    } catch (err: any) {
      console.error(err);
      fail(authMessage(err?.code));
      if (err?.code === 'auth/email-already-in-use' || err?.code === 'auth/invalid-email') goStep(0);
      if (err?.code === 'auth/weak-password') goStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Popup sign-in (Google, GitHub, ...). Shows an error instead of failing silently. */
  const handleProvider = async (provider: SocialProvider) => {
    setError('');
    setBusyProvider(provider);
    haptic('light');
    try {
      if (provider === 'Google') await googleLogin();
      else await loginWithProvider(provider);
      succeed();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      if (err?.code === 'auth/operation-not-allowed') fail(`${provider} sign-in isn’t turned on for this app yet.`);
      else if (err?.code === 'auth/account-exists-with-different-credential') fail('This email already has an account. Sign in the way you did before.');
      else fail(authMessage(err?.code, `${provider} sign-in didn’t work.`));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(resetEmail.trim())) { setResetStatus('error'); return; }
    setResetStatus('sending');
    try {
      await resetPassword(resetEmail.trim());
      setResetStatus('sent');
      haptic('success');
      setTimeout(() => { setShowReset(false); setResetStatus('idle'); }, 2200);
    } catch {
      setResetStatus('error');
      haptic('error');
    }
  };

  const passwordToggle = (
    <button type="button" onClick={() => { setShowPassword(v => !v); haptic('selection'); }} aria-label={showPassword ? 'Hide password' : 'Show password'}
      // Keep focus in the password field, so the piggy keeps covering / peeking.
      onMouseDown={e => e.preventDefault()}
      className="size-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10">
      <span key={String(showPassword)} aria-hidden="true" className="material-symbols-outlined text-[20px] animate-pop">{showPassword ? 'visibility_off' : 'visibility'}</span>
    </button>
  );

  const ctaLabel = signingUp ? (['Continue', 'Continue', 'Create my account'] as const)[step] : 'Sign in';
  const titles = signingUp
    ? [['Create your account', 'First, your email.'], ['Choose a password', 'Piggy won’t peek. Promise. 🙈'], ['What should we call you?', 'This is how we’ll greet you.']][step]
    : ['Welcome back 👋', 'Sign in to pick up where you left off.'];

  return (
    <div className="min-h-screen w-full bg-[#f4f6f5] dark:bg-[#070a0a] text-slate-900 dark:text-white font-display relative overflow-x-hidden">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-primary/25 dark:bg-primary/20 blur-[120px] animate-[login-drift_14s_ease-in-out_infinite]" />
        <div className="absolute -bottom-48 -right-32 size-[36rem] rounded-full bg-sky-400/25 dark:bg-sky-500/15 blur-[120px] animate-[login-drift_18s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/3 left-1/2 size-[22rem] rounded-full bg-fuchsia-400/15 dark:bg-fuchsia-500/10 blur-[110px] animate-[login-drift_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <button onClick={() => { setTheme(t => (t === 'dark' ? 'light' : 'dark')); haptic('selection'); }} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="fixed top-4 right-4 z-50 size-11 rounded-full bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 backdrop-blur flex items-center justify-center shadow-lg">
        <span key={theme} aria-hidden="true" className={`material-symbols-outlined text-[20px] animate-pop ${theme === 'dark' ? 'text-amber-300' : 'text-orange-500'}`}>{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
      </button>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* ---------- Hero ---------- */}
        <section ref={heroRef} className="relative flex flex-col items-center justify-center px-6 pt-12 pb-2 lg:p-14 text-center lg:text-left lg:items-start [--px:0] [--py:0]">
          <div className="flex items-center gap-3 mb-4 lg:mb-8 animate-slide-up">
            <img src="/icon-hero.svg" alt="" className="size-10" />
            <span className="text-lg font-black tracking-tight">Expense<span className="text-primary">Tracker</span></span>
          </div>

          <div className="relative w-full max-w-lg flex flex-col items-center lg:items-start">
            <div className="relative w-[230px] h-[200px] lg:w-[460px] lg:h-[380px] self-center">
              {/* Parallax cards (desktop): each drifts with the cursor at its own depth */}
              <div className="hidden lg:flex absolute left-0 top-6 items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 dark:bg-white/[0.07] border border-black/5 dark:border-white/10 backdrop-blur shadow-xl animate-[login-float_6s_ease-in-out_infinite]"
                style={{ translate: 'calc(var(--px) * -36px) calc(var(--py) * -24px)' }}>
                <span className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">trending_up</span></span>
                <span className="text-left"><span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Balance</span><span className="block text-sm font-black">₹64,970</span></span>
              </div>
              <div className="hidden lg:flex absolute right-0 top-24 items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 dark:bg-white/[0.07] border border-black/5 dark:border-white/10 backdrop-blur shadow-xl animate-[login-float_7s_ease-in-out_1s_infinite]"
                style={{ translate: 'calc(var(--px) * 28px) calc(var(--py) * 20px)' }}>
                <span className="size-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">restaurant</span></span>
                <span className="text-left"><span className="block text-sm font-bold">Zomato</span><span className="block text-xs font-black text-rose-500">−₹415</span></span>
              </div>
              <div className="hidden lg:flex absolute left-10 bottom-4 items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 dark:bg-white/[0.07] border border-black/5 dark:border-white/10 backdrop-blur shadow-xl animate-[login-float_8s_ease-in-out_2s_infinite]"
                style={{ translate: 'calc(var(--px) * -20px) calc(var(--py) * 30px)' }}>
                <span className="text-lg">🔥</span><span className="text-sm font-black">7-day streak</span>
              </div>
              <div className="hidden lg:block absolute right-6 bottom-10 w-44 px-3 py-2.5 rounded-2xl bg-white/90 dark:bg-white/[0.07] border border-black/5 dark:border-white/10 backdrop-blur shadow-xl animate-[login-float_6.5s_ease-in-out_0.5s_infinite]"
                style={{ translate: 'calc(var(--px) * 40px) calc(var(--py) * -18px)' }}>
                <span className="flex justify-between text-[11px] font-bold"><span>🚲 New bike</span><span className="text-primary">68%</span></span>
                <span className="mt-1.5 block h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"><span className="block h-full w-[68%] rounded-full bg-primary animate-[login-bar_2.4s_ease-out]" /></span>
              </div>

              {/* The piggy, reacting to everything */}
              <div ref={piggyRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] lg:w-[300px]"
                style={{ translate: 'calc(var(--px) * 10px) calc(var(--py) * 8px)' }}>
                <PiggyCharacter mood={mood} look={look} className="w-full h-auto drop-shadow-[0_20px_40px_rgba(236,121,180,0.25)]" />
              </div>
            </div>

            <h1 className="mt-2 text-[2rem] leading-[1.1] lg:text-6xl font-black tracking-tight animate-slide-up">
              Money, made <span className="bg-gradient-to-r from-primary via-emerald-400 to-sky-400 bg-clip-text text-transparent">delightfully</span> simple.
            </h1>
            <p className="mt-3 lg:mt-5 text-sm lg:text-lg text-slate-500 dark:text-slate-400 max-w-md animate-slide-up [animation-delay:80ms] hidden sm:block">
              Track spending, set budgets, and watch your savings grow, one happy little coin at a time.
            </p>
          </div>
        </section>

        {/* ---------- Form ---------- */}
        <section className="flex items-start lg:items-center justify-center px-4 pt-4 pb-10 lg:p-14 [perspective:1400px]">
          <div ref={shakeRef} className="w-full max-w-[440px]">
            <div ref={cardRef}
              className="relative w-full rounded-[2rem] bg-white/85 dark:bg-[#0d1212]/85 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] p-6 sm:p-8 animate-sheet-in transition-transform duration-300 ease-out [transform:rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))]">
              {/* Soft animated sheen along the top edge */}
              <div className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" aria-hidden="true" />

              {/* Mode switch */}
              <div role="tablist" className="relative grid grid-cols-2 p-1 mb-6 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-black/5 dark:border-white/10">
                <span className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white dark:bg-white/10 shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${signingUp ? 'translate-x-full' : ''}`} aria-hidden="true" />
                {(['signin', 'signup'] as const).map(m => (
                  <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                    className={`relative z-10 py-2.5 text-sm font-bold transition-colors ${mode === m ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {/* Title + sign-up progress */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div key={`${mode}-${step}`} className="animate-fade-in">
                  <h2 className="text-2xl font-black tracking-tight">{titles[0]}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{titles[1]}</p>
                </div>
                {signingUp && (
                  <div className="flex items-center gap-1.5 pt-2" aria-label={`Step ${step + 1} of 3`}>
                    {[0, 1, 2].map(i => (
                      <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary' : 'w-1.5 bg-slate-300 dark:bg-white/20'}`} />
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div role="alert" className="mb-4 flex items-start gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-sm font-semibold animate-fade-in">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] mt-px">error</span>{error}
                </div>
              )}

              {!signingUp ? (
                <form onSubmit={handleSignIn} className="flex flex-col gap-3" noValidate>
                  <Field id="email" label="Email" icon="mail" type="email" value={email} onChange={setEmail} autoComplete="email" valid={emailValid}
                    inputRef={emailRef} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} />
                  <Field id="password" label="Password" icon="lock" type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword}
                    autoComplete="current-password" trailing={passwordToggle} onFocus={() => setFocus('password')} onBlur={() => setFocus(null)} />
                  <button type="button" onClick={() => { setResetEmail(email); setShowReset(true); }} className="self-end text-sm font-bold text-primary hover:underline">Forgot password?</button>
                  <SubmitButton busy={isSubmitting} label={ctaLabel} success={success} />
                </form>
              ) : (
                <form onSubmit={handleSignUpNext} className="flex flex-col gap-3" noValidate>
                  <div key={step} className={stepDir === 1 ? 'animate-[onb-in-right_0.4s_cubic-bezier(0.16,1,0.3,1)_backwards]' : 'animate-[onb-in-left_0.4s_cubic-bezier(0.16,1,0.3,1)_backwards]'}>
                    {step === 0 && (
                      <Field id="su-email" label="Email" icon="mail" type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus valid={emailValid}
                        inputRef={emailRef} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} />
                    )}
                    {step === 1 && (
                      <div className="flex flex-col gap-3">
                        <Field id="su-password" label="Password" icon="lock" type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword}
                          autoComplete="new-password" autoFocus trailing={passwordToggle} onFocus={() => setFocus('password')} onBlur={() => setFocus(null)} />
                        <div className="px-1" aria-live="polite">
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map(i => (
                              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${password && strength.score >= i ? STRENGTH_COLORS[strength.score] : 'bg-slate-200 dark:bg-white/10'}`} />
                            ))}
                          </div>
                          <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 min-h-[1rem]">
                            {password ? <><span className="text-slate-800 dark:text-slate-200">{strength.label}</span>{strength.hint && ` · ${strength.hint}`}</> : 'At least 6 characters. Longer is stronger.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {step === 2 && (
                      <Field id="su-name" label="Your name" icon="badge" value={name} onChange={setName} autoComplete="name" autoFocus
                        onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} />
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {step > 0 && (
                      <button type="button" onClick={() => goStep((step - 1) as SignupStep)} aria-label="Back"
                        className="h-14 w-14 shrink-0 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10">
                        <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
                      </button>
                    )}
                    <div className="flex-1"><SubmitButton busy={isSubmitting} label={ctaLabel} success={success} /></div>
                  </div>
                  {step === 0 && <p className="text-[11px] text-slate-400 text-center mt-1">Takes under a minute · no card needed</p>}
                </form>
              )}

              {(!signingUp || step === 0) && (
                <>
                  <div className="flex items-center gap-3 my-6">
                    <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                    <span className="text-xs font-bold text-slate-400">or</span>
                    <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                  </div>
                  <button onClick={() => handleProvider('Google')} disabled={!!busyProvider}
                    className="w-full h-12 rounded-2xl bg-white text-slate-800 font-bold text-sm border border-black/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                    {busyProvider === 'Google' ? <Spinner /> : ICONS.google}
                    Continue with Google
                  </button>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {([['GitHub', 'bg-[#24292e] text-white', ICONS.github], ['Apple', 'bg-black text-white dark:bg-white dark:text-black', ICONS.apple], ['Facebook', 'bg-[#1877F2] text-white', ICONS.facebook]] as const).map(([p, cls, icon]) => (
                      <button key={p} onClick={() => handleProvider(p)} disabled={!!busyProvider} aria-label={`Continue with ${p}`}
                        className={`h-12 rounded-2xl flex items-center justify-center shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all disabled:opacity-60 ${cls}`}>
                        {busyProvider === p ? <Spinner /> : icon}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { haptic('light'); enableDemo(); }} className="group w-full mt-5 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-primary flex items-center justify-center gap-1.5">
                    Just looking? Try it without an account
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </button>
                </>
              )}

              <p className="mt-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">lock</span>
                Your data is private to your account.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Reset password sheet */}
      {showReset && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setShowReset(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-[#121818] border border-black/5 dark:border-white/10 p-6 shadow-2xl animate-sheet-in">
            {resetStatus === 'sent' ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="size-14 rounded-full bg-primary/15 text-primary flex items-center justify-center animate-pop"><span aria-hidden="true" className="material-symbols-outlined text-3xl">mark_email_read</span></span>
                <p className="font-black text-lg">Check your inbox</p>
                <p className="text-sm text-slate-500">We sent a reset link to {resetEmail}.</p>
              </div>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <div>
                  <h3 id="reset-title" className="text-xl font-black">Reset your password</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">We’ll email you a link to choose a new one.</p>
                </div>
                <Field id="reset-email" label="Email" icon="mail" type="email" value={resetEmail} onChange={setResetEmail} autoComplete="email" autoFocus valid={EMAIL_RE.test(resetEmail.trim())} />
                {resetStatus === 'error' && <p role="alert" className="text-sm font-semibold text-rose-500">Couldn’t send the link. Check the email and try again.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setShowReset(false)} className="h-12 rounded-2xl font-bold bg-slate-100 dark:bg-white/5">Cancel</button>
                  <button disabled={resetStatus === 'sending'} className="h-12 rounded-2xl font-black text-[#0b2615] bg-primary disabled:opacity-60">
                    {resetStatus === 'sending' ? 'Sending…' : 'Send link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Primary button with a shine sweep on hover, a spinner while busy and a tick on success. */
const SubmitButton: React.FC<{ busy: boolean; label: string; success: boolean }> = ({ busy, label, success }) => (
  <button type="submit" disabled={busy || success}
    className="relative w-full h-14 shrink-0 rounded-2xl overflow-hidden font-black text-[15px] text-[#0b2615] bg-gradient-to-r from-primary to-emerald-400 shadow-[0_12px_30px_-8px_rgba(46,204,113,0.6)] hover:shadow-[0_16px_40px_-8px_rgba(46,204,113,0.75)] hover:-translate-y-0.5 transition-all disabled:opacity-90 group">
    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />
    <span className="relative flex items-center justify-center gap-2">
      {success ? <span aria-hidden="true" className="material-symbols-outlined animate-pop">check_circle</span>
        : busy ? <Spinner dark />
        : <>{label}<span aria-hidden="true" className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">arrow_forward</span></>}
    </span>
  </button>
);

export default LoginScreen;
