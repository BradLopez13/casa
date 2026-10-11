// Data layer only (AsyncStorage + push API): `features/auth/api.ts` imports this module, so
// it must never import anything that imports auth.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, unregisterPushToken } from './api';

/** The token this phone last registered, and for whom. */
export type PushRegistration = { userId: string; token: string };

const KEY = 'casa-push-registration';
/** How long sign-out waits for a registration that is still on its way to the server. */
const PENDING_WAIT_MS = 3000;

// The registration in flight, if any: sign-out waits for it so its unregister reaches the
// server after the register, never before (or the phone would keep getting the old user's
// notices).
let pending: Promise<void> | null = null;

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
 * Registers the token on the server, then saves it on this device unless `keep` says the
 * session that asked for it has ended. Sign-out waits for this (see `forgetPushRegistration`).
 */
export function registerAndSave(
  current: PushRegistration,
  platform: 'android' | 'ios',
  keep: () => boolean = () => true,
): Promise<void> {
  const job = (async () => {
    await registerPushToken(current.token, platform);
    if (keep()) await savePushRegistration(current);
  })();
  const settled: Promise<void> = job.then(
    () => undefined,
    () => undefined,
  );
  pending = settled;
  void settled.then(() => {
    if (pending === settled) pending = null;
  });
  return job;
}

/** Resolves when `promise` settles or after `ms`, whichever comes first. */
function settleWithin(promise: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * On sign-out: waits (up to 3 s) for a registration in flight, then tells the server to stop
 * sending to the saved token (errors ignored, so the sign-out is never blocked) and forgets it
 * locally.
 */
export async function forgetPushRegistration(): Promise<void> {
  // A registration still in flight saves before we read, so its token is unregistered too.
  if (pending) await settleWithin(pending, PENDING_WAIT_MS);
  const saved = await loadPushRegistration();
  if (!saved) return;
  try {
    await unregisterPushToken(saved.token);
  } catch {
    // Best effort: the server also drops tokens Expo reports as gone.
  }
  await clearPushRegistration();
}
