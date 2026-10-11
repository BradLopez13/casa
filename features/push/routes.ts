export type NotificationRoute = '/today' | '/tasks' | '/household/members';

// Only these screens can be opened from a push notice; the payload is never trusted further.
const PUSH_ROUTES: readonly NotificationRoute[] = ['/tasks', '/household/members'];

const isPushRoute = (value: unknown): value is NotificationRoute =>
  PUSH_ROUTES.some((route) => route === value);

/** Where a tapped notification leads: an allowed push route, otherwise Hoy (reminders too). */
export function routeForNotification(data: unknown): NotificationRoute {
  if (typeof data !== 'object' || data === null) return '/today';
  const { casa, route } = data as { casa?: unknown; route?: unknown };
  return casa === 'push' && isPushRoute(route) ? route : '/today';
}
