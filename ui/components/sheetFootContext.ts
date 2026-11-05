import { createContext, useCallback, useContext, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useInSheet } from './ModalSheet';

/** The height of the foot of the sheet on screen (Guardar, Añadir), or 0 without one. */
export const SheetFootContext = createContext(0);
export const SheetFootSetContext = createContext<(height: number) => void>(() => undefined);

export const useSheetFootHeight = () => useContext(SheetFootContext);

/**
 * How a sheet's foot makes room for the notice pill (bloque 15.3, P2-4): the foot reports its
 * height through `onLayout` and `Notice` draws the pill above it, as it clears the tab bar on the
 * tabs. Inside the centred sheet of a wide window the foot does not touch the bottom edge, so
 * there nothing is reported. Unmounting the sheet takes the room back.
 */
export function useSheetFoot(): { onLayout: (event: LayoutChangeEvent) => void } {
  const set = useContext(SheetFootSetContext);
  const inSheet = useInSheet();
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => set(inSheet ? 0 : event.nativeEvent.layout.height),
    [set, inSheet],
  );
  useEffect(() => () => set(0), [set]);
  return { onLayout };
}
