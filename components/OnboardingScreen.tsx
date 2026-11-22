// First-run setup (/onboarding), in three friendly steps:
//   1. About you: name, an avatar (the set matching the chosen gender comes first), optional age.
//   2. Money basics: currency, starting balance, monthly income and budget, main goal.
//   3. All set: a quick summary and a celebration.
// Saves with Store.completeOnboarding; the router then moves on to the Dashboard.
// The old final step streamed an animation from lottie.host (blank offline);
// it now uses the built-in piggy mascot.
import React, { useMemo, useState } from 'react';
import { useStore, OnboardingData } from '../context/Store';
import { CURRENCIES, getCurrencySymbol } from '../utils/currency';
import { presetsFor } from '../utils/avatars';
import { formatMoney } from '../utils/format';
import { celebrate } from '../utils/celebrate';
import { PiggyMascot } from './LoadingScreen';

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'] as const;
const GOALS: { id: OnboardingData['goal']; label: string; desc: string; icon: string }[] = [
  { id: 'saving', label: 'Save more', desc: 'Build a cushion', icon: 'savings' },
  { id: 'debt', label: 'Pay off debt', desc: 'Get to zero', icon: 'money_off' },
  { id: 'tracking', label: 'Just track', desc: 'See where it goes', icon: 'query_stats' },
];
const STEPS = ['About you', 'Money basics', 'All set'];

const inputClass = 'w-full h-14 rounded-2xl px-4 text-[15px] font-semibold bg-slate-100 dark:bg-white/[0.05] text-slate-900 dark:text-white border border-transparent dark:border-white/10 outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-400';

const MoneyInput: React.FC<{ label: string; hint: string; symbol: string; value: string; onChange: (v: string) => void }> = ({ label, hint, symbol, value, onChange }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
    <span className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">{symbol}</span>
      <input type="number" inputMode="decimal" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className={`${inputClass} pl-9`} />
    </span>
    <span className="text-[11px] text-slate-400">{hint}</span>
  </label>
);

