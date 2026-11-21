// Finds subscription renewals that have fallen due but haven't been booked.
// The app used to book these silently whenever the Subscriptions page opened,
// which wrote charges into the user's history without asking. Now the
// RenewalPrompt shows what this finds and the user decides.
import type { Transaction } from '../context/Store';
import { addInterval, toLocalISODate } from './date';

/** One subscription with renewals due on or before today. */
export interface MissedRenewal {
  subscription: Transaction;
  /** Every due date not yet booked, oldest first ('YYYY-MM-DD'). */
  dueDates: string[];
  /** The first renewal date after today; becomes the new nextRenewalDate. */
  nextRenewalDate: string;
}

/** Most cycles listed for one subscription, so a years-old date can't loop for ever. */
const MAX_CYCLES = 120;

/** Active subscriptions whose next renewal date is today or earlier. */
export function findMissedRenewals(transactions: Transaction[], today = toLocalISODate()): MissedRenewal[] {
  return transactions
    .filter(t => t.isSubscription && t.subscriptionStatus !== 'paused' && t.nextRenewalDate && t.nextRenewalDate <= today)
    .map(subscription => {
      const dueDates: string[] = [];
      let due = subscription.nextRenewalDate!;
      while (due <= today && dueDates.length < MAX_CYCLES) {
        dueDates.push(due);
        due = addInterval(due, subscription.subscriptionFrequency || 'monthly');
      }
      return { subscription, dueDates, nextRenewalDate: due };
    });
}

/** The expense booked for one renewal. */
export const renewalTransaction = (sub: Transaction, date: string): Omit<Transaction, 'id' | 'createdAt'> => ({
  title: `${sub.title} (Renewal)`,
  amount: sub.amount,
  date,
  category: sub.category || 'Subscription',
  type: 'expense',
  paymentMethod: sub.paymentMethod || 'Other',
  note: `Renewal of ${sub.title}`,
});
