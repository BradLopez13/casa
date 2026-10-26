import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { TaskFilterProvider, useTaskFilter } from './filter';

type Filter = ReturnType<typeof useTaskFilter>;

function Probe({ seen }: { seen: Filter[] }) {
  const filter = useTaskFilter();
  useEffect(() => {
    seen.push(filter);
  });
  return null;
}

describe('the member filter belongs to one household (bloque 12)', () => {
  it('switching household starts it again on Todos, also when coming back', () => {
    const seen: Filter[] = [];
    const tree = (householdId: string) => (
      <TaskFilterProvider householdId={householdId}>
        <Probe seen={seen} />
      </TaskFilterProvider>
    );
    const last = () => seen[seen.length - 1];
    const { rerender } = render(tree('casa'));
    act(() => last()?.select('bo'));
    expect(last()?.assigneeId).toBe('bo');
    rerender(tree('mama'));
    expect(last()?.assigneeId).toBeNull();
    rerender(tree('casa'));
    expect(last()?.assigneeId).toBeNull();
  });
});
