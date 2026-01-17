
import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/Store';

export const PinLockScreen = () => {
    const { unlockApp, user, login, setAppPin, userSettings, verifyBiometric } = useStore();
    const [enteredPin, setEnteredPin] = useState('');
    const [error, setError] = useState(false);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [isBioVerifying, setIsBioVerifying] = useState(false);
    
    const [showResetModal, setShowResetModal] = useState(false);
    const [showSetPinModal, setShowSetPinModal] = useState(false);
    const [newPin, setNewPin] = useState('');
    
    const [resetPassword, setResetPassword] = useState('');
    const [resetError, setResetError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Auto-trigger biometric if enabled
    useEffect(() => {
        if (userSettings?.biometricEnabled) {
            handleBiometricUnlock();
        }
    }, [userSettings?.biometricEnabled]);

    const handleBiometricUnlock = async () => {
        setIsBioVerifying(true);
        const success = await verifyBiometric();
        setIsBioVerifying(false);
        if (!success) {
            // Optional: Shake animation or feedback
        }
    };

    const handlePress = useCallback((num: string) => {
        setEnteredPin(prev => {
            if (prev.length < 4) {
                const updated = prev + num;
                if (navigator.vibrate) navigator.vibrate(40);
                return updated;
            }
            return prev;
        });
    }, []);

    const handleBackspace = useCallback(() => {
        setEnteredPin(prev => {
            if (prev.length > 0) {
                if (navigator.vibrate) navigator.vibrate(20);
                return prev.slice(0, -1);
            }
            return prev;
        });
    }, []);

    useEffect(() => {
        if (enteredPin.length === 4) {
            const timer = setTimeout(() => {
                const success = unlockApp(enteredPin);
                if (!success) {
                    setError(true);
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    setTimeout(() => { 
                        setEnteredPin(''); 
                        setError(false); 
                    }, 600);
                }
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [enteredPin, unlockApp]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showResetModal || showSetPinModal) return;
            if (/^[0-9]$/.test(e.key)) {
                setActiveKey(e.key);
                handlePress(e.key);
                setTimeout(() => setActiveKey(null), 150);
            } else if (e.key === 'Backspace') {
                setActiveKey('backspace');
                handleBackspace();
                setTimeout(() => setActiveKey(null), 150);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePress, handleBackspace, showResetModal, showSetPinModal]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError('');
        setIsVerifying(true);
        try {
            if (user?.email) {
                await login(user.email, resetPassword);
                setShowResetModal(false);
                setShowSetPinModal(true);
            }
        } catch (err: any) {
            setResetError('Verification failed.');
        } finally {
            setIsVerifying(false);
        }
    };

    const renderKey = (value: string, icon?: string) => {
        const isActive = activeKey === value;
        return (
            <button 
                key={value}
                onMouseDown={() => setActiveKey(value)}
                onMouseUp={() => setActiveKey(null)}
                onMouseLeave={() => setActiveKey(null)}
                onClick={() => value === 'backspace' ? handleBackspace() : handlePress(value)}
                className={`
                    size-16 md:size-20 rounded-full text-2xl font-black transition-all duration-100 flex items-center justify-center shadow-sm select-none outline-none
                    ${value === 'backspace' ? 'text-text-light-muted dark:text-text-dark-muted hover:text-danger' : 'bg-gray-100 dark:bg-surface-darker text-text-light-main dark:text-text-dark-main'}
                    ${isActive ? 'scale-90 bg-primary/20 !text-primary shadow-glow' : 'active:scale-95'}
                `}
            >
                {icon ? <span className="material-symbols-outlined text-3xl">{icon}</span> : value}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-xl">
             {showResetModal && (
                 <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                     <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-slide-up">
                         <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main mb-6">Reset PIN</h3>
                         <form onSubmit={handleReset} className="flex flex-col gap-4">
                             <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-full bg-background-light dark:bg-surface-darker text-text-light-main dark:text-text-dark-main p-3 rounded-xl border border-border-light dark:border-border-dark focus:border-primary outline-none" placeholder="Account Password" />
                             {resetError && <p className="text-danger text-xs font-bold">{resetError}</p>}
                             <div className="flex gap-3">
                                 <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 py-3 rounded-xl font-bold text-text-light-muted">Cancel</button>
                                 <button type="submit" disabled={isVerifying} className="flex-1 py-3 rounded-xl font-bold bg-primary text-black flex items-center justify-center gap-2">
                                     {isVerifying && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                                     Verify
                                 </button>
                             </div>
                         </form>
                     </div>
                 </div>
             )}

             {showSetPinModal && (
                 <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                     <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-slide-up flex flex-col gap-6 text-center">
                         <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Set New PIN</h3>
                         <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,''))} className="bg-gray-100 dark:bg-surface-darker text-center text-4xl tracking-widest p-4 rounded-2xl w-full border border-border-light dark:border-border-dark focus:border-primary outline-none" placeholder="••••" />
                         <button onClick={() => { setAppPin(newPin); unlockApp(newPin); }} className="w-full py-3 rounded-xl font-bold bg-primary text-black shadow-glow">Save & Unlock</button>
                     </div>
                 </div>
             )}

             <div className="flex flex-col items-center gap-10 max-w-sm w-full text-center relative z-10">
                 <div className="mb-4">
                     <div className={`size-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mx-auto mb-8 text-primary shadow-glow transition-transform duration-500 ${isBioVerifying ? 'animate-pulse scale-110' : 'animate-float'}`}>
                        <span className="material-symbols-outlined text-5xl">lock_person</span>
                     </div>
                     <h1 className="text-3xl font-black text-text-light-main dark:text-text-dark-main tracking-tight uppercase">App Locked</h1>
                     <p className="text-text-light-muted dark:text-text-dark-muted text-sm font-bold mt-2 tracking-widest opacity-60">SECURITY AUTHENTICATION REQUIRED</p>
                 </div>

                 <div className={`flex gap-8 mb-4 h-12 items-center ${error ? 'animate-shake' : ''}`}>
                     {[0, 1, 2, 3].map(i => {
                         const isFilled = i < enteredPin.length;
                         return (
                            <div key={i} className={`size-5 rounded-full transition-all duration-300 ease-out border-2 ${isFilled ? 'bg-primary border-primary scale-125 shadow-[0_0_15px_rgba(46,204,113,0.8)]' : 'bg-transparent border-gray-300 dark:border-gray-700 scale-100'}`} style={{ transitionDelay: isFilled ? '0ms' : '50ms' }}></div>
                         );
                     })}
                 </div>

                 <div className="grid grid-cols-3 gap-6 w-full max-w-[300px]">
                     {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => renderKey(num.toString()))}
                     <div className="flex items-center justify-center">
                         <button 
                            onClick={() => setShowResetModal(true)} 
                            className="text-xs font-black text-text-light-muted hover:text-primary transition-colors uppercase tracking-widest active:scale-90"
                        >
                            Reset
                        </button>
                     </div>
                     {renderKey("0")}
                     {renderKey("backspace", "backspace")}
                 </div>

                 {/* Biometric Trigger if enabled */}
                 {userSettings?.biometricEnabled && (
                     <button 
                        onClick={handleBiometricUnlock}
                        className="mt-6 text-primary flex items-center gap-2 font-bold uppercase tracking-widest text-xs hover:bg-primary/10 px-4 py-2 rounded-full transition-colors"
                     >
                         <span className="material-symbols-outlined">fingerprint</span> Use Biometric
                     </button>
                 )}
             </div>

             <style>{`
                @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-12px); } 40%, 80% { transform: translateX(12px); } }
                .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
             `}</style>
        </div>
    );
};
