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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The household a push notice comes from (bloque 12), so the tap can switch to it; null for a
 * reminder, an older notice or anything that is not a household id. Switching only happens to
 * a household the person is in (`setActiveHousehold`).
 */
export function householdForNotification(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { casa, household_id: householdId } = data as { casa?: unknown; household_id?: unknown };
  return casa === 'push' && typeof householdId === 'string' && UUID.test(householdId)
    ? householdId
    : null;
}
