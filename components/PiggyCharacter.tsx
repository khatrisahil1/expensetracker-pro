// Interactive piggy for the login and sign-up screens. Same drawing as the
// boot splash, but alive:
//   idle   eyes open, blink, follow `look` (cursor or text caret); gentle breathing
//   cover  a front hoof rises to cover the eye (password being typed)
//   peek   the hoof lifts a little so it can peek (password shown)
//   happy  happy closed eye, blush, a coin drops into the slot
//   sad    droopy eye and a sad brow (error)
import React from 'react';

export type PiggyMood = 'idle' | 'cover' | 'peek' | 'happy' | 'sad';

interface Props {
  mood?: PiggyMood;
  /** Where to look, each axis -1..1 (left/up negative). */
  look?: { x: number; y: number };
  className?: string;
}

const EYE = { x: 157, y: 82 };

const PiggyCharacter: React.FC<Props> = ({ mood = 'idle', look = { x: 0, y: 0 }, className = '' }) => {
  const px = EYE.x + Math.max(-1, Math.min(1, look.x)) * 3.2;
  const py = EYE.y + Math.max(-1, Math.min(1, look.y)) * 3.2;
  // Hoof position: resting on the ground → over the eye → slightly lowered to peek.
  const hoof = mood === 'cover' ? 'translate(4px, -62px) rotate(-28deg)' : mood === 'peek' ? 'translate(4px, -50px) rotate(-18deg)' : 'none';
  const open = mood === 'idle' || mood === 'peek' || mood === 'cover';

  return (
    <svg viewBox="0 -50 220 230" className={`overflow-visible ${className}`} role="img" aria-label="Piggy bank mascot">
      <defs>
        <linearGradient id="pc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD9EA" /><stop offset=".45" stopColor="#FBA9CF" /><stop offset="1" stopColor="#E7699F" /></linearGradient>
        <radialGradient id="pc-shade" cx="35%" cy="30%" r="75%"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#9B1F5C" stopOpacity=".28" /></radialGradient>
        <linearGradient id="pc-snout" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFC3DD" /><stop offset="1" stopColor="#EE7FB1" /></linearGradient>
        <linearGradient id="pc-leg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F48DBD" /><stop offset="1" stopColor="#D9558F" /></linearGradient>
        <radialGradient id="pc-coin" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#FFF8D6" /><stop offset=".45" stopColor="#FFD54A" /><stop offset="1" stopColor="#E0A100" /></radialGradient>
        <clipPath id="pc-above-slot"><rect x="0" y="-200" width="220" height="254" /></clipPath>
      </defs>

      <ellipse cx="112" cy="166" rx="62" ry="8" fill="#000" opacity=".22" className="pchar-shadow" />

      <g className={`pchar-body ${mood === 'happy' ? 'pchar-happy' : mood === 'sad' ? 'pchar-sad' : ''}`}>
        <rect x="58" y="128" width="20" height="30" rx="9" fill="#D45A90" />
        <rect x="128" y="128" width="20" height="30" rx="9" fill="#D45A90" />
        <path className="pb-tail" d="M44 96c-14-4-20 8-12 13 7 4 12-4 6-8-4-3-9 1-7 5" fill="none" stroke="#E7699F" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M134 54c2-15 11-25 21-27 2 13-3 25-11 31z" fill="#E7699F" />
        <path d="M46 102c0-34 30-58 70-58 38 0 66 22 70 54 3 30-22 50-66 52-46 2-74-16-74-48z" fill="url(#pc-body)" />
        <path d="M46 102c0-34 30-58 70-58 38 0 66 22 70 54 3 30-22 50-66 52-46 2-74-16-74-48z" fill="url(#pc-shade)" />
        <rect x="74" y="132" width="22" height="30" rx="10" fill="url(#pc-leg)" />
        <rect x="74" y="154" width="22" height="8" rx="4" fill="#B8437A" />
        <rect x="94" y="49" width="34" height="7" rx="3.5" fill="#A12E66" />
        <rect x="96" y="50" width="30" height="3" rx="1.5" fill="#6E1A45" />
        <path d="M146 58c4-16 16-26 28-24-2 14-10 26-22 32z" fill="#F48DBD" />
        <path d="M152 56c4-9 10-15 17-16-2 8-7 15-14 19z" fill="#FFC3DD" />
        <ellipse cx="188" cy="102" rx="16" ry="19" fill="url(#pc-snout)" />
        <ellipse cx="188" cy="102" rx="16" ry="19" fill="none" stroke="#D9558F" strokeOpacity=".35" strokeWidth="2" />
        <ellipse cx="183" cy="100" rx="3" ry="5" fill="#B8437A" />
        <ellipse cx="194" cy="100" rx="3" ry="5" fill="#B8437A" />

        {/* Eye */}
        {open ? (
          <g className="pchar-blink">
            <ellipse cx={EYE.x} cy={EYE.y} rx="7.5" ry="8.5" fill="#fff" />
            <circle cx={px} cy={py} r="4.2" fill="#2A0F1E" style={{ transition: 'cx 0.15s ease-out, cy 0.15s ease-out' }} />
            <circle cx={px + 1.4} cy={py - 1.6} r="1.3" fill="#fff" style={{ transition: 'cx 0.15s ease-out, cy 0.15s ease-out' }} />
          </g>
        ) : mood === 'happy' ? (
          <path d="M150 84q7-8 14 0" fill="none" stroke="#3B1026" strokeWidth="3.6" strokeLinecap="round" />
        ) : (
          <g>
            <path d="M150 82q7 6 14 0" fill="none" stroke="#3B1026" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M148 72l15 5" stroke="#3B1026" strokeWidth="2.6" strokeLinecap="round" />
            <ellipse cx="162" cy="92" rx="2.2" ry="3" fill="#7dd3fc" className="pchar-tear" />
          </g>
        )}
        <ellipse cx="162" cy="102" rx="9" ry="5.5" fill="#FF6B9A" opacity={mood === 'happy' ? 0.7 : 0.4} style={{ transition: 'opacity .3s' }} />
        <ellipse cx="84" cy="70" rx="24" ry="9" fill="#fff" opacity=".55" transform="rotate(-18 84 70)" />
        <circle cx="112" cy="62" r="3.5" fill="#fff" opacity=".7" />

        {/* Front leg that becomes the hoof over the eye */}
        <g style={{ transform: hoof, transformBox: 'view-box', transformOrigin: '157px 150px', transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <rect x="146" y="130" width="22" height="30" rx="10" fill="url(#pc-leg)" />
          <rect x="146" y="152" width="22" height="8" rx="4" fill="#B8437A" />
        </g>
      </g>

      {/* Happy: a coin drops into the slot */}
      {mood === 'happy' && (
        <g clipPath="url(#pc-above-slot)">
          <g className="pchar-coin">
            <circle cx="111" cy="8" r="20" fill="url(#pc-coin)" stroke="#C98E00" strokeWidth="2" />
            <text x="111" y="14.5" textAnchor="middle" fontSize="19" fontWeight="800" fontFamily="system-ui, sans-serif" fill="#8A5A00">₹</text>
          </g>
        </g>
      )}
    </svg>
  );
};

export default PiggyCharacter;
