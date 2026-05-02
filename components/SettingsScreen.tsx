
import React, { useState, useEffect } from 'react';
import { useStore, Transaction } from '../context/Store';
import { DotLottieReact } from "@lottiefiles/dotlottie-react";


const SettingsScreen: React.FC = () => {
  const { logout, user, updateUserSettings, userSettings, toggleTheme, updatePassword, deleteAccount, setAppPin, removeAppPin, sendVerificationEmail, refreshUser, transactions, addTransaction, clearAllTransactions } = useStore();
  const [activeTab, setActiveTab] = useState('general');
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const stats = React.useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');
    
    const totalExp = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalInc = income.reduce((sum, t) => sum + t.amount, 0);
    
    const health = totalInc > 0 ? Math.min(100, Math.max(0, Math.round(((totalInc - totalExp) / totalInc) * 100))) : 0;
    
    const catMap: Record<string, number> = {};
    expenses.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    const topCat = Object.entries(catMap).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

    let persona = "Newcomer";
    if (health > 40) persona = "Wealth Builder";
    else if (health > 20) persona = "Savvy Saver";
    else if (health > 0) persona = "Balanced";
    else if (totalExp > 0) persona = "Heavy Spender";

    return { health, topCat, persona, totalExp, totalInc };
  }, [transactions]);

  // Pro Modal State
  const [showProModal, setShowProModal] = useState(false);

  // PIN Setup State
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState(1); // 1: Enter, 2: Confirm
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // FAQ State
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Local state for account form
  const [accountForm, setAccountForm] = useState({
      name: '',
      email: '',
      gender: '',
      birthday: '',
      location: '',
      avatar: ''
  });
  
  // Local state for password
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });




  // List states
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [newItems, setNewItems] = useState({ pay: '', exp: '', inc: '' });

  // Notification settings local state
  const [notifPrefs, setNotifPrefs] = useState({
      dailyCheckIn: true,
      budgetThresholds: true,
      monthlyInsights: true,
      tipsAndTricks: true
  });
  const [notifTune, setNotifTune] = useState('Aurora');

  useEffect(() => {
    if (userSettings) {
      setAccountForm({
          name: userSettings.displayName || '',
          email: user?.email || '',
          gender: userSettings.gender || '',
          birthday: userSettings.birthday || '',
          location: userSettings.location || '',
          avatar: userSettings.avatar || ''
      });
      setPaymentMethods(userSettings.paymentMethods || []);
      setExpenseCategories(userSettings.expenseCategories || []);
      setIncomeCategories(userSettings.incomeCategories || []);
      if (userSettings.notificationPrefs) setNotifPrefs(userSettings.notificationPrefs);
      if (userSettings.notificationTune) setNotifTune(userSettings.notificationTune);
    }


  }, [userSettings, user]);



  const showToast = (msg: string) => {
      setSaveMessage(msg);
      setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleAccountSave = async () => {
      setIsSaving(true);
      await updateUserSettings({
          displayName: accountForm.name,
          gender: accountForm.gender,
          birthday: accountForm.birthday,
          location: accountForm.location,
          avatar: accountForm.avatar
      });
      setIsSaving(false);
      showToast("Profile Updated");
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
             resolve(img.src);
          }
        };
      };
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const compressed = await compressImage(file);
            setAccountForm(prev => ({...prev, avatar: compressed}));
        } catch (e) {
            console.error("Compression failed", e);
        }
    }
  };

  const handlePassUpdate = async () => {
      if (passForm.new !== passForm.confirm) return alert("Passwords don't match");
      try {
          setIsSaving(true);
          await updatePassword(passForm.new);
          setPassForm({ current: '', new: '', confirm: '' });
          showToast("Password Updated");
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSaving(false);
      }
  };



  const handleListSave = async () => {
      setIsSaving(true);
      await updateUserSettings({ paymentMethods, expenseCategories, incomeCategories });
      setIsSaving(false);
      showToast("Lists Refreshed");
  };

  const addListItem = (type: 'pay' | 'exp' | 'inc') => {
      const val = newItems[type].trim();
      if (!val) return;
      if (type === 'pay') setPaymentMethods([...paymentMethods, val]);
      else if (type === 'exp') setExpenseCategories([...expenseCategories, val]);
      else setIncomeCategories([...incomeCategories, val]);
      setNewItems({ ...newItems, [type]: '' });
  };

  const removeListItem = (type: 'pay' | 'exp' | 'inc', val: string) => {
      if (type === 'pay') setPaymentMethods(paymentMethods.filter(i => i !== val));
      else if (type === 'exp') setExpenseCategories(expenseCategories.filter(i => i !== val));
      else setIncomeCategories(incomeCategories.filter(i => i !== val));
  };


  // --- DATA HANDLERS ---
  const handleExportData = (format: 'csv' | 'json') => {
      const fileName = `expense_tracker_data_${new Date().toISOString().split('T')[0]}`;
      
      if (format === 'json') {
          const jsonString = JSON.stringify(transactions, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.json`;
          a.click();
      } else {
          // CSV Export
          const headers = ['Date', 'Title', 'Amount', 'Type', 'Category', 'Method', 'Note'];
          const csvContent = [
              headers.join(','),
              ...transactions.map(tx => {
                  const escape = (str: string | undefined) => `"${(str || '').replace(/"/g, '""')}"`;
                  return [
                      tx.date, 
                      escape(tx.title), 
                      tx.amount, 
                      tx.type, 
                      tx.category, 
                      escape(tx.paymentMethod),
                      escape(tx.note)
                  ].join(',');
              })
          ].join('\n');

          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.csv`;
          a.click();
      }
      showToast(`Exported as ${format.toUpperCase()}`);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          const rows = text.split('\n').slice(1); // Skip header
          let count = 0;
          setIsSaving(true);
          
          for (const row of rows) {
              const cols = row.split(','); // Simple CSV split
              if (cols.length >= 5) {
                  const date = cols[0]?.trim();
                  const title = cols[1]?.replace(/"/g, '').trim();
                  const amount = parseFloat(cols[2]);
                  const typeStr = cols[3]?.trim().toLowerCase();
                  const type = (typeStr === 'income' || typeStr === 'expense') ? typeStr : 'expense';
                  const category = cols[4]?.trim();
                  
                  if (!isNaN(amount) && title && date) {
                      await addTransaction({
                          date, title, amount, type, category,
                          paymentMethod: cols[5]?.replace(/"/g, '').trim() || 'Imported',
                          note: cols[6]?.replace(/"/g, '').trim() || ''
                      });
                      count++;
                  }
              }
          }
          setIsSaving(false);
          showToast(`Imported ${count} transactions`);
      };
      reader.readAsText(file);
      // Reset input
      e.target.value = '';
  };

  const handleClearData = async () => {
      if (confirm("Are you sure? This will delete ALL transactions history forever. This cannot be undone.")) {
          setIsSaving(true);
          await clearAllTransactions();
          setIsSaving(false);
          showToast("All transactions deleted");
      }
  };

  // --- APP LOCK PIN SETUP LOGIC ---
  const handlePinToggle = async () => {
      // Logic for toggling: 
      // If PIN exists -> Remove it (via confirm)
      // If PIN doesn't exist -> Open setup modal
      
      if (userSettings?.appPin) {
          if (confirm("Disable App Lock? Your PIN will be removed.")) {
              await removeAppPin();
              showToast("App Lock Disabled");
          }
      } else {
          setPinSetupStep(1);
          setFirstPin('');
          setConfirmPin('');
          setShowPinSetup(true);
      }
  };

  const handleChangePin = () => {
      setPinSetupStep(1);
      setFirstPin('');
      setConfirmPin('');
      setShowPinSetup(true);
  };

  const handlePinKey = (val: string) => {
      const current = pinSetupStep === 1 ? firstPin : confirmPin;
      if (current.length >= 4) return;
      
      const updated = current + val;
      if (pinSetupStep === 1) {
          setFirstPin(updated);
          if (updated.length === 4) setPinSetupStep(2);
      } else {
          setConfirmPin(updated);
          if (updated.length === 4) {
              if (updated === firstPin) {
                  setAppPin(updated);
                  setShowPinSetup(false);
                  showToast("PIN Lock Updated");
              } else {
                  alert("PINs do not match. Restarting...");
                  setPinSetupStep(1);
                  setFirstPin('');
                  setConfirmPin('');
              }
          }
      }
  };

  // --- MFA BRIDGE LOGIC ---
  const handleMfaAction = async () => {
      if (user?.emailVerified) {
          return; // Already verified
      }
      try {
          await sendVerificationEmail();
          showToast("Verification Link Sent");
      } catch (e) {
          console.error(e);
          showToast("Failed to send link");
      }
  };

  const handleRefreshUser = async () => {
      await refreshUser();
      showToast("Account Status Refreshed");
  }

  const tabs = [
      { id: 'general', label: 'General', icon: 'tune' },
      { id: 'account', label: 'Account', icon: 'person' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications' },
      { id: 'security', label: 'Security', icon: 'lock' },
      { id: 'data', label: 'Data & Privacy', icon: 'database' },
      { id: 'about', label: 'Support', icon: 'support_agent' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 pb-32 min-h-screen relative">
      
      {/* --- PRO PLAN MODAL --- */}
      {showProModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md animate-fade-in" onClick={() => setShowProModal(false)}>
              <div className="bg-surface-light dark:bg-surface-dark border border-indigo-500/30 rounded-[3rem] w-full max-w-sm relative overflow-hidden shadow-2xl animate-slide-up flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
                  
                  {/* Confetti / Graphic Placeholder */}
                  <div className="w-full h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative flex items-center justify-center">
                      <DotLottieReact
                       src="https://lottie.host/548611e1-3f2c-47f1-bd7b-7f1261f6ab4d/Vg9bT4b9gq.lottie"
                       autoplay
                       loop={true}
                       className="w-full h-full scale-"
                      />
                  </div>

                  <div className="p-8 flex flex-col gap-4">
                      <h2 className="text-2xl font-black uppercase tracking-tight text-text-light-main dark:text-text-dark-main">Early Bird Special!</h2>
                      <p className="text-text-light-muted dark:text-text-dark-muted text-sm leading-relaxed">
                          You are one of our first users. As a thank you, the <span className="font-bold text-indigo-500">Pro Plan</span> is completely <span className="font-bold text-primary">FREE</span> for you, forever.
                      </p>
                      
                      <div className="bg-gray-100 dark:bg-surface-darker p-4 rounded-2xl flex flex-col gap-2 my-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-text-light-main dark:text-text-dark-main">
                              <span className="material-symbols-outlined text-green-500 text-base">check_circle</span> Unlimited Transactions
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-text-light-main dark:text-text-dark-main">
                              <span className="material-symbols-outlined text-green-500 text-base">check_circle</span> AI Financial Advisor
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-text-light-main dark:text-text-dark-main">
                              <span className="material-symbols-outlined text-green-500 text-base">check_circle</span> Advanced Analytics
                          </div>
                      </div>

                      <button onClick={() => setShowProModal(false)} className="w-full py-4 bg-primary text-[#131811] font-black uppercase tracking-widest rounded-2xl shadow-glow hover:bg-primary-hover transition-all active:scale-95">
                          Awesome!
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* PIN SETUP MODAL */}
      {showPinSetup && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-slide-up flex flex-col items-center gap-6">
                  <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-3xl">lock_open</span>
                  </div>
                  <div className="text-center">
                      <h3 className="text-xl font-bold uppercase tracking-tight mb-1">{pinSetupStep === 1 ? 'Set App PIN' : 'Confirm PIN'}</h3>
                      <p className="text-sm text-text-light-muted">Choose a 4-digit code to secure your app.</p>
                  </div>

                  <div className="flex gap-4 my-4">
                      {[0,1,2,3].map(i => {
                          const val = pinSetupStep === 1 ? firstPin : confirmPin;
                          const isFilled = i < val.length;
                          return (
                              <div key={i} className={`size-4 rounded-full border-2 transition-all ${isFilled ? 'bg-primary border-primary scale-125 shadow-glow' : 'border-gray-300 dark:border-border-dark'}`}></div>
                          );
                      })}
                  </div>

                  <div className="grid grid-cols-3 gap-4 w-full">
                      {[1,2,3,4,5,6,7,8,9, 'clear', 0, 'back'].map(k => {
                          if (k === 'clear') return <button key={k} onClick={() => pinSetupStep === 1 ? setFirstPin('') : setConfirmPin('')} className="size-14 rounded-full flex items-center justify-center text-xs font-bold opacity-40">CLR</button>;
                          if (k === 'back') return <button key={k} onClick={() => pinSetupStep === 1 ? setFirstPin(firstPin.slice(0,-1)) : setConfirmPin(confirmPin.slice(0,-1))} className="size-14 rounded-full flex items-center justify-center text-xs font-bold opacity-40"><span className="material-symbols-outlined">backspace</span></button>;
                          return (
                              <button key={k} onClick={() => handlePinKey(k.toString())} className="size-14 rounded-full bg-gray-100 dark:bg-surface-darker hover:bg-primary hover:text-black transition-all text-xl font-black">{k}</button>
                          );
                      })}
                  </div>

                  <button onClick={() => setShowPinSetup(false)} className="mt-4 text-xs font-bold text-text-light-muted uppercase tracking-widest hover:text-danger transition-colors">Cancel Setup</button>
              </div>
          </div>
      )}

      {/* Toast Notification */}
      {saveMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-primary text-black px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-glow animate-slide-up flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">verified</span>
              {saveMessage}
          </div>
      )}



      <div className="flex flex-col gap-1 mb-10 transition-all duration-500">
          <h3 className="text-3xl md:text-5xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">Profile</h3>
          <p className="text-text-light-muted dark:text-text-dark-muted text-sm md:text-lg">Your financial identity and preferences.</p>
      </div>

      {/* --- RICH PROFILE HEADER --- */}
      <div className="mb-12 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[3rem] p-8 md:p-12 shadow-sm relative overflow-hidden group transition-all duration-700">
          {/* Ambient Background Glow */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-colors duration-700" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
              {/* Avatar Section */}
              <div className="relative">
                  <div className="size-32 md:size-40 rounded-[2.5rem] bg-gray-100 dark:bg-surface-darker p-1 border-2 border-primary/20 shadow-xl overflow-hidden group-hover:border-primary/40 transition-colors">
                      {userSettings?.avatar ? (
                          <img src={userSettings.avatar} alt="Profile" className="w-full h-full object-cover rounded-[2.2rem]" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-5xl font-black">
                              {userSettings?.displayName?.[0] || user?.email?.[0] || "?"}
                          </div>
                      )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 size-10 bg-primary text-black rounded-2xl flex items-center justify-center shadow-lg border-4 border-surface-light dark:border-surface-dark">
                      <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
              </div>

              {/* Identity Info */}
              <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-4">
                  <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl md:text-4xl font-black text-text-light-main dark:text-text-dark-main uppercase tracking-tight leading-none">
                            {userSettings?.displayName || "Expense User"}
                        </h2>
                      </div>
                      <p className="text-text-light-muted dark:text-text-dark-muted font-bold text-lg opacity-60">{user?.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                      <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-2">
                          <span className="size-2 bg-primary rounded-full animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">{stats.persona}</span>
                      </div>
                      <div className="px-4 py-2 bg-gray-100 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-full flex items-center gap-2">
                          <span className="material-symbols-outlined text-base opacity-40">calendar_today</span>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Joined Jan 2024</span>
                      </div>
                  </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                  <div className="bg-gray-100 dark:bg-surface-darker p-5 rounded-3xl border border-border-light dark:border-border-dark flex flex-col gap-1 items-center md:items-start min-w-[140px]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Wallet Health</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-primary">{stats.health}%</span>
                        <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
                      </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-surface-darker p-5 rounded-3xl border border-border-light dark:border-border-dark flex flex-col gap-1 items-center md:items-start min-w-[140px]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Top Category</span>
                      <span className="text-xl font-black uppercase tracking-tight truncate max-w-[100px]">{stats.topCat}</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Navigation Sidebar */}
        <div className={`w-full lg:w-72 flex flex-col gap-3 ${showMobileContent ? 'hidden lg:flex' : 'flex'}`}>
          {tabs.map(tab => (
            <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id); setShowMobileContent(true); }} 
                className={`text-left px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-between group border backdrop-blur-sm ${activeTab === tab.id ? 'bg-primary text-[#131811] border-primary shadow-glow scale-[1.02]' : 'bg-surface-light/40 dark:bg-surface-dark/40 border-border-light dark:border-border-dark text-text-light-muted hover:border-primary/40 hover:bg-gray-50/50 dark:hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-4">
                  <span className={`material-symbols-outlined text-xl transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-[#131811]' : 'text-primary'}`}>{tab.icon}</span>
                  {tab.label}
              </div>
              <span className={`material-symbols-outlined transition-all ${activeTab === tab.id ? 'opacity-100' : 'opacity-20 group-hover:opacity-100 group-hover:translate-x-1'}`}>chevron_right</span>
            </button>
          ))}
          <div className="mt-8 pt-8 border-t border-border-light dark:border-border-dark flex flex-col gap-4">
              <button onClick={logout} className="flex items-center gap-4 px-6 py-4 text-danger font-black uppercase tracking-widest text-xs hover:bg-danger/10 rounded-2xl transition-all">
                  <span className="material-symbols-outlined">logout</span> Log Out
              </button>
          </div>
        </div>

        {/* Settings Content Area */}
        <div className={`flex-1 min-h-[600px] animate-fade-out ${!showMobileContent ? 'hidden lg:block' : 'block'}`}>
          <button onClick={() => setShowMobileContent(false)} className="lg:hidden flex items-center gap-2 mb-6 text-primary font-bold">
              <span className="material-symbols-outlined">chevron_left</span>
              Back
          </button>

          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-6 md:p-12 shadow-sm">
              
              {/* TAB: GENERAL */}
              {activeTab === 'general' && (
                  <div className="flex flex-col gap-12">
                      <section>
                          {/* Increased font size and contrast for subheading */}
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary dark:text-primary mb-8 border-b border-border-light dark:border-border-dark pb-3">App Preferences</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-text-light-muted ml-1">Currency</label>
                                  <select 
                                      value={userSettings?.currency} 
                                      onChange={e => updateUserSettings({ currency: e.target.value })}
                                      className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary"
                                  >
                                      <option value="INR">Indian Rupee (₹)</option>
                                      <option value="USD">US Dollar ($)</option>
                                      <option value="EUR">Euro (€)</option>
                                      <option value="GBP">Pound  (£)</option>
                                  </select>
                              </div>
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-text-light-muted ml-1">Language</label>
                                  <select 
                                      value={userSettings?.language} 
                                      onChange={e => updateUserSettings({ language: e.target.value })}
                                      className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary"
                                  >
                                      <option value="English">English</option>
                                      <option value="Spanish">Español</option>
                                      <option value="French">Français</option>
                                      <option value="German">Deutsch</option>
                                  </select>
                              </div>
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-text-light-muted ml-1">Date Format</label>
                                  <select 
                                      value={userSettings?.dateFormat} 
                                      onChange={e => updateUserSettings({ dateFormat: e.target.value as any })}
                                      className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary"
                                  >
                                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                  </select>
                              </div>
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-text-light-muted ml-1">App Theme</label>
                                  <div className="flex bg-gray-50 dark:bg-surface-darker p-1 rounded-xl border border-border-light dark:border-border-dark">
                                      <button onClick={toggleTheme} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${userSettings?.theme === 'light' ? 'bg-white shadow-sm text-primary' : 'text-text-light-muted'}`}>Light</button>
                                      <button onClick={toggleTheme} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${userSettings?.theme === 'dark' ? 'bg-surface-dark shadow-sm text-primary' : 'text-text-light-muted'}`}>Dark</button>
                                  </div>
                              </div>
                          </div>
                      </section>



                  <section>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-8 border-b border-border-light dark:border-border-dark pb-3">Custom Lists</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[420px] overflow-y-auto pr-2">
                          {([
                            { key: 'exp', label: 'Expense Categories', list: expenseCategories },
                            { key: 'inc', label: 'Income Sources', list: incomeCategories },
                            { key: 'pay', label: 'Settlement Channels', list: paymentMethods }
                          ] as const).map(item => (
                              <div key={item.key} className="flex flex-col gap-4">
                                  <label className="text-xs font-black uppercase tracking-widest text-text-light-muted opacity-60">{item.label}</label>
                                  <div className="flex flex-wrap gap-2">
                                      {item.list.map(v => (
                                          <div key={v} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-surface-darker border border-border-light dark:border-border-dark text-[11px] font-bold group hover:border-danger/30 transition-all">
                                              {v}
                                              <button onClick={() => removeListItem(item.key, v)} className="material-symbols-outlined text-[14px] opacity-40 group-hover:opacity-100 hover:text-danger">close</button>
                                          </div>
                                      ))}
                                  </div>
                                  <div className="flex gap-2">
                                      <input 
                                          type="text" 
                                          value={newItems[item.key]} 
                                          onChange={e => setNewItems({...newItems, [item.key]: e.target.value})} 
                                          className="flex-1 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                                          placeholder={`New ${item.key}...`}
                                      />
                                      <button onClick={() => addListItem(item.key)} className="bg-primary/10 text-primary border border-primary/20 size-12 rounded-xl flex items-center justify-center hover:bg-primary hover:text-black transition-all"><span className="material-symbols-outlined">add</span></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </section>
                  </div>
              )}

              {/* TAB: ACCOUNT */}
              {activeTab === 'account' && (
                  <div className="flex flex-col gap-12">
                      
                       {/* Subscription Card - Interactive */}
                      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl group hover:scale-[1.01] transition-all duration-500 border border-white/10">
                          {/* Animated Shimmer Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          <div className="absolute right-0 top-0 opacity-10 p-8"><span className="material-symbols-outlined text-9xl">diamond</span></div>
                          
                          <div className="relative z-10 flex flex-col gap-6">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="flex items-center gap-2 mb-2">
                                          <span className="material-symbols-outlined text-yellow-400 fill-current">verified</span>
                                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">Premium Member</span>
                                      </div>
                                      <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">Pro Plan</h2>
                                  </div>
                                  <div className="bg-white/15 backdrop-blur-md px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10">Early Access</div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-y border-white/10">
                                  <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest">Savings</span>
                                      <span className="text-xl font-black">+{stats.health}%</span>
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest">Monthly Exp</span>
                                      <span className="text-xl font-black">{userSettings?.currency || '₹'}{stats.totalExp.toLocaleString()}</span>
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest">Monthly Inc</span>
                                      <span className="text-xl font-black">{userSettings?.currency || '₹'}{stats.totalInc.toLocaleString()}</span>
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest">Renewal</span>
                                      <span className="text-xl font-black italic">Free</span>
                                  </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <button onClick={() => setShowProModal(true)} className="bg-white text-indigo-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg active:scale-95">
                                    Manage Plan
                                </button>
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Lifetime Validity</span>
                              </div>
                          </div>
                      </div>

                      <section>
                          <div className="flex items-center justify-between mb-8 border-b border-border-light dark:border-border-dark pb-3">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Personal Details</h3>
                            <div className="px-3 py-1 bg-primary/10 rounded-lg text-[10px] font-black text-primary uppercase tracking-widest">Sync Enabled</div>
                          </div>
                          {/* ... Form inputs (avatar, name, email) same as before ... */}
                          <div className="flex justify-center mb-8">
                              <label className="relative group cursor-pointer">
                                  <div className="size-24 rounded-full bg-gray-100 dark:bg-surface-darker border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden hover:border-primary transition-all">
                                      {accountForm.avatar ? (
                                          <img src={accountForm.avatar} alt="Profile" className="w-full h-full object-cover" />
                                      ) : (
                                          <span className="material-symbols-outlined text-4xl text-gray-400 group-hover:text-primary">add_a_photo</span>
                                      )}
                                  </div>
                                  <div className="absolute bottom-0 right-0 bg-primary text-black rounded-full p-1.5 shadow-lg">
                                      <span className="material-symbols-outlined text-sm">edit</span>
                                  </div>
                                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                              </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-black uppercase tracking-[0.2em] text-text-light-muted ml-1">Full Name</label>
                                  <input type="text" value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-5 font-bold outline-none focus:border-primary transition-all focus:ring-4 focus:ring-primary/5 shadow-sm" />
                              </div>
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-black uppercase tracking-[0.2em] text-text-light-muted ml-1">Email (Primary)</label>
                                  <input type="text" readOnly value={accountForm.email} className="bg-gray-100 dark:bg-border-dark opacity-50 border border-border-light dark:border-border-dark rounded-2xl p-5 font-bold outline-none cursor-not-allowed" />
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8">
                                  <div className="flex flex-col gap-2">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-text-light-muted ml-1">Gender</label>
                                    <select value={accountForm.gender} onChange={e => setAccountForm({...accountForm, gender: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-5 font-bold outline-none focus:border-primary appearance-none cursor-pointer">
                                        <option value="">Choose...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Non-binary">Non-binary</option>
                                        <option value="Secret">Prefer not to say</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-text-light-muted ml-1">Birthday</label>
                                    <input type="date" value={accountForm.birthday} onChange={e => setAccountForm({...accountForm, birthday: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-5 font-bold outline-none focus:border-primary" style={{colorScheme: 'dark'}} />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-text-light-muted ml-1">Location</label>
                                    <input type="text" value={accountForm.location} onChange={e => setAccountForm({...accountForm, location: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-5 font-bold outline-none focus:border-primary" placeholder="City, Country" />
                                  </div>
                              </div>
                          </div>

                          <div className="mt-12 flex justify-end">
                            <button 
                                onClick={handleAccountSave} 
                                disabled={isSaving}
                                className="px-12 py-5 bg-primary text-[#131811] font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-glow hover:scale-105 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                            >
                                {isSaving ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : <span className="material-symbols-outlined text-sm">verified_user</span>}
                                {isSaving ? 'Saving...' : 'Confirm Changes'}
                            </button>
                          </div>
                      </section>

                      {/* Password Reset Section */}
                      <section className="bg-gray-50 dark:bg-surface-darker rounded-3xl p-8 border border-border-light dark:border-border-dark/30 flex flex-col items-center text-center">
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-light-main mb-8 w-full text-left">Password</h3>
                          <div className="flex flex-col gap-6 w-full">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="flex flex-col gap-2 text-left">
                                      <label className="text-xs font-bold text-text-light-muted">New Password</label>
                                      <input type="password" value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})} className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 outline-none focus:border-primary" />
                                  </div>
                                  <div className="flex flex-col gap-2 text-left">
                                      <label className="text-xs font-bold text-text-light-muted">Confirm</label>
                                      <input type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 outline-none focus:border-primary" />
                                  </div>
                              </div>
                              <button onClick={handlePassUpdate} className="mx-auto bg-text-light-main dark:bg-white text-white dark:text-black px-10 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:opacity-80 transition-all border border-transparent">Update</button>
                          </div>
                      </section>

                      <section className="mt-10 pt-10 border-t border-border-light dark:border-border-dark">
                          <div className="bg-danger/5 border border-danger/20 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                              <div>
                                  <p className="font-black text-danger uppercase tracking-tighter">Delete Account</p>
                                  <p className="text-xs text-text-light-muted">Permanently delete your account. </p>
                              </div>
                              <button onClick={() => confirm("Irreversible action. All data will be wiped. Proceed?") && deleteAccount()} className="bg-danger text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-danger/80 transition-all shadow-lg shadow-danger/20">Delete</button>
                          </div>
                      </section>
                  </div>
              )}



              {/* TAB: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                  <div className="flex flex-col gap-12 animate-fade-in">
                      <section>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-8 border-b border-border-light dark:border-border-dark pb-3">Notification Preferences</h3>
                          <div className="flex flex-col gap-6">
                              {[
                                  { id: 'dailyCheckIn', label: 'Daily Check-in', desc: 'Reminder to log expenses at 9 PM', icon: 'alarm' },
                                  { id: 'budgetThresholds', label: 'Budget Thresholds', desc: 'Get notified when you hit 80% of category limits', icon: 'speed' },
                                  { id: 'monthlyInsights', label: 'Monthly Insights', desc: 'Summary of spending delivered on the 1st', icon: 'insights' },
                                  { id: 'tipsAndTricks', label: 'Tips & Tricks', desc: 'Financial advice and app feature updates', icon: 'lightbulb' }
                              ].map(pref => (
                                  <div key={pref.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-surface-darker rounded-[2rem] border border-border-light dark:border-border-dark group hover:border-primary/30 transition-all">
                                      <div className="flex items-center gap-4">
                                          <div className="size-12 rounded-2xl bg-white dark:bg-surface-dark flex items-center justify-center text-primary border border-border-light dark:border-border-dark">
                                              <span className="material-symbols-outlined">{pref.icon}</span>
                                          </div>
                                          <div>
                                              <p className="text-sm font-black uppercase tracking-tight">{pref.label}</p>
                                              <p className="text-[10px] text-text-light-muted opacity-60 font-bold">{pref.desc}</p>
                                          </div>
                                      </div>
                                      <button 
                                        onClick={() => {
                                            const updated = { ...notifPrefs, [pref.id]: !notifPrefs[pref.id as keyof typeof notifPrefs] };
                                            setNotifPrefs(updated);
                                            updateUserSettings({ notificationPrefs: updated });
                                            showToast(`${pref.label} ${updated[pref.id as keyof typeof notifPrefs] ? 'Enabled' : 'Disabled'}`);
                                        }}
                                        className={`w-14 h-8 rounded-full relative transition-all duration-300 p-1 ${notifPrefs[pref.id as keyof typeof notifPrefs] ? 'bg-primary' : 'bg-gray-300 dark:bg-border-dark'}`}
                                      >
                                          <div className={`size-6 rounded-full bg-white shadow-md transition-all duration-300 transform ${notifPrefs[pref.id as keyof typeof notifPrefs] ? 'translate-x-6' : 'translate-x-0'}`} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </section>

                      <section>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-8 border-b border-border-light dark:border-border-dark pb-3">Notification Tune</h3>
                          <div className="flex flex-col gap-4">
                              <p className="text-[10px] text-text-light-muted uppercase font-black tracking-widest opacity-60 ml-2">Choose alert sound</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {['Aurora', 'Bloom', 'Crystal', 'Deep'].map(tune => (
                                      <button 
                                        key={tune} 
                                        onClick={() => {
                                            setNotifTune(tune);
                                            updateUserSettings({ notificationTune: tune });
                                            showToast(`Tune set to ${tune}`);
                                        }}
                                        className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${notifTune === tune ? 'border-primary bg-primary/10 text-primary' : 'border-border-light dark:border-border-dark hover:border-primary/30'}`}
                                      >
                                          <span className="material-symbols-outlined text-3xl">{notifTune === tune ? 'graphic_eq' : 'music_note'}</span>
                                          <span className="text-xs font-black uppercase tracking-widest">{tune}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </section>
                  </div>
              )}

              {/* TAB: SECURITY */}
              {activeTab === 'security' && (
                  <div className="flex flex-col gap-12">
                      <section className="flex flex-col gap-6">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-2 border-b border-border-light dark:border-border-dark pb-3">App Access</h3>
                          <div className="flex flex-col gap-4 p-8 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-3xl group hover:border-primary/20 transition-all">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                      <div className={`size-12 rounded-2xl flex items-center justify-center transition-all ${userSettings?.appPin ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                                          <span className="material-symbols-outlined">{userSettings?.appPin ? 'shield' : 'lock'}</span>
                                      </div>
                                      <div>
                                          <p className="font-black text-text-light-main dark:text-white uppercase tracking-tight">App Lock (PIN)</p>
                                          <p className="text-xs text-text-light-muted">Require 4-digit code on app launch</p>
                                      </div>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer scale-125">
                                      <input 
                                        type="checkbox" 
                                        checked={!!userSettings?.appPin} 
                                        onChange={handlePinToggle} 
                                        className="sr-only peer" 
                                      />
                                      <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none dark:bg-border-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                  </label>
                              </div>
                              {userSettings?.appPin && (
                                  <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-between items-center">
                                      {/* Biometric Toggle */}
                                      <div className="flex items-center gap-3">
                                          <label className="relative inline-flex items-center cursor-pointer">
                                              <input 
                                                type="checkbox" 
                                                checked={!!userSettings?.biometricEnabled} 
                                                onChange={e => updateUserSettings({ biometricEnabled: e.target.checked })} 
                                                className="sr-only peer" 
                                              />
                                              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none dark:bg-border-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                          </label>
                                          <span className="text-xs font-bold text-text-light-muted">Use Biometrics</span>
                                      </div>

                                      <button onClick={handleChangePin} className="text-xs font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
                                          <span className="material-symbols-outlined text-sm">edit</span> Change PIN
                                      </button>
                                  </div>
                              )}
                          </div>

                          {/* MFA Section - Same as before */}
                          <div className="flex items-center justify-between p-8 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-3xl group hover:border-indigo-400/20 transition-all">
                              <div className="flex items-center gap-4">
                                  <div className={`size-12 rounded-2xl flex items-center justify-center transition-all ${user?.emailVerified ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-200 text-gray-400'}`}>
                                      <span className="material-symbols-outlined">verified_user</span>
                                  </div>
                                  <div>
                                      <p className="font-black text-text-light-main dark:text-white uppercase tracking-tight">Email MFA Bridge</p>
                                      <p className="text-xs text-text-light-muted">Verify email for enhanced security</p>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  {!user?.emailVerified && (
                                      <button onClick={handleRefreshUser} className="px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-200 dark:bg-border-dark text-text-light-muted hover:text-text-light-main transition-colors" title="Check Status">
                                          <span className="material-symbols-outlined text-sm">refresh</span>
                                      </button>
                                  )}
                                  <button 
                                    onClick={handleMfaAction} 
                                    disabled={user?.emailVerified}
                                    className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${user?.emailVerified ? 'bg-indigo-500 border-indigo-500 text-white shadow-glow opacity-80 cursor-default' : 'border-border-light text-text-light-muted hover:border-indigo-400 hover:text-indigo-400'}`}
                                  >
                                      {user?.emailVerified ? 'VERIFIED' : 'SEND LINK'}
                                  </button>
                              </div>
                          </div>
                      </section>
                  </div>
              )}

              {/* TAB: DATA & PRIVACY */}
              {activeTab === 'data' && (
                  <div className="flex flex-col gap-8 animate-fade-in">
                      <section className="bg-gray-50 dark:bg-surface-darker p-8 rounded-3xl border border-border-light dark:border-border-dark">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-6 border-b border-border-light dark:border-border-dark pb-3">Portability</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-3">
                                  <button onClick={() => handleExportData('csv')} className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-primary/50 transition-all group shadow-sm text-left">
                                      <div className="size-12 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
                                          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">file_download</span>
                                      </div>
                                      <div>
                                          <span className="block text-sm font-bold text-text-light-main dark:text-text-dark-main">Export CSV</span>
                                          <span className="text-[10px] text-text-light-muted uppercase tracking-wider">Spreadsheets</span>
                                      </div>
                                  </button>
                                  <button onClick={() => handleExportData('json')} className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-primary/50 transition-all group shadow-sm text-left">
                                      <div className="size-12 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                                          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">file_download</span>
                                      </div>
                                      <div>
                                          <span className="block text-sm font-bold text-text-light-main dark:text-text-dark-main">Export JSON</span>
                                          <span className="text-[10px] text-text-light-muted uppercase tracking-wider">Full Backup</span>
                                      </div>
                                  </button>
                              </div>
                              
                              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-white dark:bg-surface-dark border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary/50 transition-all group cursor-pointer h-full">
                                  <div className="size-14 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                      <span className="material-symbols-outlined text-3xl">file_upload</span>
                                  </div>
                                  <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main">Import CSV</span>
                                  <span className="text-xs text-text-light-muted text-center max-w-[200px]">Upload a CSV file to restore history or add bulk data.</span>
                                  <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                              </label>
                          </div>
                      </section>

                      <section className="bg-danger/5 border border-danger/20 p-8 rounded-3xl">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-danger mb-6 border-b border-danger/20 pb-3">Danger Zone</h3>
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                  <div className="size-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                                      <span className="material-symbols-outlined text-xl">delete_sweep</span>
                                  </div>
                                  <div>
                                      <p className="font-bold text-text-light-main dark:text-text-dark-main">Clear All Transactions</p>
                                      <p className="text-xs text-text-light-muted">Deletes all financial history. Keeps settings.</p>
                                  </div>
                              </div>
                              <button onClick={handleClearData} disabled={isSaving} className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-transparent border border-danger/30 text-danger rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-danger hover:text-white transition-all shadow-sm flex items-center justify-center gap-2">
                                  {isSaving ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : <span className="material-symbols-outlined text-sm">delete</span>}
                                  {isSaving ? 'Clearing...' : 'Clear Data'}
                              </button>
                          </div>
                      </section>
                  </div>
              )}

              {/* TAB: ABOUT (Personalized & Premium) */}
              {activeTab === 'about' && (
                  <div className="flex flex-col gap-10 animate-fade-in">
                      <div className="bg-primary/5 border border-primary/20 rounded-[3rem] p-12 flex flex-col items-center text-center gap-8 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
                          
                          <div className="size-24 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary shadow-glow ring-4 ring-primary/5">
                              <span className="material-symbols-outlined text-5xl">verified</span>
                          </div>
                          <div>
                              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">ExpenseTracker Pro</h2>
                              <p className="text-xs font-bold text-primary tracking-[0.4em] uppercase opacity-60">Personal Edition v2.5.0</p>
                          </div>
                          <p className="text-sm text-text-light-muted max-w-sm leading-relaxed">
                              Your high-fidelity financial command center. Handcrafted for privacy, speed, and deep financial insights.
                          </p>
                          <div className="flex gap-4">
                              <div className="px-5 py-2 rounded-2xl bg-surface-dark border border-border-dark text-[10px] font-black uppercase tracking-widest">Mesh Engine</div>
                              <div className="px-5 py-2 rounded-2xl bg-surface-dark border border-border-dark text-[10px] font-black uppercase tracking-widest">Private Sync</div>
                          </div>
                      </div>

                      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-gray-50 dark:bg-surface-darker p-10 rounded-[2.5rem] border border-border-light dark:border-border-dark flex flex-col gap-6 group hover:border-primary/30 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-2xl">support_agent</span>
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-text-light-main dark:text-white">Help & Support</h4>
                              </div>
                              <p className="text-xs text-text-light-muted leading-relaxed">Need assistance with your personal instance or found a bug?</p>
                              <div className="flex flex-col gap-3 mt-2">
                                  <a href="mailto:hello@expensetracker.pro" className="flex items-center justify-between p-5 bg-white dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark hover:border-primary/60 transition-all group/item shadow-sm">
                                      <span className="text-xs font-black uppercase tracking-widest">Email Developer</span>
                                      <span className="material-symbols-outlined text-sm group-hover/item:translate-x-1 transition-transform">arrow_forward</span>
                                  </a>
                              </div>
                          </div>

                          <div className="bg-gray-50 dark:bg-surface-darker p-10 rounded-[2.5rem] border border-border-light dark:border-border-dark flex flex-col gap-6 group hover:border-primary/30 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-2xl">terminal</span>
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-text-light-main dark:text-white">System Tools</h4>
                              </div>
                              <p className="text-xs text-text-light-muted leading-relaxed">Administrative controls and debugging utilities for this app.</p>
                              <div className="flex flex-col gap-3 mt-2">
                                  <button onClick={() => window.location.reload()} className="flex items-center justify-between p-5 bg-white dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark hover:border-primary/60 transition-all group/item shadow-sm">
                                      <span className="text-xs font-black uppercase tracking-widest">Hard Reload App</span>
                                      <span className="material-symbols-outlined text-sm group-hover/item:rotate-180 transition-transform duration-700">sync</span>
                                  </button>
                              </div>
                          </div>
                      </section>

                      <div className="text-center opacity-20 py-8">
                          <p className="text-[10px] font-black uppercase tracking-[0.6em]">Design is Intelligence Made Visible</p>
                      </div>
                  </div>
              )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
