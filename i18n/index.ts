import { getLocales } from 'expo-localization';
import en from './en.json';
import es from './es.json';

export type MessageKey = keyof typeof es;

export type Locale = 'es' | 'en';

/**
 * The app's language, read once from the phone (spec §10: no selector of our own). English when
 * the phone's first language is English, Spanish for anything else.
 */
export const lang: Locale = getLocales()[0]?.languageCode === 'en' ? 'en' : 'es';

type PhoneLocale = { languageCode: string | null; languageTag?: string };

/**
 * The phone's own locale (es-MX, en-GB…) when it speaks the app's language, so dates follow its
 * region; otherwise, or when Intl does not accept the tag, es-ES / en-US.
 */
export function resolveLocale(locales: readonly PhoneLocale[], appLang: Locale): string {
  const fallback = appLang === 'en' ? 'en-US' : 'es-ES';
  const first = locales[0];
  if (first?.languageCode !== appLang || !first.languageTag) return fallback;
  try {
    return Intl.getCanonicalLocales(first.languageTag)[0] ?? fallback;
  } catch {
    return fallback;
  }
}

/** The one locale every Intl / toLocale* call in the app uses. */
export const locale = resolveLocale(getLocales(), lang);

const messages: Record<MessageKey, string> = lang === 'en' ? en : es;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars?.[name];
    return value === undefined ? placeholder : String(value);
  });
}
