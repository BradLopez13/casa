import { describe, expect, it } from 'vitest';
import { dayCountLabel } from './strip';

const today = '2026-10-18';
const names = new Map([
  ['a', 'Brad'],
  ['b', 'Segundo'],
]);

describe('dayCountLabel', () => {
  it('names the people with something that day', () => {
    const day = { date: '2026-10-19', people: ['a', 'b'], unassigned: false, count: 2 };
    expect(dayCountLabel(day, today, names)).toBe('Mañana, 2 tareas: Brad y Segundo');
    const later = { ...day, date: '2026-10-21' };
    expect(dayCountLabel(later, today, names)).toMatch(/^.+ 21, 2 tareas: Brad y Segundo$/);
  });

  it('uses the singular for one task', () => {
    const day = { date: '2026-10-18', people: ['a'], unassigned: false, count: 1 };
    expect(dayCountLabel(day, today, names)).toBe('Hoy, 1 tarea: Brad');
  });

  it('keeps the plain count when nobody is named', () => {
    const day = { date: '2026-10-18', people: [], unassigned: true, count: 2 };
    expect(dayCountLabel(day, today, names)).toBe('Hoy, 2 tareas');
  });
});
