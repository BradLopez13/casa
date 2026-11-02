import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

/**
 * One formula for «no network» (bloque 15.3, P3-2): every text that announces the connection is
 * missing opens with «Sin conexión» / «No connection», and what follows is what happens or what
 * to do. Texts about the network coming back, or about what will be sent when it does, are not
 * announcements of its absence and keep their own words.
 */
const NOT_ABSENCE = new Set([
  // The connection is back.
  'offline.back',
  // A promise about the queue, not a refusal (decisión 1 del bloque 15).
  'tasks.unsentOffline',
]);

const SPANISH = /sin conexi[oó]n|sin red|necesitan? (?:red|conexi[oó]n)|con red\b|hace falta red/i;
const ENGLISH =
  /\boffline\b|no connection|needs? a connection|when you'?re online|back online|a connection\b/i;

function offenders(texts: Record<string, string>, speaks: RegExp, opening: string): string[] {
  return Object.entries(texts)
    .filter(([key, text]) => !NOT_ABSENCE.has(key) && speaks.test(text))
    .filter(([, text]) => !text.startsWith(opening))
    .map(([key, text]) => `${key}: ${text}`);
}

describe('one formula for «sin red»', () => {
  it('every Spanish text that says there is no network opens with «Sin conexión»', () => {
    expect(offenders(es, SPANISH, 'Sin conexión')).toEqual([]);
  });

  it('every English text that says there is no network opens with «No connection»', () => {
    expect(offenders(en, ENGLISH, 'No connection')).toEqual([]);
  });
});
