import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { palettes, radii, shadows, type Palette, type Scheme, type Shadow } from './tokens';

export type Colors = Palette;

export function space(n: number): number {
  return n * 4;
}

// "Increase contrast" (iOS) and "High contrast text" (Android) swap muted text for a stronger
// tone. One shared subscription for the whole app.
let highContrast = false;
const listeners = new Set<() => void>();
const contrastEvent =
  Platform.OS === 'ios'
    ? ('darkerSystemColorsChanged' as const)
    : Platform.OS === 'android'
      ? ('highTextContrastChanged' as const)
      : null;

function setHighContrast(value: boolean) {
  if (value === highContrast) return;
  highContrast = value;
  listeners.forEach((listener) => listener());
}

if (contrastEvent) {
  const initial =
    Platform.OS === 'ios'
      ? AccessibilityInfo.isDarkerSystemColorsEnabled()
      : AccessibilityInfo.isHighTextContrastEnabled();
  initial.then(setHighContrast).catch(() => undefined);
  AccessibilityInfo.addEventListener(contrastEvent, setHighContrast);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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
  const strong = useSyncExternalStore(subscribe, () => highContrast);
  const base = palettes[scheme];
  const colors = strong ? { ...base, muted: base.mutedStrong } : base;
  return { scheme, colors, shadows: shadows[scheme], radii, space };
}
