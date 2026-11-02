// Pure: no react-native import, so Vitest can check it.
import { errorReport, type ErrorReport } from '@/data/telemetry/queryErrors';

type Reporter = (error: unknown, report: ErrorReport) => void;
let reporter: Reporter = () => undefined;

/**
 * Where a failed query or mutation worth knowing about goes (Sentry, from the root layout):
 * unknown answers and queued changes the queue dropped (bloque 13, T-2; `errorReport`).
 */
export function reportQueryErrorsTo(next: Reporter): void {
  reporter = next;
}

/** A failed query or mutation, if `errorReport` says it is worth knowing about. */
export function reportQueryError(
  error: unknown,
  key: readonly unknown[] | undefined,
  queued: boolean,
): void {
  const found = errorReport(error, { key, queued });
  if (found) reporter(error, found);
}

/**
 * Saving or restoring the offline queue on the device failed (bloque 14.4, T3: a full disk, a
 * broken write): Sentry hears it, with the step and nothing of what was queued.
 */
export function reportQueueStorage(error: unknown, step: 'save' | 'restore'): void {
  reporter(error, {
    key: `queue/${step}`,
    code: 'QUEUE_STORAGE',
    status: undefined,
    serverCode: undefined,
    queued: true,
  });
}
