import { describe, expect, it } from 'vitest';
import { nidoSymbolColors } from './nidoSymbol';

describe('nidoSymbolColors', () => {
  it('uses ink on the left figure over a light background', () => {
    expect(nidoSymbolColors('light')).toEqual({ left: '#263663', right: '#F0AD83' });
  });
  it('turns the left figure cream over an ink background', () => {
    expect(nidoSymbolColors('dark')).toEqual({ left: '#FFF6E8', right: '#F0AD83' });
  });
});
