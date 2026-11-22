// Monthly Wrapped: a full-screen, story-style recap of a month.
// Tap right / left to move, press and hold to pause, swipe down or ✕ to close.
// Slides auto-advance (the top bars show progress). The last slide can share a
// text summary. Numbers come from utils/wrapped.ts.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Transaction } from '../../context/Store';
import { buildWrapped, chaiEquivalent, monthsWithData, type PiggyMood, type WrappedStats } from '../../utils/wrapped';
import { formatMoney } from '../../utils/format';
import { formatDisplayDate, parseLocalDate } from '../../utils/date';
import { getCategoryStyle } from '../../constants/categories';
import { useCountUp } from '../../hooks/useCountUp';
import { celebrate } from '../../utils/celebrate';
import { PiggyMascot } from '../LoadingScreen';

const SLIDE_MS = 5500;

const MOOD: Record<PiggyMood, { emoji: string; line: string }> = {
  thrilled: { emoji: '🤩', line: 'Your piggy is over the moon. Big saver energy!' },
  happy: { emoji: '😊', line: 'Your piggy is happy. Solid month!' },
  okay: { emoji: '🙂', line: 'Your piggy is doing okay. Room to grow next month.' },
  worried: { emoji: '🥺', line: 'Your piggy is a little hungry. Let’s feed it next month!' },
};

/** Money that rolls up to its value when the slide appears. */
const Count: React.FC<{ value: number; symbol: string; signed?: boolean }> = ({ value, symbol, signed }) => {
  const v = useCountUp(value, 1100);
  return <>{formatMoney(Math.round(v), symbol, { signed })}</>;
};

interface Slide { key: string; bg: string; render: () => React.ReactNode }

