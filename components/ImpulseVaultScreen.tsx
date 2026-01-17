
import React, { useState, useEffect, useRef } from 'react';
import { useStore, ImpulseItem } from '../context/Store';
import { GoogleGenAI } from "@google/genai";

const ImpulseVaultScreen: React.FC = () => {
  const { userSettings, addTransaction, impulseItems, addImpulseItem, deleteImpulseItem } = useStore();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingsSession, setSavingsSession] = useState(0); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingSource, setAnalyzingSource] = useState<'image' | 'link' | null>(null);
  
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [newItem, setNewItem] = useState({ name: '', price: '', link: '', image: '', duration: '24' });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, [stream]);

  const closeModal = () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      setStream(null); setShowCamera(false); setShowAddModal(false);
      setNewItem({ name: '', price: '', link: '', image: '', duration: '24' });
      setIsAnalyzing(false);
  };

  const handleAddItem = async () => {
      if (!newItem.name || !newItem.price) return;
      try {
          await addImpulseItem({
              name: newItem.name, price: parseFloat(newItem.price), link: newItem.link,
              image: newItem.image || '',
              createdAt: Date.now(), durationHours: parseInt(newItem.duration)
          });
          closeModal();
      } catch (e) { alert("Failed to save item."); }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream); setShowCamera(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream; }, 100);
    } catch (err) { alert("Could not access camera."); }
  };

  const stopCamera = () => { if (stream) stream.getTracks().forEach(t => t.stop()); setStream(null); setShowCamera(false); };

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

  const captureImage = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          // Limit capture size for performance and storage
          const MAX_WIDTH = 800;
          const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
          
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Use standard JPEG compression
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setNewItem(prev => ({...prev, image: dataUrl}));
              stopCamera();
              analyzeImage(dataUrl);
          }
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setNewItem(prev => ({ ...prev, image: compressed }));
        analyzeImage(compressed);
      } catch (e) {
        console.error("Image upload failed", e);
      }
    }
  };

  const analyzeImage = async (base64String: string) => {
      setIsAnalyzing(true); setAnalyzingSource('image');
      try {
          const base64Data = base64String.split(',')[1];
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: { parts: [ { inlineData: { mimeType: 'image/jpeg', data: base64Data } }, { text: "Identify product: name, price (number) in JSON." } ] },
              config: { responseMimeType: 'application/json' }
          });
          const data = JSON.parse(response.text);
          setNewItem(prev => ({ ...prev, name: data.name || prev.name, price: data.price?.toString() || prev.price }));
      } catch (err) { alert("Manual entry required."); } finally { setIsAnalyzing(false); setAnalyzingSource(null); }
  };

  const analyzeLink = async () => {
    if (!newItem.link) return;
    setIsAnalyzing(true); setAnalyzingSource('link');
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Search product link: ${newItem.link}. Extract name and price in JSON.`,
            config: { tools: [{ googleSearch: {} }] }
        });
        const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr.substring(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1));
        setNewItem(prev => ({ ...prev, name: data.name || prev.name, price: data.price?.toString() || prev.price }));
    } catch (e) { alert("Could not fetch link details."); } finally { setIsAnalyzing(false); setAnalyzingSource(null); }
  };

  const handleDelete = async (id: string, price: number) => {
      await deleteImpulseItem(id, true); // true = resisted impulse
      setSavingsSession(prev => prev + price);
  };

  const handleBuy = async (item: ImpulseItem) => {
      await addTransaction({ title: item.name, amount: item.price, type: 'expense', category: 'Shopping', date: new Date().toISOString().split('T')[0], note: 'Impulse buy from Vault' });
      await deleteImpulseItem(item.id, false); // false = bought, not resisted
      alert(`Bought ${item.name}!`);
  };

  const getTimeRemaining = (item: ImpulseItem) => {
      const unlockTime = item.createdAt + (item.durationHours * 60 * 60 * 1000);
      const diff = unlockTime - currentTime;
      if (diff <= 0) return null;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return days > 0 ? `${days}d ${hours}h` : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';
  const totalPotentialSavings = impulseItems.reduce((acc, item) => acc + item.price, 0);

  return (
    <div className="px-2 md:px-10 lg:px-20 flex flex-1 justify-center py-4 md:py-8 pb-24 overflow-y-auto">
      <div className="flex flex-col max-w-[1400px] flex-1">
        {showAddModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Add Impulse Item</h2><button onClick={closeModal}><span className="material-symbols-outlined">close</span></button></div>
                    {showCamera ? (
                         <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black mb-6">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute bottom-4 left-0 w-full flex justify-center gap-4">
                                <button onClick={stopCamera} className="bg-white/20 text-white p-3 rounded-full"><span className="material-symbols-outlined">close</span></button>
                                <button onClick={captureImage} className="bg-white text-black p-4 rounded-full"><span className="material-symbols-outlined">camera</span></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 mb-6">
                            <button onClick={startCamera} className="w-full bg-[#111827] dark:bg-black text-white p-4 rounded-[1.5rem] flex items-center gap-4 transition-opacity shadow-lg group relative overflow-hidden">
                                <div className="size-10 rounded-full bg-[#2ECC71] flex items-center justify-center text-[#111827]"><span className="material-symbols-outlined">photo_camera</span></div>
                                <div className="text-left"><p className="font-bold">Camera Scan</p><p className="text-xs text-gray-400">Take a photo</p></div>
                            </button>
                            <label className="w-full bg-white dark:bg-surface-dark border border-border-light p-4 rounded-[1.5rem] flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-darker shadow-sm transition-colors">
                                <div className="size-10 rounded-full bg-gray-100 dark:bg-border-dark flex items-center justify-center"><span className="material-symbols-outlined">upload_file</span></div>
                                <div><p className="font-bold">Upload File</p><p className="text-xs">Select from gallery</p></div>
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>
                    )}
                    <div className="flex flex-col gap-4">
                         <div><label className="text-xs font-bold uppercase mb-1 block opacity-60">Link</label>
                            <div className="flex gap-2">
                                <input type="text" className="flex-1 bg-background-light dark:bg-surface-darker border border-border-light rounded-xl p-3 text-sm outline-none" placeholder="URL..." value={newItem.link} onChange={e => setNewItem({...newItem, link: e.target.value})} />
                                <button onClick={analyzeLink} disabled={!newItem.link || isAnalyzing} className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-3 transition-colors">{isAnalyzing && analyzingSource === 'link' ? <span className="material-symbols-outlined animate-spin text-xl">sync</span> : <span className="material-symbols-outlined">auto_fix_high</span>}</button>
                            </div>
                        </div>
                        <div><label className="text-xs font-bold uppercase mb-1 block opacity-60">Item Name</label><input type="text" className="w-full bg-background-light dark:bg-surface-darker border border-border-light rounded-xl p-3 outline-none" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold uppercase mb-1 block opacity-60">Price</label><input type="number" className="w-full bg-background-light dark:bg-surface-darker border border-border-light rounded-xl p-3 outline-none" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} /></div>
                            <div><label className="text-xs font-bold uppercase mb-1 block opacity-60">Duration</label><select className="w-full bg-background-light dark:bg-surface-darker border border-border-light rounded-xl p-3 outline-none appearance-none" value={newItem.duration} onChange={e => setNewItem({...newItem, duration: e.target.value})}><option value="24">24 Hours</option><option value="168">1 Week</option></select></div>
                        </div>
                        <button onClick={handleAddItem} disabled={isAnalyzing} className="w-full bg-primary text-[#131811] font-bold py-3 rounded-xl mt-2 shadow-glow">Lock It Away</button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-slide-up">
          <div className="flex flex-col gap-3 max-w-2xl"><h1 className="text-3xl md:text-5xl font-black tracking-tight">Impulse Vault</h1><p className="text-text-light-muted dark:text-text-dark-muted text-lg">Defeat the urge. Wait it out. Master your money.</p></div>
          <div className="flex flex-col gap-1 rounded-[1.5rem] p-5 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm min-w-[200px]">
            <div className="flex items-center gap-2 text-primary mb-1"><span className="material-symbols-outlined">savings</span><p className="text-sm font-black uppercase tracking-widest">Vault Total</p></div>
            <p className="text-3xl font-black tabular-nums">{currencySymbol}{totalPotentialSavings.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-8 animate-slide-up delay-100">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-surface-darker text-sm font-bold text-text-light-muted">
            <span className="material-symbols-outlined text-primary text-lg">info</span><span>Items are locked until the timer expires.</span>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center justify-center rounded-full h-12 px-6 bg-primary hover:bg-primary-hover text-[#131811] gap-2 font-black uppercase tracking-widest shadow-glow active:scale-95 transition-transform"><span className="material-symbols-outlined">add</span>New Impulse</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-slide-up delay-200">
          {impulseItems.map(item => {
              const unlockTime = item.createdAt + (item.durationHours * 60 * 60 * 1000);
              const isLocked = Date.now() < unlockTime;
              const timeRemaining = getTimeRemaining(item);
              const progress = Math.min(100, ((Date.now() - item.createdAt) / (item.durationHours * 60 * 60 * 1000)) * 100);
              return (
                <div key={item.id} className={`group relative flex flex-col overflow-hidden rounded-[1.5rem] bg-surface-light dark:bg-surface-dark border transition-all ${isLocked ? 'border-border-light dark:border-border-dark' : 'border-primary'}`}>
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-surface-darker">
                        {isLocked ? (<div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center backdrop-blur-[1px] text-white"><span className="material-symbols-outlined text-3xl">lock</span></div>) : (<div className="absolute top-2 right-2 z-20 px-2 py-1 rounded-full bg-primary text-[#131811] text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1"><span className="material-symbols-outlined text-xs">check_circle</span>Ready</div>)}
                        <div className="w-full h-full bg-center bg-cover transition-transform duration-500 group-hover:scale-110" style={{backgroundImage: `url("${item.image}")`}}></div>
                    </div>
                    <div className="flex flex-col flex-1 p-5 gap-4">
                        <div><h3 className="font-bold text-lg leading-tight truncate">{item.name}</h3><p className="text-xs font-bold opacity-40 uppercase tracking-widest">{item.durationHours} Hours Wait</p></div>
                        <div className="flex items-end justify-between border-b border-border-light dark:border-border-dark pb-4">
                            <div className="flex flex-col"><span className={`text-[10px] font-black uppercase tracking-widest ${isLocked ? 'opacity-40' : 'text-primary'}`}>{isLocked ? 'Wait Time' : 'UNLOCKED'}</span><span className="text-2xl font-black tabular-nums">{isLocked ? timeRemaining : '00:00'}</span></div>
                            <span className="text-xl font-black tabular-nums">{currencySymbol}{item.price.toLocaleString()}</span>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => isLocked ? null : handleBuy(item)} disabled={isLocked} className={`flex-1 rounded-full h-10 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${isLocked ? 'bg-gray-100 dark:bg-border-dark opacity-30 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover text-[#131811] shadow-glow'}`}><span className="material-symbols-outlined text-lg">shopping_cart</span>Buy</button>
                             <button onClick={() => handleDelete(item.id, item.price)} className="size-10 rounded-full border border-border-light hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center" title="Resist & Save"><span className="material-symbols-outlined text-lg">delete</span></button>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-gray-200 dark:bg-gray-800 w-full"><div className={`h-full transition-all duration-1000 ${isLocked ? 'bg-orange-500' : 'bg-primary w-full'}`} style={{width: `${progress}%`}}></div></div>
                </div>
              );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImpulseVaultScreen;
