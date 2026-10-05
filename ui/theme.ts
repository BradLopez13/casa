import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { palettes, radii, shadows, type Palette, type Scheme, type Shadow } from './tokens';

export type Colors = Palette;

export function space(n: number): number {
  return n * 4;
}

type FlagEvent = 'reduceMotionChanged' | 'highTextContrastChanged' | 'darkerSystemColorsChanged';
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

// "Increase contrast" (iOS) and "High contrast text" (Android) swap muted text for a stronger tone.
const highContrast =
  Platform.OS === 'ios'
    ? systemFlag(AccessibilityInfo.isDarkerSystemColorsEnabled, 'darkerSystemColorsChanged')
    : Platform.OS === 'android'
      ? systemFlag(AccessibilityInfo.isHighTextContrastEnabled, 'highTextContrastChanged')
      : systemFlag(null, null);

// "Reduce Motion" (iOS) and "Remove animations" (Android); follows changes while the app runs.
const reduceMotion = systemFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');

export function useReduceMotion(): boolean {
  return useSyncExternalStore(reduceMotion.subscribe, reduceMotion.get);
}

export type Theme = {
  scheme: Scheme;
  colors: Colors;
  shadows: { magnet: Shadow; note: Shadow };
  radii: typeof radii;
  space: (n: number) => number;
};

export function useTheme(): Theme {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const strong = useSyncExternalStore(highContrast.subscribe, highContrast.get);
  const base = palettes[scheme];
  const colors = strong ? { ...base, muted: base.mutedStrong } : base;
  return { scheme, colors, shadows: shadows[scheme], radii, space };
}
