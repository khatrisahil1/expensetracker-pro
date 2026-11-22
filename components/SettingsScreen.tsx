// Profile page (/settings), laid out like Apple's account settings: a centred
// identity header, then inset grouped lists that open detail pages. On phones a
// row opens its page full-screen (with "< Profile" to go back); on wide screens
// the list stays on the left and the page shows on the right.
// The open page is kept in the URL (?section=…), so the browser Back button and
// shared links work.
//
// Removed from the old layout because they did nothing or weren't true:
// Language and Date format (saved but never used anywhere), the
// "Pro Plan" card with all-time totals labelled "Monthly", the "persona" badge,
// and the "Save All Lists" button (lists already save on every change).
import React, { useEffect, useState } from 'react';
import { version } from '../package.json';
import { useSearchParams } from 'react-router';
import { useStore } from '../context/Store';
import BackupRestoreModal from './BackupRestoreModal';
import CSVImportModal from './CSVImportModal';
import { DetailHeader, Group, Row, Switch, rowInputClass } from './settings/SettingsList';
import { useDialog } from './ui/DialogProvider';
import AvatarEditor from './AvatarEditor';
import { celebrate } from '../utils/celebrate';
import { downloadFile, downloadTransactionsCsv } from '../utils/csv';
import { toLocalISODate } from '../utils/date';
import { requestNotificationPermission } from '../utils/notifications';
import { NOTIFICATION_TONES, TONE_DESCRIPTIONS, isTone, playTone, type NotificationTone } from '../utils/sounds';
import { CURRENCIES, getCurrencySymbol } from '../utils/currency';

/** Detail pages, in the order they appear in the list. */
type Section = 'personal' | 'security' | 'notifications' | 'general' | 'categories' | 'data' | 'help';
const SECTIONS: Section[] = ['personal', 'security', 'notifications', 'general', 'categories', 'data', 'help'];

const TITLES: Record<Section, string> = {
  personal: 'Personal Information',
  security: 'Sign-In & Security',
  notifications: 'Notifications',
  general: 'Currency & Appearance',
  categories: 'Categories & Payment Methods',
  data: 'Export & Backup',
  help: 'Help & Support',
};

const NOTIFICATION_PREFS = [
  { id: 'dailyCheckIn', label: 'Daily reminder', desc: 'A nudge at 9 PM to log the day’s spending' },
  { id: 'budgetThresholds', label: 'Budget alerts', desc: 'When a category reaches 80% of its cap' },
  { id: 'monthlyInsights', label: 'Monthly summary', desc: 'Last month’s totals, on the 1st' },
  { id: 'tipsAndTricks', label: 'Tips', desc: 'Occasional money tips and new features' },
] as const;
type NotifPrefs = Record<(typeof NOTIFICATION_PREFS)[number]['id'], boolean>;

// Single source of truth: the "version" in package.json (only that field is bundled).
const APP_VERSION = version;

