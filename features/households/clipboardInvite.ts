import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import { parseInviteToken } from './invite-link';

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
    if (token === null) return null;
    return /\s/.test(text) ? token : text;
  } catch {
    return null;
  }
}
