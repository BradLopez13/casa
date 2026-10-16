import { z } from 'zod';

export const emailSchema = z.string().trim().pipe(z.email());

export const codeSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\d{6}$/));

/** Adds `required` / `mismatch` issues on `passwordConfirm`. */
function checkConfirm(
  v: { password: string; passwordConfirm: string },
  ctx: z.core.$RefinementCtx,
): void {
  if (v.passwordConfirm === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['passwordConfirm'],
      params: { reason: 'required' },
      message: 'passwordConfirm:required',
    });
  } else if (v.passwordConfirm !== v.password) {
    ctx.addIssue({
      code: 'custom',
      path: ['passwordConfirm'],
      params: { reason: 'mismatch' },
      message: 'passwordConfirm:mismatch',
    });
  }
}

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    email: z.email(),
    password: z.string().min(8),
    passwordConfirm: z.string(),
  })
  .superRefine(checkConfirm);

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const resetPasswordSchema = z
  .object({
    code: codeSchema,
    password: z.string().min(8),
    passwordConfirm: z.string(),
  })
  .superRefine(checkConfirm);

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
