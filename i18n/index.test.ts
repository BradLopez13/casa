import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t', () => {
  it('returns the Spanish text for a key', () => {
    expect(t('app.name')).toBe('Casa');
  });
  it('interpolates variables', () => {
    expect(t('members.count', { count: 3 })).toBe('3 miembros');
  });
  it('leaves unknown placeholders untouched', () => {
    expect(t('members.count')).toBe('{count} miembros');
  });
});
