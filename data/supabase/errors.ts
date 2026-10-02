export const APP_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'INVALID_NAME',
  'ALREADY_IN_HOUSEHOLD',
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'NOT_A_MEMBER',
  'NOT_OWNER',
  'OWNER_MUST_TRANSFER',
  'CANNOT_REMOVE_SELF',
  'NETWORK',
  'UNKNOWN',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}

const RPC_CODES: ReadonlySet<string> = new Set(
  APP_ERROR_CODES.filter((code) => code !== 'NETWORK' && code !== 'UNKNOWN'),
);

const NETWORK_MESSAGE = /Network request failed|Failed to fetch|fetch failed/i;

function isCode(value: string): value is AppErrorCode {
  return RPC_CODES.has(value);
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (typeof e !== 'object' || e === null) return new AppError('UNKNOWN');

  const code = 'code' in e ? e.code : undefined;
  const message = 'message' in e && typeof e.message === 'string' ? e.message : '';

  if (code === 'P0001') return new AppError(isCode(message) ? message : 'UNKNOWN');
  if (NETWORK_MESSAGE.test(message)) return new AppError('NETWORK');
  return new AppError('UNKNOWN');
}
