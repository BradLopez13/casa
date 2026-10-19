import { describe, expect, it } from 'vitest';
import { boughtRowLabel, boughtTitleLabel } from './rowLabels';

describe('boughtRowLabel', () => {
  it('says the name, the quantity and that you bought it', () =>
    expect(boughtRowLabel({ name: 'Leche', quantity: '2', buyer: 'Tú', byMe: true })).toBe(
      'Leche, 2, comprado por ti',
    ));
  it('names another buyer', () =>
    expect(boughtRowLabel({ name: 'Pan', quantity: null, buyer: 'Sara', byMe: false })).toBe(
      'Pan, comprado por Sara',
    ));
  it('says only that it is bought when the buyer left the household', () =>
    expect(boughtRowLabel({ name: 'Pan', quantity: null, buyer: undefined, byMe: false })).toBe(
      'Pan, comprado',
    ));
});

describe('boughtTitleLabel', () => {
  it('reads the count without the parenthesis', () => {
    expect(boughtTitleLabel(1)).toBe('En la bolsa, 1 producto');
    expect(boughtTitleLabel(3)).toBe('En la bolsa, 3 productos');
    expect(boughtTitleLabel(0)).toBe('En la bolsa, 0 productos');
  });
});
