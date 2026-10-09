import { addDays } from './dates';

/** The four one-tap days of the task form: today and the three after it. */
export function quickDays(today: string): string[] {
  return [0, 1, 2, 3].map((n) => addDays(today, n));
}

/** True when `value` is one of the quick days (so "Otro…" is not the active cell). */
export function isQuickDay(value: string | null, today: string): boolean {
  return value !== null && quickDays(today).includes(value);
}
