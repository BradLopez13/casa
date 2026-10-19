import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

type FlagEvent =
  | 'reduceMotionChanged'
  | 'highTextContrastChanged'
  | 'darkerSystemColorsChanged'
  | 'screenReaderChanged';
type Flag = { get: () => boolean; subscribe: (listener: () => void) => () => void };

/** One app-wide subscription to a phone accessibility setting, read through useSyncExternalStore. */
function systemFlag(read: (() => Promise<boolean>) | null, event: FlagEvent | null): Flag {
  let value = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === value) return;
    value = next;
    listeners.forEach((listener) => listener());
  };
  if (read && event) {
    read()
      .then(set)
      .catch(() => undefined);
    AccessibilityInfo.addEventListener(event, set);
  }
  return {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// "Increase contrast" (iOS) and "High contrast text" (Android) swap in the stronger tones.
const highContrast =
  Platform.OS === 'ios'
    ? systemFlag(AccessibilityInfo.isDarkerSystemColorsEnabled, 'darkerSystemColorsChanged')
    : Platform.OS === 'android'
      ? systemFlag(AccessibilityInfo.isHighTextContrastEnabled, 'highTextContrastChanged')
      : systemFlag(null, null);

// "Reduce Motion" (iOS) and "Remove animations" (Android); follows changes while the app runs.
const reduceMotion = systemFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');

// VoiceOver (iOS) and TalkBack (Android).
const screenReader = systemFlag(AccessibilityInfo.isScreenReaderEnabled, 'screenReaderChanged');

export function useReduceMotion(): boolean {
  return useSyncExternalStore(reduceMotion.subscribe, reduceMotion.get);
}

export function useHighContrast(): boolean {
  return useSyncExternalStore(highContrast.subscribe, highContrast.get);
}

export function useScreenReader(): boolean {
  return useSyncExternalStore(screenReader.subscribe, screenReader.get);
}

/** The screen reader setting right now, for callbacks that run outside a render. */
export const isScreenReaderOn = screenReader.get;

/** Says `message` with a screen reader on; nothing otherwise. For actions whose result is silent. */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
