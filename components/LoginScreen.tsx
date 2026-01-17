
import React, { useState } from 'react';
import { useStore } from '../context/Store';

const LoginScreen: React.FC = () => {
  const { login, signup, googleLogin, enableDemo } = useStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="min-h-screen w-full flex bg-[#050505] text-white font-display overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000"></div>

      {/* Main Container */}
      <div className="w-full h-full flex flex-col items-center justify-center p-6 relative z-10">
        
        {/* Card */}
        <div className="w-full max-w-[420px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden animate-slide-up">
            
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
            <div className="relative bg-black/40 rounded-xl p-1 flex mb-8 border border-white/5">
                <div 
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-lg transition-all duration-300 ease-out border border-white/10 ${isSignUp ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                ></div>
                <button onClick={() => setIsSignUp(false)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest relative z-10 transition-colors ${!isSignUp ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Sign In</button>
                <button onClick={() => setIsSignUp(true)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest relative z-10 transition-colors ${isSignUp ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>Sign Up</button>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center animate-fade-in">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                        <span className="material-symbols-outlined text-xl">alternate_email</span>
                    </div>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address" 
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        required 
                    />
                </div>
                
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                        <span className="material-symbols-outlined text-xl">lock</span>
                    </div>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password" 
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        required 
                    />
                </div>

                <button 
                    disabled={isSubmitting}
                    className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-all transform active:scale-[0.98] shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : (isSignUp ? "Create Account" : "LogIN")}
                </button>
            </form>

            <div className="mt-8 flex flex-col gap-4">
                <div className="flex items-center gap-4 w-full">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Or continue with</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <button onClick={googleLogin} className="w-full bg-white text-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    Continue with Google
                </button>

                <button onClick={enableDemo} className="w-full py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
                    Demo Mode
                </button>
            </div>

        </div>
        
        <p className="mt-8 text-gray-600 text-xs font-medium">Secured by 256-bit encryption. Private & Local.</p>
      </div>
    </div>
  );
};

export default LoginScreen;
