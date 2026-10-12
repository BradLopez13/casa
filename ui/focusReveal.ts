import { createContext, useContext } from 'react';

/**
 * Set by a form's scroll view (CenteredCard) to bring the focused field into view above the
 * keyboard. Every TextField calls it when it takes focus; outside such a form it does nothing.
 */
export const FocusRevealContext = createContext<() => void>(() => undefined);

export function useFocusReveal(): () => void {
  return useContext(FocusRevealContext);
}
