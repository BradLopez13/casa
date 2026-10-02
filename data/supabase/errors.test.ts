import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from './errors';

describe('toAppError', () => {
  it('maps a P0001 PostgREST error to its code', () => {
    const error = toAppError({ code: 'P0001', message: 'INVITE_EXPIRED' });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INVITE_EXPIRED' });
  });

  it('maps unknown P0001 messages to UNKNOWN', () => {
    expect(toAppError({ code: 'P0001', message: 'SOMETHING_ELSE' })).toMatchObject({
      code: 'UNKNOWN',
    });
  });

  it('maps a fetch TypeError to NETWORK', () => {
    const error = toAppError(new TypeError('Network request failed'));
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'NETWORK' });
  });

  it('maps a supabase-js wrapped fetch failure to NETWORK', () => {
    expect(toAppError({ message: 'TypeError: Network request failed', code: '' })).toMatchObject({
      code: 'NETWORK',
    });
  });

  it('returns an AppError unchanged', () => {
    const original = new AppError('NOT_OWNER');
    expect(toAppError(original)).toBe(original);
  });

  it('maps anything else to UNKNOWN', () => {
    expect(toAppError('boom')).toMatchObject({ code: 'UNKNOWN' });
    expect(toAppError(null)).toMatchObject({ code: 'UNKNOWN' });
    expect(toAppError({ code: '42501', message: 'permission denied' })).toMatchObject({
      code: 'UNKNOWN',
    });
  });
});
