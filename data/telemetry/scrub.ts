// Secrets that travel in URLs: the invite token in the deep link and the auth parameters of
// the OAuth and recovery callbacks. They must never reach Sentry in a breadcrumb or a request.
const INVITE = /(casa:\/\/invite\/)[^/?#\s]+/g;
const PARAMS = /([?&#](?:code|token|access_token|refresh_token)=)[^&#\s]*/g;

/** The same text with every secret in it replaced by `[redacted]`; anything else is untouched. */
export function scrubUrl(text: string): string {
  return text.replace(INVITE, '$1[redacted]').replace(PARAMS, '$1[redacted]');
}