const slidesFor = (s: WrappedStats, symbol: string): Slide[] => {
  const list: Slide[] = [];
  const kicker = 'text-xs font-black uppercase tracking-[0.25em] opacity-80';
  const big = 'text-5xl sm:text-6xl font-black tracking-tight';
  const anim = (d: number) => ({ animation: `wrap-in 0.6s cubic-bezier(0.16,1,0.3,1) ${d}ms backwards` });

  list.push({ key: 'intro', bg: 'from-[#0f2d1d] via-[#13402a] to-[#0b1a12]', render: () => (
    <div className="flex flex-col items-center text-center gap-6">
      <span className={kicker} style={anim(0)}>Your month, wrapped</span>
      <PiggyMascot className="scale-110" />
      <h2 className="text-5xl font-black leading-tight" style={anim(150)}>{s.monthName}<br /><span className="text-[#F5C542]">Wrapped</span> 🎁</h2>
      <p className="opacity-80" style={anim(300)}>{s.transactionCount} entries over {s.daysLogged} days. Let’s see how it went.</p>
    </div>
  ) });

  list.push({ key: 'totals', bg: 'from-[#0c1f3a] via-[#123a6b] to-[#081325]', render: () => (
    <div className="flex flex-col gap-8">
      <span className={kicker} style={anim(0)}>Money in & out</span>
      <div style={anim(100)}><p className="opacity-70 font-semibold">You earned</p><p className={`${big} text-[#6ee7a8]`}><Count value={s.income} symbol={symbol} /></p></div>
      <div style={anim(250)}><p className="opacity-70 font-semibold">You spent</p><p className={`${big} text-[#fda4af]`}><Count value={s.expense} symbol={symbol} /></p></div>
      <div className="rounded-3xl bg-white/10 p-5" style={anim(400)}>
        {s.net >= 0
          ? <p className="text-lg font-bold">You kept <span className="text-[#F5C542] font-black"><Count value={s.net} symbol={symbol} /></span>{s.income > 0 && <> · {s.savingsRate}% of your income 🎉</>}</p>
          : <p className="text-lg font-bold">You spent <span className="text-[#fda4af] font-black">{formatMoney(-s.net, symbol)}</span> more than you earned.</p>}
      </div>
    </div>
  ) });

  if (s.topCategory) {
    const style = getCategoryStyle(s.topCategory.name);
    list.push({ key: 'top', bg: 'from-[#3b1d0c] via-[#7a3412] to-[#1f0f06]', render: () => (
      <div className="flex flex-col items-center text-center gap-6">
        <span className={kicker} style={anim(0)}>Your top category</span>
        <span className="size-28 rounded-[2rem] bg-white/15 flex items-center justify-center" style={{ animation: 'wrap-float 4s ease-in-out infinite' }}>
          <span aria-hidden="true" className="material-symbols-outlined text-6xl" style={{ color: style.hex }}>{style.icon}</span>
        </span>
        <h2 className={big} style={anim(150)}>{s.topCategory!.name}</h2>
        <p className="text-xl font-bold" style={anim(250)}><Count value={s.topCategory!.amount} symbol={symbol} /> · {s.topCategory!.share}% of your spending</p>
        {symbol === '₹' && <p className="opacity-75" style={anim(400)}>That’s about {chaiEquivalent(s.topCategory!.amount).toLocaleString('en-IN')} cups of chai ☕</p>}
        <div className="w-full flex flex-col gap-2 mt-2" style={anim(500)}>
          {s.categories.slice(1, 4).map(c => (
            <div key={c.name} className="flex justify-between text-sm font-semibold opacity-85"><span>{c.name}</span><span>{formatMoney(Math.round(c.amount), symbol)}</span></div>
          ))}
        </div>
      </div>
    ) });
  }

  if (s.biggestExpense) {
    list.push({ key: 'biggest', bg: 'from-[#2b0d33] via-[#5b1a6e] to-[#16061b]', render: () => (
      <div className="flex flex-col gap-6">
        <span className={kicker} style={anim(0)}>Biggest single spend</span>
        <p className={big} style={anim(100)}><Count value={s.biggestExpense!.amount} symbol={symbol} /></p>
        <div className="rounded-3xl bg-white/10 p-5" style={anim(250)}>
          <p className="text-2xl font-black">{s.biggestExpense!.title}</p>
          <p className="opacity-75 mt-1">{s.biggestExpense!.category} · {formatDisplayDate(s.biggestExpense!.date)}</p>
        </div>
        <p className="opacity-75" style={anim(400)}>Big moments happen. Just make sure they’re worth it 😉</p>
      </div>
    ) });
  }

  if (s.busiestWeekday) {
    const max = Math.max(...s.byWeekday, 1);
    list.push({ key: 'weekday', bg: 'from-[#06302f] via-[#0d5c58] to-[#041a19]', render: () => (
      <div className="flex flex-col gap-6">
        <span className={kicker} style={anim(0)}>Your big spending day</span>
        <h2 className={big} style={anim(100)}>{s.busiestWeekday}s</h2>
        <div className="flex items-end gap-2 h-40 mt-2" style={anim(200)}>
          {s.byWeekday.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className={`w-full rounded-t-xl ${v === max ? 'bg-[#F5C542]' : 'bg-white/30'}`}
                style={{ height: `${Math.max(4, (v / max) * 100)}%`, transformOrigin: 'bottom', animation: `wrap-grow 0.8s cubic-bezier(0.34,1.56,0.64,1) ${300 + i * 70}ms backwards` }} />
              <span className="text-xs font-bold opacity-70">{'MTWTFSS'[i]}</span>
            </div>
          ))}
        </div>
        <p className="opacity-75" style={anim(500)}>{formatMoney(Math.round(max), symbol)} spent on {s.busiestWeekday}s this month.</p>
      </div>
    ) });
  }

  list.push({ key: 'habits', bg: 'from-[#3a2a06] via-[#6b4d0b] to-[#1c1503]', render: () => (
    <div className="flex flex-col gap-6">
      <span className={kicker} style={anim(0)}>Your habits</span>
      <p className={big} style={anim(100)}>{s.daysLogged}<span className="text-2xl opacity-70"> / {s.daysInMonth} days</span></p>
      <p className="text-xl font-bold" style={anim(200)}>You logged money on {Math.round((s.daysLogged / s.daysInMonth) * 100)}% of days 🔥</p>
      {s.spendChange !== null && (
        <div className="rounded-3xl bg-white/10 p-5" style={anim(350)}>
          <p className="text-lg font-bold">
            Spending {s.spendChange <= 0 ? 'down' : 'up'} <span className={s.spendChange <= 0 ? 'text-[#6ee7a8]' : 'text-[#fda4af]'}>{Math.abs(s.spendChange).toFixed(0)}%</span> vs last month {s.spendChange <= 0 ? '📉👏' : '📈'}
          </p>
        </div>
      )}
    </div>
  ) });

  list.push({ key: 'finale', bg: 'from-[#2d0f22] via-[#6b1d4f] to-[#140610]', render: () => (
    <div className="flex flex-col items-center text-center gap-6">
      <span className={kicker} style={anim(0)}>Piggy’s verdict</span>
      <PiggyMascot className="scale-110" />
      <p className="text-6xl" style={anim(150)}>{MOOD[s.mood].emoji}</p>
      <h2 className="text-3xl font-black leading-tight" style={anim(250)}>{MOOD[s.mood].line}</h2>
    </div>
  ) });

  return list;
};

interface Props {
  transactions: Transaction[];
  symbol: string;
  initialMonth: Date;
  onClose: () => void;
}

