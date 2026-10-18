import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

// Spec §9: one voice across the app. Two hard rules for every text in both languages, plus a
// soft check that nobody is addressed as «vosotros» (the app speaks to one person, «tú»).
const files = { es, en } as Record<string, Record<string, string>>;

describe.each(Object.keys(files))('%s.json style', (name) => {
  const entries = Object.entries(files[name] ?? {});

  it('has no dashes (— or –)', () => {
    expect(entries.filter(([, v]) => /[—–]/.test(v))).toEqual([]);
  });

  it('has no «¡» and no «!»', () => {
    expect(entries.filter(([, v]) => /[¡!]/.test(v))).toEqual([]);
  });
});

describe('es.json voice', () => {
  it('speaks to «tú», not «vosotros»', () => {
    expect(
      Object.entries(es as Record<string, string>).filter(([, v]) =>
        /\bvosotr[oa]s\b|\b(repartís|tenéis|podéis|sois|estáis)\b/i.test(v),
      ),
    ).toEqual([]);
  });
});
