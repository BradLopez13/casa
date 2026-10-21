import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import { hintName, quickHintSegments } from './quickHint';

const members = [
  { id: 'me', name: 'Ana López' },
  { id: 'u2', name: 'Segundo' },
];

describe('quickHintSegments', () => {
  it.each([
    ['es', es],
    ['en', en],
  ] as const)('the %s example is understood: date, repeat and person', (locale, messages) => {
    const example = messages['tasks.quickHint.example'].replace('{name}', 'Segundo');
    const segments = quickHintSegments(example, {
      today: '2026-10-21',
      members,
      locale,
    });
    expect(segments.map((s) => s.text).join('')).toBe(example);
    const known = segments.filter((s) => s.known).map((s) => s.text);
    expect(known).toHaveLength(3);
    expect(known.at(-1)).toContain('Segundo');
  });

  it('the example without anyone still teaches the date and the repeat', () => {
    const segments = quickHintSegments(es['tasks.quickHint.exampleAlone'], {
      today: '2026-10-21',
      members: [],
      locale: 'es',
    });
    expect(segments.filter((s) => s.known)).toHaveLength(2);
  });
});

describe('hintName', () => {
  it('names someone else of the household, by the first word of their name', () => {
    expect(
      hintName(
        [
          { id: 'me', name: 'Ana López' },
          { id: 'u2', name: 'Bo Ruiz' },
        ],
        'me',
      ),
    ).toBe('Bo');
  });

  it('falls back to the person themself, and to nobody before the members load', () => {
    expect(hintName([{ id: 'me', name: 'Ana López' }], 'me')).toBe('Ana');
    expect(hintName([], 'me')).toBeNull();
  });
});
