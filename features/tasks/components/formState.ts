// Pure: no react-native import, so Vitest can check it.
import type { TaskInput } from '../api';

/** The four property magnets of the task form, each opening its own picker. */
export type FormField = 'room' | 'assignee' | 'due' | 'repeat';

/**
 * The picker open when the form appears: none, new task or existing. The form opens closed,
 * showing only its values; each magnet opens its picker on a tap.
 */
export function openFieldFor(_initial: TaskInput, _isNew: boolean): null {
  return null;
}
