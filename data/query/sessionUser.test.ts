import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import {
  assertQueuedBy,
  consumeSigningOut,
  droppedOnSignOut,
  markSigningOut,
  setSessionUser,
} from './sessionUser';

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

describe('an asked sign-out (bloque 13)', () => {
  it('marks the SIGNED_OUT that follows it, once', () => {
    markSigningOut(1000);
    expect(consumeSigningOut(2000)).toBe(true);
    expect(consumeSigningOut(2000)).toBe(false);
  });

  it('does not mark a sign-out much later, after one that failed', () => {
    markSigningOut(1000);
    expect(consumeSigningOut(1000 + 31_000)).toBe(false);
  });
});
