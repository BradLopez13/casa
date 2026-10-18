import { describe, expect, it } from 'vitest';
import { canStep, quantityStep, stepQuantity } from './quantity';

describe('quantityStep', () => {
  it('reads no quantity as one', () => expect(quantityStep(null)).toEqual({ count: 1, unit: '' }));
  it('keeps the unit after the number', () =>
    expect(quantityStep('2 kg')).toEqual({ count: 2, unit: ' kg' }));
  it('reads a bare number', () => expect(quantityStep('6')).toEqual({ count: 6, unit: '' }));
  it.each(['1,5 kg', '0.5 l', 'un poco', '0', '100', ''])('cannot step %j', (q) =>
    expect(quantityStep(q)).toBeNull(),
  );
});

describe('stepQuantity', () => {
  it.each([
    [null, 1, '2'],
    ['2', -1, null],
    ['3', -1, '2'],
    ['1 kg', 1, '2 kg'],
    ['1 kg', -1, null],
    ['99', 1, '99'],
    ['10', -1, '9'],
    ['9', 1, '10'],
  ] as const)('%j %i → %j', (q, delta, expected) => expect(stepQuantity(q, delta)).toBe(expected));
  it('leaves a quantity it cannot step as it is', () =>
    expect(stepQuantity('un poco', 1)).toBe('un poco'));
  it('does not grow past 20 characters', () => {
    const q = '9 paquetes grandes 1';
    expect(q).toHaveLength(20);
    expect(stepQuantity(q, 1)).toBe(q);
  });
});

describe('canStep', () => {
  it('cannot go below no quantity', () => expect(canStep(null, -1)).toBe(false));
  it('can go up from no quantity', () => expect(canStep(null, 1)).toBe(true));
  it('stops at 99', () => expect(canStep('99', 1)).toBe(false));
  it('cannot step free text', () => expect(canStep('un poco', 1)).toBe(false));
  it('cannot grow past 20 characters', () =>
    expect(canStep('9 paquetes grandes 1', 1)).toBe(false));
  it('can take the quantity away from one with a unit', () =>
    expect(canStep('1 kg', -1)).toBe(true));
});
