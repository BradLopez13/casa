import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The store listing texts (store/<lang>/ficha.md) and the limits each store enforces: a text
// over its limit is refused by the console, so it is caught here first (bloque 15.5).
const ficha = (lang: 'es' | 'en') =>
  readFileSync(new URL(`../store/${lang}/ficha.md`, import.meta.url), 'utf8');

/** The text under the heading whose title starts with `title`, trimmed. */
function section(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith('## ') && line.includes(title));
  if (start < 0) throw new Error(`no section «${title}»`);
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim();
}

const LIMITS = {
  es: [
    ['Título', 30],
    ['Subtítulo', 30],
    ['Descripción corta', 80],
    ['Descripción larga', 4000],
    ['Palabras clave', 100],
    ['Notas de la versión', 500],
  ],
  en: [
    ['Title', 30],
    ['Subtitle', 30],
    ['Short description', 80],
    ['Full description', 4000],
    ['Keywords', 100],
    ['Release notes', 500],
  ],
} as const;

describe.each(['es', 'en'] as const)('store/%s/ficha.md', (lang) => {
  const markdown = ficha(lang);

  it.each([...LIMITS[lang]] as [string, number][])(
    '«%s» stays within %i characters',
    (title, limit) => {
      const text = section(markdown, title);
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(limit);
    },
  );

  it('keeps the keywords as a comma list without spaces, as App Store Connect counts them', () => {
    const keywords = section(markdown, lang === 'es' ? 'Palabras clave' : 'Keywords');
    expect(keywords).not.toMatch(/\s/);
    expect(keywords.split(',').length).toBeGreaterThan(5);
  });

  it('names the version 1.0.0 and the legal pages', () => {
    expect(markdown).toContain('1.0.0');
    expect(markdown).toContain('nido.app.avisos@gmail.com');
    expect(markdown).toContain('https://bradlopez13.github.io/casa/');
  });
});
