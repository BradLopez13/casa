import { createContext, useContext } from 'react';
import type { Reveal } from './useRevealFocusedField';

/**
 * Set by a scroll view that keeps the focused field in view above the keyboard (CenteredCard, the
 * modal forms, Compra's left pane). Every TextField calls it when it takes focus; a field with
 * suggestions or an error under it passes the block around them. Outside such a scroll it does
 * nothing.
 */
export const FocusRevealContext = createContext<Reveal>(() => undefined);

export function useFocusReveal(): Reveal {
  return useContext(FocusRevealContext);
}
