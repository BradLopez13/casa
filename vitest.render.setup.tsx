import type { ReactNode } from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom has no media queries; react-native-web, Reanimated and expo-haptics ask for reduced
// motion through them. Nothing matches: a phone with the default settings.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

// The icon fonts load through expo-font, which needs the native module. An icon is decorative
// in every component (hidden from screen readers), so a test only needs it to exist.
vi.mock('@expo/vector-icons/Ionicons', () => ({
  default: ({ name }: { name: string }) => <span data-icon={name} />,
}));

// Screens and forms reach the router; a render test checks what they draw and call, so the
// router is a set of spies. A test that needs to check a navigation reads them.
vi.mock('expo-router', () => {
  const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true };
  return {
    useRouter: () => router,
    router,
    useNavigation: () => ({ addListener: () => () => undefined, dispatch: vi.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: () => undefined,
    useSegments: () => [],
    useIsFocused: () => true,
  };
});
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => undefined }));

// Native-only: the safe area is a phone with no notch, and the date picker never opens on web.
vi.mock('react-native-safe-area-context', async () => {
  const { View } = await import('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext: (await import('react')).createContext(insets),
    initialWindowMetrics: { insets, frame },
  };
});
vi.mock('@react-native-community/datetimepicker', () => ({
  default: () => null,
  DateTimePickerAndroid: { open: vi.fn(), dismiss: vi.fn() },
}));

// The real client loads Expo's runtime and secure storage. A render test never reaches the
// server: the data a component reads comes from a QueryClient filled by the test.
vi.mock('@/data/supabase/client', () => ({ supabase: {}, configProblem: null }));

// expo-crypto loads Expo's native runtime; the web's own crypto does the same job here.
vi.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomValues: <T extends ArrayBufferView>(array: T) => crypto.getRandomValues(array as never),
  digestStringAsync: vi.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

// The drawings (the Nido symbol, the brand marks) are decorative: their shapes are plain tags.
vi.mock('react-native-svg', () => {
  const shape = (tag: string) =>
    function Shape({ children }: { children?: ReactNode }) {
      return <span data-svg={tag}>{children}</span>;
    };
  return {
    default: shape('svg'),
    Svg: shape('svg'),
    Circle: shape('circle'),
    G: shape('g'),
    Path: shape('path'),
  };
});

// Reanimated's web build pulls in its worklets runtime. Its own mock (the TypeScript source,
// so react-native goes through the alias) runs animations as plain style changes.
vi.mock('react-native-reanimated', async () => {
  // The mock is CommonJS: everything it exports arrives under `default`.
  // Through a variable so the typecheck does not walk into Reanimated's sources.
  const source = 'react-native-reanimated/src/mock';
  const mock = ((await import(/* @vite-ignore */ source)) as { default: object }).default;
  return mock;
});

// A note's swipe needs the native gesture handler; in a test the note is drawn without it (the
// swipe's own logic is tested apart).
vi.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  default: ({ children }: { children?: ReactNode }) => children,
  SwipeDirection: { LEFT: 'left', RIGHT: 'right' },
}));
