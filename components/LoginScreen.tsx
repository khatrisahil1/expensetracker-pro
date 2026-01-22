
import React, { useState, useEffect } from 'react';
import { useStore } from '../context/Store';

const LoginScreen: React.FC = () => {
  const { login, signup, googleLogin, loginWithProvider, enableDemo, resetPassword } = useStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      // Sync theme after successful login/signup
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') setError("Invalid email or password.");
      else if (err.code === 'auth/email-already-in-use') setError("Email already in use.");
      else if (err.code === 'auth/weak-password') setError("Password should be at least 6 characters.");
      else setError("Authentication failed. Check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetEmail) return;
      setResetStatus('sending');
      try {
          await resetPassword(resetEmail);
          setResetStatus('sent');
          setTimeout(() => {
              setShowResetModal(false);
              setResetStatus('idle');
              setResetEmail('');
          }, 2000);
      } catch (e) {
          setResetStatus('error');
      }
  };

  return (
    <div className="min-h-screen w-full flex bg-white text-slate-900 dark:bg-[#050505] dark:text-white font-display overflow-hidden relative transition-colors duration-500 relative">
      
      {/* Background Ambience with Gaussian Blur Animation */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000"></div>
      <div className="absolute top-[30%] left-[20%] w-[30vw] h-[30vw] bg-purple-900/15 rounded-full blur-[80px] pointer-events-none animate-pulse delay-500"></div>
      <div className="absolute bottom-[40%] left-[50%] w-[40vw] h-[40vw] bg-cyan-900/10 rounded-full blur-[100px] pointer-events-none animate-pulse delay-1500"></div>

      {/* Background Ambience */}
      
      <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000"></div>

      {/* Reset Password Modal */}
      {showResetModal && (
          <div className="fixed inset-0 z-[100] bg-white/60 dark:bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 border border-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-slide-up relative">
                  <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                  <h3 className="text-xl font-bold mb-2">Reset Password</h3>
                  <p className="text-sm text-gray-400 mb-6">Enter your email to receive a recovery link.</p>
                  
                  {resetStatus === 'sent' ? (
                      <div className="flex flex-col items-center gap-4 py-4">
                          <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center"><span className="material-symbols-outlined">check</span></div>
                          <p className="text-emerald-500 font-bold text-sm">Link Sent Successfully!</p>
                      </div>
                  ) : (
                      <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                          <input 
                            type="email" 
                            value={resetEmail} 
                            onChange={e => setResetEmail(e.target.value)} 
                            className="w-full bg-white/60 dark:bg-black/30 border border-white/10 rounded-xl p-4 text-sm font-bold focus:border-emerald-500/50 outline-none" 
                            placeholder="Enter email address" 
                            autoFocus
                          />
                          {resetStatus === 'error' && <p className="text-red-400 text-xs font-bold">Failed to send link. Try again.</p>}
                          <button disabled={resetStatus === 'sending'} className="w-full bg-white text-black py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors">
                              {resetStatus === 'sending' ? 'Sending...' : 'Send Link'}
                          </button>
                      </form>
                  )}
              </div>
          </div>
      )}

      {/* Main Container */}
      <div className="w-full h-full flex flex-col items-center justify-center p-6 relative z-10">
        
        {/* Card */}
        <div className="w-full max-w-[420px] bg-[#f3f4f5] dark:bg-[#0b0b0c] backdrop-blur-5xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden animate-slide-up">
            
            {/* Top Shine */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50"></div>

            <div className="flex flex-col items-center text-center mb-10">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 shadow-glow">
                    <span className="material-symbols-outlined text-3xl text-black">account_balance_wallet</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight mb-2">ExpenseTracker Pro</h1>
                <p className="text-gray-400 text-sm font-medium">Master your financial universe.</p>
            </div>

            {/* Toggle Switch */}
            <div className="relative bg-white/20 dark:bg-black/40 rounded-xl p-1 flex mb-8 border border-white/10">
                <div 
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/20 rounded-lg transition-all duration-300 ease-out border border-white/10 ${isSignUp ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                ></div>
                <button onClick={() => setIsSignUp(false)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest relative z-10 transition-colors  ${!isSignUp ? 'text-grey' : 'text-gray-500 hover:text-gray-300'}`}>Sign In</button>
                <button onClick={() => setIsSignUp(true)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest relative z-10 transition-colors ${isSignUp ? 'text-grey' : 'text-gray-500 hover:text-gray-300'}`}>Sign Up</button>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center animate-fade-in">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                        <span className="material-symbols-outlined text-xl">mail</span>
                    </div>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address" 
                        className="w-full bg-white/60 dark:bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        required 
                    />
                </div>
                
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                        <span className="material-symbols-outlined text-xl">lock</span>
                    </div>
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password" 
                        className="w-full bg-white/60 dark:bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-sm font-bold text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        required 
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                </div>

                {!isSignUp && (
                    <div className="flex items-center justify-between text-xs mt-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`size-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                {rememberMe && <span className="material-symbols-outlined text-[10px] text-black font-bold">check</span>}
                            </div>
                            <input type="checkbox" className="hidden" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
                            <span className="text-gray-400 group-hover:text-gray-300 font-medium select-none">Remember me</span>
                        </label>
                        <button type="button" onClick={() => setShowResetModal(true)} className="text-gray-400 hover:text-emerald-400 font-bold transition-colors">Forgot Password?</button>
                    </div>
                )}

                <button 
                    disabled={isSubmitting}
                    className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all transform active:scale-[0.98] shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : (isSignUp ? "Create Account" : "Log In")}
                </button>
            </form>

            <div className="mt-8 flex flex-col gap-4">
                <div className="flex items-center gap-4 w-full">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Or continue with</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>

                {/* Social Login Grid */}
                <div className="grid grid-cols-4 gap-3">
                    <button onClick={googleLogin} className="col-span-1 bg-white hover:bg-gray-200 text-black py-3 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Google">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    </button>
                    
                    <button onClick={() => loginWithProvider('GitHub')} className="col-span-1 bg-[#24292e] hover:bg-[#2f363d] text-white py-3 rounded-xl flex items-center justify-center transition-colors border border-white/10" title="GitHub">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </button>

                    <button onClick={() => loginWithProvider('Apple')} className="col-span-1 bg-white hover:bg-gray-200 text-black py-3 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Apple">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.63-3.12 1.88-2.6 5.75.35 7.1-.93 1.98-2.13 3.32-2.4 4.28zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                    </button>

                    <button onClick={() => loginWithProvider('Facebook')} className="col-span-1 bg-[#1877F2] hover:bg-[#166fe5] text-white py-3 rounded-xl flex items-center justify-center transition-colors shadow-sm" title="Facebook">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </button>
                </div>

                <button onClick={() => loginWithProvider('Phone')} className="w-full py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">phone_iphone</span> Continue with Phone
                </button>

                <button onClick={enableDemo} className="w-full py-3 rounded-xl border border-white/10 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-xs font-bold uppercase tracking-widest">
                    Guest Mode
                </button>
                
            </div>
            
        </div>        
        <p className="mt-4 text-gray-600 text-xs font-medium">Secured by 256-bit encryption. </p>
        
      </div>
      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        className="fixed bottom-5 right-5 z-[200] size-12 rounded-full 
                   bg-white/90 dark:bg-zinc-900/80 
                   border border-black/10 dark:border-white/10
                   flex items-center justify-center 
                   shadow-xl backdrop-blur 
                   hover:scale-110 active:scale-95 transition-all duration-500"
        aria-label="Toggle theme"
      >
        <span
          className={`material-symbols-outlined absolute text-xl transition-all duration-500 ${
            theme === 'dark'
              ? 'rotate-0 scale-100 text-yellow-400'
              : 'rotate-180 scale-0'
          }`}
        >
          dark_mode
        </span>
        <span
          className={`material-symbols-outlined absolute text-xl transition-all duration-500 ${
            theme === 'light'
              ? 'rotate-0 scale-100 text-orange-400'
              : 'rotate-180 scale-0'
          }`}
        >
          light_mode
        </span>
      </button>
    </div>
  );
};

export default LoginScreen;
