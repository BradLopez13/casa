import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { assertQueuedBy, droppedOnSignOut, setSessionUser } from './sessionUser';

afterEach(() => {
  setSessionUser(undefined);
});

describe('assertQueuedBy', () => {
  it('lets a change go as the person who made it', () => {
    setSessionUser('ana');
    expect(() => assertQueuedBy('ana')).not.toThrow();
  });

  it('drops a change made by someone who signed out (bloque 11)', () => {
    setSessionUser('bo');
    expect(() => assertQueuedBy('ana')).toThrow(new AppError('NOT_AUTHENTICATED'));
    setSessionUser(null);
    expect(() => assertQueuedBy('ana')).toThrow(new AppError('NOT_AUTHENTICATED'));
  });

  it('lets the queue resume before the session is read', () => {
    expect(() => assertQueuedBy('ana')).not.toThrow();
  });

  it('says a dropped change needs no notice', () => {
    expect(droppedOnSignOut(new AppError('NOT_AUTHENTICATED'))).toBe(true);
    expect(droppedOnSignOut(new AppError('NETWORK'))).toBe(false);
  });
});
