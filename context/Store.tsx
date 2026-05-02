
import React, { createContext, useContext, useEffect, useState, ReactNode, PropsWithChildren, useRef } from 'react';
// Firebase Imports
import firebase from 'firebase/compat/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser, 
  updateProfile,
  updatePassword as fbUpdatePassword,
  deleteUser as fbDeleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification as fbSendEmailVerification
} from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, query, where, onSnapshot, orderBy, doc, deleteDoc, Timestamp, setDoc, getDoc, updateDoc, deleteField, writeBatch } from 'firebase/firestore';
import { checkBudgetThresholds, checkDailyReminder, checkMonthlySummary } from '../utils/notifications';
// Gemini API helpers
import { createGeminiClient } from "../utils/gemini";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBryZdhGRp05tY9e6gv79z4mA1hDyXlQ8U",
  authDomain: "expensetracker-pro-35f24.firebaseapp.com",
  projectId: "expensetracker-pro-35f24",
  storageBucket: "expensetracker-pro-35f24.firebasestorage.app",
  messagingSenderId: "360942386894",
  appId: "1:360942386894:web:61043d1a8ac7a65f64da9f",
  measurementId: "G-PXC2T5SKGB"
};

// Initialize Firebase App
const app = firebase.initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence (IndexedDB) for Firestore.
// Firestore will cache reads/writes locally and sync when connectivity returns.
enableIndexedDbPersistence(db).catch((err) => {
  // Multiple tabs open can cause persistence failures.
  if (err?.code === 'failed-precondition') {
    console.warn('Firestore persistence failed (multiple tabs open).');
  } else if (err?.code === 'unimplemented') {
    console.warn('Firestore persistence is not supported in this browser.');
  } else {
    console.warn('Firestore persistence error:', err);
  }
});

// --- TYPE DEFINITIONS ---
export interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  note?: string;
  paymentMethod?: string;
  tags?: string[];
  userId?: string;
  isSubscription?: boolean;
  subscriptionFrequency?: 'monthly' | 'yearly' | 'weekly';
  subscriptionStatus?: 'active' | 'paused';
  nextRenewalDate?: string;
  createdAt?: { seconds: number, nanoseconds: number };
}

export interface ImpulseItem {
  id: string;
  name: string;
  price: number;
  link?: string;
  image?: string;
  createdAt: number;
  durationHours: number; // How long the item is locked
  userId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  icon: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
}

export interface UserSettings {
  currency: string;
  displayName: string;
  avatar?: string;
  hasCompletedOnboarding: boolean;
  monthlyIncomeGoal?: number;
  monthlyExpenseLimit?: number;
  theme?: 'light' | 'dark';

  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  language?: string;
  shakeToLock?: boolean;
  appPin?: string | null; 
  biometricEnabled?: boolean; 
  paymentMethods: string[];
  expenseCategories: string[];
  incomeCategories: string[];
  categoryBudgets: Record<string, number>;
  savingsGoals: SavingsGoal[];
  realizedSavings: number; 
  age?: string;
  gender?: string;
  birthday?: string;
  location?: string;
  mfaEnabled?: boolean;
  financialGoal?: 'saving' | 'debt' | 'tracking' | 'investing';
  notificationPrefs: {
    dailyCheckIn: boolean;
    budgetThresholds: boolean;
    monthlyInsights: boolean;
    tipsAndTricks: boolean;
  };
  notificationTune: string;
}

interface UndoState {
  show: boolean;
  item: Transaction | null;
}

