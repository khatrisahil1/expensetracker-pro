// App-wide settings that used to be repeated as bare literals.

/**
 * localStorage keys. The values are unchanged from before, so existing
 * browsers keep their saved state.
 */
export const STORAGE_KEYS = {
  /** Login screen theme before settings load: 'light' | 'dark'. */
  THEME: 'theme',
  /** In-app notification history (JSON array). */
  NOTIFICATIONS: 'app_notifications',
  /** '1' while Guest mode is on, so it survives a refresh. */
  DEMO_MODE: 'demo',
  /** Guest-mode data (settings, transactions, vault items) as JSON, so a refresh keeps it. */
  DEMO_DATA: 'demo_data',
  /** Last streak milestone (7 or 30) that played its celebration. */
  STREAK_CELEBRATED: 'streak:lastCelebrated',
  /** Date the 9 PM "log your expenses" reminder last fired. */
  LAST_DAILY_REMINDER: 'last_daily_reminder',
  /** Month the "monthly summary" notification last fired for. */
  LAST_MONTHLY_SUMMARY: 'last_monthly_summary',
  /** Date a given notification (by tag) was last sent; limits each to once a day. */
  notificationSentOn: (tag: string) => `notif_sent_${tag}`,
} as const;

/**
 * How long "Undo" stays available after deleting a transaction. The store and
 * the snackbar countdown both use this; they used to disagree (4 s vs 5 s), so
 * the bar vanished while its countdown still showed a second left. 5 s proved
 * too short to notice the bar and reach the button, so it is 8 s.
 */
export const UNDO_WINDOW_MS = 8000;

/** Hour (24 h, local time) of the daily "log your expenses" reminder. */
export const DAILY_REMINDER_HOUR = 21;

/** Share of a budget at which a warning is sent; at 100% an "exceeded" alert is sent instead. */
export const BUDGET_WARNING_PERCENT = 80;

/** Most recent in-app notifications to keep. */
export const MAX_STORED_NOTIFICATIONS = 50;
