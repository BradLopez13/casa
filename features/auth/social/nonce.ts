/** "Ana Ruiz" from Apple's name parts (only sent on the first sign-in); null when there is none. */
export function appleFullName(
  name: { givenName?: string | null; familyName?: string | null } | null,
): string | null {
  const full = [name?.givenName, name?.familyName]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join(' ');
  return full || null;
}

/** The PKCE `code` in a callback's query params, or null (missing, or an `error` came back). */
export function callbackCode(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.code;
  const code = Array.isArray(raw) ? raw[0] : raw;
  return code ? code : null;
}

/** True when the callback came back because the user backed out (denied, or cancelled). */
export function callbackCancelled(params: Record<string, string | string[] | undefined>): boolean {
  const raw = params.error;
  const error = Array.isArray(raw) ? raw[0] : raw;
  return error === 'access_denied' || !!error?.startsWith('user_cancelled');
}
