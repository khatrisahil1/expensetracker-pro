
import React, { useState } from 'react';
import { useStore } from '../context/Store';

const DotLottiePlayer = 'dotlottie-player' as any;

const OnboardingScreen: React.FC = () => {
  const { completeOnboarding, user } = useStore();
  const [step, setStep] = useState(1);
  
  // Form State
  const [formData, setFormData] = useState({
      name: user?.displayName || '',
      age: '',
      gender: '',
      currency: 'INR',
      initialBalance: '',
      monthlyIncome: '',
      monthlyBudget: '',
      financialGoal: 'tracking' // tracking, saving, debt
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleFinalize = async () => {
      setIsSubmitting(true);
      await completeOnboarding({
          name: formData.name,
          age: formData.age,
          gender: formData.gender,
          currency: formData.currency,
          initialBalance: parseFloat(formData.initialBalance || '0'),
          income: parseFloat(formData.monthlyIncome || '0'),
          budget: parseFloat(formData.monthlyBudget || '0'),
          goal: formData.financialGoal
      });
  };

  const currencySymbol = formData.currency === 'USD' ? '$' : formData.currency === 'EUR' ? '€' : formData.currency === 'GBP' ? '£' : '₹';

  return (
    <div className="h-screen w-full bg-[#050505] text-white flex items-center justify-center relative overflow-hidden font-display">
        
        {/* Progress Bar Top */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
            <div 
                className="h-full bg-emerald-500 transition-all duration-700 ease-out" 
                style={{ width: `${(step / 3) * 100}%` }}
            ></div>
        </div>

        {/* Dynamic Background */}
        <div className={`absolute inset-0 transition-all duration-1000 ${step === 1 ? 'bg-gradient-to-br from-emerald-900/10 via-black to-black' : step === 2 ? 'bg-gradient-to-bl from-blue-900/10 via-black to-black' : 'bg-black'}`}></div>

        <div className="w-full max-w-lg z-10 p-6">
            
            {/* STEP 1: PERSONAL DETAILS */}
            {step === 1 && (
                <div className="flex flex-col gap-8 animate-slide-up">
                    <div>
                        <span className="text-emerald-500 font-bold uppercase tracking-widest text-xs mb-2 block">Step 1 of 3</span>
                        <h1 className="text-4xl font-black mb-2">Who are you?</h1>
                        <p className="text-gray-400">Let's personalize your experience.</p>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Display Name</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={e => updateField('name', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl p-4 text-lg font-bold outline-none focus:border-emerald-500/50 transition-all"
                                placeholder="e.g. Alex"
                                autoFocus
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Age</label>
                                <input 
                                    type="number" 
                                    value={formData.age}
                                    onChange={e => updateField('age', e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-lg font-bold outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="25"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gender</label>
                                <select 
                                    value={formData.gender}
                                    onChange={e => updateField('gender', e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-lg font-bold outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer text-white"
                                >
                                    <option value="" disabled>Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Non-binary">Non-binary</option>
                                    <option value="Prefer not to say">Hidden</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleNext}
                        disabled={!formData.name || !formData.age}
                        className="mt-4 w-full py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow"
                    >
                        Continue
                    </button>
                </div>
            )}

            {/* STEP 2: FINANCIAL DETAILS */}
            {step === 2 && (
                <div className="flex flex-col gap-6 animate-slide-up">
                    <button onClick={handleBack} className="text-gray-500 hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-widest w-fit"><span className="material-symbols-outlined text-sm">arrow_back</span> Back</button>
                    
                    <div>
                        <h1 className="text-3xl font-black mb-2">Financial Profile</h1>
                        <p className="text-gray-400 text-sm">Set your baseline. You can adjust this anytime.</p>
                    </div>

                    {/* Currency Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {['INR', 'USD', 'EUR', 'GBP'].map(c => (
                            <button 
                                key={c}
                                onClick={() => updateField('currency', c)}
                                className={`flex-1 py-3 rounded-xl border font-black text-sm transition-all ${formData.currency === c ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Balance</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currencySymbol}</span>
                                <input 
                                    type="number"
                                    value={formData.initialBalance}
                                    onChange={e => updateField('initialBalance', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-10 text-lg font-bold outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monthly Income</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currencySymbol}</span>
                                <input 
                                    type="number"
                                    value={formData.monthlyIncome}
                                    onChange={e => updateField('monthlyIncome', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-10 text-lg font-bold outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monthly Spending Budget</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currencySymbol}</span>
                                <input 
                                    type="number"
                                    value={formData.monthlyBudget}
                                    onChange={e => updateField('monthlyBudget', e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-10 text-lg font-bold outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Primary Goal</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'saving', label: 'Save', icon: 'savings' },
                                { id: 'debt', label: 'Kill Debt', icon: 'money_off' },
                                { id: 'tracking', label: 'Track', icon: 'query_stats' }
                            ].map(g => (
                                <button 
                                    key={g.id}
                                    onClick={() => updateField('financialGoal', g.id)}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${formData.financialGoal === g.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
                                >
                                    <span className="material-symbols-outlined text-2xl">{g.icon}</span>
                                    <span className="text-xs font-bold uppercase">{g.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleNext}
                        className="mt-2 w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all shadow-glow"
                    >
                        Save
                    </button>
                </div>
            )}

            {/* STEP 3: WELCOME */}
            {step === 3 && (
                <div className="flex flex-col items-center text-center gap-8 animate-fade-in">
                    
                    <div className="w-[300px] h-[300px] relative">
                        <DotLottiePlayer
                            src="https://lottie.host/1c19f93f-8efa-40f7-aa73-f3eeada945f3/uXwZQqH0Z8.lottie"
                            background="transparent"
                            speed={1}
                            style={{ width: "100%", height: "100%" }}
                            loop={true}
                            autoplay={true}
                        />
                    </div>

                    <div>
                        <h1 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">You're All Set!</h1>
                        <p className="text-gray-400 max-w-xs mx-auto">Your financial vault is ready. We've set up your dashboard based on your goals.</p>
                    </div>

                    <button 
                        onClick={handleFinalize}
                        disabled={isSubmitting}
                        className="w-full max-w-xs py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-[0_0_40px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">sync</span> Setting up...
                            </>
                        ) : (
                            "Enter Dashboard"
                        )}
                    </button>
                </div>
            )}

        </div>
    </div>
  );
};

export default OnboardingScreen;
