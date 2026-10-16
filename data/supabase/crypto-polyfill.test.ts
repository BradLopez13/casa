import { describe, expect, it, vi } from 'vitest';
import { installRandomValues } from './crypto-polyfill';

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-crypto', () => ({ getRandomValues: vi.fn() }));

describe('installRandomValues', () => {
  it('installs when crypto is missing', () => {
    const impl = vi.fn();
    const target: { crypto?: { getRandomValues?: unknown } } = {};
    expect(installRandomValues(target, impl)).toBe(true);
    expect(target.crypto?.getRandomValues).toBe(impl);
  });
  it('installs into an existing crypto without getRandomValues', () => {
    const target = { crypto: {} as { getRandomValues?: unknown } };
    expect(installRandomValues(target, vi.fn())).toBe(true);
    expect(typeof target.crypto.getRandomValues).toBe('function');
  });
  it('leaves an existing getRandomValues alone', () => {
    const existing = vi.fn();
    const target = { crypto: { getRandomValues: existing } };
    expect(installRandomValues(target, vi.fn())).toBe(false);
    expect(target.crypto.getRandomValues).toBe(existing);
  });
});
