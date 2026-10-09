const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

/** YYYY-MM-DD from the LOCAL calendar fields of `d`. */
export function localDateIso(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A Date at local midnight of YYYY-MM-DD (local fields, never UTC), for display and pickers. */
export function toLocalDate(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d);
}

/** Calendar arithmetic on a YYYY-MM-DD string; UTC fields so clock changes never shift it. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Whole calendar days from `a` to `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** ISO weekday of a YYYY-MM-DD string: Monday is 1, Sunday is 7. */
export function isoWeekday(iso: string): IsoWeekday {
  const [y, m, d] = parts(iso);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}
