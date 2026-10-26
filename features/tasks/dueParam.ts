import { z } from 'zod';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The new task form's `due` for a task without a date (the «+» of Tareas' «Todas», bloque 11). */
export const NO_DATE = 'none';

/** The due date a link asks for (`?due=2026-10-20`), or today when it is missing or not a date. */
export function dueParam(value: string | string[] | undefined, today: string): string {
  return typeof value === 'string' && DATE.test(value) ? value : today;
}

/**
 * Who a link gives the new task to (`?assignee=<user id>`), or nobody when it is missing or not an
 * id: a malformed one used to leave Save doing nothing, as the form could never pass.
 */
export function assigneeParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && z.uuid().safeParse(value).success ? value : null;
}
