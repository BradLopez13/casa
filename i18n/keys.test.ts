import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

// Spec §10: the English file has exactly the Spanish keys, and each text takes the same
// {placeholders}, so t() never leaves a variable unfilled in one language.
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('en.json', () => {
  it('has exactly the keys of es.json', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('uses the same placeholders as es.json for every key', () => {
    const english = en as Record<string, string>;
    const mismatched = Object.entries(es as Record<string, string>).filter(
      ([key, text]) => placeholders(english[key] ?? '').join(',') !== placeholders(text).join(','),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});
