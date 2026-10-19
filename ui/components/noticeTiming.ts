// Pure: no react-native import, so Vitest can check it.

/** How long a plain notice stays, in ms. */
export const NOTICE_MS = 4000;
/** A notice with an action stays a second longer, so the action can be reached. */
export const NOTICE_ACTION_MS = 5000;

/**
 * How long a notice stays, in ms, or null when it must wait for the person: with a screen reader
 * on, reaching the action takes as long as it takes (WCAG 2.2.1), so an action never times out.
 */
export function noticeDuration({
  action,
  screenReader,
}: {
  action: boolean;
  screenReader: boolean;
}): number | null {
  if (!action) return NOTICE_MS;
  return screenReader ? null : NOTICE_ACTION_MS;
}

type Seen = { id: number; hasAction: boolean };

/**
 * Whether the notice `prev` just went away without its action being used (timed out, closed,
 * replaced, or put away by a change of tab), so whoever waits on it can stop waiting. `acted` is
 * the id of the notice whose action was pressed, if any.
 */
export function noticeExpired(prev: Seen | null, next: Seen | null, acted: number | null): boolean {
  if (!prev?.hasAction) return false;
  if (next?.id === prev.id) return false;
  return acted !== prev.id;
}
