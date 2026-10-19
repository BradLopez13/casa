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
