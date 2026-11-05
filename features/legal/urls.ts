import { lang, type Locale } from '@/i18n';

/** Where `site/` is published until there is a domain (decisión 3 de Brad, bloque 15: B). */
export const SITE_URL_DEFAULT = 'https://bradlopez13.github.io/casa';

export type LegalPage = 'privacy' | 'terms' | 'deleteAccount';

const PATHS: Record<Locale, Record<LegalPage, string>> = {
  es: { privacy: 'privacidad/', terms: 'terminos/', deleteAccount: 'cuenta/borrar/' },
  en: { privacy: 'en/privacy/', terms: 'en/terms/', deleteAccount: 'en/account/delete/' },
};

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** The site's root: `EXPO_PUBLIC_SITE_URL` (the domain, once there is one) or GitHub Pages. */
export function siteUrl(): string {
  // Read by its full name so Expo inlines it; an empty value counts as unset.
  const raw: unknown = process.env.EXPO_PUBLIC_SITE_URL;
  const site = asString(raw)?.trim();
  return (site ? site : SITE_URL_DEFAULT).replace(/\/+$/, '');
}

/**
 * The legal pages in the app's language (bloque 15.5): the stores ask for the privacy policy
 * and the terms to be reachable from the app, and Google Play for a page that says how to delete
 * the account.
 */
export function legalUrls(language: Locale = lang): Record<LegalPage, string> {
  const base = siteUrl();
  const paths = PATHS[language];
  return {
    privacy: `${base}/${paths.privacy}`,
    terms: `${base}/${paths.terms}`,
    deleteAccount: `${base}/${paths.deleteAccount}`,
  };
}
