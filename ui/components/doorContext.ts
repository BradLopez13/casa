import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { DOOR_TYPE, doorFor, type Door, type DoorType } from '../door';
import { useLayout } from '../useLayout';

/** True when a parent (FridgeRefresh) already paints the door colour under the status bar. */
export const DoorInsetContext = createContext(false);

export type FridgeRefreshValue = { refreshing: boolean; onRefresh: () => void };

/** Provided by FridgeRefresh: lets the door's handle refresh the pane it sits in. */
export const FridgeRefreshContext = createContext<FridgeRefreshValue | null>(null);

/** The refresh of the surrounding FridgeRefresh, or null when the screen has none. */
export function useFridgeRefresh(): FridgeRefreshValue | null {
  return useContext(FridgeRefreshContext);
}

export const DoorCompactContext = createContext(false);
export const DoorTypeContext = createContext<DoorType>(DOOR_TYPE.full);

/**
 * True inside a compact door (short window): the door's children have one row beside the
 * headline, so they should lay themselves out in a row (magnets, filter and counter side by side).
 */
export function useDoorCompact(): boolean {
  return useContext(DoorCompactContext);
}

/** How this window draws the door (`doorFor`): a screen asks it to know where its quick add goes. */
export function useDoor(): Door {
  const layout = useLayout();
  const { height, fontScale } = useWindowDimensions();
  return doorFor(layout, height, fontScale);
}

/** The sizes of the door this sits in (§14.4): full, or the same hierarchy smaller when compact. */
export function useDoorType(): DoorType {
  return useContext(DoorTypeContext);
}

/**
 * The household a door names in its label (bloque 12): only with more than one, so with a single
 * household nothing changes. `onPress` opens «Tus casas»; without it the name is only said.
 */
export type DoorHousehold = { name: string; onPress?: () => void };

export const DoorHouseholdContext = createContext<DoorHousehold | null>(null);
