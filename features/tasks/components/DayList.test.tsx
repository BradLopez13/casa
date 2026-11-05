import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StripDay } from '@/domain/tasks/strip';
import { DayList } from './DayList';

const TODAY = '2026-11-02';
const days: StripDay[] = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-11-0${2 + i}`,
  people: [],
  unassigned: false,
  count: i === 1 ? 2 : 0,
}));

function renderList(total: number, earlier: number) {
  render(
    <DayList
      days={days}
      selected={null}
      onSelect={vi.fn()}
      today={TODAY}
      marks={new Map()}
      names={new Map()}
      total={total}
      earlier={earlier}
    />,
  );
}

// Bloque 15.3 (P2-5): the tablet said «Todas 0» with four tasks from earlier days in the list.
describe('DayList', () => {
  it('«Todas» counts every open task of the filter, the earlier ones included', () => {
    renderList(6, 4);
    expect(screen.getByTestId('day-list.all').textContent).toBe('Todas6');
  });

  it('has a row for the earlier days with their count, that chooses nothing', () => {
    renderList(6, 4);
    const row = screen.getByTestId('day-list.earlier');
    expect(row.textContent).toBe('De días anteriores4');
    expect(row.getAttribute('role')).not.toBe('button');
  });

  it('has no earlier row when nothing waits from earlier days', () => {
    renderList(2, 0);
    expect(screen.queryByTestId('day-list.earlier')).toBeNull();
  });
});
