export const APP_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'INVALID_NAME',
  'INVALID_DISPLAY_NAME',
  'ALREADY_IN_HOUSEHOLD',
  'ALREADY_A_MEMBER',
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'NOT_A_MEMBER',
  'NOT_OWNER',
  'OWNER_MUST_TRANSFER',
  'CANNOT_REMOVE_SELF',
  'INVALID_TITLE',
  'INVALID_ROOM',
  'INVALID_ASSIGNEE',
  'TASK_NOT_FOUND',
  'INVALID_RECURRENCE',
  'RECURRENCE_NEEDS_DATE',
  'INVALID_TODAY',
  'NOT_RECURRING',
  'ALREADY_ADVANCED',
  'CANNOT_DELETE_TASK',
  'INVALID_ITEM_NAME',
  'INVALID_QUANTITY',
  'ITEM_NOT_FOUND',
  'ITEM_ALREADY_LISTED',
  'INVALID_TIME_ZONE',
  'INVALID_PUSH_TOKEN',
  'INVALID_PREFS',
  'LICENSE_REQUIRED',
  'BILLING_DISABLED',
  'NETWORK',
  'UNKNOWN',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** What the server added to the code, as it sent it (OWNER_MUST_TRANSFER: the households). */
  readonly detail: string | undefined;

  constructor(code: AppErrorCode, detail?: string) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

const RPC_CODES: ReadonlySet<string> = new Set(
  APP_ERROR_CODES.filter((code) => code !== 'NETWORK' && code !== 'UNKNOWN'),
);

/**
 * A request that never reached the server or got no answer in time (the client's time limit,
 * `fetchWithTimeout`): the fetch failure itself, or PostgREST's `${name}: ${message}` of it. On
 * the phone the abort polyfill drops the reason, so the cut arrives as a bare «Aborted».
 */
export const NETWORK_MESSAGE =
  /Network request failed|Failed to fetch|fetch failed|TimeoutError|AbortError|signal timed out|operation was aborted|^Aborted$/i;

/** Whether `e` is a fetch that failed or was cut by the time limit. */
export function isNetworkFailure(e: object): boolean {
  const name = 'name' in e && typeof e.name === 'string' ? e.name : '';
  const message = 'message' in e && typeof e.message === 'string' ? e.message : '';
  return name === 'TimeoutError' || name === 'AbortError' || NETWORK_MESSAGE.test(message);
}

function isCode(value: string): value is AppErrorCode {
  return RPC_CODES.has(value);
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (typeof e !== 'object' || e === null) return new AppError('UNKNOWN');

  const code = 'code' in e ? e.code : undefined;
  const message = 'message' in e && typeof e.message === 'string' ? e.message : '';

  if (code === 'P0001') {
    const details = 'details' in e && typeof e.details === 'string' ? e.details : undefined;
    return new AppError(isCode(message) ? message : 'UNKNOWN', details ?? undefined);
  }
  if (isNetworkFailure(e)) return new AppError('NETWORK');
  return new AppError('UNKNOWN');
}

/**
 * PostgREST's answer when no function matches the name and arguments sent (PGRST202) or the table
 * is not there (PGRST205): a database a migration behind. The callers then go as before.
 */
export function isMissingOnServer(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'PGRST202' || error.code === 'PGRST205')
  );
}
