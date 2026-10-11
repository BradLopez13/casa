import { describe, expect, it } from 'vitest';
import { permissionView } from './permissionView';

describe('permissionView', () => {
  it('shows nothing while unknown or granted', () => {
    expect(permissionView(null)).toBe('none');
    expect(permissionView('granted')).toBe('none');
  });
  it('offers the button when never asked', () => {
    expect(permissionView('undetermined')).toBe('enable');
  });
  it('points to system settings when denied', () => {
    expect(permissionView('denied')).toBe('denied');
  });
});
