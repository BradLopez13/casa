import type { z } from 'zod';
import type { MessageKey } from '@/i18n';
import type { AuthErrorCode } from './errors';

const FIELD_MESSAGES: Readonly<Record<string, MessageKey>> = {
  'displayName:too_small': 'auth.errors.nameRequired',
  'displayName:too_big': 'auth.errors.nameTooLong',
  'email:invalid_format': 'auth.errors.emailInvalid',
  'email:invalid_type': 'auth.errors.emailInvalid',
  'password:too_small': 'auth.errors.passwordTooShort',
  'password:invalid_type': 'auth.errors.passwordRequired',
};

/** First i18n error key per field for a failed Zod parse. */
export function fieldErrors(
  error: z.ZodError,
  options: { form: 'signIn' | 'signUp' },
): Record<string, MessageKey> {
  const out: Record<string, MessageKey> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field in out) continue;
    const key =
      field === 'password' && options.form === 'signIn' && issue.code === 'too_small'
        ? 'auth.errors.passwordRequired'
        : FIELD_MESSAGES[`${field}:${issue.code}`];
    if (key) out[field] = key;
  }
  return out;
}

export function authErrorKey(code: AuthErrorCode): MessageKey {
  return `auth.errors.${code}`;
}
