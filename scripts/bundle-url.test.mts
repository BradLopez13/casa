import { describe, expect, it } from 'vitest';
import { bundleUrls, checkBundle } from './bundle-url.mjs';

const prod = 'https://fyojaslimsgcabfbqdba.supabase.co';

describe('checkBundle (bloque 13, T-1)', () => {
  it('passes a bundle that names only the expected Supabase, strings back to back', () => {
    const text = `x${prod}coat-rackgetStatusMessage${prod}/rest/v1`;
    expect(checkBundle(text, `${prod}/`)).toEqual({ ok: true, urls: [prod] });
  });

  it('fails the bundle of an earlier build made for the local stack', () => {
    const text = 'abchttp://192.168.0.25:54321def';
    expect(checkBundle(text, prod)).toEqual({ ok: false, urls: ['http://192.168.0.25:54321'] });
  });

  it('fails a bundle that names two, or none', () => {
    expect(checkBundle(`${prod} https://abcdefghijabcdefghij.supabase.co`, prod).ok).toBe(false);
    expect(checkBundle('nothing here', prod)).toEqual({ ok: false, urls: [] });
  });

  it('finds a local stack written without its scheme', () => {
    expect(bundleUrls('10.0.2.2:54321')).toEqual(['http://10.0.2.2:54321']);
  });
});
