import { describe, expect, it } from 'vitest';
import { dueLabel } from './labels';

describe('dueLabel', () => {
  const today = '2026-10-04';
  it('labels today, tomorrow, yesterday and no date', () => {
    expect(dueLabel('2026-10-04', today)).toBe('Hoy');
    expect(dueLabel('2026-10-05', today)).toBe('Mañana');
    expect(dueLabel('2026-10-03', today)).toBe('Ayer');
    expect(dueLabel(null, today)).toBe('Sin fecha');
  });
  it('writes a far date with the Spanish month name', () => {
    expect(dueLabel('2026-10-20', today)).toContain('octubre');
    expect(dueLabel('2026-12-24', today)).toContain('diciembre');
  });
});
