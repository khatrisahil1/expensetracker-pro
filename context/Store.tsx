// Global app state: the signed-in user, their Firestore data, settings, the
// app lock and shared UI state. Components read it with useStore().
//
// Layout of this file:
//   1. Firebase setup and PIN helpers
//   2. Types (Transaction, UserSettings, ...)
//   3. StoreProvider: listeners (auth, data, settings, notifications), then actions
import { createContext, useContext, useEffect, useState, PropsWithChildren, useRef } from 'react';
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
  sendEmailVerification as fbSendEmailVerification,
  reauthenticateWithPopup,
  GithubAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  type AuthProvider,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, query, where, onSnapshot, getDocs, doc, deleteDoc, Timestamp, setDoc, getDoc, updateDoc, deleteField, writeBatch, increment, type DocumentReference } from 'firebase/firestore';
import { checkBudgetThresholds, checkCategoryBudgets, checkDailyReminder, checkMonthlySummary } from '../utils/notifications';
// Gemini API helpers
import { createGeminiClient, GEMINI_MODEL } from "../utils/gemini";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_PAYMENT_METHODS } from '../constants/categories';
import { toLocalISODate, addInterval } from '../utils/date';
import { STORAGE_KEYS, UNDO_WINDOW_MS, MAX_STORED_NOTIFICATIONS } from '../constants/app';
import { playTone } from '../utils/sounds';

