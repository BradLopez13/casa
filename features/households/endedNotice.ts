import { useSyncExternalStore } from 'react';

/**
 * What the screen with no household says when the only one ended from someone else's side
 * (bloque 15.2, P2-2): «Ya no estás en «Critica Nov»: la han borrado.» A notice would be gone by
 * the time the route guard lands there, so the sentence waits here for the onboarding to read.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export function setEndedNotice(text: string): void {
  current = text;
  for (const listener of [...listeners]) listener();
}

export function clearEndedNotice(): void {
  if (current === null) return;
  current = null;
  for (const listener of [...listeners]) listener();
}

export const readEndedNotice = (): string | null => current;

export function useEndedNotice(): string | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, readEndedNotice);
}
