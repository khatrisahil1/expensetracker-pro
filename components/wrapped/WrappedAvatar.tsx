// The profile picture that opens Monthly Wrapped on press-and-hold.
// Tap: onTap (usually go to Profile). Hold: a ring fills around the picture,
// then the Wrapped story opens. Marked with data-wrapped-target so the
// first-time spotlight tutorial can find it.
import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';
import { openWrapped } from './wrappedEvents';

interface Props {
  src?: string;
  initials: string;
  size?: number;
  onTap?: () => void;
  className?: string;
}

const WrappedAvatar: React.FC<Props> = ({ src, initials, size = 40, onTap, className = '' }) => {
  const { progress, handlers } = useLongPress(openWrapped, { ms: 600, onTap });
  const r = size / 2 + 3;
  const c = 2 * Math.PI * r;
  return (
    <button type="button" data-wrapped-target="" aria-label="Profile. Press and hold for your Monthly Wrapped"
      {...handlers}
      className={`relative shrink-0 rounded-full select-none touch-manipulation [-webkit-touch-callout:none] ${className}`}
      style={{ width: size, height: size, transform: progress > 0 ? `scale(${1 - progress * 0.08})` : undefined, transition: progress > 0 ? 'none' : 'transform 0.25s' }}>
      {src
        ? <img src={src} alt="" draggable={false} className="size-full rounded-full object-cover border-2 border-primary/90" />
        : <span className="size-full rounded-full flex items-center justify-center bg-primary/20 text-primary font-black text-sm border-2 border-primary/90">{initials}</span>}
      {/* Hold progress ring */}
      {progress > 0 && (
        <svg className="absolute pointer-events-none -rotate-90" style={{ left: -5, top: -5, width: size + 10, height: size + 10 }} viewBox={`0 0 ${size + 10} ${size + 10}`} aria-hidden="true">
          <circle cx={(size + 10) / 2} cy={(size + 10) / 2} r={r} fill="none" stroke="#F5C542" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
      )}
      {progress > 0.15 && <span className="absolute -top-2 -right-2 text-sm animate-pop pointer-events-none" aria-hidden="true">🎁</span>}
    </button>
  );
};

export default WrappedAvatar;
