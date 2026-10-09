import { z } from 'zod';
import type { IsoWeekday } from '@/domain/tasks/dates';

export type { IsoWeekday };

export type RecurrenceRule =
  | { kind: 'interval'; every: number }
  | { kind: 'weekly'; days: IsoWeekday[] }
  | { kind: 'monthly'; day: number };

const weekdays = z
  .array(z.number().int().min(1).max(7))
  .min(1)
  .refine((days) => days.every((d, i) => i === 0 || d > (days[i - 1] ?? 0)), {
    message: 'days must be unique and in ascending order',
  });

export const recurrenceRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('interval'), every: z.number().int().min(1).max(365) }),
  z.strictObject({ kind: z.literal('weekly'), days: weekdays }),
  z.strictObject({ kind: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
]);
