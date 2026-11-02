import { locale, t } from '@/i18n';
import type { Checkout, HouseholdLicense, LicenseSummary } from './api';

// One licence per household, monthly, paid by whoever runs it (bloque 12), bought as one
// subscription per person with a level per number of households (casas_1 … casas_10; decisión
// de Brad, 27 de octubre; bloque 15.6). Billing is not on: the server's switch
// (private.app_settings.billing_enabled) decides what a licence allows, and this one only whether
// the app offers to pay. The price is configuration, never code. Without a RevenueCat key the SDK
// is never loaded and paying is «unavailable», exactly as before the SDK was installed.

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** Whether this build offers «Pagar la licencia» (EXPO_PUBLIC_BILLING_ENABLED, off by default). */
export function billingEnabled(): boolean {
  // Read by its full name so Expo inlines it.
  const raw: unknown = process.env.EXPO_PUBLIC_BILLING_ENABLED;
  return asString(raw) === 'true';
}

/** The monthly price as the build sets it («2,99 €»), or null when it does not. */
export function licensePrice(): string | null {
  const raw: unknown = process.env.EXPO_PUBLIC_LICENSE_PRICE;
  const price = asString(raw)?.trim();
  return price ? price : null;
}

/** The subscription products, one per level: how many households the person leads it covers. */
export const LICENSE_PRODUCTS = Array.from({ length: 10 }, (_, i) => `casas_${i + 1}`);

/** The product for a number of households, 1 to 10. */
export function productFor(level: number): string {
  return `casas_${Math.min(10, Math.max(1, Math.floor(level)))}`;
}

export type Platform = 'ios' | 'android' | 'web';

/** The RevenueCat public key of this platform's app, from the build; null without one. */
export function revenueCatKey(platform: Platform): string | null {
  const ios: unknown = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const android: unknown = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  const key = platform === 'ios' ? asString(ios) : platform === 'android' ? asString(android) : '';
  return key ? key : null;
}

/** Where each store manages a subscription (the stores ask for the link in the app). */
export function manageSubscriptionUrl(platform: Platform): string {
  return platform === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions?package=com.bradlopez13.casa';
}

type Sdk = typeof import('react-native-purchases').default;

let configuredFor: string | null = null;

/** The SDK, loaded only once a key exists (never in Expo Go, Node or a build without one). */
async function sdk(): Promise<Sdk> {
  return (await import('react-native-purchases')).default;
}

/**
 * Configures RevenueCat as this person once per session, with the platform's key. False without
 * a key: nothing is loaded. The `app_user_id` is the Supabase user id, so the webhook's events
 * name the payer (`apply_billing_event`).
 */
export async function configureBilling(userId: string, platform: Platform): Promise<boolean> {
  const apiKey = revenueCatKey(platform);
  if (apiKey === null) return false;
  if (configuredFor === userId) return true;
  const purchases = await sdk();
  // The SDK is configured once per process; another person signs in on it.
  if (configuredFor === null) purchases.configure({ apiKey, appUserID: userId });
  else await purchases.logIn(userId);
  configuredFor = userId;
  return true;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable';

/**
 * Buys the package of the level the checkout names (casas_n), tagging the household the person
 * pays from so the first event can tie the subscription to it. «unavailable» without the SDK
 * configured or without that package on sale; «cancelled» when the person backed out of the
 * store's sheet.
 */
export async function purchaseLicense(checkout: Checkout): Promise<PurchaseOutcome> {
  if (configuredFor === null) return 'unavailable';
  const purchases = await sdk();
  const product = productFor(checkout.level);
  const offerings = await purchases.getOfferings();
  const offering = offerings.all[checkout.offering] ?? offerings.current;
  // Play reports its products as «casas_2:mensual» (product:base plan).
  const pkg = offering?.availablePackages.find(
    (p) => p.product.identifier.split(':')[0] === product || p.identifier === product,
  );
  if (!pkg) return 'unavailable';
  try {
    await purchases.setAttributes({ household_id: checkout.householdId });
    // On Android a change of level replaces the subscription on sale: without the old product
    // Play would sell a second one (revisión 15.6).
    const active = (await purchases.getCustomerInfo()).activeSubscriptions.find(
      (id) => id.split(':')[0] !== product,
    );
    await purchases.purchasePackage(pkg, null, active ? { oldProductIdentifier: active } : null);
    return 'purchased';
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'userCancelled' in error) {
      if ((error as { userCancelled?: unknown }).userCancelled === true) return 'cancelled';
    }
    throw error;
  }
}

export type RestoreOutcome = 'restored' | 'nothing' | 'unavailable';

/** «Restaurar compras», which both stores ask for: the person's subscriptions, found again. */
export async function restorePurchases(): Promise<RestoreOutcome> {
  if (configuredFor === null) return 'unavailable';
  const purchases = await sdk();
  const info = await purchases.restorePurchases();
  return info.activeSubscriptions.length > 0 ? 'restored' : 'nothing';
}

/** «3 de noviembre» for a licence date. */
export function licenseDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

/** The licence screen's big line: «Incluida por ahora», «De prueba hasta el 9 de noviembre»… */
export function licenseHeadline(license: HouseholdLicense): string {
  const { status, trialEndsAt, currentPeriodEnd } = license;
  switch (status) {
    case 'complimentary':
      return t('license.complimentary');
    case 'trial':
      if (!trialEndsAt) return t('license.complimentary');
      return new Date(trialEndsAt).getTime() > Date.now()
        ? t('license.trialUntil', { date: licenseDate(trialEndsAt) })
        : t('license.trialEnded', { date: licenseDate(trialEndsAt) });
    case 'active':
      return currentPeriodEnd
        ? t('license.activeUntil', { date: licenseDate(currentPeriodEnd) })
        : t('license.active');
    case 'past_due':
      return currentPeriodEnd
        ? t('license.pastDueSince', { date: licenseDate(currentPeriodEnd) })
        : t('license.pastDue');
    case 'canceled':
      return currentPeriodEnd
        ? t('license.canceledOn', { date: licenseDate(currentPeriodEnd) })
        : t('license.canceled');
  }
}

/**
 * The band's sentence when the household's licence no longer lets it write, or null while it
 * does (always, while billing is off on the server). Reading stays as it was.
 */
export function licenseBandText(license: LicenseSummary | undefined): string | null {
  if (!license || license.licensed) return null;
  return license.endsAt
    ? t('license.band', { date: licenseDate(license.endsAt) })
    : t('license.bandNoDate');
}