const MonthlyWrapped: React.FC<Props> = ({ transactions, symbol, initialMonth, onClose }) => {
  const [month, setMonth] = useState(initialMonth);
  const stats = useMemo(() => buildWrapped(transactions, month), [transactions, month]);
  const slides = useMemo(() => slidesFor(stats, symbol), [stats, symbol]);
  const months = useMemo(() => monthsWithData(transactions), [transactions]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pressStart = useRef(0);
  const touchY = useRef<number | null>(null);
  const isLast = index === slides.length - 1;

  const next = () => setIndex(i => Math.min(slides.length - 1, i + 1));
  const prev = () => setIndex(i => Math.max(0, i - 1));

  useEffect(() => { setIndex(0); }, [month]);
  useEffect(() => { if (isLast) celebrate({ x: window.innerWidth / 2, y: window.innerHeight * 0.3 }, stats.mood === 'worried' ? 'hearts' : 'confetti', 40); }, [isLast, stats.mood]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  });

  const share = async () => {
    const text = [
      `My ${stats.monthName} on ExpenseTracker 🐷`,
      `Earned ${formatMoney(stats.income, symbol)} · Spent ${formatMoney(stats.expense, symbol)}`,
      stats.net >= 0 ? `Kept ${formatMoney(stats.net, symbol)} (${stats.savingsRate}%) 🎉` : '',
      stats.topCategory ? `Top category: ${stats.topCategory.name}` : '',
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: `${stats.monthName} Wrapped`, text });
      else { await navigator.clipboard.writeText(text); alertCopied(); }
    } catch { /* cancelled */ }
  };
  const [copied, setCopied] = useState(false);
  const alertCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const slide = slides[index];

  return createPortal(
    <div className="fixed inset-0 z-[330] bg-black flex items-center justify-center animate-fade-in" role="dialog" aria-modal="true" aria-label={`${stats.monthName} Wrapped`}>
      <div className={`relative w-full h-full sm:h-[min(92vh,820px)] sm:max-w-[440px] sm:rounded-[2.5rem] overflow-hidden text-white bg-gradient-to-br ${slide.bg} transition-colors duration-700 select-none`}
        onPointerDown={() => { pressStart.current = performance.now(); setPaused(true); }}
        onPointerUp={e => {
          setPaused(false);
          if (performance.now() - pressStart.current > 250) return; // it was a hold-to-pause
          const box = e.currentTarget.getBoundingClientRect();
          (e.clientX - box.left < box.width * 0.33 ? prev : next)();
        }}
        onPointerLeave={() => setPaused(false)}
        onTouchStart={e => { touchY.current = e.touches[0].clientY; }}
        onTouchEnd={e => { if (touchY.current !== null && e.changedTouches[0].clientY - touchY.current > 120) onClose(); touchY.current = null; }}>

        {/* Soft moving light */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl" style={{ animation: 'login-drift 12s ease-in-out infinite' }} aria-hidden="true" />

        {/* Progress bars */}
        <div className="absolute top-0 inset-x-0 z-20 px-3 pt-3 flex gap-1.5" aria-hidden="true">
          {slides.map((sl, i) => (
            <span key={sl.key} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
              {i < index && <span className="block h-full w-full bg-white" />}
              {i === index && (
                <span key={`${month.getTime()}-${index}`} className="block h-full w-full bg-white origin-left"
                  style={{ animation: `wrap-bar ${SLIDE_MS}ms linear forwards`, animationPlayState: paused || isLast ? 'paused' : 'running', transform: isLast ? 'scaleX(1)' : undefined }}
                  onAnimationEnd={next} />
              )}
            </span>
          ))}
        </div>

        {/* Header: month picker + close */}
        <div className="absolute top-6 inset-x-0 z-20 px-4 flex items-center justify-between" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
          <label className="relative flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/25 backdrop-blur text-sm font-bold">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">calendar_month</span>
            <select aria-label="Month" value={`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`}
              onChange={e => setMonth(parseLocalDate(e.target.value))}
              className="appearance-none bg-transparent [background-image:none] border-0 p-0 pr-5 font-bold focus:ring-0 text-white">
              {months.map(m => <option key={m} value={m} className="text-black">{parseLocalDate(m).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
            </select>
            <span className="material-symbols-outlined text-[18px] absolute right-2 pointer-events-none" aria-hidden="true">expand_more</span>
          </label>
          <button onClick={onClose} aria-label="Close" className="size-10 rounded-full bg-black/25 backdrop-blur flex items-center justify-center">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Slide */}
        <div key={`${month.getTime()}-${slide.key}`} className="absolute inset-0 flex items-center px-8 pt-20 pb-28">
          <div className="w-full">{slide.render()}</div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 inset-x-0 z-20 p-6 flex items-center justify-between gap-3" onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
          {isLast ? (
            <>
              <button onClick={() => setIndex(0)} className="h-12 px-5 rounded-full bg-white/15 backdrop-blur font-bold flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">replay</span>Replay
              </button>
              <button onClick={share} className="h-12 flex-1 rounded-full bg-white text-black font-black flex items-center justify-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">ios_share</span>{copied ? 'Copied!' : 'Share my month'}
              </button>
            </>
          ) : (
            <p className="w-full text-center text-xs font-semibold opacity-60">Tap to continue · hold to pause</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MonthlyWrapped;
