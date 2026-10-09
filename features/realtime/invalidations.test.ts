import type { QueryKey } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidationBatcher, invalidationsFor } from './invalidations';

describe('invalidationsFor', () => {
  it('maps shopping_items to the list and its history', () => {
    expect(invalidationsFor('shopping_items')).toEqual([['shopping'], ['shopping-history']]);
  });

  it('maps both task tables to the tasks queries', () => {
    expect(invalidationsFor('task_series')).toEqual([['tasks']]);
    expect(invalidationsFor('task_occurrences')).toEqual([['tasks']]);
  });

  it('ignores any other table', () => {
    expect(invalidationsFor('households')).toEqual([]);
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
      expect.arrayContaining([['shopping'], ['shopping-history'], ['tasks']]),
    );
  });

  it('waits a full window from the first push, not from the last', () => {
    const { batcher, invalidate } = setup();
    batcher.push('task_series');
    vi.advanceTimersByTime(250);
    batcher.push('task_occurrences');
    vi.advanceTimersByTime(50);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith(['tasks']);
  });

  it('skips a key that is busy when the window closes', () => {
    const { batcher, invalidate } = setup((key) => key[0] === 'tasks');
    batcher.push('task_series');
    batcher.push('shopping_items');
    vi.advanceTimersByTime(300);
    expect(invalidate).not.toHaveBeenCalledWith(['tasks']);
    expect(invalidate).toHaveBeenCalledWith(['shopping']);
    expect(invalidate).toHaveBeenCalledWith(['shopping-history']);
  });

  it('ignores unknown tables without opening a window', () => {
    const { batcher, invalidate } = setup();
    batcher.push('households');
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

  it('flushAll invalidates the three keys at once and drops the pending window', () => {
    const { batcher, invalidate } = setup();
    batcher.push('task_series');
    batcher.flushAll();
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith(['tasks']);
    expect(invalidate).toHaveBeenCalledWith(['shopping']);
    expect(invalidate).toHaveBeenCalledWith(['shopping-history']);

    vi.advanceTimersByTime(300);
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('flushAll also leaves a busy key to its mutation', () => {
    const { batcher, invalidate } = setup((key) => key[0] === 'shopping');
    batcher.flushAll();
    expect(invalidate.mock.calls).toEqual([[['tasks']], [['shopping-history']]]);
  });
});
