import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/domain/tasks/views';
import { noteText } from './noteText';

const TODAY = '2026-10-09';

const base: TaskItem = {
  id: 't1',
  seriesId: 's1',
  title: 'Regar las plantas',
  room: 'kitchen',
  assigneeId: null,
  dueOn: TODAY,
  completedAt: null,
  completedBy: null,
  recurrence: null,
  skippedAt: null,
  generatedFrom: null,
  createdBy: null,
  createdAt: '2026-10-01T08:00:00.000Z',
};

describe('noteText', () => {
  it('has no repeat part for a one-off task', () => {
    const text = noteText(base, TODAY, 'Ana');
    expect(text.repeat).toBeNull();
    // Whose it is, as a short part right after the title (fase 10d).
    expect(text.label).toBe('Regar las plantas, de Ana, Cocina, Hoy');
  });

  it('says whose it is in a short part: «de Ana», «tuya», or nobody', () => {
    expect(noteText(base, TODAY, 'Ana').owner).toBe('de Ana');
    expect(noteText(base, TODAY, 'Tú', true).owner).toBe('tuya');
    expect(noteText(base, TODAY, 'Tú', true).label).toBe('Regar las plantas, tuya, Cocina, Hoy');
    expect(noteText(base, TODAY, undefined).owner).toBeNull();
  });

  it('appends the rule to the label of a recurring task', () => {
    const task = { ...base, recurrence: { kind: 'weekly', days: [1, 4] } } as TaskItem;
    const text = noteText(task, TODAY, undefined);
    expect(text.repeat).toBe('Lunes y jueves');
    expect(text.label).toBe('Regar las plantas, Sin responsable, Cocina, Hoy, Lunes y jueves');
  });

  it('flags an overdue task and words its due date as late', () => {
    const text = noteText({ ...base, dueOn: '2026-10-08' }, TODAY, 'Ana');
    expect(text.overdue).toBe(true);
    expect(text.due).not.toBe('Hoy');
  });
});
