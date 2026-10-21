import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/domain/tasks/views';
import { chosenPill, dayPills, daySections, emptyDayText } from './dayFilter';

const today = '2026-10-21';
const days = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
  date: `2026-10-${21 + i}`,
  people: [],
  unassigned: false,
  count: 0,
}));

let seq = 0;
function task(over: Partial<TaskItem> = {}): TaskItem {
  seq += 1;
  return {
    id: `t${seq}`,
    seriesId: `s${seq}`,
    title: `Task ${seq}`,
    room: null,
    assigneeId: null,
    dueOn: today,
    completedAt: null,
    completedBy: null,
    recurrence: null,
    skippedAt: null,
    generatedFrom: null,
    createdBy: null,
    createdAt: new Date(2026, 9, 1, 8, seq).toISOString(),
    ...over,
  };
}

describe('dayPills', () => {
  it('puts «Todas» first, then the seven days as Hoy, Mañana and «mié 22»', () => {
    const pills = dayPills(days, today);
    expect(pills.map((p) => p.date)).toEqual([null, ...days.map((d) => d.date)]);
    expect(pills.slice(0, 4).map((p) => p.label)).toEqual(['Todas', 'Hoy', 'Mañana', 'vie 23']);
  });
});

describe('chosenPill', () => {
  it('is «Todas» (null) until a day is chosen', () => {
    expect(chosenPill(days, null)).toBeNull();
  });

  it('keeps a chosen day while it is in the week', () => {
    expect(chosenPill(days, '2026-10-24')).toBe('2026-10-24');
  });

  it('falls back to «Todas» once the chosen day has left the week', () => {
    expect(chosenPill(days, '2026-10-20')).toBeNull();
    expect(chosenPill(days, '2026-11-01')).toBeNull();
  });
});

describe('daySections', () => {
  it('is one section with the open tasks due that day, keyed by its date', () => {
    const tasks = [
      task({ title: 'Hoy' }),
      task({ title: 'Mañana', dueOn: '2026-10-22' }),
      task({ title: 'Hecha', completedAt: '2026-10-21T10:00:00Z' }),
      task({ title: 'Ayer', dueOn: '2026-10-20' }),
    ];
    const sections = daySections(tasks, today, today);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ key: today, title: 'Hoy', count: 1 });
    expect(daySections(tasks, '2026-10-22', today)[0]).toMatchObject({
      key: '2026-10-22',
      title: 'Mañana',
      count: 1,
    });
  });

  it('is empty for a day with nothing on it, so the list says so in one line', () => {
    expect(daySections([task()], '2026-10-25', today)).toEqual([]);
  });
});

describe('emptyDayText', () => {
  it('names the day in one line, with no link', () => {
    expect(emptyDayText(today, today)).toBe('Nada para hoy');
    expect(emptyDayText('2026-10-22', today)).toBe('Nada para mañana');
    expect(emptyDayText('2026-10-23', today)).toBe('Nada para el viernes 23');
  });
});
