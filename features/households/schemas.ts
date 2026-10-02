import { z } from 'zod';

export const householdNameSchema = z.string().trim().min(1).max(60);
