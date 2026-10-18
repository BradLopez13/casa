import { describe, expect, it } from 'vitest';
import es from './es.json';

// Spec §9: one voice across the app. Two hard rules for every text, plus a soft
// check that nobody is addressed as «vosotros» (the app speaks to one person, «tú»).
const entries = Object.entries(es as Record<string, string>);

describe('es.json style', () => {
  it('has no dashes (— or –)', () => {
    expect(entries.filter(([, v]) => /[—–]/.test(v))).toEqual([]);
  });

  it('has no «¡»', () => {
    expect(entries.filter(([, v]) => v.includes('¡'))).toEqual([]);
  });

  it('speaks to «tú», not «vosotros»', () => {
    expect(
      entries.filter(([, v]) =>
        /\bvosotr[oa]s\b|\b(repartís|tenéis|podéis|sois|estáis)\b/i.test(v),
      ),
    ).toEqual([]);
  });
});
