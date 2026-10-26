import { describe, expect, it, vi } from 'vitest';
import { isUnsentChange } from './unsent';

// Only the keys matter here: the network calls stay out of the unit project.
vi.mock('@/features/shopping/api', () => ({}));
vi.mock('@/features/tasks/api', () => ({}));

const mutation = (key: string[], status: 'pending' | 'success' | 'error') =>
  ({ options: { mutationKey: key }, state: { status } }) as never;

describe('isUnsentChange', () => {
  it('counts a queued shopping or task change still on its way', () => {
    expect(isUnsentChange(mutation(['shopping', 'add'], 'pending'))).toBe(true);
    expect(isUnsentChange(mutation(['shopping', 'quantity'], 'pending'))).toBe(true);
    expect(isUnsentChange(mutation(['tasks', 'toggle'], 'pending'))).toBe(true);
    expect(isUnsentChange(mutation(['tasks', 'create'], 'pending'))).toBe(true);
  });

  it('leaves out what already arrived and what is not queued', () => {
    expect(isUnsentChange(mutation(['shopping', 'add'], 'success'))).toBe(false);
    expect(isUnsentChange(mutation(['tasks', 'skip'], 'pending'))).toBe(false);
  });
});
