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
  /** The HTTP status of the answer, when there was one. */
  readonly status: number | undefined;
  /** PostgREST's or Postgres's own code (`PGRST301`, `40001`…), when the answer carried one. */
  readonly serverCode: string | undefined;

  constructor(
    code: AppErrorCode,
    detail?: string,
    origin: { status?: number; serverCode?: string } = {},
  ) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
    this.status = origin.status;
    this.serverCode = origin.serverCode;
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

/**
 * The app's error for whatever a call threw or answered. `status` is the HTTP status of the answer
 * (`unwrap` passes it), kept with the server's own code so a queued change can tell a server that
 * could not answer from one that said no (`isTransient`), and Sentry can say which.
 */
export function toAppError(e: unknown, status?: number): AppError {
  if (e instanceof AppError) return e;
  if (typeof e !== 'object' || e === null) return new AppError('UNKNOWN', undefined, { status });

  const code = 'code' in e ? e.code : undefined;
  const message = 'message' in e && typeof e.message === 'string' ? e.message : '';
  const origin = { status, serverCode: typeof code === 'string' && code !== '' ? code : undefined };

  if (code === 'P0001') {
    const details = 'details' in e && typeof e.details === 'string' ? e.details : undefined;
    // The app's own code is the message: P0001 says nothing more.
    return new AppError(isCode(message) ? message : 'UNKNOWN', details ?? undefined, { status });
  }
  if (isNetworkFailure(e)) return new AppError('NETWORK');
  return new AppError('UNKNOWN', undefined, origin);
}

/**
 * Answers that pass on their own: the JWT caught mid-refresh (`PGRST301`), PostgREST's pool full
 * (`PGRST003`), a serialization clash or deadlock (`40001`, `40P01`) and a statement cut short
 * (`57014`).
 */
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([502, 503, 504, 408, 429]);

const TRANSIENT_SERVER_CODES: ReadonlySet<string> = new Set([
  'PGRST301',
  'PGRST003',
  '40001',
  '40P01',
  '57014',
]);

/**
 * Whether a queued change that got this error should be tried again (bloque 13, P2-2): no answer
 * at all, a server that could not answer (502, 503, 504, 408, 429) or one of the codes that pass
 * on their own; a permission denied too, but only without a session, when supabase-js sent the
 * request with the anonymous key because the refresh failed. Anything else the server says is
 * final, a plain 500 included: an RPC broken by a migration would hold the queue for a week.
 */
export function isTransient(error: AppError, signedIn: boolean): boolean {
  if (error.code === 'NETWORK') return true;
  const { status, serverCode } = error;
  if (status !== undefined && TRANSIENT_STATUSES.has(status)) return true;
  if (serverCode === undefined) return false;
  if (TRANSIENT_SERVER_CODES.has(serverCode)) return true;
  return serverCode === '42501' && !signedIn;
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
