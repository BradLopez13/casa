import { z } from 'zod';
import { trimItemText } from '@/domain/shopping/normalize';

const NAME_MAX = 60;
const QUANTITY_MAX = 20;

// Postgres counts char_length in code points; Zod's min/max count UTF-16 units.
// trimItemText uses the same whitespace class as the server, unlike String.trim.
export const shoppingNameSchema = z
  .string()
  .transform(trimItemText)
  .refine((s) => {
    const length = [...s].length;
    return length >= 1 && length <= NAME_MAX;
  });

export const shoppingQuantitySchema = z
  .string()
  .transform(trimItemText)
  .refine((s) => [...s].length <= QUANTITY_MAX)
  .transform((s) => (s === '' ? null : s));