const OnboardingScreen: React.FC = () => {
  const { completeOnboarding, user } = useStore();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: user?.displayName || '',
    gender: '',
    age: '',
    avatar: '',
    currency: 'INR',
    initialBalance: '',
    monthlyIncome: '',
    monthlyBudget: '',
    goal: 'tracking' as OnboardingData['goal'],
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(f => ({ ...f, [key]: value }));
  const symbol = getCurrencySymbol(form.currency);
  const avatars = useMemo(() => presetsFor(form.gender).slice(0, 8), [form.gender]);

  const go = (to: number) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
    if (to === 2) setTimeout(() => celebrate({ x: window.innerWidth / 2, y: window.innerHeight * 0.35 }, 'confetti', 36), 250);
  };

  const finish = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        name: form.name.trim(),
        age: form.age,
        gender: form.gender,
        currency: form.currency,
        initialBalance: parseFloat(form.initialBalance || '0'),
        income: parseFloat(form.monthlyIncome || '0'),
        budget: parseFloat(form.monthlyBudget || '0'),
        goal: form.goal,
        avatar: form.avatar || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstName = form.name.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen w-full bg-[#f4f6f5] dark:bg-[#080b0b] text-slate-900 dark:text-white font-display relative overflow-x-hidden flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className={`absolute -top-40 -left-32 size-[32rem] rounded-full blur-[120px] transition-colors duration-1000 ${step === 0 ? 'bg-primary/25' : step === 1 ? 'bg-sky-400/25' : 'bg-fuchsia-400/25'}`} />
        <div className="absolute -bottom-48 -right-32 size-[32rem] rounded-full bg-amber-300/15 blur-[120px]" />
      </div>

      {/* Progress */}
      <header className="relative z-10 w-full max-w-xl mx-auto px-6 pt-8">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => go(step - 1)} disabled={step === 0} aria-label="Back"
            className={`size-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 transition-opacity ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
            <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Step {step + 1} of 3 · {STEPS[step]}</span>
          <span className="size-10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <span className="block h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500 ease-out" style={{ width: i <= step ? '100%' : '0%' }} />
            </span>
          ))}
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-xl mx-auto px-6 py-8">
        <div key={step} className={direction === 1 ? 'animate-[onb-in-right_0.45s_cubic-bezier(0.16,1,0.3,1)_backwards]' : 'animate-[onb-in-left_0.45s_cubic-bezier(0.16,1,0.3,1)_backwards]'}>
          {step === 0 && (
            <div className="flex flex-col gap-7">
              <div>
                <h1 className="text-4xl font-black tracking-tight">Hi there! 👋</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Let’s set things up. What should we call you?</p>
              </div>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" autoFocus className={`${inputClass} text-lg`} />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">I am</span>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map(g => (
                    <button key={g} onClick={() => set('gender', g)}
                      className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${form.gender === g ? 'bg-primary text-[#0b2615] border-primary scale-105' : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:border-primary/40'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Pick an avatar <span className="normal-case tracking-normal font-semibold">(optional, change any time)</span></span>
                <div className="grid grid-cols-4 gap-3 stagger" key={form.gender}>
                  {avatars.map(a => (
                    <button key={a.id} onClick={() => set('avatar', form.avatar === a.src ? '' : a.src)} aria-label={a.label} aria-pressed={form.avatar === a.src}
                      className={`relative aspect-square rounded-full overflow-hidden transition-all duration-200 hover:scale-105 ${form.avatar === a.src ? 'ring-4 ring-primary scale-110 shadow-glow' : 'ring-1 ring-black/5 dark:ring-white/10'}`}>
                      <img src={a.src} alt="" className="w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5 max-w-[10rem]">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Age <span className="normal-case tracking-normal font-semibold">(optional)</span></span>
                <input type="number" inputMode="numeric" value={form.age} onChange={e => set('age', e.target.value)} placeholder="25" className={inputClass} />
              </label>

              <button onClick={() => go(1)} disabled={!form.name.trim()}
                className="h-14 rounded-2xl font-black text-[#0b2615] bg-gradient-to-r from-primary to-emerald-400 shadow-[0_12px_30px_-8px_rgba(46,204,113,0.6)] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 group">
                Continue <span aria-hidden="true" className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-4xl font-black tracking-tight">Money basics{firstName ? `, ${firstName}` : ''}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Rough numbers are fine. You can change all of this later.</p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Currency</span>
                <div className="grid grid-cols-4 gap-2">
                  {CURRENCIES.map(c => (
                    <button key={c.code} onClick={() => set('currency', c.code)}
                      className={`py-3 rounded-2xl border flex flex-col items-center transition-all ${form.currency === c.code ? 'bg-primary/15 border-primary text-primary scale-105' : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:border-primary/40'}`}>
                      <span className="text-xl font-black">{c.symbol}</span>
                      <span className="text-[11px] font-bold">{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MoneyInput label="Money you have now" hint="Added as your starting balance" symbol={symbol} value={form.initialBalance} onChange={v => set('initialBalance', v)} />
                <MoneyInput label="Monthly income" hint="Your income target" symbol={symbol} value={form.monthlyIncome} onChange={v => set('monthlyIncome', v)} />
                <div className="sm:col-span-2">
                  <MoneyInput label="Monthly spending limit" hint="We’ll tell you when you get close" symbol={symbol} value={form.monthlyBudget} onChange={v => set('monthlyBudget', v)} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Main goal</span>
                <div className="grid grid-cols-3 gap-2">
                  {GOALS.map(g => (
                    <button key={g.id} onClick={() => set('goal', g.id)}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1 text-center transition-all ${form.goal === g.id ? 'bg-primary/15 border-primary text-primary scale-105' : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:border-primary/40'}`}>
                      <span aria-hidden="true" className={`material-symbols-outlined text-2xl ${form.goal === g.id ? 'animate-pop' : ''}`}>{g.icon}</span>
                      <span className="text-sm font-black">{g.label}</span>
                      <span className="text-[11px] text-slate-400">{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => go(2)}
                className="h-14 rounded-2xl font-black text-[#0b2615] bg-gradient-to-r from-primary to-emerald-400 shadow-[0_12px_30px_-8px_rgba(46,204,113,0.6)] flex items-center justify-center gap-2 group">
                Looks good <span aria-hidden="true" className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center text-center gap-6">
              <PiggyMascot className="scale-125 my-4" />
              <div>
                <h1 className="text-4xl font-black tracking-tight">You’re all set{firstName ? `, ${firstName}` : ''}! 🎉</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Your piggy bank is ready for its first coin.</p>
              </div>
              <div className="w-full grid grid-cols-3 rounded-2xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 divide-x divide-black/5 dark:divide-white/10 stagger">
                {[
                  { label: 'Starting with', value: formatMoney(parseFloat(form.initialBalance || '0'), symbol) },
                  { label: 'Monthly limit', value: form.monthlyBudget ? formatMoney(parseFloat(form.monthlyBudget), symbol) : 'Not set' },
                  { label: 'Goal', value: GOALS.find(g => g.id === form.goal)?.label ?? '' },
                ].map(s => (
                  <div key={s.label} className="py-3 px-2">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
                    <span className="block text-sm font-black mt-0.5 truncate">{s.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={finish} disabled={isSubmitting}
                className="w-full h-14 rounded-2xl font-black text-[#0b2615] bg-gradient-to-r from-primary to-emerald-400 shadow-[0_12px_30px_-8px_rgba(46,204,113,0.6)] disabled:opacity-70 flex items-center justify-center gap-2">
                {isSubmitting ? <span className="size-5 rounded-full border-[3px] border-[#0b2615]/30 border-t-[#0b2615] animate-spin" /> : <>Take me to my dashboard <span aria-hidden="true" className="material-symbols-outlined">rocket_launch</span></>}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OnboardingScreen;
