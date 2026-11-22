// Scheduled push reminders for ExpenseTracker.
// Not deployed yet: needs the Firebase Blaze (pay-as-you-go) plan. To deploy:
//   1. Add  "functions": { "source": "functions" }  to firebase.json
//   2. cd functions && npm install
//   3. npx firebase deploy --only functions
// The app stores each device's FCM token on users/{uid}.pushTokens when the
// user turns on Profile → Notifications → Push notifications.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();
const TZ = 'Asia/Kolkata';

/** YYYY-MM-DD in the given time zone, offset by `days`. */
const localDate = (days = 0) => {
  const d = new Date(Date.now() + days * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // en-CA → YYYY-MM-DD
};

const symbolFor = c => ({ USD: '$', EUR: '€', GBP: '£' }[c] || '₹');

/** Send to all of a user's devices; drop tokens that are no longer valid. */
async function sendToUser(userRef, tokens, message) {
  if (!tokens?.length) return;
  const res = await getMessaging().sendEachForMulticast({ tokens, ...message });
  const dead = res.responses
    .map((r, i) => (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code) ? tokens[i] : null))
    .filter(Boolean);
  if (dead.length) await userRef.update({ pushTokens: FieldValue.arrayRemove(...dead) });
}

/** Every morning: subscriptions renewing tomorrow, and budget warnings. */
exports.morningReminders = onSchedule({ schedule: '0 9 * * *', timeZone: TZ }, async () => {
  const tomorrow = localDate(1);
  const monthStart = `${localDate().slice(0, 7)}-01`;
  const users = await db.collection('users').where('pushEnabled', '==', true).get();

  for (const userDoc of users.docs) {
    const u = userDoc.data();
    const tokens = u.pushTokens || [];
    if (!tokens.length) continue;
    const prefs = u.notificationPrefs || {};
    const sym = symbolFor(u.currency);

    // Renewals due tomorrow
    const subs = await db.collection('transactions')
      .where('userId', '==', userDoc.id).where('isSubscription', '==', true).where('nextRenewalDate', '==', tomorrow).get();
    for (const s of subs.docs) {
      const t = s.data();
      if (t.subscriptionStatus === 'paused') continue;
      await sendToUser(userDoc.ref, tokens, {
        notification: { title: `${t.title} renews tomorrow`, body: `${sym}${t.amount} will be due. Tap to review your subscriptions.` },
        data: { url: '/subscriptions', tag: `renew-${s.id}-${tomorrow}` },
      });
    }

    // Monthly limit: warn at 80% and at 100%, once each per month
    const limit = u.monthlyExpenseLimit || 0;
    if (limit > 0 && prefs.budgetThresholds !== false) {
      const spent = (await db.collection('transactions').where('userId', '==', userDoc.id).where('type', '==', 'expense').where('date', '>=', monthStart).get())
        .docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
      const level = spent >= limit ? 100 : spent >= limit * 0.8 ? 80 : 0;
      const sentKey = `${monthStart}:${level}`;
      if (level && u.lastBudgetPush !== sentKey) {
        await sendToUser(userDoc.ref, tokens, {
          notification: level === 100
            ? { title: 'Monthly limit reached', body: `You've spent ${sym}${Math.round(spent)} of ${sym}${limit} this month.` }
            : { title: '80% of your monthly limit used', body: `${sym}${Math.round(limit - spent)} left for the rest of the month.` },
          data: { url: '/budget', tag: `budget-${sentKey}` },
        });
        await userDoc.ref.update({ lastBudgetPush: sentKey });
      }
    }
  }
});

/** Every evening: a nudge if nothing was logged today (when the user wants it). */
exports.eveningNudge = onSchedule({ schedule: '0 21 * * *', timeZone: TZ }, async () => {
  const today = localDate();
  const users = await db.collection('users').where('pushEnabled', '==', true).get();
  for (const userDoc of users.docs) {
    const u = userDoc.data();
    if ((u.notificationPrefs || {}).dailyCheckIn === false) continue;
    const logged = await db.collection('transactions').where('userId', '==', userDoc.id).where('date', '==', today).limit(1).get();
    if (!logged.empty) continue;
    await sendToUser(userDoc.ref, u.pushTokens, {
      notification: { title: 'Feed your piggy 🐷', body: 'Nothing logged today. Add your spending in 10 seconds.' },
      data: { url: '/transactions?action=add', tag: `nudge-${today}` },
    });
  }
});
