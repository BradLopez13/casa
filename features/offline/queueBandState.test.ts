import { describe, expect, it } from 'vitest';
import { queueBand, STUCK_FAILURES } from './queueBandState';

const change = (failureCount: number) => ({ failureCount });

describe('queueBand (bloque 13, P3-1)', () => {
  it('says nothing offline: the offline band already speaks', () => {
    expect(queueBand(false, [change(0), change(9)])).toBe('none');
  });

  it('says nothing with the queue empty, or with changes going out at the first try', () => {
    expect(queueBand(true, [])).toBe('none');
    // A tap online is on its way for a moment: no band flashing on every tap.
    expect(queueBand(true, [change(0)])).toBe('none');
  });

  it('says «Enviando…» once a change back online had to try again', () => {
    expect(queueBand(true, [change(0), change(1)])).toBe('sending');
  });

  it('says it could not send once a change keeps failing with a connection', () => {
    expect(queueBand(true, [change(STUCK_FAILURES - 1)])).toBe('sending');
    expect(queueBand(true, [change(1), change(STUCK_FAILURES)])).toBe('stuck');
  });
});
