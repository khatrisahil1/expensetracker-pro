import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';
import { UNDO_WINDOW_MS } from '../constants/app';

// Global Component: Undo Snackbar
// Displays when an item is deleted, allowing immediate restoration.
// On phones it sits above the bottom nav (bottom-24) instead of covering it.
const UndoSnackbar: React.FC = () => {
    const { undoState, clearUndo, restoreTransaction } = useStore();
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!undoState.show) return;

        setProgress(100);
        const duration = UNDO_WINDOW_MS;
        const start = performance.now();

        const id = window.setInterval(() => {
            const elapsed = performance.now() - start;
            const percent = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(percent);
            if (percent <= 0) window.clearInterval(id);
        }, 50);

        return () => window.clearInterval(id);
    }, [undoState.show]);

    if (!undoState.show || !undoState.item) return null;

    const handleUndo = async () => {
        if (undoState.item) {
            await restoreTransaction(undoState.item);
            clearUndo();
        }
    };

    const circleRadius = 14;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const strokeDashOffset = circleCircumference * (1 - progress / 100);
    const isUrgent = progress <= 25;

    return (
        <div className="fixed bottom-24 lg:bottom-10 left-1/2 -translate-x-1/2 z-[200] w-42/50 max-w-[90vw]">
            <div className={`relative flex items-center justify-between gap-4 bg-surface-darker/90 backdrop-blur-xl border border-white/10 text-white px-5 py-4 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.35)] animate-slide-up ${isUrgent ? 'ring-2 ring-amber-300/60' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        {isUrgent && <div className="absolute inset-0 rounded-full bg-amber-400/10 animate-pulse" />}
                        <svg width="40" height="40" className="rotate-[-90deg]">
                            <circle
                                cx="20"
                                cy="20"
                                r={circleRadius}
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="4"
                                fill="transparent"
                            />
                            <circle
                                cx="20"
                                cy="20"
                                r={circleRadius}
                                stroke={isUrgent ? '#f87171' : '#38bdf8'}
                                strokeWidth="4"
                                fill="transparent"
                                strokeDasharray={circleCircumference}
                                strokeDashoffset={strokeDashOffset}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[18px] text-white"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/></svg></span>
                    </div>
                    <div className="flex flex-col">
                        <p className="font-black text-sm leading-tight">Deleted</p>
                        <p className="text-[11px] text-gray-300 truncate max-w-[160px] md:max-w-[260px]">{undoState.item.title}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold tracking-wide ${isUrgent ? 'text-amber-100' : 'text-gray-300'}`}>{Math.ceil((progress / 100) * UNDO_WINDOW_MS / 1000)}s</span>
                    <button onClick={handleUndo} className={`text-sm font-black px-4 py-2 rounded-full border transition-all active:scale-95 ${isUrgent ? 'bg-amber-500/20 border-amber-300 text-amber-100 hover:bg-amber-500/30' : 'bg-primary/15 border-primary/25 text-primary hover:bg-primary/25'}`}>UNDO</button>
                    <button onClick={clearUndo} className="size-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><span aria-hidden="true" className="material-symbols-outlined text-lg">close</span></button>
                </div>
            </div>
        </div>
    );
};

export default UndoSnackbar;
