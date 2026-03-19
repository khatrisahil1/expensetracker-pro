
import React, { useState, useEffect } from 'react';
import { useStore, Transaction } from '../context/Store';
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey } from '../utils/gemini';

const SettingsScreen: React.FC = () => {
  const { logout, user, updateUserSettings, userSettings, toggleTheme, updatePassword, deleteAccount, setAppPin, removeAppPin, sendVerificationEmail, refreshUser, requestNotificationPermission, sendLocalNotification, transactions, addTransaction, clearAllTransactions } = useStore();
  const [activeTab, setActiveTab] = useState('general');
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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

  // API key for Gemini (AI)
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [geminiKeyStored, setGeminiKeyStored] = useState<string | null>(null);

  // Notifications
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // List states
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [newItems, setNewItems] = useState({ pay: '', exp: '', inc: '' });

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
    }

    const envKey = getGeminiApiKey();
    setGeminiKeyStored(envKey);
    setGeminiKeyInput(envKey || '');
  }, [userSettings, user]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }
  }, []);

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

  const handleGeminiKeySave = () => {
      setGeminiApiKey(geminiKeyInput.trim());
      setGeminiKeyStored(geminiKeyInput.trim() || null);
      showToast("Gemini API key saved locally");
  };

  const handleGeminiKeyClear = () => {
      clearGeminiApiKey();
      setGeminiKeyInput('');
      setGeminiKeyStored(null);
      showToast("Gemini API key cleared");
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

  // --- NOTIFICATION HANDLERS ---
  const toggleNotification = async (key: keyof NonNullable<typeof userSettings>['notificationPreferences']) => {
      if (!userSettings?.notificationPreferences) return;
      
      const currentState = userSettings.notificationPreferences[key];
      // If turning ON, request permission first
      if (!currentState) {
          const granted = await requestNotificationPermission();
          if (!granted) {
              alert("You must allow notifications in your browser settings first.");
              return;
          }
      }

      const newPrefs = { ...userSettings.notificationPreferences, [key]: !currentState };
      await updateUserSettings({ notificationPreferences: newPrefs });
      showToast(`${(key as string).replace(/([A-Z])/g, ' $1')} ${!currentState ? 'Enabled' : 'Disabled'}`);
  };

  const handleToggleNotificationsMaster = async () => {
      if (!userSettings) return;
      const willEnable = !userSettings.notifications;

      if (willEnable) {
          if (typeof Notification === 'undefined') {
              alert('This browser does not support desktop notifications.');
              return;
          }

          const granted = await requestNotificationPermission();
          setNotificationPermission(Notification.permission);
          if (!granted) {
              alert('Please enable notifications in your browser settings to receive alerts.');
              return;
          }
      }

      await updateUserSettings({ notifications: willEnable });
      showToast(`Notifications ${willEnable ? 'Enabled' : 'Disabled'}`);
  };

  const handleTestNotification = async () => {
      if (typeof Notification === 'undefined') {
          alert('This browser does not support desktop notifications.');
          return;
      }

      // Keep the UI in-sync with the browser's permission state
      setNotificationPermission(Notification.permission);

      let granted = Notification.permission === 'granted';
      if (!granted) {
          granted = await requestNotificationPermission();
          setNotificationPermission(Notification.permission);
      }

      if (granted) {
          sendLocalNotification("Test Alert 🔔", "This is how your financial updates will appear.");
          showToast("Notification Sent");
      } else {
          alert("Permission denied. Please enable notifications in your browser settings.");
      }
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
      { id: 'notifications', label: 'Alerts', icon: 'notifications' },
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

      <div className="flex flex-col gap-1 mb-8 md:mb-12">
          <h3 className="text-3xl md:text-5xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">Profile</h3>
          <p className="text-text-light-muted dark:text-text-dark-muted text-sm md:text-lg">Fine-tune your finances.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Navigation Sidebar */}
        <div className={`w-full lg:w-72 flex flex-col gap-3 ${showMobileContent ? 'hidden lg:flex' : 'flex'}`}>
          {tabs.map(tab => (
            <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id); setShowMobileContent(true); }} 
                className={`text-left px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-between group border ${activeTab === tab.id ? 'bg-primary text-[#131811] border-primary shadow-glow' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-light-muted hover:border-primary/40'}`}
            >
              <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                  {tab.label}
              </div>
              <span className="material-symbols-outlined opacity-30 group-hover:translate-x-1 transition-transform">chevron_right</span>
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
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-8 border-b border-border-light dark:border-border-dark pb-3">AI / Gemini</h3>
                      <div className="flex flex-col gap-4">
                          <p className="text-sm text-text-light-muted dark:text-text-dark-muted">Enter your Gemini API key to enable AI features like receipt scanning and financial audits. The key is stored locally in your browser.</p>
                          <div className="flex gap-3 flex-col md:flex-row">
                              <input
                                type="password"
                                value={geminiKeyInput}
                                onChange={e => setGeminiKeyInput(e.target.value)}
                                className="flex-1 bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary"
                                placeholder="Paste your Gemini API key here"
                              />
                              <button onClick={handleGeminiKeySave} className="bg-primary text-black px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-primary-hover transition-all">Save</button>
                              <button onClick={handleGeminiKeyClear} className="bg-gray-100 dark:bg-surface-darker text-text-light-muted px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-surface-darker transition-all">Clear</button>
                          </div>
                          <p className="text-xs text-text-light-muted dark:text-text-dark-muted">
                              Current key: <span className="font-bold">{geminiKeyStored ? '••••••••••••••••' : 'Not set'}</span>
                          </p>
                      </div>
                  </section>

                  <div className="my-8 border-t border-border-light dark:border-border-dark" />

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
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg group hover:scale-[1.01] transition-transform">
                          <div className="absolute right-0 top-0 opacity-10 p-8"><span className="material-symbols-outlined text-9xl">diamond</span></div>
                          <div className="relative z-10 flex flex-col gap-4">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="material-symbols-outlined text-yellow-300">verified</span>
                                          <span className="text-xs font-black uppercase tracking-widest text-indigo-100">Active Plan</span>
                                      </div>
                                      <h2 className="text-3xl font-black uppercase tracking-tight">Pro Membership</h2>
                                  </div>
                                  <span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold">$9.99/mo</span>
                              </div>
                              <div className="flex gap-4 mt-2">
                                  <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-indigo-200">Member Since</span>
                                      <span className="font-bold">Jan 2024</span>
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-indigo-200">Next Billing</span>
                                      <span className="font-bold">Free Forever</span>
                                  </div>
                              </div>
                              <button onClick={() => setShowProModal(true)} className="mt-4 bg-white text-indigo-600 w-fit px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-colors shadow-md">
                                  Manage Subscription
                              </button>
                          </div>
                      </div>

                      <section>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary mb-8 border-b border-border-light dark:border-border-dark pb-3">Personal Details</h3>
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

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-text-light-muted">Full Name</label>
                                  <input type="text" value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary" />
                              </div>
                              <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-text-light-muted">Email</label>
                                  <input type="text" readOnly value={accountForm.email} className="bg-gray-100 dark:bg-border-dark opacity-50 border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none cursor-not-allowed" />
                              </div>
                              <div className="md:col-span-2 grid grid-cols-2 gap-6">
                                  <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-text-light-muted">Gender</label>
                                    <select value={accountForm.gender} onChange={e => setAccountForm({...accountForm, gender: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary appearance-none">
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Non-binary</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                      <label className="text-xs font-bold text-text-light-muted">Date of Birth</label>
                                      <input type="date" value={accountForm.birthday} onChange={e => setAccountForm({...accountForm, birthday: e.target.value})} className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-xl p-4 font-bold outline-none focus:border-primary" style={{colorScheme: 'dark'}} />
                                  </div>
                              </div>
                          </div>
                          <button onClick={handleAccountSave} disabled={isSaving} className="mt-8 w-full bg-primary text-[#131811] py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-glow transition-all active:scale-[0.98]">
                              {isSaving ? 'Syncing...' : 'Save Details'}
                          </button>
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
                  <div className="flex flex-col gap-8 animate-fade-in">
                      <div className="bg-primary/5 border border-primary/20 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex gap-4 items-start">
                              <span className="material-symbols-outlined text-primary">notifications_active</span>
                              <div>
                                  <h3 className="text-sm font-bold text-text-light-main dark:text-text-dark-main">Smart Alerts</h3>
                                  <p className="text-xs text-text-light-muted mt-1">Direct to your browser. No spam.</p>
                                  <p className="text-xs text-text-light-muted mt-2">
                                      Permission: <span className="font-bold capitalize">{notificationPermission}</span>
                                      <span className="mx-1">·</span>
                                      Status: <span className="font-bold">{userSettings?.notifications ? 'Enabled' : 'Disabled'}</span>
                                  </p>
                              </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full md:w-auto">
                              <button onClick={handleToggleNotificationsMaster} className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest bg-white/80 text-black px-4 py-2 rounded-full hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 transition-all shadow-sm">
                                  {userSettings?.notifications ? 'Turn Off' : 'Turn On'}
                              </button>
                              <button onClick={handleTestNotification} className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest bg-primary text-black px-4 py-2 rounded-full hover:bg-primary-hover shadow-sm">
                                  Test Alert
                              </button>
                          </div>
                      </div>

                      <div className="flex flex-col gap-4">
                          {[
                              { id: 'dailyReminder', title: 'Daily Check-in', desc: 'Reminder to log expenses at 9 PM' },
                              { id: 'budgetAlerts', title: 'Budget Thresholds', desc: 'Get notified when you hit 80% of category limits' },
                              { id: 'monthlyReport', title: 'Monthly Insights', desc: 'Summary of spending delivered on the 1st' },
                              { id: 'marketing', title: 'Tips & Tricks', desc: 'Financial advice and app feature updates' }
                          ].map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-surface-darker rounded-2xl border border-border-light dark:border-border-dark">
                                  <div>
                                      <p className="font-bold text-text-light-main dark:text-text-dark-main text-sm">{item.title}</p>
                                      <p className="text-xs text-text-light-muted dark:text-text-dark-muted mt-1">{item.desc}</p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={userSettings?.notificationPreferences?.[item.id as keyof typeof userSettings.notificationPreferences] ?? true} 
                                        onChange={() => toggleNotification(item.id as any)} 
                                        className="sr-only peer" 
                                      />
                                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none dark:bg-border-dark rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                  </label>
                              </div>
                          ))}
                      </div>
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

              {/* TAB: SUPPORT (Simplified & Refined) */}
              {activeTab === 'about' && (
                  <div className="flex flex-col gap-10 animate-fade-in">
                      
                      {/* About Header */}
                      <div className="flex flex-col gap-4 text-center items-center py-4">
                          <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-glow mb-2">
                              <span className="material-symbols-outlined text-4xl">account_balance_wallet</span>
                          </div>
                          <h2 className="text-2xl font-black text-text-light-main dark:text-text-dark-main uppercase tracking-tight">ExpenseTracker Pro</h2>
                          <p className="text-sm text-text-light-muted max-w-md">
                              Version 2.5.2 (Stable)<br/>
                              Designed for privacy-first financial clarity.
                          </p>
                      </div>

                      {/* Socials & Links */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <a href="#" className="flex flex-col items-center justify-center gap-2 p-6 rounded-3xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-border-dark transition-all group">
                              <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-[#1DA1F2]">public</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">Twitter</span>
                          </a>
                          <a href="#" className="flex flex-col items-center justify-center gap-2 p-6 rounded-3xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-border-dark transition-all group">
                              <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-[#E1306C]">photo_camera</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">Instagram</span>
                          </a>
                          <a href="#" className="flex flex-col items-center justify-center gap-2 p-6 rounded-3xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-border-dark transition-all group">
                              <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-white">code</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">GitHub</span>
                          </a>
                          <a href="#" className="flex flex-col items-center justify-center gap-2 p-6 rounded-3xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-border-dark transition-all group">
                              <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-primary">mail</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">Contact</span>
                          </a>
                      </div>

                      {/* FAQ Accordion */}
                      <div className="flex flex-col gap-3">
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-light-muted mb-2 px-1">Common Questions</h3>
                          {[
                              { q: "Is my data stored securely?", a: "Yes. We use AES-256 encryption for all local data and secure SSL pipelines for cloud synchronization. Your financial data is never sold to third parties." },
                              { q: "How do I export my data?", a: "Go to the Dashboard, click the 'Export' button in the top toolbar. You can download a CSV of your current view or your entire transaction history." },
                              { q: "Can I share my budget?", a: "Currently, budget sharing is in beta. You can use the 'Split Bill' feature to manage shared expenses with friends." }
                          ].map((item, idx) => (
                              <div key={idx} className="bg-gray-50 dark:bg-surface-darker rounded-2xl border border-border-light dark:border-border-dark overflow-hidden transition-all">
                                  <button 
                                    onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-100 dark:hover:bg-border-dark/50 transition-colors"
                                  >
                                      <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main">{item.q}</span>
                                      <span className={`material-symbols-outlined text-text-light-muted transition-transform duration-300 ${faqOpen === idx ? 'rotate-180' : ''}`}>expand_more</span>
                                  </button>
                                  <div className={`px-5 text-xs text-text-light-muted leading-relaxed overflow-hidden transition-all duration-300 ${faqOpen === idx ? 'max-h-40 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}>
                                      {item.a}
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="text-center opacity-40 mt-8">
                          <p className="text-[10px] uppercase font-bold text-text-light-muted">© 2024 ExpenseTracker Pro. All rights reserved.</p>
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
