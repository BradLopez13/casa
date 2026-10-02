const TOKEN_PATTERN = /^[0-9a-f]{48}$/;

type CreateUrl = (path: string, opts: { queryParams: Record<string, string> }) => string;

/** Pass `Linking.createURL` from expo-linking as `createUrl`. */
export function buildInviteUrl(token: string, createUrl: CreateUrl): string {
  return createUrl('invite', { queryParams: { token } });
}

/** Accepts a bare token or any URL containing `token=`; returns it only if well formed. */
export function parseInviteToken(input: string | string[] | undefined): string | null {
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const match = /[?&]token=([^&#\s]*)/.exec(text);
  const candidate = match?.[1] ?? text;
  return TOKEN_PATTERN.test(candidate) ? candidate : null;
}
