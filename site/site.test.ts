/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The public privacy policy that the store listings link to, published from site/ by
// .github/workflows/pages.yml at https://bradlopez13.github.io/casa/privacidad/.
const page = (rel: string) => readFileSync(path.join(__dirname, rel), 'utf8');

const pages = [
  { file: 'privacidad/index.html', lang: 'es', other: '../en/privacy/' },
  { file: 'en/privacy/index.html', lang: 'en', other: '../../privacidad/' },
] as const;

describe.each(pages)('privacy policy $file', ({ file, lang, other }) => {
  const html = page(file);

  it('is in its language and links to the other one', () => {
    expect(html).toContain(`<html lang="${lang}">`);
    expect(html).toContain(`href="${other}"`);
  });

  it('names who to write to', () => {
    expect(html).toContain('mailto:nido.app.avisos@gmail.com');
  });

  it('names every provider that handles data', () => {
    for (const provider of ['Supabase', 'Sentry', 'Firebase Cloud Messaging', 'Google', 'Apple']) {
      expect(html).toContain(provider);
    }
  });

  it('promises the 30 days after which a deleted household is erased', () => {
    // private.purge_deleted_households, every night (20261019120000_purge_deleted_households.sql).
    expect(html.replace(/\s+/g, ' ')).toContain(lang === 'es' ? 'a los 30 días' : 'after 30 days');
  });

  it('loads nothing from outside', () => {
    expect(html).not.toMatch(/<script|<link[^>]+href="https?:|src="https?:/);
  });
});

it('the site root sends visitors to the policy', () => {
  expect(page('index.html')).toContain('url=privacidad/');
});

// Bloque 14.3: the page an https invitation lands on without the app, ready for the domain
// (decisión 1: B now, A at the launch; site/INVITACIONES.md).
describe('invitation page', () => {
  const html = page('invite/index.html');

  it('says what it is, how to open it in Nido and the two steps without the app', () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('Te invitan a una casa en Nido');
    expect(html).toContain('Abrir la invitación en Nido');
    expect(html).toContain('play.google.com/store/apps/details?id=com.bradlopez13.casa');
    expect(html).toContain('¿Tienes un enlace?');
    expect(html).toContain('Unirme con un enlace');
  });

  it('loads nothing from outside and does not hand the token to anyone', () => {
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href="https?:|<img/);
    expect(html).toContain('name="referrer" content="no-referrer"');
    expect(html).toContain('name="robots" content="noindex"');
  });

  it('opens Nido with the token, with the store as the fallback on Android', () => {
    expect(html).toContain("'intent://invite?token='");
    expect(html).toContain('scheme=casa;package=com.bradlopez13.casa;S.browser_fallback_url=');
    expect(html).toContain("'casa://invite?token='");
    expect(html).toContain('/^[0-9a-f]{48}$/');
  });

  it('keeps the App Links and Universal Links files ready', () => {
    const links = JSON.parse(page('.well-known/assetlinks.json')) as {
      target: { package_name: string };
    }[];
    expect(links[0]?.target.package_name).toBe('com.bradlopez13.casa');
    expect(page('.well-known/apple-app-site-association')).toContain('/invite*');
  });
});

describe('app.config.js with an invite host', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { inviteLinks } = require('../app.config.js') as {
    inviteLinks: (host?: string) => {
      android: { intentFilters?: { autoVerify: boolean; data: { host: string }[] }[] };
      ios: { associatedDomains?: string[] };
    };
  };

  it('declares nothing without a host', () => {
    expect(inviteLinks(undefined)).toEqual({ android: {}, ios: {} });
  });

  it('declares verified App Links and Universal Links for the host', () => {
    const links = inviteLinks('nido.example');
    expect(links.android.intentFilters?.[0]?.autoVerify).toBe(true);
    expect(links.android.intentFilters?.[0]?.data[0]?.host).toBe('nido.example');
    expect(links.ios.associatedDomains).toEqual(['applinks:nido.example']);
  });
});
