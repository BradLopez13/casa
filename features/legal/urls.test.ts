import { afterEach, describe, expect, it } from 'vitest';
import { legalUrls, SITE_URL_DEFAULT } from './urls';

const site = process.env.EXPO_PUBLIC_SITE_URL;
afterEach(() => {
  process.env.EXPO_PUBLIC_SITE_URL = site;
});

// Bloque 15.5: the stores ask for the policy and the terms inside the app, in its language.
describe('legalUrls', () => {
  it('points at GitHub Pages until there is a domain', () => {
    delete process.env.EXPO_PUBLIC_SITE_URL;
    expect(SITE_URL_DEFAULT).toBe('https://bradlopez13.github.io/casa');
    expect(legalUrls('es')).toEqual({
      privacy: 'https://bradlopez13.github.io/casa/privacidad/',
      terms: 'https://bradlopez13.github.io/casa/terminos/',
      deleteAccount: 'https://bradlopez13.github.io/casa/cuenta/borrar/',
    });
  });

  it('has the English pages for an English phone', () => {
    delete process.env.EXPO_PUBLIC_SITE_URL;
    expect(legalUrls('en')).toEqual({
      privacy: 'https://bradlopez13.github.io/casa/en/privacy/',
      terms: 'https://bradlopez13.github.io/casa/en/terms/',
      deleteAccount: 'https://bradlopez13.github.io/casa/en/account/delete/',
    });
  });

  it('follows EXPO_PUBLIC_SITE_URL, with or without a trailing slash', () => {
    process.env.EXPO_PUBLIC_SITE_URL = 'https://nido.example/';
    expect(legalUrls('es').privacy).toBe('https://nido.example/privacidad/');
    process.env.EXPO_PUBLIC_SITE_URL = 'https://nido.example';
    expect(legalUrls('en').terms).toBe('https://nido.example/en/terms/');
  });

  it('treats an empty variable as unset', () => {
    process.env.EXPO_PUBLIC_SITE_URL = '';
    expect(legalUrls('es').terms).toBe('https://bradlopez13.github.io/casa/terminos/');
  });
});