interface StoreContextType {
  user: FirebaseUser | null;
  userSettings: UserSettings | null;
  loading: boolean;
  transactions: Transaction[];
  impulseItems: ImpulseItem[]; 
  notifications: AppNotification[];  // Auth Actions
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name?: string, avatar?: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  updatePassword: (newPass: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Transaction Actions
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>; 
  restoreTransaction: (tx: Transaction) => Promise<void>; 
  clearAllTransactions: () => Promise<void>;
  // Impulse Actions
  addImpulseItem: (item: Omit<ImpulseItem, 'id' | 'userId'>) => Promise<void>; 
  deleteImpulseItem: (id: string, resisted?: boolean) => Promise<void>; 
  // UI State
  viewingTransaction: Transaction | null; 
  setViewingTransaction: (tx: Transaction | null) => void; 
  widgets: Record<string, boolean>; // Widget visibility
  toggleWidget: (key: string) => void;
  updateWidgetOrder: (newOrder: string[]) => void; 
  widgetOrder: string[];

  // Settings & Security
  completeOnboarding: (data: { name: string, age: string, gender: string, currency: string, initialBalance: number, income: number, budget: number, goal: string }) => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  toggleTheme: () => Promise<void>;
  enableDemo: () => void;
  isDemo: boolean;
  isPinSet: boolean;
  isAppLocked: boolean;
  setAppPin: (pin: string) => void;
  removeAppPin: () => Promise<void>;
  unlockApp: (pin: string) => boolean;
  lockApp: () => void;
  sendVerificationEmail: () => Promise<void>;
  undoState: UndoState;
  // Notifications Actions
  addNotification: (title: string, body: string, type?: AppNotification['type']) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  showUndo: (tx: Transaction) => void;
  clearUndo: () => void;
  // AI Features
  generateFinancialAudit: () => Promise<string>;
  verifyBiometric: () => Promise<boolean>;

}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
};

const DEFAULT_EXPENSE_CATS = ["Food", "Rent", "Transportation", "Shopping", "Entertainment", "Health", "Utilities", "Other"];
const DEFAULT_INCOME_CATS = ["Salary", "Freelance", "Investments", "Gifts", "Refunds", "Rental", "Other"];
const DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Savings Account"];
const DEFAULT_ORDER = ['balance', 'income', 'expense', 'streak','breakdown', 'recent', 'quickAdd'];

