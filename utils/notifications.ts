// Budget, reminder and subscription notifications. Each one is shown in the
// app's notification panel (via `onNotify`) and, if the user allowed it, as a
// system notification.
import type { AppNotification, Transaction, UserSettings } from '../context/Store';
import { BUDGET_WARNING_PERCENT, DAILY_REMINDER_HOUR, STORAGE_KEYS } from '../constants/app';
import { parseLocalDate } from './date';

/** Adds an entry to the in-app notification panel (Store.addNotification). */
export type NotifyFn = (title: string, body: string, type?: AppNotification['type']) => void;

type NotificationPrefs = UserSettings['notificationPrefs'];

/** Icon for system notifications (an existing PWA icon). */
const NOTIFICATION_ICON = '/pwa-192.png';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const hasNotificationApi = () => typeof Notification !== 'undefined';

/** Ask for system-notification permission. Resolves false where notifications aren't supported. */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!hasNotificationApi()) return false;
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
};

/** Show a system notification. Prefers the service worker, because Android Chrome throws on `new Notification()`. */
const showSystemNotification = async (title: string, options: NotificationOptions) => {
    // iOS Safari has no Notification API outside an installed PWA; reading it
    // unguarded used to throw inside a React effect and blank the whole app.
    if (!hasNotificationApi() || Notification.permission !== 'granted') return;
    const fullOptions = { icon: NOTIFICATION_ICON, badge: NOTIFICATION_ICON, ...options };
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) await registration.showNotification(title, fullOptions);
        else new Notification(title, fullOptions);
    } catch (e) {
        console.warn('System notification failed:', e);
    }
};

/**
 * Send a notification. With a `tag`, the same notification is sent at most
 * once per day. Returns false when it was skipped for that reason.
 */
export const sendNotification = (
    title: string,
    options: NotificationOptions & { tag?: string } = {},
    onNotify?: NotifyFn,
    type: AppNotification['type'] = 'info',
): boolean => {
    const { tag } = options;
    if (tag) {
        const today = new Date().toDateString();
        if (localStorage.getItem(STORAGE_KEYS.notificationSentOn(tag)) === today) return false;
        localStorage.setItem(STORAGE_KEYS.notificationSentOn(tag), today);
    }
    onNotify?.(title, options.body || '', type);
    void showSystemNotification(title, options);
    return true;
};

/** Remind about subscriptions renewing today or tomorrow. */
export const scheduleSubscriptionReminders = (subscriptions: Transaction[], onNotify?: NotifyFn) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const sub of subscriptions) {
        if (!sub.nextRenewalDate || sub.subscriptionStatus === 'paused') continue;
        const daysUntil = Math.round((parseLocalDate(sub.nextRenewalDate).getTime() - today.getTime()) / MS_PER_DAY);

        if (daysUntil === 1) {
            sendNotification(`Renewal Tomorrow: ${sub.title}`, {
                body: `Your ${sub.subscriptionFrequency} payment of ${sub.amount} is due tomorrow.`,
                tag: `remind-1-${sub.id}`,
            }, onNotify);
        } else if (daysUntil === 0) {
            sendNotification(`Renewal Today: ${sub.title}`, {
                body: `Your payment of ${sub.amount} for ${sub.title} is due today.`,
                tag: `remind-0-${sub.id}`,
            }, onNotify);
        }
    }
};

/** Expenses dated in the current calendar month. */
const currentMonthExpenses = (transactions: Transaction[]) => {
    const now = new Date();
    return transactions.filter(tx => {
        if (tx.type !== 'expense') return false;
        const d = parseLocalDate(tx.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
};

/** Warn at BUDGET_WARNING_PERCENT of the monthly limit, alert when it's exceeded. */
export const checkBudgetThresholds = (transactions: Transaction[], limit: number, prefs: NotificationPrefs, onNotify?: NotifyFn) => {
    if (!prefs.budgetThresholds || !limit) return;

    const spent = currentMonthExpenses(transactions).reduce((sum, tx) => sum + tx.amount, 0);
    const percent = (spent / limit) * 100;

    if (percent >= 100) {
        sendNotification('Monthly Budget Exceeded! 🚨', {
            body: `You've spent ${Math.round(percent)}% of your monthly budget limit.`,
            tag: 'budget-exceeded',
        }, onNotify, 'warning');
    } else if (percent >= BUDGET_WARNING_PERCENT) {
        sendNotification('Budget Warning! ⚠️', {
            body: `You've reached ${Math.round(percent)}% of your monthly budget limit.`,
            tag: 'budget-warning',
        }, onNotify, 'warning');
    }
};

/** Same thresholds as checkBudgetThresholds, per category budget. */
export const checkCategoryBudgets = (transactions: Transaction[], categoryBudgets: Record<string, number>, prefs: NotificationPrefs, onNotify?: NotifyFn) => {
    if (!prefs?.budgetThresholds || !categoryBudgets) return;

    const spentByCategory: Record<string, number> = {};
    for (const tx of currentMonthExpenses(transactions)) {
        spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + tx.amount;
    }

    for (const [category, limit] of Object.entries(categoryBudgets)) {
        if (!limit || limit <= 0) continue;
        const percent = ((spentByCategory[category] || 0) / limit) * 100;
        if (percent >= 100) {
            sendNotification('Category Over Budget! 🚨', {
                body: `You've exceeded your budget for ${category} (${Math.round(percent)}% used).`,
                tag: `cat-budget-over-${category}`,
            }, onNotify, 'warning');
        } else if (percent >= BUDGET_WARNING_PERCENT) {
            sendNotification('Category Warning! ⚠️', {
                body: `You've reached ${Math.round(percent)}% of your ${category} budget limit.`,
                tag: `cat-budget-warn-${category}`,
            }, onNotify, 'warning');
        }
    }
};

/** Once a day, during DAILY_REMINDER_HOUR, remind the user to log expenses. Called every minute. */
export const checkDailyReminder = (prefs: NotificationPrefs, onNotify?: NotifyFn) => {
    if (!prefs.dailyCheckIn) return;

    const now = new Date();
    if (now.getHours() !== DAILY_REMINDER_HOUR) return;

    const today = now.toDateString();
    if (localStorage.getItem(STORAGE_KEYS.LAST_DAILY_REMINDER) === today) return;

    sendNotification('Time to Log! 📝', {
        body: "Don't forget to log your expenses for today. Keep the streak alive!",
        tag: 'daily-check-in',
    }, onNotify);
    localStorage.setItem(STORAGE_KEYS.LAST_DAILY_REMINDER, today);
};

/** On the 1st of each month, announce last month's summary (once). */
export const checkMonthlySummary = (_transactions: Transaction[], prefs: NotificationPrefs, onNotify?: NotifyFn) => {
    if (!prefs.monthlyInsights) return;

    const now = new Date();
    if (now.getDate() !== 1) return;

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${lastMonth.getMonth()}-${lastMonth.getFullYear()}`;
    if (localStorage.getItem(STORAGE_KEYS.LAST_MONTHLY_SUMMARY) === monthKey) return;

    sendNotification(`${lastMonth.toLocaleString('default', { month: 'long' })} Summary 📊`, {
        body: 'Your monthly financial report is ready! Head to insights to view it.',
        tag: 'monthly-summary',
    }, onNotify);
    localStorage.setItem(STORAGE_KEYS.LAST_MONTHLY_SUMMARY, monthKey);
};
