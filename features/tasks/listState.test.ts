import { describe, expect, it } from 'vitest';
import { taskListState } from './listState';

const idle = { isPending: false, isError: false, hasData: false, errorIsNetwork: false };

describe('taskListState', () => {
  it('is loading while the first fetch runs', () => {
    expect(taskListState({ ...idle, isPending: true })).toBe('loading');
  });

  it('shows the error when nothing was ever loaded', () => {
    expect(taskListState({ ...idle, isError: true, errorIsNetwork: true })).toBe('error');
  });

  it('shows the empty state when a refresh failed for lack of network over cached tasks', () => {
    // The offline band already says so; the list must not show an error as well.
    expect(taskListState({ ...idle, isError: true, hasData: true, errorIsNetwork: true })).toBe(
      'empty',
    );
  });

  it('still shows the error when a refresh over cached tasks failed for another reason', () => {
    expect(taskListState({ ...idle, isError: true, hasData: true })).toBe('error');
  });

  it('shows the empty state when loaded', () => {
    expect(taskListState({ ...idle, hasData: true })).toBe('empty');
  });
});
