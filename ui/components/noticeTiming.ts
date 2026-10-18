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
