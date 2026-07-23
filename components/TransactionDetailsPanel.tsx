import React, { useState, useEffect } from 'react';
import { useStore, Transaction } from '../context/Store';
import ReceiptScannerModal, { ReceiptScanResult } from './ReceiptScannerModal';

const TransactionDetailsPanel: React.FC = () => {
    const { viewingTransaction, setViewingTransaction, updateTransaction, deleteTransaction, userSettings, showUndo } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Transaction>>({});

    useEffect(() => {
        if (viewingTransaction) {
            setFormData({ ...viewingTransaction });
            setIsEditing(false);
            setIsDeleting(false);
        }
    }, [viewingTransaction]);

    if (!viewingTransaction) return null;

    const handleClose = () => { setViewingTransaction(null); setIsEditing(false); setIsDeleting(false); };

    const handleSave = async () => {
        if (viewingTransaction && formData) {
            const finalAmount = isNaN(formData.amount as number) ? 0 : formData.amount;
            const finalData = { ...formData, amount: finalAmount };
            await updateTransaction(viewingTransaction.id, finalData);
            setViewingTransaction({ ...viewingTransaction, ...finalData } as Transaction);
            setIsEditing(false);
        }
    };

    const applyScanResult = (result: ReceiptScanResult) => {
        setFormData(prev => ({
            ...prev,
            title: result.merchant || prev.title,
            amount: result.totalAmount ?? prev.amount,
            date: result.date || prev.date,
            category: result.category || prev.category,
        }));
    };

    const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';
    const categories = formData.type === 'income' ? userSettings?.incomeCategories : userSettings?.expenseCategories;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col md:flex-row md:justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose}></div>
            <div className="relative w-full h-[90vh] mt-auto md:mt-0 md:h-full md:w-[500px] bg-surface-light dark:bg-surface-dark border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark shadow-2xl flex flex-col rounded-t-[3rem] md:rounded-t-none animate-slide-up md:animate-slide-in-right overflow-hidden transition-colors">
                <div className="md:hidden flex justify-center py-6"><div className="w-12 h-1.5 bg-gray-200 dark:bg-border-dark rounded-full"></div></div>
                <div className="flex items-center justify-between px-8 py-4 md:py-8 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                    <h2 className="text-xl font-black text-text-light-main dark:text-text-dark-main uppercase tracking-tight">{isEditing ? 'Edit Entry' : 'Transaction Info'}</h2>
                    <div className="flex gap-2">
                        {!isEditing && !isDeleting && (
                            <button onClick={() => setIsEditing(true)} className="size-10 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker text-text-light-muted flex items-center justify-center transition-all"><span className="material-symbols-outlined">edit</span></button>
                        )}
                        {isEditing && (
                            <button onClick={() => setShowScanner(true)} className="size-10 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker text-text-light-muted flex items-center justify-center transition-all" title="Scan receipt to autofill">
                                <span className="material-symbols-outlined">photo_camera</span>
                            </button>
                        )}
                        <button onClick={handleClose} className="size-10 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker text-text-light-muted flex items-center justify-center transition-all"><span className="material-symbols-outlined">close</span></button>
                    </div>
                </div>

                <div className="px-8 py-10 flex flex-col gap-10 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col items-center justify-center text-center">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light-muted opacity-60 mb-4">{formData.type === 'income' ? 'Amount Received' : 'Amount Spent'}</label>
                        {isEditing ? (
                            <div className="flex items-center justify-center w-full border-b-2 border-primary pb-2">
                                <span className="text-4xl font-black text-text-light-subtle opacity-40 mr-4">{currencySymbol}</span>
                                <input type="number" value={isNaN(formData.amount as number) ? "" : formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value === "" ? 0 : parseFloat(e.target.value)})} className="bg-transparent text-6xl font-black text-center w-full outline-none text-text-light-main dark:text-text-dark-main" autoFocus />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className={`text-6xl font-black tracking-tighter ${formData.type === 'income' ? 'text-primary' : 'text-text-light-main dark:text-white'}`}>
                                    {formData.type === 'income' ? '+' : '-'}{currencySymbol}{(formData.amount ?? 0).toLocaleString()}
                                </span>
                                <div className={`mt-4 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] ${formData.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-danger'}`}>{formData.type}</div>
                                {formData.isRecurring && (
                                    <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-info/10 text-info text-xs font-bold border border-info/20 w-fit">
                                        <span className="material-symbols-outlined text-[14px]">repeat</span>
                                        Recurring · {formData.recurrenceRule?.frequency || 'monthly'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">{formData.type === 'income' ? 'Sender' : 'Merchant'}</label>
                            {isEditing ? (
                                <input type="text" value={formData.title || ""} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none focus:border-primary" />
                            ) : (
                                <p className="text-xl font-bold text-text-light-main dark:text-text-dark-main">{formData.title}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Timeline</label>
                                {isEditing ? (
                                    <input type="date" value={formData.date || ""} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none" style={{colorScheme: 'dark'}} />
                                ) : (
                                    <div className="flex items-center gap-3 text-text-light-main dark:text-text-dark-main font-bold"><span className="material-symbols-outlined text-primary text-[20px]">calendar_today</span>{formData.date}</div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Classification</label>
                                {isEditing ? (
                                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none appearance-none">
                                        {categories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-3 text-text-light-main dark:text-text-dark-main font-bold"><span className="material-symbols-outlined text-primary text-[20px]">label</span>{formData.category}</div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Payment Method</label>
                            {isEditing ? (
                                <select value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none appearance-none">
                                    {userSettings?.paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            ) : (
                                <div className="flex items-center gap-3 text-text-light-main dark:text-text-dark-main font-bold"><span className="material-symbols-outlined text-primary text-[20px]">payments</span>{formData.paymentMethod || "Not specified"}</div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Notes</label>
                            {isEditing ? (
                                <textarea value={formData.note || ""} onChange={(e) => setFormData({...formData, note: e.target.value})} className="w-full bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark rounded-2xl p-4 text-sm font-bold text-text-light-main dark:text-text-dark-main outline-none focus:border-primary h-32 resize-none" placeholder="Add notes..." />
                            ) : (
                                <p className="text-sm font-medium text-text-light-muted dark:text-text-dark-muted leading-relaxed bg-gray-50 dark:bg-surface-darker p-5 rounded-[2rem] border border-border-light dark:border-border-dark/30 min-h-[100px]">{formData.note || "No extra context provided."}</p>
                            )}
                        </div>
                        {/* Recurring settings */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Recurring</label>
                            {isEditing ? (
                                <div className="flex flex-col gap-3">
                                    <div
                                        onClick={() => setFormData({...formData, isRecurring: !formData.isRecurring})}
                                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark cursor-pointer"
                                    >
                                        <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main">Repeat automatically</span>
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isRecurring ? 'bg-primary' : 'bg-gray-300 dark:bg-border-dark'}`}>
                                            <div className={`absolute top-0.5 size-4 bg-white rounded-full shadow transition-all ${formData.isRecurring ? 'left-5' : 'left-0.5'}`} />
                                        </div>
                                    </div>
                                    {formData.isRecurring && (
                                        <div className="flex gap-2 flex-wrap">
                                            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFormData({...formData, recurrenceRule: { frequency: f, interval: 1 }})}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                                                        formData.recurrenceRule?.frequency === f
                                                            ? 'bg-primary text-[#131811]'
                                                            : 'bg-gray-100 dark:bg-surface-darker text-text-light-muted'
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                formData.isRecurring
                                    ? <div className="flex items-center gap-2 text-info font-bold text-sm"><span className="material-symbols-outlined text-[18px]">repeat</span>Every {formData.recurrenceRule?.frequency || 'month'}</div>
                                    : <span className="text-text-light-muted dark:text-text-dark-muted text-sm">One-time transaction</span>
                            )}
                        </div>
                        {/* Receipt Attachment */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-light-muted opacity-60">Receipt</label>
                            {isEditing ? (
                                <div className="flex flex-col gap-3">
                                    {formData.attachment ? (
                                        <div className="relative rounded-2xl overflow-hidden border border-border-light dark:border-border-dark">
                                            <img
                                                src={formData.attachment}
                                                alt="Receipt"
                                                className="w-full max-h-48 object-cover cursor-pointer"
                                                onClick={() => setLightboxOpen(true)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData({...formData, attachment: undefined})}
                                                className="absolute top-2 right-2 size-7 rounded-full bg-danger text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-border-light dark:border-border-dark cursor-pointer hover:border-primary/50 transition-colors">
                                            <span className="material-symbols-outlined text-text-light-muted">photo_camera</span>
                                            <span className="text-sm font-bold text-text-light-muted dark:text-text-dark-muted">Attach receipt photo</span>
                                            <input
                                                type="file" accept="image/*" className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const img = new Image();
                                                        img.onload = () => {
                                                            const canvas = document.createElement('canvas');
                                                            const MAX = 800;
                                                            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                                                            canvas.width = img.width * scale;
                                                            canvas.height = img.height * scale;
                                                            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                                                            setFormData(prev => ({...prev, attachment: canvas.toDataURL('image/jpeg', 0.7)}));
                                                        };
                                                        img.src = ev.target?.result as string;
                                                    };
                                                    reader.readAsDataURL(file);
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            ) : (
                                formData.attachment ? (
                                    <div
                                        className="relative rounded-2xl overflow-hidden border border-border-light dark:border-border-dark cursor-pointer group"
                                        onClick={() => setLightboxOpen(true)}
                                    >
                                        <img src={formData.attachment} alt="Receipt" className="w-full max-h-40 object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 text-3xl transition-opacity">zoom_in</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-light-muted dark:text-text-dark-muted opacity-60 italic">No receipt attached</p>
                                )
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark mt-auto pb-12 md:pb-8">
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-text-light-muted hover:bg-gray-100 transition-colors">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary text-[#131811] hover:bg-primary-hover shadow-glow transition-all">Apply Changes</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsDeleting(true)} className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-danger border border-danger/30 hover:bg-danger hover:text-white transition-all flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[20px]">delete</span>Delete </button>
                    )}
                </div>
                {/* Receipt Scanner Modal */}
                {showScanner && (
                  <ReceiptScannerModal
                    onClose={() => setShowScanner(false)}
                    onResult={(result) => {
                      applyScanResult(result);
                      setShowScanner(false);
                    }}
                  />
                )}

                {/* Delete Confirmation Modal */}
                {isDeleting && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsDeleting(false)}></div>
                    <div className="relative bg-surface-light dark:bg-surface-dark border border-danger/30 rounded-3xl px-8 py-8 w-[90%] max-w-md shadow-2xl flex flex-col items-center gap-6 animate-fade-in">
                      <div className="size-14 rounded-full bg-danger/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-danger text-2xl">delete</span>
                      </div>
                      <h2 className="text-lg font-bold text-text-light-main dark:text-text-dark-main text-center">
                        Delete Transaction?
                      </h2>
                      <div className="flex gap-4 w-full">
                        <button
                          onClick={() => setIsDeleting(false)}
                          className="flex-1 py-3 rounded-full border border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main font-bold hover:bg-gray-100 dark:hover:bg-surface-darker transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (viewingTransaction) {
                              const item = viewingTransaction;
                              await deleteTransaction(viewingTransaction.id);
                              showUndo(item);
                              handleClose();
                            }
                          }}
                          className="flex-1 py-3 rounded-full bg-danger text-white font-bold hover:bg-red-600 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Lightbox Modal */}
                {lightboxOpen && formData.attachment && (
                  <div
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <img src={formData.attachment} alt="Receipt" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    <button
                      className="absolute top-4 right-4 size-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
                      onClick={() => setLightboxOpen(false)}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                )}
            </div>
        </div>
    );
};

export default TransactionDetailsPanel;