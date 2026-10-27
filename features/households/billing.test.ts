import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import type { HouseholdLicense } from './api';
import {
  billingEnabled,
  licenseBandText,
  licenseDate,
  licenseHeadline,
  licensePrice,
  purchaseLicense,
} from './billing';

const base: HouseholdLicense = {
  status: 'complimentary',
  paidBy: 'me',
  currentPeriodEnd: null,
  trialEndsAt: null,
};
const future = '2099-11-09T10:00:00Z';
const past = '2020-11-03T10:00:00Z';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('the billing switch in the app', () => {
  it('is off unless the build turns it on', () => {
    vi.stubEnv('EXPO_PUBLIC_BILLING_ENABLED', '');
    expect(billingEnabled()).toBe(false);
    vi.stubEnv('EXPO_PUBLIC_BILLING_ENABLED', 'false');
    expect(billingEnabled()).toBe(false);
    vi.stubEnv('EXPO_PUBLIC_BILLING_ENABLED', 'true');
    expect(billingEnabled()).toBe(true);
  });

  it('takes the price from configuration, never from code', () => {
    vi.stubEnv('EXPO_PUBLIC_LICENSE_PRICE', '');
    expect(licensePrice()).toBeNull();
    vi.stubEnv('EXPO_PUBLIC_LICENSE_PRICE', ' 2,99 € ');
    expect(licensePrice()).toBe('2,99 €');
  });

  it('cannot pay yet: the provider’s SDK is not installed', async () => {
    expect(await purchaseLicense({ provider: 'revenuecat', offering: 'm', householdId: 'h' })).toBe(
      'unavailable',
    );
  });
});

describe('licenseHeadline', () => {
  it('says «Incluida por ahora» while billing is off', () => {
    expect(licenseHeadline(base)).toBe(t('license.complimentary'));
  });

  it('says until when a trial runs, and when it ended', () => {
    expect(licenseHeadline({ ...base, status: 'trial', trialEndsAt: future })).toBe(
      t('license.trialUntil', { date: licenseDate(future) }),
    );
    expect(licenseHeadline({ ...base, status: 'trial', trialEndsAt: past })).toBe(
      t('license.trialEnded', { date: licenseDate(past) }),
    );
  });

  it('says each paid state with its date', () => {
    expect(licenseHeadline({ ...base, status: 'active', currentPeriodEnd: future })).toBe(
      t('license.activeUntil', { date: licenseDate(future) }),
    );
    expect(licenseHeadline({ ...base, status: 'past_due', currentPeriodEnd: past })).toBe(
      t('license.pastDueSince', { date: licenseDate(past) }),
    );
    expect(licenseHeadline({ ...base, status: 'canceled', currentPeriodEnd: past })).toBe(
      t('license.canceledOn', { date: licenseDate(past) }),
    );
    expect(licenseHeadline({ ...base, status: 'canceled' })).toBe(t('license.canceled'));
  });
});

describe('licenseBandText', () => {
  it('says nothing while the household may write, or without a licence known', () => {
    expect(licenseBandText(undefined)).toBeNull();
    expect(licenseBandText({ status: 'complimentary', endsAt: null, licensed: true })).toBeNull();
    expect(licenseBandText({ status: 'canceled', endsAt: past, licensed: true })).toBeNull();
  });

  it('says when it ended and who can renew it, once it stops the household writing', () => {
    expect(licenseBandText({ status: 'canceled', endsAt: past, licensed: false })).toBe(
      t('license.band', { date: licenseDate(past) }),
    );
    expect(licenseBandText({ status: 'past_due', endsAt: null, licensed: false })).toBe(
      t('license.bandNoDate'),
    );
  });
});
