import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureBilling, purchaseLicense, restorePurchases } from './billing';

const sdk = vi.hoisted(() => ({
  configure: vi.fn(),
  logIn: vi.fn(),
  setAttributes: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));
vi.mock('react-native-purchases', () => ({ default: sdk }));

const offerings = {
  current: {
    identifier: 'default',
    availablePackages: [
      { identifier: 'casas_1', product: { identifier: 'casas_1' } },
      { identifier: 'casas_2', product: { identifier: 'casas_2' } },
    ],
  },
  all: {},
};

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'goog_x');
  for (const fn of Object.values(sdk)) fn.mockReset();
  sdk.getOfferings.mockResolvedValue(offerings);
});
afterEach(() => vi.unstubAllEnvs());

// Bloque 15.6: with the key, the SDK is configured once per person and the purchase goes through
// the package of the level the checkout names.
describe('with a RevenueCat key', () => {
  it('configures the SDK as the person, once', async () => {
    expect(await configureBilling('u1', 'android')).toBe(true);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'goog_x', appUserID: 'u1' });
    expect(await configureBilling('u1', 'android')).toBe(true);
    expect(sdk.configure).toHaveBeenCalledTimes(1);
  });

  it('buys the package of the level and tags the household', async () => {
    sdk.purchasePackage.mockResolvedValue({ customerInfo: {} });
    await configureBilling('u1', 'android');
    expect(
      await purchaseLicense({
        provider: 'revenuecat',
        offering: 'default',
        householdId: 'h',
        level: 2,
      }),
    ).toBe('purchased');
    expect(sdk.setAttributes).toHaveBeenCalledWith({ household_id: 'h' });
    expect(sdk.purchasePackage.mock.calls[0]![0]).toMatchObject({ identifier: 'casas_2' });
  });

  it('says so when the level is not on sale, or the person backed out', async () => {
    await configureBilling('u1', 'android');
    expect(
      await purchaseLicense({
        provider: 'revenuecat',
        offering: 'default',
        householdId: 'h',
        level: 5,
      }),
    ).toBe('unavailable');
    sdk.purchasePackage.mockRejectedValue({ userCancelled: true });
    expect(
      await purchaseLicense({
        provider: 'revenuecat',
        offering: 'default',
        householdId: 'h',
        level: 1,
      }),
    ).toBe('cancelled');
  });

  it('restores purchases through the SDK', async () => {
    sdk.restorePurchases.mockResolvedValue({ activeSubscriptions: ['casas_1'] });
    await configureBilling('u1', 'android');
    expect(await restorePurchases()).toBe('restored');
    sdk.restorePurchases.mockResolvedValue({ activeSubscriptions: [] });
    expect(await restorePurchases()).toBe('nothing');
  });
});
