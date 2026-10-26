import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The household this phone shows, per person (bloque 12): a preference of the device, not of the
 * server (decisión de Brad, 26 oct). Another phone may show another household.
 */
export const activeHouseholdStorageKey = (userId: string) => `casa-active-household-${userId}`;

// The choice made since the app started, per person: it wins over the stored one, so a read of
// the store that started before a switch can never undo it, nor can a store that fails to write.
const chosenNow = new Map<string, string>();

/** The choice: the one made since the app started, else the stored one; null when there is none. */
export async function readActiveHousehold(userId: string): Promise<string | null> {
  const now = chosenNow.get(userId);
  if (now !== undefined) return now;
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(activeHouseholdStorageKey(userId));
  } catch {
    stored = null;
  }
  // A switch made while the store was being read wins.
  return chosenNow.get(userId) ?? stored;
}

/** Remembers the choice now, and on the phone for the next start. */
export async function writeActiveHousehold(userId: string, householdId: string): Promise<void> {
  chosenNow.set(userId, householdId);
  try {
    await AsyncStorage.setItem(activeHouseholdStorageKey(userId), householdId);
  } catch {
    // The switch holds for this run; only the next cold start may open another one.
  }
}

/** Tests only: forget the choices made in this run. */
export function forgetChosenHouseholds(): void {
  chosenNow.clear();
}

/**
 * Which of `households` the app shows: the preferred one while the person is still in it,
 * otherwise the first (the oldest membership); none without households.
 */
export function pickActive<T extends { householdId: string }>(
  households: readonly T[],
  preferredId: string | null,
): T | null {
  return households.find((h) => h.householdId === preferredId) ?? households[0] ?? null;
}
