// Pure: no react-native import, so Vitest can check it.

/** How long a plain notice stays, in ms. */
export const NOTICE_MS = 4000;
/** A notice with an action stays a second longer, so the action can be reached. */
export const NOTICE_ACTION_MS = 5000;

export function noticeDuration({ action }: { action: boolean }): number {
  return action ? NOTICE_ACTION_MS : NOTICE_MS;
}
