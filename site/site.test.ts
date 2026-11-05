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

// Bloque 15.5: the site root is Nido's card, with the stores and the legal pages.
describe('the site root', () => {
  const html = page('index.html');

  it('names Nido, its tagline, the icon, both stores and the legal pages', () => {
    expect(html).toContain('<title>Nido · La casa, en equipo.</title>');
    expect(html).toContain('src="icon.png"');
    expect(html).toContain('id="play"');
    expect(html).toContain('id="app-store"');
    expect(html).toContain('href="privacidad/"');
    expect(html).toContain('href="terminos/"');
    expect(html).toContain('href="cuenta/borrar/"');
  });

  it('takes the store links from the deploy and says «pronto» without them', () => {
    expect(html).toContain('<body data-play-url="" data-app-store-id="">');
    expect(html).toContain('Pronto en Google Play y en la App Store.');
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href="https?:/);
  });
});

const legal = [
  { file: 'terminos/index.html', lang: 'es', other: '../en/terms/', privacy: '../privacidad/' },
  { file: 'en/terms/index.html', lang: 'en', other: '../../terminos/', privacy: '../privacy/' },
] as const;

const TERMS_ES = [
  'El servicio',
  'Tu cuenta',
  'La licencia y los pagos',
  'reembolso',
  '14 días',
  'menores de 14',
  'Uso aceptable',
  'Baja',
  'Cambios',
  'mailto:nido.app.avisos@gmail.com',
];
const TERMS_EN = [
  'The service',
  'Your account',
  'The licence and payments',
  'Refunds',
  '14-day',
  'under 14',
  'Acceptable use',
  'Leaving',
  'Changes',
  'mailto:nido.app.avisos@gmail.com',
];

// Bloque 15.5: the terms the stores ask for in an app with an account and a subscription.
describe.each(legal)('terms $file', ({ file, lang, other, privacy }) => {
  const html = page(file);

  it('is in its language and links to the other one and to the policy', () => {
    expect(html).toContain(`<html lang="${lang}">`);
    expect(html).toContain(`href="${other}"`);
    expect(html).toContain(`href="${privacy}"`);
  });

  it('covers the service, the account, payments, leaving, acceptable use, minors, changes and contact', () => {
    const flat = html.replace(/\s+/g, ' ');
    for (const needle of lang === 'es' ? TERMS_ES : TERMS_EN) expect(flat).toContain(needle);
  });

  it('loads nothing from outside', () => {
    expect(html).not.toMatch(/<script|<link[^>]+href="https?:|src="https?:/);
  });
});

const deletion = [
  {
    file: 'cuenta/borrar/index.html',
    lang: 'es',
    steps: ['Ajustes', 'Borrar mi cuenta', '30 días'],
  },
  {
    file: 'en/account/delete/index.html',
    lang: 'en',
    steps: ['Settings', 'Delete my account', '30 days'],
  },
] as const;

// Bloque 15.5: the account-deletion page Google Play asks for («Eliminación de datos»).
describe.each(deletion)('account deletion $file', ({ file, lang, steps }) => {
  const html = page(file).replace(/\s+/g, ' ');

  it('is in its language, gives the steps in the app and the email alternative', () => {
    expect(html).toContain(`<html lang="${lang}">`);
    for (const step of steps) expect(html).toContain(step);
    expect(html).toContain('mailto:nido.app.avisos@gmail.com');
  });
});

describe('privacy policy, bloque 15.5', () => {
  it.each(pages)(
    '$file names RevenueCat and the purchase data, dated 3 November 2026',
    ({ file, lang }) => {
      const html = page(file).replace(/\s+/g, ' ');
      expect(html).toContain('RevenueCat');
      expect(html).toContain(lang === 'es' ? '3 de noviembre de 2026' : '3 November 2026');
      expect(html).toContain(lang === 'es' ? 'href="../terminos/"' : 'href="../terms/"');
    },
  );
});

// Bloque 14.3: the page an https invitation lands on without the app, ready for the domain
// (decisión 1: B now, A at the launch; site/INVITACIONES.md).
describe('invitation page', () => {
  const html = page('invite/index.html');

  it('says what it is, how to open it in Nido and the two steps without the app', () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('Te invitan a una casa en Nido');
    expect(html).toContain('Abrir la invitación en Nido');
    expect(html).toContain('¿Tienes un enlace?');
    expect(html).toContain('Unirme con un enlace');
  });

  // Bloque 15.5 (P3-6): in the reader's language, with the App Store, and honest about Play.
  it('speaks English too, chosen by the browser', () => {
    expect(html).toContain("You're invited to a home in Nido");
    expect(html).toContain('navigator.language');
  });

  it('shows each store only when the deploy gives its link, and says so meanwhile', () => {
    expect(html).toContain('<body data-app-store-id="" data-play-url="">');
    expect(html).toContain("'https://apps.apple.com/app/id' + appStoreId");
    expect(html).toContain(
      'Nido aún no está en Google Play: pide a quien te invitó cómo instalarla.',
    );
    expect(html).not.toContain('play.google.com/store/apps/details');
  });

  it('loads nothing from outside and does not hand the token to anyone', () => {
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href="https?:|<img/);
    expect(html).toContain('name="referrer" content="no-referrer"');
    expect(html).toContain('name="robots" content="noindex"');
  });

  it('opens Nido with the token, with the store (or this page) as the fallback on Android', () => {
    expect(html).toContain("'intent://invite?token='");
    expect(html).toContain('scheme=casa;package=com.nidoapp.casa;S.browser_fallback_url=');
    expect(html).toContain("'casa://invite?token='");
    // Any case (bloque 15.5): the app accepts a capitalised token too.
    expect(html).toContain('/^[0-9a-f]{48}$/i');
    expect(html).toContain("var fallback = playUrl || location.href.split('#')[0] + '#instalar';");
  });

  it('keeps the App Links and Universal Links files ready', () => {
    const links = JSON.parse(page('.well-known/assetlinks.json')) as {
      target: { package_name: string };
    }[];
    expect(links[0]?.target.package_name).toBe('com.nidoapp.casa');
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

  it('declares nothing without a host, nor for a host with a path', () => {
    expect(inviteLinks(undefined)).toEqual({ android: {}, ios: {} });
    expect(inviteLinks('bradlopez13.github.io/casa')).toEqual({ android: {}, ios: {} });
  });

  it('declares verified App Links and Universal Links for the host', () => {
    const links = inviteLinks('nido.example');
    expect(links.android.intentFilters?.[0]?.autoVerify).toBe(true);
    expect(links.android.intentFilters?.[0]?.data[0]?.host).toBe('nido.example');
    expect(links.ios.associatedDomains).toEqual(['applinks:nido.example']);
  });
});
