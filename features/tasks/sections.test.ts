import { describe, expect, it } from 'vitest';
import { selectWeek, type TaskItem } from '@/domain/tasks/views';
import { allSections, todaySections, weekSections } from './sections';

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
  it('lists overdue, today and the done tray, in that order', () => {
    const late = task({ dueOn: '2026-10-07' });
    const due = task({ dueOn: TODAY });
    const done = doneToday();
    const sections = todaySections([done, due, late], TODAY);
    expect(sections.map((s) => [s.key, s.title, s.count])).toEqual([
      ['overdue', 'Vencidas', 1],
      ['today', 'Para hoy', 1],
      ['doneToday', 'Hechas hoy', 1],
    ]);
    expect(sections[0]?.data).toEqual([{ kind: 'note', task: late }]);
    expect(sections[2]?.data).toEqual([{ kind: 'tray', tasks: [done] }]);
  });

  it('drops empty sections, including an empty tray', () => {
    const due = task({ dueOn: TODAY });
    expect(todaySections([due], TODAY).map((s) => s.key)).toEqual(['today']);
    expect(todaySections([], TODAY)).toEqual([]);
  });
});

describe('weekSections', () => {
  it('keys each day section by its date and titles it with the day heading', () => {
    const tomorrow = task({ dueOn: '2026-10-10' });
    const saturday = task({ dueOn: '2026-10-11' });
    const late = task({ dueOn: '2026-10-01' });
    const tasks = [tomorrow, saturday, late];
    const sections = weekSections(selectWeek(tasks, TODAY), TODAY);
    expect(sections.map((s) => [s.key, s.title, s.count])).toEqual([
      ['overdue', 'Vencidas', 1],
      ['2026-10-10', 'Mañana', 1],
      ['2026-10-11', 'domingo 11', 1],
    ]);
  });

  it('has no section for a day with nothing on it', () => {
    expect(weekSections(selectWeek([], TODAY), TODAY)).toEqual([]);
  });
});

describe('allSections', () => {
  it('lists dated, undated and the done tray', () => {
    const dated = task({ dueOn: '2026-11-01' });
    const undated = task();
    const done = doneToday();
    const sections = allSections([done, undated, dated], TODAY);
    expect(sections.map((s) => [s.key, s.title, s.count])).toEqual([
      ['dated', 'Con fecha', 1],
      ['undated', 'Sin fecha', 1],
      ['done', 'Hechas', 1],
    ]);
    expect(sections[2]?.data).toEqual([{ kind: 'tray', tasks: [done] }]);
  });
});
