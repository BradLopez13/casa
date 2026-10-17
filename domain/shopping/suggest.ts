import { normalizeItemName } from './normalize';

export type HistoryEntry = {
  name: string;
  normalizedName: string;
  uses: number;
  lastUsedAt: string;
};

const MAX_SUGGESTIONS = 5;

/** History entries to offer while typing: prefix matches first, then word matches. */
export function suggest(
  history: readonly HistoryEntry[],
  prefix: string,
  pendingNormalized: ReadonlySet<string>,
): HistoryEntry[] {
  const needle = normalizeItemName(prefix);
  if (needle === '') return [];
  const candidates = history.filter((e) => !pendingNormalized.has(e.normalizedName));
  const starts = candidates.filter((e) => e.normalizedName.startsWith(needle));
  const words = candidates.filter(
    (e) =>
      !e.normalizedName.startsWith(needle) &&
      e.normalizedName.split(' ').some((word) => word.startsWith(needle)),
  );
  return [...starts, ...words].slice(0, MAX_SUGGESTIONS);
}

const MAX_USUAL = 6;

/** The most used names in the history that are not on the list now, for an empty list. */
export function usual(
  history: readonly HistoryEntry[],
  pendingNormalized: ReadonlySet<string>,
  n = MAX_USUAL,
): HistoryEntry[] {
  return history
    .filter((e) => !pendingNormalized.has(e.normalizedName))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'es'))
    .slice(0, n);
}
