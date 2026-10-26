import { useEffect, useRef } from 'react';

/**
 * A sheet opened on one household's task or product closes if the app switches to another
 * household meanwhile (a tapped notice, a link; bloque 12): what it holds belongs to the first,
 * and saving it under the second would write to the wrong household.
 */
export function useCloseOnHouseholdSwitch(householdId: string | undefined, close: () => void) {
  const opened = useRef<string | undefined>(householdId);
  useEffect(() => {
    if (householdId === undefined) return;
    if (opened.current === undefined) {
      opened.current = householdId;
      return;
    }
    if (householdId !== opened.current) close();
  }, [householdId, close]);
}
