
import React, { useState, useRef, useEffect } from 'react';
import { Type } from "@google/genai";
import { createGeminiClient } from '../utils/gemini';
import { useStore } from '../context/Store';
import { View } from '../types';

interface ScannerScreenProps {
    onNavigate: (view: View) => void;
}

// Styling definitions for category badges
const CATEGORY_STYLES: Record<string, { icon: string, colorClass: string }> = {
    "Food": { icon: "restaurant", colorClass: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
    "Housing": { icon: "home", colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    "Rent": { icon: "real_estate_agent", colorClass: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" },
    "Transportation": { icon: "directions_car", colorClass: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    "Entertainment": { icon: "movie", colorClass: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
    "Shopping": { icon: "shopping_bag", colorClass: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
    "Health": { icon: "medical_services", colorClass: "text-red-400 bg-red-400/10 border-red-400/20" },
    "Utilities": { icon: "bolt", colorClass: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
    "Salary": { icon: "payments", colorClass: "text-primary bg-primary/10 border-primary/20" },
    "Other": { icon: "receipt", colorClass: "text-gray-400 bg-gray-400/10 border-gray-400/20" }
};

const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onNavigate }) => {
  const { addTransaction, transactions, userSettings, setViewingTransaction } = useStore();
  
  // Camera & Image State
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Refs for Media Elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Food',
    type: 'expense' as 'expense' | 'income',
    paymentMethod: 'UPI',
    notes: '',
    isSubscription: false,
    subscriptionFrequency: 'monthly' as 'monthly' | 'yearly' | 'weekly'
  });

  const recentTransactions = transactions.slice(0, 10);

  // Initialize form defaults from user settings
  useEffect(() => {
    if (userSettings) {
        setFormData(prev => ({
            ...prev,
            category: prev.type === 'income' ? (userSettings.incomeCategories[0] || 'Salary') : (userSettings.expenseCategories[0] || 'Food'),
            paymentMethod: userSettings.paymentMethods[0] || 'UPI'
        }));
    }
  }, [userSettings, formData.type]);

  // --- CAMERA LOGIC ---
  useEffect(() => {
    // Proactively check permission status if supported
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' as any }).then(status => {
            console.log("Camera permission status:", status.state);
        }).catch(e => console.warn("Permissions API not supported for camera."));
    }
  }, []);

  const startCamera = async () => {
    console.log("Starting camera...");
    try {
      // First check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn("getUserMedia not supported in this browser/context.");
          throw new Error("NOT_SUPPORTED");
      }
      
      // Request access to rear camera
      const constraints = { 
        video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        } 
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted.");
      setStream(mediaStream);
      setShowCamera(true);
      
      // Wait for video element to mount then assign stream
      setTimeout(() => { 
        if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play().catch(e => console.error("Video play failed:", e));
        } 
      }, 100);
    } catch (err: any) {
      console.error("Camera error:", err);
      
      // Fallback to native OS camera/file picker
      if (fallbackInputRef.current) {
          console.log("Falling back to native file input...");
          fallbackInputRef.current.click();
      } else {
          alert("Camera access is blocked or not supported. Please enable it in settings.");
      }
    }
  };

  const stopCamera = () => { 
      if (stream) stream.getTracks().forEach(track => track.stop()); 
      setStream(null); 
      setShowCamera(false); 
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw current video frame to canvas
        ctx.drawImage(videoRef.current, 0, 0);
        // Convert to base64 JPEG
        const img = canvas.toDataURL('image/jpeg', 0.8);
        setPreviewImage(img);
        stopCamera();
        analyzeReceipt(img);
      }
    }
  };

  // --- AI ANALYSIS ---
  const analyzeReceipt = async (base64Image: string) => {
    setIsProcessing(true);
    try {
      const ai = createGeminiClient();
      // Use Gemini Flash for speed and cost efficiency
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            // Pass the image data
            { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
            // Prompt for structured data extraction
            { text: "Extract receipt data into JSON: totalAmount, merchant, date (YYYY-MM-DD), category." }
          ]
        },
        config: { responseMimeType: 'application/json' }
      });
      
      const data = JSON.parse(response.text);
      // Populate form with AI results
      setFormData(prev => ({
        ...prev,
        amount: data.totalAmount?.toString() || prev.amount,
        merchant: data.merchant || prev.merchant,
        date: data.date || prev.date,
        category: data.category || prev.category
      }));
    } catch (e: any) {
      alert(e?.message || "Analysis failed.");
    } finally { setIsProcessing(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || !formData.merchant) return;
    await addTransaction({
      title: formData.merchant, 
      amount: amt, 
      date: formData.date, 
      category: formData.category,
      type: formData.type, 
      note: formData.notes, 
      paymentMethod: formData.paymentMethod,
      isSubscription: formData.isSubscription,
      subscriptionFrequency: formData.subscriptionFrequency
    });
    setFormData(prev => ({ ...prev, amount: '', merchant: '', notes: '', isSubscription: false }));
    setPreviewImage(null);
    alert("Saved!");
  };

  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-[1400px] animate-fade-in overflow-y-auto pb-24">
      {/* ... Header ... */}
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-text-light-main dark:text-text-dark-main">Transactions</h1>
        <p className="text-text-light-muted dark:text-text-dark-muted text-lg">Manage and track your activity effortlessly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[2.5rem] p-6 md:p-10 shadow-sm relative">
            <div className="flex items-center gap-3 mb-10">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">add_circle</span>
                </div>
                <h2 className="text-xl font-bold text-text-light-main dark:text-text-dark-main uppercase tracking-tight">Add Transaction</h2>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-10">
              <div className="flex flex-col items-center gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light-muted opacity-60">
                    {formData.type === 'income' ? 'How much did you receive?' : 'How much did you spend?'}
                </label>
                <div className="flex items-center justify-center gap-4 w-full">
                  <span className="text-4xl md:text-5xl font-black text-text-light-subtle opacity-30">{currencySymbol}</span>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="bg-transparent border-none text-6xl md:text-8xl font-black text-text-light-main dark:text-text-dark-main p-0 focus:ring-0 w-auto min-w-[180px] text-center placeholder:text-gray-100 dark:placeholder:text-white/5" placeholder="0.00" />
                  <div className="flex flex-col gap-1 opacity-30">
                    <button type="button" onClick={() => setFormData(prev => ({...prev, amount: (parseFloat(prev.amount || '0') + 1).toString()}))} className="material-symbols-outlined text-3xl hover:text-primary">expand_less</button>
                    <button type="button" onClick={() => setFormData(prev => ({...prev, amount: Math.max(0, parseFloat(prev.amount || '0') - 1).toString()}))} className="material-symbols-outlined text-3xl hover:text-primary">expand_more</button>
                  </div>
                </div>

                <div className="flex bg-gray-100 dark:bg-surface-darker p-1 rounded-full border border-border-light dark:border-border-dark w-full max-w-[280px] mt-2">
                    <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${formData.type === 'expense' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-light-muted'}`}>Expense</button>
                    <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${formData.type === 'income' ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-light-muted'}`}>Income</button>
                </div>
              </div>

              {formData.type === 'expense' && (
                <div className="flex flex-col gap-4 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Quick Category</label>
                  <div className="flex flex-wrap gap-2">
                    {userSettings?.expenseCategories.slice(0, 4).map(cat => (
                      <button key={cat} type="button" onClick={() => setFormData({...formData, category: cat})} className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-bold transition-all ${formData.category === cat ? 'bg-primary border-primary text-[#131811] shadow-glow' : 'bg-transparent border-border-light dark:border-border-dark text-text-light-muted hover:border-primary/50'}`}>
                        <span className="material-symbols-outlined text-[18px]">{CATEGORY_STYLES[cat]?.icon || 'label'}</span>{cat}
                      </button>
                    ))}
                    <button type="button" onClick={() => onNavigate(View.SETTINGS)} className="size-10 rounded-full border border-border-light dark:border-border-dark flex items-center justify-center text-text-light-muted hover:bg-gray-100 dark:hover:bg-surface-darker transition-colors"><span className="material-symbols-outlined text-[20px]">add</span></button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">
                    {formData.type === 'income' ? 'Sender' : 'Merchant'}
                  </label>
                  <div className="relative group">
                    <input type="text" value={formData.merchant} onChange={(e) => setFormData({...formData, merchant: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none transition-all pr-14" placeholder={formData.type === 'income' ? 'e.g. Employer, Client' : 'e.g. Starbucks, Amazon'} />
                    <button type="button" onClick={startCamera} className="absolute right-2 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">qr_code_scanner</span></button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Date</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none transition-all" style={{colorScheme: 'dark'}} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                    {(formData.type === 'income' ? userSettings?.incomeCategories : userSettings?.expenseCategories)?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                    {userSettings?.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none transition-all h-20 resize-none" placeholder="Add optional details..." />
              </div>

              {/* Subscription Toggle */}
              <div className="bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-xl flex items-center justify-center transition-all ${formData.isSubscription ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                              <span className="material-symbols-outlined">{formData.isSubscription ? 'subscriptions' : 'sync'}</span>
                          </div>
                          <div>
                              <p className="text-xs font-black uppercase tracking-tight">Recurring Subscription</p>
                              <p className="text-[10px] text-text-light-muted">Mark this as a repeating payment</p>
                          </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, isSubscription: !formData.isSubscription})}
                        className={`w-12 h-6 rounded-full relative transition-all ${formData.isSubscription ? 'bg-primary' : 'bg-gray-300 dark:bg-border-dark'}`}
                      >
                          <div className={`absolute top-1 size-4 bg-white rounded-full transition-all ${formData.isSubscription ? 'left-7' : 'left-1'}`} />
                      </button>
                  </div>

                  {formData.isSubscription && (
                      <div className="flex gap-2 animate-fade-in">
                          {['weekly', 'monthly', 'yearly'].map(freq => (
                              <button 
                                key={freq}
                                type="button"
                                onClick={() => setFormData({...formData, subscriptionFrequency: freq as any})}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.subscriptionFrequency === freq ? 'bg-primary/10 border-primary text-primary' : 'border-border-light dark:border-border-dark text-text-light-muted'}`}
                              >
                                  {freq}
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={startCamera} className="flex-1 bg-gray-100 dark:bg-surface-darker hover:bg-gray-200 dark:hover:bg-border-dark py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><span className="material-symbols-outlined text-[18px]">photo_camera</span>Scan Receipt</button>
                <label className="flex-1 bg-gray-100 dark:bg-surface-darker hover:bg-gray-200 dark:hover:bg-border-dark py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all"><span className="material-symbols-outlined text-[18px]">cloud_upload</span>Upload File<input type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => analyzeReceipt(r.result as string); r.readAsDataURL(f); }}} /></label>
                
                {/* Hidden Fallback Input for Camera */}
                <input ref={fallbackInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => analyzeReceipt(r.result as string); r.readAsDataURL(f); }}} />
              </div>

              <button type="submit" disabled={!formData.amount || !formData.merchant || isProcessing} className="w-full bg-primary hover:bg-primary-hover text-[#131811] font-black py-5 rounded-[2rem] shadow-glow transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] disabled:opacity-50 disabled:grayscale">
                {isProcessing ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">check_circle</span>}
                {isProcessing ? 'SCANNING...' : 'SAVE TRANSACTION'}
              </button>
            </form>

            {/* Camera Overlay */}
            {showCamera && (
              <div className="absolute inset-0 z-50 bg-black rounded-[2.5rem] overflow-hidden flex flex-col">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-10 left-0 w-full flex justify-center gap-6">
                    <button onClick={stopCamera} className="size-14 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center border border-white/20"><span className="material-symbols-outlined">close</span></button>
                    <button onClick={captureImage} className="size-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl border-4 border-white/30"><span className="material-symbols-outlined text-3xl">camera</span></button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Recent Transactions Sidebar */}
        <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-text-light-main dark:text-text-dark-main flex items-center gap-2"><span className="material-symbols-outlined text-primary">history</span> Recent Activity</h3>
                <button onClick={() => onNavigate(View.TRANSACTIONS_CALENDAR)} className="text-primary text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-1 group">Full History<span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span></button>
            </div>
            <div className="flex flex-col gap-3">
                {recentTransactions.map(tx => {
                    const style = CATEGORY_STYLES[tx.category] || CATEGORY_STYLES['Other'];
                    return (
                        <div key={tx.id} onClick={() => setViewingTransaction(tx)} className="group bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-5 flex items-center justify-between transition-all hover:bg-gray-50 dark:hover:bg-surface-darker cursor-pointer shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className={`size-12 rounded-2xl flex items-center justify-center border ${style.colorClass}`}><span className="material-symbols-outlined text-xl">{style.icon}</span></div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <p className="text-text-light-main dark:text-text-dark-main font-bold text-base">{tx.title}</p>
                                        {tx.isSubscription && (
                                            <span className="bg-primary/20 text-primary text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[10px]">sync</span>
                                                Sub
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-text-light-muted dark:text-text-dark-muted uppercase font-black tracking-widest opacity-60">{formatDisplayDate(tx.date)}</p>
                                </div>
                            </div>
                            <p className={`text-xl font-black ${tx.type === 'income' ? 'text-primary' : 'text-danger'}`}>{tx.type === 'income' ? '+' : '-'}{currencySymbol}{tx.amount.toFixed(2)}</p>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};
