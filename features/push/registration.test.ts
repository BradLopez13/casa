import { describe, expect, it, vi } from 'vitest';
import { shouldRegister } from './registration';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('./api', () => ({ unregisterPushToken: vi.fn() }));

describe('shouldRegister', () => {
  const current = { userId: 'u1', token: 'ExponentPushToken[a]' };

  it('registers when nothing was registered before', () => {
    expect(shouldRegister(null, current)).toBe(true);
  });

  it('skips the same user with the same token', () => {
    expect(shouldRegister({ ...current }, current)).toBe(false);
  });

  it('registers the same token for another user', () => {
    expect(shouldRegister({ ...current, userId: 'u2' }, current)).toBe(true);
  });

  it('registers a new token', () => {
    expect(shouldRegister({ ...current, token: 'ExponentPushToken[b]' }, current)).toBe(true);
  });
});
