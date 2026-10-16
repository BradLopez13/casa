import { describe, expect, it } from 'vitest';
import { secondsLeft } from './resend-cooldown';

describe('secondsLeft', () => {
  it('starts at the full cooldown', () => {
    expect(secondsLeft(0, 0)).toBe(60);
  });
  it('rounds a partial second up', () => {
    expect(secondsLeft(0, 59_500)).toBe(1);
  });
  it('reaches zero at the cooldown', () => {
    expect(secondsLeft(0, 60_000)).toBe(0);
  });
  it('never goes negative', () => {
    expect(secondsLeft(0, 90_000)).toBe(0);
  });
  it('accepts another cooldown', () => {
    expect(secondsLeft(1000, 2000, 10)).toBe(9);
  });
});
