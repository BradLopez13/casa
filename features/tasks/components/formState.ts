// Pure: no react-native import, so Vitest can check it.
import type { TaskInput } from '../api';

/** The four property magnets of the task form, each opening its own picker. */
export type FormField = 'room' | 'assignee' | 'due' | 'repeat';

/**
 * The picker open when the form appears. A new task starts on the day, the one choice almost
 * every task makes; an existing one opens closed, showing only its values.
 */
export function openFieldFor(_initial: TaskInput, isNew: boolean): 'due' | null {
  return isNew ? 'due' : null;
}
