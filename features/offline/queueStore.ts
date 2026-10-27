import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Mutation,
  type MutationKey,
  type QueryClient,
} from '@tanstack/react-query';
import { shouldPersistMutation, shouldQueueMutation } from './persistence';

type Stored = DehydratedState['mutations'];
type AnyMutation = Mutation<unknown, Error, unknown, unknown>;

/**
 * Bumped when what a queued change holds changes shape, with a step in `migrate` from the one
 * before: the queue is never thrown away for being old (bloque 13, P2-3).
 */
export const QUEUE_SCHEMA = 1;

/** One person's queue: it outlives an update, a new cache schema and an unasked sign-out. */
export const queueKey = (userId: string) => `casa-queue-${userId}`;

const isQueued = shouldPersistMutation;

/**
 * The queue a change waits in: one per household and kind (`shopping:<id>`, `tasks:<id>`), so a
 * change of one household that cannot get through does not hold back another's (bloque 13, Aud
 * P3-1). The order only matters within a household.
 */
export function queueScope(
  mutationKey: MutationKey | undefined,
  variables: unknown,
): { id: string } | undefined {
  const kind = mutationKey?.[0];
  const householdId = (variables as { householdId?: unknown } | undefined)?.householdId;
  if (typeof kind !== 'string' || typeof householdId !== 'string') return undefined;
  return { id: `${kind}:${householdId}` };
}

function queuedNow(queryClient: QueryClient, only?: ReadonlySet<AnyMutation>): Stored {
  return dehydrate(queryClient, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: (m) => shouldQueueMutation(m) && (only === undefined || only.has(m)),
  }).mutations;
}

/** Whose queue the app is saving now: nobody until it is restored, and nobody once signed out. */
let owner: string | null = null;

/** The person's queue is in the cache: from now on every change to it is saved. */
export function startSavingQueue(userId: string): void {
  owner = userId;
}

/**
 * Signing out, asked or not: the cache is about to be cleared, and saving that empty queue would
 * throw away what an unasked sign-out must keep.
 */
export function stopSavingQueue(): void {
  owner = null;
}

/** Whether changes to the cache's queue are saved as this person's. */
export const savingQueueOf = (userId: string) => owner === userId;

/** Saves the person's queue as it is now, or forgets it when nothing waits. */
export async function saveQueue(queryClient: QueryClient, userId: string): Promise<void> {
  const mutations = queuedNow(queryClient);
  if (mutations.length === 0) {
    await AsyncStorage.removeItem(queueKey(userId));
    return;
  }
  await AsyncStorage.setItem(queueKey(userId), JSON.stringify({ v: QUEUE_SCHEMA, mutations }));
}

/** The stored queue in today's shape; null for one this build cannot read (left as it is). */
function migrate(raw: unknown): Stored | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { v, mutations } = raw as { v?: unknown; mutations?: unknown };
  if (v !== QUEUE_SCHEMA || !Array.isArray(mutations)) return null;
  return mutations as Stored;
}

async function readStored(userId: string): Promise<Stored | null> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    return raw === null ? [] : migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * A queue this build cannot read (a newer schema, a broken write) is copied aside before saving
 * starts, so the first save does not overwrite it: a later build can still read it.
 */
async function keepUnreadable(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    if (raw !== null) await AsyncStorage.setItem(`${queueKey(userId)}-unread`, raw);
  } catch {
    // Nothing else to do.
  }
}

/** How many changes the person had waiting on this phone, without taking them in. */
export async function countStoredQueue(userId: string): Promise<number> {
  return (await readStored(userId))?.length ?? 0;
}

/** Signing out on purpose: the person was told what it costs. */
export async function forgetQueue(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(queueKey(userId));
  } catch {
    // Nothing else to do: it would only be offered back to this same person.
  }
}

type Identified = { mutationKey?: MutationKey; state: { variables?: unknown } };

const identity = (m: Identified) =>
  JSON.stringify([m.mutationKey ?? null, m.state.variables ?? null]);

/** `from` without one occurrence of each change also in `already`: repeats count, in order. */
function minus<T extends Identified>(from: readonly T[], already: readonly Identified[]): T[] {
  const left = new Map<string, number>();
  for (const m of already) left.set(identity(m), (left.get(identity(m)) ?? 0) + 1);
  return from.filter((m) => {
    const n = left.get(identity(m)) ?? 0;
    if (n === 0) return true;
    left.set(identity(m), n - 1);
    return false;
  });
}

/**
 * Takes the person's stored queue into the cache, and the changes an older build kept inside the
 * cache itself, each in its household's queue and never twice. Says how many changes wait.
 * `resumeQueues` sends them afterwards.
 */
export async function restoreQueue(queryClient: QueryClient, userId: string): Promise<number> {
  const cache = queryClient.getMutationCache();
  // Older builds kept the queue in the cache, in one queue for every household: taken out and
  // put back in its household's.
  const legacy = new Set(
    cache
      .findAll({ status: 'pending' })
      .filter((m) => isQueued(m.options.mutationKey) && !m.options.scope?.id.includes(':')),
  );
  const adopted = legacy.size > 0 ? queuedNow(queryClient, legacy) : [];
  for (const mutation of legacy) cache.remove(mutation);
  const stored = await readStored(userId);
  if (stored === null) await keepUnreadable(userId);
  // The same change may be in two places (the cache an older build kept and its own key, or the
  // cache already holding it): taken once. Within one source a repeat is a real change (bought,
  // put back, bought again), so repeats are counted, never collapsed.
  const merged = [...(stored ?? []), ...minus(adopted, stored ?? [])];
  const present = cache
    .findAll({ status: 'pending' })
    .map((m) => ({ mutationKey: m.options.mutationKey, state: m.state }));
  const incoming: Stored = minus(merged, present).map((mutation) => ({
    ...mutation,
    scope: queueScope(mutation.mutationKey, mutation.state.variables) ?? mutation.scope,
  }));
  if (incoming.length > 0) hydrate(queryClient, { mutations: incoming, queries: [] });
  return cache.findAll({ status: 'pending' }).filter((m) => isQueued(m.options.mutationKey)).length;
}
