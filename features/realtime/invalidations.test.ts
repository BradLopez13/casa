import type { QueryKey } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidationBatcher, invalidationsFor } from './invalidations';

describe('invalidationsFor', () => {
  it('maps shopping_items to the list and its history', () => {
    expect(invalidationsFor('shopping_items', 'h')).toEqual([
      ['shopping', 'h'],
      ['shopping-history', 'h'],
    ]);
  });

  it('maps both task tables to the tasks queries', () => {
    expect(invalidationsFor('task_series', 'h')).toEqual([['tasks', 'h']]);
    expect(invalidationsFor('task_occurrences', 'h')).toEqual([['tasks', 'h']]);
  });

  it('maps the household to its membership and ignores the dropped categories table', () => {
    expect(invalidationsFor('household_item_categories', 'h')).toEqual([]);
    expect(invalidationsFor('households', 'h')).toEqual([['membership'], ['households']]);
  });

  it('maps household members to the member lists, the membership and the household list', () => {
    expect(invalidationsFor('household_members', 'h')).toEqual([
      ['members', 'h'],
      ['membership'],
      ['households'],
    ]);
  });

  it('maps a licence change to the licence, the membership and the household list (bloque 12)', () => {
    expect(invalidationsFor('household_licenses', 'h')).toEqual([
      ['license', 'h'],
      ['membership'],
      ['households'],
    ]);
  });

  it('ignores any other table', () => {
    expect(invalidationsFor('profiles', 'h')).toEqual([]);
  });
});

describe('createInvalidationBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(isBusy: (key: QueryKey) => boolean = () => false) {
    const invalidate = vi.fn<(key: QueryKey) => void>();
    const batcher = createInvalidationBatcher({
      householdId: 'h',
      delayMs: 300,
      isBusy,
      invalidate,
      setTimer: setTimeout,
      clearTimer: clearTimeout,
    });
    return { batcher, invalidate };
  }

  it('invalidates each key once for a burst inside the window', () => {
    const { batcher, invalidate } = setup();
    batcher.push('shopping_items');
    vi.advanceTimersByTime(100);
    batcher.push('task_series');
    vi.advanceTimersByTime(100);
    batcher.push('shopping_items');
    expect(invalidate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate.mock.calls.map(([key]) => key)).toEqual(
      expect.arrayContaining([
        ['shopping', 'h'],
        ['shopping-history', 'h'],
        ['tasks', 'h'],
      ]),
    );
  });

  it('waits a full window from the first push, not from the last', () => {
    const { batcher, invalidate } = setup();
    batcher.push('task_series');
    vi.advanceTimersByTime(250);
    batcher.push('task_occurrences');
    vi.advanceTimersByTime(50);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith(['tasks', 'h']);
  });

  it('skips a key that is busy when the window closes', () => {
    const { batcher, invalidate } = setup((key) => key[0] === 'tasks');
    batcher.push('task_series');
    batcher.push('shopping_items');
    vi.advanceTimersByTime(300);
    expect(invalidate).not.toHaveBeenCalledWith(['tasks', 'h']);
    expect(invalidate).toHaveBeenCalledWith(['shopping', 'h']);
    expect(invalidate).toHaveBeenCalledWith(['shopping-history', 'h']);
  });

  it('ignores unknown tables without opening a window', () => {
    const { batcher, invalidate } = setup();
    batcher.push('profiles');
    vi.advanceTimersByTime(300);
    expect(invalidate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose cancels whatever is pending', () => {
    const { batcher, invalidate } = setup();
    batcher.push('shopping_items');
    batcher.dispose();
    vi.advanceTimersByTime(1000);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('flushAll invalidates every realtime key at once and drops the pending window', () => {
    const { batcher, invalidate } = setup();
    batcher.push('task_series');
    batcher.flushAll();
    expect(invalidate).toHaveBeenCalledTimes(7);
    for (const key of [
      ['tasks', 'h'],
      ['shopping', 'h'],
      ['shopping-history', 'h'],
      ['members', 'h'],
      ['license', 'h'],
      ['membership'],
      ['households'],
    ]) {
      expect(invalidate).toHaveBeenCalledWith(key);
    }

    vi.advanceTimersByTime(300);
    expect(invalidate).toHaveBeenCalledTimes(7);
  });

  it('flushAll also leaves a busy key to its mutation', () => {
    const { batcher, invalidate } = setup((key) => key[0] === 'shopping');
    batcher.flushAll();
    expect(invalidate.mock.calls).toEqual([
      [['tasks', 'h']],
      [['shopping-history', 'h']],
      [['members', 'h']],
      [['license', 'h']],
      [['membership']],
      [['households']],
    ]);
  });
});