// --- SECURITY HELPERS ---
/** SHA-256 hash a string using the Web Crypto API. Returns a lowercase hex digest. */
const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(`expensetracker:pin:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/** A PIN is exactly 4 digits. The lock screen keypad only accepts that length. */
const isValidPin = (pin: string) => /^\d{4}$/.test(pin);
/** Stored hashes are 64 hex chars. Anything else is a plaintext PIN saved before hashing was added. */
const isHashedPin = (stored: string) => /^[0-9a-f]{64}$/.test(stored);

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
// - ignoreUndefinedProperties: Firestore rejects a whole write if any field is
//   `undefined` (e.g. an optional `attachment`). That silently broke saving on
//   the Transactions page. Now such fields are simply left out.
// - persistentLocalCache: offline cache in IndexedDB, shared across tabs, so
//   reads and writes work offline and sync later. Replaces the deprecated
//   enableIndexedDbPersistence(), which failed when two tabs were open.
// initializeFirestore() may run only once per app. When Vite hot-reloads this
// module it runs again and throws, so reuse the instance made the first time.
const createDb = () => {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
};
const db = createDb();

// --- TYPE DEFINITIONS ---
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g. 2 = every 2 weeks
  endDate?: string; // YYYY-MM-DD, optional
}

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
  // Recurring transactions
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  nextOccurrence?: string; // YYYY-MM-DD
  // Receipt attachment (compressed base64 data URL)
  attachment?: string;
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

export interface QuickShortcut {
  id: string;
  emoji: string;
  label: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  paymentMethod: string;
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
  quickShortcuts?: QuickShortcut[];
}

/** Answers collected by the onboarding screen. */
export interface OnboardingData {
  name: string;
  age: string;
  gender: string;
  currency: string;
  /** Starting balance, recorded as an "Initial Deposit" income if above 0. */
  initialBalance: number;
  /** Monthly income goal. */
  income: number;
  /** Monthly expense limit. */
  budget: number;
  goal: NonNullable<UserSettings['financialGoal']>;
}

interface UndoState {
  show: boolean;
  item: Transaction | null;
}

/** Everything components can read or call through useStore(). */
interface StoreContextType {
  // --- Session & data ---
  /** Signed-in Firebase user; a stand-in object in Guest mode; null when signed out. */
  user: FirebaseUser | null;
  /** The user's settings document; null until it loads. */
  userSettings: UserSettings | null;
  /** True until the auth state and settings are known. */
  loading: boolean;
  /** All of the user's transactions, newest first by creation time. */
  transactions: Transaction[];
  impulseItems: ImpulseItem[];
  /** In-app notification history, newest first (kept in localStorage). */
  notifications: AppNotification[];

  // --- Auth ---
  login: (email: string, pass: string) => Promise<void>;
  /** Create an account, send a verification email and create its settings document. */
  signup: (email: string, pass: string, name?: string, avatar?: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  /** GitHub / Apple / Facebook popup sign-in. Phone isn't implemented and throws. */
  loginWithProvider: (provider: Exclude<SocialProvider, 'Google'>) => Promise<void>;
  /** Email a password-reset link. */
  resetPassword: (email: string) => Promise<void>;
  /** Sign out, or leave Guest mode. */
  logout: () => Promise<void>;
  updatePassword: (newPass: string) => Promise<void>;
  /** Delete all the user's data, then the account. Asks to sign in again if the session is old. */
  deleteAccount: () => Promise<void>;
  /** Reload the Firebase user, e.g. to pick up a verified email. */
  refreshUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  /** Re-confirm identity: password for email accounts, Google popup otherwise. */
  reauthenticate: (password?: string) => Promise<void>;

  // --- Transactions ---
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  /** Re-create a deleted transaction with its original id (used by Undo). */
  restoreTransaction: (tx: Transaction) => Promise<void>;
  clearAllTransactions: () => Promise<void>;

  // --- Impulse Vault ---
  addImpulseItem: (item: Omit<ImpulseItem, 'id' | 'userId'>) => Promise<void>;
  /** Remove an item. With `resisted`, its price is added to realised savings. */
  deleteImpulseItem: (id: string, resisted?: boolean) => Promise<void>;

  // --- Shared UI state ---
  /** Transaction open in the details panel, or null when it's closed. */
  viewingTransaction: Transaction | null;
  setViewingTransaction: (tx: Transaction | null) => void;
  /** Dashboard widget visibility, by widget key. */
  widgets: Record<string, boolean>;
  toggleWidget: (key: string) => void;
  /** Dashboard widget keys in display order. */
  widgetOrder: string[];
  updateWidgetOrder: (newOrder: string[]) => void;
  /** The last deleted transaction, while Undo is available. */
  undoState: UndoState;
  /** Offer Undo for a just-deleted transaction for UNDO_WINDOW_MS. */
  showUndo: (tx: Transaction) => void;
  clearUndo: () => void;

  // --- Settings ---
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  /** Merge changes into the settings document (local only in Guest mode). */
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  toggleTheme: () => Promise<void>;
  /** Start Guest mode: a local-only session where nothing is saved. */
  enableDemo: () => void;
  isDemo: boolean;

  // --- App lock ---
  isPinSet: boolean;
  /** True while the PIN lock screen should cover the app. */
  isAppLocked: boolean;
  /** Save a new 4-digit PIN (hashed) and unlock. Throws for any other length. */
  setAppPin: (pin: string) => Promise<void>;
  removeAppPin: () => Promise<void>;
  /** Unlock if the PIN matches. Also upgrades PINs saved before hashing was added. */
  unlockApp: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  /** Ask the device for biometric confirmation, and unlock on success. */
  verifyBiometric: () => Promise<boolean>;

  // --- Notifications ---
  /** Add a notification (skipped if the same one is already unread) and play the chosen tone. */
  addNotification: (title: string, body: string, type?: AppNotification['type']) => void;
  /** Mark every notification read. */
  markNotificationsRead: () => void;
  /** Mark one notification read or unread. */
  setNotificationRead: (id: string, read: boolean) => void;
  /** Remove one notification. */
  deleteNotification: (id: string) => void;
  clearNotifications: () => void;

  // --- AI ---
  /** Ask Gemini for a spending audit. Resolves to its raw JSON text, or an error message. */
  generateFinancialAudit: () => Promise<string>;

  // --- Backup ---
  /** Everything needed to restore the account, as a plain object (version 1 format). */
  exportAllData: () => object;
  /** Add the contents of an exportAllData() backup to this account. */
  importAllData: (data: any) => Promise<void>;
}


/** Delete many documents. A Firestore write batch holds at most 500 operations. */
const deleteInBatches = async (refs: DocumentReference[]) => {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
};

/** Sign-in options shown on the login screen. */
export type SocialProvider = 'Google' | 'GitHub' | 'Apple' | 'Facebook' | 'Phone';

/** Settings document for a brand-new account (before onboarding). */
const newUserSettingsDoc = (email: string | null | undefined, displayName?: string | null, avatar?: string | null) => ({
  email: email ?? null,
  displayName: displayName || 'User',
  avatar: avatar || '',
  hasCompletedOnboarding: false,
  theme: 'dark',
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,
  categoryBudgets: {},
  realizedSavings: 0,
  savingsGoals: [],
});

// --- Guest mode ---------------------------------------------------------------

/** Stand-in user for Guest mode. Only the fields the UI reads are set. */
const GUEST_USER = { uid: 'guest', displayName: 'Guest User', email: null, photoURL: null } as unknown as FirebaseUser;

/** Settings a new Guest session starts with (onboarding already done). */
const guestSettings = (): UserSettings => ({
  currency: 'INR',
  displayName: 'Guest User',
  hasCompletedOnboarding: true,
  theme: 'dark',
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,
  categoryBudgets: {},
  savingsGoals: [],
  realizedSavings: 0,
} as UserSettings);

/** What Guest mode keeps in localStorage between refreshes. */
interface GuestData {
  settings: UserSettings | null;
  transactions: Transaction[];
  impulseItems: ImpulseItem[];
}

/** Saved Guest-mode data, or null if there is none or it can't be read. */
const readGuestData = (): GuestData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEMO_DATA);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.impulseItems)) return null;
    return data as GuestData;
  } catch {
    return null;
  }
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
};

/**
 * Every Dashboard widget, in default order. The widget editor lists the keys in
 * the saved order, so a widget missing from it can never be shown; that's what
 * happened to 'comparison' and 'categoryBudgets'. withAllWidgets() repairs saved
 * orders from before a widget existed.
 */
const DEFAULT_ORDER = ['balance', 'income', 'expense', 'streak', 'shortcuts', 'comparison', 'categoryBudgets', 'breakdown', 'recent', 'quickAdd'];
const withAllWidgets = (order: string[]) => [...order, ...DEFAULT_ORDER.filter(key => !order.includes(key))];


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
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
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
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  const transactionsRef = useRef<Transaction[]>([]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  
  // App UI State
  const [isDemo, setIsDemo] = useState(false);
  // Restore Guest mode on refresh, including what the guest added. Without the
  // saved data a refresh used to wipe everything and leave settings empty.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEYS.DEMO_MODE) !== '1') return;
    const saved = readGuestData();
    setIsDemo(true);
    setUser(GUEST_USER);
    setUserSettings(saved?.settings ?? guestSettings());
    setTransactions(saved?.transactions ?? []);
    setImpulseItems(saved?.impulseItems ?? []);
    setLoading(false);
  }, []);

  // Save Guest-mode data on every change so a refresh keeps it. Writes can fail
  // when photos fill the ~5 MB storage quota; the data then just isn't kept.
  useEffect(() => {
    if (!isDemo) return;
    try {
      const data: GuestData = { settings: userSettings, transactions, impulseItems };
      localStorage.setItem(STORAGE_KEYS.DEMO_DATA, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save Guest-mode data:', err);
    }
  }, [isDemo, userSettings, transactions, impulseItems]);
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

  // 2b. Process recurring transactions once on first load
  const recurringProcessedRef = useRef(false);
  useEffect(() => {
    if (!user || isDemo || transactions.length === 0 || recurringProcessedRef.current) return;
    recurringProcessedRef.current = true;
    // Defer to avoid running before functions are defined
    setTimeout(() => processRecurringTransactions(), 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo, transactions.length]);


  // 3. Notification Observer
  useEffect(() => {
    if (!userSettings?.notificationPrefs) return;

    // Check budget thresholds when transactions or limit changes
    checkBudgetThresholds(transactions, userSettings.monthlyExpenseLimit || 0, userSettings.notificationPrefs, addNotification);
    checkCategoryBudgets(transactions, userSettings.categoryBudgets || {}, userSettings.notificationPrefs, addNotification);
    
    // Check monthly summary
    checkMonthlySummary(transactions, userSettings.notificationPrefs, addNotification);

    // Set up a timer for the daily 9 PM reminder
    const timer = setInterval(() => {
        checkDailyReminder(userSettings.notificationPrefs, addNotification);
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [transactions, userSettings?.monthlyExpenseLimit, userSettings?.categoryBudgets, userSettings?.notificationPrefs]);

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
          paymentMethods: data.paymentMethods !== undefined ? data.paymentMethods : DEFAULT_PAYMENT_METHODS,
          expenseCategories: data.expenseCategories !== undefined ? data.expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
          incomeCategories: data.incomeCategories !== undefined ? data.incomeCategories : DEFAULT_INCOME_CATEGORIES,
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
        if (data.widgetOrder) setWidgetOrder(withAllWidgets(data.widgetOrder));
        
        if (!settingsLoadedRef.current && data.appPin) setIsAppLocked(true);
        settingsLoadedRef.current = true;

        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(data.theme || 'dark');
      } else {
        const initial = {
            currency: 'INR', displayName: user.displayName || 'User', hasCompletedOnboarding: false, theme: 'dark' as const,
            paymentMethods: DEFAULT_PAYMENT_METHODS, expenseCategories: DEFAULT_EXPENSE_CATEGORIES, incomeCategories: DEFAULT_INCOME_CATEGORIES,
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
  
  /** Sign in with a popup, creating the settings document on first sign-in. */
  const signInWithProviderPopup = async (provider: AuthProvider) => {
    const { user: signedIn } = await signInWithPopup(auth, provider);
    const userRef = doc(db, 'users', signedIn.uid);
    if (!(await getDoc(userRef)).exists()) {
      await setDoc(userRef, newUserSettingsDoc(signedIn.email, signedIn.displayName, signedIn.photoURL));
    }
  };

  const googleLogin = () => signInWithProviderPopup(new GoogleAuthProvider());

  /**
   * Popup sign-in for the other providers on the login screen. Each must also be
   * enabled in the Firebase console, or Firebase rejects it with
   * auth/operation-not-allowed (which the login screen reports).
   */
  const loginWithProvider = async (provider: Exclude<SocialProvider, 'Google'>) => {
    if (provider === 'GitHub') return signInWithProviderPopup(new GithubAuthProvider());
    if (provider === 'Facebook') return signInWithProviderPopup(new FacebookAuthProvider());
    if (provider === 'Apple') return signInWithProviderPopup(new OAuthProvider('apple.com'));
    // Phone sign-in needs an SMS flow with reCAPTCHA, which isn't built yet.
    throw new Error("Phone sign-in isn't available yet.");
  };

  const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

  const signup = async (email: string, pass: string, name?: string, avatar?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    // Create the settings document first: if the verification email fails (e.g.
    // rate limit), the account still works.
    await setDoc(doc(db, 'users', cred.user.uid), newUserSettingsDoc(email, name, avatar));
    await fbSendEmailVerification(cred.user);
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
    if (user && !isDemo) {
        try {
            const uid = user.uid;
            // Firebase only allows account deletion shortly after sign-in. Check that before
            // touching any data, so the data is never deleted while the account survives.
            const lastSignIn = Date.parse(user.metadata.lastSignInTime || '');
            if (!lastSignIn || Date.now() - lastSignIn > 4 * 60 * 1000) {
                alert("Security Update: Please log out and log back in to confirm account deletion.");
                return;
            }
            // Delete the user's data while still signed in. Deleting the auth user first
            // made these writes run signed out, so Firestore rejected them and the data stayed.
            const ownedDocs = async (collectionName: string) =>
                (await getDocs(query(collection(db, collectionName), where('userId', '==', uid)))).docs;
            const refs = [
                ...(await ownedDocs('transactions')).map(d => d.ref),
                ...(await ownedDocs('impulse_items')).map(d => d.ref),
                doc(db, 'users', uid),
            ];
            await deleteInBatches(refs);
            await fbDeleteUser(user);
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
      localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
      localStorage.removeItem(STORAGE_KEYS.DEMO_DATA);
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

  const completeOnboarding = async (data: OnboardingData) => {
    await updateUserSettings({
      displayName: data.name, age: data.age, gender: data.gender, currency: data.currency,
      monthlyIncomeGoal: data.income, monthlyExpenseLimit: data.budget,
      financialGoal: data.goal, hasCompletedOnboarding: true,
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
        title: 'Initial Deposit', amount: data.initialBalance, date: toLocalISODate(),
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

  const setAppPin = async (pin: string) => {
      // Reject anything the keypad can't enter, otherwise the user is locked out for good.
      if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits.');
      const hashed = await hashPin(pin);
      setPinState(hashed);
      // Whoever sets a PIN is already unlocked (Settings) or has just re-authenticated
      // (Reset PIN), so leave the app unlocked.
      setIsAppLocked(false);
      await updateUserSettings({ appPin: hashed });
  };

  /**
   * Re-confirm the signed-in user's identity, for example before resetting the PIN.
   * Password accounts need the password. Google accounts confirm through a Google popup.
   */
  const reauthenticate = async (password?: string) => {
    const current = auth.currentUser;
    if (!current) throw new Error('Not signed in.');
    const hasPassword = current.providerData.some(p => p.providerId === 'password');
    if (hasPassword) {
      if (!current.email || !password) throw new Error('Password required.');
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
    } else {
      await reauthenticateWithPopup(current, new GoogleAuthProvider());
    }
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

  const unlockApp = async (pin: string): Promise<boolean> => { 
    if (!appPin) return false;
    // PINs saved before hashing was added are stored in plaintext. Accept them once,
    // then replace them with the hash so those users aren't locked out.
    if (!isHashedPin(appPin)) {
      if (pin !== appPin) return false;
      setIsAppLocked(false);
      if (isValidPin(pin)) {
        try { await setAppPin(pin); } catch (e) { console.warn('PIN migration failed', e); }
      }
      return true;
    }
    const hashed = await hashPin(pin);
    if (hashed === appPin) { setIsAppLocked(false); return true; }
    return false;
  };
  const lockApp = () => { if (appPin) setIsAppLocked(true); };

  // --- CRUD ---
  // In Guest mode nothing is saved to Firestore; changes live in memory until
  // the page is closed. These actions used to return without doing anything in
  // Guest mode, so adding a transaction looked broken.

  /** Timestamp shaped like Firestore's, for in-memory Guest-mode records. */
  const nowStamp = () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 });

  const addTransaction = async (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (!user) throw new Error("User not authenticated");
    if (isDemo) {
      setTransactions(prev => [{ ...tx, id: crypto.randomUUID(), userId: user.uid, createdAt: nowStamp() }, ...prev]);
      return;
    }
    await addDoc(collection(db, 'transactions'), { ...tx, userId: user.uid, createdAt: Timestamp.now() });
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    // Ownership guard: only delete if this transaction belongs to the current user
    if (!transactions.some(t => t.id === id)) return;
    if (isDemo) { setTransactions(prev => prev.filter(t => t.id !== id)); return; }
    await deleteDoc(doc(db, 'transactions', id));
  };

  // The duplicate check reads a ref, not the state updater, so the tone plays
  // once per real notification (updaters can run twice in development).
  const notificationsRef = useRef<AppNotification[]>([]);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

  const addNotification = (title: string, body: string, type: AppNotification['type'] = 'info') => {
    if (notificationsRef.current.some(n => n.title === title && n.body === body && !n.read)) return;
    const newNotif: AppNotification = { id: crypto.randomUUID(), title, body, timestamp: Date.now(), read: false, type };
    notificationsRef.current = [newNotif, ...notificationsRef.current];
    setNotifications(prev => [newNotif, ...prev].slice(0, MAX_STORED_NOTIFICATIONS));
    playTone(userSettings?.notificationTune);
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({...n, read: true})));
  };

  const setNotificationRead = (id: string, read: boolean) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read } : n)));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };
  
  const clearAllTransactions = async () => {
      if (!user || transactions.length === 0) return;
      if (isDemo) { setTransactions([]); return; }
      await deleteInBatches(transactions.map(tx => doc(db, 'transactions', tx.id)));
  };

  /**
   * Change some fields of a transaction. A field set to `undefined` is removed
   * (e.g. a deleted receipt photo); with ignoreUndefinedProperties it would
   * otherwise just be skipped and the old value kept.
   */
  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;
    // Ownership guard
    if (!transactions.some(t => t.id === id)) return;
    // Never write these back: id is the document key, and ownership can't change.
    const { id: _id, userId: _owner, ...fields } = updates;
    if (isDemo) {
      setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...fields } : t)));
      return;
    }
    const withRemovals = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, value === undefined ? deleteField() : value])
    );
    await setDoc(doc(db, 'transactions', id), { ...withRemovals, userId: user.uid }, { merge: true });
  };

  const restoreTransaction = async (tx: Transaction) => {
    if (!user) return;
    // Only restore a transaction that belongs to this user
    if (tx.userId !== user.uid) return;
    if (isDemo) { setTransactions(prev => [tx, ...prev.filter(t => t.id !== tx.id)]); return; }
    const { id, ...data } = tx;
    await setDoc(doc(db, 'transactions', id), data);
  };

  const showUndo = (tx: Transaction) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ show: true, item: tx });
    undoTimerRef.current = setTimeout(() => setUndoState({ show: false, item: null }), UNDO_WINDOW_MS);
  };

  const clearUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ show: false, item: null });
  };

  const addImpulseItem = async (item: Omit<ImpulseItem, 'id' | 'userId'>) => {
    if (!user) throw new Error("User not authenticated");
    if (isDemo) {
      setImpulseItems(prev => [{ ...item, id: crypto.randomUUID(), userId: user.uid }, ...prev]);
      return;
    }
    await addDoc(collection(db, 'impulse_items'), { ...item, userId: user.uid });
  };

  const deleteImpulseItem = async (id: string, resisted: boolean = false) => {
    if (!user || !userSettings) return;
    const item = impulseItems.find(i => i.id === id);
    if (isDemo) {
      if (resisted && item) updateUserSettings({ realizedSavings: (userSettings.realizedSavings || 0) + item.price });
      setImpulseItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    if (resisted && item) {
      // increment() is atomic, so two devices resisting at once both count.
      await setDoc(doc(db, 'users', user.uid), { realizedSavings: increment(item.price) }, { merge: true });
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
          const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
          return response.text || "Could not generate audit.";
      } catch (e: any) {
          console.warn('generateFinancialAudit failed:', e);
          return "Financial AI is currently unavailable. Please check your API key.";
      }
  };

  // --- RECURRING TRANSACTIONS ---
  const recurringProcessingRef = useRef(false);
  const processRecurringTransactions = async () => {
    if (!user || isDemo || recurringProcessingRef.current) return;
    recurringProcessingRef.current = true;
    try {
      const today = toLocalISODate();
      const due = transactions.filter(
        t => t.isRecurring && t.nextOccurrence && t.nextOccurrence <= today
      );
      for (const template of due) {
        const rule = template.recurrenceRule;
        if (!rule) continue;
        // The copies are ordinary transactions: they must not carry the recurring
        // fields, or they'd look like (and could become) templates themselves.
        const { id, nextOccurrence, createdAt, isRecurring, recurrenceRule, ...txData } = template;

        // Create every occurrence missed since the app was last opened, not just
        // one per launch, stopping at the rule's end date.
        let next = nextOccurrence!;
        while (next <= today && (!rule.endDate || next <= rule.endDate)) {
          await addDoc(collection(db, 'transactions'), {
            ...txData,
            date: next,
            userId: user.uid,
            createdAt: Timestamp.now(),
          });
          next = addInterval(next, rule.frequency, rule.interval || 1);
        }
        await updateDoc(doc(db, 'transactions', template.id), { nextOccurrence: next });
      }
    } finally {
      recurringProcessingRef.current = false;
    }
  };

  // --- BACKUP & RESTORE ---
  const exportAllData = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    userSettings,
    impulseItems,
  });

  const importAllData = async (data: any) => {
    if (!user || isDemo) return;
    if (data.version !== 1) throw new Error('Unsupported backup version');
    const batch = writeBatch(db);
    // Write transactions
    (data.transactions || []).forEach((tx: Transaction) => {
      const { id, ...rest } = tx;
      batch.set(doc(collection(db, 'transactions')), { ...rest, userId: user.uid });
    });
    // Write impulse items
    (data.impulseItems || []).forEach((item: any) => {
      const { id, ...rest } = item;
      batch.set(doc(collection(db, 'impulse_items')), { ...rest, userId: user.uid });
    });
    // Write settings
    if (data.userSettings) {
      batch.set(doc(db, 'users', user.uid), { ...data.userSettings }, { merge: true });
    }
    await batch.commit();
  };

  return (
    <StoreContext.Provider value={{
      user, userSettings, loading, transactions, impulseItems, login, signup, googleLogin, loginWithProvider, resetPassword, logout, 
      updatePassword, deleteAccount, refreshUser,
      addTransaction, deleteTransaction, updateTransaction, restoreTransaction, clearAllTransactions,
      addImpulseItem, deleteImpulseItem, viewingTransaction, setViewingTransaction,
      widgets, toggleWidget, widgetOrder, updateWidgetOrder, completeOnboarding, updateUserSettings, 
      toggleTheme: async () => { const newTheme = userSettings?.theme === 'light' ? 'dark' : 'light'; updateUserSettings({ theme: newTheme }); },
      enableDemo: () => {
        // Each new Guest session starts empty.
        localStorage.removeItem(STORAGE_KEYS.DEMO_DATA);
        setIsDemo(true);
        setUser(GUEST_USER);
        setUserSettings(guestSettings());
        setTransactions([]);
        setImpulseItems([]);
        setLoading(false);
        localStorage.setItem(STORAGE_KEYS.DEMO_MODE, '1');
      }, isDemo,
      isPinSet: !!appPin, isAppLocked, setAppPin, removeAppPin, unlockApp, lockApp,
      undoState, showUndo, clearUndo,
      notifications, addNotification, markNotificationsRead, setNotificationRead, deleteNotification, clearNotifications,
      generateFinancialAudit, verifyBiometric, sendVerificationEmail, reauthenticate,
      exportAllData, importAllData,
    }}>
      {children}
    </StoreContext.Provider>
  );
};
