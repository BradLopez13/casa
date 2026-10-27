import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import { hintName, quickHintSegments, quickHintShown } from './quickHint';

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

describe('quickHintShown', () => {
  const open = { open: true };

  it('shows under the empty field at the default text, notes or not', () => {
    expect(quickHintShown({ ...open, fontScale: 1, hasNotes: true })).toBe(true);
    expect(quickHintShown({ ...open, fontScale: 1, hasNotes: false })).toBe(true);
  });

  it('keeps quiet from ×1.3 while the list has notes, so two of them fit (bloque 11)', () => {
    expect(quickHintShown({ ...open, fontScale: 1.3, hasNotes: true })).toBe(false);
    expect(quickHintShown({ ...open, fontScale: 1.6, hasNotes: true })).toBe(false);
  });

  it('comes back with the list empty, where it is the only hint', () => {
    expect(quickHintShown({ ...open, fontScale: 1.6, hasNotes: false })).toBe(true);
  });

  it('never shows once used', () => {
    expect(quickHintShown({ ...open, open: false, fontScale: 1, hasNotes: false })).toBe(false);
  });
});

describe('quickHintShown at the float 1.3 (bloque 13, P2-1)', () => {
  it('keeps quiet beside notes at the scale Android hands over for 1.3', () => {
    expect(quickHintShown({ open: true, fontScale: Math.fround(1.3), hasNotes: true })).toBe(false);
  });
});
