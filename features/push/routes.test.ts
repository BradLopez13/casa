import { describe, expect, it } from 'vitest';
import { householdForNotification, routeForNotification } from './routes';

describe('routeForNotification', () => {
  it('opens an allowed push route', () => {
    expect(routeForNotification({ casa: 'push', route: '/tasks' })).toBe('/tasks');
    expect(routeForNotification({ casa: 'push', route: '/household/members' })).toBe(
      '/household/members',
    );
  });

  it('falls back to Hoy for a route outside the list', () => {
    expect(routeForNotification({ casa: 'push', route: '/admin' })).toBe('/today');
  });

  it('opens Hoy for a reminder', () => {
    expect(routeForNotification({ casa: 'reminder' })).toBe('/today');
  });

  it('opens Hoy for anything else', () => {
    expect(routeForNotification(null)).toBe('/today');
    expect(routeForNotification('x')).toBe('/today');
    expect(routeForNotification({})).toBe('/today');
  });
});

describe('householdForNotification', () => {
  const id = '00000000-0000-0000-0000-0000000000a2';

  it('gives the household a push notice comes from (bloque 12)', () => {
    expect(householdForNotification({ casa: 'push', route: '/tasks', household_id: id })).toBe(id);
  });

  it('gives none for a reminder, an older notice or something else', () => {
    expect(householdForNotification({ casa: 'reminder' })).toBeNull();
    expect(householdForNotification({ casa: 'push', route: '/tasks' })).toBeNull();
    expect(householdForNotification({ casa: 'push', household_id: 'not-an-id' })).toBeNull();
    expect(householdForNotification({ household_id: id })).toBeNull();
    expect(householdForNotification(null)).toBeNull();
  });
});
