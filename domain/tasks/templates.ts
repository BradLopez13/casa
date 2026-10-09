import { firstDueOn } from '@/domain/recurrence/next';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
// Type-only: the task input shape the create RPC takes; nothing from the data layer is loaded.
import type { TaskInput } from '@/features/tasks/api';
import { t } from '@/i18n';
import type { Room } from './rooms';

export type TemplateKey =
  | 'dishes'
  | 'trash'
  | 'laundry'
  | 'bathroom'
  | 'sheets'
  | 'vacuum'
  | 'mop'
  | 'plants'
  | 'fridge'
  | 'oven';

export type TaskTemplate = { key: TemplateKey; room: Room; rule: RecurrenceRule };

/** Typical household chores offered to a household with no tasks yet. */
export const TEMPLATES: readonly TaskTemplate[] = [
  { key: 'dishes', room: 'kitchen', rule: { kind: 'interval', every: 1 } },
  { key: 'trash', room: 'kitchen', rule: { kind: 'weekly', days: [1, 4] } },
  { key: 'laundry', room: 'laundry', rule: { kind: 'interval', every: 3 } },
  { key: 'bathroom', room: 'bathroom', rule: { kind: 'weekly', days: [6] } },
  { key: 'sheets', room: 'bedroom', rule: { kind: 'interval', every: 14 } },
  { key: 'vacuum', room: 'living_room', rule: { kind: 'weekly', days: [3, 6] } },
  { key: 'mop', room: 'living_room', rule: { kind: 'weekly', days: [7] } },
  { key: 'plants', room: 'outdoor', rule: { kind: 'interval', every: 3 } },
  { key: 'fridge', room: 'kitchen', rule: { kind: 'monthly', day: 1 } },
  { key: 'oven', room: 'kitchen', rule: { kind: 'monthly', day: 15 } },
];

export function templateTitle(template: TaskTemplate): string {
  return t(`templates.${template.key}`);
}

/** The tasks to create for the chosen templates, unassigned and in TEMPLATES order. */
export function templateInputs(keys: string[], today: string): TaskInput[] {
  return TEMPLATES.filter((template) => keys.includes(template.key)).map((template) => ({
    title: templateTitle(template),
    room: template.room,
    assigneeId: null,
    dueOn: firstDueOn(template.rule, today),
    recurrence: template.rule,
  }));
}
