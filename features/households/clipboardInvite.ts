import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { buildInviteUrl, parseInviteToken } from './invite-link';

/** Invitations made on this phone: copying your own and then opening the screen must not fill it. */
const own = new Set<string>();

/** An invitation this phone just shared or copied (Miembros). */
export function rememberOwnInvite(token: string): void {
  own.add(token);
}

/**
 * The invitation the person has copied, if any, to fill «Unirme con un enlace» when it opens
 * (bloque 14.3): they copied the message from WhatsApp and only have to tap «Unirme». The text as
 * copied when it is a short link, or the token alone inside a whole message. Only on Android: iOS
 * asks for permission every time an app reads the clipboard.
 */
export async function inviteFromClipboard(os: string = Platform.OS): Promise<string | null> {
  if (os !== 'android') return null;
  try {
    if (!(await Clipboard.hasStringAsync())) return null;
    const text = (await Clipboard.getStringAsync()).trim();
    const token = parseInviteToken(text);
    if (token === null || own.has(token)) return null;
    // The link alone in the field, whether a link or a whole message was copied.
    return /\s/.test(text) ? buildInviteUrl(token, Linking.createURL) : text;
  } catch {
    return null;
  }
}
