import { describe, expect, it } from 'vitest';
import { routeForNotification } from './routes';

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
