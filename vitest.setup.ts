import { vi } from 'vitest';

// expo-localization needs the native module; tests run with a Spanish phone unless a test
// mocks it again (i18n/index.test.ts does, for English).
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-ES' }],
  getCalendars: () => [{ timeZone: 'Europe/Madrid' }],
}));
