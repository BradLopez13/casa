import { describe, expect, it } from 'vitest';
import { isFresh, markFresh, takeFresh } from './freshIds';

describe('freshIds', () => {
  it('is not fresh unless marked in this session', () => {
    expect(isFresh('old')).toBe(false);
    expect(takeFresh('old')).toBe(false);
  });

  it('gives a mark once', () => {
    markFresh('n1');
    expect(isFresh('n1')).toBe(true);
    expect(takeFresh('n1')).toBe(true);
    expect(takeFresh('n1')).toBe(false);
    expect(isFresh('n1')).toBe(false);
  });

  it('keeps created and completed apart', () => {
    markFresh('n2', 'done');
    expect(takeFresh('n2')).toBe(false);
    expect(takeFresh('n2', 'done')).toBe(true);
  });
});