const SettingsScreen: React.FC = () => {
  const {
    logout, user, updateUserSettings, userSettings, toggleTheme, updatePassword, deleteAccount,
    setAppPin, removeAppPin, sendVerificationEmail, refreshUser, transactions, clearAllTransactions,
    enablePushNotifications, disablePushNotifications,
  } = useStore();

  // --- Navigation -----------------------------------------------------------
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') as Section | null;
  const section: Section | null = requested && SECTIONS.includes(requested) ? requested : null;
  const open = (s: Section) => setParams({ section: s });
  const back = () => setParams({});
  /** On wide screens a page is always shown; default to Personal Information. */
  const desktopSection: Section = section ?? 'personal';

  const dialog = useDialog();

  // --- Local state ----------------------------------------------------------
  const [isSaving, setIsSaving] = useState(false);
  /** True while App Lock is being turned on or off, so the switch shows a spinner. */
  const [pinBusy, setPinBusy] = useState(false);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  /** Message inside the PIN keypad, e.g. when the two entries didn't match. */
  const [pinError, setPinError] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [accountForm, setAccountForm] = useState({ name: '', gender: '', birthday: '', location: '', avatar: '' });
  const [passForm, setPassForm] = useState({ new: '', confirm: '' });

  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [newItems, setNewItems] = useState({ pay: '', exp: '', inc: '' });

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ dailyCheckIn: true, budgetThresholds: true, monthlyInsights: true, tipsAndTricks: true });

  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinSetupStep, setPinSetupStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (!userSettings) return;
    setAccountForm({
      name: userSettings.displayName || '',
      gender: userSettings.gender || '',
      birthday: userSettings.birthday || '',
      location: userSettings.location || '',
      avatar: userSettings.avatar || '',
    });
    setPaymentMethods(userSettings.paymentMethods || []);
    setExpenseCategories(userSettings.expenseCategories || []);
    setIncomeCategories(userSettings.incomeCategories || []);
    if (userSettings.notificationPrefs) setNotifPrefs(userSettings.notificationPrefs as NotifPrefs);
  }, [userSettings]);

  const showToast = (msg: string, kind: 'success' | 'error' | 'info' = 'success') => dialog.toast(msg, kind);

  // --- Derived ---------------------------------------------------------------
  const displayName = userSettings?.displayName || user?.displayName || 'Your name';
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const joined = (() => {
    const created = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
    return created && !isNaN(created.getTime()) ? created.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;
  })();
  const isPasswordUser = !!user?.providerData?.some(p => p.providerId === 'password');
  const currency = userSettings?.currency || 'INR';
  const enabledNotifs = NOTIFICATION_PREFS.filter(p => notifPrefs[p.id]).length;
  /** Distinct days with at least one entry. */
  const daysTracked = React.useMemo(() => new Set(transactions.map(t => t.date)).size, [transactions]);

  // --- Handlers --------------------------------------------------------------
  const handleAccountSave = async () => {
    setIsSaving(true);
    try {
      await updateUserSettings({
        displayName: accountForm.name.trim(),
        gender: accountForm.gender,
        birthday: accountForm.birthday,
        location: accountForm.location.trim(),
        avatar: accountForm.avatar,
      });
      showToast('Saved');
    } finally {
      setIsSaving(false);
    }
  };

  /** Save from the picture editor ('' removes the picture). */
  const handleAvatarSave = async (avatar: string) => {
    try {
      setAccountForm(prev => ({ ...prev, avatar }));
      await updateUserSettings({ avatar });
      showToast(avatar ? 'Picture updated' : 'Picture removed');
      if (avatar) celebrate(null, 'hearts', 12);
    } catch (err) {
      console.error('Avatar save failed', err);
      showToast('Could not save the picture', 'error');
    }
  };

  const handlePassUpdate = async () => {
    if (passForm.new.length < 8) return showToast('Use at least 8 characters.', 'error');
    if (passForm.new !== passForm.confirm) return showToast('The passwords don’t match.', 'error');
    try {
      setIsSaving(true);
      await updatePassword(passForm.new);
      setPassForm({ new: '', confirm: '' });
      showToast('Password changed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not change the password.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveLists = async (pay: string[], exp: string[], inc: string[]) => {
    setPaymentMethods(pay); setExpenseCategories(exp); setIncomeCategories(inc);
    await updateUserSettings({ paymentMethods: pay, expenseCategories: exp, incomeCategories: inc });
  };
  const listFor = (key: 'pay' | 'exp' | 'inc') => (key === 'pay' ? paymentMethods : key === 'exp' ? expenseCategories : incomeCategories);
  const withList = (key: 'pay' | 'exp' | 'inc', next: string[]) =>
    saveLists(key === 'pay' ? next : paymentMethods, key === 'exp' ? next : expenseCategories, key === 'inc' ? next : incomeCategories);
  const addListItem = async (key: 'pay' | 'exp' | 'inc') => {
    const val = newItems[key].trim();
    if (!val) return;
    setNewItems({ ...newItems, [key]: '' });
    if (listFor(key).some(v => v.toLowerCase() === val.toLowerCase())) return showToast(`"${val}" is already there`, 'info');
    await withList(key, [...listFor(key), val]);
  };
  const removeListItem = (key: 'pay' | 'exp' | 'inc', val: string) => withList(key, listFor(key).filter(v => v !== val));

  const handleExportData = (format: 'csv' | 'json') => {
    const baseName = `expense_tracker_data_${toLocalISODate()}`;
    if (format === 'json') downloadFile(JSON.stringify(transactions, null, 2), `${baseName}.json`, 'application/json');
    else downloadTransactionsCsv(transactions, baseName);
    showToast(`Exported ${format.toUpperCase()}`);
  };

  const handleClearData = async () => {
    const ok = await dialog.confirm({
      title: `Delete all ${transactions.length} transactions?`,
      message: 'Categories, budgets and other settings stay. This can’t be undone.',
      confirmLabel: 'Delete All', destructive: true,
    });
    if (!ok) return;
    setIsSaving(true);
    try {
      await clearAllTransactions();
      showToast('All transactions deleted');
    } finally {
      setIsSaving(false);
    }
  };

  // Push notifications for this device (works when the app is closed).
  const pushConfigured = !!import.meta.env.VITE_FCM_VAPID_KEY;
  const isGuest = !user?.email;
  const [pushOn, setPushOn] = useState(() => { try { return !!localStorage.getItem('push:token'); } catch { return false; } });
  const [pushBusy, setPushBusy] = useState(false);
  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    try {
      if (!next) { await disablePushNotifications(); setPushOn(false); showToast('Push notifications off'); return; }
      const result = await enablePushNotifications();
      if (result === 'enabled') { setPushOn(true); showToast('Push notifications on 🔔'); }
      else if (result === 'denied') showToast('Notifications are blocked. Allow them in your browser settings.', 'error');
      else if (result === 'unsupported') showToast('This browser can’t receive push notifications. Try installing the app.', 'info');
      else if (result === 'not-configured') showToast('Push isn’t set up for this app yet.', 'info');
      else showToast('Couldn’t turn on push notifications.', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  /** Selected notification tone; older accounts without one use Aurora. */
  const tone: NotificationTone = isTone(userSettings?.notificationTune) ? userSettings!.notificationTune as NotificationTone : 'Aurora';
  const chooseTone = (t: NotificationTone) => {
    playTone(t); // preview on every tap, even the current one
    if (t !== tone) updateUserSettings({ notificationTune: t });
  };

  const toggleNotif = async (id: keyof NotifPrefs, next: boolean) => {
    if (next) await requestNotificationPermission();
    const updated = { ...notifPrefs, [id]: next };
    setNotifPrefs(updated);
    updateUserSettings({ notificationPrefs: updated });
  };

  // App lock.
  // Turning it off used window.confirm(), which embedded browsers can block or
  // answer "Cancel" to without showing anything, so the switch did nothing. A
  // mismatched PIN used alert() the same way. Both are in-app now, and failures
  // are reported instead of being swallowed.
  const startPinSetup = () => { setPinSetupStep(1); setFirstPin(''); setConfirmPin(''); setPinError(''); setShowPinSetup(true); };
  const handlePinToggle = async (next: boolean) => {
    if (next) return startPinSetup();
    const ok = await dialog.confirm({
      title: 'Turn off App Lock?',
      message: 'The app will open without asking for your PIN. Your PIN will be removed.',
      confirmLabel: 'Turn Off', destructive: true,
    });
    if (!ok) return;
    setPinBusy(true);
    try {
      await removeAppPin();
      showToast('App Lock is off');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not turn off App Lock.', 'error');
    } finally {
      setPinBusy(false);
    }
  };
  const handlePinKey = async (digit: string) => {
    setPinError('');
    const current = pinSetupStep === 1 ? firstPin : confirmPin;
    if (current.length >= 4) return;
    const updated = current + digit;
    if (pinSetupStep === 1) {
      setFirstPin(updated);
      if (updated.length === 4) setTimeout(() => setPinSetupStep(2), 180); // let the 4th dot fill first
      return;
    }
    setConfirmPin(updated);
    if (updated.length < 4) return;
    if (updated !== firstPin) {
      setPinError('The PINs didn’t match. Enter a new PIN again.');
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      setTimeout(() => { setPinSetupStep(1); setFirstPin(''); setConfirmPin(''); }, 450);
      return;
    }
    setPinBusy(true);
    try {
      const wasOn = !!userSettings?.appPin;
      await setAppPin(updated);
      setShowPinSetup(false);
      showToast(wasOn ? 'PIN changed' : 'App Lock is on');
      celebrate(null, 'confetti', 14);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Could not save the PIN.');
    } finally {
      setPinBusy(false);
    }
  };
  const handlePinBackspace = () => {
    setPinError('');
    if (pinSetupStep === 1) setFirstPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  };

  // Physical keyboard support for the PIN keypad (digits, Backspace, Escape).
  useEffect(() => {
    if (!showPinSetup) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) handlePinKey(e.key);
      else if (e.key === 'Backspace') handlePinBackspace();
      else if (e.key === 'Escape') setShowPinSetup(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleSendVerificationEmail = async () => {
    if (user?.emailVerified) return;
    try {
      await sendVerificationEmail();
      showToast('Verification email sent');
    } catch (err) {
      console.error(err);
      showToast('Could not send the email', 'error');
    }
  };

  // --- Pages -----------------------------------------------------------------
  const renderSection = (s: Section) => {
    switch (s) {
      case 'personal':
        return (
          <div className="flex flex-col gap-8 stagger">
            <Group header="Name and details" footer="Your name appears in greetings around the app. The other details are optional and only stored on your account.">
              <Row label="Profile picture" onClick={() => setShowAvatarEditor(true)}
                trailing={<span className="size-9 rounded-full overflow-hidden bg-primary/15 text-primary text-xs font-black flex items-center justify-center ring-2 ring-primary/20">
                  {userSettings?.avatar ? <img src={userSettings.avatar} alt="" className="w-full h-full object-cover" /> : (initials || '?')}
                </span>} />
              <Row label="Name" trailing={<input aria-label="Name" className={rowInputClass} value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Required" />} />
              <Row label="Email" value={user?.email || '—'} />
              <Row label="Gender" trailing={
                <select aria-label="Gender" className={`${rowInputClass} cursor-pointer pr-7 bg-right`} value={accountForm.gender} onChange={e => setAccountForm({ ...accountForm, gender: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Secret">Prefer not to say</option>
                </select>
              } />
              <Row label="Birthday" trailing={<input aria-label="Birthday" type="date" className={rowInputClass} value={accountForm.birthday} onChange={e => setAccountForm({ ...accountForm, birthday: e.target.value })} />} />
              <Row label="Location" trailing={<input aria-label="Location" className={rowInputClass} value={accountForm.location} onChange={e => setAccountForm({ ...accountForm, location: e.target.value })} placeholder="City, Country" />} />
            </Group>
            <div className="flex justify-end">
              <button onClick={handleAccountSave} disabled={isSaving || !accountForm.name.trim()} className="px-6 py-2.5 rounded-full bg-primary text-[#131811] text-[15px] font-semibold disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {isPasswordUser && (
              <Group header="Password" footer="At least 8 characters. You may be asked to sign in again first.">
                <Row label="New password" trailing={<input aria-label="New password" type="password" autoComplete="new-password" className={rowInputClass} value={passForm.new} onChange={e => setPassForm({ ...passForm, new: e.target.value })} />} />
                <Row label="Confirm" trailing={<input aria-label="Confirm new password" type="password" autoComplete="new-password" className={rowInputClass} value={passForm.confirm} onChange={e => setPassForm({ ...passForm, confirm: e.target.value })} />} />
                <Row label="Change Password" onClick={handlePassUpdate} disabled={isSaving || !passForm.new} centered />
              </Group>
            )}

            <Group footer="Deletes your account, transactions, vault items and settings. This can’t be undone.">
              <Row label="Delete Account" destructive centered onClick={async () => {
                if (await dialog.confirm({ title: 'Delete your account?', message: 'Your transactions, vault items and settings will be deleted. This can’t be undone.', confirmLabel: 'Delete Account', destructive: true })) deleteAccount();
              }} />
            </Group>
          </div>
        );

      case 'security':
        return (
          <div className="flex flex-col gap-8 stagger">
            <Group header="App Lock" footer="Asks for a 4-digit PIN when the app opens. Biometrics can be used instead of the PIN on supported devices.">
              <Row icon="lock" tile="gray" label="Require PIN" trailing={<Switch label="Require PIN" checked={!!userSettings?.appPin} onChange={handlePinToggle} busy={pinBusy} />} />
              {userSettings?.appPin && (
                <>
                  <Row icon="fingerprint" tile="green" label="Use biometrics" trailing={<Switch label="Use biometrics" checked={!!userSettings?.biometricEnabled} onChange={v => updateUserSettings({ biometricEnabled: v })} />} />
                  <Row icon="pin" tile="blue" label="Change PIN" onClick={startPinSetup} />
                </>
              )}
            </Group>
            <Group header="Email" footer={user?.emailVerified ? 'Your email address is confirmed.' : 'Confirm your email so you can reset your password if you forget it.'}>
              <Row
                icon="mail" tile="indigo" label={user?.email || 'Email'}
                value={user?.emailVerified ? 'Verified' : undefined}
                trailing={!user?.emailVerified && (
                  <span className="flex gap-2">
                    <button onClick={async () => { await refreshUser(); showToast('Status refreshed'); }} className="text-[15px] text-text-light-muted">Refresh</button>
                    <button onClick={handleSendVerificationEmail} className="text-[15px] font-semibold text-primary">Verify</button>
                  </span>
                )}
              />
            </Group>
          </div>
        );

      case 'notifications':
        return (
          <div className="flex flex-col gap-8 stagger">
            <Group header="Alerts" footer="Notifications need permission from your browser or phone. You’ll be asked the first time you turn one on.">
              {NOTIFICATION_PREFS.map(p => (
                <Row key={p.id} label={p.label} detail={p.desc} trailing={<Switch label={p.label} checked={notifPrefs[p.id]} onChange={v => toggleNotif(p.id, v)} />} />
              ))}
            </Group>
            <Group header="When the app is closed"
              footer={pushConfigured
                ? 'Bill reminders and budget alerts arrive even when the app is closed. You can turn this off any time.'
                : 'Not available yet: push needs a Web Push key and a reminder server to be set up (see the developer guide).'}>
              <Row icon="notifications_active" tile="indigo" label="Push notifications" detail={pushConfigured ? (pushOn ? 'On for this device' : 'Off') : 'Coming soon'}
                trailing={<Switch label="Push notifications" checked={pushOn} onChange={togglePush} busy={pushBusy} disabled={!pushConfigured || isGuest} />} />
            </Group>
            <Group header="Sound" footer="Tap a tone to hear it. It plays when a new notification arrives while the app is open.">
              {NOTIFICATION_TONES.map(t => {
                const selected = tone === t;
                return (
                  <Row key={t} icon={selected ? 'graphic_eq' : 'music_note'} tile={selected ? 'green' : 'gray'} label={t} detail={TONE_DESCRIPTIONS[t]}
                    onClick={() => chooseTone(t)}
                    trailing={
                      <span className={`material-symbols-outlined text-[22px] text-primary transition-all duration-300 ${selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} aria-hidden="true">check_circle</span>
                    } />
                );
              })}
            </Group>
          </div>
        );

      case 'general':
        return (
          <div className="flex flex-col gap-8 stagger">
            <Group header="Currency" footer="Changes the symbol shown with every amount. Amounts aren’t converted.">
              {CURRENCIES.map(c => (
                <Row key={c.code} label={c.name} value={c.symbol}
                  trailing={<span className={`material-symbols-outlined text-[20px] text-primary ${currency === c.code ? '' : 'invisible'}`} aria-hidden="true">check</span>}
                  onClick={currency === c.code ? undefined : () => updateUserSettings({ currency: c.code })} />
              ))}
            </Group>
            <Group header="Appearance">
              <div className="p-3">
                <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-gray-100 dark:bg-black/30">
                  {(['light', 'dark'] as const).map(theme => (
                    <button key={theme} role="radio" aria-checked={userSettings?.theme === theme}
                      onClick={() => userSettings?.theme !== theme && toggleTheme()}
                      className={`py-2 rounded-[8px] text-[15px] font-medium capitalize transition-colors ${userSettings?.theme === theme ? 'bg-white dark:bg-surface-dark shadow-sm text-text-light-main dark:text-text-dark-main' : 'text-text-light-muted'}`}>
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
            </Group>
          </div>
        );

      case 'categories':
        return (
          <div className="flex flex-col gap-8 stagger">
            {([
              { key: 'exp', header: 'Expense categories', placeholder: 'Add category' },
              { key: 'inc', header: 'Income categories', placeholder: 'Add category' },
              { key: 'pay', header: 'Payment methods', placeholder: 'Add method, e.g. Credit card' },
            ] as const).map(g => (
              <Group key={g.key} header={g.header} footer={g.key === 'exp' ? 'Removing a category doesn’t change past transactions.' : undefined}>
                {listFor(g.key).map(v => (
                  <Row key={v} label={v} trailing={
                    <button onClick={() => removeListItem(g.key, v)} aria-label={`Remove ${v}`} className="size-7 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10">
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">remove_circle</span>
                    </button>
                  } />
                ))}
                <form className="flex items-center gap-3 px-4 min-h-[52px]" onSubmit={e => { e.preventDefault(); addListItem(g.key); }}>
                  <span className="material-symbols-outlined text-[20px] text-emerald-500" aria-hidden="true">add_circle</span>
                  <input aria-label={g.placeholder} value={newItems[g.key]} onChange={e => setNewItems({ ...newItems, [g.key]: e.target.value })}
                    placeholder={g.placeholder} className="flex-1 bg-transparent border-0 shadow-none p-0 focus:ring-0 text-[15px] outline-none text-text-light-main dark:text-text-dark-main placeholder:text-text-light-muted/70" />
                  {newItems[g.key].trim() && <button type="submit" className="text-[15px] font-semibold text-primary">Add</button>}
                </form>
              </Group>
            ))}
          </div>
        );

      case 'data':
        return (
          <div className="flex flex-col gap-8 stagger">
            <Group header="Export" footer={`${transactions.length} transactions. CSV opens in any spreadsheet; JSON is a complete copy.`}>
              <Row icon="table_view" tile="green" label="Export as CSV" onClick={() => handleExportData('csv')} />
              <Row icon="data_object" tile="orange" label="Export as JSON" onClick={() => handleExportData('json')} />
            </Group>
            <Group header="Import and restore">
              <Row icon="upload_file" tile="blue" label="Import from CSV" detail="Bank statements or another app" onClick={() => setShowImportModal(true)} />
              <Row icon="cloud_sync" tile="indigo" label="Backup & Restore" detail="Save or load a full snapshot" onClick={() => setShowBackupModal(true)} />
            </Group>
            <Group footer="Deletes every transaction. Categories, budgets and other settings stay.">
              <Row label={isSaving ? 'Deleting…' : 'Delete All Transactions'} destructive centered disabled={isSaving || transactions.length === 0} onClick={handleClearData} />
            </Group>
          </div>
        );

      case 'help':
        return (
          <div className="flex flex-col gap-8 stagger">
            <Group>
              <Row icon="mail" tile="blue" label="Contact support" detail="hello@expensetracker.pro" onClick={() => { window.location.href = 'mailto:hello@expensetracker.pro'; }} />
              <Row icon="refresh" tile="gray" label="Reload app" detail="Fetches the latest version" onClick={() => window.location.reload()} />
            </Group>
            <p className="text-center text-[13px] text-text-light-muted dark:text-text-dark-muted">ExpenseTracker Pro · Version {APP_VERSION}</p>
          </div>
        );
    }
  };

  // --- Layout ----------------------------------------------------------------
  const profileList = (
    <div className="flex flex-col gap-7 stagger">
      {/* Identity card, in the same style as the Dashboard's balance card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-card-light dark:shadow-glow p-6 pt-8">
        <div className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-primary/20 blur-[90px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 size-56 rounded-full bg-sky-500/10 blur-[90px]" aria-hidden="true" />
        <div className="relative flex flex-col items-center text-center gap-4">
          <button type="button" onClick={() => setShowAvatarEditor(true)} className="relative cursor-pointer group animate-pop" title="Edit picture">
            <span className="sr-only">Edit profile picture</span>
            {/* Gradient ring that slowly turns on hover */}
            <span className="absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,#2ECC71,#38bdf8,#a78bfa,#2ECC71)] opacity-80 group-hover:animate-[spin_4s_linear_infinite]" aria-hidden="true" />
            <span className="relative block size-24 rounded-full overflow-hidden border-4 border-surface-light dark:border-surface-dark bg-gradient-to-br from-primary/40 to-sky-500/30">
              {userSettings?.avatar
                ? <img src={userSettings.avatar} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                : <span className="w-full h-full flex items-center justify-center text-white text-3xl font-black">{initials || '?'}</span>}
            </span>
            <span className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary text-[#131811] border-4 border-surface-light dark:border-surface-dark flex items-center justify-center transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
            </span>
          </button>
          {showAvatarEditor && (
            <AvatarEditor current={userSettings?.avatar} gender={userSettings?.gender} initials={initials || '?'}
              onSave={handleAvatarSave} onClose={() => setShowAvatarEditor(false)} />
          )}
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">{displayName}</h2>
            <p className="text-sm font-medium text-text-light-muted dark:text-text-dark-muted">{user?.email || 'Guest'}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {joined && (
              <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-border-light dark:border-border-dark text-[11px] font-bold text-text-light-muted dark:text-text-dark-muted flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">calendar_month</span>Since {joined}
              </span>
            )}
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${userSettings?.appPin ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{userSettings?.appPin ? 'lock' : 'lock_open'}</span>
              {userSettings?.appPin ? 'App Lock on' : 'App Lock off'}
            </span>
          </div>
          {/* Real numbers only */}
          <div className="grid grid-cols-3 w-full mt-1 rounded-2xl bg-gray-50 dark:bg-black/20 border border-border-light dark:border-border-dark divide-x divide-border-light dark:divide-border-dark">
            {[
              { value: transactions.length.toLocaleString(), label: 'Entries' },
              { value: daysTracked.toLocaleString(), label: 'Days logged' },
              { value: (expenseCategories.length + incomeCategories.length).toLocaleString(), label: 'Categories' },
            ].map(stat => (
              <div key={stat.label} className="py-3 flex flex-col items-center">
                <span className="text-lg font-black text-text-light-main dark:text-text-dark-main tabular-nums">{stat.value}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-light-muted dark:text-text-dark-muted">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Group header="Account">
        <Row icon="person" tile="green" label="Personal Information" detail="Name, photo, password" selected={desktopSection === 'personal'} onClick={() => open('personal')} />
        <Row icon="shield_lock" tile="blue" label="Sign-In & Security" detail="App Lock, email" value={userSettings?.appPin ? 'On' : 'Off'} selected={desktopSection === 'security'} onClick={() => open('security')} />
        <Row icon="notifications" tile="red" label="Notifications" detail={`Sound: ${tone}`} value={`${enabledNotifs} of ${NOTIFICATION_PREFS.length}`} selected={desktopSection === 'notifications'} onClick={() => open('notifications')} />
      </Group>

      <Group header="Preferences">
        <Row icon="currency_exchange" tile="yellow" label="Currency & Appearance" value={`${getCurrencySymbol(currency)} · ${userSettings?.theme === 'light' ? 'Light' : 'Dark'}`} selected={desktopSection === 'general'} onClick={() => open('general')} />
        <Row icon="category" tile="orange" label="Categories & Payment Methods" value={`${expenseCategories.length + incomeCategories.length + paymentMethods.length}`} selected={desktopSection === 'categories'} onClick={() => open('categories')} />
      </Group>

      <Group header="Data">
        <Row icon="database" tile="indigo" label="Export & Backup" selected={desktopSection === 'data'} onClick={() => open('data')} />
        <Row icon="help" tile="teal" label="Help & Support" selected={desktopSection === 'help'} onClick={() => open('help')} />
      </Group>

      <Group>
        <Row icon="logout" tile="red" label="Sign Out" destructive onClick={async () => {
          if (await dialog.confirm({ title: 'Sign out?', message: 'You can sign back in any time. Your data stays in your account.', confirmLabel: 'Sign Out' })) logout();
        }} />
      </Group>

      <p className="text-center text-xs font-semibold text-text-light-muted dark:text-text-dark-muted -mt-3">
        ExpenseTracker Pro · Version {APP_VERSION}
      </p>
    </div>
  );

  const pinValue = pinSetupStep === 1 ? firstPin : confirmPin;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:px-10 md:py-10 pb-32">
      {/* Page title, styled like the other pages */}
      <div className={`flex flex-col gap-1 mb-8 animate-slide-up ${section ? 'hidden lg:flex' : 'flex'}`}>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">Profile</h1>
        <p className="text-sm md:text-base text-text-light-muted dark:text-text-dark-muted">Your account, security and preferences.</p>
      </div>

      {/* PIN keypad */}
      {showPinSetup && (
        <div role="dialog" aria-modal="true" aria-label="Set app PIN" className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setShowPinSetup(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-xs rounded-[2.5rem] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-7 flex flex-col items-center gap-5 shadow-2xl animate-sheet-in">
            <span className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pop">
              <span className="material-symbols-outlined text-[28px]" aria-hidden="true">{pinSetupStep === 1 ? 'lock' : 'lock_reset'}</span>
            </span>
            <div className="text-center" key={pinSetupStep}>
              <h3 className="text-xl font-black animate-fade-in">{pinSetupStep === 1 ? 'Choose a PIN' : 'Confirm your PIN'}</h3>
              <p className={`text-xs mt-1 min-h-[1rem] ${pinError ? 'text-danger font-semibold' : 'text-text-light-muted'}`} role={pinError ? 'alert' : undefined}>
                {pinError || (pinSetupStep === 1 ? '4 digits. You’ll enter it when the app opens.' : 'Enter the same 4 digits again.')}
              </p>
            </div>
            <div className={`flex gap-4 ${pinError ? 'animate-shake' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3].map(i => {
                const filled = i < pinValue.length;
                return <span key={i} className={`size-4 rounded-full border-2 transition-all duration-200 ${pinError ? 'border-danger bg-danger' : filled ? 'bg-primary border-primary scale-110 shadow-glow' : 'border-gray-300 dark:border-white/20'}`} />;
              })}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(k =>
                k === '' ? <span key="blank" aria-hidden="true" /> : (
                  <button key={k} aria-label={k === 'del' ? 'Delete digit' : k} disabled={pinBusy}
                    onClick={() => (k === 'del' ? handlePinBackspace() : handlePinKey(k))}
                    className={`size-16 rounded-full text-2xl font-black flex items-center justify-center transition-colors ${k === 'del' ? 'text-text-light-muted hover:text-danger' : 'bg-gray-100 dark:bg-white/[0.06] hover:bg-primary/15 hover:text-primary'}`}>
                    {k === 'del' ? <span className="material-symbols-outlined" aria-hidden="true">backspace</span> : k}
                  </button>
                ))}
            </div>
            <button onClick={() => setShowPinSetup(false)} className="text-sm font-bold text-text-light-muted hover:text-text-light-main dark:hover:text-text-dark-main">
              {pinBusy ? 'Saving…' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-10">
        {/* List: always on desktop; on phones only when no page is open */}
        <div className={section ? 'hidden lg:block' : 'block'}>{profileList}</div>

        {/* Detail page: always on desktop; on phones only when one is open.
            key restarts the entrance animation when switching pages. */}
        <div className={section ? 'block' : 'hidden lg:block'} key={section ?? desktopSection}>
          <DetailHeader title={TITLES[section ?? desktopSection]} onBack={back} />
          {renderSection(section ?? desktopSection)}
        </div>
      </div>

      {showBackupModal && <BackupRestoreModal onClose={() => setShowBackupModal(false)} />}
      {showImportModal && <CSVImportModal onClose={() => setShowImportModal(false)} />}
    </div>
  );
};

export default SettingsScreen;
