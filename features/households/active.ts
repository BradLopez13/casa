import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The household this phone shows, per person (bloque 12): a preference of the device, not of the
 * server (decisión de Brad, 26 oct). Another phone may show another household.
 */
export const activeHouseholdStorageKey = (userId: string) => `casa-active-household-${userId}`;

/** The stored choice; null when there is none or the store cannot be read. */
export async function readActiveHousehold(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(activeHouseholdStorageKey(userId));
  } catch {
    return null;
  }
}

/** Remembers the choice; a store that cannot be written only forgets it on the next start. */
export async function writeActiveHousehold(userId: string, householdId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(activeHouseholdStorageKey(userId), householdId);
  } catch {
    // The switch already happened on screen; only the next cold start may open another one.
  }
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
