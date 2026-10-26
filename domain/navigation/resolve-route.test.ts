import { describe, expect, it } from 'vitest';
import { resolveRoute, type RouteInput } from './resolve-route';

const base: RouteInput = {
  session: 'signed-in',
  households: 1,
  hasPendingInvite: false,
  group: 'app',
};

describe('resolveRoute', () => {
  it.each<[string, RouteInput, ReturnType<typeof resolveRoute>]>([
    ['session loading', { ...base, session: 'loading' }, null],
    ['signed-out, app', { ...base, session: 'signed-out', group: 'app' }, '/sign-in'],
    ['signed-out, auth', { ...base, session: 'signed-out', group: 'auth' }, null],
    ['signed-out, invite', { ...base, session: 'signed-out', group: 'invite' }, null],
    ['households loading', { ...base, households: 'loading' }, null],
    // Bloque 12: one person, several households.
    ['several households, app', { ...base, households: 3 }, null],
    ['several households, auth', { ...base, households: 2, group: 'auth' }, '/today'],
    ['several households, onboarding', { ...base, households: 2, group: 'onboarding' }, '/today'],
    [
      'several households, pending invite: accepted while already in households',
      { ...base, households: 2, hasPendingInvite: true, group: 'app' },
      '/invite',
    ],
    ['several households, invite', { ...base, households: 2, group: 'invite' }, null],
    [
      'none, pending invite, auth',
      { ...base, households: 0, hasPendingInvite: true, group: 'auth' },
      '/invite',
    ],
    ['none, no pending, auth', { ...base, households: 0, group: 'auth' }, '/onboarding'],
    ['none, no pending, app', { ...base, households: 0, group: 'app' }, '/onboarding'],
    ['none, onboarding', { ...base, households: 0, group: 'onboarding' }, null],
    ['member, auth', { ...base, group: 'auth' }, '/today'],
    ['member, onboarding', { ...base, group: 'onboarding' }, '/today'],
    ['member, invite', { ...base, group: 'invite' }, null],
    ['member, pending invite, app', { ...base, hasPendingInvite: true, group: 'app' }, '/invite'],
    ['member, app', base, null],
    ['signed-out, onboarding', { ...base, session: 'signed-out', group: 'onboarding' }, '/sign-in'],
    [
      'none, pending invite, onboarding',
      { ...base, households: 0, hasPendingInvite: true, group: 'onboarding' },
      '/invite',
    ],
    [
      'none, pending invite, invite',
      { ...base, households: 0, hasPendingInvite: true, group: 'invite' },
      null,
    ],
    ['root, session loading', { ...base, session: 'loading', group: 'root' }, null],
    ['root, membership loading', { ...base, households: 'loading', group: 'root' }, null],
    ['root, signed-out', { ...base, session: 'signed-out', group: 'root' }, '/sign-in'],
    [
      'root, none, pending invite',
      { ...base, households: 0, hasPendingInvite: true, group: 'root' },
      '/invite',
    ],
    ['root, none', { ...base, households: 0, group: 'root' }, '/onboarding'],
    ['root, member', { ...base, group: 'root' }, '/today'],
    ['root, member, pending invite', { ...base, hasPendingInvite: true, group: 'root' }, '/invite'],
  ])('%s', (_name, input, expected) => {
    expect(resolveRoute(input)).toBe(expected);
  });
});
