import React, { useState, useEffect } from 'react';
import { useStore, Transaction } from '../context/Store';

const TransactionDetailsPanel: React.FC = () => {
    const { viewingTransaction, setViewingTransaction, updateTransaction, deleteTransaction, userSettings, showUndo } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
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
                        {!isEditing && !isDeleting && (<button onClick={() => setIsEditing(true)} className="size-10 rounded-full hover:bg-gray-100 dark:hover:bg-surface-darker text-text-light-muted flex items-center justify-center transition-all"><span className="material-symbols-outlined">edit</span></button>)}
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
                    </div>
                </div>

                <div className="p-8 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark mt-auto pb-12 md:pb-8">
                    {isEditing ? (
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-text-light-muted hover:bg-gray-100 transition-colors">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary text-[#131811] hover:bg-primary-hover shadow-glow transition-all">Apply Changes</button>
                        </div>
                    ) : isDeleting ? (
                        <div className="flex flex-col gap-4 animate-fade-in text-center">
                            <p className="text-sm font-black uppercase tracking-widest text-text-light-main">Purge this record?</p>
                            <div className="flex gap-4">
                                <button onClick={() => setIsDeleting(false)} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-border-light">Keep It</button>
                                <button onClick={async () => { if(viewingTransaction){ await deleteTransaction(viewingTransaction.id); handleClose(); } }} className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-danger text-white shadow-lg shadow-danger/20">Delete</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setIsDeleting(true)} className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-danger border border-danger/30 hover:bg-danger hover:text-white transition-all flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[20px]">delete_forever</span>Delete Transaction</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailsPanel;