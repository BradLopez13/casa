import { t } from '@/i18n';

const TOKEN_PATTERN = /^[0-9a-f]{48}$/;

type CreateUrl = (path: string, opts: { queryParams: Record<string, string> }) => string;

/**
 * Where the invitation links live (decisión 1 de Brad, 2 de noviembre: B with a link that can be
 * tapped). Until Nido has its own domain, the project's GitHub Pages site, where `site/invite/`
 * opens Nido with one tap or leads to Google Play; a chat app turns an https link into one that can
 * be tapped, never `casa://`. With the domain at the launch, `EXPO_PUBLIC_INVITE_HOST=<domain>` and
 * `app.config.js` declares the App Links and Universal Links too (`site/INVITACIONES.md`).
 */
export const DEFAULT_INVITE_HOST = 'bradlopez13.github.io/casa';
const rawHost: unknown = process.env.EXPO_PUBLIC_INVITE_HOST;
export const INVITE_HOST: string | undefined =
  typeof rawHost === 'string' && rawHost !== '' ? rawHost : DEFAULT_INVITE_HOST;

/** Pass `Linking.createURL` from expo-linking as `createUrl`. */
/** `host` null: the app's own `casa://invite?token=…` (a development build, the tests). */
export function buildInviteUrl(
  token: string,
  createUrl: CreateUrl,
  host: string | null = INVITE_HOST ?? null,
): string {
  // `/invite/` with its slash: GitHub Pages serves the folder's page there without a redirect.
  if (host !== null) return `https://${host}/invite/?token=${token}`;
  return createUrl('invite', { queryParams: { token } });
}

/**
 * The message an invitation is shared or copied with (bloque 14.3, P1-3): who invites to which
 * home, how to join in two steps (tap the link, or install Nido and paste this message in «Unirme
 * con un enlace»), and the link alone on the last line, so a chat app turns it into a link and
 * never runs it into the sentence. The whole message, pasted, is a valid invitation.
 */
export function inviteMessage(url: string, household: string): string {
  return t('invite.shareMessage', { household, url, join: t('households.join') });
}

/** Accepts a bare token or any text containing `token=` (a link, the whole message). */
export function parseInviteToken(input: string | string[] | undefined): string | null {
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const match = /[?&]token=([^&#\s]*)/.exec(text);
  const candidate = match?.[1] ?? text;
  return TOKEN_PATTERN.test(candidate) ? candidate : null;
}
