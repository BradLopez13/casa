import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskFilterProvider, useTaskFilter } from './filter';

let current: ReturnType<typeof useTaskFilter> | null = null;
function Probe() {
  current = useTaskFilter();
  return null;
}

const tree = (householdId: string) => (
  <TaskFilterProvider householdId={householdId}>
    <Probe />
  </TaskFilterProvider>
);

describe('the member filter belongs to one household (bloque 12)', () => {
  it('switching household starts it again on Todos, also when coming back', () => {
    const { rerender } = render(tree('casa'));
    act(() => current?.select('bo'));
    expect(current?.assigneeId).toBe('bo');
    rerender(tree('mama'));
    expect(current?.assigneeId).toBeNull();
    rerender(tree('casa'));
    expect(current?.assigneeId).toBeNull();
  });
});
