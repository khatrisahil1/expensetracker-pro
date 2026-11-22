// The panel must not mark everything read just by opening, and each action
// must call the matching store function.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const markNotificationsRead = vi.fn();
const setNotificationRead = vi.fn();
const deleteNotification = vi.fn();
const clearNotifications = vi.fn();
const now = Date.now();
const store = {
  markNotificationsRead, setNotificationRead, deleteNotification, clearNotifications,
  notifications: [
    { id: 'a', title: 'Budget alert', body: 'Food is at 80%', timestamp: now - 5 * 60000, read: false, type: 'warning' },
    { id: 'b', title: 'Monthly summary', body: 'October totals', timestamp: now - 3 * 86400000, read: true, type: 'info' },
  ],
};
vi.mock('../context/Store', () => ({ useStore: () => store }));

const { default: NotificationsPanel } = await import('./NotificationsPanel');
const { DialogProvider } = await import('./ui/DialogProvider');

const renderPanel = () => render(<MemoryRouter><DialogProvider><NotificationsPanel onClose={vi.fn()} /></DialogProvider></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('NotificationsPanel', () => {
  it('opens without marking anything read, and shows the unread count', () => {
    renderPanel();
    expect(markNotificationsRead).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /Unread \(1\)/ })).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Earlier')).toBeTruthy();
  });
  it('toggles one notification read/unread when tapped', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Budget alert\. Unread/ }));
    expect(setNotificationRead).toHaveBeenCalledWith('a', true);
    fireEvent.click(screen.getByRole('button', { name: /Monthly summary\. Read/ }));
    expect(setNotificationRead).toHaveBeenCalledWith('b', false);
  });
  it('filters to unread only', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: /Unread/ }));
    expect(screen.queryByText('Monthly summary')).toBeNull();
    expect(screen.getByText('Budget alert')).toBeTruthy();
  });
  it('marks all read', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    expect(markNotificationsRead).toHaveBeenCalledTimes(1);
  });
  it('deletes one notification', async () => {
    renderPanel();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete "Budget alert"' })); await new Promise(r => setTimeout(r, 220)); });
    expect(deleteNotification).toHaveBeenCalledWith('a');
  });
  it('clears all only after confirming', async () => {
    renderPanel();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Clear all/ })); });
    expect(clearNotifications).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear All' })); await new Promise(r => setTimeout(r, 220)); });
    expect(clearNotifications).toHaveBeenCalledTimes(1);
  });
});
