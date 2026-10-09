import type { RecurrenceRule } from '@/domain/recurrence/rule';
import type { Room } from './rooms';

/** What a task form or a template creates or saves. */
export type TaskInput = {
  title: string;
  room: Room | null;
  assigneeId: string | null;
  dueOn: string | null;
  recurrence: RecurrenceRule | null;
};
