import { describe, expect, it } from 'vitest';
import { dayHeading } from '@/domain/tasks/labels';
import type { TaskListSection } from './sections';
import { chosenDay, weekDayPane } from './weekPanes';

const TODAY = '2026-10-09';
const days = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-10-${String(9 + i).padStart(2, '0')}`,
}));
const section = (key: string, count = 1): TaskListSection => ({ key, title: key, count, data: [] });

describe('chosenDay', () => {
  it('starts on today', () => {
    expect(chosenDay(days, null, TODAY)).toBe(TODAY);
  });

  it('keeps a day chosen inside the week', () => {
    expect(chosenDay(days, '2026-10-12', TODAY)).toBe('2026-10-12');
  });

  it('keeps the tapped day even when it has no tasks', () => {
    // `days` is the week itself, so a day with nothing on it is still a day to choose.
    const empty = [{ date: TODAY }, { date: '2026-10-10' }];
    expect(chosenDay(empty, '2026-10-10', TODAY)).toBe('2026-10-10');
  });

  it('falls back to today once the chosen day has left the week', () => {
    expect(chosenDay(days, '2026-10-08', TODAY)).toBe(TODAY);
    expect(chosenDay(days, '2026-10-30', TODAY)).toBe(TODAY);
  });
});

describe('weekDayPane', () => {
  it('shows the overdue section and the chosen day', () => {
    const sections = [section('overdue'), section(TODAY), section('2026-10-11')];
    const pane = weekDayPane(sections, '2026-10-11', TODAY);
    expect(pane.overdue?.key).toBe('overdue');
    expect(pane.day.key).toBe('2026-10-11');
  });

  it('keeps the overdue section whatever the day', () => {
    const sections = [section('overdue'), section(TODAY)];
    expect(weekDayPane(sections, '2026-10-13', TODAY).overdue?.key).toBe('overdue');
  });

  it('has no overdue section when nothing is overdue', () => {
    expect(weekDayPane([section(TODAY)], TODAY, TODAY).overdue).toBeNull();
  });

  it('gives an empty day its heading and a count of 0', () => {
    const pane = weekDayPane([section(TODAY)], '2026-10-12', TODAY);
    expect(pane.day).toEqual({
      key: '2026-10-12',
      title: dayHeading('2026-10-12', TODAY),
      count: 0,
      data: [],
    });
  });
});
