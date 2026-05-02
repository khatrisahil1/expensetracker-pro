
export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    
    const permission = await Notification.requestPermission();
    return permission === "granted";
};

export const sendNotification = (title: string, options?: NotificationOptions, onNotify?: (title: string, body: string, type: any) => void) => {
    if (onNotify) {
        onNotify(title, options?.body || '', options?.tag?.includes('warning') ? 'warning' : 'info');
    }

    if (Notification.permission === "granted") {
        new Notification(title, {
            icon: '/logo192.png',
            badge: '/logo192.png',
            ...options
        });
        return true;
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

    if (percentage >= 80 && percentage < 85) {
        sendNotification("Budget Warning! ⚠️", {
            body: `You've reached ${Math.round(percentage)}% of your monthly budget limit.`,
            tag: 'budget-warning'
        }, onNotify);
    }
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
