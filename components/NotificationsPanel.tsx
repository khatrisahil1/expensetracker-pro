// Slide-in notifications panel (opened from the bell on the Dashboard).
// Opening it used to mark everything read at once, so "unread" meant nothing.
// Now each notification stays unread until tapped, and the panel offers
// All / Unread filters, Mark all read, per-item read/unread and delete, and
// Clear all (with a confirmation).
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore, type AppNotification } from '../context/Store';
import { useDialog } from './ui/DialogProvider';
import { ROUTES } from '../routes';

const TYPE_STYLE: Record<AppNotification['type'], { icon: string; tint: string }> = {
  info: { icon: 'info', tint: 'bg-sky-500/15 text-sky-400' },
  success: { icon: 'check_circle', tint: 'bg-primary/15 text-primary' },
  warning: { icon: 'warning', tint: 'bg-amber-500/15 text-amber-500' },
  alert: { icon: 'error', tint: 'bg-danger/15 text-danger' },
};

/** "Just now", "5m ago", "3h ago", "Yesterday", "12 Nov". */
const relativeTime = (ts: number, now = Date.now()) => {
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

const NotificationsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, markNotificationsRead, setNotificationRead, deleteNotification, clearNotifications } = useStore();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [leaving, setLeaving] = useState<string | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;
  const visible = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const groups = useMemo(() => {
    const today = startOfToday();
    return [
      { label: 'Today', items: visible.filter(n => n.timestamp >= today) },
      { label: 'Earlier', items: visible.filter(n => n.timestamp < today) },
    ].filter(g => g.items.length > 0);
  }, [visible]);

  /** Slide the card out, then remove it. */
  const remove = (id: string) => {
    setLeaving(id);
    setTimeout(() => { deleteNotification(id); setLeaving(null); }, 180);
  };

  const clearAll = async () => {
    const ok = await dialog.confirm({
      title: 'Clear all notifications?',
      message: `${notifications.length} notification${notifications.length === 1 ? '' : 's'} will be removed.`,
      confirmLabel: 'Clear All', destructive: true,
    });
    if (ok) { clearNotifications(); dialog.toast('Notifications cleared'); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <aside role="dialog" aria-modal="true" aria-label="Notifications" onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm h-full bg-surface-light dark:bg-surface-dark shadow-2xl animate-slide-left flex flex-col">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex flex-col gap-4 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight text-text-light-main dark:text-text-dark-main">Notifications</h2>
              {unreadCount > 0 && (
                <span key={unreadCount} className="min-w-6 h-6 px-2 rounded-full bg-primary text-[#131811] text-xs font-black flex items-center justify-center animate-pop">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { onClose(); navigate(`${ROUTES.SETTINGS}?section=notifications`); }} aria-label="Notification settings"
                className="size-10 rounded-full flex items-center justify-center text-text-light-muted hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary transition-colors">
                <span className="material-symbols-outlined" aria-hidden="true">tune</span>
              </button>
              <button onClick={onClose} aria-label="Close" className="size-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Filter" className="relative grid grid-cols-2 p-1 rounded-full bg-gray-100 dark:bg-black/30 w-48">
              {/* Sliding highlight behind the active tab */}
              <span className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-surface-dark shadow-sm transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${filter === 'unread' ? 'translate-x-full' : ''}`} aria-hidden="true" />
              {(['all', 'unread'] as const).map(f => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                  className={`relative z-10 py-1.5 text-xs font-bold transition-colors ${filter === f ? 'text-text-light-main dark:text-text-dark-main' : 'text-text-light-muted'}`}>
                  {f === 'all' ? 'All' : 'Unread'}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                </button>
              ))}
            </div>
            <button onClick={markNotificationsRead} disabled={unreadCount === 0}
              className="text-xs font-bold text-primary disabled:text-text-light-muted disabled:opacity-50 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">done_all</span>Mark all read
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">
          {groups.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 animate-fade-in">
              <span className="size-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-text-light-muted animate-pop">
                <span className="material-symbols-outlined text-3xl animate-float" aria-hidden="true">{filter === 'unread' ? 'mark_email_read' : 'notifications_off'}</span>
              </span>
              <p className="font-bold text-text-light-main dark:text-text-dark-main">{filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</p>
              <p className="text-xs text-text-light-muted max-w-[220px]">{filter === 'unread' ? 'Nothing unread right now.' : 'Budget alerts, reminders and summaries will show up here.'}</p>
            </div>
          ) : groups.map(group => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-text-light-muted">{group.label}</h3>
              <ul className="flex flex-col gap-2 stagger">
                {group.items.map(n => {
                  const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
                  return (
                    <li key={n.id}
                      className={`group relative rounded-2xl border transition-all duration-200 ${leaving === n.id ? 'opacity-0 translate-x-8' : ''} ${n.read ? 'bg-transparent border-border-light dark:border-border-dark' : 'bg-primary/[0.05] border-primary/20'}`}>
                      <button onClick={() => setNotificationRead(n.id, !n.read)} className="w-full text-left p-3.5 pr-10 flex gap-3"
                        aria-label={`${n.title}. ${n.read ? 'Read' : 'Unread'}. Tap to mark ${n.read ? 'unread' : 'read'}.`}>
                        <span className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${style.tint}`}>
                          <span className="material-symbols-outlined text-[19px]" aria-hidden="true">{style.icon}</span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            {!n.read && <span className="size-2 rounded-full bg-primary shrink-0 animate-pulse" aria-hidden="true" />}
                            <span className={`text-sm truncate ${n.read ? 'font-semibold text-text-light-muted dark:text-text-dark-muted' : 'font-black text-text-light-main dark:text-text-dark-main'}`}>{n.title}</span>
                          </span>
                          <span className="block text-xs text-text-light-muted dark:text-text-dark-muted leading-relaxed mt-0.5">{n.body}</span>
                          <span className="block text-[11px] text-text-light-muted/80 mt-1">{relativeTime(n.timestamp)}</span>
                        </span>
                      </button>
                      <button onClick={() => remove(n.id)} aria-label={`Delete "${n.title}"`}
                        className="absolute top-2.5 right-2.5 size-7 rounded-full flex items-center justify-center text-text-light-muted opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 hover:bg-danger/10 hover:text-danger transition-all">
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {notifications.length > 0 && (
          <div className="p-4 border-t border-border-light dark:border-border-dark">
            <button onClick={clearAll} className="w-full py-3 rounded-full text-sm font-bold text-danger hover:bg-danger/10 transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete_sweep</span>Clear all
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export default NotificationsPanel;
