import { describe, expect, it } from 'vitest';
import { resolveRoute, type RouteInput } from './resolve-route';

const base: RouteInput = {
  session: 'signed-in',
  membership: 'member',
  hasPendingInvite: false,
  group: 'app',
};

describe('resolveRoute', () => {
  it.each<[string, RouteInput, ReturnType<typeof resolveRoute>]>([
    ['session loading', { ...base, session: 'loading' }, null],
    ['signed-out, app', { ...base, session: 'signed-out', group: 'app' }, '/sign-in'],
    ['signed-out, auth', { ...base, session: 'signed-out', group: 'auth' }, null],
    ['signed-out, invite', { ...base, session: 'signed-out', group: 'invite' }, null],
    ['membership loading', { ...base, membership: 'loading' }, null],
    [
      'none, pending invite, auth',
      { ...base, membership: 'none', hasPendingInvite: true, group: 'auth' },
      '/invite',
    ],
    ['none, no pending, auth', { ...base, membership: 'none', group: 'auth' }, '/onboarding'],
    ['none, no pending, app', { ...base, membership: 'none', group: 'app' }, '/onboarding'],
    ['none, onboarding', { ...base, membership: 'none', group: 'onboarding' }, null],
    ['member, auth', { ...base, group: 'auth' }, '/today'],
    ['member, onboarding', { ...base, group: 'onboarding' }, '/today'],
    ['member, invite', { ...base, group: 'invite' }, null],
    ['member, pending invite, app', { ...base, hasPendingInvite: true, group: 'app' }, '/invite'],
    ['member, app', base, null],
    ['signed-out, onboarding', { ...base, session: 'signed-out', group: 'onboarding' }, '/sign-in'],
    [
      'none, pending invite, onboarding',
      { ...base, membership: 'none', hasPendingInvite: true, group: 'onboarding' },
      '/invite',
    ],
    [
      'none, pending invite, invite',
      { ...base, membership: 'none', hasPendingInvite: true, group: 'invite' },
      null,
    ],
    ['root, session loading', { ...base, session: 'loading', group: 'root' }, null],
    ['root, membership loading', { ...base, membership: 'loading', group: 'root' }, null],
    ['root, signed-out', { ...base, session: 'signed-out', group: 'root' }, '/sign-in'],
    [
      'root, none, pending invite',
      { ...base, membership: 'none', hasPendingInvite: true, group: 'root' },
      '/invite',
    ],
    ['root, none', { ...base, membership: 'none', group: 'root' }, '/onboarding'],
    ['root, member', { ...base, group: 'root' }, '/today'],
    ['root, member, pending invite', { ...base, hasPendingInvite: true, group: 'root' }, '/invite'],
  ])('%s', (_name, input, expected) => {
    expect(resolveRoute(input)).toBe(expected);
  });
});
