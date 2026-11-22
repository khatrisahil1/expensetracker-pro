// Tiny event bus so any avatar (Dashboard header, sidebar) can open the
// Wrapped story rendered once by WrappedHost in AppLayout.
const EVENT = 'expensetracker:open-wrapped';

export const openWrapped = () => window.dispatchEvent(new CustomEvent(EVENT));

export const onOpenWrapped = (handler: () => void) => {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
