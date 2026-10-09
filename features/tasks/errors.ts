import { toAppError } from '@/data/supabase/errors';
import { t, type MessageKey } from '@/i18n';

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  INVALID_TITLE: 'tasks.errors.INVALID_TITLE',
  INVALID_ROOM: 'tasks.errors.INVALID_ROOM',
  INVALID_ASSIGNEE: 'tasks.errors.INVALID_ASSIGNEE',
  TASK_NOT_FOUND: 'tasks.errors.TASK_NOT_FOUND',
  INVALID_RECURRENCE: 'tasks.errors.INVALID_RECURRENCE',
  RECURRENCE_NEEDS_DATE: 'tasks.errors.RECURRENCE_NEEDS_DATE',
  INVALID_TODAY: 'tasks.errors.INVALID_TODAY',
  NOT_RECURRING: 'tasks.errors.NOT_RECURRING',
  ALREADY_ADVANCED: 'tasks.errors.ALREADY_ADVANCED',
  NOT_A_MEMBER: 'tasks.errors.NOT_A_MEMBER',
  NETWORK: 'tasks.errors.NETWORK',
};

export function taskErrorMessage(error: unknown): string {
  return t(ERROR_KEYS[toAppError(error).code] ?? 'tasks.errors.UNKNOWN');
}
