import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/domain/tasks/views';
import { allSections, todaySections } from './sections';

const TODAY = '2026-10-09';

let seq = 0;
function task(over: Partial<TaskItem> = {}): TaskItem {
  seq += 1;
  return {
    id: `t${seq}`,
    seriesId: `s${seq}`,
    title: `Task ${seq}`,
    room: null,
    assigneeId: null,
    dueOn: null,
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

const doneToday = () => task({ completedAt: new Date(2026, 9, 9, 10, 0).toISOString() });

describe('todaySections', () => {
  it('lists today, then overdue, then the done tray', () => {
    const late = task({ dueOn: '2026-10-07' });
    const due = task({ dueOn: TODAY });
    const done = doneToday();
    const sections = todaySections([done, due, late], TODAY);
    expect(sections.map((s) => [s.key, s.title, s.count])).toEqual([
      ['today', 'Para hoy', 1],
      ['overdue', 'De días anteriores', 1],
      ['doneToday', 'Hechas hoy', 1],
    ]);
    expect(sections[1]?.data).toEqual([{ kind: 'note', task: late }]);
    expect(sections[2]?.data).toEqual([{ kind: 'tray', tasks: [done] }]);
  });

  it('puts overdue first when nothing is due today', () => {
    const late = task({ dueOn: '2026-10-07' });
    const done = doneToday();
    expect(todaySections([done, late], TODAY).map((s) => s.key)).toEqual(['overdue', 'doneToday']);
  });

  it('drops empty sections, including an empty tray', () => {
    const due = task({ dueOn: TODAY });
    expect(todaySections([due], TODAY).map((s) => s.key)).toEqual(['today']);
    expect(todaySections([], TODAY)).toEqual([]);
  });
});

describe('allSections', () => {
  // TODAY, 9 October 2026, is a Friday: Saturday and Sunday are still this week.
  it('groups by date: earlier days, today, this week, later, no date, then the tray (fase 10c)', () => {
    const late = task({ dueOn: '2026-10-01' });
    const due = task({ dueOn: TODAY });
    const saturday = task({ dueOn: '2026-10-10' });
    const sunday = task({ dueOn: '2026-10-11' });
    const monday = task({ dueOn: '2026-10-12' });
    const undated = task();
    const done = doneToday();
    const sections = allSections([done, undated, monday, sunday, saturday, due, late], TODAY);
    expect(sections.map((s) => [s.key, s.title, s.count])).toEqual([
      ['overdue', 'De días anteriores', 1],
      ['today', 'Hoy', 1],
      ['thisWeek', 'Esta semana', 2],
      ['later', 'Más adelante', 1],
      ['undated', 'Sin fecha', 1],
      ['done', 'Hechas', 1],
    ]);
    expect(sections[2]?.data).toEqual([
      { kind: 'note', task: saturday },
      { kind: 'note', task: sunday },
    ]);
    expect(sections[5]?.data).toEqual([{ kind: 'tray', tasks: [done] }]);
  });

  it('on a Sunday the week is over: from tomorrow on is later', () => {
    const monday = task({ dueOn: '2026-10-12' });
    expect(allSections([monday], '2026-10-11').map((s) => s.key)).toEqual(['later']);
  });

  it('on a Monday the whole week ahead is this week', () => {
    const sunday = task({ dueOn: '2026-10-18' });
    expect(allSections([sunday], '2026-10-12').map((s) => s.key)).toEqual(['thisWeek']);
  });

  it('drops the groups with nothing in them', () => {
    expect(allSections([task()], TODAY).map((s) => s.key)).toEqual(['undated']);
    expect(allSections([], TODAY)).toEqual([]);
  });
});
