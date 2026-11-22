// The squishy coin shown while pulling to refresh (see hooks/usePullToRefresh).
//   pulling    a gooey gold tail stretches from the top; the ₹ coin stretches and spins with the pull
//   armed      it wobbles ("boing") and shines: let go to refresh
//   refreshing it squashes on landing, then keeps flipping
//   done       a tick pops, then it shrinks away
import React from 'react';
import { PULL_THRESHOLD, type PullPhase } from '../hooks/usePullToRefresh';

interface Props { pull: number; phase: PullPhase; dragging: boolean }

const BLOB = 46;

const PullToRefresh: React.FC<Props> = ({ pull, phase, dragging }) => {
  if (phase === 'idle' || phase === 'settling') return null;
  const progress = Math.min(1, pull / PULL_THRESHOLD);
  // Stretch taller and thinner as the pull grows (only while pulling).
  const stretch = phase === 'pulling' ? { transform: `scale(${1 - progress * 0.14}, ${1 + progress * 0.22})` } : undefined;
  const top = Math.max(0, pull - BLOB - 8);
  const label =
    phase === 'armed' ? 'Release to refresh'
    : phase === 'refreshing' ? 'Refreshing…'
    : phase === 'done' ? 'Up to date'
    : 'Pull to refresh';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center" style={{ height: pull }} aria-hidden={phase !== 'refreshing' && phase !== 'done'}>
      <span className="sr-only" role="status">{phase === 'refreshing' || phase === 'done' ? label : ''}</span>

      {/* Gooey tail: thick near the top edge, thinning as it stretches */}
      {(phase === 'pulling' || phase === 'armed') && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full bg-gradient-to-b from-[#F5C542]/40 to-[#F5C542]/90"
          style={{ height: top + BLOB / 2, width: Math.max(8, 30 - progress * 20), opacity: 0.55 + progress * 0.35 }} />
      )}

      {/* Blob */}
      <div className={`absolute left-1/2 ${dragging ? '' : 'transition-[top] duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]'}`}
        style={{ top, marginLeft: -BLOB / 2, width: BLOB, height: BLOB }}>
        <div key={phase}
          className={`relative size-full rounded-full shadow-[0_8px_24px_rgba(245,197,66,0.45)] bg-[radial-gradient(circle_at_35%_30%,#FFF6C2,#F5C542_50%,#D99A12)] ring-2 ring-[#B07A0C]/60
            ${phase === 'armed' ? 'animate-[ptr-boing_0.5s_ease-out]' : ''}
            ${phase === 'refreshing' ? 'animate-[ptr-squash_0.45s_ease-out,ptr-jelly_0.9s_ease-in-out_0.45s_infinite]' : ''}
            ${phase === 'done' ? 'animate-[ptr-bye_0.35s_ease-in_0.15s_forwards]' : ''}`}
          style={stretch}>
          {/* Shine */}
          <span className="absolute top-1.5 left-2.5 w-3 h-2 rounded-full bg-white/60 rotate-[-20deg]" />
          {/* Coin face: ₹ spins with the pull, flips while refreshing, becomes a tick when done */}
          <span className="absolute inset-0 flex items-center justify-center text-[#7A4B00] font-black text-xl [perspective:200px]">
            {phase === 'done' ? (
              <span aria-hidden="true" className="material-symbols-outlined text-[22px] animate-pop">check</span>
            ) : (
              <span className={phase === 'refreshing' ? 'animate-[ptr-flip_0.8s_linear_infinite]' : ''}
                style={phase === 'pulling' || phase === 'armed' ? { transform: `rotateY(${progress * 360}deg)`, display: 'inline-block' } : { display: 'inline-block' }}>
                ₹
              </span>
            )}
          </span>
          {/* Sparkles when armed */}
          {phase === 'armed' && (
            <>
              <span className="absolute -top-2 -right-1 text-[12px] animate-pop">✨</span>
              <span className="absolute -bottom-1 -left-2 text-[10px] animate-pop [animation-delay:80ms]">✨</span>
            </>
          )}
        </div>
      </div>

      {/* Hint text under the blob */}
      {pull > BLOB + 12 && phase !== 'done' && (
        <span className="absolute text-[11px] font-bold text-amber-400 whitespace-nowrap transition-opacity" style={{ top: top + BLOB + 6, opacity: Math.min(1, (pull - BLOB) / 30) }}>
          {label}
        </span>
      )}
    </div>
  );
};

export default PullToRefresh;
