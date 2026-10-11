// Data layer only (AsyncStorage + push API): `features/auth/api.ts` imports this module, so
// it must never import anything that imports auth.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unregisterPushToken } from './api';

/** The token this phone last registered, and for whom. */
export type PushRegistration = { userId: string; token: string };

const KEY = 'casa-push-registration';

/** True when the server does not know this token for this user yet. */
export function shouldRegister(last: PushRegistration | null, current: PushRegistration): boolean {
  return last === null || last.userId !== current.userId || last.token !== current.token;
}

const isRegistration = (value: unknown): value is PushRegistration => {
  if (typeof value !== 'object' || value === null) return false;
  const { userId, token } = value as { userId?: unknown; token?: unknown };
  return typeof userId === 'string' && userId !== '' && typeof token === 'string' && token !== '';
};

/** The saved registration; anything missing or unreadable gives null. */
export async function loadPushRegistration(): Promise<PushRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRegistration(parsed) ? { userId: parsed.userId, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export async function savePushRegistration(r: PushRegistration): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ userId: r.userId, token: r.token }));
}

/** Forgets the registration on this device. Errors are ignored. */
export async function clearPushRegistration(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do: at worst the next sign-in registers again.
  }
}

/**
 * On sign-out: tells the server to stop sending to the saved token (errors ignored, so the
 * sign-out is never blocked) and forgets it locally.
 */
export async function forgetPushRegistration(): Promise<void> {
  const saved = await loadPushRegistration();
  if (!saved) return;
  try {
    await unregisterPushToken(saved.token);
  } catch {
    // Best effort: the server also drops tokens Expo reports as gone.
  }
  await clearPushRegistration();
}
