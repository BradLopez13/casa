import { describe, expect, it } from 'vitest';
import { repeatPillText } from './repeatPillText';

describe('repeatPillText', () => {
  it('names the interval once it is chosen', () => {
    expect(repeatPillText('interval', 3)).toBe('Cada 3 días');
  });
  it('invites a number while no interval is chosen', () => {
    expect(repeatPillText('interval', null)).toBe('Cada pocos días…');
  });
  it('keeps the plain label of the other choices', () => {
    expect(repeatPillText('daily', null)).toBe('Cada día');
    expect(repeatPillText('none', 3)).toBe('No');
  });
});
