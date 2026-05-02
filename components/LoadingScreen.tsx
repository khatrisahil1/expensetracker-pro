import React, { useState, useEffect } from 'react';
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const LOADING_MESSAGES = [
    "Preparing your financial cockpit...",
    "Syncing with encrypted bank vaults...",
    "Analyzing spending patterns with AI...",
    "Generating your monthly health score...",
    "Optimizing tax-saving opportunities...",
    "Add your cards for instant insights...",
    "Preparing real-time budget alerts...",
    "Securing your financial data...",
    "Loading your personalized dashboard...",
    "Almost there... stay curious!"
];

export const LoadingScreen: React.FC = () => {
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[1000] bg-[#0E1111] flex flex-col items-center justify-center p-8 overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
                {/* Lottie Container */}
                <div className="w-64 h-64 md:w-80 md:h-80 mb-12 drop-shadow-[0_0_30px_rgba(46,204,113,0.15)]">
                    <DotLottieReact
                        src="https://lottie.host/08d2cad2-35de-4cf4-94b3-7e20923a3ca6/5hOQzGfL1Z.lottie"
                        autoplay
                        loop
                    />
                </div>

                {/* Progress Container */}
                <div className="w-full space-y-6">
                    <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
                        {/* Indeterminate Shimmer */}
                        <div className="absolute inset-0 bg-primary/20 animate-pulse" />
                        <div 
                            className="h-full bg-primary shadow-glow rounded-full transition-all duration-700 ease-out animate-shimmer"
                            style={{ width: '30%' }}
                        />
                    </div>

                    {/* Animated Text */}
                    <div className="h-10 flex flex-col items-center justify-center">
                        <p key={msgIndex} className="text-sm font-black text-primary/80 uppercase tracking-[0.2em] animate-slide-up text-center">
                            {LOADING_MESSAGES[msgIndex]}
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-150%) scaleX(0.5); }
                    50% { transform: translateX(100%) scaleX(1.5); }
                    100% { transform: translateX(250%) scaleX(0.5); }
                }
                .animate-shimmer {
                    animation: shimmer 2.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
                }
            `}</style>
        </div>
    );
};

export default LoadingScreen;
