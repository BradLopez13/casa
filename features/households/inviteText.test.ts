import { describe, expect, it } from 'vitest';
import { inviteExpiresText } from './inviteText';

describe('inviteExpiresText', () => {
  it('writes day and month of a date', () =>
    expect(inviteExpiresText('2026-10-23')).toBe('Caduca el 23 de octubre'));
  it('writes day and month of a timestamp', () =>
    expect(inviteExpiresText('2026-10-23T12:00:00Z')).toBe('Caduca el 23 de octubre'));
});
