import { describe, expect, it } from 'vitest';
import { visibleProviders } from './providers';

describe('visibleProviders', () => {
  it('shows Google on android when enabled', () => {
    expect(
      visibleProviders({ env: { google: '1' }, platform: 'android', inExpoGo: false }),
    ).toEqual(['google']);
  });
  it('lists google then apple off iOS', () => {
    expect(
      visibleProviders({ env: { google: '1', apple: '1' }, platform: 'web', inExpoGo: false }),
    ).toEqual(['google', 'apple']);
  });
  // Delivery 2 adds the iOS client ID; until then Google is hidden on iOS.
  it('hides google on ios', () => {
    expect(
      visibleProviders({ env: { google: '1', apple: '1' }, platform: 'ios', inExpoGo: false }),
    ).toEqual(['apple']);
  });
  it('shows nothing in Expo Go', () => {
    expect(visibleProviders({ env: { google: '1' }, platform: 'android', inExpoGo: true })).toEqual(
      [],
    );
  });
  it('shows nothing when the switch is off', () => {
    expect(
      visibleProviders({ env: { google: '0' }, platform: 'android', inExpoGo: false }),
    ).toEqual([]);
  });
  it('shows nothing with no env on web', () => {
    expect(visibleProviders({ env: {}, platform: 'web', inExpoGo: false })).toEqual([]);
  });
});
