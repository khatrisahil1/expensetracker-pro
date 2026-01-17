import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';

export const BiometricLockScreen = () => {
    const { verifyBiometric } = useStore();
    const [status, setStatus] = useState<'idle' | 'verifying' | 'failed'>('idle');

    useEffect(() => {
        // Auto-attempt unlock on mount
        handleUnlock();
    }, []);

    const handleUnlock = async () => {
        setStatus('verifying');
        const success = await verifyBiometric();
        if (!success) {
            setStatus('failed');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-xl">
             <div className="flex flex-col items-center gap-8 max-w-sm w-full text-center">
                 
                 <div className={`size-32 rounded-full flex items-center justify-center transition-all duration-500 ${status === 'failed' ? 'bg-red-500/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                     <span className="material-symbols-outlined text-6xl">
                         {status === 'failed' ? 'error' : 'fingerprint'}
                     </span>
                 </div>
                 
                 <div>
                     <h1 className="text-3xl font-bold text-text-light-main dark:text-text-dark-main mb-2">App Locked</h1>
                     <p className="text-text-light-muted dark:text-text-dark-muted text-lg">
                         {status === 'failed' ? 'Authentication failed. Please try again.' : 'Authentication required to access ExpenseTracker'}
                     </p>
                 </div>

                 <button 
                    onClick={handleUnlock}
                    className="w-full py-4 bg-primary text-[#131811] font-bold rounded-2xl shadow-glow hover:bg-primary-hover transition-all flex items-center justify-center gap-2 transform active:scale-95 text-lg"
                 >
                     <span className="material-symbols-outlined">lock_open</span> 
                     {status === 'failed' ? 'Try Again' : 'Unlock Now'}
                 </button>
             </div>
        </div>
    );
};