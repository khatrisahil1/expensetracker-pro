// Building blocks for the Profile page. The organisation follows Apple's
// account settings (grouped rows → detail pages, short explanations under
// groups), but the look is this app's own: large rounded cards, tinted icon
// tiles, bold type and the green accent used on every other page.
import React from 'react';

/** A card of rows with a small accent header above and an explanation below. */
export const Group: React.FC<{ header?: string; footer?: React.ReactNode; children: React.ReactNode }> = ({ header, footer, children }) => (
  <section className="flex flex-col gap-2.5">
    {header && <h3 className="px-5 text-[11px] font-black uppercase tracking-[0.2em] text-primary">{header}</h3>}
    <div className="rounded-[1.75rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-card-light dark:shadow-card overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.06]">
      {children}
    </div>
    {footer && <p className="px-5 text-xs leading-relaxed text-text-light-muted dark:text-text-dark-muted">{footer}</p>}
  </section>
);

/** Tinted icon tiles, matching the category icons used across the app. */
export const TILE = {
  green: 'bg-primary/15 text-primary',
  blue: 'bg-sky-500/15 text-sky-500',
  orange: 'bg-orange-500/15 text-orange-500',
  red: 'bg-rose-500/15 text-rose-500',
  gray: 'bg-gray-500/15 text-gray-500 dark:text-gray-300',
  indigo: 'bg-indigo-500/15 text-indigo-400',
  teal: 'bg-teal-500/15 text-teal-400',
  yellow: 'bg-amber-500/15 text-amber-500',
} as const;

interface RowProps {
  label: React.ReactNode;
  icon?: string;
  tile?: keyof typeof TILE;
  /** Muted text on the right, e.g. the current value. */
  value?: React.ReactNode;
  /** Smaller second line under the label. */
  detail?: React.ReactNode;
  /** Makes the row a button and shows a chevron. */
  onClick?: () => void;
  /** Red label, for destructive actions. */
  destructive?: boolean;
  /** Centred label (Sign Out, Delete). */
  centered?: boolean;
  /** Controls at the right instead of a value (switches, buttons). */
  trailing?: React.ReactNode;
  disabled?: boolean;
  /** Highlights the row on wide screens, where its page is shown beside the list. */
  selected?: boolean;
}

/** One row of a Group. Rows with onClick are buttons, with a chevron that nudges right on hover. */
export const Row: React.FC<RowProps> = ({ label, icon, tile = 'gray', value, detail, onClick, destructive, centered, trailing, disabled, selected }) => {
  const body = (
    <>
      {icon && (
        <span className={`size-10 shrink-0 rounded-[14px] flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${TILE[tile]}`}>
          <span className="material-symbols-outlined text-[21px]" aria-hidden="true">{icon}</span>
        </span>
      )}
      <span className={`flex-1 min-w-0 flex flex-col ${centered ? 'items-center' : 'items-start'}`}>
        <span className={`text-[15px] font-bold truncate max-w-full ${destructive ? 'text-danger' : 'text-text-light-main dark:text-text-dark-main'}`}>{label}</span>
        {detail && <span className="text-xs text-text-light-muted dark:text-text-dark-muted truncate max-w-full">{detail}</span>}
      </span>
      {value !== undefined && <span className="text-sm font-semibold text-text-light-muted dark:text-text-dark-muted truncate max-w-[45%] text-right">{value}</span>}
      {trailing}
      {onClick && !centered && (
        <span className="material-symbols-outlined text-[20px] text-text-light-muted/50 dark:text-text-dark-muted/50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true">chevron_right</span>
      )}
    </>
  );
  const cls = `group relative w-full min-h-[60px] px-5 py-3 flex items-center gap-4 text-left ${centered ? 'justify-center' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} disabled={disabled} aria-current={selected ? 'page' : undefined}
      className={`${cls} transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-white/[0.03] disabled:opacity-50 ${selected ? 'lg:bg-primary/[0.07]' : ''}`}>
      {/* Accent bar marking the open page on wide screens */}
      {selected && <span className="hidden lg:block absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary animate-fade-in" aria-hidden="true" />}
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

/** On/off switch with a springy knob and proper switch semantics. */
export const Switch: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; busy?: boolean }> = ({ checked, onChange, label, disabled, busy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-busy={busy || undefined}
    disabled={disabled || busy}
    onClick={() => onChange(!checked)}
    className={`relative w-[52px] h-8 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-60 ${checked ? 'bg-primary shadow-glow' : 'bg-gray-300 dark:bg-white/15'}`}
  >
    <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${checked ? 'translate-x-5' : ''}`}>
      {busy && <span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
    </span>
  </button>
);

/** Inputs that sit inside a Row. border-0/shadow-none/p-0 undo the global form-plugin box. */
export const rowInputClass =
  'bg-transparent border-0 shadow-none p-0 text-right text-[15px] font-semibold text-text-light-main dark:text-text-dark-main placeholder:font-normal placeholder:text-text-light-muted/60 outline-none focus:outline-none focus:ring-0 min-w-0 flex-1 [color-scheme:light] dark:[color-scheme:dark]';

/** Page title with a back link (phones only), at the top of each detail page. */
export const DetailHeader: React.FC<{ title: string; subtitle?: string; onBack: () => void }> = ({ title, subtitle, onBack }) => (
  <div className="flex flex-col gap-2 mb-6 animate-slide-up">
    <button type="button" onClick={onBack} className="lg:hidden -ml-1 flex items-center gap-0.5 text-primary text-sm font-bold w-fit">
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">chevron_left</span>Profile
    </button>
    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">{title}</h2>
    {subtitle && <p className="text-sm text-text-light-muted dark:text-text-dark-muted">{subtitle}</p>}
  </div>
);
