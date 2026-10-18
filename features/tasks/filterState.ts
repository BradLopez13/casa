/** A radio filter: tapping the chosen one keeps it; null is "Todos". */
export function nextFilter(_current: string | null, tapped: string | null): string | null {
  return tapped;
}
