import { z } from 'zod';

export const emailSchema = z.string().trim().pipe(z.email());

export const codeSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\d{6}$/));

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  email: z.email(),
  password: z.string().min(8),
});

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  code: codeSchema,
  password: z.string().min(8),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
