import { z } from 'zod';
import { ROOMS } from '@/domain/tasks/rooms';

const TITLE_MAX = 100;

// Postgres counts char_length in code points; Zod's min/max count UTF-16 units.
const title = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => {
    const length = [...s].length;
    return length >= 1 && length <= TITLE_MAX;
  });

export const taskFormSchema = z.object({
  title,
  room: z.enum(ROOMS).nullable(),
  assigneeId: z.uuid().nullable(),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});
