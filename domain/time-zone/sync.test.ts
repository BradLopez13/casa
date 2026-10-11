import { describe, expect, it } from 'vitest';
import { shouldSyncTimeZone } from './sync';

describe('shouldSyncTimeZone', () => {
  it('syncs when the profile has none yet', () => {
    expect(shouldSyncTimeZone(null, 'Europe/Madrid')).toBe(true);
  });
  it('does nothing when they match', () => {
    expect(shouldSyncTimeZone('Europe/Madrid', 'Europe/Madrid')).toBe(false);
  });
  it('syncs when the phone moved to another zone', () => {
    expect(shouldSyncTimeZone('Europe/Madrid', 'Asia/Tokyo')).toBe(true);
  });
  it('does nothing when the phone gives no zone', () => {
    expect(shouldSyncTimeZone('Europe/Madrid', null)).toBe(false);
    expect(shouldSyncTimeZone(null, undefined)).toBe(false);
  });
});
