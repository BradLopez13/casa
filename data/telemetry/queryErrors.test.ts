import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { errorReport } from './queryErrors';

describe('errorReport (bloque 13, T-2)', () => {
  it('reports an unknown answer from a query or a mutation, with key, code and status only', () => {
    const error = new AppError('UNKNOWN', undefined, { status: 503, serverCode: 'PGRST003' });
    expect(errorReport(error, { key: ['tasks', 'h1'], queued: false })).toEqual({
      key: 'tasks',
      code: 'UNKNOWN',
      status: 503,
      serverCode: 'PGRST003',
      queued: false,
    });
  });

  it('reports a queued change the queue dropped, whatever its code', () => {
    expect(
      errorReport(new AppError('ITEM_NOT_FOUND'), { key: ['shopping', 'bought'], queued: true }),
    ).toMatchObject({ key: 'shopping/bought', code: 'ITEM_NOT_FOUND', queued: true });
  });

  it('leaves out what the person already hears and what is not a fault', () => {
    expect(
      errorReport(new AppError('INVALID_TITLE'), { key: ['tasks'], queued: false }),
    ).toBeNull();
    expect(errorReport(new AppError('NETWORK'), { key: ['tasks'], queued: true })).toBeNull();
    // Signed out: the queue let it go on purpose.
    expect(
      errorReport(new AppError('NOT_AUTHENTICATED'), { key: ['tasks', 'toggle'], queued: true }),
    ).toBeNull();
  });

  it('never carries anything but strings from the key', () => {
    const report = errorReport(new AppError('UNKNOWN'), {
      key: ['shopping', { name: 'Leche' }],
      queued: false,
    });
    expect(JSON.stringify(report)).not.toContain('Leche');
  });
});
