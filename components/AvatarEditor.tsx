// Profile picture editor: pick a built-in avatar, or upload a photo and crop it
// (drag to move, pinch / wheel / slider to zoom, circular guide), change it, or
// remove it. Calls onSave with the new avatar ('' = no picture, initials show).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isPresetAvatar, presetsFor, styleForGender, type AvatarStyle } from '../utils/avatars';

const VIEW = 260;   // crop window size (px)
const OUT = 400;    // saved image size (px)
const MAX_ZOOM = 4;

interface Props {
  current?: string;
  gender?: string;
  initials: string;
  onSave: (avatar: string) => Promise<void> | void;
  onClose: () => void;
}

const STYLE_TABS: { id: AvatarStyle | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'feminine', label: 'Feminine' }, { id: 'masculine', label: 'Masculine' }, { id: 'neutral', label: 'Neutral' },
];

const AvatarEditor: React.FC<Props> = ({ current, gender, initials, onSave, onClose }) => {
  const hasPhoto = !!current && !isPresetAvatar(current);
  const [tab, setTab] = useState<'avatars' | 'photo'>(hasPhoto ? 'photo' : 'avatars');
  const [styleFilter, setStyleFilter] = useState<AvatarStyle | 'all'>(styleForGender(gender));
  const [chosen, setChosen] = useState<string>(current || '');
  const [saving, setSaving] = useState(false);

  // --- Photo crop state ---
  const [photo, setPhoto] = useState<string | null>(hasPhoto ? current! : null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  /** Scale at zoom 1: the image just covers the crop circle. */
  const baseScale = natural ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const scale = baseScale * zoom;

  /** Keep the image covering the circle: never let an edge show. */
  const clamp = useCallback((o: { x: number; y: number }, s = scale) => {
    if (!natural) return o;
    const maxX = Math.max(0, (natural.w * s - VIEW) / 2);
    const maxY = Math.max(0, (natural.h * s - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  }, [natural, scale]);

  const setZoomClamped = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setOffset(o => clamp(o, baseScale * next));
  };

  useEffect(() => { setOffset(o => clamp(o)); }, [clamp]);

  const onFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => { setPhoto(reader.result as string); setNatural(null); setZoom(1); setOffset({ x: 0, y: 0 }); setTab('photo'); };
    reader.readAsDataURL(file);
  };

  // Drag to move, two fingers to pinch-zoom.
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomClamped(pinchStart.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.current.dist));
      return;
    }
    setOffset(o => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  /** Draw exactly what's inside the circle onto a square canvas. */
  const exportCrop = (): string | null => {
    const img = imgRef.current;
    if (!img || !natural) return null;
    const canvas = document.createElement('canvas');
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const k = OUT / VIEW;
    ctx.translate(OUT / 2, OUT / 2);
    ctx.scale(k, k);
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -natural.w / 2, -natural.h / 2);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const save = async () => {
    const value = tab === 'photo' ? (photo ? exportCrop() : null) : chosen;
    if (value === null) return;
    setSaving(true);
    try { await onSave(value); onClose(); } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try { await onSave(''); onClose(); } finally { setSaving(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const presets = useMemo(() => presetsFor(gender), [gender]);
  const shown = styleFilter === 'all' ? presets : presets.filter(p => p.style === styleFilter);
  const preview = tab === 'avatars' ? chosen : null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Edit profile picture" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl animate-sheet-in">
        <div className="sticky top-0 z-10 bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur px-5 pt-5 pb-3 flex items-center justify-between">
          <button onClick={onClose} className="text-sm font-bold text-text-light-muted">Cancel</button>
          <h2 className="text-base font-black text-text-light-main dark:text-text-dark-main">Profile picture</h2>
          <button onClick={save} disabled={saving || (tab === 'photo' ? !photo : !chosen)} className="text-sm font-black text-primary disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-5">
          {/* Mode switch */}
          <div role="tablist" className="relative grid grid-cols-2 p-1 rounded-full bg-gray-100 dark:bg-black/30">
            <span className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-surface-darker shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${tab === 'photo' ? 'translate-x-full' : ''}`} aria-hidden="true" />
            {(['avatars', 'photo'] as const).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`relative z-10 py-2 text-xs font-bold flex items-center justify-center gap-1.5 ${tab === t ? 'text-text-light-main dark:text-text-dark-main' : 'text-text-light-muted'}`}>
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{t === 'avatars' ? 'face' : 'photo_camera'}</span>
                {t === 'avatars' ? 'Avatars' : 'My photo'}
              </button>
            ))}
          </div>

          {tab === 'avatars' ? (
            <>
              <div className="flex justify-center">
                <span key={preview || 'none'} className="size-28 rounded-full overflow-hidden ring-4 ring-primary/30 shadow-glow bg-gray-200 dark:bg-white/5 flex items-center justify-center text-3xl font-black animate-pop">
                  {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : initials}
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
                {STYLE_TABS.map(s => (
                  <button key={s.id} onClick={() => setStyleFilter(s.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${styleFilter === s.id ? 'bg-primary text-[#131811] border-primary' : 'border-border-light dark:border-border-dark text-text-light-muted hover:border-primary/40'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3 stagger" key={styleFilter}>
                {shown.map(p => (
                  <button key={p.id} onClick={() => setChosen(p.src)} aria-label={p.label} aria-pressed={chosen === p.src}
                    className={`relative aspect-square rounded-full overflow-hidden transition-all duration-200 hover:scale-105 ${chosen === p.src ? 'ring-4 ring-primary scale-105 shadow-glow' : 'ring-1 ring-black/5 dark:ring-white/10'}`}>
                    <img src={p.src} alt="" className="w-full h-full object-cover" draggable={false} />
                    {chosen === p.src && <span className="absolute bottom-0 right-0 size-6 rounded-full bg-primary text-[#131811] flex items-center justify-center border-2 border-surface-light dark:border-surface-dark animate-pop"><span className="material-symbols-outlined text-[14px]">check</span></span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {photo ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative rounded-3xl overflow-hidden bg-black touch-none select-none cursor-grab active:cursor-grabbing"
                    style={{ width: VIEW, height: VIEW }}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                    onWheel={e => setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 0.93))}>
                    <img ref={imgRef} src={photo} alt="" draggable={false}
                      onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                      className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                      style={natural ? { width: natural.w, height: natural.h, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})` } : { opacity: 0 }} />
                    {/* Circular guide: everything outside is dimmed */}
                    <div className="absolute inset-0 pointer-events-none rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.55)] ring-2 ring-white/80" />
                  </div>
                  <p className="text-xs text-text-light-muted dark:text-text-dark-muted">Drag to move · pinch or use the slider to zoom</p>
                  <label className="w-full flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-light-muted" aria-hidden="true">zoom_out</span>
                    <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={e => setZoomClamped(Number(e.target.value))}
                      aria-label="Zoom" className="flex-1 accent-primary" />
                    <span className="material-symbols-outlined text-text-light-muted" aria-hidden="true">zoom_in</span>
                  </label>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="h-56 rounded-3xl border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-text-light-muted transition-colors">
                  <span className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-float"><span className="material-symbols-outlined text-3xl">add_a_photo</span></span>
                  <span className="font-bold text-text-light-main dark:text-text-dark-main">Choose a photo</span>
                  <span className="text-xs">You'll be able to crop it next</span>
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => fileRef.current?.click()} className="py-2.5 rounded-full text-sm font-bold bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>{photo ? 'Change photo' : 'Upload'}
                </button>
                <label className="py-2.5 rounded-full text-sm font-bold bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 flex items-center justify-center gap-1.5 cursor-pointer">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">photo_camera</span>Take photo
                  <input type="file" accept="image/*" capture="user" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
                </label>
              </div>
            </>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />

          {current && (
            <button onClick={remove} disabled={saving} className="py-2.5 rounded-full text-sm font-bold text-danger hover:bg-danger/10 flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>Remove picture
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AvatarEditor;
