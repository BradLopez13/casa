import { describe, expect, it } from 'vitest';
import { permissionStatus } from './permissionStatus';

describe('permissionStatus', () => {
  it('passes granted and denied through', () => {
    expect(permissionStatus('granted')).toBe('granted');
    expect(permissionStatus('denied')).toBe('denied');
  });

  it('is unknown before the read and while never asked', () => {
    expect(permissionStatus(null)).toBe('unknown');
    expect(permissionStatus('undetermined')).toBe('unknown');
  });
});
