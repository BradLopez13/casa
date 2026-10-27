import { describe, expect, it } from 'vitest';
import { AppError, isMissingOnServer, isTransient, toAppError } from './errors';

describe('toAppError', () => {
  it('maps a P0001 PostgREST error to its code', () => {
    const error = toAppError({ code: 'P0001', message: 'INVITE_EXPIRED' });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'INVITE_EXPIRED' });
  });

  it.each([
    'INVALID_TITLE',
    'INVALID_ROOM',
    'INVALID_ASSIGNEE',
    'TASK_NOT_FOUND',
    'CANNOT_DELETE_TASK',
    'INVALID_TIME_ZONE',
    'INVALID_PUSH_TOKEN',
    'INVALID_PREFS',
  ])('maps task code %s to itself', (code) => {
    expect(toAppError({ code: 'P0001', message: code })).toMatchObject({ code });
  });

  it('keeps what the server added to the code', () => {
    const error = toAppError({
      code: 'P0001',
      message: 'OWNER_MUST_TRANSFER',
      details: '["Casa", "Casa de mamá"]',
    });
    expect(error).toMatchObject({
      code: 'OWNER_MUST_TRANSFER',
      detail: '["Casa", "Casa de mamá"]',
    });
  });

  it.each(['ALREADY_A_MEMBER', 'LICENSE_REQUIRED', 'BILLING_DISABLED'])(
    'maps the household code %s to itself (bloque 12)',
    (code) => {
      expect(toAppError({ code: 'P0001', message: code })).toMatchObject({ code });
    },
  );

  it('tells a database a migration behind', () => {
    expect(isMissingOnServer({ code: 'PGRST202', message: 'no function' })).toBe(true);
    expect(isMissingOnServer({ code: 'PGRST205', message: 'no table' })).toBe(true);
    expect(isMissingOnServer({ code: 'P0001', message: 'NOT_A_MEMBER' })).toBe(false);
    expect(isMissingOnServer(null)).toBe(false);
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

  it('maps a request cut by the time limit to NETWORK', () => {
    const timeout = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    expect(toAppError(timeout)).toMatchObject({ code: 'NETWORK' });
    const aborted = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    expect(toAppError(aborted)).toMatchObject({ code: 'NETWORK' });
    // PostgREST hands back the fetch failure as `${name}: ${message}`.
    expect(toAppError({ message: 'TimeoutError: signal timed out', code: '' })).toMatchObject({
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

// Bloque 13 (P2-2): a server that is restarting, a token caught mid-refresh or a serialization
// clash used to be final and undo the person's note.
describe('isTransient', () => {
  const answer = (status: number, code?: string) =>
    toAppError({ code, message: 'whatever', details: null, hint: null }, status);

  it('keeps what the server never answered, and what it answered while unable to', () => {
    expect(isTransient(new AppError('NETWORK'), true)).toBe(true);
    for (const status of [500, 502, 503, 504, 408, 429]) {
      expect(isTransient(answer(status), true)).toBe(true);
    }
  });

  it('keeps the PostgREST and Postgres codes that pass on their own', () => {
    for (const code of ['PGRST301', 'PGRST003', '40001', '40P01', '57014']) {
      expect(isTransient(answer(400, code), true)).toBe(true);
    }
  });

  it('keeps a permission denied only when there is no session (sent with the anonymous key)', () => {
    expect(isTransient(answer(401, '42501'), false)).toBe(true);
    expect(isTransient(answer(403, '42501'), true)).toBe(false);
  });

  it('takes anything else the server says as final', () => {
    expect(isTransient(answer(400, 'P0001'), true)).toBe(false);
    expect(isTransient(answer(400, '23505'), true)).toBe(false);
    expect(isTransient(answer(404, 'PGRST202'), true)).toBe(false);
    expect(isTransient(new AppError('ITEM_NOT_FOUND'), true)).toBe(false);
    expect(isTransient(new AppError('UNKNOWN'), true)).toBe(false);
  });

  it('carries the status and the code on the error, for Sentry', () => {
    const error = answer(503, 'PGRST003');
    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(503);
    expect(error.serverCode).toBe('PGRST003');
  });
});
