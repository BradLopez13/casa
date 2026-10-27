import { locale, t } from '@/i18n';
import type { HouseholdLicense, LicenseSummary } from './api';

// One licence per household, monthly, paid by whoever runs it (bloque 12). Billing is not on:
// the server's switch (private.app_settings.billing_enabled) decides what a licence allows, and
// this one only whether the app offers to pay. The price is configuration, never code.

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

/**
 * Where paying happens once billing is on: the provider's SDK (RevenueCat, decisión de Brad),
 * not installed until then. This stub is the contract: it gets what start_household_checkout
 * returned and says it cannot pay yet.
 */
export function purchaseLicense(_checkout: {
  provider: string;
  offering: string;
  householdId: string;
}): Promise<'unavailable'> {
  return Promise.resolve('unavailable');
}
