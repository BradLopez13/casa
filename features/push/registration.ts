// Data layer only (AsyncStorage + push API): `features/auth/api.ts` imports this module, so
// it must never import anything that imports auth.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, unregisterPushToken } from './api';

/** The token this phone last registered, and for whom. */
export type PushRegistration = { userId: string; token: string };

const KEY = 'casa-push-registration';
/** How long sign-out waits for a registration that is still on its way to the server. */
const PENDING_WAIT_MS = 3000;

// Registrations in flight: sign-out waits for them so its unregister reaches the server after
// the register, never before (or the phone would keep getting the old user's notices).
const pending = new Set<Promise<void>>();

/**
 * Marks a registration run as in flight from its very start (before the permission check and
 * the token request), so a sign-out that arrives meanwhile waits for it. Call the returned
 * function when the run ends, however it ends.
 */
export function beginRegistration(): () => void {
  let end: () => void = () => undefined;
  const settled = new Promise<void>((resolve) => {
    end = resolve;
  });
  pending.add(settled);
  void settled.then(() => pending.delete(settled));
  return end;
}

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
  const end = beginRegistration();
  const job = (async () => {
    await registerPushToken(current.token, platform);
    if (keep()) await savePushRegistration(current);
  })();
  void job.then(end, end);
  return job;
}

/**
 * A sign-out nobody asked for leaves no session to tell the server: the phone gives up its push
 * token instead, so it stops getting that person's notices (titles, household names), and the next
 * sign-in registers a new one. The server drops the old token when Expo reports it gone (bloque
 * 13, Aud P2-3).
 */
export async function releasePushLocally(): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.unregisterForNotificationsAsync();
  } catch {
    // Best effort: at worst the notices stop when someone else registers this phone.
  }
  await clearPushRegistration();
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
 * On sign-out: waits (up to 3 s) for registrations in flight, then tells the server to stop
 * sending to the saved token (up to 3 s more, errors ignored, so the sign-out is never
 * blocked) and forgets it locally.
 */
export async function forgetPushRegistration(): Promise<void> {
  // A registration still in flight saves before we read, so its token is unregistered too.
  if (pending.size > 0) {
    await settleWithin(
      Promise.all(pending).then(() => undefined),
      PENDING_WAIT_MS,
    );
  }
  const saved = await loadPushRegistration();
  if (!saved) return;
  // Best effort: the server also drops tokens Expo reports as gone.
  await settleWithin(
    unregisterPushToken(saved.token).catch(() => undefined),
    PENDING_WAIT_MS,
  );
  await clearPushRegistration();
}
