const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The due date a link asks for (`?due=2026-10-20`), or today when it is missing or not a date. */
export function dueParam(value: string | string[] | undefined, today: string): string {
  return typeof value === 'string' && DATE.test(value) ? value : today;
}
