import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import type { HouseholdLicense } from './api';
import {
  billingEnabled,
  configureBilling,
  LICENSE_PRODUCTS,
  licenseBandText,
  licenseDate,
  licenseHeadline,
  licensePrice,
  manageSubscriptionUrl,
  productFor,
  purchaseLicense,
  restorePurchases,
  revenueCatKey,
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
    expect(
      await purchaseLicense({ provider: 'revenuecat', offering: 'm', householdId: 'h', level: 1 }),
    ).toBe('unavailable');
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

// Bloque 15.6: the products, the keys and the SDK, all behind variables.
describe('the products (bloque 15.6)', () => {
  it('are casas_1 … casas_10, one per level', () => {
    expect(LICENSE_PRODUCTS).toHaveLength(10);
    expect(LICENSE_PRODUCTS[0]).toBe('casas_1');
    expect(LICENSE_PRODUCTS[9]).toBe('casas_10');
    expect(productFor(3)).toBe('casas_3');
    expect(productFor(0)).toBe('casas_1');
    expect(productFor(12)).toBe('casas_10');
  });

  it('take the RevenueCat key of the platform from the build, or none', () => {
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', '');
    expect(revenueCatKey('android')).toBeNull();
    expect(revenueCatKey('ios')).toBeNull();
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'goog_x');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'appl_x');
    expect(revenueCatKey('android')).toBe('goog_x');
    expect(revenueCatKey('ios')).toBe('appl_x');
    expect(revenueCatKey('web')).toBeNull();
  });

  it('without a key, paying is unavailable and configuring does nothing', async () => {
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', '');
    await expect(configureBilling('u1', 'android')).resolves.toBe(false);
    expect(
      await purchaseLicense({
        provider: 'revenuecat',
        offering: 'default',
        householdId: 'h',
        level: 2,
      }),
    ).toBe('unavailable');
    expect(await restorePurchases()).toBe('unavailable');
  });

  it('links to where the stores manage a subscription', () => {
    expect(manageSubscriptionUrl('android')).toBe(
      'https://play.google.com/store/account/subscriptions?package=com.nidoapp.casa',
    );
    expect(manageSubscriptionUrl('ios')).toBe('https://apps.apple.com/account/subscriptions');
  });
});
