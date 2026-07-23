
export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    
    const permission = await Notification.requestPermission();
    return permission === "granted";
};

export const sendNotification = (title: string, options?: NotificationOptions, onNotify?: (title: string, body: string, type: any) => void) => {
    const tag = options?.tag;
    if (tag) {
        const today = new Date().toDateString();
        const lastSent = localStorage.getItem(`notif_sent_${tag}`);
        if (lastSent === today) {
            return false;
        }
        localStorage.setItem(`notif_sent_${tag}`, today);
    }

    if (onNotify) {
        const isWarning = options?.tag?.includes('warning') || options?.tag?.includes('warn') || options?.tag?.includes('over') || options?.tag?.includes('exceeded');
        onNotify(title, options?.body || '', isWarning ? 'warning' : 'info');
    }

    if (Notification.permission === "granted") {
        try {
            new Notification(title, {
                icon: '/logo192.png',
                badge: '/logo192.png',
                ...options
            });
            return true;
        } catch (e) {
            console.warn("Browser Notification failed:", e);
        }
    }
    return false;
};

export const scheduleSubscriptionReminders = (subscriptions: any[], onNotify?: (t: string, b: string, ty: any) => void) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    subscriptions.forEach(sub => {
        if (!sub.nextRenewalDate || sub.subscriptionStatus === 'paused') return;

        const renewalDate = new Date(sub.nextRenewalDate);
        renewalDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            sendNotification(`Renewal Tomorrow: ${sub.title}`, {
                body: `Your ${sub.subscriptionFrequency} payment of ${sub.amount} is due tomorrow.`,
                tag: `remind-1-${sub.id}`
            }, onNotify);
        } else if (diffDays === 0) {
            sendNotification(`Renewal Today: ${sub.title}`, {
                body: `Your payment of ${sub.amount} for ${sub.title} is due today.`,
                tag: `remind-0-${sub.id}`
            }, onNotify);
        }
    });
};

export const checkBudgetThresholds = (transactions: any[], limit: number, prefs: any, onNotify?: (t: string, b: string, ty: any) => void) => {
    if (!prefs.budgetThresholds || !limit) return;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyExpenses = transactions
        .filter(tx => {
            const d = new Date(tx.date);
            return tx.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

    const percentage = (monthlyExpenses / limit) * 100;

    if (percentage >= 100) {
        sendNotification("Monthly Budget Exceeded! 🚨", {
            body: `You've spent ${Math.round(percentage)}% of your monthly budget limit.`,
            tag: 'budget-exceeded'
        }, onNotify);
    } else if (percentage >= 80) {
        sendNotification("Budget Warning! ⚠️", {
            body: `You've reached ${Math.round(percentage)}% of your monthly budget limit.`,
            tag: 'budget-warning'
        }, onNotify);
    }
};

export const checkCategoryBudgets = (transactions: any[], categoryBudgets: Record<string, number>, prefs: any, onNotify?: (t: string, b: string, ty: any) => void) => {
    if (!prefs?.budgetThresholds || !categoryBudgets) return;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const catSpend: Record<string, number> = {};
    transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (tx.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            catSpend[tx.category] = (catSpend[tx.category] || 0) + tx.amount;
        }
    });

    Object.entries(categoryBudgets).forEach(([cat, limit]) => {
        if (!limit || limit <= 0) return;
        const spent = catSpend[cat] || 0;
        const pct = (spent / limit) * 100;
        if (pct >= 100) {
            sendNotification(`Category Over Budget! 🚨`, {
                body: `You've exceeded your budget for ${cat} (${Math.round(pct)}% used).`,
                tag: `cat-budget-over-${cat}`
            }, onNotify);
        } else if (pct >= 80) {
            sendNotification(`Category Warning! ⚠️`, {
                body: `You've reached ${Math.round(pct)}% of your ${cat} budget limit.`,
                tag: `cat-budget-warn-${cat}`
            }, onNotify);
        }
    });
};

export const checkDailyReminder = (prefs: any, onNotify?: (t: string, b: string, ty: any) => void) => {
    if (!prefs.dailyCheckIn) return;
    
    const now = new Date();
    const hours = now.getHours();
    
    if (hours === 21) {
        const lastReminded = localStorage.getItem('last_daily_reminder');
        const today = now.toDateString();
        
        if (lastReminded !== today) {
            sendNotification("Time to Log! 📝", {
                body: "Don't forget to log your expenses for today. Keep the streak alive!",
                tag: 'daily-check-in'
            }, onNotify);
            localStorage.setItem('last_daily_reminder', today);
        }
    }
};

export const checkMonthlySummary = (transactions: any[], prefs: any, onNotify?: (t: string, b: string, ty: any) => void) => {
    if (!prefs.monthlyInsights) return;
    
    const now = new Date();
    if (now.getDate() === 1) {
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);
        const monthName = lastMonth.toLocaleString('default', { month: 'long' });
        
        const lastReminded = localStorage.getItem('last_monthly_summary');
        const monthYear = `${lastMonth.getMonth()}-${lastMonth.getFullYear()}`;
        
        if (lastReminded !== monthYear) {
            sendNotification(`${monthName} Summary 📊`, {
                body: "Your monthly financial report is ready! Head to insights to view it.",
                tag: 'monthly-summary'
            }, onNotify);
            localStorage.setItem('last_monthly_summary', monthYear);
        }
    }
};
