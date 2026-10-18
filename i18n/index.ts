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

/** The one locale every Intl / toLocale* call in the app uses. */
export const locale = lang === 'en' ? 'en-US' : 'es-ES';

const messages: Record<MessageKey, string> = lang === 'en' ? en : es;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars?.[name];
    return value === undefined ? placeholder : String(value);
  });
}
