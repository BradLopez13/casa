import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('returns the Spanish text for a key', () => {
    expect(t('app.name')).toBe('Nido');
  });
  it('interpolates variables', () => {
    expect(t('members.count', { count: 3 })).toBe('3 miembros');
  });
  it('uses the singular form key for one member', () => {
    expect(t('members.countOne')).toBe('1 miembro');
  });
  it('leaves unknown placeholders untouched', () => {
    expect(t('members.count')).toBe('{count} miembros');
  });
});

/** The i18n module as a phone whose first language is `languageCode` loads it. */
async function loadWithPhone(languageCode: string | null) {
  vi.resetModules();
  vi.doMock('expo-localization', () => ({
    getLocales: () => (languageCode === null ? [] : [{ languageCode }]),
  }));
  return import('./index');
}

describe('language from the phone', () => {
  afterEach(() => {
    vi.doUnmock('expo-localization');
    vi.resetModules();
  });

  it('speaks English on an English phone', async () => {
    const i18n = await loadWithPhone('en');
    expect(i18n.lang).toBe('en');
    expect(i18n.locale).toBe('en-US');
    expect(i18n.t('members.count', { count: 3 })).toBe('3 members');
    expect(i18n.t('tabs.today')).toBe('Today');
  });

  it('speaks Spanish on a Spanish phone', async () => {
    const i18n = await loadWithPhone('es');
    expect(i18n.lang).toBe('es');
    expect(i18n.locale).toBe('es-ES');
    expect(i18n.t('tabs.today')).toBe('Hoy');
  });

  it('falls back to Spanish for any other language', async () => {
    const i18n = await loadWithPhone('fr');
    expect(i18n.lang).toBe('es');
    expect(i18n.t('tabs.today')).toBe('Hoy');
  });

  it('falls back to Spanish when the phone reports no language', async () => {
    const i18n = await loadWithPhone(null);
    expect(i18n.locale).toBe('es-ES');
  });
});