export const StoreProvider = ({ children }: PropsWithChildren) => {
  // Global State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data Collections
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [impulseItems, setImpulseItems] = useState<ImpulseItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load notifications from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('app_notifications');
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse notifications", e);
      }
    }
  }, []);

  // Sync notifications to local storage
  useEffect(() => {
    localStorage.setItem('app_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const transactionsRef = useRef<Transaction[]>([]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  
  // App UI State
  const [isDemo, setIsDemo] = useState(false);
  // Restore Demo Mode on refresh
  useEffect(() => {
    if (localStorage.getItem('demo') === '1') {
      setIsDemo(true);
      setUser({
        uid: 'guest',
        displayName: 'Guest User',
        email: null,
        photoURL: null,
      } as any);
      setLoading(false);
    }
  }, []);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [widgets, setWidgets] = useState<Record<string, boolean>>({
    streak: true, balance: true, income: true, expense: true, breakdown: true, recent: true, quickAdd: true
  });
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_ORDER);
  
  // Security State
  const [appPin, setPinState] = useState<string | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [undoState, setUndoState] = useState<UndoState>({ show: false, item: null });
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsLoadedRef = useRef(false);

  // 1. Auth Listener
  useEffect(() => {
    if (isDemo) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false); 
        setUserSettings(null); 
        setIsAppLocked(false); 
        setPinState(null); 
        settingsLoadedRef.current = false;
      }
    });
    return unsubscribe;
  }, [isDemo]);

  // 2. Data Listeners
  useEffect(() => {
    if (isDemo) { setLoading(false); return; }
    if (!user) return;

    const qTx = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      txData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTransactions(txData);
    });

    const qImpulse = query(collection(db, 'impulse_items'), where('userId', '==', user.uid));
    const unsubImpulse = onSnapshot(qImpulse, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ImpulseItem[];
      setImpulseItems(items.sort((a,b) => b.createdAt - a.createdAt));
    });

    return () => { unsubTx(); unsubImpulse(); };
  }, [user, isDemo]);

  // 3. Notification Observer
  useEffect(() => {
    if (!userSettings?.notificationPrefs) return;

    // Check budget thresholds when transactions or limit changes
    checkBudgetThresholds(transactions, userSettings.monthlyExpenseLimit || 0, userSettings.notificationPrefs, addNotification);
    
    // Check monthly summary
    checkMonthlySummary(transactions, userSettings.notificationPrefs, addNotification);

    // Set up a timer for the daily 9 PM reminder
    const timer = setInterval(() => {
        checkDailyReminder(userSettings.notificationPrefs, addNotification);
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [transactions.length, userSettings?.monthlyExpenseLimit, userSettings?.notificationPrefs]);

  // 4. User Settings Listener
  useEffect(() => {
    if (isDemo) return;
    if (!user) return;

    const userSettingsRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const settings: UserSettings = {
          currency: data.currency || 'INR',
          displayName: data.displayName || user.displayName || 'User',
          avatar: data.avatar || '',
          hasCompletedOnboarding: data.hasCompletedOnboarding || false,
          monthlyIncomeGoal: data.monthlyIncomeGoal || 0,
          monthlyExpenseLimit: data.monthlyExpenseLimit || 0,
          theme: data.theme || 'dark',
          dateFormat: data.dateFormat || 'DD/MM/YYYY',
          language: data.language || 'English',
          shakeToLock: data.shakeToLock ?? false,
          appPin: data.appPin || null,
          biometricEnabled: data.biometricEnabled ?? false,
          paymentMethods: data.paymentMethods || DEFAULT_PAYMENT_METHODS,
          expenseCategories: data.expenseCategories || DEFAULT_EXPENSE_CATS,
          incomeCategories: data.incomeCategories || DEFAULT_INCOME_CATS,
          categoryBudgets: data.categoryBudgets || {},
          savingsGoals: data.savingsGoals || [],
          realizedSavings: data.realizedSavings || 0,
          age: data.age || '',
          gender: data.gender || '',
          birthday: data.birthday || '',
          location: data.location || '',
          mfaEnabled: data.mfaEnabled || false,
          financialGoal: data.financialGoal || 'tracking',
          notificationPrefs: data.notificationPrefs || {
            dailyCheckIn: true,
            budgetThresholds: true,
            monthlyInsights: true,
            tipsAndTricks: true
          },
          notificationTune: data.notificationTune || 'Aurora'
        };
        setUserSettings(settings);
        setPinState(data.appPin || null);
        if (data.widgets) setWidgets(data.widgets);
        if (data.widgetOrder) setWidgetOrder(data.widgetOrder);
        
        if (!settingsLoadedRef.current && data.appPin) setIsAppLocked(true);
        settingsLoadedRef.current = true;

        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(data.theme || 'dark');
      } else {
        const initial = {
            currency: 'INR', displayName: user.displayName || 'User', hasCompletedOnboarding: false, theme: 'dark' as const,
            paymentMethods: DEFAULT_PAYMENT_METHODS, expenseCategories: DEFAULT_EXPENSE_CATS, incomeCategories: DEFAULT_INCOME_CATS,
            categoryBudgets: {}, realizedSavings: 0, savingsGoals: []
        };
        setUserSettings(initial as UserSettings);
        document.documentElement.classList.add('dark');
        settingsLoadedRef.current = true;
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [user, isDemo]);



  // --- ACTIONS ---
  const login = async (email: string, pass: string) => { await signInWithEmailAndPassword(auth, email, pass); };
  
  const googleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || 'User',
          avatar: user.photoURL || '',
          hasCompletedOnboarding: false,
          theme: 'dark',
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          expenseCategories: DEFAULT_EXPENSE_CATS,
          incomeCategories: DEFAULT_INCOME_CATS,
          categoryBudgets: {},
          realizedSavings: 0,
          savingsGoals: []
        });
      }
    } catch (error) {
      console.error("Google Sign In Error", error);
      throw error;
    }
  };

  const signup = async (email: string, pass: string, name?: string, avatar?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      if (name) await updateProfile(cred.user, { displayName: name });
      await fbSendEmailVerification(cred.user);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email, 
        displayName: name || 'User', 
        avatar: avatar || '',
        hasCompletedOnboarding: false, 
        theme: 'dark',
        paymentMethods: DEFAULT_PAYMENT_METHODS, expenseCategories: DEFAULT_EXPENSE_CATS, incomeCategories: DEFAULT_INCOME_CATS,
        categoryBudgets: {}, realizedSavings: 0, savingsGoals: []
      });
    }
  };

  const sendVerificationEmail = async () => {
    if (user) await fbSendEmailVerification(user);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser({ ...auth.currentUser } as FirebaseUser);
    }
  };

  const updatePassword = async (newPass: string) => { if (user) await fbUpdatePassword(user, newPass); };
  
  const deleteAccount = async () => {
    if (user) {
        try {
            const uid = user.uid;
            await fbDeleteUser(user);
            await deleteDoc(doc(db, 'users', uid));
            setUser(null);
        } catch (error: any) {
            console.error("Error deleting account:", error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Security Update: Please log out and log back in to confirm account deletion.");
            } else {
                alert("Could not delete account. Please try again later.");
            }
        }
    }
  };
  
  const logout = async () => {
    if (isDemo) {
      localStorage.removeItem('demo');
      setIsDemo(false);
      setUser(null);
      setUserSettings(null);
      window.location.reload();
      return;
    }
    await signOut(auth);
  };

  const updateUserSettings = async (settings: Partial<UserSettings>) => {
    if (isDemo) { setUserSettings(prev => prev ? ({...prev, ...settings}) : null); return; }
    if(!user) return;
    await setDoc(doc(db, 'users', user.uid), settings, { merge: true });
  };

  const completeOnboarding = async (data: { 
    name: string, age: string, gender: string, currency: string, 
    initialBalance: number, income: number, budget: number, goal: string 
  }) => {
    await updateUserSettings({
      displayName: data.name, age: data.age, gender: data.gender, currency: data.currency,
      monthlyIncomeGoal: data.income, monthlyExpenseLimit: data.budget,
      financialGoal: data.goal as any, hasCompletedOnboarding: true,
      notificationPrefs: {
        dailyCheckIn: true,
        budgetThresholds: true,
        monthlyInsights: true,
        tipsAndTricks: true
      },
      notificationTune: 'Aurora'
    });

    if (data.initialBalance > 0) {
      await addTransaction({
        title: 'Initial Deposit', amount: data.initialBalance, date: new Date().toISOString().split('T')[0],
        category: 'Salary', type: 'income', note: 'Starting balance', paymentMethod: 'Savings Account' 
      });
    }
  };

  const updateWidgetOrder = async (newOrder: string[]) => {
    setWidgetOrder(newOrder);
    if (user && !isDemo) await setDoc(doc(db, 'users', user.uid), { widgetOrder: newOrder }, { merge: true });
  };

  const toggleWidget = async (key: string) => {
    const newWidgets = { ...widgets, [key]: !widgets[key] };
    setWidgets(newWidgets);
    if (user && !isDemo) await setDoc(doc(db, 'users', user.uid), { widgets: newWidgets }, { merge: true });
  };

  // --- BIO & LOCK ---
  const verifyBiometric = async () => {
    if (!window.PublicKeyCredential) {
        alert("Biometrics not supported on this device/browser.");
        return false;
    }
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "ExpenseTracker Pro" },
          user: {
            id: new Uint8Array(16),
            name: user?.email || "User",
            displayName: user?.displayName || "User"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { 
              userVerification: "required", 
              authenticatorAttachment: "platform"
          },
          timeout: 60000,
          attestation: "none"
        }
      });
      
      setIsAppLocked(false);
      return true;
    } catch (e) {
      console.warn("Biometric check failed/cancelled", e);
      return false;
    }
  };

  const setAppPin = (pin: string) => { 
      setPinState(pin); 
      updateUserSettings({ appPin: pin }); 
  };
  
  const removeAppPin = async () => { 
      // 1. Immediately update local state to reflect UI change
      setPinState(null);
      if(userSettings) {
          // Force update local userSettings to ensure UI reacts
          setUserSettings({...userSettings, appPin: null, biometricEnabled: false});
      }
      
      // 2. Persist to backend
      if (user && !isDemo) {
          try {
              await updateDoc(doc(db, 'users', user.uid), {
                  appPin: deleteField(),
                  biometricEnabled: false
              });
          } catch (e) {
              console.error("Failed to remove PIN from DB", e);
          }
      }
  };

  const unlockApp = (pin: string) => { if (pin === appPin) { setIsAppLocked(false); return true; } return false; };
  const lockApp = () => { if (appPin) setIsAppLocked(true); };

  // --- CRUD ---
  const addTransaction = async (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (isDemo) return;
    if (!user) throw new Error("User not authenticated");
    await addDoc(collection(db, 'transactions'), { ...tx, userId: user.uid, createdAt: Timestamp.now() });
  };

  const deleteTransaction = async (id: string) => {
    if (isDemo) return;
    await deleteDoc(doc(db, 'transactions', id));
  };

  const addNotification = (title: string, body: string, type: AppNotification['type'] = 'info') => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(7),
      title,
      body,
      timestamp: Date.now(),
      read: false,
      type
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({...n, read: true})));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };
  
  const clearAllTransactions = async () => {
      if (!user) return;
      if (transactions.length === 0) return;
      
      // Since Firestore batch is limited to 500, we'll do promise.all for simplicity in this client-side context
      // for a "Danger Zone" feature.
      const promises = transactions.map(tx => deleteDoc(doc(db, 'transactions', tx.id)));
      await Promise.all(promises);
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => { if (user) await setDoc(doc(db, 'transactions', id), updates, { merge: true }); };
  const restoreTransaction = async (tx: Transaction) => { if (user) { const { id, ...data } = tx; await setDoc(doc(db, 'transactions', id), data); } };

  const showUndo = (tx: Transaction) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ show: true, item: tx });
    undoTimerRef.current = setTimeout(() => setUndoState({ show: false, item: null }), 4000);
  };

  const clearUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ show: false, item: null });
  };

  const addImpulseItem = async (item: Omit<ImpulseItem, 'id' | 'userId'>) => {
    if (isDemo) return;
    if (!user) throw new Error("User not authenticated");
    await addDoc(collection(db, 'impulse_items'), { ...item, userId: user.uid });
  };

  const deleteImpulseItem = async (id: string, resisted: boolean = false) => {
    if (isDemo) return;
    if (!user || !userSettings) return;
    if (resisted) {
        const item = impulseItems.find(i => i.id === id);
        if (item) await updateUserSettings({ realizedSavings: (userSettings.realizedSavings || 0) + item.price });
    }
    await deleteDoc(doc(db, 'impulse_items', id));
  };

  // --- AI ---
  const generateFinancialAudit = async () => {
      if (!userSettings || transactions.length === 0) return "Not enough data for an audit.";
      try {
          const ai = createGeminiClient();
          const recentTx = transactions.slice(0, 30).map(t => ({ title: String(t.title), amt: Number(t.amount), cat: String(t.category), type: String(t.type) }));
          const budgetSummary: Record<string, number> = {};
          if (userSettings.categoryBudgets) {
              for (const [key, value] of Object.entries(userSettings.categoryBudgets)) {
                  budgetSummary[String(key)] = Number(value);
              }
          }
          const prompt = `You are a premium fintech AI embedded inside a modern expense tracking app.
You must RESPOND WITH A SINGLE VALID JSON OBJECT ONLY (no markdown, no explanation, no extra text). The JSON must follow the exact structure described below.

REQUIRED JSON STRUCTURE:
{
  "summary": "1-line sharp insight",
  "status": {
    "label": "Healthy / Warning / Critical",
    "emoji": "Choose status based on spending_ratio: < 70 → 🤩 Excellent; 70–90 → 😍 Good; 90–110 → 😁 Moderate; 110–140 → 😭 Warning; > 140 → ☠️ Critical , <only emoji icon not anything text>",
    "message": "short quick action message"
  },
  "visual": {
    "type": "fire / leak / growth / crash / control",
    "headline": "short attention-grabbing phrase"
  },
  "metrics": {
    "income": number,
    "expense": number,
    "net": number,
    "spending_ratio": number
  },
  "insights": [
    {
      "emoji": "🔥 / 💰 / ⚠️ / 🧠 / 🧾",
      "title": "very short title",
      "message": "1-line explanation"
    },
    {
      "emoji": "💡",
      "title": "another insight",
      "message": "1-line explanation"
    }
  ],
  "actions": [
    {
      "emoji": "✅",
      "text": "short action step"
    },
    {
      "emoji": "⚡",
      "text": "another action"
    }
  ],
  "tone": {
    "vibe": "strict / motivating / warning",
    "one_liner": "Tip : final punchline"
  }
}

Style:
- Keep output concise and UI-friendly.
- Avoid clutter, keep it scannable in 5 seconds.
- Use emotional metaphors like "money leak", "spending fire", "stable zone".

Here is the input data:
Transactions: ${JSON.stringify(recentTx)}
Budgets: ${JSON.stringify(budgetSummary)}
Currency: ${String(userSettings.currency)}

Respond with JSON only.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
          return response.text || "Could not generate audit.";
      } catch (e: any) {
          console.warn('generateFinancialAudit failed:', e);
          return "Financial AI is currently unavailable. Please check your API key.";
      }
  };

  return (
    <StoreContext.Provider value={{
      user, userSettings, loading, transactions, impulseItems, login, signup, googleLogin, logout, 
      updatePassword, deleteAccount, refreshUser,
      addTransaction, deleteTransaction, updateTransaction, restoreTransaction, clearAllTransactions,
      addImpulseItem, deleteImpulseItem, viewingTransaction, setViewingTransaction,
      widgets, toggleWidget, widgetOrder, updateWidgetOrder, completeOnboarding, updateUserSettings, 
      toggleTheme: async () => { const newTheme = userSettings?.theme === 'light' ? 'dark' : 'light'; updateUserSettings({ theme: newTheme }); },
      enableDemo: () => {
        setIsDemo(true);
        setUser({
          uid: 'guest',
          displayName: 'Guest User',
          email: null,
          photoURL: null,
        } as any);
        setUserSettings({
          currency: 'INR',
          displayName: 'Guest User',
          hasCompletedOnboarding: true,
          theme: 'dark',
          paymentMethods: DEFAULT_PAYMENT_METHODS,
          expenseCategories: DEFAULT_EXPENSE_CATS,
          incomeCategories: DEFAULT_INCOME_CATS,
          categoryBudgets: {},
          savingsGoals: [],
          realizedSavings: 0,
        } as UserSettings);
        setLoading(false);
        localStorage.setItem('demo', '1');
      }, isDemo,
      isPinSet: !!appPin, isAppLocked, setAppPin, removeAppPin, unlockApp, lockApp,
      undoState, showUndo, clearUndo,
      notifications, addNotification, markNotificationsRead, clearNotifications,
      generateFinancialAudit, verifyBiometric, sendVerificationEmail
    }}>
      {children}
    </StoreContext.Provider>
  );
};
